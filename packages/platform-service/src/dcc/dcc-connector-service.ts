import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import {
  DCC_TOOLS,
  DccCapabilityReportSchema,
  DccInstallationSchema,
  DccRunSchema,
  RpcError,
  RpcErrorCode,
  compile,
  uuidv7,
  type DccCapabilityReport,
  type DccInstallation,
  type DccOperation,
  type DccRun,
  type DccTool,
  type EngineRunArtifact,
  type McpConnectionListEntry,
  type RpcNotificationParams,
  type RpcParams,
} from '@gamecrafter/contracts';
import type { Database } from '../db/database';
import type { McpConnectionManager } from '../mcp/connection-manager';
import type { ProfileStore } from '../profile/profile-store';
import type { ProjectDatabases } from '../projects/project-databases';
import type { SettingsService } from '../settings/settings-service';
import type { ToolBroker, ToolCallContext } from '../tools/tool-broker';
import type { ToolContext, ToolRegistry } from '../tools/tool-registry';
import { requireExistingProjectPath, resolveProjectPath } from '../assets/path-utils';
import { runEngineProcess } from '../engines/process-runner';
import { isExecutable } from '../engines/utils';
import { BlenderAdapter } from './adapters/blender';
import { MayaAdapter } from './adapters/maya';
import { Max3DAdapter } from './adapters/3dsmax';
import { Cinema4DAdapter } from './adapters/cinema4d';
import { ZBrushAdapter } from './adapters/zbrush';
import { registerDccTools } from './dcc-tools';
import { hostOs } from './adapters/common';
import { wslInterop, wslInteropEnvironment, type WslInterop } from './wsl-interop';
import type {
  DccAdapter,
  DccLiveBridgeProbe,
  DccProjectContext,
  DccOperationOutcome,
} from './types';

const installationValidator = compile<DccInstallation>(DccInstallationSchema);
const reportValidator = compile<DccCapabilityReport>(DccCapabilityReportSchema);
const runValidator = compile<DccRun>(DccRunSchema);
const scriptRiskPattern = /\bsubprocess\b|\bos\s*\.\s*system\b|\bshutil\s*\.\s*rmtree\b/i;

export interface DccConnectorServiceEvents {
  capabilitiesChanged(projectId: string, tool: DccTool, report: DccCapabilityReport): void;
  runChanged(projectId: string, tool: DccTool, run: DccRun): void;
}

export interface DccConnectorServiceOptions {
  database: Database;
  projects: ProfileStore;
  projectDatabases: ProjectDatabases;
  settings: SettingsService;
  toolRegistry: ToolRegistry;
  toolBroker: ToolBroker;
  mcpConnections: McpConnectionManager;
  events: DccConnectorServiceEvents;
  adapters?: DccAdapter[];
  environment?: () => NodeJS.ProcessEnv;
  wsl?: WslInterop;
  now?: () => Date;
}

interface BoundMcpProbe {
  connection: McpConnectionListEntry | null;
  status: DccLiveBridgeProbe['status'];
  detail: string;
  toolCount: number;
  mcpRevision: string | null;
}

export class DccConnectorService {
  private readonly adapters: Map<DccTool, DccAdapter>;
  private readonly now: () => Date;
  private readonly environment: () => NodeJS.ProcessEnv;
  private readonly wsl: WslInterop;
  private detecting?: Promise<void>;

  constructor(private readonly options: DccConnectorServiceOptions) {
    this.now = options.now ?? (() => new Date());
    this.environment = options.environment ?? (() => process.env);
    this.wsl = options.wsl ?? wslInterop;
    const adapters = options.adapters ?? [
      new BlenderAdapter(this.wsl),
      new MayaAdapter(this.wsl),
      new Max3DAdapter(this.wsl),
      new Cinema4DAdapter(this.wsl),
      new ZBrushAdapter(this.wsl),
    ];
    this.adapters = new Map(adapters.map((adapter) => [adapter.tool, adapter]));
    registerDccTools(options.toolRegistry, (tool, operation, context, params, runId) =>
      this.executeOperation(tool, context, operation, params, runId),
    );
  }

  async installations(tool?: DccTool): Promise<DccInstallation[]> {
    await this.refreshDetectedInstallations(tool);
    return this.readInstallations().filter((installation) => !tool || installation.tool === tool);
  }

  async addInstallation(input: RpcParams<'dcc/addInstallation'>): Promise<DccInstallation> {
    const adapter = this.requireAdapter(input.tool);
    if (!path.isAbsolute(input.executable) || !this.executableExists(input.executable)) {
      throw new RpcError(
        'DCC executable must be an absolute executable file.',
        RpcErrorCode.InvalidParams,
      );
    }
    const viaWslInterop =
      this.wsl.isWsl() &&
      input.executable.startsWith('/mnt/') &&
      input.executable.toLowerCase().endsWith('.exe');
    const installation = installationValidator.assert({
      schemaVersion: 1,
      installationId: uuidv7(),
      tool: input.tool,
      executable: path.resolve(input.executable),
      kind: input.kind,
      version: null,
      source: 'manual',
      hostOs: hostOs(process.platform),
      viaWslInterop,
      detectedAt: this.now().toISOString(),
    });
    const stored = installationValidator.assert({
      ...installation,
      version: await adapter.probeVersion(installation),
    });
    this.saveInstallation(stored);
    await this.refreshReports(input.tool);
    return stored;
  }

  async removeInstallation(installationId: string): Promise<void> {
    const existing = this.options.database
      .prepare(
        'SELECT installation_id AS installationId, tool FROM dcc_installations WHERE installation_id = ?',
      )
      .get<{ installationId: string; tool: DccTool }>(installationId);
    if (!existing) {
      throw new RpcError(
        `DCC installation not found: ${installationId}`,
        RpcErrorCode.DccInstallationNotFound,
      );
    }
    this.options.database
      .prepare('DELETE FROM dcc_installations WHERE installation_id = ?')
      .run(installationId);
    await this.refreshReports(existing.tool);
  }

  async capabilities(
    projectId: string,
    tool: DccTool,
    refresh = false,
    bridgeOverride?: string | null,
  ): Promise<DccCapabilityReport> {
    const project = this.requireProject(projectId);
    const database = this.options.projectDatabases.get(projectId);
    const cachedRow = database
      .prepare(
        'SELECT report_json AS reportJson FROM dcc_capability_reports WHERE project_id = ? AND tool = ?',
      )
      .get<{ reportJson: string }>(projectId, tool);
    const cached = cachedRow ? reportValidator.assert(JSON.parse(cachedRow.reportJson)) : undefined;
    const autoDetect = this.options.settings.resolve('dcc.autoDetectInstallations').value === true;
    if (!refresh && !autoDetect && cached) return cached;

    await this.refreshDetectedInstallations(tool);
    const adapter = this.requireAdapter(tool);
    const installations = this.readInstallations().filter(
      (installation) => installation.tool === tool,
    );
    const installation = adapter.selectInstallation('discover', installations);
    const support = adapter.hostSupport(
      process.platform,
      installation?.viaWslInterop ?? this.wsl.isWsl(),
    );
    const connectionId =
      bridgeOverride === undefined
        ? (cached?.layers['live-bridge'].connectionId ?? null)
        : bridgeOverride;
    const bridge = await this.probeLiveBridge(projectId, tool, connectionId);
    const checkedAt = this.now().toISOString();
    const capabilityContext = {
      projectId,
      projectPath: project.projectPath,
      tool,
      installation,
      installations,
      osSupport: support,
    };
    const operations = adapter.operations(capabilityContext).map((capability) => {
      if (!capability.requiresLiveBridge) return capability;
      const ready = bridge.status === 'ready' && bridge.toolCount > 0;
      return {
        ...capability,
        available: capability.available && ready,
        reason: ready ? null : bridge.detail,
      };
    });
    const headlessStatus =
      support.headless === 'unsupported'
        ? 'unsupported-os'
        : !installation
          ? 'unavailable'
          : support.headless === 'unverified'
            ? 'unverified'
            : 'ready';
    const report = reportValidator.assert({
      schemaVersion: 1,
      projectId,
      tool,
      generatedAt: checkedAt,
      installation,
      layers: {
        headless: {
          status: headlessStatus,
          detail:
            support.headless === 'unsupported'
              ? `${tool} headless operations are unsupported on ${support.os}.`
              : !installation
                ? `No ${tool} installation is available on ${support.os}.`
                : support.headless === 'unverified'
                  ? support.sourceNote
                  : `${tool} installation ${installation.version ?? installation.executable} is available.`,
          checkedAt,
        },
        'live-bridge': {
          status: bridge.status,
          detail: bridge.detail,
          checkedAt,
          connectionId: bridge.connection?.config.connectionId ?? connectionId,
          mcpRevision: bridge.mcpRevision,
        },
      },
      operations,
      osSupport: support,
    });
    this.saveReport(report);
    this.options.events.capabilitiesChanged(projectId, tool, report);
    return report;
  }

  async run(
    projectId: string,
    tool: DccTool,
    operation: DccOperation,
    params: Record<string, unknown> = {},
    taskId?: string,
    context: ToolCallContext = {},
  ): Promise<DccRun> {
    if (operation === 'run-script') this.assertScriptAllowed(projectId, params);
    const report = await this.capabilities(projectId, tool);
    if (report.osSupport.headless === 'unsupported') {
      throw new RpcError(
        `${tool} is unsupported on ${report.osSupport.os}.`,
        RpcErrorCode.DccToolUnsupportedOnHost,
      );
    }
    if (!report.installation) {
      throw new RpcError(
        `No ${tool} installation is available.`,
        RpcErrorCode.DccInstallationNotFound,
      );
    }
    const capability = report.operations.find((entry) => entry.operation === operation);
    if (!capability?.available) {
      throw new RpcError(
        capability?.reason ?? `DCC operation ${operation} is unavailable.`,
        RpcErrorCode.DccOperationUnavailable,
      );
    }
    const runId = uuidv7();
    const initial = runValidator.assert({
      schemaVersion: 1,
      runId,
      projectId,
      tool,
      operation,
      layer: capability.layer,
      status: 'running',
      startedAt: this.now().toISOString(),
      finishedAt: null,
      exitCode: null,
      command: [],
      artifacts: [],
      evidence: [],
      summary: `${tool} ${operation} is waiting for broker authorization.`,
      taskId: taskId ?? null,
    });
    this.saveRun(initial);
    this.options.events.runChanged(projectId, tool, initial);
    try {
      const call = await this.options.toolBroker.call(
        {
          projectId,
          toolId: `dcc/${operation}`,
          input: { tool, params, runId },
          ...(taskId ? { taskId } : {}),
        },
        context,
      );
      return runValidator.assert(call.output);
    } catch (error) {
      const current = this.getRun(projectId, runId);
      if (current.status === 'running') {
        const failed = runValidator.assert({
          ...current,
          status: 'failed',
          finishedAt: this.now().toISOString(),
          summary: errorMessage(error),
          evidence: [{ kind: 'broker', ref: `dcc/${operation}`, detail: errorMessage(error) }],
        });
        this.saveRun(failed);
        this.options.events.runChanged(projectId, tool, failed);
      }
      throw error;
    }
  }

  runs(projectId: string, tool?: DccTool, limit = 100): DccRun[] {
    const database = this.options.projectDatabases.get(projectId);
    const rows = tool
      ? database
          .prepare(
            'SELECT run_json AS runJson FROM dcc_runs WHERE project_id = ? AND tool = ? ORDER BY started_at DESC LIMIT ?',
          )
          .all<{ runJson: string }>(projectId, tool, clamp(limit, 1, 1000))
      : database
          .prepare(
            'SELECT run_json AS runJson FROM dcc_runs WHERE project_id = ? ORDER BY started_at DESC LIMIT ?',
          )
          .all<{ runJson: string }>(projectId, clamp(limit, 1, 1000));
    return rows.map((row) => runValidator.assert(JSON.parse(row.runJson)));
  }

  getRun(projectId: string, runId: string): DccRun {
    const row = this.options.projectDatabases
      .get(projectId)
      .prepare('SELECT run_json AS runJson FROM dcc_runs WHERE project_id = ? AND run_id = ?')
      .get<{ runJson: string }>(projectId, runId);
    if (!row) throw new RpcError(`DCC run not found: ${runId}`, RpcErrorCode.DccRunNotFound);
    return runValidator.assert(JSON.parse(row.runJson));
  }

  async setLiveBridge(
    projectId: string,
    tool: DccTool,
    connectionId: string | null,
  ): Promise<string | null> {
    if (connectionId !== null) {
      const connection = this.options.mcpConnections
        .list(projectId)
        .find((entry) => entry.config.connectionId === connectionId);
      if (!connection)
        throw new RpcError(
          `MCP connection not found: ${connectionId}`,
          RpcErrorCode.McpConnectionNotFound,
        );
      if (!(connection.config.tags ?? []).includes(`live-bridge:${tool}`)) {
        throw new RpcError(
          `MCP connection must be tagged live-bridge:${tool}.`,
          RpcErrorCode.InvalidParams,
        );
      }
    }
    await this.capabilities(projectId, tool, true, connectionId);
    return connectionId;
  }

  async onSettingChanged(event: RpcNotificationParams<'settings/changed'>): Promise<void> {
    if (!event.key.startsWith('dcc.')) return;
    await this.refreshReports();
  }

  async onMcpStateChanged(connectionId: string): Promise<void> {
    for (const project of this.options.projects.list()) {
      for (const tool of DCC_TOOLS) {
        const report = this.readReport(project.projectId, tool);
        if (report?.layers['live-bridge'].connectionId !== connectionId) continue;
        await this.capabilities(project.projectId, tool, true).catch(() => undefined);
      }
    }
  }

  private async executeOperation(
    tool: DccTool,
    brokerContext: ToolContext,
    operation: DccOperation,
    params: Record<string, unknown>,
    requestedRunId?: string,
  ): Promise<DccRun> {
    const runId = requestedRunId ?? uuidv7();
    const current = requestedRunId
      ? this.findRun(brokerContext.projectId, requestedRunId)
      : undefined;
    const report = await this.capabilities(brokerContext.projectId, tool, false);
    if (operation === 'run-script') this.assertScriptAllowed(brokerContext.projectId, params);
    const capability = report.operations.find((entry) => entry.operation === operation);
    if (!capability?.available) {
      throw new RpcError(
        capability?.reason ?? `${tool} ${operation} is unavailable.`,
        RpcErrorCode.DccOperationUnavailable,
      );
    }
    const project = this.requireProject(brokerContext.projectId);
    const adapter = this.requireAdapter(tool);
    const installation = report.installation;
    if (!installation)
      throw new RpcError(
        `${tool} installation was not found.`,
        RpcErrorCode.DccInstallationNotFound,
      );
    const runRelativePath = `.gamecrafter/dcc-runs/${runId}`;
    const runDirectory = resolveProjectPath(project.projectPath, runRelativePath);
    mkdirSync(runDirectory, { recursive: true });
    const logArtifacts = [
      { kind: 'log' as const, path: `.gamecrafter/dcc-runs/${runId}/stdout.log` },
      { kind: 'log' as const, path: `.gamecrafter/dcc-runs/${runId}/stderr.log` },
    ];
    for (const artifact of logArtifacts) {
      const filePath = path.join(project.projectPath, artifact.path);
      if (!existsSync(filePath)) writeFileSync(filePath, '');
    }
    const startedAt = current?.startedAt ?? this.now().toISOString();
    const initial = runValidator.assert(
      current
        ? { ...current, artifacts: mergeArtifacts([...current.artifacts, ...logArtifacts]) }
        : {
            schemaVersion: 1,
            runId,
            projectId: brokerContext.projectId,
            tool,
            operation,
            layer: capability.layer,
            status: 'running',
            startedAt,
            finishedAt: null,
            exitCode: null,
            command: [],
            artifacts: logArtifacts,
            evidence: [],
            summary: `${tool} ${operation} is running.`,
            taskId: brokerContext.taskId,
          },
    );
    this.saveRun(initial);
    this.options.events.runChanged(brokerContext.projectId, tool, initial);

    let outcome: DccOperationOutcome;
    try {
      const timeoutMs =
        Number(
          this.options.settings.resolve('dcc.operationTimeoutSeconds', {
            projectId: brokerContext.projectId,
          }).value,
        ) * 1000;
      const safeParams =
        operation === 'render-preview'
          ? {
              ...params,
              renderPreviewResolution: this.options.settings.resolve(
                'dcc.renderPreviewResolution',
                { projectId: brokerContext.projectId },
              ).value,
            }
          : params;
      const pathRedactions = [project.projectPath, runDirectory];
      if (installation.viaWslInterop) {
        for (const filePath of [project.projectPath, runDirectory]) {
          try {
            pathRedactions.push(await this.wsl.toHostPath(filePath));
          } catch {
            continue;
          }
        }
      }
      const execution = {
        projectId: brokerContext.projectId,
        projectPath: project.projectPath,
        tool,
        installation,
        runId,
        runDirectory,
        startedAt,
        timeoutMs,
        signal: brokerContext.signal,
        runProcess: async (command: string, args: string[], cwd = project.projectPath) => {
          const result = await runEngineProcess({
            command,
            args,
            cwd,
            projectPath: project.projectPath,
            runDirectory,
            artifactRoot: `.gamecrafter/dcc-runs/${runId}`,
            ...(installation.viaWslInterop ? { extraEnv: wslInteropEnvironment() } : {}),
            timeoutMs,
            signal: brokerContext.signal,
            redactCommand: (executable, commandArgs) =>
              redactDccCommand(executable, commandArgs, pathRedactions),
          });
          return installation.viaWslInterop
            ? translateProcessPaths(result, this.wsl, project.projectPath)
            : result;
        },
        resolveInput: (relativePath: string) =>
          requireExistingProjectPath(project.projectPath, relativePath),
        resolveOutput: (relativePath: string) =>
          resolveProjectPath(project.projectPath, relativePath),
        toHostPath: (filePath: string) =>
          installation.viaWslInterop ? this.wsl.toHostPath(filePath) : Promise.resolve(filePath),
        toWslPath: (filePath: string) =>
          installation.viaWslInterop ? this.wsl.toWslPath(filePath) : Promise.resolve(filePath),
        writeArtifact: (
          kind: EngineRunArtifact['kind'],
          fileName: string,
          content: string | Buffer,
        ) => {
          const safeName = path.basename(fileName);
          writeFileSync(path.join(runDirectory, safeName), content);
          return { kind, path: `.gamecrafter/dcc-runs/${runId}/${safeName}` };
        },
        redactCommand: (command: string, args: string[]) =>
          redactDccCommand(command, args, pathRedactions),
      };
      outcome = await adapter.run(operation, safeParams, execution);
    } catch (error) {
      outcome = {
        status: 'failed',
        exitCode: null,
        command: [],
        summary: errorMessage(error),
        evidence: [{ kind: 'error', ref: `dcc/${operation}`, detail: errorMessage(error) }],
        artifacts: [],
      };
    }
    const finished = runValidator.assert({
      ...initial,
      status: outcome.status,
      finishedAt: this.now().toISOString(),
      exitCode: outcome.exitCode,
      command: outcome.command,
      artifacts: mergeArtifacts([...initial.artifacts, ...outcome.artifacts]),
      evidence: outcome.evidence,
      summary: outcome.summary,
    });
    this.saveRun(finished);
    this.options.events.runChanged(brokerContext.projectId, tool, finished);
    return finished;
  }

  private async probeLiveBridge(
    projectId: string,
    tool: DccTool,
    connectionId: string | null,
  ): Promise<BoundMcpProbe> {
    const pluginNames: Record<DccTool, string> = {
      blender: 'blender-mcp or dcc-mcp-blender',
      maya: 'GG_MayaMCP or dcc-mcp-maya',
      '3dsmax': '3dsmax-mcp',
      cinema4d: 'mcp-cinema4d',
      zbrush: 'dcc-mcp-zbrush',
    };
    const communityNote = `${pluginNames[tool]} may be installed as a connector plugin/MCP connection; untested. DCC sessions cannot prove Project identity.`;
    if (!connectionId)
      return {
        connection: null,
        status: 'unverified',
        detail: `No live bridge is bound. ${communityNote}`,
        toolCount: 0,
        mcpRevision: null,
      };
    const connection =
      this.options.mcpConnections
        .list(projectId)
        .find((entry) => entry.config.connectionId === connectionId) ?? null;
    if (!connection)
      return {
        connection: null,
        status: 'unavailable',
        detail: `The bound ${tool} MCP connection is unavailable. ${communityNote}`,
        toolCount: 0,
        mcpRevision: null,
      };
    if (!(connection.config.tags ?? []).includes(`live-bridge:${tool}`)) {
      return {
        connection,
        status: 'unavailable',
        detail: `The MCP connection is not tagged live-bridge:${tool}. ${communityNote}`,
        toolCount: 0,
        mcpRevision: connection.state.negotiatedRevision,
      };
    }
    if (connection.state.status !== 'connected') {
      return {
        connection,
        status: 'unavailable',
        detail: `The ${tool} live bridge is ${connection.state.status}. ${communityNote}`,
        toolCount: 0,
        mcpRevision: connection.state.negotiatedRevision,
      };
    }
    try {
      const tools = await this.options.mcpConnections.tools(connectionId);
      const count = tools.tools.length;
      return {
        connection,
        status: count > 0 ? 'ready' : 'unavailable',
        detail:
          count > 0
            ? `Connected MCP session advertises ${count} tools. ${communityNote}`
            : `Connected MCP session has no tools. ${communityNote}`,
        toolCount: count,
        mcpRevision: connection.state.negotiatedRevision,
      };
    } catch (error) {
      return {
        connection,
        status: 'unavailable',
        detail: `Could not list live bridge tools: ${errorMessage(error)}. ${communityNote}`,
        toolCount: 0,
        mcpRevision: connection.state.negotiatedRevision,
      };
    }
  }

  private async refreshDetectedInstallations(tool?: DccTool): Promise<void> {
    if (this.options.settings.resolve('dcc.autoDetectInstallations').value !== true) return;
    if (this.detecting) return this.detecting;
    this.detecting = this.detectInstallations(tool).finally(() => {
      this.detecting = undefined;
    });
    return this.detecting;
  }

  private async detectInstallations(tool?: DccTool): Promise<void> {
    const searchPaths = this.options.settings.resolve('dcc.searchPaths').value;
    const environment = {
      ...this.environment(),
      GAMECRAFTER_DCC_SEARCH_PATHS: JSON.stringify(searchPaths),
    };
    for (const adapter of this.adapters.values()) {
      if (tool && adapter.tool !== tool) continue;
      const detected = await adapter.detectInstallations(environment);
      const previous = this.options.database
        .prepare(
          'SELECT installation_id AS installationId, executable, kind, version FROM dcc_installations WHERE tool = ? AND source = ?',
        )
        .all<{
          installationId: string;
          executable: string;
          kind: DccInstallation['kind'];
          version: string | null;
        }>(adapter.tool, 'detected');
      const byKey = new Map(
        previous.map((row) => [`${row.executable.toLowerCase()}\0${row.kind}`, row]),
      );
      const detectedKeys = new Set<string>();
      for (const candidate of detected) {
        const key = `${candidate.executable.toLowerCase()}\0${candidate.kind}`;
        detectedKeys.add(key);
        const old = byKey.get(key);
        const installation = installationValidator.assert({
          ...candidate,
          installationId: old?.installationId ?? candidate.installationId,
          version: await adapter.probeVersion(candidate),
        });
        this.saveInstallation(installation);
      }
      for (const old of previous) {
        if (detectedKeys.has(`${old.executable.toLowerCase()}\0${old.kind}`)) continue;
        this.options.database
          .prepare('DELETE FROM dcc_installations WHERE installation_id = ?')
          .run(old.installationId);
      }
    }
  }

  private readInstallations(): DccInstallation[] {
    return this.options.database
      .prepare(
        'SELECT installation_json AS installationJson FROM dcc_installations ORDER BY tool, version, executable',
      )
      .all<{ installationJson: string }>()
      .map((row) => installationValidator.assert(JSON.parse(row.installationJson)));
  }

  private saveInstallation(installation: DccInstallation): void {
    this.options.database
      .prepare(
        `INSERT INTO dcc_installations
       (installation_id, tool, executable, kind, host_os, via_wsl_interop, version, source, detected_at, installation_json)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(installation_id) DO UPDATE SET executable = excluded.executable, kind = excluded.kind,
       host_os = excluded.host_os, via_wsl_interop = excluded.via_wsl_interop, version = excluded.version,
       source = excluded.source, detected_at = excluded.detected_at, installation_json = excluded.installation_json`,
      )
      .run(
        installation.installationId,
        installation.tool,
        installation.executable,
        installation.kind,
        installation.hostOs,
        installation.viaWslInterop ? 1 : 0,
        installation.version,
        installation.source,
        installation.detectedAt,
        JSON.stringify(installation),
      );
  }

  private readReport(projectId: string, tool: DccTool): DccCapabilityReport | undefined {
    const row = this.options.projectDatabases
      .get(projectId)
      .prepare(
        'SELECT report_json AS reportJson FROM dcc_capability_reports WHERE project_id = ? AND tool = ?',
      )
      .get<{ reportJson: string }>(projectId, tool);
    return row ? reportValidator.assert(JSON.parse(row.reportJson)) : undefined;
  }

  private saveReport(report: DccCapabilityReport): void {
    this.options.projectDatabases
      .get(report.projectId)
      .prepare(
        `INSERT INTO dcc_capability_reports(project_id, tool, generated_at, report_json) VALUES (?, ?, ?, ?)
       ON CONFLICT(project_id, tool) DO UPDATE SET generated_at = excluded.generated_at, report_json = excluded.report_json`,
      )
      .run(report.projectId, report.tool, report.generatedAt, JSON.stringify(report));
  }

  private saveRun(run: DccRun): void {
    this.options.projectDatabases
      .get(run.projectId)
      .prepare(
        `INSERT INTO dcc_runs(run_id, project_id, tool, operation, status, started_at, run_json)
       VALUES (?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(run_id) DO UPDATE SET status = excluded.status, run_json = excluded.run_json`,
      )
      .run(
        run.runId,
        run.projectId,
        run.tool,
        run.operation,
        run.status,
        run.startedAt,
        JSON.stringify(run),
      );
  }

  private async refreshReports(tool?: DccTool): Promise<void> {
    for (const project of this.options.projects.list()) {
      for (const currentTool of tool ? [tool] : DCC_TOOLS) {
        await this.capabilities(project.projectId, currentTool, true).catch(() => undefined);
      }
    }
  }

  private assertScriptAllowed(projectId: string, params: Record<string, unknown>): void {
    if (this.options.settings.resolve('dcc.allowUnrestrictedScripts', { projectId }).value === true)
      return;
    const script = typeof params.script === 'string' ? params.script : '';
    if (scriptRiskPattern.test(script)) {
      throw new RpcError(
        'DCC scripts containing subprocess, os.system, or shutil.rmtree are rejected unless dcc.allowUnrestrictedScripts is enabled.',
        RpcErrorCode.DccScriptRejected,
      );
    }
  }

  private requireProject(projectId: string): DccProjectContext {
    const project = this.options.projects.getById(projectId);
    if (!project)
      throw new RpcError(`Project not found: ${projectId}`, RpcErrorCode.ProjectNotFound);
    return { projectId, projectPath: project.path };
  }

  private requireAdapter(tool: DccTool): DccAdapter {
    const adapter = this.adapters.get(tool);
    if (!adapter)
      throw new RpcError(
        `No DCC adapter registered for ${tool}.`,
        RpcErrorCode.DccToolUnsupportedOnHost,
      );
    return adapter;
  }

  private executableExists(executable: string): boolean {
    if (
      this.wsl.isWsl() &&
      executable.startsWith('/mnt/') &&
      executable.toLowerCase().endsWith('.exe')
    ) {
      try {
        return statSync(executable).isFile();
      } catch {
        return false;
      }
    }
    return isExecutable(executable);
  }

  private findRun(projectId: string, runId: string): DccRun | undefined {
    const row = this.options.projectDatabases
      .get(projectId)
      .prepare('SELECT run_json AS runJson FROM dcc_runs WHERE project_id = ? AND run_id = ?')
      .get<{ runJson: string }>(projectId, runId);
    return row ? runValidator.assert(JSON.parse(row.runJson)) : undefined;
  }
}

async function translateProcessPaths<
  T extends { stdout: string; stderr: string; artifacts: Array<{ kind?: string; path: string }> },
>(result: T, interop: WslInterop, projectPath: string): Promise<T> {
  const translate = async (value: string) => {
    const candidates = [...new Set(value.match(/[A-Za-z]:\\[^\r\n"']+/g) ?? [])];
    let translated = value;
    for (const candidate of candidates) {
      try {
        translated = translated.replaceAll(candidate, await interop.toWslPath(candidate));
      } catch {
        continue;
      }
    }
    return translated;
  };
  const stdout = await translate(result.stdout);
  const stderr = await translate(result.stderr);
  for (const artifact of result.artifacts) {
    if (artifact.kind !== 'log') continue;
    const logPath = path.join(projectPath, artifact.path);
    try {
      if (statSync(logPath).size > 20 * 1024 * 1024) continue;
      const original = readFileSync(logPath, 'utf8');
      const translated = await translate(original);
      if (translated !== original) writeFileSync(logPath, translated, 'utf8');
    } catch {
      continue;
    }
  }
  return { ...result, stdout, stderr };
}

function redactDccCommand(command: string, args: string[], paths: string[]): string[] {
  const redact = (value: string) =>
    paths.reduce((result, target, index) => {
      const replacement = index % 2 === 0 ? '<project>' : '<run>';
      const escapedTarget = target.replaceAll('\\', '\\\\');
      return result.replaceAll(target, replacement).replaceAll(escapedTarget, replacement);
    }, value);
  return [redact(command), ...args.map(redact)];
}

function mergeArtifacts<T extends { kind: string; path: string }>(artifacts: T[]): T[] {
  const seen = new Set<string>();
  return artifacts.filter((artifact) => {
    const key = `${artifact.kind}\0${artifact.path}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function clamp(value: number, min: number, max: number): number {
  return Number.isFinite(value) ? Math.max(min, Math.min(max, Math.trunc(value))) : min;
}

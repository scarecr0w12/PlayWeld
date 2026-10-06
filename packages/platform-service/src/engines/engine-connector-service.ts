import {
  existsSync,
  mkdirSync,
  readFileSync,
  realpathSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import path from 'node:path';
import {
  EngineCapabilityReportSchema,
  EngineOperationRunSchema,
  PROJECT_MANIFEST_FILENAME,
  ProjectManifestSchema,
  RpcError,
  RpcErrorCode,
  compile,
  uuidv7,
  type EngineCapabilityReport,
  type EngineFamily,
  type EngineInstallation,
  type EngineOperation,
  type EngineOperationCapability,
  type EngineOperationRun,
  type McpConnectionListEntry,
  type ProjectManifest,
  type RpcNotificationParams,
  type ToolDefinition,
} from '@gamecrafter/contracts';
import type { Database } from '../db/database';
import type { McpConnectionManager } from '../mcp/connection-manager';
import type { ProfileStore } from '../profile/profile-store';
import type { ProjectDatabases } from '../projects/project-databases';
import type { SettingsService } from '../settings/settings-service';
import type { ToolBroker } from '../tools/tool-broker';
import type { ToolContext, ToolRegistry } from '../tools/tool-registry';
import type { BoardService } from '../board/board-service';
import { GodotConnector } from './godot/godot-connector';
import { UnityConnector } from './unity/unity-connector';
import { UnrealConnector } from './unreal/unreal-connector';
import { runEngineProcess } from './process-runner';
import { registerEngineTools } from './engine-tools';
import { registerUnrealEditorBridgeTools } from './unreal/editor-bridge-tools';
import { buildUnrealEditorBridge } from './unreal/editor-bridge-build';
import type {
  EngineCapabilityContext,
  EngineConnector,
  EngineExecutionContext,
  EngineOperationOutcome,
  EngineProjectIdentity,
} from './types';
import { isExecutable, prefixVersionMatch } from './utils';

const manifestValidator = compile<ProjectManifest>(ProjectManifestSchema);
const reportValidator = compile<EngineCapabilityReport>(EngineCapabilityReportSchema);
const runValidator = compile<EngineOperationRun>(EngineOperationRunSchema);

export interface EngineConnectorServiceEvents {
  capabilitiesChanged(projectId: string, report: EngineCapabilityReport): void;
  runChanged(projectId: string, run: EngineOperationRun): void;
}

export interface EngineConnectorServiceOptions {
  database: Database;
  projects: ProfileStore;
  projectDatabases: ProjectDatabases;
  settings: SettingsService;
  toolRegistry: ToolRegistry;
  toolBroker: ToolBroker;
  mcpConnections: McpConnectionManager;
  board: BoardService;
  events: EngineConnectorServiceEvents;
  connectors?: EngineConnector[];
  now?: () => Date;
}

interface ProjectContext {
  projectId: string;
  projectPath: string;
  gamePath: string;
  manifest: ProjectManifest;
  family: EngineFamily;
  connector: EngineConnector;
}

interface LiveBridgeProbe {
  entry: McpConnectionListEntry | null;
  identityProven: boolean;
  detail: string;
  tools: ToolDefinition[];
}

export class EngineConnectorService {
  private readonly connectors: Map<EngineFamily, EngineConnector>;
  private readonly now: () => Date;
  private detecting?: Promise<void>;

  constructor(private readonly options: EngineConnectorServiceOptions) {
    this.now = options.now ?? (() => new Date());
    const connectors = options.connectors ?? [
      new GodotConnector(),
      new UnityConnector(),
      new UnrealConnector(),
    ];
    this.connectors = new Map(connectors.map((connector) => [connector.family, connector]));
    registerEngineTools(options.toolRegistry, (operation, context, params, runId) =>
      this.executeOperation(context, operation, params, runId),
    );
    registerUnrealEditorBridgeTools({
      registry: options.toolRegistry,
      mcp: options.mcpConnections,
      bind: (projectId, connectionId) => this.setLiveBridge(projectId, connectionId),
      family: (projectId) => this.projectContext(projectId).family,
      build: async (context, projectFile) => {
        const installations = await this.installations('unreal');
        const association = (
          JSON.parse(readFileSync(projectFile, 'utf8')) as { EngineAssociation?: unknown }
        ).EngineAssociation;
        const preferred =
          this.projectContext(context.projectId).manifest.engine.preferredVersion ??
          (typeof association === 'string' && /^\d+\.\d+(?:\.\d+)?$/.test(association)
            ? association
            : null);
        const candidates = installations.filter(
          (installation) =>
            installation.kind === 'uat' &&
            (!preferred ||
              installation.version === preferred ||
              installation.version?.startsWith(preferred + '.')),
        );
        if (new Set(candidates.map((installation) => installation.version)).size > 1)
          throw new RpcError(
            'Set the Project preferred Unreal version before choosing between different registered engines.',
            RpcErrorCode.EngineInstallationNotFound,
          );
        const uat = candidates[0];
        if (!uat)
          throw new RpcError(
            'Register RunUAT.bat in Engine installations before compiling the editor plugin.',
            RpcErrorCode.EngineInstallationNotFound,
          );
        return buildUnrealEditorBridge(context, projectFile, uat);
      },
      verify: async (projectId, connectionId, projectFile) => {
        const catalog = await options.mcpConnections.tools(connectionId);
        const identity = catalog.tools.find((tool) => tool.toolId.endsWith('/get_project_context'));
        if (!identity || identity.sideEffects !== 'none')
          throw new RpcError(
            'First-party editor identity probe unavailable.',
            RpcErrorCode.McpConnectFailed,
          );
        const record = await options.toolBroker.call({
          projectId,
          toolId: identity.toolId,
          input: {},
        });
        const result = parseIdentityResult(record.output);
        if (
          record.status !== 'completed' ||
          !result?.projectPath ||
          !sameNativePath(result.projectPath, projectFile)
        )
          throw new RpcError(
            'Running editor does not prove the selected Unreal Project file.',
            RpcErrorCode.ToolDenied,
          );
      },
    });
  }

  async installations(family?: EngineFamily): Promise<EngineInstallation[]> {
    await this.refreshDetectedInstallations();
    return this.readInstallations().filter(
      (installation) => !family || installation.family === family,
    );
  }

  async addInstallation(input: {
    family: EngineFamily;
    executable: string;
    kind: EngineInstallation['kind'];
  }): Promise<EngineInstallation> {
    const connector = this.requireConnector(input.family);
    if (!path.isAbsolute(input.executable) || !isExecutable(input.executable)) {
      throw new RpcError(
        'Engine executable must be an absolute executable file.',
        RpcErrorCode.InvalidParams,
      );
    }
    const installation: EngineInstallation = {
      installationId: uuidv7(),
      family: input.family,
      version: null,
      executable: path.resolve(input.executable),
      kind: input.kind,
      source: 'manual',
      detectedAt: this.now().toISOString(),
    };
    const stored = { ...installation, version: await connector.probeVersion(installation) };
    this.saveInstallation(stored);
    this.invalidateCapabilityReports();
    return stored;
  }

  removeInstallation(installationId: string): void {
    const existing = this.options.database
      .prepare('SELECT installation_id FROM engine_installations WHERE installation_id = ?')
      .get<{ installation_id: string }>(installationId);
    if (!existing) {
      throw new RpcError(
        `Engine installation not found: ${installationId}`,
        RpcErrorCode.EngineInstallationNotFound,
      );
    }
    this.options.database
      .prepare('DELETE FROM engine_installations WHERE installation_id = ?')
      .run(installationId);
    this.invalidateCapabilityReports();
  }

  async capabilities(projectId: string, refresh = false): Promise<EngineCapabilityReport> {
    this.requireProject(projectId);
    const database = this.options.projectDatabases.get(projectId);
    if (!refresh) {
      const cached = database
        .prepare(
          'SELECT report_json AS reportJson FROM engine_capability_reports WHERE project_id = ?',
        )
        .get<{ reportJson: string }>(projectId);
      if (cached) return reportValidator.assert(JSON.parse(cached.reportJson));
    }
    await this.refreshDetectedInstallations();

    const context = this.projectContext(projectId);
    const connector = context.connector;
    const installations = this.readInstallations().filter(
      (installation) => installation.family === context.family,
    );
    const selected = connector.selectInstallation('check', installations);
    const identity = await connector.proveIdentity(context.gamePath);
    const bridge = await this.probeLiveBridge(projectId, context.projectPath, identity);
    const headlessDetails = [
      !identity.proven ? 'Project identity is unproven.' : null,
      selected
        ? `${context.family} installation ${selected.version ?? selected.executable} is available.`
        : `No ${context.family} installation is available.`,
    ]
      .filter((detail): detail is string => detail !== null)
      .join(' ');
    const baseContext: EngineCapabilityContext = {
      ...context,
      installation: selected,
      installations,
      identity,
    };
    const operations = connector
      .operations(baseContext)
      .map((operation) => this.withLiveBridgeCapability(operation, bridge));
    const preferred = context.manifest.engine.preferredVersion ?? null;
    // The Unity CLI reports its own tool version, not the editor it will launch.
    const detected =
      context.family === 'unity' && selected?.kind === 'cli' ? null : (selected?.version ?? null);
    const matches = prefixVersionMatch(detected, preferred);
    const checkedAt = this.now().toISOString();
    const report: EngineCapabilityReport = {
      schemaVersion: 1,
      projectId,
      family: context.family,
      generatedAt: checkedAt,
      projectIdentity: identity,
      layers: {
        'project-file': {
          status: identity.proven ? 'ready' : 'unavailable',
          detail: identity.proven
            ? 'Engine project identity was proven from project files.'
            : 'Engine project identity could not be proven from project files.',
          checkedAt,
        },
        'headless-process': {
          status: !identity.proven ? 'unavailable' : selected ? 'ready' : 'unavailable',
          detail: headlessDetails,
          checkedAt,
        },
        'live-editor': {
          status: !bridge.entry
            ? 'unverified'
            : bridge.entry.state.status !== 'connected'
              ? 'unavailable'
              : bridge.identityProven
                ? 'ready'
                : 'unavailable',
          detail: !bridge.entry
            ? 'No live editor bridge is bound.'
            : bridge.entry.state.status !== 'connected'
              ? `Live editor bridge is ${bridge.entry.state.status}.`
              : bridge.detail,
          checkedAt,
        },
      },
      engineVersion: { detected, preferred, matches },
      operations,
      liveBridge:
        bridge.entry?.state.status === 'connected' &&
        bridge.entry.state.negotiatedRevision &&
        bridge.entry.state.serverInfo
          ? {
              connectionId: bridge.entry.config.connectionId,
              negotiatedRevision: bridge.entry.state.negotiatedRevision,
              serverInfo: bridge.entry.state.serverInfo,
              toolCount: bridge.entry.state.toolCount,
            }
          : null,
    };
    reportValidator.assert(report);
    const previousRow = database
      .prepare(
        'SELECT report_json AS reportJson FROM engine_capability_reports WHERE project_id = ?',
      )
      .get<{ reportJson: string }>(projectId);
    this.saveReport(report);
    this.options.events.capabilitiesChanged(projectId, report);
    if (this.versionMismatchChanged(previousRow?.reportJson, report)) {
      await this.postVersionMismatch(report).catch(() => undefined);
    }
    return report;
  }

  async run(
    projectId: string,
    operation: EngineOperation,
    params: Record<string, unknown> = {},
    taskId?: string,
  ): Promise<EngineOperationRun> {
    const project = this.projectContext(projectId);
    if (typeof params.family === 'string' && params.family !== project.family) {
      throw new RpcError(
        `Engine family mismatch: Project uses ${project.family}, requested ${params.family}.`,
        RpcErrorCode.EngineFamilyMismatch,
      );
    }
    const report = await this.capabilities(projectId);
    if (!report.projectIdentity.proven && operation !== 'discover' && operation !== 'inspect') {
      throw new RpcError(
        'Engine Project identity is unproven.',
        RpcErrorCode.EngineProjectIdentityUnproven,
      );
    }
    const capability = report.operations.find((entry) => entry.operation === operation);
    if (!capability?.available) {
      throw new RpcError(
        capability?.reason ?? `Engine operation ${operation} is unavailable.`,
        RpcErrorCode.EngineOperationUnavailable,
      );
    }
    const runId = uuidv7();
    const initial: EngineOperationRun = {
      runId,
      projectId,
      family: project.family,
      operation,
      executionMode: capability.executionMode,
      status: 'running',
      startedAt: this.now().toISOString(),
      finishedAt: null,
      exitCode: null,
      command: [],
      artifacts: [],
      evidence: [],
      summary: `${project.family} ${operation} is waiting for broker authorization.`,
      taskId: taskId ?? null,
    };
    this.saveRun(initial);
    this.options.events.runChanged(projectId, initial);
    try {
      const call = await this.options.toolBroker.call({
        projectId,
        toolId: `engine/${operation}`,
        input: { params, runId },
        ...(taskId ? { taskId } : {}),
      });
      return runValidator.assert(call.output);
    } catch (error) {
      const current = this.getRun(projectId, runId);
      if (current.status === 'running') {
        const failed: EngineOperationRun = {
          ...current,
          status: 'failed',
          finishedAt: this.now().toISOString(),
          summary: errorMessage(error),
          evidence: [{ kind: 'broker', ref: `engine/${operation}`, detail: errorMessage(error) }],
        };
        this.saveRun(failed);
        this.options.events.runChanged(projectId, failed);
      }
      throw error;
    }
  }

  runs(projectId: string, limit = 100): EngineOperationRun[] {
    const database = this.options.projectDatabases.get(projectId);
    return database
      .prepare(
        'SELECT run_json AS runJson FROM engine_runs WHERE project_id = ? ORDER BY started_at DESC LIMIT ?',
      )
      .all<{ runJson: string }>(projectId, clamp(limit, 1, 1000))
      .map((row) => runValidator.assert(JSON.parse(row.runJson)));
  }

  getRun(projectId: string, runId: string): EngineOperationRun {
    const run = this.findRun(projectId, runId);
    if (!run) throw new RpcError(`Engine run not found: ${runId}`, RpcErrorCode.EngineRunFailed);
    return run;
  }

  private findRun(projectId: string, runId: string): EngineOperationRun | undefined {
    const row = this.options.projectDatabases
      .get(projectId)
      .prepare('SELECT run_json AS runJson FROM engine_runs WHERE project_id = ? AND run_id = ?')
      .get<{ runJson: string }>(projectId, runId);
    return row ? runValidator.assert(JSON.parse(row.runJson)) : undefined;
  }

  async setLiveBridge(projectId: string, connectionId: string | null): Promise<string | null> {
    const database = this.options.projectDatabases.get(projectId);
    if (connectionId === null) {
      database.prepare('DELETE FROM engine_live_bridges WHERE project_id = ?').run(projectId);
    } else {
      const connection = this.options.mcpConnections
        .list(projectId)
        .find((entry) => entry.config.connectionId === connectionId);
      if (!connection) {
        throw new RpcError(
          `MCP connection not found: ${connectionId}`,
          RpcErrorCode.McpConnectionNotFound,
        );
      }
      if (!(connection.config.tags ?? []).includes('live-editor')) {
        throw new RpcError(
          'Only MCP connections tagged live-editor can be bound as an engine bridge.',
          RpcErrorCode.InvalidParams,
        );
      }
      database
        .prepare(
          `INSERT INTO engine_live_bridges(project_id, connection_id, updated_at) VALUES (?, ?, ?)
         ON CONFLICT(project_id) DO UPDATE SET connection_id = excluded.connection_id, updated_at = excluded.updated_at`,
        )
        .run(projectId, connectionId, this.now().toISOString());
    }
    database.prepare('DELETE FROM engine_capability_reports WHERE project_id = ?').run(projectId);
    await this.capabilities(projectId, true);
    return connectionId;
  }

  onSettingChanged(event: RpcNotificationParams<'settings/changed'>): void {
    if (!event.key.startsWith('engine.')) return;
    this.invalidateCapabilityReports();
    for (const project of this.options.projects.list()) {
      void this.capabilities(project.projectId, true).catch(() => undefined);
    }
  }

  async onMcpStateChanged(connectionId: string): Promise<void> {
    for (const project of this.options.projects.list()) {
      const database = this.options.projectDatabases.get(project.projectId);
      const binding = database
        .prepare(
          'SELECT connection_id AS connectionId FROM engine_live_bridges WHERE project_id = ?',
        )
        .get<{ connectionId: string }>(project.projectId);
      if (binding?.connectionId !== connectionId) continue;
      database
        .prepare('DELETE FROM engine_capability_reports WHERE project_id = ?')
        .run(project.projectId);
      await this.capabilities(project.projectId, true).catch(() => undefined);
    }
  }

  private async executeOperation(
    context: ToolContext,
    operation: EngineOperation,
    params: Record<string, unknown>,
    requestedRunId?: string,
  ): Promise<EngineOperationRun> {
    const project = this.projectContext(context.projectId);
    if (typeof params.family === 'string' && params.family !== project.family) {
      throw new RpcError(
        `Engine family mismatch: Project uses ${project.family}, requested ${params.family}.`,
        RpcErrorCode.EngineFamilyMismatch,
      );
    }
    const report = await this.capabilities(context.projectId, false);
    if (!report.projectIdentity.proven && operation !== 'discover' && operation !== 'inspect') {
      throw new RpcError(
        'Engine Project identity is unproven.',
        RpcErrorCode.EngineProjectIdentityUnproven,
      );
    }
    const capability = report.operations.find((entry) => entry.operation === operation);
    if (!capability?.available) {
      throw new RpcError(
        capability?.reason ?? `Engine operation ${operation} is unavailable.`,
        RpcErrorCode.EngineOperationUnavailable,
      );
    }
    const existing = requestedRunId ? this.findRun(context.projectId, requestedRunId) : undefined;
    const startedAt = existing?.startedAt ?? this.now().toISOString();
    const runId = requestedRunId ?? uuidv7();
    const runDirectory = path.join(project.projectPath, '.gamecrafter', 'engine-runs', runId);
    mkdirSync(runDirectory, { recursive: true });
    const logArtifacts: EngineOperationRun['artifacts'] = [
      { kind: 'log', path: `.gamecrafter/engine-runs/${runId}/stdout.log` },
      { kind: 'log', path: `.gamecrafter/engine-runs/${runId}/stderr.log` },
    ];
    for (const artifact of logArtifacts) {
      const filePath = path.join(project.projectPath, artifact.path);
      if (!existsSync(filePath)) writeFileSync(filePath, '');
    }
    const initial: EngineOperationRun = existing
      ? { ...existing, artifacts: mergeArtifacts([...existing.artifacts, ...logArtifacts]) }
      : {
          runId,
          projectId: context.projectId,
          family: project.family,
          operation,
          executionMode: capability.executionMode,
          status: 'running',
          startedAt,
          finishedAt: null,
          exitCode: null,
          command: [],
          artifacts: logArtifacts,
          evidence: [],
          summary: `${project.family} ${operation} is running.`,

          taskId: context.taskId,
        };
    this.saveRun(initial);
    this.options.events.runChanged(context.projectId, initial);

    let outcome: EngineOperationOutcome;
    try {
      if (capability.executionMode === 'live-editor') {
        outcome = await this.runLiveOperation(
          context,
          operation,
          params,
          project,
          runDirectory,
          report,
        );
      } else {
        const installation = project.connector.selectInstallation(
          operation,
          this.readInstallations().filter((entry) => entry.family === project.family),
        );
        if (!installation && capability.via === 'cli') {
          throw new RpcError(
            `No ${project.family} installation is available.`,
            RpcErrorCode.EngineInstallationNotFound,
          );
        }
        const timeout =
          Number(
            this.options.settings.resolve('engine.operationTimeoutSeconds', {
              projectId: context.projectId,
            }).value,
          ) * 1000;
        const execution: EngineExecutionContext = {
          projectId: context.projectId,
          family: project.family,
          projectPath: project.projectPath,
          gamePath: project.gamePath,
          manifest: project.manifest,
          installation,
          runId,
          runDirectory,
          startedAt,
          timeoutMs: timeout,
          signal: context.signal,
          runProcess: (command, args, cwd = project.gamePath) =>
            runEngineProcess({
              command,
              args,
              cwd,
              projectPath: project.projectPath,
              runDirectory,
              timeoutMs: timeout,
              signal: context.signal,
              redactCommand: (executable, commandArgs) =>
                redactCommand(
                  executable,
                  commandArgs,
                  project.projectPath,
                  project.gamePath,
                  runDirectory,
                ),
            }),
          writeArtifact: (kind, fileName, content) => {
            const safeName = path.basename(fileName);
            writeFileSync(path.join(runDirectory, safeName), content);
            return { kind, path: `.gamecrafter/engine-runs/${runId}/${safeName}` };
          },
          redactCommand: (command, args) =>
            redactCommand(command, args, project.projectPath, project.gamePath, runDirectory),
        };
        outcome = await project.connector.run(operation, params, execution);
      }
    } catch (error) {
      outcome = {
        status: 'failed',
        exitCode: null,
        command: [],
        summary: error instanceof Error ? error.message : String(error),
        evidence: [
          {
            kind: 'error',
            ref: 'engine-operation',
            detail: error instanceof Error ? error.message : String(error),
          },
        ],
        artifacts: [],
      };
    }

    const finished: EngineOperationRun = {
      ...initial,
      status: outcome.status,
      finishedAt: this.now().toISOString(),
      exitCode: outcome.exitCode,
      command: outcome.command,
      artifacts: mergeArtifacts([...initial.artifacts, ...outcome.artifacts]),
      evidence: outcome.evidence,
      summary: outcome.summary,
    };
    this.saveRun(finished);
    this.options.events.runChanged(context.projectId, finished);
    return finished;
  }

  private requireProject(projectId: string) {
    const project = this.options.projects.getById(projectId);
    if (!project)
      throw new RpcError(`Project not found: ${projectId}`, RpcErrorCode.ProjectNotFound);
    return project;
  }

  private projectContext(projectId: string): ProjectContext {
    const project = this.requireProject(projectId);
    const manifest = manifestValidator.assert(
      JSON.parse(readFileSync(path.join(project.path, PROJECT_MANIFEST_FILENAME), 'utf8')),
    );
    const connector = this.requireConnector(manifest.engine.family);
    return {
      projectId,
      projectPath: project.path,
      gamePath: path.join(project.path, 'game'),
      manifest,
      family: manifest.engine.family,
      connector,
    };
  }

  private requireConnector(family: EngineFamily): EngineConnector {
    const connector = this.connectors.get(family);
    if (!connector)
      throw new RpcError(
        `No connector registered for ${family}.`,
        RpcErrorCode.EngineFamilyMismatch,
      );
    return connector;
  }

  private readInstallations(): EngineInstallation[] {
    return this.options.database
      .prepare(
        `SELECT installation_id AS installationId, family, version, executable, kind, source, detected_at AS detectedAt
         FROM engine_installations ORDER BY family, version, executable`,
      )
      .all<EngineInstallation>();
  }

  private async refreshDetectedInstallations(): Promise<void> {
    if (this.options.settings.resolve('engine.autoDetectInstallations').value !== true) return;
    if (this.detecting) return this.detecting;
    this.detecting = this.detectInstallations().finally(() => {
      this.detecting = undefined;
    });
    return this.detecting;
  }

  private async detectInstallations(): Promise<void> {
    let changed = false;
    for (const connector of this.connectors.values()) {
      const detected = await connector.detectInstallations(process.env);
      const previous = this.options.database
        .prepare(
          'SELECT installation_id AS installationId, executable, kind, version FROM engine_installations WHERE family = ? AND source = ?',
        )
        .all<{
          installationId: string;
          executable: string;
          kind: EngineInstallation['kind'];
          version: string | null;
        }>(connector.family, 'detected');
      const byKey = new Map(previous.map((row) => [`${row.executable}\0${row.kind}`, row]));
      const detectedKeys = new Set<string>();
      for (const candidate of detected) {
        const key = `${candidate.executable}\0${candidate.kind}`;
        detectedKeys.add(key);
        const existing = byKey.get(key);
        const record = {
          ...candidate,
          installationId: existing?.installationId ?? candidate.installationId,
        };
        this.saveInstallation(record);
        if (!existing || record.version !== existing.version) changed = true;
      }
      for (const row of previous) {
        if (detectedKeys.has(`${row.executable}\0${row.kind}`)) continue;
        this.options.database
          .prepare('DELETE FROM engine_installations WHERE installation_id = ?')
          .run(row.installationId);
        changed = true;
      }
    }
    if (changed) this.invalidateCapabilityReports();
  }

  private saveInstallation(installation: EngineInstallation): void {
    this.options.database
      .prepare(
        `INSERT INTO engine_installations
        (installation_id, family, version, executable, kind, source, detected_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(installation_id) DO UPDATE SET
         version = excluded.version,
         executable = excluded.executable,
         kind = excluded.kind,
         source = excluded.source,
         detected_at = excluded.detected_at`,
      )
      .run(
        installation.installationId,
        installation.family,
        installation.version,
        installation.executable,
        installation.kind,
        installation.source,
        installation.detectedAt,
      );
  }

  private invalidateCapabilityReports(): void {
    for (const project of this.options.projects.list()) {
      try {
        this.options.projectDatabases
          .get(project.projectId)
          .prepare('DELETE FROM engine_capability_reports WHERE project_id = ?')
          .run(project.projectId);
      } catch {
        continue;
      }
    }
  }

  private saveReport(report: EngineCapabilityReport): void {
    this.options.projectDatabases
      .get(report.projectId)
      .prepare(
        `INSERT INTO engine_capability_reports(project_id, report_json, generated_at) VALUES (?, ?, ?)
       ON CONFLICT(project_id) DO UPDATE SET report_json = excluded.report_json, generated_at = excluded.generated_at`,
      )
      .run(report.projectId, JSON.stringify(report), report.generatedAt);
  }

  private saveRun(run: EngineOperationRun): void {
    const database = this.options.projectDatabases.get(run.projectId);
    database
      .prepare(
        `INSERT INTO engine_runs(run_id, project_id, family, operation, status, started_at, run_json)
       VALUES (?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(run_id) DO UPDATE SET status = excluded.status, run_json = excluded.run_json`,
      )
      .run(
        run.runId,
        run.projectId,
        run.family,
        run.operation,
        run.status,
        run.startedAt,
        JSON.stringify(run),
      );
  }

  private versionMismatchChanged(
    previousJson: string | undefined,
    report: EngineCapabilityReport,
  ): boolean {
    if (report.engineVersion.matches !== false) return false;
    if (
      this.options.settings.resolve('engine.postVersionMismatchToBoard', {
        projectId: report.projectId,
      }).value !== true
    )
      return false;
    if (!previousJson) return true;
    try {
      const previous = reportValidator.assert(JSON.parse(previousJson));
      return (
        previous.engineVersion.detected !== report.engineVersion.detected ||
        previous.engineVersion.preferred !== report.engineVersion.preferred ||
        previous.engineVersion.matches !== false
      );
    } catch {
      return true;
    }
  }

  private async postVersionMismatch(report: EngineCapabilityReport): Promise<void> {
    const title = 'Engine';
    const body = `Engine version mismatch: Project prefers ${report.engineVersion.preferred ?? 'no version'}, detected ${report.engineVersion.detected ?? 'no installation'}.`;
    const thread = this.options.board
      .threads(report.projectId)
      .find((candidate) => candidate.title === title);
    if (!thread) {
      this.options.board.createThread(
        {
          projectId: report.projectId,
          title,
          kind: 'discussion',
          tags: ['engine'],
          body,
          type: 'comment',
        },
        { kind: 'system' },
      );
      return;
    }
    if (
      this.options.board
        .thread(report.projectId, thread.threadId)
        .messages.some((message) => message.body === body)
    ) {
      return;
    }
    this.options.board.post(
      { projectId: report.projectId, threadId: thread.threadId, type: 'comment', body },
      { kind: 'system' },
    );
  }

  private async probeLiveBridge(
    projectId: string,
    projectPath: string,
    identity: EngineProjectIdentity,
  ): Promise<LiveBridgeProbe> {
    const database = this.options.projectDatabases.get(projectId);
    const row = database
      .prepare('SELECT connection_id AS connectionId FROM engine_live_bridges WHERE project_id = ?')
      .get<{ connectionId: string }>(projectId);
    if (!row)
      return {
        entry: null,
        identityProven: false,
        detail: 'No live editor bridge is bound.',
        tools: [],
      };
    const entry =
      this.options.mcpConnections
        .list(projectId)
        .find((item) => item.config.connectionId === row.connectionId) ?? null;
    if (!entry)
      return {
        entry: null,
        identityProven: false,
        detail: 'The bound MCP connection is no longer available.',
        tools: [],
      };
    if (!(entry.config.tags ?? []).includes('live-editor')) {
      return {
        entry,
        identityProven: false,
        detail: 'The MCP connection is not tagged live-editor.',
        tools: [],
      };
    }
    if (entry.state.status !== 'connected') {
      return {
        entry,
        identityProven: false,
        detail: `Live editor bridge is ${entry.state.status}.`,
        tools: [],
      };
    }
    if (!identity.proven)
      return {
        entry,
        identityProven: false,
        detail: 'Project identity is unproven from engine files.',
        tools: [],
      };
    try {
      const snapshot = await this.options.mcpConnections.tools(entry.config.connectionId);
      const tools = snapshot.tools;
      const identityTool = tools.find((tool) =>
        isIdentityTool(tool.toolId.split('/').at(-1) ?? ''),
      );
      if (!identityTool)
        return {
          entry,
          identityProven: false,
          detail: 'Live bridge has no project identity probe tool.',
          tools,
        };
      if (identityTool.sideEffects !== 'none')
        return {
          entry,
          identityProven: false,
          detail: 'Project identity probe is not classified read-only.',
          tools,
        };
      const record = await this.options.toolBroker.call({
        projectId,
        toolId: identityTool.toolId,
        input: {},
      });
      const identityResult = parseIdentityResult(record.output);
      const proven =
        identityResult?.projectId === projectId ||
        (identityResult?.projectPath !== undefined &&
          [
            projectPath,
            path.join(projectPath, 'game'),
            ...identity.evidence
              .filter(
                (entry) =>
                  entry.kind === 'file' &&
                  (entry.ref.endsWith('.uproject') || path.basename(entry.ref) === 'project.godot'),
              )
              .map((entry) => path.join(projectPath, entry.ref)),
          ].some((expected) => sameNativePath(identityResult.projectPath!, expected)));
      return {
        entry,
        identityProven: proven,
        detail: proven
          ? `Connected bridge ${entry.config.name} proved the current Project identity.`
          : 'Live bridge identity probe did not identify this Project.',
        tools,
      };
    } catch (error) {
      return {
        entry,
        identityProven: false,
        detail: `Live bridge identity probe failed: ${errorMessage(error)}`,
        tools: [],
      };
    }
  }

  private withLiveBridgeCapability(
    capability: EngineOperationCapability,
    bridge: LiveBridgeProbe,
  ): EngineOperationCapability {
    if (!['edit-scene', 'screenshot', 'console'].includes(capability.operation)) return capability;
    const suffixes: Record<string, string[]> = {
      'edit-scene': ['edit_scene', 'edit-scene', 'editScene', 'execute_python'],
      screenshot: ['screenshot'],
      console: ['console', 'execute_console'],
    };
    let tool = bridge.tools.find((entry) =>
      suffixes[capability.operation]?.includes(entry.toolId.split('/').at(-1) ?? ''),
    );
    if (
      !tool &&
      ['screenshot', 'console'].includes(capability.operation) &&
      bridge.tools.some((entry) => entry.toolId.endsWith('/get_project_context'))
    ) {
      tool = bridge.tools.find((entry) => entry.toolId.endsWith('/invoke'));
    }
    const available = Boolean(
      bridge.entry?.state.status === 'connected' && bridge.identityProven && tool,
    );
    return {
      ...capability,
      available,
      via: available ? 'mcp' : null,
      command: available ? `MCP ${tool!.toolId}` : null,
      sideEffects:
        capability.operation === 'console'
          ? 'destructive'
          : (tool?.sideEffects ?? capability.sideEffects),
      evidence: tool?.evidence ?? capability.evidence,
      reason: available ? null : bridge.detail,
    };
  }

  private async runLiveOperation(
    context: ToolContext,
    operation: EngineOperation,
    params: Record<string, unknown>,
    project: ProjectContext,
    runDirectory: string,
    report: EngineCapabilityReport,
  ): Promise<EngineOperationOutcome> {
    const bridgeReport = await this.capabilities(context.projectId, false);
    const bridge = await this.probeLiveBridge(
      context.projectId,
      project.projectPath,
      report.projectIdentity,
    );
    if (!bridge.entry || bridge.entry.state.status !== 'connected' || !bridge.identityProven) {
      return {
        status: 'unavailable',
        exitCode: null,
        command: [],
        summary: bridge.detail,
        evidence: [{ kind: 'mcp', ref: 'live-editor', detail: bridge.detail }],
        artifacts: [],
      };
    }
    const capability = bridgeReport.operations.find((entry) => entry.operation === operation);
    const namespace = bridge.entry.config.name;
    const tool = bridge.tools.find((entry) => capability?.command === `MCP ${entry.toolId}`);
    if (!tool)
      return {
        status: 'unavailable',
        exitCode: null,
        command: [],
        summary: 'No matching live editor MCP tool is available.',
        evidence: [],
        artifacts: [],
      };
    const record = await this.options.toolBroker.call(
      {
        projectId: context.projectId,
        toolId: tool.toolId,
        input: tool.toolId.endsWith('/invoke')
          ? {
              command: operation === 'screenshot' ? 'take_screenshot' : 'execute_console_command',
              arguments:
                operation === 'screenshot'
                  ? { ...params, file_path: path.join(runDirectory, 'editor-capture.png') }
                  : params,
            }
          : params,
        ...(context.taskId ? { taskId: context.taskId } : {}),
      },
      { accessCeiling: context.accessMode, agentRole: context.agentRole, signal: context.signal },
    );
    const reportArtifact = this.writeMcpArtifact(
      runDirectory,
      operation,
      record.output,
      project.projectPath,
    );
    const completed =
      record.status === 'completed' && (operation !== 'screenshot' || reportArtifact !== null);
    return {
      status: completed ? 'succeeded' : 'failed',
      exitCode: completed ? 0 : 1,
      command: ['MCP', `${namespace}/${tool.toolId.split('/').at(-1)}`],
      summary: completed
        ? `Live editor ${operation} completed.`
        : `Live editor ${operation} failed.`,
      evidence: [
        {
          kind: 'mcp',
          ref: tool.toolId,
          detail: `Tool call ${record.callId} returned status ${record.status}.`,
        },
      ],
      artifacts: reportArtifact ? [reportArtifact] : [],
    };
  }

  private writeMcpArtifact(
    runDirectory: string,
    operation: EngineOperation,
    output: unknown,
    projectPath: string,
  ): EngineOperationRun['artifacts'][number] | null {
    if (operation !== 'screenshot') return null;
    const image = findImage(output);
    if (!image) {
      // Official Unity Pipeline returns a PNG file path rather than inline MCP image data.
      let result = parseMcpObject(output);
      if (
        result?.status === 'success' &&
        isRecord(result.result) &&
        result.result.success === true &&
        typeof result.result.file_path === 'string'
      ) {
        result = { success: true, path: result.result.file_path };
      }
      if (!result || typeof result.path !== 'string' || result.success !== true) return null;
      try {
        const source = realpathSync(path.resolve(path.join(projectPath, 'game'), result.path));
        const relative = path.relative(realpathSync(projectPath), source);
        if (relative.startsWith(`..${path.sep}`) || relative === '..' || path.isAbsolute(relative))
          return null;
        const stat = statSync(source);
        if (!stat.isFile() || stat.size > 8 * 1024 * 1024 || stat.size < 8) return null;
        const data = readFileSync(source);
        if (!data.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])))
          return null;
        writeFileSync(path.join(runDirectory, 'screenshot.png'), data);
        return {
          kind: 'screenshot',
          path: `.gamecrafter/engine-runs/${path.basename(runDirectory)}/screenshot.png`,
        };
      } catch {
        return null;
      }
    }
    const extension =
      image.mimeType === 'image/jpeg' ? 'jpg' : image.mimeType === 'image/webp' ? 'webp' : 'png';
    const runId = path.basename(runDirectory);
    const fileName = `screenshot.${extension}`;
    writeFileSync(path.join(runDirectory, fileName), Buffer.from(image.data, 'base64'));
    return { kind: 'screenshot', path: `.gamecrafter/engine-runs/${runId}/${fileName}` };
  }
}

function isIdentityTool(name: string): boolean {
  return [
    'project_identity',
    'project/identity',
    'get_project_info',
    'project_info',
    'identity',
    'editor_status',
    'get_project_context',
  ].includes(name);
}

function parseIdentityResult(value: unknown): { projectId?: string; projectPath?: string } | null {
  const result = parseMcpObject(value);
  if (!result) return null;
  if (
    result.status === 'success' &&
    isRecord(result.result) &&
    isRecord(result.result.data) &&
    isRecord(result.result.data.project)
  ) {
    const nativePath = result.result.data.project.path;
    return typeof nativePath === 'string' ? { projectPath: nativePath } : null;
  }
  return {
    ...(typeof result.projectId === 'string' ? { projectId: result.projectId } : {}),
    ...(typeof result.projectPath === 'string' ? { projectPath: result.projectPath } : {}),
  };
}

function sameNativePath(left: string, right: string): boolean {
  const normalize = (value: string) =>
    process.platform === 'win32' ? path.resolve(value).toLowerCase() : path.resolve(value);
  return normalize(left) === normalize(right);
}

function parseMcpObject(value: unknown): Record<string, unknown> | null {
  let result = value;
  if (isRecord(result) && Array.isArray(result.content)) {
    const text = result.content.find(
      (entry) => isRecord(entry) && entry.type === 'text' && typeof entry.text === 'string',
    );
    if (isRecord(text) && typeof text.text === 'string') {
      try {
        result = JSON.parse(text.text) as unknown;
      } catch {
        return null;
      }
    } else if (isRecord(result.structuredContent)) result = result.structuredContent;
  }
  if (!isRecord(result)) return null;
  return result;
}

function findImage(value: unknown): { data: string; mimeType: string } | null {
  if (!isRecord(value) || !Array.isArray(value.content)) return null;
  const image = value.content.find(
    (entry) => isRecord(entry) && entry.type === 'image' && typeof entry.data === 'string',
  );
  return isRecord(image) && typeof image.data === 'string'
    ? {
        data: image.data,
        mimeType: typeof image.mimeType === 'string' ? image.mimeType : 'image/png',
      }
    : null;
}

function redactCommand(
  command: string,
  args: string[],
  projectPath: string,
  gamePath: string,
  runDirectory: string,
): string[] {
  return [command, ...args].map((value) =>
    value
      .replaceAll(projectPath, '<project>')
      .replaceAll(gamePath, '<game>')
      .replaceAll(runDirectory, '<run>'),
  );
}

function mergeArtifacts(
  artifacts: EngineOperationRun['artifacts'],
): EngineOperationRun['artifacts'] {
  return [...new Map(artifacts.map((artifact) => [artifact.path, artifact])).values()];
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.max(minimum, Math.min(maximum, Math.trunc(value)));
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

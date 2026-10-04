import { mkdirSync } from 'node:fs';
import type { ChildProcessWithoutNullStreams } from 'node:child_process';
import path from 'node:path';
import {
  ChatRequestSchema,
  compile,
  pluginCapabilityName,
  redact,
  RpcError,
  RpcErrorCode,
  uuidv7,
  type AccessMode,
  type ChatRequest,
  type IsolationReport,
  type InstalledPlugin,
  type PluginLogEntry,
  type PluginWorkerState,
  type ToolDefinition,
} from '@gamecrafter/contracts';
import { ChildProcessTransport } from '../ipc/child-process-transport';
import { JsonRpcChannel } from '../ipc/jsonrpc-channel';
import type { Database } from '../db/database';
import type { CompletionService } from '../models/completion-service';
import type { CredentialStore } from '../profile/credential-store';
import type { ProfileStore } from '../profile/profile-store';
import type { BoardPostInput, BoardService } from '../board/board-service';
import type { SettingsService } from '../settings/settings-service';
import type { ToolBroker } from '../tools/tool-broker';
import { ToolRegistry, type ToolContext, type ToolExecutionResult } from '../tools/tool-registry';
import { requiresDestructiveSideEffects } from '../tools/tool-security';
import { AppContainerLauncher } from './isolation/appcontainer-launcher';
import { BwrapLauncher } from './isolation/bwrap-launcher';
import { UnisolatedLauncher } from './isolation/unisolated-launcher';
import type { IsolationLauncher, LaunchSpec } from './isolation/types';
import type { PluginInstaller } from './plugin-installer';
import type { PluginRegistry } from './plugin-registry';

interface PluginInvocation {
  taskId: string | null;
  agentRole: string | null;
  accessMode: AccessMode;
  signal?: AbortSignal;
}

interface PluginWorker {
  plugin: InstalledPlugin;
  projectId: string;
  state: PluginWorkerState;
  launcher: IsolationLauncher;
  spec: LaunchSpec;
  channel?: JsonRpcChannel;
  child?: ChildProcessWithoutNullStreams;
  currentInvocation?: PluginInvocation;
  returnedToolIds: string[];
  invocationQueue: Promise<void>;
  restarting: boolean;
  stopping: boolean;
  heartbeat?: NodeJS.Timeout;
  idleStop?: NodeJS.Timeout;
}

const chatRequestValidator = compile<ChatRequest>(ChatRequestSchema);

export interface PluginHostOptions {
  database: Database;
  profileDir: string;
  installer: PluginInstaller;
  plugins: PluginRegistry;
  tools: ToolRegistry;
  broker: ToolBroker;
  settings: SettingsService;
  projects: ProfileStore;
  credentials: CredentialStore;
  completion: CompletionService;
  board(projectId: string): BoardService;
  launchers?: {
    linux?: IsolationLauncher;
    win32?: IsolationLauncher;
    unisolated?: IsolationLauncher;
  };
  platform?: 'linux' | 'win32';
  onWorkerChanged?: (state: PluginWorkerState) => void;
  now?: () => Date;
}

export class PluginHost {
  private readonly workers = new Map<string, PluginWorker>();
  private readonly logs = new Map<string, PluginLogEntry[]>();
  private readonly secrets = new Map<string, Set<string>>();
  private readonly registeredSources = new Set<string>();
  private readonly now: () => Date;
  private readonly platform: 'linux' | 'win32';
  private readonly launchers: {
    linux: IsolationLauncher;
    win32: IsolationLauncher;
    unisolated: IsolationLauncher;
  };

  constructor(private readonly options: PluginHostOptions) {
    this.now = options.now ?? (() => new Date());
    this.platform = options.platform ?? (process.platform === 'win32' ? 'win32' : 'linux');
    this.launchers = {
      linux: options.launchers?.linux ?? new BwrapLauncher(),
      win32: options.launchers?.win32 ?? new AppContainerLauncher(),
      unisolated: options.launchers?.unisolated ?? new UnisolatedLauncher(),
    };
  }

  async isolationReport(): Promise<IsolationReport> {
    return this.launchers[this.platform].probe();
  }

  async start(pluginId: string, projectId: string): Promise<PluginWorkerState> {
    if (!this.options.projects.getById(projectId)) {
      throw new RpcError(`Project not found: ${projectId}`, RpcErrorCode.ProjectNotFound);
    }
    const plugin = this.options.installer.get(pluginId);
    if (!plugin || !this.options.plugins.isEnabledForProject(pluginId, projectId)) {
      throw new RpcError(
        `Plugin is not enabled for Project: ${pluginId}`,
        RpcErrorCode.PluginNotFound,
      );
    }
    const key = workerKey(pluginId, projectId);
    const existing = this.workers.get(key);
    if (existing?.state.status === 'running') return existing.state;
    if (existing) await this.stopWorker(existing);
    const selection = await this.selectLauncher(plugin, projectId);
    const scratchDir = path.join(this.options.profileDir, 'plugin-scratch', pluginId, projectId);
    mkdirSync(scratchDir, { recursive: true, mode: 0o700 });
    const state: PluginWorkerState = {
      pluginId,
      projectId,
      status: 'starting',
      isolation: selection.isolation,
      pid: null,
      startedAt: null,
      lastError: null,
      restarts: 0,
    };
    const worker: PluginWorker = {
      plugin,
      projectId,
      state,
      launcher: selection.launcher,
      spec: this.launchSpec(plugin, projectId, scratchDir, selection.network),
      returnedToolIds: [],
      invocationQueue: Promise.resolve(),
      restarting: true,
      stopping: false,
    };
    this.workers.set(key, worker);
    this.emitState(worker.state);
    const maxRestarts = Number(
      this.options.settings.resolve('plugins.maxRestarts', { projectId }).value,
    );
    for (let attempt = 0; attempt <= maxRestarts; attempt += 1) {
      try {
        await this.startProcess(worker);
        worker.restarting = false;
        this.registerTools(plugin);
        this.scheduleHeartbeat(worker);
        this.scheduleIdleStop(worker);
        return worker.state;
      } catch (error) {
        worker.state.restarts = attempt;
        worker.state.lastError = errorMessage(error);
        if (attempt >= maxRestarts) {
          worker.state.status = 'failed';
          worker.restarting = false;
          this.emitState(worker.state);
          this.unregisterToolsIfUnused(pluginId);
          throw new RpcError(
            `Plugin worker failed to start: ${errorMessage(error)}`,
            RpcErrorCode.PluginWorkerFailed,
          );
        }
        await delay(Math.min(1_000 * 2 ** attempt, 10_000));
      }
    }
    return worker.state;
  }

  async stop(pluginId: string, projectId: string): Promise<PluginWorkerState> {
    const worker = this.workers.get(workerKey(pluginId, projectId));
    if (!worker) return this.stoppedState(pluginId, projectId);
    await this.stopWorker(worker);
    this.workers.delete(workerKey(pluginId, projectId));
    this.unregisterToolsIfUnused(pluginId);
    this.emitState(worker.state);
    return worker.state;
  }

  async stopProject(projectId: string): Promise<void> {
    const workers = [...this.workers.values()].filter((worker) => worker.projectId === projectId);
    await Promise.all(workers.map((worker) => this.stop(worker.plugin.pluginId, projectId)));
  }

  async stopPlugin(pluginId: string): Promise<void> {
    const workers = [...this.workers.values()].filter(
      (worker) => worker.plugin.pluginId === pluginId,
    );
    await Promise.all(workers.map((worker) => this.stop(pluginId, worker.projectId)));
  }

  async stopAll(): Promise<void> {
    await Promise.all(
      [...this.workers.values()].map((worker) =>
        this.stop(worker.plugin.pluginId, worker.projectId),
      ),
    );
  }

  workerState(pluginId: string, projectId?: string): PluginWorkerState | null {
    if (projectId) return this.workers.get(workerKey(pluginId, projectId))?.state ?? null;
    return (
      [...this.workers.values()]
        .filter((worker) => worker.plugin.pluginId === pluginId)
        .sort((left, right) =>
          (right.state.startedAt ?? '').localeCompare(left.state.startedAt ?? ''),
        )[0]?.state ?? null
    );
  }

  status(pluginId: string, projectId?: string): PluginWorkerState {
    if (projectId) {
      return (
        this.workers.get(workerKey(pluginId, projectId))?.state ??
        this.stoppedState(pluginId, projectId)
      );
    }
    const worker = [...this.workers.values()]
      .filter((candidate) => candidate.plugin.pluginId === pluginId)
      .sort((left, right) =>
        (right.state.startedAt ?? '').localeCompare(left.state.startedAt ?? ''),
      )[0];
    return worker?.state ?? this.stoppedState(pluginId, null);
  }

  listStates(pluginId?: string): PluginWorkerState[] {
    return [...this.workers.values()]
      .filter((worker) => pluginId === undefined || worker.plugin.pluginId === pluginId)
      .map((worker) => worker.state)
      .sort(
        (left, right) =>
          left.pluginId.localeCompare(right.pluginId) ||
          (left.projectId ?? '').localeCompare(right.projectId ?? ''),
      );
  }

  logsFor(pluginId: string, projectId?: string, limit = 100): PluginLogEntry[] {
    const entries = [...this.logs.entries()]
      .filter(
        ([key]) =>
          key.startsWith(`${pluginId}\0`) && (!projectId || key === workerKey(pluginId, projectId)),
      )
      .flatMap(([, values]) => values);
    return entries.slice(-Math.max(1, Math.min(1000, limit)));
  }

  rememberSecret(pluginId: string, name: string, value: string): void {
    const values = this.secrets.get(pluginId) ?? new Set<string>();
    if (value) values.add(value);
    this.secrets.set(pluginId, values);
  }

  async settingsChanged(
    pluginId: string,
    projectId: string,
    settings: Record<string, unknown>,
  ): Promise<void> {
    const worker = this.workers.get(workerKey(pluginId, projectId));
    await worker?.channel?.notify('plugin/settingsChanged', { settings });
  }

  private async selectLauncher(
    plugin: InstalledPlugin,
    projectId: string,
  ): Promise<{
    launcher: IsolationLauncher;
    isolation: PluginWorkerState['isolation'];
    network: boolean;
  }> {
    const pluginIsolation = this.launchers[this.platform];
    const report = await pluginIsolation.probe();
    const mode = this.accessMode(projectId);
    const networkCapability = plugin.manifest.capabilities.find(
      (capability) => pluginCapabilityName(capability) === 'network.outbound',
    );
    if (
      isRecord(networkCapability) &&
      Array.isArray(networkCapability.hosts) &&
      networkCapability.hosts.length > 0
    ) {
      throw new RpcError(
        'The current isolation launcher cannot enforce outbound host allow-lists.',
        RpcErrorCode.PluginIsolationUnavailable,
      );
    }
    const network = networkCapability === 'network.outbound';
    if (report.available) {
      return {
        launcher: pluginIsolation,
        isolation: {
          backend: report.backend,
          enforced: true,
          details: report.checks.map((check) => `${check.name}: ${check.detail}`),
        },
        network,
      };
    }
    if (mode !== 'full') {
      throw new RpcError(
        `Plugin isolation is unavailable for ${mode} access mode: ${report.checks.map((check) => check.detail).join('; ')}`,
        RpcErrorCode.PluginIsolationUnavailable,
      );
    }
    if (this.options.settings.resolve('plugins.allowUnisolatedInFullAccess').value !== true) {
      throw new RpcError(
        'Plugin isolation is unavailable and unisolated workers are disabled for Full access.',
        RpcErrorCode.PluginIsolationUnavailable,
      );
    }
    return {
      launcher: this.launchers.unisolated,
      isolation: {
        backend: 'none',
        enforced: false,
        details: ['No OS isolation is enforced; enabled only because Project access is Full.'],
      },
      network,
    };
  }

  private launchSpec(
    plugin: InstalledPlugin,
    projectId: string,
    scratchDir: string,
    network: boolean,
  ): LaunchSpec {
    const entry = path.join(plugin.installPath, plugin.manifest.runtime.entry);
    const command =
      plugin.manifest.runtime.kind === 'node'
        ? process.execPath
        : plugin.manifest.runtime.kind === 'python'
          ? (plugin.manifest.runtime.interpreter ?? 'python3')
          : entry;
    const args =
      plugin.manifest.runtime.kind === 'executable'
        ? [...plugin.manifest.runtime.args]
        : [entry, ...plugin.manifest.runtime.args];
    const project = this.options.projects.getById(projectId);
    if (!project)
      throw new RpcError(`Project not found: ${projectId}`, RpcErrorCode.ProjectNotFound);
    const env: Record<string, string> = {
      PATH: '/usr/bin:/bin',
      HOME: plugin.installPath,
      LANG: 'C.UTF-8',
      TMPDIR: scratchDir,
    };
    return {
      command,
      args,
      env,
      cwd: plugin.installPath,
      readOnlyPaths: [plugin.installPath],
      readWritePaths: [scratchDir],
      network,
      pluginDir: plugin.installPath,
      scratchDir,
    };
  }

  private async startProcess(worker: PluginWorker): Promise<void> {
    const child = worker.launcher.launch(worker.spec);
    worker.child = child;
    const channel = new JsonRpcChannel(
      new ChildProcessTransport(child, (line) => this.addLog(worker, 'info', line)),
      60_000,
    );
    worker.channel = channel;
    channel.onConnectionError((error) => {
      if (!worker.stopping && !worker.restarting) void this.restartAfterCrash(worker, error);
    });
    this.registerHostHandlers(worker, channel);
    try {
      await channel.start();
      const result = await channel.request(
        'plugin/initialize',
        {
          protocolVersion: 1,
          pluginId: worker.plugin.pluginId,
          version: worker.plugin.version,
          grantedCapabilities: worker.plugin.trust?.acceptedCapabilities ?? [],
          settings: this.pluginSettings(worker.plugin.pluginId, worker.projectId),
          project: this.projectContext(worker.projectId),
          scratchDir: worker.spec.scratchDir,
        },
        { timeoutMs: 15_000 },
      );
      const toolIds = this.returnedToolIds(result, worker.plugin);
      worker.state.status = 'running';
      worker.state.pid = child.pid ?? null;
      worker.state.startedAt = this.now().toISOString();
      worker.state.lastError = null;
      worker.returnedToolIds = toolIds;
      this.emitState(worker.state);
    } catch (error) {
      await channel.close().catch(() => undefined);
      worker.channel = undefined;
      worker.child = undefined;
      throw error;
    }
  }

  private registerHostHandlers(worker: PluginWorker, channel: JsonRpcChannel): void {
    channel.onRequest('host/tool/call', (params) =>
      this.auditHostCall(worker, 'host/tool/call', 'tools.call', params, () =>
        this.callHostTool(worker, params),
      ),
    );
    channel.onRequest('host/log', (params) =>
      this.auditHostCall(worker, 'host/log', null, params, () => this.hostLog(worker, params)),
    );
    channel.onRequest('host/model/complete', (params) =>
      this.auditHostCall(worker, 'host/model/complete', 'models.complete', params, () =>
        this.complete(worker, params),
      ),
    );
    channel.onRequest('host/secret/get', (params) =>
      this.auditHostCall(worker, 'host/secret/get', 'secrets.read', params, () =>
        this.getSecret(worker, params),
      ),
    );
    channel.onRequest('host/board/read', (params) =>
      this.auditHostCall(worker, 'host/board/read', 'board.read', params, () =>
        this.boardRead(worker, params),
      ),
    );
    channel.onRequest('host/board/post', (params) =>
      this.auditHostCall(worker, 'host/board/post', 'board.post', params, () =>
        this.boardPost(worker, params),
      ),
    );
  }

  private async auditHostCall(
    worker: PluginWorker,
    method: string,
    capability: string | null,
    input: unknown,
    operation: () => Promise<unknown>,
  ): Promise<unknown> {
    const callId = uuidv7();
    const startedAt = this.now().toISOString();
    let status = 'completed';
    let errorCode: number | null = null;
    try {
      const output = await operation();
      return output;
    } catch (error) {
      status =
        error instanceof RpcError && error.code === RpcErrorCode.PluginCapabilityDenied
          ? 'denied'
          : 'failed';
      errorCode = isRecord(error) && typeof error.code === 'number' ? error.code : null;
      throw error;
    } finally {
      this.options.database
        .prepare(
          `INSERT INTO plugin_host_calls
            (call_id, plugin_id, project_id, task_id, method, capability, tool_id, input,
             status, error_code, started_at, finished_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        )
        .run(
          callId,
          worker.plugin.pluginId,
          worker.projectId,
          worker.currentInvocation?.taskId ?? null,
          method,
          capability,
          method === 'host/tool/call' && isRecord(input) && typeof input.toolId === 'string'
            ? input.toolId
            : null,
          JSON.stringify(this.redactAuditValue(worker.plugin.pluginId, redact(input))),
          status,
          errorCode,
          startedAt,
          this.now().toISOString(),
        );
    }
  }

  private async callHostTool(worker: PluginWorker, params: unknown): Promise<unknown> {
    this.requireCapability(worker.plugin, 'tools.call');
    if (!isRecord(params) || typeof params.toolId !== 'string') {
      throw new RpcError('host/tool/call requires a toolId', RpcErrorCode.InvalidParams);
    }
    const required = requiredToolCapability(params.toolId);
    if (required) this.requireCapability(worker.plugin, required);
    const targetTool = this.options.tools.get(params.toolId);
    if (targetTool?.definition.source.startsWith('plugin:')) {
      throw new RpcError(
        'Plugins cannot use host/tool/call to invoke another plugin worker.',
        RpcErrorCode.PluginCapabilityDenied,
        { pluginId: worker.plugin.pluginId, toolId: params.toolId },
      );
    }
    const invocation = worker.currentInvocation ?? {
      taskId: null,
      agentRole: null,
      accessMode: this.accessMode(worker.projectId),
    };
    const record = await this.options.broker.call(
      {
        projectId: worker.projectId,
        toolId: params.toolId,
        input: params.input,
        ...(invocation.taskId ? { taskId: invocation.taskId } : {}),
      },
      {
        accessCeiling: invocation.accessMode,
        agentRole: `plugin:${worker.plugin.pluginId}`,
        signal: invocation.signal,
      },
    );
    return { output: record.output, evidence: record.evidence };
  }

  private async hostLog(worker: PluginWorker, params: unknown): Promise<unknown> {
    if (!isRecord(params) || typeof params.message !== 'string') {
      throw new RpcError('host/log requires a message', RpcErrorCode.InvalidParams);
    }
    const level = isLogLevel(params.level) ? params.level : 'info';
    this.addLog(worker, level, params.message);
    return {};
  }

  private async complete(worker: PluginWorker, params: unknown): Promise<unknown> {
    this.requireCapability(worker.plugin, 'models.complete');
    if (!isRecord(params) || !isRecord(params.request)) {
      throw new RpcError('host/model/complete requires a request', RpcErrorCode.InvalidParams);
    }
    let request: ChatRequest;
    try {
      request = chatRequestValidator.assert(params.request);
    } catch (error) {
      throw new RpcError(
        `Invalid model completion request: ${errorMessage(error)}`,
        RpcErrorCode.InvalidParams,
      );
    }
    const invocation = worker.currentInvocation;
    const response = await this.options.completion.complete(
      {
        route: {
          projectId: worker.projectId,
          agentRole: `plugin:${worker.plugin.pluginId}`,
          taskType: 'plugin',
        },
        request,
        projectId: worker.projectId,
        ...(invocation?.taskId ? { taskId: invocation.taskId } : {}),
      },
      { signal: invocation?.signal },
    );
    this.options.database
      .prepare(
        `INSERT INTO plugin_usage
          (usage_id, plugin_id, project_id, task_id, decision_id, model_id, cost_usd,
           recorded_at, cost_status)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        uuidv7(),
        worker.plugin.pluginId,
        worker.projectId,
        invocation?.taskId ?? null,
        response.decisionId,
        response.modelId,
        response.usage.costUsd ?? 0,
        this.now().toISOString(),
        response.usage.costStatus ?? (response.usage.costUsd === null ? 'unknown' : 'known'),
      );
    return response;
  }

  private async getSecret(worker: PluginWorker, params: unknown): Promise<unknown> {
    this.requireCapability(worker.plugin, 'secrets.read');
    if (
      !isRecord(params) ||
      typeof params.name !== 'string' ||
      !/^[A-Za-z0-9][A-Za-z0-9_-]{0,63}$/.test(params.name)
    ) {
      throw new RpcError('Plugin secret name is invalid', RpcErrorCode.InvalidParams);
    }
    const value = this.options.credentials.get(`plugin:${worker.plugin.pluginId}:${params.name}`);
    if (value) this.rememberSecret(worker.plugin.pluginId, params.name, value);
    return value ?? null;
  }

  private async boardRead(worker: PluginWorker, params: unknown): Promise<unknown> {
    this.requireCapability(worker.plugin, 'board.read');
    const input = isRecord(params) ? params : {};
    const board = this.options.board(worker.projectId);
    if (typeof input.threadId === 'string') {
      return board.thread(worker.projectId, input.threadId, { includeMessages: true });
    }
    if (typeof input.query === 'string') {
      return board.search(
        worker.projectId,
        input.query,
        typeof input.limit === 'number' ? input.limit : undefined,
      );
    }
    return board.threads(worker.projectId, input as never);
  }

  private async boardPost(worker: PluginWorker, params: unknown): Promise<unknown> {
    this.requireCapability(worker.plugin, 'board.post');
    if (!isRecord(params) || typeof params.type !== 'string' || typeof params.body !== 'string') {
      throw new RpcError(
        'host/board/post requires a message type and body',
        RpcErrorCode.InvalidParams,
      );
    }
    return this.options.board(worker.projectId).post(
      { ...(params as unknown as BoardPostInput), projectId: worker.projectId },
      {
        kind: 'agent',
        role: `plugin:${worker.plugin.pluginId}`,
        taskId: worker.currentInvocation?.taskId ?? null,
      },
    );
  }

  private requireCapability(plugin: InstalledPlugin, capability: string): void {
    const granted = plugin.trust?.acceptedCapabilities.some(
      (candidate) => pluginCapabilityName(candidate) === capability,
    );
    if (!granted) {
      throw new RpcError(
        `Plugin ${plugin.pluginId} has not been granted ${capability}.`,
        RpcErrorCode.PluginCapabilityDenied,
        { pluginId: plugin.pluginId, capability },
      );
    }
  }

  private registerTools(plugin: InstalledPlugin): void {
    const source = pluginSource(plugin.pluginId);
    if (this.registeredSources.has(source)) return;
    const returnedToolIds = this.returnedToolIdsForPlugin(plugin.pluginId);
    for (const tool of plugin.manifest.contributes.tools) {
      if (!returnedToolIds.has(tool.toolId)) continue;
      const definition: ToolDefinition = {
        toolId: tool.toolId,
        title: tool.title,
        description: tool.description,
        inputSchema: tool.inputSchema,
        ...(tool.outputSchema === undefined ? {} : { outputSchema: tool.outputSchema }),
        executionMode: tool.executionMode,
        sideEffects: requiresDestructiveSideEffects(tool.toolId) ? 'destructive' : tool.sideEffects,
        evidence: tool.evidence,
        capabilities: plugin.manifest.capabilities.map(pluginCapabilityName),
        source,
      };
      this.options.tools.register(definition, async (context, input) => {
        const worker = this.workers.get(workerKey(plugin.pluginId, context.projectId));
        if (!worker || worker.state.status !== 'running' || !worker.channel) {
          throw new RpcError(
            `Plugin worker is not running: ${plugin.pluginId}`,
            RpcErrorCode.PluginWorkerFailed,
          );
        }
        return this.invokePluginTool(worker, tool.toolId, input, context);
      });
    }
    this.registeredSources.add(source);
  }

  private returnedToolIdsForPlugin(pluginId: string): Set<string> {
    return new Set(
      [...this.workers.values()]
        .filter(
          (worker) => worker.plugin.pluginId === pluginId && worker.state.status === 'running',
        )
        .flatMap((worker) => worker.returnedToolIds),
    );
  }

  private returnedToolIds(result: unknown, plugin: InstalledPlugin): string[] {
    if (!isRecord(result) || result.protocolVersion !== 1 || !Array.isArray(result.tools)) {
      throw new RpcError('Plugin initialize response is invalid.', RpcErrorCode.PluginWorkerFailed);
    }
    const declared = new Set(plugin.manifest.contributes.tools.map((tool) => tool.toolId));
    const toolIds = result.tools.filter((toolId): toolId is string => typeof toolId === 'string');
    if (toolIds.length !== result.tools.length || toolIds.some((toolId) => !declared.has(toolId))) {
      throw new RpcError(
        'Plugin worker registered tool ids not declared in its manifest.',
        RpcErrorCode.PluginWorkerFailed,
      );
    }
    return toolIds;
  }

  private async invokePluginTool(
    worker: PluginWorker,
    toolId: string,
    input: unknown,
    context: ToolContext,
  ): Promise<ToolExecutionResult> {
    return runSerialized(worker, async () => {
      worker.currentInvocation = {
        taskId: context.taskId,
        agentRole: context.agentRole ?? null,
        accessMode: context.accessMode,
        signal: context.signal,
      };
      try {
        this.touch(worker);
        const result = await worker.channel!.request(
          'plugin/tool/call',
          {
            toolId,
            input,
            context: {
              taskId: context.taskId,
              agentRole: context.agentRole ?? null,
              accessMode: context.accessMode,
            },
          },
          { signal: context.signal },
        );
        if (!isRecord(result) || !('output' in result)) {
          throw new RpcError(
            'Plugin tool returned an invalid result.',
            RpcErrorCode.PluginWorkerFailed,
          );
        }
        return {
          output: result.output,
          ...(Array.isArray(result.evidence)
            ? { evidence: result.evidence as ToolExecutionResult['evidence'] }
            : {}),
        };
      } finally {
        worker.currentInvocation = undefined;
      }
    });
  }

  private async restartAfterCrash(worker: PluginWorker, error: Error): Promise<void> {
    if (worker.stopping || worker.restarting) return;
    worker.restarting = true;
    if (worker.heartbeat) clearInterval(worker.heartbeat);
    if (worker.idleStop) clearTimeout(worker.idleStop);
    await worker.channel?.close().catch(() => undefined);
    worker.channel = undefined;
    worker.child = undefined;
    worker.state.lastError = this.redact(worker.plugin.pluginId, error.message);
    worker.state.status = 'starting';
    worker.state.pid = null;
    worker.state.startedAt = null;
    this.emitState(worker.state);
    const maxRestarts = Number(
      this.options.settings.resolve('plugins.maxRestarts', { projectId: worker.projectId }).value,
    );
    for (let attempt = worker.state.restarts + 1; attempt <= maxRestarts; attempt += 1) {
      worker.state.restarts = attempt;
      await delay(Math.min(1_000 * 2 ** (attempt - 1), 10_000));
      try {
        await this.startProcess(worker);
        worker.restarting = false;
        this.scheduleHeartbeat(worker);
        this.scheduleIdleStop(worker);
        return;
      } catch (restartError) {
        worker.state.lastError = this.redact(worker.plugin.pluginId, errorMessage(restartError));
      }
    }
    worker.state.status = 'failed';
    worker.restarting = false;
    this.emitState(worker.state);
    this.unregisterToolsIfUnused(worker.plugin.pluginId);
  }

  private async stopWorker(worker: PluginWorker): Promise<void> {
    worker.stopping = true;
    worker.restarting = false;
    if (worker.heartbeat) clearInterval(worker.heartbeat);
    if (worker.idleStop) clearTimeout(worker.idleStop);
    if (worker.channel && worker.state.status === 'running') {
      await worker.channel
        .request('plugin/shutdown', {}, { timeoutMs: 1_000 })
        .catch(() => undefined);
    }
    await worker.channel?.close().catch(() => undefined);
    worker.channel = undefined;
    worker.child = undefined;
    worker.state.status = 'stopped';
    worker.state.pid = null;
    worker.state.startedAt = null;
    worker.state.lastError = null;
    this.emitState(worker.state);
  }

  private scheduleHeartbeat(worker: PluginWorker): void {
    if (worker.heartbeat) clearInterval(worker.heartbeat);
    worker.heartbeat = setInterval(() => {
      void worker.channel?.request('ping', {}, { timeoutMs: 5_000 }).catch((error: unknown) => {
        void this.restartAfterCrash(worker, asError(error));
      });
    }, 15_000);
    worker.heartbeat.unref?.();
  }

  private scheduleIdleStop(worker: PluginWorker): void {
    if (worker.idleStop) clearTimeout(worker.idleStop);
    const minutes = Number(
      this.options.settings.resolve('plugins.workerIdleStopMinutes', {
        projectId: worker.projectId,
      }).value,
    );
    if (minutes <= 0) return;
    worker.idleStop = setTimeout(() => {
      if (worker.state.status !== 'running' || worker.restarting || worker.stopping) return;
      void this.stop(worker.plugin.pluginId, worker.projectId);
    }, minutes * 60_000);
    worker.idleStop.unref?.();
  }

  private touch(worker: PluginWorker): void {
    this.scheduleIdleStop(worker);
  }

  private stoppedState(pluginId: string, projectId: string | null): PluginWorkerState {
    return {
      pluginId,
      projectId,
      status: 'stopped',
      isolation: { backend: 'none', enforced: false, details: ['Worker has not been started.'] },
      pid: null,
      startedAt: null,
      lastError: null,
      restarts: 0,
    };
  }

  private accessMode(projectId: string): AccessMode {
    const mode = this.options.settings.resolve('access.mode', { projectId }).value;
    return mode === 'full' || mode === 'restricted' || mode === 'ask-always' ? mode : 'ask-always';
  }

  private projectContext(projectId: string): {
    projectId: string;
    name: string;
    engine: { family: string };
  } {
    const project = this.options.projects.getById(projectId);
    if (!project)
      throw new RpcError(`Project not found: ${projectId}`, RpcErrorCode.ProjectNotFound);
    return { projectId, name: project.name, engine: { family: project.engineFamily } };
  }

  private pluginSettings(pluginId: string, projectId: string): Record<string, unknown> {
    const prefix = `plugin.${pluginId}.`;
    return Object.fromEntries(
      this.options.settings
        .getAll({ projectId })
        .filter((setting) => setting.key.startsWith(prefix))
        .map((setting) => [setting.key, setting.value]),
    );
  }

  private addLog(worker: PluginWorker, level: PluginLogEntry['level'], message: string): void {
    const entry: PluginLogEntry = {
      at: this.now().toISOString(),
      level,
      message: this.redact(worker.plugin.pluginId, message),
    };
    const key = workerKey(worker.plugin.pluginId, worker.projectId);
    const logs = this.logs.get(key) ?? [];
    logs.push(entry);
    if (logs.length > 500) logs.splice(0, logs.length - 500);
    this.logs.set(key, logs);
    this.touch(worker);
  }

  private redactAuditValue(pluginId: string, value: unknown): unknown {
    if (typeof value === 'string') return this.redact(pluginId, value);
    if (Array.isArray(value)) return value.map((entry) => this.redactAuditValue(pluginId, entry));
    if (isRecord(value)) {
      return Object.fromEntries(
        Object.entries(value).map(([key, entry]) => [key, this.redactAuditValue(pluginId, entry)]),
      );
    }
    return value;
  }

  private redact(pluginId: string, message: string): string {
    let redacted = message;
    for (const secret of this.secrets.get(pluginId) ?? []) {
      if (secret) redacted = redacted.replaceAll(secret, '[REDACTED]');
    }
    return redacted;
  }

  private unregisterToolsIfUnused(pluginId: string): void {
    if (
      [...this.workers.values()].some(
        (worker) =>
          worker.plugin.pluginId === pluginId &&
          worker.state.status !== 'stopped' &&
          worker.state.status !== 'failed',
      )
    )
      return;
    if (this.registeredSources.delete(pluginSource(pluginId))) {
      this.options.tools.unregisterSource(pluginSource(pluginId));
    }
  }

  private emitState(state: PluginWorkerState): void {
    this.options.onWorkerChanged?.({
      ...state,
      isolation: { ...state.isolation, details: [...state.isolation.details] },
    });
  }
}

function workerKey(pluginId: string, projectId: string): string {
  return `${pluginId}\0${projectId}`;
}

function pluginSource(pluginId: string): string {
  return `plugin:${pluginId}`;
}

function requiredToolCapability(toolId: string): string | undefined {
  if (toolId === 'fs/read-file' || toolId === 'fs/list') return 'fs.project.read';
  if (toolId === 'fs/write-file' || toolId === 'fs/delete') return 'fs.project.write';
  if (toolId === 'process/run') return 'process.spawn';
  if (toolId === 'board/read') return 'board.read';
  if (toolId === 'board/post') return 'board.post';
  return undefined;
}

function isLogLevel(value: unknown): value is PluginLogEntry['level'] {
  return value === 'debug' || value === 'info' || value === 'warning' || value === 'error';
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function asError(error: unknown): Error {
  return error instanceof Error ? error : new Error(String(error));
}

function delay(milliseconds: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

async function runSerialized<T>(worker: PluginWorker, operation: () => Promise<T>): Promise<T> {
  const previous = worker.invocationQueue;
  let release!: () => void;
  worker.invocationQueue = new Promise<void>((resolve) => {
    release = resolve;
  });
  await previous;
  try {
    return await operation();
  } finally {
    release();
  }
}

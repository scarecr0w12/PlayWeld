import { pathToFileURL } from 'node:url';
import {
  RpcError,
  RpcErrorCode,
  compile,
  uuidv7,
  McpConnectionConfigSchema,
  type McpConnectionConfig,
  type McpConnectionInput,
  type McpConnectionListEntry,
  type McpConnectionLogEntry,
  type McpConnectionPatch,
  type McpConnectionState,
  type McpRevision,
  type RpcNotificationParams,
  type SideEffect,
  type ToolDefinition,
  type ExecutionMode,
  type ChatMessage,
} from '@gamecrafter/contracts';
import type { Database } from '../db/database';
import type { CredentialStore } from '../profile/credential-store';
import type { ProfileStore } from '../profile/profile-store';
import type { SettingsService } from '../settings/settings-service';
import type { TaskService } from '../tasks/task-service';
import type { ToolRegistry } from '../tools/tool-registry';
import { CompletionService } from '../models/completion-service';
import { createDockerRuntime, type DockerRuntime } from './docker-runtime';
import { McpSession, type McpToolsSnapshot } from './session';
import { McpToolAdapter } from './mcp-tool-adapter';
import { LegacySseTransport } from './transports/legacy-sse';
import { StdioTransport } from './transports/stdio';
import { StreamableHttpTransport } from './transports/streamable-http';
import { McpProtocolError, type McpTransport } from './types';

interface ConnectionRow {
  connectionId: string;
  name: string;
  scope: 'platform' | 'project';
  projectId: string | null;
  config: string;
}

interface ToolOverrideRow {
  sideEffects: SideEffect | null;
  executionMode: ExecutionMode | null;
}

interface PendingInput {
  resolve(responses: unknown): void;
  reject(error: Error): void;
  timer: NodeJS.Timeout;
  removeAbort(): void;
}

interface McpRuntime {
  session: McpSession;
  secrets: string[];
  docker?: DockerRuntime;
  containerId?: string | null;
}

export interface McpConnectionManagerEvents {
  stateChanged(state: McpConnectionState): void;
  inputRequired(params: RpcNotificationParams<'mcp/inputRequired'>): void;
}

export interface McpConnectionManagerOptions {
  database: Database;
  profile: ProfileStore;
  credentials: CredentialStore;
  settings: SettingsService;
  tasks: TaskService;
  completion: CompletionService;
  tools: ToolRegistry;
  events: McpConnectionManagerEvents;
  clientInfo: { name: string; version: string };
  dockerBinary?: string;
  now?: () => Date;
}

export class McpConnectionManager {
  private readonly sessions = new Map<string, McpRuntime>();
  private readonly states = new Map<string, McpConnectionState>();
  private readonly logs = new Map<string, McpConnectionLogEntry[]>();
  private readonly secrets = new Map<string, string[]>();
  private readonly pendingInputs = new Map<string, PendingInput>();
  private readonly reconnectTimers = new Map<string, NodeJS.Timeout>();
  private readonly now: () => Date;
  private readonly toolAdapter: McpToolAdapter;
  private stopped = false;
  private readonly connecting = new Map<string, Promise<McpConnectionState>>();

  constructor(private readonly options: McpConnectionManagerOptions) {
    this.now = options.now ?? (() => new Date());
    this.toolAdapter = new McpToolAdapter(options.tools);
  }

  async start(): Promise<void> {
    this.stopped = false;
    for (const config of this.readConfigs()) {
      if (config.enabled && config.scope === 'platform' && this.autoConnect(config)) {
        void this.connect(config.connectionId).catch(() => undefined);
      }
    }
  }

  async onProjectOpened(projectId: string): Promise<void> {
    const project = this.options.profile.getById(projectId);
    if (!project) return;
    for (const config of this.readConfigs()) {
      if (
        config.enabled &&
        config.scope === 'project' &&
        config.projectId === projectId &&
        this.autoConnect(config)
      ) {
        void this.connect(config.connectionId).catch(() => undefined);
      }
    }
  }

  async stop(): Promise<void> {
    this.stopped = true;
    await Promise.allSettled(this.connecting.values());
    for (const timer of this.reconnectTimers.values()) clearTimeout(timer);
    this.reconnectTimers.clear();
    for (const [key, pending] of this.pendingInputs) {
      clearTimeout(pending.timer);
      pending.removeAbort();
      pending.reject(new Error('MCP service stopped'));
      this.pendingInputs.delete(key);
    }
    await Promise.allSettled(
      [...this.sessions.keys()].map((connectionId) => this.disconnect(connectionId)),
    );
  }

  list(projectId?: string): McpConnectionListEntry[] {
    if (projectId && !this.options.profile.getById(projectId)) {
      throw new RpcError(`Project not found: ${projectId}`, RpcErrorCode.ProjectNotFound);
    }
    return this.readConfigs()
      .filter((config) => config.scope === 'platform' || config.projectId === projectId)
      .map((config) => ({ config, state: this.state(config.connectionId, config) }))
      .sort((left, right) => left.config.name.localeCompare(right.config.name));
  }

  add(input: McpConnectionInput, credentials: Record<string, string> = {}): McpConnectionConfig {
    const config = normalizeConfig(input, uuidv7(), this.now());
    this.validateScope(config);
    validateCredentialReferences(config);
    validateCredentialMap(credentials);
    this.options.database.transaction(() => {
      this.saveConfig(config);
      this.storeCredentials(config.connectionId, credentials);
    });
    this.setState(config, this.state(config.connectionId, config));
    if (config.enabled && this.autoConnect(config)) {
      void this.connect(config.connectionId).catch(() => undefined);
    }
    return config;
  }

  async update(
    connectionId: string,
    patch: McpConnectionPatch,
    credentials: Record<string, string> = {},
  ): Promise<McpConnectionConfig> {
    const current = this.getConfig(connectionId);
    const merged = mergeConfig(current, patch, this.now());
    this.validateScope(merged);
    validateCredentialReferences(merged);
    validateCredentialMap(credentials);
    const wasConnected = this.sessions.has(connectionId);
    if (wasConnected || this.connecting.has(connectionId)) await this.disconnect(connectionId);
    this.options.database.transaction(() => {
      this.saveConfig(merged);
      this.storeCredentials(connectionId, credentials);
    });
    if (merged.enabled && (wasConnected || this.autoConnect(merged))) {
      void this.connect(connectionId).catch(() => undefined);
    }
    return merged;
  }

  async remove(connectionId: string): Promise<void> {
    this.getConfig(connectionId);
    await this.disconnect(connectionId);
    this.toolAdapter.unregister(connectionId);
    this.options.database
      .prepare('DELETE FROM mcp_tool_overrides WHERE connection_id = ?')
      .run(connectionId);
    const credentialRows = this.options.database
      .prepare('SELECT ref FROM credentials WHERE ref LIKE ?')
      .all<{ ref: string }>(`mcp:${connectionId}:%`);
    for (const row of credentialRows) this.options.credentials.delete(row.ref);
    this.options.database
      .prepare('DELETE FROM mcp_connections WHERE connection_id = ?')
      .run(connectionId);
    this.states.delete(connectionId);
    this.logs.delete(connectionId);
    this.secrets.delete(connectionId);
    this.rejectPendingInputs(connectionId, new Error('MCP connection removed'));
  }

  async connect(connectionId: string): Promise<McpConnectionState> {
    const pending = this.connecting.get(connectionId);
    if (pending) return pending;
    if (this.stopped)
      throw new RpcError('MCP connection manager is stopped.', RpcErrorCode.McpConnectFailed);
    const connection = this.connectOnce(connectionId);
    this.connecting.set(connectionId, connection);
    try {
      return await connection;
    } finally {
      if (this.connecting.get(connectionId) === connection) this.connecting.delete(connectionId);
    }
  }

  private async connectOnce(connectionId: string): Promise<McpConnectionState> {
    const currentRuntime = this.sessions.get(connectionId);
    if (currentRuntime?.session.state.status === 'connected') return currentRuntime.session.state;
    if (currentRuntime) await this.disconnectSession(connectionId);
    this.clearReconnectTimer(connectionId);
    const config = this.getConfig(connectionId);
    const initialState = {
      ...this.state(connectionId),
      status: 'connecting' as const,
      lastError: null,
    };
    this.setState(config, initialState);
    let docker: DockerRuntime | undefined;
    let runtime: McpRuntime | undefined;
    try {
      const secretValues: string[] = [];
      const transportResult = await this.createTransport(config, secretValues);
      this.secrets.set(connectionId, [
        ...new Set([...(this.secrets.get(connectionId) ?? []), ...secretValues]),
      ]);
      docker = transportResult.docker;
      const session = new McpSession({
        config,
        transport: transportResult.transport,
        clientInfo: this.options.clientInfo,
        containerId: null,
        interactions: {
          onInputRequired: (requestId, requests, projectId, taskId, signal) =>
            this.askForInput(config, requestId, requests, projectId, taskId, signal),
          onSampling: (params, context) => this.handleSampling(config, params, context),
          projectRoot: () => this.projectRoot(config),
          log: (entry) => this.appendLog(config, secretValues, entry),
          toolsInvalidated: () => {
            void this.refreshToolsInternal(connectionId, false).catch((error: unknown) =>
              this.appendLog(config, secretValues, {
                at: this.now().toISOString(),
                level: 'warning',
                message: `Unable to refresh MCP tools: ${errorMessage(error)}`,
              }),
            );
          },
          stateChanged: (state) => this.onSessionState(config, state, secretValues),
        },
        now: this.now,
      });
      runtime = { session, secrets: secretValues, docker, containerId: null };
      this.sessions.set(connectionId, runtime);
      const connectedState = await session.connect();
      if (docker) {
        runtime.containerId = await docker.getContainerId();
        const state = { ...connectedState, containerId: runtime.containerId };
        this.setState(config, state);
      }
      await this.refreshToolsInternal(connectionId, false);
      this.appendLog(config, secretValues, {
        at: this.now().toISOString(),
        level: 'info',
        message: `Connected using ${connectedState.negotiatedRevision}`,
      });
      return this.state(connectionId);
    } catch (error) {
      this.toolAdapter.unregister(connectionId);
      await runtime?.session.disconnect().catch(() => undefined);
      this.sessions.delete(connectionId);
      const message = this.redact(connectionId, errorMessage(error));
      this.appendLog(config, runtime?.secrets ?? [], {
        at: this.now().toISOString(),
        level: 'error',
        message,
      });
      if (docker && config.mode === 'docker' && config.docker.stopOnDisconnect) {
        await docker.stop().catch(() => undefined);
      }
      const failed = {
        ...this.state(connectionId),
        status: 'error' as const,
        transport: transportName(config),
        lastError: message,
        containerId: runtime?.containerId ?? null,
      };
      this.setState(config, failed);
      this.scheduleReconnect(config);
      if (error instanceof RpcError) throw error;
      throw new RpcError(message, RpcErrorCode.McpConnectFailed);
    }
  }

  async disconnect(connectionId: string): Promise<McpConnectionState> {
    await this.connecting.get(connectionId)?.catch(() => undefined);
    return this.disconnectSession(connectionId);
  }

  private async disconnectSession(connectionId: string): Promise<McpConnectionState> {
    this.clearReconnectTimer(connectionId);
    const config = this.getConfig(connectionId);
    const runtime = this.sessions.get(connectionId);
    this.toolAdapter.unregister(connectionId);
    this.rejectPendingInputs(connectionId, new Error('MCP connection disconnected'));
    if (runtime) {
      if (runtime.docker && config.mode === 'docker' && config.docker.stopOnDisconnect) {
        await runtime.docker.stop().catch((error: unknown) => {
          this.appendLog(config, runtime.secrets, {
            at: this.now().toISOString(),
            level: 'warning',
            message: `Unable to stop managed Docker container: ${errorMessage(error)}`,
          });
        });
      }
      await runtime.session.disconnect().catch((error: unknown) => {
        this.appendLog(config, runtime.secrets, {
          at: this.now().toISOString(),
          level: 'warning',
          message: `MCP disconnect failed: ${errorMessage(error)}`,
        });
      });
      this.sessions.delete(connectionId);
    }
    const state = {
      ...this.state(connectionId),
      connectionId,
      status: 'disconnected' as const,
      negotiatedRevision: null,
      transport: null,
      serverInfo: null,
      capabilities: {},
      toolCount: 0,
      lastError: null,
      containerId:
        runtime?.docker && config.mode === 'docker' && !config.docker.stopOnDisconnect
          ? (runtime.containerId ?? null)
          : null,
      legacy: config.mode === 'endpoint' && config.endpoint.transport === 'legacy-sse',
    };
    this.setState(config, state);
    return state;
  }

  async tools(connectionId: string, refresh = false): Promise<ReturnType<typeof toToolsResult>> {
    const config = this.getConfig(connectionId);
    const snapshot = refresh
      ? await this.refreshToolsInternal(connectionId, true)
      : await this.refreshToolsInternal(connectionId, false);
    return toToolsResult(config, snapshot, this.options.tools);
  }

  async classifyTool(
    connectionId: string,
    toolName: string,
    classification: { sideEffects?: SideEffect; executionMode?: ExecutionMode },
  ): Promise<ToolDefinition> {
    const config = this.getConfig(connectionId);
    const source = mcpToolSource(connectionId);
    const toolId = `${config.name}/${toolName}`;
    const current = this.options.tools.get(toolId);
    if (!current || current.definition.source !== source) {
      throw new RpcError(`MCP tool not found: ${toolName}`, RpcErrorCode.McpRequestFailed);
    }
    const currentOverride = this.getToolOverride(connectionId, toolName);
    const sideEffects = classification.sideEffects ?? currentOverride.sideEffects;
    const executionMode = classification.executionMode ?? currentOverride.executionMode;
    if (sideEffects === null && executionMode === null) {
      this.options.database
        .prepare('DELETE FROM mcp_tool_overrides WHERE connection_id = ? AND tool_name = ?')
        .run(connectionId, toolName);
    } else {
      this.options.database
        .prepare(
          `INSERT INTO mcp_tool_overrides
            (connection_id, tool_name, side_effects, execution_mode, updated_at)
           VALUES (?, ?, ?, ?, ?)
           ON CONFLICT(connection_id, tool_name) DO UPDATE SET
             side_effects = excluded.side_effects,
             execution_mode = excluded.execution_mode,
             updated_at = excluded.updated_at`,
        )
        .run(connectionId, toolName, sideEffects, executionMode, this.now().toISOString());
    }
    await this.refreshToolsInternal(connectionId, false);
    const updated = this.options.tools.get(toolId);
    if (!updated)
      throw new RpcError(`MCP tool not found: ${toolName}`, RpcErrorCode.McpRequestFailed);
    return updated.definition;
  }

  answer(connectionId: string, requestId: string, responses: unknown): void {
    const key = inputKey(connectionId, requestId);
    const pending = this.pendingInputs.get(key);
    if (!pending)
      throw new RpcError(
        `MCP input request not found: ${requestId}`,
        RpcErrorCode.McpInputRequestNotFound,
      );
    clearTimeout(pending.timer);
    pending.removeAbort();
    this.pendingInputs.delete(key);
    pending.resolve(responses);
  }

  logEntries(connectionId: string, limit = 200): McpConnectionLogEntry[] {
    this.getConfig(connectionId);
    const rows = this.logs.get(connectionId) ?? [];
    return rows.slice(-Math.max(1, Math.min(limit, 1000))).map((entry) => ({ ...entry }));
  }

  private readConfigs(): McpConnectionConfig[] {
    const rows = this.options.database
      .prepare(
        `SELECT connection_id AS connectionId, name, scope, project_id AS projectId, config
         FROM mcp_connections ORDER BY name`,
      )
      .all<ConnectionRow>();
    return rows.map((row) => this.parseConfig(row.config));
  }

  private getConfig(connectionId: string): McpConnectionConfig {
    const row = this.options.database
      .prepare('SELECT config FROM mcp_connections WHERE connection_id = ?')
      .get<{ config: string }>(connectionId);
    if (!row)
      throw new RpcError(
        `MCP connection not found: ${connectionId}`,
        RpcErrorCode.McpConnectionNotFound,
      );
    return this.parseConfig(row.config);
  }

  private parseConfig(serialized: string): McpConnectionConfig {
    try {
      return compile<McpConnectionConfig>(McpConnectionConfigSchema).assert(JSON.parse(serialized));
    } catch (error) {
      if (error instanceof RpcError) throw error;
      throw new RpcError(
        `Stored MCP connection configuration is invalid: ${errorMessage(error)}`,
        RpcErrorCode.McpRequestFailed,
      );
    }
  }

  private saveConfig(config: McpConnectionConfig): void {
    this.options.database
      .prepare(
        `INSERT INTO mcp_connections (connection_id, name, scope, project_id, config, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT(connection_id) DO UPDATE SET
           name = excluded.name,
           scope = excluded.scope,
           project_id = excluded.project_id,
           config = excluded.config,
           updated_at = excluded.updated_at`,
      )
      .run(
        config.connectionId,
        config.name,
        config.scope,
        config.projectId,
        JSON.stringify(config),
        config.createdAt,
        config.updatedAt,
      );
  }

  private validateScope(config: McpConnectionConfig): void {
    if (config.scope === 'project') {
      if (!config.projectId || !this.options.profile.getById(config.projectId)) {
        throw new RpcError(
          `Project not found: ${config.projectId ?? ''}`,
          RpcErrorCode.ProjectNotFound,
        );
      }
    } else if (config.projectId !== null) {
      throw new RpcError(
        'Platform MCP connections cannot be assigned a Project id',
        RpcErrorCode.InvalidParams,
      );
    }
    validateEndpointSecrets(config);
  }

  private storeCredentials(connectionId: string, credentials: Record<string, string>): void {
    const secrets = new Set(this.secrets.get(connectionId) ?? []);
    for (const [key, value] of Object.entries(credentials)) {
      if (!/^[A-Za-z0-9][A-Za-z0-9_-]{0,63}$/.test(key)) {
        throw new RpcError(`Invalid MCP credential key: ${key}`, RpcErrorCode.InvalidParams);
      }
      this.options.credentials.put(`mcp:${connectionId}:${key}`, value);
      if (value) secrets.add(value);
    }
    this.secrets.set(connectionId, [...secrets]);
  }

  private resolveCredential(connectionId: string, value: string, secretValues: string[]): string {
    return value.replace(/\$\{cred:([^}]+)\}/g, (_match, key: string) => {
      if (!credentialKeyPattern.test(key)) {
        throw new RpcError(
          `Invalid MCP credential reference key: ${key}`,
          RpcErrorCode.InvalidParams,
        );
      }
      const ref = `mcp:${connectionId}:${key}`;
      const secret = this.options.credentials.get(ref);
      if (secret === undefined) {
        throw new RpcError(
          `Missing MCP credential reference: ${key}`,
          RpcErrorCode.McpConnectFailed,
        );
      }
      if (secret) {
        secretValues.push(secret);
        this.secrets.set(connectionId, [
          ...new Set([...(this.secrets.get(connectionId) ?? []), secret]),
        ]);
      }
      return secret;
    });
  }

  private async createTransport(
    config: McpConnectionConfig,
    secretValues: string[],
  ): Promise<{ transport: McpTransport; docker?: DockerRuntime }> {
    const project =
      config.scope === 'project' && config.projectId
        ? this.options.profile.getById(config.projectId)
        : undefined;
    if (config.mode === 'command') {
      return {
        transport: new StdioTransport({
          command: this.resolveCredential(
            config.connectionId,
            config.command.command,
            secretValues,
          ),
          args: config.command.args.map((argument) =>
            this.resolveCredential(config.connectionId, argument, secretValues),
          ),
          cwd: config.command.cwd
            ? this.resolveCredential(config.connectionId, config.command.cwd, secretValues)
            : project?.path,
          env: resolveStringRecord(config.connectionId, config.command.env, (value) =>
            this.resolveCredential(config.connectionId, value, secretValues),
          ),
          onStderr: (message) =>
            this.appendLog(config, secretValues, {
              at: this.now().toISOString(),
              level: 'warning',
              message,
            }),
        }),
      };
    }
    if (config.mode === 'endpoint') {
      const url = this.resolveCredential(config.connectionId, config.endpoint.url, secretValues);
      const headers = resolveStringRecord(config.connectionId, config.endpoint.headers, (value) =>
        this.resolveCredential(config.connectionId, value, secretValues),
      );
      const transport =
        config.endpoint.transport === 'legacy-sse'
          ? new LegacySseTransport({
              url,
              headers,
              requestTimeoutMs: config.timeoutsMs.request,
            })
          : new StreamableHttpTransport({
              url,
              connectionName: config.name,
              headers,
              requestTimeoutMs: config.timeoutsMs.request,
              onStreamClosed: (error) =>
                this.appendLog(config, secretValues, {
                  at: this.now().toISOString(),
                  level: error ? 'warning' : 'info',
                  message: error?.message ?? 'MCP event stream closed',
                }),
            });
      return { transport };
    }

    const resolvedEnv = resolveStringRecord(config.connectionId, config.docker.env, (value) =>
      this.resolveCredential(config.connectionId, value, secretValues),
    );
    const docker = await createDockerRuntime({
      connectionId: config.connectionId,
      connectionName: config.name,
      docker: {
        ...config.docker,
        command: config.docker.command.map((argument) =>
          this.resolveCredential(config.connectionId, argument, secretValues),
        ),
        env: resolvedEnv,
      },
      env: resolvedEnv,
      connectTimeoutMs: config.timeoutsMs.connect,
      requestTimeoutMs: config.timeoutsMs.request,
      dockerBinary: this.options.dockerBinary,
      onStderr: (message) =>
        this.appendLog(config, secretValues, {
          at: this.now().toISOString(),
          level: 'warning',
          message,
        }),
    });
    return { transport: docker.transport, docker };
  }

  private state(connectionId: string, config?: McpConnectionConfig): McpConnectionState {
    return (
      this.states.get(connectionId) ?? {
        ...disconnectedState(connectionId),
        legacy: config?.mode === 'endpoint' && config.endpoint.transport === 'legacy-sse',
      }
    );
  }

  private setState(config: McpConnectionConfig, state: McpConnectionState): void {
    const safeState = {
      ...state,
      connectionId: config.connectionId,
      lastError:
        state.lastError === null ? null : this.redact(config.connectionId, state.lastError),
    };
    this.states.set(config.connectionId, safeState);
    this.options.events.stateChanged(safeState);
  }

  private onSessionState(
    config: McpConnectionConfig,
    state: McpConnectionState,
    secretValues: string[],
  ): void {
    const runtime = this.sessions.get(config.connectionId);
    const next = {
      ...state,
      containerId: state.containerId ?? runtime?.containerId ?? null,
      lastError:
        state.lastError === null ? null : this.redact(config.connectionId, state.lastError),
    };
    this.states.set(config.connectionId, next);
    this.options.events.stateChanged(next);
    if (next.status === 'error') this.scheduleReconnect(config);
    void secretValues;
  }

  private autoConnect(config: McpConnectionConfig): boolean {
    const projectId = config.scope === 'project' ? (config.projectId ?? undefined) : undefined;
    return Boolean(this.options.settings.resolve('mcp.autoConnect', { projectId }).value);
  }

  private scheduleReconnect(config: McpConnectionConfig): void {
    if (
      this.stopped ||
      !config.enabled ||
      !this.autoConnect(config) ||
      this.reconnectTimers.has(config.connectionId)
    ) {
      return;
    }
    const seconds = Number(this.options.settings.resolve('mcp.reconnectBackoffSeconds').value);
    const delayMs = Math.max(0, Number.isFinite(seconds) ? seconds : 10) * 1000;
    const timer = setTimeout(() => {
      this.reconnectTimers.delete(config.connectionId);
      void this.connect(config.connectionId).catch(() => undefined);
    }, delayMs);
    timer.unref?.();
    this.reconnectTimers.set(config.connectionId, timer);
  }

  private clearReconnectTimer(connectionId: string): void {
    const timer = this.reconnectTimers.get(connectionId);
    if (timer) clearTimeout(timer);
    this.reconnectTimers.delete(connectionId);
  }

  private async refreshToolsInternal(
    connectionId: string,
    force: boolean,
  ): Promise<McpToolsSnapshot> {
    const config = this.getConfig(connectionId);
    const runtime = this.sessions.get(connectionId);
    if (!runtime)
      throw new RpcError(
        `MCP connection is not connected: ${connectionId}`,
        RpcErrorCode.McpConnectFailed,
      );
    try {
      const snapshot = force
        ? await runtime.session.refreshTools()
        : await runtime.session.listTools();
      this.registerTools(config, runtime, snapshot);
      return snapshot;
    } catch (error) {
      if (error instanceof RpcError) throw error;
      throw new RpcError(errorMessage(error), RpcErrorCode.McpRequestFailed);
    }
  }

  private registerTools(
    config: McpConnectionConfig,
    runtime: McpRuntime,
    snapshot: McpToolsSnapshot,
  ): void {
    this.toolAdapter.register(
      config,
      snapshot.tools,
      (toolName) => this.getToolOverride(config.connectionId, toolName),
      (toolName, input, context) =>
        runtime.session.callTool(toolName, input, {
          projectId: context.projectId,
          taskId: context.taskId ?? undefined,
          signal: context.signal,
        }),
    );
  }

  private getToolOverride(connectionId: string, toolName: string): ToolOverrideRow {
    return (
      this.options.database
        .prepare(
          `SELECT side_effects AS sideEffects, execution_mode AS executionMode
           FROM mcp_tool_overrides WHERE connection_id = ? AND tool_name = ?`,
        )
        .get<ToolOverrideRow>(connectionId, toolName) ?? { sideEffects: null, executionMode: null }
    );
  }

  private async askForInput(
    config: McpConnectionConfig,
    requestId: string,
    requests: unknown[],
    projectId: string | null,
    taskId: string | null,
    signal?: AbortSignal,
  ): Promise<unknown> {
    if (taskId && projectId) {
      const responses: Record<string, unknown> = {};
      for (let index = 0; index < requests.length; index += 1) {
        const request = requests[index];
        const record = isRecord(request) ? request : {};
        const id = typeof record.id === 'string' ? record.id : String(index);
        responses[id] = await this.options.tasks.askQuestion(
          projectId,
          taskId,
          inputPrompt(record),
          inputOptions(record),
          signal,
        );
      }
      return responses;
    }
    const key = inputKey(config.connectionId, requestId);
    if (this.pendingInputs.has(key)) {
      throw new RpcError(
        `MCP input request is already pending: ${requestId}`,
        RpcErrorCode.McpInputRequestNotFound,
      );
    }
    let resolveResponses: (value: unknown) => void = () => undefined;
    let rejectResponses: (error: Error) => void = () => undefined;
    const result = new Promise<unknown>((resolve, reject) => {
      resolveResponses = resolve;
      rejectResponses = reject;
    });
    const timeout = setTimeout(() => {
      this.pendingInputs.delete(key);
      rejectResponses(new RpcError('MCP input request timed out', RpcErrorCode.McpRequestFailed));
    }, config.timeoutsMs.request);
    timeout.unref?.();
    const onAbort = () => {
      clearTimeout(timeout);
      this.pendingInputs.delete(key);
      rejectResponses(new Error('MCP input request cancelled'));
    };
    signal?.addEventListener('abort', onAbort, { once: true });
    this.pendingInputs.set(key, {
      resolve: resolveResponses,
      reject: rejectResponses,
      timer: timeout,
      removeAbort: () => signal?.removeEventListener('abort', onAbort),
    });
    this.options.events.inputRequired({
      connectionId: config.connectionId,
      requestId,
      requests,
      taskId: null,
    });
    return result;
  }

  private rejectPendingInputs(connectionId: string, error: Error): void {
    for (const [key, pending] of this.pendingInputs) {
      if (!key.startsWith(`${connectionId}:`)) continue;
      clearTimeout(pending.timer);
      pending.removeAbort();
      this.pendingInputs.delete(key);
      pending.reject(error);
    }
  }

  private async handleSampling(
    config: McpConnectionConfig,
    params: unknown,
    context: { projectId: string | null; taskId: string | null; signal?: AbortSignal },
  ): Promise<unknown> {
    const request = isRecord(params) ? params : {};
    const messages = Array.isArray(request.messages) ? request.messages.map(toChatMessage) : [];
    if (messages.length === 0) {
      throw new McpProtocolError('Sampling request has no messages', RpcErrorCode.McpRequestFailed);
    }
    if (typeof request.systemPrompt === 'string') {
      messages.unshift({ role: 'system', content: request.systemPrompt });
    }
    const projectId = context.projectId ?? config.projectId ?? undefined;
    const response = await this.options.completion.complete(
      {
        route: {
          ...(projectId ? { projectId } : {}),
          agentRole: config.name,
          taskType: 'mcp-sampling',
        },
        request: {
          messages,
          maxTokens: typeof request.maxTokens === 'number' ? request.maxTokens : undefined,
          temperature: typeof request.temperature === 'number' ? request.temperature : undefined,
        },
        ...(projectId ? { projectId } : {}),
        ...(context.taskId ? { taskId: context.taskId } : {}),
      },
      { signal: context.signal },
    );
    this.options.database
      .prepare(
        `INSERT INTO mcp_usage
          (usage_id, connection_id, task_id, decision_id, model_id, cost_usd, recorded_at,
           cost_status)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        uuidv7(),
        config.connectionId,
        context.taskId,
        response.decisionId,
        response.modelId,
        response.usage.costUsd ?? 0,
        this.now().toISOString(),
        response.usage.costStatus ?? (response.usage.costUsd === null ? 'unknown' : 'known'),
      );
    const stopReason = response.finishReason === 'length' ? 'maxTokens' : 'endTurn';
    return {
      role: 'assistant',
      content: { type: 'text', text: response.content },
      model: response.modelId,
      stopReason,
    };
  }

  private projectRoot(config: McpConnectionConfig): { uri: string; name: string } | undefined {
    if (config.scope !== 'project' || !config.projectId) return undefined;
    const project = this.options.profile.getById(config.projectId);
    return project
      ? { uri: pathToFileURL(project.path).toString(), name: project.name }
      : undefined;
  }

  private appendLog(
    config: McpConnectionConfig,
    secrets: string[],
    entry: McpConnectionLogEntry,
  ): void {
    const rows = this.logs.get(config.connectionId) ?? [];
    rows.push({ ...entry, message: redactSecretValues(entry.message, secrets) });
    if (rows.length > 200) rows.splice(0, rows.length - 200);
    this.logs.set(config.connectionId, rows);
  }

  private redact(connectionId: string, message: string): string {
    return redactSecretValues(message, this.secrets.get(connectionId) ?? []);
  }
}

function normalizeConfig(
  input: McpConnectionInput,
  connectionId: string,
  now: Date,
): McpConnectionConfig {
  const value = {
    ...input,
    connectionId,
    allowServerInitiatedModelCalls: input.allowServerInitiatedModelCalls ?? false,
    enabled: input.enabled ?? true,
    timeoutsMs: {
      connect: input.timeoutsMs?.connect ?? 15_000,
      request: input.timeoutsMs?.request ?? 60_000,
    },
    tags: input.tags ?? [],
    createdAt: now.toISOString(),
    updatedAt: now.toISOString(),
  };
  return compile<McpConnectionConfig>(McpConnectionConfigSchema).assert(value);
}

function mergeConfig(
  current: McpConnectionConfig,
  patch: McpConnectionPatch,
  now: Date,
): McpConnectionConfig {
  const merged: Record<string, unknown> = { ...current, ...patch, updatedAt: now.toISOString() };
  merged.timeoutsMs = { ...current.timeoutsMs, ...patch.timeoutsMs };
  if (patch.mode && patch.mode !== current.mode) {
    delete merged.command;
    delete merged.endpoint;
    delete merged.docker;
    if (patch.mode === 'command' && patch.command) merged.command = patch.command;
    if (patch.mode === 'endpoint' && patch.endpoint) merged.endpoint = patch.endpoint;
    if (patch.mode === 'docker' && patch.docker) merged.docker = patch.docker;
  } else if (patch.mode === current.mode) {
    if (current.mode === 'command' && patch.command) {
      merged.command = { ...current.command, ...patch.command };
    } else if (current.mode === 'endpoint' && patch.endpoint) {
      merged.endpoint = { ...current.endpoint, ...patch.endpoint };
    } else if (current.mode === 'docker' && patch.docker) {
      merged.docker = { ...current.docker, ...patch.docker };
    }
  }
  return compile<McpConnectionConfig>(McpConnectionConfigSchema).assert(merged);
}

function disconnectedState(connectionId: string): McpConnectionState {
  return {
    connectionId,
    status: 'disconnected',
    negotiatedRevision: null,
    transport: null,
    serverInfo: null,
    capabilities: {},
    toolCount: 0,
    lastError: null,
    lastConnectedAt: null,
    containerId: null,
    legacy: false,
  };
}

function transportName(config: McpConnectionConfig): string {
  if (config.mode === 'command') return 'stdio';
  if (config.mode === 'endpoint') return config.endpoint.transport;
  return config.docker.transport;
}

function mcpToolSource(connectionId: string): string {
  return `mcp:${connectionId}`;
}

function inputKey(connectionId: string, requestId: string): string {
  return `${connectionId}:${requestId}`;
}

function resolveStringRecord(
  connectionId: string,
  values: Record<string, string>,
  resolve: (value: string) => string,
): Record<string, string> {
  return Object.fromEntries(Object.entries(values).map(([key, value]) => [key, resolve(value)]));
}

function validateEndpointSecrets(config: McpConnectionConfig): void {
  if (config.mode !== 'endpoint') return;
  const endpoint = new URL(config.endpoint.url);
  if (endpoint.username || endpoint.password) {
    throw new RpcError(
      'MCP endpoint URLs must not contain credentials; use credential references in headers.',
      RpcErrorCode.InvalidParams,
    );
  }
  for (const [key, value] of endpoint.searchParams) {
    if (/auth|token|secret|password|api[_-]?key/i.test(key) && !isCredentialReference(value)) {
      throw new RpcError(
        `MCP endpoint query parameter ${key} must use a credential reference.`,
        RpcErrorCode.InvalidParams,
      );
    }
  }
}

const credentialKeyPattern = /^[A-Za-z0-9][A-Za-z0-9_-]{0,63}$/;

function validateCredentialMap(credentials: Record<string, string>): void {
  for (const key of Object.keys(credentials)) {
    if (!credentialKeyPattern.test(key)) {
      throw new RpcError(`Invalid MCP credential key: ${key}`, RpcErrorCode.InvalidParams);
    }
  }
}

function validateCredentialReferences(config: McpConnectionConfig): void {
  const variables =
    config.mode === 'command'
      ? config.command.env
      : config.mode === 'endpoint'
        ? config.endpoint.headers
        : config.docker.env;
  for (const [name, value] of Object.entries(variables)) {
    if (
      /auth|token|secret|password|api[_-]?key|credential/i.test(name) &&
      !value.includes('${cred:')
    ) {
      throw new RpcError(
        `MCP credential-like value ${name} must use a credential reference.`,
        RpcErrorCode.InvalidParams,
      );
    }
  }

  for (const value of credentialReferenceValues(config)) {
    const matches = [...value.matchAll(/\$\{cred:([^}]+)\}/g)];
    for (const match of matches) {
      if (!credentialKeyPattern.test(match[1])) {
        throw new RpcError(
          `Invalid MCP credential reference key: ${match[1]}`,
          RpcErrorCode.InvalidParams,
        );
      }
    }
    if (value.replace(/\$\{cred:[^}]*\}/g, '').includes('${cred:')) {
      throw new RpcError('Malformed MCP credential reference.', RpcErrorCode.InvalidParams);
    }
  }

  if (config.mode === 'docker' && config.docker.image.includes('${cred:')) {
    throw new RpcError(
      'MCP credentials cannot be used in a Docker image name.',
      RpcErrorCode.InvalidParams,
    );
  }
}

function credentialReferenceValues(config: McpConnectionConfig): string[] {
  if (config.mode === 'command') {
    return [
      config.command.command,
      ...config.command.args,
      ...(config.command.cwd ? [config.command.cwd] : []),
      ...Object.values(config.command.env),
    ];
  }
  if (config.mode === 'endpoint') {
    return [config.endpoint.url, ...Object.values(config.endpoint.headers)];
  }
  return [...config.docker.command, ...Object.values(config.docker.env)];
}

function isCredentialReference(value: string): boolean {
  const match = /^\$\{cred:([^}]+)\}$/.exec(value);
  return match !== null && credentialKeyPattern.test(match[1]);
}

function inputPrompt(request: Record<string, unknown>): string {
  const prompt = request.prompt ?? request.message ?? request.title;
  if (typeof prompt === 'string' && prompt.trim()) return prompt;
  return `MCP server requires input: ${JSON.stringify(request)}`;
}

function inputOptions(request: Record<string, unknown>): string[] | null {
  const options = Array.isArray(request.options)
    ? request.options
    : Array.isArray(request.choices)
      ? request.choices
      : null;
  if (!options) return null;
  const values = options
    .map((item) =>
      typeof item === 'string'
        ? item
        : isRecord(item) && typeof item.title === 'string'
          ? item.title
          : '',
    )
    .filter(Boolean);
  return values.length > 0 ? values : null;
}

function toToolsResult(
  config: McpConnectionConfig,
  snapshot: McpToolsSnapshot,
  registry: ToolRegistry,
): { tools: ToolDefinition[]; revision: McpRevision; cachedAt: string; ttlMs: number | null } {
  const source = mcpToolSource(config.connectionId);
  return {
    tools: registry.list().filter((tool) => tool.source === source),
    revision: snapshot.revision,
    cachedAt: snapshot.cachedAt,
    ttlMs: snapshot.ttlMs,
  };
}

function toChatMessage(message: unknown): ChatMessage {
  if (!isRecord(message) || (message.role !== 'user' && message.role !== 'assistant')) {
    throw new McpProtocolError(
      'Unsupported MCP sampling message role',
      RpcErrorCode.McpRequestFailed,
    );
  }
  const content =
    typeof message.content === 'string'
      ? message.content
      : isRecord(message.content) &&
          message.content.type === 'text' &&
          typeof message.content.text === 'string'
        ? message.content.text
        : Array.isArray(message.content)
          ? message.content
              .map((block) => {
                if (!isRecord(block) || block.type !== 'text' || typeof block.text !== 'string') {
                  throw new McpProtocolError(
                    'MCP sampling content must be text',
                    RpcErrorCode.McpRequestFailed,
                  );
                }
                return block.text;
              })
              .join('\n')
          : null;
  if (content === null)
    throw new McpProtocolError(
      'Invalid MCP sampling message content',
      RpcErrorCode.McpRequestFailed,
    );
  return { role: message.role, content };
}

function redactSecretValues(message: string, secrets: string[]): string {
  let redacted = message;
  for (const secret of [...secrets].sort((left, right) => right.length - left.length)) {
    if (secret) redacted = redacted.split(secret).join('[REDACTED]');
  }
  return redacted;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

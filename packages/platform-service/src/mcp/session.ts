import {
  MCP_SUPPORTED_REVISIONS,
  RpcError,
  RpcErrorCode,
  uuidv7,
  type McpConnectionConfig,
  type McpConnectionState,
  type McpRevision,
} from '@gamecrafter/contracts';
import { JsonRpcChannel } from '../ipc/jsonrpc-channel';
import { JsonRpcProtocolError, JsonRpcTransportError } from '../ipc/types';
import { McpProtocolError, type McpLogEntry, type McpTransport } from './types';

export interface McpToolDescriptor {
  name: string;
  title?: string;
  description?: string;
  inputSchema: unknown;
  outputSchema?: unknown;
  annotations?: Record<string, unknown>;
}

export interface McpToolsSnapshot {
  tools: McpToolDescriptor[];
  revision: McpRevision;
  cachedAt: string;
  ttlMs: number | null;
}

export interface McpSessionInteractions {
  onInputRequired?: (
    requestId: string,
    requests: unknown[],
    projectId: string | null,
    taskId: string | null,
    signal?: AbortSignal,
  ) => Promise<unknown>;
  onSampling?: (
    params: unknown,
    context: { projectId: string | null; taskId: string | null; signal?: AbortSignal },
  ) => Promise<unknown>;
  projectRoot?: () => { uri: string; name: string } | undefined;
  log?: (entry: McpLogEntry) => void;
  toolsInvalidated?: () => void;
  stateChanged?: (state: McpConnectionState) => void;
}

export interface McpSessionOptions {
  config: McpConnectionConfig;
  transport: McpTransport;
  clientInfo: { name: string; version: string };
  interactions?: McpSessionInteractions;
  now?: () => Date;
  containerId?: string | null;
}

interface ActiveToolCall {
  projectId: string | null;
  taskId: string | null;
  signal?: AbortSignal;
}

export class McpSession {
  readonly connectionId: string;
  private readonly channel: JsonRpcChannel;
  private readonly now: () => Date;
  private readonly interactions: McpSessionInteractions;
  private stateValue: McpConnectionState;
  private revision?: McpRevision;
  private cachedTools?: McpToolsSnapshot;
  private cacheExpiresAt?: number;
  private toolsGeneration = 0;
  private pendingTools?: Promise<{ result: unknown; generation: number }>;
  private activeToolCall?: ActiveToolCall;
  private toolCallQueue: Promise<void> = Promise.resolve();

  constructor(private readonly options: McpSessionOptions) {
    this.connectionId = options.config.connectionId;
    this.now = options.now ?? (() => new Date());
    this.interactions = options.interactions ?? {};
    this.channel = new JsonRpcChannel(options.transport, options.config.timeoutsMs.request);
    options.transport.setStreamClosedHandler?.((error) => {
      this.invalidateTools();
      this.log(
        'warning',
        error?.message ?? 'MCP event stream closed; tools will refresh on next use',
      );
    });
    this.stateValue = {
      connectionId: this.connectionId,
      status: 'disconnected',
      negotiatedRevision: null,
      transport: options.transport.kind,
      serverInfo: null,
      capabilities: {},
      toolCount: 0,
      lastError: null,
      lastConnectedAt: null,
      containerId: options.containerId ?? null,
      legacy: options.transport.legacy,
    };
    this.channel.onConnectionError((error) => {
      if (this.stateValue.status !== 'connected') return;
      this.invalidateTools();
      this.log('error', `MCP transport disconnected: ${error.message}`);
      this.updateState({ status: 'error', lastError: error.message });
    });
    this.channel.onNotification('notifications/tools/list_changed', () => this.invalidateTools());
    this.channel.onNotification('notifications/message', (params) => this.recordServerLog(params));
    this.channel.onRequest('roots/list', () => this.listRoots());
    this.channel.onRequest('ping', () => ({}));
    this.channel.onRequest('logging/setLevel', () => ({}));
    this.channel.onRequest('sampling/createMessage', (params) => this.handleSampling(params));
    this.channel.onRequest('elicitation/create', (params, requestId) =>
      this.handleElicitation(params, requestId),
    );
  }

  get state(): McpConnectionState {
    return {
      ...this.stateValue,
      serverInfo: this.stateValue.serverInfo ? { ...this.stateValue.serverInfo } : null,
    };
  }

  async connect(): Promise<McpConnectionState> {
    if (this.stateValue.status === 'connected') return this.state;
    this.updateState({ status: 'connecting', lastError: null });
    try {
      await this.channel.start();
      const discovery = await this.discoverOrInitialize();
      this.revision = discovery.revision;
      this.options.transport.configure?.(discovery.revision, null, this.options.config.name);
      if (discovery.initialized) await this.channel.notify('notifications/initialized');
      this.updateState({
        status: 'connected',
        negotiatedRevision: discovery.revision,
        transport: this.options.transport.kind,
        serverInfo: discovery.serverInfo,
        capabilities: discovery.capabilities,
        lastError: null,
        lastConnectedAt: this.now().toISOString(),
        legacy: this.options.transport.legacy || discovery.initialized,
      });
      await this.listTools(true);
      this.beginSubscriptions();
      return this.state;
    } catch (error) {
      const failure = this.connectionError(error);
      this.updateState({ status: 'error', lastError: failure.message });
      await this.channel.close().catch(() => undefined);
      throw failure;
    }
  }

  async disconnect(): Promise<McpConnectionState> {
    this.toolsGeneration += 1;
    this.cachedTools = undefined;
    this.cacheExpiresAt = undefined;
    await this.channel.close();
    this.updateState({
      status: 'disconnected',
      negotiatedRevision: null,
      serverInfo: null,
      capabilities: {},
      toolCount: 0,
      lastError: null,
    });
    this.revision = undefined;
    return this.state;
  }

  async listTools(force = false): Promise<McpToolsSnapshot> {
    this.requireConnected();
    if (
      !force &&
      this.cachedTools &&
      (this.cacheExpiresAt === undefined || this.now().getTime() < this.cacheExpiresAt)
    ) {
      return cloneToolsSnapshot(this.cachedTools);
    }
    for (let attempt = 0; attempt < 3; attempt += 1) {
      this.requireConnected();
      const { result, generation } = await this.requestTools();
      this.requireConnected();
      // An older response must not restore an invalidated cache or reach the broker.
      if (generation !== this.toolsGeneration) continue;
      if (!isRecord(result) || !Array.isArray(result.tools)) {
        throw new RpcError(
          'MCP tools/list returned an invalid result',
          RpcErrorCode.McpRequestFailed,
        );
      }
      const tools = result.tools
        .map(parseToolDescriptor)
        .sort((left, right) => left.name.localeCompare(right.name));
      const ttlMs =
        typeof result.ttlMs === 'number' && Number.isFinite(result.ttlMs)
          ? Math.max(0, Math.floor(result.ttlMs))
          : null;
      const snapshot: McpToolsSnapshot = {
        tools,
        revision: this.revision!,
        cachedAt: this.now().toISOString(),
        ttlMs,
      };
      this.cachedTools = snapshot;
      this.cacheExpiresAt = ttlMs === null ? undefined : this.now().getTime() + ttlMs;
      this.updateState({ toolCount: tools.length });
      return cloneToolsSnapshot(snapshot);
    }
    throw new RpcError(
      'MCP tools changed repeatedly during discovery; retry tool discovery',
      RpcErrorCode.McpRequestFailed,
    );
  }

  private async requestTools(): Promise<{ result: unknown; generation: number }> {
    if (this.pendingTools) return this.pendingTools;
    // Install the shared promise before sending, even when a transport can
    // synchronously deliver notifications. Each caller checks the generation
    // after awaiting, so settlement cannot resurrect an invalidated response.
    const pending = Promise.resolve().then(async () => {
      this.requireConnected();
      const generation = this.toolsGeneration;
      const result = await this.channel.request('tools/list', this.paramsForRevision({}));
      return { result, generation };
    });
    this.pendingTools = pending;
    try {
      return await pending;
    } finally {
      this.pendingTools = undefined;
    }
  }

  async refreshTools(): Promise<McpToolsSnapshot> {
    return this.listTools(true);
  }

  async callTool(
    name: string,
    args: unknown,
    options: { projectId?: string; taskId?: string; signal?: AbortSignal } = {},
  ): Promise<unknown> {
    this.requireConnected();
    return this.withToolCallLock(async () => {
      const activeCall: ActiveToolCall = {
        projectId: options.projectId ?? this.options.config.projectId,
        taskId: options.taskId ?? null,
        signal: options.signal,
      };
      this.activeToolCall = activeCall;
      try {
        let requestParams: Record<string, unknown> = { name, arguments: args };
        let requestState: unknown;
        for (let attempt = 0; attempt < 8; attempt += 1) {
          const params = this.paramsForRevision(requestParams);
          const result = await this.channel.request('tools/call', params, {
            signal: options.signal,
          });
          if (!isRecord(result) || result.resultType !== 'input_required') return result;
          const inputRequests = Array.isArray(result.inputRequests) ? result.inputRequests : [];
          if (!this.interactions.onInputRequired) {
            throw new RpcError(
              `MCP tool ${name} requires user input but no input handler is available`,
              RpcErrorCode.McpRequestFailed,
            );
          }
          requestState = result.requestState;
          const responses = await this.interactions.onInputRequired(
            uuidv7(),
            inputRequests,
            activeCall.projectId,
            activeCall.taskId,
            options.signal,
          );
          requestParams = {
            name,
            arguments: args,
            inputResponses: responses,
            ...(requestState === undefined ? {} : { requestState }),
          };
        }
        throw new RpcError(
          `MCP tool ${name} exceeded the input request limit`,
          RpcErrorCode.McpRequestFailed,
        );
      } finally {
        if (this.activeToolCall === activeCall) this.activeToolCall = undefined;
      }
    });
  }

  private async discoverOrInitialize(): Promise<{
    revision: McpRevision;
    serverInfo: McpConnectionState['serverInfo'];
    capabilities: unknown;
    initialized: boolean;
  }> {
    this.options.transport.configure?.('2026-07-28', null, this.options.config.name);
    try {
      const discovery = await this.channel.request(
        'server/discover',
        {
          _meta: {
            'io.modelcontextprotocol/protocolVersion': '2026-07-28',
            clientCapabilities: this.clientCapabilities(),
          },
        },
        { timeoutMs: this.options.config.timeoutsMs.connect },
      );
      const record = asRecord(discovery);
      const revision = chooseRevision(
        record.protocolVersions ?? record.supportedProtocolVersions ?? record.versions,
      );
      if (!revision) {
        throw new RpcError(
          'MCP server does not advertise a supported protocol revision',
          RpcErrorCode.McpUnsupportedProtocolVersion,
        );
      }
      const initialized = revision !== '2026-07-28';
      if (initialized) {
        const legacy = await this.initialize(revision);
        return { ...legacy, initialized: true };
      }
      return {
        revision,
        serverInfo: serverInfo(record.serverInfo),
        capabilities: record.capabilities ?? {},
        initialized: false,
      };
    } catch (error) {
      if (isProtocolError(error, -32022)) {
        throw new RpcError(error.message, RpcErrorCode.McpUnsupportedProtocolVersion);
      }
      const httpStatus =
        error instanceof JsonRpcProtocolError || error instanceof JsonRpcTransportError
          ? error.httpStatus
          : undefined;
      const shouldFallback =
        isProtocolError(error, -32601) ||
        isProtocolError(error, -32000) ||
        isProtocolError(error, -32600) ||
        isProtocolError(error, -32602) ||
        (httpStatus !== undefined && [400, 404, 405, 406, 415].includes(httpStatus)) ||
        (this.options.transport.kind === 'stdio' &&
          error instanceof JsonRpcTransportError &&
          httpStatus === undefined);
      if (!shouldFallback) throw error;
      const fallback = await this.initialize('2025-11-25');
      return { ...fallback, initialized: true };
    }
  }

  private async initialize(version: McpRevision): Promise<{
    revision: McpRevision;
    serverInfo: McpConnectionState['serverInfo'];
    capabilities: unknown;
  }> {
    this.options.transport.configure?.(null, null, this.options.config.name);
    const result = await this.channel.request(
      'initialize',
      {
        protocolVersion: version,
        capabilities: this.clientCapabilities(),
        clientInfo: this.options.clientInfo,
      },
      { timeoutMs: this.options.config.timeoutsMs.connect },
    );
    const record = asRecord(result);
    const serverVersion = typeof record.protocolVersion === 'string' ? record.protocolVersion : '';
    if (!isSupportedRevision(serverVersion)) {
      throw new RpcError(
        `MCP server negotiated an unsupported protocol revision: ${serverVersion || '(missing)'}`,
        RpcErrorCode.McpUnsupportedProtocolVersion,
      );
    }
    this.options.transport.configure?.(serverVersion, null, this.options.config.name);
    return {
      revision: serverVersion,
      serverInfo: serverInfo(record.serverInfo),
      capabilities: record.capabilities ?? {},
    };
  }

  private paramsForRevision(params: Record<string, unknown>): Record<string, unknown> {
    if (this.revision !== '2026-07-28') return params;
    return {
      ...params,
      _meta: {
        'io.modelcontextprotocol/protocolVersion': this.revision,
        clientCapabilities: this.clientCapabilities(),
      },
    };
  }

  private clientCapabilities(): Record<string, unknown> {
    return {
      tools: { listChanged: true },
      sampling: {},
      roots: { listChanged: false },
      elicitation: { form: {} },
    };
  }

  private beginSubscriptions(): void {
    const capabilities = asRecord(this.stateValue.capabilities);
    const toolsCapabilities = isRecord(capabilities.tools) ? capabilities.tools : {};
    if (this.revision === '2026-07-28') {
      void this.channel
        .request(
          'subscriptions/listen',
          this.paramsForRevision({ subscriptions: ['toolsListChanged'] }),
          {
            timeoutMs: this.options.config.timeoutsMs.connect,
          },
        )
        .catch((error: unknown) =>
          this.log('warning', `MCP subscriptions/listen unavailable: ${errorMessage(error)}`),
        );
      return;
    }
    if (
      this.options.transport.kind === 'streamable-http' &&
      toolsCapabilities.listChanged === true
    ) {
      void this.options.transport
        .openNotificationStream?.(['notifications/tools/list_changed'])
        .catch((error: unknown) =>
          this.log('warning', `MCP event stream unavailable: ${errorMessage(error)}`),
        );
    }
  }

  private invalidateTools(): void {
    this.toolsGeneration += 1;
    this.cachedTools = undefined;
    this.cacheExpiresAt = undefined;
    this.interactions.toolsInvalidated?.();
  }

  private async handleSampling(params: unknown): Promise<unknown> {
    if (!this.options.config.allowServerInitiatedModelCalls) {
      this.log('warning', 'Refused server-initiated sampling/createMessage');
      throw new McpProtocolError(
        'Server-initiated model calls are disabled',
        RpcErrorCode.McpSamplingRefused,
      );
    }
    if (!this.interactions.onSampling) {
      throw new McpProtocolError(
        'MCP sampling handler is unavailable',
        RpcErrorCode.McpSamplingRefused,
      );
    }
    return this.interactions.onSampling(params, {
      projectId: this.activeToolCall?.projectId ?? this.options.config.projectId,
      taskId: this.activeToolCall?.taskId ?? null,
      signal: this.activeToolCall?.signal,
    });
  }

  private async handleElicitation(params: unknown, requestId: string | number): Promise<unknown> {
    if (!this.interactions.onInputRequired) {
      throw new McpProtocolError(
        'MCP elicitation handler is unavailable',
        RpcErrorCode.McpRequestFailed,
      );
    }
    const inputRequests = elicitationInputRequests(params);
    const response = await this.interactions.onInputRequired(
      String(requestId),
      inputRequests,
      this.activeToolCall?.projectId ?? this.options.config.projectId,
      this.activeToolCall?.taskId ?? null,
      this.activeToolCall?.signal,
    );
    if (isRecord(response) && typeof response.action === 'string') return response;
    return { action: 'accept', content: response };
  }

  private listRoots(): unknown {
    if (this.options.config.scope !== 'project') return { roots: [] };
    const root = this.interactions.projectRoot?.();
    return { roots: root ? [root] : [] };
  }

  private recordServerLog(params: unknown): void {
    const record = isRecord(params) ? params : {};
    const rawLevel = record.level;
    const level = isLogLevel(rawLevel) ? rawLevel : 'info';
    const message =
      typeof record.data === 'string' ? record.data : JSON.stringify(record.data ?? record);
    this.log(level, message);
  }

  private log(level: McpLogEntry['level'], message: string): void {
    this.interactions.log?.({ at: this.now().toISOString(), level, message });
  }

  private updateState(patch: Partial<McpConnectionState>): void {
    const next = { ...this.stateValue, ...patch };
    if (JSON.stringify(next) === JSON.stringify(this.stateValue)) return;
    this.stateValue = next;
    this.interactions.stateChanged?.(this.state);
  }

  private requireConnected(): void {
    if (this.stateValue.status !== 'connected' || !this.revision) {
      throw new RpcError('MCP connection is not connected', RpcErrorCode.McpConnectFailed);
    }
  }

  private connectionError(error: unknown): RpcError {
    if (error instanceof RpcError) return error;
    if (error instanceof JsonRpcProtocolError && error.code === -32022) {
      return new RpcError(error.message, RpcErrorCode.McpUnsupportedProtocolVersion);
    }
    return new RpcError(
      errorMessage(error),
      RpcErrorCode.McpConnectFailed,
      error instanceof JsonRpcProtocolError
        ? { serverCode: error.code, data: error.data }
        : undefined,
    );
  }

  private async withToolCallLock<T>(operation: () => Promise<T>): Promise<T> {
    const previous = this.toolCallQueue;
    let release: () => void = () => undefined;
    this.toolCallQueue = new Promise<void>((resolve) => {
      release = resolve;
    });
    await previous;
    try {
      return await operation();
    } finally {
      release();
    }
  }
}

function chooseRevision(value: unknown): McpRevision | undefined {
  if (!Array.isArray(value)) return undefined;
  const revisions = new Set(value.filter((item): item is string => typeof item === 'string'));
  return MCP_SUPPORTED_REVISIONS.find((revision) => revisions.has(revision));
}

function isSupportedRevision(value: string): value is McpRevision {
  return (MCP_SUPPORTED_REVISIONS as readonly string[]).includes(value);
}

function isProtocolError(error: unknown, code: number): error is JsonRpcProtocolError {
  return error instanceof JsonRpcProtocolError && error.code === code;
}

function elicitationInputRequests(params: unknown): unknown[] {
  const request = isRecord(params) ? params : {};
  const message =
    typeof request.message === 'string' ? request.message : 'MCP server requests input';
  const schema = isRecord(request.requestedSchema) ? request.requestedSchema : {};
  const properties = isRecord(schema.properties) ? schema.properties : {};
  const required = Array.isArray(schema.required)
    ? schema.required.filter((key): key is string => typeof key === 'string')
    : Object.keys(properties);
  if (required.length === 0) return [{ id: 'value', prompt: message }];
  return required.map((id) => {
    const property = isRecord(properties[id]) ? properties[id] : {};
    const options = Array.isArray(property.enum)
      ? property.enum.filter((value): value is string => typeof value === 'string')
      : undefined;
    return {
      id,
      prompt: property.description
        ? `${message}\n${id}: ${property.description}`
        : `${message}\n${id}`,
      ...(options?.length ? { options } : {}),
    };
  });
}

function parseToolDescriptor(value: unknown): McpToolDescriptor {
  if (!isRecord(value) || typeof value.name !== 'string' || !('inputSchema' in value)) {
    throw new RpcError(
      'MCP tools/list contains an invalid tool descriptor',
      RpcErrorCode.McpRequestFailed,
    );
  }
  return {
    name: value.name,
    ...(typeof value.title === 'string' ? { title: value.title } : {}),
    ...(typeof value.description === 'string' ? { description: value.description } : {}),
    inputSchema: value.inputSchema,
    ...(value.outputSchema === undefined ? {} : { outputSchema: value.outputSchema }),
    ...(isRecord(value.annotations) ? { annotations: value.annotations } : {}),
  };
}

function serverInfo(value: unknown): McpConnectionState['serverInfo'] {
  if (!isRecord(value) || typeof value.name !== 'string' || typeof value.version !== 'string')
    return null;
  return { name: value.name, version: value.version };
}

function cloneToolsSnapshot(snapshot: McpToolsSnapshot): McpToolsSnapshot {
  return { ...snapshot, tools: snapshot.tools.map((tool) => ({ ...tool })) };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function asRecord(value: unknown): Record<string, unknown> {
  if (!isRecord(value))
    throw new McpProtocolError('MCP server returned a non-object result', -32600);
  return value;
}

function isLogLevel(value: unknown): value is McpLogEntry['level'] {
  return value === 'debug' || value === 'info' || value === 'warning' || value === 'error';
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

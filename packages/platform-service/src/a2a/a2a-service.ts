import { createRequire } from 'node:module';
import type { AgentCard as AgentCardValue } from '@a2a-js/sdk' with { 'resolution-mode': 'import' };
import type { Client } from '@a2a-js/sdk/client' with { 'resolution-mode': 'import' };
import type { StreamResponse } from '@a2a-js/sdk' with { 'resolution-mode': 'import' };
import {
  A2AOutboundCallInputSchema,
  A2AOutboundSendInputSchema,
  A2AOutboundTaskInputSchema,
  A2ARemoteTaskListInputSchema,
  compile,
  RpcError,
  RpcErrorCode,
  uuidv7,
  type A2ARemoteTaskListInput,
  type A2ARemoteTaskRecord,
  type A2AAgentCardSummary,
  type A2AInboundClient,
  type A2AInboundClientInput,
  type A2AInboundConfig,
  type A2AOutboundCallInput,
  type A2AOutboundAuthInput,
  type A2AOutboundConnection,
  type A2AOutboundConnectionInput,
  type A2AOutboundSendInput,
  type A2AOutboundTaskInput,
  type ToolDefinition,
} from '@gamecrafter/contracts';
import type { Database } from '../db/database';
import type { CredentialStore } from '../profile/credential-store';
import type { ProfileStore } from '../profile/profile-store';
import type { RoleRegistry } from '../roles/role-registry';
import type { TaskService } from '../tasks/task-service';
import type { ToolContext } from '../tools/tool-registry';

type AgentCardSecurityScheme = NonNullable<AgentCardValue['securitySchemes']>[string];
import type { ToolRegistry } from '../tools/tool-registry';
import { A2AInboundServer } from './inbound-server';

const requireSdk = createRequire(__filename);
const sdkClient = requireSdk('@a2a-js/sdk/client') as {
  ClientFactory: new (options: {
    transports: unknown[];
    preferredTransports: string[];
    cardResolver: unknown;
  }) => { createFromAgentCard(card: AgentCardValue): Promise<Client> };
  DefaultAgentCardResolver: new (options: { fetchImpl: typeof fetch }) => {
    resolve(baseUrl: string): Promise<AgentCardValue>;
  };
  JsonRpcTransportFactory: new (options: { fetchImpl: typeof fetch }) => unknown;
};

interface ConnectionRow {
  connectionId: string;
  name: string;
  endpoint: string;
  authKind: A2AOutboundConnection['authKind'];
  credentialRef: string | null;
  agentCardJson: string | null;
  createdAt: string;
  updatedAt: string;
}

interface RemoteTaskRow {
  connectionId: string;
  remoteTaskId: string;
  remoteContextId: string | null;
  projectId: string | null;
  localTaskId: string | null;
  callId: string | null;
  statusState: string | null;
  statusTimestamp: string | null;
  createdAt: string;
  updatedAt: string;
}

const outboundTools: Array<{
  definition: ToolDefinition;
  operation: 'send' | 'get' | 'cancel' | 'stream' | 'resubscribe' | 'list';
}> = [
  {
    definition: {
      toolId: 'a2a/send-message',
      title: 'Send message to external A2A agent',
      description: 'Send a bounded text message to a configured A2A v1.0 JSON-RPC agent.',
      inputSchema: A2AOutboundCallInputSchema,
      executionMode: 'headless-process',
      sideEffects: 'external-write',
      evidence: 'A2A task response from the configured remote agent.',
      capabilities: ['external-delegation', 'a2a'],
      source: 'a2a',
    },
    operation: 'send',
  },
  {
    definition: {
      toolId: 'a2a/send-message-stream',
      title: 'Send message and stream external A2A task updates',
      description: 'Send a message and collect bounded task, status, and artifact updates.',
      inputSchema: A2AOutboundSendInputSchema,
      executionMode: 'headless-process',
      sideEffects: 'external-write',
      evidence: 'A2A task events from the configured remote agent.',
      capabilities: ['external-delegation', 'a2a', 'streaming'],
      source: 'a2a',
    },
    operation: 'stream',
  },
  {
    definition: {
      toolId: 'a2a/resubscribe-task',
      title: 'Resume external A2A task updates',
      description: 'Resume the updates stream for a previously recorded remote task.',
      inputSchema: A2AOutboundTaskInputSchema,
      executionMode: 'headless-process',
      sideEffects: 'none',
      evidence: 'A2A task events from the configured remote agent.',
      capabilities: ['external-delegation', 'a2a', 'streaming'],
      source: 'a2a',
    },
    operation: 'resubscribe',
  },
  {
    definition: {
      toolId: 'a2a/get-task',
      title: 'Get external A2A task',
      description: 'Retrieve a task from a configured A2A v1.0 JSON-RPC agent.',
      inputSchema: A2AOutboundCallInputSchema,
      executionMode: 'headless-process',
      sideEffects: 'none',
      evidence: 'A2A task response from the configured remote agent.',
      capabilities: ['external-delegation', 'a2a'],
      source: 'a2a',
    },
    operation: 'get',
  },
  {
    definition: {
      toolId: 'a2a/cancel-task',
      title: 'Cancel external A2A task',
      description: 'Request cancellation of a task from a configured A2A v1.0 JSON-RPC agent.',
      inputSchema: A2AOutboundCallInputSchema,
      executionMode: 'headless-process',
      sideEffects: 'external-write',
      evidence: 'A2A cancellation response from the configured remote agent.',
      capabilities: ['external-delegation', 'a2a'],
      source: 'a2a',
    },
    operation: 'cancel',
  },
  {
    definition: {
      toolId: 'a2a/list-remote-tasks',
      title: 'Find persisted external A2A tasks',
      description: 'List bounded remote-task records linked to the current Project.',
      inputSchema: A2ARemoteTaskListInputSchema,
      executionMode: 'headless-process',
      sideEffects: 'none',
      evidence: 'Durable A2A task identity and status from the platform profile.',
      capabilities: ['external-delegation', 'a2a'],
      source: 'a2a',
    },
    operation: 'list',
  },
];

export interface A2AServiceOptions {
  database: Database;
  credentials: CredentialStore;
  projects: ProfileStore;
  roles: RoleRegistry;
  tasks: TaskService;
  tools: ToolRegistry;
  now?: () => Date;
}

export class A2AService {
  private readonly now: () => Date;
  private readonly inbound: A2AInboundServer;
  private readonly remoteClients = new Map<string, { client: Client; card: AgentCardValue }>();

  constructor(private readonly options: A2AServiceOptions) {
    this.now = options.now ?? (() => new Date());
    this.inbound = new A2AInboundServer({
      database: options.database,
      projects: options.projects,
      roles: options.roles,
      tasks: options.tasks,
      now: this.now,
    });
    for (const { definition, operation } of outboundTools) {
      options.tools.register(definition, async (context, raw) => {
        if (operation === 'list') {
          const input = compile<A2ARemoteTaskListInput>(A2ARemoteTaskListInputSchema).assert(raw);
          return { output: this.listRemoteTasks(context.projectId, input) };
        }
        const input =
          operation === 'stream'
            ? compile<A2AOutboundSendInput>(A2AOutboundSendInputSchema).assert(raw)
            : operation === 'resubscribe'
              ? compile<A2AOutboundTaskInput>(A2AOutboundTaskInputSchema).assert(raw)
              : compile<A2AOutboundCallInput>(A2AOutboundCallInputSchema).assert(raw);
        const value = await this.callOutbound(input.connectionId, operation, input, context);
        return { output: value, evidence: [{ kind: 'a2a', ref: input.connectionId }] };
      });
    }
  }

  listOutbound(): A2AOutboundConnection[] {
    return this.options.database
      .prepare(
        `SELECT connection_id AS connectionId, name, endpoint,
          auth_kind AS authKind, credential_ref AS credentialRef,
          agent_card_json AS agentCardJson, created_at AS createdAt, updated_at AS updatedAt
         FROM a2a_connections ORDER BY name`,
      )
      .all<ConnectionRow>()
      .map((row) => this.publicConnection(row));
  }

  upsertOutbound(input: A2AOutboundConnectionInput): A2AOutboundConnection {
    const endpoint = validateEndpoint(input.endpoint);
    const name = input.name.trim();
    if (!name) throw new Error('A2A connection name cannot be empty');
    validateAuthInput(input.auth);
    const connectionId = input.connectionId ?? uuidv7();
    const current = this.connectionRow(connectionId);
    const now = this.now().toISOString();
    const credentialRef = input.auth.kind === 'none' ? null : `a2a/outbound/${connectionId}`;
    this.options.database.transaction(() => {
      this.options.database
        .prepare(
          `INSERT INTO a2a_connections
            (connection_id, name, endpoint, auth_kind, credential_ref, agent_card_json, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, NULL, ?, ?)
           ON CONFLICT(connection_id) DO UPDATE SET
            name = excluded.name, endpoint = excluded.endpoint, auth_kind = excluded.auth_kind,
            credential_ref = excluded.credential_ref, agent_card_json = NULL, updated_at = excluded.updated_at`,
        )
        .run(
          connectionId,
          name,
          endpoint,
          input.auth.kind,
          credentialRef,
          current?.createdAt ?? now,
          now,
        );
      if (credentialRef) this.options.credentials.put(credentialRef, JSON.stringify(input.auth));
      else this.options.credentials.delete(`a2a/outbound/${connectionId}`);
    });
    this.remoteClients.delete(connectionId);
    return this.getOutbound(connectionId);
  }

  deleteOutbound(connectionId: string): boolean {
    this.remoteClients.delete(connectionId);
    const result = this.options.database
      .prepare('DELETE FROM a2a_connections WHERE connection_id = ?')
      .run(connectionId) as { changes: number };
    this.options.credentials.delete(`a2a/outbound/${connectionId}`);
    return result.changes > 0;
  }

  async discover(connectionId: string): Promise<A2AAgentCardSummary> {
    const row = this.connectionRow(connectionId);
    if (!row) throw new RpcError('A2A connection not found', RpcErrorCode.A2AConnectionNotFound);
    const { card } = await this.createClient(row, true);
    const summary = summarizeAgentCard(card);
    this.options.database
      .prepare(
        'UPDATE a2a_connections SET agent_card_json = ?, updated_at = ? WHERE connection_id = ?',
      )
      .run(JSON.stringify(summary), this.now().toISOString(), connectionId);
    return summary;
  }

  getInboundConfig(): A2AInboundConfig {
    const config = this.inbound.getConfig();
    return { ...config, active: this.inbound.active };
  }

  async configureInbound(enabled: boolean, port: number): Promise<A2AInboundConfig> {
    await this.inbound.configure(enabled, port);
    return this.getInboundConfig();
  }

  listInboundClients(): A2AInboundClient[] {
    return this.inbound.listClients();
  }

  upsertInboundClient(input: A2AInboundClientInput): A2AInboundClient {
    return this.inbound.upsertClient(input);
  }

  issueInboundClientToken(clientId: string): { clientId: string; token: string } {
    return this.inbound.issueToken(clientId);
  }

  revokeInboundClient(clientId: string): A2AInboundClient {
    return this.inbound.revokeClient(clientId);
  }

  async startConfigured(): Promise<void> {
    await this.inbound.startConfigured();
  }

  async stop(): Promise<void> {
    await this.inbound.stop();
    this.remoteClients.clear();
    for (const { definition } of outboundTools) this.options.tools.unregister(definition.toolId);
  }

  private async callOutbound(
    connectionId: string,
    operation: 'send' | 'get' | 'cancel' | 'stream' | 'resubscribe',
    input: { message?: string; taskId?: string },
    context: ToolContext,
  ): Promise<unknown> {
    const row = this.connectionRow(connectionId);
    if (!row) throw new RpcError('A2A connection not found', RpcErrorCode.A2AConnectionNotFound);
    if (input.taskId) this.assertRemoteTaskProject(connectionId, input.taskId, context.projectId);
    const { client } = await this.createClient(row);
    const signal = context.signal;
    if (signal.aborted) throw abortError(signal.reason);
    try {
      if (operation === 'send') {
        if (!input.message) throw new Error('A2A send requires a message');
        const result = await client.sendMessage(
          {
            message: makeMessage(input.message, input.taskId),
            metadata: {},
            tenant: '',
            configuration: undefined,
          },
          { signal },
        );
        this.persistRemoteTask(result, context, connectionId);
        return boundedRemoteResult(result);
      }
      if (operation === 'stream') {
        if (!input.message) throw new Error('A2A stream requires a message');
        const stream = client.sendMessageStream(
          {
            message: makeMessage(input.message, input.taskId),
            metadata: {},
            tenant: '',
            configuration: undefined,
          },
          { signal },
        );
        return await this.consumeStream(stream, context, connectionId);
      }
      if (!input.taskId) throw new Error(`A2A ${operation} requires taskId`);
      if (operation === 'resubscribe') {
        const stream = client.resubscribeTask({ id: input.taskId, tenant: '' }, { signal });
        return await this.consumeStream(stream, context, connectionId);
      }
      const result =
        operation === 'get'
          ? await client.getTask({ id: input.taskId, tenant: '', historyLength: 20 }, { signal })
          : await client.cancelTask({ id: input.taskId, tenant: '', metadata: {} }, { signal });
      this.persistRemoteTask(result, context, connectionId);
      return boundedRemoteResult(result);
    } catch (error) {
      if (
        error instanceof Error &&
        [
          'A2A send requires a message',
          'A2A get requires taskId',
          'A2A cancel requires taskId',
          'A2A stream requires a message',
          'A2A resubscribe requires taskId',
        ].includes(error.message)
      )
        throw error;
      if (signal.aborted) throw abortError(signal.reason);
      throw new Error('A2A remote operation failed');
    }
  }

  private async createClient(
    row: ConnectionRow,
    refresh = false,
  ): Promise<{ client: Client; card: AgentCardValue }> {
    const cached = this.remoteClients.get(row.connectionId);
    if (cached && !refresh) return cached;
    const base = validateEndpoint(row.endpoint);
    const origin = new URL(base).origin;
    const auth = row.credentialRef
      ? readAuth(this.options.credentials.get(row.credentialRef))
      : { kind: 'none' as const };
    const fetchImpl = createSafeFetch(origin, auth);
    const resolver = new sdkClient.DefaultAgentCardResolver({ fetchImpl });
    let card: AgentCardValue;
    try {
      card = await resolver.resolve(base);
    } catch (error) {
      throw new Error(
        `A2A Agent Card discovery failed: ${error instanceof Error ? error.name : 'invalid response'}`,
      );
    }
    validateCard(card, origin, auth);
    const factory = new sdkClient.ClientFactory({
      transports: [new sdkClient.JsonRpcTransportFactory({ fetchImpl })],
      preferredTransports: ['JSONRPC'],
      cardResolver: resolver,
    });
    const created = { client: await factory.createFromAgentCard(card), card };
    this.remoteClients.set(row.connectionId, created);
    return created;
  }

  private getOutbound(connectionId: string): A2AOutboundConnection {
    const row = this.connectionRow(connectionId);
    if (!row) throw new RpcError('A2A connection not found', RpcErrorCode.A2AConnectionNotFound);
    return this.publicConnection(row);
  }

  private listRemoteTasks(
    projectId: string,
    input: A2ARemoteTaskListInput,
  ): { tasks: A2ARemoteTaskRecord[] } {
    const filters = ['project_id = ?'];
    const values: (string | number)[] = [projectId];
    if (input.connectionId) {
      filters.push('connection_id = ?');
      values.push(input.connectionId);
    }
    if (input.localTaskId) {
      filters.push('local_task_id = ?');
      values.push(input.localTaskId);
    }
    values.push(input.limit ?? 30);
    const rows = this.options.database
      .prepare(
        `SELECT connection_id AS connectionId, remote_task_id AS remoteTaskId,
          remote_context_id AS remoteContextId, project_id AS projectId,
          local_task_id AS localTaskId, call_id AS callId, status_state AS statusState,
          status_timestamp AS statusTimestamp, created_at AS createdAt, updated_at AS updatedAt
         FROM a2a_remote_tasks WHERE ${filters.join(' AND ')}
         ORDER BY updated_at DESC LIMIT ?`,
      )
      .all<RemoteTaskRow>(...values);
    return { tasks: rows.map((row) => this.publicRemoteTask(row)) };
  }

  private assertRemoteTaskProject(
    connectionId: string,
    remoteTaskId: string,
    projectId: string,
  ): void {
    const owned = this.options.database
      .prepare(
        `SELECT 1 AS found FROM a2a_remote_tasks
         WHERE connection_id = ? AND remote_task_id = ? AND project_id = ?`,
      )
      .get<{ found: number }>(connectionId, remoteTaskId, projectId);
    if (!owned) throw new Error('A2A remote task is not available in this Project');
  }

  private persistRemoteTask(value: unknown, context: ToolContext, connectionId: string): void {
    const task = findRemoteTask(value);
    if (!task) return;
    this.persistRemoteTaskStatus(connectionId, task.id, task.contextId, task.status, context);
  }

  private persistRemoteTaskStatus(
    connectionId: string,
    remoteTaskId: string | undefined,
    remoteContextId: string | undefined,
    status: unknown,
    context: ToolContext,
  ): void {
    if (!remoteTaskId || remoteTaskId.length > 256) return;
    const statusRecord = isRecord(status) ? status : undefined;
    const statusState = normalizeTaskState(statusRecord?.state);
    const statusTimestamp = normalizeTimestamp(statusRecord?.timestamp);
    const now = this.now().toISOString();
    this.options.database
      .prepare(
        `INSERT INTO a2a_remote_tasks (
          connection_id, remote_task_id, remote_context_id, project_id, local_task_id,
          call_id, status_state, status_timestamp, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(connection_id, remote_task_id) DO UPDATE SET
          remote_context_id = COALESCE(excluded.remote_context_id, a2a_remote_tasks.remote_context_id),
          project_id = COALESCE(a2a_remote_tasks.project_id, excluded.project_id),
          local_task_id = COALESCE(a2a_remote_tasks.local_task_id, excluded.local_task_id),
          call_id = COALESCE(a2a_remote_tasks.call_id, excluded.call_id),
          status_state = COALESCE(excluded.status_state, a2a_remote_tasks.status_state),
          status_timestamp = COALESCE(excluded.status_timestamp, a2a_remote_tasks.status_timestamp),
          updated_at = excluded.updated_at`,
      )
      .run(
        connectionId,
        remoteTaskId,
        typeof remoteContextId === 'string' ? remoteContextId.slice(0, 256) : null,
        context.projectId,
        context.taskId,
        context.callId,
        statusState,
        statusTimestamp,
        now,
        now,
      );
  }

  private async consumeStream(
    stream: AsyncGenerator<StreamResponse, void, undefined>,
    context: ToolContext,
    connectionId: string,
  ): Promise<unknown> {
    const events: unknown[] = [];
    let taskId: string | undefined;
    let truncated = false;
    const iterator = stream[Symbol.asyncIterator]();
    try {
      for (let count = 0; count < 128; count += 1) {
        if (context.signal.aborted) throw abortError(context.signal.reason);
        const next = await iterator.next();
        if (next.done) break;
        const event = next.value;
        const projection = projectStreamEvent(event);
        if (projection.taskId) taskId = projection.taskId;
        if (projection.taskId) {
          this.persistRemoteTaskStatus(
            connectionId,
            projection.taskId,
            projection.contextId,
            projection.status,
            context,
          );
        }
        const boundedEvent = boundedRemoteResult(projection.value);
        events.push(boundedEvent);
        context.reportProgress?.({
          connectionId,
          remoteTaskId: projection.taskId ?? taskId ?? null,
          remoteContextId: projection.contextId ?? null,
          event: boundedEvent,
        });
        if (count === 127) truncated = true;
      }
    } finally {
      if (context.signal.aborted || truncated) await iterator.return?.();
    }
    const output = { taskId: taskId ?? null, events, truncated };
    if (jsonSize(output) <= 64_000) return output;
    const bounded = boundJsonValue(output, 63_000);
    if (isRecord(bounded)) bounded.truncated = true;
    return bounded;
  }

  private publicRemoteTask(row: RemoteTaskRow): A2ARemoteTaskRecord {
    return {
      schemaVersion: 1,
      connectionId: row.connectionId,
      remoteTaskId: row.remoteTaskId,
      remoteContextId: row.remoteContextId,
      projectId: row.projectId,
      localTaskId: row.localTaskId,
      callId: row.callId,
      statusState: row.statusState,
      statusTimestamp: row.statusTimestamp,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    };
  }

  private connectionRow(connectionId: string): ConnectionRow | undefined {
    return this.options.database
      .prepare(
        `SELECT connection_id AS connectionId, name, endpoint,
          auth_kind AS authKind, credential_ref AS credentialRef,
          agent_card_json AS agentCardJson, created_at AS createdAt, updated_at AS updatedAt
         FROM a2a_connections WHERE connection_id = ?`,
      )
      .get<ConnectionRow>(connectionId);
  }

  private publicConnection(row: ConnectionRow): A2AOutboundConnection {
    return {
      schemaVersion: 1,
      connectionId: row.connectionId,
      name: row.name,
      endpoint: row.endpoint,
      authKind: row.authKind,
      credentialConfigured: Boolean(row.credentialRef),
      agentCard: row.agentCardJson ? (JSON.parse(row.agentCardJson) as A2AAgentCardSummary) : null,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    };
  }
}

function validateEndpoint(value: string): string {
  const url = new URL(value);
  if (url.username || url.password || url.hash || url.search)
    throw new Error('A2A endpoint must not contain userinfo, query parameters, or fragments');
  if (url.protocol === 'https:') return url.toString().replace(/\/$/, '');
  const host = url.hostname.replace(/^\[|\]$/g, '').toLowerCase();
  if (url.protocol !== 'http:' || !['localhost', '127.0.0.1', '::1'].includes(host)) {
    throw new Error('A2A endpoints require HTTPS except explicit loopback HTTP');
  }
  return url.toString().replace(/\/$/, '');
}

function validateAuthInput(auth: A2AOutboundAuthInput): void {
  const headers =
    auth.kind === 'api-key'
      ? [auth.headerName]
      : auth.kind === 'custom-headers'
        ? Object.keys(auth.headers)
        : [];
  for (const header of headers) {
    if (!/^[!#$%&'*+.^_`|~0-9A-Za-z-]+$/.test(header) || forbiddenHeader(header)) {
      throw new Error(`Unsupported or unsafe A2A credential header: ${header}`);
    }
  }
  if (auth.kind === 'api-key' && /[\r\n]/.test(auth.value)) {
    throw new Error('A2A credential values cannot contain line breaks');
  }
  if (auth.kind === 'bearer' && /[\r\n]/.test(auth.token)) {
    throw new Error('A2A credential values cannot contain line breaks');
  }
  if (
    auth.kind === 'basic' &&
    (auth.username.includes(':') || /[\r\n]/.test(auth.username + auth.password))
  ) {
    throw new Error('Invalid A2A basic authentication credentials');
  }
  if (
    auth.kind === 'custom-headers' &&
    Object.values(auth.headers).some((value) => /[\r\n]/.test(value))
  ) {
    throw new Error('A2A credential values cannot contain line breaks');
  }
}

function forbiddenHeader(header: string): boolean {
  return new Set([
    'host',
    'content-length',
    'connection',
    'cookie',
    'set-cookie',
    'origin',
    'referer',
    'proxy-authorization',
    'transfer-encoding',
    'upgrade',
    'te',
    'trailer',
  ]).has(header.toLowerCase());
}

function readAuth(json: string | undefined): A2AOutboundAuthInput {
  if (!json) return { kind: 'none' };
  const value = JSON.parse(json) as A2AOutboundAuthInput;
  validateAuthInput(value);
  return value;
}

function createSafeFetch(
  origin: string,
  auth: A2AOutboundAuthInput,
  maxResponseBytes = 512 * 1024,
): typeof fetch {
  return async (input, init) => {
    const requestUrl =
      typeof input === 'string' || input instanceof URL ? String(input) : input.url;
    const target = new URL(requestUrl);
    if (target.origin !== origin)
      throw new Error('A2A interface must stay on the discovered origin');
    const headers = new Headers(
      init?.headers ?? (input instanceof Request ? input.headers : undefined),
    );
    const credentialHeaders = authHeaders(auth);
    for (const [name, value] of Object.entries(credentialHeaders)) headers.set(name, value);
    const response = await fetch(input, { ...init, headers, redirect: 'manual' });
    if (response.status >= 300 && response.status < 400) {
      await response.body?.cancel();
      throw new Error('A2A redirects are not followed');
    }
    if (!response.body) return response;
    if (response.headers.get('content-type')?.toLowerCase().includes('text/event-stream')) {
      const headers = new Headers(response.headers);
      headers.delete('content-length');
      headers.delete('transfer-encoding');
      return new Response(limitStream(response.body, maxResponseBytes), {
        status: response.status,
        statusText: response.statusText,
        headers,
      });
    }
    const reader = response.body.getReader();
    const chunks: Uint8Array[] = [];
    let total = 0;
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > maxResponseBytes) {
        await reader.cancel();
        throw new Error('A2A response exceeds size limit');
      }
      chunks.push(value);
    }
    return new Response(Buffer.concat(chunks), {
      status: response.status,
      statusText: response.statusText,
      headers: response.headers,
    });
  };
}

function authHeaders(auth: A2AOutboundAuthInput): Record<string, string> {
  if (auth.kind === 'none') return {};
  if (auth.kind === 'api-key') return { [auth.headerName]: auth.value };
  if (auth.kind === 'bearer') return { authorization: `Bearer ${auth.token}` };
  if (auth.kind === 'basic')
    return {
      authorization: `Basic ${Buffer.from(`${auth.username}:${auth.password}`).toString('base64')}`,
    };
  return auth.headers;
}

function validateCard(card: AgentCardValue, origin: string, auth: A2AOutboundAuthInput): void {
  if (
    !card.name ||
    !Array.isArray(card.supportedInterfaces) ||
    card.supportedInterfaces.length > 16
  ) {
    throw new Error('Malformed A2A Agent Card');
  }
  if (Object.hasOwn(card, 'security')) {
    throw new Error('Agent Card uses an unsupported security declaration format');
  }
  const supported = card.supportedInterfaces.filter(
    (item) => item.protocolBinding === 'JSONRPC' && item.protocolVersion === '1.0',
  );
  if (!supported.length) throw new Error('A2A Agent Card does not expose JSON-RPC v1.0');
  for (const item of supported) {
    const target = new URL(item.url);
    validateEndpoint(target.toString());
    if (target.origin !== origin)
      throw new Error('A2A interface on a different origin is unsupported');
  }
  const requirements = card.securityRequirements ?? [];
  for (const requirement of requirements) {
    const schemeNames = Object.keys(requirement.schemes ?? {});
    if (schemeNames.length === 0)
      throw new Error('Agent Card contains an empty security requirement');
    for (const schemeName of schemeNames) {
      if (!card.securitySchemes?.[schemeName])
        throw new Error('Agent Card contains an unresolved security requirement');
    }
  }
  // Entries are alternatives (OR); schemes within one entry are conjunctive (AND).
  // An unsupported scheme in another alternative does not invalidate a supported one.
  const satisfiesRequirement = requirements.some((requirement) =>
    Object.keys(requirement.schemes ?? {}).every((schemeName) =>
      supportsSecurityScheme(card.securitySchemes?.[schemeName], auth),
    ),
  );
  if (requirements.length > 0 && !satisfiesRequirement) {
    throw new Error(
      requiredAuthFailure(card) ??
        'Configured credentials do not satisfy any Agent Card security requirement',
    );
  }
}

function requiredAuthFailure(card: AgentCardValue): string | undefined {
  for (const requirement of card.securityRequirements ?? []) {
    for (const schemeName of Object.keys(requirement.schemes ?? {})) {
      const value = card.securitySchemes?.[schemeName]?.scheme;
      if (!value) continue;
      if (value.$case === 'apiKeySecurityScheme' && value.value.location !== 'header')
        return 'A2A query/cookie API keys are unsupported';
      if (value.$case === 'httpAuthSecurityScheme') {
        const method = value.value.scheme.toLowerCase();
        if (method !== 'bearer' && method !== 'basic')
          return 'Agent Card requires unsupported HTTP authentication';
      } else if (value.$case !== 'apiKeySecurityScheme') {
        return 'Agent Card requires unsupported OAuth, OpenID, or mTLS authentication';
      }
    }
  }
  return undefined;
}

function supportsSecurityScheme(
  scheme: AgentCardSecurityScheme | undefined,
  auth: A2AOutboundAuthInput,
): boolean {
  const value = scheme?.scheme;
  if (!value) return false;
  if (value.$case === 'apiKeySecurityScheme') {
    if (value.value.location !== 'header') return false;
    const requiredName = value.value.name.toLowerCase();
    return auth.kind === 'api-key'
      ? auth.headerName.toLowerCase() === requiredName
      : auth.kind === 'custom-headers' &&
          Object.keys(auth.headers).some((header) => header.toLowerCase() === requiredName);
  }
  if (value.$case === 'httpAuthSecurityScheme') {
    const method = value.value.scheme.toLowerCase();
    return (
      (method === 'bearer' && auth.kind === 'bearer') ||
      (method === 'basic' && auth.kind === 'basic')
    );
  }
  return false;
}

function summarizeAgentCard(card: AgentCardValue): A2AAgentCardSummary {
  return {
    name: card.name.slice(0, 256),
    description: card.description.slice(0, 4096),
    version: card.version.slice(0, 128),
    supportedBindings: card.supportedInterfaces
      .map((item) => `${item.protocolBinding}@${item.protocolVersion}`)
      .slice(0, 16),
    skills: (card.skills ?? [])
      .slice(0, 128)
      .map((skill) => ({ id: skill.id.slice(0, 128), name: skill.name.slice(0, 256) })),
    streaming: card.capabilities?.streaming === true,
  };
}

function makeMessage(text: string, taskId = '') {
  return {
    messageId: uuidv7(),
    contextId: '',
    taskId,
    role: 1,
    parts: [
      {
        content: { $case: 'text' as const, value: text },
        metadata: undefined,
        filename: '',
        mediaType: 'text/plain',
      },
    ],
    metadata: undefined,
    extensions: [],
    referenceTaskIds: [],
  };
}

function boundedRemoteResult(value: unknown): unknown {
  const serialized = JSON.stringify(value);
  if (!serialized) return value;
  const plainValue = JSON.parse(serialized) as unknown;
  if (Buffer.byteLength(serialized, 'utf8') <= 64_000) return plainValue;
  return boundJsonValue(plainValue, 63_000);
}

function boundJsonValue(value: unknown, budget: number, key = ''): unknown {
  if (budget <= 0) return null;
  if (typeof value === 'string') return truncateUtf8(value, Math.min(budget, 8_000));
  if (value === null || typeof value === 'number' || typeof value === 'boolean') return value;
  if (Array.isArray(value)) {
    const source =
      key === 'history' ? value.slice(-20) : value.slice(0, key === 'artifacts' ? 16 : 32);
    const bounded: unknown[] = [];
    let remaining = budget - 32;
    for (let index = 0; index < source.length && remaining > 16; index += 1) {
      const item = boundJsonValue(
        source[index],
        Math.min(remaining, 4_000),
        key === 'parts' ? 'part' : '',
      );
      const size = jsonSize(item);
      if (size <= remaining) {
        bounded.push(item);
        remaining -= size + 1;
      }
    }
    return bounded;
  }
  if (!isRecord(value)) return null;
  const result: Record<string, unknown> = {};
  let remaining = budget - 32;
  const keys = Object.keys(value);
  const priority =
    key === 'status'
      ? ['state', 'timestamp', 'message']
      : ['id', 'contextId', 'taskId', 'status', 'task', 'kind', 'payload', 'events'];
  const ordered = [
    ...priority.filter((name) => Object.hasOwn(value, name)),
    ...keys.filter((name) => !priority.includes(name)),
  ];
  for (const name of ordered.slice(0, 64)) {
    if (remaining < 16) break;
    const bounded = boundJsonValue(value[name], Math.min(remaining - name.length - 4, 8_000), name);
    const size = Buffer.byteLength(JSON.stringify(name), 'utf8') + jsonSize(bounded) + 1;
    if (size <= remaining) {
      result[name] = bounded;
      remaining -= size;
    }
  }
  if (Object.keys(result).length < keys.length && remaining >= 24) result.truncated = true;
  return result;
}

function truncateUtf8(value: string, maxBytes: number): string {
  if (Buffer.byteLength(value, 'utf8') <= maxBytes) return value;
  let low = 0;
  let high = value.length;
  while (low < high) {
    const middle = Math.ceil((low + high) / 2);
    if (Buffer.byteLength(value.slice(0, middle), 'utf8') <= maxBytes - 3) low = middle;
    else high = middle - 1;
  }
  return `${value.slice(0, low)}…`;
}

function jsonSize(value: unknown): number {
  const serialized = JSON.stringify(value);
  return serialized ? Buffer.byteLength(serialized, 'utf8') : 4;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function findRemoteTask(
  value: unknown,
): { id: string; contextId?: string; status?: unknown } | undefined {
  if (!isRecord(value)) return undefined;
  const nested = isRecord(value.task) ? value.task : value;
  if (typeof nested.id !== 'string' || !isRecord(nested.status)) return undefined;
  return {
    id: nested.id,
    contextId: typeof nested.contextId === 'string' ? nested.contextId : undefined,
    status: nested.status,
  };
}

function normalizeTimestamp(value: unknown): string | null {
  if (typeof value !== 'string' || !value) return null;
  const timestamp = new Date(value);
  return Number.isNaN(timestamp.getTime()) ? null : timestamp.toISOString();
}

function normalizeTaskState(value: unknown): string | null {
  if (typeof value === 'string') return value.slice(0, 64);
  if (typeof value !== 'number') return null;
  return (
    [
      'TASK_STATE_UNSPECIFIED',
      'TASK_STATE_SUBMITTED',
      'TASK_STATE_WORKING',
      'TASK_STATE_COMPLETED',
      'TASK_STATE_FAILED',
      'TASK_STATE_CANCELED',
      'TASK_STATE_INPUT_REQUIRED',
      'TASK_STATE_REJECTED',
      'TASK_STATE_AUTH_REQUIRED',
    ][value] ?? `TASK_STATE_${value}`
  );
}

function projectStreamEvent(event: StreamResponse): {
  value: unknown;
  taskId?: string;
  contextId?: string;
  status?: unknown;
} {
  const payload = event.payload;
  if (!payload) return { value: null };
  if (payload.$case === 'task') {
    const task = payload.value;
    return {
      value: { kind: 'task', value: task },
      taskId: task.id,
      contextId: task.contextId,
      status: task.status,
    };
  }
  if (payload.$case === 'statusUpdate') {
    const update = payload.value;
    return {
      value: { kind: 'statusUpdate', value: update },
      taskId: update.taskId,
      contextId: update.contextId,
      status: update.status,
    };
  }
  if (payload.$case === 'artifactUpdate') {
    const update = payload.value;
    return {
      value: { kind: 'artifactUpdate', value: update },
      taskId: update.taskId,
      contextId: update.contextId,
    };
  }
  return { value: { kind: payload.$case, value: payload.value } };
}

function limitStream(
  body: ReadableStream<Uint8Array>,
  maxBytes: number,
): ReadableStream<Uint8Array> {
  const reader = body.getReader();
  let total = 0;
  return new ReadableStream<Uint8Array>({
    async pull(controller) {
      const result = await reader.read();
      if (result.done) {
        controller.close();
        return;
      }
      total += result.value.byteLength;
      if (total > maxBytes) {
        await reader.cancel();
        controller.error(new Error('A2A response exceeds size limit'));
        return;
      }
      controller.enqueue(result.value);
    },
    cancel(reason) {
      return reader.cancel(reason);
    },
  });
}

function abortError(reason: unknown): Error {
  const error = new Error(reason === undefined ? 'A2A request aborted' : String(reason));
  error.name = 'AbortError';
  return error;
}

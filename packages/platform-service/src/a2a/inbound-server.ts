import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';
import { createRequire } from 'node:module';
import { createServer, type Server } from 'node:http';
import express, { type RequestHandler } from 'express';
import type {
  AgentCard as AgentCardValue,
  CancelTaskRequest,
  DeleteTaskPushNotificationConfigRequest,
  GetExtendedAgentCardRequest,
  GetTaskPushNotificationConfigRequest,
  GetTaskRequest,
  ListTaskPushNotificationConfigsRequest,
  ListTaskPushNotificationConfigsResponse,
  ListTasksRequest,
  ListTasksResponse,
  SendMessageRequest,
  SubscribeToTaskRequest,
  TaskPushNotificationConfig,
  Task as A2ATaskValue,
  StreamResponse as A2AStreamValue,
} from '@a2a-js/sdk' with { 'resolution-mode': 'import' };
import type { A2ARequestHandler, ServerCallContext } from '@a2a-js/sdk/server' with {
  'resolution-mode': 'import',
};
import {
  A2AInboundClientInputSchema,
  compile,
  RpcError,
  RpcErrorCode,
  uuidv7,
  type A2AInboundClient,
  type A2AInboundClientInput,
  type A2AInboundConfig,
  type A2AProjectGrant,
  type TaskRecord,
} from '@gamecrafter/contracts';
import type { Database } from '../db/database';
import type { ProfileStore } from '../profile/profile-store';
import type { RoleRegistry } from '../roles/role-registry';
import type { TaskService } from '../tasks/task-service';

const requireSdk = createRequire(__filename);
const sdkRoot = requireSdk('@a2a-js/sdk') as {
  AgentCard: { fromJSON(value: unknown): AgentCardValue; toJSON(value: AgentCardValue): unknown };
  Message: { fromJSON(value: unknown): A2AUserMessage };
  Role: { ROLE_USER: number };
  StreamResponse: { fromJSON(value: unknown): A2AStreamValue };
  Task: { fromJSON(value: unknown): A2ATaskValue };
};
const sdkServerExpress = requireSdk('@a2a-js/sdk/server/express') as {
  agentCardHandler(options: { agentCardProvider: () => Promise<AgentCardValue> }): RequestHandler;
  jsonRpcHandler(options: {
    requestHandler: A2ARequestHandler;
    userBuilder: (request: { headers: { authorization?: string } }) => Promise<AuthUser>;
  }): RequestHandler;
};
const sdkErrors = requireSdk('@a2a-js/sdk/errors') as {
  JsonRpcTaskNotCancelableError: new (options: { message: string }) => Error;
  JsonRpcTaskNotFoundError: new (options: { message: string }) => Error;
  JsonRpcUnsupportedOperationError: new (options: { message: string }) => Error;
};

type A2AUserMessage = NonNullable<SendMessageRequest['message']>;

interface ClientRow {
  clientId: string;
  name: string;
  grantsJson: string;
  tokenHash: string | null;
  revokedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

interface ConfigRow {
  enabled: number;
  port: number;
}

interface AuthUser {
  readonly isAuthenticated: boolean;
  readonly userName: string;
}

interface LocatedTask {
  projectId: string;
  grant: A2AProjectGrant;
  task: TaskRecord;
}

const MAX_BODY_BYTES = 256 * 1024;
const MAX_TEXT_LENGTH = 16_384;
const MAX_REQUESTS = 32;
const MAX_REQUESTS_PER_CLIENT = 8;
const MAX_PUBLIC_CARD_REQUESTS = 4;
const REQUESTS_PER_MINUTE = 120;

export interface A2AInboundOptions {
  database: Database;
  projects: ProfileStore;
  roles: RoleRegistry;
  tasks: TaskService;
  now: () => Date;
}

export class A2AInboundServer {
  private server?: Server;
  private listeningPort?: number;
  private readonly clientRequests = new Map<string, Set<AbortController>>();

  constructor(private readonly options: A2AInboundOptions) {}

  get active(): boolean {
    return this.server?.listening === true;
  }

  getConfig(): A2AInboundConfig {
    const row = this.options.database
      .prepare('SELECT enabled, port FROM a2a_inbound_config WHERE singleton_id = 1')
      .get<ConfigRow>();
    return {
      schemaVersion: 1,
      enabled: row?.enabled === 1,
      address: '127.0.0.1',
      port: row?.port ?? 8765,
      active: this.active,
    };
  }

  async configure(enabled: boolean, port: number): Promise<void> {
    if (!Number.isInteger(port) || port < 1024 || port > 65535)
      throw new Error('Invalid A2A loopback port');
    const next = this.getConfig();
    if (this.active && (!enabled || port !== next.port)) await this.stop();
    this.options.database
      .prepare(
        'UPDATE a2a_inbound_config SET enabled = ?, port = ?, updated_at = ? WHERE singleton_id = 1',
      )
      .run(enabled ? 1 : 0, port, this.options.now().toISOString());
    if (enabled) {
      try {
        await this.listen(port);
      } catch (error) {
        this.options.database
          .prepare(
            'UPDATE a2a_inbound_config SET enabled = 0, updated_at = ? WHERE singleton_id = 1',
          )
          .run(this.options.now().toISOString());
        throw error;
      }
    }
  }

  async startConfigured(): Promise<void> {
    const config = this.getConfig();
    if (config.enabled) await this.listen(config.port);
  }

  async stop(): Promise<void> {
    this.abortAllClientRequests();
    const server = this.server;
    if (!server) return;
    this.server = undefined;
    this.listeningPort = undefined;
    await new Promise<void>((resolve) => {
      server.close(() => resolve());
      server.closeAllConnections();
    });
  }

  listClients(): A2AInboundClient[] {
    return this.options.database
      .prepare(
        `SELECT client_id AS clientId, name, grants_json AS grantsJson,
          token_hash AS tokenHash, revoked_at AS revokedAt,
          created_at AS createdAt, updated_at AS updatedAt
         FROM a2a_inbound_clients ORDER BY name`,
      )
      .all<ClientRow>()
      .map((row) => this.publicClient(row));
  }

  upsertClient(raw: A2AInboundClientInput): A2AInboundClient {
    const input = compile<A2AInboundClientInput>(A2AInboundClientInputSchema).assert(raw);
    const grants = validateGrants(input.grants, this.options.projects, this.options.roles);
    const name = input.name.trim();
    if (!name) throw new Error('A2A client name cannot be empty');
    const existing = input.clientId ? this.getClientRow(input.clientId) : undefined;
    const id = input.clientId ?? uuidv7();
    const now = this.options.now().toISOString();
    this.options.database
      .prepare(
        `INSERT INTO a2a_inbound_clients
          (client_id, name, grants_json, token_hash, revoked_at, created_at, updated_at)
         VALUES (?, ?, ?, NULL, NULL, ?, ?)
         ON CONFLICT(client_id) DO UPDATE SET
          name = excluded.name, grants_json = excluded.grants_json, updated_at = excluded.updated_at`,
      )
      .run(id, name, JSON.stringify(grants), existing?.createdAt ?? now, now);
    this.abortClientRequests(id);
    const row = this.getClientRow(id);
    if (!row) throw new Error('A2A client could not be stored');
    return this.publicClient(row);
  }

  issueToken(clientId: string): { clientId: string; token: string } {
    const client = this.getClientRow(clientId);
    if (!client) throw new RpcError('A2A client not found', RpcErrorCode.A2AClientNotFound);
    const token = `pw_a2a_${randomBytes(32).toString('base64url')}`;
    this.options.database
      .prepare(
        'UPDATE a2a_inbound_clients SET token_hash = ?, revoked_at = NULL, updated_at = ? WHERE client_id = ?',
      )
      .run(hashToken(token), this.options.now().toISOString(), clientId);
    this.abortClientRequests(clientId);
    return { clientId, token };
  }

  revokeClient(clientId: string): A2AInboundClient {
    const client = this.getClientRow(clientId);
    if (!client) throw new RpcError('A2A client not found', RpcErrorCode.A2AClientNotFound);
    const now = this.options.now().toISOString();
    this.options.database
      .prepare(
        'UPDATE a2a_inbound_clients SET token_hash = NULL, revoked_at = ?, updated_at = ? WHERE client_id = ?',
      )
      .run(now, now, clientId);
    this.abortClientRequests(clientId);
    return this.publicClient(this.getClientRow(clientId)!);
  }

  private async listen(port: number): Promise<void> {
    if (this.active && this.listeningPort === port) return;
    if (this.active) await this.stop();
    const app = express();
    const host = `127.0.0.1:${port}`;
    let activeRequests = 0;
    let activeCardRequests = 0;
    const activeByClient = new Map<string, number>();
    const publicRate = new Map<string, { started: number; count: number }>();
    const invalidTokenRate = new Map<string, { started: number; count: number }>();
    const clientRate = new Map<string, { started: number; count: number }>();
    const withinRateLimit = (
      buckets: Map<string, { started: number; count: number }>,
      key: string,
    ): boolean => {
      const now = Date.now();
      const entry = buckets.get(key);
      if (!entry || now - entry.started >= 60_000) {
        buckets.set(key, { started: now, count: 1 });
        return true;
      }
      if (entry.count >= REQUESTS_PER_MINUTE) return false;
      entry.count += 1;
      return true;
    };
    app.disable('x-powered-by');
    app.use((req, res, next) => {
      if (
        req.headers.host !== host ||
        (req.headers.origin && req.headers.origin !== `http://${host}`)
      ) {
        res.status(403).end();
        return;
      }
      if (req.method === 'OPTIONS') {
        res.status(405).end();
        return;
      }
      next();
    });
    app.use('/a2a', (request, response, next) => {
      const length = Number(request.headers['content-length'] ?? 0);
      if (Number.isFinite(length) && length > MAX_BODY_BYTES) {
        response.status(413).end();
        return;
      }
      const token = parseBearer(request.headers.authorization);
      const clientId = token ? this.authenticate(token) : undefined;
      if (!clientId) {
        const source = request.socket.remoteAddress ?? 'unknown';
        response.status(withinRateLimit(invalidTokenRate, source) ? 401 : 429).end();
        return;
      }
      response.locals.a2aClientId = clientId;
      next();
    });
    const handler = new InboundRequestHandler(this.options, (clientId) =>
      this.trackClientRequest(clientId),
    );
    const card = sdkRoot.AgentCard.toJSON(createServerCard(port)) as AgentCardValue;
    app.use(
      '/.well-known/agent-card.json',
      (request, response, next) => {
        const source = request.socket.remoteAddress ?? 'unknown';
        if (!withinRateLimit(publicRate, source)) {
          response.status(429).end();
          return;
        }
        if (activeCardRequests >= MAX_PUBLIC_CARD_REQUESTS) {
          response.status(503).end();
          return;
        }
        activeCardRequests += 1;
        let released = false;
        const release = () => {
          if (released) return;
          released = true;
          activeCardRequests -= 1;
        };
        response.once('finish', release);
        response.once('close', release);
        next();
      },
      sdkServerExpress.agentCardHandler({ agentCardProvider: async () => card }) as RequestHandler,
    );
    app.use('/a2a', (request, response, next) => {
      const clientId = response.locals.a2aClientId as string;
      if (!withinRateLimit(clientRate, clientId)) {
        response.status(429).end();
        return;
      }
      const clientActive = activeByClient.get(clientId) ?? 0;
      if (activeRequests >= MAX_REQUESTS || clientActive >= MAX_REQUESTS_PER_CLIENT) {
        response.status(503).end();
        return;
      }
      activeRequests += 1;
      activeByClient.set(clientId, clientActive + 1);
      let released = false;
      const release = () => {
        if (released) return;
        released = true;
        activeRequests -= 1;
        const remaining = (activeByClient.get(clientId) ?? 1) - 1;
        if (remaining <= 0) activeByClient.delete(clientId);
        else activeByClient.set(clientId, remaining);
      };
      response.once('finish', release);
      response.once('close', release);
      next();
    });
    app.use(
      '/a2a',
      sdkServerExpress.jsonRpcHandler({
        requestHandler: handler,
        userBuilder: async (request) => {
          const bearer = parseBearer(request.headers.authorization);
          const userName = bearer ? this.authenticate(bearer) : undefined;
          if (!userName) throw new Error('Unauthorized');
          const user: AuthUser = { isAuthenticated: true, userName };
          return user;
        },
      }) as RequestHandler,
    );
    app.use((_request, response) => response.status(404).end());
    app.use(
      (
        error: Error & { status?: number },
        _request: express.Request,
        response: express.Response,
        next: express.NextFunction,
      ) => {
        if (response.headersSent) {
          next(error);
          return;
        }
        response.status(error.status === 413 ? 413 : 400).json({ error: 'Invalid A2A request' });
      },
    );
    const server = createServer(app);
    await new Promise<void>((resolve, reject) => {
      server.once('error', reject);
      server.listen(port, '127.0.0.1', () => {
        server.removeListener('error', reject);
        resolve();
      });
    });
    this.server = server;
    this.listeningPort = port;
  }

  private authenticate(token: string): string | undefined {
    const hash = hashToken(token);
    const rows = this.options.database
      .prepare(
        'SELECT client_id AS clientId, token_hash AS tokenHash FROM a2a_inbound_clients WHERE revoked_at IS NULL AND token_hash IS NOT NULL',
      )
      .all<{ clientId: string; tokenHash: string }>();
    for (const row of rows) {
      const expected = Buffer.from(row.tokenHash, 'hex');
      const actual = Buffer.from(hash, 'hex');
      if (expected.length === actual.length && timingSafeEqual(expected, actual))
        return row.clientId;
    }
    return undefined;
  }

  private getClientRow(clientId: string): ClientRow | undefined {
    return this.options.database
      .prepare(
        `SELECT client_id AS clientId, name, grants_json AS grantsJson,
          token_hash AS tokenHash, revoked_at AS revokedAt,
          created_at AS createdAt, updated_at AS updatedAt
         FROM a2a_inbound_clients WHERE client_id = ?`,
      )
      .get<ClientRow>(clientId);
  }

  private publicClient(row: ClientRow): A2AInboundClient {
    return {
      schemaVersion: 1,
      clientId: row.clientId,
      name: row.name,
      grants: JSON.parse(row.grantsJson) as A2AProjectGrant[],
      credentialConfigured: row.tokenHash !== null && row.revokedAt === null,
      revokedAt: row.revokedAt,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    };
  }

  private trackClientRequest(clientId: string): {
    controller: AbortController;
    dispose: () => void;
  } {
    const controller = new AbortController();
    const requests = this.clientRequests.get(clientId) ?? new Set<AbortController>();
    requests.add(controller);
    this.clientRequests.set(clientId, requests);
    return {
      controller,
      dispose: () => {
        const current = this.clientRequests.get(clientId);
        current?.delete(controller);
        if (current?.size === 0) this.clientRequests.delete(clientId);
      },
    };
  }

  private abortClientRequests(clientId: string): void {
    const requests = this.clientRequests.get(clientId);
    if (!requests) return;
    this.clientRequests.delete(clientId);
    for (const controller of requests) controller.abort('A2A client credentials or grants changed');
  }

  private abortAllClientRequests(): void {
    const clients = [...this.clientRequests.keys()];
    for (const clientId of clients) this.abortClientRequests(clientId);
  }
}

class InboundRequestHandler implements A2ARequestHandler {
  constructor(
    private readonly options: A2AInboundOptions,
    private readonly trackClientRequest: (clientId: string) => {
      controller: AbortController;
      dispose: () => void;
    },
  ) {}

  async getAgentCard(): Promise<AgentCardValue> {
    const port =
      this.options.database
        .prepare('SELECT port FROM a2a_inbound_config WHERE singleton_id = 1')
        .get<{ port: number }>()?.port ?? 8765;
    return createServerCard(port);
  }

  async getAuthenticatedExtendedAgentCard(
    _params: GetExtendedAgentCardRequest,
    _context: ServerCallContext,
  ): Promise<AgentCardValue> {
    void _params;
    void _context;
    throw new sdkErrors.JsonRpcUnsupportedOperationError({
      message: 'Extended Agent Cards are not supported',
    });
  }

  async sendMessage(params: SendMessageRequest, context: ServerCallContext) {
    const located = await this.acceptMessage(params, context, 'create');
    if (
      params.configuration?.returnImmediately ||
      isInterruptedOrTerminal(located.task) ||
      !located.grant.permissions.includes('get')
    ) {
      return toA2ATask(
        located.task,
        params.configuration?.historyLength,
        this.questionText(located.projectId, located.task),
      );
    }
    return this.waitTask(located.projectId, located.task.taskId, context);
  }

  async *sendMessageStream(params: SendMessageRequest, context: ServerCallContext) {
    const located = await this.acceptMessage(params, context, 'stream');
    const request = this.trackClientRequest(authenticatedClient(context));
    try {
      const authorized = this.findTask(context, located.task.taskId, 'stream');
      yield sdkRoot.StreamResponse.fromJSON({
        task: taskToJSON(authorized.task, this.questionText(authorized.projectId, authorized.task)),
      });
      for await (const event of this.options.tasks.subscribeTaskEvents(
        located.projectId,
        located.task.taskId,
        {
          afterSeq: 0,
          signal: request.controller.signal,
          bufferLimit: 128,
        },
      )) {
        if (request.controller.signal.aborted) return;
        if (event.taskId !== located.task.taskId) continue;
        let current: TaskRecord;
        try {
          current = this.findTask(context, located.task.taskId, 'stream').task;
        } catch {
          return;
        }
        yield sdkRoot.StreamResponse.fromJSON({
          statusUpdate: statusUpdateJSON(current, this.questionText(located.projectId, current)),
        });
        if (isInterruptedOrTerminal(current)) {
          if (current.result?.artifacts.length) {
            yield sdkRoot.StreamResponse.fromJSON({
              task: taskToJSON(current, this.questionText(located.projectId, current)),
            });
          }
          return;
        }
      }
    } catch (error) {
      if (!request.controller.signal.aborted) throw error;
    } finally {
      request.dispose();
    }
  }

  async getTask(params: GetTaskRequest, context: ServerCallContext) {
    const located = this.findTask(context, params.id, 'get');
    return toA2ATask(
      located.task,
      params.historyLength,
      this.questionText(located.projectId, located.task),
    );
  }

  async cancelTask(params: CancelTaskRequest, context: ServerCallContext) {
    const located = this.findTask(context, params.id, 'cancel');
    if (isInterruptedOrTerminal(located.task))
      throw new sdkErrors.JsonRpcTaskNotCancelableError({ message: 'Task is not active' });
    await this.options.tasks.cancel(located.projectId, params.id, 'a2a_client_cancelled');
    const task = this.options.tasks.get(located.projectId, params.id);
    return toA2ATask(task, undefined, this.questionText(located.projectId, task));
  }

  async *resubscribe(params: SubscribeToTaskRequest, context: ServerCallContext) {
    const located = this.findTask(context, params.id, 'stream');
    const request = this.trackClientRequest(authenticatedClient(context));
    try {
      yield sdkRoot.StreamResponse.fromJSON({
        task: taskToJSON(located.task, this.questionText(located.projectId, located.task)),
      });
      if (isInterruptedOrTerminal(located.task)) return;
      for await (const event of this.options.tasks.subscribeTaskEvents(
        located.projectId,
        located.task.taskId,
        {
          afterSeq: 0,
          signal: request.controller.signal,
          bufferLimit: 128,
        },
      )) {
        if (request.controller.signal.aborted) return;
        if (event.taskId !== located.task.taskId) continue;
        let current: TaskRecord;
        try {
          current = this.findTask(context, located.task.taskId, 'stream').task;
        } catch {
          return;
        }
        yield sdkRoot.StreamResponse.fromJSON({
          statusUpdate: statusUpdateJSON(current, this.questionText(located.projectId, current)),
        });
        if (isInterruptedOrTerminal(current)) {
          if (current.result?.artifacts.length) {
            yield sdkRoot.StreamResponse.fromJSON({
              task: taskToJSON(current, this.questionText(located.projectId, current)),
            });
          }
          return;
        }
      }
    } catch (error) {
      if (!request.controller.signal.aborted) throw error;
    } finally {
      request.dispose();
    }
  }

  async listTasks(
    _params: ListTasksRequest,
    _context: ServerCallContext,
  ): Promise<ListTasksResponse> {
    void _params;
    void _context;
    throw new sdkErrors.JsonRpcUnsupportedOperationError({
      message: 'Task listing is not supported; use getTask with a granted task ID',
    });
  }

  async createTaskPushNotificationConfig(
    _params: TaskPushNotificationConfig,
    _context: ServerCallContext,
  ): Promise<TaskPushNotificationConfig> {
    void _params;
    void _context;
    throw new sdkErrors.JsonRpcUnsupportedOperationError({
      message: 'Push notifications are not supported',
    });
  }

  async getTaskPushNotificationConfig(
    _params: GetTaskPushNotificationConfigRequest,
    _context: ServerCallContext,
  ): Promise<TaskPushNotificationConfig> {
    void _params;
    void _context;
    throw new sdkErrors.JsonRpcUnsupportedOperationError({
      message: 'Push notifications are not supported',
    });
  }

  async listTaskPushNotificationConfigs(
    _params: ListTaskPushNotificationConfigsRequest,
    _context: ServerCallContext,
  ): Promise<ListTaskPushNotificationConfigsResponse> {
    void _params;
    void _context;
    throw new sdkErrors.JsonRpcUnsupportedOperationError({
      message: 'Push notifications are not supported',
    });
  }

  async deleteTaskPushNotificationConfig(
    _params: DeleteTaskPushNotificationConfigRequest,
    _context: ServerCallContext,
  ): Promise<void> {
    void _params;
    void _context;
    throw new sdkErrors.JsonRpcUnsupportedOperationError({
      message: 'Push notifications are not supported',
    });
  }

  private async acceptMessage(
    params: SendMessageRequest,
    context: ServerCallContext,
    mode: 'create' | 'stream',
  ): Promise<LocatedTask> {
    const clientId = authenticatedClient(context);
    const message = params.message;
    const content = messageText(message);
    if (content.length > MAX_TEXT_LENGTH) throw new Error('A2A message exceeds size limit');
    const taskId = message?.taskId?.trim();
    let located: LocatedTask;
    if (taskId) {
      located = this.findTask(context, taskId, 'continue');
      const input = asRecord(located.task.input);
      const a2a = asRecord(input.a2a);
      if (message?.contextId && message.contextId !== a2a.contextId) {
        throw new sdkErrors.JsonRpcTaskNotFoundError({ message: 'Task not found or not granted' });
      }
      if (mode === 'stream' && !located.grant.permissions.includes('stream')) {
        throw new sdkErrors.JsonRpcTaskNotFoundError({ message: 'No stream grant for this task' });
      }
      const task = await this.options.tasks.continueExternalTask(
        located.projectId,
        taskId,
        content,
      );
      this.assertTaskMatchesGrant(task, located.grant, clientId, String(a2a.contextId ?? ''));
      located = { ...located, task };
    } else {
      const projectId = readProjectId(params.metadata, message?.metadata);
      const client = this.client(clientId);
      const grant = client.grants.find(
        (item) =>
          item.projectId === projectId &&
          item.permissions.includes('create') &&
          item.taskKinds.includes('agent.run'),
      );
      if (!grant)
        throw new sdkErrors.JsonRpcTaskNotFoundError({
          message: 'No grant permits task creation for this Project',
        });
      if (mode === 'stream' && !grant.permissions.includes('stream'))
        throw new sdkErrors.JsonRpcTaskNotFoundError({
          message: 'No stream grant for this Project',
        });
      located = this.createTask(client, grant, content, message?.contextId ?? '');
    }
    return located;
  }

  private createTask(
    client: A2AInboundClient,
    grant: A2AProjectGrant,
    content: string,
    requestedContextId: string,
  ): LocatedTask {
    const contextId = validContextId(requestedContextId) ? requestedContextId : uuidv7();
    const created = this.options.tasks.create({
      projectId: grant.projectId,
      kind: 'agent.run',
      title: content.slice(0, 120) || 'A2A delegated task',
      goal: content,
      role: grant.role,
      assignee: { role: grant.role, accessCeiling: 'ask-always' },
      input: { a2a: { clientId: client.clientId, contextId } },
    });
    const createdTask = created.task;
    this.assertTaskMatchesGrant(createdTask, grant, client.clientId, contextId);
    return { projectId: grant.projectId, grant, task: createdTask };
  }

  private assertTaskMatchesGrant(
    task: TaskRecord,
    grant: A2AProjectGrant,
    clientId: string,
    contextId: string,
  ): void {
    if (
      task.projectId !== grant.projectId ||
      task.kind !== 'agent.run' ||
      (task.role ?? task.assignee?.role) !== grant.role ||
      taskA2AClientId(task) !== clientId ||
      taskA2AContextId(task) !== contextId
    ) {
      throw new sdkErrors.JsonRpcTaskNotFoundError({
        message: 'Task not found or not granted',
      });
    }
  }

  private findTask(
    context: ServerCallContext,
    taskId: string,
    permission: A2AProjectGrant['permissions'][number],
  ): LocatedTask {
    const client = this.client(authenticatedClient(context));
    for (const grant of client.grants) {
      if (!grant.permissions.includes(permission)) continue;
      try {
        const task = this.options.tasks.get(grant.projectId, taskId);
        if (
          task.kind !== 'agent.run' ||
          (task.role ?? task.assignee?.role) !== grant.role ||
          taskA2AClientId(task) !== client.clientId
        )
          continue;
        return { projectId: grant.projectId, grant, task };
      } catch {
        // The task is outside this grant; continue without leaking its existence.
      }
    }
    throw new sdkErrors.JsonRpcTaskNotFoundError({ message: 'Task not found or not granted' });
  }

  private client(clientId: string): A2AInboundClient {
    const row = this.options.database
      .prepare(
        `SELECT client_id AS clientId, name, grants_json AS grantsJson,
          token_hash AS tokenHash, revoked_at AS revokedAt,
          created_at AS createdAt, updated_at AS updatedAt
         FROM a2a_inbound_clients WHERE client_id = ? AND revoked_at IS NULL AND token_hash IS NOT NULL`,
      )
      .get<ClientRow>(clientId);
    if (!row)
      throw new sdkErrors.JsonRpcTaskNotFoundError({ message: 'A2A client grant was revoked' });
    return {
      schemaVersion: 1,
      clientId: row.clientId,
      name: row.name,
      grants: JSON.parse(row.grantsJson) as A2AProjectGrant[],
      credentialConfigured: true,
      revokedAt: null,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    };
  }

  private questionText(projectId: string, task: TaskRecord): string | undefined {
    const question = this.options.tasks.pendingQuestionForTask(projectId, task.taskId);
    if (!question) return undefined;
    const options = question.options ?? [];
    const choices = options.length ? `\nOptions: ${options.slice(0, 32).join(', ')}` : '';
    return `${question.prompt}${choices}`.slice(0, MAX_TEXT_LENGTH);
  }

  private async waitTask(
    projectId: string,
    taskId: string,
    context: ServerCallContext,
  ): Promise<ReturnType<typeof toA2ATask>> {
    const located = this.findTask(context, taskId, 'get');
    if (located.projectId !== projectId)
      throw new sdkErrors.JsonRpcTaskNotFoundError({ message: 'Task not found or not granted' });
    const task = located.task;
    if (isInterruptedOrTerminal(task))
      return toA2ATask(task, undefined, this.questionText(projectId, task));
    const request = this.trackClientRequest(authenticatedClient(context));
    const controller = request.controller;
    context.state.set('a2a.abort', controller);
    const timeout = setTimeout(() => controller.abort('A2A blocking request timed out'), 120_000);
    timeout.unref();
    try {
      for await (const event of this.options.tasks.subscribeTaskEvents(projectId, taskId, {
        afterSeq: 0,
        signal: controller.signal,
        bufferLimit: 128,
      })) {
        if (event.taskId !== taskId) continue;
        const current = this.findTask(context, taskId, 'get').task;
        if (isInterruptedOrTerminal(current))
          return toA2ATask(current, undefined, this.questionText(projectId, current));
      }
      const current = this.findTask(context, taskId, 'get').task;
      return toA2ATask(current, undefined, this.questionText(projectId, current));
    } catch (error) {
      if (
        controller.signal.aborted &&
        controller.signal.reason === 'A2A blocking request timed out'
      ) {
        const current = this.findTask(context, taskId, 'get').task;
        return toA2ATask(current, undefined, this.questionText(projectId, current));
      }
      throw error;
    } finally {
      clearTimeout(timeout);
      request.dispose();
    }
  }
}

function createServerCard(port: number): AgentCardValue {
  return sdkRoot.AgentCard.fromJSON({
    name: 'PlayWeld Platform Agent Gateway',
    description: 'Local, project-scoped A2A v1.0 task gateway.',
    version: '1.0.0',
    supportedInterfaces: [
      {
        url: `http://127.0.0.1:${port}/a2a`,
        protocolBinding: 'JSONRPC',
        protocolVersion: '1.0',
        tenant: '',
      },
    ],
    capabilities: {
      streaming: true,
      pushNotifications: false,
      extensions: [],
      extendedAgentCard: false,
    },
    securitySchemes: {
      bearer: {
        httpAuthSecurityScheme: {
          scheme: 'Bearer',
          description: 'Per-client revocable token',
          bearerFormat: '',
        },
      },
    },
    securityRequirements: [{ schemes: { bearer: { list: [] } } }],
    defaultInputModes: ['text/plain'],
    defaultOutputModes: ['text/plain'],
    skills: [
      {
        id: 'project-task',
        name: 'Project task',
        description: 'Create and continue granted Project tasks.',
        tags: ['task'],
        examples: [],
        inputModes: ['text/plain'],
        outputModes: ['text/plain'],
        securityRequirements: [],
      },
    ],
    provider: { url: 'https://playweld.com', organization: 'PlayWeld' },
  });
}

function validateGrants(
  grants: A2AProjectGrant[],
  projects: ProfileStore,
  roles: RoleRegistry,
): A2AProjectGrant[] {
  const unique = new Set<string>();
  for (const grant of grants) {
    if (!projects.getById(grant.projectId))
      throw new RpcError(`Project not found: ${grant.projectId}`, RpcErrorCode.ProjectNotFound);
    roles.get(grant.role, grant.projectId);
    if (unique.has(grant.projectId))
      throw new Error('A2A client grants may contain each Project once');
    unique.add(grant.projectId);
  }
  return grants.map((grant) => ({
    ...grant,
    taskKinds: ['agent.run'],
    permissions: [...new Set(grant.permissions)],
  }));
}

function authenticatedClient(context: ServerCallContext): string {
  const user = context.user;
  if (!user?.isAuthenticated || !user.userName) throw new Error('Unauthorized');
  return user.userName;
}

function parseBearer(value: string | undefined): string | undefined {
  const match = value && /^Bearer ([A-Za-z0-9_-]{32,128})$/.exec(value);
  return match?.[1];
}

function hashToken(token: string): string {
  return createHash('sha256').update(token, 'utf8').digest('hex');
}

function readProjectId(...metadata: Array<Record<string, unknown> | undefined>): string {
  for (const item of metadata) {
    const projectId = item?.projectId;
    if (typeof projectId === 'string') return projectId;
  }
  throw new sdkErrors.JsonRpcTaskNotFoundError({
    message: 'Task creation requires a granted Project ID in request metadata',
  });
}

function messageText(message: SendMessageRequest['message']): string {
  if (
    !message ||
    message.role !== sdkRoot.Role.ROLE_USER ||
    message.parts.length === 0 ||
    message.parts.length > 8
  ) {
    throw new Error('A2A requests must contain a user message with 1-8 text parts');
  }
  const text = message.parts
    .map((part) => {
      if (part.content?.$case !== 'text' || typeof part.content.value !== 'string') {
        throw new Error('Only text/plain A2A message parts are supported');
      }
      return part.content.value;
    })
    .join('\n')
    .trim();
  if (!text) throw new Error('A2A message text cannot be empty');
  if (text.length > MAX_TEXT_LENGTH) throw new Error('A2A message exceeds size limit');
  return text;
}

function validContextId(value: string | undefined): value is string {
  return typeof value === 'string' && /^[A-Za-z0-9._:-]{1,128}$/.test(value);
}

function asRecord(value: unknown): Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function taskToJSON(task: TaskRecord, questionText?: string) {
  const contextId = taskContextId(task);
  const history = [
    sdkRoot.Message.fromJSON({
      messageId: `${task.taskId}-user`,
      contextId,
      taskId: task.taskId,
      role: 'ROLE_USER',
      parts: [{ text: task.goal.slice(0, MAX_TEXT_LENGTH) }],
    }),
  ];
  if (task.result?.summary)
    history.push(
      sdkRoot.Message.fromJSON({
        messageId: `${task.taskId}-agent`,
        contextId,
        taskId: task.taskId,
        role: 'ROLE_AGENT',
        parts: [{ text: task.result.summary.slice(0, MAX_TEXT_LENGTH) }],
      }),
    );
  return {
    id: task.taskId,
    contextId,
    status: statusJSON(task, questionText),
    artifacts: (task.result?.artifacts ?? []).slice(0, 64).map((artifact, index) => ({
      artifactId: artifact.hash?.slice(0, 128) || `${task.taskId}-artifact-${index}`,
      name: artifact.kind.slice(0, 128),
      description: artifact.hash ? `Hash ${artifact.hash.slice(0, 128)}` : '',
      parts: [
        { text: `${artifact.kind}${artifact.hash ? ` (${artifact.hash.slice(0, 128)})` : ''}` },
      ],
    })),
    history,
    metadata: undefined,
  };
}

function toA2ATask(task: TaskRecord, historyLength?: number, questionText?: string) {
  const data = taskToJSON(task, questionText);
  if (historyLength === 0) data.history = [];
  else if (historyLength !== undefined)
    data.history = data.history.slice(-Math.max(0, Math.min(20, historyLength)));
  return sdkRoot.Task.fromJSON(data);
}

function statusJSON(task: TaskRecord, questionText?: string) {
  const state: Record<TaskRecord['state'], string> = {
    pending: 'TASK_STATE_SUBMITTED',
    ready: 'TASK_STATE_WORKING',
    claimed: 'TASK_STATE_WORKING',
    running: 'TASK_STATE_WORKING',
    waiting_input: 'TASK_STATE_INPUT_REQUIRED',
    blocked: 'TASK_STATE_REJECTED',
    succeeded: 'TASK_STATE_COMPLETED',
    failed: 'TASK_STATE_FAILED',
    cancelled: 'TASK_STATE_CANCELED',
  };
  const text = questionText ?? task.result?.summary ?? task.error?.message;
  return {
    state: state[task.state],
    timestamp: task.updatedAt,
    ...(text
      ? {
          message: {
            messageId: `${task.taskId}-status`,
            contextId: taskContextId(task),
            taskId: task.taskId,
            role: 'ROLE_AGENT',
            parts: [{ text: text.slice(0, MAX_TEXT_LENGTH) }],
          },
        }
      : {}),
  };
}

function taskContextId(task: TaskRecord): string {
  const external = asRecord(asRecord(task.input).a2a);
  return typeof external.contextId === 'string' ? external.contextId : task.rootTaskId;
}

function statusUpdateJSON(task: TaskRecord, questionText?: string) {
  const data = taskToJSON(task, questionText);
  return {
    taskId: task.taskId,
    contextId: data.contextId,
    status: statusJSON(task, questionText),
    metadata: undefined,
  };
}

function taskA2AClientId(task: TaskRecord): string | undefined {
  const clientId = asRecord(asRecord(task.input).a2a).clientId;
  return typeof clientId === 'string' ? clientId : undefined;
}

function taskA2AContextId(task: TaskRecord): string | undefined {
  const contextId = asRecord(asRecord(task.input).a2a).contextId;
  return typeof contextId === 'string' ? contextId : undefined;
}

function isInterruptedOrTerminal(task: TaskRecord): boolean {
  return (
    task.state === 'waiting_input' ||
    ['succeeded', 'failed', 'cancelled', 'blocked'].includes(task.state)
  );
}

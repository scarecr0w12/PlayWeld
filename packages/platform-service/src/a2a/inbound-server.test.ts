import { createHash } from 'node:crypto';
import { createServer, request as httpRequest, type Server } from 'node:http';
import { afterEach, describe, expect, it } from 'vitest';
import { uuidv7, type TaskEvent, type TaskRecord } from '@gamecrafter/contracts';
import { Database } from '../db/database';
import { migrate } from '../db/migrator';
import { profileMigrations } from '../profile/migrations';
import type { ProfileStore } from '../profile/profile-store';
import type { RoleRegistry } from '../roles/role-registry';
import type { TaskService } from '../tasks/task-service';
import { A2AInboundServer } from './inbound-server';

const servers: A2AInboundServer[] = [];
const databases: Database[] = [];

interface TestRpcResponse {
  result: {
    task: { id: string; status: { state: string } };
    id: string;
    status: { state: string; message?: { parts?: Array<{ text?: string }> } };
  };
  error: { code: number };
  text: string;
}

afterEach(async () => {
  for (const server of servers.splice(0)) await server.stop();
  for (const database of databases.splice(0)) database.close();
});

describe('A2A inbound loopback gateway', () => {
  it('binds only to IPv4 loopback, validates host/origin, scopes tokens and revokes them', async () => {
    const fixture = createInboundFixture();
    const port = await availableLoopbackPort();
    await fixture.gateway.configure(true, port);
    const bound = (fixture.gateway as unknown as { server: Server }).server.address();
    expect(bound).toMatchObject({ address: '127.0.0.1', family: 'IPv4', port });

    const projectA = uuidv7();
    const projectB = uuidv7();
    fixture.projectIds.add(projectA);
    fixture.projectIds.add(projectB);
    const clientA = fixture.gateway.upsertClient({
      name: 'client A',
      grants: [grant(projectA)],
    });
    const clientB = fixture.gateway.upsertClient({
      name: 'client B',
      grants: [grant(projectB)],
    });
    const issuedA = fixture.gateway.issueToken(clientA.clientId);
    const issuedB = fixture.gateway.issueToken(clientB.clientId);

    const profileDb = fixture.database;
    const stored = profileDb
      .prepare('SELECT token_hash AS tokenHash FROM a2a_inbound_clients WHERE client_id = ?')
      .get<{ tokenHash: string }>(clientA.clientId)?.tokenHash;
    expect(stored).toBe(createHash('sha256').update(issuedA.token).digest('hex'));
    expect(JSON.stringify(fixture.gateway.listClients())).not.toContain(issuedA.token);
    expect(JSON.stringify(fixture.gateway.listClients())).not.toContain('tokenHash');

    const card = await fetch(`http://127.0.0.1:${port}/.well-known/agent-card.json`);
    expect(card.status).toBe(200);
    expect(card.headers.get('access-control-allow-origin')).toBeNull();
    expect((await card.json()).supportedInterfaces[0]).toMatchObject({
      url: `http://127.0.0.1:${port}/a2a`,
      protocolBinding: 'JSONRPC',
      protocolVersion: '1.0',
    });

    expect(await requestWithHost(port, `localhost:${port}`)).toBe(403);
    expect(
      (
        await request(port, issuedA.token, 'SendMessage', sendParams(projectA), {
          origin: 'https://evil.example',
        })
      ).status,
    ).toBe(403);
    expect((await request(port, 'wrong-token', 'SendMessage', sendParams(projectA))).status).toBe(
      401,
    );

    const createdA = await request(port, issuedA.token, 'SendMessage', sendParams(projectA));
    expect(createdA.body).toHaveProperty('result.task');
    expect(createdA.body.result.task.status.state).toBe('TASK_STATE_WORKING');
    const taskA = createdA.body.result.task.id as string;
    expect(fixture.fakeTasks.get(taskA)?.assignee.accessCeiling).toBe('ask-always');
    const createdB = await request(port, issuedB.token, 'SendMessage', sendParams(projectB));
    const taskB = createdB.body.result.task.id as string;
    expect(taskB).not.toBe(taskA);

    const getA = await request(port, issuedA.token, 'GetTask', { id: taskA });
    expect(getA.body.result.id).toBe(taskA);
    const crossProject = await request(port, issuedA.token, 'GetTask', { id: taskB });
    expect(crossProject.body.error.code).toBe(-32001);
    const crossProjectCreate = await request(
      port,
      issuedA.token,
      'SendMessage',
      sendParams(projectB),
    );
    expect(crossProjectCreate.body.error).toBeDefined();

    const stream = await request(port, issuedA.token, 'SendStreamingMessage', sendParams(projectA));
    expect(stream.headers.get('content-type')).toContain('text/event-stream');
    expect(stream.body.text).toContain('"task"');
    expect(stream.body.text).toContain('"statusUpdate"');

    const unsupported = await request(port, issuedA.token, 'ListTasks', {});
    expect(unsupported.body.error.code).toBe(-32004);

    fixture.fakeTasks.markWaiting(taskA);
    const waiting = await request(port, issuedA.token, 'GetTask', { id: taskA });
    expect(waiting.body.result.status.message?.parts?.[0]?.text).toContain('Answer?');
    const continued = await request(
      port,
      issuedA.token,
      'SendMessage',
      sendParams(projectA, taskA, 'ctx-A', 'answer'),
    );
    expect(continued.body.result.task.id).toBe(taskA);
    expect(fixture.fakeTasks.answers).toContainEqual({ taskId: taskA, answer: 'answer' });

    const noQuestionTask = await request(port, issuedA.token, 'SendMessage', sendParams(projectA));
    const activeId = noQuestionTask.body.result.task.id as string;
    const rejectedContinuation = await request(
      port,
      issuedA.token,
      'SendMessage',
      sendParams(projectA, activeId, 'ctx-A', 'not an approval'),
    );
    expect(rejectedContinuation.body.error).toBeDefined();
    expect(fixture.fakeTasks.answers.some((entry) => entry.taskId === activeId)).toBe(false);

    const cancelled = await request(port, issuedA.token, 'CancelTask', { id: activeId });
    expect(cancelled.body.result.status.state).toBe('TASK_STATE_CANCELED');
    expect(fixture.fakeTasks.cancelled).toContain(activeId);

    fixture.gateway.revokeClient(clientA.clientId);
    expect((await request(port, issuedA.token, 'GetTask', { id: taskA })).status).toBe(401);
    expect((await request(port, issuedB.token, 'GetTask', { id: taskB })).status).toBe(200);
  });

  it('cleans up the listener before its database is closed', async () => {
    const fixture = createInboundFixture();
    const port = await availableLoopbackPort();
    await fixture.gateway.configure(true, port);
    await fixture.gateway.stop();
    expect(fixture.gateway.active).toBe(false);
    expect(() => fixture.database.prepare('SELECT 1').get()).not.toThrow();
    await expect(fetch(`http://127.0.0.1:${port}/.well-known/agent-card.json`)).rejects.toThrow();
  });

  it('rejects malformed JSON without exposing parser details', async () => {
    const fixture = createInboundFixture();
    const port = await availableLoopbackPort();
    await fixture.gateway.configure(true, port);
    const projectId = uuidv7();
    fixture.projectIds.add(projectId);
    const client = fixture.gateway.upsertClient({
      name: 'malformed-json-client',
      grants: [grant(projectId)],
    });
    const token = fixture.gateway.issueToken(client.clientId).token;
    const response = await fetch(`http://127.0.0.1:${port}/a2a`, {
      method: 'POST',
      headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
      body: '{ malformed',
    });
    expect(response.status).toBe(200);
    const body = (await response.json()) as { error?: { code?: number; message?: string } };
    expect(body.error?.code).toBe(-32700);
    expect(body.error?.message).toBe('Invalid JSON payload.');
  });

  it('ends an active event stream immediately when its client token is revoked', async () => {
    const fixture = createInboundFixture();
    const port = await availableLoopbackPort();
    await fixture.gateway.configure(true, port);
    const projectId = uuidv7();
    fixture.projectIds.add(projectId);
    const client = fixture.gateway.upsertClient({
      name: 'stream client',
      grants: [grant(projectId)],
    });
    const token = fixture.gateway.issueToken(client.clientId).token;
    fixture.fakeTasks.blockStreams();
    const subscribed = fixture.fakeTasks.waitForStreamSubscription();

    const response = await fetch(`http://127.0.0.1:${port}/a2a`, {
      method: 'POST',
      headers: {
        authorization: `Bearer ${token}`,
        'content-type': 'application/json',
        'A2A-Version': '1.0',
      },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 'revoke-stream',
        method: 'SendStreamingMessage',
        params: sendParams(projectId),
      }),
    });
    expect(response.status).toBe(200);
    await subscribed;
    const reader = response.body?.getReader();
    expect(reader).toBeDefined();
    fixture.gateway.revokeClient(client.clientId);

    let content = '';
    const decoder = new TextDecoder();
    let done = false;
    while (!done) {
      const result = await reader!.read();
      done = result.done;
      if (result.value) content += decoder.decode(result.value);
    }
    expect(content).toContain('statusUpdate');
    expect(fixture.fakeTasks.lastStreamSignal?.aborted).toBe(true);
  }, 10_000);

  it('ends an active event stream when the client grant changes', async () => {
    const fixture = createInboundFixture();
    const port = await availableLoopbackPort();
    await fixture.gateway.configure(true, port);
    const projectId = uuidv7();
    fixture.projectIds.add(projectId);
    const client = fixture.gateway.upsertClient({
      name: 'grant-change client',
      grants: [grant(projectId)],
    });
    const token = fixture.gateway.issueToken(client.clientId).token;
    fixture.fakeTasks.blockStreams();
    const subscribed = fixture.fakeTasks.waitForStreamSubscription();
    const response = await fetch(`http://127.0.0.1:${port}/a2a`, {
      method: 'POST',
      headers: {
        authorization: `Bearer ${token}`,
        'content-type': 'application/json',
        'A2A-Version': '1.0',
      },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 'grant-change-stream',
        method: 'SendStreamingMessage',
        params: sendParams(projectId),
      }),
    });
    expect(response.status).toBe(200);
    await subscribed;
    fixture.gateway.upsertClient({
      clientId: client.clientId,
      name: 'grant-change client',
      grants: [grant(projectId, 'designer')],
    });
    const reader = response.body!.getReader();
    while (!(await reader.read()).done) {
      // Drain any pre-change events already buffered by the loopback transport.
    }
    expect(fixture.fakeTasks.lastStreamSignal?.aborted).toBe(true);
  }, 10_000);

  it('does not share authenticated A2A rate limits with unauthenticated loopback requests', async () => {
    const fixture = createInboundFixture();
    const port = await availableLoopbackPort();
    await fixture.gateway.configure(true, port);
    const projectId = uuidv7();
    fixture.projectIds.add(projectId);
    const client = fixture.gateway.upsertClient({
      name: 'rate-limit client',
      grants: [grant(projectId)],
    });
    const token = fixture.gateway.issueToken(client.clientId).token;
    const created = await request(port, token, 'SendMessage', sendParams(projectId));
    const taskId = created.body.result.task.id;

    let lastUnauthenticated = 0;
    for (let index = 0; index < 121; index += 1) {
      lastUnauthenticated = (await request(port, 'not-a-token', 'GetTask', { id: taskId })).status;
    }
    expect(lastUnauthenticated).toBe(429);
    expect((await request(port, token, 'GetTask', { id: taskId })).status).toBe(200);
  }, 15_000);

  it('does not return a deduplicated task outside the client role or ownership grant', async () => {
    const fixture = createInboundFixture();
    const port = await availableLoopbackPort();
    await fixture.gateway.configure(true, port);
    const projectId = uuidv7();
    fixture.projectIds.add(projectId);
    const client = fixture.gateway.upsertClient({
      name: 'role-scoped client',
      grants: [grant(projectId, 'explorer')],
    });
    const token = fixture.gateway.issueToken(client.clientId).token;

    const otherRole = fixture.fakeTasks.seedTask({
      projectId,
      role: 'designer',
      goal: 'cross-role duplicate goal',
      clientId: 'another-client',
    });
    fixture.fakeTasks.markWaiting(otherRole.taskId);
    fixture.fakeTasks.setDeduplication(otherRole);
    const crossRole = await request(
      port,
      token,
      'SendMessage',
      sendParams(projectId, '', 'ctx-A', 'cross-role duplicate goal'),
    );
    expect(crossRole.body.error.code).not.toBe(0);
    expect(JSON.stringify(crossRole.body)).not.toContain('Answer?');
    expect(JSON.stringify(crossRole.body)).not.toContain(otherRole.taskId);

    const otherClient = fixture.fakeTasks.seedTask({
      projectId,
      role: 'explorer',
      goal: 'cross-client duplicate goal',
      clientId: 'another-client',
    });
    fixture.fakeTasks.setDeduplication(otherClient);
    const crossClient = await request(
      port,
      token,
      'SendMessage',
      sendParams(projectId, '', 'ctx-A', 'cross-client duplicate goal'),
    );
    expect(crossClient.body.error.code).not.toBe(0);
    expect(JSON.stringify(crossClient.body)).not.toContain(otherClient.taskId);

    const secondProjectId = uuidv7();
    fixture.projectIds.add(secondProjectId);
    const otherProjectTask = fixture.fakeTasks.seedTask({
      projectId,
      role: 'explorer',
      goal: 'cross-project duplicate goal',
      clientId: 'another-client',
    });
    fixture.fakeTasks.setDeduplication(otherProjectTask);
    const otherProjectClient = fixture.gateway.upsertClient({
      name: 'second project client',
      grants: [grant(secondProjectId, 'explorer')],
    });
    const otherProjectToken = fixture.gateway.issueToken(otherProjectClient.clientId).token;
    const crossProject = await request(
      port,
      otherProjectToken,
      'SendMessage',
      sendParams(secondProjectId, '', 'ctx-B', 'cross-project duplicate goal'),
    );
    expect(crossProject.body.error.code).not.toBe(0);
    expect(JSON.stringify(crossProject.body)).not.toContain(otherProjectTask.taskId);
  });

  it('rejects a failed-task retry that deduplicates into another A2A context', async () => {
    const fixture = createInboundFixture();
    const port = await availableLoopbackPort();
    await fixture.gateway.configure(true, port);
    const projectId = uuidv7();
    fixture.projectIds.add(projectId);
    const firstClient = fixture.gateway.upsertClient({
      name: 'first retry client',
      grants: [grant(projectId)],
    });
    const secondClient = fixture.gateway.upsertClient({
      name: 'second retry client',
      grants: [grant(projectId)],
    });
    const firstToken = fixture.gateway.issueToken(firstClient.clientId).token;
    const failedTaskResult = await request(
      port,
      firstToken,
      'SendMessage',
      sendParams(projectId, '', 'ctx-first', 'shared failed goal'),
    );
    const failedTaskId = failedTaskResult.body.result.task.id;
    fixture.fakeTasks.markFailed(failedTaskId);
    const otherContextTask = fixture.fakeTasks.seedTask({
      projectId,
      role: 'explorer',
      goal: 'shared failed goal',
      clientId: secondClient.clientId,
      contextId: 'ctx-second',
    });
    fixture.fakeTasks.setDeduplication(otherContextTask);

    const retry = await request(
      port,
      firstToken,
      'SendMessage',
      sendParams(projectId, failedTaskId, 'ctx-first', 'retry feedback'),
    );

    expect(retry.body.error.code).not.toBe(0);
    expect(JSON.stringify(retry.body)).not.toContain(otherContextTask.taskId);
    expect(JSON.stringify(retry.body)).not.toContain('ctx-second');
  });

  it('returns the created task receipt when the client has create but not get', async () => {
    const fixture = createInboundFixture();
    const port = await availableLoopbackPort();
    await fixture.gateway.configure(true, port);
    const projectId = uuidv7();
    fixture.projectIds.add(projectId);
    const client = fixture.gateway.upsertClient({
      name: 'create-only client',
      grants: [grant(projectId, 'explorer', ['create'])],
    });
    const token = fixture.gateway.issueToken(client.clientId).token;
    const params = sendParams(projectId, '', 'ctx-create-only', 'create task without get');
    params.configuration.returnImmediately = false;

    const created = await request(port, token, 'SendMessage', params);
    const taskId = created.body.result.task.id;
    expect(taskId).toBeTruthy();
    expect(created.body.result.task.status.state).toBe('TASK_STATE_WORKING');
    expect((await request(port, token, 'GetTask', { id: taskId })).body.error.code).not.toBe(0);
  });

  it('includes artifacts produced after the initial A2A streaming task response', async () => {
    const fixture = createInboundFixture();
    const port = await availableLoopbackPort();
    await fixture.gateway.configure(true, port);
    const projectId = uuidv7();
    fixture.projectIds.add(projectId);
    const client = fixture.gateway.upsertClient({
      name: 'artifact stream client',
      grants: [grant(projectId)],
    });
    const token = fixture.gateway.issueToken(client.clientId).token;
    fixture.fakeTasks.blockStreams();
    const subscribed = fixture.fakeTasks.waitForStreamSubscription();
    const response = await fetch(`http://127.0.0.1:${port}/a2a`, {
      method: 'POST',
      headers: {
        authorization: `Bearer ${token}`,
        'content-type': 'application/json',
        'A2A-Version': '1.0',
      },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 'artifact-stream',
        method: 'SendStreamingMessage',
        params: sendParams(projectId),
      }),
    });
    await subscribed;
    const taskId = fixture.fakeTasks.lastCreatedTaskId;
    fixture.fakeTasks.completeWithArtifact(taskId);

    const reader = response.body!.getReader();
    let content = '';
    const decoder = new TextDecoder();
    let done = false;
    while (!done) {
      const result = await reader.read();
      done = result.done;
      if (result.value) content += decoder.decode(result.value);
    }
    expect(content).toContain(taskId);
    expect(content).toContain('artifact-after-work');
  }, 10_000);
});

function createInboundFixture() {
  const database = Database.open(':memory:');
  databases.push(database);
  migrate(database, profileMigrations);
  const projectIds = new Set<string>();
  const roles = { get: (role: string) => ({ name: role }) } as unknown as RoleRegistry;
  const projects = {
    getById: (projectId: string) => (projectIds.has(projectId) ? { projectId } : undefined),
  } as unknown as ProfileStore;
  const fakeTasks = createFakeTasks();
  const gateway = new A2AInboundServer({
    database,
    projects,
    roles,
    tasks: fakeTasks.service,
    now: () => new Date('2026-10-04T12:00:00.000Z'),
  });
  servers.push(gateway);
  return { database, projectIds, fakeTasks, gateway };
}

function createFakeTasks() {
  const records = new Map<string, TaskRecord>();
  const eventLog = new Map<string, TaskEvent[]>();
  const answers: Array<{ taskId: string; answer: string }> = [];
  const cancelled: string[] = [];
  let duplicateTask: TaskRecord | undefined;
  let blockStreams = false;
  let streamSubscribed: (() => void) | undefined;
  let lastStreamSignal: AbortSignal | undefined;
  const streamWaiters = new Set<() => void>();
  const appendEvent = (task: TaskRecord, kind: string): void => {
    const events = eventLog.get(task.projectId) ?? [];
    events.push({
      eventId: uuidv7(),
      seq: events.length + 1,
      taskId: task.taskId,
      kind,
      occurredAt: task.updatedAt,
      actor: 'test',
      payload: {},
    });
    eventLog.set(task.projectId, events);
    for (const wake of streamWaiters) wake();
  };
  const service = {
    create(input: {
      projectId: string;
      kind: string;
      title: string;
      goal: string;
      role: string;
      assignee: { role: string };
      input: unknown;
    }) {
      if (duplicateTask?.goal === input.goal) {
        const task = duplicateTask;
        duplicateTask = undefined;
        return { task, deduplicated: true };
      }
      const now = new Date().toISOString();
      const task: TaskRecord = {
        schemaVersion: 1,
        taskId: uuidv7(),
        projectId: input.projectId,
        parentTaskId: null,
        rootTaskId: '',
        depth: 0,
        kind: input.kind,
        title: input.title,
        goal: input.goal,
        goalHash: 'fake-hash',
        state: 'ready',
        priority: 50,
        dependsOn: [],
        assignee: { role: input.assignee.role, accessCeiling: 'ask-always' },
        role: input.role,
        budget: {},
        spent: { costUsd: 0, tokens: 0 },
        attempt: 1,
        maxAttempts: 3,
        lease: null,
        input: input.input,
        checkpoint: null,
        result: null,
        error: null,
        createdAt: now,
        updatedAt: now,
        startedAt: null,
        finishedAt: null,
      };
      task.rootTaskId = task.taskId;
      records.set(task.taskId, task);
      appendEvent(task, 'task.created');
      appendEvent(task, 'task.state_changed');
      return { task, deduplicated: false };
    },
    get(projectId: string, taskId: string) {
      const task = records.get(taskId);
      if (!task || task.projectId !== projectId) throw new Error('not found');
      return task;
    },
    async continueExternalTask(projectId: string, taskId: string, answer: string) {
      const task = this.get(projectId, taskId);
      if (task.state === 'waiting_input') {
        answers.push({ taskId, answer });
        const next = { ...task, state: 'running' as const, updatedAt: new Date().toISOString() };
        records.set(taskId, next);
        appendEvent(next, 'task.answer');
        return next;
      }
      if (task.state === 'failed') {
        const originalInput =
          task.input && typeof task.input === 'object'
            ? (task.input as Record<string, unknown>)
            : {};
        return this.create({
          projectId: task.projectId,
          kind: task.kind,
          title: `${task.title} (retry)`,
          goal: task.goal,
          parentTaskId: task.parentTaskId ?? undefined,
          role: task.role ?? undefined,
          assignee: task.assignee ?? undefined,
          input: { ...originalInput, feedback: answer },
        }).task;
      }
      throw new Error('Task cannot be continued without a pending question');
    },
    async cancel(projectId: string, taskId: string) {
      const task = this.get(projectId, taskId);
      const next = { ...task, state: 'cancelled' as const, updatedAt: new Date().toISOString() };
      records.set(taskId, next);
      cancelled.push(taskId);
      appendEvent(next, 'task.cancelled');
      return { cancelled: [taskId] };
    },
    eventsForProject(
      projectId: string,
      filter: { taskId?: string; afterSeq?: number; limit?: number } = {},
    ) {
      return (eventLog.get(projectId) ?? [])
        .filter(
          (event) =>
            (filter.taskId === undefined || event.taskId === filter.taskId) &&
            event.seq > (filter.afterSeq ?? 0),
        )
        .slice(0, filter.limit ?? 500);
    },
    async *subscribeTaskEvents(
      projectId: string,
      taskId: string,
      options: { afterSeq?: number; signal?: AbortSignal } = {},
    ) {
      let afterSeq = options.afterSeq ?? 0;
      while (!options.signal?.aborted) {
        const events = this.eventsForProject(projectId, { taskId, afterSeq });
        for (const event of events) {
          yield event;
          afterSeq = event.seq;
        }
        if (!blockStreams) return;
        lastStreamSignal = options.signal;
        streamSubscribed?.();
        streamSubscribed = undefined;
        await new Promise<void>((resolve) => {
          if (!options.signal) return resolve();
          if (options.signal.aborted) return resolve();
          const wake = () => {
            streamWaiters.delete(wake);
            options.signal?.removeEventListener('abort', wake);
            resolve();
          };
          streamWaiters.add(wake);
          options.signal.addEventListener('abort', wake, { once: true });
          if (options.signal.aborted) wake();
        });
      }
    },
    pendingQuestionForTask(projectId: string, taskId: string) {
      const task = this.get(projectId, taskId);
      return task.state === 'waiting_input'
        ? { questionId: `${taskId}-question`, taskId, prompt: 'Answer?', options: ['Yes', 'No'] }
        : undefined;
    },
  };
  return {
    service: service as unknown as TaskService,
    answers,
    cancelled,
    markWaiting(taskId: string) {
      const current = records.get(taskId)!;
      records.set(taskId, {
        ...current,
        state: 'waiting_input',
        updatedAt: new Date().toISOString(),
      });
    },
    markFailed(taskId: string) {
      const current = records.get(taskId)!;
      records.set(taskId, { ...current, state: 'failed' });
    },
    get(taskId: string) {
      return records.get(taskId);
    },
    seedTask(input: {
      projectId: string;
      role: string;
      goal: string;
      clientId: string;
      contextId?: string;
    }) {
      return service.create({
        projectId: input.projectId,
        kind: 'agent.run',
        title: 'Existing task',
        goal: input.goal,
        role: input.role,
        assignee: { role: input.role },
        input: {
          a2a: { clientId: input.clientId, contextId: input.contextId ?? 'existing-context' },
        },
      }).task;
    },
    setDeduplication(task: TaskRecord) {
      duplicateTask = task;
    },
    blockStreams() {
      blockStreams = true;
    },
    waitForStreamSubscription() {
      return new Promise<void>((resolve) => {
        streamSubscribed = resolve;
      });
    },
    completeWithArtifact(taskId: string) {
      const task = records.get(taskId)!;
      const next = {
        ...task,
        state: 'succeeded' as const,
        result: {
          summary: 'Work completed with an artifact.',
          artifacts: [{ kind: 'file', path: 'artifact.txt', hash: 'artifact-after-work' }],
          evidence: [],
        },
        updatedAt: new Date().toISOString(),
      };
      records.set(taskId, next);
      appendEvent(next, 'task.succeeded');
    },
    get lastCreatedTaskId() {
      return [...records.keys()].at(-1)!;
    },
    get lastStreamSignal() {
      return lastStreamSignal;
    },
  };
}

function grant(
  projectId: string,
  role = 'explorer',
  permissions: Array<'create' | 'get' | 'continue' | 'stream' | 'cancel'> = [
    'create',
    'get',
    'continue',
    'stream',
    'cancel',
  ],
) {
  return {
    projectId,
    role,
    taskKinds: ['agent.run' as const],
    permissions,
  };
}

function sendParams(projectId: string, taskId = '', contextId = 'ctx-A', text = 'create a task') {
  return {
    message: {
      messageId: uuidv7(),
      contextId,
      taskId,
      role: 'ROLE_USER',
      parts: [{ text }],
      metadata: taskId ? {} : { projectId },
    },
    configuration: { returnImmediately: true },
  };
}

async function request(
  port: number,
  token: string | undefined,
  method: string,
  params: unknown,
  override: { host?: string; origin?: string } = {},
): Promise<{ status: number; headers: Headers; body: TestRpcResponse }> {
  const headers: Record<string, string> = {
    'content-type': 'application/json',
    'A2A-Version': '1.0',
  };
  if (token) headers.authorization = `Bearer ${token}`;
  if (override.host) headers.host = override.host;
  if (override.origin) headers.origin = override.origin;
  const response = await fetch(`http://127.0.0.1:${port}/a2a`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ jsonrpc: '2.0', id: uuidv7(), method, params }),
  });
  const text = await response.text();
  let body: TestRpcResponse = {
    result: { task: { id: '', status: { state: '' } }, id: '', status: { state: '' } },
    error: { code: 0 },
    text: '',
  };
  if (text && !text.startsWith('event:')) {
    try {
      body = JSON.parse(text) as TestRpcResponse;
    } catch {
      body = { ...body, text };
    }
  } else if (text) body = { ...body, text };
  return { status: response.status, headers: response.headers, body };
}

async function availableLoopbackPort(): Promise<number> {
  const server = createServer();
  await new Promise<void>((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => resolve());
  });
  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('No temporary TCP port');
  await new Promise<void>((resolve) => server.close(() => resolve()));
  return address.port;
}

async function requestWithHost(port: number, hostHeader: string): Promise<number> {
  return new Promise((resolve, reject) => {
    const req = httpRequest(
      {
        host: '127.0.0.1',
        port,
        path: '/a2a',
        method: 'POST',
        headers: {
          host: hostHeader,
          'content-type': 'application/json',
        },
      },
      (response) => {
        response.resume();
        response.on('end', () => resolve(response.statusCode ?? 0));
      },
    );
    req.on('error', reject);
    req.end(JSON.stringify({ jsonrpc: '2.0', id: 'host-test', method: 'SendMessage', params: {} }));
  });
}

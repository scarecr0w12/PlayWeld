import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { ApprovalRequest } from '@gamecrafter/contracts';
import { connect, type ServiceClient } from '@gamecrafter/service-client';
import { Database } from '../db/database';
import { resolvePaths, type ServicePaths } from '../paths';
import { PlatformService } from '../service';
import type { ToolContext, ToolExecutionResult } from '../tools/tool-registry';

let service: PlatformService | undefined;
let client: ServiceClient | undefined;
let paths: ServicePaths;
let projectId: string;
let profileRoot = '';
let projectsRoot = '';
const directories: string[] = [];
const fixtures: Server[] = [];

beforeEach(async () => {
  const root = mkdtempSync(path.join(tmpdir(), 'gc-a2a-service-'));
  directories.push(root);
  profileRoot = path.join(root, 'profile');
  projectsRoot = path.join(root, 'projects');
  paths = resolvePaths({ GAMECRAFTER_PROFILE_DIR: profileRoot });
  service = await PlatformService.start({ paths, platformVersion: '0.1.0' });
  client = await connect({
    socketPath: service.socketPath,
    token: readFileSync(paths.tokenPath, 'utf8').trim(),
    clientName: 'a2a-service-test',
    clientVersion: '0.1.0',
  });
  const project = await client.call('project/create', {
    name: 'A2A Integration Project',
    engine: { family: 'godot' },
    parentDirectory: projectsRoot,
    folderName: 'a2a-project',
  });
  projectId = project.projectId;
  await waitForKnowledgeTasks();
});

afterEach(async () => {
  client?.close();
  await service?.stop();
  client = undefined;
  service = undefined;
  for (const fixture of fixtures.splice(0)) await closeServer(fixture);
  for (const directory of directories.splice(0))
    rmSync(directory, { recursive: true, force: true });
});

describe('A2A outbound service and broker integration', () => {
  it('discovers cards, keeps credentials encrypted, and brokers send/get/cancel calls', async () => {
    const secret = 'fixture-api-secret-2026';
    const seen: Array<{ method: string; key?: string }> = [];
    const fixture = await startFixture((request, response, port) => {
      if (request.url === '/.well-known/agent-card.json') {
        seen.push({ method: 'card', key: request.headers['x-api-key'] as string | undefined });
        sendJson(response, publicCard(port, { apiKey: true }));
        return;
      }
      readBody(request).then((rpc) => {
        seen.push({ method: rpc.method, key: request.headers['x-api-key'] as string | undefined });
        const task = {
          id: 'remote-task-1',
          contextId: 'remote-context',
          status: { state: 'TASK_STATE_COMPLETED' },
          artifacts: [],
          history: [],
        };
        sendJson(
          response,
          rpc.method === 'GetTask' || rpc.method === 'CancelTask'
            ? { jsonrpc: '2.0', id: rpc.id, result: task }
            : { jsonrpc: '2.0', id: rpc.id, result: { task } },
        );
      });
    });
    const connection = await client!.call('a2a/outbound/upsert', {
      name: 'Local fixture agent',
      endpoint: `http://127.0.0.1:${fixture.port}`,
      auth: { kind: 'api-key', headerName: 'X-API-Key', value: secret },
    });

    const summary = await client!.call('a2a/outbound/discover', {
      connectionId: connection.connectionId,
    });
    expect(summary).toMatchObject({
      name: 'Fixture A2A agent',
      supportedBindings: ['JSONRPC@1.0'],
    });
    expect(seen[0]).toEqual({ method: 'card', key: secret });
    expect(JSON.stringify(await client!.call('a2a/outbound/list', {}))).not.toContain(secret);
    const profileDb = Database.open(paths.profileDbPath);
    try {
      const encrypted = profileDb.prepare('SELECT ciphertext FROM credentials WHERE ref = ?').get<{
        ciphertext: Uint8Array;
      }>(`a2a/outbound/${connection.connectionId}`)?.ciphertext;
      expect(encrypted).toBeDefined();
      expect(Buffer.from(encrypted!).toString('utf8')).not.toContain(secret);
    } finally {
      profileDb.close();
    }

    await setAccess('full');
    const send = await client!.call('tool/call', {
      projectId,
      toolId: 'a2a/send-message',
      input: { connectionId: connection.connectionId, message: 'Delegate this task' },
    });
    expect(send.status).toBe('completed');
    expect(send.output).toMatchObject({ id: 'remote-task-1' });
    const get = await client!.call('tool/call', {
      projectId,
      toolId: 'a2a/get-task',
      input: { connectionId: connection.connectionId, taskId: 'remote-task-1' },
    });
    const cancel = await client!.call('tool/call', {
      projectId,
      toolId: 'a2a/cancel-task',
      input: { connectionId: connection.connectionId, taskId: 'remote-task-1' },
    });
    expect(get.status).toBe('completed');
    expect(cancel.status).toBe('completed');
    const remoteTasks = await client!.call('tool/call', {
      projectId,
      toolId: 'a2a/list-remote-tasks',
      input: { connectionId: connection.connectionId },
    });
    expect(remoteTasks.output).toMatchObject({
      tasks: [
        expect.objectContaining({
          connectionId: connection.connectionId,
          remoteTaskId: 'remote-task-1',
          remoteContextId: 'remote-context',
          projectId,
          statusState: 'TASK_STATE_COMPLETED',
        }),
      ],
    });
    expect(seen.filter((entry) => entry.method !== 'card').map((entry) => entry.method)).toEqual([
      'SendMessage',
      'GetTask',
      'CancelTask',
    ]);
    expect(seen.every((entry) => entry.key === secret)).toBe(true);

    const audit = await client!.call('tool/calls', { projectId });
    expect(JSON.stringify(audit.calls)).not.toContain(secret);
    expect(audit.calls).toContainEqual(
      expect.objectContaining({
        toolId: 'a2a/send-message',
        decision: 'allowed',
        status: 'completed',
      }),
    );
    const projectEvents = await client!.call('task/events', { projectId });
    expect(
      projectEvents.events.some(
        (event) =>
          event.kind === 'tool.called' &&
          (event.payload as { toolId?: string }).toolId === 'a2a/send-message',
      ),
    ).toBe(true);
    await client!.call('a2a/outbound/delete', { connectionId: connection.connectionId });
    const afterDeleteDb = Database.open(paths.profileDbPath);
    try {
      const afterDelete = afterDeleteDb
        .prepare('SELECT ref FROM credentials WHERE ref = ?')
        .all(`a2a/outbound/${connection.connectionId}`);
      expect(afterDelete).toHaveLength(0);
    } finally {
      afterDeleteDb.close();
    }
  });

  it('reuses recorded remote context and rejects missing context before discovery', async () => {
    const messages: Array<{ method: string; taskId: string; contextId: string }> = [];
    let discoveryRequests = 0;
    const fixture = await startFixture((request, response, port) => {
      if (request.url === '/.well-known/agent-card.json') {
        discoveryRequests += 1;
        sendJson(response, publicCard(port));
        return;
      }
      readBody(request).then((rpc) => {
        const message = (
          rpc.params as { message?: { taskId?: string; contextId?: string } } | undefined
        )?.message;
        if (message && rpc.method) {
          messages.push({
            method: rpc.method,
            taskId: message.taskId ?? '',
            contextId: message.contextId ?? '',
          });
        }
        const task = {
          id: 'remote-continuation-task',
          contextId: 'remote-continuation-context',
          status: { state: 'TASK_STATE_COMPLETED' },
          artifacts: [],
          history: [],
        };
        if (rpc.method === 'SendStreamingMessage') {
          response.writeHead(200, { 'content-type': 'text/event-stream' });
          writeSse(response, rpc.id, { task });
          response.end();
          return;
        }
        sendJson(response, { jsonrpc: '2.0', id: rpc.id, result: { task } });
      });
    });
    const connection = await client!.call('a2a/outbound/upsert', {
      name: 'Context continuation fixture',
      endpoint: `http://127.0.0.1:${fixture.port}`,
      auth: { kind: 'none' },
    });
    await setAccess('full');

    const initial = await client!.call('tool/call', {
      projectId,
      toolId: 'a2a/send-message',
      input: { connectionId: connection.connectionId, message: 'Start a remote task' },
    });
    expect(initial.status).toBe('completed');

    const continued = await client!.call('tool/call', {
      projectId,
      toolId: 'a2a/send-message',
      input: {
        connectionId: connection.connectionId,
        message: 'Continue the remote task',
        taskId: 'remote-continuation-task',
      },
    });
    expect(continued.status).toBe('completed');

    const streamed = await client!.call('tool/call', {
      projectId,
      toolId: 'a2a/send-message-stream',
      input: {
        connectionId: connection.connectionId,
        message: 'Continue the remote task with streaming',
        taskId: 'remote-continuation-task',
      },
    });
    expect(streamed.status).toBe('completed');
    expect(messages).toEqual([
      { method: 'SendMessage', taskId: '', contextId: '' },
      {
        method: 'SendMessage',
        taskId: 'remote-continuation-task',
        contextId: 'remote-continuation-context',
      },
      {
        method: 'SendStreamingMessage',
        taskId: 'remote-continuation-task',
        contextId: 'remote-continuation-context',
      },
    ]);

    const missingSendConnection = await client!.call('a2a/outbound/upsert', {
      name: 'Missing-context send fixture',
      endpoint: `http://127.0.0.1:${fixture.port}`,
      auth: { kind: 'none' },
    });
    const missingStreamConnection = await client!.call('a2a/outbound/upsert', {
      name: 'Missing-context stream fixture',
      endpoint: `http://127.0.0.1:${fixture.port}`,
      auth: { kind: 'none' },
    });
    const database = Database.open(paths.profileDbPath);
    try {
      const now = new Date().toISOString();
      const insert = database.prepare(
        `INSERT INTO a2a_remote_tasks (
          connection_id, remote_task_id, remote_context_id, project_id, local_task_id,
          call_id, status_state, status_timestamp, created_at, updated_at
        ) VALUES (?, ?, NULL, ?, NULL, NULL, NULL, NULL, ?, ?)`,
      );
      insert.run(missingSendConnection.connectionId, 'missing-send-task', projectId, now, now);
      insert.run(missingStreamConnection.connectionId, 'missing-stream-task', projectId, now, now);
    } finally {
      database.close();
    }
    const handlerContext: ToolContext = {
      projectId,
      projectPath: path.join(projectsRoot, 'a2a-project'),
      taskId: null,
      agentId: null,
      agentRole: 'explorer',
      accessMode: 'full',
      callId: 'missing-remote-context-call',
      signal: new AbortController().signal,
    };
    for (const [toolId, connectionId, taskId] of [
      ['a2a/send-message', missingSendConnection.connectionId, 'missing-send-task'],
      ['a2a/send-message-stream', missingStreamConnection.connectionId, 'missing-stream-task'],
    ] as const) {
      await expect(
        getA2AToolHandler(toolId)(handlerContext, {
          connectionId,
          message: 'Context must be required',
          taskId,
        }),
      ).rejects.toThrow('A2A remote task context is not available');
    }
    expect(discoveryRequests).toBe(1);
    expect(messages).toHaveLength(3);
  });

  it('rejects outbound task operations from a Project that does not own the remote task', async () => {
    const remoteCalls: string[] = [];
    const fixture = await startFixture((request, response, port) => {
      if (request.url === '/.well-known/agent-card.json') {
        sendJson(response, publicCard(port));
        return;
      }
      readBody(request).then((rpc) => {
        remoteCalls.push(rpc.method);
        const task = {
          id: 'project-a-remote-task',
          contextId: 'project-a-context',
          status: { state: 'TASK_STATE_WORKING' },
          artifacts: [],
          history: [],
        };
        sendJson(response, {
          jsonrpc: '2.0',
          id: rpc.id,
          result: { task },
        });
      });
    });
    const connection = await client!.call('a2a/outbound/upsert', {
      name: 'Project-bound remote agent',
      endpoint: `http://127.0.0.1:${fixture.port}`,
      auth: { kind: 'none' },
    });
    await setAccess('full');
    const sent = await client!.call('tool/call', {
      projectId,
      toolId: 'a2a/send-message',
      input: { connectionId: connection.connectionId, message: 'A project-owned task' },
    });
    expect(sent.output).toMatchObject({ id: 'project-a-remote-task' });
    const callsBeforeForeignProject = [...remoteCalls];
    const otherProject = await client!.call('project/create', {
      name: 'Other A2A Project',
      engine: { family: 'godot' },
      parentDirectory: projectsRoot,
      folderName: 'other-a2a-project',
    });
    const context = {
      projectId: otherProject.projectId,
      projectPath: path.join(projectsRoot, 'other-a2a-project'),
      taskId: null,
      agentId: null,
      agentRole: 'explorer',
      accessMode: 'full' as const,
      callId: 'foreign-project-remote-task-call',
      signal: new AbortController().signal,
    };
    for (const [toolId, input] of [
      ['a2a/get-task', { connectionId: connection.connectionId, taskId: 'project-a-remote-task' }],
      [
        'a2a/cancel-task',
        { connectionId: connection.connectionId, taskId: 'project-a-remote-task' },
      ],
      [
        'a2a/resubscribe-task',
        { connectionId: connection.connectionId, taskId: 'project-a-remote-task' },
      ],
      [
        'a2a/send-message',
        {
          connectionId: connection.connectionId,
          message: 'Attempt to continue another Project task',
          taskId: 'project-a-remote-task',
        },
      ],
      [
        'a2a/send-message-stream',
        {
          connectionId: connection.connectionId,
          message: 'Attempt to stream another Project task',
          taskId: 'project-a-remote-task',
        },
      ],
    ] as const) {
      await expect(getA2AToolHandler(toolId)(context, input)).rejects.toThrow(
        'A2A remote task is not available in this Project',
      );
    }
    expect(remoteCalls).toEqual(callsBeforeForeignProject);
  });

  it('rejects redirects without forwarding credentials and fails unsupported or malformed cards', async () => {
    let redirectedOriginRequests = 0;
    let redirectAuthorization: string | undefined;
    const redirected = await startFixture((request, response) => {
      redirectAuthorization = request.headers.authorization;
      response.writeHead(302, {
        location: `http://127.0.0.1:${redirectTarget.port}/.well-known/agent-card.json`,
      });
      response.end();
    });
    const redirectTarget = await startFixture((_request, response) => {
      redirectedOriginRequests += 1;
      sendJson(response, publicCard(redirectTarget.port));
    });
    const redirectConnection = await client!.call('a2a/outbound/upsert', {
      name: 'Redirect fixture',
      endpoint: `http://127.0.0.1:${redirected.port}`,
      auth: { kind: 'bearer', token: 'redirect-secret' },
    });
    await expect(
      client!.call('a2a/outbound/discover', { connectionId: redirectConnection.connectionId }),
    ).rejects.toThrow('A2A Agent Card discovery failed');
    expect(redirectAuthorization).toBe('Bearer redirect-secret');
    expect(redirectedOriginRequests).toBe(0);

    const unsupported = await startFixture((_request, response, port) =>
      sendJson(response, publicCard(port, { binding: 'GRPC' })),
    );
    const unsupportedConnection = await client!.call('a2a/outbound/upsert', {
      name: 'Unsupported fixture',
      endpoint: `http://127.0.0.1:${unsupported.port}`,
      auth: { kind: 'none' },
    });
    await expect(
      client!.call('a2a/outbound/discover', { connectionId: unsupportedConnection.connectionId }),
    ).rejects.toThrow('does not expose JSON-RPC v1.0');

    const malformed = await startFixture((_request, response) =>
      sendJson(response, { name: '', version: 7, supportedInterfaces: [] }),
    );
    const malformedConnection = await client!.call('a2a/outbound/upsert', {
      name: 'Malformed fixture',
      endpoint: `http://127.0.0.1:${malformed.port}`,
      auth: { kind: 'none' },
    });
    await expect(
      client!.call('a2a/outbound/discover', { connectionId: malformedConnection.connectionId }),
    ).rejects.toThrow();

    const oauth = await startFixture((_request, response, port) =>
      sendJson(response, publicCard(port, { authScheme: 'oauth' })),
    );
    const oauthConnection = await client!.call('a2a/outbound/upsert', {
      name: 'Unsupported auth fixture',
      endpoint: `http://127.0.0.1:${oauth.port}`,
      auth: { kind: 'bearer', token: 'static-token' },
    });
    await expect(
      client!.call('a2a/outbound/discover', { connectionId: oauthConnection.connectionId }),
    ).rejects.toThrow('unsupported OAuth');
  });

  it('accepts credentials that satisfy one alternative Agent Card security requirement', async () => {
    const fixture = await startFixture((_request, response, port) =>
      sendJson(response, publicCard(port, { authAlternatives: true })),
    );
    const connection = await client!.call('a2a/outbound/upsert', {
      name: 'Alternative auth fixture',
      endpoint: `http://127.0.0.1:${fixture.port}`,
      auth: { kind: 'bearer', token: 'alternative-bearer-secret' },
    });

    await expect(
      client!.call('a2a/outbound/discover', { connectionId: connection.connectionId }),
    ).resolves.toMatchObject({ name: 'Fixture A2A agent' });
  });

  it('bounds oversized task history and artifacts while preserving task identity and status', async () => {
    const largeText = 'remote-result-'.repeat(1_200);
    const fixture = await startFixture((request, response, port) => {
      if (request.url === '/.well-known/agent-card.json') {
        sendJson(response, publicCard(port));
        return;
      }
      readBody(request).then((rpc) => {
        const task = {
          id: 'remote-large-task',
          contextId: 'remote-large-context',
          status: { state: 'TASK_STATE_COMPLETED', timestamp: '2026-10-04T20:00:00.000Z' },
          history: Array.from({ length: 10 }, (_, index) => ({
            messageId: `history-${index}`,
            parts: [{ text: largeText }],
          })),
          artifacts: [{ artifactId: 'large-artifact', parts: [{ text: largeText }] }],
        };
        sendJson(response, {
          jsonrpc: '2.0',
          id: rpc.id,
          result: rpc.method === 'GetTask' ? task : { task },
        });
      });
    });
    const connection = await client!.call('a2a/outbound/upsert', {
      name: 'Large result fixture',
      endpoint: `http://127.0.0.1:${fixture.port}`,
      auth: { kind: 'none' },
    });
    await setAccess('full');

    const created = await client!.call('tool/call', {
      projectId,
      toolId: 'a2a/send-message',
      input: { connectionId: connection.connectionId, message: 'Create the large remote task' },
    });
    expect(created.output).toMatchObject({ id: 'remote-large-task' });

    const result = await client!.call('tool/call', {
      projectId,
      toolId: 'a2a/get-task',
      input: { connectionId: connection.connectionId, taskId: 'remote-large-task' },
    });

    expect(Buffer.byteLength(JSON.stringify(result.output), 'utf8')).toBeLessThanOrEqual(64_000);
    expect(result.output).toMatchObject({
      id: 'remote-large-task',
      contextId: 'remote-large-context',
      status: { state: 3, timestamp: '2026-10-04T20:00:00.000Z' },
    });
    expect(result.output).toHaveProperty('history');
    expect(result.output).toHaveProperty('artifacts');
    const boundedTask = result.output as { history: unknown[]; artifacts: unknown[] };
    expect(boundedTask.history.length).toBeGreaterThan(0);
    expect(boundedTask.artifacts.length).toBeGreaterThan(0);
    expect(JSON.stringify(boundedTask.history)).not.toContain(largeText);
    expect(JSON.stringify(boundedTask.artifacts)).not.toContain(largeText);
    expect(JSON.stringify(result.output)).not.toContain(largeText);
  });

  it('streams local SSE updates, aborts safely, and resumes durable remote tasks after restart', async () => {
    const requests: string[] = [];
    let aborted = false;
    const fixture = await startFixture((request, response, port) => {
      if (request.url === '/.well-known/agent-card.json') {
        sendJson(response, publicCard(port));
        return;
      }
      readBody(request).then((rpc) => {
        requests.push(rpc.method ?? '');
        if (
          rpc.method === 'SendStreamingMessage' &&
          requests.filter((method) => method === rpc.method).length === 1
        ) {
          response.writeHead(200, { 'content-type': 'text/event-stream' });
          writeSse(response, rpc.id, {
            task: {
              id: 'remote-stream-task',
              contextId: 'remote-stream-context',
              status: { state: 'TASK_STATE_WORKING', timestamp: '2026-10-04T20:00:00.000Z' },
              artifacts: [],
              history: [],
            },
          });
          writeSse(response, rpc.id, {
            statusUpdate: {
              taskId: 'remote-stream-task',
              contextId: 'remote-stream-context',
              status: { state: 'TASK_STATE_COMPLETED', timestamp: '2026-10-04T20:00:01.000Z' },
            },
          });
          response.end();
          return;
        }
        if (rpc.method === 'SendStreamingMessage') {
          response.writeHead(200, { 'content-type': 'text/event-stream' });
          writeSse(response, rpc.id, {
            task: {
              id: 'remote-abort-task',
              contextId: 'remote-abort-context',
              status: { state: 'TASK_STATE_WORKING', timestamp: '2026-10-04T20:01:00.000Z' },
              artifacts: [],
              history: [],
            },
          });
          response.once('close', () => {
            if (!response.writableEnded) aborted = true;
          });
          return;
        }
        if (rpc.method === 'SubscribeToTask') {
          response.writeHead(200, { 'content-type': 'text/event-stream' });
          writeSse(response, rpc.id, {
            statusUpdate: {
              taskId: 'remote-abort-task',
              contextId: 'remote-abort-context',
              status: { state: 'TASK_STATE_COMPLETED', timestamp: '2026-10-04T20:02:00.000Z' },
            },
          });
          response.end();
          return;
        }
        sendJson(response, {
          jsonrpc: '2.0',
          id: rpc.id,
          result: {
            id: 'remote-abort-task',
            contextId: 'remote-abort-context',
            status: { state: 'TASK_STATE_CANCELED', timestamp: '2026-10-04T20:01:30.000Z' },
            artifacts: [],
            history: [],
          },
        });
      });
    });
    const connection = await client!.call('a2a/outbound/upsert', {
      name: 'Streaming fixture',
      endpoint: `http://127.0.0.1:${fixture.port}`,
      auth: { kind: 'none' },
    });
    await setAccess('full');
    const progressTask = (
      await client!.call('task/create', {
        projectId,
        kind: 'noop.sleep',
        title: 'A2A progress event target',
        goal: 'Keep a durable local task event stream for the remote A2A operation',
        role: 'coordinator',
        assignee: { role: 'coordinator', accessCeiling: 'full' },
        input: { ms: 5_000 },
      })
    ).task;
    const progressed = await client!.call('tool/call', {
      projectId,
      taskId: progressTask.taskId,
      toolId: 'a2a/send-message-stream',
      input: { connectionId: connection.connectionId, message: 'stream fixture task' },
    });
    expect(progressed.output).toMatchObject({
      taskId: 'remote-stream-task',
      events: [
        { kind: 'task', value: { id: 'remote-stream-task' } },
        { kind: 'statusUpdate', value: { status: { state: 3 } } },
      ],
      truncated: false,
    });
    const progressEvents = await client!.call('task/events', {
      projectId,
      taskId: progressTask.taskId,
    });
    expect(
      progressEvents.events.some(
        (event) =>
          event.kind === 'a2a.remote_progress' &&
          event.actor === 'a2a' &&
          (event.payload as { callId?: string }).callId,
      ),
    ).toBe(true);

    const controller = new AbortController();
    const handler = getA2AToolHandler('a2a/send-message-stream');
    const progressUpdates: unknown[] = [];
    const pending = handler(
      {
        projectId,
        projectPath: path.join(projectsRoot, 'a2a-project'),
        taskId: '019535d4-2c00-7000-8000-000000000301',
        agentId: null,
        agentRole: 'explorer',
        accessMode: 'full',
        callId: 'fixture-abort-call',
        signal: controller.signal,
        reportProgress: (progress) => progressUpdates.push(progress),
      },
      { connectionId: connection.connectionId, message: 'hold this stream open' },
    );
    await waitForRemoteTask(connection.connectionId, 'remote-abort-task');
    controller.abort('cancel stream fixture');
    await expect(pending).rejects.toMatchObject({ name: 'AbortError' });
    await waitUntil(() => aborted);
    expect(progressUpdates).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          connectionId: connection.connectionId,
          remoteTaskId: 'remote-abort-task',
        }),
      ]),
    );

    const cancelled = await client!.call('tool/call', {
      projectId,
      toolId: 'a2a/cancel-task',
      input: { connectionId: connection.connectionId, taskId: 'remote-abort-task' },
    });
    expect(cancelled.output).toMatchObject({ status: { state: 5 } });

    client!.close();
    client = undefined;
    const current = service!;
    service = undefined;
    await current.stop();
    service = await PlatformService.start({ paths, platformVersion: '0.1.0' });
    client = await connect({
      socketPath: service.socketPath,
      token: readFileSync(paths.tokenPath, 'utf8').trim(),
      clientName: 'a2a-service-test-recovered',
      clientVersion: '0.1.0',
    });
    const recovered = await client.call('tool/call', {
      projectId,
      toolId: 'a2a/list-remote-tasks',
      input: { connectionId: connection.connectionId },
    });
    expect(recovered.output).toMatchObject({
      tasks: expect.arrayContaining([
        expect.objectContaining({
          connectionId: connection.connectionId,
          remoteTaskId: 'remote-abort-task',
          remoteContextId: 'remote-abort-context',
          projectId,
          localTaskId: '019535d4-2c00-7000-8000-000000000301',
          callId: 'fixture-abort-call',
          statusState: 'TASK_STATE_CANCELED',
        }),
      ]),
    });
    const resumed = await client.call('tool/call', {
      projectId,
      toolId: 'a2a/resubscribe-task',
      input: { connectionId: connection.connectionId, taskId: 'remote-abort-task' },
    });
    expect(resumed.output).toMatchObject({
      taskId: 'remote-abort-task',
      events: [
        {
          kind: 'statusUpdate',
          value: { status: { state: 3 } },
        },
      ],
    });
    expect(requests).toContain('SubscribeToTask');
  }, 60_000);

  it('supports configured bearer, basic, and custom-header credentials without returning them', async () => {
    const seen: Array<{ authorization?: string; custom?: string }> = [];
    const fixture = await startFixture((request, response, port) => {
      seen.push({
        authorization: request.headers.authorization,
        custom: request.headers['x-custom-secret'] as string | undefined,
      });
      sendJson(response, publicCard(port));
    });
    const inputs = [
      { name: 'bearer auth', auth: { kind: 'bearer' as const, token: 'bearer-fixture-secret' } },
      {
        name: 'basic auth',
        auth: {
          kind: 'basic' as const,
          username: 'fixture-user',
          password: 'basic-fixture-secret',
        },
      },
      {
        name: 'custom headers',
        auth: {
          kind: 'custom-headers' as const,
          headers: { 'X-Custom-Secret': 'header-fixture-secret' },
        },
      },
    ];
    const connections = await Promise.all(
      inputs.map(({ name, auth }) =>
        client!.call('a2a/outbound/upsert', {
          name,
          endpoint: `http://127.0.0.1:${fixture.port}`,
          auth,
        }),
      ),
    );
    await Promise.all(
      connections.map((connection) =>
        client!.call('a2a/outbound/discover', { connectionId: connection.connectionId }),
      ),
    );
    expect(seen).toContainEqual({
      authorization: 'Bearer bearer-fixture-secret',
      custom: undefined,
    });
    expect(seen).toContainEqual({
      authorization: 'Basic Zml4dHVyZS11c2VyOmJhc2ljLWZpeHR1cmUtc2VjcmV0',
      custom: undefined,
    });
    expect(seen).toContainEqual({ authorization: undefined, custom: 'header-fixture-secret' });
    expect(JSON.stringify(await client!.call('a2a/outbound/list', {}))).not.toMatch(
      /fixture-secret/,
    );
  });

  it('preserves restricted denial and Ask always approval for delegated outbound writes', async () => {
    const fixture = await startFixture((request, response, port) => {
      if (request.url === '/.well-known/agent-card.json') sendJson(response, publicCard(port));
      else
        readBody(request).then((rpc) =>
          sendJson(response, {
            jsonrpc: '2.0',
            id: rpc.id,
            result: {
              task: {
                id: 'task',
                contextId: 'ctx',
                status: { state: 'TASK_STATE_COMPLETED' },
                artifacts: [],
                history: [],
              },
            },
          }),
        );
    });
    const connection = await client!.call('a2a/outbound/upsert', {
      name: 'Approval fixture',
      endpoint: `http://127.0.0.1:${fixture.port}`,
      auth: { kind: 'none' },
    });
    await client!.call('a2a/outbound/discover', { connectionId: connection.connectionId });
    await setAccess('restricted');
    await expect(
      client!.call('tool/call', {
        projectId,
        toolId: 'a2a/send-message',
        input: { connectionId: connection.connectionId, message: 'external write' },
      }),
    ).rejects.toMatchObject({ code: -32031 });
    expect(
      (await client!.call('tool/calls', { projectId, toolId: 'a2a/send-message' })).calls[0],
    ).toMatchObject({ decision: 'denied' });

    await setAccess('ask-always');
    const approvalPromise = waitForApproval();
    const pending = client!.call('tool/call', {
      projectId,
      toolId: 'a2a/send-message',
      input: { connectionId: connection.connectionId, message: 'external write' },
    });
    const approval = await approvalPromise;
    expect(approval.toolId).toBe('a2a/send-message');
    await client!.call('broker/approve', {
      projectId,
      approvalId: approval.approvalId,
      approve: false,
    });
    await expect(pending).rejects.toMatchObject({ code: -32031 });
  });

  it('starts the configured inbound listener and stops it before closing profile persistence', async () => {
    const port = await availablePort();
    const config = await client!.call('a2a/inbound/configure', { enabled: true, port });
    expect(config).toMatchObject({ enabled: true, address: '127.0.0.1', port, active: true });
    const cardResponse = await fetch(`http://127.0.0.1:${port}/.well-known/agent-card.json`);
    expect(cardResponse.status).toBe(200);
    const dbBeforeStop = Database.open(paths.profileDbPath);
    dbBeforeStop.close();

    client!.close();
    client = undefined;
    const current = service!;
    service = undefined;
    await current.stop();
    await expect(fetch(`http://127.0.0.1:${port}/.well-known/agent-card.json`)).rejects.toThrow();
    const dbAfterStop = Database.open(paths.profileDbPath);
    try {
      expect(
        dbAfterStop
          .prepare('SELECT enabled FROM a2a_inbound_config WHERE singleton_id = 1')
          .get<{ enabled: number }>()?.enabled,
      ).toBe(1);
    } finally {
      dbAfterStop.close();
    }
  });

  it('persists inbound A2A tasks through TaskService and applies cancellation with Ask always ceiling', async () => {
    await client!.call('settings/set', {
      key: 'agents.maxConcurrentPerProject',
      scope: 'project',
      projectId,
      value: 1,
    });
    const blocker = await client!.call('task/create', {
      projectId,
      kind: 'noop.sleep',
      title: 'A2A worker blocker',
      goal: 'Hold the worker slot',
      input: { ms: 5_000 },
    });
    await waitForTaskState(blocker.task.taskId, 'running');

    const port = await availablePort();
    await client!.call('a2a/inbound/configure', { enabled: true, port });
    const projectGrant = {
      projectId,
      role: 'explorer',
      taskKinds: ['agent.run'],
      permissions: ['create', 'get', 'continue', 'stream', 'cancel'],
    };
    const managedClient = await client!.call('a2a/inbound/client/upsert', {
      name: 'durable task fixture',
      grants: [projectGrant],
    });
    const { token } = await client!.call('a2a/inbound/client/issueToken', {
      clientId: managedClient.clientId,
    });
    const response = await fetch(`http://127.0.0.1:${port}/a2a`, {
      method: 'POST',
      headers: {
        authorization: `Bearer ${token}`,
        'content-type': 'application/json',
        'A2A-Version': '1.0',
      },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 'durable-create',
        method: 'SendMessage',
        params: {
          message: {
            messageId: 'msg-1',
            contextId: 'durable-ctx',
            taskId: '',
            role: 'ROLE_USER',
            parts: [{ text: 'Create durable work' }],
            metadata: { projectId },
          },
          configuration: { returnImmediately: true },
        },
      }),
    });
    const created = (await response.json()) as {
      result: { task: { id: string; status: { state: string } } };
    };
    expect(created.result.task.status.state).toBe('TASK_STATE_WORKING');
    const task = await client!.call('task/get', { projectId, taskId: created.result.task.id });
    expect(task).toMatchObject({
      taskId: created.result.task.id,
      kind: 'agent.run',
      goal: 'Create durable work',
      state: 'ready',
      assignee: { role: 'explorer', accessCeiling: 'ask-always' },
      input: { a2a: { clientId: managedClient.clientId, contextId: 'durable-ctx' } },
    });
    const cancelledResponse = await fetch(`http://127.0.0.1:${port}/a2a`, {
      method: 'POST',
      headers: {
        authorization: `Bearer ${token}`,
        'content-type': 'application/json',
        'A2A-Version': '1.0',
      },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 'durable-cancel',
        method: 'CancelTask',
        params: { id: task.taskId },
      }),
    });
    expect((await cancelledResponse.json()).result.status.state).toBe('TASK_STATE_CANCELED');
    expect((await client!.call('task/get', { projectId, taskId: task.taskId })).state).toBe(
      'cancelled',
    );
    await client!.call('task/cancel', {
      projectId,
      taskId: blocker.task.taskId,
      reason: 'test_cleanup',
    });
  }, 60_000);
});

async function waitForKnowledgeTasks(): Promise<void> {
  const listed = await client!.call('task/list', { projectId, limit: 500 });
  const tasks = listed.tasks.filter(
    (task) => task.kind === 'knowledge.reindex' || task.kind === 'knowledge.reconcile',
  );
  await Promise.all(tasks.map((task) => waitForTask(task.taskId)));
}

async function waitForTask(taskId: string): Promise<void> {
  const deadline = Date.now() + 20_000;
  while (Date.now() < deadline) {
    const task = await client!.call('task/get', { projectId, taskId });
    if (['succeeded', 'failed', 'cancelled'].includes(task.state)) return;
    await new Promise((resolve) => setTimeout(resolve, 25));
  }
  throw new Error(`Timed out waiting for task ${taskId}`);
}

async function waitForTaskState(taskId: string, state: string): Promise<void> {
  const deadline = Date.now() + 20_000;
  while (Date.now() < deadline) {
    const task = await client!.call('task/get', { projectId, taskId });
    if (task.state === state) return;
    await new Promise((resolve) => setTimeout(resolve, 25));
  }
  throw new Error(`Task ${taskId} did not enter ${state}`);
}

async function setAccess(value: 'full' | 'restricted' | 'ask-always'): Promise<void> {
  await client!.call('settings/set', { key: 'access.mode', scope: 'project', projectId, value });
}

function waitForApproval(timeoutMs = 5000): Promise<ApprovalRequest> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(
      () => reject(new Error('A2A broker approval was not requested')),
      timeoutMs,
    );
    client!.onNotification('broker/approvalRequested', (params) => {
      clearTimeout(timer);
      resolve((params.approval ?? params) as ApprovalRequest);
    });
  });
}

interface FixtureServer extends Server {
  port: number;
}

async function startFixture(
  handler: (request: IncomingMessage, response: ServerResponse, port: number) => void,
): Promise<FixtureServer> {
  const server = createServer((request, response) =>
    handler(request, response, (server.address() as { port: number }).port),
  ) as FixtureServer;
  await new Promise<void>((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => resolve());
  });
  server.port = (server.address() as { port: number }).port;
  fixtures.push(server);
  return server;
}

function publicCard(
  port: number,
  options: {
    apiKey?: boolean;
    binding?: string;
    authScheme?: 'oauth';
    authAlternatives?: boolean;
  } = {},
) {
  return {
    name: 'Fixture A2A agent',
    description: 'A local test fixture.',
    version: '1.0.0',
    supportedInterfaces: [
      {
        url: `http://127.0.0.1:${port}/a2a`,
        protocolBinding: options.binding ?? 'JSONRPC',
        protocolVersion: '1.0',
      },
    ],
    capabilities: {
      streaming: true,
      pushNotifications: false,
      extensions: [],
      extendedAgentCard: false,
    },
    ...(options.authAlternatives
      ? {
          securitySchemes: {
            fixtureKey: { apiKeySecurityScheme: { location: 'header', name: 'X-API-Key' } },
            fixtureBearer: {
              httpAuthSecurityScheme: { scheme: 'Bearer', description: 'Bearer alternative' },
            },
            fixtureOAuth: { oauth2SecurityScheme: { description: 'Optional OAuth alternative' } },
          },
          securityRequirements: [
            { schemes: { fixtureKey: {} } },
            { schemes: { fixtureBearer: {} } },
            { schemes: { fixtureOAuth: {} } },
          ],
        }
      : options.apiKey || options.authScheme
        ? {
            securitySchemes: {
              fixtureKey: options.apiKey
                ? { apiKeySecurityScheme: { location: 'header', name: 'X-API-Key' } }
                : { oauth2SecurityScheme: { description: 'Unsupported OAuth2 fixture' } },
            },
            securityRequirements: [{ schemes: { fixtureKey: {} } }],
          }
        : {}),
    defaultInputModes: ['text/plain'],
    defaultOutputModes: ['text/plain'],
    skills: [
      {
        id: 'fixture',
        name: 'Fixture',
        description: 'Local test fixture',
        tags: ['test'],
        examples: [],
        inputModes: ['text/plain'],
        outputModes: ['text/plain'],
        securityRequirements: [],
      },
    ],
  };
}

function sendJson(response: ServerResponse, body: unknown): void {
  response.writeHead(200, { 'content-type': 'application/json' });
  response.end(JSON.stringify(body));
}

function writeSse(
  response: ServerResponse,
  id: string | number | undefined,
  result: unknown,
): void {
  response.write(`data: ${JSON.stringify({ jsonrpc: '2.0', id, result })}\n\n`);
}

function getA2AToolHandler(
  toolId: string,
): (context: ToolContext, input: unknown) => Promise<ToolExecutionResult> | ToolExecutionResult {
  interface TestRegisteredTool {
    handler: (
      context: ToolContext,
      input: unknown,
    ) => Promise<ToolExecutionResult> | ToolExecutionResult;
  }
  interface TestPlatformService {
    a2aService: {
      options: {
        tools: { get(id: string): TestRegisteredTool | undefined };
      };
    };
  }
  const internal = service as unknown as TestPlatformService;
  const handler = internal.a2aService.options.tools.get(toolId)?.handler;
  if (!handler) throw new Error(`A2A tool was not registered: ${toolId}`);
  return handler;
}

async function waitForRemoteTask(connectionId: string, remoteTaskId: string): Promise<void> {
  await waitUntil(() => {
    const database = Database.open(paths.profileDbPath);
    try {
      return Boolean(
        database
          .prepare('SELECT 1 FROM a2a_remote_tasks WHERE connection_id = ? AND remote_task_id = ?')
          .get(connectionId, remoteTaskId),
      );
    } finally {
      database.close();
    }
  });
}

async function waitUntil(predicate: () => boolean, timeoutMs = 5_000): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (predicate()) return;
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
  throw new Error('Timed out waiting for A2A fixture condition');
}

async function readBody(
  request: IncomingMessage,
): Promise<{ id?: string; method?: string; params?: unknown }> {
  let body = '';
  for await (const chunk of request) body += chunk.toString();
  return JSON.parse(body) as { id?: string; method?: string; params?: unknown };
}

async function closeServer(server: Server): Promise<void> {
  if (!server.listening) return;
  await new Promise<void>((resolve) => server.close(() => resolve()));
}

async function availablePort(): Promise<number> {
  const server = createServer();
  await new Promise<void>((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => resolve());
  });
  const port = (server.address() as { port: number }).port;
  await closeServer(server);
  return port;
}

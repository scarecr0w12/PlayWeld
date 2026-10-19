import { createServer } from 'node:http';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { uuidv7 } from '@gamecrafter/contracts';
import { connect, type ServiceClient } from '@gamecrafter/service-client';
import { Database } from '../db/database';
import { resolvePaths, type ServicePaths } from '../paths';
import { PlatformService } from '../service';

let service: PlatformService | undefined;
let client: ServiceClient | undefined;
let fakeServer: ReturnType<typeof createServer> | undefined;
const temporaryDirectories: string[] = [];
let nextContent = '';
const modelRequests: Array<{ model?: string }> = [];

async function createFakeProvider(): Promise<string> {
  fakeServer = createServer((request, response) => {
    let body = '';
    request.on('data', (chunk) => (body += chunk.toString()));
    request.on('end', () => {
      if (request.method === 'GET' && request.url === '/v1/models') {
        response.writeHead(200, { 'content-type': 'application/json' });
        response.end(
          JSON.stringify({
            data: [
              {
                id: 'board-maintainer-model',
                display_name: 'Board Maintainer Model',
                capabilities: {
                  chat: true,
                  tools: false,
                  streaming: false,
                  contextWindow: 64_000,
                  maxOutputTokens: 4096,
                },
                pricing: { inputPerMTokUsd: 1, outputPerMTokUsd: 1 },
              },
            ],
          }),
        );
        return;
      }
      if (request.method === 'POST' && request.url === '/v1/chat/completions') {
        const input = JSON.parse(body) as { model?: string };
        modelRequests.push({ model: input.model });
        response.writeHead(200, { 'content-type': 'application/json' });
        response.end(
          JSON.stringify({
            choices: [{ message: { content: nextContent }, finish_reason: 'stop' }],
            usage: { prompt_tokens: 10, completion_tokens: 4 },
          }),
        );
        return;
      }
      response.writeHead(404, { 'content-type': 'application/json' });
      response.end(JSON.stringify({ error: { message: 'unknown provider endpoint' } }));
    });
  });
  await new Promise<void>((resolve) => fakeServer!.listen(0, '127.0.0.1', resolve));
  const address = fakeServer.address();
  if (!address || typeof address === 'string') throw new Error('Fake provider did not bind');
  return `http://127.0.0.1:${address.port}/v1`;
}

async function connectService(socketPath: string, paths: ServicePaths): Promise<ServiceClient> {
  const { readFileSync } = await import('node:fs');
  return connect({
    socketPath,
    token: readFileSync(paths.tokenPath, 'utf8').trim(),
    clientName: 'board-maintenance-model-test',
    clientVersion: '0.1.0',
  });
}

async function waitForTask(projectId: string, taskId: string, state: string) {
  for (let attempt = 0; attempt < 400; attempt += 1) {
    const task = await client!.call('task/get', { projectId, taskId });
    if (task.state === state) return task;
    if (task.state === 'failed' && state !== 'failed') {
      throw new Error(`Board maintenance task failed: ${JSON.stringify(task.error)}`);
    }
    await new Promise((resolve) => setTimeout(resolve, 25));
  }
  throw new Error(`Board maintenance task did not reach ${state}: ${taskId}`);
}

afterEach(async () => {
  client?.close();
  client = undefined;
  await service?.stop();
  service = undefined;
  if (fakeServer) {
    await new Promise<void>((resolve) => fakeServer!.close(() => resolve()));
    fakeServer = undefined;
  }
  modelRequests.length = 0;
  for (const directory of temporaryDirectories.splice(0))
    rmSync(directory, { recursive: true, force: true });
});

describe('board maintenance model integration', () => {
  it('audits with a routed structured verdict and leaves the board unchanged for invalid output', async () => {
    const root = mkdtempSync(path.join(tmpdir(), 'gc-board-audit-'));
    temporaryDirectories.push(root);
    const projectsDirectory = path.join(root, 'projects');
    const paths = resolvePaths({ GAMECRAFTER_PROFILE_DIR: path.join(root, 'profile') });
    service = await PlatformService.start({ paths, platformVersion: '0.1.0' });
    client = await connectService(service.socketPath, paths);
    const project = await client.call('project/create', {
      name: 'Board Audit Project',
      engine: { family: 'godot' },
      parentDirectory: projectsDirectory,
      folderName: 'board-audit-project',
    });
    const baseUrl = await createFakeProvider();
    const account = await client.call('provider/addAccount', {
      providerKind: 'openai-compatible',
      displayName: 'Board maintenance local',
      baseUrl,
      apiKey: 'fake-board-key',
      isLocal: true,
    });
    const discovered = await client.call('model/discover', {
      accountId: account.accountId,
      providerModelIds: ['board-maintainer-model'],
    });
    const modelId = discovered.models[0]!.modelId;
    await client.call('pool/create', {
      name: 'Board maintainer role',
      scope: 'project',
      projectId: project.projectId,
      target: { kind: 'agent', id: 'board-maintainer' },
      modelIds: [modelId],
    });
    await client.call('pool/create', {
      name: 'Board maintenance tasks',
      scope: 'project',
      projectId: project.projectId,
      target: { kind: 'task-type', id: 'board-maintenance' },
      modelIds: [modelId],
    });
    const thread = await client.call('board/createThread', {
      projectId: project.projectId,
      title: 'Old blocker review',
      kind: 'blocker',
      body: 'The bridge blocks the player.',
      type: 'blocker',
    });
    for (let index = 0; index < 4; index += 1) {
      await client.call('board/post', {
        projectId: project.projectId,
        threadId: thread.thread.threadId,
        type: 'comment',
        body: `Additional context ${index}`,
      });
    }
    nextContent = JSON.stringify({
      summary: 'The bridge blocker still needs an owner.',
      decisionsWithoutBinding: [],
      staleBlockers: [],
      driftAgainstCanon: [
        {
          decisionId: uuidv7(),
          canonPath: 'docs/decisions/bridge.md',
          note: 'The canon record says this bridge was removed.',
        },
      ],
    });
    const audit = await client.call('board/maintenance/run', {
      projectId: project.projectId,
      mode: 'audit',
    });
    const task = await waitForTask(project.projectId, audit.taskId, 'succeeded');
    const result = await client.call('board/thread', {
      projectId: project.projectId,
      threadId: thread.thread.threadId,
      includeMessages: true,
    });
    expect(result.thread.summary).toBe('The bridge blocker still needs an owner.');
    expect(
      result.messages.some(
        (message) => message.type === 'summary' && message.author.kind === 'system',
      ),
    ).toBe(true);
    expect(
      result.messages.some(
        (message) => message.type === 'finding' && message.body.includes('canon record says'),
      ),
    ).toBe(true);
    expect(task.spent.tokens).toBe(14);
    expect(modelRequests).toHaveLength(1);

    const untouched = await client.call('board/createThread', {
      projectId: project.projectId,
      title: 'Invalid audit output',
      kind: 'discussion',
      body: 'This thread must not be summarized on invalid model output.',
      type: 'comment',
    });
    for (let index = 0; index < 4; index += 1) {
      await client.call('board/post', {
        projectId: project.projectId,
        threadId: untouched.thread.threadId,
        type: 'comment',
        body: `More context ${index}`,
      });
    }
    nextContent = '{invalid json';
    const invalidAudit = await client.call('board/maintenance/run', {
      projectId: project.projectId,
      mode: 'audit',
    });
    await waitForTask(project.projectId, invalidAudit.taskId, 'failed');
    const invalidThread = await client.call('board/thread', {
      projectId: project.projectId,
      threadId: untouched.thread.threadId,
      includeMessages: true,
    });
    expect(invalidThread.thread.summary).toBeNull();
    expect(invalidThread.messages).toHaveLength(5);

    const oldThread = await client.call('board/createThread', {
      projectId: project.projectId,
      title: 'Resolved old thread',
      kind: 'discussion',
      body: 'This resolved thread should be archived.',
      type: 'comment',
    });
    await client.call('board/setThreadStatus', {
      projectId: project.projectId,
      threadId: oldThread.thread.threadId,
      status: 'resolved',
    });
    const recentThread = await client.call('board/createThread', {
      projectId: project.projectId,
      title: 'Recent resolved thread',
      kind: 'discussion',
      body: 'This recent thread should stay resolved.',
      type: 'comment',
    });
    await client.call('board/setThreadStatus', {
      projectId: project.projectId,
      threadId: recentThread.thread.threadId,
      status: 'resolved',
    });
    const projectDatabase = Database.open(
      path.join(project.path, '.gamecrafter', 'project.sqlite'),
    );
    try {
      projectDatabase
        .prepare('UPDATE board_threads SET last_message_at = ? WHERE thread_id = ?')
        .run('2000-01-01T00:00:00.000Z', oldThread.thread.threadId);
    } finally {
      projectDatabase.close();
    }
    nextContent = JSON.stringify({
      summary: 'The old thread records a resolved design issue.',
      decisionsWithoutBinding: [],
      staleBlockers: [],
      driftAgainstCanon: [],
    });
    const cleanup = await client.call('board/maintenance/run', {
      projectId: project.projectId,
      mode: 'cleanup',
    });
    await waitForTask(project.projectId, cleanup.taskId, 'succeeded');
    const archived = await client.call('board/thread', {
      projectId: project.projectId,
      threadId: oldThread.thread.threadId,
      includeMessages: true,
    });
    const retained = await client.call('board/thread', {
      projectId: project.projectId,
      threadId: recentThread.thread.threadId,
    });
    expect(archived.thread.status).toBe('archived');
    expect(archived.thread.summary).toBe('The old thread records a resolved design issue.');
    expect(archived.messages).toHaveLength(2);
    expect(retained.thread.status).toBe('resolved');
  }, 60_000);
});

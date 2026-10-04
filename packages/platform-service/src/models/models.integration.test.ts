import { createServer } from 'node:http';
import { mkdirSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { RpcErrorCode, type RouteOutcome } from '@gamecrafter/contracts';
import { connect, type ServiceClient } from '@gamecrafter/service-client';
import { resolvePaths, type ServicePaths } from '../paths';
import { PlatformService } from '../service';

const temporaryDirectories: string[] = [];
let service: PlatformService | undefined;
let client: ServiceClient | undefined;
let projectId: string;
let projectsDirectory: string;
let fakeServer: ReturnType<typeof createServer> | undefined;

const fakeRequests: {
  path: string;
  model?: string;
  authorization?: string;
  body?: Record<string, unknown>;
}[] = [];
const scriptedCompletions: Record<string, unknown>[] = [];

async function createFakeServer(): Promise<string> {
  fakeRequests.length = 0;
  scriptedCompletions.length = 0;
  fakeServer = createServer((request, response) => {
    let body = '';
    request.on('data', (chunk) => (body += chunk.toString()));
    request.on('end', () => {
      const profile = String(request.headers['x-model-profile'] ?? 'good');
      if (request.method === 'GET' && request.url === '/v1/models') {
        fakeRequests.push({
          path: request.url,
          authorization: request.headers.authorization,
        });
        const model =
          profile === 'plain'
            ? { id: 'plain-chat', display_name: 'Plain chat' }
            : profile === 'cheap'
              ? {
                  id: 'cheap-low-quality',
                  display_name: 'Cheap low-quality',
                  capabilities: { chat: true, tools: true, streaming: true },
                  pricing: { inputPerMTokUsd: 0.1, outputPerMTokUsd: 0.1 },
                }
              : {
                  id: 'good-expensive',
                  display_name: 'Good expensive',
                  capabilities: {
                    chat: true,
                    tools: true,
                    streaming: true,
                    structuredOutput: true,
                  },
                  pricing: { inputPerMTokUsd: 1, outputPerMTokUsd: 1 },
                };
        response.writeHead(200, { 'content-type': 'application/json' });
        response.end(JSON.stringify({ data: [model] }));
        return;
      }
      if (request.method === 'POST' && request.url === '/v1/chat/completions') {
        const input = JSON.parse(body) as { model?: string; stream?: boolean } & Record<
          string,
          unknown
        >;
        fakeRequests.push({
          path: request.url,
          model: input.model,
          authorization: request.headers.authorization,
          body: input,
        });
        if (input.stream) {
          response.writeHead(200, { 'content-type': 'text/event-stream' });
          for (const delta of ['Hello', ' ', 'world']) {
            response.write(
              `data: ${JSON.stringify({ choices: [{ delta: { content: delta } }] })}\n\n`,
            );
          }
          response.write(
            `data: ${JSON.stringify({ choices: [{ finish_reason: 'stop', delta: {} }], usage: { prompt_tokens: 20, completion_tokens: 8 } })}\n\n`,
          );
          response.end('data: [DONE]\n\n');
          return;
        }
        const scripted = scriptedCompletions.shift();
        if (scripted) {
          response.writeHead(200, { 'content-type': 'application/json' });
          response.end(JSON.stringify(scripted));
          return;
        }
        response.writeHead(200, { 'content-type': 'application/json' });
        response.end(
          JSON.stringify({
            choices: [{ message: { content: 'Hello world' }, finish_reason: 'stop' }],
            usage: { prompt_tokens: 20, completion_tokens: 8 },
          }),
        );
        return;
      }
      response.writeHead(404, { 'content-type': 'application/json' });
      response.end(JSON.stringify({ error: { message: 'unknown fake endpoint' } }));
    });
  });
  await new Promise<void>((resolve) => fakeServer!.listen(0, '127.0.0.1', resolve));
  const address = fakeServer.address();
  if (!address || typeof address === 'string') throw new Error('Fake model provider did not bind');
  return `http://127.0.0.1:${address.port}/v1`;
}

async function startService(paths: ServicePaths): Promise<PlatformService> {
  return PlatformService.start({ paths, platformVersion: '0.1.0' });
}

async function connectService(socketPath: string, paths: ServicePaths): Promise<ServiceClient> {
  const { readFileSync } = await import('node:fs');
  return connect({
    socketPath,
    token: readFileSync(paths.tokenPath, 'utf8').trim(),
    clientName: 'model-router-integration',
    clientVersion: '0.1.0',
  });
}

async function addAccount(baseUrl: string, displayName: string, profile: string) {
  const account = await client!.call('provider/addAccount', {
    providerKind: 'openai-compatible',
    displayName,
    baseUrl,
    apiKey: `fake-${profile}-api-key`,
    headers: { 'x-model-profile': profile },
    isLocal: true,
  });
  expect('apiKey' in account).toBe(false);
  expect(account.hasCredential).toBe(true);
  return account;
}

async function reportOutcome(
  modelId: string,
  taskType: string,
  success: boolean,
  qualityScore: number,
  latencyMs: number,
): Promise<void> {
  const decision = await client!.call('router/route', {
    projectId,
    agentRole: 'programmer',
    taskType,
    manualModelId: modelId,
  });
  await client!.call('router/reportOutcome', {
    decisionId: decision.decisionId,
    success,
    qualityScore,
    source: 'validation',
    costUsd: success ? 0.05 : 0.01,
    latencyMs,
    inputTokens: 2000,
    outputTokens: 1000,
  } satisfies RouteOutcome);
}

async function waitForAgentTask(taskId: string) {
  const deadline = Date.now() + 60_000;
  let task = await client!.call('task/get', { projectId, taskId });
  while (
    Date.now() < deadline &&
    !['succeeded', 'failed', 'blocked', 'cancelled'].includes(task.state)
  ) {
    await new Promise((resolve) => setTimeout(resolve, 25));
    task = await client!.call('task/get', { projectId, taskId });
  }
  return task;
}

describe('model registry and adaptive routing integration', () => {
  afterEach(async () => {
    client?.close();
    await service?.stop();
    service = undefined;
    client = undefined;
    if (fakeServer) {
      await new Promise<void>((resolve) => fakeServer!.close(() => resolve()));
      fakeServer = undefined;
    }
    for (const directory of temporaryDirectories.splice(0)) {
      rmSync(directory, { recursive: true, force: true });
    }
  });

  it('routes discovered models without streaming metadata through a chat pool and returns a complete answer', async () => {
    const root = mkdtempSync(path.join(tmpdir(), 'gc-plain-chat-'));
    temporaryDirectories.push(root);
    const paths = resolvePaths({ GAMECRAFTER_PROFILE_DIR: path.join(root, 'profile') });
    service = await startService(paths);
    client = await connectService(service.socketPath, paths);
    const account = await addAccount(await createFakeServer(), 'Plain chat account', 'plain');
    const discovered = await client.call('model/discover', { accountId: account.accountId });
    const model = discovered.models[0]!;
    expect(model.capabilities).toMatchObject({ chat: true, streaming: false });
    await client.call('pool/create', {
      name: 'Chat models',
      scope: 'platform',
      target: { kind: 'task-type', id: 'chat' },
      modelIds: [model.modelId],
    });
    for (const manualModelId of [undefined, model.modelId]) {
      const result = await client.call('model/complete', {
        route: {
          taskType: 'chat',
          requiredCapabilities: ['chat'],
          ...(manualModelId ? { manualModelId } : {}),
        },
        request: { messages: [{ role: 'user', content: 'Hello' }], stream: true },
      });
      expect(result.modelId).toBe(model.modelId);
      expect(result.content).toBe('Hello world');
      expect(fakeRequests.at(-1)?.body?.stream).toBeUndefined();
    }
    await expect(
      client.call('router/route', {
        taskType: 'chat',
        requiredCapabilities: ['chat', 'streaming'],
      }),
    ).rejects.toMatchObject({ code: -32042, data: { stage: 'capabilities' } });
  });

  it('rejects conflicting project scopes before routing or recording usage', async () => {
    const root = mkdtempSync(path.join(tmpdir(), 'gc-model-project-scope-'));
    temporaryDirectories.push(root);
    projectsDirectory = path.join(root, 'projects');
    mkdirSync(projectsDirectory, { recursive: true });
    const paths = resolvePaths({ GAMECRAFTER_PROFILE_DIR: path.join(root, 'profile') });
    service = await startService(paths);
    client = await connectService(service.socketPath, paths);
    const first = await client.call('project/create', {
      name: 'First Project',
      engine: { family: 'godot' },
      parentDirectory: projectsDirectory,
      folderName: 'first-project',
    });
    const second = await client.call('project/create', {
      name: 'Second Project',
      engine: { family: 'godot' },
      parentDirectory: projectsDirectory,
      folderName: 'second-project',
    });
    const account = await addAccount(await createFakeServer(), 'Scoped local', 'plain');
    const discovered = await client.call('model/discover', { accountId: account.accountId });
    const model = discovered.models[0]!;
    const completionRequestsBefore = fakeRequests.filter(
      (request) => request.path === '/v1/chat/completions',
    ).length;

    await expect(
      client.call('model/complete', {
        projectId: first.projectId,
        route: { projectId: second.projectId, taskType: 'chat', manualModelId: model.modelId },
        request: { messages: [{ role: 'user', content: 'scope fixture' }] },
      }),
    ).rejects.toMatchObject({ code: RpcErrorCode.InvalidParams });
    expect(fakeRequests.filter((request) => request.path === '/v1/chat/completions')).toHaveLength(
      completionRequestsBefore,
    );
    expect((await client.call('audit/read', { projectId: first.projectId })).modelUsage).toEqual(
      [],
    );
    expect((await client.call('audit/read', { projectId: second.projectId })).modelUsage).toEqual(
      [],
    );

    scriptedCompletions.push({
      choices: [{ message: { content: 'Scoped reply' }, finish_reason: 'stop' }],
      usage: { prompt_tokens: 5, completion_tokens: 2 },
    });
    await client.call('model/complete', {
      projectId: second.projectId,
      route: { projectId: second.projectId, taskType: 'chat', manualModelId: model.modelId },
      request: { messages: [{ role: 'user', content: 'scope fixture' }] },
    });
    expect((await client.call('audit/read', { projectId: first.projectId })).modelUsage).toEqual(
      [],
    );
    expect(
      (await client.call('audit/read', { projectId: second.projectId })).modelUsage,
    ).toHaveLength(1);
  });

  it('exposes model usage in audit without turning unknown, cached, or tiny costs into zero', async () => {
    const root = mkdtempSync(path.join(tmpdir(), 'gc-model-audit-cost-'));
    temporaryDirectories.push(root);
    projectsDirectory = path.join(root, 'projects');
    mkdirSync(projectsDirectory, { recursive: true });
    const paths = resolvePaths({ GAMECRAFTER_PROFILE_DIR: path.join(root, 'profile') });
    service = await startService(paths);
    client = await connectService(service.socketPath, paths);
    const project = await client.call('project/create', {
      name: 'Model Cost Audit Project',
      engine: { family: 'godot' },
      parentDirectory: projectsDirectory,
      folderName: 'model-cost-audit-project',
    });
    projectId = project.projectId;
    const account = await addAccount(await createFakeServer(), 'Unpriced local', 'plain');
    const discovered = await client.call('model/discover', { accountId: account.accountId });
    const model = discovered.models[0]!;

    scriptedCompletions.push({
      choices: [{ message: { content: 'Unpriced reply' }, finish_reason: 'stop' }],
      usage: {
        prompt_tokens: 20,
        completion_tokens: 8,
        prompt_tokens_details: { cached_tokens: 4 },
      },
    });
    const unpriced = await client.call('model/complete', {
      projectId,
      route: { projectId, taskType: 'chat', manualModelId: model.modelId },
      request: { messages: [{ role: 'user', content: 'fixture prompt' }] },
    });
    expect(unpriced.usage).toMatchObject({
      inputTokens: 20,
      outputTokens: 8,
      cacheReadInputTokens: 4,
      costUsd: null,
      costStatus: 'unknown',
    });

    await client.call('model/update', {
      modelId: model.modelId,
      patch: { pricing: { inputPerMTokUsd: 0.1, outputPerMTokUsd: 0.2 } },
    });
    scriptedCompletions.push({
      choices: [{ message: { content: 'Cached reply' }, finish_reason: 'stop' }],
      usage: {
        prompt_tokens: 20,
        completion_tokens: 8,
        prompt_tokens_details: { cached_tokens: 4 },
      },
    });
    const cached = await client.call('model/complete', {
      projectId,
      route: { projectId, taskType: 'chat', manualModelId: model.modelId },
      request: { messages: [{ role: 'user', content: 'fixture prompt' }] },
    });
    expect(cached.usage).toMatchObject({
      cacheReadInputTokens: 4,
      costStatus: 'partial',
    });
    expect(cached.usage.costUsd).toBeCloseTo(0.0000032, 14);

    scriptedCompletions.push({
      choices: [{ message: { content: 'Tiny-cost reply' }, finish_reason: 'stop' }],
      usage: { prompt_tokens: 1, completion_tokens: 1 },
    });
    const tiny = await client.call('model/complete', {
      projectId,
      route: { projectId, taskType: 'chat', manualModelId: model.modelId },
      request: { messages: [{ role: 'user', content: 'fixture prompt' }] },
    });
    expect(tiny.usage.costUsd).toBeCloseTo(0.0000003, 14);

    scriptedCompletions.push({
      choices: [{ message: { content: 'Direct reply' }, finish_reason: 'stop' }],
      usage: { prompt_tokens: 2, completion_tokens: 1 },
    });
    const direct = await client.call('model/complete', {
      projectId,
      modelId: model.modelId,
      request: { messages: [{ role: 'user', content: 'fixture prompt' }] },
    });
    expect(direct.decisionId).toBeNull();

    const audit = await client.call('audit/read', { projectId });
    expect(audit).toMatchObject({
      modelUsage: expect.arrayContaining([
        expect.objectContaining({
          modelId: model.modelId,
          inputTokens: 20,
          outputTokens: 8,
          cacheReadInputTokens: 4,
          costUsd: null,
          costStatus: 'unknown',
        }),
        expect.objectContaining({
          modelId: model.modelId,
          inputTokens: 20,
          outputTokens: 8,
          cacheReadInputTokens: 4,
          costStatus: 'partial',
        }),
        expect.objectContaining({
          modelId: model.modelId,
          inputTokens: 1,
          outputTokens: 1,
          costStatus: 'known',
        }),
        expect.objectContaining({
          modelId: model.modelId,
          decisionId: null,
          inputTokens: 2,
          outputTokens: 1,
          costStatus: 'known',
        }),
      ]),
    });
    expect(
      audit.modelUsage.find(
        (usage) => usage.cacheReadInputTokens === 4 && usage.costStatus === 'partial',
      )?.costUsd,
    ).toBeCloseTo(0.0000032, 14);
    expect(
      audit.modelUsage.find((usage) => usage.inputTokens === 1 && usage.outputTokens === 1)
        ?.costUsd,
    ).toBeCloseTo(0.0000003, 14);
    expect(audit.modelUsage.find((usage) => usage.decisionId === null)?.costUsd).toBeCloseTo(
      0.0000004,
      14,
    );
    expect(JSON.stringify(audit)).not.toContain('fixture prompt');
  });

  it('discovers, routes, streams, records outcomes, applies constraints, and unlinks removed models', async () => {
    const root = mkdtempSync(path.join(tmpdir(), 'gc-model-integration-'));
    temporaryDirectories.push(root);
    const profileDirectory = path.join(root, 'profile');
    projectsDirectory = path.join(root, 'projects');
    mkdirSync(projectsDirectory, { recursive: true });
    const paths = resolvePaths({ GAMECRAFTER_PROFILE_DIR: profileDirectory });
    service = await startService(paths);
    client = await connectService(service.socketPath, paths);
    const project = await client.call('project/create', {
      name: 'Model Router Project',
      engine: { family: 'godot' },
      parentDirectory: projectsDirectory,
      folderName: 'model-router-project',
    });
    projectId = project.projectId;
    const baseUrl = await createFakeServer();

    const cheapAccount = await addAccount(baseUrl, 'Cheap local', 'cheap');
    const goodAccount = await addAccount(baseUrl, 'Good local', 'good');
    const cheapDiscovery = await client.call('model/discover', {
      accountId: cheapAccount.accountId,
    });
    const goodDiscovery = await client.call('model/discover', { accountId: goodAccount.accountId });
    expect(cheapDiscovery.added).toBe(1);
    expect(goodDiscovery.added).toBe(1);
    const cheapModelId = cheapDiscovery.models[0]!.modelId;
    const goodModelId = goodDiscovery.models[0]!.modelId;

    await client.call('settings/set', {
      key: 'models.exploration.rate',
      scope: 'project',
      value: 0,
      projectId,
    });
    for (let index = 0; index < 3; index += 1) {
      await reportOutcome(goodModelId, 'code', true, 0.95, 100);
      await reportOutcome(cheapModelId, 'code', false, 0.1, 500);
    }

    const agentPool = await client.call('pool/create', {
      name: 'Programmer models',
      scope: 'project',
      projectId,
      target: { kind: 'agent', id: 'programmer' },
      modelIds: [cheapModelId, goodModelId],
    });
    const taskPool = await client.call('pool/create', {
      name: 'Code models',
      scope: 'project',
      projectId,
      target: { kind: 'task-type', id: 'code' },
      modelIds: [cheapModelId, goodModelId],
    });

    const qualityDecision = await client.call('router/route', {
      projectId,
      agentRole: 'programmer',
      taskType: 'code',
      requiredCapabilities: ['chat'],
    });
    expect(qualityDecision.modelId).toBe(goodModelId);
    await client.call('settings/set', {
      key: 'models.autoRouting.quality',
      scope: 'project',
      value: 'cost-first',
      projectId,
    });
    const costDecision = await client.call('router/route', {
      projectId,
      agentRole: 'programmer',
      taskType: 'code',
      requiredCapabilities: ['chat'],
    });
    expect(costDecision.modelId).toBe(cheapModelId);
    await expect(
      client.call('router/route', {
        projectId,
        agentRole: 'programmer',
        taskType: 'code',
        requiredCapabilities: ['chat'],
        constraints: { maxCostUsd: 0.0001 },
      }),
    ).rejects.toMatchObject({ code: -32042, data: { stage: 'constraints' } });

    await client.call('pool/update', {
      poolId: agentPool.poolId,
      patch: { modelIds: [goodModelId] },
    });
    await client.call('pool/update', {
      poolId: taskPool.poolId,
      patch: { modelIds: [cheapModelId] },
    });
    await expect(
      client.call('router/route', {
        projectId,
        agentRole: 'programmer',
        taskType: 'code',
        requiredCapabilities: ['chat'],
      }),
    ).rejects.toMatchObject({ code: -32042, data: { stage: 'pools' } });
    await client.call('pool/update', {
      poolId: agentPool.poolId,
      patch: { modelIds: [cheapModelId, goodModelId] },
    });
    await client.call('pool/update', {
      poolId: taskPool.poolId,
      patch: { modelIds: [cheapModelId, goodModelId] },
    });
    await client.call('settings/set', {
      key: 'models.autoRouting.quality',
      scope: 'project',
      value: 'quality-first',
      projectId,
    });

    const deltas: string[] = [];
    const notificationOrder: string[] = [];
    client.onNotification('model/delta', (event) => {
      if (event.requestId === 'route-stream-1') {
        deltas.push(event.delta);
        notificationOrder.push('delta');
      }
    });
    const completePromise = client
      .call('model/complete', {
        projectId,
        requestId: 'route-stream-1',
        route: {
          projectId,
          agentRole: 'programmer',
          taskType: 'code',
          requiredCapabilities: ['chat'],
        },
        request: { messages: [{ role: 'user', content: 'say hello' }], stream: true },
      })
      .then((response) => {
        notificationOrder.push('response');
        return response;
      });
    const response = await completePromise;
    expect(deltas).toEqual(['Hello', ' ', 'world']);
    expect(notificationOrder).toEqual(['delta', 'delta', 'delta', 'response']);
    expect(response).toMatchObject({
      modelId: goodModelId,
      content: 'Hello world',
      decisionId: expect.any(String),
      usage: { inputTokens: 20, outputTokens: 8 },
    });
    expect(
      (await client.call('audit/read', { projectId })).modelUsage.filter(
        (usage) => usage.requestId === 'route-stream-1',
      ),
    ).toHaveLength(1);
    const decisions = await client.call('router/decisions', { projectId, limit: 50 });
    const selfOutcome = decisions.decisions.find(
      ({ decision, outcome }) =>
        decision.decisionId === response.decisionId && outcome?.source === 'self',
    );
    expect(selfOutcome?.outcome).toMatchObject({
      success: true,
      qualityScore: null,
      source: 'self',
    });

    await client.call('provider/removeAccount', { accountId: cheapAccount.accountId });
    expect((await client.call('model/list', { accountId: cheapAccount.accountId })).models).toEqual(
      [],
    );
    const pools = await client.call('pool/list', { projectId });
    expect(pools.pools.every((pool) => !pool.modelIds.includes(cheapModelId))).toBe(true);
    expect(fakeRequests.some((request) => request.model === 'good-expensive')).toBe(true);
    expect(
      fakeRequests.every(
        (request) =>
          request.authorization === 'Bearer fake-good-api-key' ||
          (request.path === '/v1/models' && request.authorization === 'Bearer fake-cheap-api-key'),
      ),
    ).toBe(true);
  }, 60_000);

  it('runs a multi-turn agent loop from scripted fake-provider tool calls', async () => {
    const root = mkdtempSync(path.join(tmpdir(), 'gc-agent-runtime-'));
    temporaryDirectories.push(root);
    const profileDirectory = path.join(root, 'profile');
    projectsDirectory = path.join(root, 'projects');
    mkdirSync(projectsDirectory, { recursive: true });
    const paths = resolvePaths({ GAMECRAFTER_PROFILE_DIR: profileDirectory });
    service = await startService(paths);
    client = await connectService(service.socketPath, paths);
    const project = await client.call('project/create', {
      name: 'Agent Runtime Project',
      engine: { family: 'godot' },
      parentDirectory: projectsDirectory,
      folderName: 'agent-runtime-project',
    });
    projectId = project.projectId;
    const baseUrl = await createFakeServer();
    const account = await addAccount(baseUrl, 'Agent runtime model', 'good');
    const discovered = await client.call('model/discover', { accountId: account.accountId });
    const modelId = discovered.models[0]!.modelId;
    await client.call('pool/create', {
      name: 'Coordinator runtime pool',
      scope: 'project',
      projectId,
      target: { kind: 'agent', id: 'coordinator' },
      modelIds: [modelId],
    });
    await client.call('settings/set', {
      key: 'access.mode',
      scope: 'project',
      value: 'full',
      projectId,
    });

    scriptedCompletions.push(
      {
        choices: [
          {
            message: {
              content: '',
              tool_calls: [
                {
                  id: 'agent-board-read',
                  type: 'function',
                  function: { name: 'board/read', arguments: '{}' },
                },
              ],
            },
            finish_reason: 'tool_calls',
          },
        ],
        usage: { prompt_tokens: 40, completion_tokens: 10 },
      },
      {
        choices: [
          {
            message: {
              content: '',
              tool_calls: [
                {
                  id: 'agent-complete',
                  type: 'function',
                  function: {
                    name: 'tasks/complete',
                    arguments: JSON.stringify({
                      summary: 'Reviewed the board and completed the task.',
                      artifacts: [],
                      evidence: [{ kind: 'board', ref: 'read-current-threads' }],
                      claims: [{ kind: 'generated', ref: 'agent-summary' }],
                    }),
                  },
                },
              ],
            },
            finish_reason: 'tool_calls',
          },
        ],
        usage: { prompt_tokens: 55, completion_tokens: 12 },
      },
    );

    const created = await client.call('task/create', {
      projectId,
      kind: 'agent.run',
      title: 'Run coordinator agent',
      goal: 'Read the discussion board, then report completion.',
      role: 'coordinator',
      budget: { maxTokens: 10_000 },
      contract: { required: ['generated'], validators: [] },
      input: {},
    });
    const task = await waitForAgentTask(created.task.taskId);

    expect(task.state).toBe('succeeded');
    expect(task.result).toMatchObject({
      summary: 'Reviewed the board and completed the task.',
      claims: [{ kind: 'generated', ref: 'agent-summary' }],
    });
    const agentRequests = fakeRequests.filter((request) => request.path === '/v1/chat/completions');
    expect(agentRequests).toHaveLength(2);
    const offeredTools = agentRequests[0]!.body!.tools as Array<{
      function: { name: string; description: string; parameters: Record<string, unknown> };
    }>;
    expect(offeredTools.every((tool) => /^[a-zA-Z0-9_-]{1,64}$/.test(tool.function.name))).toBe(
      true,
    );
    const offeredNames = offeredTools.map(
      (tool) =>
        tool.function.description.match(/\(Platform tool: (.+)\)$/)?.[1] ?? tool.function.name,
    );
    expect(offeredNames).toContain('board/read');
    expect(offeredNames).not.toContain('fs/write-file');
    const events = await client.call('task/events', { projectId, taskId: task.taskId });
    expect(events.events.map((event) => event.payload)).toContainEqual(
      expect.objectContaining({
        diagnostic: 'agent-tool-availability',
        role: 'coordinator',
        offeredToolIds: expect.arrayContaining(['board/read']),
        excludedTools: expect.arrayContaining([
          { toolId: 'fs/write-file', reason: 'role_tool_denied' },
        ]),
      }),
    );
    const activateSkill = offeredTools.find((tool) =>
      tool.function.description.endsWith('(Platform tool: skills/activate)'),
    );
    expect(activateSkill?.function.parameters).toMatchObject({
      properties: { name: { enum: expect.arrayContaining(['project-planning']) } },
    });
    const calls = await client.call('tool/calls', { projectId, taskId: task.taskId });
    expect(calls.calls).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ toolId: 'board/read', status: 'completed' }),
        expect.objectContaining({ toolId: 'model/complete', status: 'completed' }),
      ]),
    );
  }, 60_000);
});

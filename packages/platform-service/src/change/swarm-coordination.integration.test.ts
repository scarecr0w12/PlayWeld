import { createServer } from 'node:http';
import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { connect, type ServiceClient } from '@gamecrafter/service-client';
import { resolvePaths, type ServicePaths } from '../paths';
import { PlatformService } from '../service';

const requestText =
  'Revise char.aria-vale in docs/canon/characters/aria.md and update game/README.md.';
const taskAGoal = "A: add a lantern detail to Aria's harbor scene.";
const taskBGoal = 'B: add a map detail to Aria and document the gameplay change.';
const ariaPath = 'docs/canon/characters/aria.md';

type ScriptedResponse = {
  response: unknown;
  delayMs?: number;
  waitForReconciliationGate?: boolean;
};

let root: string | undefined;
let service: PlatformService | undefined;
let client: ServiceClient | undefined;
let fakeServer: ReturnType<typeof createServer> | undefined;
let projectId = '';
let delegatedTaskIds: string[] = [];
let coordinatorTurn = 0;
let taskATurn = 0;
let taskBTurn = 0;
let reconcileTurn = 0;
let reconciliationGate: Promise<void> = Promise.resolve();
let releaseReconciliationGate: () => void = () => undefined;
const providerRequests: Record<string, unknown>[] = [];

function toolResponse(
  name: string,
  args: Record<string, unknown>,
  id: string,
  delayMs = 0,
): ScriptedResponse {
  return {
    response: {
      choices: [
        {
          message: {
            content: '',
            tool_calls: [
              { id, type: 'function', function: { name, arguments: JSON.stringify(args) } },
            ],
          },
          finish_reason: 'tool_calls',
        },
      ],
      usage: { prompt_tokens: 35, completion_tokens: 12 },
    },
    delayMs,
  };
}

function ariaCanonContent(body: string): string {
  return [
    '---',
    'schemaVersion: 1',
    'id: char.aria-vale',
    'type: character',
    'title: Aria Vale',
    'status: accepted',
    'tags: []',
    'references: []',
    'provenance: []',
    '---',
    '',
    body,
    '',
  ].join('\n');
}

function completionClaim(summary: string, artifactPaths: string[]) {
  return {
    summary,
    artifacts: artifactPaths.map((filePath) => ({ kind: 'file', path: filePath })),
    evidence: artifactPaths.map((filePath) => ({ kind: 'file', ref: filePath })),
    claims: [{ kind: 'generated', ref: artifactPaths.join(',') || 'task-summary' }],
  };
}

function delegatedIdsFrom(messages: Array<Record<string, unknown>>): string[] {
  return messages
    .filter((message) => message.role === 'tool' && message.name === 'tasks/delegate')
    .flatMap((message) => {
      try {
        const result = JSON.parse(String(message.content)) as { taskId?: unknown };
        return typeof result.taskId === 'string' ? [result.taskId] : [];
      } catch {
        return [];
      }
    });
}

function scriptedResponse(body: Record<string, unknown>): ScriptedResponse {
  const messages = Array.isArray(body.messages)
    ? (body.messages as Array<Record<string, unknown>>)
    : [];
  const goal = String(messages.find((message) => message.role === 'user')?.content ?? '');
  if (goal === requestText) {
    const step = coordinatorTurn++;
    if (step === 0) {
      return toolResponse(
        'change/impact',
        {
          seeds: [`file:${ariaPath}`, 'canon:char.aria-vale'],
        },
        'coordinator-impact',
      );
    }
    if (step === 1) {
      return toolResponse(
        'tasks/delegate',
        {
          role: 'gameplay-engineer',
          goal: taskAGoal,
          title: 'A: Aria lantern change',
          touches: [
            { resource: `file:${ariaPath}`, intent: 'write' },
            { resource: 'canon:char.aria-vale', intent: 'write' },
          ],
          isolation: 'worktree',
          contract: { required: ['generated'], validators: [] },
        },
        'delegate-task-a',
      );
    }
    if (step === 2) {
      return toolResponse(
        'tasks/delegate',
        {
          role: 'gameplay-engineer',
          goal: taskBGoal,
          title: 'B: Aria map and gameplay note',
          // Leave the Aria file undeclared so Git conflict detection is independent of lock scheduling.
          touches: [
            { resource: 'canon:char.aria-vale', intent: 'write' },
            { resource: 'file:game/README.md', intent: 'write' },
          ],
          isolation: 'worktree',
          contract: { required: ['generated'], validators: [] },
        },
        'delegate-task-b',
      );
    }
    if (step === 3) {
      delegatedTaskIds = delegatedIdsFrom(messages);
      return toolResponse(
        'tasks/await',
        { taskIds: delegatedTaskIds, timeoutMs: 60_000 },
        'await-delegates',
      );
    }
    return toolResponse(
      'tasks/complete',
      completionClaim('Both bounded tasks completed and integration was reviewed.', []),
      'complete-coordinator',
    );
  }

  if (goal === taskAGoal) {
    if (taskATurn++ === 0) {
      return toolResponse(
        'fs/write-file',
        {
          path: ariaPath,
          content: ariaCanonContent(
            [
              'A keeper of the harbor lights.',
              'At dawn, Aria leaves a lantern by the north pier.',
              'The rescue begins after the evening bell.',
            ].join('\n'),
          ),
        },
        'write-task-a',
      );
    }
    return toolResponse(
      'tasks/complete',
      completionClaim("Added Aria's lantern detail.", [ariaPath]),
      'complete-task-a',
    );
  }

  if (goal === taskBGoal) {
    if (taskBTurn++ === 0) {
      return toolResponse(
        'fs/write-file',
        {
          path: ariaPath,
          content: ariaCanonContent(
            [
              'A keeper of the harbor lights.',
              'At dawn, Aria discovers a map beneath the north pier.',
              'The rescue begins after the evening bell.',
              'The map bears a mark from the old lighthouse.',
            ].join('\n'),
          ),
        },
        'write-task-b-aria',
        10_000,
      );
    }
    if (taskBTurn === 2) {
      return toolResponse(
        'fs/write-file',
        {
          path: 'game/README.md',
          content: 'Gameplay notes\nB added a map clue to the harbor rescue.\n',
        },
        'write-task-b-game',
      );
    }
    return toolResponse(
      'tasks/complete',
      completionClaim('Added the map clue and gameplay note.', [ariaPath, 'game/README.md']),
      'complete-task-b',
    );
  }

  if (goal.startsWith('Reconcile the overlapping changes')) {
    const turn = reconcileTurn++;
    if (turn === 0) {
      return {
        ...toolResponse('board/read', {}, `reconcile-review-${turn}`),
        waitForReconciliationGate: true,
      };
    }
    if (turn === 3) {
      return toolResponse('board/read', {}, `reconcile-review-${turn}`, 1_500);
    }
    if (turn === 1) {
      return toolResponse(
        'fs/write-file',
        {
          path: ariaPath,
          content: ariaCanonContent(
            [
              'A keeper of the harbor lights.',
              'At dawn, Aria leaves a lantern by the north pier.',
              'The rescue begins after the evening bell.',
              'The harbor road follows the old seawall.',
              '',
              'Map notes:',
              'At dawn, Aria discovers a map beneath the north pier.',
              'The map bears a mark from the old lighthouse.',
            ].join('\n'),
          ),
        },
        'write-reconciled-aria',
      );
    }
    if (turn === 4) {
      return toolResponse(
        'fs/write-file',
        {
          path: ariaPath,
          content: ariaCanonContent(
            [
              'A keeper of the harbor lights.',
              'The harbor rescue begins at dawn.',
              'The rescue begins after the evening bell.',
              'The harbor road follows the old seawall.',
              '',
              'Map notes:',
              'At dawn, Aria discovers a map beneath the north pier.',
              'The map bears a mark from the old lighthouse.',
            ].join('\n'),
          ),
        },
        'write-revert-reconciled-aria',
      );
    }
    return toolResponse(
      'tasks/complete',
      completionClaim('Merged the changes without losing either side.', [ariaPath]),
      `complete-reconcile-${turn}`,
    );
  }

  return toolResponse(
    'tasks/complete',
    completionClaim('Completed the task.', []),
    'complete-fallback',
  );
}

async function startFakeModelServer(): Promise<string> {
  providerRequests.length = 0;
  delegatedTaskIds = [];
  coordinatorTurn = 0;
  taskATurn = 0;
  taskBTurn = 0;
  reconcileTurn = 0;
  reconciliationGate = new Promise<void>((resolve) => {
    releaseReconciliationGate = resolve;
  });
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
                id: 'swarm-test-model',
                display_name: 'Swarm scripted model',
                capabilities: {
                  chat: true,
                  tools: true,
                  streaming: false,
                  contextWindow: 65536,
                  maxInputTokens: 57344,
                  maxOutputTokens: 8192,
                },
                pricing: { inputPerMTokUsd: 0, outputPerMTokUsd: 0 },
              },
            ],
          }),
        );
        return;
      }
      if (request.method !== 'POST' || request.url !== '/v1/chat/completions') {
        response.writeHead(404, { 'content-type': 'application/json' });
        response.end(JSON.stringify({ error: { message: 'unknown fake endpoint' } }));
        return;
      }
      const input = JSON.parse(body) as Record<string, unknown>;
      providerRequests.push(input);
      const definitions = input.tools as Array<{ function: { name: string; description: string } }>;
      const wireNames = new Map(
        definitions.map((tool) => [
          tool.function.name,
          tool.function.description.match(/\(Platform tool: (.+)\)$/)?.[1] ?? tool.function.name,
        ]),
      );
      const messages = input.messages as Array<Record<string, unknown>>;
      const scripted = scriptedResponse({
        ...input,
        messages: messages.map((message) => ({
          ...message,
          ...(typeof message.name === 'string'
            ? { name: wireNames.get(message.name) ?? message.name }
            : {}),
        })),
      });
      const send = (): void => {
        response.writeHead(200, { 'content-type': 'application/json' });
        response.end(JSON.stringify(scripted.response));
      };
      if (scripted.waitForReconciliationGate) void reconciliationGate.then(send);
      else if (scripted.delayMs && scripted.delayMs > 0) setTimeout(send, scripted.delayMs);
      else send();
    });
  });
  await new Promise<void>((resolve) => fakeServer!.listen(0, '127.0.0.1', resolve));
  const address = fakeServer.address();
  if (!address || typeof address === 'string') throw new Error('Fake model provider did not bind');
  return `http://127.0.0.1:${address.port}/v1`;
}

async function connectToService(socketPath: string, paths: ServicePaths): Promise<ServiceClient> {
  return connect({
    socketPath,
    token: readFileSync(paths.tokenPath, 'utf8').trim(),
    clientName: 'swarm-coordination-integration',
    clientVersion: '0.1.0',
  });
}

async function addFakeAccount(baseUrl: string) {
  return client!.call('provider/addAccount', {
    providerKind: 'openai-compatible',
    displayName: 'Swarm fake provider',
    baseUrl,
    apiKey: 'fake-swarm-key',
    isLocal: true,
  });
}

async function waitForTask(taskId: string, timeoutMs = 90_000) {
  const deadline = Date.now() + timeoutMs;
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

async function waitForRevertIntegration(mergeCommit: string, timeoutMs = 90_000) {
  const deadline = Date.now() + timeoutMs;
  let integrations: Array<Record<string, unknown>> = [];
  while (Date.now() < deadline) {
    const result = await client!.call('change/integrations', { projectId });
    integrations = result.integrations as unknown as Array<Record<string, unknown>>;
    const revert = integrations.find((integration) =>
      (integration.validation as Array<Record<string, unknown>>).some(
        (entry) => entry.kind === 'git-revert' && entry.ref === mergeCommit,
      ),
    );
    if (revert?.status === 'integrated') return revert;
    if (revert?.status === 'conflict') {
      throw new Error(`Revert integration conflicted: ${JSON.stringify(revert)}`);
    }
    await new Promise((resolve) => setTimeout(resolve, 25));
  }
  throw new Error(`Revert integration did not settle: ${JSON.stringify(integrations)}`);
}

async function waitForIntegrations(
  taskIds: string[],
  predicate: (integrations: Array<Record<string, unknown>>) => boolean,
  timeoutMs = 90_000,
): Promise<Array<Record<string, unknown>>> {
  const deadline = Date.now() + timeoutMs;
  let integrations: Array<Record<string, unknown>> = [];
  while (Date.now() < deadline) {
    const result = await client!.call('change/integrations', { projectId });
    integrations = result.integrations as unknown as Array<Record<string, unknown>>;
    if (predicate(integrations.filter((entry) => taskIds.includes(String(entry.taskId)))))
      return integrations;
    await new Promise((resolve) => setTimeout(resolve, 25));
  }
  throw new Error(`Integration state did not settle: ${JSON.stringify(integrations)}`);
}

describe('swarm coordination through the RPC harness', () => {
  afterEach(async () => {
    releaseReconciliationGate();
    client?.close();
    client = undefined;
    await service?.stop();
    service = undefined;
    if (fakeServer) {
      await new Promise<void>((resolve) => fakeServer!.close(() => resolve()));
      fakeServer = undefined;
    }
    if (root) rmSync(root, { recursive: true, force: true });
    root = undefined;
  });

  it('coordinates overlapping worktrees, propagates feedback, and reverts rejected integrated work', async () => {
    root = mkdtempSync(path.join(tmpdir(), 'gc-swarm-coordination-'));
    const profileDirectory = path.join(root, 'profile');
    const projectsDirectory = path.join(root, 'projects');
    mkdirSync(projectsDirectory, { recursive: true });
    const paths = resolvePaths({ GAMECRAFTER_PROFILE_DIR: profileDirectory });
    service = await PlatformService.start({ paths, platformVersion: '0.1.0' });
    client = await connectToService(service.socketPath, paths);
    const project = await client.call('project/create', {
      name: 'Swarm Coordination Project',
      engine: { family: 'godot' },
      parentDirectory: projectsDirectory,
      folderName: 'swarm-coordination-project',
    });
    projectId = project.projectId;
    mkdirSync(path.join(project.path, 'docs', 'canon', 'characters'), { recursive: true });
    writeFileSync(
      path.join(project.path, ariaPath),
      [
        '# Aria Vale',
        'A keeper of the harbor lights.',
        'The harbor rescue begins at dawn.',
        'The rescue begins after the evening bell.',
        '',
      ].join('\n'),
    );
    execFileSync('git', ['add', '--', ariaPath], { cwd: project.path });
    execFileSync(
      'git',
      [
        '-c',
        'user.name=PlayWeld',
        '-c',
        'user.email=gamecrafter@localhost',
        'commit',
        '-m',
        'Seed Aria canon',
      ],
      { cwd: project.path },
    );
    const baseUrl = await startFakeModelServer();
    const account = await addFakeAccount(baseUrl);
    const discovery = await client.call('model/discover', {
      accountId: account.accountId,
      providerModelIds: ['swarm-test-model'],
    });
    const modelId = discovery.models[0]!.modelId;
    for (const role of ['coordinator', 'gameplay-engineer']) {
      await client.call('pool/create', {
        name: `${role} swarm pool`,
        scope: 'project',
        projectId,
        target: { kind: 'agent', id: role },
        modelIds: [modelId],
      });
    }
    await client.call('settings/set', {
      key: 'access.mode',
      scope: 'project',
      value: 'full',
      projectId,
    });
    await client.call('knowledge/write', {
      projectId,
      record: {
        id: 'char.aria-vale',
        type: 'character',
        title: 'Aria Vale',
        status: 'accepted',
        references: [],
      },
      body: [
        'A keeper of the harbor lights.',
        'The harbor rescue begins at dawn.',
        'The rescue begins after the evening bell.',
      ].join('\n'),
      path: ariaPath,
    });
    await client.call('knowledge/write', {
      projectId,
      record: {
        id: 'quest.harbor-rescue',
        type: 'quest',
        title: 'Harbor Rescue',
        status: 'accepted',
        references: [
          {
            rel: 'features-character',
            target: 'char.aria-vale',
            confidence: 1,
            source: 'author',
          },
        ],
      },
      body: 'Rescue the harbor town with Aria.',
      path: 'docs/canon/quests/harbor-rescue.md',
    });
    execFileSync('git', ['add', '--', ariaPath, 'docs/canon/quests/harbor-rescue.md'], {
      cwd: project.path,
    });
    execFileSync(
      'git',
      [
        '-c',
        'user.name=PlayWeld',
        '-c',
        'user.email=gamecrafter@localhost',
        'commit',
        '-m',
        'Seed quest reference',
      ],
      { cwd: project.path },
    );
    await client.call('settings/set', {
      key: 'agents.maxConcurrentPerProject',
      scope: 'project',
      value: 8,
      projectId,
    });
    await client.call('settings/set', {
      key: 'coordination.autoIntegrate',
      scope: 'project',
      value: 'when-validated',
      projectId,
    });

    const request = await client.call('change/request', {
      projectId,
      text: requestText,
      role: 'coordinator',
      budget: { maxTokens: 100_000 },
    });
    const rootTask = await waitForTask(request.rootTaskId);
    expect(rootTask.state, JSON.stringify(rootTask.error)).toBe('succeeded');
    expect(delegatedTaskIds).toHaveLength(2);
    const taskA = await waitForTask(delegatedTaskIds[0]!);
    const taskB = await waitForTask(delegatedTaskIds[1]!);
    expect(taskA.state).toBe('succeeded');
    expect(taskB.state).toBe('succeeded');

    const conflicted = await waitForIntegrations(
      delegatedTaskIds,
      (integrations) =>
        integrations.some(
          (entry) => entry.taskId === taskA.taskId && entry.status === 'integrated',
        ) &&
        integrations.some(
          (entry) =>
            entry.taskId === taskB.taskId &&
            entry.status === 'conflict' &&
            typeof entry.reconcileTaskId === 'string',
        ),
    );
    const integrationA = conflicted.find((entry) => entry.taskId === taskA.taskId)!;
    const integrationB = conflicted.find((entry) => entry.taskId === taskB.taskId)!;
    expect(integrationA.mergeCommit).toEqual(expect.any(String));
    expect(integrationB.conflicts).toEqual(
      expect.arrayContaining([expect.objectContaining({ file: ariaPath, kind: 'git-conflict' })]),
    );
    const ariaAfterFirstMerge = readFileSync(path.join(project.path, ariaPath), 'utf8');
    expect(ariaAfterFirstMerge).toContain('lantern by the north pier');
    expect(ariaAfterFirstMerge).not.toContain('discovers a map beneath the north pier');

    const reconcileTaskId = String(integrationB.reconcileTaskId);
    releaseReconciliationGate();
    const reconcileTask = await waitForTask(reconcileTaskId);
    expect(reconcileTask.state).toBe('succeeded');
    await waitForIntegrations([reconcileTaskId], (integrations) =>
      integrations.some(
        (entry) => entry.taskId === reconcileTaskId && entry.status === 'integrated',
      ),
    );

    const ariaAfterReconcile = readFileSync(path.join(project.path, ariaPath), 'utf8');
    expect(ariaAfterReconcile).toContain('lantern by the north pier');
    expect(ariaAfterReconcile).toContain('discovers a map beneath the north pier');
    expect(ariaAfterReconcile).toContain('mark from the old lighthouse');
    const accepted = await client.call('change/feedback', {
      projectId,
      target: { kind: 'task', ref: taskA.taskId },
      decision: 'accept',
      note: 'The lantern detail is approved.',
    });
    expect(accepted.reopenedTaskIds).toEqual([]);
    expect(accepted.revalidateTaskIds).toEqual([]);
    expect(
      (await client.call('task/get', { projectId, taskId: taskA.taskId })).result?.reviewStatus,
    ).toBe('accepted');

    const revisionNote = 'Keep the map clue and add the harbor-watch detail.';
    const revised = await client.call('change/feedback', {
      projectId,
      target: { kind: 'task', ref: taskB.taskId },
      decision: 'revise',
      note: revisionNote,
    });
    expect(revised.threadId).toBe(request.threadId);
    expect(revised.reopenedTaskIds).toHaveLength(1);
    const revisedTask = await client.call('task/get', {
      projectId,
      taskId: revised.reopenedTaskIds[0]!,
    });
    expect(revisedTask.input).toMatchObject({ feedback: revisionNote });
    expect(revisedTask.attempt).toBe(taskB.attempt + 1);
    expect(revisedTask.parentTaskId).toBe(taskB.parentTaskId);
    expect(revisedTask.role).toBe(taskB.role);
    expect(revisedTask.isolation).toBe(taskB.isolation);
    expect(revisedTask.touches).toEqual(taskB.touches);
    expect(revisedTask.contract).toEqual(taskB.contract);
    expect(revisedTask.assignee?.accessCeiling).toBe(taskB.assignee?.accessCeiling);
    const revalidationTasks = await Promise.all(
      revised.revalidateTaskIds.map((taskId) => client!.call('task/get', { projectId, taskId })),
    );
    expect(
      revalidationTasks.some(
        (revalidation) =>
          (revalidation.input as Record<string, unknown>).targetRef ===
            'canon:quest.harbor-rescue' &&
          revalidation.role === 'validator' &&
          revalidation.contract?.required.includes('tool-validation'),
      ),
    ).toBe(true);
    const discussion = await client.call('board/thread', {
      projectId,
      threadId: request.threadId,
    });
    expect(discussion.messages.some((message) => message.body.includes(revisionNote))).toBe(true);

    const rejectionNote = 'Reject the lantern addition but preserve the map clue.';
    const rejected = await client.call('change/feedback', {
      projectId,
      target: { kind: 'task', ref: taskA.taskId },
      decision: 'reject',
      note: rejectionNote,
    });
    expect(rejected.reopenedTaskIds).toHaveLength(1);
    const rejectedTask = await client.call('task/get', { projectId, taskId: taskA.taskId });
    expect(rejectedTask.result?.reviewStatus).toBe('rejected');
    const rejectionAttempt = await client.call('task/get', {
      projectId,
      taskId: rejected.reopenedTaskIds[0]!,
    });
    expect(rejectionAttempt.input).toMatchObject({ feedback: rejectionNote });
    const revertIntegration = await waitForRevertIntegration(String(integrationA.mergeCommit));
    expect(revertIntegration.status).toBe('integrated');

    const finalAria = readFileSync(path.join(project.path, ariaPath), 'utf8');
    const finalGameplayReadme = readFileSync(path.join(project.path, 'game', 'README.md'), 'utf8');
    expect(finalAria).not.toContain('lantern by the north pier');
    expect(finalAria).toContain('discovers a map beneath the north pier');
    expect(finalAria).toContain('mark from the old lighthouse');
    expect(finalGameplayReadme).toContain('map clue to the harbor rescue');
    const commits = execFileSync('git', ['log', '--merges', '--format=%s', '-5'], {
      cwd: project.path,
      encoding: 'utf8',
    });
    expect(commits).toContain(`Integrate task ${taskA.taskId}`);
    expect(commits).toContain(`Integrate task ${reconcileTaskId}`);
    const revertMergeTaskId = String(revertIntegration.reconcileTaskId ?? revertIntegration.taskId);
    expect(commits).toContain(`Integrate task ${revertMergeTaskId}`);
    expect(providerRequests.length).toBeGreaterThanOrEqual(10);
  }, 120_000);
});

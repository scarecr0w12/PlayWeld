import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { uuidv7, type Model, type RoleRecord, type TaskRecord } from '@gamecrafter/contracts';
import { Database } from '../db/database';
import { migrate } from '../db/migrator';
import { projectMigrations } from '../projects/migrations';
import { TaskStore } from '../tasks/task-store';
import type { TaskService } from '../tasks/task-service';
import type { ModelRegistry } from './model-registry';
import { ModelRouter } from './router';
import { CompletionService } from './completion-service';

let database: Database;
let store: TaskStore;
const projectId = uuidv7();
beforeEach(() => {
  database = Database.open(':memory:');
  migrate(database, projectMigrations);
  store = new TaskStore(database);
});
afterEach(() => database.close());

function task(parent?: TaskRecord, role?: string): TaskRecord {
  const taskId = uuidv7();
  return store.insert({
    schemaVersion: 1,
    taskId,
    projectId,
    parentTaskId: parent?.taskId ?? null,
    rootTaskId: parent?.rootTaskId ?? taskId,
    depth: parent ? parent.depth + 1 : 0,
    kind: 'agent.run',
    title: taskId,
    goal: taskId,
    goalHash: taskId,
    state: 'running',
    priority: 50,
    dependsOn: [],
    assignee: role ? { role } : null,
    ...(role ? { role } : {}),
    budget: parent ? {} : { maxCostUsd: 0.2 },
    spent: { costUsd: 0, tokens: 0 },
    attempt: 1,
    maxAttempts: 1,
    lease: null,
    input: null,
    checkpoint: null,
    result: null,
    error: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    startedAt: new Date().toISOString(),
    finishedAt: null,
  });
}

function fixture() {
  const model = {
    modelId: 'fixture/model',
    accountId: 'fixture',
    enabled: true,
    capabilities: {
      chat: true,
      tools: true,
      streaming: false,
      contextWindow: 1010,
      maxInputTokens: 1000,
      maxOutputTokens: 10,
    },
    pricing: { inputPerMTokUsd: 100, outputPerMTokUsd: 2000 },
    metadataFields: {},
  } as Model;
  const provider = vi.fn(async () => ({
    content: 'done',
    toolCalls: [],
    finishReason: 'stop',
    usage: { inputTokens: 1000, outputTokens: 10, costUsd: 0.12, costStatus: 'known' },
    latencyMs: 1,
  }));
  const registry = {
    getModel: () => model,
    getRuntimeAccount: () => ({ enabled: true, providerKind: 'fixture' }),
    getProvider: () => ({ complete: provider }),
    listPools: () => [],
  } as unknown as ModelRegistry;
  const router = new ModelRouter({
    registry,
    database,
    settings: { resolve: () => ({ value: Infinity }) as never },
  });
  router.recordModelUsage = vi.fn();
  router.reportOutcome = vi.fn();
  const service = new CompletionService(registry, router);
  service.setTaskBudgetService({
    get: (_projectId: string, id: string) => store.get(id)!,
    runtime: () => ({
      store,
      graph: { update: (id: string, patch: Partial<TaskRecord>) => store.update(id, patch) },
    }),
  } as unknown as TaskService);
  const complete = (entry: TaskRecord, signal?: AbortSignal) =>
    service.complete(
      {
        projectId,
        taskId: entry.taskId,
        modelId: model.modelId,
        request: { messages: [{ role: 'user', content: 'Hi' }] },
      },
      { signal },
    );
  return { service, router, registry, provider, complete };
}

describe('canonical completion task constraints', () => {
  it('charges direct completions durably and prevents a sibling from exceeding the root envelope', async () => {
    const root = task();
    const first = task(root);
    const second = task(root);
    const f = fixture();
    await f.complete(first);
    expect(store.get(first.taskId)?.spent).toEqual({ costUsd: 0.12, tokens: 1010 });
    await expect(f.complete(second)).rejects.toThrow();
    expect(f.provider).toHaveBeenCalledTimes(1);
    expect(store.events().filter((event) => event.kind === 'budget.reservation')).toHaveLength(1);
    expect(store.events().filter((event) => event.kind === 'budget.settlement')).toHaveLength(1);
  });
  it('enforces the task role pool even when a caller supplies a raw model ID', async () => {
    const entry = task(undefined, 'constrained');
    const f = fixture();
    f.registry.listPools = () =>
      [
        {
          poolId: uuidv7(),
          name: 'narrow',
          scope: 'platform',
          projectId: null,
          target: null,
          modelIds: ['other/model'],
        },
      ] as never;
    f.router.setRoleResolver(
      () => ({ name: 'constrained', scope: 'project', modelPool: 'narrow' }) as RoleRecord,
    );
    await expect(f.complete(entry)).rejects.toThrow();
    expect(f.provider).not.toHaveBeenCalled();
    expect(store.events().filter((event) => event.kind === 'budget.reservation')).toHaveLength(0);
  });
  it('does not start or reserve a cancelled provider request', async () => {
    const entry = task();
    const f = fixture();
    const controller = new AbortController();
    controller.abort();
    await expect(f.complete(entry, controller.signal)).rejects.toThrow();
    expect(f.provider).not.toHaveBeenCalled();
    expect(store.events().filter((event) => event.kind === 'budget.reservation')).toHaveLength(0);
  });
});

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { uuidv7, RpcErrorCode, type TaskRecord } from '@gamecrafter/contracts';
import { Database } from '../db/database';
import { migrate } from '../db/migrator';
import { projectMigrations } from '../projects/migrations';
import { TaskStore } from '../tasks/task-store';
import type { TaskService } from '../tasks/task-service';
import { runBudgetedModelCall } from './shared-task-budget';

let db: Database;
let store: TaskStore;
let service: TaskService;
const projectId = uuidv7();
beforeEach(() => {
  db = Database.open(':memory:');
  migrate(db, projectMigrations);
  store = new TaskStore(db);
  service = servicePort();
});
afterEach(() => db.close());
function servicePort(): TaskService {
  return {
    get: (_projectId: string, id: string) => store.get(id)!,
    runtime: () => ({
      store,
      graph: { update: (id: string, patch: Partial<TaskRecord>) => store.update(id, patch) },
    }),
  } as unknown as TaskService;
}
function task(parent?: TaskRecord, budget: TaskRecord['budget'] = {}): TaskRecord {
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
    assignee: null,
    budget,
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
const usage = (costUsd: number | null, tokens = 10) => ({ value: 'done', costUsd, tokens });

describe('shared task budget dispatch', () => {
  it('retains cancellation of succeeded follow-up lineage after service reconstruction', async () => {
    const root = task(undefined, { maxCostUsd: 1 });
    store.transition(root.taskId, 'succeeded', 'test', 'test');
    const followup = task(root);
    store.appendEvent(
      root.taskId,
      'task.cancel_requested',
      { reason: 'user_cancelled' },
      'service',
    );
    const dispatch = vi.fn();
    await expect(
      runBudgetedModelCall(servicePort(), projectId, followup.taskId, dispatch),
    ).rejects.toThrow('durable cancellation request');
    expect(dispatch).not.toHaveBeenCalled();
    expect(store.events().filter((event) => event.kind === 'budget.reservation')).toHaveLength(0);
  });

  it('allows service-created follow-up lineage under a succeeded ancestor while retaining its shared ceiling', async () => {
    const root = task(undefined, { maxCostUsd: 1 });
    store.update(root.taskId, { spent: { costUsd: 0.7, tokens: 5 } });
    store.transition(root.taskId, 'succeeded', 'test', 'test');
    const followup = task(root);
    await runBudgetedModelCall(service, projectId, followup.taskId, async (limits, mark) => {
      expect(limits.remainingCostUsd).toBeCloseTo(0.3);
      mark();
      return usage(0.3, 10);
    });
    await expect(
      runBudgetedModelCall(service, projectId, followup.taskId, vi.fn()),
    ).rejects.toThrow('Shared task budget exhausted');
  });
  it.each(['succeeded', 'failed', 'cancelled'])(
    'never dispatches paid calls on the completed current task (%s)',
    async (state) => {
      const root = task(undefined, { maxCostUsd: 1 });
      store.transition(root.taskId, state as TaskRecord['state'], 'test', 'test');
      const dispatch = vi.fn();
      await expect(runBudgetedModelCall(service, projectId, root.taskId, dispatch)).rejects.toThrow(
        'terminal task',
      );
      expect(dispatch).not.toHaveBeenCalled();
    },
  );

  it('settles exact token usage when an optional monetary price is unknown and no monetary ceiling exists', async () => {
    const root = task(undefined, { maxTokens: 100 });
    await runBudgetedModelCall(service, projectId, root.taskId, async (_limits, mark) => {
      mark();
      return { ...usage(null, 20), costStatus: 'unknown' };
    });
    await runBudgetedModelCall(servicePort(), projectId, root.taskId, async (limits, mark) => {
      expect(limits).toEqual({ remainingTokens: 80 });
      mark();
      return { ...usage(null, 10), costStatus: 'partial' };
    });
    expect(store.get(root.taskId)!.spent).toEqual({ costUsd: 0, tokens: 30 });
    expect(store.events().filter((event) => event.kind === 'budget.settlement')).toHaveLength(2);
  });

  it('serializes concurrent siblings and rechecks durable actual spend before the next provider call', async () => {
    const root = task(undefined, { maxCostUsd: 1, maxTokens: 100 });
    const a = task(root);
    const b = task(root);
    let release!: () => void;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    const first = runBudgetedModelCall(service, projectId, a.taskId, async (limits, mark) => {
      expect(limits).toEqual({ remainingCostUsd: 1, remainingTokens: 100 });
      mark();
      await gate;
      return usage(0.7, 60);
    });
    const secondDispatch = vi.fn(async (limits) => {
      expect(limits.remainingCostUsd).toBeCloseTo(0.3);
      expect(limits.remainingTokens).toBe(40);
      return usage(0.3, 40);
    });
    const second = runBudgetedModelCall(service, projectId, b.taskId, secondDispatch);
    await Promise.resolve();
    expect(secondDispatch).not.toHaveBeenCalled();
    release();
    await Promise.all([first, second]);
    expect(store.get(a.taskId)!.spent).toEqual({ costUsd: 0.7, tokens: 60 });
    expect(store.get(b.taskId)!.spent).toEqual({ costUsd: 0.3, tokens: 40 });
    const next = vi.fn();
    await expect(runBudgetedModelCall(service, projectId, root.taskId, next)).rejects.toMatchObject(
      { code: RpcErrorCode.AgentBudgetExceeded },
    );
    expect(next).not.toHaveBeenCalled();
  });
  it('counts every descendant across reconstructed service state and intersects nested ceilings', async () => {
    const root = task(undefined, { maxCostUsd: 3 });
    for (let i = 0; i < 205; i++)
      store.update(task(root).taskId, { spent: { costUsd: 0.01, tokens: 1 } });
    const branch = task(root, { maxCostUsd: 0.5 });
    const leaf = task(branch);
    store.update(branch.taskId, { spent: { costUsd: 0.2, tokens: 0 } });
    await runBudgetedModelCall(servicePort(), projectId, leaf.taskId, async (limits) => {
      expect(limits.remainingCostUsd).toBeCloseTo(0.3);
      expect(limits.remainingTokens).toBeUndefined();
      return usage(0.1);
    });
  });
  it.each(['unknown', 'partial'])(
    'retains an explicit %s charge hold across reconstruction',
    async (costStatus) => {
      const root = task(undefined, { maxCostUsd: 1 });
      const child = task(root);
      await runBudgetedModelCall(service, projectId, child.taskId, async (_limits, mark) => {
        mark();
        return { ...usage(costStatus === 'unknown' ? null : 0.1), costStatus };
      });
      expect(store.get(child.taskId)!.spent.costUsd).toBe(costStatus === 'unknown' ? 0 : 0.1);
      const dispatch = vi.fn();
      await expect(
        runBudgetedModelCall(servicePort(), projectId, root.taskId, dispatch),
      ).rejects.toThrow('unresolved provider charge');
      expect(dispatch).not.toHaveBeenCalled();
    },
  );
  it('holds an interrupted provider reservation but releases deterministic pre-dispatch rejection', async () => {
    const root = task(undefined, { maxCostUsd: 1 });
    await expect(
      runBudgetedModelCall(service, projectId, root.taskId, async () => {
        throw new Error('invalid input');
      }),
    ).rejects.toThrow('invalid input');
    expect(store.events().filter((e) => e.kind === 'budget.reservation')).toHaveLength(0);
    await expect(
      runBudgetedModelCall(service, projectId, root.taskId, async (_limits, mark) => {
        mark();
        throw new Error('connection lost');
      }),
    ).rejects.toThrow('connection lost');
    await expect(
      runBudgetedModelCall(servicePort(), projectId, root.taskId, vi.fn()),
    ).rejects.toThrow('unresolved provider charge');
  });
  it('rejects unpriced optional calls before reserving and preserves ordinary unbudgeted parallelism', async () => {
    const root = task(undefined, { maxCostUsd: 1 });
    const dispatch = vi.fn();
    await expect(
      runBudgetedModelCall(service, projectId, root.taskId, dispatch, true),
    ).rejects.toThrow('no verifiable');
    expect(dispatch).not.toHaveBeenCalled();
    expect(store.events().filter((e) => e.kind === 'budget.reservation')).toHaveLength(0);
    const unlimited = task();
    let entered = 0;
    let release!: () => void;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    const operation = async () => {
      entered++;
      await gate;
      return usage(0.1);
    };
    const calls = [task(unlimited), task(unlimited)].map((entry) =>
      runBudgetedModelCall(service, projectId, entry.taskId, operation),
    );
    await Promise.resolve();
    expect(entered).toBe(2);
    release();
    await Promise.all(calls);
  });
  it('rejects descendants of a terminal ancestor before paid dispatch', async () => {
    const root = task(undefined, { maxCostUsd: 1 });
    const child = task(root);
    store.transition(root.taskId, 'cancelled', 'test', 'test');
    await expect(runBudgetedModelCall(service, projectId, child.taskId, vi.fn())).rejects.toThrow(
      'terminal ancestor',
    );
  });
});

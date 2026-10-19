import { RpcError, RpcErrorCode, uuidv7, type TaskRecord } from '@gamecrafter/contracts';
import type { TaskService } from '../tasks/task-service';

export interface SharedBudgetLimits {
  remainingCostUsd?: number;
  remainingTokens?: number;
}

const queues = new WeakMap<TaskService, Map<string, Promise<void>>>();
const reservationKind = 'budget.reservation';
const settlementKind = 'budget.settlement';

/** Serializes dispatch within one request tree; durable open reservations fail closed after restart. */
export async function runBudgetedModelCall<T>(
  tasks: TaskService,
  projectId: string,
  taskId: string,
  dispatch: (
    limits: SharedBudgetLimits,
    markDispatched: () => void,
  ) => Promise<{
    value: T;
    costUsd: number | null;
    tokens: number;
    costStatus?: string;
  }>,
  unpriced = false,
): Promise<T> {
  const original = tasks.get(projectId, taskId);
  let bounded = false;
  let initial: TaskRecord | undefined = original;
  while (initial) {
    bounded ||= initial.budget.maxCostUsd !== undefined || initial.budget.maxTokens !== undefined;
    initial = initial.parentTaskId ? tasks.get(projectId, initial.parentTaskId) : undefined;
  }
  const key = `${projectId}:${original.rootTaskId ?? taskId}`;
  let queue = queues.get(tasks);
  if (!queue) queues.set(tasks, (queue = new Map()));
  const previous = bounded ? (queue.get(key) ?? Promise.resolve()) : Promise.resolve();
  let release!: () => void;
  const current = new Promise<void>((resolve) => {
    release = resolve;
  });
  if (bounded) queue.set(key, current);
  await previous;
  try {
    const task = tasks.get(projectId, taskId);
    if (['cancelled', 'failed', 'succeeded'].includes(task.state))
      throw new RpcError(
        'Cannot dispatch a model for a terminal task.',
        RpcErrorCode.AgentBudgetExceeded,
      );
    const runtime = tasks.runtime(projectId);
    const tree = runtime.store.tree(task.rootTaskId);
    const byId = new Map(tree.map((entry) => [entry.taskId, entry]));
    const ancestors: TaskRecord[] = [];
    let ancestor: TaskRecord | undefined = task;
    while (ancestor) {
      if (['cancelled', 'failed'].includes(ancestor.state))
        throw new RpcError(
          'Cannot dispatch beneath a terminal ancestor.',
          RpcErrorCode.AgentBudgetExceeded,
        );
      ancestors.push(ancestor);
      ancestor = ancestor.parentTaskId ? byId.get(ancestor.parentTaskId) : undefined;
    }
    const events = runtime.store.events({ limit: Number.MAX_SAFE_INTEGER });
    const cancelledIds = new Set(
      events.filter((event) => event.kind === 'task.cancel_requested').map((event) => event.taskId),
    );
    if (ancestors.some((entry) => cancelledIds.has(entry.taskId)))
      throw new RpcError(
        'Cannot dispatch beneath a task with a durable cancellation request.',
        RpcErrorCode.AgentBudgetExceeded,
      );
    const settled = new Set(
      events
        .filter((event) => event.kind === settlementKind)
        .map((event) => (event.payload as { reservationId: string }).reservationId),
    );
    const open = events.filter(
      (event) =>
        event.kind === reservationKind &&
        !settled.has((event.payload as { reservationId: string }).reservationId),
    );
    const limits: SharedBudgetLimits = {};
    const descendsFrom = (entry: TaskRecord, root: string): boolean => {
      let node: TaskRecord | undefined = entry;
      while (node) {
        if (node.taskId === root) return true;
        node = node.parentTaskId ? byId.get(node.parentTaskId) : undefined;
      }
      return false;
    };
    for (const envelope of ancestors) {
      if (envelope.budget.maxCostUsd === undefined && envelope.budget.maxTokens === undefined)
        continue;
      const descendants = tree.filter((entry) => descendsFrom(entry, envelope.taskId));
      const ids = new Set(descendants.map((entry) => entry.taskId));
      if (open.some((event) => event.taskId && ids.has(event.taskId)))
        throw new RpcError(
          'Task budget has an unresolved provider charge; reconcile durable budget reservations before further paid dispatch.',
          RpcErrorCode.AgentBudgetExceeded,
        );
      if (envelope.budget.maxCostUsd !== undefined) {
        const remaining =
          envelope.budget.maxCostUsd -
          descendants.reduce((sum, entry) => sum + entry.spent.costUsd, 0);
        limits.remainingCostUsd = Math.min(limits.remainingCostUsd ?? Infinity, remaining);
      }
      if (envelope.budget.maxTokens !== undefined) {
        const remaining =
          envelope.budget.maxTokens -
          descendants.reduce((sum, entry) => sum + entry.spent.tokens, 0);
        limits.remainingTokens = Math.min(limits.remainingTokens ?? Infinity, remaining);
      }
    }
    if ((limits.remainingCostUsd ?? Infinity) <= 0 || (limits.remainingTokens ?? Infinity) <= 0)
      throw new RpcError('Shared task budget exhausted.', RpcErrorCode.AgentBudgetExceeded);
    if (unpriced && (limits.remainingCostUsd !== undefined || limits.remainingTokens !== undefined))
      throw new RpcError(
        'Optional decision endpoint has no verifiable dispatch price/token bound for the shared task budget.',
        RpcErrorCode.AgentBudgetExceeded,
      );
    const reservationId = uuidv7();
    let dispatched = false;
    const result = await dispatch(limits, () => {
      if (dispatched || !bounded) return;
      runtime.store.appendEvent(taskId, reservationKind, { reservationId, ...limits }, 'service');
      dispatched = true;
    });
    const fresh = tasks.get(projectId, taskId);
    runtime.graph.update(taskId, {
      spent: {
        costUsd: fresh.spent.costUsd + (result.costUsd ?? 0),
        tokens: fresh.spent.tokens + result.tokens,
      },
    });
    // Unknown or partial prices remain explicit durable holds rather than invented actual spend.
    if (
      dispatched &&
      (limits.remainingCostUsd === undefined ||
        (result.costUsd !== null &&
          result.costStatus !== 'unknown' &&
          result.costStatus !== 'partial'))
    )
      runtime.store.appendEvent(taskId, settlementKind, { reservationId }, 'service');
    return result.value;
  } finally {
    release();
    if (queue.get(key) === current) queue.delete(key);
  }
}

import {
  computeGoalHash,
  RpcError,
  RpcErrorCode,
  TaskEventKind,
  isTerminal,
  uuidv7,
  type TaskCreateInput,
  type TaskError,
  type TaskEvent,
  type TaskQuestion,
  type TaskRecord,
  type TaskState,
} from '@gamecrafter/contracts';
import { SettingsService } from '../settings/settings-service';
import { HandlerRegistry } from '../workers/handler-registry';
import { TaskStore, type TaskRecordPatch } from './task-store';

export interface TaskGraphOptions {
  projectId: string;
  store: TaskStore;
  settings: SettingsService;
  handlers: HandlerRegistry;
  now?: () => Date;
  onTaskChanged?: (task: TaskRecord) => void;
  onTaskEvent?: (event: TaskEvent) => void;
  onQuestion?: (question: TaskQuestion) => void;
  onTaskTerminal?: (task: TaskRecord) => void;
  onCancelTask?: (taskId: string) => Promise<void> | void;
}

export interface CreatedTask {
  task: TaskRecord;
  deduplicated: boolean;
}

export class TaskGraph {
  private readonly now: () => Date;

  constructor(private readonly options: TaskGraphOptions) {
    this.now = options.now ?? (() => new Date());
  }

  create(input: TaskCreateInput, options: { deferReady?: boolean } = {}): CreatedTask {
    if (input.projectId !== this.options.projectId) {
      throw new RpcError(
        'Task project does not match its Project database',
        RpcErrorCode.TaskNotFound,
      );
    }
    if (!this.options.handlers.has(input.kind)) {
      throw new RpcError(`Unknown task kind: ${input.kind}`, RpcErrorCode.UnknownTaskKind);
    }

    const parent = input.parentTaskId ? this.requireTask(input.parentTaskId) : undefined;
    const depth = parent ? parent.depth + 1 : 0;
    const maxDepth = this.options.settings.resolve('agents.maxSpawnDepth', {
      projectId: this.options.projectId,
    }).value;
    if (depth > Number(maxDepth)) {
      throw new RpcError(
        `Task depth ${depth} exceeds the configured maximum of ${String(maxDepth)}`,
        RpcErrorCode.TaskDepthExceeded,
      );
    }

    const goalHash = computeGoalHash(input.kind, input.goal);
    const parentTaskId = input.parentTaskId ?? null;
    const duplicate = this.options.store.findActiveDuplicate(parentTaskId, goalHash);
    if (duplicate) return { task: duplicate, deduplicated: true };
    if (input.touches?.length) {
      const touchedDuplicate = this.options.store.findActiveTouchDuplicate(goalHash, input.touches);
      if (touchedDuplicate) return { task: touchedDuplicate, deduplicated: true };
    }

    const taskId = uuidv7();
    const dependencies = [...new Set(input.dependsOn ?? [])];
    this.validateDependencies(taskId, dependencies);
    const dependencyTasks = dependencies.map((dependencyId) => this.requireTask(dependencyId));
    const hasFailedDependency = dependencyTasks.some(
      (dependency) => dependency.state === 'failed' || dependency.state === 'cancelled',
    );
    const allDependenciesSucceeded = dependencyTasks.every(
      (dependency) => dependency.state === 'succeeded',
    );
    const createdAt = this.now().toISOString();
    const task: TaskRecord = {
      schemaVersion: 1,
      taskId,
      projectId: this.options.projectId,
      parentTaskId,
      rootTaskId: parent?.rootTaskId ?? taskId,
      depth,
      kind: input.kind,
      title: input.title,
      goal: input.goal,
      goalHash,
      state: 'pending',
      priority: input.priority ?? 50,
      dependsOn: dependencies,
      assignee: input.assignee ?? null,
      ...(input.touches === undefined ? {} : { touches: input.touches }),
      ...(input.role === undefined ? {} : { role: input.role }),
      ...(input.isolation === undefined ? {} : { isolation: input.isolation }),
      ...(input.contract === undefined ? {} : { contract: input.contract }),
      ...(input.integration === undefined ? {} : { integration: input.integration }),
      budget: input.budget ?? {},
      spent: { costUsd: 0, tokens: 0 },
      attempt: 1,
      maxAttempts: input.maxAttempts ?? 3,
      lease: null,
      input: input.input ?? null,
      checkpoint: null,
      result: null,
      error: null,
      createdAt,
      updatedAt: createdAt,
      startedAt: null,
      finishedAt: null,
    };

    const previousSeq = this.options.store.latestEventSeq();
    this.options.store.insert(task);
    let created = task;
    if (hasFailedDependency) {
      created = this.options.store.transition(taskId, 'blocked', 'dependency_failed', 'scheduler');
    } else if (allDependenciesSucceeded && !options.deferReady) {
      created = this.options.store.transition(
        taskId,
        'ready',
        'dependencies_satisfied',
        'scheduler',
      );
    }
    this.emitEventsSince(previousSeq);
    this.options.onTaskChanged?.(created);
    if (isTerminal(created.state)) this.options.onTaskTerminal?.(created);
    return { task: created, deduplicated: false };
  }

  get(taskId: string): TaskRecord {
    return this.requireTask(taskId);
  }

  list(filter: Parameters<TaskStore['list']>[0] = {}): TaskRecord[] {
    return this.options.store.list(filter);
  }

  tree(rootTaskId: string): TaskRecord[] {
    return this.options.store.tree(rootTaskId);
  }

  events(filter: Parameters<TaskStore['events']>[0] = {}): TaskEvent[] {
    return this.options.store.events(filter);
  }

  questions(pendingOnly = false): TaskQuestion[] {
    return this.options.store.questions(pendingOnly);
  }

  async cancel(taskId: string, reason = 'cancelled'): Promise<string[]> {
    this.requireTask(taskId);
    const tasks = this.options.store.list({ limit: Number.MAX_SAFE_INTEGER });
    const byParent = new Map<string, TaskRecord[]>();
    for (const task of tasks) {
      if (!task.parentTaskId) continue;
      const children = byParent.get(task.parentTaskId) ?? [];
      children.push(task);
      byParent.set(task.parentTaskId, children);
    }
    const descendants: TaskRecord[] = [];
    const pending = [taskId];
    while (pending.length > 0) {
      const parentId = pending.pop()!;
      for (const child of byParent.get(parentId) ?? []) {
        descendants.push(child);
        pending.push(child.taskId);
      }
    }
    const candidates = [this.requireTask(taskId), ...descendants]
      .filter((task) => !isTerminal(task.state))
      .sort(
        (left, right) => right.depth - left.depth || right.createdAt.localeCompare(left.createdAt),
      );
    const cancelled: string[] = [];
    for (const task of candidates) {
      const current = this.options.store.get(task.taskId);
      if (!current || isTerminal(current.state)) continue;
      const previousSeq = this.options.store.latestEventSeq();
      const updated = this.options.store.transition(current.taskId, 'cancelled', reason, 'user', {
        lease: null,
        finishedAt: this.now().toISOString(),
      });
      this.options.store.appendEvent(current.taskId, TaskEventKind.Cancelled, { reason }, 'user');
      this.emitEventsSince(previousSeq);
      this.options.onTaskChanged?.(updated);
      await this.options.onCancelTask?.(current.taskId);
      this.options.onTaskTerminal?.(updated);
      cancelled.push(current.taskId);
    }
    return cancelled;
  }

  transition(
    taskId: string,
    to: TaskState,
    reason: string,
    actor: string,
    patch: TaskRecordPatch = {},
  ): TaskRecord {
    const previousSeq = this.options.store.latestEventSeq();
    const task = this.options.store.transition(taskId, to, reason, actor, patch);
    this.emitEventsSince(previousSeq);
    this.options.onTaskChanged?.(task);
    if (isTerminal(task.state)) this.options.onTaskTerminal?.(task);
    return task;
  }

  update(taskId: string, patch: TaskRecordPatch): TaskRecord {
    const task = this.options.store.update(taskId, patch);
    this.options.onTaskChanged?.(task);
    return task;
  }

  appendEvent(taskId: string | null, kind: string, payload: unknown, actor: string): TaskEvent {
    const event = this.options.store.appendEvent(taskId, kind, payload, actor);
    this.options.onTaskEvent?.(event);
    return event;
  }

  complete(taskId: string, result: TaskRecord['result']): TaskRecord {
    const current = this.requireTask(taskId);
    const previousSeq = this.options.store.latestEventSeq();
    const task = this.options.store.transition(taskId, 'succeeded', 'worker_result', 'worker', {
      result,
      error: null,
      lease: null,
      finishedAt: this.now().toISOString(),
    });
    this.options.store.appendEvent(taskId, TaskEventKind.Result, { result }, 'worker');
    this.emitEventsSince(previousSeq);
    this.options.onTaskChanged?.(task);
    if (!isTerminal(current.state)) this.options.onTaskTerminal?.(task);
    return task;
  }

  fail(taskId: string, error: TaskError): TaskRecord {
    const current = this.requireTask(taskId);
    const previousSeq = this.options.store.latestEventSeq();
    let task = this.options.store.transition(taskId, 'failed', 'worker_failed', 'worker', {
      error,
      lease: null,
      finishedAt: this.now().toISOString(),
    });
    this.options.store.appendEvent(taskId, TaskEventKind.Failed, { error }, 'worker');
    if (error.retryable && current.attempt < current.maxAttempts) {
      const retryReason = error.message;
      task = this.options.store.transition(taskId, 'ready', retryReason, 'scheduler', {
        attempt: current.attempt + 1,
        lease: null,
        finishedAt: null,
      });
      this.options.store.appendEvent(
        taskId,
        TaskEventKind.Retry,
        { attempt: task.attempt, reason: retryReason },
        'scheduler',
      );
    }
    this.emitEventsSince(previousSeq);
    this.options.onTaskChanged?.(task);
    if (isTerminal(task.state)) this.options.onTaskTerminal?.(task);
    return task;
  }

  addQuestion(
    taskId: string,
    prompt: string,
    options: string[] | null,
    questionId?: string,
  ): TaskQuestion {
    const previousSeq = this.options.store.latestEventSeq();
    const question = this.options.store.addQuestion(taskId, prompt, options, 'worker', questionId);
    const task = this.options.store.transition(
      taskId,
      'waiting_input',
      'worker_question',
      'worker',
    );
    this.emitEventsSince(previousSeq);
    this.options.onTaskChanged?.(task);
    this.options.onQuestion?.(question);
    return question;
  }

  answerQuestion(taskId: string, questionId: string, answer: unknown): TaskRecord {
    const current = this.requireTask(taskId);
    if (current.state !== 'waiting_input') {
      throw new RpcError(`Task is not waiting for input: ${taskId}`, RpcErrorCode.TaskNotWaiting);
    }
    if (!this.options.store.getQuestion(taskId, questionId)) {
      throw new RpcError(`Question not found: ${questionId}`, RpcErrorCode.QuestionNotFound);
    }
    const input = asRecord(current.input);
    const previousAnswers = asRecord(input.__answers);
    input.__answers = { ...previousAnswers, [questionId]: answer };
    const previousSeq = this.options.store.latestEventSeq();
    this.options.store.answerQuestion(taskId, questionId, answer, 'user');
    this.options.store.update(taskId, { input });
    const task = this.options.store.transition(taskId, 'running', 'question_answered', 'user');
    this.emitEventsSince(previousSeq);
    this.options.onTaskChanged?.(task);
    return task;
  }

  onTaskTerminal(task: TaskRecord): void {
    const candidates = this.options.store.list({ states: ['pending', 'blocked'] });
    for (const candidate of candidates) {
      if (!candidate.dependsOn.includes(task.taskId)) continue;
      const dependencies = candidate.dependsOn.map((taskId) => this.requireTask(taskId));
      const hasFailedDependency = dependencies.some(
        (dependency) => dependency.state === 'failed' || dependency.state === 'cancelled',
      );
      const allSucceeded = dependencies.every((dependency) => dependency.state === 'succeeded');
      if (hasFailedDependency && candidate.state === 'pending') {
        this.transition(candidate.taskId, 'blocked', 'dependency_failed', 'scheduler');
      } else if (allSucceeded && (candidate.state === 'pending' || candidate.state === 'blocked')) {
        this.transition(candidate.taskId, 'ready', 'dependencies_satisfied', 'scheduler');
      }
    }
  }

  private requireTask(taskId: string): TaskRecord {
    const task = this.options.store.get(taskId);
    if (!task) throw new RpcError(`Task not found: ${taskId}`, RpcErrorCode.TaskNotFound);
    return task;
  }

  private validateDependencies(taskId: string, dependencyIds: string[]): void {
    if (dependencyIds.includes(taskId)) {
      throw new RpcError('A task cannot depend on itself', RpcErrorCode.TaskDependencyCycle);
    }
    const visited = new Set<string>();
    const visiting = new Set<string>();
    const visit = (currentId: string): void => {
      if (currentId === taskId || visiting.has(currentId)) {
        throw new RpcError('Task dependency cycle detected', RpcErrorCode.TaskDependencyCycle);
      }
      if (visited.has(currentId)) return;
      const current = this.requireTask(currentId);
      visiting.add(currentId);
      for (const dependencyId of current.dependsOn) visit(dependencyId);
      visiting.delete(currentId);
      visited.add(currentId);
    };
    for (const dependencyId of dependencyIds) visit(dependencyId);
  }

  private emitEventsSince(afterSeq: number): void {
    for (const event of this.options.store.events({ afterSeq })) this.options.onTaskEvent?.(event);
  }
}

function asRecord(value: unknown): Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? { ...(value as Record<string, unknown>) }
    : {};
}

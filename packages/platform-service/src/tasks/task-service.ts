import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import {
  minAccessMode,
  isTerminal,
  type RoleRecord,
  type TaskCreateInput,
  type TaskEvent,
  type TaskQuestion,
  type TaskRecord,
} from '@gamecrafter/contracts';
import { requireExistingProjectPath } from '../assets/path-utils';
import type { ProfileStore } from '../profile/profile-store';
import { ProjectDatabases } from '../projects/project-databases';
import { SettingsService } from '../settings/settings-service';
import { HandlerRegistry } from '../workers/handler-registry';
import { TaskGraph, type CreatedTask } from './task-graph';
import { TaskStore, type TaskEventFilter, type TaskListFilter } from './task-store';

export interface ProjectTaskRuntime {
  projectId: string;
  store: TaskStore;
  graph: TaskGraph;
}

export interface TaskSupervisorPort {
  schedule(): Promise<void>;
  cancelTask(projectId: string, taskId: string): Promise<void>;
  answerTask(projectId: string, taskId: string, questionId: string, answer: unknown): Promise<void>;
}

export interface TaskServiceEvents {
  taskChanged(projectId: string, task: TaskRecord): void;
  taskEvent(projectId: string, event: TaskEvent): void;
  taskQuestion(projectId: string, question: TaskQuestion): void;
}

type TaskEventListener = (event: TaskEvent) => void;

interface ExternalQuestionWaiter {
  questionId?: string;
  resolve(answer: unknown): void;
  removeAbort(): void;
}

export class TaskService {
  private readonly runtimes = new Map<string, ProjectTaskRuntime>();
  private readonly externalQuestions = new Map<string, ExternalQuestionWaiter>();
  private readonly taskEventListeners = new Map<string, Set<TaskEventListener>>();
  private supervisor?: TaskSupervisorPort;
  private roleResolver?: (roleName: string, projectId: string) => RoleRecord;

  constructor(
    private readonly profile: ProfileStore,
    private readonly projectDatabases: ProjectDatabases,
    private readonly settings: SettingsService,
    private readonly handlers: HandlerRegistry,
    private readonly events: TaskServiceEvents,
  ) {}

  setSupervisor(supervisor: TaskSupervisorPort): void {
    this.supervisor = supervisor;
  }

  setRoleResolver(resolver: (roleName: string, projectId: string) => RoleRecord): void {
    this.roleResolver = resolver;
  }

  projectIds(): string[] {
    return this.profile
      .list()
      .filter(
        (project) =>
          existsSync(project.path) &&
          existsSync(path.join(project.path, 'gamecrafter.project.json')),
      )
      .map((project) => project.projectId);
  }

  runtime(projectId: string): ProjectTaskRuntime {
    const existing = this.runtimes.get(projectId);
    if (existing) return existing;

    const store = new TaskStore(this.projectDatabases.get(projectId));
    const graph = new TaskGraph({
      projectId,
      store,
      settings: this.settings,
      handlers: this.handlers,
      onTaskChanged: (task) => this.events.taskChanged(projectId, task),
      onTaskEvent: (event) => {
        this.publishTaskEvent(projectId, event);
        this.events.taskEvent(projectId, event);
      },
      onQuestion: (question) => this.events.taskQuestion(projectId, question),
      onTaskTerminal: (task) => {
        graph.onTaskTerminal(task);
        void this.supervisor?.schedule();
      },
      onCancelTask: (taskId) => this.supervisor?.cancelTask(projectId, taskId),
    });
    const runtime = { projectId, store, graph };
    this.runtimes.set(projectId, runtime);
    return runtime;
  }

  create(input: TaskCreateInput, options: { deferStart?: boolean } = {}): CreatedTask {
    const roleName = input.role ?? (input.kind === 'agent.run' ? input.assignee?.role : undefined);
    const role = roleName ? this.roleResolver?.(roleName, input.projectId) : undefined;
    const project = role ? this.profile.getById(input.projectId) : undefined;
    const projectInstructionsPath = project ? path.join(project.path, 'AGENTS.md') : undefined;
    const memoryPath =
      project && role?.memory === 'project'
        ? path.join(project.path, '.gamecrafter', 'agent-memory', role.name, 'MEMORY.md')
        : undefined;
    const normalizedInput = role
      ? {
          ...input,
          role: role.name,
          isolation: input.isolation ?? role.isolation,
          assignee: {
            ...input.assignee,
            role: role.name,
            accessCeiling: input.assignee?.accessCeiling
              ? minAccessMode(input.assignee.accessCeiling, role.maxAccess)
              : role.maxAccess,
          },
          input: {
            ...asRecord(input.input),
            role,
            ...(projectInstructionsPath && existsSync(projectInstructionsPath)
              ? {
                  projectInstructions: readFileSync(
                    requireExistingProjectPath(project!.path, 'AGENTS.md'),
                    'utf8',
                  ),
                }
              : {}),
            ...(memoryPath && existsSync(memoryPath)
              ? {
                  memory: readFileSync(
                    requireExistingProjectPath(
                      project!.path,
                      path.relative(project!.path, memoryPath),
                    ),
                    'utf8',
                  ).slice(0, 64_000),
                }
              : {}),
            agentSettings: {
              defaultMaxTurns: this.settings.resolve('coordination.defaultMaxTurns', {
                projectId: input.projectId,
              }).value,
              contextTokenCeiling: this.settings.resolve('coordination.maxTranscriptTokens', {
                projectId: input.projectId,
              }).value,
              decisionsEnabled:
                this.settings.resolve('models.decisions.mode', { projectId: input.projectId })
                  .value !== 'off' &&
                Boolean(
                  this.settings.resolve('models.decisions.accountId', {
                    projectId: input.projectId,
                  }).value,
                ) &&
                Boolean(
                  this.settings.resolve('models.decisions.model', { projectId: input.projectId })
                    .value,
                ),
            },
          },
        }
      : input;
    const result = this.runtime(input.projectId).graph.create(normalizedInput, {
      deferReady: options.deferStart,
    });
    if (!options.deferStart) void this.supervisor?.schedule();
    return result;
  }

  createAttempt(original: TaskRecord, feedback: string): TaskRecord {
    const created = this.create(
      {
        projectId: original.projectId,
        kind: original.kind,
        title: `${original.title} (attempt ${original.attempt + 1})`,
        goal: original.goal,
        parentTaskId: original.parentTaskId ?? undefined,
        dependsOn: original.dependsOn,
        priority: original.priority,
        budget: original.budget,
        maxAttempts: original.maxAttempts,
        ...(original.assignee === null ? {} : { assignee: original.assignee }),
        ...(original.touches === undefined ? {} : { touches: original.touches }),
        ...(original.role === undefined ? {} : { role: original.role }),
        ...(original.isolation === undefined ? {} : { isolation: original.isolation }),
        ...(original.contract === undefined ? {} : { contract: original.contract }),
        integration: null,
        input: { ...asRecord(original.input), feedback },
      },
      { deferStart: true },
    );
    if (created.deduplicated) return created.task;
    const graph = this.runtime(original.projectId).graph;
    let attempt = graph.update(created.task.taskId, { attempt: original.attempt + 1 });
    if (attempt.state === 'pending') {
      const dependencies = attempt.dependsOn.map((taskId) => graph.get(taskId));
      if (dependencies.every((dependency) => dependency.state === 'succeeded')) {
        attempt = graph.transition(attempt.taskId, 'ready', 'feedback_attempt_ready', 'service');
      }
    }
    void this.supervisor?.schedule();
    return attempt;
  }

  activateDeferred(projectId: string, taskId: string): TaskRecord {
    const graph = this.runtime(projectId).graph;
    const task = graph.get(taskId);
    if (task.state !== 'pending') return task;
    const dependencies = task.dependsOn.map((dependencyId) => graph.get(dependencyId));
    if (
      dependencies.some((dependency) =>
        ['failed', 'cancelled', 'blocked'].includes(dependency.state),
      )
    ) {
      return graph.transition(taskId, 'blocked', 'dependency_failed', 'service');
    }
    if (dependencies.every((dependency) => dependency.state === 'succeeded')) {
      const ready = graph.transition(taskId, 'ready', 'dependencies_satisfied', 'service');
      void this.supervisor?.schedule();
      return ready;
    }
    return task;
  }

  get(projectId: string, taskId: string): TaskRecord {
    return this.runtime(projectId).graph.get(taskId);
  }

  list(projectId: string, filter: TaskListFilter = {}): TaskRecord[] {
    return this.runtime(projectId).graph.list(filter);
  }

  tree(projectId: string, rootTaskId: string): TaskRecord[] {
    return this.runtime(projectId).graph.tree(rootTaskId);
  }

  async cancel(
    projectId: string,
    taskId: string,
    reason?: string,
  ): Promise<{ cancelled: string[] }> {
    const cancelled = await this.runtime(projectId).graph.cancel(taskId, reason);
    void this.supervisor?.schedule();
    return { cancelled };
  }

  eventsForProject(projectId: string, filter: TaskEventFilter = {}): TaskEvent[] {
    return this.runtime(projectId).graph.events(filter);
  }

  recordExternalProgress(projectId: string, taskId: string, payload: unknown): TaskEvent {
    this.get(projectId, taskId);
    return this.runtime(projectId).graph.appendEvent(taskId, 'a2a.remote_progress', payload, 'a2a');
  }

  pendingQuestionForTask(projectId: string, taskId: string): TaskQuestion | undefined {
    const task = this.get(projectId, taskId);
    if (task.state !== 'waiting_input') return undefined;
    const pending = this.runtime(projectId)
      .graph.questions(true)
      .filter((question) => question.taskId === taskId);
    return pending.length === 1 ? pending[0] : undefined;
  }

  async continueExternalTask(
    projectId: string,
    taskId: string,
    answer: string,
  ): Promise<TaskRecord> {
    const task = this.get(projectId, taskId);
    if (task.state === 'waiting_input') {
      const question = this.pendingQuestionForTask(projectId, taskId);
      if (!question) {
        throw new Error(`Task has no unambiguous pending question: ${taskId}`);
      }
      return this.answer(projectId, taskId, question.questionId, answer);
    }
    if (task.state === 'failed') return this.createAttempt(task, answer);
    throw new Error(`Task cannot be continued without a pending question: ${taskId}`);
  }

  async *subscribeTaskEvents(
    projectId: string,
    taskId: string,
    options: { afterSeq?: number; signal?: AbortSignal; bufferLimit?: number } = {},
  ): AsyncGenerator<TaskEvent, void, undefined> {
    this.get(projectId, taskId);
    const key = `${projectId}:${taskId}`;
    const limit = Math.max(1, Math.min(options.bufferLimit ?? 128, 512));
    const queue: TaskEvent[] = [];
    let overflow = false;
    let wake: (() => void) | undefined;
    const waiter: TaskEventListener = (event) => {
      if (event.seq <= (options.afterSeq ?? 0)) return;
      if (queue.length >= limit) {
        overflow = true;
        queue.length = 0;
      } else if (!overflow) {
        queue.push(event);
      }
      wake?.();
      wake = undefined;
    };
    const listeners = this.taskEventListeners.get(key) ?? new Set<TaskEventListener>();
    listeners.add(waiter);
    this.taskEventListeners.set(key, listeners);
    const onAbort = () => {
      wake?.();
      wake = undefined;
    };
    options.signal?.addEventListener('abort', onAbort, { once: true });
    let lastSeq = options.afterSeq ?? 0;
    try {
      for (const event of this.eventsForProject(projectId, {
        taskId,
        afterSeq: lastSeq,
        limit: limit,
      })) {
        if (event.seq <= lastSeq) continue;
        lastSeq = event.seq;
        yield event;
      }
      if (overflow) throw new Error('Task event stream exceeded its bounded buffer');
      if (isTerminal(this.get(projectId, taskId).state)) return;
      while (true) {
        if (options.signal?.aborted) throw abortError(options.signal.reason);
        if (overflow) throw new Error('Task event stream exceeded its bounded buffer');
        const event = queue.shift();
        if (event) {
          if (event.seq <= lastSeq) continue;
          lastSeq = event.seq;
          yield event;
          if (isTerminal(this.get(projectId, taskId).state)) return;
          continue;
        }
        await new Promise<void>((resolve) => {
          wake = resolve;
          if (options.signal?.aborted) onAbort();
        });
      }
    } finally {
      options.signal?.removeEventListener('abort', onAbort);
      listeners.delete(waiter);
      if (listeners.size === 0) this.taskEventListeners.delete(key);
    }
  }

  async askQuestion(
    projectId: string,
    taskId: string,
    prompt: string,
    options: string[] | null = null,
    signal?: AbortSignal,
  ): Promise<unknown> {
    if (signal?.aborted) throw abortError(signal.reason);
    const key = `${projectId}:${taskId}`;
    if (this.externalQuestions.has(key)) {
      throw new Error(`Task already has an external question pending: ${taskId}`);
    }
    let resolveAnswer: (answer: unknown) => void = () => undefined;
    let rejectAnswer: (error: Error) => void = () => undefined;
    const answer = new Promise<unknown>((resolve, reject) => {
      resolveAnswer = resolve;
      rejectAnswer = reject;
    });
    const onAbort = () => {
      this.externalQuestions.delete(key);
      rejectAnswer(abortError(signal?.reason));
    };
    const waiter: ExternalQuestionWaiter = {
      resolve: resolveAnswer,
      removeAbort: () => signal?.removeEventListener('abort', onAbort),
    };
    signal?.addEventListener('abort', onAbort, { once: true });
    this.externalQuestions.set(key, waiter);
    try {
      const question = this.runtime(projectId).graph.addQuestion(taskId, prompt, options);
      waiter.questionId = question.questionId;
      return await answer;
    } catch (error) {
      this.externalQuestions.delete(key);
      waiter.removeAbort();
      throw error;
    }
  }

  async answer(
    projectId: string,
    taskId: string,
    questionId: string,
    answer: unknown,
  ): Promise<TaskRecord> {
    const task = this.runtime(projectId).graph.answerQuestion(taskId, questionId, answer);
    const key = `${projectId}:${taskId}`;
    const externalQuestion = this.externalQuestions.get(key);
    if (externalQuestion?.questionId === questionId) {
      this.externalQuestions.delete(key);
      externalQuestion.removeAbort();
      externalQuestion.resolve(answer);
      return task;
    }
    await this.supervisor?.answerTask(projectId, taskId, questionId, answer);
    return task;
  }

  questions(pendingOnly = false): TaskQuestion[] {
    return this.projectIds()
      .flatMap((projectId) => this.runtime(projectId).graph.questions(pendingOnly))
      .sort((left, right) => left.askedAt.localeCompare(right.askedAt));
  }

  private publishTaskEvent(projectId: string, event: TaskEvent): void {
    if (!event.taskId) return;
    for (const listener of this.taskEventListeners.get(`${projectId}:${event.taskId}`) ?? []) {
      listener(event);
    }
  }
}

function asRecord(value: unknown): Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function abortError(reason: unknown): Error {
  const error = new Error(reason === undefined ? 'Question was cancelled' : String(reason));
  error.name = 'AbortError';
  return error;
}

import { fork, type ChildProcess } from 'node:child_process';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import { RpcError, RpcErrorCode, TaskEventKind, uuidv7 } from '@gamecrafter/contracts';
import type { IntegrationRecord, TaskError, TaskRecord, TaskResult } from '@gamecrafter/contracts';
import { SettingsService } from '../settings/settings-service';
import type { TaskSupervisorPort } from '../tasks/task-service';
import type { ProjectTaskRuntime, TaskService } from '../tasks/task-service';
import type { ToolBroker } from '../tools/tool-broker';
import type { TaskWorktree, WorktreeManager } from '../change/worktree-manager';
import type { HandlerRegistry } from './handler-registry';
import type { WorkerCommand, WorkerMessage } from './types';

interface RunningWorker {
  projectId: string;
  taskId: string;
  workerId: string;
  worktreePath?: string;
  child: ChildProcess;
  exitPromise: Promise<void>;
  resolveExit: () => void;
  stopRequested: boolean;
  finalMessage: boolean;
  answerAcks: Map<string, (received: boolean) => void>;
  toolCalls: Map<string, AbortController>;
  cancelTimer?: NodeJS.Timeout;
}

export interface WorkerScheduleSnapshot {
  at: string;
  projectId: string;
  maxConcurrent: number;
  activeWorkerTaskIds: string[];
  readyTaskIds: string[];
  expiredReadyTaskIds: string[];
  delayedReadyTaskIds: string[];
  workers: Array<{
    taskId: string;
    workerId: string;
    finalMessage: boolean;
    stopRequested: boolean;
    childAlive: boolean;
  }>;
}

export interface WorkerSupervisorOptions {
  tasks: TaskService;
  settings: SettingsService;
  handlers: HandlerRegistry;
  tools?: ToolBroker;
  worktrees?: WorktreeManager;
  now?: () => Date;
  leaseTtlMs?: number;
  tickIntervalMs?: number;
  workerMainPath?: string;
  onWorkerStarted?: (taskId: string, workerId: string, pid: number) => void;
  onWorkerFinalMessage?: (
    taskId: string,
    workerId: string,
    messageType: 'result' | 'failed',
  ) => void;
  onWorkerExited?: (taskId: string, workerId: string) => void;
  onLeaseRenewed?: (projectId: string, taskId: string, workerId: string) => void;
  onTaskLeaseExpired?: (projectId: string, taskId: string) => void;
  validateResult?: (
    task: TaskRecord,
    result: TaskResult,
  ) => Promise<{ result: TaskResult; integration?: IntegrationRecord }>;
  onScheduleSnapshot?: (snapshot: WorkerScheduleSnapshot) => void;
}

export class WorkerSupervisor implements TaskSupervisorPort {
  private readonly workers = new Map<string, RunningWorker>();
  private readonly retryAfter = new Map<string, number>();
  private readonly now: () => Date;
  private readonly leaseTtlMs: number;
  private readonly tickIntervalMs: number;
  private readonly workerMainPath: string;
  private timer?: NodeJS.Timeout;
  private scheduling?: Promise<void>;
  private stopping?: Promise<void>;
  private disposed = false;

  constructor(private readonly options: WorkerSupervisorOptions) {
    this.now = options.now ?? (() => new Date());
    this.leaseTtlMs = options.leaseTtlMs ?? 30_000;
    this.tickIntervalMs = options.tickIntervalMs ?? 1_000;
    this.workerMainPath = options.workerMainPath ?? resolveWorkerMain();
  }

  start(): void {
    if (this.timer || this.disposed) return;
    this.timer = setInterval(() => void this.schedule(), this.tickIntervalMs);
    this.timer.unref();
    void this.schedule();
  }

  schedule(): Promise<void> {
    if (this.disposed) return Promise.resolve();
    if (this.scheduling) return this.scheduling;
    this.scheduling = this.scheduleTasks().finally(() => {
      this.scheduling = undefined;
    });
    return this.scheduling;
  }

  async answerTask(
    projectId: string,
    taskId: string,
    questionId: string,
    answer: unknown,
  ): Promise<void> {
    const worker = this.workers.get(taskId);
    if (worker && worker.projectId === projectId && !worker.stopRequested) {
      let resolveAcknowledgement: (received: boolean) => void = () => undefined;
      const acknowledgement = new Promise<boolean>((resolve) => {
        resolveAcknowledgement = resolve;
      });
      worker.answerAcks.set(questionId, resolveAcknowledgement);
      const timeout = setTimeout(() => resolveAcknowledgement(false), 1_000);
      this.send(worker.child, { type: 'answer', questionId, answer });
      const received = await acknowledgement;
      clearTimeout(timeout);
      worker.answerAcks.delete(questionId);
      if (!received) await this.cancelTask(projectId, taskId);
    }
    await this.schedule();
  }

  async cancelTask(_projectId: string, taskId: string): Promise<void> {
    const worker = this.workers.get(taskId);
    if (!worker || worker.stopRequested) return;
    worker.stopRequested = true;
    for (const controller of worker.toolCalls.values()) controller.abort('task_cancelled');
    this.send(worker.child, { type: 'cancel' });
    worker.cancelTimer = setTimeout(() => worker.child.kill('SIGKILL'), 2_000);
    worker.cancelTimer.unref();
    await Promise.race([worker.exitPromise, delay(2_500)]);
    if (worker.child.exitCode === null && worker.child.signalCode === null) {
      worker.child.kill('SIGKILL');
    }
  }

  recoverOnStart(): void {
    for (const projectId of this.options.tasks.projectIds()) {
      const runtime = this.options.tasks.runtime(projectId);
      for (const task of runtime.store.list({ states: ['claimed', 'running'] })) {
        runtime.graph.transition(task.taskId, 'ready', 'service_restart', 'service', {
          lease: null,
        });
        runtime.graph.appendEvent(
          task.taskId,
          TaskEventKind.Retry,
          { attempt: task.attempt, reason: 'service_restart' },
          'service',
        );
      }
      for (const task of runtime.store.list({ states: ['waiting_input'] })) {
        if (task.lease) runtime.graph.update(task.taskId, { lease: null });
      }
    }
  }

  stopAll(options: { checkpoint: boolean }): Promise<void> {
    if (this.stopping) return this.stopping;
    this.disposed = true;
    if (this.timer) clearInterval(this.timer);
    this.timer = undefined;
    this.stopping = this.shutdown(options.checkpoint);
    return this.stopping;
  }

  private async scheduleTasks(): Promise<void> {
    const expiredLeases = await this.expireLeases();
    await this.enforceDurationBudgets();
    if (this.disposed) return;

    for (const projectId of this.options.tasks.projectIds()) {
      const runtime = this.options.tasks.runtime(projectId);
      let maxConcurrent: number;
      try {
        maxConcurrent = Number(
          this.options.settings.resolve('agents.maxConcurrentPerProject', { projectId }).value,
        );
      } catch {
        maxConcurrent = 8;
      }
      maxConcurrent = Math.max(1, Math.floor(maxConcurrent) || 8);
      const projectWorkers = [...this.workers.values()].filter(
        (worker) => worker.projectId === projectId,
      );
      const activeWorkers = projectWorkers.filter(
        (worker) => !worker.stopRequested && !worker.finalMessage,
      );
      let active = activeWorkers.length;
      const tasks = runtime.store.list({ states: ['ready', 'running'], limit: 1_000 });
      const readyTasks = tasks.filter((task) => task.state === 'ready');
      const now = this.now().getTime();
      this.options.onScheduleSnapshot?.({
        at: this.now().toISOString(),
        projectId,
        maxConcurrent,
        activeWorkerTaskIds: activeWorkers.map((worker) => worker.taskId),
        readyTaskIds: readyTasks.map((task) => task.taskId),
        expiredReadyTaskIds: readyTasks
          .filter((task) => expiredLeases.has(task.taskId))
          .map((task) => task.taskId),
        delayedReadyTaskIds: readyTasks
          .filter((task) => (this.retryAfter.get(task.taskId) ?? 0) > now)
          .map((task) => task.taskId),
        workers: projectWorkers.map((worker) => ({
          taskId: worker.taskId,
          workerId: worker.workerId,
          finalMessage: worker.finalMessage,
          stopRequested: worker.stopRequested,
          childAlive: worker.child.exitCode === null && worker.child.signalCode === null,
        })),
      });
      if (active >= maxConcurrent) continue;

      const candidates = tasks
        .filter(
          (task) =>
            (task.state === 'ready' ||
              (task.state === 'running' && !this.workers.has(task.taskId))) &&
            !expiredLeases.has(task.taskId) &&
            (this.retryAfter.get(task.taskId) ?? 0) <= now,
        )
        .sort(
          (left, right) =>
            right.priority - left.priority ||
            left.createdAt.localeCompare(right.createdAt) ||
            left.taskId.localeCompare(right.taskId),
        );
      for (const task of candidates) {
        if (this.disposed || active >= maxConcurrent) break;
        if (this.workers.has(task.taskId)) continue;
        await this.startTask(runtime, task);
        if (this.workers.has(task.taskId)) active += 1;
      }
    }
  }

  private async startTask(runtime: ProjectTaskRuntime, original: TaskRecord): Promise<void> {
    if (this.disposed) return;
    this.retryAfter.delete(original.taskId);
    const handler = this.options.handlers.get(original.kind);
    if (!handler) {
      const error: TaskError = {
        message: `Unknown task kind: ${original.kind}`,
        code: String(RpcErrorCode.UnknownTaskKind),
        retryable: false,
      };
      runtime.graph.transition(original.taskId, 'blocked', 'unknown_task_kind', 'service', {
        error,
        finishedAt: this.now().toISOString(),
      });
      runtime.graph.appendEvent(original.taskId, TaskEventKind.Failed, { error }, 'service');
      return;
    }

    let task = runtime.graph.get(original.taskId);
    let worktree: TaskWorktree | undefined;
    if (task.isolation === 'worktree') {
      if (task.integration?.worktreePath && task.integration.branch) {
        worktree = {
          path: task.integration.worktreePath,
          branch: task.integration.branch,
          baseCommit: task.integration.baseCommit,
        };
      } else {
        try {
          if (!this.options.worktrees) throw new Error('Worktree manager is unavailable');
          worktree = await this.options.worktrees.create(runtime.projectId, task.taskId);
          if (this.disposed) {
            await this.options.worktrees.remove(runtime.projectId, worktree.path, worktree.branch);
            return;
          }
          const integration = {
            schemaVersion: 1 as const,
            integrationId: uuidv7(),
            projectId: runtime.projectId,
            taskId: task.taskId,
            worktreePath: worktree.path,
            branch: worktree.branch,
            baseCommit: worktree.baseCommit,
            status: 'pending' as const,
            changedFiles: [],
            conflicts: [],
            validation: [],
            mergeCommit: null,
            reconcileTaskId: null,
            updatedAt: this.now().toISOString(),
          };
          task = runtime.graph.update(task.taskId, { integration });
        } catch (error) {
          if (this.disposed) return;
          const taskError: TaskError = {
            message: error instanceof Error ? error.message : String(error),
            code: String(RpcErrorCode.WorktreeUnavailable),
            retryable: false,
          };
          runtime.graph.transition(task.taskId, 'blocked', 'worktree_unavailable', 'service', {
            error: taskError,
            finishedAt: this.now().toISOString(),
          });
          runtime.graph.appendEvent(
            task.taskId,
            TaskEventKind.Failed,
            { error: taskError },
            'service',
          );
          return;
        }
      }
    }

    const workerId = uuidv7();
    const lease = {
      workerId,
      expiresAt: new Date(this.now().getTime() + this.leaseTtlMs).toISOString(),
    };
    if (task.state === 'ready') {
      task = runtime.graph.transition(task.taskId, 'claimed', 'worker_claimed', 'scheduler', {
        lease,
      });
      runtime.graph.appendEvent(
        task.taskId,
        TaskEventKind.Claimed,
        { workerId, attempt: task.attempt },
        'scheduler',
      );
    } else if (task.state === 'running') {
      task = runtime.graph.update(task.taskId, {
        lease,
        startedAt: task.startedAt ?? this.now().toISOString(),
      });
    } else {
      return;
    }

    let child: ChildProcess;
    try {
      child = fork(this.workerMainPath, [], {
        env: process.env,
        stdio: ['ignore', 'ignore', 'ignore', 'ipc'],
      });
    } catch (error) {
      if (task.state === 'claimed') {
        runtime.graph.transition(task.taskId, 'ready', 'worker_start_failed', 'scheduler', {
          lease: null,
        });
        runtime.graph.appendEvent(
          task.taskId,
          TaskEventKind.Retry,
          { attempt: task.attempt, reason: error instanceof Error ? error.message : String(error) },
          'scheduler',
        );
      } else {
        runtime.graph.fail(task.taskId, {
          message: error instanceof Error ? error.message : String(error),
          retryable: true,
        });
      }
      return;
    }

    let resolveExit: () => void = () => undefined;
    const exitPromise = new Promise<void>((resolve) => {
      resolveExit = resolve;
    });
    const worker: RunningWorker = {
      projectId: runtime.projectId,
      taskId: task.taskId,
      workerId,
      ...(worktree ? { worktreePath: worktree.path } : {}),
      child,
      exitPromise,
      resolveExit,
      stopRequested: false,
      finalMessage: false,
      answerAcks: new Map(),
      toolCalls: new Map(),
    };
    this.workers.set(task.taskId, worker);
    child.on('message', (message: WorkerMessage) => {
      void this.onWorkerMessage(runtime, worker, message);
    });
    child.once('error', (error) => {
      void this.onWorkerError(runtime, worker, error);
    });
    child.once('exit', (code, signal) => {
      void this.onWorkerExit(runtime, worker, code, signal);
    });

    if (task.state === 'claimed') {
      task = runtime.graph.transition(task.taskId, 'running', 'worker_started', 'scheduler', {
        lease,
        startedAt: task.startedAt ?? this.now().toISOString(),
      });
    }
    if (child.pid !== undefined)
      this.options.onWorkerStarted?.(task.taskId, worker.workerId, child.pid);
    const toolSnapshot =
      task.kind === 'agent.run'
        ? this.options.tools?.inspectTools(runtime.projectId, {
            agentRole: task.role ?? task.assignee?.role,
            accessCeiling: task.assignee?.accessCeiling,
          })
        : undefined;
    if (toolSnapshot) {
      runtime.graph.appendEvent(
        task.taskId,
        TaskEventKind.Progress,
        {
          message: 'Agent tool availability recorded.',
          diagnostic: 'agent-tool-availability',
          workerId: worker.workerId,
          attempt: task.attempt,
          role: task.role ?? task.assignee?.role ?? null,
          accessCeiling: task.assignee?.accessCeiling ?? null,
          offeredToolIds: toolSnapshot.tools.map((tool) => tool.toolId),
          excludedTools: toolSnapshot.excluded,
        },
        'scheduler',
      );
    }
    const command: WorkerCommand = {
      type: 'run',
      task,
      handler,
      input: task.input,
      checkpoint: task.checkpoint,
      tools: toolSnapshot?.tools ?? [],
    };
    this.send(child, command);
  }

  private async onWorkerMessage(
    runtime: ProjectTaskRuntime,
    worker: RunningWorker,
    message: WorkerMessage,
  ): Promise<void> {
    const isCurrentWorker = this.workers.get(worker.taskId) === worker;
    if (message.type === 'result' || message.type === 'failed' || message.type === 'stopped') {
      if (message.type !== 'stopped')
        this.options.onWorkerFinalMessage?.(worker.taskId, worker.workerId, message.type);
      if (isCurrentWorker && !worker.stopRequested && !this.disposed) {
        const task = runtime.store.get(worker.taskId);
        if (task?.state === 'running') {
          worker.finalMessage = true;
          if (message.type === 'result') {
            try {
              const validation = await this.options.validateResult?.(task, message.result);
              if (validation?.integration)
                runtime.graph.update(worker.taskId, { integration: validation.integration });
              runtime.graph.complete(worker.taskId, validation?.result ?? message.result);
            } catch (error) {
              const taskError: TaskError = {
                message: error instanceof Error ? error.message : String(error),
                code:
                  error instanceof RpcError
                    ? String(error.code)
                    : String(RpcErrorCode.CompletionContractUnmet),
                retryable: true,
              };
              runtime.graph.fail(worker.taskId, taskError);
            }
          } else if (message.type === 'failed') runtime.graph.fail(worker.taskId, message.error);
        }
      }
      this.send(worker.child, { type: 'result-ack' });
      return;
    }
    if (!isCurrentWorker) return;
    if (message.type === 'heartbeat') {
      if (worker.stopRequested) return;
      const task = runtime.store.get(worker.taskId);
      if (!task || (task.state !== 'claimed' && task.state !== 'running')) return;
      runtime.store.update(worker.taskId, {
        lease: {
          workerId: worker.workerId,
          expiresAt: new Date(this.now().getTime() + this.leaseTtlMs).toISOString(),
        },
      });
      this.options.onLeaseRenewed?.(runtime.projectId, worker.taskId, worker.workerId);
      return;
    }

    if (message.type === 'checkpoint') {
      const task = runtime.store.get(worker.taskId);
      if (task && (task.state === 'running' || task.state === 'waiting_input')) {
        runtime.graph.update(worker.taskId, { checkpoint: message.checkpoint });
        runtime.graph.appendEvent(
          worker.taskId,
          TaskEventKind.Checkpoint,
          { checkpoint: message.checkpoint },
          'worker',
        );
      }
      this.send(worker.child, { type: 'checkpoint-ack', requestId: message.requestId });
      return;
    }

    if (message.type === 'answer-received') {
      worker.answerAcks.get(message.questionId)?.(true);
      worker.answerAcks.delete(message.questionId);
      return;
    }

    if (worker.stopRequested || this.disposed) return;

    if (message.type === 'tool-call') {
      const task = runtime.store.get(worker.taskId);
      if (!task || task.state !== 'running') return;
      const controller = new AbortController();
      worker.toolCalls.set(message.requestId, controller);
      void this.runWorkerToolCall(runtime, worker, task, message, controller);
      return;
    }

    if (message.type === 'progress') {
      const task = runtime.store.get(worker.taskId);
      if (!task || task.state !== 'running') return;
      if (message.usage) {
        runtime.graph.update(worker.taskId, {
          spent: {
            costUsd: task.spent.costUsd + (message.usage.costUsd ?? 0),
            tokens: task.spent.tokens + (message.usage.tokens ?? 0),
          },
        });
      }
      runtime.graph.appendEvent(
        worker.taskId,
        TaskEventKind.Progress,
        {
          message: message.message,
          ...(message.percent === undefined ? {} : { percent: message.percent }),
          ...(message.usage ? { usage: message.usage } : {}),
        },
        'worker',
      );
      return;
    }

    if (message.type === 'question') {
      const task = runtime.store.get(worker.taskId);
      if (!task || task.state !== 'running') return;
      runtime.graph.addQuestion(worker.taskId, message.prompt, message.options);
      return;
    }
  }

  private async runWorkerToolCall(
    runtime: ProjectTaskRuntime,
    worker: RunningWorker,
    task: TaskRecord,
    message: Extract<WorkerMessage, { type: 'tool-call' }>,
    controller: AbortController,
  ): Promise<void> {
    try {
      if (!this.options.tools) throw new Error('Tool broker is unavailable');
      const call = await this.options.tools.call(
        {
          projectId: runtime.projectId,
          taskId: task.taskId,
          agentId: task.assignee?.agentId,
          toolId: message.toolId,
          input: message.input,
          accessCeiling: message.accessCeiling,
        },
        {
          accessCeiling: task.assignee?.accessCeiling,
          ...(message.toolId.startsWith('fs/') && worker.worktreePath
            ? { projectPathOverride: worker.worktreePath }
            : {}),
          signal: controller.signal,
        },
      );
      if (call.status !== 'completed') {
        const error = new Error(
          call.error?.message ?? `Tool call ended with status ${call.status}`,
        );
        if (call.error?.code) Object.assign(error, { code: call.error.code });
        throw error;
      }
      this.send(worker.child, {
        type: 'tool-result',
        requestId: message.requestId,
        output: call.output,
      });
    } catch (error) {
      this.send(worker.child, {
        type: 'tool-result',
        requestId: message.requestId,
        error: {
          message: error instanceof Error ? error.message : String(error),
          ...(error instanceof Error &&
          'code' in error &&
          (typeof error.code === 'string' || typeof error.code === 'number')
            ? { code: String(error.code) }
            : {}),
          retryable: false,
        },
      });
    } finally {
      worker.toolCalls.delete(message.requestId);
    }
  }

  private async onWorkerError(
    runtime: ProjectTaskRuntime,
    worker: RunningWorker,
    error: Error,
  ): Promise<void> {
    if (this.workers.get(worker.taskId) !== worker || worker.stopRequested || worker.finalMessage)
      return;
    worker.finalMessage = true;
    this.handleUnexpectedExit(runtime, worker, error.message);
  }

  private async onWorkerExit(
    runtime: ProjectTaskRuntime,
    worker: RunningWorker,
    code: number | null,
    signal: NodeJS.Signals | null,
  ): Promise<void> {
    if (worker.cancelTimer) clearTimeout(worker.cancelTimer);
    const isCurrentWorker = this.workers.get(worker.taskId) === worker;
    if (isCurrentWorker) {
      this.workers.delete(worker.taskId);
      this.options.onWorkerExited?.(worker.taskId, worker.workerId);
    }
    for (const controller of worker.toolCalls.values()) controller.abort('worker_exit');
    worker.toolCalls.clear();
    for (const resolveAcknowledgement of worker.answerAcks.values()) {
      resolveAcknowledgement(false);
    }
    worker.answerAcks.clear();
    worker.resolveExit();
    if (isCurrentWorker && !worker.stopRequested && !worker.finalMessage) {
      this.handleUnexpectedExit(
        runtime,
        worker,
        `Worker exited without a result (code=${String(code)}, signal=${String(signal)})`,
      );
    }
    if (!this.disposed) await this.schedule();
  }

  private handleUnexpectedExit(
    runtime: ProjectTaskRuntime,
    worker: RunningWorker,
    message: string,
  ): void {
    const task = runtime.store.get(worker.taskId);
    if (!task || (task.state !== 'running' && task.state !== 'claimed')) return;
    if (task.state === 'claimed') {
      runtime.graph.transition(task.taskId, 'ready', 'worker_exit', 'scheduler', { lease: null });
      runtime.graph.appendEvent(
        task.taskId,
        TaskEventKind.Retry,
        { attempt: task.attempt, reason: message },
        'scheduler',
      );
      return;
    }
    runtime.graph.fail(task.taskId, {
      message,
      code: 'worker_exit',
      retryable: true,
    });
  }

  private async expireLeases(): Promise<Set<string>> {
    const now = this.now().getTime();
    const expired = new Set<string>();
    for (const projectId of this.options.tasks.projectIds()) {
      const runtime = this.options.tasks.runtime(projectId);
      const tasks = runtime.store.list({ states: ['claimed', 'running'], limit: 1_000 });
      for (const task of tasks) {
        if (!task.lease || Date.parse(task.lease.expiresAt) > now) continue;
        expired.add(task.taskId);
        this.retryAfter.set(task.taskId, now + this.tickIntervalMs);
        const worker = this.workers.get(task.taskId);
        if (worker) {
          worker.stopRequested = true;
          for (const controller of worker.toolCalls.values()) controller.abort('lease_expired');
          this.send(worker.child, { type: 'cancel' });
          worker.cancelTimer = setTimeout(() => worker.child.kill('SIGKILL'), 2_000);
          worker.cancelTimer.unref();
        }
        runtime.graph.transition(task.taskId, 'ready', 'lease_expired', 'scheduler', {
          lease: null,
        });
        this.options.onTaskLeaseExpired?.(projectId, task.taskId);
        runtime.graph.appendEvent(
          task.taskId,
          TaskEventKind.Retry,
          { attempt: task.attempt, reason: 'lease_expired' },
          'scheduler',
        );
      }
    }
    return expired;
  }

  private async enforceDurationBudgets(): Promise<void> {
    const now = this.now().getTime();
    for (const projectId of this.options.tasks.projectIds()) {
      const runtime = this.options.tasks.runtime(projectId);
      const tasks = runtime.store.list({
        states: ['claimed', 'running', 'waiting_input'],
        limit: 1_000,
      });
      for (const task of tasks) {
        const maxDuration = task.budget.maxDurationMs;
        if (maxDuration === undefined || !task.startedAt) continue;
        if (now - Date.parse(task.startedAt) >= maxDuration) {
          await runtime.graph.cancel(task.taskId, 'budget_exceeded');
        }
      }
    }
  }

  private async shutdown(checkpoint: boolean): Promise<void> {
    for (const worker of this.workers.values()) {
      worker.stopRequested = true;
      for (const controller of worker.toolCalls.values()) controller.abort('service_stop');
      this.send(worker.child, { type: checkpoint ? 'checkpoint-and-stop' : 'cancel' });
    }
    const workers = [...this.workers.values()];
    await Promise.race([Promise.all(workers.map((worker) => worker.exitPromise)), delay(10_000)]);
    for (const worker of this.workers.values()) {
      if (worker.child.exitCode === null && worker.child.signalCode === null) {
        worker.child.kill('SIGKILL');
      }
    }
    await Promise.all(workers.map((worker) => worker.exitPromise));
    await this.scheduling?.catch(() => undefined);

    for (const projectId of this.options.tasks.projectIds()) {
      const runtime = this.options.tasks.runtime(projectId);
      for (const task of runtime.store.list({ states: ['claimed', 'running'], limit: 1_000 })) {
        runtime.graph.transition(task.taskId, 'ready', 'service_stop', 'service', { lease: null });
        runtime.graph.appendEvent(
          task.taskId,
          TaskEventKind.Retry,
          { attempt: task.attempt, reason: 'service_stop' },
          'service',
        );
      }
    }
  }

  private send(child: ChildProcess, message: WorkerCommand): void {
    if (!child.connected) return;
    child.send(message, () => undefined);
  }
}

function resolveWorkerMain(): string {
  const local = path.join(__dirname, 'worker-main.js');
  return existsSync(local)
    ? local
    : path.resolve(__dirname, '..', '..', 'lib', 'workers', 'worker-main.js');
}

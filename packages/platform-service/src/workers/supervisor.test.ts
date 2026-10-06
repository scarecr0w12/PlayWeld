import { fork } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { projectManifest, uuidv7, type TaskRecord } from '@gamecrafter/contracts';
import { Database } from '../db/database';
import { migrate } from '../db/migrator';
import { profileMigrations } from '../profile/migrations';
import { ProfileStore } from '../profile/profile-store';
import { ProjectDatabases } from '../projects/project-databases';
import { projectMigrations } from '../projects/migrations';
import { summaryFromManifest } from '../projects/workspace';
import { isProcessAlive } from '../lock';
import { createBuiltinSettings } from '../settings/definitions';
import { SettingsRegistry } from '../settings/registry';
import { SettingsService } from '../settings/settings-service';
import { TaskService } from '../tasks/task-service';
import { HandlerRegistry, registerBuiltinHandlers } from './handler-registry';
import { WorkerSupervisor } from './supervisor';
import type { WorkerCommand, WorkerMessage } from './types';

describe('WorkerSupervisor', () => {
  it('resumes a compacted agent checkpoint without reusing its earlier question answer', async () => {
    const worker = await runWorkerWithoutFinalAck(true, {
      handler: {
        module: path.join(__dirname, '..', '..', 'lib', 'workers', 'builtin-handlers.js'),
        export: 'noopAsk',
      },
      input: {
        prompt: 'Second question',
        __answers: { first: 'Old answer', second: 'Fresh answer' },
      },
      checkpoint: { transcript: [], evidence: [{ kind: 'user-answer', ref: 'first' }] },
    });
    expect(worker.summary).toBe('Fresh answer');
    expect(worker.exitCode).toBe(0);
  });
  it('delivers a persisted question answer to the original waiting worker', async () => {
    const root = mkdtempSync(path.join(tmpdir(), 'gc-question-worker-test-'));
    const projectId = uuidv7();
    const projectPath = path.join(root, 'project');
    const statePath = path.join(projectPath, '.gamecrafter');
    mkdirSync(statePath, { recursive: true });
    const manifest = projectManifest.assert({
      schemaVersion: 1,
      projectId,
      name: 'Question Worker Test',
      description: '',
      engine: { family: 'godot' },
      genres: [],
      modules: [],
      createdAt: new Date().toISOString(),
      createdByPlatformVersion: '0.1.0',
    });
    writeFileSync(path.join(projectPath, 'gamecrafter.project.json'), JSON.stringify(manifest));
    const profileDatabase = Database.open(':memory:');
    let projectDatabases: ProjectDatabases | undefined;
    let supervisor: WorkerSupervisor | undefined;
    try {
      migrate(profileDatabase, profileMigrations);
      const profile = new ProfileStore(profileDatabase);
      profile.register(summaryFromManifest(manifest, projectPath, null));
      const local = Database.open(path.join(statePath, 'project.sqlite'));
      migrate(local, projectMigrations);
      local.close();
      projectDatabases = new ProjectDatabases(profile);
      const registry = new SettingsRegistry();
      const builtins = createBuiltinSettings();
      registry.register('builtin', builtins.groups, builtins.definitions);
      const settings = new SettingsService(registry, profileDatabase, projectDatabases);
      const handlers = new HandlerRegistry();
      registerBuiltinHandlers(
        handlers,
        path.join(__dirname, '..', '..', 'lib', 'workers', 'builtin-handlers.js'),
      );
      const tasks = new TaskService(profile, projectDatabases, settings, handlers, {
        taskChanged: () => undefined,
        taskEvent: () => undefined,
        taskQuestion: () => undefined,
      });
      const task = tasks.create({
        projectId,
        kind: 'noop.ask',
        title: 'Answer without replaying the handler',
        goal: 'Keep the original worker and pending question promise',
        input: { prompt: 'Which route?', options: ['Keep source', 'Replace source'] },
      }).task;
      let starts = 0;
      supervisor = new WorkerSupervisor({
        tasks,
        settings,
        handlers,
        onWorkerStarted: () => {
          starts += 1;
        },
        tickIntervalMs: 60_000,
      });
      tasks.setSupervisor(supervisor);
      await supervisor.schedule();
      await waitForTaskState(
        tasks,
        projectId,
        task.taskId,
        (value) => value.state === 'waiting_input',
      );
      const question = tasks.pendingQuestionForTask(projectId, task.taskId);
      expect(question).toBeDefined();
      await tasks.answer(projectId, task.taskId, question!.questionId, 'Keep source');
      const completed = await waitForTaskState(
        tasks,
        projectId,
        task.taskId,
        (value) => value.state === 'succeeded',
      );
      expect(completed.result?.summary).toBe('Keep source');
      expect(starts).toBe(1);
    } finally {
      await supervisor?.stopAll({ checkpoint: false });
      projectDatabases?.close();
      profileDatabase.close();
      rmSync(root, { recursive: true, force: true });
    }
  }, 30_000);
  it('expires a worker lease using the injected clock', async () => {
    const root = mkdtempSync(path.join(tmpdir(), 'gc-lease-test-'));
    const projectId = uuidv7();
    const projectPath = path.join(root, 'project');
    const statePath = path.join(projectPath, '.gamecrafter');
    mkdirSync(statePath, { recursive: true });
    const createdAt = new Date().toISOString();
    const manifest = projectManifest.assert({
      schemaVersion: 1,
      projectId,
      name: 'Lease Test',
      description: '',
      engine: { family: 'godot' },
      genres: [],
      modules: [],
      createdAt,
      createdByPlatformVersion: '0.1.0',
    });
    writeFileSync(path.join(projectPath, 'gamecrafter.project.json'), JSON.stringify(manifest));

    const profileDatabase = Database.open(':memory:');
    let projectDatabases: ProjectDatabases | undefined;
    let supervisor: WorkerSupervisor | undefined;
    try {
      migrate(profileDatabase, profileMigrations);
      const profile = new ProfileStore(profileDatabase);
      profile.register(summaryFromManifest(manifest, projectPath, null));
      const localProjectDatabase = Database.open(path.join(statePath, 'project.sqlite'));
      migrate(localProjectDatabase, projectMigrations);
      localProjectDatabase.close();
      projectDatabases = new ProjectDatabases(profile);

      const registry = new SettingsRegistry();
      const builtins = createBuiltinSettings();
      registry.register('builtin', builtins.groups, builtins.definitions);
      const settings = new SettingsService(registry, profileDatabase, projectDatabases);
      const handlers = new HandlerRegistry();
      registerBuiltinHandlers(
        handlers,
        path.join(__dirname, '..', '..', 'lib', 'workers', 'builtin-handlers.js'),
      );
      const taskService = new TaskService(profile, projectDatabases, settings, handlers, {
        taskChanged: () => undefined,
        taskEvent: () => undefined,
        taskQuestion: () => undefined,
      });
      const task = taskService.create({
        projectId,
        kind: 'noop.sleep',
        title: 'Lease expiry',
        goal: 'Exercise lease recovery',
        input: { ms: 10_000 },
      }).task;
      let time = Date.now();
      supervisor = new WorkerSupervisor({
        tasks: taskService,
        settings,
        handlers,
        now: () => new Date(time),
        leaseTtlMs: 100,
        tickIntervalMs: 60_000,
      });
      taskService.setSupervisor(supervisor);

      await supervisor.schedule();
      await waitForRunning(taskService, projectId, task.taskId);
      time += 200;
      await supervisor.schedule();

      const expired = taskService.get(projectId, task.taskId);
      expect(expired.state).toBe('ready');
      expect(expired.attempt).toBe(1);
      expect(
        taskService
          .eventsForProject(projectId, { taskId: task.taskId })
          .some(
            (event) =>
              event.kind === 'task.retry' &&
              (event.payload as { reason?: string }).reason === 'lease_expired',
          ),
      ).toBe(true);
    } finally {
      await supervisor?.stopAll({ checkpoint: false });
      projectDatabases?.close();
      profileDatabase.close();
      rmSync(root, { recursive: true, force: true });
    }
  }, 30_000);

  it('frees the Project concurrency slot after a worker returns a result', async () => {
    const root = mkdtempSync(path.join(tmpdir(), 'gc-completed-worker-test-'));
    const projectId = uuidv7();
    const projectPath = path.join(root, 'project');
    const statePath = path.join(projectPath, '.gamecrafter');
    mkdirSync(statePath, { recursive: true });
    const manifest = projectManifest.assert({
      schemaVersion: 1,
      projectId,
      name: 'Completed Worker Test',
      description: '',
      engine: { family: 'godot' },
      genres: [],
      modules: [],
      createdAt: new Date().toISOString(),
      createdByPlatformVersion: '0.1.0',
    });
    writeFileSync(path.join(projectPath, 'gamecrafter.project.json'), JSON.stringify(manifest));

    const profileDatabase = Database.open(':memory:');
    let projectDatabases: ProjectDatabases | undefined;
    let supervisor: WorkerSupervisor | undefined;
    let lingeringPid: number | undefined;
    let lingeringWorkerId: string | undefined;
    try {
      migrate(profileDatabase, profileMigrations);
      const profile = new ProfileStore(profileDatabase);
      profile.register(summaryFromManifest(manifest, projectPath, null));
      const localProjectDatabase = Database.open(path.join(statePath, 'project.sqlite'));
      migrate(localProjectDatabase, projectMigrations);
      localProjectDatabase.close();
      projectDatabases = new ProjectDatabases(profile);

      const settingsRegistry = new SettingsRegistry();
      const builtins = createBuiltinSettings();
      settingsRegistry.register('builtin', builtins.groups, builtins.definitions);
      const settings = new SettingsService(settingsRegistry, profileDatabase, projectDatabases);
      settings.set('agents.maxConcurrentPerProject', 'project', 1, { projectId });
      const handlers = new HandlerRegistry();
      registerBuiltinHandlers(
        handlers,
        path.join(__dirname, '..', '..', 'lib', 'workers', 'builtin-handlers.js'),
      );
      handlers.register('test.linger', {
        module: path.join(__dirname, 'supervisor-linger-fixture.cjs'),
        export: 'linger',
      });
      const taskService = new TaskService(profile, projectDatabases, settings, handlers, {
        taskChanged: () => undefined,
        taskEvent: () => undefined,
        taskQuestion: () => undefined,
      });
      const first = taskService.create({
        projectId,
        kind: 'test.linger',
        title: 'Complete but keep process alive',
        goal: 'Verify completed workers do not hold a task slot',
        input: {},
      }).task;
      const firstTaskId = first.taskId;
      supervisor = new WorkerSupervisor({
        tasks: taskService,
        settings,
        handlers,
        onWorkerStarted: (taskId, workerId, pid) => {
          if (taskId === firstTaskId) {
            lingeringWorkerId = workerId;
            lingeringPid = pid;
          }
        },
        tickIntervalMs: 60_000,
      });
      taskService.setSupervisor(supervisor);

      await supervisor.schedule();
      await waitForTaskState(
        taskService,
        projectId,
        first.taskId,
        (task) => task.state === 'succeeded',
      );
      expect(lingeringWorkerId).toBeDefined();
      expect(lingeringPid).toBeDefined();
      expect(isProcessAlive(lingeringPid!)).toBe(true);

      const next = taskService.create({
        projectId,
        kind: 'noop.echo',
        title: 'Use the released slot',
        goal: 'Start after the previous handler completed',
        input: { message: 'next task' },
      }).task;
      await supervisor.schedule();
      const completed = await waitForTaskState(
        taskService,
        projectId,
        next.taskId,
        (task) => task.state === 'succeeded',
        2_000,
      );
      expect(completed.state).toBe('succeeded');
      expect(isProcessAlive(lingeringPid!)).toBe(true);
    } finally {
      if (lingeringPid && isProcessAlive(lingeringPid)) process.kill(lingeringPid, 'SIGTERM');
      await supervisor?.stopAll({ checkpoint: false });
      projectDatabases?.close();
      profileDatabase.close();
      rmSync(root, { recursive: true, force: true });
    }
  }, 15_000);

  it('exits when the supervisor disconnects before acknowledging a worker result', async () => {
    const worker = await runWorkerWithoutFinalAck(true);
    expect(worker.resultReceived).toBe(true);
    expect(worker.exitCode).toBe(0);
    expect(worker.elapsedMs).toBeLessThan(6_000);
  }, 8_000);

  it('exits when the supervisor never acknowledges a worker result', async () => {
    const worker = await runWorkerWithoutFinalAck(false);
    expect(worker.resultReceived).toBe(true);
    expect(worker.exitCode).toBe(0);
    expect(worker.elapsedMs).toBeLessThan(6_000);
  }, 8_000);
});

async function runWorkerWithoutFinalAck(
  disconnectAfterResult: boolean,
  overrides: Partial<Extract<WorkerCommand, { type: 'run' }>> = {},
): Promise<{
  resultReceived: boolean;
  exitCode: number | null;
  elapsedMs: number;
  summary?: string;
}> {
  const child = fork(path.join(__dirname, '..', '..', 'lib', 'workers', 'worker-main.js'), [], {
    env: process.env,
    stdio: ['ignore', 'ignore', 'ignore', 'ipc'],
  });
  let resultReceived = false;
  let summary: string | undefined;
  let disconnectedAt: number | undefined;
  let resultTimeout: NodeJS.Timeout | undefined;
  let exitTimeout: NodeJS.Timeout | undefined;
  const exited = new Promise<{ code: number | null }>((resolve) => {
    child.once('exit', (code) => resolve({ code }));
  });
  const result = new Promise<void>((resolve, reject) => {
    resultTimeout = setTimeout(() => reject(new Error('Worker did not return a result')), 2_000);
    child.on('message', (message: WorkerMessage) => {
      if (message.type === 'result') {
        summary = message.result.summary;
        resultReceived = true;
        if (disconnectAfterResult && child.connected) {
          disconnectedAt = Date.now();
          child.disconnect();
        }
        resolve();
      } else if (message.type === 'failed') {
        reject(new Error(`Worker failed: ${message.error.message}`));
      }
    });
  });

  const command: WorkerCommand = {
    type: 'run',
    task: { taskId: uuidv7() } as TaskRecord,
    handler: { module: path.join(__dirname, 'supervisor-linger-fixture.cjs'), export: 'linger' },
    input: {},
    checkpoint: null,
    ...overrides,
  };

  try {
    child.send(command);
    await result;
    const startedAt = disconnectedAt ?? Date.now();
    const timeout = new Promise<never>((_resolve, reject) => {
      exitTimeout = setTimeout(
        () => reject(new Error('Worker did not exit after final IPC')),
        6_000,
      );
      exitTimeout.unref();
    });
    const exit = await Promise.race([exited, timeout]);
    return { resultReceived, exitCode: exit.code, elapsedMs: Date.now() - startedAt, summary };
  } finally {
    if (resultTimeout) clearTimeout(resultTimeout);
    if (exitTimeout) clearTimeout(exitTimeout);
    if (child.exitCode === null && child.signalCode === null && child.pid !== undefined) {
      if (child.connected) child.disconnect();
      if (isProcessAlive(child.pid)) process.kill(child.pid, 'SIGTERM');
    }
  }
}

async function waitForTaskState(
  service: TaskService,
  projectId: string,
  taskId: string,
  predicate: (task: TaskRecord) => boolean,
  timeoutMs = 5_000,
): Promise<TaskRecord> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const task = service.get(projectId, taskId);
    if (predicate(task)) return task;
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
  throw new Error(
    `Task did not reach the expected state: ${JSON.stringify(service.get(projectId, taskId))}`,
  );
}

async function waitForRunning(
  service: TaskService,
  projectId: string,
  taskId: string,
): Promise<void> {
  const deadline = Date.now() + 5000;
  while (Date.now() < deadline) {
    if (service.get(projectId, taskId).state === 'running') return;
    await new Promise((resolve) => setTimeout(resolve, 20));
  }
  throw new Error(`Task did not start: ${taskId}`);
}

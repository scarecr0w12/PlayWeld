import { mkdirSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { uuidv7, type TaskRecord } from '@gamecrafter/contracts';
import { connect, type ServiceClient } from '@gamecrafter/service-client';
import { isProcessAlive } from '../lock';
import { resolvePaths, type ServicePaths } from '../paths';
import type { WorkerScheduleSnapshot } from '../workers/supervisor';
import { PlatformService } from '../service';
import type { TaskService } from './task-service';

const temporaryDirectories: string[] = [];
let service: PlatformService | undefined;
let client: ServiceClient | undefined;
let projectId: string;
let projectsDirectory: string;
let workerPids: Map<string, number>;
let workerStarts: Array<{ taskId: string; workerId: string; pid: number }>;
let workerFinalMessages: Array<{
  taskId: string;
  workerId: string;
  messageType: 'result' | 'failed';
}>;
let workerScheduleSnapshots: WorkerScheduleSnapshot[];
let workerLifecycleEvents: Array<{
  type: 'started' | 'final-message' | 'exited';
  taskId: string;
  workerId: string;
  at: number;
  pid?: number;
  messageType?: 'result' | 'failed';
}>;
let stopRequested: Promise<void>;
let resolveStopRequested: () => void = () => undefined;
let pathsForLastProfile: ServicePaths;

beforeEach(async () => {
  const root = mkdtempSync(path.join(tmpdir(), 'gc-task-integration-'));
  temporaryDirectories.push(root);
  const profileDir = path.join(root, 'profile');
  projectsDirectory = path.join(root, 'projects');
  mkdirSync(projectsDirectory, { recursive: true });
  workerPids = new Map();
  workerStarts = [];
  workerFinalMessages = [];
  workerScheduleSnapshots = [];
  workerLifecycleEvents = [];
  stopRequested = new Promise<void>((resolve) => {
    resolveStopRequested = resolve;
  });
  pathsForLastProfile = resolvePaths({ GAMECRAFTER_PROFILE_DIR: profileDir });
  service = await startService(pathsForLastProfile);
  client = await connectToService(service.socketPath, pathsForLastProfile);
  const project = await client.call('project/create', {
    name: 'Task Integration Project',
    engine: { family: 'godot' },
    parentDirectory: projectsDirectory,
    folderName: 'task-project',
  });
  projectId = project.projectId;
  const knowledgeTasks = (await client.call('task/list', { projectId, limit: 500 })).tasks.filter(
    (task) => task.kind === 'knowledge.reindex' || task.kind === 'knowledge.reconcile',
  );
  await Promise.all(
    knowledgeTasks.map((task) =>
      waitForTask(task.taskId, (current) => current.state === 'succeeded'),
    ),
  );
});

afterEach(async () => {
  client?.close();
  await service?.stop();
  service = undefined;
  client = undefined;
  for (const directory of temporaryDirectories.splice(0)) {
    rmSync(directory, { recursive: true, force: true });
  }
});

describe('Task service integration', () => {
  it('creates ready tasks, records events, and lists a root with its descendants', async () => {
    await setProjectSetting('agents.maxConcurrentPerProject', 1);
    const root = await createTask('noop.sleep', 'Root task', 'Keep the sole worker busy', {
      ms: 2000,
    });
    await waitForTask(root.task.taskId, (task) => task.state === 'running');
    const child = await createTask(
      'noop.echo',
      'Child task',
      'Echo child input',
      { message: 'child' },
      {
        parentTaskId: root.task.taskId,
      },
    );

    expect(child.task.state).toBe('ready');
    const ready = await client!.call('task/list', {
      projectId,
      states: ['ready'],
      parentTaskId: root.task.taskId,
    });
    expect(ready.tasks.map((task) => task.taskId)).toEqual([child.task.taskId]);
    const tree = await client!.call('task/tree', { projectId, rootTaskId: root.task.taskId });
    expect(tree.tasks.map((task) => task.taskId)).toEqual([root.task.taskId, child.task.taskId]);
    const events = await client!.call('task/events', { projectId, taskId: child.task.taskId });
    expect(events.events.map((event) => event.kind)).toEqual([
      'task.created',
      'task.state_changed',
    ]);
  }, 60_000);

  it('persists optional coordination metadata on created tasks', async () => {
    await setProjectSetting('access.mode', 'full');
    const created = await client!.call('task/create', {
      projectId,
      kind: 'noop.echo',
      title: 'Coordination metadata',
      goal: 'Persist touches and completion policy',
      input: { message: 'metadata' },
      touches: [{ resource: 'file:game/README.md', intent: 'write' }],
      role: 'explorer',
      assignee: { role: 'explorer', accessCeiling: 'full' },
      isolation: 'worktree',
      contract: { required: [], validators: [] },
    });
    const task = await client!.call('task/get', { projectId, taskId: created.task.taskId });

    expect(task).toMatchObject({
      touches: [{ resource: 'file:game/README.md', intent: 'write' }],
      role: 'explorer',
      isolation: 'worktree',
      contract: { required: [], validators: [] },
    });
    expect(task.input).toMatchObject({
      message: 'metadata',
      role: { name: 'explorer', systemPrompt: expect.any(String) },
    });
    expect(task.assignee).toMatchObject({ role: 'explorer', accessCeiling: 'restricted' });
  });

  it('holds dependents pending until success and blocks them after permanent failure', async () => {
    await setProjectSetting('agents.maxConcurrentPerProject', 1);
    const prerequisite = await createTask('noop.sleep', 'Prerequisite', 'Finish before dependent', {
      ms: 250,
    });
    await waitForTask(prerequisite.task.taskId, (task) => task.state === 'running');
    const dependent = await createTask(
      'noop.echo',
      'Dependent',
      'Wait for prerequisite',
      {},
      {
        dependsOn: [prerequisite.task.taskId],
      },
    );
    expect(dependent.task.state).toBe('pending');
    await waitForTask(prerequisite.task.taskId, (task) => task.state === 'succeeded');
    await waitForTask(dependent.task.taskId, (task) => task.state === 'succeeded');
    const dependentEvents = await client!.call('task/events', {
      projectId,
      taskId: dependent.task.taskId,
    });
    expect(
      dependentEvents.events.some(
        (event) =>
          event.kind === 'task.state_changed' && (event.payload as { to?: string }).to === 'ready',
      ),
    ).toBe(true);

    const failed = await createTask('noop.fail', 'Permanent failure', 'Fail without retry', {
      retryable: false,
    });
    await waitForTask(failed.task.taskId, (task) => task.state === 'failed');
    const blocked = await createTask(
      'noop.echo',
      'Blocked dependent',
      'Wait for failure',
      {},
      {
        dependsOn: [failed.task.taskId],
      },
    );
    expect(blocked.task.state).toBe('blocked');
  }, 60_000);

  it('deduplicates active tasks with the same parent and normalized goal', async () => {
    const input = {
      projectId,
      kind: 'noop.sleep',
      title: 'First title',
      goal: '  Build   the   same  thing ',
      input: { ms: 250 },
    };
    const first = await client!.call('task/create', input);
    const duplicate = await client!.call('task/create', { ...input, title: 'Different title' });
    expect(first.deduplicated).toBe(false);
    expect(duplicate.deduplicated).toBe(true);
    expect(duplicate.task.taskId).toBe(first.task.taskId);
    await waitForTask(first.task.taskId, (task) => task.state === 'succeeded');
    const afterCompletion = await client!.call('task/create', input);
    expect(afterCompletion.deduplicated).toBe(false);
    expect(afterCompletion.task.taskId).not.toBe(first.task.taskId);
  }, 60_000);

  it('enforces the Project agent spawn-depth setting', async () => {
    await setProjectSetting('agents.maxSpawnDepth', 1);
    const root = await createTask('noop.echo', 'Root', 'Depth root', {});
    const child = await createTask(
      'noop.echo',
      'Child',
      'Depth child',
      {},
      {
        parentTaskId: root.task.taskId,
      },
    );
    await expect(
      client!.call('task/create', {
        projectId,
        kind: 'noop.echo',
        title: 'Grandchild',
        goal: 'Depth grandchild',
        parentTaskId: child.task.taskId,
      }),
    ).rejects.toMatchObject({ name: 'RpcError', code: -32021 });
  }, 60_000);

  it('reports missing dependency IDs as TaskNotFound', async () => {
    await expect(
      createTask(
        'noop.echo',
        'Missing dependency',
        'Depend on a missing task',
        {},
        {
          dependsOn: [uuidv7()],
        },
      ),
    ).rejects.toMatchObject({ name: 'RpcError', code: -32020 });
  }, 60_000);

  it('runs noop.echo and notifies ready, claimed, running, then succeeded', async () => {
    const states: string[] = [];
    client!.onNotification('task/changed', ({ task }) => {
      if (task.title === 'Echo notifications') states.push(task.state);
    });
    const created = await createTask('noop.echo', 'Echo notifications', 'Echo a known input', {
      value: 42,
    });
    const finished = await waitForTask(created.task.taskId, (task) => task.state === 'succeeded');
    expect(finished.result).toMatchObject({
      summary: 'echo',
      artifacts: [],
      evidence: [{ kind: 'input', ref: '{"value":42}' }],
    });
    expect(states).toEqual(['ready', 'claimed', 'running', 'succeeded']);
  }, 60_000);

  it('retries retryable failures until maxAttempts and records failure and retry events', async () => {
    const created = await createTask(
      'noop.fail',
      'Retry task',
      'Fail twice with a retry',
      { retryable: true, message: 'expected retry' },
      { maxAttempts: 2 },
    );
    const failed = await waitForTask(created.task.taskId, (task) => task.state === 'failed');
    expect(failed.attempt).toBe(2);
    const events = await client!.call('task/events', { projectId, taskId: failed.taskId });
    expect(events.events.filter((event) => event.kind === 'task.failed')).toHaveLength(2);
    expect(events.events.filter((event) => event.kind === 'task.retry')).toHaveLength(1);
  }, 60_000);

  it('waits for and applies task question answers', async () => {
    const created = await createTask('noop.ask', 'Ask task', 'Ask the user', {
      prompt: 'Choose an answer',
      options: ['Yes', 'No'],
    });
    await waitForTask(created.task.taskId, (task) => task.state === 'waiting_input');
    const pending = await client!.call('task/questions', { pendingOnly: true });
    const question = pending.questions.find((item) => item.taskId === created.task.taskId);
    expect(question).toMatchObject({ prompt: 'Choose an answer', options: ['Yes', 'No'] });
    const answered = await client!.call('task/answer', {
      projectId,
      taskId: created.task.taskId,
      questionId: question!.questionId,
      answer: 'Yes',
    });
    expect(answered.state).toBe('running');
    const finished = await waitForTask(created.task.taskId, (task) => task.state === 'succeeded');
    expect(finished.result?.summary).toBe('Yes');
    expect((await client!.call('task/questions', { pendingOnly: true })).questions).toHaveLength(0);
  }, 60_000);

  it('limits A2A continuation to a pending task question and streams scoped task events', async () => {
    const tasks = a2aTaskService();
    const created = await createTask('noop.ask', 'A2A continuation', 'Answer this task question', {
      prompt: 'Choose an answer',
      options: ['Yes', 'No'],
    });
    await waitForTask(created.task.taskId, (task) => task.state === 'waiting_input');
    expect(tasks.pendingQuestionForTask(projectId, created.task.taskId)?.taskId).toBe(
      created.task.taskId,
    );

    const before =
      tasks.eventsForProject(projectId, { taskId: created.task.taskId }).at(-1)?.seq ?? 0;
    const eventStream = tasks.subscribeTaskEvents(projectId, created.task.taskId, {
      afterSeq: before,
    });
    const nextEvent = eventStream.next();
    const answered = await tasks.continueExternalTask(projectId, created.task.taskId, 'Yes');
    expect(answered.taskId).toBe(created.task.taskId);
    const observed = await nextEvent;
    expect(observed.done).toBe(false);
    expect(observed.value?.taskId).toBe(created.task.taskId);
    expect(observed.value?.seq).toBeGreaterThan(before);
    await eventStream.return();
    await waitForTask(created.task.taskId, (task) => task.state === 'succeeded');

    const active = await createTask('noop.sleep', 'A2A active task', 'No pending question', {
      ms: 2_000,
    });
    await waitForTask(active.task.taskId, (task) => task.state === 'running');
    await expect(
      tasks.continueExternalTask(projectId, active.task.taskId, 'Do not become approval'),
    ).rejects.toThrow('cannot be continued without a pending question');
    await client!.call('task/cancel', {
      projectId,
      taskId: active.task.taskId,
      reason: 'test_cleanup',
    });
  }, 60_000);

  it('resumes checkpointed work after a worker process exits', async () => {
    const created = await createTask('noop.checkpointed', 'Checkpoint task', 'Resume work', {
      steps: 5,
      crashAt: 3,
    });
    const finished = await waitForTask(created.task.taskId, (task) => task.state === 'succeeded');
    expect(finished.attempt).toBe(2);
    const events = await client!.call('task/events', { projectId, taskId: created.task.taskId });
    const checkpoints = events.events.filter((event) => event.kind === 'task.checkpoint');
    const retryIndex = events.events.findIndex((event) => event.kind === 'task.retry');
    expect(
      checkpoints.some(
        (event) => (event.payload as { checkpoint?: { step?: number } }).checkpoint?.step === 2,
      ),
    ).toBe(true);
    const retrySeq = events.events[retryIndex]?.seq ?? 0;
    const firstAfterRetry = checkpoints.find((event) => event.seq > retrySeq);
    expect(
      (firstAfterRetry?.payload as { checkpoint?: { step?: number } }).checkpoint?.step,
    ).toBeGreaterThanOrEqual(3);
  }, 60_000);

  it('respects per-Project worker concurrency', async () => {
    await setProjectSetting('agents.maxConcurrentPerProject', 1);
    const first = await createTask('noop.sleep', 'Serial A', 'First serial task', { ms: 350 });
    const second = await createTask('noop.sleep', 'Serial B', 'Second serial task', { ms: 350 });
    const [finishedFirst, finishedSecond] = await Promise.all([
      waitForTask(first.task.taskId, (task) => task.state === 'succeeded'),
      waitForTask(second.task.taskId, (task) => task.state === 'succeeded'),
    ]);
    const firstStarted = Date.parse(finishedFirst.startedAt!);
    const firstFinished = Date.parse(finishedFirst.finishedAt!);
    const secondStarted = Date.parse(finishedSecond.startedAt!);
    const secondFinished = Date.parse(finishedSecond.finishedAt!);
    expect(firstFinished <= secondStarted || secondFinished <= firstStarted).toBe(true);
  }, 60_000);

  it('cancels a task and its running descendants and terminates their workers', async () => {
    await setProjectSetting('agents.maxConcurrentPerProject', 2);
    const parent = await createTask('noop.sleep', 'Cancel parent', 'Long parent', { ms: 5000 });
    await waitForTask(parent.task.taskId, (task) => task.state === 'running');
    const child = await createTask(
      'noop.sleep',
      'Cancel child',
      'Long child',
      { ms: 5000 },
      {
        parentTaskId: parent.task.taskId,
      },
    );
    await waitForTask(child.task.taskId, (task) => task.state === 'running');
    const parentPid = workerPids.get(parent.task.taskId);
    const childPid = workerPids.get(child.task.taskId);
    expect(parentPid).toBeDefined();
    expect(childPid).toBeDefined();

    const cancelled = await client!.call('task/cancel', {
      projectId,
      taskId: parent.task.taskId,
      reason: 'integration_cancel',
    });
    expect(new Set(cancelled.cancelled)).toEqual(new Set([parent.task.taskId, child.task.taskId]));
    expect((await client!.call('task/get', { projectId, taskId: parent.task.taskId })).state).toBe(
      'cancelled',
    );
    expect((await client!.call('task/get', { projectId, taskId: child.task.taskId })).state).toBe(
      'cancelled',
    );
    await waitFor(() => !isProcessAlive(parentPid!) && !isProcessAlive(childPid!));
  }, 60_000);

  it('stops and recovers running tasks with a persisted service-stop retry event', async () => {
    const created = await createTask('noop.sleep', 'Recover task', 'Resume after stop', {
      ms: 5000,
    });
    await waitForTask(created.task.taskId, (task) => task.state === 'running');
    const stopped = await client!.call('service/stop', { checkpoint: true });
    expect(stopped.ok).toBe(true);
    await stopRequested;
    client?.close();
    client = undefined;

    service = await startService(pathsForLastProfile);
    client = await connectToService(service.socketPath, pathsForLastProfile);
    const finished = await waitForTask(created.task.taskId, (task) => task.state === 'succeeded');
    expect(finished.result?.summary).toBe('sleep complete');
    const events = await client.call('task/events', { projectId, taskId: created.task.taskId });
    expect(
      events.events.some(
        (event) =>
          event.kind === 'task.retry' &&
          (event.payload as { reason?: string }).reason === 'service_stop',
      ),
    ).toBe(true);
  }, 60_000);
});

async function startService(paths: ServicePaths): Promise<PlatformService> {
  return PlatformService.start({
    paths,
    platformVersion: '0.1.0',
    onWorkerStarted: (taskId, workerId, pid) => {
      workerPids.set(taskId, pid);
      workerStarts.push({ taskId, workerId, pid });
      workerLifecycleEvents.push({ type: 'started', taskId, workerId, pid, at: Date.now() });
    },
    onWorkerFinalMessage: (taskId, workerId, messageType) => {
      workerFinalMessages.push({ taskId, workerId, messageType });
      workerLifecycleEvents.push({
        type: 'final-message',
        taskId,
        workerId,
        messageType,
        at: Date.now(),
      });
    },
    onWorkerExited: (taskId, workerId) => {
      workerPids.delete(taskId);
      workerLifecycleEvents.push({ type: 'exited', taskId, workerId, at: Date.now() });
    },
    onWorkerScheduleSnapshot: (snapshot) => workerScheduleSnapshots.push(snapshot),
    onStopRequested: async (checkpoint) => {
      await service?.stop(checkpoint);
      resolveStopRequested();
    },
  });
}

function a2aTaskService(): TaskService {
  return (service as unknown as { a2aService: { options: { tasks: TaskService } } }).a2aService
    .options.tasks;
}

async function connectToService(socketPath: string, paths: ServicePaths): Promise<ServiceClient> {
  return connect({
    socketPath,
    token: readFileSync(paths.tokenPath, 'utf8').trim(),
    clientName: 'task-integration-test',
    clientVersion: '0.1.0',
  });
}

async function createTask(
  kind: string,
  title: string,
  goal: string,
  input: unknown,
  extra: { parentTaskId?: string; dependsOn?: string[]; maxAttempts?: number } = {},
) {
  return client!.call('task/create', { projectId, kind, title, goal, input, ...extra });
}

async function setProjectSetting(key: string, value: unknown): Promise<void> {
  await client!.call('settings/set', { key, scope: 'project', value, projectId });
}

async function waitForTask(
  taskId: string,
  predicate: (task: TaskRecord) => boolean,
  timeoutMs = 30_000,
): Promise<TaskRecord> {
  const deadline = Date.now() + timeoutMs;
  let lastTask: TaskRecord | undefined;
  while (Date.now() < deadline) {
    lastTask = await client!.call('task/get', { projectId, taskId });
    if (predicate(lastTask)) return lastTask;
    await new Promise((resolve) => setTimeout(resolve, 25));
  }
  const [events, projectTasks] = await Promise.all([
    client!.call('task/events', { projectId, taskId }),
    client!.call('task/list', { projectId, limit: 500 }),
  ]);
  const workers = [...workerPids].map(([activeTaskId, pid]) => ({
    taskId: activeTaskId,
    pid,
    alive: isProcessAlive(pid),
  }));
  const activeWorkerTaskIds = workers
    .filter((worker) => worker.alive)
    .map((worker) => worker.taskId);
  throw new Error(
    `Task ${taskId} did not reach the expected state. Diagnostics:\n${JSON.stringify(
      {
        lastTask,
        projectTasks: projectTasks.tasks,
        activeWorkerTaskIds,
        trackedWorkers: workers,
        workerStarts: workerStarts.slice(-20),
        finalMessages: workerFinalMessages,
        workerLifecycleEvents: workerLifecycleEvents.slice(-40),
        recentSupervisorSnapshots: workerScheduleSnapshots
          .filter((snapshot) => snapshot.projectId === projectId)
          .slice(-10),
        events: events.events,
      },
      null,
      2,
    )}`,
  );
}

async function waitFor<T>(probe: () => Promise<T | undefined>, timeoutMs = 5_000): Promise<T> {
  const deadline = Date.now() + timeoutMs;
  let value: T | undefined;
  while (Date.now() < deadline) {
    value = await probe();
    if (value !== undefined) return value;
    await new Promise((resolve) => setTimeout(resolve, 25));
  }
  throw new Error(`Condition not met before timeout (last value: ${JSON.stringify(value)})`);
}

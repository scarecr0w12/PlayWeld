import { execFile } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import { promisify } from 'node:util';
import {
  RpcError,
  RpcErrorCode,
  minAccessMode,
  type CompletionClaim,
  type IntegrationConflict,
  type IntegrationRecord,
  type IntegrationValidation,
  type TaskRecord,
  type TaskResult,
  uuidv7,
} from '@gamecrafter/contracts';
import { resolveProjectPath } from '../assets/path-utils';
import type { ProjectDatabases } from '../projects/project-databases';
import type { ProfileStore } from '../profile/profile-store';
import type { SettingsService } from '../settings/settings-service';
import type { TaskService } from '../tasks/task-service';
import type { RoleRegistry } from '../roles/role-registry';
import type { ToolBroker } from '../tools/tool-broker';
import type { LockManager } from './lock-manager';
import { ChangeService } from './change-service';
import type { TaskWorktree, WorktreeManager } from './worktree-manager';

const execFileAsync = promisify(execFile);
const integrationGitIdentity = [
  '-c',
  'user.name=PlayWeld',
  '-c',
  'user.email=gamecrafter@localhost',
];

export interface ValidatedTaskResult {
  result: TaskResult;
  integration: IntegrationRecord;
}

export interface IntegrationServiceOptions {
  projects: ProfileStore;
  projectDatabases: ProjectDatabases;
  tasks: TaskService;
  roles: RoleRegistry;
  changes: ChangeService;
  locks: LockManager;
  worktrees: WorktreeManager;
  tools: ToolBroker;
  settings: SettingsService;
  now?: () => Date;
  onChanged?: (integration: IntegrationRecord) => void;
}

export class IntegrationService {
  private readonly now: () => Date;
  private readonly projectQueues = new Map<string, Promise<void>>();
  private readonly processedTasks = new Set<string>();
  private stopped = false;

  constructor(private readonly options: IntegrationServiceOptions) {
    this.now = options.now ?? (() => new Date());
  }

  async stop(): Promise<void> {
    this.stopped = true;
    await Promise.allSettled([...this.projectQueues.values()]);
  }

  async validateResult(task: TaskRecord, result: TaskResult): Promise<ValidatedTaskResult> {
    const validation: IntegrationValidation[] = [...(task.integration?.validation ?? [])];
    const claims: NonNullable<TaskResult['claims']> = [];
    for (const claim of result.claims ?? []) {
      const ok = this.claimIsBacked(task, claim);
      validation.push({
        kind: claim.kind,
        ref: claim.ref,
        ok,
        detail: ok
          ? 'Claim is backed by a completed Project record.'
          : 'Claim is not backed by a completed Project record.',
      });
      claims.push(ok ? claim : { kind: 'generated', ref: claim.ref });
    }

    for (const validator of task.contract?.validators ?? []) {
      const toolId = validator.toolId ?? validatorToolId(validator.kind, validator.operation);
      if (!toolId) {
        validation.push({
          kind: `validator:${validator.kind}`,
          ref: validator.operation ?? '',
          ok: false,
          detail: 'Validator has no tool operation.',
        });
        continue;
      }
      try {
        const call = await this.options.tools.call(
          {
            projectId: task.projectId,
            taskId: task.taskId,
            agentId: task.assignee?.agentId,
            toolId,
            input: validatorInput(validator.kind, validator.toolId, validator.params),
            accessCeiling: task.assignee?.accessCeiling,
          },
          {
            accessCeiling: task.assignee?.accessCeiling,
            agentRole: task.role ?? task.assignee?.role,
          },
        );
        const operationSucceeded = call.status === 'completed' && operationSucceededIn(call.output);
        validation.push({
          kind: `validator:${validator.kind}`,
          ref: call.callId,
          ok: operationSucceeded,
          detail: operationSucceeded
            ? 'Validator completed successfully.'
            : 'Validator did not report success.',
        });
      } catch (error) {
        validation.push({
          kind: `validator:${validator.kind}`,
          ref: toolId,
          ok: false,
          detail: error instanceof Error ? error.message : String(error),
        });
      }
    }

    const required = task.contract?.required ?? [];
    const claimed = new Set(claims.map((claim) => claim.kind));
    const missing = required.filter((kind) => !claimed.has(kind));
    const failedValidators = validation.filter(
      (entry) => entry.kind.startsWith('validator:') && !entry.ok,
    );
    if (missing.length > 0 || failedValidators.length > 0) {
      throw new RpcError(
        'Task completion contract was not satisfied.',
        RpcErrorCode.CompletionContractUnmet,
        { taskId: task.taskId, missing, validation },
      );
    }

    const integration = task.integration ?? (await this.newIntegration(task));
    const validatedIntegration = this.save({
      ...integration,
      status: 'validating',
      validation,
      updatedAt: this.now().toISOString(),
    });
    return {
      result: { ...result, claims },
      integration: validatedIntegration,
    };
  }

  processTask(task: TaskRecord): Promise<void> {
    if (
      this.stopped ||
      task.state !== 'succeeded' ||
      (task.kind !== 'agent.run' &&
        task.isolation !== 'worktree' &&
        !task.contract &&
        !task.touches?.length) ||
      this.processedTasks.has(task.taskId)
    )
      return Promise.resolve();
    this.processedTasks.add(task.taskId);
    const previous = this.projectQueues.get(task.projectId) ?? Promise.resolve();
    const current = previous.catch(() => undefined).then(() => this.processTaskInternal(task));
    this.projectQueues.set(task.projectId, current);
    const cleanup = (): void => {
      if (this.projectQueues.get(task.projectId) === current)
        this.projectQueues.delete(task.projectId);
    };
    void current.then(cleanup, cleanup);
    return current;
  }

  async integrate(projectId: string, taskId: string): Promise<IntegrationRecord> {
    const integration = this.options.changes.integrationForTask(projectId, taskId);
    if (!integration || integration.status !== 'ready') {
      throw new RpcError('Integration is not ready.', RpcErrorCode.IntegrationNotReady);
    }
    return this.integrateRecord(integration, this.options.tasks.get(projectId, taskId));
  }

  async waitForIntegration(
    projectId: string,
    taskId: string,
    timeoutMs = 60_000,
  ): Promise<IntegrationRecord> {
    const deadline = Date.now() + timeoutMs;
    while (Date.now() < deadline) {
      const integration = this.options.changes.integrationForTask(projectId, taskId);
      if (
        integration &&
        ['integrated', 'conflict', 'ready', 'rejected', 'aborted'].includes(integration.status)
      ) {
        return integration;
      }
      const task = this.options.tasks.get(projectId, taskId);
      if (['failed', 'blocked', 'cancelled'].includes(task.state)) {
        throw new RpcError(
          'Revert integration task did not complete.',
          RpcErrorCode.IntegrationConflict,
          {
            taskId,
            taskState: task.state,
            error: task.error,
          },
        );
      }
      await delay(25);
    }
    throw new RpcError('Timed out waiting for integration.', RpcErrorCode.IntegrationNotReady, {
      taskId,
    });
  }

  async createRevertIntegration(
    originalTask: TaskRecord,
    originalIntegration: IntegrationRecord,
    note: string,
  ): Promise<{ taskId: string; integration: IntegrationRecord }> {
    if (originalIntegration.status !== 'integrated' || !originalIntegration.mergeCommit) {
      throw new RpcError(
        'Only an integrated task with a merge commit can be reverted.',
        RpcErrorCode.IntegrationNotReady,
      );
    }
    const created = this.options.tasks.create(
      {
        projectId: originalTask.projectId,
        kind: 'noop.echo',
        title: `Revert ${originalTask.title}`,
        goal: `Revert the integrated changes from task ${originalTask.taskId}.`,
        parentTaskId: originalTask.parentTaskId ?? originalTask.taskId,
        role: 'gameplay-engineer',
        isolation: 'worktree',
        touches: originalIntegration.changedFiles.map((file) => ({
          resource: `file:${file}`,
          intent: 'write',
        })),
        contract: { required: [], validators: [] },
        input: {
          feedback: note,
          revertOfTaskId: originalTask.taskId,
          mergeCommit: originalIntegration.mergeCommit,
        },
      },
      { deferStart: true },
    );
    if (created.deduplicated) {
      const existing = this.options.changes.integrationForTask(
        originalTask.projectId,
        created.task.taskId,
      );
      if (!existing)
        throw new RpcError(
          'Revert integration task already exists.',
          RpcErrorCode.IntegrationNotReady,
        );
      return { taskId: created.task.taskId, integration: existing };
    }
    let worktree: TaskWorktree | undefined;
    try {
      worktree = await this.options.worktrees.create(originalTask.projectId, created.task.taskId);
      await this.git(
        [
          '-c',
          'user.name=PlayWeld',
          '-c',
          'user.email=gamecrafter@localhost',
          'revert',
          '-m',
          '1',
          originalIntegration.mergeCommit,
          '--no-edit',
        ],
        worktree.path,
      );
      const integration: IntegrationRecord = {
        schemaVersion: 1,
        integrationId: uuidv7(),
        projectId: originalTask.projectId,
        taskId: created.task.taskId,
        worktreePath: worktree.path,
        branch: worktree.branch,
        baseCommit: worktree.baseCommit,
        status: 'pending',
        changedFiles: await this.changedFiles({
          ...originalIntegration,
          worktreePath: worktree.path,
          branch: worktree.branch,
          baseCommit: worktree.baseCommit,
        }),
        conflicts: [],
        validation: [
          {
            kind: 'git-revert',
            ref: originalIntegration.mergeCommit,
            ok: true,
            detail: `Created a revert commit for task ${originalTask.taskId}.`,
          },
        ],
        mergeCommit: null,
        reconcileTaskId: null,
        updatedAt: this.now().toISOString(),
      };
      const saved = this.save(integration);
      this.options.tasks.activateDeferred(originalTask.projectId, created.task.taskId);
      return { taskId: created.task.taskId, integration: saved };
    } catch (error) {
      const conflictFiles = worktree
        ? splitLines(
            await this.git(['diff', '--name-only', '--diff-filter=U'], worktree.path).catch(
              () => '',
            ),
          )
        : [];
      if (worktree && conflictFiles.length > 0) {
        const revertConflictContent = Object.fromEntries(
          conflictFiles.map((file) => [
            file,
            readFileSync(path.join(worktree!.path, file), 'utf8'),
          ]),
        );
        await this.git(['revert', '--abort'], worktree.path).catch(() => undefined);
        const conflictRecord: IntegrationRecord = {
          schemaVersion: 1,
          integrationId: uuidv7(),
          projectId: originalTask.projectId,
          taskId: created.task.taskId,
          worktreePath: worktree.path,
          branch: worktree.branch,
          baseCommit: worktree.baseCommit,
          status: 'conflict',
          changedFiles: conflictFiles,
          conflicts: conflictFiles.map((file) => ({
            file,
            kind: 'git-conflict',
            otherTaskId: originalTask.taskId,
          })),
          validation: [
            {
              kind: 'git-revert',
              ref: originalIntegration.mergeCommit,
              ok: false,
              detail: error instanceof Error ? error.message : String(error),
            },
          ],
          mergeCommit: null,
          reconcileTaskId: null,
          updatedAt: this.now().toISOString(),
        };
        const saved = this.save(conflictRecord);
        const runtime = this.options.tasks.runtime(originalTask.projectId);
        const blocked = runtime.graph.transition(
          created.task.taskId,
          'blocked',
          'git_revert_conflict',
          'service',
          {
            error: {
              message: 'The revert conflicts with later integrated changes.',
              code: String(RpcErrorCode.IntegrationConflict),
              retryable: true,
            },
          },
        );
        const reconcileTaskId = await this.createReconcileTask(blocked, saved, {
          revertConflictContent,
        });
        const withReconcile = this.save({
          ...saved,
          reconcileTaskId,
          updatedAt: this.now().toISOString(),
        });
        return { taskId: created.task.taskId, integration: withReconcile };
      }
      if (worktree) {
        await this.options.worktrees
          .remove(originalTask.projectId, worktree.path, worktree.branch)
          .catch(() => undefined);
      }
      const runtime = this.options.tasks.runtime(originalTask.projectId);
      if (runtime.graph.get(created.task.taskId).state === 'pending') {
        runtime.graph.transition(created.task.taskId, 'blocked', 'revert_failed', 'service', {
          error: {
            message: error instanceof Error ? error.message : String(error),
            code: String(RpcErrorCode.IntegrationConflict),
            retryable: true,
          },
        });
      }
      throw new RpcError(
        `Unable to prepare revert integration: ${error instanceof Error ? error.message : String(error)}`,
        RpcErrorCode.IntegrationConflict,
      );
    }
  }

  async abort(projectId: string, integrationId: string): Promise<IntegrationRecord> {
    const integration = this.options.changes
      .integrations(projectId)
      .find((candidate) => candidate.integrationId === integrationId);
    if (!integration) {
      throw new RpcError(
        `Integration not found: ${integrationId}`,
        RpcErrorCode.IntegrationNotReady,
      );
    }
    if (integration.worktreePath) {
      await this.options.worktrees.remove(
        projectId,
        integration.worktreePath,
        integration.branch ?? undefined,
      );
    }
    const aborted = this.save({
      ...integration,
      status: 'aborted',
      updatedAt: this.now().toISOString(),
    });
    return aborted;
  }

  private async processTaskInternal(task: TaskRecord): Promise<void> {
    if (task.state !== 'succeeded') return;
    if (task.kind === 'agent.run') {
      const originalIntegrationId = stringValue(asRecord(task.input).reconcilesIntegrationId);
      if (originalIntegrationId) {
        await this.processReconcileTask(task, originalIntegrationId);
        return;
      }
    } else if (task.isolation !== 'worktree' && !task.contract && !task.touches?.length) {
      return;
    }

    const integration =
      this.options.changes.integrationForTask(task.projectId, task.taskId) ??
      task.integration ??
      (await this.newIntegration(task));
    if (['integrated', 'rejected', 'aborted'].includes(integration.status)) return;
    if (!integration.worktreePath || !integration.branch) {
      const changedFiles = filesFromResult(task.result);
      const conflicts = this.detectActiveConflicts(task, changedFiles);
      this.save({
        ...integration,
        status: conflicts.length > 0 ? 'conflict' : 'integrated',
        changedFiles,
        conflicts,
        updatedAt: this.now().toISOString(),
      });
      return;
    }

    await this.commitWorktree(task, integration);
    const changedFiles = await this.changedFiles(integration);
    await this.waitForTouchingTasks(task, changedFiles);
    if (this.stopped) return;
    const conflicts = await this.detectConflicts(task, integration, changedFiles);
    const next = this.save({
      ...integration,
      status: conflicts.length > 0 ? 'conflict' : 'ready',
      changedFiles,
      conflicts,
      updatedAt: this.now().toISOString(),
    });
    if (conflicts.length > 0) {
      const reconcileTaskId = await this.createReconcileTask(task, next);
      this.save({
        ...next,
        reconcileTaskId,
        updatedAt: this.now().toISOString(),
      });
      return;
    }
    await this.maybeAutoIntegrate(task, next);
  }

  private async processReconcileTask(
    task: TaskRecord,
    originalIntegrationId: string,
  ): Promise<void> {
    const original = this.options.changes
      .integrations(task.projectId)
      .find((integration) => integration.integrationId === originalIntegrationId);
    if (!original?.branch) return;
    const integration =
      this.options.changes.integrationForTask(task.projectId, task.taskId) ??
      task.integration ??
      (await this.newIntegration(task));
    if (!integration.worktreePath || !integration.branch) return;
    const conflictFiles = new Set(original.conflicts.map((conflict) => conflict.file));
    for (const file of original.changedFiles.filter((candidate) => !conflictFiles.has(candidate))) {
      const contents = await this.git(
        ['show', `${original.branch}:${file}`],
        this.projectPath(task.projectId),
      );
      const target = path.join(integration.worktreePath, file);
      mkdirSync(path.dirname(target), { recursive: true });
      writeFileSync(target, contents, 'utf8');
    }
    await this.commitWorktree(task, integration);
    const changedFiles = await this.changedFiles(integration);
    await this.waitForTouchingTasks(task, changedFiles);
    if (this.stopped) return;
    const conflicts = await this.detectConflicts(task, integration, changedFiles);
    const next = this.save({
      ...integration,
      status: conflicts.length > 0 ? 'conflict' : 'ready',
      changedFiles,
      conflicts,
      updatedAt: this.now().toISOString(),
    });
    if (conflicts.length > 0) {
      const reconcileTaskId = await this.createReconcileTask(task, next);
      this.save({ ...next, reconcileTaskId, updatedAt: this.now().toISOString() });
      return;
    }
    await this.maybeAutoIntegrate(task, next);
  }

  private async maybeAutoIntegrate(
    task: TaskRecord,
    integration: IntegrationRecord,
  ): Promise<IntegrationRecord | undefined> {
    const policy = String(
      this.options.settings.resolve('coordination.autoIntegrate', {
        projectId: task.projectId,
      }).value,
    );
    if (policy === 'never') return undefined;
    if (policy === 'when-validated' && integration.validation.some((entry) => !entry.ok)) {
      return undefined;
    }
    const accessMode = String(
      this.options.settings.resolve('access.mode', { projectId: task.projectId }).value,
    );
    if (accessMode !== 'full') {
      try {
        const call = await this.options.tools.call(
          {
            projectId: task.projectId,
            taskId: task.taskId,
            toolId: 'change/integrate',
            input: { taskId: task.taskId },
            accessCeiling: task.assignee?.accessCeiling,
          },
          { accessCeiling: task.assignee?.accessCeiling },
        );
        return call.status === 'completed' ? (call.output as IntegrationRecord) : undefined;
      } catch {
        return undefined;
      }
    }
    return this.integrateRecord(integration, task);
  }

  private async integrateRecord(
    integration: IntegrationRecord,
    task: TaskRecord,
  ): Promise<IntegrationRecord> {
    if (!integration.worktreePath || !integration.branch) {
      throw new RpcError(
        'This task has no Git worktree to integrate.',
        RpcErrorCode.IntegrationNotReady,
      );
    }
    const projectPath = this.projectPath(integration.projectId);
    const dirty = await this.git(['status', '--porcelain', '--untracked-files=all'], projectPath);
    if (dirty.trim()) {
      throw new RpcError(
        'Project worktree is dirty; integration will not overwrite user changes.',
        RpcErrorCode.IntegrationNotReady,
        {
          taskId: task.taskId,
          dirty,
        },
      );
    }
    try {
      await this.git(
        [
          ...integrationGitIdentity,
          'merge',
          '--no-ff',
          '-m',
          `Integrate task ${task.taskId}: ${task.title}`,
          integration.branch,
        ],
        projectPath,
      );
    } catch (error) {
      await this.git(['merge', '--abort'], projectPath).catch(() => undefined);
      const conflicts = (await this.detectGitConflicts(projectPath, integration.branch)).map(
        (file): IntegrationConflict => ({ file, kind: 'git-conflict', otherTaskId: null }),
      );
      const next = this.save({
        ...integration,
        status: 'conflict',
        conflicts: conflicts.length > 0 ? conflicts : integration.conflicts,
        updatedAt: this.now().toISOString(),
      });
      const reconcileTaskId = await this.createReconcileTask(task, next);
      const conflicted = this.save({
        ...next,
        reconcileTaskId,
        updatedAt: this.now().toISOString(),
      });
      if (error instanceof RpcError) throw error;
      return conflicted;
    }
    const mergeCommit = (await this.git(['rev-parse', 'HEAD'], projectPath)).trim();
    await this.options.worktrees.remove(
      integration.projectId,
      integration.worktreePath,
      integration.branch,
    );
    const reconcilesIntegrationId = stringValue(asRecord(task.input).reconcilesIntegrationId);
    if (reconcilesIntegrationId) {
      const original = this.options.changes
        .integrations(task.projectId)
        .find((candidate) => candidate.integrationId === reconcilesIntegrationId);
      if (original?.worktreePath) {
        await this.options.worktrees.remove(
          task.projectId,
          original.worktreePath,
          original.branch ?? undefined,
        );
      }
      if (original) {
        this.save({
          ...original,
          status: 'integrated',
          validation: original.validation.map((entry) =>
            entry.kind === 'git-revert'
              ? { ...entry, ok: true, detail: 'Revert conflict was reconciled and integrated.' }
              : entry,
          ),
          mergeCommit,
          updatedAt: this.now().toISOString(),
        });
      }
    }
    return this.save({
      ...integration,
      status: 'integrated',
      mergeCommit,
      updatedAt: this.now().toISOString(),
    });
  }

  private async waitForTouchingTasks(task: TaskRecord, changedFiles: string[]): Promise<void> {
    const resources = new Set(changedFiles.map((file) => `file:${file}`));
    if (resources.size === 0) return;
    const timeoutSeconds = Number(
      this.options.settings.resolve('coordination.lockTimeoutSeconds', {
        projectId: task.projectId,
      }).value,
    );
    const deadline = Date.now() + Math.max(1, timeoutSeconds || 300) * 1000;
    while (!this.stopped && Date.now() < deadline) {
      const active = this.options.tasks.list(task.projectId, {
        states: ['pending', 'ready', 'claimed', 'running', 'waiting_input'],
        limit: 5_000,
      });
      const overlaps = active.some(
        (candidate) =>
          candidate.taskId !== task.taskId &&
          candidate.touches?.some(
            (touch) => touch.intent === 'write' && resources.has(touch.resource),
          ),
      );
      if (!overlaps) return;
      await new Promise((resolve) => setTimeout(resolve, 25));
    }
  }

  private detectActiveConflicts(task: TaskRecord, changedFiles: string[]): IntegrationConflict[] {
    const activeTasks = this.options.tasks.list(task.projectId, {
      states: ['pending', 'ready', 'claimed', 'running', 'waiting_input'],
      limit: 5_000,
    });
    const locks = this.options.locks.list(task.projectId);
    const conflicts: IntegrationConflict[] = [];
    for (const file of changedFiles) {
      const resource = `file:${file}`;
      const lock = locks.find(
        (candidate) =>
          candidate.taskId !== task.taskId &&
          candidate.resource === resource &&
          candidate.mode === 'exclusive',
      );
      if (lock) conflicts.push({ file, kind: 'locked-by-other', otherTaskId: lock.taskId });
      const overlap = activeTasks.find(
        (candidate) =>
          candidate.taskId !== task.taskId &&
          candidate.touches?.some(
            (touch) => touch.intent === 'write' && touch.resource === resource,
          ),
      );
      if (overlap) conflicts.push({ file, kind: 'declared-overlap', otherTaskId: overlap.taskId });
    }
    return conflicts;
  }

  private async detectConflicts(
    task: TaskRecord,
    integration: IntegrationRecord,
    changedFiles: string[],
  ): Promise<IntegrationConflict[]> {
    const projectPath = this.projectPath(task.projectId);
    const currentChanges = new Set(
      splitLines(
        await this.git(['diff', '--name-only', `${integration.baseCommit}..HEAD`], projectPath),
      ),
    );
    const conflicts: IntegrationConflict[] = [];
    const activeTasks = this.options.tasks.list(task.projectId, {
      states: ['pending', 'ready', 'claimed', 'running', 'waiting_input'],
      limit: 5_000,
    });
    const locks = this.options.locks.list(task.projectId);
    for (const file of changedFiles) {
      if (currentChanges.has(file)) {
        const previous = this.options.changes
          .integrations(task.projectId)
          .find(
            (candidate) =>
              candidate.taskId !== task.taskId && candidate.changedFiles.includes(file),
          );
        conflicts.push({ file, kind: 'concurrent-change', otherTaskId: previous?.taskId ?? null });
      }
      const resource = `file:${file}`;
      const lock = locks.find(
        (candidate) =>
          candidate.taskId !== task.taskId &&
          candidate.resource === resource &&
          candidate.mode === 'exclusive',
      );
      if (lock) conflicts.push({ file, kind: 'locked-by-other', otherTaskId: lock.taskId });
      const overlap = activeTasks.find(
        (candidate) =>
          candidate.taskId !== task.taskId &&
          candidate.touches?.some(
            (touch) => touch.intent === 'write' && touch.resource === resource,
          ),
      );
      if (overlap) conflicts.push({ file, kind: 'declared-overlap', otherTaskId: overlap.taskId });
    }
    const gitConflicts = await this.detectGitConflicts(projectPath, integration.branch!);
    for (const file of gitConflicts)
      conflicts.push({ file, kind: 'git-conflict', otherTaskId: null });
    const unique = new Map<string, IntegrationConflict>();
    for (const conflict of conflicts) {
      const key = `${conflict.file}\0${conflict.kind}\0${conflict.otherTaskId}`;
      unique.set(key, conflict);
    }
    return [...unique.values()];
  }

  private async detectGitConflicts(projectPath: string, branch: string): Promise<string[]> {
    const worktreeDirectory = String(
      this.options.settings.resolve('coordination.worktreeDirectory', {
        projectId: this.options.projects.getByPath(projectPath)?.projectId,
      }).value ?? '.gamecrafter/worktrees',
    );
    const checkPath = resolveProjectPath(
      projectPath,
      path.join(worktreeDirectory, `.merge-check-${uuidv7()}`),
    );
    await this.git(['worktree', 'add', '--detach', checkPath, 'HEAD'], projectPath);
    try {
      await this.git(
        [...integrationGitIdentity, 'merge', '--no-commit', '--no-ff', branch],
        checkPath,
      );
      return [];
    } catch (error) {
      const files = splitLines(
        await this.git(['diff', '--name-only', '--diff-filter=U'], checkPath).catch(() => ''),
      );
      if (files.length > 0) return files;
      throw new Error(
        `Unable to check merge conflicts for ${branch}: ${error instanceof Error ? error.message : String(error)}`,
        { cause: error },
      );
    } finally {
      await this.git(['merge', '--abort'], checkPath).catch(() => undefined);
      await this.git(['worktree', 'remove', '--force', checkPath], projectPath).catch(
        () => undefined,
      );
    }
  }

  private async changedFiles(integration: IntegrationRecord): Promise<string[]> {
    if (!integration.branch) return [];
    return splitLines(
      await this.git(
        ['diff', '--name-only', `${integration.baseCommit}...${integration.branch}`],
        this.projectPath(integration.projectId),
      ),
    );
  }

  private async commitWorktree(task: TaskRecord, integration: IntegrationRecord): Promise<void> {
    if (!integration.worktreePath || !integration.branch) return;
    const status = await this.git(
      ['status', '--porcelain', '--untracked-files=all'],
      integration.worktreePath,
    );
    if (!status.trim()) return;
    await this.git(['add', '-A'], integration.worktreePath);
    await this.git(
      [
        '-c',
        'user.name=PlayWeld',
        '-c',
        'user.email=gamecrafter@localhost',
        'commit',
        '-m',
        `Task ${task.taskId}: ${task.title}`,
      ],
      integration.worktreePath,
    );
  }

  private async createReconcileTask(
    task: TaskRecord,
    integration: IntegrationRecord,
    additionalInput: Record<string, unknown> = {},
  ): Promise<string> {
    const conflictFiles = [...new Set(integration.conflicts.map((conflict) => conflict.file))];
    const originalDiff = integration.branch
      ? await this.git(
          [
            'diff',
            `${integration.baseCommit}...${integration.branch}`,
            '--',
            ...integration.changedFiles,
          ],
          this.projectPath(task.projectId),
        )
      : '';
    const currentDiff = await this.git(
      ['diff', `${integration.baseCommit}..HEAD`, '--', ...conflictFiles],
      this.projectPath(task.projectId),
    ).catch(() => '');
    const roleName = task.role ?? task.assignee?.role ?? 'reviewer';
    const role = this.options.roles.get(roleName, task.projectId);
    const accessCeiling = task.assignee?.accessCeiling
      ? minAccessMode(task.assignee.accessCeiling, role.maxAccess)
      : role.maxAccess;
    const created = this.options.tasks.create({
      projectId: task.projectId,
      kind: 'agent.run',
      title: `Reconcile ${task.title}`,
      goal: `Reconcile the overlapping changes from task ${task.taskId} without losing either side.`,
      parentTaskId: task.taskId,
      role: role.name,
      assignee: { role: role.name, accessCeiling },
      isolation: 'worktree',
      touches: integration.changedFiles.map((file) => ({
        resource: `file:${file}`,
        intent: 'write',
      })),
      contract: { required: ['generated'], validators: [] },
      input: {
        reconcilesIntegrationId: integration.integrationId,
        originalTaskId: task.taskId,
        originalBranch: integration.branch,
        conflictFiles,
        changedFiles: integration.changedFiles,
        originalDiff: originalDiff.slice(0, 100_000),
        currentDiff: currentDiff.slice(0, 100_000),
        ...additionalInput,
      },
    });
    return created.task.taskId;
  }

  private async newIntegration(task: TaskRecord): Promise<IntegrationRecord> {
    const projectPath = this.projectPath(task.projectId);
    const baseCommit = await this.git(['rev-parse', 'HEAD'], projectPath).catch(() => '');
    return {
      schemaVersion: 1,
      integrationId: uuidv7(),
      projectId: task.projectId,
      taskId: task.taskId,
      worktreePath: null,
      branch: null,
      baseCommit: baseCommit.trim(),
      status: 'pending',
      changedFiles: [],
      conflicts: [],
      validation: [],
      mergeCommit: null,
      reconcileTaskId: null,
      updatedAt: this.now().toISOString(),
    };
  }

  private claimIsBacked(task: TaskRecord, claim: CompletionClaim['claims'][number]): boolean {
    if (claim.kind === 'generated') return true;
    const database = this.options.projectDatabases.get(task.projectId);
    if (claim.kind === 'engine-validation') {
      return Boolean(
        database
          .prepare(
            'SELECT run_id FROM engine_runs WHERE project_id = ? AND run_id = ? AND status = ?',
          )
          .get(task.projectId, claim.ref, 'succeeded'),
      );
    }
    if (claim.kind === 'tool-validation' || claim.kind === 'static-check') {
      return Boolean(
        database
          .prepare(
            'SELECT call_id FROM tool_calls WHERE project_id = ? AND call_id = ? AND status = ?',
          )
          .get(task.projectId, claim.ref, 'completed'),
      );
    }
    if (claim.kind === 'integration') {
      return (
        this.options.changes.integrationForTask(task.projectId, task.taskId)?.status ===
        'integrated'
      );
    }
    return false;
  }

  private save(integration: IntegrationRecord): IntegrationRecord {
    const saved = this.options.changes.saveIntegration(integration);
    const task = this.options.tasks.get(saved.projectId, saved.taskId);
    if (task.integration?.updatedAt !== saved.updatedAt) {
      this.options.tasks
        .runtime(saved.projectId)
        .graph.update(saved.taskId, { integration: saved });
    }
    this.emit(saved);
    return saved;
  }

  private emit(integration: IntegrationRecord): void {
    this.options.onChanged?.(integration);
  }

  private projectPath(projectId: string): string {
    const project = this.options.projects.getById(projectId);
    if (!project)
      throw new RpcError(`Project not found: ${projectId}`, RpcErrorCode.ProjectNotFound);
    return project.path;
  }

  private async git(args: string[], cwd: string): Promise<string> {
    const { stdout } = await execFileAsync('git', args, {
      cwd,
      encoding: 'utf8',
      timeout: 30_000,
      maxBuffer: 4 * 1024 * 1024,
      windowsHide: true,
    });
    return stdout;
  }
}

function validatorToolId(kind: string, operation?: string): string | undefined {
  if (!operation) return undefined;
  if (kind === 'engine') return `engine/${operation}`;
  if (kind === 'dcc') return `dcc/${operation}`;
  return undefined;
}

function validatorInput(
  kind: string,
  explicitToolId: string | undefined,
  params: Record<string, unknown> | undefined,
): Record<string, unknown> {
  const input = params ?? {};
  // Explicit tools consume their own input schema. Keep existing broker envelopes intact.
  if (explicitToolId || Object.prototype.hasOwnProperty.call(input, 'params')) return input;
  if (kind === 'engine') {
    const { runId, ...operationParams } = input;
    return { ...(runId === undefined ? {} : { runId }), params: operationParams };
  }
  if (kind === 'dcc') {
    const { tool, runId, ...operationParams } = input;
    return { tool, ...(runId === undefined ? {} : { runId }), params: operationParams };
  }
  return input;
}

function operationSucceededIn(value: unknown): boolean {
  return asRecord(value).status === 'succeeded';
}

function filesFromResult(result: TaskResult | null): string[] {
  return [
    ...new Set(
      (result?.artifacts ?? []).flatMap((artifact) => (artifact.path ? [artifact.path] : [])),
    ),
  ];
}

function splitLines(value: string): string[] {
  return value
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
}

function asRecord(value: unknown): Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function stringValue(value: unknown): string | undefined {
  return typeof value === 'string' && value.length > 0 ? value : undefined;
}

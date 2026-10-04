import {
  ChangeNodeRefSchema,
  RpcError,
  RpcErrorCode,
  uuidv7,
  type ResourceLock,
} from '@gamecrafter/contracts';
import { Value } from '@sinclair/typebox/value';
import type { ProjectDatabases } from '../projects/project-databases';
import type { SettingsService } from '../settings/settings-service';
import { log } from '../logger';

interface LockRow {
  lockId: string;
  projectId: string;
  resource: string;
  mode: ResourceLock['mode'];
  taskId: string;
  workerId: string | null;
  acquiredAt: string;
  expiresAt: string;
  renewedAt: string;
}

const lockColumns = `
  lock_id AS lockId,
  project_id AS projectId,
  resource,
  mode,
  task_id AS taskId,
  worker_id AS workerId,
  acquired_at AS acquiredAt,
  expires_at AS expiresAt,
  renewed_at AS renewedAt`;

export class LockManager {
  private onChanged?: (projectId: string, lock: ResourceLock) => void;

  constructor(
    private readonly projectDatabases: ProjectDatabases,
    private readonly settings: SettingsService,
    private readonly now: () => Date = () => new Date(),
  ) {}

  setChangeListener(listener: (projectId: string, lock: ResourceLock) => void): void {
    this.onChanged = listener;
  }

  acquire(
    projectId: string,
    taskId: string,
    workerId: string | null,
    resources: string[],
    mode: ResourceLock['mode'],
  ): ResourceLock[] {
    if (resources.some((resource) => !Value.Check(ChangeNodeRefSchema, resource))) {
      throw new RpcError(
        'Lock resources must be typed references such as file:art/crystal.py.',
        RpcErrorCode.InvalidParams,
      );
    }
    const orderedResources = [...new Set(resources)].sort((left, right) =>
      left.localeCompare(right),
    );
    if (orderedResources.length === 0) return [];
    const database = this.projectDatabases.get(projectId);
    const acquiredAt = this.now();
    const expiresAt = new Date(acquiredAt.getTime() + this.ttlMs(projectId));
    const locks = database.transaction(() => {
      this.deleteExpired(projectId);
      const conflicts = orderedResources.flatMap((resource) => {
        const holders = this.rows(projectId, resource).filter(
          (holder) =>
            holder.taskId !== taskId && (mode === 'exclusive' || holder.mode === 'exclusive'),
        );
        return holders.map((holder) => ({ resource, holder }));
      });
      if (conflicts.length > 0) {
        log('warn', 'resource_lock_conflict', {
          projectId,
          taskId,
          workerId,
          requestedMode: mode,
          conflicts: conflicts.map(({ resource, holder }) => ({
            resource,
            taskId: holder.taskId,
            workerId: holder.workerId,
            expiresAt: holder.expiresAt,
          })),
        });
        throw new RpcError(
          'One or more resources are locked by another task.',
          RpcErrorCode.LockConflict,
          {
            conflicts: conflicts.map(({ resource, holder }) => ({
              resource,
              taskId: holder.taskId,
              workerId: holder.workerId,
              mode: holder.mode,
              expiresAt: holder.expiresAt,
            })),
          },
        );
      }

      const locks: ResourceLock[] = [];
      for (const resource of orderedResources) {
        const existing = this.rows(projectId, resource).find((holder) => holder.taskId === taskId);
        const lock: ResourceLock = {
          schemaVersion: 1,
          lockId: existing?.lockId ?? uuidv7(),
          projectId,
          resource,
          mode,
          taskId,
          workerId,
          acquiredAt: existing?.acquiredAt ?? acquiredAt.toISOString(),
          expiresAt: expiresAt.toISOString(),
          renewedAt: acquiredAt.toISOString(),
        };
        this.upsert(lock);
        locks.push(lock);
      }
      return locks;
    });
    for (const lock of locks) this.onChanged?.(projectId, lock);
    return locks;
  }

  list(projectId: string): ResourceLock[] {
    this.deleteExpired(projectId);
    return this.projectDatabases
      .get(projectId)
      .prepare(
        `SELECT ${lockColumns} FROM resource_locks WHERE project_id = ? ORDER BY resource, task_id`,
      )
      .all<LockRow>(projectId)
      .map(lockFromRow);
  }

  release(projectId: string, lockId: string, taskId?: string, allowOverride = false): ResourceLock {
    const database = this.projectDatabases.get(projectId);
    const lock = database.transaction(() => {
      const row = database
        .prepare(`SELECT ${lockColumns} FROM resource_locks WHERE project_id = ? AND lock_id = ?`)
        .get<LockRow>(projectId, lockId);
      if (!row || (taskId !== undefined && row.taskId !== taskId && !allowOverride)) {
        log('warn', 'resource_lock_release_denied', {
          projectId,
          taskId: taskId ?? null,
          lockId,
          holderTaskId: row?.taskId ?? null,
        });
        throw new RpcError(`Lock not held: ${lockId}`, RpcErrorCode.LockNotHeld);
      }
      database
        .prepare('DELETE FROM resource_locks WHERE project_id = ? AND lock_id = ?')
        .run(projectId, lockId);
      return lockFromRow(row);
    });
    this.onChanged?.(projectId, lock);
    return lock;
  }

  releaseTask(projectId: string, taskId: string): ResourceLock[] {
    const database = this.projectDatabases.get(projectId);
    const locks = database.transaction(() => {
      const records = this.rowsForTask(projectId, taskId).map(lockFromRow);
      database
        .prepare('DELETE FROM resource_locks WHERE project_id = ? AND task_id = ?')
        .run(projectId, taskId);
      return records;
    });
    for (const lock of locks) this.onChanged?.(projectId, lock);
    return locks;
  }

  renewTask(projectId: string, taskId: string, workerId: string): void {
    const database = this.projectDatabases.get(projectId);
    const renewedAt = this.now();
    const expiresAt = new Date(renewedAt.getTime() + this.ttlMs(projectId)).toISOString();
    const locks = this.rowsForTask(projectId, taskId)
      .filter((row) => row.workerId === workerId)
      .map((row) => ({
        ...lockFromRow(row),
        expiresAt,
        renewedAt: renewedAt.toISOString(),
      }));
    database
      .prepare(
        `UPDATE resource_locks SET renewed_at = ?, expires_at = ?
         WHERE project_id = ? AND task_id = ? AND worker_id = ?`,
      )
      .run(renewedAt.toISOString(), expiresAt, projectId, taskId, workerId);
    for (const lock of locks) this.onChanged?.(projectId, lock);
  }

  assertHeld(
    projectId: string,
    taskId: string,
    resource: string,
    mode: ResourceLock['mode'],
  ): ResourceLock {
    const lock = this.rows(projectId, resource).find(
      (candidate) =>
        candidate.taskId === taskId && (mode === 'shared' || candidate.mode === 'exclusive'),
    );
    if (!lock) {
      throw new RpcError(
        `Task ${taskId} does not hold a ${mode} lock for ${resource}.`,
        RpcErrorCode.LockNotHeld,
        { projectId, taskId, resource, mode },
      );
    }
    return lockFromRow(lock);
  }

  private ttlMs(projectId: string): number {
    const seconds = Number(
      this.settings.resolve('coordination.lockTimeoutSeconds', { projectId }).value,
    );
    return Math.max(1, seconds || 300) * 1000;
  }

  private deleteExpired(projectId: string): void {
    const database = this.projectDatabases.get(projectId);
    const expired = database
      .prepare(`SELECT ${lockColumns} FROM resource_locks WHERE project_id = ? AND expires_at <= ?`)
      .all<LockRow>(projectId, this.now().toISOString())
      .map(lockFromRow);
    database
      .prepare('DELETE FROM resource_locks WHERE project_id = ? AND expires_at <= ?')
      .run(projectId, this.now().toISOString());
    for (const lock of expired) this.onChanged?.(projectId, lock);
  }

  private rows(projectId: string, resource: string): LockRow[] {
    return this.projectDatabases
      .get(projectId)
      .prepare(
        `SELECT ${lockColumns} FROM resource_locks
         WHERE project_id = ? AND resource = ? ORDER BY task_id`,
      )
      .all<LockRow>(projectId, resource);
  }

  private rowsForTask(projectId: string, taskId: string): LockRow[] {
    return this.projectDatabases
      .get(projectId)
      .prepare(
        `SELECT ${lockColumns} FROM resource_locks
         WHERE project_id = ? AND task_id = ? ORDER BY resource`,
      )
      .all<LockRow>(projectId, taskId);
  }

  private upsert(lock: ResourceLock): void {
    this.projectDatabases
      .get(lock.projectId)
      .prepare(
        `INSERT INTO resource_locks
          (lock_id, project_id, resource, mode, task_id, worker_id, acquired_at, expires_at, renewed_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT(project_id, resource, task_id) DO UPDATE SET
          mode = excluded.mode,
          worker_id = excluded.worker_id,
          expires_at = excluded.expires_at,
          renewed_at = excluded.renewed_at`,
      )
      .run(
        lock.lockId,
        lock.projectId,
        lock.resource,
        lock.mode,
        lock.taskId,
        lock.workerId,
        lock.acquiredAt,
        lock.expiresAt,
        lock.renewedAt,
      );
  }
}

function lockFromRow(row: LockRow): ResourceLock {
  return { schemaVersion: 1, ...row };
}

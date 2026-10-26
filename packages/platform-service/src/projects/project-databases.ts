import { existsSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import { RpcError, RpcErrorCode } from '@gamecrafter/contracts';
import { Database } from '../db/database';
import { migrate } from '../db/migrator';
import { snapshotProjectBeforeMigrations } from '../db/migration-snapshot';
import type { ProfileStore } from '../profile/profile-store';
import { projectMigrations } from './migrations';

export class ProjectDatabases {
  private readonly databases = new Map<string, Database>();

  constructor(private readonly profile: ProfileStore) {}

  get(projectId: string): Database {
    const existing = this.databases.get(projectId);
    if (existing) return existing;

    const project = this.profile.getById(projectId);
    if (
      !project ||
      !existsSync(project.path) ||
      !existsSync(path.join(project.path, 'gamecrafter.project.json'))
    ) {
      throw new RpcError(`Project not found: ${projectId}`, RpcErrorCode.ProjectNotFound);
    }

    const projectStateDirectory = path.join(project.path, '.gamecrafter');
    mkdirSync(projectStateDirectory, { recursive: true });
    const database = Database.open(path.join(projectStateDirectory, 'project.sqlite'));
    try {
      snapshotProjectBeforeMigrations(
        database,
        projectStateDirectory,
        projectMigrations,
        projectId,
      );
      migrate(database, projectMigrations);
      database
        .prepare(
          `INSERT INTO project_meta (key, value) VALUES (?, ?)
           ON CONFLICT(key) DO NOTHING`,
        )
        .run('project_id', projectId);
      database
        .prepare(
          `INSERT INTO project_meta (key, value) VALUES (?, ?)
           ON CONFLICT(key) DO NOTHING`,
        )
        .run('schema_version', '1');
    } catch (error) {
      database.close();
      throw error;
    }
    this.databases.set(projectId, database);
    return database;
  }

  close(): void {
    for (const database of this.databases.values()) database.close();
    this.databases.clear();
  }
}

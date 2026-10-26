import { statSync } from 'node:fs';
import path from 'node:path';
import { Database } from './database';
import {
  currentMigrationVersion,
  latestMigrationVersion,
  MigrationCompatibilityError,
  validateMigrationHistory,
} from './migrator';
import { profileMigrations } from '../profile/migrations';
import { projectMigrations } from '../projects/migrations';

export type DatabaseKind = 'profile' | 'project';
export type DatabaseHealthStatus =
  | 'healthy'
  | 'upgrade-required'
  | 'missing'
  | 'uninitialized'
  | 'incompatible'
  | 'corrupt'
  | 'unavailable';
type CheckStatus = 'ok' | 'failed' | 'not-run';

export interface DatabaseHealthReport {
  schemaVersion: 1;
  kind: DatabaseKind;
  checkedAt: string;
  readOnly: true;
  status: DatabaseHealthStatus;
  currentMigration: number | null;
  latestMigration: number;
  checks: { integrity: CheckStatus; foreignKeys: CheckStatus; migrationHistory: CheckStatus };
  message: string;
}

/** Operator diagnostic only: no migration, repair, checkpoint or record-content output. */
export function inspectDatabaseHealth(
  databasePath: string,
  kind: DatabaseKind,
): DatabaseHealthReport {
  if (!path.isAbsolute(databasePath))
    throw new TypeError('Database diagnostic path must be absolute.');
  const migrations = kind === 'profile' ? profileMigrations : projectMigrations;
  const result: DatabaseHealthReport = {
    schemaVersion: 1,
    kind,
    checkedAt: new Date().toISOString(),
    readOnly: true,
    status: 'unavailable',
    currentMigration: null,
    latestMigration: latestMigrationVersion(migrations),
    checks: { integrity: 'not-run', foreignKeys: 'not-run', migrationHistory: 'not-run' },
    message:
      'Database could not be checked. Verify access and owning-service state, then retry; do not replace or delete its files.',
  };
  const finish = (status: DatabaseHealthStatus, message: string) => ({
    ...result,
    status,
    message,
  });
  let database: Database | undefined;
  let checkingHistory = false;
  try {
    if (!statSync(databasePath).isFile()) return result;
    database = Database.open(databasePath, { readOnly: true });
    // A single read transaction keeps integrity, foreign keys and history in one snapshot.
    database.exec('BEGIN');
    const integrity = database
      .prepare('PRAGMA integrity_check(1)')
      .all<{ integrity_check: string }>();
    if (integrity.length !== 1 || integrity[0]?.integrity_check !== 'ok') {
      result.checks.integrity = 'failed';
      return finish(
        'corrupt',
        'SQLite integrity validation failed. Preserve the database and its WAL/journal files; restore a verified backup to a separate location.',
      );
    }
    result.checks.integrity = 'ok';
    if (database.prepare('SELECT 1 AS violation FROM pragma_foreign_key_check LIMIT 1').get()) {
      result.checks.foreignKeys = 'failed';
      return finish(
        'corrupt',
        'Foreign-key validation failed. Preserve the database and restore a verified backup to a separate location; no records were repaired or removed.',
      );
    }
    result.checks.foreignKeys = 'ok';
    checkingHistory = true;
    const version = currentMigrationVersion(database);
    if (Number.isSafeInteger(version) && version >= 0) result.currentMigration = version;
    validateMigrationHistory(database, migrations);
    if (version === 0)
      return finish(
        'uninitialized',
        'No initialized PlayWeld schema was found. Initialize only an intentionally new database; preserve unexpected empty files and use an independent verified restore.',
      );
    const required =
      kind === 'profile' ? ['service_meta', 'projects_registry'] : ['project_meta', 'events'];
    for (const table of required) {
      if (
        !database
          .prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name = ?")
          .get(table)
      )
        throw new MigrationCompatibilityError('unrecognized-schema');
    }
    result.checks.migrationHistory = 'ok';
    return version < result.latestMigration
      ? finish(
          'upgrade-required',
          'Known older schema is readable. Preserve a verified backup before normal startup applies supported migrations. This diagnostic does not migrate the file.',
        )
      : finish(
          'healthy',
          'SQLite integrity, foreign keys and recognized migration history passed. This does not prove all application data is semantically correct.',
        );
  } catch (error) {
    const details = (typeof error === 'object' && error !== null ? error : {}) as {
      code?: string;
      errcode?: number;
    };
    if (details.code === 'ENOENT')
      return finish(
        'missing',
        'Database file does not exist. No file or parent directory was created; select an existing database or a verified independent restore.',
      );
    const code = details.errcode;
    if (typeof code === 'number' && [5, 6].includes(code & 255)) return result;
    if (typeof code === 'number' && [11, 26].includes(code & 255)) {
      result.checks.integrity = 'failed';
      return finish(
        'corrupt',
        'SQLite could not read a valid database. Preserve the database and its WAL/journal files; restore a verified backup to a separate location.',
      );
    }
    if (
      error instanceof MigrationCompatibilityError ||
      (checkingHistory && (code === 1 || details.code === 'ERR_OUT_OF_RANGE'))
    ) {
      result.checks.migrationHistory = 'failed';
      return finish(
        'incompatible',
        'Database schema/history is not compatible with the selected kind and application. Use a compatible version or verified independent restore; no migrations were applied.',
      );
    }
    return result;
  } finally {
    database?.close();
  }
}

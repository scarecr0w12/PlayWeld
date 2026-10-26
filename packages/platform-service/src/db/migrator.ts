import type { Database } from './database';

export interface Migration {
  id: number;
  name: string;
  up: string;
}

export class MigrationCompatibilityError extends Error {
  constructor(
    readonly reason: 'newer-schema' | 'history-mismatch' | 'name-mismatch' | 'unrecognized-schema',
  ) {
    const messages = {
      'newer-schema':
        'Database schema is newer than this application; use a compatible version or restore a verified backup to a separate location.',
      'history-mismatch':
        'Database migration history is not a recognized prefix; preserve the database and restore a verified backup to a separate location.',
      'name-mismatch':
        'Database migration name mismatch; preserve the database and use a compatible application or verified backup.',
      'unrecognized-schema':
        'Unrecognized database schema; do not initialize over existing data. Select the correct database or a verified independent restore.',
    };
    super(messages[reason]);
    this.name = 'MigrationCompatibilityError';
  }
}

/** Validate all applied history before creating metadata, snapshots or applying SQL. */
export function validateMigrationHistory(db: Database, migrations: Migration[]): number {
  const expected = [...migrations].sort((left, right) => left.id - right.id);
  if (
    expected.some(
      (entry, index) =>
        !Number.isSafeInteger(entry.id) ||
        entry.id <= 0 ||
        !entry.name ||
        expected[index - 1]?.id === entry.id,
    )
  )
    throw new Error('Invalid application migration definitions.');
  const table = db
    .prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'schema_migrations'")
    .get();
  if (!table) {
    if (db.prepare("SELECT name FROM sqlite_master WHERE name NOT GLOB 'sqlite_*' LIMIT 1").get())
      throw new MigrationCompatibilityError('unrecognized-schema');
    return 0;
  }
  let rows: { id: number; name: string }[];
  try {
    rows = db
      .prepare('SELECT id, name FROM schema_migrations ORDER BY id LIMIT ?')
      .all<{ id: number; name: string }>(expected.length + 1);
  } catch (error) {
    const details = error as { code?: string; errcode?: number };
    if (details.errcode === 1 || details.code === 'ERR_OUT_OF_RANGE')
      throw new MigrationCompatibilityError('history-mismatch');
    throw error;
  }
  for (const [index, row] of rows.entries()) {
    if (!Number.isSafeInteger(row.id) || row.id <= 0)
      throw new MigrationCompatibilityError('history-mismatch');
    if (row.id > latestMigrationVersion(expected))
      throw new MigrationCompatibilityError('newer-schema');
    if (row.id !== expected[index]?.id) throw new MigrationCompatibilityError('history-mismatch');
    if (row.name !== expected[index]?.name) throw new MigrationCompatibilityError('name-mismatch');
  }
  return rows.at(-1)?.id ?? 0;
}

export function currentMigrationVersion(db: Database): number {
  const table = db
    .prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'schema_migrations'")
    .get<{ name: string }>();
  if (!table) return 0;
  const row = db
    .prepare('SELECT COALESCE(MAX(id), 0) AS version FROM schema_migrations')
    .get<{ version: number }>();
  return Number(row?.version ?? 0);
}

export function latestMigrationVersion(migrations: Migration[]): number {
  return migrations.reduce((latest, migration) => Math.max(latest, migration.id), 0);
}

export function migrate(db: Database, migrations: Migration[]): { applied: number[] } {
  validateMigrationHistory(db, migrations);
  db.exec(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      id INTEGER PRIMARY KEY,
      name TEXT NOT NULL,
      applied_at TEXT NOT NULL
    )
  `);
  const applied: number[] = [];

  for (const migration of [...migrations].sort((left, right) => left.id - right.id)) {
    const existing = db
      .prepare('SELECT id, name FROM schema_migrations WHERE id = ?')
      .get<{ id: number; name: string }>(migration.id);
    if (existing) {
      if (existing.name !== migration.name) {
        throw new Error(
          `Migration ${migration.id} name mismatch: expected ${existing.name}, received ${migration.name}`,
        );
      }
      continue;
    }

    db.transaction(() => {
      db.exec(migration.up);
      db.prepare('INSERT INTO schema_migrations (id, name, applied_at) VALUES (?, ?, ?)').run(
        migration.id,
        migration.name,
        new Date().toISOString(),
      );
    });
    applied.push(migration.id);
  }

  return { applied };
}

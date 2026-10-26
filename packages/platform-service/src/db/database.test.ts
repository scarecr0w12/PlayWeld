import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { Database } from './database';
import { migrate } from './migrator';

const openDatabases: Database[] = [];
const migrations = [
  {
    id: 1,
    name: 'create sample table',
    up: 'CREATE TABLE sample (value TEXT NOT NULL)',
  },
];

afterEach(() => {
  for (const database of openDatabases.splice(0)) database.close();
});

describe('database migrations', () => {
  it('applies migrations once and is idempotent', () => {
    const database = Database.open(':memory:');
    openDatabases.push(database);

    expect(migrate(database, migrations).applied).toEqual([1]);
    expect(migrate(database, migrations).applied).toEqual([]);
  });

  it('rejects an applied migration with a different name', () => {
    const database = Database.open(':memory:');
    openDatabases.push(database);
    migrate(database, migrations);

    expect(() => migrate(database, [{ ...migrations[0]!, name: 'renamed migration' }])).toThrow(
      /name mismatch/,
    );
  });

  it('snapshots a consistent database through VACUUM INTO', () => {
    const directory = mkdtempSync(path.join(tmpdir(), 'gc-db-snapshot-'));
    const databasePath = path.join(directory, 'source.sqlite');
    const snapshotPath = path.join(directory, 'snapshot.sqlite');
    const database = Database.open(databasePath);
    try {
      database.exec('CREATE TABLE sample (value TEXT NOT NULL)');
      database.prepare('INSERT INTO sample (value) VALUES (?)').run('snapshot');
      database.snapshotTo(snapshotPath);
      const snapshot = Database.open(snapshotPath);
      try {
        expect(snapshot.prepare('SELECT value FROM sample').get<{ value: string }>()?.value).toBe(
          'snapshot',
        );
      } finally {
        snapshot.close();
      }
    } finally {
      database.close();
      rmSync(directory, { recursive: true, force: true });
    }
  });

  it('rolls back failed transactions', () => {
    const database = Database.open(':memory:');
    openDatabases.push(database);

    expect(() =>
      database.transaction(() => {
        database.exec('CREATE TABLE rolled_back (value TEXT)');
        throw new Error('abort');
      }),
    ).toThrow('abort');
    expect(() => database.prepare('SELECT * FROM rolled_back').all()).toThrow();
  });

  it('refuses future migration history without applying older missing migrations', () => {
    const database = Database.open(':memory:');
    openDatabases.push(database);
    migrate(database, migrations);
    database.prepare('INSERT INTO schema_migrations VALUES (?, ?, ?)').run(99, 'future', 'later');
    const next = { id: 2, name: 'next', up: 'CREATE TABLE next_table (value TEXT)' };
    expect(() => migrate(database, [...migrations, next])).toThrow(/newer.*compatible/i);
    expect(
      database.prepare("SELECT name FROM sqlite_master WHERE name = 'next_table'").get(),
    ).toBeUndefined();
  });

  it('validates the complete applied prefix before any migration writes', () => {
    const database = Database.open(':memory:');
    openDatabases.push(database);
    migrate(database, migrations);
    database
      .prepare('INSERT INTO schema_migrations VALUES (?, ?, ?)')
      .run(3, 'unexpected', 'later');
    expect(() =>
      migrate(database, [
        ...migrations,
        { id: 2, name: 'second', up: 'CREATE TABLE second_table (value TEXT)' },
        { id: 3, name: 'third', up: 'CREATE TABLE third_table (value TEXT)' },
      ]),
    ).toThrow(/migration history/i);
    expect(
      database.prepare("SELECT name FROM sqlite_master WHERE name = 'second_table'").get(),
    ).toBeUndefined();
    expect(database.prepare('SELECT COUNT(*) AS count FROM schema_migrations').get()).toEqual({
      count: 2,
    });
  });

  it('does not initialize an unrelated existing database', () => {
    const database = Database.open(':memory:');
    openDatabases.push(database);
    database.exec(
      "CREATE TABLE authored_data (value TEXT); INSERT INTO authored_data VALUES ('retain')",
    );
    expect(() => migrate(database, migrations)).toThrow(/unrecognized.*database/i);
    expect(
      database.prepare("SELECT name FROM sqlite_master WHERE name = 'schema_migrations'").get(),
    ).toBeUndefined();
    expect(database.prepare('SELECT value FROM authored_data').get()).toEqual({ value: 'retain' });
  });

  it('does not initialize authored tables beside an empty migration-history table', () => {
    const database = Database.open(':memory:');
    openDatabases.push(database);
    migrate(database, []);
    database.exec(
      "CREATE TABLE authored_data (value TEXT); INSERT INTO authored_data VALUES ('retain')",
    );
    expect(() => migrate(database, migrations)).toThrow(/unrecognized.*database/i);
    expect(database.prepare('SELECT COUNT(*) AS count FROM schema_migrations').get()).toEqual({
      count: 0,
    });
    expect(
      database.prepare("SELECT name FROM sqlite_master WHERE name = 'sample'").get(),
    ).toBeUndefined();
    expect(database.prepare('SELECT value FROM authored_data').get()).toEqual({ value: 'retain' });
  });

  it.each([
    'ALTER TABLE schema_migrations RENAME COLUMN name TO unrecognized',
    "INSERT INTO schema_migrations VALUES (9223372036854775807, 'future', 'later')",
  ])('rejects malformed/out-of-range history with compatibility guidance', (change) => {
    const database = Database.open(':memory:');
    openDatabases.push(database);
    migrate(database, migrations);
    database.exec(change);
    expect(() => migrate(database, migrations)).toThrow(/migration history.*recognized prefix/i);
    expect(database.prepare('SELECT COUNT(*) AS count FROM sample').get()).toEqual({ count: 0 });
  });

  it('opens diagnostic connections without write authority or a journal-mode change', () => {
    const directory = mkdtempSync(path.join(tmpdir(), 'gc-db-readonly-'));
    const file = path.join(directory, 'source.sqlite');
    const created = Database.open(file);
    created.exec('CREATE TABLE sample (value TEXT); PRAGMA journal_mode=DELETE');
    created.close();
    const before = readFileSync(file);
    const database = Database.open(file, { readOnly: true });
    try {
      expect(database.prepare('PRAGMA journal_mode').get()).toEqual({ journal_mode: 'delete' });
      expect(() => database.exec("INSERT INTO sample VALUES ('blocked')")).toThrow(
        /readonly|read-only/i,
      );
      expect(database.prepare('SELECT COUNT(*) AS count FROM sample').get()).toEqual({ count: 0 });
    } finally {
      database.close();
      try {
        expect(readFileSync(file)).toEqual(before);
      } finally {
        rmSync(directory, { recursive: true, force: true });
      }
    }
  });

  it('never creates a missing database for a diagnostic connection', () => {
    const directory = mkdtempSync(path.join(tmpdir(), 'gc-db-missing-'));
    const file = path.join(directory, 'missing.sqlite');
    let database: Database | undefined;
    try {
      expect(() => {
        database = Database.open(file, { readOnly: true });
      }).toThrow();
      expect(existsSync(file)).toBe(false);
    } finally {
      database?.close();
      rmSync(directory, { recursive: true, force: true });
    }
  });
});

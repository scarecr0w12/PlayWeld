import { copyFileSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, expect, it } from 'vitest';
import { Database } from './database';
import { inspectDatabaseHealth } from './database-health';
import { migrate } from './migrator';
import { profileMigrations } from '../profile/migrations';
import { projectMigrations } from '../projects/migrations';

const directories: string[] = [];
afterEach(() => {
  for (const directory of directories.splice(0))
    rmSync(directory, { recursive: true, force: true });
});

function fixture(kind: 'profile' | 'project' = 'profile', count?: number) {
  const root = mkdtempSync(path.join(tmpdir(), 'gc-db-health-'));
  directories.push(root);
  const file = path.join(root, 'state.sqlite');
  const database = Database.open(file);
  const migrations = kind === 'profile' ? profileMigrations : projectMigrations;
  migrate(database, migrations.slice(0, count));
  database.close();
  return { root, file, migrations };
}

it.each(['profile', 'project'] as const)(
  'checks %s integrity, foreign keys and migration identity without changing data',
  (kind) => {
    const { file, migrations } = fixture(kind);
    const before = readFileSync(file);
    expect(inspectDatabaseHealth(file, kind)).toMatchObject({
      schemaVersion: 1,
      kind,
      status: 'healthy',
      readOnly: true,
      currentMigration: migrations.at(-1)!.id,
      latestMigration: migrations.at(-1)!.id,
      checks: { integrity: 'ok', foreignKeys: 'ok', migrationHistory: 'ok' },
    });
    expect(readFileSync(file)).toEqual(before);
  },
);

it('recognizes an older known schema without migrating it', () => {
  const { file } = fixture('profile', 1);
  const before = readFileSync(file);
  expect(inspectDatabaseHealth(file, 'profile')).toMatchObject({
    status: 'upgrade-required',
    currentMigration: 1,
  });
  expect(readFileSync(file)).toEqual(before);
});

it('rejects a wrong database kind and redacts migration names', () => {
  const { file } = fixture('project');
  expect(inspectDatabaseHealth(file, 'profile')).toMatchObject({ status: 'incompatible' });
  const db = Database.open(file);
  db.exec("UPDATE schema_migrations SET name = 'fixture-private-migration' WHERE id = 1");
  db.close();
  const before = readFileSync(file);
  const result = inspectDatabaseHealth(file, 'project');
  expect(result).toMatchObject({ status: 'incompatible', checks: { migrationHistory: 'failed' } });
  expect(JSON.stringify(result)).not.toContain('fixture-private-migration');
  expect(readFileSync(file)).toEqual(before);
});

it('does not bless a future schema or a current history with a missing core table', () => {
  const { file } = fixture();
  const db = Database.open(file);
  db.prepare('INSERT INTO schema_migrations VALUES (?, ?, ?)').run(99, 'future', 'later');
  db.close();
  expect(inspectDatabaseHealth(file, 'profile')).toMatchObject({
    status: 'incompatible',
    currentMigration: 99,
  });
  const missing = fixture();
  const edited = Database.open(missing.file);
  edited.exec('DROP TABLE service_meta');
  edited.close();
  expect(inspectDatabaseHealth(missing.file, 'profile')).toMatchObject({ status: 'incompatible' });
});

it('does not treat an empty history beside authored data as an uninitialized store', () => {
  const { file } = fixture('profile', 0);
  const database = Database.open(file);
  database.exec(
    "CREATE TABLE authored_data (value TEXT); INSERT INTO authored_data VALUES ('retain')",
  );
  database.close();
  const before = readFileSync(file);
  expect(inspectDatabaseHealth(file, 'profile')).toMatchObject({ status: 'incompatible' });
  expect(readFileSync(file)).toEqual(before);
});

it('reports malformed migration metadata as incompatible without exposing schema details', () => {
  const { file } = fixture();
  const db = Database.open(file);
  db.exec('ALTER TABLE schema_migrations RENAME COLUMN name TO fixture_private_column');
  db.close();
  const before = readFileSync(file);
  const result = inspectDatabaseHealth(file, 'profile');
  expect(result).toMatchObject({
    status: 'incompatible',
    checks: { integrity: 'ok', migrationHistory: 'failed' },
  });
  expect(JSON.stringify(result)).not.toContain('fixture_private_column');
  expect(readFileSync(file)).toEqual(before);
});

it('reports foreign-key failures without disclosing offending table/record data', () => {
  const { file } = fixture();
  const db = Database.open(file);
  db.exec(`PRAGMA foreign_keys=OFF;
    CREATE TABLE fixture_private_parent (id INTEGER PRIMARY KEY);
    CREATE TABLE fixture_private_child (parent INTEGER REFERENCES fixture_private_parent(id));
    INSERT INTO fixture_private_child VALUES (42)`);
  db.close();
  const before = readFileSync(file);
  const result = inspectDatabaseHealth(file, 'profile');
  expect(result).toMatchObject({
    status: 'corrupt',
    checks: { integrity: 'ok', foreignKeys: 'failed' },
  });
  expect(JSON.stringify(result)).not.toContain('fixture_private');
  expect(readFileSync(file)).toEqual(before);
});

it('retains a corrupt original while an independent known-good snapshot can be diagnosed and read', () => {
  const { root, file } = fixture();
  const db = Database.open(file);
  db.prepare('INSERT INTO service_meta VALUES (?, ?)').run('authored', 'retained fixture');
  const backup = path.join(root, 'verified-snapshot.sqlite');
  db.snapshotTo(backup);
  db.close();
  const damaged = readFileSync(file);
  damaged[100] = 255;
  writeFileSync(file, damaged);
  expect(inspectDatabaseHealth(file, 'profile')).toMatchObject({ status: 'corrupt' });
  const restored = path.join(root, 'independent-restore.sqlite');
  copyFileSync(backup, restored);
  expect(inspectDatabaseHealth(restored, 'profile')).toMatchObject({ status: 'healthy' });
  const copy = Database.open(restored, { readOnly: true });
  try {
    expect(copy.prepare("SELECT value FROM service_meta WHERE key = 'authored'").get()).toEqual({
      value: 'retained fixture',
    });
  } finally {
    copy.close();
  }
  expect(readFileSync(file)).toEqual(damaged);
});

it('reads committed WAL data without forcing a checkpoint', () => {
  const { file } = fixture();
  const writer = Database.open(file);
  try {
    writer.prepare('INSERT INTO service_meta VALUES (?, ?)').run('authored', 'WAL fixture');
    const wal = readFileSync(file + '-wal');
    expect(inspectDatabaseHealth(file, 'profile')).toMatchObject({ status: 'healthy' });
    expect(readFileSync(file + '-wal')).toEqual(wal);
  } finally {
    writer.close();
  }
});

it('reports empty files as uninitialized and non-files as unavailable', () => {
  const { root, file } = fixture();
  const empty = path.join(root, 'empty.sqlite');
  writeFileSync(empty, '');
  expect(inspectDatabaseHealth(empty, 'profile')).toMatchObject({ status: 'uninitialized' });
  expect(readFileSync(empty)).toHaveLength(0);
  expect(inspectDatabaseHealth(root, 'profile')).toMatchObject({ status: 'unavailable' });
  expect(inspectDatabaseHealth(file, 'profile')).toMatchObject({ status: 'healthy' });
});

it('does not confuse an exclusive lock with corruption', () => {
  const { file } = fixture();
  const writer = Database.open(file);
  try {
    writer.exec('PRAGMA journal_mode=DELETE; BEGIN EXCLUSIVE');
    expect(inspectDatabaseHealth(file, 'profile')).toMatchObject({ status: 'unavailable' });
  } finally {
    writer.exec('ROLLBACK');
    writer.close();
  }
});

import { randomUUID } from 'node:crypto';
import {
  closeSync,
  existsSync,
  fsyncSync,
  lstatSync,
  mkdirSync,
  openSync,
  readdirSync,
  readFileSync,
  renameSync,
  rmSync,
  chmodSync,
  writeFileSync,
} from 'node:fs';
import path from 'node:path';
import { Database } from './database';
import { validateMigrationHistory, latestMigrationVersion, type Migration } from './migrator';

/** Existing Project upgrades retain a fresh verified snapshot on every attempt. */
export function snapshotProjectBeforeMigrations(
  database: Database,
  projectStateDirectory: string,
  migrations: Migration[],
  projectId: string,
): string | null {
  const oldVersion = validateMigrationHistory(database, migrations);
  const targetVersion = latestMigrationVersion(migrations);
  if (oldVersion === 0 || targetVersion <= oldVersion) return null;
  const failure = () =>
    new Error(
      'Project upgrade stopped because its recovery snapshot could not be verified. Preserve the Project and existing recovery files; check access and free space or restore a verified backup to a separate location.',
    );
  const owner = database
    .prepare('SELECT value FROM project_meta WHERE key = ?')
    .get<{ value: string }>('project_id');
  if (owner?.value !== projectId) throw failure();
  const directory = path.join(projectStateDirectory, 'pre-migration');
  const snapshotPath = path.join(
    directory,
    `project-v${oldVersion}-to-v${targetVersion}-${randomUUID()}.sqlite`,
  );
  const pendingPath = `${snapshotPath}.partial`;
  try {
    mkdirSync(directory, { recursive: true, mode: 0o700 });
    if (lstatSync(directory).isSymbolicLink()) throw failure();
    // Registered Projects may be upgraded before their root .gitignore is refreshed.
    const ignorePath = path.join(directory, '.gitignore');
    if (!existsSync(ignorePath)) writeFileSync(ignorePath, '*\n', { flag: 'wx', mode: 0o600 });
    if (
      lstatSync(ignorePath).isSymbolicLink() ||
      readFileSync(ignorePath, 'utf8').replace(/\r\n/g, '\n') !== '*\n'
    )
      throw failure();
    database.snapshotTo(pendingPath);
    chmodSync(pendingPath, 0o600);
    const descriptor = openSync(pendingPath, 'r+');
    try {
      fsyncSync(descriptor);
    } finally {
      closeSync(descriptor);
    }
    const snapshot = Database.open(pendingPath, { readOnly: true });
    try {
      const integrity = snapshot
        .prepare('PRAGMA integrity_check(1)')
        .all<{ integrity_check: string }>();
      const owner = snapshot
        .prepare('SELECT value FROM project_meta WHERE key = ?')
        .get<{ value: string }>('project_id');
      if (
        integrity.length !== 1 ||
        integrity[0]?.integrity_check !== 'ok' ||
        snapshot.prepare('SELECT 1 FROM pragma_foreign_key_check LIMIT 1').get() ||
        validateMigrationHistory(snapshot, migrations) !== oldVersion ||
        owner?.value !== projectId
      )
        throw failure();
    } finally {
      snapshot.close();
    }
    renameSync(pendingPath, snapshotPath);
    return snapshotPath;
  } catch {
    // Only this attempt's temporary file is eligible for cleanup; prior evidence is retained.
    try {
      rmSync(pendingPath, { force: true });
    } catch {
      /* Preserve an inaccessible partial file. */
    }
    throw failure();
  }
}

export function snapshotBeforeMigrations(
  database: Database,
  profileDirectory: string,
  migrations: Migration[],
  keep = 3,
): string | null {
  const oldVersion = validateMigrationHistory(database, migrations);
  if (latestMigrationVersion(migrations) <= oldVersion) return null;

  const snapshotDirectory = path.join(profileDirectory, 'pre-migration');
  mkdirSync(snapshotDirectory, { recursive: true, mode: 0o700 });
  const snapshotPath = path.join(snapshotDirectory, `profile-v${oldVersion}.sqlite`);
  if (!existsSync(snapshotPath)) database.snapshotTo(snapshotPath);

  const snapshots = readdirSync(snapshotDirectory)
    .map((name) => ({ name, version: /^profile-v(\d+)\.sqlite$/.exec(name)?.[1] }))
    .filter((entry): entry is { name: string; version: string } => entry.version !== undefined)
    .sort((left, right) => Number(right.version) - Number(left.version));
  for (const stale of snapshots.slice(Math.max(0, keep))) {
    rmSync(path.join(snapshotDirectory, stale.name), { force: true });
  }
  return snapshotPath;
}

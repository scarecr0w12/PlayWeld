import { existsSync, mkdirSync, readdirSync, rmSync } from 'node:fs';
import path from 'node:path';
import type { Database } from './database';
import { validateMigrationHistory, latestMigrationVersion, type Migration } from './migrator';

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

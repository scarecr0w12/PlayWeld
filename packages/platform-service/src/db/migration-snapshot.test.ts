import { mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { Database } from './database';
import { currentMigrationVersion, migrate } from './migrator';
import { snapshotBeforeMigrations } from './migration-snapshot';
import { profileMigrations } from '../profile/migrations';

let root: string | undefined;

afterEach(() => {
  if (root) rmSync(root, { recursive: true, force: true });
  root = undefined;
});

describe('profile pre-migration snapshots', () => {
  it('snapshots the old profile before migration and keeps the three newest versions', () => {
    root = mkdtempSync(path.join(tmpdir(), 'gc-profile-migration-'));
    const profilePath = path.join(root, 'profile.sqlite');
    const database = Database.open(profilePath);
    try {
      migrate(database, profileMigrations.slice(0, 1));
      database.prepare('INSERT INTO service_meta (key, value) VALUES (?, ?)').run('owner', 'Mira');
      const firstSnapshot = snapshotBeforeMigrations(database, root, profileMigrations.slice(0, 2));
      expect(firstSnapshot).toBe(path.join(root, 'pre-migration', 'profile-v1.sqlite'));

      const oldProfile = Database.open(firstSnapshot!);
      try {
        expect(currentMigrationVersion(oldProfile)).toBe(1);
        expect(
          oldProfile
            .prepare('SELECT value FROM service_meta WHERE key = ?')
            .get<{ value: string }>('owner')?.value,
        ).toBe('Mira');
      } finally {
        oldProfile.close();
      }

      for (let version = 2; version <= 5; version += 1) {
        migrate(database, profileMigrations.slice(0, version - 1));
        snapshotBeforeMigrations(database, root, profileMigrations.slice(0, version));
      }
      const snapshots = readdirSync(path.join(root, 'pre-migration')).sort();
      expect(snapshots).toEqual(['profile-v2.sqlite', 'profile-v3.sqlite', 'profile-v4.sqlite']);
    } finally {
      database.close();
    }
  });

  it('does not create or prune snapshots for incompatible migration history', () => {
    root = mkdtempSync(path.join(tmpdir(), 'gc-incompatible-migration-'));
    const database = Database.open(path.join(root, 'profile.sqlite'));
    try {
      migrate(database, profileMigrations.slice(0, 1));
      database
        .prepare('INSERT INTO schema_migrations VALUES (?, ?, ?)')
        .run(3, 'unrecognized', 'later');
      const folder = path.join(root, 'pre-migration');
      mkdirSync(folder);
      for (let index = 0; index < 4; index++)
        writeFileSync(path.join(folder, `profile-v${index}.sqlite`), 'retained evidence');
      const before = readdirSync(folder).sort();
      expect(() => snapshotBeforeMigrations(database, root!, profileMigrations)).toThrow(
        /migration history/i,
      );
      expect(readdirSync(folder).sort()).toEqual(before);
      for (const file of before)
        expect(readFileSync(path.join(folder, file), 'utf8')).toBe('retained evidence');
    } finally {
      database.close();
    }
  });
});

import { existsSync, mkdtempSync, readFileSync, renameSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { expect, it } from 'vitest';
import { Database } from './database';
import { migrate } from './migrator';
import { profileMigrations } from '../profile/migrations';
import { PlatformService } from '../service';
import { resolvePaths } from '../paths';

it('refuses a future profile without modifying its data, pruning evidence or leaking its handle', async () => {
  const root = mkdtempSync(path.join(tmpdir(), 'gc-future-profile-'));
  const paths = resolvePaths({ GAMECRAFTER_PROFILE_DIR: root });
  const database = Database.open(paths.profileDbPath);
  migrate(database, profileMigrations);
  database.prepare('INSERT INTO service_meta VALUES (?, ?)').run('authored', 'retained fixture');
  database
    .prepare('INSERT INTO schema_migrations VALUES (?, ?, ?)')
    .run(99, 'future-version', 'later');
  database.close();
  const before = readFileSync(paths.profileDbPath);
  let service: PlatformService | undefined;
  try {
    await expect(
      PlatformService.start({ paths, platformVersion: '0.22.0' }).then((value) => {
        service = value;
        return value;
      }),
    ).rejects.toThrow(/newer.*compatible/i);
    expect(readFileSync(paths.profileDbPath)).toEqual(before);
    expect(existsSync(path.join(root, 'pre-migration'))).toBe(false);
    // Windows cannot rename this database if the failed bootstrap leaves its handle open.
    const retained = path.join(root, 'preserved.sqlite');
    renameSync(paths.profileDbPath, retained);
    expect(readFileSync(retained)).toEqual(before);
  } finally {
    await service?.stop();
    rmSync(root, { recursive: true, force: true });
  }
});

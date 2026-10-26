import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  renameSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { afterEach, expect, it, vi } from 'vitest';
import { uuidv7 } from '@gamecrafter/contracts';
import { Database } from '../db/database';
import { currentMigrationVersion, migrate } from '../db/migrator';
import { profileMigrations } from '../profile/migrations';
import { ProfileStore } from '../profile/profile-store';
import { projectMigrations } from './migrations';
import { ProjectDatabases } from './project-databases';

let root: string | undefined;
let profileDatabase: Database | undefined;
let databases: ProjectDatabases | undefined;
afterEach(() => {
  vi.restoreAllMocks();
  databases?.close();
  profileDatabase?.close();
  if (root) rmSync(root, { recursive: true, force: true });
  databases = undefined;
  profileDatabase = undefined;
  root = undefined;
});

function fixture(version = projectMigrations.length - 1) {
  root = mkdtempSync(path.join(tmpdir(), 'gc-project-upgrade-'));
  const projectId = uuidv7();
  const projectPath = path.join(root, 'project');
  const statePath = path.join(projectPath, '.gamecrafter');
  mkdirSync(statePath, { recursive: true });
  writeFileSync(path.join(projectPath, 'gamecrafter.project.json'), '{}');
  profileDatabase = Database.open(':memory:');
  migrate(profileDatabase, profileMigrations);
  const profile = new ProfileStore(profileDatabase);
  profile.register({
    schemaVersion: 1,
    projectId,
    path: projectPath,
    name: 'Upgrade fixture',
    engine: { family: 'godot' },
    createdAt: new Date().toISOString(),
    lastOpenedAt: null,
    trusted: true,
  });
  const databasePath = path.join(statePath, 'project.sqlite');
  const database = Database.open(databasePath);
  migrate(database, projectMigrations.slice(0, version));
  if (version > 0)
    database.prepare('INSERT INTO project_meta VALUES (?, ?)').run('project_id', projectId);
  if (version > 0)
    database
      .prepare('INSERT INTO project_meta VALUES (?, ?)')
      .run('authored', 'retained recovery sentinel');
  database.close();
  databases = new ProjectDatabases(profile);
  return { projectId, projectPath, statePath, databasePath };
}

it('preserves a verified old-schema Project snapshot before upgrading', () => {
  const { projectId, projectPath, statePath, databasePath } = fixture();
  execFileSync('git', ['init', '-b', 'main'], {
    cwd: projectPath,
    windowsHide: true,
    stdio: 'ignore',
  });
  const source = Database.open(databasePath);
  source
    .prepare(
      'INSERT INTO events (event_id, seq, kind, occurred_at, actor, payload) VALUES (?, ?, ?, ?, ?, ?)',
    )
    .run(
      uuidv7(),
      1,
      'recovery.fixture',
      '2026-10-26T00:00:00Z',
      '{}',
      JSON.stringify({ retained: 'prior event sentinel' }),
    );
  source.close();
  const current = databases!.get(projectId);
  expect(currentMigrationVersion(current)).toBe(projectMigrations.at(-1)!.id);
  const folder = path.join(statePath, 'pre-migration');
  expect(existsSync(folder)).toBe(true);
  const files = readdirSync(folder).filter((file) => file.endsWith('.sqlite'));
  expect(files).toHaveLength(1);
  expect(files[0]).toMatch(/^project-v13-to-v14-.*\.sqlite$/);
  const snapshot = Database.open(path.join(folder, files[0]!), { readOnly: true });
  try {
    expect(currentMigrationVersion(snapshot)).toBe(13);
    expect(
      snapshot
        .prepare('SELECT value FROM project_meta WHERE key = ?')
        .get<{ value: string }>('authored')?.value,
    ).toBe('retained recovery sentinel');
    expect(
      snapshot
        .prepare('SELECT value FROM project_meta WHERE key = ?')
        .get<{ value: string }>('project_id')?.value,
    ).toBe(projectId);
    expect(snapshot.prepare('PRAGMA integrity_check').get()).toMatchObject({
      integrity_check: 'ok',
    });
    expect(snapshot.prepare('SELECT kind, payload FROM events WHERE seq = 1').get()).toMatchObject({
      kind: 'recovery.fixture',
      payload: JSON.stringify({ retained: 'prior event sentinel' }),
    });
  } finally {
    snapshot.close();
  }
  expect(databases!.get(projectId)).toBe(current);
  expect(
    execFileSync('git', ['check-ignore', path.join(folder, files[0]!)], {
      cwd: projectPath,
      windowsHide: true,
      encoding: 'utf8',
    }).trim(),
  ).toBeTruthy();
  expect(readdirSync(folder).filter((file) => file.endsWith('.sqlite'))).toEqual(files);
});

it('does not upgrade when the recovery snapshot cannot be created', () => {
  const { projectId, statePath, databasePath } = fixture();
  writeFileSync(path.join(statePath, 'pre-migration'), 'retained obstruction');
  const before = readFileSync(databasePath);
  expect(() => databases!.get(projectId)).toThrow(/snapshot|upgrade/i);
  expect(readFileSync(databasePath)).toEqual(before);
  const retained = path.join(statePath, 'retained-original.sqlite');
  renameSync(databasePath, retained);
  expect(readFileSync(retained)).toEqual(before);
});

it.each([0, projectMigrations.length])(
  'does not snapshot a new or current Project at version %i',
  (version) => {
    const { projectId, statePath } = fixture(version);
    expect(currentMigrationVersion(databases!.get(projectId))).toBe(14);
    expect(existsSync(path.join(statePath, 'pre-migration'))).toBe(false);
  },
);

it('retains the recovery snapshot after a failed migration and takes fresh evidence on retry', () => {
  const { projectId, statePath, databasePath } = fixture();
  const block = Database.open(databasePath);
  block.exec('CREATE TABLE plugin_settings_versions (blocker TEXT)');
  block.close();
  expect(() => databases!.get(projectId)).toThrow(/already exists/);
  const folder = path.join(statePath, 'pre-migration');
  const first = readdirSync(folder).find((file) => file.endsWith('.sqlite'))!;
  const firstBytes = readFileSync(path.join(folder, first));
  const retry = Database.open(databasePath);
  try {
    expect(currentMigrationVersion(retry)).toBe(13);
    retry.exec('DROP TABLE plugin_settings_versions');
    retry
      .prepare('UPDATE project_meta SET value = ? WHERE key = ?')
      .run('updated before retry', 'authored');
  } finally {
    retry.close();
  }
  expect(currentMigrationVersion(databases!.get(projectId))).toBe(14);
  const files = readdirSync(folder).filter((file) => file.endsWith('.sqlite'));
  expect(files).toHaveLength(2);
  expect(readFileSync(path.join(folder, first))).toEqual(firstBytes);
  const latest = Database.open(
    path.join(
      folder,
      files.find((file) => file !== first)!,
    ),
    { readOnly: true },
  );
  try {
    expect(currentMigrationVersion(latest)).toBe(13);
    expect(
      latest
        .prepare('SELECT value FROM project_meta WHERE key = ?')
        .get<{ value: string }>('authored')?.value,
    ).toBe('updated before retry');
  } finally {
    latest.close();
  }
});

it('blocks a damaged snapshot, cleans only its partial file and retains earlier evidence', () => {
  const { projectId, statePath, databasePath } = fixture();
  const folder = path.join(statePath, 'pre-migration');
  mkdirSync(folder);
  writeFileSync(path.join(folder, 'retained.sqlite'), 'prior recovery evidence');
  const before = readFileSync(databasePath);
  vi.spyOn(Database.prototype, 'snapshotTo').mockImplementation((destination) =>
    writeFileSync(destination, 'not a database'),
  );
  expect(() => databases!.get(projectId)).toThrow(/snapshot could not be verified/);
  expect(readFileSync(databasePath)).toEqual(before);
  expect(readdirSync(folder)).toEqual(['.gitignore', 'retained.sqlite']);
  expect(readFileSync(path.join(folder, 'retained.sqlite'), 'utf8')).toBe(
    'prior recovery evidence',
  );
});

it('rejects an incompatible Project before creating snapshot files', () => {
  const { projectId, statePath, databasePath } = fixture();
  const database = Database.open(databasePath);
  database.prepare('INSERT INTO schema_migrations VALUES (?, ?, ?)').run(99, 'future', 'later');
  database.close();
  const before = readFileSync(databasePath);
  expect(() => databases!.get(projectId)).toThrow(/newer/);
  expect(readFileSync(databasePath)).toEqual(before);
  expect(existsSync(path.join(statePath, 'pre-migration'))).toBe(false);
});

it('rejects a snapshot with foreign-key violations before any migration', () => {
  const { projectId, statePath, databasePath } = fixture();
  const source = Database.open(databasePath);
  source.exec('PRAGMA foreign_keys=OFF');
  source
    .prepare('INSERT INTO chat_messages VALUES (?, ?, ?, ?, ?)')
    .run(uuidv7(), 'missing-conversation', projectId, '2026-10-26T00:00:00Z', '{}');
  source.close();
  const before = readFileSync(databasePath);
  expect(() => databases!.get(projectId)).toThrow(/snapshot could not be verified/);
  expect(readFileSync(databasePath)).toEqual(before);
  expect(readdirSync(path.join(statePath, 'pre-migration'))).toEqual(['.gitignore']);
});

it('rejects the wrong Project identity without publishing recovery files', () => {
  const { projectId, statePath, databasePath } = fixture();
  const source = Database.open(databasePath);
  source.prepare('UPDATE project_meta SET value = ? WHERE key = ?').run(uuidv7(), 'project_id');
  source.close();
  const before = readFileSync(databasePath);
  expect(() => databases!.get(projectId)).toThrow(/snapshot could not be verified/);
  expect(readFileSync(databasePath)).toEqual(before);
  expect(existsSync(path.join(statePath, 'pre-migration'))).toBe(false);
});

it('captures committed WAL data in the independently readable recovery file', () => {
  const { projectId, statePath, databasePath } = fixture();
  const writer = Database.open(databasePath);
  try {
    writer
      .prepare('UPDATE project_meta SET value = ? WHERE key = ?')
      .run('committed WAL sentinel', 'authored');
    expect(existsSync(`${databasePath}-wal`)).toBe(true);
    databases!.get(projectId);
    const folder = path.join(statePath, 'pre-migration');
    const file = readdirSync(folder).find((file) => file.endsWith('.sqlite'))!;
    const snapshot = Database.open(path.join(folder, file), { readOnly: true });
    try {
      expect(
        snapshot
          .prepare('SELECT value FROM project_meta WHERE key = ?')
          .get<{ value: string }>('authored')?.value,
      ).toBe('committed WAL sentinel');
      expect(currentMigrationVersion(snapshot)).toBe(13);
    } finally {
      snapshot.close();
    }
  } finally {
    writer.close();
  }
});

it('does not follow a redirected snapshot directory', () => {
  const { projectId, statePath } = fixture();
  const outside = path.join(root!, 'outside-recovery');
  mkdirSync(outside);
  writeFileSync(path.join(outside, 'retained'), 'outside sentinel');
  symlinkSync(
    outside,
    path.join(statePath, 'pre-migration'),
    process.platform === 'win32' ? 'junction' : 'dir',
  );
  expect(() => databases!.get(projectId)).toThrow(/snapshot could not be verified/);
  expect(readdirSync(outside)).toEqual(['retained']);
  expect(readFileSync(path.join(outside, 'retained'), 'utf8')).toBe('outside sentinel');
});

it('preserves conflicting recovery ignore rules and blocks the upgrade', () => {
  const { projectId, statePath, databasePath } = fixture();
  const folder = path.join(statePath, 'pre-migration');
  mkdirSync(folder);
  writeFileSync(path.join(folder, '.gitignore'), '*\n!*.sqlite\n');
  const before = readFileSync(databasePath);
  expect(() => databases!.get(projectId)).toThrow(/snapshot could not be verified/);
  expect(readFileSync(databasePath)).toEqual(before);
  expect(readFileSync(path.join(folder, '.gitignore'), 'utf8')).toBe('*\n!*.sqlite\n');
  expect(readdirSync(folder)).toEqual(['.gitignore']);
});

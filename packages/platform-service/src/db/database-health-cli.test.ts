import { spawnSync } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, expect, it } from 'vitest';
import { Database } from './database';
import { migrate } from './migrator';
import { profileMigrations } from '../profile/migrations';

const directories: string[] = [];
afterEach(() => {
  for (const directory of directories.splice(0))
    rmSync(directory, { recursive: true, force: true });
});

function fixture() {
  const root = mkdtempSync(path.join(tmpdir(), 'gc-doctor-cli-'));
  directories.push(root);
  const file = path.join(root, 'profile.sqlite');
  const invoke = (...args: string[]) =>
    spawnSync(process.execPath, [path.resolve(__dirname, '../../lib/cli.js'), 'doctor', ...args], {
      encoding: 'utf8',
      timeout: 10000,
      windowsHide: true,
      env: { ...process.env, GAMECRAFTER_PROFILE_DIR: path.join(root, 'unused-profile') },
    });
  return { root, file, invoke };
}

it('diagnoses the explicitly selected profile without starting or writing a service profile', () => {
  const { root, file, invoke } = fixture();
  const database = Database.open(file);
  migrate(database, profileMigrations);
  database
    .prepare('INSERT INTO service_meta VALUES (?, ?)')
    .run('private', 'fixture-private-value');
  database.close();
  const before = readFileSync(file);
  const result = invoke('--database', file, '--kind', 'profile');
  expect(result.status).toBe(0);
  expect(JSON.parse(result.stdout)).toMatchObject({
    schemaVersion: 1,
    kind: 'profile',
    status: 'healthy',
    readOnly: true,
  });
  expect(result.stdout).not.toContain('fixture-private-value');
  expect(readFileSync(file)).toEqual(before);
  expect(existsSync(path.join(root, 'unused-profile'))).toBe(false);
});

it('reports corruption without returning database contents or replacing the file', () => {
  const { file, invoke } = fixture();
  writeFileSync(file, 'fixture-private-corrupt-content');
  const before = readFileSync(file);
  const result = invoke('--kind', 'profile', '--database', file);
  expect(result.status).toBe(1);
  expect(JSON.parse(result.stdout)).toMatchObject({ status: 'corrupt' });
  expect(result.stdout).not.toContain('fixture-private-corrupt-content');
  expect(readFileSync(file)).toEqual(before);
});

it('reports missing databases without creating their parent or a new database', () => {
  const { root, invoke } = fixture();
  const file = path.join(root, 'missing', 'project.sqlite');
  const result = invoke('--database', file, '--kind', 'project');
  expect(result.status).toBe(1);
  expect(JSON.parse(result.stdout)).toMatchObject({ status: 'missing' });
  expect(existsSync(path.dirname(file))).toBe(false);
});

it.each([
  [],
  ['--database', 'relative.sqlite', '--kind', 'profile'],
  ['--database', '/not-opened.sqlite', '--kind', 'unknown'],
  ['--database', '/not-opened.sqlite', '--kind', 'profile', '--repair'],
  ['--kind', 'profile', '--kind', 'project'],
])('rejects invalid doctor arguments %j without diagnosing an implicit profile', (...args) => {
  const { root, invoke } = fixture();
  const result = invoke(...args);
  expect(result.status).toBe(2);
  expect(result.stdout).toBe('');
  expect(result.stderr).toContain('doctor --database');
  expect(existsSync(path.join(root, 'unused-profile'))).toBe(false);
});

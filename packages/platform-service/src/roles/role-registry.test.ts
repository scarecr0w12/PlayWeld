import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { uuidv7 } from '@gamecrafter/contracts';
import { Database } from '../db/database';
import { migrate } from '../db/migrator';
import { profileMigrations } from '../profile/migrations';
import { ProfileStore } from '../profile/profile-store';
import { summaryFromManifest } from '../projects/workspace';
import { RoleRegistry } from './role-registry';

const directories: string[] = [];

function writeRole(root: string, name: string, description: string, maxAccess = 'restricted') {
  const directory = path.join(root, name);
  mkdirSync(directory, { recursive: true });
  writeFileSync(
    path.join(directory, 'ROLE.md'),
    `---\nname: ${name}\ndescription: ${description}\nwork-types: code\nmax-access: ${maxAccess}\n---\nProject role prompt.\n`,
  );
  return directory;
}

afterEach(() => {
  for (const directory of directories.splice(0))
    rmSync(directory, { recursive: true, force: true });
});

describe('RoleRegistry', () => {
  it('loads the built-in role set and merges project over profile over built-in', () => {
    const root = mkdtempSync(path.join(tmpdir(), 'gc-role-registry-'));
    directories.push(root);
    const profileDir = path.join(root, 'profile');
    const projectPath = path.join(root, 'project');
    const builtinRolesDir = path.join(process.cwd(), 'roles');
    for (const directory of [profileDir, projectPath]) mkdirSync(directory, { recursive: true });
    const projectId = uuidv7();
    const manifest = {
      schemaVersion: 1,
      projectId,
      name: 'Role Project',
      description: '',
      engine: { family: 'godot' },
      genres: [],
      modules: [],
      createdAt: '2026-09-28T00:00:00.000Z',
      createdByPlatformVersion: '0.1.0',
    };
    writeFileSync(path.join(projectPath, 'gamecrafter.project.json'), JSON.stringify(manifest));
    const database = Database.open(':memory:');
    try {
      migrate(database, profileMigrations);
      const profile = new ProfileStore(database);
      profile.register(summaryFromManifest(manifest, projectPath, null, true));
      writeRole(
        path.join(profileDir, 'roles'),
        'engine-engineer',
        'Profile engine engineer.',
        'full',
      );
      writeRole(
        path.join(projectPath, '.gamecrafter', 'roles'),
        'engine-engineer',
        'Project engine engineer.',
        'restricted',
      );
      const registry = new RoleRegistry({ profile, profileDir, builtinRolesDir });
      const builtins = registry.list();
      expect(builtins.map((role) => role.name).sort()).toEqual([
        'asset-producer',
        'board-maintainer',
        'coordinator',
        'engine-engineer',
        'explorer',
        'game-designer',
        'gameplay-engineer',
        'narrative-designer',
        'planner',
        'reviewer',
        'validator',
      ]);
      expect(registry.get('engine-engineer')?.scope).toBe('platform');
      expect(registry.get('coordinator').tools).toContain('a2a/*');
      expect(registry.get('explorer').tools).not.toContain('a2a/*');
      expect(registry.get('engine-engineer', projectId)).toMatchObject({
        scope: 'project',
        description: 'Project engine engineer.',
      });
      expect(
        registry.list(projectId).filter((role) => role.name === 'engine-engineer'),
      ).toHaveLength(1);
    } finally {
      database.close();
    }
  });

  it('loads plugin roles through the restricted plugin role loader', () => {
    const root = mkdtempSync(path.join(tmpdir(), 'gc-plugin-role-registry-'));
    directories.push(root);
    const profileDir = path.join(root, 'profile');
    mkdirSync(profileDir, { recursive: true });
    const database = Database.open(':memory:');
    try {
      migrate(database, profileMigrations);
      const profile = new ProfileStore(database);
      const pluginRole = writeRole(
        path.join(root, 'plugin'),
        'plugin-designer',
        'Plugin role.',
        'full',
      );
      const registry = new RoleRegistry({
        profile,
        profileDir,
        builtinRolesDir: path.join(root, 'missing-builtins'),
        pluginRoleDirectories: () => [{ pluginId: 'example.plugin', directory: pluginRole }],
      });
      expect(() => registry.list()).toThrow('Plugin roles cannot set max-access: full.');
    } finally {
      database.close();
    }
  });
});

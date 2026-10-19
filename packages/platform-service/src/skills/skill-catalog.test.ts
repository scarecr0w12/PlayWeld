import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { uuidv7, type EffectiveSetting } from '@gamecrafter/contracts';
import { Database } from '../db/database';
import { migrate } from '../db/migrator';
import { profileMigrations } from '../profile/migrations';
import { ProfileStore } from '../profile/profile-store';
import { ProjectDatabases } from '../projects/project-databases';
import { ProjectWorkspace, summaryFromManifest } from '../projects/workspace';
import type { SettingsService } from '../settings/settings-service';
import { SkillInstaller } from './skill-installer';
import { SkillRegistry } from './skill-registry';
import { SkillCatalog } from './skill-catalog';
import { SkillService } from './skill-service';
import { RoleRegistry } from '../roles/role-registry';
import { TaskService } from '../tasks/task-service';
import { HandlerRegistry } from '../workers/handler-registry';

const directories: string[] = [];

function writeSkill(root: string, name: string, description: string, capabilities: string) {
  const directory = path.join(root, name);
  mkdirSync(directory, { recursive: true });
  writeFileSync(
    path.join(directory, 'SKILL.md'),
    `---\nname: ${name}\ndescription: ${description}\nmetadata:\n  gamecrafter-engines: godot\n  gamecrafter-genres: rpg\n  gamecrafter-work-types: code\n  gamecrafter-roles: engine-engineer\n  gamecrafter-capabilities: ${capabilities}\n---\nInstructions for ${name}.\n`,
  );
}

function makeFixture() {
  const root = mkdtempSync(path.join(tmpdir(), 'gc-skill-catalog-'));
  directories.push(root);
  const profileDir = path.join(root, 'profile');
  const projectPath = path.join(root, 'project');
  mkdirSync(profileDir, { recursive: true });
  mkdirSync(path.join(projectPath, '.gamecrafter'), { recursive: true });
  const projectId = uuidv7();
  const manifest = {
    schemaVersion: 1,
    projectId,
    name: 'Catalog Project',
    description: '',
    engine: { family: 'godot' },
    genres: ['rpg'],
    modules: [],
    createdAt: '2026-09-28T00:00:00.000Z',
    createdByPlatformVersion: '0.1.0',
  };
  writeFileSync(path.join(projectPath, 'gamecrafter.project.json'), JSON.stringify(manifest));
  const profileDatabase = Database.open(':memory:');
  migrate(profileDatabase, profileMigrations);
  const profile = new ProfileStore(profileDatabase);
  profile.register(summaryFromManifest(manifest, projectPath, null, true));
  const workspace = new ProjectWorkspace({ profile, platformVersion: '0.1.0' });
  const projectDatabases = new ProjectDatabases(profile);
  const projectDatabase = projectDatabases.get(projectId);
  const values: Record<string, unknown> = {
    'skills.catalog.maxEntries': 5,
    'access.mode': 'ask-always',
    'access.restricted.allowedSideEffects': ['none', 'workspace-write'],
    'access.restricted.allowedTools': [],
  };
  const settings = {
    resolve(key: string): EffectiveSetting {
      const value = values[key];
      return { key, value, source: 'default', layers: { default: value } } as EffectiveSetting;
    },
  } as Pick<SettingsService, 'resolve'>;
  const installer = new SkillInstaller(profileDatabase, profileDir, settings);
  const registry = new SkillRegistry({
    profile,
    projectDatabases,
    installer,
    settings,
    homeDir: path.join(root, 'home'),
  });
  const catalog = new SkillCatalog({ registry, workspace, projectDatabases, settings });
  return {
    root,
    projectId,
    projectPath,
    workspace,
    projectDatabase,
    profileDatabase,
    projectDatabases,
    profile,
    registry,
    installer,
    catalog,
    values,
    settings,
    profileDir,
    close() {
      projectDatabases.close();
      profileDatabase.close();
    },
  };
}

afterEach(() => {
  for (const directory of directories.splice(0))
    rmSync(directory, { recursive: true, force: true });
});

describe('skill catalog', () => {
  it('uses the agent role semantic work type consistently for search, activation and resource reads', async () => {
    const fixture = makeFixture();
    try {
      const source = path.join(fixture.root, 'skills');
      writeSkill(source, 'scene-audit', 'Audit a Godot scene hierarchy.', 'fs.read:project');
      mkdirSync(path.join(source, 'scene-audit', 'references'));
      writeFileSync(path.join(source, 'scene-audit', 'references', 'guide.md'), 'Audit guide.');
      await fixture.installer.install(source, 'scene-audit');
      fixture.registry.enable(fixture.projectId, { name: 'scene-audit', enabled: true });
      const rolesRoot = path.join(fixture.projectPath, '.gamecrafter', 'roles', 'engine-engineer');
      mkdirSync(rolesRoot, { recursive: true });
      writeFileSync(
        path.join(rolesRoot, 'ROLE.md'),
        '---\nname: engine-engineer\ndescription: Code role.\nwork-types: code\nmax-access: restricted\n---\nAudit code.\n',
      );
      const roles = new RoleRegistry({ profile: fixture.profile, profileDir: fixture.profileDir });
      const handlers = new HandlerRegistry();
      handlers.register('agent.run', { module: path.join(fixture.root, 'unused.js') });
      handlers.register('noop.tool', { module: path.join(fixture.root, 'unused.js') });
      const tasks = new TaskService(
        fixture.profile,
        fixture.projectDatabases,
        fixture.settings as SettingsService,
        handlers,
        { taskChanged() {}, taskEvent() {}, taskQuestion() {} },
      );
      tasks.setRoleResolver((name, projectId) => roles.get(name, projectId));
      const task = tasks.create(
        {
          projectId: fixture.projectId,
          kind: 'agent.run',
          role: 'engine-engineer',
          title: 'Audit scene',
          goal: 'Audit scene hierarchy',
        },
        { deferStart: true },
      ).task;
      const service = new SkillService(
        fixture.installer,
        fixture.registry,
        fixture.catalog,
        roles,
        tasks,
        fixture.settings as SettingsService,
      );
      expect(
        service.searchForTask(fixture.projectId, 'scene', task.taskId).map((entry) => entry.name),
      ).toContain('scene-audit');
      await expect(
        service.activate(fixture.projectId, 'scene-audit', task.taskId),
      ).resolves.toBeDefined();
      expect(
        service.readResource({
          projectId: fixture.projectId,
          name: 'scene-audit',
          taskId: task.taskId,
          resource: 'references/guide.md',
        }),
      ).toBeDefined();
      const ordinary = tasks.create(
        {
          projectId: fixture.projectId,
          kind: 'noop.tool',
          assignee: { role: 'engine-engineer' },
          title: 'Other task',
          goal: 'Other task',
        },
        { deferStart: true },
      ).task;
      expect(service.searchForTask(fixture.projectId, 'scene', ordinary.taskId)).toEqual([]);
    } finally {
      fixture.close();
    }
  });
  it('filters role, work type, engine, genre, and restricted capabilities before lexical ranking', async () => {
    const fixture = makeFixture();
    try {
      expect(fixture.workspace.get(fixture.projectId)).toMatchObject({
        engine: { family: 'godot' },
        genres: ['rpg'],
        trusted: true,
      });
      const source = path.join(fixture.root, 'skills');
      writeSkill(
        source,
        'scene-audit',
        'Audit a Godot scene hierarchy for broken nodes.',
        'fs.read:project',
      );
      writeSkill(
        source,
        'quest-dialogue',
        'Write quest narrative dialogue and character voices.',
        'fs.read:project',
      );
      writeSkill(source, 'asset-check', 'Review the asset import checklist.', 'fs.read:project');
      writeSkill(source, 'canon-check', 'Review project canon references.', 'fs.read:project');
      writeSkill(source, 'engine-check', 'Review engine integration settings.', 'fs.read:project');
      writeSkill(source, 'loop-check', 'Review the main game loop.', 'fs.read:project');
      writeSkill(
        source,
        'process-check',
        'Run a process-based validation suite.',
        'process.spawn:godot',
      );
      for (const name of [
        'scene-audit',
        'quest-dialogue',
        'asset-check',
        'canon-check',
        'engine-check',
        'loop-check',
        'process-check',
      ]) {
        await fixture.installer.install(source, name);
        fixture.registry.enable(fixture.projectId, { name, enabled: true });
      }
      const registryEntries = fixture.registry.listForProject(fixture.projectId);
      expect(registryEntries.map((entry) => entry.name).sort()).toEqual([
        'asset-check',
        'canon-check',
        'engine-check',
        'loop-check',
        'process-check',
        'quest-dialogue',
        'scene-audit',
      ]);
      expect(registryEntries.find((entry) => entry.name === 'scene-audit')).toMatchObject({
        enablement: { enabled: true },
        platform: {
          engines: ['godot'],
          genres: ['rpg'],
          workTypes: ['code'],
          roles: ['engine-engineer'],
        },
      });

      const unrestricted = fixture.catalog.catalog({
        projectId: fixture.projectId,
        agentRole: 'engine-engineer',
        workType: 'code',
        accessMode: 'full',
      });
      expect(unrestricted.entries.map((entry) => entry.name)).toContain('process-check');
      expect(unrestricted.entries).toHaveLength(5);
      expect(unrestricted.truncated).toBe(true);
      const approvalModeEntries = fixture.catalog.catalog({
        projectId: fixture.projectId,
        agentRole: 'engine-engineer',
        workType: 'code',
        taskText: 'process validation suite',
        accessMode: 'ask-always',
      }).entries;
      expect(approvalModeEntries.map((entry) => entry.name)).toContain('process-check');

      const catalog = fixture.catalog.catalog({
        projectId: fixture.projectId,
        agentRole: 'engine-engineer',
        workType: 'code',
        taskText: 'quest dialogue narrative',
        accessMode: 'restricted',
      });
      expect(catalog.entries[0]?.name).toBe('quest-dialogue');
      expect(catalog.entries).toHaveLength(5);
      const sceneMatch = fixture.catalog.catalog({
        projectId: fixture.projectId,
        agentRole: 'engine-engineer',
        workType: 'code',
        taskText: 'audit scene hierarchy',
        accessMode: 'restricted',
      });
      expect(sceneMatch.entries[0]?.name).toBe('scene-audit');
      expect(catalog.entries[0]?.score).toBeGreaterThan(catalog.entries[1]?.score ?? 0);
      expect(catalog.truncated).toBe(true);

      expect(
        fixture.catalog.catalog({
          projectId: fixture.projectId,
          agentRole: 'narrative-designer',
          workType: 'code',
          accessMode: 'full',
        }).entries,
      ).toEqual([]);
      expect(
        fixture.catalog.catalog({
          projectId: fixture.projectId,
          agentRole: 'engine-engineer',
          workType: 'narrative',
          accessMode: 'full',
        }).entries,
      ).toEqual([]);
      expect(
        fixture.catalog
          .catalog({
            projectId: fixture.projectId,
            agentRole: 'engine-engineer',
            workType: 'code',
            accessMode: 'ask-always',
          })
          .entries.map((entry) => entry.name),
      ).toContain('process-check');
    } finally {
      fixture.close();
    }
  });
});

import { mkdirSync, mkdtempSync, rmSync, writeFileSync, readFileSync, renameSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import {
  projectManifest,
  RpcError,
  RpcErrorCode,
  uuidv7,
  type PluginManifest,
} from '@gamecrafter/contracts';
import { Database } from '../db/database';
import { migrate } from '../db/migrator';
import { profileMigrations } from '../profile/migrations';
import { ProfileStore } from '../profile/profile-store';
import { projectMigrations } from '../projects/migrations';
import { ProjectDatabases } from '../projects/project-databases';
import { summaryFromManifest } from '../projects/workspace';
import { createBuiltinSettings } from './definitions';
import { SettingsRegistry } from './registry';
import { SettingsService } from './settings-service';

interface Fixture {
  directory: string;
  projectId: string;
  sessionId: string;
  database: Database;
  projectDatabases: ProjectDatabases;
  registry: SettingsRegistry;
  service: SettingsService;
}

const fixtures: Fixture[] = [];

afterEach(() => {
  for (const fixture of fixtures.splice(0)) {
    fixture.projectDatabases.close();
    fixture.database.close();
    rmSync(fixture.directory, { recursive: true, force: true });
  }
});

describe('SettingsService', () => {
  it('protects another plugin whose dotted ID shares the textual namespace prefix', () => {
    const f = createFixture();
    const first = pluginSettingsManifest();
    f.service.activatePluginSettings(first);
    const child = structuredClone(first);
    child.id = `${first.id}.child`;
    child.contributes.settings[0]!.key = `plugin.${child.id}.value`;
    child.contributes.settings[0]!.source = `plugin:${child.id}`;
    f.service.activatePluginSettings(child);
    const childKey = child.contributes.settings[0]!.key;
    f.service.set(childKey, 'platform', 'protected');
    expect(f.service.getPluginSettings(first.id).some((setting) => setting.key === childKey)).toBe(
      false,
    );
    expect(
      f.service.getPluginSettings(child.id).find((setting) => setting.key === childKey)?.value,
    ).toBe('protected');
    const next = structuredClone(first);
    next.version = '2.0.0';
    next.migrations = [
      {
        from: first.version,
        to: next.version,
        description: 'Cannot remove child settings',
        operations: [{ kind: 'remove', key: childKey }],
      },
    ];
    expect(() => f.service.preparePluginUpgrade(first, next, [])).toThrow('own plugin');
    next.migrations = [];
    applyPluginUpgrade(f, first, next);
    expect(f.service.resolve(childKey).value).toBe('protected');
    f.service.unregisterSource(`plugin:${first.id}`, [f.projectId]);
    expect(f.service.resolve(childKey).value).toBe('protected');
  });

  it('uses package-declared migrations for a restored Project without profile migration history', () => {
    const f = createFixture();
    const first = pluginSettingsManifest();
    f.service.activatePluginSettings(first);
    const oldKey = first.contributes.settings[0]!.key;
    f.service.set(oldKey, 'project', 'restored', { projectId: f.projectId });
    const next = structuredClone(first);
    next.version = '2.0.0';
    next.contributes.settings[0]!.key = 'plugin.sample-hello.restored';
    next.migrations = [
      {
        from: first.version,
        to: next.version,
        description: 'Restorable rename',
        operations: [{ kind: 'rename', from: oldKey, to: next.contributes.settings[0]!.key }],
      },
    ];
    applyPluginUpgrade(f, first, next);
    f.database.exec('DELETE FROM plugin_settings_upgrades');
    expect(
      f.service.resolve(next.contributes.settings[0]!.key, { projectId: f.projectId }).value,
    ).toBe('restored');
  });

  it('replays skipped upgrades lazily and exactly once for an unavailable Project, with nonmutating import preview', () => {
    const f = createFixture();
    const first = pluginSettingsManifest();
    f.service.activatePluginSettings(first);
    const oldKey = first.contributes.settings[0]!.key;
    const newKey = 'plugin.sample-hello.salutation';
    f.service.set(oldKey, 'project', 'Hola', { projectId: f.projectId });
    const projectPath = path.join(f.directory, 'project');
    const file = path.join(projectPath, 'gamecrafter.project.json');
    f.projectDatabases.close();
    renameSync(file, `${file}.offline`);
    const second = structuredClone(first);
    second.version = '2.0.0';
    second.contributes.settings[0]!.key = newKey;
    second.migrations = [
      {
        from: first.version,
        to: second.version,
        description: 'Rename',
        operations: [{ kind: 'rename', from: oldKey, to: newKey }],
      },
    ];
    applyPluginUpgrade(f, first, second);
    const third = structuredClone(second);
    third.version = '3.0.0';
    third.migrations = [
      {
        from: second.version,
        to: third.version,
        description: 'New locale value',
        operations: [
          {
            kind: 'map-values',
            key: newKey,
            scopes: ['project'],
            values: [{ from: 'Hola', to: 'Hola-v3' }],
          },
        ],
      },
    ];
    applyPluginUpgrade(f, second, third);
    renameSync(`${file}.offline`, file);
    const db = f.projectDatabases.get(f.projectId);
    const before = () => db.prepare('SELECT key, value FROM settings_overrides').all();
    expect(before()).toEqual([{ key: oldKey, value: '"Hola"' }]);
    const document = {
      schemaVersion: 1 as const,
      exportedAt: new Date().toISOString(),
      projectId: f.projectId,
      settings: [
        {
          key: newKey,
          value: 'imported',
          source: 'project' as const,
          layers: { default: 'Hello', project: 'imported' },
        },
      ],
    };
    f.service.import({ document, scope: 'project', projectId: f.projectId, dryRun: true });
    expect(before()).toEqual([{ key: oldKey, value: '"Hola"' }]);
    const platformDocument = {
      ...document,
      settings: document.settings.map((setting) => ({
        ...setting,
        layers: { default: 'Hello', platform: 'global-import' },
      })),
    };
    f.service.import({ document: platformDocument, scope: 'platform', projectId: f.projectId });
    expect(before()).toEqual([{ key: oldKey, value: '"Hola"' }]);
    expect(f.service.resolve(newKey, { projectId: f.projectId }).value).toBe('Hola-v3');
    expect(f.service.resolve(newKey, { projectId: f.projectId }).value).toBe('Hola-v3');
    expect(
      db.prepare('SELECT version FROM plugin_settings_versions WHERE plugin_id = ?').get(first.id),
    ).toEqual({ version: '3.0.0' });
  });

  it('rejects collisions, invalid values, incomplete chains and foreign namespaces without losing overrides', () => {
    const f = createFixture();
    const first = pluginSettingsManifest();
    const oldKey = first.contributes.settings[0]!.key;
    first.contributes.settings.push({
      ...first.contributes.settings[0]!,
      key: 'plugin.sample-hello.target',
    });
    f.service.activatePluginSettings(first);
    f.service.set(oldKey, 'platform', 'keep');
    f.service.set('plugin.sample-hello.target', 'platform', 'existing');
    const second = structuredClone(first);
    second.version = '2.0.0';
    for (const operations of [
      [{ kind: 'rename' as const, from: oldKey, to: 'plugin.sample-hello.target' }],
      [{ kind: 'map-values' as const, key: oldKey, values: [{ from: 'keep', to: 42 }] }],
      [{ kind: 'remove' as const, key: 'access.mode' }],
    ]) {
      second.migrations = [
        { from: '1.0.0', to: '2.0.0', description: 'Invalid migration', operations },
      ];
      expect(() => f.service.preparePluginUpgrade(first, second, [f.projectId])).toThrow();
      expect(f.service.resolve(oldKey).value).toBe('keep');
      expect(f.service.resolve('plugin.sample-hello.target').value).toBe('existing');
      expect(f.database.prepare('SELECT * FROM plugin_settings_upgrades').all()).toEqual([]);
    }
    second.migrations = [{ from: '0.5.0', to: '2.0.0', description: 'Missing source transition' }];
    expect(() => f.service.preparePluginUpgrade(first, second, [])).toThrow('Migration chain');
  });

  it('rolls back profile overrides and the migration journal if checkpoint persistence fails', () => {
    const f = createFixture();
    const first = pluginSettingsManifest();
    f.service.activatePluginSettings(first);
    const key = first.contributes.settings[0]!.key;
    f.service.set(key, 'platform', 'keep');
    const next = structuredClone(first);
    next.version = '2.0.0';
    next.migrations = [
      {
        from: first.version,
        to: next.version,
        description: 'Convert',
        operations: [{ kind: 'map-values', key, values: [{ from: 'keep', to: 'converted' }] }],
      },
    ];
    const plan = f.service.preparePluginUpgrade(first, next, []);
    f.database.exec(
      "CREATE TRIGGER reject_plugin_checkpoint BEFORE UPDATE ON plugin_settings_versions BEGIN SELECT RAISE(ABORT, 'fixture checkpoint failure'); END",
    );
    expect(() => f.database.transaction(() => f.service.commitPluginUpgrade(next, plan))).toThrow(
      'fixture checkpoint failure',
    );
    expect(f.service.resolve(key).value).toBe('keep');
    expect(f.database.prepare('SELECT * FROM plugin_settings_upgrades').all()).toEqual([]);
  });

  it('requires explicit scope removal and retains unrelated settings when retiring a plugin key', () => {
    const f = createFixture();
    const first = pluginSettingsManifest();
    f.service.activatePluginSettings(first);
    const key = first.contributes.settings[0]!.key;
    f.service.set(key, 'platform', 'global');
    f.service.set(key, 'project', 'local', { projectId: f.projectId });
    f.service.set('access.mode', 'platform', 'restricted');
    const next = structuredClone(first);
    next.version = '2.0.0';
    next.contributes.settings[0]!.scopes = ['platform'];
    expect(() => f.service.preparePluginUpgrade(first, next, [f.projectId])).toThrow(
      'Migrated project',
    );
    next.migrations = [
      {
        from: first.version,
        to: next.version,
        description: 'Retire Project override',
        operations: [{ kind: 'remove', key, scopes: ['project'] }],
      },
    ];
    applyPluginUpgrade(f, first, next);
    expect(f.service.resolve(key, { projectId: f.projectId }).value).toBe('global');
    expect(f.service.resolve('access.mode').value).toBe('restricted');
    f.service.unregisterSource(`plugin:${first.id}`, [f.projectId]);
    expect(f.database.prepare('SELECT * FROM plugin_settings_upgrades').all()).toEqual([]);
  });

  it('previews and atomically imports only the chosen scope while retaining other settings', () => {
    const f = createFixture();
    f.service.set('access.mode', 'platform', 'restricted');
    f.service.set('access.mode', 'project', 'full', { projectId: f.projectId });
    const document = f.service.export({ projectId: f.projectId });
    f.service.set('access.mode', 'platform', null);
    expect(f.service.import({ document, scope: 'platform', dryRun: true }).importedKeys).toEqual([
      'access.mode',
    ]);
    expect(f.service.resolve('access.mode').source).toBe('default');
    f.service.import({ document, scope: 'platform' });
    expect(f.service.resolve('access.mode').value).toBe('restricted');
    expect(f.service.resolve('access.mode', { projectId: f.projectId }).value).toBe('full');
  });

  it('rejects invalid and duplicate imports without applying any earlier valid values', () => {
    const f = createFixture();
    f.service.set('access.mode', 'platform', 'restricted');
    const document = f.service.export();
    f.service.set('access.mode', 'platform', null);
    const entry = document.settings.find((item) => item.key === 'window.closeBehavior')!;
    entry.layers.platform = 'not-valid';
    expect(() => f.service.import({ document, scope: 'platform' })).toThrow();
    expect(f.service.resolve('access.mode').source).toBe('default');
    document.settings.push(document.settings[0]!);
    expect(() => f.service.import({ document, scope: 'platform' })).toThrow();
  });

  it('skips unavailable plugin settings and nested redacted values without overwriting storage', () => {
    const f = createFixture();
    const document = f.service.export();
    document.settings.push({
      key: 'plugin.absent.option',
      value: 1,
      source: 'platform',
      layers: { default: 0, platform: 1 },
    });
    const entry = document.settings.find((item) => item.key === 'access.mode')!;
    entry.layers.platform = '[REDACTED]';
    const result = f.service.import({ document, scope: 'platform' });
    expect(result.skipped).toContainEqual({
      key: 'plugin.absent.option',
      reason: 'unknown-setting',
    });
    expect(result.skipped).toContainEqual({ key: 'access.mode', reason: 'redacted-value' });
    expect(f.service.resolve('access.mode').source).toBe('default');
  });

  it('resolves default, platform, Project, and session layers in precedence order', () => {
    const fixture = createFixture();
    fixture.service.set('access.mode', 'platform', 'restricted');
    fixture.service.set('access.mode', 'project', 'full', { projectId: fixture.projectId });
    fixture.service.set('access.mode', 'session', 'ask-always', { sessionId: fixture.sessionId });

    expect(
      fixture.service.resolve('access.mode', {
        projectId: fixture.projectId,
        sessionId: fixture.sessionId,
      }),
    ).toEqual({
      key: 'access.mode',
      value: 'ask-always',
      source: 'session',
      layers: {
        default: 'ask-always',
        platform: 'restricted',
        project: 'full',
        session: 'ask-always',
      },
    });
  });

  it('clears a null override and falls back to the next available layer', () => {
    const fixture = createFixture();
    fixture.service.set('access.mode', 'platform', 'restricted');
    const inherited = fixture.service.set('access.mode', 'platform', null);

    expect(inherited).toMatchObject({ value: 'ask-always', source: 'default' });
    expect(inherited.layers.platform).toBeUndefined();
  });

  it('rejects scopes that are not allowed for a setting', () => {
    const fixture = createFixture();

    expectRpcError(
      () =>
        fixture.service.set('window.closeBehavior', 'project', 'stop-and-checkpoint', {
          projectId: fixture.projectId,
        }),
      RpcErrorCode.SettingScopeNotAllowed,
    );
  });

  it('rejects values that do not satisfy the setting schema', () => {
    const fixture = createFixture();

    expectRpcError(
      () => fixture.service.set('models.budget.maxCostPerTaskUsd', 'platform', 'five'),
      RpcErrorCode.InvalidSettingValue,
    );
  });

  it('rejects unknown settings and unknown sessions', () => {
    const fixture = createFixture();

    expectRpcError(() => fixture.service.resolve('missing.setting'), RpcErrorCode.UnknownSetting);
    expectRpcError(
      () =>
        fixture.service.set('access.mode', 'session', 'restricted', {
          sessionId: '019535d4-2c00-7000-8000-000000000099',
        }),
      RpcErrorCode.UnknownSession,
    );
  });

  it('exports scoped effective settings with credentials redacted without changing stored values', () => {
    const fixture = createFixture();
    fixture.registry.register(
      'plugin:sample',
      [],
      [
        {
          key: 'plugin.sample.password',
          title: 'Password',
          description: 'Secret.',
          group: 'plugins',
          schema: { type: 'string' },
          default: '',
          scopes: ['project'],
          source: 'plugin:sample',
        },
      ],
    );
    fixture.service.set('plugin.sample.password', 'project', 'short-secret', {
      projectId: fixture.projectId,
    });
    fixture.service.set('access.mode', 'platform', 'restricted');
    const exported = fixture.service.export({
      projectId: fixture.projectId,
      sessionId: fixture.sessionId,
    });
    expect(exported).toMatchObject({ schemaVersion: 1, projectId: fixture.projectId });
    expect(JSON.stringify(exported)).not.toContain('short-secret');
    expect(
      exported.settings.find((setting) => setting.key === 'plugin.sample.password'),
    ).toMatchObject({ value: '[REDACTED]', source: 'project', layers: { project: '[REDACTED]' } });
    expect(exported.settings.find((setting) => setting.key === 'access.mode')?.value).toBe(
      'restricted',
    );
    expect(
      fixture.service.resolve('plugin.sample.password', { projectId: fixture.projectId }).value,
    ).toBe('short-secret');
  });

  it('drops contributed values and definitions when a plugin is uninstalled', () => {
    const fixture = createFixture();
    const definition = {
      key: 'plugin.sample.greeting',
      title: 'Greeting',
      description: 'Plugin setting.',
      group: 'plugins',
      schema: { type: 'string' },
      default: 'Hello',
      scopes: ['platform', 'project', 'session'] as Array<'platform' | 'project' | 'session'>,
      source: 'plugin:sample',
    };
    fixture.registry.register('plugin:sample', [], [definition]);
    fixture.service.set(definition.key, 'platform', 'Platform greeting');
    fixture.service.set(definition.key, 'project', 'Project greeting', {
      projectId: fixture.projectId,
    });
    fixture.service.set(definition.key, 'session', 'Session greeting', {
      sessionId: fixture.sessionId,
    });

    expect(fixture.service.unregisterSource('plugin:sample', [fixture.projectId])).toEqual([
      definition.key,
    ]);
    expect(fixture.registry.get(definition.key)).toBeUndefined();
    fixture.registry.register('plugin:sample', [], [definition]);
    expect(fixture.service.resolve(definition.key).value).toBe('Hello');
    expect(fixture.service.resolve(definition.key, { projectId: fixture.projectId }).value).toBe(
      'Hello',
    );
    expect(fixture.service.resolve(definition.key, { sessionId: fixture.sessionId }).value).toBe(
      'Hello',
    );
  });

  it('drops session values when the session is closed', () => {
    const fixture = createFixture();
    fixture.service.set('access.mode', 'session', 'restricted', { sessionId: fixture.sessionId });
    fixture.service.closeSession(fixture.sessionId);

    expectRpcError(
      () => fixture.service.resolve('access.mode', { sessionId: fixture.sessionId }),
      RpcErrorCode.UnknownSession,
    );
  });
});

function pluginSettingsManifest(): PluginManifest {
  const manifest = JSON.parse(
    readFileSync(
      path.resolve(__dirname, '../../../plugins/sample-hello/gamecrafter-plugin.json'),
      'utf8',
    ),
  ) as PluginManifest;
  manifest.contributes.settings[0]!.scopes = ['platform', 'project', 'session'];
  return manifest;
}

function applyPluginUpgrade(
  fixture: Fixture,
  previous: PluginManifest,
  next: PluginManifest,
): void {
  const plan = fixture.service.preparePluginUpgrade(previous, next, [fixture.projectId]);
  fixture.database.transaction(() => fixture.service.commitPluginUpgrade(next, plan));
  fixture.service.activatePluginSettings(next, previous.version);
}

function createFixture(): Fixture {
  const directory = mkdtempSync(path.join(tmpdir(), 'gc-settings-'));
  const projectId = uuidv7();
  const projectPath = path.join(directory, 'project');
  const stateDirectory = path.join(projectPath, '.gamecrafter');
  mkdirSync(stateDirectory, { recursive: true });
  const createdAt = new Date().toISOString();
  const manifest = projectManifest.assert({
    schemaVersion: 1,
    projectId,
    name: 'Settings Test',
    description: '',
    engine: { family: 'godot' },
    genres: [],
    modules: [],
    createdAt,
    createdByPlatformVersion: '0.1.0',
  });
  writeFileSync(
    path.join(projectPath, 'gamecrafter.project.json'),
    `${JSON.stringify(manifest, null, 2)}\n`,
  );
  const projectDatabase = Database.open(path.join(stateDirectory, 'project.sqlite'));
  try {
    migrate(projectDatabase, projectMigrations);
  } finally {
    projectDatabase.close();
  }

  const database = Database.open(':memory:');
  migrate(database, profileMigrations);
  const profile = new ProfileStore(database);
  profile.register(summaryFromManifest(manifest, projectPath, null));
  const projectDatabases = new ProjectDatabases(profile);
  const registry = new SettingsRegistry();
  const builtins = createBuiltinSettings();
  registry.register('builtin', builtins.groups, builtins.definitions);
  const sessionId = uuidv7();
  const service = new SettingsService(registry, database, projectDatabases);
  service.openSession(sessionId);
  const fixture = {
    directory,
    projectId,
    sessionId,
    database,
    projectDatabases,
    registry,
    service,
  };
  fixtures.push(fixture);
  return fixture;
}

function expectRpcError(operation: () => unknown, code: number): void {
  try {
    operation();
    throw new Error('Expected an RPC error');
  } catch (error) {
    expect(error).toBeInstanceOf(RpcError);
    expect((error as RpcError).code).toBe(code);
  }
}

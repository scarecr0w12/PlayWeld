import { describe, expect, it } from 'vitest';
import { uuidv7 } from '../ids';
import { ToolIdSchema } from '../tools/schema';
import { compile } from '../validation';
import {
  DeclarativePanelSchema,
  IsolationReportSchema,
  PluginCapabilitySchema,
  PluginManifestSchema,
  PluginWorkerStateSchema,
  validatePluginManifest,
} from './schema';

const sampleManifest = {
  schemaVersion: 1,
  id: 'sample-hello',
  name: 'Sample Hello',
  version: '1.0.0',
  description: 'A local example plugin.',
  publisher: { name: 'GameCrafter' },
  license: 'Apache-2.0',
  compatibility: { platform: '^0.1.0', protocol: 1 },
  runtime: { kind: 'node', entry: 'dist/index.js', args: [] },
  capabilities: ['tools.call', 'fs.project.read'],
  contributes: {
    tools: [
      {
        toolId: 'sample-hello/greet',
        title: 'Greet',
        description: 'Returns a greeting.',
        inputSchema: { type: 'object', properties: { name: { type: 'string' } } },
        executionMode: 'project-file',
        sideEffects: 'none',
        evidence: 'Returns the greeting text.',
      },
    ],
    modules: [
      {
        id: 'hello-module',
        name: 'Hello',
        description: 'Example module.',
        requires: [],
        suggests: [],
        records: [],
      },
    ],
    genres: [
      {
        id: 'hello-genre',
        name: 'Hello',
        description: 'Example genre.',
        requiredModules: [],
        optionalModules: [],
        roles: [],
      },
    ],
    recordTypes: [],
    roles: [],
    skills: [],
    settings: [
      {
        key: 'plugin.sample-hello.greetingPrefix',
        title: 'Greeting prefix',
        description: 'Prefix for greetings.',
        group: 'plugins',
        schema: { type: 'string' },
        default: 'Hello',
        scopes: ['project'],
        source: 'plugin:sample-hello',
      },
    ],
    ui: {
      panels: [
        {
          id: 'hello-panel',
          title: 'Hello panel',
          kind: 'declarative',
          source: 'panels/hello.json',
          placement: 'main',
        },
      ],
      commands: [{ id: 'sample-hello.greet', title: 'Greet', toolId: 'sample-hello/greet' }],
    },
  },
  dependencies: { plugins: {} },
  migrations: [],
};

describe('plugin contracts', () => {
  it.each([
    { kind: 'run-script', path: 'migrate.js' },
    { kind: 'remove', key: 'plugin.sample-hello.retired', scopes: ['invalid'] },
    { kind: 'rename', from: 'plugin.sample-hello.old' },
  ])('rejects unsupported or malformed settings operation %j', (operation) => {
    expect(
      compile(PluginManifestSchema).check({
        ...sampleManifest,
        migrations: [
          { from: '1.0.0', to: '2.0.0', description: 'Invalid', operations: [operation] },
        ],
      }),
    ).toBe(false);
  });

  it('accepts declarative settings migrations without executable migration code', () => {
    expect(
      compile(PluginManifestSchema).check({
        ...sampleManifest,
        version: '2.0.0',
        migrations: [
          {
            from: '1.0.0',
            to: '2.0.0',
            description: 'Rename the prefix',
            operations: [
              {
                kind: 'rename',
                from: 'plugin.sample-hello.greetingPrefix',
                to: 'plugin.sample-hello.salutation',
              },
              {
                kind: 'map-values',
                key: 'plugin.sample-hello.salutation',
                values: [{ from: 'Hello', to: 'Welcome' }],
              },
              { kind: 'remove', key: 'plugin.sample-hello.retired', scopes: ['session'] },
            ],
          },
        ],
      }),
    ).toBe(true);
  });

  it('accepts a versioned plugin manifest and host-generated worker states', () => {
    expect(compile(PluginManifestSchema).check(sampleManifest)).toBe(true);
    expect(
      compile(PluginWorkerStateSchema).check({
        pluginId: sampleManifest.id,
        projectId: uuidv7(),
        status: 'running',
        isolation: { backend: 'bwrap', enforced: true, details: ['userns', 'pidns', 'mount'] },
        pid: 1234,
        startedAt: '2026-09-29T12:00:00.000Z',
        lastError: null,
        restarts: 0,
      }),
    ).toBe(true);
    expect(
      compile(IsolationReportSchema).check({
        platform: 'linux',
        backend: 'bwrap',
        available: true,
        checks: [{ name: 'userns', ok: true, detail: 'user namespaces available' }],
      }),
    ).toBe(true);
  });

  it('accepts contributed record type declarations', () => {
    const manifest = {
      ...sampleManifest,
      contributes: {
        ...sampleManifest.contributes,
        recordTypes: [
          {
            type: 'creature',
            name: 'Creature',
            description: 'A plugin-specific world entity.',
            requiredFields: ['species'],
          },
        ],
      },
    };
    expect(compile(PluginManifestSchema).check(manifest)).toBe(true);
  });

  it('accepts tool namespaces that match dotted plugin ids', () => {
    expect(compile(ToolIdSchema).check('com.gamecrafter.sample.hello/greet')).toBe(true);
  });

  it('rejects unsafe manifest identities, entry paths, contribution prefixes, and unknown capabilities', () => {
    expect(compile(PluginManifestSchema).check({ ...sampleManifest, id: 'UpperCase' })).toBe(false);
    expect(
      compile(PluginManifestSchema).check({
        ...sampleManifest,
        runtime: { ...sampleManifest.runtime, entry: '../escape.js' },
      }),
    ).toBe(false);
    expect(compile(PluginCapabilitySchema).check('filesystem.root')).toBe(false);
    expect(
      validatePluginManifest({
        ...sampleManifest,
        contributes: {
          ...sampleManifest.contributes,
          tools: [{ ...sampleManifest.contributes.tools[0], toolId: 'other-plugin/greet' }],
        },
      }),
    ).toEqual(
      expect.arrayContaining([expect.stringContaining('toolId must begin with sample-hello/')]),
    );
    expect(
      validatePluginManifest({
        ...sampleManifest,
        contributes: {
          ...sampleManifest.contributes,
          settings: [{ ...sampleManifest.contributes.settings[0], key: 'models.greetingPrefix' }],
        },
      }),
    ).toEqual(
      expect.arrayContaining([
        expect.stringContaining('setting key must begin with plugin.sample-hello.'),
      ]),
    );
  });

  it('validates declarative panels without accepting executable UI content', () => {
    expect(
      compile(DeclarativePanelSchema).check({
        schemaVersion: 1,
        title: 'Hello',
        sections: [
          { kind: 'markdown', body: 'A sample panel.' },
          { kind: 'tool-form', toolId: 'sample-hello/greet', submitLabel: 'Greet' },
          { kind: 'tool-table', toolId: 'sample-hello/list', columns: ['name'] },
        ],
      }),
    ).toBe(true);
    expect(
      compile(DeclarativePanelSchema).check({
        schemaVersion: 1,
        title: 'Unsafe',
        html: '<script/>',
        sections: [],
      }),
    ).toBe(false);
  });
});

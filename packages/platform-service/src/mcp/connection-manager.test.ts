import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { uuidv7 } from '@gamecrafter/contracts';
import { Database } from '../db/database';
import { migrate } from '../db/migrator';
import { profileMigrations } from '../profile/migrations';
import { CredentialStore } from '../profile/credential-store';
import { ProfileStore } from '../profile/profile-store';
import { ProjectDatabases } from '../projects/project-databases';
import { createBuiltinSettings } from '../settings/definitions';
import { SettingsRegistry } from '../settings/registry';
import { SettingsService } from '../settings/settings-service';
import { ToolRegistry } from '../tools/tool-registry';
import { McpConnectionManager } from './connection-manager';

const directories: string[] = [];
afterEach(() => {
  for (const directory of directories.splice(0))
    rmSync(directory, { recursive: true, force: true });
});

describe('McpConnectionManager persistence and credentials', () => {
  it('coalesces concurrent connects into one fully catalogued session', async () => {
    const fixture = makeManagerFixture();
    try {
      const config = fixture.manager.add({
        name: 'concurrent-server',
        scope: 'platform',
        projectId: null,
        mode: 'command',
        command: {
          command: process.execPath,
          args: [path.resolve(__dirname, '../../lib/mcp/__fixtures__/server-2026-07-28.js')],
          env: {},
        },
        enabled: false,
      });
      const results = await Promise.all(
        Array.from({ length: 4 }, () => fixture.manager.connect(config.connectionId)),
      );
      expect(results.every((result) => result.status === 'connected')).toBe(true);
      expect((await fixture.manager.tools(config.connectionId)).tools.length).toBeGreaterThan(0);
      const connecting = fixture.events.stateChanged.mock.calls.filter((args) =>
        args.some(
          (value) =>
            value &&
            typeof value === 'object' &&
            'status' in value &&
            value.status === 'connecting',
        ),
      );
      // One manager transition and one session transition, independent of caller count.
      expect(connecting).toHaveLength(2);
    } finally {
      await fixture.close();
    }
  });
  it('keeps credential values out of connection RPC results and removes them with the connection', async () => {
    const profileDir = mkdtempSync(path.join(tmpdir(), 'gc-mcp-manager-'));
    directories.push(profileDir);
    const database = Database.open(':memory:');
    migrate(database, profileMigrations);
    const profile = new ProfileStore(database);
    const projectDatabases = new ProjectDatabases(profile);
    const registry = new SettingsRegistry();
    const builtins = createBuiltinSettings();
    registry.register('builtin', builtins.groups, builtins.definitions);
    const settings = new SettingsService(registry, database, projectDatabases);
    const credentials = new CredentialStore(database, profileDir);
    const manager = new McpConnectionManager({
      database,
      profile,
      credentials,
      settings,
      tasks: {} as never,
      completion: {} as never,
      tools: new ToolRegistry(),
      events: { stateChanged: vi.fn(), inputRequired: vi.fn() },
      clientInfo: { name: 'test-client', version: '1.0.0' },
    });
    try {
      const config = manager.add(
        {
          name: 'private-server',
          scope: 'platform',
          projectId: null,
          mode: 'command',
          command: {
            command: process.execPath,
            args: [],
            env: { API_TOKEN: '${cred:ACCESS_TOKEN}' },
          },
          enabled: false,
        },
        { ACCESS_TOKEN: 'secret-value-for-mcp' },
      );
      const listed = manager.list();
      expect(listed).toHaveLength(1);
      expect(listed[0].config).toEqual(config);
      expect(JSON.stringify(listed)).not.toContain('secret-value-for-mcp');
      expect(credentials.get(`mcp:${config.connectionId}:ACCESS_TOKEN`)).toBe(
        'secret-value-for-mcp',
      );

      await manager.remove(config.connectionId);
      expect(credentials.get(`mcp:${config.connectionId}:ACCESS_TOKEN`)).toBeUndefined();
      expect(manager.list()).toEqual([]);
    } finally {
      await manager.stop();
      projectDatabases.close();
      database.close();
    }
  });

  it('resolves credential references at spawn time and redacts process logs', async () => {
    const fixture = makeManagerFixture();
    try {
      const server = path.resolve(__dirname, '../../lib/mcp/__fixtures__/server-2026-07-28.js');
      const secret = 'local-mcp-secret-value';
      const config = fixture.manager.add(
        {
          name: 'secret-server',
          scope: 'platform',
          projectId: null,
          mode: 'command',
          command: {
            command: process.execPath,
            args: [server],
            env: { MCP_FIXTURE_SECRET: '${cred:ACCESS_TOKEN}' },
          },
          enabled: false,
        },
        { ACCESS_TOKEN: secret },
      );
      await fixture.manager.connect(config.connectionId);
      const listed = fixture.manager.list();
      const listedConfig = listed[0].config;
      expect(listedConfig.mode).toBe('command');
      if (listedConfig.mode !== 'command') throw new Error('Expected a command connection');
      expect(listedConfig.command.env.MCP_FIXTURE_SECRET).toBe('${cred:ACCESS_TOKEN}');
      expect(JSON.stringify(listed)).not.toContain(secret);
      expect(
        fixture.manager
          .logEntries(config.connectionId)
          .map((entry) => entry.message)
          .join('\n'),
      ).not.toContain(secret);

      const tool = fixture.tools.get('secret-server/read_env');
      expect(tool).toBeDefined();
      const result = await tool!.handler(
        {
          projectId: uuidv7(),
          projectPath: '/tmp/project',
          taskId: null,
          agentId: null,
          accessMode: 'full',
          callId: uuidv7(),
          signal: new AbortController().signal,
        },
        {},
      );
      expect(result.output).toMatchObject({ content: [{ type: 'text', text: secret }] });
      await fixture.manager.remove(config.connectionId);
    } finally {
      await fixture.close();
    }
  }, 60_000);

  it('answers no-task MRTR through mcp/answer and routes task input through TaskService questions', async () => {
    const fixture = makeManagerFixture();
    try {
      const server = path.resolve(__dirname, '../../lib/mcp/__fixtures__/server-2026-07-28.js');
      const config = fixture.manager.add({
        name: 'input-server',
        scope: 'platform',
        projectId: null,
        mode: 'command',
        command: { command: process.execPath, args: [server], env: {} },
        enabled: false,
      });
      await fixture.manager.connect(config.connectionId);
      const tool = fixture.tools.get('input-server/needs_input');
      expect(tool).toBeDefined();
      const projectId = uuidv7();
      const noTaskCall = tool!.handler(
        {
          projectId,
          projectPath: '/tmp/project',
          taskId: null,
          agentId: null,
          accessMode: 'full',
          callId: uuidv7(),
          signal: new AbortController().signal,
        },
        { value: 'done' },
      );
      await waitFor(() => fixture.events.inputRequired.mock.calls.length === 1);
      const [request] = fixture.events.inputRequired.mock.calls[0];
      expect(request).toMatchObject({
        connectionId: config.connectionId,
        requests: [{ id: 'confirmation' }],
        taskId: null,
      });
      fixture.manager.answer(config.connectionId, request.requestId, { confirmation: 'yes' });
      const externalResult = await noTaskCall;
      expect(externalResult.output).toMatchObject({ requestState: { opaque: 'fixture-state-42' } });

      const taskId = uuidv7();
      const taskResult = await tool!.handler(
        {
          projectId,
          projectPath: '/tmp/project',
          taskId,
          agentId: uuidv7(),
          accessMode: 'full',
          callId: uuidv7(),
          signal: new AbortController().signal,
        },
        { value: 'task answer' },
      );
      expect(taskResult.output).toMatchObject({
        inputResponses: { confirmation: 'yes' },
        requestState: { opaque: 'fixture-state-42' },
      });
      expect(fixture.tasks.askQuestion).toHaveBeenCalledWith(
        projectId,
        taskId,
        expect.stringContaining('Continue?'),
        ['yes', 'no'],
        expect.any(AbortSignal),
      );
      expect(fixture.events.inputRequired).toHaveBeenCalledTimes(1);
    } finally {
      await fixture.close();
    }
  }, 60_000);

  it('rejects credential references scoped to another MCP connection', async () => {
    const fixture = makeManagerFixture();
    try {
      expect(() =>
        fixture.manager.add({
          name: 'cross-connection-reference',
          scope: 'platform',
          projectId: null,
          mode: 'command',
          command: {
            command: process.execPath,
            args: [],
            env: { API_TOKEN: '${cred:mcp:other-connection:KEY}' },
          },
          enabled: false,
        }),
      ).toThrow(/Invalid MCP credential reference key/);
      expect(fixture.manager.list()).toEqual([]);

      const connection = fixture.manager.add(
        {
          name: 'own-connection-reference',
          scope: 'platform',
          projectId: null,
          mode: 'command',
          command: {
            command: process.execPath,
            args: [],
            env: { API_TOKEN: '${cred:ACCESS_TOKEN}' },
          },
          enabled: false,
        },
        { ACCESS_TOKEN: 'own-secret' },
      );
      await expect(
        fixture.manager.update(connection.connectionId, {
          command: {
            command: process.execPath,
            args: [],
            env: { API_TOKEN: '${cred:mcp:other-connection:KEY}' },
          },
        }),
      ).rejects.toMatchObject({ code: -32602 });
      expect(fixture.manager.list()[0].config).toEqual(connection);
    } finally {
      await fixture.close();
    }
  });

  it('rejects inline credentials in secret-like environment variables', async () => {
    const fixture = makeManagerFixture();
    try {
      expect(() =>
        fixture.manager.add({
          name: 'unsafe-server',
          scope: 'platform',
          projectId: null,
          mode: 'command',
          command: {
            command: process.execPath,
            args: [],
            env: { API_TOKEN: 'inline-secret' },
          },
          enabled: false,
        }),
      ).toThrow(/must use a credential reference/);
      expect(fixture.manager.list()).toEqual([]);
    } finally {
      await fixture.close();
    }
  });
});

async function waitFor(predicate: () => boolean): Promise<void> {
  for (let attempt = 0; attempt < 100; attempt += 1) {
    if (predicate()) return;
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
  throw new Error('MCP input notification was not emitted');
}

function makeManagerFixture() {
  const profileDir = mkdtempSync(path.join(tmpdir(), 'gc-mcp-manager-'));
  directories.push(profileDir);
  const database = Database.open(':memory:');
  migrate(database, profileMigrations);
  const profile = new ProfileStore(database);
  const projectDatabases = new ProjectDatabases(profile);
  const registry = new SettingsRegistry();
  const builtins = createBuiltinSettings();
  registry.register('builtin', builtins.groups, builtins.definitions);
  const credentials = new CredentialStore(database, profileDir);
  const tools = new ToolRegistry();
  const events = { stateChanged: vi.fn(), inputRequired: vi.fn() };
  const tasks = { askQuestion: vi.fn(async () => 'yes') };
  const manager = new McpConnectionManager({
    database,
    profile,
    credentials,
    settings: new SettingsService(registry, database, projectDatabases),
    tasks: tasks as never,
    completion: {} as never,
    tools,
    events,
    clientInfo: { name: 'test-client', version: '1.0.0' },
  });
  return {
    manager,
    tools,
    credentials,
    events,
    tasks,
    close: async () => {
      await manager.stop();
      projectDatabases.close();
      database.close();
    },
  };
}

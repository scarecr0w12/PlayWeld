import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { uuidv7 } from '@gamecrafter/contracts';
import { Database } from '../db/database';
import { migrate } from '../db/migrator';
import { CredentialStore } from '../profile/credential-store';
import { profileMigrations } from '../profile/migrations';
import { ProfileStore } from '../profile/profile-store';
import { ProjectDatabases } from '../projects/project-databases';
import { createBuiltinSettings } from '../settings/definitions';
import { SettingsRegistry } from '../settings/registry';
import { SettingsService } from '../settings/settings-service';
import { ToolRegistry } from '../tools/tool-registry';
import { McpConnectionManager } from './connection-manager';

const directories: string[] = [];
const resources: Array<() => Promise<void> | void> = [];
afterEach(async () => {
  await Promise.all(resources.splice(0).map((cleanup) => cleanup()));
  for (const directory of directories.splice(0))
    rmSync(directory, { recursive: true, force: true });
});

describe('MCP sampling', () => {
  it('routes allowed sampling through completion and records cost against the connection', async () => {
    const directory = mkdtempSync(path.join(tmpdir(), 'gc-mcp-sampling-'));
    directories.push(directory);
    const fixture = path.resolve(__dirname, '../../lib/mcp/__fixtures__/sdk-server-2025-03-26.js');
    const database = Database.open(':memory:');
    migrate(database, profileMigrations);
    const profile = new ProfileStore(database);
    const projectDatabases = new ProjectDatabases(profile);
    const registry = new SettingsRegistry();
    const builtins = createBuiltinSettings();
    registry.register('builtin', builtins.groups, builtins.definitions);
    const credentials = new CredentialStore(database, directory);
    const tools = new ToolRegistry();
    const decisionId = uuidv7();
    const completion = {
      complete: vi.fn(async () => ({
        decisionId,
        modelId: 'fake-sampling-model',
        content: 'sampled response',
        finishReason: 'stop',
        usage: { costUsd: 0.025 },
      })),
    };
    const manager = new McpConnectionManager({
      database,
      profile,
      credentials,
      settings: new SettingsService(registry, database, projectDatabases),
      tasks: {} as never,
      completion: completion as never,
      tools,
      events: { stateChanged: () => undefined, inputRequired: () => undefined },
      clientInfo: { name: 'sampling-test', version: '1.0.0' },
    });
    resources.push(async () => {
      await manager.stop();
      projectDatabases.close();
      database.close();
    });

    const config = manager.add({
      name: 'sample-server',
      scope: 'platform',
      projectId: null,
      mode: 'command',
      command: { command: process.execPath, args: [fixture], env: {} },
      allowServerInitiatedModelCalls: true,
      enabled: false,
    });
    await manager.connect(config.connectionId);
    const sampleTool = tools.get('sample-server/sample');
    expect(sampleTool).toBeDefined();
    const projectId = uuidv7();
    const result = await sampleTool!.handler(
      {
        projectId,
        projectPath: '/tmp/project',
        taskId: null,
        agentId: null,
        accessMode: 'full',
        callId: uuidv7(),
        signal: new AbortController().signal,
      },
      {},
    );

    expect(completion.complete).toHaveBeenCalledWith(
      expect.objectContaining({
        route: expect.objectContaining({
          projectId,
          agentRole: 'sample-server',
          taskType: 'mcp-sampling',
        }),
      }),
      expect.anything(),
    );
    expect(result.output).toMatchObject({
      content: [{ type: 'text', text: expect.stringContaining('sampled response') }],
    });
    expect(
      database
        .prepare(
          'SELECT connection_id, decision_id, model_id, cost_usd, cost_status FROM mcp_usage',
        )
        .get(),
    ).toEqual({
      connection_id: config.connectionId,
      decision_id: decisionId,
      model_id: 'fake-sampling-model',
      cost_usd: 0.025,
      cost_status: 'known',
    });
    await manager.remove(config.connectionId);
  }, 60_000);
});

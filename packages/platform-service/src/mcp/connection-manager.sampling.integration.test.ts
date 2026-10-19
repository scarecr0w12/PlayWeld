import { createServer, type Server } from 'node:http';
import { mkdirSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { connect, type ServiceClient } from '@gamecrafter/service-client';
import { Database } from '../db/database';
import { resolvePaths, type ServicePaths } from '../paths';
import { PlatformService } from '../service';

const directories: string[] = [];
let service: PlatformService | undefined;
let client: ServiceClient | undefined;
let provider: Server | undefined;

async function startService(paths: ServicePaths): Promise<PlatformService> {
  return PlatformService.start({ paths, platformVersion: '0.1.0' });
}

async function connectService(socketPath: string, paths: ServicePaths): Promise<ServiceClient> {
  return connect({
    socketPath,
    token: readFileSync(paths.tokenPath, 'utf8').trim(),
    clientName: 'mcp-sampling-integration',
    clientVersion: '0.1.0',
  });
}

async function startFakeProvider(): Promise<{ baseUrl: string; models: string[] }> {
  const models: string[] = [];
  provider = createServer((request, response) => {
    let body = '';
    request.on('data', (chunk) => {
      body += chunk.toString();
    });
    request.on('end', () => {
      if (request.method === 'GET' && request.url === '/v1/models') {
        response.writeHead(200, { 'content-type': 'application/json' });
        response.end(
          JSON.stringify({
            data: [
              {
                id: 'fake-sampling-model',
                display_name: 'Fake sampling model',
                capabilities: {
                  chat: true,
                  tools: false,
                  streaming: false,
                  contextWindow: 64_000,
                  maxOutputTokens: 4096,
                },
                pricing: { inputPerMTokUsd: 1, outputPerMTokUsd: 1 },
              },
            ],
          }),
        );
        return;
      }
      if (request.method === 'POST' && request.url === '/v1/chat/completions') {
        const chatRequest = JSON.parse(body) as { model: string };
        models.push(chatRequest.model);
        response.writeHead(200, { 'content-type': 'application/json' });
        response.end(
          JSON.stringify({
            id: 'fake-sampling-completion',
            object: 'chat.completion',
            created: 1,
            model: chatRequest.model,
            choices: [
              {
                index: 0,
                message: { role: 'assistant', content: 'sampled through the platform router' },
                finish_reason: 'stop',
              },
            ],
            usage: { prompt_tokens: 20, completion_tokens: 8, total_tokens: 28 },
          }),
        );
        return;
      }
      response.writeHead(404, { 'content-type': 'application/json' });
      response.end(JSON.stringify({ error: { message: 'unknown fake provider endpoint' } }));
    });
  });
  await new Promise<void>((resolve) => provider!.listen(0, '127.0.0.1', resolve));
  const address = provider.address();
  if (!address || typeof address === 'string') throw new Error('Fake provider did not bind');
  return { baseUrl: `http://127.0.0.1:${address.port}/v1`, models };
}

afterEach(async () => {
  client?.close();
  await service?.stop();
  service = undefined;
  client = undefined;
  if (provider) {
    await new Promise<void>((resolve) => provider!.close(() => resolve()));
    provider = undefined;
  }
  for (const directory of directories.splice(0))
    rmSync(directory, { recursive: true, force: true });
});

describe('MCP sampling through model routing', () => {
  it('routes sampling to a discovered local provider model and charges cost to the MCP connection', async () => {
    const root = mkdtempSync(path.join(tmpdir(), 'gc-mcp-sampling-integration-'));
    directories.push(root);
    const profileDir = path.join(root, 'profile');
    const projectsDirectory = path.join(root, 'projects');
    mkdirSync(projectsDirectory, { recursive: true });
    const paths = resolvePaths({ GAMECRAFTER_PROFILE_DIR: profileDir });
    service = await startService(paths);
    client = await connectService(service.socketPath, paths);
    const project = await client.call('project/create', {
      name: 'MCP Sampling Project',
      engine: { family: 'godot' },
      parentDirectory: projectsDirectory,
      folderName: 'mcp-sampling-project',
    });
    const fakeProvider = await startFakeProvider();
    const account = await client.call('provider/addAccount', {
      providerKind: 'openai-compatible',
      displayName: 'Fake MCP sampling account',
      baseUrl: fakeProvider.baseUrl,
      apiKey: 'test-api-key',
      isLocal: true,
    });
    const discovered = await client.call('model/discover', {
      accountId: account.accountId,
      providerModelIds: ['fake-sampling-model'],
    });
    expect(discovered.models.map((model) => model.providerModelId)).toContain(
      'fake-sampling-model',
    );

    const fixturePath = path.resolve(
      __dirname,
      '../../lib/mcp/__fixtures__/sdk-server-2025-03-26.js',
    );
    const connection = await client.call('mcp/add', {
      config: {
        name: 'sampling-server',
        scope: 'project',
        projectId: project.projectId,
        mode: 'command',
        command: { command: process.execPath, args: [fixturePath], env: {} },
        tags: [],
        allowServerInitiatedModelCalls: true,
        enabled: false,
      },
    });
    await client.call('mcp/connect', { connectionId: connection.connectionId });
    const call = await client.call('tool/call', {
      projectId: project.projectId,
      toolId: 'sampling-server/sample',
      input: {},
      accessCeiling: 'full',
    });
    expect(call.status).toBe('completed');
    expect(call.output).toMatchObject({
      content: [
        { type: 'text', text: expect.stringContaining('sampled through the platform router') },
      ],
    });
    expect(fakeProvider.models).toEqual(['fake-sampling-model']);

    await client.call('mcp/disconnect', { connectionId: connection.connectionId });
    client.close();
    client = undefined;
    await service.stop();
    service = undefined;
    const database = Database.open(paths.profileDbPath);
    try {
      const usage = database
        .prepare('SELECT connection_id, model_id, cost_usd FROM mcp_usage WHERE connection_id = ?')
        .get<{ connection_id: string; model_id: string; cost_usd: number }>(
          connection.connectionId,
        );
      expect(usage).toMatchObject({
        connection_id: connection.connectionId,
        model_id: expect.any(String),
      });
      expect(usage?.cost_usd).toBeGreaterThan(0);
    } finally {
      database.close();
    }
  }, 60_000);
});

import { createServer } from 'node:http';
import {
  cpSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  symlinkSync,
  unlinkSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it, type TestContext } from 'vitest';
import { RpcErrorCode, type PluginManifest } from '@gamecrafter/contracts';
import { connect } from '@gamecrafter/service-client';
import { Database } from '../db/database';
import type { IsolationLauncher } from './isolation/types';
import { BwrapLauncher } from './isolation/bwrap-launcher';
import { resolvePaths } from '../paths';
import { PlatformService } from '../service';

let service: PlatformService | undefined;
let client: Awaited<ReturnType<typeof connect>> | undefined;
let fakeModelServer: ReturnType<typeof createServer> | undefined;
const temporaryDirectories: string[] = [];
const bwrapProbe =
  process.platform === 'linux' ? new BwrapLauncher().probe() : Promise.resolve(undefined);

async function skipWithoutBwrap(context: TestContext): Promise<void> {
  const report = await bwrapProbe;
  if (!report?.available) {
    context.skip(
      `Requires a working Bubblewrap network namespace: ${report?.checks.map((check) => check.detail).join('; ') ?? 'non-Linux platform'}`,
    );
  }
}

afterEach(async () => {
  client?.close();
  client = undefined;
  await service?.stop();
  service = undefined;
  if (fakeModelServer) {
    await new Promise<void>((resolve) => fakeModelServer!.close(() => resolve()));
    fakeModelServer = undefined;
  }
  for (const directory of temporaryDirectories.splice(0)) {
    rmSync(directory, { recursive: true, force: true });
  }
});

describe('plugin service integration', () => {
  it('installs, enables, starts, calls, renders, stops, and uninstalls the sample plugin', async (context) => {
    await skipWithoutBwrap(context);
    const root = mkdtempSync(path.join(tmpdir(), 'gc-plugin-service-'));
    temporaryDirectories.push(root);
    const profileDir = path.join(root, 'profile');
    const paths = resolvePaths({ GAMECRAFTER_PROFILE_DIR: profileDir });
    service = await PlatformService.start({ paths, platformVersion: '0.1.0' });
    client = await connect({
      socketPath: service.socketPath,
      token: readFileSync(paths.tokenPath, 'utf8').trim(),
      clientName: 'plugin-service-integration',
      clientVersion: '0.1.0',
    });
    const project = await client.call('project/create', {
      name: 'Plugin Host Project',
      engine: { family: 'godot' },
      parentDirectory: path.join(root, 'projects'),
      folderName: 'plugin-host-project',
    });
    writeFileSync(path.join(project.path, 'host-readable.txt'), 'read through the platform broker');
    const source = path.resolve(__dirname, '../../../plugins/sample-hello');
    const inspected = await client.call('plugin/inspect', { source });
    expect(inspected.signature.status).toBe('unsigned');
    expect(inspected.manifest.id).toBe('sample-hello');
    const installed = await client.call('plugin/install', {
      source,
      acceptCapabilities: inspected.capabilities,
    });
    expect(installed.sha256).toMatch(/^[a-f0-9]{64}$/);
    const repeatedInstall = await client.call('plugin/install', {
      source,
      acceptCapabilities: inspected.capabilities,
    });
    expect(repeatedInstall.sha256).toBe(installed.sha256);
    expect(
      (await client.call('plugin/list', { projectId: project.projectId })).plugins[0],
    ).toMatchObject({
      installed: { pluginId: 'sample-hello' },
      projectEnabled: false,
      worker: null,
    });

    await client.call('plugin/enable', {
      pluginId: 'sample-hello',
      projectId: project.projectId,
    });
    const worker = await client.call('plugin/start', {
      pluginId: 'sample-hello',
      projectId: project.projectId,
    });
    expect(worker).toMatchObject({
      status: 'running',
      isolation: { backend: 'bwrap', enforced: true },
    });
    const listedTools = await client.call('tool/list', { projectId: project.projectId });
    expect(listedTools.tools.map((tool) => tool.toolId)).toContain('sample-hello/greet');
    const greeting = await client.call('tool/call', {
      projectId: project.projectId,
      toolId: 'sample-hello/greet',
      input: { name: 'Mira', readPath: 'host-readable.txt' },
      accessCeiling: 'restricted',
    });
    expect(greeting.output).toEqual({
      greeting: 'Hello, Mira!',
      readContent: 'read through the platform broker',
    });
    expect(greeting.evidence).toContainEqual({ kind: 'plugin', ref: 'sample-hello/greet' });
    expect(
      await client.call('plugin/panel', { pluginId: 'sample-hello', panelId: 'hello-panel' }),
    ).toMatchObject({
      schemaVersion: 1,
      title: 'Hello plugin',
      sections: [{ kind: 'markdown' }, { kind: 'tool-form', toolId: 'sample-hello/greet' }],
    });
    const panelPath = path.join(installed.installPath, 'panels', 'hello.json');
    const panelSource = readFileSync(panelPath);
    unlinkSync(panelPath);
    symlinkSync('/etc/passwd', panelPath);
    await expect(
      client.call('plugin/panel', { pluginId: 'sample-hello', panelId: 'hello-panel' }),
    ).rejects.toMatchObject({ code: RpcErrorCode.PluginManifestInvalid });
    unlinkSync(panelPath);
    writeFileSync(panelPath, panelSource);
    const modules = await client.call('plugin/modules', {});
    expect(
      modules.modules.some(
        (entry) =>
          entry.pluginId === 'sample-hello' && entry.active && entry.module.id === 'hello-module',
      ),
    ).toBe(true);

    const withoutRead = path.join(root, 'sample-hello-without-read');
    cpSync(source, withoutRead, {
      recursive: true,
      filter: (entryPath) => !entryPath.includes(`${path.sep}node_modules`),
    });
    const restrictedManifest = JSON.parse(
      readFileSync(path.join(withoutRead, 'gamecrafter-plugin.json'), 'utf8'),
    ) as PluginManifest;
    restrictedManifest.capabilities = restrictedManifest.capabilities.filter(
      (capability) => capability !== 'fs.project.read',
    );
    writeFileSync(
      path.join(withoutRead, 'gamecrafter-plugin.json'),
      JSON.stringify(restrictedManifest),
    );
    await client.call('plugin/stop', { pluginId: 'sample-hello', projectId: project.projectId });
    await client.call('plugin/uninstall', { pluginId: 'sample-hello' });
    const restrictedInspection = await client.call('plugin/inspect', { source: withoutRead });
    await client.call('plugin/install', {
      source: withoutRead,
      acceptCapabilities: restrictedInspection.capabilities,
    });
    await client.call('plugin/enable', {
      pluginId: 'sample-hello',
      projectId: project.projectId,
    });
    await client.call('plugin/start', { pluginId: 'sample-hello', projectId: project.projectId });
    const deniedRead = await client.call('tool/call', {
      projectId: project.projectId,
      toolId: 'sample-hello/greet',
      input: { name: 'Mira', readPath: 'host-readable.txt' },
      accessCeiling: 'restricted',
    });
    expect(deniedRead.output).toMatchObject({ readErrorCode: RpcErrorCode.PluginCapabilityDenied });
    const auditDatabase = Database.open(paths.profileDbPath);
    try {
      expect(
        auditDatabase
          .prepare(
            `SELECT status, error_code AS errorCode FROM plugin_host_calls
             WHERE plugin_id = ? AND method = ? AND status = 'denied'
             ORDER BY started_at DESC LIMIT 1`,
          )
          .get<{ status: string; errorCode: number }>('sample-hello', 'host/tool/call'),
      ).toMatchObject({ status: 'denied', errorCode: RpcErrorCode.PluginCapabilityDenied });
    } finally {
      auditDatabase.close();
    }
    await client.call('plugin/stop', { pluginId: 'sample-hello', projectId: project.projectId });
    await client.call('plugin/uninstall', { pluginId: 'sample-hello' });
    expect(
      (await client.call('tool/list', { projectId: project.projectId })).tools.map(
        (tool) => tool.toolId,
      ),
    ).not.toContain('sample-hello/greet');
    expect(
      (await client.call('plugin/list', { projectId: project.projectId })).plugins,
    ).toHaveLength(0);
    expect(
      (await client.call('settings/describe', {})).definitions.some(
        (setting) => setting.key === 'plugin.sample-hello.greetingPrefix',
      ),
    ).toBe(false);
    await expect(client.call('plugin/status', { pluginId: 'sample-hello' })).rejects.toMatchObject({
      code: RpcErrorCode.PluginNotFound,
    });
  }, 60_000);

  it('starts and calls a Python plugin worker over the shared JSON-RPC protocol', async (context) => {
    await skipWithoutBwrap(context);
    const root = mkdtempSync(path.join(tmpdir(), 'gc-python-plugin-'));
    temporaryDirectories.push(root);
    const paths = resolvePaths({ GAMECRAFTER_PROFILE_DIR: path.join(root, 'profile') });
    service = await PlatformService.start({ paths, platformVersion: '0.1.0' });
    client = await connect({
      socketPath: service.socketPath,
      token: readFileSync(paths.tokenPath, 'utf8').trim(),
      clientName: 'python-plugin-integration',
      clientVersion: '0.1.0',
    });
    const project = await client.call('project/create', {
      name: 'Python Plugin Project',
      engine: { family: 'godot' },
      parentDirectory: path.join(root, 'projects'),
      folderName: 'python-plugin-project',
    });
    const pluginPath = path.join(root, 'python-fixture');
    mkdirSync(pluginPath, { recursive: true });
    writeFileSync(
      path.join(pluginPath, 'worker.py'),
      readFileSync(path.join(__dirname, '__fixtures__', 'python-worker', 'worker.py')),
    );
    const manifest: PluginManifest = {
      schemaVersion: 1,
      id: 'python-fixture',
      name: 'Python Fixture',
      version: '1.0.0',
      description: 'A Python protocol fixture.',
      publisher: { name: 'GameCrafter tests' },
      license: 'Apache-2.0',
      compatibility: { platform: '^0.1.0', protocol: 1 },
      runtime: { kind: 'python', entry: 'worker.py', args: [], interpreter: 'python3' },
      capabilities: [],
      contributes: {
        tools: [
          {
            toolId: 'python-fixture/echo',
            title: 'Echo',
            description: 'Echoes its input.',
            inputSchema: { type: 'object' },
            executionMode: 'project-file',
            sideEffects: 'none',
            evidence: 'Python fixture output.',
          },
          {
            toolId: 'python-fixture/execute_code',
            title: 'Execute code',
            description: 'A fixture tool with a dangerous name.',
            inputSchema: { type: 'object' },
            executionMode: 'project-file',
            sideEffects: 'none',
            evidence: 'Fixture metadata floor.',
          },
        ],
        modules: [],
        genres: [],
        recordTypes: [],
        roles: [],
        skills: [],
        settings: [],
        ui: { panels: [], commands: [] },
      },
      dependencies: { plugins: {} },
      migrations: [],
    };
    writeFileSync(path.join(pluginPath, 'gamecrafter-plugin.json'), JSON.stringify(manifest));
    const inspection = await client.call('plugin/inspect', { source: pluginPath });
    await client.call('plugin/install', {
      source: pluginPath,
      acceptCapabilities: inspection.capabilities,
    });
    await client.call('plugin/enable', {
      pluginId: 'python-fixture',
      projectId: project.projectId,
    });
    const worker = await client.call('plugin/start', {
      pluginId: 'python-fixture',
      projectId: project.projectId,
    });
    expect(worker).toMatchObject({
      status: 'running',
      isolation: { backend: 'bwrap', enforced: true },
    });
    const pythonTools = await client.call('tool/list', { projectId: project.projectId });
    expect(
      pythonTools.tools.find((tool) => tool.toolId === 'python-fixture/execute_code')?.sideEffects,
    ).toBe('destructive');
    const result = await client.call('tool/call', {
      projectId: project.projectId,
      toolId: 'python-fixture/echo',
      input: { language: 'python' },
      accessCeiling: 'restricted',
    });
    expect(result.output).toEqual({ echo: { language: 'python' } });
    await client.call('plugin/stop', { pluginId: 'python-fixture', projectId: project.projectId });
    await client.call('plugin/uninstall', { pluginId: 'python-fixture' });
  }, 60_000);

  it('retries a crashing plugin worker up to the configured restart limit', async (context) => {
    await skipWithoutBwrap(context);
    const root = mkdtempSync(path.join(tmpdir(), 'gc-plugin-crash-'));
    temporaryDirectories.push(root);
    const paths = resolvePaths({ GAMECRAFTER_PROFILE_DIR: path.join(root, 'profile') });
    service = await PlatformService.start({ paths, platformVersion: '0.1.0' });
    client = await connect({
      socketPath: service.socketPath,
      token: readFileSync(paths.tokenPath, 'utf8').trim(),
      clientName: 'plugin-crash-integration',
      clientVersion: '0.1.0',
    });
    const project = await client.call('project/create', {
      name: 'Plugin Crash Project',
      engine: { family: 'godot' },
      parentDirectory: path.join(root, 'projects'),
      folderName: 'plugin-crash-project',
    });
    await client.call('settings/set', {
      key: 'plugins.maxRestarts',
      scope: 'platform',
      value: 1,
    });
    const pluginPath = path.join(root, 'crash-plugin');
    mkdirSync(pluginPath, { recursive: true });
    writeFileSync(path.join(pluginPath, 'crash.cjs'), 'process.exit(17);');
    const manifest: PluginManifest = {
      schemaVersion: 1,
      id: 'crash-fixture',
      name: 'Crash fixture',
      version: '1.0.0',
      description: 'Exits before initialization.',
      publisher: { name: 'GameCrafter tests' },
      license: 'Apache-2.0',
      compatibility: { platform: '^0.1.0', protocol: 1 },
      runtime: { kind: 'node', entry: 'crash.cjs', args: [] },
      capabilities: [],
      contributes: {
        tools: [],
        modules: [],
        genres: [],
        recordTypes: [],
        roles: [],
        skills: [],
        settings: [],
        ui: { panels: [], commands: [] },
      },
      dependencies: { plugins: {} },
      migrations: [],
    };
    writeFileSync(path.join(pluginPath, 'gamecrafter-plugin.json'), JSON.stringify(manifest));
    const inspection = await client.call('plugin/inspect', { source: pluginPath });
    await client.call('plugin/install', {
      source: pluginPath,
      acceptCapabilities: inspection.capabilities,
    });
    await client.call('plugin/enable', { pluginId: 'crash-fixture', projectId: project.projectId });
    await expect(
      client.call('plugin/start', { pluginId: 'crash-fixture', projectId: project.projectId }),
    ).rejects.toMatchObject({ code: RpcErrorCode.PluginWorkerFailed });
    expect(
      await client.call('plugin/status', {
        pluginId: 'crash-fixture',
        projectId: project.projectId,
      }),
    ).toMatchObject({ status: 'failed', restarts: 1, lastError: expect.any(String) });
    await client.call('plugin/stop', { pluginId: 'crash-fixture', projectId: project.projectId });
    await client.call('plugin/uninstall', { pluginId: 'crash-fixture' });
  }, 30_000);

  it('fails closed without isolation and only runs unisolated for Full access when enabled', async (context) => {
    if (process.platform !== 'linux') context.skip('Exercises the Linux isolation launcher.');
    const root = mkdtempSync(path.join(tmpdir(), 'gc-plugin-isolation-policy-'));
    temporaryDirectories.push(root);
    let isolatedLaunchAttempts = 0;
    const unavailableLauncher: IsolationLauncher = {
      async probe() {
        return {
          platform: 'linux',
          backend: 'bwrap',
          available: false,
          checks: [{ name: 'userns', ok: false, detail: 'forced unavailable in test' }],
        };
      },
      launch() {
        isolatedLaunchAttempts += 1;
        throw new Error('Isolated process must not launch when probe fails.');
      },
    };
    const paths = resolvePaths({ GAMECRAFTER_PROFILE_DIR: path.join(root, 'profile') });
    service = await PlatformService.start({
      paths,
      platformVersion: '0.1.0',
      pluginLaunchers: { linux: unavailableLauncher },
    });
    client = await connect({
      socketPath: service.socketPath,
      token: readFileSync(paths.tokenPath, 'utf8').trim(),
      clientName: 'plugin-isolation-policy',
      clientVersion: '0.1.0',
    });
    const project = await client.call('project/create', {
      name: 'Isolation Policy Project',
      engine: { family: 'godot' },
      parentDirectory: path.join(root, 'projects'),
      folderName: 'isolation-policy-project',
    });
    const source = path.resolve(__dirname, '../../../plugins/sample-hello');
    const inspection = await client.call('plugin/inspect', { source });
    await client.call('plugin/install', {
      source,
      acceptCapabilities: inspection.capabilities,
    });
    await client.call('plugin/enable', { pluginId: 'sample-hello', projectId: project.projectId });

    await expect(
      client.call('plugin/start', { pluginId: 'sample-hello', projectId: project.projectId }),
    ).rejects.toMatchObject({ code: RpcErrorCode.PluginIsolationUnavailable });
    expect(isolatedLaunchAttempts).toBe(0);
    await client.call('settings/set', {
      key: 'access.mode',
      scope: 'project',
      value: 'full',
      projectId: project.projectId,
    });
    await expect(
      client.call('plugin/start', { pluginId: 'sample-hello', projectId: project.projectId }),
    ).rejects.toMatchObject({ code: RpcErrorCode.PluginIsolationUnavailable });
    expect(isolatedLaunchAttempts).toBe(0);
    await client.call('settings/set', {
      key: 'plugins.allowUnisolatedInFullAccess',
      scope: 'platform',
      value: true,
    });
    const worker = await client.call('plugin/start', {
      pluginId: 'sample-hello',
      projectId: project.projectId,
    });
    expect(worker).toMatchObject({
      status: 'running',
      isolation: { backend: 'none', enforced: false },
    });
    await client.call('plugin/stop', { pluginId: 'sample-hello', projectId: project.projectId });
    await client.call('plugin/uninstall', { pluginId: 'sample-hello' });

    const allowListSource = path.join(root, 'sample-hello-allow-list');
    cpSync(source, allowListSource, {
      recursive: true,
      filter: (entryPath) => !entryPath.includes(`${path.sep}node_modules`),
    });
    const allowListManifest = JSON.parse(
      readFileSync(path.join(allowListSource, 'gamecrafter-plugin.json'), 'utf8'),
    ) as PluginManifest;
    allowListManifest.capabilities.push({
      capability: 'network.outbound',
      hosts: ['127.0.0.1'],
    });
    writeFileSync(
      path.join(allowListSource, 'gamecrafter-plugin.json'),
      JSON.stringify(allowListManifest),
    );
    const allowListInspection = await client.call('plugin/inspect', { source: allowListSource });
    expect(allowListInspection.warnings).toContain(
      'Outbound host allow-lists cannot be enforced by the current isolation launcher.',
    );
    await client.call('plugin/install', {
      source: allowListSource,
      acceptCapabilities: allowListInspection.capabilities,
    });
    await client.call('plugin/enable', { pluginId: 'sample-hello', projectId: project.projectId });
    await expect(
      client.call('plugin/start', { pluginId: 'sample-hello', projectId: project.projectId }),
    ).rejects.toMatchObject({ code: RpcErrorCode.PluginIsolationUnavailable });
    expect(isolatedLaunchAttempts).toBe(0);
    await client.call('plugin/uninstall', { pluginId: 'sample-hello' });
  }, 30_000);

  it('scopes plugin secrets to their owner, redacts logs, and removes them on uninstall', async (context) => {
    await skipWithoutBwrap(context);
    const root = mkdtempSync(path.join(tmpdir(), 'gc-plugin-secret-'));
    temporaryDirectories.push(root);
    const paths = resolvePaths({ GAMECRAFTER_PROFILE_DIR: path.join(root, 'profile') });
    service = await PlatformService.start({ paths, platformVersion: '0.1.0' });
    client = await connect({
      socketPath: service.socketPath,
      token: readFileSync(paths.tokenPath, 'utf8').trim(),
      clientName: 'plugin-secret-integration',
      clientVersion: '0.1.0',
    });
    const project = await client.call('project/create', {
      name: 'Plugin Secret Project',
      engine: { family: 'godot' },
      parentDirectory: path.join(root, 'projects'),
      folderName: 'plugin-secret-project',
    });
    const source = path.resolve(__dirname, '__fixtures__', 'secret-worker');
    const inspection = await client.call('plugin/inspect', { source });
    await client.call('plugin/install', {
      source,
      acceptCapabilities: inspection.capabilities,
    });
    await client.call('plugin/enable', {
      pluginId: 'secret-fixture',
      projectId: project.projectId,
    });
    await client.call('plugin/setSecret', {
      pluginId: 'secret-fixture',
      name: 'token',
      value: 'super-secret-value',
    });
    await client.call('plugin/start', { pluginId: 'secret-fixture', projectId: project.projectId });
    const secretResult = await client.call('tool/call', {
      projectId: project.projectId,
      toolId: 'secret-fixture/read-secret',
      input: { secretName: 'token' },
      accessCeiling: 'restricted',
    });
    expect(secretResult.output.secretValue).toBe('super-secret-value');
    const logs = await client.call('plugin/log', {
      pluginId: 'secret-fixture',
      projectId: project.projectId,
    });
    expect(JSON.stringify(logs)).not.toContain('super-secret-value');
    expect(JSON.stringify(logs)).toContain('[REDACTED]');
    const auditDatabase = Database.open(paths.profileDbPath);
    try {
      const auditInput = auditDatabase
        .prepare(
          `SELECT input FROM plugin_host_calls
           WHERE plugin_id = ? AND method = ? ORDER BY started_at DESC LIMIT 1`,
        )
        .get<{ input: string }>('secret-fixture', 'host/log')?.input;
      expect(auditInput).not.toContain('super-secret-value');
      expect(auditInput).toContain('[REDACTED]');
    } finally {
      auditDatabase.close();
    }
    const crossNamespace = await client.call('tool/call', {
      projectId: project.projectId,
      toolId: 'secret-fixture/read-secret',
      input: { secretName: 'other:token' },
      accessCeiling: 'restricted',
    });
    expect(crossNamespace.output.secretErrorCode).toBe(RpcErrorCode.InvalidParams);
    expect(
      JSON.stringify(await client.call('plugin/list', { projectId: project.projectId })),
    ).not.toContain('super-secret-value');
    await client.call('plugin/stop', { pluginId: 'secret-fixture', projectId: project.projectId });
    await client.call('plugin/uninstall', { pluginId: 'secret-fixture' });

    await client.call('plugin/install', {
      source,
      acceptCapabilities: inspection.capabilities,
    });
    await client.call('plugin/enable', {
      pluginId: 'secret-fixture',
      projectId: project.projectId,
    });
    await client.call('plugin/start', { pluginId: 'secret-fixture', projectId: project.projectId });
    const removedSecret = await client.call('tool/call', {
      projectId: project.projectId,
      toolId: 'secret-fixture/read-secret',
      input: { secretName: 'token' },
      accessCeiling: 'restricted',
    });
    expect(removedSecret.output).toMatchObject({ secretFound: false });
    expect(removedSecret.output).not.toHaveProperty('secretValue');
    await client.call('plugin/stop', { pluginId: 'secret-fixture', projectId: project.projectId });
    await client.call('plugin/uninstall', { pluginId: 'secret-fixture' });
  }, 60_000);

  it('routes host model completions and retains plugin usage after uninstall', async (context) => {
    await skipWithoutBwrap(context);
    const root = mkdtempSync(path.join(tmpdir(), 'gc-plugin-model-'));
    temporaryDirectories.push(root);
    fakeModelServer = createServer((request, response) => {
      let body = '';
      request.on('data', (chunk) => (body += chunk.toString()));
      request.on('end', () => {
        if (request.method === 'GET' && request.url === '/v1/models') {
          response.writeHead(200, { 'content-type': 'application/json' });
          response.end(
            JSON.stringify({
              data: [
                {
                  id: 'fixture-model',
                  display_name: 'Fixture model',
                  capabilities: { chat: true, tools: true },
                  pricing: { inputPerMTokUsd: 1, outputPerMTokUsd: 2 },
                },
              ],
            }),
          );
          return;
        }
        if (request.method === 'POST' && request.url === '/v1/chat/completions') {
          response.writeHead(200, { 'content-type': 'application/json' });
          response.end(
            JSON.stringify({
              choices: [
                {
                  message: { role: 'assistant', content: 'Completion from fixture model' },
                  finish_reason: 'stop',
                },
              ],
              usage: { prompt_tokens: 10, completion_tokens: 5 },
            }),
          );
          return;
        }
        response.writeHead(404, { 'content-type': 'application/json' });
        response.end(JSON.stringify({ error: { message: 'unknown fixture endpoint' } }));
      });
    });
    await new Promise<void>((resolve) => fakeModelServer!.listen(0, '127.0.0.1', resolve));
    const address = fakeModelServer.address();
    if (!address || typeof address === 'string') throw new Error('Fake model server did not bind');
    const paths = resolvePaths({ GAMECRAFTER_PROFILE_DIR: path.join(root, 'profile') });
    service = await PlatformService.start({ paths, platformVersion: '0.1.0' });
    client = await connect({
      socketPath: service.socketPath,
      token: readFileSync(paths.tokenPath, 'utf8').trim(),
      clientName: 'plugin-model-integration',
      clientVersion: '0.1.0',
    });
    const project = await client.call('project/create', {
      name: 'Plugin Model Project',
      engine: { family: 'godot' },
      parentDirectory: path.join(root, 'projects'),
      folderName: 'plugin-model-project',
    });
    const account = await client.call('provider/addAccount', {
      providerKind: 'openai-compatible',
      displayName: 'Plugin fixture provider',
      baseUrl: `http://127.0.0.1:${address.port}/v1`,
      apiKey: 'fake-plugin-model-key',
      isLocal: true,
    });
    const discovery = await client.call('model/discover', { accountId: account.accountId });
    const modelId = discovery.models[0].modelId;
    await client.call('pool/create', {
      name: 'Plugin model route',
      scope: 'project',
      projectId: project.projectId,
      target: { kind: 'task-type', id: 'plugin' },
      modelIds: [modelId],
    });
    const source = path.resolve(__dirname, '__fixtures__', 'model-worker');
    const inspection = await client.call('plugin/inspect', { source });
    await client.call('plugin/install', {
      source,
      acceptCapabilities: inspection.capabilities,
    });
    await client.call('plugin/enable', { pluginId: 'model-fixture', projectId: project.projectId });
    await client.call('plugin/start', { pluginId: 'model-fixture', projectId: project.projectId });
    const response = await client.call('tool/call', {
      projectId: project.projectId,
      toolId: 'model-fixture/complete',
      input: { request: { messages: [{ role: 'user', content: 'Say hello' }] } },
      accessCeiling: 'restricted',
    });
    expect(response.output).toEqual({ content: 'Completion from fixture model', modelId });
    const database = Database.open(paths.profileDbPath);
    try {
      const usage = database
        .prepare(
          'SELECT model_id AS modelId, cost_usd AS costUsd, cost_status AS costStatus FROM plugin_usage WHERE plugin_id = ?',
        )
        .get<{ modelId: string; costUsd: number; costStatus: string }>('model-fixture');
      expect(usage).toMatchObject({ modelId, costUsd: expect.any(Number), costStatus: 'known' });
      expect(usage?.costUsd).toBeGreaterThan(0);
    } finally {
      database.close();
    }
    await client.call('plugin/stop', { pluginId: 'model-fixture', projectId: project.projectId });
    await client.call('plugin/uninstall', { pluginId: 'model-fixture' });
    const history = Database.open(paths.profileDbPath);
    try {
      expect(
        history
          .prepare('SELECT COUNT(*) AS count FROM plugin_usage WHERE plugin_id = ?')
          .get<{ count: number }>('model-fixture')?.count,
      ).toBe(1);
    } finally {
      history.close();
    }
  }, 60_000);
});

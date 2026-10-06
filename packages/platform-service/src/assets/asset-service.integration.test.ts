import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import { createHash } from 'node:crypto';
import {
  chmodSync,
  existsSync,
  mkdtempSync,
  mkdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { RpcErrorCode } from '@gamecrafter/contracts';
import { connect, type ServiceClient } from '@gamecrafter/service-client';
import { resolvePaths } from '../paths';
import { PlatformService } from '../service';

const temporaryDirectories: string[] = [];
let service: PlatformService | undefined;
let client: ServiceClient | undefined;
let providerServer: ReturnType<typeof createServer> | undefined;
let providerUrl = '';
let pollCount = 0;
let resumeOnPoll = false;
let downloadBytes: Buffer;
let submitCount = 0;
let paths: ReturnType<typeof resolvePaths> | undefined;

const fixtureGlb = makeGlb({
  asset: { version: '2.0', generator: 'GameCrafter test' },
  scene: 0,
  scenes: [{ nodes: [0] }],
  nodes: [{ name: 'Lantern_LOD0', mesh: 0 }, { name: 'Lantern_LOD1' }],
  meshes: [{ primitives: [] }],
  materials: [{ name: 'Bronze' }],
  animations: [{ name: 'Open', channels: [], samplers: [] }],
});
downloadBytes = fixtureGlb;

afterEach(async () => {
  await client?.close();
  client = undefined;
  await service?.stop();
  service = undefined;
  await closeProvider();
  for (const directory of temporaryDirectories.splice(0))
    rmSync(directory, { recursive: true, force: true });
  pollCount = 0;
  resumeOnPoll = false;
  downloadBytes = fixtureGlb;
  submitCount = 0;
});

describe('asset service integration', () => {
  it('generates, reviews, imports, lists, and previews an asset with provenance', async () => {
    await startProvider();
    await startService('asset-full-flow');
    const project = await createProject('asset-full-flow');
    const account = await addAccount();
    expect(account).not.toHaveProperty('apiKey');
    expect(JSON.stringify(account)).not.toContain('test-meshy-key');
    await setProjectSetting(project.projectId, 'assets.pollIntervalSeconds', 2);
    await expect(
      client!.call('asset/testAccount', { accountId: account.accountId }),
    ).resolves.toMatchObject({
      ok: true,
      balance: 25,
    });

    const job = await client!.call('asset/generate', {
      projectId: project.projectId,
      accountId: account.accountId,
      request: { kind: 'text-to-3d', prompt: 'A brass lantern', outputFormat: 'glb' },
    });
    const reviewJob = await waitForJob(project.projectId, job.jobId, 'review');
    expect(reviewJob).toMatchObject({
      status: 'review',
      progress: 100,
      providerTaskId: 'text:task-1',
      provenance: {
        planTier: 'studio',
        providerTaskId: 'text:task-1',
        requestedBy: { kind: 'user', ref: null },
        termsSnapshot: {
          url: 'https://help.meshy.ai/en/articles/16102098-can-i-use-meshy-assets-commercially',
        },
      },
      artifacts: [
        {
          kind: 'model',
          format: 'glb',
          sha256: createHash('sha256').update(fixtureGlb).digest('hex'),
        },
      ],
    });

    const tools = (await client!.call('tool/list', { projectId: project.projectId })).tools;
    expect(tools.some((tool) => tool.toolId === 'asset/review')).toBe(false);
    await expect(
      client!.call('tool/call', {
        projectId: project.projectId,
        toolId: 'asset/review',
        input: { jobId: job.jobId, decision: 'approved' },
        agentId: 'agent-test',
      }),
    ).rejects.toMatchObject({ code: RpcErrorCode.ToolNotFound });

    await expect(
      client!.call('asset/generate', {
        projectId: project.projectId,
        accountId: account.accountId,
        request: { kind: 'image-to-3d', imagePath: '../../outside.png', outputFormat: 'glb' },
      }),
    ).rejects.toMatchObject({ code: RpcErrorCode.AssetPathOutsideProject });
    await expect(
      client!.call('asset/preview', { projectId: project.projectId, path: '../../outside.glb' }),
    ).rejects.toMatchObject({ code: RpcErrorCode.AssetPathOutsideProject });
    await expect(
      client!.call('asset/openInAuthoringTool', {
        projectId: project.projectId,
        path: '../../outside.glb',
      }),
    ).rejects.toMatchObject({ code: RpcErrorCode.AssetPathOutsideProject });

    const generatedDir = path.join(project.path, 'game', 'assets', 'generated');
    mkdirSync(generatedDir, { recursive: true });
    const collisionPath = path.join(generatedDir, `${job.jobId.slice(0, 8)}-a-brass-lantern.glb`);
    writeFileSync(collisionPath, 'keep existing');
    await client!.call('asset/review', {
      projectId: project.projectId,
      jobId: job.jobId,
      decision: 'approved',
      note: 'Looks good.',
    });
    await expect(
      client!.call('asset/import', {
        projectId: project.projectId,
        jobId: job.jobId,
        artifactId: reviewJob.artifacts[0]!.artifactId,
        destinationDir: '../../outside',
      }),
    ).rejects.toMatchObject({ code: RpcErrorCode.AssetPathOutsideProject });
    const imported = await client!.call('asset/import', {
      projectId: project.projectId,
      jobId: job.jobId,
      artifactId: reviewJob.artifacts[0]!.artifactId,
    });
    expect(imported.importedPath).toContain(`${job.jobId.slice(0, 8)}-a-brass-lantern-2.glb`);
    expect(readFileSync(collisionPath, 'utf8')).toBe('keep existing');
    expect(imported.job).toMatchObject({ status: 'imported', importedPath: imported.importedPath });
    expect(
      JSON.parse(readFileSync(path.join(project.path, imported.provenancePath), 'utf8')),
    ).toMatchObject({
      schemaVersion: 1,
      jobId: job.jobId,
      provenance: { providerKind: 'meshy', planTier: 'studio' },
    });
    const files = await client!.call('asset/files', { projectId: project.projectId });
    expect(files.files).toHaveLength(2);
    expect(
      files.files.some(
        (entry) =>
          entry.path === imported.importedPath && entry.provenancePath === imported.provenancePath,
      ),
    ).toBe(true);
    expect(files.files.some((entry) => entry.path === imported.provenancePath)).toBe(false);

    const preview = await client!.call('asset/preview', {
      projectId: project.projectId,
      path: imported.importedPath,
    });
    expect(preview).toMatchObject({
      kind: 'model-gltf',
      mimeType: 'model/gltf-binary',
      metadata: {
        gltfVersion: '2.0',
        nodes: 2,
        meshes: 1,
        materials: 1,
        animations: ['Open'],
        lodLevels: 2,
      },
    });
    const cached = await client!.call('asset/preview', {
      projectId: project.projectId,
      path: imported.importedPath,
    });
    expect(cached.previewId).toBe(preview.previewId);

    const assetsDirectory = path.join(project.path, 'game', 'assets');
    writeFileSync(
      path.join(assetsDirectory, 'external.gltf'),
      JSON.stringify({ asset: { version: '2.0' }, buffers: [{ uri: 'mesh.bin' }], images: [] }),
    );
    const externalPreview = await client!.call('asset/preview', {
      projectId: project.projectId,
      path: 'game/assets/external.gltf',
    });
    expect(externalPreview).toMatchObject({
      kind: 'unavailable',
      derivativePath: null,
      warnings: ['external buffers are not bundled into the preview'],
    });
    const legacyGlb = makeGlb({ asset: { version: '1.0' } });
    legacyGlb.writeUInt32LE(1, 4);
    writeFileSync(path.join(assetsDirectory, 'legacy.glb'), legacyGlb);
    const legacyPreview = await client!.call('asset/preview', {
      projectId: project.projectId,
      path: 'game/assets/legacy.glb',
    });
    expect(legacyPreview).toMatchObject({
      kind: 'unavailable',
      warnings: ['glTF 1.0 is not supported by the viewer'],
    });
    writeFileSync(
      path.join(assetsDirectory, 'draco.glb'),
      makeGlb({ asset: { version: '2.0' }, extensionsRequired: ['KHR_draco_mesh_compression'] }),
    );
    const dracoPreview = await client!.call('asset/preview', {
      projectId: project.projectId,
      path: 'game/assets/draco.glb',
    });
    expect(dracoPreview.warnings).toContain(
      'Draco-compressed geometry cannot be decoded by the viewer',
    );

    const openScript = path.join(temporaryDirectories[0]!, 'fake-open.cjs');
    const openArgPath = path.join(temporaryDirectories[0]!, 'opened-asset-path.txt');
    writeFileSync(
      openScript,
      `#!/usr/bin/env node\nrequire('node:fs').writeFileSync(${JSON.stringify(openArgPath)}, process.argv[2] ?? '');\n`,
    );
    chmodSync(openScript, 0o755);
    await client!.call('settings/set', {
      key: 'assets.externalOpenCommand',
      scope: 'platform',
      value: openScript,
    });
    await expect(
      client!.call('asset/openInAuthoringTool', {
        projectId: project.projectId,
        path: imported.importedPath,
      }),
    ).resolves.toMatchObject({ launched: true, command: 'fake-open.cjs (1 args)' });
    await waitFor(() => existsSync(openArgPath));
    expect(readFileSync(openArgPath, 'utf8')).toBe(path.join(project.path, imported.importedPath));
  }, 60_000);

  it('resumes provider polling after the platform service restarts', async () => {
    await startProvider();
    await startService('asset-resume');
    const project = await createProject('asset-resume');
    const account = await addAccount();
    resumeOnPoll = true;
    await setProjectSetting(project.projectId, 'assets.pollIntervalSeconds', 2);
    const job = await client!.call('asset/generate', {
      projectId: project.projectId,
      accountId: account.accountId,
      request: { kind: 'text-to-3d', prompt: 'A stone arch', outputFormat: 'glb' },
    });
    await waitForJob(project.projectId, job.jobId, 'running');
    await stopService();
    await startService('asset-resume-after-restart', temporaryDirectories[0]);
    const resumed = await waitForJob(project.projectId, job.jobId, 'review');
    expect(resumed.status).toBe('review');
    expect(pollCount).toBeGreaterThanOrEqual(2);
  }, 60_000);

  it('fails downloads above the configured size limit', async () => {
    await startProvider();
    await startService('asset-download-limit');
    const project = await createProject('asset-download-limit');
    const account = await addAccount();
    await setProjectSetting(project.projectId, 'assets.maxDownloadMb', 1);
    downloadBytes = Buffer.alloc(1024 * 1024 + 1, 0x61);
    const job = await client!.call('asset/generate', {
      projectId: project.projectId,
      accountId: account.accountId,
      request: { kind: 'text-to-3d', prompt: 'Oversized output', outputFormat: 'glb' },
    });
    const failed = await waitForJob(project.projectId, job.jobId, 'failed');
    expect(failed.error).toContain('size limit');
  }, 60_000);
});

async function startService(clientName: string, root?: string): Promise<void> {
  const serviceRoot = root ?? mkdtempSync(path.join(tmpdir(), 'gc-asset-service-'));
  if (!root) temporaryDirectories.push(serviceRoot);
  paths = resolvePaths({ GAMECRAFTER_PROFILE_DIR: path.join(serviceRoot, 'profile') });
  service = await PlatformService.start({ paths, platformVersion: '0.1.0' });
  client = await connect({
    socketPath: service.socketPath,
    token: readFileSync(paths.tokenPath, 'utf8').trim(),
    clientName,
    clientVersion: '0.1.0',
  });
}

async function stopService(): Promise<void> {
  await client?.close();
  client = undefined;
  await service?.stop();
  service = undefined;
}

async function createProject(name: string) {
  return client!.call('project/create', {
    name,
    engine: { family: 'godot' },
    parentDirectory: path.join(temporaryDirectories[0]!, 'projects'),
    folderName: name,
  });
}

async function addAccount() {
  return client!.call('asset/addAccount', {
    providerKind: 'meshy',
    displayName: 'Test Meshy',
    baseUrl: providerUrl,
    apiKey: 'test-meshy-key',
    planTier: 'studio',
  });
}

async function setProjectSetting(projectId: string, key: string, value: unknown): Promise<void> {
  await client!.call('settings/set', { key, scope: 'project', projectId, value });
}

async function waitFor(check: () => boolean): Promise<void> {
  for (let attempt = 0; attempt < 100; attempt += 1) {
    if (check()) return;
    await new Promise((resolve) => setTimeout(resolve, 20));
  }
  throw new Error('Timed out waiting for an external-open command.');
}

async function waitForJob(projectId: string, jobId: string, status: string) {
  for (let attempt = 0; attempt < 200; attempt += 1) {
    const job = await client!.call('asset/job', { projectId, jobId });
    if (job.status === status) return job;
    if (job.status === 'failed' && status !== 'failed')
      throw new Error(`Asset job failed: ${job.error}`);
    await new Promise((resolve) => setTimeout(resolve, 25));
  }
  throw new Error(`Asset job did not reach ${status}`);
}

async function startProvider(): Promise<void> {
  providerServer = createServer(async (request, response) => {
    const body = await readBody(request);
    if (request.url === '/openapi/v1/balance') {
      sendJson(response, 200, { balance: 25 });
      return;
    }
    if (request.method === 'POST' && request.url === '/openapi/v2/text-to-3d') {
      submitCount += 1;
      sendJson(response, 200, { result: { id: `task-${submitCount}` } });
      return;
    }
    if (request.method === 'GET' && request.url?.startsWith('/openapi/v2/text-to-3d/')) {
      pollCount += 1;
      if (resumeOnPoll && pollCount === 1) {
        sendJson(response, 200, { result: { status: 'IN_PROGRESS', progress: 30 } });
        return;
      }
      sendJson(response, 200, {
        result: {
          status: 'SUCCEEDED',
          progress: 100,
          credit_usage: 4,
          model_urls: { glb: `${providerUrl}/download/model.glb` },
        },
      });
      return;
    }
    if (request.url === '/download/model.glb') {
      response.writeHead(200, {
        'content-type': 'model/gltf-binary',
        'content-length': downloadBytes.length,
      });
      response.end(downloadBytes);
      return;
    }
    sendJson(response, 404, { error: body });
  });
  await new Promise<void>((resolve) => providerServer!.listen(0, '127.0.0.1', resolve));
  const address = providerServer.address();
  if (!address || typeof address === 'string')
    throw new Error('Fake asset provider failed to bind.');
  providerUrl = `http://127.0.0.1:${address.port}`;
}

async function closeProvider(): Promise<void> {
  if (!providerServer) return;
  await new Promise<void>((resolve, reject) => {
    providerServer!.close((error) => (error ? reject(error) : resolve()));
  });
  providerServer = undefined;
}

async function readBody(request: IncomingMessage): Promise<Record<string, unknown>> {
  const chunks: Buffer[] = [];
  for await (const chunk of request) chunks.push(Buffer.from(chunk));
  if (chunks.length === 0) return {};
  return JSON.parse(Buffer.concat(chunks).toString('utf8')) as Record<string, unknown>;
}

function sendJson(response: ServerResponse, status: number, value: unknown): void {
  response.writeHead(status, { 'content-type': 'application/json' });
  response.end(JSON.stringify(value));
}

function makeGlb(document: Record<string, unknown>): Buffer {
  const json = Buffer.from(JSON.stringify(document));
  const jsonLength = Math.ceil(json.length / 4) * 4;
  const chunk = Buffer.alloc(jsonLength, 0x20);
  json.copy(chunk);
  const buffer = Buffer.alloc(20 + jsonLength);
  buffer.write('glTF', 0, 'ascii');
  buffer.writeUInt32LE(2, 4);
  buffer.writeUInt32LE(buffer.length, 8);
  buffer.writeUInt32LE(jsonLength, 12);
  buffer.writeUInt32LE(0x4e4f534a, 16);
  chunk.copy(buffer, 20);
  return buffer;
}

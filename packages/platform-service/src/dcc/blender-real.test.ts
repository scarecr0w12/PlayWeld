import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { connect, type ServiceClient } from '@gamecrafter/service-client';
import { parseGlbDocument, inspectGltfDocument } from '../assets/preview/gltf-inspector';
import { resolvePaths } from '../paths';
import { PlatformService } from '../service';
import { wslInterop } from './wsl-interop';

let service: PlatformService | undefined;
let client: ServiceClient | undefined;
let root: string | undefined;

afterEach(async () => {
  await client?.close();
  client = undefined;
  await service?.stop();
  service = undefined;
  if (root) rmSync(root, { recursive: true, force: true });
  root = undefined;
});

describe('real Blender DCC connector', () => {
  it('reports a Python exception as a failed run rather than success', async (context) => {
    const blender =
      process.env.GAMECRAFTER_BLENDER ??
      (process.platform === 'win32' ? 'D:/Blender/blender.exe' : '/mnt/d/Blender/blender.exe');
    if (!existsSync(blender)) context.skip();
    root = mkdtempSync(path.join(tmpdir(), 'gc-blender-error-'));
    const paths = resolvePaths({ GAMECRAFTER_PROFILE_DIR: path.join(root, 'profile') });
    service = await PlatformService.start({ paths, platformVersion: '0.1.3' });
    client = await connect({
      socketPath: service.socketPath,
      token: readFileSync(paths.tokenPath, 'utf8').trim(),
      clientName: 'blender-error-test',
      clientVersion: '0.1.3',
    });
    const project = await client.call('project/create', {
      name: 'Blender error',
      engine: { family: 'godot' },
      parentDirectory: path.join(root, 'projects'),
      folderName: 'blender-error',
    });
    await client.call('settings/set', {
      key: 'access.mode',
      scope: 'project',
      projectId: project.projectId,
      value: 'full',
    });
    await client.call('dcc/addInstallation', { tool: 'blender', executable: blender, kind: 'gui' });
    const run = await client.call('dcc/run', {
      projectId: project.projectId,
      tool: 'blender',
      operation: 'run-script',
      params: { script: 'raise RuntimeError("Intentional regression failure")' },
    });
    expect(run.status).toBe('failed');
    expect(run.exitCode).not.toBe(0);
  }, 30000);
  it('discovers Blender, inspects a camera-less mesh scene, exports GLB, and renders PNG through WSL interop', async (context) => {
    const blender =
      process.env.GAMECRAFTER_BLENDER ??
      (process.platform === 'win32' ? 'D:/Blender/blender.exe' : '/mnt/d/Blender/blender.exe');
    if (!existsSync(blender)) {
      console.warn(`Skipping real Blender connector test: ${blender} is not installed.`);
      context.skip();
    }
    root = mkdtempSync(path.join(tmpdir(), 'gc-dcc-blender-real-'));
    const paths = resolvePaths({ GAMECRAFTER_PROFILE_DIR: path.join(root, 'profile') });
    service = await PlatformService.start({ paths, platformVersion: '0.1.0' });
    client = await connect({
      socketPath: service.socketPath,
      token: readFileSync(paths.tokenPath, 'utf8').trim(),
      clientName: 'real Blender connector test',
      clientVersion: '0.1.0',
    });
    const project = await client.call('project/create', {
      name: 'Real Blender DCC Test',
      engine: { family: 'godot' },
      parentDirectory: path.join(root, 'projects'),
      folderName: 'real-blender-dcc',
    });
    await client.call('settings/set', {
      key: 'access.mode',
      scope: 'project',
      projectId: project.projectId,
      value: 'full',
    });
    const installations = await client.call('dcc/installations', { tool: 'blender' });
    let installation = installations.installations.find(
      (candidate) => path.resolve(candidate.executable) === path.resolve(blender),
    );
    if (!installation) {
      installation = await client.call('dcc/addInstallation', {
        tool: 'blender',
        executable: path.resolve(blender),
        kind: 'gui',
      });
    }
    expect(installation.version).toMatch(/^5\.2/);
    if (wslInterop.isWsl()) expect(installation.viaWslInterop).toBe(true);

    const capabilities = await client.call('dcc/capabilities', {
      projectId: project.projectId,
      tool: 'blender',
      refresh: true,
    });
    expect(capabilities.layers.headless.status).toBe('ready');
    const discovered = await client.call('dcc/run', {
      projectId: project.projectId,
      tool: 'blender',
      operation: 'discover',
    });
    expect(discovered.status).toBe('succeeded');
    expect(discovered.summary).toContain('5.2');

    const blendPath = path.join(project.path, 'game', 'assets', 'wp16-real-cube.blend');
    mkdirSync(path.dirname(blendPath), { recursive: true });
    const hostBlendPath = await wslInterop.toHostPath(blendPath);
    const createSceneScript = [
      'import bpy',
      'bpy.ops.wm.read_factory_settings(use_empty=False)',
      "for obj in list(bpy.data.objects):\n    if obj.type in {'CAMERA', 'LIGHT'}: bpy.data.objects.remove(obj, do_unlink=True)",
      `bpy.ops.wm.save_as_mainfile(filepath=${JSON.stringify(hostBlendPath)})`,
    ].join('\n');
    const created = await client.call('dcc/run', {
      projectId: project.projectId,
      tool: 'blender',
      operation: 'run-script',
      params: { script: createSceneScript },
    });
    expect(created.status).toBe('succeeded');
    expect(existsSync(blendPath)).toBe(true);

    const inspected = await client.call('dcc/run', {
      projectId: project.projectId,
      tool: 'blender',
      operation: 'inspect',
      params: { file: 'game/assets/wp16-real-cube.blend' },
    });
    expect(inspected.status).toBe('succeeded');
    expect(
      inspected.evidence.some(
        (entry) => entry.detail.includes('"meshes": 1') || entry.detail.includes('"meshes":1'),
      ),
    ).toBe(true);

    const glbPath = path.join(project.path, 'game', 'assets', 'wp16-real-cube.glb');
    const exported = await client.call('dcc/run', {
      projectId: project.projectId,
      tool: 'blender',
      operation: 'export',
      params: {
        file: 'game/assets/wp16-real-cube.blend',
        format: 'glb',
        output: 'game/assets/wp16-real-cube.glb',
      },
    });
    expect(exported.status).toBe('succeeded');
    const gltf = inspectGltfDocument(parseGlbDocument(readFileSync(glbPath)));
    expect(gltf.metadata.meshes).toBeGreaterThanOrEqual(1);

    const nested = await client.call('dcc/run', {
      projectId: project.projectId,
      tool: 'blender',
      operation: 'export',
      params: {
        file: 'game/assets/wp16-real-cube.blend',
        format: 'glb',
        output: 'Art/Exports/nested/cube.glb',
      },
    });
    expect(nested.status).toBe('succeeded');
    const imported = await client.call('dcc/run', {
      projectId: project.projectId,
      tool: 'blender',
      operation: 'import',
      params: { file: 'Art/Exports/nested/cube.glb', format: 'glb' },
    });
    expect(imported.status).toBe('succeeded');
    const importedBlend = imported.artifacts.find((artifact) => artifact.path.endsWith('.blend'))!;
    const importedInspection = await client.call('dcc/run', {
      projectId: project.projectId,
      tool: 'blender',
      operation: 'inspect',
      params: { file: importedBlend.path },
    });
    const inspectionFile = importedInspection.artifacts.find((artifact) =>
      artifact.path.endsWith('inspection.json'),
    )!;
    const inspection = JSON.parse(
      readFileSync(path.join(project.path, inspectionFile.path), 'utf8'),
    );
    expect(inspection.meshes).toBe(1);
    expect(
      inspection.objects.filter(
        (object: { type: string }) => object.type === 'CAMERA' || object.type === 'LIGHT',
      ),
    ).toHaveLength(0);
    const converted = await client.call('dcc/run', {
      projectId: project.projectId,
      tool: 'blender',
      operation: 'convert',
      params: {
        input: 'Art/Exports/nested/cube.glb',
        output: 'Art/Converted/nested/cube.glb',
        format: 'glb',
      },
    });
    expect(converted.status).toBe('succeeded');
    const convertedInfo = inspectGltfDocument(
      parseGlbDocument(readFileSync(path.join(project.path, 'Art/Converted/nested/cube.glb'))),
    );
    expect(convertedInfo.metadata.meshes).toBe(1);

    const originalScene = readFileSync(blendPath);
    const rendered = await client.call('dcc/run', {
      projectId: project.projectId,
      tool: 'blender',
      operation: 'render-preview',
      params: { file: 'game/assets/wp16-real-cube.blend', resolution: 128, samples: 4 },
    });
    expect(rendered.command.join(' ')).not.toContain(path.basename(root));
    const renderLogs = [
      readFileSync(
        path.join(project.path, `.gamecrafter/dcc-runs/${rendered.runId}/stdout.log`),
        'utf8',
      ),
      readFileSync(
        path.join(project.path, `.gamecrafter/dcc-runs/${rendered.runId}/stderr.log`),
        'utf8',
      ),
    ].join('\n');
    expect(rendered.status, `${JSON.stringify(rendered, null, 2)}\n${renderLogs}`).toBe(
      'succeeded',
    );
    expect(readFileSync(blendPath)).toEqual(originalScene);
    const pngArtifact = rendered.artifacts.find((artifact) => artifact.path.endsWith('.png'));
    expect(pngArtifact).toBeDefined();
    expect(readFileSync(path.join(project.path, pngArtifact!.path)).subarray(0, 8)).toEqual(
      Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    );
  }, 180_000);
});

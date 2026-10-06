import { mkdtempSync, mkdirSync, readFileSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, expect, it, vi } from 'vitest';
import { uuidv7 } from '@gamecrafter/contracts';
import { ToolRegistry, type ToolContext } from '../../tools/tool-registry';
import {
  enableGodotPlugin,
  registerUnrealEditorBridgeTools,
  validateEditorSession,
} from './editor-bridge-tools';

const roots: string[] = [];
afterEach(() => {
  for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true });
});
function fixture(family = 'unreal') {
  const root = mkdtempSync(path.join(tmpdir(), 'pw-editor-bridge-'));
  roots.push(root);
  const projectFile = path.join(root, 'game/Test.uproject');
  mkdirSync(path.dirname(projectFile), { recursive: true });
  writeFileSync(
    projectFile,
    JSON.stringify({ FileVersion: 3, Plugins: [{ Name: 'Existing', Enabled: true }] }),
  );
  const registry = new ToolRegistry();
  const projectId = uuidv7();
  const protect = vi.fn(async (_value: Buffer, decrypt: boolean) =>
    Buffer.from(decrypt ? 'a'.repeat(64) : 'protected-ciphertext'),
  );
  const bind = vi.fn(async () => undefined);
  const mcp = {
    list: vi.fn(() => []),
    add: vi.fn(() => ({ connectionId: uuidv7() })),
    connect: vi.fn(async () => ({
      serverInfo: { name: 'playweld-unreal-editor', version: '0.1.0' },
      negotiatedRevision: '2025-11-25',
    })),
  };
  registerUnrealEditorBridgeTools({
    registry,
    mcp: mcp as never,
    bind,
    family: () => family,
    protect,
    bundle: path.resolve(__dirname, `../../../../../integrations/${family}/PlayWeldEditor`),
  });
  const context: ToolContext = {
    projectId,
    projectPath: root,
    taskId: null,
    agentId: null,
    accessMode: 'full',
    callId: uuidv7(),
    signal: new AbortController().signal,
  };
  return { root, projectFile, registry, context, protect, bind, mcp };
}

it('enables Godot alongside existing addons without duplicate activation or configuration loss', () => {
  const before =
    'config_version=5\n\n[editor_plugins]\nenabled=PackedStringArray("res://addons/user/plugin.cfg")\n\n[rendering]\nrenderer/rendering_method="gl_compatibility"\n';
  const enabled = enableGodotPlugin(before);
  expect(enabled).toContain(
    'PackedStringArray("res://addons/user/plugin.cfg", "res://addons/playweld_editor/plugin.cfg")',
  );
  expect(enabled).toContain('[rendering]\nrenderer/rendering_method="gl_compatibility"');
  expect(enableGodotPlugin(enabled)).toBe(enabled);
  expect(() => enableGodotPlugin('[editor_plugins]\nenabled=unexpected\n')).toThrow(/Unsupported/);
});

it.each(['unity', 'godot'])(
  'installs and enables %s source while preserving unrelated native files',
  async (family) => {
    const f = fixture(family);
    const native =
      family === 'unity' ? path.join(f.root, 'game') : path.join(f.root, 'game/project.godot');
    const version = path.join(f.root, 'game/ProjectSettings/ProjectVersion.txt');
    if (family === 'unity') {
      mkdirSync(path.dirname(version), { recursive: true });
      writeFileSync(version, 'm_EditorVersion: 6000.6.0f1\n');
    } else writeFileSync(native, 'config_version=5\n[application]\nconfig/name="Test"\n');
    const original = readFileSync(f.projectFile, 'utf8');
    const first = await f.registry
      .get('engine/editor-bridge-install')!
      .handler(f.context, { projectFile: path.relative(f.root, native) });
    expect(first.output).toMatchObject({
      installed: true,
      family,
      editorBuildRequired: false,
      credentialProtected: true,
    });
    await f.registry
      .get('engine/editor-bridge-install')!
      .handler(f.context, { projectFile: path.relative(f.root, native) });
    expect(readFileSync(f.projectFile, 'utf8')).toBe(original);
    expect(f.protect).toHaveBeenCalledTimes(1);
    const source = path.join(
      f.root,
      family === 'unity'
        ? 'game/Assets/Editor/PlayWeldEditor/PlayWeldEditorBridge.cs'
        : 'game/addons/playweld_editor/bridge.gd',
    );
    writeFileSync(source, 'user source');
    await expect(
      f.registry
        .get('engine/editor-bridge-install')!
        .handler(f.context, { projectFile: path.relative(f.root, native) }),
    ).rejects.toThrow(/Preserve modified/);
    expect(readFileSync(source, 'utf8')).toBe('user source');
  },
);

it('installs owned source without replacing existing Project plugin choices or returning plaintext credentials', async () => {
  const f = fixture();
  const result = await f.registry
    .get('engine/editor-bridge-install')!
    .handler(f.context, { projectFile: 'game/Test.uproject' });
  expect(result.output).toMatchObject({
    installed: true,
    credentialProtected: true,
    editorBuildRequired: true,
  });
  const project = JSON.parse(readFileSync(f.projectFile, 'utf8'));
  expect(project.Plugins).toContainEqual({ Name: 'Existing', Enabled: true });
  expect(project.Plugins).toContainEqual({
    Name: 'PlayWeldEditor',
    Enabled: true,
    TargetAllowList: ['Editor'],
  });
  expect(
    readFileSync(path.join(f.root, 'game/Saved/PlayWeldEditor/session-token.dpapi'), 'utf8'),
  ).toBe('protected-ciphertext');
  expect(f.protect).toHaveBeenCalledTimes(1);
  const manifestPath = path.join(f.root, 'game/Saved/PlayWeldEditor/installed-source.json');
  const owned = JSON.parse(readFileSync(manifestPath, 'utf8'));
  owned.build = {
    engineFingerprint: 'owned-engine',
    sourceFingerprint: 'owned-source',
    binaries: { 'UnrealEditor-PlayWeldEditor.dll': 'owned-hash' },
  };
  writeFileSync(manifestPath, JSON.stringify(owned));
  await f.registry
    .get('engine/editor-bridge-install')!
    .handler(f.context, { projectFile: 'game/Test.uproject' });
  expect(f.protect).toHaveBeenCalledTimes(1);
  expect(JSON.parse(readFileSync(manifestPath, 'utf8')).build).toEqual(owned.build);
});

it('preserves locally edited plugin code before modifying any install files', async () => {
  const f = fixture();
  await f.registry
    .get('engine/editor-bridge-install')!
    .handler(f.context, { projectFile: 'game/Test.uproject' });
  const source = path.join(
    f.root,
    'game/Plugins/PlayWeldEditor/Source/PlayWeldEditor/Private/PlayWeldEditorModule.cpp',
  );
  writeFileSync(source, 'User-edited source');
  const before = readFileSync(f.projectFile, 'utf8');
  await expect(
    f.registry
      .get('engine/editor-bridge-install')!
      .handler(f.context, { projectFile: 'game/Test.uproject' }),
  ).rejects.toThrow(/Preserve modified/);
  expect(readFileSync(source, 'utf8')).toBe('User-edited source');
  expect(readFileSync(f.projectFile, 'utf8')).toBe(before);
});

it('rejects Project traversal and foreign/remote editor identities before pairing', async () => {
  const f = fixture();
  await expect(
    f.registry
      .get('engine/editor-bridge-install')!
      .handler(f.context, { projectFile: '../other.uproject' }),
  ).rejects.toThrow(/escapes/);
  const other = path.join(f.root, 'game/Other.uproject');
  writeFileSync(other, '{}');
  expect(() =>
    validateEditorSession(
      { bridge: 'PlayWeldEditor', pid: 123, projectPath: other, url: 'http://127.0.0.1:56789/mcp' },
      f.projectFile,
    ),
  ).toThrow(/does not identify/);
  expect(() =>
    validateEditorSession(
      {
        bridge: 'PlayWeldEditor',
        pid: 123,
        projectPath: f.projectFile,
        url: 'http://example.com/mcp',
      },
      f.projectFile,
    ),
  ).toThrow(/loopback/);
  expect(f.protect).not.toHaveBeenCalled();
});

it('pairs through encrypted MCP credentials without exposing them in the tool result', async () => {
  const f = fixture();
  await f.registry
    .get('engine/editor-bridge-install')!
    .handler(f.context, { projectFile: 'game/Test.uproject' });
  writeFileSync(
    path.join(f.root, 'game/Saved/PlayWeldEditor/session.json'),
    JSON.stringify({
      bridge: 'PlayWeldEditor',
      pid: 123,
      projectPath: f.projectFile,
      url: 'http://127.0.0.1:56789/mcp',
    }),
  );
  const result = await f.registry
    .get('engine/editor-bridge-connect')!
    .handler(f.context, { projectFile: 'game/Test.uproject' });
  expect(result.output).toMatchObject({ connected: true, editorPid: 123 });
  expect(JSON.stringify(result)).not.toContain('a'.repeat(64));
  expect(f.mcp.add).toHaveBeenCalledWith(
    expect.objectContaining({
      projectId: f.context.projectId,
      allowServerInitiatedModelCalls: false,
    }),
    { 'editor-token': 'Bearer ' + 'a'.repeat(64) },
  );
  expect(f.bind).toHaveBeenCalledTimes(1);
});

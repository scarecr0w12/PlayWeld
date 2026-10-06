#!/usr/bin/env node
// SPDX-License-Identifier: Apache-2.0
// Owns only timestamped acceptance Projects and processes started below.
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const { spawn } = require('node:child_process');
const { PlatformService } = require('../packages/platform-service/lib/service');
const { resolvePaths } = require('../packages/platform-service/lib/paths');
const { connect } = require('@gamecrafter/service-client');
const family = process.argv[2];
assert(['unity', 'unreal', 'godot'].includes(family));
const out = path.resolve(__dirname, '../.artifacts/editor-bridge', `${Date.now()}-${family}`);
fs.mkdirSync(out, { recursive: true });
const report = { family, startedAt: new Date().toISOString(), checks: [], out };
let service, client, editor;
const save = () => fs.writeFileSync(path.join(out, 'report.json'), JSON.stringify(report, null, 2));
async function check(name, action) {
  console.log(`START ${name}`);
  try { const result = await action(); report.checks.push({ name, passed: true, result }); console.log(`PASS ${name}`); return result; }
  catch (error) { report.checks.push({ name, passed: false, error: error.stack }); throw error; }
  finally { save(); }
}
const wait = ms => new Promise(resolve => setTimeout(resolve, ms));
async function ready(file, timeout = 180000) {
  const start = Date.now();
  while (!fs.existsSync(file)) { assert(Date.now()-start < timeout, `Editor did not publish ${file}`); assert(editor.exitCode === null, 'Editor exited before pairing'); await wait(500); }
  return JSON.parse(fs.readFileSync(file, 'utf8').replace(/^\uFEFF/, ''));
}
function launch(exe, args) {
  const stream = fs.createWriteStream(path.join(out, 'editor-process.log'));
  editor = spawn(exe, args, { cwd: out, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] });
  editor.stdout.pipe(stream, { end: false }); editor.stderr.pipe(stream, { end: false });
  editor.on('close', () => stream.end()); editor.on('error', error => { report.launchError = error.message; save(); });
  report.editor = { exe, args, pid: editor.pid }; save();
}
async function main() {
  const paths = resolvePaths({ GAMECRAFTER_PROFILE_DIR: path.join(out, 'profile') });
  service = await PlatformService.start({ paths, platformVersion: require('../packages/platform-service/package.json').version });
  client = await connect({ socketPath: service.socketPath, token: fs.readFileSync(paths.tokenPath, 'utf8').trim(), clientName: 'editor-bridge-acceptance', clientVersion: '1.0.0' });
  const project = await client.call('project/create', { name: `${family} Editor Bridge Acceptance`, engine: { family }, parentDirectory: path.join(out, 'projects'), folderName: family });
  const root = project.path;
  assert(typeof root === 'string', 'Project must supply its workspace path');
  const game = path.join(root, 'game');
  const call = async (toolId, input = {}) => { const result = await client.call('tool/call', { projectId: project.projectId, toolId, input }); assert.equal(result.status, 'completed', JSON.stringify(result.error)); return result.output; };
  await client.call('settings/set', { key: 'access.mode', scope: 'project', projectId: project.projectId, value: 'full' });
  let native, saved;
  if (family === 'unity') {
    fs.cpSync(path.resolve(__dirname, 'fixtures/engine-acceptance/unity'), game, { recursive: true });
    const setup = path.join(game, 'Assets/Editor/BridgeAcceptanceSetup.cs'); fs.mkdirSync(path.dirname(setup), { recursive: true });
    fs.writeFileSync(setup, 'using UnityEditor; using UnityEditor.SceneManagement; using UnityEngine; using UnityEngine.SceneManagement; public static class BridgeAcceptanceSetup { public static void Open() { EditorSceneManager.NewScene(NewSceneSetup.DefaultGameObjects, NewSceneMode.Single); var cube=GameObject.CreatePrimitive(PrimitiveType.Cube); cube.name="UserOwned"; EditorSceneManager.SaveScene(SceneManager.GetActiveScene(), "Assets/BridgeAcceptance.unity"); SceneView.lastActiveSceneView?.LookAt(Vector3.zero,Quaternion.Euler(20,-45,0),6); } }');
    native = game; saved = path.join(game, 'Library/PlayWeldEditor');
  } else if (family === 'godot') {
    fs.writeFileSync(path.join(game, 'project.godot'), 'config_version=5\n\n[application]\nconfig/name="PlayWeld Editor Acceptance"\nconfig/features=PackedStringArray("4.7", "GL Compatibility")\nrun/main_scene="res://Main.tscn"\n\n[rendering]\nrenderer/rendering_method="gl_compatibility"\n');
    fs.writeFileSync(path.join(game, 'Main.tscn'), '[gd_scene load_steps=2 format=3]\n\n[sub_resource type="BoxMesh" id="Box"]\nsize = Vector3(2, 2, 2)\n\n[node name="Main" type="Node3D"]\n\n[node name="UserOwned" type="MeshInstance3D" parent="."]\nmesh = SubResource("Box")\n');
    native = path.join(game, 'project.godot'); saved = path.join(game, '.godot/PlayWeldEditor');
  } else {
    const previous = path.resolve(__dirname, '../.artifacts/adversarial-engines/2026-10-06-run1/projects/unreal/game');
    assert(fs.existsSync(path.join(previous, 'Acceptance.uproject')), 'Run the baseline Unreal fixture first.');
    for (const name of ['Acceptance.uproject', 'Binaries', 'Config', 'Content', 'Source']) fs.cpSync(path.join(previous, name), path.join(game, name), { recursive: true });
    native = path.join(game, 'Acceptance.uproject'); saved = path.join(game, 'Saved/PlayWeldEditor');
  }
  const input = { projectFile: path.relative(root, native) };
  await check('managed installation', () => call('engine/editor-bridge-install', input));
  const credentialBefore = fs.readFileSync(path.join(saved, 'session-token.dpapi'));
  await check('repeat installation preserves protected credential', async () => { await call('engine/editor-bridge-install', input); assert.deepEqual(fs.readFileSync(path.join(saved, 'session-token.dpapi')), credentialBefore); return true; });
  if (family === 'unity') launch('D:/Unity/Editor/6000.6.0f1/Editor/Unity.exe', ['-projectPath', game, '-executeMethod', 'BridgeAcceptanceSetup.Open', '-logFile', path.join(out, 'unity.log')]);
  else if (family === 'godot') {
    const linux = '/mnt/' + game[0].toLowerCase() + game.slice(2).replaceAll('\\', '/');
    const linuxOut = '/mnt/' + out[0].toLowerCase() + out.slice(2).replaceAll('\\', '/');
    fs.writeFileSync(path.join(out, 'godot-run.sh'), `#!/bin/sh\nprintf '%s' "$$" > '${linuxOut}/godot.pid'\nexec godot "$@"\n`);
    launch('wsl.exe', ['--exec', 'sh', `${linuxOut}/godot-run.sh`, '--editor', '--path', linux, 'res://Main.tscn']);
  } else {
    await client.call('engine/addInstallation', { family: 'unreal', executable: 'D:/Unreal/UE_5.8/Engine/Build/BatchFiles/RunUAT.bat', kind: 'uat' });
    await check('PlayWeld compiles and applies the Unreal editor plugin', () => call('engine/editor-bridge-build', input));
    await check('repeat Unreal build reuses matching owned binaries', async () => { const built = await call('engine/editor-bridge-build', input); assert.equal(built.reused, true); return built; });
    launch('D:/Unreal/UE_5.8/Engine/Binaries/Win64/UnrealEditor.exe', [native, '-nosplash', '-unattended', '-log']);
  }
  await check('editor plugin starts automatically', () => ready(path.join(saved, 'session.json')));
  const paired = await check('PlayWeld pairs and binds verified editor', () => call('engine/editor-bridge-connect', input));
  const toolList = (await client.call('tool/list', { projectId: project.projectId })).tools;
  const tool = name => { const match = toolList.find(entry => entry.source === `mcp:${paired.connectionId}` && entry.toolId.endsWith('/' + name)); assert(match, `Missing ${name}`); return match.toolId; };
  const unpack = output => output?.structuredContent ?? (output?.result?.structuredContent) ?? JSON.parse(output?.content?.[0]?.text ?? output?.result?.content?.[0]?.text ?? '{}');
  const inspect = async () => unpack(await call(tool('inspect')));
  if (family === 'unreal') {
    const setup = path.join(out, 'visible_scene.py');
    fs.writeFileSync(setup, 'import unreal\nactors = unreal.get_editor_subsystem(unreal.EditorActorSubsystem)\ncube = actors.spawn_actor_from_class(unreal.StaticMeshActor, unreal.Vector(0, 0, 0))\ncube.set_actor_label("UserOwnedVisibleCube")\ncube.set_actor_location(unreal.Vector(0, 0, 0), False, False)\ncube.static_mesh_component.set_static_mesh(unreal.load_asset("/Engine/BasicShapes/Cube"))\nlight = actors.spawn_actor_from_class(unreal.DirectionalLight, unreal.Vector(0, 0, 400), unreal.Rotator(-45, 20, 0))\nunreal.get_editor_subsystem(unreal.UnrealEditorSubsystem).set_level_viewport_camera_info(unreal.Vector(-400, -400, 300), unreal.Rotator(-25, 45, 0))\n');
    await check('visible native scene fixture', async () => { const result = unpack(await call(tool('console'), { command: `py "${setup.replaceAll('\\', '/')}"` })); assert.equal(result.success, true); const cube = (await inspect()).objects.find(obj => obj.name === 'UserOwnedVisibleCube'); assert(cube); const framed = unpack(await call(tool('console'), { command: `CAMERA ALIGN ACTIVEVIEWPORTONLY NAME=${cube.objectId.split('.').at(-1)}` })); assert.equal(framed.success, true); await wait(15000); return true; });
  }
  await check('running editor identity matches explicit native Project', async () => { const result = unpack(await call(tool('get_project_context'))); assert.equal(path.normalize(result.projectPath), path.normalize(native)); return result; });
  await check('unauthenticated requests are refused', async () => { const session = JSON.parse(fs.readFileSync(path.join(saved, 'session.json'), 'utf8').replace(/^\uFEFF/, '')); const response = await fetch(session.url, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'tools/list' }) }); assert.equal(response.status, 401); return true; });
  if (family !== 'unreal') {
    await wait(2000);
    const before = await inspect(); assert(before.objects.some(obj => obj.name === 'UserOwned'), 'Open the expected acceptance scene');
    await check('scene spawn and move via PlayWeld broker', async () => { const created = unpack(await call(tool('edit_scene'), { action: 'spawn', location: [1, 2, 3] })); const owned = created.objects.find(obj => obj.owned); assert(owned); const moved = unpack(await call(tool('edit_scene'), { action: 'set-location', objectId: owned.objectId, location: [4, 5, 6] })); assert.deepEqual(moved.objects.find(obj => obj.objectId === owned.objectId).location, [4, 5, 6]); report.owned = owned.objectId; return true; });
    await check('editor refuses mutations of user-owned objects', async () => { const user = before.objects.find(obj => obj.name === 'UserOwned'); let refused = false; try { const result = await call(tool('edit_scene'), { action: 'delete', objectId: user.objectId }); refused = result?.isError === true; } catch { refused = true; } assert(refused); assert((await inspect()).objects.some(obj => obj.name === 'UserOwned')); return true; });
    await check('owned object deletion through PlayWeld', async () => { await call(tool('edit_scene'), { action: 'delete', objectId: report.owned }); assert(!(await inspect()).objects.some(obj => obj.objectId === report.owned)); return true; });
  } else {
    await check('Unreal owned actor spawn and movement via PlayWeld', async () => { const created = unpack(await call(tool('edit_scene'), { action: 'spawn', classPath: '/Script/Engine.PointLight', label: 'PlayWeld acceptance light', location: [1, 2, 3] })); assert.equal(created.success, true); report.owned = created.actorPath; const moved = unpack(await call(tool('edit_scene'), { action: 'set-location', actorPath: created.actorPath, location: [4, 5, 6] })); assert.deepEqual(moved.location, [4, 5, 6]); return true; });
    await check('Unreal refuses user-owned actor mutation', async () => { const user = (await inspect()).objects.find(obj => !obj.owned); assert(user); await assert.rejects(call(tool('edit_scene'), { action: 'delete', actorPath: user.objectId })); assert((await inspect()).objects.some(obj => obj.objectId === user.objectId)); return true; });
    await check('Unreal owned actor deletion through PlayWeld', async () => { const result = unpack(await call(tool('edit_scene'), { action: 'delete', actorPath: report.owned })); assert.equal(result.success, true); assert(!(await inspect()).objects.some(obj => obj.objectId === report.owned)); return true; });
  }
  await check('live capability layer is available', async () => { const capabilities = await client.call('engine/capabilities', { projectId: project.projectId, refresh: true }); assert.equal(capabilities.layers['live-editor'].status, 'ready'); return capabilities; });
  await check('viewport screenshot through PlayWeld', async () => { const image = unpack(await call(tool('screenshot'))); const file = image.screenshot ?? image.path; assert(typeof file === 'string'); const local = family === 'godot' && file.startsWith('/mnt/') ? file[5].toUpperCase() + ':' + file.slice(6).replaceAll('/', '\\') : file; assert(fs.statSync(local).size > 100); return { file: local, bytes: fs.statSync(local).size }; });
}
main().catch(error => { report.error = error.stack; console.error(error.message); process.exitCode = 1; }).finally(async () => {
  client?.close(); await service?.stop();
  if (editor && editor.exitCode === null) {
    if (family === 'godot') { const pidFile = path.join(out, 'godot.pid'); const pid = fs.existsSync(pidFile) ? Number(fs.readFileSync(pidFile, 'utf8')) : report.checks.find(check => check.name === 'editor plugin starts automatically')?.result?.pid; if (Number.isInteger(pid) && pid > 1) { const killer = spawn('wsl.exe', ['--exec', 'kill', '-TERM', String(pid)], { windowsHide: true }); await new Promise(resolve => killer.once('close', resolve)); } }
    editor.kill();
  }
  report.finishedAt = new Date().toISOString(); save(); console.log(path.join(out, 'report.json'));
});

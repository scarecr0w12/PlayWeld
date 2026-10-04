#!/usr/bin/env node
// Real engine acceptance in the existing disposable fixture only.
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const spawn = require('cross-spawn');
const out = path.resolve(__dirname, '../.artifacts/extended-engine-acceptance');
const project = path.resolve(__dirname, '../.artifacts/live-engine-acceptance/projects/unity/game');
const editor =
  process.env.GC_ACCEPTANCE_UNITY || 'D:\\Unity\\Editor\\6000.6.0f1\\Editor\\Unity.exe';
const cli =
  process.env.GC_ACCEPTANCE_UNITY_CLI ||
  path.join(process.env.LOCALAPPDATA || '', 'Unity/bin/unity.exe');
const stage = process.argv[2];
fs.mkdirSync(out, { recursive: true });
const record = {
  schemaVersion: 1,
  stage,
  startedAt: new Date().toISOString(),
  host: process.platform,
  project,
  checks: [],
};
function save() {
  fs.writeFileSync(path.join(out, `${stage}.json`), JSON.stringify(record, null, 2));
}
async function run(name, command, args, timeout = 1200000) {
  const log = path.join(out, `${name}.log`),
    stream = fs.createWriteStream(log);
  const child = spawn(command, args, {
    cwd: project,
    windowsHide: true,
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  child.stdout.pipe(stream, { end: false });
  child.stderr.pipe(stream, { end: false });
  let timedOut = false;
  const timer = setTimeout(() => {
    timedOut = true;
    if (process.platform === 'win32') spawn('taskkill', ['/PID', String(child.pid), '/T', '/F']);
    else child.kill('SIGKILL');
  }, timeout);
  let code;
  try {
    code = await new Promise((resolve, reject) => {
      child.once('error', reject);
      child.once('close', resolve);
    });
  } finally {
    clearTimeout(timer);
    await new Promise((resolve) => stream.end(resolve));
  }
  record.checks.push({
    name,
    passed: code === 0 && !timedOut,
    command,
    args,
    exitCode: code,
    timedOut,
    log,
  });
  save();
  assert.equal(timedOut, false, `${name} timed out`);
  assert.equal(code, 0, `Inspect ${log}`);
}
(async () => {
  if (stage.startsWith('build-')) {
    assert.equal(process.platform, 'win32');
    fs.cpSync(
      path.join(__dirname, 'fixtures/engine-acceptance/unity/Assets'),
      path.join(project, 'Assets'),
      { recursive: true },
    );
    const manifestPath = path.join(project, 'Packages/manifest.json'),
      manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
    manifest.dependencies['com.unity.modules.audio'] = '1.0.0';
    delete manifest.dependencies['com.unity.modules.inputlegacy'];
    manifest.dependencies['com.unity.modules.imageconversion'] = '1.0.0';
    fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));
    const method = { 'build-windows': 'Windows', 'build-linux': 'Linux', 'build-web': 'Web' }[
      stage
    ];
    assert.ok(method);
    await run(stage, editor, [
      '-batchmode',
      '-quit',
      '-projectPath',
      project,
      '-executeMethod',
      `ExtendedAcceptanceBuild.${method}`,
      '-logFile',
      path.join(out, `${stage}-editor.log`),
    ]);
  } else if (stage === 'player-windows' || stage === 'player-linux') {
    const target =
      stage === 'player-windows' ? 'Windows/Acceptance.exe' : 'Linux/Acceptance.x86_64';
    const report = path.join(out, `${stage}-report.json`);
    fs.rmSync(report, { force: true });
    const executable = path.join(project, 'ExtendedBuild', target);
    if (stage === 'player-linux') fs.chmodSync(executable, 0o755);
    await run(
      stage,
      executable,
      [
        '-screen-width',
        '960',
        '-screen-height',
        '540',
        '-screen-fullscreen',
        '0',
        '-acceptanceOutput',
        report,
        '-logFile',
        path.join(out, `${stage}-player.log`),
      ],
      120000,
    );
    const result = JSON.parse(fs.readFileSync(report, 'utf8'));
    record.checks.push({ name: 'Renderer and audio assertions', passed: result.passed, result });
    save();
    assert.equal(result.passed, true);
  } else if (stage === 'unreal-linux') {
    assert.equal(process.platform, 'linux');
    const game = path.join(out, 'unreal-linux-project');
    record.project = game;
    fs.mkdirSync(game, { recursive: true });
    fs.chmodSync(game, 0o777);
    fs.writeFileSync(
      path.join(game, 'LinuxAcceptance.uproject'),
      JSON.stringify({
        FileVersion: 3,
        EngineAssociation: '5.8',
        Plugins: [{ Name: 'PythonScriptPlugin', Enabled: true }],
      }),
    );
    const script = path.join(game, 'check.py');
    fs.copyFileSync(
      path.join(__dirname, 'fixtures/engine-acceptance/unreal/linux_check.py'),
      script,
    );
    const ue =
      process.env.GC_ACCEPTANCE_UNREAL_LINUX ||
      '/mnt/d/Unreal/Linux_Unreal_Engine_5.8.1/Engine/Binaries/Linux/UnrealEditor';
    const args = [
      '--signal=TERM',
      '--kill-after=10',
      '240',
      ue,
      path.join(game, 'LinuxAcceptance.uproject'),
      '-run=PythonScript',
      `-script=${script}`,
      '-unattended',
      '-nullrhi',
      '-nop4',
      '-nosplash',
      `-abslog=${path.join(game, 'editor.log')}`,
    ];
    await run(
      'unreal-linux-commandlet',
      process.getuid() === 0 ? 'runuser' : 'timeout',
      process.getuid() === 0
        ? ['-u', process.env.GC_ACCEPTANCE_LINUX_USER || 'ubuntu', '--', 'timeout', ...args]
        : args,
      270000,
    );
    const result = JSON.parse(
      fs.readFileSync(path.join(game, 'Saved/linux-acceptance.json'), 'utf8'),
    );
    assert.equal(result.passed, true);
    record.checks.push({ name: 'Unreal Linux Python API assertion', passed: true, result });
  } else if (stage === 'unreal-audio') {
    assert.equal(process.platform, 'win32');
    const game = path.resolve(out, '../live-engine-acceptance/projects/unreal/game');
    record.project = game;
    const engine = process.env.GC_ACCEPTANCE_UNREAL || 'D:\\Unreal\\UE_5.8';
    const ue = path.join(engine, 'Engine/Binaries/Win64/UnrealEditor-Cmd.exe');
    fs.cpSync(
      path.join(__dirname, 'fixtures/engine-acceptance/unreal/Source'),
      path.join(game, 'Source'),
      { recursive: true },
    );
    fs.copyFileSync(
      path.join(__dirname, 'fixtures/engine-acceptance/unreal/create_audio_map.py'),
      path.join(game, 'create_audio_map.py'),
    );
    await run('unreal-audio-compile', path.join(engine, 'Engine/Build/BatchFiles/Build.bat'), [
      'AcceptanceEditor',
      'Win64',
      'Development',
      `-Project=${path.join(game, 'Acceptance.uproject')}`,
      '-WaitMutex',
      '-NoHotReloadFromIDE',
    ]);
    await run('unreal-audio-map', ue, [
      path.join(game, 'Acceptance.uproject'),
      '-run=pythonscript',
      `-script=${path.join(game, 'create_audio_map.py')}`,
      '-unattended',
      '-nullrhi',
      '-nop4',
      `-abslog=${path.join(out, 'unreal-audio-map-editor.log')}`,
    ]);
    fs.rmSync(path.join(game, 'Saved/AudioAcceptance'), { recursive: true, force: true });
    await run(
      'unreal-audio-runtime',
      ue,
      [
        path.join(game, 'Acceptance.uproject'),
        '/Game/AudioAcceptance',
        '-game',
        '-unattended',
        '-nullrhi',
        '-nop4',
        `-abslog=${path.join(out, 'unreal-audio-runtime-editor.log')}`,
      ],
      120000,
    );
    assert.equal(
      JSON.parse(fs.readFileSync(path.join(game, 'Saved/AudioAcceptance/collection.json'), 'utf8'))
        .collectionComplete,
      true,
    );
    for (const phase of ['playing', 'paused', 'resumed']) {
      const source = path.join(game, 'Saved/AudioAcceptance', `${phase}.wav`);
      const buffer = fs.readFileSync(source);
      assert.equal(buffer.toString('ascii', 0, 4), 'RIFF');
      let data, bits, format, sampleRate;
      for (let offset = 12; offset + 8 <= buffer.length;) {
        const name = buffer.toString('ascii', offset, offset + 4),
          size = buffer.readUInt32LE(offset + 4);
        assert.ok(offset + 8 + size <= buffer.length, 'Truncated audio output');
        if (name === 'fmt ') {
          format = buffer.readUInt16LE(offset + 8);
          sampleRate = buffer.readUInt32LE(offset + 12);
          bits = buffer.readUInt16LE(offset + 22);
        }
        if (name === 'data') data = buffer.subarray(offset + 8, offset + 8 + size);
        offset += 8 + size + (size % 2);
      }
      assert.equal(format, 1);
      assert.equal(bits, 16);
      assert.ok(data?.length > 4096);
      let peak = 0,
        squares = 0;
      for (let index = 0; index < data.length; index += 2) {
        const value = data.readInt16LE(index) / 32768;
        peak = Math.max(peak, Math.abs(value));
        squares += value * value;
      }
      const passed = phase === 'paused' ? peak < 0.001 : peak > 0.01;
      record.checks.push({
        name: `Unreal master audio ${phase}`,
        passed,
        peak,
        rms: Math.sqrt(squares / (data.length / 2)),
        sampleRate,
        bytes: data.length,
      });
      save();
      assert.ok(passed);
      fs.copyFileSync(source, path.join(out, `unreal-${phase}.wav`));
    }
  } else if (stage === 'unity-platform' || stage === 'unreal-platform') {
    assert.equal(process.platform, 'win32');
    const { PlatformService } = require('../packages/platform-service/lib/service');
    const { resolvePaths } = require('../packages/platform-service/lib/paths');
    const { connect } = require('@gamecrafter/service-client');
    const paths = resolvePaths({
      ...process.env,
      GAMECRAFTER_PROFILE_DIR: path.resolve(out, '../live-engine-acceptance/profile'),
    });
    const service = await PlatformService.start({ paths, platformVersion: '0.1.0' });
    let client;
    try {
      client = await connect({
        socketPath: service.socketPath,
        token: fs.readFileSync(paths.tokenPath, 'utf8').trim(),
        clientName: 'extended-engine-acceptance',
        clientVersion: '0.1.0',
      });
      const family = stage === 'unity-platform' ? 'unity' : 'unreal';
      const fixture = JSON.parse(
        fs.readFileSync(path.resolve(out, '../live-engine-acceptance/projects.json'), 'utf8'),
      )[family];
      const game = path.join(fixture.path, 'game');
      record.project = game;
      await client.call('settings/set', {
        key: 'access.mode',
        scope: 'project',
        projectId: fixture.projectId,
        value: 'full',
      });
      const connection = await client.call('mcp/add', {
        config: {
          name: `${family}-live-${Date.now()}`,
          scope: 'project',
          projectId: fixture.projectId,
          mode: 'command',
          command: {
            command: family === 'unity' ? cli : process.execPath,
            args:
              family === 'unity'
                ? ['mcp', '--project-path', game, '--non-interactive']
                : [
                    path.join(__dirname, 'codefizz-acceptance-mcp.cjs'),
                    path.join(game, 'Acceptance.uproject'),
                  ],
            cwd: game,
            env: {
              LOCALAPPDATA: process.env.LOCALAPPDATA || 'C:\\Users\\jacob\\AppData\\Local',
              USERPROFILE: process.env.USERPROFILE || 'C:\\Users\\jacob',
              APPDATA: process.env.APPDATA || 'C:\\Users\\jacob\\AppData\\Roaming',
            },
          },
          tags: ['live-editor'],
          enabled: false,
        },
      });
      try {
        await client.call('mcp/connect', { connectionId: connection.connectionId });
        await client.call('mcp/classifyTool', {
          connectionId: connection.connectionId,
          toolName: family === 'unity' ? 'editor_status' : 'project_identity',
          sideEffects: 'none',
          executionMode: 'live-editor',
        });
        await client.call('mcp/classifyTool', {
          connectionId: connection.connectionId,
          toolName: 'screenshot',
          sideEffects: 'workspace-write',
          executionMode: 'live-editor',
        });
        await client.call('engine/setLiveBridge', {
          projectId: fixture.projectId,
          connectionId: connection.connectionId,
        });
        const capability = await client.call('engine/capabilities', {
          projectId: fixture.projectId,
          refresh: true,
        });
        record.checks.push({
          name: `Platform proves live ${family} Project identity`,
          passed: capability.layers['live-editor'].status === 'ready',
          result: capability,
        });
        save();
        assert.equal(capability.layers['live-editor'].status, 'ready');
        const capture = await client.call('engine/run', {
          projectId: fixture.projectId,
          operation: 'screenshot',
          params: family === 'unity' ? { view: 'scene' } : {},
        });
        const screenshot = capture.artifacts.find((artifact) => artifact.kind === 'screenshot');
        record.checks.push({
          name: `Platform captures real ${family} screenshot artifact`,
          passed: capture.status === 'succeeded' && Boolean(screenshot),
          result: capture,
        });
        save();
        assert.equal(capture.status, 'succeeded');
        assert.ok(screenshot);
        fs.copyFileSync(
          path.join(fixture.path, screenshot.path),
          path.join(out, `${family}-editor.png`),
        );
        await client.call('settings/set', {
          key: 'access.restricted.allowedSideEffects',
          scope: 'project',
          projectId: fixture.projectId,
          value: ['none', 'internal-write'],
        });
        await client.call('settings/set', {
          key: 'access.mode',
          scope: 'project',
          projectId: fixture.projectId,
          value: 'restricted',
        });
        const { RpcErrorCode } = require('@gamecrafter/contracts');
        const denied = await client
          .call('engine/run', { projectId: fixture.projectId, operation: 'screenshot' })
          .catch((error) => {
            assert.equal(error.code, RpcErrorCode.ToolDenied);
            return { status: 'denied' };
          });
        if (denied.status !== 'denied') {
          assert.equal(denied.status, 'failed');
          assert.match(denied.summary, /not allowed in restricted mode/i);
          assert.deepEqual(denied.command, []);
          assert.ok(!denied.artifacts.some((artifact) => artifact.kind === 'screenshot'));
        }
        record.checks.push({
          name: `Restricted access denies ${family} live screenshot writes`,
          passed: true,
          result: denied,
        });
        save();
        await client.call('settings/set', {
          key: 'access.mode',
          scope: 'project',
          projectId: fixture.projectId,
          value: 'full',
        });
      } finally {
        await client.call('mcp/disconnect', { connectionId: connection.connectionId });
      }
    } finally {
      await client?.close();
      await service.stop();
    }
  } else if (stage === 'unity-mcp') {
    const { Client } = require('@modelcontextprotocol/sdk/client/index.js');
    const { StdioClientTransport } = require('@modelcontextprotocol/sdk/client/stdio.js');
    const client = new Client({ name: 'gamecrafter-live-acceptance', version: '0.1.0' });
    try {
      await client.connect(
        new StdioClientTransport({
          command: cli,
          args: ['mcp', '--project-path', project, '--non-interactive'],
        }),
      );
      const tools = await client.listTools();
      fs.writeFileSync(path.join(out, 'unity-mcp-tools.json'), JSON.stringify(tools, null, 2));
      record.checks.push({
        name: 'Official Unity MCP handshake',
        passed: true,
        toolCount: tools.tools.length,
      });
      record.checks.push({ name: 'Editor command tools exposed', passed: tools.tools.length > 0 });
      save();
      assert.ok(
        tools.tools.length > 0,
        'No editor tools: install Pipeline and open fixture Editor',
      );
    } finally {
      await client.close();
    }
  } else
    throw new Error(
      'Stage must be build-windows, build-linux, build-web, player-windows, player-linux, unity-mcp, unity-platform, unreal-platform, unreal-audio, or unreal-linux',
    );
  record.passed = record.checks.length > 0 && record.checks.every((c) => c.passed);
  save();
  console.log(JSON.stringify(record, null, 2));
})().catch((error) => {
  record.passed = false;
  record.error = error.stack;
  save();
  console.error(error);
  process.exitCode = 1;
});

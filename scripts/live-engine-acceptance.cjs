#!/usr/bin/env node
/* Windows-only, disposable live acceptance. Never opens an existing user project. */
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const spawn = require('cross-spawn');
const { PlatformService } = require('../packages/platform-service/lib/service');
const { resolvePaths } = require('../packages/platform-service/lib/paths');
const { connect } = require('@gamecrafter/service-client');
const { RpcErrorCode } = require('@gamecrafter/contracts');
const root = path.resolve(__dirname, '..');
const out = path.resolve(
  process.env.GAMECRAFTER_ACCEPTANCE_OUTPUT ?? path.join(root, '.artifacts', 'live-engine-acceptance'),
);
const unity = process.env.GC_ACCEPTANCE_UNITY || 'D:\\Unity\\Editor\\6000.6.0f1\\Editor\\Unity.exe';
const unrealRoot = process.env.GC_ACCEPTANCE_UNREAL || 'D:\\Unreal\\UE_5.8';
const ue = path.join(unrealRoot, 'Engine', 'Binaries', 'Win64', 'UnrealEditor-Cmd.exe');
const stage = process.argv[2] || 'baseline';
const version = require('../packages/platform-service/package.json').version;
assert(['baseline', 'access', 'compile-unreal', 'map-unreal', 'cli-unity', 'tests', 'package', 'player'].includes(stage), 'Unknown acceptance stage');
const record = {
  stage,
  startedAt: new Date().toISOString(),
  host: process.platform,
  unity,
  unrealRoot,
  checks: [],
};
let service, client;
fs.mkdirSync(out, { recursive: true });
function save() {
  fs.writeFileSync(path.join(out, `${stage}.json`), JSON.stringify(record, null, 2));
}
async function check(name, fn) {
  console.log(`START ${name}`);
  try {
    const result = await fn();
    record.checks.push({ name, passed: true, result });
    console.log(`PASS ${name}`);
    return result;
  } catch (error) {
    record.checks.push({ name, passed: false, error: error.stack });
    console.log(`FAIL ${name}: ${error.message}`);
  } finally {
    save();
  }
}
async function processRun(name, exe, args, timeout = 1800000) {
  const log = path.join(out, `${name}.log`);
  const stream = fs.createWriteStream(log);
  const started = Date.now();
  const child = spawn(exe, args, {
    cwd: out,
    windowsHide: true,
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  child.stdout.pipe(stream, { end: false });
  child.stderr.pipe(stream, { end: false });
  let timedOut = false;
  const timer = setTimeout(() => {
    timedOut = true;
    spawn('taskkill', ['/PID', String(child.pid), '/T', '/F']);
  }, timeout);
  const code = await new Promise((resolve, reject) => {
    child.once('error', reject);
    child.once('close', resolve);
  }).finally(async () => {
    clearTimeout(timer);
    await new Promise((resolve) => stream.end(resolve));
  });
  const result = { exe, args, exitCode: code, timedOut, durationMs: Date.now() - started, log };
  record.checks.push({ name, passed: code === 0 && !timedOut, result });
  save();
  assert.equal(timedOut, false);
  assert.equal(code, 0, `Inspect ${log}`);
  return result;
}
async function run(project, operation, params = {}) {
  const result = await client.call('engine/run', {
    projectId: project.projectId,
    operation,
    params,
  });
  console.log(`${project.engine.family}/${operation}: ${result.status} ${result.summary}`);
  return result;
}
async function mode(project, value) {
  await client.call('settings/set', {
    key: 'access.mode',
    scope: 'project',
    projectId: project.projectId,
    value,
  });
}
async function approval(project, approve) {
  const pending = run(
    project,
    'test',
    project.engine.family === 'unity'
      ? { testPlatform: 'EditMode' }
      : { filter: 'GameCrafter.Acceptance' },
  );
  const observed = pending.then(
    (value) => ({ value }),
    (error) => ({ error }),
  );
  let entry;
  for (let i = 0; i < 200; i++) {
    const list = await client.call('broker/approvals', {
      projectId: project.projectId,
      pendingOnly: true,
    });
    entry = list.approvals.find((a) => a.toolId === 'engine/test');
    if (entry) break;
    await new Promise((r) => setTimeout(r, 50));
  }
  assert.ok(entry, 'Own fixture must request approval');
  await client.call('broker/approve', {
    projectId: project.projectId,
    approvalId: entry.approvalId,
    approve,
    reason: 'Explicit live acceptance in disposable fixture',
  });
  return observed;
}
(async () => {
  assert.equal(process.platform, 'win32', 'Run with the native Windows Node 24 installation.');
  const paths = resolvePaths({
    ...process.env,
    GAMECRAFTER_PROFILE_DIR: path.join(out, 'profile'),
  });
  service = await PlatformService.start({ paths, platformVersion: version });
  client = await connect({
    socketPath: service.socketPath,
    token: fs.readFileSync(paths.tokenPath, 'utf8').trim(),
    clientName: 'live-engine-acceptance',
    clientVersion: version,
  });
  let projects;
  const state = path.join(out, 'projects.json');
  if (fs.existsSync(state)) projects = JSON.parse(fs.readFileSync(state, 'utf8'));
  else {
    projects = {};
    for (const family of ['unity', 'unreal']) {
      const project = await client.call('project/create', {
        name: `Live ${family} Acceptance`,
        engine: { family, preferredVersion: family === 'unity' ? '6000.6.0f1' : '5.8.3' },
        parentDirectory: path.join(out, 'projects'),
        folderName: family,
      });
      projects[family] = project;
      fs.cpSync(
        path.join(__dirname, 'fixtures', 'engine-acceptance', family),
        path.join(project.path, 'game'),
        { recursive: true },
      );
    }
    fs.writeFileSync(state, JSON.stringify(projects, null, 2));
    for (const install of [
      { family: 'unity', kind: 'editor', executable: unity },
      { family: 'unreal', kind: 'commandlet', executable: ue },
      {
        family: 'unreal',
        kind: 'uat',
        executable: path.join(unrealRoot, 'Engine', 'Build', 'BatchFiles', 'RunUAT.bat'),
      },
    ])
      await client.call('engine/addInstallation', install);
  }
  if (stage === 'compile-unreal') {
    const p = path.join(projects.unreal.path, 'game', 'Acceptance.uproject');
    await check('Unreal Editor C++ compilation', () =>
      processRun(
        'unreal-editor-build',
        path.join(unrealRoot, 'Engine', 'Build', 'BatchFiles', 'Build.bat'),
        [
          'AcceptanceEditor',
          'Win64',
          'Development',
          `-Project=${p}`,
          '-WaitMutex',
          '-NoHotReload',
          '-NoHotReloadFromIDE',
        ],
      ),
    );
    return;
  }
  if (stage === 'map-unreal') {
    const game = path.join(projects.unreal.path, 'game');
    await check('Unreal map creation', async () => {
      const result = await processRun('unreal-create-map', ue, [
        path.join(game, 'Acceptance.uproject'),
        '-run=pythonscript',
        `-script=${path.join(game, 'create_map.py')}`,
        '-stdout',
        '-FullStdOutLogOutput',
        '-unattended',
        '-nullrhi',
        '-nop4',
      ]);
      assert.ok(fs.readFileSync(result.log, 'utf8').includes('GAMECRAFTER_MAP_ACCEPTANCE_PASSED'));
      assert.ok(fs.existsSync(path.join(game, 'Content', 'Acceptance.umap')));
      return result;
    });
    return;
  }
  if (stage === 'cli-unity') {
    const project = projects.unity;
    const installations = (await client.call('engine/installations', { family: 'unity' }))
      .installations;
    const editors = installations.filter((installation) => installation.kind === 'editor');
    assert.ok(
      installations.some((installation) => installation.kind === 'cli'),
      'Unity CLI is not installed',
    );
    try {
      for (const editor of editors)
        await client.call('engine/removeInstallation', { installationId: editor.installationId });
      await mode(project, 'full');
      await check('Unity CLI tool version is separate from editor evidence', async () => {
        const report = await client.call('engine/capabilities', {
          projectId: project.projectId,
          refresh: true,
        });
        assert.equal(report.engineVersion.detected, null);
        assert.equal(report.engineVersion.matches, null);
        return report;
      });
      await check('Unity CLI runs real EditMode tests', async () => {
        const result = await run(project, 'test', { testPlatform: 'EditMode', editorPath: unity });
        assert.equal(result.status, 'succeeded');
        assert.ok(result.command.includes('--mode'));
        return result;
      });
    } finally {
      for (const editor of editors)
        await client.call('engine/addInstallation', {
          family: 'unity',
          kind: 'editor',
          executable: editor.executable,
        });
    }
    return;
  }
  const outcomes = await Promise.allSettled(
    Object.entries(projects).map(async ([family, project]) => {
      await check(`${family}: capability identity/version`, async () => {
        const cap = await client.call('engine/capabilities', {
          projectId: project.projectId,
          refresh: true,
        });
        assert.equal(cap.projectIdentity.proven, true);
        assert.equal(cap.engineVersion.matches, true);
        assert.equal(
          cap.operations.find((operation) => operation.operation === 'test').reason,
          null,
        );
        return cap;
      });
      if (stage === 'baseline' || stage === 'access') {
        await check(`${family}: Restricted rejects tests`, async () => {
          await mode(project, 'restricted');
          await client.call('settings/set', {
            key: 'access.restricted.allowedSideEffects',
            scope: 'project',
            projectId: project.projectId,
            value: ['none', 'internal-write'],
          });
          await assert.rejects(run(project, 'test'), { code: RpcErrorCode.ToolDenied });
          const runs = (await client.call('engine/runs', { projectId: project.projectId })).runs;
          const latest = runs[0];
          assert.ok(latest);
          assert.deepEqual(latest.command, []);
          assert.equal(latest.artifacts.length, 0);
          return latest;
        });
        await check(`${family}: Ask always denies tests`, async () => {
          await mode(project, 'ask-always');
          const result = await approval(project, false);
          assert.equal(result.error?.code, RpcErrorCode.ToolDenied);
          return 'denied';
        });
        await check(`${family}: Ask always approves tests`, async () => {
          const result = await approval(project, true);
          assert.equal(result.value?.status, 'succeeded');
          return result.value;
        });
        await check(`${family}: version mismatch is reported`, async () => {
          const file = path.join(project.path, 'gamecrafter.project.json');
          const original = fs.readFileSync(file, 'utf8');
          try {
            const manifest = JSON.parse(original);
            manifest.engine.preferredVersion = '0.0';
            fs.writeFileSync(file, JSON.stringify(manifest, null, 2));
            const cap = await client.call('engine/capabilities', {
              projectId: project.projectId,
              refresh: true,
            });
            assert.equal(cap.engineVersion.matches, false);
            const threads = (await client.call('board/threads', { projectId: project.projectId }))
              .threads;
            assert.ok(threads.some((t) => t.title === 'Engine'));
            return cap.engineVersion;
          } finally {
            fs.writeFileSync(file, original);
            await client.call('engine/capabilities', {
              projectId: project.projectId,
              refresh: true,
            });
          }
        });
        await check(`${family}: missing native identity blocks execution`, async () => {
          const file = path.join(
            project.path,
            'game',
            family === 'unity' ? 'ProjectSettings/ProjectVersion.txt' : 'Acceptance.uproject',
          );
          const temporary = file + '.acceptance-backup';
          fs.renameSync(file, temporary);
          try {
            await client.call('engine/capabilities', {
              projectId: project.projectId,
              refresh: true,
            });
            await mode(project, 'full');
            await assert.rejects(run(project, 'test'), {
              code: RpcErrorCode.EngineProjectIdentityUnproven,
            });
            return 'denied';
          } finally {
            fs.renameSync(temporary, file);
            await client.call('engine/capabilities', {
              projectId: project.projectId,
              refresh: true,
            });
          }
        });
        if (stage === 'baseline') {
          await mode(project, 'full');
          await check(`${family}: original connector test`, () =>
            run(
              project,
              'test',
              family === 'unity'
                ? { testPlatform: 'EditMode' }
                : { filter: 'GameCrafter.Acceptance' },
            ),
          );
        }
      } else if (stage === 'tests') {
        await mode(project, 'full');
        for (const params of family === 'unity'
          ? [{ testPlatform: 'EditMode' }, { testPlatform: 'PlayMode' }]
          : [{ filter: 'GameCrafter.Acceptance' }])
          await check(`${family}: ${params.testPlatform || params.filter}`, async () => {
            const result = await run(project, 'test', params);
            assert.equal(result.status, 'succeeded');
            return result;
          });
        await check(`${family}: missing filter fails closed`, async () => {
          const result = await run(
            project,
            'test',
            family === 'unity'
              ? { testFilter: 'GameCrafter.NoSuchTest' }
              : { filter: 'GameCrafter.NoSuchTest' },
          );
          assert.equal(result.status, 'failed');
          return result;
        });
        await check(`${family}: mismatched family rejected`, async () => {
          await assert.rejects(
            run(project, 'test', { family: family === 'unity' ? 'unreal' : 'unity' }),
            { code: RpcErrorCode.EngineFamilyMismatch },
          );
          return 'denied';
        });
      } else if (stage === 'package') {
        await mode(project, 'full');
        await check(`${family}: build/package`, async () => {
          const result = await run(
            project,
            'build',
            family === 'unity' ? { method: 'AcceptanceBuild.Build' } : { platform: 'Win64' },
          );
          assert.equal(result.status, 'succeeded');
          return result;
        });
      } else if (stage === 'player') {
        await check(`${family}: packaged runtime`, async () => {
          let exe, report;
          if (family === 'unity') {
            exe = path.join(project.path, 'game', 'Build', 'Acceptance.exe');
            report = path.join(path.dirname(exe), 'player-acceptance.json');
          } else {
            const builds = (
              await client.call('engine/runs', { projectId: project.projectId })
            ).runs.filter((r) => r.operation === 'build' && r.status === 'succeeded');
            assert.ok(builds.length);
            exe = path.join(
              project.path,
              '.gamecrafter',
              'engine-runs',
              builds[0].runId,
              'archive',
              'Windows',
              'Acceptance.exe',
            );
            report = path.join(path.dirname(exe), 'Acceptance', 'Saved', 'player-acceptance.json');
          }
          if (fs.existsSync(report)) fs.unlinkSync(report);
          const result = await processRun(
            `${family}-player`,
            exe,
            family === 'unity'
              ? ['-batchmode', '-nographics', '-logFile', path.join(out, 'unity-player-engine.log')]
              : ['-nullrhi', '-unattended', '-nosplash', '-stdout', '-FullStdOutLogOutput'],
            180000,
          );
          const parsed = JSON.parse(fs.readFileSync(report, 'utf8'));
          assert.equal(parsed.passed, true);
          assert.equal(parsed.assertions, 3);
          return { process: result, report, assertions: parsed };
        });
      }
    }),
  );
  for (const result of outcomes) if (result.status === 'rejected') throw result.reason;
})()
  .catch((error) => {
    record.fatal = error.stack;
    process.exitCode = 1;
    console.error(error);
  })
  .finally(async () => {
    await client?.close();
    await service?.stop();
    record.finishedAt = new Date().toISOString();
    save();
    if (record.checks.some((c) => !c.passed)) process.exitCode = 1;
  });

// SPDX-License-Identifier: Apache-2.0
const { spawnSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const out = path.resolve('.artifacts/windows-isolation', String(Date.now()));
fs.mkdirSync(out, { recursive: true });
const script = "new (require('./packages/platform-service/lib/plugins/isolation/appcontainer-launcher').AppContainerLauncher)().probe().then(report=>{console.log(JSON.stringify(report));if(!report.available)process.exitCode=1;})";
const reports = [];
const targets = [['node', process.execPath, {}], ['electron-node', require('electron'), { ELECTRON_RUN_AS_NODE: '1' }]];
const installedOption = process.argv.indexOf('--installed-executable');
if (installedOption !== -1) {
  const executable = process.argv[installedOption + 1];
  assert(executable && fs.statSync(executable).isFile(), 'Existing installed executable required.');
  targets.push(['installed-electron', path.resolve(executable), { ELECTRON_RUN_AS_NODE: '1' }]);
}
for (const [name, exe, extraEnv] of targets) {
  const run = spawnSync(exe, ['-e', script], { cwd: process.cwd(), env: { ...process.env, ...extraEnv }, encoding: 'utf8', windowsHide: true, timeout: 30000 });
  const record = { name, executable: exe, exitCode: run.status, stdout: run.stdout, stderr: run.stderr, error: run.error?.message };
  if (run.stdout?.trim()) record.report = JSON.parse(run.stdout.trim());
  reports.push(record);
  fs.writeFileSync(path.join(out, 'report.json'), JSON.stringify(reports, null, 2));
  assert.equal(run.status, 0, `${name}: ${run.stderr || run.error?.message}`);
  assert.equal(record.report?.available, true, `${name}: native report required`);
}
async function descendantAcceptance() {
  const { AppContainerLauncher } = require('../packages/platform-service/lib/plugins/isolation/appcontainer-launcher');
  // Native mandatory-label changes require ownership rights unavailable in some managed workspace ACLs.
  const fixtureRoot = fs.mkdtempSync(path.join(require('node:os').tmpdir(), 'pw-lpac-job-'));
  const pluginDir = path.join(fixtureRoot, 'plugin'), scratchDir = path.join(fixtureRoot, 'scratch');
  fs.mkdirSync(pluginDir); fs.mkdirSync(scratchDir);
  const worker = path.join(pluginDir, 'descendants.cjs');
  fs.writeFileSync(worker, "const child=require('node:child_process').spawn(process.execPath,['--preserve-symlinks','--preserve-symlinks-main','-e','setInterval(()=>{},1000)'],{stdio:'ignore'});child.once('spawn',()=>console.log(JSON.stringify({parent:process.pid,descendant:child.pid})));child.once('error',error=>{console.error(error.message);process.exit(1)});setInterval(()=>{},1000);");
  const helper = new AppContainerLauncher().launch({ command: process.execPath, args: [worker], env: {}, cwd: pluginDir, readOnlyPaths: [pluginDir], readWritePaths: [scratchDir], network: false, pluginDir, scratchDir });
  let pids, diagnostic = '';
  helper.stderr.on('data', bytes => { diagnostic += bytes.toString(); });
  const alive = pid => { try { process.kill(pid, 0); return true; } catch(error) { if(error.code === 'ESRCH') return false; throw error; } };
  try {
    pids = await new Promise((resolve, reject) => {
      let output = '';
      const deadline = setTimeout(() => reject(new Error('Owned descendant fixture timed out: ' + diagnostic)), 15000);
      helper.stdout.on('data', bytes => { output += bytes.toString(); if(output.includes('\n')) { clearTimeout(deadline); try { resolve(JSON.parse(output.trim())); } catch(error) { reject(error); } } });
      helper.once('error', error => { clearTimeout(deadline); reject(error); });
      helper.once('exit', code => { clearTimeout(deadline); reject(new Error('Owned helper exited before fixture readiness: ' + code + ' ' + diagnostic)); });
    });
    assert(Number.isInteger(pids.parent) && Number.isInteger(pids.descendant));
    assert(alive(pids.parent) && alive(pids.descendant), 'Both owned processes started');
    const closed = new Promise(resolve => helper.once('exit', resolve));
    helper.kill(); await closed;
    const deadline = Date.now() + 5000;
    while ((alive(pids.parent) || alive(pids.descendant)) && Date.now() < deadline) await new Promise(resolve => setTimeout(resolve, 100));
    assert(!alive(pids.parent) && !alive(pids.descendant), 'Closing the Job kills the worker and descendant');
    reports.push({ name: 'job-descendants', fixtureRoot, pids, terminated: true });
  } finally {
    helper.kill();
    if(pids) for(const pid of Object.values(pids)) { if(Number.isInteger(pid) && alive(pid)) process.kill(pid); }
    fs.writeFileSync(path.join(out, 'report.json'), JSON.stringify(reports, null, 2));
  }
}
descendantAcceptance().then(() => console.log(JSON.stringify({ out, reports }, null, 2))).catch(error => { console.error(error); process.exitCode = 1; });

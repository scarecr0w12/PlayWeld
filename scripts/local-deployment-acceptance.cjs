// SPDX-License-Identifier: Apache-2.0
// Explicit local upgrade acceptance; credentials are compared only by fingerprints.
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const { createHash } = require('node:crypto');
const { setTimeout: delay } = require('node:timers/promises');
const { connect, discover } = require('@gamecrafter/service-client');
const { Database } = require('../packages/platform-service/lib/db/database');
const { resolvePaths } = require('../packages/platform-service/lib/paths');
const { profileMigrations } = require('../packages/platform-service/lib/profile/migrations');
const { projectMigrations } = require('../packages/platform-service/lib/projects/migrations');
const phase = process.argv[2], directory = path.resolve(process.argv[3] ?? ''), version = process.argv[4];
const evidenceRoot = path.resolve(__dirname, '../.artifacts/local-deployment');
assert.equal(process.platform, 'win32', 'Installed local upgrade acceptance requires Windows.');
assert(directory.startsWith(evidenceRoot + path.sep), 'Use a new owned .artifacts/local-deployment directory.');
assert(/^\d+\.\d+\.\d+$/.test(version ?? ''), 'An explicit release version is required.');
assert(['preflight', 'backup', 'verify', 'files'].includes(phase), 'Unknown acceptance phase.');
fs.mkdirSync(directory, { recursive: true });
const paths = resolvePaths();
const hash = data => createHash('sha256').update(data).digest('hex');
const save = (name, data) => fs.writeFileSync(path.join(directory, name + '.json'), JSON.stringify(data, null, 2));
async function client() {
  let failure;
  for (let attempt = 0; attempt < 120; attempt++) {
    try { return await connect({ ...await discover(), clientName: 'local-release-acceptance', clientVersion: version }); }
    catch (error) { failure = error; await delay(250); }
  }
  throw failure;
}
async function inspectLive() {
  const connection = await client();
  try {
    const info = await connection.call('service/info', {});
    assert.equal(path.resolve(info.profileDir), paths.profileDir);
    const projects = (await connection.call('project/list', {})).projects;
    const active = [];
    for (const project of projects) {
      const tasks = (await connection.call('task/list', { projectId: project.projectId, states: ['pending', 'ready', 'claimed', 'running', 'waiting_input', 'blocked'], limit: 10000 })).tasks;
      active.push(...tasks.map(task => ({ projectId: project.projectId, taskId: task.taskId, state: task.state })));
    }
    assert.equal(active.length, 0, 'Ordinary active/nonterminal tasks must finish or be deliberately paused before deployment.');
    return { info, projects: projects.map(p => ({ projectId: p.projectId, path: p.path })), active };
  } finally { connection.close(); }
}
function configuration(backup) {
  assert(fs.existsSync(paths.profileDbPath), 'Existing ordinary profile database required.');
  const db = Database.open(paths.profileDbPath);
  let state;
  try {
    assert.equal(db.prepare('PRAGMA integrity_check').get().integrity_check, 'ok');
    state = {
      projects: db.prepare('SELECT project_id, path FROM projects_registry ORDER BY project_id').all(),
      models: db.prepare('SELECT model_id, enabled FROM models ORDER BY model_id').all(),
      pricingHash: hash(JSON.stringify(db.prepare('SELECT model_id, pricing FROM models ORDER BY model_id').all())),
      pools: db.prepare('SELECT pool_id, model_ids FROM model_pools ORDER BY pool_id').all(),
      settingsHash: hash(JSON.stringify(db.prepare('SELECT key, value FROM settings_values ORDER BY key').all())),
      accountsHash: hash(JSON.stringify(db.prepare('SELECT account_id, provider_kind, base_url, credential_ref, has_credential, headers, is_local, privacy, enabled FROM provider_accounts ORDER BY account_id').all())),
      credentialKeyHash: hash(fs.readFileSync(path.join(paths.profileDir, 'credentials.key'))),
      projectState: [],
    };
    if (backup) db.snapshotTo(path.join(directory, 'profile.sqlite'));
    if (phase === 'verify') assert.equal(db.prepare('SELECT MAX(id) AS id FROM schema_migrations').get().id, Math.max(...profileMigrations.map(m => m.id)));
  } finally { db.close(); }
  for (const project of state.projects) {
    const projectFile = path.join(project.path, '.gamecrafter/project.sqlite');
    assert(fs.existsSync(projectFile), 'Registered Project database must exist: ' + project.project_id);
    const projectDb = Database.open(projectFile);
    try {
      assert.equal(projectDb.prepare('PRAGMA integrity_check').get().integrity_check, 'ok');
      state.projectState.push({ projectId: project.project_id, tasks: projectDb.prepare('SELECT task_id, state FROM tasks ORDER BY task_id').all(), settingsHash: hash(JSON.stringify(projectDb.prepare('SELECT key, value FROM settings_overrides ORDER BY key').all())) });
      if (backup) projectDb.snapshotTo(path.join(directory, project.project_id + '.sqlite'));
      if (phase === 'verify') assert.equal(projectDb.prepare('SELECT MAX(id) AS id FROM schema_migrations').get().id, Math.max(...projectMigrations.map(m => m.id)));
    } finally { projectDb.close(); }
  }
  return state;
}
async function main() {
  if (phase === 'files') {
    const stage = path.resolve('Windows-Release', version, 'app'), installed = 'C:/Program Files/GameCrafter';
    const roots = ['resources/app/node_modules/@gamecrafter/platform-service/lib', 'resources/app/node_modules/@gamecrafter/theia-control-room/lib', 'resources/app/node_modules/@gamecrafter/contracts/lib'];
    const files = ['GameCrafter.exe', 'resources/app/package.json', 'resources/app/lib/frontend/bundle.js', 'resources/app/lib/frontend/bundle.css'];
    for (const root of roots) for (const file of fs.readdirSync(path.join(stage, root), { recursive: true })) if (fs.statSync(path.join(stage, root, file)).isFile()) files.push(path.join(root, file));
    for (const file of files) assert.equal(hash(fs.readFileSync(path.join(installed, file))), hash(fs.readFileSync(path.join(stage, file))), 'Installed file matches stage: ' + file);
    assert.equal(JSON.parse(fs.readFileSync(path.join(installed, 'resources/app/package.json'))).version, version);
    save('installed-files', { version, matchedFiles: files.length, files });
    console.log(JSON.stringify({ version, matchedFiles: files.length })); return;
  }
  const live = await inspectLive(); save(phase + '-service', live);
  if (phase === 'preflight') { const state = configuration(false); save('preflight', state); console.log(JSON.stringify({ version: live.info.serviceVersion, projects: state.projects.length, active: 0 })); return; }
  if (phase === 'backup') {
    assert(!fs.existsSync(path.join(directory, 'before.json')), 'Preserve an existing checkpoint.');
    const connection = await client();
    try { await connection.call('service/stop', { checkpoint: true }); } finally { connection.close(); }
    const deadline = Date.now() + 30000;
    while (fs.existsSync(paths.lockPath) && Date.now() < deadline) await delay(100);
    assert(!fs.existsSync(paths.lockPath), 'Old service completed checkpointed shutdown.');
    const state = configuration(true); save('before', state);
    fs.cpSync(paths.profileDir, path.join(directory, 'profile-backup'), { recursive: true, errorOnExist: true, force: false });
    save('backup', { profile: paths.profileDir, copiedTo: path.join(directory, 'profile-backup'), projects: state.projects.length, oldVersion: live.info.serviceVersion });
    console.log(JSON.stringify({ backup: directory, projects: state.projects.length })); return;
  }
  assert.equal(live.info.serviceVersion, version);
  const state = configuration(false), before = JSON.parse(fs.readFileSync(path.join(directory, 'before.json')));
  // SQLite rows have null prototypes, while persisted JSON has ordinary objects.
  // Compare serialized values by field and keep diagnostics free of full task/config dumps.
  for (const key of Object.keys(before)) assert.equal(hash(JSON.stringify(state[key])), hash(JSON.stringify(before[key])), 'Retained ordinary configuration: ' + key);
  save('after', state); save('retention', { version, projects: state.projects.length, models: state.models.length, pools: state.pools.length, retained: true });
  console.log(JSON.stringify({ version, projects: state.projects.length, models: state.models.length, pools: state.pools.length, retained: true }));
}
main().catch(error => { console.error(error.message); save('failure-' + phase, { message: error.message }); process.exitCode = 1; });

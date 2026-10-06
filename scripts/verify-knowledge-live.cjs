// Live acceptance against an owned, separate service process. No fake embedding provider.
// Credentials are read from the existing encrypted profile and passed only in memory.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { spawn, execFileSync } = require('node:child_process');
const { setTimeout: delay } = require('node:timers/promises');
const { randomBytes } = require('node:crypto');
const { connect } = require('@gamecrafter/service-client');
const { resolvePaths } = require('../packages/platform-service/lib/paths');
const { Database } = require('../packages/platform-service/lib/db/database');
const { CredentialStore } = require('../packages/platform-service/lib/profile/credential-store');
const { ModelRegistry } = require('../packages/platform-service/lib/models/model-registry');
const { createBuiltinModelProviders } = require('../packages/platform-service/lib/models/providers');

async function main() {
  const args = process.argv.slice(2);
  if (args.includes('--help')) {
    console.log('Usage: node scripts/verify-knowledge-live.cjs [--executable ABSOLUTE_EXE] [--output NEW_DIRECTORY] [--credential-profile PROFILE] [--provider-account ID]');
    return;
  }
  const options = {};
  for (let index = 0; index < args.length; index += 2) {
    assert(['--executable', '--output', '--credential-profile', '--provider-account'].includes(args[index]), 'Unknown argument');
    assert(args[index + 1], 'Argument value is required');
    options[args[index].slice(2)] = args[index + 1];
  }
  const root = path.resolve(options.output ?? path.join('.artifacts/knowledge-live', String(Date.now())));
  assert(!fs.existsSync(root), 'Choose a new output directory to preserve earlier evidence');
  fs.mkdirSync(root, { recursive: true });
  const executable = options.executable ? path.resolve(options.executable) : process.execPath;
  const serviceCli = options.executable
    ? path.join(path.dirname(executable), 'resources/app/node_modules/@gamecrafter/platform-service/lib/cli.js')
    : path.resolve('packages/platform-service/lib/cli.js');
  assert(fs.existsSync(executable) && fs.existsSync(serviceCli), 'Service runtime must exist');
  const version = JSON.parse(fs.readFileSync(path.join(path.dirname(serviceCli), '../package.json'), 'utf8')).version;
  const paths = resolvePaths({ ...process.env, GAMECRAFTER_PROFILE_DIR: path.join(root, 'profile') });
  const report = { schemaVersion: 1, startedAt: new Date().toISOString(), version, executable, root, profile: paths.profileDir, evidence: 'live separate-process service; native files and databases; no mocks', checks: [], blocked: [], failures: [] };
  let child, client, log;
  const save = () => fs.writeFileSync(path.join(root, 'report.json'), JSON.stringify(report, null, 2) + '\n');
  const check = (name, details = {}) => { report.checks.push({ name, ...details }); save(); console.log('PASS ' + name); };
  async function start() {
    log = fs.openSync(path.join(root, 'service.log'), 'a');
    const env = { ...process.env, GAMECRAFTER_PROFILE_DIR: paths.profileDir };
    if (options.executable) env.ELECTRON_RUN_AS_NODE = '1';
    else delete env.ELECTRON_RUN_AS_NODE;
    child = spawn(executable, [serviceCli, 'start', '--foreground'], { env, windowsHide: true, stdio: ['ignore', log, log] });
    let launchError;
    child.on('error', error => { launchError = error; });
    for (let attempt = 0; attempt < 120; attempt++) {
      if (launchError) throw new Error('Service process could not launch');
      if (child.exitCode !== null) throw new Error('Service exited during startup');
      if (fs.existsSync(paths.tokenPath)) {
        try {
          client = await connect({ socketPath: paths.socketPath, token: fs.readFileSync(paths.tokenPath, 'utf8').trim(), clientName: 'knowledge-live-acceptance', clientVersion: version });
          break;
        } catch { /* Owned service is starting. */ }
      }
      await delay(250);
    }
    assert(client, 'Owned service became reachable');
    const info = await client.call('service/info', {});
    assert.equal(info.serviceVersion, version);
    assert.equal(path.resolve(info.profileDir), paths.profileDir);
  }
  async function stop() {
    if (client) {
      await client.call('service/stop', { checkpoint: true });
      client.close(); client = undefined;
    }
    const deadline = Date.now() + 30000;
    while (child && child.exitCode === null && Date.now() < deadline) await delay(100);
    assert(!child || child.exitCode !== null, 'Owned service completed checkpointed shutdown');
    assert(!fs.existsSync(paths.lockPath), 'Owned service released its profile lock');
    child = undefined;
    if (log !== undefined) fs.closeSync(log);
    log = undefined;
  }
  async function task(projectId, taskId) {
    const deadline = Date.now() + 90000;
    while (Date.now() < deadline) {
      const result = await client.call('task/get', { projectId, taskId });
      if (result.state === 'succeeded') return result;
      if (['failed', 'cancelled', 'waiting_input'].includes(result.state)) throw new Error('Index task did not succeed: ' + result.state + ' code=' + (result.error?.code ?? 'none'));
      await delay(200);
    }
    throw new Error('Index task timed out');
  }
  async function reconcile(projectId, full = false) {
    const result = await client.call(full ? 'knowledge/index/rebuild' : 'knowledge/index/reconcile', { projectId, ...(full ? { full: true } : {}) });
    await task(projectId, result.taskId);
    return client.call('knowledge/index/status', { projectId });
  }
  const query = (projectId, text, extra = {}) => client.call('knowledge/search', { projectId, query: text, mode: 'lexical', limit: 20, ...extra });
  async function eventually(predicate, label) {
    const deadline = Date.now() + 45000;
    while (Date.now() < deadline) { if (await predicate()) return; await delay(250); }
    throw new Error(label);
  }
  try {
    await start(); check('Expected live service version and isolated profile');
    const project = await client.call('project/create', { name: 'Knowledge Acceptance Observatory', engine: { family: 'godot' }, modules: ['story'], parentDirectory: path.join(root, 'projects'), folderName: 'observatory' });
    const other = await client.call('project/create', { name: 'Knowledge Isolation Neighbor', engine: { family: 'godot' }, parentDirectory: path.join(root, 'projects'), folderName: 'neighbor' });
    report.project = project; report.otherProject = other; save();
    for (const entry of [project, other]) {
      await client.call('project/trust', { projectId: entry.projectId, trusted: true });
      await client.call('settings/set', { scope: 'project', projectId: entry.projectId, key: 'access.mode', value: 'full' });
    }
    const projectId = project.projectId;
    const write = (record, body) => client.call('knowledge/write', { projectId, record, body });
    const file = (relative, body) => { const target = path.join(project.path, relative); fs.mkdirSync(path.dirname(target), { recursive: true }); fs.writeFileSync(target, body); return target; };
    const location = await write({ id: 'loc.observatory', type: 'location', title: 'Mountain Observatory', status: 'accepted', module: 'story' }, 'The observatory stores astronomical charts above the cloud line.');
    let character = await write({ id: 'char.lyra', type: 'character', title: 'Lyra the Astronomer', status: 'draft', module: 'story', tags: ['astronomy'], references: [{ rel: 'located-in', target: 'loc.observatory', confidence: 1, source: 'author' }] }, 'Lyra studies the night sky with a telescope. Her original badge is amberbadge771.');
    check('Canon writes create indexed native Markdown with stable IDs and explicit references');
    const docPath = file('docs/OBSERVATORY.md', '# Observatory operations\n\nA brass telescope measures distant celestial bodies. The maintenance phrase is brassscope884.\n');
    file('game/src/observatory.ts', 'export const telescopeCalibration = "codecalibration992";\n');
    const assetPath = file('game/assets/chart.png', Buffer.from('binaryprivate665'));
    file('game/assets/chart.png.gamecrafter-provenance.json', JSON.stringify({ schemaVersion: 1, providerKind: 'meshy', providerTaskId: 'assetreceipt553' }));
    const thread = await client.call('board/createThread', { projectId, title: 'Observatory maintenance', kind: 'discussion', type: 'finding', body: 'The roof latch requires silverlatch338 before observing.' });
    const proposal = await client.call('board/post', { projectId, threadId: thread.thread.threadId, type: 'proposal', body: 'Synthetic acceptance decision: use the east dome.' });
    const decision = await client.call('board/bind', { projectId, messageId: proposal.messageId, title: 'Synthetic acceptance: use the east dome', statement: 'Observe from the east dome with decisiondome227.', confirmedByUser: true });
    await eventually(async () => (await client.call('board/decision', { projectId, decisionId: decision.decisionId })).decision.syncStatus === 'synchronized', 'Synthetic binding decision did not synchronize');
    file('docs/canon/characters/inactive.md', '---\nschemaVersion: 1\nid: char.inactive\ntype: character\ntitle: Inactive Keeper\nstatus: draft\nmodule: disabled-module\ntags: []\nreferences: []\nprovenance: []\n---\nThe hidden keeper uses inactivemark116.\n');
    const status = await reconcile(projectId);
    assert.equal(status.conflicts.length, 0); assert.equal(status.brokenReferences.length, 0);
    check('Gather canon, docs, code, board, binding decisions and asset sidecar metadata', { chunks: status.chunks, records: status.records });
    for (const [source, marker] of [['canon', 'amberbadge771'], ['docs', 'brassscope884'], ['code', 'codecalibration992'], ['board', 'silverlatch338'], ['decisions', 'decisiondome227'], ['assets', 'assetreceipt553']]) {
      const result = await query(projectId, marker, { sources: [source] });
      assert(result.hits.length > 0, 'Expected source marker: ' + source);
      assert(result.hits.every(hit => hit.source === source));
      const hit = result.hits.find(hit => hit.quote.text.includes(marker));
      assert(hit && hit.path && hit.revision && hit.citation && hit.quote.startLine > 0);
      check('Lexical source search and cited original text: ' + source, { path: hit.path, citation: hit.citation });
    }
    assert.equal((await query(projectId, 'binaryprivate665')).hits.length, 0);
    check('Asset binary content is excluded from text ingestion');
    assert.equal((await query(projectId, 'inactivemark116')).hits.length, 0);
    assert((await query(projectId, 'inactivemark116', { includeInactive: true })).hits.length > 0);
    check('Disabled modules are excluded by default and available with explicit inactive filter');
    character = await client.call('knowledge/setStatus', { projectId, recordId: character.id, status: 'accepted', justification: { kind: 'user', ref: 'live-acceptance-synthetic-record' } });
    assert(character.provenance.some(entry => entry.kind === 'user'));
    assert((await query(projectId, 'amberbadge771', { statuses: ['accepted'], recordTypes: ['character'] })).hits.some(hit => hit.recordId === character.id));
    assert.equal((await query(projectId, 'amberbadge771', { statuses: ['draft'] })).hits.length, 0);
    check('Status transition, user provenance and record/status search filters');
    const graph = await client.call('knowledge/graph', { projectId, recordId: character.id, depth: 2 });
    assert(graph.edges.some(edge => edge.source === character.id && edge.target === location.id));
    const detail = await client.call('knowledge/record', { projectId, recordId: location.id });
    assert(detail.inbound.some(ref => ref.recordId === character.id));
    check('Reference graph and inbound/outbound record relationships');
    execFileSync('git', ['add', 'docs', 'game'], { cwd: project.path, windowsHide: true });
    execFileSync('git', ['-c', 'user.name=Knowledge Acceptance', '-c', 'user.email=acceptance@example.invalid', 'commit', '-m', 'Commit synthetic knowledge acceptance sources'], { cwd: project.path, windowsHide: true, stdio: 'ignore' });
    await reconcile(projectId);
    character = (await client.call('knowledge/record', { projectId, recordId: character.id })).record;
    const oldRevision = character.revision;
    character = await write({ id: character.id, type: 'character', title: character.title, status: 'accepted', module: 'story', references: character.references }, 'Lyra maintains the telescope and catalogues distant stars. Her new badge is violetbadge772.');
    assert.notEqual(character.revision, oldRevision);
    assert.equal((await query(projectId, 'amberbadge771')).hits.length, 0);
    assert((await query(projectId, 'violetbadge772')).hits.some(hit => hit.recordId === character.id));
    check('Editing preserves record identity, changes committed revision to worktree and removes stale lexical content');
    fs.writeFileSync(docPath, '# Observatory operations\n\nThe maintenance phrase is watchupdate885.\n');
    await eventually(async () => (await query(projectId, 'watchupdate885')).hits.length > 0, 'Native file watcher failed to ingest updated document');
    assert.equal((await query(projectId, 'brassscope884')).hits.length, 0);
    check('Native file watcher ingests external edits without a manual rebuild');
    await client.call('board/edit', { projectId, messageId: thread.message.messageId, body: 'The revised roof latch requires goldenlatch339.' });
    await reconcile(projectId);
    assert((await query(projectId, 'goldenlatch339', { sources: ['board'] })).hits.length > 0);
    assert.equal((await query(projectId, 'silverlatch338', { sources: ['board'] })).hits.length, 0);
    check('Board editing refreshes indexed content and removes stale message text');
    const duplicate = file('docs/canon/duplicate.md', fs.readFileSync(path.join(project.path, character.path)));
    const conflict = await reconcile(projectId);
    assert(conflict.conflicts.some(entry => entry.id === character.id));
    await assert.rejects(() => client.call('knowledge/record', { projectId, recordId: character.id }));
    fs.unlinkSync(duplicate);
    assert.equal((await reconcile(projectId)).conflicts.length, 0);
    check('Duplicate canon IDs are reported, ambiguous reads rejected, and conflicts recover after removal');
    fs.unlinkSync(path.join(project.path, location.path));
    assert((await reconcile(projectId)).brokenReferences.some(entry => entry.target === location.id));
    await write({ id: location.id, type: 'location', title: location.title, status: 'accepted', module: 'story' }, 'The observatory stores astronomical charts above the cloud line.');
    assert.equal((await reconcile(projectId)).brokenReferences.length, 0);
    check('Broken references are diagnosed and recover when the target is restored');
    await client.call('knowledge/write', { projectId: other.projectId, record: { id: 'char.neighbor', type: 'character', title: 'Neighbor', status: 'accepted' }, body: 'Private neighboring evidence isolationsecret994.' });
    assert.equal((await query(projectId, 'isolationsecret994')).hits.length, 0);
    assert.equal((await query(other.projectId, 'violetbadge772')).hits.length, 0);
    check('Lexical search isolates both directions between two real Projects');
    const before = await reconcile(projectId);
    const after = await reconcile(projectId);
    assert.equal(before.chunks, after.chunks); assert.equal(before.records, after.records);
    assert.equal((await client.call('knowledge/record', { projectId, recordId: character.id })).record.revision, character.revision);
    check('Unchanged reconcile is idempotent for counts and record revision');
    const deletionPath = file('docs/DELETE_ME.md', 'deleteprobe446');
    await reconcile(projectId); assert((await query(projectId, 'deleteprobe446')).hits.length > 0);
    fs.unlinkSync(deletionPath); await reconcile(projectId);
    assert.equal((await query(projectId, 'deleteprobe446')).hits.length, 0);
    check('Deleting a native document removes its searchable index content');
    const sourcePaths = resolvePaths(options['credential-profile'] ? { ...process.env, GAMECRAFTER_PROFILE_DIR: path.resolve(options['credential-profile']) } : process.env);
    if (fs.existsSync(sourcePaths.profileDbPath)) {
      const db = Database.open(sourcePaths.profileDbPath);
      let runtime;
      try {
        const registry = new ModelRegistry(db, new CredentialStore(db, sourcePaths.profileDir), createBuiltinModelProviders());
        const account = registry.listAccounts().find(entry => entry.enabled && (options['provider-account'] ? entry.accountId === options['provider-account'] : entry.providerKind === 'openai'));
        if (account) runtime = registry.getRuntimeAccount(account.accountId);
      } finally { db.close(); }
      if (runtime) {
        const account = await client.call('provider/addAccount', { providerKind: runtime.providerKind, displayName: 'Live embedding acceptance', baseUrl: runtime.baseUrl, headers: runtime.headers, ...(runtime.apiKey ? { apiKey: runtime.apiKey } : {}), providerOptions: runtime.providerOptions, isLocal: runtime.isLocal });
        runtime = undefined;
        const preview = await client.call('model/discover', { accountId: account.accountId, preview: true });
        assert.equal((await client.call('model/list', {})).models.length, 0);
        const candidate = preview.models.find(model => model.capabilities.embeddings === true);
        assert(candidate, 'Embedding discovery must offer a candidate');
        const imported = await client.call('model/discover', { accountId: account.accountId, providerModelIds: [candidate.providerModelId] });
        assert.equal(imported.models.length, 1);
        report.embeddingModel = candidate.providerModelId;
        check('Real provider discovery preview has no writes and selected embedding import succeeds');
        await client.call('settings/set', { scope: 'project', projectId, key: 'knowledge.vectorStore.kind', value: 'sqlite' });
        await client.call('settings/set', { scope: 'project', projectId, key: 'knowledge.vectorStore.deployment', value: 'embedded' });
        let profile;
        try { profile = await client.call('knowledge/embeddingProfile/set', { projectId, modelId: imported.models[0].modelId, providerAccountId: account.accountId }); }
        catch (error) {
          assert.equal((await client.call('knowledge/index/status', { projectId })).embeddingProfile, null);
          report.blocked.push({ name: 'Real embedding profile and semantic/hybrid acceptance', errorCode: error.code ?? null, reason: 'Provider rejected the live embedding probe; no fake vectors were substituted.' }); save();
          check('Rejected provider probe does not persist an unverified embedding profile');
        }
        if (profile) {
          assert(profile.dimensions > 0); await reconcile(projectId, true);
          const indexed = await client.call('knowledge/index/status', { projectId });
          assert(indexed.vectors > 0);
          check('Live provider embedding probe and native SQLite vector ingestion', { dimensions: profile.dimensions, vectors: indexed.vectors });
          for (const mode of ['semantic', 'hybrid']) {
            const result = await query(projectId, 'Who observes celestial objects with an optical instrument?', { mode, sources: ['canon'], recordTypes: ['character'] });
            assert.equal(result.degraded, null); assert.equal(result.hits[0]?.recordId, character.id);
            assert(result.hits[0].semanticRank !== null);
            assert.equal((await query(projectId, 'isolationsecret994', { mode, sources: ['canon'] })).hits.some(hit => hit.recordId === 'char.neighbor'), false);
            check('Live ' + mode + ' paraphrase search, citations and Project isolation');
          }
          for (const kind of ['lancedb', 'qdrant', 'sqlite']) {
            await client.call('settings/set', { scope: 'project', projectId, key: 'knowledge.vectorStore.deployment', value: kind === 'qdrant' ? 'managed-local' : 'embedded' });
            await client.call('settings/set', { scope: 'project', projectId, key: 'knowledge.vectorStore.kind', value: kind });
            const switched = await reconcile(projectId);
            assert(switched.vectorStore.reachable && switched.vectors > 0);
            const result = await query(projectId, 'violetbadge772', { mode: 'semantic', sources: ['canon'], recordTypes: ['character'] });
            assert.equal(result.degraded, null); assert.equal(result.hits[0]?.recordId, character.id);
            check('Live vectors rebuilt and searched after backend switch to ' + kind);
          }
        }
      } else report.blocked.push({ name: 'Real embedding acceptance', reason: 'No enabled provider account was available.' });
    } else report.blocked.push({ name: 'Real embedding acceptance', reason: 'Credential profile does not exist.' });
    if (report.blocked.length) {
      const fallback = await query(projectId, 'violetbadge772', { mode: 'hybrid' });
      assert(fallback.degraded && fallback.hits.some(hit => hit.recordId === character.id));
      check('Hybrid search explicitly reports missing embeddings and returns cited lexical fallback');
    }
    const retained = await client.call('knowledge/record', { projectId, recordId: character.id });
    const retainedStatus = await client.call('knowledge/index/status', { projectId });
    await stop(); await start();
    assert.equal((await client.call('knowledge/record', { projectId, recordId: character.id })).body, retained.body);
    assert.equal((await client.call('knowledge/record', { projectId, recordId: character.id })).record.revision, retained.record.revision);
    assert((await query(projectId, 'violetbadge772')).hits.some(hit => hit.recordId === character.id));
    assert((await query(projectId, 'watchupdate885')).hits.length > 0);
    assert((await query(projectId, 'goldenlatch339', { sources: ['board'] })).hits.length > 0);
    assert.equal((await query(projectId, 'deleteprobe446')).hits.length, 0);
    check('Retention of records, revisions, indexed edits, board updates and deletions across checkpointed process restart');
    if (retainedStatus.embeddingProfile) {
      const persisted = await client.call('knowledge/index/status', { projectId });
      assert.deepEqual(persisted.embeddingProfile, retainedStatus.embeddingProfile);
      const result = await query(projectId, 'violetbadge772', { mode: 'semantic', sources: ['canon'], recordTypes: ['character'] });
      assert.equal(result.degraded, null); assert.equal(result.hits[0]?.recordId, character.id);
      check('Embedding profile and native semantic index survive service process restart');
    }
    const rebuilt = await reconcile(projectId, true);
    assert.equal(rebuilt.conflicts.length, 0); assert.equal(rebuilt.brokenReferences.length, 0);
    assert((await query(projectId, 'violetbadge772')).hits.length > 0);
    check('Full rebuild recovers the current native sources without stale deleted content');
    const secret = randomBytes(32).toString('hex');
    const identity = await client.call('backup/identity/create', { label: 'Synthetic knowledge acceptance recovery', secret });
    const destination = await client.call('backup/addDestination', { kind: 'local', displayName: 'Owned knowledge acceptance archives', config: { directory: path.join(root, 'archives') } });
    const run = await client.call('backup/run', { scope: 'project', projectId, destinationId: destination.destinationId, identityId: identity.identityId });
    let archive;
    await eventually(async () => {
      archive = await client.call('backup/run/get', { runId: run.runId });
      assert(!['failed', 'cancelled'].includes(archive.status), 'Synthetic knowledge backup must succeed');
      return archive.status === 'verified';
    }, 'Synthetic knowledge archive was not verified');
    const archiveParams = { destinationId: destination.destinationId, archiveName: archive.archiveName, secret };
    assert.equal((await client.call('backup/verify', { ...archiveParams, secret: randomBytes(32).toString('hex') })).ok, false);
    assert.equal((await client.call('backup/verify', archiveParams)).ok, true);
    check('Encrypted native Project backup verifies and rejects the wrong recovery secret');
    const targetPath = path.join(root, 'restored-observatory');
    const restored = await client.call('backup/restore', { ...archiveParams, targetPath, register: true });
    assert(restored.registeredProjectId && restored.registeredProjectId !== projectId);
    assert.equal(fs.readFileSync(path.join(targetPath, character.path), 'utf8'), fs.readFileSync(path.join(project.path, character.path), 'utf8'));
    assert.equal(fs.readFileSync(path.join(targetPath, 'docs/OBSERVATORY.md'), 'utf8'), fs.readFileSync(docPath, 'utf8'));
    assert(fs.readFileSync(path.join(targetPath, 'game/assets/chart.png')).equals(fs.readFileSync(assetPath)));
    await client.call('project/trust', { projectId: restored.registeredProjectId, trusted: true });
    await client.call('settings/set', { scope: 'project', projectId: restored.registeredProjectId, key: 'access.mode', value: 'full' });
    await reconcile(restored.registeredProjectId, true);
    assert((await query(restored.registeredProjectId, 'violetbadge772')).hits.some(hit => hit.recordId === character.id));
    assert.equal((await query(restored.registeredProjectId, 'deleteprobe446')).hits.length, 0);
    await assert.rejects(() => client.call('backup/restore', { ...archiveParams, targetPath, register: true }));
    check('Native restore preserves edited sources, assigns a new Project ID, rebuilds search and refuses a nonempty target');
    report.restoredProjectId = restored.registeredProjectId;
    report.finalIndex = rebuilt;
    report.result = report.blocked.length ? 'partial-provider-blocked' : 'passed';
  } catch (error) {
    report.failures.push({ name: error.name, message: error instanceof assert.AssertionError ? error.message : 'Acceptance failed; inspect the last completed check and the owned service log.', code: error.code ?? null });
    report.result = 'failed'; process.exitCode = 1;
  } finally {
    try { await stop(); } catch { report.failures.push({ name: 'Owned service shutdown failed' }); report.result = 'failed'; process.exitCode = 1; }
    report.finishedAt = new Date().toISOString(); save();
    console.log(JSON.stringify({ result: report.result, passed: report.checks.length, blocked: report.blocked.length, failures: report.failures.length, report: path.join(root, 'report.json') }));
  }
}
main().catch(() => { console.error('Knowledge acceptance setup failed. Check runtime paths and arguments.'); process.exitCode = 1; });

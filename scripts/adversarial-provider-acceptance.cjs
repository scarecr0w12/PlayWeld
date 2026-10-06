// Live provider acceptance. Source credentials stay in memory and are re-encrypted
// in an isolated profile; paid generation requires an explicit CLI opt-in.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { createHash } = require('node:crypto');
const { setTimeout: delay } = require('node:timers/promises');
const { connect, discover } = require('@gamecrafter/service-client');
const { PlatformService } = require('../packages/platform-service/lib/service');
const { resolvePaths } = require('../packages/platform-service/lib/paths');
const { Database } = require('../packages/platform-service/lib/db/database');
const { CredentialStore } = require('../packages/platform-service/lib/profile/credential-store');
const { ModelRegistry } = require('../packages/platform-service/lib/models/model-registry');
const { createBuiltinModelProviders } = require('../packages/platform-service/lib/models/providers');

async function main() {
  const directory = path.resolve('.artifacts/adversarial-providers', String(Date.now()));
  fs.mkdirSync(directory, { recursive: true });
  const version = require('../packages/platform-service/package.json').version;
  const report = { version, directory, checks: [], failures: [], unavailable: [], paidAssets: process.argv.includes('--paid-assets'), evidence: 'Real configured providers through a source-built isolated service. Synthetic prompts and disposable Projects; no production engine or art acceptance.' };
  const secrets = [];
  let source, service, client;
  const save = () => fs.writeFileSync(path.join(directory, 'report.json'), JSON.stringify(report, null, 2) + '\n');
  async function check(name, action) {
    try { const result = await action(); report.checks.push({ name, result }); console.log('PASS ' + name); }
    catch (error) { report.failures.push({ name, error: error.message }); console.log('FAIL ' + name); }
    save();
  }
  async function snapshot() {
    const [projects, accounts, models, pools, assets] = await Promise.all([
      source.call('project/list', {}), source.call('provider/accounts', {}), source.call('model/list', {}), source.call('pool/list', {}), source.call('asset/accounts', {}),
    ]);
    return { projects: projects.projects.map(p => p.projectId).sort(), accountIds: accounts.accounts.map(a => a.accountId).sort(), modelIds: models.models.map(m => m.modelId).sort(), poolIds: pools.pools.map(p => p.poolId).sort(), assetIds: assets.accounts.map(a => a.accountId).sort() };
  }
  try {
    source = await connect({ ...await discover(), clientName: 'adversarial-provider-acceptance', clientVersion: version });
    const sourceInfo = await source.call('service/info', {});
    const before = await snapshot();
    const sourcePaths = resolvePaths({ ...process.env, GAMECRAFTER_PROFILE_DIR: sourceInfo.profileDir });
    assert(fs.existsSync(path.join(sourcePaths.profileDir, 'credentials.key')), 'Existing source credential key required; never create one in the ordinary profile');
    const db = Database.open(sourcePaths.profileDbPath);
    let runtimes, assetAccounts;
    try {
      const credentials = new CredentialStore(db, sourcePaths.profileDir);
      const registry = new ModelRegistry(db, credentials, createBuiltinModelProviders());
      runtimes = registry.listAccounts().filter(a => a.enabled).map(a => registry.getRuntimeAccount(a.accountId));
      assetAccounts = (await source.call('asset/accounts', {})).accounts.filter(a => a.enabled && a.hasApiKey).map(a => ({ ...a, apiKey: credentials.get(`asset-provider/${a.accountId}/apiKey`) }));
    } finally { db.close(); }
    for (const account of [...runtimes, ...assetAccounts]) if (account.apiKey) secrets.push(account.apiKey);
    const paths = resolvePaths({ ...process.env, GAMECRAFTER_PROFILE_DIR: path.join(directory, 'profile') });
    service = await PlatformService.start({ paths, platformVersion: version });
    client = await connect({ socketPath: service.socketPath, token: fs.readFileSync(paths.tokenPath, 'utf8').trim(), clientName: 'adversarial-provider-workshop', clientVersion: version });
    const project = await client.call('project/create', { name: 'Live adversarial provider workshop', parentDirectory: path.join(directory, 'projects'), engine: { family: 'godot' } });
    await client.call('project/trust', { projectId: project.projectId, trusted: true });
    await client.call('settings/set', { projectId: project.projectId, key: 'access.mode', scope: 'project', value: 'full' });
    for (const runtime of runtimes) {
      const account = await client.call('provider/addAccount', { providerKind: runtime.providerKind, displayName: 'Isolated live ' + runtime.providerKind, baseUrl: runtime.baseUrl, headers: runtime.headers, providerOptions: runtime.providerOptions, isLocal: runtime.isLocal, ...(runtime.apiKey ? { apiKey: runtime.apiKey } : {}) });
      await check(`${runtime.providerKind}: authentication and discovery`, async () => {
        const result = await client.call('provider/testAccount', { accountId: account.accountId });
        assert(result.ok, result.error); return { ok: result.ok, discoveredModels: result.discoveredModels };
      });
      const preview = await client.call('model/discover', { accountId: account.accountId, preview: true });
      const sourceModels = (await source.call('model/list', { accountId: runtime.accountId, enabledOnly: true })).models;
      const enabledChat = sourceModels.filter(m => m.capabilities.chat === true);
      const chat = enabledChat.find(m => m.providerModelId.includes('luna')) ?? enabledChat[0];
      const embedding = preview.models.find(m => m.providerModelId === 'text-embedding-3-small') ?? preview.models.find(m => m.capabilities.embeddings === true);
      const ids = [chat?.providerModelId, embedding?.providerModelId].filter(Boolean);
      await client.call('model/discover', { accountId: account.accountId, providerModelIds: ids });
      const models = (await client.call('model/list', { accountId: account.accountId })).models;
      if (chat) {
        const model = models.find(m => m.providerModelId === chat.providerModelId);
        // Probe streaming explicitly in the disposable profile. Unknown source
        // metadata otherwise intentionally selects complete-response delivery.
        await client.call('model/update', { modelId: model.modelId, patch: { capabilities: { ...chat.capabilities, streaming: true } } });
        for (const stream of [false, true]) await check(`${runtime.providerKind}: ${stream ? 'streamed' : 'non-streamed'} completion`, async () => {
          let text = '';
          const requestId = `${account.accountId}-${stream}`;
          client.onNotification('model/delta', event => { if (event.requestId === requestId) text += event.delta; });
          const result = await client.call('model/complete', { projectId: project.projectId, modelId: model.modelId, requestId, request: { messages: [{ role: 'user', content: 'Reply with exactly: PlayWeld acceptance passed.' }], maxTokens: 128, stream } });
          assert(result.content.includes('PlayWeld'), 'Expected acceptance response');
          if (stream) assert(text.includes('PlayWeld'), 'Observed actual streaming deltas');
          return { finishReason: result.finishReason, usage: result.usage, receivedDeltas: stream && text.length > 0 };
        });
        if (chat.capabilities.tools === true) await check(`${runtime.providerKind}: tool-call response`, async () => {
          const result = await client.call('model/complete', { projectId: project.projectId, modelId: model.modelId, request: { messages: [{ role: 'user', content: 'Call acceptance_signal with value PLAYWELD_ACCEPTANCE. This is a tool protocol test; use the tool instead of answering in text.' }], tools: [{ name: 'acceptance_signal', description: 'Report a synthetic acceptance marker. No side effects.', inputSchema: { type: 'object', properties: { value: { type: 'string' } }, required: ['value'], additionalProperties: false } }], maxTokens: 256, stream: false } });
          const call = result.toolCalls.find(item => item.name === 'acceptance_signal');
          assert(call, 'Received tool call'); assert.equal(JSON.parse(call.arguments).value, 'PLAYWELD_ACCEPTANCE');
          return { finishReason: result.finishReason, usage: result.usage, toolName: call.name };
        });
      } else report.unavailable.push(`${runtime.providerKind}: no configured enabled chat-capable model`);
      if (embedding) await check(`${runtime.providerKind}: embedding vector`, async () => {
        const model = models.find(m => m.providerModelId === embedding.providerModelId);
        const result = await client.call('model/embed', { modelId: model.modelId, inputs: ['Synthetic adversarial acceptance document.'] });
        assert(result.vectors.length === 1 && result.vectors[0].length > 0 && result.vectors[0].every(Number.isFinite));
        return { dimensions: result.vectors[0].length, usage: result.usage };
      });
    }
    for (const original of assetAccounts) {
      const account = await client.call('asset/addAccount', { providerKind: original.providerKind, displayName: 'Isolated live asset acceptance', baseUrl: original.baseUrl, apiKey: original.apiKey, ...(original.planTier ? { planTier: original.planTier } : {}) });
      let balance;
      await check(`${original.providerKind}: account and balance`, async () => {
        const result = await client.call('asset/testAccount', { accountId: account.accountId });
        assert(result.ok, result.error); balance = result.balance; return { balance };
      });
      if (!report.paidAssets || original.providerKind !== 'meshy') { report.unavailable.push(`${original.providerKind}: paid generation not selected`); continue; }
      if (!(typeof balance === 'number' && balance >= 5)) { report.unavailable.push('Meshy preview requires at least five verified credits'); continue; }
      await check('Meshy: one five-credit preview, download, review and isolated import', async () => {
        let job = await client.call('asset/generate', { projectId: project.projectId, accountId: account.accountId, request: { kind: 'text-to-3d', prompt: 'A simple wooden cube crate, one object, game prop, no writing, plain geometry.', outputFormat: 'glb', providerOptions: { ai_model: 'meshy-6-lite', should_remesh: false } } });
        report.assetJobId = job.jobId; save();
        const deadline = Date.now() + 15 * 60 * 1000;
        while (Date.now() < deadline && !['review', 'failed', 'cancelled', 'expired'].includes(job.status)) {
          await delay(2000); job = await client.call('asset/job', { projectId: project.projectId, jobId: job.jobId });
        }
        assert.equal(job.status, 'review', `Generation ended ${job.status}: ${job.error ?? ''}`);
        const artifact = job.artifacts.find(a => a.kind === 'model' && a.format === 'glb');
        assert(artifact, 'Downloaded GLB model');
        const bytes = fs.readFileSync(path.resolve(project.path, artifact.path));
        assert.equal(bytes.subarray(0, 4).toString(), 'glTF');
        assert.equal(createHash('sha256').update(bytes).digest('hex'), artifact.sha256);
        await assert.rejects(client.call('asset/import', { projectId: project.projectId, jobId: job.jobId, artifactId: artifact.artifactId }));
        await client.call('asset/review', { projectId: project.projectId, jobId: job.jobId, decision: 'approved', note: 'Synthetic integration acceptance only; no production art approval.' });
        const imported = await client.call('asset/import', { projectId: project.projectId, jobId: job.jobId, artifactId: artifact.artifactId, destinationDir: 'assets/acceptance' });
        assert.equal(createHash('sha256').update(fs.readFileSync(path.resolve(project.path, imported.importedPath))).digest('hex'), artifact.sha256);
        const after = await client.call('asset/testAccount', { accountId: account.accountId });
        return { importedPath: imported.importedPath, bytes: bytes.length, beforeBalance: balance, afterBalance: after.balance, observedCreditChange: balance - after.balance, creditsRecorded: imported.job.provenance.creditsConsumed };
      });
    }
    await check('Ordinary Project, provider, model, pool and asset account identities retained', async () => { assert.deepEqual(await snapshot(), before); return { ordinaryProfileUnchanged: true }; });
  } finally {
    if (client) client.close();
    if (service) await service.stop();
    if (source) source.close();
    save();
    let leaks = 0;
    function scan(directoryPath) { for (const item of fs.readdirSync(directoryPath, { withFileTypes: true })) { const filename = path.join(directoryPath, item.name); if (item.isDirectory()) scan(filename); else if (item.isFile()) { const bytes = fs.readFileSync(filename); if (secrets.some(secret => bytes.includes(Buffer.from(secret)))) leaks++; } } }
    scan(directory);
    assert.equal(leaks, 0, 'No plaintext source credentials in retained acceptance artifacts');
    console.log(JSON.stringify({ directory, checks: report.checks.length, failures: report.failures, unavailable: report.unavailable, plaintextCredentialLeaks: leaks }, null, 2));
  }
  if (report.failures.length) process.exitCode = 1;
}
main().catch(error => { console.error(error.message); process.exitCode = 1; });

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { createServer } = require('node:http');
const { setTimeout: delay } = require('node:timers/promises');

// Synthetic metadata-only GLB: this tests review/import, not usable geometry.
function fixtureGlb() {
  const json = Buffer.from(
    JSON.stringify({
      asset: { version: '2.0', generator: 'PlayWeld documentation fixture' },
      scene: 0,
      scenes: [{ nodes: [0] }],
      nodes: [{ name: 'Synthetic_Lantern_Metadata' }],
    }),
  );
  const size = Math.ceil(json.length / 4) * 4;
  const bytes = Buffer.alloc(20 + size, 0x20);
  bytes.write('glTF');
  bytes.writeUInt32LE(2, 4);
  bytes.writeUInt32LE(bytes.length, 8);
  bytes.writeUInt32LE(size, 12);
  bytes.writeUInt32LE(0x4e4f534a, 16);
  json.copy(bytes, 20);
  return bytes;
}
async function assetScenario({
  client,
  page,
  project,
  checks,
  open,
  click,
  selectSection,
  selectProject,
  capture,
  wait,
}) {
  const bytes = fixtureGlb();
  let url;
  const provider = createServer(async (request, response) => {
    for await (const chunk of request) void chunk;
    const json = (value) => {
      response.writeHead(200, { 'content-type': 'application/json' });
      response.end(JSON.stringify(value));
    };
    if (request.url === '/openapi/v2/text-to-3d?limit=1') return json({ result: [] });
    if (request.method === 'POST' && request.url === '/openapi/v2/text-to-3d')
      return json({ result: { id: 'lantern-fixture' } });
    if (request.url?.startsWith('/openapi/v2/text-to-3d/'))
      return json({
        result: { status: 'SUCCEEDED', progress: 100, model_urls: { glb: `${url}/model.glb` } },
      });
    if (request.url === '/model.glb') {
      response.writeHead(200, {
        'content-type': 'model/gltf-binary',
        'content-length': bytes.length,
      });
      response.end(bytes);
      return;
    }
    response.writeHead(404);
    response.end();
  });
  await new Promise((resolve) => provider.listen(0, '127.0.0.1', resolve));
  url = `http://127.0.0.1:${provider.address().port}`;
  try {
    const account = await client.call('asset/addAccount', {
      providerKind: 'meshy',
      displayName: 'Local synthetic asset fixture — no paid provider',
      baseUrl: url,
      apiKey: 'synthetic-local-key',
      planTier: 'fixture',
    });
    await client.call('settings/set', {
      key: 'assets.pollIntervalSeconds',
      scope: 'project',
      projectId: project.projectId,
      value: 2,
    });
    await open('Assets', 'assets');
    await selectProject('[aria-label="Assets Project"]', project.projectId);
    await selectSection('Asset workspace sections', 'Generate');
    await click('.gamecrafter-assets button', 'Refresh');
    await wait(
      (id) =>
        [...document.querySelectorAll('[aria-label="Asset provider account"] option')].some(
          (item) => item.value === id,
        ),
      account.accountId,
    );
    await page.select('[aria-label="Asset provider account"]', account.accountId);
    await page
      .locator('.gamecrafter-assets textarea')
      .fill('Synthetic lantern metadata fixture; no geometry or paid generation claim.');
    await capture('asset-configuration', '.gamecrafter-assets');
    await click('.gamecrafter-assets button', 'Generate asset');
    let job;
    for (let attempt = 0; attempt < 120; attempt++) {
      const result = await client.call('asset/jobs', { projectId: project.projectId });
      job = result.jobs[0];
      if (job?.status === 'review') break;
      if (job?.status === 'failed') throw new Error(job.error);
      await delay(500);
    }
    assert.equal(job?.status, 'review');
    await click('.gamecrafter-assets button', 'Refresh');
    await selectSection('Asset workspace sections', 'Jobs');
    await wait(() => document.querySelector('.gamecrafter-assets-review'));
    await page.evaluate(() => document.querySelector('.gamecrafter-assets-job').scrollIntoView());
    await capture('asset-awaiting-review', '.gamecrafter-assets');
    await page
      .locator(`[aria-label="Review note ${job.jobId}"]`)
      .fill('Synthetic metadata is correct; native geometry acceptance remains unverified.');
    await click('.gamecrafter-assets-review button', 'Approve');
    await wait(() => document.querySelector('.gamecrafter-assets-import'));
    await page.locator(`[aria-label="Import directory ${job.jobId}"]`).fill('../../outside');
    await click('.gamecrafter-assets-import button', 'Import');
    await wait(() =>
      document.querySelector('.gamecrafter-assets')?.textContent.includes('outside'),
    );
    assert.equal(
      (await client.call('asset/job', { projectId: project.projectId, jobId: job.jobId })).status,
      'approved',
    );
    await capture('asset-import-rejected', '.gamecrafter-assets');
    await page
      .locator(`[aria-label="Import directory ${job.jobId}"]`)
      .fill('game/assets/generated');
    await click('.gamecrafter-assets-import button', 'Import');
    for (let attempt = 0; attempt < 60; attempt++) {
      job = await client.call('asset/job', { projectId: project.projectId, jobId: job.jobId });
      if (job.status === 'imported') break;
      await delay(500);
    }
    assert.equal(job.status, 'imported');
    const imported = path.resolve(project.path, job.importedPath);
    assert(imported.startsWith(project.path + path.sep));
    assert(fs.readFileSync(imported).equals(bytes));
    await wait(() => document.querySelector('.gamecrafter-assets-status-imported'));
    await capture('asset-imported', '.gamecrafter-assets');
    checks.push(
      'Assets: UI generation with local synthetic provider, explicit human review, outside-Project import rejection, corrected import and exact-byte verification; no paid-provider or geometry acceptance claim',
    );
  } finally {
    provider.closeAllConnections();
    await new Promise((resolve, reject) =>
      provider.close((error) => (error ? reject(error) : resolve())),
    );
  }
}
module.exports = { assetScenario };

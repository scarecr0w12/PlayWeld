// Real app/service and deterministic localhost provider; no private profile or paid calls.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const { spawn, execFileSync } = require('node:child_process');
const { createHash } = require('node:crypto');
const { setTimeout: delay } = require('node:timers/promises');
const { PlatformService } = require('../packages/platform-service/lib/service');
const { resolvePaths } = require('../packages/platform-service/lib/paths');
const { connect } = require('@gamecrafter/service-client');

async function main() {
  const { default: puppeteer } = await import('puppeteer');
  const directory = path.resolve('.artifacts/audit-detail-ui', String(Date.now()));
  fs.mkdirSync(directory, { recursive: true });
  const version = require('../packages/platform-service/package.json').version;
  const paths = resolvePaths({ ...process.env, GAMECRAFTER_PROFILE_DIR: path.join(directory, 'profile') });
  const fixture = http.createServer(async (req, res) => {
    let raw = '';
    for await (const part of req) raw += part;
    res.setHeader('Content-Type', 'application/json');
    if (req.url === '/models') res.end(JSON.stringify({ data: ['priced-fixture', 'unpriced-fixture', 'free-fixture'].map(id => ({ id })) }));
    else if (req.url === '/chat/completions') {
      const body = JSON.parse(raw);
      res.end(JSON.stringify({ id: 'local-fixture', model: body.model, choices: [{ finish_reason: 'stop', message: { role: 'assistant', content: 'Local deterministic fixture response.' } }], usage: { prompt_tokens: 12, completion_tokens: 5, total_tokens: 17 } }));
    } else { res.statusCode = 404; res.end('{}'); }
  });
  await new Promise(resolve => fixture.listen(0, '127.0.0.1', resolve));
  const service = await PlatformService.start({ paths, platformVersion: version });
  const client = await connect({ socketPath: service.socketPath, token: fs.readFileSync(paths.tokenPath, 'utf8').trim(), clientName: 'audit-detail-smoke', clientVersion: version });
  let backend, browser, page, log;
  const checks = [], errors = [];
  try {
    const project = await client.call('project/create', { name: 'Readable audit workshop', engine: { family: 'godot' }, parentDirectory: path.join(directory, 'projects') });
    const goal = '## Acceptance criteria\n\n- **Preserve saves**\n- Review `player.gd`\n\n```gdscript\nvar ready = true\n```\n\n## Reading notes\n\n' + Array.from({ length: 45 }, (_, index) => `${index + 1}. Validate step ${index + 1} without changing unrelated behavior.`).join('\n');
    const request = await client.call('change/request', { projectId: project.projectId, text: goal });
    await client.call('task/create', { projectId: project.projectId, kind: 'noop.echo', parentTaskId: request.rootTaskId, title: 'Formatted goal specialist', goal, role: 'validator' });
    const account = await client.call('provider/addAccount', { providerKind: 'openai-compatible', displayName: 'Local accounting fixture', baseUrl: `http://127.0.0.1:${fixture.address().port}`, isLocal: true });
    const discovered = await client.call('model/discover', { accountId: account.accountId });
    for (const model of discovered.models) {
      const pricing = model.providerModelId === 'priced-fixture' ? { inputPerMTokUsd: 0.1, outputPerMTokUsd: 0.2 } : model.providerModelId === 'free-fixture' ? { inputPerMTokUsd: 0, outputPerMTokUsd: 0 } : { inputPerMTokUsd: null, outputPerMTokUsd: null };
      await client.call('model/update', { modelId: model.modelId, patch: { displayName: model.providerModelId, enabled: true, pricing, capabilities: { chat: true, tools: false, streaming: false, contextWindow: 32000, maxOutputTokens: 1000 } } });
      await client.call('model/complete', { projectId: project.projectId, modelId: model.modelId, requestId: model.providerModelId, request: { messages: [{ role: 'user', content: 'Return the deterministic fixture response.' }], stream: false } });
    }
    await client.call('tool/call', { projectId: project.projectId, toolId: 'fs/list', input: { path: 'game' }, accessCeiling: 'full' });
    const audit = await client.call('audit/read', { projectId: project.projectId });
    assert(audit.modelUsage.some(entry => entry.costStatus === 'known' && entry.costUsd > 0 && entry.costUsd < 0.0001));
    assert(audit.modelUsage.some(entry => entry.costStatus === 'unknown' && entry.costUsd === null));
    assert(audit.modelUsage.some(entry => entry.costStatus === 'known' && entry.costUsd === 0));
    checks.push('Real completion ledger records tiny priced, unavailable and explicitly free fixture usage separately');
    const port = Number(process.env.GAMECRAFTER_AUDIT_DETAIL_SMOKE_PORT ?? 3016);
    const target = `http://127.0.0.1:${port}`;
    log = fs.openSync(path.join(directory, 'backend.log'), 'a');
    backend = spawn(process.execPath, [path.resolve('apps/control-room-browser/lib/backend/main.js'), '--port', String(port), '--hostname', '127.0.0.1'], { cwd: path.resolve('apps/control-room-browser'), env: { ...process.env, GAMECRAFTER_PROFILE_DIR: paths.profileDir, THEIA_CONFIG_DIR: path.join(directory, 'theia') }, windowsHide: true, stdio: ['ignore', log, log] });
    let ready = false;
    for (let attempt = 0; attempt < 300; attempt++) { try { ready = (await fetch(target)).ok; } catch { /* Owned startup. */ } if (ready) break; await delay(100); }
    assert(ready);
    browser = await puppeteer.launch({ headless: true });
    page = await browser.newPage();
    page.on('pageerror', error => errors.push(error.message));
    await page.setViewport({ width: 1600, height: 1000 });
    const wait = (predicate, ...args) => page.waitForFunction(predicate, { polling: 100, timeout: 30000 }, ...args);
    const clickText = async (selector, text) => {
      for (const handle of await page.$$(selector)) if (await handle.evaluate((node, value) => node.getClientRects().length > 0 && node.textContent.includes(value), text)) { await handle.scrollIntoView(); await handle.asLocator().click(); return; }
      throw new Error(`Missing visible ${text}`);
    };
    const fit = selector => wait(query => { const node = document.querySelector(query); return node && node.clientWidth > 0 && node.scrollWidth <= node.clientWidth + 2; }, selector);
    await page.goto(`${target}/#${encodeURI('/' + project.path.replace(/\\/g, '/'))}`, { waitUntil: 'networkidle2' });
    await page.waitForSelector('.theia-preload', { hidden: true });
    for (const button of await page.$$('.dialogBlock button')) if (await button.evaluate(node => /trust/i.test(node.textContent) && !/don't|do not/i.test(node.textContent))) await button.click();
    await page.waitForSelector('.gamecrafter-home-navigation', { visible: true });
    await clickText('.gamecrafter-home-navigation button', 'Swarm');
    await wait(() => [...document.querySelectorAll('.gamecrafter-swarm-node')].some(node => node.textContent.includes('Formatted goal specialist')));
    await clickText('.gamecrafter-swarm-node', 'Formatted goal specialist');
    await wait(() => document.querySelector('[aria-label="Task goal"] h2')?.textContent === 'Acceptance criteria');
    assert(await page.$('[aria-label="Task goal"] li strong'));
    assert(await page.$('[aria-label="Task goal"] pre code'));
    assert(await page.$eval('[aria-label="Goal content"]', node => node.scrollHeight > node.clientHeight && node.clientHeight <= 430));
    assert.equal(await page.$$eval('[aria-label="Task goal"] img', nodes => nodes.length), 0);
    await fit('.gamecrafter-swarm');
    await page.screenshot({ path: path.join(directory, 'formatted-goal-desktop.png') });
    checks.push('Goal renders real Markdown structure inside a keyboard-accessible bounded reading panel');
    await page.setViewport({ width: 650, height: 900 });
    await fit('.gamecrafter-swarm');
    await page.screenshot({ path: path.join(directory, 'formatted-goal-narrow.png') });
    checks.push('Formatted hierarchy details fit a narrow window');
    await page.setViewport({ width: 1600, height: 1000 });
    await clickText('.lm-TabBar-tabLabel', 'Project Home');
    await clickText('.gamecrafter-home-navigation button', 'Audit & History');
    await wait(() => document.querySelector('.gamecrafter-audit-record-list')?.textContent.includes('Pricing unavailable'));
    const costs = await page.$eval('.gamecrafter-audit', node => node.textContent);
    assert(costs.includes('$0.0000022'));
    assert((await page.$$eval('.gamecrafter-audit-cost.is-known', nodes => nodes.map(node => node.textContent.trim()))).includes('$0.00'));
    await clickText('.gamecrafter-audit-record-list button', 'Pricing unavailable');
    assert((await page.$eval('[aria-label="Selected model request"]', node => node.textContent)).includes('Pricing unavailable'));
    await clickText('.gamecrafter-audit-record-list button', '$0.0000022');
    await fit('.gamecrafter-audit');
    await page.screenshot({ path: path.join(directory, 'model-cost-desktop.png') });
    checks.push('Audit exposes tiny real estimates, unknown pricing, genuine zero and selected model usage without conflating them');
    await page.setViewport({ width: 650, height: 900 });
    await fit('.gamecrafter-audit');
    await page.screenshot({ path: path.join(directory, 'model-cost-narrow.png') });
    checks.push('Audit cost cards and inspector fit a narrow window');
    await page.setViewport({ width: 1600, height: 1000 });
    await clickText('.gamecrafter-audit .gamecrafter-section-nav button', 'Tool calls');
    await wait(() => document.querySelector('[aria-label="Recorded tool calls"]')?.textContent.includes('fs/list'));
    assert((await page.$eval('[aria-label="Selected tool call"]', node => node.textContent)).includes('No charge reported'));
    await page.screenshot({ path: path.join(directory, 'tool-history-desktop.png') });
    checks.push('Tool activity is separate, readable and does not pretend internal file listing is model spend');
    await clickText('.gamecrafter-audit .gamecrafter-section-nav button', 'Project events');
    await wait(() => document.querySelector('[aria-label="Selected Project event"]'));
    await page.screenshot({ path: path.join(directory, 'event-history-desktop.png') });
    checks.push('Project timeline selects a focused event with bounded structured context');
    assert.deepEqual(errors, []);
    const report = { capturedAt: new Date().toISOString(), platformVersion: version, checks, rendererErrors: errors, screenshots: ['formatted-goal-desktop.png', 'formatted-goal-narrow.png', 'model-cost-desktop.png', 'model-cost-narrow.png', 'tool-history-desktop.png', 'event-history-desktop.png'], target: 'Rebuilt development browser and real isolated platform service', provider: 'Deterministic localhost fixture; no paid provider, private profile or live engine calls', source: { commit: execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(), captureScriptSha256: createHash('sha256').update(fs.readFileSync(__filename)).digest('hex') } };
    fs.writeFileSync(path.join(directory, 'report.json'), JSON.stringify(report, null, 2));
    if (process.env.GAMECRAFTER_AUDIT_DETAIL_CAPTURE_DIR) {
      const output = path.resolve(process.env.GAMECRAFTER_AUDIT_DETAIL_CAPTURE_DIR);
      assert(output.startsWith(path.resolve('docs/images') + path.sep) && (!fs.existsSync(output) || fs.readdirSync(output).length === 0));
      fs.mkdirSync(output, { recursive: true });
      for (const name of report.screenshots) fs.copyFileSync(path.join(directory, name), path.join(output, name));
      fs.writeFileSync(path.join(output, 'capture-report.json'), JSON.stringify(report, null, 2) + '\n');
    }
    console.log(JSON.stringify({ ...report, artifactDirectory: directory }, null, 2));
  } catch (error) {
    if (page) await page.screenshot({ path: path.join(directory, 'failure.png') }).catch(() => undefined);
    fs.writeFileSync(path.join(directory, 'failure.json'), JSON.stringify({ checks, errors, error: String(error) }, null, 2));
    throw error;
  } finally {
    if (browser) await browser.close();
    if (backend) backend.kill();
    if (log !== undefined) fs.closeSync(log);
    client.close();
    await service.stop();
    await new Promise(resolve => fixture.close(resolve));
  }
}
main().catch(error => { console.error(error); process.exitCode = 1; });

// Exercise the installed/staged desktop with the retained live acceptance profile.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const net = require('node:net');
const { spawn } = require('node:child_process');
const { setTimeout: delay } = require('node:timers/promises');
const { connect } = require('@gamecrafter/service-client');
const { resolvePaths } = require('../packages/platform-service/lib/paths');

async function freePort() {
  const server = net.createServer();
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const port = server.address().port;
  await new Promise(resolve => server.close(resolve));
  return port;
}
async function main() {
  if (process.argv.includes('--help')) {
    console.log('Usage: node scripts/verify-knowledge-ui.cjs --executable ABSOLUTE_EXE --run LIVE_RUN_DIRECTORY');
    return;
  }
  assert.equal(process.argv[2], '--executable'); assert.equal(process.argv[4], '--run');
  const executable = path.resolve(process.argv[3]);
  const root = path.resolve(process.argv[5]);
  const acceptance = JSON.parse(fs.readFileSync(path.join(root, 'report.json'), 'utf8'));
  const uiRoot = path.join(root, 'ui-' + Date.now());
  fs.mkdirSync(uiRoot, { recursive: true });
  const version = JSON.parse(fs.readFileSync(path.join(path.dirname(executable), 'resources/app/package.json'), 'utf8')).version;
  assert.equal(version, acceptance.version);
  const paths = resolvePaths({ ...process.env, GAMECRAFTER_PROFILE_DIR: acceptance.profile });
  const { default: puppeteer } = await import('puppeteer');
  const cdpPort = await freePort(), appPort = await freePort();
  const env = { ...process.env, GAMECRAFTER_PROFILE_DIR: paths.profileDir, THEIA_CONFIG_DIR: path.join(uiRoot, 'theia') };
  delete env.ELECTRON_RUN_AS_NODE;
  const log = fs.openSync(path.join(uiRoot, 'desktop.log'), 'a');
  const desktop = spawn(executable, [`--user-data-dir=${path.join(uiRoot, 'desktop')}`, '--port', String(appPort), '--hostname', '127.0.0.1', `--remote-debugging-port=${cdpPort}`, '--disable-background-timer-throttling', '--disable-renderer-backgrounding', '--disable-backgrounding-occluded-windows'], { env, windowsHide: true, stdio: ['ignore', log, log] });
  let browser, client, page;
  const report = { version, executable, projectId: acceptance.project.projectId, checks: [], rendererErrors: [], startedAt: new Date().toISOString() };
  const save = () => fs.writeFileSync(path.join(uiRoot, 'ui-report.json'), JSON.stringify(report, null, 2) + '\n');
  const check = name => { report.checks.push(name); save(); console.log('PASS ' + name); };
  async function click(selector, label) {
    const handle = await page.evaluateHandle((css, text) => [...document.querySelectorAll(css)].find(node => node.getClientRects().length && (node.textContent.trim() === text || node.querySelector('strong')?.textContent.trim() === text || [...node.childNodes].filter(child => child.nodeType === Node.TEXT_NODE).map(child => child.textContent).join('').trim() === text)), selector, label);
    const element = handle.asElement(); assert(element, 'Visible UI action: ' + label);
    await element.scrollIntoView(); await element.asLocator().click();
  }
  const wait = (predicate, ...args) => page.waitForFunction(predicate, { polling: 100, timeout: 60000 }, ...args);
  async function search(text) {
    await click('.gamecrafter-knowledge nav button', 'Search');
    await page.select('[aria-label="Knowledge search mode"]', 'lexical');
    const field = await page.$('[aria-label="Knowledge search query"]');
    assert(field); await field.click(); await page.keyboard.down('Control'); await page.keyboard.press('A'); await page.keyboard.up('Control'); await page.keyboard.press('Backspace'); await field.type(text);
    await click('.gamecrafter-knowledge form button', 'Search');
    await wait(marker => [...document.querySelectorAll('.gamecrafter-knowledge-hit')].some(node => node.textContent.includes(marker)), text);
  }
  try {
    for (let attempt = 0; attempt < 120; attempt++) {
      assert(desktop.exitCode === null, 'Owned desktop remains running');
      try { browser = await puppeteer.connect({ browserURL: `http://127.0.0.1:${cdpPort}`, protocolTimeout: 90000 }); break; } catch { await delay(500); }
    }
    assert(browser);
    page = await (await browser.waitForTarget(target => target.type() === 'page' && target.url().includes('/lib/frontend/index.html'), { timeout: 60000 })).page();
    page.on('pageerror', error => report.rendererErrors.push(error.message));
    await page.bringToFront();
    await wait(() => document.querySelector('.gamecrafter-project-home')?.textContent.includes('Connected to platform service'));
    client = await connect({ socketPath: paths.socketPath, token: fs.readFileSync(paths.tokenPath, 'utf8').trim(), clientName: 'knowledge-desktop-acceptance', clientVersion: version });
    assert.equal((await client.call('service/info', {})).serviceVersion, version);
    check('Target desktop connects to its matching bundled live service');
    await click('.gamecrafter-project-home button', 'Knowledge');
    await page.waitForSelector('[aria-label="Knowledge Project"]', { visible: true, timeout: 60000 });
    await page.select('[aria-label="Knowledge Project"]', acceptance.project.projectId);
    await wait(() => document.querySelector('.gamecrafter-knowledge nav'));
    await click('.gamecrafter-knowledge nav button', 'Settings');
    await click('.gamecrafter-knowledge summary', 'Vector store and embedding profile');
    await wait(model => [...document.querySelector('[aria-label="Embedding model"]').options].some(option => option.textContent.includes(model)), acceptance.embeddingModel);
    const modelId = await page.$eval('[aria-label="Embedding model"]', (select, model) => [...select.options].find(option => option.textContent.includes(model)).value, acceptance.embeddingModel);
    await page.select('[aria-label="Embedding model"]', modelId);
    assert.equal(await page.$eval('[aria-label="Embedding model"]', select => select.value), modelId);
    await page.screenshot({ path: path.join(uiRoot, 'embedding-selectable.png') });
    check('Discovered OpenAI embedding model is selectable in the actual desktop Knowledge settings');
    await search('violetbadge772');
    await page.screenshot({ path: path.join(uiRoot, 'knowledge-search.png') });
    check('Desktop search returns retained edited canon with original quote and citation');
    await click('.gamecrafter-knowledge nav button', 'Canon records');
    const recordButton = await page.evaluateHandle(() => [...document.querySelectorAll('.gamecrafter-knowledge-record-list button')].find(node => node.textContent.includes('char.lyra')));
    assert(recordButton.asElement()); await recordButton.asElement().asLocator().click();
    await wait(() => document.querySelector('.gamecrafter-knowledge-record-body')?.textContent.includes('violetbadge772'));
    check('Desktop record detail renders retained accepted canon and reference relationships');
    const detail = await client.call('knowledge/record', { projectId: acceptance.project.projectId, recordId: 'char.lyra' });
    const { id, type, title, status, module, tags, references, provenance } = detail.record;
    await client.call('knowledge/write', { projectId: acceptance.project.projectId, record: { id, type, title, status, module, tags, references, provenance }, body: detail.body + '\nDesktop acceptance update: uiedit553.\n' });
    await wait(() => document.querySelector('.gamecrafter-knowledge-record-body')?.textContent.includes('uiedit553'));
    await page.screenshot({ path: path.join(uiRoot, 'knowledge-live-update.png') });
    check('Live service edit notification updates the open desktop record without reopening it');
    await search('uiedit553');
    check('Desktop search immediately finds the newly edited content');
    await click('.gamecrafter-knowledge nav button', 'Index status');
    await page.screenshot({ path: path.join(uiRoot, 'knowledge-index-status.png') });
    assert.equal(report.rendererErrors.length, 0);
    check('Desktop index status is reachable with zero captured renderer exceptions');
    report.result = 'passed';
  } catch (error) {
    report.result = 'failed'; report.error = error instanceof assert.AssertionError ? error.message : error.name;
    if (page) await page.screenshot({ path: path.join(uiRoot, 'ui-failure.png') }).catch(() => {});
    process.exitCode = 1;
  } finally {
    if (!client && fs.existsSync(paths.tokenPath)) client = await connect({ socketPath: paths.socketPath, token: fs.readFileSync(paths.tokenPath, 'utf8').trim(), clientName: 'knowledge-ui-cleanup', clientVersion: version }).catch(() => undefined);
    if (client) { await client.call('service/stop', { checkpoint: true }).catch(() => {}); client.close(); }
    browser?.disconnect();
    if (desktop.pid) { const kill = spawn('taskkill', ['/PID', String(desktop.pid), '/T', '/F'], { windowsHide: true, stdio: 'ignore' }); await new Promise(resolve => kill.once('exit', resolve)); }
    fs.closeSync(log);
    report.finishedAt = new Date().toISOString(); save();
    console.log(JSON.stringify({ result: report.result, checks: report.checks.length, rendererErrors: report.rendererErrors.length, report: path.join(uiRoot, 'ui-report.json') }));
  }
}
main().catch(() => { console.error('Knowledge desktop acceptance setup failed.'); process.exitCode = 1; });

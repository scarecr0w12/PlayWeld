// Real browser app and service, disposable profile, synthetic agent tasks, no model provider.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { spawn } = require('node:child_process');
const { setTimeout: delay } = require('node:timers/promises');
const { PlatformService } = require('../packages/platform-service/lib/service');
const { resolvePaths } = require('../packages/platform-service/lib/paths');
const { connect } = require('@gamecrafter/service-client');

async function main() {
  const { default: puppeteer } = await import('puppeteer');
  const directory = path.resolve('.artifacts', 'navigation-layout-ui', String(Date.now()));
  fs.mkdirSync(directory, { recursive: true });
  const version = require('../packages/platform-service/package.json').version;
  const paths = resolvePaths({ ...process.env, GAMECRAFTER_PROFILE_DIR: path.join(directory, 'profile') });
  const service = await PlatformService.start({ paths, platformVersion: version });
  const client = await connect({ socketPath: service.socketPath, token: fs.readFileSync(paths.tokenPath, 'utf8').trim(), clientName: 'navigation-layout-smoke', clientVersion: version });
  let backend;
  let browser;
  let page;
  let log;
  const checks = [];
  const errors = [];
  try {
    const project = await client.call('project/create', { name: 'Navigation workshop', engine: { family: 'godot' }, parentDirectory: path.join(directory, 'projects') });
    const request = await client.call('change/request', { projectId: project.projectId, text: 'Inspect game/player.gd and report validation evidence.' });
    const child = await client.call('task/create', { projectId: project.projectId, kind: 'noop.echo', title: 'Gameplay specialist', goal: 'Inspect movement and preserve existing controls.', role: 'gameplay-engineer', parentTaskId: request.rootTaskId });
    await client.call('task/create', { projectId: project.projectId, kind: 'noop.echo', title: 'Validation sub-agent', goal: 'Report the reset test evidence.', role: 'validator', parentTaskId: child.task.taskId });
    await client.call('board/createThread', { projectId: project.projectId, title: 'Checkpoint question', kind: 'question', body: 'Which checkpoint should be restored?', type: 'question', tags: ['gameplay'] });
    await client.call('board/createThread', { projectId: project.projectId, title: 'Import blocker', kind: 'blocker', body: 'A source texture is missing.', type: 'blocker', tags: ['assets'] });
    const port = Number(process.env.GAMECRAFTER_NAVIGATION_SMOKE_PORT ?? 3014);
    const target = `http://127.0.0.1:${port}`;
    log = fs.openSync(path.join(directory, 'backend.log'), 'a');
    backend = spawn(process.execPath, [path.resolve('apps/control-room-browser/lib/backend/main.js'), '--port', String(port), '--hostname', '127.0.0.1'], {
      cwd: path.resolve('apps/control-room-browser'), env: { ...process.env, GAMECRAFTER_PROFILE_DIR: paths.profileDir, THEIA_CONFIG_DIR: path.join(directory, 'theia') }, windowsHide: true, stdio: ['ignore', log, log],
    });
    let ready = false;
    for (let attempt = 0; attempt < 300; attempt++) {
      try { ready = (await fetch(target)).ok; } catch { /* owned backend is starting */ }
      if (ready) break;
      await delay(100);
    }
    assert(ready, 'Isolated browser backend starts');
    browser = await puppeteer.launch({ headless: true });
    page = await browser.newPage();
    await page.setViewport({ width: 1600, height: 1000 });
    page.on('pageerror', (error) => errors.push(error.message));
    const wait = (predicate, ...args) => page.waitForFunction(predicate, { polling: 100, timeout: 30000 }, ...args);
    const click = async (selector) => {
      const element = await page.waitForSelector(selector, { visible: true });
      await element.scrollIntoView();
      await element.asLocator().click();
    };
    const clickText = async (selector, text) => {
      for (const element of await page.$$(selector)) {
        if (await element.evaluate((node, label) => node.textContent.includes(label), text)) {
          await element.scrollIntoView();
          await element.asLocator().click();
          return;
        }
      }
      throw new Error(`Missing ${text} in ${selector}`);
    };
    await page.goto(`${target}/#${encodeURI('/' + project.path.replace(/\\/g, '/'))}`, { waitUntil: 'networkidle2' });
    await page.waitForSelector('.theia-preload', { hidden: true, timeout: 30000 });
    for (const button of await page.$$('.dialogBlock button')) {
      if (await button.evaluate((node) => /trust/i.test(node.textContent) && !/don't|do not/i.test(node.textContent))) await button.click();
    }
    await page.waitForSelector('.gamecrafter-home-navigation', { visible: true });
    assert((await page.$$('.gamecrafter-home-navigation-group')).length >= 3);
    assert(await page.$('.gamecrafter-home-next-step'));
    checks.push('Project Home groups destinations and shows an actionable next step');
    const workspaceHash = await page.evaluate(() => location.hash);
    await clickText('.gamecrafter-home-next-step button', 'Go to Projects');
    assert.equal(await page.evaluate(() => location.hash), workspaceHash);
    assert.equal(await page.evaluate(() => document.activeElement?.id), 'gamecrafter-home-projects');
    checks.push('Project shortcut moves focus without changing the Theia workspace URL');
    await page.screenshot({ path: path.join(directory, 'home-desktop.png') });
    await clickText('.gamecrafter-home-navigation button', 'Swarm');
    await wait(() => document.querySelector('.gamecrafter-swarm-node')?.textContent);
    await clickText('.gamecrafter-swarm-node', 'Gameplay specialist');
    await wait(() => document.querySelector('.gamecrafter-swarm-inspector h3')?.textContent === 'Gameplay specialist');
    assert((await page.$eval('.gamecrafter-swarm-inspector', (node) => node.textContent)).includes('Inspect movement'));
    assert(!(await page.$eval('.gamecrafter-swarm-hierarchy', (node) => node.textContent)).includes('Inspect movement'));
    await click('button[aria-label="Collapse Gameplay specialist"]');
    await wait(() => ![...document.querySelectorAll('.gamecrafter-swarm-node')].some((node) => node.textContent.includes('Validation sub-agent')));
    await click('button[aria-label="Expand Gameplay specialist"]');
    await clickText('.gamecrafter-swarm-node', 'Validation sub-agent');
    await wait(() => document.querySelector('.gamecrafter-swarm-inspector h3')?.textContent === 'Validation sub-agent');
    checks.push('Nested agents collapse, expand, and select a focused task inspector');
    await clickText('.gamecrafter-section-nav button', 'Approvals');
    assert.equal(await page.$eval('[aria-label="Pending approvals"]', (node) => node.hidden), false);
    assert.equal(await page.$eval('.gamecrafter-swarm-workspace', (node) => Boolean(node.closest('[hidden]'))), true);
    await clickText('.gamecrafter-section-nav button', 'Agents');
    checks.push('Swarm section navigation isolates approvals from agent details');
    await page.screenshot({ path: path.join(directory, 'swarm-desktop.png') });
    await clickText('.gamecrafter-swarm button', 'Open request thread');
    await wait((threadId) => document.querySelector('.gamecrafter-board-thread-list button.selected')?.getAttribute('data-thread-id') === threadId || document.querySelector('.gamecrafter-board-thread-header h2')?.textContent.includes('Inspect game/player.gd'), request.threadId);
    checks.push('Swarm opens its exact Project request thread in Discussion Board');
    await clickText('.gamecrafter-board-quick-views button', 'Questions');
    await wait(() => document.querySelector('.gamecrafter-board-thread-list')?.textContent.includes('Checkpoint question'));
    assert(!(await page.$eval('.gamecrafter-board-thread-list', (node) => node.textContent)).includes('Import blocker'));
    await clickText('.gamecrafter-board-header button', 'Refresh');
    await wait(() => document.querySelector('.gamecrafter-board-header button')?.disabled === false);
    assert(!(await page.$eval('.gamecrafter-board-thread-list', (node) => node.textContent)).includes('Import blocker'));
    checks.push('Board question quick view filters threads and survives refresh');
    await page.screenshot({ path: path.join(directory, 'board-desktop.png') });
    for (const [label, surface] of [['Swarm', 'swarm'], ['Discussion Board', 'board'], ['Project Home', 'project-home']]) {
      await clickText('.lm-TabBar-tabLabel', label);
      await page.setViewport({ width: 650, height: 900 });
      await wait((selector) => {
        const node = document.querySelector(selector);
        return node && node.scrollWidth <= node.clientWidth + 2;
      }, `.gamecrafter-${surface}`);
      if (surface === 'swarm') {
        await wait(() => {
          const a = document.querySelector('.gamecrafter-swarm-hierarchy').getBoundingClientRect();
          const b = document.querySelector('.gamecrafter-swarm-inspector').getBoundingClientRect();
          return b.top >= a.bottom;
        });
      }
      await page.screenshot({ path: path.join(directory, `${surface}-narrow.png`) });
      checks.push(`${label} fits a narrow window without surface horizontal overflow`);
      await page.setViewport({ width: 1600, height: 1000 });
    }
    assert.deepEqual(errors, []);
    const report = { checks, rendererErrors: errors, artifactDirectory: directory, evidence: 'Rebuilt browser app with real isolated service; agent tasks are synthetic, no model calls or Electron validation.' };
    fs.writeFileSync(path.join(directory, 'report.json'), JSON.stringify(report, null, 2));
    console.log(JSON.stringify(report, null, 2));
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
  }
}
main().catch((error) => { console.error(error); process.exitCode = 1; });

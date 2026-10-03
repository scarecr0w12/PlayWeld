// Built browser app + isolated real service/profile. No user Projects are touched.
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
  const directory = path.resolve('.turbo', 'project-selection-ui', String(Date.now()));
  fs.mkdirSync(directory, { recursive: true });
  const paths = resolvePaths({ ...process.env, GAMECRAFTER_PROFILE_DIR: path.join(directory, 'profile') });
  const service = await PlatformService.start({ paths, platformVersion: require('../packages/platform-service/package.json').version });
  const client = await connect({ socketPath: service.socketPath, token: fs.readFileSync(paths.tokenPath, 'utf8').trim(), clientName: 'project-selection-smoke', clientVersion: '0.4.0' });
  let backend;
  let browser;
  let page;
  let backendLog;
  const checks = [];
  const errors = [];
  try {
    const projects = [];
    for (const name of ['A first registered', 'B IDE workspace']) {
      projects.push(await client.call('project/create', { name, engine: { family: 'godot' }, parentDirectory: path.join(directory, 'projects') }));
    }
    const listed = await client.call('project/list', {});
    // Pick a workspace that differs from the service's first entry regardless of sorting.
    const workspace = projects.find((project) => project.projectId !== listed.projects[0].projectId);
    const other = projects.find((project) => project.projectId !== workspace.projectId);
    const port = Number(process.env.GAMECRAFTER_PROJECT_SELECTION_SMOKE_PORT ?? 3013);
    const target = `http://127.0.0.1:${port}`;
    backendLog = fs.openSync(path.join(directory, 'backend.log'), 'a');
    backend = spawn(process.execPath, [path.resolve('apps/control-room-browser/lib/backend/main.js'), '--port', String(port), '--hostname', '127.0.0.1'], {
      cwd: path.resolve('apps/control-room-browser'), env: { ...process.env, GAMECRAFTER_PROFILE_DIR: paths.profileDir, THEIA_CONFIG_DIR: path.join(directory, 'theia') }, windowsHide: true, stdio: ['ignore', backendLog, backendLog],
    });
    let ready = false;
    for (let attempt = 0; attempt < 300; attempt++) {
      try { ready = (await fetch(target)).ok; } catch { /* owned backend starting */ }
      if (ready) break;
      await delay(100);
    }
    assert(ready, 'Browser backend starts');
    browser = await puppeteer.launch({ headless: true });
    page = await browser.newPage();
    await page.setViewport({ width: 1600, height: 1000 });
    page.on('pageerror', (error) => errors.push(error.message));
    const wait = (predicate, ...args) => page.waitForFunction(predicate, { polling: 100, timeout: 30000 }, ...args);
    const clickText = async (selector, label) => {
      for (const element of await page.$$(selector)) {
        if (await element.evaluate((node, text) => node.textContent.trim() === text, label)) {
          await element.scrollIntoView();
          await element.asLocator().click();
          return;
        }
      }
      throw new Error(`Missing ${label}`);
    };
    const open = async (label, surface) => {
      await clickText('.lm-TabBar-tabLabel', 'Project Home');
      await clickText('.gamecrafter-project-home button', label);
      await page.waitForSelector(`.gamecrafter-${surface}`, { visible: true });
    };
    const close = async (label) => {
      for (const tab of await page.$$('.lm-TabBar-tab')) {
        if (await tab.evaluate((node, text) => node.querySelector('.lm-TabBar-tabLabel')?.textContent.trim() === text, label)) {
          await (await tab.$('.lm-TabBar-tabCloseIcon')).click();
          await wait((text) => ![...document.querySelectorAll('.lm-TabBar-tabLabel')].some((node) => node.textContent.trim() === text), label);
          return;
        }
      }
      throw new Error(`Missing tab ${label}`);
    };
    await page.goto(`${target}/#${encodeURI('/' + workspace.path.replace(/\\/g, '/'))}`, { waitUntil: 'networkidle2' });
    await page.waitForSelector('.theia-preload', { hidden: true, timeout: 30000 });
    // Trust only this test's disposable generated workspace if prompted.
    for (const button of await page.$$('.dialogBlock button')) {
      if (await button.evaluate((node) => /trust/i.test(node.textContent) && !/don't|do not/i.test(node.textContent))) await button.click();
    }
    const surfaces = [
      ['Swarm', 'swarm', 'Swarm Project'], ['Chat', 'chat', 'Chat Project'],
      ['Assets', 'assets', 'Assets Project'], ['Discussion Board', 'board', 'Board Project'],
      ['Knowledge', 'knowledge', 'Knowledge Project'], ['Engine', 'engine', 'Engine Project'],
      ['DCC Tools', 'dcc', 'DCC Project'], ['Skills & Roles', 'skills', 'Skills Project'],
      ['Connections', 'connections', 'Connections Project'], ['Plugins', 'plugins', 'Plugins Project'],
      ['Models', 'models', 'Models Project'], ['Settings', 'settings', 'Project'],
      ['Audit & History', 'audit', 'Audit Project'], ['Backups', 'backups', 'Backups Project'],
    ];
    for (const [label, surface, aria] of surfaces) {
      await open(label, surface);
      await wait((selector, id) => document.querySelector(selector)?.value === id, `select[aria-label="${aria}"]`, workspace.projectId);
      checks.push(`${label} selects the IDE workspace instead of the first registered Project`);
    }
    await open('Swarm', 'swarm');
    await page.select('select[aria-label="Swarm Project"]', other.projectId);
    await open('Settings', 'settings');
    await open('Swarm', 'swarm');
    assert.equal(await page.$eval('select[aria-label="Swarm Project"]', (node) => node.value), other.projectId);
    checks.push('Explicit Swarm selection survives page reactivation');
    await close('Swarm');
    await open('Swarm', 'swarm');
    await wait((id) => document.querySelector('select[aria-label="Swarm Project"]')?.value === id, workspace.projectId);
    checks.push('Closed and reopened Swarm defaults to the IDE workspace');
    await page.reload({ waitUntil: 'networkidle2' });
    await page.waitForSelector('.theia-preload', { hidden: true, timeout: 30000 });
    await open('Swarm', 'swarm');
    await wait((id) => document.querySelector('select[aria-label="Swarm Project"]')?.value === id, workspace.projectId);
    checks.push('Reloaded app restores the workspace and selects its Project');
    await page.screenshot({ path: path.join(directory, 'swarm.png') });
    assert.deepEqual(errors, []);
    const report = { checks, rendererErrors: errors, artifactDirectory: directory, target: 'built browser app with real platform service; Electron restart unverified' };
    fs.writeFileSync(path.join(directory, 'report.json'), JSON.stringify(report, null, 2));
    console.log(JSON.stringify(report, null, 2));
  } catch (error) {
    if (page) {
      await page.screenshot({ path: path.join(directory, 'failure.png') }).catch(() => undefined);
      fs.writeFileSync(path.join(directory, 'failure.html'), await page.content().catch(() => ''));
    }
    fs.writeFileSync(path.join(directory, 'failure.json'), JSON.stringify({ checks, errors, error: String(error) }, null, 2));
    throw error;
  } finally {
    if (browser) await browser.close();
    if (backend) backend.kill();
    if (backendLog !== undefined) fs.closeSync(backendLog);
    client.close();
    await service.stop();
  }
}
main().catch((error) => { console.error(error); process.exitCode = 1; });

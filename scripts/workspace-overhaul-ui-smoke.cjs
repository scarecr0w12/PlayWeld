// Real browser + isolated service. No external models, engines, installs or updates.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { spawn, execFileSync } = require('node:child_process');
const { createHash } = require('node:crypto');
const { setTimeout: delay } = require('node:timers/promises');
const { PlatformService } = require('../packages/platform-service/lib/service');
const { resolvePaths } = require('../packages/platform-service/lib/paths');
const { connect } = require('@gamecrafter/service-client');

async function main() {
  const { default: puppeteer } = await import('puppeteer');
  const directory = path.resolve('.artifacts', 'workspace-overhaul-ui', String(Date.now()));
  fs.mkdirSync(directory, { recursive: true });
  const version = require('../packages/platform-service/package.json').version;
  const paths = resolvePaths({ ...process.env, GAMECRAFTER_PROFILE_DIR: path.join(directory, 'profile') });
  const service = await PlatformService.start({ paths, platformVersion: version });
  const client = await connect({ socketPath: service.socketPath, token: fs.readFileSync(paths.tokenPath, 'utf8').trim(), clientName: 'workspace-overhaul-smoke', clientVersion: version });
  let backend;
  let browser;
  let page;
  let log;
  const checks = [];
  const errors = [];
  try {
    const project = await client.call('project/create', { name: 'Interface workshop', engine: { family: 'godot' }, parentDirectory: path.join(directory, 'projects') });
    await client.call('chat/create', { projectId: project.projectId, title: 'Gameplay questions' });
    await client.call('chat/create', { projectId: project.projectId, title: 'Art direction' });
    const port = Number(process.env.GAMECRAFTER_OVERHAUL_SMOKE_PORT ?? 3015);
    const target = `http://127.0.0.1:${port}`;
    log = fs.openSync(path.join(directory, 'backend.log'), 'a');
    backend = spawn(process.execPath, [path.resolve('apps/control-room-browser/lib/backend/main.js'), '--port', String(port), '--hostname', '127.0.0.1'], {
      cwd: path.resolve('apps/control-room-browser'), env: { ...process.env, GAMECRAFTER_PROFILE_DIR: paths.profileDir, THEIA_CONFIG_DIR: path.join(directory, 'theia') }, windowsHide: true, stdio: ['ignore', log, log],
    });
    let ready = false;
    for (let attempt = 0; attempt < 300; attempt++) {
      try { ready = (await fetch(target)).ok; } catch { /* Owned backend startup. */ }
      if (ready) break;
      await delay(100);
    }
    assert(ready, 'Isolated browser backend starts');
    browser = await puppeteer.launch({ headless: true });
    page = await browser.newPage();
    await page.setViewport({ width: 1600, height: 1000 });
    page.on('pageerror', (error) => errors.push(error.message));
    const wait = (predicate, ...args) => page.waitForFunction(predicate, { polling: 100, timeout: 30000 }, ...args);
    const findText = async (selector, text, exact = false) => {
      for (const element of await page.$$(selector)) {
        if (await element.evaluate((node, label, strict) => node.getClientRects().length > 0 && (strict ? node.textContent.trim() === label : node.textContent.includes(label)), text, exact)) return element;
      }
      throw new Error(`Missing visible ${text} in ${selector}`);
    };
    const clickText = async (selector, text, exact = false) => {
      const element = await findText(selector, text, exact);
      await element.scrollIntoView();
      await element.asLocator().click();
    };
    const open = async (label, surface) => {
      await clickText('.lm-TabBar-tabLabel', 'Project Home', true);
      await clickText('.gamecrafter-home-navigation button', label);
      await page.waitForSelector(`.gamecrafter-${surface}`, { visible: true, timeout: 30000 });
    };
    const fit = async (selector) => {
      await wait((query) => {
        const node = document.querySelector(query);
        return node && node.clientWidth > 0 && node.scrollWidth <= node.clientWidth + 2;
      }, selector);
    };
    await page.goto(`${target}/#${encodeURI('/' + project.path.replace(/\\/g, '/'))}`, { waitUntil: 'networkidle2' });
    await page.waitForSelector('.theia-preload', { hidden: true, timeout: 30000 });
    for (const button of await page.$$('.dialogBlock button')) {
      if (await button.evaluate((node) => /trust/i.test(node.textContent) && !/don't|do not/i.test(node.textContent))) await button.click();
    }
    await page.waitForSelector('.gamecrafter-home-navigation', { visible: true });
    assert(await page.$('body.playweld-workbench'));

    for (const [label, surface] of [['Engine', 'engine'], ['DCC Tools', 'dcc'], ['Connections', 'connections'], ['Assets', 'assets'], ['Knowledge', 'knowledge'], ['Skills & Roles', 'skills'], ['Plugins', 'plugins'], ['Models', 'models'], ['Settings', 'settings'], ['Backups', 'backups'], ['Audit & History', 'audit'], ['Updates', 'updates']]) {
      await open(label, surface);
      const root = `.gamecrafter-${surface}`;
      await page.waitForSelector(`${root} .gamecrafter-work-guidance, ${root} .gamecrafter-page-guidance`, { visible: true });
      const nav = `${root} .gamecrafter-section-nav button`;
      const buttons = await page.$$(nav);
      for (let index = 0; index < buttons.length; index++) {
        const button = (await page.$$(nav))[index];
        if (await button.evaluate((node) => node.disabled)) continue;
        await button.scrollIntoView();
        await button.asLocator().click();
        assert.equal(await button.evaluate((node) => node.getAttribute('aria-pressed')), 'true');
        assert(await button.evaluate((node) => !node.getAttribute('aria-controls') || Boolean(document.getElementById(node.getAttribute('aria-controls')))), `${label} navigation target exists`);
        assert.equal(await page.$$eval(nav, (nodes) => nodes.filter((node) => node.getAttribute('aria-pressed') === 'true').length), 1);
        const unnamed = await page.$eval(root, (node) => [...node.querySelectorAll('input, select, textarea')].filter((field) => field.getClientRects().length && field.type !== 'hidden' && !field.labels?.length && !field.getAttribute('aria-label') && !field.getAttribute('aria-labelledby')).map((field) => field.outerHTML));
        assert.deepEqual(unnamed, [], `${label} visible fields have accessible names`);
      }
      if (buttons.length) {
        await (await page.$$(nav))[0].asLocator().click();
        checks.push(`${label}: enabled sections are reachable with exclusive selected state and named fields`);
      } else checks.push(`${label}: focused layout and action guidance load`);
      await fit(root);
      await page.screenshot({ path: path.join(directory, `${surface}-desktop.png`) });
      await page.setViewport({ width: 650, height: 900 });
      await fit(root);
      for (let index = 0; index < buttons.length; index++) {
        const button = (await page.$$(nav))[index];
        if (await button.evaluate((node) => node.disabled)) continue;
        await button.scrollIntoView();
        await button.asLocator().click();
        await fit(root);
      }
      await page.screenshot({ path: path.join(directory, `${surface}-narrow.png`) });
      checks.push(`${label}: desktop and narrow-window sections have no surface horizontal overflow`);
      await page.setViewport({ width: 1600, height: 1000 });
    }

    await open('Chat', 'chat');
    await page.locator('.gamecrafter-chat-conversation-search input').fill('Gameplay');
    assert((await page.$eval('nav[aria-label="Chat conversations"]', (node) => node.textContent)).includes('Gameplay questions'));
    assert(!(await page.$eval('nav[aria-label="Chat conversations"]', (node) => node.textContent)).includes('Art direction'));
    await clickText('.gamecrafter-chat-starters button', 'Help me plan');
    assert.equal(await page.$eval('textarea[aria-label="Message"]', (node) => node.value), 'Help me plan a gameplay change.');
    await clickText('.gamecrafter-chat-modes button', 'Agent', true);
    assert((await page.$eval('.gamecrafter-chat-mode-guidance', (node) => node.textContent)).includes('tracked change request'));
    checks.push('Chat search filters navigation; a starter drafts without sending and Agent mode explains the handoff');
    await page.setViewport({ width: 650, height: 900 });
    await fit('.gamecrafter-chat');
    assert(!(await page.$eval('.gamecrafter-chat-conversation-select', (node) => node.textContent)).includes('Art direction'));
    assert((await page.$eval('.gamecrafter-chat-conversation-select', (node) => node.textContent)).includes('Gameplay questions'));
    await (await page.$('.gamecrafter-chat-composer button[type="submit"]')).scrollIntoView();
    assert(await page.$eval('.gamecrafter-chat', (node) => node.querySelector('.gamecrafter-chat-composer button[type="submit"]').getBoundingClientRect().bottom <= node.getBoundingClientRect().bottom + 2), 'Chat send action is reachable in the narrow dock');
    await page.screenshot({ path: path.join(directory, 'chat-narrow.png') });
    await page.setViewport({ width: 1600, height: 1000 });

    await clickText('.lm-MenuBar-itemLabel', 'PlayWeld', true);
    for (const label of ['Plan & Collaborate', 'Build & Connect', 'Configure & Extend', 'Review & Maintain']) assert(await findText('.lm-Menu-itemLabel', label, true));
    await page.screenshot({ path: path.join(directory, 'workspace-menu.png') });
    const group = await findText('.lm-Menu-itemLabel', 'Build & Connect', true);
    await group.hover();
    await wait(() => [...document.querySelectorAll('.lm-Menu-itemLabel')].some((node) => node.getClientRects().length && node.textContent.trim() === 'Tool Connections'));
    await clickText('.lm-Menu-itemLabel', 'Tool Connections', true);
    await page.waitForSelector('.gamecrafter-connections', { visible: true });
    checks.push('Grouped PlayWeld menu retains all four groups and opens an existing tool view');

    await page.keyboard.down('Control');
    await page.keyboard.press(',');
    await page.keyboard.up('Control');
    await page.waitForSelector('.theia-settings-container', { visible: true });
    assert.equal(await page.$eval('.theia-settings-container li.single-pref', (node) => getComputedStyle(node).borderRadius), '8px');
    await page.screenshot({ path: path.join(directory, 'ide-settings-desktop.png') });
    checks.push('Built-in Theia Preferences remain keyboard-accessible and use the shared field-card treatment');

    await page.keyboard.down('Control');
    await page.keyboard.down('Shift');
    await page.keyboard.press('P');
    await page.keyboard.up('Shift');
    await page.keyboard.up('Control');
    await page.waitForSelector('.quick-input-widget', { visible: true });
    assert.equal(await page.$eval('.quick-input-widget', (node) => getComputedStyle(node).borderRadius), '10px');
    await page.screenshot({ path: path.join(directory, 'command-palette.png') });
    await page.keyboard.press('Escape');
    checks.push('Built-in command palette opens with its keyboard shortcut and preserves dismissal');

    await clickText('.lm-MenuBar-itemLabel', 'Help', true);
    await clickText('.lm-Menu-itemLabel', 'About', true);
    await page.waitForSelector('.dialogBlock', { visible: true });
    assert.equal(await page.$eval('.dialogBlock', (node) => getComputedStyle(node).borderRadius), '10px');
    await page.screenshot({ path: path.join(directory, 'about-dialog.png') });
    await page.keyboard.press('Escape');
    await page.waitForSelector('.dialogBlock', { hidden: true });
    checks.push('Built-in About dialog uses the shared treatment and preserves Escape dismissal');

    await page.keyboard.down('Control');
    await page.keyboard.down('Shift');
    await page.keyboard.press('E');
    await page.keyboard.up('Shift');
    await page.keyboard.up('Control');
    await page.waitForSelector('#files .theia-TreeNode', { visible: true });
    assert.equal(await page.$eval('#files .theia-TreeNode', (node) => getComputedStyle(node).borderRadius), '4px');
    await page.screenshot({ path: path.join(directory, 'explorer-tree.png') });
    checks.push('Built-in Explorer opens by keyboard with intact tree rows and shared styling');

    await clickText('.lm-MenuBar-itemLabel', 'PlayWeld', true);
    await clickText('.lm-Menu-itemLabel', 'Create Project...', true);
    await page.waitForSelector('.quick-input-widget', { visible: true });
    assert((await page.$eval('.quick-input-widget', (node) => node.textContent)).includes('Project name'));
    await page.keyboard.press('Escape');
    checks.push('Project creation wizard uses the built-in quick input and remains cancellable without creating files');

    await open('Models', 'models');
    let previousColor = await page.$eval('.gamecrafter-models', (node) => getComputedStyle(node).getPropertyValue('--theia-editor-background'));
    for (const [theme, artifact] of [['Light (Theia)', 'light'], ['High Contrast (Theia)', 'high-contrast']]) {
      await page.keyboard.down('Control');
      await page.keyboard.down('Shift');
      await page.keyboard.press('P');
      await page.keyboard.up('Shift');
      await page.keyboard.up('Control');
      await page.waitForSelector('.quick-input-widget input', { visible: true });
      await page.locator('.quick-input-widget input').fill('>Color Theme');
      await wait(() => [...document.querySelectorAll('.quick-input-list .monaco-list-row')].some((node) => node.getClientRects().length && node.textContent.includes('Color Theme')));
      await page.keyboard.press('Enter');
      await wait((label) => [...document.querySelectorAll('.quick-input-list .monaco-list-row')].some((node) => node.getClientRects().length && node.textContent.includes(label)), theme);
      await clickText('.quick-input-list .monaco-highlighted-label', theme, true);
      if (await page.$eval('.quick-input-widget', (node) => node.getClientRects().length > 0).catch(() => false)) await page.keyboard.press('Enter');
      await page.waitForSelector('.quick-input-widget', { hidden: true });
      await wait((previous) => getComputedStyle(document.querySelector('.gamecrafter-models')).getPropertyValue('--theia-editor-background') !== previous, previousColor);
      previousColor = await page.$eval('.gamecrafter-models', (node) => getComputedStyle(node).getPropertyValue('--theia-editor-background'));
      await fit('.gamecrafter-models');
      await page.screenshot({ path: path.join(directory, `models-${artifact}.png`) });
      checks.push(`Selected ${theme}: shared page colors follow the IDE theme without layout overflow`);
    }
    await page.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'reduce' }]);
    assert.equal(await page.$eval('.gamecrafter-models button', (node) => getComputedStyle(node).transitionDuration), '0s');
    checks.push('Reduced-motion preference disables custom button transitions');

    assert.deepEqual(errors, []);
    const report = { checks, rendererErrors: errors, artifactDirectory: directory, evidence: 'Rebuilt browser app and real isolated service; no external model/engine/DCC/plugin execution or live Electron verification.' };
    fs.writeFileSync(path.join(directory, 'report.json'), JSON.stringify(report, null, 2));
    if (process.env.GAMECRAFTER_OVERHAUL_CAPTURE_DIR) {
      const output = path.resolve(process.env.GAMECRAFTER_OVERHAUL_CAPTURE_DIR);
      assert(output.startsWith(path.resolve('docs/images') + path.sep), 'Published UI captures stay under docs/images');
      assert(!fs.existsSync(output), 'Preserve existing documentation capture directories');
      const screenshots = ['workspace-menu.png', 'ide-settings-desktop.png', 'command-palette.png', 'about-dialog.png', 'explorer-tree.png', 'models-light.png', 'models-high-contrast.png', 'chat-narrow.png'];
      fs.mkdirSync(output, { recursive: true });
      for (const name of screenshots) fs.copyFileSync(path.join(directory, name), path.join(output, name));
      fs.writeFileSync(path.join(output, 'capture-report.json'), JSON.stringify({
        capturedAt: new Date().toISOString(), platformVersion: version,
        target: 'Built development browser Control Room and real isolated platform service',
        provider: 'No model/provider/engine requests; disposable interface workshop fixture',
        source: { commit: execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(), workingTree: execFileSync('git', ['status', '--porcelain'], { encoding: 'utf8' }).trim() ? 'pending changes' : 'clean', script: 'scripts/workspace-overhaul-ui-smoke.cjs', captureScriptSha256: createHash('sha256').update(fs.readFileSync(__filename)).digest('hex') },
        checks, screenshots, rendererErrors: errors,
      }, null, 2) + '\n');
    }
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

// Run against the built browser app, or an Electron app started with a local CDP port.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { setTimeout: delay } = require('node:timers/promises');
const { connect } = require('@gamecrafter/service-client');
const { resolvePaths } = require('../packages/platform-service/lib/paths');

async function connectDesktop(puppeteer) {
  const deadline = Date.now() + 15000;
  let lastError;
  while (Date.now() < deadline) {
    try {
      return await puppeteer.connect({ browserURL: process.env.GAMECRAFTER_CDP_URL ?? 'http://127.0.0.1:9222', protocolTimeout: 90000 });
    } catch (error) { lastError = error; await delay(200); }
  }
  throw lastError;
}

async function clickHandle(page, element) {
  await element.scrollIntoView();
  // A success notification can cover a button in the narrow desktop window.
  await page.waitForFunction(node => {
    if (!node.isConnected || node.disabled) return false;
    const rect = node.getBoundingClientRect();
    const hit = document.elementFromPoint(rect.x + rect.width / 2, rect.y + rect.height / 2);
    return hit === node || node.contains(hit);
  }, { polling: 100, timeout: 60000 }, element);
  await element.asLocator().click();
}

async function clickText(page, selector, text) {
  for (const element of await page.$$(selector)) {
    if (await element.evaluate((node, label) => node.getClientRects().length > 0 && (node.textContent.trim() === label || node.querySelector('strong')?.textContent.trim() === label || [...node.childNodes].filter(child => child.nodeType === Node.TEXT_NODE).map(child => child.textContent).join('').trim() === label), text)) {
      await clickHandle(page, element);
      return;
    }
  }
  throw new Error(`Could not find ${text} in ${selector}`);
}

// DOM state checks must keep polling when a desktop window is occluded.
function waitForUi(page, predicate, ...args) {
  return page.waitForFunction(predicate, { polling: 100, timeout: 60000 }, ...args);
}

async function inputStep(page, step, value) {
  await waitForUi(page,
    (number) => document.querySelector('.quick-input-title')?.textContent.includes(`(${number}/6)`),
    step,
  );
  const input = await page.waitForSelector('.quick-input-widget input.input', { visible: true });
  await input.click();
  await page.keyboard.down('Control');
  await page.keyboard.press('KeyA');
  await page.keyboard.up('Control');
  if (value) await input.type(value);
  else await page.keyboard.press('Backspace');
  await page.keyboard.press('Enter');
}

async function trustSmokeProject(page) {
  if (!await page.$('.workspace-trust-dialog')) return;
  const folders = await page.$$eval('.workspace-trust-folder-list li', (nodes) => nodes.map((node) => node.textContent.trim()));
  const parent = path.resolve('.turbo', 'live-projects');
  assert(folders.length > 0, 'Workspace trust prompt must identify its folders');
  for (const folder of folders) {
    const relative = path.relative(parent, folder);
    assert(relative && !relative.startsWith('..') && !path.isAbsolute(relative), 'Only disposable smoke Projects may be trusted');
    assert(/^live-(desktop|browser)-\d+$/.test(relative), 'Only generated smoke Project folders may be trusted');
  }
  await clickText(page, '.workspace-trust-dialog button', 'Yes, I trust the authors');
  await page.waitForSelector('.workspace-trust-dialog', { hidden: true });
}

async function main() {
  const { default: puppeteer } = await import('puppeteer');
  const desktop = process.argv.includes('--electron');
  const target = process.env.GAMECRAFTER_SMOKE_URL ?? 'http://127.0.0.1:3000';
  const directory = path.resolve(process.env.GAMECRAFTER_SMOKE_ARTIFACT_DIR ?? path.join('.turbo', desktop ? 'live-electron' : 'live-browser'));
  fs.mkdirSync(directory, { recursive: true });
  const browser = desktop
    ? await connectDesktop(puppeteer)
    : await puppeteer.launch({ headless: true, args: process.argv.includes('--no-sandbox') ? ['--no-sandbox'] : [] });
  const checks = [];
  const errors = [];
  let page;
  let browserClosed = false;
  try {
    page = desktop ? await (await browser.waitForTarget((target) => target.type() === 'page' && target.url().includes('/lib/frontend/index.html'), { timeout: 30000 })).page() : await browser.newPage();
    assert(page, 'Electron must expose a renderer page');
    await page.bringToFront();
    page.on('pageerror', (error) => errors.push(error.message));
    if (!desktop) {
      await page.setViewport({ width: 1600, height: 1000 });
      await page.goto(target, { waitUntil: 'networkidle2' });
    }
    await waitForUi(page, () => Array.from(document.querySelectorAll('.lm-TabBar-tabLabel')).some(label => label.textContent.trim() === 'Project Home'));
    await trustSmokeProject(page);
    await clickText(page, '.lm-TabBar-tabLabel', 'Project Home');
    await page.waitForSelector('.gamecrafter-project-home', { visible: true, timeout: 60000 });
    await waitForUi(page, () => document.querySelector('.gamecrafter-project-home')?.textContent.includes('Connected to platform service'));
    checks.push('Project Home connects to the real platform service');
    await waitForUi(page, () => getComputedStyle(document.body).getPropertyValue('--theia-editor-background').trim().toLowerCase() === '#110d1c');
    assert.equal(await page.evaluate(() => getComputedStyle(document.body).getPropertyValue('--theia-button-background').trim().toLowerCase()), '#b4ff39');
    checks.push('Dark violet and neon green theme applies to the IDE and widget controls');
    await page.screenshot({ path: path.join(directory, 'home.png') });

    const projectName = `Live ${desktop ? 'Desktop' : 'Browser'} ${Date.now()}`;
    await clickText(page, '.gamecrafter-project-home button', 'Create Project');
    await inputStep(page, 1, projectName);
    await inputStep(page, 2, 'Created by the repeatable live UI smoke test');
    await inputStep(page, 3, 'Godot');
    await inputStep(page, 4, 'Adventure');
    await inputStep(page, 5, path.resolve('.turbo', 'live-projects'));
    await waitForUi(page, () => document.querySelector('.quick-input-title')?.textContent.includes('(6/6)'));
    await page.keyboard.press('Enter');
    await waitForUi(page, (name) => document.querySelector('.gamecrafter-project-home')?.textContent.includes(name), projectName);
    checks.push('Project creation wizard creates and lists a real Project');
    await page.screenshot({ path: path.join(directory, 'project-created.png') });

    const surfaces = [
      ['Settings', 'settings'], ['Models', 'models'], ['Chat', 'chat'],
      ['Skills & Roles', 'skills'], ['Connections', 'connections'],
      ['Discussion Board', 'board'], ['Swarm', 'swarm'], ['Plugins', 'plugins'],
      ['Engine', 'engine'], ['DCC Tools', 'dcc'], ['Knowledge', 'knowledge'],
      ['Assets', 'assets'], ['Backups', 'backups'], ['Audit & History', 'audit'],
      ['Updates', 'updates'],
    ];
    for (const [label, suffix] of surfaces) {
      await clickText(page, '.lm-TabBar-tabLabel', 'Project Home');
      await clickText(page, '.gamecrafter-project-home button', label);
      const selector = `.gamecrafter-${suffix}`;
      await page.waitForSelector(selector, { visible: true });
      await waitForUi(page, (root) => {
        const content = document.querySelector(root)?.textContent ?? '';
        return content.length > 30 && !/^Loading/.test(content.trim());
      }, selector);
      const text = await page.$eval(selector, (node) => node.innerText);
      assert(!text.includes('Platform service did not become available'), `${label} lost its service connection`);
      if (suffix === 'engine' || suffix === 'dcc') {
        // This smoke creates a Project but opens its IDE workspace at the end.
        // Choose it explicitly before exercising Project-specific setup forms.
        const projectSelector = `select[aria-label="${suffix === 'engine' ? 'Engine' : 'DCC'} Project"]`;
        await waitForUi(page, (selector, name) => [...document.querySelector(selector).options].some(option => option.textContent === name || option.textContent.startsWith(`${name} (`)), projectSelector, projectName);
        const projectId = await page.$eval(projectSelector, (select, name) => [...select.options].find(option => option.textContent === name || option.textContent.startsWith(`${name} (`))?.value, projectName);
        assert(projectId, `${label} must list the generated Project`);
        await page.select(projectSelector, projectId);
        await page.waitForSelector(`${selector} .gamecrafter-section-nav button`, { visible: true });
        await clickText(page, `${selector} .gamecrafter-section-nav button`, 'Installations');
        await clickText(page, `${selector} .gamecrafter-page-advanced summary`, 'Register a manual installation');
        await page.waitForSelector(suffix === 'engine' ? '.gamecrafter-engine form select' : 'select[aria-label="DCC installation kind"]', { visible: true });
      }
      if (suffix === 'engine') {
        const selects = await page.$$('.gamecrafter-engine form select');
        await selects[0].select('unreal');
        assert.equal(await selects[0].evaluate(node => node.value), 'unreal', 'Engine family selection must persist');
        await selects[1].select('commandlet');
        assert.equal(await selects[1].evaluate(node => node.value), 'commandlet', 'Engine installation kind must persist');
        const executable = await page.$('.gamecrafter-engine form input');
        await executable.asLocator().fill('C:\\review\\UnrealEditor-Cmd.exe');
        assert.equal(await executable.evaluate(node => node.value), 'C:\\review\\UnrealEditor-Cmd.exe', 'Engine executable input must retain typed text');
        checks.push('Engine setup preserves family, kind, and executable edits');
      }
      if (suffix === 'dcc') {
        await page.select('[aria-label="DCC installation kind"]', 'python');
        assert.equal(await page.$eval('[aria-label="DCC installation kind"]', node => node.value), 'python', 'DCC installation kind must persist');
        checks.push('DCC setup preserves installation kind edits');
      }
      if (suffix === 'settings') {
        assert(await page.$('nav[aria-label="Settings groups"]'), 'Settings must use grouped pages');
        await page.locator('.gamecrafter-settings-search input').fill('access.mode');
        await page.waitForSelector('select[aria-label="Access mode"]');
        const reset = await page.$('.gamecrafter-settings-reset');
        if (reset && !await reset.evaluate(button => button.disabled)) {
          await clickHandle(page, reset);
          await waitForUi(page, () => document.querySelector('.gamecrafter-setting-source')?.textContent.includes('Effective from Default'));
        }
        await page.select('select[aria-label="Access mode"]', 'restricted');
        await waitForUi(page, () => document.querySelector('.gamecrafter-setting-source')?.textContent.includes('Effective from Platform'));
        await clickText(page, '.gamecrafter-setting-row button', 'Reset');
        await waitForUi(page, () => document.querySelector('select[aria-label="Access mode"]')?.value === 'ask-always' && document.querySelector('.gamecrafter-setting-source')?.textContent.includes('Effective from Default'));
        checks.push('Settings saves a platform override and resets to the inherited default');
        const downloadPath = path.join(directory, 'gamecrafter-settings.json');
        await clickText(page, '.gamecrafter-settings .gamecrafter-page-advanced summary', 'Import and export');
        fs.rmSync(downloadPath, { force: true });
        const cdp = await page.createCDPSession();
        await cdp.send('Page.setDownloadBehavior', { behavior: 'allow', downloadPath: directory });
        await clickText(page, '.gamecrafter-settings .gamecrafter-page-advanced button', 'Export redacted settings');
        const downloadDeadline = Date.now() + 15000;
        while (!fs.existsSync(downloadPath) && Date.now() < downloadDeadline) await delay(100);
        assert(fs.existsSync(downloadPath), 'Settings export must download a JSON file');
        const settingsExport = JSON.parse(fs.readFileSync(downloadPath, 'utf8'));
        assert.equal(settingsExport.schemaVersion, 1);
        assert(settingsExport.settings.some(setting => setting.key === 'access.mode' && setting.value === 'ask-always'), 'Settings export must contain live inherited values');
        await cdp.detach();
        checks.push('Settings downloads a versioned redacted export from the live service');
        const importedSetting = settingsExport.settings.find(setting => setting.key === 'access.mode');
        importedSetting.layers.platform = 'restricted';
        const importPath = path.join(directory, 'settings-import-fixture.json');
        fs.writeFileSync(importPath, JSON.stringify(settingsExport));
        const importInput = await page.$('input[aria-label="Import settings file"]');
        assert(importInput, 'Settings must expose an accessible file import');
        await importInput.uploadFile(importPath);
        await page.waitForSelector('[aria-label="Settings import preview"]', { visible: true });
        assert.equal(await page.$eval('select[aria-label="Access mode"]', node => node.value), 'ask-always', 'Import preview must not write settings');
        await clickText(page, '[aria-label="Settings import preview"] button', 'Apply overrides');
        await waitForUi(page, () => document.querySelector('select[aria-label="Access mode"]')?.value === 'restricted');
        await clickText(page, '.gamecrafter-setting-row button', 'Reset');
        await waitForUi(page, () => document.querySelector('select[aria-label="Access mode"]')?.value === 'ask-always');
        checks.push('Settings previews, applies and resets an imported platform override');


      }
      if (suffix === 'skills') {
        await waitForUi(page, (name) => [...document.querySelector('select[aria-label="Skills Project"]').options].some(option => option.textContent === name), projectName);
        const projectId = await page.$eval('select[aria-label="Skills Project"]', (select, name) => [...select.options].find(option => option.textContent === name)?.value, projectName);
        assert(projectId, 'Skills must list the generated Project');
        await page.select('select[aria-label="Skills Project"]', projectId);
        await waitForUi(page, () => [...document.querySelectorAll('.gamecrafter-skill-card .gamecrafter-page-meta-item')].filter(node => node.textContent.trim() === 'Bundled').length === 30);
        // Platform-only rows can already be visible while the selected Project's
        // enablement request is still loading. Wait for that scoped result too.
        await waitForUi(page, () => document.querySelector('input[aria-label="Enable skill asset-pipeline"]')?.checked);
        const row = await page.$('input[aria-label="Enable skill asset-pipeline"]');
        assert(row && await row.evaluate(node => node.checked), 'Bundled guides must be enabled by default');
        await page.evaluate(() => {
          const checkbox = document.querySelector('input[aria-label="Enable skill asset-pipeline"]');
           const row = checkbox.closest('.gamecrafter-skill-card');
          [...row.querySelectorAll('button')].find(button => button.textContent.trim() === 'Read guide').click();
        });
        await waitForUi(page, () => document.querySelector('.gamecrafter-skill-reader-content')?.textContent.includes('Asset pipeline'));
        await page.select('select[aria-label="Skill document"]', 'references/workflows.md');
        await waitForUi(page, () => document.querySelector('.gamecrafter-skill-reader-content')?.textContent.includes('detailed workflows') && !document.querySelector('.gamecrafter-skill-reader [role="status"]'));
        assert(!await page.$('.gamecrafter-skills-error'), 'Reference reads must succeed without UI errors');
        assert(await page.$eval('.gamecrafter-skill-reader', node => { const rect = node.getBoundingClientRect(); return rect.top >= 0 && rect.top < window.innerHeight / 2; }), 'Read guide must bring the reader into view');
        await page.screenshot({ path: path.join(directory, 'skills-reader.png') });
        await row.click();
        await waitForUi(page, () => {
           const row = document.querySelector('input[aria-label="Enable skill asset-pipeline"]').closest('.gamecrafter-skill-card');
          return [...row.querySelectorAll('button')].some(button => button.textContent.trim() === 'Read guide' && button.disabled);
        });
        await page.click('input[aria-label="Enable skill asset-pipeline"]');
        await waitForUi(page, () => {
           const row = document.querySelector('input[aria-label="Enable skill asset-pipeline"]').closest('.gamecrafter-skill-card');
          return [...row.querySelectorAll('button')].some(button => button.textContent.trim() === 'Read guide' && !button.disabled);
        });
        checks.push('Thirty bundled guides load with Project controls and readable supporting references');
        if (!desktop) {
          await page.setViewport({ width: 700, height: 900 });
          await delay(300);
          assert(await page.$eval('.gamecrafter-skill-reader', node => node.scrollWidth <= node.clientWidth + 1), 'Skill reader text must remain contained at narrow widths');
          await page.screenshot({ path: path.join(directory, 'skills-reader-narrow.png') });
          await page.setViewport({ width: 1600, height: 1000 });
          checks.push('Skill reference reader remains contained at a narrow viewport');
        }
      }
      if (suffix === 'swarm') {
        const paths = resolvePaths();
        const client = await connect({ socketPath: paths.socketPath, token: fs.readFileSync(paths.tokenPath, 'utf8').trim(), clientName: 'packaged-goal-smoke', clientVersion: require('../packages/platform-service/package.json').version });
        try {
          const project = (await client.call('project/list', {})).projects.find(item => item.name === projectName);
          if (!project) throw new Error('Owned smoke Project is missing.');
          const goal = '## Package acceptance\n\n- **Retain configuration**\n- Inspect `player.gd`\n\n```gdscript\nvar ready = true\n```';
          const request = await client.call('change/request', { projectId: project.projectId, text: goal });
          await client.call('task/create', { projectId: project.projectId, parentTaskId: request.rootTaskId, kind: 'noop.echo', title: 'Packaged formatted goal', role: 'validator', goal });
          await page.select('.gamecrafter-swarm select[aria-label="Swarm Project"]', project.projectId);
          await waitForUi(page, () => [...document.querySelectorAll('.gamecrafter-swarm-node')].some(node => node.textContent.includes('Packaged formatted goal')));
          await clickText(page, '.gamecrafter-swarm-node', 'Packaged formatted goal');
          await waitForUi(page, () => document.querySelector('[aria-label="Task goal"] h2')?.textContent === 'Package acceptance');
          if (!(await page.$('[aria-label="Task goal"] li strong')) || !(await page.$('[aria-label="Task goal"] pre code'))) throw new Error('Packaged task Markdown was not structured.');
          checks.push('Packaged hierarchy formats real task headings, lists and code without flattening the goal');
        } finally { client.close(); }
      }
      if (suffix === 'assets') {
        const paths = resolvePaths();
        const client = await connect({ socketPath: paths.socketPath, token: fs.readFileSync(paths.tokenPath, 'utf8').trim(), clientName: 'desktop-assets-smoke', clientVersion: require('../packages/platform-service/package.json').version });
        try {
          const registered = await client.call('project/list', {});
          const project = registered.projects.find(item => item.name === projectName);
          if (!project || !path.resolve(project.path).startsWith(path.resolve('.turbo/live-projects') + path.sep)) throw new Error('Asset fixture must stay in the disposable smoke Project.');
          const assetDirectory = path.join(project.path, 'game', 'assets');
          fs.mkdirSync(assetDirectory, { recursive: true });
          fs.writeFileSync(path.join(assetDirectory, 'desktop-smoke.png'), Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+ip1sAAAAASUVORK5CYII=', 'base64'));
          await page.select('.gamecrafter-assets select[aria-label="Assets Project"]', project.projectId);
          await page.waitForSelector('.gamecrafter-assets .gamecrafter-section-nav button', { visible: true });
          await clickText(page, '.gamecrafter-assets .gamecrafter-section-nav button', 'Library');
          await clickText(page, '.gamecrafter-assets header button', 'Refresh');
          await waitForUi(page, () => [...document.querySelectorAll('.gamecrafter-assets-file-list button')].some(node => node.textContent.includes('desktop-smoke.png')));
          for (const file of await page.$$('.gamecrafter-assets-file-list button')) {
            if (await file.evaluate(node => node.textContent.includes('desktop-smoke.png'))) { await clickHandle(page, file); break; }
          }
          await waitForUi(page, () => [...document.querySelectorAll('.gamecrafter-assets .gamecrafter-section-nav button')].some(node => node.getAttribute('aria-pressed') === 'true' && node.textContent.trim() === 'Preview'));
          await waitForUi(page, () => { const image = document.querySelector('.gamecrafter-image-viewer img'); return image?.complete && image.naturalWidth === 1 && image.naturalHeight === 1; });
          checks.push('Assets library opens its real image preview in the visible Preview pane');
        } finally { client.close(); }
      }
      if (suffix === 'audit') {
        await waitForUi(page, (name) => [...document.querySelector('.gamecrafter-audit select').options].some(option => option.textContent === name), projectName);
        const projectId = await page.$eval('.gamecrafter-audit select', (select, name) => [...select.options].find(option => option.textContent === name)?.value, projectName);
        assert(projectId, 'Audit must list the smoke Project');
        await page.select('.gamecrafter-audit select', projectId);
        await waitForUi(page, () => [...document.querySelectorAll('.gamecrafter-audit button')].some(button => button.textContent.trim() === 'Export redacted page' && !button.disabled));
        const auditPath = path.join(directory, 'gamecrafter-audit.json');
        fs.rmSync(auditPath, {force: true});
        const cdp = await page.createCDPSession();
        await cdp.send('Page.setDownloadBehavior', {behavior: 'allow', downloadPath: directory});
        await clickText(page, '.gamecrafter-audit button', 'Export redacted page');
        const deadline = Date.now() + 15000;
        while (!fs.existsSync(auditPath) && Date.now() < deadline) await delay(100);
        assert(fs.existsSync(auditPath), 'Audit export must download the selected Project page');
        const audit = JSON.parse(fs.readFileSync(auditPath, 'utf8'));
        assert.equal(audit.schemaVersion, 1);
        assert.equal(audit.projectId, projectId);
        assert(audit.events.some(event => event.kind === 'project.created'));
        assert(Array.isArray(audit.calls) && Array.isArray(audit.events));
        assert(Array.isArray(audit.modelUsage), 'Packaged audit export includes model usage');
        await clickText(page, '.gamecrafter-audit .gamecrafter-section-nav button', 'Model usage');
        await waitForUi(page, () => document.querySelector('.gamecrafter-audit-stats')?.getClientRects().length > 0);
        await cdp.detach();
        checks.push('Audit & History downloads redacted usage and exposes a separate model-cost overview');
      }
      checks.push(`${label} opens with live service data`);
      await page.screenshot({ path: path.join(directory, `${suffix}.png`) });
    }

    await clickText(page, '.lm-TabBar-tabLabel', 'Project Home');
    if (!desktop) {
      await page.setViewport({width: 700, height: 1000});
      await waitForUi(page, () => {
         const actions = document.querySelector('.gamecrafter-home-navigation');
        return actions && Array.from(actions.querySelectorAll('button')).every(button => {
          const bounds = button.getBoundingClientRect();
          return bounds.width >= 155 && bounds.width <= actions.clientWidth + 1 && button.scrollWidth <= button.clientWidth + 1;
        });
      });
      assert(await page.$eval('.gamecrafter-project-home', root => root.scrollWidth <= root.clientWidth + 1), 'Narrow Project Home must contain its tables and controls');
      await page.screenshot({path: path.join(directory, 'home-narrow.png')});
      checks.push('Project Home adapts to a narrow viewport without horizontal overflow');
      await page.setViewport({width: 1600, height: 1000});
    }
    const initialPages = (await browser.pages()).length;
    const cards = await page.$$('.gamecrafter-project-home-table tbody tr');
    let opened = false;
    for (const card of cards) {
      if ((await card.evaluate((node) => node.textContent)).includes(projectName)) {
        const button = await card.$('button');
        assert(button, 'Project card must have an Open action');
        await button.click();
        opened = true;
        break;
      }
    }
    assert(opened, 'Created Project must expose an Open action');
    const folderName = projectName.toLowerCase().replaceAll(' ', '-');
    const workspaceDeadline = Date.now() + 60000;
    let workspaceOpened = false;
    while (Date.now() < workspaceDeadline) {
      try {
        workspaceOpened = page.url().toLowerCase().includes(folderName)
          && (await page.evaluate(() => document.title)).toLowerCase().includes(folderName);
        if (workspaceOpened) break;
      } catch {
        // Theia reloads the renderer when changing workspaces; use its new main context.
      }
      await delay(100);
    }
    assert(workspaceOpened, 'Created Project must become the active workspace');
    // Workspace trust may appear after the renderer has finished its reload.
    await waitForUi(page, () => Array.from(document.querySelectorAll('.lm-TabBar-tabLabel')).some(label => label.textContent.trim() === 'Project Home'));
    await delay(1000);
    await trustSmokeProject(page);
    assert.equal((await browser.pages()).length, initialPages, 'Open Project must preserve the current window');
    checks.push('Open Project selects the workspace in the current window');
    await page.screenshot({ path: path.join(directory, 'project-opened.png') });
    assert.deepEqual(errors, [], 'Renderer errors must be investigated');
    if (!desktop) {
      await browser.close();
      browserClosed = true;
      await delay(500);
      const response = await fetch(target);
      assert(response.ok, 'Backend must survive frontend disconnection');
      checks.push('Browser backend stays available after the frontend disconnects');
    }
    const report = { schemaVersion: 1, target: desktop ? 'electron' : 'browser', testedAt: new Date().toISOString(), projectName, checks, rendererErrors: errors };
    fs.writeFileSync(path.join(directory, 'report.json'), JSON.stringify(report, null, 2));
    console.log(JSON.stringify(report, null, 2));
  } catch (error) {
    if (page) {
      await page.screenshot({ path: path.join(directory, 'failure.png') }).catch(() => undefined);
      fs.writeFileSync(path.join(directory, 'failure.html'), await page.content().catch(() => ''));
    }
    fs.writeFileSync(path.join(directory, 'failure.json'), JSON.stringify({ checks, rendererErrors: errors, error: String(error) }, null, 2));
    throw error;
  } finally {
    if (desktop) browser.disconnect();
    else if (!browserClosed) await browser.close();
  }
}

main().catch((error) => { console.error(error); process.exitCode = 1; });

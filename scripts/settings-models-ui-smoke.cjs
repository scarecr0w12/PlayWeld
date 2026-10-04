// Run after building both the packages and the development browser app.
// Uses an isolated profile and a fake provider; no user accounts or settings are changed.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { createServer } = require('node:http');
const { spawn } = require('node:child_process');
const { setTimeout: delay } = require('node:timers/promises');
const { PlatformService } = require('../packages/platform-service/lib/service');
const { resolvePaths } = require('../packages/platform-service/lib/paths');
const { connect } = require('@gamecrafter/service-client');

async function main() {
  const { default: puppeteer } = await import('puppeteer');
  const directory = path.resolve('.artifacts', 'settings-models-ui', String(Date.now()));
  fs.mkdirSync(directory, { recursive: true });
  const paths = resolvePaths({
    ...process.env,
    GAMECRAFTER_PROFILE_DIR: path.join(directory, 'profile'),
  });
  const service = await PlatformService.start({ paths, platformVersion: '0.1.1' });
  const client = await connect({
    socketPath: service.socketPath,
    token: fs.readFileSync(paths.tokenPath, 'utf8').trim(),
    clientName: 'settings-models-smoke',
    clientVersion: '0.1.1',
  });
  const provider = createServer((request, response) => {
    response.writeHead(200, { 'content-type': 'application/json' });
    response.end(
      JSON.stringify({
        data: ['one', 'two', 'three'].map((id) => ({ id, capabilities: { chat: true }, ...(id === 'two' ? { context_length: 1_000_000, top_provider: { max_completion_tokens: 128_000 } } : {}) })),
      }),
    );
  });
  await new Promise((resolve) => provider.listen(0, '127.0.0.1', resolve));
  const baseUrl = `http://127.0.0.1:${provider.address().port}/v1`;
  const port = Number(process.env.GAMECRAFTER_SETTINGS_SMOKE_PORT ?? 3011);
  const target = `http://127.0.0.1:${port}`;
  const backendLog = fs.openSync(path.join(directory, 'backend.log'), 'a');
  const backend = spawn(
    process.execPath,
    [
      path.resolve('apps/control-room-browser/lib/backend/main.js'),
      '--port',
      String(port),
      '--hostname',
      '127.0.0.1',
    ],
    {
      cwd: path.resolve('apps/control-room-browser'),
      env: {
        ...process.env,
        GAMECRAFTER_PROFILE_DIR: paths.profileDir,
        THEIA_CONFIG_DIR: path.join(directory, 'theia'),
      },
      windowsHide: true,
      stdio: ['ignore', backendLog, backendLog],
    },
  );
  let browser;
  let page;
  const checks = [];
  const errors = [];
  const wait = (predicate, ...args) =>
    page.waitForFunction(predicate, { polling: 100, timeout: 30000 }, ...args);
  const clickText = async (selector, label) => {
    for (const element of await page.$$(selector)) {
      if (await element.evaluate((node, text) => node.textContent.trim() === text, label)) {
        await element.scrollIntoView();
        await element.asLocator().click();
        return;
      }
    }
    throw new Error(`Missing ${label} in ${selector}`);
  };
  const open = async (label, suffix) => {
    await clickText('.lm-TabBar-tabLabel', 'Project Home');
    await clickText('.gamecrafter-project-home button', label);
    await page.waitForSelector(`.gamecrafter-${suffix}`, { visible: true, timeout: 30000 });
  };
  const close = async (label) => {
    for (const tab of await page.$$('.lm-TabBar-tab')) {
      if (
        await tab.evaluate(
          (node, text) => node.querySelector('.lm-TabBar-tabLabel')?.textContent.trim() === text,
          label,
        )
      ) {
        await (await tab.$('.lm-TabBar-tabCloseIcon')).click();
        await wait(
          (name) =>
            ![...document.querySelectorAll('.lm-TabBar-tabLabel')].some(
              (node) => node.textContent.trim() === name,
            ),
          label,
        );
        return;
      }
    }
    throw new Error(`Missing tab ${label}`);
  };
  try {
    const deadline = Date.now() + 30000;
    let ready = false;
    while (Date.now() < deadline) {
      try {
        ready = (await fetch(target)).ok;
      } catch {
        /* Wait for the owned backend. */
      }
      if (ready) break;
      await delay(100);
    }
    assert(ready, 'Browser backend must start');
    browser = await puppeteer.launch({ headless: true });
    page = await browser.newPage();
    await page.setViewport({ width: 1600, height: 1000 });
    page.on('pageerror', (error) => errors.push(error.message));
    page.on('console', (message) => {
      if (['error', 'warn'].includes(message.type())) console.error('Renderer:', message.text());
    });
    await page.goto(target, { waitUntil: 'networkidle2' });
    await page.waitForSelector('.gamecrafter-project-home', { visible: true, timeout: 30000 });
    await wait(() =>
      document
        .querySelector('.gamecrafter-project-home')
        ?.textContent.includes('Connected to platform service'),
    );
    await page.waitForSelector('.theia-preload', { hidden: true, timeout: 30000 });
    for (let iteration = 0; iteration < 3; iteration++) {
      await open('Settings', 'settings');
      await page.waitForSelector('nav[aria-label="Settings groups"] button');
      await close('PlayWeld Settings');
      await open('Models', 'models');
      await page.waitForSelector('input[aria-label="Provider display name"]');
      await close('Models & Routing');
    }
    checks.push('Settings and Models tabs close and reopen three times with labels and content');
    await open('Settings', 'settings');
    const search = '.gamecrafter-settings-search input';
    await page.type(search, 'projects.defaultParentDirectory');
    assert.equal(await page.$eval(search, (node) => node.value), 'projects.defaultParentDirectory');
    const text = 'input[aria-label="Default Project parent directory"]';
    await page.waitForSelector(text);
    const savedDirectory = path.join(directory, 'projects');
    await page.locator(text).fill(savedDirectory);
    assert.equal(await page.$eval(text, (node) => node.value), savedDirectory);
    await page.click(search);
    await wait(
      (value) =>
        document.querySelector('input[aria-label="Default Project parent directory"]')?.value ===
          value &&
        document.querySelector('.gamecrafter-setting-source')?.textContent.includes('Platform'),
      savedDirectory,
    );
    await close('PlayWeld Settings');
    await open('Settings', 'settings');
    await page.type(search, 'projects.defaultParentDirectory');
    await wait(
      (value) =>
        document.querySelector('input[aria-label="Default Project parent directory"]')?.value ===
        value,
      savedDirectory,
    );
    await page.locator(search).fill('access.restricted.allowedTools');
    const array = 'input[aria-label="Allowed restricted-mode tools"]';
    await page.waitForSelector(array);
    await page.type(array, 'engine/*, asset/*');
    assert.equal(await page.$eval(array, (node) => node.value), 'engine/*, asset/*');
    await page.click(search);
    await wait(() =>
      document.querySelector('.gamecrafter-setting-source')?.textContent.includes('Platform'),
    );
    await page.locator(search).fill('agents.maxSpawnDepth');
    const number = 'input[aria-label="Maximum agent spawn depth"]';
    await page.waitForSelector(number);
    await page.locator(number).fill('12');
    assert.equal(await page.$eval(number, (node) => node.value), '12');
    await page.click(search);
    await wait(
      () =>
        document.querySelector('input[aria-label="Maximum agent spawn depth"]')?.value === '12' &&
        document.querySelector('.gamecrafter-setting-source')?.textContent.includes('Platform'),
    );
    checks.push(
      'Settings search, text, comma-separated lists and numbers update during typing and persist on blur',
    );

    await open('Models', 'models');
    await page.type('input[aria-label="Provider display name"]', 'First provider');
    assert.equal(
      await page.$eval('input[aria-label="Provider display name"]', (node) => node.value),
      'First provider',
    );
    await page.locator('input[aria-label="Provider base URL"]').fill(baseUrl);
    await clickText('.gamecrafter-models-account-form button', 'Add account');
    await wait(
      () =>
        document.querySelector('.gamecrafter-models')?.textContent.includes('First provider') &&
        document.querySelector('input[aria-label="Provider display name"]')?.value === '',
    );
    const accounts = await client.call('provider/accounts', {});
    const first = accounts.accounts.find((account) => account.displayName === 'First provider');
    assert(first);
    await clickText('.gamecrafter-models-table button', 'Discover');
    const selection = 'select[aria-label="Models to add for First provider"]';
    await page.waitForSelector(selection);
    assert.equal(
      (await client.call('model/list', {})).models.length,
      0,
      'Discovery preview must not persist models',
    );
    await page.select(selection, 'two');
    await page.screenshot({ path: path.join(directory, 'model-selection.png') });
    await clickText('.gamecrafter-model-selection button', 'Add selected (1)');
    await wait(() => document.querySelector('input[aria-label^="Display name "]'));
    assert.deepEqual(
      (await client.call('model/list', {})).models.map((model) => model.providerModelId),
      ['two'],
    );
    await clickText('.gamecrafter-model-selection button', 'Add all (2)');
    await wait(() => document.querySelectorAll('input[aria-label^="Display name "]').length === 3);
    const second = await client.call('provider/addAccount', {
      providerKind: 'openai-compatible',
      displayName: 'Second provider',
      baseUrl,
      isLocal: true,
    });
    await clickText('.gamecrafter-models-header button', 'Refresh');
    await wait(() =>
      document.querySelector('.gamecrafter-models')?.textContent.includes('Second provider'),
    );
    for (const button of await page.$$('.gamecrafter-models-table button')) {
      if (
        await button.evaluate(
          (node) =>
            node.textContent.trim() === 'Discover' &&
            node.closest('tr').textContent.includes('Second provider'),
        )
      ) {
        await button.click();
        break;
      }
    }
    const secondSelection = 'select[aria-label="Models to add for Second provider"]';
    await page.waitForSelector(secondSelection);
    await page.select(secondSelection, 'one', 'three');
    await clickText('.gamecrafter-model-selection button', 'Add selected (2)');
    await wait(() => document.querySelectorAll('input[aria-label^="Display name "]').length === 5);
    assert.deepEqual(
      (await client.call('model/list', { accountId: second.accountId })).models
        .map((model) => model.providerModelId)
        .sort(),
      ['one', 'three'],
    );
    assert.equal(
      (await client.call('model/list', { accountId: first.accountId })).models.length,
      3,
    );
    checks.push(
      'Provider form updates immediately; discovery previews, selected/add-all actions persist only requested account models',
    );
    const modelId = `${first.accountId}/two`;
    const displayName = `input[aria-label="Display name ${modelId}"]`;
    await page.locator(displayName).fill('  Renamed model  ');
    await page.click('input[aria-label="Pool name"]');
    await wait(
      (id) =>
        document.querySelector(`input[aria-label="Display name ${id}"]`)?.value === 'Renamed model',
      modelId,
    );
    const tags = `input[aria-label="tags ${modelId}"]`;
    await page.locator(tags).fill('local, local, fast');
    await page.click('input[aria-label="Pool name"]');
    await wait(
      (id) => document.querySelector(`input[aria-label="tags ${id}"]`)?.value === 'local, fast',
      modelId,
    );
    const stored = (await client.call('model/list', { accountId: first.accountId })).models.find(
      (model) => model.modelId === modelId,
    );
    assert.equal(stored.displayName, 'Renamed model');
    assert.deepEqual(stored.tags, ['local', 'fast']);
    await page.type('input[aria-label="Pool name"]', 'Typed pool name');
    assert.equal(
      await page.$eval('input[aria-label="Pool name"]', (node) => node.value),
      'Typed pool name',
    );
    await close('Models & Routing');
    await open('Models', 'models');
    await wait(
      (id) =>
        document.querySelector(`input[aria-label="Display name ${id}"]`)?.value === 'Renamed model',
      modelId,
    );
    assert.equal(await page.$eval(tags, (node) => node.value), 'local, fast');
    checks.push(
      'Edited model names and tags reflect saved canonical values immediately and after reopening; pool typing updates without refresh',
    );
    await wait(() => {
      const text = document.querySelector('.gamecrafter-models')?.textContent ?? '';
      return text.includes('1,000,000 shared') && text.includes('128,000') && text.includes('Unknown — provider-managed');
    });
    checks.push('Models displays reported context/output capacities and labels unknown capacity');
    await close('Models & Routing');
    const projectsDirectory = path.join(directory, 'projects');
    fs.mkdirSync(projectsDirectory, { recursive: true });
    const project = await client.call('project/create', {
      name: 'Capacity Smoke', engine: { family: 'godot' }, parentDirectory: projectsDirectory, folderName: 'capacity-smoke',
    });
    await open('Swarm', 'swarm');
    await wait((id) => [...document.querySelectorAll('select[aria-label="Swarm Project"] option')].some((option) => option.value === id), project.projectId);
    await page.select('select[aria-label="Swarm Project"]', project.projectId);
    await page.waitForSelector('input[aria-label="Token budget"]');
    assert.equal(await page.$eval('input[aria-label="Token budget"]', (node) => node.value), '');
    checks.push('Swarm starts with no implicit cumulative token budget');
    await close('Swarm');
    await open('Models', 'models');
    await page.screenshot({ path: path.join(directory, 'models.png') });
    assert.deepEqual(errors, []);
    const report = {
      checks,
      rendererErrors: errors,
      artifactDirectory: directory,
      provider: 'fake local HTTP server',
      target: 'built browser app with real platform service',
    };
    fs.writeFileSync(path.join(directory, 'report.json'), JSON.stringify(report, null, 2));
    console.log(JSON.stringify(report, null, 2));
  } catch (error) {
    if (page) {
      await page.screenshot({ path: path.join(directory, 'failure.png') }).catch(() => undefined);
      fs.writeFileSync(path.join(directory, 'failure.html'), await page.content().catch(() => ''));
    }
    fs.writeFileSync(
      path.join(directory, 'failure.json'),
      JSON.stringify({ checks, errors, error: String(error) }, null, 2),
    );
    throw error;
  } finally {
    if (browser) await browser.close();
    backend.kill();
    fs.closeSync(backendLog);
    client.close();
    await service.stop();
    await new Promise((resolve) => provider.close(resolve));
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

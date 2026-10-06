// Exercise rendered sections against a real disposable service. No paid or external actions.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { spawn } = require('node:child_process');
const { createServer } = require('node:http');
const { setTimeout: delay } = require('node:timers/promises');
const { PlatformService } = require('../packages/platform-service/lib/service');
const { resolvePaths } = require('../packages/platform-service/lib/paths');
const { connect } = require('@gamecrafter/service-client');

async function main() {
  const { default: puppeteer } = await import('puppeteer');
  const desktop = process.argv.includes('--electron');
  const directory = path.resolve(desktop ? '.artifacts/adversarial-electron' : '.artifacts/adversarial-ui', String(Date.now()));
  fs.mkdirSync(directory, { recursive: true });
  const version = require('../packages/platform-service/package.json').version;
  const paths = resolvePaths({ ...process.env, GAMECRAFTER_PROFILE_DIR: path.join(directory, 'profile') });
  let service, client, backend, browser, page, log, modelFixture;
  const checks = [], findings = [], rendererErrors = [];
  const report = () => ({ version, target: desktop ? 'development Electron' : 'development browser', checks, findings, rendererErrors, directory, evidence: 'Built development UI; real isolated service and two disposable Projects. No external provider, engine, installer or production acceptance.' });
  try {
    service = await PlatformService.start({ paths, platformVersion: version });
    client = await connect({ socketPath: service.socketPath, token: fs.readFileSync(paths.tokenPath, 'utf8').trim(), clientName: 'adversarial-ui-audit', clientVersion: version });
    const projects = [];
    for (const name of ['Adversarial workshop', 'A deliberately long Project name for layout and selection testing']) {
      projects.push(await client.call('project/create', { parentDirectory: path.join(directory, 'projects'), name, engine: { family: 'godot' } }));
    }
    modelFixture = createServer(async (request, response) => {
      for await (const chunk of request) void chunk;
      response.writeHead(200, { 'content-type': 'application/json' });
      response.end(JSON.stringify(request.method === 'GET'
        ? { data: [{ id: 'gpt-4.1', object: 'model' }] }
        : { id: 'native-theia-fixture', model: 'gpt-4.1', choices: [{ message: { role: 'assistant', content: 'Native Theia adapter fixture response.' }, finish_reason: 'stop' }], usage: { prompt_tokens: 1, completion_tokens: 2 } }));
    });
    await new Promise(resolve => modelFixture.listen(0, '127.0.0.1', resolve));
    const account = await client.call('provider/addAccount', { providerKind: 'openai-compatible', displayName: 'Synthetic Theia adapter fixture', baseUrl: `http://127.0.0.1:${modelFixture.address().port}/v1`, isLocal: true, apiKey: 'synthetic-local-fixture-key' });
    const discovered = await client.call('model/discover', { accountId: account.accountId, providerModelIds: ['gpt-4.1'] });
    const model = discovered.models.find(item => item.providerModelId === 'gpt-4.1'); assert(model);
    await client.call('model/update', { modelId: model.modelId, patch: { enabled: true, capabilities: { chat: true, tools: true } } });
    await client.call('pool/create', { name: 'Native Theia fixture pool', scope: 'project', projectId: projects[0].projectId, target: null, modelIds: [model.modelId] });
    const port = Number(process.env.GAMECRAFTER_ADVERSARIAL_PORT ?? (desktop ? 3038 : 3036));
    assert(Number.isInteger(port) && port > 0 && port <= 65535);
    const target = `http://127.0.0.1:${port}`;
    const cdpPort = Number(process.env.GAMECRAFTER_ADVERSARIAL_CDP_PORT ?? 3037);
    const env = { ...process.env, GAMECRAFTER_PROFILE_DIR: paths.profileDir, THEIA_CONFIG_DIR: path.join(directory, 'theia') };
    if (desktop) delete env.ELECTRON_RUN_AS_NODE;
    log = fs.openSync(path.join(directory, 'backend.log'), 'a');
    backend = spawn(desktop ? require('electron') : process.execPath, [desktop ? path.resolve('apps/control-room') : path.resolve('apps/control-room-browser/lib/backend/main.js'), '--port', String(port), '--hostname', '127.0.0.1', ...(desktop ? [`--user-data-dir=${path.join(directory, 'desktop')}`, `--remote-debugging-port=${cdpPort}`, '--disable-background-timer-throttling', '--disable-renderer-backgrounding', '--disable-backgrounding-occluded-windows'] : [])], { cwd: path.resolve(desktop ? 'apps/control-room' : 'apps/control-room-browser'), env, windowsHide: true, stdio: ['ignore', log, log] });
    let ready = false;
    for (let attempt = 0; attempt < 300; attempt++) {
      try { ready = (await fetch(desktop ? `http://127.0.0.1:${cdpPort}/json/version` : target)).ok; } catch { /* Wait only for owned backend. */ }
      if (ready) break;
      await delay(100);
    }
    assert(ready, 'Disposable backend starts');
    browser = desktop ? await puppeteer.connect({ browserURL: `http://127.0.0.1:${cdpPort}`, defaultViewport: null }) : await puppeteer.launch({ headless: true });
    page = desktop ? await (await browser.waitForTarget(item => item.type() === 'page' && item.url().includes('/lib/frontend/index.html'), { timeout: 60000 })).page() : await browser.newPage();
    assert(page, 'Renderer available');
    if (desktop) {
      // Electron exposes its window API through Theia's preload; Chromium's
      // Browser window-management CDP domain is unavailable in this target.
      await page.evaluate(() => window.electronTheiaCore?.maximize?.());
    }
    page.on('pageerror', error => rendererErrors.push(error.message));
    await page.setViewport({ width: 1920, height: 1080 });
    await page.goto(`${desktop ? page.url().split('#')[0] : target + '/'}#${encodeURI('/' + projects[0].path.replace(/\\/g, '/'))}`, { waitUntil: 'networkidle2' });
    await page.waitForSelector('.theia-preload', { hidden: true, timeout: 60000 });
    const trust = await page.$('.workspace-trust-dialog');
    if (trust) {
      const folders = await page.$$eval('.workspace-trust-folder-list li', nodes => nodes.map(node => node.textContent.trim()));
      assert(folders.length && folders.every(folder => projects.some(project => path.resolve(project.path) === path.resolve(folder))), 'Trust only generated Projects');
      for (const button of await trust.$$('button')) if (await button.evaluate(node => /trust/i.test(node.textContent) && !/don.t|do not/i.test(node.textContent))) await button.click();
    }
    await page.waitForSelector('.gamecrafter-home-navigation', { visible: true, timeout: 60000 });
    const native = await page.evaluate(async projectId => {
      const container = window.theia.container;
      const keys = [...container._bindingDictionary._map.keys()];
      const modelKey = keys.find(key => typeof key === 'symbol' && key.description === 'LanguageModelRegistry');
      const toolKey = keys.find(key => typeof key === 'symbol' && key.description === 'ToolInvocationRegistry');
      if (!modelKey || !toolKey) throw new Error('Native Theia AI registries are not bound.');
      const registry = container.get(modelKey), tools = container.get(toolKey).getAllFunctions().map(tool => tool.name);
      const adapter = await registry.getLanguageModel('playweld/router');
      if (!adapter) throw new Error('PlayWeld model adapter is not contributed to Theia.');
      const result = await adapter.request({ sessionId: 'native-acceptance', requestId: 'native-theia-acceptance', messages: [{ actor: 'user', type: 'text', text: 'Return the fixture response.' }], settings: { 'playweld.projectId': projectId } });
      let text = ''; for await (const part of result.stream) if (part.content) text += part.content;
      return { model: adapter.id, text, tools };
    }, projects[0].projectId);
    assert(native.text.includes('Native Theia adapter fixture response.'));
    assert(native.tools.includes('playweld_tools') && native.tools.includes('playweld_tool'));
    checks.push({ surface: 'native-theia-ai', passed: true, result: native });
    async function clickText(selector, text) {
      for (const button of await page.$$(selector)) {
        if (await button.evaluate((node, label) => node.getClientRects().length && (node.textContent.trim() === label || node.querySelector('strong')?.textContent.trim() === label), text)) {
          await button.scrollIntoView(); await button.asLocator().click(); return;
        }
      }
      throw new Error(`Missing visible action ${text}`);
    }
    async function inspect(surface, section) {
      const root = `.gamecrafter-${surface}`;
      const sizes = process.argv.includes('--stress') ? [[1920, 1080], [1440, 1000], [1024, 900], [650, 900]] : [[1920, 1080], [1440, 1000], [1024, 900]];
      for (const [width, height] of sizes) {
        await page.setViewport({ width, height });
        const diagnostics = await page.$eval(root, node => {
          const visible = item => item.getClientRects().length && getComputedStyle(item).visibility !== 'hidden';
          const fields = [...node.querySelectorAll('input,select,textarea')].filter(visible);
          const unnamed = fields.filter(field => !field.labels?.length && !field.getAttribute('aria-label') && !field.getAttribute('aria-labelledby')).map(field => field.outerHTML);
          const duplicateIds = [...node.querySelectorAll('[id]')].map(item => item.id).filter((id, index, all) => all.indexOf(id) !== index);
          const missingTargets = [...node.querySelectorAll('[aria-controls]')].filter(visible).filter(item => !document.getElementById(item.getAttribute('aria-controls'))).map(item => item.getAttribute('aria-controls'));
          const overflowing = [...node.querySelectorAll('*')].filter(visible).filter(item => item.getBoundingClientRect().right > node.getBoundingClientRect().right + 2).slice(0, 12).map(item => ({ tag: item.tagName, class: item.className, width: Math.round(item.getBoundingClientRect().width) }));
          return { rootWidth: node.clientWidth, overflow: node.scrollWidth - node.clientWidth, overflowing, unnamed, duplicateIds, missingTargets };
        });
        const problems = [];
        if (diagnostics.overflow > 2) problems.push(`Surface overflow ${diagnostics.overflow}px`);
        for (const key of ['unnamed', 'duplicateIds', 'missingTargets']) if (diagnostics[key].length) problems.push(`${key}: ${JSON.stringify(diagnostics[key])}`);
        if (problems.length) findings.push({ surface, section, width, problems, diagnostics });
        checks.push({ surface, section, width, rootWidth: diagnostics.rootWidth, passed: !problems.length });
        await page.screenshot({ path: path.join(directory, `${surface}-${section}-${width}.png`) });
      }
      await page.setViewport({ width: 1920, height: 1080 });
    }
    await inspect('project-home', 'home');
    for (const [label, surface] of [['Engine','engine'], ['DCC Tools','dcc'], ['Assets','assets'], ['Backups','backups'], ['Audit & History','audit'], ['Models','models'], ['Chat','chat'], ['Skills & Roles','skills'], ['Connections','connections'], ['Discussion Board','board'], ['Swarm','swarm'], ['Knowledge','knowledge'], ['Plugins','plugins'], ['Settings','settings'], ['Updates','updates']]) {
      try {
        await clickText('.lm-TabBar-tabLabel', 'Project Home');
        await clickText('.gamecrafter-home-navigation button', label);
        const root = `.gamecrafter-${surface}`;
        await page.waitForSelector(root, { visible: true, timeout: 30000 });
        await inspect(surface, 'initial');
        // Navigation groups select independently; inspect child groups within each section.
        const primary = `${root} > .gamecrafter-section-nav`;
        const count = await page.$$eval(`${primary} button`, nodes => nodes.length);
        for (let index = 0; index < count; index++) {
          const button = (await page.$$(`${primary} button`))[index];
          if (await button.evaluate(node => node.disabled)) continue;
          await button.scrollIntoView(); await button.asLocator().click();
          await inspect(surface, `section-${index}`);
          const nested = await page.$$(`${root} .gamecrafter-section-nav`);
          for (let navIndex = 1; navIndex < nested.length; navIndex++) {
            const nav = nested[navIndex];
            if (!await nav.evaluate(node => node.getClientRects().length)) continue;
            for (const child of await nav.$$('button')) {
              if (await child.evaluate(node => node.disabled)) continue;
              await child.scrollIntoView(); await child.asLocator().click();
              await inspect(surface, `section-${index}-nested-${await child.evaluate(node => node.textContent.trim().replace(/[^a-z0-9]/gi, '-'))}`);
            }
          }
        }
      } catch (error) {
        findings.push({ surface, error: String(error) });
        await page.screenshot({ path: path.join(directory, `${surface}-failure.png`) }).catch(() => undefined);
      }
      console.log(`${label}: inspected`);
    }
    assert.deepEqual(rendererErrors, [], 'No renderer exceptions');
  } catch (error) {
    findings.push({ fatal: String(error) });
  } finally {
    fs.writeFileSync(path.join(directory, 'report.json'), JSON.stringify(report(), null, 2) + '\n');
    console.log(JSON.stringify({ directory, checks: checks.length, findings, rendererErrors }, null, 2));
    if (browser) await browser.close();
    if (backend) backend.kill();
    if (log !== undefined) fs.closeSync(log);
    if (client) client.close();
    if (service) await service.stop();
    if (modelFixture) await new Promise(resolve => modelFixture.close(resolve));
  }
  if (findings.length || rendererErrors.length) process.exitCode = 1;
}
main().catch(error => { console.error(error); process.exitCode = 1; });

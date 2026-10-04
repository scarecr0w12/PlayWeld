// Capture actual Control Room screens using an isolated, disposable Project/profile.
// The only model endpoint is a local deterministic fixture, explicitly labeled in the UI.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { createServer } = require('node:http');
const { spawn } = require('node:child_process');
const { setTimeout: delay } = require('node:timers/promises');
const { selectScenarios, scenarioNames } = require('./documentation/scenario-options.cjs');
const { runScenarios } = require('./documentation/workflow-scenarios.cjs');
const { createHash } = require('node:crypto');
const { execFileSync } = require('node:child_process');
const { fixtureCompletion } = require('./documentation/fixture-completion.cjs');

async function main() {
  if (process.argv.includes('--help')) {
    console.log(
      `Usage: node scripts/capture-documentation.cjs [--scenario ${scenarioNames.join(',')}|all]\nCreates an isolated tutorial Project and captures the built browser UI.\nGAMECRAFTER_DOC_PORT: loopback port (default 3027)\nGAMECRAFTER_DOC_OUTPUT: image/report destination (default ignored run directory)`,
    );
    return;
  }
  const selectedScenarios = selectScenarios(process.argv.slice(2));
  const { default: puppeteer } = await import('puppeteer');
  const { PlatformService } = require('../packages/platform-service/lib/service');
  const { resolvePaths } = require('../packages/platform-service/lib/paths');
  const { connect } = require('@gamecrafter/service-client');
  const version = require('../packages/platform-service/package.json').version;
  const run = path.resolve('.artifacts', 'documentation', String(Date.now()));
  const output = path.resolve(process.env.GAMECRAFTER_DOC_OUTPUT ?? path.join(run, 'screenshots'));
  fs.mkdirSync(output, { recursive: true });
  fs.mkdirSync(run, { recursive: true });
  const paths = resolvePaths({
    ...process.env,
    GAMECRAFTER_PROFILE_DIR: path.join(run, 'profile'),
  });
  let service, client, browser, backend, page, provider, log;
  const checks = [],
    screenshots = [],
    errors = [];
  const port = Number(process.env.GAMECRAFTER_DOC_PORT ?? 3027);
  assert(Number.isInteger(port) && port > 0 && port <= 65535, 'Documentation port must be 1-65535');
  const wait = (predicate, ...args) =>
    page.waitForFunction(predicate, { timeout: 60000, polling: 100 }, ...args);
  async function click(selector, label) {
    await wait(
      (query, text) =>
        [...document.querySelectorAll(query)].some(
          (node) =>
            node.textContent.trim().includes(text) &&
            !node.disabled &&
            node.getClientRects().length > 0 &&
            getComputedStyle(node).visibility !== 'hidden',
        ),
      selector,
      label,
    );
    for (const element of await page.$$(selector)) {
      if (
        await element.evaluate(
          (node, text) =>
            node.textContent.trim().includes(text) &&
            !node.disabled &&
            node.getClientRects().length > 0 &&
            getComputedStyle(node).visibility !== 'hidden',
          label,
        )
      ) {
        await element.asLocator().click();
        return;
      }
    }
    throw new Error(`Missing ${label} in ${selector}`);
  }
  async function selectSection(navigation, label) {
    await wait(
      (name, text) => {
        const visible = (node) =>
          node.getClientRects().length > 0 && getComputedStyle(node).visibility !== 'hidden';
        const matches = (button) => {
          const actual = button.textContent.trim();
          return actual === text || (actual.startsWith(text) && /^\s*\d+$/.test(actual.slice(text.length)));
        };
        const nav = [...document.querySelectorAll('nav[aria-label]')].find(
          (node) => node.getAttribute('aria-label') === name && visible(node),
        );
        return [...(nav?.querySelectorAll('button') ?? [])].some(
          (button) => matches(button) && visible(button),
        );
      },
      navigation,
      label,
    );
    const targetFound = await page.evaluate((name, text) => {
      for (const button of document.querySelectorAll('[data-documentation-section-target]'))
        button.removeAttribute('data-documentation-section-target');
      const visible = (node) =>
        node.getClientRects().length > 0 && getComputedStyle(node).visibility !== 'hidden';
      const matches = (node) => {
        const actual = node.textContent.trim();
        return actual === text || (actual.startsWith(text) && /^\s*\d+$/.test(actual.slice(text.length)));
      };
      const nav = [...document.querySelectorAll('nav[aria-label]')].find(
        (node) => node.getAttribute('aria-label') === name && visible(node),
      );
      const button = [...(nav?.querySelectorAll('button') ?? [])].find(
        (node) => matches(node) && visible(node),
      );
      if (!button) return false;
      button.scrollIntoView({ block: 'nearest' });
      button.setAttribute('data-documentation-section-target', 'true');
      return true;
    }, navigation, label);
    assert(targetFound, `Missing ${label} in ${navigation}`);
    await page.click('button[data-documentation-section-target="true"]');
    await wait(
      (name, text) => {
        const visible = (node) =>
          node.getClientRects().length > 0 && getComputedStyle(node).visibility !== 'hidden';
        const matches = (button) => {
          const actual = button.textContent.trim();
          return actual === text || (actual.startsWith(text) && /^\s*\d+$/.test(actual.slice(text.length)));
        };
        const nav = [...document.querySelectorAll('nav[aria-label]')].find(
          (node) => node.getAttribute('aria-label') === name && visible(node),
        );
        return [...(nav?.querySelectorAll('button') ?? [])].some(
          (button) =>
            matches(button) && button.getAttribute('aria-pressed') === 'true' && visible(button),
        );
      },
      navigation,
      label,
    );
  }
  async function ensureDisclosure(selector, label) {
    const expanded = await page.evaluate((query) => {
      const visible = (node) =>
        node.getClientRects().length > 0 && getComputedStyle(node).visibility !== 'hidden';
      const summary = [...document.querySelectorAll(query)].find(visible);
      return summary?.closest('details')?.open ?? false;
    }, selector);
    if (!expanded) await click(selector, label);
  }
  async function selectProject(selector, projectId) {
    await wait(
      (query, id) =>
        [...document.querySelectorAll(query)]
          .filter(
            (node) => node.getClientRects().length > 0 && getComputedStyle(node).visibility !== 'hidden',
          )
          .some((node) => [...node.options].some((option) => option.value === id)),
      selector,
      projectId,
    );
    const targetFound = await page.evaluate((query, id) => {
      for (const item of document.querySelectorAll('[data-documentation-project-target]'))
        item.removeAttribute('data-documentation-project-target');
      const node = [...document.querySelectorAll(query)].find(
        (item) =>
          item.getClientRects().length > 0 &&
          getComputedStyle(item).visibility !== 'hidden' &&
          [...item.options].some((option) => option.value === id),
      );
      if (!node) return false;
      node.setAttribute('data-documentation-project-target', 'true');
      return true;
    }, selector, projectId);
    assert(targetFound, `Project ${projectId} must be selectable in ${selector}`);
    const selected = await page.select(
      'select[data-documentation-project-target="true"]',
      projectId,
    );
    assert(selected.includes(projectId), `Project ${projectId} must be selected in ${selector}`);
    await wait(
      (query, id) =>
        [...document.querySelectorAll(query)].some(
          (node) =>
            node.value === id &&
            node.getClientRects().length > 0 &&
            getComputedStyle(node).visibility !== 'hidden',
        ),
      selector,
      projectId,
    );
  }
  async function capture(name, selector) {
    await wait((root) => {
      const node = [...document.querySelectorAll(root)].find(
        (item) => item.getClientRects().length > 0 && getComputedStyle(item).visibility !== 'hidden',
      );
      return node && node.innerText.length > 30 && !node.innerText.trim().startsWith('Loading');
    }, selector);
    for (const notification of await page.$$(
      '.theia-notification-toasts .theia-notification-actions [title="Clear"]',
    )) {
      if (await notification.evaluate((node) => node.getClientRects().length > 0))
        await notification.click();
    }
    // Capture the visible region; scrollable surfaces can extend beyond their dock viewport.
    const element = await page.evaluateHandle((query) =>
      [...document.querySelectorAll(query)].find(
        (node) => node.getClientRects().length > 0 && getComputedStyle(node).visibility !== 'hidden',
      ),
    selector);
    assert(element.asElement(), `${selector} must have a visible instance`);
    const clip = await element.evaluate((node) => {
      const rect = node.getBoundingClientRect();
      const x = Math.max(0, rect.x),
        y = Math.max(0, rect.y);
      return {
        x,
        y,
        width: Math.min(rect.right, window.innerWidth) - x,
        height: Math.min(rect.bottom, window.innerHeight) - y,
      };
    });
    assert(clip.width > 0 && clip.height > 0, `${name} must be visible`);
    await page.screenshot({ path: path.join(output, `${name}.png`), clip });
    screenshots.push(`${name}.png`);
  }
  async function open(label, suffix) {
    await click('.lm-TabBar-tabLabel', 'Project Home');
    await click('.gamecrafter-home-navigation button', label);
    await page.waitForSelector(`.gamecrafter-${suffix}`, { visible: true, timeout: 60000 });
  }
  try {
    // Refuse an occupied port before any UI mutations; never use another running app.
    const portProbe = createServer();
    await new Promise((resolve, reject) => {
      portProbe.once('error', reject);
      portProbe.listen(port, '127.0.0.1', resolve);
    });
    await new Promise((resolve) => portProbe.close(resolve));
    service = await PlatformService.start({ paths, platformVersion: version });
    client = await connect({
      socketPath: service.socketPath,
      token: fs.readFileSync(paths.tokenPath, 'utf8').trim(),
      clientName: 'documentation',
      clientVersion: version,
    });
    let fixtureChatRequests = 0;
    provider = createServer(async (request, response) => {
      const chunks = [];
      for await (const chunk of request) chunks.push(chunk);
      const body = chunks.length ? JSON.parse(Buffer.concat(chunks).toString('utf8')) : {};
      response.setHeader('content-type', 'application/json');
      if (request.url === '/v1/models') {
        response.end(
          JSON.stringify({
            data: [
              {
                id: 'documentation-fixture',
                capabilities: {
                  chat: true,
                  tools: true,
                  streaming: false,
                  contextWindow: 131072,
                  maxOutputTokens: 32768,
                },
              },
            ],
          }),
        );
      } else if (request.url === '/v1/chat/completions') {
        fixtureChatRequests++;
        response.end(
          JSON.stringify({
            choices: [
              {
                message: fixtureCompletion(body),
                finish_reason: 'stop',
              },
            ],
            usage: { prompt_tokens: 80, completion_tokens: 55 },
          }),
        );
      } else {
        response.statusCode = 404;
        response.end(JSON.stringify({ error: 'Unsupported documentation fixture operation' }));
      }
    });
    await new Promise((resolve) => provider.listen(0, '127.0.0.1', resolve));
    const account = await client.call('provider/addAccount', {
      providerKind: 'openai-compatible',
      displayName: 'Documentation fixture (local, no real model)',
      baseUrl: `http://127.0.0.1:${provider.address().port}/v1`,
      isLocal: true,
    });
    const discovered = await client.call('model/discover', { accountId: account.accountId });
    assert.equal(discovered.models.length, 1);
    assert(discovered.models[0].capabilities.chat && discovered.models[0].enabled);
    log = fs.openSync(path.join(run, 'backend.log'), 'a');
    backend = spawn(
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
          THEIA_CONFIG_DIR: path.join(run, 'theia'),
        },
        windowsHide: true,
        stdio: ['ignore', log, log],
      },
    );
    const target = `http://127.0.0.1:${port}`;
    let ready = false;
    for (let attempt = 0; attempt < 120; attempt++) {
      if (backend.exitCode !== null)
        throw new Error(`Documentation backend exited: ${backend.exitCode}`);
      try {
        if ((await fetch(target)).ok) {
          ready = true;
          break;
        }
      } catch {
        /* Starting. */
      }
      await delay(500);
    }
    assert(ready, 'Documentation backend must become ready');
    browser = await puppeteer.launch({ headless: true });
    page = await browser.newPage();
    await page.setViewport({ width: 1600, height: 1100 });
    page.on('pageerror', (error) => errors.push(error.message));
    await page.goto(target, { waitUntil: 'networkidle2' });
    await page.waitForSelector('.theia-preload', { hidden: true, timeout: 60000 });
    await wait(() =>
      document
        .querySelector('.gamecrafter-project-home')
        ?.textContent.includes('Connected to platform service'),
    );
    await capture('01-home', '.gamecrafter-project-home');
    await click('.gamecrafter-project-home button', 'Create Project');
    const values = [
      'Lantern Workshop',
      'Disposable documentation and testing Project',
      'Godot',
      'Adventure',
      path.join(run, 'projects'),
    ];
    for (let step = 1; step <= 5; step++) {
      await wait(
        (n) => document.querySelector('.quick-input-title')?.textContent.includes(`(${n}/6)`),
        step,
      );
      const input = await page.waitForSelector('.quick-input-widget input.input', {
        visible: true,
      });
      await input.asLocator().fill(values[step - 1]);
      if (step === 3) await page.screenshot({ path: path.join(output, '02-create-project.png') });
      await page.keyboard.press('Enter');
    }
    screenshots.push('02-create-project.png');
    await wait(() => document.querySelector('.quick-input-title')?.textContent.includes('(6/6)'));
    await page.keyboard.press('Enter');
    await wait(() =>
      document.querySelector('.gamecrafter-project-home')?.textContent.includes('Lantern Workshop'),
    );
    const project = (await client.call('project/list', {})).projects.find(
      (item) => item.name === 'Lantern Workshop',
    );
    assert(project);
    fs.cpSync(
      path.resolve('docs/examples/lantern-workshop/docs'),
      path.join(project.path, 'docs'),
      { recursive: true },
    );
    fs.cpSync(
      path.resolve('docs/examples/lantern-workshop/game'),
      path.join(project.path, 'game'),
      { recursive: true },
    );
    const capabilities = await client.call('engine/capabilities', {
      projectId: project.projectId,
      refresh: true,
    });
    assert.equal(
      capabilities.layers['project-file'].status,
      'ready',
      'Native Godot fixture identity must be detected',
    );
    checks.push(
      'Six-step UI wizard created a real Project; reusable documentation and native Godot fixture copied into it',
    );
    if (selectedScenarios.includes('overview')) {
      await open('Discussion Board', 'board');
      await selectProject('[aria-label="Board Project"]', project.projectId);
      await ensureDisclosure('.gamecrafter-board details summary', 'New thread');
      await page.locator('[aria-label="New thread title"]').fill('Lantern collection rule');
      await page.locator('[aria-label="New thread tags"]').fill('tutorial, gameplay');
      await page.type(
        '[aria-label="New thread message"]',
        'Proposal: collect each lantern once, increase the counter, and reset the scene with R. The fixture design is in docs/DESIGN.md.',
      );
      await click('.gamecrafter-board-form button', 'Create thread');
      await wait(() =>
        document
          .querySelector('.gamecrafter-board')
          ?.textContent.includes('Proposal: collect each lantern once'),
      );
      assert.equal(
        (await client.call('board/threads', { projectId: project.projectId })).threads.length,
        1,
      );
      checks.push('Discussion thread submitted in UI and verified through service RPC');
      await capture('06-discussion', '.gamecrafter-board');
      await click('.lm-TabBar-tabLabel', 'Project Home');
      await wait(() =>
        document
          .querySelector('.gamecrafter-project-home')
          ?.textContent.includes('project-file: ready'),
      );
      await capture('03-project', '.gamecrafter-project-home');
      await open('Chat', 'chat');
      await selectProject('[aria-label="Chat Project"]', project.projectId);
      await wait(() => document.querySelector('[aria-label="Chat model"]')?.options.length > 1);
      await page.type(
        '[aria-label="Message"]',
        'How should I document the lantern collection rule?',
      );
      await page.keyboard.press('Enter');
      await wait(
        () =>
          document
            .querySelector('.gamecrafter-chat-transcript')
            ?.textContent.includes('Documentation fixture response (no real model).') &&
          !document.querySelector('[aria-label="Message"]').disabled,
      );
      checks.push('UI chat request completed through router and local fixture provider');
      await capture('05-chat', '.gamecrafter-chat');
      await page.locator('.gamecrafter-chat-conversation-search input').fill('Lantern');
      await wait(
        () =>
          [...document.querySelectorAll('[aria-label="Chat conversations"] button')].some(
            (button) => button.textContent.toLowerCase().includes('lantern'),
          ) &&
          [...document.querySelectorAll('select[aria-label="Chat conversation"] option')].every(
            (option) => option.textContent.toLowerCase().includes('lantern') || option.value === '',
          ),
      );
      await capture('05-chat-search', '.gamecrafter-chat');
      await click('[aria-label="New chat"]', 'New');
      await wait(() => document.querySelector('[aria-label="Conversation starters"] button'));
      await click('[aria-label="Conversation starters"] button', 'Help me plan a gameplay change.');
      assert.equal(await page.$eval('[aria-label="Message"]', (node) => node.value), 'Help me plan a gameplay change.');
      assert.equal(fixtureChatRequests, 1, 'Choosing a starter must not send another model request');
      await page.setViewport({ width: 650, height: 1000 });
      await capture('05-chat-mobile-starter', '.gamecrafter-chat');
      await page.setViewport({ width: 1600, height: 1100 });
      checks.push('Chat search filters the conversation list and picker; a starter fills a draft only and the compact mobile view is captured');
      await open('Knowledge', 'knowledge');
      await selectProject('[aria-label="Knowledge Project"]', project.projectId);
      await selectSection('Knowledge sections', 'Index status');
      await click('.gamecrafter-knowledge-actions button', 'Reconcile');
      for (let attempt = 0; attempt < 60; attempt++) {
        const status = await client.call('knowledge/index/status', {
          projectId: project.projectId,
        });
        if (status.chunks > 0 && status.pending === 0) break;
        if (attempt === 59) throw new Error('Knowledge reconcile did not complete');
        await delay(500);
      }
      await selectSection('Knowledge sections', 'Search');
      await ensureDisclosure(
        '.gamecrafter-knowledge-query-form details summary, .gamecrafter-knowledge details summary',
        'Search mode and filters',
      );
      await page.select('[aria-label="Knowledge search mode"]', 'lexical');
      await page.select('[aria-label="Knowledge search source"]', 'docs');
      await page.locator('[aria-label="Knowledge search query"]').fill('lantern');
      await click(
        '.gamecrafter-knowledge-query-form button, .gamecrafter-knowledge form button',
        'Search',
      );
      await wait(
        () =>
          document
            .querySelector('.gamecrafter-knowledge')
            ?.textContent.includes('Search results') &&
          document.querySelector('.gamecrafter-knowledge')?.textContent.includes('DESIGN.md'),
      );
      const search = await client.call('knowledge/search', {
        projectId: project.projectId,
        query: 'lantern',
        mode: 'lexical',
        sources: ['docs'],
        limit: 5,
      });
      assert(
        search.hits.some((hit) => hit.path === 'docs/DESIGN.md' && hit.quote.text && hit.citation),
      );
      checks.push('Knowledge reconciliation and text search returned the fixture design document');
      await capture('07-knowledge', '.gamecrafter-knowledge');
      const surfaces = [
        ['Models', 'models', '04-models'],
        ['Settings', 'settings', '08-settings'],
        ['Skills & Roles', 'skills', '09-skills'],
        ['Swarm', 'swarm', '10-swarm'],
        ['Connections', 'connections', '11-connections'],
        ['Engine', 'engine', '12-engine'],
        ['DCC Tools', 'dcc', '13-dcc'],
        ['Assets', 'assets', '14-assets'],
        ['Plugins', 'plugins', '15-plugins'],
        ['Backups', 'backups', '16-backups'],
        ['Updates', 'updates', '17-updates'],
        ['Audit & History', 'audit', '18-audit'],
      ];
      for (const [label, suffix, name] of surfaces) {
        await open(label, suffix);
        const sectionBySurface = {
          models: ['Model configuration sections', 'Provider accounts'],
          skills: ['Skills workspace sections', 'Project skills'],
          swarm: ['Swarm views', 'Agents'],
          connections: ['Connection views', 'Add connection'],
          engine: ['Engine views', 'Capabilities'],
          dcc: ['DCC views', 'Capabilities'],
          assets: ['Asset workspace sections', 'Generate'],
          plugins: ['Platform plugin sections', 'Install'],
          backups: ['Backup sections', 'Identities'],
          updates: ['Update sections', 'Status'],
          audit: ['Audit sections', 'Tool calls'],
      }[suffix];
        const projectControlBySurface = {
          skills: 'Skills Project',
          swarm: 'Swarm Project',
          connections: 'Connections Project',
          engine: 'Engine Project',
          dcc: 'DCC Project',
          assets: 'Assets Project',
          audit: 'Audit Project',
        }[suffix];
        if (projectControlBySurface) {
          await selectProject(`[aria-label="${projectControlBySurface}"]`, project.projectId);
        }
        if (sectionBySurface) await selectSection(...sectionBySurface);
        if (suffix === 'settings') {
          await page.locator('.gamecrafter-settings-search input').fill('access.mode');
          await page.waitForSelector('select[aria-label="Access mode"]');
          await page.select('select[aria-label="Access mode"]', 'restricted');
          await wait(() =>
            document
              .querySelector('.gamecrafter-setting-source')
              ?.textContent.includes('Effective from Platform'),
          );
          await capture('08-settings-override', '.gamecrafter-settings');
          await click('.gamecrafter-setting-row button', 'Reset');
          await wait(
            () =>
              document.querySelector('select[aria-label="Access mode"]')?.value === 'ask-always',
          );
          checks.push('Settings platform override saved, inspected, and reset in UI');
        }
        if (suffix === 'skills') {
          const skillCard = await page.evaluateHandle(() =>
            [...document.querySelectorAll('.gamecrafter-skill-card')].find((node) =>
              node.textContent.toLowerCase().includes('asset-pipeline'),
            ),
          );
          const readGuide = await skillCard.asElement()?.$('button');
          assert(readGuide, 'Asset pipeline skill card must be visible');
          for (const button of await skillCard.asElement().$$('button')) {
            if ((await button.evaluate((node) => node.textContent.trim())) === 'Read guide')
              await button.asLocator().click();
          }
          await wait(() =>
            document
              .querySelector('.gamecrafter-skill-reader-content')
              ?.textContent.includes('Asset pipeline'),
          );
          checks.push('Bundled asset-pipeline guide opened in UI');
        }
        if (suffix === 'swarm') {
          await ensureDisclosure('.gamecrafter-swarm-request-composer summary', 'New request');
          await page.type(
            '[aria-label="Change request"]',
            'Preview the impact of documenting the lantern reset rule in docs/DESIGN.md.',
          );
          await click('.gamecrafter-swarm button', 'Preview impact');
          await page.waitForSelector('[aria-label="Impact preview"]', { visible: true });
          checks.push('Swarm impact preview inspected without submitting agent work');
        }
        await capture(name, `.gamecrafter-${suffix}`);
        checks.push(`${label} rendered against isolated service`);
      }
    }
    await runScenarios({
      selectedScenarios,
      client,
      page,
      project,
      run,
      checks,
      open,
      click,
      selectSection,
      ensureDisclosure,
      selectProject,
      capture,
      wait,
    });
    assert.deepEqual(errors, [], 'Renderer must not raise uncaught errors');
    const report = {
      capturedAt: new Date().toISOString(),
      platformVersion: version,
      source: {
        commit: execFileSync('git', ['rev-parse', 'HEAD'], {
          encoding: 'utf8',
          windowsHide: true,
        }).trim(),
        workingTree: execFileSync('git', ['status', '--porcelain'], {
          encoding: 'utf8',
          windowsHide: true,
        }).trim()
          ? 'pending changes'
          : 'clean',
        captureScriptSha256: createHash('sha256').update(fs.readFileSync(__filename)).digest('hex'),
        scenarioModulesSha256: createHash('sha256')
          .update(
            fs
              .readdirSync(path.join(__dirname, 'documentation'))
              .filter((name) => name.endsWith('.cjs'))
              .sort()
              .map(
                (name) =>
                  name +
                  '\n' +
                  fs.readFileSync(path.join(__dirname, 'documentation', name), 'utf8'),
              )
              .join('\n'),
          )
          .digest('hex'),
      },
      selectedScenarios,
      target: 'Built development browser Control Room, real platform service',
      provider:
        'Local deterministic HTTP fixture; no live model, paid provider, or engine execution',
      projectName: project.name,
      checks,
      screenshots,
      rendererErrors: errors,
    };
    fs.writeFileSync(
      path.join(output, 'capture-report.json'),
      JSON.stringify(report, null, 2) + '\n',
    );
    console.log(JSON.stringify({ run, output, ...report }, null, 2));
  } catch (error) {
    if (page) await page.screenshot({ path: path.join(run, 'failure.png') }).catch(() => {});
    if (page)
      fs.writeFileSync(
        path.join(run, 'failure-visible-text.txt'),
        await page.evaluate(() => document.body.innerText).catch(() => 'Unavailable'),
      );
    fs.writeFileSync(
      path.join(run, 'failure.json'),
      JSON.stringify({ checks, errors, error: String(error) }, null, 2),
    );
    throw error;
  } finally {
    if (browser) await browser.close();
    if (backend) {
      backend.kill();
      await Promise.race([new Promise((resolve) => backend.once('exit', resolve)), delay(5000)]);
    }
    if (log !== undefined) fs.closeSync(log);
    if (client) client.close();
    if (service) await service.stop();
    if (provider) await new Promise((resolve) => provider.close(resolve));
  }
}
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

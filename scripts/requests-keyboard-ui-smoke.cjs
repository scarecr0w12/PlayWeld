// Exercise the built browser and real service with disposable requests and keyboard events.
// Evidence stays outside the repository; no model/provider or engine is invoked.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { createRequire } = require('node:module');
const { spawn } = require('node:child_process');
const net = require('node:net');
const { tmpdir } = require('node:os');
const { setTimeout: delay } = require('node:timers/promises');
const repo = path.resolve(__dirname, '..');
const local = createRequire(path.join(repo, 'package.json'));
const { PlatformService } = local('./packages/platform-service/lib/service');
const { resolvePaths } = local('./packages/platform-service/lib/paths');
const { connect } = local('@gamecrafter/service-client');
const { acquireLock } = local('./packages/platform-service/lib/lock');

async function main() {
  const artifactRoot = process.env.GAMECRAFTER_REQUESTS_SMOKE_ARTIFACT_DIR ?? tmpdir();
  fs.mkdirSync(artifactRoot, { recursive: true });
  const directory = fs.mkdtempSync(path.join(artifactRoot, 'requests-keyboard-'));
  const paths = resolvePaths({
    ...process.env,
    GAMECRAFTER_PROFILE_DIR: path.join(directory, 'profile'),
  });
  fs.mkdirSync(paths.profileDir, { recursive: true });
  let lock, service, client, portServer, backend, log, browser, page, primaryError;
  const errors = [],
    consoleErrors = [],
    httpErrors = [],
    observations = [],
    calls = [],
    owned = new Set();
  const until = async (fn, predicate) => {
    const end = Date.now() + 30000;
    while (Date.now() < end) {
      const value = await fn();
      if (predicate(value)) return value;
      await delay(100);
    }
    throw Error('Readiness condition not reached');
  };
  try {
    lock = acquireLock(paths);
    service = await PlatformService.start({
      paths,
      platformVersion: '0.22.0',
      approvalTimeoutOverrideMs: 300000,
    });
    const connection = () =>
      connect({
        socketPath: service.socketPath,
        token: fs.readFileSync(paths.tokenPath, 'utf8').trim(),
        clientName: 'requests-keyboard-probe',
        clientVersion: '0.22.0',
      });
    client = await connection();
    portServer = net.createServer();
    await new Promise((resolve, reject) => {
      portServer.once('error', reject);
      portServer.listen(0, '127.0.0.1', resolve);
    });
    const port = portServer.address().port;
    await new Promise((resolve) => portServer.close(resolve));
    const target = `http://127.0.0.1:${port}`;
    log = fs.openSync(path.join(directory, 'backend.log'), 'a');
    backend = spawn(
      process.execPath,
      [
        path.join(repo, 'apps/control-room-browser/lib/backend/main.js'),
        '--port',
        String(port),
        '--hostname',
        '127.0.0.1',
      ],
      {
        cwd: path.join(repo, 'apps/control-room-browser'),
        env: {
          ...process.env,
          GAMECRAFTER_PROFILE_DIR: paths.profileDir,
          THEIA_CONFIG_DIR: path.join(directory, 'theia'),
        },
        windowsHide: true,
        stdio: ['ignore', log, log],
      },
    );
    let backendError;
    backend.on('error', (error) => {
      backendError = error;
    });
    await client.call('settings/set', {
      key: 'board.maintenanceEnabled',
      scope: 'platform',
      value: false,
    });
    const a = await client.call('project/create', {
      name: 'Keyboard Lantern A',
      parentDirectory: path.join(directory, 'projects'),
      engine: { family: 'godot' },
    });
    const b = await client.call('project/create', {
      name: 'Keyboard Lantern B',
      parentDirectory: path.join(directory, 'projects'),
      engine: { family: 'godot' },
    });
    owned.add(a.projectId);
    owned.add(b.projectId);
    const question = (project, title, options) =>
      client.call('task/create', {
        projectId: project.projectId,
        kind: 'noop.ask',
        title,
        goal: title,
        input: { prompt: `Answer ${title}`, ...(options ? { options } : {}) },
      });
    const free = (await question(a, 'Forest description')).task;
    const choice = (await question(a, 'Choose palette', ['Warm', 'Cool'])).task;
    function tool(project, file) {
      const call = client
        .call('tool/call', {
          projectId: project.projectId,
          toolId: 'fs/write-file',
          input: { path: `game/${file}`, content: 'keyboard fixture' },
          accessCeiling: 'ask-always',
        })
        .then(
          (result) => ({ result }),
          (error) => ({ error: String(error) }),
        );
      calls.push(call);
      return call;
    }
    const approved = tool(a, 'approved.txt'),
      rejected = tool(b, 'rejected.txt');
    await until(
      () => client.call('broker/pendingInputs', {}),
      (value) => value.inputs.length === 4,
    );
    await until(async () => {
      if (backendError) throw backendError;
      if (backend.exitCode !== null)
        throw Error(`Browser backend exited before readiness (${backend.exitCode})`);
      try {
        return (await fetch(target)).ok;
      } catch {
        return false;
      }
    }, Boolean);
    const puppeteer = local('puppeteer');
    let executablePath;
    try {
      const managedBrowser = await puppeteer.executablePath();
      if (fs.existsSync(managedBrowser)) executablePath = managedBrowser;
    } catch {
      /* A native Chrome installation may be used by local contributors. */
    }
    const nativeChrome = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
    if (!executablePath && process.platform === 'win32' && fs.existsSync(nativeChrome))
      executablePath = nativeChrome;
    browser = await puppeteer.launch({
      headless: true,
      executablePath,
      args: process.argv.includes('--no-sandbox') ? ['--no-sandbox'] : [],
    });
    page = await browser.newPage();
    page.on('pageerror', (error) => errors.push(error.message));
    page.on('console', (message) => {
      if (message.type() === 'error')
        consoleErrors.push({ text: message.text(), location: message.location() });
    });
    page.on('response', (response) => {
      if (response.status() >= 400)
        httpErrors.push({ url: response.url(), status: response.status() });
    });
    await page.setViewport({ width: 1600, height: 1000 });
    await page.goto(target, { waitUntil: 'networkidle2' });
    await page.waitForFunction(
      () =>
        document
          .querySelector('.gamecrafter-project-home')
          ?.textContent.includes('Connected to platform service'),
      { timeout: 60000 },
    );
    const active = () =>
      page.evaluate(() => {
        const n = document.activeElement;
        return {
          tag: n.tagName,
          text: n.textContent?.trim().slice(0, 120),
          label: n.getAttribute('aria-label'),
          within: !!n.closest('.gamecrafter-requests'),
        };
      });
    const tabTo = async (selector, text, project) => {
      for (let i = 0; i < 180; i++) {
        if (
          await page.evaluate(
            (sel, label, projectName) =>
              document.activeElement?.matches(sel) &&
              (!label || document.activeElement.textContent.includes(label)) &&
              (!projectName ||
                document.activeElement.closest('section')?.querySelector('h2')?.textContent ===
                  projectName),
            selector,
            text,
            project,
          )
        )
          return i;
        await page.keyboard.press('Tab');
      }
      throw Error(`Keyboard cannot reach ${selector} ${text ?? ''}`);
    };
    await tabTo('.gamecrafter-project-home button', 'Requests');
    await page.keyboard.press('Enter');
    await page.waitForSelector('.gamecrafter-requests', { visible: true });
    await page.waitForFunction(() =>
      document.querySelector('.gamecrafter-requests')?.textContent.includes('4 pending total'),
    );
    assert((await page.title()).includes('Requests'));
    assert.equal(await page.$('vite-error-overlay, #webpack-dev-server-client-overlay'), null);
    observations.push({
      step: 'keyboard-open',
      active: await active(),
      title: await page.title(),
      target,
    });
    await page.screenshot({ path: path.join(directory, 'opened.png') });
    await tabTo('.gamecrafter-request-select', 'Approval:', 'Keyboard Lantern A');
    await page.keyboard.press('Enter');
    const selectedApproval = await page.$eval(
      '[aria-label="Request details"]',
      (n) => n.textContent,
    );
    assert(selectedApproval.includes('Keyboard Lantern A'));
    await tabTo('button', 'Approve this request');
    await page.keyboard.press('Enter');
    assert((await approved).result?.status === 'completed');
    await page.waitForFunction(
      () =>
        !document
          .querySelector('[aria-label="Request details"]')
          ?.textContent.includes('Approve this request'),
    );
    observations.push({
      step: 'after-approval',
      active: await active(),
      emptyInspector: await page.$eval('[aria-label="Request details"]', (n) => n.textContent),
    });
    await page.keyboard.press('Enter');
    assert(!fs.existsSync(path.join(b.path, 'game/rejected.txt')));
    await page.screenshot({ path: path.join(directory, 'after-approval.png') });
    await tabTo('.gamecrafter-request-select', 'Approval:', 'Keyboard Lantern B');
    await page.keyboard.press('Space');
    assert(
      (await page.$eval('[aria-label="Request details"]', (n) => n.textContent)).includes(
        'Keyboard Lantern B',
      ),
    );
    await tabTo('button', 'Reject this request');
    await page.keyboard.press('Space');
    assert((await rejected).error);
    await page.waitForFunction(
      () =>
        !document
          .querySelector('[aria-label="Request details"]')
          ?.textContent.includes('Reject this request'),
    );
    observations.push({ step: 'after-rejection', active: await active() });
    const remote = tool(a, 'resolved-remotely.txt');
    await page.waitForFunction(() =>
      [...document.querySelectorAll('.gamecrafter-request-select')].some((n) =>
        n.textContent.includes('Approval:'),
      ),
    );
    await tabTo('.gamecrafter-request-select', 'Approval:', 'Keyboard Lantern A');
    await page.keyboard.press('Enter');
    await tabTo('button', 'Approve this request');
    const remoteItem = (await client.call('broker/pendingInputs', {})).inputs.find(
      (item) =>
        item.kind === 'approval' && item.approval.input.path === 'game/resolved-remotely.txt',
    );
    assert(remoteItem);
    await client.call('broker/approve', {
      projectId: a.projectId,
      approvalId: remoteItem.approval.approvalId,
      approve: false,
    });
    assert((await remote).error);
    await page.waitForFunction(
      () =>
        !document
          .querySelector('[aria-label="Request details"]')
          ?.textContent.includes('Approve this request'),
    );
    await page.keyboard.press('Enter');
    assert(!fs.existsSync(path.join(a.path, 'game/resolved-remotely.txt')));
    observations.push({ step: 'externally-resolved-request', active: await active() });
    await tabTo('.gamecrafter-request-select', 'Choose palette');
    await page.keyboard.press('Enter');
    await tabTo('select[aria-label="Answer to task question"]');
    await page.keyboard.press('ArrowDown');
    await page.keyboard.press('Enter');
    await tabTo('button', 'Send answer');
    await page.keyboard.press('Enter');
    await until(
      () => client.call('task/get', { projectId: a.projectId, taskId: choice.taskId }),
      (t) => t.state === 'succeeded',
    );
    observations.push({ step: 'after-choice', active: await active() });
    await tabTo('.gamecrafter-request-select', 'Forest description');
    await page.keyboard.press('Enter');
    await tabTo('textarea[aria-label="Answer to task question"]');
    await page.keyboard.type('A hand-painted forest');
    await question(b, 'New context');
    await page.waitForFunction(() =>
      document.querySelector('.gamecrafter-requests')?.textContent.includes('New context'),
    );
    observations.push({
      step: 'draft-after-background-refresh',
      active: await active(),
      draft: await page.$eval('textarea[aria-label="Answer to task question"]', (n) => n.value),
    });
    await tabTo('button', 'Send answer');
    await page.keyboard.press('Enter');
    await until(
      () => client.call('task/get', { projectId: a.projectId, taskId: free.taskId }),
      (t) => t.state === 'succeeded',
    );
    observations.push({ step: 'after-free-text', active: await active() });
    await tabTo('.gamecrafter-request-select', 'New context');
    await page.keyboard.press('Enter');
    await tabTo('textarea[aria-label="Answer to task question"]');
    await page.keyboard.type('Retained through recovery');
    const manifest = path.join(b.path, 'gamecrafter.project.json');
    fs.renameSync(manifest, `${manifest}.offline`);
    try {
      await tabTo('button', 'Refresh requests');
      await page.keyboard.press('Enter');
      await page.waitForFunction(() =>
        document
          .querySelector('.gamecrafter-requests')
          ?.textContent.includes('Unavailable Projects:'),
      );
      observations.push({
        step: 'unavailable-project',
        active: await active(),
        context: await page.$eval('.gamecrafter-requests', (n) =>
          n.textContent.includes('Keyboard Lantern B'),
        ),
      });
    } finally {
      fs.renameSync(`${manifest}.offline`, manifest);
    }
    await tabTo('button', 'Refresh requests');
    await page.keyboard.press('Enter');
    await page.waitForFunction(
      () =>
        document.querySelector('textarea[aria-label="Answer to task question"]')?.value ===
        'Retained through recovery',
    );
    observations.push({
      step: 'draft-after-unavailable-project',
      active: await active(),
      draft: await page.$eval('textarea[aria-label="Answer to task question"]', (n) => n.value),
    });
    await tabTo('textarea[aria-label="Answer to task question"]');
    client.close();
    await service.stop();
    await page.waitForFunction(() =>
      document
        .querySelector('.gamecrafter-requests [role="alert"]')
        ?.textContent.includes('disconnected'),
    );
    assert(
      await page.$eval('.gamecrafter-requests [role="alert"]', (n) =>
        n.textContent.includes('Reconnect or refresh'),
      ),
    );
    assert(
      await page.$eval(
        'textarea[aria-label="Answer to task question"]',
        (n) => n.disabled && n.value === 'Retained through recovery',
      ),
    );
    observations.push({ step: 'disconnected-with-draft', active: await active() });
    await page.keyboard.press('Enter');
    service = await PlatformService.start({
      paths,
      platformVersion: '0.22.0',
      approvalTimeoutOverrideMs: 300000,
    });
    client = await connection();
    await tabTo('button', 'Refresh requests');
    await page.keyboard.press('Enter');
    await page.waitForFunction(() => {
      const n = document.querySelector('textarea[aria-label="Answer to task question"]');
      return n && !n.disabled && n.value === 'Retained through recovery';
    });
    observations.push({
      step: 'reconnected-with-draft',
      active: await active(),
      draft: await page.$eval('textarea[aria-label="Answer to task question"]', (n) => n.value),
    });
    await page.setViewport({ width: 480, height: 900 });
    await page.screenshot({ path: path.join(directory, 'narrow-recovery.png') });
    const geometry = await page.$eval('.gamecrafter-requests', (n) => ({
      clientWidth: n.clientWidth,
      scrollWidth: n.scrollWidth,
    }));
    assert(geometry.scrollWidth <= geometry.clientWidth + 1);
    await tabTo('button', 'Send answer');
    await page.keyboard.press('Enter');
    await page.waitForFunction(() =>
      document.querySelector('.gamecrafter-requests')?.textContent.includes('0 pending total'),
    );
    observations.push({ step: 'empty-inbox', active: await active() });
    const answers = (await client.call('task/questions', { pendingOnly: false })).questions;
    assert.equal(answers.find((q) => q.taskId === choice.taskId)?.answer, 'Warm');
    assert.equal(answers.find((q) => q.taskId === free.taskId)?.answer, 'A hand-painted forest');
    assert.equal(
      answers.find((q) => q.prompt === 'Answer New context')?.answer,
      'Retained through recovery',
    );
    assert.deepEqual(errors, []);
    // This development shell may omit its optional favicon. Retain that diagnostic
    // in evidence while failing every other HTTP or console error.
    const favicon = new URL('/favicon.ico', target).href;
    const missingFavicon = httpErrors.some(
      (entry) => entry.url === favicon && entry.status === 404,
    );
    assert.deepEqual(
      httpErrors.filter((entry) => !(entry.url === favicon && entry.status === 404)),
      [],
    );
    assert.deepEqual(
      consoleErrors.filter((entry) => !(missingFavicon && entry.location.url === favicon)),
      [],
    );
    assert(
      observations.every((item) => item.active.within),
      'Keyboard focus must stay within Requests through opening and completion',
    );
    const report = {
      schemaVersion: 1,
      target,
      title: await page.title(),
      browser: await browser.version(),
      viewports: ['1600x1000', '480x900'],
      observations,
      rendererErrors: errors,
      consoleErrors,
      httpErrors,
      knownShellDiagnostics: missingFavicon
        ? ['Optional development-shell favicon returned HTTP 404.']
        : [],
      directory,
    };
    fs.writeFileSync(path.join(directory, 'report.json'), JSON.stringify(report, null, 2));
    console.log(JSON.stringify(report, null, 2));
  } catch (error) {
    primaryError = error;
    if (page) {
      await page.screenshot({ path: path.join(directory, 'failure.png') }).catch(() => {});
      fs.writeFileSync(path.join(directory, 'failure.html'), await page.content().catch(() => ''));
    }
    const failure = {
      directory,
      observations,
      errors,
      consoleErrors,
      httpErrors,
      error: String(error),
    };
    fs.writeFileSync(path.join(directory, 'failure.json'), JSON.stringify(failure, null, 2));
    console.log(JSON.stringify(failure, null, 2));
    throw error;
  } finally {
    try {
      for (const item of (await client.call('broker/pendingInputs', {})).inputs) {
        if (!owned.has(item.projectId)) continue;
        if (item.kind === 'approval')
          await client
            .call('broker/approve', {
              projectId: item.projectId,
              approvalId: item.approval.approvalId,
              approve: false,
            })
            .catch(() => {});
        else
          await client
            .call('task/cancel', { projectId: item.projectId, taskId: item.taskId })
            .catch(() => {});
      }
    } catch {
      /* A failed restart may leave the fixture connection unavailable. */
    }
    const cleanupErrors = [];
    const clean = async (action) => {
      try {
        await action();
      } catch (error) {
        cleanupErrors.push(String(error));
      }
    };
    await clean(async () => {
      try {
        await browser?.close();
      } catch (error) {
        browser?.process()?.kill();
        throw error;
      }
    });
    await clean(async () => {
      if (!backend?.pid || backend.exitCode !== null || backend.signalCode !== null) return;
      const stopped = new Promise((resolve) => backend.once('exit', resolve));
      let forcedStop = false;
      assert(backend.kill(), 'Owned browser backend must terminate');
      await Promise.race([
        stopped,
        delay(5000, undefined, { ref: false }).then(async () => {
          if (backend.exitCode !== null || backend.signalCode !== null) return;
          forcedStop = true;
          assert(backend.kill('SIGKILL'), 'Owned browser backend must force-stop');
          await stopped;
        }),
      ]);
      if (forcedStop) throw Error('Owned browser backend required a forced stop');
    });
    await clean(() => {
      if (log !== undefined) fs.closeSync(log);
    });
    await clean(() => client?.close());
    await Promise.allSettled(calls);
    await clean(() => service?.stop());
    await clean(() => lock?.release());
    await clean(async () => {
      if (portServer?.listening) await new Promise((resolve) => portServer.close(resolve));
    });
    const reportPath = path.join(directory, primaryError ? 'failure.json' : 'report.json');
    if (fs.existsSync(reportPath)) {
      const report = JSON.parse(fs.readFileSync(reportPath, 'utf8'));
      report.cleanupErrors = cleanupErrors;
      fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
    }
    if (cleanupErrors.length) {
      if (!primaryError) throw Error(`Fixture cleanup failed: ${cleanupErrors.join('; ')}`);
      console.error('Fixture cleanup errors:', cleanupErrors);
    }
  }
}
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

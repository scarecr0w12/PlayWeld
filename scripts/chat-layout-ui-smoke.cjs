// Interaction checks for a rebuilt desktop (--electron) or development browser app.
// Every Project, conversation, model and setting belongs to this test's isolated profile.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { createServer } = require('node:http');
const { spawn, spawnSync } = require('node:child_process');
const { setTimeout: delay } = require('node:timers/promises');
const { PlatformService } = require('../packages/platform-service/lib/service');
const { resolvePaths } = require('../packages/platform-service/lib/paths');
const { connect } = require('@gamecrafter/service-client');

async function main() {
  const { default: puppeteer } = await import('puppeteer');
  const desktop = process.argv.includes('--electron');
  const directory = path.resolve(
    '.artifacts',
    'chat-layout-ui',
    `${desktop ? 'electron' : 'browser'}-${Date.now()}`,
  );
  fs.mkdirSync(directory, { recursive: true });
  const paths = resolvePaths({
    ...process.env,
    GAMECRAFTER_PROFILE_DIR: path.join(directory, 'profile'),
  });
  const service = await PlatformService.start({ paths, platformVersion: '0.1.1' });
  const client = await connect({
    socketPath: service.socketPath,
    token: fs.readFileSync(paths.tokenPath, 'utf8').trim(),
    clientName: 'chat-layout-smoke',
    clientVersion: '0.1.1',
  });
  const pending = [];
  const provider = createServer((request, response) => {
    let body = '';
    request.on('data', (chunk) => {
      body += chunk.toString();
    });
    request.on('end', () => {
      if (request.url === '/v1/models') {
        response.writeHead(200, { 'content-type': 'application/json' });
        response.end(
          JSON.stringify({
            data: [
              { id: 'plain-chat' },
              ...['selected-chat', 'optional-chat'].map((id) => ({
                id,
                capabilities: { chat: true, streaming: true },
              })),
            ],
          }),
        );
      } else if (request.url === '/v1/chat/completions') {
        const input = JSON.parse(body);
        if (input.model === 'plain-chat') {
          assert.equal(
            input.stream,
            undefined,
            'Chat without streaming metadata uses a complete response',
          );
          response.writeHead(200, { 'content-type': 'application/json' });
          response.end(
            JSON.stringify({
              choices: [
                {
                  message: { content: 'Answer without streaming metadata.' },
                  finish_reason: 'stop',
                },
              ],
            }),
          );
          return;
        }
        response.writeHead(200, { 'content-type': 'text/event-stream' });
        response.write(
          `data: ${JSON.stringify({ choices: [{ delta: { content: 'Stream owned by origin. ' } }] })}\n\n`,
        );
        pending.push({
          input,
          finish() {
            response.write(
              `data: ${JSON.stringify({ choices: [{ delta: { content: 'Answer saved to origin.' } }] })}\n\n`,
            );
            response.write(
              `data: ${JSON.stringify({ choices: [{ finish_reason: 'stop', delta: {} }], usage: { prompt_tokens: 10, completion_tokens: 8 } })}\n\n`,
            );
            response.end('data: [DONE]\n\n');
          },
        });
      } else {
        response.writeHead(404);
        response.end();
      }
    });
  });
  await new Promise((resolve) => provider.listen(0, '127.0.0.1', resolve));
  let browser;
  let page;
  let appProcess;
  const log = fs.openSync(path.join(directory, 'app.log'), 'a');
  const checks = [];
  const measurements = [];
  const errors = [];
  const wait = (predicate, ...args) =>
    page.waitForFunction(predicate, { polling: 100, timeout: 30000 }, ...args);
  const clickText = async (selector, text) => {
    for (const node of await page.$$(selector)) {
      if (
        await node.evaluate((element, expected) => element.textContent.trim() === expected, text)
      ) {
        await node.asLocator().click();
        return;
      }
    }
    throw new Error(`Missing ${text} in ${selector}`);
  };
  const open = async (label, selector) => {
    await clickText('.lm-TabBar-tabLabel', 'Project Home');
    await clickText('.gamecrafter-project-home-actions button', label);
    await page.waitForSelector(selector, { visible: true, timeout: 30000 });
  };
  const reachable = async (selector) => {
    const element = await page.waitForSelector(selector, { visible: true });
    await element.scrollIntoView();
    await wait((node) => {
      const r = node.getBoundingClientRect();
      const hit = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2);
      return (
        r.left >= 0 &&
        r.right <= innerWidth + 1 &&
        r.top >= 0 &&
        r.bottom <= innerHeight + 1 &&
        (hit === node || node.contains(hit))
      );
    }, element);
    return element;
  };
  const waitStored = async (predicate) => {
    const deadline = Date.now() + 30000;
    while (Date.now() < deadline) {
      if (await predicate()) return;
      await delay(100);
    }
    throw new Error('Timed out waiting for persisted chat messages');
  };
  try {
    const a = await client.call('project/create', {
      name: 'Origin Project A',
      engine: { family: 'godot' },
      parentDirectory: path.join(directory, 'projects'),
      folderName: 'origin-a',
    });
    const b = await client.call('project/create', {
      name: 'Destination Project B',
      engine: { family: 'godot' },
      parentDirectory: path.join(directory, 'projects'),
      folderName: 'destination-b',
    });
    const alternate = await client.call('chat/create', {
      projectId: a.projectId,
      title: 'Other conversation in A',
    });
    const account = await client.call('provider/addAccount', {
      providerKind: 'openai-compatible',
      displayName: 'Isolated test provider',
      baseUrl: `http://127.0.0.1:${provider.address().port}/v1`,
      isLocal: true,
    });
    await client.call('model/discover', {
      accountId: account.accountId,
      providerModelIds: ['selected-chat'],
    });
    const env = {
      ...process.env,
      GAMECRAFTER_PROFILE_DIR: paths.profileDir,
      THEIA_CONFIG_DIR: path.join(directory, 'theia'),
    };
    delete env.ELECTRON_RUN_AS_NODE;
    const debugPort = Number(process.env.GAMECRAFTER_LAYOUT_CDP_PORT ?? 9227);
    const port = Number(process.env.GAMECRAFTER_LAYOUT_PORT ?? 3012);
    if (desktop) {
      const packagedExecutable = process.env.GAMECRAFTER_LAYOUT_EXECUTABLE;
      appProcess = spawn(
        packagedExecutable ?? require('electron'),
        [
          ...(packagedExecutable ? [] : [path.resolve('apps/control-room')]),
          `--remote-debugging-port=${debugPort}`,
          // Keep startup/layout work running when the automated window is occluded.
          '--disable-backgrounding-occluded-windows',
          '--disable-renderer-backgrounding',
          '--disable-background-timer-throttling',
          `--user-data-dir=${path.join(directory, 'electron')}`,
          '--electronUserData',
          path.join(directory, 'electron'),
        ],
        { env, windowsHide: true, stdio: ['ignore', log, log] },
      );
      const deadline = Date.now() + 30000;
      while (Date.now() < deadline) {
        try {
          browser = await puppeteer.connect({
            browserURL: `http://127.0.0.1:${debugPort}`,
            defaultViewport: null,
          });
          break;
        } catch {
          await delay(200);
        }
      }
      assert(browser, 'Built Electron app must expose a renderer; inspect app.log on failure');
      page = await (
        await browser.waitForTarget(
          (target) => target.type() === 'page' && target.url().includes('/lib/frontend/index.html'),
          { timeout: 30000 },
        )
      ).page();
      await page.bringToFront();
    } else {
      appProcess = spawn(
        process.execPath,
        [
          path.resolve('apps/control-room-browser/lib/backend/main.js'),
          '--port',
          String(port),
          '--hostname',
          '127.0.0.1',
        ],
        {
          env,
          cwd: path.resolve('apps/control-room-browser'),
          windowsHide: true,
          stdio: ['ignore', log, log],
        },
      );
      const deadline = Date.now() + 30000;
      let ready = false;
      while (Date.now() < deadline) {
        try {
          ready = (await fetch(`http://127.0.0.1:${port}`)).ok;
        } catch {}
        if (ready) break;
        await delay(100);
      }
      assert(ready, 'Browser backend must start');
      browser = await puppeteer.launch({ headless: true });
      page = await browser.newPage();
      await page.goto(`http://127.0.0.1:${port}`, { waitUntil: 'networkidle2' });
    }
    page.on('pageerror', (error) => errors.push(error.message));
    await page.waitForSelector('.gamecrafter-project-home', { visible: true, timeout: 90000 });
    await page.waitForSelector('.theia-preload', { hidden: true, timeout: 90000 });
    await wait(() =>
      document
        .querySelector('.gamecrafter-project-home')
        ?.textContent.includes('Connected to platform service'),
    );
    const resize = async (width, height) => {
      if (desktop) {
        // Electron does not expose Chromium's Browser window-management CDP domain.
        // Resize only the native window owned by the process launched by this test.
        assert.equal(
          process.platform,
          'win32',
          'Native desktop sizing in this smoke test uses Win32',
        );
        const setNativeSize = (nativeWidth, nativeHeight) =>
          spawnSync(
            'powershell.exe',
            [
              '-NoProfile',
              '-Command',
              `
Add-Type -TypeDefinition @'
using System;
using System.Runtime.InteropServices;
using System.Text;
public static class SmokeWindow {
  [StructLayout(LayoutKind.Sequential)] public struct Rect { public int Left, Top, Right, Bottom; }
  [DllImport("user32.dll")] public static extern bool ShowWindow(IntPtr window, int command);
  [DllImport("user32.dll")] public static extern bool SetWindowPos(IntPtr window, IntPtr after, int x, int y, int width, int height, uint flags);
  [DllImport("user32.dll")] public static extern bool GetWindowRect(IntPtr window, out Rect rect);
  [DllImport("user32.dll")] public static extern uint GetWindowThreadProcessId(IntPtr window, out uint processId);
  public delegate bool EnumCallback(IntPtr window, IntPtr data);
  [DllImport("user32.dll")] public static extern bool EnumWindows(EnumCallback callback, IntPtr data);
  [DllImport("user32.dll", CharSet=CharSet.Unicode)] public static extern int GetWindowText(IntPtr window, StringBuilder text, int count);
  [DllImport("user32.dll")] public static extern bool IsWindowVisible(IntPtr window);
  public static IntPtr OwnedWindow(uint pid) {
    IntPtr found = IntPtr.Zero;
    EnumWindows((window, data) => {
      uint owner; GetWindowThreadProcessId(window, out owner);
      if (owner == pid && IsWindowVisible(window)) {
        var title = new StringBuilder(512); GetWindowText(window, title, 512);
        Rect rect; GetWindowRect(window, out rect);
        if (title.ToString().Contains("PlayWeld")) found = window;
      }
      return true;
    }, IntPtr.Zero);
    return found;
  }
}
'@
$ownedWindow = [SmokeWindow]::OwnedWindow(${appProcess.pid})
if ($ownedWindow -eq [IntPtr]::Zero) { throw 'Owned Electron window not found' }
$ownerPid = [uint32]0
[SmokeWindow]::GetWindowThreadProcessId($ownedWindow, [ref]$ownerPid) | Out-Null
if ($ownerPid -ne ${appProcess.pid}) { throw 'Window does not belong to this test' }
[SmokeWindow]::ShowWindow($ownedWindow, 9) | Out-Null
if (-not [SmokeWindow]::SetWindowPos($ownedWindow, [IntPtr]::Zero, 0, 0, ${nativeWidth}, ${nativeHeight}, 22)) { throw 'Window resize failed' }
$windowRect = New-Object SmokeWindow+Rect
[SmokeWindow]::GetWindowRect($ownedWindow, [ref]$windowRect) | Out-Null
@{width=$windowRect.Right-$windowRect.Left; height=$windowRect.Bottom-$windowRect.Top} | ConvertTo-Json -Compress
`,
            ],
            { windowsHide: true, encoding: 'utf8' },
          );
        let resized = setNativeSize(width, height);
        assert.equal(resized.status, 0, resized.stderr);
        await delay(300);
        const viewport = await page.evaluate(() => ({ width: innerWidth, height: innerHeight }));
        if (viewport.width !== width || viewport.height !== height) {
          const native = JSON.parse(resized.stdout);
          resized = setNativeSize(
            native.width + width - viewport.width,
            native.height + height - viewport.height,
          );
          assert.equal(resized.status, 0, resized.stderr);
        }
        await wait((w, h) => innerWidth === w && innerHeight === h, width, height);
      } else await page.setViewport({ width, height });
      await delay(300);
    };
    for (const [width, height] of [
      [800, 600],
      [1440, 1000],
    ]) {
      await resize(width, height);
      await open('Chat', '.gamecrafter-chat');
      await (await reachable('select[aria-label="Chat Project"]')).select(a.projectId);
      await (
        await reachable('select[aria-label="Chat model"]')
      ).select(`${account.accountId}/selected-chat`);
      const geometry = await page.$eval('.gamecrafter-chat', (node) => ({
        width: node.getBoundingClientRect().width,
        clientWidth: node.clientWidth,
        scrollWidth: node.scrollWidth,
        viewport: [innerWidth, innerHeight],
      }));
      assert(geometry.width >= 319, 'Chat dock must retain a usable minimum width');
      assert(
        geometry.scrollWidth <= geometry.clientWidth + 2,
        'Chat content must fit its actual dock width',
      );
      measurements.push({ window: [width, height], chat: geometry });
      const editor = await reachable('textarea[aria-label="Message"]');
      await editor.asLocator().fill(`Typed at ${width} by ${height}`);
      await page.keyboard.press('End');
      await page.keyboard.down('Shift');
      await page.keyboard.press('Enter');
      await page.keyboard.up('Shift');
      assert(
        (await editor.evaluate((node) => node.value)).includes('\n'),
        'Shift+Enter must insert a new line',
      );
      await page.keyboard.type('keyboard input');
      const nextRequest = pending.length;
      await page.keyboard.press('Enter');
      await waitStored(async () => pending.length > nextRequest);
      const origin = (
        await client.call('chat/list', { projectId: a.projectId })
      ).conversations.find((conversation) => conversation.title.includes(`Typed at ${width}`));
      assert(origin, 'Submitting with Enter creates the origin conversation');
      const destination = await reachable('select[aria-label="Chat Project"]');
      await destination.select(b.projectId);
      await wait(() =>
        document
          .querySelector('.gamecrafter-chat')
          ?.textContent.includes('A response is still pending in another conversation'),
      );
      assert(
        !(await page.$('.gamecrafter-chat-transcript [aria-live="polite"]')),
        'Foreign streamed text must not appear in the destination',
      );
      pending[nextRequest].finish();
      await waitStored(async () =>
        (
          await client.call('chat/messages', {
            projectId: a.projectId,
            conversationId: origin.conversationId,
          })
        ).messages.some((message) => message.role === 'assistant'),
      );
      assert.equal(
        (await client.call('chat/list', { projectId: b.projectId })).conversations.length,
        0,
      );
      await (await reachable('select[aria-label="Chat Project"]')).select(a.projectId);
      await wait(
        (id) =>
          [...document.querySelectorAll('nav[aria-label="Chat conversations"] button')].some(
            (node) => node.textContent.includes(id),
          ),
        `Typed at ${width}`,
      );
      await (
        await reachable('select[aria-label="Chat conversation"]')
      ).select(origin.conversationId);
      await wait(() =>
        document
          .querySelector('.gamecrafter-chat-transcript')
          ?.textContent.includes('Answer saved to origin.'),
      );
      await reachable('textarea[aria-label="Message"]');
      // Also prove the physical Send control is usable after scrolling a compact dock.
      await (
        await reachable('textarea[aria-label="Message"]')
      )
        .asLocator()
        .fill(`Clicked Send at ${width}`);
      const clickedRequest = pending.length;
      await (
        await reachable('.gamecrafter-chat-composer button[type="submit"]')
      )
        .asLocator()
        .click();
      await waitStored(async () => pending.length > clickedRequest);
      pending[clickedRequest].finish();
      await wait(() => !document.querySelector('textarea[aria-label="Message"]')?.disabled);
      await reachable('.gamecrafter-chat-composer button[type="submit"]');
      await page.screenshot({ path: path.join(directory, `chat-${width}.png`) });
      checks.push(
        `${width}x${height}: dock bounds, keyboard composition, physical Send button, cross-project navigation and persisted answer ownership`,
      );

      await clickText('.lm-TabBar-tabLabel', 'Project Home');
      const home = await page.$eval('.gamecrafter-project-home', (node) => ({
        width: node.clientWidth,
        scrollWidth: node.scrollWidth,
        actionWidths: [...node.querySelectorAll('.gamecrafter-project-home-actions button')].map(
          (button) => button.getBoundingClientRect().width,
        ),
      }));
      assert(home.scrollWidth <= home.width + 2, 'Home must fit beside the Chat dock');
      assert(
        home.actionWidths.every((value) => value >= 155),
        'Navigation buttons must have enough width for unbroken words',
      );
      await page.screenshot({ path: path.join(directory, `home-${width}.png`) });
      await open('Settings', '.gamecrafter-settings');
      const search = await reachable('.gamecrafter-settings-search input');
      await search.asLocator().fill('access.mode');
      await page.waitForSelector('select[aria-label="Access mode"]');
      await (await reachable('select[aria-label="Access mode"]')).select('restricted');
      await wait(() =>
        document.querySelector('.gamecrafter-setting-source')?.textContent.includes('Platform'),
      );
      await (await reachable('.gamecrafter-settings-reset')).asLocator().click();
      await wait(
        () => document.querySelector('select[aria-label="Access mode"]')?.value === 'ask-always',
      );
      for (const selector of [
        '.gamecrafter-settings-project select',
        '.gamecrafter-settings-import-button input',
        '.gamecrafter-settings-search input',
      ])
        await reachable(selector);
      const settings = await page.$eval('.gamecrafter-settings', (node) => ({
        width: node.clientWidth,
        scrollWidth: node.scrollWidth,
      }));
      assert(
        settings.scrollWidth <= settings.width + 2,
        'Settings toolbar and controls must fit beside Chat',
      );
      await page.screenshot({ path: path.join(directory, `settings-${width}.png`) });
      measurements.push({ window: [width, height], home, settings });
      checks.push(
        `${width}x${height}: Home navigation, Settings search/select/reset and import/project controls remain reachable beside Chat`,
      );
    }
    // Same-project conversation navigation while a response is pending.
    await page.waitForSelector('.gamecrafter-chat', { visible: true });
    await (await reachable('select[aria-label="Chat Project"]')).select(a.projectId);
    await (
      await reachable('textarea[aria-label="Message"]')
    )
      .asLocator()
      .fill('Same-project conversation race');
    const nextRequest = pending.length;
    await page.keyboard.press('Enter');
    await waitStored(async () => pending.length > nextRequest);
    await wait(() =>
      [...document.querySelectorAll('nav[aria-label="Chat conversations"] button')].some((node) =>
        node.textContent.includes('Other conversation in A'),
      ),
    );
    await (
      await reachable('select[aria-label="Chat conversation"]')
    ).select(alternate.conversationId);
    pending[nextRequest].finish();
    await wait(() => !document.querySelector('textarea[aria-label="Message"]')?.disabled);
    assert.deepEqual(
      (
        await client.call('chat/messages', {
          projectId: a.projectId,
          conversationId: alternate.conversationId,
        })
      ).messages,
      [],
    );
    assert(
      !(await page.$('.gamecrafter-chat-message')),
      'The destination conversation remains empty',
    );
    checks.push(
      'Same-project conversation switching during a real RPC/provider response preserves destination storage and transcript',
    );
    // Reproduce ordinary provider discovery: IDs only, no capability extension.
    await client.call('model/update', {
      modelId: `${account.accountId}/selected-chat`,
      patch: { enabled: false },
    });
    const plainDiscovery = await client.call('model/discover', {
      accountId: account.accountId,
      providerModelIds: ['plain-chat'],
    });
    const plainModelId = plainDiscovery.models[0].modelId;
    await client.call('pool/create', {
      name: 'Plain chat pool',
      scope: 'platform',
      target: { kind: 'task-type', id: 'chat' },
      modelIds: [plainModelId],
    });
    await open('Chat', '.gamecrafter-chat');
    await wait(
      (id) =>
        [...document.querySelectorAll('select[aria-label="Chat model"] option')].some(
          (option) => option.value === id,
        ),
      plainModelId,
    );
    for (const modelId of ['', plainModelId]) {
      await (await reachable('select[aria-label="Chat model"]')).select(modelId);
      await (await reachable('button[aria-label="New chat"]')).asLocator().click();
      await (
        await reachable('textarea[aria-label="Message"]')
      )
        .asLocator()
        .fill(modelId ? 'Plain manual chat' : 'Plain auto chat');
      await page.keyboard.press('Enter');
      await wait(() =>
        document
          .querySelector('.gamecrafter-chat-message.is-assistant')
          ?.textContent.includes('Answer without streaming metadata.'),
      );
      assert(
        !(await page.$('.gamecrafter-chat-error')),
        'Plain chat should complete without routing errors',
      );
    }
    await page.screenshot({ path: path.join(directory, 'chat-without-streaming-metadata.png') });
    checks.push(
      'ID-only provider discovery appears in the model picker and answers with both Auto route and manual selection through a chat pool',
    );
    assert.deepEqual(errors, []);
    const report = {
      target: desktop ? 'built Electron desktop' : 'built browser development app',
      provider: 'isolated fake local HTTP/SSE provider',
      checks,
      measurements,
      rendererErrors: errors,
      artifactDirectory: directory,
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
      JSON.stringify({ checks, measurements, errors, error: String(error) }, null, 2),
    );
    throw error;
  } finally {
    for (const request of pending) {
      try {
        request.finish();
      } catch {}
    }
    if (browser) {
      if (desktop) browser.disconnect();
      else await browser.close();
    }
    if (appProcess?.pid) {
      if (process.platform === 'win32')
        spawnSync('taskkill', ['/PID', String(appProcess.pid), '/T', '/F'], {
          windowsHide: true,
          stdio: 'ignore',
        });
      else appProcess.kill();
    }
    fs.closeSync(log);
    client.close();
    await service.stop();
    provider.closeAllConnections();
    await new Promise((resolve) => provider.close(resolve));
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

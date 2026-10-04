const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { setTimeout: delay } = require('node:timers/promises');
const { execFileSync } = require('node:child_process');
const { backupScenario } = require('./backup-scenario.cjs');
const { pluginScenario } = require('./plugin-scenario.cjs');
const { connectionScenario } = require('./connection-scenario.cjs');
const { assetScenario } = require('./asset-scenario.cjs');

async function runScenarios(context) {
  const {
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
  } = context;
  if (selectedScenarios.includes('agent')) {
    const roleRoot = path.join(project.path, '.gamecrafter/roles/lantern-writer');
    fs.mkdirSync(roleRoot, { recursive: true });
    fs.writeFileSync(
      path.join(roleRoot, 'ROLE.md'),
      '---\nname: lantern-writer\ndescription: Write one synthetic tutorial document.\nwork-types: documentation\nmax-access: restricted\ntools: fs/write-file\nisolation: worktree\n---\nOnly write the requested synthetic file.\n',
    );
    execFileSync('git', ['add', '.'], { cwd: project.path, windowsHide: true });
    execFileSync(
      'git',
      [
        '-c',
        'user.name=Documentation Fixture',
        '-c',
        'user.email=fixture@example.invalid',
        'commit',
        '-m',
        'Prepare disposable tutorial fixture',
      ],
      { cwd: project.path, windowsHide: true },
    );
    await client.call('settings/set', {
      key: 'access.mode',
      scope: 'project',
      projectId: project.projectId,
      value: 'restricted',
    });
    await client.call('settings/set', {
      key: 'access.restricted.allowedSideEffects',
      scope: 'project',
      projectId: project.projectId,
      value: ['none', 'internal-write', 'workspace-write', 'paid'],
    });
    await client.call('settings/set', {
      key: 'coordination.autoIntegrate',
      scope: 'project',
      projectId: project.projectId,
      value: 'never',
    });
    await open('Swarm', 'swarm');
    await selectProject('[aria-label="Swarm Project"]', project.projectId);
    await selectSection('Swarm views', 'Agents');
    await ensureDisclosure('.gamecrafter-swarm-request-composer summary', 'New request');
    await page.click('[aria-label="Change request"]');
    await page.keyboard.down('Control');
    await page.keyboard.press('A');
    await page.keyboard.up('Control');
    await page.keyboard.press('Backspace');
    await page.type(
      '[aria-label="Change request"]',
      'Lantern scripted request: ask about reset, then delegate docs/AGENT_EXAMPLE.md to lantern-writer. Local deterministic fixture only.',
    );
    await click('.gamecrafter-swarm button', 'Submit request');
    await page.waitForSelector(
      '[aria-label="Answer for Tutorial fixture: confirm the reset key"]',
      { timeout: 90000 },
    );
    await capture('agent-question', '.gamecrafter-swarm');
    await page.type('[aria-label="Answer for Tutorial fixture: confirm the reset key"]', 'R');
    await click('.gamecrafter-swarm-question button', 'Answer');
    let integrations;
    for (let attempt = 0; attempt < 180; attempt++) {
      integrations = await client.call('change/integrations', { projectId: project.projectId });
      if (
        integrations.integrations.some(
          (item) => item.status === 'ready' && item.changedFiles.includes('docs/AGENT_EXAMPLE.md'),
        )
      )
        break;
      if (attempt === 179)
        throw new Error(
          'Agent fixture did not produce a ready integration: ' + JSON.stringify(integrations),
        );
      await delay(500);
    }
    await click('.gamecrafter-swarm header button', 'Refresh');
    await selectSection('Swarm views', 'Integrations');
    await page.evaluate(() =>
      [...document.querySelectorAll('.gamecrafter-swarm-panel')]
        .find((node) => node.querySelector('h2')?.textContent === 'Integrations')
        .scrollIntoView(),
    );
    await capture('agent-integration-ready', '.gamecrafter-swarm');
    const childIntegration = integrations.integrations.find(
      (item) => item.status === 'ready' && item.changedFiles.includes('docs/AGENT_EXAMPLE.md'),
    );
    const integrateButton = await page.evaluateHandle(() =>
      [...document.querySelectorAll('.gamecrafter-swarm table tbody tr')]
        .find((node) => node.cells[2]?.textContent.includes('docs/AGENT_EXAMPLE.md'))
        .querySelector('button'),
    );
    await integrateButton.asElement().asLocator().click();
    for (let attempt = 0; attempt < 90; attempt++) {
      if (
        (
          await client.call('change/integrations', { projectId: project.projectId })
        ).integrations.some(
          (item) =>
            item.integrationId === childIntegration.integrationId && item.status === 'integrated',
        )
      )
        break;
      if (attempt === 89) throw new Error('Manual integration did not finish');
      await delay(500);
    }
    assert(
      fs
        .readFileSync(path.join(project.path, 'docs/AGENT_EXAMPLE.md'), 'utf8')
        .includes('Synthetic tutorial artifact'),
    );
    const requests = await client.call('change/requests', { projectId: project.projectId });
    const request = requests.requests.find((item) =>
      item.text.includes('Lantern scripted request'),
    );
    assert(request, 'Scripted request must be durable');
    assert(
      request.text.startsWith('Lantern scripted request:'),
      'Overview preview text must not carry into agent execution',
    );
    for (let attempt = 0; attempt < 90; attempt++) {
      const root = await client.call('task/get', {
        projectId: project.projectId,
        taskId: request.rootTaskId,
      });
      if (root.state === 'succeeded') break;
      if (root.state === 'failed' || attempt === 89)
        throw new Error(
          'Coordinator did not satisfy its completion contract: ' + JSON.stringify(root.error),
        );
      await delay(500);
    }
    await click('.gamecrafter-swarm header button', 'Refresh');
    await selectSection('Swarm views', 'Integrations');
    await page.evaluate(() =>
      [...document.querySelectorAll('.gamecrafter-swarm-panel')]
        .find((node) => node.querySelector('h2')?.textContent === 'Integrations')
        .scrollIntoView(),
    );
    await capture('agent-integrated', '.gamecrafter-swarm');
    checks.push(
      'Agent: scripted local provider through actual UI request, runtime question/answer, delegated worktree write, completion contract and manual UI integration; no real model reasoning',
    );
    const approvedCall = client.call('tool/call', {
      projectId: project.projectId,
      toolId: 'fs/write-file',
      accessCeiling: 'ask-always',
      input: { path: 'docs/APPROVAL_EXAMPLE.md', content: 'Synthetic approved tutorial write.\n' },
    });
    // Attach rejection handling immediately while the user-facing fixture approval is pending.
    const completion = approvedCall.then(
      (value) => ({ value }),
      (error) => ({ error }),
    );
    await click('.gamecrafter-swarm header button', 'Refresh');
    await selectSection('Swarm views', 'Approvals');
    await wait(() =>
      [...document.querySelectorAll('[aria-label="Pending approvals"] button')].some(
        (node) => node.textContent.trim() === 'Approve',
      ),
    );
    await page.evaluate(() =>
      document.querySelector('[aria-label="Pending approvals"]').scrollIntoView(),
    );
    await capture('agent-approval', '.gamecrafter-swarm');
    await click('[aria-label="Pending approvals"] button', 'Approve');
    const approved = await completion;
    if (approved.error) throw approved.error;
    assert(
      fs
        .readFileSync(path.join(project.path, 'docs/APPROVAL_EXAMPLE.md'), 'utf8')
        .includes('approved tutorial write'),
    );
    checks.push(
      'Approval: real broker call at ask-always ceiling approved in UI and synthetic file verified',
    );
  }
  if (selectedScenarios.includes('settings')) {
    await open('Settings', 'settings');
    await ensureDisclosure('.gamecrafter-settings details summary', 'Import and export');
    await page.locator('.gamecrafter-settings-search input').fill('access.mode');
    await page.waitForSelector('select[aria-label="Access mode"]');
    await page.select('select[aria-label="Access mode"]', 'restricted');
    await wait(() =>
      document
        .querySelector('.gamecrafter-setting-source')
        ?.textContent.includes('Effective from Platform'),
    );
    const exported = await client.call('settings/export', {});
    const document = {
      ...exported,
      settings: exported.settings.filter((item) => item.key === 'access.mode'),
    };
    assert.equal(document.settings[0].layers.platform, 'restricted');
    const file = path.join(run, 'settings-example.json');
    fs.writeFileSync(file, JSON.stringify(document));
    await click('.gamecrafter-setting-row button', 'Reset');
    await wait(
      () => document.querySelector('select[aria-label="Access mode"]')?.value === 'ask-always',
    );
    const input = await page.$('[aria-label="Import settings file"]');
    await input.uploadFile(file);
    await page.waitForSelector('[aria-label="Settings import preview"]');
    assert.equal((await client.call('settings/get', { key: 'access.mode' })).value, 'ask-always');
    await capture('settings-import-preview', '.gamecrafter-settings');
    await click('.gamecrafter-settings-import-preview button', 'Apply overrides');
    await wait(() =>
      document
        .querySelector('.gamecrafter-settings [role="status"]')
        ?.textContent.includes('Imported 1 settings.'),
    );
    assert.equal((await client.call('settings/get', { key: 'access.mode' })).value, 'restricted');
    await capture('settings-import-result', '.gamecrafter-settings');
    await page.evaluate(() => {
      window.__documentationDownloads = [];
      const original = URL.createObjectURL;
      URL.createObjectURL = (blob) => {
        window.__documentationDownloads.push(blob);
        return original(blob);
      };
    });
    await click('.gamecrafter-settings button', 'Export redacted settings');
    await wait(() => window.__documentationDownloads?.length > 0);
    const uiExport = await page.evaluate(async () =>
      JSON.parse(await window.__documentationDownloads.at(-1).text()),
    );
    assert.equal(
      uiExport.settings.find((item) => item.key === 'access.mode').layers.platform,
      'restricted',
    );
    fs.writeFileSync(file, '{invalid JSON');
    await input.uploadFile(file);
    await wait(() => Boolean(document.querySelector('.gamecrafter-settings [role="alert"]')));
    await capture('settings-import-failure', '.gamecrafter-settings');
    assert.equal((await client.call('settings/get', { key: 'access.mode' })).value, 'restricted');
    await click('.gamecrafter-setting-row button', 'Reset');
    checks.push(
      'Settings: real UI dry-run import, explicit apply, redacted export, malformed-file rejection and reset; service assertions verified each value',
    );
  }
  if (selectedScenarios.includes('decisions')) {
    await client.call('settings/set', {
      key: 'access.mode',
      scope: 'project',
      projectId: project.projectId,
      value: 'restricted',
    });
    await open('Discussion Board', 'board');
    await selectProject('[aria-label="Board Project"]', project.projectId);
    await ensureDisclosure('.gamecrafter-board details summary', 'New thread');
    await page.locator('[aria-label="New thread title"]').fill('Tutorial reset acceptance');
    await page.type(
      '[aria-label="New thread message"]',
      'Synthetic tutorial discussion: accept R as the reset key.',
    );
    await click('.gamecrafter-board-form button', 'Create thread');
    await page.waitForSelector('[aria-label="Board message type"]');
    await page.select('[aria-label="Board message type"]', 'decision');
    await page.type(
      '[aria-label="Board message body"]',
      'Lantern Workshop resets player position and lantern collection with R. This decision applies only to the disposable tutorial Project.',
    );
    await click('.gamecrafter-board-composer button', 'Post message');
    await wait(() =>
      [...document.querySelectorAll('.gamecrafter-board button')].some(
        (node) => node.textContent.trim() === 'Mark as binding decision',
      ),
    );
    await capture('decision-before-binding', '.gamecrafter-board');
    await click('.gamecrafter-board button', 'Mark as binding decision');
    await wait(() =>
      document.querySelector('.quick-input-title')?.textContent.includes('decision'),
    );
    await page.keyboard.press('Enter');
    let decisions;
    for (let attempt = 0; attempt < 90; attempt++) {
      decisions = await client.call('board/decisions', { projectId: project.projectId });
      if (decisions.decisions.some((item) => item.syncStatus === 'synchronized')) break;
      if (attempt === 89)
        throw new Error('Binding decision did not synchronize: ' + JSON.stringify(decisions));
      await delay(500);
    }
    const decision = decisions.decisions.find((item) => item.syncStatus === 'synchronized');
    assert(decision.canonRecordPath);
    const file = path.resolve(project.path, decision.canonRecordPath);
    assert(file.startsWith(project.path + path.sep));
    assert(fs.readFileSync(file, 'utf8').includes('Lantern Workshop resets'));
    await page.evaluate(() =>
      document.querySelector('.gamecrafter-board-decisions').scrollIntoView(),
    );
    await capture('decision-synchronized', '.gamecrafter-board');
    checks.push(
      'Discussion: UI post, user binding action, durable synchronized decision and generated canon document verified',
    );
  }
  if (selectedScenarios.includes('knowledge')) {
    const marker = 'lantern_revision_' + Date.now();
    fs.appendFileSync(
      path.join(project.path, 'docs/DESIGN.md'),
      `\nTutorial index change marker: ${marker}.\n`,
    );
    await open('Knowledge', 'knowledge');
    await selectProject('[aria-label="Knowledge Project"]', project.projectId);
    await selectSection('Knowledge sections', 'Index status');
    await click('.gamecrafter-knowledge-actions button', 'Reconcile');
    let result;
    for (let attempt = 0; attempt < 90; attempt++) {
      result = await client.call('knowledge/search', {
        projectId: project.projectId,
        query: marker,
        mode: 'lexical',
        sources: ['docs'],
        limit: 5,
      });
      if (
        result.hits.some((hit) => hit.path === 'docs/DESIGN.md' && hit.quote.text.includes(marker))
      )
        break;
      if (attempt === 89) throw new Error('Changed document did not become searchable');
      await delay(500);
    }
    await selectSection('Knowledge sections', 'Search');
    await ensureDisclosure('.gamecrafter-knowledge details summary', 'Search mode and filters');
    await page.select('[aria-label="Knowledge search mode"]', 'lexical');
    await page.select('[aria-label="Knowledge search source"]', 'docs');
    await page.locator('[aria-label="Knowledge search query"]').fill(marker);
    await click(
      '.gamecrafter-knowledge-query-form button, .gamecrafter-knowledge form button',
      'Search',
    );
    await wait(() =>
      document.querySelector('.gamecrafter-knowledge')?.textContent.includes('DESIGN.md'),
    );
    await capture('knowledge-changed-document', '.gamecrafter-knowledge');
    checks.push(
      'Knowledge: changed native document reconciled through UI; new content, path and citation verified by actual service search',
    );
  }
  if (selectedScenarios.includes('backup')) await backupScenario(context);
  if (selectedScenarios.includes('plugin')) await pluginScenario(context);
  if (selectedScenarios.includes('connections')) await connectionScenario(context);
  if (selectedScenarios.includes('assets')) await assetScenario(context);
}
module.exports = { runScenarios };

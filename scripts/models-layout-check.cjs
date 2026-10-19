// Rendered regression shared by the browser and native Electron smoke runs.
const assert = require('node:assert/strict');
const { createServer } = require('node:http');
const path = require('node:path');

module.exports = async function checkModelsLayout(page, client, directory, clickText) {
  const provider = createServer((_request, response) => {
    response.writeHead(200, { 'content-type': 'application/json' });
    response.end(
      JSON.stringify({
        data: Array.from({ length: 24 }, (_, index) => ({
          id: `layout-model-${index}-with-a-long-provider-identifier`,
          capabilities: { chat: true },
        })),
      }),
    );
  });
  await new Promise((resolve) => provider.listen(0, '127.0.0.1', resolve));
  const viewport = await page.evaluate(() => ({ width: innerWidth, height: innerHeight }));
  let account;
  try {
    account = await client.call('provider/addAccount', {
      providerKind: 'openai-compatible',
      displayName: 'Layout provider with a deliberately long descriptive account name',
      baseUrl: `http://127.0.0.1:${provider.address().port}/v1`,
      isLocal: true,
    });
    await clickText(
      page,
      'nav[aria-label="Model configuration sections"] button',
      'Provider accounts',
    );
    await clickText(page, '.gamecrafter-models-header button', 'Refresh');
    await page.waitForFunction(
      (name) => document.querySelector('.gamecrafter-models-table')?.textContent.includes(name),
      {},
      account.displayName,
    );
    await clickText(
      page,
      `.gamecrafter-models-table tr:has(input[aria-label="Enable ${account.displayName}"]) button`,
      'Discover',
    );
    await page.waitForSelector('.gamecrafter-model-selection fieldset');
    for (const width of [360, 640, 800, 1280]) {
      await page.setViewport({ width, height: 720 });
      const dimensions = await page.evaluate(() => {
        const root = document.querySelector('.gamecrafter-models');
        const region = document.querySelector(
          '.gamecrafter-models-section:not([hidden]) .gamecrafter-models-table-scroll',
        );
        const first = region.querySelector('tbody td');
        const choices = region.querySelector('fieldset');
        return {
          root: root.clientWidth,
          content: root.scrollWidth,
          kind: first.getBoundingClientRect().width,
          choices: choices.clientHeight,
          choicesContent: choices.scrollHeight,
          regionRole: region.getAttribute('role'),
          tabIndex: region.tabIndex,
        };
      });
      assert(
        dimensions.kind >= 140,
        `Provider kind must remain readable at ${width}px: ${JSON.stringify(dimensions)}`,
      );
      assert(
        dimensions.content <= dimensions.root + 1,
        `Models view must contain horizontal overflow at ${width}px`,
      );
      assert(
        dimensions.choices <= 400 && dimensions.choicesContent > dimensions.choices,
        'Long discovery lists must scroll inside a bounded chooser',
      );
      assert.equal(dimensions.regionRole, 'region');
      assert.equal(dimensions.tabIndex, 0, 'Table scrolling must be keyboard accessible');
      const region = await page.$(
        '.gamecrafter-models-section:not([hidden]) .gamecrafter-models-table-scroll',
      );
      await region.focus();
      await page.keyboard.press('ArrowRight');
      await page.waitForFunction(() => {
        const node = document.querySelector(
          '.gamecrafter-models-section:not([hidden]) .gamecrafter-models-table-scroll',
        );
        return node.scrollWidth <= node.clientWidth || node.scrollLeft > 0;
      });
      await page.$eval(
        '.gamecrafter-models-section:not([hidden]) .gamecrafter-models-table-scroll',
        (node) => {
          node.scrollLeft = node.scrollWidth;
        },
      );
      await page.screenshot({ path: path.join(directory, `models-accounts-${width}.png`) });
    }
    await page.setViewport({ width: 360, height: 720 });
    const choice = await page.$(
      `input[aria-label="Select model layout-model-0-with-a-long-provider-identifier for ${account.displayName}"]`,
    );
    await choice.scrollIntoView();
    await choice.asLocator().click();
    await clickText(page, '.gamecrafter-model-selection button', 'Enable selected (1)');
    await page.waitForSelector('input[aria-label^="Display name "]');
    const selected = (await client.call('model/list', { accountId: account.accountId })).models;
    assert.equal(selected.length, 1);
    assert.equal(selected[0].enabled, true, 'Narrow chooser must enable the selected model');
    await clickText(page, 'nav[aria-label="Model configuration sections"] button', 'Models');
    await page.waitForSelector('input[aria-label^="Display name "]');
    await page.$$eval('.gamecrafter-models-section:not([hidden]) tbody details', (nodes) =>
      nodes.forEach((node) => {
        node.open = true;
      }),
    );
    for (const width of [360, 800, 1280]) {
      await page.setViewport({ width, height: 720 });
      assert(
        await page.$eval('.gamecrafter-models', (node) => node.scrollWidth <= node.clientWidth + 1),
        `Model rows must not widen the view at ${width}px`,
      );
      const region = await page.$(
        '.gamecrafter-models-section:not([hidden]) .gamecrafter-models-table-scroll',
      );
      assert.equal(
        await region.evaluate((node) => node.getAttribute('aria-label')),
        'Models table',
      );
      await page.screenshot({ path: path.join(directory, `models-rows-${width}.png`) });
    }
  } finally {
    await page.setViewport(viewport);
    try {
      if (account) await client.call('provider/removeAccount', { accountId: account.accountId });
    } finally {
      await new Promise((resolve) => provider.close(resolve));
    }
  }
};

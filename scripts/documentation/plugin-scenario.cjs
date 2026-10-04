const path = require('node:path');
const assert = require('node:assert/strict');
async function pluginScenario({
  client,
  page,
  project,
  checks,
  open,
  click,
  selectSection,
  selectProject,
  capture,
  wait,
}) {
  await open('Plugins', 'plugins');
  await selectSection('Platform plugin sections', 'Install');
  await page.waitForSelector('[aria-label="Plugin source"]', { visible: true });
  await page.type('[aria-label="Plugin source"]', path.resolve('packages/plugins/sample-hello'));
  await click('.gamecrafter-plugins button', 'Inspect source');
  await page.waitForSelector('[aria-label="Plugin capability review"]');
  await capture('plugin-capability-review', '.gamecrafter-plugins');
  await page.locator('.gamecrafter-plugin-review input[type="checkbox"]').click();
  await click('.gamecrafter-plugins button', 'Accept capabilities and install');
  await wait(() =>
    document.querySelector('.gamecrafter-plugins')?.textContent.includes('Installed Sample Hello'),
  );
  await selectProject('[aria-label="Plugins Project"]', project.projectId);
  await selectSection('Platform plugin sections', 'Installed');
  await wait(() =>
    [...document.querySelectorAll('.gamecrafter-plugin-card-actions label')].some((node) =>
      node.textContent.includes('Enabled for this Project'),
    ),
  );
  const enabled = await page.evaluateHandle(() =>
    [...document.querySelectorAll('.gamecrafter-plugin-card-actions label')]
      .find((node) => node.textContent.includes('Enabled for this Project'))
      .querySelector('input'),
  );
  if (!(await enabled.asElement().evaluate((node) => node.checked)))
    await enabled.asElement().click();
  const isolation = await client.call('plugin/isolationReport', {});
  await capture('plugin-installed', '.gamecrafter-plugins');
  await click('.gamecrafter-plugins button', 'Start');
  if (process.platform === 'win32') {
    await wait(() =>
      /isolation.*unavailable/i.test(
        document.querySelector('.gamecrafter-plugins [role="alert"]')?.textContent ?? '',
      ),
    );
    await capture('plugin-isolation-unavailable', '.gamecrafter-plugins');
    checks.push(
      'Plugin: real UI inspection, exact capability acceptance, installation/enablement and fail-closed Windows runtime isolation diagnostic; tool execution remains unavailable on this host',
    );
  } else {
    throw new Error(
      'This scenario currently verifies Windows isolation failure; use plugin integration tests for a supported Linux runtime. Isolation report: ' +
        JSON.stringify(isolation),
    );
  }
  await click('.gamecrafter-plugins button', 'Uninstall');
  await click('.gamecrafter-plugins button', 'Confirm uninstall');
  await wait(() =>
    document
      .querySelector('.gamecrafter-plugins')
      ?.textContent.includes('Uninstalled sample-hello'),
  );
  checks.push('Plugin: owned sample uninstalled through UI');
}
module.exports = { pluginScenario };

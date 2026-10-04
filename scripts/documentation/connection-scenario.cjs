const path = require('node:path');
const assert = require('node:assert/strict');
async function connectionScenario({
  client,
  page,
  project,
  checks,
  open,
  click,
  selectSection,
  selectProject,
  ensureDisclosure,
  capture,
  wait,
}) {
  await open('Connections', 'connections');
  await selectProject('[aria-label="Connections Project"]', project.projectId);
  await selectSection('Connection views', 'Add connection');
  await page.waitForSelector('[aria-label="Connection name"]', { visible: true });
  await ensureDisclosure(
    '.gamecrafter-connections form details summary',
    'Command arguments and environment',
  );
  await page.type('[aria-label="Connection name"]', 'lantern-docs');
  await page.select('[aria-label="Connection scope"]', 'project');
  await page.type('[aria-label="Connection command"]', process.execPath);
  await page.type(
    '[aria-label="Connection command arguments"]',
    path.resolve('docs/examples/lantern-mcp/server.cjs'),
  );
  await click('.gamecrafter-connections form button', 'Add connection');
  await selectSection('Connection views', 'Servers');
  await wait(() =>
    [...document.querySelectorAll('.gamecrafter-connections table')].some(
      (table) =>
        table.getClientRects().length > 0 && table.textContent.includes('lantern-docs'),
    ),
  );
  await capture('mcp-configured', '.gamecrafter-connections');
  await click('.gamecrafter-connection-actions button', 'Connect');
  await wait(() => document.querySelector('.gamecrafter-connection-status-connected'));
  const entry = (await client.call('mcp/list', { projectId: project.projectId })).connections.find(
    (item) => item.config.name === 'lantern-docs',
  );
  assert(entry && entry.state.negotiatedRevision);
  const tools = await client.call('mcp/tools', { connectionId: entry.config.connectionId });
  assert(tools.tools.some((tool) => tool.toolId.endsWith('/lantern_rule')));
  const classification = await client.call('mcp/classifyTool', {
    connectionId: entry.config.connectionId,
    toolName: 'lantern_rule',
    sideEffects: 'none',
    executionMode: 'headless-process',
  });
  await client.call('settings/set', {
    key: 'access.mode',
    scope: 'project',
    projectId: project.projectId,
    value: 'restricted',
  });
  const result = await client.call('tool/call', {
    projectId: project.projectId,
    toolId: classification.tool.toolId,
    input: {},
  });
  assert(JSON.stringify(result.output).includes('Synthetic Lantern MCP fixture'));
  await click('.gamecrafter-connection-actions button', 'Logs');
  await capture('mcp-connected', '.gamecrafter-connections');
  checks.push(
    `MCP: real UI command/stdio configuration and connection, negotiated ${entry.state.negotiatedRevision}; fixed read tool invoked through real service broker after explicit classification; no engine/editor identity claim`,
  );
  await selectSection('Connection views', 'Servers');
  await click('.gamecrafter-connection-actions button', 'Disconnect');
  await wait(() => !document.querySelector('.gamecrafter-connection-status-connected'));
}
module.exports = { connectionScenario };

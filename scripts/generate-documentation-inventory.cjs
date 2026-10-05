// This inventory counts implementation surfaces; it never infers test acceptance.
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const { RpcMethods, RpcNotifications, PluginCapabilitySchema } = require('@gamecrafter/contracts');
const { createBuiltinSettings } = require('../packages/platform-service/lib/settings/definitions');
const guides = {
  session: 'SERVICE_RECIPES.md',
  service: 'OPERATIONS_GUIDE.md',
  project: 'WORKED_TUTORIAL.md',
  engine: 'INTEGRATION_GUIDE.md',
  dcc: 'INTEGRATION_GUIDE.md',
  asset: 'WORKFLOW_COOKBOOK.md',
  backup: 'OPERATIONS_GUIDE.md',
  knowledge: 'WORKFLOW_COOKBOOK.md',
  settings: 'SETTINGS_REFERENCE.md',
  task: 'WORKFLOW_COOKBOOK.md',
  change: 'WORKFLOW_COOKBOOK.md',
  tool: 'EXTENSION_COOKBOOK.md',
  audit: 'OPERATIONS_GUIDE.md',
  broker: 'WORKFLOW_COOKBOOK.md',
  provider: 'USER_GUIDE.md',
  model: 'USER_GUIDE.md',
  pool: 'USER_GUIDE.md',
  router: 'USER_GUIDE.md',
  decisions: 'USER_GUIDE.md',
  chat: 'WORKED_TUTORIAL.md',
  skills: 'EXTENSION_COOKBOOK.md',
  roles: 'EXTENSION_COOKBOOK.md',
  mcp: 'EXTENSION_COOKBOOK.md',
  a2a: 'USER_GUIDE.md',
  board: 'WORKFLOW_COOKBOOK.md',
  plugin: 'EXTENSION_COOKBOOK.md',
  update: 'RELEASE_GUIDE.md',
};
const sourceAreas = {
  session: 'ipc',
  service: 'ipc',
  project: 'projects',
  engine: 'engines',
  dcc: 'dcc',
  asset: 'assets',
  backup: 'backup',
  knowledge: 'knowledge',
  settings: 'settings',
  task: 'tasks',
  change: 'change',
  tool: 'tools',
  audit: 'tools',
  broker: 'tools',
  provider: 'models',
  model: 'models',
  pool: 'models',
  router: 'models',
  decisions: 'models',
  chat: 'chat',
  skills: 'skills',
  roles: 'roles',
  mcp: 'mcp',
  a2a: 'a2a',
  board: 'board',
  plugin: 'plugins',
  update: 'updates',
};
function files(directory) {
  return fs
    .readdirSync(directory, { withFileTypes: true })
    .flatMap((entry) =>
      entry.isDirectory()
        ? files(path.join(directory, entry.name))
        : [path.join(directory, entry.name).replaceAll('\\', '/')],
    );
}
const allSource = files('packages/platform-service/src');
const rpcFamilies = [...new Set(Object.keys(RpcMethods).map((name) => name.split('/')[0]))]
  .sort()
  .map((family) => {
    assert(guides[family], `Map new RPC family ${family}`);
    return {
      family,
      guide: guides[family],
      methods: Object.keys(RpcMethods).filter((name) => name.startsWith(family + '/')),
      implementation: `packages/platform-service/src/${sourceAreas[family]}`,
      tests: allSource.filter(
        (file) =>
          file.startsWith(`packages/platform-service/src/${sourceAreas[family]}/`) &&
          file.endsWith('.test.ts'),
      ),
      evidence:
        'Source/schema inventory; test paths are discoverability, not a claim that these tests passed. See DOCUMENTATION_COVERAGE.md for live results and gaps.',
    };
  });
const settings = createBuiltinSettings();
const inventory = {
  schemaVersion: 1,
  rpcFamilies,
  notifications: Object.keys(RpcNotifications).sort(),
  settingGroups: settings.groups.map((group) => ({
    id: group.id,
    title: group.title,
    guide: 'SETTINGS_REFERENCE.md',
    keys: settings.definitions
      .filter((definition) => definition.group === group.id)
      .map((definition) => definition.key)
      .sort(),
  })),
  serviceSubsystems: fs
    .readdirSync('packages/platform-service/src', { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => ({
      name: entry.name,
      implementation: `packages/platform-service/src/${entry.name}`,
      tests: allSource.filter(
        (file) =>
          file.startsWith(`packages/platform-service/src/${entry.name}/`) &&
          file.endsWith('.test.ts'),
      ),
      guide: Object.keys(sourceAreas).find((family) => sourceAreas[family] === entry.name)
        ? guides[Object.keys(sourceAreas).find((family) => sourceAreas[family] === entry.name)]
        : 'TECHNICAL_ARCHITECTURE.md',
    })),
  pluginCapabilities: PluginCapabilitySchema.anyOf.map(
    (item) =>
      item.const ?? { capability: item.properties.capability.const, constraint: 'host allowlist' },
  ),
};
const text =
  '# Generated documentation surface inventory\n\nGenerated from built contracts, built setting definitions, and service source paths. Regenerate with `node scripts/generate-documentation-inventory.cjs`; check freshness with `--check`. Counts do not establish acceptance. The [coverage record](../DOCUMENTATION_COVERAGE.md) owns gaps and observed results.\n\n' +
  `Request methods: **${Object.keys(RpcMethods).length}**; notifications: **${inventory.notifications.length}**; settings: **${settings.definitions.length}**; setting groups: **${settings.groups.length}**. Full names and test paths are in [the JSON inventory](documentation-inventory.json).\n\n` +
  '## RPC families\n\n| Family | Methods | Guide | Implementation |\n| --- | --- | --- | --- |\n' +
  rpcFamilies
    .map(
      (item) =>
        `| ${item.family} | ${item.methods.length} | [Guide](../${item.guide}) | [Source](../../${item.implementation}/) |`,
    )
    .join('\n') +
  '\n\n## Settings groups\n\n| Group | Settings | Reference |\n| --- | --- | --- |\n' +
  inventory.settingGroups
    .map(
      (group) =>
        `| ${group.id}: ${group.title} | ${group.keys.length} | [Exact values and scopes](../SETTINGS_REFERENCE.md) |`,
    )
    .join('\n') +
  '\n\n## Service subsystems\n\n| Area | Explanation | Source | Test files |\n| --- | --- | --- | --- |\n' +
  inventory.serviceSubsystems
    .map(
      (item) =>
        `| ${item.name} | [Guide](../${item.guide}) | [Source](../../${item.implementation}/) | ${item.tests.length} |`,
    )
    .join('\n') +
  '\n';
for (const [name, content] of [
  ['documentation-inventory.json', JSON.stringify(inventory, null, 2) + '\n'],
  ['DOCUMENTATION_INVENTORY.md', text],
]) {
  const file = path.join('docs/reference', name);
  if (process.argv.includes('--check'))
    assert.equal(fs.readFileSync(file, 'utf8'), content, `${file} is stale`);
  else fs.writeFileSync(file, content);
}
console.log(
  `${rpcFamilies.length} RPC families, ${inventory.serviceSubsystems.length} service subsystems mapped.`,
);

// Validate documentation surface mappings and retained capture/report integrity.
// This does not establish image quality, live providers or unreported workflows.
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const { RpcMethods, RpcNotifications } = require('@gamecrafter/contracts');
const { createBuiltinSettings } = require('../packages/platform-service/lib/settings/definitions');
const { scenarioNames } = require('./documentation/scenario-options.cjs');
const inventory = JSON.parse(
  fs.readFileSync('docs/reference/documentation-inventory.json', 'utf8'),
);
const sorted = (values) => [...values].sort();
const methods = inventory.rpcFamilies.flatMap((family) => family.methods);
assert.deepEqual(
  sorted(methods),
  sorted(Object.keys(RpcMethods)),
  'Documented methods must exactly match contracts',
);
assert.equal(new Set(methods).size, methods.length, 'No duplicate methods');
assert.deepEqual(sorted(inventory.notifications), sorted(Object.keys(RpcNotifications)));
for (const item of [...inventory.rpcFamilies, ...inventory.serviceSubsystems]) {
  assert(fs.existsSync(path.join('docs', item.guide)), `Missing guide: ${item.guide}`);
  assert(fs.existsSync(item.implementation), `Missing implementation: ${item.implementation}`);
  for (const test of item.tests) assert(fs.existsSync(test), `Missing regression path: ${test}`);
}
for (const group of inventory.settingGroups) assert(fs.existsSync(path.join('docs', group.guide)));
const settings = createBuiltinSettings();
assert.deepEqual(
  sorted(inventory.settingGroups.flatMap((group) => group.keys)),
  sorted(settings.definitions.map((definition) => definition.key)),
  'Every setting must be mapped',
);
assert.deepEqual(
  sorted(inventory.serviceSubsystems.map((area) => area.name)),
  sorted(
    fs
      .readdirSync('packages/platform-service/src', { withFileTypes: true })
      .filter((entry) => entry.isDirectory())
      .map((entry) => entry.name),
  ),
);
const navigation = fs.readFileSync(
  'packages/theia-control-room/src/browser/project-home-widget.tsx',
  'utf8',
);
const labels = [...navigation.matchAll(/\blabel:\s*'([^']+)',\s*command:/g)].map((match) => match[1]);
const normalize = (text) => text.toLowerCase().replaceAll('&', 'and').replace(/\s+/g, ' ').trim();
const headings = [
  ...fs.readFileSync('docs/CONTROL_ROOM_HANDBOOK.md', 'utf8').matchAll(/^## (.+)$/gm),
].map((match) => normalize(match[1]));
assert(labels.length > 0);
assert(headings.some((heading) => heading.startsWith('project home')));
for (const label of labels)
  assert(
    headings.some((heading) => heading.startsWith(normalize(label))),
    `Undocumented Control Room surface: ${label}`,
  );
let reports = 0,
  screenshots = 0;
let combined;
for (const folder of fs.readdirSync('docs/images', { withFileTypes: true })) {
  if (!folder.isDirectory()) continue;
  const directory = path.join('docs/images', folder.name);
  const reportFile = path.join(directory, 'capture-report.json');
  if (!fs.existsSync(reportFile)) continue;
  const report = JSON.parse(fs.readFileSync(reportFile, 'utf8'));
  assert.deepEqual(report.rendererErrors, [], `${reportFile}: renderer failure`);
  assert(report.checks.length > 0 && report.screenshots.length > 0);
  assert(report.platformVersion && Number.isFinite(Date.parse(report.capturedAt)));
  if (report.selectedScenarios?.length === scenarioNames.length && (!combined || Date.parse(report.capturedAt) > Date.parse(combined.capturedAt))) combined = report;
  assert.equal(new Set(report.screenshots).size, report.screenshots.length);
  for (const scenario of report.selectedScenarios ?? ['overview'])
    assert(scenarioNames.includes(scenario));
  for (const name of report.screenshots) {
    assert.equal(path.basename(name), name, 'Capture names must remain within their directory');
    const bytes = fs.readFileSync(path.join(directory, name));
    assert(
      bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])),
      `Invalid PNG: ${name}`,
    );
    assert.equal(bytes.toString('ascii', 12, 16), 'IHDR');
    assert(bytes.readUInt32BE(16) > 0 && bytes.readUInt32BE(20) > 0);
    screenshots++;
  }
  reports++;
}
assert(combined, 'A complete combined workflow capture report is required');
assert.deepEqual(
  sorted(combined.selectedScenarios),
  sorted(scenarioNames),
  'Combined report must cover selectable scenarios',
);
assert(
  combined.source?.commit &&
    combined.source.captureScriptSha256 &&
    combined.source.scenarioModulesSha256,
);
console.log(
  JSON.stringify(
    {
      methods: methods.length,
      notifications: inventory.notifications.length,
      settingGroups: inventory.settingGroups.length,
      serviceSubsystems: inventory.serviceSubsystems.length,
      settings: settings.definitions.length,
      controlRoomSurfaces: labels.length + 1,
      captureReports: reports,
      referencedPngFiles: screenshots,
      combinedScenarios: combined.selectedScenarios.length,
      evidence:
        'Inventory/report/file integrity only; see documentation review for content and acceptance limits',
    },
    null,
    2,
  ),
);

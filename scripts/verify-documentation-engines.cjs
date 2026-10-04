// Use the established acceptance runner with new owned fixtures and reports.
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const assert = require('node:assert/strict');
assert.equal(
  process.platform,
  'win32',
  'This installed Unity/Unreal acceptance uses Windows tooling',
);
const directory = path.resolve('.artifacts/documentation-engines', String(Date.now()));
fs.mkdirSync(directory, { recursive: true });
const stages = ['compile-unreal', 'map-unreal', 'tests'];
const report = {
  schemaVersion: 1,
  startedAt: new Date().toISOString(),
  target:
    'Fresh disposable Unity/Unreal Projects via established real service/connector acceptance tooling',
  stages: [],
};
for (const stage of stages) {
  console.log(`Documentation engine acceptance: ${stage}; artifacts ${directory}`);
  const result = spawnSync(process.execPath, ['scripts/live-engine-acceptance.cjs', stage], {
    env: { ...process.env, GAMECRAFTER_ACCEPTANCE_OUTPUT: directory },
    windowsHide: true,
    encoding: 'utf8',
    timeout: 1800000,
  });
  fs.writeFileSync(
    path.join(directory, stage + '-runner.log'),
    (result.stdout ?? '') + (result.stderr ?? ''),
  );
  report.stages.push({ stage, exitCode: result.status, error: result.error?.message ?? null });
  fs.writeFileSync(
    path.join(directory, 'documentation-report.json'),
    JSON.stringify(report, null, 2) + '\n',
  );
  assert.equal(result.status, 0, `Inspect ${directory}/${stage}-runner.log`);
}
report.finishedAt = new Date().toISOString();
fs.writeFileSync(
  path.join(directory, 'documentation-report.json'),
  JSON.stringify(report, null, 2) + '\n',
);
console.log(JSON.stringify({ directory, ...report }, null, 2));

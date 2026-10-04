// Native Godot checks run only on a copy under .artifacts; never imports the tracked fixture.
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const assert = require('node:assert/strict');
const directory = path.resolve('.artifacts/documentation-native', String(Date.now()));
fs.mkdirSync(directory, { recursive: true });
fs.cpSync(path.resolve('docs/examples/lantern-workshop/game'), path.join(directory, 'game'), {
  recursive: true,
});
const command =
  process.env.GAMECRAFTER_DOC_GODOT ?? (process.platform === 'win32' ? 'wsl.exe' : 'godot');
const viaWsl = process.platform === 'win32' && path.basename(command).toLowerCase() === 'wsl.exe';
const nativePath = viaWsl
  ? '/mnt/' + directory[0].toLowerCase() + directory.slice(2).replaceAll('\\', '/') + '/game'
  : path.join(directory, 'game');
const checks = [];
function run(name, args) {
  const result = spawnSync(command, [...(viaWsl ? ['--exec', 'godot'] : []), ...args], {
    encoding: 'utf8',
    timeout: 120000,
    windowsHide: true,
  });
  fs.writeFileSync(
    path.join(directory, name + '.log'),
    (result.stdout ?? '') + (result.stderr ?? ''),
  );
  checks.push({
    name,
    exitCode: result.status,
    passed:
      result.status === 0 &&
      !/SCRIPT ERROR|Parse Error|FAIL /.test((result.stdout ?? '') + (result.stderr ?? '')),
    error: result.error?.message ?? null,
  });
  return result;
}
const version = run('version', ['--version']);
run('import', ['--headless', '--path', nativePath, '--editor', '--quit']);
run('gameplay', ['--headless', '--path', nativePath, '--script', 'res://acceptance.gd']);
const report = {
  schemaVersion: 1,
  checkedAt: new Date().toISOString(),
  engineVersion: version.stdout?.trim(),
  host: process.platform,
  viaWsl,
  target:
    'Copied Lantern Workshop native fixture; headless parse/import and gameplay assertions, no graphical rendering',
  checks,
};
fs.writeFileSync(path.join(directory, 'report.json'), JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify({ directory, ...report }, null, 2));
assert(
  checks.every((check) => check.passed),
  `Inspect native logs in ${directory}`,
);

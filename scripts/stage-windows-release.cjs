#!/usr/bin/env node
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { createHash } = require('node:crypto');
const root = path.resolve(__dirname, '..');
require('./change-tracking.cjs').check(root, { release: true });
const version = JSON.parse(
  fs.readFileSync(path.join(root, 'apps/control-room/package.json')),
).version;
const output = path.join(root, 'Windows-Release', version);
const source = path.join(root, 'apps/control-room/dist', version);
const unpacked = path.join(source, 'win-unpacked');
const installerName = `PlayWeld-${version}-x64.exe`;
const installer = path.join(source, installerName);
if (!fs.existsSync(installer)) throw new Error(`Missing installer: ${installer}`);
const check = spawnSync(
  process.execPath,
  [path.join(root, 'apps/control-room/scripts/verify-windows-native.cjs'), unpacked],
  { encoding: 'utf8', timeout: 30000 },
);
if (check.status !== 0)
  throw new Error(check.stderr || check.error?.message || 'Package verification failed.');
if (fs.existsSync(output))
  throw new Error(`Preserve existing build; staging destination already exists: ${output}`);
const revision = spawnSync('git', ['rev-parse', 'HEAD'], {
  cwd: root,
  encoding: 'utf8',
  timeout: 10000,
});
if (revision.status !== 0) throw new Error('Cannot determine source revision.');
const changed = spawnSync('git', ['diff', '--name-only', 'HEAD'], { cwd: root, encoding: 'utf8', timeout: 10000 });
const untracked = spawnSync('git', ['ls-files', '--others', '--exclude-standard'], { cwd: root, encoding: 'utf8', timeout: 10000 });
if (changed.status !== 0 || untracked.status !== 0) throw new Error('Cannot determine working-tree provenance.');
const changedPaths = [...new Set([...changed.stdout.trim().split(/\r?\n/), ...untracked.stdout.trim().split(/\r?\n/)].filter(Boolean))].sort();
const workingTree = changedPaths.map((file) => ({
  path: file,
  sha256: fs.existsSync(path.join(root, file)) ? createHash('sha256').update(fs.readFileSync(path.join(root, file))).digest('hex') : null,
}));
fs.mkdirSync(output, { recursive: true });
fs.cpSync(unpacked, path.join(output, 'app'), { recursive: true });
fs.copyFileSync(installer, path.join(output, installerName));
const launch = [
  '@echo off',
  `set "GAMECRAFTER_PROFILE_DIR=%LOCALAPPDATA%\\GameCrafter-Testing\\profiles\\${version}"`,
  `set "THEIA_CONFIG_DIR=%LOCALAPPDATA%\\GameCrafter-Testing\\config\\${version}"`,
  `start "" "%~dp0app\\GameCrafter.exe" "--user-data-dir=%LOCALAPPDATA%\\GameCrafter-Testing\\desktop\\${version}"`,
  '',
].join('\r\n');
fs.writeFileSync(path.join(output, 'Launch-PlayWeld-Test.cmd'), launch);
const sha256 = createHash('sha256').update(fs.readFileSync(installer)).digest('hex');
const provenance = {
  schemaVersion: 1,
  version,
  tag: `v${version}`,
  commit: revision.stdout.trim(),
  workingTreeDirty: workingTree.length > 0,
  workingTree,
  builtAt: new Date().toISOString(),
  platform: 'windows',
  arch: 'x64',
  installer: installerName,
  sha256,
  signing: 'unsigned unless separately verified',
  bundledSkills: 30,
  launcher: 'Launch-PlayWeld-Test.cmd',
};
fs.writeFileSync(path.join(output, 'local-build.json'), JSON.stringify(provenance, null, 2) + '\n');
fs.writeFileSync(path.join(output, 'SHA256SUMS.txt'), `${sha256}  ${installerName}\n`);
console.log(`Staged ${version}: ${output}`);

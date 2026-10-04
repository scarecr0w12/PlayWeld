#!/usr/bin/env node
const fs = require('node:fs');
const path = require('node:path');

const GiB = 1024 ** 3;
const day = 24 * 60 * 60 * 1000;

function regularDirectory(directory) {
  try {
    const stat = fs.lstatSync(directory);
    if (!stat.isDirectory() || stat.isSymbolicLink()) {
      throw new Error(`Refusing non-directory or linked cleanup root: ${directory}`);
    }
    return true;
  } catch (error) {
    if (error.code === 'ENOENT') return false;
    throw error;
  }
}

function pruneCache(
  root,
  { apply = false, maxBytes = 5 * GiB, maxAgeDays = 30, now = Date.now() } = {},
) {
  const parent = path.join(root, '.turbo');
  const directory = path.join(parent, 'cache');
  if (!regularDirectory(parent) || !regularDirectory(directory)) {
    return { beforeBytes: 0, afterBytes: 0, removedEntries: 0, skippedEntries: 0 };
  }
  const groups = new Map();
  let beforeBytes = 0;
  for (const name of fs.readdirSync(directory)) {
    const match = /^([a-f0-9]{16})(?:\.tar\.zst|-(?:meta|manifest)\.json)$/.exec(name);
    if (!match) continue;
    const file = path.join(directory, name);
    const stat = fs.lstatSync(file);
    if (!stat.isFile() || stat.isSymbolicLink()) continue;
    const entry = groups.get(match[1]) ?? { files: [], bytes: 0, modified: 0 };
    entry.files.push({ file, size: stat.size, mtimeMs: stat.mtimeMs });
    entry.bytes += stat.size;
    entry.modified = Math.max(entry.modified, stat.mtimeMs);
    beforeBytes += stat.size;
    groups.set(match[1], entry);
  }
  let afterBytes = beforeBytes;
  let removedEntries = 0;
  let skippedEntries = 0;
  for (const entry of [...groups.values()].sort((a, b) => a.modified - b.modified)) {
    // A grace window protects artifacts being produced by other Turbo invocations.
    if (now - entry.modified < 60 * 60 * 1000) continue;
    if (afterBytes <= maxBytes && now - entry.modified <= maxAgeDays * day) continue;
    if (apply) {
      try {
        const unchanged = entry.files.every(({ file, size, mtimeMs }) => {
          const stat = fs.lstatSync(file);
          return (
            stat.isFile() &&
            !stat.isSymbolicLink() &&
            stat.size === size &&
            stat.mtimeMs === mtimeMs
          );
        });
        if (!unchanged) {
          skippedEntries++;
          continue;
        }
        for (const { file, size } of entry.files) {
          fs.unlinkSync(file);
          afterBytes -= size;
        }
      } catch (error) {
        if (!['ENOENT', 'EBUSY', 'EPERM', 'EACCES'].includes(error.code)) throw error;
        skippedEntries++;
        continue;
      }
    }
    if (!apply) afterBytes -= entry.bytes;
    removedEntries++;
  }
  return { beforeBytes, afterBytes, removedEntries, skippedEntries };
}

// Artifact deletion is deliberately opt-in. Legacy .turbo evidence is never touched.
function pruneArtifacts(root, { apply = false, maxAgeDays = 30, now = Date.now() } = {}) {
  const directory = path.join(root, '.artifacts');
  const candidates = [];
  if (!regularDirectory(directory)) return candidates;
  function inspect(directory) {
    let bytes = 0;
    let modified = fs.lstatSync(directory).mtimeMs;
    for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
      const file = path.join(directory, entry.name);
      const stat = fs.lstatSync(file);
      if (stat.isSymbolicLink()) throw new Error(`Refusing linked artifact: ${file}`);
      modified = Math.max(modified, stat.mtimeMs);
      if (stat.isDirectory()) {
        const child = inspect(file);
        bytes += child.bytes;
        modified = Math.max(modified, child.modified);
      } else if (stat.isFile()) bytes += stat.size;
    }
    return { bytes, modified };
  }
  for (const suite of fs.readdirSync(directory, { withFileTypes: true })) {
    if (!suite.isDirectory() || suite.isSymbolicLink()) continue;
    const suiteDirectory = path.join(directory, suite.name);
    const runs = [];
    for (const run of fs.readdirSync(suiteDirectory, { withFileTypes: true })) {
      const match = /^(?:(?:browser|electron)-)?(\d{13})$/.exec(run.name);
      if (run.isDirectory() && !run.isSymbolicLink() && match) {
        runs.push({ directory: path.join(suiteDirectory, run.name), timestamp: Number(match[1]) });
      }
    }
    runs.sort((a, b) => b.timestamp - a.timestamp);
    for (const run of runs.slice(3)) {
      if (now - run.timestamp <= maxAgeDays * day) continue;
      const info = inspect(run.directory);
      if (now - info.modified <= maxAgeDays * day) continue;
      candidates.push({ directory: run.directory, bytes: info.bytes });
    }
  }
  if (apply)
    for (const candidate of candidates) fs.rmSync(candidate.directory, { recursive: true });
  return candidates;
}

function main(args) {
  const options = { apply: false };
  let artifacts = false;
  for (const arg of args) {
    if (arg === '--apply') options.apply = true;
    else if (arg === '--artifacts') artifacts = true;
    else if (/^--max-gib=\d+(?:\.\d+)?$/.test(arg))
      options.maxBytes = Number(arg.split('=')[1]) * GiB;
    else if (/^--max-age-days=\d+$/.test(arg)) options.maxAgeDays = Number(arg.split('=')[1]);
    else if (arg === '--help') {
      console.log(
        'Usage: npm run cache:prune -- [--apply] [--max-gib=5] [--max-age-days=30] [--artifacts]',
      );
      console.log(
        'Dry-run by default. Cache: oldest-first, 1-hour grace. Artifacts: opt-in, keep newest 3 runs per suite; stop smoke-test processes before applying. Legacy .turbo evidence is preserved.',
      );
      return;
    } else throw new Error(`Unknown option: ${arg}`);
  }
  const root = path.resolve(__dirname, '..');
  const result = pruneCache(root, options);
  console.log(
    `${options.apply ? 'Pruned' : 'Would prune'} ${result.removedEntries} cache entries: ${(result.beforeBytes / GiB).toFixed(2)} -> ${(result.afterBytes / GiB).toFixed(2)} GiB (${result.skippedEntries} skipped). Recent entries may exceed the budget.`,
  );
  if (artifacts) {
    const candidates = pruneArtifacts(root, options);
    for (const candidate of candidates)
      console.log(
        `${options.apply ? 'Removed' : 'Would remove'} ${path.relative(root, candidate.directory)}`,
      );
    console.log(
      `Artifact runs: ${candidates.length}; ${(candidates.reduce((sum, item) => sum + item.bytes, 0) / GiB).toFixed(2)} GiB.`,
    );
  }
}

module.exports = { pruneCache, pruneArtifacts };
if (require.main === module) {
  try {
    main(process.argv.slice(2));
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}

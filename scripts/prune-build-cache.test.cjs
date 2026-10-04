const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { pruneCache, pruneArtifacts } = require('./prune-build-cache.cjs');
const now = Date.now();
const day = 86400000;

function fixture(t) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'playweld-cache-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  return root;
}

function file(root, relative, ageDays, bytes = 10) {
  const target = path.join(root, relative);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, Buffer.alloc(bytes));
  const date = new Date(now - ageDays * day);
  fs.utimesSync(target, date, date);
  return target;
}

function entry(root, hash, ageDays) {
  return ['.tar.zst', '-meta.json', '-manifest.json'].map((suffix) =>
    file(root, `.turbo/cache/${hash}${suffix}`, ageDays),
  );
}

test('dry-run selects oldest complete cache groups without deleting anything', (t) => {
  const root = fixture(t);
  const old = entry(root, 'aaaaaaaaaaaaaaaa', 2);
  const newer = entry(root, 'bbbbbbbbbbbbbbbb', 1);
  const result = pruneCache(root, { now, maxBytes: 30 });
  assert.equal(result.beforeBytes, 60);
  assert.equal(result.afterBytes, 30);
  assert.equal(result.removedEntries, 1);
  assert([...old, ...newer].every((target) => fs.existsSync(target)));
  pruneCache(root, { now, maxBytes: 30, apply: true });
  assert(old.every((target) => !fs.existsSync(target)));
  assert(newer.every((target) => fs.existsSync(target)));
});

test('age retention removes expired cache even below the budget, but protects recent writes', (t) => {
  const root = fixture(t);
  const old = entry(root, 'aaaaaaaaaaaaaaaa', 31);
  const recent = entry(root, 'bbbbbbbbbbbbbbbb', 0);
  const result = pruneCache(root, { now, maxBytes: 1000, apply: true });
  assert.equal(result.afterBytes, 30);
  assert(old.every((target) => !fs.existsSync(target)));
  pruneCache(root, { now, maxBytes: 0, apply: true });
  assert(recent.every((target) => fs.existsSync(target)));
});

test('preserves unknown files, legacy evidence and profiles', (t) => {
  const root = fixture(t);
  entry(root, 'aaaaaaaaaaaaaaaa', 2);
  const preserved = [
    file(root, '.turbo/cache/custom-data.json', 31),
    file(root, '.turbo/documentation/report.json', 31),
    file(root, '.turbo/profile/state.sqlite', 31),
  ];
  pruneCache(root, { now, maxBytes: 0, apply: true });
  assert(preserved.every((target) => fs.existsSync(target)));
});

test('missing roots are harmless and linked cache roots are refused', (t) => {
  const root = fixture(t);
  assert.equal(pruneCache(root).removedEntries, 0);
  const outside = path.join(root, 'outside');
  fs.mkdirSync(outside);
  fs.mkdirSync(path.join(root, '.turbo'));
  fs.symlinkSync(
    outside,
    path.join(root, '.turbo/cache'),
    process.platform === 'win32' ? 'junction' : 'dir',
  );
  assert.throws(() => pruneCache(root, { apply: true }), /Refusing/);
});

test('a recent sidecar protects its entire cache group and linked files are untouched', (t) => {
  const root = fixture(t);
  const files = entry(root, 'aaaaaaaaaaaaaaaa', 31);
  fs.utimesSync(files[1], new Date(now), new Date(now));
  const outside = file(root, 'outside.json', 31);
  const linked = path.join(root, '.turbo/cache/bbbbbbbbbbbbbbbb-meta.json');
  // Directory junctions provide a cross-platform link without Windows file-link privileges.
  fs.symlinkSync(path.dirname(outside), linked, process.platform === 'win32' ? 'junction' : 'dir');
  pruneCache(root, { now, maxBytes: 0, apply: true });
  assert(files.every((target) => fs.existsSync(target)));
  assert(fs.lstatSync(linked).isSymbolicLink());
  assert(fs.existsSync(outside));
});

test('artifact retention preserves newest three runs, recent activity and non-run directories', (t) => {
  const root = fixture(t);
  const runs = [];
  for (const age of [40, 41, 42, 43, 44]) {
    const directory = `.artifacts/ui/${now - age * day}`;
    runs.push(file(root, `${directory}/report.json`, age));
    const date = new Date(now - age * day);
    fs.utimesSync(path.dirname(runs.at(-1)), date, date);
  }
  // An old run with recent activity must remain untouched.
  fs.utimesSync(runs[3], new Date(now), new Date(now));
  const profile = file(root, '.artifacts/ui/profile/state.sqlite', 50);
  const planned = pruneArtifacts(root, { now });
  assert.equal(planned.length, 1);
  assert(fs.existsSync(runs[4]));
  pruneArtifacts(root, { now, apply: true });
  assert(!fs.existsSync(runs[4]));
  assert(runs.slice(0, 4).every((target) => fs.existsSync(target)));
  assert(fs.existsSync(profile));
});

test('Electron build outputs exclude release dist while ordinary package outputs remain cached', () => {
  const rootConfig = require('../turbo.json');
  const appConfig = require('../apps/control-room/turbo.json');
  assert.deepEqual(rootConfig.tasks.build.outputs, ['lib/**', 'dist/**']);
  assert.deepEqual(appConfig.tasks.build.outputs, ['lib/**', 'src-gen/**']);
  assert(!rootConfig.globalDependencies?.includes('.agents/skills/**'));
});

test('artifact cleanup refuses linked content before deleting any candidates', (t) => {
  const root = fixture(t);
  let oldest;
  for (const age of [40, 41, 42, 43]) {
    oldest = file(root, `.artifacts/ui/${now - age * day}/report.json`, age);
    const date = new Date(now - age * day);
    fs.utimesSync(path.dirname(oldest), date, date);
  }
  const outside = path.join(root, 'outside');
  fs.mkdirSync(outside);
  fs.symlinkSync(
    outside,
    path.join(path.dirname(oldest), 'linked'),
    process.platform === 'win32' ? 'junction' : 'dir',
  );
  assert.throws(() => pruneArtifacts(root, { now, apply: true }), /Refusing linked artifact/);
  assert(fs.existsSync(oldest));
});

test('only authored bundled skills invalidate the service build, with default inputs preserved', () => {
  const config = require('../packages/platform-service/turbo.json');
  assert.deepEqual(config.tasks.test.dependsOn, ['build']);
  const source = fs.readFileSync(
    path.join(__dirname, '../packages/platform-service/src/skills/bundled-skill-names.ts'),
    'utf8',
  );
  const names = [...source.matchAll(/'([^']+)'/g)].map((match) => match[1]);
  assert.deepEqual(config.tasks.build.inputs, [
    '$TURBO_DEFAULT$',
    ...names.map((name) => `$TURBO_ROOT$/.agents/skills/${name}/**`),
  ]);
});

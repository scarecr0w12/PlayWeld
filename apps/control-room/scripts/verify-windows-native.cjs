const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const expectedVersion = JSON.parse(
  fs.readFileSync(path.join(__dirname, '..', 'package.json')),
).version;
const unpackedDir = process.argv[2]
  ? path.resolve(process.argv[2])
  : path.join(__dirname, '..', 'dist', expectedVersion, 'win-unpacked');
const appDir = path.join(unpackedDir, 'resources', 'app');
const appPackage = JSON.parse(fs.readFileSync(path.join(appDir, 'package.json'), 'utf8'));
const electronMain = 'lib/backend/electron-main.js';
if (appPackage.main !== electronMain || !fs.existsSync(path.join(appDir, electronMain))) {
  throw new Error(`Windows package must launch Theia's Electron main entry: ${electronMain}`);
}

const addonPath = path.join(
  appDir,
  'node_modules',
  'drivelist',
  'build',
  'Release',
  'drivelist.node',
);

if (!fs.existsSync(addonPath)) {
  throw new Error(`Windows drivelist native addon is missing: ${addonPath}`);
}

const header = Buffer.alloc(2);
const descriptor = fs.openSync(addonPath, 'r');
try {
  fs.readSync(descriptor, header, 0, header.length, 0);
} finally {
  fs.closeSync(descriptor);
}

if (header[0] !== 0x4d || header[1] !== 0x5a) {
  throw new Error(`Windows drivelist native addon is not a PE binary: ${addonPath}`);
}

process.stdout.write('Windows drivelist native addon verified.\n');

for (const nativePath of [
  path.join(unpackedDir, 'resources', 'qdrant', 'qdrant.exe'),
  path.join(appDir, 'node_modules', '@lancedb', 'lancedb-win32-x64-msvc', 'lancedb.win32-x64-msvc.node'),
]) {
  const bytes = fs.readFileSync(nativePath);
  const offset = bytes.readUInt32LE(0x3c);
  if (bytes.toString('ascii', 0, 2) !== 'MZ' || bytes.readUInt32LE(offset) !== 0x00004550 || bytes.readUInt16LE(offset + 4) !== 0x8664)
    throw new Error(`Vector storage native dependency must be Windows x64 PE: ${nativePath}`);
}
if (!fs.existsSync(path.join(unpackedDir, 'resources', 'qdrant', 'LICENSE')))
  throw new Error('Missing Qdrant redistribution license.');
process.stdout.write('Windows LanceDB and managed Qdrant native dependencies verified.\n');

if (appPackage.version !== expectedVersion)
  throw new Error('Packaged application version is stale.');
const serviceDir = path.join(appDir, 'node_modules', '@gamecrafter', 'platform-service');
const servicePackage = JSON.parse(fs.readFileSync(path.join(serviceDir, 'package.json')));
if (servicePackage.version !== expectedVersion)
  throw new Error('Packaged service version does not match the application.');
const serviceCli = path.join(serviceDir, 'lib', 'cli.js');
if (!fs.existsSync(serviceCli)) throw new Error(`Packaged service CLI is missing: ${serviceCli}`);
for (const runtime of ['mcp/external-ide-server.js', 'updates/installer-handoff.js']) {
  if (!fs.existsSync(path.join(serviceDir, 'lib', runtime)))
    throw new Error(`Packaged integration runtime is missing: ${runtime}`);
}
const isolationHelper = path.join(serviceDir, 'lib/plugins/isolation/AppContainerHost.exe');
const helperBytes = fs.readFileSync(isolationHelper);
if (helperBytes.toString('ascii', 0, 2) !== 'MZ')
  throw new Error('Packaged Windows isolation helper is not a native PE executable.');
const integrationRoot = path.join(serviceDir, 'lib/integrations');
for (const family of ['unity', 'unreal', 'godot']) {
  const authored = path.resolve(__dirname, '../../../integrations', family, 'PlayWeldEditor');
  const packaged = path.join(integrationRoot, family, 'PlayWeldEditor');
  for (const file of fs.readdirSync(authored, { recursive: true }).filter(file => fs.statSync(path.join(authored, file)).isFile())) {
    if (!fs.existsSync(path.join(packaged, file)) || !fs.readFileSync(path.join(authored, file)).equals(fs.readFileSync(path.join(packaged, file))))
      throw new Error(`Packaged editor source is missing or stale: ${family}/${file}`);
  }
}
process.stdout.write('Windows isolation, IDE/handoff runtimes and all editor bridge sources verified.\n');
const debugPackageDir = path.join(appDir, 'node_modules', 'debug');
const debugPackage = JSON.parse(fs.readFileSync(path.join(debugPackageDir, 'package.json'), 'utf8'));
const debugEntry = path.resolve(debugPackageDir, debugPackage.main ?? 'index.js');
if (!fs.existsSync(debugEntry))
  throw new Error(`Packaged dependency entry point is missing: ${debugEntry}`);
const { BUNDLED_SKILL_NAMES } = require(path.join(serviceDir, 'lib/skills/bundled-skill-names.js'));
const authoredRoot = path.resolve(__dirname, '../../../.agents/skills');
for (const name of BUNDLED_SKILL_NAMES) {
  for (const resource of ['SKILL.md', 'references/workflows.md']) {
    const packaged = path.join(serviceDir, 'lib/skills', name, resource);
    const authored = path.join(authoredRoot, name, resource);
    if (!fs.existsSync(packaged) || !fs.readFileSync(packaged).equals(fs.readFileSync(authored)))
      throw new Error(`Missing or stale bundled skill: ${name}/${resource}`);
  }
}
for (const name of ['LICENSE.GameCrafter.txt', 'NOTICE.GameCrafter.txt']) {
  if (!fs.existsSync(path.join(unpackedDir, 'resources', name)))
    throw new Error(`Missing distribution notice: ${name}`);
}
verifyPackagedServiceStartup(unpackedDir, serviceCli);
const isolationProbe = spawnSync(
  path.join(unpackedDir, 'GameCrafter.exe'),
  ['-e', `new (require(${JSON.stringify(path.join(serviceDir, 'lib/plugins/isolation/appcontainer-launcher.js'))}).AppContainerLauncher)().probe().then(report=>{console.log(JSON.stringify(report));process.exitCode=report.available?0:1}).catch(error=>{console.error(error.message);process.exitCode=1})`],
  { env: { ...process.env, ELECTRON_RUN_AS_NODE: '1' }, windowsHide: true, encoding: 'utf8', timeout: 30000 },
);
if (isolationProbe.status !== 0 || JSON.parse(isolationProbe.stdout.trim()).available !== true)
  throw new Error('Packaged Windows LPAC probe failed: ' + (isolationProbe.stderr || isolationProbe.error?.message || isolationProbe.stdout));
process.stdout.write('Actual packaged Electron Node-mode LPAC boundaries verified.\n');
process.stdout.write(
  `Packaged version ${expectedVersion}, service and ${BUNDLED_SKILL_NAMES.length} bundled skills verified.\n`,
);

function verifyPackagedServiceStartup(unpackedDir, serviceCli) {
  const executable = path.join(unpackedDir, 'GameCrafter.exe');
  const profileDir = fs.mkdtempSync(path.join(os.tmpdir(), 'playweld-packaged-service-'));
  const env = {
    PATH: process.env.PATH ?? '',
    SYSTEMROOT: process.env.SYSTEMROOT ?? '',
    WINDIR: process.env.WINDIR ?? '',
    TEMP: process.env.TEMP ?? os.tmpdir(),
    TMP: process.env.TMP ?? os.tmpdir(),
    APPDATA: process.env.APPDATA ?? '',
    LOCALAPPDATA: process.env.LOCALAPPDATA ?? '',
    USERPROFILE: process.env.USERPROFILE ?? os.homedir(),
    GAMECRAFTER_PROFILE_DIR: profileDir,
    ELECTRON_RUN_AS_NODE: '1',
  };
  const tokenPath = path.join(profileDir, 'service.token');
  const lockPath = path.join(profileDir, 'service.lock');
  const runCli = (command) =>
    spawnSync(executable, [serviceCli, command], {
      cwd: appDir,
      env,
      encoding: 'utf8',
      timeout: 45_000,
      windowsHide: true,
    });

  try {
    const start = runCli('start');
    if (start.error || start.status !== 0) {
      throw new Error(
        `Packaged platform service failed to start: ${start.stderr || start.error?.message || `exit ${start.status}`}`,
      );
    }
    if (!fs.existsSync(tokenPath) || !fs.existsSync(lockPath)) {
      throw new Error('Packaged platform service did not create its isolated token and lock files.');
    }
    const status = runCli('status');
    if (status.error || status.status !== 0 || !status.stdout.includes('running')) {
      throw new Error(
        `Packaged platform service status failed: ${status.stderr || status.error?.message || status.stdout}`,
      );
    }
    const stop = runCli('stop');
    if (stop.error || stop.status !== 0) {
      throw new Error(
        `Packaged platform service shutdown failed: ${stop.stderr || stop.error?.message || stop.stdout}`,
      );
    }
    if (fs.existsSync(lockPath)) throw new Error('Packaged platform service did not remove its lock.');
    process.stdout.write('Packaged platform-service startup and shutdown verified.\n');
  } finally {
    if (fs.existsSync(lockPath) && fs.existsSync(tokenPath)) runCli('stop');
    if (!fs.existsSync(lockPath)) fs.rmSync(profileDir, { recursive: true, force: true });
  }
}

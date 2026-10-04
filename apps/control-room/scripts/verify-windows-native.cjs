const fs = require('node:fs');
const path = require('node:path');

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
process.stdout.write(
  `Packaged version ${expectedVersion}, service and ${BUNDLED_SKILL_NAMES.length} bundled skills verified.\n`,
);

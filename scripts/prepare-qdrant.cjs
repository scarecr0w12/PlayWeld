const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const zlib = require('node:zlib');

const RELEASE = '1.19.1';
const RELEASE_URL = `https://github.com/qdrant/qdrant/releases/download/v${RELEASE}`;
const LICENSE_URL = `https://raw.githubusercontent.com/qdrant/qdrant/v${RELEASE}/LICENSE`;
const ASSETS = {
  'win32-x64': {
    name: 'qdrant-x86_64-pc-windows-msvc.zip',
    sha256: '9b6f69bd85f6abed4bc13f943099f55c6ffd55f5dd90388635320d8fbb569eb0',
    executable: 'qdrant.exe',
  },
  'linux-x64': {
    name: 'qdrant-x86_64-unknown-linux-gnu.tar.gz',
    sha256: 'eef986e769d4d3e806dd2d546e1b4ecdd416211e54d34b4ed764fac7c58e1085',
    executable: 'qdrant',
  },
};

async function main() {
  const target = ASSETS[`${process.platform}-${process.arch}`];
  assert(target, `Qdrant ${RELEASE} preparation is supported only on Windows x64 and Linux x64.`);

  const outputDirectory = path.resolve(__dirname, '../apps/control-room/resources/qdrant');
  const temporaryDirectory = await fs.mkdtemp(path.join(os.tmpdir(), 'playweld-qdrant-'));
  try {
    const archive = await download(`${RELEASE_URL}/${target.name}`);
    const actualHash = crypto.createHash('sha256').update(archive).digest('hex');
    assert.equal(actualHash, target.sha256, `SHA-256 verification failed for ${target.name}.`);

    const files = target.name.endsWith('.zip') ? extractZip(archive) : extractTarGzip(archive);
    const executable = files.get(target.executable);
    assert(executable?.length, `Archive did not contain ${target.executable}.`);
    let license = files.get('LICENSE') ?? files.get('LICENSE.txt');
    if (!license) license = await download(LICENSE_URL);
    assert(license.length > 0, 'Qdrant license file was empty.');

    await fs.mkdir(outputDirectory, { recursive: true });
    const stagedExecutable = path.join(temporaryDirectory, target.executable);
    const stagedLicense = path.join(temporaryDirectory, 'LICENSE');
    await fs.writeFile(stagedExecutable, executable);
    await fs.writeFile(stagedLicense, license);
    if (process.platform !== 'win32') await fs.chmod(stagedExecutable, 0o755);

    await fs.copyFile(stagedExecutable, path.join(outputDirectory, target.executable));
    await fs.copyFile(stagedLicense, path.join(outputDirectory, 'LICENSE'));
    if (process.platform !== 'win32') await fs.chmod(path.join(outputDirectory, target.executable), 0o755);
    console.log(`Prepared verified Qdrant ${RELEASE}: ${path.join(outputDirectory, target.executable)}`);
    console.log(`Packaged Qdrant license: ${path.join(outputDirectory, 'LICENSE')}`);
  } finally {
    await fs.rm(temporaryDirectory, { recursive: true, force: true });
  }
}

async function download(url) {
  const response = await fetch(url, { headers: { 'user-agent': 'PlayWeld-Qdrant-preparation' } });
  assert(response.ok, `Download failed (${response.status} ${response.statusText}): ${url}`);
  return Buffer.from(await response.arrayBuffer());
}

function extractTarGzip(archive) {
  const tar = zlib.gunzipSync(archive);
  const files = new Map();
  for (let offset = 0; offset + 512 <= tar.length; ) {
    const header = tar.subarray(offset, offset + 512);
    if (header.every((byte) => byte === 0)) break;
    const name = readTarString(header, 0, 100);
    const prefix = readTarString(header, 345, 155);
    const filename = prefix ? `${prefix}/${name}` : name;
    const sizeText = readTarString(header, 124, 12).trim();
    const size = sizeText ? Number.parseInt(sizeText, 8) : 0;
    assert(Number.isSafeInteger(size) && size >= 0, `Invalid tar entry size for ${filename}.`);
    const dataStart = offset + 512;
    const kind = String.fromCharCode(header[156] ?? 0);
    if ((kind === '\0' || kind === '0') && size > 0) {
      const basename = path.posix.basename(filename);
      if (basename === 'qdrant' || basename === 'LICENSE' || basename === 'LICENSE.txt')
        files.set(basename, Buffer.from(tar.subarray(dataStart, dataStart + size)));
    }
    offset = dataStart + Math.ceil(size / 512) * 512;
  }
  return files;
}

function extractZip(archive) {
  let end = -1;
  for (let offset = archive.length - 22; offset >= Math.max(0, archive.length - 65_557); offset -= 1) {
    if (archive.readUInt32LE(offset) === 0x06054b50) {
      end = offset;
      break;
    }
  }
  assert(end >= 0, 'Invalid Qdrant ZIP archive: end record not found.');
  const count = archive.readUInt16LE(end + 10);
  let offset = archive.readUInt32LE(end + 16);
  const files = new Map();

  for (let entry = 0; entry < count; entry += 1) {
    assert.equal(archive.readUInt32LE(offset), 0x02014b50, 'Invalid Qdrant ZIP directory entry.');
    const flags = archive.readUInt16LE(offset + 8);
    const method = archive.readUInt16LE(offset + 10);
    const compressedSize = archive.readUInt32LE(offset + 20);
    const uncompressedSize = archive.readUInt32LE(offset + 24);
    const nameLength = archive.readUInt16LE(offset + 28);
    const extraLength = archive.readUInt16LE(offset + 30);
    const commentLength = archive.readUInt16LE(offset + 32);
    const localOffset = archive.readUInt32LE(offset + 42);
    const name = archive.subarray(offset + 46, offset + 46 + nameLength).toString('utf8');
    const basename = path.posix.basename(name.replaceAll('\\', '/'));

    if (basename === 'qdrant.exe' || basename.toUpperCase() === 'LICENSE' || basename.toUpperCase() === 'LICENSE.TXT') {
      assert.equal(flags & 1, 0, `Encrypted Qdrant archive entry is not supported: ${name}`);
      assert.equal(archive.readUInt32LE(localOffset), 0x04034b50, `Invalid ZIP file header: ${name}`);
      const localNameLength = archive.readUInt16LE(localOffset + 26);
      const localExtraLength = archive.readUInt16LE(localOffset + 28);
      const dataStart = localOffset + 30 + localNameLength + localExtraLength;
      const compressed = archive.subarray(dataStart, dataStart + compressedSize);
      let data;
      if (method === 0) data = Buffer.from(compressed);
      else if (method === 8) data = zlib.inflateRawSync(compressed);
      else throw new Error(`Unsupported ZIP compression method ${method} for ${name}.`);
      assert.equal(data.length, uncompressedSize, `Invalid decompressed size for ${name}.`);
      const key = basename.toUpperCase() === 'LICENSE.TXT' ? 'LICENSE.txt' : basename;
      files.set(key, data);
    }

    offset += 46 + nameLength + extraLength + commentLength;
  }
  return files;
}

function readTarString(buffer, offset, length) {
  const value = buffer.subarray(offset, offset + length);
  const terminator = value.indexOf(0);
  return value.subarray(0, terminator < 0 ? value.length : terminator).toString('utf8');
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});

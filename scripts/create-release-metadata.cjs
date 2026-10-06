const { createPrivateKey, sign } = require('node:crypto');
const { createReadStream, readdirSync, readFileSync, statSync, writeFileSync } = require('node:fs');
const path = require('node:path');

async function sha256(filePath) {
  const { createHash } = require('node:crypto');
  const hash = createHash('sha256');
  for await (const chunk of createReadStream(filePath)) hash.update(chunk);
  return hash.digest('hex');
}

async function main() {
  const directory = path.resolve(process.argv[2] ?? 'release-artifacts');
  const signingKey = process.env.UPDATE_SIGNING_PRIVATE_KEY;
  const keyOption = process.argv.indexOf('--signing-key-file');
  const protectedKeyFile = keyOption === -1 ? undefined : process.argv[keyOption + 1];
  if (keyOption !== -1 && (!protectedKeyFile || protectedKeyFile.startsWith('--'))) throw new Error('--signing-key-file requires a protected key path.');
  if (signingKey && protectedKeyFile) throw new Error('Choose the configured CI key or a local protected key file, not both.');
  const tag = process.env.GITHUB_REF_NAME;
  const commit = process.env.GITHUB_SHA;
  if (!tag || !commit) throw new Error('GITHUB_REF_NAME and GITHUB_SHA are required.');
  const unsignedPrerelease =
    process.argv.includes('--allow-unsigned-prerelease') &&
    process.env.RELEASE_PRERELEASE === 'true';
  if (!signingKey && !protectedKeyFile && !unsignedPrerelease)
    throw new Error(
      'UPDATE_SIGNING_PRIVATE_KEY is required unless explicitly creating an unsigned testing prerelease.',
    );
  const key = protectedKeyFile ? await require('./release-signing-key.cjs').readProtectedSigningKey(protectedKeyFile) : signingKey ? createPrivateKey(signingKey.replace(/\\n/g, '\n')) : undefined;
  if (key && key.asymmetricKeyType !== 'ed25519')
    throw new Error('Release signing key must be Ed25519.');

  const { version } = JSON.parse(
    readFileSync(path.resolve('apps/control-room/package.json'), 'utf8'),
  );
  if (tag.replace(/^v/, '') !== version) {
    throw new Error(`Release tag ${tag} does not match application version ${version}.`);
  }

  const files = readdirSync(directory)
    .map((name) => ({ name, filePath: path.join(directory, name) }))
    .filter(
      ({ name, filePath }) =>
        statSync(filePath).isFile() &&
        (name.endsWith('.AppImage') || name.endsWith('.deb') || name.endsWith('.exe')),
    );
  const platforms = [];
  for (const file of files) {
    const lower = file.name.toLowerCase();
    const descriptor = lower.endsWith('.appimage')
      ? { os: 'linux', kind: 'appimage' }
      : lower.endsWith('.deb')
        ? { os: 'linux', kind: 'deb' }
        : lower.endsWith('.exe')
          ? { os: 'windows', kind: 'nsis' }
          : undefined;
    if (!descriptor) continue;
    platforms.push({
      ...descriptor,
      arch: 'x64',
      asset: file.name,
      sha256: await sha256(file.filePath),
    });
  }
  if (
    !platforms.some(({ os }) => os === 'linux') ||
    !platforms.some(({ os }) => os === 'windows')
  ) {
    throw new Error('Release artifacts must include Linux and Windows packages.');
  }

  const manifest = {
    schemaVersion: 1,
    version,
    tag,
    commit,
    builtAt: new Date().toISOString(),
    platforms,
    compatibility: {
      profileSchemaVersion: latestMigrationVersion(
        require('../packages/platform-service/lib/profile/migrations.js').profileMigrations,
      ),
      projectSchemaVersion: latestMigrationVersion(
        require('../packages/platform-service/lib/projects/migrations.js').projectMigrations,
      ),
      minUpgradeFromVersion: '0.1.0',
    },
    notes: key
      ? 'Signed release metadata.'
      : 'Unsigned testing prerelease. Checksums establish file integrity; publisher signature verification is unavailable.',
  };
  const manifestBytes = Buffer.from(`${JSON.stringify(manifest, null, 2)}\n`);
  const manifestPath = path.join(directory, 'gamecrafter-release.json');
  writeFileSync(manifestPath, manifestBytes);

  const checksums = [];
  for (const { name, filePath } of files.sort((left, right) =>
    left.name.localeCompare(right.name),
  )) {
    checksums.push(`${await sha256(filePath)}  ${name}`);
  }
  checksums.push(`${await sha256(manifestPath)}  gamecrafter-release.json`);
  const checksumBytes = Buffer.from(`${checksums.join('\n')}\n`);
  const checksumPath = path.join(directory, 'SHA256SUMS.txt');
  writeFileSync(checksumPath, checksumBytes);

  if (key) {
    writeFileSync(`${manifestPath}.sig`, `${sign(null, manifestBytes, key).toString('base64')}\n`);
    writeFileSync(`${checksumPath}.sig`, `${sign(null, checksumBytes, key).toString('base64')}\n`);
  } else {
    const { rmSync } = require('node:fs');
    for (const file of [`${manifestPath}.sig`, `${checksumPath}.sig`])
      rmSync(file, { force: true });
    process.stdout.write('Created checksum-verified unsigned testing prerelease metadata.\n');
  }
}

function latestMigrationVersion(migrations) {
  return migrations.reduce((latest, migration) => Math.max(latest, migration.id), 0);
}

main().catch((error) => {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
  process.exitCode = 1;
});

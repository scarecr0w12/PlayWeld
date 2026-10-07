import { spawnSync } from 'node:child_process';
import { generateKeyPairSync, verify } from 'node:crypto';
import { createRequire } from 'node:module';
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { parseChecksums } from './release-tools';

const root = path.resolve(__dirname, '../../../..');
const version = (
  JSON.parse(readFileSync(path.join(root, 'apps/control-room/package.json'), 'utf8')) as {
    version: string;
  }
).version;
const directories: string[] = [];
afterEach(() => {
  for (const dir of directories.splice(0)) rmSync(dir, { recursive: true, force: true });
});
function fixture() {
  const dir = mkdtempSync(path.join(tmpdir(), 'gc-release-cli-'));
  directories.push(dir);
  writeFileSync(path.join(dir, 'GameCrafter.exe'), 'fixture package bytes');
  writeFileSync(path.join(dir, 'GameCrafter.AppImage'), 'fixture Linux bytes');
  return dir;
}
function run(dir: string, overrides: NodeJS.ProcessEnv = {}, args: string[] = [], timeout = 15000) {
  return spawnSync(
    process.execPath,
    [path.join(root, 'scripts/create-release-metadata.cjs'), dir, ...args],
    {
      cwd: root,
      encoding: 'utf8',
      timeout,
      env: {
        ...process.env,
        UPDATE_SIGNING_PRIVATE_KEY: '',
        RELEASE_PRERELEASE: 'false',
        GITHUB_REF_NAME: `v${version}`,
        GITHUB_SHA: 'a'.repeat(40),
        ...overrides,
      },
    },
  );
}
describe('release metadata CLI', () => {
  it('uses a Windows protected local signing key without writing plaintext private material', async (context) => {
    if (process.platform !== 'win32') context.skip('Requires Windows DPAPI.');
    expect(
      process.env.SystemRoot,
      'Forward the Windows system environment to native tests.',
    ).toBeTruthy();
    const dir = fixture();
    const keyDir = path.join(dir, 'protected-key');
    const { generate, readProtectedSigningKey } = createRequire(__filename)(
      path.join(root, 'scripts/release-signing-key.cjs'),
    ) as {
      generate(directory: string): Promise<unknown>;
      readProtectedSigningKey(file: string): Promise<import('node:crypto').KeyObject>;
    };
    await generate(keyDir);
    const protectedPath = path.join(keyDir, 'release-private.dpapi');
    const key = await readProtectedSigningKey(protectedPath);
    const privatePem = key.export({ format: 'pem', type: 'pkcs8' }).toString();
    expect(readFileSync(protectedPath).includes(Buffer.from(privatePem))).toBe(false);
    const result = run(dir, {}, ['--signing-key-file', protectedPath], 60000);
    expect(result.status, result.stderr).toBe(0);
    expect(
      result.stdout + result.stderr + readFileSync(path.join(keyDir, 'key.json'), 'utf8'),
    ).not.toContain(privatePem);
    for (const name of ['gamecrafter-release.json', 'SHA256SUMS.txt'])
      expect(
        verify(
          null,
          readFileSync(path.join(dir, name)),
          readFileSync(path.join(keyDir, 'release-public.pem')),
          Buffer.from(readFileSync(path.join(dir, name + '.sig'), 'utf8').trim(), 'base64'),
        ),
      ).toBe(true);
    await expect(generate(keyDir)).rejects.toThrow(/never overwritten/);
  }, 120000);
  it('requires explicit unsigned prerelease authorization and matching tag', () => {
    const dir = fixture();
    expect(run(dir).status).not.toBe(0);
    expect(run(dir, {}, ['--allow-unsigned-prerelease']).status).not.toBe(0);
    expect(existsSync(path.join(dir, 'gamecrafter-release.json'))).toBe(false);
    expect(
      run(dir, { RELEASE_PRERELEASE: 'true', GITHUB_REF_NAME: 'v99.0.0' }, [
        '--allow-unsigned-prerelease',
      ]).status,
    ).not.toBe(0);
    expect(existsSync(path.join(dir, 'gamecrafter-release.json'))).toBe(false);
  });
  it('exports a complete unsigned fixture manifest, clears stale signatures and remains repeatable', () => {
    const dir = fixture();
    writeFileSync(path.join(dir, 'SHA256SUMS.txt.sig'), 'stale');
    writeFileSync(path.join(dir, 'gamecrafter-release.json.sig'), 'stale');
    for (let i = 0; i < 2; i++) {
      const result = run(dir, { RELEASE_PRERELEASE: 'true' }, ['--allow-unsigned-prerelease']);
      expect(result.stderr).toBe('');
      expect(result.status).toBe(0);
      const manifest = JSON.parse(
        readFileSync(path.join(dir, 'gamecrafter-release.json'), 'utf8'),
      ) as { version: string; platforms: unknown[]; notes: string };
      expect(manifest.version).toBe(version);
      expect(manifest.platforms).toHaveLength(2);
      expect(manifest.notes).toContain('Unsigned testing prerelease');
      expect([
        ...parseChecksums(readFileSync(path.join(dir, 'SHA256SUMS.txt'), 'utf8')).keys(),
      ]).toEqual(['GameCrafter.AppImage', 'GameCrafter.exe', 'gamecrafter-release.json']);
      expect(existsSync(path.join(dir, 'SHA256SUMS.txt.sig'))).toBe(false);
    }
  });
  it('signs manifest and checksums with Ed25519 and rejects incomplete platform artifacts', () => {
    const dir = fixture();
    const keys = generateKeyPairSync('ed25519');
    const key = keys.privateKey.export({ format: 'pem', type: 'pkcs8' }).toString();
    const result = run(dir, { UPDATE_SIGNING_PRIVATE_KEY: key });
    expect(result.status, result.stderr).toBe(0);
    for (const name of ['gamecrafter-release.json', 'SHA256SUMS.txt'])
      expect(
        verify(
          null,
          readFileSync(path.join(dir, name)),
          keys.publicKey,
          Buffer.from(readFileSync(path.join(dir, name + '.sig'), 'utf8').trim(), 'base64'),
        ),
      ).toBe(true);
    const incomplete = fixture();
    rmSync(path.join(incomplete, 'GameCrafter.AppImage'));
    expect(run(incomplete, { UPDATE_SIGNING_PRIVATE_KEY: key }).status).not.toBe(0);
    expect(existsSync(path.join(incomplete, 'gamecrafter-release.json'))).toBe(false);
  });
});

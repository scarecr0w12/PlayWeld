import { createHash, generateKeyPairSync } from 'node:crypto';
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  RpcError,
  RpcErrorCode,
  type ReleaseManifest,
  type ReleasePlatform,
} from '@gamecrafter/contracts';
import { Database } from '../db/database';
import { migrate } from '../db/migrator';
import { profileMigrations } from '../profile/migrations';
import { signContents } from './release-tools';
import { SqliteUpdateDismissalStore } from './update-dismissal-store';
import {
  UpdateService,
  evaluateUpdateCompatibility,
  selectUpdateAsset,
  type UpdatePlatform,
} from './update-service';
import { UpdateStore } from './update-store';

const NOW = '2026-09-30T00:00:00.000Z';
const CURRENT_VERSION = '0.1.0';
const MANIFEST_URL = 'https://updates.example/gamecrafter-release.json';
const ASSET_NAME = 'GameCrafter-1.2.3.AppImage';
const ASSET_URL = 'https://updates.example/GameCrafter-1.2.3.AppImage';
const ASSET_BYTES = 'gamecrafter-appimage-bytes';
const ASSET_SHA = createHash('sha256').update(ASSET_BYTES).digest('hex');

let directory: string;
let database: Database;
let store: UpdateStore;
let dismissals: SqliteUpdateDismissalStore;

beforeEach(() => {
  directory = mkdtempSync(path.join(tmpdir(), 'gc-update-service-'));
  database = Database.open(':memory:');
  migrate(database, profileMigrations);
  store = new UpdateStore(database, CURRENT_VERSION);
  dismissals = new SqliteUpdateDismissalStore(database);
});

afterEach(() => {
  database.close();
  rmSync(directory, { recursive: true, force: true });
});

function updatesDir(): string {
  return path.join(directory, 'updates');
}

function assetPath(): string {
  return path.join(updatesDir(), '1.2.3', ASSET_NAME);
}

function manifest(overrides: Partial<ReleaseManifest> = {}): ReleaseManifest {
  return {
    schemaVersion: 1,
    version: '1.2.3',
    tag: 'v1.2.3',
    commit: 'a'.repeat(40),
    builtAt: NOW,
    platforms: [
      { os: 'linux', arch: 'x64', asset: ASSET_NAME, sha256: ASSET_SHA, kind: 'appimage' },
    ],
    compatibility: {
      profileSchemaVersion: 11,
      projectSchemaVersion: 12,
      minUpgradeFromVersion: '0.1.0',
    },
    notes: 'Release notes',
    ...overrides,
  };
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

function bytesResponse(body: string, status = 200): Response {
  return new Response(body, { status });
}

type Route = () => Response | Promise<Response>;

function fetchStub(routes: Record<string, Route>): typeof fetch {
  return (async (input: RequestInfo | URL) => {
    const url =
      typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url;
    const route = routes[url];
    if (!route) throw new Error(`Unexpected fetch request: ${url}`);
    return route();
  }) as unknown as typeof fetch;
}

function releaseFetch(overrides: Partial<ReleaseManifest> = {}): typeof fetch {
  return fetchStub({
    [MANIFEST_URL]: () => jsonResponse(manifest(overrides)),
    [ASSET_URL]: () => bytesResponse(ASSET_BYTES),
  });
}

function createService(options: {
  fetch: typeof fetch;
  releasesUrl?: string;
  platform?: UpdatePlatform;
  currentVersion?: string;
  profileSchemaVersion?: number;
  projectSchemaVersion?: number;
  signaturePublicKeyPem?: string;
}): UpdateService {
  return new UpdateService({
    store,
    dismissals,
    currentVersion: options.currentVersion ?? CURRENT_VERSION,
    releasesUrl: options.releasesUrl ?? MANIFEST_URL,
    updatesDir: updatesDir(),
    profileSchemaVersion: options.profileSchemaVersion ?? 11,
    projectSchemaVersion: options.projectSchemaVersion ?? 12,
    platform: options.platform ?? { os: 'linux', arch: 'x64' },
    fetch: options.fetch,
    now: () => new Date(NOW),
    signaturePublicKeyPem: options.signaturePublicKeyPem,
  });
}

async function expectRpcRejection(promise: Promise<unknown>, code: number): Promise<void> {
  try {
    await promise;
  } catch (error) {
    expect(error).toBeInstanceOf(RpcError);
    expect((error as RpcError).code).toBe(code);
    return;
  }
  throw new Error('Expected the operation to reject with an RpcError');
}

function expectRpcError(action: () => unknown, code: number): void {
  try {
    action();
  } catch (error) {
    expect(error).toBeInstanceOf(RpcError);
    expect((error as RpcError).code).toBe(code);
    return;
  }
  throw new Error('Expected the operation to throw an RpcError');
}

describe('update asset selection', () => {
  const platforms: ReleasePlatform[] = [
    {
      os: 'linux',
      arch: 'x64',
      asset: 'GameCrafter-1.2.3.deb',
      sha256: 'b'.repeat(64),
      kind: 'deb',
    },
    { os: 'linux', arch: 'x64', asset: ASSET_NAME, sha256: ASSET_SHA, kind: 'appimage' },
    {
      os: 'windows',
      arch: 'x64',
      asset: 'GameCrafter-1.2.3-Setup.exe',
      sha256: 'c'.repeat(64),
      kind: 'nsis',
    },
  ];
  const assets = new Map([
    ['GameCrafter-1.2.3.deb', { url: 'https://updates.example/GameCrafter-1.2.3.deb', bytes: 10 }],
    [ASSET_NAME, { url: ASSET_URL, bytes: 20 }],
    [
      'GameCrafter-1.2.3-Setup.exe',
      { url: 'https://updates.example/GameCrafter-1.2.3-Setup.exe', bytes: 30 },
    ],
  ]);

  it('prefers the AppImage over the deb for linux/x64', () => {
    const selection = selectUpdateAsset(assets, platforms, { os: 'linux', arch: 'x64' });
    expect(selection.reason).toBeNull();
    expect(selection.asset).toEqual({
      name: ASSET_NAME,
      url: ASSET_URL,
      bytes: 20,
      sha256: ASSET_SHA,
      kind: 'appimage',
    });
  });

  it('reports platforms without a matching asset', () => {
    expect(selectUpdateAsset(assets, platforms, { os: 'windows', arch: 'arm64' })).toEqual({
      asset: null,
      reason: 'Release does not include an asset for windows/arm64',
    });
  });

  it('reports manifest entries that are not published as release assets', () => {
    expect(selectUpdateAsset(new Map(), platforms, { os: 'linux', arch: 'x64' })).toEqual({
      asset: null,
      reason: `Release asset "${ASSET_NAME}" is not published`,
    });
  });
});

describe('update compatibility', () => {
  it('accepts matching schema versions and a satisfied minimum upgrade version', () => {
    const compatibility = evaluateUpdateCompatibility({
      manifest: manifest(),
      currentVersion: CURRENT_VERSION,
      profileSchemaVersion: 11,
      projectSchemaVersion: 12,
      assetReason: null,
    });
    expect(compatibility).toEqual({ ok: true, reasons: [] });
  });

  it('accepts an older local schema that the release can migrate forward', () => {
    const compatibility = evaluateUpdateCompatibility({
      manifest: manifest(),
      currentVersion: CURRENT_VERSION,
      profileSchemaVersion: 10,
      projectSchemaVersion: 9,
      assetReason: null,
    });
    expect(compatibility.ok).toBe(true);
  });

  it('rejects local schema versions newer than the release', () => {
    const compatibility = evaluateUpdateCompatibility({
      manifest: manifest(),
      currentVersion: CURRENT_VERSION,
      profileSchemaVersion: 12,
      projectSchemaVersion: 13,
      assetReason: null,
    });
    expect(compatibility.ok).toBe(false);
    expect(compatibility.reasons).toEqual([
      'Profile schema version 12 is newer than release schema version 11',
      'Project schema version 13 is newer than release schema version 12',
    ]);
  });

  it('rejects a current version below minUpgradeFromVersion', () => {
    const compatibility = evaluateUpdateCompatibility({
      manifest: manifest({
        compatibility: {
          profileSchemaVersion: 11,
          projectSchemaVersion: 12,
          minUpgradeFromVersion: '0.2.0',
        },
      }),
      currentVersion: CURRENT_VERSION,
      profileSchemaVersion: 11,
      projectSchemaVersion: 12,
      assetReason: null,
    });
    expect(compatibility.ok).toBe(false);
    expect(compatibility.reasons).toEqual([
      'Upgrading requires version 0.2.0 or newer; current version is 0.1.0',
    ]);
  });

  it('includes the asset selection reason', () => {
    const compatibility = evaluateUpdateCompatibility({
      manifest: manifest(),
      currentVersion: CURRENT_VERSION,
      profileSchemaVersion: 11,
      projectSchemaVersion: 12,
      assetReason: 'Release does not include an asset for linux/x64',
    });
    expect(compatibility.ok).toBe(false);
    expect(compatibility.reasons).toEqual(['Release does not include an asset for linux/x64']);
  });
});

describe('UpdateService release checking', () => {
  it('checks a direct gamecrafter-release.json URL and selects the platform asset', async () => {
    const update = createService({ fetch: releaseFetch() });
    const state = await update.check();
    expect(state.schemaVersion).toBe(1);
    expect(state.channel).toBe('stable');
    expect(state.currentVersion).toBe(CURRENT_VERSION);
    expect(state.lastCheckedAt).toBe(NOW);
    expect(state.error).toBeNull();
    expect(state.compatibility).toEqual({ ok: true, reasons: [] });
    expect(state.available?.version).toBe('1.2.3');
    expect(state.available?.tag).toBe('v1.2.3');
    expect(state.available?.asset).toEqual({
      name: ASSET_NAME,
      url: ASSET_URL,
      bytes: 0,
      sha256: ASSET_SHA,
      kind: 'appimage',
    });
    expect(store.get().available?.version).toBe('1.2.3');
  });

  it('resolves the GitHub latest release and uses its asset URLs and sizes', async () => {
    const apiUrl = 'https://api.github.com/repos/example/GameCrafter/releases/latest';
    const manifestUrl =
      'https://github.com/example/GameCrafter/releases/download/v1.2.3/gamecrafter-release.json';
    const assetUrl =
      'https://github.com/example/GameCrafter/releases/download/v1.2.3/GameCrafter-1.2.3.AppImage';
    const update = createService({
      releasesUrl: apiUrl,
      fetch: fetchStub({
        [apiUrl]: () =>
          jsonResponse({
            tag_name: 'v1.2.3',
            assets: [
              { name: 'gamecrafter-release.json', browser_download_url: manifestUrl, size: 512 },
              { name: ASSET_NAME, browser_download_url: assetUrl, size: 4096 },
            ],
          }),
        [manifestUrl]: () => jsonResponse(manifest()),
      }),
    });
    const state = await update.check();
    expect(state.available?.asset.url).toBe(assetUrl);
    expect(state.available?.asset.bytes).toBe(4096);
    expect(state.available?.asset.sha256).toBe(ASSET_SHA);
  });

  it('reports an unavailable source and records the error state', async () => {
    const update = createService({
      fetch: fetchStub({ [MANIFEST_URL]: () => jsonResponse({ message: 'boom' }, 500) }),
    });
    await expectRpcRejection(update.check(), RpcErrorCode.UpdateSourceUnavailable);
    const state = store.get();
    expect(state.error).toContain('HTTP 500');
    expect(state.lastCheckedAt).toBe(NOW);
    expect(state.available).toBeNull();
  });

  it('rejects a GitHub release without a gamecrafter-release.json asset', async () => {
    const apiUrl = 'https://api.github.com/repos/example/GameCrafter/releases/latest';
    const update = createService({
      releasesUrl: apiUrl,
      fetch: fetchStub({
        [apiUrl]: () =>
          jsonResponse({
            tag_name: 'v1.2.3',
            assets: [
              {
                name: ASSET_NAME,
                browser_download_url: ASSET_URL,
                size: 4096,
              },
            ],
          }),
      }),
    });
    await expectRpcRejection(update.check(), RpcErrorCode.UpdateSourceUnavailable);
    expect(store.get().error).toContain('gamecrafter-release.json');
  });

  it('does not offer releases that are not newer than the current version', async () => {
    const update = createService({
      fetch: releaseFetch({ version: CURRENT_VERSION, tag: 'v0.1.0' }),
    });
    const state = await update.check();
    expect(state.available).toBeNull();
    expect(state.compatibility.ok).toBe(true);
    expect(state.error).toBeNull();
  });

  it('marks incompatible releases and refuses to download them', async () => {
    const update = createService({ fetch: releaseFetch(), profileSchemaVersion: 12 });
    const state = await update.check();
    expect(state.available).toBeNull();
    expect(state.compatibility.ok).toBe(false);
    expect(state.compatibility.reasons[0]).toContain('Profile schema version 12');
    await expectRpcRejection(update.download(), RpcErrorCode.UpdateIncompatible);
  });

  it('reports releases without an asset for the injected platform', async () => {
    const update = createService({
      fetch: releaseFetch(),
      platform: { os: 'windows', arch: 'arm64' },
    });
    const state = await update.check();
    expect(state.available).toBeNull();
    expect(state.compatibility.reasons).toContain(
      'Release does not include an asset for windows/arm64',
    );
  });
});

describe('UpdateService download', () => {
  it('downloads the selected asset, verifies SHA-256, and records the download', async () => {
    const update = createService({ fetch: releaseFetch() });
    await update.check();
    const state = await update.download();
    expect(state.downloaded).toEqual({
      version: '1.2.3',
      path: assetPath(),
      verified: { sha256: true, signature: 'unavailable' },
    });
    expect(readFileSync(assetPath(), 'utf8')).toBe(ASSET_BYTES);
    expect(readdirSync(path.dirname(assetPath()))).toEqual([ASSET_NAME]);
    const metadata = readdirSync(updatesDir()).find((name) => name.startsWith('verified-'))!;
    expect(JSON.parse(readFileSync(path.join(updatesDir(), metadata), 'utf8'))).toMatchObject({
      schemaVersion: 1,
      path: assetPath(),
      sha256: ASSET_SHA,
    });
    const rechecked = await update.check();
    expect(rechecked.downloaded?.path).toBe(assetPath());
  });

  it('rejects downloads without an available version or with a mismatched version', async () => {
    const update = createService({ fetch: releaseFetch() });
    await expectRpcRejection(update.download(), RpcErrorCode.InvalidParams);
    await update.check();
    await expectRpcRejection(update.download('9.9.9'), RpcErrorCode.InvalidParams);
  });

  it('rejects a SHA-256 mismatch and removes the partial file', async () => {
    const update = createService({
      fetch: fetchStub({
        [MANIFEST_URL]: () => jsonResponse(manifest()),
        [ASSET_URL]: () => bytesResponse('tampered bytes'),
      }),
    });
    await update.check();
    await expectRpcRejection(update.download(), RpcErrorCode.UpdateVerificationFailed);
    expect(existsSync(assetPath())).toBe(false);
    expect(readdirSync(path.dirname(assetPath()))).toEqual([]);
    expect(store.get().downloaded).toBeNull();
    expect(store.get().error).toContain('SHA-256');
  });

  it('reports a failing download source', async () => {
    const update = createService({
      fetch: fetchStub({
        [MANIFEST_URL]: () => jsonResponse(manifest()),
        [ASSET_URL]: () => bytesResponse('unavailable', 503),
      }),
    });
    await update.check();
    await expectRpcRejection(update.download(), RpcErrorCode.UpdateSourceUnavailable);
    expect(store.get().downloaded).toBeNull();
  });

  it('verifies a configured release signature and records it as verified', async () => {
    const keys = generateKeyPairSync('ed25519');
    const privateKey = keys.privateKey.export({ format: 'pem', type: 'pkcs8' }).toString();
    const publicKey = keys.publicKey.export({ format: 'pem', type: 'spki' }).toString();
    const checksums = `${ASSET_SHA}  ${ASSET_NAME}\n`;
    const signature = signContents(Buffer.from(checksums), privateKey);
    const update = createService({
      signaturePublicKeyPem: publicKey,
      fetch: fetchStub({
        [MANIFEST_URL]: () => jsonResponse(manifest()),
        [ASSET_URL]: () => bytesResponse(ASSET_BYTES),
        'https://updates.example/SHA256SUMS.txt': () => bytesResponse(checksums),
        'https://updates.example/SHA256SUMS.txt.sig': () => bytesResponse(signature),
      }),
    });
    await update.check();
    const state = await update.download();
    expect(state.downloaded?.verified).toEqual({ sha256: true, signature: 'verified' });
  });

  it('fails the download when a configured signature does not verify', async () => {
    const keys = generateKeyPairSync('ed25519');
    const otherKeys = generateKeyPairSync('ed25519');
    const privateKey = keys.privateKey.export({ format: 'pem', type: 'pkcs8' }).toString();
    const publicKey = otherKeys.publicKey.export({ format: 'pem', type: 'spki' }).toString();
    const checksums = `${ASSET_SHA}  ${ASSET_NAME}\n`;
    const signature = signContents(Buffer.from(checksums), privateKey);
    const update = createService({
      signaturePublicKeyPem: publicKey,
      fetch: fetchStub({
        [MANIFEST_URL]: () => jsonResponse(manifest()),
        [ASSET_URL]: () => bytesResponse(ASSET_BYTES),
        'https://updates.example/SHA256SUMS.txt': () => bytesResponse(checksums),
        'https://updates.example/SHA256SUMS.txt.sig': () => bytesResponse(signature),
      }),
    });
    await update.check();
    await expectRpcRejection(update.download(), RpcErrorCode.UpdateVerificationFailed);
    expect(existsSync(assetPath())).toBe(false);
    expect(store.get().downloaded).toBeNull();
    expect(store.get().error).toContain('signature');
  });

  it('rejects unsigned releases when a trusted signing key is configured', async () => {
    const keys = generateKeyPairSync('ed25519');
    const publicKey = keys.publicKey.export({ format: 'pem', type: 'spki' }).toString();
    const update = createService({
      signaturePublicKeyPem: publicKey,
      fetch: fetchStub({
        [MANIFEST_URL]: () => jsonResponse(manifest()),
        [ASSET_URL]: () => bytesResponse(ASSET_BYTES),
        'https://updates.example/SHA256SUMS.txt': () => bytesResponse('', 404),
        'https://updates.example/SHA256SUMS.txt.sig': () => bytesResponse('', 404),
      }),
    });
    await update.check();
    await expectRpcRejection(update.download(), RpcErrorCode.UpdateVerificationFailed);
    expect(existsSync(assetPath())).toBe(false);
    expect(readdirSync(path.dirname(assetPath()))).toEqual([]);
    expect(store.get().downloaded).toBeNull();
  });

  it('rejects unsafe asset names without writing outside the updates directory', async () => {
    const update = createService({
      fetch: fetchStub({
        [MANIFEST_URL]: () =>
          jsonResponse(
            manifest({
              platforms: [
                {
                  os: 'linux',
                  arch: 'x64',
                  asset: '../evil.AppImage',
                  sha256: ASSET_SHA,
                  kind: 'appimage',
                },
              ],
            }),
          ),
      }),
    });
    await update.check();
    await expectRpcRejection(update.download(), RpcErrorCode.InvalidParams);
    expect(existsSync(path.join(directory, 'evil.AppImage'))).toBe(false);
    expect(existsSync(updatesDir())).toBe(false);
  });
});

describe('UpdateService dismissal', () => {
  it('persists dismissed versions across service instances and hides them on later checks', async () => {
    const fetcher = releaseFetch();
    const first = createService({ fetch: fetcher });
    await first.check();
    expect(store.get().available?.version).toBe('1.2.3');
    const dismissed = first.dismiss('1.2.3');
    expect(dismissed.available).toBeNull();
    const second = createService({ fetch: fetcher });
    expect(second.getState().available).toBeNull();
    const checked = await second.check();
    expect(checked.available).toBeNull();
    expect(checked.compatibility.ok).toBe(true);
    expect(checked.error).toBeNull();
  });

  it('keeps other versions available when dismissing a different version', async () => {
    const update = createService({ fetch: releaseFetch() });
    await update.check();
    const state = update.dismiss('9.9.9');
    expect(state.available?.version).toBe('1.2.3');
  });
});

describe('UpdateService install and rollback', () => {
  it('retains the current verified package when a newer release reuses its asset filename', async () => {
    const first = createService({ fetch: releaseFetch() });
    await first.check();
    await first.download();
    const retained = assetPath();
    store = new UpdateStore(database, '1.2.3');
    const next = createService({
      currentVersion: '1.2.3',
      fetch: releaseFetch({ version: '2.0.0', tag: 'v2.0.0' }),
    });
    await next.check();
    const downloaded = await next.download();
    expect(downloaded.previous).toEqual({ version: '1.2.3', path: retained });
    expect(downloaded.downloaded?.path).toBe(path.join(updatesDir(), '2.0.0', ASSET_NAME));
    expect(readFileSync(retained, 'utf8')).toBe(ASSET_BYTES);
    expect(downloaded.currentVersion).toBe('1.2.3');
    expect(downloaded.schemaVersion).toBe(1);
    expect(Object.keys(downloaded.previous!)).toEqual(['version', 'path']);
  });
  it('returns manual install instructions without installing or recording state', async () => {
    const update = createService({ fetch: releaseFetch() });
    await update.check();
    await update.download();
    const result = update.install();
    expect(result.launched).toBe(false);
    expect(result.instructions).toContain(assetPath());
    expect(result.instructions).toContain('chmod +x');
    expect(result.instructions).toContain('does not replace the running installation');
    expect(store.get().currentVersion).toBe(CURRENT_VERSION);
    expect(store.get().previous).toBeNull();
  });

  it('refuses installation when compatibility changes after download', async () => {
    const update = createService({ fetch: releaseFetch() });
    await update.check();
    await update.download();
    store.save({ ...store.get(), compatibility: { ok: false, reasons: ['Schema mismatch'] } });
    expectRpcError(() => update.install(), RpcErrorCode.UpdateIncompatible);
  });

  it('refuses to install without a downloaded update or when the file is missing', async () => {
    const update = createService({ fetch: releaseFetch() });
    expectRpcError(() => update.install(), RpcErrorCode.UpdateNotDownloaded);
    await update.check();
    await update.download();
    rmSync(assetPath());
    expectRpcError(() => update.install(), RpcErrorCode.UpdateNotDownloaded);
  });

  it('returns rollback instructions for a recorded previous version', () => {
    const previousPath = path.join(directory, 'previous', 'GameCrafter-0.1.0.AppImage');
    mkdirSync(path.dirname(previousPath), { recursive: true });
    writeFileSync(previousPath, 'previous bytes');
    store.save({
      ...store.get(),
      currentVersion: CURRENT_VERSION,
      previous: { version: CURRENT_VERSION, path: previousPath },
    });
    const update = createService({ fetch: fetchStub({}) });
    const result = update.rollback();
    expect(result.launched).toBe(false);
    expect(result.instructions).toContain(CURRENT_VERSION);
    expect(result.instructions).toContain(previousPath);
  });

  it('refuses to roll back without a recorded previous version or when its file is missing', () => {
    const update = createService({ fetch: fetchStub({}) });
    expectRpcError(() => update.rollback(), RpcErrorCode.UpdateNotDownloaded);
    store.save({
      ...store.get(),
      currentVersion: CURRENT_VERSION,
      previous: { version: CURRENT_VERSION, path: path.join(directory, 'missing.AppImage') },
    });
    expectRpcError(() => update.rollback(), RpcErrorCode.UpdateNotDownloaded);
  });
});

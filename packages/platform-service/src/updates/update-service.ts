import { createHash } from 'node:crypto';
import {
  createWriteStream,
  existsSync,
  mkdirSync,
  readFileSync,
  renameSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import path from 'node:path';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import semver from 'semver';
import {
  compile,
  ReleaseManifestSchema,
  RpcError,
  RpcErrorCode,
  VerifiedUpdatePackageSchema,
  type VerifiedUpdatePackage,
  type DownloadedUpdate,
  type ReleaseManifest,
  type ReleasePlatform,
  type RpcResult,
  type UpdateAsset,
  type UpdateAvailable,
  type UpdateState,
} from '@gamecrafter/contracts';
import { parseChecksums, verifyContents } from './release-tools';
import type { UpdateDismissalStore } from './update-dismissal-store';
import type { UpdateStore } from './update-store';
import { prepareInstallerHandoff } from './installer-handoff';

const releaseManifestValidator = compile<ReleaseManifest>(ReleaseManifestSchema);
const packageValidator = compile<VerifiedUpdatePackage>(VerifiedUpdatePackageSchema);
const RELEASE_MANIFEST_ASSET = 'gamecrafter-release.json';
const CHECKSUMS_ASSET = 'SHA256SUMS.txt';
const CHECKSUMS_SIGNATURE_ASSET = 'SHA256SUMS.txt.sig';

type UpdateSignatureStatus = 'verified' | 'failed' | 'unavailable';

export type UpdatePlatformOs = 'linux' | 'windows';
export type UpdatePlatformArch = 'x64' | 'arm64';

export interface UpdatePlatform {
  os: UpdatePlatformOs;
  arch: UpdatePlatformArch;
}

export interface UpdateServiceOptions {
  store: UpdateStore;
  dismissals: UpdateDismissalStore;
  currentVersion: string;
  releasesUrl: string;
  updatesDir: string;
  profileSchemaVersion: number;
  projectSchemaVersion: number;
  platform: UpdatePlatform;
  fetch?: typeof fetch;
  now?: () => Date;
  signaturePublicKeyPem?: string;
}

export type UpdateInstallResult = RpcResult<'update/install'>;

export interface UpdateAssetSelection {
  asset: UpdateAsset | null;
  reason: string | null;
}

export interface UpdateCompatibilityStatus {
  ok: boolean;
  reasons: string[];
}

interface RemoteAsset {
  url: string;
  bytes: number;
}

interface ResolvedRelease {
  manifest: ReleaseManifest;
  assets: Map<string, RemoteAsset>;
}

interface GitHubAsset {
  name: string;
  url: string;
  bytes: number;
}

const KIND_PREFERENCE: Record<UpdatePlatformOs, ReleasePlatform['kind'][]> = {
  linux: ['appimage', 'deb'],
  windows: ['nsis'],
};

export function selectUpdateAsset(
  assets: Map<string, { url: string; bytes: number }>,
  platforms: ReleasePlatform[],
  platform: UpdatePlatform,
): UpdateAssetSelection {
  const candidates = platforms.filter(
    (entry) => entry.os === platform.os && entry.arch === platform.arch,
  );
  if (candidates.length === 0) {
    return {
      asset: null,
      reason: `Release does not include an asset for ${platform.os}/${platform.arch}`,
    };
  }
  const preference = KIND_PREFERENCE[platform.os];
  const selected = [...candidates].sort(
    (left, right) => preference.indexOf(left.kind) - preference.indexOf(right.kind),
  )[0]!;
  const source = assets.get(selected.asset);
  if (!source) {
    return { asset: null, reason: `Release asset "${selected.asset}" is not published` };
  }
  return {
    asset: {
      name: selected.asset,
      url: source.url,
      bytes: source.bytes,
      sha256: selected.sha256,
      kind: selected.kind,
    },
    reason: null,
  };
}

export function evaluateUpdateCompatibility(input: {
  manifest: ReleaseManifest;
  currentVersion: string;
  profileSchemaVersion: number;
  projectSchemaVersion: number;
  assetReason: string | null;
}): UpdateCompatibilityStatus {
  const reasons = input.assetReason === null ? [] : [input.assetReason];
  const compatibility = input.manifest.compatibility;
  if (input.profileSchemaVersion > compatibility.profileSchemaVersion) {
    reasons.push(
      `Profile schema version ${input.profileSchemaVersion} is newer than release schema version ${compatibility.profileSchemaVersion}`,
    );
  }
  if (input.projectSchemaVersion > compatibility.projectSchemaVersion) {
    reasons.push(
      `Project schema version ${input.projectSchemaVersion} is newer than release schema version ${compatibility.projectSchemaVersion}`,
    );
  }
  if (!semver.valid(input.manifest.version)) {
    reasons.push(`Release version "${input.manifest.version}" is not a valid semantic version`);
  }
  if (!semver.valid(input.currentVersion)) {
    reasons.push(`Current version "${input.currentVersion}" is not a valid semantic version`);
  }
  if (!semver.valid(compatibility.minUpgradeFromVersion)) {
    reasons.push(
      `Minimum upgrade version "${compatibility.minUpgradeFromVersion}" is not a valid semantic version`,
    );
  } else if (
    semver.valid(input.currentVersion) &&
    semver.lt(input.currentVersion, compatibility.minUpgradeFromVersion)
  ) {
    reasons.push(
      `Upgrading requires version ${compatibility.minUpgradeFromVersion} or newer; current version is ${input.currentVersion}`,
    );
  }
  return { ok: reasons.length === 0, reasons };
}

export class UpdateService {
  private readonly store: UpdateStore;
  private readonly dismissals: UpdateDismissalStore;
  private readonly currentVersion: string;
  private readonly releasesUrl: string;
  private readonly updatesDir: string;
  private readonly profileSchemaVersion: number;
  private readonly projectSchemaVersion: number;
  private readonly platform: UpdatePlatform;
  private readonly fetcher: typeof fetch;
  private readonly now: () => Date;
  private readonly signaturePublicKeyPem: string | undefined;

  constructor(options: UpdateServiceOptions) {
    this.store = options.store;
    this.dismissals = options.dismissals;
    this.currentVersion = options.currentVersion;
    this.releasesUrl = options.releasesUrl;
    this.updatesDir = options.updatesDir;
    this.profileSchemaVersion = options.profileSchemaVersion;
    this.projectSchemaVersion = options.projectSchemaVersion;
    this.platform = options.platform;
    this.fetcher = options.fetch ?? fetch;
    this.now = options.now ?? (() => new Date());
    this.signaturePublicKeyPem = options.signaturePublicKeyPem;
  }

  getState(): UpdateState {
    return this.store.get();
  }

  async check(): Promise<UpdateState> {
    const before = this.store.get();
    const checkedAt = this.now().toISOString();
    let resolved: ResolvedRelease;
    try {
      resolved = await this.resolveRelease();
    } catch (error) {
      const failure =
        error instanceof RpcError
          ? error
          : new RpcError(errorMessage(error), RpcErrorCode.UpdateSourceUnavailable);
      this.store.save({
        ...before,
        currentVersion: this.currentVersion,
        lastCheckedAt: checkedAt,
        error: failure.message,
      });
      throw failure;
    }
    const { manifest } = resolved;
    const selection = selectUpdateAsset(resolved.assets, manifest.platforms, this.platform);
    const compatibility = evaluateUpdateCompatibility({
      manifest,
      currentVersion: this.currentVersion,
      profileSchemaVersion: this.profileSchemaVersion,
      projectSchemaVersion: this.projectSchemaVersion,
      assetReason: selection.reason,
    });
    const isNewer = isNewerVersion(manifest.version, this.currentVersion);
    const dismissed = this.dismissals.list().includes(manifest.version);
    const available: UpdateAvailable | null =
      isNewer && compatibility.ok && selection.asset !== null && !dismissed
        ? {
            version: manifest.version,
            tag: manifest.tag,
            notes: manifest.notes,
            asset: selection.asset,
            manifest,
          }
        : null;
    const downloaded =
      before.downloaded && available && before.downloaded.version !== available.version
        ? null
        : before.downloaded;
    return this.store.save({
      ...before,
      currentVersion: this.currentVersion,
      lastCheckedAt: checkedAt,
      previous:
        available &&
        before.downloaded?.version === this.currentVersion &&
        this.verifiedPackage(before.downloaded.path)
          ? { version: before.downloaded.version, path: before.downloaded.path }
          : before.previous,
      available,
      downloaded,
      compatibility,
      error: null,
    });
  }

  async download(version?: string): Promise<UpdateState> {
    const current = this.store.get();
    if (!current.compatibility.ok) {
      throw new RpcError(
        `Update is not compatible: ${current.compatibility.reasons.join('; ')}`,
        RpcErrorCode.UpdateIncompatible,
      );
    }
    const available = current.available;
    if (!available) {
      throw new RpcError('No update is available to download', RpcErrorCode.InvalidParams);
    }
    if (version !== undefined && version !== available.version) {
      throw new RpcError(
        `Requested version ${version} does not match the available version ${available.version}`,
        RpcErrorCode.InvalidParams,
      );
    }
    const fileName = safeAssetName(available.asset.name);
    mkdirSync(this.updatesDir, { recursive: true, mode: 0o700 });
    const versionDirectory = path.join(this.updatesDir, available.version);
    mkdirSync(versionDirectory, { recursive: true, mode: 0o700 });
    const destination = path.join(versionDirectory, fileName);
    const temporary = `${destination}.part`;
    let hash: string;
    try {
      hash = await this.fetchAsset(available.asset.url, temporary);
    } catch (error) {
      rmSync(temporary, { force: true });
      const failure =
        error instanceof RpcError
          ? error
          : new RpcError(errorMessage(error), RpcErrorCode.UpdateSourceUnavailable);
      this.store.save({
        ...current,
        currentVersion: this.currentVersion,
        error: failure.message,
      });
      throw failure;
    }
    if (hash !== available.asset.sha256) {
      rmSync(temporary, { force: true });
      const message = `Downloaded update for version ${available.version} failed SHA-256 verification`;
      this.store.save({ ...current, currentVersion: this.currentVersion, error: message });
      throw new RpcError(message, RpcErrorCode.UpdateVerificationFailed);
    }
    const signature = await this.verifyReleaseSignature(available.asset);
    if (signature === 'failed') {
      rmSync(temporary, { force: true });
      const message = `Release signature verification failed for version ${available.version}`;
      this.store.save({ ...current, currentVersion: this.currentVersion, error: message });
      throw new RpcError(message, RpcErrorCode.UpdateVerificationFailed);
    }
    renameSync(temporary, destination);
    const downloaded: DownloadedUpdate = {
      version: available.version,
      path: destination,
      verified: { sha256: true, signature },
    };
    const packageRecord: VerifiedUpdatePackage = {
      schemaVersion: 1,
      version: available.version,
      path: destination,
      sha256: hash,
      verified: downloaded.verified,
    };
    writeFileSync(this.packageMetadataPath(destination), JSON.stringify(packageRecord, null, 2), {
      mode: 0o600,
    });
    return this.store.save({
      ...current,
      currentVersion: this.currentVersion,
      downloaded,
      previous:
        current.downloaded?.version === this.currentVersion &&
        this.verifiedPackage(current.downloaded.path)
          ? {
              version: current.downloaded.version,
              path: current.downloaded.path,
            }
          : current.previous,
      error: null,
    });
  }

  install(): UpdateInstallResult {
    const state = this.store.get();
    if (!state.compatibility.ok) {
      throw new RpcError(
        `Update is not compatible: ${state.compatibility.reasons.join('; ')}`,
        RpcErrorCode.UpdateIncompatible,
      );
    }
    const downloaded = state.downloaded;
    if (!downloaded) {
      throw new RpcError(
        'No downloaded update is ready to install',
        RpcErrorCode.UpdateNotDownloaded,
      );
    }
    if (!existsSync(downloaded.path)) {
      throw new RpcError(
        `Downloaded update file is missing: ${downloaded.path}`,
        RpcErrorCode.UpdateNotDownloaded,
      );
    }
    const verified = this.verifiedPackage(downloaded.path);
    const handoff =
      this.platform.os === 'windows' &&
      verified?.version === downloaded.version &&
      verified.verified.sha256 &&
      verified.verified.signature === 'verified'
        ? prepareInstallerHandoff(this.updatesDir, {
            path: downloaded.path,
            sha256: verified.sha256,
            version: downloaded.version,
          })
        : undefined;
    return {
      launched: false,
      instructions: installInstructions(downloaded.path),
      ...(handoff ? { handoff } : {}),
    };
  }

  rollback(): UpdateInstallResult {
    const previous = this.store.get().previous;
    if (!previous) {
      throw new RpcError(
        'No previous version is recorded for rollback',
        RpcErrorCode.UpdateNotDownloaded,
      );
    }
    if (!existsSync(previous.path)) {
      throw new RpcError(
        `Previous version file is missing: ${previous.path}`,
        RpcErrorCode.UpdateNotDownloaded,
      );
    }
    const verified = this.verifiedPackage(previous.path);
    return {
      launched: false,
      instructions: `Close PlayWeld, then reinstall version ${previous.version} from "${previous.path}". PlayWeld does not replace the running installation automatically.`,
      ...(this.platform.os === 'windows' &&
      verified?.version === previous.version &&
      verified.verified.sha256 &&
      verified.verified.signature === 'verified'
        ? {
            handoff: prepareInstallerHandoff(this.updatesDir, {
              path: previous.path,
              sha256: verified.sha256,
              version: previous.version,
            }),
          }
        : {}),
    };
  }

  private packageMetadataPath(filePath: string): string {
    return path.join(
      this.updatesDir,
      `verified-${createHash('sha256').update(path.resolve(filePath)).digest('hex')}.json`,
    );
  }

  private verifiedPackage(filePath: string): VerifiedUpdatePackage | null {
    const metadata = this.packageMetadataPath(filePath);
    if (!existsSync(metadata)) return null;
    const record = packageValidator.assert(JSON.parse(readFileSync(metadata, 'utf8')));
    if (path.resolve(record.path) !== path.resolve(filePath))
      throw new RpcError(
        'Cached package verification path differs from its recorded installer.',
        RpcErrorCode.UpdateVerificationFailed,
      );
    return record;
  }

  dismiss(version: string): UpdateState {
    if (version.length === 0) {
      throw new RpcError('A version is required to dismiss an update', RpcErrorCode.InvalidParams);
    }
    this.dismissals.add(version);
    const current = this.store.get();
    const available = current.available?.version === version ? null : current.available;
    return this.store.save({ ...current, currentVersion: this.currentVersion, available });
  }

  private async resolveRelease(): Promise<ResolvedRelease> {
    const body = await this.fetchJson(this.releasesUrl);
    if (releaseManifestValidator.check(body)) {
      return {
        manifest: body,
        assets: new Map(
          body.platforms.map((platform) => [
            platform.asset,
            { url: resolveAssetUrl(platform.asset, this.releasesUrl), bytes: 0 },
          ]),
        ),
      };
    }
    const assets = parseGitHubAssets(body);
    const manifestAsset = assets.find((asset) => asset.name === RELEASE_MANIFEST_ASSET);
    if (!manifestAsset) {
      throw new RpcError(
        `GitHub release does not include ${RELEASE_MANIFEST_ASSET}`,
        RpcErrorCode.UpdateSourceUnavailable,
      );
    }
    const manifestBody = await this.fetchJson(manifestAsset.url);
    if (!releaseManifestValidator.check(manifestBody)) {
      throw new RpcError(
        `${RELEASE_MANIFEST_ASSET} is not a valid release manifest`,
        RpcErrorCode.UpdateSourceUnavailable,
      );
    }
    return {
      manifest: manifestBody,
      assets: new Map(assets.map((asset) => [asset.name, { url: asset.url, bytes: asset.bytes }])),
    };
  }

  private async fetchJson(url: string): Promise<unknown> {
    const response = await this.request(url, 'application/json');
    try {
      return await response.json();
    } catch {
      throw new RpcError(
        `Update source returned invalid JSON: ${url}`,
        RpcErrorCode.UpdateSourceUnavailable,
      );
    }
  }

  private async request(url: string, accept: string): Promise<Response> {
    let response: Response;
    try {
      response = await this.fetcher(url, {
        headers: { accept, 'user-agent': 'gamecrafter-platform-service' },
      });
    } catch (error) {
      throw new RpcError(
        `Update source request failed: ${errorMessage(error)}`,
        RpcErrorCode.UpdateSourceUnavailable,
      );
    }
    if (!response.ok) {
      throw new RpcError(
        `Update source request failed with HTTP ${response.status}: ${url}`,
        RpcErrorCode.UpdateSourceUnavailable,
      );
    }
    return response;
  }

  private async fetchAsset(url: string, destination: string): Promise<string> {
    const response = await this.request(url, 'application/octet-stream');
    if (!response.body) {
      throw new RpcError(
        `Update download returned an empty body: ${url}`,
        RpcErrorCode.UpdateSourceUnavailable,
      );
    }
    const hash = createHash('sha256');
    const body = Readable.fromWeb(response.body as import('node:stream/web').ReadableStream);
    body.on('data', (chunk: Buffer) => hash.update(chunk));
    try {
      await pipeline(body, createWriteStream(destination, { mode: 0o600 }));
    } catch (error) {
      throw new RpcError(
        `Failed to write downloaded update: ${errorMessage(error)}`,
        RpcErrorCode.UpdateSourceUnavailable,
      );
    }
    return hash.digest('hex');
  }

  private async verifyReleaseSignature(asset: UpdateAsset): Promise<UpdateSignatureStatus> {
    const publicKeyPem = this.signaturePublicKeyPem;
    if (publicKeyPem === undefined) return 'unavailable';
    const checksums = await this.tryFetchText(new URL(CHECKSUMS_ASSET, asset.url).toString());
    const signature = await this.tryFetchText(
      new URL(CHECKSUMS_SIGNATURE_ASSET, asset.url).toString(),
    );
    if (checksums === null || signature === null) return 'failed';
    let verified = false;
    try {
      verified = verifyContents(
        new TextEncoder().encode(checksums),
        signature.trim(),
        publicKeyPem,
      );
    } catch {
      verified = false;
    }
    if (!verified) return 'failed';
    let entries: Map<string, string>;
    try {
      entries = parseChecksums(checksums);
    } catch {
      return 'failed';
    }
    const urlName = path.posix.basename(new URL(asset.url).pathname);
    const checksum = entries.get(asset.name) ?? entries.get(urlName);
    return checksum === asset.sha256 ? 'verified' : 'failed';
  }

  private async tryFetchText(url: string): Promise<string | null> {
    try {
      const response = await this.fetcher(url, {
        headers: { accept: 'text/plain', 'user-agent': 'gamecrafter-platform-service' },
      });
      if (!response.ok) return null;
      return await response.text();
    } catch {
      return null;
    }
  }
}

function isNewerVersion(next: string, current: string): boolean {
  return semver.valid(next) !== null && semver.valid(current) !== null && semver.gt(next, current);
}

function resolveAssetUrl(name: string, base: string): string {
  try {
    return new URL(name, base).toString();
  } catch {
    throw new RpcError(
      `Release manifest contains an invalid asset path: ${name}`,
      RpcErrorCode.UpdateSourceUnavailable,
    );
  }
}

function parseGitHubAssets(body: unknown): GitHubAsset[] {
  const assets =
    typeof body === 'object' && body !== null ? (body as { assets?: unknown }).assets : undefined;
  if (!Array.isArray(assets)) {
    throw new RpcError(
      'Update source is neither a release manifest nor a GitHub release',
      RpcErrorCode.UpdateSourceUnavailable,
    );
  }
  const parsed: GitHubAsset[] = [];
  for (const entry of assets) {
    if (typeof entry !== 'object' || entry === null) continue;
    const asset = entry as { name?: unknown; browser_download_url?: unknown; size?: unknown };
    if (typeof asset.name !== 'string' || typeof asset.browser_download_url !== 'string') continue;
    const bytes =
      typeof asset.size === 'number' && Number.isInteger(asset.size) && asset.size >= 0
        ? asset.size
        : 0;
    parsed.push({ name: asset.name, url: asset.browser_download_url, bytes });
  }
  return parsed;
}

function safeAssetName(name: string): string {
  const base = path.basename(name);
  if (
    name.length === 0 ||
    base !== name ||
    base === '.' ||
    base === '..' ||
    name.includes('\\') ||
    name.includes('\0')
  ) {
    throw new RpcError(`Unsafe release asset name: ${name}`, RpcErrorCode.InvalidParams);
  }
  return base;
}

function installInstructions(filePath: string): string {
  const lower = filePath.toLowerCase();
  if (lower.endsWith('.appimage')) {
    return `Close PlayWeld, then run:\nchmod +x "${filePath}"\n"${filePath}"\nPlayWeld does not replace the running installation automatically.`;
  }
  if (lower.endsWith('.deb')) {
    return `Close PlayWeld, then install the package:\nsudo apt install "${filePath}"\nPlayWeld does not install packages automatically.`;
  }
  if (lower.endsWith('.exe')) {
    return `Close PlayWeld, then open "${filePath}" to start the installer. PlayWeld does not run installers automatically.`;
  }
  return `Close PlayWeld, then open "${filePath}" to install the downloaded update. PlayWeld does not run installers automatically.`;
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

import { createHash, createHmac, randomUUID } from 'node:crypto';
import { createReadStream, statSync } from 'node:fs';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { tmpdir } from 'node:os';
import { Readable } from 'node:stream';
import type { BackupArchiveEntry, BackupDestinationConfig } from '@gamecrafter/contracts';
import {
  assertArchiveName,
  type BackupDestinationAdapter,
  type BackupProgress,
} from './destination';

export class S3BackupDestination implements BackupDestinationAdapter {
  readonly kind = 's3' as const;
  private readonly config: Extract<BackupDestinationConfig, { bucket: string }>;
  private readonly accessKeyId: string;
  private readonly secretAccessKey: string;
  private readonly sessionToken?: string;
  private readonly fetcher: typeof fetch;

  constructor(
    config: BackupDestinationConfig,
    secrets: Record<string, string>,
    fetcher: typeof fetch = fetch,
  ) {
    if (!('bucket' in config) || !('region' in config))
      throw new Error('Invalid S3 destination config');
    if (!secrets.accessKeyId || !secrets.secretAccessKey) {
      throw new Error('S3 access key credentials are required');
    }
    this.config = config as Extract<BackupDestinationConfig, { bucket: string }>;
    this.accessKeyId = secrets.accessKeyId;
    this.secretAccessKey = secrets.secretAccessKey;
    this.sessionToken = secrets.sessionToken;
    this.fetcher = fetcher;
  }

  async put(
    archiveName: string,
    sourceFilePath: string,
    onProgress?: BackupProgress,
    signal?: AbortSignal,
  ): Promise<{ bytes: number }> {
    assertArchiveName(archiveName);
    const payloadHash = await hashFile(sourceFilePath, signal);
    const fileStat = statSync(sourceFilePath);
    const source = createReadStream(sourceFilePath, { signal });
    let transferred = 0;
    source.on('data', (chunk) => {
      transferred += Buffer.isBuffer(chunk) ? chunk.length : Buffer.byteLength(chunk);
      onProgress?.(transferred);
    });
    const response = await this.request('PUT', this.objectUrl(archiveName), payloadHash, {
      body: Readable.toWeb(source) as ReadableStream<Uint8Array>,
      signal,
      duplex: 'half',
    });
    await requireSuccess(response, [200, 201, 204]);
    return { bytes: fileStat.size };
  }

  async get(archiveName: string, signal?: AbortSignal): Promise<Readable> {
    assertArchiveName(archiveName);
    const response = await this.request('GET', this.objectUrl(archiveName), emptyHash(), {
      signal,
    });
    await requireSuccess(response, [200]);
    if (!response.body) throw new Error('S3 response has no body');
    return Readable.fromWeb(response.body as import('node:stream/web').ReadableStream);
  }

  async list(signal?: AbortSignal): Promise<BackupArchiveEntry[]> {
    const prefix = normalizePrefix(this.config.prefix);
    const query: Array<[string, string]> = [
      ['list-type', '2'],
      ['prefix', prefix ? `${prefix}/` : ''],
    ];
    const url = this.bucketUrl(query);
    const response = await this.request('GET', url, emptyHash(), { signal });
    await requireSuccess(response, [200]);
    const xml = await response.text();
    const entries: BackupArchiveEntry[] = [];
    for (const match of xml.matchAll(/<Contents>([\s\S]*?)<\/Contents>/g)) {
      const block = match[1] ?? '';
      const key = xmlValue(block, 'Key');
      const bytes = Number(xmlValue(block, 'Size'));
      if (!key || !key.endsWith('.gcbackup') || !Number.isSafeInteger(bytes) || bytes < 0) continue;
      const prefixSlash = prefix ? `${prefix}/` : '';
      const archiveName = key.startsWith(prefixSlash) ? key.slice(prefixSlash.length) : key;
      if (!archiveName.includes('/')) {
        entries.push({
          archiveName,
          bytes,
          modifiedAt: parseDate(xmlValue(block, 'LastModified')),
        });
      }
    }
    return entries;
  }

  async delete(archiveName: string, signal?: AbortSignal): Promise<void> {
    assertArchiveName(archiveName);
    const response = await this.request('DELETE', this.objectUrl(archiveName), emptyHash(), {
      signal,
    });
    await requireSuccess(response, [200, 204]);
  }

  async probe(): Promise<void> {
    const directory = await mkdtemp(path.join(tmpdir(), 'gc-backup-s3-probe-'));
    const sourcePath = path.join(directory, 'probe.bin');
    const archiveName = `probe-${randomUUID()}.gcbackup`;
    const expected = Buffer.alloc(1024, 0x53);
    let uploaded = false;
    try {
      await writeFile(sourcePath, expected);
      await this.put(archiveName, sourcePath);
      uploaded = true;
      const response = await this.get(archiveName);
      const chunks: Buffer[] = [];
      for await (const chunk of response) chunks.push(Buffer.from(chunk));
      if (!Buffer.concat(chunks).equals(expected)) throw new Error('S3 probe did not round-trip');
    } finally {
      if (uploaded) await this.delete(archiveName);
      await rm(directory, { recursive: true, force: true });
    }
  }

  private async request(
    method: string,
    url: URL,
    payloadHash: string,
    options: { body?: ReadableStream<Uint8Array>; signal?: AbortSignal; duplex?: 'half' } = {},
  ): Promise<Response> {
    const now = new Date();
    const amzDate = now.toISOString().replace(/[:-]|\.\d{3}/g, '');
    const date = amzDate.slice(0, 8);
    const headers = new Headers({
      'x-amz-content-sha256': payloadHash,
      'x-amz-date': amzDate,
    });
    if (this.sessionToken) headers.set('x-amz-security-token', this.sessionToken);
    const canonicalHeaders =
      [
        `host:${url.host.toLowerCase()}`,
        `x-amz-content-sha256:${payloadHash}`,
        `x-amz-date:${amzDate}`,
        ...(this.sessionToken ? [`x-amz-security-token:${this.sessionToken.trim()}`] : []),
      ].join('\n') + '\n';
    const signedHeaders = this.sessionToken
      ? 'host;x-amz-content-sha256;x-amz-date;x-amz-security-token'
      : 'host;x-amz-content-sha256;x-amz-date';
    const canonicalRequest = [
      method,
      canonicalUri(url.pathname),
      canonicalQuery(url.searchParams),
      canonicalHeaders,
      signedHeaders,
      payloadHash,
    ].join('\n');
    const scope = `${date}/${this.config.region}/s3/aws4_request`;
    const stringToSign = [
      'AWS4-HMAC-SHA256',
      amzDate,
      scope,
      createHash('sha256').update(canonicalRequest).digest('hex'),
    ].join('\n');
    const signingKey = deriveSigningKey(this.secretAccessKey, date, this.config.region);
    const signature = createHmac('sha256', signingKey).update(stringToSign).digest('hex');
    headers.set(
      'authorization',
      `AWS4-HMAC-SHA256 Credential=${this.accessKeyId}/${scope}, SignedHeaders=${signedHeaders}, Signature=${signature}`,
    );
    const init: RequestInit & { duplex?: 'half' } = {
      method,
      headers,
      ...(options.body ? { body: options.body, duplex: options.duplex } : {}),
      ...(options.signal ? { signal: options.signal } : {}),
    };
    return this.fetcher(url, init);
  }

  private bucketUrl(query: Array<[string, string]> = []): URL {
    const endpoint = new URL(
      this.config.endpoint ?? `https://s3.${this.config.region}.amazonaws.com`,
    );
    const forcePathStyle = this.config.forcePathStyle ?? Boolean(this.config.endpoint);
    if (!forcePathStyle) endpoint.hostname = `${this.config.bucket}.${endpoint.hostname}`;
    const bucketPath = forcePathStyle ? `/${encodePath(this.config.bucket)}` : '';
    const basePath = endpoint.pathname.replace(/\/$/, '');
    endpoint.pathname = `${basePath}${bucketPath}` || '/';
    endpoint.search = canonicalQuery(new URLSearchParams(query));
    return endpoint;
  }

  private objectUrl(archiveName: string): URL {
    const url = this.bucketUrl();
    const prefix = normalizePrefix(this.config.prefix);
    if (prefix) url.pathname += `/${encodePath(prefix)}`;
    url.pathname += `/${encodePath(archiveName)}`;
    return url;
  }
}

function normalizePrefix(prefix: string | undefined): string {
  return (prefix ?? '').trim().replace(/^[/]+|[/]+$/g, '');
}

function deriveSigningKey(secret: string, date: string, region: string): Buffer {
  const dateKey = createHmac('sha256', `AWS4${secret}`).update(date).digest();
  const regionKey = createHmac('sha256', dateKey).update(region).digest();
  const serviceKey = createHmac('sha256', regionKey).update('s3').digest();
  return createHmac('sha256', serviceKey).update('aws4_request').digest();
}

function canonicalUri(pathname: string): string {
  return pathname
    .split('/')
    .map((segment) => encodePath(decodeURIComponentSafe(segment)))
    .join('/');
}

function canonicalQuery(searchParams: URLSearchParams): string {
  return [...searchParams.entries()]
    .map(([key, value]) => [awsEncode(key), awsEncode(value)] as const)
    .sort(([leftKey, leftValue], [rightKey, rightValue]) =>
      leftKey === rightKey ? leftValue.localeCompare(rightValue) : leftKey.localeCompare(rightKey),
    )
    .map(([key, value]) => `${key}=${value}`)
    .join('&');
}

function encodePath(value: string): string {
  return value.split('/').map(awsEncode).join('/');
}

function awsEncode(value: string): string {
  return encodeURIComponent(value).replace(
    /[!'()*]/g,
    (character) => `%${character.charCodeAt(0).toString(16).toUpperCase()}`,
  );
}

function decodeURIComponentSafe(value: string): string {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

async function hashFile(filePath: string, signal?: AbortSignal): Promise<string> {
  const hash = createHash('sha256');
  for await (const chunk of createReadStream(filePath, { signal })) hash.update(chunk);
  return hash.digest('hex');
}

async function requireSuccess(response: Response, statuses: number[]): Promise<void> {
  if (statuses.includes(response.status)) return;
  await response.body?.cancel();
  throw new Error(`S3 destination returned HTTP ${response.status}`);
}

function xmlValue(block: string, tag: string): string | undefined {
  const match = block.match(new RegExp(`<${tag}>([\\s\\S]*?)</${tag}>`));
  return match?.[1]?.replace(
    /&(?:amp|lt|gt);/g,
    (entity) => ({ '&amp;': '&', '&lt;': '<', '&gt;': '>' })[entity]!,
  );
}

function parseDate(value: string | undefined): string | null {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function emptyHash(): string {
  return createHash('sha256').update(Buffer.alloc(0)).digest('hex');
}

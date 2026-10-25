import { createReadStream } from 'node:fs';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { tmpdir } from 'node:os';
import { randomUUID } from 'node:crypto';
import { stat } from 'node:fs/promises';
import { Readable } from 'node:stream';
import type { BackupArchiveEntry, BackupDestinationConfig } from '@gamecrafter/contracts';
import {
  assertArchiveName,
  type BackupDestinationAdapter,
  type BackupProgress,
} from './destination';

interface DriveFile {
  id: string;
  name: string;
  size?: string;
  modifiedTime?: string;
}

export class GoogleDriveBackupDestination implements BackupDestinationAdapter {
  readonly kind = 'google-drive' as const;
  private readonly folderId: string;
  private readonly clientId: string;
  private readonly clientSecret: string;
  private readonly refreshToken: string;
  private readonly tokenEndpoint: string;
  private readonly apiEndpoint: string;
  private readonly fetcher: typeof fetch;
  private accessToken?: string;
  private accessTokenExpiresAt = 0;

  constructor(
    config: BackupDestinationConfig,
    secrets: Record<string, string>,
    fetcher: typeof fetch = fetch,
  ) {
    if (!('folderId' in config) || !('clientId' in config)) {
      throw new Error('Invalid Google Drive destination config');
    }
    if (!secrets.clientSecret || !secrets.refreshToken) {
      throw new Error('Google Drive OAuth credentials are required');
    }
    this.folderId = config.folderId;
    this.clientId = config.clientId;
    this.clientSecret = secrets.clientSecret;
    this.refreshToken = secrets.refreshToken;
    this.tokenEndpoint = config.tokenEndpoint ?? 'https://oauth2.googleapis.com/token';
    this.apiEndpoint = (config.apiEndpoint ?? 'https://www.googleapis.com').replace(/\/$/, '');
    this.fetcher = fetcher;
  }

  async put(
    archiveName: string,
    sourceFilePath: string,
    onProgress?: BackupProgress,
    signal?: AbortSignal,
  ): Promise<{ bytes: number }> {
    assertArchiveName(archiveName);
    const bytes = (await stat(sourceFilePath)).size;
    const metadata = {
      name: archiveName,
      parents: [this.folderId],
      mimeType: 'application/octet-stream',
    };
    const createUrl = `${this.apiEndpoint}/upload/drive/v3/files?uploadType=resumable&fields=id,name,size,modifiedTime`;
    const created = await this.authorizedFetch(createUrl, {
      method: 'POST',
      headers: {
        'content-type': 'application/json; charset=UTF-8',
        'x-upload-content-type': 'application/octet-stream',
        'x-upload-content-length': String(bytes),
      },
      body: JSON.stringify(metadata),
      ...(signal ? { signal } : {}),
    });
    await ensureSuccess(created, [200, 201]);
    const sessionUrl = created.headers.get('location');
    if (!sessionUrl) throw new Error('Google Drive did not return an upload session URL');

    const source = createReadStream(sourceFilePath, { highWaterMark: 8 * 1024 * 1024, signal });
    let offset = 0;
    for await (const chunkValue of source) {
      const chunk = Buffer.from(chunkValue);
      const end = offset + chunk.length - 1;
      const response = await this.authorizedFetch(sessionUrl, {
        method: 'PUT',
        headers: {
          'content-length': String(chunk.length),
          'content-type': 'application/octet-stream',
          'content-range': `bytes ${offset}-${end}/${bytes}`,
        },
        body: chunk,
        ...(signal ? { signal } : {}),
      });
      if (![200, 201, 308].includes(response.status))
        await ensureSuccess(response, [200, 201, 308]);
      await response.body?.cancel();
      offset += chunk.length;
      onProgress?.(offset);
    }
    if (offset !== bytes) throw new Error('Google Drive upload length did not match the archive');
    return { bytes };
  }

  async get(archiveName: string, signal?: AbortSignal): Promise<Readable> {
    assertArchiveName(archiveName);
    const file = await this.findFile(archiveName, signal);
    const response = await this.authorizedFetch(
      `${this.apiEndpoint}/drive/v3/files/${encodeURIComponent(file.id)}?alt=media`,
      { method: 'GET', ...(signal ? { signal } : {}) },
    );
    await ensureSuccess(response, [200]);
    if (!response.body) throw new Error('Google Drive returned an empty download');
    return Readable.fromWeb(response.body as import('node:stream/web').ReadableStream);
  }

  async list(signal?: AbortSignal): Promise<BackupArchiveEntry[]> {
    const query = new URLSearchParams({
      q: `'${escapeDriveQueryValue(this.folderId)}' in parents and name contains '.gcbackup' and trashed = false`,
      fields: 'files(id,name,size,modifiedTime)',
      pageSize: '1000',
      spaces: 'drive',
    });
    const response = await this.authorizedFetch(`${this.apiEndpoint}/drive/v3/files?${query}`, {
      method: 'GET',
      ...(signal ? { signal } : {}),
    });
    await ensureSuccess(response, [200]);
    const result = (await response.json()) as { files?: DriveFile[] };
    return (result.files ?? [])
      .filter((file) => file.name.endsWith('.gcbackup'))
      .map((file) => ({
        archiveName: file.name,
        bytes: Number(file.size ?? 0),
        modifiedAt: normalizeDate(file.modifiedTime),
      }))
      .filter((entry) => Number.isSafeInteger(entry.bytes) && entry.bytes >= 0);
  }

  async delete(archiveName: string, signal?: AbortSignal): Promise<void> {
    assertArchiveName(archiveName);
    const file = await this.findFile(archiveName, signal);
    const response = await this.authorizedFetch(
      `${this.apiEndpoint}/drive/v3/files/${encodeURIComponent(file.id)}`,
      { method: 'DELETE', ...(signal ? { signal } : {}) },
    );
    await ensureSuccess(response, [204, 200]);
  }

  async probe(): Promise<void> {
    const directory = await mkdtemp(path.join(tmpdir(), 'gc-backup-drive-probe-'));
    const sourcePath = path.join(directory, 'probe.bin');
    const archiveName = `probe-${randomUUID()}.gcbackup`;
    const expected = Buffer.alloc(1024, 0x44);
    let uploaded = false;
    try {
      await writeFile(sourcePath, expected);
      await this.put(archiveName, sourcePath);
      uploaded = true;
      const stream = await this.get(archiveName);
      const chunks: Buffer[] = [];
      for await (const chunk of stream) chunks.push(Buffer.from(chunk));
      if (!Buffer.concat(chunks).equals(expected))
        throw new Error('Google Drive probe did not round-trip');
    } finally {
      if (uploaded) await this.delete(archiveName);
      await rm(directory, { recursive: true, force: true });
    }
  }

  private async findFile(archiveName: string, signal?: AbortSignal): Promise<DriveFile> {
    const query = new URLSearchParams({
      q: `'${escapeDriveQueryValue(this.folderId)}' in parents and name = '${archiveName}' and trashed = false`,
      fields: 'files(id,name,size,modifiedTime)',
      pageSize: '10',
      spaces: 'drive',
    });
    const response = await this.authorizedFetch(`${this.apiEndpoint}/drive/v3/files?${query}`, {
      method: 'GET',
      ...(signal ? { signal } : {}),
    });
    await ensureSuccess(response, [200]);
    const result = (await response.json()) as { files?: DriveFile[] };
    const file = result.files?.find((item) => item.name === archiveName);
    if (!file) throw new Error('Backup archive not found on Google Drive');
    return file;
  }

  private async authorizedFetch(url: string, init: RequestInit): Promise<Response> {
    const token = await this.getAccessToken();
    const headers = new Headers(init.headers);
    headers.set('authorization', `Bearer ${token}`);
    return this.fetcher(url, { ...init, headers });
  }

  private async getAccessToken(): Promise<string> {
    if (this.accessToken && Date.now() < this.accessTokenExpiresAt - 60_000)
      return this.accessToken;
    const body = new URLSearchParams({
      client_id: this.clientId,
      client_secret: this.clientSecret,
      refresh_token: this.refreshToken,
      grant_type: 'refresh_token',
    });
    const response = await this.fetcher(this.tokenEndpoint, {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body,
    });
    await ensureSuccess(response, [200]);
    const token = (await response.json()) as { access_token?: unknown; expires_in?: unknown };
    if (typeof token.access_token !== 'string')
      throw new Error('Google OAuth response omitted access_token');
    const expiresIn = typeof token.expires_in === 'number' ? token.expires_in : 3600;
    this.accessToken = token.access_token;
    this.accessTokenExpiresAt = Date.now() + expiresIn * 1000;
    return token.access_token;
  }
}

function escapeDriveQueryValue(value: string): string {
  return value.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
}

async function ensureSuccess(response: Response, statuses: number[]): Promise<void> {
  if (statuses.includes(response.status)) return;
  await response.body?.cancel();
  throw new Error(`Google Drive returned HTTP ${response.status}`);
}

function normalizeDate(value: string | undefined): string | null {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { tmpdir } from 'node:os';
import { randomBytes } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { GoogleDriveBackupDestination } from './google-drive';

describe('Google Drive backup destination', () => {
  it('keeps backslashes and quotes inside the folder query literal for list, get and delete', async () => {
    const folderId = "folder\\'part\\";
    const queries: string[] = [];
    const fetcher: typeof fetch = async (input) => {
      const url = new URL(String(input));
      if (url.pathname === '/token')
        return Response.json({ access_token: 'fixture-token', expires_in: 3600 });
      if (url.pathname === '/drive/v3/files') {
        queries.push(url.searchParams.get('q')!);
        return Response.json({ files: [{ id: 'fixture-id', name: 'test.gcbackup', size: '0' }] });
      }
      return new Response('', { status: 200 });
    };
    const destination = new GoogleDriveBackupDestination(
      {
        folderId,
        clientId: 'fixture',
        tokenEndpoint: 'https://fixture.test/token',
        apiEndpoint: 'https://fixture.test',
      },
      { clientSecret: 'fixture', refreshToken: 'fixture' },
      fetcher,
    );
    await destination.list();
    await destination.get('test.gcbackup');
    await destination.delete('test.gcbackup');
    expect(queries).toHaveLength(3);
    for (const query of queries) {
      const match = /^'((?:\\.|[^\\'])*)' in parents and /.exec(query);
      expect(match, query).not.toBeNull();
      expect(match![1]!.replace(/\\(.)/g, '$1')).toBe(folderId);
    }
  });

  it('refreshes OAuth credentials and completes resumable upload, list, download, and delete', async () => {
    const files = new Map<string, { name: string; bytes: Buffer; modifiedTime: string }>();
    const sessions = new Map<string, { name: string; chunks: Buffer[]; received: number }>();
    let refreshCount = 0;
    let sessionCount = 0;
    const fetcher: typeof fetch = async (input, init) => {
      const rawUrl =
        input instanceof Request ? input.url : input instanceof URL ? input.href : input;
      const url = new URL(rawUrl);
      const method = init?.method ?? 'GET';
      const headers = new Headers(init?.headers);
      const requestBody = await readRequestBody(init?.body);
      if (url.pathname === '/token' && method === 'POST') {
        refreshCount += 1;
        const form = new URLSearchParams(requestBody.toString('utf8'));
        if (form.get('refresh_token') !== 'refresh-secret') {
          return new Response(null, { status: 400 });
        }
        return new Response(JSON.stringify({ access_token: 'access-token', expires_in: 3600 }), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        });
      }
      if (headers.get('authorization') !== 'Bearer access-token') {
        return new Response(null, { status: 401 });
      }
      if (url.pathname === '/upload/drive/v3/files' && method === 'POST') {
        const metadata = JSON.parse(requestBody.toString('utf8')) as {
          name: string;
          parents: string[];
        };
        if (metadata.parents[0] !== 'folder-test') {
          return new Response(null, { status: 400 });
        }
        const id = `file-${++sessionCount}`;
        sessions.set(id, { name: metadata.name, chunks: [], received: 0 });
        return new Response(null, {
          status: 200,
          headers: { location: `http://fake-drive.test/upload/session/${id}` },
        });
      }
      if (url.pathname.startsWith('/upload/session/') && method === 'PUT') {
        const id = url.pathname.split('/').at(-1)!;
        const session = sessions.get(id);
        if (!session) return new Response(null, { status: 404 });
        session.chunks.push(requestBody);
        session.received += requestBody.length;
        const range = headers.get('content-range') ?? '';
        const total = Number(range.split('/')[1]);
        if (session.received < total) {
          return new Response(null, {
            status: 308,
            headers: { range: `bytes=0-${session.received - 1}` },
          });
        }
        files.set(id, {
          name: session.name,
          bytes: Buffer.concat(session.chunks),
          modifiedTime: '2026-09-29T12:00:00.000Z',
        });
        return new Response(
          JSON.stringify({ id, name: session.name, size: String(session.received) }),
          { status: 200, headers: { 'content-type': 'application/json' } },
        );
      }
      if (url.pathname === '/drive/v3/files' && method === 'GET') {
        const entries = [...files.entries()].filter(([, file]) => file.name.endsWith('.gcbackup'));
        return new Response(
          JSON.stringify({
            files: entries.map(([id, file]) => ({
              id,
              name: file.name,
              size: String(file.bytes.length),
              modifiedTime: file.modifiedTime,
            })),
          }),
          { status: 200, headers: { 'content-type': 'application/json' } },
        );
      }
      const match = url.pathname.match(/^\/drive\/v3\/files\/([^/]+)$/);
      if (match && method === 'GET' && url.searchParams.get('alt') === 'media') {
        const file = files.get(decodeURIComponent(match[1]!));
        if (!file) return new Response(null, { status: 404 });
        return new Response(file.bytes, {
          status: 200,
          headers: { 'content-length': String(file.bytes.length) },
        });
      }
      if (match && method === 'DELETE') {
        files.delete(decodeURIComponent(match[1]!));
        return new Response(null, { status: 204 });
      }
      return new Response(null, { status: 404 });
    };
    const endpoint = 'http://fake-drive.test';
    const directory = await mkdtemp(path.join(tmpdir(), 'gc-backup-drive-test-'));
    const sourcePath = path.join(directory, 'source.gcbackup');
    const contents = randomBytes(8 * 1024 * 1024 + 1024);
    await writeFile(sourcePath, contents);
    const destination = new GoogleDriveBackupDestination(
      {
        folderId: 'folder-test',
        clientId: 'client-id',
        tokenEndpoint: `${endpoint}/token`,
        apiEndpoint: endpoint,
      },
      { clientSecret: 'client-secret', refreshToken: 'refresh-secret' },
      fetcher,
    );
    const archiveName = 'profile-test.gcbackup';
    try {
      await destination.put(archiveName, sourcePath);
      expect(sessions.get('file-1')?.chunks).toHaveLength(2);
      expect((await destination.list()).map((entry) => entry.archiveName)).toEqual([archiveName]);
      const downloaded: Buffer[] = [];
      for await (const chunk of await destination.get(archiveName))
        downloaded.push(Buffer.from(chunk));
      expect(Buffer.concat(downloaded)).toEqual(contents);
      expect(refreshCount).toBe(1);
      await destination.delete(archiveName);
      expect(await destination.list()).toEqual([]);
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  }, 60_000);
});

async function readRequestBody(body: BodyInit | null | undefined): Promise<Buffer> {
  if (body === null || body === undefined) return Buffer.alloc(0);
  if (typeof body === 'string') return Buffer.from(body);
  if (body instanceof URLSearchParams) return Buffer.from(body.toString());
  if (body instanceof Uint8Array) return Buffer.from(body);
  if (body instanceof ArrayBuffer) return Buffer.from(body);
  throw new Error(`Unexpected fake Google Drive request body: ${typeof body}`);
}

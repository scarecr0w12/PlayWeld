import { createHash, createHmac, randomBytes } from 'node:crypto';
import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { tmpdir } from 'node:os';
import { describe, expect, it } from 'vitest';
import { S3BackupDestination } from './s3';

const accessKeyId = 'TESTACCESSKEY';
const secretAccessKey = 'test-secret-key-value';
const region = 'us-east-1';
const bucket = 'backup-test';

function encode(value: string): string {
  return encodeURIComponent(value).replace(
    /[!'()*]/g,
    (character) => `%${character.charCodeAt(0).toString(16).toUpperCase()}`,
  );
}

function canonicalQuery(searchParams: URLSearchParams): string {
  return [...searchParams.entries()]
    .map(([key, value]) => [encode(key), encode(value)] as const)
    .sort(([leftKey, leftValue], [rightKey, rightValue]) =>
      leftKey === rightKey ? leftValue.localeCompare(rightValue) : leftKey.localeCompare(rightKey),
    )
    .map(([key, value]) => `${key}=${value}`)
    .join('&');
}

function signingKey(secret: string, date: string): Buffer {
  const dateKey = createHmac('sha256', `AWS4${secret}`).update(date).digest();
  const regionKey = createHmac('sha256', dateKey).update(region).digest();
  const serviceKey = createHmac('sha256', regionKey).update('s3').digest();
  return createHmac('sha256', serviceKey).update('aws4_request').digest();
}

async function bodyOf(request: IncomingMessage): Promise<Buffer> {
  const chunks: Buffer[] = [];
  for await (const chunk of request) chunks.push(Buffer.from(chunk));
  return Buffer.concat(chunks);
}

async function reply(
  request: IncomingMessage,
  response: ServerResponse,
  objects: Map<string, Buffer>,
): Promise<void> {
  const body = await bodyOf(request);
  const payloadHash = createHash('sha256').update(body).digest('hex');
  if (request.headers['x-amz-content-sha256'] !== payloadHash) {
    response.writeHead(400).end('bad payload hash');
    return;
  }
  const authorization = request.headers.authorization ?? '';
  const match = authorization.match(
    /^AWS4-HMAC-SHA256 Credential=([^/]+)\/(\d{8})\/([^/]+)\/s3\/aws4_request, SignedHeaders=([^,]+), Signature=([0-9a-f]+)/,
  );
  if (!match || match[1] !== accessKeyId || match[3] !== region) {
    response.writeHead(403).end('bad credentials');
    return;
  }
  const [, , date, , signedHeaders, suppliedSignature] = match;
  const headers = signedHeaders!.split(';');
  const canonicalHeaders = headers
    .map((name) => `${name}:${String(request.headers[name] ?? '').trim()}\n`)
    .join('');
  const url = new URL(request.url ?? '/', `http://${request.headers.host}`);
  const canonicalRequest = [
    request.method ?? 'GET',
    url.pathname,
    canonicalQuery(url.searchParams),
    canonicalHeaders,
    signedHeaders,
    payloadHash,
  ].join('\n');
  const amzDate = String(request.headers['x-amz-date'] ?? '');
  const stringToSign = [
    'AWS4-HMAC-SHA256',
    amzDate,
    `${date}/${region}/s3/aws4_request`,
    createHash('sha256').update(canonicalRequest).digest('hex'),
  ].join('\n');
  const actualSignature = createHmac('sha256', signingKey(secretAccessKey, date!))
    .update(stringToSign)
    .digest('hex');
  if (actualSignature !== suppliedSignature) {
    response.writeHead(403).end('bad signature');
    return;
  }

  const objectKey = decodeURIComponent(url.pathname.slice(`/${bucket}/`.length));
  if (request.method === 'PUT') {
    objects.set(objectKey, body);
    response.writeHead(200).end();
    return;
  }
  if (request.method === 'GET' && url.searchParams.get('list-type') === '2') {
    const prefix = url.searchParams.get('prefix') ?? '';
    const contents = [...objects.entries()]
      .filter(([key]) => key.startsWith(prefix))
      .map(
        ([key, value]) =>
          `<Contents><Key>${key}</Key><Size>${value.length}</Size><LastModified>2026-09-29T12:00:00.000Z</LastModified></Contents>`,
      )
      .join('');
    response
      .writeHead(200, { 'content-type': 'application/xml' })
      .end(`<ListBucketResult>${contents}</ListBucketResult>`);
    return;
  }
  if (request.method === 'GET') {
    const value = objects.get(objectKey);
    if (!value) {
      response.writeHead(404).end();
      return;
    }
    response.writeHead(200, { 'content-length': String(value.length) }).end(value);
    return;
  }
  if (request.method === 'DELETE') {
    objects.delete(objectKey);
    response.writeHead(204).end();
    return;
  }
  response.writeHead(405).end();
}

describe('S3 backup destination', () => {
  it('decodes XML entities once instead of reinterpreting the decoded result', async () => {
    const fetcher: typeof fetch = async () =>
      new Response(
        '<ListBucketResult><Contents><Key>backups/a&amp;lt;b.gcbackup</Key><Size>1</Size></Contents></ListBucketResult>',
      );
    const destination = new S3BackupDestination(
      { endpoint: 'https://fixture.test', region, bucket, prefix: 'backups', forcePathStyle: true },
      { accessKeyId, secretAccessKey },
      fetcher,
    );
    expect((await destination.list()).map((entry) => entry.archiveName)).toEqual([
      'a&lt;b.gcbackup',
    ]);
    await expect(destination.get('a&lt;b.gcbackup')).rejects.toThrow('Invalid backup archive name');
  });

  it('uploads, lists, downloads, and deletes an object with a verified SigV4 signature', async () => {
    const objects = new Map<string, Buffer>();
    let verifiedRequests = 0;
    const server = createServer((request, response) => {
      void reply(request, response, objects).then(() => {
        if (response.statusCode !== 400 && response.statusCode !== 403) verifiedRequests += 1;
      });
    });
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
    const address = server.address();
    if (!address || typeof address === 'string') throw new Error('Fake S3 server did not bind');
    const directory = await mkdtemp(path.join(tmpdir(), 'gc-backup-s3-test-'));
    const sourcePath = path.join(directory, 'source.gcbackup');
    const contents = randomBytes(4096);
    await writeFile(sourcePath, contents);
    const destination = new S3BackupDestination(
      {
        endpoint: `http://127.0.0.1:${address.port}`,
        region,
        bucket,
        prefix: 'backups',
        forcePathStyle: true,
      },
      { accessKeyId, secretAccessKey, sessionToken: 'test-session-token' },
    );
    const archiveName = 'project-archive.gcbackup';
    try {
      await destination.put(archiveName, sourcePath);
      expect((await destination.list()).map((entry) => entry.archiveName)).toEqual([archiveName]);
      const downloaded: Buffer[] = [];
      for await (const chunk of await destination.get(archiveName))
        downloaded.push(Buffer.from(chunk));
      expect(Buffer.concat(downloaded)).toEqual(contents);
      await destination.delete(archiveName);
      expect(await destination.list()).toEqual([]);
      expect(verifiedRequests).toBe(5);
    } finally {
      await rm(directory, { recursive: true, force: true });
      await new Promise<void>((resolve, reject) =>
        server.close((error) => (error ? reject(error) : resolve())),
      );
    }
  });
});

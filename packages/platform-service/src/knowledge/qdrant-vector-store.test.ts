import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import type { AddressInfo } from 'node:net';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { uuidv7, type EmbeddingProfile } from '@gamecrafter/contracts';
import { QdrantVectorStore } from './qdrant-vector-store';

interface RecordedRequest {
  method: string;
  url: string;
  headers: IncomingMessage['headers'];
  body: Record<string, unknown> | null;
}

let closeServer: (() => Promise<void>) | undefined;
afterEach(async () => {
  await closeServer?.();
  closeServer = undefined;
});

describe('QdrantVectorStore', () => {
  it('refuses API keys over non-loopback HTTP even for legacy configurations', async () => {
    const fetcher = vi.fn<typeof fetch>();
    const store = new QdrantVectorStore({
      url: 'http://remote.example.com:6333',
      apiKey: 'private-key',
      collectionPrefix: 'test',
      timeoutMs: 5000,
      fetcher,
    });
    expect(await store.health()).toMatchObject({
      reachable: false,
      error: expect.stringContaining('Use HTTPS'),
    });
    expect(fetcher).not.toHaveBeenCalled();
  });
  it('ensures, upserts, searches, counts, and deletes with project filters and API key auth', async () => {
    const recorded: RecordedRequest[] = [];
    const collections = new Set<string>();
    const server = createServer((request, response) => {
      void readRequest(request).then(({ body }) => {
        recorded.push({
          method: request.method ?? '',
          url: request.url ?? '',
          headers: { ...request.headers },
          body,
        });
        if (request.method === 'GET' && request.url === '/') {
          sendJson(response, 200, { version: '1.16.0' });
          return;
        }
        if (request.method === 'GET' && request.url?.startsWith('/collections/')) {
          const collection = request.url.split('/')[2] ?? '';
          sendJson(response, collections.has(collection) ? 200 : 404, {
            result: { name: collection },
          });
          return;
        }
        if (request.method === 'PUT' && request.url?.startsWith('/collections/')) {
          collections.add(request.url.split('/')[2] ?? '');
          sendJson(response, 200, { result: true });
          return;
        }
        if (request.url?.endsWith('/points/search')) {
          sendJson(response, 200, {
            result: [{ id: 'point-a', score: 0.95, payload: { projectId: 'a' } }],
          });
          return;
        }
        if (request.url?.endsWith('/points/count')) {
          sendJson(response, 200, { result: { count: 3 } });
          return;
        }
        sendJson(response, 200, { result: true });
      });
    });
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
    const address = server.address() as AddressInfo;
    closeServer = () => new Promise<void>((resolve) => server.close(() => resolve()));
    const projectId = uuidv7();
    const profile: EmbeddingProfile = {
      profileId: uuidv7(),
      projectId,
      modelId: 'embed-small',
      providerAccountId: uuidv7(),
      dimensions: 3,
      version: 1,
      createdAt: new Date().toISOString(),
    };
    const store = new QdrantVectorStore({
      url: `http://127.0.0.1:${address.port}`,
      apiKey: 'test-qdrant-key',
      collectionPrefix: 'gamecrafter',
      timeoutMs: 2000,
    });

    const collection = await store.ensureCollection(profile);
    await store.upsert(profile, [
      { id: 'point-a', vector: [1, 0, 0], payload: { projectId, chunkId: 'chunk-a' } },
    ]);
    const hits = await store.search(profile, [1, 0, 0], { sources: ['canon'] }, 5);
    const count = await store.count(profile, {});
    await store.delete(profile, ['point-a']);
    const health = await store.health();

    expect(collection).toContain(projectId.replaceAll('-', '_'));
    expect(collection).toContain('_v1');
    expect(hits).toEqual([{ id: 'point-a', score: 0.95, payload: { projectId: 'a' } }]);
    expect(count).toBe(3);
    expect(health).toMatchObject({ reachable: true, version: '1.16.0', error: null });
    expect(recorded.every((request) => request.headers['api-key'] === 'test-qdrant-key')).toBe(
      true,
    );
    const searchRequest = recorded.find((request) => request.url.endsWith('/points/search'))!;
    const searchBody = searchRequest.body!;
    expect(searchBody.filter).toMatchObject({
      must: expect.arrayContaining([
        { key: 'projectId', match: { value: projectId } },
        { key: 'source', match: { any: ['canon'] } },
      ]),
    });
    const deleteRequest = recorded.find((request) =>
      request.url.split('?')[0]?.endsWith('/points/delete'),
    )!;
    expect(deleteRequest.body?.filter).toMatchObject({
      must: expect.arrayContaining([
        { key: 'projectId', match: { value: projectId } },
        { has_id: ['point-a'] },
      ]),
    });
    const countRequest = recorded.find((request) => request.url.endsWith('/points/count'))!;
    expect(countRequest.body?.filter).toMatchObject({
      must: [
        { key: 'projectId', match: { value: projectId } },
        { key: 'active', match: { value: true } },
      ],
    });
  });

  it('refuses to upsert vectors labeled for a different Project', async () => {
    const store = new QdrantVectorStore({
      url: 'http://127.0.0.1:6333',
      collectionPrefix: 'gamecrafter',
      timeoutMs: 100,
    });
    const profile: EmbeddingProfile = {
      profileId: uuidv7(),
      projectId: uuidv7(),
      modelId: 'embed-small',
      providerAccountId: uuidv7(),
      dimensions: 3,
      version: 1,
      createdAt: new Date().toISOString(),
    };
    await expect(
      store.upsert(profile, [
        { id: 'foreign-point', vector: [1, 0, 0], payload: { projectId: uuidv7() } },
      ]),
    ).rejects.toMatchObject({ code: -32104 });
  });
});

async function readRequest(
  request: IncomingMessage,
): Promise<{ body: Record<string, unknown> | null }> {
  let text = '';
  for await (const chunk of request) text += chunk;
  return { body: text ? (JSON.parse(text) as Record<string, unknown>) : null };
}

function sendJson(response: ServerResponse, status: number, body: unknown): void {
  response.writeHead(status, { 'content-type': 'application/json' });
  response.end(JSON.stringify(body));
}

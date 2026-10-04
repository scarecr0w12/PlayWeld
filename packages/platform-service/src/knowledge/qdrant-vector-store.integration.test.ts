import { spawnSync } from 'node:child_process';
import { setTimeout as delay } from 'node:timers/promises';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { uuidv7, type EmbeddingProfile } from '@gamecrafter/contracts';
import { QdrantVectorStore } from './qdrant-vector-store';

const dockerInfo = spawnSync('docker', ['info', '--format', '{{.OSType}}'], {
  encoding: 'utf8',
  timeout: 10_000,
});
// Qdrant publishes a Linux image; a reachable Windows-mode daemon cannot run it.
const dockerAvailable = dockerInfo.status === 0 && dockerInfo.stdout.trim() === 'linux';
const qdrantSuite = dockerAvailable ? describe : describe.skip;
if (!dockerAvailable)
  console.info('Skipping real Qdrant integration: a Linux-container Docker daemon is unavailable.');

qdrantSuite('real Qdrant adapter integration', () => {
  const containerName = `gc-wp14-qdrant-${process.pid}`;
  const url = 'http://127.0.0.1:6333';
  const store = new QdrantVectorStore({
    url,
    collectionPrefix: 'gamecrafter-wp14',
    timeoutMs: 5000,
  });
  let started = false;

  beforeAll(async () => {
    const result = spawnSync(
      'docker',
      [
        'run',
        '--rm',
        '-d',
        '--name',
        containerName,
        '-p',
        '127.0.0.1:6333:6333',
        'qdrant/qdrant:v1.16.0',
      ],
      { encoding: 'utf8', timeout: 30_000 },
    );
    if (result.status !== 0) {
      throw new Error(`Unable to start Qdrant test container: ${result.stderr || result.error}`);
    }
    started = true;
    const deadline = Date.now() + 30_000;
    while (Date.now() < deadline) {
      try {
        const response = await fetch(url);
        if (response.ok) {
          const body = (await response.json()) as { version?: string };
          if (body.version === '1.16.0') return;
        }
      } catch {
        await delay(250);
      }
    }
    throw new Error('Qdrant 1.16.0 did not become ready within 30 seconds.');
  }, 40_000);

  afterAll(() => {
    if (started)
      spawnSync('docker', ['stop', containerName], { encoding: 'utf8', timeout: 30_000 });
  });

  it('isolates collections and point filters across Projects and deletes stale points', async () => {
    const projectA = uuidv7();
    const projectB = uuidv7();
    const profileA = profile(projectA);
    const profileB = profile(projectB);
    const collectionA = await store.ensureCollection(profileA);
    const collectionB = await store.ensureCollection(profileB);
    expect(collectionA).not.toBe(collectionB);
    await store.upsert(profileA, points(projectA, 'a'));
    await store.upsert(profileB, points(projectB, 'b'));

    const hits = await store.search(profileA, [1, 0, 0], {}, 10);
    expect(hits).toHaveLength(3);
    expect(hits.every((hit) => hit.payload.projectId === projectA)).toBe(true);
    expect(hits.some((hit) => hit.payload.chunkId === 'b-unique')).toBe(false);

    await store.delete(profileA, [hits[0]!.id]);
    expect(await store.count(profileA, {})).toBe(2);
    expect(await store.count(profileB, {})).toBe(3);
    expect(await store.health(profileA)).toMatchObject({ reachable: true, version: '1.16.0' });
  }, 45_000);
});

function profile(projectId: string): EmbeddingProfile {
  return {
    profileId: uuidv7(),
    projectId,
    modelId: 'fixture-embedding-model',
    providerAccountId: uuidv7(),
    dimensions: 3,
    version: 1,
    createdAt: new Date().toISOString(),
  };
}

function points(projectId: string, prefix: string) {
  return Array.from({ length: 3 }, (_, index) => ({
    id: uuidv7(),
    vector: index === 0 ? [1, 0, 0] : index === 1 ? [0, 1, 0] : [0, 0, 1],
    payload: {
      projectId,
      chunkId: `${prefix}-${index === 0 ? 'unique' : index}`,
      source: 'canon',
      active: true,
    },
  }));
}

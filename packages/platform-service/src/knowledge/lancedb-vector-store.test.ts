import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { uuidv7, type EmbeddingProfile } from '@gamecrafter/contracts';
import { LanceDbVectorStore } from './lancedb-vector-store';

const directories: string[] = [];
const stores: LanceDbVectorStore[] = [];

afterEach(async () => {
  await Promise.all(stores.splice(0).map((store) => store.close()));
  await Promise.all(
    directories.splice(0).map((directory) => rm(directory, { recursive: true, force: true })),
  );
});

describe('LanceDbVectorStore', () => {
  it('recreates an externally removed table rather than trusting cached mappings', async () => {
    const projectId = uuidv7();
    const directory = await temporaryDirectory();
    const profile = embeddingProfile(projectId);
    const store = new LanceDbVectorStore({ projectId, directory });
    stores.push(store);
    await store.upsert(profile, [{ id: 'repair', vector: [1, 0, 0], payload: { active: true } }]);
    const database = await (await import('@lancedb/lancedb')).connect(directory);
    try {
      await database.dropTable(store.collectionName(profile));
    } finally {
      database.close();
    }
    expect(await store.existingIds(profile, ['repair'])).toEqual([]);
    await store.upsert(profile, [{ id: 'repair', vector: [1, 0, 0], payload: { active: true } }]);
    expect(await store.count(profile, {})).toBe(1);
  });
  it('persists vectors, enforces metadata filters, deletes IDs, and reopens native storage', async () => {
    const projectId = uuidv7();
    const directory = await temporaryDirectory();
    const profile = embeddingProfile(projectId);
    const store = new LanceDbVectorStore({ projectId, directory });
    stores.push(store);

    const collection = await store.ensureCollection(profile);
    const database = await (await import('@lancedb/lancedb')).connect(directory);
    try {
      const schema = await (await database.openTable(collection)).schema();
      expect(schema.fields.find((field) => field.name === 'vector')?.type.toString()).toBe(
        'FixedSizeList[3]<Float32>',
      );
    } finally {
      database.close();
    }
    await store.upsert(profile, [
      {
        id: 'active-canon',
        vector: [1, 0, 0],
        payload: {
          projectId,
          chunkId: 'chunk-canon',
          source: 'canon',
          recordType: 'character',
          recordStatus: 'accepted',
          active: true,
        },
      },
      {
        id: 'inactive-canon',
        vector: [0.99, 0.01, 0],
        payload: {
          projectId,
          source: 'canon',
          recordType: 'character',
          recordStatus: 'deprecated',
          active: false,
        },
      },
      {
        id: 'active-doc',
        vector: [0, 1, 0],
        payload: {
          projectId,
          source: 'docs',
          recordType: 'design-note',
          recordStatus: null,
          active: true,
        },
      },
    ]);

    expect(collection).toBe(store.collectionName(profile));
    expect(await store.count(profile, { sources: [] })).toBe(0);
    expect(await store.count(profile, { sources: ["canon' OR TRUE"] })).toBe(0);
    expect(await store.count(profile, { sources: ['canon'] })).toBe(1);
    expect(await store.existingIds(profile, ['active-canon', 'missing'])).toEqual(['active-canon']);
    expect(
      await store.count(profile, {
        sources: ['canon'],
        recordTypes: ['character'],
        statuses: ['deprecated'],
        includeInactive: true,
      }),
    ).toBe(1);
    const hits = await store.search(
      profile,
      [1, 0, 0],
      { sources: ['canon'], recordTypes: ['character'], statuses: ['accepted'] },
      10,
    );
    expect(hits).toHaveLength(1);
    expect(hits[0]).toMatchObject({ id: 'active-canon', payload: { projectId, source: 'canon' } });
    expect(hits[0]!.score).toBeCloseTo(1, 5);

    await store.delete(profile, ['active-canon']);
    expect(await store.count(profile, {})).toBe(1);
    await store.close();

    const reopened = new LanceDbVectorStore({ projectId, directory });
    stores.push(reopened);
    expect(await reopened.count(profile, { includeInactive: true })).toBe(2);
    expect(await reopened.search(profile, [0, 1, 0], { sources: ['docs'] }, 5)).toMatchObject([
      { id: 'active-doc', payload: { source: 'docs' } },
    ]);
  });

  it('upserts by ID and stores a fixed vector dimension', async () => {
    const projectId = uuidv7();
    const profile = embeddingProfile(projectId);
    const store = new LanceDbVectorStore({ projectId, directory: await temporaryDirectory() });
    stores.push(store);
    expect(
      await Promise.all([
        store.count(profile, {}),
        store.count(profile, { includeInactive: true }),
      ]),
    ).toEqual([0, 0]);
    await store.upsert(profile, [
      { id: 'same-id', vector: [1, 0, 0], payload: { projectId, source: 'docs', revision: 'old' } },
    ]);
    await store.upsert(profile, [
      {
        id: 'same-id',
        vector: [0, 1, 0],
        payload: { projectId, source: 'canon', revision: 'new' },
      },
    ]);
    expect(await store.count(profile, { includeInactive: true })).toBe(1);
    expect(await store.search(profile, [0, 1, 0], { sources: ['canon'] }, 1)).toMatchObject([
      { id: 'same-id', payload: { revision: 'new', source: 'canon' } },
    ]);
    await expect(
      store.upsert(profile, [{ id: 'bad-dimension', vector: [1, 0], payload: {} }]),
    ).rejects.toThrow(/expected 3 finite/);
    await expect(store.search(profile, [1, 0], {}, 1)).rejects.toThrow(/expected 3 finite/);
    await expect(
      store.upsert(profile, [{ id: 'overflow', vector: [Number.MAX_VALUE, 0, 0], payload: {} }]),
    ).rejects.toThrow(/expected 3 finite/);
    await expect(store.search(profile, [0, 0, 0], {}, 1)).rejects.toThrow(
      /non-zero Float32 values/,
    );
  });

  it('binds storage to its constructor Project and rejects untrusted filters', async () => {
    const projectId = uuidv7();
    const profile = embeddingProfile(projectId);
    const store = new LanceDbVectorStore({ projectId, directory: await temporaryDirectory() });
    stores.push(store);

    await expect(store.ensureCollection(embeddingProfile(uuidv7()))).rejects.toThrow(
      /does not belong to this Project/,
    );
    await expect(
      store.upsert(profile, [
        { id: 'foreign', vector: [1, 0, 0], payload: { projectId: uuidv7() } },
      ]),
    ).rejects.toThrow(/different Project/);
    await expect(store.count(profile, { projectId } as never)).rejects.toThrow(/unsupported field/);
    await expect(
      store.search(profile, [1, 0, 0], { sources: 'canon' } as never, 1),
    ).rejects.toThrow(/sources must be an array of strings/);
    await expect(store.search(profile, [1, 0, 0], {}, 0)).rejects.toThrow(/positive integer/);

    const nextVersion = { ...profile, version: profile.version + 1 };
    const differentDimensions = { ...profile, dimensions: profile.dimensions + 1 };
    expect(store.collectionName(nextVersion)).not.toBe(store.collectionName(profile));
    expect(store.collectionName(differentDimensions)).not.toBe(store.collectionName(profile));
  });
});

async function temporaryDirectory(): Promise<string> {
  const directory = await mkdtemp(join(tmpdir(), 'playweld-lancedb-'));
  directories.push(directory);
  return directory;
}

function embeddingProfile(projectId: string): EmbeddingProfile {
  return {
    profileId: uuidv7(),
    projectId,
    modelId: 'test-embedding-model',
    providerAccountId: uuidv7(),
    dimensions: 3,
    version: 1,
    createdAt: new Date().toISOString(),
  };
}

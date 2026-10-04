import { mkdtempSync, mkdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { uuidv7, type EmbeddingProfile } from '@gamecrafter/contracts';
import { SqliteVectorStore } from './sqlite-vector-store';

let directory: string | undefined;
let stores: SqliteVectorStore[] = [];

afterEach(async () => {
  for (const store of stores) await store.close();
  stores = [];
  if (directory) rmSync(directory, { recursive: true, force: true });
  directory = undefined;
});

describe('SqliteVectorStore', () => {
  it('persists idempotent upserts and isolates Projects and profile versions', async () => {
    const databasePath = makeDatabasePath();
    const projectId = uuidv7();
    const otherProjectId = uuidv7();
    const profile = makeProfile(projectId);
    const otherProfile = makeProfile(otherProjectId);
    const nextVersion = { ...profile, version: profile.version + 1 };
    const store = makeStore(projectId, databasePath);
    await store.ensureCollection(profile);
    await store.upsert(profile, [
      {
        id: 'same-id',
        vector: [1, 0, 0],
        payload: { source: 'canon', revision: 'first', active: true },
      },
      {
        id: 'same-id',
        vector: [0, 1, 0],
        payload: { source: 'canon', revision: 'second', active: true },
      },
    ]);
    await store.upsert(nextVersion, [
      {
        id: 'same-id',
        vector: [0, 0, 1],
        payload: { source: 'canon', revision: 'new-profile', active: true },
      },
    ]);
    expect(await store.count(profile, {})).toBe(1);
    expect(await store.count(nextVersion, {})).toBe(1);
    expect(store.collectionName(profile)).not.toBe(store.collectionName(nextVersion));
    await store.close();
    stores = [];

    const reopened = makeStore(projectId, databasePath);
    const otherProject = makeStore(otherProjectId, databasePath);
    await otherProject.upsert(otherProfile, [
      { id: 'same-id', vector: [1, 0, 0], payload: { source: 'canon', active: true } },
    ]);
    await reopened.delete(profile, ['same-id']);

    expect(await reopened.count(profile, {})).toBe(0);
    expect(await reopened.count(nextVersion, {})).toBe(1);
    expect(await otherProject.count(otherProfile, {})).toBe(1);
    expect(await reopened.search(nextVersion, [0, 0, 1], {}, 10)).toMatchObject([
      { id: 'same-id', score: 1, payload: { revision: 'new-profile' } },
    ]);
  });

  it('applies payload filters before ranking and excludes inactive points by default', async () => {
    const projectId = uuidv7();
    const profile = makeProfile(projectId);
    const store = makeStore(projectId);
    await store.upsert(profile, [
      {
        id: 'inactive-match',
        vector: [1, 0, 0],
        payload: {
          source: 'canon',
          recordType: 'character',
          recordStatus: 'accepted',
          active: false,
        },
      },
      {
        id: 'wrong-status',
        vector: [0.99, 0.1, 0],
        payload: { source: 'canon', recordType: 'character', recordStatus: 'draft', active: true },
      },
      {
        id: 'matching-active',
        vector: [0, 1, 0],
        payload: { source: 'docs', recordType: 'location', recordStatus: 'accepted', active: true },
      },
    ]);

    const filter = {
      sources: ['canon', 'docs'],
      recordTypes: ['character', 'location'],
      statuses: ['accepted'],
    };
    expect(await store.search(profile, [1, 0, 0], filter, 10)).toMatchObject([
      { id: 'matching-active', score: 0 },
    ]);
    expect(await store.count(profile, filter)).toBe(1);
    expect(
      await store.search(profile, [1, 0, 0], { ...filter, includeInactive: true }, 10),
    ).toHaveLength(2);
  });

  it('rejects use with a profile bound to another Project on every profile operation', async () => {
    const store = makeStore(uuidv7());
    const foreignProfile = makeProfile(uuidv7());

    await expect(store.ensureCollection(foreignProfile)).rejects.toThrow(/different Project/i);
    await expect(store.upsert(foreignProfile, [])).rejects.toThrow(/different Project/i);
    await expect(store.delete(foreignProfile, [])).rejects.toThrow(/different Project/i);
    await expect(store.search(foreignProfile, [1, 0, 0], {}, 5)).rejects.toThrow(
      /different Project/i,
    );
    await expect(store.count(foreignProfile, {})).rejects.toThrow(/different Project/i);
    await expect(store.health(foreignProfile)).rejects.toThrow(/different Project/i);
  });

  it('rejects vectors with mismatched dimensions, non-finite values, or zero magnitude', async () => {
    const projectId = uuidv7();
    const profile = makeProfile(projectId);
    const store = makeStore(projectId);

    await expect(
      store.upsert(profile, [{ id: 'short', vector: [1, 0], payload: {} }]),
    ).rejects.toThrow(/vector/i);
    await expect(
      store.upsert(profile, [{ id: 'nan', vector: [1, Number.NaN, 0], payload: {} }]),
    ).rejects.toThrow(/vector/i);
    await expect(
      store.upsert(profile, [{ id: 'zero', vector: [0, 0, 0], payload: {} }]),
    ).rejects.toThrow(/vector/i);
    await expect(store.search(profile, [0, 0, 0], {}, 5)).rejects.toThrow(/vector/i);
    await expect(store.search(profile, [1, 0], {}, 5)).rejects.toThrow(/vector/i);
  });
});

function makeDatabasePath(): string {
  directory = mkdtempSync(join(tmpdir(), 'playweld-sqlite-vectors-'));
  const gamecrafterDirectory = join(directory, '.gamecrafter');
  mkdirSync(gamecrafterDirectory, { recursive: true });
  return join(gamecrafterDirectory, 'vectors.sqlite');
}

function makeProfile(projectId: string): EmbeddingProfile {
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

function makeStore(projectId: string, databasePath = makeDatabasePath()): SqliteVectorStore {
  const store = new SqliteVectorStore({ projectId, databasePath });
  stores.push(store);
  return store;
}

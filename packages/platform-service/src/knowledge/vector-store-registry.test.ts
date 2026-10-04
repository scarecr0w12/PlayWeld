import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { uuidv7 } from '@gamecrafter/contracts';
import { VectorStoreRegistry, validateVectorEndpoint } from './vector-store-registry';
import { NullVectorStore, validateVectorFilter } from './vector-store';

const directories: string[] = [];
const registries: VectorStoreRegistry[] = [];
afterEach(async () => {
  await Promise.all(registries.splice(0).map((registry) => registry.close()));
  for (const directory of directories.splice(0))
    rmSync(directory, { recursive: true, force: true });
});

describe('vector backend registry', () => {
  it('selects builtins, caches handles and separates destinations', () => {
    const projectPath = mkdtempSync(path.join(tmpdir(), 'vector-registry-'));
    directories.push(projectPath);
    const registry = new VectorStoreRegistry('unused-qdrant');
    registries.push(registry);
    const context = { projectId: uuidv7(), projectPath, config: { kind: 'lancedb' } };
    const first = registry.resolve(context, false);
    expect(first.store.kind).toBe('lancedb');
    expect(registry.resolve(context, false).store).toBe(first.store);
    const sqlite = registry.resolve({ ...context, config: { kind: 'sqlite' } }, false);
    expect(sqlite.store.kind).toBe('sqlite');
    expect(sqlite.identity).not.toBe(first.identity);
    const qdrant = registry.resolve(
      { ...context, config: { kind: 'qdrant', deployment: 'local', url: 'http://127.0.0.1:6333' } },
      false,
    );
    expect(qdrant.store.kind).toBe('qdrant');
    expect(() => registry.resolve({ ...context, config: { kind: 'unregistered' } }, false)).toThrow(
      /not registered/,
    );
  });

  it('supports trusted registered adapters and rejects duplicate IDs and deployment mismatches', () => {
    const registry = new VectorStoreRegistry('unused');
    registries.push(registry);
    registry.register({
      schemaVersion: 1,
      id: 'custom-store',
      deployments: ['embedded'],
      create: () => ({
        kind: 'custom-store',
        ensureCollection: async () => null,
        upsert: async () => {},
        delete: async () => {},
        search: async () => [],
        count: async () => 0,
        health: async () => ({
          kind: 'custom-store',
          reachable: true,
          collection: null,
          error: null,
        }),
      }),
    });
    expect(
      registry.resolve(
        {
          projectId: uuidv7(),
          projectPath: tmpdir(),
          config: { kind: 'custom-store', deployment: 'embedded' },
        },
        false,
      ).store.kind,
    ).toBe('custom-store');
    expect(() =>
      registry.register({
        schemaVersion: 1,
        id: 'qdrant',
        deployments: [],
        create: () => new NullVectorStore(),
      }),
    ).toThrow(/duplicate/);
    expect(() =>
      registry.resolve(
        {
          projectId: uuidv7(),
          projectPath: tmpdir(),
          config: { kind: 'custom-store', deployment: 'remote', url: 'https://example.com' },
        },
        true,
      ),
    ).toThrow(/Unsupported deployment/);
  });

  it('enforces explicit remote consent, TLS, local loopback and safe URL syntax', () => {
    expect(() => validateVectorEndpoint('https://example.com', 'remote', false)).toThrow(
      /explicit permission/,
    );
    expect(() => validateVectorEndpoint('http://example.com', 'remote', true)).toThrow(/HTTPS/);
    expect(() => validateVectorEndpoint('https://key@example.com', 'remote', true)).toThrow(
      /credentials/,
    );
    expect(() => validateVectorEndpoint('https://example.com', 'local', false)).toThrow(/loopback/);
    expect(() => validateVectorEndpoint('https://example.com', 'remote', true)).not.toThrow();
    expect(() => validateVectorEndpoint('http://127.0.0.1:6333', 'local', false)).not.toThrow();
    expect(() =>
      validateVectorEndpoint('http://legacy.example.com', 'external', false),
    ).not.toThrow();
  });

  it('rejects unknown filters rather than silently widening a query', () => {
    expect(() => validateVectorFilter({ must: [] } as never)).toThrow(/Unsupported/);
    expect(() => validateVectorFilter({ sources: [1] } as never)).toThrow(/string arrays/);
    expect(() => validateVectorFilter({ sources: [], includeInactive: true })).not.toThrow();
  });
});

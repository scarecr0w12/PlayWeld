import { Database } from '../db/database';
import { migrate } from '../db/migrator';
import { projectMigrations } from '../projects/migrations';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { uuidv7, type CanonRecord, type KnowledgeChunk } from '@gamecrafter/contracts';
import { KnowledgeStore, type IndexedKnowledgePath } from './knowledge-store';

let database: Database | undefined;
afterEach(() => {
  vi.restoreAllMocks();
  database?.close();
  database = undefined;
});

describe('KnowledgeStore', () => {
  it('repairs inconsistent lexical entries and leaves all content and metadata intact', () => {
    database = Database.open(':memory:');
    migrate(database, projectMigrations);
    const store = new KnowledgeStore(database);
    const projectId = uuidv7();
    store.replaceIndexedPath(
      indexedPath(projectId, 'docs/canon/aria.md', 'Harborfall sentinel', 'recovery'),
    );
    const before = store.stateHash();
    database.exec("INSERT INTO knowledge_chunks_fts(knowledge_chunks_fts) VALUES ('delete-all')");
    database.exec(
      "INSERT INTO knowledge_chunks_fts(rowid, text) VALUES (999999, 'orphaned index entry')",
    );
    expect(store.searchLexical(projectId, 'Harborfall', {}, 10)).toEqual([]);
    expect(store.recoverLexicalIndex()).toBe(true);
    expect(store.searchLexical(projectId, 'Harborfall', {}, 10)).toHaveLength(1);
    expect(store.stateHash()).toBe(before);
    expect(store.recoverLexicalIndex()).toBe(false);
    store.replaceIndexedPath(
      indexedPath(projectId, 'docs/canon/aria.md', 'Moonlit sentinel', 'updated'),
    );
    expect(store.searchLexical(projectId, 'Harborfall', {}, 10)).toEqual([]);
    expect(store.searchLexical(projectId, 'Moonlit', {}, 10)).toHaveLength(1);
  });

  it('rolls back a rebuild if its final integrity check fails', () => {
    database = Database.open(':memory:');
    migrate(database, projectMigrations);
    const store = new KnowledgeStore(database);
    store.replaceIndexedPath(indexedPath(uuidv7(), 'docs/canon/aria.md', 'Harborfall', 'rollback'));
    database.exec("INSERT INTO knowledge_chunks_fts(knowledge_chunks_fts) VALUES ('delete-all')");
    const before = database.prepare('SELECT * FROM knowledge_chunks_fts_data ORDER BY id').all();
    const original = database.exec.bind(database);
    let checks = 0;
    const failure = new Error('Simulated post-rebuild check failure');
    vi.spyOn(database, 'exec').mockImplementation((sql) => {
      if (sql.includes('integrity-check') && ++checks === 2) throw failure;
      original(sql);
    });
    expect(() => store.recoverLexicalIndex()).toThrow(failure);
    expect(database.prepare('SELECT * FROM knowledge_chunks_fts_data ORDER BY id').all()).toEqual(
      before,
    );
  });

  it('does not recreate a missing FTS schema or change its retained content', () => {
    database = Database.open(':memory:');
    migrate(database, projectMigrations);
    const store = new KnowledgeStore(database);
    store.replaceIndexedPath(indexedPath(uuidv7(), 'docs/canon/aria.md', 'Harborfall', 'missing'));
    const before = store.stateHash();
    database.exec('DROP TABLE knowledge_chunks_fts');
    expect(() => store.recoverLexicalIndex()).toThrow('no such table');
    expect(store.stateHash()).toBe(before);
    expect(
      database.prepare("SELECT name FROM sqlite_master WHERE name = 'knowledge_chunks_fts'").get(),
    ).toBeUndefined();
  });

  it.each([5, 6, 10, 11, 26])(
    'propagates SQLite error %i without attempting to rebuild',
    (errcode) => {
      database = Database.open(':memory:');
      migrate(database, projectMigrations);
      const store = new KnowledgeStore(database);
      const original = database.exec.bind(database);
      const failure = Object.assign(new Error('Database unavailable or corrupt'), { errcode });
      const execution = vi.spyOn(database, 'exec').mockImplementation((sql) => {
        if (sql.includes('integrity-check')) throw failure;
        original(sql);
      });
      expect(() => store.recoverLexicalIndex()).toThrow(failure);
      expect(execution.mock.calls.some(([sql]) => sql.includes("'rebuild'"))).toBe(false);
    },
  );

  it('indexes FTS rows atomically with chunks and removes stale path content', () => {
    database = Database.open(':memory:');
    migrate(database, projectMigrations);
    const store = new KnowledgeStore(database);
    const projectId = uuidv7();
    store.replaceIndexedPath(
      indexedPath(projectId, 'docs/canon/aria.md', 'Harborfall navigator', 'first'),
    );
    expect(store.searchLexical(projectId, 'Harborfall', {}, 10)).toHaveLength(1);

    store.replaceIndexedPath(
      indexedPath(projectId, 'docs/canon/aria.md', 'Moonlit lighthouse', 'second'),
    );
    expect(store.searchLexical(projectId, 'Harborfall', {}, 10)).toHaveLength(0);
    expect(store.searchLexical(projectId, 'lighthouse', {}, 10)).toHaveLength(1);
    store.removeIndexedPath('docs/canon/aria.md');
    expect(store.searchLexical(projectId, 'lighthouse', {}, 10)).toHaveLength(0);
  });

  it('retains same-id records at separate paths so reconciliation can report conflicts', () => {
    database = Database.open(':memory:');
    migrate(database, projectMigrations);
    const store = new KnowledgeStore(database);
    const projectId = uuidv7();
    store.replaceIndexedPath(
      indexedPath(projectId, 'docs/canon/a.md', 'Aria lives in Harborfall', 'a'),
    );
    store.replaceIndexedPath(
      indexedPath(projectId, 'docs/canon/b.md', 'Aria lives in North Gate', 'b'),
    );
    expect(store.recordsById('char.aria-vale')).toHaveLength(2);
  });
});

function indexedPath(
  projectId: string,
  path: string,
  text: string,
  suffix: string,
): IndexedKnowledgePath {
  const indexedAt = new Date().toISOString();
  const record: CanonRecord = {
    schemaVersion: 1,
    id: 'char.aria-vale',
    type: 'character',
    title: 'Aria Vale',
    status: 'draft',
    tags: [],
    references: [],
    provenance: [],
    path,
    bodyExcerpt: text,
    revision: 'worktree',
    active: true,
    indexedAt,
  };
  const chunk: KnowledgeChunk = {
    chunkId: `${suffix}`.padStart(64, '0'),
    projectId,
    source: 'canon',
    path,
    recordId: record.id,
    revision: record.revision,
    startLine: 1,
    endLine: 1,
    text,
    tokensEstimate: 5,
  };
  return {
    path,
    source: 'canon',
    revision: record.revision,
    contentHash: suffix,
    mtimeMs: 1,
    size: text.length,
    chunkCount: 1,
    indexedAt,
    record,
    body: text,
    chunks: [chunk],
  };
}

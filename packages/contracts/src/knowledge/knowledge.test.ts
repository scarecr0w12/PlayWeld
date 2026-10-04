import { describe, expect, it } from 'vitest';
import { RpcErrorCode, RpcMethods, RpcNotifications, uuidv7 } from '../index';
import { compile } from '../validation';
import {
  CanonRecordSchema,
  IndexStatusSchema,
  KnowledgeChunkSchema,
  SearchHitSchema,
  SearchRequestSchema,
  VectorStoreConfigSchema,
} from './schema';

const validateCanonRecord = compile(CanonRecordSchema);
const validateChunk = compile(KnowledgeChunkSchema);
const validateSearch = compile(SearchRequestSchema);
const validateHit = compile(SearchHitSchema);
const validateStatus = compile(IndexStatusSchema);

const timestamp = '2026-09-29T12:00:00.000Z';
const projectId = uuidv7();
const record = {
  schemaVersion: 1,
  id: 'char.aria-vale',
  type: 'character',
  title: 'Aria Vale',
  status: 'accepted',
  module: 'story',
  tags: ['protagonist'],
  references: [
    { rel: 'located-in', target: 'loc.harborfall', confidence: 1, source: 'author' },
    { rel: 'mentions', target: 'quest.first-light', confidence: 0.6, source: 'inferred' },
  ],
  provenance: [{ kind: 'user', ref: 'user', at: timestamp }],
  path: 'docs/canon/characters/aria-vale.md',
  bodyExcerpt: 'A navigator from Harborfall.',
  revision: 'a'.repeat(40),
  active: true,
  indexedAt: timestamp,
};

describe('knowledge contracts', () => {
  it('supports embedded, managed, external and registered vector backends without breaking old Qdrant configurations', () => {
    const validate = compile(VectorStoreConfigSchema);
    for (const config of [
      { kind: 'qdrant', url: 'http://127.0.0.1:6333' },
      { kind: 'qdrant', deployment: 'managed-local' },
      { kind: 'qdrant', deployment: 'remote', url: 'https://vectors.example.com' },
      { kind: 'lancedb', deployment: 'embedded' },
      { kind: 'sqlite', deployment: 'embedded' },
      { kind: 'custom-store', deployment: 'remote' },
    ])
      expect(validate.check(config)).toBe(true);
    expect(validate.check({ kind: '../arbitrary-code' })).toBe(false);
    expect(validate.check({ kind: 'qdrant', deployment: 'unknown' })).toBe(false);
  });
  it('accepts canon records, typed references, provenance, and inactive records', () => {
    expect(validateCanonRecord.check(record)).toBe(true);
    expect(validateCanonRecord.check({ ...record, active: false, status: 'deprecated' })).toBe(
      true,
    );
    expect(
      validateCanonRecord.check({
        ...record,
        references: [{ rel: 'mentions', target: 'bad target', confidence: 1.2, source: 'author' }],
      }),
    ).toBe(false);
  });

  it('rejects malformed canon identifiers and statuses', () => {
    expect(validateCanonRecord.check({ ...record, id: 'Aria' })).toBe(false);
    expect(validateCanonRecord.check({ ...record, id: 'char..aria' })).toBe(false);
    expect(validateCanonRecord.check({ ...record, status: 'approved' })).toBe(false);
  });

  it('validates stable chunks, search requests, cited hits, and index status', () => {
    expect(
      validateChunk.check({
        chunkId: 'b'.repeat(64),
        projectId,
        source: 'canon',
        path: record.path,
        recordId: record.id,
        revision: record.revision,
        startLine: 10,
        endLine: 14,
        text: 'Aria navigates the western passage.',
        tokensEstimate: 7,
      }),
    ).toBe(true);
    expect(
      validateSearch.check({ projectId, query: 'western passage', mode: 'hybrid', limit: 10 }),
    ).toBe(true);
    expect(
      validateHit.check({
        chunkId: 'b'.repeat(64),
        score: 0.42,
        lexicalRank: 1,
        semanticRank: null,
        path: record.path,
        revision: record.revision,
        recordId: record.id,
        recordTitle: record.title,
        recordStatus: record.status,
        source: 'canon',
        quote: { text: 'Aria navigates the western passage.', startLine: 10, endLine: 14 },
        citation: 'docs/canon/characters/aria-vale.md@revision#L10-L14 [char.aria-vale]',
      }),
    ).toBe(true);
    expect(
      validateStatus.check({
        projectId,
        lastFullReconcileAt: null,
        lastIncrementalAt: null,
        chunks: 1,
        records: 1,
        vectors: null,
        vectorStore: { kind: 'none', reachable: false, collection: null, error: null },
        embeddingProfile: null,
        pending: 0,
        conflicts: [],
        brokenReferences: [],
      }),
    ).toBe(true);
  });

  it('declares knowledge RPC methods, notifications, and errors', () => {
    expect(RpcMethods['knowledge/records']).toBeDefined();
    expect(RpcMethods['knowledge/record']).toBeDefined();
    expect(RpcMethods['knowledge/write']).toBeDefined();
    expect(RpcMethods['knowledge/search']).toBeDefined();
    expect(RpcMethods['knowledge/index/rebuild']).toBeDefined();
    expect(RpcMethods['knowledge/embeddingProfile/set']).toBeDefined();
    expect(RpcMethods['knowledge/vectorStore/test']).toBeDefined();
    expect(RpcNotifications['knowledge/indexChanged']).toBeDefined();
    expect(RpcNotifications['knowledge/recordChanged']).toBeDefined();
    expect(RpcErrorCode.CanonRecordNotFound).toBe(-32100);
    expect(RpcErrorCode.VectorStoreUnavailable).toBe(-32104);
  });
});

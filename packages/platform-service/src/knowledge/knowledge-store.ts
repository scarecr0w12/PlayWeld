import { createHash } from 'node:crypto';
import type {
  CanonRecord,
  CanonReference,
  CanonStatus,
  EmbeddingProfile,
  IndexSource,
  KnowledgeChunk,
} from '@gamecrafter/contracts';
import type { Database } from '../db/database';

export interface IndexedKnowledgePath {
  path: string;
  source: IndexSource;
  revision: string;
  contentHash: string;
  mtimeMs: number;
  size: number;
  chunkCount: number;
  indexedAt: string;
  record?: CanonRecord;
  body?: string;
  chunks: KnowledgeChunk[];
}

export interface KnowledgeIndexFileState {
  path: string;
  source: IndexSource;
  revision: string;
  contentHash: string;
  mtimeMs: number;
  size: number;
  chunkCount: number;
  indexedAt: string;
}

export interface KnowledgeSearchFilter {
  sources?: IndexSource[];
  recordTypes?: string[];
  statuses?: CanonStatus[];
  includeInactive?: boolean;
}

export interface LexicalCandidate {
  chunk: KnowledgeChunk;
  recordType: string | null;
  recordTitle: string | null;
  recordStatus: CanonStatus | null;
  active: boolean;
  bm25: number;
}

interface KnowledgeChunkRow {
  chunkId: string;
  projectId: string;
  source: IndexSource;
  path: string;
  recordId: string | null;
  recordType: string | null;
  recordTitle: string | null;
  recordStatus: CanonStatus | null;
  active: number;
  revision: string;
  startLine: number;
  endLine: number;
  text: string;
  tokensEstimate: number;
  bm25: number;
}

interface RecordRow {
  recordJson: string;
  body: string;
}

interface EmbeddingProfileRow {
  profileId: string;
  projectId: string;
  modelId: string;
  providerAccountId: string;
  dimensions: number;
  version: number;
  createdAt: string;
}

type IndexStateRow = KnowledgeIndexFileState;

export interface KnowledgeConflict {
  id: string;
  paths: string[];
}

export interface KnowledgeVectorMapping {
  chunkId: string;
  projectId: string;
  profileVersion: number;
  pointId: string;
  collection: string;
  createdAt: string;
}

export interface KnowledgeIndexMeta {
  projectId: string;
  lastFullReconcileAt: string | null;
  lastIncrementalAt: string | null;
  degraded: string | null;
}

export class KnowledgeStore {
  constructor(private readonly database: Database) {}

  /** Repair only the disposable external-content FTS index, never its content tables. */
  recoverLexicalIndex(): boolean {
    return this.database.transaction(() => {
      const check = () =>
        this.database.exec(
          "INSERT INTO knowledge_chunks_fts(knowledge_chunks_fts, rank) VALUES ('integrity-check', 1)",
        );
      try {
        check();
        return false;
      } catch (error) {
        // SQLITE_CORRUPT_VTAB is the FTS consistency failure. Locks, I/O failures,
        // missing schemas and general database corruption must fail without repair.
        if ((error as { errcode?: number } | null)?.errcode !== 267) throw error;
      }
      this.database.exec(
        "INSERT INTO knowledge_chunks_fts(knowledge_chunks_fts) VALUES ('rebuild')",
      );
      check();
      return true;
    });
  }

  replaceIndexedPath(input: IndexedKnowledgePath): void {
    this.database.transaction(() => {
      this.database.prepare('DELETE FROM knowledge_chunks WHERE path = ?').run(input.path);
      this.database.prepare('DELETE FROM canon_references WHERE source_path = ?').run(input.path);
      this.database.prepare('DELETE FROM canon_records WHERE path = ?').run(input.path);
      if (input.record) {
        const record = input.record;
        this.database
          .prepare(
            `INSERT INTO canon_records
              (path, record_id, record_type, status, module, active, revision, record_json, body, indexed_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          )
          .run(
            record.path,
            record.id,
            record.type,
            record.status,
            record.module ?? null,
            record.active ? 1 : 0,
            record.revision,
            JSON.stringify(record),
            input.body ?? '',
            record.indexedAt,
          );
        for (const reference of record.references) {
          this.database
            .prepare(
              `INSERT INTO canon_references
                (source_record_id, source_path, rel, target_record_id, confidence, source)
               VALUES (?, ?, ?, ?, ?, ?)`,
            )
            .run(
              record.id,
              record.path,
              reference.rel,
              reference.target,
              reference.confidence,
              reference.source,
            );
        }
      }
      for (const chunk of input.chunks) {
        const record = input.record;
        this.database
          .prepare(
            `INSERT INTO knowledge_chunks
              (chunk_id, project_id, source, path, record_id, record_type, record_title,
               record_status, active, revision, start_line, end_line, text, tokens_estimate)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          )
          .run(
            chunk.chunkId,
            chunk.projectId,
            chunk.source,
            chunk.path,
            chunk.recordId,
            record?.type ?? null,
            record?.title ?? null,
            record?.status ?? null,
            record?.active === false || chunk.source === 'inactive' ? 0 : 1,
            chunk.revision,
            chunk.startLine,
            chunk.endLine,
            chunk.text,
            chunk.tokensEstimate,
          );
      }
      this.writeState(input);
    });
  }

  removeIndexedPath(path: string): void {
    this.database.transaction(() => {
      this.database.prepare('DELETE FROM knowledge_chunks WHERE path = ?').run(path);
      this.database.prepare('DELETE FROM canon_references WHERE source_path = ?').run(path);
      this.database.prepare('DELETE FROM canon_records WHERE path = ?').run(path);
      this.database.prepare('DELETE FROM knowledge_index_state WHERE path = ?').run(path);
    });
  }

  listRecords(
    filter: {
      type?: string;
      status?: CanonStatus;
      module?: string;
      includeInactive?: boolean;
      search?: string;
    } = {},
  ): CanonRecord[] {
    const conditions: string[] = [];
    const values: Array<string | number> = [];
    if (filter.type) {
      conditions.push('record_type = ?');
      values.push(filter.type);
    }
    if (filter.status) {
      conditions.push('status = ?');
      values.push(filter.status);
    }
    if (filter.module) {
      conditions.push('module = ?');
      values.push(filter.module);
    }
    if (filter.includeInactive !== true) conditions.push('active = 1');
    if (filter.search?.trim()) {
      conditions.push('(lower(record_json) LIKE ? OR lower(body) LIKE ?)');
      const term = `%${filter.search.trim().toLowerCase()}%`;
      values.push(term, term);
    }
    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    return this.database
      .prepare(`SELECT record_json AS recordJson FROM canon_records ${where} ORDER BY path`)
      .all<{ recordJson: string }>(...values)
      .map((row) => JSON.parse(row.recordJson) as CanonRecord);
  }

  recordsById(recordId: string): CanonRecord[] {
    return this.database
      .prepare(
        'SELECT record_json AS recordJson FROM canon_records WHERE record_id = ? ORDER BY path',
      )
      .all<{ recordJson: string }>(recordId)
      .map((row) => JSON.parse(row.recordJson) as CanonRecord);
  }

  recordByPath(path: string): { record: CanonRecord; body: string } | undefined {
    const row = this.database
      .prepare('SELECT record_json AS recordJson, body FROM canon_records WHERE path = ?')
      .get<RecordRow>(path);
    return row ? { record: JSON.parse(row.recordJson) as CanonRecord, body: row.body } : undefined;
  }

  recordBody(path: string): string | undefined {
    return this.database
      .prepare('SELECT body FROM canon_records WHERE path = ?')
      .get<{ body: string }>(path)?.body;
  }

  inboundReferences(recordId: string): Array<{
    recordId: string;
    title: string;
    rel: string;
    target: string;
    confidence: number;
    source: CanonReference['source'];
  }> {
    return this.database
      .prepare(
        `SELECT r.source_record_id AS recordId, c.record_json AS recordJson, r.rel, r.target_record_id AS target,
                r.confidence, r.source
         FROM canon_references r JOIN canon_records c ON c.path = r.source_path
         WHERE r.target_record_id = ? ORDER BY r.source_record_id, r.rel`,
      )
      .all<{
        recordId: string;
        recordJson: string;
        rel: string;
        target: string;
        confidence: number;
        source: CanonReference['source'];
      }>(recordId)
      .map((row) => ({
        recordId: row.recordId,
        title: (JSON.parse(row.recordJson) as CanonRecord).title,
        rel: row.rel,
        target: row.target,
        confidence: row.confidence,
        source: row.source,
      }));
  }

  searchLexical(
    projectId: string,
    query: string,
    filter: KnowledgeSearchFilter = {},
    limit = 10,
  ): LexicalCandidate[] {
    const match = ftsQuery(query);
    if (!match) return [];
    const conditions = ['knowledge_chunks_fts MATCH ?', 'c.project_id = ?'];
    const values: Array<string | number> = [match, projectId];
    if (filter.sources?.length) {
      conditions.push(`c.source IN (${filter.sources.map(() => '?').join(', ')})`);
      values.push(...filter.sources);
    }
    if (filter.recordTypes?.length) {
      conditions.push(`c.record_type IN (${filter.recordTypes.map(() => '?').join(', ')})`);
      values.push(...filter.recordTypes);
    }
    if (filter.statuses?.length) {
      conditions.push(`c.record_status IN (${filter.statuses.map(() => '?').join(', ')})`);
      values.push(...filter.statuses);
    }
    if (filter.includeInactive !== true) conditions.push('c.active = 1');
    const rows = this.database
      .prepare(
        `SELECT c.chunk_id AS chunkId, c.project_id AS projectId, c.source, c.path,
                c.record_id AS recordId, c.record_type AS recordType, c.record_title AS recordTitle,
                c.record_status AS recordStatus, c.active, c.revision, c.start_line AS startLine,
                c.end_line AS endLine, c.text, c.tokens_estimate AS tokensEstimate,
                bm25(knowledge_chunks_fts) AS bm25
         FROM knowledge_chunks_fts JOIN knowledge_chunks c ON c.rowid = knowledge_chunks_fts.rowid
         WHERE ${conditions.join(' AND ')}
         ORDER BY bm25, c.path, c.start_line LIMIT ?`,
      )
      .all<KnowledgeChunkRow>(...values, Math.max(1, Math.min(Math.floor(limit), 1000)));
    return rows.map((row) => ({
      chunk: {
        chunkId: row.chunkId,
        projectId: row.projectId,
        source: row.source,
        path: row.path,
        recordId: row.recordId,
        revision: row.revision,
        startLine: row.startLine,
        endLine: row.endLine,
        text: row.text,
        tokensEstimate: row.tokensEstimate,
      },
      recordType: row.recordType,
      recordTitle: row.recordTitle,
      recordStatus: row.recordStatus,
      active: row.active === 1,
      bm25: row.bm25,
    }));
  }

  chunksByIds(projectId: string, chunkIds: string[]): KnowledgeChunk[] {
    if (chunkIds.length === 0) return [];
    return this.database
      .prepare(
        `SELECT chunk_id AS chunkId, project_id AS projectId, source, path, record_id AS recordId,
                revision, start_line AS startLine, end_line AS endLine, text,
                tokens_estimate AS tokensEstimate
         FROM knowledge_chunks WHERE project_id = ? AND chunk_id IN (${chunkIds.map(() => '?').join(', ')})`,
      )
      .all<KnowledgeChunk>(projectId, ...chunkIds);
  }

  chunkCandidatesByIds(
    projectId: string,
    chunkIds: string[],
    filter: KnowledgeSearchFilter = {},
  ): LexicalCandidate[] {
    if (chunkIds.length === 0) return [];
    const conditions = ['project_id = ?', `chunk_id IN (${chunkIds.map(() => '?').join(', ')})`];
    const values: Array<string | number> = [projectId, ...chunkIds];
    if (filter.sources?.length) {
      conditions.push(`source IN (${filter.sources.map(() => '?').join(', ')})`);
      values.push(...filter.sources);
    }
    if (filter.recordTypes?.length) {
      conditions.push(`record_type IN (${filter.recordTypes.map(() => '?').join(', ')})`);
      values.push(...filter.recordTypes);
    }
    if (filter.statuses?.length) {
      conditions.push(`record_status IN (${filter.statuses.map(() => '?').join(', ')})`);
      values.push(...filter.statuses);
    }
    if (filter.includeInactive !== true) conditions.push('active = 1');
    const rows = this.database
      .prepare(
        `SELECT chunk_id AS chunkId, project_id AS projectId, source, path, record_id AS recordId,
                record_type AS recordType, record_title AS recordTitle, record_status AS recordStatus,
                active, revision, start_line AS startLine, end_line AS endLine, text,
                tokens_estimate AS tokensEstimate, 0.0 AS bm25
         FROM knowledge_chunks WHERE ${conditions.join(' AND ')}`,
      )
      .all<KnowledgeChunkRow>(...values);
    return rows.map((row) => ({
      chunk: {
        chunkId: row.chunkId,
        projectId: row.projectId,
        source: row.source,
        path: row.path,
        recordId: row.recordId,
        revision: row.revision,
        startLine: row.startLine,
        endLine: row.endLine,
        text: row.text,
        tokensEstimate: row.tokensEstimate,
      },
      recordType: row.recordType,
      recordTitle: row.recordTitle,
      recordStatus: row.recordStatus,
      active: row.active === 1,
      bm25: row.bm25,
    }));
  }

  replaceConflicts(conflicts: KnowledgeConflict[], updatedAt: string): void {
    this.database.transaction(() => {
      this.database.exec('DELETE FROM knowledge_conflicts');
      for (const conflict of conflicts) {
        this.database
          .prepare(
            'INSERT INTO knowledge_conflicts(record_id, paths_json, updated_at) VALUES (?, ?, ?)',
          )
          .run(conflict.id, JSON.stringify([...conflict.paths].sort()), updatedAt);
      }
    });
  }

  conflicts(): KnowledgeConflict[] {
    return this.database
      .prepare(
        'SELECT record_id AS id, paths_json AS pathsJson FROM knowledge_conflicts ORDER BY record_id',
      )
      .all<{ id: string; pathsJson: string }>()
      .map((row) => ({ id: row.id, paths: JSON.parse(row.pathsJson) as string[] }));
  }

  activeEmbeddingProfile(projectId: string): EmbeddingProfile | null {
    const row = this.database
      .prepare(
        `SELECT profile_id AS profileId, project_id AS projectId, model_id AS modelId,
                provider_account_id AS providerAccountId, dimensions, version, created_at AS createdAt
         FROM embedding_profiles WHERE project_id = ? AND active = 1`,
      )
      .get<EmbeddingProfileRow>(projectId);
    return row ?? null;
  }

  embeddingProfiles(projectId: string): EmbeddingProfile[] {
    return this.database
      .prepare(
        `SELECT profile_id AS profileId, project_id AS projectId, model_id AS modelId,
                provider_account_id AS providerAccountId, dimensions, version, created_at AS createdAt
         FROM embedding_profiles WHERE project_id = ? ORDER BY version`,
      )
      .all<EmbeddingProfileRow>(projectId);
  }

  setEmbeddingProfile(profile: EmbeddingProfile): void {
    this.database.transaction(() => {
      this.database
        .prepare('UPDATE embedding_profiles SET active = 0 WHERE project_id = ?')
        .run(profile.projectId);
      this.database
        .prepare(
          `INSERT INTO embedding_profiles
            (profile_id, project_id, model_id, provider_account_id, dimensions, version, created_at, active)
           VALUES (?, ?, ?, ?, ?, ?, ?, 1)`,
        )
        .run(
          profile.profileId,
          profile.projectId,
          profile.modelId,
          profile.providerAccountId,
          profile.dimensions,
          profile.version,
          profile.createdAt,
        );
    });
  }

  vectorMappings(projectId: string, profileVersion?: number): KnowledgeVectorMapping[] {
    const query =
      profileVersion === undefined
        ? `SELECT chunk_id AS chunkId, project_id AS projectId, profile_version AS profileVersion,
                point_id AS pointId, collection, created_at AS createdAt
         FROM knowledge_vectors WHERE project_id = ? ORDER BY profile_version, chunk_id`
        : `SELECT chunk_id AS chunkId, project_id AS projectId, profile_version AS profileVersion,
                point_id AS pointId, collection, created_at AS createdAt
         FROM knowledge_vectors WHERE project_id = ? AND profile_version = ? ORDER BY chunk_id`;
    return this.database
      .prepare(query)
      .all<KnowledgeVectorMapping>(
        ...(profileVersion === undefined ? [projectId] : [projectId, profileVersion]),
      );
  }

  saveVectorMapping(mapping: KnowledgeVectorMapping): void {
    this.database
      .prepare(
        `INSERT INTO knowledge_vectors(chunk_id, project_id, profile_version, point_id, collection, created_at)
         VALUES (?, ?, ?, ?, ?, ?)
         ON CONFLICT(chunk_id, profile_version) DO UPDATE SET point_id = excluded.point_id,
           collection = excluded.collection, created_at = excluded.created_at`,
      )
      .run(
        mapping.chunkId,
        mapping.projectId,
        mapping.profileVersion,
        mapping.pointId,
        mapping.collection,
        mapping.createdAt,
      );
  }

  removeVectorMappings(
    projectId: string,
    chunkIds?: string[],
    profileVersion?: number,
  ): KnowledgeVectorMapping[] {
    const conditions = ['project_id = ?'];
    const values: Array<string | number> = [projectId];
    if (profileVersion !== undefined) {
      conditions.push('profile_version = ?');
      values.push(profileVersion);
    }
    if (chunkIds?.length) {
      conditions.push(`chunk_id IN (${chunkIds.map(() => '?').join(', ')})`);
      values.push(...chunkIds);
    }
    const rows = this.database
      .prepare(
        `SELECT chunk_id AS chunkId, project_id AS projectId, profile_version AS profileVersion,
                point_id AS pointId, collection, created_at AS createdAt
         FROM knowledge_vectors WHERE ${conditions.join(' AND ')}`,
      )
      .all<KnowledgeVectorMapping>(...values);
    this.database
      .prepare(`DELETE FROM knowledge_vectors WHERE ${conditions.join(' AND ')}`)
      .run(...values);
    return rows;
  }

  chunkIdsForPath(path: string): string[] {
    return this.database
      .prepare('SELECT chunk_id AS chunkId FROM knowledge_chunks WHERE path = ? ORDER BY chunk_id')
      .all<{ chunkId: string }>(path)
      .map((row) => row.chunkId);
  }

  indexCounts(projectId: string): { chunks: number; records: number; vectors: number } {
    const chunks =
      this.database
        .prepare('SELECT COUNT(*) AS count FROM knowledge_chunks WHERE project_id = ?')
        .get<{ count: number }>(projectId)?.count ?? 0;
    const records =
      this.database.prepare('SELECT COUNT(*) AS count FROM canon_records').get<{ count: number }>()
        ?.count ?? 0;
    const vectors =
      this.database
        .prepare('SELECT COUNT(*) AS count FROM knowledge_vectors WHERE project_id = ?')
        .get<{ count: number }>(projectId)?.count ?? 0;
    return { chunks, records, vectors };
  }

  indexMeta(projectId: string): KnowledgeIndexMeta {
    return (
      this.database
        .prepare(
          `SELECT project_id AS projectId, last_full_reconcile_at AS lastFullReconcileAt,
                last_incremental_at AS lastIncrementalAt, degraded
         FROM knowledge_index_meta WHERE project_id = ?`,
        )
        .get<KnowledgeIndexMeta>(projectId) ?? {
        projectId,
        lastFullReconcileAt: null,
        lastIncrementalAt: null,
        degraded: null,
      }
    );
  }

  setIndexMeta(meta: KnowledgeIndexMeta): void {
    this.database
      .prepare(
        `INSERT INTO knowledge_index_meta(project_id, last_full_reconcile_at, last_incremental_at, degraded)
         VALUES (?, ?, ?, ?)
         ON CONFLICT(project_id) DO UPDATE SET
           last_full_reconcile_at = excluded.last_full_reconcile_at,
           last_incremental_at = excluded.last_incremental_at,
           degraded = excluded.degraded`,
      )
      .run(meta.projectId, meta.lastFullReconcileAt, meta.lastIncrementalAt, meta.degraded);
  }

  stateHash(): string {
    const hash = createHash('sha256');
    for (const table of [
      'canon_records',
      'canon_references',
      'knowledge_chunks',
      'knowledge_index_state',
      'knowledge_index_meta',
      'embedding_profiles',
      'knowledge_vectors',
      'knowledge_conflicts',
    ]) {
      const rows = this.database
        .prepare(`SELECT * FROM ${table} ORDER BY rowid`)
        .all<Record<string, unknown>>();
      hash.update(table, 'utf8');
      hash.update(JSON.stringify(rows), 'utf8');
    }
    return hash.digest('hex');
  }

  indexState(path?: string): KnowledgeIndexFileState[] | KnowledgeIndexFileState | undefined {
    if (path) {
      return this.database
        .prepare(
          `SELECT path, source, revision, content_hash AS contentHash, mtime_ms AS mtimeMs,
                  size, chunk_count AS chunkCount, indexed_at AS indexedAt
           FROM knowledge_index_state WHERE path = ?`,
        )
        .get<IndexStateRow>(path);
    }
    return this.database
      .prepare(
        `SELECT path, source, revision, content_hash AS contentHash, mtime_ms AS mtimeMs,
                size, chunk_count AS chunkCount, indexed_at AS indexedAt
         FROM knowledge_index_state ORDER BY path`,
      )
      .all<IndexStateRow>();
  }

  private writeState(state: KnowledgeIndexFileState): void {
    this.database
      .prepare(
        `INSERT INTO knowledge_index_state(path, source, revision, content_hash, mtime_ms, size, chunk_count, indexed_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT(path) DO UPDATE SET source = excluded.source, revision = excluded.revision,
           content_hash = excluded.content_hash, mtime_ms = excluded.mtime_ms, size = excluded.size,
           chunk_count = excluded.chunk_count, indexed_at = excluded.indexed_at`,
      )
      .run(
        state.path,
        state.source,
        state.revision,
        state.contentHash,
        state.mtimeMs,
        state.size,
        state.chunkCount,
        state.indexedAt,
      );
  }
}

function ftsQuery(query: string): string {
  const terms = query.match(/[\p{L}\p{N}_-]+/gu) ?? [];
  return terms.map((term) => `"${term.replace(/"/g, '""')}"`).join(' OR ');
}

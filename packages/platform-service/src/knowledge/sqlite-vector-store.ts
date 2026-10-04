import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { RpcError, RpcErrorCode, type EmbeddingProfile } from '@gamecrafter/contracts';
import { Database } from '../db/database';
import {
  validateVectorFilter,
  type VectorFilter,
  type VectorPoint,
  type VectorSearchHit,
  type VectorStore,
  type VectorStoreHealth,
} from './vector-store';

const SCHEMA_VERSION = 1;
const MAX_TOP_K = 1000;

export interface SqliteVectorStoreOptions {
  projectId: string;
  databasePath: string;
}

interface VectorRow {
  point_id: string;
  vector_json: string;
  payload_json: string;
}

export class SqliteVectorStore implements VectorStore {
  readonly kind = 'sqlite' as const;
  private readonly database: Database;
  private closed = false;

  constructor(private readonly options: SqliteVectorStoreOptions) {
    mkdirSync(dirname(options.databasePath), { recursive: true });
    this.database = Database.open(options.databasePath);
    this.database.exec(`
      CREATE TABLE IF NOT EXISTS vector_collections (
        project_id TEXT NOT NULL,
        profile_id TEXT NOT NULL,
        profile_version INTEGER NOT NULL,
        dimensions INTEGER NOT NULL,
        schema_version INTEGER NOT NULL,
        PRIMARY KEY (project_id, profile_id, profile_version)
      );
      CREATE INDEX IF NOT EXISTS idx_vector_collections_project_version
        ON vector_collections(project_id, profile_version);
      CREATE TABLE IF NOT EXISTS vector_points (
        project_id TEXT NOT NULL,
        profile_id TEXT NOT NULL,
        profile_version INTEGER NOT NULL,
        point_id TEXT NOT NULL,
        dimensions INTEGER NOT NULL,
        vector_json TEXT NOT NULL,
        payload_json TEXT NOT NULL,
        schema_version INTEGER NOT NULL,
        PRIMARY KEY (project_id, profile_id, profile_version, point_id),
        FOREIGN KEY (project_id, profile_id, profile_version)
          REFERENCES vector_collections(project_id, profile_id, profile_version)
          ON DELETE CASCADE
      );
      CREATE INDEX IF NOT EXISTS idx_vector_points_project_version
        ON vector_points(project_id, profile_version, profile_id);
    `);
  }

  collectionName(profile: EmbeddingProfile): string {
    this.assertProfile(profile);
    return `${profile.projectId}_${profile.profileId}_v${profile.version}`;
  }

  async ensureCollection(profile: EmbeddingProfile): Promise<string> {
    this.assertProfile(profile);
    return this.ensureCollectionRow(profile);
  }

  private ensureCollectionRow(profile: EmbeddingProfile): string {
    this.database
      .prepare(
        `INSERT INTO vector_collections
          (project_id, profile_id, profile_version, dimensions, schema_version)
         VALUES (?, ?, ?, ?, ?)
         ON CONFLICT(project_id, profile_id, profile_version) DO NOTHING`,
      )
      .run(
        profile.projectId,
        profile.profileId,
        profile.version,
        profile.dimensions,
        SCHEMA_VERSION,
      );
    const stored = this.database
      .prepare(
        `SELECT dimensions FROM vector_collections
         WHERE project_id = ? AND profile_id = ? AND profile_version = ?`,
      )
      .get<{ dimensions: number }>(profile.projectId, profile.profileId, profile.version);
    if (stored?.dimensions !== profile.dimensions) {
      throw vectorStoreError('Embedding profile dimensions do not match its SQLite collection.');
    }
    return this.collectionName(profile);
  }

  async upsert(profile: EmbeddingProfile, points: VectorPoint[]): Promise<void> {
    this.assertProfile(profile);
    if (points.length === 0) return;
    const normalized = points.map((point) => {
      this.assertVector(point.vector, profile.dimensions);
      if (
        point.payload.projectId !== undefined &&
        point.payload.projectId !== this.options.projectId
      ) {
        throw vectorStoreError('A vector point cannot be written for a different Project.');
      }
      return {
        id: point.id,
        vector: JSON.stringify(point.vector),
        payload: JSON.stringify({ ...point.payload, projectId: this.options.projectId }),
      };
    });
    this.database.transaction(() => {
      this.ensureCollectionRow(profile);
      const statement = this.database.prepare(
        `INSERT INTO vector_points
          (project_id, profile_id, profile_version, point_id, dimensions, vector_json, payload_json, schema_version)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT(project_id, profile_id, profile_version, point_id) DO UPDATE SET
           dimensions = excluded.dimensions,
           vector_json = excluded.vector_json,
           payload_json = excluded.payload_json,
           schema_version = excluded.schema_version`,
      );
      for (const point of normalized) {
        statement.run(
          this.options.projectId,
          profile.profileId,
          profile.version,
          point.id,
          profile.dimensions,
          point.vector,
          point.payload,
          SCHEMA_VERSION,
        );
      }
    });
  }

  async delete(profile: EmbeddingProfile, pointIds: string[]): Promise<void> {
    this.assertProfile(profile);
    if (pointIds.length === 0) return;
    const placeholders = pointIds.map(() => '?').join(', ');
    this.database
      .prepare(
        `DELETE FROM vector_points
         WHERE project_id = ? AND profile_id = ? AND profile_version = ? AND point_id IN (${placeholders})`,
      )
      .run(this.options.projectId, profile.profileId, profile.version, ...pointIds);
  }

  async search(
    profile: EmbeddingProfile,
    vector: number[],
    filter: VectorFilter,
    limit: number,
  ): Promise<VectorSearchHit[]> {
    this.assertProfile(profile);
    validateVectorFilter(filter);
    this.assertVector(vector, profile.dimensions);
    const topK = Number.isFinite(limit)
      ? Math.max(1, Math.min(Math.floor(limit), MAX_TOP_K))
      : MAX_TOP_K;
    const { where, params } = this.filterWhere(profile, filter);
    const rows = this.database
      .prepare(
        `SELECT point_id, vector_json, payload_json FROM vector_points
         WHERE ${where}`,
      )
      .all<VectorRow>(...params);
    const top: VectorSearchHit[] = [];
    for (const row of rows) {
      const storedVector = parseVector(row.vector_json);
      if (storedVector.length !== profile.dimensions) {
        throw vectorStoreError('SQLite vector row has an unexpected number of dimensions.');
      }
      const score = cosineSimilarity(vector, storedVector);
      const hit: VectorSearchHit = {
        id: row.point_id,
        score,
        payload: parsePayload(row.payload_json),
      };
      const index = top.findIndex(
        (candidate) =>
          candidate.score < hit.score ||
          (candidate.score === hit.score && candidate.id.localeCompare(hit.id) > 0),
      );
      if (index < 0) top.push(hit);
      else top.splice(index, 0, hit);
      if (top.length > topK) top.pop();
    }
    return top;
  }

  async count(profile: EmbeddingProfile, filter: VectorFilter): Promise<number> {
    this.assertProfile(profile);
    validateVectorFilter(filter);
    const { where, params } = this.filterWhere(profile, filter);
    const result = this.database
      .prepare(`SELECT COUNT(*) AS count FROM vector_points WHERE ${where}`)
      .get<{ count: number }>(...params);
    return result?.count ?? 0;
  }

  async existingIds(profile: EmbeddingProfile, pointIds: string[]): Promise<string[]> {
    this.assertProfile(profile);
    if (!pointIds.length) return [];
    return this.database
      .prepare(
        `SELECT point_id FROM vector_points
      WHERE project_id = ? AND profile_id = ? AND profile_version = ? AND point_id IN (${pointIds.map(() => '?').join(', ')})`,
      )
      .all<{ point_id: string }>(profile.projectId, profile.profileId, profile.version, ...pointIds)
      .map((row) => row.point_id);
  }

  async health(profile?: EmbeddingProfile): Promise<VectorStoreHealth> {
    if (profile) this.assertProfile(profile);
    try {
      if (this.closed) throw new Error('SQLite vector store is closed.');
      this.database.prepare('SELECT 1 AS healthy').get();
      return {
        kind: this.kind,
        reachable: true,
        collection: profile ? this.collectionName(profile) : null,
        error: null,
        version: String(SCHEMA_VERSION),
      };
    } catch (error) {
      return {
        kind: this.kind,
        reachable: false,
        collection: profile ? this.collectionName(profile) : null,
        error: error instanceof Error ? error.message : String(error),
        version: String(SCHEMA_VERSION),
      };
    }
  }

  async close(): Promise<void> {
    if (this.closed) return;
    this.database.close();
    this.closed = true;
  }

  private filterWhere(
    profile: EmbeddingProfile,
    filter: VectorFilter,
  ): { where: string; params: Array<string | number> } {
    const predicates = [
      'project_id = ?',
      'profile_id = ?',
      'profile_version = ?',
      'schema_version = ?',
      'dimensions = ?',
    ];
    const params: Array<string | number> = [
      this.options.projectId,
      profile.profileId,
      profile.version,
      SCHEMA_VERSION,
      profile.dimensions,
    ];
    appendJsonFilter(predicates, params, '$.source', filter.sources);
    appendJsonFilter(predicates, params, '$.recordType', filter.recordTypes);
    appendJsonFilter(predicates, params, '$.recordStatus', filter.statuses);
    if (filter.includeInactive !== true)
      predicates.push("json_extract(payload_json, '$.active') = 1");
    return { where: predicates.join(' AND '), params };
  }

  private assertProfile(profile: EmbeddingProfile): void {
    if (this.closed) throw vectorStoreError('SQLite vector store is closed.');
    if (profile.projectId !== this.options.projectId) {
      throw vectorStoreError('Vector profile belongs to a different Project.');
    }
    if (!Number.isSafeInteger(profile.dimensions) || profile.dimensions <= 0) {
      throw vectorStoreError('Embedding profile dimensions must be a positive integer.');
    }
    if (!Number.isSafeInteger(profile.version) || profile.version <= 0) {
      throw vectorStoreError('Embedding profile version must be a positive integer.');
    }
  }

  private assertVector(vector: number[], dimensions: number): void {
    if (
      !Array.isArray(vector) ||
      vector.length !== dimensions ||
      vector.some((value) => typeof value !== 'number' || !Number.isFinite(value)) ||
      vector.every((value) => value === 0)
    ) {
      throw vectorStoreError(
        'Invalid vector dimensions or values; vectors must have finite nonzero magnitude.',
      );
    }
  }
}

function appendJsonFilter(
  predicates: string[],
  params: Array<string | number>,
  jsonPath: '$.source' | '$.recordType' | '$.recordStatus',
  values: string[] | undefined,
): void {
  if (values === undefined) return;
  if (values.length === 0) {
    predicates.push('0 = 1');
    return;
  }
  predicates.push(
    `json_extract(payload_json, '${jsonPath}') IN (${values.map(() => '?').join(', ')})`,
  );
  params.push(...values);
}

function cosineSimilarity(query: number[], stored: number[]): number {
  const queryScale = query.reduce((scale, value) => Math.max(scale, Math.abs(value)), 0);
  const storedScale = stored.reduce((scale, value) => Math.max(scale, Math.abs(value)), 0);
  const normalizedQuery = query.map((value) => value / queryScale);
  const normalizedStored = stored.map((value) => value / storedScale);
  const dot = normalizedQuery.reduce(
    (sum, value, index) => sum + value * normalizedStored[index]!,
    0,
  );
  const queryMagnitude = Math.sqrt(normalizedQuery.reduce((sum, value) => sum + value * value, 0));
  const storedMagnitude = Math.sqrt(
    normalizedStored.reduce((sum, value) => sum + value * value, 0),
  );
  const score = dot / (queryMagnitude * storedMagnitude);
  return Math.max(-1, Math.min(1, score));
}

function parseVector(value: string): number[] {
  const parsed: unknown = JSON.parse(value);
  if (
    !Array.isArray(parsed) ||
    parsed.some((entry) => typeof entry !== 'number' || !Number.isFinite(entry))
  ) {
    throw vectorStoreError('SQLite vector row contains invalid vector data.');
  }
  return parsed as number[];
}

function parsePayload(value: string): Record<string, unknown> {
  const parsed: unknown = JSON.parse(value);
  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
    throw vectorStoreError('SQLite vector row contains invalid payload data.');
  }
  return parsed as Record<string, unknown>;
}

function vectorStoreError(message: string): RpcError {
  return new RpcError(message, RpcErrorCode.VectorStoreUnavailable);
}

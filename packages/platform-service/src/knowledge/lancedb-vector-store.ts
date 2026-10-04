import { resolve } from 'node:path';
import type { Connection, Table } from '@lancedb/lancedb';
import { Field, FixedSizeList, Float32, Int32, Schema, Utf8 } from 'apache-arrow';
import { RpcError, RpcErrorCode, type EmbeddingProfile } from '@gamecrafter/contracts';
import type {
  VectorFilter,
  VectorPoint,
  VectorSearchHit,
  VectorStore,
  VectorStoreHealth,
} from './vector-store';

export interface LanceDbVectorStoreOptions {
  projectId: string;
  directory: string;
}

export class LanceDbVectorStore implements VectorStore {
  readonly kind = 'lancedb' as const;
  private readonly projectId: string;
  private readonly directory: string;
  private connection: Connection | undefined;
  private connectionPromise: Promise<Connection> | undefined;
  private readonly tables = new Map<string, Table>();
  private writeTail: Promise<void> = Promise.resolve();

  constructor(options: LanceDbVectorStoreOptions) {
    if (!options.projectId.trim() || !options.directory.trim()) {
      throw unavailable('LanceDB requires a Project ID and database directory.');
    }
    this.projectId = options.projectId;
    this.directory = resolve(options.directory);
  }

  collectionName(profile: EmbeddingProfile): string {
    this.assertProfile(profile);
    const projectId = this.projectId.replace(/[^A-Za-z0-9_-]/g, '_');
    return `gamecrafter_${projectId}_v${profile.version}_d${profile.dimensions}`;
  }

  ensureCollection(profile: EmbeddingProfile): Promise<string> {
    return this.serializeWrite(async () => {
      await this.ensureTable(profile);
      return this.collectionName(profile);
    });
  }

  async upsert(profile: EmbeddingProfile, points: VectorPoint[]): Promise<void> {
    this.assertProfile(profile);
    const rows = points.map((point) => this.row(profile, point));
    if (rows.length === 0) return;
    await this.serializeWrite(async () => {
      const table = await this.ensureTable(profile);
      await table.mergeInsert('id').whenMatchedUpdateAll().whenNotMatchedInsertAll().execute(rows);
    });
  }

  async delete(profile: EmbeddingProfile, pointIds: string[]): Promise<void> {
    this.assertProfile(profile);
    if (!Array.isArray(pointIds) || pointIds.some((id) => typeof id !== 'string' || !id.trim())) {
      throw unavailable('LanceDB point IDs must be non-empty strings.');
    }
    if (pointIds.length === 0) return;
    await this.serializeWrite(async () => {
      const table = await this.ensureTable(profile);
      await table.delete(
        `projectId = ${quoteSql(this.projectId)} AND id IN (${pointIds.map(quoteSql).join(', ')})`,
      );
    });
  }

  async search(
    profile: EmbeddingProfile,
    vector: number[],
    filter: VectorFilter,
    limit: number,
  ): Promise<VectorSearchHit[]> {
    this.assertProfile(profile);
    this.assertVector(vector, profile.dimensions);
    this.assertLimit(limit);
    const table = await this.getEnsuredTable(profile);
    const rows = await table
      .vectorSearch(new Float32Array(vector))
      .distanceType('cosine')
      .where(this.filterSql(filter))
      .limit(Math.min(limit, 1000))
      .toArray();
    return rows.map((row) => {
      const value = row as Record<string, unknown>;
      if (
        typeof value.id !== 'string' ||
        typeof value._distance !== 'number' ||
        typeof value.payloadJson !== 'string'
      ) {
        throw unavailable('LanceDB returned an invalid vector search result.');
      }
      let payload: unknown;
      try {
        payload = JSON.parse(value.payloadJson);
      } catch {
        throw unavailable('LanceDB returned invalid payload JSON.');
      }
      if (!isRecord(payload)) throw unavailable('LanceDB returned an invalid vector payload.');
      return { id: value.id, score: 1 - value._distance, payload };
    });
  }

  async count(profile: EmbeddingProfile, filter: VectorFilter): Promise<number> {
    this.assertProfile(profile);
    const table = await this.getEnsuredTable(profile);
    return table.countRows(this.filterSql(filter));
  }

  async existingIds(profile: EmbeddingProfile, pointIds: string[]): Promise<string[]> {
    this.assertProfile(profile);
    if (!pointIds.length) return [];
    await this.writeTail;
    const connection = await this.getConnection();
    if (!(await connection.tableNames()).includes(this.collectionName(profile)))
      this.tables.delete(this.collectionName(profile));
    const table = await this.ensureTable(profile);
    const rows = await table
      .query()
      .where(
        `projectId = ${quoteSql(this.projectId)} AND id IN (${pointIds.map(quoteSql).join(', ')})`,
      )
      .select(['id'])
      .limit(pointIds.length)
      .toArray();
    return rows.map((row) => String(row.id));
  }

  async health(profile?: EmbeddingProfile): Promise<VectorStoreHealth> {
    try {
      if (profile) this.assertProfile(profile);
      const connection = await this.getConnection();
      const collection = profile ? this.collectionName(profile) : null;
      await connection.tableNames();
      return {
        kind: this.kind,
        reachable: true,
        collection,
        error: null,
        version: null,
      };
    } catch (error) {
      return {
        kind: this.kind,
        reachable: false,
        collection: profile ? safeCollectionName(this.projectId, profile) : null,
        error: error instanceof Error ? error.message : String(error),
        version: null,
      };
    }
  }

  async close(): Promise<void> {
    await this.writeTail;
    const connection = this.connection;
    this.connection = undefined;
    this.connectionPromise = undefined;
    this.tables.clear();
    connection?.close();
  }

  private async ensureTable(profile: EmbeddingProfile): Promise<Table> {
    this.assertProfile(profile);
    const name = this.collectionName(profile);
    const cached = this.tables.get(name);
    if (cached) return cached;
    const connection = await this.getConnection();
    const names = await connection.tableNames();
    const table = names.includes(name)
      ? await connection.openTable(name)
      : await connection.createEmptyTable(name, schemaFor(profile.dimensions));
    this.tables.set(name, table);
    return table;
  }

  private getEnsuredTable(profile: EmbeddingProfile): Promise<Table> {
    return this.serializeWrite(() => this.ensureTable(profile));
  }

  private async getConnection(): Promise<Connection> {
    if (!this.connectionPromise) {
      const pending = import('@lancedb/lancedb').then(({ connect }) => connect(this.directory));
      this.connectionPromise = pending;
      try {
        this.connection = await pending;
      } catch (error) {
        if (this.connectionPromise === pending) this.connectionPromise = undefined;
        throw error;
      }
    }
    if (!this.connection) this.connection = await this.connectionPromise;
    return this.connection;
  }

  private row(
    profile: EmbeddingProfile,
    point: VectorPoint,
  ): Record<string, string | number | boolean | Float32Array | null> {
    if (!point || typeof point.id !== 'string' || !point.id.trim()) {
      throw unavailable('LanceDB point IDs must be non-empty strings.');
    }
    this.assertVector(point.vector, profile.dimensions);
    if (!isRecord(point.payload)) throw unavailable('LanceDB vector payload must be an object.');
    if (point.payload.projectId !== undefined && point.payload.projectId !== this.projectId) {
      throw unavailable('A vector point cannot be written for a different Project.');
    }
    for (const key of ['source', 'recordType', 'recordStatus'] as const) {
      if (
        point.payload[key] !== undefined &&
        point.payload[key] !== null &&
        typeof point.payload[key] !== 'string'
      ) {
        throw unavailable(`LanceDB payload ${key} must be a string or null.`);
      }
    }
    if (point.payload.active !== undefined && typeof point.payload.active !== 'boolean') {
      throw unavailable('LanceDB payload active must be a boolean.');
    }
    if (!isJsonValue(point.payload, new Set())) {
      throw unavailable('LanceDB vector payload must contain only finite JSON values.');
    }
    let payloadJson: string;
    try {
      payloadJson = JSON.stringify({ ...point.payload, projectId: this.projectId });
    } catch {
      throw unavailable('LanceDB vector payload must be JSON serializable.');
    }
    return {
      id: point.id,
      vector: new Float32Array(point.vector),
      projectId: this.projectId,
      profileVersion: profile.version,
      source: stringOrNull(point.payload.source),
      recordType: stringOrNull(point.payload.recordType),
      recordStatus: stringOrNull(point.payload.recordStatus),
      active: point.payload.active === false ? 0 : 1,
      payloadJson,
    };
  }

  private assertProfile(profile: EmbeddingProfile): void {
    if (!profile || typeof profile !== 'object' || profile.projectId !== this.projectId) {
      throw unavailable('Embedding profile does not belong to this Project.');
    }
    if (!Number.isInteger(profile.dimensions) || profile.dimensions < 1) {
      throw unavailable('Embedding profile dimensions must be a positive integer.');
    }
    if (!Number.isInteger(profile.version) || profile.version < 1) {
      throw unavailable('Embedding profile version must be a positive integer.');
    }
  }

  private assertVector(vector: number[], dimensions: number): void {
    if (
      !Array.isArray(vector) ||
      vector.length !== dimensions ||
      vector.some(
        (value) =>
          typeof value !== 'number' ||
          !Number.isFinite(value) ||
          !Number.isFinite(Math.fround(value)),
      ) ||
      !vector.some((value) => Math.fround(value) !== 0)
    ) {
      throw unavailable(
        `Embedding dimensions or values are invalid: expected ${dimensions} finite, non-zero Float32 values.`,
      );
    }
  }

  private assertLimit(limit: number): void {
    if (!Number.isInteger(limit) || limit < 1) {
      throw unavailable('Vector search limit must be a positive integer.');
    }
  }

  private filterSql(filter: VectorFilter): string {
    if (!isRecord(filter)) throw unavailable('LanceDB filter must be an object.');
    const allowed = new Set(['sources', 'recordTypes', 'statuses', 'includeInactive']);
    if (Object.keys(filter).some((key) => !allowed.has(key))) {
      throw unavailable('LanceDB filter contains an unsupported field.');
    }
    const clauses = [`projectId = ${quoteSql(this.projectId)}`];
    for (const [filterKey, column] of [
      ['sources', 'source'],
      ['recordTypes', 'recordType'],
      ['statuses', 'recordStatus'],
    ] as const) {
      const values = filter[filterKey];
      if (values === undefined) continue;
      if (!Array.isArray(values) || values.some((value) => typeof value !== 'string')) {
        throw unavailable(`LanceDB filter ${filterKey} must be an array of strings.`);
      }
      if (values.length === 0) {
        clauses.push('projectId != projectId');
      } else {
        clauses.push(`${column} IN (${values.map((value) => quoteSql(value)).join(', ')})`);
      }
    }
    if (filter.includeInactive !== undefined && typeof filter.includeInactive !== 'boolean') {
      throw unavailable('LanceDB filter includeInactive must be a boolean.');
    }
    if (filter.includeInactive !== true) clauses.push('active = 1');
    return clauses.join(' AND ');
  }

  private serializeWrite<T>(operation: () => Promise<T>): Promise<T> {
    const result = this.writeTail.then(operation, operation);
    this.writeTail = result.then(
      () => undefined,
      () => undefined,
    );
    return result;
  }
}

function schemaFor(dimensions: number): Schema {
  return new Schema([
    new Field('id', new Utf8(), false),
    new Field(
      'vector',
      new FixedSizeList(dimensions, new Field('item', new Float32(), true)),
      false,
    ),
    new Field('projectId', new Utf8(), false),
    new Field('profileVersion', new Int32(), false),
    new Field('source', new Utf8(), true),
    new Field('recordType', new Utf8(), true),
    new Field('recordStatus', new Utf8(), true),
    new Field('active', new Int32(), false),
    new Field('payloadJson', new Utf8(), false),
  ]);
}

function stringOrNull(value: unknown): string | null {
  return typeof value === 'string' ? value : null;
}

function quoteSql(value: string): string {
  return `'${value.replaceAll("'", "''")}'`;
}

function safeCollectionName(projectId: string, profile: EmbeddingProfile): string | null {
  if (!profile || !Number.isInteger(profile.version) || !Number.isInteger(profile.dimensions)) {
    return null;
  }
  return `gamecrafter_${projectId.replace(/[^A-Za-z0-9_-]/g, '_')}_v${profile.version}_d${profile.dimensions}`;
}

function isJsonValue(value: unknown, ancestors: Set<object>): boolean {
  if (value === null || typeof value === 'string' || typeof value === 'boolean') return true;
  if (typeof value === 'number') return Number.isFinite(value);
  if (typeof value !== 'object') return false;
  if (ancestors.has(value)) return false;
  ancestors.add(value);
  const valid = Array.isArray(value)
    ? value.every((entry) => isJsonValue(entry, ancestors))
    : isRecord(value) && Object.values(value).every((entry) => isJsonValue(entry, ancestors));
  ancestors.delete(value);
  return valid;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function unavailable(message: string): RpcError {
  return new RpcError(message, RpcErrorCode.VectorStoreUnavailable);
}

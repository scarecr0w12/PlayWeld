import type { EmbeddingProfile, VectorStoreKind } from '@gamecrafter/contracts';

export interface VectorPoint {
  id: string;
  vector: number[];
  payload: Record<string, unknown>;
}

export interface VectorSearchHit {
  id: string;
  score: number;
  payload: Record<string, unknown>;
}

export interface VectorFilter {
  sources?: string[];
  recordTypes?: string[];
  statuses?: string[];
  includeInactive?: boolean;
}

export function validateVectorFilter(filter: VectorFilter): void {
  const allowed = new Set(['sources', 'recordTypes', 'statuses', 'includeInactive']);
  if (Object.keys(filter).some((key) => !allowed.has(key)))
    throw new Error('Unsupported vector filter.');
  for (const values of [filter.sources, filter.recordTypes, filter.statuses]) {
    if (
      values !== undefined &&
      (!Array.isArray(values) || values.some((v) => typeof v !== 'string'))
    )
      throw new Error('Vector filters must contain string arrays.');
  }
  if (filter.includeInactive !== undefined && typeof filter.includeInactive !== 'boolean')
    throw new Error('Invalid inactive-record vector filter.');
}

export interface VectorStoreHealth {
  kind: VectorStoreKind;
  reachable: boolean;
  collection: string | null;
  error: string | null;
  version?: string | null;
}

export interface VectorStore {
  readonly kind: VectorStoreKind;
  ensureCollection(profile: EmbeddingProfile): Promise<string | null>;
  upsert(profile: EmbeddingProfile, points: VectorPoint[]): Promise<void>;
  delete(profile: EmbeddingProfile, pointIds: string[]): Promise<void>;
  search(
    profile: EmbeddingProfile,
    vector: number[],
    filter: VectorFilter,
    limit: number,
  ): Promise<VectorSearchHit[]>;
  count(profile: EmbeddingProfile, filter: VectorFilter): Promise<number | null>;
  health(profile?: EmbeddingProfile): Promise<VectorStoreHealth>;
  existingIds?(profile: EmbeddingProfile, pointIds: string[]): Promise<string[]>;
  collectionName?(profile: EmbeddingProfile): string;
  close?(): Promise<void>;
}

export function unavailableVectorStore(kind: string, error: unknown): VectorStore {
  const message = error instanceof Error ? error.message : String(error);
  const fail = async (): Promise<never> => {
    throw new Error(message);
  };
  return {
    kind,
    ensureCollection: fail,
    upsert: fail,
    delete: fail,
    search: fail,
    count: fail,
    health: async () => ({ kind, reachable: false, collection: null, error: message }),
  };
}

export class NullVectorStore implements VectorStore {
  readonly kind = 'none' as const;

  async ensureCollection(profile: EmbeddingProfile): Promise<null> {
    void profile;
    return null;
  }

  async upsert(profile: EmbeddingProfile, points: VectorPoint[]): Promise<void> {
    void profile;
    void points;
  }

  async delete(profile: EmbeddingProfile, pointIds: string[]): Promise<void> {
    void profile;
    void pointIds;
  }

  async search(
    profile: EmbeddingProfile,
    vector: number[],
    filter: VectorFilter,
    limit: number,
  ): Promise<VectorSearchHit[]> {
    void profile;
    void vector;
    void filter;
    void limit;
    return [];
  }

  async count(profile: EmbeddingProfile, filter: VectorFilter): Promise<null> {
    void profile;
    void filter;
    return null;
  }

  async health(): Promise<VectorStoreHealth> {
    return { kind: this.kind, reachable: false, collection: null, error: null, version: null };
  }
}

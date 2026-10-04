import { Static, Type } from '@sinclair/typebox';

export const CanonIdSchema = Type.String({
  minLength: 3,
  pattern: '^[a-z][a-z0-9]*(\\.[a-z0-9][a-z0-9-]*)+$',
});

export const BUILTIN_RECORD_TYPES = [
  'character',
  'location',
  'faction',
  'quest',
  'encounter',
  'mechanic',
  'asset',
  'dialogue',
  'timeline-event',
  'decision',
  'design-note',
] as const;

export const BuiltinRecordTypeSchema = Type.Union(
  BUILTIN_RECORD_TYPES.map((recordType) => Type.Literal(recordType)),
);

export const RecordTypeSchema = Type.String({
  minLength: 1,
  maxLength: 80,
  pattern: '^[a-z][a-z0-9]*(?:[.-][a-z0-9]+)*$',
});
export type RecordType = Static<typeof RecordTypeSchema>;

export const CanonStatusSchema = Type.Union([
  Type.Literal('draft'),
  Type.Literal('proposed'),
  Type.Literal('accepted'),
  Type.Literal('deprecated'),
  Type.Literal('retconned'),
]);
export type CanonStatus = Static<typeof CanonStatusSchema>;

export const CanonReferenceSourceSchema = Type.Union([
  Type.Literal('author'),
  Type.Literal('inferred'),
  Type.Literal('decision'),
  Type.Literal('import'),
]);

export const CanonReferenceSchema = Type.Object(
  {
    rel: Type.String({ minLength: 1, maxLength: 80, pattern: '^[a-z][a-z0-9-]*$' }),
    target: CanonIdSchema,
    confidence: Type.Number({ minimum: 0, maximum: 1 }),
    source: CanonReferenceSourceSchema,
  },
  { additionalProperties: false },
);
export type CanonReference = Static<typeof CanonReferenceSchema>;

export const CanonProvenanceSchema = Type.Object(
  {
    kind: Type.Union([
      Type.Literal('decision'),
      Type.Literal('task'),
      Type.Literal('user'),
      Type.Literal('import'),
    ]),
    ref: Type.String({ minLength: 1 }),
    at: Type.String({ format: 'date-time' }),
  },
  { additionalProperties: false },
);
export type CanonProvenance = Static<typeof CanonProvenanceSchema>;

export const CanonRecordInputSchema = Type.Object(
  {
    id: CanonIdSchema,
    type: RecordTypeSchema,
    title: Type.String({ minLength: 1, maxLength: 300 }),
    status: CanonStatusSchema,
    module: Type.Optional(Type.String({ minLength: 1 })),
    tags: Type.Optional(Type.Array(Type.String({ minLength: 1 }), { uniqueItems: true })),
    references: Type.Optional(Type.Array(CanonReferenceSchema)),
    provenance: Type.Optional(Type.Array(CanonProvenanceSchema)),
    supersedes: Type.Optional(CanonIdSchema),
  },
  { additionalProperties: false },
);
export type CanonRecordInput = Static<typeof CanonRecordInputSchema>;

export const CanonRecordSchema = Type.Object(
  {
    schemaVersion: Type.Literal(1),
    id: CanonIdSchema,
    type: RecordTypeSchema,
    title: Type.String({ minLength: 1, maxLength: 300 }),
    status: CanonStatusSchema,
    module: Type.Optional(Type.String({ minLength: 1 })),
    tags: Type.Array(Type.String({ minLength: 1 }), { uniqueItems: true }),
    references: Type.Array(CanonReferenceSchema),
    provenance: Type.Array(CanonProvenanceSchema),
    supersedes: Type.Optional(CanonIdSchema),
    path: Type.String({ minLength: 1 }),
    bodyExcerpt: Type.String(),
    revision: Type.String({ minLength: 1 }),
    active: Type.Boolean(),
    indexedAt: Type.String({ format: 'date-time' }),
  },
  { additionalProperties: false },
);
export type CanonRecord = Static<typeof CanonRecordSchema>;

export const IndexSourceSchema = Type.Union([
  Type.Literal('canon'),
  Type.Literal('decisions'),
  Type.Literal('docs'),
  Type.Literal('code'),
  Type.Literal('board'),
  Type.Literal('assets'),
  Type.Literal('inactive'),
]);
export type IndexSource = Static<typeof IndexSourceSchema>;

export const KnowledgeChunkSchema = Type.Object(
  {
    chunkId: Type.String({ pattern: '^[a-f0-9]{64}$' }),
    projectId: Type.String({ format: 'uuid' }),
    source: IndexSourceSchema,
    path: Type.String({ minLength: 1 }),
    recordId: Type.Union([CanonIdSchema, Type.Null()]),
    revision: Type.String({ minLength: 1 }),
    startLine: Type.Integer({ minimum: 1 }),
    endLine: Type.Integer({ minimum: 1 }),
    text: Type.String({ minLength: 1 }),
    tokensEstimate: Type.Integer({ minimum: 0 }),
  },
  { additionalProperties: false },
);
export type KnowledgeChunk = Static<typeof KnowledgeChunkSchema>;

export const EmbeddingProfileSchema = Type.Object(
  {
    profileId: Type.String({ format: 'uuid' }),
    projectId: Type.String({ format: 'uuid' }),
    modelId: Type.String({ minLength: 1 }),
    providerAccountId: Type.String({ format: 'uuid' }),
    dimensions: Type.Integer({ minimum: 1 }),
    version: Type.Integer({ minimum: 1 }),
    createdAt: Type.String({ format: 'date-time' }),
  },
  { additionalProperties: false },
);
export type EmbeddingProfile = Static<typeof EmbeddingProfileSchema>;

export const VectorStoreKindSchema = Type.String({ minLength: 1, pattern: '^[a-z][a-z0-9-]*$' });
export type VectorStoreKind = Static<typeof VectorStoreKindSchema>;

export const VectorStoreDeploymentSchema = Type.Union([
  Type.Literal('embedded'),
  Type.Literal('managed-local'),
  Type.Literal('external'),
  Type.Literal('local'),
  Type.Literal('remote'),
]);
export type VectorStoreDeployment = Static<typeof VectorStoreDeploymentSchema>;

export const VectorStoreConfigSchema = Type.Object(
  {
    kind: Type.Optional(VectorStoreKindSchema),
    deployment: Type.Optional(VectorStoreDeploymentSchema),
    url: Type.Optional(Type.String({ format: 'uri', default: 'http://127.0.0.1:6333' })),
    apiKeyRef: Type.Optional(Type.String()),
    collectionPrefix: Type.Optional(Type.String({ minLength: 1, default: 'gamecrafter' })),
    timeoutMs: Type.Optional(Type.Integer({ minimum: 1, default: 5000 })),
  },
  { additionalProperties: false },
);
export type VectorStoreConfig = Static<typeof VectorStoreConfigSchema>;

export const SearchModeSchema = Type.Union([
  Type.Literal('hybrid'),
  Type.Literal('lexical'),
  Type.Literal('semantic'),
]);
export type SearchMode = Static<typeof SearchModeSchema>;

export const SearchRequestSchema = Type.Object(
  {
    projectId: Type.String({ format: 'uuid' }),
    query: Type.String({ minLength: 1 }),
    sources: Type.Optional(Type.Array(IndexSourceSchema, { uniqueItems: true })),
    recordTypes: Type.Optional(Type.Array(RecordTypeSchema, { uniqueItems: true })),
    statuses: Type.Optional(Type.Array(CanonStatusSchema, { uniqueItems: true })),
    includeInactive: Type.Optional(Type.Boolean({ default: false })),
    limit: Type.Optional(Type.Integer({ minimum: 1, maximum: 100, default: 10 })),
    taskId: Type.Optional(Type.String({ format: 'uuid' })),
    maxTokens: Type.Optional(Type.Integer({ minimum: 0, maximum: 200000 })),
    mode: Type.Optional(
      Type.Union([Type.Literal('hybrid'), Type.Literal('lexical'), Type.Literal('semantic')], {
        default: 'hybrid',
      }),
    ),
  },
  { additionalProperties: false },
);
export type SearchRequest = Static<typeof SearchRequestSchema>;

export const SearchHitSchema = Type.Object(
  {
    chunkId: Type.String({ pattern: '^[a-f0-9]{64}$' }),
    score: Type.Number(),
    lexicalRank: Type.Union([Type.Integer({ minimum: 1 }), Type.Null()]),
    semanticRank: Type.Union([Type.Integer({ minimum: 1 }), Type.Null()]),
    path: Type.String({ minLength: 1 }),
    revision: Type.String({ minLength: 1 }),
    recordId: Type.Union([CanonIdSchema, Type.Null()]),
    recordTitle: Type.Union([Type.String(), Type.Null()]),
    recordStatus: Type.Union([CanonStatusSchema, Type.Null()]),
    source: IndexSourceSchema,
    quote: Type.Object(
      {
        text: Type.String({ minLength: 1 }),
        startLine: Type.Integer({ minimum: 1 }),
        endLine: Type.Integer({ minimum: 1 }),
      },
      { additionalProperties: false },
    ),
    citation: Type.String({ minLength: 1 }),
  },
  { additionalProperties: false },
);
export type SearchHit = Static<typeof SearchHitSchema>;

export const KnowledgeSearchResultSchema = Type.Object(
  {
    hits: Type.Array(SearchHitSchema),
    mode: SearchModeSchema,
    degraded: Type.Union([Type.String(), Type.Null()]),
  },
  { additionalProperties: false },
);
export type KnowledgeSearchResult = Static<typeof KnowledgeSearchResultSchema>;

export const KnowledgeRecordListResultSchema = Type.Object(
  { records: Type.Array(CanonRecordSchema), conflicts: Type.Array(Type.String()) },
  { additionalProperties: false },
);
export type KnowledgeRecordListResult = Static<typeof KnowledgeRecordListResultSchema>;

export const KnowledgeReferenceResultSchema = Type.Object(
  {
    recordId: CanonIdSchema,
    title: Type.String(),
    rel: Type.String(),
    target: CanonIdSchema,
    confidence: Type.Number({ minimum: 0, maximum: 1 }),
    source: CanonReferenceSourceSchema,
  },
  { additionalProperties: false },
);
export type KnowledgeReferenceResult = Static<typeof KnowledgeReferenceResultSchema>;

export const KnowledgeRecordResultSchema = Type.Object(
  {
    record: CanonRecordSchema,
    body: Type.String(),
    inbound: Type.Array(KnowledgeReferenceResultSchema),
    outbound: Type.Array(CanonReferenceSchema),
  },
  { additionalProperties: false },
);
export type KnowledgeRecordResult = Static<typeof KnowledgeRecordResultSchema>;

export const IndexStatusSchema = Type.Object(
  {
    projectId: Type.String({ format: 'uuid' }),
    lastFullReconcileAt: Type.Union([Type.String({ format: 'date-time' }), Type.Null()]),
    lastIncrementalAt: Type.Union([Type.String({ format: 'date-time' }), Type.Null()]),
    chunks: Type.Integer({ minimum: 0 }),
    records: Type.Integer({ minimum: 0 }),
    vectors: Type.Union([Type.Integer({ minimum: 0 }), Type.Null()]),
    vectorStore: Type.Object(
      {
        kind: VectorStoreKindSchema,
        reachable: Type.Boolean(),
        collection: Type.Union([Type.String(), Type.Null()]),
        error: Type.Union([Type.String(), Type.Null()]),
      },
      { additionalProperties: false },
    ),
    embeddingProfile: Type.Union([EmbeddingProfileSchema, Type.Null()]),
    pending: Type.Integer({ minimum: 0 }),
    conflicts: Type.Array(
      Type.Object(
        { id: Type.String(), paths: Type.Array(Type.String()) },
        { additionalProperties: false },
      ),
    ),
    brokenReferences: Type.Array(
      Type.Object(
        { recordId: CanonIdSchema, target: CanonIdSchema },
        { additionalProperties: false },
      ),
    ),
  },
  { additionalProperties: false },
);
export type IndexStatus = Static<typeof IndexStatusSchema>;
export const KnowledgeIndexStateSchema = IndexStatusSchema;
export type KnowledgeIndexState = IndexStatus;

export const KnowledgeGraphNodeSchema = Type.Object(
  {
    recordId: CanonIdSchema,
    type: RecordTypeSchema,
    title: Type.String(),
    status: CanonStatusSchema,
    active: Type.Boolean(),
  },
  { additionalProperties: false },
);
export const KnowledgeGraphEdgeSchema = Type.Object(
  {
    source: CanonIdSchema,
    target: CanonIdSchema,
    rel: Type.String(),
    confidence: Type.Number({ minimum: 0, maximum: 1 }),
  },
  { additionalProperties: false },
);
export const KnowledgeGraphSchema = Type.Object(
  {
    nodes: Type.Array(KnowledgeGraphNodeSchema),
    edges: Type.Array(KnowledgeGraphEdgeSchema),
  },
  { additionalProperties: false },
);
export type KnowledgeGraph = Static<typeof KnowledgeGraphSchema>;

export const KnowledgeTaskResultSchema = Type.Object(
  { taskId: Type.String({ format: 'uuid' }) },
  { additionalProperties: false },
);

export const KnowledgeVectorStoreTestResultSchema = Type.Object(
  {
    kind: VectorStoreKindSchema,
    reachable: Type.Boolean(),
    collection: Type.Union([Type.String(), Type.Null()]),
    error: Type.Union([Type.String(), Type.Null()]),
  },
  { additionalProperties: false },
);

import { Type, type Static } from '@sinclair/typebox';
import { ModelUsageRecordSchema } from './models';
import { TaskEventSchema } from './tasks';
import { ApprovalRequestSchema, ToolCallRecordSchema } from './tools';

export const AuditExportCountsSchema = Type.Object(
  {
    calls: Type.Integer({ minimum: 0 }),
    approvals: Type.Integer({ minimum: 0 }),
    events: Type.Integer({ minimum: 0 }),
    modelUsage: Type.Integer({ minimum: 0 }),
  },
  { additionalProperties: false },
);

export const AuditExportSchema = Type.Object(
  {
    schemaVersion: Type.Literal(1),
    projectId: Type.String({ format: 'uuid' }),
    exportedAt: Type.String({ format: 'date-time' }),
    scope: Type.Literal('full-project-audit'),
    calls: Type.Array(ToolCallRecordSchema),
    approvals: Type.Array(ApprovalRequestSchema),
    events: Type.Array(TaskEventSchema),
    modelUsage: Type.Array(ModelUsageRecordSchema),
    counts: AuditExportCountsSchema,
  },
  { additionalProperties: false },
);
export type AuditExport = Static<typeof AuditExportSchema>;

export const AuditExportReceiptSchema = Type.Object(
  {
    schemaVersion: Type.Literal(1),
    projectId: Type.String({ format: 'uuid' }),
    exportedAt: Type.String({ format: 'date-time' }),
    path: Type.String({ minLength: 1 }),
    bytes: Type.Integer({ minimum: 0 }),
    sha256: Type.String({ pattern: '^[a-f0-9]{64}$' }),
    counts: AuditExportCountsSchema,
  },
  { additionalProperties: false },
);
export type AuditExportReceipt = Static<typeof AuditExportReceiptSchema>;

export const AuditHistoryStoreSchema = Type.Union([
  Type.Literal('project'),
  Type.Literal('model-usage'),
]);
export type AuditHistoryStore = Static<typeof AuditHistoryStoreSchema>;
export const AuditRetentionPolicySchema = Type.Object(
  {
    retentionDays: Type.Integer({ minimum: 0, maximum: 36500 }),
    deletionEnabled: Type.Boolean(),
    autoPrune: Type.Boolean(),
  },
  { additionalProperties: false },
);
export type AuditRetentionPolicy = Static<typeof AuditRetentionPolicySchema>;
export const AuditCleanupCountsSchema = Type.Object(
  {
    calls: Type.Integer({ minimum: 0 }),
    approvals: Type.Integer({ minimum: 0 }),
    events: Type.Integer({ minimum: 0 }),
    modelUsage: Type.Integer({ minimum: 0 }),
    decisionAssessments: Type.Integer({ minimum: 0 }),
    legacyUsage: Type.Integer({ minimum: 0 }),
  },
  { additionalProperties: false },
);
export type AuditCleanupCounts = Static<typeof AuditCleanupCountsSchema>;
export const AuditCleanupPreviewSchema = Type.Object(
  {
    schemaVersion: Type.Literal(1),
    previewId: Type.String({ format: 'uuid' }),
    projectId: Type.String({ format: 'uuid' }),
    store: AuditHistoryStoreSchema,
    before: Type.String({ format: 'date-time' }),
    expiresAt: Type.String({ format: 'date-time' }),
    counts: AuditCleanupCountsSchema,
    hasMore: Type.Boolean(),
  },
  { additionalProperties: false },
);
export type AuditCleanupPreview = Static<typeof AuditCleanupPreviewSchema>;
export const AuditCleanupReceiptSchema = Type.Object(
  {
    schemaVersion: Type.Literal(1),
    cleanupId: Type.String({ format: 'uuid' }),
    projectId: Type.String({ format: 'uuid' }),
    store: AuditHistoryStoreSchema,
    before: Type.String({ format: 'date-time' }),
    completedAt: Type.String({ format: 'date-time' }),
    origin: Type.Union([Type.Literal('manual'), Type.Literal('automatic')]),
    counts: AuditCleanupCountsSchema,
  },
  { additionalProperties: false },
);
export type AuditCleanupReceipt = Static<typeof AuditCleanupReceiptSchema>;
export const AuditRetentionStateSchema = Type.Object(
  {
    schemaVersion: Type.Literal(1),
    projectId: Type.String({ format: 'uuid' }),
    policy: AuditRetentionPolicySchema,
    receipts: Type.Array(AuditCleanupReceiptSchema),
  },
  { additionalProperties: false },
);

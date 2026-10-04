import { Static, Type } from '@sinclair/typebox';

export const ExecutionModeSchema = Type.Union([
  Type.Literal('project-file'),
  Type.Literal('headless-process'),
  Type.Literal('live-editor'),
]);
export type ExecutionMode = Static<typeof ExecutionModeSchema>;

export const SideEffectSchema = Type.Union([
  Type.Literal('none'),
  Type.Literal('internal-write'),
  Type.Literal('workspace-write'),
  Type.Literal('external-write'),
  Type.Literal('paid'),
  Type.Literal('destructive'),
]);
export type SideEffect = Static<typeof SideEffectSchema>;

export const SIDE_EFFECT_RANK: Record<SideEffect, number> = {
  none: 0,
  'internal-write': 1,
  'workspace-write': 2,
  'external-write': 3,
  paid: 4,
  destructive: 5,
};

export const AccessModeSchema = Type.Union([
  Type.Literal('full'),
  Type.Literal('restricted'),
  Type.Literal('ask-always'),
]);
export type AccessMode = Static<typeof AccessModeSchema>;

export const ACCESS_MODE_RANK: Record<AccessMode, number> = {
  'ask-always': 0,
  restricted: 1,
  full: 2,
};

export function minAccessMode(left: AccessMode, right: AccessMode): AccessMode {
  return ACCESS_MODE_RANK[left] <= ACCESS_MODE_RANK[right] ? left : right;
}

export const ToolIdSchema = Type.String({ pattern: '^[a-z0-9][a-z0-9.-]{0,127}/[^\\s]+$' });
export type ToolId = Static<typeof ToolIdSchema>;

export const ToolDefinitionSchema = Type.Object(
  {
    toolId: ToolIdSchema,
    title: Type.String(),
    description: Type.String(),
    inputSchema: Type.Unknown(),
    outputSchema: Type.Optional(Type.Unknown()),
    executionMode: ExecutionModeSchema,
    minAccessMode: Type.Optional(AccessModeSchema),
    sideEffects: SideEffectSchema,
    evidence: Type.String(),
    capabilities: Type.Array(Type.String()),
    source: Type.String(),
  },
  { additionalProperties: false },
);
export type ToolDefinition = Static<typeof ToolDefinitionSchema>;

export const ToolDecisionSchema = Type.Union([
  Type.Literal('allowed'),
  Type.Literal('denied'),
  Type.Literal('approval-required'),
  Type.Literal('approved'),
  Type.Literal('rejected'),
  Type.Literal('timed-out'),
]);
export type ToolDecision = Static<typeof ToolDecisionSchema>;

export const ToolCallStatusSchema = Type.Union([
  Type.Literal('completed'),
  Type.Literal('failed'),
  Type.Literal('denied'),
  Type.Literal('rejected'),
  Type.Literal('timed-out'),
  Type.Literal('pending'),
]);
export type ToolCallStatus = Static<typeof ToolCallStatusSchema>;

export const ToolCallCostStatusSchema = Type.Union([
  Type.Literal('known'),
  Type.Literal('partial'),
  Type.Literal('unknown'),
  Type.Literal('untracked'),
  Type.Literal('unverified'),
]);
export type ToolCallCostStatus = Static<typeof ToolCallCostStatusSchema>;

export const ToolCallErrorSchema = Type.Object(
  {
    message: Type.String(),
    code: Type.Optional(Type.String()),
  },
  { additionalProperties: false },
);
export type ToolCallError = Static<typeof ToolCallErrorSchema>;

export const ToolEvidenceSchema = Type.Object(
  {
    kind: Type.String(),
    ref: Type.String(),
  },
  { additionalProperties: false },
);
export type ToolEvidence = Static<typeof ToolEvidenceSchema>;

export const ToolCallRecordSchema = Type.Object(
  {
    callId: Type.String({ format: 'uuid' }),
    projectId: Type.String({ format: 'uuid' }),
    taskId: Type.Union([Type.String({ format: 'uuid' }), Type.Null()]),
    agentId: Type.Union([Type.String(), Type.Null()]),
    toolId: ToolIdSchema,
    input: Type.Unknown(),
    accessMode: AccessModeSchema,
    decision: ToolDecisionSchema,
    decisionReason: Type.String(),
    status: ToolCallStatusSchema,
    output: Type.Unknown(),
    error: Type.Union([ToolCallErrorSchema, Type.Null()]),
    evidence: Type.Array(ToolEvidenceSchema),
    costUsd: Type.Number({ minimum: 0 }),
    costStatus: Type.Optional(ToolCallCostStatusSchema),
    startedAt: Type.String({ format: 'date-time' }),
    finishedAt: Type.Union([Type.String({ format: 'date-time' }), Type.Null()]),
  },
  { additionalProperties: false },
);
export type ToolCallRecord = Static<typeof ToolCallRecordSchema>;

export const ApprovalRequestSchema = Type.Object(
  {
    approvalId: Type.String({ format: 'uuid' }),
    projectId: Type.String({ format: 'uuid' }),
    callId: Type.String({ format: 'uuid' }),
    toolId: ToolIdSchema,
    sideEffects: SideEffectSchema,
    summary: Type.String(),
    input: Type.Unknown(),
    requestedAt: Type.String({ format: 'date-time' }),
    resolvedAt: Type.Union([Type.String({ format: 'date-time' }), Type.Null()]),
    approved: Type.Union([Type.Boolean(), Type.Null()]),
    reason: Type.Union([Type.String(), Type.Null()]),
  },
  { additionalProperties: false },
);
export type ApprovalRequest = Static<typeof ApprovalRequestSchema>;

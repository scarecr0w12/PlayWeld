import { Static, Type } from '@sinclair/typebox';

export const ProviderKindSchema = Type.Union([
  Type.Literal('openai-compatible'),
  Type.Literal('anthropic'),
]);
export type ProviderKind = Static<typeof ProviderKindSchema>;

export const ProviderAccountSchema = Type.Object(
  {
    accountId: Type.String({ format: 'uuid' }),
    providerKind: ProviderKindSchema,
    displayName: Type.String(),
    baseUrl: Type.String({ format: 'uri' }),
    hasCredential: Type.Boolean(),
    headers: Type.Record(Type.String(), Type.String()),
    isLocal: Type.Boolean(),
    privacy: Type.Union([Type.Literal('local'), Type.Literal('cloud')]),
    enabled: Type.Boolean(),
    createdAt: Type.String({ format: 'date-time' }),
    updatedAt: Type.String({ format: 'date-time' }),
  },
  { additionalProperties: false },
);
export type ProviderAccount = Static<typeof ProviderAccountSchema>;

export const ModelCapabilitiesSchema = Type.Object(
  {
    chat: Type.Boolean(),
    tools: Type.Boolean(),
    vision: Type.Boolean(),
    structuredOutput: Type.Boolean(),
    streaming: Type.Boolean(),
    embeddings: Type.Boolean(),
    contextWindow: Type.Union([Type.Integer({ minimum: 0 }), Type.Null()]),
    maxInputTokens: Type.Optional(Type.Union([Type.Integer({ minimum: 0 }), Type.Null()])),
    maxOutputTokens: Type.Union([Type.Integer({ minimum: 0 }), Type.Null()]),
  },
  { additionalProperties: false },
);
export type ModelCapabilities = Static<typeof ModelCapabilitiesSchema>;

export const ModelPricingSchema = Type.Object(
  {
    inputPerMTokUsd: Type.Union([Type.Number(), Type.Null()]),
    outputPerMTokUsd: Type.Union([Type.Number(), Type.Null()]),
  },
  { additionalProperties: false },
);
export type ModelPricing = Static<typeof ModelPricingSchema>;

export const ModelSchema = Type.Object(
  {
    modelId: Type.String({ minLength: 1 }),
    accountId: Type.String({ format: 'uuid' }),
    providerModelId: Type.String({ minLength: 1 }),
    displayName: Type.String(),
    capabilities: ModelCapabilitiesSchema,
    pricing: ModelPricingSchema,
    metadataSource: Type.Union([Type.Literal('provider'), Type.Literal('manual')]),
    metadataUpdatedAt: Type.String({ format: 'date-time' }),
    enabled: Type.Boolean(),
    tags: Type.Array(Type.String()),
    workTypes: Type.Array(Type.String()),
    roles: Type.Array(Type.String()),
  },
  { additionalProperties: false },
);
export type Model = Static<typeof ModelSchema>;

export const ModelPoolTargetSchema = Type.Union([
  Type.Object({ kind: Type.Literal('agent'), id: Type.String() }, { additionalProperties: false }),
  Type.Object(
    { kind: Type.Literal('task-type'), id: Type.String() },
    { additionalProperties: false },
  ),
]);
export type ModelPoolTarget = Static<typeof ModelPoolTargetSchema>;

export const ModelPoolSchema = Type.Object(
  {
    poolId: Type.String({ format: 'uuid' }),
    name: Type.String(),
    scope: Type.Union([Type.Literal('platform'), Type.Literal('project')]),
    projectId: Type.Union([Type.String({ format: 'uuid' }), Type.Null()]),
    target: Type.Union([ModelPoolTargetSchema, Type.Null()]),
    modelIds: Type.Array(Type.String()),
    createdAt: Type.String({ format: 'date-time' }),
    updatedAt: Type.String({ format: 'date-time' }),
  },
  { additionalProperties: false },
);
export type ModelPool = Static<typeof ModelPoolSchema>;

export const ChatToolCallSchema = Type.Object(
  {
    id: Type.String(),
    name: Type.String(),
    arguments: Type.String(),
  },
  { additionalProperties: false },
);
export type ChatToolCall = Static<typeof ChatToolCallSchema>;

export const ChatMessageSchema = Type.Object(
  {
    role: Type.Union([
      Type.Literal('system'),
      Type.Literal('user'),
      Type.Literal('assistant'),
      Type.Literal('tool'),
    ]),
    content: Type.String(),
    toolCalls: Type.Optional(Type.Array(ChatToolCallSchema)),
    toolCallId: Type.Optional(Type.String()),
    name: Type.Optional(Type.String()),
  },
  { additionalProperties: false },
);
export type ChatMessage = Static<typeof ChatMessageSchema>;

export const ChatRequestSchema = Type.Object(
  {
    messages: Type.Array(ChatMessageSchema),
    tools: Type.Optional(
      Type.Array(
        Type.Object(
          {
            name: Type.String(),
            description: Type.String(),
            inputSchema: Type.Unknown(),
          },
          { additionalProperties: false },
        ),
      ),
    ),
    responseFormat: Type.Optional(
      Type.Union([
        Type.Object(
          { type: Type.Literal('json_schema'), schema: Type.Unknown() },
          { additionalProperties: false },
        ),
        Type.Object({ type: Type.Literal('text') }, { additionalProperties: false }),
      ]),
    ),
    maxTokens: Type.Optional(Type.Integer({ minimum: 1 })),
    temperature: Type.Optional(Type.Number()),
    stream: Type.Optional(Type.Boolean()),
  },
  { additionalProperties: false },
);
export type ChatRequest = Static<typeof ChatRequestSchema>;

export const ModelUsageSchema = Type.Object(
  {
    inputTokens: Type.Integer({ minimum: 0 }),
    outputTokens: Type.Integer({ minimum: 0 }),
    cacheReadInputTokens: Type.Optional(Type.Integer({ minimum: 0 })),
    cacheCreationInputTokens: Type.Optional(Type.Integer({ minimum: 0 })),
    costUsd: Type.Union([Type.Number({ minimum: 0 }), Type.Null()]),
    costStatus: Type.Optional(
      Type.Union([Type.Literal('known'), Type.Literal('partial'), Type.Literal('unknown')]),
    ),
  },
  { additionalProperties: false },
);
export type ModelUsage = Static<typeof ModelUsageSchema>;

export const ChatResponseSchema = Type.Object(
  {
    content: Type.String(),
    toolCalls: Type.Array(ChatToolCallSchema),
    finishReason: Type.Union([
      Type.Literal('stop'),
      Type.Literal('length'),
      Type.Literal('tool_calls'),
      Type.Literal('error'),
    ]),
    usage: ModelUsageSchema,
    latencyMs: Type.Integer({ minimum: 0 }),
    modelId: Type.String(),
    decisionId: Type.Union([Type.String({ format: 'uuid' }), Type.Null()]),
  },
  { additionalProperties: false },
);
export type ChatResponse = Static<typeof ChatResponseSchema>;

export const RouteCapabilitySchema = Type.Union([
  Type.Literal('chat'),
  Type.Literal('tools'),
  Type.Literal('vision'),
  Type.Literal('structuredOutput'),
  Type.Literal('streaming'),
  Type.Literal('embeddings'),
]);
export type RouteCapability = Static<typeof RouteCapabilitySchema>;

export const RouteRequestSchema = Type.Object(
  {
    projectId: Type.Optional(Type.String({ format: 'uuid' })),
    agentRole: Type.Optional(Type.String()),
    taskType: Type.String(),
    requiredCapabilities: Type.Optional(Type.Array(RouteCapabilitySchema)),
    manualModelId: Type.Optional(Type.String()),
    constraints: Type.Optional(
      Type.Object(
        {
          maxCostUsd: Type.Optional(Type.Number({ minimum: 0 })),
          maxLatencyMs: Type.Optional(Type.Integer({ minimum: 0 })),
        },
        { additionalProperties: false },
      ),
    ),
    engine: Type.Optional(Type.String()),
    genres: Type.Optional(Type.Array(Type.String())),
  },
  { additionalProperties: false },
);
export type RouteRequest = Static<typeof RouteRequestSchema>;

export const RouteCandidateSchema = Type.Object(
  {
    modelId: Type.String(),
    score: Type.Number(),
    qualityEstimate: Type.Number({ minimum: 0, maximum: 1 }),
    observations: Type.Integer({ minimum: 0 }),
    estimatedCostUsd: Type.Union([Type.Number({ minimum: 0 }), Type.Null()]),
    estimatedLatencyMs: Type.Union([Type.Number({ minimum: 0 }), Type.Null()]),
    reliability: Type.Number({ minimum: 0, maximum: 1 }),
  },
  { additionalProperties: false },
);
export type RouteCandidate = Static<typeof RouteCandidateSchema>;

export const RouteDecisionSchema = Type.Object(
  {
    decisionId: Type.String({ format: 'uuid' }),
    modelId: Type.String(),
    reason: Type.String(),
    explored: Type.Boolean(),
    policyVersion: Type.String(),
    candidates: Type.Array(RouteCandidateSchema),
    context: Type.Object(
      {
        projectId: Type.Union([Type.String({ format: 'uuid' }), Type.Null()]),
        agentRole: Type.Union([Type.String(), Type.Null()]),
        taskType: Type.String(),
        engine: Type.Union([Type.String(), Type.Null()]),
      },
      { additionalProperties: false },
    ),
    decidedAt: Type.String({ format: 'date-time' }),
  },
  { additionalProperties: false },
);
export type RouteDecision = Static<typeof RouteDecisionSchema>;

export const RouteOutcomeSchema = Type.Object(
  {
    decisionId: Type.String({ format: 'uuid' }),
    success: Type.Boolean(),
    qualityScore: Type.Union([Type.Number({ minimum: 0, maximum: 1 }), Type.Null()]),
    source: Type.Union([
      Type.Literal('validation'),
      Type.Literal('user'),
      Type.Literal('reviewer'),
      Type.Literal('self'),
    ]),
    costUsd: Type.Union([Type.Number({ minimum: 0 }), Type.Null()]),
    costStatus: Type.Optional(
      Type.Union([
        Type.Literal('known'),
        Type.Literal('partial'),
        Type.Literal('unknown'),
        Type.Literal('unverified'),
      ]),
    ),
    latencyMs: Type.Integer({ minimum: 0 }),
    inputTokens: Type.Integer({ minimum: 0 }),
    outputTokens: Type.Integer({ minimum: 0 }),
    cacheReadInputTokens: Type.Optional(Type.Integer({ minimum: 0 })),
    cacheCreationInputTokens: Type.Optional(Type.Integer({ minimum: 0 })),
    note: Type.Optional(Type.String()),
  },
  { additionalProperties: false },
);
export type RouteOutcome = Static<typeof RouteOutcomeSchema>;

const CompletionUsageRecordSchema = Type.Object(
  {
    usageId: Type.String({ format: 'uuid' }),
    requestId: Type.Union([Type.String(), Type.Null()]),
    taskId: Type.Union([Type.String({ format: 'uuid' }), Type.Null()]),
    decisionId: Type.Union([Type.String({ format: 'uuid' }), Type.Null()]),
    modelId: Type.String(),
    modelName: Type.Optional(Type.String()),
    providerModelId: Type.Optional(Type.String()),
    occurredAt: Type.String({ format: 'date-time' }),
    source: Type.Literal('completion'),
    inputTokens: Type.Integer({ minimum: 0 }),
    outputTokens: Type.Integer({ minimum: 0 }),
    cacheReadInputTokens: Type.Integer({ minimum: 0 }),
    cacheCreationInputTokens: Type.Integer({ minimum: 0 }),
    costUsd: Type.Union([Type.Number({ minimum: 0 }), Type.Null()]),
    costStatus: Type.Union([
      Type.Literal('known'),
      Type.Literal('partial'),
      Type.Literal('unknown'),
      Type.Literal('unverified'),
    ]),
  },
  { additionalProperties: false },
);
export const ModelUsageRecordSchema = Type.Union([
  CompletionUsageRecordSchema,
  Type.Object(
    {
      ...CompletionUsageRecordSchema.properties,
      source: Type.Literal('decision'),
      inputTokens: Type.Union([Type.Integer({ minimum: 0 }), Type.Null()]),
      outputTokens: Type.Union([Type.Integer({ minimum: 0 }), Type.Null()]),
      cacheReadInputTokens: Type.Union([Type.Integer({ minimum: 0 }), Type.Null()]),
      cacheCreationInputTokens: Type.Union([Type.Integer({ minimum: 0 }), Type.Null()]),
    },
    { additionalProperties: false },
  ),
]);
export type ModelUsageRecord = Static<typeof ModelUsageRecordSchema>;

import { Static, Type } from '@sinclair/typebox';

export const A2AAuthKindSchema = Type.Union([
  Type.Literal('none'),
  Type.Literal('api-key'),
  Type.Literal('bearer'),
  Type.Literal('basic'),
  Type.Literal('custom-headers'),
]);
export type A2AAuthKind = Static<typeof A2AAuthKindSchema>;

export const A2AOutboundAuthInputSchema = Type.Union([
  Type.Object({ kind: Type.Literal('none') }, { additionalProperties: false }),
  Type.Object(
    {
      kind: Type.Literal('api-key'),
      headerName: Type.String({ minLength: 1, maxLength: 128 }),
      value: Type.String({ minLength: 1, maxLength: 4096 }),
    },
    { additionalProperties: false },
  ),
  Type.Object(
    { kind: Type.Literal('bearer'), token: Type.String({ minLength: 1, maxLength: 4096 }) },
    { additionalProperties: false },
  ),
  Type.Object(
    {
      kind: Type.Literal('basic'),
      username: Type.String({ minLength: 1, maxLength: 512 }),
      password: Type.String({ minLength: 1, maxLength: 4096 }),
    },
    { additionalProperties: false },
  ),
  Type.Object(
    {
      kind: Type.Literal('custom-headers'),
      headers: Type.Record(
        Type.String({ minLength: 1, maxLength: 128 }),
        Type.String({ maxLength: 4096 }),
        {
          minProperties: 1,
          maxProperties: 32,
        },
      ),
    },
    { additionalProperties: false },
  ),
]);
export type A2AOutboundAuthInput = Static<typeof A2AOutboundAuthInputSchema>;

export const A2AAgentCardSummarySchema = Type.Object(
  {
    name: Type.String({ maxLength: 256 }),
    description: Type.String({ maxLength: 4096 }),
    version: Type.String({ maxLength: 128 }),
    supportedBindings: Type.Array(Type.String({ maxLength: 64 }), { maxItems: 16 }),
    skills: Type.Array(
      Type.Object(
        { id: Type.String({ maxLength: 128 }), name: Type.String({ maxLength: 256 }) },
        { additionalProperties: false },
      ),
      { maxItems: 128 },
    ),
    streaming: Type.Boolean(),
  },
  { additionalProperties: false },
);
export type A2AAgentCardSummary = Static<typeof A2AAgentCardSummarySchema>;

export const A2AOutboundConnectionSchema = Type.Object(
  {
    schemaVersion: Type.Literal(1),
    connectionId: Type.String({ format: 'uuid' }),
    name: Type.String({ minLength: 1, maxLength: 128 }),
    endpoint: Type.String({ minLength: 1, maxLength: 2048 }),
    authKind: A2AAuthKindSchema,
    credentialConfigured: Type.Boolean(),
    agentCard: Type.Union([A2AAgentCardSummarySchema, Type.Null()]),
    createdAt: Type.String({ format: 'date-time' }),
    updatedAt: Type.String({ format: 'date-time' }),
  },
  { additionalProperties: false },
);
export type A2AOutboundConnection = Static<typeof A2AOutboundConnectionSchema>;

export const A2AOutboundConnectionInputSchema = Type.Object(
  {
    connectionId: Type.Optional(Type.String({ format: 'uuid' })),
    name: Type.String({ minLength: 1, maxLength: 128 }),
    endpoint: Type.String({ minLength: 1, maxLength: 2048 }),
    auth: A2AOutboundAuthInputSchema,
  },
  { additionalProperties: false },
);
export type A2AOutboundConnectionInput = Static<typeof A2AOutboundConnectionInputSchema>;

export const A2ARemoteTaskRecordSchema = Type.Object(
  {
    schemaVersion: Type.Literal(1),
    connectionId: Type.String({ format: 'uuid' }),
    remoteTaskId: Type.String({ minLength: 1, maxLength: 256 }),
    remoteContextId: Type.Union([Type.String({ maxLength: 256 }), Type.Null()]),
    projectId: Type.Union([Type.String({ format: 'uuid' }), Type.Null()]),
    localTaskId: Type.Union([Type.String({ format: 'uuid' }), Type.Null()]),
    callId: Type.Union([Type.String({ maxLength: 256 }), Type.Null()]),
    statusState: Type.Union([Type.String({ maxLength: 64 }), Type.Null()]),
    statusTimestamp: Type.Union([Type.String({ format: 'date-time' }), Type.Null()]),
    createdAt: Type.String({ format: 'date-time' }),
    updatedAt: Type.String({ format: 'date-time' }),
  },
  { additionalProperties: false },
);
export type A2ARemoteTaskRecord = Static<typeof A2ARemoteTaskRecordSchema>;

export const A2ARemoteTaskListInputSchema = Type.Object(
  {
    connectionId: Type.Optional(Type.String({ format: 'uuid' })),
    localTaskId: Type.Optional(Type.String({ format: 'uuid' })),
    limit: Type.Optional(Type.Integer({ minimum: 1, maximum: 32 })),
  },
  { additionalProperties: false },
);
export type A2ARemoteTaskListInput = Static<typeof A2ARemoteTaskListInputSchema>;

export const A2ARemoteTaskListResultSchema = Type.Object(
  { tasks: Type.Array(A2ARemoteTaskRecordSchema, { maxItems: 32 }) },
  { additionalProperties: false },
);
export type A2ARemoteTaskListResult = Static<typeof A2ARemoteTaskListResultSchema>;

export const A2ATaskPermissionSchema = Type.Union([
  Type.Literal('create'),
  Type.Literal('get'),
  Type.Literal('continue'),
  Type.Literal('stream'),
  Type.Literal('cancel'),
]);

export const A2AProjectGrantSchema = Type.Object(
  {
    projectId: Type.String({ format: 'uuid' }),
    role: Type.String({ minLength: 1, maxLength: 128 }),
    taskKinds: Type.Array(Type.Literal('agent.run'), { minItems: 1, maxItems: 1 }),
    permissions: Type.Array(A2ATaskPermissionSchema, { minItems: 1, maxItems: 5 }),
  },
  { additionalProperties: false },
);
export type A2AProjectGrant = Static<typeof A2AProjectGrantSchema>;

export const A2AInboundClientSchema = Type.Object(
  {
    schemaVersion: Type.Literal(1),
    clientId: Type.String({ format: 'uuid' }),
    name: Type.String({ minLength: 1, maxLength: 128 }),
    grants: Type.Array(A2AProjectGrantSchema, { maxItems: 64 }),
    credentialConfigured: Type.Boolean(),
    revokedAt: Type.Union([Type.String({ format: 'date-time' }), Type.Null()]),
    createdAt: Type.String({ format: 'date-time' }),
    updatedAt: Type.String({ format: 'date-time' }),
  },
  { additionalProperties: false },
);
export type A2AInboundClient = Static<typeof A2AInboundClientSchema>;

export const A2AInboundClientInputSchema = Type.Object(
  {
    clientId: Type.Optional(Type.String({ format: 'uuid' })),
    name: Type.String({ minLength: 1, maxLength: 128 }),
    grants: Type.Array(A2AProjectGrantSchema, { minItems: 1, maxItems: 64 }),
  },
  { additionalProperties: false },
);
export type A2AInboundClientInput = Static<typeof A2AInboundClientInputSchema>;

export const A2AInboundConfigSchema = Type.Object(
  {
    schemaVersion: Type.Literal(1),
    enabled: Type.Boolean(),
    address: Type.Literal('127.0.0.1'),
    port: Type.Integer({ minimum: 1024, maximum: 65535 }),
    active: Type.Boolean(),
  },
  { additionalProperties: false },
);
export type A2AInboundConfig = Static<typeof A2AInboundConfigSchema>;

export const A2AOutboundSendInputSchema = Type.Object(
  {
    connectionId: Type.String({ format: 'uuid' }),
    message: Type.String({ minLength: 1, maxLength: 16_384 }),
    taskId: Type.Optional(Type.String({ minLength: 1, maxLength: 256 })),
  },
  { additionalProperties: false },
);
export type A2AOutboundSendInput = Static<typeof A2AOutboundSendInputSchema>;
export const A2AOutboundTaskInputSchema = Type.Object(
  {
    connectionId: Type.String({ format: 'uuid' }),
    taskId: Type.String({ minLength: 1, maxLength: 256 }),
  },
  { additionalProperties: false },
);
export type A2AOutboundTaskInput = Static<typeof A2AOutboundTaskInputSchema>;
export const A2AOutboundCallInputSchema = Type.Union([
  A2AOutboundSendInputSchema,
  A2AOutboundTaskInputSchema,
]);
export type A2AOutboundCallInput = Static<typeof A2AOutboundCallInputSchema>;

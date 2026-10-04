import { Static, Type } from '@sinclair/typebox';
import { RouteCandidateSchema, RouteRequestSchema } from './schema';

const probability = Type.Number({ minimum: 0, maximum: 1 });
export const DecisionAnswerSchema = Type.Union([
  Type.Object(
    {
      type: Type.Literal('choice'),
      choice: Type.String(),
      probabilities: Type.Record(Type.String(), probability),
      confidence: Type.Union([probability, Type.Null()]),
    },
    { additionalProperties: false },
  ),
  Type.Object(
    {
      type: Type.Literal('score'),
      score: Type.Number({ minimum: 0 }),
      probabilities: Type.Record(Type.String(), probability),
      confidence: Type.Union([probability, Type.Null()]),
    },
    { additionalProperties: false },
  ),
  Type.Object({ type: Type.Literal('noul'), noul: probability }, { additionalProperties: false }),
]);
export type DecisionAnswer = Static<typeof DecisionAnswerSchema>;

export const DecisionAssessmentRequestSchema = Type.Object(
  {
    schemaVersion: Type.Literal(1),
    projectId: Type.String({ format: 'uuid' }),
    taskId: Type.Optional(Type.String({ format: 'uuid' })),
    summary: Type.String({ minLength: 1, maxLength: 16000 }),
    route: RouteRequestSchema,
  },
  { additionalProperties: false },
);
export type DecisionAssessmentRequest = Static<typeof DecisionAssessmentRequestSchema>;

export const DecisionAssessmentSchema = Type.Object(
  {
    schemaVersion: Type.Literal(1),
    assessmentId: Type.String({ format: 'uuid' }),
    projectId: Type.String({ format: 'uuid' }),
    taskId: Type.Union([Type.String({ format: 'uuid' }), Type.Null()]),
    mode: Type.Union([Type.Literal('off'), Type.Literal('shadow'), Type.Literal('assist')]),
    status: Type.Union([
      Type.Literal('disabled'),
      Type.Literal('assessed'),
      Type.Literal('fallback'),
    ]),
    reused: Type.Boolean(),
    policyVersion: Type.String(),
    requestedModel: Type.String(),
    configurationHash: Type.String(),
    returnedModel: Type.Union([Type.String(), Type.Null()]),
    stateHash: Type.String(),
    taskType: Type.String(),
    agentRole: Type.Union([Type.String(), Type.Null()]),
    baselineModelId: Type.Union([Type.String(), Type.Null()]),
    candidates: Type.Array(RouteCandidateSchema),
    answers: Type.Record(Type.String(), DecisionAnswerSchema),
    suggestedModelId: Type.Union([Type.String(), Type.Null()]),
    advice: Type.Array(
      Type.Union([
        Type.Literal('review'),
        Type.Literal('gather-context'),
        Type.Literal('split-task'),
        Type.Literal('validate-engine'),
      ]),
    ),
    reasonCodes: Type.Array(Type.String()),
    minProbability: probability,
    minMargin: probability,
    latencyMs: Type.Integer({ minimum: 0 }),
    usage: Type.Object(
      {
        inputTokens: Type.Union([Type.Integer({ minimum: 0 }), Type.Null()]),
        outputTokens: Type.Union([Type.Integer({ minimum: 0 }), Type.Null()]),
        costUsd: Type.Union([Type.Number({ minimum: 0 }), Type.Null()]),
      },
      { additionalProperties: false },
    ),
    createdAt: Type.String({ format: 'date-time' }),
  },
  { additionalProperties: false },
);
export type DecisionAssessment = Static<typeof DecisionAssessmentSchema>;

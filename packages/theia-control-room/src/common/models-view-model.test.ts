import { describe, expect, it } from 'vitest';
import type { DecisionAssessment, ModelPricing, RouteDecision } from '@gamecrafter/contracts';
import {
  formatDecisionAssessmentDetail,
  formatDecisionAssessmentUsage,
  formatPricing,
  summarizeDecision,
  summarizeDecisionAssessmentAdvice,
} from './models-view-model';

const assessment: DecisionAssessment = {
  schemaVersion: 1,
  assessmentId: '019535d4-2c00-7000-8000-000000000501',
  projectId: '019535d4-2c00-7000-8000-000000000502',
  taskId: null,
  mode: 'shadow',
  status: 'assessed',
  reused: false,
  policyVersion: 'decision-v1',
  requestedModel: 'local/decision-model',
  configurationHash: 'configuration-hash',
  returnedModel: 'local/decision-model',
  stateHash: 'state-hash',
  taskType: 'code',
  agentRole: 'coder',
  baselineModelId: 'local/baseline',
  candidates: [],
  answers: {
    recommendation: {
      type: 'choice',
      choice: 'keep-baseline',
      probabilities: { 'keep-baseline': 0.9 },
      confidence: 0.9,
    },
  },
  suggestedModelId: 'local/baseline',
  advice: ['review', 'validate-engine'],
  reasonCodes: ['needs-review'],
  minProbability: 0.6,
  minMargin: 0.1,
  latencyMs: 120,
  usage: { inputTokens: 12, outputTokens: 0, costUsd: null },
  createdAt: '2026-10-04T08:00:00.000Z',
};

describe('models view model helpers', () => {
  it('formats known and unknown token pricing', () => {
    const pricing: ModelPricing = { inputPerMTokUsd: 0.25, outputPerMTokUsd: null };
    expect(formatPricing(pricing)).toBe('$0.25 in / — out per MTok');
  });

  it('summarizes route decisions with exploration metadata', () => {
    const decision: RouteDecision = {
      decisionId: '019535d4-2c00-7000-8000-000000000501',
      modelId: 'account/model-a',
      reason: 'quality-first selected model-a',
      explored: true,
      policyVersion: 'quality-first-v1',
      candidates: [
        {
          modelId: 'account/model-a',
          score: 0.8,
          qualityEstimate: 0.7,
          observations: 2,
          estimatedCostUsd: 0.02,
          estimatedLatencyMs: 100,
          reliability: 0.75,
        },
      ],
      context: { projectId: null, agentRole: 'coder', taskType: 'code', engine: null },
      decidedAt: '2026-09-28T00:00:00.000Z',
    };
    expect(summarizeDecision(decision)).toBe(
      'quality-first selected model-a · 1 candidate · explored',
    );
  });

  it('summarizes assessment advice without exposing unbounded reason text', () => {
    expect(summarizeDecisionAssessmentAdvice(assessment)).toBe(
      'Review · Validate engine · needs-review',
    );
    expect(
      summarizeDecisionAssessmentAdvice({
        advice: [],
        reasonCodes: ['x'.repeat(400)],
      }).length,
    ).toBeLessThanOrEqual(280);
  });

  it('reports unknown assessment usage as unknown instead of zero', () => {
    expect(formatDecisionAssessmentUsage(assessment)).toBe(
      'Input 12 · output 0 tokens · cost unknown',
    );
    expect(
      formatDecisionAssessmentUsage({
        ...assessment,
        usage: { inputTokens: null, outputTokens: null, costUsd: 0 },
      }),
    ).toBe('Input unknown · output unknown tokens · cost $0.000000 USD');
  });

  it('formats raw assessment answers as bounded valid JSON', () => {
    const detail = formatDecisionAssessmentDetail(assessment);
    expect(JSON.parse(detail)).toMatchObject({
      answers: { recommendation: { choice: 'keep-baseline' } },
    });

    const oversized = {
      ...assessment,
      answers: Object.fromEntries(
        Array.from({ length: 200 }, (_, index) => [
          `answer-${index}`,
          {
            type: 'choice' as const,
            choice: 'recommendation-'.repeat(100),
            probabilities: { yes: 1 },
            confidence: 1,
          },
        ]),
      ),
    };
    const bounded = formatDecisionAssessmentDetail(oversized);
    expect(bounded.length).toBeLessThanOrEqual(10_000);
    expect(JSON.parse(bounded)).toBeTruthy();

    const fallback = formatDecisionAssessmentDetail({
      ...assessment,
      assessmentId: '"'.repeat(50_000),
      reasonCodes: ['"'.repeat(50_000)],
    });
    expect(fallback.length).toBeLessThanOrEqual(10_000);
    expect(JSON.parse(fallback)).toMatchObject({ truncated: true });
  });
});

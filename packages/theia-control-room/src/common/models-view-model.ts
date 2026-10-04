import type { DecisionAssessment, ModelPricing, RouteDecision } from '@gamecrafter/contracts';

export function formatPricing(pricing: ModelPricing): string {
  const format = (value: number | null) => (value === null ? '—' : `$${value.toFixed(2)}`);
  return `${format(pricing.inputPerMTokUsd)} in / ${format(pricing.outputPerMTokUsd)} out per MTok`;
}

export function summarizeDecision(decision: RouteDecision): string {
  const candidateCount = decision.candidates.length;
  const candidates = `${candidateCount} ${candidateCount === 1 ? 'candidate' : 'candidates'}`;
  return `${decision.reason} · ${candidates}${decision.explored ? ' · explored' : ''}`;
}

export function summarizeDecisionAssessmentAdvice(
  assessment: Pick<DecisionAssessment, 'advice' | 'reasonCodes'>,
): string {
  const adviceLabels: Record<DecisionAssessment['advice'][number], string> = {
    review: 'Review',
    'gather-context': 'Gather context',
    'split-task': 'Split task',
    'validate-engine': 'Validate engine',
  };
  const advice = assessment.advice.slice(0, 4).map((item) => adviceLabels[item]);
  const reasons = assessment.reasonCodes.slice(0, 3).map((item) => item.slice(0, 80));
  const summary = [...advice, ...reasons].join(' · ') || 'No task-specific advice recorded';
  return summary.length > 280 ? `${summary.slice(0, 277)}...` : summary;
}

export function formatDecisionAssessmentUsage(assessment: DecisionAssessment): string {
  const { inputTokens, outputTokens, costUsd } = assessment.usage;
  const input = inputTokens === null ? 'unknown' : inputTokens.toLocaleString();
  const output = outputTokens === null ? 'unknown' : outputTokens.toLocaleString();
  const cost = costUsd === null ? 'unknown' : `$${costUsd.toFixed(6)} USD`;
  return `Input ${input} · output ${output} tokens · cost ${cost}`;
}

export function formatDecisionAssessmentDetail(assessment: DecisionAssessment): string {
  const bounded = boundDetailValue(assessment);
  const detail = JSON.stringify(bounded, null, 2);
  if (detail.length <= 10_000) return detail;

  const clip = (value: string | null) => (value === null ? null : value.slice(0, 80));
  return JSON.stringify(
    {
      schemaVersion: assessment.schemaVersion,
      assessmentId: clip(assessment.assessmentId),
      projectId: clip(assessment.projectId),
      taskId: clip(assessment.taskId),
      mode: assessment.mode,
      status: assessment.status,
      baselineModelId: clip(assessment.baselineModelId),
      suggestedModelId: clip(assessment.suggestedModelId),
      advice: assessment.advice,
      reasonCodes: assessment.reasonCodes.slice(0, 4).map((reason) => reason.slice(0, 80)),
      answers: '[Omitted because this assessment exceeds the detail display limit]',
      truncated: true,
    },
    null,
    2,
  );
}

function boundDetailValue(value: unknown, budget = { nodes: 160, characters: 6_800 }): unknown {
  if (budget.nodes <= 0 || budget.characters <= 0) return '[truncated]';
  budget.nodes -= 1;

  if (typeof value === 'string') {
    const text = value.slice(0, Math.max(0, Math.min(value.length, budget.characters - 8)));
    budget.characters -= text.length + 8;
    return text.length < value.length ? `${text}...` : text;
  }
  if (Array.isArray(value)) {
    const bounded = value.slice(0, 10).map((item) => boundDetailValue(item, budget));
    if (value.length > bounded.length && budget.nodes > 0) {
      bounded.push(`[${value.length - bounded.length} additional entries omitted]`);
    }
    return bounded;
  }
  if (value !== null && typeof value === 'object') {
    const entries = Object.entries(value);
    const bounded: Record<string, unknown> = {};
    for (const [key, entry] of entries.slice(0, 32)) {
      if (budget.nodes <= 0 || budget.characters <= 0) break;
      const boundedKey = key.slice(0, 100);
      budget.characters -= boundedKey.length + 4;
      bounded[boundedKey] = boundDetailValue(entry, budget);
    }
    if (entries.length > Object.keys(bounded).length && budget.nodes > 0) {
      bounded.truncated = true;
    }
    return bounded;
  }
  return value;
}

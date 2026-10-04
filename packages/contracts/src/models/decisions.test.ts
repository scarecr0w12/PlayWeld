import { describe, expect, it } from 'vitest';
import { compile } from '../validation';
import { uuidv7 } from '../ids';
import { DecisionAssessmentRequestSchema } from './decisions';
import { ModelUsageRecordSchema } from './schema';
import { RpcMethods } from '../rpc/protocol';

describe('decision message contracts', () => {
  it('requires version 1 on assessments and history envelopes', () => {
    const projectId = uuidv7();
    const assess = compile(DecisionAssessmentRequestSchema);
    const request = { projectId, summary: 'Review the build', route: { taskType: 'review' } };
    expect(assess.check(request)).toBe(false);
    expect(assess.check({ ...request, schemaVersion: 1 })).toBe(true);
    expect(assess.check({ ...request, schemaVersion: 2 })).toBe(false);
    expect(compile(RpcMethods['decisions/history'].params).check({ projectId })).toBe(false);
    expect(
      compile(RpcMethods['decisions/history'].params).check({ schemaVersion: 1, projectId }),
    ).toBe(true);
    expect(
      compile(RpcMethods['decisions/history'].result).check({ schemaVersion: 1, assessments: [] }),
    ).toBe(true);
  });

  it('allows unknown decision token counts without changing completion token requirements', () => {
    const usage = {
      usageId: uuidv7(),
      requestId: null,
      taskId: null,
      decisionId: null,
      modelId: 'local-judge',
      occurredAt: new Date().toISOString(),
      source: 'decision',
      inputTokens: null,
      outputTokens: null,
      cacheReadInputTokens: null,
      cacheCreationInputTokens: null,
      costUsd: null,
      costStatus: 'unknown',
    };
    const validate = compile(ModelUsageRecordSchema);
    expect(validate.check(usage)).toBe(true);
    expect(validate.check({ ...usage, source: 'completion' })).toBe(false);
    expect(
      validate.check({
        ...usage,
        source: 'completion',
        inputTokens: 1,
        outputTokens: 0,
        cacheReadInputTokens: 0,
        cacheCreationInputTokens: 0,
      }),
    ).toBe(true);
  });
});

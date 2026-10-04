import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import {
  uuidv7,
  type DecisionAssessmentRequest,
  type EffectiveSetting,
  type ModelCapabilities,
  type ModelPricing,
} from '@gamecrafter/contracts';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { Database } from '../db/database';
import { migrate } from '../db/migrator';
import { CredentialStore } from '../profile/credential-store';
import { profileMigrations } from '../profile/migrations';
import type { SettingsService } from '../settings/settings-service';
import { DecisionService } from './decision-service';
import {
  assessDecisions,
  type DecisionAnswer,
  type DecisionQuestion,
  type DecisionProviderResult,
} from './decision-provider';
import { ModelRegistry } from './model-registry';
import { ModelRouter } from './router';
import { ModelProviderRegistry } from './providers';

const NOW = new Date('2026-10-04T10:11:12.000Z');
type AssessInput = Parameters<typeof assessDecisions>[0];

const settingsDefaults: Record<string, unknown> = {
  'models.autoRouting.quality': 'quality-first',
  'models.autoRouting.maxLatencyMs': 0,
  'models.budget.maxCostPerTaskUsd': 5,
  'models.exploration.rate': 0,
  'models.exploration.budgetUsdPerDay': 1,
  'models.decisions.mode': 'assist',
  'models.decisions.accountId': '',
  'models.decisions.model': 'judge-v1',
  'models.decisions.protocol': 'systemone',
  'models.decisions.allowRemote': false,
  'models.decisions.timeoutMs': 3000,
  'models.decisions.minProbability': 0.65,
  'models.decisions.minMargin': 0.2,
};

const directories: string[] = [];
const databases: Database[] = [];

afterEach(() => {
  for (const database of databases.splice(0)) database.close();
  for (const directory of directories.splice(0))
    rmSync(directory, { recursive: true, force: true });
});

describe('DecisionService', () => {
  it('does not call the transport when unconfigured or explicitly off', async () => {
    const fixture = await createFixture({
      'models.decisions.mode': 'shadow',
      'models.decisions.accountId': '',
      'models.decisions.model': '',
    });
    const request = createRequest(uuidv7());

    expect(fixture.service.enabled(request.projectId)).toBe(false);
    const unconfigured = await fixture.service.assess(request);
    expect(unconfigured).toMatchObject({
      status: 'disabled',
      reasonCodes: ['decision-not-configured'],
    });
    expect(fixture.assess).not.toHaveBeenCalled();

    fixture.setSetting('models.decisions.mode', 'off');
    fixture.setSetting('models.decisions.accountId', fixture.judgeAccountId);
    fixture.setSetting('models.decisions.model', 'judge-v1');
    expect(fixture.service.enabled(request.projectId)).toBe(false);
    const off = await fixture.service.assess({ ...request, taskId: uuidv7() });
    expect(off).toMatchObject({
      mode: 'off',
      status: 'disabled',
      reasonCodes: ['decision-not-configured'],
    });
    expect(fixture.assess).not.toHaveBeenCalled();
  });

  it('records an explicit disabled decision account as deterministic fallback', async () => {
    const fixture = await createFixture();
    fixture.registry.updateAccount(fixture.judgeAccountId, { enabled: false });

    const assessment = await fixture.service.assess(createRequest(uuidv7()));

    expect(assessment).toMatchObject({
      status: 'fallback',
      reasonCodes: ['decision-account-unavailable'],
    });
    expect(assessment.baselineModelId).toBeTruthy();
    expect(fixture.assess).not.toHaveBeenCalled();
  });

  it('rejects deterministic pool conflicts before invoking the decision transport', async () => {
    const fixture = await createFixture();
    fixture.registry.createPool({
      name: 'Programmer candidate',
      scope: 'platform',
      target: { kind: 'agent', id: 'programmer' },
      modelIds: [fixture.modelIds.alpha],
    });
    fixture.registry.createPool({
      name: 'Code candidate',
      scope: 'platform',
      target: { kind: 'task-type', id: 'code' },
      modelIds: [fixture.modelIds.beta],
    });

    await expect(fixture.service.assess(createRequest(uuidv7()))).rejects.toMatchObject({
      code: -32042,
      data: { stage: 'pools' },
    });
    expect(fixture.assess).not.toHaveBeenCalled();
    expect(fixture.service.history(uuidv7())).toEqual([]);
  });

  it('sends only eligible candidates and recommends by probability and margin, not confidence', async () => {
    const fixture = await createFixture();
    fixture.setAnswer('model', {
      type: 'choice',
      choice: 'm0',
      probabilities: { m0: 0.78, m1: 0.22 },
      confidence: 0.01,
    });
    const request = createRequest(uuidv7());

    const assessment = await fixture.service.assess(request);
    const transportInput = fixture.assess.mock.calls[0]![0];
    const stateCandidates = transportInput.state.candidates as { modelId: string }[];
    const modelQuestion = transportInput.questions.model as Extract<
      DecisionQuestion,
      { type: 'choice' }
    >;

    expect(stateCandidates.map((candidate) => candidate.modelId)).toEqual([
      fixture.modelIds.alpha,
      fixture.modelIds.beta,
    ]);
    expect(Object.keys(modelQuestion.criteria).sort()).toEqual(['m0', 'm1']);
    expect(assessment).toMatchObject({
      status: 'assessed',
      suggestedModelId: fixture.modelIds.alpha,
    });
    expect(assessment.answers.model).toMatchObject({ confidence: 0.01 });
  });

  it('records shadow recommendations without exposing them as routing advice', async () => {
    const fixture = await createFixture({ 'models.decisions.mode': 'shadow' });
    const request = createRequest(uuidv7());
    const assessment = await fixture.service.assess(request);

    expect(assessment.suggestedModelId).toBeTruthy();
    expect(assessment.reasonCodes).toContain('shadow-model-recommendation');
    expect(
      fixture.service.routingAdvice(
        assessment.assessmentId,
        request.projectId,
        request.taskId!,
        request.route,
      ),
    ).toBeUndefined();
  });

  it('returns assist advice only for the same project, task, role, type, and current configuration', async () => {
    const fixture = await createFixture();
    const request = createRequest(uuidv7());
    const assessment = await fixture.service.assess(request);
    const advice = () =>
      fixture.service.routingAdvice(
        assessment.assessmentId,
        request.projectId,
        request.taskId!,
        request.route,
      );
    const expected = { modelId: fixture.modelIds.alpha, assessmentId: assessment.assessmentId };

    expect(advice()).toEqual(expected);
    expect(
      fixture.service.routingAdvice(
        assessment.assessmentId,
        uuidv7(),
        request.taskId!,
        request.route,
      ),
    ).toBeUndefined();
    expect(
      fixture.service.routingAdvice(
        assessment.assessmentId,
        request.projectId,
        uuidv7(),
        request.route,
      ),
    ).toBeUndefined();
    expect(
      adviceWithRoute(fixture, assessment.assessmentId, request, { agentRole: 'artist' }),
    ).toBeUndefined();
    expect(
      adviceWithRoute(fixture, assessment.assessmentId, request, { taskType: 'art' }),
    ).toBeUndefined();

    for (const [key, value] of [
      ['models.decisions.model', 'judge-v2'],
      ['models.decisions.minProbability', 0.7],
      ['models.decisions.minMargin', 0.25],
      ['models.decisions.accountId', fixture.alternateJudgeAccountId],
    ] as const) {
      const original = fixture.getSetting(key);
      fixture.setSetting(key, value);
      expect(advice(), `${key} invalidates old advice`).toBeUndefined();
      fixture.setSetting(key, original);
      expect(advice(), `${key} restored`).toEqual(expected);
    }

    const originalBaseUrl = fixture.registry.getAccount(fixture.judgeAccountId)!.baseUrl;
    fixture.registry.updateAccount(fixture.judgeAccountId, {
      baseUrl: 'http://127.0.0.1:49199/v1',
    });
    expect(advice()).toBeUndefined();
    fixture.registry.updateAccount(fixture.judgeAccountId, { baseUrl: originalBaseUrl });
    expect(advice()).toEqual(expected);

    fixture.registry.updateAccount(fixture.judgeAccountId, { enabled: false });
    expect(advice()).toBeUndefined();
    fixture.registry.updateAccount(fixture.judgeAccountId, { enabled: true });
    expect(advice()).toEqual(expected);

    fixture.setSetting('models.decisions.mode', 'off');
    expect(advice()).toBeUndefined();
  });

  it('persists history by project and task while keeping unknown usage null', async () => {
    const fixture = await createFixture();
    const projectOne = uuidv7();
    const projectTwo = uuidv7();
    const taskOne = uuidv7();
    const taskTwo = uuidv7();
    const first = await fixture.service.assess(createRequest(projectOne, taskOne, 'First summary'));
    await fixture.service.assess(createRequest(projectOne, taskTwo, 'Second summary'));
    await fixture.service.assess(createRequest(projectTwo, taskOne, 'Third summary'));

    expect(first).toMatchObject({
      createdAt: NOW.toISOString(),
      usage: { inputTokens: null, outputTokens: null, costUsd: null },
    });
    expect(fixture.service.history(projectOne, taskOne)).toHaveLength(1);
    expect(fixture.service.history(projectOne, taskOne)[0]?.assessmentId).toBe(first.assessmentId);
    expect(fixture.service.history(projectOne, taskTwo)).toHaveLength(1);
    expect(fixture.service.history(projectTwo, taskOne)).toHaveLength(1);
    expect(fixture.service.history(projectOne)).toHaveLength(2);
  });

  it('reuses the same task assessment without a second transport call or history row', async () => {
    const fixture = await createFixture();
    const request = createRequest(uuidv7(), uuidv7(), 'Stable task summary');

    const first = await fixture.service.assess(request);
    const reused = await fixture.service.assess(request);

    expect(fixture.assess).toHaveBeenCalledTimes(1);
    expect(reused).toMatchObject({ assessmentId: first.assessmentId, reused: true });
    expect(fixture.service.history(request.projectId, request.taskId)).toHaveLength(1);
    expect(fixture.router.modelUsage(request.projectId, 20)).toEqual([
      expect.objectContaining({
        source: 'decision',
        inputTokens: null,
        outputTokens: null,
        costUsd: null,
        costStatus: 'unknown',
      }),
    ]);
  });

  it('coalesces simultaneous identical requests without charging or persisting twice', async () => {
    const fixture = await createFixture();
    const request = createRequest(uuidv7());
    const assessments = await Promise.all([
      fixture.service.assess(request),
      fixture.service.assess(request),
      fixture.service.assess(request),
    ]);
    expect(fixture.assess).toHaveBeenCalledTimes(1);
    expect(assessments.filter((assessment) => !assessment.reused)).toHaveLength(1);
    expect(new Set(assessments.map((assessment) => assessment.assessmentId)).size).toBe(1);
    expect(fixture.service.history(request.projectId, request.taskId)).toHaveLength(1);
  });

  it('skips model selection for a manual model and never overrides that choice', async () => {
    const fixture = await createFixture();
    const request = createRequest(uuidv7(), uuidv7(), 'Manual selection', {
      manualModelId: fixture.modelIds.beta,
    });

    const assessment = await fixture.service.assess(request);
    const questions = fixture.assess.mock.calls[0]![0].questions;

    expect(questions).not.toHaveProperty('model');
    expect(assessment.baselineModelId).toBe(fixture.modelIds.beta);
    expect(assessment.suggestedModelId).toBeNull();
    expect(assessment.reasonCodes).toContain('manual-model-preserved');
    expect(
      fixture.service.routingAdvice(
        assessment.assessmentId,
        request.projectId,
        request.taskId!,
        request.route,
      ),
    ).toBeUndefined();
  });

  it('keeps task advice flags separate from task type and completion evidence', async () => {
    const fixture = await createFixture();
    for (const key of [
      'missing_context',
      'needs_review',
      'split_task',
      'needs_engine_validation',
    ]) {
      fixture.setAnswer(key, { type: 'noul', noul: 0.99 });
    }
    const request = createRequest(uuidv7());
    const baseline = fixture.router.preview(request.route);

    const assessment = await fixture.service.assess(request);

    expect(assessment.advice).toEqual([
      'gather-context',
      'review',
      'split-task',
      'validate-engine',
    ]);
    expect(assessment.taskType).toBe(request.route.taskType);
    expect(assessment.baselineModelId).toBe(baseline.modelId);
    expect(assessment).not.toHaveProperty('completed');
    expect(assessment.advice).not.toContain('complete-task');
  });

  it('stores only sanitized fallback metadata after transport failure', async () => {
    const fixture = await createFixture();
    const summary = 'Raw summary must not be persisted, unique-44';
    const request = createRequest(uuidv7(), uuidv7(), summary);
    fixture.failWith(new Error(`${summary}; decision-api-key-secret; private-header-value`));

    const assessment = await fixture.service.assess(request);
    const saved = fixture.database
      .prepare(
        'SELECT assessment_json AS assessment FROM decision_assessments WHERE assessment_id = ?',
      )
      .get<{ assessment: string }>(assessment.assessmentId)!.assessment;

    expect(assessment).toMatchObject({
      status: 'fallback',
      reasonCodes: ['decision-request-failed'],
      answers: {},
    });
    expect(saved).not.toContain(summary);
    expect(saved).not.toContain('decision-api-key-secret');
    expect(saved).not.toContain('private-header-value');
    expect(saved).not.toContain('Raw summary');
  });
});

function adviceWithRoute(
  fixture: Awaited<ReturnType<typeof createFixture>>,
  assessmentId: string,
  request: DecisionAssessmentRequest,
  patch: Partial<DecisionAssessmentRequest['route']>,
) {
  return fixture.service.routingAdvice(assessmentId, request.projectId, request.taskId!, {
    ...request.route,
    ...patch,
  });
}

function createRequest(
  projectId: string,
  taskId = uuidv7(),
  summary = 'Implement an editor feature',
  routePatch: Partial<DecisionAssessmentRequest['route']> = {},
): DecisionAssessmentRequest {
  return {
    schemaVersion: 1,
    projectId,
    taskId,
    summary,
    route: {
      projectId,
      taskType: 'code',
      agentRole: 'programmer',
      requiredCapabilities: ['tools'],
      ...routePatch,
    },
  };
}

async function createFixture(initialSettings: Record<string, unknown> = {}) {
  const profileDir = mkdtempSync(path.join(tmpdir(), 'gc-decision-service-'));
  directories.push(profileDir);
  const database = Database.open(':memory:');
  databases.push(database);
  migrate(database, profileMigrations);

  const providerRegistry = new ModelProviderRegistry();
  providerRegistry.register('openai-compatible', {
    async listModels() {
      const capabilities: Partial<ModelCapabilities> = { chat: true, tools: true };
      const pricing: Partial<ModelPricing> = { inputPerMTokUsd: 0.5, outputPerMTokUsd: 1 };
      return [
        { providerModelId: 'alpha', displayName: 'Alpha', capabilities, pricing },
        { providerModelId: 'beta', displayName: 'Beta', capabilities, pricing },
        { providerModelId: 'outsider', displayName: 'Outsider', capabilities, pricing },
      ];
    },
    async complete() {
      throw new Error('Not used by decision-service tests');
    },
    async embed() {
      throw new Error('Not used by decision-service tests');
    },
  });
  const registry = new ModelRegistry(
    database,
    new CredentialStore(database, profileDir),
    providerRegistry,
    () => new Date(NOW),
  );
  const executionAccount = registry.addAccount({
    providerKind: 'openai-compatible',
    displayName: 'Execution models',
    baseUrl: 'http://127.0.0.1:49101/v1',
    isLocal: true,
  });
  const judgeAccount = registry.addAccount({
    providerKind: 'openai-compatible',
    displayName: 'Decision model',
    baseUrl: 'http://127.0.0.1:49102/v1',
    apiKey: 'decision-api-key-secret',
    headers: { 'x-private-header': 'private-header-value' },
    isLocal: true,
  });
  const alternateJudgeAccount = registry.addAccount({
    providerKind: 'openai-compatible',
    displayName: 'Alternate decision model',
    baseUrl: 'http://127.0.0.1:49103/v1',
    isLocal: true,
  });
  const discovered = await registry.discover(executionAccount.accountId);
  const modelIds = {
    alpha: discovered.models.find((model) => model.providerModelId === 'alpha')!.modelId,
    beta: discovered.models.find((model) => model.providerModelId === 'beta')!.modelId,
    outsider: discovered.models.find((model) => model.providerModelId === 'outsider')!.modelId,
  };
  registry.updateModel(modelIds.alpha, { workTypes: ['code'], roles: ['programmer'] });
  registry.updateModel(modelIds.beta, { workTypes: ['code'], roles: ['programmer'] });
  registry.updateModel(modelIds.outsider, { workTypes: ['art'], roles: ['programmer'] });

  const values = new Map(
    Object.entries({
      ...settingsDefaults,
      'models.decisions.accountId': judgeAccount.accountId,
      ...initialSettings,
    }),
  );
  const settings: Pick<SettingsService, 'resolve'> = {
    resolve(key: string): EffectiveSetting {
      const value = values.get(key);
      return { key, value, source: 'default', layers: { default: value } } as EffectiveSetting;
    },
  };
  const router = new ModelRouter({
    database,
    registry,
    settings,
    now: () => new Date(NOW),
    random: () => 0,
  });
  const answerOverrides: Record<string, DecisionAnswer> = {};
  let failure: Error | undefined;
  const assess = vi.fn(async (input: AssessInput): Promise<DecisionProviderResult> => {
    if (failure) throw failure;
    return createResult(input, answerOverrides);
  });
  const service = new DecisionService({
    database,
    settings,
    registry,
    router,
    assess,
    now: () => new Date(NOW),
  });

  return {
    database,
    registry,
    router,
    service,
    assess,
    judgeAccountId: judgeAccount.accountId,
    alternateJudgeAccountId: alternateJudgeAccount.accountId,
    modelIds,
    setSetting(key: string, value: unknown) {
      values.set(key, value);
    },
    getSetting(key: string) {
      return values.get(key);
    },
    setAnswer(key: string, answer: DecisionAnswer) {
      answerOverrides[key] = answer;
    },
    failWith(error: Error) {
      failure = error;
    },
  };
}

function createResult(
  input: AssessInput,
  overrides: Record<string, DecisionAnswer>,
): DecisionProviderResult {
  const answers: Record<string, DecisionAnswer> = {};
  for (const [id, question] of Object.entries(input.questions)) {
    if (question.type === 'choice') {
      const keys = Object.keys(question.criteria);
      const selected = keys[0]!;
      answers[id] = {
        type: 'choice',
        choice: selected,
        probabilities: Object.fromEntries(keys.map((key) => [key, Number(key === selected)])),
        confidence: 1,
      };
    } else if (question.type === 'noul') {
      answers[id] = { type: 'noul', noul: 0.1 };
    } else {
      answers[id] = {
        type: 'score',
        score: 0,
        probabilities: Object.fromEntries(
          question.criteria.map((_criterion, index) => [String(index), Number(index === 0)]),
        ),
        confidence: 1,
      };
    }
  }
  Object.assign(answers, overrides);
  return {
    model: 'judge-returned-v1',
    answers,
    usage: { inputTokens: null, outputTokens: null, costUsd: null },
    latencyMs: 12,
  };
}

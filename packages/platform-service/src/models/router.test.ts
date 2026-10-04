import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { uuidv7 } from '@gamecrafter/contracts';
import type {
  EffectiveSetting,
  ModelCapabilities,
  ModelPricing,
  RouteOutcome,
} from '@gamecrafter/contracts';
import { Database } from '../db/database';
import { migrate } from '../db/migrator';
import { profileMigrations } from '../profile/migrations';
import { CredentialStore } from '../profile/credential-store';
import type { SettingsService } from '../settings/settings-service';
import { ModelRegistry } from './model-registry';
import { ModelRouter } from './router';
import { ModelProviderRegistry, type ModelProvider } from './providers';

const defaultSettings: Record<string, unknown> = {
  'models.autoRouting.quality': 'quality-first',
  'models.autoRouting.maxLatencyMs': 0,
  'models.budget.maxCostPerTaskUsd': 5,
  'models.exploration.rate': 0,
  'models.exploration.budgetUsdPerDay': 1,
};

describe('ModelRouter', () => {
  it('previews eligible candidates without persisting a selection or exploring', async () => {
    const fixture = await createFixture();
    try {
      fixture.setSetting('models.exploration.rate', 1);
      const preview = fixture.router.preview({ taskType: 'code', agentRole: 'programmer' });
      expect(preview.candidates).toHaveLength(2);
      expect(preview.explored).toBe(false);
      expect(fixture.router.decisions()).toHaveLength(0);
    } finally {
      fixture.close();
    }
  });

  it('applies bounded advice only after current filters and preserves manual selection', async () => {
    const fixture = await createFixture();
    try {
      fixture.setSetting('models.autoRouting.quality', 'cost-first');
      const route = { taskType: 'code', agentRole: 'programmer' };
      const advice = { modelId: fixture.modelIds.good, assessmentId: uuidv7() };
      const assisted = fixture.router.route(route, undefined, advice);
      expect(assisted.modelId).toBe(fixture.modelIds.good);
      expect(assisted.policyVersion).toBe('quality-first-v1+decision-advice-v1');
      expect(assisted.reason).toContain(advice.assessmentId);
      expect(
        fixture.router.route({ ...route, manualModelId: fixture.modelIds.cheap }, undefined, advice)
          .modelId,
      ).toBe(fixture.modelIds.cheap);
      fixture.registry.updateModel(fixture.modelIds.good, { enabled: false });
      const fallback = fixture.router.route(route, undefined, advice);
      expect(fallback.modelId).toBe(fixture.modelIds.cheap);
      expect(fallback.reason).toContain('advice ineligible');
      fixture.registry.createPool({
        name: 'Empty pool',
        scope: 'platform',
        target: null,
        modelIds: [],
      });
      expect(() => fixture.router.route(route, undefined, advice)).toThrowError(
        expect.objectContaining({ data: expect.objectContaining({ stage: 'pools' }) }),
      );
    } finally {
      fixture.close();
    }
  });

  it('does not let advice bypass capabilities or estimated budget filters', async () => {
    const fixture = await createFixture();
    try {
      const advice = { modelId: fixture.modelIds.cheap, assessmentId: uuidv7() };
      expect(
        fixture.router.route(
          { taskType: 'code', agentRole: 'programmer', requiredCapabilities: ['tools'] },
          undefined,
          advice,
        ).modelId,
      ).toBe(fixture.modelIds.good);
      expect(() =>
        fixture.router.route(
          { taskType: 'code', agentRole: 'programmer', constraints: { maxCostUsd: 0 } },
          undefined,
          advice,
        ),
      ).toThrowError(
        expect.objectContaining({ data: expect.objectContaining({ stage: 'constraints' }) }),
      );
    } finally {
      fixture.close();
    }
  });

  it('filters work types, roles, and capabilities before routing', async () => {
    const fixture = await createFixture();
    try {
      const decision = fixture.router.route({
        taskType: 'code',
        agentRole: 'programmer',
        requiredCapabilities: ['tools'],
      });
      expect(decision.modelId).toBe(fixture.modelIds.good);
      expect(decision.candidates.map((candidate) => candidate.modelId)).toEqual([
        fixture.modelIds.good,
      ]);
      expect(() =>
        fixture.router.route({
          taskType: 'code',
          agentRole: 'artist',
          requiredCapabilities: ['tools'],
        }),
      ).toThrowError(expect.objectContaining({ code: -32042 }));
    } finally {
      fixture.close();
    }
  });

  it('intersects applicable agent and task-type pool unions and reports an empty conflict', async () => {
    const fixture = await createFixture();
    try {
      const agentPool = fixture.registry.createPool({
        name: 'Programmers',
        scope: 'platform',
        target: { kind: 'agent', id: 'programmer' },
        modelIds: [fixture.modelIds.cheap],
      });
      fixture.registry.createPool({
        name: 'Code tasks',
        scope: 'platform',
        target: { kind: 'task-type', id: 'code' },
        modelIds: [fixture.modelIds.good],
      });
      try {
        fixture.router.route({ taskType: 'code', agentRole: 'programmer' });
        throw new Error('Expected an empty pool intersection');
      } catch (error) {
        expect(error).toMatchObject({ code: -32042, data: { stage: 'pools' } });
      }
      fixture.registry.updatePool(agentPool.poolId, { modelIds: [fixture.modelIds.good] });
      expect(fixture.router.route({ taskType: 'code', agentRole: 'programmer' }).modelId).toBe(
        fixture.modelIds.good,
      );
    } finally {
      fixture.close();
    }
  });

  it('scores by quality or cost and uses task-type observations with Bayesian fallback', async () => {
    const fixture = await createFixture();
    try {
      for (let index = 0; index < 3; index += 1) {
        await recordOutcome(fixture.router, fixture.modelIds.good, 'code', true, 1);
        await recordOutcome(fixture.router, fixture.modelIds.cheap, 'code', false, 0.1);
      }
      const qualityDecision = fixture.router.route({ taskType: 'code', agentRole: 'programmer' });
      expect(qualityDecision.modelId).toBe(fixture.modelIds.good);
      fixture.setSetting('models.autoRouting.quality', 'cost-first');
      const costDecision = fixture.router.route({ taskType: 'code', agentRole: 'programmer' });
      expect(costDecision.modelId).toBe(fixture.modelIds.cheap);

      fixture.setSetting('models.autoRouting.quality', 'quality-first');
      fixture.registry.updateModel(fixture.modelIds.cheap, { workTypes: [], roles: [] });
      fixture.registry.updateModel(fixture.modelIds.good, { workTypes: [], roles: [] });
      const fallbackDecision = fixture.router.route({ taskType: 'art' });
      const good = fallbackDecision.candidates.find(
        (candidate) => candidate.modelId === fixture.modelIds.good,
      );
      expect(good?.observations).toBe(3);
      expect(good?.qualityEstimate).toBeGreaterThan(0.5);
    } finally {
      fixture.close();
    }
  });

  it('explores the least-observed eligible model only while the daily budget remains', async () => {
    const fixture = await createFixture();
    try {
      for (let index = 0; index < 3; index += 1) {
        await recordOutcome(fixture.router, fixture.modelIds.good, 'code', true, 1);
      }
      fixture.setSetting('models.exploration.rate', 1);
      fixture.setSetting('models.exploration.budgetUsdPerDay', 0.5);
      const explored = fixture.router.route({ taskType: 'code', agentRole: 'programmer' });
      expect(explored.modelId).toBe(fixture.modelIds.cheap);
      expect(explored.explored).toBe(true);
      fixture.router.reportOutcome({
        decisionId: explored.decisionId,
        success: false,
        qualityScore: null,
        source: 'self',
        costUsd: 0.6,
        latencyMs: 200,
        inputTokens: 100,
        outputTokens: 20,
      });
      const afterBudget = fixture.router.route({ taskType: 'code', agentRole: 'programmer' });
      expect(afterBudget.explored).toBe(false);
    } finally {
      fixture.close();
    }
  });

  it('stops daily exploration after an outcome with unpriced usage', async () => {
    const fixture = await createFixture();
    try {
      for (let index = 0; index < 3; index += 1) {
        await recordOutcome(fixture.router, fixture.modelIds.good, 'code', true, 1);
      }
      fixture.setSetting('models.exploration.rate', 1);
      const decision = fixture.router.route({
        taskType: 'code',
        agentRole: 'programmer',
      });
      expect(decision.explored).toBe(true);
      fixture.router.reportOutcome({
        decisionId: decision.decisionId,
        success: true,
        qualityScore: null,
        source: 'self',
        costUsd: null,
        costStatus: 'unknown',
        latencyMs: 100,
        inputTokens: 100,
        outputTokens: 20,
      });

      expect(fixture.router.route({ taskType: 'code', agentRole: 'programmer' }).explored).toBe(
        false,
      );
    } finally {
      fixture.close();
    }
  });

  it('falls back to baseline routing when every exploration candidate exceeds the remaining budget', async () => {
    const fixture = await createFixture();
    try {
      for (let index = 0; index < 3; index += 1) {
        await recordOutcome(fixture.router, fixture.modelIds.good, 'code', true, 1);
      }
      fixture.setSetting('models.exploration.rate', 1);
      fixture.setSetting('models.exploration.budgetUsdPerDay', 0.0005);
      const first = fixture.router.route({ taskType: 'code', agentRole: 'programmer' });
      expect(first).toMatchObject({ modelId: fixture.modelIds.cheap, explored: true });
      fixture.router.reportOutcome({
        decisionId: first.decisionId,
        success: false,
        qualityScore: 0.1,
        source: 'self',
        costUsd: 0.00045,
        latencyMs: 100,
        inputTokens: 100,
        outputTokens: 20,
      });

      fixture.setSetting('models.exploration.rate', 0);
      const baseline = fixture.router.route({ taskType: 'code', agentRole: 'programmer' });
      fixture.setSetting('models.exploration.rate', 1);
      const afterRemainingBudget = fixture.router.route({
        taskType: 'code',
        agentRole: 'programmer',
      });
      expect(afterRemainingBudget.modelId).toBe(baseline.modelId);
      expect(afterRemainingBudget.explored).toBe(false);
    } finally {
      fixture.close();
    }
  });

  it('falls back to baseline routing instead of exploring an unknown-cost model', async () => {
    const fixture = await createFixture();
    try {
      fixture.registry.updateModel(fixture.modelIds.cheap, {
        pricing: { inputPerMTokUsd: null, outputPerMTokUsd: null },
      });
      for (let index = 0; index < 3; index += 1) {
        await recordOutcome(fixture.router, fixture.modelIds.good, 'code', true, 1);
      }
      fixture.setSetting('models.exploration.rate', 0);
      const baseline = fixture.router.route({ taskType: 'code', agentRole: 'programmer' });
      fixture.setSetting('models.exploration.rate', 1);

      const decision = fixture.router.route({ taskType: 'code', agentRole: 'programmer' });
      expect(decision.modelId).toBe(baseline.modelId);
      expect(decision.explored).toBe(false);
      expect(
        decision.candidates.find((candidate) => candidate.modelId === fixture.modelIds.cheap)
          ?.estimatedCostUsd,
      ).toBeNull();
    } finally {
      fixture.close();
    }
  });

  it('allows an explicitly free model to be explored with no remaining budget', async () => {
    const fixture = await createFixture();
    try {
      fixture.registry.updateModel(fixture.modelIds.cheap, {
        pricing: { inputPerMTokUsd: 0, outputPerMTokUsd: 0 },
      });
      for (let index = 0; index < 3; index += 1) {
        await recordOutcome(fixture.router, fixture.modelIds.good, 'code', true, 1);
      }
      fixture.setSetting('models.exploration.rate', 1);
      fixture.setSetting('models.exploration.budgetUsdPerDay', 0);

      const decision = fixture.router.route({ taskType: 'code', agentRole: 'programmer' });
      expect(decision).toMatchObject({ modelId: fixture.modelIds.cheap, explored: true });
      expect(
        decision.candidates.find((candidate) => candidate.modelId === fixture.modelIds.cheap),
      )?.toMatchObject({ estimatedCostUsd: 0 });
    } finally {
      fixture.close();
    }
  });

  it('marks pre-confidence routed outcomes unverified instead of exposing their stored zero', async () => {
    const fixture = await createFixture();
    const projectId = uuidv7();
    try {
      const decision = fixture.router.route({
        projectId,
        taskType: 'code',
        agentRole: 'programmer',
        manualModelId: fixture.modelIds.good,
      });
      fixture.router.reportOutcome({
        decisionId: decision.decisionId,
        success: true,
        qualityScore: null,
        source: 'self',
        costUsd: 0,
        latencyMs: 50,
        inputTokens: 10,
        outputTokens: 2,
      });
      fixture.database
        .prepare('UPDATE route_outcomes SET cost_status = NULL WHERE decision_id = ?')
        .run(decision.decisionId);

      expect(fixture.router.modelUsage(projectId, 10)).toContainEqual(
        expect.objectContaining({
          usageId: decision.decisionId,
          decisionId: decision.decisionId,
          costUsd: null,
          costStatus: 'unverified',
        }),
      );
    } finally {
      fixture.close();
    }
  });
});

async function createFixture() {
  const profileDir = mkdtempSync(path.join(tmpdir(), 'gc-model-router-'));
  const database = Database.open(':memory:');
  migrate(database, profileMigrations);
  const credentials = new CredentialStore(database, profileDir);
  const providers = new ModelProviderRegistry();
  const models: {
    providerModelId: string;
    displayName: string;
    capabilities: Partial<ModelCapabilities>;
    pricing: Partial<ModelPricing>;
  }[] = [
    {
      providerModelId: 'cheap',
      displayName: 'Cheap model',
      capabilities: { chat: true, tools: false },
      pricing: { inputPerMTokUsd: 0.1, outputPerMTokUsd: 0.2 },
    },
    {
      providerModelId: 'good',
      displayName: 'Good model',
      capabilities: { chat: true, tools: true },
      pricing: { inputPerMTokUsd: 1, outputPerMTokUsd: 1 },
    },
  ];
  const provider: ModelProvider = {
    async listModels() {
      return models;
    },
    async complete() {
      throw new Error('Not used');
    },
    async embed() {
      throw new Error('Not used');
    },
  };
  providers.register('openai-compatible', provider);
  const registry = new ModelRegistry(database, credentials, providers);
  const account = registry.addAccount({
    providerKind: 'openai-compatible',
    displayName: 'Fake provider',
    baseUrl: 'http://localhost:5000/v1',
    isLocal: true,
  });
  const discovered = await registry.discover(account.accountId);
  const modelIds = {
    cheap: discovered.models.find((model) => model.providerModelId === 'cheap')!.modelId,
    good: discovered.models.find((model) => model.providerModelId === 'good')!.modelId,
  };
  registry.updateModel(modelIds.cheap, { workTypes: ['code'], roles: ['programmer'] });
  registry.updateModel(modelIds.good, { workTypes: ['code'], roles: ['programmer'] });
  const settingValues = new Map(Object.entries(defaultSettings));
  const settings: Pick<SettingsService, 'resolve'> = {
    resolve(key: string): EffectiveSetting {
      const value = settingValues.get(key);
      return {
        key,
        value,
        source: 'default',
        layers: { default: value },
      } as EffectiveSetting;
    },
  };
  const router = new ModelRouter({
    database,
    registry,
    settings,
    random: () => 0,
  });
  return {
    database,
    profileDir,
    router,
    registry,
    modelIds,
    setSetting(key: string, value: unknown) {
      settingValues.set(key, value);
    },
    close() {
      database.close();
      rmSync(profileDir, { recursive: true, force: true });
    },
  };
}

async function recordOutcome(
  router: ModelRouter,
  modelId: string,
  taskType: string,
  success: boolean,
  qualityScore: number,
): Promise<void> {
  const decision = router.route({ taskType, agentRole: 'programmer', manualModelId: modelId });
  const outcome: RouteOutcome = {
    decisionId: decision.decisionId,
    success,
    qualityScore,
    source: 'validation',
    costUsd: success ? 0.02 : 0.01,
    latencyMs: success ? 500 : 1500,
    inputTokens: 2000,
    outputTokens: 1000,
  };
  router.reportOutcome(outcome);
}

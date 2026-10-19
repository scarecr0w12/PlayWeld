import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { Database } from '../db/database';
import { migrate } from '../db/migrator';
import { profileMigrations } from '../profile/migrations';
import { CredentialStore } from '../profile/credential-store';
import { ModelRegistry } from './model-registry';
import { ModelRouter } from './router';
import { ModelProviderRegistry } from './providers';

async function fixture() {
  const profile = mkdtempSync(path.join(tmpdir(), 'gc-endpoint-metadata-'));
  const database = Database.open(':memory:');
  migrate(database, profileMigrations);
  const providers = new ModelProviderRegistry();
  providers.register('openai', {
    async listModels(account) {
      return [
        {
          providerModelId: 'gpt-6-luna',
          ...(account.baseUrl === 'https://api.openai.com/v1'
            ? {
                displayName: 'Official model',
                catalogModelId: 'official-catalog-id',
                capabilities: {
                  chat: true,
                  tools: true,
                  contextWindow: 10000,
                  maxOutputTokens: 1000,
                },
                pricing: { inputPerMTokUsd: 1, outputPerMTokUsd: 2 },
                fieldMetadata: {
                  'pricing.outputPerMTokUsd': {
                    source: 'provider-catalog' as const,
                    updatedAt: '2026-10-18T00:00:00.000Z',
                    sourceUrl: 'https://models.dev',
                    confidence: 'high' as const,
                  },
                },
                tags: ['official'],
                workTypes: ['code'],
                roles: ['programmer'],
              }
            : { capabilities: { chat: true } }),
        },
      ];
    },
    async complete() {
      throw new Error('Not used');
    },
    async embed() {
      throw new Error('Not used');
    },
  });
  const registry = new ModelRegistry(database, new CredentialStore(database, profile), providers);
  const account = registry.addAccount({
    providerKind: 'openai',
    displayName: 'Fixture',
    baseUrl: 'https://api.openai.com/v1',
  });
  const discovered = await registry.discover(account.accountId, {
    providerModelIds: ['gpt-6-luna'],
  });
  const model = discovered.models[0]!;
  const router = new ModelRouter({
    database,
    registry,
    settings: {
      resolve: (key) =>
        ({
          value:
            key === 'models.budget.maxCostPerTaskUsd'
              ? 5
              : key === 'models.autoRouting.quality'
                ? 'quality-first'
                : 0,
        }) as never,
    },
  });
  return {
    registry,
    account,
    model,
    router,
    close() {
      database.close();
      rmSync(profile, { recursive: true, force: true });
    },
  };
}

describe('account endpoint metadata identity', () => {
  it('immediately invalidates origin-bound facts while retaining manual overrides, selection, pools and history', async () => {
    const f = await fixture();
    try {
      expect(f.model.metadataFields['pricing.outputPerMTokUsd']?.source).toBe('provider-catalog');
      f.registry.updateModel(f.model.modelId, {
        displayName: 'My model',
        capabilities: { chat: true, tools: false },
        pricing: { inputPerMTokUsd: 7 },
        tags: ['mine'],
      });
      const pool = f.registry.createPool({
        name: 'Retained',
        scope: 'platform',
        target: null,
        modelIds: [f.model.modelId],
      });
      const decision = f.router.route({
        taskType: 'code',
        agentRole: 'programmer',
        manualModelId: f.model.modelId,
        constraints: { maxCostUsd: 1 },
      });
      f.registry.updateAccount(f.account.accountId, { baseUrl: 'https://custom.invalid/v1' });
      const updated = f.registry.getModel(f.model.modelId)!;
      expect(updated).toMatchObject({
        modelId: f.model.modelId,
        enabled: true,
        availability: 'unknown',
        lastSeenAt: null,
        displayName: 'My model',
        catalogModelId: null,
        capabilities: {
          chat: true,
          tools: false,
          contextWindow: null,
          maxOutputTokens: null,
          vision: null,
        },
        pricing: { inputPerMTokUsd: 7, outputPerMTokUsd: null },
        tags: ['mine'],
        workTypes: [],
        roles: [],
      });
      expect(
        Object.values(updated.metadataFields).every((field) => field.source === 'manual'),
      ).toBe(true);
      expect(f.registry.listPools()).toEqual([pool]);
      expect(f.router.decisions()[0]?.decision.decisionId).toBe(decision.decisionId);
      expect(() =>
        f.router.route({
          taskType: 'code',
          manualModelId: f.model.modelId,
          constraints: { maxCostUsd: 1 },
        }),
      ).toThrowError(
        expect.objectContaining({
          data: expect.objectContaining({ stage: 'constraints' }),
        }),
      );
    } finally {
      f.close();
    }
  });

  it('cannot resurrect official provider or catalog values after custom-endpoint rediscovery', async () => {
    const f = await fixture();
    try {
      f.registry.updateAccount(f.account.accountId, { baseUrl: 'https://custom.invalid/v1' });
      expect(f.registry.getModel(f.model.modelId)).toMatchObject({
        displayName: 'gpt-6-luna',
        capabilities: { chat: null },
        pricing: { inputPerMTokUsd: null, outputPerMTokUsd: null },
      });
      await f.registry.discover(f.account.accountId);
      expect(f.registry.getModel(f.model.modelId)).toMatchObject({
        enabled: true,
        availability: 'available',
        catalogModelId: null,
        capabilities: {
          chat: true,
          tools: null,
          vision: null,
          contextWindow: null,
          maxOutputTokens: null,
        },
        pricing: { inputPerMTokUsd: null, outputPerMTokUsd: null },
      });
      expect(() =>
        f.router.route({
          taskType: 'code',
          manualModelId: f.model.modelId,
          constraints: { maxCostUsd: 1 },
        }),
      ).toThrow();
    } finally {
      f.close();
    }
  });

  it('preserves metadata on identical endpoint and unrelated account changes', async () => {
    const f = await fixture();
    try {
      f.registry.updateAccount(f.account.accountId, {
        baseUrl: f.account.baseUrl,
        displayName: 'Renamed account',
        enabled: false,
      });
      expect(f.registry.getModel(f.model.modelId)).toEqual(f.model);
    } finally {
      f.close();
    }
  });

  it('retains explicit manual catalog, limits and prices across endpoint changes', async () => {
    const f = await fixture();
    try {
      const overridden = f.registry.updateModel(f.model.modelId, {
        catalogModelId: 'my-model',
        capabilities: { chat: true, contextWindow: 5000, maxOutputTokens: 1000 },
        pricing: { inputPerMTokUsd: 1, outputPerMTokUsd: 2 },
        workTypes: ['manual-work'],
        roles: ['manual-role'],
      });
      f.registry.updateAccount(f.account.accountId, { baseUrl: 'https://api.openai.com/other' });
      expect(f.registry.getModel(f.model.modelId)).toMatchObject({
        catalogModelId: overridden.catalogModelId,
        pricing: overridden.pricing,
        capabilities: { chat: true, contextWindow: 5000, maxOutputTokens: 1000 },
        workTypes: overridden.workTypes,
        roles: overridden.roles,
      });
    } finally {
      f.close();
    }
  });
});

import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import type { ModelCapabilities, ModelPricing } from '@gamecrafter/contracts';
import { Database } from '../db/database';
import { migrate } from '../db/migrator';
import { profileMigrations } from '../profile/migrations';
import { CredentialStore } from '../profile/credential-store';
import { ModelRegistry } from './model-registry';
import { ModelProviderRegistry, type ModelProvider } from './providers';

describe('ModelRegistry', () => {
  it('offers catalogued OpenAI embedding models when model listing omits them', async () => {
    const profileDir = mkdtempSync(path.join(tmpdir(), 'gc-openai-embedding-discovery-'));
    const database = Database.open(':memory:');
    try {
      migrate(database, profileMigrations);
      const providers = new ModelProviderRegistry();
      providers.register('openai', {
        async listModels() {
          return [{ providerModelId: 'gpt-fixture', capabilities: { chat: true } }];
        },
        async complete() {
          throw new Error('Not used');
        },
        async embed() {
          throw new Error('Not used');
        },
      });
      const registry = new ModelRegistry(
        database,
        new CredentialStore(database, profileDir),
        providers,
      );
      const account = registry.addAccount({
        providerKind: 'openai',
        displayName: 'OpenAI',
        baseUrl: 'https://api.openai.com/v1',
        apiKey: 'fixture-api-key',
      });

      const preview = await registry.discover(account.accountId, { preview: true });

      expect(preview.models.map((model) => model.providerModelId)).toEqual([
        'gpt-fixture',
        'text-embedding-3-small',
        'text-embedding-3-large',
      ]);
      expect(preview.models.filter((model) => model.capabilities.embeddings)).toMatchObject([
        {
          providerModelId: 'text-embedding-3-small',
          metadataFields: {
            'capabilities.embeddings': { source: 'provider-catalog' },
          },
        },
        {
          providerModelId: 'text-embedding-3-large',
          metadataFields: {
            'capabilities.embeddings': { source: 'provider-catalog' },
          },
        },
      ]);
      expect(registry.listModels()).toEqual([]);

      const selected = await registry.discover(account.accountId, {
        providerModelIds: ['text-embedding-3-small'],
      });
      expect(selected).toMatchObject({ added: 1, updated: 0 });
      expect(registry.listModels()).toMatchObject([
        { accountId: account.accountId, providerModelId: 'text-embedding-3-small' },
      ]);
      expect(
        await registry.discover(account.accountId, {
          providerModelIds: ['text-embedding-3-small'],
        }),
      ).toMatchObject({ added: 0, updated: 1 });

      const customAccount = registry.addAccount({
        providerKind: 'openai',
        displayName: 'Custom endpoint',
        baseUrl: 'https://custom.example.com/v1',
      });
      expect(
        (await registry.discover(customAccount.accountId, { preview: true })).models.map(
          (model) => model.providerModelId,
        ),
      ).toEqual(['gpt-fixture']);

      const listModels = vi.spyOn(providers.get('openai')!, 'listModels');
      listModels.mockResolvedValue([
        { providerModelId: 'text-embedding-3-small', capabilities: { embeddings: false } },
      ]);
      const listed = await registry.discover(account.accountId, { preview: true });
      expect(listed.models.map((model) => model.providerModelId)).toEqual([
        'text-embedding-3-small',
        'text-embedding-3-large',
      ]);
      expect(listed.models[0]?.capabilities.embeddings).toBe(false);

      listModels.mockRejectedValue(new Error('Provider authentication failed'));
      await expect(registry.discover(account.accountId, { preview: true })).rejects.toThrow(
        'Provider authentication failed',
      );
    } finally {
      database.close();
      rmSync(profileDir, { recursive: true, force: true });
    }
  });

  it('previews without writes and imports only selected models for the requested account', async () => {
    const profileDir = mkdtempSync(path.join(tmpdir(), 'gc-model-selection-'));
    const database = Database.open(':memory:');
    try {
      migrate(database, profileMigrations);
      const providers = new ModelProviderRegistry();
      providers.register('openai-compatible', {
        async listModels() {
          return ['one', 'two', 'three'].map((providerModelId) => ({
            providerModelId,
            capabilities: { chat: true },
          }));
        },
        async complete() {
          throw new Error('Not used');
        },
        async embed() {
          throw new Error('Not used');
        },
      });
      const registry = new ModelRegistry(
        database,
        new CredentialStore(database, profileDir),
        providers,
      );
      const input = {
        providerKind: 'openai-compatible' as const,
        displayName: 'Selection',
        baseUrl: 'http://localhost:1234/v1',
        providerOptions: {},
        isLocal: true,
      };
      const first = registry.addAccount(input);
      const second = registry.addAccount({ ...input, displayName: 'Second' });
      const preview = await registry.discover(first.accountId, { preview: true });
      expect(preview).toMatchObject({ added: 0, updated: 0 });
      expect(preview.models.map((model) => model.providerModelId)).toEqual(['one', 'two', 'three']);
      expect(registry.listModels()).toEqual([]);
      const selected = await registry.discover(first.accountId, { providerModelIds: ['two'] });
      expect(selected).toMatchObject({ added: 1, updated: 0 });
      const model = selected.models[0]!;
      const saved = registry.updateModel(model.modelId, {
        enabled: false,
        pricing: { inputPerMTokUsd: 2, outputPerMTokUsd: 4 },
      });
      await registry.discover(first.accountId, { preview: true });
      expect(registry.getModel(model.modelId)).toEqual(saved);
      expect(registry.listModels({ accountId: second.accountId })).toEqual([]);
      expect(await registry.discover(first.accountId, { providerModelIds: [] })).toEqual({
        added: 0,
        updated: 0,
        models: [],
      });
      await expect(
        registry.discover(first.accountId, { providerModelIds: ['one', 'missing'] }),
      ).rejects.toThrow('no longer available');
      expect(registry.listModels().map((model) => model.providerModelId)).toEqual(['two']);
      expect(await registry.discover(first.accountId)).toMatchObject({ added: 2, updated: 1 });
      expect(registry.getModel(model.modelId)).toMatchObject({
        enabled: false,
        pricing: saved.pricing,
      });
    } finally {
      database.close();
      rmSync(profileDir, { recursive: true, force: true });
    }
  });

  it('keeps credentials private, discovers models, preserves manual metadata, and cascades account removal', async () => {
    const profileDir = mkdtempSync(path.join(tmpdir(), 'gc-model-registry-'));
    const database = Database.open(':memory:');
    try {
      migrate(database, profileMigrations);
      const credentials = new CredentialStore(database, profileDir);
      const providers = new ModelProviderRegistry();
      let providerName = 'Provider name';
      let providerCapabilities: Partial<ModelCapabilities> = { chat: true, tools: false };
      let providerPricing: Partial<ModelPricing> = {
        inputPerMTokUsd: 0.2,
        outputPerMTokUsd: 0.4,
      };
      let providerWorkTypes = ['code'];
      let providerRoles = ['programmer'];
      let providerCatalogModelId = 'catalog-model-from-provider';
      const provider: ModelProvider = {
        async listModels() {
          return [
            {
              providerModelId: 'test-model',
              catalogModelId: providerCatalogModelId,
              displayName: providerName,
              capabilities: providerCapabilities,
              pricing: providerPricing,
              workTypes: providerWorkTypes,
              roles: providerRoles,
              metadataSource: 'provider-api',
              fieldMetadata: {
                workTypes: {
                  source: 'provider-catalog',
                  updatedAt: now.toISOString(),
                  sourceUrl: 'https://provider.example/models/test-model',
                  confidence: 'high',
                },
                roles: {
                  source: 'provider-catalog',
                  updatedAt: now.toISOString(),
                  sourceUrl: 'https://provider.example/models/test-model',
                  confidence: 'high',
                },
              },
            },
          ];
        },
        async complete() {
          throw new Error('Not used');
        },
        async embed() {
          throw new Error('Not used');
        },
      };
      providers.register('openai-compatible', provider);
      let now = new Date('2026-09-28T00:00:00.000Z');
      const registry = new ModelRegistry(database, credentials, providers, () => now);
      const account = registry.addAccount({
        providerKind: 'openai-compatible',
        displayName: 'Test account',
        baseUrl: 'http://localhost:1234/v1',
        providerOptions: { apiVersion: '2026-01-01' },
        apiKey: 'account-secret',
        headers: { 'X-Provider-Tag': 'local', Authorization: 'Bearer header-secret' },
        isLocal: true,
      });
      expect(account.hasCredential).toBe(true);
      expect(account.providerOptions).toEqual({ apiVersion: '2026-01-01' });
      expect(account.headers.Authorization).toBe('[REDACTED]');
      expect('apiKey' in account).toBe(false);
      expect(registry.getRuntimeAccount(account.accountId)).toMatchObject({
        apiKey: 'account-secret',
        headers: { Authorization: 'Bearer header-secret', 'X-Provider-Tag': 'local' },
      });

      const discovered = await registry.discover(account.accountId);
      expect(discovered).toMatchObject({ added: 1, updated: 0 });
      const model = discovered.models[0]!;
      expect(model).toMatchObject({
        modelId: `${account.accountId}/test-model`,
        catalogModelId: 'catalog-model-from-provider',
        capabilities: { chat: true, tools: false, vision: null, structuredOutput: null },
        pricing: { inputPerMTokUsd: 0.2, outputPerMTokUsd: 0.4 },
        metadataSource: 'provider',
        workTypes: ['code'],
        roles: ['programmer'],
        metadataFields: {
          'capabilities.chat': { source: 'provider-api', confidence: 'medium' },
          'pricing.inputPerMTokUsd': { source: 'provider-api', confidence: 'medium' },
          workTypes: { source: 'provider-catalog', confidence: 'high' },
          roles: { source: 'provider-catalog', confidence: 'high' },
        },
      });
      await registry.updateModel(model.modelId, {
        capabilities: { tools: true },
        pricing: { inputPerMTokUsd: 0.1 },
        catalogModelId: 'manual-catalog-model',
        workTypes: ['manual-work-type'],
      });
      providerName = 'Changed provider name';
      providerCapabilities = { chat: false, tools: false };
      providerPricing = { inputPerMTokUsd: 0.8, outputPerMTokUsd: 1.2 };
      providerWorkTypes = ['review'];
      providerRoles = ['designer'];
      providerCatalogModelId = 'new-provider-catalog-model';
      now = new Date('2026-09-28T00:01:00.000Z');
      const refreshed = await registry.discover(account.accountId);
      expect(refreshed).toMatchObject({ added: 0, updated: 1 });
      expect(refreshed.models[0]).toMatchObject({
        displayName: 'Changed provider name',
        catalogModelId: 'manual-catalog-model',
        capabilities: { chat: false, tools: true, vision: null, structuredOutput: null },
        pricing: { inputPerMTokUsd: 0.1, outputPerMTokUsd: 1.2 },
        workTypes: ['manual-work-type'],
        roles: ['designer'],
        metadataSource: 'manual',
        metadataFields: {
          catalogModelId: { source: 'manual', confidence: 'high' },
        },
      });

      const cleared = registry.updateModel(model.modelId, {
        capabilities: { tools: null },
        pricing: { inputPerMTokUsd: null },
        catalogModelId: null,
      });
      expect(cleared.metadataFields['capabilities.tools']).toBeUndefined();
      expect(cleared.metadataFields['pricing.inputPerMTokUsd']).toBeUndefined();
      expect(cleared.metadataFields.catalogModelId).toBeUndefined();
      providerCapabilities = { chat: true, tools: true };
      providerPricing = { inputPerMTokUsd: 0.9, outputPerMTokUsd: 1.3 };
      providerCatalogModelId = 'refreshed-catalog-model';
      now = new Date('2026-09-28T00:02:00.000Z');
      const reloaded = await registry.discover(account.accountId);
      expect(reloaded.models[0]).toMatchObject({
        catalogModelId: 'refreshed-catalog-model',
        capabilities: { tools: true },
        pricing: { inputPerMTokUsd: 0.9 },
        metadataFields: {
          'capabilities.tools': { source: 'provider-api' },
          'pricing.inputPerMTokUsd': { source: 'provider-api' },
          catalogModelId: { source: 'provider-api' },
        },
      });

      const pool = registry.createPool({
        name: 'Test pool',
        scope: 'platform',
        target: null,
        modelIds: [model.modelId],
      });
      registry.removeAccount(account.accountId);
      expect(registry.listModels()).toEqual([]);
      expect(registry.listPools()).toMatchObject([{ poolId: pool.poolId, modelIds: [] }]);
      expect(registry.listAccounts()).toEqual([]);
      expect(registry.getRuntimeAccount(account.accountId)).toBeUndefined();
    } finally {
      database.close();
      rmSync(profileDir, { recursive: true, force: true });
    }
  });

  it('treats legacy provider-default false flags as unknown without changing manual false flags', () => {
    const profileDir = mkdtempSync(path.join(tmpdir(), 'gc-model-legacy-'));
    const database = Database.open(':memory:');
    try {
      migrate(database, profileMigrations);
      const capabilities = JSON.stringify({
        chat: true,
        tools: false,
        vision: false,
        structuredOutput: false,
        streaming: false,
        embeddings: false,
        contextWindow: null,
        maxInputTokens: null,
        maxOutputTokens: null,
      });
      const insert = database.prepare(
        `INSERT INTO models (
          model_id, account_id, provider_model_id, display_name, capabilities, pricing,
          metadata_source, metadata_updated_at, enabled, tags, work_types, roles
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      );
      insert.run(
        'legacy-provider/model',
        '019535d4-2c00-7000-8000-000000000301',
        'model',
        'Provider model',
        capabilities,
        '{"inputPerMTokUsd":null,"outputPerMTokUsd":null}',
        'provider',
        '2026-09-28T00:00:00.000Z',
        1,
        '[]',
        '[]',
        '[]',
      );
      insert.run(
        'legacy-manual/model',
        '019535d4-2c00-7000-8000-000000000301',
        'model',
        'Manual model',
        capabilities,
        '{"inputPerMTokUsd":null,"outputPerMTokUsd":null}',
        'manual',
        '2026-09-28T00:00:00.000Z',
        1,
        '[]',
        '[]',
        '[]',
      );
      const registry = new ModelRegistry(
        database,
        new CredentialStore(database, profileDir),
        new ModelProviderRegistry(),
      );

      expect(registry.getModel('legacy-provider/model')).toMatchObject({
        capabilities: { chat: null, tools: null, vision: null },
        metadataFields: {
          'capabilities.tools': { source: 'legacy', confidence: 'low' },
        },
      });
      expect(registry.getModel('legacy-manual/model')?.capabilities).toMatchObject({
        chat: true,
        tools: false,
        vision: false,
      });
    } finally {
      database.close();
      rmSync(profileDir, { recursive: true, force: true });
    }
  });
});

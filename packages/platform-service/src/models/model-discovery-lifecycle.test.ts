import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { Database } from '../db/database';
import { migrate } from '../db/migrator';
import { profileMigrations } from '../profile/migrations';
import { CredentialStore } from '../profile/credential-store';
import { ModelRegistry } from './model-registry';
import { ModelProviderRegistry, type DiscoveredModel } from './providers';

function fixture(kind: 'openai' | 'openai-compatible' = 'openai-compatible') {
  const profile = mkdtempSync(path.join(tmpdir(), 'gc-discovery-selection-'));
  const database = Database.open(':memory:');
  migrate(database, profileMigrations);
  let available: DiscoveredModel[] = ['one', 'two'].map((providerModelId) => ({
    providerModelId,
    capabilities: { chat: true },
    pricing: { inputPerMTokUsd: 1, outputPerMTokUsd: 2 },
  }));
  let fail = false;
  const providers = new ModelProviderRegistry();
  providers.register(kind, {
    async listModels() {
      if (fail) throw new Error('Offline');
      return available;
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
    providerKind: kind,
    displayName: 'Test provider',
    baseUrl: kind === 'openai' ? 'https://api.openai.com/v1' : 'https://fixture.invalid/v1',
  });
  return {
    registry,
    account,
    providers,
    setAvailable(ids: string[]) {
      available = ids.map((providerModelId) => ({ providerModelId, capabilities: { chat: true } }));
    },
    setMetadata(price: number, updatedAt: string) {
      available = [
        {
          providerModelId: 'one',
          capabilities: { chat: true },
          pricing: { inputPerMTokUsd: price },
          fieldMetadata: {
            'pricing.inputPerMTokUsd': {
              source: 'provider-catalog',
              updatedAt,
              sourceUrl: 'https://catalog.invalid',
              confidence: 'medium',
            },
          },
        },
      ];
    },
    rejectPricing() {
      available = [
        {
          providerModelId: 'one',
          capabilities: { chat: true },
          unsupportedPricingFields: ['inputPerMTokUsd', 'outputPerMTokUsd'],
          metadataWarnings: ['Tiered pricing is unsupported'],
        },
      ];
    },
    fail() {
      fail = true;
    },
    close() {
      database.close();
      rmSync(profile, { recursive: true, force: true });
    },
  };
}

describe('explicit discovery lifecycle', () => {
  it('does not borrow first-party catalog pricing for custom OpenAI-compatible origins', async () => {
    const f = fixture('openai');
    try {
      f.registry.updateAccount(f.account.accountId, { baseUrl: 'https://custom.invalid/v1' });
      f.setAvailable(['gpt-6-luna']);
      const preview = await f.registry.discover(f.account.accountId, { preview: true });
      expect(preview.models[0]?.pricing).toEqual({ inputPerMTokUsd: null, outputPerMTokUsd: null });
      expect(preview.models[0]?.metadataFields['pricing.inputPerMTokUsd']).toBeUndefined();
    } finally {
      f.close();
    }
  });
  it('retains newer cached values and provenance when an older fallback arrives', async () => {
    const f = fixture();
    try {
      f.setMetadata(2, '2026-10-18T00:00:00.000Z');
      const first = await f.registry.discover(f.account.accountId, { providerModelIds: ['one'] });
      const id = first.models[0]!.modelId;
      f.setMetadata(99, '2026-10-01T00:00:00.000Z');
      await f.registry.discover(f.account.accountId, { providerModelIds: [] });
      expect(f.registry.getModel(id)?.pricing.inputPerMTokUsd).toBe(2);
      expect(f.registry.getModel(id)?.metadataFields['pricing.inputPerMTokUsd']?.updatedAt).toBe(
        '2026-10-18T00:00:00.000Z',
      );
    } finally {
      f.close();
    }
  });
  it('keeps preview read-only and never enables new models without explicit selection', async () => {
    const f = fixture();
    try {
      const preview = await f.registry.discover(f.account.accountId, { preview: true });
      expect(preview.models.map((m) => m.enabled)).toEqual([false, false]);
      expect(f.registry.listModels()).toEqual([]);
      await f.registry.discover(f.account.accountId);
      expect(f.registry.listModels({ enabledOnly: true })).toEqual([]);
      const selected = await f.registry.discover(f.account.accountId, {
        providerModelIds: ['one'],
      });
      expect(selected.models.find((m) => m.providerModelId === 'one')?.enabled).toBe(true);
      expect(f.registry.listModels({ enabledOnly: true }).map((m) => m.providerModelId)).toEqual([
        'one',
      ]);
      const one = f.registry.listModels().find((m) => m.providerModelId === 'one')!;
      f.registry.updateModel(one.modelId, { enabled: false, pricing: { inputPerMTokUsd: 7 } });
      await f.registry.discover(f.account.accountId, { providerModelIds: [] });
      expect(f.registry.getModel(one.modelId)).toMatchObject({
        enabled: false,
        pricing: { inputPerMTokUsd: 7 },
      });
    } finally {
      f.close();
    }
  });

  it('reconciles absent models without deleting selection/history and preserves state on failure', async () => {
    const f = fixture();
    try {
      await f.registry.discover(f.account.accountId, { providerModelIds: ['one', 'two'] });
      const one = f.registry.listModels().find((m) => m.providerModelId === 'one')!;
      expect(one.availability).toBe('available');
      f.setAvailable(['two']);
      await f.registry.discover(f.account.accountId, { preview: true });
      expect(f.registry.getModel(one.modelId)?.availability).toBe('available');
      await f.registry.discover(f.account.accountId, { providerModelIds: [] });
      expect(f.registry.getModel(one.modelId)).toMatchObject({
        enabled: true,
        availability: 'unavailable',
      });
      expect(f.registry.listModels({ enabledOnly: true }).map((m) => m.providerModelId)).toEqual([
        'two',
      ]);
      f.setAvailable(['one']);
      await f.registry.discover(f.account.accountId, { providerModelIds: [] });
      expect(f.registry.getModel(one.modelId)).toMatchObject({
        enabled: true,
        availability: 'available',
      });
      const before = f.registry.listModels();
      f.fail();
      await expect(f.registry.discover(f.account.accountId)).rejects.toThrow('Offline');
      expect(f.registry.listModels()).toEqual(before);
    } finally {
      f.close();
    }
  });

  it('refreshes an existing reappeared model while explicitly selecting another model', async () => {
    const f = fixture();
    try {
      await f.registry.discover(f.account.accountId, { providerModelIds: ['one'] });
      const one = f.registry.listModels()[0]!;
      f.setAvailable([]);
      await f.registry.discover(f.account.accountId, { providerModelIds: [] });
      expect(f.registry.getModel(one.modelId)?.availability).toBe('unavailable');
      f.setAvailable(['one', 'two']);
      await f.registry.discover(f.account.accountId, { providerModelIds: ['two'] });
      expect(f.registry.getModel(one.modelId)).toMatchObject({
        enabled: true,
        availability: 'available',
      });
    } finally {
      f.close();
    }
  });

  it('clears obsolete automatic flat prices after explicit unsupported pricing while preserving manual rates', async () => {
    const f = fixture();
    try {
      const first = await f.registry.discover(f.account.accountId, { providerModelIds: ['one'] });
      const id = first.models[0]!.modelId;
      f.registry.updateModel(id, { pricing: { outputPerMTokUsd: 7 } });
      f.rejectPricing();
      const refreshed = await f.registry.discover(f.account.accountId, { providerModelIds: [] });
      expect(f.registry.getModel(id)?.pricing).toEqual({
        inputPerMTokUsd: null,
        outputPerMTokUsd: 7,
      });
      expect(f.registry.getModel(id)?.metadataFields['pricing.inputPerMTokUsd']?.source).toBe(
        'provider-api',
      );
      expect(refreshed.warnings).toContain('Tiered pricing is unsupported');
    } finally {
      f.close();
    }
  });

  it('rejects discovery results from an endpoint changed while its request was in flight', async () => {
    const f = fixture('openai');
    try {
      let finish!: (models: DiscoveredModel[]) => void;
      f.providers.get('openai')!.listModels = () =>
        new Promise((resolve) => {
          finish = resolve;
        });
      const pending = f.registry.discover(f.account.accountId, { providerModelIds: ['one'] });
      f.registry.updateAccount(f.account.accountId, { baseUrl: 'https://custom.invalid/v1' });
      finish([
        {
          providerModelId: 'one',
          capabilities: { chat: true },
          pricing: { inputPerMTokUsd: 1, outputPerMTokUsd: 2 },
        },
      ]);
      await expect(pending).rejects.toThrow('endpoint changed during discovery');
      expect(f.registry.listModels()).toEqual([]);
    } finally {
      f.close();
    }
  });

  it('does not advertise catalog-only models as actually available from an account', async () => {
    const f = fixture('openai');
    try {
      const preview = await f.registry.discover(f.account.accountId, { preview: true });
      expect(preview.models.map((m) => m.providerModelId)).toEqual(['one', 'two']);
    } finally {
      f.close();
    }
  });
});

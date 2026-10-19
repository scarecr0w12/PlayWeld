import { describe, expect, it, vi } from 'vitest';
import { catalogOriginMatches, createBuiltinModelProviders } from './index';
import type { ProviderRuntimeAccount } from './provider';

const account = {
  schemaVersion: 1,
  id: 'fixture',
  providerKind: 'openai',
  displayName: 'Fixture',
  baseUrl: 'https://api.openai.com/v1',
  apiKey: 'fixture-key',
  headers: { 'x-private': 'fixture-secret' },
  providerOptions: {},
} as ProviderRuntimeAccount;

describe('builtin catalog enrichment boundary', () => {
  it('enriches discovery while keeping account secrets out of public catalog requests', async () => {
    const providerFetch = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue(new Response(JSON.stringify({ data: [{ id: 'exact' }] })));
    const catalogFetch = vi.fn(
      async () =>
        new Response(
          JSON.stringify({
            openai: {
              id: 'openai',
              models: {
                exact: { id: 'exact', tool_call: true, cost: { input: 2 } },
              },
            },
          }),
        ),
    );
    try {
      const providers = createBuiltinModelProviders({ catalogOptions: { fetch: catalogFetch } });
      const [model] = await providers.get('openai')!.listModels(account);
      expect(model.capabilities?.tools).toBe(true);
      expect(model.pricing?.inputPerMTokUsd).toBe(2);
      expect(JSON.stringify(catalogFetch.mock.calls)).not.toContain('fixture-key');
      expect(JSON.stringify(catalogFetch.mock.calls)).not.toContain('fixture-secret');
    } finally {
      providerFetch.mockRestore();
    }
  });
  it('does not attach first-party catalog prices to a custom service host', async () => {
    const providerFetch = vi
      .spyOn(globalThis, 'fetch')
      .mockImplementation(async () => new Response(JSON.stringify({ data: [{ id: 'exact' }] })));
    const catalog = { enrich: vi.fn(async (_kind, models) => models) };
    try {
      const [model] = await createBuiltinModelProviders({ catalog })
        .get('openai')!
        .listModels({ ...account, baseUrl: 'https://custom.invalid/v1' });
      expect(model.pricing).toBeUndefined();
      expect(catalog.enrich).not.toHaveBeenCalled();
      expect(model.metadataWarnings?.join(' ')).toContain('custom');
    } finally {
      providerFetch.mockRestore();
    }
  });
  it('restricts Azure bundled metadata to canonical HTTPS resource endpoints', () => {
    expect(catalogOriginMatches('azure-openai', 'https://fixture.openai.azure.com/openai/v1')).toBe(
      true,
    );
    expect(catalogOriginMatches('azure-openai', 'https://custom.invalid/openai/v1')).toBe(false);
    expect(catalogOriginMatches('azure-openai', 'http://fixture.openai.azure.com/openai/v1')).toBe(
      false,
    );
  });
  it('preserves explicitly unsupported xAI tiered pricing through catalog enrichment', async () => {
    const providerFetch = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(
        JSON.stringify({
          models: [
            {
              id: 'tiered',
              context_length: 200000,
              long_context_threshold: 100000,
              prompt_text_token_price: 10000,
              completion_text_token_price: 20000,
            },
          ],
        }),
      ),
    );
    const catalogFetch = async () =>
      new Response(
        JSON.stringify({
          xai: { id: 'xai', models: { tiered: { id: 'tiered', cost: { input: 1, output: 2 } } } },
        }),
      );
    try {
      const [model] = await createBuiltinModelProviders({ catalogOptions: { fetch: catalogFetch } })
        .get('xai')!
        .listModels({ ...account, providerKind: 'xai', baseUrl: 'https://api.x.ai/v1' });
      expect(model.pricing?.inputPerMTokUsd).toBeUndefined();
      expect(model.pricing?.outputPerMTokUsd).toBeUndefined();
      expect(model.unsupportedPricingFields).toEqual(['inputPerMTokUsd', 'outputPerMTokUsd']);
      expect(model.metadataWarnings?.join(' ')).toContain('pricing');
    } finally {
      providerFetch.mockRestore();
    }
  });
  it('keeps explicitly non-USD provider rates unknown even when numeric token prices exist', async () => {
    const providerFetch = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(
        JSON.stringify({
          models: [
            {
              id: 'non-usd',
              currency: 'EUR',
              prompt_text_token_price: 10000,
              completion_text_token_price: 20000,
            },
          ],
        }),
      ),
    );
    try {
      const [model] = await createBuiltinModelProviders({ catalog: false })
        .get('xai')!
        .listModels({ ...account, providerKind: 'xai', baseUrl: 'https://api.x.ai/v1' });
      expect(model.pricing).toBeUndefined();
      expect(model.fieldMetadata?.['pricing.inputPerMTokUsd'].source).toBe('provider-api');
    } finally {
      providerFetch.mockRestore();
    }
  });
  it('allows injected or disabled metadata enrichment', async () => {
    const providerFetch = vi
      .spyOn(globalThis, 'fetch')
      .mockImplementation(async () => new Response(JSON.stringify({ data: [{ id: 'exact' }] })));
    try {
      const catalog = {
        enrich: async (_kind: unknown, models: { providerModelId: string }[]) =>
          models.map((model) => ({ ...model, displayName: 'Injected' })),
      };
      expect(
        (await createBuiltinModelProviders({ catalog }).get('openai')!.listModels(account))[0]
          .displayName,
      ).toBe('Injected');
      expect(
        (
          await createBuiltinModelProviders({ catalog: false }).get('openai')!.listModels(account)
        )[0].displayName,
      ).toBeUndefined();
    } finally {
      providerFetch.mockRestore();
    }
  });
});

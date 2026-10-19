import { describe, expect, it, vi } from 'vitest';
import { MaintainedModelCatalog, MAINTAINED_CATALOG_URL } from './maintained-catalog';

const entry = {
  id: 'exact',
  name: 'Catalog name',
  tool_call: true,
  structured_output: true,
  modalities: { input: ['text', 'image'], output: ['text'] },
  limit: { context: 100000, input: 90000, output: 10000 },
  cost: { input: 2, output: 8 },
};
const payload = (model: unknown = entry) => ({
  openai: { id: 'openai', models: { exact: model } },
  google: { id: 'google', models: { exact: entry } },
});
const response = (data: unknown) => new Response(JSON.stringify(data));

describe('maintained model catalog', () => {
  it('fills missing fields for exact provider and ID with retrieval provenance and provider precedence', async () => {
    const fetcher = vi.fn(async () => response(payload()));
    const catalog = new MaintainedModelCatalog({ fetch: fetcher, now: () => 1000, ttlMs: 100 });
    const [model] = await catalog.enrich('openai', [
      {
        providerModelId: 'exact',
        displayName: 'Provider',
        capabilities: { tools: false, maxOutputTokens: null },
        pricing: { inputPerMTokUsd: 3 },
      },
    ]);
    expect(model).toMatchObject({
      displayName: 'Provider',
      capabilities: {
        chat: true,
        tools: false,
        vision: true,
        contextWindow: 100000,
        maxInputTokens: 90000,
        maxOutputTokens: 10000,
      },
      pricing: { inputPerMTokUsd: 3, outputPerMTokUsd: 8 },
    });
    expect(model.fieldMetadata?.['pricing.outputPerMTokUsd']).toEqual({
      source: 'provider-catalog',
      sourceUrl: MAINTAINED_CATALOG_URL,
      confidence: 'medium',
      updatedAt: new Date(1000).toISOString(),
      expiresAt: new Date(1100).toISOString(),
      stale: false,
    });
    expect(model.fieldMetadata?.['capabilities.tools']).toBeUndefined();
    expect(fetcher.mock.calls[0]).toEqual([
      MAINTAINED_CATALOG_URL,
      expect.objectContaining({
        credentials: 'omit',
        redirect: 'error',
        headers: { accept: 'application/json' },
      }),
    ]);
  });
  it('does not guess ID aliases or borrow provider pricing', async () => {
    const catalog = new MaintainedModelCatalog({ fetch: async () => response(payload()) });
    expect(await catalog.enrich('openai', [{ providerModelId: 'exact-latest' }])).toEqual([
      { providerModelId: 'exact-latest' },
    ]);
    expect(await catalog.enrich('deepseek', [{ providerModelId: 'exact' }])).toEqual([
      { providerModelId: 'exact' },
    ]);
    expect(
      (await catalog.enrich('google-gemini', [{ providerModelId: 'exact' }]))[0].pricing
        ?.inputPerMTokUsd,
    ).toBe(2);
  });
  it.each([
    { input: 0, output: -1 },
    { input: '2', output: null },
    { input: 2, output: 8, currency: 'EUR' },
    { input: 2, output: 8, tiers: [{}] },
    { input: 2, output: 8, context_over_200k: { input: 5 } },
  ])('keeps ambiguous prices unknown: %j', async (cost) => {
    const catalog = new MaintainedModelCatalog({
      fetch: async () => response(payload({ ...entry, cost })),
    });
    expect(
      (await catalog.enrich('openai', [{ providerModelId: 'exact' }]))[0].pricing,
    ).toBeUndefined();
  });
  it('uses documented chat and embedding types without inferring unsupported generation types', async () => {
    for (const [type, expected] of [
      ['chat', true],
      ['embedding', false],
      ['transcription', undefined],
    ] as const) {
      const catalog = new MaintainedModelCatalog({
        fetch: async () => response(payload({ ...entry, type, modalities: undefined })),
      });
      expect(
        (await catalog.enrich('openai', [{ providerModelId: 'exact' }]))[0].capabilities?.chat,
      ).toBe(expected);
    }
  });
  it('preserves valid partial prices and rejects inconsistent catalog identities', async () => {
    const catalog = new MaintainedModelCatalog({
      fetch: async () => response(payload({ ...entry, cost: { input: 2 } })),
    });
    expect((await catalog.enrich('openai', [{ providerModelId: 'exact' }]))[0].pricing).toEqual({
      inputPerMTokUsd: 2,
    });
    const invalid = new MaintainedModelCatalog({
      fetch: async () => response(payload({ ...entry, id: 'different' })),
    });
    expect(
      (await invalid.enrich('openai', [{ providerModelId: 'exact' }]))[0].pricing,
    ).toBeUndefined();
  });
  it('marks rejected catalog pricing for persisted-field invalidation without rejecting provider-valid rates', async () => {
    const catalog = new MaintainedModelCatalog({
      fetch: async () =>
        response(payload({ ...entry, cost: { input: 2, output: 8, currency: 'EUR' } })),
    });
    const [model] = await catalog.enrich('openai', [
      { providerModelId: 'exact', pricing: { inputPerMTokUsd: 3 } },
    ]);
    expect(model.pricing).toEqual({ inputPerMTokUsd: 3 });
    expect(model.unsupportedPricingFields).toEqual(['outputPerMTokUsd']);
  });
  it('coalesces requests, expires cache, preserves stale facts and retries after a bounded backoff', async () => {
    let now = 1000;
    const fetcher = vi
      .fn()
      .mockResolvedValueOnce(response(payload()))
      .mockRejectedValue(new Error('secret upstream detail'));
    const catalog = new MaintainedModelCatalog({ fetch: fetcher, now: () => now, ttlMs: 100 });
    await Promise.all([
      catalog.enrich('openai', [{ providerModelId: 'exact' }]),
      catalog.enrich('openai', [{ providerModelId: 'exact' }]),
    ]);
    expect(fetcher).toHaveBeenCalledTimes(1);
    now = 1101;
    const [stale] = await catalog.enrich('openai', [{ providerModelId: 'exact' }]);
    expect(stale.pricing?.inputPerMTokUsd).toBe(2);
    expect(stale.fieldMetadata?.['pricing.inputPerMTokUsd']).toMatchObject({
      stale: true,
      updatedAt: new Date(1000).toISOString(),
    });
    expect(stale.metadataWarnings?.join(' ')).toContain('cached');
    expect(stale.metadataWarnings?.join(' ')).not.toContain('secret');
    await catalog.enrich('openai', [{ providerModelId: 'exact' }]);
    expect(fetcher).toHaveBeenCalledTimes(2);
  });
  it('bounds response size and reports failures without losing provider metadata', async () => {
    const catalog = new MaintainedModelCatalog({
      fetch: async () => response(payload()),
      maxBytes: 10,
    });
    const [model] = await catalog.enrich('openai', [
      { providerModelId: 'exact', capabilities: { chat: true } },
    ]);
    expect(model.capabilities).toEqual({ chat: true });
    expect(model.pricing).toBeUndefined();
    expect(model.metadataWarnings?.join(' ')).toContain('unavailable');
  });
  it('bounds time even when an injected fetch ignores abort', async () => {
    const catalog = new MaintainedModelCatalog({
      fetch: () => new Promise(() => {}),
      timeoutMs: 5,
    });
    const [model] = await catalog.enrich('openai', [{ providerModelId: 'exact' }]);
    expect(model.metadataWarnings?.join(' ')).toContain('unavailable');
  });
  it('does not fetch for generic compatible or Azure deployment IDs or empty discovery', async () => {
    const fetcher = vi.fn(async () => response(payload()));
    const catalog = new MaintainedModelCatalog({ fetch: fetcher });
    await catalog.enrich('openai-compatible', [{ providerModelId: 'exact' }]);
    await catalog.enrich('azure-openai', [{ providerModelId: 'exact', catalogModelId: 'exact' }]);
    await catalog.enrich('openai', []);
    expect(fetcher).not.toHaveBeenCalled();
  });
});

import { describe, expect, it } from 'vitest';
import type { ModelFieldMetadata } from '@gamecrafter/contracts';
import {
  enrichDiscoveredModel,
  MODEL_METADATA_CATALOG,
  MODEL_METADATA_CATALOG_VERSION,
} from './model-catalog';

const catalogField: ModelFieldMetadata = {
  source: 'provider-catalog',
  updatedAt: '2026-10-04T00:00:00.000Z',
  sourceUrl: 'https://provider.example/models/gpt-test',
  confidence: 'high',
};

describe('model metadata catalog', () => {
  it('fills missing exact-ID metadata while current provider declarations win', () => {
    const model = enrichDiscoveredModel(
      'openai',
      {
        providerModelId: 'gpt-test',
        capabilities: { chat: true, tools: false },
        pricing: { inputPerMTokUsd: 0.2 },
        metadataSource: 'provider-api',
        sourceUrl: 'https://api.provider.example/v1/models',
      },
      [
        {
          providerKind: 'openai',
          providerModelId: 'gpt-test',
          capabilities: { chat: false, tools: true, vision: true },
          pricing: { inputPerMTokUsd: 0.1, outputPerMTokUsd: 0.3 },
          workTypes: ['code'],
          fieldMetadata: {
            'capabilities.chat': catalogField,
            'capabilities.tools': catalogField,
            'capabilities.vision': catalogField,
            'pricing.inputPerMTokUsd': catalogField,
            'pricing.outputPerMTokUsd': catalogField,
            workTypes: catalogField,
          },
        },
      ],
    );

    expect(model).toMatchObject({
      capabilities: { chat: true, tools: false, vision: true },
      pricing: { inputPerMTokUsd: 0.2, outputPerMTokUsd: 0.3 },
      workTypes: ['code'],
      fieldMetadata: {
        'capabilities.vision': catalogField,
        'pricing.outputPerMTokUsd': catalogField,
      },
    });
    expect(model.fieldMetadata?.['capabilities.tools']).toBeUndefined();
    expect(model.fieldMetadata?.['capabilities.chat']).toBeUndefined();
    expect(model.fieldMetadata?.['pricing.inputPerMTokUsd']).toBeUndefined();
  });

  it('does not infer catalog metadata from a model name or similar provider ID', () => {
    const model = { providerModelId: 'gpt-test-2026' };
    expect(
      enrichDiscoveredModel('openai', model, [
        {
          providerKind: 'openai',
          providerModelId: 'gpt-test',
          capabilities: { chat: true },
          fieldMetadata: { 'capabilities.chat': catalogField },
        },
      ]),
    ).toEqual(model);
    expect(MODEL_METADATA_CATALOG_VERSION).toBe('2026-10-04');
  });

  it('ships sourced exact-ID metadata and preserves Azure deployment identity', () => {
    const openAi = enrichDiscoveredModel('openai', { providerModelId: 'gpt-6-luna' });
    expect(openAi).toMatchObject({
      capabilities: { chat: true, tools: true, contextWindow: 1_050_000, maxOutputTokens: 128_000 },
      pricing: { inputPerMTokUsd: 0.1, outputPerMTokUsd: 0.5 },
      fieldMetadata: {
        'capabilities.contextWindow': {
          source: 'provider-catalog',
          sourceUrl: 'https://platform.openai.com/docs/models',
        },
      },
    });

    const azure = enrichDiscoveredModel('azure-openai', {
      providerModelId: 'studio-prod-deployment',
      catalogModelId: 'gpt-6.1-sol',
    });
    expect(azure).toMatchObject({
      providerModelId: 'studio-prod-deployment',
      catalogModelId: 'gpt-6.1-sol',
      capabilities: { chat: true, contextWindow: 1_050_000, maxOutputTokens: 128_000 },
    });
    const sameNameDeployment = { providerModelId: 'gpt-6.1-sol' };
    expect(enrichDiscoveredModel('azure-openai', sameNameDeployment)).toEqual(sameNameDeployment);

    const embedding = enrichDiscoveredModel('openai', {
      providerModelId: 'text-embedding-3-small',
    });
    expect(embedding).toMatchObject({
      capabilities: { chat: false, embeddings: true },
      tags: ['embedding-model'],
      fieldMetadata: {
        'capabilities.embeddings': {
          source: 'provider-catalog',
          sourceUrl: 'https://platform.openai.com/docs/guides/embeddings',
        },
      },
    });
    expect(embedding.workTypes).toBeUndefined();
    expect(embedding.roles).toBeUndefined();
    expect(MODEL_METADATA_CATALOG.length).toBeGreaterThanOrEqual(8);
  });
});

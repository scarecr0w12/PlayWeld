import type {
  ModelCapabilities,
  ModelFieldMetadata,
  ModelPricing,
  ProviderKind,
} from '@gamecrafter/contracts';
import type { DiscoveredModel } from './providers';

export interface ModelCatalogEntry {
  providerKind: ProviderKind;
  providerModelId: string;
  displayName?: string;
  capabilities?: Partial<ModelCapabilities>;
  pricing?: Partial<ModelPricing>;
  tags?: string[];
  workTypes?: string[];
  roles?: string[];
  fieldMetadata: Record<string, ModelFieldMetadata>;
}

export const MODEL_METADATA_CATALOG_VERSION = '2026-10-04';

const researchedAt = '2026-10-04T00:00:00.000Z';
const openAiCatalogUrl = 'https://platform.openai.com/docs/models';
const openRouterCatalogUrl =
  'https://openrouter.ai/api/v1/models?limit=5&sort=most-popular&model_authors=openai';
const xaiModelCardUrl = 'https://docs.x.ai/developers/models/grok-4.3';
const mistralModelCardUrl = 'https://docs.mistral.ai/models/mistral-large-3-25-12';
const mistralVisionUrl = 'https://docs.mistral.ai/studio/conversations/vision';
const deepseekModelsUrl = 'https://api-docs.deepseek.com/api/list-models';
const groqModelsUrl = 'https://console.groq.com/docs/models';
const azureModelCardUrl =
  'https://learn.microsoft.com/en-us/azure/foundry/foundry-models/concepts/models-sold-directly-by-azure';
const openAiEmbeddingsUrl = 'https://platform.openai.com/docs/guides/embeddings';
const mistralCodestralUrl = 'https://docs.mistral.ai/models/codestral-25-08';
const mistralCodestralEmbedUrl = 'https://docs.mistral.ai/models/codestral-embed-25-05';
const mistralEmbedUrl = 'https://docs.mistral.ai/models/mistral-embed-23-12';

function sourcedFields(sourceUrl: string, fields: string[]): Record<string, ModelFieldMetadata> {
  return Object.fromEntries(
    fields.map((field) => [
      field,
      {
        source: 'provider-catalog',
        updatedAt: researchedAt,
        sourceUrl,
        confidence: 'high',
      } satisfies ModelFieldMetadata,
    ]),
  );
}

// Keep exact model IDs and source only fields the provider has published. Refresh mutable facts
// with application releases; account discovery remains authoritative when it returns a value.
export const MODEL_METADATA_CATALOG: readonly ModelCatalogEntry[] = [
  {
    providerKind: 'openai',
    providerModelId: 'gpt-6-astra',
    capabilities: {
      chat: true,
      tools: true,
      vision: true,
      contextWindow: 1_050_000,
      maxOutputTokens: 128_000,
    },
    pricing: { inputPerMTokUsd: 10, outputPerMTokUsd: 50 },
    fieldMetadata: sourcedFields(openAiCatalogUrl, [
      'capabilities.chat',
      'capabilities.tools',
      'capabilities.vision',
      'capabilities.contextWindow',
      'capabilities.maxOutputTokens',
      'pricing.inputPerMTokUsd',
      'pricing.outputPerMTokUsd',
    ]),
  },
  {
    providerKind: 'openai',
    providerModelId: 'gpt-6-luna',
    capabilities: {
      chat: true,
      tools: true,
      vision: true,
      contextWindow: 1_050_000,
      maxOutputTokens: 128_000,
    },
    pricing: { inputPerMTokUsd: 0.1, outputPerMTokUsd: 0.5 },
    fieldMetadata: sourcedFields(openAiCatalogUrl, [
      'capabilities.chat',
      'capabilities.tools',
      'capabilities.vision',
      'capabilities.contextWindow',
      'capabilities.maxOutputTokens',
      'pricing.inputPerMTokUsd',
      'pricing.outputPerMTokUsd',
    ]),
  },
  {
    providerKind: 'openrouter',
    providerModelId: 'openai/gpt-6-astra',
    capabilities: {
      chat: true,
      tools: true,
      vision: true,
      contextWindow: 1_050_000,
      maxOutputTokens: 128_000,
    },
    pricing: { inputPerMTokUsd: 10, outputPerMTokUsd: 50 },
    fieldMetadata: sourcedFields(openRouterCatalogUrl, [
      'capabilities.chat',
      'capabilities.tools',
      'capabilities.vision',
      'capabilities.contextWindow',
      'capabilities.maxOutputTokens',
      'pricing.inputPerMTokUsd',
      'pricing.outputPerMTokUsd',
    ]),
  },
  {
    providerKind: 'xai',
    providerModelId: 'grok-4.3',
    capabilities: {
      chat: true,
      tools: true,
      vision: true,
      structuredOutput: true,
      contextWindow: 1_000_000,
    },
    fieldMetadata: sourcedFields(xaiModelCardUrl, [
      'capabilities.chat',
      'capabilities.tools',
      'capabilities.vision',
      'capabilities.structuredOutput',
      'capabilities.contextWindow',
    ]),
  },
  {
    providerKind: 'mistral',
    providerModelId: 'mistral-large-2512',
    capabilities: {
      chat: true,
      tools: true,
      vision: true,
      structuredOutput: true,
      contextWindow: 256_000,
    },
    pricing: { inputPerMTokUsd: 0.5, outputPerMTokUsd: 1.5 },
    fieldMetadata: {
      ...sourcedFields(mistralModelCardUrl, [
        'capabilities.chat',
        'capabilities.structuredOutput',
        'capabilities.contextWindow',
        'pricing.inputPerMTokUsd',
        'pricing.outputPerMTokUsd',
      ]),
      ...sourcedFields(mistralVisionUrl, ['capabilities.tools', 'capabilities.vision']),
    },
  },
  {
    providerKind: 'deepseek',
    providerModelId: 'deepseek-flash',
    capabilities: {
      chat: true,
      tools: true,
      vision: true,
      contextWindow: 1_000_000,
      maxOutputTokens: 384_000,
    },
    fieldMetadata: sourcedFields(deepseekModelsUrl, [
      'capabilities.chat',
      'capabilities.tools',
      'capabilities.vision',
      'capabilities.contextWindow',
      'capabilities.maxOutputTokens',
    ]),
  },
  {
    providerKind: 'deepseek',
    providerModelId: 'deepseek-v4-pro',
    capabilities: {
      chat: true,
      tools: true,
      vision: false,
      contextWindow: 1_000_000,
      maxOutputTokens: 384_000,
    },
    fieldMetadata: sourcedFields(deepseekModelsUrl, [
      'capabilities.chat',
      'capabilities.tools',
      'capabilities.vision',
      'capabilities.contextWindow',
      'capabilities.maxOutputTokens',
    ]),
  },
  {
    providerKind: 'groq',
    providerModelId: 'openai/gpt-oss-120b',
    capabilities: { chat: true, contextWindow: 131_072, maxOutputTokens: 65_536 },
    pricing: { inputPerMTokUsd: 0.15, outputPerMTokUsd: 0.6 },
    fieldMetadata: sourcedFields(groqModelsUrl, [
      'capabilities.chat',
      'capabilities.contextWindow',
      'capabilities.maxOutputTokens',
      'pricing.inputPerMTokUsd',
      'pricing.outputPerMTokUsd',
    ]),
  },
  {
    providerKind: 'azure-openai',
    providerModelId: 'gpt-6.1-sol',
    capabilities: {
      chat: true,
      vision: true,
      contextWindow: 1_050_000,
      maxInputTokens: 922_000,
      maxOutputTokens: 128_000,
    },
    fieldMetadata: sourcedFields(azureModelCardUrl, [
      'capabilities.chat',
      'capabilities.vision',
      'capabilities.contextWindow',
      'capabilities.maxInputTokens',
      'capabilities.maxOutputTokens',
    ]),
  },
  {
    providerKind: 'azure-openai',
    providerModelId: 'gpt-6-astra',
    capabilities: {
      chat: true,
      vision: true,
      contextWindow: 1_050_000,
      maxInputTokens: 922_000,
      maxOutputTokens: 128_000,
    },
    fieldMetadata: sourcedFields(azureModelCardUrl, [
      'capabilities.chat',
      'capabilities.vision',
      'capabilities.contextWindow',
      'capabilities.maxInputTokens',
      'capabilities.maxOutputTokens',
    ]),
  },
  {
    providerKind: 'openai',
    providerModelId: 'text-embedding-3-small',
    capabilities: { chat: false, embeddings: true },
    tags: ['embedding-model'],
    fieldMetadata: sourcedFields(openAiEmbeddingsUrl, [
      'capabilities.chat',
      'capabilities.embeddings',
      'tags',
    ]),
  },
  {
    providerKind: 'openai',
    providerModelId: 'text-embedding-3-large',
    capabilities: { chat: false, embeddings: true },
    tags: ['embedding-model'],
    fieldMetadata: sourcedFields(openAiEmbeddingsUrl, [
      'capabilities.chat',
      'capabilities.embeddings',
      'tags',
    ]),
  },
  {
    providerKind: 'mistral',
    providerModelId: 'codestral-2508',
    capabilities: { chat: true },
    tags: ['code-model'],
    fieldMetadata: sourcedFields(mistralCodestralUrl, ['capabilities.chat', 'tags']),
  },
  {
    providerKind: 'mistral',
    providerModelId: 'codestral-embed-2505',
    capabilities: { chat: false, embeddings: true },
    tags: ['embedding-model'],
    fieldMetadata: sourcedFields(mistralCodestralEmbedUrl, [
      'capabilities.chat',
      'capabilities.embeddings',
      'tags',
    ]),
  },
  {
    providerKind: 'mistral',
    providerModelId: 'mistral-embed-2312',
    capabilities: { chat: false, embeddings: true },
    tags: ['embedding-model'],
    fieldMetadata: sourcedFields(mistralEmbedUrl, [
      'capabilities.chat',
      'capabilities.embeddings',
      'tags',
    ]),
  },
  {
    providerKind: 'azure-openai',
    providerModelId: 'text-embedding-3-small',
    capabilities: { chat: false, embeddings: true },
    tags: ['embedding-model'],
    fieldMetadata: sourcedFields(azureModelCardUrl, [
      'capabilities.chat',
      'capabilities.embeddings',
      'tags',
    ]),
  },
  {
    providerKind: 'azure-openai',
    providerModelId: 'text-embedding-3-large',
    capabilities: { chat: false, embeddings: true },
    tags: ['embedding-model'],
    fieldMetadata: sourcedFields(azureModelCardUrl, [
      'capabilities.chat',
      'capabilities.embeddings',
      'tags',
    ]),
  },
];

export function enrichDiscoveredModel(
  providerKind: ProviderKind,
  model: DiscoveredModel,
  catalog: readonly ModelCatalogEntry[] = MODEL_METADATA_CATALOG,
): DiscoveredModel {
  const catalogModelId =
    providerKind === 'azure-openai'
      ? model.catalogModelId
      : (model.catalogModelId ?? model.providerModelId);
  if (!catalogModelId) return model;
  const entry = catalog.find(
    (candidate) =>
      candidate.providerKind === providerKind && candidate.providerModelId === catalogModelId,
  );
  if (!entry) return model;

  const fieldMetadata = { ...entry.fieldMetadata, ...model.fieldMetadata };
  for (const field of providedFields(model)) {
    if (model.fieldMetadata?.[field] === undefined) delete fieldMetadata[field];
  }
  const enriched: DiscoveredModel = { ...model, fieldMetadata };
  if (model.catalogModelId !== undefined) {
    enriched.catalogModelId = model.catalogModelId;
  }
  if (model.catalogModelId === undefined && entry.providerModelId !== model.providerModelId) {
    enriched.catalogModelId = entry.providerModelId;
  }
  if (model.displayName === undefined && entry.displayName !== undefined) {
    enriched.displayName = entry.displayName;
  }
  enriched.capabilities = mergeCatalogObject(entry.capabilities, model.capabilities);
  enriched.pricing = mergeCatalogObject(entry.pricing, model.pricing);
  if (model.tags === undefined && entry.tags !== undefined) enriched.tags = entry.tags;
  if (model.workTypes === undefined && entry.workTypes !== undefined) {
    enriched.workTypes = entry.workTypes;
  }
  if (model.roles === undefined && entry.roles !== undefined) enriched.roles = entry.roles;

  return enriched;
}

function mergeCatalogObject<T extends object>(
  catalog: Partial<T> | undefined,
  provider: Partial<T> | undefined,
): Partial<T> | undefined {
  if (!catalog) return provider;
  const result: Record<string, unknown> = { ...catalog };
  for (const [key, value] of Object.entries(provider ?? {})) {
    if (value !== undefined && value !== null) result[key] = value;
  }
  return result as Partial<T>;
}

function providedFields(model: DiscoveredModel): string[] {
  const fields: string[] = [];
  if (model.displayName !== undefined) fields.push('displayName');
  if (model.catalogModelId !== undefined) fields.push('catalogModelId');
  for (const [key, value] of Object.entries(model.capabilities ?? {})) {
    if (value !== undefined && value !== null) fields.push(`capabilities.${key}`);
  }
  for (const [key, value] of Object.entries(model.pricing ?? {})) {
    if (value !== undefined && value !== null) fields.push(`pricing.${key}`);
  }
  if (model.tags !== undefined) fields.push('tags');
  if (model.workTypes !== undefined) fields.push('workTypes');
  if (model.roles !== undefined) fields.push('roles');
  return fields;
}

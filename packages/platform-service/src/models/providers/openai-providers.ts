import { RpcError, RpcErrorCode, type ProviderKind } from '@gamecrafter/contracts';
import type { DiscoveredModel, ProviderRuntimeAccount } from './provider';
import {
  OpenAICompatibleProvider,
  type OpenAICompatibleProviderOptions,
} from './openai-compatible';

/** First-party endpoints used when an account does not override its service URL. */
export const DEFAULT_PROVIDER_BASE_URLS: Partial<Record<ProviderKind, string>> = {
  openai: 'https://api.openai.com/v1',
  'google-gemini': 'https://generativelanguage.googleapis.com/v1beta',
  openrouter: 'https://openrouter.ai/api/v1',
  xai: 'https://api.x.ai/v1',
  mistral: 'https://api.mistral.ai/v1',
  deepseek: 'https://api.deepseek.com',
  groq: 'https://api.groq.com/openai/v1',
  'azure-openai': 'https://YOUR_RESOURCE_NAME.openai.azure.com/openai/v1',
};

const apiSource: Record<string, string> = {
  openai: 'https://api.openai.com/v1/models',
  openrouter: 'https://openrouter.ai/api/v1/models',
  xai: 'https://api.x.ai/v1/language-models',
  mistral: 'https://api.mistral.ai/v1/models',
  deepseek: 'https://api.deepseek.com/models',
  groq: 'https://api.groq.com/openai/v1/models',
  'azure-openai': 'https://learn.microsoft.com/en-us/rest/api/azureopenai/models/list',
};

export class OpenAIProvider extends OpenAICompatibleProvider {
  constructor() {
    super({
      defaultBaseUrl: DEFAULT_PROVIDER_BASE_URLS.openai,
      parseModels: (entries) => mapEntries(entries, (entry) => identified(entry, 'openai')),
    });
  }
}

export class OpenRouterProvider extends OpenAICompatibleProvider {
  constructor() {
    super({
      defaultBaseUrl: DEFAULT_PROVIDER_BASE_URLS.openrouter,
      supportsEmbeddings: true,
      parseModels: (entries) => mapEntries(entries, openRouterModel),
    });
  }
}

export class XAIProvider extends OpenAICompatibleProvider {
  constructor() {
    super({
      defaultBaseUrl: DEFAULT_PROVIDER_BASE_URLS.xai,
      modelsPath: () => 'language-models',
      supportsEmbeddings: false,
      parseModels: (entries) => mapEntries(entries, xaiModel),
    });
  }
}

export class MistralProvider extends OpenAICompatibleProvider {
  constructor() {
    super({
      defaultBaseUrl: DEFAULT_PROVIDER_BASE_URLS.mistral,
      supportsEmbeddings: true,
      parseModels: (entries) => mapEntries(entries, mistralModel),
    });
  }
}

export class DeepSeekProvider extends OpenAICompatibleProvider {
  constructor() {
    super({
      defaultBaseUrl: DEFAULT_PROVIDER_BASE_URLS.deepseek,
      supportsEmbeddings: false,
      parseModels: (entries) => mapEntries(entries, deepSeekModel),
    });
  }
}

export class GroqProvider extends OpenAICompatibleProvider {
  constructor() {
    super({
      defaultBaseUrl: DEFAULT_PROVIDER_BASE_URLS.groq,
      supportsEmbeddings: false,
      parseModels: (entries) => mapEntries(entries, groqModel),
    });
  }
}

export class AzureOpenAIProvider extends OpenAICompatibleProvider {
  constructor() {
    super(azureOptions());
  }
}

function azureOptions(): OpenAICompatibleProviderOptions {
  const isV1 = (account: ProviderRuntimeAccount) => /\/openai\/v1\/?$/i.test(account.baseUrl);
  const version = (account: ProviderRuntimeAccount) =>
    encodeURIComponent(account.providerOptions.apiVersion || '2024-10-21');
  const deployment = (account: ProviderRuntimeAccount) => {
    const name = account.providerOptions.deploymentName;
    if (name) return name;
    throw new RpcError(
      'Azure classic model discovery returns catalog models, not deployments. Configure providerOptions.deploymentName before invoking a classic endpoint.',
      RpcErrorCode.InvalidParams,
    );
  };
  return {
    defaultBaseUrl: DEFAULT_PROVIDER_BASE_URLS['azure-openai'],
    supportsEmbeddings: true,
    modelsPath: (account) => {
      if (isV1(account)) return 'models';
      if (!account.providerOptions.deploymentName) {
        throw new RpcError(
          'Set providerOptions.deploymentName before discovering Azure classic deployments; the model list is only a base-model catalog.',
          RpcErrorCode.InvalidParams,
        );
      }
      return `openai/models?api-version=${version(account)}`;
    },
    chatPath: (account) =>
      isV1(account)
        ? 'chat/completions'
        : `openai/deployments/${encodeURIComponent(deployment(account))}/chat/completions?api-version=${version(account)}`,
    embeddingsPath: (account) =>
      isV1(account)
        ? 'embeddings'
        : `openai/deployments/${encodeURIComponent(deployment(account))}/embeddings?api-version=${version(account)}`,
    headers: (account) => {
      const headers: Record<string, string> = {};
      if (account.apiKey) headers['api-key'] = account.apiKey;
      return headers;
    },
    mapChatRequest: (account, _model, body) => {
      if (isV1(account)) return body;
      return Object.fromEntries(Object.entries(body).filter(([key]) => key !== 'model'));
    },
    parseModels: (entries, account) =>
      isV1(account)
        ? mapEntries(entries, azureV1Model)
        : classicAzureModel(
            entries,
            account.providerOptions.deploymentName!,
            account.providerOptions.catalogModelId,
          ),
  };
}

function identified(entry: Record<string, unknown>, provider: string): DiscoveredModel {
  const id = modelId(entry);
  return {
    providerModelId: id,
    ...(stringValue(entry.display_name) ? { displayName: stringValue(entry.display_name) } : {}),
    ...(stringValue(entry.name) ? { displayName: stringValue(entry.name) } : {}),
    metadataSource: 'provider-api',
    sourceUrl: apiSource[provider],
    confidence: 'high',
  };
}

function openRouterModel(entry: Record<string, unknown>): DiscoveredModel {
  const model = identified(entry, 'openrouter');
  const architecture = objectValue(entry.architecture) ? entry.architecture : {};
  const topProvider = objectValue(entry.top_provider) ? entry.top_provider : {};
  const supported = stringArray(entry.supported_parameters);
  const inputModalities = stringArray(architecture.input_modalities);
  const outputModalities = stringArray(architecture.output_modalities);
  const modality = stringValue(architecture.modality);
  const pricing = objectValue(entry.pricing) ? entry.pricing : {};
  const inputPrice = decimalValue(pricing.prompt);
  const outputPrice = decimalValue(pricing.completion);
  const capabilities: NonNullable<DiscoveredModel['capabilities']> = {};
  if (typeof entry.context_length === 'number') capabilities.contextWindow = entry.context_length;
  if (typeof topProvider.max_completion_tokens === 'number')
    capabilities.maxOutputTokens = topProvider.max_completion_tokens;
  if (inputModalities.length || outputModalities.length || modality)
    capabilities.vision =
      inputModalities.includes('image') || /(^|[^a-z])image([^a-z]|$)/i.test(modality ?? '');
  if (outputModalities.includes('embedding') || modality?.includes('embedding'))
    capabilities.embeddings = true;
  if (supported.length) {
    capabilities.tools = supported.includes('tools') || supported.includes('tool_choice');
    capabilities.structuredOutput =
      supported.includes('response_format') || supported.includes('structured_outputs');
  }
  return {
    ...model,
    ...(Object.keys(capabilities).length ? { capabilities } : {}),
    ...(inputPrice === undefined && outputPrice === undefined
      ? {}
      : {
          pricing: {
            ...(inputPrice === undefined ? {} : { inputPerMTokUsd: inputPrice * 1_000_000 }),
            ...(outputPrice === undefined ? {} : { outputPerMTokUsd: outputPrice * 1_000_000 }),
          },
        }),
  };
}

function xaiModel(entry: Record<string, unknown>): DiscoveredModel {
  const model = identified(entry, 'xai');
  const capabilities: NonNullable<DiscoveredModel['capabilities']> = { chat: true };
  const context = numberValue(entry.context_length) ?? numberValue(entry.max_input_tokens);
  const output = numberValue(entry.max_output_tokens);
  if (context !== undefined) capabilities.contextWindow = context;
  if (numberValue(entry.max_input_tokens) !== undefined)
    capabilities.maxInputTokens = numberValue(entry.max_input_tokens)!;
  if (output !== undefined) capabilities.maxOutputTokens = output;
  const modalities = stringArray(entry.input_modalities);
  if (modalities.length) capabilities.vision = modalities.includes('image');
  const standardInput = numberValue(entry.prompt_text_token_price);
  const standardOutput = numberValue(entry.completion_text_token_price);
  const cachedInput = numberValue(entry.cached_prompt_text_token_price);
  const hasLongContextTier = (numberValue(entry.long_context_threshold) ?? 0) > 0;
  const pricing =
    modalities.includes('image') ||
    hasLongContextTier ||
    (cachedInput !== undefined && cachedInput > 0)
      ? undefined
      : standardInput === undefined && standardOutput === undefined
        ? undefined
        : {
            ...(standardInput === undefined ? {} : { inputPerMTokUsd: standardInput / 10_000 }),
            ...(standardOutput === undefined ? {} : { outputPerMTokUsd: standardOutput / 10_000 }),
          };
  return {
    ...model,
    ...(Object.keys(capabilities).length ? { capabilities } : {}),
    ...(pricing ? { pricing } : {}),
    ...(stringValue(entry.name) ? { displayName: stringValue(entry.name) } : {}),
  };
}

function mistralModel(entry: Record<string, unknown>): DiscoveredModel {
  const model = identified(entry, 'mistral');
  const capabilities: NonNullable<DiscoveredModel['capabilities']> = {};
  const declared = objectValue(entry.capabilities) ? entry.capabilities : {};
  if (typeof declared.completion_chat === 'boolean') capabilities.chat = declared.completion_chat;
  if (typeof declared.function_calling === 'boolean')
    capabilities.tools = declared.function_calling;
  if (typeof declared.vision === 'boolean') capabilities.vision = declared.vision;
  const context = numberValue(entry.max_context_length) ?? numberValue(entry.context_length);
  if (context !== undefined) capabilities.contextWindow = context;
  return {
    ...model,
    ...(stringValue(entry.name) ? { displayName: stringValue(entry.name) } : {}),
    ...(Object.keys(capabilities).length ? { capabilities } : {}),
  };
}

function deepSeekModel(entry: Record<string, unknown>): DiscoveredModel {
  const model = identified(entry, 'deepseek');
  const capabilities: NonNullable<DiscoveredModel['capabilities']> = {};
  const declared = objectValue(entry.capabilities) ? entry.capabilities : {};
  const context = numberValue(entry.context_window) ?? numberValue(entry.context_length);
  const output = numberValue(entry.max_output_tokens);
  if (context !== undefined) capabilities.contextWindow = context;
  if (output !== undefined) capabilities.maxOutputTokens = output;
  for (const key of [
    'chat',
    'tools',
    'vision',
    'structuredOutput',
    'streaming',
    'embeddings',
  ] as const) {
    if (typeof declared[key] === 'boolean') capabilities[key] = declared[key];
  }
  if (typeof declared.structured_output === 'boolean')
    capabilities.structuredOutput = declared.structured_output;
  if (Array.isArray(entry.modalities))
    capabilities.vision = stringArray(entry.modalities).includes('image');
  return { ...model, ...(Object.keys(capabilities).length ? { capabilities } : {}) };
}

function groqModel(entry: Record<string, unknown>): DiscoveredModel {
  const model = identified(entry, 'groq');
  const capabilities: NonNullable<DiscoveredModel['capabilities']> = {};
  const context = numberValue(entry.context_window) ?? numberValue(entry.context_length);
  const output = numberValue(entry.max_completion_tokens);
  if (context !== undefined) capabilities.contextWindow = context;
  if (output !== undefined) capabilities.maxOutputTokens = output;
  return {
    ...model,
    ...(typeof entry.active === 'boolean'
      ? { tags: entry.active ? ['active'] : ['inactive'] }
      : {}),
    ...(Object.keys(capabilities).length ? { capabilities } : {}),
  };
}

function azureModel(entry: Record<string, unknown>): DiscoveredModel {
  const model = identified(entry, 'azure-openai');
  const capabilities: NonNullable<DiscoveredModel['capabilities']> = {};
  const declared = objectValue(entry.capabilities) ? entry.capabilities : {};
  if (typeof declared.chat_completion === 'boolean') capabilities.chat = declared.chat_completion;
  if (typeof declared.embeddings === 'boolean') capabilities.embeddings = declared.embeddings;
  for (const key of [
    'chat',
    'tools',
    'vision',
    'structuredOutput',
    'streaming',
    'embeddings',
  ] as const) {
    if (typeof declared[key] === 'boolean') capabilities[key] = declared[key];
  }
  const context = numberValue(entry.context_window) ?? numberValue(entry.max_input_tokens);
  const output = numberValue(entry.max_output_tokens);
  if (context !== undefined) capabilities.contextWindow = context;
  if (numberValue(entry.max_input_tokens) !== undefined)
    capabilities.maxInputTokens = numberValue(entry.max_input_tokens)!;
  if (output !== undefined) capabilities.maxOutputTokens = output;
  return { ...model, ...(Object.keys(capabilities).length ? { capabilities } : {}) };
}

function classicAzureModel(
  entries: Record<string, unknown>[],
  deploymentName: string,
  catalogModelId?: string,
): DiscoveredModel[] {
  const catalogEntry = catalogModelId
    ? entries.find((entry) => modelId(entry) === catalogModelId)
    : undefined;
  const mapped = catalogEntry ? azureModel(catalogEntry) : undefined;
  return [
    {
      providerModelId: deploymentName,
      ...(catalogModelId ? { catalogModelId } : {}),
      displayName: catalogModelId ? `${deploymentName} (${catalogModelId})` : deploymentName,
      ...(mapped?.capabilities ? { capabilities: mapped.capabilities } : {}),
      ...(mapped?.pricing ? { pricing: mapped.pricing } : {}),
      ...(catalogModelId
        ? {
            fieldMetadata: {
              catalogModelId: {
                source: 'account-config' as const,
                updatedAt: new Date().toISOString(),
                sourceUrl: null,
                confidence: 'high' as const,
              },
            },
          }
        : {}),
      metadataSource: 'provider-api',
      sourceUrl: apiSource['azure-openai'],
      confidence: 'high',
    },
  ];
}

function azureV1Model(entry: Record<string, unknown>): DiscoveredModel {
  const model = azureModel(entry);
  const catalogModelId = stringValue(entry.model) ?? stringValue(entry.root);
  return { ...model, ...(catalogModelId ? { catalogModelId } : {}) };
}

function mapEntries(
  entries: Record<string, unknown>[],
  map: (entry: Record<string, unknown>) => DiscoveredModel,
): DiscoveredModel[] {
  return entries.filter((entry) => modelId(entry).length > 0).map(map);
}

function modelId(entry: Record<string, unknown>): string {
  const candidate = entry.id ?? entry.name ?? entry.model_id;
  return typeof candidate === 'string' ? candidate.replace(/^models\//, '') : '';
}

function objectValue(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function stringValue(value: unknown): string | undefined {
  return typeof value === 'string' ? value : undefined;
}

function numberValue(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
}

function decimalValue(value: unknown): number | undefined {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value !== 'string' || value.trim() === '') return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function stringArray(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === 'string')
    : [];
}

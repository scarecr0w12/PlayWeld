import type { ProviderKind } from '@gamecrafter/contracts';
import {
  MaintainedModelCatalog,
  type MaintainedModelCatalogOptions,
  type ModelMetadataEnricher,
} from '../maintained-catalog';
import type { ModelProvider } from './provider';
import { AnthropicProvider } from './anthropic';
import { GoogleGeminiProvider } from './google-gemini';
import { OpenAICompatibleProvider } from './openai-compatible';
import {
  AzureOpenAIProvider,
  DeepSeekProvider,
  DEFAULT_PROVIDER_BASE_URLS,
  GroqProvider,
  MistralProvider,
  OpenAIProvider,
  OpenRouterProvider,
  XAIProvider,
} from './openai-providers';
import { ModelProviderRegistry } from './provider-registry';

export * from './anthropic';
export * from './google-gemini';
export * from './openai-compatible';
export * from './openai-providers';
export * from './provider';
export * from './provider-registry';

export interface BuiltinModelProviderOptions {
  catalog?: ModelMetadataEnricher | false;
  catalogOptions?: MaintainedModelCatalogOptions;
}

export function createBuiltinModelProviders(
  options: BuiltinModelProviderOptions = {},
): ModelProviderRegistry {
  const providers = new ModelProviderRegistry();
  const catalog =
    options.catalog === false
      ? undefined
      : (options.catalog ?? new MaintainedModelCatalog(options.catalogOptions));
  const register = (kind: ProviderKind, provider: ModelProvider) => {
    providers.register(
      kind,
      catalog
        ? {
            listModels: async (account) => {
              const models = await provider.listModels(account);
              if (!catalogOriginMatches(kind, account.baseUrl))
                return models.map((model) => ({
                  ...model,
                  metadataWarnings: [
                    ...(model.metadataWarnings ?? []),
                    'Maintained third-party catalog enrichment skipped for a custom provider endpoint.',
                  ],
                }));
              return catalog.enrich(kind, models);
            },
            complete: (...args) => provider.complete(...args),
            embed: (...args) => provider.embed(...args),
          }
        : provider,
    );
  };
  register('openai-compatible', new OpenAICompatibleProvider());
  register('openai', new OpenAIProvider());
  register('anthropic', new AnthropicProvider());
  register('google-gemini', new GoogleGeminiProvider());
  register('openrouter', new OpenRouterProvider());
  register('xai', new XAIProvider());
  register('mistral', new MistralProvider());
  register('deepseek', new DeepSeekProvider());
  register('groq', new GroqProvider());
  register('azure-openai', new AzureOpenAIProvider());
  return providers;
}

export function catalogOriginMatches(kind: ProviderKind, baseUrl: string): boolean {
  if (kind === 'openai-compatible') return true;
  if (kind === 'azure-openai') {
    try {
      const url = new URL(baseUrl);
      return (
        url.protocol === 'https:' && url.port === '' && url.hostname.endsWith('.openai.azure.com')
      );
    } catch {
      return false;
    }
  }
  const expected =
    kind === 'anthropic' ? 'https://api.anthropic.com' : DEFAULT_PROVIDER_BASE_URLS[kind];
  if (!expected) return false;
  try {
    return new URL(baseUrl || expected).origin === new URL(expected).origin;
  } catch {
    return false;
  }
}

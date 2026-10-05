import { AnthropicProvider } from './anthropic';
import { GoogleGeminiProvider } from './google-gemini';
import { OpenAICompatibleProvider } from './openai-compatible';
import {
  AzureOpenAIProvider,
  DeepSeekProvider,
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

export function createBuiltinModelProviders(): ModelProviderRegistry {
  const providers = new ModelProviderRegistry();
  providers.register('openai-compatible', new OpenAICompatibleProvider());
  providers.register('openai', new OpenAIProvider());
  providers.register('anthropic', new AnthropicProvider());
  providers.register('google-gemini', new GoogleGeminiProvider());
  providers.register('openrouter', new OpenRouterProvider());
  providers.register('xai', new XAIProvider());
  providers.register('mistral', new MistralProvider());
  providers.register('deepseek', new DeepSeekProvider());
  providers.register('groq', new GroqProvider());
  providers.register('azure-openai', new AzureOpenAIProvider());
  return providers;
}

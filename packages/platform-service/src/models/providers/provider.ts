import type {
  ChatRequest,
  ChatResponse,
  Model,
  ModelCapabilities,
  ModelFieldMetadata,
  ModelPricing,
  ProviderAccount,
} from '@gamecrafter/contracts';

export interface ProviderRuntimeAccount extends ProviderAccount {
  apiKey?: string;
}

export interface DiscoveredModel {
  providerModelId: string;
  catalogModelId?: string;
  displayName?: string;
  capabilities?: Partial<ModelCapabilities>;
  pricing?: Partial<ModelPricing>;
  fieldMetadata?: Record<string, ModelFieldMetadata>;
  tags?: string[];
  workTypes?: string[];
  roles?: string[];
  metadataSource?: Extract<ModelFieldMetadata['source'], 'provider-api' | 'provider-catalog'>;
  sourceUrl?: string | null;
  confidence?: ModelFieldMetadata['confidence'];
}

export interface ProviderCompletionHooks {
  signal: AbortSignal;
  onDelta?: (delta: string) => void;
}

export interface ModelProvider {
  listModels(account: ProviderRuntimeAccount): Promise<DiscoveredModel[]>;
  complete(
    account: ProviderRuntimeAccount,
    model: Model,
    request: ChatRequest,
    hooks: ProviderCompletionHooks,
  ): Promise<ChatResponse>;
  embed(
    account: ProviderRuntimeAccount,
    model: Model,
    inputs: string[],
  ): Promise<{ vectors: number[][]; usage: ChatResponse['usage'] }>;
}

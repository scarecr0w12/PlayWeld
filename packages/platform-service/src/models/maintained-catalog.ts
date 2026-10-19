import type {
  ModelCapabilities,
  ModelFieldMetadata,
  ModelPricing,
  ProviderKind,
} from '@gamecrafter/contracts';
import type { DiscoveredModel } from './providers/provider';
import {
  rejectPricing,
  rejectedPricingFields,
  TOKEN_PRICE_FIELDS,
} from './providers/pricing-metadata';

export const MAINTAINED_CATALOG_URL = 'https://models.dev/api.json';
const PROVIDERS: Partial<Record<ProviderKind, string>> = {
  openai: 'openai',
  anthropic: 'anthropic',
  'google-gemini': 'google',
  openrouter: 'openrouter',
  xai: 'xai',
  mistral: 'mistral',
  deepseek: 'deepseek',
  groq: 'groq',
};
export interface ModelMetadataEnricher {
  enrich(kind: ProviderKind, models: DiscoveredModel[]): Promise<DiscoveredModel[]>;
}
export interface MaintainedModelCatalogOptions {
  fetch?: typeof globalThis.fetch;
  now?: () => number;
  ttlMs?: number;
  timeoutMs?: number;
  maxBytes?: number;
}
interface Snapshot {
  data: Record<string, unknown>;
  retrievedAt: number;
}

/** Public, third-party metadata only. Account data never enters this client. */
export class MaintainedModelCatalog implements ModelMetadataEnricher {
  private snapshot?: Snapshot;
  private pending?: Promise<void>;
  private retryAt = 0;
  private failed = false;
  private readonly fetcher: typeof globalThis.fetch;
  private readonly now: () => number;
  private readonly ttlMs: number;
  private readonly timeoutMs: number;
  private readonly maxBytes: number;

  constructor(options: MaintainedModelCatalogOptions = {}) {
    this.fetcher = options.fetch ?? ((...args) => globalThis.fetch(...args));
    this.now = options.now ?? Date.now;
    this.ttlMs = options.ttlMs ?? 6 * 60 * 60 * 1000;
    this.timeoutMs = options.timeoutMs ?? 5000;
    this.maxBytes = options.maxBytes ?? 32 * 1024 * 1024;
  }

  async enrich(kind: ProviderKind, models: DiscoveredModel[]): Promise<DiscoveredModel[]> {
    const providerId = PROVIDERS[kind];
    if (!providerId || !models.length) return models;
    if (
      (!this.snapshot || this.now() >= this.snapshot.retrievedAt + this.ttlMs) &&
      this.now() >= this.retryAt
    ) {
      if (!this.pending) {
        this.pending = this.refresh().finally(() => {
          this.pending = undefined;
        });
      }
      await this.pending;
    }
    const snapshot = this.snapshot;
    const warning = this.failed
      ? snapshot
        ? 'Maintained third-party model catalog refresh failed; using cached metadata.'
        : 'Maintained third-party model catalog unavailable; metadata may be incomplete.'
      : undefined;
    const provider = snapshot ? object(snapshot.data[providerId]) : undefined;
    const entries = provider?.id === providerId ? object(provider.models) : undefined;
    return models.map((model) => {
      const candidate = entries ? object(entries[model.providerModelId]) : undefined;
      const result =
        candidate?.id === model.providerModelId && snapshot
          ? merge(model, candidate, snapshot.retrievedAt, this.ttlMs, this.now())
          : { ...model };
      if (warning) result.metadataWarnings = [...(result.metadataWarnings ?? []), warning];
      return result;
    });
  }

  private async refresh(): Promise<void> {
    const controller = new AbortController();
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
      const data = await Promise.race([
        this.load(controller.signal),
        new Promise<never>((_resolve, reject) => {
          timer = setTimeout(() => {
            controller.abort();
            reject(new Error('Catalog timeout'));
          }, this.timeoutMs);
        }),
      ]);
      this.snapshot = { data, retrievedAt: this.now() };
      this.failed = false;
      this.retryAt = 0;
    } catch {
      // Never expose response bodies, network errors, or account identifiers in diagnostics.
      this.failed = true;
      this.retryAt = this.now() + 60_000;
    } finally {
      if (timer) clearTimeout(timer);
    }
  }

  private async load(signal: AbortSignal): Promise<Record<string, unknown>> {
    const response = await this.fetcher(MAINTAINED_CATALOG_URL, {
      signal,
      credentials: 'omit',
      redirect: 'error',
      headers: { accept: 'application/json' },
    });
    if (!response.ok) throw new Error('Catalog HTTP failure');
    const length = Number(response.headers.get('content-length'));
    if (Number.isFinite(length) && length > this.maxBytes) {
      await response.body?.cancel();
      throw new Error('Catalog too large');
    }
    const reader = response.body?.getReader();
    if (!reader) throw new Error('Catalog body missing');
    const decoder = new TextDecoder();
    let size = 0;
    let body = '';
    try {
      for (;;) {
        const chunk = await reader.read();
        if (chunk.done) break;
        size += chunk.value.byteLength;
        if (size > this.maxBytes) throw new Error('Catalog too large');
        body += decoder.decode(chunk.value, { stream: true });
      }
      body += decoder.decode();
    } finally {
      void reader.cancel().catch(() => undefined);
      reader.releaseLock();
    }
    const data = object(JSON.parse(body));
    if (
      !data ||
      !Object.values(data).some((provider) => {
        const value = object(provider);
        return typeof value?.id === 'string' && object(value.models) !== undefined;
      })
    )
      throw new Error('Invalid catalog');
    return data;
  }
}

function merge(
  model: DiscoveredModel,
  entry: Record<string, unknown>,
  retrievedAt: number,
  ttlMs: number,
  now: number,
): DiscoveredModel {
  const result: DiscoveredModel = {
    ...model,
    capabilities: { ...model.capabilities },
    pricing: { ...model.pricing },
    fieldMetadata: { ...model.fieldMetadata },
  };
  const metadata: ModelFieldMetadata = {
    source: 'provider-catalog',
    sourceUrl: MAINTAINED_CATALOG_URL,
    confidence: 'medium',
    updatedAt: new Date(retrievedAt).toISOString(),
    expiresAt: new Date(retrievedAt + ttlMs).toISOString(),
    stale: now >= retrievedAt + ttlMs,
  };
  const capability = (key: keyof ModelCapabilities, value: unknown) => {
    if (value !== undefined && result.capabilities?.[key] == null) {
      (result.capabilities as Record<string, unknown>)[key] = value;
      result.fieldMetadata![`capabilities.${key}`] = { ...metadata };
    }
  };
  if (!result.displayName && typeof entry.name === 'string') {
    result.displayName = entry.name;
    result.fieldMetadata!.displayName = { ...metadata };
  }
  if (typeof entry.tool_call === 'boolean') capability('tools', entry.tool_call);
  if (typeof entry.structured_output === 'boolean')
    capability('structuredOutput', entry.structured_output);
  const modalities = object(entry.modalities);
  if (Array.isArray(modalities?.input)) capability('vision', modalities.input.includes('image'));
  // Text output alone also describes transcription/TTS models; require text input and text output.
  if (
    entry.type === 'chat' ||
    (entry.type === undefined &&
      Array.isArray(modalities?.input) &&
      modalities.input.includes('text') &&
      Array.isArray(modalities.output) &&
      modalities.output.includes('text'))
  )
    capability('chat', true);
  if (entry.type === 'embedding') {
    capability('embeddings', true);
    capability('chat', false);
  }
  const limit = object(entry.limit);
  for (const [key, source] of [
    ['contextWindow', 'context'],
    ['maxInputTokens', 'input'],
    ['maxOutputTokens', 'output'],
  ] as const) {
    const value = limit?.[source];
    if (typeof value === 'number' && Number.isSafeInteger(value) && value > 0)
      capability(key, value);
  }
  const cost = object(entry.cost);
  if (cost && (cost.tiers !== undefined || cost.context_over_200k !== undefined)) {
    result.metadataWarnings = [
      ...(result.metadataWarnings ?? []),
      'Maintained third-party catalog has tiered pricing that cannot be represented as a flat token rate; pricing remains unknown.',
    ];
  }
  // Flat text prices cannot represent context tiers. Zero catalog prices may be placeholders.
  if (
    cost &&
    (cost.currency === undefined || cost.currency === 'USD') &&
    cost.tiers === undefined &&
    cost.context_over_200k === undefined
  ) {
    for (const [key, source] of [
      ['inputPerMTokUsd', 'input'],
      ['outputPerMTokUsd', 'output'],
    ] as const satisfies readonly (readonly [keyof ModelPricing, string])[]) {
      const value = cost[source];
      if (
        typeof value === 'number' &&
        Number.isFinite(value) &&
        value > 0 &&
        !model.unsupportedPricingFields?.includes(key) &&
        result.pricing?.[key] == null
      ) {
        result.pricing![key] = value;
        result.fieldMetadata![`pricing.${key}`] = { ...metadata };
      }
    }
  }
  if (!Object.keys(result.capabilities!).length) delete result.capabilities;
  if (!Object.keys(result.pricing!).length) delete result.pricing;
  const rejected = rejectedPricingFields(cost, ['input', 'output']);
  for (const [index, key] of ['input', 'output'].entries()) {
    if (cost?.[key] === 0) rejected.push(TOKEN_PRICE_FIELDS[index]);
  }
  const catalogRejected = rejected.filter(
    (key) => model.pricing?.[key] == null && !model.unsupportedPricingFields?.includes(key),
  );
  const merged = rejectPricing(result, catalogRejected);
  for (const key of catalogRejected) merged.fieldMetadata![`pricing.${key}`] = { ...metadata };
  return merged;
}
function object(value: unknown): Record<string, unknown> | undefined {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : undefined;
}

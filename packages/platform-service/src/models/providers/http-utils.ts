import {
  RpcError,
  RpcErrorCode,
  redact,
  type Model,
  type ModelUsage,
} from '@gamecrafter/contracts';
import type { ProviderRuntimeAccount } from './provider';

export function endpoint(baseUrl: string, suffix: string): string {
  return `${baseUrl.replace(/\/+$/, '')}/${suffix.replace(/^\/+/, '')}`;
}

export function providerHeaders(
  account: ProviderRuntimeAccount,
  overrides: Record<string, string> = {},
): Headers {
  const headers = new Headers(account.headers);
  for (const [name, value] of Object.entries(overrides)) headers.set(name, value);
  if (account.apiKey && !headers.has('authorization') && !headers.has('x-api-key')) {
    headers.set('authorization', `Bearer ${account.apiKey}`);
  }
  return headers;
}

export async function providerFetch(
  account: ProviderRuntimeAccount,
  url: string,
  init: RequestInit = {},
): Promise<Response> {
  const headers = providerHeaders(account, Object.fromEntries(new Headers(init.headers).entries()));
  try {
    const response = await fetch(url, { ...init, headers });
    if (!response.ok) {
      const body = await response.text();
      throw providerError(account, `HTTP ${response.status}`, response.status, body);
    }
    return response;
  } catch (error) {
    if (error instanceof RpcError || (error instanceof Error && error.name === 'AbortError')) {
      throw error;
    }
    throw providerError(account, error instanceof Error ? error.message : String(error), null, '');
  }
}

export async function providerJson<T>(
  account: ProviderRuntimeAccount,
  url: string,
  init: RequestInit = {},
): Promise<T> {
  const response = await providerFetch(account, url, init);
  try {
    return (await response.json()) as T;
  } catch (error) {
    throw providerError(
      account,
      `Invalid JSON response: ${error instanceof Error ? error.message : String(error)}`,
      response.status,
      '',
    );
  }
}

export function modelCost(
  model: Model,
  inputTokens: number | undefined,
  outputTokens: number | undefined,
  cacheReadInputTokens = 0,
  cacheCreationInputTokens = 0,
): { costUsd: number | null; costStatus: 'known' | 'partial' | 'unknown' } {
  const inputRate = model.pricing.inputPerMTokUsd;
  const outputRate = model.pricing.outputPerMTokUsd;
  const regularInputTokens =
    inputTokens === undefined
      ? undefined
      : Math.max(0, inputTokens - cacheReadInputTokens - cacheCreationInputTokens);
  const pricedInput =
    inputRate === null || regularInputTokens === undefined ? null : inputRate * regularInputTokens;
  const pricedOutput =
    outputRate === null || outputTokens === undefined ? null : outputRate * outputTokens;
  const hasUnpricedUsage =
    regularInputTokens === undefined ||
    outputTokens === undefined ||
    (inputRate === null && regularInputTokens > 0) ||
    (outputRate === null && outputTokens > 0) ||
    cacheReadInputTokens > 0 ||
    cacheCreationInputTokens > 0;
  const hasPricedUsage =
    (regularInputTokens !== undefined && inputRate !== null) ||
    (outputTokens !== undefined && outputRate !== null);
  if (hasUnpricedUsage && !hasPricedUsage) return { costUsd: null, costStatus: 'unknown' };
  return {
    costUsd: ((pricedInput ?? 0) + (pricedOutput ?? 0)) / 1_000_000,
    costStatus: hasUnpricedUsage ? 'partial' : 'known',
  };
}

export function modelUsage(
  model: Model,
  inputTokens: number | undefined,
  outputTokens: number | undefined,
  cacheReadInputTokens = 0,
  cacheCreationInputTokens = 0,
): ModelUsage {
  const cost = modelCost(
    model,
    inputTokens,
    outputTokens,
    cacheReadInputTokens,
    cacheCreationInputTokens,
  );
  return {
    inputTokens: inputTokens ?? 0,
    outputTokens: outputTokens ?? 0,
    cacheReadInputTokens,
    cacheCreationInputTokens,
    ...cost,
  };
}

export function optionalUsageCount(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0 ? value : undefined;
}

export function safeExcerpt(body: string, credential?: string): string {
  let excerpt = body;
  if (credential) excerpt = excerpt.replaceAll(credential, '[REDACTED]');
  excerpt = excerpt
    .replace(/(bearer\s+)[A-Za-z0-9._~+/-]+=*/gi, '$1[REDACTED]')
    .replace(
      /((?:api[-_]?key|token|secret|password|authorization)\s*[:=]\s*)[^\s,;}]+/gi,
      '$1[REDACTED]',
    )
    .replace(/(?:sk|ghp|xox[abp]|AKIA)[A-Za-z0-9_-]{16,}/g, '[REDACTED]')
    .replace(/[A-Fa-f0-9]{40,}/g, '[REDACTED]');
  return excerpt.slice(0, 512);
}

function providerError(
  account: ProviderRuntimeAccount,
  reason: string,
  status: number | null,
  body: string,
): RpcError {
  const excerpt = safeExcerpt(body, account.apiKey);
  const detail = excerpt ? `: ${excerpt}` : '';
  return new RpcError(
    `Provider request failed${status === null ? '' : ` (HTTP ${status})`}: ${reason}${detail}`,
    RpcErrorCode.ProviderRequestFailed,
    { status, body: redact(excerpt) },
  );
}

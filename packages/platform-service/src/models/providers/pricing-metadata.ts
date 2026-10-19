import type { ModelFieldMetadata, ModelPricing } from '@gamecrafter/contracts';
import type { DiscoveredModel } from './provider';

export const TOKEN_PRICE_FIELDS: (keyof ModelPricing)[] = ['inputPerMTokUsd', 'outputPerMTokUsd'];

/** Explicit incompatible terms are different from an absent field eligible for fallback. */
export function rejectedPricingFields(
  value: unknown,
  keys: readonly [string, string] = ['inputPerMTokUsd', 'outputPerMTokUsd'],
  decimalStrings = false,
): (keyof ModelPricing)[] {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return [];
  const pricing = value as Record<string, unknown>;
  if (
    (pricing.currency !== undefined && pricing.currency !== 'USD') ||
    pricing.tiers !== undefined ||
    pricing.context_over_200k !== undefined
  )
    return [...TOKEN_PRICE_FIELDS];
  return TOKEN_PRICE_FIELDS.filter((_field, index) => {
    const rate = pricing[keys[index]];
    if (rate === undefined || rate === null) return false;
    const number =
      decimalStrings && typeof rate === 'string' && rate.trim() !== '' ? Number(rate) : rate;
    return typeof number !== 'number' || !Number.isFinite(number) || number < 0;
  });
}

export function rejectPricing(
  model: DiscoveredModel,
  fields: (keyof ModelPricing)[],
  metadata?: ModelFieldMetadata,
): DiscoveredModel {
  fields = [...new Set([...(model.unsupportedPricingFields ?? []), ...fields])];
  if (!fields.length) return model;
  const result = {
    ...model,
    unsupportedPricingFields: [...new Set([...(model.unsupportedPricingFields ?? []), ...fields])],
    metadataWarnings: [
      ...(model.metadataWarnings ?? []),
      'Explicit pricing terms cannot be represented as flat USD per million token rates; affected prices remain unknown.',
    ],
  };
  if (result.pricing) {
    result.pricing = { ...result.pricing };
    for (const field of fields) delete result.pricing[field];
    if (!Object.keys(result.pricing).length) delete result.pricing;
  }
  result.fieldMetadata = { ...result.fieldMetadata };
  for (const field of fields)
    result.fieldMetadata[`pricing.${field}`] = metadata ??
      result.fieldMetadata[`pricing.${field}`] ?? {
        source: model.metadataSource ?? 'provider-api',
        sourceUrl: model.sourceUrl ?? null,
        confidence: model.confidence ?? 'high',
        updatedAt: new Date().toISOString(),
      };
  return result;
}

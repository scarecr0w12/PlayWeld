import { RpcError, RpcErrorCode, type ChatMessage, type ChatRequest } from '@gamecrafter/contracts';

export interface AgentModelContext {
  selectionId: string;
  modelId: string;
  contextWindow: number | null;
  maxOutputTokens: number | null;
  inputLimit: number | null;
}

export function modelContext(value: unknown, explicitCeiling?: unknown): AgentModelContext {
  const data = value as Record<string, unknown> | undefined;
  if (!data || typeof data.selectionId !== 'string' || typeof data.modelId !== 'string')
    throw new RpcError(
      'Agent model selection did not return model metadata.',
      RpcErrorCode.ProviderRequestFailed,
    );
  const contextWindow = positive(data.contextWindow);
  const maxOutputTokens = positive(data.maxOutputTokens);
  let inputLimit = contextWindow === null ? null : contextWindow - (maxOutputTokens ?? 0);
  if (inputLimit !== null && inputLimit < 1)
    throw new RpcError(
      `Model ${data.modelId} has inconsistent context/output capacity metadata. Refresh its model metadata.`,
      RpcErrorCode.InvalidParams,
    );
  const ceiling = positive(explicitCeiling);
  const reportedInput = positive(data.maxInputTokens);
  if (reportedInput !== null)
    inputLimit = inputLimit === null ? reportedInput : Math.min(inputLimit, reportedInput);
  if (ceiling !== null) inputLimit = inputLimit === null ? ceiling : Math.min(inputLimit, ceiling);
  return {
    selectionId: data.selectionId,
    modelId: data.modelId,
    contextWindow,
    maxOutputTokens,
    inputLimit,
  };
}

export function estimateRequestTokens(
  messages: ChatMessage[],
  tools: ChatRequest['tools'] = [],
): number {
  // An estimate, not a tokenizer result. Include the same messages and tool
  // schemas both when deciding to compact and when validating the final input.
  return Math.ceil(JSON.stringify({ messages, tools }).length / 3);
}

function positive(value: unknown): number | null {
  return typeof value === 'number' && Number.isSafeInteger(value) && value > 0 ? value : null;
}

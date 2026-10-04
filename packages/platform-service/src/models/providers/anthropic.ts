import {
  RpcError,
  RpcErrorCode,
  type ChatMessage,
  type ChatRequest,
  type ChatResponse,
  type Model,
} from '@gamecrafter/contracts';
import type {
  DiscoveredModel,
  ModelProvider,
  ProviderCompletionHooks,
  ProviderRuntimeAccount,
} from './provider';
import {
  endpoint,
  modelUsage,
  optionalUsageCount,
  providerFetch,
  providerJson,
  safeExcerpt,
} from './http-utils';

interface AnthropicModelList {
  data?: Record<string, unknown>[];
}

interface AnthropicMessage {
  content?: Record<string, unknown>[];
  stop_reason?: string | null;
  usage?: {
    input_tokens?: number;
    output_tokens?: number;
    cache_read_input_tokens?: number;
    cache_creation_input_tokens?: number;
  };
}

export class AnthropicProvider implements ModelProvider {
  async listModels(account: ProviderRuntimeAccount): Promise<DiscoveredModel[]> {
    const response = await providerJson<AnthropicModelList>(
      account,
      endpoint(account.baseUrl, 'v1/models'),
      { method: 'GET', headers: this.headers(account) },
    );
    if (!Array.isArray(response.data)) return [];
    return response.data
      .filter((entry) => typeof entry.id === 'string')
      .map((entry) => ({
        providerModelId: String(entry.id),
        ...(typeof entry.display_name === 'string' ? { displayName: entry.display_name } : {}),
        capabilities: {
          ...pickCapabilities(objectValue(entry.capabilities) ? entry.capabilities : {}),
          ...(typeof entry.max_input_tokens === 'number'
            ? { maxInputTokens: entry.max_input_tokens }
            : {}),
          ...(typeof entry.max_tokens === 'number' ? { maxOutputTokens: entry.max_tokens } : {}),
        },
        ...(objectValue(entry.pricing)
          ? { pricing: pickPricing(entry.pricing as Record<string, unknown>) }
          : {}),
      }));
  }

  async complete(
    account: ProviderRuntimeAccount,
    model: Model,
    request: ChatRequest,
    hooks: ProviderCompletionHooks,
  ): Promise<ChatResponse> {
    return request.stream
      ? this.completeStream(account, model, request, hooks)
      : this.completeJson(account, model, request, hooks);
  }

  async embed(
    _account: ProviderRuntimeAccount,
    _model: Model,
    _inputs: string[],
  ): Promise<{ vectors: number[][]; usage: ChatResponse['usage'] }> {
    void _account;
    void _model;
    void _inputs;
    throw new RpcError(
      'Anthropic does not provide an embeddings API through this adapter',
      RpcErrorCode.ProviderUnsupportedFeature,
    );
  }

  private async completeJson(
    account: ProviderRuntimeAccount,
    model: Model,
    request: ChatRequest,
    hooks: ProviderCompletionHooks,
  ): Promise<ChatResponse> {
    const startedAt = Date.now();
    const response = await providerJson<AnthropicMessage>(
      account,
      endpoint(account.baseUrl, 'v1/messages'),
      {
        method: 'POST',
        headers: this.headers(account),
        body: JSON.stringify(this.requestBody(model, request, false)),
        signal: hooks.signal,
      },
    );
    const content = Array.isArray(response.content) ? response.content : [];
    const text = content
      .filter((block) => block.type === 'text' && typeof block.text === 'string')
      .map((block) => String(block.text))
      .join('');
    const baseInputTokens = optionalUsageCount(response.usage?.input_tokens);
    const cacheReadInputTokens = optionalUsageCount(response.usage?.cache_read_input_tokens) ?? 0;
    const cacheCreationInputTokens =
      optionalUsageCount(response.usage?.cache_creation_input_tokens) ?? 0;
    return {
      content: text,
      toolCalls: content
        .filter((block) => block.type === 'tool_use')
        .map((block) => ({
          id: String(block.id ?? ''),
          name: String(block.name ?? ''),
          arguments: JSON.stringify(block.input ?? {}),
        })),
      finishReason: finishReason(response.stop_reason),
      usage: modelUsage(
        model,
        baseInputTokens === undefined
          ? undefined
          : baseInputTokens + cacheReadInputTokens + cacheCreationInputTokens,
        optionalUsageCount(response.usage?.output_tokens),
        cacheReadInputTokens,
        cacheCreationInputTokens,
      ),
      latencyMs: Date.now() - startedAt,
      modelId: model.modelId,
      decisionId: null,
    };
  }

  private async completeStream(
    account: ProviderRuntimeAccount,
    model: Model,
    request: ChatRequest,
    hooks: ProviderCompletionHooks,
  ): Promise<ChatResponse> {
    const startedAt = Date.now();
    const response = await providerFetch(account, endpoint(account.baseUrl, 'v1/messages'), {
      method: 'POST',
      headers: this.headers(account),
      body: JSON.stringify(this.requestBody(model, request, true)),
      signal: hooks.signal,
    });
    if (!response.body) {
      throw new RpcError(
        'Provider streaming response had no body',
        RpcErrorCode.ProviderRequestFailed,
      );
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    const toolCalls = new Map<number, { id: string; name: string; arguments: string }>();
    let buffer = '';
    let content = '';
    let stopReason: string | null = null;
    let inputTokens: number | undefined;
    let outputTokens: number | undefined;
    let cacheReadInputTokens = 0;
    let cacheCreationInputTokens = 0;
    let done = false;

    const consumeEvent = (eventText: string) => {
      const eventName = eventText
        .split(/\r?\n/)
        .find((line) => line.startsWith('event:'))
        ?.slice(6)
        .trim();
      const data = eventText
        .split(/\r?\n/)
        .filter((line) => line.startsWith('data:'))
        .map((line) => line.slice(5).trimStart())
        .join('\n');
      if (!data) return;
      let event: Record<string, unknown>;
      try {
        event = JSON.parse(data) as Record<string, unknown>;
      } catch {
        throw new RpcError('Provider sent invalid SSE JSON', RpcErrorCode.ProviderRequestFailed);
      }
      const type = String(event.type ?? eventName ?? '');
      if (type === 'message_start' && objectValue(event.message)) {
        const usage = objectValue(event.message.usage) ? event.message.usage : {};
        cacheReadInputTokens =
          optionalUsageCount(usage.cache_read_input_tokens) ?? cacheReadInputTokens;
        cacheCreationInputTokens =
          optionalUsageCount(usage.cache_creation_input_tokens) ?? cacheCreationInputTokens;
        const baseInputTokens = optionalUsageCount(usage.input_tokens);
        if (baseInputTokens !== undefined) {
          inputTokens = baseInputTokens + cacheReadInputTokens + cacheCreationInputTokens;
        }
      }
      if (type === 'content_block_start') {
        const block = objectValue(event.content_block) ? event.content_block : {};
        if (block.type === 'tool_use') {
          const index = numericValue(event.index, 0);
          toolCalls.set(index, {
            id: String(block.id ?? ''),
            name: String(block.name ?? ''),
            arguments: JSON.stringify(block.input ?? {}),
          });
        }
      }
      if (type === 'content_block_delta' && objectValue(event.delta)) {
        const delta = event.delta;
        if (delta.type === 'text_delta' && typeof delta.text === 'string') {
          content += delta.text;
          hooks.onDelta?.(delta.text);
        } else if (delta.type === 'input_json_delta' && typeof delta.partial_json === 'string') {
          const index = numericValue(event.index, 0);
          const toolCall = toolCalls.get(index) ?? { id: '', name: '', arguments: '' };
          toolCall.arguments =
            toolCall.arguments === '{}'
              ? delta.partial_json
              : toolCall.arguments + delta.partial_json;
          toolCalls.set(index, toolCall);
        }
      }
      if (type === 'message_delta') {
        const delta = objectValue(event.delta) ? event.delta : {};
        if (typeof delta.stop_reason === 'string') stopReason = delta.stop_reason;
        const usage = objectValue(event.usage) ? event.usage : {};
        outputTokens = optionalUsageCount(usage.output_tokens) ?? outputTokens;
      }
      if (type === 'error' && objectValue(event.error)) {
        throw new RpcError(
          `Provider stream failed: ${safeExcerpt(String(event.error.message ?? 'unknown error'), account.apiKey)}`,
          RpcErrorCode.ProviderRequestFailed,
        );
      }
    };

    try {
      while (!done) {
        const chunk = await reader.read();
        done = chunk.done;
        buffer += decoder.decode(chunk.value ?? new Uint8Array(), { stream: !done });
        const events = buffer.split(/\r?\n\r?\n/);
        buffer = events.pop() ?? '';
        for (const event of events) consumeEvent(event);
      }
      if (buffer.trim()) consumeEvent(buffer);
    } finally {
      reader.releaseLock();
    }

    const calls = [...toolCalls.values()].map((toolCall) => ({
      id: toolCall.id,
      name: toolCall.name,
      arguments: toolCall.arguments || '{}',
    }));
    return {
      content,
      toolCalls: calls,
      finishReason: finishReason(stopReason),
      usage: modelUsage(
        model,
        inputTokens,
        outputTokens,
        cacheReadInputTokens,
        cacheCreationInputTokens,
      ),
      latencyMs: Date.now() - startedAt,
      modelId: model.modelId,
      decisionId: null,
    };
  }

  private requestBody(
    model: Model,
    request: ChatRequest,
    stream: boolean,
  ): Record<string, unknown> {
    const outputLimit = request.maxTokens ?? model.capabilities.maxOutputTokens;
    if (!outputLimit || outputLimit < 1)
      throw new RpcError(
        `Model ${model.providerModelId} has no reported output capacity. Refresh its model metadata or explicitly supply maxTokens; Anthropic requires max_tokens.`,
        RpcErrorCode.InvalidParams,
      );
    const systemMessages = request.messages
      .filter((message) => message.role === 'system')
      .map((message) => message.content);
    if (request.responseFormat?.type === 'json_schema') {
      systemMessages.push(
        `Respond with JSON that conforms to this schema: ${JSON.stringify(request.responseFormat.schema)}`,
      );
    }
    return {
      model: model.providerModelId,
      max_tokens: outputLimit,
      messages: request.messages
        .filter((message) => message.role !== 'system')
        .map(anthropicMessage),
      ...(systemMessages.length ? { system: systemMessages.join('\n\n') } : {}),
      ...(request.temperature === undefined ? {} : { temperature: request.temperature }),
      ...(request.tools
        ? {
            tools: request.tools.map((tool) => ({
              name: tool.name,
              description: tool.description,
              input_schema: tool.inputSchema,
            })),
          }
        : {}),
      ...(stream ? { stream: true } : {}),
    };
  }

  private headers(account: ProviderRuntimeAccount): Record<string, string> {
    return {
      'content-type': 'application/json',
      'anthropic-version': '2023-06-01',
      ...(account.apiKey ? { 'x-api-key': account.apiKey } : {}),
    };
  }
}

function anthropicMessage(message: ChatMessage): Record<string, unknown> {
  if (message.role === 'tool') {
    return {
      role: 'user',
      content: [
        { type: 'tool_result', tool_use_id: message.toolCallId ?? '', content: message.content },
      ],
    };
  }
  if (message.role === 'assistant' && message.toolCalls?.length) {
    return {
      role: 'assistant',
      content: [
        ...(message.content ? [{ type: 'text', text: message.content }] : []),
        ...message.toolCalls.map((toolCall) => ({
          type: 'tool_use',
          id: toolCall.id,
          name: toolCall.name,
          input: parseArguments(toolCall.arguments),
        })),
      ],
    };
  }
  return { role: message.role, content: message.content };
}

function parseArguments(value: string): unknown {
  try {
    return JSON.parse(value);
  } catch {
    return {};
  }
}

function finishReason(value: unknown): ChatResponse['finishReason'] {
  if (value === 'max_tokens') return 'length';
  if (value === 'tool_use') return 'tool_calls';
  return 'stop';
}

function pickCapabilities(value: Record<string, unknown>): Partial<Model['capabilities']> {
  const result: Partial<Model['capabilities']> = {};
  for (const key of [
    'chat',
    'tools',
    'vision',
    'structuredOutput',
    'streaming',
    'embeddings',
  ] as const) {
    if (typeof value[key] === 'boolean') result[key] = value[key];
  }
  for (const key of ['contextWindow', 'maxInputTokens', 'maxOutputTokens'] as const) {
    if (typeof value[key] === 'number' || value[key] === null)
      result[key] = value[key] as number | null;
  }
  return result;
}

function pickPricing(value: Record<string, unknown>): Partial<Model['pricing']> {
  return {
    ...(typeof value.inputPerMTokUsd === 'number' || value.inputPerMTokUsd === null
      ? { inputPerMTokUsd: value.inputPerMTokUsd }
      : {}),
    ...(typeof value.outputPerMTokUsd === 'number' || value.outputPerMTokUsd === null
      ? { outputPerMTokUsd: value.outputPerMTokUsd }
      : {}),
  };
}

function objectValue(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function numericValue(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

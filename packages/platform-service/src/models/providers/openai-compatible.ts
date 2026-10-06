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
import { providerToolNames } from './tool-names';
import { OpenAIResponses } from './openai-responses';

interface OpenAIModelList {
  data?: Record<string, unknown>[];
  models?: Record<string, unknown>[];
}

interface OpenAIChatResponse {
  choices?: {
    message?: Record<string, unknown>;
    finish_reason?: string | null;
  }[];
  usage?: {
    prompt_tokens?: number;
    completion_tokens?: number;
    prompt_tokens_details?: { cached_tokens?: number };
  };
}

export interface OpenAICompatibleProviderOptions {
  /** Only first-party OpenAI may negotiate the Responses endpoint. */
  toolResponsesFallback?: boolean;
  defaultBaseUrl?: string;
  modelsPath?: (account: ProviderRuntimeAccount) => string;
  chatPath?: (account: ProviderRuntimeAccount, model: Model) => string;
  embeddingsPath?: (account: ProviderRuntimeAccount, model: Model) => string;
  headers?: (account: ProviderRuntimeAccount) => Record<string, string>;
  parseModels?: (
    entries: Record<string, unknown>[],
    account: ProviderRuntimeAccount,
  ) => DiscoveredModel[];
  supportsEmbeddings?: boolean;
  mapChatRequest?: (
    account: ProviderRuntimeAccount,
    model: Model,
    body: Record<string, unknown>,
  ) => Record<string, unknown>;
}

export class OpenAICompatibleProvider implements ModelProvider {
  private readonly completionTokenModels = new Set<string>();
  private readonly toolReasoningNoneModels = new Set<string>();
  private readonly responsesModels = new Set<string>();
  private readonly responses = new OpenAIResponses();

  constructor(private readonly options: OpenAICompatibleProviderOptions = {}) {}

  async listModels(account: ProviderRuntimeAccount): Promise<DiscoveredModel[]> {
    const response = await providerJson<OpenAIModelList>(
      account,
      endpoint(this.baseUrl(account), this.options.modelsPath?.(account) ?? 'models'),
      { method: 'GET', headers: this.headers(account) },
    );
    const entries = Array.isArray(response.data)
      ? response.data
      : Array.isArray(response.models)
        ? response.models
        : [];
    return (
      this.options.parseModels?.(entries, account) ??
      entries
        .filter((entry) => typeof entry.id === 'string')
        .map((entry) => ({
          providerModelId: String(entry.id),
          ...(typeof entry.display_name === 'string'
            ? { displayName: entry.display_name }
            : typeof entry.name === 'string'
              ? { displayName: entry.name }
              : {}),
          capabilities: {
            ...pickCapabilities(objectValue(entry.capabilities) ? entry.capabilities : {}),
            ...(typeof entry.context_length === 'number'
              ? { contextWindow: entry.context_length }
              : {}),
            ...(objectValue(entry.top_provider) &&
            typeof entry.top_provider.max_completion_tokens === 'number'
              ? { maxOutputTokens: entry.top_provider.max_completion_tokens }
              : {}),
          },
          ...(objectValue(entry.pricing)
            ? { pricing: pickPricing(entry.pricing as Record<string, unknown>) }
            : {}),
        }))
    );
  }

  async complete(
    account: ProviderRuntimeAccount,
    model: Model,
    request: ChatRequest,
    hooks: ProviderCompletionHooks,
  ): Promise<ChatResponse> {
    const names = providerToolNames(request);
    const key = JSON.stringify([account.accountId, account.baseUrl, model.providerModelId]);
    const eligible = this.responsesEligible(account) && (request.tools?.length ?? 0) > 0;
    let response: ChatResponse;
    if (eligible && this.responsesModels.has(key)) {
      response = await this.responses.complete(account, model, names.request, hooks);
    } else {
      try {
        response = await (request.stream
          ? this.completeStream(account, model, names.request, hooks)
          : this.completeJson(account, model, names.request, hooks));
      } catch (error) {
        if (!eligible || !requiresToolReasoningNone(error)) throw error;
        response = await this.responses.complete(account, model, names.request, hooks);
        if (this.responsesModels.size >= 512) this.responsesModels.clear();
        this.responsesModels.add(key);
      }
    }
    return {
      ...response,
      toolCalls: response.toolCalls.map((call) => ({ ...call, name: names.decode(call.name) })),
    };
  }

  async embed(
    account: ProviderRuntimeAccount,
    model: Model,
    inputs: string[],
  ): Promise<{ vectors: number[][]; usage: ChatResponse['usage'] }> {
    if (this.options.supportsEmbeddings === false) {
      throw new RpcError(
        'This provider adapter does not expose an embeddings API',
        RpcErrorCode.ProviderUnsupportedFeature,
      );
    }
    const response = await providerJson<{
      data?: { embedding?: number[]; index?: number }[];
      usage?: { prompt_tokens?: number };
    }>(
      account,
      endpoint(
        this.baseUrl(account),
        this.options.embeddingsPath?.(account, model) ?? 'embeddings',
      ),
      {
        method: 'POST',
        headers: { ...this.headers(account), 'content-type': 'application/json' },
        body: JSON.stringify({ model: model.providerModelId, input: inputs }),
      },
    );
    if (!Array.isArray(response.data)) {
      throw new RpcError(
        'Provider embedding response did not contain vectors',
        RpcErrorCode.ProviderRequestFailed,
      );
    }
    const vectors = [...response.data]
      .sort((left, right) => (left.index ?? 0) - (right.index ?? 0))
      .map((item) => item.embedding ?? []);
    return {
      vectors,
      usage: modelUsage(model, optionalUsageCount(response.usage?.prompt_tokens), 0),
    };
  }

  private async completeJson(
    account: ProviderRuntimeAccount,
    model: Model,
    request: ChatRequest,
    hooks: ProviderCompletionHooks,
  ): Promise<ChatResponse> {
    const startedAt = Date.now();
    const response = await this.sendChat(account, model, this.requestBody(model, request), (body) =>
      providerJson<OpenAIChatResponse>(
        account,
        endpoint(
          this.baseUrl(account),
          this.options.chatPath?.(account, model) ?? 'chat/completions',
        ),
        {
          method: 'POST',
          headers: { ...this.headers(account), 'content-type': 'application/json' },
          body: JSON.stringify(body),
          signal: hooks.signal,
        },
      ),
    );
    const choice = response.choices?.[0];
    if (!choice || !choice.message) {
      throw new RpcError(
        'Provider chat response did not contain a message',
        RpcErrorCode.ProviderRequestFailed,
      );
    }
    const message = choice.message;
    const inputTokens = optionalUsageCount(response.usage?.prompt_tokens);
    const outputTokens = optionalUsageCount(response.usage?.completion_tokens);
    const promptDetails = objectValue(response.usage?.prompt_tokens_details)
      ? response.usage.prompt_tokens_details
      : {};
    return {
      content: contentText(message.content),
      toolCalls: openAiToolCalls(message.tool_calls),
      finishReason: finishReason(choice.finish_reason),
      usage: modelUsage(
        model,
        inputTokens,
        outputTokens,
        optionalUsageCount(promptDetails.cached_tokens) ?? 0,
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
    const body = {
      ...this.requestBody(model, request),
      stream: true,
      stream_options: { include_usage: true },
    };
    const response = await this.sendChat(account, model, body, (wireBody) =>
      providerFetch(
        account,
        endpoint(
          this.baseUrl(account),
          this.options.chatPath?.(account, model) ?? 'chat/completions',
        ),
        {
          method: 'POST',
          headers: { ...this.headers(account), 'content-type': 'application/json' },
          body: JSON.stringify(wireBody),
          signal: hooks.signal,
        },
      ),
    );
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
    let finish = 'stop';
    let inputTokens: number | undefined;
    let outputTokens: number | undefined;
    let cacheReadInputTokens = 0;
    let done = false;

    const consumeEvent = (event: string) => {
      const data = event
        .split(/\r?\n/)
        .filter((line) => line.startsWith('data:'))
        .map((line) => line.slice(5).trimStart())
        .join('\n');
      if (!data || data === '[DONE]') return;
      let chunk: Record<string, unknown>;
      try {
        chunk = JSON.parse(data) as Record<string, unknown>;
      } catch {
        throw new RpcError('Provider sent invalid SSE JSON', RpcErrorCode.ProviderRequestFailed);
      }
      if (objectValue(chunk.error)) {
        throw new RpcError(
          `Provider stream failed: ${safeExcerpt(String(chunk.error.message ?? 'unknown error'), account.apiKey)}`,
          RpcErrorCode.ProviderRequestFailed,
        );
      }
      const usage = objectValue(chunk.usage) ? (chunk.usage as Record<string, unknown>) : undefined;
      inputTokens = optionalUsageCount(usage?.prompt_tokens) ?? inputTokens;
      outputTokens = optionalUsageCount(usage?.completion_tokens) ?? outputTokens;
      const promptDetails = objectValue(usage?.prompt_tokens_details)
        ? (usage.prompt_tokens_details as Record<string, unknown>)
        : undefined;
      cacheReadInputTokens =
        optionalUsageCount(promptDetails?.cached_tokens) ?? cacheReadInputTokens;
      const choices = Array.isArray(chunk.choices) ? chunk.choices : [];
      const choice = objectValue(choices[0]) ? (choices[0] as Record<string, unknown>) : undefined;
      if (!choice) return;
      if (typeof choice.finish_reason === 'string') finish = choice.finish_reason;
      const delta = objectValue(choice.delta) ? (choice.delta as Record<string, unknown>) : {};
      if (typeof delta.content === 'string' && delta.content.length > 0) {
        content += delta.content;
        hooks.onDelta?.(delta.content);
      }
      if (Array.isArray(delta.tool_calls)) {
        for (const rawCall of delta.tool_calls) {
          if (!objectValue(rawCall)) continue;
          const index = numericValue(rawCall.index, 0);
          const current = toolCalls.get(index) ?? { id: '', name: '', arguments: '' };
          const functionValue = objectValue(rawCall.function)
            ? (rawCall.function as Record<string, unknown>)
            : {};
          if (typeof rawCall.id === 'string') current.id += rawCall.id;
          if (typeof functionValue.name === 'string') current.name += functionValue.name;
          if (typeof functionValue.arguments === 'string')
            current.arguments += functionValue.arguments;
          toolCalls.set(index, current);
        }
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
      finishReason: finishReason(finish),
      usage: modelUsage(model, inputTokens, outputTokens, cacheReadInputTokens),
      latencyMs: Date.now() - startedAt,
      modelId: model.modelId,
      decisionId: null,
    };
  }

  private async sendChat<T>(
    account: ProviderRuntimeAccount,
    model: Model,
    body: Record<string, unknown>,
    send: (body: Record<string, unknown>) => Promise<T>,
  ): Promise<T> {
    const key = JSON.stringify([account.accountId, account.baseUrl, model.providerModelId]);
    const hasLimit = typeof body.max_tokens === 'number';
    const hasTools = Array.isArray(body.tools) && body.tools.length > 0;
    let modernLimit = hasLimit && this.completionTokenModels.has(key);
    let reasoningNone = hasTools && this.toolReasoningNoneModels.has(key);
    // At most one negotiation for each of the two explicitly rejected fields.
    for (let attempt = 0; ; attempt++) {
      const wireBody = { ...body };
      if (modernLimit) {
        delete wireBody.max_tokens;
        wireBody.max_completion_tokens = body.max_tokens;
      }
      if (reasoningNone) wireBody.reasoning_effort = 'none';
      try {
        const result = await send(
          this.options.mapChatRequest?.(account, model, wireBody) ?? wireBody,
        );
        if (modernLimit) this.completionTokenModels.add(key);
        if (reasoningNone) this.toolReasoningNoneModels.add(key);
        return result;
      } catch (error) {
        // Rejected HTTP requests only; successful streams are consumed by the caller.
        if (hasTools && this.responsesEligible(account) && requiresToolReasoningNone(error))
          throw error;
        if (attempt >= 2) throw error;
        if (hasLimit && !modernLimit && requiresCompletionTokens(error)) modernLimit = true;
        else if (hasTools && !reasoningNone && requiresToolReasoningNone(error))
          reasoningNone = true;
        else throw error;
      }
    }
  }

  protected requestBody(model: Model, request: ChatRequest): Record<string, unknown> {
    return {
      model: model.providerModelId,
      messages: request.messages.map(openAiMessage),
      ...(request.maxTokens === undefined ? {} : { max_tokens: request.maxTokens }),
      ...(request.temperature === undefined ? {} : { temperature: request.temperature }),
      ...(request.tools
        ? {
            tools: request.tools.map((tool) => ({
              type: 'function',
              function: {
                name: tool.name,
                description: tool.description,
                parameters: tool.inputSchema,
              },
            })),
          }
        : {}),
      ...(request.responseFormat?.type === 'json_schema'
        ? {
            response_format: {
              type: 'json_schema',
              json_schema: {
                name: 'response',
                strict: true,
                schema: request.responseFormat.schema,
              },
            },
          }
        : request.responseFormat?.type === 'text'
          ? { response_format: { type: 'text' } }
          : {}),
      ...(request.stream ? { stream: true } : {}),
    };
  }

  protected baseUrl(account: ProviderRuntimeAccount): string {
    return account.baseUrl.trim() || this.options.defaultBaseUrl || '';
  }

  private responsesEligible(account: ProviderRuntimeAccount): boolean {
    return (
      this.options.toolResponsesFallback === true &&
      this.baseUrl(account).replace(/\/+$/, '') === 'https://api.openai.com/v1'
    );
  }

  private headers(account: ProviderRuntimeAccount): Record<string, string> {
    return this.options.headers?.(account) ?? {};
  }
}

function requiresCompletionTokens(error: unknown): boolean {
  if (!(error instanceof RpcError) || error.code !== RpcErrorCode.ProviderRequestFailed)
    return false;
  const data = error.data as { status?: unknown; body?: unknown } | undefined;
  if (data?.status !== 400 || typeof data.body !== 'string') return false;
  try {
    const detail = JSON.parse(data.body).error;
    return (
      detail?.param === 'max_tokens' &&
      detail?.code === 'unsupported_parameter' &&
      typeof detail.message === 'string' &&
      detail.message.includes('max_completion_tokens')
    );
  } catch {
    return false;
  }
}

function requiresToolReasoningNone(error: unknown): boolean {
  if (!(error instanceof RpcError) || error.code !== RpcErrorCode.ProviderRequestFailed)
    return false;
  const data = error.data as { status?: unknown; body?: unknown } | undefined;
  if (data?.status !== 400 || typeof data.body !== 'string') return false;
  try {
    const detail = JSON.parse(data.body).error;
    return (
      detail?.param === 'reasoning_effort' &&
      typeof detail.message === 'string' &&
      detail.message.includes('Function tools') &&
      detail.message.includes("set reasoning_effort to 'none'")
    );
  } catch {
    return false;
  }
}

function openAiMessage(message: ChatMessage): Record<string, unknown> {
  return {
    role: message.role,
    content: message.content,
    ...(message.name === undefined ? {} : { name: message.name }),
    ...(message.toolCallId === undefined ? {} : { tool_call_id: message.toolCallId }),
    ...(message.toolCalls === undefined
      ? {}
      : {
          tool_calls: message.toolCalls.map((toolCall) => ({
            id: toolCall.id,
            type: 'function',
            function: { name: toolCall.name, arguments: toolCall.arguments },
          })),
        }),
  };
}

function openAiToolCalls(value: unknown): ChatResponse['toolCalls'] {
  if (!Array.isArray(value)) return [];
  return value.filter(objectValue).map((call) => {
    const functionValue = objectValue(call.function) ? call.function : {};
    return {
      id: String(call.id ?? ''),
      name: String(functionValue.name ?? ''),
      arguments:
        typeof functionValue.arguments === 'string'
          ? functionValue.arguments
          : JSON.stringify(functionValue.arguments ?? {}),
    };
  });
}

function contentText(value: unknown): string {
  if (typeof value === 'string') return value;
  if (!Array.isArray(value)) return '';
  return value
    .filter(objectValue)
    .filter((item) => item.type === 'text' && typeof item.text === 'string')
    .map((item) => String(item.text))
    .join('');
}

function finishReason(value: unknown): ChatResponse['finishReason'] {
  if (value === 'length') return 'length';
  if (value === 'tool_calls' || value === 'function_call') return 'tool_calls';
  return 'stop';
}

function pickCapabilities(value: Record<string, unknown>): Partial<Model['capabilities']> {
  const keys: (keyof Model['capabilities'])[] = [
    'chat',
    'tools',
    'vision',
    'structuredOutput',
    'streaming',
    'embeddings',
    'contextWindow',
    'maxInputTokens',
    'maxOutputTokens',
  ];
  const result: Partial<Model['capabilities']> = {};
  for (const key of keys) {
    const capability = value[key];
    if (typeof capability === 'boolean') {
      (result as Record<string, unknown>)[key] = capability;
    } else if (
      (key === 'contextWindow' || key === 'maxInputTokens' || key === 'maxOutputTokens') &&
      (typeof capability === 'number' || capability === null)
    ) {
      (result as Record<string, unknown>)[key] = capability;
    }
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

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
} from './http-utils';
import { providerToolNames } from './tool-names';
import { DEFAULT_PROVIDER_BASE_URLS } from './openai-providers';

interface GeminiModelList {
  models?: Record<string, unknown>[];
  nextPageToken?: string;
}

interface GeminiResponse {
  candidates?: Record<string, unknown>[];
  usageMetadata?: Record<string, unknown>;
}

export class GoogleGeminiProvider implements ModelProvider {
  async listModels(account: ProviderRuntimeAccount): Promise<DiscoveredModel[]> {
    const baseUrl = this.baseUrl(account);
    const models: Record<string, unknown>[] = [];
    const seenPages = new Set<string>();
    let pageToken: string | undefined;
    do {
      const query = new URLSearchParams({ pageSize: '1000' });
      if (pageToken) query.set('pageToken', pageToken);
      const response = await providerJson<GeminiModelList>(
        account,
        endpoint(baseUrl, `models?${query.toString()}`),
        { method: 'GET', headers: this.headers(account) },
      );
      if (Array.isArray(response.models)) models.push(...response.models);
      pageToken = typeof response.nextPageToken === 'string' ? response.nextPageToken : undefined;
      if (pageToken && seenPages.has(pageToken)) {
        throw new RpcError(
          'Gemini model list repeated a pagination token',
          RpcErrorCode.ProviderRequestFailed,
        );
      }
      if (pageToken) seenPages.add(pageToken);
    } while (pageToken);

    return models
      .filter((entry) => typeof entry.name === 'string')
      .map((entry) => {
        const methods = stringArray(entry.supportedGenerationMethods);
        const capabilities: NonNullable<DiscoveredModel['capabilities']> = {};
        if (methods.length) {
          capabilities.chat = methods.includes('generateContent');
          capabilities.streaming = methods.includes('streamGenerateContent');
          capabilities.embeddings =
            methods.includes('embedContent') || methods.includes('batchEmbedContents');
        }
        if (typeof entry.inputTokenLimit === 'number')
          capabilities.maxInputTokens = entry.inputTokenLimit;
        if (typeof entry.outputTokenLimit === 'number')
          capabilities.maxOutputTokens = entry.outputTokenLimit;
        return {
          providerModelId: String(entry.name).replace(/^models\//, ''),
          ...(typeof entry.displayName === 'string' ? { displayName: entry.displayName } : {}),
          ...(Object.keys(capabilities).length ? { capabilities } : {}),
          metadataSource: 'provider-api',
          sourceUrl: 'https://generativelanguage.googleapis.com/v1beta/models',
          confidence: 'high',
        };
      });
  }

  async complete(
    account: ProviderRuntimeAccount,
    model: Model,
    request: ChatRequest,
    hooks: ProviderCompletionHooks,
  ): Promise<ChatResponse> {
    const names = providerToolNames(request);
    const response = request.stream
      ? await this.completeStream(account, model, names.request, hooks)
      : await this.completeJson(account, model, names.request, hooks);
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
    if (inputs.length === 0) return { vectors: [], usage: modelUsage(model, 0, 0) };
    const response = await providerJson<{ embeddings?: { values?: number[] }[] }>(
      account,
      endpoint(
        this.baseUrl(account),
        `models/${encodeURIComponent(model.providerModelId)}:batchEmbedContents`,
      ),
      {
        method: 'POST',
        headers: { ...this.headers(account), 'content-type': 'application/json' },
        body: JSON.stringify({
          requests: inputs.map((text) => ({
            model: `models/${model.providerModelId}`,
            content: { parts: [{ text }] },
          })),
        }),
      },
    );
    if (!Array.isArray(response.embeddings)) {
      throw new RpcError(
        'Gemini embedding response did not contain vectors',
        RpcErrorCode.ProviderRequestFailed,
      );
    }
    return {
      vectors: response.embeddings.map((embedding) => embedding.values ?? []),
      usage: modelUsage(model, undefined, 0),
    };
  }

  private async completeJson(
    account: ProviderRuntimeAccount,
    model: Model,
    request: ChatRequest,
    hooks: ProviderCompletionHooks,
  ): Promise<ChatResponse> {
    const startedAt = Date.now();
    const response = await providerJson<GeminiResponse>(
      account,
      this.generateUrl(account, model, false),
      {
        method: 'POST',
        headers: { ...this.headers(account), 'content-type': 'application/json' },
        body: JSON.stringify(this.requestBody(model, request)),
        signal: hooks.signal,
      },
    );
    return this.normalizeResponse(model, response, Date.now() - startedAt);
  }

  private async completeStream(
    account: ProviderRuntimeAccount,
    model: Model,
    request: ChatRequest,
    hooks: ProviderCompletionHooks,
  ): Promise<ChatResponse> {
    const startedAt = Date.now();
    const response = await providerFetch(account, this.generateUrl(account, model, true), {
      method: 'POST',
      headers: { ...this.headers(account), 'content-type': 'application/json' },
      body: JSON.stringify(this.requestBody(model, request)),
      signal: hooks.signal,
    });
    if (!response.body) {
      throw new RpcError('Gemini stream had no response body', RpcErrorCode.ProviderRequestFailed);
    }
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    let content = '';
    let usage: Record<string, unknown> | undefined;
    const calls = new Map<string, ChatResponse['toolCalls'][number]>();
    let finish: unknown;
    let done = false;
    const consume = (event: string) => {
      const data = event
        .split(/\r?\n/)
        .filter((line) => line.startsWith('data:'))
        .map((line) => line.slice(5).trimStart())
        .join('\n');
      if (!data) return;
      let chunk: GeminiResponse;
      try {
        chunk = JSON.parse(data) as GeminiResponse;
      } catch {
        throw new RpcError('Gemini sent invalid SSE JSON', RpcErrorCode.ProviderRequestFailed);
      }
      const candidate = objectValue(chunk.candidates?.[0]) ? chunk.candidates![0]! : undefined;
      if (candidate) {
        finish = candidate.finishReason ?? finish;
        const candidateContent = objectValue(candidate.content) ? candidate.content : {};
        this.consumeParts(candidateContent.parts, calls, (delta) => {
          content += delta;
          hooks.onDelta?.(delta);
        });
      }
      if (objectValue(chunk.usageMetadata)) usage = chunk.usageMetadata;
    };
    try {
      while (!done) {
        const next = await reader.read();
        done = next.done;
        buffer += decoder.decode(next.value ?? new Uint8Array(), { stream: !done });
        const events = buffer.split(/\r?\n\r?\n/);
        buffer = events.pop() ?? '';
        for (const event of events) consume(event);
      }
      if (buffer.trim()) consume(buffer);
    } finally {
      reader.releaseLock();
    }
    return {
      content,
      toolCalls: [...calls.values()],
      finishReason: finishReason(finish),
      usage: this.usage(model, usage),
      latencyMs: Date.now() - startedAt,
      modelId: model.modelId,
      decisionId: null,
    };
  }

  private normalizeResponse(
    model: Model,
    response: GeminiResponse,
    latencyMs: number,
  ): ChatResponse {
    const candidate = objectValue(response.candidates?.[0]) ? response.candidates![0]! : {};
    const candidateContent = objectValue(candidate.content) ? candidate.content : {};
    let content = '';
    const calls = new Map<string, ChatResponse['toolCalls'][number]>();
    this.consumeParts(candidateContent.parts, calls, (delta) => (content += delta));
    return {
      content,
      toolCalls: [...calls.values()],
      finishReason: finishReason(candidate.finishReason),
      usage: this.usage(
        model,
        objectValue(response.usageMetadata) ? response.usageMetadata : undefined,
      ),
      latencyMs,
      modelId: model.modelId,
      decisionId: null,
    };
  }

  private consumeParts(
    value: unknown,
    calls: Map<string, ChatResponse['toolCalls'][number]>,
    onText: (text: string) => void,
  ): void {
    if (!Array.isArray(value)) return;
    value.forEach((raw, index) => {
      if (!objectValue(raw)) return;
      if (typeof raw.text === 'string') onText(raw.text);
      if (objectValue(raw.functionCall)) {
        const call = raw.functionCall;
        const name = typeof call.name === 'string' ? call.name : undefined;
        if (!name) return;
        calls.set(`${index}:${name}`, {
          id: `gemini-${index}`,
          name,
          arguments: JSON.stringify(call.args ?? {}),
        });
      }
    });
  }

  private requestBody(_model: Model, request: ChatRequest): Record<string, unknown> {
    const systemParts = request.messages
      .filter((message) => message.role === 'system')
      .map((message) => ({ text: message.content }));
    const generationConfig: Record<string, unknown> = {};
    if (request.maxTokens !== undefined) generationConfig.maxOutputTokens = request.maxTokens;
    if (request.temperature !== undefined) generationConfig.temperature = request.temperature;
    if (request.responseFormat?.type === 'json_schema') {
      generationConfig.responseMimeType = 'application/json';
      generationConfig.responseSchema = request.responseFormat.schema;
    } else if (request.responseFormat?.type === 'text') {
      generationConfig.responseMimeType = 'text/plain';
    }
    return {
      contents: request.messages
        .filter((message) => message.role !== 'system')
        .map((message) => this.content(message)),
      ...(systemParts.length ? { systemInstruction: { parts: systemParts } } : {}),
      ...(Object.keys(generationConfig).length ? { generationConfig } : {}),
      ...(request.tools?.length
        ? {
            tools: [
              {
                functionDeclarations: request.tools.map((tool) => ({
                  name: tool.name,
                  description: tool.description,
                  parameters: tool.inputSchema,
                })),
              },
            ],
          }
        : {}),
    };
  }

  private content(message: ChatMessage): Record<string, unknown> {
    if (message.role === 'tool') {
      return {
        role: 'user',
        parts: [
          {
            functionResponse: {
              name: message.name ?? message.toolCallId ?? 'tool',
              response: parseJsonObject(message.content),
            },
          },
        ],
      };
    }
    const parts: Record<string, unknown>[] = [];
    if (message.content) parts.push({ text: message.content });
    for (const call of message.toolCalls ?? []) {
      parts.push({ functionCall: { name: call.name, args: parseJsonObject(call.arguments) } });
    }
    return { role: message.role === 'assistant' ? 'model' : 'user', parts };
  }

  private generateUrl(account: ProviderRuntimeAccount, model: Model, stream: boolean): string {
    const action = stream ? 'streamGenerateContent?alt=sse' : 'generateContent';
    return endpoint(
      this.baseUrl(account),
      `models/${encodeURIComponent(model.providerModelId)}:${action}`,
    );
  }

  private usage(model: Model, value?: Record<string, unknown>): ChatResponse['usage'] {
    return modelUsage(
      model,
      optionalUsageCount(value?.promptTokenCount),
      optionalUsageCount(value?.candidatesTokenCount),
      optionalUsageCount(value?.cachedContentTokenCount) ?? 0,
    );
  }

  private baseUrl(account: ProviderRuntimeAccount): string {
    return account.baseUrl.trim() || DEFAULT_PROVIDER_BASE_URLS['google-gemini']!;
  }

  private headers(account: ProviderRuntimeAccount): Record<string, string> {
    return account.apiKey ? { 'x-goog-api-key': account.apiKey } : {};
  }
}

function finishReason(value: unknown): ChatResponse['finishReason'] {
  if (value === 'MAX_TOKENS') return 'length';
  if (value === 'OTHER' || value === 'SAFETY' || value === 'RECITATION' || value === 'BLOCKLIST')
    return 'error';
  return 'stop';
}

function parseJsonObject(value: string): Record<string, unknown> {
  try {
    const parsed: unknown = JSON.parse(value);
    return objectValue(parsed) ? parsed : { result: parsed };
  } catch {
    return { result: value };
  }
}

function objectValue(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function stringArray(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === 'string')
    : [];
}

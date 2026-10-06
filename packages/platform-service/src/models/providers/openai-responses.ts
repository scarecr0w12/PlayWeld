import {
  RpcError,
  RpcErrorCode,
  type ChatRequest,
  type ChatResponse,
  type Model,
} from '@gamecrafter/contracts';
import type { ProviderCompletionHooks, ProviderRuntimeAccount } from './provider';
import {
  endpoint,
  modelUsage,
  optionalUsageCount,
  providerFetch,
  providerJson,
  safeExcerpt,
} from './http-utils';

type Item = Record<string, unknown>;
interface ResponseBody {
  status?: string;
  output?: Item[];
  error?: { message?: string };
  incomplete_details?: { reason?: string };
  usage?: {
    input_tokens?: number;
    output_tokens?: number;
    input_tokens_details?: { cached_tokens?: number };
  };
}

/** Stateless requests; bounded, account-scoped replay of encrypted reasoning alongside tools. */
export class OpenAIResponses {
  private readonly replay = new Map<
    string,
    { calls: ChatResponse['toolCalls']; content: string; output: Item[] }
  >();

  async complete(
    account: ProviderRuntimeAccount,
    model: Model,
    request: ChatRequest,
    hooks: ProviderCompletionHooks,
  ): Promise<ChatResponse> {
    const startedAt = Date.now();
    const scope = JSON.stringify([account.accountId, account.baseUrl, model.providerModelId]);
    const input: Item[] = [];
    for (const message of request.messages) {
      if (message.role === 'tool') {
        input.push({
          type: 'function_call_output',
          call_id: message.toolCallId,
          output: message.content,
        });
      } else if (message.role === 'assistant' && message.toolCalls?.length) {
        const cached = this.replay.get(`${scope}:${message.toolCalls[0].id}`);
        if (
          cached &&
          cached.content === message.content &&
          JSON.stringify(cached.calls) === JSON.stringify(message.toolCalls)
        ) {
          input.push(...cached.output);
        } else {
          // Chat histories restored from a checkpoint have no provider item IDs.
          if (message.content) input.push({ role: 'assistant', content: message.content });
          input.push(
            ...message.toolCalls.map((c) => ({
              type: 'function_call',
              call_id: c.id,
              name: c.name,
              arguments: c.arguments,
            })),
          );
        }
      } else {
        input.push({ role: message.role, content: message.content });
      }
    }
    const body = {
      model: model.providerModelId,
      input,
      store: false,
      include: ['reasoning.encrypted_content'],
      ...(request.maxTokens === undefined ? {} : { max_output_tokens: request.maxTokens }),
      ...(request.temperature === undefined ? {} : { temperature: request.temperature }),
      ...(request.tools
        ? {
            tools: request.tools.map((t) => ({
              type: 'function',
              name: t.name,
              description: t.description,
              parameters: t.inputSchema,
              strict: false,
            })),
          }
        : {}),
      ...(request.responseFormat?.type === 'json_schema'
        ? {
            text: {
              format: {
                type: 'json_schema',
                name: 'response',
                schema: request.responseFormat.schema,
                strict: true,
              },
            },
          }
        : {}),
      ...(request.stream ? { stream: true } : {}),
    };
    const init = {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
      signal: hooks.signal,
    };
    const url = endpoint(account.baseUrl.trim() || 'https://api.openai.com/v1', 'responses');
    const response = request.stream
      ? await this.stream(account, url, init, hooks)
      : await providerJson<ResponseBody>(account, url, init);
    if (
      !Array.isArray(response.output) ||
      !['completed', 'incomplete'].includes(response.status ?? '')
    ) {
      throw new RpcError(
        `Provider Responses request failed: ${safeExcerpt(response.error?.message ?? response.status ?? 'missing output', account.apiKey)}`,
        RpcErrorCode.ProviderRequestFailed,
      );
    }
    const content = response.output
      .flatMap((item) =>
        item.type === 'message' && Array.isArray(item.content) ? item.content : [],
      )
      .filter((part): part is Item => typeof part === 'object' && part !== null)
      .map((part) =>
        typeof part.text === 'string'
          ? part.text
          : typeof part.refusal === 'string'
            ? part.refusal
            : '',
      )
      .join('');
    const toolCalls = response.output
      .filter((item) => item.type === 'function_call')
      .map((item) => {
        if (
          typeof item.call_id !== 'string' ||
          typeof item.name !== 'string' ||
          typeof item.arguments !== 'string'
        )
          throw new RpcError(
            'Provider returned an invalid function call',
            RpcErrorCode.ProviderRequestFailed,
          );
        return { id: item.call_id, name: item.name, arguments: item.arguments };
      });
    if (toolCalls.length) {
      if (this.replay.size >= 256) this.replay.delete(this.replay.keys().next().value!);
      this.replay.set(`${scope}:${toolCalls[0].id}`, {
        calls: toolCalls,
        content,
        output: response.output,
      });
    }
    return {
      content,
      toolCalls,
      finishReason:
        response.status === 'incomplete' ? 'length' : toolCalls.length ? 'tool_calls' : 'stop',
      usage: modelUsage(
        model,
        optionalUsageCount(response.usage?.input_tokens),
        optionalUsageCount(response.usage?.output_tokens),
        optionalUsageCount(response.usage?.input_tokens_details?.cached_tokens) ?? 0,
      ),
      latencyMs: Date.now() - startedAt,
      modelId: model.modelId,
      decisionId: null,
    };
  }

  private async stream(
    account: ProviderRuntimeAccount,
    url: string,
    init: RequestInit,
    hooks: ProviderCompletionHooks,
  ): Promise<ResponseBody> {
    const response = await providerFetch(account, url, init);
    if (!response.body)
      throw new RpcError(
        'Provider Responses stream had no body',
        RpcErrorCode.ProviderRequestFailed,
      );
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    let result: ResponseBody | undefined;
    const consume = (event: string) => {
      const data = event
        .split(/\r?\n/)
        .filter((line) => line.startsWith('data:'))
        .map((line) => line.slice(5).trimStart())
        .join('\n');
      if (!data || data === '[DONE]') return;
      let value: Item;
      try {
        value = JSON.parse(data) as Item;
      } catch {
        throw new RpcError(
          'Provider sent invalid Responses SSE JSON',
          RpcErrorCode.ProviderRequestFailed,
        );
      }
      if (value.type === 'response.output_text.delta' && typeof value.delta === 'string')
        hooks.onDelta?.(value.delta);
      if (value.type === 'response.completed' || value.type === 'response.incomplete')
        result = value.response as ResponseBody;
      if (value.type === 'error' || value.type === 'response.failed')
        throw new RpcError(
          `Provider Responses stream failed: ${safeExcerpt(String(value.message ?? 'response.failed'), account.apiKey)}`,
          RpcErrorCode.ProviderRequestFailed,
        );
    };
    try {
      while (true) {
        const chunk = await reader.read();
        buffer += decoder.decode(chunk.value ?? new Uint8Array(), { stream: !chunk.done });
        const events = buffer.split(/\r?\n\r?\n/);
        buffer = events.pop() ?? '';
        events.forEach(consume);
        if (chunk.done) break;
      }
      if (buffer.trim()) consume(buffer);
    } finally {
      reader.releaseLock();
    }
    if (!result)
      throw new RpcError(
        'Provider Responses stream ended without a terminal response',
        RpcErrorCode.ProviderRequestFailed,
      );
    return result;
  }
}

import { createServer } from 'node:http';
import { describe, expect, it } from 'vitest';
import { RpcError, type ChatRequest, type Model } from '@gamecrafter/contracts';
import type { ProviderRuntimeAccount } from './provider';
import { AnthropicProvider } from './anthropic';
import { OpenAICompatibleProvider } from './openai-compatible';

describe('OpenAI-compatible provider', () => {
  it('reads provider capacities without guessing capacities for ID-only models', async () => {
    const server = createServer((_request, response) =>
      response.end(
        JSON.stringify({
          data: [
            {
              id: 'reported',
              context_length: 1_000_000,
              top_provider: { max_completion_tokens: 128_000 },
            },
            { id: 'unknown' },
          ],
        }),
      ),
    );
    try {
      const provider = new OpenAICompatibleProvider();
      expect(await provider.listModels(openAIAccount(await listen(server)))).toEqual([
        {
          providerModelId: 'reported',
          capabilities: { contextWindow: 1_000_000, maxOutputTokens: 128_000 },
        },
        { providerModelId: 'unknown', capabilities: {} },
      ]);
    } finally {
      await closeServer(server);
    }
  });
  it.each([false, true])(
    'adapts function-tool reasoning rejection with streaming=%s',
    async (stream) => {
      const bodies: Record<string, unknown>[] = [];
      const server = createServer((request, response) => {
        let body = '';
        request.on('data', (chunk) => (body += chunk.toString()));
        request.on('end', () => {
          const parsed = JSON.parse(body) as Record<string, unknown>;
          bodies.push(parsed);
          const error =
            parsed.reasoning_effort !== 'none'
              ? {
                  param: 'reasoning_effort',
                  code: null,
                  message:
                    "Function tools with reasoning_effort are not supported for gpt-6-sol in /v1/chat/completions. To use function tools, use /v1/responses or set reasoning_effort to 'none'.",
                }
              : 'max_tokens' in parsed
                ? {
                    param: 'max_tokens',
                    code: 'unsupported_parameter',
                    message: 'Use max_completion_tokens instead.',
                  }
                : null;
          if (error) {
            response.writeHead(400, { 'content-type': 'application/json' });
            response.end(JSON.stringify({ error }));
            return;
          }
          response.writeHead(200, {
            'content-type': stream ? 'text/event-stream' : 'application/json',
          });
          response.end(
            stream
              ? 'data: {"choices":[{"delta":{"content":"ok"},"finish_reason":"stop"}]}\n\ndata: [DONE]\n\n'
              : JSON.stringify({
                  choices: [{ message: { content: 'ok' }, finish_reason: 'stop' }],
                }),
          );
        });
      });
      const account = openAIAccount(await listen(server, '/v1'));
      try {
        const provider = new OpenAICompatibleProvider();
        for (let i = 0; i < 2; i++) {
          const result = await provider.complete(
            account,
            model(account, 'reasoning-tools'),
            { ...chatRequest(), stream },
            { signal: new AbortController().signal },
          );
          expect(result.content).toBe('ok');
        }
        expect(bodies).toHaveLength(4);
        expect(bodies[3]).toMatchObject({ reasoning_effort: 'none', max_completion_tokens: 100 });
        expect(bodies[3]).not.toHaveProperty('max_tokens');
        expect(bodies[3].tools).toEqual(bodies[0].tools);
      } finally {
        await closeServer(server);
      }
    },
  );

  it.each([
    [
      401,
      { param: 'max_tokens', code: 'unsupported_parameter', message: 'Use max_completion_tokens' },
    ],
    [
      400,
      { param: 'temperature', code: 'unsupported_parameter', message: 'Use max_completion_tokens' },
    ],
    [
      400,
      { param: 'max_tokens', code: 'invalid_request_error', message: 'Use max_completion_tokens' },
    ],
  ])('does not retry unrelated failures (%s)', async (status, error) => {
    let calls = 0;
    const server = createServer((request, response) => {
      calls++;
      request.resume();
      response.writeHead(status as number, { 'content-type': 'application/json' });
      response.end(JSON.stringify({ error }));
    });
    const account = openAIAccount(await listen(server, '/v1'));
    try {
      await expect(
        new OpenAICompatibleProvider().complete(account, model(account, 'fake'), chatRequest(), {
          signal: new AbortController().signal,
        }),
      ).rejects.toBeInstanceOf(RpcError);
      expect(calls).toBe(1);
    } finally {
      await closeServer(server);
    }
  });

  it.each([false, true])(
    'adapts rejected max_tokens and remembers it with streaming=%s',
    async (stream) => {
      const bodies: Record<string, unknown>[] = [];
      const server = createServer((request, response) => {
        let body = '';
        request.on('data', (chunk) => (body += chunk.toString()));
        request.on('end', () => {
          const parsed = JSON.parse(body) as Record<string, unknown>;
          bodies.push(parsed);
          if ('max_tokens' in parsed) {
            response.writeHead(400, { 'content-type': 'application/json' });
            response.end(
              JSON.stringify({
                error: {
                  message:
                    "Unsupported parameter: 'max_tokens' is not supported with this model. Use 'max_completion_tokens' instead.",
                  param: 'max_tokens',
                  code: 'unsupported_parameter',
                },
              }),
            );
            return;
          }
          response.writeHead(200, {
            'content-type': stream ? 'text/event-stream' : 'application/json',
          });
          response.end(
            stream
              ? 'data: {"choices":[{"delta":{"content":"ok"},"finish_reason":"stop"}]}\n\ndata: [DONE]\n\n'
              : JSON.stringify({
                  choices: [{ message: { content: 'ok' }, finish_reason: 'stop' }],
                }),
          );
        });
      });
      const account = openAIAccount(await listen(server, '/v1'));
      try {
        const provider = new OpenAICompatibleProvider();
        for (let i = 0; i < 2; i++) {
          const deltas: string[] = [];
          const result = await provider.complete(
            account,
            model(account, 'reasoning-model'),
            { ...chatRequest(), stream },
            { signal: new AbortController().signal, onDelta: (delta) => deltas.push(delta) },
          );
          expect(result.content).toBe('ok');
          if (stream) expect(deltas).toEqual(['ok']);
        }
        expect(bodies).toHaveLength(3);
        expect(bodies[0].max_tokens).toBe(100);
        for (const body of bodies.slice(1)) {
          expect(body.max_completion_tokens).toBe(100);
          expect(body).not.toHaveProperty('max_tokens');
          expect(body.messages).toEqual(bodies[0].messages);
          expect(body.tools).toEqual(bodies[0].tools);
        }
      } finally {
        await closeServer(server);
      }
    },
  );

  it.each([false, true])('round-trips namespaced tool names with streaming=%s', async (stream) => {
    let wireName = '';
    let bodySeen: {
      tools: Array<{ function: { name: string } }>;
      messages: Array<{ name?: string; tool_calls?: Array<{ function: { name: string } }> }>;
    } = { tools: [], messages: [] };
    const server = createServer((request, response) => {
      let body = '';
      request.on('data', (chunk) => (body += chunk.toString()));
      request.on('end', () => {
        bodySeen = JSON.parse(body);
        wireName = bodySeen.tools[0]!.function.name;
        const names = bodySeen.tools.map((tool) => tool.function.name);
        if (names.some((name: string) => !/^[a-zA-Z0-9_-]{1,64}$/.test(name))) {
          response.writeHead(400);
          response.end('Invalid function name');
          return;
        }
        if (stream) {
          response.writeHead(200, { 'content-type': 'text/event-stream' });
          response.end(
            `data: ${JSON.stringify({ choices: [{ delta: { tool_calls: [{ index: 0, id: 'call', function: { name: wireName, arguments: '{}' } }] }, finish_reason: 'tool_calls' }] })}\n\ndata: [DONE]\n\n`,
          );
        } else {
          response.writeHead(200, { 'content-type': 'application/json' });
          response.end(
            JSON.stringify({
              choices: [
                {
                  message: {
                    content: '',
                    tool_calls: [{ id: 'call', function: { name: wireName, arguments: '{}' } }],
                  },
                  finish_reason: 'tool_calls',
                },
              ],
            }),
          );
        }
      });
    });
    const baseUrl = await listen(server, '/v1');
    try {
      const response = await new OpenAICompatibleProvider().complete(
        openAIAccount(baseUrl),
        model(openAIAccount(baseUrl), 'fake-model'),
        {
          messages: [
            {
              role: 'assistant',
              content: '',
              toolCalls: [{ id: 'prior', name: 'fs/read-file', arguments: '{}' }],
            },
            { role: 'tool', name: 'fs/read-file', toolCallId: 'prior', content: 'file contents' },
          ],
          tools: [
            { name: 'fs/read-file', description: 'Read a file', inputSchema: { type: 'object' } },
            { name: 'fs_read-file', description: 'Distinct tool', inputSchema: { type: 'object' } },
          ],
          stream,
        },
        { signal: new AbortController().signal },
      );
      expect(response.toolCalls[0]?.name).toBe('fs/read-file');
      expect(bodySeen.messages[0]!.tool_calls?.[0]?.function.name).toBe(wireName);
      expect(bodySeen.messages[1].name).toBe(wireName);
      expect(bodySeen.tools[1].function.name).not.toBe(wireName);
    } finally {
      await closeServer(server);
    }
  });
  it('lists models and maps chat tools, usage, and authentication', async () => {
    let observedBody: Record<string, unknown> | undefined;
    const server = createServer((request, response) => {
      let body = '';
      request.on('data', (chunk) => (body += chunk.toString()));
      request.on('end', () => {
        if (request.method === 'GET' && request.url === '/v1/models') {
          response.writeHead(200, { 'content-type': 'application/json' });
          response.end(
            JSON.stringify({ data: [{ id: 'fake-model', display_name: 'Fake Model' }] }),
          );
          return;
        }
        expect(request.headers.authorization).toBe('Bearer sk-abcdefghijklmnopqrstuvwxyz');
        observedBody = JSON.parse(body) as Record<string, unknown>;
        response.writeHead(200, { 'content-type': 'application/json' });
        response.end(
          JSON.stringify({
            choices: [
              {
                message: {
                  content: 'hello',
                  tool_calls: [
                    {
                      id: 'call-1',
                      function: { name: 'lookup', arguments: '{"id":1}' },
                    },
                  ],
                },
                finish_reason: 'tool_calls',
              },
            ],
            usage: { prompt_tokens: 12, completion_tokens: 5 },
          }),
        );
      });
    });
    const baseUrl = await listen(server, '/v1');
    try {
      const account = openAIAccount(baseUrl);
      const provider = new OpenAICompatibleProvider();
      expect(await provider.listModels(account)).toEqual([
        { providerModelId: 'fake-model', displayName: 'Fake Model', capabilities: {} },
      ]);
      const response = await provider.complete(
        account,
        model(account, 'fake-model'),
        chatRequest(),
        {
          signal: new AbortController().signal,
        },
      );
      expect(response).toMatchObject({
        content: 'hello',
        finishReason: 'tool_calls',
        toolCalls: [{ id: 'call-1', name: 'lookup', arguments: '{"id":1}' }],
        usage: { inputTokens: 12, outputTokens: 5 },
      });
      expect(observedBody?.messages).toEqual([
        { role: 'system', content: 'system prompt' },
        { role: 'user', content: 'hello' },
      ]);
      expect(observedBody?.tools).toMatchObject([
        { type: 'function', function: { name: 'lookup', parameters: { type: 'object' } } },
      ]);
    } finally {
      await closeServer(server);
    }
  });

  it('streams deltas and redacts provider error bodies', async () => {
    let failRequest = false;
    const server = createServer((request, response) => {
      if (request.method === 'GET') {
        if (failRequest) {
          response.writeHead(401, { 'content-type': 'application/json' });
          response.end(
            JSON.stringify({ error: { message: 'bad Bearer sk-abcdefghijklmnopqrstuvwxyz' } }),
          );
          return;
        }
        response.writeHead(200, { 'content-type': 'application/json' });
        response.end(JSON.stringify({ data: [] }));
        return;
      }
      request.resume();
      response.writeHead(200, { 'content-type': 'text/event-stream' });
      for (const delta of ['one', ' two', ' three']) {
        response.write(`data: ${JSON.stringify({ choices: [{ delta: { content: delta } }] })}\n\n`);
      }
      response.write(
        `data: ${JSON.stringify({ choices: [], usage: { prompt_tokens: 4, completion_tokens: 3 } })}\n\n`,
      );
      response.end('data: [DONE]\n\n');
    });
    const baseUrl = await listen(server, '/v1');
    try {
      const provider = new OpenAICompatibleProvider();
      const deltas: string[] = [];
      const response = await provider.complete(
        openAIAccount(baseUrl),
        model(openAIAccount(baseUrl), 'fake-model'),
        { ...chatRequest(), stream: true },
        { signal: new AbortController().signal, onDelta: (delta) => deltas.push(delta) },
      );
      expect(deltas).toEqual(['one', ' two', ' three']);
      expect(response.content).toBe('one two three');
      expect(response.usage).toMatchObject({ inputTokens: 4, outputTokens: 3 });

      failRequest = true;
      let providerError: unknown;
      try {
        await provider.listModels(openAIAccount(baseUrl));
      } catch (error) {
        providerError = error;
      }
      expect(providerError).toBeInstanceOf(RpcError);
      expect(providerError).toMatchObject({ code: -32043 });
      expect((providerError as Error).message).toContain('HTTP 401');
      expect((providerError as Error).message).not.toContain('sk-abcdefghijklmnopqrstuvwxyz');
    } finally {
      await closeServer(server);
    }
  });
});

describe('Anthropic provider', () => {
  it('reads independent input/output capacity and rejects an unknown mandatory output limit', async () => {
    let completions = 0;
    const server = createServer((request, response) => {
      if (request.method !== 'GET') completions++;
      response.end(
        JSON.stringify({
          data: [{ id: 'reported', max_input_tokens: 1_000_000, max_tokens: 128_000 }],
        }),
      );
    });
    try {
      const account = anthropicAccount(await listen(server));
      const provider = new AnthropicProvider();
      expect(await provider.listModels(account)).toEqual([
        {
          providerModelId: 'reported',
          capabilities: { maxInputTokens: 1_000_000, maxOutputTokens: 128_000 },
        },
      ]);
      const unknown = model(account, 'unknown');
      unknown.capabilities.maxOutputTokens = null;
      await expect(
        provider.complete(
          account,
          unknown,
          { messages: [{ role: 'user', content: 'Hello' }] },
          { signal: new AbortController().signal },
        ),
      ).rejects.toThrow('no reported output capacity');
      expect(completions).toBe(0);
    } finally {
      await closeServer(server);
    }
  });
  it('maps system messages, tools, responses, and streaming deltas', async () => {
    let requestBody: Record<string, unknown> | undefined;
    let stream = false;
    const server = createServer((request, response) => {
      let body = '';
      request.on('data', (chunk) => (body += chunk.toString()));
      request.on('end', () => {
        expect(request.headers['x-api-key']).toBe('anthropic-secret');
        expect(request.headers['anthropic-version']).toBe('2023-06-01');
        if (request.url === '/v1/models') {
          response.writeHead(200, { 'content-type': 'application/json' });
          response.end(
            JSON.stringify({ data: [{ id: 'claude-fake', display_name: 'Claude Fake' }] }),
          );
          return;
        }
        requestBody = JSON.parse(body) as Record<string, unknown>;
        response.writeHead(200, {
          'content-type': stream ? 'text/event-stream' : 'application/json',
        });
        if (stream) {
          const events = [
            { type: 'message_start', message: { usage: { input_tokens: 7 } } },
            { type: 'content_block_start', index: 0, content_block: { type: 'text', text: '' } },
            { type: 'content_block_delta', index: 0, delta: { type: 'text_delta', text: 'A' } },
            { type: 'content_block_delta', index: 0, delta: { type: 'text_delta', text: 'B' } },
            {
              type: 'content_block_start',
              index: 1,
              content_block: { type: 'tool_use', id: 'stream-tool', name: 'lookup', input: {} },
            },
            {
              type: 'content_block_delta',
              index: 1,
              delta: { type: 'input_json_delta', partial_json: '{"q":"x"}' },
            },
            {
              type: 'message_delta',
              delta: { stop_reason: 'tool_use' },
              usage: { output_tokens: 2 },
            },
            { type: 'message_stop' },
          ];
          for (const event of events) {
            response.write(`event: ${event.type}\ndata: ${JSON.stringify(event)}\n\n`);
          }
          response.end();
          return;
        }
        response.end(
          JSON.stringify({
            content: [
              { type: 'text', text: 'anthropic reply' },
              { type: 'tool_use', id: 'tool-2', name: 'lookup', input: { id: 2 } },
            ],
            stop_reason: 'tool_use',
            usage: { input_tokens: 9, output_tokens: 4 },
          }),
        );
      });
    });
    const baseUrl = await listen(server);
    try {
      const account = anthropicAccount(baseUrl);
      const provider = new AnthropicProvider();
      expect(await provider.listModels(account)).toEqual([
        { providerModelId: 'claude-fake', displayName: 'Claude Fake', capabilities: {} },
      ]);
      const modelData = model(account, 'claude-fake');
      const response = await provider.complete(account, modelData, chatRequest(), {
        signal: new AbortController().signal,
      });
      expect(response).toMatchObject({
        content: 'anthropic reply',
        finishReason: 'tool_calls',
        toolCalls: [{ id: 'tool-2', name: 'lookup', arguments: '{"id":2}' }],
        usage: { inputTokens: 9, outputTokens: 4 },
      });
      expect(requestBody?.system).toBe('system prompt');
      expect(requestBody?.tools).toMatchObject([
        { name: 'lookup', input_schema: { type: 'object' } },
      ]);

      stream = true;
      const deltas: string[] = [];
      const streamResponse = await provider.complete(
        account,
        modelData,
        { ...chatRequest(), stream: true },
        { signal: new AbortController().signal, onDelta: (delta) => deltas.push(delta) },
      );
      expect(deltas).toEqual(['A', 'B']);
      expect(streamResponse.content).toBe('AB');
      expect(streamResponse.finishReason).toBe('tool_calls');
      expect(streamResponse.toolCalls).toEqual([
        { id: 'stream-tool', name: 'lookup', arguments: '{"q":"x"}' },
      ]);
      expect(streamResponse.usage).toMatchObject({ inputTokens: 7, outputTokens: 2 });
      await expect(provider.embed(account, modelData, ['text'])).rejects.toMatchObject({
        code: -32046,
      });
    } finally {
      await closeServer(server);
    }
  });
});

function openAIAccount(baseUrl: string): ProviderRuntimeAccount {
  return {
    accountId: '019535d4-2c00-7000-8000-000000000401',
    providerKind: 'openai-compatible',
    displayName: 'Fake OpenAI-compatible',
    baseUrl,
    hasCredential: true,
    headers: {},
    isLocal: true,
    privacy: 'local',
    enabled: true,
    createdAt: '2026-09-28T00:00:00.000Z',
    updatedAt: '2026-09-28T00:00:00.000Z',
    apiKey: 'sk-abcdefghijklmnopqrstuvwxyz',
  };
}

function anthropicAccount(baseUrl: string): ProviderRuntimeAccount {
  return {
    accountId: '019535d4-2c00-7000-8000-000000000402',
    providerKind: 'anthropic',
    displayName: 'Fake Anthropic',
    baseUrl,
    hasCredential: true,
    headers: {},
    isLocal: true,
    privacy: 'local',
    enabled: true,
    createdAt: '2026-09-28T00:00:00.000Z',
    updatedAt: '2026-09-28T00:00:00.000Z',
    apiKey: 'anthropic-secret',
  };
}

function model(account: ProviderRuntimeAccount, providerModelId: string): Model {
  return {
    modelId: `${account.accountId}/${providerModelId}`,
    accountId: account.accountId,
    providerModelId,
    displayName: providerModelId,
    capabilities: {
      chat: true,
      tools: true,
      vision: false,
      structuredOutput: true,
      streaming: true,
      embeddings: true,
      contextWindow: 32000,
      maxOutputTokens: 4096,
    },
    pricing: { inputPerMTokUsd: 1, outputPerMTokUsd: 2 },
    metadataSource: 'provider',
    metadataUpdatedAt: '2026-09-28T00:00:00.000Z',
    enabled: true,
    tags: [],
    workTypes: [],
    roles: [],
  };
}

function chatRequest(): ChatRequest {
  return {
    messages: [
      { role: 'system', content: 'system prompt' },
      { role: 'user', content: 'hello' },
    ],
    tools: [{ name: 'lookup', description: 'Lookup an item', inputSchema: { type: 'object' } }],
    maxTokens: 100,
  };
}

async function listen(server: ReturnType<typeof createServer>, basePath = ''): Promise<string> {
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const address = server.address();
  if (!address || typeof address === 'string')
    throw new Error('Fake provider did not bind a TCP port');
  return `http://127.0.0.1:${address.port}${basePath}`;
}

async function closeServer(server: ReturnType<typeof createServer>): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    server.close((error) => (error ? reject(error) : resolve()));
  });
}

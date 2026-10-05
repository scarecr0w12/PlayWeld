import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import { describe, expect, it } from 'vitest';
import type { ChatRequest, Model, ProviderKind } from '@gamecrafter/contracts';
import type { ProviderRuntimeAccount } from './provider';
import { GoogleGeminiProvider } from './google-gemini';
import { createBuiltinModelProviders } from './index';
import {
  AzureOpenAIProvider,
  DeepSeekProvider,
  DEFAULT_PROVIDER_BASE_URLS,
  GroqProvider,
  MistralProvider,
  OpenAIProvider,
  OpenRouterProvider,
  XAIProvider,
} from './openai-providers';

type Fixture = {
  provider:
    | OpenAIProvider
    | OpenRouterProvider
    | XAIProvider
    | MistralProvider
    | DeepSeekProvider
    | GroqProvider;
  kind: ProviderKind;
  basePath: string;
  listPath: string;
  chatPath: string;
  model: Record<string, unknown>;
  expectedModel: Record<string, unknown>;
  expectedRequest?: Record<string, unknown>;
};

const fixtures: Fixture[] = [
  {
    provider: new OpenAIProvider(),
    kind: 'openai',
    basePath: '/v1',
    listPath: '/v1/models',
    chatPath: '/v1/chat/completions',
    model: { id: 'gpt-fixture', owned_by: 'openai', created: 1_700_000_000 },
    expectedModel: {
      providerModelId: 'gpt-fixture',
      metadataSource: 'provider-api',
      sourceUrl: 'https://api.openai.com/v1/models',
      confidence: 'high',
    },
  },
  {
    provider: new OpenRouterProvider(),
    kind: 'openrouter',
    basePath: '/api/v1',
    listPath: '/api/v1/models',
    chatPath: '/api/v1/chat/completions',
    model: {
      id: 'vendor/model',
      name: 'Vendor Model',
      context_length: 131072,
      top_provider: { max_completion_tokens: 8192 },
      architecture: { input_modalities: ['text', 'image'], output_modalities: ['text'] },
      supported_parameters: ['tools', 'response_format'],
      pricing: { prompt: '0.000002', completion: '0.000006' },
    },
    expectedModel: {
      providerModelId: 'vendor/model',
      displayName: 'Vendor Model',
      capabilities: {
        contextWindow: 131072,
        maxOutputTokens: 8192,
        vision: true,
        tools: true,
        structuredOutput: true,
      },
      pricing: { inputPerMTokUsd: 2, outputPerMTokUsd: 6 },
    },
    expectedRequest: { model: 'vendor/model', messages: [{ role: 'user', content: 'hello' }] },
  },
  {
    provider: new XAIProvider(),
    kind: 'xai',
    basePath: '/v1',
    listPath: '/v1/language-models',
    chatPath: '/v1/chat/completions',
    model: {
      id: 'grok-fixture',
      name: 'Grok Fixture',
      context_length: 131072,
      input_modalities: ['text'],
      prompt_text_token_price: 12500,
      completion_text_token_price: 25000,
    },
    expectedModel: {
      providerModelId: 'grok-fixture',
      displayName: 'Grok Fixture',
      capabilities: { chat: true, contextWindow: 131072, vision: false },
      pricing: { inputPerMTokUsd: 1.25, outputPerMTokUsd: 2.5 },
    },
    expectedRequest: { model: 'grok-fixture', messages: [{ role: 'user', content: 'hello' }] },
  },
  {
    provider: new MistralProvider(),
    kind: 'mistral',
    basePath: '/v1',
    listPath: '/v1/models',
    chatPath: '/v1/chat/completions',
    model: {
      id: 'mistral-fixture',
      name: 'Mistral Fixture',
      max_context_length: 32768,
      capabilities: { completion_chat: true, function_calling: true, vision: false },
    },
    expectedModel: {
      providerModelId: 'mistral-fixture',
      displayName: 'Mistral Fixture',
      capabilities: { contextWindow: 32768, chat: true, tools: true, vision: false },
    },
    expectedRequest: { model: 'mistral-fixture', messages: [{ role: 'user', content: 'hello' }] },
  },
  {
    provider: new DeepSeekProvider(),
    kind: 'deepseek',
    basePath: '',
    listPath: '/models',
    chatPath: '/chat/completions',
    model: {
      id: 'deepseek-fixture',
      context_window: 65536,
      max_output_tokens: 8192,
      capabilities: { chat: true, tools: true },
    },
    expectedModel: {
      providerModelId: 'deepseek-fixture',
      capabilities: { contextWindow: 65536, maxOutputTokens: 8192, chat: true, tools: true },
    },
    expectedRequest: { model: 'deepseek-fixture', messages: [{ role: 'user', content: 'hello' }] },
  },
  {
    provider: new GroqProvider(),
    kind: 'groq',
    basePath: '/openai/v1',
    listPath: '/openai/v1/models',
    chatPath: '/openai/v1/chat/completions',
    model: {
      id: 'groq-fixture',
      active: true,
      context_window: 131072,
      max_completion_tokens: 4096,
    },
    expectedModel: {
      providerModelId: 'groq-fixture',
      capabilities: { contextWindow: 131072, maxOutputTokens: 4096 },
      tags: ['active'],
    },
    expectedRequest: { model: 'groq-fixture', messages: [{ role: 'user', content: 'hello' }] },
  },
];

describe('named OpenAI-shaped provider adapters', () => {
  it.each(fixtures)('$kind uses its model catalog, auth, and chat mapping', async (fixture) => {
    const observed: {
      method?: string;
      url?: string;
      auth?: string;
      body?: Record<string, unknown>;
    }[] = [];
    const server = createServer((request, response) => {
      void readJson(request).then((body) => {
        observed.push({
          method: request.method,
          url: request.url,
          auth: String(request.headers.authorization ?? ''),
          body,
        });
        const list =
          fixture.kind === 'xai' ? { models: [fixture.model] } : { data: [fixture.model] };
        respond(request, response, fixture.listPath, list);
      });
    });
    const baseUrl = await listen(server, fixture.basePath);
    const account = providerAccount(fixture.kind, baseUrl);
    try {
      const discovered = await fixture.provider.listModels(account);
      expect(discovered).toHaveLength(1);
      expect(discovered[0]).toMatchObject(fixture.expectedModel);
      const response = await fixture.provider.complete(
        account,
        model(account, discovered[0]!.providerModelId),
        {
          messages: [{ role: 'user', content: 'hello' }],
          maxTokens: 32,
          tools: [{ name: 'lookup', description: 'Lookup', inputSchema: { type: 'object' } }],
        },
        { signal: new AbortController().signal },
      );
      expect(response.content).toBe('fixture response');
      expect(observed[0]).toMatchObject({ method: 'GET', url: fixture.listPath });
      expect(observed[1]).toMatchObject({
        method: 'POST',
        url: fixture.chatPath,
        auth: 'Bearer fixture-api-key',
      });
      expect(observed[1]?.body).toMatchObject({
        model: fixture.expectedModel.providerModelId,
        messages: [{ role: 'user', content: 'hello' }],
        max_tokens: 32,
      });
      if (fixture.expectedRequest) expect(observed[1]?.body).toMatchObject(fixture.expectedRequest);
    } finally {
      await closeServer(server);
    }
  });

  it('exposes vendor-specific default URLs', () => {
    expect(DEFAULT_PROVIDER_BASE_URLS).toMatchObject({
      openai: 'https://api.openai.com/v1',
      'google-gemini': 'https://generativelanguage.googleapis.com/v1beta',
      openrouter: 'https://openrouter.ai/api/v1',
      xai: 'https://api.x.ai/v1',
      mistral: 'https://api.mistral.ai/v1',
      deepseek: 'https://api.deepseek.com',
      groq: 'https://api.groq.com/openai/v1',
    });
  });

  it('registers every named adapter and refuses unsupported embeddings', async () => {
    const registry = createBuiltinModelProviders();
    for (const kind of [
      'openai-compatible',
      'openai',
      'anthropic',
      'google-gemini',
      'openrouter',
      'xai',
      'mistral',
      'deepseek',
      'groq',
      'azure-openai',
    ] as const) {
      expect(registry.get(kind)).toBeDefined();
    }
    for (const fixture of fixtures.filter(({ kind }) =>
      ['xai', 'deepseek', 'groq'].includes(kind),
    )) {
      const account = providerAccount(fixture.kind, 'http://127.0.0.1:1');
      await expect(
        fixture.provider.embed(account, model(account, 'fixture-model'), ['text']),
      ).rejects.toMatchObject({ code: -32046 });
    }
  });

  it.each([
    { provider: new OpenAIProvider(), kind: 'openai' as const, basePath: '/v1' },
    { provider: new OpenRouterProvider(), kind: 'openrouter' as const, basePath: '/api/v1' },
    { provider: new MistralProvider(), kind: 'mistral' as const, basePath: '/v1' },
  ])('$kind maps the shared embeddings wire format', async ({ provider, kind, basePath }) => {
    let observedUrl = '';
    let observedAuth = '';
    let observedBody: Record<string, unknown> | undefined;
    const server = createServer((request, response) => {
      void readJson(request).then((body) => {
        observedUrl = request.url ?? '';
        observedAuth = String(request.headers.authorization ?? '');
        observedBody = body;
        sendJson(response, {
          data: [
            { index: 1, embedding: [0.3, 0.4] },
            { index: 0, embedding: [0.1, 0.2] },
          ],
          usage: { prompt_tokens: 9 },
        });
      });
    });
    const baseUrl = await listen(server, basePath);
    const account = providerAccount(kind, baseUrl);
    try {
      const response = await provider.embed(account, model(account, 'embedding-fixture'), [
        'one',
        'two',
      ]);
      expect(observedUrl).toBe(`${basePath}/embeddings`);
      expect(observedAuth).toBe('Bearer fixture-api-key');
      expect(observedBody).toEqual({ model: 'embedding-fixture', input: ['one', 'two'] });
      expect(response.vectors).toEqual([
        [0.1, 0.2],
        [0.3, 0.4],
      ]);
      expect(response.usage.inputTokens).toBe(9);
    } finally {
      await closeServer(server);
    }
  });
});

describe('Google Gemini adapter', () => {
  it('paginates model metadata and uses Gemini auth, generation, streaming, and embeddings formats', async () => {
    const seen: { url?: string; auth?: string; bearer?: string; body?: Record<string, unknown> }[] =
      [];
    const server = createServer((request, response) => {
      void readJson(request).then((body) => {
        seen.push({
          url: request.url,
          auth: String(request.headers['x-goog-api-key'] ?? ''),
          bearer: String(request.headers.authorization ?? ''),
          body,
        });
        if (request.method === 'GET') {
          if (request.url?.includes('pageToken=page-2')) {
            sendJson(response, {
              models: [
                {
                  name: 'models/gemini-fixture',
                  displayName: 'Gemini Fixture',
                  inputTokenLimit: 131072,
                  outputTokenLimit: 8192,
                  supportedGenerationMethods: [
                    'generateContent',
                    'streamGenerateContent',
                    'embedContent',
                  ],
                },
              ],
            });
          } else {
            sendJson(response, { models: [{ name: 'models/ignore-me' }], nextPageToken: 'page-2' });
          }
          return;
        }
        if (request.url?.includes(':batchEmbedContents')) {
          sendJson(response, { embeddings: [{ values: [0.1, 0.2] }, { values: [0.3, 0.4] }] });
          return;
        }
        if (request.url?.includes(':streamGenerateContent')) {
          response.writeHead(200, { 'content-type': 'text/event-stream' });
          response.end(
            'data: {"candidates":[{"content":{"parts":[{"text":"gemini "}]},"finishReason":"STOP"}]}' +
              '\n\n' +
              'data: {"candidates":[{"content":{"parts":[{"text":"stream"},{"functionCall":{"name":"lookup","args":{"id":4}}}]},"finishReason":"STOP"}],"usageMetadata":{"promptTokenCount":5,"candidatesTokenCount":3}}\n\n',
          );
          return;
        }
        sendJson(response, {
          candidates: [{ content: { parts: [{ text: 'gemini response' }] }, finishReason: 'STOP' }],
          usageMetadata: { promptTokenCount: 6, candidatesTokenCount: 4 },
        });
      });
    });
    const baseUrl = await listen(server, '/v1beta');
    const account = providerAccount('google-gemini', baseUrl);
    const provider = new GoogleGeminiProvider();
    try {
      const discovered = await provider.listModels(account);
      expect(discovered).toEqual([
        {
          providerModelId: 'ignore-me',
          metadataSource: 'provider-api',
          sourceUrl: 'https://generativelanguage.googleapis.com/v1beta/models',
          confidence: 'high',
        },
        {
          providerModelId: 'gemini-fixture',
          displayName: 'Gemini Fixture',
          capabilities: {
            chat: true,
            streaming: true,
            embeddings: true,
            maxInputTokens: 131072,
            maxOutputTokens: 8192,
          },
          metadataSource: 'provider-api',
          sourceUrl: 'https://generativelanguage.googleapis.com/v1beta/models',
          confidence: 'high',
        },
      ]);
      expect(seen[0]?.url).toBe('/v1beta/models?pageSize=1000');
      expect(seen[1]?.url).toBe('/v1beta/models?pageSize=1000&pageToken=page-2');
      expect(seen[0]?.auth).toBe('fixture-api-key');
      expect(seen[0]?.bearer).toBe('');

      const modelData = model(account, 'gemini-fixture');
      const chatRequest: ChatRequest = {
        messages: [
          { role: 'system', content: 'system instruction' },
          { role: 'user', content: 'hello' },
        ],
        tools: [{ name: 'lookup', description: 'Find', inputSchema: { type: 'object' } }],
        responseFormat: { type: 'json_schema', schema: { type: 'object' } },
        maxTokens: 64,
        temperature: 0.25,
      };
      const json = await provider.complete(account, modelData, chatRequest, {
        signal: new AbortController().signal,
      });
      expect(json).toMatchObject({
        content: 'gemini response',
        usage: { inputTokens: 6, outputTokens: 4 },
      });
      expect(seen[2]?.url).toBe('/v1beta/models/gemini-fixture:generateContent');
      expect(seen[2]?.body).toMatchObject({
        systemInstruction: { parts: [{ text: 'system instruction' }] },
        contents: [{ role: 'user', parts: [{ text: 'hello' }] }],
        generationConfig: {
          maxOutputTokens: 64,
          temperature: 0.25,
          responseMimeType: 'application/json',
          responseSchema: { type: 'object' },
        },
        tools: [{ functionDeclarations: [{ name: 'lookup', parameters: { type: 'object' } }] }],
      });
      expect(seen[2]?.auth).toBe('fixture-api-key');

      const deltas: string[] = [];
      const stream = await provider.complete(
        account,
        modelData,
        { messages: [{ role: 'user', content: 'hello' }], stream: true },
        { signal: new AbortController().signal, onDelta: (delta) => deltas.push(delta) },
      );
      expect(seen[3]?.url).toBe('/v1beta/models/gemini-fixture:streamGenerateContent?alt=sse');
      expect(stream.content).toBe('gemini stream');
      expect(deltas).toEqual(['gemini ', 'stream']);
      expect(stream.toolCalls).toEqual([{ id: 'gemini-1', name: 'lookup', arguments: '{"id":4}' }]);
      expect(stream.usage).toMatchObject({ inputTokens: 5, outputTokens: 3 });

      const vectors = await provider.embed(account, modelData, ['one', 'two']);
      expect(seen[4]?.url).toBe('/v1beta/models/gemini-fixture:batchEmbedContents');
      expect(seen[4]?.body).toMatchObject({
        requests: [
          { model: 'models/gemini-fixture', content: { parts: [{ text: 'one' }] } },
          { model: 'models/gemini-fixture', content: { parts: [{ text: 'two' }] } },
        ],
      });
      expect(vectors.vectors).toEqual([
        [0.1, 0.2],
        [0.3, 0.4],
      ]);
    } finally {
      await closeServer(server);
    }
  });
});

describe('Azure OpenAI adapter', () => {
  it('does not expose the classic base-model catalog as invocable deployments', async () => {
    let calls = 0;
    const server = createServer((_request, response) => {
      calls++;
      sendJson(response, { data: [{ id: 'base-model' }] });
    });
    const baseUrl = await listen(server);
    const account = providerAccount('azure-openai', baseUrl);
    try {
      await expect(new AzureOpenAIProvider().listModels(account)).rejects.toMatchObject({
        code: -32602,
      });
      expect(calls).toBe(0);
    } finally {
      await closeServer(server);
    }
  });

  it('keeps classic base-model discovery separate from configured deployment invocation', async () => {
    const seen: { method?: string; url?: string; auth?: string; body?: Record<string, unknown> }[] =
      [];
    const server = createServer((request, response) => {
      void readJson(request).then((body) => {
        seen.push({
          method: request.method,
          url: request.url,
          auth: String(request.headers['api-key'] ?? ''),
          body,
        });
        if (request.method === 'GET') {
          sendJson(response, {
            data: [
              {
                id: 'gpt-4o',
                capabilities: { chat_completion: true, embeddings: true },
              },
            ],
          });
          return;
        }
        sendJson(response, {
          choices: [{ message: { content: 'azure response' }, finish_reason: 'stop' }],
          usage: { prompt_tokens: 3, completion_tokens: 2 },
        });
      });
    });
    const baseUrl = await listen(server);
    const account = providerAccount('azure-openai', baseUrl, {
      apiVersion: '2025-01-01-preview',
      deploymentName: 'studio-chat-deployment',
      catalogModelId: 'gpt-4o',
    });
    const provider = new AzureOpenAIProvider();
    try {
      const discovered = await provider.listModels(account);
      expect(discovered[0]).toMatchObject({
        providerModelId: 'studio-chat-deployment',
        catalogModelId: 'gpt-4o',
        displayName: 'studio-chat-deployment (gpt-4o)',
        capabilities: {
          chat: true,
          embeddings: true,
        },
        fieldMetadata: {
          catalogModelId: {
            source: 'account-config',
            sourceUrl: null,
            confidence: 'high',
          },
        },
      });
      expect(seen[0]?.url).toBe('/openai/models?api-version=2025-01-01-preview');
      expect(seen[0]?.auth).toBe('fixture-api-key');
      expect(seen[0]?.body).toBeUndefined();
      const result = await provider.complete(
        account,
        model(account, 'studio-chat-deployment'),
        { messages: [{ role: 'user', content: 'hello' }], maxTokens: 64 },
        { signal: new AbortController().signal },
      );
      expect(result.content).toBe('azure response');
      expect(seen[1]).toMatchObject({
        method: 'POST',
        url: '/openai/deployments/studio-chat-deployment/chat/completions?api-version=2025-01-01-preview',
        auth: 'fixture-api-key',
        body: { messages: [{ role: 'user', content: 'hello' }], max_tokens: 64 },
      });
      expect(seen[1]?.body).not.toHaveProperty('model');
      expect(seen[1]?.auth).not.toContain('Bearer');
    } finally {
      await closeServer(server);
    }
  });

  it('uses Azure v1 model aliases and OpenAI-shaped request bodies', async () => {
    const seen: { method?: string; url?: string; auth?: string; body?: Record<string, unknown> }[] =
      [];
    const server = createServer((request, response) => {
      void readJson(request).then((body) => {
        seen.push({
          method: request.method,
          url: request.url,
          auth: String(request.headers['api-key'] ?? ''),
          body,
        });
        if (request.method === 'GET') sendJson(response, { data: [{ id: 'deployment-alias' }] });
        else
          sendJson(response, {
            choices: [{ message: { content: 'v1 response' }, finish_reason: 'stop' }],
          });
      });
    });
    const baseUrl = await listen(server, '/openai/v1');
    const account = providerAccount('azure-openai', baseUrl, { apiVersion: 'ignored-on-v1' });
    try {
      const provider = new AzureOpenAIProvider();
      expect((await provider.listModels(account))[0]?.providerModelId).toBe('deployment-alias');
      await provider.complete(
        account,
        model(account, 'deployment-alias'),
        { messages: [{ role: 'user', content: 'hello' }] },
        { signal: new AbortController().signal },
      );
      expect(seen[0]?.url).toBe('/openai/v1/models');
      expect(seen[1]?.url).toBe('/openai/v1/chat/completions');
      expect(seen[1]?.body).toMatchObject({
        model: 'deployment-alias',
        messages: [{ role: 'user', content: 'hello' }],
      });
      expect(seen[1]?.auth).toBe('fixture-api-key');
    } finally {
      await closeServer(server);
    }
  });
});

function providerAccount(
  providerKind: ProviderKind,
  baseUrl: string,
  providerOptions: Record<string, string> = {},
): ProviderRuntimeAccount {
  return {
    accountId: '019535d4-2c00-7000-8000-000000000499',
    providerKind,
    displayName: `Fixture ${providerKind}`,
    baseUrl,
    providerOptions,
    hasCredential: true,
    headers: {},
    isLocal: true,
    privacy: 'local',
    enabled: true,
    createdAt: '2026-09-28T00:00:00.000Z',
    updatedAt: '2026-09-28T00:00:00.000Z',
    apiKey: 'fixture-api-key',
  };
}

function model(account: ProviderRuntimeAccount, providerModelId: string): Model {
  return {
    modelId: `${account.accountId}/${providerModelId}`,
    accountId: account.accountId,
    providerModelId,
    catalogModelId: null,
    displayName: providerModelId,
    capabilities: {
      chat: null,
      tools: null,
      vision: null,
      structuredOutput: null,
      streaming: null,
      embeddings: null,
      contextWindow: null,
      maxOutputTokens: null,
    },
    pricing: { inputPerMTokUsd: null, outputPerMTokUsd: null },
    metadataSource: 'provider',
    metadataUpdatedAt: '2026-09-28T00:00:00.000Z',
    metadataFields: {},
    enabled: true,
    tags: [],
    workTypes: [],
    roles: [],
  };
}

async function listen(server: ReturnType<typeof createServer>, basePath = ''): Promise<string> {
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('Fixture server has no TCP address');
  return `http://127.0.0.1:${address.port}${basePath}`;
}

async function closeServer(server: ReturnType<typeof createServer>): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    server.close((error) => (error ? reject(error) : resolve()));
  });
}

async function readJson(request: IncomingMessage): Promise<Record<string, unknown> | undefined> {
  let body = '';
  for await (const chunk of request) body += String(chunk);
  return body ? (JSON.parse(body) as Record<string, unknown>) : undefined;
}

function respond(
  request: IncomingMessage,
  response: ServerResponse,
  modelPath: string,
  models: { data?: Record<string, unknown>[]; models?: Record<string, unknown>[] },
): void {
  if (request.method === 'GET' && request.url === modelPath) {
    sendJson(response, models);
    return;
  }
  sendJson(response, {
    choices: [{ message: { content: 'fixture response' }, finish_reason: 'stop' }],
    usage: { prompt_tokens: 2, completion_tokens: 1 },
  });
}

function sendJson(response: ServerResponse, value: unknown): void {
  response.writeHead(200, { 'content-type': 'application/json' });
  response.end(JSON.stringify(value));
}

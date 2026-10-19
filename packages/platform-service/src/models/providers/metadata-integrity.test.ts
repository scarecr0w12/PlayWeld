import { describe, expect, it, vi } from 'vitest';
import { AnthropicProvider } from './anthropic';
import { GoogleGeminiProvider } from './google-gemini';
import { OpenAICompatibleProvider } from './openai-compatible';
import { GroqProvider, OpenRouterProvider } from './openai-providers';
import type { ProviderRuntimeAccount } from './provider';
const account = {
  accountId: 'fixture',
  baseUrl: 'https://provider.invalid',
  headers: {},
  providerOptions: {},
} as ProviderRuntimeAccount;
const reply = (data: unknown) => new Response(JSON.stringify(data));

describe('provider metadata integrity', () => {
  it('retrieves every Anthropic page and parses published capabilities and limits', async () => {
    const fetcher = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(
        reply({
          data: [
            {
              id: 'a',
              max_input_tokens: 200000,
              max_tokens: 16000,
              capabilities: {
                image_input: { supported: true },
                structured_outputs: { supported: false },
              },
            },
          ],
          has_more: true,
          last_id: 'a',
        }),
      )
      .mockResolvedValueOnce(reply({ data: [{ id: 'b' }], has_more: false }));
    try {
      const models = await new AnthropicProvider().listModels(account);
      expect(models.map((model) => model.providerModelId)).toEqual(['a', 'b']);
      expect(models[0].capabilities).toMatchObject({
        maxInputTokens: 200000,
        maxOutputTokens: 16000,
        vision: true,
        structuredOutput: false,
      });
      expect(String(fetcher.mock.calls[1][0])).toContain('after_id=a');
    } finally {
      fetcher.mockRestore();
    }
  });
  it('rejects repeated Anthropic cursors rather than reconciling a partial list', async () => {
    const fetcher = vi
      .spyOn(globalThis, 'fetch')
      .mockImplementation(async () => reply({ data: [{ id: 'a' }], has_more: true, last_id: 'a' }));
    try {
      await expect(new AnthropicProvider().listModels(account)).rejects.toThrow(/pagination/i);
    } finally {
      fetcher.mockRestore();
    }
  });
  it.each([
    {
      provider: new GoogleGeminiProvider(),
      data: { models: [{ name: 'models/a', inputTokenLimit: -1, outputTokenLimit: -2 }] },
    },
    {
      provider: new AnthropicProvider(),
      data: {
        data: [{ id: 'a', max_input_tokens: -1, max_tokens: -2, pricing: { inputPerMTokUsd: -1 } }],
      },
    },
    {
      provider: new GroqProvider(),
      data: { data: [{ id: 'a', context_window: -1, max_completion_tokens: -2 }] },
    },
    {
      provider: new OpenAICompatibleProvider(),
      data: {
        data: [
          {
            id: 'a',
            context_length: -1,
            capabilities: { maxOutputTokens: -2 },
            pricing: { inputPerMTokUsd: -1 },
          },
        ],
      },
    },
    {
      provider: new OpenRouterProvider(),
      data: {
        data: [
          {
            id: 'a',
            context_length: -1,
            top_provider: { max_completion_tokens: -2 },
            pricing: { prompt: '-1' },
          },
        ],
      },
    },
  ])('does not accept negative limits or rates from $provider', async ({ provider, data }) => {
    const fetcher = vi.spyOn(globalThis, 'fetch').mockResolvedValue(reply(data));
    try {
      const [model] = await provider.listModels(account);
      for (const value of Object.values(model.capabilities ?? {}))
        if (typeof value === 'number') expect(value).toBeGreaterThanOrEqual(0);
      for (const value of Object.values(model.pricing ?? {}))
        if (typeof value === 'number') expect(value).toBeGreaterThanOrEqual(0);
    } finally {
      fetcher.mockRestore();
    }
  });
  it('rejects partial compatible lists and malformed pagination signals', async () => {
    const fetcher = vi.spyOn(globalThis, 'fetch');
    try {
      fetcher.mockResolvedValueOnce(reply({ data: [{ id: 'a' }], has_more: true }));
      await expect(new OpenAICompatibleProvider().listModels(account)).rejects.toThrow(
        /model list/i,
      );
      fetcher.mockResolvedValueOnce(reply({ data: [{ id: 'a' }], has_more: 'yes' }));
      await expect(new AnthropicProvider().listModels(account)).rejects.toThrow(/model list/i);
      fetcher.mockResolvedValueOnce(reply({ models: [{ name: 'models/a' }], nextPageToken: 1 }));
      await expect(new GoogleGeminiProvider().listModels(account)).rejects.toThrow(/model list/i);
    } finally {
      fetcher.mockRestore();
    }
  });
  it('keeps invalid boolean token limits unknown', async () => {
    const fetcher = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue(reply({ data: [{ id: 'a', capabilities: { contextWindow: true } }] }));
    try {
      expect(
        (await new OpenAICompatibleProvider().listModels(account))[0].capabilities?.contextWindow,
      ).toBeUndefined();
    } finally {
      fetcher.mockRestore();
    }
  });
  it.each([
    { name: 'existing' },
    { model_id: 'existing' },
    { id: '', name: 'existing' },
    { id: 42, name: 'existing' },
  ])('rejects generic identifiers the parser cannot retain: %j', async (entry) => {
    const fetcher = vi.spyOn(globalThis, 'fetch').mockResolvedValue(reply({ data: [entry] }));
    try {
      await expect(new OpenAICompatibleProvider().listModels(account)).rejects.toThrow(
        /model list/i,
      );
    } finally {
      fetcher.mockRestore();
    }
  });
  it('rejects malformed model lists rather than declaring every model unavailable', async () => {
    const fetcher = vi
      .spyOn(globalThis, 'fetch')
      .mockImplementation(async () => reply({ error: 'invalid shape' }));
    try {
      for (const provider of [
        new OpenAICompatibleProvider(),
        new AnthropicProvider(),
        new GoogleGeminiProvider(),
      ]) {
        await expect(provider.listModels(account)).rejects.toThrow(/model list/i);
      }
    } finally {
      fetcher.mockRestore();
    }
  });
});

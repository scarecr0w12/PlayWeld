import { describe, expect, it, vi } from 'vitest';
import type { Model, RouteDecision } from '@gamecrafter/contracts';
import { CompletionService } from './completion-service';
import type { ModelRegistry } from './model-registry';
import { ModelRouter } from './router';

describe('prepared agent completion', () => {
  it('uses the same selected model for summaries and completion without rerouting', async () => {
    const model = {
      modelId: 'account/selected',
      accountId: 'account',
      enabled: true,
      capabilities: { streaming: false },
    } as Model;
    const decision = {
      decisionId: 'decision',
      modelId: model.modelId,
      context: { taskType: 'test' },
    } as RouteDecision;
    const route = vi.fn(() => decision);
    const providerComplete = vi.fn<(_account: unknown, _model: Model) => Promise<unknown>>(
      async () => ({
        content: 'Done',
        toolCalls: [],
        finishReason: 'stop',
        usage: { inputTokens: 5, outputTokens: 2, costUsd: null, costStatus: 'unknown' },
        latencyMs: 1,
        modelId: model.modelId,
        decisionId: null,
      }),
    );
    const service = new CompletionService(
      {
        getModel: () => model,
        getRuntimeAccount: () => ({ enabled: true, providerKind: 'fake' }),
        getProvider: () => ({ complete: providerComplete }),
      } as unknown as ModelRegistry,
      {
        route,
        boundCompletion: (_model: Model, request: unknown) => request,
        reportOutcome: vi.fn(),
        recordModelUsage: vi.fn(),
      } as unknown as ModelRouter,
    );
    const prepared = service.prepare({ taskType: 'test' });
    const request = {
      route: { taskType: 'test' },
      request: { messages: [{ role: 'user' as const, content: 'Continue' }] },
    };
    await service.complete(request, {}, prepared);
    await service.complete(request, {}, prepared);
    expect(route).toHaveBeenCalledTimes(1);
    expect(providerComplete).toHaveBeenCalledTimes(2);
    for (const call of providerComplete.mock.calls) expect(call[1]).toBe(model);
  });
});

describe('completion dispatch budget gate', () => {
  function fixture(overrides: Partial<Model> = {}, budget = 1) {
    let model = {
      modelId: 'account/model',
      accountId: 'account',
      enabled: true,
      capabilities: {
        chat: true,
        tools: true,
        streaming: false,
        contextWindow: 10000,
        maxInputTokens: 9000,
        maxOutputTokens: 1000,
      },
      pricing: { inputPerMTokUsd: 1, outputPerMTokUsd: 2 },
      metadataFields: {},
      ...overrides,
    } as Model;
    const complete = vi.fn(async () => ({
      content: 'Done',
      toolCalls: [],
      finishReason: 'stop',
      usage: { inputTokens: 5, outputTokens: 2, costUsd: 0.000009 },
      latencyMs: 1,
    }));
    const embed = vi.fn(async () => ({
      vectors: [[1]],
      usage: { inputTokens: 1, outputTokens: 0, costUsd: 0 },
    }));
    const registry = {
      listPools: () => [],
      getModel: () => model,
      getRuntimeAccount: () => ({ enabled: true, providerKind: 'fake' }),
      getProvider: () => ({ complete, embed }),
    } as unknown as ModelRegistry;
    const router = new ModelRouter({
      registry,
      database: {} as never,
      settings: { resolve: () => ({ value: budget }) as never },
    });
    router.recordModelUsage = vi.fn();
    router.reportOutcome = vi.fn();
    const service = new CompletionService(registry, router);
    return {
      service,
      router,
      complete,
      embed,
      setModel(value: Model) {
        model = value;
      },
      model,
    };
  }

  it.each([
    {
      name: 'unknown pricing',
      model: { pricing: { inputPerMTokUsd: null, outputPerMTokUsd: null } },
    },
    {
      name: 'stale pricing',
      model: {
        metadataFields: {
          'pricing.inputPerMTokUsd': {
            source: 'provider-api',
            updatedAt: '2020-01-01T00:00:00.000Z',
            sourceUrl: null,
            confidence: 'high',
            stale: true,
          },
        },
      },
    },
    {
      name: 'missing token bounds',
      model: { capabilities: { chat: true, contextWindow: null, maxOutputTokens: null } },
    },
  ])('rejects $name before the provider is called', async ({ model }) => {
    const f = fixture(model as Partial<Model>);
    await expect(
      f.service.complete({
        modelId: f.model.modelId,
        request: { messages: [{ role: 'user', content: 'Hello' }] },
      }),
    ).rejects.toThrow();
    expect(f.complete).not.toHaveBeenCalled();
  });

  it.each(['capabilities.maxInputTokens', 'capabilities.maxOutputTokens'])(
    'rejects expired %s when deriving a monetary upper bound',
    async (field) => {
      const f = fixture({
        metadataFields: {
          [field]: {
            source: 'provider-api',
            updatedAt: '2020-01-01T00:00:00.000Z',
            sourceUrl: null,
            confidence: 'high',
            expiresAt: '2000-01-01T00:00:00.000Z',
          },
        },
      });
      await expect(
        f.service.complete({
          modelId: f.model.modelId,
          request: { messages: [{ role: 'user', content: 'Hi' }] },
        }),
      ).rejects.toThrow();
      expect(f.complete).not.toHaveBeenCalled();
    },
  );

  it('rejects a cheap average-sized estimate whose full token bound exceeds the budget', async () => {
    const f = fixture({}, 0.005);
    await expect(
      f.service.complete({
        modelId: f.model.modelId,
        request: { messages: [{ role: 'user', content: 'Hello' }], maxTokens: 1000 },
      }),
    ).rejects.toThrow();
    expect(f.complete).not.toHaveBeenCalled();
  });

  it.each(['input', 'output'])('rejects oversized %s before dispatch', async (kind) => {
    const f = fixture();
    await expect(
      f.service.complete({
        modelId: f.model.modelId,
        request: {
          messages: [{ role: 'user', content: kind === 'input' ? 'x'.repeat(10001) : 'Hi' }],
          maxTokens: kind === 'output' ? 1001 : 1000,
        },
      }),
    ).rejects.toThrow();
    expect(f.complete).not.toHaveBeenCalled();
  });

  it('rechecks a prepared model after it becomes unavailable', async () => {
    const f = fixture();
    const prepared = {
      model: f.model,
      decision: { modelId: f.model.modelId, context: { taskType: 'test' } } as RouteDecision,
    };
    f.setModel({ ...f.model, availability: 'unavailable' });
    await expect(
      f.service.complete(
        { modelId: f.model.modelId, request: { messages: [{ role: 'user', content: 'Hi' }] } },
        {},
        prepared,
      ),
    ).rejects.toThrow();
    expect(f.complete).not.toHaveBeenCalled();
  });

  it.each([{ remainingCostUsd: 0.005 }, { remainingTokens: 9999 }])(
    'rejects a request exceeding the remaining task budget %j',
    async (context) => {
      const f = fixture();
      await expect(
        f.service.complete(
          { modelId: f.model.modelId, request: { messages: [{ role: 'user', content: 'Hello' }] } },
          context,
        ),
      ).rejects.toThrow();
      expect(f.complete).not.toHaveBeenCalled();
    },
  );

  it('rechecks every required capability on a prepared route before dispatch', async () => {
    const f = fixture({
      capabilities: { chat: true, vision: true, contextWindow: 10000, maxOutputTokens: 1000 },
    } as Partial<Model>);
    const prepared = {
      model: f.model,
      decision: { modelId: f.model.modelId, context: { taskType: 'test' } } as RouteDecision,
      routeRequest: { taskType: 'test', requiredCapabilities: ['vision' as const] },
    };
    f.setModel({ ...f.model, capabilities: { ...f.model.capabilities, vision: false } });
    await expect(
      f.service.complete(
        { modelId: f.model.modelId, request: { messages: [{ role: 'user', content: 'Hi' }] } },
        {},
        prepared,
      ),
    ).rejects.toThrow();
    expect(f.complete).not.toHaveBeenCalled();
  });

  it('preserves a prepared route cost constraint at dispatch', async () => {
    const f = fixture();
    const prepared = {
      model: f.model,
      decision: { modelId: f.model.modelId, context: { taskType: 'test' } } as RouteDecision,
      routeRequest: { taskType: 'test', constraints: { maxCostUsd: 0.005 } },
    };
    await expect(
      f.service.complete(
        { modelId: f.model.modelId, request: { messages: [{ role: 'user', content: 'Hi' }] } },
        {},
        prepared,
      ),
    ).rejects.toThrow();
    expect(f.complete).not.toHaveBeenCalled();
  });

  it('uses the top-level project budget for a routed completion', async () => {
    const f = fixture();
    f.router.route = vi.fn(
      () =>
        ({
          modelId: f.model.modelId,
          decisionId: 'decision',
          context: { projectId: 'project', taskType: 'test' },
        }) as RouteDecision,
    );
    const bound = f.router.boundCompletion.bind(f.router);
    f.router.boundCompletion = (model, request, route, ...rest) => {
      expect(route.projectId).toBe('project');
      return bound(model, request, route, ...rest);
    };
    await f.service.complete({
      projectId: 'project',
      route: { taskType: 'test' },
      request: { messages: [{ role: 'user', content: 'Hello' }] },
    });
    expect(f.complete).toHaveBeenCalledTimes(1);
  });

  it.each([
    { availability: 'unavailable', embeddings: true },
    { availability: 'available', embeddings: false },
    { availability: 'available', embeddings: null },
  ] as const)(
    'rejects unsafe embedding dispatch %j before provider use',
    async ({ availability, embeddings }) => {
      const f = fixture({ availability, capabilities: { embeddings } } as Partial<Model>);
      await expect(f.service.embed(f.model.modelId, ['Hello'])).rejects.toThrow();
      expect(f.embed).not.toHaveBeenCalled();
    },
  );

  it('caps output on a safely priced bounded request', async () => {
    const f = fixture();
    await f.service.complete({
      modelId: f.model.modelId,
      request: { messages: [{ role: 'user', content: 'Hello' }] },
    });
    expect(f.complete).toHaveBeenCalledWith(
      expect.anything(),
      expect.anything(),
      expect.objectContaining({ maxTokens: 1000 }),
      expect.anything(),
    );
  });

  it('retains unbudgeted unknown-price behavior when no monetary constraint is configured', async () => {
    const f = fixture({ pricing: { inputPerMTokUsd: null, outputPerMTokUsd: null } }, Infinity);
    await f.service.complete({
      modelId: f.model.modelId,
      request: { messages: [{ role: 'user', content: 'Hello' }] },
    });
    expect(f.complete).toHaveBeenCalledTimes(1);
  });
});

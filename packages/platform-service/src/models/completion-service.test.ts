import { describe, expect, it, vi } from 'vitest';
import type { Model, RouteDecision } from '@gamecrafter/contracts';
import { CompletionService } from './completion-service';
import type { ModelRegistry } from './model-registry';
import type { ModelRouter } from './router';

describe('prepared agent completion', () => {
  it('uses the same selected model for summaries and completion without rerouting', async () => {
    const model = {
      modelId: 'account/selected',
      accountId: 'account',
      enabled: true,
      capabilities: { streaming: false },
    } as Model;
    const decision = { decisionId: 'decision', modelId: model.modelId } as RouteDecision;
    const route = vi.fn(() => decision);
    const providerComplete = vi.fn<(_account: unknown, _model: Model) => Promise<unknown>>(
      async () => ({
        content: 'Done',
        toolCalls: [],
        finishReason: 'stop',
        usage: { inputTokens: 5, outputTokens: 2 },
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
      { route, reportOutcome: vi.fn() } as unknown as ModelRouter,
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

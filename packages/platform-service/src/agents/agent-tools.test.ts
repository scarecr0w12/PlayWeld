import { describe, expect, it, vi } from 'vitest';
import { RpcErrorCode, type TaskRecord } from '@gamecrafter/contracts';
import { registerAgentTools, type AgentToolOptions } from './agent-tools';
import { ToolRegistry, type ToolContext } from '../tools/tool-registry';

describe('agent delegation locks', () => {
  it.each(['ready', 'succeeded', 'failed', 'cancelled', 'waiting_input'])(
    'rejects delegation from a %s parent without creating work',
    (state) => {
      const create = vi.fn();
      const registry = new ToolRegistry();
      registerAgentTools(registry, {
        tasks: { get: () => ({ taskId: 'parent', state, budget: {} }), create },
      } as unknown as AgentToolOptions);
      expect(() =>
        registry
          .get('tasks/delegate')!
          .handler({ taskId: 'parent', projectId: 'project' } as ToolContext, {
            role: 'writer',
            goal: 'Write',
          }),
      ).toThrowError(expect.objectContaining({ code: RpcErrorCode.InvalidTaskTransition }));
      expect(create).not.toHaveBeenCalled();
    },
  );

  it('inherits and narrows parent cost and duration envelopes without inventing tokens', async () => {
    const create = vi.fn(() => ({ task: { taskId: 'child' }, deduplicated: false }));
    const registry = new ToolRegistry();
    registerAgentTools(registry, {
      tasks: {
        get: () => ({
          taskId: 'parent',
          state: 'running',
          budget: { maxCostUsd: 1, maxDurationMs: 1000 },
        }),
        create,
      },
      roles: { get: () => ({ name: 'writer', maxAccess: 'restricted', isolation: 'none' }) },
      locks: { list: () => [] },
    } as unknown as AgentToolOptions);
    const delegate = registry.get('tasks/delegate')!.handler;
    const context = {
      taskId: 'parent',
      projectId: 'project',
      accessMode: 'restricted',
    } as ToolContext;
    await delegate(context, { role: 'writer', goal: 'Write' });
    expect(create).toHaveBeenLastCalledWith(
      expect.objectContaining({ budget: { maxCostUsd: 1, maxDurationMs: 1000 } }),
    );
    await delegate(context, {
      role: 'writer',
      goal: 'Write',
      budget: { maxCostUsd: 9, maxDurationMs: 500, maxTokens: 100 },
    });
    expect(create).toHaveBeenLastCalledWith(
      expect.objectContaining({ budget: { maxCostUsd: 1, maxDurationMs: 500 } }),
    );
  });
  it.each([undefined, 250_000])('inherits only the user token ceiling (%s)', async (maxTokens) => {
    const create = vi.fn(() => ({ task: { taskId: 'child' }, deduplicated: false }));
    const registry = new ToolRegistry();
    registerAgentTools(registry, {
      tasks: {
        get: () => ({
          taskId: 'parent',
          state: 'running',
          budget: maxTokens === undefined ? {} : { maxTokens },
        }),
        create,
      },
      roles: { get: () => ({ name: 'writer', maxAccess: 'restricted', isolation: 'none' }) },
      locks: { list: () => [] },
    } as unknown as AgentToolOptions);
    await registry
      .get('tasks/delegate')!
      .handler(
        { taskId: 'parent', projectId: 'project', accessMode: 'restricted' } as ToolContext,
        { role: 'writer', goal: 'Write', budget: { maxTokens: 60_000, maxCostUsd: 1 } },
      );
    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({
        budget: maxTokens === undefined ? { maxCostUsd: 1 } : { maxTokens, maxCostUsd: 1 },
      }),
    );
  });
  it('rejects a child write blocked by its parent without creating work or releasing locks', async () => {
    const create = vi.fn(() => ({ task: { taskId: 'child' }, deduplicated: false }));
    const release = vi.fn();
    const locks = [{ taskId: 'parent', resource: 'file:docs/canon/WORLD.md', mode: 'exclusive' }];
    const registry = new ToolRegistry();
    registerAgentTools(registry, {
      tasks: { get: () => ({ taskId: 'parent', state: 'running', budget: {} }), create },
      roles: {
        get: () => ({ name: 'narrative-designer', maxAccess: 'restricted', isolation: 'none' }),
      },
      locks: { list: () => locks, release },
    } as unknown as AgentToolOptions);
    const context = {
      taskId: 'parent',
      projectId: 'project',
      accessMode: 'ask-always',
    } as ToolContext;
    const delegate = registry.get('tasks/delegate')!.handler;
    const input = {
      role: 'narrative-designer',
      goal: 'Write canon',
      touches: [{ resource: 'file:docs/canon/WORLD.md', intent: 'write' }],
    };
    expect(() => delegate(context, input)).toThrow(
      expect.objectContaining({ code: RpcErrorCode.LockConflict }),
    );
    expect(create).not.toHaveBeenCalled();
    expect(release).not.toHaveBeenCalled();
    expect(await delegate(context, { ...input, isolation: 'worktree' })).toMatchObject({
      output: { taskId: 'child' },
    });
    expect(create).toHaveBeenCalledWith(expect.objectContaining({ isolation: 'worktree' }));
    create.mockClear();
    locks.splice(0);
    expect(await delegate(context, input)).toMatchObject({ output: { taskId: 'child' } });
    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({
        parentTaskId: 'parent',
        assignee: { role: 'narrative-designer', accessCeiling: 'ask-always' },
        touches: input.touches,
      }),
    );
  });
});

describe('agent model cost reporting', () => {
  it('passes remaining task money and tokens into the completion dispatch gate', async () => {
    const complete = vi.fn(async () => ({
      usage: { costUsd: 0, inputTokens: 1, outputTokens: 1 },
    }));
    const registry = new ToolRegistry();
    registerAgentTools(registry, {
      tasks: {
        runtime: () => budgetRuntime(),
        get: () => ({
          taskId: 'task',
          role: 'programmer',
          budget: { maxCostUsd: 1, maxTokens: 10000 },
          spent: { costUsd: 0.4, tokens: 2000 },
        }),
      },
      roles: { get: () => ({ workTypes: ['code'] }) },
      completion: { complete },
    } as unknown as AgentToolOptions);
    await registry
      .get('model/complete')!
      .handler({ taskId: 'task', projectId: 'project', accessMode: 'restricted' } as ToolContext, {
        request: { messages: [{ role: 'user', content: 'fixture' }] },
      });
    expect(complete).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        remainingCostUsd: 0.6,
        remainingTokens: 8000,
      }),
      undefined,
    );
  });

  it('preserves unknown model cost on the paid model tool result', async () => {
    const registry = new ToolRegistry();
    registerAgentTools(registry, {
      tasks: {
        runtime: () => budgetRuntime(),
        get: () => ({
          taskId: 'task',
          role: 'programmer',
          budget: {},
          spent: { costUsd: 0, tokens: 0 },
        }),
      },
      roles: { get: () => ({ workTypes: ['code'] }) },
      completion: {
        complete: vi.fn(async () => ({
          content: 'Reply',
          modelId: 'provider/model',
          finishReason: 'stop',
          toolCalls: [],
          usage: {
            inputTokens: 4,
            outputTokens: 2,
            costUsd: null,
            costStatus: 'unknown',
          },
          latencyMs: 1,
          decisionId: null,
        })),
      },
    } as unknown as AgentToolOptions);

    const result = await registry
      .get('model/complete')!
      .handler({ taskId: 'task', projectId: 'project', accessMode: 'restricted' } as ToolContext, {
        request: { messages: [{ role: 'user', content: 'fixture' }] },
      });

    expect(result).toMatchObject({ costUsd: null, costStatus: 'unknown' });
  });
});

function budgetRuntime() {
  return {
    store: {
      tree: () => [
        {
          taskId: 'task',
          budget: { maxCostUsd: 1, maxTokens: 10000 },
          spent: { costUsd: 0.4, tokens: 2000 },
        } as TaskRecord,
      ],
      events: () => [],
      appendEvent: vi.fn(),
    },
    graph: { update: vi.fn() },
  };
}

import { describe, expect, it, vi } from 'vitest';
import { RpcErrorCode } from '@gamecrafter/contracts';
import { registerAgentTools, type AgentToolOptions } from './agent-tools';
import { ToolRegistry, type ToolContext } from '../tools/tool-registry';

describe('agent delegation locks', () => {
  it.each([undefined, 250_000])('inherits only the user token ceiling (%s)', async (maxTokens) => {
    const create = vi.fn(() => ({ task: { taskId: 'child' }, deduplicated: false }));
    const registry = new ToolRegistry();
    registerAgentTools(registry, {
      tasks: {
        get: () => ({ taskId: 'parent', budget: maxTokens === undefined ? {} : { maxTokens } }),
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
      tasks: { get: () => ({ taskId: 'parent', budget: {} }), create },
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

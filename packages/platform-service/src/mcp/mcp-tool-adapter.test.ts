import { describe, expect, it, vi } from 'vitest';
import { uuidv7, type McpConnectionConfig } from '@gamecrafter/contracts';
import { ToolRegistry } from '../tools/tool-registry';
import { McpToolAdapter } from './mcp-tool-adapter';
import type { McpToolDescriptor } from './session';

const connection: McpConnectionConfig = {
  connectionId: uuidv7(),
  name: 'fixture-tools',
  scope: 'platform',
  projectId: null,
  mode: 'command',
  command: { command: 'fixture', args: [], env: {} },
  allowServerInitiatedModelCalls: false,
  enabled: true,
  timeoutsMs: { connect: 15_000, request: 60_000 },
  tags: [],
  createdAt: '2026-09-28T00:00:00.000Z',
  updatedAt: '2026-09-28T00:00:00.000Z',
};

const objectSchema = {
  type: 'object',
  properties: { value: { type: 'string' } },
  additionalProperties: false,
};

const tools: McpToolDescriptor[] = [
  { name: 'echo', inputSchema: objectSchema, annotations: { readOnlyHint: true } },
  { name: 'write_file', inputSchema: objectSchema, annotations: { destructiveHint: true } },
  { name: 'unannotated', inputSchema: objectSchema },
  { name: 'execute_code', inputSchema: objectSchema, annotations: { readOnlyHint: true } },
];

describe('McpToolAdapter', () => {
  it('rejects a foreign Project before invoking a Project-scoped server', async () => {
    const registry = new ToolRegistry();
    const adapter = new McpToolAdapter(registry);
    const owner = uuidv7();
    const invoke = vi.fn(async () => ({ content: [{ type: 'text', text: 'private scene' }] }));
    adapter.register(
      { ...connection, scope: 'project', projectId: owner },
      [tools[0]!],
      () => ({ sideEffects: 'none', executionMode: 'live-editor' }),
      invoke,
    );
    const context = {
      projectId: uuidv7(),
      projectPath: '/tmp/other',
      taskId: null,
      agentId: null,
      accessMode: 'full' as const,
      callId: uuidv7(),
      signal: new AbortController().signal,
    };
    await expect(registry.get('fixture-tools/echo')!.handler(context, {})).rejects.toThrow(
      /Project/,
    );
    expect(invoke).not.toHaveBeenCalled();
    await expect(
      registry.get('fixture-tools/echo')!.handler({ ...context, projectId: owner }, {}),
    ).resolves.toMatchObject({ output: { content: expect.any(Array) } });
    expect(invoke).toHaveBeenCalledTimes(1);
  });
  it('validates structured MCP content while retaining the response envelope', async () => {
    const registry = new ToolRegistry();
    const adapter = new McpToolAdapter(registry);
    const output = {
      content: [{ type: 'text', text: 'Scene inspected' }],
      structuredContent: { value: 'Scene' },
    };
    adapter.register(
      connection,
      [{ name: 'scene', inputSchema: objectSchema, outputSchema: objectSchema }],
      () => ({ sideEffects: 'none', executionMode: 'live-editor' }),
      async () => output,
    );
    const tool = registry.get('fixture-tools/scene')!;
    expect(registry.validateOutput(tool, output)).toEqual([]);
    expect(
      registry.validateOutput(tool, { ...output, structuredContent: { value: 42 } }),
    ).not.toEqual([]);
    expect(registry.validateOutput(tool, { content: output.content })).not.toEqual([]);
    expect(registry.validateOutput(tool, { value: 'Scene' })).not.toEqual([]);
    const result = await tool.handler(
      {
        projectId: uuidv7(),
        projectPath: '/tmp/project',
        taskId: null,
        agentId: null,
        accessMode: 'full',
        callId: uuidv7(),
        signal: new AbortController().signal,
      },
      {},
    );
    expect(result.output).toEqual(output);
  });
  it.each([
    { status: 'error', error: 'Python NameError', result: { success: false } },
    { status: 'error', error: 'No running editor' },
  ])('reports CodeFizz failures while preserving successful results: %j', async (failure) => {
    const registry = new ToolRegistry();
    const adapter = new McpToolAdapter(registry);
    let failed = true;
    adapter.register(
      connection,
      ['get_project_context', 'connect_editor', 'execute_python'].map((name) => ({
        name,
        inputSchema: objectSchema,
      })),
      () => ({ sideEffects: null, executionMode: null }),
      async () => ({
        content: [
          {
            type: 'text',
            text: JSON.stringify(
              failed ? failure : { status: 'success', result: { success: true } },
            ),
          },
        ],
      }),
    );
    const context = {
      projectId: uuidv7(),
      projectPath: '/tmp/project',
      taskId: null,
      agentId: null,
      accessMode: 'full' as const,
      callId: uuidv7(),
      signal: new AbortController().signal,
    };
    await expect(
      registry.get('fixture-tools/execute_python')!.handler(context, {}),
    ).rejects.toThrow(failure.error);
    failed = false;
    expect(
      (await registry.get('fixture-tools/execute_python')!.handler(context, {})).output,
    ).toBeDefined();
  });

  it('registers namespaced tools with safe default metadata and user overrides', async () => {
    const registry = new ToolRegistry();
    const adapter = new McpToolAdapter(registry);
    const invoke = vi.fn(async (...args: unknown[]) => ({ name: args[0] as string }));
    adapter.register(
      connection,
      tools,
      (name) =>
        name === 'unannotated'
          ? { sideEffects: 'paid', executionMode: 'project-file' }
          : { sideEffects: null, executionMode: null },
      (name, input, context) => invoke(name, input, context),
    );

    const definitions = adapter.list(connection.connectionId);
    expect(definitions.map((definition) => [definition.toolId, definition.sideEffects])).toEqual([
      ['fixture-tools/echo', 'none'],
      ['fixture-tools/execute_code', 'destructive'],
      ['fixture-tools/unannotated', 'paid'],
      ['fixture-tools/write_file', 'destructive'],
    ]);
    expect(
      definitions.find((definition) => definition.toolId.endsWith('/unannotated'))?.executionMode,
    ).toBe('project-file');
    expect(
      definitions.every((definition) => definition.source === `mcp:${connection.connectionId}`),
    ).toBe(true);

    const registered = registry.get('fixture-tools/echo');
    expect(registered).toBeDefined();
    expect(registry.validateInput(registered!, { value: 42 })).not.toEqual([]);
    const result = await registered!.handler(
      {
        projectId: uuidv7(),
        projectPath: '/tmp/project',
        taskId: null,
        agentId: null,
        accessMode: 'restricted',
        callId: uuidv7(),
        signal: new AbortController().signal,
      },
      { value: 'hello' },
    );
    expect(result.output).toEqual({ name: 'echo' });
    expect(result.evidence).toEqual([{ kind: 'mcp-tool', ref: 'fixture-tools/echo' }]);
    expect(invoke).toHaveBeenCalledWith('echo', { value: 'hello' }, expect.anything());
  });
});

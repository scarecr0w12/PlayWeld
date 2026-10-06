import { expect, it, vi } from 'vitest';
import type { UserRequest } from '@theia/ai-core/lib/common/language-model';
import {
  playWeldTheiaTool,
  requestThroughPlayWeld,
  theiaChatMessages,
} from './theia-model-adapter';

const request = (extra: Partial<UserRequest> = {}): UserRequest => ({
  sessionId: 'session',
  requestId: 'request',
  messages: [{ actor: 'user', type: 'text', text: 'Inspect the Project.' }],
  ...extra,
});
function fixture() {
  const service = {
    completeChat: vi.fn(async () => ({
      content: 'Routed answer',
      toolCalls: [],
      usage: { inputTokens: 2, outputTokens: 3 },
      modelId: 'service-selected-model',
    })),
    callTool: vi.fn(async () => ({
      callId: 'call',
      status: 'completed',
      output: { content: 'Project file' },
    })),
    listTools: vi.fn(async () => [{ toolId: 'fs/read-file', inputSchema: { type: 'object' } }]),
  };
  return service;
}
async function collect(response: Awaited<ReturnType<typeof requestThroughPlayWeld>>) {
  if (!('stream' in response)) throw new Error('Expected adapter stream.');
  const output = [];
  for await (const chunk of response.stream) output.push(chunk);
  return output;
}

it('routes Theia text through the service using captured Project context and reports usage', async () => {
  const service = fixture();
  const result = await collect(
    await requestThroughPlayWeld(service as never, async () => 'project', request()),
  );
  expect(result).toEqual([{ content: 'Routed answer' }, { input_tokens: 2, output_tokens: 3 }]);
  expect(service.completeChat).toHaveBeenCalledWith(
    expect.objectContaining({
      projectId: 'project',
      route: { projectId: 'project', taskType: 'chat', requiredCapabilities: ['chat'] },
    }),
  );
});

it('runs model-requested tools through the broker rather than an injected Theia callback', async () => {
  const service = fixture();
  service.completeChat.mockResolvedValueOnce({
    content: '',
    toolCalls: [
      {
        id: 'tool-call',
        name: 'playweld_tool',
        arguments: '{"toolId":"fs/read-file","input":{"path":"hello.txt"}}',
      },
    ] as never,
    usage: { inputTokens: 2, outputTokens: 3 },
    modelId: 'service-selected-model',
  });
  const unsafe = vi.fn(async () => 'unsafe callback');
  const descriptor = playWeldTheiaTool(service as never, async () => 'project', 'playweld_tool');
  const output = await collect(
    await requestThroughPlayWeld(
      service as never,
      async () => 'project',
      request({ tools: [{ ...descriptor, handler: unsafe }] }),
    ),
  );
  expect(service.callTool).toHaveBeenCalledWith('project', 'fs/read-file', { path: 'hello.txt' });
  expect(unsafe).not.toHaveBeenCalled();
  expect(output.some((chunk) => 'tool_calls' in chunk)).toBe(true);
  expect(service.completeChat).toHaveBeenCalledTimes(2);
});

it('refuses empty, cancelled and changed workspaces before subsequent tool mutation', async () => {
  const service = fixture();
  await expect(requestThroughPlayWeld(service as never, async () => '', request())).rejects.toThrow(
    /unambiguous/,
  );
  await expect(
    requestThroughPlayWeld(
      service as never,
      async () => 'project',
      request(),
      () => true,
    ),
  ).rejects.toThrow(/cancelled/);
  const resolve = vi.fn().mockResolvedValueOnce('project').mockResolvedValueOnce('other');
  await expect(
    collect(await requestThroughPlayWeld(service as never, resolve, request())),
  ).rejects.toThrow(/Workspace changed/);
  expect(service.completeChat).not.toHaveBeenCalled();
  expect(service.callTool).not.toHaveBeenCalled();
});

it('rejects unknown tool callbacks and unsupported message payloads without losing them', async () => {
  const service = fixture();
  await expect(
    requestThroughPlayWeld(
      service as never,
      async () => 'project',
      request({
        tools: [
          { id: 'foreign', name: 'foreign', parameters: { properties: {} }, handler: vi.fn() },
        ],
      }),
    ),
  ).rejects.toThrow(/broker tools only/);
  expect(() => theiaChatMessages([{ actor: 'user', type: 'image', image: {} } as never])).toThrow(
    /cannot forward/,
  );
  const descriptor = playWeldTheiaTool(service as never, async () => 'project', 'playweld_tool');
  await expect(
    descriptor.handler('{"toolId":"fs/read-file","input":{},"projectId":"other"}'),
  ).rejects.toThrow(/cannot override/);
  expect(service.callTool).not.toHaveBeenCalled();
});

import { PassThrough } from 'node:stream';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { definePlugin, PluginSdkError, type PluginDefinition } from './index';

const cleanups: Array<() => Promise<void>> = [];
afterEach(async () => {
  await Promise.all(cleanups.splice(0).map((cleanup) => cleanup()));
});

describe('TypeScript plugin SDK', () => {
  it('speaks the worker protocol and brokers host calls without writing logs to stdout', async () => {
    const input = new PassThrough();
    const output = new PassThrough();
    const frames = createFrameReader(output);
    let latestSettings: Record<string, unknown> = {};
    let shutdownObserved = false;
    const plugin = definePlugin(
      {
        tools: {
          'sample-hello/greet': {
            async handler(value, host, context) {
              await host.log('info', `greeting for ${String((value as { name: string }).name)}`);
              const secret = await host.getSecret('api');
              return {
                output: {
                  greeting: `Hello, ${(value as { name: string }).name}!`,
                  context,
                  secret,
                },
                evidence: [{ kind: 'fixture', ref: 'greeting' }],
              };
            },
          },
        },
        onSettingsChanged(settings) {
          latestSettings = settings;
        },
        onShutdown() {
          shutdownObserved = true;
        },
      },
      { stdin: input, stdout: output },
    );
    const running = plugin.run();

    input.write(
      frame({
        jsonrpc: '2.0',
        id: 'init',
        method: 'plugin/initialize',
        params: {
          protocolVersion: 1,
          pluginId: 'sample-hello',
          version: '1.0.0',
          settings: { greetingPrefix: 'Welcome' },
        },
      }),
    );
    expect(await frames.next()).toEqual({
      jsonrpc: '2.0',
      id: 'init',
      result: { protocolVersion: 1, tools: ['sample-hello/greet'] },
    });
    expect(latestSettings).toEqual({ greetingPrefix: 'Welcome' });
    input.write(frame({ jsonrpc: '2.0', id: 'ping', method: 'ping', params: {} }));
    expect(await frames.next()).toEqual({ jsonrpc: '2.0', id: 'ping', result: {} });

    input.write(
      frame({
        jsonrpc: '2.0',
        id: 'call-1',
        method: 'plugin/tool/call',
        params: {
          toolId: 'sample-hello/greet',
          input: { name: 'Mira' },
          context: { taskId: 'task-1', agentRole: 'designer', accessMode: 'restricted' },
        },
      }),
    );
    const hostRequest = await frames.next();
    expect(hostRequest).toMatchObject({
      jsonrpc: '2.0',
      method: 'host/log',
      params: { level: 'info', message: 'greeting for Mira' },
    });
    input.write(frame({ jsonrpc: '2.0', id: hostRequest.id, result: { logged: true } }));
    const secretRequest = await frames.next();
    expect(secretRequest).toMatchObject({
      jsonrpc: '2.0',
      method: 'host/secret/get',
      params: { name: 'api' },
    });
    input.write(frame({ jsonrpc: '2.0', id: secretRequest.id, result: 'sdk-secret' }));
    expect(await frames.next()).toMatchObject({
      jsonrpc: '2.0',
      id: 'call-1',
      result: {
        output: {
          greeting: 'Hello, Mira!',
          context: { taskId: 'task-1', agentRole: 'designer', accessMode: 'restricted' },
          secret: 'sdk-secret',
        },
        evidence: [{ kind: 'fixture', ref: 'greeting' }],
      },
    });

    input.write(
      frame({
        jsonrpc: '2.0',
        method: 'plugin/settingsChanged',
        params: { settings: { greetingPrefix: 'Welcome' } },
      }),
    );
    await new Promise((resolve) => setImmediate(resolve));
    expect(latestSettings).toEqual({ greetingPrefix: 'Welcome' });

    input.write(frame({ jsonrpc: '2.0', id: 'shutdown', method: 'plugin/shutdown', params: {} }));
    expect(await frames.next()).toEqual({ jsonrpc: '2.0', id: 'shutdown', result: {} });
    await running;
    expect(shutdownObserved).toBe(true);
  });
  it.each([undefined, 2, '1'])(
    'rejects protocol version %s before running plugin code',
    async (protocolVersion) => {
      const handler = vi.fn(() => 'ready');
      const onSettingsChanged = vi.fn();
      const plugin = createTestPlugin({ tools: { 'test/echo': { handler } }, onSettingsChanged });

      expect(await plugin.request('plugin/initialize', { protocolVersion })).toEqual({
        jsonrpc: '2.0',
        id: 1,
        error: { code: -32088, message: 'Unsupported plugin protocol version' },
      });
      expect(await plugin.request('plugin/tool/call', echoCall)).toMatchObject({
        id: 2,
        error: { code: -32086 },
      });
      expect(handler).not.toHaveBeenCalled();
      expect(onSettingsChanged).not.toHaveBeenCalled();
      await plugin.initialize();
      expect(await plugin.request('plugin/tool/call', echoCall)).toMatchObject({
        id: 4,
        result: { output: 'ready' },
      });
      expect(handler).toHaveBeenCalledTimes(1);
      expect(onSettingsChanged).toHaveBeenCalledTimes(1);
    },
  );

  it.each(['plugin/tool/call', 'ping', 'plugin/shutdown'])(
    'rejects %s before initialization and accepts requests after initialization',
    async (method) => {
      const handler = vi.fn(() => 'ready');
      const onShutdown = vi.fn();
      const plugin = createTestPlugin({ tools: { 'test/echo': { handler } }, onShutdown });
      expect(await plugin.request(method, echoCall)).toEqual({
        jsonrpc: '2.0',
        id: 1,
        error: { code: -32086, message: 'Plugin worker has not been initialized' },
      });
      expect(handler).not.toHaveBeenCalled();
      expect(onShutdown).not.toHaveBeenCalled();
      await plugin.initialize();
      expect(await plugin.request('plugin/tool/call', echoCall)).toMatchObject({
        id: 3,
        result: { output: 'ready' },
      });
    },
  );

  it('keeps a failed settings initialization uninitialized and permits a corrected retry', async () => {
    const handler = vi.fn(() => 'ready');
    const onSettingsChanged = vi
      .fn()
      .mockRejectedValueOnce(new Error('Invalid greeting setting'))
      .mockResolvedValue(undefined);
    const plugin = createTestPlugin({ tools: { 'test/echo': { handler } }, onSettingsChanged });
    expect(
      await plugin.request('plugin/initialize', { protocolVersion: 1, settings: { greeting: 42 } }),
    ).toMatchObject({
      id: 1,
      error: { code: -32603, message: 'Invalid greeting setting' },
    });
    expect(await plugin.request('plugin/tool/call', echoCall)).toMatchObject({
      id: 2,
      error: { code: -32086 },
    });
    expect(handler).not.toHaveBeenCalled();
    await plugin.initialize();
    expect(await plugin.request('plugin/tool/call', echoCall)).toMatchObject({
      id: 4,
      result: { output: 'ready' },
    });
  });

  it.each([
    { method: 'plugin/unknown', params: {}, message: 'Method not found: plugin/unknown' },
    {
      method: 'plugin/tool/call',
      params: { ...echoCall, toolId: 'test/missing' },
      message: 'Plugin tool not found: test/missing',
    },
  ])(
    'rejects unsupported request $message without dispatching a tool',
    async ({ method, params, message }) => {
      const handler = vi.fn(() => 'ready');
      const plugin = createTestPlugin({ tools: { 'test/echo': { handler } } });
      await plugin.initialize();
      expect(await plugin.request(method, params)).toEqual({
        jsonrpc: '2.0',
        id: 2,
        error: { code: -32601, message },
      });
      expect(handler).not.toHaveBeenCalled();
      expect(await plugin.request('plugin/tool/call', echoCall)).toMatchObject({
        id: 3,
        result: { output: 'ready' },
      });
      expect(handler).toHaveBeenCalledTimes(1);
    },
  );

  it.each([
    { context: undefined, message: 'Plugin tool context is missing' },
    { context: [], message: 'Plugin tool context is missing' },
    { context: {}, message: 'Plugin tool access mode is invalid' },
    { context: { accessMode: 'administrator' }, message: 'Plugin tool access mode is invalid' },
  ])('rejects invalid tool context $context before dispatch', async ({ context, message }) => {
    const handler = vi.fn(() => 'ready');
    const plugin = createTestPlugin({ tools: { 'test/echo': { handler } } });
    await plugin.initialize();
    expect(await plugin.request('plugin/tool/call', { ...echoCall, context })).toEqual({
      jsonrpc: '2.0',
      id: 2,
      error: { code: -32602, message },
    });
    expect(handler).not.toHaveBeenCalled();
    expect(await plugin.request('plugin/tool/call', echoCall)).toMatchObject({
      id: 3,
      result: { output: 'ready' },
    });
    expect(handler).toHaveBeenCalledTimes(1);
  });

  it.each(['full', 'restricted', 'ask-always'] as const)(
    'delivers %s tool context unchanged to the handler',
    async (accessMode) => {
      const handler = vi.fn(() => 'ready');
      const plugin = createTestPlugin({ tools: { 'test/echo': { handler } } });
      await plugin.initialize();
      const context = { taskId: 'task-fixture', agentRole: 'reviewer', accessMode };
      expect(await plugin.request('plugin/tool/call', { ...echoCall, context })).toMatchObject({
        id: 2,
        result: { output: 'ready' },
      });
      expect(handler).toHaveBeenCalledExactlyOnceWith(echoCall.input, expect.any(Object), context);
    },
  );

  it.each([
    {
      kind: 'synchronous exception',
      reject: () => {
        throw new Error('Tool failed');
      },
      code: -32603,
    },
    {
      kind: 'asynchronous rejection',
      reject: () => Promise.reject(new Error('Tool failed')),
      code: -32603,
    },
    {
      kind: 'typed SDK error',
      reject: () => {
        throw new PluginSdkError('Tool failed', -32602);
      },
      code: -32602,
    },
  ])(
    'returns a correlated error for a $kind and continues serving requests',
    async ({ reject, code }) => {
      const handler = vi.fn().mockImplementationOnce(reject).mockReturnValue('recovered');
      const plugin = createTestPlugin({ tools: { 'test/echo': { handler } } });
      await plugin.initialize();
      expect(await plugin.request('plugin/tool/call', echoCall)).toEqual({
        jsonrpc: '2.0',
        id: 2,
        error: { code, message: 'Tool failed' },
      });
      expect(await plugin.request('plugin/tool/call', echoCall)).toEqual({
        jsonrpc: '2.0',
        id: 3,
        result: { output: 'recovered' },
      });
      expect(handler).toHaveBeenCalledTimes(2);
    },
  );
});

const echoCall = {
  toolId: 'test/echo',
  input: { text: 'hello' },
  context: { taskId: null, agentRole: null, accessMode: 'restricted' },
};

function createTestPlugin(definition: PluginDefinition): {
  request(method: string, params?: unknown): Promise<Record<string, unknown>>;
  initialize(): Promise<void>;
} {
  const input = new PassThrough();
  const output = new PassThrough();
  const frames = createFrameReader(output);
  const running = definePlugin(definition, { stdin: input, stdout: output }).run();
  let nextId = 0;
  cleanups.push(async () => {
    input.end();
    await running;
    input.destroy();
    output.destroy();
  });
  const request = async (
    method: string,
    params: unknown = {},
  ): Promise<Record<string, unknown>> => {
    input.write(frame({ jsonrpc: '2.0', id: ++nextId, method, params }));
    return frames.next();
  };
  return {
    request,
    async initialize() {
      expect(await request('plugin/initialize', { protocolVersion: 1 })).toMatchObject({
        result: { protocolVersion: 1, tools: Object.keys(definition.tools).sort() },
      });
    },
  };
}

function createFrameReader(stream: PassThrough): { next(): Promise<Record<string, unknown>> } {
  let buffered = '';
  const queued: Array<Record<string, unknown>> = [];
  const waiters: Array<(frame: Record<string, unknown>) => void> = [];
  stream.on('data', (chunk: Buffer) => {
    buffered += chunk.toString('utf8');
    for (;;) {
      const newline = buffered.indexOf('\n');
      if (newline < 0) return;
      const line = buffered.slice(0, newline);
      buffered = buffered.slice(newline + 1);
      if (!line.trim()) continue;
      const frame = JSON.parse(line) as Record<string, unknown>;
      const waiter = waiters.shift();
      if (waiter) waiter(frame);
      else queued.push(frame);
    }
  });
  return {
    next: () => {
      const frame = queued.shift();
      return frame ? Promise.resolve(frame) : new Promise((resolve) => waiters.push(resolve));
    },
  };
}

function frame(message: Record<string, unknown>): string {
  return `${JSON.stringify(message)}\n`;
}

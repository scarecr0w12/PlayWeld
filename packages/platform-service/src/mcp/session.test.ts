import { describe, expect, it, vi } from 'vitest';
import { RpcErrorCode, uuidv7 } from '@gamecrafter/contracts';
import { McpTransportError, type JsonRpcMessage, type McpTransport } from './types';
import { McpSession } from './session';

class FakeTransport implements McpTransport {
  readonly kind: string;
  readonly legacy = false;
  readonly sent: JsonRpcMessage[] = [];
  private onMessage?: (message: JsonRpcMessage) => void;
  private onError?: (error: Error) => void;
  private onStreamClosed?: (error?: Error) => void;

  constructor(
    private readonly respond: (message: JsonRpcMessage, transport: FakeTransport) => void,
    kind = 'fake',
  ) {
    this.kind = kind;
  }

  async start(
    onMessage: (message: JsonRpcMessage) => void,
    onError: (error: Error) => void,
  ): Promise<void> {
    this.onMessage = onMessage;
    this.onError = onError;
  }

  async send(message: JsonRpcMessage): Promise<void> {
    this.sent.push(message);
    this.respond(message, this);
  }

  async close(): Promise<void> {}

  setStreamClosedHandler(handler: (error?: Error) => void): void {
    this.onStreamClosed = handler;
  }

  closeStream(error?: Error): void {
    this.onStreamClosed?.(error);
  }

  result(request: JsonRpcMessage, result: unknown): void {
    this.onMessage?.({ jsonrpc: '2.0', id: request.id, result });
  }

  error(request: JsonRpcMessage, code: number, message: string): void {
    this.onMessage?.({ jsonrpc: '2.0', id: request.id, error: { code, message } });
  }

  fail(error: Error): void {
    this.onError?.(error);
  }

  serverRequest(method: string, id: string, params?: unknown): void {
    this.onMessage?.({ jsonrpc: '2.0', id, method, params });
  }

  notify(method: string, params?: unknown): void {
    this.onMessage?.({ jsonrpc: '2.0', method, params });
  }
}

async function waitForServerResponse(
  transport: FakeTransport,
  id: string,
): Promise<JsonRpcMessage> {
  for (let attempt = 0; attempt < 100; attempt += 1) {
    const response = transport.sent.find((message) => message.id === id);
    if (response) return response;
    await new Promise((resolve) => setTimeout(resolve, 1));
  }
  throw new Error(`MCP server request was not answered: ${id}`);
}

function connectionConfig(scope: 'platform' | 'project' = 'platform') {
  return {
    connectionId: uuidv7(),
    name: 'test-tools',
    scope,
    projectId: scope === 'project' ? uuidv7() : null,
    mode: 'command' as const,
    command: { command: 'fixture', args: [], env: {} },
    allowServerInitiatedModelCalls: false,
    enabled: true,
    timeoutsMs: { connect: 100, request: 100 },
    tags: [],
    createdAt: '2026-09-28T00:00:00.000Z',
    updatedAt: '2026-09-28T00:00:00.000Z',
  };
}

describe('McpSession negotiation and calls', () => {
  it('preserves invalidation between response processing and delivery to callers', async () => {
    let listings = 0;
    let delayed: JsonRpcMessage | undefined;
    let automaticRefresh: Promise<unknown> | undefined;
    const transport = new FakeTransport((message, current) => {
      if (message.method === 'server/discover')
        current.result(message, {
          protocolVersions: ['2026-07-28'],
          serverInfo: { name: 'fixture', version: '1' },
          capabilities: {},
        });
      else if (message.method === 'subscriptions/listen') current.result(message, {});
      else if (message.method === 'tools/list') {
        listings += 1;
        if (listings === 2) delayed = message;
        else current.result(message, { tools: [{ name: 'current', inputSchema: {} }] });
      }
    });
    const session = new McpSession({
      config: connectionConfig(),
      transport,
      clientInfo: { name: 'test', version: '1' },
      interactions: {
        toolsInvalidated: () => {
          automaticRefresh = session.listTools();
        },
      },
    });
    try {
      await session.connect();
      const refresh = session.refreshTools();
      await Promise.resolve();
      transport.result(delayed!, { tools: [{ name: 'obsolete', inputSchema: {} }] });
      queueMicrotask(() => transport.notify('notifications/tools/list_changed'));
      expect((await refresh).tools.map((tool) => tool.name)).toEqual(['current']);
      expect(await automaticRefresh).toMatchObject({ tools: [{ name: 'current' }] });
      expect((await session.listTools()).tools.map((tool) => tool.name)).toEqual(['current']);
      expect(listings).toBe(3);
    } finally {
      await session.disconnect();
    }
  });

  it.each(['notification', 'stream-close'])(
    'does not publish an in-flight tool listing invalidated by %s',
    async (invalidation) => {
      let listings = 0;
      let delayed: JsonRpcMessage | undefined;
      const transport = new FakeTransport((message, current) => {
        if (message.method === 'server/discover')
          current.result(message, {
            protocolVersions: ['2026-07-28'],
            serverInfo: { name: 'fixture', version: '1' },
            capabilities: { tools: {} },
          });
        else if (message.method === 'subscriptions/listen') current.result(message, {});
        else if (message.method === 'tools/list') {
          listings += 1;
          if (listings === 2) delayed = message;
          else
            current.result(message, {
              tools: [{ name: listings === 1 ? 'initial' : 'current', inputSchema: {} }],
            });
        }
      });
      const session = new McpSession({
        config: connectionConfig(),
        transport,
        clientInfo: { name: 'test', version: '1' },
      });
      try {
        await session.connect();
        const first = session.refreshTools();
        await Promise.resolve();
        expect(delayed).toBeDefined();
        if (invalidation === 'notification') transport.notify('notifications/tools/list_changed');
        else transport.closeStream();
        const second = session.listTools();
        transport.result(delayed!, { tools: [{ name: 'obsolete', inputSchema: {} }] });
        const snapshots = await Promise.all([first, second, session.refreshTools()]);
        expect(snapshots.map((snapshot) => snapshot.tools.map((tool) => tool.name))).toEqual([
          ['current'],
          ['current'],
          ['current'],
        ]);
        expect((await session.listTools()).tools.map((tool) => tool.name)).toEqual(['current']);
        expect(listings).toBe(3);
      } finally {
        await session.disconnect();
      }
    },
  );

  it('does not emit repeated connection changes when an uncached tool list is unchanged', async () => {
    const transport = new FakeTransport((message, current) => {
      if (message.method === 'server/discover')
        current.result(message, {
          protocolVersions: ['2026-07-28'],
          serverInfo: { name: 'fixture', version: '1' },
          capabilities: { tools: {} },
        });
      else if (message.method === 'tools/list')
        current.result(message, {
          tools: [{ name: 'identity', inputSchema: { type: 'object' } }],
          ttlMs: 0,
        });
    });
    const changed = vi.fn();
    const session = new McpSession({
      config: connectionConfig(),
      transport,
      clientInfo: { name: 'test', version: '1' },
      interactions: { stateChanged: changed },
    });
    await session.connect();
    const before = changed.mock.calls.length;
    await session.listTools();
    await session.listTools();
    expect(changed).toHaveBeenCalledTimes(before);
    await session.disconnect();
  });

  it.each(['invalidation', 'invalid-result', 'request-error'])(
    'bounds a failed refresh caused by %s and permits later discovery',
    async (failure) => {
      let failing = false;
      let listings = 0;
      const transport = new FakeTransport((message, current) => {
        if (message.method === 'server/discover')
          current.result(message, {
            protocolVersions: ['2026-07-28'],
            serverInfo: { name: 'fixture', version: '1' },
            capabilities: { tools: {} },
          });
        else if (message.method === 'subscriptions/listen') current.result(message, {});
        else if (message.method === 'tools/list') {
          listings += 1;
          if (failing && failure === 'request-error') current.error(message, -32603, 'Unavailable');
          else if (failing && failure === 'invalid-result') current.result(message, {});
          else {
            if (failing) current.notify('notifications/tools/list_changed');
            current.result(message, { tools: [{ name: 'echo', inputSchema: {} }] });
          }
        }
      });
      const session = new McpSession({
        config: connectionConfig(),
        transport,
        clientInfo: { name: 'test', version: '1' },
      });
      try {
        await session.connect();
        failing = true;
        await expect(session.refreshTools()).rejects.toThrow();
        expect(listings).toBe(failure === 'invalidation' ? 4 : 2);
        expect(session.state.status).toBe('connected');
        failing = false;
        expect((await session.refreshTools()).tools.map((tool) => tool.name)).toEqual(['echo']);
        expect(listings).toBe(failure === 'invalidation' ? 5 : 3);
      } finally {
        await session.disconnect();
      }
    },
  );

  it('falls back from server/discover method-not-found and caches deterministic tool lists', async () => {
    const transport = new FakeTransport((message, current) => {
      if (message.method === 'server/discover') {
        current.error(message, -32601, 'Method not found');
      } else if (message.method === 'initialize') {
        current.result(message, {
          protocolVersion: '2025-06-18',
          serverInfo: { name: 'fixture', version: '1.0' },
          capabilities: { tools: { listChanged: true } },
        });
      } else if (message.method === 'tools/list') {
        current.result(message, {
          tools: [
            { name: 'zeta', inputSchema: { type: 'object' } },
            { name: 'alpha', inputSchema: { type: 'object' } },
          ],
        });
      }
    });
    const session = new McpSession({
      config: connectionConfig(),
      transport,
      clientInfo: { name: 'test', version: '1' },
    });
    const state = await session.connect();
    expect(state).toMatchObject({
      status: 'connected',
      negotiatedRevision: '2025-06-18',
      legacy: true,
      serverInfo: { name: 'fixture', version: '1.0' },
    });
    const first = await session.listTools();
    const second = await session.listTools();
    expect(first.tools.map((tool) => tool.name)).toEqual(['alpha', 'zeta']);
    expect(second.cachedAt).toBe(first.cachedAt);
    expect(transport.sent.filter((message) => message.method === 'tools/list')).toHaveLength(1);
    expect(transport.sent.some((message) => message.method === 'notifications/initialized')).toBe(
      true,
    );
    await session.disconnect();
  });

  it.each([-32000, -32600, -32602])(
    'falls back from server/discover JSON-RPC error %i on HTTP',
    async (code) => {
      const transport = new FakeTransport((message, current) => {
        if (message.method === 'server/discover') current.error(message, code, 'Probe rejected');
        else if (message.method === 'initialize') {
          current.result(message, {
            protocolVersion: '2025-11-25',
            serverInfo: { name: 'fixture', version: '1.0' },
            capabilities: {},
          });
        } else if (message.method === 'tools/list') current.result(message, { tools: [] });
      }, 'streamable-http');
      const session = new McpSession({
        config: connectionConfig(),
        transport,
        clientInfo: { name: 'test', version: '1' },
      });
      try {
        const state = await session.connect();
        expect(state.negotiatedRevision).toBe('2025-11-25');
        expect(transport.sent.filter((message) => message.method === 'initialize')).toHaveLength(1);
      } finally {
        await session.disconnect();
      }
    },
  );

  it.each([400, 404, 405, 406, 415])(
    'falls back from an HTTP %i discovery response',
    async (httpStatus) => {
      const transport = new FakeTransport((message, current) => {
        if (message.method === 'server/discover') {
          current.fail(new McpTransportError('HTTP probe failed', { httpStatus }));
        } else if (message.method === 'initialize') {
          current.result(message, {
            protocolVersion: '2025-11-25',
            serverInfo: { name: 'fixture', version: '1.0' },
            capabilities: {},
          });
        } else if (message.method === 'tools/list') current.result(message, { tools: [] });
      }, 'streamable-http');
      const session = new McpSession({
        config: connectionConfig(),
        transport,
        clientInfo: { name: 'test', version: '1' },
      });
      try {
        const state = await session.connect();
        expect(state.negotiatedRevision).toBe('2025-11-25');
        expect(transport.sent.filter((message) => message.method === 'initialize')).toHaveLength(1);
      } finally {
        await session.disconnect();
      }
    },
  );

  it('does not fall back on HTTP network errors', async () => {
    const transport = new FakeTransport((message, current) => {
      if (message.method === 'server/discover') {
        current.fail(new McpTransportError('connect ECONNREFUSED'));
      }
    }, 'streamable-http');
    const session = new McpSession({
      config: connectionConfig(),
      transport,
      clientInfo: { name: 'test', version: '1' },
    });
    await expect(session.connect()).rejects.toMatchObject({
      code: RpcErrorCode.McpConnectFailed,
    });
    expect(transport.sent.filter((message) => message.method === 'initialize')).toHaveLength(0);
  });

  it.each([-32000, -32600, -32602])(
    'falls back from server/discover JSON-RPC error %i on HTTP',
    async (code) => {
      const transport = new FakeTransport((message, current) => {
        if (message.method === 'server/discover') current.error(message, code, 'Probe rejected');
        else if (message.method === 'initialize') {
          current.result(message, {
            protocolVersion: '2025-11-25',
            serverInfo: { name: 'fixture', version: '1.0' },
            capabilities: {},
          });
        } else if (message.method === 'tools/list') current.result(message, { tools: [] });
      }, 'streamable-http');
      const session = new McpSession({
        config: connectionConfig(),
        transport,
        clientInfo: { name: 'test', version: '1' },
      });
      try {
        const state = await session.connect();
        expect(state.negotiatedRevision).toBe('2025-11-25');
        expect(transport.sent.filter((message) => message.method === 'initialize')).toHaveLength(1);
      } finally {
        await session.disconnect();
      }
    },
  );

  it.each([400, 404, 405, 406, 415])(
    'falls back from an HTTP %i discovery response',
    async (httpStatus) => {
      const transport = new FakeTransport((message, current) => {
        if (message.method === 'server/discover') {
          current.fail(new McpTransportError('HTTP probe failed', { httpStatus }));
        } else if (message.method === 'initialize') {
          current.result(message, {
            protocolVersion: '2025-11-25',
            serverInfo: { name: 'fixture', version: '1.0' },
            capabilities: {},
          });
        } else if (message.method === 'tools/list') current.result(message, { tools: [] });
      }, 'streamable-http');
      const session = new McpSession({
        config: connectionConfig(),
        transport,
        clientInfo: { name: 'test', version: '1' },
      });
      try {
        const state = await session.connect();
        expect(state.negotiatedRevision).toBe('2025-11-25');
        expect(transport.sent.filter((message) => message.method === 'initialize')).toHaveLength(1);
      } finally {
        await session.disconnect();
      }
    },
  );

  it('does not fall back on HTTP network errors', async () => {
    const transport = new FakeTransport((message, current) => {
      if (message.method === 'server/discover') {
        current.fail(new McpTransportError('connect ECONNREFUSED'));
      }
    }, 'streamable-http');
    const session = new McpSession({
      config: connectionConfig(),
      transport,
      clientInfo: { name: 'test', version: '1' },
    });
    await expect(session.connect()).rejects.toMatchObject({
      code: RpcErrorCode.McpConnectFailed,
    });
    expect(transport.sent.filter((message) => message.method === 'initialize')).toHaveLength(0);
  });

  it('invalidates legacy tool-list caches on notifications/tools/list_changed', async () => {
    let listings = 0;
    const transport = new FakeTransport((message, current) => {
      if (message.method === 'server/discover') current.error(message, -32601, 'Method not found');
      else if (message.method === 'initialize') {
        current.result(message, {
          protocolVersion: '2025-11-25',
          serverInfo: { name: 'fixture', version: '1.0' },
          capabilities: { tools: { listChanged: true } },
        });
      } else if (message.method === 'tools/list') {
        listings += 1;
        current.result(message, {
          tools: [{ name: `tool-${listings}`, inputSchema: { type: 'object' } }],
        });
      }
    });
    const session = new McpSession({
      config: connectionConfig(),
      transport,
      clientInfo: { name: 'test', version: '1' },
    });
    try {
      await session.connect();
      await session.listTools();
      transport.notify('notifications/tools/list_changed');
      expect((await session.listTools()).tools[0].name).toBe('tool-2');
      expect(listings).toBe(2);
    } finally {
      await session.disconnect();
    }
  });

  it('only returns roots for a Project-scoped connection', async () => {
    for (const scope of ['platform', 'project'] as const) {
      const transport = new FakeTransport((message, current) => {
        if (message.method === 'server/discover')
          current.error(message, -32601, 'Method not found');
        else if (message.method === 'initialize') {
          current.result(message, {
            protocolVersion: '2025-11-25',
            serverInfo: { name: 'fixture', version: '1.0' },
            capabilities: {},
          });
        } else if (message.method === 'tools/list') current.result(message, { tools: [] });
      });
      const session = new McpSession({
        config: connectionConfig(scope),
        transport,
        clientInfo: { name: 'test', version: '1' },
        interactions: {
          projectRoot: () => ({ uri: 'file:///tmp/dungeon-project', name: 'Dungeon Project' }),
        },
      });
      try {
        await session.connect();
        const requestId = `roots-${scope}`;
        transport.serverRequest('roots/list', requestId);
        const response = await waitForServerResponse(transport, requestId);
        expect(response).toMatchObject({
          result: {
            roots:
              scope === 'project'
                ? [{ uri: 'file:///tmp/dungeon-project', name: 'Dungeon Project' }]
                : [],
          },
        });
      } finally {
        await session.disconnect();
      }
    }
  });

  it('maps unsupported revisions without retrying with initialize', async () => {
    const transport = new FakeTransport((message, current) => {
      if (message.method === 'server/discover')
        current.error(message, -32022, 'Unsupported protocol version');
    });
    const session = new McpSession({
      config: connectionConfig(),
      transport,
      clientInfo: { name: 'test', version: '1' },
    });
    await expect(session.connect()).rejects.toMatchObject({
      code: RpcErrorCode.McpUnsupportedProtocolVersion,
    });
    expect(transport.sent.filter((message) => message.method === 'initialize')).toHaveLength(0);
  });

  it('retries MRTR input requests with responses and requestState unchanged', async () => {
    let toolCalls = 0;
    const transport = new FakeTransport((message, current) => {
      if (message.method === 'server/discover') {
        current.result(message, {
          protocolVersions: ['2026-07-28'],
          serverInfo: { name: 'fixture', version: '1.0' },
          capabilities: { tools: { listChanged: true } },
        });
      } else if (message.method === 'tools/list') {
        current.result(message, {
          tools: [{ name: 'needs_input', inputSchema: { type: 'object' } }],
        });
      } else if (message.method === 'subscriptions/listen') {
        current.result(message, { resultType: 'complete', subscriptions: ['toolsListChanged'] });
      } else if (message.method === 'tools/call') {
        toolCalls += 1;
        if (toolCalls === 1) {
          current.result(message, {
            resultType: 'input_required',
            inputRequests: [{ id: 'approval', prompt: 'Continue?' }],
            requestState: { token: 'server-state' },
          });
        } else {
          current.result(message, {
            resultType: 'complete',
            content: [{ type: 'text', text: 'done' }],
          });
        }
      }
    });
    const onInputRequired = vi.fn().mockResolvedValue({ approval: { accepted: true } });
    const session = new McpSession({
      config: connectionConfig(),
      transport,
      clientInfo: { name: 'test', version: '1' },
      interactions: { onInputRequired },
    });
    await session.connect();
    const result = await session.callTool('needs_input', {}, { taskId: uuidv7() });
    expect(result).toMatchObject({ resultType: 'complete' });
    expect(onInputRequired).toHaveBeenCalledOnce();
    const retry = transport.sent.filter((message) => message.method === 'tools/call')[1]!;
    expect(retry.params).toMatchObject({
      inputResponses: { approval: { accepted: true } },
      requestState: { token: 'server-state' },
    });
    await session.disconnect();
  });

  it('re-lists after a 2026 subscription stream closes without failing the connection', async () => {
    let toolListCalls = 0;
    const transport = new FakeTransport((message, current) => {
      if (message.method === 'server/discover') {
        current.result(message, {
          protocolVersions: ['2026-07-28'],
          serverInfo: { name: 'fixture', version: '1.0' },
          capabilities: { tools: { listChanged: true } },
        });
      } else if (message.method === 'tools/list') {
        toolListCalls += 1;
        current.result(message, { tools: [{ name: 'echo', inputSchema: { type: 'object' } }] });
      } else if (message.method === 'subscriptions/listen') {
        current.result(message, { resultType: 'complete' });
      }
    });
    const session = new McpSession({
      config: connectionConfig(),
      transport,
      clientInfo: { name: 'test', version: '1' },
    });
    await session.connect();
    await Promise.resolve();
    transport.closeStream(new Error('subscription stream closed'));
    await session.listTools();
    expect(toolListCalls).toBe(2);
    expect(session.state.status).toBe('connected');
    await session.disconnect();
  });
});

import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { assessDecisions, type DecisionQuestion } from './decision-provider';

const questions: Record<string, DecisionQuestion> = {
  team: { type: 'choice', instructions: 'Which team?', criteria: { art: 'Art', code: 'Code' } },
  urgent: { type: 'noul', instructions: 'Is this urgent?' },
  severity: { type: 'score', instructions: 'How severe?', criteria: ['low', 'medium', 'high'] },
};

function validResponse(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    model: 'jev-1.13.0',
    answers: {
      team: { choice: 'code', probabilities: { art: 0.2, code: 0.8 }, confidence: 0.7 },
      urgent: { noul: 0.85 },
      severity: {
        score: 1.5,
        probabilities: { '0': 0.1, '1': 0.3, '2': 0.6 },
        confidence: 0.5,
        legend: { '0': 'low', '1': 'medium', '2': 'high' },
      },
    },
    usage: { input_tokens: 24, output_tokens: 8, cost: 0.0001 },
    ...overrides,
  };
}

function responseWithAnswer(id: string, answer: unknown): string {
  const response = validResponse();
  (response.answers as Record<string, unknown>)[id] = answer;
  return JSON.stringify(response);
}

function responseWithoutAnswer(id: string): string {
  const response = validResponse();
  delete (response.answers as Record<string, unknown>)[id];
  return JSON.stringify(response);
}

async function startServer(
  handler: (request: IncomingMessage, response: ServerResponse) => void,
): Promise<{ server: Server; baseUrl: string }> {
  const server = createServer(handler);
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('Failed to start test server');
  return { server, baseUrl: `http://127.0.0.1:${address.port}` };
}

async function closeServer(server: Server): Promise<void> {
  await new Promise<void>((resolve, reject) =>
    server.close((error) => (error ? reject(error) : resolve())),
  );
}

async function readRequest(request: IncomingMessage): Promise<Record<string, unknown>> {
  const chunks: Buffer[] = [];
  for await (const chunk of request) chunks.push(Buffer.from(chunk));
  return JSON.parse(Buffer.concat(chunks).toString('utf8')) as Record<string, unknown>;
}

async function respond(response: ServerResponse, body: unknown, status = 200): Promise<void> {
  response.writeHead(status, { 'content-type': 'application/json' });
  response.end(JSON.stringify(body));
}

const servers: Server[] = [];
afterEach(async () => {
  await Promise.all(servers.splice(0).map(closeServer));
});

describe('assessDecisions', () => {
  it('rejects oversized requests before contacting the endpoint', async () => {
    const fetchMock = vi.fn();
    await expect(
      assessDecisions(
        {
          baseUrl: 'http://localhost:9912',
          model: 'local',
          state: { summary: 'x'.repeat(65536) },
          questions,
          timeoutMs: 1000,
          allowRemote: false,
          protocol: 'systemone',
        },
        fetchMock,
      ),
    ).rejects.toThrow('request is too large');
    expect(fetchMock).not.toHaveBeenCalled();
  });
  it('normalizes choice, noul, and score answers and sends System One requests', async () => {
    let requestPath = '';
    let requestBody: Record<string, unknown> | undefined;
    const { server, baseUrl } = await startServer((request, response) => {
      requestPath = request.url ?? '';
      void readRequest(request).then((body) => {
        requestBody = body;
        void respond(response, validResponse());
      });
    });
    servers.push(server);

    const result = await assessDecisions({
      baseUrl,
      model: 'kev-local',
      state: { task: 'Repair the editor' },
      questions,
      timeoutMs: 2_000,
      allowRemote: false,
      protocol: 'systemone',
    });

    expect(requestPath).toBe('/v1/systemone');
    expect(requestBody).toEqual({
      model: 'kev-local',
      state: { task: 'Repair the editor' },
      questions,
    });
    expect(result).toMatchObject({
      model: 'jev-1.13.0',
      answers: {
        team: {
          type: 'choice',
          choice: 'code',
          probabilities: { art: 0.2, code: 0.8 },
          confidence: 0.7,
        },
        urgent: { type: 'noul', noul: 0.85 },
        severity: {
          type: 'score',
          score: 1.5,
          probabilities: { '0': 0.1, '1': 0.3, '2': 0.6 },
          confidence: 0.5,
        },
      },
      usage: { inputTokens: 24, outputTokens: 8, costUsd: 0.0001 },
    });
    expect(result.answers.severity).not.toHaveProperty('legend');
    expect(result.latencyMs).toBeGreaterThanOrEqual(0);
  });

  it('joins a base URL already ending in /v1 and OpenRouter /api without forwarding IDs', async () => {
    const paths: string[] = [];
    const { server, baseUrl } = await startServer((request, response) => {
      paths.push(request.url ?? '');
      void respond(response, validResponse());
    });
    servers.push(server);

    await assessDecisions({
      baseUrl: `${baseUrl}/prefix/v1/`,
      model: 'local-model',
      state: {},
      questions,
      timeoutMs: 2_000,
      allowRemote: false,
      protocol: 'systemone',
    });
    await assessDecisions({
      baseUrl: `${baseUrl}/api`,
      model: 'typesafe/jev-1.13',
      state: {},
      questions,
      timeoutMs: 2_000,
      allowRemote: false,
      protocol: 'openrouter-decisions',
    });

    expect(paths).toEqual(['/prefix/v1/systemone', '/api/alpha/decisions']);
  });

  it('returns null for missing usage and confidence and ignores unknown response fields', async () => {
    const payload = validResponse({
      usage: undefined,
      extra: 'ignored',
      answers: {
        team: { choice: 'art', probabilities: { art: 1, code: 0 }, extra: true },
        urgent: { noul: 0 },
        severity: { score: 0, probabilities: { '0': 1, '1': 0, '2': 0 } },
        unrequested: { type: 'noul', noul: 1 },
      },
    });
    const fetchMock = vi.fn(async () => new Response(JSON.stringify(payload)));
    const result = await assessDecisions(
      {
        baseUrl: 'http://localhost:9912',
        model: 'test',
        state: {},
        questions,
        timeoutMs: 1_000,
        allowRemote: false,
        protocol: 'systemone',
      },
      fetchMock as unknown as typeof fetch,
    );

    expect(result.usage).toEqual({ inputTokens: null, outputTokens: null, costUsd: null });
    expect(result.answers.team).toEqual({
      type: 'choice',
      choice: 'art',
      probabilities: { art: 1, code: 0 },
      confidence: null,
    });
    expect(Object.keys(result.answers)).toEqual(['team', 'urgent', 'severity']);
  });

  it('replaces conflicting headers and explicitly sets JSON content type', async () => {
    let authorization = '';
    let contentType = '';
    const { server, baseUrl } = await startServer((request, response) => {
      authorization = String(request.headers.authorization ?? '');
      contentType = String(request.headers['content-type'] ?? '');
      void respond(response, validResponse());
    });
    servers.push(server);

    await assessDecisions({
      baseUrl,
      apiKey: 'active-key',
      headers: {
        authorization: 'Bearer stale-key',
        'content-type': 'text/plain',
        'x-extra': 'yes',
      },
      model: 'test',
      state: {},
      questions,
      timeoutMs: 2_000,
      allowRemote: false,
      protocol: 'systemone',
    });

    expect(authorization).toBe('Bearer active-key');
    expect(contentType).toBe('application/json');
  });

  it('does not call remote, insecure, private-network, or malformed URLs without permission', async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify(validResponse())));
    const base = {
      model: 'test',
      state: {},
      questions,
      timeoutMs: 1_000,
      allowRemote: false,
      protocol: 'systemone' as const,
    };
    for (const baseUrl of [
      'https://example.com',
      'http://example.com',
      'https://192.168.1.12',
      'http://127.0.0.2',
      'http://user:pass@localhost:9000',
      'http://localhost:9000?token=secret',
      'http://localhost:9000?',
      'http://localhost:9000/#fragment',
      'http://localhost:9000/#',
      'http://127.1:9000',
    ]) {
      await expect(
        assessDecisions({ ...base, baseUrl }, fetchMock as unknown as typeof fetch),
      ).rejects.toThrow();
    }
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('requires both explicit remote opt-in and HTTPS', async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify(validResponse())));
    const base = {
      model: 'test',
      state: {},
      questions,
      timeoutMs: 1_000,
      protocol: 'systemone' as const,
    };
    await expect(
      assessDecisions(
        { ...base, baseUrl: 'https://example.com', allowRemote: false },
        fetchMock as unknown as typeof fetch,
      ),
    ).rejects.toThrow('Remote decision provider requires opt-in and HTTPS');
    await expect(
      assessDecisions(
        { ...base, baseUrl: 'http://example.com', allowRemote: true },
        fetchMock as unknown as typeof fetch,
      ),
    ).rejects.toThrow('Remote decision provider requires opt-in and HTTPS');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('rejects OpenRouter base paths other than origin or /api', async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify(validResponse())));
    await expect(
      assessDecisions(
        {
          baseUrl: 'http://localhost:9912/v1',
          model: 'test',
          state: {},
          questions,
          timeoutMs: 1_000,
          allowRemote: false,
          protocol: 'openrouter-decisions',
        },
        fetchMock as unknown as typeof fetch,
      ),
    ).rejects.toThrow('OpenRouter Decisions base URL must be an origin or /api URL');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it.each([
    ['malformed JSON', '{"model":NaN}'],
    [
      'unknown choice',
      responseWithAnswer('team', { choice: 'other', probabilities: { art: 0.2, code: 0.8 } }),
    ],
    ['missing distribution', responseWithAnswer('team', { choice: 'code' })],
    [
      'non-unit distribution',
      responseWithAnswer('team', { choice: 'code', probabilities: { art: 0.2, code: 0.7 } }),
    ],
    [
      'NaN probability',
      '{"model":"m","answers":{"team":{"choice":"code","probabilities":{"art":NaN,"code":1}}}}',
    ],
    ['missing answer', responseWithoutAnswer('team')],
    ['wrong answer type', responseWithAnswer('urgent', { type: 'choice', noul: 0.5 })],
    [
      'invalid confidence',
      responseWithAnswer('team', {
        choice: 'code',
        probabilities: { art: 0.2, code: 0.8 },
        confidence: 1.1,
      }),
    ],
    [
      'score outside range',
      responseWithAnswer('severity', {
        score: 2.1,
        probabilities: { '0': 0.1, '1': 0.3, '2': 0.6 },
      }),
    ],
    [
      'missing score level',
      responseWithAnswer('severity', { score: 1, probabilities: { '0': 0.5, '2': 0.5 } }),
    ],
    ['invalid noul', responseWithAnswer('urgent', { noul: -0.1 })],
  ])('rejects %s', async (_label, body) => {
    const fetchMock = vi.fn(async () => new Response(body));
    await expect(
      assessDecisions(
        {
          baseUrl: 'http://localhost:9912',
          model: 'test',
          state: {},
          questions,
          timeoutMs: 1_000,
          allowRemote: false,
          protocol: 'systemone',
        },
        fetchMock as unknown as typeof fetch,
      ),
    ).rejects.toThrow();
  });

  it.each([
    { truncated: true },
    { state_truncated: true },
    { usage: { input_tokens: 1, output_tokens: 1, state_truncated: true } },
    { usage: { input_tokens: 1, output_tokens: 1, details: { questions_truncated: true } } },
    { usage: { state_tokens_dropped: 1 } },
    { usage: { truncated_questions: ['team'] } },
    { usage: { options: { team: { total: 2, distinct: 1, tokens_per_option: 4 } } } },
  ])('rejects truncation indicators %#', async (extra) => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify(validResponse(extra))));
    await expect(
      assessDecisions(
        {
          baseUrl: 'http://localhost:9912',
          model: 'test',
          state: {},
          questions,
          timeoutMs: 1_000,
          allowRemote: false,
          protocol: 'systemone',
        },
        fetchMock as unknown as typeof fetch,
      ),
    ).rejects.toThrow('Decision provider returned an invalid response');
  });

  it('enforces timeout and caller cancellation even if a fetch implementation ignores AbortSignal', async () => {
    const neverFetch = vi.fn(
      () => new Promise<Response>(() => undefined),
    ) as unknown as typeof fetch;
    await expect(
      assessDecisions(
        {
          baseUrl: 'http://localhost:9912',
          model: 'test',
          state: {},
          questions,
          timeoutMs: 10,
          allowRemote: false,
          protocol: 'systemone',
        },
        neverFetch,
      ),
    ).rejects.toThrow('Decision provider request timed out');

    const controller = new AbortController();
    const cancelled = assessDecisions(
      {
        baseUrl: 'http://localhost:9912',
        model: 'test',
        state: {},
        questions,
        timeoutMs: 2_000,
        signal: controller.signal,
        allowRemote: false,
        protocol: 'systemone',
      },
      neverFetch,
    );
    controller.abort();
    await expect(cancelled).rejects.toThrow('Decision provider request was cancelled');
  });

  it('applies the timeout while consuming a response body', async () => {
    const fetchMock = vi.fn(
      async () => new Response(new ReadableStream<Uint8Array>({ start: () => undefined })),
    );
    await expect(
      assessDecisions(
        {
          baseUrl: 'http://localhost:9912',
          model: 'test',
          state: {},
          questions,
          timeoutMs: 10,
          allowRemote: false,
          protocol: 'systemone',
        },
        fetchMock as unknown as typeof fetch,
      ),
    ).rejects.toThrow('Decision provider request timed out');
  });

  it('rejects pre-cancellation without calling fetch', async () => {
    const controller = new AbortController();
    controller.abort();
    const fetchMock = vi.fn(async () => new Response(JSON.stringify(validResponse())));
    await expect(
      assessDecisions(
        {
          baseUrl: 'http://localhost:9912',
          model: 'test',
          state: {},
          questions,
          timeoutMs: 1_000,
          signal: controller.signal,
          allowRemote: false,
          protocol: 'systemone',
        },
        fetchMock as unknown as typeof fetch,
      ),
    ).rejects.toThrow('Decision provider request was cancelled');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('rejects redirects and never exposes response bodies, credentials, or network errors', async () => {
    let targetCalls = 0;
    const { server, baseUrl } = await startServer((request, response) => {
      if (request.url === '/target') targetCalls += 1;
      response.writeHead(302, { location: '/target' });
      response.end('private-key-in-redirect-body');
    });
    servers.push(server);
    const redirectError = await assessDecisions(
      {
        baseUrl,
        apiKey: 'private-key',
        model: 'test',
        state: {},
        questions,
        timeoutMs: 2_000,
        allowRemote: false,
        protocol: 'systemone',
      },
      fetch,
    ).catch((error: Error) => error);
    expect(redirectError).toBeInstanceOf(Error);
    expect(redirectError.message).not.toContain('private-key');
    expect(targetCalls).toBe(0);

    const networkErrorFetch = vi.fn(async () => {
      throw new Error('network failed with private-key');
    });
    const networkError = await assessDecisions(
      {
        baseUrl: 'http://localhost:9912',
        apiKey: 'private-key',
        model: 'test',
        state: {},
        questions,
        timeoutMs: 1_000,
        allowRemote: false,
        protocol: 'systemone',
      },
      networkErrorFetch as unknown as typeof fetch,
    ).catch((error: Error) => error);
    expect(networkError.message).toBe('Decision provider request failed');
    expect(networkError.message).not.toContain('private-key');
  });

  it('limits streamed response bodies to 1 MiB', async () => {
    const { server, baseUrl } = await startServer((_request, response) => {
      response.writeHead(200, { 'content-type': 'application/json' });
      response.end('x'.repeat(1024 * 1024 + 1));
    });
    servers.push(server);

    await expect(
      assessDecisions({
        baseUrl,
        model: 'test',
        state: {},
        questions,
        timeoutMs: 2_000,
        allowRemote: false,
        protocol: 'systemone',
      }),
    ).rejects.toThrow('Decision provider response is too large');
  });

  it('reports only an HTTP status for provider errors', async () => {
    const { server, baseUrl } = await startServer((_request, response) => {
      void respond(response, { error: 'private-key was rejected' }, 502);
    });
    servers.push(server);

    const error = await assessDecisions({
      baseUrl,
      apiKey: 'private-key',
      model: 'test',
      state: {},
      questions,
      timeoutMs: 2_000,
      allowRemote: false,
      protocol: 'systemone',
    }).catch((caught: Error) => caught);

    expect(error.message).toBe('Decision provider request failed (HTTP 502)');
    expect(error.message).not.toContain('private-key');
  });
});

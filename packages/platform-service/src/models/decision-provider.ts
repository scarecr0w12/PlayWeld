export type DecisionQuestion =
  | { type: 'choice'; instructions: string; criteria: Record<string, string> }
  | { type: 'noul'; instructions: string }
  | { type: 'score'; instructions: string; criteria: string[] };

export type DecisionAnswer =
  | {
      type: 'choice';
      choice: string;
      probabilities: Record<string, number>;
      confidence: number | null;
    }
  | { type: 'noul'; noul: number }
  | {
      type: 'score';
      score: number;
      probabilities: Record<string, number>;
      confidence: number | null;
    };

export interface DecisionProviderResult {
  model: string;
  answers: Record<string, DecisionAnswer>;
  usage: { inputTokens: number | null; outputTokens: number | null; costUsd: number | null };
  latencyMs: number;
}

interface AssessDecisionsInput {
  baseUrl: string;
  apiKey?: string;
  headers?: Record<string, string>;
  model: string;
  state: Record<string, unknown>;
  questions: Record<string, DecisionQuestion>;
  timeoutMs: number;
  signal?: AbortSignal;
  allowRemote: boolean;
  protocol: 'systemone' | 'openrouter-decisions';
}

const MAX_RESPONSE_BYTES = 1024 * 1024;
const MAX_REQUEST_BYTES = 64 * 1024;
const MAX_TIMEOUT_MS = 2_147_483_647;

class SafeDecisionError extends Error {}

export async function assessDecisions(
  input: AssessDecisionsInput,
  fetchImpl: typeof fetch = fetch,
): Promise<DecisionProviderResult> {
  const url = decisionUrl(input.baseUrl, input.protocol, input.allowRemote);
  if (!Number.isSafeInteger(input.timeoutMs) || input.timeoutMs < 1) {
    throw new SafeDecisionError('Decision provider timeout is invalid');
  }
  if (input.signal?.aborted) throw new SafeDecisionError('Decision provider request was cancelled');

  let headers: Headers;
  try {
    headers = new Headers(input.headers);
    headers.set('content-type', 'application/json');
    if (input.apiKey !== undefined) {
      if (!input.apiKey) throw new Error();
      headers.set('authorization', `Bearer ${input.apiKey}`);
    }
  } catch {
    throw new SafeDecisionError('Decision provider request headers are invalid');
  }

  let body: string;
  try {
    body = JSON.stringify({ model: input.model, state: input.state, questions: input.questions });
  } catch {
    throw new SafeDecisionError('Decision provider request is invalid');
  }
  if (new TextEncoder().encode(body).byteLength > MAX_REQUEST_BYTES) {
    throw new SafeDecisionError('Decision provider request is too large');
  }

  const startedAt = Date.now();
  const controller = new AbortController();
  let timedOut = false;
  const onInputAbort = () => controller.abort();
  input.signal?.addEventListener('abort', onInputAbort, { once: true });
  const timer = setTimeout(
    () => {
      timedOut = true;
      controller.abort();
    },
    Math.min(input.timeoutMs, MAX_TIMEOUT_MS),
  );
  const abortPromise = new Promise<never>((_resolve, reject) => {
    controller.signal.addEventListener(
      'abort',
      () =>
        reject(
          new SafeDecisionError(
            timedOut
              ? 'Decision provider request timed out'
              : 'Decision provider request was cancelled',
          ),
        ),
      { once: true },
    );
  });

  try {
    const response = await Promise.race([
      (async () => {
        const fetched = await fetchImpl(url, {
          method: 'POST',
          headers,
          body,
          signal: controller.signal,
          redirect: 'error',
        });
        if (fetched.redirected) {
          void fetched.body?.cancel().catch(() => undefined);
          throw new SafeDecisionError('Decision provider redirects are not allowed');
        }
        if (!fetched.ok) {
          void fetched.body?.cancel().catch(() => undefined);
          throw new SafeDecisionError(`Decision provider request failed (HTTP ${fetched.status})`);
        }
        const responseBody = await readBoundedBody(fetched, controller.signal);
        let parsed: unknown;
        try {
          parsed = JSON.parse(responseBody) as unknown;
        } catch {
          throw new SafeDecisionError('Decision provider returned an invalid response');
        }
        return normalizeResponse(parsed, input.questions, Date.now() - startedAt);
      })(),
      abortPromise,
    ]);
    return response;
  } catch (error) {
    if (error instanceof SafeDecisionError) throw error;
    if (timedOut) throw new SafeDecisionError('Decision provider request timed out');
    if (input.signal?.aborted)
      throw new SafeDecisionError('Decision provider request was cancelled');
    throw new SafeDecisionError('Decision provider request failed');
  } finally {
    clearTimeout(timer);
    input.signal?.removeEventListener('abort', onInputAbort);
  }
}

function decisionUrl(
  baseUrl: string,
  protocol: AssessDecisionsInput['protocol'],
  allowRemote: boolean,
): string {
  let url: URL;
  try {
    if (baseUrl.trim() !== baseUrl) throw new Error();
    url = new URL(baseUrl);
  } catch {
    throw new SafeDecisionError('Decision provider URL is invalid');
  }

  if (
    (url.protocol !== 'http:' && url.protocol !== 'https:') ||
    url.username ||
    url.password ||
    baseUrl.includes('?') ||
    baseUrl.includes('#')
  ) {
    throw new SafeDecisionError('Decision provider URL is invalid');
  }

  const authority = baseUrl.match(/^https?:\/\/([^/?#]*)/i)?.[1] ?? '';
  const rawHost = authority.slice(authority.lastIndexOf('@') + 1);
  const hostname = (
    rawHost.startsWith('[') ? rawHost.slice(0, rawHost.indexOf(']') + 1) : rawHost.split(':')[0]
  ).toLowerCase();
  const loopback = hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '[::1]';
  if (!loopback && (!allowRemote || url.protocol !== 'https:')) {
    throw new SafeDecisionError('Remote decision provider requires opt-in and HTTPS');
  }

  if (protocol === 'systemone') {
    const basePath = url.pathname.replace(/\/+$/, '');
    url.pathname = `${basePath}${basePath.endsWith('/v1') ? '' : '/v1'}/systemone`;
  } else {
    const basePath = url.pathname.replace(/\/+$/, '');
    if (basePath !== '' && basePath !== '/api') {
      throw new SafeDecisionError('OpenRouter Decisions base URL must be an origin or /api URL');
    }
    url.pathname = '/api/alpha/decisions';
  }
  return url.toString();
}

async function readBoundedBody(response: Response, signal: AbortSignal): Promise<string> {
  if (!response.body) throw new SafeDecisionError('Decision provider returned an invalid response');
  const contentLength = response.headers.get('content-length');
  if (contentLength && Number(contentLength) > MAX_RESPONSE_BYTES) {
    void response.body.cancel().catch(() => undefined);
    throw new SafeDecisionError('Decision provider response is too large');
  }

  const reader = response.body.getReader();
  const cancelRead = () => void reader.cancel().catch(() => undefined);
  signal.addEventListener('abort', cancelRead, { once: true });
  const chunks: Uint8Array[] = [];
  let bytesRead = 0;
  try {
    while (true) {
      const chunk = await reader.read();
      if (chunk.done) break;
      bytesRead += chunk.value.byteLength;
      if (bytesRead > MAX_RESPONSE_BYTES) {
        void reader.cancel().catch(() => undefined);
        throw new SafeDecisionError('Decision provider response is too large');
      }
      chunks.push(chunk.value);
    }
  } finally {
    signal.removeEventListener('abort', cancelRead);
    reader.releaseLock();
  }

  const bytes = new Uint8Array(bytesRead);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(bytes);
  } catch {
    throw new SafeDecisionError('Decision provider returned an invalid response');
  }
}

function normalizeResponse(
  value: unknown,
  questions: Record<string, DecisionQuestion>,
  latencyMs: number,
): DecisionProviderResult {
  if (!isRecord(value) || isTruncated(value)) {
    throw new SafeDecisionError('Decision provider returned an invalid response');
  }
  if (
    typeof value.model !== 'string' ||
    value.model.trim().length === 0 ||
    !isRecord(value.answers)
  ) {
    throw new SafeDecisionError('Decision provider returned an invalid response');
  }

  const answers: [string, DecisionAnswer][] = [];
  for (const [id, question] of Object.entries(questions)) {
    if (!hasOwn(value.answers, id) || !isRecord(value.answers[id])) {
      throw new SafeDecisionError('Decision provider omitted a required answer');
    }
    answers.push([id, normalizeAnswer(value.answers[id] as Record<string, unknown>, question)]);
  }

  let inputTokens: number | null = null;
  let outputTokens: number | null = null;
  let costUsd: number | null = null;
  if (value.usage !== undefined) {
    if (!isRecord(value.usage) || isTruncated(value.usage)) {
      throw new SafeDecisionError('Decision provider returned invalid usage');
    }
    inputTokens = optionalUsageNumber(value.usage.input_tokens, true);
    outputTokens = optionalUsageNumber(value.usage.output_tokens, true);
    costUsd = optionalUsageNumber(value.usage.cost, false);
  }

  return {
    model: value.model,
    answers: Object.fromEntries(answers),
    usage: { inputTokens, outputTokens, costUsd },
    latencyMs,
  };
}

function normalizeAnswer(
  answer: Record<string, unknown>,
  question: DecisionQuestion,
): DecisionAnswer {
  if (answer.type !== undefined && answer.type !== question.type) {
    throw new SafeDecisionError('Decision provider returned an invalid answer');
  }

  if (question.type === 'noul') {
    if (!isProbability(answer.noul))
      throw new SafeDecisionError('Decision provider returned an invalid answer');
    return { type: 'noul', noul: answer.noul };
  }

  const confidence = optionalProbability(answer.confidence);
  if (question.type === 'choice') {
    if (
      typeof answer.choice !== 'string' ||
      !hasOwn(question.criteria, answer.choice) ||
      !isRecord(answer.probabilities)
    ) {
      throw new SafeDecisionError('Decision provider returned an invalid answer');
    }
    const probabilities = exactDistribution(answer.probabilities, Object.keys(question.criteria));
    return { type: 'choice', choice: answer.choice, probabilities, confidence };
  }

  const levels = question.criteria.map((_criterion, index) => String(index));
  if (
    typeof answer.score !== 'number' ||
    !Number.isFinite(answer.score) ||
    answer.score < 0 ||
    answer.score > question.criteria.length - 1 ||
    !isRecord(answer.probabilities)
  ) {
    throw new SafeDecisionError('Decision provider returned an invalid answer');
  }
  const probabilities = exactDistribution(answer.probabilities, levels);
  return { type: 'score', score: answer.score, probabilities, confidence };
}

function exactDistribution(
  value: Record<string, unknown>,
  expectedKeys: string[],
): Record<string, number> {
  const actualKeys = Object.keys(value);
  if (
    actualKeys.length !== expectedKeys.length ||
    expectedKeys.some((key) => !hasOwn(value, key))
  ) {
    throw new SafeDecisionError('Decision provider returned an invalid probability distribution');
  }
  const probabilities: [string, number][] = [];
  let sum = 0;
  for (const key of expectedKeys) {
    const probability = value[key];
    if (!isProbability(probability)) {
      throw new SafeDecisionError('Decision provider returned an invalid probability distribution');
    }
    probabilities.push([key, probability]);
    sum += probability;
  }
  if (Math.abs(sum - 1) > 0.01) {
    throw new SafeDecisionError('Decision provider returned an invalid probability distribution');
  }
  return Object.fromEntries(probabilities);
}

function optionalProbability(value: unknown): number | null {
  if (value === undefined) return null;
  if (!isProbability(value))
    throw new SafeDecisionError('Decision provider returned an invalid answer');
  return value;
}

function optionalUsageNumber(value: unknown, integer: boolean): number | null {
  if (value === undefined || value === null) return null;
  if (
    typeof value !== 'number' ||
    !Number.isFinite(value) ||
    value < 0 ||
    (integer && !Number.isSafeInteger(value))
  ) {
    throw new SafeDecisionError('Decision provider returned invalid usage');
  }
  return value;
}

function isTruncated(value: Record<string, unknown>): boolean {
  for (const [key, entry] of Object.entries(value)) {
    if (/truncat/i.test(key) && entry === true) return true;
  }
  return isRecord(value.usage) && containsTruncationFlag(value.usage);
}

function containsTruncationFlag(value: Record<string, unknown>): boolean {
  for (const [key, entry] of Object.entries(value)) {
    if (/truncat/i.test(key) && entry === true) return true;
    if (key === 'state_tokens_dropped' && typeof entry === 'number' && entry > 0) return true;
    if (key === 'truncated_questions' && Array.isArray(entry) && entry.length > 0) return true;
    if (
      isRecord(entry) &&
      typeof entry.total === 'number' &&
      typeof entry.distinct === 'number' &&
      entry.distinct < entry.total
    )
      return true;
    if (isRecord(entry) && containsTruncationFlag(entry)) return true;
  }
  return false;
}

function isProbability(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= 1;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function hasOwn(value: object, key: string): boolean {
  return Object.prototype.hasOwnProperty.call(value, key);
}

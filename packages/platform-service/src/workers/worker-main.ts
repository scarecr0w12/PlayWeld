import { createRequire } from 'node:module';
import { setInterval, clearInterval } from 'node:timers';
import { uuidv7, type TaskError } from '@gamecrafter/contracts';
import type { TaskHandler } from './types';
import type { WorkerCommand, WorkerMessage, WorkerRunPayload } from './types';
import { checkpointAnswerOffset } from './checkpoint-answers';

const localRequire = createRequire(__filename);
const checkpointAcks = new Map<string, () => void>();
let finalResultAck: (() => void) | undefined;
const pendingAnswers = new Map<string, (answer: unknown) => void>();
const pendingToolCalls = new Map<
  string,
  { resolve(output: unknown): void; reject(error: Error): void; removeAbort(): void }
>();
let controller: AbortController | undefined;
let heartbeat: NodeJS.Timeout | undefined;
let activeRun = false;

process.on('message', (message: WorkerCommand) => {
  if (message.type === 'run') {
    if (activeRun) return;
    activeRun = true;
    void run(message);
  } else if (message.type === 'checkpoint-ack') {
    checkpointAcks.get(message.requestId)?.();
    checkpointAcks.delete(message.requestId);
  } else if (message.type === 'result-ack') {
    finalResultAck?.();
    finalResultAck = undefined;
  } else if (message.type === 'answer') {
    const resolve = pendingAnswers.get(message.questionId);
    if (resolve) {
      pendingAnswers.delete(message.questionId);
      resolve(message.answer);
      void send({ type: 'answer-received', questionId: message.questionId });
    }
  } else if (message.type === 'tool-result') {
    const pending = pendingToolCalls.get(message.requestId);
    if (pending) {
      pendingToolCalls.delete(message.requestId);
      pending.removeAbort();
      if (message.error) {
        const error = new Error(message.error.message);
        if (message.error.code !== undefined) Object.assign(error, { code: message.error.code });
        pending.reject(error);
      } else {
        pending.resolve(message.output);
      }
    }
  } else if (message.type === 'cancel') {
    controller?.abort('cancel');
  } else if (message.type === 'checkpoint-and-stop') {
    controller?.abort('shutdown');
  }
});

async function run(payload: WorkerRunPayload): Promise<void> {
  askIndex = checkpointAnswerOffset(payload.checkpoint);
  const activeController = new AbortController();
  controller = activeController;
  heartbeat = setInterval(() => {
    void send({ type: 'heartbeat' });
  }, 5000);
  heartbeat.unref();

  try {
    const loaded = localRequire(payload.handler.module) as Record<string, unknown>;
    const handler = (payload.handler.export ? loaded[payload.handler.export] : loaded.default) as
      TaskHandler | undefined;
    if (typeof handler !== 'function') {
      throw new Error(`Task handler export not found: ${payload.handler.export ?? 'default'}`);
    }
    const result = await handler({
      task: payload.task,
      input: payload.input,
      tools: payload.tools ?? [],
      initialCheckpoint: payload.checkpoint,
      signal: activeController.signal,
      progress: (message, percent) => {
        void send({ type: 'progress', message, ...(percent === undefined ? {} : { percent }) });
      },
      checkpoint: async (checkpoint) => {
        const requestId = uuidv7();
        const acknowledged = new Promise<void>((resolve) => checkpointAcks.set(requestId, resolve));
        await send({ type: 'checkpoint', requestId, checkpoint });
        await acknowledged;
      },
      ask: async (prompt, options) => ask(payload, prompt, options, activeController.signal),
      tool: async (toolId, input) => callTool(payload, toolId, input, activeController.signal),
      reportUsage: async (usage) => {
        await send({ type: 'progress', message: 'usage reported', usage });
      },
    });
    if (activeController.signal.aborted) {
      await finish({ type: 'stopped' });
      return;
    }
    await finish({ type: 'result', result });
  } catch (error) {
    if (activeController.signal.aborted) {
      await finish({ type: 'stopped' });
      return;
    }
    const taskError: TaskError = {
      message: error instanceof Error ? error.message : String(error),
      ...(error instanceof Error &&
      'code' in error &&
      (typeof error.code === 'string' || typeof error.code === 'number')
        ? { code: String(error.code) }
        : {}),
      retryable:
        typeof error === 'object' && error !== null && 'retryable' in error
          ? error.retryable === true
          : false,
    };
    await finish({ type: 'failed', error: taskError });
  }
}

async function ask(
  payload: WorkerRunPayload,
  prompt: string,
  options: string[] | undefined,
  signal: AbortSignal,
): Promise<unknown> {
  const answers = asRecord(asRecord(payload.input).__answers);
  const answeredIds = Object.keys(answers);
  const existingAnswer = answeredIds[askIndex];
  if (existingAnswer) {
    askIndex += 1;
    return answers[existingAnswer];
  }
  if (signal.aborted) throw abortError();

  const questionId = uuidv7();
  const answer = new Promise<unknown>((resolve, reject) => {
    const abort = () => {
      pendingAnswers.delete(questionId);
      reject(abortError());
    };
    signal.addEventListener('abort', abort, { once: true });
    pendingAnswers.set(questionId, (value) => {
      signal.removeEventListener('abort', abort);
      resolve(value);
    });
  });
  await send({
    type: 'question',
    questionId,
    prompt,
    options: options ?? null,
  });
  askIndex += 1;
  return answer;
}

async function callTool(
  payload: WorkerRunPayload,
  toolId: string,
  input: unknown,
  signal: AbortSignal,
): Promise<unknown> {
  if (signal.aborted) throw abortError();
  const requestId = uuidv7();
  let removeAbort: () => void = () => {};
  const result = new Promise<unknown>((resolve, reject) => {
    const abort = () => {
      pendingToolCalls.delete(requestId);
      removeAbort();
      reject(abortError());
    };
    removeAbort = () => signal.removeEventListener('abort', abort);
    signal.addEventListener('abort', abort, { once: true });
    pendingToolCalls.set(requestId, { resolve, reject, removeAbort });
  });
  try {
    await send({
      type: 'tool-call',
      requestId,
      toolId,
      input,
      ...(payload.task.assignee?.accessCeiling
        ? { accessCeiling: payload.task.assignee.accessCeiling }
        : {}),
    });
  } catch (error) {
    const pending = pendingToolCalls.get(requestId);
    pendingToolCalls.delete(requestId);
    pending?.removeAbort();
    throw error;
  }
  return result;
}

let askIndex = 0;

async function finish(message: WorkerMessage): Promise<void> {
  if (heartbeat) clearInterval(heartbeat);
  let acknowledgedBySupervisor = false;
  let resolveAcknowledged: () => void = () => undefined;
  const acknowledged = new Promise<void>((resolve) => {
    resolveAcknowledged = resolve;
  });
  const onDisconnect = () => {
    finalResultAck = undefined;
    resolveAcknowledged();
  };
  process.once('disconnect', onDisconnect);
  finalResultAck = () => {
    acknowledgedBySupervisor = true;
    resolveAcknowledged();
  };
  const timeout = setTimeout(() => {
    finalResultAck = undefined;
    if (process.connected) process.disconnect();
    resolveAcknowledged();
  }, 5_000);
  timeout.unref();

  try {
    await send(message);
  } catch {
    clearTimeout(timeout);
    process.removeListener('disconnect', onDisconnect);
    finalResultAck = undefined;
    if (process.connected) process.disconnect();
    process.exit(0);
    return;
  }

  await acknowledged;
  clearTimeout(timeout);
  process.removeListener('disconnect', onDisconnect);
  finalResultAck = undefined;
  if (process.connected) process.disconnect();
  if (!acknowledgedBySupervisor) process.exit(0);
}

function send(message: WorkerMessage): Promise<void> {
  return new Promise((resolve, reject) => {
    if (!process.send) {
      resolve();
      return;
    }
    process.send(message, (error) => (error ? reject(error) : resolve()));
  });
}

function abortError(): Error {
  const error = new Error('Task worker was cancelled');
  error.name = 'AbortError';
  return error;
}

function asRecord(value: unknown): Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

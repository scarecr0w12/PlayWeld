import { describe, expect, it, vi } from 'vitest';
import type { PendingInput, PendingInputs } from '@gamecrafter/contracts';
vi.mock('@theia/core/shared/inversify', () => ({
  inject: () => () => {},
  injectable: () => () => {},
}));
vi.mock('@theia/core/lib/common/message-service', () => ({ MessageService: class {} }));
vi.mock('@theia/core/lib/common/command', () => ({ CommandService: class {} }));
vi.mock('./control-room-client', () => ({ ControlRoomClientEvents: class {} }));
import { RequestsModel, requestKey } from './requests-model';

export function approval(id = 'approval-a', projectId = 'project-a'): PendingInput {
  return {
    kind: 'approval',
    projectId,
    projectName: projectId,
    taskId: 'task-a',
    taskTitle: 'Build scene',
    rootTaskId: 'root-a',
    rootTaskTitle: 'Create game',
    approval: {
      approvalId: id,
      projectId,
      callId: `call-${id}`,
      toolId: 'fs.write',
      sideEffects: 'workspace-write',
      summary: 'Write a file',
      input: { path: 'game/file.txt' },
      requestedAt: '2026-10-24T00:00:00Z',
      resolvedAt: null,
      approved: null,
      reason: null,
    },
  };
}
export function question(options: string[] | null = null): PendingInput {
  return {
    kind: 'question',
    projectId: 'project-b',
    projectName: 'Second Project',
    taskId: 'task-b',
    taskTitle: 'Choose art',
    rootTaskId: 'root-b',
    rootTaskTitle: 'Create art',
    question: {
      questionId: 'question-a',
      taskId: 'task-b',
      prompt: 'Which style? <img onerror="bad">',
      options,
      askedAt: '2026-10-24T00:00:01Z',
      answer: null,
      answeredAt: null,
    },
  };
}
function fixture(inputs: PendingInput[] = [approval(), approval('approval-b'), question()]) {
  let snapshot: PendingInputs = { schemaVersion: 1, inputs, unavailableProjects: [] };
  const listeners = new Map<string, (event: never) => void>();
  const events = Object.fromEntries(
    [
      'approvalRequested',
      'approvalResolved',
      'taskQuestion',
      'taskChanged',
      'projectChanged',
      'serviceStatus',
    ].map((key) => [
      key,
      vi.fn((listener) => {
        listeners.set(key, listener);
        return { dispose: () => listeners.delete(key) };
      }),
    ]),
  );
  const service = {
    pendingInputs: vi.fn(async () => snapshot),
    approve: vi.fn(async () => {
      snapshot = { ...snapshot, inputs: snapshot.inputs.slice(1) };
    }),
    answerQuestion: vi.fn(async () => undefined),
  };
  let notification!: (value: string | undefined) => void;
  const messages = {
    info: vi.fn(
      () =>
        new Promise<string | undefined>((resolve) => {
          notification = resolve;
        }),
    ),
  };
  const commands = { executeCommand: vi.fn(async () => undefined) };
  const model = new RequestsModel(
    service as never,
    events as never,
    messages as never,
    commands as never,
  );
  return {
    model,
    service,
    messages,
    commands,
    emit: (name: string, event: unknown) => listeners.get(name)?.(event as never),
    dismiss: () => notification(undefined),
    setSnapshot: (next: PendingInputs) => {
      snapshot = next;
    },
  };
}

describe('Requests service projection', () => {
  it('treats an empty choices array as a free-text question', async () => {
    const item = question([]);
    const f = fixture([item]);
    await f.model.refresh();
    await f.model.answer(requestKey(item), 'Hand painted');
    expect(f.service.answerQuestion).toHaveBeenCalledWith(
      'project-b',
      'task-b',
      'question-a',
      'Hand painted',
    );
    f.model.onStop();
  });
  it('refreshes during sustained request events instead of postponing indefinitely', async () => {
    vi.useFakeTimers();
    const f = fixture();
    try {
      for (let index = 0; index < 5; index++) {
        f.emit('taskQuestion', {});
        await vi.advanceTimersByTimeAsync(20);
      }
      expect(f.service.pendingInputs).toHaveBeenCalledTimes(1);
    } finally {
      f.model.onStop();
      vi.useRealTimers();
    }
  });
  it('coalesces event bursts into one refresh and one review notification, never approval actions', async () => {
    vi.useFakeTimers();
    const f = fixture();
    try {
      f.emit('approvalRequested', {});
      f.emit('taskQuestion', {});
      f.emit('approvalRequested', {});
      await vi.advanceTimersByTimeAsync(75);
      expect(f.service.pendingInputs).toHaveBeenCalledTimes(1);
      expect(f.messages.info).toHaveBeenCalledTimes(1);
      expect(f.messages.info.mock.calls[0]).toEqual([
        expect.any(String),
        { timeout: 8000 },
        'Review requests',
      ]);
      await f.model.refresh();
      expect(f.messages.info).toHaveBeenCalledTimes(1);
      expect(f.service.approve).not.toHaveBeenCalled();
      expect(f.service.answerQuestion).not.toHaveBeenCalled();
    } finally {
      f.model.onStop();
      vi.useRealTimers();
    }
  });
  it('decides only the explicitly selected approval and leaves other requests pending', async () => {
    const f = fixture();
    await f.model.refresh();
    const key = requestKey(f.model.snapshot!.inputs[0]!);
    await f.model.decide(key, false);
    expect(f.service.approve).toHaveBeenCalledWith(
      'project-a',
      'approval-a',
      false,
      'Selected Reject in Requests',
    );
    expect(f.model.snapshot!.inputs.map(requestKey)).not.toContain(key);
    expect(f.model.snapshot!.inputs).toHaveLength(2);
    await f.model.decide(key, true);
    expect(f.service.approve).toHaveBeenCalledTimes(1);
    f.model.onStop();
  });
  it('validates choice answers including empty literal choices and preserves free-text content', async () => {
    const q = question(['', 'Watercolour']);
    const f = fixture([q]);
    await f.model.refresh();
    await f.model.answer(requestKey(q), 'arbitrary');
    expect(f.service.answerQuestion).not.toHaveBeenCalled();
    await f.model.answer(requestKey(q), '');
    expect(f.service.answerQuestion).toHaveBeenCalledWith('project-b', 'task-b', 'question-a', '');
    f.setSnapshot({ schemaVersion: 1, inputs: [question()], unavailableProjects: [] });
    await f.model.refresh();
    await f.model.answer(requestKey(q), '  hand painted  ');
    expect(f.service.answerQuestion).toHaveBeenLastCalledWith(
      'project-b',
      'task-b',
      'question-a',
      '  hand painted  ',
    );
    f.model.onStop();
  });
  it('ignores a late response after disconnect and requires a fresh snapshot before acting', async () => {
    const f = fixture();
    let resolve!: (value: PendingInputs) => void;
    f.service.pendingInputs.mockImplementationOnce(
      () =>
        new Promise((done) => {
          resolve = done;
        }),
    );
    const pending = f.model.refresh();
    f.emit('serviceStatus', { connected: false });
    resolve({ schemaVersion: 1, inputs: [approval()], unavailableProjects: [] });
    await pending;
    expect(f.model.available).toBe(false);
    await f.model.decide(requestKey(approval()), true);
    expect(f.service.approve).not.toHaveBeenCalled();
    await f.model.refresh();
    expect(f.model.available).toBe(true);
    f.model.onStop();
  });
  it('preserves visible requests but disables actions when refresh fails and does not retry a failed decision', async () => {
    const f = fixture();
    await f.model.refresh();
    f.service.approve.mockRejectedValueOnce(new Error('Already resolved elsewhere'));
    await f.model.decide(requestKey(approval()), true);
    expect(f.model.actionError).toBe('Already resolved elsewhere');
    expect(f.model.busy.size).toBe(0);
    f.service.pendingInputs.mockRejectedValueOnce(new Error('Disconnected'));
    await f.model.refresh();
    expect(f.model.snapshot!.inputs).toHaveLength(3);
    expect(f.model.available).toBe(false);
    await f.model.decide(requestKey(approval()), true);
    expect(f.service.approve).toHaveBeenCalledTimes(1);
    f.model.onStop();
  });
  it('disposes timers/subscriptions and never opens a view from a late notification action', async () => {
    vi.useFakeTimers();
    const f = fixture();
    await f.model.refresh();
    f.emit('taskQuestion', {});
    f.model.onStop();
    await vi.advanceTimersByTimeAsync(100);
    expect(f.service.pendingInputs).toHaveBeenCalledTimes(1);
    expect(f.commands.executeCommand).not.toHaveBeenCalled();
    vi.useRealTimers();
  });
});

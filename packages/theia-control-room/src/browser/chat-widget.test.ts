import { describe, expect, it, vi } from 'vitest';
import type { ChatConversation, ChatEntry, Model, ProjectSummary } from '@gamecrafter/contracts';
import type { ControlRoomService } from '../common/control-room-protocol';
import type { ControlRoomClientEvents } from './control-room-client';
import type { EditorManager } from '@theia/editor/lib/browser/editor-manager';
import type { CommandService } from '@theia/core/lib/common/command';

// Exercise the real widget methods with only the desktop/DOM seams replaced.
vi.mock('@theia/core/shared/inversify', () => ({
  injectable: () => () => {},
  inject: () => () => {},
}));
vi.mock('@theia/core/lib/browser/widgets/widget', () => ({ Message: class {} }));
vi.mock('./control-room-react-widget', () => ({
  ControlRoomReactWidget: class {
    title = {};
    toDispose = [];
    isDisposed = false;
    update() {}
    addClass() {}
    async resolveProjectSelection(_projects: ProjectSummary[], current: () => string | undefined) {
      // This fixture models an IDE workspace restored to Project A.
      return current() || 'A';
    }
  },
}));
vi.mock('@theia/editor/lib/browser/editor-manager', () => ({ EditorManager: class {} }));
vi.mock('@theia/core/lib/common/command', () => ({ CommandService: Symbol('commands') }));
vi.mock('./control-room-client', () => ({ ControlRoomClientEvents: class {} }));
vi.mock('./models-view-contribution', () => ({ MODELS_OPEN_COMMAND_ID: 'models' }));
vi.mock('./swarm-view-contribution', () => ({ SWARM_OPEN_COMMAND_ID: 'swarm' }));
import { ChatWidget } from './chat-widget';

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: Error) => void;
  const promise = new Promise<T>((yes, no) => {
    resolve = yes;
    reject = no;
  });
  return { promise, resolve, reject };
}

interface Harness {
  projectId: string;
  conversationId: string;
  selectedModelId: string;
  draft: string;
  mode: 'chat' | 'agent';
  messages: ChatEntry[];
  models: Model[];
  busy: boolean;
  error?: string;
  pendingSend?: { requestId?: string; streamText: string };
  refresh(): Promise<void>;
  send(): Promise<void>;
  newConversation(): void;
  selectProject(id: string): void;
  openConversation(id: string): Promise<void>;
  deleteConversation(): Promise<void>;
  isCurrentSend(context: unknown): boolean;
}

async function fixture() {
  const projects = ['A', 'B'].map((projectId) => ({
    projectId,
    name: projectId,
    engine: { family: 'godot' },
    genres: [],
  })) as ProjectSummary[];
  const conversations = ['A-one', 'A-two', 'B-one'].map((conversationId) => ({
    conversationId,
    projectId: conversationId[0],
    title: conversationId,
    createdAt: '2026-10-01T00:00:00Z',
    updatedAt: '2026-10-01T00:00:00Z',
  })) as ChatConversation[];
  const storage: ChatEntry[] = [];
  const completion = deferred<{ content: string; modelId: string }>();
  const entered = deferred<void>();
  let onDelta!: (input: { requestId: string; delta: string }) => void;
  const service = {
    listProjects: vi.fn(async () => projects),
    listModels: vi.fn(async (): Promise<Model[]> => []),
    getEngineCapabilities: vi.fn(async (projectId: string) => ({
      projectId,
      family: 'unreal',
      detectedVersion: '5.8.3',
    })),
    listDccInstallations: vi.fn(async () => [{ tool: 'blender', version: '5.2.2', kind: 'batch' }]),
    listTools: vi.fn(async () => [{ toolId: 'dcc/run-script' }, { toolId: 'fs/write-file' }]),
    listChatConversations: vi.fn(async (projectId: string) =>
      conversations.filter((c) => c.projectId === projectId),
    ),
    listChatMessages: vi.fn(async (projectId: string, conversationId: string) =>
      storage.filter((m) => m.projectId === projectId && m.conversationId === conversationId),
    ),
    createChatConversation: vi.fn(async (projectId: string) => {
      const conversation = { ...conversations[0]!, projectId, conversationId: `${projectId}-new` };
      conversations.push(conversation);
      return conversation;
    }),
    appendChatMessage: vi.fn(async (input: Partial<ChatEntry>) => {
      const entry = {
        ...input,
        messageId: String(storage.length),
        createdAt: '2026-10-01T00:00:00Z',
      } as ChatEntry;
      storage.push(entry);
      return entry;
    }),
    completeChat: vi.fn(() => {
      entered.resolve();
      return completion.promise;
    }),
    requestChange: vi.fn(async () => ({ requestId: 'change-A' })),
    deleteChatConversation: vi.fn(async () => {}),
  };
  const events = {
    modelDelta: (callback: typeof onDelta) => {
      onDelta = callback;
      return { dispose() {} };
    },
    projectChanged: () => ({ dispose() {} }),
  };
  const commands = { executeCommand: vi.fn(async () => {}) };
  const instance = new ChatWidget(
    service as unknown as ControlRoomService,
    events as unknown as ControlRoomClientEvents,
    {} as EditorManager,
    commands as unknown as CommandService,
  );
  const widget = instance as unknown as Harness;
  await widget.refresh();
  await widget.openConversation('A-one');
  widget.draft = 'Question for A';
  widget.selectedModelId = 'model-A';
  return { widget, service, storage, completion, entered, onDelta, commands };
}

describe('chat request ownership', () => {
  it('grounds Chat in current local engine, authoring, and Agent tool capabilities', async () => {
    const f = await fixture();
    const send = f.widget.send();
    await f.entered.promise;
    const call = f.service.completeChat.mock.calls[0] as unknown as [
      { request: { messages: { role: string; content: string }[] } },
    ];
    const system = call[0].request.messages[0]!.content;
    expect(system).toContain('5.8.3');
    expect(system).toContain('blender 5.2.2');
    expect(system).toContain('dcc/run-script');
    expect(f.service.getEngineCapabilities).toHaveBeenCalledWith('A');
    f.completion.resolve({ content: 'Grounded answer', modelId: 'model-A' });
    await send;
  });
  it('opens the exact Project and change request after an Agent handoff', async () => {
    const f = await fixture();
    f.widget.mode = 'agent';
    await f.widget.send();
    expect(f.commands.executeCommand).toHaveBeenCalledWith('swarm', {
      projectId: 'A',
      requestId: 'change-A',
    });
  });
  it.each(['auto', 'manual'])(
    'offers chat models without streaming metadata for %s routing',
    async (mode) => {
      const f = await fixture();
      const model = { modelId: 'model-A', capabilities: { chat: true, streaming: false } } as Model;
      f.service.listModels.mockResolvedValue([model]);
      await f.widget.refresh();
      expect(f.widget.models).toEqual([model]);
      f.widget.selectedModelId = mode === 'manual' ? model.modelId : '';
      const sending = f.widget.send();
      await f.entered.promise;
      expect(f.service.completeChat.mock.calls[0]).toMatchObject([
        { route: { taskType: 'chat', requiredCapabilities: ['chat'] } },
      ]);
      f.completion.resolve({ content: 'Answer', modelId: model.modelId });
      await sending;
      expect(f.storage.at(-1)?.content).toBe('Answer');
    },
  );
  it.each(['project', 'conversation', 'new conversation'] as const)(
    'retains origin while navigating to a different %s during completion',
    async (destination) => {
      const f = await fixture();
      const sending = f.widget.send();
      await f.entered.promise;
      if (destination === 'project') {
        f.widget.selectProject('B');
        await f.widget.refresh();
        await f.widget.openConversation('B-one');
      } else if (destination === 'conversation') {
        await f.widget.openConversation('A-two');
      } else f.widget.newConversation();
      f.widget.selectedModelId = 'model-B';
      f.widget.mode = 'agent';
      f.onDelta({ requestId: f.widget.pendingSend!.requestId!, delta: 'Origin stream' });
      expect(f.widget.isCurrentSend(f.widget.pendingSend)).toBe(false);
      expect(f.widget.messages).toEqual([]);
      f.completion.resolve({ content: 'Answer for A', modelId: 'model-A' });
      await sending;
      expect(
        f.storage.map(({ projectId, conversationId, role }) => ({
          projectId,
          conversationId,
          role,
        })),
      ).toEqual([
        { projectId: 'A', conversationId: 'A-one', role: 'user' },
        { projectId: 'A', conversationId: 'A-one', role: 'assistant' },
      ]);
      expect(f.widget.messages).toEqual([]);
      expect(f.service.completeChat.mock.calls[0]).toMatchObject([
        { projectId: 'A', route: { manualModelId: 'model-A' } },
      ]);
      expect(f.service.requestChange).not.toHaveBeenCalled();
      expect(f.widget.busy).toBe(false);
    },
  );

  it('does not replace a new draft conversation when conversation creation completes late', async () => {
    const f = await fixture();
    f.widget.newConversation();
    const created = deferred<ChatConversation>();
    f.service.createChatConversation.mockImplementation(() => created.promise);
    const sending = f.widget.send();
    f.widget.newConversation();
    created.resolve({
      projectId: 'A',
      conversationId: 'A-created',
      title: 'Origin',
    } as ChatConversation);
    await f.entered.promise;
    f.completion.resolve({ content: 'Late answer', modelId: 'model-A' });
    await sending;
    expect(f.widget.conversationId).toBe('');
    expect(f.widget.messages).toEqual([]);
    expect(f.storage.every((m) => m.projectId === 'A' && m.conversationId === 'A-created')).toBe(
      true,
    );
  });

  it('keeps late errors with the origin and shows them when returning', async () => {
    const f = await fixture();
    const sending = f.widget.send();
    await f.entered.promise;
    await f.widget.openConversation('A-two');
    f.completion.reject(new Error('Origin provider failed'));
    await sending;
    expect(f.widget.error).toBeUndefined();
    expect(f.storage).toHaveLength(1);
    await f.widget.openConversation('A-one');
    expect(f.widget.error).toBe('Origin provider failed');
  });

  it('retains streamed fallback and renders the saved answer after returning to the origin', async () => {
    const f = await fixture();
    const sending = f.widget.send();
    await f.entered.promise;
    await f.widget.openConversation('A-two');
    f.onDelta({ requestId: f.widget.pendingSend!.requestId!, delta: 'Stream for A' });
    await f.widget.openConversation('A-one');
    expect(f.widget.isCurrentSend(f.widget.pendingSend)).toBe(true);
    f.completion.resolve({ content: '', modelId: 'model-A' });
    await sending;
    expect(f.widget.messages.at(-1)?.content).toBe('Stream for A');
  });

  it('captures mode, history and project before the user-message write resolves', async () => {
    const f = await fixture();
    f.widget.mode = 'agent';
    f.widget.messages = [{ role: 'assistant', content: 'Origin history' } as ChatEntry];
    const appended = deferred<ChatEntry>();
    f.service.appendChatMessage.mockImplementationOnce(() => appended.promise);
    const sending = f.widget.send();
    await f.widget.openConversation('A-two');
    f.widget.mode = 'chat';
    f.widget.messages = [{ role: 'assistant', content: 'Foreign history' } as ChatEntry];
    appended.resolve({ role: 'user', content: 'Question for A' } as ChatEntry);
    await sending;
    expect(f.service.requestChange).toHaveBeenCalledWith({
      projectId: 'A',
      text: expect.stringContaining('Origin history'),
    });
    expect(f.service.requestChange.mock.calls[0]).not.toEqual(
      expect.arrayContaining([
        expect.objectContaining({ text: expect.stringContaining('Foreign history') }),
      ]),
    );
    expect(f.service.appendChatMessage).toHaveBeenLastCalledWith(
      expect.objectContaining({ projectId: 'A', conversationId: 'A-one', role: 'assistant' }),
    );
    expect(f.commands.executeCommand).not.toHaveBeenCalled();
  });

  it('rejects deletion during an in-flight response and ignores late navigation reads', async () => {
    const f = await fixture();
    const sending = f.widget.send();
    await f.entered.promise;
    await f.widget.deleteConversation();
    expect(f.service.deleteChatConversation).not.toHaveBeenCalled();
    const late = deferred<ChatEntry[]>();
    f.service.listChatMessages.mockImplementationOnce(() => late.promise);
    const opening = f.widget.openConversation('A-two');
    f.widget.newConversation();
    late.resolve([{ content: 'Stale navigation' } as ChatEntry]);
    await opening;
    expect(f.widget.messages).toEqual([]);
    f.completion.resolve({ content: 'Answer', modelId: 'model-A' });
    await sending;
    expect(f.widget.conversationId).toBe('');
  });
});

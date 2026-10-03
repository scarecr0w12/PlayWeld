import React from 'react';
import { inject, injectable } from '@theia/core/shared/inversify';
import { Message } from '@theia/core/lib/browser/widgets/widget';
import { ControlRoomReactWidget } from './control-room-react-widget';
import { EditorManager } from '@theia/editor/lib/browser/editor-manager';
import {
  uuidv7,
  type ChatConversation,
  type ChatEntry,
  type Model,
  type ProjectSummary,
} from '@gamecrafter/contracts';
import {
  ControlRoomService,
  type ControlRoomService as ControlRoomServiceApi,
} from '../common/control-room-protocol';
import { ControlRoomClientEvents } from './control-room-client';
import { MODELS_OPEN_COMMAND_ID } from './models-view-contribution';
import { SWARM_OPEN_COMMAND_ID } from './swarm-view-contribution';
import { CommandService } from '@theia/core/lib/common/command';

interface PendingChat {
  projectId: string;
  conversationId: string;
  navigationVersion: number;
  mode: 'chat' | 'agent';
  requestId?: string;
  streamText: string;
}

@injectable()
export class ChatWidget extends ControlRoomReactWidget {
  static readonly ID = 'gamecrafter.chat';

  private projects: ProjectSummary[] = [];
  private models: Model[] = [];
  private conversations: ChatConversation[] = [];
  private messages: ChatEntry[] = [];
  private projectId = '';
  private conversationId = '';
  private selectedModelId = '';
  private draft = '';
  private mode: 'chat' | 'agent' = 'chat';
  private attachEditor = false;
  private busy = false;
  private pendingSend?: PendingChat;
  private navigationVersion = 0;
  private refreshVersion = 0;
  private readonly responseErrors = new Map<string, string>();
  private error?: string;

  constructor(
    @inject(ControlRoomService) private readonly service: ControlRoomServiceApi,
    @inject(ControlRoomClientEvents) private readonly events: ControlRoomClientEvents,
    @inject(EditorManager) private readonly editorManager: EditorManager,
    @inject(CommandService) private readonly commands: CommandService,
  ) {
    super();
    this.id = ChatWidget.ID;
    this.title.label = 'Chat';
    this.title.iconClass = 'codicon codicon-comment-discussion';
    this.title.closable = true;
    this.addClass('gamecrafter-chat-widget');
    this.toDispose.push(
      this.events.modelDelta(({ requestId, delta }) => {
        if (!this.pendingSend || requestId !== this.pendingSend.requestId) return;
        this.pendingSend.streamText += delta;
        if (this.isCurrentSend(this.pendingSend)) this.update();
      }),
    );
    this.toDispose.push(this.events.projectChanged(() => void this.refresh()));
    void this.refresh();
  }

  protected onActivateRequest(message: Message): void {
    super.onActivateRequest(message);
    void this.refresh();
  }

  protected render(): React.ReactNode {
    const currentConversation = this.conversations.find(
      (conversation) => conversation.conversationId === this.conversationId,
    );
    const activeEditor = this.editorManager.currentEditor;
    const editorName = activeEditor?.getResourceUri()?.path.base ?? 'No file open';
    return (
      <div className="gamecrafter-chat gamecrafter-surface">
        <aside className="gamecrafter-chat-sidebar">
          <header>
            <strong>Conversations</strong>
            <button type="button" aria-label="New chat" onClick={() => void this.newConversation()}>
              +
            </button>
            {this.conversationId && (
              <button
                type="button"
                aria-label="Delete conversation"
                disabled={this.busy}
                onClick={() => void this.deleteConversation()}
              >
                Delete
              </button>
            )}
          </header>
          <label>
            Project
            <select
              aria-label="Chat Project"
              value={this.projectId}
              onChange={(event) => {
                this.markProjectSelection();
                this.selectProject(event.currentTarget.value);
              }}
            >
              <option value="">Select Project</option>
              {this.projects.map((project) => (
                <option key={project.projectId} value={project.projectId}>
                  {project.name}
                </option>
              ))}
            </select>
          </label>
          <select
            className="gamecrafter-chat-conversation-select"
            aria-label="Chat conversation"
            value={this.conversationId}
            onChange={(event) => {
              const id = event.currentTarget.value;
              if (id) void this.openConversation(id);
              else this.newConversation();
            }}
          >
            <option value="">New conversation</option>
            {this.conversations.map((conversation) => (
              <option key={conversation.conversationId} value={conversation.conversationId}>
                {conversation.title}
              </option>
            ))}
          </select>
          <nav aria-label="Chat conversations">
            {this.conversations.map((conversation) => (
              <button
                className={conversation.conversationId === this.conversationId ? 'is-active' : ''}
                key={conversation.conversationId}
                type="button"
                onClick={() => void this.openConversation(conversation.conversationId)}
              >
                <span>{conversation.title}</span>
                <small>{new Date(conversation.updatedAt).toLocaleDateString()}</small>
              </button>
            ))}
          </nav>
        </aside>
        <main className="gamecrafter-chat-main">
          <header className="gamecrafter-chat-header">
            <div>
              <h1>{currentConversation?.title ?? 'New conversation'}</h1>
              <p>
                Chat answers questions; Agent mode delegates tool-using work to the Project swarm.
              </p>
            </div>
            <div className="gamecrafter-chat-model-picker">
              <label>
                Model
                <select
                  aria-label="Chat model"
                  value={this.selectedModelId}
                  onChange={(event) => {
                    this.selectedModelId = event.currentTarget.value;
                    this.update();
                  }}
                >
                  <option value="">Auto route</option>
                  {this.models.map((model) => (
                    <option key={model.modelId} value={model.modelId}>
                      {model.displayName}
                    </option>
                  ))}
                </select>
              </label>
              <button
                type="button"
                onClick={() => void this.commands.executeCommand(MODELS_OPEN_COMMAND_ID)}
              >
                Manage models
              </button>
            </div>
          </header>
          {this.error && (
            <p className="gamecrafter-chat-error" role="alert">
              {this.error}
            </p>
          )}
          {this.busy && this.pendingSend && !this.isCurrentSend(this.pendingSend) && (
            <p role="status">
              A response is still pending in another conversation. You can return to it while it
              finishes.
            </p>
          )}
          {this.models.length === 0 && this.projectId && (
            <p className="gamecrafter-chat-empty" role="status">
              No enabled chat models are available. Add an account and discover a model in Models
              &amp; Routing.
            </p>
          )}
          <section className="gamecrafter-chat-transcript" aria-label="Conversation messages">
            {!this.projectId ? (
              <div className="gamecrafter-chat-empty">
                Choose a Project to start a conversation.
              </div>
            ) : this.messages.length === 0 ? (
              <div className="gamecrafter-chat-empty">
                <h2>What are you working on?</h2>
                <p>
                  Ask about your game, code, design canon, or the tools available in this Project.
                </p>
              </div>
            ) : (
              this.messages.map((entry) => (
                <article
                  className={`gamecrafter-chat-message is-${entry.role}`}
                  key={entry.messageId}
                >
                  <header>
                    <strong>
                      {entry.role === 'user'
                        ? 'You'
                        : entry.role === 'assistant'
                          ? 'PlayWeld'
                          : 'System'}
                    </strong>
                    <time>{new Date(entry.createdAt).toLocaleTimeString()}</time>
                  </header>
                  <div className="gamecrafter-chat-message-content">{entry.content}</div>
                  {entry.modelId && (
                    <footer>
                      {entry.modelId} · {entry.usage?.inputTokens ?? 0} in /{' '}
                      {entry.usage?.outputTokens ?? 0} out
                      {entry.usage?.costUsd === null || entry.usage?.costUsd === undefined
                        ? ''
                        : ` · $${entry.usage.costUsd.toFixed(4)}`}
                    </footer>
                  )}
                </article>
              ))
            )}
            {this.busy && this.pendingSend && this.isCurrentSend(this.pendingSend) && (
              <article className="gamecrafter-chat-message is-assistant" aria-live="polite">
                <header>
                  <strong>
                    {this.pendingSend.mode === 'agent' ? 'Swarm handoff' : 'PlayWeld'}
                  </strong>
                </header>
                <div className="gamecrafter-chat-message-content">
                  {this.pendingSend.streamText ||
                    (this.pendingSend.mode === 'agent' ? 'Creating change request…' : 'Thinking…')}
                </div>
              </article>
            )}
          </section>
          {this.messages.some((entry) => entry.role === 'user') && (
            <button
              className="gamecrafter-chat-delegate"
              type="button"
              disabled={this.busy}
              onClick={() => void this.delegateLastRequest()}
            >
              Delegate conversation to Swarm
            </button>
          )}
          <form
            className="gamecrafter-chat-composer"
            onSubmit={(event) => {
              event.preventDefault();
              void this.send();
            }}
          >
            <div className="gamecrafter-chat-composer-options">
              <div role="group" aria-label="Assistant mode" className="gamecrafter-chat-modes">
                <button
                  type="button"
                  aria-pressed={this.mode === 'chat'}
                  onClick={() => this.setMode('chat')}
                >
                  Chat
                </button>
                <button
                  type="button"
                  aria-pressed={this.mode === 'agent'}
                  onClick={() => this.setMode('agent')}
                >
                  Agent
                </button>
              </div>
              <label className="gamecrafter-chat-attach">
                <input
                  type="checkbox"
                  checked={this.attachEditor}
                  onChange={(event) => {
                    this.attachEditor = event.currentTarget.checked;
                    this.update();
                  }}
                />
                Attach active file <small>{editorName}</small>
              </label>
            </div>
            <textarea
              aria-label="Message"
              placeholder={
                this.mode === 'agent' ? 'Describe work for the Project swarm…' : 'Ask PlayWeld…'
              }
              value={this.draft}
              disabled={!this.projectId || this.busy}
              onChange={(event) => {
                this.draft = event.currentTarget.value;
                this.update();
              }}
              onKeyDown={(event) => {
                if (event.key === 'Enter' && !event.shiftKey) {
                  event.preventDefault();
                  void this.send();
                }
              }}
            />
            <footer>
              <small>Enter to send · Shift+Enter for a new line</small>
              <button
                className="theia-button"
                type="submit"
                disabled={
                  !this.draft.trim() ||
                  !this.projectId ||
                  this.busy ||
                  (this.mode === 'chat' && this.models.length === 0)
                }
              >
                {this.mode === 'agent' ? 'Send to Swarm' : 'Send'}
              </button>
            </footer>
          </form>
        </main>
      </div>
    );
  }

  private setMode(mode: 'chat' | 'agent'): void {
    this.mode = mode;
    this.update();
  }

  private selectProject(projectId: string): void {
    ++this.navigationVersion;
    ++this.refreshVersion;
    this.projectId = projectId;
    this.conversationId = '';
    this.conversations = [];
    this.messages = [];
    this.error = undefined;
    this.update();
    void this.refresh();
  }

  private async refresh(): Promise<void> {
    const version = ++this.refreshVersion;
    const navigationVersion = this.navigationVersion;
    try {
      const projects = await this.service.listProjects();
      if (version !== this.refreshVersion || this.isDisposed) return;
      this.projects = projects;
      const projectIdSelection = await this.resolveProjectSelection(projects, () => this.projectId);
      if (version !== this.refreshVersion || this.isDisposed) return;
      if (projectIdSelection !== this.projectId) {
        this.projectId = projectIdSelection;
        this.conversationId = '';
        this.messages = [];
      }
      const projectId = this.projectId;
      const conversationId = this.conversationId;
      const [conversations, models, messages] = await Promise.all([
        projectId ? this.service.listChatConversations(projectId) : Promise.resolve([]),
        this.service.listModels(undefined, true),
        projectId && conversationId
          ? this.service.listChatMessages(projectId, conversationId)
          : Promise.resolve([]),
      ]);
      if (
        version !== this.refreshVersion ||
        navigationVersion !== this.navigationVersion ||
        this.isDisposed
      )
        return;
      this.conversations = conversations;
      this.models = models.filter((model) => model.capabilities.chat);
      if (
        conversationId &&
        !conversations.some((entry) => entry.conversationId === conversationId)
      ) {
        this.conversationId = '';
        this.messages = [];
      } else {
        this.messages = messages;
      }
      this.error = this.responseErrors.get(this.contextKey(this.projectId, this.conversationId));
    } catch (error) {
      if (
        version !== this.refreshVersion ||
        navigationVersion !== this.navigationVersion ||
        this.isDisposed
      )
        return;
      this.error = messageOf(error);
    }
    this.update();
  }

  private newConversation(): void {
    if (!this.projectId) return;
    ++this.navigationVersion;
    ++this.refreshVersion;
    this.conversationId = '';
    this.messages = [];
    this.error = undefined;
    this.update();
  }

  private async openConversation(conversationId: string): Promise<void> {
    if (!this.projectId) return;
    const projectId = this.projectId;
    const version = ++this.navigationVersion;
    ++this.refreshVersion;
    this.conversationId = conversationId;
    this.messages = [];
    this.error = this.responseErrors.get(this.contextKey(projectId, conversationId));
    this.update();
    try {
      const messages = await this.service.listChatMessages(projectId, conversationId);
      if (version !== this.navigationVersion || this.isDisposed) return;
      this.messages = messages;
    } catch (error) {
      if (version !== this.navigationVersion || this.isDisposed) return;
      this.error = messageOf(error);
    }
    this.update();
  }

  private async deleteConversation(): Promise<void> {
    if (!this.projectId || !this.conversationId || this.busy) return;
    const projectId = this.projectId;
    const conversationId = this.conversationId;
    const version = this.navigationVersion;
    try {
      await this.service.deleteChatConversation(projectId, conversationId);
      this.responseErrors.delete(this.contextKey(projectId, conversationId));
      if (version !== this.navigationVersion || this.isDisposed) return;
      this.conversations = this.conversations.filter(
        (entry) => entry.conversationId !== conversationId,
      );
      this.newConversation();
    } catch (error) {
      if (version !== this.navigationVersion || this.isDisposed) return;
      this.error = messageOf(error);
      this.update();
    }
  }

  private contextKey(projectId: string, conversationId: string): string {
    return JSON.stringify([projectId, conversationId]);
  }

  private isCurrentSend(context: PendingChat): boolean {
    return (
      !this.isDisposed &&
      context.projectId === this.projectId &&
      context.conversationId === this.conversationId &&
      (context.conversationId !== '' || context.navigationVersion === this.navigationVersion)
    );
  }

  private async send(): Promise<void> {
    const raw = this.draft.trim();
    if (!raw || !this.projectId || this.busy) return;
    // Capture everything used by the request before the first asynchronous operation.
    const context: PendingChat = {
      projectId: this.projectId,
      conversationId: this.conversationId,
      navigationVersion: this.navigationVersion,
      mode: this.mode,
      streamText: '',
    };
    const prior = [...this.messages];
    const project = this.projects.find((entry) => entry.projectId === context.projectId);
    const selectedModelId = this.selectedModelId;
    const prompt = this.attachEditor ? `${raw}\n\n${this.editorContext()}` : raw;
    this.pendingSend = context;
    this.busy = true;
    this.error = undefined;
    this.responseErrors.delete(this.contextKey(context.projectId, context.conversationId));
    this.draft = '';
    this.update();
    try {
      if (!context.conversationId) {
        const conversation = await this.service.createChatConversation(
          context.projectId,
          titleFrom(raw),
        );
        const stillCurrent = this.isCurrentSend(context);
        context.conversationId = conversation.conversationId;
        if (stillCurrent) {
          this.conversationId = conversation.conversationId;
          this.conversations = [conversation, ...this.conversations];
        }
      }
      const userMessage = await this.service.appendChatMessage({
        projectId: context.projectId,
        conversationId: context.conversationId,
        role: 'user',
        content: prompt,
      });
      const history = [...prior, userMessage];
      if (this.isCurrentSend(context)) {
        this.messages = history;
        this.update();
      }
      if (context.mode === 'agent') {
        const change = await this.service.requestChange({
          projectId: context.projectId,
          text: this.agentPrompt(prompt, prior),
        });
        await this.service.appendChatMessage({
          projectId: context.projectId,
          conversationId: context.conversationId,
          role: 'assistant',
          content: `Delegated to the Project swarm. Change request ${change.requestId} was created. Open Swarm to follow task progress, questions, approvals, and results.`,
        });
        if (this.isCurrentSend(context))
          await this.commands.executeCommand(SWARM_OPEN_COMMAND_ID, {
            projectId: context.projectId,
            requestId: change.requestId,
          });
      } else {
        const requestId = uuidv7();
        context.requestId = requestId;
        const liveContext = await this.liveProjectContext(context.projectId);
        const result = await this.service.completeChat({
          projectId: context.projectId,
          requestId,
          route: {
            taskType: 'chat',
            projectId: context.projectId,
            requiredCapabilities: ['chat'],
            ...(selectedModelId ? { manualModelId: selectedModelId } : {}),
          },
          request: {
            messages: [
              {
                role: 'system',
                content: [
                  'You are PlayWeld, an assistant inside a game-development IDE.',
                  'Give practical, honest help and use the supplied Project context.',
                  'Chat mode cannot edit files or invoke tools. For implementation work, tell the user to switch to Agent mode, which delegates to the Project swarm and its existing access controls.',
                  `Project: ${project?.name ?? 'Unknown'}`,
                  `Description: ${project?.description ?? ''}`,
                  `Engine: ${project?.engine.family ?? 'Unknown'}`,
                  `Genres: ${project?.genres.join(', ') || 'not specified'}`,
                  ...liveContext,
                ].join('\n'),
              },
              ...history
                .filter((entry) => entry.role !== 'system')
                .map(({ role, content }) => ({ role, content }) as const),
            ],
            stream: true,
          },
        });
        await this.service.appendChatMessage({
          projectId: context.projectId,
          conversationId: context.conversationId,
          role: 'assistant',
          content: result.content || context.streamText,
          modelId: result.modelId,
          usage: result.usage,
        });
      }
      if (this.isCurrentSend(context)) await this.refresh();
    } catch (error) {
      const message = messageOf(error);
      this.responseErrors.set(this.contextKey(context.projectId, context.conversationId), message);
      if (this.isCurrentSend(context)) this.error = message;
    } finally {
      this.busy = false;
      this.pendingSend = undefined;
      this.update();
    }
  }

  private async liveProjectContext(projectId: string): Promise<string[]> {
    const [engine, dcc, tools] = await Promise.allSettled([
      this.service.getEngineCapabilities(projectId),
      this.service.listDccInstallations(),
      this.service.listTools(projectId),
    ]);
    const context = [
      `Current date: ${new Date().toISOString().slice(0, 10)}`,
      'Treat detected local versions as authoritative even when your training knowledge is older.',
      'Agent mode can author scripts and editable assets through the listed tools, subject to Project access and approvals. Do not claim those operations are unavailable merely because Chat mode cannot execute them.',
    ];
    if (engine.status === 'fulfilled') {
      context.push(`Detected Project engine: ${JSON.stringify(engine.value)}`);
    } else context.push('Current Project engine capabilities could not be retrieved.');
    if (dcc.status === 'fulfilled') {
      context.push(
        `Installed authoring tools: ${dcc.value.map(({ tool, version, kind }) => `${tool} ${version ?? 'unknown version'} (${kind})`).join(', ') || 'none detected'}`,
      );
    } else context.push('Installed authoring tools could not be retrieved.');
    if (tools.status === 'fulfilled') {
      context.push(
        `Available Project tool IDs: ${tools.value.map(({ toolId }) => toolId).join(', ')}`,
      );
    } else context.push('Current Project tool inventory could not be retrieved.');
    return context;
  }

  private async delegateLastRequest(): Promise<void> {
    const lastUser = [...this.messages].reverse().find((entry) => entry.role === 'user');
    if (!lastUser) return;
    this.draft = lastUser.content;
    this.mode = 'agent';
    await this.send();
  }

  private agentPrompt(prompt: string, messages: ChatEntry[]): string {
    const prior = messages.slice(-12);
    const context = prior.map((entry) => `${entry.role}: ${entry.content}`).join('\n\n');
    return context ? `Conversation context:\n${context}\n\nRequested work:\n${prompt}` : prompt;
  }

  private editorContext(): string {
    const editor = this.editorManager.currentEditor;
    if (!editor) return 'Editor context requested, but no text editor is active.';
    const uri = editor.getResourceUri()?.toString() ?? 'unknown file';
    const selection = editor.editor.selection;
    const document = editor.editor.document;
    const hasSelection =
      selection &&
      (selection.start.line !== selection.end.line ||
        selection.start.character !== selection.end.character);
    const selectedText = hasSelection ? document.getText(selection) : '';
    const text = selectedText || document.getText();
    return `Current editor: ${uri}\n${selectedText ? 'Selected text' : 'File excerpt'}:\n${text.slice(0, 20_000)}`;
  }
}

function titleFrom(text: string): string {
  const firstLine = text.split('\n', 1)[0]?.trim() ?? 'New conversation';
  return firstLine.length > 72 ? `${firstLine.slice(0, 69)}...` : firstLine;
}

function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

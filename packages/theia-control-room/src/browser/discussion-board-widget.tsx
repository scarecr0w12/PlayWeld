import React from 'react';
import { inject, injectable } from '@theia/core/shared/inversify';
import { Message } from '@theia/core/lib/browser/widgets/widget';
import { ControlRoomReactWidget } from './control-room-react-widget';
import { QuickInputService } from '@theia/core/lib/common/quick-pick-service';
import type {
  BindingDecision,
  BoardLink,
  BoardMessage,
  BoardMessageType,
  BoardThread,
  BoardThreadKind,
  BoardThreadStatus,
  CanonSyncProposal,
  ProjectSummary,
} from '@gamecrafter/contracts';
import {
  ControlRoomService,
  type ControlRoomService as ControlRoomServiceApi,
} from '../common/control-room-protocol';
import { ControlRoomClientEvents } from './control-room-client';

type BoardMessageTypeInput = Exclude<BoardMessageType, 'summary' | 'system'>;
type BoardThreadDetail = { thread: BoardThread; messages: BoardMessage[] };
type BoardDecisionDetail = { decision: BindingDecision; proposals: CanonSyncProposal[] };

const threadKinds: BoardThreadKind[] = [
  'discussion',
  'question',
  'proposal',
  'decision',
  'blocker',
  'status',
];
const messageTypes: BoardMessageTypeInput[] = [
  'question',
  'proposal',
  'finding',
  'blocker',
  'evidence',
  'decision',
  'comment',
];

@injectable()
export class DiscussionBoardWidget extends ControlRoomReactWidget {
  static readonly ID = 'gamecrafter.board';

  private projects: ProjectSummary[] = [];
  private projectId?: string;
  private threads: BoardThread[] = [];
  private threadDetail?: BoardThreadDetail;
  private decisions: BoardDecisionDetail[] = [];
  private maintenance?: {
    lastAuditAt: string | null;
    lastCleanupAt: string | null;
    nextAuditAt: string | null;
    pendingDecisions: number;
    runningTaskId: string | null;
  };
  private accessMode = 'ask-always';
  private allowDeletion = false;
  private statusFilter: '' | BoardThreadStatus = '';
  private kindFilter: '' | BoardThreadKind = '';
  private tagsFilter = '';
  private search = '';
  private createTitle = '';
  private createKind: BoardThreadKind = 'discussion';
  private createTags = '';
  private createBody = '';
  private createType: BoardMessageTypeInput = 'comment';
  private messageType: BoardMessageTypeInput = 'comment';
  private messageBody = '';
  private messageLinks = '[]';
  private errorMessage?: string;
  private resultMessage?: string;
  private busy = false;

  constructor(
    @inject(ControlRoomService)
    private readonly service: ControlRoomServiceApi,
    @inject(ControlRoomClientEvents)
    private readonly clientEvents: ControlRoomClientEvents,
    @inject(QuickInputService)
    private readonly quickInput: QuickInputService,
  ) {
    super();
    this.id = DiscussionBoardWidget.ID;
    this.title.label = 'Discussion Board';
    this.title.iconClass = 'codicon codicon-comment-discussion';
    this.title.closable = true;
    this.toDispose.push(
      this.clientEvents.boardThreadChanged((event) => {
        if (event.projectId === this.projectId) void this.refresh();
      }),
    );
    this.toDispose.push(
      this.clientEvents.boardMessagePosted((event) => {
        if (event.projectId === this.projectId) void this.refresh();
      }),
    );
    this.toDispose.push(
      this.clientEvents.boardDecisionChanged((event) => {
        if (event.projectId === this.projectId) void this.refresh();
      }),
    );
    this.toDispose.push(
      this.clientEvents.taskChanged((event) => {
        if (
          event.projectId === this.projectId &&
          event.task.kind.startsWith('board-maintenance.')
        ) {
          void this.refresh();
        }
      }),
    );
    void this.refresh();
  }

  protected onActivateRequest(message: Message): void {
    super.onActivateRequest(message);
    void this.refresh();
  }

  protected render(): React.ReactNode {
    const activeThread = this.threadDetail?.thread;
    return (
      <div className="gamecrafter-board gamecrafter-surface">
        <header className="gamecrafter-board-header">
          <h1>Discussion Board</h1>
          <label>
            Project
            <select
              aria-label="Board Project"
              value={this.projectId ?? ''}
              onChange={(event) => {
                this.markProjectSelection();
                this.projectId = event.currentTarget.value || undefined;
                this.threadDetail = undefined;
                void this.refresh();
              }}
            >
              <option value="">Select a Project</option>
              {this.projects.map((project) => (
                <option key={project.projectId} value={project.projectId}>
                  {project.name}
                </option>
              ))}
            </select>
          </label>
          <button type="button" onClick={() => void this.refresh()} disabled={this.busy}>
            Refresh
          </button>
        </header>

        {this.errorMessage && (
          <p className="gamecrafter-board-error" role="alert">
            {this.errorMessage}
          </p>
        )}
        {this.resultMessage && (
          <p className="gamecrafter-board-result" role="status">
            {this.resultMessage}
          </p>
        )}
        {!this.projectId ? (
          <p>Select a Project to open its discussion board.</p>
        ) : (
          <>
            <div className="gamecrafter-board-layout">
              <aside className="gamecrafter-board-sidebar">
                <section className="gamecrafter-board-section">
                  <h2>Threads</h2>
                  <div className="gamecrafter-board-filters">
                    <label>
                      Status
                      <select
                        aria-label="Board status filter"
                        value={this.statusFilter}
                        onChange={(event) => {
                          this.statusFilter = event.currentTarget.value as typeof this.statusFilter;
                          void this.refreshThreads();
                        }}
                      >
                        <option value="">All</option>
                        <option value="open">Open</option>
                        <option value="resolved">Resolved</option>
                        <option value="archived">Archived</option>
                      </select>
                    </label>
                    <label>
                      Kind
                      <select
                        aria-label="Board kind filter"
                        value={this.kindFilter}
                        onChange={(event) => {
                          this.kindFilter = event.currentTarget.value as typeof this.kindFilter;
                          void this.refreshThreads();
                        }}
                      >
                        <option value="">All</option>
                        {threadKinds.map((kind) => (
                          <option key={kind} value={kind}>
                            {kind}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label>
                      Tags
                      <input
                        aria-label="Board tags filter"
                        value={this.tagsFilter}
                        onChange={(event) => {
                          this.tagsFilter = event.currentTarget.value;
                          this.update();
                        }}
                      />
                    </label>
                    <label>
                      Search
                      <input
                        aria-label="Board search"
                        value={this.search}
                        onChange={(event) => {
                          this.search = event.currentTarget.value;
                          this.update();
                        }}
                        onKeyDown={(event) => {
                          if (event.key === 'Enter') void this.refreshThreads();
                        }}
                      />
                    </label>
                    <button type="button" onClick={() => void this.refreshThreads()}>
                      Apply filters
                    </button>
                  </div>
                  {this.threads.length === 0 ? (
                    <p>No matching threads.</p>
                  ) : (
                    <ul className="gamecrafter-board-thread-list">
                      {this.threads.map((thread) => (
                        <li key={thread.threadId}>
                          <button
                            type="button"
                            className={
                              thread.threadId === this.threadDetail?.thread.threadId
                                ? 'selected'
                                : ''
                            }
                            onClick={() => void this.loadThread(thread.threadId)}
                          >
                            <strong>{thread.title}</strong>
                            <span>
                              {thread.kind} · {thread.status} · {thread.messageCount} messages
                            </span>
                            {thread.tags.length > 0 && <small>{thread.tags.join(', ')}</small>}
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                </section>

                <section className="gamecrafter-board-section">
                  <h2>New thread</h2>
                  <form
                    className="gamecrafter-board-form"
                    onSubmit={(event) => {
                      event.preventDefault();
                      void this.createThread();
                    }}
                  >
                    <label>
                      Title
                      <input
                        aria-label="New thread title"
                        required
                        value={this.createTitle}
                        onChange={(event) => {
                          this.createTitle = event.currentTarget.value;
                          this.update();
                        }}
                      />
                    </label>
                    <label>
                      Kind
                      <select
                        aria-label="New thread kind"
                        value={this.createKind}
                        onChange={(event) => {
                          this.createKind = event.currentTarget.value as BoardThreadKind;
                          this.update();
                        }}
                      >
                        {threadKinds.map((kind) => (
                          <option key={kind} value={kind}>
                            {kind}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label>
                      Tags
                      <input
                        aria-label="New thread tags"
                        value={this.createTags}
                        onChange={(event) => {
                          this.createTags = event.currentTarget.value;
                          this.update();
                        }}
                      />
                    </label>
                    <label>
                      First message
                      <textarea
                        aria-label="New thread message"
                        required
                        value={this.createBody}
                        onChange={(event) => {
                          this.createBody = event.currentTarget.value;
                          this.update();
                        }}
                      />
                    </label>
                    <label>
                      Message type
                      <select
                        aria-label="New thread message type"
                        value={this.createType}
                        onChange={(event) => {
                          this.createType = event.currentTarget.value as BoardMessageTypeInput;
                          this.update();
                        }}
                      >
                        {messageTypes.map((type) => (
                          <option key={type} value={type}>
                            {type}
                          </option>
                        ))}
                      </select>
                    </label>
                    <button type="submit" disabled={this.busy}>
                      Create thread
                    </button>
                  </form>
                </section>
              </aside>

              <main className="gamecrafter-board-thread-pane">
                {!this.threadDetail ? (
                  <p>Select a thread to review its discussion and decisions.</p>
                ) : (
                  <>
                    <header className="gamecrafter-board-thread-header">
                      <div>
                        <h2>{activeThread?.title}</h2>
                        <span className={`gamecrafter-board-status is-${activeThread?.status}`}>
                          {activeThread?.kind} · {activeThread?.status}
                        </span>
                        <p>{activeThread?.tags.join(', ')}</p>
                      </div>
                      <div className="gamecrafter-board-actions">
                        {activeThread?.status === 'open' && (
                          <button type="button" onClick={() => void this.changeStatus('resolved')}>
                            Resolve
                          </button>
                        )}
                        {activeThread?.status !== 'archived' && (
                          <button type="button" onClick={() => void this.changeStatus('archived')}>
                            Archive
                          </button>
                        )}
                        {this.allowDeletion && (
                          <button type="button" onClick={() => void this.deleteThread()}>
                            Permanently delete
                          </button>
                        )}
                      </div>
                    </header>
                    <ol className="gamecrafter-board-messages">
                      {this.threadDetail.messages.map((message) => (
                        <li
                          key={message.messageId}
                          className={message.supersededBy ? 'superseded' : ''}
                        >
                          <header>
                            <span className="gamecrafter-board-message-type">{message.type}</span>
                            <span>#{message.seq}</span>
                            <span>{authorLabel(message)}</span>
                            <time>{new Date(message.createdAt).toLocaleString()}</time>
                          </header>
                          <div className="gamecrafter-board-message-body">{message.body}</div>
                          {message.supersededBy && (
                            <small>Superseded by {message.supersededBy}</small>
                          )}
                          {message.links.length > 0 && (
                            <ul className="gamecrafter-board-links">
                              {message.links.map((link, index) => (
                                <li key={`${link.kind}-${link.ref}-${index}`}>
                                  {link.kind}: {link.ref}
                                </li>
                              ))}
                            </ul>
                          )}
                          {message.editHistory.length > 0 && (
                            <details>
                              <summary>Edit history ({message.editHistory.length})</summary>
                              {message.editHistory.map((edit, index) => (
                                <p key={`${edit.editedAt}-${index}`}>
                                  <time>{new Date(edit.editedAt).toLocaleString()}</time> —{' '}
                                  {edit.previousBody}
                                </p>
                              ))}
                            </details>
                          )}
                          {(message.type === 'proposal' || message.type === 'decision') &&
                            !this.decisions.some(
                              (item) => item.decision.messageId === message.messageId,
                            ) && (
                              <button type="button" onClick={() => void this.bindDecision(message)}>
                                Mark as binding decision
                              </button>
                            )}
                        </li>
                      ))}
                    </ol>
                    <form
                      className="gamecrafter-board-composer"
                      onSubmit={(event) => {
                        event.preventDefault();
                        void this.postMessage();
                      }}
                    >
                      <h3>Post a message</h3>
                      <label>
                        Type
                        <select
                          aria-label="Board message type"
                          value={this.messageType}
                          onChange={(event) => {
                            this.messageType = event.currentTarget.value as BoardMessageTypeInput;
                            this.update();
                          }}
                        >
                          {messageTypes.map((type) => (
                            <option key={type} value={type}>
                              {type}
                            </option>
                          ))}
                        </select>
                      </label>
                      <label>
                        Markdown body
                        <textarea
                          aria-label="Board message body"
                          required
                          value={this.messageBody}
                          onChange={(event) => {
                            this.messageBody = event.currentTarget.value;
                            this.update();
                          }}
                        />
                      </label>
                      <label>
                        Links (JSON)
                        <input
                          aria-label="Board message links"
                          value={this.messageLinks}
                          onChange={(event) => {
                            this.messageLinks = event.currentTarget.value;
                            this.update();
                          }}
                        />
                      </label>
                      <button
                        type="submit"
                        disabled={this.busy || activeThread?.status === 'archived'}
                      >
                        Post message
                      </button>
                    </form>
                    {this.decisions.length > 0 && (
                      <section className="gamecrafter-board-decisions">
                        <h3>Binding decisions</h3>
                        {this.decisions.map(({ decision, proposals }) => (
                          <article key={decision.decisionId}>
                            <h4>{decision.title}</h4>
                            <p>{decision.statement}</p>
                            <span className={`gamecrafter-board-sync is-${decision.syncStatus}`}>
                              {decision.syncStatus}
                            </span>
                            {decision.lastSyncError && <p role="alert">{decision.lastSyncError}</p>}
                            {decision.canonRecordPath && <code>{decision.canonRecordPath}</code>}
                            {decision.syncStatus === 'failed' && (
                              <button
                                type="button"
                                onClick={() => void this.retrySync(decision.decisionId)}
                              >
                                Retry sync
                              </button>
                            )}
                            {proposals.map((proposal) => (
                              <details key={proposal.proposalId} open>
                                <summary>Diff: {proposal.path}</summary>
                                <pre>{proposal.diff}</pre>
                              </details>
                            ))}
                          </article>
                        ))}
                      </section>
                    )}
                  </>
                )}
              </main>
            </div>

            <section className="gamecrafter-board-maintenance">
              <h2>Maintenance</h2>
              <p>
                Last audit: {formatDate(this.maintenance?.lastAuditAt)} · Last cleanup:{' '}
                {formatDate(this.maintenance?.lastCleanupAt)}
                {' · '}Pending decisions: {this.maintenance?.pendingDecisions ?? 0}
                {this.maintenance?.runningTaskId
                  ? ` · Running task ${this.maintenance.runningTaskId}`
                  : ''}
              </p>
              <div>
                <button
                  type="button"
                  disabled={this.busy}
                  onClick={() => void this.runMaintenance('audit')}
                >
                  Run audit
                </button>
                <button
                  type="button"
                  disabled={this.busy}
                  onClick={() => void this.runMaintenance('cleanup')}
                >
                  Run cleanup
                </button>
                <button
                  type="button"
                  disabled={this.busy}
                  onClick={() => void this.runMaintenance('sync')}
                >
                  Run sync
                </button>
              </div>
            </section>
          </>
        )}
      </div>
    );
  }

  private async refresh(): Promise<void> {
    await this.perform(async () => {
      this.projects = await this.service.listProjects();
      this.projectId =
        (await this.resolveProjectSelection(this.projects, () => this.projectId)) || undefined;
      if (!this.projectId) {
        this.threads = [];
        this.threadDetail = undefined;
        this.update();
        return;
      }
      await this.refreshProjectState();
    });
  }

  private async refreshThreads(): Promise<void> {
    if (!this.projectId) return;
    await this.perform(async () => {
      const result = await this.service.listBoardThreads({
        projectId: this.projectId!,
        status: this.statusFilter || undefined,
        kind: this.kindFilter || undefined,
        tags: splitTags(this.tagsFilter),
        search: this.search.trim() || undefined,
      });
      this.threads = result.threads;
      if (
        this.threadDetail &&
        !this.threads.some((thread) => thread.threadId === this.threadDetail?.thread.threadId)
      ) {
        this.threadDetail = undefined;
        this.decisions = [];
      } else if (this.threadDetail) {
        await this.loadThread(this.threadDetail.thread.threadId, false);
      }
      await this.refreshMaintenance();
      this.update();
    });
  }

  private async refreshProjectState(): Promise<void> {
    if (!this.projectId) return;
    const settings = await this.service.getAllSettings(this.projectId);
    this.accessMode = String(
      settings.find((setting) => setting.key === 'access.mode')?.value ?? 'ask-always',
    );
    this.allowDeletion =
      settings.find((setting) => setting.key === 'board.allowPermanentDeletion')?.value === true;
    const result = await this.service.listBoardThreads({ projectId: this.projectId });
    this.threads = result.threads;
    this.maintenance = await this.service.getBoardMaintenanceStatus({ projectId: this.projectId });
    if (
      this.threadDetail &&
      this.threads.some((thread) => thread.threadId === this.threadDetail?.thread.threadId)
    ) {
      await this.loadThread(this.threadDetail.thread.threadId, false);
    } else if (this.threads[0]) {
      await this.loadThread(this.threads[0].threadId, false);
    } else {
      this.threadDetail = undefined;
      this.decisions = [];
    }
    this.update();
  }

  private async refreshMaintenance(): Promise<void> {
    if (this.projectId) {
      this.maintenance = await this.service.getBoardMaintenanceStatus({
        projectId: this.projectId,
      });
    }
  }

  private async loadThread(threadId: string, render = true): Promise<void> {
    if (!this.projectId) return;
    this.threadDetail = await this.service.getBoardThread({
      projectId: this.projectId,
      threadId,
      includeMessages: true,
      limit: 500,
    });
    const decisions = await this.service.listBoardDecisions({ projectId: this.projectId });
    this.decisions = await Promise.all(
      decisions.decisions
        .filter((decision) => decision.threadId === threadId)
        .map(async (decision) => ({
          decision,
          proposals: (
            await this.service.getBoardDecision({
              projectId: this.projectId!,
              decisionId: decision.decisionId,
            })
          ).proposals,
        })),
    );
    if (render) this.update();
  }

  private async createThread(): Promise<void> {
    if (!this.projectId) return;
    await this.perform(async () => {
      const result = await this.service.createBoardThread({
        projectId: this.projectId!,
        title: this.createTitle,
        kind: this.createKind,
        tags: splitTags(this.createTags),
        body: this.createBody,
        type: this.createType,
      });
      this.createTitle = '';
      this.createTags = '';
      this.createBody = '';
      this.resultMessage = 'Thread created.';
      await this.refreshProjectState();
      await this.loadThread(result.thread.threadId);
    });
  }

  private async postMessage(): Promise<void> {
    if (!this.projectId || !this.threadDetail) return;
    await this.perform(async () => {
      const links = parseLinks(this.messageLinks);
      await this.service.postBoardMessage({
        projectId: this.projectId!,
        threadId: this.threadDetail!.thread.threadId,
        type: this.messageType,
        body: this.messageBody,
        links,
        author: { kind: 'user' },
      });
      this.messageBody = '';
      this.messageLinks = '[]';
      this.resultMessage = 'Message posted.';
      await this.refreshProjectState();
    });
  }

  private async bindDecision(message: BoardMessage): Promise<void> {
    if (!this.projectId || !this.threadDetail) return;
    const choice = await this.quickInput.pick(
      [{ label: 'Bind decision and synchronize canon' }, { label: 'Cancel' }],
      {
        title: `Binding updates docs/decisions using ${this.accessMode} access; approval may be required.`,
      },
    );
    if (choice?.label !== 'Bind decision and synchronize canon') return;
    await this.perform(async () => {
      const decision = await this.service.bindBoardDecision({
        projectId: this.projectId!,
        messageId: message.messageId,
        title: this.threadDetail!.thread.title,
        statement: message.body,
        confirmedByUser: true,
      });
      this.resultMessage = `Decision bound: ${decision.title}`;
      await this.refreshProjectState();
    });
  }

  private async changeStatus(status: 'resolved' | 'archived'): Promise<void> {
    if (!this.projectId || !this.threadDetail) return;
    await this.perform(async () => {
      await this.service.setBoardThreadStatus({
        projectId: this.projectId!,
        threadId: this.threadDetail!.thread.threadId,
        status,
      });
      this.resultMessage = `Thread ${status}.`;
      await this.refreshProjectState();
    });
  }

  private async retrySync(decisionId: string): Promise<void> {
    if (!this.projectId) return;
    await this.perform(async () => {
      await this.service.retryBoardSync({ projectId: this.projectId!, decisionId });
      this.resultMessage = 'Decision synchronization queued.';
      await this.refreshProjectState();
    });
  }

  private async runMaintenance(mode: 'audit' | 'cleanup' | 'sync'): Promise<void> {
    if (!this.projectId) return;
    await this.perform(async () => {
      const result = await this.service.runBoardMaintenance({ projectId: this.projectId!, mode });
      this.resultMessage = `${mode} task ${result.taskId} queued.`;
      await this.refreshMaintenance();
    });
  }

  private async deleteThread(): Promise<void> {
    if (!this.projectId || !this.threadDetail) return;
    const choice = await this.quickInput.pick(
      [{ label: 'Delete thread permanently' }, { label: 'Cancel' }],
      { title: 'Permanently delete all discussion history for this thread?' },
    );
    if (choice?.label !== 'Delete thread permanently') return;
    await this.perform(async () => {
      await this.service.deleteBoardThread({
        projectId: this.projectId!,
        threadId: this.threadDetail!.thread.threadId,
      });
      this.threadDetail = undefined;
      this.resultMessage = 'Thread permanently deleted.';
      await this.refreshProjectState();
    });
  }

  private async perform(operation: () => Promise<void>): Promise<void> {
    this.busy = true;
    this.errorMessage = undefined;
    this.update();
    try {
      await operation();
    } catch (error) {
      this.errorMessage = errorMessage(error);
    } finally {
      this.busy = false;
      this.update();
    }
  }
}

function splitTags(value: string): string[] {
  return value
    .split(',')
    .map((tag) => tag.trim())
    .filter(Boolean);
}

function parseLinks(value: string): BoardLink[] {
  const parsed: unknown = JSON.parse(value);
  if (!Array.isArray(parsed)) throw new Error('Links must be a JSON array.');
  return parsed as BoardLink[];
}

function authorLabel(message: BoardMessage): string {
  return message.author.kind === 'agent'
    ? `${message.author.role}${message.author.taskId ? ` · ${message.author.taskId}` : ''}`
    : message.author.kind;
}

function formatDate(value: string | null | undefined): string {
  return value ? new Date(value).toLocaleString() : 'never';
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

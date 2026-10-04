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
  private createThreadExpanded = false;
  private maintenanceExpanded = false;
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
                  <nav className="gamecrafter-board-quick-views" aria-label="Quick thread views">
                    <button
                      type="button"
                      aria-pressed={
                        !this.statusFilter &&
                        !this.kindFilter &&
                        !this.tagsFilter.trim() &&
                        !this.search.trim()
                      }
                      onClick={() => void this.setQuickView('', '')}
                    >
                      All
                    </button>
                    <button
                      type="button"
                      aria-pressed={this.statusFilter === 'open' && !this.kindFilter}
                      onClick={() => void this.setQuickView('open', '')}
                    >
                      Open
                    </button>
                    <button
                      type="button"
                      aria-pressed={!this.statusFilter && this.kindFilter === 'question'}
                      onClick={() => void this.setQuickView('', 'question')}
                    >
                      Questions
                    </button>
                    <button
                      type="button"
                      aria-pressed={!this.statusFilter && this.kindFilter === 'blocker'}
                      onClick={() => void this.setQuickView('', 'blocker')}
                    >
                      Blockers
                    </button>
                    <button
                      type="button"
                      aria-pressed={!this.statusFilter && this.kindFilter === 'decision'}
                      onClick={() => void this.setQuickView('', 'decision')}
                    >
                      Decisions
                    </button>
                  </nav>
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
                    <button type="button" onClick={() => void this.clearFilters()}>
                      Clear filters
                    </button>
                  </div>
                  <p className="gamecrafter-board-thread-count" aria-live="polite">
                    Showing {this.threads.length} thread{this.threads.length === 1 ? '' : 's'}
                  </p>
                  {this.threads.length === 0 ? (
                    <p>
                      No matching threads. Clear filters or switch to a quick view to broaden the
                      list.
                    </p>
                  ) : (
                    <ul className="gamecrafter-board-thread-list">
                      {this.threads.map((thread) => (
                        <li key={thread.threadId} className="gamecrafter-board-thread-item">
                          <button
                            type="button"
                            className={`gamecrafter-board-thread-select${
                              thread.threadId === this.threadDetail?.thread.threadId
                                ? ' selected'
                                : ''
                            }`}
                            aria-current={
                              thread.threadId === this.threadDetail?.thread.threadId
                                ? 'true'
                                : undefined
                            }
                            onClick={() => void this.loadThread(thread.threadId)}
                          >
                            <strong>{thread.title}</strong>
                            <span className="gamecrafter-board-thread-meta">
                              <span className={`gamecrafter-board-thread-kind is-${thread.kind}`}>
                                {thread.kind}
                              </span>
                              <span
                                className={`gamecrafter-board-thread-status is-${thread.status}`}
                              >
                                {thread.status}
                              </span>
                              <span>{thread.messageCount} messages</span>
                            </span>
                            {thread.tags.length > 0 && (
                              <small className="gamecrafter-board-thread-tags">
                                {thread.tags.join(', ')}
                              </small>
                            )}
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                </section>

                <section className="gamecrafter-board-section">
                  <details
                    className="gamecrafter-board-collapsible"
                    open={this.createThreadExpanded}
                    onToggle={(event) => {
                      this.createThreadExpanded = event.currentTarget.open;
                    }}
                  >
                    <summary>New thread</summary>
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
                  </details>
                </section>
              </aside>

              <main className="gamecrafter-board-thread-pane">
                {!this.threadDetail ? (
                  <div className="gamecrafter-board-next-action" role="status">
                    <p>Select a thread to review its discussion and any binding decisions.</p>
                    <p>
                      Start with Open for active work, Questions for unanswered requests, or
                      Blockers for issues preventing progress.
                    </p>
                  </div>
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
                    <p className="gamecrafter-board-next-action" role="status">
                      {nextActionGuidance(activeThread!)}
                    </p>
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

            <details
              className="gamecrafter-board-maintenance gamecrafter-board-collapsible"
              open={this.maintenanceExpanded}
              onToggle={(event) => {
                this.maintenanceExpanded = event.currentTarget.open;
              }}
            >
              <summary>
                Maintenance · {this.maintenance?.pendingDecisions ?? 0} pending decisions
              </summary>
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
            </details>
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
      const result = await this.service.listBoardThreads(this.boardThreadQuery());
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

  private async setQuickView(
    status: '' | BoardThreadStatus,
    kind: '' | BoardThreadKind,
  ): Promise<void> {
    this.statusFilter = status;
    this.kindFilter = kind;
    await this.refreshThreads();
  }

  private async clearFilters(): Promise<void> {
    this.statusFilter = '';
    this.kindFilter = '';
    this.tagsFilter = '';
    this.search = '';
    await this.refreshThreads();
  }

  private boardThreadQuery(): {
    projectId: string;
    status?: BoardThreadStatus;
    kind?: BoardThreadKind;
    tags: string[];
    search?: string;
  } {
    return {
      projectId: this.projectId!,
      status: this.statusFilter || undefined,
      kind: this.kindFilter || undefined,
      tags: splitTags(this.tagsFilter),
      search: this.search.trim() || undefined,
    };
  }

  public async revealThread(selection: { projectId: string; threadId: string }): Promise<void> {
    await this.perform(async () => {
      this.projects = await this.service.listProjects();
      if (!this.projects.some((project) => project.projectId === selection.projectId)) {
        throw new Error('The request thread belongs to a Project that is not available.');
      }
      this.markProjectSelection();
      this.projectId = selection.projectId;
      this.threadDetail = undefined;
      this.decisions = [];
      this.statusFilter = '';
      this.kindFilter = '';
      this.tagsFilter = '';
      this.search = '';
      await this.refreshProjectState(selection.threadId);
      if (!this.threads.some((thread) => thread.threadId === selection.threadId)) {
        throw new Error('The request thread was not found in this Project.');
      }
      this.update();
    });
  }

  private async refreshProjectState(preferredThreadId?: string): Promise<void> {
    if (!this.projectId) return;
    const settings = await this.service.getAllSettings(this.projectId);
    this.accessMode = String(
      settings.find((setting) => setting.key === 'access.mode')?.value ?? 'ask-always',
    );
    this.allowDeletion =
      settings.find((setting) => setting.key === 'board.allowPermanentDeletion')?.value === true;
    const result = await this.service.listBoardThreads(this.boardThreadQuery());
    this.threads = result.threads;
    this.maintenance = await this.service.getBoardMaintenanceStatus({ projectId: this.projectId });
    if (preferredThreadId && this.threads.some((thread) => thread.threadId === preferredThreadId)) {
      await this.loadThread(preferredThreadId, false);
    } else if (
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
      this.createThreadExpanded = false;
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

function nextActionGuidance(thread: BoardThread): string {
  if (thread.status === 'archived') return 'This thread is archived and read-only.';
  if (thread.status === 'resolved') {
    return 'This thread is resolved. Archive it when its history no longer needs active attention.';
  }
  switch (thread.kind) {
    case 'question':
      return 'Next: answer the question in a reply, then resolve the thread when no follow-up remains.';
    case 'blocker':
      return 'Next: document what is blocking progress and the needed owner or action; resolve it once cleared.';
    case 'proposal':
      return 'Next: review the proposal and its evidence. If accepted, mark the relevant message as a binding decision.';
    case 'decision':
      return 'Next: review the decision record and sync status below; resolve the thread when its follow-up is complete.';
    default:
      return 'Next: add a finding, question, or decision as the discussion develops; resolve the thread when follow-up is complete.';
  }
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

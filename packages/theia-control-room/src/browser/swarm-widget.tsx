import React from 'react';
import { CommandService } from '@theia/core/lib/common/command';
import { Message } from '@theia/core/lib/browser/widgets/widget';
import { ControlRoomReactWidget } from './control-room-react-widget';
import { inject, injectable } from '@theia/core/shared/inversify';
import type {
  ApprovalRequest,
  ChangeRequest,
  ImpactResult,
  IntegrationRecord,
  ProjectSummary,
  ResourceLock,
  TaskQuestion,
  TaskRecord,
} from '@gamecrafter/contracts';
import {
  ControlRoomService,
  type ControlRoomService as ControlRoomServiceApi,
} from '../common/control-room-protocol';
import { buildTaskTree, parseImpactSeeds, type SwarmTaskNode } from '../common/swarm-view-model';
import { ControlRoomClientEvents } from './control-room-client';
import { DISCUSSION_BOARD_OPEN_COMMAND_ID } from './discussion-board-view-contribution';

@injectable()
export class SwarmWidget extends ControlRoomReactWidget {
  static readonly ID = 'gamecrafter.swarm';

  private projects: ProjectSummary[] = [];
  private projectId?: string;
  private requests: ChangeRequest[] = [];
  private requestId = '';
  private requestText = '';
  private role = 'coordinator';
  private budgetTokens = '';
  private impactPreview?: ImpactResult;
  private taskTree?: SwarmTaskNode;
  private questions: TaskQuestion[] = [];
  private locks: ResourceLock[] = [];
  private integrations: IntegrationRecord[] = [];
  private approvals: ApprovalRequest[] = [];
  private readonly drafts = new Map<string, string>();
  private errorMessage?: string;
  private notice?: string;
  private busy = false;
  private refreshPending = false;
  private highlightedTaskId?: string;

  constructor(
    @inject(ControlRoomService) private readonly service: ControlRoomServiceApi,
    @inject(ControlRoomClientEvents) private readonly clientEvents: ControlRoomClientEvents,
    @inject(CommandService) private readonly commands: CommandService,
  ) {
    super();
    this.id = SwarmWidget.ID;
    this.title.label = 'Swarm';
    this.title.iconClass = 'codicon codicon-hubot';
    this.title.closable = true;
    this.toDispose.push(this.clientEvents.projectChanged(() => void this.refreshProjects()));
    this.toDispose.push(
      this.clientEvents.taskChanged((event) => {
        if (event.projectId === this.projectId) void this.refresh();
      }),
    );
    this.toDispose.push(
      this.clientEvents.taskQuestion((event) => {
        if (event.projectId === this.projectId) void this.refresh();
      }),
    );
    this.toDispose.push(
      this.clientEvents.changeLockChanged((event) => {
        if (event.projectId === this.projectId) void this.refresh();
      }),
    );
    this.toDispose.push(
      this.clientEvents.changeIntegrationChanged((event) => {
        if (event.projectId === this.projectId) void this.refresh();
      }),
    );
    this.toDispose.push(
      this.clientEvents.changeRequestChanged((event) => {
        if (event.projectId === this.projectId) void this.refresh();
      }),
    );
    this.toDispose.push(
      this.clientEvents.approvalRequested((event) => {
        if (event.projectId === this.projectId) void this.refresh();
      }),
    );
    this.toDispose.push(
      this.clientEvents.approvalResolved((event) => {
        if (event.projectId === this.projectId) void this.refresh();
      }),
    );
    void this.refreshProjects();
  }

  protected onActivateRequest(message: Message): void {
    super.onActivateRequest(message);
    void this.refreshProjects();
  }

  async revealRequest(selection: { projectId: string; requestId?: string }): Promise<void> {
    this.projectId = selection.projectId;
    this.requestId = selection.requestId ?? '';
    this.requests = [];
    this.taskTree = undefined;
    this.questions = [];
    this.approvals = [];
    await this.refreshProjects();
  }

  protected render(): React.ReactNode {
    const currentRequest = this.requests.find((request) => request.requestId === this.requestId);
    return (
      <main className="gamecrafter-swarm gamecrafter-surface">
        <header className="gamecrafter-swarm-header">
          <div>
            <h1>Swarm</h1>
            <p>Coordinate bounded agent work, review locks, and integrate changes.</p>
          </div>
          <label>
            Project
            <select
              aria-label="Swarm Project"
              value={this.projectId ?? ''}
              onChange={(event) => {
                this.markProjectSelection();
                this.projectId = event.currentTarget.value || undefined;
                this.requests = [];
                this.requestId = '';
                this.taskTree = undefined;
                this.approvals = [];
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
          <p className="gamecrafter-swarm-error" role="alert">
            {this.errorMessage}
          </p>
        )}
        {this.notice && (
          <p className="gamecrafter-swarm-notice" role="status">
            {this.notice}
          </p>
        )}
        {!this.projectId ? (
          <p>Select a Project to coordinate work.</p>
        ) : (
          <>
            <section className="gamecrafter-swarm-panel">
              <h2>New request</h2>
              <label>
                Request
                <textarea
                  aria-label="Change request"
                  rows={3}
                  value={this.requestText}
                  onChange={(event) => {
                    this.requestText = event.currentTarget.value;
                    this.update();
                  }}
                  placeholder="Describe the change and relevant canon IDs or Project files."
                />
              </label>
              <div className="gamecrafter-swarm-form-row">
                <label>
                  Role
                  <input
                    aria-label="Coordinator role"
                    value={this.role}
                    onChange={(event) => {
                      this.role = event.currentTarget.value;
                      this.update();
                    }}
                  />
                </label>
                <label>
                  Total token budget (optional)
                  <input
                    aria-label="Token budget"
                    placeholder="No cumulative token ceiling"
                    type="number"
                    min={1}
                    value={this.budgetTokens}
                    onChange={(event) => {
                      this.budgetTokens = event.currentTarget.value;
                      this.update();
                    }}
                  />
                </label>
                <button
                  type="button"
                  onClick={() => void this.previewImpact()}
                  disabled={this.busy}
                >
                  Preview impact
                </button>
                <button
                  type="button"
                  onClick={() => void this.submitRequest()}
                  disabled={this.busy}
                >
                  Submit request
                </button>
              </div>
              {this.impactPreview && (
                <div className="gamecrafter-swarm-impact" aria-label="Impact preview">
                  <strong>Impact preview</strong>
                  {this.impactPreview.nodes.length === 0 ? (
                    <p>No related graph nodes found.</p>
                  ) : (
                    <ul>
                      {this.impactPreview.nodes.slice(0, 12).map((entry) => (
                        <li key={entry.node.nodeId}>
                          {entry.node.title} · confidence {entry.pathConfidence.toFixed(2)}
                          {entry.needsValidation ? ' · validate' : ''}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              )}
            </section>

            <section className="gamecrafter-swarm-panel">
              <h2>Task tree</h2>
              <div className="gamecrafter-swarm-form-row">
                <label>
                  Change request
                  <select
                    aria-label="Select change request"
                    value={this.requestId}
                    onChange={(event) => {
                      this.requestId = event.currentTarget.value;
                      void this.refresh();
                    }}
                  >
                    <option value="">Select a request</option>
                    {this.requests.map((request) => (
                      <option key={request.requestId} value={request.requestId}>
                        {request.text}
                      </option>
                    ))}
                  </select>
                </label>
                {currentRequest && (
                  <button
                    type="button"
                    onClick={() =>
                      void this.commands.executeCommand(DISCUSSION_BOARD_OPEN_COMMAND_ID)
                    }
                  >
                    Open request thread
                  </button>
                )}
              </div>
              {this.taskTree ? (
                <ul className="gamecrafter-swarm-task-tree">
                  {this.renderTaskNode(this.taskTree)}
                </ul>
              ) : (
                <p>Select or submit a change request to inspect its tasks.</p>
              )}
            </section>

            <section className="gamecrafter-swarm-panel" aria-label="Pending approvals">
              <h2>Approvals</h2>
              {this.approvals.length === 0 ? (
                <p>No pending approvals.</p>
              ) : (
                <ul>
                  {this.approvals.map((approval) => (
                    <li key={approval.approvalId}>
                      <p>
                        {approval.summary} · {approval.toolId} · {approval.sideEffects}
                      </p>
                      <button
                        type="button"
                        disabled={this.busy}
                        onClick={() => void this.resolveApproval(approval, true)}
                      >
                        Approve
                      </button>
                      <button
                        type="button"
                        disabled={this.busy}
                        onClick={() => void this.resolveApproval(approval, false)}
                      >
                        Reject
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            <section className="gamecrafter-swarm-panel">
              <h2>Resource locks</h2>
              {this.locks.length === 0 ? (
                <p>No active resource locks.</p>
              ) : (
                <table>
                  <thead>
                    <tr>
                      <th>Resource</th>
                      <th>Mode</th>
                      <th>Task</th>
                      <th>Expires</th>
                      <th />
                    </tr>
                  </thead>
                  <tbody>
                    {this.locks.map((lock) => (
                      <tr key={lock.lockId}>
                        <td>{lock.resource}</td>
                        <td>{lock.mode}</td>
                        <td>{lock.taskId}</td>
                        <td>{new Date(lock.expiresAt).toLocaleTimeString()}</td>
                        <td>
                          <button
                            type="button"
                            onClick={() => void this.releaseLock(lock)}
                            disabled={this.busy}
                          >
                            Release
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </section>

            <section className="gamecrafter-swarm-panel">
              <h2>Integrations</h2>
              {this.integrations.length === 0 ? (
                <p>No task integrations yet.</p>
              ) : (
                <table>
                  <thead>
                    <tr>
                      <th>Task</th>
                      <th>Status</th>
                      <th>Files</th>
                      <th>Conflicts / validation</th>
                      <th />
                    </tr>
                  </thead>
                  <tbody>
                    {this.integrations.map((integration) => (
                      <tr key={integration.integrationId}>
                        <td>
                          {findTaskNode(this.taskTree, integration.taskId)?.task.title ??
                            integration.taskId}
                        </td>
                        <td>{integration.status}</td>
                        <td>{integration.changedFiles.join(', ') || '—'}</td>
                        <td>
                          {[
                            ...integration.conflicts.map((entry) => `${entry.kind}: ${entry.file}`),
                            ...integration.validation.map(
                              (entry) => `${entry.ok ? 'OK' : 'Failed'}: ${entry.detail}`,
                            ),
                          ].join('; ') || '—'}
                          {integration.reconcileTaskId && (
                            <button
                              type="button"
                              onClick={() => {
                                this.highlightedTaskId = integration.reconcileTaskId ?? undefined;
                                this.update();
                              }}
                            >
                              Reconcile task {integration.reconcileTaskId}
                            </button>
                          )}
                        </td>
                        <td>
                          {integration.status === 'ready' && (
                            <button
                              type="button"
                              onClick={() => void this.integrate(integration)}
                              disabled={this.busy}
                            >
                              Integrate
                            </button>
                          )}
                          {!['integrated', 'rejected', 'aborted'].includes(integration.status) && (
                            <button
                              type="button"
                              onClick={() => void this.abortIntegration(integration)}
                              disabled={this.busy}
                            >
                              Abort
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </section>
          </>
        )}
      </main>
    );
  }

  private renderTaskNode(node: SwarmTaskNode): React.ReactNode {
    const task = node.task;
    const highlighted = this.highlightedTaskId === task.taskId;
    return (
      <li key={task.taskId} className={highlighted ? 'gamecrafter-swarm-highlight' : undefined}>
        <article className="gamecrafter-swarm-task">
          <header>
            <strong>{task.title}</strong>
            <span>{task.state}</span>
            {node.role && <span>role: {node.role}</span>}
          </header>
          <p>{task.goal}</p>
          <div className="gamecrafter-swarm-form-row">
            <span>
              Spent: ${task.spent.costUsd.toFixed(4)} · {task.spent.tokens} tokens
            </span>
            <label>
              Progress
              {node.progress !== null && <progress value={node.progress} max={100} />}
              {node.progress === null ? task.state.replaceAll('_', ' ') : `${node.progress}%`}
            </label>
            {!['succeeded', 'failed', 'blocked', 'cancelled'].includes(task.state) && (
              <button type="button" onClick={() => void this.cancelTask(task)} disabled={this.busy}>
                Cancel
              </button>
            )}
          </div>
          {task.error && (
            <p className="gamecrafter-swarm-error" role="alert">
              {task.error.message}
            </p>
          )}
          {task.result && (
            <div className="gamecrafter-swarm-result">
              <p>{task.result.summary}</p>
              {task.result.artifacts.length > 0 && (
                <ul>
                  {task.result.artifacts.map((artifact, index) => (
                    <li key={index}>{artifact.path}</li>
                  ))}
                </ul>
              )}
            </div>
          )}
          {node.pendingQuestions.map((question) => this.renderQuestion(task, question))}
          {task.state === 'succeeded' && task.result?.reviewStatus !== 'accepted' && (
            <div className="gamecrafter-swarm-feedback">
              <label>
                Feedback note
                <input
                  aria-label={`Feedback note for ${task.title}`}
                  value={this.drafts.get(task.taskId) ?? ''}
                  onChange={(event) => {
                    this.drafts.set(task.taskId, event.currentTarget.value);
                    this.update();
                  }}
                />
              </label>
              {(['accept', 'revise', 'reject'] as const).map((decision) => (
                <button
                  key={decision}
                  type="button"
                  onClick={() => void this.sendFeedback(task, decision)}
                  disabled={
                    this.busy || (decision !== 'accept' && !this.drafts.get(task.taskId)?.trim())
                  }
                >
                  {decision[0]!.toUpperCase() + decision.slice(1)}
                </button>
              ))}
              {task.result?.reviewStatus && <span>Review: {task.result.reviewStatus}</span>}
            </div>
          )}
          {node.children.length > 0 && (
            <ul>{node.children.map((child) => this.renderTaskNode(child))}</ul>
          )}
        </article>
      </li>
    );
  }

  private renderQuestion(task: TaskRecord, question: TaskQuestion): React.ReactNode {
    const value = this.drafts.get(question.questionId) ?? '';
    return (
      <div className="gamecrafter-swarm-question" key={question.questionId}>
        <p>{question.prompt}</p>
        <label>
          Answer
          <input
            aria-label={`Answer for ${question.prompt}`}
            value={value}
            onChange={(event) => {
              this.drafts.set(question.questionId, event.currentTarget.value);
              this.update();
            }}
          />
        </label>
        <button
          type="button"
          onClick={() => void this.answerQuestion(task, question)}
          disabled={this.busy || !value.trim()}
        >
          Answer
        </button>
      </div>
    );
  }

  private async refreshProjects(): Promise<void> {
    try {
      this.projects = await this.service.listProjects();
      const projectId =
        (await this.resolveProjectSelection(this.projects, () => this.projectId)) || undefined;
      if (projectId !== this.projectId) {
        this.requestId = '';
        this.requests = [];
        this.taskTree = undefined;
        this.questions = [];
        this.locks = [];
        this.integrations = [];
        this.approvals = [];
        this.impactPreview = undefined;
        this.drafts.clear();
      }
      this.projectId = projectId;
      await this.refresh();
    } catch (error) {
      this.errorMessage = error instanceof Error ? error.message : String(error);
      this.update();
    }
  }

  private async refresh(): Promise<void> {
    if (this.busy) {
      this.refreshPending = true;
      return;
    }
    this.busy = true;
    this.refreshPending = false;
    const projectId = this.projectId;
    try {
      if (!projectId) return;
      const [requestResult, lockResult, integrationResult, questionResult, approvalResult] =
        await Promise.allSettled([
          this.service.listChangeRequests({ projectId, limit: 100 }),
          this.service.listResourceLocks(projectId),
          this.service.listIntegrations({ projectId }),
          this.service.listTaskQuestions(true),
          this.service.listApprovals(projectId, true),
        ]);
      if (projectId !== this.projectId) return;
      const failures = [
        requestResult,
        lockResult,
        integrationResult,
        questionResult,
        approvalResult,
      ]
        .filter((result): result is PromiseRejectedResult => result.status === 'rejected')
        .map((result) =>
          result.reason instanceof Error ? result.reason.message : String(result.reason),
        );
      const requests = requestResult.status === 'fulfilled' ? requestResult.value : this.requests;
      const locks = lockResult.status === 'fulfilled' ? lockResult.value : [];
      const integrations = integrationResult.status === 'fulfilled' ? integrationResult.value : [];
      const allQuestions = questionResult.status === 'fulfilled' ? questionResult.value : [];
      const approvals = approvalResult.status === 'fulfilled' ? approvalResult.value : [];
      this.requests = requests;
      this.locks = locks;
      this.integrations = integrations;
      this.approvals = approvals;
      if (!requests.some((request) => request.requestId === this.requestId)) {
        this.requestId = requests[0]?.requestId ?? '';
      }
      const selected = requests.find((request) => request.requestId === this.requestId);
      if (selected) {
        const tasks = await this.service.getTaskTree(projectId, selected.rootTaskId);
        const taskIds = new Set(tasks.map((task) => task.taskId));
        this.questions = allQuestions.filter((question) => taskIds.has(question.taskId));
        const eventResults = await Promise.all(
          tasks.map((task) =>
            this.service.listTaskEvents({
              projectId,
              taskId: task.taskId,
              limit: 100,
            }),
          ),
        );
        if (projectId !== this.projectId || selected.requestId !== this.requestId) return;
        this.taskTree = buildTaskTree(
          tasks,
          selected.rootTaskId,
          eventResults.flatMap((result) => result.events),
          this.questions,
        );
      } else {
        this.taskTree = undefined;
        this.questions = [];
      }
      this.errorMessage = failures.length ? failures.join('; ') : undefined;
    } catch (error) {
      this.errorMessage = error instanceof Error ? error.message : String(error);
    } finally {
      this.busy = false;
      this.update();
      if (this.refreshPending) void this.refresh();
    }
  }

  private async previewImpact(): Promise<void> {
    if (!this.projectId || !this.requestText.trim()) return;
    await this.run(async () => {
      const seeds = parseImpactSeeds(this.requestText);
      this.impactPreview =
        seeds.length === 0
          ? undefined
          : await this.service.getChangeImpact({ projectId: this.projectId!, seeds });
      this.notice =
        seeds.length === 0 ? 'No canon IDs or Project paths found to preview.' : undefined;
    });
  }

  private async submitRequest(): Promise<void> {
    if (!this.projectId || !this.requestText.trim()) return;
    await this.run(async () => {
      const request = await this.service.requestChange({
        projectId: this.projectId!,
        text: this.requestText.trim(),
        role: this.role.trim() || 'coordinator',
        budget:
          this.budgetTokens.trim() && Number(this.budgetTokens) > 0
            ? { maxTokens: Number(this.budgetTokens) }
            : {},
      });
      this.requestId = request.requestId;
      this.notice = `Request created. Thread ${request.threadId}.`;
      await this.refreshAfterAction();
    });
  }

  private async releaseLock(lock: ResourceLock): Promise<void> {
    await this.run(async () => {
      await this.service.releaseResourceLock(lock.projectId, lock.lockId);
      await this.refreshAfterAction();
    });
  }

  private async resolveApproval(approval: ApprovalRequest, approve: boolean): Promise<void> {
    await this.run(async () => {
      await this.service.approve(
        approval.projectId,
        approval.approvalId,
        approve,
        `Selected ${approve ? 'Approve' : 'Reject'} in Swarm`,
      );
      await this.refreshAfterAction();
    });
  }

  private async integrate(integration: IntegrationRecord): Promise<void> {
    await this.run(async () => {
      await this.service.integrateTask(integration.projectId, integration.taskId);
      await this.refreshAfterAction();
    });
  }

  private async abortIntegration(integration: IntegrationRecord): Promise<void> {
    await this.run(async () => {
      await this.service.abortIntegration(integration.projectId, integration.integrationId);
      await this.refreshAfterAction();
    });
  }

  private async answerQuestion(task: TaskRecord, question: TaskQuestion): Promise<void> {
    const answer = this.drafts.get(question.questionId)?.trim();
    if (!this.projectId || !answer) return;
    await this.run(async () => {
      await this.service.answerQuestion(this.projectId!, task.taskId, question.questionId, answer);
      this.drafts.delete(question.questionId);
      await this.refreshAfterAction();
    });
  }

  private async cancelTask(task: TaskRecord): Promise<void> {
    if (!this.projectId) return;
    await this.run(async () => {
      await this.service.cancelTask(this.projectId!, task.taskId, 'Cancelled from Swarm view');
      await this.refreshAfterAction();
    });
  }

  private async sendFeedback(
    task: TaskRecord,
    decision: 'accept' | 'revise' | 'reject',
  ): Promise<void> {
    if (!this.projectId) return;
    await this.run(async () => {
      const result = await this.service.submitFeedback({
        projectId: this.projectId!,
        target: { kind: 'task', ref: task.taskId },
        decision,
        note: this.drafts.get(task.taskId) ?? '',
      });
      this.notice = `${decision} recorded. ${result.reopenedTaskIds.length} attempt(s), ${result.revalidateTaskIds.length} revalidation task(s).`;
      this.drafts.delete(task.taskId);
      await this.refreshAfterAction();
    });
  }

  private async run(action: () => Promise<void>): Promise<void> {
    if (this.busy) return;
    this.busy = true;
    this.errorMessage = undefined;
    this.notice = undefined;
    this.update();
    try {
      await action();
    } catch (error) {
      this.errorMessage = error instanceof Error ? error.message : String(error);
    } finally {
      this.busy = false;
      this.update();
      if (this.refreshPending) void this.refresh();
    }
  }

  private async refreshAfterAction(): Promise<void> {
    this.busy = false;
    await this.refresh();
    this.busy = true;
  }
}

function findTaskNode(node: SwarmTaskNode | undefined, taskId: string): SwarmTaskNode | undefined {
  if (!node) return undefined;
  if (node.task.taskId === taskId) return node;
  for (const child of node.children) {
    const found = findTaskNode(child, taskId);
    if (found) return found;
  }
  return undefined;
}

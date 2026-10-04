import React from 'react';
import { inject, injectable } from '@theia/core/shared/inversify';
import { Message } from '@theia/core/lib/browser/widgets/widget';
import { ControlRoomReactWidget } from './control-room-react-widget';
import type { ProjectSummary, RpcResult } from '@gamecrafter/contracts';
import {
  ControlRoomService,
  type ControlRoomService as ServiceApi,
} from '../common/control-room-protocol';
import { ControlRoomClientEvents } from './control-room-client';
import { costStatusLabel, formatCostUsd } from '../common/cost-display';
import { MarkdownContent } from './markdown-content';

@injectable()
export class AuditWidget extends ControlRoomReactWidget {
  static readonly ID = 'gamecrafter.audit';
  private projects: ProjectSummary[] = [];
  private projectId = '';
  private snapshot?: RpcResult<'audit/read'>;
  private afterSeq = 0;
  private query = '';
  private error?: string;
  private busy = false;
  private version = 0;
  private activeSection: 'usage' | 'calls' | 'events' = 'usage';
  private selectedUsageId?: string;
  private selectedCallId?: string;
  private selectedEventId?: string;

  constructor(
    @inject(ControlRoomService) private readonly service: ServiceApi,
    @inject(ControlRoomClientEvents) events: ControlRoomClientEvents,
  ) {
    super();
    this.id = AuditWidget.ID;
    this.title.label = 'Audit & History';
    this.title.iconClass = 'codicon codicon-history';
    this.title.closable = true;
    this.toDispose.push(
      events.projectChanged(() => {
        void this.refresh();
      }),
    );
    this.toDispose.push(
      events.toolCalled((event) => {
        if (event.projectId === this.projectId) void this.refresh();
      }),
    );
    this.toDispose.push(
      events.taskChanged((event) => {
        if (event.projectId === this.projectId) void this.refresh();
      }),
    );
    void this.refresh();
  }
  protected onActivateRequest(message: Message): void {
    super.onActivateRequest(message);
    void this.refresh();
  }
  protected render(): React.ReactNode {
    const matches = (value: unknown) =>
      JSON.stringify(value).toLowerCase().includes(this.query.toLowerCase());
    const calls = this.snapshot?.calls.filter(matches) ?? [];
    const events = this.snapshot?.events.filter(matches) ?? [];
    const usage = this.snapshot?.modelUsage?.filter(matches) ?? [];
    const selectedUsage = usage.find((entry) => entry.usageId === this.selectedUsageId) ?? usage[0];
    const selectedCall = calls.find((entry) => entry.callId === this.selectedCallId) ?? calls[0];
    const selectedEvent =
      events.find((entry) => entry.eventId === this.selectedEventId) ?? events[0];
    const priced = usage.filter(
      (entry) => ['known', 'partial'].includes(entry.costStatus) && entry.costUsd !== null,
    );
    const modelCost = priced.reduce((total, entry) => total + (entry.costUsd ?? 0), 0);
    const fullyPriced = usage.filter((entry) => entry.costStatus === 'known').length;
    const unpriced = usage.length - fullyPriced;
    return (
      <div className="gamecrafter-audit gamecrafter-page gamecrafter-surface">
        <header className="gamecrafter-page-header">
          <h1>Audit &amp; History</h1>
          <p>Follow model usage, cost coverage, tool decisions, and the Project timeline.</p>
        </header>
        <div className="gamecrafter-audit-toolbar">
          <label>
            Project
            <select
              aria-label="Audit Project"
              value={this.projectId}
              onChange={(e) => {
                this.markProjectSelection();
                this.projectId = e.currentTarget.value;
                this.afterSeq = 0;
                this.snapshot = undefined;
                void this.refresh();
              }}
            >
              <option value="">Select a Project</option>
              {this.projects.map((p) => (
                <option value={p.projectId} key={p.projectId}>
                  {p.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            Filter records
            <input
              type="search"
              aria-label="Filter audit records"
              value={this.query}
              onChange={(e) => {
                this.query = e.currentTarget.value;
                this.update();
              }}
            />
          </label>
          <button type="button" disabled={this.busy} onClick={() => void this.refresh()}>
            Refresh history
          </button>
          <button
            type="button"
            disabled={!this.snapshot || this.busy}
            onClick={() => this.export()}
          >
            Export redacted page
          </button>
        </div>
        {this.error && (
          <p role="alert" className="gamecrafter-audit-error">
            {this.error}
          </p>
        )}
        {!this.projectId ? (
          <p className="gamecrafter-page-empty">
            Select a Project to inspect its recorded activity.
          </p>
        ) : (
          <>
            <section
              className="gamecrafter-work-guidance gamecrafter-page-guidance"
              aria-label="Audit next steps"
            >
              <div>
                <strong>What to do next</strong>
                <p>
                  {!this.snapshot
                    ? 'Load the Project history, then search records or move between event pages.'
                    : 'Select a model request, tool call or event to inspect its evidence. Exports contain the redacted page currently loaded.'}
                </p>
              </div>
            </section>
            <nav className="gamecrafter-section-nav" aria-label="Audit sections">
              {(
                [
                  ['usage', 'Model usage', usage.length],
                  ['calls', 'Tool calls', calls.length],
                  ['events', 'Project events', events.length],
                ] as const
              ).map(([section, label, count]) => (
                <button
                  key={section}
                  type="button"
                  aria-pressed={this.activeSection === section}
                  onClick={() => {
                    this.activeSection = section;
                    this.update();
                  }}
                >
                  {label} <span className="gamecrafter-count">{count}</span>
                </button>
              ))}
            </nav>
            <section className="gamecrafter-page-panel" hidden={this.activeSection !== 'usage'}>
              <h2>Model usage</h2>
              <p className="gamecrafter-page-section-intro">
                Recorded model requests are separate from tool charges. These figures cover the
                loaded, filtered page, not all-time Project spend.
              </p>
              <dl className="gamecrafter-audit-stats">
                <div>
                  <dt>Known model cost</dt>
                  <dd>{priced.length ? formatCostUsd(modelCost) : 'No priced usage'}</dd>
                  <small>
                    {unpriced ? 'Incomplete cost coverage' : 'Recorded estimates, not invoices'}
                  </small>
                </div>
                <div>
                  <dt>Known input / output tokens</dt>
                  <dd>
                    {usage
                      .reduce((sum, entry) => sum + (entry.inputTokens ?? 0), 0)
                      .toLocaleString()}{' '}
                    /{' '}
                    {usage
                      .reduce((sum, entry) => sum + (entry.outputTokens ?? 0), 0)
                      .toLocaleString()}
                  </dd>
                  <small>
                    {
                      usage.filter(
                        (entry) => entry.inputTokens === null || entry.outputTokens === null,
                      ).length
                    }{' '}
                    request(s) have incomplete token counts. Cache counts shown per request.
                  </small>
                </div>
                <div>
                  <dt>Fully priced requests</dt>
                  <dd>
                    {fullyPriced} / {usage.length}
                  </dd>
                  <small>{unpriced} partial, unknown or legacy</small>
                </div>
              </dl>
              {unpriced > 0 && (
                <p className="gamecrafter-audit-cost-warning" role="status">
                  Some usage counts or prices are incomplete or unverified. Configure model prices
                  in Models &amp; Routing; unavailable counts and historical costs are not invented
                  or silently treated as free.
                </p>
              )}
              {usage.length ? (
                <div className="gamecrafter-audit-layout">
                  <nav
                    className="gamecrafter-audit-record-list"
                    aria-label="Recorded model requests"
                  >
                    {usage.map((entry) => (
                      <button
                        type="button"
                        key={entry.usageId}
                        aria-current={selectedUsage?.usageId === entry.usageId ? 'true' : undefined}
                        onClick={() => {
                          this.selectedUsageId = entry.usageId;
                          this.update();
                        }}
                      >
                        <strong>{entry.modelName ?? entry.providerModelId ?? entry.modelId}</strong>
                        <span>
                          {entry.source} / {entry.inputTokens?.toLocaleString() ?? 'Unknown'} in,{' '}
                          {entry.outputTokens?.toLocaleString() ?? 'Unknown'} out
                        </span>
                        <span className={`gamecrafter-audit-cost is-${entry.costStatus}`}>
                          {costStatusLabel(entry.costUsd, entry.costStatus)}
                        </span>
                        <time>{new Date(entry.occurredAt).toLocaleString()}</time>
                      </button>
                    ))}
                  </nav>
                  {selectedUsage && (
                    <article
                      className="gamecrafter-audit-inspector"
                      aria-label="Selected model request"
                    >
                      <h3>
                        {selectedUsage.modelName ??
                          selectedUsage.providerModelId ??
                          selectedUsage.modelId}
                      </h3>
                      <p className={`gamecrafter-audit-cost is-${selectedUsage.costStatus}`}>
                        {costStatusLabel(selectedUsage.costUsd, selectedUsage.costStatus)}
                      </p>
                      <dl className="gamecrafter-audit-fields">
                        <div>
                          <dt>Model identity</dt>
                          <dd>
                            <code>{selectedUsage.modelId}</code>
                          </dd>
                        </div>
                        <div>
                          <dt>Cost evidence</dt>
                          <dd>{selectedUsage.costStatus}</dd>
                        </div>
                        <div>
                          <dt>Source</dt>
                          <dd>{selectedUsage.source}</dd>
                        </div>
                        <div>
                          <dt>Request</dt>
                          <dd>
                            <code>{selectedUsage.requestId ?? 'Not recorded'}</code>
                          </dd>
                        </div>
                        <div>
                          <dt>Task</dt>
                          <dd>
                            <code>{selectedUsage.taskId ?? 'Not associated with a task'}</code>
                          </dd>
                        </div>
                        <div>
                          <dt>Input / output tokens</dt>
                          <dd>
                            {selectedUsage.inputTokens?.toLocaleString() ?? 'Unknown'} /{' '}
                            {selectedUsage.outputTokens?.toLocaleString() ?? 'Unknown'}
                          </dd>
                        </div>
                        <div>
                          <dt>Cache read / creation tokens</dt>
                          <dd>
                            {selectedUsage.cacheReadInputTokens?.toLocaleString() ?? 'Unknown'} /{' '}
                            {selectedUsage.cacheCreationInputTokens?.toLocaleString() ?? 'Unknown'}
                          </dd>
                        </div>
                        <div>
                          <dt>Recorded</dt>
                          <dd>{new Date(selectedUsage.occurredAt).toLocaleString()}</dd>
                        </div>
                      </dl>
                      <p className="gamecrafter-page-section-intro">
                        Known figures are recorded usage estimates. Partial, unavailable and
                        unverified amounts are not a complete billing total.
                      </p>
                      <details className="gamecrafter-page-advanced">
                        <summary>Raw usage record</summary>
                        <pre>{JSON.stringify(selectedUsage, null, 2)}</pre>
                      </details>
                    </article>
                  )}
                </div>
              ) : (
                <p className="gamecrafter-page-empty">
                  {!this.snapshot
                    ? 'Load a Project audit page to inspect model usage.'
                    : this.query
                      ? 'No model requests match this filter.'
                      : 'No model usage is recorded on this page. Tool activity alone is not model spending.'}
                </p>
              )}
            </section>
            <section className="gamecrafter-page-panel" hidden={this.activeSection !== 'calls'}>
              <h2>Recent tool calls</h2>
              <p>
                Up to {this.snapshot?.limit ?? 500} most recent calls. Select a record to inspect
                its evidence.
              </p>
              <dl className="gamecrafter-page-meta">
                <div className="gamecrafter-page-meta-item">
                  <dt>Matching calls</dt>
                  <dd>{calls.length}</dd>
                </div>
                <div className="gamecrafter-page-meta-item">
                  <dt>Project</dt>
                  <dd>
                    {this.projects.find((project) => project.projectId === this.projectId)?.name ??
                      this.projectId}
                  </dd>
                </div>
              </dl>
              {this.snapshot && calls.length ? (
                <div className="gamecrafter-audit-layout">
                  <nav className="gamecrafter-audit-record-list" aria-label="Recorded tool calls">
                    {calls.map((call) => (
                      <button
                        type="button"
                        key={call.callId}
                        aria-current={selectedCall?.callId === call.callId ? 'true' : undefined}
                        onClick={() => {
                          this.selectedCallId = call.callId;
                          this.update();
                        }}
                      >
                        <strong>{call.toolId}</strong>
                        <span>
                          {call.status} / {call.decision} / {call.accessMode}
                        </span>
                        <span>{costStatusLabel(call.costUsd, call.costStatus)}</span>
                        <time>{new Date(call.startedAt).toLocaleString()}</time>
                      </button>
                    ))}
                  </nav>
                  {selectedCall && (
                    <article
                      className="gamecrafter-audit-inspector"
                      aria-label="Selected tool call"
                    >
                      <h3>{selectedCall.toolId}</h3>
                      <dl className="gamecrafter-audit-fields">
                        <div>
                          <dt>Result</dt>
                          <dd>{selectedCall.status}</dd>
                        </div>
                        <div>
                          <dt>Access</dt>
                          <dd>
                            {selectedCall.accessMode} / {selectedCall.decision}
                          </dd>
                        </div>
                        <div>
                          <dt>Tool charge</dt>
                          <dd>{costStatusLabel(selectedCall.costUsd, selectedCall.costStatus)}</dd>
                        </div>
                        <div>
                          <dt>Started</dt>
                          <dd>{new Date(selectedCall.startedAt).toLocaleString()}</dd>
                        </div>
                      </dl>
                      <h4>Decision reason</h4>
                      <MarkdownContent text={selectedCall.decisionReason} />
                      <p className="gamecrafter-page-section-intro">
                        Tool charges are not model spend; a model request may also have a linked
                        tool record. Do not add both as independent charges.
                      </p>
                      <details className="gamecrafter-page-advanced">
                        <summary>Raw redacted call</summary>
                        <pre>{JSON.stringify(selectedCall, null, 2)}</pre>
                      </details>
                    </article>
                  )}
                </div>
              ) : (
                <p className="gamecrafter-page-empty">
                  {!this.snapshot && this.busy
                    ? 'Loading recorded tool calls…'
                    : !this.snapshot
                      ? 'No audit page is loaded. Refresh the Project history.'
                      : 'No matching tool calls. Change the filter or refresh the Project history.'}
                </p>
              )}
            </section>
            <section className="gamecrafter-page-panel" hidden={this.activeSection !== 'events'}>
              <h2>Project events</h2>
              <p>
                Events after sequence {this.afterSeq}. Export includes this event page and the
                recent calls above.
              </p>
              <dl className="gamecrafter-page-meta">
                <div className="gamecrafter-page-meta-item">
                  <dt>Events on page</dt>
                  <dd>{events.length}</dd>
                </div>
                <div className="gamecrafter-page-meta-item">
                  <dt>Next sequence</dt>
                  <dd>{this.snapshot?.nextAfterSeq ?? 'Not loaded'}</dd>
                </div>
              </dl>
              {events.length > 0 && (
                <div className="gamecrafter-audit-layout">
                  <nav
                    className="gamecrafter-audit-record-list"
                    aria-label="Project event timeline"
                  >
                    {events.map((event) => (
                      <button
                        type="button"
                        key={event.eventId}
                        aria-current={selectedEvent?.eventId === event.eventId ? 'true' : undefined}
                        onClick={() => {
                          this.selectedEventId = event.eventId;
                          this.update();
                        }}
                      >
                        <strong>{event.kind.replaceAll('_', ' ')}</strong>
                        <span>Sequence {event.seq}</span>
                        <time>{new Date(event.occurredAt).toLocaleString()}</time>
                      </button>
                    ))}
                  </nav>
                  {selectedEvent && (
                    <article
                      className="gamecrafter-audit-inspector"
                      aria-label="Selected Project event"
                    >
                      <h3>{selectedEvent.kind.replaceAll('_', ' ')}</h3>
                      <dl className="gamecrafter-audit-fields">
                        <div>
                          <dt>Sequence</dt>
                          <dd>{selectedEvent.seq}</dd>
                        </div>
                        <div>
                          <dt>Occurred</dt>
                          <dd>{new Date(selectedEvent.occurredAt).toLocaleString()}</dd>
                        </div>
                        <div>
                          <dt>Actor</dt>
                          <dd>{selectedEvent.actor}</dd>
                        </div>
                        <div>
                          <dt>Task</dt>
                          <dd>
                            <code>{selectedEvent.taskId ?? 'Project-wide event'}</code>
                          </dd>
                        </div>
                      </dl>
                      <h4>Recorded context</h4>
                      <div
                        className="gamecrafter-swarm-reading-body"
                        role="region"
                        tabIndex={0}
                        aria-label="Event context"
                      >
                        <MarkdownContent
                          text={
                            JSON.stringify(selectedEvent.payload, null, 2) ??
                            'No additional context recorded.'
                          }
                        />
                      </div>
                      <details className="gamecrafter-page-advanced">
                        <summary>Raw redacted event</summary>
                        <pre>{JSON.stringify(selectedEvent, null, 2)}</pre>
                      </details>
                    </article>
                  )}
                </div>
              )}
              {!this.snapshot && (
                <p className="gamecrafter-page-empty">
                  {this.busy
                    ? 'Loading Project events…'
                    : 'No audit page is loaded. Refresh the Project history.'}
                </p>
              )}
              {this.snapshot && !events.length && (
                <p className="gamecrafter-page-empty">
                  No matching events on this page. Change the filter or load another event page.
                </p>
              )}
              <button
                type="button"
                disabled={this.busy || !this.afterSeq}
                onClick={() => {
                  this.afterSeq = 0;
                  void this.refresh();
                }}
              >
                First event page
              </button>
              <button
                type="button"
                disabled={
                  this.busy || !this.snapshot || this.snapshot.events.length < this.snapshot.limit
                }
                onClick={() => {
                  this.afterSeq = this.snapshot!.nextAfterSeq;
                  void this.refresh();
                }}
              >
                Next event page
              </button>
            </section>
          </>
        )}
      </div>
    );
  }
  private async refresh(): Promise<void> {
    const version = ++this.version;
    this.busy = true;
    this.update();
    try {
      const projects = await this.service.listProjects();
      if (version !== this.version) return;
      this.projects = projects;
      const projectIdSelection = await this.resolveProjectSelection(projects, () => this.projectId);
      if (version !== this.version) return;
      if (projectIdSelection !== this.projectId) {
        this.projectId = projectIdSelection;
        this.afterSeq = 0;
      }
      const snapshot = this.projectId
        ? await this.service.readAudit(this.projectId, this.afterSeq)
        : undefined;
      if (version !== this.version) return;
      this.snapshot = snapshot;
      this.error = undefined;
    } catch (error) {
      if (version === this.version)
        this.error = error instanceof Error ? error.message : String(error);
    } finally {
      if (version === this.version) {
        this.busy = false;
        this.update();
      }
    }
  }
  private export(): void {
    if (!this.snapshot) return;
    const url = URL.createObjectURL(
      new Blob([JSON.stringify(this.snapshot, null, 2)], { type: 'application/json' }),
    );
    const link = document.createElement('a');
    link.href = url;
    link.download = 'gamecrafter-audit.json';
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 0);
  }
}

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
    return (
      <div className="gamecrafter-audit gamecrafter-surface">
        <header>
          <h1>Audit &amp; History</h1>
          <p>Inspect tool decisions, execution results, and the Project event history.</p>
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
          <p>Select a Project to inspect its recorded activity.</p>
        ) : (
          <>
            <section>
              <h2>Recent tool calls</h2>
              <p>
                Up to {this.snapshot?.limit ?? 500} most recent calls. Expand a record to inspect
                its evidence.
              </p>
              {calls.length ? (
                <table>
                  <thead>
                    <tr>
                      <th>Tool / started</th>
                      <th>Access decision</th>
                      <th>Result</th>
                      <th>Details</th>
                    </tr>
                  </thead>
                  <tbody>
                    {calls.map((call) => (
                      <tr key={call.callId}>
                        <td>
                          <strong>{call.toolId}</strong>
                          <br />
                          <time>{new Date(call.startedAt).toLocaleString()}</time>
                        </td>
                        <td>
                          {call.accessMode} · {call.decision}
                          <br />
                          {call.decisionReason}
                        </td>
                        <td>
                          {call.status}
                          <br />${call.costUsd.toFixed(4)}
                        </td>
                        <td>
                          <details>
                            <summary>Inspect call</summary>
                            <pre>{JSON.stringify(call, null, 2)}</pre>
                          </details>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <p>No matching tool calls.</p>
              )}
            </section>
            <section>
              <h2>Project events</h2>
              <p>
                Events after sequence {this.afterSeq}. Export includes this event page and the
                recent calls above.
              </p>
              {events.map((event) => (
                <details key={event.eventId}>
                  <summary>
                    #{event.seq} · {event.kind} · {new Date(event.occurredAt).toLocaleString()}
                  </summary>
                  <pre>{JSON.stringify(event, null, 2)}</pre>
                </details>
              ))}
              {!events.length && <p>No matching events on this page.</p>}
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

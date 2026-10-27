import React from 'react';
import { inject, injectable } from '@theia/core/shared/inversify';
import type { Message } from '@theia/core/lib/browser/widgets/widget';
import type { PendingInput } from '@gamecrafter/contracts';
import { ControlRoomReactWidget } from './control-room-react-widget';
import { RequestsModel, requestKey } from './requests-model';

@injectable()
export class RequestsWidget extends ControlRoomReactWidget {
  static readonly ID = 'gamecrafter.requests';
  private selected?: string;
  private projectId = '';
  private readonly drafts = new Map<string, string>();
  constructor(@inject(RequestsModel) private readonly model: RequestsModel) {
    super();
    this.id = RequestsWidget.ID;
    this.title.label = 'Requests';
    this.title.iconClass = 'codicon codicon-inbox';
    this.title.closable = true;
    this.selected = model.snapshot?.inputs[0] ? requestKey(model.snapshot.inputs[0]) : undefined;
    this.toDispose.push(
      model.changed(() => {
        if (this.selected === undefined) {
          const first = model.snapshot?.inputs.find(
            (item) => !this.projectId || item.projectId === this.projectId,
          );
          if (first) this.selected = requestKey(first);
        }
        const pending = new Set(model.snapshot?.inputs.map(requestKey));
        const unavailable = new Set(
          model.snapshot?.unavailableProjects.map((project) => project.projectId),
        );
        for (const key of this.drafts.keys())
          if (!pending.has(key) && !unavailable.has(key.split(':')[0]!)) this.drafts.delete(key);
        this.title.label = `Requests (${model.snapshot?.inputs.length ?? 0})`;
        this.update();
      }),
    );
  }
  protected onActivateRequest(message: Message): void {
    super.onActivateRequest(message);
    this.update();
    if (!this.node.contains(this.node.ownerDocument.activeElement)) {
      this.node.querySelector<HTMLSelectElement>('select[aria-label="Requests Project"]')?.focus();
    }
    void this.model.refresh();
  }
  override update(): void {
    if (this.isDisposed) return;
    const hadFocus = this.node.contains(this.node.ownerDocument.activeElement);
    super.update();
    const active = this.node.ownerDocument.activeElement;
    if (hadFocus && (!this.node.contains(active) || active?.matches(':disabled'))) {
      // A completed/disconnected request may remove or disable the focused control.
      // Restore navigation, never another request's response action or selection.
      this.node.querySelector<HTMLElement>('nav[aria-label="Pending requests"]')?.focus();
    }
  }
  protected render(): React.ReactNode {
    const inputs = this.model.snapshot?.inputs ?? [];
    const projects = new Map(inputs.map((item) => [item.projectId, item.projectName]));
    for (const project of this.model.snapshot?.unavailableProjects ?? [])
      projects.set(project.projectId, project.name);
    const visible = inputs.filter((item) => !this.projectId || item.projectId === this.projectId);
    const groups = new Map<string, PendingInput[]>();
    for (const item of visible) {
      const group = `${item.projectId}:${item.rootTaskId ?? 'direct'}`;
      groups.set(group, [...(groups.get(group) ?? []), item]);
    }
    const selected = visible.find((item) => requestKey(item) === this.selected);
    return (
      <div className="gamecrafter-requests gamecrafter-page gamecrafter-surface">
        <header className="gamecrafter-page-header">
          <h1>Requests</h1>
          <p>Review pending approvals and task questions, grouped by Project and task.</p>
        </header>
        <div className="gamecrafter-page-toolbar">
          <label>
            Project{' '}
            <select
              aria-label="Requests Project"
              value={this.projectId}
              onChange={(event) => {
                this.projectId = event.currentTarget.value;
                const first = this.model.snapshot?.inputs.find(
                  (item) => !this.projectId || item.projectId === this.projectId,
                );
                this.selected = first ? requestKey(first) : undefined;
                this.update();
              }}
            >
              <option value="">All Projects</option>
              {[...projects].map(([id, name]) => (
                <option key={id} value={id}>
                  {name}
                </option>
              ))}
            </select>
          </label>
          <button
            type="button"
            disabled={this.model.loading}
            onClick={() => void this.model.refresh()}
          >
            Refresh requests
          </button>
          <span role="status">
            {visible.length} shown · {inputs.length} pending total
          </span>
        </div>
        <p>
          Approvals apply only to the selected call. Answering a task question does not approve a
          tool.
        </p>
        {this.model.error && <p role="alert">{this.model.error}</p>}
        {this.model.actionError && <p role="alert">{this.model.actionError}</p>}
        {!!this.model.snapshot?.unavailableProjects.length && (
          <p role="status">
            Unavailable Projects:{' '}
            {this.model.snapshot.unavailableProjects.map((project) => project.name).join(', ')}.
            Their pending requests cannot be loaded.
          </p>
        )}
        <div className="gamecrafter-requests-layout">
          <nav aria-label="Pending requests" tabIndex={-1} className="gamecrafter-requests-list">
            {[...groups].map(([key, items]) => (
              <section key={key}>
                <h2>{items[0]!.projectName}</h2>
                <h3>{items[0]!.rootTaskTitle ?? 'Direct requests'}</h3>
                {items.map((item) => (
                  <button
                    className="gamecrafter-request-select"
                    type="button"
                    key={requestKey(item)}
                    aria-pressed={selected === item}
                    onClick={() => {
                      this.selected = requestKey(item);
                      this.update();
                    }}
                  >
                    <strong>
                      {item.kind === 'approval'
                        ? `Approval: ${item.approval.toolId}`
                        : 'Task question'}
                    </strong>
                    <span>{item.taskTitle ?? 'Direct request'}</span>
                  </button>
                ))}
              </section>
            ))}
            {!visible.length && (
              <p>
                {this.model.loading
                  ? 'Loading requests…'
                  : this.model.available
                    ? 'No pending requests in this selection.'
                    : 'Requests are unavailable until the service responds.'}
              </p>
            )}
          </nav>
          <section className="gamecrafter-page-panel" aria-label="Request details">
            {selected ? (
              <React.Fragment key={requestKey(selected)}>
                {this.renderRequest(selected)}
              </React.Fragment>
            ) : (
              <p>Select a request to review its context and respond.</p>
            )}
          </section>
        </div>
      </div>
    );
  }
  private renderRequest(item: PendingInput): React.ReactNode {
    const key = requestKey(item);
    const disabled = !this.model.available || this.model.loading || this.model.busy.has(key);
    const editingDisabled = !this.model.available || this.model.busy.has(key);
    return (
      <>
        <h2>{item.kind === 'approval' ? 'Tool approval' : 'Task question'}</h2>
        <p>
          <strong>{item.projectName}</strong> · {item.taskTitle ?? 'Direct request'}
        </p>
        {item.kind === 'approval' ? (
          <>
            <p>{item.approval.summary}</p>
            <p>
              Tool: <strong>{item.approval.toolId}</strong> · Effect:{' '}
              <strong>{item.approval.sideEffects}</strong>
            </p>
            <details>
              <summary>Review requested input</summary>
              <pre>{JSON.stringify(item.approval.input, null, 2)}</pre>
            </details>
            <div className="gamecrafter-page-actions">
              <button
                type="button"
                disabled={disabled}
                onClick={() => void this.model.decide(key, true)}
              >
                Approve this request
              </button>
              <button
                type="button"
                disabled={disabled}
                onClick={() => void this.model.decide(key, false)}
              >
                Reject this request
              </button>
            </div>
          </>
        ) : (
          <>
            <p>{item.question.prompt}</p>
            <label>
              Your answer
              {!item.question.options?.length ? (
                <textarea
                  aria-label="Answer to task question"
                  rows={4}
                  value={this.drafts.get(key) ?? ''}
                  disabled={editingDisabled}
                  onChange={(event) => {
                    this.drafts.set(key, event.currentTarget.value);
                    this.update();
                  }}
                />
              ) : (
                <select
                  aria-label="Answer to task question"
                  disabled={editingDisabled}
                  value={
                    this.drafts.has(key)
                      ? String(item.question.options.indexOf(this.drafts.get(key)!))
                      : '-1'
                  }
                  onChange={(event) => {
                    this.drafts.set(
                      key,
                      item.question.options![Number(event.currentTarget.value)]!,
                    );
                    this.update();
                  }}
                >
                  <option value="-1" disabled>
                    Choose an answer
                  </option>
                  {item.question.options.map((option, index) => (
                    <option key={index} value={index}>
                      {option}
                    </option>
                  ))}
                </select>
              )}
            </label>
            <button
              type="button"
              disabled={
                disabled ||
                !this.drafts.has(key) ||
                (!item.question.options?.length && !this.drafts.get(key)?.trim())
              }
              onClick={() => void this.model.answer(key, this.drafts.get(key)!)}
            >
              Send answer
            </button>
          </>
        )}
        <details>
          <summary>Request context</summary>
          <p>Project: {item.projectId}</p>
          <p>Task: {item.taskId ?? 'No task'}</p>
          <p>
            Request:{' '}
            {item.kind === 'approval' ? item.approval.approvalId : item.question.questionId}
          </p>
        </details>
      </>
    );
  }
}

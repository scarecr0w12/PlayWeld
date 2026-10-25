import React from 'react';
import type {
  AuditCleanupCounts,
  AuditCleanupPreview,
  AuditHistoryStore,
  AuditRetentionPolicy,
  RpcResult,
} from '@gamecrafter/contracts';
import type { ControlRoomService } from '../common/control-room-protocol';

interface Props {
  projectId: string;
  service: ControlRoomService;
  onCleanup?: () => void;
}
interface State {
  data?: RpcResult<'audit/retention'>;
  draft?: AuditRetentionPolicy;
  store: AuditHistoryStore;
  before: string;
  preview?: AuditCleanupPreview;
  confirmed: boolean;
  busy: boolean;
  error?: string;
  notice?: string;
}
const labels: Record<keyof AuditCleanupCounts, string> = {
  calls: 'Tool calls',
  approvals: 'Resolved approvals',
  events: 'Task/tool events',
  modelUsage: 'Model usage',
  decisionAssessments: 'Decision assessments',
  legacyUsage: 'Legacy usage removed from audit',
};
const total = (counts: AuditCleanupCounts) => Object.values(counts).reduce((a, b) => a + b, 0);

/** The service owns policy, eligibility and deletion. This component holds unsaved review state only. */
export class AuditRetentionPanel extends React.Component<Props, State> {
  state: State = { store: 'project', before: '', confirmed: false, busy: false };
  private alive = true;
  private running = false;
  private expiration?: ReturnType<typeof setTimeout>;
  componentDidMount(): void {
    void this.refresh();
  }
  componentWillUnmount(): void {
    this.alive = false;
    clearTimeout(this.expiration);
  }
  private invalidate(): void {
    clearTimeout(this.expiration);
    if (this.alive) this.setState({ preview: undefined, confirmed: false });
  }
  private async load(): Promise<void> {
    const data = await this.props.service.auditRetention(this.props.projectId);
    if (this.alive) this.setState({ data, draft: { ...data.policy } });
  }
  private async run(operation: () => Promise<void>): Promise<void> {
    if (!this.alive || this.running) return;
    this.running = true;
    this.setState({ busy: true, error: undefined });
    try {
      await operation();
    } catch (error) {
      if (this.alive)
        this.setState({ error: error instanceof Error ? error.message : String(error) });
    } finally {
      this.running = false;
      if (this.alive) this.setState({ busy: false });
    }
  }
  private async refresh(): Promise<void> {
    await this.run(async () => {
      this.invalidate();
      await this.load();
    });
  }
  private edit(patch: Partial<AuditRetentionPolicy>): void {
    if (!this.state.draft) return;
    const draft = { ...this.state.draft, ...patch };
    if (!draft.deletionEnabled || draft.retentionDays === 0) draft.autoPrune = false;
    this.invalidate();
    this.setState({ draft });
  }
  private async save(): Promise<void> {
    const policy = this.state.draft;
    if (!policy) return;
    await this.run(async () => {
      const data = await this.props.service.setAuditRetention(this.props.projectId, policy);
      if (this.alive) {
        this.invalidate();
        this.setState({ data, draft: { ...data.policy }, notice: 'Project audit policy saved.' });
      }
    });
  }
  private async preview(): Promise<void> {
    if (
      !this.state.data ||
      JSON.stringify(this.state.draft) !== JSON.stringify(this.state.data.policy)
    )
      return;
    const { store, before } = this.state;
    await this.run(async () => {
      this.invalidate();
      const preview = await this.props.service.previewAuditCleanup({
        projectId: this.props.projectId,
        store,
        ...(before ? { before: `${before}T00:00:00.000Z` } : {}),
      });
      if (this.alive) {
        this.setState({ preview, confirmed: false, notice: undefined });
        this.expiration = setTimeout(
          () => {
            this.invalidate();
            if (this.alive)
              this.setState({ notice: 'Cleanup preview expired. Preview again before deleting.' });
          },
          Math.max(0, Date.parse(preview.expiresAt) - Date.now()),
        );
      }
    });
  }
  private async apply(): Promise<void> {
    const preview = this.state.preview;
    if (
      !preview ||
      !this.state.confirmed ||
      !this.state.data?.policy.deletionEnabled ||
      !total(preview.counts) ||
      preview.projectId !== this.props.projectId ||
      preview.store !== this.state.store
    )
      return;
    await this.run(async () => {
      try {
        const receipt = await this.props.service.applyAuditCleanup({
          projectId: this.props.projectId,
          store: preview.store,
          previewId: preview.previewId,
          confirm: true,
        });
        if (!this.alive) return;
        this.invalidate();
        this.setState({
          notice: `Cleanup committed: ${total(receipt.counts)} audit records removed from live history.`,
        });
        this.props.onCleanup?.();
        await this.load();
      } catch (error) {
        this.invalidate();
        throw error;
      }
    });
  }
  render(): React.ReactNode {
    const { data, draft, busy, preview } = this.state;
    const dirty = !!data && JSON.stringify(draft) !== JSON.stringify(data.policy);
    return (
      <section
        className="gamecrafter-audit-retention gamecrafter-page-panel"
        aria-label="Audit retention controls"
      >
        <h2>Retention &amp; deletion</h2>
        <p>
          Cleanup removes eligible old audit history for this Project. Active task trees, pending
          approvals and permanent provenance are protected. Task records, router learning, files and
          backups are retained.
        </p>
        <button type="button" disabled={busy} onClick={() => void this.refresh()}>
          Refresh policy and receipts
        </button>
        {this.state.error && <p role="alert">{this.state.error}</p>}
        {this.state.notice && <p role="status">{this.state.notice}</p>}
        {!data || !draft ? (
          <p>
            {busy
              ? 'Loading audit policy…'
              : 'Load the Project audit policy before reviewing cleanup.'}
          </p>
        ) : (
          <>
            <fieldset disabled={busy}>
              <legend>Policy for this Project</legend>
              <label>
                Retention days (0 keeps history)
                <input
                  aria-label="Audit retention days"
                  type="number"
                  min={0}
                  max={36500}
                  value={draft.retentionDays}
                  onChange={(event) =>
                    this.edit({ retentionDays: Number(event.currentTarget.value) })
                  }
                />
              </label>
              <label>
                <input
                  aria-label="Allow audit deletion"
                  type="checkbox"
                  checked={draft.deletionEnabled}
                  onChange={(event) => this.edit({ deletionEnabled: event.currentTarget.checked })}
                />
                Allow audit deletion
              </label>
              <label>
                <input
                  aria-label="Automatically prune audit history"
                  type="checkbox"
                  disabled={!draft.deletionEnabled || draft.retentionDays === 0}
                  checked={draft.autoPrune}
                  onChange={(event) => this.edit({ autoPrune: event.currentTarget.checked })}
                />
                Automatically delete eligible history using this retention period
              </label>
              <button type="button" disabled={!dirty} onClick={() => void this.save()}>
                Save audit policy
              </button>
            </fieldset>
            <p>
              Automatic cleanup is opt-in and runs periodically in bounded batches. Zero days keeps
              history. Global defaults and reset-to-inherit are available in Settings under Logs
              &amp; audit.
            </p>
            <fieldset disabled={busy}>
              <legend>Manual cleanup preview</legend>
              <label>
                History store
                <select
                  aria-label="Audit cleanup store"
                  value={this.state.store}
                  onChange={(event) => {
                    this.invalidate();
                    this.setState({ store: event.currentTarget.value as AuditHistoryStore });
                  }}
                >
                  <option value="project">Tool calls, approvals &amp; task events</option>
                  <option value="model-usage">Model usage &amp; decision assessments</option>
                </select>
              </label>
              <label>
                Delete records before (UTC)
                <input
                  aria-label="Audit cleanup cutoff"
                  type="date"
                  value={this.state.before}
                  onChange={(event) => {
                    this.invalidate();
                    this.setState({ before: event.currentTarget.value });
                  }}
                />
              </label>
              <p>
                Leave the date empty to use the configured retention days. Each history store is
                reviewed and committed separately. Export full history before cleanup if you need a
                copy.
              </p>
              {this.state.store === 'model-usage' && (
                <p>
                  Legacy usage without task links may remain protected while Project task history is
                  active or recent. Router learning and accounting ledgers are retained.
                </p>
              )}
              {dirty && <p>Save policy changes before previewing cleanup.</p>}
              <button type="button" disabled={dirty} onClick={() => void this.preview()}>
                Preview audit cleanup
              </button>
            </fieldset>
            {preview && (
              <section aria-label="Audit cleanup preview">
                <h3>Review selected audit records</h3>
                <p>
                  Before {preview.before}. Preview expires {preview.expiresAt}.
                </p>
                <ul>
                  {(Object.keys(labels) as Array<keyof AuditCleanupCounts>).map((key) => (
                    <li key={key}>
                      {labels[key]}: {preview.counts[key]}
                    </li>
                  ))}
                </ul>
                {preview.hasMore && (
                  <p>More eligible records remain. Preview another batch after this cleanup.</p>
                )}
                {!total(preview.counts) && (
                  <p>
                    No eligible records in this scope. Protected and recent history is retained.
                  </p>
                )}
                <label>
                  <input
                    type="checkbox"
                    aria-label="Confirm audit deletion"
                    disabled={busy || !data.policy.deletionEnabled || !total(preview.counts)}
                    checked={this.state.confirmed}
                    onChange={(event) => this.setState({ confirmed: event.currentTarget.checked })}
                  />
                  I understand these records will be permanently removed from live audit history.
                </label>
                <button
                  type="button"
                  disabled={
                    busy ||
                    dirty ||
                    !data.policy.deletionEnabled ||
                    !this.state.confirmed ||
                    !total(preview.counts)
                  }
                  onClick={() => void this.apply()}
                >
                  Permanently delete previewed records
                </button>
                {!data.policy.deletionEnabled && (
                  <p>Deletion is disabled. Allow it in the saved policy, then preview again.</p>
                )}
              </section>
            )}
            <h3>Recent cleanup receipts</h3>
            <p>
              Receipts preserve what was removed without storing deleted payloads. Refresh to see
              automatic cleanup.
            </p>
            {!data.receipts.length ? (
              <p>No cleanup receipts recorded.</p>
            ) : (
              <ul>
                {data.receipts.map((receipt) => (
                  <li key={receipt.cleanupId}>
                    {receipt.completedAt} · {receipt.store} · {receipt.origin} ·{' '}
                    {total(receipt.counts)} records
                  </li>
                ))}
              </ul>
            )}
          </>
        )}
      </section>
    );
  }
}

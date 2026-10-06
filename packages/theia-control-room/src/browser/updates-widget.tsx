import React from 'react';
import { inject, injectable } from '@theia/core/shared/inversify';
import { Message } from '@theia/core/lib/browser/widgets/widget';
import { ControlRoomReactWidget } from './control-room-react-widget';
import type { UpdateState } from '@gamecrafter/contracts';
import {
  ControlRoomService,
  type ControlRoomService as ControlRoomServiceApi,
} from '../common/control-room-protocol';

@injectable()
export class UpdatesWidget extends ControlRoomReactWidget {
  static readonly ID = 'gamecrafter.updates';

  private state?: UpdateState;
  private message = '';
  private busy = false;
  private activeSection: 'status' | 'release' | 'recovery' = 'status';

  constructor(@inject(ControlRoomService) private readonly service: ControlRoomServiceApi) {
    super();
    this.id = UpdatesWidget.ID;
    this.title.label = 'Updates';
    this.title.iconClass = 'codicon codicon-sync';
    this.title.closable = true;
    void this.refresh();
  }

  protected onActivateRequest(message: Message): void {
    super.onActivateRequest(message);
    void this.refresh();
  }

  protected render(): React.ReactNode {
    const state = this.state;
    const recoveryCount = Number(Boolean(state?.downloaded)) + Number(Boolean(state?.previous));
    return (
      <main className="gamecrafter-updates gamecrafter-page gamecrafter-surface">
        <header className="gamecrafter-updates-header gamecrafter-page-header">
          <div>
            <h1>Updates</h1>
            <p>Review release compatibility and verification before opening an installer.</p>
          </div>
          <button
            type="button"
            className="theia-button"
            onClick={() => void this.check()}
            disabled={this.busy}
          >
            Check for updates
          </button>
        </header>
        {this.message && <p role="status">{this.message}</p>}
        <section
          className="gamecrafter-work-guidance gamecrafter-page-guidance"
          aria-label="Update next steps"
        >
          <div>
            <strong>What to do next</strong>
            <p>
              {!state
                ? 'Load the update state, then check for a compatible release.'
                : state.available
                  ? 'Review release notes and compatibility, then download and verify before requesting install instructions.'
                  : state.downloaded
                    ? 'Review verification status. Install instructions are available only after checksum and signature verification pass.'
                    : 'Check for updates to refresh release availability and compatibility.'}
            </p>
          </div>
        </section>
        <nav className="gamecrafter-section-nav" aria-label="Update sections">
          {(
            [
              ['status', 'Status', state ? 1 : 0],
              ['release', 'Available release', state?.available ? 1 : 0],
              ['recovery', 'Downloaded & rollback', recoveryCount],
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
        {!state ? (
          <p className="gamecrafter-page-empty">Loading update state…</p>
        ) : (
          <>
            <section
              className="gamecrafter-updates-section gamecrafter-page-panel"
              hidden={this.activeSection !== 'status'}
            >
              <h2>Installed version</h2>
              <dl className="gamecrafter-page-meta">
                <div className="gamecrafter-page-meta-item">
                  <dt>Version</dt>
                  <dd>{state.currentVersion}</dd>
                </div>
                <div className="gamecrafter-page-meta-item">
                  <dt>Channel</dt>
                  <dd>Stable</dd>
                </div>
                <div className="gamecrafter-page-meta-item">
                  <dt>Last checked</dt>
                  <dd>
                    {state.lastCheckedAt
                      ? new Date(state.lastCheckedAt).toLocaleString()
                      : 'Not checked yet'}
                  </dd>
                </div>
              </dl>
              {state.error && <p role="alert">{state.error}</p>}
              <h2>Compatibility</h2>
              <p role={state.compatibility.ok ? undefined : 'alert'}>
                {state.compatibility.ok
                  ? 'Compatible with the latest checked release.'
                  : state.compatibility.reasons.join('; ') ||
                    'Compatibility could not be confirmed.'}
              </p>
            </section>
            <section
              className="gamecrafter-updates-section gamecrafter-page-panel"
              hidden={this.activeSection !== 'release'}
            >
              <h2>
                {state.available
                  ? `Version ${state.available.version} available`
                  : 'No update available'}
              </h2>
              {!state.available && !state.compatibility.ok && (
                <p role="alert">
                  The latest release is incompatible: {state.compatibility.reasons.join('; ')}
                </p>
              )}
              {state.available && (
                <>
                  <p>{state.available.notes || 'No release notes provided.'}</p>
                  <p>
                    Package: {state.available.asset.name} ({state.available.asset.kind},{' '}
                    {state.available.asset.bytes} bytes)
                  </p>
                  <p>
                    Compatibility:{' '}
                    {state.compatibility.ok ? 'compatible' : state.compatibility.reasons.join('; ')}
                  </p>
                  <div className="gamecrafter-updates-actions">
                    <button
                      type="button"
                      onClick={() => void this.download()}
                      disabled={this.busy || !state.compatibility.ok}
                    >
                      Download and verify
                    </button>
                    <button type="button" onClick={() => void this.dismiss()} disabled={this.busy}>
                      Dismiss this version
                    </button>
                  </div>
                </>
              )}
            </section>
            <section
              className="gamecrafter-updates-section gamecrafter-page-panel"
              hidden={this.activeSection !== 'recovery'}
            >
              {state.downloaded && (
                <>
                  <h2>Downloaded {state.downloaded.version}</h2>
                  <dl className="gamecrafter-page-meta">
                    <div className="gamecrafter-page-meta-item">
                      <dt>SHA-256</dt>
                      <dd>{state.downloaded.verified.sha256 ? 'Verified' : 'Failed'}</dd>
                    </div>
                    <div className="gamecrafter-page-meta-item">
                      <dt>Release signature</dt>
                      <dd>{state.downloaded.verified.signature}</dd>
                    </div>
                  </dl>
                  {state.downloaded.verified.signature === 'unavailable' && (
                    <p role="alert">
                      The release signature is unavailable. Configure the trusted signing key in
                      Settings before proceeding.
                    </p>
                  )}
                  {state.downloaded.verified.signature === 'failed' && (
                    <p role="alert">
                      Release signature verification failed. Do not install this package.
                    </p>
                  )}
                  <p>
                    A signed Windows package can open after you save your work and close PlayWeld.
                    Other packages show installation instructions.
                  </p>
                  <button
                    type="button"
                    onClick={() => void this.install()}
                    disabled={
                      this.busy ||
                      !state.downloaded.verified.sha256 ||
                      state.downloaded.verified.signature !== 'verified'
                    }
                  >
                    Show install instructions
                  </button>
                </>
              )}
              {state.previous && (
                <div className="gamecrafter-updates-rollback">
                  <h2>Rollback package: {state.previous.version}</h2>
                  <p>Rollback requires closing PlayWeld and manually reinstalling this package.</p>
                  <button type="button" onClick={() => void this.rollback()} disabled={this.busy}>
                    Show rollback instructions
                  </button>
                </div>
              )}
              {!state.downloaded && !state.previous && (
                <p className="gamecrafter-page-empty">
                  No downloaded update or rollback package is available.
                </p>
              )}
            </section>
          </>
        )}
      </main>
    );
  }

  private async refresh(): Promise<void> {
    await this.perform(async () => {
      this.state = await this.service.getUpdateState();
    });
  }

  private async check(): Promise<void> {
    await this.perform(async () => {
      this.state = await this.service.checkUpdates();
      this.activeSection = this.state.available ? 'release' : 'status';
      this.message = this.state.available
        ? `Version ${this.state.available.version} is available.`
        : 'No compatible update is available.';
    });
  }

  private async download(): Promise<void> {
    const version = this.state?.available?.version;
    if (!version) return;
    await this.perform(async () => {
      this.state = await this.service.downloadUpdate(version);
      this.activeSection = 'recovery';
      this.message = `Version ${version} downloaded and SHA-256 verified.`;
    });
  }

  private async dismiss(): Promise<void> {
    const version = this.state?.available?.version;
    if (!version) return;
    await this.perform(async () => {
      this.state = await this.service.dismissUpdate(version);
      this.message = `Version ${version} dismissed.`;
    });
  }

  private async install(): Promise<void> {
    await this.perform(async () => {
      const result = await this.service.installUpdate();
      this.message = result.instructions;
    });
  }

  private async rollback(): Promise<void> {
    await this.perform(async () => {
      const result = await this.service.rollbackUpdate();
      this.message = result.instructions;
    });
  }

  private async perform(action: () => Promise<void>): Promise<void> {
    this.busy = true;
    this.message = '';
    this.update();
    try {
      await action();
    } catch (error) {
      this.message = error instanceof Error ? error.message : String(error);
    } finally {
      this.busy = false;
      this.update();
    }
  }
}

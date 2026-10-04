import React from 'react';
import { inject, injectable } from '@theia/core/shared/inversify';
import { Message } from '@theia/core/lib/browser/widgets/widget';
import { ControlRoomReactWidget } from './control-room-react-widget';
import type {
  BackupDestination,
  BackupDestinationKind,
  BackupManifest,
  BackupPlan,
  BackupRun,
  ProjectSummary,
} from '@gamecrafter/contracts';
import {
  ControlRoomService,
  type ControlRoomService as ControlRoomServiceApi,
} from '../common/control-room-protocol';
import { ControlRoomClientEvents } from './control-room-client';
import {
  formatBackupBytes,
  parseDestinationConfig,
  validateRecoveryIdentity,
} from '../common/backups-view-model';

const destinationKinds: BackupDestinationKind[] = ['local', 's3', 'ftp', 'google-drive'];

@injectable()
export class BackupsWidget extends ControlRoomReactWidget {
  static readonly ID = 'gamecrafter.backups';

  private projects: ProjectSummary[] = [];
  private identities = [] as Awaited<ReturnType<ControlRoomServiceApi['listBackupIdentities']>>;
  private destinations = [] as Awaited<ReturnType<ControlRoomServiceApi['listBackupDestinations']>>;
  private plans: BackupPlan[] = [];
  private runs: BackupRun[] = [];
  private archives = [] as Awaited<ReturnType<ControlRoomServiceApi['listBackupArchives']>>;
  private projectId = '';
  private activeSection: 'identities' | 'destinations' | 'plans' | 'runs' | 'archives' = 'plans';
  private scope: 'project' | 'profile' = 'project';
  private identityId = '';
  private destinationId = '';
  private archiveName = '';
  private inspectedManifest?: BackupManifest;
  private identityLabel = '';
  private identitySecret = '';
  private identityConfirmation = '';
  private destinationKind: BackupDestinationKind = 'local';
  private destinationName = '';
  private destinationConfig = '{"directory":""}';
  private destinationSecrets: Record<string, string> = {};
  private editingDestinationId = '';
  private planSchedule: 'manual' | 'interval' | 'daily' = 'manual';
  private everyMinutes = '60';
  private dailyAt = '02:00';
  private keepLast = '5';
  private keepDays = '';
  private restoreSecret = '';
  private restoreTargetPath = '';
  private registerProject = true;
  private message = '';
  private busy = false;

  constructor(
    @inject(ControlRoomService) private readonly service: ControlRoomServiceApi,
    @inject(ControlRoomClientEvents) private readonly clientEvents: ControlRoomClientEvents,
  ) {
    super();
    this.id = BackupsWidget.ID;
    this.title.label = 'Backups';
    this.title.iconClass = 'codicon codicon-database';
    this.title.closable = true;
    this.toDispose.push(
      this.clientEvents.backupRunChanged(({ run }) => {
        this.runs = [run, ...this.runs.filter((entry) => entry.runId !== run.runId)].slice(0, 100);
        this.update();
      }),
    );
    this.toDispose.push(this.clientEvents.projectChanged(() => void this.refresh()));
    void this.refresh();
  }

  protected onActivateRequest(message: Message): void {
    super.onActivateRequest(message);
    void this.refresh();
  }

  protected render(): React.ReactNode {
    const destination = this.destinations.find(
      (entry) => entry.destinationId === this.destinationId,
    );
    const plans = this.plans.filter(
      (plan) => plan.scope === 'profile' || plan.projectId === this.projectId,
    );
    const nextSection =
      this.identities.length === 0
        ? 'identities'
        : this.destinations.length === 0
          ? 'destinations'
          : 'plans';
    const nextStep =
      nextSection === 'identities'
        ? 'Create a recovery identity and store its secret separately from the archive.'
        : nextSection === 'destinations'
          ? 'Add and test a destination, then create a backup plan.'
          : 'Choose a Project or profile scope, destination, recovery identity, and schedule.';
    return (
      <div className="gamecrafter-backups gamecrafter-page gamecrafter-surface">
        <header className="gamecrafter-backups-header gamecrafter-page-header">
          <div>
            <h1>Backups</h1>
            <p>Encrypted Project and profile archives with verified restore workflows.</p>
          </div>
          <button
            className="theia-button"
            type="button"
            onClick={() => void this.refresh()}
            disabled={this.busy}
          >
            Refresh
          </button>
        </header>
        {this.message && (
          <p className="gamecrafter-backups-message" role="status">
            {this.message}
          </p>
        )}
        <section
          className="gamecrafter-work-guidance gamecrafter-page-guidance"
          aria-label="Backup next steps"
        >
          <div>
            <strong>What to do next</strong>
            <p>{nextStep} Archives can be verified or restored to a separate location.</p>
          </div>
          <button
            type="button"
            onClick={() => {
              this.activeSection = nextSection;
              this.update();
            }}
          >
            Go to {nextSection}
          </button>
        </section>
        <nav className="gamecrafter-section-nav" aria-label="Backup sections">
          {(
            [
              ['identities', 'Identities', this.identities.length],
              ['destinations', 'Destinations', this.destinations.length],
              ['plans', 'Plans', plans.length],
              ['runs', 'Runs', this.runs.length],
              ['archives', 'Archives and restore', this.archives.length],
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
        <section
          className="gamecrafter-backups-section gamecrafter-page-panel"
          hidden={this.activeSection !== 'identities'}
        >
          <h3>Identities</h3>
          <p>Recovery secrets are never stored. Keep the secret separate from the archive.</p>
          <div className="gamecrafter-backups-form">
            <label>
              Label
              <input
                value={this.identityLabel}
                onChange={(event) => this.set('identityLabel', event.currentTarget.value)}
              />
            </label>
            <label>
              Recovery secret
              <input
                type="password"
                value={this.identitySecret}
                onChange={(event) => this.set('identitySecret', event.currentTarget.value)}
              />
            </label>
            <label>
              Confirm secret
              <input
                type="password"
                value={this.identityConfirmation}
                onChange={(event) => this.set('identityConfirmation', event.currentTarget.value)}
              />
            </label>
            <button
              className="theia-button"
              type="button"
              onClick={() => void this.createIdentity()}
              disabled={this.busy}
            >
              Create identity
            </button>
          </div>
          {this.identities.length === 0 ? (
            <p className="gamecrafter-page-empty">
              No recovery identities yet. Create one before saving a backup plan.
            </p>
          ) : (
            <ul className="gamecrafter-backups-list">
              {this.identities.map((identity) => (
                <li className="gamecrafter-page-meta-item" key={identity.identityId}>
                  <span>{identity.label}</span>
                  <code>{identity.identityId}</code>
                  <button
                    type="button"
                    onClick={() => void this.removeIdentity(identity.identityId)}
                    disabled={this.busy}
                  >
                    Remove
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section
          className="gamecrafter-backups-section gamecrafter-page-panel"
          hidden={this.activeSection !== 'destinations'}
        >
          <h3>Destinations</h3>
          <p className="gamecrafter-page-section-intro">
            Credentials are stored separately from archive contents. Test a destination before
            relying on it for scheduled backups.
          </p>
          <div className="gamecrafter-backups-form">
            <label>
              Kind
              <select
                value={this.destinationKind}
                disabled={Boolean(this.editingDestinationId)}
                onChange={(event) =>
                  this.changeDestinationKind(event.currentTarget.value as BackupDestinationKind)
                }
              >
                {destinationKinds.map((kind) => (
                  <option key={kind} value={kind}>
                    {kind}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Display name
              <input
                value={this.destinationName}
                onChange={(event) => this.set('destinationName', event.currentTarget.value)}
              />
            </label>
            <label className="gamecrafter-backups-wide">
              Configuration JSON
              <textarea
                value={this.destinationConfig}
                onChange={(event) => this.set('destinationConfig', event.currentTarget.value)}
                rows={3}
              />
            </label>
            {this.secretNames().map((name) => (
              <label key={name}>
                {name}
                <input
                  type="password"
                  value={this.destinationSecrets[name] ?? ''}
                  onChange={(event) => this.setDestinationSecret(name, event.currentTarget.value)}
                />
              </label>
            ))}
            <button
              className="theia-button"
              type="button"
              onClick={() => void this.addDestination()}
              disabled={this.busy}
            >
              {this.editingDestinationId ? 'Save destination' : 'Add destination'}
            </button>
            {this.editingDestinationId && (
              <button type="button" onClick={() => this.cancelDestinationEdit()}>
                Cancel edit
              </button>
            )}
          </div>
          {this.destinations.length === 0 ? (
            <p className="gamecrafter-page-empty">
              No destinations yet. Add local storage or configure a remote destination here.
            </p>
          ) : (
            <ul className="gamecrafter-backups-list">
              {this.destinations.map((entry) => (
                <li className="gamecrafter-page-meta-item" key={entry.destinationId}>
                  <span>
                    {entry.displayName} ({entry.kind})
                  </span>
                  <span>{entry.hasSecrets ? 'Credentials saved' : 'No credentials'}</span>
                  <button
                    type="button"
                    onClick={() => this.editDestination(entry)}
                    disabled={this.busy}
                  >
                    Edit
                  </button>
                  <button
                    type="button"
                    onClick={() => void this.testDestination(entry.destinationId)}
                    disabled={this.busy}
                  >
                    Test
                  </button>
                  <button
                    type="button"
                    onClick={() => void this.removeDestination(entry.destinationId)}
                    disabled={this.busy}
                  >
                    Remove
                  </button>
                </li>
              ))}
            </ul>
          )}
          {destination?.kind === 'ftp' &&
            'secure' in destination.config &&
            destination.config.secure === false && (
              <p className="gamecrafter-backups-warning">
                Plain FTP is allowed because the archive is encrypted before upload.
              </p>
            )}
        </section>

        <section
          className="gamecrafter-backups-section gamecrafter-page-panel"
          hidden={this.activeSection !== 'plans'}
        >
          <h3>Plans</h3>
          <p className="gamecrafter-page-section-intro">
            Project plans follow the selected Project. Profile plans back up the PlayWeld profile
            without a Project selection.
          </p>
          <div className="gamecrafter-backups-form">
            <label>
              Scope
              <select
                value={this.scope}
                onChange={(event) =>
                  this.set('scope', event.currentTarget.value as 'project' | 'profile')
                }
              >
                <option value="project">Project</option>
                <option value="profile">Profile</option>
              </select>
            </label>
            {this.scope === 'project' && (
              <label>
                Project
                <select
                  aria-label="Backups Project"
                  value={this.projectId}
                  onChange={(event) => this.set('projectId', event.currentTarget.value)}
                >
                  <option value="">Select a Project</option>
                  {this.projects.map((project) => (
                    <option key={project.projectId} value={project.projectId}>
                      {project.name}
                    </option>
                  ))}
                </select>
              </label>
            )}
            <label>
              Destination
              <select
                value={this.destinationId}
                onChange={(event) => this.set('destinationId', event.currentTarget.value)}
              >
                <option value="">Select destination</option>
                {this.destinations.map((item) => (
                  <option key={item.destinationId} value={item.destinationId}>
                    {item.displayName}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Identity
              <select
                value={this.identityId}
                onChange={(event) => this.set('identityId', event.currentTarget.value)}
              >
                <option value="">Select identity</option>
                {this.identities.map((item) => (
                  <option key={item.identityId} value={item.identityId}>
                    {item.label}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Schedule
              <select
                value={this.planSchedule}
                onChange={(event) =>
                  this.set(
                    'planSchedule',
                    event.currentTarget.value as 'manual' | 'interval' | 'daily',
                  )
                }
              >
                <option value="manual">Manual</option>
                <option value="interval">Interval</option>
                <option value="daily">Daily</option>
              </select>
            </label>
            {this.planSchedule === 'interval' && (
              <label>
                Every minutes
                <input
                  type="number"
                  min={15}
                  value={this.everyMinutes}
                  onChange={(event) => this.set('everyMinutes', event.currentTarget.value)}
                />
              </label>
            )}
            {this.planSchedule === 'daily' && (
              <label>
                At (local time)
                <input
                  type="time"
                  value={this.dailyAt}
                  onChange={(event) => this.set('dailyAt', event.currentTarget.value)}
                />
              </label>
            )}
            <label>
              Keep last
              <input
                type="number"
                min={1}
                value={this.keepLast}
                onChange={(event) => this.set('keepLast', event.currentTarget.value)}
              />
            </label>
            <label>
              Keep days (optional)
              <input
                type="number"
                min={1}
                value={this.keepDays}
                onChange={(event) => this.set('keepDays', event.currentTarget.value)}
              />
            </label>
            <button
              className="theia-button"
              type="button"
              onClick={() => void this.savePlan()}
              disabled={this.busy}
            >
              Save plan
            </button>
            <button
              className="theia-button"
              type="button"
              onClick={() => void this.runNow()}
              disabled={this.busy}
            >
              Run now
            </button>
          </div>
          {plans.length === 0 ? (
            <p className="gamecrafter-page-empty">
              No backup plans for this scope. Save one above after choosing an identity and
              destination.
            </p>
          ) : (
            <ul className="gamecrafter-backups-list">
              {plans.map((plan) => (
                <li className="gamecrafter-page-meta-item" key={plan.planId}>
                  <span>
                    {plan.scope} · {plan.schedule.kind} · keep {plan.retention.keepLast}
                  </span>
                  <code>{plan.planId}</code>
                  <button
                    type="button"
                    onClick={() => void this.runPlan(plan.planId)}
                    disabled={this.busy}
                  >
                    Run now
                  </button>
                  <button
                    type="button"
                    onClick={() => void this.removePlan(plan.planId)}
                    disabled={this.busy}
                  >
                    Remove
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section
          className="gamecrafter-backups-section gamecrafter-page-panel"
          hidden={this.activeSection !== 'runs'}
        >
          <h3>Runs</h3>
          {this.runs.length === 0 && (
            <p className="gamecrafter-page-empty">
              No backup runs recorded. Run a plan to create and verify an archive.
            </p>
          )}
          <ul className="gamecrafter-backups-list gamecrafter-backups-runs">
            {this.runs.map((run) => (
              <li key={run.runId}>
                <span
                  className={`gamecrafter-backup-status gamecrafter-backup-status-${run.status}`}
                >
                  {run.status}
                </span>
                <code>{run.archiveName}</code>
                <span>
                  {formatBackupBytes(run.bytes)} · {run.files} files
                </span>
                {run.verifiedAt && <span className="gamecrafter-backup-badge">verified</span>}
                {run.drilledAt && <span className="gamecrafter-backup-badge">drilled</span>}
                {run.error && <span className="gamecrafter-backups-warning">{run.error}</span>}
                {(run.status === 'running' ||
                  run.status === 'uploading' ||
                  run.status === 'verifying') && (
                  <button
                    type="button"
                    onClick={() => void this.cancelRun(run.runId)}
                    disabled={this.busy}
                  >
                    Cancel
                  </button>
                )}
              </li>
            ))}
          </ul>
        </section>

        <section
          className="gamecrafter-backups-section gamecrafter-page-panel"
          hidden={this.activeSection !== 'archives'}
        >
          <h3>Archives</h3>
          <p className="gamecrafter-page-section-intro">
            List a destination's archives, inspect the manifest, verify it, and restore only to a
            new location.
          </p>
          <div className="gamecrafter-backups-form">
            <label>
              Destination
              <select
                value={this.destinationId}
                onChange={(event) => this.set('destinationId', event.currentTarget.value)}
              >
                <option value="">Select destination</option>
                {this.destinations.map((item) => (
                  <option key={item.destinationId} value={item.destinationId}>
                    {item.displayName}
                  </option>
                ))}
              </select>
            </label>
            <button
              className="theia-button"
              type="button"
              onClick={() => void this.loadArchives()}
              disabled={this.busy}
            >
              List archives
            </button>
            {this.archives.length === 0 && (
              <p className="gamecrafter-page-empty">
                No archives listed yet. Choose a destination and list its available archives.
              </p>
            )}
            <label>
              Archive
              <select
                value={this.archiveName}
                onChange={(event) => this.set('archiveName', event.currentTarget.value)}
              >
                <option value="">Select archive</option>
                {this.archives.map((archive) => (
                  <option key={archive.archiveName} value={archive.archiveName}>
                    {archive.archiveName} ({formatBackupBytes(archive.bytes)})
                  </option>
                ))}
              </select>
            </label>
            <label>
              Recovery secret
              <input
                type="password"
                value={this.restoreSecret}
                onChange={(event) => this.set('restoreSecret', event.currentTarget.value)}
              />
            </label>
            <button type="button" onClick={() => void this.inspectArchive()} disabled={this.busy}>
              Inspect
            </button>
            <button type="button" onClick={() => void this.verifyArchive()} disabled={this.busy}>
              Verify / restore drill
            </button>
            <label>
              Restore target path
              <input
                value={this.restoreTargetPath}
                onChange={(event) => this.set('restoreTargetPath', event.currentTarget.value)}
              />
            </label>
            <label className="gamecrafter-backups-checkbox">
              <input
                type="checkbox"
                checked={this.registerProject}
                onChange={(event) => this.set('registerProject', event.currentTarget.checked)}
              />{' '}
              Register restored Project
            </label>
            <button
              className="theia-button"
              type="button"
              onClick={() => void this.restoreArchive()}
              disabled={this.busy}
            >
              Restore to new location
            </button>
          </div>
          {this.inspectedManifest && (
            <details className="gamecrafter-backup-manifest" open>
              <summary>Manifest ({this.inspectedManifest.entries.length} entries)</summary>
              <pre>{JSON.stringify(this.inspectedManifest, null, 2)}</pre>
            </details>
          )}
        </section>
      </div>
    );
  }

  private async refresh(): Promise<void> {
    try {
      const [projects, identities, destinations, runs] = await Promise.all([
        this.service.listProjects(),
        this.service.listBackupIdentities(),
        this.service.listBackupDestinations(),
        this.service.listBackupRuns(undefined, 100),
      ]);
      this.projects = projects;
      this.identities = identities;
      this.destinations = destinations;
      this.runs = runs;
      this.projectId = (await this.resolveProjectSelection(projects, () => this.projectId)) || '';
      if (!this.identityId && identities[0]) this.identityId = identities[0].identityId;
      if (!this.destinationId && destinations[0])
        this.destinationId = destinations[0].destinationId;
      this.plans = await this.service.listBackupPlans(this.projectId || undefined);
      this.update();
    } catch (error) {
      this.setMessage(error instanceof Error ? error.message : String(error));
    }
  }

  private async createIdentity(): Promise<void> {
    const error = validateRecoveryIdentity({
      label: this.identityLabel,
      secret: this.identitySecret,
      confirmation: this.identityConfirmation,
    });
    if (error) return this.setMessage(error);
    await this.perform(async () => {
      const identity = await this.service.createBackupIdentity({
        label: this.identityLabel.trim(),
        secret: this.identitySecret,
      });
      this.identitySecret = '';
      this.identityConfirmation = '';
      this.identityId = identity.identityId;
      this.setMessage('Recovery identity created. Store its secret separately.');
      await this.refresh();
    });
  }

  private async removeIdentity(identityId: string): Promise<void> {
    await this.perform(async () => {
      await this.service.removeBackupIdentity(identityId);
      this.setMessage('Identity removed.');
      await this.refresh();
    });
  }

  private async addDestination(): Promise<void> {
    const config = parseDestinationConfig(this.destinationKind, this.destinationConfig);
    if (!config || !this.destinationName.trim())
      return this.setMessage('Enter a name and valid destination configuration.');
    await this.perform(async () => {
      const secrets = Object.fromEntries(
        Object.entries(this.destinationSecrets).filter(([, value]) => value),
      );
      if (this.editingDestinationId) {
        await this.service.updateBackupDestination({
          destinationId: this.editingDestinationId,
          patch: {
            displayName: this.destinationName.trim(),
            config,
            ...(Object.keys(secrets).length ? { secrets } : {}),
          },
        });
        this.setMessage('Destination updated.');
      } else {
        const destination = await this.service.addBackupDestination({
          kind: this.destinationKind,
          displayName: this.destinationName.trim(),
          config,
          ...(Object.keys(secrets).length ? { secrets } : {}),
        });
        this.destinationId = destination.destinationId;
        this.setMessage('Destination added.');
      }
      this.editingDestinationId = '';
      this.destinationSecrets = {};
      await this.refresh();
    });
  }

  private editDestination(destination: BackupDestination): void {
    this.editingDestinationId = destination.destinationId;
    this.destinationId = destination.destinationId;
    this.destinationKind = destination.kind;
    this.destinationName = destination.displayName;
    this.destinationConfig = JSON.stringify(destination.config, null, 2);
    this.destinationSecrets = {};
    this.update();
  }

  private cancelDestinationEdit(): void {
    this.editingDestinationId = '';
    this.destinationName = '';
    this.destinationSecrets = {};
    this.changeDestinationKind('local');
  }

  private async removeDestination(destinationId: string): Promise<void> {
    await this.perform(async () => {
      await this.service.removeBackupDestination(destinationId);
      this.setMessage('Destination removed.');
      await this.refresh();
    });
  }

  private async testDestination(destinationId: string): Promise<void> {
    await this.perform(async () => {
      const result = await this.service.testBackupDestination(destinationId);
      this.setMessage(
        result.ok
          ? `Destination test passed in ${result.latencyMs} ms.`
          : `Destination test failed: ${result.error ?? 'unknown error'}`,
      );
    });
  }

  private async savePlan(): Promise<void> {
    if (!this.destinationId || !this.identityId)
      return this.setMessage('Select a destination and identity.');
    if (this.scope === 'project' && !this.projectId) return this.setMessage('Select a Project.');
    const schedule =
      this.planSchedule === 'manual'
        ? { kind: 'manual' as const }
        : this.planSchedule === 'interval'
          ? { kind: 'interval' as const, everyMinutes: Number(this.everyMinutes) }
          : { kind: 'daily' as const, at: this.dailyAt };
    await this.perform(async () => {
      await this.service.saveBackupPlan({
        plan: {
          scope: this.scope,
          projectId: this.scope === 'project' ? this.projectId : null,
          destinationId: this.destinationId,
          identityId: this.identityId,
          schedule,
          retention: {
            keepLast: Number(this.keepLast),
            keepDays: this.keepDays ? Number(this.keepDays) : null,
          },
          enabled: true,
        },
      });
      this.setMessage('Backup plan saved.');
      await this.refresh();
    });
  }

  private async removePlan(planId: string): Promise<void> {
    await this.perform(async () => {
      await this.service.removeBackupPlan(planId);
      this.setMessage('Backup plan removed.');
      await this.refresh();
    });
  }

  private async runNow(): Promise<void> {
    if (!this.destinationId || !this.identityId)
      return this.setMessage('Select a destination and identity.');
    if (this.scope === 'project' && !this.projectId) return this.setMessage('Select a Project.');
    await this.perform(async () => {
      await this.service.runBackup({
        scope: this.scope,
        projectId: this.scope === 'project' ? this.projectId : undefined,
        destinationId: this.destinationId,
        identityId: this.identityId,
      });
      this.setMessage('Backup started.');
      await this.refresh();
    });
  }

  private async runPlan(planId: string): Promise<void> {
    await this.perform(async () => {
      await this.service.runBackup({ planId });
      this.setMessage('Backup started.');
      await this.refresh();
    });
  }

  private async cancelRun(runId: string): Promise<void> {
    await this.perform(async () => {
      await this.service.cancelBackupRun(runId);
      this.setMessage('Backup cancelled.');
      await this.refresh();
    });
  }

  private async loadArchives(): Promise<void> {
    if (!this.destinationId) return this.setMessage('Select a destination.');
    await this.perform(async () => {
      this.archives = await this.service.listBackupArchives(this.destinationId);
      if (!this.archiveName && this.archives[0]) this.archiveName = this.archives[0].archiveName;
      this.setMessage(`Loaded ${this.archives.length} archive(s).`);
    });
  }

  private async inspectArchive(): Promise<void> {
    const input = this.archiveActionInput();
    if (!input) return;
    await this.perform(async () => {
      this.inspectedManifest = await this.service.inspectBackupArchive(input);
      this.setMessage(
        `Manifest inspected: ${this.inspectedManifest.entries.length} entries from ${this.inspectedManifest.createdAt}.`,
      );
    });
  }

  private async verifyArchive(): Promise<void> {
    const input = this.archiveActionInput();
    if (!input) return;
    await this.perform(async () => {
      const result = await this.service.verifyBackupArchive(input);
      this.setMessage(
        result.ok
          ? `Verified ${result.archiveName} (${formatBackupBytes(result.bytes)}).`
          : `Verification failed: ${result.error ?? 'unknown error'}`,
      );
      await this.refresh();
    });
  }

  private async restoreArchive(): Promise<void> {
    const input = this.archiveActionInput();
    if (!input || !this.restoreTargetPath.trim())
      return this.setMessage('Enter a new restore target path.');
    await this.perform(async () => {
      const result = await this.service.restoreBackupArchive({
        ...input,
        targetPath: this.restoreTargetPath.trim(),
        register: this.registerProject,
      });
      this.setMessage(
        `Restored to ${result.targetPath}${result.warnings.length ? ` — ${result.warnings.join('; ')}` : ''}`,
      );
      await this.refresh();
    });
  }

  private archiveActionInput():
    { destinationId: string; archiveName: string; secret: string } | undefined {
    if (!this.destinationId || !this.archiveName || this.restoreSecret.length < 12) {
      this.setMessage('Select a destination and archive, and enter its recovery secret.');
      return undefined;
    }
    return {
      destinationId: this.destinationId,
      archiveName: this.archiveName,
      secret: this.restoreSecret,
    };
  }

  private secretNames(): string[] {
    if (this.destinationKind === 's3') return ['accessKeyId', 'secretAccessKey', 'sessionToken'];
    if (this.destinationKind === 'ftp') return ['password'];
    if (this.destinationKind === 'google-drive') return ['clientSecret', 'refreshToken'];
    return [];
  }

  private changeDestinationKind(kind: BackupDestinationKind): void {
    this.destinationKind = kind;
    this.destinationSecrets = {};
    this.destinationConfig =
      kind === 'local'
        ? '{"directory":""}'
        : kind === 's3'
          ? '{"region":"us-east-1","bucket":"","prefix":"","forcePathStyle":false}'
          : kind === 'ftp'
            ? '{"host":"","port":21,"user":"","directory":"","secure":true}'
            : '{"folderId":"","clientId":""}';
    this.update();
  }

  private setDestinationSecret(name: string, value: string): void {
    this.destinationSecrets = { ...this.destinationSecrets, [name]: value };
    this.update();
  }

  private set(key: string, value: unknown): void {
    switch (key) {
      case 'identityLabel':
        this.identityLabel = String(value);
        break;
      case 'identitySecret':
        this.identitySecret = String(value);
        break;
      case 'identityConfirmation':
        this.identityConfirmation = String(value);
        break;
      case 'destinationName':
        this.destinationName = String(value);
        break;
      case 'destinationConfig':
        this.destinationConfig = String(value);
        break;
      case 'scope':
        if (value === 'project' || value === 'profile') this.scope = value;
        break;
      case 'projectId':
        this.markProjectSelection();
        this.projectId = String(value);
        break;
      case 'destinationId':
        this.destinationId = String(value);
        break;
      case 'identityId':
        this.identityId = String(value);
        break;
      case 'planSchedule':
        if (value === 'manual' || value === 'interval' || value === 'daily')
          this.planSchedule = value;
        break;
      case 'everyMinutes':
        this.everyMinutes = String(value);
        break;
      case 'dailyAt':
        this.dailyAt = String(value);
        break;
      case 'keepLast':
        this.keepLast = String(value);
        break;
      case 'keepDays':
        this.keepDays = String(value);
        break;
      case 'archiveName':
        this.archiveName = String(value);
        this.inspectedManifest = undefined;
        break;
      case 'restoreSecret':
        this.restoreSecret = String(value);
        break;
      case 'restoreTargetPath':
        this.restoreTargetPath = String(value);
        break;
      case 'registerProject':
        this.registerProject = value === true;
        break;
      default:
        return;
    }
    this.update();
  }

  private async perform(action: () => Promise<void>): Promise<void> {
    if (this.busy) return;
    this.busy = true;
    this.update();
    try {
      await action();
    } catch (error) {
      this.setMessage(error instanceof Error ? error.message : String(error));
    } finally {
      this.busy = false;
      this.update();
    }
  }

  private setMessage(message: string): void {
    this.message = message;
    this.update();
  }
}

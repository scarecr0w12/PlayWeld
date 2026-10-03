import React from 'react';
import { inject, injectable } from '@theia/core/shared/inversify';
import { Endpoint } from '@theia/core/lib/browser/endpoint';
import { Message } from '@theia/core/lib/browser/widgets/widget';
import { ControlRoomReactWidget } from './control-room-react-widget';
import type {
  AssetFileEntry,
  AssetJob,
  AssetJobKind,
  AssetOutputFormat,
  AssetPreview,
  AssetProviderAccount,
  AssetProviderCapabilities,
  AssetProviderKind,
  ProjectSummary,
  RpcParams,
} from '@gamecrafter/contracts';
import {
  ControlRoomService,
  type ControlRoomService as ControlRoomServiceApi,
} from '../common/control-room-protocol';
import { ControlRoomClientEvents } from './control-room-client';
import {
  assetJobActions,
  availableAssetJobKinds,
  availableAssetOutputFormats,
} from '../common/assets-view-model';
import { AssetViewer } from './asset-viewer/asset-viewer';
import { ImageViewer } from './asset-viewer/image-viewer';

interface GenerationForm {
  kind: AssetJobKind;
  prompt: string;
  negativePrompt: string;
  imagePath: string;
  sourceJobId: string;
  outputFormat: AssetOutputFormat;
}

@injectable()
export class AssetsWidget extends ControlRoomReactWidget {
  static readonly ID = 'gamecrafter.assets';

  private projects: ProjectSummary[] = [];
  private selectedProjectId = '';
  private providers: AssetProviderCapabilities[] = [];
  private accounts: AssetProviderAccount[] = [];
  private jobs: AssetJob[] = [];
  private files: AssetFileEntry[] = [];
  private selectedPath = '';
  private preview?: AssetPreview;
  private selectedAccountId = '';
  private form: GenerationForm = {
    kind: 'text-to-3d',
    prompt: '',
    negativePrompt: '',
    imagePath: '',
    sourceJobId: '',
    outputFormat: 'glb',
  };
  private addProviderKind: AssetProviderKind = 'meshy';
  private addDisplayName = '';
  private addBaseUrl = '';
  private addApiKey = '';
  private addPlanTier = '';
  private destinationDir = '';
  private readonly reviewNotes = new Map<string, string>();
  private busy = false;
  private errorMessage?: string;
  private resultMessage?: string;
  private accountTestMessage?: string;

  constructor(
    @inject(ControlRoomService)
    private readonly service: ControlRoomServiceApi,
    @inject(ControlRoomClientEvents)
    private readonly clientEvents: ControlRoomClientEvents,
  ) {
    super();
    this.id = AssetsWidget.ID;
    this.title.label = 'Assets';
    this.title.iconClass = 'codicon codicon-symbol-misc';
    this.title.closable = true;
    this.toDispose.push(this.clientEvents.projectChanged(() => void this.refresh()));
    this.toDispose.push(
      this.clientEvents.assetJobChanged(({ projectId, job }) => {
        if (projectId !== this.selectedProjectId) return;
        this.jobs = [job, ...this.jobs.filter((entry) => entry.jobId !== job.jobId)];
        this.update();
      }),
    );
    void this.refresh();
  }

  protected onActivateRequest(message: Message): void {
    super.onActivateRequest(message);
    void this.refresh();
  }

  protected render(): React.ReactNode {
    const selectedAccount = this.accounts.find(
      (account) => account.accountId === this.selectedAccountId,
    );
    const selectedProvider = this.providers.find(
      (provider) => provider.providerKind === selectedAccount?.providerKind,
    );
    const jobKinds = availableAssetJobKinds(selectedProvider);
    const formats = availableAssetOutputFormats(selectedProvider);
    return (
      <div className="gamecrafter-assets gamecrafter-surface">
        <header className="gamecrafter-assets-header">
          <div>
            <h1>Assets</h1>
            <p>
              Inspect Project assets, generate provider jobs, and review provenance before import.
            </p>
          </div>
          <button
            className="theia-button"
            type="button"
            disabled={this.busy}
            onClick={() => void this.refreshProject()}
          >
            Refresh
          </button>
        </header>
        <label className="gamecrafter-assets-project">
          Project
          <select
            aria-label="Assets Project"
            value={this.selectedProjectId}
            onChange={(event) => {
              this.markProjectSelection();
              this.selectedProjectId = event.currentTarget.value;
              this.selectedPath = '';
              this.preview = undefined;
              void this.refreshProject();
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
        {this.errorMessage && (
          <p className="gamecrafter-assets-error" role="alert">
            {this.errorMessage}
          </p>
        )}
        {this.resultMessage && (
          <p className="gamecrafter-assets-result" role="status">
            {this.resultMessage}
          </p>
        )}
        {!this.selectedProjectId ? (
          <p>Select a Project to browse its asset library.</p>
        ) : (
          <div className="gamecrafter-assets-columns">
            <section className="gamecrafter-assets-library">
              <div className="gamecrafter-assets-section-title">
                <h2>Library</h2>
                <button type="button" onClick={() => void this.refreshProject()}>
                  Refresh
                </button>
              </div>
              {this.files.length ? (
                <ul className="gamecrafter-assets-file-list">
                  {this.files.map((file) => (
                    <li key={file.path}>
                      <button
                        type="button"
                        className={this.selectedPath === file.path ? 'selected' : ''}
                        onClick={() => void this.loadPreview(file.path)}
                      >
                        <span>{file.path}</span>
                        <small>
                          {file.extension || 'file'} · {formatBytes(file.bytes)}
                        </small>
                      </button>
                      {file.provenancePath && (
                        <small className="gamecrafter-assets-provenance">Provenance recorded</small>
                      )}
                    </li>
                  ))}
                </ul>
              ) : (
                <p>No files under game/assets yet.</p>
              )}
            </section>
            <section className="gamecrafter-assets-viewer">
              <h2>Viewer</h2>
              {this.renderPreview()}
            </section>
            <section className="gamecrafter-assets-generation">
              <h2>Generate &amp; Jobs</h2>
              {this.renderAccountForm()}
              <label>
                Provider account
                <select
                  aria-label="Asset provider account"
                  value={this.selectedAccountId}
                  onChange={(event) => {
                    this.selectedAccountId = event.currentTarget.value;
                    const account = this.accounts.find(
                      (entry) => entry.accountId === this.selectedAccountId,
                    );
                    const provider = this.providers.find(
                      (entry) => entry.providerKind === account?.providerKind,
                    );
                    const kinds = availableAssetJobKinds(provider);
                    const outputFormats = availableAssetOutputFormats(provider);
                    this.form = {
                      ...this.form,
                      kind: kinds.includes(this.form.kind)
                        ? this.form.kind
                        : (kinds[0] ?? 'text-to-3d'),
                      outputFormat: outputFormats.includes(this.form.outputFormat)
                        ? this.form.outputFormat
                        : (outputFormats[0] ?? 'glb'),
                    };
                    this.update();
                  }}
                >
                  <option value="">Select account</option>
                  {this.accounts.map((account) => (
                    <option
                      key={account.accountId}
                      value={account.accountId}
                      disabled={!account.enabled || !account.hasApiKey}
                    >
                      {account.displayName} ({account.providerKind})
                      {account.hasApiKey ? '' : ' — missing key'}
                    </option>
                  ))}
                </select>
              </label>
              <button
                type="button"
                disabled={!selectedAccount || this.busy}
                onClick={() => void this.testAccount()}
              >
                Test account
              </button>
              {this.accountTestMessage && <p role="status">{this.accountTestMessage}</p>}
              <label>
                Job kind
                <select
                  aria-label="Asset job kind"
                  value={this.form.kind}
                  disabled={!jobKinds.length}
                  onChange={(event) =>
                    this.updateForm({ kind: event.currentTarget.value as AssetJobKind })
                  }
                >
                  {jobKinds.map((kind) => (
                    <option key={kind} value={kind}>
                      {kind}
                    </option>
                  ))}
                </select>
              </label>
              {(this.form.kind === 'text-to-3d' || this.form.kind === 'refine') && (
                <label>
                  Prompt
                  <textarea
                    value={this.form.prompt}
                    maxLength={4000}
                    onChange={(event) => this.updateForm({ prompt: event.currentTarget.value })}
                  />
                </label>
              )}
              {(this.form.kind === 'text-to-3d' || this.form.kind === 'image-to-3d') && (
                <label>
                  Negative prompt
                  <textarea
                    value={this.form.negativePrompt}
                    maxLength={4000}
                    onChange={(event) =>
                      this.updateForm({ negativePrompt: event.currentTarget.value })
                    }
                  />
                </label>
              )}
              {this.form.kind === 'image-to-3d' && (
                <label>
                  Project-relative image path
                  <input
                    value={this.form.imagePath}
                    onChange={(event) => this.updateForm({ imagePath: event.currentTarget.value })}
                    placeholder="game/assets/reference.png"
                  />
                </label>
              )}
              {(this.form.kind === 'refine' || this.form.kind === 'convert') && (
                <label>
                  Source job
                  <select
                    value={this.form.sourceJobId}
                    onChange={(event) =>
                      this.updateForm({ sourceJobId: event.currentTarget.value })
                    }
                  >
                    <option value="">Select source job</option>
                    {this.jobs
                      .filter(
                        (job) =>
                          job.providerKind === selectedAccount?.providerKind &&
                          ['review', 'approved', 'rejected', 'imported'].includes(job.status),
                      )
                      .map((job) => (
                        <option key={job.jobId} value={job.jobId}>
                          {job.jobId.slice(0, 8)} · {job.status}
                        </option>
                      ))}
                  </select>
                </label>
              )}
              <label>
                Output format
                <select
                  value={this.form.outputFormat}
                  disabled={!formats.length}
                  onChange={(event) =>
                    this.updateForm({
                      outputFormat: event.currentTarget.value as AssetOutputFormat,
                    })
                  }
                >
                  {formats.map((format) => (
                    <option key={format} value={format}>
                      {format.toUpperCase()}
                    </option>
                  ))}
                </select>
              </label>
              <button
                className="theia-button"
                type="button"
                disabled={this.busy || !selectedAccount || !this.formValid()}
                onClick={() => void this.generate()}
              >
                Generate asset
              </button>
              <div className="gamecrafter-assets-jobs">
                <h3>Jobs</h3>
                {this.jobs.length ? (
                  this.jobs.map((job) => this.renderJob(job))
                ) : (
                  <p>No asset jobs yet.</p>
                )}
              </div>
            </section>
          </div>
        )}
      </div>
    );
  }

  private renderAccountForm(): React.ReactNode {
    return (
      <details className="gamecrafter-assets-add-account">
        <summary>Add provider account</summary>
        <form
          onSubmit={(event) => {
            event.preventDefault();
            void this.addAccount();
          }}
        >
          <label>
            Provider
            <select
              value={this.addProviderKind}
              onChange={(event) => {
                this.addProviderKind = event.currentTarget.value as AssetProviderKind;
                this.update();
              }}
            >
              {this.providers.map((provider) => (
                <option key={provider.providerKind} value={provider.providerKind}>
                  {provider.providerKind}
                </option>
              ))}
            </select>
          </label>
          <label>
            Display name
            <input
              value={this.addDisplayName}
              onChange={(event) => {
                this.addDisplayName = event.currentTarget.value;
                this.update();
              }}
            />
          </label>
          <label>
            API key
            <input
              type="password"
              autoComplete="new-password"
              value={this.addApiKey}
              onChange={(event) => {
                this.addApiKey = event.currentTarget.value;
                this.update();
              }}
            />
          </label>
          <label>
            Plan tier
            <input
              value={this.addPlanTier}
              onChange={(event) => {
                this.addPlanTier = event.currentTarget.value;
                this.update();
              }}
            />
          </label>
          <label>
            Base URL (optional)
            <input
              value={this.addBaseUrl}
              onChange={(event) => {
                this.addBaseUrl = event.currentTarget.value;
                this.update();
              }}
            />
          </label>
          <button
            type="submit"
            disabled={this.busy || !this.addDisplayName.trim() || !this.addApiKey}
          >
            Add account
          </button>
        </form>
      </details>
    );
  }

  private renderJob(job: AssetJob): React.ReactNode {
    const actions = assetJobActions(job.status);
    return (
      <article className="gamecrafter-assets-job" key={job.jobId}>
        <header>
          <strong>{job.jobId.slice(0, 8)}</strong>
          <span className={`gamecrafter-assets-status gamecrafter-assets-status-${job.status}`}>
            {job.status}
          </span>
        </header>
        <progress max={100} value={job.progress}>
          {job.progress}%
        </progress>
        <small>
          {job.providerKind} · {job.provenance.request.kind} · {job.progress}%
        </small>
        {job.error && <p className="gamecrafter-assets-error">{job.error}</p>}
        {job.artifacts.map((artifact) => (
          <div className="gamecrafter-assets-artifact" key={artifact.artifactId}>
            <span>
              {artifact.kind}.{artifact.format} · {formatBytes(artifact.bytes)}
            </span>
            {artifact.kind === 'model' && (
              <button type="button" onClick={() => void this.loadPreview(artifact.path)}>
                Show in viewer
              </button>
            )}
          </div>
        ))}
        {job.importedPath && (
          <button type="button" onClick={() => void this.loadPreview(job.importedPath!)}>
            Show imported file
          </button>
        )}
        {actions.canCancel && (
          <button type="button" onClick={() => void this.cancel(job.jobId)}>
            Cancel
          </button>
        )}
        {actions.canReview && (
          <div className="gamecrafter-assets-review">
            <textarea
              aria-label={`Review note ${job.jobId}`}
              value={this.reviewNotes.get(job.jobId) ?? ''}
              onChange={(event) => {
                this.reviewNotes.set(job.jobId, event.currentTarget.value);
                this.update();
              }}
              placeholder="Review note"
            />
            <button type="button" onClick={() => void this.review(job.jobId, 'approved')}>
              Approve
            </button>
            <button type="button" onClick={() => void this.review(job.jobId, 'rejected')}>
              Reject
            </button>
          </div>
        )}
        {actions.canImport && (
          <div className="gamecrafter-assets-import">
            <input
              aria-label={`Import directory ${job.jobId}`}
              value={this.destinationDir}
              onChange={(event) => {
                this.destinationDir = event.currentTarget.value;
                this.update();
              }}
              placeholder="game/assets/generated"
            />
            <button type="button" onClick={() => void this.importJob(job)}>
              Import
            </button>
          </div>
        )}
      </article>
    );
  }

  private renderPreview(): React.ReactNode {
    const preview = this.preview;
    if (!preview) return <p>Select a file from the library or a downloaded job artifact.</p>;
    if (preview.kind === 'unavailable') {
      return (
        <div className="gamecrafter-assets-unavailable">
          <p>{preview.sourcePath}</p>
          {preview.warnings.map((warning) => (
            <p className="gamecrafter-assets-warning" key={warning}>
              {warning}
            </p>
          ))}
          <button type="button" onClick={() => void this.openAsset(preview.sourcePath)}>
            Open in authoring tool
          </button>
        </div>
      );
    }
    const url = this.previewUrl(preview);
    if (preview.kind === 'image') {
      return (
        <ImageViewer
          url={url}
          preview={preview}
          onOpenInAuthoringTool={() => void this.openAsset(preview.sourcePath)}
        />
      );
    }
    return (
      <AssetViewer
        url={url}
        preview={preview}
        onOpenInAuthoringTool={() => void this.openAsset(preview.sourcePath)}
      />
    );
  }

  private async refresh(): Promise<void> {
    try {
      this.projects = await this.service.listProjects();
      const projectId = await this.resolveProjectSelection(
        this.projects,
        () => this.selectedProjectId,
      );
      if (projectId !== this.selectedProjectId) {
        this.selectedProjectId = projectId;
        await this.refreshProject();
      } else {
        this.update();
      }
    } catch (error) {
      this.showError(error);
    }
  }

  private async refreshProject(): Promise<void> {
    if (!this.selectedProjectId) {
      this.update();
      return;
    }
    this.busy = true;
    this.update();
    try {
      const projectId = this.selectedProjectId;
      const [providers, accounts, jobs, files] = await Promise.all([
        this.service.listAssetProviders(),
        this.service.listAssetAccounts(),
        this.service.listAssetJobs({ projectId, limit: 100 }),
        this.service.listAssetFiles({ projectId }),
      ]);
      this.providers = providers;
      this.accounts = accounts;
      this.jobs = jobs;
      this.files = files;
      if (
        !this.selectedAccountId ||
        !accounts.some((account) => account.accountId === this.selectedAccountId)
      ) {
        this.selectedAccountId =
          accounts.find((account) => account.enabled && account.hasApiKey)?.accountId ?? '';
      }
      this.update();
    } catch (error) {
      this.showError(error);
    } finally {
      this.busy = false;
      this.update();
    }
  }

  private updateForm(patch: Partial<GenerationForm>): void {
    this.form = { ...this.form, ...patch };
    this.update();
  }

  private formValid(): boolean {
    if (this.form.kind === 'text-to-3d' && !this.form.prompt.trim()) return false;
    if (this.form.kind === 'image-to-3d' && !this.form.imagePath.trim()) return false;
    if ((this.form.kind === 'refine' || this.form.kind === 'convert') && !this.form.sourceJobId)
      return false;
    return true;
  }

  private async addAccount(): Promise<void> {
    this.busy = true;
    this.errorMessage = undefined;
    this.resultMessage = undefined;
    try {
      await this.service.addAssetAccount({
        providerKind: this.addProviderKind,
        displayName: this.addDisplayName.trim(),
        apiKey: this.addApiKey,
        ...(this.addBaseUrl.trim() ? { baseUrl: this.addBaseUrl.trim() } : {}),
        ...(this.addPlanTier.trim() ? { planTier: this.addPlanTier.trim() } : {}),
      });
      this.addApiKey = '';
      this.addDisplayName = '';
      this.addBaseUrl = '';
      this.addPlanTier = '';
      this.resultMessage =
        'Provider account added; its API key is stored in the encrypted credential store.';
      await this.refreshProject();
    } catch (error) {
      this.showError(error);
    } finally {
      this.busy = false;
      this.update();
    }
  }

  private async testAccount(): Promise<void> {
    try {
      const result = await this.service.testAssetAccount(this.selectedAccountId);
      this.accountTestMessage = result.ok
        ? `Connected in ${result.latencyMs} ms${result.balance === null ? '' : ` · balance ${result.balance}`}`
        : `Connection failed: ${result.error ?? 'unknown provider error'}`;
    } catch (error) {
      this.accountTestMessage = error instanceof Error ? error.message : String(error);
    }
    this.update();
  }

  private async generate(): Promise<void> {
    if (!this.selectedProjectId || !this.selectedAccountId) return;
    this.busy = true;
    this.errorMessage = undefined;
    this.resultMessage = undefined;
    try {
      const request: RpcParams<'asset/generate'>['request'] = {
        kind: this.form.kind,
        outputFormat: this.form.outputFormat,
        ...(this.form.prompt.trim() ? { prompt: this.form.prompt.trim() } : {}),
        ...(this.form.negativePrompt.trim()
          ? { negativePrompt: this.form.negativePrompt.trim() }
          : {}),
        ...(this.form.kind === 'image-to-3d' ? { imagePath: this.form.imagePath.trim() } : {}),
        ...(['refine', 'convert'].includes(this.form.kind)
          ? { sourceJobId: this.form.sourceJobId }
          : {}),
      };
      const job = await this.service.generateAsset({
        projectId: this.selectedProjectId,
        accountId: this.selectedAccountId,
        request,
      });
      this.jobs = [job, ...this.jobs.filter((entry) => entry.jobId !== job.jobId)];
      this.resultMessage = `Asset job ${job.jobId.slice(0, 8)} queued.`;
      await this.refreshProject();
    } catch (error) {
      this.showError(error);
    } finally {
      this.busy = false;
      this.update();
    }
  }

  private async cancel(jobId: string): Promise<void> {
    await this.runJobAction(() =>
      this.service.cancelAssetJob({ projectId: this.selectedProjectId, jobId }),
    );
  }

  private async review(jobId: string, decision: 'approved' | 'rejected'): Promise<void> {
    await this.runJobAction(() =>
      this.service.reviewAssetJob({
        projectId: this.selectedProjectId,
        jobId,
        decision,
        ...(this.reviewNotes.get(jobId) ? { note: this.reviewNotes.get(jobId) } : {}),
      }),
    );
  }

  private async importJob(job: AssetJob): Promise<void> {
    const artifact = job.artifacts.find((entry) => entry.kind === 'model');
    if (!artifact) {
      this.showError(new Error('The job has no model artifact to import.'));
      return;
    }
    this.busy = true;
    try {
      const result = await this.service.importAsset({
        projectId: this.selectedProjectId,
        jobId: job.jobId,
        artifactId: artifact.artifactId,
        ...(this.destinationDir.trim() ? { destinationDir: this.destinationDir.trim() } : {}),
      });
      this.resultMessage = `Imported ${result.importedPath} with provenance.`;
      this.preview = undefined;
      await this.refreshProject();
      await this.loadPreview(result.importedPath);
    } catch (error) {
      this.showError(error);
    } finally {
      this.busy = false;
      this.update();
    }
  }

  private async runJobAction(action: () => Promise<AssetJob>): Promise<void> {
    try {
      const job = await action();
      this.jobs = [job, ...this.jobs.filter((entry) => entry.jobId !== job.jobId)];
      this.update();
    } catch (error) {
      this.showError(error);
    }
  }

  private async loadPreview(sourcePath: string): Promise<void> {
    if (!this.selectedProjectId) return;
    this.busy = true;
    this.errorMessage = undefined;
    try {
      this.selectedPath = sourcePath;
      this.preview = await this.service.previewAsset({
        projectId: this.selectedProjectId,
        path: sourcePath,
      });
    } catch (error) {
      this.showError(error);
    } finally {
      this.busy = false;
      this.update();
    }
  }

  private previewUrl(preview: AssetPreview): string {
    const endpoint = new Endpoint({ path: '/gamecrafter/asset-preview' }).getRestUrl();
    const query = new URLSearchParams({ projectId: preview.projectId, path: preview.sourcePath });
    return `${endpoint}?${query.toString()}`;
  }

  private async openAsset(sourcePath: string): Promise<void> {
    try {
      const result = await this.service.openAssetInAuthoringTool({
        projectId: this.selectedProjectId,
        path: sourcePath,
      });
      this.resultMessage = result.launched
        ? `Opened with ${result.command}.`
        : `Could not launch ${result.command}.`;
    } catch (error) {
      this.showError(error);
    }
    this.update();
  }

  private showError(error: unknown): void {
    this.errorMessage = error instanceof Error ? error.message : String(error);
    this.update();
  }
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

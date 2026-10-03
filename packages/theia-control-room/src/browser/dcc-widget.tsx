import React from 'react';
import { inject, injectable } from '@theia/core/shared/inversify';
import { Message } from '@theia/core/lib/browser/widgets/widget';
import { ControlRoomReactWidget } from './control-room-react-widget';
import type {
  AssetPreview,
  DccCapabilityReport,
  DccInstallation,
  DccInstallationKind,
  DccOperation,
  DccRun,
  DccTool,
  McpConnectionListEntry,
  ProjectSummary,
} from '@gamecrafter/contracts';
import {
  ControlRoomService,
  type ControlRoomService as ControlRoomServiceApi,
} from '../common/control-room-protocol';
import { ControlRoomClientEvents } from './control-room-client';
import {
  buildDccParams,
  dccOperationFormFields,
  validateDccExecutable,
  validateProjectRelativePath,
} from '../common/dcc-view-model';

const tools: DccTool[] = ['blender', 'maya', '3dsmax', 'cinema4d', 'zbrush'];
const operations: DccOperation[] = [
  'discover',
  'inspect',
  'import',
  'export',
  'convert',
  'render-preview',
  'run-script',
  'validate',
];

@injectable()
export class DccWidget extends ControlRoomReactWidget {
  static readonly ID = 'gamecrafter.dcc';

  private projects: ProjectSummary[] = [];
  private selectedProjectId = '';
  private tool: DccTool = 'blender';
  private installations: DccInstallation[] = [];
  private report?: DccCapabilityReport;
  private runs: DccRun[] = [];
  private selectedRun?: DccRun;
  private readonly artifactContents = new Map<string, string>();
  private selectedOperation: DccOperation = 'discover';
  private params: Record<string, string> = {};
  private installationPath = '';
  private installationKind: DccInstallationKind = 'gui';
  private connections: McpConnectionListEntry[] = [];
  private selectedBridgeId = '';
  private preview?: AssetPreview;
  private busy = false;
  private errorMessage?: string;
  private resultMessage?: string;

  constructor(
    @inject(ControlRoomService) private readonly service: ControlRoomServiceApi,
    @inject(ControlRoomClientEvents) private readonly clientEvents: ControlRoomClientEvents,
  ) {
    super();
    this.id = DccWidget.ID;
    this.title.label = 'DCC Tools';
    this.title.iconClass = 'codicon codicon-symbol-class';
    this.title.closable = true;
    this.toDispose.push(this.clientEvents.projectChanged(() => void this.refresh()));
    this.toDispose.push(
      this.clientEvents.dccCapabilitiesChanged((event) => {
        if (event.projectId !== this.selectedProjectId || event.tool !== this.tool) return;
        this.report = event.report;
        this.update();
      }),
    );
    this.toDispose.push(
      this.clientEvents.dccRunChanged((event) => {
        if (event.projectId !== this.selectedProjectId || event.tool !== this.tool) return;
        this.runs = [event.run, ...this.runs.filter((run) => run.runId !== event.run.runId)].slice(
          0,
          200,
        );
        this.update();
      }),
    );
    this.toDispose.push(this.clientEvents.mcpStateChanged(() => void this.loadProject()));
    void this.refresh();
  }

  protected onActivateRequest(message: Message): void {
    super.onActivateRequest(message);
    void this.refresh();
  }

  protected render(): React.ReactNode {
    const availableConnections = this.connections.filter((entry) =>
      (entry.config.tags ?? []).includes(`live-bridge:${this.tool}`),
    );
    return (
      <div className="gamecrafter-dcc gamecrafter-surface">
        <header className="gamecrafter-dcc-header">
          <div>
            <h1>DCC Tools</h1>
            <p>Headless DCC automation is distinct from live editor bridge readiness.</p>
          </div>
          <button
            className="theia-button"
            type="button"
            onClick={() => void this.refresh(true)}
            disabled={this.busy}
          >
            Refresh
          </button>
        </header>
        {this.errorMessage && (
          <p className="gamecrafter-dcc-error" role="alert">
            {this.errorMessage}
          </p>
        )}
        {this.resultMessage && (
          <p className="gamecrafter-dcc-result" role="status">
            {this.resultMessage}
          </p>
        )}
        <nav className="gamecrafter-dcc-tools" aria-label="DCC tools">
          {tools.map((tool) => (
            <button
              key={tool}
              type="button"
              aria-pressed={this.tool === tool}
              onClick={() => void this.selectTool(tool)}
            >
              {tool}
            </button>
          ))}
        </nav>
        <label className="gamecrafter-dcc-project">
          Project
          <select
            aria-label="DCC Project"
            value={this.selectedProjectId}
            onChange={(event) => {
              this.markProjectSelection();
              this.selectedProjectId = event.currentTarget.value;
              void this.loadProject(true);
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
        {!this.selectedProjectId ? (
          <p>Select a Project to inspect DCC capabilities.</p>
        ) : (
          <>
            {this.renderInstallations()}
            {this.report && this.renderCapabilities(this.report)}
            {this.renderLiveBridge(availableConnections)}
            {this.renderOperationRunner()}
            {this.renderRuns()}
            {this.preview && (
              <section className="gamecrafter-dcc-section">
                <h2>Artifact preview</h2>
                <pre>{JSON.stringify(this.preview, null, 2)}</pre>
              </section>
            )}
          </>
        )}
      </div>
    );
  }

  private renderInstallations(): React.ReactNode {
    const installations = this.installations.filter((entry) => entry.tool === this.tool);
    return (
      <section className="gamecrafter-dcc-section">
        <h2>Installations</h2>
        <ul className="gamecrafter-dcc-list">
          {installations.map((installation) => (
            <li key={installation.installationId}>
              <span>
                {installation.kind} · {installation.version ?? 'version unknown'} ·{' '}
                {installation.source}
              </span>
              {installation.viaWslInterop && (
                <span className="gamecrafter-dcc-badge">WSL interop</span>
              )}
              <code>{installation.executable}</code>
              <button
                type="button"
                onClick={() => void this.removeInstallation(installation.installationId)}
                disabled={this.busy}
              >
                Remove
              </button>
            </li>
          ))}
        </ul>
        <div className="gamecrafter-dcc-form">
          <label>
            Manual executable
            <input
              aria-label="DCC executable"
              value={this.installationPath}
              onChange={(event) => this.setInstallationPath(event.currentTarget.value)}
              placeholder="Absolute executable path"
            />
          </label>
          <label>
            Kind
            <select
              aria-label="DCC installation kind"
              value={this.installationKind}
              onChange={(event) => {
                this.installationKind = event.currentTarget.value as DccInstallationKind;
                this.update();
              }}
            >
              <option value="gui">GUI</option>
              <option value="python">Python</option>
              <option value="batch">Batch</option>
            </select>
          </label>
          <button
            className="theia-button"
            type="button"
            onClick={() => void this.addInstallation()}
            disabled={this.busy}
          >
            Add manual installation
          </button>
        </div>
      </section>
    );
  }

  private renderCapabilities(report: DccCapabilityReport): React.ReactNode {
    return (
      <section className="gamecrafter-dcc-section">
        <h2>{report.tool} capability report</h2>
        <div className="gamecrafter-dcc-layer-list">
          {(['headless', 'live-bridge'] as const).map((layer) => (
            <div className="gamecrafter-dcc-layer" key={layer}>
              <strong>{layer}</strong>
              <strong
                className={`gamecrafter-dcc-status gamecrafter-dcc-status-${report.layers[layer].status}`}
                aria-label={`${layer} status: ${report.layers[layer].status}`}
              >
                {report.layers[layer].status}
              </strong>
              <small>{report.layers[layer].detail}</small>
            </div>
          ))}
        </div>
        <p className="gamecrafter-dcc-os-support">
          OS support: {report.osSupport.os} · headless {report.osSupport.headless} · live bridge{' '}
          {report.osSupport.liveBridge}
        </p>
        <table className="gamecrafter-dcc-table">
          <thead>
            <tr>
              <th>Operation</th>
              <th>Layer</th>
              <th>Status</th>
              <th>Side effects</th>
              <th>Reason</th>
            </tr>
          </thead>
          <tbody>
            {report.operations.map((entry) => (
              <tr key={entry.operation}>
                <td>{entry.operation}</td>
                <td>{entry.layer}</td>
                <td>{entry.available ? 'available' : 'unavailable'}</td>
                <td>{entry.sideEffects}</td>
                <td>{entry.reason ?? '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    );
  }

  private renderLiveBridge(connections: McpConnectionListEntry[]): React.ReactNode {
    return (
      <section className="gamecrafter-dcc-section">
        <h2>Live bridge</h2>
        <p>
          Only MCP connections tagged <code>live-bridge:{this.tool}</code> are eligible. DCC
          sessions cannot prove Project identity.
        </p>
        <div className="gamecrafter-dcc-form">
          <label>
            Connection
            <select
              aria-label="DCC live bridge"
              value={this.selectedBridgeId}
              onChange={(event) => {
                this.selectedBridgeId = event.currentTarget.value;
                this.update();
              }}
            >
              <option value="">No live bridge</option>
              {connections.map((entry) => (
                <option key={entry.config.connectionId} value={entry.config.connectionId}>
                  {entry.config.name} ({entry.state.status})
                </option>
              ))}
            </select>
          </label>
          <button type="button" onClick={() => void this.bindLiveBridge()} disabled={this.busy}>
            Bind live bridge
          </button>
        </div>
      </section>
    );
  }

  private renderOperationRunner(): React.ReactNode {
    const fields = dccOperationFormFields(this.selectedOperation);
    return (
      <section className="gamecrafter-dcc-section">
        <h2>Run operation</h2>
        <div className="gamecrafter-dcc-form">
          <label>
            Operation
            <select
              aria-label="DCC operation"
              value={this.selectedOperation}
              onChange={(event) => this.selectOperation(event.currentTarget.value as DccOperation)}
            >
              {operations.map((operation) => (
                <option key={operation} value={operation}>
                  {operation}
                </option>
              ))}
            </select>
          </label>
          {fields.map((field) => (
            <label className={field === 'script' ? 'gamecrafter-dcc-wide' : undefined} key={field}>
              {field === 'script' ? 'Python code' : field}
              {field === 'script' ? (
                <textarea
                  aria-label="DCC script"
                  placeholder="Paste Python code here, rather than a script file path."
                  value={this.params[field] ?? ''}
                  onChange={(event) => this.setParam(field, event.currentTarget.value)}
                  rows={8}
                />
              ) : (
                <input
                  aria-label={`DCC ${field}`}
                  value={this.params[field] ?? ''}
                  onChange={(event) => this.setParam(field, event.currentTarget.value)}
                  placeholder={
                    field.endsWith('put') || field === 'file' ? 'Project-relative path' : undefined
                  }
                />
              )}
            </label>
          ))}
          {this.selectedOperation === 'run-script' && (
            <p className="gamecrafter-dcc-warning">
              Code execution is classified destructive. Subprocess and destructive filesystem calls
              are rejected unless unrestricted scripts are enabled.
            </p>
          )}
          <button
            className="theia-button"
            type="button"
            onClick={() => void this.runOperation()}
            disabled={this.busy}
          >
            Run {this.selectedOperation}
          </button>
        </div>
      </section>
    );
  }

  private renderRuns(): React.ReactNode {
    return (
      <section className="gamecrafter-dcc-section">
        <h2>Runs</h2>
        <ul className="gamecrafter-dcc-list">
          {this.runs.map((run) => (
            <li key={run.runId}>
              <span className={`gamecrafter-dcc-status gamecrafter-dcc-status-${run.status}`}>
                {run.status}
              </span>
              <span>
                {run.tool} · {run.operation} · exit {run.exitCode ?? '—'}
              </span>
              <code>{run.summary}</code>
              <button type="button" onClick={() => void this.loadRun(run.runId)}>
                Artifacts
              </button>
            </li>
          ))}
        </ul>
        {this.selectedRun && (
          <div className="gamecrafter-dcc-run-details">
            <h3>
              {this.selectedRun.tool} {this.selectedRun.operation} · {this.selectedRun.runId}
            </h3>
            <p>{this.selectedRun.summary}</p>
            <ul>
              {this.selectedRun.artifacts.map((artifact) => (
                <li key={`${artifact.kind}:${artifact.path}`}>
                  <span>{artifact.kind}</span> <code>{artifact.path}</code>
                  {(artifact.kind === 'log' || artifact.kind === 'report') && (
                    <button
                      type="button"
                      onClick={() => void this.toggleArtifactContents(artifact.path)}
                    >
                      {this.artifactContents.has(artifact.path) ? 'Hide contents' : 'View contents'}
                    </button>
                  )}
                  {(artifact.path.toLowerCase().endsWith('.png') ||
                    artifact.path.toLowerCase().endsWith('.glb') ||
                    artifact.path.toLowerCase().endsWith('.gltf')) && (
                    <button type="button" onClick={() => void this.previewArtifact(artifact.path)}>
                      Preview
                    </button>
                  )}
                  {this.artifactContents.has(artifact.path) && (
                    <pre>{this.artifactContents.get(artifact.path)}</pre>
                  )}
                </li>
              ))}
            </ul>
          </div>
        )}
      </section>
    );
  }

  private async loadRun(runId: string): Promise<void> {
    if (!this.selectedProjectId) return;
    await this.perform(async () => {
      this.selectedRun = await this.service.getDccRun(this.selectedProjectId, runId);
      this.artifactContents.clear();
    });
  }

  private async toggleArtifactContents(artifactPath: string): Promise<void> {
    if (this.artifactContents.has(artifactPath)) {
      this.artifactContents.delete(artifactPath);
      this.update();
      return;
    }
    if (!this.selectedProjectId) return;
    await this.perform(async () => {
      const result = await this.service.callTool(this.selectedProjectId, 'fs/read-file', {
        path: artifactPath,
      });
      const content =
        isRecord(result.output) && typeof result.output.content === 'string'
          ? result.output.content
          : '';
      this.artifactContents.set(artifactPath, content);
    });
  }

  private async refresh(refreshCapabilities = false): Promise<void> {
    try {
      this.projects = await this.service.listProjects();
      this.selectedProjectId =
        (await this.resolveProjectSelection(this.projects, () => this.selectedProjectId)) || '';
      this.installations = await this.service.listDccInstallations(this.tool);
      if (this.selectedProjectId) await this.loadProject(refreshCapabilities);
      this.update();
    } catch (error) {
      this.errorMessage = error instanceof Error ? error.message : String(error);
      this.update();
    }
  }

  private async selectTool(tool: DccTool): Promise<void> {
    this.tool = tool;
    this.installationKind =
      tool === 'maya' || tool === 'cinema4d' ? 'python' : tool === '3dsmax' ? 'batch' : 'gui';
    this.report = undefined;
    this.runs = [];
    this.selectedBridgeId = '';
    await this.refresh(true);
  }

  private async loadProject(refreshCapabilities = false): Promise<void> {
    if (!this.selectedProjectId) return;
    const [report, runs, connections] = await Promise.all([
      this.service.getDccCapabilities(this.selectedProjectId, this.tool, refreshCapabilities),
      this.service.listDccRuns(this.selectedProjectId, this.tool, 100),
      this.service.listMcpConnections(this.selectedProjectId),
    ]);
    this.report = report;
    this.runs = runs;
    this.connections = connections;
    this.selectedBridgeId = report.layers['live-bridge'].connectionId ?? '';
  }

  private async addInstallation(): Promise<void> {
    const error = validateDccExecutable(this.installationPath);
    if (error) return this.setError(error);
    await this.perform(async () => {
      await this.service.addDccInstallation({
        tool: this.tool,
        executable: this.installationPath.trim(),
        kind: this.installationKind,
      });
      this.installationPath = '';
      await this.refresh(true);
      this.setMessage(`${this.tool} installation added.`);
    });
  }

  private async removeInstallation(installationId: string): Promise<void> {
    await this.perform(async () => {
      await this.service.removeDccInstallation(installationId);
      await this.refresh(true);
    });
  }

  private async bindLiveBridge(): Promise<void> {
    if (!this.selectedProjectId) return;
    await this.perform(async () => {
      await this.service.setDccLiveBridge(
        this.selectedProjectId,
        this.tool,
        this.selectedBridgeId || null,
      );
      await this.loadProject(true);
      this.setMessage(
        this.selectedBridgeId ? 'DCC live bridge bound.' : 'DCC live bridge unbound.',
      );
    });
  }

  private async runOperation(): Promise<void> {
    if (!this.selectedProjectId) return;
    const fields = dccOperationFormFields(this.selectedOperation);
    for (const field of fields.filter(
      (entry) =>
        entry !== 'script' &&
        entry !== 'format' &&
        (entry !== 'output' || Boolean(this.params.output?.trim())),
    )) {
      const error = validateProjectRelativePath(this.params[field] ?? '');
      if (error) return this.setError(`${field}: ${error}`);
    }
    await this.perform(async () => {
      const run = await this.service.runDcc({
        projectId: this.selectedProjectId,
        tool: this.tool,
        operation: this.selectedOperation,
        params: buildDccParams(this.selectedOperation, this.params),
      });
      this.runs = [run, ...this.runs.filter((entry) => entry.runId !== run.runId)].slice(0, 200);
      this.selectedRun = run;
      this.artifactContents.clear();
      this.setMessage(`${this.tool} ${this.selectedOperation} started.`);
    });
  }

  private async previewArtifact(artifactPath: string): Promise<void> {
    if (!this.selectedProjectId) return;
    await this.perform(async () => {
      this.preview = await this.service.previewAsset({
        projectId: this.selectedProjectId,
        path: artifactPath,
      });
      this.setMessage(`Preview loaded for ${artifactPath}.`);
    });
  }

  private setInstallationPath(value: string): void {
    this.installationPath = value;
    this.update();
  }

  private selectOperation(operation: DccOperation): void {
    this.selectedOperation = operation;
    this.params = {};
    this.update();
  }

  private setParam(key: string, value: string): void {
    this.params = { ...this.params, [key]: value };
    this.update();
  }

  private async perform(action: () => Promise<void>): Promise<void> {
    if (this.busy) return;
    this.busy = true;
    this.errorMessage = undefined;
    this.update();
    try {
      await action();
    } catch (error) {
      this.setError(error instanceof Error ? error.message : String(error));
    } finally {
      this.busy = false;
      this.update();
    }
  }

  private setMessage(message: string): void {
    this.resultMessage = message;
    this.errorMessage = undefined;
    this.update();
  }

  private setError(message: string): void {
    this.errorMessage = message;
    this.update();
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

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

type DccSection = 'capabilities' | 'installations' | 'bridge' | 'operation' | 'runs';

@injectable()
export class DccWidget extends ControlRoomReactWidget {
  static readonly ID = 'gamecrafter.dcc';

  private projects: ProjectSummary[] = [];
  private selectedProjectId = '';
  private projectLoadVersion = 0;
  private loadedContext = '';
  private tool: DccTool = 'blender';
  private installations: DccInstallation[] = [];
  private report?: DccCapabilityReport;
  private runs: DccRun[] = [];
  private selectedRun?: DccRun;
  private readonly artifactContents = new Map<string, string>();
  private selectedOperation: DccOperation = 'discover';
  private activeSection: DccSection = 'capabilities';
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
    const installations = this.installations.filter((entry) => entry.tool === this.tool);
    return (
      <div className="gamecrafter-dcc gamecrafter-surface">
        <header className="gamecrafter-dcc-header gamecrafter-page-header">
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
        <div className="gamecrafter-dcc-context gamecrafter-page-meta">
          <label>
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
          <label>
            DCC tool
            <select
              aria-label="DCC tool"
              value={this.tool}
              onChange={(event) => void this.selectTool(event.currentTarget.value as DccTool)}
            >
              {tools.map((tool) => (
                <option key={tool} value={tool}>
                  {tool}
                </option>
              ))}
            </select>
          </label>
          {this.selectedProjectId && (
            <span className="gamecrafter-page-meta-item">
              Tool installations <strong>{installations.length}</strong>
            </span>
          )}
        </div>
        {!this.selectedProjectId ? (
          <div className="gamecrafter-page-empty">
            <h2>Select a Project</h2>
            <p>Choose a Project and DCC tool to review capabilities, bridge readiness, and runs.</p>
          </div>
        ) : (
          <>
            <section
              className="gamecrafter-work-guidance gamecrafter-page-guidance"
              aria-label="DCC next steps"
            >
              <div>
                <strong>What to do next</strong>
                <p>
                  {installations.length === 0
                    ? `Register a ${this.tool} executable before running headless operations.`
                    : !this.report
                      ? 'Wait for the capability report, then choose an available operation.'
                      : 'Check operation availability and side effects before starting a DCC run.'}
                </p>
              </div>
              {installations.length === 0 && (
                <button type="button" onClick={() => this.activateSection('installations')}>
                  Add installation
                </button>
              )}
              {this.report && (
                <button type="button" onClick={() => this.activateSection('operation')}>
                  Choose operation
                </button>
              )}
            </section>
            <nav className="gamecrafter-section-nav" aria-label="DCC views">
              {(
                [
                  ['capabilities', 'Capabilities', this.report?.operations.length ?? 0],
                  ['installations', 'Installations', installations.length],
                  ['bridge', 'Live bridge', availableConnections.length],
                  ['operation', 'Run operation', 1],
                  ['runs', 'Runs', this.runs.length],
                ] as const
              ).map(([section, label, count]) => (
                <button
                  key={section}
                  type="button"
                  aria-pressed={this.activeSection === section}
                  onClick={() => this.activateSection(section)}
                >
                  {label} <span className="gamecrafter-count">{count}</span>
                </button>
              ))}
            </nav>
            <section
              className="gamecrafter-dcc-section"
              hidden={this.activeSection !== 'capabilities'}
            >
              {this.report ? (
                this.renderCapabilities(this.report)
              ) : (
                <div className="gamecrafter-page-empty" role="status">
                  <h2>Checking DCC capabilities</h2>
                  <p>Headless and live-bridge support will appear here when the check completes.</p>
                </div>
              )}
            </section>
            <div hidden={this.activeSection !== 'installations'}>{this.renderInstallations()}</div>
            <div hidden={this.activeSection !== 'bridge'}>
              {this.renderLiveBridge(availableConnections)}
            </div>
            <div hidden={this.activeSection !== 'operation'}>{this.renderOperationRunner()}</div>
            <div hidden={this.activeSection !== 'runs'}>
              {this.renderRuns()}
              {this.preview && (
                <section className="gamecrafter-dcc-section gamecrafter-page-panel">
                  <h2>Artifact preview</h2>
                  <p className="gamecrafter-page-meta">
                    <span className="gamecrafter-page-meta-item">
                      Preview path <strong>{this.preview.sourcePath}</strong>
                    </span>
                  </p>
                  <pre>{JSON.stringify(this.preview, null, 2)}</pre>
                </section>
              )}
            </div>
          </>
        )}
      </div>
    );
  }

  private renderInstallations(): React.ReactNode {
    const installations = this.installations.filter((entry) => entry.tool === this.tool);
    return (
      <section className="gamecrafter-dcc-section gamecrafter-page-panel">
        <h2>Installations</h2>
        {installations.length === 0 ? (
          <p className="gamecrafter-page-empty">
            No {this.tool} installation is registered. Add a local executable to enable compatible
            headless operations.
          </p>
        ) : (
          <p className="gamecrafter-page-meta">
            <span className="gamecrafter-page-meta-item">
              Registered <strong>{installations.length}</strong>
            </span>
            <span className="gamecrafter-page-meta-item">
              Manual{' '}
              <strong>{installations.filter((entry) => entry.source === 'manual').length}</strong>
            </span>
          </p>
        )}
        {installations.length > 0 && (
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
        )}
        <details className="gamecrafter-page-advanced">
          <summary>Register a manual installation</summary>
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
        </details>
      </section>
    );
  }

  private renderCapabilities(report: DccCapabilityReport): React.ReactNode {
    return (
      <section className="gamecrafter-dcc-section gamecrafter-page-panel">
        <h2>{report.tool} capability report</h2>
        <div className="gamecrafter-page-meta" aria-label="DCC capability metadata">
          <span className="gamecrafter-page-meta-item">
            Operating system <strong>{report.osSupport.os}</strong>
          </span>
          <span className="gamecrafter-page-meta-item">
            Headless support <strong>{report.osSupport.headless}</strong>
          </span>
          <span className="gamecrafter-page-meta-item">
            Live bridge support <strong>{report.osSupport.liveBridge}</strong>
          </span>
        </div>
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
        {report.operations.length === 0 ? (
          <p className="gamecrafter-page-empty">No operations are reported for this DCC tool.</p>
        ) : (
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
        )}
      </section>
    );
  }

  private renderLiveBridge(connections: McpConnectionListEntry[]): React.ReactNode {
    return (
      <section className="gamecrafter-dcc-section gamecrafter-page-panel">
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
        <p className="gamecrafter-page-meta">
          <span className="gamecrafter-page-meta-item">
            Bound connection{' '}
            <strong>
              {connections.find((entry) => entry.config.connectionId === this.selectedBridgeId)
                ?.config.name ?? 'None'}
            </strong>
          </span>
          <span className="gamecrafter-page-meta-item">
            Eligible connections <strong>{connections.length}</strong>
          </span>
        </p>
        {connections.length === 0 && (
          <p className="gamecrafter-page-empty">
            No MCP connection is tagged for this tool's live bridge.
          </p>
        )}
      </section>
    );
  }

  private renderOperationRunner(): React.ReactNode {
    const fields = dccOperationFormFields(this.selectedOperation);
    return (
      <section className="gamecrafter-dcc-section gamecrafter-page-panel">
        <h2>Run operation</h2>
        <p>
          Choose an operation, provide any Project-relative inputs, and review its side effects
          first.
        </p>
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
              {field === 'script' ? 'Python code' : humanizeField(field)}
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
      <section className="gamecrafter-dcc-section gamecrafter-page-panel">
        <h2>Runs</h2>
        <p className="gamecrafter-page-meta">
          <span className="gamecrafter-page-meta-item">
            Recent runs <strong>{this.runs.length}</strong>
          </span>
          <span className="gamecrafter-page-meta-item">
            Selected run <strong>{this.selectedRun?.status ?? 'None'}</strong>
          </span>
        </p>
        {this.runs.length === 0 ? (
          <p className="gamecrafter-page-empty">
            No DCC runs yet. Choose an operation to start one.
          </p>
        ) : (
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
        )}
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

  private activateSection(section: DccSection): void {
    this.activeSection = section;
    this.update();
  }

  private async loadProject(refreshCapabilities = false): Promise<void> {
    const projectId = this.selectedProjectId;
    const tool = this.tool;
    const version = ++this.projectLoadVersion;
    this.report = undefined;
    this.runs = [];
    this.connections = [];
    const context = `${projectId}/${tool}`;
    if (context !== this.loadedContext || !projectId) {
      this.selectedRun = undefined;
      this.selectedBridgeId = '';
      this.artifactContents.clear();
      this.resultMessage = undefined;
    }
    this.loadedContext = context;
    this.errorMessage = undefined;
    this.update();
    if (!projectId) return;
    try {
      const [report, runs, connections] = await Promise.all([
        this.service.getDccCapabilities(projectId, tool, refreshCapabilities),
        this.service.listDccRuns(projectId, tool, 100),
        this.service.listMcpConnections(projectId),
      ]);
      if (
        version !== this.projectLoadVersion ||
        projectId !== this.selectedProjectId ||
        tool !== this.tool ||
        this.isDisposed
      )
        return;
      this.report = report;
      this.runs = runs;
      this.connections = connections;
      this.selectedBridgeId = report.layers['live-bridge'].connectionId ?? '';
    } catch (error) {
      if (
        version !== this.projectLoadVersion ||
        projectId !== this.selectedProjectId ||
        tool !== this.tool ||
        this.isDisposed
      )
        return;
      this.errorMessage = error instanceof Error ? error.message : String(error);
    }
    this.update();
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
      this.activeSection = 'runs';
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

function humanizeField(value: string): string {
  return value
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/[-_]/g, ' ')
    .replace(/^./, (character) => character.toUpperCase());
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

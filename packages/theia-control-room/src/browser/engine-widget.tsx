import React from 'react';
import { inject, injectable } from '@theia/core/shared/inversify';
import { Message } from '@theia/core/lib/browser/widgets/widget';
import { ControlRoomReactWidget } from './control-room-react-widget';
import type {
  EngineCapabilityReport,
  EngineFamily,
  EngineInstallation,
  EngineOperation,
  EngineOperationRun,
} from '@gamecrafter/contracts';
import {
  ControlRoomService,
  type ControlRoomService as ControlRoomServiceApi,
} from '../common/control-room-protocol';
import { ControlRoomClientEvents } from './control-room-client';

interface OperationField {
  name: string;
  type?: 'text' | 'number' | 'checkbox' | 'select';
  options?: string[];
}

type EngineSection = 'capabilities' | 'installations' | 'bridge' | 'operations' | 'runs';

const operationFields: Partial<Record<EngineOperation, OperationField[]>> = {
  check: [{ name: 'path' }],
  build: [{ name: 'method' }, { name: 'platform' }],
  test: [
    { name: 'path' },
    { name: 'testPlatform', type: 'select', options: ['EditMode', 'PlayMode'] },
    { name: 'method' },
    { name: 'filter' },
    { name: 'commandlet' },
  ],
  run: [{ name: 'scene' }, { name: 'quitAfter', type: 'number' }, { name: 'method' }],
  export: [{ name: 'preset' }, { name: 'output' }, { name: 'release', type: 'checkbox' }],
  validate: [{ name: 'commandlet' }],
  'edit-scene': [{ name: 'scene' }, { name: 'action' }],
  console: [{ name: 'command' }],
};

@injectable()
export class EngineWidget extends ControlRoomReactWidget {
  static readonly ID = 'gamecrafter.engine';

  private projects: Array<{ projectId: string; name: string; family: EngineFamily }> = [];
  private selectedProjectId = '';
  private report?: EngineCapabilityReport;
  private installations: EngineInstallation[] = [];
  private liveConnections: Array<{ connectionId: string; name: string }> = [];
  private selectedBridgeId = '';
  private runs: EngineOperationRun[] = [];
  private selectedRun?: EngineOperationRun;
  private selectedOperation?: EngineOperation;
  private activeSection: EngineSection = 'capabilities';
  private readonly logContents = new Map<string, string>();
  private runParams: Record<string, Record<string, string | number | boolean>> = {};
  private installationFamily: EngineFamily = 'godot';
  private installationKind: EngineInstallation['kind'] = 'cli';
  private executable = '';
  private busy = false;
  private errorMessage?: string;
  private resultMessage?: string;

  constructor(
    @inject(ControlRoomService)
    private readonly service: ControlRoomServiceApi,
    @inject(ControlRoomClientEvents)
    private readonly clientEvents: ControlRoomClientEvents,
  ) {
    super();
    this.id = EngineWidget.ID;
    this.title.label = 'Engine';
    this.title.iconClass = 'codicon codicon-tools';
    this.title.closable = true;
    this.toDispose.push(
      this.clientEvents.projectChanged(() => {
        void this.refresh();
      }),
    );
    this.toDispose.push(
      this.clientEvents.engineCapabilitiesChanged(({ projectId, report }) => {
        if (projectId !== this.selectedProjectId) return;
        this.report = report;
        this.update();
      }),
    );
    this.toDispose.push(
      this.clientEvents.engineRunChanged(({ projectId, run }) => {
        if (projectId !== this.selectedProjectId) return;
        this.runs = [run, ...this.runs.filter((entry) => entry.runId !== run.runId)].slice(0, 200);
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
    const selectedProject = this.projects.find(
      (project) => project.projectId === this.selectedProjectId,
    );
    const familyInstallations = this.installations.filter(
      (entry) => !selectedProject || entry.family === selectedProject.family,
    );
    const availableOperations =
      this.report?.operations.filter((entry) => entry.available).length ?? 0;
    return (
      <div className="gamecrafter-engine gamecrafter-surface">
        <header className="gamecrafter-engine-header gamecrafter-page-header">
          <div>
            <h1>Engine</h1>
            <p>
              Project files, headless processes, and live editors are reported as separate
              capability layers.
            </p>
          </div>
          <button
            className="theia-button"
            disabled={this.busy}
            onClick={() => void this.refresh(true)}
          >
            Refresh
          </button>
        </header>
        <div className="gamecrafter-engine-project gamecrafter-page-meta">
          <label>
            Project
            <select
              aria-label="Engine Project"
              value={this.selectedProjectId}
              onChange={(event) => {
                this.markProjectSelection();
                this.selectedProjectId = event.currentTarget.value;
                this.selectedRun = undefined;
                void this.loadProject();
              }}
            >
              <option value="">Select a Project</option>
              {this.projects.map((project) => (
                <option key={project.projectId} value={project.projectId}>
                  {project.name} ({project.family})
                </option>
              ))}
            </select>
          </label>
          {selectedProject && (
            <span className="gamecrafter-page-meta-item">
              Engine family <strong>{selectedProject.family}</strong>
            </span>
          )}
        </div>
        {this.errorMessage && (
          <p className="gamecrafter-engine-error" role="alert">
            {this.errorMessage}
          </p>
        )}
        {this.resultMessage && (
          <p className="gamecrafter-engine-result" role="status">
            {this.resultMessage}
          </p>
        )}
        {!this.selectedProjectId ? (
          <div className="gamecrafter-page-empty">
            <h2>Select a Project</h2>
            <p>Choose a Project to inspect engine readiness, installations, and recent runs.</p>
          </div>
        ) : (
          <>
            <section
              className="gamecrafter-work-guidance gamecrafter-page-guidance"
              aria-label="Engine next steps"
            >
              <div>
                <strong>What to do next</strong>
                <p>
                  {familyInstallations.length === 0
                    ? `Register a ${selectedProject?.family ?? 'matching'} installation if this Project needs a local engine tool.`
                    : !this.report
                      ? 'Wait for the capability report, then check the readiness of each engine layer.'
                      : availableOperations > 0
                        ? 'Review operation availability and side effects before configuring a run.'
                        : 'Review capability evidence and connect a live editor bridge if an operation requires one.'}
                </p>
              </div>
              {familyInstallations.length === 0 && (
                <button type="button" onClick={() => this.activateSection('installations')}>
                  Add installation
                </button>
              )}
              {availableOperations > 0 && (
                <button type="button" onClick={() => this.activateSection('operations')}>
                  Review operations ({availableOperations})
                </button>
              )}
            </section>
            <nav className="gamecrafter-section-nav" aria-label="Engine views">
              {(
                [
                  ['capabilities', 'Capabilities', this.report?.operations.length ?? 0],
                  ['installations', 'Installations', familyInstallations.length],
                  ['bridge', 'Live bridge', this.liveConnections.length],
                  ['operations', 'Operations', this.report?.operations.length ?? 0],
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
              className="gamecrafter-engine-section"
              hidden={this.activeSection !== 'capabilities'}
            >
              {this.report ? (
                this.renderReport(this.report)
              ) : (
                <div className="gamecrafter-page-empty" role="status">
                  <h2>Checking engine capabilities</h2>
                  <p>
                    Capability layers and operation readiness appear here when the check completes.
                  </p>
                </div>
              )}
            </section>
            <div hidden={this.activeSection !== 'installations'}>{this.renderInstallations()}</div>
            <div hidden={this.activeSection !== 'bridge'}>{this.renderBridge()}</div>
            <div hidden={this.activeSection !== 'operations'}>{this.renderOperations()}</div>
            <div hidden={this.activeSection !== 'runs'}>{this.renderRuns()}</div>
          </>
        )}
      </div>
    );
  }

  private renderReport(report: EngineCapabilityReport): React.ReactNode {
    return (
      <section className="gamecrafter-engine-section gamecrafter-page-panel">
        <h2>{report.family} capability report</h2>
        <div className="gamecrafter-page-meta" aria-label="Capability report metadata">
          <span className="gamecrafter-page-meta-item">
            Project identity{' '}
            <strong>{report.projectIdentity.proven ? 'Proven' : 'Unproven'}</strong>
          </span>
          <span className="gamecrafter-page-meta-item">
            Detected version <strong>{report.engineVersion.detected ?? 'Not detected'}</strong>
          </span>
          <span className="gamecrafter-page-meta-item">
            Preferred version <strong>{report.engineVersion.preferred ?? 'Not set'}</strong>
          </span>
          <span className="gamecrafter-page-meta-item">
            Version match{' '}
            <strong>
              {report.engineVersion.matches === null
                ? 'Unknown'
                : report.engineVersion.matches
                  ? 'Yes'
                  : 'No'}
            </strong>
          </span>
        </div>
        <div className="gamecrafter-engine-layer-list">
          {(['project-file', 'headless-process', 'live-editor'] as const).map((layer) => (
            <div className="gamecrafter-engine-layer" key={layer}>
              <span>{layer}</span>
              <strong
                className={`gamecrafter-engine-status gamecrafter-engine-status-${report.layers[layer].status}`}
              >
                {report.layers[layer].status}
              </strong>
              <small>{report.layers[layer].detail}</small>
            </div>
          ))}
        </div>
        <details className="gamecrafter-page-advanced">
          <summary>Identity evidence ({report.projectIdentity.evidence.length})</summary>
          {report.projectIdentity.evidence.length === 0 ? (
            <p className="gamecrafter-page-empty">No identity evidence was reported.</p>
          ) : (
            <ul className="gamecrafter-engine-evidence">
              {report.projectIdentity.evidence.map((entry, index) => (
                <li key={`${entry.ref}-${index}`}>
                  <code>{entry.ref}</code> — {entry.detail}
                </li>
              ))}
            </ul>
          )}
        </details>
      </section>
    );
  }

  private renderInstallations(): React.ReactNode {
    const family = this.projects.find(
      (project) => project.projectId === this.selectedProjectId,
    )?.family;
    const installations = this.installations.filter((entry) => !family || entry.family === family);
    return (
      <section className="gamecrafter-engine-section gamecrafter-page-panel">
        <h2>Engine installations</h2>
        <p>
          Register the engine tools PlayWeld should run. This is not the game-project folder: Unreal
          project files must be inside the selected PlayWeld Project's <code>game/</code> directory.
          Use <code>RunUAT.bat</code> for builds and <code>UnrealEditor-Cmd.exe</code> for
          commandlet operations.
        </p>
        {installations.length === 0 ? (
          <p className="gamecrafter-page-empty">
            No {family ?? 'matching'} installations are registered. Add a local executable if this
            Project needs engine operations.
          </p>
        ) : (
          <p className="gamecrafter-page-meta">
            <span className="gamecrafter-page-meta-item">
              Registered installations <strong>{installations.length}</strong>
            </span>
            <span className="gamecrafter-page-meta-item">
              Managed by PlayWeld{' '}
              <strong>{installations.filter((entry) => entry.source === 'manual').length}</strong>
            </span>
          </p>
        )}
        <details className="gamecrafter-page-advanced">
          <summary>Register a manual installation</summary>
          <form
            className="gamecrafter-engine-install-form"
            onSubmit={(event) => {
              event.preventDefault();
              void this.withBusy(async () => {
                await this.service.addEngineInstallation({
                  family: this.installationFamily,
                  executable: this.executable.trim(),
                  kind: this.installationKind,
                });
                this.executable = '';
                await this.refresh(true);
                this.resultMessage = 'Engine installation added.';
              });
            }}
          >
            <label>
              Family
              <select
                value={this.installationFamily}
                onChange={(event) => {
                  this.installationFamily = event.currentTarget.value as EngineFamily;
                  this.update();
                }}
              >
                <option value="godot">Godot</option>
                <option value="unity">Unity</option>
                <option value="unreal">Unreal</option>
              </select>
            </label>
            <label>
              Kind
              <select
                value={this.installationKind}
                onChange={(event) => {
                  this.installationKind = event.currentTarget.value as EngineInstallation['kind'];
                  this.update();
                }}
              >
                <option value="cli">CLI</option>
                <option value="editor">Editor</option>
                <option value="uat">UAT</option>
                <option value="commandlet">Commandlet</option>
              </select>
            </label>
            <label>
              Executable
              <input
                aria-label="Engine executable"
                value={this.executable}
                onChange={(event) => {
                  this.executable = event.currentTarget.value;
                  this.update();
                }}
                placeholder="Absolute executable path"
              />
            </label>
            <button
              className="theia-button"
              type="submit"
              disabled={this.busy || !this.executable.trim()}
            >
              Add installation
            </button>
          </form>
        </details>
        {installations.length > 0 && (
          <table className="gamecrafter-engine-table">
            <thead>
              <tr>
                <th>Version</th>
                <th>Kind</th>
                <th>Source</th>
                <th>Executable</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {installations.map((installation) => (
                <tr key={installation.installationId}>
                  <td>{installation.version ?? 'unknown'}</td>
                  <td>{installation.kind}</td>
                  <td>{installation.source}</td>
                  <td>
                    <code>{installation.executable}</code>
                  </td>
                  <td>
                    <button
                      className="theia-button secondary"
                      disabled={this.busy || installation.source !== 'manual'}
                      onClick={() =>
                        void this.withBusy(async () => {
                          await this.service.removeEngineInstallation(installation.installationId);
                          await this.refresh(true);
                        })
                      }
                    >
                      Remove
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    );
  }

  private renderBridge(): React.ReactNode {
    return (
      <section className="gamecrafter-engine-section gamecrafter-page-panel">
        <h2>Live editor bridge</h2>
        <label>
          Connection
          <select
            aria-label="Engine live editor bridge"
            value={this.selectedBridgeId}
            onChange={(event) => {
              const connectionId = event.currentTarget.value || null;
              this.selectedBridgeId = event.currentTarget.value;
              void this.withBusy(async () => {
                await this.service.setEngineLiveBridge(this.selectedProjectId, connectionId);
                await this.loadProject();
              });
            }}
          >
            <option value="">No live bridge</option>
            {this.liveConnections.map((connection) => (
              <option key={connection.connectionId} value={connection.connectionId}>
                {connection.name}
              </option>
            ))}
          </select>
        </label>
        <small>
          Only connected MCP connections tagged live-editor are considered. Project identity must be
          proven by the bridge before live operations are ready.
        </small>
        <p className="gamecrafter-page-meta">
          <span className="gamecrafter-page-meta-item">
            Bound connection{' '}
            <strong>
              {this.liveConnections.find((entry) => entry.connectionId === this.selectedBridgeId)
                ?.name ?? 'None'}
            </strong>
          </span>
          <span className="gamecrafter-page-meta-item">
            Eligible connections <strong>{this.liveConnections.length}</strong>
          </span>
        </p>
        {this.liveConnections.length === 0 && (
          <p className="gamecrafter-page-empty">
            No connected MCP connections are tagged for live-editor operations.
          </p>
        )}
      </section>
    );
  }

  private renderOperations(): React.ReactNode {
    const operations = this.report?.operations ?? [];
    return (
      <section className="gamecrafter-engine-section gamecrafter-page-panel">
        <h2>Operations</h2>
        {this.report && (
          <p className="gamecrafter-page-meta">
            <span className="gamecrafter-page-meta-item">
              Available <strong>{operations.filter((entry) => entry.available).length}</strong>
            </span>
            <span className="gamecrafter-page-meta-item">
              Unavailable <strong>{operations.filter((entry) => !entry.available).length}</strong>
            </span>
          </p>
        )}
        {operations.length === 0 ? (
          <p className="gamecrafter-page-empty">
            No engine operations are reported for this Project.
          </p>
        ) : (
          <table className="gamecrafter-engine-table">
            <thead>
              <tr>
                <th>Operation</th>
                <th>Mode</th>
                <th>Available</th>
                <th>Side effects</th>
                <th>Command / reason</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {operations.map((operation) => (
                <tr key={operation.operation}>
                  <td>{operation.operation}</td>
                  <td>{operation.executionMode}</td>
                  <td>{operation.available ? 'Yes' : 'No'}</td>
                  <td>{operation.sideEffects}</td>
                  <td>
                    <code>{operation.command ?? operation.reason ?? operation.evidence}</code>
                  </td>
                  <td>
                    <button
                      className="theia-button"
                      disabled={this.busy || !operation.available}
                      onClick={() => {
                        this.selectedOperation = operation.operation;
                        this.update();
                      }}
                    >
                      Configure / Run
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        {this.selectedOperation && (
          <div className="gamecrafter-engine-run-form gamecrafter-page-panel">
            <h3>Run {this.selectedOperation}</h3>
            <p>
              Confirm the operation, its side effects, and the Project-relative paths before
              running.
            </p>
            <details className="gamecrafter-page-advanced">
              <summary>Configure optional parameters</summary>
              {this.renderOperationFields(this.selectedOperation)}
            </details>
            <button
              className="theia-button"
              disabled={this.busy}
              onClick={() => void this.runOperation(this.selectedOperation!)}
            >
              Run operation
            </button>
          </div>
        )}
      </section>
    );
  }

  private renderOperationFields(operation: EngineOperation): React.ReactNode {
    const fields = operationFields[operation] ?? [];
    if (fields.length === 0) return <p>This operation requires no additional parameters.</p>;
    const values = this.runParams[operation] ?? {};
    return (
      <div className="gamecrafter-engine-param-grid">
        {fields.map((field) => (
          <label key={field.name}>
            {humanizeField(field.name)}
            {field.type === 'checkbox' ? (
              <input
                type="checkbox"
                checked={Boolean(values[field.name])}
                onChange={(event) =>
                  this.setParam(operation, field.name, event.currentTarget.checked)
                }
              />
            ) : field.type === 'select' ? (
              <select
                value={String(values[field.name] ?? field.options?.[0] ?? '')}
                onChange={(event) =>
                  this.setParam(operation, field.name, event.currentTarget.value)
                }
              >
                {(field.options ?? []).map((option) => (
                  <option key={option}>{option}</option>
                ))}
              </select>
            ) : (
              <input
                type={field.type ?? 'text'}
                value={String(values[field.name] ?? '')}
                onChange={(event) =>
                  this.setParam(
                    operation,
                    field.name,
                    field.type === 'number'
                      ? Number(event.currentTarget.value)
                      : event.currentTarget.value,
                  )
                }
              />
            )}
          </label>
        ))}
      </div>
    );
  }

  private renderRuns(): React.ReactNode {
    return (
      <section className="gamecrafter-engine-section gamecrafter-page-panel">
        <h2>Runs</h2>
        <p className="gamecrafter-page-meta">
          <span className="gamecrafter-page-meta-item">
            Recent runs <strong>{this.runs.length}</strong>
          </span>
          {this.selectedRun && (
            <span className="gamecrafter-page-meta-item">
              Selected status <strong>{this.selectedRun.status}</strong>
            </span>
          )}
        </p>
        {this.runs.length === 0 ? (
          <p className="gamecrafter-page-empty">
            No engine runs yet. Review available operations to start one.
          </p>
        ) : (
          <table className="gamecrafter-engine-table">
            <thead>
              <tr>
                <th>Started</th>
                <th>Operation</th>
                <th>Status</th>
                <th>Exit</th>
                <th>Summary</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {this.runs.map((run) => (
                <tr key={run.runId}>
                  <td>{new Date(run.startedAt).toLocaleString()}</td>
                  <td>{run.operation}</td>
                  <td>{run.status}</td>
                  <td>{run.exitCode ?? '—'}</td>
                  <td>{run.summary}</td>
                  <td>
                    <button
                      className="theia-button secondary"
                      onClick={() => void this.loadRun(run.runId)}
                    >
                      View logs
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        {this.selectedRun && (
          <div className="gamecrafter-engine-run-details">
            <h3>Run {this.selectedRun.runId}</h3>
            <pre>{JSON.stringify(this.selectedRun, null, 2)}</pre>
            {this.selectedRun.artifacts
              .filter((artifact) => artifact.kind === 'log')
              .map((artifact) => (
                <div key={artifact.path}>
                  <strong>{artifact.path}</strong>
                  <pre>{this.logContents.get(artifact.path) ?? ''}</pre>
                </div>
              ))}
          </div>
        )}
      </section>
    );
  }

  private async refresh(refreshReport = false): Promise<void> {
    try {
      const [projects, installations] = await Promise.all([
        this.service.listProjects(),
        this.service.listEngineInstallations(),
      ]);
      this.projects = projects.map((project) => ({
        projectId: project.projectId,
        name: project.name,
        family: project.engine.family,
      }));
      this.selectedProjectId =
        (await this.resolveProjectSelection(projects, () => this.selectedProjectId)) || '';
      this.installations = installations;
      if (this.selectedProjectId) await this.loadProject(refreshReport);
    } catch (error) {
      this.errorMessage = errorMessage(error);
    }
    this.update();
  }

  private async loadProject(refresh = false): Promise<void> {
    if (!this.selectedProjectId) return;
    try {
      const [report, runs, connections] = await Promise.all([
        this.service.getEngineCapabilities(this.selectedProjectId, refresh),
        this.service.listEngineRuns(this.selectedProjectId, 100),
        this.service.listMcpConnections(this.selectedProjectId),
      ]);
      this.report = report;
      this.runs = runs;
      this.liveConnections = connections
        .filter((entry) => entry.config.tags.includes('live-editor'))
        .map((entry) => ({ connectionId: entry.config.connectionId, name: entry.config.name }));
      this.selectedBridgeId = report.liveBridge?.connectionId ?? this.selectedBridgeId;
    } catch (error) {
      this.errorMessage = errorMessage(error);
    }
    this.update();
  }

  private setParam(
    operation: EngineOperation,
    name: string,
    value: string | number | boolean,
  ): void {
    this.runParams = {
      ...this.runParams,
      [operation]: { ...(this.runParams[operation] ?? {}), [name]: value },
    };
    this.update();
  }

  private activateSection(section: EngineSection): void {
    this.activeSection = section;
    this.update();
  }

  private async runOperation(operation: EngineOperation): Promise<void> {
    const values = this.runParams[operation] ?? {};
    const params = Object.fromEntries(
      Object.entries(values).filter(([, value]) => value !== '' && value !== undefined),
    );
    await this.withBusy(async () => {
      const run = await this.service.runEngine({
        projectId: this.selectedProjectId,
        operation,
        params,
      });
      this.selectedRun = run;
      this.activeSection = 'runs';
      this.runs = [run, ...this.runs.filter((entry) => entry.runId !== run.runId)].slice(0, 200);
      await this.loadRunLogs(run);
      this.resultMessage = `Engine ${operation} ${run.status}: ${run.summary}`;
    });
  }

  private async loadRun(runId: string): Promise<void> {
    await this.withBusy(async () => {
      this.selectedRun = await this.service.getEngineRun(this.selectedProjectId, runId);
      await this.loadRunLogs(this.selectedRun);
    });
  }

  private async loadRunLogs(run: EngineOperationRun): Promise<void> {
    const logs = run.artifacts.filter((artifact) => artifact.kind === 'log');
    const entries = await Promise.all(
      logs.map(async (artifact) => {
        const call = await this.service.callTool(this.selectedProjectId, 'fs/read-file', {
          path: artifact.path,
        });
        return [
          artifact.path,
          isRecord(call.output) && typeof call.output.content === 'string'
            ? call.output.content
            : '',
        ] as const;
      }),
    );
    this.logContents.clear();
    for (const [artifactPath, content] of entries) this.logContents.set(artifactPath, content);
  }

  private async withBusy(operation: () => Promise<void>): Promise<void> {
    if (this.busy) return;
    this.busy = true;
    this.errorMessage = undefined;
    this.update();
    try {
      await operation();
    } catch (error) {
      this.errorMessage = errorMessage(error);
    } finally {
      this.busy = false;
      this.update();
    }
  }
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
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

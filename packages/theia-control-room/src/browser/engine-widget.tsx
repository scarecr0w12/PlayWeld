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
    return (
      <div className="gamecrafter-engine gamecrafter-surface">
        <header className="gamecrafter-engine-header">
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
        <label className="gamecrafter-engine-project">
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
          <p>Select a Project to inspect its engine capabilities.</p>
        ) : (
          <>
            {this.report ? this.renderReport(this.report) : <p>Loading engine capabilities…</p>}
            {this.renderInstallations()}
            {this.renderBridge()}
            {this.renderOperations()}
            {this.renderRuns()}
          </>
        )}
      </div>
    );
  }

  private renderReport(report: EngineCapabilityReport): React.ReactNode {
    return (
      <section className="gamecrafter-engine-section">
        <h2>{report.family} capability report</h2>
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
        <p>
          <strong>Identity:</strong> {report.projectIdentity.proven ? 'proven' : 'unproven'}
          {' · '}
          <strong>Version:</strong> {report.engineVersion.detected ?? 'not detected'}
          {' · '}
          <strong>Preferred:</strong> {report.engineVersion.preferred ?? 'not set'}
          {' · '}
          <strong>Match:</strong>{' '}
          {report.engineVersion.matches === null
            ? 'unknown'
            : report.engineVersion.matches
              ? 'yes'
              : 'no'}
        </p>
        <ul className="gamecrafter-engine-evidence">
          {report.projectIdentity.evidence.map((entry, index) => (
            <li key={`${entry.ref}-${index}`}>
              <code>{entry.ref}</code> — {entry.detail}
            </li>
          ))}
        </ul>
      </section>
    );
  }

  private renderInstallations(): React.ReactNode {
    const family = this.projects.find(
      (project) => project.projectId === this.selectedProjectId,
    )?.family;
    const installations = this.installations.filter((entry) => !family || entry.family === family);
    return (
      <section className="gamecrafter-engine-section">
        <h2>Engine installations</h2>
        <p>
          Register the engine tools PlayWeld should run. This is not the game-project folder: Unreal
          project files must be inside the selected PlayWeld Project's <code>game/</code> directory.
          Use <code>RunUAT.bat</code> for builds and <code>UnrealEditor-Cmd.exe</code> for
          commandlet operations.
        </p>
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
        {installations.length === 0 ? (
          <p>No installations detected for this Project's engine family.</p>
        ) : (
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
      <section className="gamecrafter-engine-section">
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
      </section>
    );
  }

  private renderOperations(): React.ReactNode {
    const operations = this.report?.operations ?? [];
    return (
      <section className="gamecrafter-engine-section">
        <h2>Operations</h2>
        {operations.length === 0 ? (
          <p>No operations are reported.</p>
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
          <div className="gamecrafter-engine-run-form">
            <h3>Run {this.selectedOperation}</h3>
            {this.renderOperationFields(this.selectedOperation)}
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
            {field.name}
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
      <section className="gamecrafter-engine-section">
        <h2>Runs</h2>
        {this.runs.length === 0 ? (
          <p>No engine operations have been run.</p>
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

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

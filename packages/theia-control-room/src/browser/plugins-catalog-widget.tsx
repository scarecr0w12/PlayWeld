import React from 'react';
import { inject, injectable } from '@theia/core/shared/inversify';
import { CommandService } from '@theia/core/lib/common/command';
import { Message } from '@theia/core/lib/browser/widgets/widget';
import { ControlRoomReactWidget } from './control-room-react-widget';
import type {
  DeclarativePanel,
  DeclarativePanelSection,
  IsolationReport,
  PluginCapability,
  PluginInspection,
  PluginListEntry,
  PluginLogEntry,
  PluginModulesResult,
  ProjectSummary,
  ToolDefinition,
} from '@gamecrafter/contracts';
import {
  ControlRoomService,
  type ControlRoomService as ControlRoomServiceApi,
} from '../common/control-room-protocol';
import { ControlRoomClientEvents } from './control-room-client';

const THEIA_EXTENSIONS_COMMAND = 'vsxExtensions.toggle';
type CatalogTab = 'platform' | 'editor';
type FormValue = string | number | boolean | unknown[] | Record<string, unknown>;

@injectable()
export class PluginsCatalogWidget extends ControlRoomReactWidget {
  static readonly ID = 'gamecrafter.plugins';

  private projects: ProjectSummary[] = [];
  private selectedProjectId?: string;
  private refreshVersion = 0;
  private plugins: PluginListEntry[] = [];
  private tools: ToolDefinition[] = [];
  private modules: PluginModulesResult = { modules: [], genres: [], conflicts: [] };
  private isolationReport?: IsolationReport;
  private selectedPluginId?: string;
  private selectedPanelId?: string;
  private panel?: DeclarativePanel;
  private panelOutputs = new Map<string, unknown>();
  private formValues = new Map<string, Record<string, FormValue>>();
  private logs = new Map<string, PluginLogEntry[]>();
  private source = '';
  private inspection?: PluginInspection;
  private capabilitiesAccepted = false;
  private tab: CatalogTab = 'platform';
  private activeSection: 'plugins' | 'install' | 'details' | 'modules' = 'plugins';
  private secretName = '';
  private secretValue = '';
  private confirmUninstallPluginId?: string;
  private errorMessage?: string;
  private resultMessage?: string;
  private busy = false;

  constructor(
    @inject(ControlRoomService)
    private readonly service: ControlRoomServiceApi,
    @inject(ControlRoomClientEvents)
    private readonly clientEvents: ControlRoomClientEvents,
    @inject(CommandService)
    private readonly commandService: CommandService,
  ) {
    super();
    this.id = PluginsCatalogWidget.ID;
    this.title.label = 'Plugins';
    this.title.iconClass = 'codicon codicon-extensions';
    this.title.closable = true;
    this.toDispose.push(
      this.clientEvents.pluginWorkerChanged(({ state }) => {
        this.plugins = this.plugins.map((entry) =>
          entry.installed.pluginId === state.pluginId &&
          (!this.selectedProjectId || state.projectId === this.selectedProjectId)
            ? { ...entry, worker: state }
            : entry,
        );
        if (this.selectedProjectId) {
          void this.refreshTools().catch((error: unknown) => {
            this.errorMessage = errorMessage(error);
            this.update();
          });
        } else {
          this.update();
        }
      }),
    );
    this.toDispose.push(
      this.clientEvents.pluginChanged(() => {
        void this.refresh();
      }),
    );
    this.toDispose.push(
      this.clientEvents.projectChanged(() => {
        void this.refresh();
      }),
    );
    void this.refresh();
  }

  protected onActivateRequest(message: Message): void {
    super.onActivateRequest(message);
    void this.refresh();
  }

  protected render(): React.ReactNode {
    const selected = this.plugins.find(
      (entry) => entry.installed.pluginId === this.selectedPluginId,
    );
    return (
      <div className="gamecrafter-plugins gamecrafter-surface">
        <header className="gamecrafter-plugins-header gamecrafter-page-header">
          <div>
            <h1>Plugins</h1>
            <p>
              PlayWeld plugins run in a separate worker and use explicitly accepted capabilities.
            </p>
          </div>
          <label>
            Project
            <select
              aria-label="Plugins Project"
              value={this.selectedProjectId ?? ''}
              onChange={(event) => {
                this.markProjectSelection();
                this.selectedProjectId = event.currentTarget.value || undefined;
                this.selectedPluginId = undefined;
                this.panel = undefined;
                void this.refresh();
              }}
            >
              <option value="">Platform plugins</option>
              {this.projects.map((project) => (
                <option key={project.projectId} value={project.projectId}>
                  {project.name}
                </option>
              ))}
            </select>
          </label>
          <button type="button" onClick={() => void this.refresh()}>
            Refresh
          </button>
        </header>

        <div className="gamecrafter-plugins-tabs" role="tablist" aria-label="Plugin catalog type">
          <button
            id="gamecrafter-plugin-tab-platform"
            type="button"
            role="tab"
            aria-controls="gamecrafter-plugin-panel-platform"
            aria-selected={this.tab === 'platform'}
            onClick={() => this.setTab('platform')}
          >
            Platform plugins
          </button>
          <button
            id="gamecrafter-plugin-tab-editor"
            type="button"
            role="tab"
            aria-controls="gamecrafter-plugin-panel-editor"
            aria-selected={this.tab === 'editor'}
            onClick={() => this.setTab('editor')}
          >
            Editor extensions
          </button>
        </div>

        {this.errorMessage && (
          <p className="gamecrafter-plugins-error" role="alert">
            {this.errorMessage}
          </p>
        )}
        {this.resultMessage && (
          <p className="gamecrafter-plugins-result" role="status">
            {this.resultMessage}
          </p>
        )}
        {this.isolationReport && (
          <p
            className={
              this.isolationReport.available
                ? 'gamecrafter-plugins-result'
                : 'gamecrafter-plugins-error'
            }
            role="status"
          >
            Isolation:{' '}
            {this.isolationReport.available
              ? `${this.isolationReport.backend} available`
              : `${this.isolationReport.platform} unavailable`}
          </p>
        )}
        <section className="gamecrafter-page-guidance gamecrafter-work-guidance">
          <div>
            <strong>
              {this.tab === 'platform'
                ? 'Review capabilities before installing'
                : 'Manage IDE extensions separately'}
            </strong>
            <p>
              {this.tab === 'platform'
                ? 'Platform plugins run in a separate worker; enable only what the Project needs.'
                : 'Theia extensions run in the editor host and use a separate install and trust system.'}
            </p>
          </div>
        </section>

        <section
          id="gamecrafter-plugin-panel-platform"
          role="tabpanel"
          aria-labelledby="gamecrafter-plugin-tab-platform"
          hidden={this.tab !== 'platform'}
        >
          <nav className="gamecrafter-section-nav" aria-label="Platform plugin sections">
            {(['plugins', 'install', 'details', 'modules'] as const).map((section) => (
              <button
                key={section}
                type="button"
                aria-controls={`gamecrafter-plugins-${section}`}
                aria-pressed={this.activeSection === section}
                disabled={section === 'details' && !selected}
                onClick={() => {
                  this.activeSection = section;
                  this.update();
                }}
              >
                {
                  {
                    plugins: 'Installed',
                    install: 'Install',
                    details: 'Selected plugin',
                    modules: 'Modules',
                  }[section]
                }
              </button>
            ))}
          </nav>
          {this.renderInstallFlow()}
          <section
            className="gamecrafter-plugins-section gamecrafter-page-panel"
            id="gamecrafter-plugins-plugins"
            hidden={this.activeSection !== 'plugins'}
          >
            <h2>Installed platform plugins</h2>
            {this.plugins.length === 0 ? (
              <p className="gamecrafter-page-empty">
                No platform plugins are installed. Inspect a manifest to review its capabilities
                before adding one.
              </p>
            ) : (
              <div className="gamecrafter-plugins-list">
                {this.plugins.map((entry) => this.renderPluginCard(entry))}
              </div>
            )}
          </section>
          {selected ? (
            this.renderPluginDetails(selected)
          ) : (
            <section
              className="gamecrafter-plugins-section gamecrafter-page-panel"
              id="gamecrafter-plugins-details"
              hidden={this.activeSection !== 'details'}
            >
              <p className="gamecrafter-page-empty">Select a plugin to inspect its details.</p>
            </section>
          )}
          {this.renderModuleCatalog()}
        </section>
        <section
          id="gamecrafter-plugin-panel-editor"
          role="tabpanel"
          aria-labelledby="gamecrafter-plugin-tab-editor"
          hidden={this.tab !== 'editor'}
        >
          {this.renderEditorExtensions()}
        </section>
      </div>
    );
  }

  private renderEditorExtensions(): React.ReactNode {
    return (
      <section className="gamecrafter-plugins-section gamecrafter-page-panel">
        <h2>Theia editor extensions</h2>
        <p>
          Use this view for IDE extensions only. Platform plugins have separate manifests, workers,
          and capability consent.
        </p>
        <button
          type="button"
          onClick={() => void this.commandService.executeCommand(THEIA_EXTENSIONS_COMMAND)}
        >
          Open Theia Extensions view
        </button>
      </section>
    );
  }

  private renderInstallFlow(): React.ReactNode {
    return (
      <section
        className="gamecrafter-plugins-section gamecrafter-page-panel"
        id="gamecrafter-plugins-install"
        hidden={this.activeSection !== 'install'}
      >
        <h2>Install a platform plugin</h2>
        <form
          className="gamecrafter-plugins-install-form"
          onSubmit={(event) => {
            event.preventDefault();
            void this.inspectSource();
          }}
        >
          <label className="gamecrafter-plugins-wide">
            Local directory, .tgz archive, or Git URL
            <input
              aria-label="Plugin source"
              value={this.source}
              placeholder="/path/to/plugin, plugin.tgz, or https://host/plugin.git"
              onChange={(event) => {
                this.source = event.currentTarget.value;
                this.inspection = undefined;
                this.update();
              }}
            />
          </label>
          <button type="submit" disabled={this.busy || !this.source.trim()}>
            Inspect source
          </button>
        </form>
        {this.inspection && (
          <div className="gamecrafter-plugin-review" aria-label="Plugin capability review">
            <h3>Review before installation</h3>
            <dl>
              <dt>Plugin</dt>
              <dd>
                {this.inspection.manifest.name} ({this.inspection.manifest.id}) v
                {this.inspection.manifest.version}
              </dd>
              <dt>Publisher</dt>
              <dd>{this.inspection.manifest.publisher.name}</dd>
              <dt>Signature</dt>
              <dd>{this.inspection.signature.status}</dd>
              <dt>SHA-256</dt>
              <dd className="gamecrafter-plugin-digest">{this.inspection.sha256}</dd>
              <dt>Source is executed during inspection</dt>
              <dd>No</dd>
            </dl>
            {this.inspection.warnings.map((warning) => (
              <p className="gamecrafter-plugins-warning" key={warning}>
                {warning}
              </p>
            ))}
            <h4>Requested capabilities</h4>
            <ul className="gamecrafter-plugin-capabilities">
              {this.inspection.capabilities.length === 0 ? (
                <li>No capabilities requested.</li>
              ) : (
                this.inspection.capabilities.map((capability, index) => (
                  <li key={`${capabilityName(capability)}-${index}`}>
                    <strong>{capabilityName(capability)}</strong>
                    <span>{capabilityExplanation(capability)}</span>
                    <small>Declared by this manifest</small>
                  </li>
                ))
              )}
            </ul>
            <label className="gamecrafter-plugins-checkbox">
              <input
                type="checkbox"
                checked={this.capabilitiesAccepted}
                onChange={(event) => {
                  this.capabilitiesAccepted = event.currentTarget.checked;
                  this.update();
                }}
              />
              I accept exactly these capabilities for this plugin.
            </label>
            <button
              type="button"
              disabled={this.busy || !this.capabilitiesAccepted}
              onClick={() => void this.installInspectedPlugin()}
            >
              Accept capabilities and install
            </button>
          </div>
        )}
      </section>
    );
  }

  private renderPluginCard(entry: PluginListEntry): React.ReactNode {
    const { installed, projectEnabled, worker } = entry;
    const pluginId = installed.pluginId;
    const projectEnabledForScope = projectEnabled === true;
    const enabledForProject = installed.enabled && projectEnabledForScope;
    const workerRunning = worker?.status === 'running';
    const signatureText = installed.signature.status;
    return (
      <article className="gamecrafter-plugin-card" key={pluginId}>
        <header>
          <div>
            <h3>
              <button
                type="button"
                className="gamecrafter-plugin-select"
                aria-current={pluginId === this.selectedPluginId ? 'true' : undefined}
                onClick={() => {
                  this.selectedPluginId = pluginId;
                  this.activeSection = 'details';
                  this.selectedPanelId = installed.manifest.contributes.ui.panels[0]?.id;
                  void this.loadSelectedPanel();
                }}
              >
                {installed.manifest.name}
              </button>
            </h3>
            <div className="gamecrafter-page-meta">
              <span className="gamecrafter-page-meta-item">{pluginId}</span>
              <span className="gamecrafter-page-meta-item">v{installed.version}</span>
              <span className="gamecrafter-page-meta-item">
                {installed.manifest.publisher.name}
              </span>
              <span className="gamecrafter-page-meta-item">Signature: {signatureText}</span>
            </div>
          </div>
          <span className={isolationClass(worker)}>{isolationLabel(worker)}</span>
        </header>
        <div className="gamecrafter-page-meta">
          <span className="gamecrafter-page-meta-item">Worker: {worker?.status ?? 'stopped'}</span>
          <span className="gamecrafter-page-meta-item">
            Runtime: {installed.manifest.runtime.kind}
          </span>
        </div>
        {worker?.lastError && (
          <details className="gamecrafter-page-advanced">
            <summary>Last worker error</summary>
            <p>{worker.lastError}</p>
          </details>
        )}
        <div className="gamecrafter-plugin-card-actions">
          <label className="gamecrafter-plugins-checkbox">
            <input
              type="checkbox"
              checked={installed.enabled}
              onChange={(event) =>
                void this.toggleEnabled(pluginId, 'platform', event.currentTarget.checked)
              }
            />
            Enabled on platform
          </label>
          {this.selectedProjectId && (
            <label className="gamecrafter-plugins-checkbox">
              <input
                type="checkbox"
                checked={projectEnabledForScope}
                onChange={(event) =>
                  void this.toggleEnabled(pluginId, 'project', event.currentTarget.checked)
                }
              />
              Enabled for this Project
            </label>
          )}
          {this.selectedProjectId &&
            (workerRunning ? (
              <button type="button" disabled={this.busy} onClick={() => void this.stop(pluginId)}>
                Stop
              </button>
            ) : (
              <button
                type="button"
                disabled={this.busy || !enabledForProject}
                onClick={() => void this.start(pluginId)}
              >
                Start
              </button>
            ))}
          <button type="button" onClick={() => void this.loadLogs(pluginId)}>
            Logs
          </button>
          {this.confirmUninstallPluginId === pluginId ? (
            <>
              <button
                type="button"
                disabled={this.busy}
                onClick={() => void this.uninstall(pluginId)}
              >
                Confirm uninstall
              </button>
              <button type="button" onClick={() => this.confirmUninstall(undefined)}>
                Cancel
              </button>
            </>
          ) : (
            <button type="button" onClick={() => this.confirmUninstall(pluginId)}>
              Uninstall
            </button>
          )}
        </div>
      </article>
    );
  }

  private renderPluginDetails(entry: PluginListEntry): React.ReactNode {
    const plugin = entry.installed;
    const selectedPanel = plugin.manifest.contributes.ui.panels.find(
      (panel) => panel.id === this.selectedPanelId,
    );
    return (
      <section
        className="gamecrafter-plugins-section gamecrafter-page-panel"
        id="gamecrafter-plugins-details"
        hidden={this.activeSection !== 'details'}
      >
        <h2>{plugin.manifest.name} details</h2>
        <p>{plugin.manifest.description}</p>
        <details className="gamecrafter-page-advanced">
          <summary>Package provenance</summary>
          <div className="gamecrafter-page-meta">
            <span className="gamecrafter-page-meta-item">Source: {plugin.source.kind}</span>
            <span className="gamecrafter-page-meta-item">Reference: {plugin.source.ref}</span>
            <span className="gamecrafter-page-meta-item">SHA-256: {plugin.sha256}</span>
          </div>
        </details>
        <h3>Accepted capabilities</h3>
        {(plugin.trust?.acceptedCapabilities ?? []).length === 0 ? (
          <p className="gamecrafter-page-empty">No capabilities have been accepted.</p>
        ) : (
          <ul className="gamecrafter-plugin-capabilities">
            {(plugin.trust?.acceptedCapabilities ?? []).map((capability, index) => (
              <li key={`${capabilityName(capability)}-${index}`}>
                <strong>{capabilityName(capability)}</strong>
                <span>{capabilityExplanation(capability)}</span>
              </li>
            ))}
          </ul>
        )}
        {plugin.manifest.contributes.ui.panels.length > 0 && (
          <div className="gamecrafter-plugin-panel-picker">
            <label>
              Declarative panel
              <select
                aria-label="Plugin panel"
                value={this.selectedPanelId ?? ''}
                onChange={(event) => {
                  this.selectedPanelId = event.currentTarget.value || undefined;
                  this.panel = undefined;
                  void this.loadSelectedPanel();
                }}
              >
                {plugin.manifest.contributes.ui.panels.map((panel) => (
                  <option key={panel.id} value={panel.id}>
                    {panel.title}
                  </option>
                ))}
              </select>
            </label>
            <button type="button" onClick={() => void this.loadSelectedPanel()}>
              Load panel
            </button>
          </div>
        )}
        {this.panel && selectedPanel && this.renderPanelSections(this.panel)}
        {plugin.manifest.capabilities.some(
          (capability) => capabilityName(capability) === 'secrets.read',
        ) &&
          this.selectedProjectId && (
            <details className="gamecrafter-plugin-secret-form gamecrafter-page-advanced">
              <summary>Configure plugin secret</summary>
              <label>
                Secret name
                <input
                  aria-label="Plugin secret name"
                  value={this.secretName}
                  onChange={(event) => {
                    this.secretName = event.currentTarget.value;
                    this.update();
                  }}
                />
              </label>
              <label>
                Secret value
                <input
                  aria-label="Plugin secret value"
                  type="password"
                  value={this.secretValue}
                  onChange={(event) => {
                    this.secretValue = event.currentTarget.value;
                    this.update();
                  }}
                />
              </label>
              <button
                type="button"
                disabled={this.busy || !this.secretName.trim() || !this.secretValue}
                onClick={() => void this.saveSecret(plugin.pluginId)}
              >
                Save encrypted secret
              </button>
            </details>
          )}
        {this.logs.has(plugin.pluginId) && (
          <details className="gamecrafter-page-advanced">
            <summary>Worker logs ({this.logs.get(plugin.pluginId)?.length ?? 0})</summary>
            <pre className="gamecrafter-plugin-log">
              {(this.logs.get(plugin.pluginId) ?? [])
                .map((entry) => `${entry.at} [${entry.level}] ${entry.message}`)
                .join('\n') || 'No log entries.'}
            </pre>
          </details>
        )}
      </section>
    );
  }

  private renderPanelSections(panel: DeclarativePanel): React.ReactNode {
    return (
      <div className="gamecrafter-plugin-panel">
        <h3>{panel.title}</h3>
        {panel.sections.map((section, index) => (
          <section className="gamecrafter-plugin-panel-section" key={`${section.kind}-${index}`}>
            {this.renderPanelSection(section)}
          </section>
        ))}
      </div>
    );
  }

  private renderPanelSection(section: DeclarativePanelSection): React.ReactNode {
    if (section.kind === 'markdown') return <p>{section.body}</p>;
    const tool = this.tools.find((candidate) => candidate.toolId === section.toolId);
    if (!tool) return <p role="alert">Tool {section.toolId} is not registered for this Project.</p>;
    if (section.kind === 'tool-form') return this.renderToolForm(tool, section.submitLabel);
    return (
      <div>
        <button
          type="button"
          disabled={this.busy || !this.selectedProjectId}
          onClick={() => void this.runToolTable(tool)}
        >
          Load {tool.title}
        </button>
        {this.renderToolTable(section.columns, this.panelOutputs.get(tool.toolId))}
      </div>
    );
  }

  private renderToolForm(tool: ToolDefinition, submitLabel: string): React.ReactNode {
    const properties = getRecord(getRecord(tool.inputSchema).properties);
    const required = new Set(getStringArray(getRecord(tool.inputSchema).required));
    const values = this.formValues.get(tool.toolId) ?? {};
    return (
      <form
        className="gamecrafter-plugin-tool-form"
        onSubmit={(event) => {
          event.preventDefault();
          void this.runTool(tool, values);
        }}
      >
        <h4>{tool.title}</h4>
        {Object.entries(properties).map(([name, schema]) => {
          const fieldSchema = getRecord(schema);
          const label =
            typeof fieldSchema.title === 'string' ? fieldSchema.title : formatFieldName(name);
          return (
            <label key={name}>
              {label}
              {required.has(name) ? ' *' : ''}
              {typeof fieldSchema.description === 'string' && (
                <small>{fieldSchema.description}</small>
              )}
              {this.renderSchemaInput(tool.toolId, name, schema, values[name])}
            </label>
          );
        })}
        <button type="submit" disabled={this.busy || !this.selectedProjectId}>
          {submitLabel}
        </button>
        {this.panelOutputs.has(tool.toolId) && (
          <details className="gamecrafter-page-advanced">
            <summary>Last tool output</summary>
            <pre className="gamecrafter-plugin-tool-output">
              {JSON.stringify(this.panelOutputs.get(tool.toolId), null, 2)}
            </pre>
          </details>
        )}
      </form>
    );
  }

  private renderSchemaInput(
    toolId: string,
    name: string,
    schemaValue: unknown,
    currentValue: FormValue | undefined,
  ): React.ReactNode {
    const schema = getRecord(schemaValue);
    const options = Array.isArray(schema.enum) ? schema.enum : undefined;
    const value =
      currentValue ??
      (typeof schema.default === 'string' || typeof schema.default === 'number'
        ? schema.default
        : '');
    if (options) {
      return (
        <select
          aria-label={`Plugin tool ${toolId} ${name}`}
          value={String(value)}
          onChange={(event) => this.setFormValue(toolId, name, event.currentTarget.value)}
        >
          {options.map((option) => (
            <option key={String(option)} value={String(option)}>
              {String(option)}
            </option>
          ))}
        </select>
      );
    }
    if (schema.type === 'boolean') {
      return (
        <input
          type="checkbox"
          aria-label={`Plugin tool ${toolId} ${name}`}
          checked={Boolean(value)}
          onChange={(event) => this.setFormValue(toolId, name, event.currentTarget.checked)}
        />
      );
    }
    if (schema.type === 'object' || schema.type === 'array') {
      return (
        <textarea
          aria-label={`Plugin tool ${toolId} ${name}`}
          value={typeof value === 'string' ? value : JSON.stringify(value)}
          onChange={(event) => this.setFormValue(toolId, name, event.currentTarget.value)}
        />
      );
    }
    return (
      <input
        aria-label={`Plugin tool ${toolId} ${name}`}
        type={schema.type === 'integer' || schema.type === 'number' ? 'number' : 'text'}
        value={String(value)}
        onChange={(event) => {
          const inputValue = event.currentTarget.value;
          this.setFormValue(
            toolId,
            name,
            schema.type === 'integer' || schema.type === 'number'
              ? inputValue === ''
                ? ''
                : Number(inputValue)
              : inputValue,
          );
        }}
      />
    );
  }

  private renderToolTable(columns: string[], value: unknown): React.ReactNode {
    const rows = Array.isArray(value) ? value.filter(isRecord) : [];
    if (rows.length === 0) return value === undefined ? null : <p>No rows returned.</p>;
    return (
      <table className="gamecrafter-plugin-data-table">
        <thead>
          <tr>
            {columns.map((column) => (
              <th key={column}>{column}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, index) => (
            <tr key={index}>
              {columns.map((column) => (
                <td key={column}>{formatValue(row[column])}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    );
  }

  private renderModuleCatalog(): React.ReactNode {
    return (
      <section
        className="gamecrafter-plugins-section gamecrafter-page-panel"
        id="gamecrafter-plugins-modules"
        hidden={this.activeSection !== 'modules'}
      >
        <h2>Module and genre catalog</h2>
        {this.modules.conflicts.map((conflict) => (
          <p className="gamecrafter-plugins-error" role="alert" key={conflict.id}>
            Conflict for {conflict.id}: {conflict.pluginIds.join(', ')}
          </p>
        ))}
        {this.modules.modules.length === 0 && this.modules.genres.length === 0 ? (
          <p className="gamecrafter-page-empty">No modules or genres are contributed.</p>
        ) : (
          <ul className="gamecrafter-plugin-module-list">
            {this.modules.modules.map((entry) => (
              <li key={`module-${entry.pluginId}-${entry.module.id}`}>
                {entry.module.name} ({entry.module.id}) · {entry.pluginId} ·{' '}
                {entry.active ? 'active' : 'inactive'}
              </li>
            ))}
            {this.modules.genres.map((entry) => (
              <li key={`genre-${entry.pluginId}-${entry.genre.id}`}>
                {entry.genre.name} ({entry.genre.id}) · {entry.pluginId} ·{' '}
                {entry.active ? 'active' : 'inactive'}
              </li>
            ))}
          </ul>
        )}
      </section>
    );
  }

  private setTab(tab: CatalogTab): void {
    this.tab = tab;
    this.update();
  }

  private async refresh(): Promise<void> {
    const version = ++this.refreshVersion;
    this.errorMessage = undefined;
    try {
      const projects = await this.service.listProjects();
      if (version !== this.refreshVersion || this.isDisposed) return;
      const projectId =
        (await this.resolveProjectSelection(projects, () => this.selectedProjectId)) || undefined;
      if (version !== this.refreshVersion || this.isDisposed) return;
      this.projects = projects;
      this.selectedProjectId = projectId;
      const [plugins, modules, isolationReport, tools] = await Promise.all([
        this.service.listPlugins(projectId),
        this.service.getPluginModules(),
        this.service.getPluginIsolationReport(),
        projectId ? this.service.listTools(projectId) : Promise.resolve([]),
      ]);
      if (
        version !== this.refreshVersion ||
        projectId !== this.selectedProjectId ||
        this.isDisposed
      )
        return;
      this.plugins = plugins;
      this.modules = modules;
      this.isolationReport = isolationReport;
      if (
        this.selectedPluginId &&
        !plugins.some((plugin) => plugin.installed.pluginId === this.selectedPluginId)
      ) {
        this.selectedPluginId = undefined;
        this.panel = undefined;
      }
      this.tools = tools;
      if (this.selectedPluginId) await this.loadPluginLogs(this.selectedPluginId);
    } catch (error) {
      if (version !== this.refreshVersion || this.isDisposed) return;
      this.errorMessage = errorMessage(error);
    }
    this.update();
  }

  private async inspectSource(): Promise<void> {
    await this.withBusy(async () => {
      this.inspection = await this.service.inspectPlugin(this.source.trim());
      this.capabilitiesAccepted = false;
      this.resultMessage = 'Manifest inspected without executing plugin code.';
    });
  }

  private async installInspectedPlugin(): Promise<void> {
    if (!this.inspection || !this.capabilitiesAccepted) return;
    await this.withBusy(async () => {
      const installed = await this.service.installPlugin(
        this.source.trim(),
        this.inspection!.capabilities,
      );
      this.resultMessage = `Installed ${installed.manifest.name} v${installed.version}.`;
      this.inspection = undefined;
      this.capabilitiesAccepted = false;
      this.source = '';
      this.selectedPluginId = installed.pluginId;
      this.activeSection = 'details';
      this.selectedPanelId = installed.manifest.contributes.ui.panels[0]?.id;
      await this.refresh();
      if (this.selectedPanelId) {
        this.panel = await this.service.getPluginPanel(installed.pluginId, this.selectedPanelId);
      }
    });
  }

  private async toggleEnabled(
    pluginId: string,
    scope: 'platform' | 'project',
    enabled: boolean,
  ): Promise<void> {
    if (scope === 'project' && !this.selectedProjectId) return;
    const projectId = scope === 'project' ? this.selectedProjectId : undefined;
    await this.withBusy(async () => {
      if (enabled) await this.service.enablePlugin(pluginId, projectId);
      else await this.service.disablePlugin(pluginId, projectId);
      await this.refresh();
    });
  }

  private async start(pluginId: string): Promise<void> {
    if (!this.selectedProjectId) return;
    await this.withBusy(async () => {
      const state = await this.service.startPlugin(pluginId, this.selectedProjectId!);
      this.resultMessage =
        state.status === 'running' ? `Started ${pluginId}.` : (state.lastError ?? state.status);
      await this.refresh();
    });
  }

  private async stop(pluginId: string): Promise<void> {
    if (!this.selectedProjectId) return;
    await this.withBusy(async () => {
      await this.service.stopPlugin(pluginId, this.selectedProjectId!);
      this.resultMessage = `Stopped ${pluginId}.`;
      await this.refresh();
    });
  }

  private confirmUninstall(pluginId: string | undefined): void {
    this.confirmUninstallPluginId = pluginId;
    this.update();
  }

  private async uninstall(pluginId: string): Promise<void> {
    await this.withBusy(async () => {
      await this.service.uninstallPlugin(pluginId);
      this.confirmUninstallPluginId = undefined;
      this.selectedPluginId = undefined;
      this.activeSection = 'plugins';
      this.panel = undefined;
      this.resultMessage = `Uninstalled ${pluginId}.`;
      await this.refresh();
    });
  }

  private async loadSelectedPanel(): Promise<void> {
    if (!this.selectedPluginId || !this.selectedPanelId) return;
    await this.withBusy(async () => {
      this.panel = await this.service.getPluginPanel(this.selectedPluginId!, this.selectedPanelId!);
      await this.refreshTools();
    });
  }

  private async refreshTools(): Promise<void> {
    this.tools = this.selectedProjectId ? await this.service.listTools(this.selectedProjectId) : [];
    this.update();
  }

  private async runTool(tool: ToolDefinition, values: Record<string, FormValue>): Promise<void> {
    if (!this.selectedProjectId) return;
    await this.withBusy(async () => {
      const input: Record<string, unknown> = {};
      for (const [key, value] of Object.entries(values)) {
        input[key] = parseSchemaValue(
          value,
          getRecord(getRecord(tool.inputSchema).properties)[key],
        );
      }
      const result = await this.service.callTool(this.selectedProjectId!, tool.toolId, input);
      this.panelOutputs.set(tool.toolId, result.output);
      this.resultMessage = `${tool.title} completed.`;
    });
  }

  private async runToolTable(tool: ToolDefinition): Promise<void> {
    if (!this.selectedProjectId) return;
    await this.withBusy(async () => {
      const result = await this.service.callTool(this.selectedProjectId!, tool.toolId, {});
      this.panelOutputs.set(tool.toolId, result.output);
    });
  }

  private setFormValue(toolId: string, key: string, value: FormValue): void {
    this.formValues.set(toolId, { ...this.formValues.get(toolId), [key]: value });
    this.update();
  }

  private async saveSecret(pluginId: string): Promise<void> {
    await this.withBusy(async () => {
      await this.service.setPluginSecret(pluginId, this.secretName.trim(), this.secretValue);
      this.secretValue = '';
      this.resultMessage = 'Encrypted plugin secret stored.';
    });
  }

  private async loadLogs(pluginId: string): Promise<void> {
    await this.withBusy(() => this.loadPluginLogs(pluginId));
  }

  private async loadPluginLogs(pluginId: string): Promise<void> {
    this.logs.set(
      pluginId,
      await this.service.listPluginLogs(pluginId, this.selectedProjectId, 200),
    );
  }

  private async withBusy(operation: () => Promise<unknown>): Promise<void> {
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

function capabilityName(capability: PluginCapability): string {
  return typeof capability === 'string' ? capability : capability.capability;
}

function capabilityExplanation(capability: PluginCapability): string {
  switch (capabilityName(capability)) {
    case 'fs.project.read':
      return 'Read Project files only through brokered, policy-checked host tools.';
    case 'fs.project.write':
      return 'Write Project files only through brokered tools and approval rules.';
    case 'process.spawn':
      return 'Request host process tools; Project access policy and approvals still apply.';
    case 'network.outbound':
      return typeof capability === 'string'
        ? 'Make outbound network connections from the isolated worker.'
        : `Request outbound access to: ${capability.hosts.join(', ')}. This build cannot enforce host allow-lists; the worker will fail to start.`;
    case 'tools.call':
      return 'Call platform tools through the broker, including its access and approval checks.';
    case 'models.complete':
      return 'Request routed model completions; usage is charged to this plugin.';
    case 'board.read':
      return 'Read this Project’s discussion board through the host.';
    case 'board.post':
      return 'Post to this Project’s discussion board as this plugin.';
    case 'secrets.read':
      return 'Read secrets saved specifically for this plugin.';
    default:
      return 'Capability declared by the plugin manifest.';
  }
}

function isolationLabel(worker: PluginListEntry['worker']): string {
  if (!worker) return 'Not running';
  if (worker.status === 'failed' || worker.status === 'starting') return worker.status;
  if (worker.isolation.enforced) return `${worker.isolation.backend} enforced`;
  return 'unisolated';
}

function isolationClass(worker: PluginListEntry['worker']): string {
  return `gamecrafter-plugin-isolation gamecrafter-plugin-isolation-${
    worker?.isolation.enforced
      ? worker.isolation.backend
      : worker?.status === 'failed'
        ? 'unavailable'
        : 'none'
  }`;
}

function getRecord(value: unknown): Record<string, unknown> {
  return isRecord(value) ? value : {};
}

function getStringArray(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === 'string')
    : [];
}

function parseSchemaValue(value: FormValue, schemaValue: unknown): unknown {
  const schema = getRecord(schemaValue);
  if (schema.type === 'object' || schema.type === 'array') {
    if (typeof value !== 'string') return value;
    try {
      return JSON.parse(value) as unknown;
    } catch {
      return value;
    }
  }
  if (schema.type === 'integer' && typeof value === 'number') return Math.trunc(value);
  return value;
}

function formatValue(value: unknown): string {
  return typeof value === 'string' ? value : (JSON.stringify(value) ?? String(value));
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function formatFieldName(value: string): string {
  return value
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/[-_]+/g, ' ')
    .replace(/^\w/, (character) => character.toUpperCase());
}

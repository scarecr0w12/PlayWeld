import React from 'react';
import { inject, injectable } from '@theia/core/shared/inversify';
import { MessageService } from '@theia/core/lib/common/message-service';
import { Message } from '@theia/core/lib/browser/widgets/widget';
import { ControlRoomReactWidget } from './control-room-react-widget';
import {
  RpcError,
  type RpcParams,
  type RpcResult,
  type EffectiveSetting,
  type ProjectSummary,
  type SettingDefinition,
  type SettingGroup,
  type SettingsScope,
} from '@gamecrafter/contracts';
import {
  ControlRoomService,
  type ControlRoomService as ControlRoomServiceApi,
} from '../common/control-room-protocol';
import { controlKindFor, filterDefinitions, groupDefinitions } from '../common/settings-view-model';
import { ControlRoomClientEvents } from './control-room-client';

const sourceLabels: Record<EffectiveSetting['source'], string> = {
  default: 'Default',
  platform: 'Platform',
  project: 'Project',
  session: 'Session',
};

@injectable()
export class GameCrafterSettingsWidget extends ControlRoomReactWidget {
  static readonly ID = 'gamecrafter.settings';

  private groups: SettingGroup[] = [];
  private definitions: SettingDefinition[] = [];
  private projects: ProjectSummary[] = [];
  private settings = new Map<string, EffectiveSetting>();
  private selectedGroup?: string;
  private selectedProjectId?: string;
  private searchQuery = '';
  private readonly scopes = new Map<string, SettingsScope>();
  private errorMessage?: string;
  private importPreview?: {
    input: RpcParams<'settings/import'>;
    result: RpcResult<'settings/import'>;
  };
  private importBusy = false;
  private importNotice?: string;
  private refreshVersion = 0;
  private readonly saveVersions = new Map<string, number>();
  private readonly drafts = new Map<string, unknown>();

  constructor(
    @inject(ControlRoomService)
    private readonly controlRoomService: ControlRoomServiceApi,
    @inject(ControlRoomClientEvents)
    private readonly clientEvents: ControlRoomClientEvents,
    @inject(MessageService)
    private readonly messageService: MessageService,
  ) {
    super();
    this.id = GameCrafterSettingsWidget.ID;
    this.title.label = 'PlayWeld Settings';
    this.title.iconClass = 'codicon codicon-settings-gear';
    this.title.closable = true;
    this.toDispose.push(
      this.clientEvents.settingsChanged(() => {
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
    const visibleDefinitions = filterDefinitions(this.definitions, this.searchQuery);
    const grouped = groupDefinitions(visibleDefinitions, this.groups);
    const visibleGroups = this.searchQuery.trim()
      ? grouped.filter(({ definitions }) => definitions.length > 0)
      : grouped;
    return (
      <div className="gamecrafter-settings gamecrafter-page gamecrafter-surface">
        <header className="gamecrafter-settings-header gamecrafter-page-header">
          <div>
            <h1>Settings</h1>
            <p>Configure the platform once, then override values for individual Projects.</p>
          </div>
        </header>
        <section
          className="gamecrafter-work-guidance gamecrafter-page-guidance"
          aria-label="Settings next steps"
        >
          <div>
            <strong>What to do next</strong>
            <p>
              {this.selectedProjectId
                ? 'Choose a settings group, then adjust a value. The effective source shows which scope currently wins.'
                : 'Choose a settings group and set platform defaults. Select a Project to add Project-specific overrides.'}
            </p>
          </div>
          <details className="gamecrafter-page-advanced">
            <summary>Import and export</summary>
            <label className="gamecrafter-settings-import-button">
              Import settings
              <input
                aria-label="Import settings file"
                type="file"
                accept=".json,application/json"
                disabled={this.importBusy}
                onChange={(event) => {
                  const file = event.currentTarget.files?.[0];
                  event.currentTarget.value = '';
                  if (file) void this.previewImport(file);
                }}
              />
            </label>
            <button type="button" onClick={() => void this.exportSettings()}>
              Export redacted settings
            </button>
          </details>
        </section>
        <div className="gamecrafter-settings-toolbar gamecrafter-page-toolbar">
          <label className="gamecrafter-settings-project">
            <span>Project scope</span>
            <select
              aria-label="Project"
              disabled={this.importBusy}
              value={this.selectedProjectId ?? ''}
              onChange={(event) => {
                this.markProjectSelection();
                this.selectedProjectId = event.currentTarget.value || undefined;
                this.importPreview = undefined;
                this.drafts.clear();
                this.settings.clear();
                this.update();
                void this.refresh();
              }}
            >
              <option value="">No Project</option>
              {this.projects.map((project) => (
                <option key={project.projectId} value={project.projectId}>
                  {project.name}
                </option>
              ))}
            </select>
          </label>
          <label className="gamecrafter-settings-search">
            <span>Search settings</span>
            <input
              aria-label="Search settings"
              type="search"
              value={this.searchQuery}
              onChange={(event) => {
                this.searchQuery = event.currentTarget.value;
                const matchingGroups = groupDefinitions(
                  filterDefinitions(this.definitions, this.searchQuery),
                  this.groups,
                ).filter(({ definitions }) => definitions.length > 0);
                if (!matchingGroups.some(({ group }) => group.id === this.selectedGroup)) {
                  this.selectedGroup = matchingGroups[0]?.group.id;
                }
                this.update();
              }}
            />
          </label>
        </div>
        {this.errorMessage ? <p role="alert">{this.errorMessage}</p> : undefined}
        {this.importPreview && (
          <section
            className="gamecrafter-settings-import-preview"
            aria-label="Settings import preview"
          >
            <h2>
              Import {this.importPreview.result.importedKeys.length}{' '}
              {this.importPreview.input.scope} overrides
            </h2>
            <p>
              Existing overrides for these setting IDs will be replaced. Other settings and redacted
              credentials are preserved.
            </p>
            <ul>
              {this.importPreview.result.importedKeys.map((key) => (
                <li key={key}>
                  <code>{key}</code>
                </li>
              ))}
            </ul>
            <p>
              {
                this.importPreview.result.skipped.filter((item) => item.reason !== 'no-override')
                  .length
              }{' '}
              unavailable or redacted settings skipped.
            </p>
            <button
              type="button"
              disabled={this.importBusy || !this.importPreview.result.importedKeys.length}
              onClick={() => void this.applyImport()}
            >
              Apply overrides
            </button>
            <button
              type="button"
              disabled={this.importBusy}
              onClick={() => {
                this.importPreview = undefined;
                this.update();
              }}
            >
              Cancel import
            </button>
          </section>
        )}
        {this.importNotice && <p role="status">{this.importNotice}</p>}
        <div className="gamecrafter-settings-layout gamecrafter-page-layout">
          <nav
            className="gamecrafter-settings-groups gamecrafter-section-nav"
            aria-label="Settings groups"
          >
            {visibleGroups.map(({ group, definitions }) => (
              <button
                className="gamecrafter-settings-group"
                key={group.id}
                type="button"
                aria-pressed={group.id === this.selectedGroup}
                aria-controls={`gamecrafter-settings-group-${group.id}`}
                onClick={() => {
                  this.selectedGroup = group.id;
                  this.update();
                }}
              >
                <span>{group.title}</span>
                <span className="gamecrafter-count">{definitions.length}</span>
              </button>
            ))}
          </nav>
          <div className="gamecrafter-settings-content gamecrafter-page-panels">
            {visibleGroups.map(({ group, definitions }) => (
              <section
                className="gamecrafter-page-panel"
                id={`gamecrafter-settings-group-${group.id}`}
                aria-label={`${group.title} settings`}
                hidden={group.id !== this.selectedGroup}
                key={group.id}
              >
                <h2>{group.title}</h2>
                <p className="gamecrafter-settings-group-description">{group.description}</p>
                {definitions.length === 0 ? (
                  <p className="gamecrafter-page-empty">
                    No settings in this group match the current search.
                  </p>
                ) : (
                  definitions.map((definition) => this.renderSetting(definition))
                )}
              </section>
            ))}
            {visibleGroups.length === 0 && (
              <p className="gamecrafter-page-empty">
                No settings match this search. Try another term or clear the search.
              </p>
            )}
          </div>
        </div>
      </div>
    );
  }

  private async exportSettings(): Promise<void> {
    try {
      const exported = await this.controlRoomService.exportSettings(this.selectedProjectId);
      const url = URL.createObjectURL(
        new Blob([JSON.stringify(exported, null, 2)], { type: 'application/json' }),
      );
      const link = document.createElement('a');
      link.href = url;
      link.download = 'gamecrafter-settings.json';
      document.body.appendChild(link);
      link.click();
      link.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (error) {
      await this.messageService.error(error instanceof Error ? error.message : String(error));
    }
  }

  private renderSetting(definition: SettingDefinition): React.ReactNode {
    const effective = this.settings.get(definition.key);
    const scope = this.selectedScope(definition, effective);
    const value = this.drafts.has(definition.key)
      ? this.drafts.get(definition.key)
      : (effective?.value ?? definition.default);
    const scopes = this.allowedScopes(definition);
    const disabled = scope === 'project' && !this.selectedProjectId;
    const hasOverride = Boolean(
      effective && Object.prototype.hasOwnProperty.call(effective.layers, scope),
    );

    return (
      <article className="gamecrafter-setting-row" key={definition.key}>
        <div>
          <strong>{definition.title}</strong>
          <div className="gamecrafter-setting-description">{definition.description}</div>
          <details className="gamecrafter-setting-advanced">
            <summary>Scope and setting ID</summary>
            <div className="gamecrafter-setting-advanced-content">
              <label>
                Save override to
                <select
                  aria-label={`${definition.title} scope`}
                  value={scope}
                  onChange={(event) => {
                    this.scopes.set(definition.key, event.currentTarget.value as SettingsScope);
                    this.update();
                  }}
                >
                  {scopes.map((candidate) => (
                    <option
                      disabled={candidate === 'project' && !this.selectedProjectId}
                      key={candidate}
                      value={candidate}
                    >
                      {sourceLabels[candidate]}
                    </option>
                  ))}
                </select>
              </label>
              <code>{definition.key}</code>
            </div>
          </details>
        </div>
        <div className="gamecrafter-setting-control">
          {this.renderControl(definition, value, scope, disabled)}
          <div className="gamecrafter-setting-value-meta">
            <span className="gamecrafter-setting-source">
              Effective from {sourceLabels[effective?.source ?? 'default']}
            </span>
            <button
              className="gamecrafter-settings-reset"
              type="button"
              disabled={disabled || !hasOverride}
              onClick={() => void this.saveSetting(definition, scope, null)}
            >
              Reset
            </button>
          </div>
        </div>
      </article>
    );
  }

  private renderControl(
    definition: SettingDefinition,
    value: unknown,
    scope: SettingsScope,
    disabled: boolean,
  ): React.ReactNode {
    const kind = controlKindFor(definition.schema);
    const schema = definition.schema;
    const fieldKey = `${this.selectedProjectId ?? ''}-${definition.key}-${scope}-${JSON.stringify(value)}`;
    const common = {
      'aria-label': definition.title,
      disabled,
    };

    if (kind === 'boolean') {
      return (
        <input
          {...common}
          type="checkbox"
          checked={value === true}
          onChange={(event) =>
            void this.saveSetting(definition, scope, event.currentTarget.checked)
          }
        />
      );
    }
    if (kind === 'enum') {
      const choices = Array.isArray(schema.enum) ? schema.enum : [];
      return (
        <select
          {...common}
          value={String(value)}
          onChange={(event) => void this.saveSetting(definition, scope, event.currentTarget.value)}
        >
          {choices.map((choice) => (
            <option key={String(choice)} value={String(choice)}>
              {String(choice)}
            </option>
          ))}
        </select>
      );
    }
    if (kind === 'enum-array') {
      const items =
        typeof schema.items === 'object' && schema.items !== null && !Array.isArray(schema.items)
          ? (schema.items as Record<string, unknown>)
          : undefined;
      const choices = items && Array.isArray(items.enum) ? items.enum : [];
      const selected = Array.isArray(value) ? value.map(String) : [];
      return (
        <fieldset className="gamecrafter-setting-array-options" aria-label={definition.title}>
          <legend>{definition.title}</legend>
          {choices.map((choice) => {
            const option = String(choice);
            return (
              <label key={option}>
                <input
                  type="checkbox"
                  checked={selected.includes(option)}
                  disabled={disabled}
                  onChange={(event) => {
                    const next = new Set(selected);
                    if (event.currentTarget.checked) next.add(option);
                    else next.delete(option);
                    void this.saveSetting(definition, scope, [...next]);
                  }}
                />
                {option}
              </label>
            );
          })}
        </fieldset>
      );
    }
    if (kind === 'string-array') {
      const entries = Array.isArray(value) ? value.map(String) : [];
      return (
        <input
          {...common}
          type="text"
          defaultValue={entries.join(', ')}
          key={fieldKey}
          onBlur={(event) => {
            const values = event.currentTarget.value
              .split(',')
              .map((item) => item.trim())
              .filter((item) => item.length > 0);
            void this.saveSetting(definition, scope, [...new Set(values)]);
          }}
        />
      );
    }
    if (kind === 'number') {
      return (
        <input
          {...common}
          type="number"
          key={fieldKey}
          min={typeof schema.minimum === 'number' ? schema.minimum : undefined}
          max={typeof schema.maximum === 'number' ? schema.maximum : undefined}
          step={schema.type === 'integer' ? 1 : 'any'}
          defaultValue={String(value)}
          onBlur={(event) => {
            const raw = event.currentTarget.value;
            void this.saveSetting(definition, scope, raw === '' ? null : Number(raw));
          }}
        />
      );
    }
    if (kind === 'string') {
      return (
        <input
          {...common}
          type="text"
          defaultValue={String(value)}
          key={fieldKey}
          onBlur={(event) => void this.saveSetting(definition, scope, event.currentTarget.value)}
        />
      );
    }
    return <span>Unsupported setting schema</span>;
  }

  private allowedScopes(definition: SettingDefinition): SettingsScope[] {
    return [...new Set<SettingsScope>(['platform', ...definition.scopes])];
  }

  private selectedScope(
    definition: SettingDefinition,
    effective?: EffectiveSetting,
  ): SettingsScope {
    const allowed = this.allowedScopes(definition);
    const selected = this.scopes.get(definition.key);
    if (
      selected &&
      allowed.includes(selected) &&
      (selected !== 'project' || this.selectedProjectId)
    ) {
      return selected;
    }
    if (effective && effective.source !== 'default' && allowed.includes(effective.source)) {
      return effective.source;
    }
    return this.selectedProjectId && allowed.includes('project') ? 'project' : 'platform';
  }

  private async previewImport(file: File): Promise<void> {
    const projectId = this.selectedProjectId;
    this.errorMessage = undefined;
    this.importPreview = undefined;
    this.importNotice = undefined;
    this.importBusy = true;
    this.update();
    try {
      if (file.size > 5 * 1024 * 1024) throw new Error('Settings files must be smaller than 5 MB.');
      const input: RpcParams<'settings/import'> = {
        document: JSON.parse(await file.text()),
        scope: projectId ? 'project' : 'platform',
        projectId,
        dryRun: true,
      };
      const result = await this.controlRoomService.importSettings(input);
      if (this.selectedProjectId === input.projectId) this.importPreview = { input, result };
    } catch (error) {
      this.errorMessage = error instanceof Error ? error.message : String(error);
    } finally {
      this.importBusy = false;
      this.update();
    }
  }

  private async applyImport(): Promise<void> {
    const preview = this.importPreview;
    if (!preview || this.importBusy) return;
    this.importBusy = true;
    this.update();
    try {
      const result = await this.controlRoomService.importSettings({
        ...preview.input,
        dryRun: false,
      });
      this.importPreview = undefined;
      this.importNotice = `Imported ${result.importedKeys.length} settings.`;
      await this.refresh();
    } catch (error) {
      this.errorMessage = error instanceof Error ? error.message : String(error);
    } finally {
      this.importBusy = false;
      this.update();
    }
  }

  private async saveSetting(
    definition: SettingDefinition,
    scope: SettingsScope,
    value: unknown,
  ): Promise<void> {
    const projectId = this.selectedProjectId;
    const version = (this.saveVersions.get(definition.key) ?? 0) + 1;
    this.saveVersions.set(definition.key, version);
    if (value !== null) this.drafts.set(definition.key, value);
    this.update();
    try {
      const effective = await this.controlRoomService.setSetting(
        definition.key,
        scope,
        value,
        projectId,
      );
      if (projectId !== this.selectedProjectId || this.saveVersions.get(definition.key) !== version)
        return;
      ++this.refreshVersion;
      this.drafts.delete(definition.key);
      this.settings.set(definition.key, effective);
      this.errorMessage = undefined;
      this.update();
    } catch (error) {
      if (projectId !== this.selectedProjectId || this.saveVersions.get(definition.key) !== version)
        return;
      this.drafts.delete(definition.key);
      const message =
        error instanceof RpcError
          ? error.message
          : error instanceof Error
            ? error.message
            : String(error);
      this.errorMessage = message;
      this.update();
      await this.messageService.error(message);
    }
  }

  private async refresh(): Promise<void> {
    const version = ++this.refreshVersion;
    try {
      const [description, projects] = await Promise.all([
        this.controlRoomService.describeSettings(),
        this.controlRoomService.listProjects(),
      ]);
      const projectId =
        (await this.resolveProjectSelection(projects, () => this.selectedProjectId)) || undefined;
      if (version !== this.refreshVersion) return;
      this.selectedProjectId = projectId;
      const settings = await this.controlRoomService.getAllSettings(projectId);
      if (version !== this.refreshVersion) return;
      this.groups = description.groups;
      this.definitions = description.definitions;
      this.projects = projects;
      if (!this.groups.some((group) => group.id === this.selectedGroup)) {
        this.selectedGroup = this.groups[0]?.id;
      }
      this.settings = new Map(settings.map((setting) => [setting.key, setting]));
      this.errorMessage = undefined;
    } catch (error) {
      if (version !== this.refreshVersion || this.isDisposed) return;
      this.errorMessage = error instanceof Error ? error.message : String(error);
    }
    this.update();
  }
}

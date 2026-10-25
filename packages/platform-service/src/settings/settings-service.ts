import type {
  EffectiveSetting,
  SettingsExport,
  SettingsImportParams,
  SettingsImportResult,
  RpcNotificationParams,
  SettingsScope,
  PluginManifest,
  PluginSettingsUpgrade,
} from '@gamecrafter/contracts';
import { redact, RpcError as ServiceRpcError, RpcErrorCode } from '@gamecrafter/contracts';
import type { Database } from '../db/database';
import { ProjectDatabases } from '../projects/project-databases';
import { SettingsRegistry } from './registry';
import { PluginSettingsMigrations } from './plugin-settings-migrations';

export interface SettingsContext {
  projectId?: string;
  sessionId?: string;
}

export class SettingsService {
  private readonly pluginMigrations: PluginSettingsMigrations;
  private readonly sessions = new Map<string, Map<string, unknown>>();
  private readonly changedListeners = new Set<
    (event: RpcNotificationParams<'settings/changed'>) => void
  >();

  constructor(
    private readonly registry: SettingsRegistry,
    private readonly profileDatabase: Database,
    private readonly projectDatabases: ProjectDatabases,
    private readonly now: () => Date = () => new Date(),
  ) {
    this.pluginMigrations = new PluginSettingsMigrations(
      profileDatabase,
      projectDatabases,
      registry,
      this.sessions,
      now,
    );
  }

  preparePluginUpgrade(
    previous: PluginManifest | undefined,
    next: PluginManifest,
    projectIds: string[],
  ): PluginSettingsUpgrade | undefined {
    return this.pluginMigrations.prepare(previous, next, projectIds);
  }
  commitPluginUpgrade(next: PluginManifest, plan?: PluginSettingsUpgrade): void {
    this.pluginMigrations.commit(next, plan);
  }
  activatePluginSettings(next: PluginManifest, previousVersion?: string): void {
    this.pluginMigrations.activate(next, previousVersion);
  }

  describe(): ReturnType<SettingsRegistry['describe']> {
    return this.registry.describe();
  }

  getAll(context: SettingsContext = {}): EffectiveSetting[] {
    this.pluginMigrations.ensure(context.projectId);
    return this.registry
      .describe()
      .definitions.map((definition) => this.resolve(definition.key, context));
  }

  getPluginSettings(pluginId: string, context: SettingsContext = {}): EffectiveSetting[] {
    this.pluginMigrations.ensure(context.projectId, undefined, false, pluginId);
    return this.registry
      .describe()
      .definitions.filter((definition) => definition.source === `plugin:${pluginId}`)
      .map((definition) => this.resolve(definition.key, context));
  }

  export(context: SettingsContext = {}): SettingsExport {
    const scrub = (key: string, value: unknown): unknown => redact({ [key]: value })[key];
    return {
      schemaVersion: 1,
      exportedAt: this.now().toISOString(),
      projectId: context.projectId ?? null,
      settings: this.getAll(context).map((setting) => ({
        ...setting,
        value: scrub(setting.key, setting.value),
        layers: Object.fromEntries(
          Object.entries(setting.layers).map(([scope, value]) => [
            scope,
            scrub(setting.key, value),
          ]),
        ) as EffectiveSetting['layers'],
      })),
    };
  }

  import(input: SettingsImportParams): SettingsImportResult {
    if (input.scope === 'project' && !input.projectId)
      throw new ServiceRpcError(
        'projectId is required for Project import',
        RpcErrorCode.InvalidParams,
      );
    const database =
      input.scope === 'project'
        ? this.projectDatabases.get(input.projectId!)
        : this.profileDatabase;
    const table = input.scope === 'project' ? 'settings_overrides' : 'settings_values';
    const result: SettingsImportResult = {
      schemaVersion: 1,
      dryRun: input.dryRun ?? false,
      importedKeys: [],
      skipped: [],
    };
    const changes: Array<{ key: string; value: unknown }> = [];
    const seen = new Set<string>();
    for (const setting of input.document.settings) {
      if (seen.has(setting.key))
        throw new ServiceRpcError(`Duplicate setting: ${setting.key}`, RpcErrorCode.InvalidParams);
      seen.add(setting.key);
      const definition = this.registry.get(setting.key);
      let reason: SettingsImportResult['skipped'][number]['reason'] | undefined;
      if (!definition) reason = 'unknown-setting';
      else if (!Object.prototype.hasOwnProperty.call(setting.layers, input.scope))
        reason = 'no-override';
      else if (containsRedacted(setting.layers[input.scope])) reason = 'redacted-value';
      if (reason) {
        result.skipped.push({ key: setting.key, reason });
        continue;
      }
      if (input.scope === 'project' && !definition!.scopes.includes('project'))
        throw new ServiceRpcError(
          `Setting ${setting.key} cannot be overridden at Project scope`,
          RpcErrorCode.SettingScopeNotAllowed,
        );
      const value = setting.layers[input.scope];
      if (value === null || this.registry.validateValue(setting.key, value).length)
        throw new ServiceRpcError(
          `Invalid imported value for setting ${setting.key}`,
          RpcErrorCode.InvalidSettingValue,
        );
      changes.push({ key: setting.key, value });
      result.importedKeys.push(setting.key);
    }
    for (const { key } of changes)
      this.pluginMigrations.ensure(
        input.scope === 'project' ? input.projectId : undefined,
        key,
        result.dryRun,
      );
    if (!result.dryRun) {
      database.transaction(() => {
        for (const { key, value } of changes)
          this.writeOverride(database, table, key, value, this.now().toISOString());
      });
      for (const { key } of changes)
        this.notifyChanged({
          key,
          scope: input.scope,
          ...(input.scope === 'project' ? { projectId: input.projectId } : {}),
        });
    }
    return result;
  }

  resolve(key: string, context: SettingsContext = {}): EffectiveSetting {
    const definition = this.getDefinition(key);
    this.pluginMigrations.ensure(context.projectId, key);
    const layers: EffectiveSetting['layers'] = { default: definition.default };
    let source: EffectiveSetting['source'] = 'default';
    let value: unknown = definition.default;

    const platformValue = this.readOverride(this.profileDatabase, 'settings_values', key);
    if (platformValue.found) {
      layers.platform = platformValue.value;
      source = 'platform';
      value = platformValue.value;
    }

    if (context.projectId && definition.scopes.includes('project')) {
      const projectValue = this.readOverride(
        this.projectDatabases.get(context.projectId),
        'settings_overrides',
        key,
      );
      if (projectValue.found) {
        layers.project = projectValue.value;
        source = 'project';
        value = projectValue.value;
      }
    }

    if (context.sessionId && definition.scopes.includes('session')) {
      const session = this.sessions.get(context.sessionId);
      if (!session) {
        throw new ServiceRpcError(
          `Unknown session: ${context.sessionId}`,
          RpcErrorCode.UnknownSession,
        );
      }
      if (session.has(key)) {
        const sessionValue = session.get(key);
        layers.session = sessionValue;
        source = 'session';
        value = sessionValue;
      }
    }

    return { key, value, source, layers };
  }

  set(
    key: string,
    scope: SettingsScope,
    value: unknown,
    context: SettingsContext = {},
  ): EffectiveSetting {
    const definition = this.getDefinition(key);
    this.pluginMigrations.ensure(context.projectId, key);
    if (scope !== 'platform' && !definition.scopes.includes(scope)) {
      throw new ServiceRpcError(
        `Setting ${key} cannot be overridden at ${scope} scope`,
        RpcErrorCode.SettingScopeNotAllowed,
      );
    }
    if (scope === 'project' && !context.projectId) {
      throw new ServiceRpcError(
        'projectId is required for project-scoped settings',
        RpcErrorCode.InvalidParams,
      );
    }
    if (scope === 'session' && !context.sessionId) {
      throw new ServiceRpcError(
        'sessionId is required for session-scoped settings',
        RpcErrorCode.UnknownSession,
      );
    }
    if (value !== null) {
      const errors = this.registry.validateValue(key, value);
      if (errors.length > 0) {
        throw new ServiceRpcError(
          `Invalid value for setting ${key}`,
          RpcErrorCode.InvalidSettingValue,
          {
            errors,
          },
        );
      }
    }

    const updatedAt = this.now().toISOString();
    if (scope === 'platform') {
      this.writeOverride(this.profileDatabase, 'settings_values', key, value, updatedAt);
    } else if (scope === 'project') {
      this.writeOverride(
        this.projectDatabases.get(context.projectId!),
        'settings_overrides',
        key,
        value,
        updatedAt,
      );
    } else {
      const session = this.sessions.get(context.sessionId!);
      if (!session) {
        throw new ServiceRpcError(
          `Unknown session: ${context.sessionId}`,
          RpcErrorCode.UnknownSession,
        );
      }
      if (value === null) session.delete(key);
      else session.set(key, value);
    }

    const event: RpcNotificationParams<'settings/changed'> = {
      key,
      scope,
      ...(scope === 'project' ? { projectId: context.projectId } : {}),
      ...(scope === 'session' ? { sessionId: context.sessionId } : {}),
    };
    for (const listener of this.changedListeners) listener(event);
    return this.resolve(key, context);
  }

  openSession(sessionId: string): void {
    this.sessions.set(sessionId, new Map());
  }

  closeSession(sessionId: string): void {
    this.sessions.delete(sessionId);
  }

  onChanged(listener: (event: RpcNotificationParams<'settings/changed'>) => void): () => void {
    this.changedListeners.add(listener);
    return () => this.changedListeners.delete(listener);
  }

  unregisterSource(source: string, projectIds: string[] = []): string[] {
    if (source.startsWith('plugin:')) this.pluginMigrations.forget(source.slice(7), projectIds);
    const keys = this.registry.unregisterSource(source);
    for (const key of keys) {
      this.profileDatabase.prepare('DELETE FROM settings_values WHERE key = ?').run(key);
      this.notifyChanged({ key, scope: 'platform' });
      for (const projectId of projectIds) {
        try {
          this.projectDatabases
            .get(projectId)
            .prepare('DELETE FROM settings_overrides WHERE key = ?')
            .run(key);
          this.notifyChanged({ key, scope: 'project', projectId });
        } catch (error) {
          if (error instanceof ServiceRpcError && error.code === RpcErrorCode.ProjectNotFound)
            continue;
          throw error;
        }
      }
      for (const [sessionId, session] of this.sessions) {
        session.delete(key);
        this.notifyChanged({ key, scope: 'session', sessionId });
      }
    }
    return keys;
  }

  private notifyChanged(event: RpcNotificationParams<'settings/changed'>): void {
    for (const listener of this.changedListeners) listener(event);
  }

  private getDefinition(key: string) {
    const definition = this.registry.get(key);
    if (!definition) {
      throw new ServiceRpcError(`Unknown setting: ${key}`, RpcErrorCode.UnknownSetting);
    }
    return definition;
  }

  private readOverride(
    database: Database,
    table: 'settings_values' | 'settings_overrides',
    key: string,
  ): { found: false } | { found: true; value: unknown } {
    const row = database
      .prepare(`SELECT value FROM ${table} WHERE key = ?`)
      .get<{ value: string }>(key);
    return row ? { found: true, value: JSON.parse(row.value) as unknown } : { found: false };
  }

  private writeOverride(
    database: Database,
    table: 'settings_values' | 'settings_overrides',
    key: string,
    value: unknown,
    updatedAt: string,
  ): void {
    if (value === null) {
      database.prepare(`DELETE FROM ${table} WHERE key = ?`).run(key);
      return;
    }
    database
      .prepare(
        `INSERT INTO ${table} (key, value, updated_at) VALUES (?, ?, ?)
         ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`,
      )
      .run(key, JSON.stringify(value), updatedAt);
  }
}

function containsRedacted(value: unknown): boolean {
  if (typeof value === 'string') return value.includes('[REDACTED]');
  if (Array.isArray(value)) return value.some(containsRedacted);
  return value !== null && typeof value === 'object' && Object.values(value).some(containsRedacted);
}

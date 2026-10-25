import { isDeepStrictEqual } from 'node:util';
import semver from 'semver';
import {
  compile,
  PluginSettingsUpgradeSchema,
  RpcError,
  RpcErrorCode,
  type PluginManifest,
  type PluginSettingsUpgrade,
  type SettingDefinition,
  type SettingsScope,
} from '@gamecrafter/contracts';
import type { Database } from '../db/database';
import type { ProjectDatabases } from '../projects/project-databases';
import type { SettingsRegistry } from './registry';

type Values = Map<string, unknown>;
type Table = 'settings_values' | 'settings_overrides';

/** Service-owned, declarative transformations. No plugin code executes here. */
export class PluginSettingsMigrations {
  private readonly active = new Map<string, PluginManifest>();

  constructor(
    private readonly profile: Database,
    private readonly projects: ProjectDatabases,
    private readonly registry: SettingsRegistry,
    private readonly sessions: Map<string, Map<string, unknown>>,
    private readonly now: () => Date,
  ) {}

  prepare(
    previous: PluginManifest | undefined,
    next: PluginManifest,
    projectIds: string[],
  ): PluginSettingsUpgrade | undefined {
    this.registry.validateReplacement(`plugin:${next.id}`, next.contributes.settings);
    const plan =
      previous && previous.version !== next.version ? this.plan(previous, next) : undefined;
    this.previewStore(this.profile, 'settings_values', 'platform', next, plan);
    for (const projectId of projectIds) {
      try {
        this.previewStore(
          this.projects.get(projectId),
          'settings_overrides',
          'project',
          next,
          plan,
        );
      } catch (error) {
        if (!(error instanceof RpcError && error.code === RpcErrorCode.ProjectNotFound))
          throw error;
      }
    }
    for (const values of this.sessions.values())
      this.transform(
        next,
        this.owned(next.id, values),
        previous?.version ?? next.version,
        'session',
        plan,
      );
    return plan;
  }

  /** Called inside the same profile transaction that activates the new plugin. */
  commit(next: PluginManifest, plan?: PluginSettingsUpgrade): void {
    if (plan)
      this.profile
        .prepare(
          'INSERT INTO plugin_settings_upgrades (plugin_id, from_version, plan_json) VALUES (?, ?, ?)',
        )
        .run(next.id, plan.from, JSON.stringify(plan));
    this.migrateStore(this.profile, 'settings_values', 'platform', next, true);
  }

  activate(next: PluginManifest, previousVersion?: string): void {
    const transformed = [...this.sessions].map(
      ([id, values]) =>
        [
          id,
          this.transform(
            next,
            this.owned(next.id, values),
            previousVersion ?? next.version,
            'session',
          ),
        ] as const,
    );
    this.registry.replaceSource(`plugin:${next.id}`, next.contributes.settings);
    this.active.set(next.id, next);
    for (const [id, values] of transformed) {
      const session = this.sessions.get(id)!;
      for (const key of this.owned(next.id, session).keys()) session.delete(key);
      for (const [key, value] of values) session.set(key, value);
    }
    this.migrateStore(this.profile, 'settings_values', 'platform', next);
  }

  ensure(projectId?: string, key?: string, dryRun = false, pluginId?: string): void {
    for (const manifest of this.active.values()) {
      if (pluginId && manifest.id !== pluginId) continue;
      if (key && this.registry.get(key)?.source !== `plugin:${manifest.id}`) continue;
      if (dryRun) this.previewStore(this.profile, 'settings_values', 'platform', manifest);
      else this.migrateStore(this.profile, 'settings_values', 'platform', manifest);
      if (projectId) {
        const database = this.projects.get(projectId);
        if (dryRun) this.previewStore(database, 'settings_overrides', 'project', manifest);
        else this.migrateStore(database, 'settings_overrides', 'project', manifest);
      }
    }
  }

  forget(pluginId: string, projectIds: string[]): void {
    const stores: Array<[Database, Table]> = [[this.profile, 'settings_values']];
    for (const projectId of projectIds) {
      try {
        stores.push([this.projects.get(projectId), 'settings_overrides']);
      } catch (error) {
        if (!(error instanceof RpcError && error.code === RpcErrorCode.ProjectNotFound))
          throw error;
      }
    }
    const prefix = `plugin.${pluginId}.`;
    for (const [database, table] of stores)
      database.transaction(() => {
        const rows = database
          .prepare(`SELECT key FROM ${table} WHERE substr(key, 1, ?) = ?`)
          .all<{ key: string }>(prefix.length, prefix);
        const protectedKeys = this.protectedKeys(pluginId);
        for (const { key } of rows)
          if (!protectedKeys.has(key))
            database.prepare(`DELETE FROM ${table} WHERE key = ?`).run(key);
        database.prepare('DELETE FROM plugin_settings_versions WHERE plugin_id = ?').run(pluginId);
      });
    this.profile.prepare('DELETE FROM plugin_settings_upgrades WHERE plugin_id = ?').run(pluginId);
    this.active.delete(pluginId);
    for (const values of this.sessions.values())
      for (const key of this.owned(pluginId, values).keys()) values.delete(key);
  }

  private plan(previous: PluginManifest, next: PluginManifest): PluginSettingsUpgrade {
    let version = previous.version;
    const operations: PluginSettingsUpgrade['operations'] = [];
    while (version !== next.version && next.migrations.length) {
      const edges = next.migrations.filter((migration) => migration.from === version);
      if (
        edges.length !== 1 ||
        !semver.gt(edges[0]!.to, version) ||
        semver.gt(edges[0]!.to, next.version)
      )
        this.fail(
          next.id,
          'Migration chain must be unambiguous, forward-only and reach the new version.',
        );
      operations.push(...(edges[0]!.operations ?? []));
      version = edges[0]!.to;
    }
    const plan: PluginSettingsUpgrade = {
      schemaVersion: 1,
      pluginId: next.id,
      from: previous.version,
      to: next.version,
      operations,
      definitions: next.contributes.settings,
    };
    const prefix = `plugin.${next.id}.`;
    const protectedKeys = this.protectedKeys(next.id);
    for (const operation of operations) {
      const keys = operation.kind === 'rename' ? [operation.from, operation.to] : [operation.key];
      if (keys.some((key) => !key.startsWith(prefix) || protectedKeys.has(key)))
        this.fail(next.id, 'Migrations may only change their own plugin setting namespace.');
    }
    return plan;
  }

  private history(pluginId: string): PluginSettingsUpgrade[] {
    return this.profile
      .prepare(
        'SELECT plan_json AS plan FROM plugin_settings_upgrades WHERE plugin_id = ? ORDER BY sequence',
      )
      .all<{ plan: string }>(pluginId)
      .map((row) =>
        compile<PluginSettingsUpgrade>(PluginSettingsUpgradeSchema).assert(JSON.parse(row.plan)),
      );
  }

  private transform(
    next: PluginManifest,
    input: Values,
    version: string | undefined,
    scope: SettingsScope,
    extra?: PluginSettingsUpgrade,
  ): Values {
    const plans = this.history(next.id);
    if (extra) plans.push(extra);
    let current = version ?? plans[0]?.from ?? next.version;
    const values = new Map(input);
    while (current !== next.version) {
      // A restored Project may bring its checkpoint into a fresh profile. Use
      // the package's declared chain when that profile has no matching history.
      const plan =
        plans.find((candidate) => candidate.from === current) ??
        this.plan({ ...next, version: current }, next);
      if (!plan || !semver.gt(plan.to, current) || semver.gt(plan.to, next.version))
        this.fail(next.id, `No forward settings migration from ${current} to ${next.version}.`);
      for (const operation of plan.operations) {
        if (operation.scopes && !operation.scopes.includes(scope)) continue;
        const key = operation.kind === 'rename' ? operation.from : operation.key;
        if (!values.has(key)) continue;
        if (operation.kind === 'remove') values.delete(key);
        else if (operation.kind === 'rename') {
          if (operation.from === operation.to) continue;
          if (values.has(operation.to))
            this.fail(next.id, `Migration destination already has an override: ${operation.to}.`);
          values.set(operation.to, values.get(key));
          values.delete(key);
        } else {
          const matches = operation.values.filter((mapping) =>
            isDeepStrictEqual(mapping.from, values.get(key)),
          );
          if (matches.length !== 1)
            this.fail(next.id, `Value mapping must match exactly once: ${key}.`);
          values.set(key, structuredClone(matches[0]!.to));
        }
      }
      this.validate(next.id, values, plan.definitions, scope);
      current = plan.to;
    }
    this.validate(next.id, values, next.contributes.settings, scope);
    return values;
  }

  private validate(
    pluginId: string,
    values: Values,
    definitions: SettingDefinition[],
    scope: SettingsScope,
  ): void {
    for (const [key, value] of values) {
      const definition = definitions.find((candidate) => candidate.key === key);
      if (
        !definition ||
        (scope !== 'platform' && !definition.scopes.includes(scope)) ||
        value === null ||
        !compile(definition.schema as Parameters<typeof compile>[0]).check(value)
      )
        this.fail(
          pluginId,
          `Migrated ${scope} override does not match its declared setting: ${key}.`,
        );
    }
  }

  private owned(pluginId: string, values: Values): Values {
    const protectedKeys = this.protectedKeys(pluginId);
    return new Map(
      [...values].filter(
        ([key]) => key.startsWith(`plugin.${pluginId}.`) && !protectedKeys.has(key),
      ),
    );
  }

  /** A dotted plugin ID can overlap another ID's textual prefix. Ownership is
   * established by declarations/history, never by that prefix alone. */
  private protectedKeys(pluginId: string): Set<string> {
    const ownSource = `plugin:${pluginId}`;
    const keys = new Set(
      this.registry
        .describe()
        .definitions.filter((definition) => definition.source !== ownSource)
        .map((definition) => definition.key),
    );
    for (const row of this.profile
      .prepare('SELECT manifest FROM installed_plugins WHERE plugin_id != ?')
      .all<{ manifest: string }>(pluginId)) {
      const manifest = JSON.parse(row.manifest) as PluginManifest;
      for (const definition of manifest.contributes.settings) keys.add(definition.key);
    }
    for (const row of this.profile
      .prepare('SELECT plan_json AS plan FROM plugin_settings_upgrades WHERE plugin_id != ?')
      .all<{ plan: string }>(pluginId)) {
      const plan = compile<PluginSettingsUpgrade>(PluginSettingsUpgradeSchema).assert(
        JSON.parse(row.plan),
      );
      for (const definition of plan.definitions) keys.add(definition.key);
      for (const operation of plan.operations)
        for (const key of operation.kind === 'rename'
          ? [operation.from, operation.to]
          : [operation.key])
          keys.add(key);
    }
    return keys;
  }

  private previewStore(
    database: Database,
    table: Table,
    scope: SettingsScope,
    next: PluginManifest,
    extra?: PluginSettingsUpgrade,
  ): Values {
    const prefix = `plugin.${next.id}.`;
    const values = this.owned(
      next.id,
      new Map(
        database
          .prepare(`SELECT key, value FROM ${table} WHERE substr(key, 1, ?) = ?`)
          .all<{ key: string; value: string }>(prefix.length, prefix)
          .map((row) => [row.key, JSON.parse(row.value)]),
      ),
    );
    const version = database
      .prepare('SELECT version FROM plugin_settings_versions WHERE plugin_id = ?')
      .get<{ version: string }>(next.id)?.version;
    return this.transform(
      next,
      values,
      version ?? (extra ? (this.history(next.id)[0]?.from ?? extra.from) : undefined),
      scope,
      extra,
    );
  }

  private migrateStore(
    database: Database,
    table: Table,
    scope: SettingsScope,
    next: PluginManifest,
    inTransaction = false,
  ): void {
    if (
      database
        .prepare('SELECT version FROM plugin_settings_versions WHERE plugin_id = ?')
        .get<{ version: string }>(next.id)?.version === next.version
    )
      return;
    const apply = () => {
      const values = this.previewStore(database, table, scope, next);
      const prefix = `plugin.${next.id}.`;
      const protectedKeys = this.protectedKeys(next.id);
      for (const { key } of database
        .prepare(`SELECT key FROM ${table} WHERE substr(key, 1, ?) = ?`)
        .all<{ key: string }>(prefix.length, prefix)) {
        if (!protectedKeys.has(key))
          database.prepare(`DELETE FROM ${table} WHERE key = ?`).run(key);
      }
      for (const [key, value] of values)
        database
          .prepare(`INSERT INTO ${table} (key, value, updated_at) VALUES (?, ?, ?)`)
          .run(key, JSON.stringify(value), this.now().toISOString());
      database
        .prepare(
          'INSERT INTO plugin_settings_versions (plugin_id, version) VALUES (?, ?) ON CONFLICT(plugin_id) DO UPDATE SET version = excluded.version',
        )
        .run(next.id, next.version);
    };
    if (inTransaction) apply();
    else database.transaction(apply);
  }

  private fail(pluginId: string, message: string): never {
    throw new RpcError(`Plugin ${pluginId}: ${message}`, RpcErrorCode.InvalidSettingValue);
  }
}

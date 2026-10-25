import { createHash } from 'node:crypto';
import {
  cpSync,
  existsSync,
  lstatSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  renameSync,
  rmSync,
  statSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import semver from 'semver';
import {
  compile,
  compileJsonSchema2020,
  equalPluginCapabilities,
  InstalledPluginSchema,
  PluginManifestSchema,
  relativePluginPath,
  RpcError,
  RpcErrorCode,
  validatePluginManifest,
  type InstalledPlugin,
  type PluginCapability,
  type PluginInspection,
  type PluginManifest,
  type PluginSignature,
} from '@gamecrafter/contracts';
import type { Database } from '../db/database';
import type { SettingsService } from '../settings/settings-service';
import { cloneGitRepository, downloadToFile, extractArchive } from '../skills/skill-installer';
import { loadSkillDir } from '../skills/skill-loader';
import { resolveSource, type SkillSource } from '../skills/skill-sources';
import { loadRoleDir } from '../roles/role-loader';

const manifestValidator = compile<PluginManifest>(PluginManifestSchema);
const manifestName = 'gamecrafter-plugin.json';
const signature: PluginSignature = { status: 'unsigned' };

interface PluginDatabaseRow {
  pluginId: string;
  version: string;
  manifest: string;
  installPath: string;
  sourceKind: InstalledPlugin['source']['kind'];
  sourceRef: string;
  sha256: string;
  signature: string;
  installedAt: string;
  enabled: number;
  trust: string | null;
}

type SettingsReader = Pick<SettingsService, 'resolve'>;

export interface PluginInstallerOptions {
  database: Database;
  profileDir: string;
  platformVersion: string;
  settings: SettingsReader;
  now?: () => Date;
}

export class PluginInstaller {
  private readonly now: () => Date;
  private readonly pluginsDirectory: string;

  constructor(private readonly options: PluginInstallerOptions) {
    this.now = options.now ?? (() => new Date());
    this.pluginsDirectory = path.join(options.profileDir, 'plugins');
  }

  async inspect(sourceText: string): Promise<PluginInspection> {
    const prepared = await this.prepareSource(sourceText);
    try {
      const manifest = this.readAndValidateManifest(prepared.root);
      this.validateCompatibility(manifest);
      this.validateDependencies(manifest);
      return {
        manifest,
        sha256: prepared.sha256,
        signature,
        capabilities: manifest.capabilities,
        warnings: [
          'Plugin signatures are not verified by this build.',
          ...(this.get(manifest.id) && this.get(manifest.id)!.version !== manifest.version
            ? [
                `Installing v${manifest.version} upgrades v${this.get(manifest.id)!.version}; existing settings are validated and migrated without uninstalling. Previously running workers are restarted.`,
              ]
            : []),
          ...(manifest.migrations.some((migration) => migration.operations?.length)
            ? [
                'This manifest declares settings transformations. Review its migration descriptions and operations; explicit remove operations delete matching overrides.',
              ]
            : []),
          ...(manifest.capabilities.some(
            (capability) => typeof capability === 'object' && capability.hosts.length > 0,
          )
            ? ['Outbound host allow-lists cannot be enforced by the current isolation launcher.']
            : []),
        ],
      };
    } finally {
      prepared.cleanup();
    }
  }

  async install(
    sourceText: string,
    acceptCapabilities: PluginCapability[],
    hooks?: {
      prepare(next: InstalledPlugin, previous?: InstalledPlugin): Promise<void>;
      commit(next: InstalledPlugin, previous?: InstalledPlugin): void;
      activated(next: InstalledPlugin, previous?: InstalledPlugin): void;
    },
  ): Promise<InstalledPlugin> {
    const prepared = await this.prepareSource(sourceText);
    let destination: string | undefined;
    let installedNewPath = false;
    let committed = false;
    try {
      const manifest = this.readAndValidateManifest(prepared.root);
      this.validateCompatibility(manifest);
      this.validateDependencies(manifest);
      if (!equalPluginCapabilities(acceptCapabilities, manifest.capabilities)) {
        throw new RpcError(
          `Accepted capabilities must exactly match plugin ${manifest.id}'s request.`,
          RpcErrorCode.PluginCapabilitiesNotAccepted,
        );
      }
      const existing = this.get(manifest.id);
      if (existing) {
        if (existing.version === manifest.version && existing.sha256 === prepared.sha256)
          return existing;
        if (!hooks || !semver.gt(manifest.version, existing.version))
          throw new RpcError(
            `Plugin ${manifest.id} requires a forward version upgrade through the plugin service.`,
            RpcErrorCode.PluginManifestInvalid,
          );
        for (const dependent of this.list()) {
          const range = dependent.manifest.dependencies.plugins[manifest.id];
          if (
            dependent.pluginId !== manifest.id &&
            range &&
            !semver.satisfies(manifest.version, range)
          )
            throw new RpcError(
              `Installed plugin ${dependent.pluginId} requires ${manifest.id}@${range}.`,
              RpcErrorCode.PluginDependencyMissing,
            );
        }
      }
      const installedAt = this.now().toISOString();
      const trust = { acceptedCapabilities: manifest.capabilities, acceptedAt: installedAt };
      destination = path.join(this.pluginsDirectory, manifest.id, manifest.version);
      if (existsSync(destination)) {
        throw new RpcError(
          `Plugin installation path already exists: ${destination}`,
          RpcErrorCode.PluginManifestInvalid,
        );
      }
      const parent = path.dirname(destination);
      mkdirSync(parent, { recursive: true, mode: 0o700 });
      const stageRoot = mkdtempSync(path.join(parent, '.plugin-stage-'));
      const staged = path.join(stageRoot, manifest.version);
      try {
        copyPluginDirectory(prepared.root, staged);
        this.readAndValidateManifest(staged);
        renameSync(staged, destination);
        installedNewPath = true;
      } finally {
        rmSync(stageRoot, { recursive: true, force: true });
      }
      const installed: InstalledPlugin = {
        pluginId: manifest.id,
        version: manifest.version,
        manifest,
        installPath: destination,
        source: { kind: prepared.sourceKind, ref: prepared.sourceRef },
        sha256: prepared.sha256,
        signature,
        installedAt,
        enabled: existing?.enabled ?? true,
        trust,
      };
      compile(InstalledPluginSchema).assert(installed);
      await hooks?.prepare(installed, existing);
      this.options.database.transaction(() => {
        this.writeRecord(installed);
        hooks?.commit(installed, existing);
      });
      committed = true;
      hooks?.activated(installed, existing);
      return installed;
    } catch (error) {
      if (!committed && installedNewPath && destination)
        rmSync(destination, { recursive: true, force: true });
      throw error;
    } finally {
      prepared.cleanup();
    }
  }

  list(): InstalledPlugin[] {
    return this.options.database
      .prepare(
        `SELECT plugin_id AS pluginId, version, manifest, install_path AS installPath,
          source_kind AS sourceKind, source_ref AS sourceRef, sha256, signature,
          installed_at AS installedAt, enabled, trust
         FROM installed_plugins ORDER BY plugin_id`,
      )
      .all<PluginDatabaseRow>()
      .map(decodePluginRow);
  }

  get(pluginId: string): InstalledPlugin | undefined {
    const row = this.options.database
      .prepare(
        `SELECT plugin_id AS pluginId, version, manifest, install_path AS installPath,
          source_kind AS sourceKind, source_ref AS sourceRef, sha256, signature,
          installed_at AS installedAt, enabled, trust
         FROM installed_plugins WHERE plugin_id = ?`,
      )
      .get<PluginDatabaseRow>(pluginId);
    return row ? decodePluginRow(row) : undefined;
  }

  setEnabled(pluginId: string, enabled: boolean): InstalledPlugin {
    const installed = this.require(pluginId);
    this.options.database
      .prepare('UPDATE installed_plugins SET enabled = ? WHERE plugin_id = ?')
      .run(enabled ? 1 : 0, pluginId);
    return { ...installed, enabled };
  }

  uninstall(pluginId: string): InstalledPlugin {
    const installed = this.require(pluginId);
    const expectedPath = path.resolve(this.pluginsDirectory, pluginId, installed.version);
    const installPath = path.resolve(installed.installPath);
    if (installPath !== expectedPath || !isWithin(installPath, this.pluginsDirectory)) {
      throw new RpcError(
        'Plugin install path is outside the profile plugin directory.',
        RpcErrorCode.PluginManifestInvalid,
      );
    }
    const pluginDirectory = path.dirname(installPath);
    if (!isWithin(pluginDirectory, this.pluginsDirectory))
      throw new RpcError(
        'Plugin directory escapes the profile.',
        RpcErrorCode.PluginManifestInvalid,
      );
    if (existsSync(pluginDirectory)) rmSync(pluginDirectory, { recursive: true, force: true });
    this.options.database
      .prepare('DELETE FROM installed_plugins WHERE plugin_id = ?')
      .run(pluginId);
    this.options.database
      .prepare('DELETE FROM plugin_project_enablement WHERE plugin_id = ?')
      .run(pluginId);
    return installed;
  }

  private require(pluginId: string): InstalledPlugin {
    const installed = this.get(pluginId);
    if (!installed)
      throw new RpcError(`Plugin not found: ${pluginId}`, RpcErrorCode.PluginNotFound);
    return installed;
  }

  private async prepareSource(sourceText: string): Promise<PreparedPluginSource> {
    let source: SkillSource;
    try {
      source = resolveSource(sourceText);
    } catch (error) {
      throw new RpcError(errorMessage(error), RpcErrorCode.PluginManifestInvalid);
    }
    const stagingRoot = mkdtempSync(path.join(tmpdir(), 'gc-plugin-source-'));
    try {
      if (source.kind === 'local') {
        const stats = statSync(source.path);
        if (stats.isDirectory()) {
          ensureSafePluginTree(source.path, this.extractedLimitBytes(), this.maxFiles());
          return {
            root: source.path,
            sourceKind: 'local-dir',
            sourceRef: sourceText,
            sha256: digestDirectory(source.path),
            cleanup: () => rmSync(stagingRoot, { recursive: true, force: true }),
          };
        }
        if (stats.isFile() && isTarball(source.path)) {
          const extracted = path.join(stagingRoot, 'extracted');
          mkdirSync(extracted);
          await extractArchive(source.path, extracted, this.extractedLimitBytes(), this.maxFiles());
          return {
            root: findManifestRoot(extracted),
            sourceKind: 'archive',
            sourceRef: sourceText,
            sha256: digestFile(source.path),
            cleanup: () => rmSync(stagingRoot, { recursive: true, force: true }),
          };
        }
        throw new RpcError(
          `Local plugin source must be a directory or .tgz archive: ${source.path}`,
          RpcErrorCode.PluginManifestInvalid,
        );
      }
      if (source.kind === 'git') {
        const checkout = path.join(stagingRoot, 'checkout');
        const resolvedRef = await cloneGitRepository(source.url, source.ref, checkout);
        ensureSafePluginTree(checkout, this.extractedLimitBytes(), this.maxFiles());
        return {
          root: findManifestRoot(checkout),
          sourceKind: 'git',
          sourceRef: `${source.url}#${resolvedRef}`,
          sha256: digestDirectory(checkout),
          cleanup: () => rmSync(stagingRoot, { recursive: true, force: true }),
        };
      }
      if (source.kind === 'archive-url') {
        const archive = path.join(stagingRoot, 'plugin.tgz');
        await downloadToFile(source.url, archive, this.archiveLimitBytes());
        const extracted = path.join(stagingRoot, 'extracted');
        mkdirSync(extracted);
        await extractArchive(archive, extracted, this.extractedLimitBytes(), this.maxFiles());
        return {
          root: findManifestRoot(extracted),
          sourceKind: 'archive',
          sourceRef: sourceText,
          sha256: digestFile(archive),
          cleanup: () => rmSync(stagingRoot, { recursive: true, force: true }),
        };
      }
      throw new RpcError(
        'Plugins support local directories, .tgz archives, and Git repositories only.',
        RpcErrorCode.PluginManifestInvalid,
      );
    } catch (error) {
      rmSync(stagingRoot, { recursive: true, force: true });
      if (error instanceof RpcError && error.code === RpcErrorCode.PluginManifestInvalid)
        throw error;
      throw new RpcError(errorMessage(error), RpcErrorCode.PluginManifestInvalid);
    }
  }

  private readAndValidateManifest(root: string): PluginManifest {
    let manifest: unknown;
    try {
      const manifestPath = path.join(root, manifestName);
      if (lstatSync(manifestPath).isSymbolicLink() || !lstatSync(manifestPath).isFile()) {
        throw new Error('Plugin manifest must be a regular file.');
      }
      manifest = JSON.parse(readFileSync(manifestPath, 'utf8')) as unknown;
      manifest = manifestValidator.assert(manifest);
    } catch (error) {
      throw new RpcError(
        `Invalid plugin manifest: ${errorMessage(error)}`,
        RpcErrorCode.PluginManifestInvalid,
      );
    }
    const typedManifest = manifest as PluginManifest;
    const validationErrors = validatePluginManifest(typedManifest);
    if (validationErrors.length > 0) {
      throw new RpcError(validationErrors.join(' '), RpcErrorCode.PluginManifestInvalid, {
        errors: validationErrors,
      });
    }
    for (const tool of typedManifest.contributes.tools) {
      try {
        compileJsonSchema2020(tool.inputSchema as Parameters<typeof compileJsonSchema2020>[0]);
        if (tool.outputSchema !== undefined) {
          compileJsonSchema2020(tool.outputSchema as Parameters<typeof compileJsonSchema2020>[0]);
        }
      } catch (error) {
        throw new RpcError(
          `Invalid JSON Schema for plugin tool ${tool.toolId}: ${errorMessage(error)}`,
          RpcErrorCode.PluginManifestInvalid,
        );
      }
    }
    for (const relative of [
      typedManifest.runtime.entry,
      ...typedManifest.contributes.roles,
      ...typedManifest.contributes.skills,
      ...typedManifest.contributes.ui.panels.map((panel) => panel.source),
    ]) {
      if (!relativePluginPath(relative)) {
        throw new RpcError(
          `Plugin contribution path is unsafe: ${relative}`,
          RpcErrorCode.PluginManifestInvalid,
        );
      }
      const target = path.resolve(root, relative);
      if (!isWithin(target, root)) {
        throw new RpcError(
          `Plugin contribution path escapes the package: ${relative}`,
          RpcErrorCode.PluginManifestInvalid,
        );
      }
      rejectSymlinkPath(root, target);
    }
    const runtimePath = path.resolve(root, typedManifest.runtime.entry);
    if (!existsSync(runtimePath) || !lstatSync(runtimePath).isFile()) {
      throw new RpcError(
        `Plugin runtime entry does not exist: ${typedManifest.runtime.entry}`,
        RpcErrorCode.PluginManifestInvalid,
      );
    }
    for (const roleDirectory of typedManifest.contributes.roles) {
      const rolePath = path.join(root, roleDirectory);
      if (!existsSync(path.join(rolePath, 'ROLE.md'))) {
        throw new RpcError(
          `Plugin role is missing ROLE.md: ${roleDirectory}`,
          RpcErrorCode.PluginManifestInvalid,
        );
      }
      try {
        loadRoleDir(rolePath, 'platform', 'plugin');
      } catch (error) {
        throw new RpcError(
          `Invalid plugin role ${roleDirectory}: ${errorMessage(error)}`,
          RpcErrorCode.PluginManifestInvalid,
        );
      }
    }
    for (const skillDirectory of typedManifest.contributes.skills) {
      const skillPath = path.join(root, skillDirectory);
      if (!existsSync(path.join(skillPath, 'SKILL.md'))) {
        throw new RpcError(
          `Plugin skill is missing SKILL.md: ${skillDirectory}`,
          RpcErrorCode.PluginManifestInvalid,
        );
      }
      try {
        loadSkillDir(skillPath, 'platform', `plugin:${typedManifest.id}`);
      } catch (error) {
        throw new RpcError(
          `Invalid plugin skill ${skillDirectory}: ${errorMessage(error)}`,
          RpcErrorCode.PluginManifestInvalid,
        );
      }
    }
    return typedManifest;
  }

  private validateCompatibility(manifest: PluginManifest): void {
    if (!semver.valid(manifest.version)) {
      throw new RpcError(
        `Invalid plugin version: ${manifest.version}`,
        RpcErrorCode.PluginManifestInvalid,
      );
    }
    if (!semver.validRange(manifest.compatibility.platform)) {
      throw new RpcError(
        `Invalid platform compatibility range: ${manifest.compatibility.platform}`,
        RpcErrorCode.PluginManifestInvalid,
      );
    }
    if (!semver.satisfies(this.options.platformVersion, manifest.compatibility.platform)) {
      throw new RpcError(
        `Plugin ${manifest.id} requires platform ${manifest.compatibility.platform}; current platform is ${this.options.platformVersion}.`,
        RpcErrorCode.PluginIncompatible,
      );
    }
    const fromVersions = new Set<string>();
    for (const migration of manifest.migrations) {
      if (!semver.valid(migration.from) || !semver.valid(migration.to)) {
        throw new RpcError(
          'Plugin migration versions must be valid semver.',
          RpcErrorCode.PluginManifestInvalid,
        );
      }
      if (
        !semver.gt(migration.to, migration.from) ||
        semver.gt(migration.to, manifest.version) ||
        fromVersions.has(migration.from)
      )
        throw new RpcError(
          'Plugin migrations must be unambiguous forward version transitions.',
          RpcErrorCode.PluginManifestInvalid,
        );
      fromVersions.add(migration.from);
      for (const operation of migration.operations ?? []) {
        const keys = operation.kind === 'rename' ? [operation.from, operation.to] : [operation.key];
        if (keys.some((key) => !key.startsWith(`plugin.${manifest.id}.`)))
          throw new RpcError(
            'Plugin migrations may only change their own setting namespace.',
            RpcErrorCode.PluginManifestInvalid,
          );
      }
    }
  }

  private validateDependencies(manifest: PluginManifest): void {
    for (const [pluginId, range] of Object.entries(manifest.dependencies.plugins)) {
      const dependency = this.get(pluginId);
      if (
        !dependency ||
        !semver.validRange(range) ||
        !semver.satisfies(dependency.version, range)
      ) {
        throw new RpcError(
          `Plugin dependency ${pluginId}@${range} is missing or incompatible.`,
          RpcErrorCode.PluginDependencyMissing,
        );
      }
    }
  }

  private writeRecord(plugin: InstalledPlugin): void {
    this.options.database
      .prepare(
        `INSERT INTO installed_plugins
          (plugin_id, version, manifest, install_path, source_kind, source_ref, sha256,
           signature, installed_at, enabled, trust)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT(plugin_id) DO UPDATE SET version=excluded.version, manifest=excluded.manifest,
           install_path=excluded.install_path, source_kind=excluded.source_kind, source_ref=excluded.source_ref,
           sha256=excluded.sha256, signature=excluded.signature, installed_at=excluded.installed_at,
           enabled=excluded.enabled, trust=excluded.trust`,
      )
      .run(
        plugin.pluginId,
        plugin.version,
        JSON.stringify(plugin.manifest),
        plugin.installPath,
        plugin.source.kind,
        plugin.source.ref,
        plugin.sha256,
        JSON.stringify(plugin.signature),
        plugin.installedAt,
        plugin.enabled ? 1 : 0,
        JSON.stringify(plugin.trust),
      );
  }

  private archiveLimitBytes(): number {
    return settingMiB(this.options.settings, 'skills.installLimits.archiveMiB');
  }

  private extractedLimitBytes(): number {
    return settingMiB(this.options.settings, 'skills.installLimits.extractedMiB');
  }

  private maxFiles(): number {
    const value = Number(this.options.settings.resolve('skills.installLimits.maxFiles').value);
    return Number.isFinite(value) ? Math.max(0, Math.floor(value)) : 1000;
  }
}

interface PreparedPluginSource {
  root: string;
  sourceKind: InstalledPlugin['source']['kind'];
  sourceRef: string;
  sha256: string;
  cleanup(): void;
}

function decodePluginRow(row: PluginDatabaseRow): InstalledPlugin {
  return {
    pluginId: row.pluginId,
    version: row.version,
    manifest: JSON.parse(row.manifest) as PluginManifest,
    installPath: row.installPath,
    source: { kind: row.sourceKind, ref: row.sourceRef },
    sha256: row.sha256,
    signature: JSON.parse(row.signature) as PluginSignature,
    installedAt: row.installedAt,
    enabled: row.enabled === 1,
    trust: row.trust ? (JSON.parse(row.trust) as InstalledPlugin['trust']) : null,
  };
}

function findManifestRoot(root: string): string {
  if (existsSync(path.join(root, manifestName))) return root;
  const candidates = readdirSync(root, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && !entry.isSymbolicLink())
    .map((entry) => path.join(root, entry.name))
    .filter((directory) => existsSync(path.join(directory, manifestName)));
  if (candidates.length !== 1) {
    throw new RpcError(
      `Plugin source must contain exactly one ${manifestName} at its root or one child directory.`,
      RpcErrorCode.PluginManifestInvalid,
    );
  }
  return candidates[0]!;
}

function ensureSafePluginTree(root: string, maxBytes: number, maxFiles: number): void {
  const totals = { bytes: 0, files: 0 };
  const visit = (directory: string): void => {
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
      if (entry.name === '.git' || entry.name === 'node_modules') continue;
      const filePath = path.join(directory, entry.name);
      const stat = lstatSync(filePath);
      if (stat.isSymbolicLink()) {
        throw new RpcError(
          `Plugin package contains a symbolic link: ${filePath}`,
          RpcErrorCode.PluginManifestInvalid,
        );
      }
      if (stat.isDirectory()) visit(filePath);
      else if (stat.isFile()) {
        totals.files += 1;
        totals.bytes += stat.size;
        if (totals.files > maxFiles || totals.bytes > maxBytes) {
          throw new RpcError(
            'Plugin package exceeds installation size or file-count limits.',
            RpcErrorCode.PluginManifestInvalid,
          );
        }
      }
    }
  };
  visit(root);
}

function digestDirectory(root: string): string {
  const hash = createHash('sha256');
  const files: string[] = [];
  const visit = (directory: string): void => {
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
      if (entry.name === '.git' || entry.name === 'node_modules') continue;
      const absolute = path.join(directory, entry.name);
      const stat = lstatSync(absolute);
      if (stat.isSymbolicLink()) {
        throw new RpcError(
          `Plugin package contains a symbolic link: ${absolute}`,
          RpcErrorCode.PluginManifestInvalid,
        );
      }
      if (stat.isDirectory()) visit(absolute);
      else if (stat.isFile()) files.push(path.relative(root, absolute).split(path.sep).join('/'));
    }
  };
  visit(root);
  for (const relative of files.sort()) {
    hash.update(relative);
    hash.update('\0');
    hash.update(readFileSync(path.join(root, ...relative.split('/'))));
    hash.update('\0');
  }
  return hash.digest('hex');
}

function digestFile(filePath: string): string {
  return createHash('sha256').update(readFileSync(filePath)).digest('hex');
}

function copyPluginDirectory(source: string, destination: string): void {
  ensureSafePluginTree(source, Number.MAX_SAFE_INTEGER, Number.MAX_SAFE_INTEGER);
  cpSync(source, destination, {
    recursive: true,
    filter: (filePath) => {
      const relative = path.relative(source, filePath).split(path.sep).join('/');
      return (
        relative !== '.git' &&
        !relative.startsWith('.git/') &&
        relative !== 'node_modules' &&
        !relative.startsWith('node_modules/')
      );
    },
  });
}

function rejectSymlinkPath(root: string, target: string): void {
  const relative = path.relative(root, target);
  let current = root;
  for (const component of relative.split(path.sep)) {
    current = path.join(current, component);
    if (lstatSync(current).isSymbolicLink()) {
      throw new RpcError(
        `Plugin package path contains a symbolic link: ${relative}`,
        RpcErrorCode.PluginManifestInvalid,
      );
    }
  }
}

function isTarball(filePath: string): boolean {
  return /\.(?:tgz|tar\.gz)$/i.test(filePath);
}

function isWithin(candidate: string, parent: string): boolean {
  const relative = path.relative(path.resolve(parent), path.resolve(candidate));
  return relative === '' || (!relative.startsWith('..') && !path.isAbsolute(relative));
}

function settingMiB(settings: SettingsReader, key: string): number {
  const value = Number(settings.resolve(key).value);
  return Number.isFinite(value) ? Math.max(1, Math.floor(value)) * 1024 * 1024 : 10 * 1024 * 1024;
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

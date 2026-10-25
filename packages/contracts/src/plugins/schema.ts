import { Static, Type } from '@sinclair/typebox';
import { ExecutionModeSchema, SideEffectSchema, ToolIdSchema } from '../tools';
import { SettingDefinitionSchema, SettingsScope } from '../settings/schema';

export const PLUGIN_PROTOCOL_VERSION = 1;

export const PluginCapabilitySchema = Type.Union([
  Type.Literal('fs.project.read'),
  Type.Literal('fs.project.write'),
  Type.Literal('process.spawn'),
  Type.Literal('network.outbound'),
  Type.Literal('tools.call'),
  Type.Literal('models.complete'),
  Type.Literal('board.read'),
  Type.Literal('board.post'),
  Type.Literal('secrets.read'),
  Type.Object(
    {
      capability: Type.Literal('network.outbound'),
      hosts: Type.Array(Type.String({ minLength: 1 })),
    },
    { additionalProperties: false },
  ),
]);
export type PluginCapability = Static<typeof PluginCapabilitySchema>;

const RelativeEntrySchema = Type.String({
  minLength: 1,
  pattern: '^(?![A-Za-z]:)(?![/\\\\])(?!.*(?:^|[/\\\\])\\.\\.(?:[/\\\\]|$)).+$',
});

export const PluginPublisherSchema = Type.Object(
  {
    name: Type.String({ minLength: 1 }),
    url: Type.Optional(Type.String({ format: 'uri' })),
    keyId: Type.Optional(Type.String()),
  },
  { additionalProperties: false },
);
export type PluginPublisher = Static<typeof PluginPublisherSchema>;

export const PluginContributedToolSchema = Type.Object(
  {
    toolId: ToolIdSchema,
    title: Type.String({ minLength: 1 }),
    description: Type.String(),
    inputSchema: Type.Unknown(),
    outputSchema: Type.Optional(Type.Unknown()),
    executionMode: ExecutionModeSchema,
    sideEffects: SideEffectSchema,
    evidence: Type.String(),
  },
  { additionalProperties: false },
);
export type PluginContributedTool = Static<typeof PluginContributedToolSchema>;

export const PluginModuleContributionSchema = Type.Object(
  {
    id: Type.String({ minLength: 1 }),
    name: Type.String({ minLength: 1 }),
    description: Type.String(),
    requires: Type.Array(Type.String()),
    suggests: Type.Array(Type.String()),
    records: Type.Array(Type.String()),
  },
  { additionalProperties: false },
);
export type PluginModuleContribution = Static<typeof PluginModuleContributionSchema>;

export const PluginGenreContributionSchema = Type.Object(
  {
    id: Type.String({ minLength: 1 }),
    name: Type.String({ minLength: 1 }),
    description: Type.String(),
    requiredModules: Type.Array(Type.String()),
    optionalModules: Type.Array(Type.String()),
    roles: Type.Array(Type.String()),
  },
  { additionalProperties: false },
);
export type PluginGenreContribution = Static<typeof PluginGenreContributionSchema>;

export const PluginRecordTypeContributionSchema = Type.Object(
  {
    type: Type.String({
      minLength: 1,
      maxLength: 80,
      pattern: '^[a-z][a-z0-9]*(?:[.-][a-z0-9]+)*$',
    }),
    name: Type.String({ minLength: 1 }),
    description: Type.String(),
    requiredFields: Type.Array(Type.String({ minLength: 1 }), { uniqueItems: true }),
  },
  { additionalProperties: false },
);
export type PluginRecordTypeContribution = Static<typeof PluginRecordTypeContributionSchema>;

export const PluginPanelContributionSchema = Type.Object(
  {
    id: Type.String({ minLength: 1 }),
    title: Type.String({ minLength: 1 }),
    kind: Type.Literal('declarative'),
    source: RelativeEntrySchema,
    placement: Type.Union([Type.Literal('main'), Type.Literal('side')]),
  },
  { additionalProperties: false },
);
export type PluginPanelContribution = Static<typeof PluginPanelContributionSchema>;

export const PluginCommandContributionSchema = Type.Object(
  {
    id: Type.String({ minLength: 1 }),
    title: Type.String({ minLength: 1 }),
    toolId: ToolIdSchema,
  },
  { additionalProperties: false },
);
export type PluginCommandContribution = Static<typeof PluginCommandContributionSchema>;

const migrationScopes = {
  scopes: Type.Optional(Type.Array(SettingsScope, { minItems: 1, uniqueItems: true })),
};
export const PluginSettingsOperationSchema = Type.Union([
  Type.Object(
    {
      kind: Type.Literal('rename'),
      from: Type.String({ minLength: 1 }),
      to: Type.String({ minLength: 1 }),
      ...migrationScopes,
    },
    { additionalProperties: false },
  ),
  Type.Object(
    { kind: Type.Literal('remove'), key: Type.String({ minLength: 1 }), ...migrationScopes },
    { additionalProperties: false },
  ),
  Type.Object(
    {
      kind: Type.Literal('map-values'),
      key: Type.String({ minLength: 1 }),
      values: Type.Array(
        Type.Object({ from: Type.Unknown(), to: Type.Unknown() }, { additionalProperties: false }),
        { minItems: 1 },
      ),
      ...migrationScopes,
    },
    { additionalProperties: false },
  ),
]);
export type PluginSettingsOperation = Static<typeof PluginSettingsOperationSchema>;
export const PluginSettingsUpgradeSchema = Type.Object(
  {
    schemaVersion: Type.Literal(1),
    pluginId: Type.String({ minLength: 1 }),
    from: Type.String(),
    to: Type.String(),
    operations: Type.Array(PluginSettingsOperationSchema),
    definitions: Type.Array(SettingDefinitionSchema),
  },
  { additionalProperties: false },
);
export type PluginSettingsUpgrade = Static<typeof PluginSettingsUpgradeSchema>;

export const PluginManifestSchema = Type.Object(
  {
    schemaVersion: Type.Literal(1),
    id: Type.String({
      maxLength: 128,
      pattern: '^[a-z0-9][a-z0-9-]*(\\.[a-z0-9][a-z0-9-]*)*$',
    }),
    name: Type.String({ minLength: 1 }),
    version: Type.String({ minLength: 1 }),
    description: Type.String(),
    publisher: PluginPublisherSchema,
    license: Type.String({ minLength: 1 }),
    homepage: Type.Optional(Type.String({ format: 'uri' })),
    compatibility: Type.Object(
      { platform: Type.String({ minLength: 1 }), protocol: Type.Literal(1) },
      { additionalProperties: false },
    ),
    runtime: Type.Object(
      {
        kind: Type.Union([
          Type.Literal('node'),
          Type.Literal('python'),
          Type.Literal('executable'),
        ]),
        entry: RelativeEntrySchema,
        args: Type.Array(Type.String()),
        interpreter: Type.Optional(Type.String()),
      },
      { additionalProperties: false },
    ),
    capabilities: Type.Array(PluginCapabilitySchema),
    contributes: Type.Object(
      {
        tools: Type.Array(PluginContributedToolSchema),
        modules: Type.Array(PluginModuleContributionSchema),
        genres: Type.Array(PluginGenreContributionSchema),
        recordTypes: Type.Optional(Type.Array(PluginRecordTypeContributionSchema)),
        roles: Type.Array(RelativeEntrySchema),
        skills: Type.Array(RelativeEntrySchema),
        settings: Type.Array(SettingDefinitionSchema),
        ui: Type.Object(
          {
            panels: Type.Array(PluginPanelContributionSchema),
            commands: Type.Array(PluginCommandContributionSchema),
          },
          { additionalProperties: false },
        ),
      },
      { additionalProperties: false },
    ),
    dependencies: Type.Object(
      { plugins: Type.Record(Type.String(), Type.String()) },
      { additionalProperties: false },
    ),
    migrations: Type.Array(
      Type.Object(
        {
          from: Type.String({ minLength: 1 }),
          to: Type.String({ minLength: 1 }),
          description: Type.String(),
          operations: Type.Optional(Type.Array(PluginSettingsOperationSchema)),
        },
        { additionalProperties: false },
      ),
    ),
  },
  { additionalProperties: false },
);
export type PluginManifest = Static<typeof PluginManifestSchema>;

export const PluginSignatureSchema = Type.Object(
  {
    status: Type.Union([
      Type.Literal('unsigned'),
      Type.Literal('verified'),
      Type.Literal('invalid'),
    ]),
    keyId: Type.Optional(Type.String()),
  },
  { additionalProperties: false },
);
export type PluginSignature = Static<typeof PluginSignatureSchema>;

export const InstalledPluginSchema = Type.Object(
  {
    pluginId: Type.String(),
    version: Type.String(),
    manifest: PluginManifestSchema,
    installPath: Type.String(),
    source: Type.Object(
      {
        kind: Type.Union([Type.Literal('local-dir'), Type.Literal('archive'), Type.Literal('git')]),
        ref: Type.String(),
      },
      { additionalProperties: false },
    ),
    sha256: Type.String({ pattern: '^[a-f0-9]{64}$' }),
    signature: PluginSignatureSchema,
    installedAt: Type.String({ format: 'date-time' }),
    enabled: Type.Boolean(),
    trust: Type.Union([
      Type.Object(
        {
          acceptedCapabilities: Type.Array(PluginCapabilitySchema),
          acceptedAt: Type.String({ format: 'date-time' }),
        },
        { additionalProperties: false },
      ),
      Type.Null(),
    ]),
  },
  { additionalProperties: false },
);
export type InstalledPlugin = Static<typeof InstalledPluginSchema>;

export const PluginProjectEnablementSchema = Type.Object(
  {
    projectId: Type.String({ format: 'uuid' }),
    pluginId: Type.String(),
    enabled: Type.Boolean(),
  },
  { additionalProperties: false },
);
export type PluginProjectEnablement = Static<typeof PluginProjectEnablementSchema>;

export const PluginWorkerStateSchema = Type.Object(
  {
    pluginId: Type.String(),
    projectId: Type.Union([Type.String({ format: 'uuid' }), Type.Null()]),
    status: Type.Union([
      Type.Literal('stopped'),
      Type.Literal('starting'),
      Type.Literal('running'),
      Type.Literal('failed'),
    ]),
    isolation: Type.Object(
      {
        backend: Type.Union([
          Type.Literal('bwrap'),
          Type.Literal('appcontainer'),
          Type.Literal('none'),
        ]),
        enforced: Type.Boolean(),
        details: Type.Array(Type.String()),
      },
      { additionalProperties: false },
    ),
    pid: Type.Union([Type.Integer(), Type.Null()]),
    startedAt: Type.Union([Type.String({ format: 'date-time' }), Type.Null()]),
    lastError: Type.Union([Type.String(), Type.Null()]),
    restarts: Type.Integer({ minimum: 0 }),
  },
  { additionalProperties: false },
);
export type PluginWorkerState = Static<typeof PluginWorkerStateSchema>;

export const IsolationReportSchema = Type.Object(
  {
    platform: Type.Union([Type.Literal('linux'), Type.Literal('win32')]),
    backend: Type.Union([
      Type.Literal('bwrap'),
      Type.Literal('appcontainer'),
      Type.Literal('none'),
    ]),
    available: Type.Boolean(),
    checks: Type.Array(
      Type.Object(
        { name: Type.String(), ok: Type.Boolean(), detail: Type.String() },
        { additionalProperties: false },
      ),
    ),
  },
  { additionalProperties: false },
);
export type IsolationReport = Static<typeof IsolationReportSchema>;

export const DeclarativePanelSectionSchema = Type.Union([
  Type.Object(
    { kind: Type.Literal('markdown'), body: Type.String() },
    { additionalProperties: false },
  ),
  Type.Object(
    { kind: Type.Literal('tool-form'), toolId: ToolIdSchema, submitLabel: Type.String() },
    { additionalProperties: false },
  ),
  Type.Object(
    { kind: Type.Literal('tool-table'), toolId: ToolIdSchema, columns: Type.Array(Type.String()) },
    { additionalProperties: false },
  ),
]);
export type DeclarativePanelSection = Static<typeof DeclarativePanelSectionSchema>;

export const DeclarativePanelSchema = Type.Object(
  {
    schemaVersion: Type.Literal(1),
    title: Type.String({ minLength: 1 }),
    sections: Type.Array(DeclarativePanelSectionSchema),
  },
  { additionalProperties: false },
);
export type DeclarativePanel = Static<typeof DeclarativePanelSchema>;

export const PluginLogEntrySchema = Type.Object(
  {
    at: Type.String({ format: 'date-time' }),
    level: Type.Union([
      Type.Literal('debug'),
      Type.Literal('info'),
      Type.Literal('warning'),
      Type.Literal('error'),
    ]),
    message: Type.String(),
  },
  { additionalProperties: false },
);
export type PluginLogEntry = Static<typeof PluginLogEntrySchema>;

export const PluginInspectionSchema = Type.Object(
  {
    manifest: PluginManifestSchema,
    sha256: Type.String({ pattern: '^[a-f0-9]{64}$' }),
    signature: PluginSignatureSchema,
    capabilities: Type.Array(PluginCapabilitySchema),
    warnings: Type.Array(Type.String()),
  },
  { additionalProperties: false },
);
export type PluginInspection = Static<typeof PluginInspectionSchema>;

export const PluginListEntrySchema = Type.Object(
  {
    installed: InstalledPluginSchema,
    projectEnabled: Type.Union([Type.Boolean(), Type.Null()]),
    worker: Type.Union([PluginWorkerStateSchema, Type.Null()]),
  },
  { additionalProperties: false },
);
export type PluginListEntry = Static<typeof PluginListEntrySchema>;

export const PluginModuleEntrySchema = Type.Object(
  {
    pluginId: Type.String(),
    active: Type.Boolean(),
    module: PluginModuleContributionSchema,
  },
  { additionalProperties: false },
);
export const PluginGenreEntrySchema = Type.Object(
  {
    pluginId: Type.String(),
    active: Type.Boolean(),
    genre: PluginGenreContributionSchema,
  },
  { additionalProperties: false },
);
export type PluginGenreEntry = Static<typeof PluginGenreEntrySchema>;

export const PluginModuleConflictSchema = Type.Object(
  { id: Type.String(), pluginIds: Type.Array(Type.String()) },
  { additionalProperties: false },
);
export type PluginModuleConflict = Static<typeof PluginModuleConflictSchema>;

export const PluginModulesResultSchema = Type.Object(
  {
    modules: Type.Array(PluginModuleEntrySchema),
    genres: Type.Array(PluginGenreEntrySchema),
    conflicts: Type.Array(PluginModuleConflictSchema),
  },
  { additionalProperties: false },
);
export type PluginModulesResult = Static<typeof PluginModulesResultSchema>;

export function validatePluginManifest(manifest: PluginManifest): string[] {
  const errors: string[] = [];
  for (const tool of manifest.contributes.tools) {
    if (!tool.toolId.startsWith(`${manifest.id}/`)) {
      errors.push(`toolId must begin with ${manifest.id}/: ${tool.toolId}`);
    }
  }
  for (const setting of manifest.contributes.settings) {
    if (!setting.key.startsWith(`plugin.${manifest.id}.`)) {
      errors.push(`setting key must begin with plugin.${manifest.id}.: ${setting.key}`);
    }
  }
  return errors;
}

export function pluginCapabilityName(capability: PluginCapability): string {
  return typeof capability === 'string' ? capability : capability.capability;
}

export function pluginCapabilityKey(capability: PluginCapability): string {
  return typeof capability === 'string'
    ? capability
    : `${capability.capability}:${[...capability.hosts].sort().join(',')}`;
}

export function equalPluginCapabilities(
  accepted: PluginCapability[],
  requested: PluginCapability[],
): boolean {
  const left = accepted.map(pluginCapabilityKey).sort();
  const right = requested.map(pluginCapabilityKey).sort();
  return (
    left.length === right.length && left.every((capability, index) => capability === right[index])
  );
}

export function relativePluginPath(value: string): boolean {
  return value.length > 0 && !pathLikeAbsolute(value) && !value.split(/[\\/]+/).includes('..');
}

function pathLikeAbsolute(value: string): boolean {
  return value.startsWith('/') || value.startsWith('\\') || /^[A-Za-z]:/.test(value);
}

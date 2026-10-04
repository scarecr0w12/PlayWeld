import { Static, Type, type TSchema } from '@sinclair/typebox';
import {
  EngineFamily,
  ProjectCloneInputSchema,
  ProjectCreateInputSchema,
  ProjectSummarySchema,
} from '../project/manifest';
import {
  EngineCapabilityReportSchema,
  EngineInstallationKindSchema,
  EngineInstallationSchema,
  EngineOperationRunSchema,
  EngineOperationSchema,
} from '../engines';
import {
  AssetFileEntrySchema,
  AssetJobRequestSchema,
  AssetJobSchema,
  AssetJobStatusSchema,
  AssetPreviewSchema,
  AssetProviderAccountSchema,
  AssetProviderCapabilitiesSchema,
  AssetProviderKindSchema,
} from '../assets';
import {
  BackupArchiveEntrySchema,
  BackupDestinationConfigSchema,
  BackupDestinationKindSchema,
  BackupDestinationSchema,
  BackupIdentitySchema,
  BackupManifestSchema,
  BackupPlanSchema,
  BackupRestoreResultSchema,
  BackupRetentionSchema,
  BackupRunSchema,
  BackupScheduleSchema,
  BackupScopeSchema,
  BackupVerifyResultSchema,
} from '../backup';
import {
  ChangeEdgeSchema,
  ChangeNodeKindSchema,
  ChangeNodeRefSchema,
  ChangeNodeSchema,
  ChangeRequestSchema,
  FeedbackInputSchema,
  ImpactResultSchema,
  IntegrationRecordSchema,
  IntegrationStatusSchema,
  ResourceLockSchema,
  TaskTouchSchema,
} from '../change';
import {
  DccCapabilityReportSchema,
  DccInstallationKindSchema,
  DccInstallationSchema,
  DccOperationSchema,
  DccRunSchema,
  DccToolSchema,
} from '../dcc';
import {
  SettingsExportSchema,
  SettingsImportParamsSchema,
  SettingsImportResultSchema,
  EffectiveSettingSchema,
  SettingDefinitionSchema,
  SettingGroupSchema,
  SettingsScope,
} from '../settings/schema';
import {
  TaskBudgetSchema,
  TaskCreateInputSchema,
  TaskEventSchema,
  TaskQuestionSchema,
  TaskRecordSchema,
  TaskStateSchema,
} from '../tasks';
import {
  AccessModeSchema,
  ApprovalRequestSchema,
  ToolCallRecordSchema,
  ToolDefinitionSchema,
  ToolIdSchema,
} from '../tools';
import {
  ChatRequestSchema,
  ChatResponseSchema,
  ModelPoolSchema,
  ModelPoolTargetSchema,
  ModelPricingSchema,
  ModelSchema,
  ModelUsageSchema,
  ProviderAccountSchema,
  ProviderKindSchema,
  RouteDecisionSchema,
  RouteOutcomeSchema,
  RouteRequestSchema,
} from '../models';
import {
  ProjectSkillEntrySchema,
  RoleRecordSchema,
  SkillActivationSchema,
  SkillActivationResultSchema,
  SkillResourceReadParamsSchema,
  SkillResourceReadResultSchema,
  SkillCatalogEntrySchema,
  SkillEnablementSchema,
  SkillRecordSchema,
  SkillValidationResultSchema,
} from '../skills';
import { UpdateStateSchema } from '../updates';
import { ChatConversationSchema, ChatEntrySchema } from '../chat';
import {
  BindingDecisionSchema,
  BoardAuthorSchema,
  BoardLinkSchema,
  BoardMaintenanceStatusSchema,
  BoardMessageSchema,
  BoardMessageTypeSchema,
  BoardSubscriptionFilterSchema,
  BoardSubscriptionSchema,
  BoardSubscriptionSubscriberSchema,
  BoardThreadKindSchema,
  BoardThreadSchema,
  BoardThreadStatusSchema,
  CanonSyncProposalSchema,
} from '../board';
import {
  DeclarativePanelSchema,
  InstalledPluginSchema,
  IsolationReportSchema,
  PluginCapabilitySchema,
  PluginInspectionSchema,
  PluginListEntrySchema,
  PluginLogEntrySchema,
  PluginModulesResultSchema,
  PluginWorkerStateSchema,
} from '../plugins';
import {
  McpConnectionConfigSchema,
  McpConnectionInputSchema,
  McpConnectionListEntrySchema,
  McpConnectionPatchSchema,
  McpConnectionLogEntrySchema,
  McpConnectionStateChangedSchema,
  McpConnectionStateSchema,
  McpInputRequiredSchema,
  McpToolClassifySchema,
  McpToolsResultSchema,
} from '../mcp';
import {
  CanonIdSchema,
  CanonRecordInputSchema,
  CanonRecordSchema,
  CanonStatusSchema,
  EmbeddingProfileSchema,
  KnowledgeGraphSchema,
  KnowledgeIndexStateSchema,
  KnowledgeRecordListResultSchema,
  KnowledgeRecordResultSchema,
  KnowledgeSearchResultSchema,
  KnowledgeTaskResultSchema,
  KnowledgeVectorStoreTestResultSchema,
  RecordTypeSchema,
  SearchRequestSchema,
} from '../knowledge';

export const PROTOCOL_VERSION = 1;

const EmptyParams = Type.Object({}, { additionalProperties: false });
const ServiceInfoSchema = Type.Object(
  {
    serviceVersion: Type.String(),
    protocolVersion: Type.Integer(),
    pid: Type.Integer(),
    profileDir: Type.String(),
    startedAt: Type.String(),
    projectCount: Type.Integer(),
  },
  { additionalProperties: false },
);

export type ServiceInfo = Static<typeof ServiceInfoSchema>;

const ModelCompleteCommonFields = {
  request: ChatRequestSchema,
  projectId: Type.Optional(Type.String({ format: 'uuid' })),
  taskId: Type.Optional(Type.String({ format: 'uuid' })),
  requestId: Type.Optional(Type.String()),
};

export const ModelCompleteParamsSchema = Type.Union([
  Type.Object(
    { ...ModelCompleteCommonFields, modelId: Type.String() },
    { additionalProperties: false },
  ),
  Type.Object(
    { ...ModelCompleteCommonFields, route: RouteRequestSchema },
    { additionalProperties: false },
  ),
]);

export const RpcMethods = {
  'session/hello': {
    params: Type.Object(
      {
        token: Type.String(),
        clientName: Type.String(),
        clientVersion: Type.String(),
        protocolVersion: Type.Integer(),
      },
      { additionalProperties: false },
    ),
    result: Type.Object(
      {
        ok: Type.Literal(true),
        serviceVersion: Type.String(),
        protocolVersion: Type.Integer(),
        sessionId: Type.String({ format: 'uuid' }),
      },
      { additionalProperties: false },
    ),
  },
  'service/info': { params: EmptyParams, result: ServiceInfoSchema },
  'project/create': { params: ProjectCreateInputSchema, result: ProjectSummarySchema },
  'project/clone': { params: ProjectCloneInputSchema, result: ProjectSummarySchema },
  'project/list': {
    params: EmptyParams,
    result: Type.Object(
      { projects: Type.Array(ProjectSummarySchema) },
      { additionalProperties: false },
    ),
  },
  'project/open': {
    params: Type.Object({ path: Type.String() }, { additionalProperties: false }),
    result: ProjectSummarySchema,
  },
  'project/get': {
    params: Type.Object(
      { projectId: Type.String({ format: 'uuid' }) },
      { additionalProperties: false },
    ),
    result: ProjectSummarySchema,
  },
  'project/trust': {
    params: Type.Object(
      { projectId: Type.String({ format: 'uuid' }), trusted: Type.Boolean() },
      { additionalProperties: false },
    ),
    result: ProjectSummarySchema,
  },
  'engine/installations': {
    params: Type.Object({ family: Type.Optional(EngineFamily) }, { additionalProperties: false }),
    result: Type.Object(
      { installations: Type.Array(EngineInstallationSchema) },
      { additionalProperties: false },
    ),
  },
  'engine/addInstallation': {
    params: Type.Object(
      {
        family: EngineFamily,
        executable: Type.String({ minLength: 1 }),
        kind: EngineInstallationKindSchema,
      },
      { additionalProperties: false },
    ),
    result: EngineInstallationSchema,
  },
  'engine/removeInstallation': {
    params: Type.Object(
      { installationId: Type.String({ format: 'uuid' }) },
      { additionalProperties: false },
    ),
    result: Type.Object({ removed: Type.Literal(true) }, { additionalProperties: false }),
  },
  'engine/capabilities': {
    params: Type.Object(
      { projectId: Type.String({ format: 'uuid' }), refresh: Type.Optional(Type.Boolean()) },
      { additionalProperties: false },
    ),
    result: EngineCapabilityReportSchema,
  },
  'engine/run': {
    params: Type.Object(
      {
        projectId: Type.String({ format: 'uuid' }),
        operation: EngineOperationSchema,
        params: Type.Optional(Type.Record(Type.String(), Type.Unknown())),
        taskId: Type.Optional(Type.String({ format: 'uuid' })),
      },
      { additionalProperties: false },
    ),
    result: EngineOperationRunSchema,
  },
  'engine/runs': {
    params: Type.Object(
      {
        projectId: Type.String({ format: 'uuid' }),
        limit: Type.Optional(Type.Integer({ minimum: 1, maximum: 1000 })),
      },
      { additionalProperties: false },
    ),
    result: Type.Object(
      { runs: Type.Array(EngineOperationRunSchema) },
      { additionalProperties: false },
    ),
  },
  'engine/run/get': {
    params: Type.Object(
      { projectId: Type.String({ format: 'uuid' }), runId: Type.String({ format: 'uuid' }) },
      { additionalProperties: false },
    ),
    result: EngineOperationRunSchema,
  },
  'engine/setLiveBridge': {
    params: Type.Object(
      {
        projectId: Type.String({ format: 'uuid' }),
        connectionId: Type.Union([Type.String({ format: 'uuid' }), Type.Null()]),
      },
      { additionalProperties: false },
    ),
    result: Type.Object(
      { connectionId: Type.Union([Type.String({ format: 'uuid' }), Type.Null()]) },
      { additionalProperties: false },
    ),
  },
  'dcc/installations': {
    params: Type.Object({ tool: Type.Optional(DccToolSchema) }, { additionalProperties: false }),
    result: Type.Object(
      { installations: Type.Array(DccInstallationSchema) },
      { additionalProperties: false },
    ),
  },
  'dcc/addInstallation': {
    params: Type.Object(
      {
        tool: DccToolSchema,
        executable: Type.String({ minLength: 1 }),
        kind: DccInstallationKindSchema,
      },
      { additionalProperties: false },
    ),
    result: DccInstallationSchema,
  },
  'dcc/removeInstallation': {
    params: Type.Object(
      { installationId: Type.String({ format: 'uuid' }) },
      { additionalProperties: false },
    ),
    result: Type.Object({ removed: Type.Literal(true) }, { additionalProperties: false }),
  },
  'dcc/capabilities': {
    params: Type.Object(
      {
        projectId: Type.String({ format: 'uuid' }),
        tool: DccToolSchema,
        refresh: Type.Optional(Type.Boolean()),
      },
      { additionalProperties: false },
    ),
    result: DccCapabilityReportSchema,
  },
  'dcc/run': {
    params: Type.Object(
      {
        projectId: Type.String({ format: 'uuid' }),
        tool: DccToolSchema,
        operation: DccOperationSchema,
        params: Type.Optional(Type.Record(Type.String(), Type.Unknown())),
        taskId: Type.Optional(Type.String({ format: 'uuid' })),
      },
      { additionalProperties: false },
    ),
    result: DccRunSchema,
  },
  'dcc/runs': {
    params: Type.Object(
      {
        projectId: Type.String({ format: 'uuid' }),
        tool: Type.Optional(DccToolSchema),
        limit: Type.Optional(Type.Integer({ minimum: 1, maximum: 1000 })),
      },
      { additionalProperties: false },
    ),
    result: Type.Object({ runs: Type.Array(DccRunSchema) }, { additionalProperties: false }),
  },
  'dcc/run/get': {
    params: Type.Object(
      { projectId: Type.String({ format: 'uuid' }), runId: Type.String({ format: 'uuid' }) },
      { additionalProperties: false },
    ),
    result: DccRunSchema,
  },
  'dcc/setLiveBridge': {
    params: Type.Object(
      {
        projectId: Type.String({ format: 'uuid' }),
        tool: DccToolSchema,
        connectionId: Type.Union([Type.String({ format: 'uuid' }), Type.Null()]),
      },
      { additionalProperties: false },
    ),
    result: Type.Object(
      { connectionId: Type.Union([Type.String({ format: 'uuid' }), Type.Null()]) },
      { additionalProperties: false },
    ),
  },
  'asset/providers': {
    params: EmptyParams,
    result: Type.Object(
      { providers: Type.Array(AssetProviderCapabilitiesSchema) },
      { additionalProperties: false },
    ),
  },
  'asset/accounts': {
    params: EmptyParams,
    result: Type.Object(
      { accounts: Type.Array(AssetProviderAccountSchema) },
      { additionalProperties: false },
    ),
  },
  'asset/addAccount': {
    params: Type.Object(
      {
        providerKind: AssetProviderKindSchema,
        displayName: Type.String({ minLength: 1 }),
        baseUrl: Type.Optional(Type.String({ format: 'uri' })),
        apiKey: Type.String({ minLength: 1 }),
        planTier: Type.Optional(Type.String()),
      },
      { additionalProperties: false },
    ),
    result: AssetProviderAccountSchema,
  },
  'asset/updateAccount': {
    params: Type.Object(
      {
        accountId: Type.String({ format: 'uuid' }),
        patch: Type.Object(
          {
            displayName: Type.Optional(Type.String({ minLength: 1 })),
            baseUrl: Type.Optional(Type.String({ format: 'uri' })),
            apiKey: Type.Optional(Type.Union([Type.String({ minLength: 1 }), Type.Null()])),
            planTier: Type.Optional(Type.Union([Type.String(), Type.Null()])),
            enabled: Type.Optional(Type.Boolean()),
          },
          { additionalProperties: false },
        ),
      },
      { additionalProperties: false },
    ),
    result: AssetProviderAccountSchema,
  },
  'asset/removeAccount': {
    params: Type.Object(
      { accountId: Type.String({ format: 'uuid' }) },
      { additionalProperties: false },
    ),
    result: Type.Object({ removed: Type.Literal(true) }, { additionalProperties: false }),
  },
  'asset/testAccount': {
    params: Type.Object(
      { accountId: Type.String({ format: 'uuid' }) },
      { additionalProperties: false },
    ),
    result: Type.Object(
      {
        ok: Type.Boolean(),
        latencyMs: Type.Integer({ minimum: 0 }),
        balance: Type.Union([Type.Number(), Type.Null()]),
        error: Type.Optional(Type.String()),
      },
      { additionalProperties: false },
    ),
  },
  'asset/generate': {
    params: Type.Object(
      {
        projectId: Type.String({ format: 'uuid' }),
        accountId: Type.String({ format: 'uuid' }),
        request: AssetJobRequestSchema,
        taskId: Type.Optional(Type.String({ format: 'uuid' })),
      },
      { additionalProperties: false },
    ),
    result: AssetJobSchema,
  },
  'asset/jobs': {
    params: Type.Object(
      {
        projectId: Type.String({ format: 'uuid' }),
        limit: Type.Optional(Type.Integer({ minimum: 1, maximum: 1000 })),
        status: Type.Optional(AssetJobStatusSchema),
      },
      { additionalProperties: false },
    ),
    result: Type.Object({ jobs: Type.Array(AssetJobSchema) }, { additionalProperties: false }),
  },
  'asset/job': {
    params: Type.Object(
      { projectId: Type.String({ format: 'uuid' }), jobId: Type.String({ format: 'uuid' }) },
      { additionalProperties: false },
    ),
    result: AssetJobSchema,
  },
  'asset/cancel': {
    params: Type.Object(
      { projectId: Type.String({ format: 'uuid' }), jobId: Type.String({ format: 'uuid' }) },
      { additionalProperties: false },
    ),
    result: AssetJobSchema,
  },
  'asset/review': {
    params: Type.Object(
      {
        projectId: Type.String({ format: 'uuid' }),
        jobId: Type.String({ format: 'uuid' }),
        decision: Type.Union([Type.Literal('approved'), Type.Literal('rejected')]),
        note: Type.Optional(Type.String()),
      },
      { additionalProperties: false },
    ),
    result: AssetJobSchema,
  },
  'asset/import': {
    params: Type.Object(
      {
        projectId: Type.String({ format: 'uuid' }),
        jobId: Type.String({ format: 'uuid' }),
        artifactId: Type.String({ format: 'uuid' }),
        destinationDir: Type.Optional(Type.String({ minLength: 1 })),
      },
      { additionalProperties: false },
    ),
    result: Type.Object(
      {
        job: AssetJobSchema,
        importedPath: Type.String({ minLength: 1 }),
        provenancePath: Type.String({ minLength: 1 }),
      },
      { additionalProperties: false },
    ),
  },
  'asset/files': {
    params: Type.Object(
      { projectId: Type.String({ format: 'uuid' }), directory: Type.Optional(Type.String()) },
      { additionalProperties: false },
    ),
    result: Type.Object(
      { files: Type.Array(AssetFileEntrySchema) },
      { additionalProperties: false },
    ),
  },
  'asset/preview': {
    params: Type.Object(
      {
        projectId: Type.String({ format: 'uuid' }),
        path: Type.String({ minLength: 1 }),
        refresh: Type.Optional(Type.Boolean()),
      },
      { additionalProperties: false },
    ),
    result: AssetPreviewSchema,
  },
  'asset/openInAuthoringTool': {
    params: Type.Object(
      { projectId: Type.String({ format: 'uuid' }), path: Type.String({ minLength: 1 }) },
      { additionalProperties: false },
    ),
    result: Type.Object(
      { launched: Type.Boolean(), command: Type.String() },
      { additionalProperties: false },
    ),
  },
  'backup/identities': {
    params: EmptyParams,
    result: Type.Object(
      { identities: Type.Array(BackupIdentitySchema) },
      { additionalProperties: false },
    ),
  },
  'backup/identity/create': {
    params: Type.Object(
      {
        label: Type.String({ minLength: 1, maxLength: 200 }),
        secret: Type.String({ minLength: 12 }),
      },
      { additionalProperties: false },
    ),
    result: BackupIdentitySchema,
  },
  'backup/identity/remove': {
    params: Type.Object(
      { identityId: Type.String({ format: 'uuid' }) },
      { additionalProperties: false },
    ),
    result: Type.Object({ removed: Type.Literal(true) }, { additionalProperties: false }),
  },
  'backup/destinations': {
    params: EmptyParams,
    result: Type.Object(
      { destinations: Type.Array(BackupDestinationSchema) },
      { additionalProperties: false },
    ),
  },
  'backup/addDestination': {
    params: Type.Object(
      {
        kind: BackupDestinationKindSchema,
        displayName: Type.String({ minLength: 1, maxLength: 200 }),
        config: BackupDestinationConfigSchema,
        secrets: Type.Optional(Type.Record(Type.String(), Type.String())),
      },
      { additionalProperties: false },
    ),
    result: BackupDestinationSchema,
  },
  'backup/updateDestination': {
    params: Type.Object(
      {
        destinationId: Type.String({ format: 'uuid' }),
        patch: Type.Object(
          {
            displayName: Type.Optional(Type.String({ minLength: 1, maxLength: 200 })),
            config: Type.Optional(BackupDestinationConfigSchema),
            secrets: Type.Optional(Type.Record(Type.String(), Type.String())),
            enabled: Type.Optional(Type.Boolean()),
          },
          { additionalProperties: false },
        ),
      },
      { additionalProperties: false },
    ),
    result: BackupDestinationSchema,
  },
  'backup/removeDestination': {
    params: Type.Object(
      { destinationId: Type.String({ format: 'uuid' }) },
      { additionalProperties: false },
    ),
    result: Type.Object({ removed: Type.Literal(true) }, { additionalProperties: false }),
  },
  'backup/testDestination': {
    params: Type.Object(
      { destinationId: Type.String({ format: 'uuid' }) },
      { additionalProperties: false },
    ),
    result: Type.Object(
      {
        ok: Type.Boolean(),
        latencyMs: Type.Integer({ minimum: 0 }),
        error: Type.Optional(Type.String()),
      },
      { additionalProperties: false },
    ),
  },
  'backup/plans': {
    params: Type.Object(
      { projectId: Type.Optional(Type.String({ format: 'uuid' })) },
      { additionalProperties: false },
    ),
    result: Type.Object({ plans: Type.Array(BackupPlanSchema) }, { additionalProperties: false }),
  },
  'backup/savePlan': {
    params: Type.Object(
      {
        planId: Type.Optional(Type.String({ format: 'uuid' })),
        plan: Type.Object(
          {
            scope: BackupScopeSchema,
            projectId: Type.Union([Type.String({ format: 'uuid' }), Type.Null()]),
            destinationId: Type.String({ format: 'uuid' }),
            identityId: Type.String({ format: 'uuid' }),
            schedule: BackupScheduleSchema,
            retention: BackupRetentionSchema,
            enabled: Type.Boolean(),
          },
          { additionalProperties: false },
        ),
      },
      { additionalProperties: false },
    ),
    result: BackupPlanSchema,
  },
  'backup/removePlan': {
    params: Type.Object(
      { planId: Type.String({ format: 'uuid' }) },
      { additionalProperties: false },
    ),
    result: Type.Object({ removed: Type.Literal(true) }, { additionalProperties: false }),
  },
  'backup/run': {
    params: Type.Union([
      Type.Object({ planId: Type.String({ format: 'uuid' }) }, { additionalProperties: false }),
      Type.Object(
        {
          scope: BackupScopeSchema,
          projectId: Type.Optional(Type.String({ format: 'uuid' })),
          destinationId: Type.String({ format: 'uuid' }),
          identityId: Type.String({ format: 'uuid' }),
        },
        { additionalProperties: false },
      ),
    ]),
    result: BackupRunSchema,
  },
  'backup/runs': {
    params: Type.Object(
      {
        projectId: Type.Optional(Type.String({ format: 'uuid' })),
        limit: Type.Optional(Type.Integer({ minimum: 1, maximum: 1000 })),
      },
      { additionalProperties: false },
    ),
    result: Type.Object({ runs: Type.Array(BackupRunSchema) }, { additionalProperties: false }),
  },
  'backup/run/get': {
    params: Type.Object(
      { runId: Type.String({ format: 'uuid' }) },
      { additionalProperties: false },
    ),
    result: BackupRunSchema,
  },
  'backup/cancel': {
    params: Type.Object(
      { runId: Type.String({ format: 'uuid' }) },
      { additionalProperties: false },
    ),
    result: BackupRunSchema,
  },
  'backup/archives': {
    params: Type.Object(
      { destinationId: Type.String({ format: 'uuid' }) },
      { additionalProperties: false },
    ),
    result: Type.Object(
      { archives: Type.Array(BackupArchiveEntrySchema) },
      { additionalProperties: false },
    ),
  },
  'backup/inspect': {
    params: Type.Object(
      {
        destinationId: Type.String({ format: 'uuid' }),
        archiveName: Type.String({ minLength: 1 }),
        secret: Type.String({ minLength: 12 }),
      },
      { additionalProperties: false },
    ),
    result: BackupManifestSchema,
  },
  'backup/verify': {
    params: Type.Object(
      {
        destinationId: Type.String({ format: 'uuid' }),
        archiveName: Type.String({ minLength: 1 }),
        secret: Type.String({ minLength: 12 }),
      },
      { additionalProperties: false },
    ),
    result: BackupVerifyResultSchema,
  },
  'backup/restore': {
    params: Type.Object(
      {
        destinationId: Type.String({ format: 'uuid' }),
        archiveName: Type.String({ minLength: 1 }),
        secret: Type.String({ minLength: 12 }),
        targetPath: Type.String({ minLength: 1 }),
        register: Type.Optional(Type.Boolean()),
      },
      { additionalProperties: false },
    ),
    result: BackupRestoreResultSchema,
  },
  'knowledge/records': {
    params: Type.Object(
      {
        projectId: Type.String({ format: 'uuid' }),
        type: Type.Optional(RecordTypeSchema),
        status: Type.Optional(CanonStatusSchema),
        module: Type.Optional(Type.String()),
        includeInactive: Type.Optional(Type.Boolean()),
        search: Type.Optional(Type.String()),
      },
      { additionalProperties: false },
    ),
    result: KnowledgeRecordListResultSchema,
  },
  'knowledge/record': {
    params: Type.Object(
      { projectId: Type.String({ format: 'uuid' }), recordId: CanonIdSchema },
      { additionalProperties: false },
    ),
    result: KnowledgeRecordResultSchema,
  },
  'knowledge/write': {
    params: Type.Object(
      {
        projectId: Type.String({ format: 'uuid' }),
        record: CanonRecordInputSchema,
        body: Type.String(),
        path: Type.Optional(Type.String()),
      },
      { additionalProperties: false },
    ),
    result: CanonRecordSchema,
  },
  'knowledge/setStatus': {
    params: Type.Object(
      {
        projectId: Type.String({ format: 'uuid' }),
        recordId: CanonIdSchema,
        status: CanonStatusSchema,
        justification: Type.Object(
          {
            kind: Type.Union([Type.Literal('decision'), Type.Literal('user')]),
            ref: Type.String({ minLength: 1 }),
          },
          { additionalProperties: false },
        ),
      },
      { additionalProperties: false },
    ),
    result: CanonRecordSchema,
  },
  'knowledge/search': { params: SearchRequestSchema, result: KnowledgeSearchResultSchema },
  'knowledge/index/status': {
    params: Type.Object(
      { projectId: Type.String({ format: 'uuid' }) },
      { additionalProperties: false },
    ),
    result: KnowledgeIndexStateSchema,
  },
  'knowledge/index/rebuild': {
    params: Type.Object(
      { projectId: Type.String({ format: 'uuid' }), full: Type.Optional(Type.Boolean()) },
      { additionalProperties: false },
    ),
    result: KnowledgeTaskResultSchema,
  },
  'knowledge/index/reconcile': {
    params: Type.Object(
      { projectId: Type.String({ format: 'uuid' }) },
      { additionalProperties: false },
    ),
    result: KnowledgeTaskResultSchema,
  },
  'knowledge/embeddingProfile/set': {
    params: Type.Object(
      {
        projectId: Type.String({ format: 'uuid' }),
        modelId: Type.String({ minLength: 1 }),
        providerAccountId: Type.String({ format: 'uuid' }),
      },
      { additionalProperties: false },
    ),
    result: EmbeddingProfileSchema,
  },
  'knowledge/graph': {
    params: Type.Object(
      {
        projectId: Type.String({ format: 'uuid' }),
        recordId: Type.Optional(CanonIdSchema),
        depth: Type.Optional(Type.Integer({ minimum: 1, maximum: 5, default: 1 })),
      },
      { additionalProperties: false },
    ),
    result: KnowledgeGraphSchema,
  },
  'knowledge/vectorStore/test': {
    params: Type.Object(
      { projectId: Type.String({ format: 'uuid' }) },
      { additionalProperties: false },
    ),
    result: KnowledgeVectorStoreTestResultSchema,
  },
  'settings/describe': {
    params: EmptyParams,
    result: Type.Object(
      { groups: Type.Array(SettingGroupSchema), definitions: Type.Array(SettingDefinitionSchema) },
      { additionalProperties: false },
    ),
  },
  'settings/get': {
    params: Type.Object(
      {
        key: Type.String(),
        projectId: Type.Optional(Type.String({ format: 'uuid' })),
        sessionId: Type.Optional(Type.String({ format: 'uuid' })),
      },
      { additionalProperties: false },
    ),
    result: EffectiveSettingSchema,
  },
  'settings/getAll': {
    params: Type.Object(
      {
        projectId: Type.Optional(Type.String({ format: 'uuid' })),
        sessionId: Type.Optional(Type.String({ format: 'uuid' })),
      },
      { additionalProperties: false },
    ),
    result: Type.Object(
      { settings: Type.Array(EffectiveSettingSchema) },
      { additionalProperties: false },
    ),
  },
  'settings/export': {
    params: Type.Object(
      {
        projectId: Type.Optional(Type.String({ format: 'uuid' })),
        sessionId: Type.Optional(Type.String({ format: 'uuid' })),
      },
      { additionalProperties: false },
    ),
    result: SettingsExportSchema,
  },
  'settings/import': { params: SettingsImportParamsSchema, result: SettingsImportResultSchema },
  'settings/set': {
    params: Type.Object(
      {
        key: Type.String(),
        scope: SettingsScope,
        value: Type.Unknown(),
        projectId: Type.Optional(Type.String({ format: 'uuid' })),
        sessionId: Type.Optional(Type.String({ format: 'uuid' })),
      },
      { additionalProperties: false },
    ),
    result: EffectiveSettingSchema,
  },
  'task/create': {
    params: TaskCreateInputSchema,
    result: Type.Object(
      { task: TaskRecordSchema, deduplicated: Type.Boolean() },
      { additionalProperties: false },
    ),
  },
  'task/get': {
    params: Type.Object(
      {
        projectId: Type.String({ format: 'uuid' }),
        taskId: Type.String({ format: 'uuid' }),
      },
      { additionalProperties: false },
    ),
    result: TaskRecordSchema,
  },
  'task/list': {
    params: Type.Object(
      {
        projectId: Type.String({ format: 'uuid' }),
        states: Type.Optional(Type.Array(TaskStateSchema)),
        parentTaskId: Type.Optional(Type.Union([Type.String({ format: 'uuid' }), Type.Null()])),
        rootTaskId: Type.Optional(Type.String({ format: 'uuid' })),
        limit: Type.Optional(Type.Integer({ minimum: 1, default: 200 })),
      },
      { additionalProperties: false },
    ),
    result: Type.Object({ tasks: Type.Array(TaskRecordSchema) }, { additionalProperties: false }),
  },
  'task/tree': {
    params: Type.Object(
      {
        projectId: Type.String({ format: 'uuid' }),
        rootTaskId: Type.String({ format: 'uuid' }),
      },
      { additionalProperties: false },
    ),
    result: Type.Object({ tasks: Type.Array(TaskRecordSchema) }, { additionalProperties: false }),
  },
  'task/cancel': {
    params: Type.Object(
      {
        projectId: Type.String({ format: 'uuid' }),
        taskId: Type.String({ format: 'uuid' }),
        reason: Type.Optional(Type.String()),
      },
      { additionalProperties: false },
    ),
    result: Type.Object(
      { cancelled: Type.Array(Type.String({ format: 'uuid' })) },
      { additionalProperties: false },
    ),
  },
  'task/events': {
    params: Type.Object(
      {
        projectId: Type.String({ format: 'uuid' }),
        taskId: Type.Optional(Type.String({ format: 'uuid' })),
        afterSeq: Type.Optional(Type.Integer({ minimum: 0 })),
        limit: Type.Optional(Type.Integer({ minimum: 1, default: 500 })),
      },
      { additionalProperties: false },
    ),
    result: Type.Object({ events: Type.Array(TaskEventSchema) }, { additionalProperties: false }),
  },
  'task/answer': {
    params: Type.Object(
      {
        projectId: Type.String({ format: 'uuid' }),
        taskId: Type.String({ format: 'uuid' }),
        questionId: Type.String({ format: 'uuid' }),
        answer: Type.Unknown(),
      },
      { additionalProperties: false },
    ),
    result: TaskRecordSchema,
  },
  'task/questions': {
    params: Type.Object(
      { pendingOnly: Type.Optional(Type.Boolean()) },
      { additionalProperties: false },
    ),
    result: Type.Object(
      { questions: Type.Array(TaskQuestionSchema) },
      { additionalProperties: false },
    ),
  },
  'change/request': {
    params: Type.Object(
      {
        projectId: Type.String({ format: 'uuid' }),
        text: Type.String({ minLength: 1 }),
        role: Type.Optional(Type.String()),
        touches: Type.Optional(Type.Array(TaskTouchSchema)),
        budget: Type.Optional(TaskBudgetSchema),
      },
      { additionalProperties: false },
    ),
    result: ChangeRequestSchema,
  },
  'change/requests': {
    params: Type.Object(
      {
        projectId: Type.String({ format: 'uuid' }),
        limit: Type.Optional(Type.Integer({ minimum: 1 })),
      },
      { additionalProperties: false },
    ),
    result: Type.Object(
      { requests: Type.Array(ChangeRequestSchema) },
      { additionalProperties: false },
    ),
  },
  'change/impact': {
    params: Type.Object(
      {
        projectId: Type.String({ format: 'uuid' }),
        seeds: Type.Array(ChangeNodeRefSchema, { minItems: 1 }),
        maxDepth: Type.Optional(Type.Integer({ minimum: 0 })),
        threshold: Type.Optional(Type.Number({ minimum: 0, maximum: 1 })),
      },
      { additionalProperties: false },
    ),
    result: ImpactResultSchema,
  },
  'change/graph': {
    params: Type.Object(
      {
        projectId: Type.String({ format: 'uuid' }),
        kinds: Type.Optional(Type.Array(ChangeNodeKindSchema)),
        limit: Type.Optional(Type.Integer({ minimum: 1 })),
      },
      { additionalProperties: false },
    ),
    result: Type.Object(
      { nodes: Type.Array(ChangeNodeSchema), edges: Type.Array(ChangeEdgeSchema) },
      { additionalProperties: false },
    ),
  },
  'change/rebuildGraph': {
    params: Type.Object(
      { projectId: Type.String({ format: 'uuid' }) },
      { additionalProperties: false },
    ),
    result: Type.Object(
      { nodes: Type.Integer({ minimum: 0 }), edges: Type.Integer({ minimum: 0 }) },
      { additionalProperties: false },
    ),
  },
  'change/locks': {
    params: Type.Object(
      { projectId: Type.String({ format: 'uuid' }) },
      { additionalProperties: false },
    ),
    result: Type.Object({ locks: Type.Array(ResourceLockSchema) }, { additionalProperties: false }),
  },
  'change/releaseLock': {
    params: Type.Object(
      { projectId: Type.String({ format: 'uuid' }), lockId: Type.String({ format: 'uuid' }) },
      { additionalProperties: false },
    ),
    result: Type.Object({ released: Type.Literal(true) }, { additionalProperties: false }),
  },
  'change/integrations': {
    params: Type.Object(
      {
        projectId: Type.String({ format: 'uuid' }),
        status: Type.Optional(IntegrationStatusSchema),
      },
      { additionalProperties: false },
    ),
    result: Type.Object(
      { integrations: Type.Array(IntegrationRecordSchema) },
      { additionalProperties: false },
    ),
  },
  'change/integrate': {
    params: Type.Object(
      { projectId: Type.String({ format: 'uuid' }), taskId: Type.String({ format: 'uuid' }) },
      { additionalProperties: false },
    ),
    result: IntegrationRecordSchema,
  },
  'change/abortIntegration': {
    params: Type.Object(
      {
        projectId: Type.String({ format: 'uuid' }),
        integrationId: Type.String({ format: 'uuid' }),
      },
      { additionalProperties: false },
    ),
    result: IntegrationRecordSchema,
  },
  'change/feedback': {
    params: FeedbackInputSchema,
    result: Type.Object(
      {
        reopenedTaskIds: Type.Array(Type.String({ format: 'uuid' })),
        revalidateTaskIds: Type.Array(Type.String({ format: 'uuid' })),
        threadId: Type.Union([Type.String({ format: 'uuid' }), Type.Null()]),
      },
      { additionalProperties: false },
    ),
  },
  'service/stop': {
    params: Type.Object({ checkpoint: Type.Boolean() }, { additionalProperties: false }),
    result: Type.Object({ ok: Type.Literal(true) }, { additionalProperties: false }),
  },
  'tool/list': {
    params: Type.Object(
      { projectId: Type.Optional(Type.String({ format: 'uuid' })) },
      { additionalProperties: false },
    ),
    result: Type.Object(
      { tools: Type.Array(ToolDefinitionSchema) },
      { additionalProperties: false },
    ),
  },
  'tool/call': {
    params: Type.Object(
      {
        projectId: Type.String({ format: 'uuid' }),
        toolId: ToolIdSchema,
        input: Type.Unknown(),
        taskId: Type.Optional(Type.String({ format: 'uuid' })),
        agentId: Type.Optional(Type.String()),
        accessCeiling: Type.Optional(AccessModeSchema),
      },
      { additionalProperties: false },
    ),
    result: ToolCallRecordSchema,
  },
  'audit/read': {
    params: Type.Object(
      {
        projectId: Type.String({ format: 'uuid' }),
        afterSeq: Type.Optional(Type.Integer({ minimum: 0 })),
        limit: Type.Optional(Type.Integer({ minimum: 1, maximum: 1000 })),
      },
      { additionalProperties: false },
    ),
    result: Type.Object(
      {
        schemaVersion: Type.Literal(1),
        projectId: Type.String({ format: 'uuid' }),
        exportedAt: Type.String({ format: 'date-time' }),
        nextAfterSeq: Type.Integer({ minimum: 0 }),
        limit: Type.Integer(),
        calls: Type.Array(ToolCallRecordSchema),
        events: Type.Array(TaskEventSchema),
      },
      { additionalProperties: false },
    ),
  },
  'tool/calls': {
    params: Type.Object(
      {
        projectId: Type.String({ format: 'uuid' }),
        taskId: Type.Optional(Type.String({ format: 'uuid' })),
        toolId: Type.Optional(ToolIdSchema),
        limit: Type.Optional(Type.Integer({ minimum: 1, default: 200 })),
      },
      { additionalProperties: false },
    ),
    result: Type.Object(
      { calls: Type.Array(ToolCallRecordSchema) },
      { additionalProperties: false },
    ),
  },
  'broker/approvals': {
    params: Type.Object(
      {
        projectId: Type.String({ format: 'uuid' }),
        pendingOnly: Type.Optional(Type.Boolean()),
      },
      { additionalProperties: false },
    ),
    result: Type.Object(
      { approvals: Type.Array(ApprovalRequestSchema) },
      { additionalProperties: false },
    ),
  },
  'broker/approve': {
    params: Type.Object(
      {
        projectId: Type.String({ format: 'uuid' }),
        approvalId: Type.String({ format: 'uuid' }),
        approve: Type.Boolean(),
        reason: Type.Optional(Type.String()),
      },
      { additionalProperties: false },
    ),
    result: ApprovalRequestSchema,
  },
  'provider/accounts': {
    params: EmptyParams,
    result: Type.Object(
      { accounts: Type.Array(ProviderAccountSchema) },
      { additionalProperties: false },
    ),
  },
  'provider/addAccount': {
    params: Type.Object(
      {
        providerKind: ProviderKindSchema,
        displayName: Type.String(),
        baseUrl: Type.String({ format: 'uri' }),
        apiKey: Type.Optional(Type.String()),
        headers: Type.Optional(Type.Record(Type.String(), Type.String())),
        isLocal: Type.Optional(Type.Boolean()),
      },
      { additionalProperties: false },
    ),
    result: ProviderAccountSchema,
  },
  'provider/updateAccount': {
    params: Type.Object(
      {
        accountId: Type.String({ format: 'uuid' }),
        patch: Type.Object(
          {
            displayName: Type.Optional(Type.String()),
            baseUrl: Type.Optional(Type.String({ format: 'uri' })),
            apiKey: Type.Optional(Type.Union([Type.String(), Type.Null()])),
            headers: Type.Optional(Type.Record(Type.String(), Type.String())),
            enabled: Type.Optional(Type.Boolean()),
            isLocal: Type.Optional(Type.Boolean()),
          },
          { additionalProperties: false },
        ),
      },
      { additionalProperties: false },
    ),
    result: ProviderAccountSchema,
  },
  'provider/removeAccount': {
    params: Type.Object(
      { accountId: Type.String({ format: 'uuid' }) },
      { additionalProperties: false },
    ),
    result: Type.Object({ removed: Type.Literal(true) }, { additionalProperties: false }),
  },
  'provider/testAccount': {
    params: Type.Object(
      { accountId: Type.String({ format: 'uuid' }) },
      { additionalProperties: false },
    ),
    result: Type.Object(
      {
        ok: Type.Boolean(),
        latencyMs: Type.Integer({ minimum: 0 }),
        discoveredModels: Type.Integer({ minimum: 0 }),
        error: Type.Optional(Type.String()),
      },
      { additionalProperties: false },
    ),
  },
  'model/list': {
    params: Type.Object(
      {
        accountId: Type.Optional(Type.String({ format: 'uuid' })),
        enabledOnly: Type.Optional(Type.Boolean()),
      },
      { additionalProperties: false },
    ),
    result: Type.Object({ models: Type.Array(ModelSchema) }, { additionalProperties: false }),
  },
  'model/discover': {
    params: Type.Object(
      {
        accountId: Type.String({ format: 'uuid' }),
        preview: Type.Optional(Type.Boolean()),
        providerModelIds: Type.Optional(
          Type.Array(Type.String({ minLength: 1 }), { uniqueItems: true }),
        ),
      },
      { additionalProperties: false },
    ),
    result: Type.Object(
      {
        added: Type.Integer({ minimum: 0 }),
        updated: Type.Integer({ minimum: 0 }),
        models: Type.Array(ModelSchema),
      },
      { additionalProperties: false },
    ),
  },
  'model/update': {
    params: Type.Object(
      {
        modelId: Type.String(),
        patch: Type.Object(
          {
            enabled: Type.Optional(Type.Boolean()),
            displayName: Type.Optional(Type.String()),
            capabilities: Type.Optional(
              Type.Object(
                {
                  chat: Type.Optional(Type.Boolean()),
                  tools: Type.Optional(Type.Boolean()),
                  vision: Type.Optional(Type.Boolean()),
                  structuredOutput: Type.Optional(Type.Boolean()),
                  streaming: Type.Optional(Type.Boolean()),
                  embeddings: Type.Optional(Type.Boolean()),
                  contextWindow: Type.Optional(
                    Type.Union([Type.Integer({ minimum: 0 }), Type.Null()]),
                  ),
                  maxOutputTokens: Type.Optional(
                    Type.Union([Type.Integer({ minimum: 0 }), Type.Null()]),
                  ),
                  maxInputTokens: Type.Optional(
                    Type.Union([Type.Integer({ minimum: 0 }), Type.Null()]),
                  ),
                },
                { additionalProperties: false },
              ),
            ),
            pricing: Type.Optional(ModelPricingSchema),
            tags: Type.Optional(Type.Array(Type.String())),
            workTypes: Type.Optional(Type.Array(Type.String())),
            roles: Type.Optional(Type.Array(Type.String())),
          },
          { additionalProperties: false },
        ),
      },
      { additionalProperties: false },
    ),
    result: ModelSchema,
  },
  'pool/list': {
    params: Type.Object(
      { projectId: Type.Optional(Type.String({ format: 'uuid' })) },
      { additionalProperties: false },
    ),
    result: Type.Object({ pools: Type.Array(ModelPoolSchema) }, { additionalProperties: false }),
  },
  'pool/create': {
    params: Type.Object(
      {
        name: Type.String(),
        scope: Type.Union([Type.Literal('platform'), Type.Literal('project')]),
        projectId: Type.Optional(Type.String({ format: 'uuid' })),
        target: Type.Union([ModelPoolTargetSchema, Type.Null()]),
        modelIds: Type.Array(Type.String()),
      },
      { additionalProperties: false },
    ),
    result: ModelPoolSchema,
  },
  'pool/update': {
    params: Type.Object(
      {
        poolId: Type.String({ format: 'uuid' }),
        patch: Type.Object(
          {
            name: Type.Optional(Type.String()),
            scope: Type.Optional(Type.Union([Type.Literal('platform'), Type.Literal('project')])),
            projectId: Type.Optional(Type.Union([Type.String({ format: 'uuid' }), Type.Null()])),
            target: Type.Optional(Type.Union([ModelPoolTargetSchema, Type.Null()])),
            modelIds: Type.Optional(Type.Array(Type.String())),
          },
          { additionalProperties: false },
        ),
      },
      { additionalProperties: false },
    ),
    result: ModelPoolSchema,
  },
  'pool/delete': {
    params: Type.Object(
      { poolId: Type.String({ format: 'uuid' }) },
      { additionalProperties: false },
    ),
    result: Type.Object({ removed: Type.Literal(true) }, { additionalProperties: false }),
  },
  'router/route': { params: RouteRequestSchema, result: RouteDecisionSchema },
  'router/reportOutcome': {
    params: RouteOutcomeSchema,
    result: Type.Object({ recorded: Type.Literal(true) }, { additionalProperties: false }),
  },
  'router/decisions': {
    params: Type.Object(
      {
        projectId: Type.Optional(Type.String({ format: 'uuid' })),
        limit: Type.Optional(Type.Integer({ minimum: 1, default: 200 })),
      },
      { additionalProperties: false },
    ),
    result: Type.Object(
      {
        decisions: Type.Array(
          Type.Object(
            {
              decision: RouteDecisionSchema,
              outcome: Type.Union([RouteOutcomeSchema, Type.Null()]),
            },
            { additionalProperties: false },
          ),
        ),
      },
      { additionalProperties: false },
    ),
  },
  'router/stats': {
    params: Type.Object(
      { taskType: Type.Optional(Type.String()) },
      { additionalProperties: false },
    ),
    result: Type.Object(
      {
        models: Type.Array(
          Type.Object(
            {
              modelId: Type.String(),
              taskType: Type.Union([Type.String(), Type.Null()]),
              observations: Type.Integer({ minimum: 0 }),
              successRate: Type.Number({ minimum: 0, maximum: 1 }),
              qualityMean: Type.Union([Type.Number({ minimum: 0, maximum: 1 }), Type.Null()]),
              meanCostUsd: Type.Union([Type.Number({ minimum: 0 }), Type.Null()]),
              meanLatencyMs: Type.Union([Type.Number({ minimum: 0 }), Type.Null()]),
            },
            { additionalProperties: false },
          ),
        ),
      },
      { additionalProperties: false },
    ),
  },
  'model/complete': {
    params: ModelCompleteParamsSchema,
    result: ChatResponseSchema,
  },
  'chat/list': {
    params: Type.Object(
      { projectId: Type.String({ format: 'uuid' }) },
      { additionalProperties: false },
    ),
    result: Type.Object(
      { conversations: Type.Array(ChatConversationSchema) },
      { additionalProperties: false },
    ),
  },
  'chat/create': {
    params: Type.Object(
      {
        projectId: Type.String({ format: 'uuid' }),
        title: Type.String({ minLength: 1, maxLength: 200 }),
      },
      { additionalProperties: false },
    ),
    result: ChatConversationSchema,
  },
  'chat/messages': {
    params: Type.Object(
      {
        projectId: Type.String({ format: 'uuid' }),
        conversationId: Type.String({ format: 'uuid' }),
      },
      { additionalProperties: false },
    ),
    result: Type.Object({ messages: Type.Array(ChatEntrySchema) }, { additionalProperties: false }),
  },
  'chat/append': {
    params: Type.Object(
      {
        projectId: Type.String({ format: 'uuid' }),
        conversationId: Type.String({ format: 'uuid' }),
        role: Type.Union([Type.Literal('user'), Type.Literal('assistant'), Type.Literal('system')]),
        content: Type.String(),
        modelId: Type.Optional(Type.Union([Type.String(), Type.Null()])),
        usage: Type.Optional(Type.Union([ModelUsageSchema, Type.Null()])),
      },
      { additionalProperties: false },
    ),
    result: ChatEntrySchema,
  },
  'chat/delete': {
    params: Type.Object(
      {
        projectId: Type.String({ format: 'uuid' }),
        conversationId: Type.String({ format: 'uuid' }),
      },
      { additionalProperties: false },
    ),
    result: Type.Object({ deleted: Type.Boolean() }, { additionalProperties: false }),
  },
  'model/embed': {
    params: Type.Object(
      {
        modelId: Type.String(),
        inputs: Type.Array(Type.String()),
      },
      { additionalProperties: false },
    ),
    result: Type.Object(
      { vectors: Type.Array(Type.Array(Type.Number())), usage: ModelUsageSchema },
      { additionalProperties: false },
    ),
  },
  'skills/install': {
    params: Type.Object(
      {
        source: Type.String(),
        name: Type.Optional(Type.String({ pattern: '^[a-z0-9][a-z0-9-]{0,63}$' })),
        force: Type.Optional(Type.Boolean()),
      },
      { additionalProperties: false },
    ),
    result: Type.Object(
      { installed: Type.Array(SkillRecordSchema) },
      { additionalProperties: false },
    ),
  },
  'skills/uninstall': {
    params: Type.Object({ name: Type.String() }, { additionalProperties: false }),
    result: Type.Object({ removed: Type.Literal(true) }, { additionalProperties: false }),
  },
  'skills/list': {
    params: Type.Object(
      { projectId: Type.Optional(Type.String({ format: 'uuid' })) },
      { additionalProperties: false },
    ),
    result: Type.Object(
      { skills: Type.Array(ProjectSkillEntrySchema) },
      { additionalProperties: false },
    ),
  },
  'skills/enable': {
    params: Type.Object(
      {
        projectId: Type.String({ format: 'uuid' }),
        name: Type.String(),
        enabled: Type.Boolean(),
        roles: Type.Optional(Type.Union([Type.Array(Type.String()), Type.Null()])),
        workTypes: Type.Optional(Type.Union([Type.Array(Type.String()), Type.Null()])),
        pin: Type.Optional(Type.Boolean()),
      },
      { additionalProperties: false },
    ),
    result: SkillEnablementSchema,
  },
  'skills/catalog': {
    params: Type.Object(
      {
        projectId: Type.String({ format: 'uuid' }),
        agentRole: Type.Optional(Type.String()),
        workType: Type.Optional(Type.String()),
        taskText: Type.Optional(Type.String()),
        accessMode: Type.Optional(AccessModeSchema),
      },
      { additionalProperties: false },
    ),
    result: Type.Object(
      { entries: Type.Array(SkillCatalogEntrySchema), truncated: Type.Boolean() },
      { additionalProperties: false },
    ),
  },
  'skills/activate': {
    params: Type.Object(
      {
        projectId: Type.String({ format: 'uuid' }),
        name: Type.String(),
        taskId: Type.Optional(Type.String({ format: 'uuid' })),
        agentId: Type.Optional(Type.String()),
      },
      { additionalProperties: false },
    ),
    result: SkillActivationResultSchema,
  },
  'skills/read-resource': {
    params: SkillResourceReadParamsSchema,
    result: SkillResourceReadResultSchema,
  },
  'skills/search': {
    params: Type.Object(
      {
        projectId: Type.String({ format: 'uuid' }),
        query: Type.String(),
        agentRole: Type.Optional(Type.String()),
        workType: Type.Optional(Type.String()),
      },
      { additionalProperties: false },
    ),
    result: Type.Object(
      { entries: Type.Array(SkillCatalogEntrySchema) },
      { additionalProperties: false },
    ),
  },
  'skills/validate': {
    params: Type.Object({ path: Type.String() }, { additionalProperties: false }),
    result: SkillValidationResultSchema,
  },
  'skills/activations': {
    params: Type.Object(
      {
        projectId: Type.String({ format: 'uuid' }),
        taskId: Type.Optional(Type.String({ format: 'uuid' })),
      },
      { additionalProperties: false },
    ),
    result: Type.Object(
      { activations: Type.Array(SkillActivationSchema) },
      { additionalProperties: false },
    ),
  },
  'roles/list': {
    params: Type.Object(
      { projectId: Type.Optional(Type.String({ format: 'uuid' })) },
      { additionalProperties: false },
    ),
    result: Type.Object({ roles: Type.Array(RoleRecordSchema) }, { additionalProperties: false }),
  },
  'roles/get': {
    params: Type.Object(
      { name: Type.String(), projectId: Type.Optional(Type.String({ format: 'uuid' })) },
      { additionalProperties: false },
    ),
    result: RoleRecordSchema,
  },
  'mcp/list': {
    params: Type.Object(
      { projectId: Type.Optional(Type.String({ format: 'uuid' })) },
      { additionalProperties: false },
    ),
    result: Type.Object(
      { connections: Type.Array(McpConnectionListEntrySchema) },
      { additionalProperties: false },
    ),
  },
  'mcp/add': {
    params: Type.Object(
      {
        config: McpConnectionInputSchema,
        credentials: Type.Optional(Type.Record(Type.String(), Type.String())),
      },
      { additionalProperties: false },
    ),
    result: McpConnectionConfigSchema,
  },
  'mcp/update': {
    params: Type.Object(
      {
        connectionId: Type.String({ format: 'uuid' }),
        patch: McpConnectionPatchSchema,
        credentials: Type.Optional(Type.Record(Type.String(), Type.String())),
      },
      { additionalProperties: false },
    ),
    result: McpConnectionConfigSchema,
  },
  'mcp/remove': {
    params: Type.Object(
      { connectionId: Type.String({ format: 'uuid' }) },
      { additionalProperties: false },
    ),
    result: Type.Object({ removed: Type.Literal(true) }, { additionalProperties: false }),
  },
  'mcp/connect': {
    params: Type.Object(
      { connectionId: Type.String({ format: 'uuid' }) },
      { additionalProperties: false },
    ),
    result: McpConnectionStateSchema,
  },
  'mcp/disconnect': {
    params: Type.Object(
      { connectionId: Type.String({ format: 'uuid' }) },
      { additionalProperties: false },
    ),
    result: McpConnectionStateSchema,
  },
  'mcp/tools': {
    params: Type.Object(
      { connectionId: Type.String({ format: 'uuid' }) },
      { additionalProperties: false },
    ),
    result: McpToolsResultSchema,
  },
  'mcp/refreshTools': {
    params: Type.Object(
      { connectionId: Type.String({ format: 'uuid' }) },
      { additionalProperties: false },
    ),
    result: McpToolsResultSchema,
  },
  'mcp/answer': {
    params: Type.Object(
      {
        connectionId: Type.String({ format: 'uuid' }),
        requestId: Type.String(),
        responses: Type.Unknown(),
      },
      { additionalProperties: false },
    ),
    result: Type.Object({ answered: Type.Literal(true) }, { additionalProperties: false }),
  },
  'mcp/classifyTool': {
    params: McpToolClassifySchema,
    result: Type.Object({ tool: ToolDefinitionSchema }, { additionalProperties: false }),
  },
  'mcp/log': {
    params: Type.Object(
      {
        connectionId: Type.String({ format: 'uuid' }),
        limit: Type.Optional(Type.Integer({ minimum: 1, maximum: 1000 })),
      },
      { additionalProperties: false },
    ),
    result: Type.Object(
      { entries: Type.Array(McpConnectionLogEntrySchema) },
      { additionalProperties: false },
    ),
  },
  'board/threads': {
    params: Type.Object(
      {
        projectId: Type.String({ format: 'uuid' }),
        status: Type.Optional(BoardThreadStatusSchema),
        kind: Type.Optional(BoardThreadKindSchema),
        tags: Type.Optional(Type.Array(Type.String())),
        search: Type.Optional(Type.String()),
      },
      { additionalProperties: false },
    ),
    result: Type.Object(
      { threads: Type.Array(BoardThreadSchema) },
      { additionalProperties: false },
    ),
  },
  'board/thread': {
    params: Type.Object(
      {
        projectId: Type.String({ format: 'uuid' }),
        threadId: Type.String({ format: 'uuid' }),
        includeMessages: Type.Optional(Type.Boolean()),
        afterSeq: Type.Optional(Type.Integer({ minimum: 0 })),
        limit: Type.Optional(Type.Integer({ minimum: 1, maximum: 1000 })),
      },
      { additionalProperties: false },
    ),
    result: Type.Object(
      { thread: BoardThreadSchema, messages: Type.Array(BoardMessageSchema) },
      { additionalProperties: false },
    ),
  },
  'board/createThread': {
    params: Type.Object(
      {
        projectId: Type.String({ format: 'uuid' }),
        title: Type.String({ minLength: 1 }),
        kind: BoardThreadKindSchema,
        tags: Type.Optional(Type.Array(Type.String())),
        links: Type.Optional(Type.Array(BoardLinkSchema)),
        body: Type.String({ minLength: 1 }),
        type: Type.Optional(BoardMessageTypeSchema),
      },
      { additionalProperties: false },
    ),
    result: Type.Object(
      { thread: BoardThreadSchema, message: BoardMessageSchema },
      { additionalProperties: false },
    ),
  },
  'board/post': {
    params: Type.Object(
      {
        projectId: Type.String({ format: 'uuid' }),
        threadId: Type.Optional(Type.String({ format: 'uuid' })),
        title: Type.Optional(Type.String({ minLength: 1 })),
        kind: Type.Optional(BoardThreadKindSchema),
        type: BoardMessageTypeSchema,
        body: Type.String({ minLength: 1 }),
        links: Type.Optional(Type.Array(BoardLinkSchema)),
        replyTo: Type.Optional(Type.Union([Type.String({ format: 'uuid' }), Type.Null()])),
        author: Type.Optional(BoardAuthorSchema),
      },
      { additionalProperties: false },
    ),
    result: BoardMessageSchema,
  },
  'board/edit': {
    params: Type.Object(
      {
        projectId: Type.String({ format: 'uuid' }),
        messageId: Type.String({ format: 'uuid' }),
        body: Type.String({ minLength: 1 }),
      },
      { additionalProperties: false },
    ),
    result: BoardMessageSchema,
  },
  'board/supersede': {
    params: Type.Object(
      {
        projectId: Type.String({ format: 'uuid' }),
        messageId: Type.String({ format: 'uuid' }),
        byMessageId: Type.String({ format: 'uuid' }),
      },
      { additionalProperties: false },
    ),
    result: BoardMessageSchema,
  },
  'board/setThreadStatus': {
    params: Type.Object(
      {
        projectId: Type.String({ format: 'uuid' }),
        threadId: Type.String({ format: 'uuid' }),
        status: BoardThreadStatusSchema,
      },
      { additionalProperties: false },
    ),
    result: BoardThreadSchema,
  },
  'board/bind': {
    params: Type.Object(
      {
        projectId: Type.String({ format: 'uuid' }),
        messageId: Type.String({ format: 'uuid' }),
        title: Type.Optional(Type.String({ minLength: 1 })),
        statement: Type.Optional(Type.String({ minLength: 1 })),
        rationale: Type.Optional(Type.Union([Type.String(), Type.Null()])),
        supersedes: Type.Optional(Type.Union([Type.String({ format: 'uuid' }), Type.Null()])),
        confirmedByUser: Type.Optional(Type.Boolean()),
      },
      { additionalProperties: false },
    ),
    result: BindingDecisionSchema,
  },
  'board/decisions': {
    params: Type.Object(
      {
        projectId: Type.String({ format: 'uuid' }),
        syncStatus: Type.Optional(BindingDecisionSchema.properties.syncStatus),
      },
      { additionalProperties: false },
    ),
    result: Type.Object(
      { decisions: Type.Array(BindingDecisionSchema) },
      { additionalProperties: false },
    ),
  },
  'board/decision': {
    params: Type.Object(
      {
        projectId: Type.String({ format: 'uuid' }),
        decisionId: Type.String({ format: 'uuid' }),
      },
      { additionalProperties: false },
    ),
    result: Type.Object(
      { decision: BindingDecisionSchema, proposals: Type.Array(CanonSyncProposalSchema) },
      { additionalProperties: false },
    ),
  },
  'board/retrySync': {
    params: Type.Object(
      { projectId: Type.String({ format: 'uuid' }), decisionId: Type.String({ format: 'uuid' }) },
      { additionalProperties: false },
    ),
    result: BindingDecisionSchema,
  },
  'board/subscribe': {
    params: Type.Object(
      {
        projectId: Type.String({ format: 'uuid' }),
        subscriber: BoardSubscriptionSubscriberSchema,
        filter: Type.Optional(BoardSubscriptionFilterSchema),
      },
      { additionalProperties: false },
    ),
    result: BoardSubscriptionSchema,
  },
  'board/unsubscribe': {
    params: Type.Object(
      {
        projectId: Type.String({ format: 'uuid' }),
        subscriptionId: Type.String({ format: 'uuid' }),
      },
      { additionalProperties: false },
    ),
    result: Type.Object({ removed: Type.Literal(true) }, { additionalProperties: false }),
  },
  'board/subscriptions': {
    params: Type.Object(
      {
        projectId: Type.String({ format: 'uuid' }),
        subscriber: Type.Optional(BoardSubscriptionSubscriberSchema),
      },
      { additionalProperties: false },
    ),
    result: Type.Object(
      { subscriptions: Type.Array(BoardSubscriptionSchema) },
      { additionalProperties: false },
    ),
  },
  'board/summary': {
    params: Type.Object(
      { projectId: Type.String({ format: 'uuid' }), threadId: Type.String({ format: 'uuid' }) },
      { additionalProperties: false },
    ),
    result: Type.Object(
      {
        summary: Type.Union([Type.String(), Type.Null()]),
        summaryUpdatedAt: Type.Union([Type.String({ format: 'date-time' }), Type.Null()]),
      },
      { additionalProperties: false },
    ),
  },
  'board/search': {
    params: Type.Object(
      {
        projectId: Type.String({ format: 'uuid' }),
        query: Type.String({ minLength: 1 }),
        limit: Type.Optional(Type.Integer({ minimum: 1, maximum: 1000 })),
      },
      { additionalProperties: false },
    ),
    result: Type.Object(
      { threads: Type.Array(BoardThreadSchema), messages: Type.Array(BoardMessageSchema) },
      { additionalProperties: false },
    ),
  },
  'board/maintenance/run': {
    params: Type.Object(
      {
        projectId: Type.String({ format: 'uuid' }),
        mode: Type.Union([Type.Literal('audit'), Type.Literal('cleanup'), Type.Literal('sync')]),
      },
      { additionalProperties: false },
    ),
    result: Type.Object(
      { taskId: Type.String({ format: 'uuid' }) },
      { additionalProperties: false },
    ),
  },
  'board/maintenance/status': {
    params: Type.Object(
      { projectId: Type.String({ format: 'uuid' }) },
      { additionalProperties: false },
    ),
    result: BoardMaintenanceStatusSchema,
  },
  'board/delete': {
    params: Type.Object(
      { projectId: Type.String({ format: 'uuid' }), threadId: Type.String({ format: 'uuid' }) },
      { additionalProperties: false },
    ),
    result: Type.Object({ deleted: Type.Literal(true) }, { additionalProperties: false }),
  },
  'plugin/list': {
    params: Type.Object(
      { projectId: Type.Optional(Type.String({ format: 'uuid' })) },
      { additionalProperties: false },
    ),
    result: Type.Object(
      { plugins: Type.Array(PluginListEntrySchema) },
      { additionalProperties: false },
    ),
  },
  'plugin/inspect': {
    params: Type.Object({ source: Type.String({ minLength: 1 }) }, { additionalProperties: false }),
    result: PluginInspectionSchema,
  },
  'plugin/install': {
    params: Type.Object(
      {
        source: Type.String({ minLength: 1 }),
        acceptCapabilities: Type.Array(PluginCapabilitySchema),
      },
      { additionalProperties: false },
    ),
    result: InstalledPluginSchema,
  },
  'plugin/uninstall': {
    params: Type.Object({ pluginId: Type.String() }, { additionalProperties: false }),
    result: Type.Object({ removed: Type.Literal(true) }, { additionalProperties: false }),
  },
  'plugin/enable': {
    params: Type.Object(
      { pluginId: Type.String(), projectId: Type.Optional(Type.String({ format: 'uuid' })) },
      { additionalProperties: false },
    ),
    result: Type.Object({ enabled: Type.Literal(true) }, { additionalProperties: false }),
  },
  'plugin/disable': {
    params: Type.Object(
      { pluginId: Type.String(), projectId: Type.Optional(Type.String({ format: 'uuid' })) },
      { additionalProperties: false },
    ),
    result: Type.Object({ enabled: Type.Literal(false) }, { additionalProperties: false }),
  },
  'plugin/start': {
    params: Type.Object(
      { pluginId: Type.String(), projectId: Type.String({ format: 'uuid' }) },
      { additionalProperties: false },
    ),
    result: PluginWorkerStateSchema,
  },
  'plugin/stop': {
    params: Type.Object(
      { pluginId: Type.String(), projectId: Type.String({ format: 'uuid' }) },
      { additionalProperties: false },
    ),
    result: PluginWorkerStateSchema,
  },
  'plugin/status': {
    params: Type.Object(
      { pluginId: Type.String(), projectId: Type.Optional(Type.String({ format: 'uuid' })) },
      { additionalProperties: false },
    ),
    result: PluginWorkerStateSchema,
  },
  'plugin/isolationReport': {
    params: EmptyParams,
    result: IsolationReportSchema,
  },
  'plugin/log': {
    params: Type.Object(
      {
        pluginId: Type.String(),
        projectId: Type.Optional(Type.String({ format: 'uuid' })),
        limit: Type.Optional(Type.Integer({ minimum: 1, maximum: 1000 })),
      },
      { additionalProperties: false },
    ),
    result: Type.Object(
      { entries: Type.Array(PluginLogEntrySchema) },
      { additionalProperties: false },
    ),
  },
  'plugin/setSecret': {
    params: Type.Object(
      { pluginId: Type.String(), name: Type.String(), value: Type.String() },
      { additionalProperties: false },
    ),
    result: Type.Object({ stored: Type.Literal(true) }, { additionalProperties: false }),
  },
  'plugin/panel': {
    params: Type.Object(
      { pluginId: Type.String(), panelId: Type.String() },
      { additionalProperties: false },
    ),
    result: DeclarativePanelSchema,
  },
  'plugin/modules': {
    params: EmptyParams,
    result: PluginModulesResultSchema,
  },
  'update/state': {
    params: EmptyParams,
    result: UpdateStateSchema,
  },
  'update/check': {
    params: EmptyParams,
    result: UpdateStateSchema,
  },
  'update/download': {
    params: Type.Object(
      { version: Type.Optional(Type.String({ minLength: 1 })) },
      { additionalProperties: false },
    ),
    result: UpdateStateSchema,
  },
  'update/install': {
    params: EmptyParams,
    result: Type.Object(
      { launched: Type.Boolean(), instructions: Type.String() },
      { additionalProperties: false },
    ),
  },
  'update/rollback': {
    params: EmptyParams,
    result: Type.Object(
      { launched: Type.Boolean(), instructions: Type.String() },
      { additionalProperties: false },
    ),
  },
  'update/dismiss': {
    params: Type.Object(
      { version: Type.String({ minLength: 1 }) },
      { additionalProperties: false },
    ),
    result: UpdateStateSchema,
  },
} as const satisfies Record<string, { params: TSchema; result: TSchema }>;

export const RpcNotifications = {
  'project/changed': {
    params: Type.Object(
      {
        kind: Type.Union([
          Type.Literal('created'),
          Type.Literal('cloned'),
          Type.Literal('opened'),
          Type.Literal('removed'),
        ]),
        project: ProjectSummarySchema,
      },
      { additionalProperties: false },
    ),
  },
  'settings/changed': {
    params: Type.Object(
      {
        key: Type.String(),
        scope: SettingsScope,
        projectId: Type.Optional(Type.String({ format: 'uuid' })),
        sessionId: Type.Optional(Type.String({ format: 'uuid' })),
      },
      { additionalProperties: false },
    ),
  },
  'task/changed': {
    params: Type.Object(
      {
        projectId: Type.String({ format: 'uuid' }),
        task: TaskRecordSchema,
      },
      { additionalProperties: false },
    ),
  },
  'task/event': {
    params: Type.Object(
      {
        projectId: Type.String({ format: 'uuid' }),
        event: TaskEventSchema,
      },
      { additionalProperties: false },
    ),
  },
  'task/question': {
    params: Type.Object(
      {
        projectId: Type.String({ format: 'uuid' }),
        question: TaskQuestionSchema,
      },
      { additionalProperties: false },
    ),
  },
  'broker/approvalRequested': {
    params: Type.Object(
      {
        projectId: Type.String({ format: 'uuid' }),
        approval: ApprovalRequestSchema,
      },
      { additionalProperties: false },
    ),
  },
  'broker/approvalResolved': {
    params: Type.Object(
      {
        projectId: Type.String({ format: 'uuid' }),
        approval: ApprovalRequestSchema,
      },
      { additionalProperties: false },
    ),
  },
  'tool/called': {
    params: Type.Object(
      {
        projectId: Type.String({ format: 'uuid' }),
        call: ToolCallRecordSchema,
      },
      { additionalProperties: false },
    ),
  },
  'model/delta': {
    params: Type.Object(
      { requestId: Type.String(), delta: Type.String() },
      { additionalProperties: false },
    ),
  },
  'mcp/stateChanged': { params: McpConnectionStateChangedSchema },
  'mcp/inputRequired': { params: McpInputRequiredSchema },
  'change/lockChanged': {
    params: Type.Object(
      { projectId: Type.String({ format: 'uuid' }), lock: ResourceLockSchema },
      { additionalProperties: false },
    ),
  },
  'change/integrationChanged': {
    params: Type.Object(
      { projectId: Type.String({ format: 'uuid' }), integration: IntegrationRecordSchema },
      { additionalProperties: false },
    ),
  },
  'change/requestChanged': {
    params: Type.Object(
      { projectId: Type.String({ format: 'uuid' }), request: ChangeRequestSchema },
      { additionalProperties: false },
    ),
  },
  'engine/capabilitiesChanged': {
    params: Type.Object(
      { projectId: Type.String({ format: 'uuid' }), report: EngineCapabilityReportSchema },
      { additionalProperties: false },
    ),
  },
  'engine/runChanged': {
    params: Type.Object(
      { projectId: Type.String({ format: 'uuid' }), run: EngineOperationRunSchema },
      { additionalProperties: false },
    ),
  },
  'dcc/capabilitiesChanged': {
    params: Type.Object(
      {
        projectId: Type.String({ format: 'uuid' }),
        tool: DccToolSchema,
        report: DccCapabilityReportSchema,
      },
      { additionalProperties: false },
    ),
  },
  'dcc/runChanged': {
    params: Type.Object(
      { projectId: Type.String({ format: 'uuid' }), tool: DccToolSchema, run: DccRunSchema },
      { additionalProperties: false },
    ),
  },
  'asset/jobChanged': {
    params: Type.Object(
      { projectId: Type.String({ format: 'uuid' }), job: AssetJobSchema },
      { additionalProperties: false },
    ),
  },
  'backup/runChanged': {
    params: Type.Object({ run: BackupRunSchema }, { additionalProperties: false }),
  },
  'update/stateChanged': {
    params: Type.Object({ state: UpdateStateSchema }, { additionalProperties: false }),
  },
  'knowledge/indexChanged': {
    params: Type.Object(
      { projectId: Type.String({ format: 'uuid' }), status: KnowledgeIndexStateSchema },
      { additionalProperties: false },
    ),
  },
  'knowledge/recordChanged': {
    params: Type.Object(
      { projectId: Type.String({ format: 'uuid' }), record: CanonRecordSchema },
      { additionalProperties: false },
    ),
  },
  'board/threadChanged': {
    params: Type.Object(
      { projectId: Type.String({ format: 'uuid' }), thread: BoardThreadSchema },
      { additionalProperties: false },
    ),
  },
  'board/messagePosted': {
    params: Type.Object(
      { projectId: Type.String({ format: 'uuid' }), message: BoardMessageSchema },
      { additionalProperties: false },
    ),
  },
  'board/decisionChanged': {
    params: Type.Object(
      { projectId: Type.String({ format: 'uuid' }), decision: BindingDecisionSchema },
      { additionalProperties: false },
    ),
  },
  'plugin/workerChanged': {
    params: Type.Object({ state: PluginWorkerStateSchema }, { additionalProperties: false }),
  },
  'plugin/changed': {
    params: Type.Object({ pluginId: Type.String() }, { additionalProperties: false }),
  },
} as const satisfies Record<string, { params: TSchema }>;

export type RpcMethodName = keyof typeof RpcMethods;
export type RpcParams<M extends RpcMethodName> = Static<(typeof RpcMethods)[M]['params']>;
export type RpcResult<M extends RpcMethodName> = Static<(typeof RpcMethods)[M]['result']>;
export type RpcNotificationName = keyof typeof RpcNotifications;
export type RpcNotificationParams<N extends RpcNotificationName> = Static<
  (typeof RpcNotifications)[N]['params']
>;

export const RpcErrorCode = {
  Unauthenticated: -32000,
  InvalidProjectFolder: -32001,
  EngineLocked: -32002,
  ProjectAlreadyExists: -32003,
  ProjectNotFound: -32004,
  ProtocolVersionMismatch: -32005,
  UnknownSetting: -32010,
  InvalidSettingValue: -32011,
  SettingScopeNotAllowed: -32012,
  UnknownSession: -32013,
  TaskNotFound: -32020,
  TaskDepthExceeded: -32021,
  InvalidTaskTransition: -32022,
  TaskDependencyCycle: -32023,
  UnknownTaskKind: -32024,
  QuestionNotFound: -32025,
  TaskNotWaiting: -32026,
  ToolNotFound: -32030,
  ToolDenied: -32031,
  ToolInputInvalid: -32032,
  ApprovalNotFound: -32033,
  PathOutsideProject: -32034,
  ApprovalAlreadyResolved: -32035,
  AccountNotFound: -32040,
  ModelNotFound: -32041,
  NoEligibleModel: -32042,
  ProviderRequestFailed: -32043,
  PoolNotFound: -32044,
  DecisionNotFound: -32045,
  ProviderUnsupportedFeature: -32046,
  SkillNotFound: -32050,
  SkillInvalid: -32051,
  SkillSourceUnsupported: -32052,
  SkillTooLarge: -32053,
  SkillAlreadyInstalled: -32054,
  RoleNotFound: -32055,
  RoleInvalid: -32056,
  ProjectUntrusted: -32057,
  McpConnectionNotFound: -32060,
  McpUnsupportedProtocolVersion: -32061,
  McpConnectFailed: -32062,
  McpRequestFailed: -32063,
  McpSamplingRefused: -32064,
  McpDockerUnavailable: -32065,
  McpInputRequestNotFound: -32066,
  BoardThreadNotFound: -32070,
  BoardMessageNotFound: -32071,
  BoardMessageImmutable: -32072,
  BoardBindingNotAllowed: -32073,
  BoardDecisionNotFound: -32074,
  BoardDeletionDisabled: -32075,
  BoardSyncConflict: -32076,
  PluginNotFound: -32081,
  PluginManifestInvalid: -32082,
  PluginCapabilitiesNotAccepted: -32083,
  PluginCapabilityDenied: -32084,
  PluginIsolationUnavailable: -32085,
  PluginWorkerFailed: -32086,
  PluginDependencyMissing: -32087,
  PluginIncompatible: -32088,
  AssetProviderAccountNotFound: -32089,
  EngineInstallationNotFound: -32090,
  EngineOperationUnavailable: -32091,
  EngineRunFailed: -32092,
  EngineProjectIdentityUnproven: -32093,
  EngineFamilyMismatch: -32094,
  AssetJobNotFound: -32095,
  AssetJobInvalidTransition: -32096,
  AssetProviderRequestFailed: -32097,
  AssetDownloadTooLarge: -32098,
  AssetPathOutsideProject: -32099,
  CanonRecordNotFound: -32100,
  CanonRecordInvalid: -32101,
  CanonDuplicateId: -32102,
  CanonStatusNotAllowed: -32103,
  VectorStoreUnavailable: -32104,
  EmbeddingProfileMissing: -32105,
  AssetPreviewUnavailable: -32106,
  BackupIdentityNotFound: -32107,
  BackupDestinationNotFound: -32108,
  BackupPlanNotFound: -32109,
  BackupRunNotFound: -32110,
  BackupArchiveNotFound: -32111,
  BackupUnlockFailed: -32112,
  BackupArchiveCorrupt: -32113,
  BackupDestinationFailed: -32114,
  BackupTargetNotEmpty: -32115,
  DccInstallationNotFound: -32116,
  DccToolUnsupportedOnHost: -32117,
  DccOperationUnavailable: -32118,
  DccRunNotFound: -32119,
  DccScriptRejected: -32120,
  LockConflict: -32121,
  LockNotHeld: -32122,
  IntegrationConflict: -32123,
  IntegrationNotReady: -32124,
  CompletionContractUnmet: -32125,
  WorktreeUnavailable: -32126,
  RoleToolDenied: -32127,
  AgentBudgetExceeded: -32128,
  AgentTurnLimit: -32129,
  UpdateSourceUnavailable: -32130,
  UpdateVerificationFailed: -32131,
  UpdateIncompatible: -32132,
  UpdateNotDownloaded: -32133,
  InvalidParams: -32602,
} as const;
export type RpcErrorCode = (typeof RpcErrorCode)[keyof typeof RpcErrorCode];

export class RpcError extends Error {
  constructor(
    message: string,
    readonly code: RpcErrorCode,
    readonly data?: unknown,
  ) {
    super(message);
    this.name = 'RpcError';
  }
}

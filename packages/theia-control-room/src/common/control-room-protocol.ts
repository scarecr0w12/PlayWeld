import type {
  AccessMode,
  DecisionAssessment,
  ApprovalRequest,
  ChangeRequest,
  ChatConversation,
  ChatEntry,
  ChatResponse,
  FeedbackInput,
  ImpactResult,
  IntegrationRecord,
  ResourceLock,
  EffectiveSetting,
  ExecutionMode,
  EngineCapabilityReport,
  AssetFileEntry,
  AssetJob,
  AssetPreview,
  AssetProviderAccount,
  AssetProviderCapabilities,
  BackupArchiveEntry,
  BackupDestination,
  BackupIdentity,
  BackupManifest,
  BackupPlan,
  BackupRestoreResult,
  BackupRun,
  BackupVerifyResult,
  EngineFamily,
  EngineInstallation,
  EngineOperationRun,
  DccCapabilityReport,
  DccInstallation,
  DccRun,
  DccTool,
  McpConnectionConfig,
  McpConnectionInput,
  McpConnectionListEntry,
  McpConnectionLogEntry,
  McpConnectionPatch,
  McpConnectionState,
  McpToolsResult,
  DeclarativePanel,
  InstalledPlugin,
  IsolationReport,
  PluginCapability,
  PluginInspection,
  PluginListEntry,
  PluginLogEntry,
  PluginModulesResult,
  PluginWorkerState,
  Model,
  ModelCapabilities,
  ModelPool,
  ModelPoolTarget,
  ModelPricing,
  ProjectCreateInput,
  ProjectSummary,
  ProjectSkillEntry,
  ProviderAccount,
  RoleRecord,
  ProviderKind,
  RouteDecision,
  RouteOutcome,
  RpcNotificationParams,
  RpcParams,
  RpcResult,
  SkillActivation,
  SkillCatalogEntry,
  SkillEnablement,
  SkillRecord,
  SkillResourceReadParams,
  SkillResourceReadResult,
  ServiceInfo,
  SideEffect,
  SettingDefinition,
  SettingGroup,
  SettingsScope,
  TaskCreateInput,
  TaskQuestion,
  TaskRecord,
  ToolCallRecord,
  ToolDefinition,
  UpdateState,
} from '@gamecrafter/contracts';

export const ControlRoomService = Symbol('ControlRoomService');
export const CONTROL_ROOM_SERVICE_PATH = '/services/gamecrafter/control-room';

export interface ControlRoomService {
  listChatConversations(projectId: string): Promise<ChatConversation[]>;
  createChatConversation(projectId: string, title: string): Promise<ChatConversation>;
  listChatMessages(projectId: string, conversationId: string): Promise<ChatEntry[]>;
  appendChatMessage(input: RpcParams<'chat/append'>): Promise<ChatEntry>;
  deleteChatConversation(projectId: string, conversationId: string): Promise<void>;
  completeChat(input: RpcParams<'model/complete'>): Promise<ChatResponse>;
  getServiceInfo(): Promise<ServiceInfo>;
  getUpdateState(): Promise<UpdateState>;
  checkUpdates(): Promise<UpdateState>;
  downloadUpdate(version?: string): Promise<UpdateState>;
  installUpdate(): Promise<RpcResult<'update/install'>>;
  rollbackUpdate(): Promise<RpcResult<'update/rollback'>>;
  dismissUpdate(version: string): Promise<UpdateState>;
  listProjects(): Promise<ProjectSummary[]>;
  createProject(input: ProjectCreateInput): Promise<ProjectSummary>;
  openProject(path: string): Promise<ProjectSummary>;
  getDefaultProjectsDirectory(): Promise<string>;
  describeSettings(): Promise<{ groups: SettingGroup[]; definitions: SettingDefinition[] }>;
  getAllSettings(projectId?: string): Promise<EffectiveSetting[]>;
  importSettings(input: RpcParams<'settings/import'>): Promise<RpcResult<'settings/import'>>;
  exportSettings(projectId?: string): Promise<RpcResult<'settings/export'>>;
  setSetting(
    key: string,
    scope: SettingsScope,
    value: unknown,
    projectId?: string,
  ): Promise<EffectiveSetting>;
  readAudit(projectId: string, afterSeq?: number): Promise<RpcResult<'audit/read'>>;
  listTasks(projectId: string): Promise<TaskRecord[]>;
  getTaskTree(projectId: string, rootTaskId: string): Promise<TaskRecord[]>;
  listTaskEvents(params: RpcParams<'task/events'>): Promise<RpcResult<'task/events'>>;
  listTaskQuestions(pendingOnly?: boolean): Promise<TaskQuestion[]>;
  createTask(input: TaskCreateInput): Promise<{ task: TaskRecord; deduplicated: boolean }>;
  cancelTask(projectId: string, taskId: string, reason?: string): Promise<string[]>;
  answerQuestion(
    projectId: string,
    taskId: string,
    questionId: string,
    answer: unknown,
  ): Promise<TaskRecord>;
  listTools(projectId?: string): Promise<ToolDefinition[]>;
  callTool(
    projectId: string,
    toolId: string,
    input: unknown,
    options?: {
      taskId?: string;
      agentId?: string;
      accessCeiling?: AccessMode;
    },
  ): Promise<ToolCallRecord>;
  listApprovals(projectId: string, pendingOnly?: boolean): Promise<ApprovalRequest[]>;
  approve(
    projectId: string,
    approvalId: string,
    approve: boolean,
    reason?: string,
  ): Promise<ApprovalRequest>;
  listProviderAccounts(): Promise<ProviderAccount[]>;
  addProviderAccount(input: {
    providerKind: ProviderKind;
    displayName: string;
    baseUrl: string;
    apiKey?: string;
    headers?: Record<string, string>;
    isLocal?: boolean;
  }): Promise<ProviderAccount>;
  updateProviderAccount(
    accountId: string,
    patch: {
      displayName?: string;
      baseUrl?: string;
      apiKey?: string | null;
      headers?: Record<string, string>;
      enabled?: boolean;
      isLocal?: boolean;
    },
  ): Promise<ProviderAccount>;
  removeProviderAccount(accountId: string): Promise<void>;
  testProviderAccount(accountId: string): Promise<{
    ok: boolean;
    latencyMs: number;
    discoveredModels: number;
    error?: string;
  }>;
  listModels(accountId?: string, enabledOnly?: boolean): Promise<Model[]>;
  discoverModels(
    accountId: string,
    options?: { preview?: boolean; providerModelIds?: string[] },
  ): Promise<{ added: number; updated: number; models: Model[] }>;
  updateModel(
    modelId: string,
    patch: {
      enabled?: boolean;
      displayName?: string;
      capabilities?: Partial<ModelCapabilities>;
      pricing?: ModelPricing;
      tags?: string[];
      workTypes?: string[];
      roles?: string[];
    },
  ): Promise<Model>;
  listModelPools(projectId?: string): Promise<ModelPool[]>;
  createModelPool(input: {
    name: string;
    scope: 'platform' | 'project';
    projectId?: string;
    target: ModelPoolTarget | null;
    modelIds: string[];
  }): Promise<ModelPool>;
  updateModelPool(
    poolId: string,
    patch: {
      name?: string;
      scope?: 'platform' | 'project';
      projectId?: string | null;
      target?: ModelPoolTarget | null;
      modelIds?: string[];
    },
  ): Promise<ModelPool>;
  deleteModelPool(poolId: string): Promise<void>;
  listRouteDecisions(
    projectId?: string,
    limit?: number,
  ): Promise<Array<{ decision: RouteDecision; outcome: RouteOutcome | null }>>;
  listDecisionAssessments(
    projectId: string,
    taskId?: string,
    limit?: number,
  ): Promise<DecisionAssessment[]>;
  routerStats(taskType?: string): Promise<{
    models: Array<{
      modelId: string;
      taskType: string | null;
      observations: number;
      successRate: number;
      qualityMean: number | null;
      meanCostUsd: number | null;
      meanLatencyMs: number | null;
    }>;
  }>;
  readSkillResource(input: SkillResourceReadParams): Promise<SkillResourceReadResult>;
  listSkills(projectId?: string): Promise<ProjectSkillEntry[]>;
  installSkills(source: string, name?: string, force?: boolean): Promise<SkillRecord[]>;
  uninstallSkill(name: string): Promise<void>;
  enableSkill(input: {
    projectId: string;
    name: string;
    enabled: boolean;
    roles?: string[] | null;
    workTypes?: string[] | null;
    pin?: boolean;
  }): Promise<SkillEnablement>;
  previewSkillCatalog(input: {
    projectId: string;
    agentRole?: string;
    workType?: string;
    taskText?: string;
    accessMode?: AccessMode;
  }): Promise<{ entries: SkillCatalogEntry[]; truncated: boolean }>;
  searchSkills(input: {
    projectId: string;
    query: string;
    agentRole?: string;
    workType?: string;
  }): Promise<{ entries: SkillCatalogEntry[] }>;
  validateSkill(path: string): Promise<{
    ok: boolean;
    errors: string[];
    warnings: string[];
    record: SkillRecord | null;
  }>;
  listSkillActivations(projectId: string, taskId?: string): Promise<SkillActivation[]>;
  listRoles(projectId?: string): Promise<RoleRecord[]>;
  getRole(name: string, projectId?: string): Promise<RoleRecord>;
  trustProject(projectId: string, trusted: boolean): Promise<ProjectSummary>;
  listEngineInstallations(family?: EngineFamily): Promise<EngineInstallation[]>;
  addEngineInstallation(input: RpcParams<'engine/addInstallation'>): Promise<EngineInstallation>;
  removeEngineInstallation(installationId: string): Promise<void>;
  getEngineCapabilities(projectId: string, refresh?: boolean): Promise<EngineCapabilityReport>;
  runEngine(params: RpcParams<'engine/run'>): Promise<EngineOperationRun>;
  listEngineRuns(projectId: string, limit?: number): Promise<EngineOperationRun[]>;
  getEngineRun(projectId: string, runId: string): Promise<EngineOperationRun>;
  setEngineLiveBridge(projectId: string, connectionId: string | null): Promise<string | null>;
  listDccInstallations(tool?: DccTool): Promise<DccInstallation[]>;
  addDccInstallation(input: RpcParams<'dcc/addInstallation'>): Promise<DccInstallation>;
  removeDccInstallation(installationId: string): Promise<void>;
  getDccCapabilities(
    projectId: string,
    tool: DccTool,
    refresh?: boolean,
  ): Promise<DccCapabilityReport>;
  runDcc(input: RpcParams<'dcc/run'>): Promise<DccRun>;
  listDccRuns(projectId: string, tool?: DccTool, limit?: number): Promise<DccRun[]>;
  getDccRun(projectId: string, runId: string): Promise<DccRun>;
  setDccLiveBridge(
    projectId: string,
    tool: DccTool,
    connectionId: string | null,
  ): Promise<string | null>;
  getProject(projectId: string): Promise<ProjectSummary>;
  listAssetProviders(): Promise<AssetProviderCapabilities[]>;
  listAssetAccounts(): Promise<AssetProviderAccount[]>;
  addAssetAccount(input: RpcParams<'asset/addAccount'>): Promise<AssetProviderAccount>;
  updateAssetAccount(input: RpcParams<'asset/updateAccount'>): Promise<AssetProviderAccount>;
  removeAssetAccount(accountId: string): Promise<void>;
  testAssetAccount(accountId: string): Promise<RpcResult<'asset/testAccount'>>;
  generateAsset(input: RpcParams<'asset/generate'>): Promise<AssetJob>;
  listAssetJobs(input: RpcParams<'asset/jobs'>): Promise<AssetJob[]>;
  getAssetJob(input: RpcParams<'asset/job'>): Promise<AssetJob>;
  cancelAssetJob(input: RpcParams<'asset/cancel'>): Promise<AssetJob>;
  reviewAssetJob(input: RpcParams<'asset/review'>): Promise<AssetJob>;
  importAsset(input: RpcParams<'asset/import'>): Promise<RpcResult<'asset/import'>>;
  listAssetFiles(input: RpcParams<'asset/files'>): Promise<AssetFileEntry[]>;
  previewAsset(input: RpcParams<'asset/preview'>): Promise<AssetPreview>;
  openAssetInAuthoringTool(
    input: RpcParams<'asset/openInAuthoringTool'>,
  ): Promise<RpcResult<'asset/openInAuthoringTool'>>;
  listBackupIdentities(): Promise<BackupIdentity[]>;
  createBackupIdentity(input: RpcParams<'backup/identity/create'>): Promise<BackupIdentity>;
  removeBackupIdentity(identityId: string): Promise<void>;
  listBackupDestinations(): Promise<BackupDestination[]>;
  addBackupDestination(input: RpcParams<'backup/addDestination'>): Promise<BackupDestination>;
  updateBackupDestination(input: RpcParams<'backup/updateDestination'>): Promise<BackupDestination>;
  removeBackupDestination(destinationId: string): Promise<void>;
  testBackupDestination(destinationId: string): Promise<RpcResult<'backup/testDestination'>>;
  listBackupPlans(projectId?: string): Promise<BackupPlan[]>;
  saveBackupPlan(input: RpcParams<'backup/savePlan'>): Promise<BackupPlan>;
  removeBackupPlan(planId: string): Promise<void>;
  runBackup(input: RpcParams<'backup/run'>): Promise<BackupRun>;
  listBackupRuns(projectId?: string, limit?: number): Promise<BackupRun[]>;
  getBackupRun(runId: string): Promise<BackupRun>;
  cancelBackupRun(runId: string): Promise<BackupRun>;
  listBackupArchives(destinationId: string): Promise<BackupArchiveEntry[]>;
  inspectBackupArchive(input: RpcParams<'backup/inspect'>): Promise<BackupManifest>;
  verifyBackupArchive(input: RpcParams<'backup/verify'>): Promise<BackupVerifyResult>;
  restoreBackupArchive(input: RpcParams<'backup/restore'>): Promise<BackupRestoreResult>;
  listMcpConnections(projectId?: string): Promise<McpConnectionListEntry[]>;
  addMcpConnection(
    config: McpConnectionInput,
    credentials?: Record<string, string>,
  ): Promise<McpConnectionConfig>;
  updateMcpConnection(
    connectionId: string,
    patch: McpConnectionPatch,
    credentials?: Record<string, string>,
  ): Promise<McpConnectionConfig>;
  removeMcpConnection(connectionId: string): Promise<void>;
  connectMcpConnection(connectionId: string): Promise<McpConnectionState>;
  disconnectMcpConnection(connectionId: string): Promise<McpConnectionState>;
  listMcpTools(connectionId: string): Promise<McpToolsResult>;
  refreshMcpTools(connectionId: string): Promise<McpToolsResult>;
  answerMcpInput(connectionId: string, requestId: string, responses: unknown): Promise<void>;
  classifyMcpTool(
    connectionId: string,
    toolName: string,
    sideEffects?: SideEffect,
    executionMode?: ExecutionMode,
  ): Promise<ToolDefinition>;
  listMcpLogs(connectionId: string, limit?: number): Promise<McpConnectionLogEntry[]>;
  listPlugins(projectId?: string): Promise<PluginListEntry[]>;
  inspectPlugin(source: string): Promise<PluginInspection>;
  installPlugin(source: string, acceptCapabilities: PluginCapability[]): Promise<InstalledPlugin>;
  uninstallPlugin(pluginId: string): Promise<{ removed: true }>;
  enablePlugin(pluginId: string, projectId?: string): Promise<{ enabled: true }>;
  disablePlugin(pluginId: string, projectId?: string): Promise<{ enabled: false }>;
  startPlugin(pluginId: string, projectId: string): Promise<PluginWorkerState>;
  stopPlugin(pluginId: string, projectId: string): Promise<PluginWorkerState>;
  getPluginStatus(pluginId: string, projectId?: string): Promise<PluginWorkerState>;
  getPluginIsolationReport(): Promise<IsolationReport>;
  listPluginLogs(pluginId: string, projectId?: string, limit?: number): Promise<PluginLogEntry[]>;
  setPluginSecret(pluginId: string, name: string, value: string): Promise<{ stored: true }>;
  getPluginPanel(pluginId: string, panelId: string): Promise<DeclarativePanel>;
  getPluginModules(): Promise<PluginModulesResult>;
  requestChange(params: RpcParams<'change/request'>): Promise<ChangeRequest>;
  listChangeRequests(params: RpcParams<'change/requests'>): Promise<ChangeRequest[]>;
  getChangeImpact(params: RpcParams<'change/impact'>): Promise<ImpactResult>;
  getChangeGraph(params: RpcParams<'change/graph'>): Promise<RpcResult<'change/graph'>>;
  rebuildChangeGraph(projectId: string): Promise<RpcResult<'change/rebuildGraph'>>;
  listResourceLocks(projectId: string): Promise<ResourceLock[]>;
  releaseResourceLock(projectId: string, lockId: string): Promise<void>;
  listIntegrations(params: RpcParams<'change/integrations'>): Promise<IntegrationRecord[]>;
  integrateTask(projectId: string, taskId: string): Promise<IntegrationRecord>;
  abortIntegration(projectId: string, integrationId: string): Promise<IntegrationRecord>;
  submitFeedback(params: FeedbackInput): Promise<RpcResult<'change/feedback'>>;
  listBoardThreads(params: RpcParams<'board/threads'>): Promise<RpcResult<'board/threads'>>;
  getBoardThread(params: RpcParams<'board/thread'>): Promise<RpcResult<'board/thread'>>;
  createBoardThread(
    params: RpcParams<'board/createThread'>,
  ): Promise<RpcResult<'board/createThread'>>;
  postBoardMessage(params: RpcParams<'board/post'>): Promise<RpcResult<'board/post'>>;
  editBoardMessage(params: RpcParams<'board/edit'>): Promise<RpcResult<'board/edit'>>;
  supersedeBoardMessage(
    params: RpcParams<'board/supersede'>,
  ): Promise<RpcResult<'board/supersede'>>;
  setBoardThreadStatus(
    params: RpcParams<'board/setThreadStatus'>,
  ): Promise<RpcResult<'board/setThreadStatus'>>;
  bindBoardDecision(params: RpcParams<'board/bind'>): Promise<RpcResult<'board/bind'>>;
  listBoardDecisions(params: RpcParams<'board/decisions'>): Promise<RpcResult<'board/decisions'>>;
  getBoardDecision(params: RpcParams<'board/decision'>): Promise<RpcResult<'board/decision'>>;
  retryBoardSync(params: RpcParams<'board/retrySync'>): Promise<RpcResult<'board/retrySync'>>;
  subscribeBoard(params: RpcParams<'board/subscribe'>): Promise<RpcResult<'board/subscribe'>>;
  unsubscribeBoard(params: RpcParams<'board/unsubscribe'>): Promise<RpcResult<'board/unsubscribe'>>;
  listBoardSubscriptions(
    params: RpcParams<'board/subscriptions'>,
  ): Promise<RpcResult<'board/subscriptions'>>;
  getBoardSummary(params: RpcParams<'board/summary'>): Promise<RpcResult<'board/summary'>>;
  searchBoard(params: RpcParams<'board/search'>): Promise<RpcResult<'board/search'>>;
  runBoardMaintenance(
    params: RpcParams<'board/maintenance/run'>,
  ): Promise<RpcResult<'board/maintenance/run'>>;
  getBoardMaintenanceStatus(
    params: RpcParams<'board/maintenance/status'>,
  ): Promise<RpcResult<'board/maintenance/status'>>;
  deleteBoardThread(params: RpcParams<'board/delete'>): Promise<RpcResult<'board/delete'>>;
  listKnowledgeRecords(
    params: RpcParams<'knowledge/records'>,
  ): Promise<RpcResult<'knowledge/records'>>;
  getKnowledgeRecord(params: RpcParams<'knowledge/record'>): Promise<RpcResult<'knowledge/record'>>;
  writeKnowledgeRecord(params: RpcParams<'knowledge/write'>): Promise<RpcResult<'knowledge/write'>>;
  setCanonStatus(
    params: RpcParams<'knowledge/setStatus'>,
  ): Promise<RpcResult<'knowledge/setStatus'>>;
  searchKnowledge(params: RpcParams<'knowledge/search'>): Promise<RpcResult<'knowledge/search'>>;
  getKnowledgeIndexStatus(
    params: RpcParams<'knowledge/index/status'>,
  ): Promise<RpcResult<'knowledge/index/status'>>;
  rebuildKnowledgeIndex(
    params: RpcParams<'knowledge/index/rebuild'>,
  ): Promise<RpcResult<'knowledge/index/rebuild'>>;
  reconcileKnowledgeIndex(
    params: RpcParams<'knowledge/index/reconcile'>,
  ): Promise<RpcResult<'knowledge/index/reconcile'>>;
  setKnowledgeEmbeddingProfile(
    params: RpcParams<'knowledge/embeddingProfile/set'>,
  ): Promise<RpcResult<'knowledge/embeddingProfile/set'>>;
  getKnowledgeGraph(params: RpcParams<'knowledge/graph'>): Promise<RpcResult<'knowledge/graph'>>;
  testKnowledgeVectorStore(
    params: RpcParams<'knowledge/vectorStore/test'>,
  ): Promise<RpcResult<'knowledge/vectorStore/test'>>;
}

export interface ControlRoomClient {
  onModelDelta(event: RpcNotificationParams<'model/delta'>): void;
  onProjectChanged(event: RpcNotificationParams<'project/changed'>): void;
  onSettingsChanged(event: RpcNotificationParams<'settings/changed'>): void;
  onTaskChanged(event: { projectId: string; task: TaskRecord }): void;
  onTaskQuestion(event: { projectId: string; question: TaskQuestion }): void;
  onApprovalRequested(event: RpcNotificationParams<'broker/approvalRequested'>): void;
  onApprovalResolved(event: RpcNotificationParams<'broker/approvalResolved'>): void;
  onToolCalled(event: RpcNotificationParams<'tool/called'>): void;
  onMcpStateChanged(event: RpcNotificationParams<'mcp/stateChanged'>): void;
  onMcpInputRequired(event: RpcNotificationParams<'mcp/inputRequired'>): void;
  onBoardThreadChanged(event: RpcNotificationParams<'board/threadChanged'>): void;
  onBoardMessagePosted(event: RpcNotificationParams<'board/messagePosted'>): void;
  onBoardDecisionChanged(event: RpcNotificationParams<'board/decisionChanged'>): void;
  onPluginWorkerChanged(event: RpcNotificationParams<'plugin/workerChanged'>): void;
  onPluginChanged(event: RpcNotificationParams<'plugin/changed'>): void;
  onEngineCapabilitiesChanged(event: RpcNotificationParams<'engine/capabilitiesChanged'>): void;
  onEngineRunChanged(event: RpcNotificationParams<'engine/runChanged'>): void;
  onDccCapabilitiesChanged(event: RpcNotificationParams<'dcc/capabilitiesChanged'>): void;
  onDccRunChanged(event: RpcNotificationParams<'dcc/runChanged'>): void;
  onAssetJobChanged(event: RpcNotificationParams<'asset/jobChanged'>): void;
  onBackupRunChanged(event: RpcNotificationParams<'backup/runChanged'>): void;
  onKnowledgeIndexChanged(event: RpcNotificationParams<'knowledge/indexChanged'>): void;
  onKnowledgeRecordChanged(event: RpcNotificationParams<'knowledge/recordChanged'>): void;
  onChangeLockChanged(event: RpcNotificationParams<'change/lockChanged'>): void;
  onChangeIntegrationChanged(event: RpcNotificationParams<'change/integrationChanged'>): void;
  onChangeRequestChanged(event: RpcNotificationParams<'change/requestChanged'>): void;
  onServiceStatus(status: { connected: boolean; message?: string }): void;
}

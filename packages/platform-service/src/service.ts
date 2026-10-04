import { randomBytes } from 'node:crypto';
import { chmodSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import {
  PROTOCOL_VERSION,
  redact,
  RpcError,
  RpcErrorCode,
  isTerminal,
  type IntegrationRecord,
  type ProjectCloneInput,
  type ProjectCreateInput,
  type DccTool,
  type TaskCreateInput,
} from '@gamecrafter/contracts';
import { Database } from './db/database';
import { registerAgentTools } from './agents/agent-tools';
import { ChangeGraph } from './change/change-graph';
import { ChangeGraphStore } from './change/change-graph-store';
import { ChangeService } from './change/change-service';
import { registerChangeTools } from './change/change-tools';
import { IntegrationService } from './change/integration-service';
import { FeedbackService } from './change/feedback-service';
import { ChatService } from './chat/chat-service';
import { LockManager } from './change/lock-manager';
import { WorktreeManager } from './change/worktree-manager';
import { IpcServer, type RpcHandlers } from './ipc/server';
import { latestMigrationVersion, migrate } from './db/migrator';
import { snapshotBeforeMigrations } from './db/migration-snapshot';
import type { ServicePaths } from './paths';
import { profileMigrations } from './profile/migrations';
import { CredentialStore } from './profile/credential-store';
import { ProfileStore } from './profile/profile-store';
import { ProjectDatabases } from './projects/project-databases';
import { ProjectWorkspace } from './projects/workspace';
import { createBuiltinSettings } from './settings/definitions';
import { SettingsRegistry } from './settings/registry';
import { SettingsService } from './settings/settings-service';
import { TaskService } from './tasks/task-service';
import {
  HandlerRegistry,
  registerAgentHandlers,
  registerBoardMaintenanceHandlers,
  registerBuiltinHandlers,
  registerKnowledgeHandlers,
} from './workers/handler-registry';
import { WorkerSupervisor, type WorkerScheduleSnapshot } from './workers/supervisor';
import { log } from './logger';
import { CompletionService } from './models/completion-service';
import { ModelRegistry } from './models/model-registry';
import { ModelRouter } from './models/router';
import { createBuiltinModelProviders } from './models/providers';
import { RoleRegistry } from './roles/role-registry';
import { SkillCatalog } from './skills/skill-catalog';
import { SkillInstaller } from './skills/skill-installer';
import { findBundledSkillsDirectory, SkillRegistry } from './skills/skill-registry';
import { SkillService } from './skills/skill-service';
import { registerSkillTools } from './skills/skill-tools';
import { ToolBroker } from './tools/tool-broker';
import { registerBuiltinTools } from './tools/builtin-tools';
import { ToolRegistry } from './tools/tool-registry';
import { McpConnectionManager } from './mcp/connection-manager';
import { BoardService } from './board/board-service';
import { BoardMaintenanceService } from './board/board-maintenance-service';
import { CanonSyncWorkflow } from './board/canon-sync-workflow';
import { registerBoardMaintenanceTool, registerBoardTools } from './board/board-tools';
import { BoardMaintenanceScheduler } from './board/maintenance-scheduler';
import { PluginHost } from './plugins/plugin-host';
import { PluginInstaller } from './plugins/plugin-installer';
import { PluginRegistry } from './plugins/plugin-registry';
import { PluginService } from './plugins/plugin-service';
import type { IsolationLauncher } from './plugins/isolation/types';
import { EngineConnectorService } from './engines/engine-connector-service';
import { DccConnectorService } from './dcc/dcc-connector-service';
import { AssetService } from './assets/asset-service';
import { BackupService } from './backup/backup-service';
import { KnowledgeService } from './knowledge/knowledge-service';
import type { VectorStore } from './knowledge/vector-store';
import type { VectorStoreAdapter } from './knowledge/vector-store-registry';
import { UpdateStore } from './updates/update-store';
import { UpdateService } from './updates/update-service';
import { SqliteUpdateDismissalStore } from './updates/update-dismissal-store';
import { projectMigrations } from './projects/migrations';

export interface PlatformServiceOptions {
  paths: ServicePaths;
  platformVersion: string;
  onClientEvent?: (event: 'connected' | 'closed') => void;
  onStopRequested?: (checkpoint: boolean) => Promise<void> | void;
  onWorkerStarted?: (taskId: string, workerId: string, pid: number) => void;
  onWorkerFinalMessage?: (
    taskId: string,
    workerId: string,
    messageType: 'result' | 'failed',
  ) => void;
  onWorkerExited?: (taskId: string, workerId: string) => void;
  onWorkerScheduleSnapshot?: (snapshot: WorkerScheduleSnapshot) => void;
  approvalTimeoutOverrideMs?: number;
  backupNow?: () => Date;
  updateFetch?: typeof fetch;
  pluginLaunchers?: {
    linux?: IsolationLauncher;
    win32?: IsolationLauncher;
    unisolated?: IsolationLauncher;
  };
  knowledgeVectorStoreFactory?: (projectId: string) => VectorStore;
  knowledgeVectorStoreAdapters?: VectorStoreAdapter[];
  qdrantBinaryPath?: string;
}

export class PlatformService {
  readonly socketPath: string;
  readonly startedAt: string;
  private stopped = false;
  private updateTimer?: NodeJS.Timeout;

  private constructor(
    private readonly server: IpcServer,
    private readonly database: Database,
    private readonly projectDatabases: ProjectDatabases,
    private readonly workerSupervisor: WorkerSupervisor,
    private readonly toolBroker: ToolBroker,
    private readonly mcpConnections: McpConnectionManager,
    private readonly boardMaintenanceScheduler: BoardMaintenanceScheduler,
    private readonly pluginHost: PluginHost,
    private readonly knowledgeService: KnowledgeService,
    private readonly assetService: AssetService,
    private readonly backupService: BackupService,
    private readonly changeGraph: ChangeGraph,
    private readonly integrationService: IntegrationService,
    paths: ServicePaths,
    startedAt: string,
  ) {
    this.socketPath = paths.socketPath;
    this.startedAt = startedAt;
  }

  static async start(options: PlatformServiceOptions): Promise<PlatformService> {
    const { paths, platformVersion } = options;
    mkdirSync(paths.profileDir, { recursive: true, mode: 0o700 });
    if (process.platform !== 'win32') chmodSync(paths.profileDir, 0o700);
    mkdirSync(paths.logDir, { recursive: true, mode: 0o700 });
    const token = loadOrCreateToken(paths);
    const database = Database.open(paths.profileDbPath);
    snapshotBeforeMigrations(database, paths.profileDir, profileMigrations);
    migrate(database, profileMigrations);
    const profile = new ProfileStore(database);
    const workspace = new ProjectWorkspace({ profile, platformVersion });
    const projectDatabases = new ProjectDatabases(profile);
    const settingsRegistry = new SettingsRegistry();
    const builtins = createBuiltinSettings();
    settingsRegistry.register('builtin', builtins.groups, builtins.definitions);
    const settingsService = new SettingsService(settingsRegistry, database, projectDatabases);
    const createUpdateService = () =>
      new UpdateService({
        store: new UpdateStore(database, platformVersion),
        dismissals: new SqliteUpdateDismissalStore(database),
        currentVersion: platformVersion,
        releasesUrl: String(settingsService.resolve('updates.releasesUrl', {}).value),
        updatesDir: path.join(paths.profileDir, 'updates'),
        profileSchemaVersion: latestMigrationVersion(profileMigrations),
        projectSchemaVersion: latestMigrationVersion(projectMigrations),
        platform: {
          os: process.platform === 'win32' ? 'windows' : 'linux',
          arch: process.arch === 'arm64' ? 'arm64' : 'x64',
        },
        signaturePublicKeyPem:
          String(settingsService.resolve('updates.signingPublicKey', {}).value).trim() || undefined,
        fetch: options.updateFetch,
      });
    let updateService = createUpdateService();
    let scheduleUpdateChecks: () => void = () => undefined;
    const lockManager = new LockManager(projectDatabases, settingsService);
    const worktrees = new WorktreeManager(profile, settingsService);
    const integrationRef: { service?: IntegrationService } = {};
    const credentials = new CredentialStore(database, paths.profileDir);
    const modelProviders = createBuiltinModelProviders();
    const modelRegistry = new ModelRegistry(database, credentials, modelProviders);
    const modelRouter = new ModelRouter({
      database,
      registry: modelRegistry,
      settings: settingsService,
    });
    const completionService = new CompletionService(modelRegistry, modelRouter);
    const chatService = new ChatService(projectDatabases);
    const pluginInstaller = new PluginInstaller({
      database,
      profileDir: paths.profileDir,
      platformVersion,
      settings: settingsService,
    });
    const pluginRegistry = new PluginRegistry({ database, profile, installer: pluginInstaller });
    const handlerRegistry = new HandlerRegistry();
    registerBuiltinHandlers(handlerRegistry);
    registerBoardMaintenanceHandlers(handlerRegistry);
    registerKnowledgeHandlers(handlerRegistry);
    registerAgentHandlers(handlerRegistry);
    const taskService = new TaskService(
      profile,
      projectDatabases,
      settingsService,
      handlerRegistry,
      {
        taskChanged: (projectId, task) => {
          server.broadcast('task/changed', { projectId, task });
          changeGraphRef.service?.scheduleRebuild(projectId);
          if (isTerminal(task.state)) lockManager.releaseTask(projectId, task.taskId);
          if (task.state === 'succeeded')
            void integrationRef.service?.processTask(task).catch((error: unknown) =>
              log('warn', 'Task integration processing failed', {
                projectId,
                taskId: task.taskId,
                error: error instanceof Error ? error.message : String(error),
              }),
            );
        },
        taskEvent: (projectId, event) => {
          server.broadcast('task/event', { projectId, event });
          const payload = event.payload as { reason?: unknown };
          if (event.kind === 'task.retry' && payload.reason === 'lease_expired' && event.taskId)
            lockManager.releaseTask(projectId, event.taskId);
          changeGraphRef.service?.scheduleRebuild(projectId);
        },
        taskQuestion: (projectId, question) =>
          server.broadcast('task/question', { projectId, question }),
      },
    );
    const skillInstaller = new SkillInstaller(database, paths.profileDir, settingsService);
    const skillRegistry = new SkillRegistry({
      profile,
      projectDatabases,
      installer: skillInstaller,
      bundledSkillsDirectory: findBundledSkillsDirectory(),
      settings: settingsService,
      pluginSkillDirectories: (projectId) => pluginRegistry.skillDirectories(projectId),
    });
    const roleRegistry = new RoleRegistry({
      profile,
      profileDir: paths.profileDir,
      pluginRoleDirectories: (projectId) => pluginRegistry.roleDirectories(projectId),
    });
    taskService.setRoleResolver((roleName, projectId) => roleRegistry.get(roleName, projectId));
    const skillCatalog = new SkillCatalog({
      registry: skillRegistry,
      workspace,
      projectDatabases,
      settings: settingsService,
    });
    const skillService = new SkillService(
      skillInstaller,
      skillRegistry,
      skillCatalog,
      roleRegistry,
      taskService,
      settingsService,
    );
    const toolRegistry = new ToolRegistry();
    registerBuiltinTools(toolRegistry, {
      readOnlyRoots: (projectId) => skillService.readableSkillRoots(projectId),
    });
    registerSkillTools(toolRegistry, skillService);
    registerAgentTools(toolRegistry, {
      completion: completionService,
      tasks: taskService,
      roles: roleRegistry,
      projects: profile,
      locks: lockManager,
    });
    const toolBroker = new ToolBroker({
      registry: toolRegistry,
      settings: settingsService,
      projectDatabases,
      projects: profile,
      tasks: taskService,
      roles: roleRegistry,
      locks: lockManager,
      requiredLocks: async (request, tool, task) => {
        if (!task) return [];
        const input = asRecord(request.input);
        const required: { resource: string; mode: 'shared' | 'exclusive' }[] = [];
        if (request.toolId === 'fs/write-file' && task.isolation !== 'worktree') {
          const filePath = normalizeResourcePath(stringValue(input.path));
          if (filePath) {
            const resource = `file:${filePath}`;
            const activeTasks = taskService.list(request.projectId, {
              states: ['pending', 'ready', 'claimed', 'running', 'waiting_input'],
              limit: 5_000,
            });
            const overlaps = activeTasks.some(
              (candidate) =>
                candidate.taskId !== task.taskId &&
                candidate.touches?.some(
                  (touch) => touch.intent === 'write' && touch.resource === resource,
                ),
            );
            if (overlaps) required.push({ resource, mode: 'exclusive' });
          }
        }
        if (request.toolId.startsWith('engine/') && tool.executionMode === 'live-editor') {
          const report = await engines().capabilities(request.projectId);
          const connectionId = report.liveBridge?.connectionId;
          if (connectionId)
            required.push({ resource: `engine-session:${connectionId}`, mode: 'exclusive' });
        }
        if (request.toolId.startsWith('dcc/')) {
          const dccTool = stringValue(input.tool) as DccTool | undefined;
          if (dccTool) {
            const report = await dcc().capabilities(request.projectId, dccTool);
            const connectionId = report.layers['live-bridge'].connectionId;
            if (connectionId)
              required.push({ resource: `dcc-session:${dccTool}`, mode: 'exclusive' });
          }
        }
        if (request.toolId === 'asset/import') {
          const configured = settingsService.resolve('assets.importDirectory', {
            projectId: request.projectId,
          }).value;
          const destination = normalizeResourcePath(
            stringValue(input.destinationDir) ?? String(configured ?? 'game/assets/generated'),
          );
          if (destination) required.push({ resource: `asset:${destination}`, mode: 'exclusive' });
        }
        return required;
      },
      events: {
        approvalRequested: (projectId, approval) =>
          server.broadcast('broker/approvalRequested', { projectId, approval }),
        approvalResolved: (projectId, approval) =>
          server.broadcast('broker/approvalResolved', { projectId, approval }),
        toolCalled: (projectId, call) => {
          server.broadcast('tool/called', { projectId, call });
          changeGraphRef.service?.scheduleRebuild(projectId);
        },
      },
      isToolAvailable: (tool, projectId) => {
        if (!tool.source.startsWith('plugin:')) return true;
        try {
          return pluginRegistry.isEnabledForProject(tool.source.slice('plugin:'.length), projectId);
        } catch {
          return false;
        }
      },
      approvalTimeoutOverrideMs: options.approvalTimeoutOverrideMs,
    });
    const workerSupervisor = new WorkerSupervisor({
      tasks: taskService,
      settings: settingsService,
      handlers: handlerRegistry,
      tools: toolBroker,
      worktrees,
      validateResult: (task, result) =>
        integrationRef.service &&
        (task.kind === 'agent.run' || task.isolation === 'worktree' || task.contract !== undefined)
          ? integrationRef.service.validateResult(task, result)
          : Promise.resolve({ result }),
      onWorkerStarted: options.onWorkerStarted,
      onWorkerFinalMessage: options.onWorkerFinalMessage,
      onWorkerExited: options.onWorkerExited,
      onLeaseRenewed: (projectId, taskId, workerId) =>
        lockManager.renewTask(projectId, taskId, workerId),
      onTaskLeaseExpired: (projectId, taskId) => lockManager.releaseTask(projectId, taskId),
      onScheduleSnapshot: options.onWorkerScheduleSnapshot,
    });
    taskService.setSupervisor(workerSupervisor);
    const startedAt = new Date().toISOString();
    const boardRef: { service?: BoardService } = {};
    const boardMaintenanceRef: { scheduler?: BoardMaintenanceScheduler } = {};
    const board = (): BoardService => {
      if (!boardRef.service) throw new Error('Discussion board service is not initialized');
      return boardRef.service;
    };
    const boardMaintenance = (): BoardMaintenanceScheduler => {
      if (!boardMaintenanceRef.scheduler) throw new Error('Board maintenance is not initialized');
      return boardMaintenanceRef.scheduler;
    };
    const pluginRef: { service?: PluginService } = {};
    const plugins = (): PluginService => {
      if (!pluginRef.service) throw new Error('Plugin service is not initialized');
      return pluginRef.service;
    };
    const engineRef: { service?: EngineConnectorService } = {};
    const engines = (): EngineConnectorService => {
      if (!engineRef.service) throw new Error('Engine connector service is not initialized');
      return engineRef.service;
    };
    const dccRef: { service?: DccConnectorService } = {};
    const dcc = (): DccConnectorService => {
      if (!dccRef.service) throw new Error('DCC connector service is not initialized');
      return dccRef.service;
    };
    const assetRef: { service?: AssetService } = {};
    const assets = (): AssetService => {
      if (!assetRef.service) throw new Error('Asset service is not initialized');
      return assetRef.service;
    };
    const backupRef: { service?: BackupService } = {};
    const backups = (): BackupService => {
      if (!backupRef.service) throw new Error('Backup service is not initialized');
      return backupRef.service;
    };
    const knowledgeRef: { service?: KnowledgeService } = {};
    const knowledge = (): KnowledgeService => {
      if (!knowledgeRef.service) throw new Error('Knowledge service is not initialized');
      return knowledgeRef.service;
    };
    const changeGraphRef: { service?: ChangeGraph } = {};
    const changeGraph = (): ChangeGraph => {
      if (!changeGraphRef.service) throw new Error('Change graph is not initialized');
      return changeGraphRef.service;
    };
    const changeServiceRef: { service?: ChangeService } = {};
    const changes = (): ChangeService => {
      if (!changeServiceRef.service) throw new Error('Change service is not initialized');
      return changeServiceRef.service;
    };
    const feedbackRef: { service?: FeedbackService } = {};
    const feedbackService = (): FeedbackService => {
      if (!feedbackRef.service) throw new Error('Feedback service is not initialized');
      return feedbackRef.service;
    };
    const handlers: RpcHandlers = {
      'service/info': () => ({
        serviceVersion: platformVersion,
        protocolVersion: PROTOCOL_VERSION,
        pid: process.pid,
        profileDir: paths.profileDir,
        startedAt,
        projectCount: profile.list().length,
      }),
      'update/state': () => updateService.getState(),
      'update/check': async () => {
        const state = await updateService.check();
        server.broadcast('update/stateChanged', { state });
        return state;
      },
      'update/download': async ({ version }) => {
        const state = await updateService.download(version);
        server.broadcast('update/stateChanged', { state });
        return state;
      },
      'update/install': () => updateService.install(),
      'update/rollback': () => updateService.rollback(),
      'update/dismiss': ({ version }) => {
        const state = updateService.dismiss(version);
        server.broadcast('update/stateChanged', { state });
        return state;
      },
      'project/create': async (input: ProjectCreateInput) => {
        const project = await workspace.create(input);
        server.broadcast('project/changed', { kind: 'created', project });
        knowledge().onProjectCreated(project.projectId);
        return project;
      },
      'project/clone': async (input: ProjectCloneInput) => {
        const project = await workspace.clone(input);
        server.broadcast('project/changed', { kind: 'cloned', project });
        knowledge().onProjectCreated(project.projectId);
        return project;
      },
      'project/list': () => ({ projects: workspace.list() }),
      'project/open': async ({ path: projectPath }) => {
        const project = workspace.open(projectPath);
        server.broadcast('project/changed', { kind: 'opened', project });
        knowledge().onProjectOpened(project.projectId);
        await mcpConnections.onProjectOpened(project.projectId);
        await plugins().autoStartProject(project.projectId);
        return project;
      },
      'project/get': ({ projectId }) => workspace.get(projectId),
      'project/trust': ({ projectId, trusted }) => workspace.trust(projectId, trusted),
      'engine/installations': async ({ family }) => ({
        installations: await engines().installations(family),
      }),
      'engine/addInstallation': (input) => engines().addInstallation(input),
      'engine/removeInstallation': ({ installationId }) => {
        engines().removeInstallation(installationId);
        return { removed: true };
      },
      'engine/capabilities': ({ projectId, refresh }) => engines().capabilities(projectId, refresh),
      'engine/run': ({ projectId, operation, params, taskId }) =>
        engines().run(projectId, operation, params ?? {}, taskId),
      'engine/runs': ({ projectId, limit }) => ({ runs: engines().runs(projectId, limit) }),
      'engine/run/get': ({ projectId, runId }) => engines().getRun(projectId, runId),
      'engine/setLiveBridge': ({ projectId, connectionId }) =>
        engines()
          .setLiveBridge(projectId, connectionId)
          .then((boundConnectionId) => ({ connectionId: boundConnectionId })),
      'dcc/installations': ({ tool }) =>
        dcc()
          .installations(tool)
          .then((installations) => ({ installations })),
      'dcc/addInstallation': (input) => dcc().addInstallation(input),
      'dcc/removeInstallation': async ({ installationId }) => {
        await dcc().removeInstallation(installationId);
        return { removed: true };
      },
      'dcc/capabilities': ({ projectId, tool, refresh }) =>
        dcc().capabilities(projectId, tool, refresh),
      'dcc/run': ({ projectId, tool, operation, params, taskId }) =>
        dcc().run(projectId, tool, operation, params ?? {}, taskId),
      'dcc/runs': ({ projectId, tool, limit }) => ({ runs: dcc().runs(projectId, tool, limit) }),
      'dcc/run/get': ({ projectId, runId }) => dcc().getRun(projectId, runId),
      'dcc/setLiveBridge': ({ projectId, tool, connectionId }) =>
        dcc()
          .setLiveBridge(projectId, tool, connectionId)
          .then((boundConnectionId) => ({ connectionId: boundConnectionId })),
      'asset/providers': () => ({ providers: assets().providersList() }),
      'asset/accounts': () => ({ accounts: assets().accounts() }),
      'asset/addAccount': (input) => assets().addAccount(input),
      'asset/updateAccount': ({ accountId, patch }) => assets().updateAccount(accountId, patch),
      'asset/removeAccount': ({ accountId }) => {
        assets().removeAccount(accountId);
        return { removed: true };
      },
      'asset/testAccount': ({ accountId }) => assets().testAccount(accountId),
      'asset/generate': ({ projectId, accountId, request, taskId }) =>
        assets().generate(projectId, accountId, request, taskId),
      'asset/jobs': ({ projectId, limit, status }) => ({
        jobs: assets().jobs(projectId, limit, status),
      }),
      'asset/job': ({ projectId, jobId }) => assets().job(projectId, jobId),
      'asset/cancel': ({ projectId, jobId }) => assets().cancel(projectId, jobId),
      'asset/review': ({ projectId, jobId, decision, note }) =>
        assets().review(projectId, jobId, decision, note),
      'asset/import': ({ projectId, jobId, artifactId, destinationDir }) =>
        assets().importAsset(projectId, jobId, artifactId, destinationDir),
      'asset/files': ({ projectId, directory }) => ({
        files: assets().files(projectId, directory),
      }),
      'asset/preview': ({ projectId, path: sourcePath, refresh }) =>
        assets().preview(projectId, sourcePath, refresh),
      'asset/openInAuthoringTool': ({ projectId, path: sourcePath }) =>
        assets().openInAuthoringTool(projectId, sourcePath),
      'backup/identities': () => ({ identities: backups().identities() }),
      'backup/identity/create': (input) => backups().createIdentity(input),
      'backup/identity/remove': ({ identityId }) => {
        backups().removeIdentity(identityId);
        return { removed: true };
      },
      'backup/destinations': () => ({ destinations: backups().destinationsList() }),
      'backup/addDestination': (input) => backups().addDestination(input),
      'backup/updateDestination': (input) => backups().updateDestination(input),
      'backup/removeDestination': ({ destinationId }) => {
        backups().removeDestination(destinationId);
        return { removed: true };
      },
      'backup/testDestination': ({ destinationId }) => backups().testDestination(destinationId),
      'backup/plans': ({ projectId }) => ({ plans: backups().plans(projectId) }),
      'backup/savePlan': (input) => backups().savePlan(input),
      'backup/removePlan': ({ planId }) => {
        backups().removePlan(planId);
        return { removed: true };
      },
      'backup/run': (input) => backups().run(input),
      'backup/runs': ({ projectId, limit }) => ({ runs: backups().runs(projectId, limit) }),
      'backup/run/get': ({ runId }) => backups().runById(runId),
      'backup/cancel': ({ runId }) => backups().cancel(runId),
      'backup/archives': ({ destinationId }) =>
        backups()
          .archives(destinationId)
          .then((archives) => ({ archives })),
      'backup/inspect': (input) => backups().inspect(input),
      'backup/verify': (input) => backups().verify(input),
      'backup/restore': async (input) => {
        const result = await backups().restore(input);
        if (result.registeredProjectId) {
          const project = workspace.get(result.registeredProjectId);
          server.broadcast('project/changed', { kind: 'opened', project });
          knowledge().onProjectOpened(project.projectId);
          await mcpConnections.onProjectOpened(project.projectId);
          await plugins().autoStartProject(project.projectId);
        }
        return result;
      },
      'knowledge/records': ({ projectId, type, status, module, includeInactive, search }) =>
        knowledge().records(projectId, { type, status, module, includeInactive, search }),
      'knowledge/record': ({ projectId, recordId }) => knowledge().record(projectId, recordId),
      'knowledge/write': ({ projectId, record, body, path: recordPath }) =>
        knowledge().write(projectId, record, body, recordPath),
      'knowledge/setStatus': ({ projectId, recordId, status, justification }) =>
        knowledge().setStatus(projectId, recordId, status, justification),
      'knowledge/search': (request) => knowledge().search(request),
      'knowledge/index/status': ({ projectId }) => knowledge().indexStatus(projectId),
      'knowledge/index/rebuild': ({ projectId, full }) => ({
        taskId: knowledge().rebuild(projectId, full ?? true),
      }),
      'knowledge/index/reconcile': ({ projectId }) => ({
        taskId: knowledge().reconcile(projectId),
      }),
      'knowledge/embeddingProfile/set': ({ projectId, modelId, providerAccountId }) =>
        knowledge().setEmbeddingProfile(projectId, modelId, providerAccountId),
      'knowledge/graph': ({ projectId, recordId, depth }) =>
        knowledge().graph(projectId, recordId, depth ?? 1),
      'knowledge/vectorStore/test': ({ projectId }) => knowledge().testVectorStore(projectId),
      'settings/describe': () => settingsService.describe(),
      'settings/get': (params, context) =>
        settingsService.resolve(params.key, {
          projectId: params.projectId,
          sessionId: sessionIdForRequest(params.sessionId, context.sessionId),
        }),
      'settings/getAll': (params, context) => ({
        settings: settingsService.getAll({
          projectId: params.projectId,
          sessionId: sessionIdForRequest(params.sessionId, context.sessionId),
        }),
      }),
      'settings/export': (params, context) =>
        settingsService.export({
          projectId: params.projectId,
          sessionId: sessionIdForRequest(params.sessionId, context.sessionId),
        }),
      'settings/import': (params) => settingsService.import(params),
      'settings/set': (params, context) =>
        settingsService.set(params.key, params.scope, params.value, {
          projectId: params.projectId,
          sessionId: sessionIdForRequest(params.sessionId, context.sessionId),
        }),
      'change/request': (input) => {
        const request = changes().request(input);
        server.broadcast('change/requestChanged', { projectId: request.projectId, request });
        return request;
      },
      'change/requests': ({ projectId, limit }) => ({
        requests: changes().requests(projectId, limit ?? 200),
      }),
      'change/impact': ({ projectId, seeds, maxDepth, threshold }) =>
        changeGraph().impact(projectId, seeds, { maxDepth, threshold }),
      'change/graph': ({ projectId, kinds, limit }) =>
        changeGraph().graph(projectId, { kinds, limit }),
      'change/rebuildGraph': ({ projectId }) => changeGraph().rebuildGraph(projectId),
      'change/locks': ({ projectId }) => ({ locks: lockManager.list(projectId) }),
      'change/releaseLock': ({ projectId, lockId }) => {
        const lock = lockManager.release(projectId, lockId, undefined, true);
        taskService.runtime(projectId).store.appendEvent(
          null,
          'change.lockReleased',
          {
            lockId,
            resource: lock.resource,
            taskId: lock.taskId,
          },
          'user',
        );
        server.broadcast('change/lockChanged', { projectId, lock });
        return { released: true };
      },
      'change/integrations': ({ projectId, status }) => ({
        integrations: changes().integrations(projectId, status),
      }),
      'change/integrate': async ({ projectId, taskId }, context) => {
        const call = await toolBroker.call(
          { projectId, toolId: 'change/integrate', input: { taskId } },
          { sessionId: context.sessionId },
        );
        if (call.status !== 'completed')
          throw new RpcError('Integration did not complete.', RpcErrorCode.IntegrationNotReady);
        return call.output as IntegrationRecord;
      },
      'change/abortIntegration': async ({ projectId, integrationId }, context) => {
        const call = await toolBroker.call(
          { projectId, toolId: 'change/abortIntegration', input: { integrationId } },
          { sessionId: context.sessionId },
        );
        if (call.status !== 'completed')
          throw new RpcError(
            'Integration abort did not complete.',
            RpcErrorCode.IntegrationNotReady,
          );
        return call.output as IntegrationRecord;
      },
      'change/feedback': (input) => feedbackService().apply(input),
      'task/create': (input: TaskCreateInput) => taskService.create(input),
      'task/get': ({ projectId, taskId }) => taskService.get(projectId, taskId),
      'task/list': ({ projectId, states, parentTaskId, rootTaskId, limit }) => ({
        tasks: taskService.list(projectId, {
          ...(states === undefined ? {} : { states }),
          ...(parentTaskId === undefined ? {} : { parentTaskId }),
          ...(rootTaskId === undefined ? {} : { rootTaskId }),
          limit: limit ?? 200,
        }),
      }),
      'task/tree': ({ projectId, rootTaskId }) => ({
        tasks: taskService.tree(projectId, rootTaskId),
      }),
      'task/cancel': ({ projectId, taskId, reason }) =>
        taskService.cancel(projectId, taskId, reason),
      'task/events': ({ projectId, taskId, afterSeq, limit }) => ({
        events: taskService.eventsForProject(projectId, {
          taskId,
          afterSeq,
          limit: limit ?? 500,
        }),
      }),
      'task/answer': ({ projectId, taskId, questionId, answer }) =>
        taskService.answer(projectId, taskId, questionId, answer),
      'task/questions': ({ pendingOnly }) => ({
        questions: taskService.questions(pendingOnly ?? false),
      }),
      'tool/list': ({ projectId }) => ({ tools: toolBroker.listTools(projectId) }),
      'tool/call': (request, context) => toolBroker.call(request, { sessionId: context.sessionId }),
      'audit/read': ({ projectId, afterSeq, limit }) => {
        const pageLimit = limit ?? 500;
        const events = taskService.eventsForProject(projectId, {
          afterSeq: afterSeq ?? 0,
          limit: pageLimit,
        });
        const modelUsage = modelRouter.modelUsage(projectId, pageLimit).map((usage) => ({
          ...usage,
          requestId: usage.requestId === null ? null : redact(usage.requestId),
          ...(usage.modelName === undefined ? {} : { modelName: redact(usage.modelName) }),
          ...(usage.providerModelId === undefined
            ? {}
            : { providerModelId: redact(usage.providerModelId) }),
        }));
        return {
          ...redact({
            schemaVersion: 1 as const,
            projectId,
            exportedAt: new Date().toISOString(),
            limit: pageLimit,
            nextAfterSeq: events.at(-1)?.seq ?? afterSeq ?? 0,
            calls: toolBroker.listCalls(projectId, { limit: pageLimit }),
            events,
          }),
          modelUsage,
        };
      },
      'tool/calls': ({ projectId, taskId, toolId, limit }) => ({
        calls: toolBroker.listCalls(projectId, { taskId, toolId, limit: limit ?? 200 }),
      }),
      'broker/approvals': ({ projectId, pendingOnly }) => ({
        approvals: toolBroker.listApprovals(projectId, pendingOnly ?? false),
      }),
      'broker/approve': ({ projectId, approvalId, approve, reason }) =>
        toolBroker.approve(projectId, approvalId, approve, reason),
      'provider/accounts': () => ({ accounts: modelRegistry.listAccounts() }),
      'provider/addAccount': (input) => modelRegistry.addAccount(input),
      'provider/updateAccount': ({ accountId, patch }) =>
        modelRegistry.updateAccount(accountId, patch),
      'provider/removeAccount': ({ accountId }) => {
        modelRegistry.removeAccount(accountId);
        return { removed: true };
      },
      'provider/testAccount': ({ accountId }) => modelRegistry.testAccount(accountId),
      'model/list': ({ accountId, enabledOnly }) => ({
        models: modelRegistry.listModels({ accountId, enabledOnly: enabledOnly ?? false }),
      }),
      'model/discover': ({ accountId, ...options }) => modelRegistry.discover(accountId, options),
      'model/update': ({ modelId, patch }) => modelRegistry.updateModel(modelId, patch),
      'pool/list': ({ projectId }) => ({ pools: modelRegistry.listPools(projectId) }),
      'pool/create': (input) => {
        if (input.scope === 'project' && input.projectId && !profile.getById(input.projectId)) {
          throw new RpcError(`Project not found: ${input.projectId}`, RpcErrorCode.ProjectNotFound);
        }
        return modelRegistry.createPool(input);
      },
      'pool/update': ({ poolId, patch }) => {
        const scope = patch.scope;
        const projectId = patch.projectId;
        if ((scope === 'project' || projectId) && projectId && !profile.getById(projectId)) {
          throw new RpcError(`Project not found: ${projectId}`, RpcErrorCode.ProjectNotFound);
        }
        return modelRegistry.updatePool(poolId, patch);
      },
      'pool/delete': ({ poolId }) => {
        modelRegistry.deletePool(poolId);
        return { removed: true };
      },
      'router/route': (request, context) => modelRouter.route(request, context.sessionId),
      'router/reportOutcome': (outcome) => {
        modelRouter.reportOutcome(outcome);
        return { recorded: true };
      },
      'router/decisions': ({ projectId, limit }) => ({
        decisions: modelRouter.decisions(projectId, limit ?? 200),
      }),
      'router/stats': ({ taskType }) => ({ models: modelRouter.stats(taskType) }),
      'model/complete': (request, context) =>
        completionService.complete(request, {
          sessionId: context.sessionId,
          notify: context.notify,
        }),
      'chat/list': ({ projectId }) => ({ conversations: chatService.list(projectId) }),
      'chat/create': ({ projectId, title }) => chatService.create(projectId, title),
      'chat/messages': ({ projectId, conversationId }) => ({
        messages: chatService.messages(projectId, conversationId),
      }),
      'chat/append': (input) => chatService.append(input),
      'chat/delete': ({ projectId, conversationId }) => ({
        deleted: chatService.delete(projectId, conversationId),
      }),
      'model/embed': ({ modelId, inputs }) => completionService.embed(modelId, inputs),
      'skills/install': async ({ source, name, force }) => ({
        installed: await skillService.install(source, name, force ?? false),
      }),
      'skills/uninstall': ({ name }) => {
        skillService.uninstall(name);
        return { removed: true };
      },
      'skills/list': ({ projectId }) => ({
        skills: projectId ? skillService.list(projectId) : skillService.listPlatform(),
      }),
      'skills/enable': ({ projectId, name, enabled, roles, workTypes, pin }) =>
        skillService.enable(projectId, { name, enabled, roles, workTypes, pin }),
      'skills/catalog': (request, context) => skillService.catalog(request, context.sessionId),
      'skills/activate': (request, context) =>
        skillService.activate(
          request.projectId,
          request.name,
          request.taskId,
          request.agentId,
          context.sessionId,
        ),
      'skills/read-resource': (request, context) =>
        skillService.readResource(request, context.sessionId),
      'skills/search': (request, context) => ({
        entries: skillService.search(
          request.projectId,
          request.query,
          request.agentRole,
          request.workType,
          context.sessionId,
        ),
      }),
      'skills/validate': ({ path: skillPath }) => skillService.validate(skillPath),
      'skills/activations': ({ projectId, taskId }) => ({
        activations: skillService.activations(projectId, taskId),
      }),
      'roles/list': ({ projectId }) => ({ roles: skillService.listRoles(projectId) }),
      'roles/get': ({ name, projectId }) => skillService.getRole(name, projectId),
      'mcp/list': ({ projectId }) => ({ connections: mcpConnections.list(projectId) }),
      'mcp/add': ({ config, credentials: mcpCredentials }) =>
        mcpConnections.add(config, mcpCredentials),
      'mcp/update': ({ connectionId, patch, credentials: mcpCredentials }) =>
        mcpConnections.update(connectionId, patch, mcpCredentials),
      'mcp/remove': async ({ connectionId }) => {
        await mcpConnections.remove(connectionId);
        return { removed: true };
      },
      'mcp/connect': ({ connectionId }) => mcpConnections.connect(connectionId),
      'mcp/disconnect': ({ connectionId }) => mcpConnections.disconnect(connectionId),
      'mcp/tools': ({ connectionId }) => mcpConnections.tools(connectionId),
      'mcp/refreshTools': ({ connectionId }) => mcpConnections.tools(connectionId, true),
      'mcp/answer': ({ connectionId, requestId, responses }) => {
        mcpConnections.answer(connectionId, requestId, responses);
        return { answered: true };
      },
      'mcp/classifyTool': async ({ connectionId, toolName, sideEffects, executionMode }) => ({
        tool: await mcpConnections.classifyTool(connectionId, toolName, {
          sideEffects,
          executionMode,
        }),
      }),
      'mcp/log': ({ connectionId, limit }) => ({
        entries: mcpConnections.logEntries(connectionId, limit),
      }),
      'board/threads': ({ projectId, status, kind, tags, search }) => ({
        threads: board().threads(projectId, { status, kind, tags, search }),
      }),
      'board/thread': ({ projectId, threadId, includeMessages, afterSeq, limit }) =>
        board().thread(projectId, threadId, { includeMessages, afterSeq, limit }),
      'board/createThread': ({ projectId, title, kind, tags, links, body, type }) =>
        board().createThread({ projectId, title, kind, tags, links, body, type }, { kind: 'user' }),
      'board/post': ({ projectId, threadId, title, kind, type, body, links, replyTo }) =>
        board().post(
          { projectId, threadId, title, kind, type, body, links, replyTo },
          { kind: 'user' },
        ),
      'board/edit': ({ projectId, messageId, body }) => board().edit(projectId, messageId, body),
      'board/supersede': ({ projectId, messageId, byMessageId }) =>
        board().supersede(projectId, messageId, byMessageId),
      'board/setThreadStatus': ({ projectId, threadId, status }) =>
        board().setThreadStatus(projectId, threadId, status),
      'board/bind': (input) => board().bind(input),
      'board/decisions': ({ projectId, syncStatus }) => ({
        decisions: board().decisions(projectId, syncStatus),
      }),
      'board/decision': ({ projectId, decisionId }) => ({
        decision: board().decision(projectId, decisionId),
        proposals: board().proposals(projectId, decisionId),
      }),
      'board/retrySync': ({ projectId, decisionId }) => {
        const decision = board().decision(projectId, decisionId);
        boardMaintenance().retrySync(projectId, decision);
        return decision;
      },
      'board/subscribe': ({ projectId, subscriber, filter }) =>
        board().subscribe(projectId, subscriber, filter),
      'board/unsubscribe': ({ projectId, subscriptionId }) => {
        board().unsubscribe(projectId, subscriptionId);
        return { removed: true };
      },
      'board/subscriptions': ({ projectId, subscriber }) => ({
        subscriptions: board().subscriptions(projectId, subscriber),
      }),
      'board/summary': ({ projectId, threadId }) => board().summary(projectId, threadId),
      'board/search': ({ projectId, query, limit }) => board().search(projectId, query, limit),
      'board/maintenance/run': ({ projectId, mode }) => ({
        taskId: boardMaintenance().scheduleManual(projectId, mode),
      }),
      'board/maintenance/status': ({ projectId }) => board().maintenanceStatus(projectId),
      'board/delete': ({ projectId, threadId }) => {
        board().deleteThread(projectId, threadId);
        return { deleted: true };
      },
      'plugin/list': ({ projectId }) => ({ plugins: plugins().list(projectId) }),
      'plugin/inspect': ({ source }) => plugins().inspect(source),
      'plugin/install': ({ source, acceptCapabilities }) =>
        plugins().install(source, acceptCapabilities),
      'plugin/uninstall': ({ pluginId }) => plugins().uninstall(pluginId),
      'plugin/enable': ({ pluginId, projectId }) => plugins().enable(pluginId, projectId),
      'plugin/disable': ({ pluginId, projectId }) => plugins().disable(pluginId, projectId),
      'plugin/start': ({ pluginId, projectId }) => plugins().start(pluginId, projectId),
      'plugin/stop': ({ pluginId, projectId }) => plugins().stop(pluginId, projectId),
      'plugin/status': ({ pluginId, projectId }) => plugins().status(pluginId, projectId),
      'plugin/isolationReport': () => plugins().isolationReport(),
      'plugin/log': ({ pluginId, projectId, limit }) => plugins().logs(pluginId, projectId, limit),
      'plugin/setSecret': ({ pluginId, name, value }) => plugins().setSecret(pluginId, name, value),
      'plugin/panel': ({ pluginId, panelId }) => plugins().panel(pluginId, panelId),
      'plugin/modules': () => plugins().modules(),
      'service/stop': ({ checkpoint }) => {
        setTimeout(() => {
          void (async () => {
            await platformService.stop(checkpoint);
            await options.onStopRequested?.(checkpoint);
          })().catch((error: unknown) => {
            log('error', 'Service stop request failed', {
              error: error instanceof Error ? error.message : String(error),
            });
          });
        }, 50);
        return { ok: true };
      },
    };
    const server = new IpcServer({
      paths,
      handlers,
      token,
      serviceVersion: platformVersion,
      onClientEvent: options.onClientEvent,
      onSessionOpened: (sessionId) => settingsService.openSession(sessionId),
      onSessionClosed: (sessionId) => settingsService.closeSession(sessionId),
    });
    lockManager.setChangeListener((projectId, lock) =>
      server.broadcast('change/lockChanged', { projectId, lock }),
    );
    boardRef.service = new BoardService({
      projectDatabases,
      settings: settingsService,
      events: {
        threadChanged: (projectId, thread) => {
          server.broadcast('board/threadChanged', { projectId, thread });
          knowledgeRef.service?.onBoardChanged(projectId);
        },
        messagePosted: (projectId, message) => {
          server.broadcast('board/messagePosted', { projectId, message });
          knowledgeRef.service?.onBoardChanged(projectId);
        },
        decisionChanged: (projectId, decision) =>
          server.broadcast('board/decisionChanged', { projectId, decision }),
      },
      onBindingDecision: (decision) => {
        boardMaintenanceRef.scheduler?.scheduleSync(decision);
      },
    });
    boardMaintenanceRef.scheduler = new BoardMaintenanceScheduler({
      board: board(),
      tasks: taskService,
      settings: settingsService,
    });
    const canonSync = new CanonSyncWorkflow({
      board: board(),
      projects: profile,
      tasks: taskService,
      tools: toolBroker,
      onFilesWritten: (projectId, files) =>
        knowledgeRef.service?.onCanonFilesWritten(projectId, files).catch((error: unknown) => {
          log('warn', 'Knowledge index update after canon sync failed', {
            projectId,
            error: error instanceof Error ? error.message : String(error),
          });
        }),
    });
    const boardMaintenanceService = new BoardMaintenanceService({
      board: board(),
      tasks: taskService,
      projects: profile,
      settings: settingsService,
      completion: completionService,
      scheduler: boardMaintenance(),
      canonSync,
    });
    registerBoardTools(toolRegistry, board());
    registerBoardMaintenanceTool(toolRegistry, boardMaintenanceService);
    const mcpConnections = new McpConnectionManager({
      database,
      profile,
      credentials,
      settings: settingsService,
      tasks: taskService,
      completion: completionService,
      tools: toolRegistry,
      events: {
        stateChanged: (state) => {
          server.broadcast('mcp/stateChanged', { state });
          void engineRef.service?.onMcpStateChanged(state.connectionId).catch(() => undefined);
          void dccRef.service?.onMcpStateChanged(state.connectionId).catch(() => undefined);
        },
        inputRequired: (params) => server.broadcast('mcp/inputRequired', params),
      },
      clientInfo: { name: 'gamecrafter-platform-service', version: platformVersion },
    });
    const pluginHost = new PluginHost({
      database,
      profileDir: paths.profileDir,
      installer: pluginInstaller,
      plugins: pluginRegistry,
      tools: toolRegistry,
      broker: toolBroker,
      settings: settingsService,
      projects: profile,
      credentials,
      completion: completionService,
      board,
      launchers: options.pluginLaunchers,
      onWorkerChanged: (state) => server.broadcast('plugin/workerChanged', { state }),
    });
    pluginRef.service = new PluginService({
      installer: pluginInstaller,
      registry: pluginRegistry,
      host: pluginHost,
      profile,
      settingsRegistry,
      settings: settingsService,
      credentials,
      onChanged: (pluginId) => server.broadcast('plugin/changed', { pluginId }),
    });
    engineRef.service = new EngineConnectorService({
      database,
      projects: profile,
      projectDatabases,
      settings: settingsService,
      toolRegistry,
      toolBroker,
      mcpConnections,
      board: board(),
      events: {
        capabilitiesChanged: (projectId, report) =>
          server.broadcast('engine/capabilitiesChanged', { projectId, report }),
        runChanged: (projectId, run) => server.broadcast('engine/runChanged', { projectId, run }),
      },
    });
    dccRef.service = new DccConnectorService({
      database,
      projects: profile,
      projectDatabases,
      settings: settingsService,
      toolRegistry,
      toolBroker,
      mcpConnections,
      events: {
        capabilitiesChanged: (projectId, tool, report) =>
          server.broadcast('dcc/capabilitiesChanged', { projectId, tool, report }),
        runChanged: (projectId, tool, run) =>
          server.broadcast('dcc/runChanged', { projectId, tool, run }),
      },
    });
    assetRef.service = new AssetService({
      database,
      projects: profile,
      projectDatabases,
      credentials,
      settings: settingsService,
      toolRegistry,
      events: {
        jobChanged: (projectId, job) => server.broadcast('asset/jobChanged', { projectId, job }),
      },
    });
    backupRef.service = new BackupService({
      database,
      projects: profile,
      projectDatabases,
      workspace,
      credentials,
      settings: settingsService,
      profileDir: paths.profileDir,
      platformVersion,
      pluginVersions: () =>
        Object.fromEntries(
          plugins()
            .list()
            .map(({ installed }) => [installed.pluginId, installed.version]),
        ),
      events: { runChanged: (run) => server.broadcast('backup/runChanged', { run }) },
      now: options.backupNow,
    });
    knowledgeRef.service = new KnowledgeService({
      projects: profile,
      projectDatabases,
      settings: settingsService,
      tasks: taskService,
      completion: completionService,
      models: modelRegistry,
      credentials,
      plugins: pluginRegistry,
      board: board(),
      toolBroker,
      toolRegistry,
      events: {
        indexChanged: (projectId, status) => {
          server.broadcast('knowledge/indexChanged', { projectId, status });
          changeGraphRef.service?.scheduleRebuild(projectId);
        },
        recordChanged: (projectId, record) =>
          server.broadcast('knowledge/recordChanged', { projectId, record }),
      },
      vectorStoreFactory: options.knowledgeVectorStoreFactory,
      vectorStoreAdapters: options.knowledgeVectorStoreAdapters,
      qdrantBinaryPath: options.qdrantBinaryPath,
    });
    changeGraphRef.service = new ChangeGraph({
      storeForProject: (projectId) => new ChangeGraphStore(projectDatabases.get(projectId)),
      sources: {
        projectPath: (projectId) => {
          const project = profile.getById(projectId);
          if (!project)
            throw new RpcError(`Project not found: ${projectId}`, RpcErrorCode.ProjectNotFound);
          return project.path;
        },
        canonRecords: (projectId) =>
          knowledge().records(projectId, { includeInactive: true }).records,
        tasks: (projectId) => taskService.list(projectId, { limit: 5_000 }),
        toolCalls: (projectId) => toolBroker.listCalls(projectId, { limit: 5_000 }),
      },
      onRebuildError: (projectId, error) =>
        log('warn', 'Change graph rebuild failed', {
          projectId,
          error: error instanceof Error ? error.message : String(error),
        }),
    });
    changeServiceRef.service = new ChangeService(
      projectDatabases,
      profile,
      taskService,
      changeGraph(),
      settingsService,
      board(),
    );
    integrationRef.service = new IntegrationService({
      projects: profile,
      projectDatabases,
      tasks: taskService,
      roles: roleRegistry,
      changes: changes(),
      locks: lockManager,
      worktrees,
      tools: toolBroker,
      settings: settingsService,
      onChanged: (integration) =>
        server.broadcast('change/integrationChanged', {
          projectId: integration.projectId,
          integration,
        }),
    });
    feedbackRef.service = new FeedbackService({
      tasks: taskService,
      changes: changes(),
      graph: changeGraph(),
      integrations: integrationRef.service,
      board: board(),
      settings: settingsService,
    });
    registerChangeTools(toolRegistry, changeGraph(), changes(), integrationRef.service);
    settingsService.onChanged((event) => {
      if (event.key.startsWith('engine.')) void engines().onSettingChanged(event);
      if (event.key.startsWith('dcc.')) void dcc().onSettingChanged(event);
      if (event.key.startsWith('assets.')) assets().onSettingChanged(event);
      if (event.key.startsWith('backup.')) backups().onSettingChanged(event.key);
      if (event.key.startsWith('knowledge.')) knowledge().onSettingChanged(event);
      if (event.key === 'updates.releasesUrl' || event.key === 'updates.signingPublicKey') {
        updateService = createUpdateService();
      }
      if (event.key === 'updates.checkOnStart' || event.key === 'updates.checkIntervalHours') {
        scheduleUpdateChecks();
      }
      server.broadcast('settings/changed', event);
      void plugins()
        .settingsChanged(event)
        .catch((error: unknown) => {
          log('warn', 'Plugin settings update failed', {
            error: error instanceof Error ? error.message : String(error),
          });
        });
    });
    const platformService = new PlatformService(
      server,
      database,
      projectDatabases,
      workerSupervisor,
      toolBroker,
      mcpConnections,
      boardMaintenance(),
      pluginHost,
      knowledge(),
      assets(),
      backups(),
      changeGraph(),
      integrationRef.service!,
      paths,
      startedAt,
    );
    const checkForUpdates = async (): Promise<void> => {
      let state = await updateService.check();
      if (settingsService.resolve('updates.autoDownload', {}).value === true && state.available) {
        state = await updateService.download(state.available.version);
      }
      server.broadcast('update/stateChanged', { state });
    };
    scheduleUpdateChecks = () => {
      if (settingsService.resolve('updates.checkOnStart', {}).value !== true) {
        platformService.setUpdateTimer(undefined);
        return;
      }
      const hours = Number(settingsService.resolve('updates.checkIntervalHours', {}).value);
      const timer = setInterval(
        () => {
          void checkForUpdates().catch((error: unknown) =>
            log('warn', 'Scheduled update check failed', {
              error: error instanceof Error ? error.message : String(error),
            }),
          );
        },
        hours * 60 * 60 * 1000,
      );
      timer.unref();
      platformService.setUpdateTimer(timer);
    };
    scheduleUpdateChecks();

    try {
      await toolBroker.recoverOnStart();
      workerSupervisor.recoverOnStart();
      await server.listen();
    } catch (error) {
      await server.close();
      projectDatabases.close();
      database.close();
      throw error;
    }
    await mcpConnections.start();
    workerSupervisor.start();
    boardMaintenance().start();
    await plugins().autoStartRegisteredProjects();
    await assets().start();
    await backups().start();
    await knowledge().start();
    if (settingsService.resolve('updates.checkOnStart', {}).value === true) {
      void checkForUpdates().catch((error: unknown) =>
        log('warn', 'Startup update check failed', {
          error: error instanceof Error ? error.message : String(error),
        }),
      );
    }
    return platformService;
  }

  async stop(checkpoint = true): Promise<void> {
    if (this.stopped) return;
    this.stopped = true;
    if (this.updateTimer) clearInterval(this.updateTimer);
    await this.assetService.stop();
    await this.backupService.stop();
    await this.knowledgeService.stop();
    this.boardMaintenanceScheduler.stop();
    await this.pluginHost.stopAll();
    await this.workerSupervisor.stopAll({ checkpoint });
    await this.toolBroker.stopAll();
    await this.mcpConnections.stop();
    await this.integrationService.stop();
    this.changeGraph.stop();
    await this.server.close();
    this.projectDatabases.close();
    this.database.close();
  }

  setUpdateTimer(timer: NodeJS.Timeout | undefined): void {
    if (this.updateTimer) clearInterval(this.updateTimer);
    this.updateTimer = timer;
  }
}

function sessionIdForRequest(requested: string | undefined, connectionSessionId: string): string {
  if (requested && requested !== connectionSessionId) {
    throw new RpcError(`Unknown session: ${requested}`, RpcErrorCode.UnknownSession);
  }
  return connectionSessionId;
}

function loadOrCreateToken(paths: ServicePaths): string {
  try {
    return readFileSync(paths.tokenPath, 'utf8').trim();
  } catch (error) {
    if (!isCode(error, 'ENOENT')) throw error;
  }

  const token = randomBytes(32).toString('hex');
  try {
    writeFileSync(paths.tokenPath, `${token}\n`, { encoding: 'utf8', flag: 'wx', mode: 0o600 });
  } catch (error) {
    if (!isCode(error, 'EEXIST')) throw error;
    return readFileSync(paths.tokenPath, 'utf8').trim();
  }
  return token;
}

function asRecord(value: unknown): Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function stringValue(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim().length > 0 ? value : undefined;
}

function normalizeResourcePath(value: string | undefined): string | undefined {
  if (!value) return undefined;
  const normalized = value
    .replaceAll('\\', '/')
    .replace(/\/{2,}/g, '/')
    .replace(/^\.\//, '');
  if (normalized.startsWith('/') || normalized === '..' || normalized.startsWith('../'))
    return undefined;
  return normalized;
}

function isCode(error: unknown, code: string): boolean {
  return typeof error === 'object' && error !== null && 'code' in error && error.code === code;
}

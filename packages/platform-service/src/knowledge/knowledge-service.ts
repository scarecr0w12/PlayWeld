import { existsSync, watch, type FSWatcher } from 'node:fs';
import path from 'node:path';
import {
  CanonRecordInputSchema,
  RpcError,
  RpcErrorCode,
  compile,
  type RpcNotificationParams,
  uuidv7,
  type CanonProvenance,
  type CanonRecord,
  type CanonRecordInput,
  type CanonStatus,
  type EmbeddingProfile,
  type KnowledgeGraph,
  type KnowledgeIndexState,
  type KnowledgeRecordListResult,
  type KnowledgeRecordResult,
  type KnowledgeSearchResult,
  type SearchRequest,
  type TaskCreateInput,
} from '@gamecrafter/contracts';
import type { BoardService } from '../board/board-service';
import type { CompletionService } from '../models/completion-service';
import type { ModelRegistry } from '../models/model-registry';
import type { PluginRegistry } from '../plugins/plugin-registry';
import type { CredentialStore } from '../profile/credential-store';
import type { ProfileStore } from '../profile/profile-store';
import type { ProjectDatabases } from '../projects/project-databases';
import type { SettingsService } from '../settings/settings-service';
import type { TaskService } from '../tasks/task-service';
import type { ToolBroker } from '../tools/tool-broker';
import type { ToolContext, ToolExecutionResult, ToolRegistry } from '../tools/tool-registry';
import { CanonStore } from './canon-store';
import { KnowledgeIndexer } from './knowledge-indexer';
import { KnowledgeStore } from './knowledge-store';
import { registerKnowledgeTools } from './knowledge-tools';
import { KnowledgeRetriever } from './retriever';
import type { VectorStore } from './vector-store';
import type { VectorStoreAdapter } from './vector-store-registry';

const canonInputValidator = compile<CanonRecordInput>(CanonRecordInputSchema);

export interface KnowledgeServiceEvents {
  indexChanged(projectId: string, status: KnowledgeIndexState): void;
  recordChanged(projectId: string, record: CanonRecord): void;
}

export interface KnowledgeServiceOptions {
  projects: ProfileStore;
  projectDatabases: ProjectDatabases;
  settings: SettingsService;
  tasks: TaskService;
  completion: CompletionService;
  models: ModelRegistry;
  credentials: CredentialStore;
  plugins: PluginRegistry;
  board: BoardService;
  toolBroker: ToolBroker;
  toolRegistry: ToolRegistry;
  events: KnowledgeServiceEvents;
  now?: () => Date;
  vectorStoreFactory?: (projectId: string) => VectorStore;
  vectorStoreAdapters?: VectorStoreAdapter[];
  qdrantBinaryPath?: string;
}

export class KnowledgeService {
  readonly indexer: KnowledgeIndexer;
  private readonly canonStore = new CanonStore();
  private readonly now: () => Date;
  private readonly watchers = new Map<string, FSWatcher[]>();
  private readonly watcherFailures = new Set<string>();
  private readonly settingsRevisions = new Map<string, number>();
  private readonly debounceTimers = new Map<string, NodeJS.Timeout>();
  private reconcileTimer?: NodeJS.Timeout;
  private started = false;
  private stopped = false;

  constructor(private readonly options: KnowledgeServiceOptions) {
    this.now = options.now ?? (() => new Date());
    this.indexer = new KnowledgeIndexer({
      projects: options.projects,
      projectDatabases: options.projectDatabases,
      settings: options.settings,
      board: options.board,
      completion: options.completion,
      credentials: options.credentials,
      plugins: options.plugins,
      now: this.now,
      ...(options.vectorStoreFactory ? { vectorStoreFactory: options.vectorStoreFactory } : {}),
      vectorStoreAdapters: options.vectorStoreAdapters,
      qdrantBinaryPath: options.qdrantBinaryPath,
    });
    registerKnowledgeTools(options.toolRegistry, {
      search: (context, input) => this.searchTool(context, input),
      read: (context, input) => this.readTool(context, input),
      write: (context, input) => this.writeTool(context, input),
      proposeStatus: (context, input) => this.proposeStatusTool(context, input),
      graph: (context, input) => this.graphTool(context, input),
      executeIndex: (context, input) => this.executeIndex(context, input),
    });
  }

  async start(): Promise<void> {
    if (this.started || this.stopped) return;
    this.started = true;
    for (const project of this.options.projects.list()) {
      this.watchProject(project.projectId);
      const status = await this.indexer.status(project.projectId).catch(() => undefined);
      if (!status?.lastFullReconcileAt) this.scheduleReindex(project.projectId, true);
    }
    this.reconcileTimer = setInterval(() => void this.periodicReconcile(), 60_000);
    this.reconcileTimer.unref();
  }

  async stop(): Promise<void> {
    this.stopped = true;
    if (this.reconcileTimer) clearInterval(this.reconcileTimer);
    this.reconcileTimer = undefined;
    for (const timer of this.debounceTimers.values()) clearTimeout(timer);
    this.debounceTimers.clear();
    for (const watchers of this.watchers.values()) for (const watcher of watchers) watcher.close();
    this.watchers.clear();
    await this.indexer.close();
  }

  onProjectCreated(projectId: string): void {
    this.watchProject(projectId);
    this.scheduleReindex(projectId, true);
  }

  onProjectOpened(projectId: string): void {
    this.watchProject(projectId);
  }

  onSettingChanged(event: RpcNotificationParams<'settings/changed'>): void {
    const projectIds = event.projectId
      ? [event.projectId]
      : this.options.projects.list().map((project) => project.projectId);
    for (const projectId of projectIds) {
      this.settingsRevisions.set(projectId, (this.settingsRevisions.get(projectId) ?? 0) + 1);
      this.scheduleReindex(projectId, true);
    }
  }

  async onCanonFilesWritten(projectId: string, paths: string[]): Promise<void> {
    const result = await this.indexer.reconcile(projectId, false);
    const store = this.store(projectId);
    this.options.events.indexChanged(projectId, result.status);
    for (const filePath of paths) {
      const record = store.recordByPath(filePath)?.record;
      if (record) this.options.events.recordChanged(projectId, record);
    }
  }

  onBoardChanged(projectId: string): void {
    this.queueIncremental(projectId);
  }

  records(
    projectId: string,
    filter: {
      type?: string;
      status?: CanonStatus;
      module?: string;
      includeInactive?: boolean;
      search?: string;
    } = {},
  ): KnowledgeRecordListResult {
    const store = this.store(projectId);
    return {
      records: store.listRecords(filter),
      conflicts: store.conflicts().map((conflict) => conflict.id),
    };
  }

  record(projectId: string, recordId: string): KnowledgeRecordResult {
    const store = this.store(projectId);
    const matches = store.recordsById(recordId);
    if (matches.length === 0) {
      throw new RpcError(`Canon record not found: ${recordId}`, RpcErrorCode.CanonRecordNotFound);
    }
    if (matches.length > 1) {
      throw new RpcError(
        `Canon record id is conflicted: ${recordId}`,
        RpcErrorCode.CanonDuplicateId,
      );
    }
    const record = matches[0]!;
    return {
      record,
      body: store.recordBody(record.path) ?? '',
      inbound: store.inboundReferences(recordId),
      outbound: record.references,
    };
  }

  async write(
    projectId: string,
    record: CanonRecordInput,
    body: string,
    recordPath?: string,
  ): Promise<CanonRecord> {
    const at = this.now().toISOString();
    const provenance = [...(record.provenance ?? []), { kind: 'user' as const, ref: 'user', at }];
    const written = await this.writeRecord(projectId, record, body, recordPath, provenance);
    if (written.status === 'accepted' && written.supersedes) {
      await this.markRetconned(projectId, written.supersedes, { kind: 'user', ref: written.id });
    }
    return written;
  }

  async setStatus(
    projectId: string,
    recordId: string,
    status: CanonStatus,
    justification: { kind: 'decision' | 'user'; ref: string },
  ): Promise<CanonRecord> {
    const current = this.record(projectId, recordId);
    if (current.record.path.startsWith('docs/decisions/')) {
      throw new RpcError(
        'Decision record status is managed by Board synchronization.',
        RpcErrorCode.CanonStatusNotAllowed,
      );
    }
    if (status === 'accepted' && justification.kind === 'decision') {
      const decision = this.options.board.decision(projectId, justification.ref);
      if (
        decision.syncStatus !== 'synchronized' ||
        decision.canonRecordPath !== current.record.path
      ) {
        throw new RpcError(
          'Only the synchronized binding decision for this record can accept it.',
          RpcErrorCode.CanonStatusNotAllowed,
        );
      }
    }
    const at = this.now().toISOString();
    const updated = await this.writeRecord(
      projectId,
      { ...recordInput(current.record), status },
      current.body,
      current.record.path,
      [...current.record.provenance, { kind: justification.kind, ref: justification.ref, at }],
    );
    if (status === 'accepted' && updated.supersedes) {
      await this.markRetconned(projectId, updated.supersedes, justification);
    }
    return updated;
  }

  async search(request: SearchRequest): Promise<KnowledgeSearchResult> {
    const store = this.store(request.projectId);
    const retriever = new KnowledgeRetriever({
      store: () => store,
      embeddingProfile: () => store.activeEmbeddingProfile(request.projectId),
      vectorStore: () => this.indexer.createVectorStore(request.projectId),
      embed: (modelId, inputs) => this.options.completion.embed(modelId, inputs),
      taskContext: (projectId, taskId) => {
        const task = this.options.tasks.get(projectId, taskId);
        return { goal: task.goal, resources: task.touches?.map((touch) => touch.resource) ?? [] };
      },
    });
    return retriever.search(request);
  }

  async indexStatus(projectId: string): Promise<KnowledgeIndexState> {
    const status = await this.indexer.status(projectId);
    const activeTasks = this.options.tasks
      .list(projectId, { states: ['ready', 'claimed', 'running', 'waiting_input'], limit: 1000 })
      .filter((task) => task.kind === 'knowledge.reindex' || task.kind === 'knowledge.reconcile');
    return { ...status, pending: activeTasks.length };
  }

  rebuild(projectId: string, full = true): string {
    return this.createTask(
      projectId,
      'knowledge.reindex',
      full,
      `reindex:${full ? 'full' : 'incremental'}`,
    );
  }

  reconcile(projectId: string): string {
    return this.createTask(projectId, 'knowledge.reconcile', true, 'reconcile:full');
  }

  scheduleReindex(projectId: string, full = false): string {
    return this.rebuild(projectId, full);
  }

  scheduleReconcile(projectId: string): string {
    return this.reconcile(projectId);
  }

  async setEmbeddingProfile(
    projectId: string,
    modelId: string,
    providerAccountId: string,
  ): Promise<EmbeddingProfile> {
    const model = this.options.models.getModel(modelId);
    if (!model || !model.enabled || model.accountId !== providerAccountId) {
      throw new RpcError(
        'Embedding model and provider account do not match an enabled model.',
        RpcErrorCode.EmbeddingProfileMissing,
      );
    }
    if (!model.capabilities.embeddings) {
      throw new RpcError(
        'Selected model does not support embeddings.',
        RpcErrorCode.EmbeddingProfileMissing,
      );
    }
    const probe = await this.options.completion.embed(modelId, [
      'PlayWeld embedding dimension probe',
    ]);
    const dimensions = probe.vectors[0]?.length ?? 0;
    if (dimensions < 1) {
      throw new RpcError(
        'Embedding model returned no dimensions.',
        RpcErrorCode.EmbeddingProfileMissing,
      );
    }
    const store = this.store(projectId);
    const previous = store.activeEmbeddingProfile(projectId);
    const profile: EmbeddingProfile = {
      profileId: uuidv7(),
      projectId,
      modelId,
      providerAccountId,
      dimensions,
      version: (previous?.version ?? 0) + 1,
      createdAt: this.now().toISOString(),
    };
    store.setEmbeddingProfile(profile);
    this.rebuild(projectId, true);
    return profile;
  }

  async testVectorStore(projectId: string) {
    const profile = this.store(projectId).activeEmbeddingProfile(projectId);
    const vectorStore = this.indexer.createVectorStore(projectId);
    const health = await vectorStore.health(profile ?? undefined);
    let collection = health.collection;
    let error = health.error;
    if (profile && health.reachable) {
      try {
        collection = await vectorStore.ensureCollection(profile);
      } catch (cause) {
        error = errorMessage(cause);
      }
    }
    return { kind: health.kind, reachable: health.reachable && !error, collection, error };
  }

  graph(projectId: string, recordId?: string, depth = 1): KnowledgeGraph {
    const records = this.store(projectId).listRecords({ includeInactive: true });
    const byId = new Map<string, CanonRecord[]>();
    for (const record of records) byId.set(record.id, [...(byId.get(record.id) ?? []), record]);
    const nodes = new Map<string, KnowledgeGraph['nodes'][number]>();
    const edges = new Map<string, KnowledgeGraph['edges'][number]>();
    const maximumDepth = Math.max(1, Math.min(depth, 5));
    const queue = recordId
      ? [{ id: recordId, depth: 0 }]
      : records.map((record) => ({ id: record.id, depth: 0 }));
    const visited = new Set<string>();
    while (queue.length > 0) {
      const current = queue.shift()!;
      if (visited.has(current.id) || current.depth > maximumDepth) continue;
      visited.add(current.id);
      const matches = byId.get(current.id) ?? [];
      if (matches.length !== 1) continue;
      const record = matches[0]!;
      nodes.set(record.id, {
        recordId: record.id,
        type: record.type,
        title: record.title,
        status: record.status,
        active: record.active,
      });
      for (const reference of record.references) {
        const key = `${record.id}\0${reference.rel}\0${reference.target}`;
        edges.set(key, {
          source: record.id,
          target: reference.target,
          rel: reference.rel,
          confidence: reference.confidence,
        });
        if (current.depth < maximumDepth && byId.has(reference.target))
          queue.push({ id: reference.target, depth: current.depth + 1 });
      }
      if (record.supersedes) {
        const key = `${record.id}\0supersedes\0${record.supersedes}`;
        edges.set(key, {
          source: record.id,
          target: record.supersedes,
          rel: 'supersedes',
          confidence: 1,
        });
        if (current.depth < maximumDepth && byId.has(record.supersedes))
          queue.push({ id: record.supersedes, depth: current.depth + 1 });
      }
      for (const source of records) {
        for (const reference of source.references.filter((entry) => entry.target === record.id)) {
          const key = `${source.id}\0${reference.rel}\0${record.id}`;
          edges.set(key, {
            source: source.id,
            target: record.id,
            rel: reference.rel,
            confidence: reference.confidence,
          });
          if (current.depth < maximumDepth && byId.has(source.id))
            queue.push({ id: source.id, depth: current.depth + 1 });
        }
        if (source.supersedes === record.id) {
          const key = `${source.id}\0supersedes\0${record.id}`;
          edges.set(key, {
            source: source.id,
            target: record.id,
            rel: 'supersedes',
            confidence: 1,
          });
        }
      }
    }
    return { nodes: [...nodes.values()], edges: [...edges.values()] };
  }

  async executeIndex(context: ToolContext, input: unknown): Promise<ToolExecutionResult> {
    if (!context.taskId)
      throw new RpcError('Knowledge indexing requires a supervised task.', RpcErrorCode.ToolDenied);
    const args = asRecord(input);
    const task = this.options.tasks.get(context.projectId, context.taskId);
    if (
      (task.kind !== 'knowledge.reindex' && task.kind !== 'knowledge.reconcile') ||
      args.kind !== task.kind
    ) {
      throw new RpcError(
        'Only knowledge index tasks can execute this operation.',
        RpcErrorCode.ToolDenied,
      );
    }
    const full = args.full === true || task.kind === 'knowledge.reconcile';
    let revision = this.settingsRevisions.get(context.projectId) ?? 0;
    let result = await this.indexer.reconcile(context.projectId, full);
    while (!this.stopped && revision !== (this.settingsRevisions.get(context.projectId) ?? 0)) {
      revision = this.settingsRevisions.get(context.projectId) ?? 0;
      result = await this.indexer.reconcile(context.projectId, true);
    }
    this.options.events.indexChanged(context.projectId, result.status);
    return {
      output: {
        summary: `Indexed ${result.status.chunks} chunk(s).`,
        status: result.status,
        noOp: result.noOp,
      },
      evidence: [{ kind: 'knowledge-index', ref: context.taskId }],
    };
  }

  async searchTool(context: ToolContext, input: unknown): Promise<ToolExecutionResult> {
    const args = asRecord(input);
    const result = await this.search({
      projectId: context.projectId,
      query: typeof args.query === 'string' ? args.query : '',
      ...(Array.isArray(args.sources) ? { sources: args.sources as SearchRequest['sources'] } : {}),
      ...(Array.isArray(args.recordTypes) ? { recordTypes: args.recordTypes as string[] } : {}),
      ...(Array.isArray(args.statuses)
        ? { statuses: args.statuses as SearchRequest['statuses'] }
        : {}),
      ...(typeof args.includeInactive === 'boolean'
        ? { includeInactive: args.includeInactive }
        : {}),
      ...(typeof args.limit === 'number' ? { limit: args.limit } : {}),
      ...(typeof args.mode === 'string' ? { mode: args.mode as SearchRequest['mode'] } : {}),
      ...(context.taskId ? { taskId: context.taskId } : {}),
      maxTokens: typeof args.maxTokens === 'number' ? args.maxTokens : 4000,
    });
    return {
      output: result,
      evidence: result.hits.map((hit) => ({ kind: 'citation', ref: hit.citation })),
    };
  }

  async readTool(context: ToolContext, input: unknown): Promise<ToolExecutionResult> {
    const args = asRecord(input);
    const recordId = typeof args.recordId === 'string' ? args.recordId : '';
    const result = this.record(context.projectId, recordId);
    return { output: result, evidence: [{ kind: 'canon-record', ref: recordId }] };
  }

  async writeTool(context: ToolContext, input: unknown): Promise<ToolExecutionResult> {
    const args = asRecord(input);
    const type = typeof args.type === 'string' ? args.type : '';
    const title = typeof args.title === 'string' ? args.title : '';
    const status = args.status === 'proposed' ? 'proposed' : 'draft';
    if (
      context.agentRole &&
      args.status !== undefined &&
      args.status !== 'draft' &&
      args.status !== 'proposed'
    ) {
      throw new RpcError(
        'Agents may only write draft or proposed canon records.',
        RpcErrorCode.CanonStatusNotAllowed,
      );
    }
    const existingId = typeof args.recordId === 'string' ? args.recordId : undefined;
    const id = existingId ?? defaultRecordId(type, title);
    const existing = this.store(context.projectId).recordsById(id);
    if (existing.length > 1)
      throw new RpcError(`Canon record id is conflicted: ${id}`, RpcErrorCode.CanonDuplicateId);
    const previous = existing[0];
    if (context.agentRole && previous && !['draft', 'proposed'].includes(previous.status)) {
      throw new RpcError(
        `Reviewed canon ${id} requires a separate proposal; agents cannot overwrite it.`,
        RpcErrorCode.CanonStatusNotAllowed,
      );
    }
    const record = canonInputValidator.assert({
      id,
      type,
      title,
      status,
      ...(typeof args.module === 'string'
        ? { module: args.module }
        : previous?.module
          ? { module: previous.module }
          : {}),
      tags: Array.isArray(args.tags)
        ? args.tags.filter((tag): tag is string => typeof tag === 'string')
        : (previous?.tags ?? []),
      references: Array.isArray(args.references) ? args.references : (previous?.references ?? []),
      ...(previous?.supersedes ? { supersedes: previous.supersedes } : {}),
    });
    const taskId = context.taskId;
    const provenance: CanonProvenance[] = [
      ...(previous?.provenance ?? []),
      { kind: taskId ? 'task' : 'user', ref: taskId ?? 'user', at: this.now().toISOString() },
    ];
    const written = await this.writeRecord(
      context.projectId,
      record,
      typeof args.body === 'string' ? args.body : '',
      typeof args.path === 'string' ? args.path : previous?.path,
      provenance,
      context,
    );
    return { output: written, evidence: [{ kind: 'canon-record', ref: written.id }] };
  }

  async proposeStatusTool(context: ToolContext, input: unknown): Promise<ToolExecutionResult> {
    const args = asRecord(input);
    const recordId = typeof args.recordId === 'string' ? args.recordId : '';
    const targetStatus = typeof args.status === 'string' ? args.status : 'accepted';
    const record = this.record(context.projectId, recordId).record;
    const body = `Proposed status change for ${record.id}: ${record.status} → ${targetStatus}\n\n${String(args.rationale ?? '')}`;
    const author = context.agentRole
      ? { kind: 'agent' as const, role: context.agentRole, taskId: context.taskId ?? null }
      : { kind: 'user' as const };
    const thread = this.options.board.createThread(
      {
        projectId: context.projectId,
        title: `Canon status proposal: ${record.title}`,
        kind: 'proposal',
        tags: ['canon', 'status'],
        body,
        type: 'proposal',
      },
      author,
    );
    return {
      output: { proposalId: thread.message.messageId, threadId: thread.thread.threadId },
      evidence: [{ kind: 'board-proposal', ref: thread.message.messageId }],
    };
  }

  async graphTool(context: ToolContext, input: unknown): Promise<ToolExecutionResult> {
    const args = asRecord(input);
    const result = this.graph(
      context.projectId,
      typeof args.recordId === 'string' ? args.recordId : undefined,
      typeof args.depth === 'number' ? args.depth : 1,
    );
    return {
      output: result,
      evidence: result.nodes.map((node) => ({ kind: 'canon-record', ref: node.recordId })),
    };
  }

  private async writeRecord(
    projectId: string,
    record: CanonRecordInput,
    body: string,
    recordPath: string | undefined,
    provenance: CanonProvenance[],
    caller?: ToolContext,
  ): Promise<CanonRecord> {
    if (!this.indexer.recordTypes().includes(record.type)) {
      throw new RpcError(
        `Unknown canon record type: ${record.type}`,
        RpcErrorCode.CanonRecordInvalid,
      );
    }
    const fileInput = { record, body, path: recordPath, provenance };
    const existing = this.store(projectId).recordsById(record.id);
    if (existing.length > 1) {
      throw new RpcError(
        `Canon record id is conflicted: ${record.id}`,
        RpcErrorCode.CanonDuplicateId,
      );
    }
    fileInput.path ??= existing[0]?.path;
    let relativePath: string;
    try {
      relativePath = this.canonStore.pathFor(fileInput);
    } catch (error) {
      throw new RpcError(errorMessage(error), RpcErrorCode.InvalidParams);
    }
    if (existing[0] && existing[0].path !== relativePath) {
      throw new RpcError(
        `Canon id ${record.id} already belongs to ${existing[0].path}.`,
        RpcErrorCode.CanonDuplicateId,
      );
    }
    const owner = this.store(projectId)
      .listRecords({ includeInactive: true })
      .find((candidate) => candidate.path === relativePath && candidate.id !== record.id);
    if (owner) {
      throw new RpcError(
        `Canon path ${relativePath} already belongs to ${owner.id}.`,
        RpcErrorCode.CanonDuplicateId,
      );
    }
    const content = this.canonStore.serialize(fileInput);
    const call = await this.options.toolBroker.call(
      {
        projectId,
        ...(caller?.taskId ? { taskId: caller.taskId } : {}),
        ...(caller?.agentId ? { agentId: caller.agentId } : {}),
        toolId: 'fs/write-file',
        input: { path: relativePath, content, createDirectories: true },
      },
      {
        ...(caller?.accessMode ? { accessCeiling: caller.accessMode } : {}),
        ...(caller?.signal ? { signal: caller.signal } : {}),
      },
    );
    if (call.status !== 'completed') {
      throw new RpcError(
        call.error?.message ?? `Canon write ended with ${call.status}.`,
        RpcErrorCode.ToolDenied,
      );
    }
    const indexResult = await this.indexer.reconcile(projectId, false);
    this.options.events.indexChanged(projectId, indexResult.status);
    const matches = this.store(projectId).recordsById(record.id);
    if (matches.length > 1)
      throw new RpcError(
        `Canon record id is conflicted: ${record.id}`,
        RpcErrorCode.CanonDuplicateId,
      );
    const saved = matches[0];
    if (!saved)
      throw new RpcError(
        `Canon record was not indexed: ${record.id}`,
        RpcErrorCode.CanonRecordInvalid,
      );
    this.options.events.recordChanged(projectId, saved);
    return saved;
  }

  private async markRetconned(
    projectId: string,
    recordId: string,
    justification: { kind: 'decision' | 'user'; ref: string },
  ): Promise<void> {
    const current = this.record(projectId, recordId);
    if (current.record.status === 'retconned' || current.record.path.startsWith('docs/decisions/'))
      return;
    const at = this.now().toISOString();
    await this.writeRecord(
      projectId,
      { ...recordInput(current.record), status: 'retconned' },
      current.body,
      current.record.path,
      [...current.record.provenance, { kind: justification.kind, ref: justification.ref, at }],
    );
  }

  private createTask(
    projectId: string,
    kind: 'knowledge.reindex' | 'knowledge.reconcile',
    full: boolean,
    dedup: string,
  ): string {
    const active = this.options.tasks
      .list(projectId, {
        states: ['ready', 'claimed', 'running', 'waiting_input'],
        limit: 1000,
      })
      .find((task) => task.kind === kind);
    if (active) return active.taskId;
    const input: TaskCreateInput = {
      projectId,
      kind,
      title:
        kind === 'knowledge.reconcile'
          ? 'Reconcile Project knowledge'
          : 'Rebuild Project knowledge index',
      goal: `Knowledge ${dedup}`,
      input: { kind, full },
      assignee: { role: 'knowledge-indexer', accessCeiling: 'full' },
    };
    return this.options.tasks.create(input).task.taskId;
  }

  private watchProject(projectId: string): void {
    if (this.watchers.has(projectId) || this.stopped) return;
    const project = this.options.projects.getById(projectId);
    if (!project) return;
    const watchers: FSWatcher[] = [];
    for (const directory of ['docs', 'game']) {
      const target = path.join(project.path, directory);
      if (!existsSync(target)) continue;
      try {
        watchers.push(watch(target, { recursive: true }, () => this.queueIncremental(projectId)));
      } catch {
        this.watcherFailures.add(projectId);
      }
    }
    if (watchers.length > 0) this.watchers.set(projectId, watchers);
    else this.watcherFailures.add(projectId);
  }

  private queueIncremental(projectId: string): void {
    if (this.stopped) return;
    const previous = this.debounceTimers.get(projectId);
    if (previous) clearTimeout(previous);
    const timer = setTimeout(() => {
      this.debounceTimers.delete(projectId);
      this.scheduleReindex(projectId, false);
    }, 500);
    timer.unref();
    this.debounceTimers.set(projectId, timer);
  }

  private async periodicReconcile(): Promise<void> {
    if (this.stopped) return;
    for (const project of this.options.projects.list()) {
      if (!this.watcherFailures.has(project.projectId)) continue;
      const interval =
        Number(
          this.options.settings.resolve('knowledge.reconcileIntervalMinutes', {
            projectId: project.projectId,
          }).value,
        ) || 60;
      const status = await this.indexer.status(project.projectId).catch(() => undefined);
      const last = status?.lastFullReconcileAt ? Date.parse(status.lastFullReconcileAt) : 0;
      if (this.now().getTime() - last >= interval * 60_000)
        this.scheduleReconcile(project.projectId);
    }
  }

  private store(projectId: string): KnowledgeStore {
    return new KnowledgeStore(this.options.projectDatabases.get(projectId));
  }
}

function recordInput(record: CanonRecord): CanonRecordInput {
  return {
    id: record.id,
    type: record.type,
    title: record.title,
    status: record.status,
    ...(record.module ? { module: record.module } : {}),
    tags: record.tags,
    references: record.references,
    provenance: record.provenance,
    ...(record.supersedes ? { supersedes: record.supersedes } : {}),
  };
}

function defaultRecordId(type: string, title: string): string {
  const slug =
    title
      .toLowerCase()
      .normalize('NFKD')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '') || uuidv7();
  return `record.${slug}`;
}

function asRecord(value: unknown): Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

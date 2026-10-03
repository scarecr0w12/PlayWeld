import React from 'react';
import { inject, injectable } from '@theia/core/shared/inversify';
import { Message } from '@theia/core/lib/browser/widgets/widget';
import { ControlRoomReactWidget } from './control-room-react-widget';
import type {
  CanonRecord,
  CanonStatus,
  IndexSource,
  KnowledgeGraph,
  KnowledgeIndexState,
  KnowledgeRecordResult,
  KnowledgeSearchResult,
  Model,
  ProjectSummary,
  ProviderAccount,
  SearchMode,
} from '@gamecrafter/contracts';
import {
  ControlRoomService,
  type ControlRoomService as ControlRoomServiceApi,
} from '../common/control-room-protocol';
import { ControlRoomClientEvents } from './control-room-client';

const sourceFilters: Array<IndexSource | 'all'> = [
  'all',
  'canon',
  'decisions',
  'docs',
  'code',
  'board',
  'assets',
  'inactive',
];
const statuses: Array<CanonStatus | 'all'> = [
  'all',
  'draft',
  'proposed',
  'accepted',
  'deprecated',
  'retconned',
];

@injectable()
export class KnowledgeWidget extends ControlRoomReactWidget {
  static readonly ID = 'gamecrafter.knowledge';

  private projects: ProjectSummary[] = [];
  private projectId = '';
  private records: CanonRecord[] = [];
  private selectedRecordId = '';
  private recordDetail?: KnowledgeRecordResult;
  private searchResult?: KnowledgeSearchResult;
  private graph?: KnowledgeGraph;
  private indexStatus?: KnowledgeIndexState;
  private models: Model[] = [];
  private accounts: ProviderAccount[] = [];
  private mode: SearchMode = 'hybrid';
  private source: IndexSource | 'all' = 'all';
  private recordType = '';
  private status: CanonStatus | 'all' = 'all';
  private includeInactive = false;
  private query = '';
  private modelId = '';
  private providerAccountId = '';
  private vectorKind: 'none' | 'qdrant' = 'none';
  private vectorUrl = 'http://127.0.0.1:6333';
  private collectionPrefix = 'gamecrafter';
  private vectorTimeoutMs = 5000;
  private apiKeyRef = '';
  private busy = false;
  private errorMessage?: string;
  private resultMessage?: string;

  constructor(
    @inject(ControlRoomService)
    private readonly service: ControlRoomServiceApi,
    @inject(ControlRoomClientEvents)
    private readonly clientEvents: ControlRoomClientEvents,
  ) {
    super();
    this.id = KnowledgeWidget.ID;
    this.title.label = 'Knowledge';
    this.title.iconClass = 'codicon codicon-book';
    this.title.closable = true;
    this.toDispose.push(this.clientEvents.projectChanged(() => void this.refresh()));
    this.toDispose.push(
      this.clientEvents.knowledgeIndexChanged(({ projectId, status }) => {
        if (projectId !== this.projectId) return;
        this.indexStatus = status;
        this.graph = undefined;
        void this.refreshRecords();
        this.update();
      }),
    );
    this.toDispose.push(
      this.clientEvents.knowledgeRecordChanged(({ projectId, record }) => {
        if (projectId !== this.projectId) return;
        this.records = [record, ...this.records.filter((entry) => entry.id !== record.id)];
        this.graph = undefined;
        if (record.id === this.selectedRecordId) void this.refreshSelectedRecord();
        this.update();
      }),
    );
    this.toDispose.push(
      this.clientEvents.taskChanged(({ projectId, task }) => {
        if (projectId === this.projectId && task.kind.startsWith('knowledge.'))
          void this.refreshStatus();
      }),
    );
    this.toDispose.push(
      this.clientEvents.settingsChanged((event) => {
        if (
          event.key.startsWith('knowledge.') &&
          (!event.projectId || event.projectId === this.projectId)
        ) {
          void this.refreshSettings();
        }
      }),
    );
    void this.refresh();
  }

  protected onActivateRequest(message: Message): void {
    super.onActivateRequest(message);
    void this.refresh();
  }

  protected render(): React.ReactNode {
    return (
      <div className="gamecrafter-knowledge gamecrafter-surface">
        <header className="gamecrafter-knowledge-header">
          <div>
            <h1>Knowledge</h1>
            <p>
              Search Project canon, decisions, documentation, source, assets, and discussion
              history.
            </p>
          </div>
          <label>
            Project
            <select
              aria-label="Knowledge Project"
              value={this.projectId}
              onChange={(event) => {
                this.markProjectSelection();
                this.projectId = event.currentTarget.value;
                this.selectedRecordId = '';
                this.recordDetail = undefined;
                this.searchResult = undefined;
                void this.refreshProject();
              }}
            >
              <option value="">Select a Project</option>
              {this.projects.map((project) => (
                <option key={project.projectId} value={project.projectId}>
                  {project.name}
                </option>
              ))}
            </select>
          </label>
          <button
            type="button"
            disabled={this.busy || !this.projectId}
            onClick={() => void this.refresh()}
          >
            Refresh
          </button>
        </header>

        {this.errorMessage && (
          <p className="gamecrafter-knowledge-error" role="alert">
            {this.errorMessage}
          </p>
        )}
        {this.resultMessage && (
          <p className="gamecrafter-knowledge-result" role="status">
            {this.resultMessage}
          </p>
        )}
        {!this.projectId ? (
          <p>Select a Project to inspect its knowledge index.</p>
        ) : (
          <>
            {this.renderIndexStatus()}
            {this.renderVectorSettings()}
            {this.renderSearch()}
            <div className="gamecrafter-knowledge-layout">
              {this.renderRecords()}
              <div className="gamecrafter-knowledge-detail-column">
                {this.renderSearchResults()}
                {this.renderRecordDetail()}
                {this.renderGraph()}
              </div>
            </div>
          </>
        )}
      </div>
    );
  }

  private renderIndexStatus(): React.ReactNode {
    const status = this.indexStatus;
    return (
      <section className="gamecrafter-knowledge-section">
        <div className="gamecrafter-knowledge-section-header">
          <div>
            <h2>Index status</h2>
            {status ? (
              <p>
                {status.records} records · {status.chunks} chunks · {status.vectors ?? 0} vectors ·{' '}
                {status.pending} pending
              </p>
            ) : (
              <p>Loading index status…</p>
            )}
          </div>
          <div className="gamecrafter-knowledge-actions">
            <button type="button" disabled={this.busy} onClick={() => void this.runReconcile()}>
              Reconcile
            </button>
            <button type="button" disabled={this.busy} onClick={() => void this.runRebuild()}>
              Rebuild
            </button>
            <button type="button" disabled={this.busy} onClick={() => void this.testVectorStore()}>
              Test vector store
            </button>
          </div>
        </div>
        {status && (
          <div className="gamecrafter-knowledge-status-grid">
            <span>Last full reconcile: {formatTime(status.lastFullReconcileAt)}</span>
            <span>Last incremental index: {formatTime(status.lastIncrementalAt)}</span>
            <span>
              Vector store: {status.vectorStore.kind} ·{' '}
              {status.vectorStore.reachable ? 'reachable' : 'unavailable'}
            </span>
            <span>Collection: {status.vectorStore.collection ?? '—'}</span>
            {status.vectorStore.error && (
              <span className="gamecrafter-knowledge-error">{status.vectorStore.error}</span>
            )}
            {status.conflicts.length > 0 && (
              <span className="gamecrafter-knowledge-error">
                Conflicts: {status.conflicts.map((item) => item.id).join(', ')}
              </span>
            )}
            {status.brokenReferences.length > 0 && (
              <span className="gamecrafter-knowledge-warning">
                Broken references:{' '}
                {status.brokenReferences
                  .map((item) => `${item.recordId} → ${item.target}`)
                  .join(', ')}
              </span>
            )}
          </div>
        )}
      </section>
    );
  }

  private renderVectorSettings(): React.ReactNode {
    return (
      <details className="gamecrafter-knowledge-section">
        <summary>Vector store and embedding profile</summary>
        <div className="gamecrafter-knowledge-form">
          <label>
            Vector store
            <select
              value={this.vectorKind}
              onChange={(event) => {
                this.vectorKind = event.currentTarget.value as 'none' | 'qdrant';
                this.update();
              }}
            >
              <option value="none">Lexical only</option>
              <option value="qdrant">Qdrant</option>
            </select>
          </label>
          <label>
            Qdrant URL
            <input
              value={this.vectorUrl}
              onChange={(event) => {
                this.vectorUrl = event.currentTarget.value;
                this.update();
              }}
            />
          </label>
          <label>
            Collection prefix
            <input
              value={this.collectionPrefix}
              onChange={(event) => {
                this.collectionPrefix = event.currentTarget.value;
                this.update();
              }}
            />
          </label>
          <label>
            Request timeout (ms)
            <input
              type="number"
              min="1"
              value={this.vectorTimeoutMs}
              onChange={(event) => {
                this.vectorTimeoutMs = Number(event.currentTarget.value);
                this.update();
              }}
            />
          </label>
          <label>
            API key credential reference
            <input
              value={this.apiKeyRef}
              onChange={(event) => {
                this.apiKeyRef = event.currentTarget.value;
                this.update();
              }}
              placeholder="${cred:KEY}"
            />
          </label>
          <button type="button" disabled={this.busy} onClick={() => void this.saveVectorSettings()}>
            Save vector settings
          </button>
        </div>
        <div className="gamecrafter-knowledge-form">
          <label>
            Embedding model
            <select
              value={this.modelId}
              onChange={(event) => {
                this.modelId = event.currentTarget.value;
                this.update();
              }}
            >
              <option value="">Select an embedding model</option>
              {this.models
                .filter((model) => model.enabled && model.capabilities.embeddings)
                .map((model) => (
                  <option key={model.modelId} value={model.modelId}>
                    {model.displayName} ({model.modelId})
                  </option>
                ))}
            </select>
          </label>
          <label>
            Provider account
            <select
              value={this.providerAccountId}
              onChange={(event) => {
                this.providerAccountId = event.currentTarget.value;
                this.update();
              }}
            >
              <option value="">Select an account</option>
              {this.accounts
                .filter((account) => account.enabled)
                .map((account) => (
                  <option key={account.accountId} value={account.accountId}>
                    {account.displayName}
                  </option>
                ))}
            </select>
          </label>
          <button
            type="button"
            disabled={this.busy || !this.modelId || !this.providerAccountId}
            onClick={() => void this.saveEmbeddingProfile()}
          >
            Set embedding profile
          </button>
          {this.indexStatus?.embeddingProfile && (
            <span>
              Active: {this.indexStatus.embeddingProfile.modelId} ·{' '}
              {this.indexStatus.embeddingProfile.dimensions} dimensions · v
              {this.indexStatus.embeddingProfile.version}
            </span>
          )}
        </div>
      </details>
    );
  }

  private renderSearch(): React.ReactNode {
    return (
      <section className="gamecrafter-knowledge-section">
        <h2>Search</h2>
        <form
          className="gamecrafter-knowledge-form"
          onSubmit={(event) => {
            event.preventDefault();
            void this.runSearch();
          }}
        >
          <label className="gamecrafter-knowledge-query">
            Query
            <input
              aria-label="Knowledge search query"
              value={this.query}
              onChange={(event) => {
                this.query = event.currentTarget.value;
                this.update();
              }}
              placeholder="Search canon and Project sources"
            />
          </label>
          <label>
            Mode
            <select
              aria-label="Knowledge search mode"
              value={this.mode}
              onChange={(event) => {
                this.mode = event.currentTarget.value as SearchMode;
                this.update();
              }}
            >
              <option value="hybrid">Hybrid</option>
              <option value="lexical">Lexical</option>
              <option value="semantic">Semantic</option>
            </select>
          </label>
          <label>
            Source
            <select
              aria-label="Knowledge search source"
              value={this.source}
              onChange={(event) => {
                this.source = event.currentTarget.value as IndexSource | 'all';
                this.update();
              }}
            >
              {sourceFilters.map((source) => (
                <option key={source} value={source}>
                  {source === 'all' ? 'All sources' : source}
                </option>
              ))}
            </select>
          </label>
          <label>
            Status
            <select
              aria-label="Knowledge record status"
              value={this.status}
              onChange={(event) => {
                this.status = event.currentTarget.value as CanonStatus | 'all';
                this.update();
              }}
            >
              {statuses.map((status) => (
                <option key={status} value={status}>
                  {status === 'all' ? 'All statuses' : status}
                </option>
              ))}
            </select>
          </label>
          <label>
            Record type
            <input
              aria-label="Knowledge record type"
              value={this.recordType}
              onChange={(event) => {
                this.recordType = event.currentTarget.value;
                this.update();
              }}
              placeholder="e.g. character"
            />
          </label>
          <label className="gamecrafter-knowledge-checkbox">
            <input
              type="checkbox"
              checked={this.includeInactive}
              onChange={(event) => {
                this.includeInactive = event.currentTarget.checked;
                this.update();
              }}
            />
            Include inactive
          </label>
          <button className="theia-button" type="submit" disabled={this.busy || !this.query.trim()}>
            Search
          </button>
        </form>
      </section>
    );
  }

  private renderSearchResults(): React.ReactNode {
    const result = this.searchResult;
    return (
      <section className="gamecrafter-knowledge-section">
        <h2>Search results</h2>
        {result?.degraded && <p className="gamecrafter-knowledge-warning">{result.degraded}</p>}
        {!result ? (
          <p>Enter a query to search this Project.</p>
        ) : result.hits.length === 0 ? (
          <p>No matching chunks.</p>
        ) : (
          <ol className="gamecrafter-knowledge-hits">
            {result.hits.map((hit) => (
              <li key={hit.chunkId}>
                <button
                  type="button"
                  className="gamecrafter-knowledge-hit"
                  onClick={() => hit.recordId && void this.openRecord(hit.recordId)}
                >
                  <strong>{hit.recordTitle ?? hit.path}</strong>
                  <span className="gamecrafter-knowledge-hit-meta">
                    {hit.source} · {hit.recordStatus ?? 'document'} · score {hit.score.toFixed(4)}
                  </span>
                  <blockquote>{hit.quote.text}</blockquote>
                  <code>{hit.citation}</code>
                </button>
              </li>
            ))}
          </ol>
        )}
      </section>
    );
  }

  private renderRecords(): React.ReactNode {
    return (
      <section className="gamecrafter-knowledge-section gamecrafter-knowledge-record-list">
        <div className="gamecrafter-knowledge-section-header">
          <h2>Canon records</h2>
          <button type="button" disabled={this.busy} onClick={() => void this.refreshRecords()}>
            Refresh
          </button>
        </div>
        {this.records.length === 0 ? (
          <p>No canon records are indexed.</p>
        ) : (
          <ul>
            {this.records.map((record) => (
              <li key={`${record.id}:${record.path}`}>
                <button
                  type="button"
                  className={record.id === this.selectedRecordId ? 'is-active' : ''}
                  onClick={() => void this.openRecord(record.id)}
                >
                  <strong>{record.title}</strong>
                  <span>
                    {record.type} · {record.status}
                    {record.active ? '' : ' · inactive'}
                  </span>
                  <code>{record.id}</code>
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>
    );
  }

  private renderRecordDetail(): React.ReactNode {
    const detail = this.recordDetail;
    if (!detail) return null;
    return (
      <section className="gamecrafter-knowledge-section">
        <div className="gamecrafter-knowledge-section-header">
          <h2>{detail.record.title}</h2>
          <button type="button" onClick={() => void this.loadGraph(detail.record.id)}>
            Graph
          </button>
        </div>
        <p>
          <code>{detail.record.id}</code> · {detail.record.type} · {detail.record.status}
          {detail.record.active ? '' : ' · inactive'}
        </p>
        <p>
          {detail.record.path}@{detail.record.revision}
        </p>
        <pre className="gamecrafter-knowledge-record-body">{detail.body}</pre>
        <div className="gamecrafter-knowledge-reference-columns">
          <div>
            <h3>Outbound references</h3>
            {detail.outbound.length === 0 ? (
              <p>None</p>
            ) : (
              <ul>
                {detail.outbound.map((reference, index) => (
                  <li key={`${reference.rel}:${reference.target}:${index}`}>
                    {reference.rel} → {reference.target} ({reference.confidence})
                  </li>
                ))}
              </ul>
            )}
          </div>
          <div>
            <h3>Inbound references</h3>
            {detail.inbound.length === 0 ? (
              <p>None</p>
            ) : (
              <ul>
                {detail.inbound.map((reference, index) => (
                  <li key={`${reference.recordId}:${reference.rel}:${index}`}>
                    {reference.recordId} — {reference.rel}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </section>
    );
  }

  private renderGraph(): React.ReactNode {
    if (!this.graph) return null;
    return (
      <section className="gamecrafter-knowledge-section">
        <h2>Reference graph</h2>
        <p>
          {this.graph.nodes.length} records · {this.graph.edges.length} edges
        </p>
        <ul>
          {this.graph.edges.map((edge, index) => (
            <li key={`${edge.source}:${edge.rel}:${edge.target}:${index}`}>
              {edge.source} —{edge.rel}→ {edge.target} ({edge.confidence})
            </li>
          ))}
        </ul>
      </section>
    );
  }

  private async refresh(): Promise<void> {
    await this.withBusy(async () => {
      this.projects = await this.service.listProjects();
      this.projectId =
        (await this.resolveProjectSelection(this.projects, () => this.projectId)) || '';
      this.models = await this.service.listModels(undefined, true);
      this.accounts = await this.service.listProviderAccounts();
      if (this.projectId) await this.refreshProject();
      else {
        this.records = [];
        this.indexStatus = undefined;
      }
    });
  }

  private async refreshProject(): Promise<void> {
    if (!this.projectId) return;
    await Promise.all([this.refreshStatus(), this.refreshRecords(), this.refreshSettings()]);
  }

  private async refreshStatus(): Promise<void> {
    if (!this.projectId) return;
    this.indexStatus = await this.service.getKnowledgeIndexStatus({ projectId: this.projectId });
    this.update();
  }

  private async refreshRecords(): Promise<void> {
    if (!this.projectId) return;
    const result = await this.service.listKnowledgeRecords({
      projectId: this.projectId,
      ...(this.recordType.trim() ? { type: this.recordType.trim() } : {}),
      ...(this.status !== 'all' ? { status: this.status } : {}),
      includeInactive: this.includeInactive,
    });
    this.records = result.records;
    if (
      this.selectedRecordId &&
      !this.records.some((record) => record.id === this.selectedRecordId)
    ) {
      this.selectedRecordId = '';
      this.recordDetail = undefined;
      this.graph = undefined;
    } else if (this.selectedRecordId) {
      await this.refreshSelectedRecord();
    }
    this.update();
  }

  private async refreshSelectedRecord(): Promise<void> {
    const projectId = this.projectId;
    const recordId = this.selectedRecordId;
    if (!projectId || !recordId) return;
    try {
      const detail = await this.service.getKnowledgeRecord({ projectId, recordId });
      if (this.projectId !== projectId || this.selectedRecordId !== recordId) return;
      this.recordDetail = detail;
      this.update();
    } catch (error) {
      if (this.projectId !== projectId || this.selectedRecordId !== recordId) return;
      this.recordDetail = undefined;
      this.errorMessage = error instanceof Error ? error.message : String(error);
      this.update();
    }
  }

  private async refreshSettings(): Promise<void> {
    if (!this.projectId) return;
    const settings = await this.service.getAllSettings(this.projectId);
    const byKey = new Map(settings.map((setting) => [setting.key, setting.value]));
    const kind = byKey.get('knowledge.vectorStore.kind');
    const url = byKey.get('knowledge.vectorStore.url');
    const prefix = byKey.get('knowledge.vectorStore.collectionPrefix');
    const timeout = byKey.get('knowledge.vectorStore.timeoutMs');
    const ref = byKey.get('knowledge.vectorStore.apiKeyRef');
    if (kind === 'none' || kind === 'qdrant') this.vectorKind = kind;
    if (typeof url === 'string') this.vectorUrl = url;
    if (typeof prefix === 'string') this.collectionPrefix = prefix;
    if (typeof timeout === 'number') this.vectorTimeoutMs = timeout;
    if (typeof ref === 'string') this.apiKeyRef = ref;
    this.update();
  }

  private async runSearch(): Promise<void> {
    if (!this.projectId || !this.query.trim()) return;
    await this.withBusy(async () => {
      this.searchResult = await this.service.searchKnowledge({
        projectId: this.projectId,
        query: this.query.trim(),
        mode: this.mode,
        ...(this.source !== 'all' ? { sources: [this.source] } : {}),
        ...(this.recordType.trim() ? { recordTypes: [this.recordType.trim()] } : {}),
        ...(this.status !== 'all' ? { statuses: [this.status] } : {}),
        includeInactive: this.includeInactive,
        limit: 20,
      });
    });
  }

  private async openRecord(recordId: string): Promise<void> {
    if (!this.projectId) return;
    await this.withBusy(async () => {
      this.selectedRecordId = recordId;
      this.recordDetail = await this.service.getKnowledgeRecord({
        projectId: this.projectId,
        recordId,
      });
      this.graph = undefined;
    });
  }

  private async loadGraph(recordId?: string): Promise<void> {
    if (!this.projectId) return;
    await this.withBusy(async () => {
      this.graph = await this.service.getKnowledgeGraph({
        projectId: this.projectId,
        ...(recordId ? { recordId } : {}),
        depth: 2,
      });
    });
  }

  private async runReconcile(): Promise<void> {
    if (!this.projectId) return;
    await this.withBusy(async () => {
      const result = await this.service.reconcileKnowledgeIndex({ projectId: this.projectId });
      this.resultMessage = `Reconciliation task ${result.taskId} queued.`;
      await this.refreshStatus();
    });
  }

  private async runRebuild(): Promise<void> {
    if (!this.projectId) return;
    await this.withBusy(async () => {
      const result = await this.service.rebuildKnowledgeIndex({
        projectId: this.projectId,
        full: true,
      });
      this.resultMessage = `Rebuild task ${result.taskId} queued.`;
      await this.refreshStatus();
    });
  }

  private async saveVectorSettings(): Promise<void> {
    if (!this.projectId) return;
    await this.withBusy(async () => {
      await this.service.setSetting(
        'knowledge.vectorStore.kind',
        'project',
        this.vectorKind,
        this.projectId,
      );
      await this.service.setSetting(
        'knowledge.vectorStore.url',
        'project',
        this.vectorUrl.trim(),
        this.projectId,
      );
      await this.service.setSetting(
        'knowledge.vectorStore.collectionPrefix',
        'project',
        this.collectionPrefix.trim(),
        this.projectId,
      );
      await this.service.setSetting(
        'knowledge.vectorStore.timeoutMs',
        'project',
        this.vectorTimeoutMs,
        this.projectId,
      );
      await this.service.setSetting(
        'knowledge.vectorStore.apiKeyRef',
        'project',
        this.apiKeyRef.trim(),
        this.projectId,
      );
      this.resultMessage = 'Project vector store settings saved.';
      await this.refreshStatus();
    });
  }

  private async saveEmbeddingProfile(): Promise<void> {
    if (!this.projectId || !this.modelId || !this.providerAccountId) return;
    await this.withBusy(async () => {
      const profile = await this.service.setKnowledgeEmbeddingProfile({
        projectId: this.projectId,
        modelId: this.modelId,
        providerAccountId: this.providerAccountId,
      });
      this.resultMessage = `Embedding profile set to ${profile.modelId} (${profile.dimensions} dimensions).`;
      await this.refreshStatus();
    });
  }

  private async testVectorStore(): Promise<void> {
    if (!this.projectId) return;
    await this.withBusy(async () => {
      const result = await this.service.testKnowledgeVectorStore({ projectId: this.projectId });
      this.resultMessage = result.reachable
        ? `Vector store reachable${result.collection ? ` · ${result.collection}` : ''}.`
        : `Vector store unavailable: ${result.error ?? 'not configured'}`;
      await this.refreshStatus();
    });
  }

  private async withBusy(action: () => Promise<void>): Promise<void> {
    this.busy = true;
    this.errorMessage = undefined;
    this.resultMessage = undefined;
    this.update();
    try {
      await action();
    } catch (error) {
      this.errorMessage = error instanceof Error ? error.message : String(error);
    } finally {
      this.busy = false;
      this.update();
    }
  }
}

function formatTime(value: string | null): string {
  return value ? new Date(value).toLocaleString() : 'not yet';
}

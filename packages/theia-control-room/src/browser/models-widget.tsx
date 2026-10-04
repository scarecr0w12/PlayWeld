import React from 'react';
import { inject, injectable } from '@theia/core/shared/inversify';
import { Message } from '@theia/core/lib/browser/widgets/widget';
import { ControlRoomReactWidget } from './control-room-react-widget';
import type {
  Model,
  ModelPool,
  ModelPoolTarget,
  ProjectSummary,
  ProviderAccount,
  ProviderKind,
  DecisionAssessment,
} from '@gamecrafter/contracts';
import {
  ControlRoomService,
  type ControlRoomService as ControlRoomServiceApi,
} from '../common/control-room-protocol';
import {
  formatDecisionAssessmentDetail,
  formatDecisionAssessmentUsage,
  formatPricing,
  summarizeDecision,
  summarizeDecisionAssessmentAdvice,
} from '../common/models-view-model';
import { MarkdownContent } from './markdown-content';

@injectable()
export class ModelsWidget extends ControlRoomReactWidget {
  static readonly ID = 'gamecrafter.models';

  private accounts: ProviderAccount[] = [];
  private models: Model[] = [];
  private pools: ModelPool[] = [];
  private decisions: Awaited<ReturnType<ControlRoomServiceApi['listRouteDecisions']>> = [];
  private decisionAssessments: DecisionAssessment[] = [];
  private decisionAssessmentsLoading = false;
  private decisionAssessmentsError?: string;
  private projects: ProjectSummary[] = [];
  private selectedProjectId?: string;
  private activeSection: 'accounts' | 'models' | 'pools' | 'decisions' | 'assessments' = 'accounts';
  private accountKind: ProviderKind = 'openai-compatible';
  private accountName = '';
  private accountBaseUrl = 'http://localhost:11434/v1';
  private accountApiKey = '';
  private accountIsLocal = true;
  private poolName = '';
  private poolScope: 'platform' | 'project' = 'platform';
  private poolTargetKind: 'none' | 'agent' | 'task-type' = 'none';
  private poolTargetId = '';
  private poolModelIds = new Set<string>();
  private errorMessage?: string;
  private readonly accountResults = new Map<string, string>();
  private readonly availableModels = new Map<string, Model[]>();
  private readonly selectedModels = new Map<string, string[]>();
  private readonly busyAccounts = new Set<string>();
  private refreshVersion = 0;

  constructor(
    @inject(ControlRoomService)
    private readonly controlRoomService: ControlRoomServiceApi,
  ) {
    super();
    this.id = ModelsWidget.ID;
    this.title.label = 'Models & Routing';
    this.title.iconClass = 'codicon codicon-hubot';
    this.title.closable = true;
    void this.refresh();
  }

  protected onActivateRequest(message: Message): void {
    super.onActivateRequest(message);
    void this.refresh();
  }

  protected render(): React.ReactNode {
    return (
      <div className="gamecrafter-models gamecrafter-page gamecrafter-surface">
        <header className="gamecrafter-models-header gamecrafter-page-header">
          <h1>Models &amp; Routing</h1>
          <label>
            Project context for pools and decisions
            <select
              aria-label="Models Project"
              value={this.selectedProjectId ?? ''}
              onChange={(event) => {
                this.markProjectSelection();
                this.selectedProjectId = event.currentTarget.value || undefined;
                void this.refresh();
              }}
            >
              <option value="">All Projects</option>
              {this.projects.map((project) => (
                <option key={project.projectId} value={project.projectId}>
                  {project.name}
                </option>
              ))}
            </select>
          </label>
          <button type="button" onClick={() => void this.refresh()}>
            Refresh
          </button>
        </header>
        {this.errorMessage && (
          <p className="gamecrafter-models-error" role="alert">
            {this.errorMessage}
          </p>
        )}
        <section
          className="gamecrafter-work-guidance gamecrafter-page-guidance"
          aria-label="Models next steps"
        >
          <div>
            <strong>What to do next</strong>
            <p>
              {this.accounts.length === 0
                ? 'Add a provider account, test the connection, and discover the models you want to enable.'
                : this.models.length === 0
                  ? 'Discover models from an enabled provider, then choose which models to add.'
                  : 'Check enabled models and their routing metadata, then create a pool for a platform or Project target.'}
            </p>
          </div>
        </section>
        <nav className="gamecrafter-section-nav" aria-label="Model configuration sections">
          {(
            [
              ['accounts', 'Provider accounts', this.accounts.length],
              ['models', 'Models', this.models.length],
              ['pools', 'Model pools', this.pools.length],
              ['decisions', 'Routing decisions', this.decisions.length],
              ['assessments', 'Decision assessments', this.decisionAssessments?.length ?? 0],
            ] as const
          ).map(([section, label, count]) => (
            <button
              key={section}
              type="button"
              aria-pressed={this.activeSection === section}
              onClick={() => {
                this.activeSection = section;
                this.update();
              }}
            >
              {label} <span className="gamecrafter-count">{count}</span>
            </button>
          ))}
        </nav>

        <section
          className="gamecrafter-models-section gamecrafter-page-panel"
          hidden={this.activeSection !== 'accounts'}
        >
          <h2>Provider accounts</h2>
          <p className="gamecrafter-page-section-intro">
            Connect a local or cloud provider before discovering its model catalog.
          </p>
          <form
            className="gamecrafter-models-account-form"
            onSubmit={(event) => {
              event.preventDefault();
              void this.addAccount();
            }}
          >
            <label>
              Provider kind
              <select
                aria-label="Provider kind"
                value={this.accountKind}
                onChange={(event) => {
                  this.accountKind = event.currentTarget.value as ProviderKind;
                  this.update();
                }}
              >
                <option value="openai-compatible">OpenAI-compatible</option>
                <option value="anthropic">Anthropic</option>
              </select>
            </label>
            <label>
              Display name
              <input
                aria-label="Provider display name"
                value={this.accountName}
                onChange={(event) => {
                  this.accountName = event.currentTarget.value;
                  this.update();
                }}
              />
            </label>
            <label>
              Base URL
              <input
                aria-label="Provider base URL"
                placeholder="http://localhost:11434/v1"
                value={this.accountBaseUrl}
                onChange={(event) => {
                  this.accountBaseUrl = event.currentTarget.value;
                  this.update();
                }}
              />
            </label>
            <label>
              API key
              <input
                aria-label="Provider API key"
                type="password"
                value={this.accountApiKey}
                onChange={(event) => {
                  this.accountApiKey = event.currentTarget.value;
                  this.update();
                }}
              />
            </label>
            <label className="gamecrafter-models-checkbox-label">
              <input
                aria-label="Local provider"
                type="checkbox"
                checked={this.accountIsLocal}
                onChange={(event) => {
                  this.accountIsLocal = event.currentTarget.checked;
                  this.update();
                }}
              />
              Local
            </label>
            <button
              type="submit"
              disabled={!this.accountName.trim() || !this.accountBaseUrl.trim()}
            >
              Add account
            </button>
          </form>
          {this.accounts.length === 0 ? (
            <p className="gamecrafter-page-empty">
              No provider accounts yet. Add one here, then test it and discover available models.
            </p>
          ) : (
            <div className="gamecrafter-models-table-scroll">
              <table className="gamecrafter-models-table">
                <thead>
                  <tr>
                    <th>Kind</th>
                    <th>Name</th>
                    <th>Base URL</th>
                    <th>Local/cloud</th>
                    <th>Credential</th>
                    <th>Enabled</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {this.accounts.map((account) => (
                    <tr key={account.accountId}>
                      <td>{account.providerKind}</td>
                      <td>
                        {account.displayName}
                        <div className="gamecrafter-page-hint">
                          <code>{account.accountId}</code>
                        </div>
                      </td>
                      <td>{account.baseUrl}</td>
                      <td>{account.privacy}</td>
                      <td>{account.hasCredential ? 'Yes' : 'No'}</td>
                      <td>
                        <input
                          aria-label={`Enable ${account.displayName}`}
                          type="checkbox"
                          checked={account.enabled}
                          onChange={(event) =>
                            void this.run(() =>
                              this.controlRoomService.updateProviderAccount(account.accountId, {
                                enabled: event.currentTarget.checked,
                              }),
                            )
                          }
                        />
                      </td>
                      <td>
                        <button type="button" onClick={() => void this.testAccount(account)}>
                          Test
                        </button>
                        <button
                          type="button"
                          disabled={this.busyAccounts.has(account.accountId)}
                          onClick={() => void this.discoverModels(account)}
                        >
                          Discover
                        </button>
                        <button
                          type="button"
                          disabled={this.busyAccounts.has(account.accountId)}
                          onClick={() => void this.removeAccount(account)}
                        >
                          Remove
                        </button>
                        {this.accountResults.get(account.accountId) && (
                          <span role="status">{this.accountResults.get(account.accountId)}</span>
                        )}
                        {this.renderModelSelection(account)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <section
          className="gamecrafter-models-section gamecrafter-page-panel"
          hidden={this.activeSection !== 'models'}
        >
          <h2>Models</h2>
          <p className="gamecrafter-page-section-intro">
            Enable models for routing. Expand a model's details to edit prices, capabilities, and
            routing tags.
          </p>
          {this.models.length === 0 ? (
            <p className="gamecrafter-page-empty">
              No models discovered. Open Provider accounts, test a provider, and discover its model
              list.
            </p>
          ) : (
            <div className="gamecrafter-models-table-scroll">
              <table className="gamecrafter-models-table">
                <thead>
                  <tr>
                    <th>Account</th>
                    <th>Provider model</th>
                    <th>Display name</th>
                    <th>Enabled</th>
                    <th>Capabilities and limits</th>
                    <th>Pricing and routing metadata</th>
                  </tr>
                </thead>
                <tbody>
                  {this.models.map((model) => (
                    <tr key={model.modelId}>
                      <td>
                        {this.accounts.find((account) => account.accountId === model.accountId)
                          ?.displayName ?? model.accountId}
                      </td>
                      <td>{model.providerModelId}</td>
                      <td>
                        <input
                          key={model.displayName}
                          aria-label={`Display name ${model.modelId}`}
                          defaultValue={model.displayName}
                          onBlur={(event) => {
                            const displayName = event.currentTarget.value.trim();
                            if (displayName && displayName !== model.displayName) {
                              void this.updateModel(model.modelId, { displayName });
                            }
                          }}
                        />
                      </td>
                      <td>
                        <input
                          aria-label={`Enable model ${model.modelId}`}
                          type="checkbox"
                          checked={model.enabled}
                          onChange={(event) =>
                            void this.updateModel(model.modelId, {
                              enabled: event.currentTarget.checked,
                            })
                          }
                        />
                      </td>
                      <td>
                        <details className="gamecrafter-page-advanced">
                          <summary>
                            {model.capabilities.tools ? 'Tools' : ''}
                            {model.capabilities.vision ? ' · Vision' : ''}
                            {model.capabilities.embeddings ? ' · Embeddings' : ''}
                            {!model.capabilities.tools &&
                            !model.capabilities.vision &&
                            !model.capabilities.embeddings
                              ? 'No declared capabilities'
                              : ''}
                          </summary>
                          <dl className="gamecrafter-page-meta">
                            <div className="gamecrafter-page-meta-item">
                              <dt>Tools</dt>
                              <dd>{model.capabilities.tools ? 'Yes' : 'No'}</dd>
                            </div>
                            <div className="gamecrafter-page-meta-item">
                              <dt>Vision</dt>
                              <dd>{model.capabilities.vision ? 'Yes' : 'No'}</dd>
                            </div>
                            <div className="gamecrafter-page-meta-item">
                              <dt>Embeddings</dt>
                              <dd>{model.capabilities.embeddings ? 'Yes' : 'No'}</dd>
                            </div>
                            <div className="gamecrafter-page-meta-item">
                              <dt>Context window</dt>
                              <dd>
                                {model.capabilities.contextWindow?.toLocaleString() ??
                                  'Provider-managed'}
                              </dd>
                            </div>
                            <div className="gamecrafter-page-meta-item">
                              <dt>Maximum input</dt>
                              <dd>
                                {model.capabilities.maxInputTokens?.toLocaleString() ??
                                  'Provider-managed'}
                              </dd>
                            </div>
                            <div className="gamecrafter-page-meta-item">
                              <dt>Maximum output</dt>
                              <dd>
                                {model.capabilities.maxOutputTokens?.toLocaleString() ??
                                  'Provider-managed'}
                              </dd>
                            </div>
                            <div className="gamecrafter-page-meta-item">
                              <dt>Metadata source</dt>
                              <dd>
                                {model.metadataSource} · updated{' '}
                                {new Date(model.metadataUpdatedAt).toLocaleString()}
                              </dd>
                            </div>
                          </dl>
                        </details>
                      </td>
                      <td>
                        <details className="gamecrafter-page-advanced">
                          <summary>{formatPricing(model.pricing)} · Edit routing metadata</summary>
                          {this.renderPricingEditor(model)}
                          <label>
                            Work types{' '}
                            {this.renderStringListEditor(
                              model.modelId,
                              'workTypes',
                              model.workTypes,
                            )}
                          </label>
                          <label>
                            Agent roles{' '}
                            {this.renderStringListEditor(model.modelId, 'roles', model.roles)}
                          </label>
                          <label>
                            Tags {this.renderStringListEditor(model.modelId, 'tags', model.tags)}
                          </label>
                        </details>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <section
          className="gamecrafter-models-section gamecrafter-page-panel"
          hidden={this.activeSection !== 'pools'}
        >
          <h2>Model pools</h2>
          <p className="gamecrafter-page-section-intro">
            Pools constrain model choices for platform-wide or Project-specific agents and task
            types.
          </p>
          <form
            className="gamecrafter-models-pool-form"
            onSubmit={(event) => {
              event.preventDefault();
              void this.createPool();
            }}
          >
            <label>
              Pool name
              <input
                aria-label="Pool name"
                value={this.poolName}
                onChange={(event) => {
                  this.poolName = event.currentTarget.value;
                  this.update();
                }}
              />
            </label>
            <label>
              Scope
              <select
                aria-label="Pool scope"
                value={this.poolScope}
                onChange={(event) => {
                  this.poolScope = event.currentTarget.value as 'platform' | 'project';
                  this.update();
                }}
              >
                <option value="platform">Platform</option>
                <option value="project">Project</option>
              </select>
            </label>
            <label>
              Target kind
              <select
                aria-label="Pool target kind"
                value={this.poolTargetKind}
                onChange={(event) => {
                  this.poolTargetKind = event.currentTarget.value as 'none' | 'agent' | 'task-type';
                  this.update();
                }}
              >
                <option value="none">All targets</option>
                <option value="agent">Agent role</option>
                <option value="task-type">Task type</option>
              </select>
            </label>
            {this.poolTargetKind !== 'none' && (
              <label>
                Target ID
                <input
                  aria-label="Pool target ID"
                  value={this.poolTargetId}
                  onChange={(event) => {
                    this.poolTargetId = event.currentTarget.value;
                    this.update();
                  }}
                />
              </label>
            )}
            <div className="gamecrafter-models-pool-models">
              <span>Pool models</span>
              {this.models.map((model) => (
                <label key={model.modelId}>
                  <input
                    aria-label={`Pool model ${model.modelId}`}
                    type="checkbox"
                    checked={this.poolModelIds.has(model.modelId)}
                    onChange={(event) => {
                      const next = new Set(this.poolModelIds);
                      if (event.currentTarget.checked) next.add(model.modelId);
                      else next.delete(model.modelId);
                      this.poolModelIds = next;
                      this.update();
                    }}
                  />
                  {model.displayName}
                </label>
              ))}
            </div>
            <button
              type="submit"
              disabled={
                !this.poolName.trim() ||
                this.poolModelIds.size === 0 ||
                (this.poolScope === 'project' && !this.selectedProjectId) ||
                (this.poolTargetKind !== 'none' && !this.poolTargetId.trim())
              }
            >
              Create pool
            </button>
          </form>
          {this.pools.length === 0 ? (
            <p className="gamecrafter-page-empty">
              No pools yet. Select enabled models above and create a pool for the intended scope.
            </p>
          ) : (
            <ul className="gamecrafter-models-pool-list">
              {this.pools.map((pool) => (
                <li key={pool.poolId}>
                  <span>
                    <strong>{pool.name}</strong> ({pool.scope}) — {pool.modelIds.length} models
                    {pool.target ? ` · ${pool.target.kind}: ${pool.target.id}` : ''}
                  </span>
                  <button type="button" onClick={() => void this.deletePool(pool)}>
                    Delete
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section
          className="gamecrafter-models-section gamecrafter-page-panel"
          hidden={this.activeSection !== 'decisions'}
        >
          <h2>Recent routing decisions</h2>
          {this.decisions.length === 0 ? (
            <p className="gamecrafter-page-empty">
              No routing decisions recorded for this scope yet. Decisions appear after routed model
              work.
            </p>
          ) : (
            <div className="gamecrafter-models-table-scroll">
              <table className="gamecrafter-models-table">
                <thead>
                  <tr>
                    <th>Model</th>
                    <th>Task type</th>
                    <th>Decision</th>
                    <th>Explored</th>
                    <th>Outcome</th>
                  </tr>
                </thead>
                <tbody>
                  {this.decisions.map(({ decision, outcome }) => (
                    <tr key={decision.decisionId}>
                      <td>{decision.modelId}</td>
                      <td>{decision.context.taskType}</td>
                      <td title={decision.reason}>{summarizeDecision(decision)}</td>
                      <td>{decision.explored ? 'Yes' : 'No'}</td>
                      <td>
                        {outcome
                          ? `${outcome.success ? 'Success' : 'Failure'}${outcome.qualityScore === null ? '' : ` · quality ${outcome.qualityScore}`}`
                          : 'Pending'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <section
          className="gamecrafter-models-section gamecrafter-page-panel"
          hidden={this.activeSection !== 'assessments'}
        >
          <h2>Decision assessments</h2>
          <p className="gamecrafter-page-section-intro">
            Read-only advice history. Modes and statuses are recorded per assessment; configure the
            mode in Models settings. New setups default to shadow mode.
          </p>
          <p className="gamecrafter-page-section-intro">
            Suggestions remain advisory: they do not change task labels, the eligible model pool,
            permissions, or review requirements.
          </p>
          <p className="gamecrafter-page-section-intro">
            Assessments reuse an enabled provider account and model from Models. For local
            inference, configure an OpenAI-compatible account base URL such as{' '}
            <code>http://127.0.0.1:9001/v1</code>; the adapter posts to <code>/v1/systemone</code>.
            Opening or refreshing this history does not make a provider test or paid model call.
          </p>
          {!this.selectedProjectId ? (
            <p className="gamecrafter-page-empty">
              Select a project to view its assessment history. All Projects does not request
              assessment history.
            </p>
          ) : this.decisionAssessmentsLoading ? (
            <p role="status">Loading decision assessments...</p>
          ) : this.decisionAssessmentsError ? (
            <div role="alert" className="gamecrafter-models-error">
              <p>
                Decision assessment history could not be loaded: {this.decisionAssessmentsError}
              </p>
              <button type="button" onClick={() => void this.refreshDecisionAssessments()}>
                Retry history
              </button>
            </div>
          ) : this.decisionAssessments.length === 0 ? (
            <p className="gamecrafter-page-empty">
              No assessments are recorded for this project yet. In shadow or assist mode,
              assessments are recorded when eligible task work runs; mode off makes no assessment
              calls.
            </p>
          ) : (
            <ul>
              {this.decisionAssessments.map((assessment) => (
                <li key={assessment.assessmentId}>
                  <h3>
                    {assessment.taskType} · {new Date(assessment.createdAt).toLocaleString()}
                  </h3>
                  <dl className="gamecrafter-page-meta" aria-label="Assessment summary">
                    <div className="gamecrafter-page-meta-item">
                      <dt>Mode / status</dt>
                      <dd>
                        {assessment.mode} · {assessment.status}
                        {assessment.reused ? ' · reused' : ''}
                      </dd>
                    </div>
                    <div className="gamecrafter-page-meta-item">
                      <dt>Baseline model</dt>
                      <dd>{assessment.baselineModelId ?? 'Not recorded'}</dd>
                    </div>
                    <div className="gamecrafter-page-meta-item">
                      <dt>Suggested model</dt>
                      <dd>{assessment.suggestedModelId ?? 'No recommendation'}</dd>
                    </div>
                    <div className="gamecrafter-page-meta-item">
                      <dt>Latency</dt>
                      <dd>{assessment.latencyMs.toLocaleString()} ms</dd>
                    </div>
                    <div className="gamecrafter-page-meta-item">
                      <dt>Usage</dt>
                      <dd>{formatDecisionAssessmentUsage(assessment)}</dd>
                    </div>
                    {assessment.taskId && (
                      <div className="gamecrafter-page-meta-item">
                        <dt>Task</dt>
                        <dd>{assessment.taskId}</dd>
                      </div>
                    )}
                  </dl>
                  <p>{summarizeDecisionAssessmentAdvice(assessment)}</p>
                  <details className="gamecrafter-page-advanced">
                    <summary>Assessment details</summary>
                    <MarkdownContent text={formatDecisionAssessmentDetail(assessment)} />
                  </details>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    );
  }

  private renderPricingEditor(model: Model): React.ReactNode {
    const updatePrice = (field: 'inputPerMTokUsd' | 'outputPerMTokUsd', rawValue: string) => {
      const value = rawValue.trim() === '' ? null : Number(rawValue);
      if (value !== null && (!Number.isFinite(value) || value < 0)) return;
      if (value === model.pricing[field]) return;
      void this.updateModel(model.modelId, { pricing: { ...model.pricing, [field]: value } });
    };
    return (
      <div className="gamecrafter-models-pricing">
        <span>{formatPricing(model.pricing)}</span>
        <label>
          Input $/MTok
          <input
            key={`${model.modelId}-input-${model.pricing.inputPerMTokUsd}`}
            aria-label={`Input pricing ${model.modelId}`}
            type="number"
            min={0}
            step="any"
            defaultValue={model.pricing.inputPerMTokUsd ?? ''}
            onBlur={(event) => updatePrice('inputPerMTokUsd', event.currentTarget.value)}
          />
        </label>
        <label>
          Output $/MTok
          <input
            key={`${model.modelId}-output-${model.pricing.outputPerMTokUsd}`}
            aria-label={`Output pricing ${model.modelId}`}
            type="number"
            min={0}
            step="any"
            defaultValue={model.pricing.outputPerMTokUsd ?? ''}
            onBlur={(event) => updatePrice('outputPerMTokUsd', event.currentTarget.value)}
          />
        </label>
      </div>
    );
  }

  private renderStringListEditor(
    modelId: string,
    field: 'tags' | 'workTypes' | 'roles',
    values: string[],
  ): React.ReactNode {
    return (
      <input
        key={`${modelId}-${field}-${JSON.stringify(values)}`}
        aria-label={`${field} ${modelId}`}
        defaultValue={values.join(', ')}
        onBlur={(event) => {
          const next = [
            ...new Set(
              event.currentTarget.value
                .split(',')
                .map((value) => value.trim())
                .filter(Boolean),
            ),
          ];
          if (JSON.stringify(next) !== JSON.stringify(values))
            void this.updateModel(modelId, { [field]: next });
        }}
      />
    );
  }

  private async refresh(): Promise<void> {
    const version = ++this.refreshVersion;
    try {
      const projects = await this.controlRoomService.listProjects();
      const projectId =
        (await this.resolveProjectSelection(projects, () => this.selectedProjectId)) || undefined;
      if (version !== this.refreshVersion || this.isDisposed) return;
      this.selectedProjectId = projectId;
      void this.refreshDecisionAssessments(version, projectId);
      const [accounts, models, pools, decisions] = await Promise.all([
        this.controlRoomService.listProviderAccounts(),
        this.controlRoomService.listModels(),
        this.controlRoomService.listModelPools(this.selectedProjectId),
        this.controlRoomService.listRouteDecisions(this.selectedProjectId, 30),
      ]);
      if (version !== this.refreshVersion || this.isDisposed) return;
      this.projects = projects;
      this.accounts = accounts;
      this.models = models;
      this.pools = pools;
      this.decisions = decisions;
      this.errorMessage = undefined;
    } catch (error) {
      if (version !== this.refreshVersion || this.isDisposed) return;
      this.errorMessage = error instanceof Error ? error.message : String(error);
    }
    this.update();
  }

  private async refreshDecisionAssessments(
    version = this.refreshVersion,
    projectId = this.selectedProjectId,
  ): Promise<void> {
    if (version !== this.refreshVersion || this.isDisposed) return;
    this.decisionAssessmentsError = undefined;
    if (!projectId) {
      this.decisionAssessments = [];
      this.decisionAssessmentsLoading = false;
      this.update();
      return;
    }

    this.decisionAssessmentsLoading = true;
    this.update();
    try {
      const assessments = await this.controlRoomService.listDecisionAssessments(
        projectId,
        undefined,
        30,
      );
      if (version !== this.refreshVersion || this.isDisposed) return;
      this.decisionAssessments = assessments;
    } catch (error) {
      if (version !== this.refreshVersion || this.isDisposed) return;
      this.decisionAssessmentsError = error instanceof Error ? error.message : String(error);
    } finally {
      if (version === this.refreshVersion && !this.isDisposed) {
        this.decisionAssessmentsLoading = false;
        this.update();
      }
    }
  }

  private async run(operation: () => Promise<unknown>): Promise<void> {
    try {
      this.errorMessage = undefined;
      await operation();
      await this.refresh();
    } catch (error) {
      this.errorMessage = error instanceof Error ? error.message : String(error);
      this.update();
    }
  }

  private async addAccount(): Promise<void> {
    await this.run(async () => {
      await this.controlRoomService.addProviderAccount({
        providerKind: this.accountKind,
        displayName: this.accountName.trim(),
        baseUrl: this.accountBaseUrl.trim(),
        ...(this.accountApiKey ? { apiKey: this.accountApiKey } : {}),
        isLocal: this.accountIsLocal,
      });
      this.accountApiKey = '';
      this.accountName = '';
    });
  }

  private async testAccount(account: ProviderAccount): Promise<void> {
    await this.run(async () => {
      const result = await this.controlRoomService.testProviderAccount(account.accountId);
      this.accountResults.set(
        account.accountId,
        result.ok
          ? `Connected · ${result.latencyMs} ms · ${result.discoveredModels} models`
          : (result.error ?? 'Provider test failed'),
      );
    });
  }

  private async discoverModels(account: ProviderAccount): Promise<void> {
    if (this.busyAccounts.has(account.accountId)) return;
    this.busyAccounts.add(account.accountId);
    this.update();
    try {
      await this.run(async () => {
        const result = await this.controlRoomService.discoverModels(account.accountId, {
          preview: true,
        });
        this.availableModels.set(account.accountId, result.models);
        this.selectedModels.set(account.accountId, []);
        this.accountResults.set(
          account.accountId,
          `Found ${result.models.length} available models. Choose models to add.`,
        );
      });
    } finally {
      this.busyAccounts.delete(account.accountId);
      this.update();
    }
  }

  private renderModelSelection(account: ProviderAccount): React.ReactNode {
    const available = this.availableModels.get(account.accountId);
    if (!available) return null;
    const added = new Set(
      this.models
        .filter((model) => model.accountId === account.accountId)
        .map((model) => model.providerModelId),
    );
    const choices = available.filter((model) => !added.has(model.providerModelId));
    const selected = this.selectedModels.get(account.accountId) ?? [];
    const busy = this.busyAccounts.has(account.accountId);
    return (
      <details className="gamecrafter-model-selection" open>
        <summary>Choose models ({choices.length} available to add)</summary>
        {choices.length === 0 ? (
          <p>No new models available.</p>
        ) : (
          <>
            <label>
              Models for {account.displayName}
              <select
                multiple
                size={Math.min(8, Math.max(2, choices.length))}
                aria-label={`Models to add for ${account.displayName}`}
                value={selected}
                disabled={busy}
                onChange={(event) => {
                  this.selectedModels.set(
                    account.accountId,
                    Array.from(event.currentTarget.selectedOptions, (option) => option.value),
                  );
                  this.update();
                }}
              >
                {choices.map((model) => (
                  <option key={model.providerModelId} value={model.providerModelId}>
                    {model.displayName} ({model.providerModelId})
                  </option>
                ))}
              </select>
            </label>
            <p>Use Ctrl or Command to select multiple models.</p>
            <button
              type="button"
              disabled={busy || selected.length === 0}
              onClick={() => void this.addDiscoveredModels(account, selected)}
            >
              Add selected ({selected.length})
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() =>
                void this.addDiscoveredModels(
                  account,
                  choices.map((model) => model.providerModelId),
                )
              }
            >
              Add all ({choices.length})
            </button>
          </>
        )}
      </details>
    );
  }

  private async addDiscoveredModels(
    account: ProviderAccount,
    providerModelIds: string[],
  ): Promise<void> {
    if (this.busyAccounts.has(account.accountId) || providerModelIds.length === 0) return;
    this.busyAccounts.add(account.accountId);
    this.update();
    try {
      await this.run(async () => {
        const result = await this.controlRoomService.discoverModels(account.accountId, {
          providerModelIds,
        });
        this.selectedModels.set(account.accountId, []);
        this.accountResults.set(
          account.accountId,
          `Added ${result.added}, updated ${result.updated}`,
        );
      });
    } finally {
      this.busyAccounts.delete(account.accountId);
      this.update();
    }
  }

  private async removeAccount(account: ProviderAccount): Promise<void> {
    await this.run(async () => {
      await this.controlRoomService.removeProviderAccount(account.accountId);
      this.availableModels.delete(account.accountId);
      this.selectedModels.delete(account.accountId);
      this.accountResults.delete(account.accountId);
    });
  }

  private async updateModel(
    modelId: string,
    patch: Parameters<ControlRoomServiceApi['updateModel']>[1],
  ): Promise<void> {
    await this.run(() => this.controlRoomService.updateModel(modelId, patch));
  }

  private async createPool(): Promise<void> {
    const target: ModelPoolTarget | null =
      this.poolTargetKind === 'none'
        ? null
        : { kind: this.poolTargetKind, id: this.poolTargetId.trim() };
    await this.run(async () => {
      await this.controlRoomService.createModelPool({
        name: this.poolName.trim(),
        scope: this.poolScope,
        ...(this.poolScope === 'project' && this.selectedProjectId
          ? { projectId: this.selectedProjectId }
          : {}),
        target,
        modelIds: [...this.poolModelIds],
      });
      this.poolName = '';
      this.poolTargetId = '';
      this.poolModelIds = new Set();
    });
  }

  private async deletePool(pool: ModelPool): Promise<void> {
    await this.run(() => this.controlRoomService.deleteModelPool(pool.poolId));
  }
}

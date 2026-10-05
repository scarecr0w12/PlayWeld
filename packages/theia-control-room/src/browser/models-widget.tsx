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

const PROVIDER_PRESETS: Record<ProviderKind, { label: string; baseUrl: string; isLocal: boolean }> =
  {
    'openai-compatible': {
      label: 'OpenAI-compatible endpoint',
      baseUrl: 'http://localhost:11434/v1',
      isLocal: true,
    },
    openai: { label: 'OpenAI', baseUrl: 'https://api.openai.com/v1', isLocal: false },
    anthropic: { label: 'Anthropic', baseUrl: 'https://api.anthropic.com', isLocal: false },
    'google-gemini': {
      label: 'Google Gemini',
      baseUrl: 'https://generativelanguage.googleapis.com/v1beta',
      isLocal: false,
    },
    openrouter: { label: 'OpenRouter', baseUrl: 'https://openrouter.ai/api/v1', isLocal: false },
    xai: { label: 'xAI', baseUrl: 'https://api.x.ai/v1', isLocal: false },
    mistral: { label: 'Mistral', baseUrl: 'https://api.mistral.ai/v1', isLocal: false },
    deepseek: { label: 'DeepSeek', baseUrl: 'https://api.deepseek.com', isLocal: false },
    groq: { label: 'Groq', baseUrl: 'https://api.groq.com/openai/v1', isLocal: false },
    'azure-openai': {
      label: 'Azure OpenAI',
      baseUrl: 'https://your-resource.openai.azure.com',
      isLocal: false,
    },
  };

const BOOLEAN_CAPABILITIES = [
  ['chat', 'Chat'],
  ['tools', 'Tool calling'],
  ['vision', 'Vision'],
  ['structuredOutput', 'Structured output'],
  ['streaming', 'Streaming'],
  ['embeddings', 'Embeddings'],
] as const;

const TOKEN_LIMIT_CAPABILITIES = [
  ['contextWindow', 'Context window'],
  ['maxInputTokens', 'Maximum input tokens'],
  ['maxOutputTokens', 'Maximum output tokens'],
] as const;

function parseHeaderLines(text: string): Record<string, string> {
  const headers: Record<string, string> = {};
  const names = new Set<string>();
  for (const [index, line] of text.split(/\r?\n/).entries()) {
    const value = line.trim();
    if (!value) continue;
    const colon = value.indexOf(':');
    if (colon < 1 || !value.slice(0, colon).trim()) {
      throw new Error(`Invalid custom header on line ${index + 1}; use "Name: value".`);
    }
    const name = value.slice(0, colon).trim();
    if (!/^[!#$%&'*+.^_`|~0-9A-Za-z-]+$/.test(name)) {
      throw new Error(`Invalid HTTP header name on line ${index + 1}.`);
    }
    if (names.has(name.toLowerCase())) {
      throw new Error(`Duplicate HTTP header on line ${index + 1}.`);
    }
    names.add(name.toLowerCase());
    headers[name] = value.slice(colon + 1).trim();
  }
  return headers;
}

function capabilityLabel(value: boolean | null): string {
  return value === true ? 'Supported' : value === false ? 'Unsupported' : 'Unknown';
}

function safeMetadataUrl(value: string | null): string | undefined {
  if (!value) return undefined;
  try {
    const url = new URL(value);
    return url.protocol === 'https:' || url.protocol === 'http:' ? url.href : undefined;
  } catch {
    return undefined;
  }
}

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
  private accountHeaders = '';
  private accountIsLocal = true;
  private accountApiVersion = '2024-10-21';
  private accountDeploymentName = '';
  private accountCatalogModelId = '';
  private editingAccountId?: string;
  private editAccountName = '';
  private editAccountBaseUrl = '';
  private editAccountApiKey = '';
  private editAccountHeaders = '';
  private editAccountHeadersChanged = false;
  private editAccountIsLocal = false;
  private editAccountApiVersion = '2024-10-21';
  private editAccountDeploymentName = '';
  private editAccountCatalogModelId = '';
  private editAccountRemoveCredentials = false;
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
                onChange={(event) =>
                  this.selectAccountKind(event.currentTarget.value as ProviderKind)
                }
              >
                {(Object.keys(PROVIDER_PRESETS) as ProviderKind[]).map((kind) => (
                  <option key={kind} value={kind}>
                    {PROVIDER_PRESETS[kind].label}
                  </option>
                ))}
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
              API key (stored encrypted)
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
            <label>
              Custom headers (one per line, Name: value)
              <textarea
                aria-label="Provider custom headers"
                value={this.accountHeaders}
                onChange={(event) => {
                  this.accountHeaders = event.currentTarget.value;
                  this.update();
                }}
                rows={3}
                spellCheck={false}
              />
            </label>
            {this.accountKind === 'azure-openai' && (
              <fieldset className="gamecrafter-models-provider-options">
                <legend>Azure deployment options</legend>
                <label>
                  Deployment name (required for classic endpoint)
                  <input
                    aria-label="Azure deployment name"
                    value={this.accountDeploymentName}
                    onChange={(event) => {
                      this.accountDeploymentName = event.currentTarget.value;
                      this.update();
                    }}
                  />
                </label>
                {!this.accountBaseUrl.includes('/openai/v1') && (
                  <label>
                    Base model ID for catalog matching (optional)
                    <input
                      aria-label="Azure catalog model ID"
                      value={this.accountCatalogModelId}
                      onChange={(event) => {
                        this.accountCatalogModelId = event.currentTarget.value;
                        this.update();
                      }}
                    />
                  </label>
                )}
                <label>
                  API version
                  <input
                    aria-label="Azure API version"
                    value={this.accountApiVersion}
                    onChange={(event) => {
                      this.accountApiVersion = event.currentTarget.value;
                      this.update();
                    }}
                  />
                </label>
                <p className="gamecrafter-page-hint">
                  The deployment name is the callable model ID. Catalog metadata is matched
                  separately and does not prove a deployment is available.
                </p>
              </fieldset>
            )}
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
              disabled={
                !this.accountName.trim() ||
                !this.accountBaseUrl.trim() ||
                (this.accountKind === 'azure-openai' &&
                  !this.accountBaseUrl.includes('/openai/v1') &&
                  !this.accountDeploymentName.trim())
              }
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
                      <td>
                        {PROVIDER_PRESETS[account.providerKind].label}
                        {account.providerKind === 'azure-openai' && (
                          <div className="gamecrafter-page-hint">
                            {account.providerOptions.deploymentName
                              ? `Deployment: ${account.providerOptions.deploymentName}`
                              : 'Deployment aliases from v1 endpoint'}
                          </div>
                        )}
                      </td>
                      <td>
                        {account.displayName}
                        <div className="gamecrafter-page-hint">
                          <code>{account.accountId}</code>
                        </div>
                      </td>
                      <td>{account.baseUrl}</td>
                      <td>{account.privacy}</td>
                      <td>
                        {account.hasCredential ? 'Stored' : 'None'}
                        {Object.keys(account.headers).length > 0 && (
                          <div className="gamecrafter-page-hint">
                            {Object.keys(account.headers).length} custom header(s)
                          </div>
                        )}
                      </td>
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
                        <button type="button" onClick={() => this.beginEditAccount(account)}>
                          {this.editingAccountId === account.accountId ? 'Editing' : 'Edit'}
                        </button>
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
                        {this.renderAccountEditor(account)}
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
                      <td>
                        <code>{model.providerModelId}</code>
                        {model.catalogModelId && model.catalogModelId !== model.providerModelId && (
                          <div className="gamecrafter-page-hint">
                            Catalog model: <code>{model.catalogModelId}</code>
                          </div>
                        )}
                        {this.accounts.find((account) => account.accountId === model.accountId)
                          ?.providerKind === 'azure-openai' && (
                          <label className="gamecrafter-page-hint">
                            Azure base model ID
                            <input
                              key={`${model.modelId}-catalog-${model.catalogModelId ?? ''}`}
                              aria-label={`Catalog model ID ${model.modelId}`}
                              defaultValue={model.catalogModelId ?? ''}
                              placeholder="Match the deployed base model"
                              onBlur={(event) => {
                                const catalogModelId = event.currentTarget.value.trim() || null;
                                if (catalogModelId !== model.catalogModelId) {
                                  void this.updateModel(model.modelId, { catalogModelId });
                                }
                              }}
                            />
                          </label>
                        )}
                      </td>
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
                          <summary>{this.capabilitySummary(model)}</summary>
                          {this.renderCapabilitiesEditor(model)}
                          <dl className="gamecrafter-page-meta">
                            <div className="gamecrafter-page-meta-item">
                              <dt>Context window</dt>
                              <dd>
                                {model.capabilities.contextWindow?.toLocaleString() ?? 'Unknown'}
                              </dd>
                            </div>
                            <div className="gamecrafter-page-meta-item">
                              <dt>Maximum input</dt>
                              <dd>
                                {model.capabilities.maxInputTokens?.toLocaleString() ?? 'Unknown'}
                              </dd>
                            </div>
                            <div className="gamecrafter-page-meta-item">
                              <dt>Maximum output</dt>
                              <dd>
                                {model.capabilities.maxOutputTokens?.toLocaleString() ?? 'Unknown'}
                              </dd>
                            </div>
                          </dl>
                          {model.capabilities.vision === true && (
                            <p className="gamecrafter-page-hint">
                              Provider-declared vision is not currently routable: the shared chat
                              request accepts text only.
                            </p>
                          )}
                          {model.capabilities.embeddings === true && (
                            <p className="gamecrafter-page-hint">
                              Embeddings are available through the dedicated embedding operation,
                              not chat-model routing.
                            </p>
                          )}
                          {this.renderFieldProvenance(model)}
                        </details>
                      </td>
                      <td>
                        <details className="gamecrafter-page-advanced">
                          <summary>{formatPricing(model.pricing)} · Edit routing metadata</summary>
                          {this.renderPricingEditor(model)}
                          <label>
                            Work types ({this.describeMetadataSource(model, 'workTypes')}){' '}
                            {this.renderStringListEditor(
                              model.modelId,
                              'workTypes',
                              model.workTypes,
                            )}
                          </label>
                          <label>
                            Agent roles ({this.describeMetadataSource(model, 'roles')}){' '}
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
      void this.updateModel(model.modelId, { pricing: { [field]: value } });
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

  private capabilitySummary(model: Model): string {
    const supported = BOOLEAN_CAPABILITIES.filter(
      ([field]) => model.capabilities[field] === true,
    ).length;
    const unknown = BOOLEAN_CAPABILITIES.filter(
      ([field]) => model.capabilities[field] === null,
    ).length;
    return `${supported} supported · ${unknown} unknown · ${BOOLEAN_CAPABILITIES.length - supported - unknown} unsupported`;
  }

  private renderCapabilitiesEditor(model: Model): React.ReactNode {
    return (
      <fieldset className="gamecrafter-models-capabilities">
        <legend>Declared capabilities</legend>
        <p className="gamecrafter-page-hint">
          Unknown clears a manual override; a later discovery can fill it from provider or catalog
          metadata.
        </p>
        {BOOLEAN_CAPABILITIES.map(([field, label]) => (
          <label key={field}>
            {label}
            <select
              aria-label={`${label} capability ${model.modelId}`}
              value={
                model.capabilities[field] === null
                  ? 'unknown'
                  : model.capabilities[field]
                    ? 'supported'
                    : 'unsupported'
              }
              onChange={(event) => {
                const value =
                  event.currentTarget.value === 'unknown'
                    ? null
                    : event.currentTarget.value === 'supported';
                void this.updateModel(model.modelId, { capabilities: { [field]: value } });
              }}
            >
              <option value="unknown">Unknown (use discovered value on refresh)</option>
              <option value="supported">{capabilityLabel(true)}</option>
              <option value="unsupported">{capabilityLabel(false)}</option>
            </select>
          </label>
        ))}
        {TOKEN_LIMIT_CAPABILITIES.map(([field, label]) => (
          <label key={field}>
            {label} ({this.describeMetadataSource(model, `capabilities.${field}`)})
            <input
              key={`${model.modelId}-${field}-${model.capabilities[field] ?? ''}`}
              aria-label={`${label} ${model.modelId}`}
              type="number"
              min={0}
              step={1}
              defaultValue={model.capabilities[field] ?? ''}
              placeholder="Unknown"
              onBlur={(event) => {
                const rawValue = event.currentTarget.value.trim();
                const currentValue = model.capabilities[field] ?? null;
                if (!rawValue) {
                  if (currentValue !== null) {
                    void this.updateModel(model.modelId, { capabilities: { [field]: null } });
                  }
                  return;
                }
                const value = Number(rawValue);
                if (!Number.isInteger(value) || value < 0 || value === currentValue) return;
                void this.updateModel(model.modelId, { capabilities: { [field]: value } });
              }}
            />
          </label>
        ))}
      </fieldset>
    );
  }

  private renderFieldProvenance(model: Model): React.ReactNode {
    const fields = Object.entries(model.metadataFields).sort(([left], [right]) =>
      left.localeCompare(right),
    );
    return (
      <details className="gamecrafter-page-advanced">
        <summary>Per-field sources ({fields.length})</summary>
        {fields.length === 0 ? (
          <p>
            No per-field source is recorded. Legacy metadata source: {model.metadataSource}; record
            updated {new Date(model.metadataUpdatedAt).toLocaleString()}.
          </p>
        ) : (
          <ul className="gamecrafter-models-field-sources">
            {fields.map(([field, metadata]) => {
              const sourceUrl = safeMetadataUrl(metadata.sourceUrl);
              return (
                <li key={field}>
                  <strong>{field}</strong> · {metadata.source} · {metadata.confidence} confidence ·{' '}
                  {new Date(metadata.updatedAt).toLocaleString()}
                  {sourceUrl && (
                    <>
                      {' · '}
                      <a href={sourceUrl} target="_blank" rel="noreferrer">
                        Source
                      </a>
                    </>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </details>
    );
  }

  private describeMetadataSource(model: Model, field: string): string {
    const metadata = model.metadataFields[field];
    if (!metadata) return 'unrestricted';
    if (metadata.source === 'manual') return 'manual override';
    if (metadata.source === 'account-config') return 'account setting';
    if (metadata.source === 'derived') return `auto-applied · ${metadata.confidence} confidence`;
    return `${metadata.source} · ${metadata.confidence} confidence`;
  }

  private renderAccountEditor(account: ProviderAccount): React.ReactNode {
    if (this.editingAccountId !== account.accountId) return null;
    const isAzure = account.providerKind === 'azure-openai';
    const isAzureV1 = this.editAccountBaseUrl.includes('/openai/v1');
    return (
      <form
        className="gamecrafter-models-account-editor"
        onSubmit={(event) => {
          event.preventDefault();
          void this.saveAccountEdit(account);
        }}
      >
        <label>
          Display name
          <input
            aria-label={`Edit account name ${account.displayName}`}
            value={this.editAccountName}
            onChange={(event) => {
              this.editAccountName = event.currentTarget.value;
              this.update();
            }}
          />
        </label>
        <label>
          Base URL
          <input
            aria-label={`Edit account URL ${account.displayName}`}
            value={this.editAccountBaseUrl}
            onChange={(event) => {
              this.editAccountBaseUrl = event.currentTarget.value;
              this.update();
            }}
          />
        </label>
        <label>
          Replace API key (leave blank to keep existing)
          <input
            aria-label={`Replace API key ${account.displayName}`}
            type="password"
            value={this.editAccountApiKey}
            onChange={(event) => {
              this.editAccountApiKey = event.currentTarget.value;
              this.update();
            }}
          />
        </label>
        {account.hasCredential && (
          <label className="gamecrafter-models-checkbox-label">
            <input
              aria-label={`Remove stored credentials ${account.displayName}`}
              type="checkbox"
              checked={this.editAccountRemoveCredentials}
              onChange={(event) => {
                this.editAccountRemoveCredentials = event.currentTarget.checked;
                this.update();
              }}
            />
            Remove stored credentials (API key and custom headers)
          </label>
        )}
        <label>
          Replace custom headers (secret values stay redacted)
          <textarea
            aria-label={`Edit custom headers ${account.displayName}`}
            value={this.editAccountHeaders}
            rows={3}
            spellCheck={false}
            onChange={(event) => {
              this.editAccountHeaders = event.currentTarget.value;
              this.editAccountHeadersChanged = true;
              this.update();
            }}
          />
        </label>
        {isAzure && (
          <fieldset className="gamecrafter-models-provider-options">
            <legend>Azure deployment options</legend>
            {!isAzureV1 && (
              <label>
                Deployment name
                <input
                  aria-label={`Azure deployment name ${account.displayName}`}
                  value={this.editAccountDeploymentName}
                  onChange={(event) => {
                    this.editAccountDeploymentName = event.currentTarget.value;
                    this.update();
                  }}
                />
              </label>
            )}
            {!isAzureV1 && (
              <label>
                Base model ID for catalog matching
                <input
                  aria-label={`Azure catalog model ID ${account.displayName}`}
                  value={this.editAccountCatalogModelId}
                  onChange={(event) => {
                    this.editAccountCatalogModelId = event.currentTarget.value;
                    this.update();
                  }}
                />
              </label>
            )}
            <label>
              API version
              <input
                aria-label={`Azure API version ${account.displayName}`}
                value={this.editAccountApiVersion}
                onChange={(event) => {
                  this.editAccountApiVersion = event.currentTarget.value;
                  this.update();
                }}
              />
            </label>
          </fieldset>
        )}
        <label className="gamecrafter-models-checkbox-label">
          <input
            aria-label={`Local account ${account.displayName}`}
            type="checkbox"
            checked={this.editAccountIsLocal}
            onChange={(event) => {
              this.editAccountIsLocal = event.currentTarget.checked;
              this.update();
            }}
          />
          Local
        </label>
        <button
          type="submit"
          disabled={
            !this.editAccountName.trim() ||
            !this.editAccountBaseUrl.trim() ||
            (isAzure && !isAzureV1 && !this.editAccountDeploymentName.trim())
          }
        >
          Save account
        </button>
        <button type="button" onClick={() => this.cancelEditAccount()}>
          Cancel
        </button>
      </form>
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

  private selectAccountKind(kind: ProviderKind): void {
    const currentPreset = PROVIDER_PRESETS[this.accountKind];
    if (this.accountBaseUrl === currentPreset.baseUrl) {
      this.accountBaseUrl = PROVIDER_PRESETS[kind].baseUrl;
    }
    this.accountKind = kind;
    this.accountIsLocal = PROVIDER_PRESETS[kind].isLocal;
    if (kind === 'azure-openai') {
      this.accountApiVersion = '2024-10-21';
      this.accountDeploymentName = '';
      this.accountCatalogModelId = '';
    }
    this.update();
  }

  private newAccountProviderOptions(): Record<string, string> {
    if (this.accountKind !== 'azure-openai') return {};
    return {
      ...(this.accountDeploymentName.trim()
        ? { deploymentName: this.accountDeploymentName.trim() }
        : {}),
      ...(this.accountCatalogModelId.trim()
        ? { catalogModelId: this.accountCatalogModelId.trim() }
        : {}),
      ...(this.accountApiVersion.trim() ? { apiVersion: this.accountApiVersion.trim() } : {}),
    };
  }

  private async addAccount(): Promise<void> {
    await this.run(async () => {
      await this.controlRoomService.addProviderAccount({
        providerKind: this.accountKind,
        displayName: this.accountName.trim(),
        baseUrl: this.accountBaseUrl.trim(),
        providerOptions: this.newAccountProviderOptions(),
        ...(this.accountApiKey ? { apiKey: this.accountApiKey } : {}),
        headers: parseHeaderLines(this.accountHeaders),
        isLocal: this.accountIsLocal,
      });
      this.accountApiKey = '';
      this.accountHeaders = '';
      this.accountName = '';
    });
  }

  private beginEditAccount(account: ProviderAccount): void {
    if (this.editingAccountId === account.accountId) {
      this.cancelEditAccount();
      return;
    }
    this.editingAccountId = account.accountId;
    this.editAccountName = account.displayName;
    this.editAccountBaseUrl = account.baseUrl;
    this.editAccountApiKey = '';
    this.editAccountHeaders = Object.entries(account.headers)
      .map(([name, value]) => `${name}: ${value}`)
      .join('\n');
    this.editAccountHeadersChanged = false;
    this.editAccountIsLocal = account.isLocal;
    this.editAccountApiVersion = account.providerOptions.apiVersion ?? '2024-10-21';
    this.editAccountDeploymentName = account.providerOptions.deploymentName ?? '';
    this.editAccountCatalogModelId = account.providerOptions.catalogModelId ?? '';
    this.editAccountRemoveCredentials = false;
    this.update();
  }

  private cancelEditAccount(): void {
    this.editingAccountId = undefined;
    this.editAccountApiKey = '';
    this.editAccountHeaders = '';
    this.editAccountHeadersChanged = false;
    this.editAccountRemoveCredentials = false;
    this.update();
  }

  private async saveAccountEdit(account: ProviderAccount): Promise<void> {
    await this.run(async () => {
      const patch: Parameters<ControlRoomServiceApi['updateProviderAccount']>[1] = {
        displayName: this.editAccountName.trim(),
        baseUrl: this.editAccountBaseUrl.trim(),
        isLocal: this.editAccountIsLocal,
        ...(this.editAccountRemoveCredentials
          ? { apiKey: null, headers: {} }
          : this.editAccountApiKey
            ? { apiKey: this.editAccountApiKey }
            : {}),
        ...(!this.editAccountRemoveCredentials && this.editAccountHeadersChanged
          ? { headers: parseHeaderLines(this.editAccountHeaders) }
          : {}),
      };
      if (account.providerKind === 'azure-openai') {
        patch.providerOptions = {
          ...(this.editAccountDeploymentName.trim()
            ? { deploymentName: this.editAccountDeploymentName.trim() }
            : {}),
          ...(this.editAccountCatalogModelId.trim()
            ? { catalogModelId: this.editAccountCatalogModelId.trim() }
            : {}),
          ...(this.editAccountApiVersion.trim()
            ? { apiVersion: this.editAccountApiVersion.trim() }
            : {}),
        };
      }
      await this.controlRoomService.updateProviderAccount(account.accountId, patch);
      this.cancelEditAccount();
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
                    {model.displayName} ({model.providerModelId}) · {this.capabilitySummary(model)}
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

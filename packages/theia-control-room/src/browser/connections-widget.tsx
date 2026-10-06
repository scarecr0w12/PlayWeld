import React from 'react';
import { inject, injectable } from '@theia/core/shared/inversify';
import { Message } from '@theia/core/lib/browser/widgets/widget';
import { ControlRoomReactWidget } from './control-room-react-widget';
import { QuickInputService } from '@theia/core/lib/common/quick-pick-service';
import type {
  A2AAgentCardSummary,
  A2AAuthKind,
  A2AInboundClient,
  A2AInboundConfig,
  A2AOutboundAuthInput,
  A2AOutboundConnection,
  A2AProjectGrant,
  ExecutionMode,
  McpConnectionInput,
  McpConnectionListEntry,
  McpConnectionLogEntry,
  ProjectSummary,
  RoleRecord,
  RpcNotificationParams,
  SideEffect,
  ToolDefinition,
} from '@gamecrafter/contracts';
import {
  ControlRoomService,
  type ControlRoomService as ControlRoomServiceApi,
} from '../common/control-room-protocol';
import { ControlRoomClientEvents } from './control-room-client';

type McpMode = 'command' | 'endpoint' | 'docker';
type EndpointTransport = 'streamable-http' | 'legacy-sse';
type DockerTransport = 'stdio' | 'streamable-http';
type ConnectionsSection = 'servers' | 'add' | 'tools' | 'logs' | 'a2a';
type A2ATaskPermission = A2AProjectGrant['permissions'][number];
const A2A_PERMISSIONS: Array<[A2ATaskPermission, string]> = [
  ['create', 'Create tasks'],
  ['get', 'Read task status/results'],
  ['continue', 'Answer task questions / continue'],
  ['stream', 'Stream task updates'],
  ['cancel', 'Cancel tasks'],
];
type ConnectionFormField =
  | 'connectionName'
  | 'scope'
  | 'mode'
  | 'tags'
  | 'command'
  | 'commandArgs'
  | 'commandEnv'
  | 'endpointUrl'
  | 'endpointTransport'
  | 'endpointHeaders'
  | 'dockerImage'
  | 'dockerCommand'
  | 'dockerTransport'
  | 'dockerPort'
  | 'dockerMounts'
  | 'dockerEnv'
  | 'dockerNetwork'
  | 'dockerPullPolicy'
  | 'allowServerInitiatedModelCalls'
  | 'credentialsJson';

@injectable()
export class ConnectionsWidget extends ControlRoomReactWidget {
  static readonly ID = 'gamecrafter.connections';

  private projects: ProjectSummary[] = [];
  private selectedProjectId?: string;
  private refreshVersion = 0;
  private connections: McpConnectionListEntry[] = [];
  private tools = new Map<string, ToolDefinition[]>();
  private logs = new Map<string, McpConnectionLogEntry[]>();
  private logConnectionId?: string;
  private activeSection: ConnectionsSection = 'servers';
  private errorMessage?: string;
  private resultMessage?: string;
  private connectionName = '';
  private scope: 'platform' | 'project' = 'platform';
  private mode: McpMode = 'command';
  private tags = '';
  private command = '';
  private commandArgs = '';
  private commandEnv = '{}';
  private endpointUrl = '';
  private endpointTransport: EndpointTransport = 'streamable-http';
  private endpointHeaders = '{}';
  private dockerImage = '';
  private dockerCommand = '';
  private dockerTransport: DockerTransport = 'stdio';
  private dockerPort = '';
  private dockerMounts = '[]';
  private dockerEnv = '{}';
  private dockerNetwork: 'none' | 'bridge' | 'host' = 'none';
  private dockerPullPolicy: 'if-missing' | 'always' | 'never' = 'if-missing';
  private allowServerInitiatedModelCalls = false;
  private credentialsJson = '{}';
  private busy = false;
  private a2aConnections: A2AOutboundConnection[] = [];
  private a2aInboundConfig?: A2AInboundConfig;
  private a2aInboundClients: A2AInboundClient[] = [];
  private a2aRoles: RoleRecord[] = [];
  private a2aView: 'outbound' | 'inbound' = 'outbound';
  private a2aOutboundName = '';
  private a2aEndpoint = '';
  private a2aAuthKind: A2AAuthKind = 'none';
  private a2aHeaderName = 'x-api-key';
  private a2aApiKey = '';
  private a2aBearer = '';
  private a2aUsername = '';
  private a2aPassword = '';
  private a2aCustomHeaders = '{}';
  private a2aInboundEnabled = false;
  private a2aPort = '8765';
  private a2aClientName = '';
  private a2aEditingClientId?: string;
  private a2aGrantProjectId = '';
  private a2aGrantRole = '';
  private a2aPermissions: A2ATaskPermission[] = ['create', 'get', 'continue', 'stream', 'cancel'];
  private a2aDraftGrants: A2AProjectGrant[] = [];
  private issuedA2AToken?: { clientId: string; token: string };

  constructor(
    @inject(ControlRoomService)
    private readonly service: ControlRoomServiceApi,
    @inject(ControlRoomClientEvents)
    private readonly clientEvents: ControlRoomClientEvents,
    @inject(QuickInputService)
    private readonly quickInput: QuickInputService,
  ) {
    super();
    this.id = ConnectionsWidget.ID;
    this.title.label = 'Connections';
    this.title.iconClass = 'codicon codicon-plug';
    this.title.closable = true;
    this.toDispose.push(
      this.clientEvents.mcpStateChanged(({ state }) => {
        this.connections = this.connections.map((entry) =>
          entry.config.connectionId === state.connectionId ? { ...entry, state } : entry,
        );
        this.update();
      }),
    );
    this.toDispose.push(
      this.clientEvents.mcpInputRequired((request) => {
        void this.answerInputRequest(request).catch((error: unknown) => {
          this.errorMessage = errorMessage(error);
          this.update();
        });
      }),
    );
    void this.refresh();
  }

  protected onActivateRequest(message: Message): void {
    super.onActivateRequest(message);
    void this.refresh();
  }

  protected render(): React.ReactNode {
    const connectedCount = this.connections.filter(
      (entry) => entry.state.status === 'connected',
    ).length;
    const disconnectedCount = this.connections.length - connectedCount;
    return (
      <div className="gamecrafter-connections gamecrafter-surface">
        <header className="gamecrafter-connections-header gamecrafter-page-header">
          <div>
            <h1>Connections</h1>
            <p>
              Manage MCP server access, connect outbound A2A agents, and control scoped inbound
              delegation.
            </p>
          </div>
          <button type="button" disabled={this.busy} onClick={() => void this.refresh()}>
            Refresh
          </button>
        </header>

        <div className="gamecrafter-connections-context gamecrafter-page-meta">
          <label>
            Scope
            <select
              aria-label="Connections Project"
              value={this.selectedProjectId ?? ''}
              onChange={(event) => {
                this.markProjectSelection();
                this.selectedProjectId = event.currentTarget.value || undefined;
                this.scope = this.selectedProjectId ? 'project' : 'platform';
                this.connections = [];
                this.tools.clear();
                this.logs.clear();
                this.logConnectionId = undefined;
                void this.refresh();
              }}
            >
              <option value="">Platform connections</option>
              {this.projects.map((project) => (
                <option key={project.projectId} value={project.projectId}>
                  {project.name}
                </option>
              ))}
            </select>
          </label>
          <span className="gamecrafter-page-meta-item">
            Connection scope <strong>{this.selectedProjectId ? 'Project' : 'Platform'}</strong>
          </span>
          <span className="gamecrafter-page-meta-item">
            Servers <strong>{this.connections.length}</strong>
          </span>
          <span className="gamecrafter-page-meta-item">
            Connected <strong>{connectedCount}</strong>
          </span>
          <span className="gamecrafter-page-meta-item">
            Needs connection <strong>{disconnectedCount}</strong>
          </span>
        </div>

        {this.errorMessage && (
          <p className="gamecrafter-connections-error" role="alert">
            {this.errorMessage}
          </p>
        )}
        {this.resultMessage && (
          <p className="gamecrafter-connections-result" role="status">
            {this.resultMessage}
          </p>
        )}

        <section
          className="gamecrafter-work-guidance gamecrafter-page-guidance"
          aria-label="Connections next steps"
        >
          <div>
            <strong>What to do next</strong>
            <p>
              {this.connections.length === 0
                ? 'Add a trusted MCP server to discover tools for this scope.'
                : connectedCount === 0
                  ? 'Connect a configured server to discover its tools and inspect their safety metadata.'
                  : 'Review each discovered tool’s side effects and execution mode before relying on it.'}
            </p>
          </div>
          {this.connections.length === 0 ? (
            <button type="button" onClick={() => this.activateSection('add')}>
              Add connection
            </button>
          ) : (
            <button
              type="button"
              onClick={() => this.activateSection(connectedCount ? 'tools' : 'servers')}
            >
              {connectedCount ? 'Review tool safety' : 'Connect a server'}
            </button>
          )}
        </section>

        <nav className="gamecrafter-section-nav" aria-label="Connection views">
          {(
            [
              ['servers', 'Servers', this.connections.length],
              ['add', 'Add connection', 0],
              [
                'tools',
                'Tool safety',
                Array.from(this.tools.values()).reduce((sum, tools) => sum + tools.length, 0),
              ],
              [
                'logs',
                'Logs',
                this.logConnectionId ? (this.logs.get(this.logConnectionId)?.length ?? 0) : 0,
              ],
              ['a2a', 'A2A agents', this.a2aConnections.length + this.a2aInboundClients.length],
            ] as const
          ).map(([section, label, count]) => (
            <button
              key={section}
              type="button"
              aria-pressed={this.activeSection === section}
              onClick={() => this.activateSection(section)}
            >
              {label} <span className="gamecrafter-count">{count}</span>
            </button>
          ))}
        </nav>

        <section
          className="gamecrafter-connections-section gamecrafter-page-panel"
          hidden={this.activeSection !== 'servers'}
        >
          <h2>Configured servers</h2>
          {this.connections.length === 0 ? (
            <div className="gamecrafter-page-empty">
              <p>No MCP connections are configured for this scope.</p>
              <button type="button" onClick={() => this.activateSection('add')}>
                Configure a connection
              </button>
            </div>
          ) : (
            <div className="gamecrafter-connections-table-scroll">
              <table className="gamecrafter-connections-table">
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Scope / Mode</th>
                    <th>Connection metadata</th>
                    <th>Status</th>
                    <th>Tools</th>
                    <th>Last error</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {this.connections.map(({ config, state }) => (
                    <tr key={config.connectionId}>
                      <td>{config.name}</td>
                      <td>
                        {config.scope} / {config.mode}
                      </td>
                      <td>
                        <span className="gamecrafter-page-meta-item">
                          Revision {state.negotiatedRevision ?? '—'}
                        </span>
                        {state.legacy && (
                          <span className="gamecrafter-page-meta-item">Legacy protocol</span>
                        )}
                        {config.mode === 'docker' && (
                          <span className="gamecrafter-page-meta-item">
                            Network {config.docker.network} · {config.docker.mounts.length} mounts
                          </span>
                        )}
                        {state.containerId && <code>{state.containerId}</code>}
                      </td>
                      <td>
                        <span
                          className={`gamecrafter-connection-status gamecrafter-connection-status-${state.status}`}
                        >
                          {state.status}
                        </span>
                      </td>
                      <td>{state.toolCount}</td>
                      <td>{state.lastError ?? '—'}</td>
                      <td className="gamecrafter-connection-actions">
                        {state.status === 'connected' ? (
                          <button
                            type="button"
                            onClick={() => void this.disconnect(config.connectionId)}
                          >
                            Disconnect
                          </button>
                        ) : (
                          <button
                            type="button"
                            disabled={this.busy}
                            onClick={() => void this.connect(config.connectionId)}
                          >
                            Connect
                          </button>
                        )}
                        <button
                          type="button"
                          disabled={state.status !== 'connected'}
                          onClick={() =>
                            void this.withBusy(() => this.refreshTools(config.connectionId))
                          }
                        >
                          Refresh tools
                        </button>
                        <button
                          type="button"
                          onClick={() => void this.loadLogs(config.connectionId)}
                        >
                          Logs
                        </button>
                        <button
                          type="button"
                          disabled={this.busy}
                          onClick={() => void this.remove(config.connectionId)}
                        >
                          Remove
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <section
          className="gamecrafter-connections-section gamecrafter-page-panel"
          hidden={this.activeSection !== 'tools'}
        >
          <h2>Tool safety</h2>
          <p>
            Classify each discovered tool’s side effects and execution mode before agents or
            workflows use it.
          </p>
          {Array.from(this.tools.values()).every((entries) => entries.length === 0) ? (
            <p className="gamecrafter-page-empty">
              No tools have been discovered. Connect a server, then refresh its tools.
            </p>
          ) : (
            this.renderToolTables()
          )}
        </section>

        <section
          className="gamecrafter-connections-section gamecrafter-page-panel"
          hidden={this.activeSection !== 'add'}
        >
          <h2>Add connection</h2>
          <p>
            Choose a transport and enter the minimum connection details. Optional environment,
            credential, and container settings are below.
          </p>
          <form
            className="gamecrafter-connections-form"
            onSubmit={(event) => {
              event.preventDefault();
              void this.addConnection();
            }}
          >
            <label>
              Name
              <input
                aria-label="Connection name"
                pattern="[a-z0-9][a-z0-9-]{0,63}"
                title="Use 1–64 lowercase letters, numbers, or hyphens; start with a letter or number."
                placeholder="my-connection"
                required
                value={this.connectionName}
                onChange={(event) => this.setField('connectionName', event.currentTarget.value)}
              />
            </label>
            <label>
              Scope
              <select
                aria-label="Connection scope"
                value={this.scope}
                onChange={(event) =>
                  this.setField('scope', event.currentTarget.value as 'platform' | 'project')
                }
              >
                <option value="platform">Platform</option>
                <option value="project" disabled={!this.selectedProjectId}>
                  Project
                </option>
              </select>
            </label>
            <div className="gamecrafter-connections-wide">
              <span>Connection mode</span>
              <div
                className="gamecrafter-connections-mode-tabs"
                role="tablist"
                aria-label="Connection mode"
              >
                {(
                  [
                    ['command', 'Command / stdio'],
                    ['endpoint', 'Endpoint'],
                    ['docker', 'Docker'],
                  ] as const
                ).map(([mode, label]) => (
                  <button
                    key={mode}
                    type="button"
                    role="tab"
                    aria-selected={this.mode === mode}
                    onClick={() => this.setField('mode', mode)}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>
            {this.mode === 'command' && this.renderCommandFields()}
            {this.mode === 'endpoint' && this.renderEndpointFields()}
            {this.mode === 'docker' && this.renderDockerFields()}
            <label>
              Tags (comma-separated)
              <input
                aria-label="Connection tags"
                value={this.tags}
                onChange={(event) => this.setField('tags', event.currentTarget.value)}
              />
            </label>
            <label className="gamecrafter-connections-checkbox">
              <input
                type="checkbox"
                checked={this.allowServerInitiatedModelCalls}
                onChange={(event) =>
                  this.setField('allowServerInitiatedModelCalls', event.currentTarget.checked)
                }
              />
              Allow server-initiated model calls
            </label>
            <p className="gamecrafter-connections-warning">
              Server-initiated model calls may trigger model requests from the server. Keep this
              disabled unless required.
            </p>
            <details className="gamecrafter-page-advanced gamecrafter-connections-wide">
              <summary>Advanced metadata and credentials</summary>
              <label>
                Credentials (JSON key/value pairs; encrypted by the platform service)
                <textarea
                  aria-label="Connection credentials"
                  value={this.credentialsJson}
                  onChange={(event) => this.setField('credentialsJson', event.currentTarget.value)}
                />
              </label>
            </details>
            <button
              type="submit"
              disabled={
                this.busy ||
                !this.connectionName.trim() ||
                (this.scope === 'project' && !this.selectedProjectId)
              }
            >
              Add connection
            </button>
          </form>
        </section>

        <section
          className="gamecrafter-connections-section gamecrafter-page-panel"
          hidden={this.activeSection !== 'logs'}
        >
          {this.logConnectionId ? (
            <>
              <h2>Connection log: {this.connectionNameFor(this.logConnectionId)}</h2>
              <p className="gamecrafter-page-meta">
                <span className="gamecrafter-page-meta-item">
                  Entries <strong>{this.logs.get(this.logConnectionId)?.length ?? 0}</strong>
                </span>
              </p>
              <button type="button" onClick={() => void this.loadLogs(this.logConnectionId!)}>
                Refresh log
              </button>
              <pre className="gamecrafter-connections-log">
                {(this.logs.get(this.logConnectionId) ?? [])
                  .map((entry) => `${entry.at} [${entry.level}] ${entry.message}`)
                  .join('\n') || 'No log entries.'}
              </pre>
            </>
          ) : (
            <div className="gamecrafter-page-empty">
              <h2>No connection selected</h2>
              <p>Choose Logs on a configured server to inspect its recent connection events.</p>
            </div>
          )}
        </section>

        <section
          className="gamecrafter-connections-section gamecrafter-page-panel"
          hidden={this.activeSection !== 'a2a'}
        >
          {this.renderA2ASection()}
        </section>
      </div>
    );
  }

  private renderCommandFields(): React.ReactNode {
    return (
      <>
        <label>
          Command
          <input
            aria-label="Connection command"
            value={this.command}
            onChange={(event) => this.setField('command', event.currentTarget.value)}
          />
        </label>
        <details className="gamecrafter-page-advanced gamecrafter-connections-wide">
          <summary>Command arguments and environment</summary>
          <label>
            Arguments (comma-separated)
            <input
              aria-label="Connection command arguments"
              value={this.commandArgs}
              onChange={(event) => this.setField('commandArgs', event.currentTarget.value)}
            />
          </label>
          <label>
            Environment (JSON key/value pairs)
            <textarea
              aria-label="Connection environment"
              value={this.commandEnv}
              onChange={(event) => this.setField('commandEnv', event.currentTarget.value)}
            />
          </label>
        </details>
      </>
    );
  }

  private renderEndpointFields(): React.ReactNode {
    return (
      <>
        <label className="gamecrafter-connections-wide">
          URL
          <input
            aria-label="Connection endpoint URL"
            value={this.endpointUrl}
            onChange={(event) => this.setField('endpointUrl', event.currentTarget.value)}
          />
        </label>
        <label>
          Transport
          <select
            aria-label="Endpoint transport"
            value={this.endpointTransport}
            onChange={(event) =>
              this.setField('endpointTransport', event.currentTarget.value as EndpointTransport)
            }
          >
            <option value="streamable-http">Streamable HTTP</option>
            <option value="legacy-sse">Legacy SSE</option>
          </select>
        </label>
        <details className="gamecrafter-page-advanced gamecrafter-connections-wide">
          <summary>Custom request headers</summary>
          <label>
            Headers (JSON key/value pairs)
            <textarea
              aria-label="Connection headers"
              value={this.endpointHeaders}
              onChange={(event) => this.setField('endpointHeaders', event.currentTarget.value)}
            />
          </label>
        </details>
      </>
    );
  }

  private renderDockerFields(): React.ReactNode {
    return (
      <>
        <label>
          Image
          <input
            aria-label="Docker image"
            value={this.dockerImage}
            onChange={(event) => this.setField('dockerImage', event.currentTarget.value)}
          />
        </label>
        <label>
          Transport
          <select
            aria-label="Docker transport"
            value={this.dockerTransport}
            onChange={(event) =>
              this.setField('dockerTransport', event.currentTarget.value as DockerTransport)
            }
          >
            <option value="stdio">stdio</option>
            <option value="streamable-http">Streamable HTTP</option>
          </select>
        </label>
        {this.dockerTransport === 'streamable-http' && (
          <label>
            Port
            <input
              aria-label="Docker port"
              type="number"
              min="1"
              max="65535"
              value={this.dockerPort}
              onChange={(event) => this.setField('dockerPort', event.currentTarget.value)}
            />
          </label>
        )}
        <p className="gamecrafter-connections-note">
          Default Docker network is none; the container stops when the connection disconnects.
        </p>
        <details className="gamecrafter-page-advanced gamecrafter-connections-wide">
          <summary>Advanced Docker settings (command, mounts, network, and pull policy)</summary>
          <label>
            Command (comma-separated)
            <input
              aria-label="Docker command"
              value={this.dockerCommand}
              onChange={(event) => this.setField('dockerCommand', event.currentTarget.value)}
            />
          </label>
          <label>
            Network
            <select
              aria-label="Docker network"
              value={this.dockerNetwork}
              onChange={(event) =>
                this.setField(
                  'dockerNetwork',
                  event.currentTarget.value as 'none' | 'bridge' | 'host',
                )
              }
            >
              <option value="none">none</option>
              <option value="bridge">bridge</option>
              <option value="host">host</option>
            </select>
          </label>
          <label>
            Pull policy
            <select
              aria-label="Docker pull policy"
              value={this.dockerPullPolicy}
              onChange={(event) =>
                this.setField(
                  'dockerPullPolicy',
                  event.currentTarget.value as 'if-missing' | 'always' | 'never',
                )
              }
            >
              <option value="if-missing">if-missing</option>
              <option value="always">always</option>
              <option value="never">never</option>
            </select>
          </label>
          <label>
            Mounts (JSON array: source, target, readOnly)
            <textarea
              aria-label="Docker mounts"
              value={this.dockerMounts}
              onChange={(event) => this.setField('dockerMounts', event.currentTarget.value)}
            />
          </label>
          <label>
            Environment (JSON key/value pairs)
            <textarea
              aria-label="Docker environment"
              value={this.dockerEnv}
              onChange={(event) => this.setField('dockerEnv', event.currentTarget.value)}
            />
          </label>
        </details>
      </>
    );
  }

  private renderToolTables(): React.ReactNode {
    return this.connections.map(({ config }) => {
      const tools = this.tools.get(config.connectionId) ?? [];
      if (tools.length === 0) return null;
      return (
        <div className="gamecrafter-connections-tools" key={`${config.connectionId}-tools`}>
          <h3>{config.name} tools</h3>
          <table className="gamecrafter-connections-table">
            <thead>
              <tr>
                <th>Tool</th>
                <th>Side effects</th>
                <th>Execution mode</th>
              </tr>
            </thead>
            <tbody>
              {tools.map((tool) => {
                const toolName = tool.toolId.slice(config.name.length + 1);
                return (
                  <tr key={tool.toolId}>
                    <td title={tool.description}>{toolName}</td>
                    <td>
                      <select
                        aria-label={`${toolName} side effects`}
                        value={tool.sideEffects}
                        onChange={(event) =>
                          void this.classifyTool(
                            config.connectionId,
                            toolName,
                            event.currentTarget.value as SideEffect,
                            tool.executionMode,
                          )
                        }
                      >
                        {['none', 'workspace-write', 'external-write', 'paid', 'destructive'].map(
                          (effect) => (
                            <option key={effect}>{effect}</option>
                          ),
                        )}
                      </select>
                    </td>
                    <td>
                      <select
                        aria-label={`${toolName} execution mode`}
                        value={tool.executionMode}
                        onChange={(event) =>
                          void this.classifyTool(
                            config.connectionId,
                            toolName,
                            tool.sideEffects,
                            event.currentTarget.value as ExecutionMode,
                          )
                        }
                      >
                        {['project-file', 'headless-process', 'live-editor'].map(
                          (executionMode) => (
                            <option key={executionMode}>{executionMode}</option>
                          ),
                        )}
                      </select>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      );
    });
  }

  private renderA2ASection(): React.ReactNode {
    const config = this.a2aInboundConfig;
    return (
      <div className="gamecrafter-connections-a2a">
        <header className="gamecrafter-page-header">
          <div>
            <h2>Agent-to-Agent protocol (A2A v1.0)</h2>
            <p>
              Outbound agents are available to workers through brokered tools. The inbound gateway
              accepts scoped task requests only from local harnesses on 127.0.0.1.
            </p>
          </div>
        </header>
        <nav className="gamecrafter-section-nav" aria-label="A2A views">
          <button
            type="button"
            aria-pressed={this.a2aView === 'outbound'}
            onClick={() => {
              this.a2aView = 'outbound';
              this.update();
            }}
          >
            Outbound agents <span className="gamecrafter-count">{this.a2aConnections.length}</span>
          </button>
          <button
            type="button"
            aria-pressed={this.a2aView === 'inbound'}
            onClick={() => {
              this.a2aView = 'inbound';
              this.update();
            }}
          >
            Inbound gateway{' '}
            <span className="gamecrafter-count">{this.a2aInboundClients.length}</span>
          </button>
        </nav>
        {this.issuedA2AToken && (
          <div className="gamecrafter-connections-result" role="status">
            <strong>New A2A bearer token. Copy it now; it cannot be retrieved later.</strong>
            <textarea
              aria-label="One-time A2A client token"
              value={this.issuedA2AToken.token}
              readOnly
              rows={2}
              spellCheck={false}
            />
            <button type="button" onClick={() => void this.copyA2AToken()}>
              Copy token
            </button>
            <button
              type="button"
              onClick={() => {
                this.issuedA2AToken = undefined;
                this.update();
              }}
            >
              Hide token
            </button>
          </div>
        )}
        {this.a2aView === 'outbound' ? this.renderA2AOutbound() : this.renderA2AInbound(config)}
      </div>
    );
  }

  private renderA2AOutbound(): React.ReactNode {
    return (
      <>
        <section className="gamecrafter-page-panel">
          <h3>Configured external agents</h3>
          <p>
            Agent Cards and remote responses are untrusted data. Configure one credential per
            connection; OAuth and non-JSON-RPC bindings are not supported.
          </p>
          {this.a2aConnections.length === 0 ? (
            <p className="gamecrafter-page-empty">No outbound A2A agents are configured.</p>
          ) : (
            <div className="gamecrafter-connections-table-scroll">
              <table className="gamecrafter-connections-table">
                <thead>
                  <tr>
                    <th>Connection</th>
                    <th>Agent Card</th>
                    <th>Authentication</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {this.a2aConnections.map((connection) => (
                    <tr key={connection.connectionId}>
                      <td>
                        <strong>{connection.name}</strong>
                        <div>
                          <code>{connection.endpoint}</code>
                        </div>
                      </td>
                      <td>
                        {connection.agentCard ? (
                          <>
                            <strong>{connection.agentCard.name}</strong>{' '}
                            <span>v{connection.agentCard.version}</span>
                            <p>{connection.agentCard.description || 'No description.'}</p>
                            <div>
                              {connection.agentCard.supportedBindings.join(', ') ||
                                'No supported binding'}
                              {connection.agentCard.streaming ? ' · Streaming' : ''}
                            </div>
                            <ul>
                              {connection.agentCard.skills.map((skill) => (
                                <li key={skill.id}>
                                  {skill.name} <code>{skill.id}</code>
                                </li>
                              ))}
                            </ul>
                          </>
                        ) : (
                          <span>Not discovered</span>
                        )}
                      </td>
                      <td>
                        {connection.authKind}
                        {connection.credentialConfigured
                          ? ' · credential stored'
                          : ' · no credential'}
                      </td>
                      <td className="gamecrafter-connection-actions">
                        <button
                          type="button"
                          disabled={this.busy}
                          onClick={() => void this.discoverA2AConnection(connection.connectionId)}
                        >
                          Discover / refresh card
                        </button>
                        <button
                          type="button"
                          disabled={this.busy}
                          onClick={() => void this.removeA2AConnection(connection.connectionId)}
                        >
                          Remove
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <section className="gamecrafter-page-panel">
          <h3>Add outbound agent</h3>
          <form
            className="gamecrafter-connections-form gamecrafter-a2a-outbound-form"
            onSubmit={(event) => {
              event.preventDefault();
              void this.addA2AConnection();
            }}
          >
            <label>
              Name
              <input
                aria-label="A2A connection name"
                value={this.a2aOutboundName}
                onChange={(event) => {
                  this.a2aOutboundName = event.currentTarget.value;
                  this.update();
                }}
                required
              />
            </label>
            <label className="gamecrafter-connections-wide">
              Agent base URL
              <input
                aria-label="A2A agent endpoint"
                type="url"
                value={this.a2aEndpoint}
                onChange={(event) => {
                  this.a2aEndpoint = event.currentTarget.value;
                  this.update();
                }}
                required
              />
            </label>
            <p className="gamecrafter-page-hint gamecrafter-connections-wide">
              Remote agents require HTTPS. Plain HTTP is allowed only for an explicitly configured
              loopback endpoint. Redirects and cross-origin advertised interfaces are rejected.
            </p>
            <label>
              Authentication
              <select
                aria-label="A2A authentication kind"
                value={this.a2aAuthKind}
                onChange={(event) => {
                  this.a2aAuthKind = event.currentTarget.value as A2AAuthKind;
                  this.update();
                }}
              >
                <option value="none">None</option>
                <option value="api-key">API key header</option>
                <option value="bearer">Bearer token</option>
                <option value="basic">Basic username/password</option>
                <option value="custom-headers">Custom headers</option>
              </select>
            </label>
            {this.renderA2AAuthFields()}
            <button
              type="submit"
              disabled={this.busy || !this.a2aOutboundName.trim() || !this.a2aEndpoint.trim()}
            >
              Save outbound agent
            </button>
          </form>
        </section>
      </>
    );
  }

  private renderA2AAuthFields(): React.ReactNode {
    if (this.a2aAuthKind === 'api-key') {
      return (
        <>
          <label>
            API-key header name
            <input
              aria-label="A2A API-key header name"
              value={this.a2aHeaderName}
              onChange={(event) => {
                this.a2aHeaderName = event.currentTarget.value;
                this.update();
              }}
              required
            />
          </label>
          <label>
            API key (stored encrypted)
            <input
              aria-label="A2A API key"
              type="password"
              value={this.a2aApiKey}
              onChange={(event) => {
                this.a2aApiKey = event.currentTarget.value;
                this.update();
              }}
              required
            />
          </label>
        </>
      );
    }
    if (this.a2aAuthKind === 'bearer') {
      return (
        <label>
          Bearer token (stored encrypted)
          <input
            aria-label="A2A bearer token"
            type="password"
            value={this.a2aBearer}
            onChange={(event) => {
              this.a2aBearer = event.currentTarget.value;
              this.update();
            }}
            required
          />
        </label>
      );
    }
    if (this.a2aAuthKind === 'basic') {
      return (
        <>
          <label>
            Username
            <input
              aria-label="A2A basic username"
              value={this.a2aUsername}
              onChange={(event) => {
                this.a2aUsername = event.currentTarget.value;
                this.update();
              }}
              required
            />
          </label>
          <label>
            Password (stored encrypted)
            <input
              aria-label="A2A basic password"
              type="password"
              value={this.a2aPassword}
              onChange={(event) => {
                this.a2aPassword = event.currentTarget.value;
                this.update();
              }}
              required
            />
          </label>
        </>
      );
    }
    if (this.a2aAuthKind === 'custom-headers') {
      return (
        <label className="gamecrafter-connections-wide">
          Custom headers (JSON string values; stored encrypted)
          <textarea
            aria-label="A2A custom headers"
            value={this.a2aCustomHeaders}
            onChange={(event) => {
              this.a2aCustomHeaders = event.currentTarget.value;
              this.update();
            }}
            required
          />
        </label>
      );
    }
    return <p className="gamecrafter-page-hint">This agent does not require credentials.</p>;
  }

  private renderA2AInbound(config?: A2AInboundConfig): React.ReactNode {
    return (
      <>
        <section className="gamecrafter-page-panel">
          <h3>Inbound A2A task gateway</h3>
          <p>
            The optional HTTP endpoint binds only to 127.0.0.1. Remote harnesses on other machines
            cannot connect; each local client is separately authenticated and project-scoped.
          </p>
          <p className="gamecrafter-page-meta">
            Address <code>127.0.0.1</code> · Status{' '}
            <strong>{config?.active ? 'Listening' : 'Stopped'}</strong>
            {config && config.active && (
              <span>
                {' · '}Agent Card{' '}
                <code>http://127.0.0.1:{config.port}/.well-known/agent-card.json</code>
              </span>
            )}
          </p>
          <form
            className="gamecrafter-connections-form gamecrafter-a2a-gateway-form"
            onSubmit={(event) => {
              event.preventDefault();
              void this.configureA2AGateway();
            }}
          >
            <label className="gamecrafter-connections-checkbox">
              <input
                type="checkbox"
                aria-label="Enable inbound A2A gateway"
                checked={this.a2aInboundEnabled}
                onChange={(event) => {
                  this.a2aInboundEnabled = event.currentTarget.checked;
                  this.update();
                }}
              />
              Enable loopback A2A gateway
            </label>
            <label>
              Port
              <input
                type="number"
                aria-label="Inbound A2A port"
                min={1024}
                max={65535}
                value={this.a2aPort}
                onChange={(event) => {
                  this.a2aPort = event.currentTarget.value;
                  this.update();
                }}
                required
              />
            </label>
            <button type="submit" disabled={this.busy}>
              Save gateway settings
            </button>
          </form>
        </section>

        <section className="gamecrafter-page-panel">
          <h3>Authorized local clients</h3>
          <p>
            Each client can submit, inspect, continue, stream, or cancel only the tasks permitted by
            its Project and role grants. Ask-always approvals remain under local user control.
          </p>
          {this.renderA2AClientForm()}
          {this.a2aInboundClients.length === 0 ? (
            <p className="gamecrafter-page-empty">No inbound harness clients are registered.</p>
          ) : (
            <div className="gamecrafter-connections-table-scroll">
              <table className="gamecrafter-connections-table">
                <thead>
                  <tr>
                    <th>Client</th>
                    <th>Project / role grants</th>
                    <th>Token state</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {this.a2aInboundClients.map((client) => (
                    <tr key={client.clientId}>
                      <td>
                        <strong>{client.name}</strong>
                        <div>
                          <code>{client.clientId}</code>
                        </div>
                      </td>
                      <td>
                        {client.grants.map((grant, index) => (
                          <div key={`${grant.projectId}-${grant.role}-${index}`}>
                            {this.projects.find((project) => project.projectId === grant.projectId)
                              ?.name ?? grant.projectId}{' '}
                            / {grant.role}
                            <div>{grant.permissions.join(', ')}</div>
                          </div>
                        ))}
                      </td>
                      <td>
                        {client.revokedAt
                          ? 'Revoked'
                          : client.credentialConfigured
                            ? 'Active'
                            : 'Not issued'}
                      </td>
                      <td className="gamecrafter-connection-actions">
                        <button type="button" onClick={() => this.beginEditA2AClient(client)}>
                          Edit grants
                        </button>
                        <button
                          type="button"
                          disabled={this.busy}
                          onClick={() => void this.issueA2AToken(client.clientId)}
                        >
                          Issue / rotate token
                        </button>
                        <button
                          type="button"
                          disabled={this.busy || !client.credentialConfigured}
                          onClick={() => void this.revokeA2AClient(client.clientId)}
                        >
                          Revoke token
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </>
    );
  }

  private renderA2AClientForm(): React.ReactNode {
    return (
      <form
        className="gamecrafter-connections-form gamecrafter-a2a-client-form"
        onSubmit={(event) => {
          event.preventDefault();
          void this.saveA2AClient();
        }}
      >
        <h4>{this.a2aEditingClientId ? 'Edit client grants' : 'Register local harness'}</h4>
        <label>
          Client name
          <input
            aria-label="A2A client name"
            value={this.a2aClientName}
            onChange={(event) => {
              this.a2aClientName = event.currentTarget.value;
              this.update();
            }}
            required
          />
        </label>
        <label>
          Project
          <select
            aria-label="A2A grant project"
            value={this.a2aGrantProjectId}
            onChange={(event) => void this.selectA2AProject(event.currentTarget.value)}
          >
            <option value="">Select a Project</option>
            {this.projects.map((project) => (
              <option key={project.projectId} value={project.projectId}>
                {project.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          Role
          <select
            aria-label="A2A grant role"
            value={this.a2aGrantRole}
            onChange={(event) => {
              this.a2aGrantRole = event.currentTarget.value;
              this.update();
            }}
            disabled={!this.a2aGrantProjectId || this.a2aRoles.length === 0}
          >
            <option value="">Select a role</option>
            {this.a2aRoles.map((role) => (
              <option key={role.name} value={role.name}>
                {role.name}
              </option>
            ))}
          </select>
        </label>
        <fieldset className="gamecrafter-connections-wide">
          <legend>Allowed task operations</legend>
          {A2A_PERMISSIONS.map(([permission, label]) => (
            <label className="gamecrafter-connections-checkbox" key={permission}>
              <input
                type="checkbox"
                aria-label={`A2A permission ${permission}`}
                checked={this.a2aPermissions.includes(permission)}
                onChange={(event) =>
                  this.toggleA2APermission(permission, event.currentTarget.checked)
                }
              />
              {label}
            </label>
          ))}
        </fieldset>
        <button
          type="button"
          disabled={
            !this.a2aGrantProjectId || !this.a2aGrantRole || this.a2aPermissions.length === 0
          }
          onClick={() => this.addA2AGrant()}
        >
          Add Project / role grant
        </button>
        {this.a2aDraftGrants.length > 0 && (
          <ul className="gamecrafter-connections-wide">
            {this.a2aDraftGrants.map((grant, index) => (
              <li key={`${grant.projectId}-${grant.role}-${index}`}>
                {this.projects.find((project) => project.projectId === grant.projectId)?.name ??
                  grant.projectId}{' '}
                / {grant.role} · {grant.permissions.join(', ')}
                <button type="button" onClick={() => this.removeA2AGrant(index)}>
                  Remove grant
                </button>
              </li>
            ))}
          </ul>
        )}
        <div className="gamecrafter-page-hint gamecrafter-connections-wide">
          Inbound messages can create `agent.run` tasks only. They cannot invoke settings, tools, or
          administrative RPCs, and cannot grant themselves additional access.
        </div>
        <div className="gamecrafter-connection-actions">
          <button
            type="submit"
            disabled={this.busy || !this.a2aClientName.trim() || !this.a2aDraftGrants.length}
          >
            {this.a2aEditingClientId ? 'Save client grants' : 'Register client'}
          </button>
          {this.a2aEditingClientId && (
            <button type="button" onClick={() => this.cancelEditA2AClient()}>
              Cancel edit
            </button>
          )}
        </div>
      </form>
    );
  }

  private buildA2AOutboundAuth(): A2AOutboundAuthInput {
    switch (this.a2aAuthKind) {
      case 'none':
        return { kind: 'none' };
      case 'api-key':
        return {
          kind: 'api-key',
          headerName: this.a2aHeaderName.trim(),
          value: this.a2aApiKey,
        };
      case 'bearer':
        return { kind: 'bearer', token: this.a2aBearer };
      case 'basic':
        return { kind: 'basic', username: this.a2aUsername, password: this.a2aPassword };
      case 'custom-headers':
        return { kind: 'custom-headers', headers: parseJsonRecord(this.a2aCustomHeaders) };
      default:
        throw new Error('Unsupported A2A authentication kind.');
    }
  }

  private async addA2AConnection(): Promise<void> {
    await this.withBusy(async () => {
      const connection = await this.service.upsertA2AOutbound({
        name: this.a2aOutboundName.trim(),
        endpoint: this.a2aEndpoint.trim(),
        auth: this.buildA2AOutboundAuth(),
      });
      this.a2aOutboundName = '';
      this.a2aEndpoint = '';
      this.a2aApiKey = '';
      this.a2aBearer = '';
      this.a2aUsername = '';
      this.a2aPassword = '';
      this.a2aCustomHeaders = '{}';
      this.resultMessage = `Saved A2A connection ${connection.name}.`;
      this.a2aConnections = await this.service.listA2AOutbound();
    });
  }

  private async discoverA2AConnection(connectionId: string): Promise<void> {
    await this.withBusy(async () => {
      const card: A2AAgentCardSummary = await this.service.discoverA2AOutbound(connectionId);
      this.resultMessage = `Discovered ${card.name} (${card.skills.length} skill(s)).`;
      this.a2aConnections = await this.service.listA2AOutbound();
    });
  }

  private async removeA2AConnection(connectionId: string): Promise<void> {
    await this.withBusy(async () => {
      const removed = await this.service.deleteA2AOutbound(connectionId);
      this.resultMessage = removed
        ? 'Removed outbound A2A connection.'
        : 'A2A connection not found.';
      this.a2aConnections = await this.service.listA2AOutbound();
    });
  }

  private async configureA2AGateway(): Promise<void> {
    await this.withBusy(async () => {
      const config = await this.service.configureA2AInbound({
        enabled: this.a2aInboundEnabled,
        port: Number(this.a2aPort),
      });
      this.a2aInboundConfig = config;
      this.a2aInboundEnabled = config.enabled;
      this.a2aPort = String(config.port);
      this.resultMessage = config.active
        ? `A2A gateway listening on ${config.address}:${config.port}.`
        : 'A2A gateway stopped.';
    });
  }

  private async selectA2AProject(projectId: string): Promise<void> {
    this.a2aGrantProjectId = projectId;
    this.a2aGrantRole = '';
    this.a2aRoles = [];
    this.update();
    if (!projectId) return;
    await this.withBusy(async () => {
      this.a2aRoles = await this.service.listRoles(projectId);
      this.a2aGrantRole = this.a2aRoles[0]?.name ?? '';
    });
  }

  private toggleA2APermission(permission: A2ATaskPermission, enabled: boolean): void {
    this.a2aPermissions = enabled
      ? [...new Set([...this.a2aPermissions, permission])]
      : this.a2aPermissions.filter((item) => item !== permission);
    this.update();
  }

  private addA2AGrant(): void {
    if (!this.a2aGrantProjectId || !this.a2aGrantRole || this.a2aPermissions.length === 0) return;
    const duplicate = this.a2aDraftGrants.some(
      (grant) => grant.projectId === this.a2aGrantProjectId && grant.role === this.a2aGrantRole,
    );
    if (duplicate) {
      this.errorMessage = 'That Project and role grant is already in the draft.';
      this.update();
      return;
    }
    this.a2aDraftGrants = [
      ...this.a2aDraftGrants,
      {
        projectId: this.a2aGrantProjectId,
        role: this.a2aGrantRole,
        taskKinds: ['agent.run'],
        permissions: [...this.a2aPermissions],
      },
    ];
    this.update();
  }

  private removeA2AGrant(index: number): void {
    this.a2aDraftGrants = this.a2aDraftGrants.filter((_grant, itemIndex) => itemIndex !== index);
    this.update();
  }

  private async saveA2AClient(): Promise<void> {
    await this.withBusy(async () => {
      const client = await this.service.upsertA2AInboundClient({
        ...(this.a2aEditingClientId ? { clientId: this.a2aEditingClientId } : {}),
        name: this.a2aClientName.trim(),
        grants: this.a2aDraftGrants,
      });
      this.a2aClientName = '';
      this.a2aEditingClientId = undefined;
      this.a2aDraftGrants = [];
      this.issuedA2AToken = undefined;
      this.resultMessage = `Saved inbound A2A client ${client.name}. Issue its bearer token separately.`;
      this.a2aInboundClients = await this.service.listA2AInboundClients();
    });
  }

  private async beginEditA2AClient(client: A2AInboundClient): Promise<void> {
    this.a2aEditingClientId = client.clientId;
    this.a2aClientName = client.name;
    this.a2aDraftGrants = client.grants.map((grant) => ({
      ...grant,
      permissions: [...grant.permissions],
    }));
    const firstGrant = client.grants[0];
    this.a2aGrantProjectId = firstGrant?.projectId ?? '';
    this.a2aGrantRole = firstGrant?.role ?? '';
    this.issuedA2AToken = undefined;
    try {
      if (this.a2aGrantProjectId) {
        this.a2aRoles = await this.service.listRoles(this.a2aGrantProjectId);
      }
    } catch (error) {
      this.errorMessage = errorMessage(error);
    }
    this.update();
  }

  private cancelEditA2AClient(): void {
    this.a2aEditingClientId = undefined;
    this.a2aClientName = '';
    this.a2aDraftGrants = [];
    this.a2aGrantProjectId = '';
    this.a2aGrantRole = '';
    this.a2aRoles = [];
    this.update();
  }

  private async issueA2AToken(clientId: string): Promise<void> {
    await this.withBusy(async () => {
      this.issuedA2AToken = await this.service.issueA2AInboundClientToken(clientId);
      this.a2aInboundClients = await this.service.listA2AInboundClients();
      this.resultMessage = 'New A2A client token issued. It is shown once above.';
    });
  }

  private async revokeA2AClient(clientId: string): Promise<void> {
    await this.withBusy(async () => {
      const client = await this.service.revokeA2AInboundClient(clientId);
      this.issuedA2AToken = undefined;
      this.a2aInboundClients = await this.service.listA2AInboundClients();
      this.resultMessage = `Revoked A2A token for ${client.name}.`;
    });
  }

  private async copyA2AToken(): Promise<void> {
    if (!this.issuedA2AToken) return;
    try {
      await navigator.clipboard.writeText(this.issuedA2AToken.token);
      this.resultMessage = 'Copied A2A token to the clipboard.';
    } catch (error) {
      this.errorMessage = `Could not copy the token: ${errorMessage(error)}`;
    }
    this.update();
  }

  private async refresh(): Promise<void> {
    const version = ++this.refreshVersion;
    this.errorMessage = undefined;
    try {
      const projects = await this.service.listProjects();
      if (version !== this.refreshVersion || this.isDisposed) return;
      const projectId =
        (await this.resolveProjectSelection(projects, () => this.selectedProjectId)) || undefined;
      if (version !== this.refreshVersion || this.isDisposed) return;
      this.projects = projects;
      this.selectedProjectId = projectId;
      const [mcpConnections, outbound, inboundConfig, inboundClients] = await Promise.all([
        this.service.listMcpConnections(projectId),
        this.service.listA2AOutbound(),
        this.service.getA2AInboundConfig(),
        this.service.listA2AInboundClients(),
      ]);
      if (
        version !== this.refreshVersion ||
        projectId !== this.selectedProjectId ||
        this.isDisposed
      )
        return;
      this.connections = mcpConnections;
      this.a2aConnections = outbound;
      this.a2aInboundConfig = inboundConfig;
      this.a2aInboundClients = inboundClients;
      this.a2aInboundEnabled = inboundConfig.enabled;
      this.a2aPort = String(inboundConfig.port);
    } catch (error) {
      if (version !== this.refreshVersion || this.isDisposed) return;
      this.errorMessage = errorMessage(error);
    }
    this.update();
  }

  private async addConnection(): Promise<void> {
    this.withBusy(async () => {
      const common = {
        name: this.connectionName.trim(),
        scope: this.scope,
        projectId: this.scope === 'project' ? (this.selectedProjectId ?? null) : null,
        enabled: true,
        tags: splitList(this.tags),
        allowServerInitiatedModelCalls: this.allowServerInitiatedModelCalls,
      };
      const config = this.buildConfig(common);
      const credentials = parseJsonRecord(this.credentialsJson);
      const added = await this.service.addMcpConnection(config, credentials);
      this.resultMessage = `Added ${added.name}.`;
      this.connectionName = '';
      this.command = '';
      this.commandArgs = '';
      this.credentialsJson = '{}';
      await this.refresh();
    });
  }

  private buildConfig(common: {
    name: string;
    scope: 'platform' | 'project';
    projectId: string | null;
    enabled: boolean;
    tags: string[];
    allowServerInitiatedModelCalls: boolean;
  }): McpConnectionInput {
    if (this.mode === 'command') {
      return {
        ...common,
        mode: 'command',
        command: {
          command: this.command.trim(),
          args: splitList(this.commandArgs),
          env: parseJsonRecord(this.commandEnv),
        },
      };
    }
    if (this.mode === 'endpoint') {
      return {
        ...common,
        mode: 'endpoint',
        endpoint: {
          url: this.endpointUrl.trim(),
          transport: this.endpointTransport,
          headers: parseJsonRecord(this.endpointHeaders),
        },
      };
    }
    return {
      ...common,
      mode: 'docker',
      docker: {
        image: this.dockerImage.trim(),
        command: splitList(this.dockerCommand),
        transport: this.dockerTransport,
        ...(this.dockerPort ? { port: Number(this.dockerPort) } : {}),
        mounts: parseJsonArray(this.dockerMounts) as Array<{
          source: string;
          target: string;
          readOnly: boolean;
        }>,
        env: parseJsonRecord(this.dockerEnv),
        network: this.dockerNetwork,
        pullPolicy: this.dockerPullPolicy,
        stopOnDisconnect: true,
      },
    };
  }

  private async connect(connectionId: string): Promise<void> {
    await this.withBusy(async () => {
      const state = await this.service.connectMcpConnection(connectionId);
      this.connections = this.connections.map((entry) =>
        entry.config.connectionId === connectionId ? { ...entry, state } : entry,
      );
      if (state.status === 'connected') await this.refreshTools(connectionId);
    });
  }

  private async disconnect(connectionId: string): Promise<void> {
    await this.withBusy(async () => {
      const state = await this.service.disconnectMcpConnection(connectionId);
      this.connections = this.connections.map((entry) =>
        entry.config.connectionId === connectionId ? { ...entry, state } : entry,
      );
      this.tools.delete(connectionId);
    });
  }

  private async refreshTools(connectionId: string): Promise<void> {
    const result = await this.service.refreshMcpTools(connectionId);
    this.tools.set(connectionId, result.tools);
    this.update();
  }

  private async classifyTool(
    connectionId: string,
    toolName: string,
    sideEffects: SideEffect,
    executionMode: ExecutionMode,
  ): Promise<void> {
    await this.withBusy(async () => {
      const updated = await this.service.classifyMcpTool(
        connectionId,
        toolName,
        sideEffects,
        executionMode,
      );
      this.tools.set(
        connectionId,
        (this.tools.get(connectionId) ?? []).map((tool) =>
          tool.toolId === updated.toolId ? updated : tool,
        ),
      );
    });
  }

  private async loadLogs(connectionId: string): Promise<void> {
    this.logConnectionId = connectionId;
    this.activeSection = 'logs';
    try {
      this.logs.set(connectionId, await this.service.listMcpLogs(connectionId, 200));
      this.errorMessage = undefined;
    } catch (error) {
      this.errorMessage = errorMessage(error);
    }
    this.update();
  }

  private async remove(connectionId: string): Promise<void> {
    const name = this.connectionNameFor(connectionId);
    await this.withBusy(async () => {
      await this.service.removeMcpConnection(connectionId);
      this.tools.delete(connectionId);
      this.logs.delete(connectionId);
      if (this.logConnectionId === connectionId) this.logConnectionId = undefined;
      this.resultMessage = `Removed ${name}.`;
      await this.refresh();
    });
  }

  private async answerInputRequest(
    request: RpcNotificationParams<'mcp/inputRequired'>,
  ): Promise<void> {
    const inputRequests = Array.isArray(request.requests) ? request.requests : [request.requests];
    const responses: Record<string, unknown> = {};
    for (let index = 0; index < inputRequests.length; index += 1) {
      const item = inputRequests[index];
      const data = isRecord(item) ? item : {};
      const id = typeof data.id === 'string' ? data.id : String(index);
      const prompt =
        typeof data.prompt === 'string'
          ? data.prompt
          : typeof data.message === 'string'
            ? data.message
            : 'The MCP server requires input.';
      const choices = Array.isArray(data.options)
        ? data.options
            .map((option) =>
              typeof option === 'string'
                ? option
                : isRecord(option) && typeof option.title === 'string'
                  ? option.title
                  : '',
            )
            .filter(Boolean)
        : [];
      if (choices.length > 0) {
        const choice = await this.quickInput.pick(
          choices.map((label) => ({ label })),
          {
            title: `MCP Input — ${this.connectionNameFor(request.connectionId)}`,
            prompt,
          },
        );
        if (choice) responses[id] = choice.label;
      } else {
        const value = await this.quickInput.input({
          title: `MCP Input — ${this.connectionNameFor(request.connectionId)}`,
          prompt,
        });
        if (value !== undefined) responses[id] = value;
      }
    }
    try {
      await this.service.answerMcpInput(request.connectionId, request.requestId, responses);
    } catch (error) {
      this.errorMessage = errorMessage(error);
      this.update();
    }
  }

  private connectionNameFor(connectionId: string): string {
    return (
      this.connections.find((entry) => entry.config.connectionId === connectionId)?.config.name ??
      connectionId
    );
  }

  private activateSection(section: ConnectionsSection): void {
    this.activeSection = section;
    this.update();
  }

  private async withBusy(action: () => Promise<void>): Promise<void> {
    this.busy = true;
    this.errorMessage = undefined;
    this.update();
    try {
      await action();
    } catch (error) {
      this.errorMessage = errorMessage(error);
    } finally {
      this.busy = false;
      this.update();
    }
  }

  private setField(field: ConnectionFormField, value: string | boolean): void {
    switch (field) {
      case 'connectionName':
        this.connectionName = String(value);
        break;
      case 'scope':
        this.scope = value as 'platform' | 'project';
        break;
      case 'mode':
        this.mode = value as McpMode;
        break;
      case 'tags':
        this.tags = String(value);
        break;
      case 'command':
        this.command = String(value);
        break;
      case 'commandArgs':
        this.commandArgs = String(value);
        break;
      case 'commandEnv':
        this.commandEnv = String(value);
        break;
      case 'endpointUrl':
        this.endpointUrl = String(value);
        break;
      case 'endpointTransport':
        this.endpointTransport = value as EndpointTransport;
        break;
      case 'endpointHeaders':
        this.endpointHeaders = String(value);
        break;
      case 'dockerImage':
        this.dockerImage = String(value);
        break;
      case 'dockerCommand':
        this.dockerCommand = String(value);
        break;
      case 'dockerTransport':
        this.dockerTransport = value as DockerTransport;
        break;
      case 'dockerPort':
        this.dockerPort = String(value);
        break;
      case 'dockerMounts':
        this.dockerMounts = String(value);
        break;
      case 'dockerEnv':
        this.dockerEnv = String(value);
        break;
      case 'dockerNetwork':
        this.dockerNetwork = value as 'none' | 'bridge' | 'host';
        break;
      case 'dockerPullPolicy':
        this.dockerPullPolicy = value as 'if-missing' | 'always' | 'never';
        break;
      case 'allowServerInitiatedModelCalls':
        this.allowServerInitiatedModelCalls = Boolean(value);
        break;
      case 'credentialsJson':
        this.credentialsJson = String(value);
        break;
    }
    this.update();
  }
}

function parseJsonRecord(value: string): Record<string, string> {
  const parsed: unknown = JSON.parse(value);
  if (!isRecord(parsed) || Object.values(parsed).some((item) => typeof item !== 'string')) {
    throw new Error('Expected a JSON object with string values.');
  }
  return parsed as Record<string, string>;
}

function parseJsonArray(value: string): unknown[] {
  const parsed: unknown = JSON.parse(value);
  if (!Array.isArray(parsed)) throw new Error('Expected a JSON array.');
  return parsed;
}

function splitList(value: string): string[] {
  return value
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

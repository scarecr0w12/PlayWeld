import React from 'react';
import { inject, injectable } from '@theia/core/shared/inversify';
import { Message } from '@theia/core/lib/browser/widgets/widget';
import { ControlRoomReactWidget } from './control-room-react-widget';
import { QuickInputService } from '@theia/core/lib/common/quick-pick-service';
import type {
  ExecutionMode,
  McpConnectionInput,
  McpConnectionListEntry,
  McpConnectionLogEntry,
  ProjectSummary,
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
  private connections: McpConnectionListEntry[] = [];
  private tools = new Map<string, ToolDefinition[]>();
  private logs = new Map<string, McpConnectionLogEntry[]>();
  private logConnectionId?: string;
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
    return (
      <div className="gamecrafter-connections gamecrafter-surface">
        <header className="gamecrafter-connections-header">
          <h1>Connections</h1>
          <label>
            Project
            <select
              aria-label="Connections Project"
              value={this.selectedProjectId ?? ''}
              onChange={(event) => {
                this.markProjectSelection();
                this.selectedProjectId = event.currentTarget.value || undefined;
                this.scope = this.selectedProjectId ? 'project' : 'platform';
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
          <button type="button" onClick={() => void this.refresh()}>
            Refresh
          </button>
        </header>

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

        <section className="gamecrafter-connections-section">
          <h2>Configured servers</h2>
          {this.connections.length === 0 ? (
            <p>No MCP connections are configured for this scope.</p>
          ) : (
            <div className="gamecrafter-connections-table-scroll">
              <table className="gamecrafter-connections-table">
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Scope / Mode</th>
                    <th>Docker network / mounts</th>
                    <th>Status</th>
                    <th>Revision</th>
                    <th>Legacy</th>
                    <th>Tools</th>
                    <th>Container</th>
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
                        {config.mode === 'docker'
                          ? `${config.docker.network} / ${config.docker.mounts.length} mounts`
                          : '—'}
                      </td>
                      <td>
                        <span
                          className={`gamecrafter-connection-status gamecrafter-connection-status-${state.status}`}
                        >
                          {state.status}
                        </span>
                      </td>
                      <td>{state.negotiatedRevision ?? '—'}</td>
                      <td>{state.legacy ? 'Yes' : 'No'}</td>
                      <td>{state.toolCount}</td>
                      <td>{state.containerId ?? '—'}</td>
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
          {this.renderToolTables()}
        </section>

        <section className="gamecrafter-connections-section">
          <h2>Add connection</h2>
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
            <label className="gamecrafter-connections-wide">
              Credentials (JSON key/value pairs; encrypted by the platform service)
              <textarea
                aria-label="Connection credentials"
                value={this.credentialsJson}
                onChange={(event) => this.setField('credentialsJson', event.currentTarget.value)}
              />
            </label>
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

        {this.logConnectionId && (
          <section className="gamecrafter-connections-section">
            <h2>Connection log: {this.connectionNameFor(this.logConnectionId)}</h2>
            <button type="button" onClick={() => void this.loadLogs(this.logConnectionId!)}>
              Refresh log
            </button>
            <pre className="gamecrafter-connections-log">
              {(this.logs.get(this.logConnectionId) ?? [])
                .map((entry) => `${entry.at} [${entry.level}] ${entry.message}`)
                .join('\n') || 'No log entries.'}
            </pre>
          </section>
        )}
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
        <label>
          Arguments (comma-separated)
          <input
            aria-label="Connection command arguments"
            value={this.commandArgs}
            onChange={(event) => this.setField('commandArgs', event.currentTarget.value)}
          />
        </label>
        <label className="gamecrafter-connections-wide">
          Environment (JSON key/value pairs)
          <textarea
            aria-label="Connection environment"
            value={this.commandEnv}
            onChange={(event) => this.setField('commandEnv', event.currentTarget.value)}
          />
        </label>
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
        <label className="gamecrafter-connections-wide">
          Headers (JSON key/value pairs)
          <textarea
            aria-label="Connection headers"
            value={this.endpointHeaders}
            onChange={(event) => this.setField('endpointHeaders', event.currentTarget.value)}
          />
        </label>
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
          Command (comma-separated)
          <input
            aria-label="Docker command"
            value={this.dockerCommand}
            onChange={(event) => this.setField('dockerCommand', event.currentTarget.value)}
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
        <label className="gamecrafter-connections-wide">
          Mounts (JSON array: source, target, readOnly)
          <textarea
            aria-label="Docker mounts"
            value={this.dockerMounts}
            onChange={(event) => this.setField('dockerMounts', event.currentTarget.value)}
          />
        </label>
        <label className="gamecrafter-connections-wide">
          Environment (JSON key/value pairs)
          <textarea
            aria-label="Docker environment"
            value={this.dockerEnv}
            onChange={(event) => this.setField('dockerEnv', event.currentTarget.value)}
          />
        </label>
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

  private async refresh(): Promise<void> {
    this.errorMessage = undefined;
    try {
      this.projects = await this.service.listProjects();
      this.selectedProjectId =
        (await this.resolveProjectSelection(this.projects, () => this.selectedProjectId)) ||
        undefined;
      this.connections = await this.service.listMcpConnections(this.selectedProjectId);
    } catch (error) {
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

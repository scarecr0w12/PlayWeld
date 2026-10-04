import React from 'react';
import { PLAYWELD_RIBBON, PLAYWELD_SPARK } from './brand-geometry';
import { inject, injectable } from '@theia/core/shared/inversify';
import { CommandService } from '@theia/core/lib/common/command';
import { Message } from '@theia/core/lib/browser/widgets/widget';
import { ControlRoomReactWidget } from './control-room-react-widget';
import URI from '@theia/core/lib/common/uri';
import { MessageService } from '@theia/core/lib/common/message-service';
import { WorkspaceService } from '@theia/workspace/lib/browser/workspace-service';
import type { EngineCapabilityReport, ProjectSummary } from '@gamecrafter/contracts';
import {
  ControlRoomService,
  type ControlRoomService as ControlRoomServiceApi,
} from '../common/control-room-protocol';
import { ControlRoomClientEvents } from './control-room-client';
import { CREATE_PROJECT_COMMAND_ID } from './create-project-command';
import { SETTINGS_OPEN_COMMAND_ID } from './settings-view-contribution';
import { MODELS_OPEN_COMMAND_ID } from './models-view-contribution';
import { SKILLS_OPEN_COMMAND_ID } from './skills-view-contribution';
import { CONNECTIONS_OPEN_COMMAND_ID } from './connections-view-contribution';
import { DISCUSSION_BOARD_OPEN_COMMAND_ID } from './discussion-board-view-contribution';
import { SWARM_OPEN_COMMAND_ID } from './swarm-view-contribution';
import { PLUGINS_OPEN_COMMAND_ID } from './plugins-catalog-view-contribution';
import { ENGINE_OPEN_COMMAND_ID } from './engine-view-contribution';
import { DCC_OPEN_COMMAND_ID } from './dcc-view-contribution';
import { KNOWLEDGE_OPEN_COMMAND_ID } from './knowledge-view-contribution';
import { ASSETS_OPEN_COMMAND_ID } from './assets-view-contribution';
import { BACKUPS_OPEN_COMMAND_ID } from './backups-view-contribution';
import { AUDIT_OPEN_COMMAND_ID } from './audit-view-contribution';
import { CHAT_OPEN_COMMAND_ID } from './chat-view-contribution';
import { UPDATES_OPEN_COMMAND_ID } from './updates-view-contribution';

@injectable()
export class ProjectHomeWidget extends ControlRoomReactWidget {
  static readonly ID = 'gamecrafter.projectHome';

  private projects: ProjectSummary[] = [];
  private readonly engineReports = new Map<string, EngineCapabilityReport>();
  private serviceStatus = 'Connecting…';

  constructor(
    @inject(ControlRoomService)
    private readonly controlRoomService: ControlRoomServiceApi,
    @inject(ControlRoomClientEvents)
    private readonly clientEvents: ControlRoomClientEvents,
    @inject(CommandService)
    private readonly commandService: CommandService,
    @inject(WorkspaceService)
    private readonly workspaceService: WorkspaceService,
    @inject(MessageService)
    private readonly messageService: MessageService,
  ) {
    super();
    this.id = ProjectHomeWidget.ID;
    this.title.label = 'Project Home';
    this.title.iconClass = 'codicon codicon-home';
    this.title.closable = true;
    this.toDispose.push(
      this.clientEvents.projectChanged(() => {
        void this.refresh();
      }),
    );
    this.toDispose.push(
      this.clientEvents.engineCapabilitiesChanged(({ projectId, report }) => {
        this.engineReports.set(projectId, report);
        this.update();
      }),
    );
    this.toDispose.push(
      this.clientEvents.serviceStatus(({ message }) => {
        this.serviceStatus = message ?? 'Unavailable';
        this.update();
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
      <div className="gamecrafter-project-home gamecrafter-surface">
        <header className="gamecrafter-home-header">
          <div className="gamecrafter-home-brand">
            <svg className="playweld-brand-mark" viewBox="0 0 512 512" aria-hidden="true">
              <path d={PLAYWELD_RIBBON} />
              <path d={PLAYWELD_SPARK} />
            </svg>
            <div>
              <h1>PlayWeld</h1>
              <p className="gamecrafter-home-subtitle">Your game development workspace.</p>
              <p role="status">{this.serviceStatus}</p>
            </div>
          </div>
          <button
            className="theia-button gamecrafter-primary-action"
            type="button"
            onClick={() => void this.commandService.executeCommand(CREATE_PROJECT_COMMAND_ID)}
          >
            <span className="codicon codicon-add" aria-hidden="true" /> Create Project
          </button>
        </header>
        <section
          className="gamecrafter-home-next-step"
          aria-labelledby="gamecrafter-home-next-step-title"
        >
          <span className="gamecrafter-home-guide-kicker">Next step</span>
          {this.projects.length === 0 ? (
            <>
              <h2 id="gamecrafter-home-next-step-title">Create a Project</h2>
              <p>
                Create a Project to get its game folder and platform record. You can connect an
                engine afterward.
              </p>
              <button
                className="theia-button"
                type="button"
                onClick={() => void this.commandService.executeCommand(CREATE_PROJECT_COMMAND_ID)}
              >
                Create Project
              </button>
            </>
          ) : (
            <>
              <h2 id="gamecrafter-home-next-step-title">Open a Project to continue</h2>
              <p>
                Choose a Project below to load its workspace. Use Engine afterward to inspect its
                project files, installations, and editor connection.
              </p>
              <button
                className="theia-button"
                type="button"
                onClick={() => {
                  const heading = this.node.querySelector<HTMLElement>(
                    '#gamecrafter-home-projects',
                  );
                  heading?.scrollIntoView({ block: 'start' });
                  heading?.focus({ preventScroll: true });
                }}
              >
                Go to Projects
              </button>
            </>
          )}
        </section>
        <nav className="gamecrafter-home-navigation" aria-label="Workspace navigation">
          {HOME_NAVIGATION_GROUPS.map((group) => (
            <section
              className="gamecrafter-home-navigation-group"
              aria-labelledby={`${group.id}-title`}
              key={group.id}
            >
              <header>
                <h2 id={`${group.id}-title`}>{group.title}</h2>
                <p>{group.description}</p>
              </header>
              <div className="gamecrafter-home-navigation-items">
                {group.items.map(({ label, command, icon, description }) => {
                  const descriptionId = `${group.id}-${command}-description`;
                  return (
                    <button
                      className="theia-button secondary gamecrafter-home-navigation-item"
                      type="button"
                      key={command}
                      aria-describedby={descriptionId}
                      onClick={() => void this.commandService.executeCommand(command)}
                    >
                      <span className={`codicon codicon-${icon}`} aria-hidden="true" />
                      <span className="gamecrafter-home-navigation-item-copy">
                        <strong>{label}</strong>
                        <small id={descriptionId}>{description}</small>
                      </span>
                    </button>
                  );
                })}
              </div>
            </section>
          ))}
        </nav>
        <p className="gamecrafter-home-guide-note">
          PlayWeld Chat and Swarm run inside this workspace; external IDE clients cannot call
          PlayWeld tools directly yet.
        </p>
        <h2
          id="gamecrafter-home-projects"
          tabIndex={-1}
          className="gamecrafter-home-projects-heading"
        >
          Projects
        </h2>
        {this.projects.length === 0 ? (
          <div className="gamecrafter-project-home-empty">
            <span className="codicon codicon-folder-opened" aria-hidden="true" />
            <h3>No Projects yet</h3>
            <p>Create a Project to start building your game.</p>
          </div>
        ) : (
          <table className="gamecrafter-project-home-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Engine</th>
                <th>Engine layers</th>
                <th>Action</th>
                <th>Genres</th>
                <th>Path</th>
                <th>Created</th>
              </tr>
            </thead>
            <tbody>
              {this.projects.map((project) => (
                <tr key={project.projectId}>
                  <td>{project.name}</td>
                  <td>{project.engine.family}</td>
                  <td>{this.renderEngineStatus(project.projectId)}</td>
                  <td>
                    <button
                      className="theia-button"
                      type="button"
                      onClick={() => void this.openProject(project)}
                    >
                      Open
                    </button>
                  </td>
                  <td>{project.genres.join(', ')}</td>
                  <td>{project.path}</td>
                  <td>{new Date(project.createdAt).toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    );
  }

  private renderEngineStatus(projectId: string): React.ReactNode {
    const report = this.engineReports.get(projectId);
    if (!report)
      return (
        <span className="gamecrafter-engine-status gamecrafter-engine-status-unverified">
          Checking layers…
        </span>
      );
    const layers = ['project-file', 'headless-process', 'live-editor'] as const;
    const explanations = [
      report.projectIdentity.proven
        ? 'Native engine project files detected'
        : `No native ${report.family} project file detected`,
      report.engineVersion.detected
        ? `${report.family} ${report.engineVersion.detected} detected`
        : `${report.family} version not detected`,
      'Use Engine to register an installation or connect an editor',
    ];
    return (
      <div className="gamecrafter-project-engine-layers">
        {layers.map((layer) => (
          <span
            className={`gamecrafter-engine-status gamecrafter-engine-status-${report.layers[layer].status}`}
            key={layer}
            title={`${layer}: ${report.layers[layer].detail}`}
            aria-label={`${layer}: ${report.layers[layer].status}. ${report.layers[layer].detail}`}
          >
            {layer}: {report.layers[layer].status}
          </span>
        ))}
        {explanations.length > 0 && (
          <small className="gamecrafter-project-engine-details">{explanations.join(' ')}</small>
        )}
      </div>
    );
  }

  private async openProject(project: ProjectSummary): Promise<void> {
    try {
      await this.controlRoomService.openProject(project.path);
      await this.workspaceService.openWorkspace(URI.fromFilePath(project.path), {
        preserveWindow: true,
      });
    } catch (error) {
      await this.messageService.error(
        `Could not open ${project.name}: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  private async refresh(): Promise<void> {
    try {
      const info = await this.controlRoomService.getServiceInfo();
      this.projects = await this.controlRoomService.listProjects();
      const reports = await Promise.all(
        this.projects.map(async (project) => {
          try {
            return [
              project.projectId,
              await this.controlRoomService.getEngineCapabilities(project.projectId),
            ] as const;
          } catch {
            return [project.projectId, null] as const;
          }
        }),
      );
      this.engineReports.clear();
      for (const [projectId, report] of reports)
        if (report) this.engineReports.set(projectId, report);
      this.serviceStatus = `Connected to platform service v${info.serviceVersion}`;
    } catch (error) {
      this.serviceStatus = `Unavailable: ${error instanceof Error ? error.message : String(error)}`;
    }
    this.update();
  }
}

const HOME_NAVIGATION_GROUPS = [
  {
    id: 'game-projects',
    title: 'Build and review',
    description: 'Work with game files and inspect recorded project activity.',
    items: [
      {
        label: 'Engine',
        command: ENGINE_OPEN_COMMAND_ID,
        icon: 'debug',
        description: 'Review engine layers, register installations, or connect an editor.',
      },
      {
        label: 'DCC Tools',
        command: DCC_OPEN_COMMAND_ID,
        icon: 'tools',
        description: 'Register DCC tools and inspect supported operations and connections.',
      },
      {
        label: 'Assets',
        command: ASSETS_OPEN_COMMAND_ID,
        icon: 'file-media',
        description: 'Browse project assets, inspect previews, and review generation jobs.',
      },
      {
        label: 'Backups',
        command: BACKUPS_OPEN_COMMAND_ID,
        icon: 'archive',
        description: 'Configure archives, schedules, and restore workflows.',
      },
      {
        label: 'Audit & History',
        command: AUDIT_OPEN_COMMAND_ID,
        icon: 'history',
        description: 'Review tool decisions, execution results, and project events.',
      },
    ],
  },
  {
    id: 'ai-teamwork',
    title: 'AI and teamwork',
    description: 'Set up assistance, share context, and review delegated work.',
    items: [
      {
        label: 'Models',
        command: MODELS_OPEN_COMMAND_ID,
        icon: 'hubot',
        description: 'Connect providers, discover models, and configure routing.',
      },
      {
        label: 'Chat',
        command: CHAT_OPEN_COMMAND_ID,
        icon: 'comment-discussion',
        description: 'Ask project-aware questions or delegate work in Agent mode.',
      },
      {
        label: 'Skills & Roles',
        command: SKILLS_OPEN_COMMAND_ID,
        icon: 'organization',
        description: 'Browse available skills and agent roles.',
      },
      {
        label: 'Connections',
        command: CONNECTIONS_OPEN_COMMAND_ID,
        icon: 'plug',
        description: 'Configure MCP servers, credentials, and tool policies.',
      },
      {
        label: 'Discussion Board',
        command: DISCUSSION_BOARD_OPEN_COMMAND_ID,
        icon: 'comment',
        description: 'Discuss work, record decisions, and track linked tasks.',
      },
      {
        label: 'Swarm',
        command: SWARM_OPEN_COMMAND_ID,
        icon: 'type-hierarchy',
        description: 'Review agent requests and task progress.',
      },
    ],
  },
  {
    id: 'reference-extensions',
    title: 'Reference and extensions',
    description: 'Search indexed material or manage installed tools.',
    items: [
      {
        label: 'Knowledge',
        command: KNOWLEDGE_OPEN_COMMAND_ID,
        icon: 'book',
        description: 'Search indexed project docs, source, assets, and discussion.',
      },
      {
        label: 'Plugins',
        command: PLUGINS_OPEN_COMMAND_ID,
        icon: 'extensions',
        description: 'Review installed plugins, catalogs, and requested capabilities.',
      },
    ],
  },
  {
    id: 'workspace',
    title: 'Workspace',
    description: 'Manage platform configuration and review product updates.',
    items: [
      {
        label: 'Settings',
        command: SETTINGS_OPEN_COMMAND_ID,
        icon: 'settings-gear',
        description: 'Configure shared settings and Project-specific overrides.',
      },
      {
        label: 'Updates',
        command: UPDATES_OPEN_COMMAND_ID,
        icon: 'sync',
        description: 'Check the configured release channel for updates.',
      },
    ],
  },
] as const;

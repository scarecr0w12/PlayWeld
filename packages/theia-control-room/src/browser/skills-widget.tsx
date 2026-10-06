import React from 'react';
import { inject, injectable } from '@theia/core/shared/inversify';
import { Message } from '@theia/core/lib/browser/widgets/widget';
import { ControlRoomReactWidget } from './control-room-react-widget';
import type {
  ProjectSkillEntry,
  ProjectSummary,
  RoleRecord,
  SkillCatalogEntry,
  SkillResourceReadResult,
} from '@gamecrafter/contracts';
import {
  ControlRoomService,
  type ControlRoomService as ControlRoomServiceApi,
} from '../common/control-room-protocol';

@injectable()
export class SkillsWidget extends ControlRoomReactWidget {
  static readonly ID = 'gamecrafter.skills';

  private projects: ProjectSummary[] = [];
  private selectedProjectId?: string;
  private refreshVersion = 0;
  private skills: ProjectSkillEntry[] = [];
  private roles: RoleRecord[] = [];
  private catalog: SkillCatalogEntry[] = [];
  private activeSection: 'skills' | 'install' | 'catalog' | 'roles' = 'skills';
  private catalogTruncated = false;
  private catalogPreviewed = false;
  private readingSkill?: ProjectSkillEntry;
  private readingResource = 'SKILL.md';
  private resourcePage?: SkillResourceReadResult;
  private readPending = false;
  private readGeneration = 0;
  private source = '';
  private installName = '';
  private forceInstall = false;
  private catalogRole = '';
  private catalogWorkType = '';
  private taskText = '';
  private errorMessage?: string;
  private resultMessage?: string;

  constructor(
    @inject(ControlRoomService)
    private readonly controlRoomService: ControlRoomServiceApi,
  ) {
    super();
    this.id = SkillsWidget.ID;
    this.title.label = 'Skills & Roles';
    this.title.iconClass = 'codicon codicon-library';
    this.title.closable = true;
    void this.refresh();
  }

  protected onActivateRequest(message: Message): void {
    super.onActivateRequest(message);
    void this.refresh();
  }

  protected render(): React.ReactNode {
    const selectedProject = this.projects.find(
      (project) => project.projectId === this.selectedProjectId,
    );
    return (
      <div className="gamecrafter-skills gamecrafter-surface">
        <header className="gamecrafter-skills-header gamecrafter-page-header">
          <div>
            <h1>Skills &amp; Roles</h1>
            <p>Browse installed workflows, adjust platform skill eligibility, and inspect roles.</p>
          </div>
          <label>
            Project
            <select
              aria-label="Skills Project"
              value={this.selectedProjectId ?? ''}
              onChange={(event) => {
                this.markProjectSelection();
                this.selectedProjectId = event.currentTarget.value || undefined;
                this.readingSkill = undefined;
                this.resourcePage = undefined;
                this.readPending = false;
                this.readGeneration += 1;
                void this.refresh();
              }}
            >
              <option value="">No Project</option>
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
        <nav className="gamecrafter-section-nav" aria-label="Skills workspace sections">
          {(['skills', 'install', 'catalog', 'roles'] as const).map((section) => (
            <button
              key={section}
              type="button"
              aria-controls={`gamecrafter-skills-${section === 'skills' ? 'list' : section}`}
              aria-pressed={this.activeSection === section}
              onClick={() => {
                this.activeSection = section;
                this.update();
              }}
            >
              {
                {
                  skills: 'Project skills',
                  install: 'Install',
                  catalog: 'Preview catalog',
                  roles: 'Roles',
                }[section]
              }
            </button>
          ))}
        </nav>
        {selectedProject && !selectedProject.trusted && (
          <aside className="gamecrafter-skills-untrusted" role="alert">
            <span>
              Untrusted Project. Project-local and compatibility skills are listed but cannot be
              activated.
            </span>
            <button type="button" onClick={() => void this.trustProject()}>
              Trust Project
            </button>
          </aside>
        )}
        {this.errorMessage && (
          <p className="gamecrafter-skills-error" role="alert">
            {this.errorMessage}
          </p>
        )}
        {this.resultMessage && (
          <p className="gamecrafter-skills-result" role="status">
            {this.resultMessage}
          </p>
        )}

        <section className="gamecrafter-page-guidance gamecrafter-work-guidance">
          <div>
            <strong>
              {this.selectedProjectId
                ? 'Review the skills available to this Project'
                : 'Choose a Project for its local skills'}
            </strong>
            <p>
              {this.selectedProjectId
                ? 'Read guides, adjust platform eligibility, or preview role-based catalog matches.'
                : 'Platform skills and roles can also be reviewed without a Project selected.'}
            </p>
          </div>
        </section>

        <section
          className="gamecrafter-skills-section gamecrafter-page-panel"
          id="gamecrafter-skills-install"
          hidden={this.activeSection !== 'install'}
        >
          <h2>Install a skill</h2>
          <form
            className="gamecrafter-skills-install-form"
            onSubmit={(event) => {
              event.preventDefault();
              void this.installSkills();
            }}
          >
            <label>
              Source
              <input
                aria-label="Skill source"
                placeholder="owner/repo, local path, or archive URL"
                value={this.source}
                onChange={(event) => {
                  this.source = event.currentTarget.value;
                  this.update();
                }}
              />
            </label>
            <label>
              Name (optional)
              <input
                aria-label="Skill name"
                value={this.installName}
                onChange={(event) => {
                  this.installName = event.currentTarget.value;
                  this.update();
                }}
              />
            </label>
            <label className="gamecrafter-skills-inline-checkbox">
              <input
                aria-label="Replace installed skill"
                type="checkbox"
                checked={this.forceInstall}
                onChange={(event) => {
                  this.forceInstall = event.currentTarget.checked;
                  this.update();
                }}
              />
              Replace existing version
            </label>
            <button type="submit" disabled={!this.source.trim()}>
              Install
            </button>
          </form>
        </section>

        {this.readingSkill && this.activeSection === 'skills' && (
          <section
            className="gamecrafter-skills-section gamecrafter-skill-reader"
            aria-label="Skill reference reader"
          >
            <header className="gamecrafter-page-header">
              <h2>{this.readingSkill.name}</h2>
              <button
                type="button"
                onClick={() => {
                  this.readingSkill = undefined;
                  this.resourcePage = undefined;
                  this.update();
                }}
              >
                Close guide
              </button>
            </header>
            <label>
              Document
              <select
                aria-label="Skill document"
                value={this.readingResource}
                disabled={this.readPending}
                onChange={(event) => {
                  this.readingResource = event.currentTarget.value;
                  this.resourcePage = undefined;
                  void this.readResource(1);
                }}
              >
                {['SKILL.md', ...this.readingSkill.resources].map((resource) => (
                  <option key={resource} value={resource}>
                    {resource}
                  </option>
                ))}
              </select>
            </label>
            {this.readPending && <p role="status">Loading guide…</p>}
            {this.resourcePage && (
              <>
                <p>
                  Lines {this.resourcePage.startLine}–{this.resourcePage.endLine} of{' '}
                  {this.resourcePage.totalLines}
                </p>
                <pre className="gamecrafter-skill-reader-content">{this.resourcePage.content}</pre>
                <button
                  type="button"
                  disabled={this.readPending || this.resourcePage.startLine <= 1}
                  onClick={() =>
                    void this.readResource(Math.max(1, this.resourcePage!.startLine - 200))
                  }
                >
                  Previous page
                </button>
                <button
                  type="button"
                  disabled={this.readPending || !this.resourcePage.truncated}
                  onClick={() => void this.readResource(this.resourcePage!.endLine + 1)}
                >
                  Next page
                </button>
              </>
            )}
          </section>
        )}

        <section
          className="gamecrafter-skills-section gamecrafter-page-panel"
          id="gamecrafter-skills-list"
          hidden={this.activeSection !== 'skills'}
        >
          <h2>Project skills</h2>
          <p>Enable platform skills and set optional role or work-type overrides.</p>
          {this.skills.length === 0 ? (
            <p className="gamecrafter-page-empty">
              No skills are available in this scope yet. Install a skill or choose another Project.
            </p>
          ) : (
            <div className="gamecrafter-skills-card-list">
              {this.skills.map((skill) => (
                <article
                  className="gamecrafter-page-panel gamecrafter-skill-card"
                  key={`${skill.scope}:${skill.location}`}
                >
                  <header>
                    <div>
                      <h3>{skill.name}</h3>
                      <div className="gamecrafter-page-meta">
                        <span className="gamecrafter-page-meta-item">
                          {skill.source === 'builtin:gamecrafter' ? 'Bundled' : skill.scope}
                        </span>
                        {skill.version && (
                          <span className="gamecrafter-page-meta-item">v{skill.version}</span>
                        )}
                        {skill.shadowedBy && (
                          <span className="gamecrafter-page-meta-item">
                            Shadowed by {skill.shadowedBy}
                          </span>
                        )}
                      </div>
                    </div>
                    {skill.scope === 'platform' ? (
                      <label className="gamecrafter-skills-inline-checkbox">
                        <input
                          aria-label={`Enable skill ${skill.name}`}
                          type="checkbox"
                          checked={skill.enablement?.enabled ?? false}
                          onChange={(event) =>
                            void this.updateEnablement(skill, {
                              enabled: event.currentTarget.checked,
                            })
                          }
                        />
                        Enabled
                      </label>
                    ) : (
                      <span>Project-local</span>
                    )}
                  </header>
                  <p>{skill.description}</p>
                  {skill.scope === 'platform' && (
                    <details className="gamecrafter-page-advanced">
                      <summary>Eligibility and diagnostics</summary>
                      <label>
                        Roles override
                        <input
                          aria-label={`Skill roles ${skill.name}`}
                          defaultValue={skill.enablement?.roles?.join(', ') ?? ''}
                          placeholder="Any role"
                          onBlur={(event) =>
                            void this.updateEnablement(skill, {
                              roles: parseOverride(event.currentTarget.value),
                            })
                          }
                        />
                      </label>
                      <label>
                        Work types override
                        <input
                          aria-label={`Skill work types ${skill.name}`}
                          defaultValue={skill.enablement?.workTypes?.join(', ') ?? ''}
                          placeholder="Any work type"
                          onBlur={(event) =>
                            void this.updateEnablement(skill, {
                              workTypes: parseOverride(event.currentTarget.value),
                            })
                          }
                        />
                      </label>
                      {skill.warnings.length > 0 && (
                        <ul className="gamecrafter-skills-warnings">
                          {skill.warnings.map((warning) => (
                            <li key={warning}>{warning}</li>
                          ))}
                        </ul>
                      )}
                    </details>
                  )}
                  <footer>
                    <button
                      type="button"
                      aria-current={
                        this.readingSkill?.location === skill.location ? 'true' : undefined
                      }
                      disabled={
                        !this.selectedProjectId ||
                        skill.shadowedBy !== null ||
                        (skill.scope === 'platform' && !skill.enablement?.enabled)
                      }
                      onClick={() => {
                        this.readingSkill = skill;
                        this.readingResource = 'SKILL.md';
                        this.resourcePage = undefined;
                        void this.readResource(1, true);
                      }}
                    >
                      Read guide
                    </button>
                    {skill.scope === 'platform' && skill.source !== 'builtin:gamecrafter' && (
                      <button type="button" onClick={() => void this.uninstallSkill(skill.name)}>
                        Uninstall
                      </button>
                    )}
                  </footer>
                </article>
              ))}
            </div>
          )}
        </section>

        <section
          className="gamecrafter-skills-section gamecrafter-page-panel"
          id="gamecrafter-skills-catalog"
          hidden={this.activeSection !== 'catalog'}
        >
          <h2>Preview catalog</h2>
          <details className="gamecrafter-page-advanced">
            <summary>Catalog matching criteria</summary>
            <div className="gamecrafter-skills-catalog-form">
              <label>
                Agent role
                <input
                  aria-label="Catalog agent role"
                  list="gamecrafter-skill-roles"
                  value={this.catalogRole}
                  onChange={(event) => {
                    this.catalogRole = event.currentTarget.value;
                    this.catalogPreviewed = false;
                    this.catalog = [];
                    this.update();
                  }}
                />
              </label>
              <datalist id="gamecrafter-skill-roles">
                {this.roles.map((role) => (
                  <option key={role.name} value={role.name} />
                ))}
              </datalist>
              <label>
                Work type
                <input
                  aria-label="Catalog work type"
                  value={this.catalogWorkType}
                  onChange={(event) => {
                    this.catalogWorkType = event.currentTarget.value;
                    this.catalogPreviewed = false;
                    this.catalog = [];
                    this.update();
                  }}
                />
              </label>
              <label className="gamecrafter-skills-task-text">
                Task text
                <input
                  aria-label="Catalog task text"
                  value={this.taskText}
                  onChange={(event) => {
                    this.taskText = event.currentTarget.value;
                    this.catalogPreviewed = false;
                    this.catalog = [];
                    this.update();
                  }}
                />
              </label>
            </div>
          </details>
          <button
            type="button"
            disabled={!this.selectedProjectId}
            onClick={() => void this.previewCatalog()}
          >
            Preview catalog
          </button>
          {this.catalogPreviewed && this.catalog.length === 0 && (
            <p className="gamecrafter-page-empty">No eligible skills match these criteria.</p>
          )}
          {!this.catalogPreviewed && (
            <p className="gamecrafter-page-empty">
              Preview eligible skills for a role, work type, or task. Empty criteria show the
              default Project catalog.
            </p>
          )}
          {this.catalog.length > 0 && (
            <>
              {this.catalogTruncated && (
                <p role="status">Catalog truncated; use skill search for more eligible skills.</p>
              )}
              <ol className="gamecrafter-skills-catalog-list">
                {this.catalog.map((entry) => (
                  <li key={`${entry.scope}:${entry.location}`}>
                    <strong>{entry.name}</strong>{' '}
                    <span>
                      ({entry.scope}, score {entry.score.toFixed(2)})
                    </span>
                    <p>{entry.description}</p>
                    <code>{entry.location}</code>
                  </li>
                ))}
              </ol>
            </>
          )}
        </section>

        <section
          className="gamecrafter-skills-section gamecrafter-page-panel"
          id="gamecrafter-skills-roles"
          hidden={this.activeSection !== 'roles'}
        >
          <h2>Roles</h2>
          {this.roles.length === 0 ? (
            <p className="gamecrafter-page-empty">No roles are registered yet.</p>
          ) : (
            <div className="gamecrafter-skills-card-list">
              {this.roles.map((role) => (
                <article className="gamecrafter-page-panel" key={`${role.scope}:${role.name}`}>
                  <h3>{role.name}</h3>
                  <div className="gamecrafter-page-meta">
                    <span className="gamecrafter-page-meta-item">{role.scope}</span>
                    <span className="gamecrafter-page-meta-item">
                      Work types: {role.workTypes.join(', ') || 'Any'}
                    </span>
                    <span className="gamecrafter-page-meta-item">Max access: {role.maxAccess}</span>
                  </div>
                  <p>{role.description}</p>
                </article>
              ))}
            </div>
          )}
        </section>
      </div>
    );
  }

  private async readResource(startLine: number, reveal = false): Promise<void> {
    if (!this.selectedProjectId || !this.readingSkill) return;
    const readingSkill = this.readingSkill;
    const projectId = this.selectedProjectId;
    const generation = ++this.readGeneration;
    this.readPending = true;
    this.errorMessage = undefined;
    this.update();
    try {
      const result = await this.controlRoomService.readSkillResource({
        projectId: this.selectedProjectId,
        name: this.readingSkill.name,
        resource: this.readingResource,
        startLine,
        maxLines: 200,
      });
      if (generation === this.readGeneration) this.resourcePage = result;
    } catch (error) {
      if (generation === this.readGeneration)
        this.errorMessage = error instanceof Error ? error.message : String(error);
    } finally {
      if (generation === this.readGeneration) {
        this.readPending = false;
        this.update();
        if (reveal && this.resourcePage) {
          requestAnimationFrame(() => {
            if (this.readingSkill === readingSkill && this.selectedProjectId === projectId)
              this.node
                .querySelector('.gamecrafter-skill-reader')
                ?.scrollIntoView({ block: 'start' });
          });
        }
      }
    }
  }

  private async refresh(): Promise<void> {
    const version = ++this.refreshVersion;
    try {
      const projects = await this.controlRoomService.listProjects();
      if (version !== this.refreshVersion || this.isDisposed) return;
      const projectId =
        (await this.resolveProjectSelection(projects, () => this.selectedProjectId)) || undefined;
      if (version !== this.refreshVersion || this.isDisposed) return;
      this.projects = projects;
      this.selectedProjectId = projectId;
      const [skills, roles] = await Promise.all([
        this.controlRoomService.listSkills(projectId),
        this.controlRoomService.listRoles(projectId),
      ]);
      if (
        version !== this.refreshVersion ||
        projectId !== this.selectedProjectId ||
        this.isDisposed
      )
        return;
      this.skills = skills;
      this.roles = roles;
      this.errorMessage = undefined;
    } catch (error) {
      if (version !== this.refreshVersion || this.isDisposed) return;
      this.errorMessage = error instanceof Error ? error.message : String(error);
    }
    this.update();
  }

  private async run(operation: () => Promise<unknown>): Promise<void> {
    try {
      this.errorMessage = undefined;
      this.resultMessage = undefined;
      await operation();
      await this.refresh();
    } catch (error) {
      this.errorMessage = error instanceof Error ? error.message : String(error);
      this.update();
    }
  }

  private async installSkills(): Promise<void> {
    await this.run(async () => {
      const installed = await this.controlRoomService.installSkills(
        this.source.trim(),
        this.installName.trim() || undefined,
        this.forceInstall,
      );
      this.resultMessage = `Installed ${installed.map((skill) => skill.name).join(', ')}.`;
      this.source = '';
      this.installName = '';
    });
  }

  private async uninstallSkill(name: string): Promise<void> {
    await this.run(async () => {
      await this.controlRoomService.uninstallSkill(name);
      this.resultMessage = `Uninstalled ${name}.`;
    });
  }

  private async updateEnablement(
    skill: ProjectSkillEntry,
    patch: { enabled?: boolean; roles?: string[] | null; workTypes?: string[] | null },
  ): Promise<void> {
    if (skill.scope !== 'platform' || !this.selectedProjectId) return;
    await this.run(() =>
      this.controlRoomService.enableSkill({
        projectId: this.selectedProjectId!,
        name: skill.name,
        enabled: patch.enabled ?? skill.enablement?.enabled ?? false,
        ...(patch.roles === undefined ? {} : { roles: patch.roles }),
        ...(patch.workTypes === undefined ? {} : { workTypes: patch.workTypes }),
      }),
    );
  }

  private async previewCatalog(): Promise<void> {
    if (!this.selectedProjectId) return;
    await this.run(async () => {
      const result = await this.controlRoomService.previewSkillCatalog({
        projectId: this.selectedProjectId!,
        agentRole: this.catalogRole || undefined,
        workType: this.catalogWorkType || undefined,
        taskText: this.taskText || undefined,
      });
      this.catalog = result.entries;
      this.catalogTruncated = result.truncated;
      this.catalogPreviewed = true;
    });
  }

  private async trustProject(): Promise<void> {
    if (!this.selectedProjectId) return;
    await this.run(() => this.controlRoomService.trustProject(this.selectedProjectId!, true));
  }
}

function parseOverride(value: string): string[] | null {
  const values = [
    ...new Set(
      value
        .split(',')
        .map((item) => item.trim())
        .filter(Boolean),
    ),
  ];
  return values.length > 0 ? values : null;
}

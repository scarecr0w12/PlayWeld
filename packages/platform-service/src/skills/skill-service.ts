import {
  RpcError,
  RpcErrorCode,
  type AccessMode,
  type RoleRecord,
  type SkillActivation,
  type SkillActivationResult,
  type SkillCatalogEntry,
  type SkillEnablement,
  type SkillRecord,
  type SkillResourceReadParams,
  type SkillResourceReadResult,
  type TaskRecord,
} from '@gamecrafter/contracts';
import type { SettingsService } from '../settings/settings-service';
import type { TaskService } from '../tasks/task-service';
import { SkillCatalog, type SkillCatalogRequest } from './skill-catalog';
import { SkillInstaller } from './skill-installer';
import { SkillRegistry, type SkillEnableInput } from './skill-registry';
import { loadSkillDir } from './skill-loader';
import { readSkillResource } from './skill-resource';
import type { RoleRegistry } from '../roles/role-registry';

export class SkillService {
  constructor(
    private readonly installer: SkillInstaller,
    private readonly registry: SkillRegistry,
    private readonly catalogService: SkillCatalog,
    private readonly roles: RoleRegistry,
    private readonly tasks: TaskService,
    private readonly settings: SettingsService,
  ) {}

  install(source: string, name?: string, force = false): Promise<SkillRecord[]> {
    return this.installer.install(source, name, force);
  }

  uninstall(name: string): void {
    this.installer.uninstall(name);
  }

  list(projectId: string): ReturnType<SkillRegistry['listForProject']> {
    return this.registry.listForProject(projectId);
  }

  listPlatform(): ReturnType<SkillRegistry['listPlatform']> {
    return this.registry.listPlatform();
  }

  enable(projectId: string, input: SkillEnableInput): SkillEnablement {
    return this.registry.enable(projectId, input);
  }

  catalog(request: SkillCatalogRequest, sessionId?: string): ReturnType<SkillCatalog['catalog']> {
    return this.catalogService.catalog({
      ...request,
      accessMode: request.accessMode ?? this.accessMode(request.projectId, sessionId),
    });
  }

  search(
    projectId: string,
    query: string,
    agentRole?: string,
    workType?: string,
    sessionId?: string,
  ): SkillCatalogEntry[] {
    return this.catalogService.search({
      projectId,
      query,
      agentRole,
      workType,
      accessMode: this.accessMode(projectId, sessionId),
    });
  }

  searchForTask(
    projectId: string,
    query: string,
    taskId?: string,
    effectiveAccessMode?: AccessMode,
  ): SkillCatalogEntry[] {
    const task = taskId ? this.tasks.get(projectId, taskId) : undefined;
    return this.catalogService.search({
      projectId,
      query,
      agentRole: task?.assignee?.role,
      workType: this.taskWorkType(task),
      accessMode: effectiveAccessMode ?? this.accessMode(projectId),
    });
  }

  async activate(
    projectId: string,
    name: string,
    taskId?: string,
    agentId?: string,
    sessionId?: string,
    effectiveAccessMode?: AccessMode,
  ): Promise<SkillActivationResult> {
    this.assertEligible(projectId, name, taskId, sessionId, effectiveAccessMode);
    return this.registry.activate(projectId, name, taskId, agentId);
  }

  readResource(
    request: SkillResourceReadParams,
    sessionId?: string,
    effectiveAccessMode?: AccessMode,
  ): SkillResourceReadResult {
    this.assertEligible(
      request.projectId,
      request.name,
      request.taskId,
      sessionId,
      effectiveAccessMode,
    );
    return readSkillResource(
      this.registry.activatableSkill(request.projectId, request.name),
      request,
    );
  }

  private assertEligible(
    projectId: string,
    name: string,
    taskId?: string,
    sessionId?: string,
    effectiveAccessMode?: AccessMode,
  ): void {
    this.registry.activatableSkill(projectId, name);
    const task = taskId ? this.tasks.get(projectId, taskId) : undefined;
    const accessMode = effectiveAccessMode ?? this.accessMode(projectId, sessionId);
    const eligible = this.catalogService
      .catalog(
        {
          projectId,
          agentRole: task?.assignee?.role,
          workType: this.taskWorkType(task),
          taskText: task?.goal,
          accessMode,
        },
        false,
      )
      .entries.some((entry) => entry.name === name);
    if (!eligible) {
      throw new RpcError(
        `Skill is not eligible for this task and access mode: ${name}`,
        RpcErrorCode.SkillNotFound,
      );
    }
  }

  private taskWorkType(task: TaskRecord | undefined): string | undefined {
    if (!task || task.kind !== 'agent.run') return task?.kind;
    const roleName = task.role ?? task.assignee?.role;
    if (!roleName) return task.kind;
    // Match agent/model routing: the primary role work type describes the
    // semantic task, while agent.run only identifies its execution handler.
    const input = task.input as { role?: RoleRecord } | null;
    const role =
      input?.role?.name === roleName ? input.role : this.roles.get(roleName, task.projectId);
    return role.workTypes[0] ?? 'coordination';
  }

  validate(directory: string): {
    ok: boolean;
    errors: string[];
    warnings: string[];
    record: SkillRecord | null;
  } {
    try {
      const record = loadSkillDir(directory, 'project', directory);
      return { ok: true, errors: [], warnings: record.warnings, record };
    } catch (error) {
      const errors =
        error instanceof RpcError &&
        Array.isArray((error.data as { errors?: unknown } | undefined)?.errors)
          ? ((error.data as { errors: string[] }).errors ?? [])
          : [error instanceof Error ? error.message : String(error)];
      return { ok: false, errors, warnings: [], record: null };
    }
  }

  activations(projectId: string, taskId?: string): SkillActivation[] {
    return this.registry.activations(projectId, taskId);
  }

  listRoles(projectId?: string): RoleRecord[] {
    return this.roles.list(projectId);
  }

  getRole(name: string, projectId?: string): RoleRecord {
    return this.roles.get(name, projectId);
  }

  readableSkillRoots(projectId: string): string[] {
    return this.registry.readableSkillRoots(projectId);
  }

  private accessMode(projectId: string, sessionId?: string): AccessMode {
    return this.settings.resolve('access.mode', { projectId, sessionId }).value as AccessMode;
  }
}

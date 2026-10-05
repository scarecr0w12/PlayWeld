import { existsSync } from 'node:fs';
import path from 'node:path';
import {
  RpcError,
  RpcErrorCode,
  ACCESS_MODE_RANK,
  minAccessMode,
  redact,
  uuidv7,
  type AccessMode,
  type ApprovalRequest,
  type TaskRecord,
  type ToolCallError,
  type ToolCallRecord,
  type ToolDefinition,
} from '@gamecrafter/contracts';
import type { ProfileStore } from '../profile/profile-store';
import type { ProjectDatabases } from '../projects/project-databases';
import type { SettingsService } from '../settings/settings-service';
import type { TaskService } from '../tasks/task-service';
import type { RoleRegistry } from '../roles/role-registry';
import type { LockManager } from '../change/lock-manager';
import { ToolStore, normalizeRecordedCall } from './tool-store';
import {
  ToolRegistry,
  type RegisteredTool,
  type ToolContext,
  type ToolExecutionResult,
} from './tool-registry';

export interface ToolBrokerEvents {
  approvalRequested(projectId: string, approval: ApprovalRequest): void;
  approvalResolved(projectId: string, approval: ApprovalRequest): void;
  toolCalled(projectId: string, call: ToolCallRecord): void;
}

export interface ToolLockRequirement {
  resource: string;
  mode: 'shared' | 'exclusive';
}

export interface ToolBrokerOptions {
  registry: ToolRegistry;
  settings: SettingsService;
  projectDatabases: ProjectDatabases;
  projects: ProfileStore;
  tasks: TaskService;
  roles?: RoleRegistry;
  locks?: Pick<LockManager, 'assertHeld'>;
  requiredLocks?: (
    request: ToolCallRequest,
    tool: ToolDefinition,
    task: TaskRecord | undefined,
  ) => ToolLockRequirement[] | Promise<ToolLockRequirement[]>;
  events: ToolBrokerEvents;
  isToolAvailable?: (tool: ToolDefinition, projectId: string) => boolean;
  now?: () => Date;
  approvalTimeoutOverrideMs?: number;
}

export interface ToolCallRequest {
  projectId: string;
  toolId: string;
  input: unknown;
  taskId?: string;
  agentId?: string;
  accessCeiling?: AccessMode;
}

export interface ToolCallContext {
  sessionId?: string;
  accessCeiling?: AccessMode;
  agentRole?: string | null;
  projectPathOverride?: string;
  signal?: AbortSignal;
}

type ApprovalWaitResult =
  | { kind: 'resolved'; approval: ApprovalRequest }
  | { kind: 'timed-out' }
  | { kind: 'stopped'; reason: string };

interface ApprovalWaiter {
  resolve(result: ApprovalWaitResult): void;
  timer: NodeJS.Timeout;
  removeAbort(): void;
}

export class ToolBroker {
  private readonly stores = new Map<string, ToolStore>();
  private readonly waiters = new Map<string, ApprovalWaiter>();
  private readonly controllers = new Map<string, AbortController>();
  private readonly activeCalls = new Set<Promise<ToolCallRecord>>();
  private readonly now: () => Date;

  constructor(private readonly options: ToolBrokerOptions) {
    this.now = options.now ?? (() => new Date());
  }

  listTools(
    projectId?: string,
    options: { agentRole?: string; includeInternal?: boolean; accessCeiling?: AccessMode } = {},
  ): ToolDefinition[] {
    return this.inspectTools(projectId, options).tools;
  }

  inspectTools(
    projectId?: string,
    options: { agentRole?: string; includeInternal?: boolean; accessCeiling?: AccessMode } = {},
  ): { tools: ToolDefinition[]; excluded: Array<{ toolId: string; reason: string }> } {
    if (projectId) this.requireProject(projectId);
    const excluded: Array<{ toolId: string; reason: string }> = [];
    const exclude = (toolId: string, reason: string): false => {
      excluded.push({ toolId, reason });
      return false;
    };
    const tools = this.options.registry.list().filter((tool) => {
      const internal = tool.source.endsWith('-internal');
      if (internal && !options.includeInternal) return exclude(tool.toolId, 'internal_tool');
      if (projectId && tool.source.startsWith('plugin:')) {
        if (!(this.options.isToolAvailable?.(tool, projectId) ?? false))
          return exclude(tool.toolId, 'unavailable_for_project');
      } else if (projectId && !(this.options.isToolAvailable?.(tool, projectId) ?? true)) {
        return exclude(tool.toolId, 'unavailable_for_project');
      }
      if (projectId && options.agentRole && !internal) {
        if (!this.roleAllows(options.agentRole, projectId, tool.toolId))
          return exclude(tool.toolId, 'role_tool_denied');
      }
      if (projectId && options.accessCeiling && !internal) {
        const configured = this.options.settings.resolve('access.mode', { projectId })
          .value as AccessMode;
        const mode = minAccessMode(configured, options.accessCeiling);
        const policy = this.decisionFor(projectId, tool, mode);
        if (policy.decision === 'denied') return exclude(tool.toolId, policy.reason);
      }
      return true;
    });
    return { tools, excluded };
  }

  async call(request: ToolCallRequest, context: ToolCallContext = {}): Promise<ToolCallRecord> {
    const operation = this.executeCall(request, context);
    this.activeCalls.add(operation);
    try {
      return await operation;
    } finally {
      this.activeCalls.delete(operation);
    }
  }

  listCalls(
    projectId: string,
    filter: { taskId?: string; toolId?: string; limit?: number } = {},
  ): ToolCallRecord[] {
    return this.store(projectId).calls(filter);
  }

  listApprovals(projectId: string, pendingOnly = false): ApprovalRequest[] {
    return this.store(projectId).approvals(pendingOnly);
  }

  approve(
    projectId: string,
    approvalId: string,
    approve: boolean,
    reason?: string,
  ): ApprovalRequest {
    const store = this.store(projectId);
    const existing = store.getApproval(approvalId);
    if (!existing) {
      throw new RpcError(`Approval not found: ${approvalId}`, RpcErrorCode.ApprovalNotFound);
    }
    const approval = store.resolveApproval(
      approvalId,
      this.now().toISOString(),
      approve,
      reason ?? null,
    );
    this.options.events.approvalResolved(projectId, approval);
    const waiter = this.waiters.get(approvalId);
    if (waiter) {
      clearTimeout(waiter.timer);
      waiter.removeAbort();
      this.waiters.delete(approvalId);
      waiter.resolve({ kind: 'resolved', approval });
    }
    return approval;
  }

  async recoverOnStart(): Promise<void> {
    for (const project of this.options.projects.list()) {
      if (
        !existsSync(project.path) ||
        !existsSync(path.join(project.path, 'gamecrafter.project.json'))
      ) {
        continue;
      }
      const store = this.store(project.projectId);
      const timeoutMs = this.approvalTimeoutMs(project.projectId);
      const now = this.now();
      for (const call of store.pendingCalls()) {
        const approval = store.getApprovalForCall(call.callId);
        if (approval && approval.resolvedAt === null) {
          const ageMs = now.getTime() - Date.parse(approval.requestedAt);
          if (ageMs >= timeoutMs) {
            const timedOut = store.resolveApproval(
              approval.approvalId,
              now.toISOString(),
              null,
              'Approval timed out',
            );
            this.options.events.approvalResolved(project.projectId, timedOut);
          }
        }
        this.finishRecord(store, {
          ...call,
          decisionReason: 'service_restart',
          status: 'failed',
          error: { message: 'Tool call interrupted by service restart', code: 'service_restart' },
          finishedAt: now.toISOString(),
        });
      }
    }
  }

  async stopAll(): Promise<void> {
    for (const controller of this.controllers.values()) controller.abort('service_stop');
    for (const [approvalId, waiter] of this.waiters) {
      clearTimeout(waiter.timer);
      waiter.removeAbort();
      this.waiters.delete(approvalId);
      waiter.resolve({ kind: 'stopped', reason: 'service_stop' });
    }
    await Promise.allSettled([...this.activeCalls]);
  }

  private async executeCall(
    request: ToolCallRequest,
    context: ToolCallContext,
  ): Promise<ToolCallRecord> {
    const project = this.requireProject(request.projectId);
    const task = request.taskId
      ? this.options.tasks.get(request.projectId, request.taskId)
      : undefined;
    const registeredTool = this.options.registry.get(request.toolId);
    const tool =
      registeredTool &&
      this.options.isToolAvailable?.(registeredTool.definition, request.projectId) === false
        ? undefined
        : registeredTool;
    const store = this.store(request.projectId);
    const callId = uuidv7();
    const accessMode = this.effectiveMode(
      request.projectId,
      context,
      request,
      task?.assignee?.accessCeiling,
    );
    const startedAt = this.now().toISOString();
    if (!tool) {
      this.finishRecord(store, {
        callId,
        projectId: request.projectId,
        taskId: request.taskId ?? null,
        agentId: request.agentId ?? task?.assignee?.agentId ?? null,
        toolId: request.toolId,
        input: redact(request.input),
        accessMode,
        decision: 'denied',
        decisionReason: 'tool_not_found',
        status: 'failed',
        output: null,
        error: {
          message: `Tool not found: ${request.toolId}`,
          code: String(RpcErrorCode.ToolNotFound),
        },
        evidence: [],
        costUsd: 0,
        costStatus: 'untracked',
        startedAt,
        finishedAt: this.now().toISOString(),
      });
      throw new RpcError(`Tool not found: ${request.toolId}`, RpcErrorCode.ToolNotFound);
    }

    const inputErrors = this.options.registry.validateInput(tool, request.input);
    let record: ToolCallRecord = {
      callId,
      projectId: request.projectId,
      taskId: request.taskId ?? null,
      agentId: request.agentId ?? task?.assignee?.agentId ?? null,
      toolId: request.toolId,
      input: redact(request.input),
      accessMode,
      decision: 'allowed',
      decisionReason: 'full_access',
      status: 'pending',
      output: null,
      error: null,
      evidence: [],
      costUsd: 0,
      costStatus: 'untracked',
      startedAt,
      finishedAt: null,
    };

    if (inputErrors.length > 0) {
      record = this.finishRecord(store, {
        ...record,
        decision: 'denied',
        decisionReason: 'input_validation_failed',
        status: 'failed',
        error: {
          message: 'Tool input does not match its schema',
          code: String(RpcErrorCode.ToolInputInvalid),
        },
      });
      throw new RpcError(
        `Invalid input for tool ${request.toolId}`,
        RpcErrorCode.ToolInputInvalid,
        inputErrors,
      );
    }

    const agentRole = context.agentRole ?? task?.assignee?.role ?? task?.role ?? null;
    if (
      agentRole &&
      !tool.definition.source.endsWith('-internal') &&
      !this.roleAllows(agentRole, request.projectId, request.toolId)
    ) {
      const message = `Role ${agentRole} cannot use ${request.toolId}`;
      this.finishRecord(store, {
        ...record,
        decision: 'denied',
        decisionReason: 'role_tool_denied',
        status: 'denied',
        error: { message, code: String(RpcErrorCode.RoleToolDenied) },
      });
      throw new RpcError(message, RpcErrorCode.RoleToolDenied);
    }

    const requiredLocks =
      (await this.options.requiredLocks?.(request, tool.definition, task)) ?? [];
    for (const requiredLock of requiredLocks) {
      try {
        if (!request.taskId || !this.options.locks) {
          throw new RpcError('A required resource lock is not held.', RpcErrorCode.LockNotHeld, {
            resource: requiredLock.resource,
            mode: requiredLock.mode,
          });
        }
        this.options.locks.assertHeld(
          request.projectId,
          request.taskId,
          requiredLock.resource,
          requiredLock.mode,
        );
      } catch (error) {
        const lockError =
          error instanceof RpcError && error.code === RpcErrorCode.LockNotHeld
            ? error
            : new RpcError('A required resource lock is not held.', RpcErrorCode.LockNotHeld, {
                resource: requiredLock.resource,
                mode: requiredLock.mode,
              });
        const message = lockError.message;
        this.finishRecord(store, {
          ...record,
          decision: 'denied',
          decisionReason: 'required_lock_not_held',
          status: 'failed',
          error: { message, code: String(RpcErrorCode.LockNotHeld) },
        });
        throw lockError;
      }
    }

    const policy = this.decisionFor(request.projectId, tool.definition, accessMode);
    record = {
      ...record,
      decision: policy.decision,
      decisionReason: policy.reason,
    };
    if (policy.decision === 'denied') {
      this.finishRecord(store, {
        ...record,
        status: 'denied',
        error: { message: policy.reason, code: String(RpcErrorCode.ToolDenied) },
      });
      throw new RpcError(policy.reason, RpcErrorCode.ToolDenied);
    }

    if (policy.decision === 'approval-required') {
      store.insertCall(record);
      const approval = this.createApproval(request, tool.definition, record);
      store.insertApproval(approval);
      this.options.events.approvalRequested(request.projectId, approval);
      const approvalResult = await this.waitForApproval(
        approval,
        this.approvalTimeoutMs(request.projectId, context.sessionId),
        store,
        context.signal,
      );
      if (approvalResult.kind === 'timed-out') {
        return this.finishRecord(store, {
          ...record,
          decision: 'timed-out',
          decisionReason: 'approval_timed_out',
          status: 'timed-out',
          error: { message: 'Approval timed out', code: 'approval_timeout' },
        });
      }
      if (approvalResult.kind === 'stopped') {
        if (approvalResult.reason === 'service_stop') {
          return {
            ...record,
            decisionReason: 'service_stop',
            status: 'failed',
            error: { message: 'Tool call interrupted by service stop', code: 'service_stop' },
            finishedAt: this.now().toISOString(),
          };
        }
        const pendingApproval = store.getApprovalForCall(record.callId);
        if (pendingApproval?.resolvedAt === null) {
          const resolved = store.resolveApproval(
            pendingApproval.approvalId,
            this.now().toISOString(),
            null,
            approvalResult.reason,
          );
          this.options.events.approvalResolved(request.projectId, resolved);
        }
        return this.finishRecord(store, {
          ...record,
          decisionReason: approvalResult.reason,
          status: 'failed',
          error: { message: 'Tool call was cancelled', code: approvalResult.reason },
        });
      }
      if (approvalResult.approval.approved !== true) {
        const reason = approvalResult.approval.reason ?? 'Tool call rejected by user';
        this.finishRecord(store, {
          ...record,
          decision: 'rejected',
          decisionReason: reason,
          status: 'rejected',
          error: { message: reason, code: String(RpcErrorCode.ToolDenied) },
        });
        throw new RpcError(reason, RpcErrorCode.ToolDenied);
      }
      record = {
        ...record,
        decision: 'approved',
        decisionReason: approvalResult.approval.reason ?? 'approved_by_user',
      };
    } else {
      store.insertCall(record);
    }

    return this.runTool(
      store,
      request.toolId.startsWith('fs/') && context.projectPathOverride
        ? context.projectPathOverride
        : project.path,
      tool,
      record,
      request.input,
      context.agentRole ?? task?.assignee?.role ?? null,
      context.signal,
    );
  }

  private async runTool(
    store: ToolStore,
    projectPath: string,
    tool: RegisteredTool,
    record: ToolCallRecord,
    input: unknown,
    agentRole: string | null,
    callerSignal?: AbortSignal,
  ): Promise<ToolCallRecord> {
    const controller = new AbortController();
    const abortFromCaller = () => controller.abort(callerSignal?.reason ?? 'cancelled');
    callerSignal?.addEventListener('abort', abortFromCaller, { once: true });
    if (callerSignal?.aborted) abortFromCaller();
    this.controllers.set(record.callId, controller);
    const timeoutMs = this.executionTimeoutMs(tool.definition, input);
    const timer = setTimeout(() => controller.abort('tool_timeout'), timeoutMs);
    try {
      const context: ToolContext = {
        projectId: record.projectId,
        projectPath,
        taskId: record.taskId,
        agentId: record.agentId,
        agentRole,
        accessMode: record.accessMode,
        callId: record.callId,
        signal: controller.signal,
        ...(record.taskId
          ? {
              reportProgress: (progress: unknown) => {
                this.options.tasks.recordExternalProgress(record.projectId, record.taskId!, {
                  toolId: record.toolId,
                  callId: record.callId,
                  progress,
                });
              },
            }
          : {}),
      };
      const result: ToolExecutionResult = await tool.handler(context, input);
      const costUsd = result.costUsd === null ? null : (result.costUsd ?? null);
      const costStatus =
        result.costStatus ??
        (result.costUsd === undefined
          ? 'untracked'
          : result.costUsd === null
            ? 'unknown'
            : 'known');
      const outputErrors = this.options.registry.validateOutput(tool, result.output);
      if (outputErrors.length > 0) {
        return this.finishRecord(store, {
          ...record,
          status: 'failed',
          error: { message: 'Tool output does not match its schema', code: 'invalid_output' },
          costUsd: costUsd === null ? 0 : Math.max(0, costUsd),
          costStatus,
          finishedAt: this.now().toISOString(),
        });
      }
      return this.finishRecord(store, {
        ...record,
        status: 'completed',
        output: result.output,
        evidence: result.evidence ?? [],
        costUsd: costUsd === null ? 0 : Math.max(0, costUsd),
        costStatus,
        finishedAt: this.now().toISOString(),
      });
    } catch (error) {
      const abortReason = String(controller.signal.reason ?? '');
      const failedCostStatus = tool.definition.sideEffects === 'paid' ? 'unknown' : 'untracked';
      if (abortReason === 'service_stop') {
        return this.finishRecord(store, {
          ...record,
          decisionReason: 'service_stop',
          status: 'failed',
          costStatus: failedCostStatus,
          error: { message: 'Tool call interrupted by service stop', code: 'service_stop' },
          finishedAt: this.now().toISOString(),
        });
      }
      const timedOut = abortReason === 'tool_timeout' || isTimeoutError(error);
      const callError = asToolError(error);
      const finalRecord = this.finishRecord(store, {
        ...record,
        status: timedOut ? 'timed-out' : 'failed',
        decisionReason: timedOut ? 'tool_timeout' : record.decisionReason,
        costStatus: failedCostStatus,
        error: timedOut ? { message: 'Tool execution timed out', code: 'tool_timeout' } : callError,
        finishedAt: this.now().toISOString(),
      });
      if (error instanceof RpcError) throw error;
      return finalRecord;
    } finally {
      clearTimeout(timer);
      callerSignal?.removeEventListener('abort', abortFromCaller);
      this.controllers.delete(record.callId);
    }
  }

  private finishRecord(store: ToolStore, record: ToolCallRecord): ToolCallRecord {
    const storedRecord: ToolCallRecord = normalizeRecordedCall({
      ...record,
      input: redact(record.input),
      output: redact(record.output),
      error: record.error === null ? null : redact(record.error),
      evidence: redact(record.evidence),
      finishedAt: record.finishedAt ?? this.now().toISOString(),
    });
    store.finalizeCall(storedRecord);
    this.options.events.toolCalled(record.projectId, storedRecord);
    return { ...storedRecord, input: record.input, output: record.output };
  }

  private roleAllows(roleName: string, projectId: string, toolId: string): boolean {
    if (roleName.startsWith('plugin:') || !this.options.roles) return true;
    try {
      const role = this.options.roles.get(roleName, projectId);
      const permissionToolId = toolId === 'board/propose-decision' ? 'board/post' : toolId;
      const roleAllowsSkillTools =
        (toolId === 'skills/activate' ||
          toolId === 'skills/search' ||
          toolId === 'skills/read-resource') &&
        role.skills.length > 0;
      const roleAllowsLockTools = toolId.startsWith('locks/') && role.locks.length > 0;
      const roleAllowsMemory = toolId === 'memory/write' && role.memory === 'project';
      return (
        (roleAllowsSkillTools ||
          roleAllowsLockTools ||
          roleAllowsMemory ||
          role.tools.some((pattern) => matchesToolGlob(pattern, permissionToolId))) &&
        !role.disallowedTools.some((pattern) => matchesToolGlob(pattern, permissionToolId))
      );
    } catch {
      return false;
    }
  }

  private effectiveMode(
    projectId: string,
    context: ToolCallContext,
    request: ToolCallRequest,
    taskCeiling?: AccessMode,
  ): AccessMode {
    const setting = this.options.settings.resolve('access.mode', {
      projectId,
      sessionId: context.sessionId,
    }).value as AccessMode;
    return [setting, context.accessCeiling, request.accessCeiling, taskCeiling]
      .filter((value): value is AccessMode => value !== undefined)
      .reduce((mode, ceiling) => minAccessMode(mode, ceiling), setting);
  }

  private decisionFor(
    projectId: string,
    definition: ToolDefinition,
    accessMode: AccessMode,
  ): { decision: ToolCallRecord['decision']; reason: string } {
    if (
      definition.minAccessMode &&
      ACCESS_MODE_RANK[accessMode] < ACCESS_MODE_RANK[definition.minAccessMode]
    ) {
      return {
        decision: 'denied',
        reason: `Tool ${definition.toolId} requires ${definition.minAccessMode} access or higher.`,
      };
    }
    if (accessMode === 'full') return { decision: 'allowed', reason: 'full_access' };
    if (accessMode === 'restricted') {
      const allowedSideEffects = this.options.settings.resolve(
        'access.restricted.allowedSideEffects',
        {
          projectId,
        },
      ).value as string[];
      const allowedTools = this.options.settings.resolve('access.restricted.allowedTools', {
        projectId,
      }).value as string[];
      if (allowedSideEffects.includes(definition.sideEffects)) {
        return { decision: 'allowed', reason: 'side_effect_allowed' };
      }
      if (allowedTools.some((glob) => matchesToolGlob(glob, definition.toolId))) {
        return { decision: 'allowed', reason: 'tool_allowlisted' };
      }
      return {
        decision: 'denied',
        reason: `Tool ${definition.toolId} with side effect ${definition.sideEffects} is not allowed in restricted mode.`,
      };
    }
    if (definition.sideEffects === 'none')
      return { decision: 'allowed', reason: 'no_side_effects' };
    return { decision: 'approval-required', reason: 'approval_required' };
  }

  private createApproval(
    request: ToolCallRequest,
    definition: ToolDefinition,
    record: ToolCallRecord,
  ): ApprovalRequest {
    return {
      approvalId: uuidv7(),
      projectId: request.projectId,
      callId: record.callId,
      toolId: definition.toolId,
      sideEffects: definition.sideEffects,
      summary: `${definition.title} (${definition.sideEffects})`,
      input: redact(request.input),
      requestedAt: this.now().toISOString(),
      resolvedAt: null,
      approved: null,
      reason: null,
    };
  }

  private waitForApproval(
    approval: ApprovalRequest,
    timeoutMs: number,
    store: ToolStore,
    signal?: AbortSignal,
  ): Promise<ApprovalWaitResult> {
    if (signal?.aborted) {
      return Promise.resolve({ kind: 'stopped', reason: String(signal.reason ?? 'cancelled') });
    }
    return new Promise((resolve) => {
      let removeAbort: () => void = () => {};
      const finish = (result: ApprovalWaitResult) => {
        const waiter = this.waiters.get(approval.approvalId);
        if (waiter) {
          clearTimeout(waiter.timer);
          waiter.removeAbort();
          this.waiters.delete(approval.approvalId);
        }
        resolve(result);
      };
      const timer = setTimeout(() => {
        const resolved = store.resolveApproval(
          approval.approvalId,
          this.now().toISOString(),
          null,
          'Approval timed out',
        );
        this.options.events.approvalResolved(approval.projectId, resolved);
        finish({ kind: 'timed-out' });
      }, timeoutMs);
      const abort = () =>
        finish({ kind: 'stopped', reason: String(signal?.reason ?? 'cancelled') });
      removeAbort = () => signal?.removeEventListener('abort', abort);
      this.waiters.set(approval.approvalId, { resolve, timer, removeAbort });
      signal?.addEventListener('abort', abort, { once: true });
      if (signal?.aborted) abort();
    });
  }

  private approvalTimeoutMs(projectId: string, sessionId?: string): number {
    if (this.options.approvalTimeoutOverrideMs !== undefined) {
      return this.options.approvalTimeoutOverrideMs;
    }
    const minutes = Number(
      this.options.settings.resolve('access.askAlways.approvalTimeoutMinutes', {
        projectId,
        sessionId,
      }).value,
    );
    return minutes * 60_000;
  }

  private executionTimeoutMs(definition: ToolDefinition, input: unknown): number {
    if (definition.toolId === 'tasks/await') {
      // Let the supervised wait return its timedOut result before the broker aborts it.
      const waitMs = Math.min(300_000, Math.max(1, Number(asRecord(input).timeoutMs) || 300_000));
      return waitMs + 1_000;
    }
    if (definition.toolId === 'process/run') {
      const timeout = Number(asRecord(input).timeoutMs ?? 60_000);
      return Number.isFinite(timeout) && timeout > 0 ? timeout : 60_000;
    }
    return 5 * 60_000;
  }

  private store(projectId: string): ToolStore {
    const existing = this.stores.get(projectId);
    if (existing) return existing;
    const store = new ToolStore(this.options.projectDatabases.get(projectId));
    this.stores.set(projectId, store);
    return store;
  }

  private requireProject(projectId: string) {
    const project = this.options.projects.getById(projectId);
    if (!project)
      throw new RpcError(`Project not found: ${projectId}`, RpcErrorCode.ProjectNotFound);
    return project;
  }
}

function matchesToolGlob(glob: string, toolId: string): boolean {
  let expression = '^';
  for (let index = 0; index < glob.length; index += 1) {
    const character = glob[index]!;
    if (character === '*' && glob[index + 1] === '*') {
      expression += '.*';
      index += 1;
    } else if (character === '*') {
      expression += '[^/]*';
    } else {
      expression += character.replace(/[|\\{}()[\]^$+?.]/g, '\\$&');
    }
  }
  expression += '$';
  return new RegExp(expression).test(toolId);
}

function isTimeoutError(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    (error.code === 'ETIMEDOUT' || error.code === 'ERR_CHILD_PROCESS_TIMEOUT')
  );
}

function asToolError(error: unknown): ToolCallError {
  const code =
    typeof error === 'object' && error !== null && 'code' in error ? error.code : undefined;
  return {
    message: error instanceof Error ? error.message : String(error),
    ...(typeof code === 'string' || typeof code === 'number' ? { code: String(code) } : {}),
  };
}

function asRecord(value: unknown): Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

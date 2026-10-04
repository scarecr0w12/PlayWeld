import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import {
  ChatRequestSchema,
  ChatResponseSchema,
  ChangeNodeRefSchema,
  RpcError,
  RpcErrorCode,
  TaskBudgetSchema,
  TaskCompletionContractSchema,
  TaskTouchSchema,
  minAccessMode,
  uuidv7,
  type ToolDefinition,
} from '@gamecrafter/contracts';
import { projectRelativePath, resolveProjectPath } from '../assets/path-utils';
import type { CompletionService, PreparedCompletion } from '../models/completion-service';
import type { ProfileStore } from '../profile/profile-store';
import type { RoleRegistry } from '../roles/role-registry';
import type { TaskService } from '../tasks/task-service';
import type { ToolContext, ToolRegistry } from '../tools/tool-registry';
import type { LockManager } from '../change/lock-manager';

export interface AgentToolOptions {
  completion: CompletionService;
  tasks: TaskService;
  roles: RoleRegistry;
  projects: ProfileStore;
  locks: LockManager;
}

export function registerAgentTools(registry: ToolRegistry, options: AgentToolOptions): void {
  const selections = new Map<
    string,
    { projectId: string; requestId: string; selectionId: string; prepared: PreparedCompletion }
  >();
  registry.register(
    tool(
      'model/prepare',
      'Select agent model',
      'Select the eligible model for this turn and read its actual context/output capacities without making a provider completion.',
      {
        type: 'object',
        properties: { requestId: { type: 'string' }, taskType: { type: 'string' } },
        required: ['requestId'],
        additionalProperties: false,
      },
      'none',
      'Selected model metadata and route decision.',
      'agent-internal',
    ),
    (context, input) => {
      const task = requireTask(options.tasks, context);
      const args = asRecord(input);
      const roleName = context.agentRole ?? task.role ?? task.assignee?.role ?? 'coordinator';
      for (const [taskId, entry] of selections) {
        try {
          if (
            ['succeeded', 'failed', 'cancelled'].includes(
              options.tasks.get(entry.projectId, taskId).state,
            )
          )
            selections.delete(taskId);
        } catch {
          selections.delete(taskId);
        }
      }
      const prepared = options.completion.prepare({
        projectId: context.projectId,
        agentRole: roleName,
        taskType:
          stringValue(args.taskType) ??
          options.roles.get(roleName, context.projectId).workTypes[0] ??
          'coordination',
      });
      const selectionId = uuidv7();
      selections.set(task.taskId, {
        projectId: context.projectId,
        requestId: String(args.requestId),
        selectionId,
        prepared,
      });
      return {
        output: {
          selectionId,
          modelId: prepared.model.modelId,
          contextWindow: prepared.model.capabilities.contextWindow,
          maxInputTokens: prepared.model.capabilities.maxInputTokens ?? null,
          maxOutputTokens: prepared.model.capabilities.maxOutputTokens,
          metadataSource: prepared.model.metadataSource,
        },
      };
    },
  );
  registry.register(
    tool(
      'model/complete',
      'Complete model turn',
      'Run a routed model completion for an agent turn.',
      {
        type: 'object',
        properties: {
          requestId: { type: 'string' },
          selectionId: { type: 'string' },
          route: {
            type: 'object',
            properties: { taskType: { type: 'string' } },
            additionalProperties: false,
          },
          request: ChatRequestSchema,
        },
        required: ['request'],
        additionalProperties: false,
      },
      'paid',
      'Model route decision and usage.',
      'agent-internal',
      ChatResponseSchema,
    ),
    async (context, input) => {
      const args = asRecord(input);
      const task = requireTask(options.tasks, context);
      const roleName = context.agentRole ?? task.role ?? task.assignee?.role ?? 'coordinator';
      const route = asRecord(args.route);
      const requestId = stringValue(args.requestId) ?? uuidv7();
      const selected = selections.get(task.taskId);
      if (
        args.selectionId !== undefined &&
        (!selected ||
          selected.selectionId !== args.selectionId ||
          selected.projectId !== context.projectId)
      )
        throw new RpcError(
          'Agent model selection is stale. Select the model again before completing.',
          RpcErrorCode.InvalidParams,
        );
      const prepared = args.selectionId === undefined ? undefined : selected?.prepared;
      try {
        const response = await options.completion.complete(
          {
            projectId: context.projectId,
            taskId: context.taskId ?? undefined,
            requestId,
            route: {
              projectId: context.projectId,
              agentRole: roleName,
              taskType:
                stringValue(route.taskType) ??
                options.roles.get(roleName, context.projectId).workTypes[0] ??
                'coordination',
            },
            request: asRecord(args.request) as never,
          },
          { signal: context.signal },
          prepared,
        );
        return {
          output: response,
          costUsd: response.usage.costUsd,
          costStatus:
            response.usage.costStatus ?? (response.usage.costUsd === null ? 'unknown' : 'known'),
          evidence: [{ kind: 'model-call', ref: requestId }],
        };
      } finally {
        if (selected?.requestId === requestId) selections.delete(task.taskId);
      }
    },
  );

  registry.register(
    tool(
      'tasks/delegate',
      'Delegate task',
      'Create a supervised child agent task with an inherited access ceiling and declared touches.',
      {
        type: 'object',
        properties: {
          role: { type: 'string' },
          goal: { type: 'string', minLength: 1 },
          title: { type: 'string' },
          touches: { type: 'array', items: TaskTouchSchema },
          contract: TaskCompletionContractSchema,
          budget: TaskBudgetSchema,
          isolation: { type: 'string', enum: ['none', 'worktree'] },
        },
        required: ['role', 'goal'],
        additionalProperties: false,
      },
      'workspace-write',
      'Creates a child task and records its parent/child relationship.',
    ),
    (context, input) => {
      const parent = requireTask(options.tasks, context);
      const args = asRecord(input);
      const roleName = stringValue(args.role);
      const goal = stringValue(args.goal);
      if (!roleName || !goal)
        throw new RpcError('A role and goal are required.', RpcErrorCode.InvalidParams);
      const role = options.roles.get(roleName, context.projectId);
      const accessCeiling = minAccessMode(context.accessMode, role.maxAccess);
      const childBudget = { ...asRecord(args.budget) };
      // A model's context window is not a cumulative task budget. Only inherit
      // a user-supplied task token ceiling; coordinators cannot invent one.
      if (parent.budget.maxTokens === undefined) delete childBudget.maxTokens;
      else childBudget.maxTokens = parent.budget.maxTokens;
      const isolation =
        args.isolation === 'none' || args.isolation === 'worktree'
          ? args.isolation
          : role.isolation;
      const writes = Array.isArray(args.touches)
        ? args.touches.filter(
            (touch): touch is { resource: string; intent: 'write' } =>
              asRecord(touch).intent === 'write' && typeof asRecord(touch).resource === 'string',
          )
        : [];
      const parentLocks = options.locks
        .list(context.projectId)
        .filter((lock) => lock.taskId === parent.taskId);
      const blockedResources = writes
        .filter(
          (touch) =>
            !(isolation === 'worktree' && touch.resource.startsWith('file:')) &&
            parentLocks.some((lock) => lock.resource === touch.resource),
        )
        .map((touch) => touch.resource);
      if (blockedResources.length > 0) {
        throw new RpcError(
          `Delegation would block the child on locks held by its parent ${parent.taskId}. Release the parent's locks for these write touches before delegating: ${blockedResources.join(', ')}`,
          RpcErrorCode.LockConflict,
          { parentTaskId: parent.taskId, resources: blockedResources },
        );
      }
      const created = options.tasks.create({
        projectId: context.projectId,
        kind: 'agent.run',
        title: stringValue(args.title) ?? goal.slice(0, 120),
        goal,
        parentTaskId: parent.taskId,
        role: role.name,
        isolation,
        ...(Array.isArray(args.touches) ? { touches: args.touches as never } : {}),
        ...(args.contract === undefined ? {} : { contract: args.contract as never }),
        ...(Object.keys(childBudget).length === 0 ? {} : { budget: childBudget as never }),
        assignee: { role: role.name, accessCeiling },
        input: { goal },
      });
      return {
        output: { taskId: created.task.taskId, deduplicated: created.deduplicated },
        evidence: [{ kind: 'task', ref: created.task.taskId }],
      };
    },
  );

  registry.register(
    tool(
      'tasks/await',
      'Await tasks',
      'Wait for supervised child tasks to finish and return their results.',
      {
        type: 'object',
        properties: {
          taskIds: { type: 'array', items: { type: 'string', format: 'uuid' }, minItems: 1 },
          timeoutMs: { type: 'integer', minimum: 1, maximum: 300_000 },
        },
        required: ['taskIds'],
        additionalProperties: false,
      },
      'none',
      'Returns terminal task records and their completion evidence.',
    ),
    async (context, input) => {
      const args = asRecord(input);
      const taskIds = Array.isArray(args.taskIds)
        ? args.taskIds.filter((taskId): taskId is string => typeof taskId === 'string')
        : [];
      if (taskIds.length === 0)
        throw new RpcError('At least one taskId is required.', RpcErrorCode.InvalidParams);
      const timeoutMs = Math.min(300_000, Math.max(1, Number(args.timeoutMs) || 300_000));
      const deadline = Date.now() + timeoutMs;
      while (Date.now() < deadline) {
        if (context.signal.aborted) throw abortError(context.signal.reason);
        const tasks = taskIds.map((taskId) => options.tasks.get(context.projectId, taskId));
        if (
          tasks.every((task) =>
            ['succeeded', 'failed', 'blocked', 'cancelled'].includes(task.state),
          )
        ) {
          return {
            output: { tasks },
            evidence: tasks.map((task) => ({ kind: 'task', ref: task.taskId })),
          };
        }
        await delay(25, undefined, { signal: context.signal });
      }
      const tasks = taskIds.map((taskId) => options.tasks.get(context.projectId, taskId));
      return { output: { tasks, timedOut: true } };
    },
  );

  registry.register(
    tool(
      'locks/acquire',
      'Acquire resource locks',
      'Acquire shared or exclusive locks for declared Project resources.',
      {
        type: 'object',
        properties: {
          resources: { type: 'array', items: ChangeNodeRefSchema, minItems: 1 },
          mode: { type: 'string', enum: ['shared', 'exclusive'] },
        },
        required: ['resources', 'mode'],
        additionalProperties: false,
      },
      'workspace-write',
      'Returns resource lock records.',
    ),
    (context, input) => {
      const task = requireTask(options.tasks, context);
      const args = asRecord(input);
      const resources = Array.isArray(args.resources)
        ? args.resources.filter((resource): resource is string => typeof resource === 'string')
        : [];
      const mode = args.mode === 'shared' || args.mode === 'exclusive' ? args.mode : 'exclusive';
      return {
        output: {
          locks: options.locks.acquire(
            context.projectId,
            task.taskId,
            context.taskId ? (task.lease?.workerId ?? null) : null,
            resources,
            mode,
          ),
        },
      };
    },
  );

  registry.register(
    tool(
      'locks/release',
      'Release resource locks',
      'Release locks held by the current task.',
      {
        type: 'object',
        properties: { lockIds: { type: 'array', items: { type: 'string', format: 'uuid' } } },
        required: ['lockIds'],
        additionalProperties: false,
      },
      'workspace-write',
      'Returns the IDs of locks released by this task.',
    ),
    (context, input) => {
      const task = requireTask(options.tasks, context);
      const lockIds = Array.isArray(asRecord(input).lockIds)
        ? (asRecord(input).lockIds as string[])
        : [];
      const released = lockIds.map((lockId) =>
        options.locks.release(context.projectId, lockId, task.taskId),
      );
      return { output: { lockIds: released.map((lock) => lock.lockId) } };
    },
  );

  registry.register(
    tool(
      'locks/list',
      'List resource locks',
      'List active resource locks for the current Project.',
      { type: 'object', properties: {}, additionalProperties: false },
      'none',
      'Returns active resource lock records.',
    ),
    (context) => ({ output: { locks: options.locks.list(context.projectId) } }),
  );

  registry.register(
    tool(
      'memory/write',
      'Write role memory',
      'Append a concise, reusable learning to the current role memory file.',
      {
        type: 'object',
        properties: { content: { type: 'string', minLength: 1 } },
        required: ['content'],
        additionalProperties: false,
      },
      'workspace-write',
      'Writes a role-scoped memory file in the Project.',
    ),
    (context, input) => {
      const roleName = context.agentRole;
      if (!roleName)
        throw new RpcError('Role memory requires an agent role.', RpcErrorCode.RoleNotFound);
      const project = options.projects.getById(context.projectId);
      if (!project)
        throw new RpcError(`Project not found: ${context.projectId}`, RpcErrorCode.ProjectNotFound);
      const relativePath = `.gamecrafter/agent-memory/${roleName}/MEMORY.md`;
      const filePath = resolveProjectPath(project.path, relativePath);
      mkdirSync(path.dirname(filePath), { recursive: true });
      const content = String(asRecord(input).content);
      writeFileSync(filePath, `${content.trim()}\n`, { encoding: 'utf8', flag: 'a' });
      return {
        output: { path: relativePath, bytes: Buffer.byteLength(content, 'utf8') },
        evidence: [{ kind: 'file', ref: projectRelativePath(project.path, filePath) }],
      };
    },
  );
}

function tool(
  toolId: string,
  title: string,
  description: string,
  inputSchema: unknown,
  sideEffects: ToolDefinition['sideEffects'],
  evidence: string,
  source = 'agent-runtime',
  outputSchema?: unknown,
): ToolDefinition {
  return {
    toolId,
    title,
    description,
    inputSchema,
    ...(outputSchema === undefined ? {} : { outputSchema }),
    executionMode: 'project-file',
    sideEffects,
    evidence,
    capabilities: ['agent.runtime'],
    source,
  };
}

function requireTask(tasks: TaskService, context: ToolContext) {
  if (!context.taskId) throw new RpcError('Task context is required.', RpcErrorCode.TaskNotFound);
  return tasks.get(context.projectId, context.taskId);
}

function asRecord(value: unknown): Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function stringValue(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim().length > 0 ? value : undefined;
}

function abortError(reason: unknown): Error {
  const error = new Error(reason === undefined ? 'Task await was cancelled' : String(reason));
  error.name = 'AbortError';
  return error;
}

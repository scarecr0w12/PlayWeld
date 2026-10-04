import { type BoardLink, type BoardMessageType, type ToolDefinition } from '@gamecrafter/contracts';
import { ToolRegistry } from '../tools/tool-registry';
import type { BoardService } from './board-service';
import type { BoardMaintenanceService } from './board-maintenance-service';

export function registerBoardTools(registry: ToolRegistry, board: BoardService): void {
  registry.register(
    definition(
      'board/read',
      'Read discussion board',
      'Read a thread, recent threads, or search the Project discussion board.',
      {
        type: 'object',
        properties: {
          threadId: { type: 'string', format: 'uuid' },
          afterSeq: { type: 'integer', minimum: 0 },
          search: { type: 'string' },
          limit: { type: 'integer', minimum: 1, maximum: 100 },
        },
        additionalProperties: false,
      },
      'none',
      'Read discussion threads and messages.',
      ['board.read'],
    ),
    (context, input) => {
      const args = input as {
        threadId?: string;
        afterSeq?: number;
        search?: string;
        limit?: number;
      };
      if (args.threadId) {
        return {
          output: board.thread(context.projectId, args.threadId, {
            includeMessages: true,
            afterSeq: args.afterSeq,
            limit: args.limit,
          }),
        };
      }
      if (args.search) return { output: board.search(context.projectId, args.search, args.limit) };
      return { output: { threads: board.threads(context.projectId).slice(0, args.limit ?? 50) } };
    },
  );

  registry.register(
    definition(
      'board/post',
      'Post discussion message',
      'Post a non-binding message to an existing board thread or create a new thread.',
      {
        type: 'object',
        properties: {
          threadId: { type: 'string', format: 'uuid' },
          title: { type: 'string', minLength: 1 },
          type: {
            type: 'string',
            enum: ['question', 'proposal', 'finding', 'blocker', 'evidence', 'decision', 'comment'],
          },
          body: { type: 'string', minLength: 1 },
          links: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                kind: { type: 'string', enum: ['task', 'artifact', 'canon', 'module', 'thread'] },
                ref: { type: 'string', minLength: 1 },
              },
              required: ['kind', 'ref'],
              additionalProperties: false,
            },
          },
        },
        required: ['type', 'body'],
        additionalProperties: false,
      },
      'internal-write',
      'Post a discussion message; binding decisions require user confirmation.',
      ['board.post'],
    ),
    (context, input) => {
      const args = input as {
        threadId?: string;
        title?: string;
        type: BoardMessageType;
        body: string;
        links?: BoardLink[];
      };
      return {
        output: board.post(
          {
            projectId: context.projectId,
            threadId: args.threadId,
            title: args.title,
            type: args.type,
            body: args.body,
            links: args.links,
          },
          context.agentRole
            ? { kind: 'agent', role: context.agentRole, taskId: context.taskId }
            : { kind: 'user' },
        ),
      };
    },
  );

  registry.register(
    definition(
      'board/propose-decision',
      'Propose board decision',
      'Post a decision proposal to a thread. A user must separately bind it.',
      {
        type: 'object',
        properties: {
          threadId: { type: 'string', format: 'uuid' },
          title: { type: 'string', minLength: 1 },
          statement: { type: 'string', minLength: 1 },
          rationale: { type: 'string' },
        },
        required: ['threadId', 'title', 'statement'],
        additionalProperties: false,
      },
      'internal-write',
      'Post an explicitly non-binding decision proposal.',
      ['board.propose'],
    ),
    (context, input) => {
      const args = input as {
        threadId: string;
        title: string;
        statement: string;
        rationale?: string;
      };
      const body = args.rationale
        ? `${args.statement}\n\nRationale: ${args.rationale}`
        : args.statement;
      return {
        output: board.post(
          {
            projectId: context.projectId,
            threadId: args.threadId,
            type: 'decision',
            body,
            links: [{ kind: 'thread', ref: args.threadId }],
          },
          context.agentRole
            ? { kind: 'agent', role: context.agentRole, taskId: context.taskId }
            : { kind: 'user' },
        ),
      };
    },
  );
}

export function registerBoardMaintenanceTool(
  registry: ToolRegistry,
  maintenance: BoardMaintenanceService,
): void {
  registry.register(
    {
      toolId: 'board/maintenance-execute',
      title: 'Execute board maintenance task',
      description: 'Internal task entry point for board maintenance workflows.',
      inputSchema: {
        type: 'object',
        properties: {
          mode: { type: 'string', enum: ['audit', 'cleanup', 'sync'] },
          decisionId: { type: 'string', format: 'uuid' },
          force: { type: 'boolean' },
        },
        required: ['mode'],
        additionalProperties: false,
      },
      executionMode: 'project-file',
      sideEffects: 'none',
      evidence: 'Board maintenance task results and synchronization proposals.',
      capabilities: ['board.maintenance'],
      source: 'board-internal',
    },
    (context, input) => maintenance.execute(context, input),
  );
}

function definition(
  toolId: string,
  title: string,
  description: string,
  inputSchema: Record<string, unknown>,
  sideEffects: ToolDefinition['sideEffects'],
  evidence: string,
  capabilities: string[],
): ToolDefinition {
  return {
    toolId,
    title,
    description,
    inputSchema,
    executionMode: 'project-file',
    sideEffects,
    evidence,
    capabilities,
    source: 'builtin',
  };
}

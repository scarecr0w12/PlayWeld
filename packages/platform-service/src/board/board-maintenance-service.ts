import { existsSync, readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import {
  BoardMaintenanceVerdictSchema,
  RpcError,
  RpcErrorCode,
  compile,
  type BindingDecision,
  type BoardMaintenanceVerdict,
  type BoardThread,
} from '@gamecrafter/contracts';
import type { CompletionService } from '../models/completion-service';
import type { ProfileStore } from '../profile/profile-store';
import type { SettingsService } from '../settings/settings-service';
import type { TaskService } from '../tasks/task-service';
import type { ToolContext, ToolExecutionResult } from '../tools/tool-registry';
import type { BoardService } from './board-service';
import { BoardMaintenanceScheduler } from './maintenance-scheduler';
import { CanonSyncWorkflow } from './canon-sync-workflow';

export interface BoardMaintenanceServiceOptions {
  board: BoardService;
  tasks: TaskService;
  projects: ProfileStore;
  settings: SettingsService;
  completion: CompletionService;
  scheduler: BoardMaintenanceScheduler;
  canonSync: CanonSyncWorkflow;
}

interface MaintenanceRunResult {
  summary: string;
  costUsd: number | null;
  costStatus: 'known' | 'partial' | 'unknown';
  tokens: number;
}

interface CostAccumulator {
  totalUsd: number;
  hasPricedUsage: boolean;
  hasUnpricedUsage: boolean;
}

export class BoardMaintenanceService {
  constructor(private readonly options: BoardMaintenanceServiceOptions) {}

  async execute(context: ToolContext, input: unknown): Promise<ToolExecutionResult> {
    const args = asRecord(input);
    const mode = args.mode;
    if (mode !== 'audit' && mode !== 'cleanup' && mode !== 'sync') {
      throw new RpcError('Invalid board maintenance mode', RpcErrorCode.InvalidParams);
    }
    if (!context.taskId) {
      throw new RpcError('Board maintenance requires a task context', RpcErrorCode.ToolDenied);
    }
    const task = this.options.tasks.get(context.projectId, context.taskId);
    if (task.kind !== `board-maintenance.${mode}` || task.assignee?.role !== 'board-maintainer') {
      throw new RpcError(
        'Only board-maintainer tasks can run maintenance',
        RpcErrorCode.ToolDenied,
      );
    }
    try {
      const result =
        mode === 'sync'
          ? await this.sync(
              context,
              typeof args.decisionId === 'string' ? args.decisionId : undefined,
              args.force === true,
            )
          : mode === 'audit'
            ? await this.audit(context)
            : await this.cleanup(context);
      this.options.scheduler.taskCompleted(context.projectId, mode, task.taskId);
      return {
        output: result,
        costUsd: result.costUsd,
        costStatus: result.costStatus,
        evidence: [{ kind: 'board-maintenance', ref: `${mode}:${task.taskId}` }],
      };
    } catch (error) {
      this.options.scheduler.taskFailed(context.projectId, task.taskId);
      throw error;
    }
  }

  private async sync(
    context: ToolContext,
    decisionId?: string,
    force = false,
  ): Promise<MaintenanceRunResult> {
    const maximumAttempts = Number(
      this.options.settings.resolve('board.maxSyncAttempts', { projectId: context.projectId })
        .value,
    );
    const decisions = decisionId
      ? [this.options.board.decision(context.projectId, decisionId)]
      : this.options.board
          .decisions(context.projectId)
          .filter(
            (decision) =>
              (decision.syncStatus === 'pending' || decision.syncStatus === 'failed') &&
              decision.syncAttempts < maximumAttempts,
          );
    for (const decision of decisions) {
      if (
        !force &&
        decision.syncStatus !== 'synchronized' &&
        decision.syncAttempts >= maximumAttempts
      ) {
        continue;
      }
      await this.options.canonSync.run(decision.decisionId, context.taskId!, context.signal);
    }
    return {
      summary: decisions.length
        ? `Synchronized ${decisions.length} binding decision(s).`
        : 'No binding decisions need synchronization.',
      costUsd: 0,
      costStatus: 'known',
      tokens: 0,
    };
  }

  private async audit(context: ToolContext): Promise<MaintenanceRunResult> {
    const minimumMessages = Number(
      this.options.settings.resolve('board.auditMinMessages', { projectId: context.projectId })
        .value,
    );
    const threads = this.options.board
      .threads(context.projectId, { status: 'open' })
      .filter((thread) => thread.messageCount >= minimumMessages);
    const verdicts: Array<{ thread: BoardThread; verdict: BoardMaintenanceVerdict }> = [];
    const cost = createCostAccumulator();
    let tokens = 0;
    for (const thread of threads) {
      const detail = this.options.board.thread(context.projectId, thread.threadId, {
        includeMessages: true,
        limit: 1000,
      });
      const result = await this.requestVerdict(
        context.projectId,
        context.taskId!,
        thread,
        detail.messages,
        context.signal,
      );
      verdicts.push({ thread, verdict: result.verdict });
      addCost(cost, result.costUsd, result.costStatus);
      tokens += result.tokens;
    }
    for (const { thread, verdict } of verdicts) {
      this.options.board.setSummary(context.projectId, thread.threadId, verdict.summary);
      const messages = this.options.board.thread(context.projectId, thread.threadId, {
        includeMessages: true,
        limit: 1000,
      }).messages;
      for (const messageId of verdict.decisionsWithoutBinding) {
        if (!messages.some((message) => message.messageId === messageId)) continue;
        this.options.board.post(
          {
            projectId: context.projectId,
            threadId: thread.threadId,
            type: 'finding',
            body: `Decision proposal ${messageId} has not been bound by the user.`,
            links: [{ kind: 'thread', ref: thread.threadId }],
          },
          { kind: 'system' },
        );
      }
      for (const messageId of verdict.staleBlockers) {
        if (!messages.some((message) => message.messageId === messageId)) continue;
        this.options.board.post(
          {
            projectId: context.projectId,
            threadId: thread.threadId,
            type: 'finding',
            body: `Blocker ${messageId} may be stale; review whether it still applies.`,
            links: [{ kind: 'thread', ref: thread.threadId }],
          },
          { kind: 'system' },
        );
      }
      for (const drift of verdict.driftAgainstCanon) {
        const decision = this.tryGetDecision(context.projectId, drift.decisionId);
        const targetThreadId = decision?.threadId ?? thread.threadId;
        this.options.board.post(
          {
            projectId: context.projectId,
            threadId: targetThreadId,
            type: 'finding',
            body: drift.note,
            links: [
              { kind: 'canon', ref: drift.canonPath },
              { kind: 'thread', ref: targetThreadId },
            ],
          },
          { kind: 'system' },
        );
      }
    }
    return {
      summary: `Audited ${threads.length} open thread(s).`,
      ...summarizeCost(cost),
      tokens,
    };
  }

  private async cleanup(context: ToolContext): Promise<MaintenanceRunResult> {
    const ageDays = Number(
      this.options.settings.resolve('board.archiveAfterDays', { projectId: context.projectId })
        .value,
    );
    const cutoff = this.nowIsoDate(Date.now() - ageDays * 24 * 60 * 60 * 1000);
    const threads = this.options.board
      .threads(context.projectId, { status: 'resolved' })
      .filter((thread) => thread.lastMessageAt < cutoff);
    const summaries: Array<{ thread: BoardThread; summary: string }> = [];
    const cost = createCostAccumulator();
    let tokens = 0;
    for (const thread of threads) {
      const messages = this.options.board.thread(context.projectId, thread.threadId, {
        includeMessages: true,
        limit: 1000,
      }).messages;
      const result = await this.requestVerdict(
        context.projectId,
        context.taskId!,
        thread,
        messages,
        context.signal,
      );
      summaries.push({ thread, summary: result.verdict.summary });
      addCost(cost, result.costUsd, result.costStatus);
      tokens += result.tokens;
    }
    for (const { thread, summary } of summaries) {
      this.options.board.setSummary(context.projectId, thread.threadId, summary);
      this.options.board.setThreadStatus(context.projectId, thread.threadId, 'archived', {
        kind: 'system',
      });
    }
    return {
      summary: `Summarized and archived ${threads.length} resolved thread(s).`,
      ...summarizeCost(cost),
      tokens,
    };
  }

  private async requestVerdict(
    projectId: string,
    taskId: string,
    thread: BoardThread,
    messages: unknown[],
    signal?: AbortSignal,
  ): Promise<{
    verdict: BoardMaintenanceVerdict;
    costUsd: number | null;
    costStatus: 'known' | 'partial' | 'unknown';
    tokens: number;
  }> {
    const project = this.options.projects.getById(projectId);
    if (!project)
      throw new RpcError(`Project not found: ${projectId}`, RpcErrorCode.ProjectNotFound);
    const projectInstructions = existsSync(path.join(project.path, 'AGENTS.md'))
      ? readFileSync(path.join(project.path, 'AGENTS.md'), 'utf8')
      : '';
    const canonRecords = readCanonFrontmatter(
      project.path,
      path.join(project.path, 'docs', 'decisions'),
    );
    const response = await this.options.completion.complete(
      {
        projectId,
        taskId,
        route: { projectId, agentRole: 'board-maintainer', taskType: 'board-maintenance' },
        request: {
          messages: [
            {
              role: 'system',
              content:
                'Audit one discussion thread against the Project instructions and current canon. Return only JSON matching the requested verdict schema. Do not rewrite or delete history.',
            },
            {
              role: 'user',
              content: JSON.stringify({
                projectInstructions,
                thread,
                messages,
                canonRecords,
                verdictSchema: {
                  summary: 'string',
                  decisionsWithoutBinding: 'array of message UUIDs',
                  staleBlockers: 'array of message UUIDs',
                  driftAgainstCanon: 'array of { decisionId, canonPath, note }',
                },
              }),
            },
          ],
          temperature: 0,
          maxTokens: 2000,
          stream: false,
        },
      },
      { signal },
    );
    const verdict = compile<BoardMaintenanceVerdict>(BoardMaintenanceVerdictSchema).assert(
      JSON.parse(response.content) as unknown,
    );
    return {
      verdict,
      costUsd: response.usage.costUsd,
      costStatus:
        response.usage.costStatus ?? (response.usage.costUsd === null ? 'unknown' : 'known'),
      tokens: response.usage.inputTokens + response.usage.outputTokens,
    };
  }

  private tryGetDecision(projectId: string, decisionId: string): BindingDecision | undefined {
    try {
      return this.options.board.decision(projectId, decisionId);
    } catch {
      return undefined;
    }
  }

  private nowIsoDate(milliseconds: number): string {
    return new Date(milliseconds).toISOString();
  }
}

function createCostAccumulator(): CostAccumulator {
  return { totalUsd: 0, hasPricedUsage: false, hasUnpricedUsage: false };
}

function addCost(
  accumulator: CostAccumulator,
  costUsd: number | null,
  costStatus: 'known' | 'partial' | 'unknown',
): void {
  if (costUsd !== null) accumulator.totalUsd += costUsd;
  if (costStatus === 'unknown' || costStatus === 'partial') accumulator.hasUnpricedUsage = true;
  if (costStatus !== 'unknown') accumulator.hasPricedUsage = true;
}

function summarizeCost(
  accumulator: CostAccumulator,
): Pick<MaintenanceRunResult, 'costUsd' | 'costStatus'> {
  const costStatus = accumulator.hasUnpricedUsage
    ? accumulator.hasPricedUsage
      ? 'partial'
      : 'unknown'
    : 'known';
  return {
    costUsd: costStatus === 'unknown' ? null : accumulator.totalUsd,
    costStatus,
  };
}

function readCanonFrontmatter(
  projectPath: string,
  directory: string,
): Array<{ path: string; frontmatter: string }> {
  if (!existsSync(directory)) return [];
  const results: Array<{ path: string; frontmatter: string }> = [];
  const visit = (current: string): void => {
    for (const entry of readdirSync(current, { withFileTypes: true })) {
      const absolute = path.join(current, entry.name);
      if (entry.isDirectory() && !entry.isSymbolicLink()) {
        visit(absolute);
      } else if (entry.isFile() && entry.name.endsWith('.md')) {
        const content = readFileSync(absolute, 'utf8');
        const match = /^---\r?\n([\s\S]*?)\r?\n---/.exec(content);
        results.push({
          path: path.relative(projectPath, absolute).replaceAll(path.sep, '/'),
          frontmatter: match?.[1] ?? '',
        });
      }
    }
  };
  visit(directory);
  return results;
}

function asRecord(value: unknown): Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

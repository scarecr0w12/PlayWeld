import type { TaskResult } from '@gamecrafter/contracts';
import type { TaskHandlerContext } from './types';

export async function boardMaintenanceSync(context: TaskHandlerContext): Promise<TaskResult> {
  return runMaintenance(context, 'sync');
}

export async function boardMaintenanceAudit(context: TaskHandlerContext): Promise<TaskResult> {
  return runMaintenance(context, 'audit');
}

export async function boardMaintenanceCleanup(context: TaskHandlerContext): Promise<TaskResult> {
  return runMaintenance(context, 'cleanup');
}

async function runMaintenance(
  context: TaskHandlerContext,
  mode: 'audit' | 'cleanup' | 'sync',
): Promise<TaskResult> {
  context.progress(`Starting board ${mode}`, 0);
  const input = asRecord(context.input);
  const result = asRecord(
    await context.tool('board/maintenance-execute', {
      mode,
      ...(typeof input.decisionId === 'string' ? { decisionId: input.decisionId } : {}),
      ...(input.force === true ? { force: true } : {}),
    }),
  );
  if ('costUsd' in result || typeof result.tokens === 'number') {
    await context.reportUsage({
      ...(typeof result.costUsd === 'number' || result.costUsd === null
        ? { costUsd: result.costUsd }
        : {}),
      ...(result.costStatus === 'known' ||
      result.costStatus === 'partial' ||
      result.costStatus === 'unknown'
        ? { costStatus: result.costStatus }
        : {}),
      ...(typeof result.tokens === 'number' ? { tokens: result.tokens } : {}),
    });
  }
  context.progress(`Board ${mode} complete`, 100);
  return {
    summary: typeof result.summary === 'string' ? result.summary : `Board ${mode} complete`,
    artifacts: [],
    evidence: [{ kind: 'board-maintenance', ref: `${mode}:${context.task.taskId}` }],
  };
}

function asRecord(value: unknown): Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

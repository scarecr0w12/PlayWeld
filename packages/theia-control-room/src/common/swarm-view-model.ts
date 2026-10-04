import {
  TaskEventKind,
  type ChangeNodeRef,
  type TaskEvent,
  type TaskQuestion,
  type TaskRecord,
} from '@gamecrafter/contracts';

export interface SwarmTaskNode {
  task: TaskRecord;
  role: string | null;
  progress: number | null;
  pendingQuestions: TaskQuestion[];
  children: SwarmTaskNode[];
}

export function taskDisplayTitle(task: Pick<TaskRecord, 'title' | 'goal'>): string {
  const title = task.title.trim();
  const firstLine = /^#{1,6}\s/.test(title) ? task.goal.trim().split(/\r?\n/, 1)[0]! : title;
  return (
    firstLine
      .replace(/^#{1,6}\s+/, '')
      .replace(/\*\*([^*]+)\*\*/g, '$1')
      .replace(/`([^`]+)`/g, '$1')
      .trim()
      .slice(0, 120) || 'Agent task'
  );
}

export function parseImpactSeeds(text: string): ChangeNodeRef[] {
  const refs = new Set<string>();
  const fileRanges: Array<[number, number]> = [];
  const filePattern = /\b(?:docs|game)\/[A-Za-z0-9_-]+(?:\/[A-Za-z0-9_-]+)*(?:\.[A-Za-z0-9_-]+)*/g;
  for (const match of text.matchAll(filePattern)) {
    refs.add(`file:${match[0]}`);
    fileRanges.push([match.index ?? 0, (match.index ?? 0) + match[0].length]);
  }
  const canonPattern = /\b[a-z]+(?:\.[a-z0-9-]+)+\b/g;
  for (const match of text.matchAll(canonPattern)) {
    const start = match.index ?? 0;
    if (fileRanges.some(([from, to]) => start >= from && start < to)) continue;
    refs.add(`canon:${match[0]}`);
  }
  return [...refs].sort() as ChangeNodeRef[];
}

export function buildTaskTree(
  tasks: TaskRecord[],
  rootTaskId: string,
  events: TaskEvent[] = [],
  questions: TaskQuestion[] = [],
): SwarmTaskNode | undefined {
  const byId = new Map<string, SwarmTaskNode>();
  for (const task of tasks) {
    byId.set(task.taskId, {
      task,
      role: task.role ?? task.assignee?.role ?? null,
      progress: progressForTask(task, events),
      pendingQuestions: questions.filter(
        (question) => question.taskId === task.taskId && question.answeredAt === null,
      ),
      children: [],
    });
  }
  for (const task of tasks) {
    const parent = task.parentTaskId ? byId.get(task.parentTaskId) : undefined;
    const child = byId.get(task.taskId);
    if (parent && child) parent.children.push(child);
  }
  for (const node of byId.values()) {
    node.children.sort(
      (left, right) =>
        left.task.createdAt.localeCompare(right.task.createdAt) ||
        left.task.taskId.localeCompare(right.task.taskId),
    );
  }
  return byId.get(rootTaskId);
}

function progressForTask(task: TaskRecord, events: TaskEvent[]): number | null {
  if (task.state === 'succeeded') return 100;
  const latest = events
    .filter((event) => event.taskId === task.taskId && event.kind === TaskEventKind.Progress)
    .sort((left, right) => right.seq - left.seq)[0];
  if (!latest || typeof latest.payload !== 'object' || latest.payload === null) return null;
  const percent = (latest.payload as { percent?: unknown }).percent;
  return typeof percent === 'number' ? Math.max(0, Math.min(100, percent)) : null;
}

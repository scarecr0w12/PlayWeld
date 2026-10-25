import { existsSync } from 'node:fs';
import path from 'node:path';
import { isTerminal, type PendingInputs, type TaskRecord } from '@gamecrafter/contracts';
import type { ProfileStore } from '../profile/profile-store';
import type { ProjectDatabases } from '../projects/project-databases';
import { ToolStore } from '../tools/tool-store';
import { TaskStore } from './task-store';

/** A projection of existing durable requests; no queue is persisted in the UI. */
export function pendingInputs(profile: ProfileStore, projects: ProjectDatabases): PendingInputs {
  const result: PendingInputs = { schemaVersion: 1, inputs: [], unavailableProjects: [] };
  for (const project of profile.list()) {
    if (!existsSync(path.join(project.path, 'gamecrafter.project.json'))) {
      result.unavailableProjects.push({ projectId: project.projectId, name: project.name });
      continue;
    }
    const database = projects.get(project.projectId);
    const tasks = new TaskStore(database);
    const tools = new ToolStore(database);
    const context = (task?: TaskRecord) => ({
      projectId: project.projectId,
      projectName: project.name,
      taskId: task?.taskId ?? null,
      taskTitle: task?.title ?? null,
      rootTaskId: task?.rootTaskId ?? null,
      rootTaskTitle: task ? (tasks.get(task.rootTaskId)?.title ?? task.title) : null,
    });
    for (const approval of tools.approvals(true)) {
      const call = tools.getCall(approval.callId);
      if (
        approval.projectId !== project.projectId ||
        !call ||
        call.projectId !== project.projectId ||
        call.status !== 'pending'
      )
        continue;
      const task = call.taskId ? tasks.get(call.taskId) : undefined;
      if (call.taskId && (!task || isTerminal(task.state))) continue;
      result.inputs.push({ ...context(task), kind: 'approval', approval });
    }
    for (const question of tasks.questions(true)) {
      const task = tasks.get(question.taskId);
      if (task?.state === 'waiting_input')
        result.inputs.push({ ...context(task), kind: 'question', question });
    }
  }
  result.inputs.sort((left, right) =>
    (left.kind === 'approval' ? left.approval.requestedAt : left.question.askedAt).localeCompare(
      right.kind === 'approval' ? right.approval.requestedAt : right.question.askedAt,
    ),
  );
  return result;
}

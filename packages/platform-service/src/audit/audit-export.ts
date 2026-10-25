import { createHash } from 'node:crypto';
import {
  closeSync,
  mkdirSync,
  openSync,
  realpathSync,
  renameSync,
  rmSync,
  writeSync,
} from 'node:fs';
import path from 'node:path';
import {
  redact,
  uuidv7,
  compile,
  ApprovalRequestSchema,
  ToolCallRecordSchema,
  TaskEventSchema,
  ModelUsageRecordSchema,
  type AuditExport,
  type AuditExportReceipt,
  type ModelUsageRecord,
} from '@gamecrafter/contracts';
import type { Database } from '../db/database';
import type { ModelRouter } from '../models/router';
import type { ProfileStore } from '../profile/profile-store';
import type { ProjectDatabases } from '../projects/project-databases';
import { TaskStore } from '../tasks/task-store';
import { ToolStore } from '../tools/tool-store';

const recordValidators = {
  calls: compile(ToolCallRecordSchema),
  approvals: compile(ApprovalRequestSchema),
  events: compile(TaskEventSchema),
  modelUsage: compile(ModelUsageRecordSchema),
};

/** Redact labels without replacing numeric *Tokens fields by sensitive-key matching. */
export function redactAuditUsage(usage: ModelUsageRecord): ModelUsageRecord {
  return {
    ...usage,
    requestId: usage.requestId === null ? null : redact(usage.requestId),
    ...(usage.modelName === undefined ? {} : { modelName: redact(usage.modelName) }),
    ...(usage.providerModelId === undefined
      ? {}
      : { providerModelId: redact(usage.providerModelId) }),
  };
}

export class AuditExporter {
  constructor(
    private readonly profile: ProfileStore,
    private readonly profileDatabase: Database,
    private readonly projects: ProjectDatabases,
    private readonly router: ModelRouter,
  ) {}

  export(projectId: string): AuditExportReceipt {
    const database = this.projects.get(projectId); // Resolve ownership before any filesystem change.
    const project = this.profile.getById(projectId)!;
    const projectRoot = realpathSync(project.path);
    let directory = projectRoot;
    // Check each existing/generated ancestor so a linked cache cannot redirect an export.
    for (const segment of ['.gamecrafter', 'cache', 'audit-exports']) {
      directory = path.join(directory, segment);
      mkdirSync(directory, { recursive: true, mode: 0o700 });
      const real = realpathSync(directory);
      const relative = path.relative(projectRoot, real);
      if (relative.startsWith(`..${path.sep}`) || relative === '..' || path.isAbsolute(relative))
        throw new Error('Audit export directory escapes the Project.');
    }
    const destination = path.join(directory, `gamecrafter-audit-${uuidv7()}.json`);
    const partial = `${destination}.partial`;
    const exportedAt = new Date().toISOString();
    const counts: AuditExport['counts'] = { calls: 0, approvals: 0, events: 0, modelUsage: 0 };
    const hash = createHash('sha256');
    let bytes = 0;
    let descriptor: number | undefined;
    try {
      descriptor = openSync(partial, 'wx', 0o600);
      const write = (text: string) => {
        const buffer = Buffer.from(text, 'utf8');
        let offset = 0;
        while (offset < buffer.length) {
          const written = writeSync(descriptor!, buffer, offset, buffer.length - offset);
          if (!written) throw new Error('Audit export write made no progress.');
          offset += written;
        }
        hash.update(buffer);
        bytes += buffer.length;
      };
      // No awaits inside these transactions: both stores stay stable while rows are serialized.
      database.transaction(() =>
        this.profileDatabase.transaction(() => {
          write(
            JSON.stringify({
              schemaVersion: 1,
              projectId,
              exportedAt,
              scope: 'full-project-audit',
            }).slice(0, -1),
          );
          const tools = new ToolStore(database);
          const groups = {
            calls: tools.exportCalls(projectId),
            approvals: tools.exportApprovals(projectId),
            events: new TaskStore(database).exportEvents(),
            modelUsage: this.router.exportModelUsage(projectId),
          };
          for (const key of ['calls', 'approvals', 'events', 'modelUsage'] as const) {
            write(`,\n"${key}":[`);
            for (const record of groups[key]) {
              if (counts[key]) write(',\n');
              write(
                JSON.stringify(
                  recordValidators[key].assert(
                    key === 'modelUsage'
                      ? redactAuditUsage(record as ModelUsageRecord)
                      : redact(record),
                  ),
                ),
              );
              counts[key]++;
            }
            write(']');
          }
          write(`,\n"counts":${JSON.stringify(counts)}}\n`);
        }),
      );
      closeSync(descriptor);
      descriptor = undefined;
      renameSync(partial, destination);
      return {
        schemaVersion: 1,
        projectId,
        exportedAt,
        path: destination,
        bytes,
        sha256: hash.digest('hex'),
        counts,
      };
    } catch (error) {
      if (descriptor !== undefined) closeSync(descriptor);
      rmSync(partial, { force: true });
      throw error;
    }
  }
}

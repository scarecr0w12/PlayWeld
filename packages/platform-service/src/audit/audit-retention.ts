import { createHash } from 'node:crypto';
import { existsSync } from 'node:fs';
import path from 'node:path';
import {
  compile,
  AuditRetentionPolicySchema,
  AuditCleanupReceiptSchema,
  RpcError,
  RpcErrorCode,
  uuidv7,
  type AuditCleanupCounts,
  type AuditCleanupPreview,
  type AuditCleanupReceipt,
  type AuditHistoryStore,
  type AuditRetentionPolicy,
} from '@gamecrafter/contracts';
import type { Database } from '../db/database';
import type { ProfileStore } from '../profile/profile-store';
import type { ProjectDatabases } from '../projects/project-databases';
import type { SettingsService } from '../settings/settings-service';
import { log } from '../logger';

type Row = Record<string, unknown>;
type Selections = {
  calls: Row[];
  approvals: Row[];
  events: Row[];
  modelUsage: Row[];
  decisionAssessments: Row[];
  legacyUsage: Row[];
  linkedOutcomes: Row[];
};
type Plan = {
  projectId: string;
  store: AuditHistoryStore;
  before: string;
  policy: AuditRetentionPolicy;
  rows: Selections;
  counts: AuditCleanupCounts;
  hasMore: boolean;
  digest: string;
};
type Review = Omit<Plan, 'rows'>;
const batchSize = 250;
const terminal = "'succeeded','failed','cancelled'";
const safeTasks = `WITH RECURSIVE cutoff AS (SELECT ? AS project_id, julianday(?) AS before_jd), protected_roots(root_task_id) AS (
 SELECT task.root_task_id FROM tasks task CROSS JOIN cutoff c WHERE task.project_id=c.project_id AND
 (task.state NOT IN (${terminal}) OR task.lease IS NOT NULL OR julianday(task.finished_at) IS NULL OR julianday(task.updated_at) IS NULL
 OR julianday(task.finished_at)>=c.before_jd OR julianday(task.updated_at)>=c.before_jd)
 UNION
 SELECT dependency.root_task_id FROM protected_roots protected
 JOIN tasks consumer ON consumer.root_task_id=protected.root_task_id
 JOIN json_each(consumer.depends_on) dependency_id
 JOIN tasks dependency ON dependency.task_id=dependency_id.value CROSS JOIN cutoff c
 WHERE consumer.project_id=c.project_id AND dependency.project_id=c.project_id
), safe_tasks AS (
 SELECT t.task_id FROM tasks t JOIN tasks root ON root.task_id=t.root_task_id CROSS JOIN cutoff c
 WHERE t.project_id=c.project_id AND root.project_id=c.project_id AND root.root_task_id=root.task_id
 AND t.state IN (${terminal}) AND root.state IN (${terminal})
 AND t.lease IS NULL AND root.lease IS NULL
 AND root.task_id NOT IN (SELECT root_task_id FROM protected_roots)
 AND julianday(t.finished_at)<c.before_jd AND julianday(t.updated_at)<c.before_jd
 AND julianday(root.finished_at)<c.before_jd AND julianday(root.updated_at)<c.before_jd
 AND NOT EXISTS (SELECT 1 FROM tasks member WHERE member.root_task_id=root.task_id AND
 (member.state NOT IN (${terminal}) OR member.lease IS NOT NULL OR julianday(member.finished_at) IS NULL OR julianday(member.updated_at) IS NULL
 OR julianday(member.finished_at)>=c.before_jd OR julianday(member.updated_at)>=c.before_jd))
)`;
const emptyCounts = (): AuditCleanupCounts => ({
  calls: 0,
  approvals: 0,
  events: 0,
  modelUsage: 0,
  decisionAssessments: 0,
  legacyUsage: 0,
});
const sum = (counts: AuditCleanupCounts) => Object.values(counts).reduce((a, b) => a + b, 0);
const receiptValidator = compile<AuditCleanupReceipt>(AuditCleanupReceiptSchema);

export class AuditRetention {
  private readonly previews = new Map<
    string,
    { sessionId: string; expires: number; plan: Review }
  >();
  private timer?: ReturnType<typeof setInterval>;
  private stopped = false;
  constructor(
    private readonly profile: ProfileStore,
    private readonly database: Database,
    private readonly projects: ProjectDatabases,
    private readonly settings: SettingsService,
    private readonly now: () => Date = () => new Date(),
    private readonly changed?: (receipt: AuditCleanupReceipt) => void,
  ) {}

  policy(projectId: string): AuditRetentionPolicy {
    this.project(projectId);
    return compile<AuditRetentionPolicy>(AuditRetentionPolicySchema).assert({
      retentionDays: this.settings.resolve('audit.retentionDays', { projectId }).value,
      deletionEnabled: this.settings.resolve('audit.deletionEnabled', { projectId }).value,
      autoPrune: this.settings.resolve('audit.autoPrune', { projectId }).value,
    });
  }
  state(projectId: string) {
    const project = this.project(projectId);
    const receipts = [
      ...project
        .prepare(
          "SELECT payload AS receipt FROM events WHERE kind='audit.pruned' ORDER BY seq DESC LIMIT 20",
        )
        .all<{ receipt: string }>(),
      ...this.database
        .prepare(
          'SELECT receipt_json AS receipt FROM audit_cleanup_receipts WHERE project_id=? ORDER BY completed_at DESC,cleanup_id DESC LIMIT 20',
        )
        .all<{ receipt: string }>(projectId),
    ]
      .map((row) => receiptValidator.assert(JSON.parse(row.receipt)))
      .sort(
        (a, b) =>
          b.completedAt.localeCompare(a.completedAt) || b.cleanupId.localeCompare(a.cleanupId),
      );
    return { schemaVersion: 1 as const, projectId, policy: this.policy(projectId), receipts };
  }
  setPolicy(projectId: string, policy: AuditRetentionPolicy) {
    compile(AuditRetentionPolicySchema).assert(policy);
    if (policy.autoPrune && (!policy.deletionEnabled || policy.retentionDays === 0))
      this.fail('Automatic retention requires deletion enabled and positive retention days.');
    this.project(projectId);
    const entries = Object.entries(policy).map(([name, value]) => {
      const key = `audit.${name}`;
      const previous = this.settings.resolve(key, { projectId });
      return {
        ...previous,
        value,
        source: 'project' as const,
        layers: { ...previous.layers, project: value },
      };
    });
    this.settings.import({
      scope: 'project',
      projectId,
      document: {
        schemaVersion: 1,
        projectId,
        exportedAt: this.now().toISOString(),
        settings: entries,
      },
    });
    return this.state(projectId);
  }
  preview(
    projectId: string,
    store: AuditHistoryStore,
    before: string | undefined,
    sessionId: string,
  ): AuditCleanupPreview {
    this.expire();
    const policy = this.policy(projectId);
    if (!before && policy.retentionDays === 0)
      this.fail('Choose a UTC cutoff or configure positive retention days.');
    const date = before
      ? new Date(before)
      : new Date(this.now().getTime() - policy.retentionDays * 86400000);
    if (!Number.isFinite(date.getTime()) || date.getTime() > this.now().getTime())
      this.fail('Cleanup cutoff must be a valid date no later than now.');
    const plan = this.plan(projectId, store, date.toISOString(), policy);
    for (const [id, value] of this.previews)
      if (
        value.sessionId === sessionId &&
        value.plan.projectId === projectId &&
        value.plan.store === store
      )
        this.previews.delete(id);
    while (this.previews.size >= 100) this.previews.delete(this.previews.keys().next().value!);
    const previewId = uuidv7(),
      expires = this.now().getTime() + 300000;
    const review: Review = {
      projectId: plan.projectId,
      store: plan.store,
      before: plan.before,
      policy: plan.policy,
      counts: plan.counts,
      hasMore: plan.hasMore,
      digest: plan.digest,
    };
    this.previews.set(previewId, { sessionId, expires, plan: review });
    return {
      schemaVersion: 1,
      previewId,
      projectId,
      store,
      before: plan.before,
      expiresAt: new Date(expires).toISOString(),
      counts: plan.counts,
      hasMore: plan.hasMore,
    };
  }
  apply(
    projectId: string,
    store: AuditHistoryStore,
    previewId: string,
    sessionId: string,
    confirm: boolean,
  ): AuditCleanupReceipt {
    const preview = this.previews.get(previewId);
    if (
      !confirm ||
      !preview ||
      preview.sessionId !== sessionId ||
      preview.plan.projectId !== projectId ||
      preview.plan.store !== store
    )
      this.fail('A matching confirmed preview from this session is required.');
    if (preview.expires <= this.now().getTime()) {
      this.previews.delete(previewId);
      this.fail('Cleanup preview expired. Preview again.');
    }
    this.previews.delete(previewId);
    return this.commit(preview.plan, previewId, 'manual');
  }
  closeSession(sessionId: string): void {
    for (const [id, value] of this.previews)
      if (value.sessionId === sessionId) this.previews.delete(id);
  }
  start(): void {
    this.timer = setInterval(() => this.runAutomatic(), 60_000);
    this.timer.unref();
  }
  stop(): void {
    this.stopped = true;
    clearInterval(this.timer);
    this.previews.clear();
  }
  runAutomatic(): AuditCleanupReceipt[] {
    if (this.stopped) return [];
    const receipts: AuditCleanupReceipt[] = [];
    this.expire();
    for (const project of this.profile.list()) {
      if (!existsSync(path.join(project.path, 'gamecrafter.project.json'))) continue;
      let policy: AuditRetentionPolicy;
      try {
        policy = this.policy(project.projectId);
      } catch {
        continue;
      }
      if (!policy.deletionEnabled || !policy.autoPrune || policy.retentionDays === 0) continue;
      for (const store of ['project', 'model-usage'] as const)
        try {
          const plan = this.plan(
            project.projectId,
            store,
            new Date(this.now().getTime() - policy.retentionDays * 86400000).toISOString(),
            policy,
          );
          if (sum(plan.counts)) receipts.push(this.commit(plan, uuidv7(), 'automatic'));
        } catch {
          log(
            'warn',
            'Audit retention failed; no successful cleanup receipt was returned for this store.',
            { projectId: project.projectId, store },
          );
        }
    }
    return receipts;
  }
  private project(projectId: string): Database {
    if (this.stopped) this.fail('Audit retention service is stopped.');
    const project = this.profile.getById(projectId);
    if (!project || !existsSync(path.join(project.path, 'gamecrafter.project.json')))
      throw new RpcError('Project unavailable for audit cleanup.', RpcErrorCode.ProjectNotFound);
    return this.projects.get(projectId);
  }
  private plan(
    projectId: string,
    store: AuditHistoryStore,
    before: string,
    policy = this.policy(projectId),
  ): Plan {
    const project = this.project(projectId);
    const rows: Selections = {
      calls: [],
      approvals: [],
      events: [],
      modelUsage: [],
      decisionAssessments: [],
      legacyUsage: [],
      linkedOutcomes: [],
    };
    let hasMore = false;
    const take = (records: Iterable<Row>, filter: (row: Row) => boolean = () => true): Row[] => {
      const selected: Row[] = [];
      for (const row of records) {
        if (!filter(row)) continue;
        if (selected.length === batchSize) {
          hasMore = true;
          break;
        }
        selected.push(row);
      }
      return selected;
    };
    if (store === 'project') {
      rows.calls = take(
        project
          .prepare(
            `${safeTasks} SELECT c.* FROM tool_calls c CROSS JOIN cutoff cut WHERE c.project_id=cut.project_id
    AND c.status IN ('completed','failed','denied','rejected','timed-out') AND julianday(c.finished_at)<cut.before_jd
    AND (c.task_id IS NULL OR c.task_id IN (SELECT task_id FROM safe_tasks))
    AND NOT EXISTS (SELECT 1 FROM approvals a WHERE a.call_id=c.call_id AND (a.project_id!=c.project_id OR a.resolved_at IS NULL OR julianday(a.resolved_at) IS NULL OR julianday(a.resolved_at)>=cut.before_jd))
    AND NOT EXISTS (SELECT 1 FROM events e WHERE e.kind='tool.called' AND json_extract(e.payload,'$.callId')=c.call_id
      AND (julianday(e.occurred_at) IS NULL OR julianday(e.occurred_at)>=cut.before_jd OR (e.task_id IS NOT NULL AND e.task_id NOT IN (SELECT task_id FROM safe_tasks))))
    ORDER BY julianday(c.finished_at),c.call_id LIMIT ${batchSize + 1}`,
          )
          .iterate<Row>(projectId, before),
      );
      const ids = JSON.stringify(rows.calls.map((row) => row.call_id));
      rows.approvals = project
        .prepare(
          'SELECT * FROM approvals WHERE project_id=? AND call_id IN (SELECT value FROM json_each(?)) ORDER BY approval_id',
        )
        .all<Row>(projectId, ids);
      const linked = project
        .prepare(
          "SELECT * FROM events WHERE kind='tool.called' AND json_extract(payload,'$.callId') IN (SELECT value FROM json_each(?)) ORDER BY seq",
        )
        .all<Row>(ids);
      rows.events = [
        ...linked,
        ...take(
          project
            .prepare(
              `${safeTasks} SELECT e.* FROM events e CROSS JOIN cutoff cut WHERE e.task_id IN (SELECT task_id FROM safe_tasks) AND e.kind LIKE 'task.%' AND julianday(e.occurred_at)<cut.before_jd ORDER BY e.seq LIMIT ${batchSize + 1}`,
            )
            .iterate<Row>(projectId, before),
        ),
      ].sort((a, b) => Number(a.seq) - Number(b.seq));
    } else {
      const safeTask = (row: Row): boolean =>
        row.task_id === null ||
        !!project
          .prepare(`${safeTasks} SELECT task_id FROM safe_tasks WHERE task_id=?`)
          .get(projectId, before, String(row.task_id));
      rows.modelUsage = take(
        this.database
          .prepare(
            'SELECT * FROM model_usage WHERE project_id=? AND julianday(occurred_at)<julianday(?) ORDER BY julianday(occurred_at),usage_id',
          )
          .iterate<Row>(projectId, before),
        (row) => {
          if (!safeTask(row)) return false;
          if (row.decision_id === null) return true;
          const outcome = this.database
            .prepare(
              'SELECT d.project_id,o.recorded_at FROM route_decisions d JOIN route_outcomes o ON o.decision_id=d.decision_id WHERE d.decision_id=?',
            )
            .get<{ project_id: string; recorded_at: string }>(String(row.decision_id));
          return (
            !outcome ||
            (outcome.project_id === projectId &&
              Number.isFinite(Date.parse(outcome.recorded_at)) &&
              Date.parse(outcome.recorded_at) < Date.parse(before))
          );
        },
      );
      const ids = JSON.stringify(
        rows.modelUsage.map((row) => row.decision_id).filter((value) => value !== null),
      );
      rows.linkedOutcomes = this.database
        .prepare(
          'SELECT o.* FROM route_outcomes o JOIN route_decisions d ON d.decision_id=o.decision_id WHERE d.project_id=? AND o.decision_id IN (SELECT value FROM json_each(?)) ORDER BY o.decision_id',
        )
        .all<Row>(projectId, ids);
      rows.decisionAssessments = take(
        this.database
          .prepare(
            "SELECT * FROM decision_assessments WHERE project_id=? AND julianday(created_at)<julianday(?) AND json_extract(assessment_json,'$.status') IN ('disabled','assessed','fallback') ORDER BY julianday(created_at),assessment_id",
          )
          .iterate<Row>(projectId, before),
        safeTask,
      );
      const unsafe = project
        .prepare(
          `${safeTasks} SELECT task_id FROM tasks WHERE project_id=? AND task_id NOT IN (SELECT task_id FROM safe_tasks) LIMIT 1`,
        )
        .get(projectId, before, projectId);
      if (!unsafe)
        rows.legacyUsage = take(
          this.database
            .prepare(
              `SELECT o.* FROM route_outcomes o JOIN route_decisions d ON d.decision_id=o.decision_id WHERE d.project_id=? AND o.source='self' AND o.audit_retained=1 AND julianday(o.recorded_at)<julianday(?) AND NOT EXISTS (SELECT 1 FROM model_usage u WHERE u.decision_id=d.decision_id) ORDER BY julianday(o.recorded_at),o.decision_id LIMIT ${batchSize + 1}`,
            )
            .iterate<Row>(projectId, before),
        );
    }
    const counts = emptyCounts();
    for (const key of Object.keys(counts) as Array<keyof AuditCleanupCounts>)
      counts[key] = rows[key].length;
    const digest = createHash('sha256')
      .update(JSON.stringify({ projectId, store, before, policy, rows }))
      .digest('hex');
    return { projectId, store, before, policy, rows, counts, hasMore, digest };
  }
  private commit(
    original: Review,
    cleanupId: string,
    origin: 'manual' | 'automatic',
  ): AuditCleanupReceipt {
    const project = this.project(original.projectId);
    const execute = () => {
      const policy = this.policy(original.projectId);
      if (!policy.deletionEnabled) this.fail('Audit deletion is disabled for this Project.');
      if (origin === 'automatic' && (!policy.autoPrune || policy.retentionDays === 0))
        this.fail('Automatic audit retention is disabled.');
      const current = this.plan(original.projectId, original.store, original.before, policy);
      if (current.digest !== original.digest)
        this.fail('Audit history or policy changed. Preview cleanup again.');
      if (!sum(current.counts)) this.fail('No eligible audit records were selected.');
      const receipt: AuditCleanupReceipt = {
        schemaVersion: 1,
        cleanupId,
        projectId: current.projectId,
        store: current.store,
        before: current.before,
        completedAt: this.now().toISOString(),
        origin,
        counts: current.counts,
      };
      const remove = (database: Database, table: string, column: string, records: Row[]) => {
        if (records.length)
          database
            .prepare(`DELETE FROM ${table} WHERE ${column} IN (SELECT value FROM json_each(?))`)
            .run(JSON.stringify(records.map((row) => row[column])));
      };
      if (current.store === 'project') {
        const seq = project
          .prepare('SELECT COALESCE(MAX(seq),0)+1 AS seq FROM events')
          .get<{ seq: number }>()!.seq;
        remove(project, 'approvals', 'approval_id', current.rows.approvals);
        remove(project, 'events', 'event_id', current.rows.events);
        remove(project, 'tool_calls', 'call_id', current.rows.calls);
        project
          .prepare(
            "INSERT INTO events (event_id,seq,task_id,kind,occurred_at,actor,payload) VALUES (?,?,NULL,'audit.pruned',?,?,?)",
          )
          .run(
            cleanupId,
            seq,
            receipt.completedAt,
            origin === 'manual' ? 'user' : 'retention',
            JSON.stringify(receipt),
          );
      } else {
        remove(this.database, 'model_usage', 'usage_id', current.rows.modelUsage);
        remove(
          this.database,
          'decision_assessments',
          'assessment_id',
          current.rows.decisionAssessments,
        );
        const ids = JSON.stringify(
          [...current.rows.legacyUsage, ...current.rows.linkedOutcomes].map(
            (row) => row.decision_id,
          ),
        );
        this.database
          .prepare(
            'UPDATE route_outcomes SET audit_retained=0 WHERE decision_id IN (SELECT value FROM json_each(?))',
          )
          .run(ids);
        this.database
          .prepare(
            'INSERT INTO audit_cleanup_receipts (cleanup_id,project_id,completed_at,receipt_json) VALUES (?,?,?,?)',
          )
          .run(cleanupId, receipt.projectId, receipt.completedAt, JSON.stringify(receipt));
      }
      return receipt;
    };
    // Exactly one store is written. The Project lock also fences task-state reads for model cleanup.
    const receipt = project.transaction(() =>
      original.store === 'project' ? execute() : this.database.transaction(execute),
    );
    try {
      this.changed?.(receipt);
    } catch {
      log('warn', 'Audit cleanup notification failed after receipt commit.', {
        projectId: receipt.projectId,
      });
    }
    return receipt;
  }
  private expire(): void {
    for (const [id, value] of this.previews)
      if (value.expires <= this.now().getTime()) this.previews.delete(id);
  }
  private fail(message: string): never {
    throw new RpcError(message, RpcErrorCode.InvalidParams);
  }
}

import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, expect, it } from 'vitest';
import { projectManifest, uuidv7 } from '@gamecrafter/contracts';
import { Database } from '../db/database';
import { migrate } from '../db/migrator';
import { profileMigrations } from '../profile/migrations';
import { ProfileStore } from '../profile/profile-store';
import { ProjectDatabases } from '../projects/project-databases';
import { summaryFromManifest } from '../projects/workspace';
import { createBuiltinSettings } from '../settings/definitions';
import { SettingsRegistry } from '../settings/registry';
import { SettingsService } from '../settings/settings-service';
import { HandlerRegistry } from '../workers/handler-registry';
import { TaskGraph } from '../tasks/task-graph';
import { TaskStore } from '../tasks/task-store';
import { ToolStore } from '../tools/tool-store';
import { AuditRetention } from './audit-retention';

let directory: string,
  profile: Database,
  projects: ProjectDatabases,
  db: Database,
  projectId: string,
  retention: AuditRetention,
  graph: TaskGraph,
  tools: ToolStore,
  clock: Date;
const old = '2020-01-01T00:00:00.000Z',
  before = '2025-01-01T00:00:00.000Z';
beforeEach(() => {
  directory = mkdtempSync(path.join(tmpdir(), 'gc-retention-unit-'));
  const projectPath = path.join(directory, 'project');
  mkdirSync(projectPath);
  projectId = uuidv7();
  const manifest = projectManifest.assert({
    schemaVersion: 1,
    projectId,
    name: 'Retention unit',
    description: '',
    engine: { family: 'godot' },
    genres: [],
    modules: [],
    createdAt: old,
    createdByPlatformVersion: '0.22.0',
  });
  writeFileSync(path.join(projectPath, 'gamecrafter.project.json'), JSON.stringify(manifest));
  profile = Database.open(':memory:');
  migrate(profile, profileMigrations);
  const registry = new ProfileStore(profile);
  registry.register(summaryFromManifest(manifest, projectPath, null));
  projects = new ProjectDatabases(registry);
  db = projects.get(projectId);
  tools = new ToolStore(db);
  const settingsRegistry = new SettingsRegistry(),
    builtins = createBuiltinSettings();
  settingsRegistry.register('builtin', builtins.groups, builtins.definitions);
  const settings = new SettingsService(settingsRegistry, profile, projects);
  const handlers = new HandlerRegistry();
  handlers.register('noop.echo', { module: path.resolve('unused-handler.js') });
  graph = new TaskGraph({
    projectId,
    store: new TaskStore(db, () => new Date(old)),
    settings,
    handlers,
    now: () => new Date(old),
  });
  clock = new Date('2026-10-24T12:00:00.000Z');
  retention = new AuditRetention(registry, profile, projects, settings, () => clock);
});
afterEach(() => {
  retention.stop();
  projects.close();
  profile.close();
  rmSync(directory, { recursive: true, force: true });
});
function enabled(autoPrune = false) {
  retention.setPolicy(projectId, { retentionDays: 365, deletionEnabled: true, autoPrune });
}
function call(taskId: string | null = null) {
  return tools.finalizeCall({
    callId: uuidv7(),
    projectId,
    taskId,
    agentId: null,
    toolId: 'fixture/read',
    input: {},
    accessMode: 'full',
    decision: 'allowed',
    decisionReason: 'fixture',
    status: 'completed',
    output: null,
    error: null,
    evidence: [],
    costUsd: 0,
    costStatus: 'known',
    startedAt: old,
    finishedAt: old,
  });
}
function finish(taskId: string) {
  graph.transition(taskId, 'claimed', 'test', 'test');
  graph.transition(taskId, 'running', 'test', 'test');
  graph.complete(taskId, { summary: 'Done', artifacts: [], evidence: [] });
}
function apply() {
  const preview = retention.preview(projectId, 'project', before, 'session');
  return retention.apply(projectId, 'project', preview.previewId, 'session', true);
}
function modelRows() {
  for (const current of [true, false]) {
    const id = uuidv7();
    profile
      .prepare(
        "INSERT INTO route_decisions (decision_id,decision,project_id,task_type,model_id,explored,decided_at) VALUES (?,'{}',?,'fixture','fixture-model',0,?)",
      )
      .run(id, projectId, old);
    profile
      .prepare(
        "INSERT INTO route_outcomes (decision_id,success,quality_score,source,cost_usd,latency_ms,input_tokens,output_tokens,recorded_at) VALUES (?,1,0.9,'self',2,5,13,7,?)",
      )
      .run(id, old);
    if (current)
      profile
        .prepare(
          "INSERT INTO model_usage (usage_id,project_id,decision_id,model_id,occurred_at,input_tokens,output_tokens,cache_read_input_tokens,cache_creation_input_tokens,cost_usd,cost_status) VALUES (?,?,?,'fixture-model',?,13,7,0,0,2,'known')",
        )
        .run(uuidv7(), projectId, id, old);
  }
}
it('protects an entire active root tree, pending approvals and recent/provenance events', () => {
  const root = graph.create({ projectId, kind: 'noop.echo', title: 'Root', goal: 'Root' }).task;
  const child = graph.create({
    projectId,
    parentTaskId: root.taskId,
    kind: 'noop.echo',
    title: 'Child',
    goal: 'Child',
  }).task;
  finish(root.taskId);
  const record = call(root.taskId);
  enabled();
  expect(retention.preview(projectId, 'project', before, 'session').counts.calls).toBe(0);
  finish(child.taskId);
  const preview = retention.preview(projectId, 'project', before, 'session');
  expect(preview.counts.calls).toBe(1);
  expect(preview.counts.events).toBeGreaterThan(1);
  const receipt = retention.apply(projectId, 'project', preview.previewId, 'session', true);
  expect(tools.getCall(record.callId)).toBeUndefined();
  expect(new TaskStore(db).get(root.taskId)?.state).toBe('succeeded');
  expect(
    db.prepare("SELECT COUNT(*) AS count FROM events WHERE kind='audit.pruned'").get(),
  ).toEqual({ count: 1 });
  expect(receipt.counts).toEqual(preview.counts);
});
it('protects transitive prerequisites of active work across separate root trees', () => {
  const prerequisite = graph.create({
    projectId,
    kind: 'noop.echo',
    title: 'Prerequisite',
    goal: 'Prerequisite',
  }).task;
  finish(prerequisite.taskId);
  const middle = graph.create({
    projectId,
    kind: 'noop.echo',
    title: 'Middle',
    goal: 'Middle',
    dependsOn: [prerequisite.taskId],
  }).task;
  finish(middle.taskId);
  const active = graph.create({
    projectId,
    kind: 'noop.echo',
    title: 'Active',
    goal: 'Active',
    dependsOn: [middle.taskId],
  }).task;
  call(prerequisite.taskId);
  enabled();
  expect(retention.preview(projectId, 'project', before, 'session').counts.calls).toBe(0);
  finish(active.taskId);
  expect(retention.preview(projectId, 'project', before, 'session').counts.calls).toBe(1);
});
it('expires previews, binds sessions and refuses reuse or policy changes', () => {
  call();
  enabled();
  const preview = retention.preview(projectId, 'project', before, 'owner');
  expect(() => retention.apply(projectId, 'project', preview.previewId, 'other', true)).toThrow(
    'session',
  );
  clock = new Date(clock.getTime() + 300001);
  expect(() => retention.apply(projectId, 'project', preview.previewId, 'owner', true)).toThrow(
    'expired',
  );
  const changed = retention.preview(projectId, 'project', before, 'owner');
  retention.setPolicy(projectId, { retentionDays: 400, deletionEnabled: true, autoPrune: false });
  expect(() => retention.apply(projectId, 'project', changed.previewId, 'owner', true)).toThrow(
    'changed',
  );
  const closed = retention.preview(projectId, 'project', before, 'owner');
  retention.closeSession('owner');
  expect(() => retention.apply(projectId, 'project', closed.previewId, 'owner', true)).toThrow();
});
it('rolls Project deletion back if the permanent receipt cannot be written', () => {
  const record = call();
  enabled();
  db.exec(
    "CREATE TRIGGER reject_audit_receipt BEFORE INSERT ON events WHEN NEW.kind='audit.pruned' BEGIN SELECT RAISE(ABORT,'receipt blocked'); END",
  );
  expect(() => apply()).toThrow('receipt blocked');
  expect(tools.getCall(record.callId)).toBeDefined();
  expect(retention.state(projectId).receipts).toEqual([]);
});
it('hides legacy audit fallback while preserving route learning and commits model receipts atomically', () => {
  modelRows();
  enabled();
  const preview = retention.preview(projectId, 'model-usage', before, 'session');
  expect(preview.counts).toMatchObject({ modelUsage: 1, legacyUsage: 1 });
  profile.exec(
    "CREATE TRIGGER reject_model_receipt BEFORE INSERT ON audit_cleanup_receipts BEGIN SELECT RAISE(ABORT,'model receipt blocked'); END",
  );
  expect(() =>
    retention.apply(projectId, 'model-usage', preview.previewId, 'session', true),
  ).toThrow('model receipt blocked');
  expect(profile.prepare('SELECT COUNT(*) AS count FROM model_usage').get()).toEqual({ count: 1 });
  expect(profile.prepare('SELECT SUM(audit_retained) AS count FROM route_outcomes').get()).toEqual({
    count: 2,
  });
  profile.exec('DROP TRIGGER reject_model_receipt');
  const fresh = retention.preview(projectId, 'model-usage', before, 'session');
  retention.apply(projectId, 'model-usage', fresh.previewId, 'session', true);
  expect(profile.prepare('SELECT COUNT(*) AS count FROM model_usage').get()).toEqual({ count: 0 });
  expect(profile.prepare('SELECT quality_score,audit_retained FROM route_outcomes').all()).toEqual([
    { quality_score: 0.9, audit_retained: 0 },
    { quality_score: 0.9, audit_retained: 0 },
  ]);
  expect(retention.state(projectId).receipts).toHaveLength(1);
});
it('does no automatic deletion by default and requires explicit automatic policy', () => {
  const record = call();
  expect(retention.runAutomatic()).toEqual([]);
  expect(tools.getCall(record.callId)).toBeDefined();
  enabled();
  expect(retention.runAutomatic()).toEqual([]);
  enabled(true);
  const receipts = retention.runAutomatic();
  expect(receipts).toHaveLength(1);
  expect(receipts[0]?.origin).toBe('automatic');
  expect(tools.getCall(record.callId)).toBeUndefined();
  expect(retention.runAutomatic()).toEqual([]);
  retention.stop();
  expect(retention.runAutomatic()).toEqual([]);
});
it('previews bounded batches, retains cleanup receipts and preserves event sequence monotonicity', () => {
  for (let index = 0; index < 251; index++) call();
  enabled();
  const first = retention.preview(projectId, 'project', before, 'session');
  expect(first.counts.calls).toBe(250);
  expect(first.hasMore).toBe(true);
  const maximum = db.prepare('SELECT MAX(seq) AS seq FROM events').get<{ seq: number }>()!.seq;
  retention.apply(projectId, 'project', first.previewId, 'session', true);
  expect(
    db.prepare('SELECT MAX(seq) AS seq FROM events').get<{ seq: number }>()!.seq,
  ).toBeGreaterThan(maximum);
  expect(apply().counts.calls).toBe(1);
  expect(retention.state(projectId).receipts).toHaveLength(2);
  expect(retention.preview(projectId, 'project', before, 'session').counts.events).toBe(0);
});

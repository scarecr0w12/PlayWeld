import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  projectManifest,
  RpcErrorCode,
  uuidv7,
  type TaskCreateInput,
} from '@gamecrafter/contracts';
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
import { TaskGraph, type TaskGraphOptions } from './task-graph';
import { TaskStore } from './task-store';

let directory: string;
let profileDatabase: Database;
let projectDatabases: ProjectDatabases;
let graph: TaskGraph;
let store: TaskStore;
let projectId: string;
let options: TaskGraphOptions;

beforeEach(() => {
  directory = mkdtempSync(path.join(tmpdir(), 'gc-task-graph-'));
  projectId = uuidv7();
  const projectPath = path.join(directory, 'project');
  mkdirSync(projectPath);
  const manifest = projectManifest.assert({
    schemaVersion: 1,
    projectId,
    name: 'Task graph test',
    description: '',
    engine: { family: 'godot' },
    genres: [],
    modules: [],
    createdAt: new Date().toISOString(),
    createdByPlatformVersion: '0.1.0',
  });
  writeFileSync(path.join(projectPath, 'gamecrafter.project.json'), JSON.stringify(manifest));
  profileDatabase = Database.open(':memory:');
  migrate(profileDatabase, profileMigrations);
  const profile = new ProfileStore(profileDatabase);
  profile.register(summaryFromManifest(manifest, projectPath, null));
  projectDatabases = new ProjectDatabases(profile);
  store = new TaskStore(projectDatabases.get(projectId));
  const registry = new SettingsRegistry();
  const builtins = createBuiltinSettings();
  registry.register('builtin', builtins.groups, builtins.definitions);
  const handlers = new HandlerRegistry();
  handlers.register('noop.echo', { module: path.resolve('unused-test-handler.js') });
  options = {
    projectId,
    store,
    handlers,
    settings: new SettingsService(registry, profileDatabase, projectDatabases),
    onTaskTerminal: (task) => graph.onTaskTerminal(task),
  };
  graph = new TaskGraph(options);
});

afterEach(() => {
  projectDatabases?.close();
  profileDatabase?.close();
  rmSync(directory, { recursive: true, force: true });
});

function create(goal: string, patch: Partial<TaskCreateInput> = {}) {
  return graph.create({ projectId, kind: 'noop.echo', title: goal, goal, ...patch }).task;
}

describe('TaskGraph cancellation and dependency propagation', () => {
  it('fences every descendant before awaiting worker shutdown or publishing callbacks', async () => {
    const root = create('root');
    const child = create('child', { parentTaskId: root.taskId });
    const grandchild = create('grandchild', { parentTaskId: child.taskId });
    let callbackCount = 0;
    options.onTaskChanged = () => {
      callbackCount++;
      expect(graph.tree(root.taskId).every((task) => task.state === 'cancelled')).toBe(true);
      expect(() => create('callback delegation', { parentTaskId: root.taskId })).toThrowError(
        expect.objectContaining({ code: RpcErrorCode.InvalidTaskTransition }),
      );
    };
    let release!: () => void;
    const shutdown = new Promise<void>((resolve) => {
      release = resolve;
    });
    options.onCancelTask = async () => shutdown;
    const cancelled = graph.cancel(root.taskId);

    for (const parent of [root, child, grandchild]) {
      expect(graph.get(parent.taskId).state).toBe('cancelled');
      expect(() => create(`late-${parent.taskId}`, { parentTaskId: parent.taskId })).toThrowError(
        expect.objectContaining({ code: RpcErrorCode.InvalidTaskTransition }),
      );
    }
    release();
    expect(await cancelled).toHaveLength(3);
    expect(callbackCount).toBe(3);
    expect(graph.tree(root.taskId)).toHaveLength(3);
    expect(graph.tree(root.taskId).every((task) => task.state === 'cancelled')).toBe(true);
  });

  it('preserves request lineage for service followups after successful completion', () => {
    const root = create('root', { budget: { maxCostUsd: 2 } });
    const child = create('child', { parentTaskId: root.taskId });
    for (const task of [child, root]) {
      graph.transition(task.taskId, 'claimed', 'test', 'test');
      graph.transition(task.taskId, 'running', 'test', 'test');
      graph.complete(task.taskId, { summary: 'done', artifacts: [], evidence: [] });
    }
    const followup = create('service reconciliation', { parentTaskId: child.taskId });
    const revision = create('service revision', { parentTaskId: root.taskId });
    expect(followup).toMatchObject({
      parentTaskId: child.taskId,
      rootTaskId: root.taskId,
      state: 'ready',
    });
    expect(revision.rootTaskId).toBe(root.taskId);
    expect(graph.get(root.taskId).budget).toEqual({ maxCostUsd: 2 });
    expect(graph.tree(root.taskId)).toHaveLength(4);
  });

  it.each(['cancelled', 'failed'] as const)(
    'rejects creation through an active child of a %s ancestor',
    (outcome) => {
      const root = create('root');
      const child = create('child', { parentTaskId: root.taskId });
      graph.transition(root.taskId, 'claimed', 'test', 'test');
      graph.transition(root.taskId, 'running', 'test', 'test');
      graph.transition(root.taskId, outcome, 'test', 'test');
      expect(() => create('late grandchild', { parentTaskId: child.taskId })).toThrowError(
        expect.objectContaining({ code: RpcErrorCode.InvalidTaskTransition }),
      );
    },
  );

  it('durably revokes followups when cancelling an already successful request root', async () => {
    const root = create('completed root');
    graph.transition(root.taskId, 'claimed', 'test', 'test');
    graph.transition(root.taskId, 'running', 'test', 'test');
    graph.complete(root.taskId, { summary: 'done', artifacts: [], evidence: [] });
    const followup = create('first followup', { parentTaskId: root.taskId });
    expect(await graph.cancel(root.taskId)).toEqual([followup.taskId]);
    expect(graph.get(root.taskId).state).toBe('succeeded');
    expect(graph.get(followup.taskId).state).toBe('cancelled');
    expect(store.cancellationRequested(root.taskId)).toBe(true);
    expect(() => create('late followup', { parentTaskId: root.taskId })).toThrowError(
      expect.objectContaining({ code: RpcErrorCode.InvalidTaskTransition }),
    );

    // Reopen the actual Project database; the barrier must not rely on a graph's
    // process-local state or on changing the root's successful historical result.
    projectDatabases.close();
    store = new TaskStore(projectDatabases.get(projectId));
    options.store = store;
    graph = new TaskGraph(options);
    expect(store.cancellationRequested(root.taskId)).toBe(true);
    expect(() => create('followup after restart', { parentTaskId: root.taskId })).toThrowError(
      expect.objectContaining({ code: RpcErrorCode.InvalidTaskTransition }),
    );
    expect(graph.tree(root.taskId)).toHaveLength(2);
  });

  it('publishes every persisted cancellation event for a tree larger than the event page limit', async () => {
    const root = create('large root');
    for (let index = 0; index < 255; index++) {
      create(`child ${index}`, { parentTaskId: root.taskId });
    }
    const published: number[] = [];
    options.onTaskEvent = (event) => published.push(event.seq);
    const afterSeq = store.latestEventSeq();
    expect(await graph.cancel(root.taskId)).toHaveLength(256);
    expect(published).toEqual(store.events({ afterSeq, limit: 1000 }).map((event) => event.seq));
    expect(published).toHaveLength(513);
  });

  it.each(['succeeded', 'failed'] as const)(
    'propagates %s to every dependent beyond 200 unrelated and dependent pending rows',
    (outcome) => {
      const unrelated = create('unrelated prerequisite');
      for (let index = 0; index < 205; index++) {
        create(`unrelated ${index}`, { dependsOn: [unrelated.taskId] });
      }
      const prerequisite = create('prerequisite');
      const dependents = Array.from({ length: 205 }, (_, index) =>
        create(`dependent ${index}`, { dependsOn: [prerequisite.taskId] }),
      );
      graph.transition(prerequisite.taskId, 'claimed', 'test', 'test');
      graph.transition(prerequisite.taskId, 'running', 'test', 'test');
      if (outcome === 'succeeded') {
        graph.complete(prerequisite.taskId, { summary: 'done', artifacts: [], evidence: [] });
      } else {
        graph.fail(prerequisite.taskId, { code: 'test', message: 'failed', retryable: false });
      }
      expect(dependents.map((task) => graph.get(task.taskId).state)).toEqual(
        Array.from({ length: 205 }, () => (outcome === 'succeeded' ? 'ready' : 'blocked')),
      );
      expect(store.list({ states: ['pending'], limit: 1000 })).toHaveLength(205);
    },
  );
});

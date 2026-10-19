import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, expect, it } from 'vitest';
import { uuidv7, type RoleRecord } from '@gamecrafter/contracts';
import { Database } from '../db/database';
import { migrate } from '../db/migrator';
import { profileMigrations } from '../profile/migrations';
import { ProfileStore } from '../profile/profile-store';
import { ProjectDatabases } from '../projects/project-databases';
import { ProjectWorkspace, summaryFromManifest } from '../projects/workspace';
import { createBuiltinSettings } from '../settings/definitions';
import { SettingsRegistry } from '../settings/registry';
import { SettingsService } from '../settings/settings-service';
import { HandlerRegistry } from '../workers/handler-registry';
import { loadRoleDir } from '../roles/role-loader';
import { BoardService } from '../board/board-service';
import { TaskService } from './task-service';

let directory: string;
let profileDatabase: Database;
let projectDatabases: ProjectDatabases;
let tasks: TaskService;
let board: BoardService;
let role: RoleRecord;
let projectId: string;

beforeEach(() => {
  directory = mkdtempSync(path.join(tmpdir(), 'gc-task-role-policy-'));
  projectId = uuidv7();
  const projectPath = path.join(directory, 'project');
  mkdirSync(projectPath);
  const manifest = {
    schemaVersion: 1,
    projectId,
    name: 'Role policy',
    description: '',
    engine: { family: 'godot' },
    genres: [],
    modules: ['engine'],
    createdAt: new Date().toISOString(),
    createdByPlatformVersion: '0.1.0',
  };
  writeFileSync(path.join(projectPath, 'gamecrafter.project.json'), JSON.stringify(manifest));
  profileDatabase = Database.open(':memory:');
  migrate(profileDatabase, profileMigrations);
  const profile = new ProfileStore(profileDatabase);
  profile.register(summaryFromManifest(manifest, projectPath, null));
  projectDatabases = new ProjectDatabases(profile);
  const registry = new SettingsRegistry();
  const builtin = createBuiltinSettings();
  registry.register('builtin', builtin.groups, builtin.definitions);
  const settings = new SettingsService(registry, profileDatabase, projectDatabases);
  const handlers = new HandlerRegistry();
  handlers.register('agent.run', { module: path.join(directory, 'unused.js') });
  handlers.register('noop.echo', { module: path.join(directory, 'unused.js') });
  tasks = new TaskService(profile, projectDatabases, settings, handlers, {
    taskChanged() {},
    taskEvent() {},
    taskQuestion() {},
  });
  role = loadRoleDir(path.resolve(__dirname, '../../roles/engine-engineer'), 'builtin');
  tasks.setRoleResolver(() => role);
  const workspace = new ProjectWorkspace({ profile, platformVersion: '0.1.0' });
  tasks.setProjectModulesResolver((id) => workspace.get(id).modules);
  board = new BoardService({
    projectDatabases,
    settings,
    events: { threadChanged() {}, messagePosted() {}, decisionChanged() {} },
  });
  tasks.setBoardService(board);
});

afterEach(() => {
  projectDatabases?.close();
  profileDatabase?.close();
  rmSync(directory, { recursive: true, force: true });
});

const create = (goal: string, kind = 'agent.run') =>
  tasks.create({ projectId, kind, role: role.name, title: goal, goal }, { deferStart: true });

it('rejects agents missing required Project modules before creating tasks or subscriptions', () => {
  role = { ...role, requiresModules: ['story'] };
  expect(() => create('Missing story module')).toThrow(/story/);
  expect(tasks.list(projectId)).toHaveLength(0);
  expect(board.subscriptions(projectId)).toHaveLength(0);
  expect(create('Non-agent metadata', 'noop.echo').task.kind).toBe('noop.echo');
});

it('applies coordinator defaults and all-topic subscriptions when an agent omits its role', () => {
  tasks.setRoleResolver((name) =>
    loadRoleDir(path.resolve(__dirname, '../../roles', name), 'builtin'),
  );
  const task = tasks.create(
    { projectId, kind: 'agent.run', title: 'Default coordinator', goal: 'Coordinate work' },
    { deferStart: true },
  ).task;
  expect(task.assignee?.role).toBe('coordinator');
  expect(task.role).toBe('coordinator');
  expect(
    board
      .subscriptions(projectId, { kind: 'agent', role: 'coordinator' })
      .map((subscription) => subscription.filter),
  ).toEqual([{}]);
});

it('reconciles role board topics without duplicates, supports wildcard and preserves user subscriptions', () => {
  const user = board.subscribe(projectId, { kind: 'user' }, { tags: ['manual'] });
  const subscriber = { kind: 'agent' as const, role: role.name };
  create('First agent');
  const subscriptions = board.subscriptions(projectId, subscriber);
  expect(subscriptions).toHaveLength(1);
  expect(subscriptions[0]!.filter).toEqual({ tags: ['engineering', 'engine', 'decisions'] });
  create('Second agent');
  expect(board.subscriptions(projectId, subscriber)).toEqual(subscriptions);
  role = { ...role, boardSubscriptions: ['*'] };
  create('Wildcard agent');
  expect(board.subscriptions(projectId, subscriber).map((entry) => entry.filter)).toEqual([{}]);
  role = { ...role, boardSubscriptions: [] };
  create('Unsubscribed agent');
  expect(board.subscriptions(projectId, subscriber)).toEqual([]);
  expect(board.subscriptions(projectId)).toEqual([user]);
});

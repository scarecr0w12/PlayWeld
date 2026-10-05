import { mkdtempSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { Database } from '../db/database';
import { migrate } from '../db/migrator';
import { profileMigrations } from '../profile/migrations';
import { ProfileStore } from '../profile/profile-store';
import { renderProjectAgentsMd, ProjectWorkspace } from './workspace';
import { TaskStore } from '../tasks/task-store';
import { uuidv7, type TaskRecord } from '@gamecrafter/contracts';
import { ChatService } from '../chat/chat-service';
import { ProjectDatabases } from './project-databases';
import type { ProjectManifest } from '@gamecrafter/contracts';

describe('Project instructions template', () => {
  it('states the locked engine family and operational database location', () => {
    const manifest: ProjectManifest = {
      schemaVersion: 1,
      projectId: '019535d4-2c00-7000-8000-000000000001',
      name: 'Dungeon Test',
      description: '',
      engine: { family: 'godot' },
      genres: [],
      modules: [],
      createdAt: '2026-01-01T12:00:00.000Z',
      createdByPlatformVersion: '0.1.0',
    };

    const instructions = renderProjectAgentsMd(manifest);
    expect(instructions).toContain('godot');
    expect(instructions).toContain('Do not change');
    expect(instructions).toContain('.gamecrafter/project.sqlite');
    expect(instructions).toContain('not committed');
  });

  it('trusts platform-created Projects and leaves newly opened folders untrusted until confirmed', async () => {
    const parentDirectory = mkdtempSync(path.join(tmpdir(), 'gc-workspace-trust-'));
    const database = Database.open(':memory:');
    try {
      migrate(database, profileMigrations);
      const profile = new ProfileStore(database);
      const workspace = new ProjectWorkspace({ profile, platformVersion: '0.1.0' });
      const created = await workspace.create({
        name: 'Trusted Creation',
        engine: { family: 'godot' },
        parentDirectory,
      });
      expect(created.trusted).toBe(true);
      for (const directory of ['vectors.lancedb', 'qdrant']) {
        const file = `.gamecrafter/${directory}/data.bin`;
        mkdirSync(path.dirname(path.join(created.path, file)), { recursive: true });
        writeFileSync(path.join(created.path, file), 'private derived vectors');
        expect(
          execFileSync('git', ['check-ignore', file], {
            cwd: created.path,
            encoding: 'utf8',
          }).trim(),
        ).toBe(file);
      }
      expect(readFileSync(path.join(created.path, '.gitignore'), 'utf8')).toContain(
        '.gamecrafter/engine-runs/',
      );

      const importedPath = path.join(parentDirectory, 'imported-folder');
      mkdirSync(importedPath);
      const manifest: ProjectManifest = {
        schemaVersion: 1,
        projectId: '019535d4-2c00-7000-8000-000000000701',
        name: 'Imported Folder',
        description: '',
        engine: { family: 'godot' },
        genres: [],
        modules: [],
        createdAt: '2026-09-28T00:00:00.000Z',
        createdByPlatformVersion: '0.1.0',
      };
      writeFileSync(path.join(importedPath, 'gamecrafter.project.json'), JSON.stringify(manifest));
      const imported = workspace.open(importedPath);
      expect(readFileSync(path.join(importedPath, '.gitignore'), 'utf8')).toContain(
        '.gamecrafter/vectors.lancedb/',
      );
      expect(readFileSync(path.join(importedPath, '.gitignore'), 'utf8')).toContain(
        '.gamecrafter/qdrant/',
      );
      expect(readFileSync(path.join(importedPath, '.gitignore'), 'utf8')).toContain(
        '.gamecrafter/engine-runs/',
      );
      expect(imported.trusted).toBe(false);
      expect(workspace.trust(imported.projectId, true).trusted).toBe(true);
      expect(workspace.get(imported.projectId).trusted).toBe(true);
    } finally {
      database.close();
      rmSync(parentDirectory, { recursive: true, force: true });
    }
  });

  it('clones persisted chat and settings under the new Project identity', async () => {
    const parentDirectory = mkdtempSync(path.join(tmpdir(), 'gc-workspace-clone-'));
    const database = Database.open(':memory:');
    let databases: ProjectDatabases | undefined;
    try {
      migrate(database, profileMigrations);
      const profile = new ProfileStore(database);
      const workspace = new ProjectWorkspace({ profile, platformVersion: '0.1.0' });
      const source = await workspace.create({
        name: 'Source',
        engine: { family: 'godot' },
        parentDirectory,
      });
      databases = new ProjectDatabases(profile);
      const chat = new ChatService(databases);
      const conversation = chat.create(source.projectId, 'Keep this history');
      chat.append({
        projectId: source.projectId,
        conversationId: conversation.conversationId,
        role: 'user',
        content: 'Original history',
      });
      databases
        .get(source.projectId)
        .prepare('INSERT INTO settings_overrides (key, value, updated_at) VALUES (?, ?, ?)')
        .run('access.mode', JSON.stringify('restricted'), new Date().toISOString());
      const sourceTasks = new TaskStore(databases.get(source.projectId));
      const task = sourceTasks.insert(
        createTask({
          projectId: source.projectId,
          input: { nested: { projectId: source.projectId }, authoredText: source.projectId },
        }),
      );
      mkdirSync(path.join(source.path, '.gamecrafter', 'worktrees', 'live-task'), {
        recursive: true,
      });
      writeFileSync(
        path.join(source.path, '.gamecrafter', 'worktrees', 'live-task', '.git'),
        'gitdir: source',
      );
      for (const directory of ['vectors.lancedb', 'qdrant']) {
        mkdirSync(path.join(source.path, '.gamecrafter', directory), { recursive: true });
        writeFileSync(
          path.join(source.path, '.gamecrafter', directory, 'data.bin'),
          'source-only vectors',
        );
      }
      writeFileSync(
        path.join(source.path, '.gamecrafter', 'vectors.sqlite'),
        'source-only vectors',
      );
      await expect(
        workspace.clone({
          projectId: source.projectId,
          name: 'Nested',
          parentDirectory: source.path,
        }),
      ).rejects.toThrow('outside the source');
      const clone = await workspace.clone({
        projectId: source.projectId,
        name: 'Clone',
        parentDirectory,
      });
      expect(clone.projectId).not.toBe(source.projectId);
      expect(existsSync(path.join(clone.path, '.gamecrafter', 'worktrees'))).toBe(false);
      for (const name of ['vectors.lancedb', 'qdrant', 'vectors.sqlite'])
        expect(existsSync(path.join(clone.path, '.gamecrafter', name))).toBe(false);
      const clonedTask = new TaskStore(databases.get(clone.projectId)).get(task.taskId);
      expect(clonedTask).toMatchObject({
        projectId: clone.projectId,
        state: 'cancelled',
        lease: null,
        input: { nested: { projectId: clone.projectId }, authoredText: source.projectId },
      });
      expect(sourceTasks.get(task.taskId)?.state).toBe('pending');

      expect(chat.list(clone.projectId)).toHaveLength(1);
      expect(chat.messages(clone.projectId, conversation.conversationId)).toMatchObject([
        { projectId: clone.projectId, content: 'Original history' },
      ]);
      chat.append({
        projectId: clone.projectId,
        conversationId: conversation.conversationId,
        role: 'assistant',
        content: 'Clone only',
      });
      expect(chat.messages(source.projectId, conversation.conversationId)).toHaveLength(1);
      expect(
        databases
          .get(clone.projectId)
          .prepare('SELECT value FROM settings_overrides WHERE key = ?')
          .get('access.mode'),
      ).toEqual({ value: JSON.stringify('restricted') });
    } finally {
      databases?.close();
      database.close();
      rmSync(parentDirectory, { recursive: true, force: true });
    }
  }, 20_000);

  it('removes a newly created Project folder when Git initialization fails', async () => {
    const parentDirectory = mkdtempSync(path.join(tmpdir(), 'gc-workspace-'));
    const projectPath = path.join(parentDirectory, 'dungeon-test');
    const database = Database.open(':memory:');
    try {
      migrate(database, profileMigrations);
      const profile = new ProfileStore(database);
      const workspace = new ProjectWorkspace({
        profile,
        platformVersion: '0.1.0',
        git: {
          async run() {
            throw new Error('git failure');
          },
        },
      });

      await expect(
        workspace.create({
          name: 'Dungeon Test',
          engine: { family: 'godot' },
          parentDirectory,
        }),
      ).rejects.toThrow('git failure');
      expect(existsSync(projectPath)).toBe(false);
      expect(profile.list()).toEqual([]);
    } finally {
      database.close();
      rmSync(parentDirectory, { recursive: true, force: true });
    }
  });
});

function createTask(patch: Partial<TaskRecord> = {}): TaskRecord {
  const now = '2026-09-28T00:00:00.000Z';
  const taskId = uuidv7();
  return {
    schemaVersion: 1,
    taskId,
    projectId: '019535d4-2c00-7000-8000-000000000102',
    parentTaskId: null,
    rootTaskId: taskId,
    depth: 0,
    kind: 'noop.echo',
    title: 'Echo input',
    goal: 'Echo input',
    goalHash: 'e'.repeat(64),
    state: 'pending',
    priority: 50,
    dependsOn: [],
    assignee: null,
    budget: {},
    spent: { costUsd: 0, tokens: 0 },
    attempt: 1,
    maxAttempts: 3,
    lease: null,
    input: { message: 'hello' },
    checkpoint: null,
    result: null,
    error: null,
    createdAt: now,
    updatedAt: now,
    startedAt: null,
    finishedAt: null,
    ...patch,
  };
}

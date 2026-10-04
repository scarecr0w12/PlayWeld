import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, readdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import {
  PROJECT_MANIFEST_FILENAME,
  RpcErrorCode,
  projectManifest,
  uuidv7,
} from '@gamecrafter/contracts';
import { connect } from '@gamecrafter/service-client';
import { Database } from './db/database';
import { resolvePaths } from './paths';
import { PlatformService } from './service';

const temporaryDirectories: string[] = [];
let service: PlatformService | undefined;

afterEach(async () => {
  await service?.stop();
  service = undefined;
  for (const directory of temporaryDirectories.splice(0)) {
    rmSync(directory, { recursive: true, force: true });
  }
});

describe('platform service integration', () => {
  it('checks, downloads, verifies, and dismisses a release through update RPCs', async () => {
    const profileDir = makeTemporaryDirectory('gc-update-profile-');
    const paths = resolvePaths({ GAMECRAFTER_PROFILE_DIR: profileDir });
    const artifact = Buffer.from('verified package bytes');
    const manifest = {
      schemaVersion: 1,
      version: '0.2.0',
      tag: 'v0.2.0',
      commit: 'a'.repeat(40),
      builtAt: '2026-09-30T00:00:00.000Z',
      platforms: [
        {
          os: process.platform === 'win32' ? 'windows' : 'linux',
          arch: 'x64',
          asset: 'GameCrafter-0.2.0.AppImage',
          sha256: createHash('sha256').update(artifact).digest('hex'),
          kind: process.platform === 'win32' ? 'nsis' : 'appimage',
        },
      ],
      compatibility: {
        profileSchemaVersion: 11,
        projectSchemaVersion: 12,
        minUpgradeFromVersion: '0.1.0',
      },
      notes: 'Release test.',
    };
    const updateFetch: typeof fetch = async (input) => {
      const url = String(input);
      if (url.endsWith('gamecrafter-release.json'))
        return new Response(JSON.stringify(manifest), { status: 200 });
      if (url.endsWith('GameCrafter-0.2.0.AppImage'))
        return new Response(artifact, { status: 200 });
      return new Response('not found', { status: 404 });
    };
    service = await PlatformService.start({ paths, platformVersion: '0.1.0', updateFetch });
    const client = await connect({
      socketPath: service.socketPath,
      token: readFileSync(paths.tokenPath, 'utf8').trim(),
      clientName: 'update-test',
      clientVersion: '0.1.0',
    });
    await client.call('settings/set', {
      key: 'updates.releasesUrl',
      scope: 'platform',
      value: 'https://updates.test/gamecrafter-release.json',
    });

    const checked = await client.call('update/check', {});
    expect(checked.available?.version).toBe('0.2.0');
    expect(checked.compatibility).toEqual({ ok: true, reasons: [] });

    const downloaded = await client.call('update/download', { version: '0.2.0' });
    expect(downloaded.downloaded).toMatchObject({
      version: '0.2.0',
      verified: { sha256: true, signature: 'unavailable' },
    });

    const dismissed = await client.call('update/dismiss', { version: '0.2.0' });
    expect(dismissed.available).toBeNull();
    expect((await client.call('update/check', {})).available).toBeNull();
    await client.close();
  });

  it('authenticates clients and manages a complete local Project lifecycle', async () => {
    const profileDir = makeTemporaryDirectory('gc-profile-');
    const projectsDirectory = makeTemporaryDirectory('gc-projects-');
    const emptyDirectory = makeTemporaryDirectory('gc-empty-');
    const paths = resolvePaths({ GAMECRAFTER_PROFILE_DIR: profileDir });
    let resolveUnauthenticatedClose: () => void = () => undefined;
    const unauthenticatedClose = new Promise<void>((resolve) => {
      resolveUnauthenticatedClose = resolve;
    });
    service = await PlatformService.start({
      paths,
      platformVersion: '0.1.0',
      onClientEvent: (event) => {
        if (event === 'closed') resolveUnauthenticatedClose();
      },
    });
    const token = readFileSync(paths.tokenPath, 'utf8').trim();

    await expect(
      connect({
        socketPath: service.socketPath,
        token: 'wrong-token',
        clientName: 'test-client',
        clientVersion: '0.1.0',
      }),
    ).rejects.toMatchObject({ name: 'RpcError', code: -32000 });
    await unauthenticatedClose;

    const client = await connect({
      socketPath: service.socketPath,
      token,
      clientName: 'test-client',
      clientVersion: '0.1.0',
    });
    const info = await client.call('service/info', {});
    expect(info.protocolVersion).toBe(1);
    expect(info.pid).toBe(process.pid);
    expect(client.sessionId).toMatch(/^[0-9a-f-]{36}$/i);

    const settingsDescription = await client.call('settings/describe', {});
    expect(settingsDescription.groups).toHaveLength(17);
    expect(settingsDescription.definitions).toHaveLength(77);

    let resolveChanged: (value: unknown) => void = () => undefined;
    let resolveCloned: (value: unknown) => void = () => undefined;
    const changed = new Promise<unknown>((resolve) => {
      resolveChanged = resolve;
    });
    const clonedChanged = new Promise<unknown>((resolve) => {
      resolveCloned = resolve;
    });
    client.onNotification('project/changed', (params) => {
      if (params.kind === 'created') resolveChanged(params);
      if (params.kind === 'cloned') resolveCloned(params);
    });

    const project = await client.call('project/create', {
      name: 'Dungeon Test',
      engine: { family: 'godot' },
      genres: ['rpg'],
      parentDirectory: projectsDirectory,
    });
    const expectedFiles = [
      PROJECT_MANIFEST_FILENAME,
      '.gitignore',
      'AGENTS.md',
      'docs/README.md',
      'game/.gitkeep',
      '.gamecrafter/project.sqlite',
      '.gamecrafter/logs/.gitkeep',
      '.gamecrafter/cache/.gitkeep',
      '.agents/skills/.gitkeep',
    ];
    for (const file of expectedFiles) expect(existsSync(path.join(project.path, file))).toBe(true);
    expect(readdirSync(project.path)).toContain('.git');

    const manifest = JSON.parse(
      readFileSync(path.join(project.path, PROJECT_MANIFEST_FILENAME), 'utf8'),
    );
    expect(projectManifest.check(manifest)).toBe(true);
    expect(readFileSync(path.join(project.path, 'AGENTS.md'), 'utf8')).toContain('godot');

    const projectDatabase = Database.open(
      path.join(project.path, '.gamecrafter', 'project.sqlite'),
    );
    try {
      expect(projectDatabase.prepare('SELECT id FROM schema_migrations').all()).toHaveLength(12);
      expect(
        projectDatabase.prepare('SELECT kind FROM events WHERE kind = ?').all('project.created'),
      ).toHaveLength(1);
    } finally {
      projectDatabase.close();
    }
    const chat = await client.call('chat/create', {
      projectId: project.projectId,
      title: 'Review the dungeon layout',
    });
    const userMessage = await client.call('chat/append', {
      projectId: project.projectId,
      conversationId: chat.conversationId,
      role: 'user',
      content: 'How should this room flow?',
    });
    const assistantMessage = await client.call('chat/append', {
      projectId: project.projectId,
      conversationId: chat.conversationId,
      role: 'assistant',
      content: 'Give the player a clear route through the room.',
      modelId: 'test/model',
      usage: { inputTokens: 12, outputTokens: 9, costUsd: 0.001 },
    });
    expect(await client.call('chat/list', { projectId: project.projectId })).toMatchObject({
      conversations: [{ conversationId: chat.conversationId, title: chat.title }],
    });
    expect(
      await client.call('chat/messages', {
        projectId: project.projectId,
        conversationId: chat.conversationId,
      }),
    ).toMatchObject({ messages: [userMessage, assistantMessage] });
    expect(
      await client.call('chat/delete', {
        projectId: project.projectId,
        conversationId: chat.conversationId,
      }),
    ).toEqual({ deleted: true });
    expect(await client.call('chat/list', { projectId: project.projectId })).toEqual({
      conversations: [],
    });
    expect(
      execFileSync('git', ['log', '--oneline'], { cwd: project.path, encoding: 'utf8' })
        .trim()
        .split('\n'),
    ).toHaveLength(1);

    const listed = await client.call('project/list', {});
    expect(listed.projects).toHaveLength(1);
    expect(listed.projects[0]?.lastOpenedAt).toBeNull();
    const opened = await client.call('project/open', { path: project.path });
    expect(opened.projectId).toBe(project.projectId);
    expect(opened.lastOpenedAt).not.toBeNull();
    const projectAccess = await client.call('settings/set', {
      key: 'access.mode',
      scope: 'project',
      value: 'restricted',
      projectId: project.projectId,
    });
    expect(projectAccess).toMatchObject({ source: 'project', value: 'restricted' });
    const exported = await client.call('settings/export', { projectId: project.projectId });
    expect(exported).toMatchObject({ schemaVersion: 1, projectId: project.projectId });
    expect(exported.settings.find((setting) => setting.key === 'access.mode')).toMatchObject({
      source: 'project',
      value: 'restricted',
    });
    const preview = await client.call('settings/import', {
      document: exported,
      scope: 'project',
      projectId: project.projectId,
      dryRun: true,
    });
    expect(preview.importedKeys).toContain('access.mode');
    await client.call('task/create', {
      projectId: project.projectId,
      kind: 'noop.echo',
      title: 'Audit redaction fixture',
      goal: 'Audit redaction fixture',
      input: { password: 'audit-short-secret' },
    });
    const audit = await client.call('audit/read', { projectId: project.projectId, limit: 1 });
    expect(audit).toMatchObject({ schemaVersion: 1, projectId: project.projectId, limit: 1 });
    expect(audit.events).toHaveLength(1);
    expect(
      JSON.stringify(await client.call('audit/read', { projectId: project.projectId })),
    ).not.toContain('audit-short-secret');
    await expect(client.call('audit/read', { projectId: uuidv7() })).rejects.toThrow();
    expect(
      (
        await client.call('audit/read', {
          projectId: project.projectId,
          afterSeq: audit.nextAfterSeq,
        })
      ).events.every((event) => event.seq > audit.nextAfterSeq),
    ).toBe(true);
    expect(await client.call('settings/get', { key: 'access.mode' })).toMatchObject({
      source: 'default',
      value: 'ask-always',
    });
    const boardThread = await client.call('board/createThread', {
      projectId: project.projectId,
      title: 'Dungeon exit route',
      kind: 'question',
      tags: ['level-design'],
      body: 'Where should players escape the chamber?',
      type: 'question',
    });
    const boardMessage = await client.call('board/post', {
      projectId: project.projectId,
      threadId: boardThread.thread.threadId,
      type: 'finding',
      body: 'The western door is currently locked.',
      author: { kind: 'agent', role: 'explorer', taskId: null },
    });
    expect(boardMessage.author).toEqual({ kind: 'user' });
    expect(
      (
        await client.call('board/thread', {
          projectId: project.projectId,
          threadId: boardThread.thread.threadId,
          includeMessages: true,
        })
      ).messages.map((message) => message.seq),
    ).toEqual([1, 2]);
    expect(
      (
        await client.call('board/search', {
          projectId: project.projectId,
          query: 'western door',
        })
      ).messages[0]?.messageId,
    ).toBe(boardMessage.messageId);
    const brokerBoardTools = await client.call('tool/list', { projectId: project.projectId });
    expect(brokerBoardTools.tools.map((tool) => tool.toolId)).toContain('board/read');
    expect(brokerBoardTools.tools.map((tool) => tool.toolId)).toContain('board/post');
    expect(brokerBoardTools.tools.map((tool) => tool.toolId)).toContain('board/propose-decision');
    expect(brokerBoardTools.tools.map((tool) => tool.toolId)).not.toContain(
      'board/maintenance-execute',
    );
    const explorerTask = await client.call('task/create', {
      projectId: project.projectId,
      kind: 'noop.sleep',
      title: 'Read the discussion board',
      goal: 'Exercise board read tool role access',
      input: { ms: 30_000 },
      assignee: { role: 'explorer', accessCeiling: 'restricted' },
    });
    const readCall = await client.call('tool/call', {
      projectId: project.projectId,
      taskId: explorerTask.task.taskId,
      toolId: 'board/read',
      input: { threadId: boardThread.thread.threadId },
      accessCeiling: 'restricted',
    });
    expect(readCall.output.thread.threadId).toBe(boardThread.thread.threadId);
    await expect(
      client.call('tool/call', {
        projectId: project.projectId,
        taskId: explorerTask.task.taskId,
        toolId: 'board/post',
        input: { threadId: boardThread.thread.threadId, type: 'comment', body: 'not allowed' },
        accessCeiling: 'restricted',
      }),
    ).rejects.toMatchObject({ code: RpcErrorCode.RoleToolDenied });
    const designerTask = await client.call('task/create', {
      projectId: project.projectId,
      kind: 'noop.sleep',
      title: 'Post a board finding',
      goal: 'Exercise board post role access',
      input: { ms: 30_000 },
      assignee: { role: 'game-designer', accessCeiling: 'restricted' },
    });
    const postCall = await client.call('tool/call', {
      projectId: project.projectId,
      taskId: designerTask.task.taskId,
      toolId: 'board/post',
      input: {
        threadId: boardThread.thread.threadId,
        type: 'finding',
        body: 'The route needs a key.',
      },
      accessCeiling: 'restricted',
    });
    expect(postCall.output.author).toMatchObject({
      kind: 'agent',
      role: 'game-designer',
      taskId: designerTask.task.taskId,
    });
    const proposalCall = await client.call('tool/call', {
      projectId: project.projectId,
      taskId: designerTask.task.taskId,
      toolId: 'board/propose-decision',
      input: {
        threadId: boardThread.thread.threadId,
        title: 'Keep a spare key',
        statement: 'Every locked exit should have a recoverable key.',
      },
      accessCeiling: 'restricted',
    });
    expect(proposalCall.output.type).toBe('decision');
    expect(proposalCall.output.author).toMatchObject({ kind: 'agent', role: 'game-designer' });
    expect(
      (await client.call('board/decisions', { projectId: project.projectId })).decisions,
    ).toHaveLength(0);
    await client.call('task/cancel', {
      projectId: project.projectId,
      taskId: explorerTask.task.taskId,
      reason: 'board tool test complete',
    });
    await client.call('task/cancel', {
      projectId: project.projectId,
      taskId: designerTask.task.taskId,
      reason: 'board tool test complete',
    });
    await expect(
      client.call('board/delete', {
        projectId: project.projectId,
        threadId: boardThread.thread.threadId,
      }),
    ).rejects.toMatchObject({ code: -32075 });
    expect(await changed).toMatchObject({
      kind: 'created',
      project: { projectId: project.projectId },
    });

    const originalManifest = readFileSync(
      path.join(project.path, PROJECT_MANIFEST_FILENAME),
      'utf8',
    );
    execFileSync('git', ['remote', 'add', 'origin', 'https://example.invalid/source.git'], {
      cwd: project.path,
    });
    const cloneChat = await client.call('chat/create', {
      projectId: project.projectId,
      title: 'Keep in the clone',
    });
    const cloneEntry = await client.call('chat/append', {
      projectId: project.projectId,
      conversationId: cloneChat.conversationId,
      role: 'user',
      content: 'Clone this history',
    });
    const clone = await client.call('project/clone', {
      projectId: project.projectId,
      name: 'Dungeon Clone',
      parentDirectory: projectsDirectory,
    });
    expect(clone.projectId).not.toBe(project.projectId);
    expect(
      (
        await client.call('chat/messages', {
          projectId: clone.projectId,
          conversationId: cloneChat.conversationId,
        })
      ).messages,
    ).toMatchObject([{ projectId: clone.projectId, content: cloneEntry.content }]);
    expect(clone.engine.family).toBe(project.engine.family);
    expect(
      await client.call('settings/get', { key: 'access.mode', projectId: clone.projectId }),
    ).toMatchObject({ source: 'project', value: 'restricted' });
    expect(readFileSync(path.join(project.path, PROJECT_MANIFEST_FILENAME), 'utf8')).toBe(
      originalManifest,
    );
    expect(
      execFileSync('git', ['log', '--oneline'], { cwd: clone.path, encoding: 'utf8' })
        .trim()
        .split('\n'),
    ).toHaveLength(2);
    expect(execFileSync('git', ['remote'], { cwd: clone.path, encoding: 'utf8' }).trim()).toBe('');
    expect(readdirSync(path.join(clone.path, '.gamecrafter', 'cache'))).toEqual(['.gitkeep']);
    expect(readFileSync(path.join(clone.path, 'AGENTS.md'), 'utf8')).toContain('Dungeon Clone');

    const cloneDatabase = Database.open(path.join(clone.path, '.gamecrafter', 'project.sqlite'));
    try {
      expect(
        cloneDatabase
          .prepare('SELECT value FROM project_meta WHERE key = ?')
          .get<{ value: string }>('cloned_from')?.value,
      ).toBe(project.projectId);
    } finally {
      cloneDatabase.close();
    }
    expect(await clonedChanged).toMatchObject({
      kind: 'cloned',
      project: { projectId: clone.projectId },
    });
    expect((await client.call('project/list', {})).projects).toHaveLength(2);

    await expect(client.call('project/open', { path: emptyDirectory })).rejects.toMatchObject({
      name: 'RpcError',
      code: -32001,
    });
    await expect(
      client.call('project/get', { projectId: '019535d4-2c00-7000-8000-000000000099' }),
    ).rejects.toMatchObject({ name: 'RpcError', code: -32004 });
    await expect(
      client.call('project/create', {
        name: 'Dungeon Test',
        engine: { family: 'godot' },
        genres: ['rpg'],
        parentDirectory: projectsDirectory,
      }),
    ).rejects.toMatchObject({ name: 'RpcError', code: -32003 });

    client.close();
  }, 30000);

  it('persists chat history across platform-service restarts', async () => {
    const profileDir = makeTemporaryDirectory('gc-chat-profile-');
    const projectsDirectory = makeTemporaryDirectory('gc-chat-projects-');
    const paths = resolvePaths({ GAMECRAFTER_PROFILE_DIR: profileDir });
    service = await PlatformService.start({ paths, platformVersion: '0.1.0' });
    let client = await connect({
      socketPath: service.socketPath,
      token: readFileSync(paths.tokenPath, 'utf8').trim(),
      clientName: 'chat-persistence-test',
      clientVersion: '0.1.0',
    });
    const project = await client.call('project/create', {
      name: 'Chat Persistence',
      engine: { family: 'godot' },
      genres: [],
      parentDirectory: projectsDirectory,
    });
    const conversation = await client.call('chat/create', {
      projectId: project.projectId,
      title: 'Persistent conversation',
    });
    const message = await client.call('chat/append', {
      projectId: project.projectId,
      conversationId: conversation.conversationId,
      role: 'user',
      content: 'Remember this after restart.',
    });
    await client.close();
    await service.stop();

    service = await PlatformService.start({ paths, platformVersion: '0.1.0' });
    client = await connect({
      socketPath: service.socketPath,
      token: readFileSync(paths.tokenPath, 'utf8').trim(),
      clientName: 'chat-persistence-test',
      clientVersion: '0.1.0',
    });
    expect(
      await client.call('chat/messages', {
        projectId: project.projectId,
        conversationId: conversation.conversationId,
      }),
    ).toEqual({ messages: [message] });
    await client.close();
  }, 30_000);

  it('clears session-scoped settings when a client disconnects', async () => {
    const profileDir = makeTemporaryDirectory('gc-session-profile-');
    const paths = resolvePaths({ GAMECRAFTER_PROFILE_DIR: profileDir });
    let resolveClientClose: () => void = () => undefined;
    const clientClosed = new Promise<void>((resolve) => {
      resolveClientClose = resolve;
    });
    service = await PlatformService.start({
      paths,
      platformVersion: '0.1.0',
      onClientEvent: (event) => {
        if (event === 'closed') resolveClientClose();
      },
    });
    const token = readFileSync(paths.tokenPath, 'utf8').trim();
    const firstClient = await connect({
      socketPath: service.socketPath,
      token,
      clientName: 'session-test-client',
      clientVersion: '0.1.0',
    });
    await firstClient.call('settings/set', {
      key: 'access.mode',
      scope: 'session',
      value: 'restricted',
      sessionId: firstClient.sessionId,
    });
    firstClient.close();
    await clientClosed;

    const nextClient = await connect({
      socketPath: service.socketPath,
      token,
      clientName: 'session-test-client',
      clientVersion: '0.1.0',
    });
    expect(nextClient.sessionId).not.toBe(firstClient.sessionId);
    await expect(
      nextClient.call('settings/get', { key: 'access.mode', sessionId: firstClient.sessionId }),
    ).rejects.toMatchObject({ name: 'RpcError', code: -32013 });
    expect(await nextClient.call('settings/get', { key: 'access.mode' })).toMatchObject({
      source: 'default',
      value: 'ask-always',
    });
    nextClient.close();
  }, 30000);
});

function makeTemporaryDirectory(prefix: string): string {
  const directory = mkdtempSync(path.join(tmpdir(), prefix));
  temporaryDirectories.push(directory);
  return directory;
}

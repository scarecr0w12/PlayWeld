import { randomBytes } from 'node:crypto';
import { existsSync, mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { RpcErrorCode } from '@gamecrafter/contracts';
import { connect, type ServiceClient } from '@gamecrafter/service-client';
import { CredentialStore } from '../profile/credential-store';
import { Database } from '../db/database';
import { resolvePaths } from '../paths';
import { PlatformService } from '../service';

let service: PlatformService | undefined;
let client: ServiceClient | undefined;
let secondClient: ServiceClient | undefined;
let root: string | undefined;

beforeEach(async () => {
  root = mkdtempSync(path.join(tmpdir(), 'gc-backup-integration-'));
  const paths = resolvePaths({ GAMECRAFTER_PROFILE_DIR: path.join(root, 'profile') });
  service = await PlatformService.start({ paths, platformVersion: '0.1.0' });
  const options = {
    socketPath: service.socketPath,
    token: readFileSync(paths.tokenPath, 'utf8').trim(),
    clientVersion: '0.1.0',
  };
  client = await connect({ ...options, clientName: 'backup integration primary' });
  secondClient = await connect({ ...options, clientName: 'backup integration concurrent writer' });
});

afterEach(async () => {
  await secondClient?.close();
  await client?.close();
  await service?.stop();
  secondClient = undefined;
  client = undefined;
  service = undefined;
  if (root) rmSync(root, { recursive: true, force: true });
  root = undefined;
});

describe('backup service integration', () => {
  it('backs up, verifies, restores and registers a Project while another client writes', async () => {
    const project = await client!.call('project/create', {
      name: 'Backup Project',
      engine: { family: 'godot' },
      parentDirectory: path.join(root!, 'projects'),
      folderName: 'backup-project',
    });
    const thread = await client!.call('board/createThread', {
      projectId: project.projectId,
      title: 'Backup restore thread',
      kind: 'proposal',
      body: 'A thread to preserve in a backup.',
      type: 'proposal',
    });
    const conversation = await client!.call('chat/create', {
      projectId: project.projectId,
      title: 'Restore history',
    });
    const chatMessage = await client!.call('chat/append', {
      projectId: project.projectId,
      conversationId: conversation.conversationId,
      role: 'user',
      content: 'Preserve my history',
    });
    const gameAsset = path.join(project.path, 'game', 'large-test-asset.bin');
    writeFileSync(gameAsset, randomBytes(8 * 1024 * 1024));

    const identity = await client!.call('backup/identity/create', {
      label: 'Integration recovery key',
      secret: 'correct horse battery staple',
    });
    expect(JSON.stringify(identity)).not.toContain('correct horse battery staple');
    const destination = await client!.call('backup/addDestination', {
      kind: 'local',
      displayName: 'Local integration destination',
      config: { directory: path.join(root!, 'archives') },
    });
    expect(destination).not.toHaveProperty('secrets');
    await expect(
      client!.call('backup/testDestination', { destinationId: destination.destinationId }),
    ).resolves.toMatchObject({ ok: true });

    const started = await client!.call('backup/run', {
      scope: 'project',
      projectId: project.projectId,
      destinationId: destination.destinationId,
      identityId: identity.identityId,
    });
    expect(started).toMatchObject({
      status: 'running',
      scope: 'project',
      projectId: project.projectId,
    });
    const concurrentMessage = await secondClient!.call('board/post', {
      projectId: project.projectId,
      threadId: thread.thread.threadId,
      type: 'comment',
      body: 'This message was added while a backup was in progress.',
    });
    expect(concurrentMessage.body).toContain('while a backup was in progress');

    const verified = await waitForRun(started.runId);
    expect(verified).toMatchObject({
      status: 'verified',
      verifiedAt: expect.any(String),
      drilledAt: expect.any(String),
    });
    expect(
      (
        await client!.call('backup/archives', { destinationId: destination.destinationId })
      ).archives.map((archive) => archive.archiveName),
    ).toContain(verified.archiveName);
    const manifest = await client!.call('backup/inspect', {
      destinationId: destination.destinationId,
      archiveName: verified.archiveName,
      secret: 'correct horse battery staple',
    });
    const paths = manifest.entries.map((entry) => entry.path);
    expect(paths).toContain('.gamecrafter/project.sqlite');
    expect(paths.some((entry) => entry.startsWith('.gamecrafter/cache/'))).toBe(false);
    expect(paths.some((entry) => /\.sqlite-(?:wal|shm|journal)$/.test(entry))).toBe(false);
    expect(paths.some((entry) => entry.startsWith('.git/'))).toBe(true);
    await expect(
      client!.call('backup/inspect', {
        destinationId: destination.destinationId,
        archiveName: verified.archiveName,
        secret: 'incorrect horse battery staple',
      }),
    ).rejects.toMatchObject({ code: RpcErrorCode.BackupUnlockFailed });
    await expect(
      client!.call('backup/verify', {
        destinationId: destination.destinationId,
        archiveName: verified.archiveName,
        secret: 'incorrect horse battery staple',
      }),
    ).resolves.toMatchObject({ ok: false });
    await expect(
      client!.call('backup/verify', {
        destinationId: destination.destinationId,
        archiveName: verified.archiveName,
        secret: 'correct horse battery staple',
      }),
    ).resolves.toMatchObject({ ok: true, sha256: verified.sha256, files: expect.any(Number) });

    const restoredPath = path.join(root!, 'restored-project');
    const restored = await client!.call('backup/restore', {
      destinationId: destination.destinationId,
      archiveName: verified.archiveName,
      secret: 'correct horse battery staple',
      targetPath: restoredPath,
      register: true,
    });
    expect(restored.registeredProjectId).not.toBe(project.projectId);
    expect(restored.warnings).toContainEqual(expect.stringContaining('Project ID was changed'));
    const restoredSummary = await client!.call('project/get', {
      projectId: restored.registeredProjectId,
    });
    expect(restoredSummary.path).toBe(restoredPath);
    expect(
      (
        await client!.call('chat/messages', {
          projectId: restored.registeredProjectId!,
          conversationId: conversation.conversationId,
        })
      ).messages,
    ).toMatchObject([
      {
        projectId: restored.registeredProjectId,
        messageId: chatMessage.messageId,
        content: 'Preserve my history',
      },
    ]);
    const restoredManifest = JSON.parse(
      readFileSync(path.join(restoredPath, 'gamecrafter.project.json'), 'utf8'),
    );
    expect(restoredManifest).toMatchObject({
      projectId: restored.registeredProjectId,
      restoredFrom: { projectId: project.projectId, archiveId: verified.archiveId },
    });
    const restoredDatabase = Database.open(
      path.join(restoredPath, '.gamecrafter', 'project.sqlite'),
    );
    try {
      expect(
        restoredDatabase.prepare('PRAGMA integrity_check').get<{ integrity_check: string }>()
          ?.integrity_check,
      ).toBe('ok');
    } finally {
      restoredDatabase.close();
    }
    const restoredThread = await client!.call('board/thread', {
      projectId: restored.registeredProjectId,
      threadId: thread.thread.threadId,
      includeMessages: true,
    });
    expect(restoredThread.messages.map((message) => message.body)).toContain(thread.message.body);

    const secondRestored = await client!.call('backup/restore', {
      destinationId: destination.destinationId,
      archiveName: verified.archiveName,
      secret: 'correct horse battery staple',
      targetPath: path.join(root!, 'restored-project-again'),
      register: true,
    });
    expect(secondRestored.registeredProjectId).not.toBe(project.projectId);
    expect(secondRestored.registeredProjectId).not.toBe(restored.registeredProjectId);

    const occupiedTarget = path.join(root!, 'occupied-target');
    mkdirSync(occupiedTarget);
    writeFileSync(path.join(occupiedTarget, 'keep.txt'), 'do not overwrite');
    await expect(
      client!.call('backup/restore', {
        destinationId: destination.destinationId,
        archiveName: verified.archiveName,
        secret: 'correct horse battery staple',
        targetPath: occupiedTarget,
        register: false,
      }),
    ).rejects.toMatchObject({ code: RpcErrorCode.BackupTargetNotEmpty });
    expect(existsSync(path.join(occupiedTarget, 'keep.txt'))).toBe(true);
  }, 60_000);

  it('restores the profile database and encrypted credential key separately', async () => {
    const account = await client!.call('asset/addAccount', {
      providerKind: 'meshy',
      displayName: 'Profile backup fixture',
      baseUrl: 'https://api.meshy.ai',
      apiKey: 'profile-backup-api-secret',
    });
    const identity = await client!.call('backup/identity/create', {
      label: 'Profile recovery key',
      secret: 'another correct horse battery',
    });
    const destination = await client!.call('backup/addDestination', {
      kind: 'local',
      displayName: 'Profile local destination',
      config: { directory: path.join(root!, 'profile-archives') },
    });
    const started = await client!.call('backup/run', {
      scope: 'profile',
      destinationId: destination.destinationId,
      identityId: identity.identityId,
    });
    const verified = await waitForRun(started.runId);
    expect(verified.status).toBe('verified');
    const manifest = await client!.call('backup/inspect', {
      destinationId: destination.destinationId,
      archiveName: verified.archiveName,
      secret: 'another correct horse battery',
    });
    expect(manifest.entries.map((entry) => entry.path)).toContain('profile.sqlite');
    expect(manifest.entries.map((entry) => entry.path)).toContain('credentials.key');
    expect(manifest.entries.map((entry) => entry.path)).not.toContain('service.token');
    const targetPath = path.join(root!, 'restored-profile');
    const restored = await client!.call('backup/restore', {
      destinationId: destination.destinationId,
      archiveName: verified.archiveName,
      secret: 'another correct horse battery',
      targetPath,
    });
    expect(restored.warnings.join(' ')).toContain('GAMECRAFTER_PROFILE_DIR');
    const database = Database.open(path.join(targetPath, 'profile.sqlite'));
    try {
      const credentials = new CredentialStore(database, targetPath);
      expect(credentials.get(`asset-provider/${account.accountId}/apiKey`)).toBe(
        'profile-backup-api-secret',
      );
    } finally {
      database.close();
    }
  }, 60_000);
});

async function waitForRun(runId: string) {
  for (let attempt = 0; attempt < 600; attempt += 1) {
    const run = await client!.call('backup/run/get', { runId });
    if (run.status === 'verified') return run;
    if (run.status === 'failed' || run.status === 'cancelled') {
      throw new Error(`Backup run ended as ${run.status}: ${run.error}`);
    }
    await new Promise((resolve) => setTimeout(resolve, 25));
  }
  throw new Error(`Backup run did not verify: ${runId}`);
}

beforeEach(async () => {
  root = mkdtempSync(path.join(tmpdir(), 'gc-backup-integration-'));
  const paths = resolvePaths({ GAMECRAFTER_PROFILE_DIR: path.join(root, 'profile') });
  service = await PlatformService.start({ paths, platformVersion: '0.1.0' });
  const connection = {
    socketPath: service.socketPath,
    token: readFileSync(paths.tokenPath, 'utf8').trim(),
    clientVersion: '0.1.0',
  };
  client = await connect({ ...connection, clientName: 'backup integration primary' });
  secondClient = await connect({
    ...connection,
    clientName: 'backup integration concurrent writer',
  });
});

afterEach(async () => {
  await secondClient?.close();
  await client?.close();
  await service?.stop();
  secondClient = undefined;
  client = undefined;
  service = undefined;
  if (root) rmSync(root, { recursive: true, force: true });
  root = undefined;
});

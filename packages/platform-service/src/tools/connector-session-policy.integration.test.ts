import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { RpcErrorCode } from '@gamecrafter/contracts';
import { connect, type ServiceClient } from '@gamecrafter/service-client';
import { resolvePaths } from '../paths';
import { PlatformService } from '../service';

let service: PlatformService | undefined;
let client: ServiceClient | undefined;
let root: string | undefined;

afterEach(async () => {
  client?.close();
  await service?.stop();
  client = undefined;
  service = undefined;
  if (root) rmSync(root, { recursive: true, force: true });
  root = undefined;
});

describe('connector RPC session authorization', () => {
  it.each(['engine', 'dcc'] as const)(
    'retains Restricted and Ask Always policy through %s/run',
    async (kind) => {
      root = mkdtempSync(path.join(tmpdir(), 'gc-connector-policy-'));
      const paths = resolvePaths({ GAMECRAFTER_PROFILE_DIR: path.join(root, 'profile') });
      service = await PlatformService.start({ paths, platformVersion: '0.1.0' });
      client = await connect({
        socketPath: service.socketPath,
        token: readFileSync(paths.tokenPath, 'utf8').trim(),
        clientName: 'connector-policy',
        clientVersion: '0.1.0',
      });
      const project = await client.call('project/create', {
        name: 'Connector policy',
        engine: { family: 'unity' },
        parentDirectory: path.join(root, 'projects'),
        folderName: 'policy',
      });
      mkdirSync(path.join(project.path, 'game', 'ProjectSettings'), { recursive: true });
      writeFileSync(
        path.join(project.path, 'game', 'ProjectSettings', 'ProjectVersion.txt'),
        'm_EditorVersion: 6000.6.0f1\n',
      );
      await client.call('settings/set', {
        key: 'access.mode',
        scope: 'project',
        projectId: project.projectId,
        value: 'full',
      });
      await client.call('settings/set', {
        key: 'access.restricted.allowedSideEffects',
        scope: 'project',
        projectId: project.projectId,
        value: ['none'],
      });
      // Node is only a fixture installation. No mutating engine/DCC process is approved.
      if (kind === 'engine') {
        await client.call('engine/addInstallation', {
          family: 'unity',
          kind: 'cli',
          executable: process.execPath,
        });
      } else {
        await client.call('settings/set', {
          key: 'dcc.autoDetectInstallations',
          scope: 'platform',
          value: false,
        });
        await client.call('dcc/addInstallation', {
          tool: 'blender',
          kind: 'gui',
          executable: process.execPath,
        });
      }
      const toolId = kind === 'engine' ? 'engine/build' : 'dcc/export';
      const input = kind === 'engine' ? { params: {} } : { tool: 'blender', params: {} };
      const run = () =>
        kind === 'engine'
          ? client!.call('engine/run', { projectId: project.projectId, operation: 'build' })
          : client!.call('dcc/run', {
              projectId: project.projectId,
              tool: 'blender',
              operation: 'export',
            });
      await client.call('settings/set', {
        key: 'access.mode',
        scope: 'session',
        sessionId: client.sessionId,
        value: 'restricted',
      });
      await expect(
        client.call('tool/call', { projectId: project.projectId, toolId, input }),
      ).rejects.toMatchObject({ code: RpcErrorCode.ToolDenied });
      await expect(run()).rejects.toMatchObject({ code: RpcErrorCode.ToolDenied });
      let calls = (await client.call('tool/calls', { projectId: project.projectId, toolId })).calls;
      expect(calls).toHaveLength(2);
      expect(
        calls.every((call) => call.accessMode === 'restricted' && call.decision === 'denied'),
      ).toBe(true);
      await client.call('settings/set', {
        key: 'access.mode',
        scope: 'session',
        sessionId: client.sessionId,
        value: 'ask-always',
      });
      const rejected = expect(run()).rejects.toMatchObject({ code: RpcErrorCode.ToolDenied });
      let approvalId: string | undefined;
      const deadline = Date.now() + 5000;
      while (Date.now() < deadline && !approvalId) {
        approvalId = (
          await client.call('broker/approvals', { projectId: project.projectId, pendingOnly: true })
        ).approvals.find((approval) => approval.toolId === toolId)?.approvalId;
        if (!approvalId) await new Promise((resolve) => setTimeout(resolve, 10));
      }
      expect(approvalId).toBeDefined();
      await client.call('broker/approve', {
        projectId: project.projectId,
        approvalId: approvalId!,
        approve: false,
      });
      await rejected;
      calls = (await client.call('tool/calls', { projectId: project.projectId, toolId })).calls;
      expect(
        calls.some((call) => call.accessMode === 'ask-always' && call.decision === 'rejected'),
      ).toBe(true);
      const independent = await connect({
        socketPath: service.socketPath,
        token: readFileSync(paths.tokenPath, 'utf8').trim(),
        clientName: 'independent-policy',
        clientVersion: '0.1.0',
      });
      try {
        expect(
          (
            await independent.call('settings/get', {
              key: 'access.mode',
              projectId: project.projectId,
            })
          ).value,
        ).toBe('full');
      } finally {
        independent.close();
      }
    },
    30000,
  );
});

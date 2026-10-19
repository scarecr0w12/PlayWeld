import { mkdirSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { expect, it } from 'vitest';
import { connect } from '@gamecrafter/service-client';
import { PlatformService } from '../service';
import { resolvePaths } from '../paths';
import type { ToolBroker } from '../tools/tool-broker';
import { RpcErrorCode, uuidv7 } from '@gamecrafter/contracts';

it('offers integrated connector tools to specialists while retaining validator mutation denials', async () => {
  const directory = mkdtempSync(path.join(tmpdir(), 'gc-role-tools-'));
  const paths = resolvePaths({ GAMECRAFTER_PROFILE_DIR: path.join(directory, 'profile') });
  mkdirSync(path.join(directory, 'projects'));
  const service = await PlatformService.start({ paths, platformVersion: '0.1.0' });
  const client = await connect({
    socketPath: service.socketPath,
    token: readFileSync(paths.tokenPath, 'utf8').trim(),
    clientName: 'role-tools-test',
    clientVersion: '0.1.0',
  });
  try {
    const project = await client.call('project/create', {
      name: 'Role Tool Project',
      engine: { family: 'godot' },
      parentDirectory: path.join(directory, 'projects'),
      folderName: 'project',
    });
    await client.call('settings/set', {
      key: 'access.mode',
      scope: 'project',
      projectId: project.projectId,
      value: 'full',
    });
    const broker = (service as unknown as { toolBroker: ToolBroker }).toolBroker;
    const offered = (agentRole: string) =>
      broker.listTools(project.projectId, { agentRole }).map((tool) => tool.toolId);
    expect(offered('engine-engineer')).toEqual(
      expect.arrayContaining([
        'engine/discover',
        'engine/inspect',
        'engine/import',
        'engine/build',
        'engine/test',
        'engine/validate',
      ]),
    );
    expect(offered('asset-producer')).toEqual(
      expect.arrayContaining([
        'dcc/discover',
        'dcc/inspect',
        'dcc/import',
        'dcc/export',
        'dcc/convert',
        'dcc/render-preview',
        'dcc/validate',
      ]),
    );
    expect(offered('validator')).toEqual(
      expect.arrayContaining(['engine/discover', 'engine/inspect', 'dcc/discover', 'dcc/inspect']),
    );
    expect(offered('validator')).not.toContain('engine/edit-scene');
    expect(offered('validator')).not.toContain('dcc/run-script');
    expect(offered('asset-producer')).toEqual(
      expect.arrayContaining([
        'asset/generate',
        'asset/job',
        'asset/jobs',
        'asset/import',
        'asset/preview',
        'asset/files',
      ]),
    );
    const generation = broker
      .call(
        {
          projectId: project.projectId,
          toolId: 'asset/generate',
          input: {
            accountId: uuidv7(),
            request: { kind: 'text-to-3d', prompt: 'Test asset', outputFormat: 'glb' },
          },
        },
        { agentRole: 'asset-producer', accessCeiling: 'ask-always' },
      )
      .then(
        (result) => result,
        (error: unknown) => error,
      );
    await expect.poll(() => broker.listApprovals(project.projectId, true).length).toBe(1);
    const approval = broker.listApprovals(project.projectId, true)[0]!;
    expect(approval.toolId).toBe('asset/generate');
    expect(broker.listCalls(project.projectId, { toolId: 'asset/generate' })[0]?.decision).toBe(
      'approval-required',
    );
    broker.approve(project.projectId, approval.approvalId, false, 'Test denies paid request');
    await expect(generation).resolves.toMatchObject({ code: RpcErrorCode.ToolDenied });
  } finally {
    client.close();
    await service.stop();
    rmSync(directory, { recursive: true, force: true });
  }
}, 30_000);

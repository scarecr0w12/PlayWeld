import { createServer, type Server } from 'node:http';
import { mkdirSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { connect, type ServiceClient } from '@gamecrafter/service-client';
import type { ApprovalRequest } from '@gamecrafter/contracts';
import { resolvePaths } from '../paths';
import { PlatformService } from '../service';

let root: string | undefined;
let service: PlatformService | undefined;
let client: ServiceClient | undefined;
let provider: Server | undefined;

afterEach(async () => {
  client?.close();
  await service?.stop();
  if (provider) await new Promise<void>((resolve) => provider!.close(() => resolve()));
  if (root) rmSync(root, { recursive: true, force: true });
  client = undefined;
  service = undefined;
  provider = undefined;
  root = undefined;
});

describe('Agent execution with the default approval policy', () => {
  it.each([true, false])(
    'reaches model approval and honors approve=%s',
    async (approve) => {
      root = mkdtempSync(path.join(tmpdir(), 'gc-agent-approval-'));
      const paths = resolvePaths({ GAMECRAFTER_PROFILE_DIR: path.join(root, 'profile') });
      service = await PlatformService.start({ paths, platformVersion: '0.1.3' });
      client = await connect({
        socketPath: service.socketPath,
        token: readFileSync(paths.tokenPath, 'utf8').trim(),
        clientName: 'agent-approval-test',
        clientVersion: '0.1.3',
      });
      const parentDirectory = path.join(root, 'projects');
      mkdirSync(parentDirectory);
      const project = await client.call('project/create', {
        name: 'Agent approval',
        engine: { family: 'godot' },
        parentDirectory,
        folderName: 'approval',
      });
      let completions = 0;
      provider = createServer((request, response) => {
        request.resume();
        request.on('end', () => {
          response.writeHead(200, { 'content-type': 'application/json' });
          if (request.url === '/v1/models') {
            response.end(
              JSON.stringify({
                data: [
                  {
                    id: 'approval-model',
                    capabilities: {
                      chat: true,
                      tools: true,
                      contextWindow: 1_000_000,
                      maxOutputTokens: 4096,
                    },
                    pricing: { inputPerMTokUsd: 0.01, outputPerMTokUsd: 0.01 },
                  },
                ],
              }),
            );
          } else {
            completions++;
            response.end(
              JSON.stringify({
                choices: [
                  {
                    message: {
                      content: '',
                      tool_calls: [
                        {
                          id: 'complete',
                          type: 'function',
                          function: {
                            name: 'tasks/complete',
                            arguments: JSON.stringify({
                              summary: 'Approved agent finished',
                              artifacts: [],
                              evidence: [],
                              claims: [{ kind: 'generated', ref: 'summary' }],
                            }),
                          },
                        },
                      ],
                    },
                    finish_reason: 'tool_calls',
                  },
                ],
                usage: { prompt_tokens: 10, completion_tokens: 10 },
              }),
            );
          }
        });
      });
      await new Promise<void>((resolve) => provider!.listen(0, '127.0.0.1', resolve));
      const address = provider.address();
      if (!address || typeof address === 'string') throw new Error('Provider did not bind');
      const account = await client.call('provider/addAccount', {
        providerKind: 'openai-compatible',
        displayName: 'Approval fixture',
        isLocal: true,
        baseUrl: `http://127.0.0.1:${address.port}/v1`,
      });
      const { models } = await client.call('model/discover', {
        accountId: account.accountId,
        providerModelIds: ['approval-model'],
      });
      await client.call('pool/create', {
        name: 'Coordinator fixture',
        scope: 'project',
        projectId: project.projectId,
        target: { kind: 'agent', id: 'coordinator' },
        modelIds: [models[0]!.modelId],
      });
      const approvals: ApprovalRequest[] = [];
      client.onNotification('broker/approvalRequested', ({ approval }) => {
        approvals.push(approval);
      });
      const request = await client.call('change/request', {
        projectId: project.projectId,
        text: 'Return an approval test summary.',
      });
      await expect
        .poll(
          async () => {
            const task = await client!.call('task/get', {
              projectId: project.projectId,
              taskId: request.rootTaskId,
            });
            return approvals.length
              ? 'approval'
              : task.state === 'failed'
                ? task.error?.message
                : 'waiting';
          },
          { timeout: 10000 },
        )
        .toBe('approval');
      expect(approvals[0]!.toolId).toBe('model/complete');
      expect(completions).toBe(0);
      const locks = await client.call('tool/call', {
        projectId: project.projectId,
        toolId: 'locks/list',
        input: {},
      });
      expect(locks.status).toBe('completed');
      await client.call('broker/approve', {
        projectId: project.projectId,
        approvalId: approvals[0]!.approvalId,
        approve,
      });
      await expect
        .poll(
          async () =>
            (
              await client!.call('task/get', {
                projectId: project.projectId,
                taskId: request.rootTaskId,
              })
            ).state,
          { timeout: 10000 },
        )
        .toBe(approve ? 'succeeded' : 'failed');
      expect(completions).toBe(approve ? 1 : 0);
      const calls = await client.call('tool/calls', {
        projectId: project.projectId,
        toolId: 'model/complete',
      });
      expect(calls.calls[0]!.decision).toBe(approve ? 'approved' : 'rejected');
    },
    30000,
  );
});

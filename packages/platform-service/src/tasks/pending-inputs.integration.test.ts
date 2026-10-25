import { existsSync, mkdtempSync, readFileSync, renameSync, rmSync } from 'node:fs';
import { setTimeout as delay } from 'node:timers/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, expect, it } from 'vitest';
import { connect } from '@gamecrafter/service-client';
import { PlatformService } from '../service';
import { resolvePaths } from '../paths';

let service: PlatformService | undefined;
let directory: string | undefined;
afterEach(async () => {
  await service?.stop();
  service = undefined;
  if (directory) rmSync(directory, { recursive: true, force: true });
});

it('recovers service-owned pending inputs with exact Project and task context', async () => {
  directory = mkdtempSync(path.join(tmpdir(), 'gc-pending-inputs-'));
  const paths = resolvePaths({ GAMECRAFTER_PROFILE_DIR: path.join(directory, 'profile') });
  service = await PlatformService.start({
    paths,
    platformVersion: '0.22.0',
    approvalTimeoutOverrideMs: 30_000,
  });
  const connection = () =>
    connect({
      socketPath: service.socketPath,
      token: readFileSync(paths.tokenPath, 'utf8').trim(),
      clientName: 'pending-inputs-test',
      clientVersion: '0.22.0',
    });
  let client = await connection();
  const waitInputs = async (
    predicate: (value: Awaited<ReturnType<typeof client.call<'broker/pendingInputs'>>>) => boolean,
  ) => {
    const deadline = Date.now() + 15_000;
    while (Date.now() < deadline) {
      const value = await client.call('broker/pendingInputs', {});
      if (predicate(value)) return value;
      await delay(25);
    }
    throw new Error('Pending inputs did not reach the expected state');
  };
  try {
    expect(await client.call('broker/pendingInputs', {})).toMatchObject({
      schemaVersion: 1,
      inputs: [],
      unavailableProjects: [],
    });
    await client.call('settings/set', {
      key: 'board.maintenanceEnabled',
      scope: 'platform',
      value: false,
    });
    const a = await client.call('project/create', {
      name: 'Requests A',
      parentDirectory: directory,
      engine: { family: 'godot' },
    });
    const b = await client.call('project/create', {
      name: 'Requests B',
      parentDirectory: directory,
      engine: { family: 'godot' },
    });
    const root = (
      await client.call('task/create', {
        projectId: a.projectId,
        kind: 'noop.ask',
        title: 'Root question',
        goal: 'Get first answer',
        input: { prompt: 'Describe the scene' },
      })
    ).task;
    const child = (
      await client.call('task/create', {
        projectId: a.projectId,
        parentTaskId: root.taskId,
        kind: 'noop.ask',
        title: 'Child question',
        goal: 'Get child answer',
        input: { prompt: 'Choose colours', options: ['Warm', 'Cool'] },
      })
    ).task;
    const other = (
      await client.call('task/create', {
        projectId: b.projectId,
        kind: 'noop.ask',
        title: 'Other Project question',
        goal: 'Get other answer',
        input: { prompt: 'Choose style', options: ['Ink', 'Paint'] },
      })
    ).task;
    const pending = await waitInputs(
      (value) => value.inputs.filter((item) => item.kind === 'question').length === 3,
    );
    expect(pending.inputs.find((item) => item.taskId === child.taskId)).toMatchObject({
      projectId: a.projectId,
      projectName: 'Requests A',
      rootTaskId: root.taskId,
      rootTaskTitle: 'Root question',
      taskTitle: 'Child question',
    });
    const callA = client.call('tool/call', {
      projectId: a.projectId,
      toolId: 'fs/write-file',
      input: { path: 'game/approved.txt', content: 'sk-fakefixturecredential000000000000' },
      accessCeiling: 'ask-always',
    });
    const callB = client
      .call('tool/call', {
        projectId: b.projectId,
        toolId: 'fs/write-file',
        input: { path: 'game/rejected.txt', content: 'rejected' },
        accessCeiling: 'ask-always',
      })
      .then(
        () => ({ rejected: false, message: '' }),
        (error) => ({ rejected: true, message: String(error) }),
      );
    const snapshot = await waitInputs(
      (value) => value.inputs.filter((item) => item.kind === 'approval').length === 2,
    );
    const approvalA = snapshot.inputs.find(
      (item) => item.kind === 'approval' && item.projectId === a.projectId,
    )!;
    const approvalB = snapshot.inputs.find(
      (item) => item.kind === 'approval' && item.projectId === b.projectId,
    )!;
    expect(approvalA.kind).toBe('approval');
    expect(approvalB.kind).toBe('approval');
    if (approvalA.kind !== 'approval' || approvalB.kind !== 'approval')
      throw new Error('Missing approval');
    expect(JSON.stringify(snapshot)).not.toContain('sk-fakefixturecredential');
    expect(existsSync(path.join(a.path, 'game/approved.txt'))).toBe(false);
    await client.call('broker/approve', {
      projectId: a.projectId,
      approvalId: approvalA.approval.approvalId,
      approve: true,
    });
    expect((await callA).status).toBe('completed');
    expect(existsSync(path.join(b.path, 'game/rejected.txt'))).toBe(false);
    expect(
      (await client.call('broker/pendingInputs', {})).inputs.some(
        (item) =>
          item.kind === 'approval' && item.approval.approvalId === approvalB.approval.approvalId,
      ),
    ).toBe(true);
    await client.call('broker/approve', {
      projectId: b.projectId,
      approvalId: approvalB.approval.approvalId,
      approve: false,
    });
    expect(await callB).toMatchObject({
      rejected: true,
      message: expect.stringContaining('rejected'),
    });
    await expect(
      client.call('broker/approve', {
        projectId: a.projectId,
        approvalId: approvalA.approval.approvalId,
        approve: true,
      }),
    ).rejects.toThrow();
    const question = pending.inputs.find((item) => item.taskId === other.taskId)!;
    if (question.kind !== 'question') throw new Error('Missing question');
    await client.call('task/answer', {
      projectId: b.projectId,
      taskId: other.taskId,
      questionId: question.question.questionId,
      answer: 'Ink',
    });
    await client.call('task/cancel', { projectId: a.projectId, taskId: child.taskId });
    const remaining = await waitInputs((value) => value.inputs.length === 1);
    expect(remaining.inputs[0]?.taskId).toBe(root.taskId);
    renameSync(
      path.join(b.path, 'gamecrafter.project.json'),
      path.join(b.path, 'gamecrafter.project.json.offline'),
    );
    expect((await client.call('broker/pendingInputs', {})).unavailableProjects).toContainEqual({
      projectId: b.projectId,
      name: 'Requests B',
    });
    renameSync(
      path.join(b.path, 'gamecrafter.project.json.offline'),
      path.join(b.path, 'gamecrafter.project.json'),
    );
    await client.close();
    await service.stop();
    service = await PlatformService.start({ paths, platformVersion: '0.22.0' });
    client = await connection();
    const restored = await client.call('broker/pendingInputs', {});
    expect(restored.inputs).toEqual(remaining.inputs);
    const first = restored.inputs[0]!;
    if (first.kind !== 'question') throw new Error('Expected restored question');
    await client.call('task/answer', {
      projectId: a.projectId,
      taskId: root.taskId,
      questionId: first.question.questionId,
      answer: 'A hand-painted forest',
    });
    await waitInputs((value) => value.inputs.length === 0);
  } finally {
    await client.close();
  }
});

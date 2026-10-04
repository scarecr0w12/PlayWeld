// Real service examples on an owned profile/Project; no model/provider calls.
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const { setTimeout: delay } = require('node:timers/promises');
const { PlatformService } = require('../packages/platform-service/lib/service');
const { resolvePaths } = require('../packages/platform-service/lib/paths');
const { connect } = require('@gamecrafter/service-client');
const { RpcErrorCode } = require('@gamecrafter/contracts');
async function main() {
  const directory = path.resolve('.artifacts/documentation-examples', String(Date.now()));
  const paths = resolvePaths({
    ...process.env,
    GAMECRAFTER_PROFILE_DIR: path.join(directory, 'profile'),
  });
  let service, client;
  const checks = [],
    notifications = [];
  async function start() {
    service = await PlatformService.start({
      paths,
      platformVersion: require('../packages/platform-service/package.json').version,
    });
    client = await connect({
      socketPath: service.socketPath,
      token: fs.readFileSync(paths.tokenPath, 'utf8').trim(),
      clientName: 'documentation-examples',
      clientVersion: '0.0.0',
    });
    client.onNotification('task/changed', (message) => notifications.push(message));
  }
  try {
    await start();
    const project = await client.call('project/create', {
      name: 'Lantern service examples',
      engine: { family: 'godot' },
      parentDirectory: path.join(directory, 'projects'),
    });
    const skill = path.join(project.path, '.agents/skills/lantern-review');
    const role = path.join(project.path, '.gamecrafter/roles/lantern-reviewer');
    fs.mkdirSync(skill, { recursive: true });
    fs.mkdirSync(role, { recursive: true });
    fs.writeFileSync(
      path.join(skill, 'SKILL.md'),
      '---\nname: lantern-review\ndescription: Review the synthetic Lantern Workshop fixture.\nmetadata:\n  gamecrafter-purpose: "tutorial acceptance"\n---\nRead the fixture and report evidence truthfully.\n',
    );
    fs.writeFileSync(
      path.join(role, 'ROLE.md'),
      '---\nname: lantern-reviewer\ndescription: Inspect the synthetic tutorial fixture.\nwork-types: review\nmax-access: restricted\ntools: fs/read-file,fs/list\nskills: lantern-review\nisolation: none\nmemory: none\n---\nReport only observed evidence.\n',
    );
    assert(
      (await client.call('skills/list', { projectId: project.projectId })).skills.some(
        (item) => item.name === 'lantern-review',
      ),
    );
    assert(
      (await client.call('roles/list', { projectId: project.projectId })).roles.some(
        (item) => item.name === 'lantern-reviewer' && item.tools.includes('fs/list'),
      ),
    );
    checks.push('Project SKILL.md and ROLE.md examples loaded through real service registries');
    async function taskState(taskId, state) {
      for (let attempt = 0; attempt < 200; attempt++) {
        const task = await client.call('task/get', { projectId: project.projectId, taskId });
        if (task.state === state) return task;
        if (['failed', 'cancelled'].includes(task.state) && task.state !== state)
          throw new Error(JSON.stringify({ state: task.state, error: task.error }));
        await delay(100);
      }
      throw new Error(`Task ${taskId} did not reach ${state}`);
    }
    const sleeping = await client.call('task/create', {
      projectId: project.projectId,
      kind: 'noop.sleep',
      title: 'Cancellation fixture',
      goal: 'Cancel a synthetic sleeping task',
      input: { ms: 60000 },
    });
    await taskState(sleeping.task.taskId, 'running');
    await client.call('task/cancel', {
      projectId: project.projectId,
      taskId: sleeping.task.taskId,
      reason: 'Tutorial cancellation check',
    });
    await taskState(sleeping.task.taskId, 'cancelled');
    assert(
      (
        await client.call('task/events', {
          projectId: project.projectId,
          taskId: sleeping.task.taskId,
        })
      ).events.length > 0,
    );
    assert(notifications.length > 0);
    checks.push(
      'Real worker cancellation reaches terminal state with durable events and task notifications',
    );
    const checkpointed = await client.call('task/create', {
      projectId: project.projectId,
      kind: 'noop.checkpointed',
      title: 'Checkpoint recovery fixture',
      goal: 'Recover a synthetic crashed worker from checkpoint',
      maxAttempts: 3,
      input: { steps: 3, crashAt: 2 },
    });
    const recovered = await taskState(checkpointed.task.taskId, 'succeeded');
    assert(recovered.attempt > 1);
    checks.push(
      'Synthetic worker crash retried from checkpoint to success; deterministic handler, not model reasoning',
    );
    await assert.rejects(
      client.call('settings/get', { key: 'documentation.unknown' }),
      (error) => error.code === RpcErrorCode.UnknownSetting,
    );
    checks.push('Unknown-setting RPC error preserves the shared contract code');
    client.close();
    client = undefined;
    await service.stop();
    service = undefined;
    await start();
    assert.equal(
      (await client.call('project/get', { projectId: project.projectId })).projectId,
      project.projectId,
    );
    assert.equal(
      (
        await client.call('task/get', {
          projectId: project.projectId,
          taskId: checkpointed.task.taskId,
        })
      ).state,
      'succeeded',
    );
    checks.push(
      'Stopped profile reopened through current migrations; Project/task identities and terminal result preserved',
    );
    const report = {
      schemaVersion: 1,
      checkedAt: new Date().toISOString(),
      platformVersion: require('../packages/platform-service/package.json').version,
      target:
        'Actual isolated service/registries/workers; deterministic handler fixtures, no external provider or UI',
      checks,
    };
    fs.writeFileSync(path.join(directory, 'report.json'), JSON.stringify(report, null, 2) + '\n');
    console.log(JSON.stringify({ directory, ...report }, null, 2));
  } finally {
    client?.close();
    await service?.stop();
  }
}
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

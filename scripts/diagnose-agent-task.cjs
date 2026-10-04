// Read-only service diagnostics. Never emit tokens, prompts, tool inputs, or source text.
const fs = require('node:fs');
const path = require('node:path');
const { connect, resolveClientPaths } = require('@gamecrafter/service-client');

async function inspectTask(client, projectId, taskId) {
  const task = await client.call('task/get', { projectId, taskId });
  const [tree, locks, calls, events, role, access] = await Promise.all([
    client.call('task/tree', { projectId, rootTaskId: task.rootTaskId }),
    client.call('change/locks', { projectId }),
    client.call('tool/calls', { projectId, taskId, limit: 100 }),
    client.call('task/events', { projectId, taskId, limit: 500 }),
    task.role || task.assignee?.role
      ? client.call('roles/get', { projectId, name: task.role ?? task.assignee.role })
      : null,
    client.call('settings/get', { projectId, key: 'access.mode' }),
  ]);
  const snapshot = events.events
    .filter((event) => event.payload?.diagnostic === 'agent-tool-availability')
    .at(-1);
  const latestModelCall = calls.calls.find((call) => call.toolId === 'model/complete');
  const offeredToolIds =
    snapshot?.payload.offeredToolIds ??
    latestModelCall?.input?.request?.tools?.map((tool) => tool.name) ?? null;
  const desiredWrites = (task.touches ?? []).filter((touch) => touch.intent === 'write');
  return {
    schemaVersion: 1,
    checkedAt: new Date().toISOString(),
    projectId,
    task: {
      taskId, parentTaskId: task.parentTaskId, rootTaskId: task.rootTaskId,
      state: task.state, role: task.role ?? task.assignee?.role ?? null,
      accessCeiling: task.assignee?.accessCeiling ?? null,
      budget: task.budget,
      attempt: task.attempt, spent: task.spent, workerId: task.lease?.workerId ?? null,
      errorCode: task.error?.code ?? null,
    },
    access,
    rolePermissions: role ? { tools: role.tools, disallowedTools: role.disallowedTools, maxAccess: role.maxAccess } : null,
    toolAvailability: {
      source: snapshot ? 'scheduler-event' : latestModelCall ? 'model-call-audit' : 'unavailable',
      offeredToolIds,
      excludedTools: snapshot?.payload.excludedTools ?? null,
      callsLimit: 100, eventsLimit: 500,
    },
    tree: tree.tasks.map((entry) => ({
      taskId: entry.taskId, parentTaskId: entry.parentTaskId, state: entry.state,
      role: entry.role ?? entry.assignee?.role ?? null, goalHash: entry.goalHash,
    })),
    locks: locks.locks,
    blockingLocks: locks.locks.filter((lock) =>
      lock.taskId !== taskId && desiredWrites.some((touch) => touch.resource === lock.resource)),
    failedToolCalls: calls.calls
      .filter((call) => ['failed', 'denied', 'rejected', 'timed-out'].includes(call.status))
      .map((call) => ({
        callId: call.callId, toolId: call.toolId, status: call.status,
        decisionReason: call.decisionReason, errorCode: call.error?.code ?? null,
        startedAt: call.startedAt,
      })),
  };
}

async function main() {
  const args = process.argv.slice(2);
  if (args.length !== 6 || args[0] !== '--profile' || args[2] !== '--project' || args[4] !== '--task')
    throw new Error('Usage: node scripts/diagnose-agent-task.cjs --profile ABSOLUTE_PATH --project UUID --task UUID');
  if (!path.isAbsolute(args[1])) throw new Error('Choose an absolute profile path explicitly');
  const paths = resolveClientPaths({ ...process.env, GAMECRAFTER_PROFILE_DIR: args[1] });
  const client = await connect({
    socketPath: paths.socketPath,
    token: fs.readFileSync(paths.tokenPath, 'utf8').trim(),
    clientName: 'agent-task-diagnostics',
    clientVersion: require('../packages/service-client/package.json').version,
  });
  try {
    console.log(JSON.stringify(await inspectTask(client, args[3], args[5]), null, 2));
  } finally {
    client.close();
  }
}
if (require.main === module) main().catch((error) => {
  console.error('Diagnostic failed:', error.code ?? error.name);
  process.exitCode = 1;
});
module.exports = { inspectTask };

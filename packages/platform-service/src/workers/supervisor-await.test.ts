import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { expect, it, vi } from 'vitest';
import { projectManifest, uuidv7 } from '@gamecrafter/contracts';
import { Database } from '../db/database';
import { migrate } from '../db/migrator';
import { profileMigrations } from '../profile/migrations';
import { ProfileStore } from '../profile/profile-store';
import { ProjectDatabases } from '../projects/project-databases';
import { summaryFromManifest } from '../projects/workspace';
import { createBuiltinSettings } from '../settings/definitions';
import { SettingsRegistry } from '../settings/registry';
import { SettingsService } from '../settings/settings-service';
import { TaskService } from '../tasks/task-service';
import { ToolRegistry, type ToolContext } from '../tools/tool-registry';
import type { ToolBroker } from '../tools/tool-broker';
import { registerAgentTools, type AgentToolOptions } from '../agents/agent-tools';
import { HandlerRegistry } from './handler-registry';
import { WorkerSupervisor } from './supervisor';

// The outer deadline includes native worker startup and the supervisor's 10s
// shutdown grace period. Progress is independently bounded below (6s normally,
// 10s for the deliberately slow serialized-child regression).
const scenarioTimeoutMs = 30000;

it.each([1, 2])(
  'yields and safely reacquires slots for awaiting coordinators at concurrency %s, and refreshes authorized tools over IPC',
  async (concurrency) => runScenario(concurrency, 'complete'),
  scenarioTimeoutMs,
);
it(
  'awaits children whose serialized work exceeds the short timeout scenario budget',
  async () => runScenario(1, 'complete', 1500, 10000),
  scenarioTimeoutMs,
);
it(
  'reacquires capacity after tasks/await times out before returning control to the coordinator',
  async () => runScenario(1, 'timeout'),
  scenarioTimeoutMs,
);
it(
  'cancels a yielded coordinator and its descendants without resuming model execution',
  async () => runScenario(1, 'cancel'),
  scenarioTimeoutMs,
);

it(
  'reports an authorized tool refresh failure to its worker without an unhandled supervisor rejection',
  async () => runScenario(1, 'refresh-error'),
  scenarioTimeoutMs,
);

async function runScenario(
  concurrency: number,
  scenario: 'complete' | 'timeout' | 'cancel' | 'refresh-error',
  childDelayMs = 100,
  progressDeadlineMs = 6000,
) {
  const directory = mkdtempSync(path.join(tmpdir(), 'gc-await-regression-'));
  const projectId = uuidv7();
  const projectPath = path.join(directory, 'project');
  mkdirSync(projectPath);
  const manifest = projectManifest.assert({
    schemaVersion: 1,
    projectId,
    name: 'Await fixture',
    description: '',
    engine: { family: 'godot' },
    genres: [],
    modules: [],
    createdAt: new Date().toISOString(),
    createdByPlatformVersion: '0.1.0',
  });
  writeFileSync(path.join(projectPath, 'gamecrafter.project.json'), JSON.stringify(manifest));
  const db = Database.open(':memory:');
  let projects: ProjectDatabases | undefined;
  let supervisor: WorkerSupervisor | undefined;
  try {
    migrate(db, profileMigrations);
    const profile = new ProfileStore(db);
    profile.register(summaryFromManifest(manifest, projectPath, null));
    projects = new ProjectDatabases(profile);
    const registry = new SettingsRegistry();
    const builtins = createBuiltinSettings();
    registry.register('builtin', builtins.groups, builtins.definitions);
    const settings = new SettingsService(registry, db, projects);
    settings.set('agents.maxConcurrentPerProject', 'project', concurrency, { projectId });
    const handlers = new HandlerRegistry();
    handlers.register('agent.run', {
      module: path.join(__dirname, 'supervisor-await-fixture.cjs'),
      export: 'coordinator',
    });
    handlers.register('fixture.child', {
      module: path.join(__dirname, 'supervisor-await-fixture.cjs'),
      export: 'child',
    });
    const tasks = new TaskService(profile, projects, settings, handlers, {
      taskChanged: () => undefined,
      taskEvent: () => undefined,
      taskQuestion: () => undefined,
    });
    const tools = new ToolRegistry();
    registerAgentTools(tools, { tasks } as AgentToolOptions);
    let generation = 1;
    const inspectTools = vi.fn((_id, context) => {
      expect(context).toEqual({ agentRole: 'fixture', accessCeiling: 'restricted' });
      if (scenario === 'refresh-error' && inspectTools.mock.calls.length > 1)
        throw new Error('Role removed during tool refresh');
      return {
        tools: [{ toolId: `mcp/generation-${generation}`, inputSchema: { type: 'object' } }],
        excluded: [],
      };
    });
    const snapshots: number[] = [];
    supervisor = new WorkerSupervisor({
      tasks,
      settings,
      handlers,
      tickIntervalMs: 10,
      tools: {
        inspectTools,
        call: async (request, context) => {
          const result = await tools
            .get(request.toolId)!
            .handler(
              { projectId, taskId: request.taskId, signal: context.signal } as ToolContext,
              request.input,
            );
          return { status: 'completed', output: result.output };
        },
      } as unknown as ToolBroker,
      onWorkerStarted: (id) => {
        if (tasks.get(projectId, id).kind === 'fixture.child') generation = 2;
      },
      onScheduleSnapshot: (snapshot) => snapshots.push(snapshot.activeWorkerTaskIds.length),
    });
    tasks.setSupervisor(supervisor);
    const coordinators = Array.from({ length: scenario === 'refresh-error' ? 1 : 2 }, (_, i) => {
      const parent = tasks.create({
        projectId,
        kind: 'agent.run',
        title: `Parent ${i}`,
        goal: `Await child ${i}`,
        priority: 100,
        assignee: { role: 'fixture', accessCeiling: 'restricted' },
      }).task;
      const child = tasks.create({
        projectId,
        kind: 'fixture.child',
        title: `Child ${i}`,
        goal: `Do child ${i}`,
        parentTaskId: parent.taskId,
        priority: 1,
        input: { delayMs: scenario === 'cancel' ? 2000 : childDelayMs },
      }).task;
      tasks.runtime(projectId).graph.update(parent.taskId, {
        input: {
          childIds: [child.taskId],
          // Successful awaits must outlive the independently checked progress
          // deadline, including serialized child work and cold Windows forks.
          timeoutMs: scenario === 'timeout' ? 1 : 15000,
          expectTimeout: scenario === 'timeout',
        },
      });
      return parent;
    });
    supervisor.start();
    if (scenario === 'refresh-error') {
      const deadline = Date.now() + 3000;
      while (
        Date.now() < deadline &&
        tasks.get(projectId, coordinators[0]!.taskId).state !== 'failed'
      )
        await new Promise((resolve) => setTimeout(resolve, 10));
      const failed = tasks.get(projectId, coordinators[0]!.taskId);
      expect(failed.state).toBe('failed');
      expect(failed.error?.message).toContain('Role removed during tool refresh');
      return;
    }
    if (scenario === 'cancel') {
      const waitUntil = Date.now() + 3000;
      while (Date.now() < waitUntil && generation !== 2)
        await new Promise((resolve) => setTimeout(resolve, 10));
      expect(generation).toBe(2);
      await Promise.all(coordinators.map((parent) => tasks.cancel(projectId, parent.taskId)));
      for (const parent of coordinators)
        expect(tasks.get(projectId, parent.taskId).state).toBe('cancelled');
      expect(
        tasks
          .runtime(projectId)
          .store.list()
          .every((task) => task.state === 'cancelled'),
      ).toBe(true);
      return;
    }
    const deadline = Date.now() + progressDeadlineMs;
    while (
      Date.now() < deadline &&
      coordinators.some((parent) => tasks.get(projectId, parent.taskId).state !== 'succeeded')
    )
      await new Promise((resolve) => setTimeout(resolve, 10));
    for (const parent of coordinators) {
      const finished = tasks.get(projectId, parent.taskId);
      expect(finished.state, JSON.stringify(finished.error)).toBe('succeeded');
      expect(finished.spent).toEqual({ costUsd: 0, tokens: 0 });
      expect(JSON.parse(finished.result!.summary).timedOut).toBe(scenario === 'timeout');
      if (scenario === 'complete')
        expect(JSON.parse(finished.result!.summary).after).toEqual(['mcp/generation-2']);
    }
    expect(Math.max(...snapshots)).toBeLessThanOrEqual(concurrency);
    expect(inspectTools.mock.calls.length).toBeGreaterThanOrEqual(6);
  } finally {
    await supervisor?.stopAll({ checkpoint: false });
    projects?.close();
    db.close();
    rmSync(directory, { recursive: true, force: true });
  }
}

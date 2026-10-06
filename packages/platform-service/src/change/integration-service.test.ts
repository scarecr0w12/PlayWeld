import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import {
  projectManifest,
  RpcErrorCode,
  uuidv7,
  type TaskRecord,
  type TaskResult,
} from '@gamecrafter/contracts';
import { Database } from '../db/database';
import { migrate } from '../db/migrator';
import { profileMigrations } from '../profile/migrations';
import { ProfileStore } from '../profile/profile-store';
import { ProjectDatabases } from '../projects/project-databases';
import { projectMigrations } from '../projects/migrations';
import { summaryFromManifest } from '../projects/workspace';
import { createBuiltinSettings } from '../settings/definitions';
import { SettingsRegistry } from '../settings/registry';
import { SettingsService } from '../settings/settings-service';
import {
  HandlerRegistry,
  registerAgentHandlers,
  registerBuiltinHandlers,
} from '../workers/handler-registry';
import { TaskService } from '../tasks/task-service';
import { ChangeGraph } from './change-graph';
import { ChangeGraphStore } from './change-graph-store';
import { ChangeService } from './change-service';
import { IntegrationService } from './integration-service';
import { LockManager } from './lock-manager';
import { WorktreeManager } from './worktree-manager';
import type { ToolBroker } from '../tools/tool-broker';
import { ToolRegistry, type ToolContext } from '../tools/tool-registry';
import { registerEngineTools } from '../engines/engine-tools';
import { registerDccTools } from '../dcc/dcc-tools';

let fixture: ReturnType<typeof createFixture> | undefined;

afterEach(() => {
  fixture?.dispose();
  fixture = undefined;
});

describe('IntegrationService', () => {
  it.each([
    { kind: 'engine' as const, params: { filter: 'AshenCovenant' } },
    { kind: 'engine' as const, params: { params: { filter: 'AshenCovenant' } } },
    {
      kind: 'engine' as const,
      toolId: 'engine/validate',
      params: { params: { filter: 'AshenCovenant' } },
    },
    { kind: 'dcc' as const, params: { tool: 'blender', file: 'Art/character.blend' } },
    {
      kind: 'dcc' as const,
      params: { tool: 'blender', params: { file: 'Art/character.blend' } },
    },
  ])('runs a $kind completion validator through its registered input schema', async (validator) => {
    const registry = new ToolRegistry();
    const observed: Array<{ tool?: string; params: Record<string, unknown> }> = [];
    registerEngineTools(registry, async (_operation, _context, params) => {
      observed.push({ params });
      return { status: 'succeeded' };
    });
    registerDccTools(registry, async (tool, _operation, _context, params) => {
      observed.push({ tool, params });
      return { status: 'succeeded' };
    });
    fixture = createFixture(registry);
    const task = fixture.tasks.create({
      projectId: fixture.projectId,
      kind: 'agent.run',
      title: 'Registered completion validator',
      goal: 'Preserve the declared validation scope',
      contract: {
        required: ['generated'],
        validators: [
          {
            kind: validator.kind,
            operation: 'validate',
            params: validator.params,
            ...('toolId' in validator ? { toolId: validator.toolId } : {}),
          },
        ],
      },
    }).task;
    const validated = await fixture.integration.validateResult(task, {
      summary: 'Generated candidate',
      artifacts: [],
      evidence: [],
      claims: [{ kind: 'generated', ref: 'candidate' }],
    });
    expect(
      validated.integration.validation.find(
        (entry) => entry.kind === `validator:${validator.kind}`,
      ),
    ).toMatchObject({ ok: true });
    expect(observed).toEqual([
      validator.kind === 'engine'
        ? { params: { filter: 'AshenCovenant' } }
        : { tool: 'blender', params: { file: 'Art/character.blend' } },
    ]);
  });

  it.each([
    { kind: 'engine' as const, params: { params: 'invalid envelope' } },
    { kind: 'dcc' as const, params: { tool: 'unsupported', file: 'Art/character.blend' } },
  ])('keeps malformed $kind completion inputs rejected', async (validator) => {
    const registry = new ToolRegistry();
    let executed = false;
    registerEngineTools(registry, async () => {
      executed = true;
      return { status: 'succeeded' };
    });
    registerDccTools(registry, async () => {
      executed = true;
      return { status: 'succeeded' };
    });
    fixture = createFixture(registry);
    const task = fixture.tasks.create({
      projectId: fixture.projectId,
      kind: 'agent.run',
      title: 'Reject malformed validator',
      goal: 'Retain registered input validation',
      contract: {
        required: ['generated'],
        validators: [{ kind: validator.kind, operation: 'validate', params: validator.params }],
      },
    }).task;
    await expect(
      fixture.integration.validateResult(task, {
        summary: 'Candidate',
        artifacts: [],
        evidence: [],
        claims: [{ kind: 'generated', ref: 'candidate' }],
      }),
    ).rejects.toMatchObject({ code: RpcErrorCode.CompletionContractUnmet });
    expect(executed).toBe(false);
  });
  it.each(['aborted', 'rejected', 'integrated'] as const)(
    'preserves a %s integration when a completed task is observed after restart',
    async (status) => {
      fixture = createFixture();
      const task = fixture.tasks.create({
        projectId: fixture.projectId,
        kind: 'agent.run',
        title: 'Previously reviewed artifact',
        goal: 'Preserve the recorded integration decision',
        isolation: 'none',
      }).task;
      const graph = fixture.tasks.runtime(fixture.projectId).graph;
      graph.transition(task.taskId, 'claimed', 'test', 'test');
      graph.transition(task.taskId, 'running', 'test', 'test');
      graph.transition(task.taskId, 'succeeded', 'test', 'test', {
        result: { summary: 'Previously completed', artifacts: [], evidence: [] },
      });
      const record = fixture.changes.saveIntegration({
        ...integrationRecord(task, { path: '', branch: '', baseCommit: '' }),
        worktreePath: null,
        branch: null,
        baseCommit: null,
        status: status === 'aborted' ? 'conflict' : status,
      });
      graph.update(task.taskId, { integration: record });
      if (status === 'aborted') {
        await fixture.integration.abort(fixture.projectId, record.integrationId);
      }
      const reviewed = fixture.changes.integrationForTask(fixture.projectId, task.taskId);

      // A restarted service has not added this historical task to processedTasks.
      await fixture.integration.processTask(fixture.tasks.get(fixture.projectId, task.taskId));

      expect(fixture.changes.integrationForTask(fixture.projectId, task.taskId)).toEqual(reviewed);
      expect(reviewed?.status).toBe(status);
    },
  );

  it('downgrades unbacked validation claims and rejects unmet required claims', async () => {
    fixture = createFixture();
    const task = fixture.tasks.create({
      projectId: fixture.projectId,
      kind: 'agent.run',
      title: 'Claim evidence',
      goal: 'Validate claim backing',
      contract: { required: ['generated'], validators: [] },
    }).task;
    const result: TaskResult = {
      summary: 'Finished',
      artifacts: [],
      evidence: [],
      claims: [{ kind: 'engine-validation', ref: 'missing-engine-run' }],
    };

    const validated = await fixture.integration.validateResult(task, result);

    expect(validated.result.claims).toEqual([{ kind: 'generated', ref: 'missing-engine-run' }]);
    expect(validated.integration.validation).toMatchObject([
      { kind: 'engine-validation', ref: 'missing-engine-run', ok: false },
    ]);

    const unmet = fixture.tasks.create({
      projectId: fixture.projectId,
      kind: 'agent.run',
      title: 'Unmet contract',
      goal: 'Need a real tool check',
      contract: { required: ['tool-validation'], validators: [] },
    }).task;
    await expect(
      fixture.integration.validateResult(unmet, {
        summary: 'No validation',
        artifacts: [],
        evidence: [],
      }),
    ).rejects.toMatchObject({ code: RpcErrorCode.CompletionContractUnmet });
  });

  it('refuses integration when the Project worktree is dirty', async () => {
    fixture = createFixture();
    const task = fixture.tasks.create({
      projectId: fixture.projectId,
      kind: 'agent.run',
      title: 'Dirty integration',
      goal: 'Do not overwrite a dirty Project worktree',
      isolation: 'worktree',
    }).task;
    const worktree = await fixture.worktrees.create(fixture.projectId, task.taskId);
    const record = integrationRecord(task, worktree);
    fixture.changes.saveIntegration(record);
    fixture.tasks.runtime(fixture.projectId).graph.update(task.taskId, { integration: record });
    writeFileSync(path.join(fixture.projectPath, 'README.md'), 'uncommitted user change\n');

    await expect(
      fixture.integration.integrate(fixture.projectId, task.taskId),
    ).rejects.toMatchObject({
      code: RpcErrorCode.IntegrationNotReady,
    });
    expect(readFileSync(path.join(fixture.projectPath, 'README.md'), 'utf8')).toBe(
      'uncommitted user change\n',
    );
  });

  it('honors never/when-validated/always auto-integration policies and brokers restricted integration', async () => {
    fixture = createFixture();

    const never = await createSucceededWorktreeTask(fixture, 'never.txt', 'never');
    fixture.settings.set('coordination.autoIntegrate', 'project', 'never', {
      projectId: fixture.projectId,
    });
    await fixture.integration.processTask(never.task);
    const neverIntegration = fixture.changes.integrationForTask(
      fixture.projectId,
      never.task.taskId,
    );
    expect(
      neverIntegration,
      `Integration record: ${JSON.stringify(neverIntegration)}`,
    ).toMatchObject({
      status: 'ready',
    });
    expect(
      execFileSync('git', ['status', '--porcelain'], {
        cwd: fixture.projectPath,
        encoding: 'utf8',
      }).trim(),
    ).toBe('');

    const validated = await createSucceededWorktreeTask(fixture, 'validated.txt', 'when-validated');
    fixture.settings.set('coordination.autoIntegrate', 'project', 'when-validated', {
      projectId: fixture.projectId,
    });
    fixture.settings.set('access.mode', 'project', 'full', { projectId: fixture.projectId });
    await fixture.integration.processTask(validated.task);
    expect(
      fixture.changes.integrationForTask(fixture.projectId, validated.task.taskId)?.status,
    ).toBe('integrated');
    expect(readFileSync(path.join(fixture.projectPath, 'game', 'validated.txt'), 'utf8')).toBe(
      'when-validated\n',
    );

    const always = await createSucceededWorktreeTask(fixture, 'always.txt', 'always');
    const current = fixture.changes.integrationForTask(fixture.projectId, always.task.taskId)!;
    fixture.changes.saveIntegration({
      ...current,
      validation: [{ kind: 'static-check', ref: 'unverified', ok: false, detail: 'Not backed.' }],
    });
    fixture.settings.set('coordination.autoIntegrate', 'project', 'always', {
      projectId: fixture.projectId,
    });
    await fixture.integration.processTask(always.task);
    expect(fixture.changes.integrationForTask(fixture.projectId, always.task.taskId)?.status).toBe(
      'integrated',
    );

    const restricted = await createSucceededWorktreeTask(fixture, 'restricted.txt', 'restricted');
    fixture.settings.set('coordination.autoIntegrate', 'project', 'when-validated', {
      projectId: fixture.projectId,
    });
    fixture.settings.set('access.mode', 'project', 'restricted', { projectId: fixture.projectId });
    await fixture.integration.processTask(restricted.task);
    expect(fixture.brokerCalls.some((call) => call.toolId === 'change/integrate')).toBe(true);
    expect(
      fixture.changes.integrationForTask(fixture.projectId, restricted.task.taskId)?.status,
    ).toBe('ready');
  }, 30_000);
});

function createFixture(validatorRegistry?: ToolRegistry) {
  const root = mkdtempSync(path.join(tmpdir(), 'gc-integration-service-'));
  const projectPath = path.join(root, 'project');
  mkdirSync(path.join(projectPath, '.gamecrafter'), { recursive: true });
  mkdirSync(path.join(projectPath, 'game'), { recursive: true });
  writeFileSync(
    path.join(projectPath, '.gitignore'),
    '.gamecrafter/worktrees/\n.gamecrafter/agent-memory/\n.gamecrafter/*.sqlite\n*.sqlite-wal\n*.sqlite-shm\n*.sqlite-journal\n',
  );
  writeFileSync(path.join(projectPath, 'README.md'), 'base\n');
  writeFileSync(path.join(projectPath, 'game', '.gitkeep'), '');
  const manifest = projectManifest.assert({
    schemaVersion: 1,
    projectId: uuidv7(),
    name: 'Integration Test',
    description: '',
    engine: { family: 'godot' },
    genres: [],
    modules: [],
    createdAt: new Date().toISOString(),
    createdByPlatformVersion: '0.1.0',
  });
  writeFileSync(path.join(projectPath, 'gamecrafter.project.json'), JSON.stringify(manifest));
  execFileSync('git', ['init', '-b', 'main'], { cwd: projectPath, stdio: 'ignore' });
  execFileSync('git', ['config', 'core.autocrlf', 'false'], { cwd: projectPath, stdio: 'ignore' });
  execFileSync('git', ['add', '-A'], { cwd: projectPath, stdio: 'ignore' });
  execFileSync(
    'git',
    ['-c', 'user.name=PlayWeld', '-c', 'user.email=gamecrafter@localhost', 'commit', '-m', 'base'],
    { cwd: projectPath, stdio: 'ignore' },
  );

  const profileDatabase = Database.open(':memory:');
  migrate(profileDatabase, profileMigrations);
  const projects = new ProfileStore(profileDatabase);
  projects.register(summaryFromManifest(manifest, projectPath, null));
  const projectDatabase = Database.open(path.join(projectPath, '.gamecrafter', 'project.sqlite'));
  migrate(projectDatabase, projectMigrations);
  projectDatabase.close();
  const projectDatabases = new ProjectDatabases(projects);
  const settingsRegistry = new SettingsRegistry();
  const builtins = createBuiltinSettings();
  settingsRegistry.register('builtin', builtins.groups, builtins.definitions);
  const settings = new SettingsService(settingsRegistry, profileDatabase, projectDatabases);
  const handlers = new HandlerRegistry();
  registerBuiltinHandlers(handlers);
  registerAgentHandlers(handlers);
  const tasks = new TaskService(projects, projectDatabases, settings, handlers, {
    taskChanged: () => undefined,
    taskEvent: () => undefined,
    taskQuestion: () => undefined,
  });
  const graph = new ChangeGraph({
    storeForProject: (projectId) => new ChangeGraphStore(projectDatabases.get(projectId)),
    sources: {
      projectPath: () => projectPath,
      canonRecords: () => [],
      tasks: () => [],
      toolCalls: () => [],
    },
  });
  const changes = new ChangeService(
    projectDatabases,
    projects,
    tasks,
    graph,
    settings,
    {} as never,
  );
  const worktrees = new WorktreeManager(projects, settings);
  const locks = new LockManager(projectDatabases, settings);
  const brokerCalls: Array<{ toolId: string }> = [];
  const tools = {
    async call(request: { toolId: string; input: unknown }) {
      brokerCalls.push(request);
      if (validatorRegistry) {
        const registered = validatorRegistry.get(request.toolId);
        if (!registered) throw new Error('Unknown validator tool');
        registered.inputValidator.assert(request.input);
        const execution = await registered.handler(
          {
            projectId: manifest.projectId,
            projectPath,
            taskId: null,
            agentId: null,
            accessMode: 'full',
            callId: uuidv7(),
            signal: new AbortController().signal,
          } satisfies ToolContext,
          request.input,
        );
        return { callId: uuidv7(), status: 'completed', output: execution.output };
      }
      return { status: 'pending', output: null };
    },
    listCalls() {
      return [];
    },
  } as unknown as ToolBroker;
  const integration = new IntegrationService({
    projects,
    projectDatabases,
    tasks,
    roles: { get: () => ({ maxAccess: 'full' }) } as never,
    changes,
    locks,
    worktrees,
    tools,
    settings,
  });
  return {
    projectId: manifest.projectId,
    projectPath,
    projects,
    projectDatabases,
    settings,
    tasks,
    changes,
    worktrees,
    integration,
    brokerCalls,
    dispose() {
      projectDatabases.close();
      profileDatabase.close();
      rmSync(root, { recursive: true, force: true });
    },
  };
}

async function createSucceededWorktreeTask(
  fixture: ReturnType<typeof createFixture>,
  fileName: string,
  goal: string,
): Promise<{ task: TaskRecord; worktreePath: string }> {
  const created = fixture.tasks.create({
    projectId: fixture.projectId,
    kind: 'agent.run',
    title: goal,
    goal,
    isolation: 'worktree',
    contract: { required: ['generated'], validators: [] },
  });
  const task = created.task;
  const worktree = await fixture.worktrees.create(fixture.projectId, task.taskId);
  const record = integrationRecord(task, worktree);
  fixture.changes.saveIntegration(record);
  fixture.tasks.runtime(fixture.projectId).graph.update(task.taskId, { integration: record });
  const filePath = path.join(worktree.path, 'game', fileName);
  writeFileSync(filePath, `${goal}\n`);
  const graph = fixture.tasks.runtime(fixture.projectId).graph;
  graph.transition(task.taskId, 'claimed', 'test', 'test');
  graph.transition(task.taskId, 'running', 'test', 'test');
  const succeeded = graph.transition(task.taskId, 'succeeded', 'test', 'test', {
    result: {
      summary: goal,
      artifacts: [{ kind: 'file', path: `game/${fileName}` }],
      evidence: [],
      claims: [{ kind: 'generated', ref: `game/${fileName}` }],
    },
  });
  return { task: succeeded, worktreePath: worktree.path };
}

function integrationRecord(
  task: TaskRecord,
  worktree: { path: string; branch: string; baseCommit: string },
) {
  return {
    schemaVersion: 1 as const,
    integrationId: uuidv7(),
    projectId: task.projectId,
    taskId: task.taskId,
    worktreePath: worktree.path,
    branch: worktree.branch,
    baseCommit: worktree.baseCommit,
    status: 'ready' as const,
    changedFiles: [],
    conflicts: [],
    validation: [{ kind: 'generated', ref: task.taskId, ok: true, detail: 'Generated.' }],
    mergeCommit: null,
    reconcileTaskId: null,
    updatedAt: new Date().toISOString(),
  };
}

import { describe, expect, it } from 'vitest';
import {
  RpcErrorCode,
  uuidv7,
  type ChatResponse,
  type RoleRecord,
  type TaskRecord,
} from '@gamecrafter/contracts';
import type { TaskHandlerContext } from '../workers/types';
import { runAgentTask } from './agent-runtime';
import { estimateRequestTokens, modelContext } from './model-context';

const timestamp = '2026-09-29T00:00:00.000Z';

describe('agent runtime', () => {
  it.each([
    { contextWindow: 1_000_000, maxOutputTokens: 100_000 },
    { contextWindow: null, maxOutputTokens: null },
    { contextWindow: null, maxInputTokens: 1_000_000, maxOutputTokens: 128_000 },
  ])(
    'uses reported capacity or provider-managed limits instead of old defaults: %j',
    async (metadata) => {
      const requests: Array<{ request: { maxTokens?: number }; selectionId: string }> = [];
      const context = createContext(
        [
          response([
            {
              id: 'done',
              name: 'tasks/complete',
              arguments: JSON.stringify({
                summary: 'Complete',
                artifacts: [],
                evidence: [],
                claims: [],
              }),
            },
          ]),
        ],
        {
          initialCheckpoint: {
            transcript: [{ role: 'system', content: 'instruction '.repeat(20_000) }],
            pinnedCount: 1,
            turn: 0,
            maxCompletionTokens: 4096,
          },
          input: { role: roleSnapshot(), agentSettings: { maxTranscriptTokens: 60000 } },
          tool: async (id, args) => {
            if (id === 'model/prepare')
              return { selectionId: 'selected', modelId: 'reported-model', ...metadata };
            if (id === 'model/complete') requests.push(args as (typeof requests)[number]);
          },
        },
      );
      await runAgentTask(context);
      expect(requests).toHaveLength(1);
      expect(requests[0]!.selectionId).toBe('selected');
      if (metadata.maxOutputTokens === null)
        expect(requests[0]!.request).not.toHaveProperty('maxTokens');
      else expect(requests[0]!.request.maxTokens).toBe(metadata.maxOutputTokens);
    },
  );

  it('chunks a resumed transcript to the selected model capacity, including tool schemas', async () => {
    const requests: Array<{ messages: Parameters<typeof estimateRequestTokens>[0]; tools: [] }> =
      [];
    const context = createContext([], {
      initialCheckpoint: {
        transcript: [
          { role: 'system', content: 'Pinned constraints' },
          ...Array.from({ length: 30 }, () => ({ role: 'user', content: 'history '.repeat(1200) })),
        ],
        pinnedCount: 1,
        turn: 0,
      },
      tool: async (id, args) => {
        if (id === 'model/prepare')
          return {
            selectionId: 'small',
            modelId: 'small-model',
            contextWindow: 8000,
            maxOutputTokens: 1000,
          };
        if (id === 'model/complete') {
          const request = (args as { request: (typeof requests)[number] }).request;
          requests.push(structuredClone(request));
          return request.tools.length === 0
            ? response([], 'Retained decisions and paths.')
            : response([
                {
                  id: 'done',
                  name: 'tasks/complete',
                  arguments: JSON.stringify({
                    summary: 'Complete',
                    artifacts: [],
                    evidence: [],
                    claims: [],
                  }),
                },
              ]);
        }
      },
    });
    await runAgentTask(context);
    expect(requests.length).toBeGreaterThan(2);
    for (const request of requests)
      expect(estimateRequestTokens(request.messages, request.tools)).toBeLessThanOrEqual(7000);
    expect(requests.at(-1)!.messages[0]!.content).toBe('Pinned constraints');
  });

  it('honors an explicit lower ceiling and independent provider input limits', () => {
    const metadata = {
      selectionId: 'selected',
      modelId: 'model',
      contextWindow: 1_000_000,
      maxOutputTokens: 100_000,
    };
    expect(modelContext(metadata).inputLimit).toBe(900_000);
    expect(modelContext(metadata, 60_000).inputLimit).toBe(60_000);
    expect(modelContext(metadata, 2_000_000).inputLimit).toBe(900_000);
    expect(
      modelContext({ ...metadata, contextWindow: null, maxInputTokens: 1_000_000 }).inputLimit,
    ).toBe(1_000_000);
  });
  it('bounds a multi-megabyte recent tool result before the next model request', async () => {
    const requests: string[] = [];
    const context = createContext(
      [
        response([{ id: 'list', name: 'fs/list', arguments: '{"recursive":true}' }]),
        response([
          {
            id: 'done',
            name: 'tasks/complete',
            arguments: JSON.stringify({
              summary: 'Complete',
              artifacts: [],
              evidence: [],
              claims: [],
            }),
          },
        ]),
      ],
      {
        tool: async (id, input) => {
          if (id === 'fs/list') return { entries: 'generated-file '.repeat(300_000) };
          if (id === 'model/complete') requests.push(JSON.stringify(input));
        },
      },
    );
    await runAgentTask(context);
    expect(requests).toHaveLength(2);
    expect(requests[1]!.length).toBeLessThan(240_000);
    expect(requests[1]).toContain('truncated');
  });

  it('repairs oversized tool results in an existing checkpoint without replaying the tool', async () => {
    let replayed = false;
    let size = 0;
    const context = createContext(
      [
        response([
          {
            id: 'done',
            name: 'tasks/complete',
            arguments: JSON.stringify({
              summary: 'Recovered',
              artifacts: [],
              evidence: [],
              claims: [],
            }),
          },
        ]),
      ],
      {
        initialCheckpoint: {
          transcript: [
            { role: 'system', content: 'Keep project instructions' },
            {
              role: 'assistant',
              content: '',
              toolCalls: [{ id: 'old', name: 'fs/list', arguments: '{}' }],
            },
            { role: 'tool', toolCallId: 'old', name: 'fs/list', content: 'file '.repeat(900_000) },
          ],
          turn: 1,
          pinnedCount: 1,
        },
        tool: async (id, input) => {
          if (id === 'fs/list') replayed = true;
          if (id === 'model/complete') size = JSON.stringify(input).length;
        },
      },
    );
    expect((await runAgentTask(context)).summary).toBe('Recovered');
    expect(size).toBeLessThan(240_000);
    expect(replayed).toBe(false);
  });

  it('rejects oversized pinned input or tool schemas locally before contacting the model', async () => {
    let sent = false;
    const context = createContext([], {
      input: { role: roleSnapshot(), projectInstructions: 'instruction '.repeat(100_000) },
      tool: async (id) => {
        if (id === 'model/complete') sent = true;
      },
    });
    await expect(runAgentTask(context)).rejects.toThrow('including tool schemas');
    expect(sent).toBe(false);
    const schemaContext = createContext([], {
      tool: async (id) => {
        if (id === 'model/complete') sent = true;
      },
    });
    schemaContext.tools = [
      {
        toolId: 'test/huge',
        description: 'schema '.repeat(100_000),
      } as unknown as TaskHandlerContext['tools'][number],
    ];
    await expect(runAgentTask(schemaContext)).rejects.toThrow('including tool schemas');
    expect(sent).toBe(false);
  });

  it('reports the model output limit without executing partial tool calls', async () => {
    const limits: number[] = [];
    let writes = 0;
    const partial = response([
      { id: 'partial', name: 'fs/write-file', arguments: '{"path":"art/crystal.py","content":"' },
    ]);
    partial.finishReason = 'length';
    const context = createContext(
      [
        partial,
        response([
          {
            id: 'done',
            name: 'tasks/complete',
            arguments: JSON.stringify({
              summary: 'Complete',
              artifacts: [],
              evidence: [],
              claims: [{ kind: 'generated', ref: 'complete' }],
            }),
          },
        ]),
      ],
      {
        tool: async (id, input) => {
          if (id === 'model/complete')
            limits.push((input as { request: { maxTokens: number } }).request.maxTokens);
          if (id === 'fs/write-file') writes++;
        },
      },
    );
    await expect(runAgentTask(context)).rejects.toThrow('output limit');
    expect(limits).toEqual([4096]);
    expect(writes).toBe(0);
  });

  it('resumes from a checkpoint without replaying completed tool calls', async () => {
    const script = [
      response([{ id: 'call-once', name: 'test/do-once', arguments: '{}' }]),
      response([
        {
          id: 'call-complete',
          name: 'tasks/complete',
          arguments: JSON.stringify({
            summary: 'Resumed successfully',
            artifacts: [],
            evidence: [],
            claims: [{ kind: 'generated', ref: 'resumed-output' }],
          }),
        },
      ]),
    ];
    let savedCheckpoint: unknown;
    let interruptAfterToolResult = true;
    let completedToolCalls = 0;
    const context = createContext(script, {
      tool: async (toolId, input) => {
        if (toolId === 'test/do-once') {
          completedToolCalls += 1;
          return { completed: true, input };
        }
        return undefined;
      },
      checkpoint: async (checkpoint) => {
        savedCheckpoint = checkpoint;
        const messages = (checkpoint as { transcript?: Array<{ role: string }> }).transcript ?? [];
        if (interruptAfterToolResult && messages.some((message) => message.role === 'tool')) {
          interruptAfterToolResult = false;
          throw new Error('simulated worker termination');
        }
      },
    });

    await expect(runAgentTask(context)).rejects.toThrow('simulated worker termination');
    expect(completedToolCalls).toBe(1);

    const resumed = await runAgentTask({ ...context, initialCheckpoint: savedCheckpoint });

    expect(resumed.summary).toBe('Resumed successfully');
    expect(completedToolCalls).toBe(1);
  });

  it('compacts old turns while preserving the pinned skill body', async () => {
    const system = roleSnapshot();
    const oldMessages = Array.from({ length: 10 }, (_, index) => ({
      role: index % 2 === 0 ? ('assistant' as const) : ('user' as const),
      content: `Older turn ${index}: ${'detail '.repeat(300)}`,
    }));
    const initialCheckpoint = {
      transcript: [
        { role: 'system' as const, content: system.systemPrompt },
        { role: 'system' as const, content: '[Pinned skill: test-skill]\nPINNED_SKILL_BODY' },
        { role: 'user' as const, content: 'Do the bounded task' },
        ...oldMessages,
      ],
      turn: 3,
      pinnedCount: 2,
      activatedSkills: ['test-skill'],
      eligibleSkills: ['test-skill'],
      evidence: [],
    };
    const requests: Array<Record<string, unknown>> = [];
    const context = createContext(
      [
        response([], 'Earlier decisions were summarized.'),
        response([
          {
            id: 'call-complete',
            name: 'tasks/complete',
            arguments: JSON.stringify({
              summary: 'Compacted task complete',
              artifacts: [],
              evidence: [],
              claims: [{ kind: 'generated', ref: 'compacted' }],
            }),
          },
        ]),
      ],
      {
        initialCheckpoint,
        input: {
          role: system,
          projectInstructions: 'Project instructions',
          agentSettings: { contextTokenCeiling: 6000 },
        },
        tool: async (toolId, input) => {
          if (toolId === 'model/complete') {
            requests.push((input as { request: Record<string, unknown> }).request);
          }
          return undefined;
        },
      },
    );
    const result = await runAgentTask(context);

    expect(result.summary).toBe('Compacted task complete');
    expect(requests).toHaveLength(2);
    const mainMessages = requests[1]!.messages as Array<{ content: string }>;
    expect(mainMessages.some((message) => message.content.includes('PINNED_SKILL_BODY'))).toBe(
      true,
    );
    expect(mainMessages.some((message) => message.content.includes('[compacted summary]'))).toBe(
      true,
    );
  });

  it('stops at the role turn limit and the task budget', async () => {
    const turnLimited = createContext([response([])], {
      role: roleSnapshot({ maxTurns: 1 }),
    });
    await expect(runAgentTask(turnLimited)).rejects.toMatchObject({
      code: RpcErrorCode.AgentTurnLimit,
    });

    const budgetLimited = createContext([response([])], {
      task: taskRecord({ budget: { maxTokens: 0 } }),
    });
    await expect(runAgentTask(budgetLimited)).rejects.toMatchObject({
      code: RpcErrorCode.AgentBudgetExceeded,
    });
  });

  it('identifies the exhausted token budget separately from dollar spend', async () => {
    const context = createContext([], {
      task: taskRecord({
        budget: { maxTokens: 100_000, maxCostUsd: 5 },
        spent: { tokens: 102_925, costUsd: 0 },
      }),
    });
    await expect(runAgentTask(context)).rejects.toMatchObject({
      code: RpcErrorCode.AgentBudgetExceeded,
      message: expect.stringContaining('102925 / 100000 tokens'),
      data: expect.objectContaining({ budget: { maxTokens: 100_000, maxCostUsd: 5 } }),
    });
  });

  it('identifies dollar exhaustion without implying a token limit', async () => {
    const context = createContext([], {
      task: taskRecord({ budget: { maxCostUsd: 5 }, spent: { tokens: 100, costUsd: 5 } }),
    });
    await expect(runAgentTask(context)).rejects.toMatchObject({
      message: 'Agent task budget exhausted: $5 / $5 model cost.',
    });
  });

  it('allows high cumulative usage when the task has no token ceiling', async () => {
    const context = createContext(
      [
        response([
          {
            id: 'done',
            name: 'tasks/complete',
            arguments: JSON.stringify({
              summary: 'Complete',
              artifacts: [],
              evidence: [],
              claims: [],
            }),
          },
        ]),
      ],
      {
        task: taskRecord({ budget: { maxCostUsd: 5 }, spent: { tokens: 169414, costUsd: 0 } }),
      },
    );
    expect((await runAgentTask(context)).summary).toBe('Complete');
  });

  it('rejects completion claims that omit contract-required evidence kinds', async () => {
    const context = createContext(
      [
        response([
          {
            id: 'call-complete',
            name: 'tasks/complete',
            arguments: JSON.stringify({
              summary: 'Incomplete',
              artifacts: [],
              evidence: [],
              claims: [{ kind: 'generated', ref: 'file.txt' }],
            }),
          },
        ]),
      ],
      {
        task: taskRecord({ contract: { required: ['tool-validation'], validators: [] } }),
      },
    );

    await expect(runAgentTask(context)).rejects.toMatchObject({
      code: RpcErrorCode.CompletionContractUnmet,
    });
  });
});

function createContext(
  completions: ChatResponse[],
  overrides: {
    task?: TaskRecord;
    role?: RoleRecord;
    input?: unknown;
    initialCheckpoint?: unknown;
    tool?: TaskHandlerContext['tool'];
    checkpoint?: TaskHandlerContext['checkpoint'];
  } = {},
): TaskHandlerContext {
  const role = overrides.role ?? roleSnapshot();
  const task = overrides.task ?? taskRecord();
  const tool: TaskHandlerContext['tool'] = async (toolId, input) => {
    if (toolId === 'model/prepare')
      return (
        (await overrides.tool?.(toolId, input)) ?? {
          selectionId: 'fake-selection',
          modelId: 'fake-model',
          contextWindow: 64000,
          maxOutputTokens: 4096,
        }
      );
    if (toolId === 'model/complete') {
      const override = await overrides.tool?.(toolId, input);
      if (override && typeof override === 'object' && 'finishReason' in override) return override;
      return completions.shift() ?? response([]);
    }
    if (toolId === 'skills/search') return { entries: [] };
    return overrides.tool?.(toolId, input);
  };
  return {
    task,
    input: overrides.input ?? {
      role,
      projectInstructions: 'Project instructions',
      agentSettings: { maxTranscriptTokens: 60_000 },
    },
    tools: [],
    initialCheckpoint: overrides.initialCheckpoint ?? null,
    signal: new AbortController().signal,
    progress: () => undefined,
    checkpoint: overrides.checkpoint ?? (async () => undefined),
    ask: async () => 'answer',
    tool,
    reportUsage: async () => undefined,
  };
}

function roleSnapshot(patch: Partial<RoleRecord> = {}): RoleRecord {
  return {
    name: 'test-agent',
    description: 'Test role',
    workTypes: ['test'],
    requiresModules: [],
    modelPool: null,
    maxAccess: 'full',
    tools: [],
    disallowedTools: [],
    skills: [],
    mcpServers: [],
    maxTurns: 10,
    memory: 'none',
    boardSubscriptions: [],
    isolation: 'none',
    locks: [],
    location: '/tmp/test-role',
    scope: 'builtin',
    systemPrompt: 'Test role instructions',
    hash: 'a'.repeat(64),
    ...patch,
  };
}

function taskRecord(patch: Partial<TaskRecord> = {}): TaskRecord {
  const taskId = uuidv7();
  return {
    schemaVersion: 1,
    taskId,
    projectId: uuidv7(),
    parentTaskId: null,
    rootTaskId: taskId,
    depth: 0,
    kind: 'agent.run',
    title: 'Test agent task',
    goal: 'Complete a bounded task',
    goalHash: 'b'.repeat(64),
    state: 'running',
    priority: 50,
    dependsOn: [],
    assignee: null,
    budget: { maxTokens: 50_000, maxCostUsd: 1 },
    spent: { costUsd: 0, tokens: 0 },
    attempt: 1,
    maxAttempts: 3,
    lease: null,
    input: null,
    checkpoint: null,
    result: null,
    error: null,
    createdAt: timestamp,
    updatedAt: timestamp,
    startedAt: timestamp,
    finishedAt: null,
    ...patch,
  };
}

function response(
  toolCalls: Array<{ id: string; name: string; arguments: string }>,
  content = '',
): ChatResponse {
  return {
    content,
    toolCalls,
    finishReason: toolCalls.length > 0 ? 'tool_calls' : 'stop',
    usage: { inputTokens: 5, outputTokens: 2, costUsd: 0 },
    latencyMs: 1,
    modelId: 'fake-model',
    decisionId: uuidv7(),
  };
}

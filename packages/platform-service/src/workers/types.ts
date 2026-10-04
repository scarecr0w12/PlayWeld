import type {
  AccessMode,
  TaskError,
  TaskRecord,
  TaskResult,
  ToolDefinition,
} from '@gamecrafter/contracts';

export interface TaskHandlerContext {
  task: TaskRecord;
  input: unknown;
  tools: ToolDefinition[];
  initialCheckpoint: unknown;
  signal: AbortSignal;
  progress(message: string, percent?: number): void;
  checkpoint(data: unknown): Promise<void>;
  ask(prompt: string, options?: string[]): Promise<unknown>;
  tool(toolId: string, input: unknown): Promise<unknown>;
  reportUsage(usage: ReportedUsage): Promise<void>;
}

export interface ReportedUsage {
  costUsd?: number | null;
  costStatus?: 'known' | 'partial' | 'unknown';
  tokens?: number;
  inputTokens?: number;
  outputTokens?: number;
  cacheReadInputTokens?: number;
  cacheCreationInputTokens?: number;
  modelId?: string;
  decisionId?: string | null;
}

export type TaskHandler = (context: TaskHandlerContext) => Promise<TaskResult> | TaskResult;

export interface WorkerRunPayload {
  type: 'run';
  task: TaskRecord;
  handler: { module: string; export?: string };
  input: unknown;
  checkpoint: unknown;
  tools?: ToolDefinition[];
}

export type WorkerCommand =
  | WorkerRunPayload
  | { type: 'answer'; questionId: string; answer: unknown }
  | { type: 'tool-result'; requestId: string; output?: unknown; error?: TaskError }
  | { type: 'checkpoint-ack'; requestId: string }
  | { type: 'result-ack' }
  | { type: 'cancel' }
  | { type: 'checkpoint-and-stop' };

export type WorkerMessage =
  | { type: 'heartbeat' }
  | { type: 'answer-received'; questionId: string }
  | {
      type: 'tool-call';
      requestId: string;
      toolId: string;
      input: unknown;
      accessCeiling?: AccessMode;
    }
  | {
      type: 'progress';
      message: string;
      percent?: number;
      usage?: ReportedUsage;
    }
  | { type: 'checkpoint'; requestId: string; checkpoint: unknown }
  | { type: 'question'; questionId: string; prompt: string; options: string[] | null }
  | { type: 'result'; result: TaskResult }
  | { type: 'failed'; error: TaskError }
  | { type: 'stopped' };

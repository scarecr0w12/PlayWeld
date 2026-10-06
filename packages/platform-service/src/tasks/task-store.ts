import {
  RpcError,
  RpcErrorCode,
  TASK_TRANSITIONS,
  TaskEventKind,
  uuidv7,
  type TaskEvent,
  type TaskQuestion,
  type TaskRecord,
  type TaskState,
} from '@gamecrafter/contracts';
import type { Database } from '../db/database';

export interface TaskListFilter {
  states?: TaskState[];
  parentTaskId?: string | null;
  rootTaskId?: string;
  limit?: number;
}

export interface TaskEventFilter {
  taskId?: string;
  afterSeq?: number;
  limit?: number;
}

export type TaskRecordPatch = Partial<
  Omit<TaskRecord, 'schemaVersion' | 'taskId' | 'projectId' | 'createdAt' | 'state'>
>;

interface TaskRow {
  schemaVersion: number;
  taskId: string;
  projectId: string;
  parentTaskId: string | null;
  rootTaskId: string;
  depth: number;
  kind: string;
  title: string;
  goal: string;
  goalHash: string;
  state: TaskState;
  priority: number;
  dependsOnJson: string;
  assigneeJson: string | null;
  touchesJson: string | null;
  role: string | null;
  isolation: TaskRecord['isolation'] | null;
  completionContractJson: string | null;
  integrationJson: string | null;
  budgetJson: string;
  spentJson: string;
  attempt: number;
  maxAttempts: number;
  leaseJson: string | null;
  inputJson: string;
  checkpointJson: string;
  resultJson: string | null;
  errorJson: string | null;
  createdAt: string;
  updatedAt: string;
  startedAt: string | null;
  finishedAt: string | null;
}

interface EventRow {
  eventId: string;
  seq: number;
  taskId: string | null;
  kind: string;
  occurredAt: string;
  actor: string;
  payloadJson: string;
}

interface QuestionRow {
  questionId: string;
  taskId: string;
  prompt: string;
  optionsJson: string | null;
  askedAt: string;
  answerJson: string;
  answeredAt: string | null;
}

const taskColumns = `
  schema_version AS schemaVersion,
  task_id AS taskId,
  project_id AS projectId,
  parent_task_id AS parentTaskId,
  root_task_id AS rootTaskId,
  depth,
  kind,
  title,
  goal,
  goal_hash AS goalHash,
  state,
  priority,
  depends_on AS dependsOnJson,
  assignee AS assigneeJson,
  touches_json AS touchesJson,
  role,
  isolation,
  completion_contract_json AS completionContractJson,
  integration_json AS integrationJson,
  budget AS budgetJson,
  spent AS spentJson,
  attempt,
  max_attempts AS maxAttempts,
  lease AS leaseJson,
  input AS inputJson,
  checkpoint AS checkpointJson,
  result AS resultJson,
  error AS errorJson,
  created_at AS createdAt,
  updated_at AS updatedAt,
  started_at AS startedAt,
  finished_at AS finishedAt`;

export class TaskStore {
  constructor(
    private readonly database: Database,
    private readonly now: () => Date = () => new Date(),
  ) {}

  insert(task: TaskRecord): TaskRecord {
    this.database.transaction(() => {
      this.insertRow(task);
      this.appendEventUnsafe(
        task.taskId,
        TaskEventKind.Created,
        {
          taskId: task.taskId,
          kind: task.kind,
          goalHash: task.goalHash,
        },
        'service',
      );
    });
    return task;
  }

  get(taskId: string): TaskRecord | undefined {
    const row = this.database
      .prepare(`SELECT ${taskColumns} FROM tasks WHERE task_id = ?`)
      .get<TaskRow>(taskId);
    return row ? taskFromRow(row) : undefined;
  }

  list(filter: TaskListFilter = {}): TaskRecord[] {
    if (filter.states && filter.states.length === 0) return [];
    const conditions: string[] = [];
    const parameters: (string | number)[] = [];
    if (filter.states) {
      conditions.push(`state IN (${filter.states.map(() => '?').join(', ')})`);
      parameters.push(...filter.states);
    }
    if (Object.prototype.hasOwnProperty.call(filter, 'parentTaskId')) {
      if (filter.parentTaskId === null) conditions.push('parent_task_id IS NULL');
      else {
        conditions.push('parent_task_id = ?');
        parameters.push(filter.parentTaskId!);
      }
    }
    if (filter.rootTaskId) {
      conditions.push('root_task_id = ?');
      parameters.push(filter.rootTaskId);
    }
    const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    const limit = filter.limit ?? 200;
    const rows = this.database
      .prepare(`SELECT ${taskColumns} FROM tasks ${where} ORDER BY created_at, task_id LIMIT ?`)
      .all<TaskRow>(...parameters, limit);
    return rows.map(taskFromRow);
  }

  tree(rootTaskId: string): TaskRecord[] {
    return this.list({ rootTaskId, limit: Number.MAX_SAFE_INTEGER }).sort(
      (left, right) =>
        left.depth - right.depth ||
        left.createdAt.localeCompare(right.createdAt) ||
        left.taskId.localeCompare(right.taskId),
    );
  }

  update(taskId: string, patch: TaskRecordPatch): TaskRecord {
    const current = this.get(taskId);
    if (!current) throw taskNotFound(taskId);
    const updated = { ...current, ...patch, updatedAt: this.now().toISOString() };
    this.database.transaction(() => this.writeRow(updated));
    return updated;
  }

  transition(
    taskId: string,
    to: TaskState,
    reason: string,
    actor: string,
    patch: TaskRecordPatch = {},
  ): TaskRecord {
    return this.database.transaction(() => {
      const current = this.get(taskId);
      if (!current) throw taskNotFound(taskId);
      if (!TASK_TRANSITIONS[current.state].includes(to)) {
        throw new RpcError(
          `Invalid task transition: ${current.state} -> ${to}`,
          RpcErrorCode.InvalidTaskTransition,
          { taskId, from: current.state, to },
        );
      }
      const updated: TaskRecord = {
        ...current,
        ...patch,
        state: to,
        updatedAt: this.now().toISOString(),
      };
      this.writeRow(updated);
      this.appendEventUnsafe(
        taskId,
        TaskEventKind.StateChanged,
        { from: current.state, to, reason },
        actor,
      );
      return updated;
    });
  }

  appendEvent(taskId: string | null, kind: string, payload: unknown, actor: string): TaskEvent {
    return this.database.transaction(() => this.appendEventUnsafe(taskId, kind, payload, actor));
  }

  events(filter: TaskEventFilter = {}): TaskEvent[] {
    const conditions: string[] = [];
    const parameters: (string | number)[] = [];
    if (filter.taskId) {
      conditions.push('task_id = ?');
      parameters.push(filter.taskId);
    }
    if (filter.afterSeq !== undefined) {
      conditions.push('seq > ?');
      parameters.push(filter.afterSeq);
    }
    const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    const limit = filter.limit ?? 500;
    return this.database
      .prepare(
        `SELECT event_id AS eventId, seq, task_id AS taskId, kind,
          occurred_at AS occurredAt, actor, payload AS payloadJson
         FROM events ${where} ORDER BY seq LIMIT ?`,
      )
      .all<EventRow>(...parameters, limit)
      .map(eventFromRow);
  }

  latestEventSeq(): number {
    return (
      this.database
        .prepare('SELECT COALESCE(MAX(seq), 0) AS seq FROM events')
        .get<{ seq: number }>()?.seq ?? 0
    );
  }

  findActiveDuplicate(parentTaskId: string | null, goalHash: string): TaskRecord | undefined {
    const parentClause = parentTaskId === null ? 'parent_task_id IS NULL' : 'parent_task_id = ?';
    const parameters = parentTaskId === null ? [goalHash] : [parentTaskId, goalHash];
    const row = this.database
      .prepare(
        `SELECT ${taskColumns} FROM tasks
         WHERE ${parentClause} AND goal_hash = ?
           AND state NOT IN ('succeeded', 'failed', 'cancelled')
         ORDER BY created_at LIMIT 1`,
      )
      .get<TaskRow>(...parameters);
    return row ? taskFromRow(row) : undefined;
  }

  findActiveTouchDuplicate(
    goalHash: string,
    touches: NonNullable<TaskRecord['touches']>,
  ): TaskRecord | undefined {
    const requestedWrites = new Set(
      touches.filter((touch) => touch.intent === 'write').map((touch) => touch.resource),
    );
    if (requestedWrites.size === 0) return undefined;
    for (const candidate of this.list({
      states: ['pending', 'ready', 'claimed', 'running', 'waiting_input'],
      limit: 1_000,
    })) {
      if (candidate.goalHash !== goalHash) continue;
      const candidateWrites = new Set(
        (candidate.touches ?? [])
          .filter((touch) => touch.intent === 'write')
          .map((touch) => touch.resource),
      );
      if (candidateWrites.size === 0) continue;
      const overlap = [...requestedWrites].filter((resource) =>
        candidateWrites.has(resource),
      ).length;
      if (overlap / Math.min(requestedWrites.size, candidateWrites.size) >= 0.5) return candidate;
    }
    return undefined;
  }

  addQuestion(
    taskId: string,
    prompt: string,
    options: string[] | null,
    actor: string,
    questionId: string = uuidv7(),
  ): TaskQuestion {
    const question: TaskQuestion = {
      questionId,
      taskId,
      prompt,
      options,
      askedAt: this.now().toISOString(),
      answer: null,
      answeredAt: null,
    };
    this.database.transaction(() => {
      this.database
        .prepare(
          `INSERT INTO task_questions
            (question_id, task_id, prompt, options, asked_at, answer, answered_at)
           VALUES (?, ?, ?, ?, ?, ?, NULL)`,
        )
        .run(
          question.questionId,
          taskId,
          prompt,
          options === null ? null : JSON.stringify(options),
          question.askedAt,
          JSON.stringify(null),
        );
      this.appendEventUnsafe(
        taskId,
        TaskEventKind.Question,
        { questionId: question.questionId, prompt, options },
        actor,
      );
    });
    return question;
  }

  getQuestion(taskId: string, questionId: string): TaskQuestion | undefined {
    const row = this.database
      .prepare(
        `SELECT question_id AS questionId, task_id AS taskId, prompt,
          options AS optionsJson, asked_at AS askedAt, answer AS answerJson,
          answered_at AS answeredAt
         FROM task_questions WHERE task_id = ? AND question_id = ?`,
      )
      .get<QuestionRow>(taskId, questionId);
    return row ? questionFromRow(row) : undefined;
  }

  questions(pendingOnly = false): TaskQuestion[] {
    const where = pendingOnly ? 'WHERE answered_at IS NULL' : '';
    const rows = this.database
      .prepare(
        `SELECT question_id AS questionId, task_id AS taskId, prompt,
          options AS optionsJson, asked_at AS askedAt, answer AS answerJson,
          answered_at AS answeredAt
         FROM task_questions ${where} ORDER BY asked_at, question_id`,
      )
      .all<QuestionRow>();
    return rows.map(questionFromRow);
  }

  answerQuestion(taskId: string, questionId: string, answer: unknown, actor: string): TaskQuestion {
    return this.database.transaction(() => {
      const question = this.getQuestion(taskId, questionId);
      if (!question) {
        throw new RpcError(`Question not found: ${questionId}`, RpcErrorCode.QuestionNotFound);
      }
      const answeredAt = this.now().toISOString();
      this.database
        .prepare(
          `UPDATE task_questions SET answer = ?, answered_at = ?
           WHERE task_id = ? AND question_id = ?`,
        )
        .run(JSON.stringify(answer), answeredAt, taskId, questionId);
      this.appendEventUnsafe(taskId, TaskEventKind.Answer, { questionId, answer }, actor);
      return { ...question, answer, answeredAt };
    });
  }

  private insertRow(task: TaskRecord): void {
    this.database
      .prepare(
        `INSERT INTO tasks (
          task_id, schema_version, project_id, parent_task_id, root_task_id, depth,
          kind, title, goal, goal_hash, state, priority, depends_on, assignee, touches_json,
          role, isolation, completion_contract_json, integration_json, budget, spent, attempt,
          max_attempts, lease, input, checkpoint, result, error, created_at, updated_at,
          started_at, finished_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(...taskValues(task));
  }

  private writeRow(task: TaskRecord): void {
    this.database
      .prepare(
        `INSERT INTO tasks (
          task_id, schema_version, project_id, parent_task_id, root_task_id, depth,
          kind, title, goal, goal_hash, state, priority, depends_on, assignee, touches_json,
          role, isolation, completion_contract_json, integration_json, budget, spent, attempt,
          max_attempts, lease, input, checkpoint, result, error, created_at, updated_at,
          started_at, finished_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(task_id) DO UPDATE SET
          schema_version = excluded.schema_version,
          project_id = excluded.project_id,
          parent_task_id = excluded.parent_task_id,
          root_task_id = excluded.root_task_id,
          depth = excluded.depth,
          kind = excluded.kind,
          title = excluded.title,
          goal = excluded.goal,
          goal_hash = excluded.goal_hash,
          state = excluded.state,
          priority = excluded.priority,
          depends_on = excluded.depends_on,
          assignee = excluded.assignee,
          touches_json = excluded.touches_json,
          role = excluded.role,
          isolation = excluded.isolation,
          completion_contract_json = excluded.completion_contract_json,
          integration_json = excluded.integration_json,
          budget = excluded.budget,
          spent = excluded.spent,
          attempt = excluded.attempt,
          max_attempts = excluded.max_attempts,
          lease = excluded.lease,
          input = excluded.input,
          checkpoint = excluded.checkpoint,
          result = excluded.result,
          error = excluded.error,
          created_at = excluded.created_at,
          updated_at = excluded.updated_at,
          started_at = excluded.started_at,
          finished_at = excluded.finished_at`,
      )
      .run(...taskValues(task));
  }

  private appendEventUnsafe(
    taskId: string | null,
    kind: string,
    payload: unknown,
    actor: string,
  ): TaskEvent {
    const event: TaskEvent = {
      eventId: uuidv7(),
      seq:
        this.database
          .prepare('SELECT COALESCE(MAX(seq), 0) + 1 AS seq FROM events')
          .get<{ seq: number }>()?.seq ?? 1,
      taskId,
      kind,
      occurredAt: this.now().toISOString(),
      actor,
      payload,
    };
    this.database
      .prepare(
        `INSERT INTO events (event_id, seq, task_id, kind, occurred_at, actor, payload)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        event.eventId,
        event.seq,
        event.taskId,
        event.kind,
        event.occurredAt,
        event.actor,
        JSON.stringify(event.payload),
      );
    return event;
  }
}

function taskValues(task: TaskRecord): Array<string | number | null> {
  return [
    task.taskId,
    task.schemaVersion,
    task.projectId,
    task.parentTaskId,
    task.rootTaskId,
    task.depth,
    task.kind,
    task.title,
    task.goal,
    task.goalHash,
    task.state,
    task.priority,
    JSON.stringify(task.dependsOn),
    encodeNullable(task.assignee),
    encodeOptionalJson(task.touches),
    task.role ?? null,
    task.isolation ?? null,
    encodeOptionalJson(task.contract),
    encodeOptionalJson(task.integration),
    JSON.stringify(task.budget),
    JSON.stringify(task.spent),
    task.attempt,
    task.maxAttempts,
    encodeNullable(task.lease),
    JSON.stringify(task.input),
    JSON.stringify(task.checkpoint),
    encodeNullable(task.result),
    encodeNullable(task.error),
    task.createdAt,
    task.updatedAt,
    task.startedAt,
    task.finishedAt,
  ];
}

function taskFromRow(row: TaskRow): TaskRecord {
  return {
    schemaVersion: row.schemaVersion as 1,
    taskId: row.taskId,
    projectId: row.projectId,
    parentTaskId: row.parentTaskId,
    rootTaskId: row.rootTaskId,
    depth: row.depth,
    kind: row.kind,
    title: row.title,
    goal: row.goal,
    goalHash: row.goalHash,
    state: row.state,
    priority: row.priority,
    dependsOn: JSON.parse(row.dependsOnJson) as string[],
    assignee: decodeNullable(row.assigneeJson),
    ...(row.touchesJson === null
      ? {}
      : { touches: JSON.parse(row.touchesJson) as TaskRecord['touches'] }),
    ...(row.role === null ? {} : { role: row.role }),
    ...(row.isolation === null ? {} : { isolation: row.isolation }),
    ...(row.completionContractJson === null
      ? {}
      : { contract: JSON.parse(row.completionContractJson) as TaskRecord['contract'] }),
    ...(row.integrationJson === null
      ? {}
      : { integration: JSON.parse(row.integrationJson) as TaskRecord['integration'] }),
    budget: JSON.parse(row.budgetJson) as TaskRecord['budget'],
    spent: JSON.parse(row.spentJson) as TaskRecord['spent'],
    attempt: row.attempt,
    maxAttempts: row.maxAttempts,
    lease: decodeNullable(row.leaseJson),
    input: JSON.parse(row.inputJson) as unknown,
    checkpoint: JSON.parse(row.checkpointJson) as unknown,
    result: decodeNullable(row.resultJson),
    error: decodeNullable(row.errorJson),
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    startedAt: row.startedAt,
    finishedAt: row.finishedAt,
  };
}

function eventFromRow(row: EventRow): TaskEvent {
  return {
    eventId: row.eventId,
    seq: row.seq,
    taskId: row.taskId,
    kind: row.kind,
    occurredAt: row.occurredAt,
    actor: row.actor,
    payload: JSON.parse(row.payloadJson) as unknown,
  };
}

function questionFromRow(row: QuestionRow): TaskQuestion {
  return {
    questionId: row.questionId,
    taskId: row.taskId,
    prompt: row.prompt,
    options: row.optionsJson === null ? null : (JSON.parse(row.optionsJson) as string[]),
    askedAt: row.askedAt,
    answer: JSON.parse(row.answerJson) as unknown,
    answeredAt: row.answeredAt,
  };
}

function encodeOptionalJson(value: unknown): string | null {
  return value === undefined ? null : (JSON.stringify(value) ?? 'null');
}

function encodeNullable(value: unknown): string | null {
  return value === null ? null : (JSON.stringify(value) ?? 'null');
}

function decodeNullable<T>(value: string | null): T | null {
  return value === null ? null : (JSON.parse(value) as T);
}

function taskNotFound(taskId: string): RpcError {
  return new RpcError(`Task not found: ${taskId}`, RpcErrorCode.TaskNotFound);
}

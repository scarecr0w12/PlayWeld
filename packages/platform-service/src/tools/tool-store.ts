import {
  RpcError,
  RpcErrorCode,
  uuidv7,
  compile,
  ToolIdSchema,
  type ApprovalRequest,
  type ToolCallRecord,
} from '@gamecrafter/contracts';
import type { Database } from '../db/database';

export interface ToolCallFilter {
  taskId?: string;
  toolId?: string;
  limit?: number;
}

export type ToolCallPatch = Partial<
  Omit<ToolCallRecord, 'callId' | 'projectId' | 'toolId' | 'input' | 'startedAt'>
>;

interface ToolCallRow {
  callId: string;
  projectId: string;
  taskId: string | null;
  agentId: string | null;
  toolId: string;
  inputJson: string;
  accessMode: ToolCallRecord['accessMode'];
  decision: ToolCallRecord['decision'];
  decisionReason: string;
  status: ToolCallRecord['status'];
  outputJson: string;
  errorJson: string | null;
  evidenceJson: string;
  costUsd: number;
  costStatus: ToolCallRecord['costStatus'] | null;
  startedAt: string;
  finishedAt: string | null;
}

interface ApprovalRow {
  approvalId: string;
  projectId: string;
  callId: string;
  toolId: string;
  sideEffects: ApprovalRequest['sideEffects'];
  summary: string;
  inputJson: string;
  requestedAt: string;
  resolvedAt: string | null;
  approved: number | null;
  reason: string | null;
}

const toolCallColumns = `
  call_id AS callId,
  project_id AS projectId,
  task_id AS taskId,
  agent_id AS agentId,
  tool_id AS toolId,
  input AS inputJson,
  access_mode AS accessMode,
  decision,
  decision_reason AS decisionReason,
  status,
  output AS outputJson,
  error AS errorJson,
  evidence AS evidenceJson,
  cost_usd AS costUsd,
  cost_status AS costStatus,
  started_at AS startedAt,
  finished_at AS finishedAt`;

export class ToolStore {
  constructor(private readonly database: Database) {}

  insertCall(record: ToolCallRecord): void {
    this.database.transaction(() => {
      this.writeCall(record);
    });
  }

  getCall(callId: string): ToolCallRecord | undefined {
    const row = this.database
      .prepare(`SELECT ${toolCallColumns} FROM tool_calls WHERE call_id = ?`)
      .get<ToolCallRow>(callId);
    return row ? callFromRow(row) : undefined;
  }

  updateCall(callId: string, patch: ToolCallPatch): ToolCallRecord {
    const current = this.getCall(callId);
    if (!current) throw new Error(`Tool call not found: ${callId}`);
    const updated = { ...current, ...patch };
    this.database.transaction(() => this.writeCall(updated));
    return updated;
  }

  finalizeCall(record: ToolCallRecord): ToolCallRecord {
    this.database.transaction(() => {
      this.writeCall(record);
      const eventPayload = Object.fromEntries(
        Object.entries(record).filter(([key]) => key !== 'output'),
      );
      const seq =
        this.database
          .prepare('SELECT COALESCE(MAX(seq), 0) + 1 AS seq FROM events')
          .get<{ seq: number }>()?.seq ?? 1;
      this.database
        .prepare(
          `INSERT INTO events (event_id, seq, task_id, kind, occurred_at, actor, payload)
           VALUES (?, ?, ?, 'tool.called', ?, 'tool-broker', ?)`,
        )
        .run(
          uuidv7(),
          seq,
          record.taskId,
          record.finishedAt ?? new Date().toISOString(),
          JSON.stringify(eventPayload),
        );
    });
    return record;
  }

  calls(filter: ToolCallFilter = {}): ToolCallRecord[] {
    const clauses: string[] = [];
    const parameters: (string | number)[] = [];
    if (filter.taskId) {
      clauses.push('task_id = ?');
      parameters.push(filter.taskId);
    }
    if (filter.toolId) {
      clauses.push('tool_id = ?');
      parameters.push(filter.toolId);
    }
    const where = clauses.length > 0 ? `WHERE ${clauses.join(' AND ')}` : '';
    return this.database
      .prepare(
        `SELECT ${toolCallColumns} FROM tool_calls ${where}
         ORDER BY started_at DESC, call_id LIMIT ?`,
      )
      .all<ToolCallRow>(...parameters, filter.limit ?? 200)
      .map(callFromRow);
  }

  pendingCalls(): ToolCallRecord[] {
    return this.database
      .prepare(`SELECT ${toolCallColumns} FROM tool_calls WHERE status = 'pending'`)
      .all<ToolCallRow>()
      .map(callFromRow);
  }

  insertApproval(approval: ApprovalRequest): void {
    this.database
      .prepare(
        `INSERT INTO approvals
          (approval_id, project_id, call_id, tool_id, side_effects, summary, input,
           requested_at, resolved_at, approved, reason)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        approval.approvalId,
        approval.projectId,
        approval.callId,
        approval.toolId,
        approval.sideEffects,
        approval.summary,
        JSON.stringify(approval.input),
        approval.requestedAt,
        approval.resolvedAt,
        approval.approved === null ? null : Number(approval.approved),
        approval.reason,
      );
  }

  getApproval(approvalId: string): ApprovalRequest | undefined {
    const row = this.database
      .prepare(
        `SELECT approval_id AS approvalId, project_id AS projectId, call_id AS callId,
          tool_id AS toolId, side_effects AS sideEffects, summary, input AS inputJson,
          requested_at AS requestedAt, resolved_at AS resolvedAt, approved, reason
         FROM approvals WHERE approval_id = ?`,
      )
      .get<ApprovalRow>(approvalId);
    return row ? approvalFromRow(row) : undefined;
  }

  getApprovalForCall(callId: string): ApprovalRequest | undefined {
    const row = this.database
      .prepare(
        `SELECT approval_id AS approvalId, project_id AS projectId, call_id AS callId,
          tool_id AS toolId, side_effects AS sideEffects, summary, input AS inputJson,
          requested_at AS requestedAt, resolved_at AS resolvedAt, approved, reason
         FROM approvals WHERE call_id = ? ORDER BY requested_at DESC LIMIT 1`,
      )
      .get<ApprovalRow>(callId);
    return row ? approvalFromRow(row) : undefined;
  }

  approvals(pendingOnly = false): ApprovalRequest[] {
    const where = pendingOnly ? 'WHERE resolved_at IS NULL' : '';
    const rows = this.database
      .prepare(
        `SELECT approval_id AS approvalId, project_id AS projectId, call_id AS callId,
          tool_id AS toolId, side_effects AS sideEffects, summary, input AS inputJson,
          requested_at AS requestedAt, resolved_at AS resolvedAt, approved, reason
         FROM approvals ${where} ORDER BY requested_at, approval_id`,
      )
      .all<ApprovalRow>();
    return rows.map(approvalFromRow);
  }

  resolveApproval(
    approvalId: string,
    resolvedAt: string,
    approved: boolean | null,
    reason: string | null,
  ): ApprovalRequest {
    return this.database.transaction(() => {
      const approval = this.getApproval(approvalId);
      if (!approval) {
        throw new RpcError(`Approval not found: ${approvalId}`, RpcErrorCode.ApprovalNotFound);
      }
      if (approval.resolvedAt !== null) {
        throw new RpcError(
          `Approval already resolved: ${approvalId}`,
          RpcErrorCode.ApprovalAlreadyResolved,
        );
      }
      this.database
        .prepare(
          `UPDATE approvals SET resolved_at = ?, approved = ?, reason = ?
           WHERE approval_id = ? AND resolved_at IS NULL`,
        )
        .run(resolvedAt, approved === null ? null : Number(approved), reason, approvalId);
      return { ...approval, resolvedAt, approved, reason };
    });
  }

  private writeCall(record: ToolCallRecord): void {
    this.database
      .prepare(
        `INSERT INTO tool_calls (
          call_id, project_id, task_id, agent_id, tool_id, input, access_mode, decision,
          decision_reason, status, output, error, evidence, cost_usd, cost_status,
          started_at, finished_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(call_id) DO UPDATE SET
          task_id = excluded.task_id,
          agent_id = excluded.agent_id,
          input = excluded.input,
          access_mode = excluded.access_mode,
          decision = excluded.decision,
          decision_reason = excluded.decision_reason,
          status = excluded.status,
          output = excluded.output,
          error = excluded.error,
          evidence = excluded.evidence,
          cost_usd = excluded.cost_usd,
          cost_status = excluded.cost_status,
          finished_at = excluded.finished_at`,
      )
      .run(
        record.callId,
        record.projectId,
        record.taskId,
        record.agentId,
        record.toolId,
        JSON.stringify(record.input),
        record.accessMode,
        record.decision,
        record.decisionReason,
        record.status,
        JSON.stringify(record.output),
        record.error === null ? null : JSON.stringify(record.error),
        JSON.stringify(record.evidence),
        record.costUsd,
        record.costStatus ?? 'unverified',
        record.startedAt,
        record.finishedAt,
      );
  }
}

function callFromRow(row: ToolCallRow): ToolCallRecord {
  return normalizeRecordedCall({
    callId: row.callId,
    projectId: row.projectId,
    taskId: row.taskId,
    agentId: row.agentId,
    toolId: row.toolId,
    input: JSON.parse(row.inputJson) as unknown,
    accessMode: row.accessMode,
    decision: row.decision,
    decisionReason: row.decisionReason,
    status: row.status,
    output: JSON.parse(row.outputJson) as unknown,
    error: row.errorJson === null ? null : JSON.parse(row.errorJson),
    evidence: JSON.parse(row.evidenceJson) as ToolCallRecord['evidence'],
    costUsd: row.costUsd,
    costStatus: row.costStatus ?? 'unverified',
    startedAt: row.startedAt,
    finishedAt: row.finishedAt,
  });
}

const toolIdValidator = compile<string>(ToolIdSchema);

/** Keep malformed model requests auditable without violating the RPC record contract. */
export function normalizeRecordedCall(record: ToolCallRecord): ToolCallRecord {
  const costStatus = record.costStatus ?? 'unverified';
  if (toolIdValidator.check(record.toolId)) return { ...record, costStatus };
  return {
    ...record,
    costStatus,
    toolId: 'broker/invalid-tool',
    input: { requestedToolId: record.toolId, input: record.input },
  };
}

function approvalFromRow(row: ApprovalRow): ApprovalRequest {
  return {
    approvalId: row.approvalId,
    projectId: row.projectId,
    callId: row.callId,
    toolId: row.toolId,
    sideEffects: row.sideEffects,
    summary: row.summary,
    input: JSON.parse(row.inputJson) as unknown,
    requestedAt: row.requestedAt,
    resolvedAt: row.resolvedAt,
    approved: row.approved === null ? null : row.approved === 1,
    reason: row.reason,
  };
}

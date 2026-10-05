import {
  RpcError,
  RpcErrorCode,
  uuidv7,
  type Model,
  type ModelPool,
  type ModelUsageRecord,
  type DecisionAssessment,
  type RouteCandidate,
  type RouteCapability,
  type RouteDecision,
  type RouteOutcome,
  type RouteRequest,
} from '@gamecrafter/contracts';
import type { Database } from '../db/database';
import type { SettingsService } from '../settings/settings-service';
import type { ModelRegistry } from './model-registry';

export const ROUTER_POLICY_VERSION = 'quality-first-v1';

type SettingsReader = Pick<SettingsService, 'resolve'>;

interface RouterOptions {
  database: Database;
  registry: ModelRegistry;
  settings: SettingsReader;
  now?: () => Date;
  random?: () => number;
}

interface OutcomeRow {
  modelId: string;
  taskType: string;
  success: number;
  qualityScore: number | null;
  source: RouteOutcome['source'];
  costUsd: number | null;
  latencyMs: number;
  inputTokens: number;
  outputTokens: number;
}

interface ModelEstimate {
  model: Model;
  qualityEstimate: number;
  observations: number;
  estimatedCostUsd: number | null;
  estimatedLatencyMs: number | null;
  reliability: number;
}

interface ScoredCandidate extends RouteCandidate {
  estimate: ModelEstimate;
}

const sourceWeights: Record<RouteOutcome['source'], number> = {
  validation: 1,
  user: 1,
  reviewer: 0.8,
  self: 0.3,
};

export class ModelRouter {
  private readonly now: () => Date;
  private readonly random: () => number;

  constructor(private readonly options: RouterOptions) {
    this.now = options.now ?? (() => new Date());
    this.random = options.random ?? Math.random;
  }

  preview(request: RouteRequest, sessionId?: string): RouteDecision {
    return this.route(request, sessionId, undefined, true);
  }

  route(
    request: RouteRequest,
    sessionId?: string,
    advice?: { modelId: string; assessmentId: string },
    preview = false,
  ): RouteDecision {
    const enabledModels = this.options.registry.listModels({ enabledOnly: true });
    let eligible = enabledModels;
    if (eligible.length === 0) {
      throw noEligibleModel('enabled-models', ['no enabled models or accounts']);
    }

    const workTypeModels = eligible.filter(
      (model) => model.workTypes.length === 0 || model.workTypes.includes(request.taskType),
    );
    if (workTypeModels.length === 0) {
      throw noEligibleModel('workTypes', ['model workTypes']);
    }
    eligible = workTypeModels;

    const roleModels = eligible.filter(
      (model) =>
        model.roles.length === 0 || (request.agentRole && model.roles.includes(request.agentRole)),
    );
    if (roleModels.length === 0) throw noEligibleModel('roles', ['model roles']);
    eligible = roleModels;

    const required = [
      ...new Set<RouteCapability>(['chat', ...(request.requiredCapabilities ?? [])]),
    ];
    const capabilityModels = eligible.filter((model) =>
      required.every(
        (capability) =>
          isChatRequestCapability(capability) && model.capabilities[capability] === true,
      ),
    );
    if (capabilityModels.length === 0) {
      throw noEligibleModel(
        'capabilities',
        required.map((capability) => `capability:${capability}`),
      );
    }
    eligible = capabilityModels;

    const poolResult = this.filterByPools(request);
    if (poolResult.modelIds !== null) {
      const allowedModelIds = new Set(poolResult.modelIds);
      eligible = eligible.filter((model) => allowedModelIds.has(model.modelId));
      if (eligible.length === 0) {
        throw noEligibleModel('pools', poolResult.removedBy);
      }
    }

    if (request.manualModelId) {
      const manual = eligible.find((model) => model.modelId === request.manualModelId);
      if (!manual) {
        throw noEligibleModel('manual-model', [`manualModelId:${request.manualModelId}`]);
      }
      eligible = [manual];
    }

    const estimates = eligible.map((model) => this.estimate(model, request.taskType));
    const constraints = this.resolveConstraints(request, sessionId);
    const constrained = estimates.filter((estimate) => {
      if (
        constraints.maxCostUsd !== null &&
        estimate.estimatedCostUsd !== null &&
        estimate.estimatedCostUsd > constraints.maxCostUsd
      ) {
        return false;
      }
      if (
        constraints.maxLatencyMs > 0 &&
        estimate.estimatedLatencyMs !== null &&
        estimate.estimatedLatencyMs > constraints.maxLatencyMs
      ) {
        return false;
      }
      return true;
    });
    if (constrained.length === 0) {
      throw noEligibleModel('constraints', [
        ...(constraints.maxCostUsd === null ? [] : [`maxCostUsd:${constraints.maxCostUsd}`]),
        ...(constraints.maxLatencyMs === 0 ? [] : [`maxLatencyMs:${constraints.maxLatencyMs}`]),
      ]);
    }

    const qualityPolicy = String(
      this.options.settings.resolve('models.autoRouting.quality', {
        projectId: request.projectId,
        sessionId,
      }).value,
    );
    const scored = constrained.map((estimate) =>
      this.scoreCandidates(constrained, estimate, qualityPolicy),
    );
    scored.sort(compareCandidates);
    let winner = scored[0]!;
    let explored = false;
    const advised =
      !request.manualModelId && advice
        ? scored.find((candidate) => candidate.modelId === advice.modelId)
        : undefined;
    if (advised) winner = advised;
    if (
      !preview &&
      !request.manualModelId &&
      !advised &&
      this.shouldExplore(request.projectId, sessionId)
    ) {
      const remainingBudget = this.remainingExplorationBudget(request.projectId, sessionId);
      const affordable = scored.filter(
        (candidate) =>
          candidate.estimatedCostUsd !== null && candidate.estimatedCostUsd <= remainingBudget,
      );
      if (affordable.length > 0) {
        const leastObserved = [...affordable].sort(
          (left, right) =>
            left.observations - right.observations || left.modelId.localeCompare(right.modelId),
        )[0]!;
        if (leastObserved.modelId !== winner.modelId) {
          winner = leastObserved;
          explored = true;
        }
      }
    }

    const decidedAt = this.now().toISOString();
    const decision: RouteDecision = {
      decisionId: uuidv7(),
      modelId: winner.modelId,
      reason:
        this.decisionReason(
          winner,
          qualityPolicy,
          request,
          poolResult.noPoolsConfigured,
          explored,
        ) +
        (advised
          ? `; bounded decision advice ${advice!.assessmentId}`
          : advice && !request.manualModelId
            ? '; decision advice ineligible; retained router policy'
            : ''),
      explored,
      policyVersion: advised
        ? `${ROUTER_POLICY_VERSION}+decision-advice-v1`
        : ROUTER_POLICY_VERSION,
      candidates: scored.map(
        ({
          modelId,
          score,
          qualityEstimate,
          observations,
          estimatedCostUsd,
          estimatedLatencyMs,
          reliability,
        }) => ({
          modelId,
          score,
          qualityEstimate,
          observations,
          estimatedCostUsd,
          estimatedLatencyMs,
          reliability,
        }),
      ),
      context: {
        projectId: request.projectId ?? null,
        agentRole: request.agentRole ?? null,
        taskType: request.taskType,
        engine: request.engine ?? null,
      },
      decidedAt,
    };
    if (!preview) this.persistDecision(decision);
    return decision;
  }

  reportOutcome(outcome: RouteOutcome): void {
    const row = this.options.database
      .prepare('SELECT decision FROM route_decisions WHERE decision_id = ?')
      .get<{ decision: string }>(outcome.decisionId);
    if (!row) {
      throw new RpcError(
        `Route decision not found: ${outcome.decisionId}`,
        RpcErrorCode.DecisionNotFound,
      );
    }
    const existing = this.options.database
      .prepare('SELECT decision_id FROM route_outcomes WHERE decision_id = ?')
      .get<{ decision_id: string }>(outcome.decisionId);
    const decision = JSON.parse(row.decision) as RouteDecision;
    const costStatus = outcome.costStatus ?? (outcome.costUsd === null ? 'unknown' : 'known');
    this.options.database.transaction(() => {
      this.options.database
        .prepare(
          `INSERT INTO route_outcomes (
            decision_id, success, quality_score, source, cost_usd, latency_ms,
            input_tokens, output_tokens, note, recorded_at, cost_status,
            cache_read_input_tokens, cache_creation_input_tokens
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          ON CONFLICT(decision_id) DO UPDATE SET
            success = excluded.success,
            quality_score = excluded.quality_score,
            source = excluded.source,
            cost_usd = excluded.cost_usd,
            latency_ms = excluded.latency_ms,
            input_tokens = excluded.input_tokens,
            output_tokens = excluded.output_tokens,
            note = excluded.note,
            recorded_at = excluded.recorded_at,
            cost_status = excluded.cost_status,
            cache_read_input_tokens = excluded.cache_read_input_tokens,
            cache_creation_input_tokens = excluded.cache_creation_input_tokens`,
        )
        .run(
          outcome.decisionId,
          Number(outcome.success),
          outcome.qualityScore,
          outcome.source,
          outcome.costUsd ?? 0,
          outcome.latencyMs,
          outcome.inputTokens,
          outcome.outputTokens,
          outcome.note ?? null,
          this.now().toISOString(),
          costStatus,
          outcome.cacheReadInputTokens ?? 0,
          outcome.cacheCreationInputTokens ?? 0,
        );
      if (!existing && decision.explored && costStatus === 'known' && outcome.costUsd !== null)
        this.addExplorationSpend(outcome.costUsd);
    });
  }

  recordModelUsage(
    record: Extract<ModelUsageRecord, { source: 'completion' }> & { projectId: string | null },
  ): void {
    this.options.database
      .prepare(
        `INSERT INTO model_usage (
          usage_id, request_id, project_id, task_id, decision_id, model_id, occurred_at,
          input_tokens, output_tokens, cache_read_input_tokens,
          cache_creation_input_tokens, cost_usd, cost_status
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        record.usageId,
        record.requestId,
        record.projectId,
        record.taskId,
        record.decisionId,
        record.modelId,
        record.occurredAt,
        record.inputTokens,
        record.outputTokens,
        record.cacheReadInputTokens,
        record.cacheCreationInputTokens,
        record.costUsd ?? 0,
        record.costStatus,
      );
  }

  modelUsage(projectId: string, limit: number): ModelUsageRecord[] {
    const rows = this.options.database
      .prepare(
        `SELECT usage_id AS usageId, request_id AS requestId, project_id AS projectId,
          task_id AS taskId, decision_id AS decisionId, model_id AS modelId,
          occurred_at AS occurredAt, input_tokens AS inputTokens,
          output_tokens AS outputTokens,
          cache_read_input_tokens AS cacheReadInputTokens,
          cache_creation_input_tokens AS cacheCreationInputTokens,
          cost_usd AS storedCostUsd, cost_status AS costStatus
         FROM model_usage WHERE project_id = ?
         ORDER BY occurred_at DESC, usage_id DESC LIMIT ?`,
      )
      .all<{
        usageId: string;
        requestId: string | null;
        projectId: string;
        taskId: string | null;
        decisionId: string | null;
        modelId: string;
        occurredAt: string;
        inputTokens: number;
        outputTokens: number;
        cacheReadInputTokens: number;
        cacheCreationInputTokens: number;
        storedCostUsd: number;
        costStatus: ModelUsageRecord['costStatus'];
      }>(projectId, limit);
    const current = rows.map((row) => ({
      usageId: row.usageId,
      requestId: row.requestId,
      taskId: row.taskId,
      decisionId: row.decisionId,
      modelId: row.modelId,
      ...modelLabels(this.options.registry, row.modelId),
      occurredAt: row.occurredAt,
      source: 'completion' as const,
      inputTokens: row.inputTokens,
      outputTokens: row.outputTokens,
      cacheReadInputTokens: row.cacheReadInputTokens,
      cacheCreationInputTokens: row.cacheCreationInputTokens,
      costUsd: row.costStatus === 'unknown' ? null : row.storedCostUsd,
      costStatus: row.costStatus,
    }));
    const legacy = this.options.database
      .prepare(
        `SELECT d.decision_id AS decisionId, d.model_id AS modelId,
          o.recorded_at AS occurredAt, o.input_tokens AS inputTokens,
          o.output_tokens AS outputTokens
         FROM route_decisions d JOIN route_outcomes o ON o.decision_id = d.decision_id
         WHERE d.project_id = ? AND o.source = 'self'
           AND NOT EXISTS (
             SELECT 1 FROM model_usage u WHERE u.decision_id = d.decision_id
           )
         ORDER BY o.recorded_at DESC, d.decision_id DESC LIMIT ?`,
      )
      .all<{
        decisionId: string;
        modelId: string;
        occurredAt: string;
        inputTokens: number;
        outputTokens: number;
      }>(projectId, limit)
      .map((row) => ({
        usageId: row.decisionId,
        requestId: null,
        taskId: null,
        decisionId: row.decisionId,
        modelId: row.modelId,
        ...modelLabels(this.options.registry, row.modelId),
        occurredAt: row.occurredAt,
        source: 'completion' as const,
        inputTokens: row.inputTokens,
        outputTokens: row.outputTokens,
        cacheReadInputTokens: 0,
        cacheCreationInputTokens: 0,
        costUsd: null,
        costStatus: 'unverified' as const,
      }));
    const decisionUsage: ModelUsageRecord[] = this.options.database
      .prepare(
        'SELECT assessment_json AS assessment FROM decision_assessments WHERE project_id = ? ORDER BY created_at DESC, assessment_id DESC LIMIT ?',
      )
      .all<{ assessment: string }>(projectId, limit)
      .map((row) => JSON.parse(row.assessment) as DecisionAssessment)
      .filter(
        (entry) =>
          entry.status === 'assessed' ||
          entry.reasonCodes.includes('decision-request-failed') ||
          entry.reasonCodes.includes('assessment-cancelled'),
      )
      .map((entry) => ({
        usageId: entry.assessmentId,
        requestId: `decision:${entry.assessmentId}`,
        taskId: entry.taskId,
        decisionId: null,
        modelId: `decision:${entry.requestedModel}`,
        modelName: `Decision: ${entry.returnedModel ?? entry.requestedModel}`,
        providerModelId: entry.returnedModel ?? entry.requestedModel,
        occurredAt: entry.createdAt,
        source: 'decision',
        inputTokens: entry.usage.inputTokens,
        outputTokens: entry.usage.outputTokens,
        cacheReadInputTokens: null,
        cacheCreationInputTokens: null,
        costUsd: entry.usage.costUsd,
        costStatus: entry.usage.costUsd === null ? 'unknown' : 'known',
      }));
    return [...current, ...legacy, ...decisionUsage]
      .sort(
        (left, right) =>
          right.occurredAt.localeCompare(left.occurredAt) ||
          right.usageId.localeCompare(left.usageId),
      )
      .slice(0, limit);
  }

  decisions(
    projectId?: string,
    limit = 200,
  ): { decision: RouteDecision; outcome: RouteOutcome | null }[] {
    const clauses: string[] = [];
    const params: (string | number)[] = [];
    if (projectId) {
      clauses.push('project_id = ?');
      params.push(projectId);
    }
    const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';
    const rows = this.options.database
      .prepare(
        `SELECT d.decision, o.decision_id AS outcomeDecisionId, o.success,
          o.quality_score AS qualityScore, o.source, o.cost_usd AS costUsd,
          o.latency_ms AS latencyMs, o.input_tokens AS inputTokens,
          o.output_tokens AS outputTokens, o.note, o.cost_status AS costStatus,
          o.cache_read_input_tokens AS cacheReadInputTokens,
          o.cache_creation_input_tokens AS cacheCreationInputTokens,
          o.recorded_at AS recordedAt
         FROM route_decisions d LEFT JOIN route_outcomes o ON o.decision_id = d.decision_id
         ${where} ORDER BY d.decided_at DESC LIMIT ?`,
      )
      .all<DecisionOutcomeRow>(...params, limit);
    return rows.map((row) => ({
      decision: JSON.parse(row.decision) as RouteDecision,
      outcome: row.outcomeDecisionId ? outcomeFromRow(row) : null,
    }));
  }

  stats(taskType?: string): ModelRouterStats[] {
    const where = taskType ? 'WHERE d.task_type = ?' : '';
    const rows = this.options.database
      .prepare(
        `SELECT d.model_id AS modelId, ${taskType ? 'd.task_type' : 'NULL'} AS taskType,
          o.success, o.quality_score AS qualityScore, o.source,
          CASE WHEN o.cost_status = 'known' THEN o.cost_usd ELSE NULL END AS costUsd,
          o.latency_ms AS latencyMs
         FROM route_decisions d JOIN route_outcomes o ON o.decision_id = d.decision_id
         ${where}`,
      )
      .all<StatsOutcomeRow>(...(taskType ? [taskType] : []));
    const grouped = new Map<string, StatsOutcomeRow[]>();
    for (const row of rows) {
      const key = `${row.modelId}\n${row.taskType ?? ''}`;
      const group = grouped.get(key) ?? [];
      group.push(row);
      grouped.set(key, group);
    }
    return [...grouped.values()]
      .map((group) => statsFromRows(group[0]!.modelId, group[0]!.taskType, group))
      .sort((left, right) => left.modelId.localeCompare(right.modelId));
  }

  private filterByPools(request: RouteRequest): {
    modelIds: Set<string> | null;
    removedBy: string[];
    noPoolsConfigured: boolean;
  } {
    const pools = this.options.registry
      .listPools(request.projectId)
      .filter(
        (pool) =>
          pool.scope === 'platform' ||
          (request.projectId !== undefined && pool.projectId === request.projectId),
      );
    const agentPools = pools.filter(
      (pool) => pool.target?.kind === 'agent' && pool.target.id === request.agentRole,
    );
    const taskPools = pools.filter(
      (pool) => pool.target?.kind === 'task-type' && pool.target.id === request.taskType,
    );
    const globalPools = pools.filter((pool) => pool.target === null);
    let allowed: Set<string> | null = null;
    let removedBy: string[] = [];
    if (agentPools.length > 0 && taskPools.length > 0) {
      const agentUnion = unionPoolModelIds(agentPools);
      const taskUnion = unionPoolModelIds(taskPools);
      allowed = new Set([...agentUnion].filter((modelId) => taskUnion.has(modelId)));
      removedBy = [...agentPools, ...taskPools].map((pool) => `pool:${pool.poolId}`);
    } else if (agentPools.length > 0) {
      allowed = unionPoolModelIds(agentPools);
      removedBy = agentPools.map((pool) => `pool:${pool.poolId}`);
    } else if (taskPools.length > 0) {
      allowed = unionPoolModelIds(taskPools);
      removedBy = taskPools.map((pool) => `pool:${pool.poolId}`);
    } else if (globalPools.length > 0) {
      allowed = unionPoolModelIds(globalPools);
      removedBy = globalPools.map((pool) => `pool:${pool.poolId}`);
    }
    if (allowed === null) {
      return { modelIds: null, removedBy: [], noPoolsConfigured: true };
    }
    return { modelIds: allowed, removedBy, noPoolsConfigured: false };
  }

  private estimate(model: Model, taskType: string): ModelEstimate {
    const rows = this.outcomesForModel(model.modelId);
    const taskRows = rows.filter((row) => row.taskType === taskType);
    const observations = taskRows.length >= 2 ? taskRows : rows;
    const weights = observations.map((row) => sourceWeights[row.source]);
    let qualitySum = 0.5 * 3;
    let qualityWeight = 3;
    for (let index = 0; index < observations.length; index += 1) {
      const outcome = observations[index]!;
      const score = outcome.qualityScore ?? (outcome.success === 1 ? 0.75 : 0.1);
      const weight = weights[index]!;
      qualitySum += score * weight;
      qualityWeight += weight;
    }
    const successes = observations.reduce((sum, outcome) => sum + outcome.success, 0);
    const observedCost = mean(observations.map((row) => row.costUsd));
    const observedLatency = mean(observations.map((row) => row.latencyMs));
    const pricedCost =
      model.pricing.inputPerMTokUsd !== null && model.pricing.outputPerMTokUsd !== null
        ? (model.pricing.inputPerMTokUsd * 2000 + model.pricing.outputPerMTokUsd * 1000) / 1_000_000
        : null;
    return {
      model,
      qualityEstimate: qualitySum / qualityWeight,
      observations: observations.length,
      estimatedCostUsd: pricedCost ?? observedCost,
      estimatedLatencyMs: observedLatency,
      reliability: (successes + 1) / (observations.length + 2),
    };
  }

  private scoreCandidates(
    candidates: ModelEstimate[],
    estimate: ModelEstimate,
    qualityPolicy: string,
  ): ScoredCandidate {
    const costWeight =
      estimate.estimatedCostUsd === null
        ? 0.5
        : normalizeLow(
            estimate.estimatedCostUsd,
            candidates.map((c) => c.estimatedCostUsd),
          );
    const latencyWeight =
      estimate.estimatedLatencyMs === null
        ? 0.5
        : normalizeLow(
            estimate.estimatedLatencyMs,
            candidates.map((c) => c.estimatedLatencyMs),
          );
    const weights = routingWeights(qualityPolicy);
    const score =
      weights.quality * estimate.qualityEstimate +
      weights.cost * costWeight +
      weights.latency * latencyWeight +
      weights.reliability * estimate.reliability;
    return {
      modelId: estimate.model.modelId,
      score,
      qualityEstimate: estimate.qualityEstimate,
      observations: estimate.observations,
      estimatedCostUsd: estimate.estimatedCostUsd,
      estimatedLatencyMs: estimate.estimatedLatencyMs,
      reliability: estimate.reliability,
      estimate,
    };
  }

  private resolveConstraints(
    request: RouteRequest,
    sessionId?: string,
  ): { maxCostUsd: number | null; maxLatencyMs: number } {
    const maxCostUsd =
      request.constraints?.maxCostUsd ??
      Number(
        this.options.settings.resolve('models.budget.maxCostPerTaskUsd', {
          projectId: request.projectId,
          sessionId,
        }).value,
      );
    const maxLatencyMs =
      request.constraints?.maxLatencyMs ??
      Number(
        this.options.settings.resolve('models.autoRouting.maxLatencyMs', {
          projectId: request.projectId,
          sessionId,
        }).value,
      );
    return {
      maxCostUsd: Number.isFinite(maxCostUsd) ? maxCostUsd : null,
      maxLatencyMs: Number.isFinite(maxLatencyMs) ? maxLatencyMs : 0,
    };
  }

  private shouldExplore(projectId: string | undefined, sessionId?: string): boolean {
    const rate = Number(
      this.options.settings.resolve('models.exploration.rate', { projectId, sessionId }).value,
    );
    if (!(rate > 0) || this.random() >= rate) return false;
    const budget = Number(
      this.options.settings.resolve('models.exploration.budgetUsdPerDay', { projectId, sessionId })
        .value,
    );
    if (this.hasUnpricedExploration()) return false;
    return this.explorationSpend() <= budget;
  }

  private remainingExplorationBudget(projectId?: string, sessionId?: string): number {
    const budget = Number(
      this.options.settings.resolve('models.exploration.budgetUsdPerDay', { projectId, sessionId })
        .value,
    );
    return Math.max(0, budget - this.explorationSpend());
  }

  private hasUnpricedExploration(): boolean {
    const day = this.now().toISOString().slice(0, 10);
    return Boolean(
      this.options.database
        .prepare(
          `SELECT 1 FROM route_decisions d
           JOIN route_outcomes o ON o.decision_id = d.decision_id
           WHERE d.explored = 1 AND substr(o.recorded_at, 1, 10) = ?
             AND (o.cost_status IS NULL OR o.cost_status != 'known')
           LIMIT 1`,
        )
        .get(day),
    );
  }

  private explorationSpend(): number {
    const day = this.now().toISOString().slice(0, 10);
    return (
      this.options.database
        .prepare('SELECT cost_usd AS costUsd FROM exploration_spend WHERE day = ?')
        .get<{ costUsd: number }>(day)?.costUsd ?? 0
    );
  }

  private addExplorationSpend(costUsd: number): void {
    const day = this.now().toISOString().slice(0, 10);
    this.options.database
      .prepare(
        `INSERT INTO exploration_spend(day, cost_usd) VALUES(?, ?)
         ON CONFLICT(day) DO UPDATE SET cost_usd = cost_usd + excluded.cost_usd`,
      )
      .run(day, costUsd);
  }

  private persistDecision(decision: RouteDecision): void {
    const context = decision.context;
    this.options.database
      .prepare(
        `INSERT INTO route_decisions (
          decision_id, decision, project_id, agent_role, task_type, engine,
          model_id, explored, decided_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        decision.decisionId,
        JSON.stringify(decision),
        context.projectId,
        context.agentRole,
        context.taskType,
        context.engine,
        decision.modelId,
        Number(decision.explored),
        decision.decidedAt,
      );
  }

  private outcomesForModel(modelId: string): OutcomeRow[] {
    return this.options.database
      .prepare(
        `SELECT d.model_id AS modelId, d.task_type AS taskType,
          o.success, o.quality_score AS qualityScore, o.source,
          CASE WHEN o.cost_status = 'known' THEN o.cost_usd ELSE NULL END AS costUsd,
          o.latency_ms AS latencyMs, o.input_tokens AS inputTokens,
          o.output_tokens AS outputTokens
         FROM route_decisions d JOIN route_outcomes o ON o.decision_id = d.decision_id
          WHERE d.model_id = ?`,
      )
      .all<OutcomeRow>(modelId);
  }

  private decisionReason(
    winner: ScoredCandidate,
    qualityPolicy: string,
    request: RouteRequest,
    noPoolsConfigured: boolean,
    explored: boolean,
  ): string {
    const reason = `${qualityPolicy} selected ${winner.modelId} with score ${winner.score.toFixed(4)}`;
    return [
      reason,
      request.manualModelId ? 'manual model' : undefined,
      noPoolsConfigured ? 'no_pools_configured' : undefined,
      explored ? 'exploration' : undefined,
    ]
      .filter((value): value is string => value !== undefined)
      .join('; ');
  }
}

export interface ModelRouterStats {
  modelId: string;
  taskType: string | null;
  observations: number;
  successRate: number;
  qualityMean: number | null;
  meanCostUsd: number | null;
  meanLatencyMs: number | null;
}

interface DecisionOutcomeRow {
  decision: string;
  outcomeDecisionId: string | null;
  success: number | null;
  qualityScore: number | null;
  source: RouteOutcome['source'] | null;
  costUsd: number | null;
  costStatus: RouteOutcome['costStatus'] | null;
  latencyMs: number | null;
  inputTokens: number | null;
  outputTokens: number | null;
  cacheReadInputTokens: number | null;
  cacheCreationInputTokens: number | null;
  note: string | null;
  recordedAt: string | null;
}

interface StatsOutcomeRow {
  modelId: string;
  taskType: string | null;
  success: number;
  qualityScore: number | null;
  source: RouteOutcome['source'];
  costUsd: number | null;
  latencyMs: number;
}

function noEligibleModel(stage: string, removedBy: string[]): RpcError {
  return new RpcError(
    'No eligible model satisfies the routing request',
    RpcErrorCode.NoEligibleModel,
    {
      stage,
      removedBy,
    },
  );
}

function isChatRequestCapability(capability: RouteCapability): boolean {
  return capability !== 'vision' && capability !== 'embeddings';
}

function modelLabels(
  registry: ModelRegistry,
  modelId: string,
): { modelName?: string; providerModelId?: string } {
  const model = registry.getModel(modelId);
  return model ? { modelName: model.displayName, providerModelId: model.providerModelId } : {};
}

function unionPoolModelIds(pools: ModelPool[]): Set<string> {
  return new Set(pools.flatMap((pool) => pool.modelIds));
}

function routingWeights(policy: string): {
  quality: number;
  cost: number;
  latency: number;
  reliability: number;
} {
  if (policy === 'balanced') return { quality: 0.4, cost: 0.3, latency: 0.15, reliability: 0.15 };
  if (policy === 'cost-first') return { quality: 0.25, cost: 0.5, latency: 0.1, reliability: 0.15 };
  return { quality: 0.6, cost: 0.15, latency: 0.1, reliability: 0.15 };
}

function normalizeLow(value: number, values: (number | null)[]): number {
  const known = values.filter((item): item is number => item !== null);
  if (known.length === 0) return 0.5;
  const minimum = Math.min(...known);
  const maximum = Math.max(...known);
  return maximum === minimum ? 0.5 : (maximum - value) / (maximum - minimum);
}

function compareCandidates(left: ScoredCandidate, right: ScoredCandidate): number {
  return (
    right.score - left.score ||
    left.observations - right.observations ||
    left.modelId.localeCompare(right.modelId)
  );
}

function mean(values: (number | null)[]): number | null {
  const known = values.filter((value): value is number => value !== null);
  if (known.length === 0) return null;
  return known.reduce((sum, value) => sum + value, 0) / known.length;
}

function outcomeQuality(row: Pick<OutcomeRow, 'success' | 'qualityScore'>): number {
  return row.qualityScore ?? (row.success === 1 ? 0.75 : 0.1);
}

function statsFromRows(
  modelId: string,
  taskType: string | null,
  rows: StatsOutcomeRow[],
): ModelRouterStats {
  const weightedQuality = rows.reduce((sum, row) => {
    const weight = sourceWeights[row.source];
    return sum + outcomeQuality(row) * weight;
  }, 0);
  const totalWeight = rows.reduce((sum, row) => sum + sourceWeights[row.source], 0);
  const successes = rows.reduce((sum, row) => sum + row.success, 0);
  return {
    modelId,
    taskType,
    observations: rows.length,
    successRate: (successes + 1) / (rows.length + 2),
    qualityMean: totalWeight === 0 ? null : weightedQuality / totalWeight,
    meanCostUsd: mean(rows.map((row) => row.costUsd)),
    meanLatencyMs: mean(rows.map((row) => row.latencyMs)),
  };
}

function outcomeFromRow(row: DecisionOutcomeRow): RouteOutcome {
  const costStatus = row.costStatus ?? 'unverified';
  return {
    decisionId: row.outcomeDecisionId!,
    success: row.success === 1,
    qualityScore: row.qualityScore,
    source: row.source!,
    costUsd: costStatus === 'unknown' || costStatus === 'unverified' ? null : row.costUsd!,
    costStatus,
    latencyMs: row.latencyMs!,
    inputTokens: row.inputTokens!,
    outputTokens: row.outputTokens!,
    cacheReadInputTokens: row.cacheReadInputTokens ?? 0,
    cacheCreationInputTokens: row.cacheCreationInputTokens ?? 0,
    ...(row.note === null ? {} : { note: row.note }),
  };
}

import {
  RpcError,
  RpcErrorCode,
  uuidv7,
  type ChatResponse,
  type RpcNotificationParams,
  type RpcParams,
  type RouteOutcome,
  type RouteDecision,
  type RouteRequest,
  type Model,
} from '@gamecrafter/contracts';
import type { ModelRegistry } from './model-registry';
import type { ModelRouter } from './router';

export interface CompletionContext {
  sessionId?: string;
  signal?: AbortSignal;
  notify?: (name: 'model/delta', params: RpcNotificationParams<'model/delta'>) => void;
}

export interface PreparedCompletion {
  decision: RouteDecision;
  model: Model;
}

export class CompletionService {
  constructor(
    private readonly registry: ModelRegistry,
    private readonly router: ModelRouter,
    private readonly now: () => Date = () => new Date(),
  ) {}

  prepare(route: RouteRequest, sessionId?: string): PreparedCompletion {
    const decision = this.router.route(route, sessionId);
    const model = this.registry.getModel(decision.modelId);
    if (!model || !model.enabled)
      throw new RpcError(`Model not found: ${decision.modelId}`, RpcErrorCode.ModelNotFound);
    return { decision, model };
  }

  async complete(
    params: RpcParams<'model/complete'>,
    context: CompletionContext = {},
    prepared?: PreparedCompletion,
  ): Promise<ChatResponse> {
    const route =
      prepared?.decision ??
      ('route' in params
        ? this.router.route(
            { ...params.route, projectId: params.route.projectId ?? params.projectId },
            context.sessionId,
          )
        : undefined);
    const modelId = route?.modelId ?? ('modelId' in params ? params.modelId : undefined);
    if (!modelId) throw new RpcError('A modelId or route is required', RpcErrorCode.InvalidParams);
    const model = prepared?.model ?? this.registry.getModel(modelId);
    if (!model || !model.enabled)
      throw new RpcError(`Model not found: ${modelId}`, RpcErrorCode.ModelNotFound);
    const account = this.registry.getRuntimeAccount(model.accountId);
    if (!account || !account.enabled) {
      throw new RpcError(
        `Provider account not found: ${model.accountId}`,
        RpcErrorCode.AccountNotFound,
      );
    }
    const provider = this.registry.getProvider(account.providerKind);
    // Streaming is a delivery preference. Callers that require it can also declare
    // the streaming routing capability; otherwise return a complete response for
    // models whose discovery metadata does not advertise streaming support.
    const request = {
      ...params.request,
      stream: !!params.request.stream && model.capabilities.streaming,
    };
    const requestId = request.stream ? (params.requestId ?? uuidv7()) : params.requestId;
    const startedAt = this.now().getTime();
    try {
      const response = await provider.complete(account, model, request, {
        signal: context.signal ?? new AbortController().signal,
        ...(request.stream && context.notify
          ? {
              onDelta: (delta: string) => {
                context.notify?.('model/delta', { requestId: requestId ?? uuidv7(), delta });
              },
            }
          : {}),
      });
      const result: ChatResponse = { ...response, decisionId: route?.decisionId ?? null };
      if (route) this.reportSelfOutcome(route.decisionId, result, true, undefined);
      return result;
    } catch (error) {
      if (route) {
        this.router.reportOutcome({
          decisionId: route.decisionId,
          success: false,
          qualityScore: null,
          source: 'self',
          costUsd: 0,
          latencyMs: Math.max(0, this.now().getTime() - startedAt),
          inputTokens: 0,
          outputTokens: 0,
          note: error instanceof Error ? error.message : String(error),
        });
      }
      throw error;
    }
  }

  async embed(
    modelId: string,
    inputs: string[],
  ): Promise<{ vectors: number[][]; usage: ChatResponse['usage'] }> {
    const model = this.registry.getModel(modelId);
    if (!model || !model.enabled)
      throw new RpcError(`Model not found: ${modelId}`, RpcErrorCode.ModelNotFound);
    const account = this.registry.getRuntimeAccount(model.accountId);
    if (!account || !account.enabled) {
      throw new RpcError(
        `Provider account not found: ${model.accountId}`,
        RpcErrorCode.AccountNotFound,
      );
    }
    return this.registry.getProvider(account.providerKind).embed(account, model, inputs);
  }

  private reportSelfOutcome(
    decisionId: string,
    response: ChatResponse,
    success: boolean,
    note: string | undefined,
  ): void {
    const outcome: RouteOutcome = {
      decisionId,
      success,
      qualityScore: null,
      source: 'self',
      costUsd: response.usage.costUsd ?? 0,
      latencyMs: response.latencyMs,
      inputTokens: response.usage.inputTokens,
      outputTokens: response.usage.outputTokens,
      ...(note === undefined ? {} : { note }),
    };
    this.router.reportOutcome(outcome);
  }
}

import { type AssetJobRequest, type AssetProviderCapabilities } from '@gamecrafter/contracts';
import {
  assetProviderJson,
  assetProviderUrl,
  isRecord,
  numberValue,
  safeProviderText,
  type AssetProviderAdapter,
  type ProviderContext,
  type ProviderTaskOutput,
  type ProviderTaskState,
} from './provider';

const capabilities: AssetProviderCapabilities = {
  providerKind: 'meshy',
  jobKinds: ['text-to-3d', 'image-to-3d', 'refine'],
  outputFormats: ['glb', 'fbx', 'obj', 'usdz', 'stl', '3mf'],
  supportsCancel: false,
  supportsBalance: true,
};

export class MeshyProvider implements AssetProviderAdapter {
  readonly kind = 'meshy' as const;

  capabilities(): AssetProviderCapabilities {
    return capabilities;
  }

  defaultBaseUrl(): string {
    return 'https://api.meshy.ai';
  }

  termsUrl(): string {
    return 'https://help.meshy.ai/en/articles/16102098-can-i-use-meshy-assets-commercially';
  }

  async submit(
    context: ProviderContext,
    request: AssetJobRequest,
    imageDataUrl?: string,
  ): Promise<{ providerTaskId: string }> {
    const options = { ...(request.providerOptions ?? {}) };
    const sourceProviderTaskId = options.sourceProviderTaskId;
    delete options.sourceProviderTaskId;
    const body: Record<string, unknown> = {
      ...options,
      target_formats: [request.outputFormat],
    };
    let suffix: string;
    let prefix: string;
    if (request.kind === 'image-to-3d') {
      if (!imageDataUrl) throw new Error('Image-to-3D requires image data');
      suffix = 'openapi/v1/image-to-3d';
      prefix = 'image';
      body.image_url = imageDataUrl;
      if (request.prompt) body.prompt = request.prompt;
      if (request.negativePrompt) {
        // unverified against live API: negative_prompt is endpoint-specific.
        body.negative_prompt = request.negativePrompt;
      }
    } else {
      suffix = 'openapi/v2/text-to-3d';
      prefix = 'text';
      body.mode = request.kind === 'refine' ? 'refine' : 'preview';
      if (request.prompt) body.prompt = request.prompt;
      if (request.negativePrompt) {
        // unverified against live API: negative_prompt is endpoint-specific.
        body.negative_prompt = request.negativePrompt;
      }
      if (request.kind === 'refine') {
        if (typeof sourceProviderTaskId !== 'string' || !sourceProviderTaskId) {
          throw new Error('Refine requires the source provider task ID');
        }
        body.preview_task_id = sourceProviderTaskId.replace(/^text:/, '');
      }
    }
    const { data } = await assetProviderJson<unknown>(
      context,
      assetProviderUrl(context.baseUrl, suffix),
      { method: 'POST', body: JSON.stringify(body) },
    );
    const record = isRecord(data) ? data : {};
    const result = isRecord(record.result) ? record.result : record;
    const taskId =
      typeof record.result === 'string'
        ? record.result
        : typeof result.id === 'string'
          ? result.id
          : null;
    if (!taskId) throw new Error('Meshy response did not include a task ID');
    return { providerTaskId: `${prefix}:${taskId}` };
  }

  async poll(context: ProviderContext, providerTaskId: string): Promise<ProviderTaskState> {
    const imageTask = providerTaskId.startsWith('image:');
    const taskId = providerTaskId.replace(/^(?:image|text):/, '');
    const endpoint = imageTask ? 'openapi/v1/image-to-3d' : 'openapi/v2/text-to-3d';
    const { data, response } = await assetProviderJson<unknown>(
      context,
      assetProviderUrl(context.baseUrl, `${endpoint}/${encodeURIComponent(taskId)}`),
    );
    const record = isRecord(data) ? data : {};
    const state = isRecord(record.result) ? record.result : record;
    const taskError = state.task_error ?? state.error;
    const errorMessage = safeProviderText(
      isRecord(taskError) ? taskError.message : taskError,
      context.apiKey,
    );
    const status = typeof state.status === 'string' ? state.status.toUpperCase() : '';
    const outputs = meshyOutputs(state);
    const normalized: ProviderTaskState['status'] =
      status === 'SUCCEEDED' || status === 'SUCCESS'
        ? 'succeeded'
        : status === 'FAILED'
          ? 'failed'
          : status === 'CANCELED' || status === 'CANCELLED'
            ? 'cancelled'
            : status === 'EXPIRED'
              ? 'expired'
              : status === 'PENDING' || status === 'QUEUED'
                ? 'queued'
                : 'running';
    const retryAfter = response.headers.get('retry-after');
    const retryAfterMs =
      retryAfter && Number.isFinite(Number(retryAfter))
        ? Math.min(60_000, Math.max(0, Number(retryAfter) * 1000))
        : undefined;
    return {
      status: normalized,
      progress: Math.max(0, Math.min(100, Math.round(numberValue(state.progress)))),
      outputs,
      creditsConsumed: numericOrNull(
        state.consumed_credits ?? state.credit_usage ?? state.credits_consumed,
      ),
      error: errorMessage || null,
      ...(retryAfterMs === undefined ? {} : { retryAfterMs }),
    };
  }

  async test(context: ProviderContext): Promise<number | null> {
    return this.balance(context);
  }

  async balance(context: ProviderContext): Promise<number | null> {
    const { data } = await assetProviderJson<unknown>(
      context,
      assetProviderUrl(context.baseUrl, 'openapi/v1/balance'),
    );
    return isRecord(data) ? numericOrNull(data.balance) : null;
  }
}

function meshyOutputs(record: Record<string, unknown>): ProviderTaskOutput[] {
  const outputs: ProviderTaskOutput[] = [];
  if (isRecord(record.model_urls)) {
    for (const [format, value] of Object.entries(record.model_urls)) {
      const url = typeof value === 'string' ? value : isRecord(value) ? value.url : undefined;
      if (typeof url === 'string')
        outputs.push({ url, kind: 'model', format: format.toLowerCase() });
    }
  }
  if (typeof record.thumbnail_url === 'string') {
    outputs.push({
      url: record.thumbnail_url,
      kind: 'thumbnail',
      format: imageFormat(record.thumbnail_url),
    });
  }
  return outputs;
}

function numericOrNull(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : null;
}

function imageFormat(url: string): string {
  try {
    const extension = new URL(url).pathname.split('.').pop()?.toLowerCase();
    return extension && /^[a-z0-9]+$/.test(extension) ? extension : 'png';
  } catch {
    return 'png';
  }
}

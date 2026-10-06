import { existsSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import {
  RpcError,
  RpcErrorCode,
  type DccOperation,
  type EngineRunArtifact,
} from '@gamecrafter/contracts';
import { projectRelativePath } from '../../assets/path-utils';
import { BaseDccAdapter } from './base';
import type { DccCandidateSpec } from './common';
import type { DccExecutionContext, DccOperationOutcome } from '../types';
import {
  blenderDiscoverScript,
  blenderExportOperation,
  blenderExportScript,
  blenderImportOperation,
  blenderImportScript,
  blenderInspectScript,
  blenderRenderScript,
  blenderValidateScript,
} from '../scripts/blender';

const candidateSpec: DccCandidateSpec = {
  tool: 'blender',
  names: [
    { name: 'blender', kind: 'gui' },
    { name: 'blender.exe', kind: 'gui' },
  ],
};
const implementedOperations: readonly DccOperation[] = [
  'discover',
  'inspect',
  'import',
  'export',
  'convert',
  'render-preview',
  'run-script',
  'validate',
];

export class BlenderAdapter extends BaseDccAdapter {
  readonly tool = 'blender' as const;
  protected readonly candidateSpec = candidateSpec;
  protected readonly implementedOperations = implementedOperations;

  protected versionArgs(): string[] {
    return ['--background', '--version'];
  }

  async run(
    operation: DccOperation,
    params: Record<string, unknown>,
    context: DccExecutionContext,
  ): Promise<DccOperationOutcome> {
    switch (operation) {
      case 'discover':
        return this.runScriptCommand(
          context,
          ['--background', '--python-expr', blenderDiscoverScript()],
          'Blender installation discovered.',
          extractJsonMarker,
        );
      case 'inspect':
        return this.inspect(params, context);
      case 'import':
        return this.importAsset(params, context);
      case 'export':
        return this.exportAsset(params, context);
      case 'convert':
        return this.convertAsset(params, context);
      case 'render-preview':
        return this.renderPreview(params, context);
      case 'run-script':
        return this.runUserScript(params, context);
      case 'validate':
        return this.validate(params, context);
    }
  }

  private async inspect(
    params: Record<string, unknown>,
    context: DccExecutionContext,
  ): Promise<DccOperationOutcome> {
    const filePath = context.resolveInput(requiredString(params, 'file'));
    const outputPath = path.join(context.runDirectory, 'inspection.json');
    const script = blenderInspectScript(await context.toHostPath(outputPath));
    const outcome = await this.runScriptCommand(
      context,
      ['--background', await context.toHostPath(filePath), '--python-expr', script],
      `Inspected ${path.basename(filePath)} with Blender.`,
      extractJsonMarker,
    );
    if (outcome.status !== 'succeeded') return outcome;
    const artifacts = [...outcome.artifacts];
    if (existsSync(outputPath)) artifacts.push(projectArtifact(context, 'report', outputPath));
    return { ...outcome, artifacts };
  }

  private async importAsset(
    params: Record<string, unknown>,
    context: DccExecutionContext,
  ): Promise<DccOperationOutcome> {
    const inputPath = context.resolveInput(requiredString(params, 'file'));
    const format = stringParam(params, 'format') ?? path.extname(inputPath).slice(1);
    const outputPath = path.join(context.runDirectory, 'imported.blend');
    const script = blenderImportScript(
      await context.toHostPath(inputPath),
      format,
      await context.toHostPath(outputPath),
    );
    const outcome = await this.runScriptCommand(
      context,
      ['--background', '--python-expr', script],
      `Imported ${path.basename(inputPath)} into a Blender scene.`,
      extractJsonMarker,
    );
    return requireOutput(outcome, outputPath, context, 'build');
  }

  private async exportAsset(
    params: Record<string, unknown>,
    context: DccExecutionContext,
  ): Promise<DccOperationOutcome> {
    const inputPath = context.resolveInput(requiredString(params, 'file'));
    const format = requiredString(params, 'format');
    const outputPath = resolveOutput(params, context, `dcc-export.${format}`);
    const script = blenderExportScript(await context.toHostPath(outputPath), format);
    const outcome = await this.runScriptCommand(
      context,
      ['--background', await context.toHostPath(inputPath), '--python-expr', script],
      `Exported ${path.basename(inputPath)} as ${format.toUpperCase()}.`,
      extractJsonMarker,
    );
    return requireOutput(outcome, outputPath, context, 'export');
  }

  private async convertAsset(
    params: Record<string, unknown>,
    context: DccExecutionContext,
  ): Promise<DccOperationOutcome> {
    const inputPath = context.resolveInput(requiredString(params, 'input'));
    const outputPath = resolveOutput(
      params,
      context,
      `dcc-converted${path.extname(inputPath) || '.glb'}`,
    );
    const outputFormat = stringParam(params, 'format') ?? path.extname(outputPath).slice(1);
    const inputFormat = path.extname(inputPath).slice(1);
    const importScript = blenderImportOperation(inputFormat, await context.toHostPath(inputPath));
    const exportScript = blenderExportOperation(outputFormat, await context.toHostPath(outputPath));
    const script = `import bpy, json\nbpy.ops.wm.read_factory_settings(use_empty=True)\n${importScript}\n${exportScript}\nprint('GCDCC_JSON:' + json.dumps({'input': ${JSON.stringify(inputPath)}, 'output': ${JSON.stringify(outputPath)}}))`;
    const outcome = await this.runScriptCommand(
      context,
      ['--background', '--python-expr', script],
      `Converted ${path.basename(inputPath)} to ${outputFormat.toUpperCase()}.`,
      extractJsonMarker,
    );
    return requireOutput(outcome, outputPath, context, 'export');
  }

  private async renderPreview(
    params: Record<string, unknown>,
    context: DccExecutionContext,
  ): Promise<DccOperationOutcome> {
    const inputPath = context.resolveInput(requiredString(params, 'file'));
    const outputPath = resolveOutput(params, context, 'preview.png');
    const resolution = integerParam(
      params,
      'resolution',
      integerParam(params, 'renderPreviewResolution', 512),
    );
    const samples = integerParam(params, 'samples', 16);
    const script = blenderRenderScript(await context.toHostPath(outputPath), resolution, samples);
    const outcome = await this.runScriptCommand(
      context,
      ['--background', await context.toHostPath(inputPath), '--python-expr', script],
      `Rendered a ${resolution}×${resolution} Blender preview.`,
      extractJsonMarker,
    );
    return requireOutput(outcome, outputPath, context, 'screenshot');
  }

  private async runUserScript(
    params: Record<string, unknown>,
    context: DccExecutionContext,
  ): Promise<DccOperationOutcome> {
    const script = requiredString(params, 'script');
    const scriptPath = path.join(context.runDirectory, 'user-script.py');
    const scriptArtifact = context.writeArtifact('report', 'user-script.py', script);
    const outcome = await this.runScriptCommand(
      context,
      ['--background', '--python', await context.toHostPath(scriptPath)],
      'Blender script completed.',
      extractJsonMarker,
    );
    return { ...outcome, artifacts: [...outcome.artifacts, scriptArtifact] };
  }

  private async validate(
    params: Record<string, unknown>,
    context: DccExecutionContext,
  ): Promise<DccOperationOutcome> {
    const inputPath = context.resolveInput(requiredString(params, 'file'));
    const outputPath = path.join(context.runDirectory, 'validation.json');
    const script = blenderValidateScript(await context.toHostPath(outputPath));
    const outcome = await this.runScriptCommand(
      context,
      ['--background', await context.toHostPath(inputPath), '--python-expr', script],
      `Validated ${path.basename(inputPath)} with Blender.`,
      extractJsonMarker,
    );
    if (outcome.status !== 'succeeded') return outcome;
    if (existsSync(outputPath))
      return {
        ...outcome,
        artifacts: [...outcome.artifacts, projectArtifact(context, 'report', outputPath)],
      };
    return outcome;
  }

  private async runScriptCommand(
    context: DccExecutionContext,
    args: string[],
    summary: string,
    parseOutput?: (stdout: string) => Record<string, unknown> | undefined,
  ): Promise<DccOperationOutcome> {
    const result = await context.runProcess(
      context.installation.executable,
      ['--python-exit-code', '1', ...args],
      context.projectPath,
    );
    const success = result.exitCode === 0 && !result.timedOut && !result.cancelled;
    const detail = parseOutput?.(result.stdout);
    const version = typeof detail?.version === 'string' ? detail.version : undefined;
    const successSummary = version ? `${summary.replace(/\.$/, '')}: ${version}.` : summary;
    return {
      status: success ? 'succeeded' : 'failed',
      exitCode: result.exitCode,
      command: result.command,
      summary: success ? successSummary : `${summary} Exit code ${result.exitCode ?? 'unknown'}.`,
      evidence: [
        {
          kind: 'process',
          ref: 'blender',
          detail: result.timedOut
            ? 'Process timed out.'
            : result.cancelled
              ? 'Process was cancelled.'
              : `Process exited with code ${result.exitCode ?? 'unknown'}.`,
        },
        ...(detail ? [{ kind: 'report', ref: 'stdout', detail: JSON.stringify(detail) }] : []),
      ],
      artifacts: result.artifacts,
    };
  }
}

function requiredString(params: Record<string, unknown>, key: string): string {
  const value = params[key];
  if (typeof value !== 'string' || value.length === 0) {
    throw new RpcError(
      `DCC parameter ${key} must be a non-empty string.`,
      RpcErrorCode.InvalidParams,
    );
  }
  return value;
}

function stringParam(params: Record<string, unknown>, key: string): string | undefined {
  return typeof params[key] === 'string' && params[key] ? (params[key] as string) : undefined;
}

function integerParam(params: Record<string, unknown>, key: string, fallback: number): number {
  const value = params[key];
  return typeof value === 'number' && Number.isInteger(value) && value >= 1 ? value : fallback;
}

function resolveOutput(
  params: Record<string, unknown>,
  context: DccExecutionContext,
  defaultPath: string,
): string {
  const output =
    stringParam(params, 'output') ??
    path.posix.join('.gamecrafter', 'dcc-runs', context.runId, defaultPath);
  const resolved = context.resolveOutput(output);
  mkdirSync(path.dirname(resolved), { recursive: true });
  return resolved;
}

function requireOutput(
  outcome: DccOperationOutcome,
  outputPath: string,
  context: DccExecutionContext,
  kind: EngineRunArtifact['kind'],
): DccOperationOutcome {
  if (outcome.status !== 'succeeded') return outcome;
  if (!existsSync(outputPath)) {
    return {
      ...outcome,
      status: 'failed',
      exitCode: outcome.exitCode ?? 1,
      summary: `Blender completed but did not create ${projectRelativePath(context.projectPath, outputPath)}.`,
      evidence: [
        ...outcome.evidence,
        { kind: 'output', ref: outputPath, detail: 'Expected output file was missing.' },
      ],
    };
  }
  return {
    ...outcome,
    artifacts: [...outcome.artifacts, projectArtifact(context, kind, outputPath)],
  };
}

function projectArtifact(
  context: DccExecutionContext,
  kind: EngineRunArtifact['kind'],
  filePath: string,
): EngineRunArtifact {
  return { kind, path: projectRelativePath(context.projectPath, filePath) };
}

function extractJsonMarker(stdout: string): Record<string, unknown> | undefined {
  const line = stdout.split(/\r?\n/).find((entry) => entry.startsWith('GCDCC_JSON:'));
  if (!line) return undefined;
  try {
    const value: unknown = JSON.parse(line.slice('GCDCC_JSON:'.length));
    return typeof value === 'object' && value !== null && !Array.isArray(value)
      ? (value as Record<string, unknown>)
      : undefined;
  } catch {
    return undefined;
  }
}

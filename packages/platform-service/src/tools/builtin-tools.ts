import { execFile } from 'node:child_process';
import {
  lstatSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  realpathSync,
  rmSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import path from 'node:path';
import { promisify } from 'node:util';
import {
  PROJECT_MANIFEST_FILENAME,
  ProjectManifestSchema,
  projectManifest,
  RpcError,
  RpcErrorCode,
  type ToolDefinition,
} from '@gamecrafter/contracts';
import { ToolRegistry } from './tool-registry';

const execFileAsync = promisify(execFile);
const maxOutputBytes = 1024 * 1024;

export interface BuiltinToolOptions {
  readOnlyRoots?: (projectId: string) => string[];
}

export function registerBuiltinTools(
  registry: ToolRegistry,
  options: BuiltinToolOptions = {},
): void {
  registry.register(
    definition(
      'fs/read-file',
      'Read Project file',
      'Read a UTF-8 file in the Project.',
      {
        type: 'object',
        properties: { path: { type: 'string' } },
        required: ['path'],
        additionalProperties: false,
      },
      {
        type: 'object',
        properties: {
          content: { type: 'string' },
          encoding: { const: 'utf8' },
          bytes: { type: 'integer', minimum: 0 },
        },
        required: ['content', 'encoding', 'bytes'],
        additionalProperties: false,
      },
      'project-file',
      'none',
      'Reads a UTF-8 Project file and reports its byte size.',
      ['fs.read:project'],
    ),
    async (context, input) => {
      const requestedPath = String(asRecord(input).path);
      const resolved = resolveReadablePath(
        context.projectPath,
        requestedPath,
        options.readOnlyRoots?.(context.projectId) ?? [],
      );
      const content = readFileSync(resolved.path, 'utf8');
      return {
        output: { content, encoding: 'utf8', bytes: Buffer.byteLength(content, 'utf8') },
        evidence: [{ kind: 'file', ref: resolved.referencePath }],
      };
    },
  );

  registry.register(
    definition(
      'fs/write-file',
      'Write Project file',
      'Write UTF-8 content to a file in the Project. Set createDirectories to true when the parent directory may not exist.',
      {
        type: 'object',
        properties: {
          path: { type: 'string' },
          content: { type: 'string' },
          createDirectories: { type: 'boolean' },
        },
        required: ['path', 'content'],
        additionalProperties: false,
      },
      {
        type: 'object',
        properties: { bytes: { type: 'integer', minimum: 0 } },
        required: ['bytes'],
        additionalProperties: false,
      },
      'project-file',
      'workspace-write',
      'Writes a UTF-8 file under the Project directory.',
      ['fs.write:project'],
    ),
    async (context, input) => {
      const args = asRecord(input);
      const filePath = resolveProjectPath(context.projectPath, String(args.path), true);
      if (args.createDirectories === true) mkdirSync(path.dirname(filePath), { recursive: true });
      resolveProjectPath(context.projectPath, String(args.path), true);
      const content = String(args.content);
      writeFileSync(filePath, content, 'utf8');
      return {
        output: { bytes: Buffer.byteLength(content, 'utf8') },
        evidence: [{ kind: 'file', ref: projectRelativePath(context.projectPath, filePath) }],
      };
    },
  );

  registry.register(
    definition(
      'fs/list',
      'List Project files',
      'List a bounded page of Project files. Use nextOffset with the same path/options for subsequent pages. Recursive listings skip generated/cache trees unless includeGenerated is true.',
      {
        type: 'object',
        properties: {
          path: { type: 'string' },
          recursive: { type: 'boolean' },
          limit: { type: 'integer', minimum: 1, maximum: 200 },
          offset: { type: 'integer', minimum: 0, maximum: 100000 },
          includeGenerated: { type: 'boolean' },
        },
        additionalProperties: false,
      },
      {
        type: 'object',
        properties: {
          entries: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                path: { type: 'string' },
                type: { enum: ['file', 'directory', 'symlink'] },
                size: { type: 'integer', minimum: 0 },
              },
              required: ['path', 'type', 'size'],
              additionalProperties: false,
            },
          },
          truncated: { type: 'boolean' },
          nextOffset: { anyOf: [{ type: 'integer', minimum: 0 }, { type: 'null' }] },
        },
        required: ['entries', 'truncated', 'nextOffset'],
        additionalProperties: false,
      },
      'project-file',
      'none',
      'Lists Project files without following symbolic links.',
      ['fs.list:project'],
    ),
    async (context, input) => {
      const args = asRecord(input);
      const resolved = resolveReadablePath(
        context.projectPath,
        String(args.path ?? '.'),
        options.readOnlyRoots?.(context.projectId) ?? [],
      );
      const directory = resolved.path;
      const limit = typeof args.limit === 'number' ? args.limit : 100;
      const offset = typeof args.offset === 'number' ? args.offset : 0;
      const generated = new Set([
        '.git',
        '.gamecrafter',
        'node_modules',
        'intermediate',
        'saved',
        'deriveddatacache',
        'binaries',
      ]);
      const entries: { path: string; type: 'file' | 'directory' | 'symlink'; size: number }[] = [];
      let seen = 0;
      let characters = 0;
      let truncated = false;
      const visit = (currentPath: string): void => {
        for (const entry of readdirSync(currentPath, { withFileTypes: true }).sort((left, right) =>
          left.name.localeCompare(right.name),
        )) {
          const entryPath = path.join(currentPath, entry.name);
          const stats = lstatSync(entryPath);
          const type = entry.isSymbolicLink()
            ? 'symlink'
            : entry.isDirectory()
              ? 'directory'
              : 'file';
          const item: (typeof entries)[number] = {
            path: joinReference(resolved.referencePath, path.relative(directory, entryPath)),
            type,
            size: stats.size,
          };
          if (seen++ >= offset) {
            const itemCharacters = JSON.stringify(item).length;
            if (
              entries.length >= limit ||
              (entries.length > 0 && characters + itemCharacters > 12000)
            ) {
              truncated = true;
              return;
            }
            entries.push(item);
            characters += itemCharacters;
          }
          if (
            args.recursive === true &&
            entry.isDirectory() &&
            !entry.isSymbolicLink() &&
            (args.includeGenerated === true || !generated.has(entry.name.toLowerCase()))
          ) {
            visit(entryPath);
            if (truncated) return;
          }
        }
      };
      visit(directory);
      return {
        output: { entries, truncated, nextOffset: truncated ? offset + entries.length : null },
        evidence: [{ kind: 'directory', ref: resolved.referencePath }],
      };
    },
  );

  registry.register(
    definition(
      'fs/delete',
      'Delete Project file',
      'Delete a file or directory under the Project. Git-managed data cannot be deleted here.',
      {
        type: 'object',
        properties: { path: { type: 'string' } },
        required: ['path'],
        additionalProperties: false,
      },
      {
        type: 'object',
        properties: { deleted: { type: 'boolean' } },
        required: ['deleted'],
        additionalProperties: false,
      },
      'project-file',
      'destructive',
      'Deletes a Project file or directory recursively.',
      ['fs.delete:project'],
    ),
    async (context, input) => {
      const filePath = resolveProjectPath(
        context.projectPath,
        String(asRecord(input).path),
        true,
        true,
      );
      if (projectRelativePath(context.projectPath, filePath) === '.') {
        throw pathOutsideProject('The Project root cannot be deleted.');
      }
      rmSync(filePath, { recursive: true, force: false });
      return {
        output: { deleted: true },
        evidence: [{ kind: 'file', ref: projectRelativePath(context.projectPath, filePath) }],
      };
    },
  );

  registry.register(
    definition(
      'process/run',
      'Run Project process',
      'Run a headless process with a working directory inside the Project.',
      {
        type: 'object',
        properties: {
          command: { type: 'string', minLength: 1 },
          args: { type: 'array', items: { type: 'string' } },
          cwd: { type: 'string' },
          timeoutMs: { type: 'integer', minimum: 1, default: 60000 },
        },
        required: ['command'],
        additionalProperties: false,
      },
      {
        type: 'object',
        properties: {
          exitCode: { type: 'integer' },
          stdout: { type: 'string' },
          stderr: { type: 'string' },
          durationMs: { type: 'number', minimum: 0 },
        },
        required: ['exitCode', 'stdout', 'stderr', 'durationMs'],
        additionalProperties: false,
      },
      'headless-process',
      'destructive',
      'Runs a process and records exit status and output byte counts.',
      ['process.spawn'],
    ),
    async (context, input) => {
      const args = asRecord(input);
      const cwd = resolveProjectPath(context.projectPath, String(args.cwd ?? '.'));
      if (!statSync(cwd).isDirectory()) throw new Error('Process cwd must be a Project directory.');
      const started = Date.now();
      const timeoutMs = Number(args.timeoutMs ?? 60_000);
      const command = String(args.command);
      const commandArgs = Array.isArray(args.args) ? args.args.map(String) : [];
      let exitCode = 0;
      let stdout = '';
      let stderr = '';
      try {
        ({ stdout, stderr } = await execFileAsync(command, commandArgs, {
          cwd,
          encoding: 'utf8',
          maxBuffer: maxOutputBytes,
          timeout: timeoutMs,
          signal: context.signal,
        }));
      } catch (error) {
        const processError = error as NodeJS.ErrnoException & {
          stdout?: string;
          stderr?: string;
          killed?: boolean;
        };
        if (typeof processError.code !== 'number' || processError.killed) throw error;
        exitCode = processError.code;
        stdout = processError.stdout ?? '';
        stderr = processError.stderr ?? '';
      }
      const output = {
        exitCode,
        stdout: capOutput(stdout),
        stderr: capOutput(stderr),
        durationMs: Date.now() - started,
      };
      return {
        output,
        evidence: [
          {
            kind: 'process',
            ref: JSON.stringify({
              exitCode,
              stdoutBytes: Buffer.byteLength(stdout, 'utf8'),
              stderrBytes: Buffer.byteLength(stderr, 'utf8'),
            }),
          },
        ],
      };
    },
  );

  registry.register(
    definition(
      'project/manifest',
      'Read Project manifest',
      'Read the authoritative Project manifest.',
      { type: 'object', properties: {}, additionalProperties: false },
      ProjectManifestSchema,
      'project-file',
      'none',
      'Reads the Project manifest.',
      ['project.manifest:read'],
    ),
    async (context) => {
      const manifest = JSON.parse(
        readFileSync(path.join(context.projectPath, PROJECT_MANIFEST_FILENAME), 'utf8'),
      );
      projectManifest.assert(manifest);
      return {
        output: manifest,
        evidence: [{ kind: 'manifest', ref: PROJECT_MANIFEST_FILENAME }],
      };
    },
  );
}

function definition(
  toolId: string,
  title: string,
  description: string,
  inputSchema: Record<string, unknown>,
  outputSchema: unknown,
  executionMode: ToolDefinition['executionMode'],
  sideEffects: ToolDefinition['sideEffects'],
  evidence: string,
  capabilities: string[],
): ToolDefinition {
  return {
    toolId,
    title,
    description,
    inputSchema,
    outputSchema,
    executionMode,
    sideEffects,
    evidence,
    capabilities,
    source: 'builtin',
  };
}

interface ReadablePath {
  path: string;
  referencePath: string;
}

function resolveReadablePath(
  projectPath: string,
  requestedPath: string,
  readOnlyRoots: string[],
): ReadablePath {
  try {
    const target = resolveProjectPath(projectPath, requestedPath);
    return { path: target, referencePath: projectRelativePath(projectPath, target) };
  } catch (error) {
    if (!(error instanceof RpcError) || error.code !== RpcErrorCode.PathOutsideProject) throw error;
  }

  const projectRoot = realpathSync(projectPath);
  const target = path.resolve(projectRoot, requestedPath);
  for (const root of readOnlyRoots) {
    if (!pathExists(root)) continue;
    const realRoot = realpathSync(root);
    let ancestor = target;
    while (!pathExists(ancestor)) {
      const parent = path.dirname(ancestor);
      if (parent === ancestor) break;
      ancestor = parent;
    }
    let realAncestor: string;
    try {
      realAncestor = realpathSync(ancestor);
    } catch {
      continue;
    }
    if (!isWithin(realRoot, realAncestor)) continue;
    if (pathExists(target)) {
      let realTarget: string;
      try {
        realTarget = realpathSync(target);
      } catch {
        continue;
      }
      if (!isWithin(realRoot, realTarget)) continue;
    }
    const relative = path.relative(realRoot, target);
    return {
      path: target,
      referencePath: joinReference(path.basename(realRoot), relative),
    };
  }
  throw pathOutsideProject(requestedPath);
}

function joinReference(root: string, relative: string): string {
  const child = relative.split(path.sep).join('/');
  if (root === '.' || root.length === 0) return child || '.';
  return child.length === 0 ? root : `${root}/${child}`;
}

function resolveProjectPath(
  projectPath: string,
  requestedPath: string,
  write = false,
  deletePath = false,
): string {
  const root = realpathSync(projectPath);
  const target = path.resolve(root, requestedPath);
  let ancestor = target;
  while (!pathExists(ancestor)) {
    const parent = path.dirname(ancestor);
    if (parent === ancestor) throw pathOutsideProject(requestedPath);
    ancestor = parent;
  }
  let realAncestor: string;
  try {
    realAncestor = realpathSync(ancestor);
  } catch {
    throw pathOutsideProject(requestedPath);
  }
  if (!isWithin(root, realAncestor)) throw pathOutsideProject(requestedPath);
  if (pathExists(target)) {
    let realTarget: string;
    try {
      realTarget = realpathSync(target);
    } catch {
      throw pathOutsideProject(requestedPath);
    }
    if (!isWithin(root, realTarget)) throw pathOutsideProject(requestedPath);
  }
  if ((write || deletePath) && (isGitPath(root, target) || isGitPath(root, realAncestor))) {
    throw pathOutsideProject(`${requestedPath} is managed by Git.`);
  }
  if (
    deletePath &&
    pathExists(target) &&
    lstatSync(target).isDirectory() &&
    containsGitMetadata(target)
  ) {
    throw pathOutsideProject(`${requestedPath} contains data managed by Git.`);
  }
  return target;
}

function pathExists(filePath: string): boolean {
  try {
    lstatSync(filePath);
    return true;
  } catch (error) {
    if (
      typeof error === 'object' &&
      error !== null &&
      'code' in error &&
      (error.code === 'ENOENT' || error.code === 'ENOTDIR')
    ) {
      return false;
    }
    throw error;
  }
}

function isWithin(root: string, target: string): boolean {
  const relative = path.relative(root, target);
  return (
    relative === '' ||
    (!relative.startsWith(`..${path.sep}`) && relative !== '..' && !path.isAbsolute(relative))
  );
}

function isGitPath(root: string, target: string): boolean {
  const relative = path.relative(root, target);
  const firstSegment = relative.split(path.sep)[0];
  return firstSegment?.toLowerCase() === '.git';
}

function containsGitMetadata(directory: string): boolean {
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    if (entry.name.toLowerCase() === '.git') return true;
    if (
      entry.isDirectory() &&
      !entry.isSymbolicLink() &&
      containsGitMetadata(path.join(directory, entry.name))
    ) {
      return true;
    }
  }
  return false;
}

function projectRelativePath(projectPath: string, target: string): string {
  const relative = path.relative(realpathSync(projectPath), target);
  return relative ? relative.split(path.sep).join('/') : '.';
}

function pathOutsideProject(pathValue: string): RpcError {
  return new RpcError(
    `Path is outside the Project or is managed by Git: ${pathValue}`,
    RpcErrorCode.PathOutsideProject,
  );
}

function asRecord(input: unknown): Record<string, unknown> {
  return typeof input === 'object' && input !== null && !Array.isArray(input)
    ? (input as Record<string, unknown>)
    : {};
}

function capOutput(value: string): string {
  const buffer = Buffer.from(value, 'utf8');
  return buffer.length > maxOutputBytes
    ? buffer.subarray(0, maxOutputBytes).toString('utf8')
    : value;
}

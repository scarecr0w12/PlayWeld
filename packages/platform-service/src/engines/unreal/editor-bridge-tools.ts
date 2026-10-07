import { createHash, randomBytes } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, realpathSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import spawn from 'cross-spawn';
import { RpcError, RpcErrorCode, uuidv7, type ToolDefinition } from '@gamecrafter/contracts';
import type { McpConnectionManager } from '../../mcp/connection-manager';
import type { ToolContext, ToolExecutionResult, ToolRegistry } from '../../tools/tool-registry';

const sourceFiles = [
  'LICENSE',
  'NOTICE',
  'PlayWeldEditor.uplugin',
  'README.md',
  'Source/PlayWeldEditor/PlayWeldEditor.Build.cs',
  'Source/PlayWeldEditor/Private/PlayWeldEditorModule.cpp',
];
const hash = (data: Buffer) => createHash('sha256').update(data).digest('hex');

export function enableGodotPlugin(before: string): string {
  const entry = '"res://addons/playweld_editor/plugin.cfg"';
  const lines = before.split(/\r?\n/);
  const sections = lines.flatMap((line, index) =>
    line.trim() === '[editor_plugins]' ? [index] : [],
  );
  if (sections.length > 1)
    throw new RpcError('Duplicate Godot editor_plugins sections.', RpcErrorCode.InvalidParams);
  if (sections.length === 0)
    return before.trimEnd() + `\n\n[editor_plugins]\nenabled=PackedStringArray(${entry})\n`;
  const start = sections[0]!;
  let end = start + 1;
  while (end < lines.length && !/^\s*\[/.test(lines[end]!)) end++;
  const assignments = lines
    .slice(start + 1, end)
    .flatMap((line, index) => (/^\s*enabled\s*=/.test(line) ? [start + 1 + index] : []));
  if (assignments.length > 1)
    throw new RpcError(
      'Duplicate Godot editor plugin enabled assignments.',
      RpcErrorCode.InvalidParams,
    );
  if (!assignments.length) lines.splice(start + 1, 0, `enabled=PackedStringArray(${entry})`);
  else {
    const index = assignments[0]!;
    const match = lines[index]!.match(/^\s*enabled\s*=\s*PackedStringArray\((.*)\)\s*$/);
    if (!match)
      throw new RpcError(
        'Unsupported Godot enabled plugin format; preserve the existing configuration.',
        RpcErrorCode.InvalidParams,
      );
    if (!match[1]!.includes(entry))
      lines[index] =
        `enabled=PackedStringArray(${match[1]!.trim()}${match[1]!.trim() ? ', ' : ''}${entry})`;
  }
  return lines.join('\n');
}

export function insideProject(root: string, target: string): string {
  const canonical = realpathSync(root);
  const absolute = path.resolve(root, target);
  let ancestor = absolute;
  while (!existsSync(ancestor)) ancestor = path.dirname(ancestor);
  const resolved = path.join(realpathSync(ancestor), path.relative(ancestor, absolute));
  const relative = path.relative(canonical, resolved);
  if (relative === '..' || relative.startsWith(`..${path.sep}`) || path.isAbsolute(relative))
    throw new RpcError('Editor bridge path escapes the Project.', RpcErrorCode.ToolDenied);
  return absolute;
}

export function validateEditorSession(
  session: Record<string, unknown>,
  projectFile: string,
): string {
  if (
    session.bridge !== 'PlayWeldEditor' ||
    typeof session.projectPath !== 'string' ||
    path.normalize(realpathSync(session.projectPath)) !== path.normalize(realpathSync(projectFile))
  )
    throw new RpcError(
      'Editor bridge does not identify this Project file.',
      RpcErrorCode.ToolDenied,
    );
  if (!Number.isInteger(session.pid) || Number(session.pid) < 1)
    throw new RpcError('Editor bridge session PID is invalid.', RpcErrorCode.InvalidParams);
  const endpoint = new URL(String(session.url));
  if (
    endpoint.protocol !== 'http:' ||
    endpoint.hostname !== '127.0.0.1' ||
    endpoint.pathname !== '/mcp' ||
    !endpoint.port ||
    endpoint.username ||
    endpoint.password ||
    endpoint.search ||
    endpoint.hash
  )
    throw new RpcError(
      'Editor bridge must use its authenticated loopback endpoint.',
      RpcErrorCode.ToolDenied,
    );
  return endpoint.toString();
}

/** Only ciphertext crosses the installation result; decrypted values stay inside the service. */
export async function dpapi(value: Buffer, decrypt: boolean, signal: AbortSignal): Promise<Buffer> {
  if (signal.aborted) throw new Error('Editor credential operation cancelled.');
  if (process.platform !== 'win32')
    throw new Error('PlayWeld editor pairing currently requires Windows DPAPI.');
  const script = `Add-Type -AssemblyName System.Security;$v=[Convert]::FromBase64String([Console]::In.ReadToEnd());$r=[Security.Cryptography.ProtectedData]::${decrypt ? 'Unprotect' : 'Protect'}($v,$null,[Security.Cryptography.DataProtectionScope]::CurrentUser);[Console]::Write([Convert]::ToBase64String($r));[Array]::Clear($v,0,$v.Length);[Array]::Clear($r,0,$r.Length)`;
  return new Promise((resolve, reject) => {
    const child = spawn('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', script], {
      windowsHide: true,
      stdio: ['pipe', 'pipe', 'ignore'],
    });
    let output = '';
    let timedOut = false;
    const stop = () => child.kill();
    const cleanup = () => {
      clearTimeout(timer);
      signal.removeEventListener('abort', stop);
    };
    const timer = setTimeout(() => {
      timedOut = true;
      stop();
    }, 30000);
    signal.addEventListener('abort', stop, { once: true });
    child.stdout?.on('data', (chunk: Buffer) => {
      output += chunk.toString();
      if (output.length > 128000) child.kill();
    });
    child.once('error', (error: NodeJS.ErrnoException) => {
      cleanup();
      reject(new Error(`Editor credential helper could not start (${error.code ?? 'unknown'}).`));
    });
    child.stdin?.on('error', () => {
      cleanup();
      stop();
      reject(new Error('Editor credential helper input transport failed.'));
    });
    child.once('close', (code) => {
      cleanup();
      if (signal.aborted) reject(new Error('Editor credential operation cancelled.'));
      else if (timedOut) reject(new Error('Editor credential helper timed out after 30000ms.'));
      else if (code !== 0)
        reject(
          new Error(`Editor credential protection operation failed (exit=${code ?? 'signal'}).`),
        );
      else resolve(Buffer.from(output.trim(), 'base64'));
    });
    child.stdin?.end(value.toString('base64'));
  });
}

interface Options {
  registry: ToolRegistry;
  mcp: McpConnectionManager;
  bind(projectId: string, connectionId: string): Promise<unknown>;
  family(projectId: string): string;
  bundle?: string;
  protect?: typeof dpapi;
  verify?: (projectId: string, connectionId: string, projectFile: string) => Promise<void>;
  build?: (context: ToolContext, projectFile: string) => Promise<ToolExecutionResult>;
}

export function registerUnrealEditorBridgeTools(options: Options): void {
  const protect = options.protect ?? dpapi;
  for (const action of ['install', 'build', 'connect'] as const) {
    const definition: ToolDefinition = {
      toolId: `engine/editor-bridge-${action}`,
      title: `PlayWeld editor bridge ${action}`,
      description:
        action === 'install'
          ? 'Install and enable the first-party editor plugin and protected pairing credential in an explicit Unity folder, Unreal .uproject or Godot project.godot. Unreal requires editor compilation; Unity and Godot load source automatically.'
          : action === 'build'
            ? 'Compile the first-party Unreal editor plugin using a registered Windows RunUAT installation, preserving modified source and binaries. Unity and Godot import their editor source automatically.'
            : 'Pair the running first-party editor with this Project using encrypted MCP credentials and bind its verified live bridge.',
      inputSchema: {
        type: 'object',
        properties: { projectFile: { type: 'string', minLength: 1 } },
        required: ['projectFile'],
        additionalProperties: false,
      },
      outputSchema: { type: 'object', additionalProperties: true },
      executionMode: action === 'build' ? 'headless-process' : 'project-file',
      sideEffects: 'workspace-write',
      evidence: 'Owned source hashes, protected pairing and actual editor MCP identity.',
      capabilities: ['engine:editor-bridge'],
      source: 'builtin',
    };
    options.registry.register(definition, async (context: ToolContext, input: unknown) => {
      const family = options.family(context.projectId);
      if (!['unity', 'unreal', 'godot'].includes(family))
        throw new RpcError(
          'This bridge requires a Unity, Unreal or Godot Project.',
          RpcErrorCode.EngineFamilyMismatch,
        );
      const projectFile = insideProject(
        context.projectPath,
        String((input as { projectFile: string }).projectFile),
      );
      const identityFile =
        family === 'unity'
          ? path.join(projectFile, 'ProjectSettings/ProjectVersion.txt')
          : projectFile;
      if (
        !existsSync(identityFile) ||
        (family === 'unreal' && !projectFile.endsWith('.uproject')) ||
        (family === 'godot' && path.basename(projectFile) !== 'project.godot')
      )
        throw new RpcError(
          'Explicit existing native engine Project required.',
          RpcErrorCode.InvalidParams,
        );
      const game = family === 'unity' ? projectFile : path.dirname(projectFile);
      if (action === 'build') {
        if (family !== 'unreal')
          return { output: { built: true, editorBuildRequired: false, family }, evidence: [] };
        if (!options.build) throw new Error('Editor build integration is unavailable.');
        return options.build(context, projectFile);
      }
      if (
        family !== 'unreal' &&
        path.relative(realpathSync(path.join(context.projectPath, 'game')), realpathSync(game)) !==
          ''
      )
        throw new RpcError(
          'Unity and Godot bridges require the selected Project game folder.',
          RpcErrorCode.ToolDenied,
        );
      const savedDirectory = path.join(
        game,
        family === 'unity'
          ? 'Library/PlayWeldEditor'
          : family === 'godot'
            ? '.godot/PlayWeldEditor'
            : 'Saved/PlayWeldEditor',
      );
      const bundle =
        options.bundle ?? path.resolve(__dirname, `../../integrations/${family}/PlayWeldEditor`);
      const files =
        family === 'unreal'
          ? sourceFiles
          : family === 'unity'
            ? ['PlayWeldEditorBridge.cs']
            : ['plugin.cfg', 'bridge.gd'];
      const credential = insideProject(
        context.projectPath,
        path.join(savedDirectory, 'session-token.dpapi'),
      );
      if (action === 'install') {
        const plugin = insideProject(
          context.projectPath,
          path.join(
            game,
            family === 'unity'
              ? 'Assets/Editor/PlayWeldEditor'
              : family === 'godot'
                ? 'addons/playweld_editor'
                : 'Plugins/PlayWeldEditor',
          ),
        );
        const manifestPath = insideProject(
          context.projectPath,
          path.join(savedDirectory, 'installed-source.json'),
        );
        const previousRecord = existsSync(manifestPath)
          ? (JSON.parse(readFileSync(manifestPath, 'utf8')) as {
              files?: Record<string, string>;
            } & Record<string, unknown>)
          : {};
        const previous = previousRecord.files ?? previousRecord;
        const copies = files.map((file) => {
          const bytes = readFileSync(path.join(bundle, file));
          const target = insideProject(context.projectPath, path.join(plugin, file));
          if (existsSync(target)) {
            const actual = hash(readFileSync(target));
            if (actual !== hash(bytes) && actual !== previous[file])
              throw new RpcError(
                `Preserve modified plugin source: ${file}`,
                RpcErrorCode.ToolDenied,
              );
          }
          return { file, bytes, target };
        });
        const before = readFileSync(identityFile, 'utf8');
        const godotEnabled = family === 'godot' ? enableGodotPlugin(before) : null;
        const project = (family === 'unreal' ? JSON.parse(before) : {}) as {
          Plugins?: Array<{ Name: string; Enabled: boolean; TargetAllowList?: string[] }>;
        };
        if (project.Plugins !== undefined && !Array.isArray(project.Plugins))
          throw new RpcError('Invalid Project plugin list.', RpcErrorCode.InvalidParams);
        const sources: Record<string, string> = {};
        for (const entry of copies) {
          mkdirSync(path.dirname(entry.target), { recursive: true });
          writeFileSync(entry.target, entry.bytes);
          sources[entry.file] = hash(entry.bytes);
        }
        mkdirSync(path.dirname(credential), { recursive: true });
        if (!existsSync(credential)) {
          const token = Buffer.from(randomBytes(32).toString('hex'));
          try {
            writeFileSync(credential, await protect(token, false, context.signal));
          } finally {
            token.fill(0);
          }
        }
        const saved = path.dirname(credential);
        if (family !== 'unity')
          writeFileSync(path.join(saved, `project-before-${uuidv7()}.txt`), before);
        if (family === 'unreal') {
          project.Plugins ??= [];
          const reference = project.Plugins.find((p) => p.Name === 'PlayWeldEditor');
          if (reference) {
            reference.Enabled = true;
            reference.TargetAllowList = ['Editor'];
          } else
            project.Plugins.push({
              Name: 'PlayWeldEditor',
              Enabled: true,
              TargetAllowList: ['Editor'],
            });
          writeFileSync(projectFile, JSON.stringify(project, null, 2) + '\n');
        } else if (family === 'godot') {
          writeFileSync(projectFile, godotEnabled!);
        }
        writeFileSync(
          manifestPath,
          JSON.stringify({ ...previousRecord, schemaVersion: 1, files: sources }, null, 2),
        );
        return {
          output: {
            installed: true,
            plugin: 'PlayWeldEditor',
            projectFile: path.relative(context.projectPath, projectFile),
            sources,
            credentialProtected: true,
            editorBuildRequired: family === 'unreal',
            editorReloadRequired: true,
            family,
          },
          evidence: [{ kind: 'file', ref: path.relative(context.projectPath, manifestPath) }],
        };
      }
      const sessionFile = insideProject(
        context.projectPath,
        path.join(savedDirectory, 'session.json'),
      );
      if (!existsSync(sessionFile) || !existsSync(credential))
        throw new RpcError(
          'Install the plugin, compile it if Unreal, and open this native Project before connecting.',
          RpcErrorCode.McpConnectFailed,
        );
      const session = JSON.parse(
        readFileSync(sessionFile, 'utf8').replace(/^\uFEFF/, ''),
      ) as Record<string, unknown>;
      const url = validateEditorSession(session, projectFile);
      const decrypted = await protect(readFileSync(credential), true, context.signal);
      try {
        const token = decrypted.toString('utf8');
        if (!/^[A-Za-z0-9+/=]{32,128}$/.test(token))
          throw new Error('Invalid protected editor credential.');
        const name = `playweld-${family}-${context.projectId}`;
        const endpoint = {
          url,
          transport: 'streamable-http' as const,
          headers: { Authorization: '${cred:editor-token}' },
        };
        let config = options.mcp
          .list(context.projectId)
          .find((e) => e.config.name === name)?.config;
        if (config)
          config = await options.mcp.update(
            config.connectionId,
            { enabled: true, endpoint },
            { 'editor-token': 'Bearer ' + token },
          );
        else
          config = options.mcp.add(
            {
              name,
              scope: 'project',
              projectId: context.projectId,
              enabled: true,
              allowServerInitiatedModelCalls: false,
              mode: 'endpoint',
              endpoint,
              tags: ['live-editor', family, 'playweld-owned-editor'],
            },
            { 'editor-token': 'Bearer ' + token },
          );
        const state = await options.mcp.connect(config.connectionId);
        if (state.serverInfo?.name !== `playweld-${family}-editor`) {
          await options.mcp.disconnect(config.connectionId);
          throw new RpcError(
            'Endpoint is not the PlayWeld editor bridge.',
            RpcErrorCode.McpConnectFailed,
          );
        }
        try {
          await options.verify?.(context.projectId, config.connectionId, projectFile);
        } catch (error) {
          await options.mcp.disconnect(config.connectionId);
          await options.mcp.update(config.connectionId, { enabled: false });
          throw error;
        }
        await options.bind(context.projectId, config.connectionId);
        return {
          output: {
            connected: true,
            connectionId: config.connectionId,
            editorPid: session.pid,
            server: state.serverInfo,
            protocol: state.negotiatedRevision,
          },
          evidence: [{ kind: 'mcp', ref: config.connectionId }],
        };
      } finally {
        decrypted.fill(0);
      }
    });
  }
}

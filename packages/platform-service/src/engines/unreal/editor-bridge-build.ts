import { createHash } from 'node:crypto';
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import spawn from 'cross-spawn';
import { RpcError, RpcErrorCode, uuidv7, type EngineInstallation } from '@gamecrafter/contracts';
import type { ToolContext, ToolExecutionResult } from '../../tools/tool-registry';
import { insideProject } from './editor-bridge-tools';

const digest = (bytes: Buffer) => createHash('sha256').update(bytes).digest('hex');

export async function buildUnrealEditorBridge(
  context: ToolContext,
  projectFile: string,
  installation: EngineInstallation,
): Promise<ToolExecutionResult> {
  if (context.signal.aborted) throw new Error('Editor plugin build cancelled.');
  if (
    process.platform !== 'win32' ||
    installation.family !== 'unreal' ||
    installation.kind !== 'uat' ||
    path.basename(installation.executable).toLowerCase() !== 'runuat.bat'
  )
    throw new RpcError(
      'Register the Windows Unreal RunUAT.bat installation before building this plugin.',
      RpcErrorCode.EngineInstallationNotFound,
    );
  const game = path.dirname(projectFile);
  const saved = insideProject(context.projectPath, path.join(game, 'Saved/PlayWeldEditor'));
  const plugin = insideProject(context.projectPath, path.join(game, 'Plugins/PlayWeldEditor'));
  const manifestPath = insideProject(
    context.projectPath,
    path.join(saved, 'installed-source.json'),
  );
  if (!existsSync(manifestPath))
    throw new Error('Install the managed editor plugin before building it.');
  const manifest = JSON.parse(readFileSync(manifestPath, 'utf8')) as {
    schemaVersion: number;
    files: Record<string, string>;
    build?: {
      engineFingerprint: string;
      sourceFingerprint: string;
      binaries: Record<string, string>;
    };
  };
  const bundle = path.resolve(__dirname, '../../integrations/unreal/PlayWeldEditor');
  const sourceHashes: string[] = [];
  for (const name of [
    'PlayWeldEditor.uplugin',
    'Source/PlayWeldEditor/PlayWeldEditor.Build.cs',
    'Source/PlayWeldEditor/Private/PlayWeldEditorModule.cpp',
  ]) {
    const file = insideProject(context.projectPath, path.join(plugin, name));
    if (digest(readFileSync(file)) !== digest(readFileSync(path.join(bundle, name))))
      throw new RpcError(
        'Build only the installed first-party plugin source; preserve modified source for explicit review.',
        RpcErrorCode.ToolDenied,
      );
    sourceHashes.push(digest(readFileSync(file)));
  }
  const sourceFingerprint = digest(Buffer.from(sourceHashes.join('\n')));
  if (existsSync(path.join(saved, 'session.json')))
    throw new RpcError(
      'Close this Project editor before rebuilding its plugin; unsaved editor work must be preserved.',
      RpcErrorCode.ToolDenied,
    );
  const engine = path.resolve(path.dirname(installation.executable), '../..');
  const fingerprint = digest(
    Buffer.concat([
      readFileSync(path.join(engine, 'Build/Build.version')),
      readFileSync(path.join(engine, 'Binaries/Win64/UnrealEditor.modules')),
    ]),
  );
  const binaries = insideProject(context.projectPath, path.join(plugin, 'Binaries/Win64'));
  if (
    manifest.build?.engineFingerprint === fingerprint &&
    manifest.build.sourceFingerprint === sourceFingerprint &&
    Object.keys(manifest.build.binaries).length &&
    Object.entries(manifest.build.binaries).every(([name, sha]) => {
      if (!/^UnrealEditor(?:-PlayWeldEditor)?\.(?:dll|pdb|modules)$/.test(name)) return false;
      const file = insideProject(context.projectPath, path.join(binaries, name));
      return existsSync(file) && digest(readFileSync(file)) === sha;
    })
  )
    return {
      output: { built: true, reused: true, engineVersion: installation.version },
      evidence: [{ kind: 'file', ref: path.relative(context.projectPath, manifestPath) }],
    };
  const output = insideProject(context.projectPath, path.join(saved, 'build', uuidv7()));
  mkdirSync(output, { recursive: true });
  // UAT adds a deep HostProject/Intermediate tree. Keep its owned scratch
  // short instead of nesting it under a potentially long Project path.
  const scratch = mkdtempSync(path.join(tmpdir(), 'pwue-'));
  const packagePath = path.join(scratch, 'p');
  const logFile = path.join(output, 'build.log');
  const args = [
    'BuildPlugin',
    `-Plugin=${path.join(plugin, 'PlayWeldEditor.uplugin')}`,
    `-Package=${packagePath}`,
    '-TargetPlatforms=Win64',
    '-Rocket',
    '-NoP4',
  ];
  const env = Object.fromEntries(
    Object.entries(process.env).filter(
      ([name, value]) =>
        value !== undefined &&
        !/(TOKEN|SECRET|API_KEY|PRIVATE_KEY|PASSWORD|CREDENTIAL)/i.test(name),
    ),
  ) as Record<string, string>;
  const child = spawn(installation.executable, args, {
    cwd: game,
    windowsHide: true,
    env,
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  let bytes = 0;
  const chunks: Buffer[] = [];
  const collect = (chunk: Buffer) => {
    bytes += chunk.length;
    if (bytes <= 16 * 1024 * 1024) chunks.push(chunk);
  };
  child.stdout?.on('data', collect);
  child.stderr?.on('data', collect);
  const cancel = () => {
    if (child.exitCode === null && child.pid) {
      const killer = spawn('taskkill.exe', ['/PID', String(child.pid), '/T', '/F'], {
        windowsHide: true,
        stdio: 'ignore',
      });
      killer.on('error', () => child.kill());
    }
  };
  const timeout = setTimeout(cancel, 15 * 60 * 1000);
  context.signal.addEventListener('abort', cancel, { once: true });
  if (context.signal.aborted) cancel();
  let code: number | null;
  try {
    code = await new Promise((resolve, reject) => {
      child.once('close', resolve);
      child.once('error', reject);
    });
  } finally {
    clearTimeout(timeout);
    context.signal.removeEventListener('abort', cancel);
    writeFileSync(logFile, Buffer.concat(chunks));
  }
  if (code !== 0 || context.signal.aborted)
    throw new Error(
      `Editor plugin build failed or was cancelled. Inspect ${path.relative(context.projectPath, logFile)}.`,
    );
  const compiled = insideProject(scratch, path.join(packagePath, 'Binaries/Win64'));
  const entries = readdirSync(compiled).filter((name) =>
    /^UnrealEditor(?:-PlayWeldEditor)?\.(?:dll|pdb|modules)$/.test(name),
  );
  if (
    !entries.includes('UnrealEditor-PlayWeldEditor.dll') ||
    !entries.includes('UnrealEditor.modules')
  )
    throw new Error('Unreal build did not produce its Editor module and build identity.');
  const copies = entries.map((name) => {
    const source = insideProject(scratch, path.join(compiled, name));
    if (statSync(source).size > 256 * 1024 * 1024)
      throw new Error('Compiled plugin file exceeds its budget.');
    const contents = readFileSync(source),
      sha = digest(contents),
      target = insideProject(context.projectPath, path.join(binaries, name));
    if (
      existsSync(target) &&
      digest(readFileSync(target)) !== sha &&
      digest(readFileSync(target)) !== manifest.build?.binaries[name]
    )
      throw new RpcError(
        `Preserve untracked or modified plugin binary: ${name}`,
        RpcErrorCode.ToolDenied,
      );
    return { name, contents, sha, target };
  });
  mkdirSync(binaries, { recursive: true });
  const hashes: Record<string, string> = {};
  for (const file of copies) {
    writeFileSync(file.target, file.contents);
    hashes[file.name] = file.sha;
  }
  manifest.build = { engineFingerprint: fingerprint, sourceFingerprint, binaries: hashes };
  writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));
  let retainedScratch: string | null = scratch;
  // Only remove the exact newly allocated, canonical scratch directory.
  if (
    path.dirname(path.resolve(scratch)) === path.resolve(tmpdir()) &&
    /^pwue-[A-Za-z0-9]{6}$/.test(path.basename(scratch))
  ) {
    try {
      rmSync(scratch, { recursive: true, force: true, maxRetries: 3, retryDelay: 100 });
      retainedScratch = null;
    } catch {
      /* Preserve an in-use compiler artifact and report its location. */
    }
  }
  return {
    output: {
      built: true,
      reused: false,
      engineVersion: installation.version,
      binaries: hashes,
      retainedScratch,
      log: path.relative(context.projectPath, logFile),
    },
    evidence: [
      { kind: 'file', ref: path.relative(context.projectPath, logFile) },
      { kind: 'file', ref: path.relative(context.projectPath, manifestPath) },
    ],
  };
}

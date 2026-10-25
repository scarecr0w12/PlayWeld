import path from 'node:path';
import spawn from 'cross-spawn';
import { RpcError, RpcErrorCode } from '@gamecrafter/contracts';
import { requireExistingProjectPath } from './path-utils';

// The pathname is child environment data, never part of PowerShell command text.
const windowsOpenScript = [
  "$ErrorActionPreference = 'Stop'",
  'Invoke-Item -LiteralPath $env:GAMECRAFTER_ASSET_OPEN_PATH',
].join('; ');

export async function openInAuthoringTool(
  projectPath: string,
  relativePath: string,
  configuredCommand: string,
): Promise<{ launched: boolean; command: string }> {
  const absolutePath = requireExistingProjectPath(projectPath, relativePath);
  const windowsDefault = process.platform === 'win32' && !configuredCommand.trim();
  const parsed = configuredCommand.trim() ? parseCommand(configuredCommand) : defaultCommand();
  if (!parsed.executable) {
    throw new RpcError('The configured authoring command is empty.', RpcErrorCode.InvalidParams);
  }
  if (!windowsDefault) requireExecutableCommand(parsed);
  const args = windowsDefault ? parsed.args : [...parsed.args, absolutePath];
  const displayCommand = `${path.basename(parsed.executable)} (${args.length} args)`;
  return new Promise((resolve) => {
    let spawned = false;
    let child;
    let timer: NodeJS.Timeout | undefined;
    try {
      const options = {
        detached: !windowsDefault,
        stdio: 'ignore' as const,
        shell: false,
        windowsHide: true,
        ...(windowsDefault
          ? { env: { ...process.env, GAMECRAFTER_ASSET_OPEN_PATH: absolutePath } }
          : {}),
      };
      child = spawn(parsed.executable, args, options);
    } catch {
      resolve({ launched: false, command: displayCommand });
      return;
    }
    child.once('error', () => {
      clearTimeout(timer);
      if (!spawned) resolve({ launched: false, command: displayCommand });
    });
    child.once('spawn', () => {
      spawned = true;
      if (!windowsDefault) {
        child.unref();
        resolve({ launched: true, command: displayCommand });
      }
    });
    if (windowsDefault) {
      timer = setTimeout(() => {
        child.kill();
        resolve({ launched: false, command: displayCommand });
      }, 10_000);
      timer.unref();
      child.once('close', (code) => {
        clearTimeout(timer);
        resolve({ launched: code === 0, command: displayCommand });
      });
    }
  });
}

function defaultCommand(): { executable: string; args: string[] } {
  if (process.platform === 'win32')
    return {
      executable: path.win32.join(
        process.env.SystemRoot ?? 'C:\\Windows',
        'System32',
        'WindowsPowerShell',
        'v1.0',
        'powershell.exe',
      ),
      args: ['-NoProfile', '-NonInteractive', '-Command', windowsOpenScript],
    };
  return { executable: process.platform === 'darwin' ? 'open' : 'xdg-open', args: [] };
}

function requireExecutableCommand(command: { executable: string; args: string[] }): void {
  const executable = path.win32.basename(command.executable).toLowerCase();
  const commandShell = ['cmd', 'cmd.exe', 'command.com'].includes(executable);
  const powershell = ['powershell', 'powershell.exe', 'pwsh', 'pwsh.exe'].includes(executable);
  if (commandShell || (powershell && !isPowerShellFileCommand(command.args))) {
    throw new RpcError(
      'Authoring commands must use an executable or script file, not a shell command. Use PowerShell -File for a configured PowerShell script.',
      RpcErrorCode.InvalidParams,
    );
  }
}

function isPowerShellFileCommand(args: string[]): boolean {
  // Only explicit file mode may receive a filename. A -File token inside
  // -Command text does not change how PowerShell parses the remaining input.
  for (let index = 0; index < args.length; index += 1) {
    const argument = args[index]!.toLowerCase();
    if (argument === '-file') return Boolean(args[index + 1]);
    if (['-noprofile', '-noninteractive', '-nologo', '-sta', '-mta'].includes(argument)) continue;
    if (argument === '-executionpolicy') {
      if (
        ![
          'allsigned',
          'bypass',
          'default',
          'remotesigned',
          'restricted',
          'undefined',
          'unrestricted',
        ].includes(args[++index]?.toLowerCase() ?? '')
      )
        return false;
      continue;
    }
    if (argument === '-windowstyle') {
      if (
        !['normal', 'hidden', 'minimized', 'maximized'].includes(args[++index]?.toLowerCase() ?? '')
      )
        return false;
      continue;
    }
    return false;
  }
  return false;
}

function parseCommand(command: string): { executable: string; args: string[] } {
  const tokens = command.match(/(?:"([^"]*)"|'([^']*)'|([^\s]+))/g) ?? [];
  const values = tokens.map((token) => token.replace(/^(?:"|')|(?:"|')$/g, ''));
  return { executable: values[0] ?? '', args: values.slice(1) };
}

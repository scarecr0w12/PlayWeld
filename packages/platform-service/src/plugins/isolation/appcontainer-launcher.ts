import { RpcError, RpcErrorCode, type IsolationReport } from '@gamecrafter/contracts';
import { spawn, spawnSync, type ChildProcessWithoutNullStreams } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  realpathSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { createServer } from 'node:net';
import path from 'node:path';
import type { IsolationLauncher, LaunchSpec } from './types';

export class AppContainerLauncher implements IsolationLauncher {
  constructor(
    private readonly helper = path.resolve(
      __dirname,
      '../../../lib/plugins/isolation/AppContainerHost.exe',
    ),
  ) {}

  async probe(): Promise<IsolationReport> {
    const report: IsolationReport = {
      platform: 'win32',
      backend: 'appcontainer',
      available: false,
      checks: [],
    };
    if (process.platform !== 'win32' || !existsSync(this.helper)) {
      report.checks.push({
        name: 'appcontainer',
        ok: false,
        detail: 'Windows native isolation helper is unavailable.',
      });
      return report;
    }
    const root = mkdtempSync(path.join(tmpdir(), 'playweld-lpac-'));
    const pluginDir = path.join(root, 'plugin');
    const scratchDir = path.join(root, 'scratch');
    mkdirSync(pluginDir);
    mkdirSync(scratchDir);
    const privateFile = path.join(root, 'private.txt');
    writeFileSync(privateFile, 'private probe');
    const allAppsFile = path.join(root, 'all-apps.txt');
    writeFileSync(allAppsFile, 'All Application Packages probe');
    const granted = spawnSync('icacls.exe', [allAppsFile, '/grant', '*S-1-15-2-1:(R)', '/q'], {
      windowsHide: true,
    });
    if (granted.status !== 0) {
      rmSync(root, { recursive: true, force: true });
      report.checks.push({
        name: 'lpac',
        ok: false,
        detail: 'Cannot prepare the All Application Packages isolation probe.',
      });
      return report;
    }
    const server = createServer((socket) => socket.end());
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
    const address = server.address();
    if (!address || typeof address === 'string')
      throw new Error('Isolation probe socket unavailable.');
    const script = path.join(pluginDir, 'probe.cjs');
    writeFileSync(
      script,
      `const fs=require('node:fs');const r={privateDenied:false,allAppsDenied:false,sourceDenied:false,scratch:false,networkDenied:false};try{fs.readFileSync(${JSON.stringify(privateFile)})}catch{r.privateDenied=true}try{fs.readFileSync(${JSON.stringify(allAppsFile)})}catch{r.allAppsDenied=true}try{fs.writeFileSync(${JSON.stringify(path.join(pluginDir, 'denied'))},'x')}catch{r.sourceDenied=true}fs.writeFileSync(${JSON.stringify(path.join(scratchDir, 'allowed'))},'x');r.scratch=true;const socket=require('node:net').connect(${address.port},'127.0.0.1');socket.setTimeout(2000,()=>socket.destroy());socket.once('error',e=>{r.networkDenied=e.code==='EACCES';});socket.once('close',()=>console.log(JSON.stringify(r)));`,
    );
    try {
      const child = this.launch({
        command: process.execPath,
        args: [script],
        env: {},
        cwd: pluginDir,
        readOnlyPaths: [pluginDir],
        readWritePaths: [scratchDir],
        network: false,
        pluginDir,
        scratchDir,
      });
      const result = await new Promise<{ code: number | null; output: string; error: string }>(
        (resolve, reject) => {
          let output = '',
            error = '';
          const timeout = setTimeout(() => {
            child.kill();
            reject(new Error(`Native isolation probe timed out. ${error.trim()}`));
          }, 15000);
          child.stdout.on('data', (chunk: Buffer) => {
            output += chunk.toString();
          });
          child.stderr.on('data', (chunk: Buffer) => {
            error += chunk.toString();
          });
          child.once('error', (failure) => {
            clearTimeout(timeout);
            reject(failure);
          });
          child.once('close', (code) => {
            clearTimeout(timeout);
            resolve({ code, output, error });
          });
          child.stdin.end();
        },
      );
      if (result.code !== 0)
        throw new Error(result.error.trim() || `Native worker exited ${result.code}`);
      const checks = JSON.parse(result.output) as Record<string, boolean>;
      report.checks = [
        'privateDenied',
        'allAppsDenied',
        'sourceDenied',
        'scratch',
        'networkDenied',
      ].map((name) => ({
        name,
        ok: checks[name] === true,
        detail: `Native LPAC worker: ${name}=${checks[name] === true}`,
      }));
      report.available = report.checks.every((check) => check.ok);
    } catch (error) {
      report.checks.push({
        name: 'appcontainer',
        ok: false,
        detail: error instanceof Error ? error.message : 'Native isolation probe failed.',
      });
    } finally {
      await new Promise<void>((resolve) => server.close(() => resolve()));
      rmSync(root, { recursive: true, force: true });
    }
    return report;
  }

  launch(spec: LaunchSpec): ChildProcessWithoutNullStreams {
    if (process.platform !== 'win32' || !existsSync(this.helper))
      throw new RpcError(
        'Windows native isolation helper is unavailable.',
        RpcErrorCode.PluginIsolationUnavailable,
      );
    const pluginDir = realpathSync(spec.pluginDir),
      scratchDir = realpathSync(spec.scratchDir);
    const inside = (root: string, target: string) => {
      const relative = path.relative(root, target);
      return (
        relative === '' ||
        (relative !== '..' && !relative.startsWith(`..${path.sep}`) && !path.isAbsolute(relative))
      );
    };
    const cwd = realpathSync(spec.cwd);
    if (!inside(pluginDir, cwd))
      throw new RpcError(
        'Worker directory must be inside its plugin.',
        RpcErrorCode.PluginIsolationUnavailable,
      );
    let command = spec.command;
    if (/^python3?(?:\.exe)?$/i.test(command)) {
      const python = spawnSync('py.exe', ['-3', '-c', 'import sys; print(sys.executable)'], {
        encoding: 'utf8',
        windowsHide: true,
        timeout: 10000,
      });
      if (python.status === 0 && python.stdout.trim()) command = python.stdout.trim();
    }
    if (!path.isAbsolute(command)) {
      const resolved = spawnSync('where.exe', [command], { encoding: 'utf8', windowsHide: true });
      command = resolved.stdout?.trim().split(/\r?\n/)[0] ?? '';
    }
    command = realpathSync(command);
    const electron =
      Boolean(process.versions.electron) && command === realpathSync(process.execPath);
    const runtime =
      path.basename(command).toLowerCase() === 'node.exe'
        ? [command]
        : electron
          ? readdirSync(path.dirname(command), { withFileTypes: true })
              .filter((entry) => entry.isFile())
              .map((entry) => path.join(path.dirname(command), entry.name))
          : [path.dirname(command)];
    const readOnlyPaths = [
      ...new Set([
        pluginDir,
        ...runtime,
        ...spec.readOnlyPaths.map((entry) => realpathSync(entry)),
      ]),
    ];
    const readWritePaths = [
      ...new Set([scratchDir, ...spec.readWritePaths.map((entry) => realpathSync(entry))]),
    ];
    if (
      readWritePaths.some((entry) => !inside(scratchDir, entry)) ||
      readOnlyPaths.some((entry) => inside(entry, scratchDir))
    )
      throw new RpcError(
        'Writable mounts must be confined to separate plugin scratch storage.',
        RpcErrorCode.PluginIsolationUnavailable,
      );
    const profileName = `PlayWeldPlugin${randomUUID().replaceAll('-', '')}`;
    const env = {
      ...spec.env,
      SystemRoot: process.env.SystemRoot ?? 'C:\\Windows',
      windir: process.env.SystemRoot ?? 'C:\\Windows',
      PATH: path.dirname(command),
      HOME: pluginDir,
      USERPROFILE: pluginDir,
      LOCALAPPDATA: scratchDir,
      APPDATA: scratchDir,
      TEMP: scratchDir,
      TMP: scratchDir,
      TMPDIR: scratchDir,
      ...(process.versions.electron ? { ELECTRON_RUN_AS_NODE: '1' } : {}),
    };
    const args =
      path.basename(command).toLowerCase() === 'node.exe' || electron
        ? ['--preserve-symlinks', '--preserve-symlinks-main', ...spec.args]
        : spec.args;
    const configuration = {
      ...spec,
      args,
      command,
      cwd,
      pluginDir,
      scratchDir,
      profileName,
      readOnlyPaths,
      readWritePaths,
      env,
    };
    const child = spawn(this.helper, [], { windowsHide: true, stdio: ['pipe', 'pipe', 'pipe'] });
    child.stdin.write(`${JSON.stringify(configuration)}\n`);
    child.once('close', () => {
      const cleanup = spawn(this.helper, [], {
        windowsHide: true,
        stdio: ['pipe', 'ignore', 'ignore'],
      });
      cleanup.on('error', () => undefined);
      cleanup.stdin?.on('error', () => undefined);
      cleanup.stdin?.end(`${JSON.stringify({ ...configuration, cleanup: true })}\n`);
    });
    return child;
  }
}

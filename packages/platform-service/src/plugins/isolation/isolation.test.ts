import { createServer } from 'node:net';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { JsonRpcChannel } from '../../ipc/jsonrpc-channel';
import { ChildProcessTransport } from '../../ipc/child-process-transport';
import { AppContainerLauncher } from './appcontainer-launcher';
import { BwrapLauncher, evaluateBwrapProbeChecks } from './bwrap-launcher';
import { UnisolatedLauncher } from './unisolated-launcher';

const temporaryDirectories: string[] = [];
afterEach(() => {
  for (const directory of temporaryDirectories.splice(0)) {
    rmSync(directory, { recursive: true, force: true });
  }
});

describe('plugin worker isolation', () => {
  it('accepts identity-mapped unprivileged user and group namespaces', () => {
    const checks = evaluateBwrapProbeChecks(
      {
        uid: 1000,
        gid: 1000,
        pid: 2,
        nspid: ['2'],
        namespaces: {
          user: 'user:[2001]',
          pid: 'pid:[2002]',
          net: 'net:[2003]',
          mnt: 'mnt:[2004]',
        },
        proc: true,
        tmp: true,
      },
      {
        uid: 1000,
        gid: 1000,
        namespaces: {
          user: 'user:[1001]',
          pid: 'pid:[1002]',
          net: 'net:[1003]',
          mnt: 'mnt:[1004]',
        },
      },
    );
    const userNamespace = checks.find((check) => check.name === 'userns');
    expect(userNamespace?.ok).toBe(true);
    expect(userNamespace?.detail).toContain('identity=true');
  });

  it('keeps Project and host files private, protects HOME, and gates network access', async (context) => {
    const launcher = new BwrapLauncher();
    const report = await launcher.probe();
    if (!report.available) {
      console.warn(
        `Skipping bwrap adversarial checks: ${report.checks.map((check) => check.detail).join('; ')}`,
      );
      context.skip();
    }

    const root = mkdtempSync(path.join(tmpdir(), 'gc-plugin-isolation-'));
    temporaryDirectories.push(root);
    const projectDirectory = path.join(root, 'project');
    const pluginDirectory = path.resolve(__dirname, '../__fixtures__/adversarial');
    const scratchDirectory = path.join(root, 'scratch');
    mkdirSync(projectDirectory);
    mkdirSync(scratchDirectory);
    const projectFile = path.join(projectDirectory, 'private.txt');
    writeFileSync(projectFile, 'project secret');
    const server = createServer((socket) => {
      socket.on('error', (error) => {
        if ((error as NodeJS.ErrnoException).code !== 'ECONNRESET') server.emit('error', error);
      });
      socket.end('accepted');
    });
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
    const address = server.address();
    if (!address || typeof address === 'string') throw new Error('TCP fixture did not bind');
    try {
      const deniedNetwork = await runAdversarialWorker(
        launcher,
        {
          command: 'python3',
          args: [path.join(pluginDirectory, 'worker.py')],
          env: {},
          cwd: pluginDirectory,
          readOnlyPaths: [pluginDirectory],
          readWritePaths: [scratchDirectory],
          network: false,
          pluginDir: pluginDirectory,
          scratchDir: scratchDirectory,
        },
        projectFile,
        address.port,
      );
      expect(deniedNetwork.projectError).toBe('FileNotFoundError:2');
      expect(deniedNetwork.homeError).toMatch(/^(PermissionError:13|OSError:30)$/);
      expect(deniedNetwork.scratchError).toBeNull();
      expect(deniedNetwork.rootError).toBe('FileNotFoundError:2');
      expect(deniedNetwork.pids.length).toBeLessThanOrEqual(2);
      expect(deniedNetwork.networkError).toMatch(/^(OSError|ConnectionRefusedError|TimeoutError):/);

      const allowedNetwork = await runAdversarialWorker(
        launcher,
        {
          command: 'python3',
          args: [path.join(pluginDirectory, 'worker.py')],
          env: {},
          cwd: pluginDirectory,
          readOnlyPaths: [pluginDirectory],
          readWritePaths: [scratchDirectory],
          network: true,
          pluginDir: pluginDirectory,
          scratchDir: scratchDirectory,
        },
        projectFile,
        address.port,
      );
      expect(allowedNetwork.networkError).toBeNull();
      expect(allowedNetwork.projectError).toBe('FileNotFoundError:2');
      expect(allowedNetwork.homeError).toMatch(/^(PermissionError:13|OSError:30)$/);
      expect(allowedNetwork.scratchError).toBeNull();
      expect(allowedNetwork.rootError).toBe('FileNotFoundError:2');
      expect(allowedNetwork.pids.length).toBeLessThanOrEqual(2);
    } finally {
      await new Promise<void>((resolve, reject) =>
        server.close((error) => (error ? reject(error) : resolve())),
      );
    }
  }, 30_000);

  it('reports unavailable Linux sandbox binaries and fails closed on Windows', async () => {
    const unavailable = await new BwrapLauncher({ binaryPath: '/not/a/bwrap/binary' }).probe();
    expect(unavailable).toMatchObject({ platform: 'linux', backend: 'bwrap', available: false });
    await expect(
      new AppContainerLauncher('/missing/native/helper.exe').probe(),
    ).resolves.toMatchObject({
      platform: 'win32',
      backend: 'appcontainer',
      available: false,
      checks: [
        {
          name: 'appcontainer',
          ok: false,
          detail: 'Windows native isolation helper is unavailable.',
        },
      ],
    });
  });

  it('enforces Windows LPAC source, host, All Application Packages and network boundaries', async (context) => {
    if (process.platform !== 'win32') context.skip('Requires Windows native isolation.');
    const report = await new AppContainerLauncher().probe();
    expect(report.available, JSON.stringify(report.checks)).toBe(true);
    expect(report.checks.map((check) => check.name)).toEqual([
      'privateDenied',
      'allAppsDenied',
      'sourceDenied',
      'scratch',
      'networkDenied',
    ]);
    expect(report.checks.every((check) => check.ok)).toBe(true);
  }, 30_000);

  it('reports unisolated execution as unenforced', async () => {
    await expect(new UnisolatedLauncher().probe()).resolves.toMatchObject({
      backend: 'none',
      available: true,
    });
  });
});

async function runAdversarialWorker(
  launcher: BwrapLauncher,
  spec: {
    command: string;
    args: string[];
    env: Record<string, string>;
    cwd: string;
    readOnlyPaths: string[];
    readWritePaths: string[];
    network: boolean;
    pluginDir: string;
    scratchDir: string;
  },
  projectFile: string,
  port: number,
): Promise<{
  projectError: string | null;
  homeError: string | null;
  rootError: string | null;
  pids: string[];
  networkError: string | null;
  scratchError: string | null;
}> {
  const transport = new ChildProcessTransport(launcher.launch(spec));
  const channel = new JsonRpcChannel(transport, 5_000);
  await channel.start();
  try {
    await channel.request('plugin/initialize', { protocolVersion: 1, pluginId: 'adversarial' });
    const response = await channel.request('plugin/tool/call', {
      toolId: 'adversarial/probe',
      input: { projectFile, port },
    });
    return (response as { output: typeof response }).output as {
      projectError: string | null;
      homeError: string | null;
      rootError: string | null;
      pids: string[];
      networkError: string | null;
      scratchError: string | null;
    };
  } finally {
    await channel.close();
  }
}

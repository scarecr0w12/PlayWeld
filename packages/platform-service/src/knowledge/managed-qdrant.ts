import { randomBytes } from 'node:crypto';
import { spawn } from 'cross-spawn';
import type { ChildProcess } from 'node:child_process';
import { createServer } from 'node:net';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';

const QDRANT_VERSION = '1.19.1';
const DEFAULT_TIMEOUT_MS = 15_000;
const MAX_START_ATTEMPTS = 3;
const MAX_CAPTURED_OUTPUT = 8_192;
const SHUTDOWN_GRACE_MS = 2_000;

export interface ManagedQdrantOptions {
  binaryPath: string;
  storagePath: string;
  timeoutMs?: number;
}

export interface ManagedQdrantEndpoint {
  url: string;
  apiKey: string;
}

interface ProcessExit {
  code: number | null;
  signal: NodeJS.Signals | null;
  error?: Error;
}

interface ManagedChild {
  process: ChildProcess;
  closed: Promise<ProcessExit>;
  exit?: ProcessExit;
  output: string;
  stopping?: Promise<void>;
}

export class ManagedQdrant {
  private readonly binaryPath: string;
  private readonly storagePath: string;
  private workDirectory?: string;
  private readonly timeoutMs: number;
  private readonly apiKey = randomBytes(32).toString('hex');
  private startPromise?: Promise<ManagedQdrantEndpoint>;
  private endpointValue?: ManagedQdrantEndpoint;
  private child?: ManagedChild;
  private closePromise?: Promise<void>;
  private closed = false;

  constructor(options: ManagedQdrantOptions) {
    this.binaryPath = path.resolve(options.binaryPath);
    this.storagePath = path.resolve(options.storagePath);
    this.timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
    if (!Number.isFinite(this.timeoutMs) || this.timeoutMs <= 0)
      throw new Error('Managed Qdrant timeoutMs must be a positive finite number.');
  }

  endpoint(): Promise<ManagedQdrantEndpoint> {
    if (this.closed) return Promise.reject(new Error('Managed Qdrant has been closed.'));
    if (this.endpointValue) {
      if (!this.child?.exit) return Promise.resolve(this.endpointValue);
      this.endpointValue = undefined;
      this.startPromise = undefined;
    }
    this.startPromise ??= this.start().catch((error) => {
      this.startPromise = undefined;
      throw error;
    });
    return this.startPromise;
  }

  close(): Promise<void> {
    if (this.closePromise) return this.closePromise;
    this.closed = true;
    this.closePromise = (async () => {
      await this.stopChild(this.child);
      await this.startPromise?.catch(() => undefined);
      if (this.workDirectory) await rm(this.workDirectory, { recursive: true, force: true });
    })();
    return this.closePromise;
  }

  private async start(): Promise<ManagedQdrantEndpoint> {
    await mkdir(this.storagePath, { recursive: true, mode: 0o700 });
    // Never load Qdrant configuration from a Project-controlled working directory.
    this.workDirectory ??= await mkdtemp(path.join(tmpdir(), 'playweld-managed-qdrant-'));
    await writeFile(
      path.join(this.workDirectory, 'managed-qdrant.yaml'),
      'service:\n  grpc_port: null\n',
      { mode: 0o600 },
    );
    const deadline = Date.now() + this.timeoutMs;
    let lastFailure = 'Qdrant exited before becoming ready.';

    for (let attempt = 0; attempt < MAX_START_ATTEMPTS; attempt += 1) {
      if (this.closed) throw new Error('Managed Qdrant has been closed.');
      const port = await allocateLoopbackPort();
      if (this.closed) throw new Error('Managed Qdrant has been closed.');

      const child = this.spawnChild(port);
      this.child = child;
      let versionFailure: string | undefined;

      while (Date.now() < deadline) {
        if (this.closed) {
          await this.stopChild(child);
          throw new Error('Managed Qdrant has been closed.');
        }

        const exit = child.exit;
        if (exit) {
          lastFailure = formatExit(child, exit);
          break;
        }

        try {
          const response = await fetch(`http://127.0.0.1:${port}/`, {
            headers: { 'api-key': this.apiKey },
            signal: AbortSignal.timeout(Math.min(500, Math.max(1, deadline - Date.now()))),
            redirect: 'error',
          });
          if (response.ok) {
            const body = (await response.json()) as { version?: unknown };
            if (body.version === QDRANT_VERSION) {
              const [authenticated, anonymous] = await Promise.all([
                fetch(`http://127.0.0.1:${port}/collections`, {
                  headers: { 'api-key': this.apiKey },
                  signal: AbortSignal.timeout(500),
                  redirect: 'error',
                }),
                fetch(`http://127.0.0.1:${port}/collections`, {
                  signal: AbortSignal.timeout(500),
                  redirect: 'error',
                }),
              ]);
              if (!authenticated.ok || ![401, 403].includes(anonymous.status) || child.exit) {
                await authenticated.body?.cancel();
                await anonymous.body?.cancel();
                throw new Error('Managed Qdrant did not enforce its private API key.');
              }
              await authenticated.body?.cancel();
              await anonymous.body?.cancel();
              const endpoint = { url: `http://127.0.0.1:${port}`, apiKey: this.apiKey };
              this.endpointValue = endpoint;
              return endpoint;
            }
            versionFailure = `Qdrant version mismatch: expected Qdrant ${QDRANT_VERSION}, received ${String(body.version)}.`;
            break;
          }
        } catch {
          // The listener is not ready yet, or this reserved port was claimed by another process.
        }

        await delay(Math.min(100, Math.max(1, deadline - Date.now())));
      }

      if (this.closed) {
        await this.stopChild(child);
        throw new Error('Managed Qdrant has been closed.');
      }

      const exit = child.exit;
      if (!exit && !versionFailure && Date.now() >= deadline) {
        await this.stopChild(child);
        throw new Error(`Managed Qdrant readiness timed out after ${this.timeoutMs}ms.`);
      }

      if (versionFailure) lastFailure = versionFailure;
      await this.stopChild(child);
      if (Date.now() >= deadline) break;
    }

    throw new Error(
      `Unable to start managed Qdrant after ${MAX_START_ATTEMPTS} attempts: ${lastFailure}`,
    );
  }

  private spawnChild(port: number): ManagedChild {
    const inherited = Object.fromEntries(
      Object.entries(process.env).filter(([key]) => !/^QDRANT(?:_|$)/i.test(key)),
    );
    const child = spawn(
      this.binaryPath,
      ['--config-path', path.join(this.workDirectory!, 'managed-qdrant.yaml')],
      {
        windowsHide: true,
        cwd: this.workDirectory,
        stdio: ['ignore', 'pipe', 'pipe'],
        env: {
          ...inherited,
          QDRANT__SERVICE__HOST: '127.0.0.1',
          QDRANT__SERVICE__HTTP_PORT: String(port),
          QDRANT__SERVICE__ENABLE_CORS: 'false',
          QDRANT__SERVICE__API_KEY: this.apiKey,
          QDRANT__TELEMETRY_DISABLED: 'true',
          QDRANT__CLUSTER__ENABLED: 'false',
          QDRANT__STORAGE__STORAGE_PATH: path.toNamespacedPath(this.storagePath),
          QDRANT__STORAGE__SNAPSHOTS_PATH: path.toNamespacedPath(
            path.join(this.storagePath, 'snapshots'),
          ),
          QDRANT__STORAGE__TEMP_PATH: path.toNamespacedPath(path.join(this.storagePath, 'tmp')),
        },
      },
    );

    let resolveClosed!: (exit: ProcessExit) => void;
    const closed = new Promise<ProcessExit>((resolve) => {
      resolveClosed = resolve;
    });
    let output = '';
    let processError: Error | undefined;
    const capture = (chunk: Buffer | string) => {
      output = (output + chunk.toString()).slice(-MAX_CAPTURED_OUTPUT);
    };
    child.stdout?.on('data', capture);
    child.stderr?.on('data', capture);
    child.once('error', (error) => {
      processError = error;
    });
    const managedChild: ManagedChild = {
      process: child,
      closed,
      output: '',
    };
    child.once('close', (code, signal) => {
      managedChild.exit = { code, signal, error: processError };
      resolveClosed(managedChild.exit);
    });

    Object.defineProperty(managedChild, 'output', { get: () => output });
    return managedChild;
  }

  private async stopChild(child: ManagedChild | undefined): Promise<void> {
    if (!child) return;
    child.stopping ??= this.terminateChild(child);
    await child.stopping;
    if (this.child === child) this.child = undefined;
  }

  private async terminateChild(child: ManagedChild): Promise<void> {
    if (!child.exit) {
      if (process.platform === 'win32' && child.process.pid) {
        // Killing cmd.exe first orphans its children; terminate the tree while its PID exists.
        const killer = spawn(
          path.join(process.env.SystemRoot ?? 'C:\\Windows', 'System32', 'taskkill.exe'),
          ['/PID', String(child.process.pid), '/T', '/F'],
          { windowsHide: true, stdio: 'ignore' },
        );
        await new Promise<void>((resolve, reject) => {
          killer.once('error', reject);
          killer.once('close', (code) =>
            code === 0 || child.exit
              ? resolve()
              : reject(new Error('Unable to terminate managed Qdrant process tree.')),
          );
        });
      } else {
        try {
          child.process.kill('SIGTERM');
        } catch {
          // A concurrently exiting process is handled by the close wait below.
        }
      }
      if (!(await waitForClose(child.closed, SHUTDOWN_GRACE_MS)) && process.platform !== 'win32') {
        try {
          child.process.kill('SIGKILL');
        } catch {
          // The process may have exited between the timeout and the kill.
        }
        if (!(await waitForClose(child.closed, SHUTDOWN_GRACE_MS)))
          throw new Error('Managed Qdrant process did not terminate.');
      }
    }
  }
}

async function allocateLoopbackPort(): Promise<number> {
  const server = createServer();
  await new Promise<void>((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolve);
  });
  const address = server.address();
  if (!address || typeof address === 'string') {
    await closeServer(server);
    throw new Error('Unable to allocate a loopback port for managed Qdrant.');
  }
  const { port } = address;
  await closeServer(server);
  return port;
}

function closeServer(server: ReturnType<typeof createServer>): Promise<void> {
  return new Promise((resolve, reject) => {
    server.close((error) => (error ? reject(error) : resolve()));
  });
}

function waitForClose(promise: Promise<ProcessExit>, timeoutMs: number): Promise<boolean> {
  return new Promise((resolve) => {
    const timer = setTimeout(() => resolve(false), timeoutMs);
    void promise.then(() => {
      clearTimeout(timer);
      resolve(true);
    });
  });
}

function formatExit(child: ManagedChild, exit: ProcessExit): string {
  const reason =
    exit.error?.message ??
    `exit code ${String(exit.code)}${exit.signal ? ` (${exit.signal})` : ''}`;
  const output = child.output.trim();
  return output ? `${reason}: ${output}` : reason;
}

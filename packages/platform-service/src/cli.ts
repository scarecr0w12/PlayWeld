#!/usr/bin/env node
import { spawn } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync } from 'node:fs';
import net from 'node:net';
import path from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import { acquireLock, isProcessAlive, readLock } from './lock';
import { enableFileLogging, log } from './logger';
import { resolvePaths } from './paths';
import { PlatformService } from './service';
import { connect } from '@gamecrafter/service-client';

const packageJson = JSON.parse(
  readFileSync(path.join(__dirname, '..', 'package.json'), 'utf8'),
) as {
  version: string;
};

async function main(): Promise<void> {
  const [command, ...args] = process.argv.slice(2);
  const paths = resolvePaths();

  switch (command) {
    case 'start':
      if (args.includes('--foreground')) {
        await runForeground(paths);
      } else {
        await startDetached(paths);
      }
      break;
    case 'status':
      showStatus(paths.lockPath);
      break;
    case 'stop':
      await stopService(paths);
      break;
    default:
      process.stderr.write('Usage: gamecrafter-service <start [--foreground]|status|stop>\n');
      process.exitCode = 2;
  }
}

async function runForeground(paths: ReturnType<typeof resolvePaths>): Promise<void> {
  mkdirSync(paths.profileDir, { recursive: true, mode: 0o700 });
  const lock = acquireLock(paths);
  enableFileLogging(paths.logDir);
  let service: PlatformService;
  let stopping = false;
  const shutdown = async (checkpoint = true) => {
    if (stopping) return;
    stopping = true;
    await service.stop(checkpoint);
    log('info', 'service_stopped', { pid: process.pid });
    lock.release();
  };
  try {
    service = await PlatformService.start({
      paths,
      platformVersion: packageJson.version,
      onStopRequested: () => {
        stopping = true;
        log('info', 'service_stopped', { pid: process.pid });
        lock.release();
        process.exit(0);
      },
    });
    log('info', 'service_started', {
      pid: process.pid,
      serviceVersion: packageJson.version,
      profileDir: paths.profileDir,
    });
  } catch (error) {
    lock.release();
    throw error;
  }

  await new Promise<void>((resolve) => {
    process.once('SIGINT', () => void shutdown().then(resolve));
    process.once('SIGTERM', () => void shutdown().then(resolve));
  });
}

async function startDetached(paths: ReturnType<typeof resolvePaths>): Promise<void> {
  mkdirSync(paths.profileDir, { recursive: true, mode: 0o700 });
  const child = spawn(process.execPath, [__filename, 'start', '--foreground'], {
    detached: true,
    stdio: 'ignore',
    env: process.env,
  });
  child.unref();

  // Fresh installed code/profile startup can exceed five seconds on Windows.
  const deadline = Date.now() + 30000;
  while (Date.now() < deadline) {
    const lock = readLock(paths.lockPath);
    if (lock && isProcessAlive(lock.pid) && (await probeSocket(lock.socketPath))) {
      process.stdout.write(`${lock.socketPath}\n`);
      return;
    }
    await delay(100);
  }
  throw new Error('Timed out waiting for PlayWeld service to start');
}

function showStatus(lockPath: string): void {
  const lock = readLock(lockPath);
  if (lock && isProcessAlive(lock.pid)) {
    process.stdout.write(`running pid=${lock.pid} socket=${lock.socketPath}\n`);
    return;
  }
  process.stdout.write('not running\n');
  process.exitCode = 3;
}

async function stopService(paths: ReturnType<typeof resolvePaths>): Promise<void> {
  const { lockPath, tokenPath } = paths;
  const lock = readLock(lockPath);
  if (!lock || !isProcessAlive(lock.pid)) {
    process.stdout.write('not running\n');
    process.exitCode = 3;
    return;
  }

  const client = await connect({
    socketPath: lock.socketPath,
    token: readFileSync(tokenPath, 'utf8').trim(),
    clientName: 'gamecrafter-service CLI',
    clientVersion: packageJson.version,
  });
  try {
    await client.call('service/stop', { checkpoint: true });
  } finally {
    client.close();
  }
  const deadline = Date.now() + 5000;
  while (Date.now() < deadline) {
    if (!existsSync(lockPath)) {
      process.stdout.write('stopped\n');
      return;
    }
    await delay(100);
  }
  throw new Error(`Timed out waiting for service lock to be removed: ${lockPath}`);
}

function probeSocket(socketPath: string): Promise<boolean> {
  return new Promise((resolve) => {
    const socket = net.connect(socketPath);
    const finish = (ready: boolean) => {
      socket.destroy();
      resolve(ready);
    };
    socket.once('connect', () => finish(true));
    socket.once('error', () => finish(false));
  });
}

void main().catch((error: unknown) => {
  log('error', error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});

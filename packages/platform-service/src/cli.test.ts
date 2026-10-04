import { spawn } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import { describe, expect, it } from 'vitest';
import { connect } from '@gamecrafter/service-client';
import { execCommand } from './processes/exec-command';

// Exercise the compiled CLI against a real daemon, including Windows where SIGTERM is not delivered.
describe('platform service CLI lifecycle', () => {
  it('stops through the service shutdown path and removes the lock', async () => {
    const root = mkdtempSync(path.join(tmpdir(), 'gc-cli-lifecycle-'));
    const cli = path.resolve(__dirname, '../lib/cli.js');
    const env = { ...process.env, GAMECRAFTER_PROFILE_DIR: root };
    const daemon = spawn(process.execPath, [cli, 'start', '--foreground'], {
      env,
      stdio: 'ignore',
      windowsHide: true,
    });
    const lockPath = path.join(root, 'service.lock');
    try {
      const deadline = Date.now() + 10000;
      while (!existsSync(path.join(root, 'service.token')) && Date.now() < deadline)
        await delay(50);
      expect(existsSync(lockPath)).toBe(true);
      const lock = JSON.parse(readFileSync(lockPath, 'utf8')) as { socketPath: string };
      while (true) {
        try {
          const client = await connect({
            socketPath: lock.socketPath,
            token: readFileSync(path.join(root, 'service.token'), 'utf8').trim(),
            clientName: 'cli-test',
            clientVersion: '0.1.0',
          });
          client.close();
          break;
        } catch (error) {
          if (Date.now() >= deadline) throw error;
          await delay(50);
        }
      }
      expect((await execCommand(process.execPath, [cli, 'status'], { env })).stdout).toContain(
        `running pid=${daemon.pid}`,
      );
      expect(
        (await execCommand(process.execPath, [cli, 'stop'], { env, timeout: 12000 })).stdout,
      ).toBe('stopped\n');
      expect(existsSync(lockPath)).toBe(false);
      const logEntries = readFileSync(path.join(root, 'logs', 'service.jsonl'), 'utf8')
        .trim()
        .split('\n')
        .map((line) => JSON.parse(line) as { msg: string });
      expect(logEntries.map((entry) => entry.msg)).toEqual(
        expect.arrayContaining(['service_started', 'service_stopped']),
      );
    } finally {
      daemon.kill('SIGKILL');
      await new Promise<void>((resolve) => {
        if (daemon.exitCode !== null || daemon.signalCode !== null) resolve();
        else daemon.once('close', () => resolve());
      });
      rmSync(root, { recursive: true, force: true });
    }
  }, 25000);
});

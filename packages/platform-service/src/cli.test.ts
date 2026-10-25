import { spawn } from 'node:child_process';
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import { describe, expect, it } from 'vitest';
import { connect } from '@gamecrafter/service-client';
import { execCommand } from './processes/exec-command';
import { Database } from './db/database';
import { migrate } from './db/migrator';
import { profileMigrations } from './profile/migrations';

// Exercise the compiled CLI against a real daemon, including Windows where SIGTERM is not delivered.
describe('platform service CLI lifecycle', () => {
  it('stops through the service shutdown path and removes the lock', async () => {
    const root = mkdtempSync(path.join(tmpdir(), 'gc-cli-lifecycle-'));
    const cli = path.resolve(__dirname, '../lib/cli.js');
    const env = { ...process.env, GAMECRAFTER_PROFILE_DIR: root };
    const logs = path.join(root, 'logs');
    mkdirSync(logs);
    const daysAgo = (days: number) => new Date(Date.now() - days * 86400000).toISOString();
    const line = (days: number, msg: string) =>
      JSON.stringify({ level: 'info', time: daysAgo(days), msg }) + '\n';
    writeFileSync(
      path.join(logs, 'service.jsonl'),
      line(400, 'expired_at_start') + line(60, 'saved_long_policy'),
    );
    writeFileSync(path.join(logs, 'service.1.jsonl'), line(400, 'expired_rotation'));
    writeFileSync(path.join(logs, 'keep.txt'), 'unrelated');
    const profile = Database.open(path.join(root, 'profile.sqlite'));
    try {
      migrate(profile, profileMigrations);
      profile
        .prepare('INSERT INTO settings_values(key,value,updated_at) VALUES (?,?,?)')
        .run('logs.retentionDays', '365', new Date().toISOString());
    } finally {
      profile.close();
    }
    const daemon = spawn(process.execPath, [cli, 'start', '--foreground'], {
      env,
      stdio: ['ignore', 'pipe', 'pipe'],
      windowsHide: true,
    });
    const startedAt = Date.now();
    let daemonStdout = '';
    let daemonStderr = '';
    daemon.stdout.on('data', (chunk: Buffer) => {
      daemonStdout = (daemonStdout + chunk.toString()).slice(-8192);
    });
    daemon.stderr.on('data', (chunk: Buffer) => {
      daemonStderr = (daemonStderr + chunk.toString()).slice(-8192);
    });
    const lockPath = path.join(root, 'service.lock');
    try {
      const deadline = Date.now() + 10000;
      while (!existsSync(path.join(root, 'service.token')) && Date.now() < deadline)
        await delay(50);
      expect(existsSync(lockPath)).toBe(true);
      const lock = JSON.parse(readFileSync(lockPath, 'utf8')) as { socketPath: string };
      let client: Awaited<ReturnType<typeof connect>>;
      while (true) {
        try {
          client = await connect({
            socketPath: lock.socketPath,
            token: readFileSync(path.join(root, 'service.token'), 'utf8').trim(),
            clientName: 'cli-test',
            clientVersion: '0.1.0',
          });
          break;
        } catch (error) {
          if (Date.now() >= deadline) throw error;
          await delay(50);
        }
      }
      try {
        const current = path.join(logs, 'service.jsonl');
        expect(readFileSync(current, 'utf8')).not.toContain('expired_at_start');
        expect(readFileSync(current, 'utf8')).toContain('saved_long_policy');
        expect(existsSync(path.join(logs, 'service.1.jsonl'))).toBe(false);
        await client.call('settings/set', {
          key: 'logs.retentionDays',
          scope: 'platform',
          value: 7,
        });
        expect(readFileSync(current, 'utf8')).not.toContain('saved_long_policy');
        writeFileSync(path.join(logs, 'service.1.jsonl'), line(40, 'reset_to_default'));
        await client.call('settings/set', {
          key: 'logs.retentionDays',
          scope: 'platform',
          value: null,
        });
        expect(existsSync(path.join(logs, 'service.1.jsonl'))).toBe(false);
        expect(readFileSync(path.join(logs, 'keep.txt'), 'utf8')).toBe('unrelated');
      } finally {
        client.close();
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
    } catch (error) {
      const readDiagnosticFile = (file: string): string => {
        try {
          return readFileSync(file, 'utf8').slice(-8192);
        } catch {
          return '[unavailable]';
        }
      };
      const token = readDiagnosticFile(path.join(root, 'service.token')).trim();
      const redact = (value: string): string =>
        token && token !== '[unavailable]' ? value.replaceAll(token, '[redacted token]') : value;
      const diagnostics = {
        originalError: redact(
          error instanceof Error ? (error.stack ?? error.message) : String(error),
        ).slice(-8192),
        elapsedMs: Date.now() - startedAt,
        daemonExitCode: daemon.exitCode,
        daemonSignalCode: daemon.signalCode,
        lockExists: existsSync(lockPath),
        tokenExists: existsSync(path.join(root, 'service.token')),
        stdout: redact(daemonStdout),
        stderr: redact(daemonStderr),
        serviceLog: redact(readDiagnosticFile(path.join(root, 'logs', 'service.jsonl'))),
      };
      throw new Error(
        `CLI lifecycle failed: ${redact(error instanceof Error ? error.message : String(error))}\n${JSON.stringify(diagnostics, null, 2)}`,
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
  it('releases its process lock if the log directory is redirected', async () => {
    const root = mkdtempSync(path.join(tmpdir(), 'gc-cli-log-path-'));
    const target = path.join(root, 'outside');
    mkdirSync(target);
    symlinkSync(target, path.join(root, 'logs'), 'junction');
    const cli = path.resolve(__dirname, '../lib/cli.js');
    try {
      await expect(
        execCommand(process.execPath, [cli, 'start', '--foreground'], {
          env: { ...process.env, GAMECRAFTER_PROFILE_DIR: root },
          timeout: 10000,
        }),
      ).rejects.toThrow();
      expect(existsSync(path.join(root, 'service.lock'))).toBe(false);
      expect(existsSync(path.join(target, 'service.jsonl'))).toBe(false);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
  it('persists a startup failure before disposing the logger', async () => {
    const root = mkdtempSync(path.join(tmpdir(), 'gc-cli-startup-failure-'));
    writeFileSync(path.join(root, 'profile.sqlite'), 'not a SQLite database');
    const cli = path.resolve(__dirname, '../lib/cli.js');
    try {
      await expect(
        execCommand(process.execPath, [cli, 'start', '--foreground'], {
          env: { ...process.env, GAMECRAFTER_PROFILE_DIR: root },
          timeout: 10000,
        }),
      ).rejects.toThrow();
      expect(existsSync(path.join(root, 'service.lock'))).toBe(false);
      const rows = readFileSync(path.join(root, 'logs/service.jsonl'), 'utf8')
        .trim()
        .split('\n')
        .map((line) => JSON.parse(line));
      expect(rows.some((row) => row.level === 'error' && typeof row.msg === 'string')).toBe(true);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});

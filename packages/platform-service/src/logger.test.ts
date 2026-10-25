import {
  existsSync,
  linkSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  renameSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { expect, it, vi } from 'vitest';
import { enableFileLogging, log, setFileLogRetentionDays } from './logger';

it('persists redacted structured logs and bounds the rotated log history', () => {
  const directory = mkdtempSync(path.join(tmpdir(), 'playweld-logs-'));
  const restore = enableFileLogging(directory);
  const stderr = vi.spyOn(process.stderr, 'write').mockReturnValue(true);
  try {
    log('warn', 'resource_lock_conflict', { taskId: 'task', token: 'private-token' });
    const first = readFileSync(path.join(directory, 'service.jsonl'), 'utf8');
    expect(first).not.toContain('private-token');
    expect(JSON.parse(first)).toMatchObject({
      level: 'warn',
      msg: 'resource_lock_conflict',
      taskId: 'task',
    });
    writeFileSync(path.join(directory, 'service.jsonl'), 'x'.repeat(5 * 1024 * 1024));
    writeFileSync(path.join(directory, 'service.1.jsonl'), 'previous rotation');
    log('info', 'after_rotation');
    expect(readFileSync(path.join(directory, 'service.1.jsonl'), 'utf8').length).toBe(
      5 * 1024 * 1024,
    );
    expect(JSON.parse(readFileSync(path.join(directory, 'service.jsonl'), 'utf8')).msg).toBe(
      'after_rotation',
    );
  } finally {
    stderr.mockRestore();
    restore();
    rmSync(directory, { recursive: true, force: true });
  }
});

vi.mock('node:fs', async (importOriginal) => {
  const actual = await importOriginal<typeof import('node:fs')>();
  return { ...actual, renameSync: vi.fn(actual.renameSync) };
});

const entry = (time: string, msg = 'fixture') =>
  JSON.stringify({ level: 'info', time, msg }) + '\n';
it('prunes only expired structured entries while preserving cutoff, future and malformed evidence', () => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date('2026-10-24T12:00:00.000Z'));
  const directory = mkdtempSync(path.join(tmpdir(), 'playweld-retention-'));
  const restore = enableFileLogging(directory),
    stderr = vi.spyOn(process.stderr, 'write').mockReturnValue(true);
  try {
    const current = path.join(directory, 'service.jsonl'),
      rotated = path.join(directory, 'service.1.jsonl');
    const kept =
      entry('2026-10-17T12:00:00.000Z', 'boundary') +
      entry('2026-10-25T12:00:00.000Z', 'future') +
      'malformed\r\n' +
      JSON.stringify({ time: '2020-01-01T00:00:00.000Z', unknown: true }) +
      '\n';
    writeFileSync(current, entry('2020-01-01T00:00:00.000Z') + kept);
    writeFileSync(rotated, entry('2020-01-01T00:00:00.000Z'));
    writeFileSync(path.join(directory, 'other.jsonl'), 'unrelated');
    setFileLogRetentionDays(7);
    expect(readFileSync(current, 'utf8')).toBe(kept);
    expect(existsSync(rotated)).toBe(false);
    expect(readFileSync(path.join(directory, 'other.jsonl'), 'utf8')).toBe('unrelated');
    log('info', 'after_cleanup', { token: 'do-not-persist' });
    expect(readFileSync(current, 'utf8')).not.toContain('do-not-persist');
    expect(readFileSync(current, 'utf8')).toContain('after_cleanup');
  } finally {
    restore();
    stderr.mockRestore();
    vi.useRealTimers();
    rmSync(directory, { recursive: true, force: true });
  }
});
it('prunes quiet logs every minute, adopts policy changes and stops its timer on disposal', () => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date('2026-10-24T12:00:00.000Z'));
  const directory = mkdtempSync(path.join(tmpdir(), 'playweld-retention-'));
  const restore = enableFileLogging(directory),
    stderr = vi.spyOn(process.stderr, 'write').mockReturnValue(true);
  try {
    const file = path.join(directory, 'service.jsonl');
    writeFileSync(file, entry('2026-10-01T00:00:00.000Z'));
    setFileLogRetentionDays(365);
    expect(existsSync(file)).toBe(true);
    expect(() => setFileLogRetentionDays(0)).toThrow();
    expect(existsSync(file)).toBe(true);
    setFileLogRetentionDays(30);
    expect(existsSync(file)).toBe(true);
    writeFileSync(file, entry('2020-01-01T00:00:00.000Z'));
    vi.advanceTimersByTime(60000);
    expect(existsSync(file)).toBe(false);
    writeFileSync(file, entry('2026-10-01T00:00:00.000Z'));
    setFileLogRetentionDays(7);
    expect(existsSync(file)).toBe(false);
    restore();
    writeFileSync(file, entry('2020-01-01T00:00:00.000Z'));
    vi.advanceTimersByTime(60000);
    expect(existsSync(file)).toBe(true);
  } finally {
    restore();
    stderr.mockRestore();
    vi.useRealTimers();
    rmSync(directory, { recursive: true, force: true });
  }
});
it('does not follow hard-linked log files for pruning or append', () => {
  const directory = mkdtempSync(path.join(tmpdir(), 'playweld-retention-links-'));
  const outside = path.join(directory, 'outside.jsonl'),
    logs = path.join(directory, 'logs');
  mkdirSync(logs);
  const original = entry('2020-01-01T00:00:00.000Z');
  writeFileSync(outside, original);
  linkSync(outside, path.join(logs, 'service.jsonl'));
  const restore = enableFileLogging(logs),
    stderr = vi.spyOn(process.stderr, 'write').mockReturnValue(true);
  try {
    setFileLogRetentionDays(7);
    log('warn', 'must_fall_back');
    expect(readFileSync(outside, 'utf8')).toBe(original);
    expect(stderr).toHaveBeenCalledWith(expect.stringContaining('must_fall_back'));
  } finally {
    restore();
    stderr.mockRestore();
    rmSync(directory, { recursive: true, force: true });
  }
});
it('rejects a redirected log directory without touching its target', () => {
  const directory = mkdtempSync(path.join(tmpdir(), 'playweld-retention-dir-'));
  const target = path.join(directory, 'target'),
    redirect = path.join(directory, 'logs');
  mkdirSync(target);
  symlinkSync(target, redirect, 'junction');
  try {
    expect(() => enableFileLogging(redirect)).toThrow();
    expect(existsSync(path.join(target, 'service.jsonl'))).toBe(false);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

it('preserves invalid UTF-8 and noncanonical timestamps byte for byte during compaction', () => {
  const directory = mkdtempSync(path.join(tmpdir(), 'playweld-retention-bytes-'));
  const restore = enableFileLogging(directory),
    stderr = vi.spyOn(process.stderr, 'write').mockReturnValue(true);
  try {
    const file = path.join(directory, 'service.jsonl');
    const unknown = Buffer.concat([
      Buffer.from('{"level":"info","time":"2020-01-01T00:00:00.000Z","msg":"'),
      Buffer.from([0xff]),
      Buffer.from('"}\n'),
      Buffer.from(entry('2020', 'noncanonical')),
      Buffer.from(
        JSON.stringify({
          level: ['info'],
          time: '2020-01-01T00:00:00.000Z',
          msg: 'unknown level shape',
        }) + '\n',
      ),
    ]);
    writeFileSync(file, Buffer.concat([Buffer.from(entry('2020-01-01T00:00:00.000Z')), unknown]));
    setFileLogRetentionDays(7);
    expect(readFileSync(file)).toEqual(unknown);
  } finally {
    restore();
    stderr.mockRestore();
    rmSync(directory, { recursive: true, force: true });
  }
});

it('preserves the original and removes its private temporary file if atomic replacement fails', () => {
  const directory = mkdtempSync(path.join(tmpdir(), 'playweld-retention-failure-'));
  const restore = enableFileLogging(directory),
    stderr = vi.spyOn(process.stderr, 'write').mockReturnValue(true);
  const original = entry('2020-01-01T00:00:00.000Z') + 'malformed\n';
  const file = path.join(directory, 'service.jsonl');
  writeFileSync(file, original);
  const rename = vi.mocked(renameSync).mockImplementationOnce(() => {
    throw new Error('fixture rename failure');
  });
  try {
    setFileLogRetentionDays(7);
    expect(readFileSync(file, 'utf8')).toBe(original);
    expect(readdirSync(directory)).toEqual(['service.jsonl']);
    expect(stderr).toHaveBeenCalledWith(expect.stringContaining('could not prune'));
  } finally {
    rename.mockClear();
    restore();
    stderr.mockRestore();
    rmSync(directory, { recursive: true, force: true });
  }
});

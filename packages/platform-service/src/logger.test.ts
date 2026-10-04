import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { expect, it, vi } from 'vitest';
import { enableFileLogging, log } from './logger';

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

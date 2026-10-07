import { EventEmitter } from 'node:events';
import { PassThrough } from 'node:stream';
import { afterEach, expect, it, vi } from 'vitest';
import spawn from 'cross-spawn';
import { dpapi } from './editor-bridge-tools';

vi.mock('cross-spawn', () => ({ default: vi.fn() }));
const originalPlatform = process.platform;
afterEach(() => {
  Object.defineProperty(process, 'platform', { value: originalPlatform });
  vi.useRealTimers();
  vi.resetAllMocks();
});
function fixture() {
  Object.defineProperty(process, 'platform', { value: 'win32' });
  vi.useFakeTimers();
  const child = Object.assign(new EventEmitter(), {
    stdout: new PassThrough(),
    stderr: new PassThrough(),
    stdin: Object.assign(new PassThrough(), { end: vi.fn() }),
    kill: vi.fn(() => {
      child.emit('close', null);
      return true;
    }),
  });
  vi.mocked(spawn).mockReturnValue(child as unknown as ReturnType<typeof spawn>);
  return child;
}
it('passes sensitive bytes only on stdin and clears its deadline after success', async () => {
  const child = fixture();
  const value = Buffer.from('private-input-marker');
  const promise = dpapi(value, false, new AbortController().signal);
  expect(child.stdin.end).toHaveBeenCalledWith(value.toString('base64'));
  expect(JSON.stringify(vi.mocked(spawn).mock.calls)).not.toContain(value.toString('base64'));
  expect(vi.mocked(spawn).mock.calls[0]?.[2]).toMatchObject({ stdio: ['pipe', 'pipe', 'pipe'] });
  expect(child.stderr.readableFlowing).toBe(true);
  child.stdout.emit('data', Buffer.from(Buffer.from('protected-output').toString('base64')));
  child.emit('close', 0);
  await expect(promise).resolves.toEqual(Buffer.from('protected-output'));
  expect(vi.getTimerCount()).toBe(0);
});
it('allows cold startup beyond ten seconds but enforces a bounded redacted deadline', async () => {
  const child = fixture();
  let settled = false;
  const result = dpapi(
    Buffer.from('private-input-marker'),
    false,
    new AbortController().signal,
  ).then(
    () => {
      settled = true;
      return '';
    },
    (error) => {
      settled = true;
      return String(error.message);
    },
  );
  await vi.advanceTimersByTimeAsync(10000);
  expect(settled).toBe(false);
  expect(child.kill).not.toHaveBeenCalled();
  await vi.advanceTimersByTimeAsync(20000);
  expect(await result).toBe('Editor credential helper timed out after 30000ms.');
  expect(child.kill).toHaveBeenCalledOnce();
});
it('cancels promptly and reports process failure without child diagnostics or key material', async () => {
  const child = fixture();
  const controller = new AbortController();
  const result = dpapi(Buffer.from('private-input-marker'), true, controller.signal).catch(
    (error) => String(error.message),
  );
  controller.abort();
  expect(await result).toBe('Editor credential operation cancelled.');
  expect(child.kill).toHaveBeenCalledOnce();
  const failed = fixture();
  const failure = dpapi(
    Buffer.from('private-input-marker'),
    true,
    new AbortController().signal,
  ).catch((error) => String(error.message));
  failed.emit('close', 1);
  expect(await failure).toBe('Editor credential protection operation failed (exit=1).');
  expect(vi.getTimerCount()).toBe(0);
});

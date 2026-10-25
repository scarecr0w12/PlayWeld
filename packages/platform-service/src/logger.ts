import {
  appendFileSync,
  closeSync,
  constants,
  fstatSync,
  fsyncSync,
  lstatSync,
  mkdirSync,
  openSync,
  readFileSync,
  realpathSync,
  renameSync,
  unlinkSync,
  writeFileSync,
  type Stats,
} from 'node:fs';
import { randomUUID } from 'node:crypto';
import path from 'node:path';
import { redact } from '@gamecrafter/contracts';

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';
const maxLogBytes = 5 * 1024 * 1024;
interface FileLogging {
  directory: string;
  realDirectory: string;
  retentionDays?: number;
  timer?: ReturnType<typeof setInterval>;
}
let fileLogging: FileLogging | undefined;
const noFollow = constants.O_NOFOLLOW ?? 0;

function checkDirectory(state: FileLogging): void {
  const info = lstatSync(state.directory);
  if (
    !info.isDirectory() ||
    info.isSymbolicLink() ||
    realpathSync(state.directory) !== state.realDirectory
  )
    throw new Error('Service log directory is redirected or unavailable.');
}
function checkFile(file: string): Stats | undefined {
  try {
    const info = lstatSync(file);
    if (!info.isFile() || info.isSymbolicLink() || info.nlink !== 1)
      throw new Error('Service log is not an unshared regular file.');
    return info;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return undefined;
    throw error;
  }
}
function unchanged(file: string, expected: Stats): void {
  const actual = checkFile(file);
  if (
    !actual ||
    actual.dev !== expected.dev ||
    actual.ino !== expected.ino ||
    actual.size !== expected.size ||
    actual.mtimeMs !== expected.mtimeMs
  )
    throw new Error('Service log changed during cleanup.');
}
function prune(state: FileLogging): void {
  if (state.retentionDays === undefined) return;
  const cutoff = Date.now() - state.retentionDays * 86400000;
  if (!Number.isFinite(cutoff)) return;
  for (const name of ['service.jsonl', 'service.1.jsonl']) {
    let temporary: string | undefined;
    try {
      checkDirectory(state);
      const file = path.join(state.directory, name),
        info = checkFile(file);
      if (!info) continue;
      // Normal files are capped at 5 MiB. Preserve unexpectedly oversized external input.
      if (info.size > maxLogBytes * 2) throw new Error('Service log exceeds cleanup read limit.');
      const fd = openSync(file, constants.O_RDONLY | noFollow);
      let content: Buffer;
      try {
        const opened = fstatSync(fd);
        if (
          !opened.isFile() ||
          opened.nlink !== 1 ||
          opened.size > maxLogBytes * 2 ||
          opened.dev !== info.dev ||
          opened.ino !== info.ino
        )
          throw new Error('Service log changed before read.');
        content = readFileSync(fd);
      } finally {
        closeSync(fd);
      }
      let removed = 0;
      const lines: Buffer[] = [];
      for (let start = 0; start < content.length;) {
        if (lines.length >= 100_000) throw new Error('Service log exceeds cleanup line limit.');
        const newline = content.indexOf(10, start);
        const end = newline < 0 ? content.length : newline + 1;
        lines.push(content.subarray(start, end));
        start = end;
      }
      const kept = Buffer.concat(
        lines.filter((line) => {
          try {
            const text = line.toString('utf8');
            if (!Buffer.from(text, 'utf8').equals(line)) return true;
            const value: unknown = JSON.parse(text);
            if (!value || typeof value !== 'object') return true;
            const row = value as Record<string, unknown>;
            if (
              typeof row.time !== 'string' ||
              typeof row.msg !== 'string' ||
              typeof row.level !== 'string' ||
              !['debug', 'info', 'warn', 'error'].includes(row.level)
            )
              return true;
            const time = Date.parse(row.time);
            // Only the canonical timestamps produced by this logger authorize age deletion.
            if (
              Number.isFinite(time) &&
              new Date(time).toISOString() === row.time &&
              time < cutoff
            ) {
              removed++;
              return false;
            }
          } catch {
            /* Unknown/truncated evidence is retained byte for byte. */
          }
          return true;
        }),
      );
      if (!removed) continue;
      checkDirectory(state);
      unchanged(file, info);
      if (!kept.length) {
        unlinkSync(file);
        continue;
      }
      temporary = path.join(state.directory, `.service-prune-${randomUUID()}.tmp`);
      const output = openSync(
        temporary,
        constants.O_WRONLY | constants.O_CREAT | constants.O_EXCL | noFollow,
        0o600,
      );
      try {
        writeFileSync(output, kept, 'utf8');
        fsyncSync(output);
      } finally {
        closeSync(output);
      }
      checkDirectory(state);
      unchanged(file, info);
      renameSync(temporary, file);
      temporary = undefined;
    } catch {
      process.stderr.write(
        'PlayWeld could not prune a service log file; existing evidence was preserved.\n',
      );
    } finally {
      if (temporary)
        try {
          checkDirectory(state);
          unlinkSync(temporary);
        } catch {
          /* Best effort private temporary-file cleanup. */
        }
    }
  }
}

// Configure in the owning CLI process, not in embedded/test service instances.
// Age pruning stays disabled until the persisted platform setting has been loaded.
export function enableFileLogging(logDir: string): () => void {
  mkdirSync(logDir, { recursive: true, mode: 0o700 });
  const state: FileLogging = {
    directory: path.resolve(logDir),
    realDirectory: realpathSync(logDir),
  };
  checkDirectory(state);
  const previous = fileLogging;
  fileLogging = state;
  let disposed = false;
  return () => {
    if (disposed) return;
    disposed = true;
    clearInterval(state.timer);
    if (fileLogging === state) fileLogging = previous;
  };
}

export function setFileLogRetentionDays(days: number): void {
  if (!Number.isFinite(days) || !Number.isInteger(days) || days < 1)
    throw new Error('Service log retention must be a positive integer number of days.');
  const state = fileLogging;
  if (!state) return;
  state.retentionDays = days;
  prune(state);
  state.timer ??= setInterval(() => prune(state), 60_000);
  state.timer.unref();
}

export function log(level: LogLevel, msg: string, fields: Record<string, unknown> = {}): void {
  const line = `${JSON.stringify(redact({ ...fields, level, time: new Date().toISOString(), msg }))}\n`;
  if (fileLogging) {
    try {
      const state = fileLogging;
      checkDirectory(state);
      const file = path.join(state.directory, 'service.jsonl'),
        info = checkFile(file);
      if (info && info.size + Buffer.byteLength(line) > maxLogBytes) {
        const rotated = path.join(state.directory, 'service.1.jsonl');
        if (checkFile(rotated)) unlinkSync(rotated);
        renameSync(file, rotated);
      }
      const fd = openSync(
        file,
        constants.O_WRONLY | constants.O_CREAT | constants.O_APPEND | noFollow,
        0o600,
      );
      try {
        const opened = fstatSync(fd);
        if (!opened.isFile() || opened.nlink !== 1) throw new Error('Service log is shared.');
        appendFileSync(fd, line, 'utf8');
      } finally {
        closeSync(fd);
      }
    } catch {
      process.stderr.write('PlayWeld could not persist a service log entry.\n');
    }
  }
  process.stderr.write(line);
}

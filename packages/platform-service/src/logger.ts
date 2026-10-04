import { appendFileSync, existsSync, mkdirSync, renameSync, statSync, unlinkSync } from 'node:fs';
import path from 'node:path';
import { redact } from '@gamecrafter/contracts';

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';
const maxLogBytes = 5 * 1024 * 1024;
let logFile: string | undefined;

// Configure in the owning CLI process, not in embedded/test service instances.
export function enableFileLogging(logDir: string): () => void {
  mkdirSync(logDir, { recursive: true, mode: 0o700 });
  const previous = logFile;
  logFile = path.join(logDir, 'service.jsonl');
  return () => {
    logFile = previous;
  };
}

export function log(level: LogLevel, msg: string, fields: Record<string, unknown> = {}): void {
  const line = `${JSON.stringify(redact({ ...fields, level, time: new Date().toISOString(), msg }))}\n`;
  if (logFile) {
    try {
      if (existsSync(logFile) && statSync(logFile).size + Buffer.byteLength(line) > maxLogBytes) {
        const rotated = path.join(path.dirname(logFile), 'service.1.jsonl');
        if (existsSync(rotated)) unlinkSync(rotated);
        renameSync(logFile, rotated);
      }
      appendFileSync(logFile, line, { encoding: 'utf8', mode: 0o600 });
    } catch {
      process.stderr.write('PlayWeld could not persist a service log entry.\n');
    }
  }
  process.stderr.write(line);
}

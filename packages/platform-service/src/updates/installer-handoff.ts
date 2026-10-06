#!/usr/bin/env node
import { createHash } from 'node:crypto';
import { spawn } from 'node:child_process';
import {
  closeSync,
  existsSync,
  mkdirSync,
  openSync,
  readFileSync,
  readSync,
  realpathSync,
  unlinkSync,
  writeFileSync,
} from 'node:fs';
import path from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';

interface Handoff {
  schemaVersion: 1;
  path: string;
  sha256: string;
  version: string;
  createdAt: string;
  phase: 'prepared' | 'waiting' | 'launched' | 'expired' | 'failed';
  helperPid?: number;
  installerPid?: number;
  error?: string;
}

export function verifyInstallerBytes(file: string, expected: string): void {
  const descriptor = openSync(file, 'r');
  const buffer = Buffer.alloc(1024 * 1024);
  const hash = createHash('sha256');
  try {
    let bytes: number;
    while ((bytes = readSync(descriptor, buffer)) !== 0) hash.update(buffer.subarray(0, bytes));
  } finally {
    closeSync(descriptor);
  }
  if (hash.digest('hex') !== expected)
    throw new Error('Verified installer bytes have changed. Download the package again.');
}

export function prepareInstallerHandoff(
  directory: string,
  installer: { path: string; sha256: string; version: string },
): { descriptorPath: string; version: string } {
  const root = realpathSync(directory),
    file = realpathSync(installer.path);
  const relative = path.relative(root, file);
  if (
    relative.startsWith(`..${path.sep}`) ||
    relative === '..' ||
    path.isAbsolute(relative) ||
    path.extname(file).toLowerCase() !== '.exe'
  )
    throw new Error('Installer must be an owned Windows update package.');
  if (!/^[a-f0-9]{64}$/.test(installer.sha256)) throw new Error('Installer digest is required.');
  verifyInstallerBytes(file, installer.sha256);
  const descriptors = path.join(root, 'handoffs');
  mkdirSync(descriptors, { recursive: true });
  const descriptorPath = path.join(descriptors, installer.sha256 + '.json');
  if (existsSync(descriptorPath)) {
    const previous = JSON.parse(readFileSync(descriptorPath, 'utf8')) as Handoff;
    if (
      (previous.phase === 'prepared' || previous.phase === 'waiting') &&
      Date.now() - Date.parse(previous.createdAt) < 600000
    )
      return { descriptorPath, version: installer.version };
  }
  const record: Handoff = {
    schemaVersion: 1,
    ...installer,
    path: file,
    createdAt: new Date().toISOString(),
    phase: 'prepared',
  };
  writeFileSync(descriptorPath, JSON.stringify(record, null, 2), { mode: 0o600 });
  return { descriptorPath, version: installer.version };
}

const alive = (pid: number) => {
  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    return (error as NodeJS.ErrnoException).code !== 'ESRCH';
  }
};

export async function runInstallerHandoff(descriptorPath: string, waitPid: number): Promise<void> {
  if (process.platform !== 'win32')
    throw new Error('Automatic installer handoff requires Windows.');
  if (!Number.isInteger(waitPid) || waitPid < 1 || waitPid === process.pid)
    throw new Error('A valid desktop process PID is required.');
  descriptorPath = realpathSync(descriptorPath);
  const record = JSON.parse(readFileSync(descriptorPath, 'utf8')) as Handoff;
  if (
    record.schemaVersion !== 1 ||
    typeof record.path !== 'string' ||
    typeof record.version !== 'string' ||
    typeof record.createdAt !== 'string' ||
    !Number.isFinite(Date.parse(record.createdAt)) ||
    Date.parse(record.createdAt) > Date.now() + 60000 ||
    !/^[a-f0-9]{64}$/.test(record.sha256) ||
    !['prepared', 'waiting'].includes(record.phase)
  )
    throw new Error('Invalid prepared installer handoff.');
  const updateRoot = realpathSync(path.dirname(path.dirname(descriptorPath)));
  const file = realpathSync(record.path),
    relative = path.relative(updateRoot, file);
  if (
    path.basename(path.dirname(descriptorPath)) !== 'handoffs' ||
    relative === '..' ||
    relative.startsWith(`..${path.sep}`) ||
    path.isAbsolute(relative) ||
    path.extname(file).toLowerCase() !== '.exe'
  )
    throw new Error('Installer is outside the update package cache.');
  const lease = descriptorPath + '.lock';
  if (existsSync(lease)) {
    const holder = Number(readFileSync(lease, 'utf8'));
    if (Number.isInteger(holder) && holder > 0 && alive(holder)) return;
    unlinkSync(lease);
  }
  try {
    writeFileSync(lease, String(process.pid), { flag: 'wx', mode: 0o600 });
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'EEXIST') return;
    throw error;
  }
  const save = () => writeFileSync(descriptorPath, JSON.stringify(record, null, 2));
  try {
    record.phase = 'waiting';
    record.helperPid = process.pid;
    save();
    const deadline = Date.parse(record.createdAt) + 600000;
    while (alive(waitPid)) {
      if (Date.now() > deadline) {
        record.phase = 'expired';
        save();
        return;
      }
      await delay(250);
    }
    verifyInstallerBytes(file, record.sha256);
    const installer = spawn(file, [], { detached: true, windowsHide: true, stdio: 'ignore' });
    await new Promise<void>((resolve, reject) => {
      installer.once('spawn', resolve);
      installer.once('error', reject);
    });
    installer.unref();
    record.phase = 'launched';
    record.installerPid = installer.pid;
    save();
  } catch (error) {
    record.phase = 'failed';
    record.error = error instanceof Error ? error.message : 'Installer handoff failed.';
    save();
    throw error;
  } finally {
    if (existsSync(lease) && readFileSync(lease, 'utf8') === String(process.pid)) unlinkSync(lease);
  }
}

if (require.main === module)
  void runInstallerHandoff(process.argv[2] ?? '', Number(process.argv[3])).catch(() => {
    process.exitCode = 1;
  });

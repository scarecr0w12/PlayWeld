import { spawn, spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import { expect, it } from 'vitest';
import { prepareInstallerHandoff } from './installer-handoff';

it('detects modified packages and confines handoff to the owned update cache', () => {
  const root = mkdtempSync(path.join(tmpdir(), 'playweld-handoff-hash-'));
  try {
    const file = path.join(root, 'fixture.exe');
    writeFileSync(file, 'original');
    const sha256 = createHash('sha256').update('original').digest('hex');
    const prepared = prepareInstallerHandoff(root, { path: file, sha256, version: '0.15.0' });
    expect(prepareInstallerHandoff(root, { path: file, sha256, version: '0.15.0' })).toEqual(
      prepared,
    );
    writeFileSync(file, 'tampered');
    expect(() => prepareInstallerHandoff(root, { path: file, sha256, version: '0.15.0' })).toThrow(
      /changed/,
    );
    expect(() =>
      prepareInstallerHandoff(path.dirname(file), { path: __filename, sha256, version: '0.15.0' }),
    ).toThrow(/owned Windows/);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

it.skipIf(process.platform !== 'win32').each([false, true])(
  'waits for the owned desktop process and refuses modified installer bytes=%s',
  async (tamper) => {
    const artifactRoot = path.resolve(__dirname, '../../../../.artifacts/installer-handoff-tests');
    mkdirSync(artifactRoot, { recursive: true });
    const root = mkdtempSync(path.join(artifactRoot, 'native-'));
    const compiler = path.join(
      process.env.SystemRoot ?? 'C:/Windows',
      'Microsoft.NET/Framework64/v4.0.30319/csc.exe',
    );
    const source = path.join(root, 'Installer.cs'),
      file = path.join(root, 'fixture.exe'),
      marker = path.join(root, 'installer-ran.txt');
    writeFileSync(
      source,
      'using System; using System.IO; using System.Reflection; class Installer { static void Main() { File.WriteAllText(Path.Combine(Path.GetDirectoryName(Assembly.GetExecutingAssembly().Location),"installer-ran.txt"),"owned fixture launched"); } }',
    );
    const compiled = spawnSync(compiler, ['/nologo', '/target:exe', '/out:' + file, source], {
      encoding: 'utf8',
      windowsHide: true,
    });
    expect(compiled.status, compiled.stdout + compiled.stderr).toBe(0);
    const sha256 = createHash('sha256').update(readFileSync(file)).digest('hex');
    const prepared = prepareInstallerHandoff(root, { path: file, sha256, version: '0.15.0' });
    const waiter = spawn(process.execPath, ['-e', 'setTimeout(()=>{},30000)'], {
      windowsHide: true,
      stdio: 'ignore',
    });
    const helper = spawn(
      process.execPath,
      [
        path.resolve(__dirname, '../../lib/updates/installer-handoff.js'),
        prepared.descriptorPath,
        String(waiter.pid),
      ],
      { windowsHide: true, stdio: 'ignore' },
    );
    const finished = new Promise<number | null>((resolve, reject) => {
      helper.once('close', resolve);
      helper.once('error', reject);
    });
    const state = () =>
      JSON.parse(readFileSync(prepared.descriptorPath, 'utf8')) as {
        phase: string;
        installerPid?: number;
      };
    try {
      for (let attempt = 0; attempt < 100 && state().phase !== 'waiting'; attempt++)
        await delay(50);
      expect(state().phase).toBe('waiting');
      expect(existsSync(marker)).toBe(false);
      if (tamper) writeFileSync(file, 'tampered bytes');
      waiter.kill();
      expect(await finished).toBe(tamper ? 1 : 0);
      expect(state().phase).toBe(tamper ? 'failed' : 'launched');
      if (!tamper) {
        for (let attempt = 0; attempt < 100 && !existsSync(marker); attempt++) await delay(50);
        expect(readFileSync(marker, 'utf8')).toBe('owned fixture launched');
        for (let attempt = 0; attempt < 100; attempt++) {
          try {
            process.kill(state().installerPid!, 0);
          } catch {
            break;
          }
          await delay(50);
        }
      } else expect(existsSync(marker)).toBe(false);
      expect(existsSync(prepared.descriptorPath + '.lock')).toBe(false);
    } finally {
      waiter.kill();
      helper.kill();
    }
  },
  30000,
);

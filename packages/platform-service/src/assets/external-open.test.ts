import { EventEmitter } from 'node:events';
import { mkdtempSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { RpcErrorCode } from '@gamecrafter/contracts';
import { openInAuthoringTool } from './external-open';

const { spawn } = vi.hoisted(() => ({ spawn: vi.fn() }));
vi.mock('cross-spawn', () => ({ default: spawn }));

const originalPlatform = process.platform;
let project: string;
let child: EventEmitter & { unref: ReturnType<typeof vi.fn>; kill: ReturnType<typeof vi.fn> };

beforeEach(() => {
  project = realpathSync(mkdtempSync(path.join(tmpdir(), 'gc-open-')));
  child = Object.assign(new EventEmitter(), { unref: vi.fn(), kill: vi.fn() });
  spawn.mockImplementation(() => {
    queueMicrotask(() => {
      child.emit('spawn');
      child.emit('close', 0);
    });
    return child;
  });
});

afterEach(() => {
  vi.useRealTimers();
  Object.defineProperty(process, 'platform', { value: originalPlatform });
  vi.clearAllMocks();
  rmSync(project, { recursive: true, force: true });
});

describe('authoring tool process boundary', () => {
  it.each([
    'art&sample.png',
    "art'%PATH%!^(sample).png",
    "literal&'%GC_OPEN_TEST%^!(asset).png",
    'asset with spaces 日本語.png',
  ])('opens Windows filename %s as data without adding it to command text', async (filename) => {
    Object.defineProperty(process, 'platform', { value: 'win32' });
    writeFileSync(path.join(project, filename), 'asset');
    await expect(openInAuthoringTool(project, filename, '')).resolves.toMatchObject({
      launched: true,
    });
    const [executable, args, options] = spawn.mock.calls[0]!;
    expect(path.win32.basename(executable).toLowerCase()).toBe('powershell.exe');
    expect(args).toEqual([
      '-NoProfile',
      '-NonInteractive',
      '-Command',
      "$ErrorActionPreference = 'Stop'; Invoke-Item -LiteralPath $env:GAMECRAFTER_ASSET_OPEN_PATH",
    ]);
    expect(args.join(' ')).not.toContain(project);
    expect(args.join(' ')).not.toContain(filename);
    expect(options.env.GAMECRAFTER_ASSET_OPEN_PATH).toBe(
      realpathSync(path.join(project, filename)),
    );
    expect(options.shell).toBe(false);
  });

  it.each([
    ['darwin', 'open'],
    ['linux', 'xdg-open'],
  ])('retains the %s native default', async (platform, executable) => {
    Object.defineProperty(process, 'platform', { value: platform });
    writeFileSync(path.join(project, 'asset.png'), 'asset');
    await openInAuthoringTool(project, 'asset.png', '   ');
    expect(spawn.mock.calls[0]!.slice(0, 2)).toEqual([
      executable,
      [realpathSync(path.join(project, 'asset.png'))],
    ]);
  });

  it('preserves a configured executable and fixed arguments with a literal filename', async () => {
    writeFileSync(path.join(project, 'asset&sample.png'), 'asset');
    const command = '"C:/Authoring Tools/editor.exe" --workspace "My Project"';
    await expect(openInAuthoringTool(project, 'asset&sample.png', command)).resolves.toEqual({
      launched: true,
      command: 'editor.exe (3 args)',
    });
    expect(spawn.mock.calls[0]!.slice(0, 2)).toEqual([
      'C:/Authoring Tools/editor.exe',
      ['--workspace', 'My Project', realpathSync(path.join(project, 'asset&sample.png'))],
    ]);
  });

  it.each(['../outside.png', 'missing.png'])(
    'rejects invalid asset path %s before launching',
    async (filename) => {
      await expect(openInAuthoringTool(project, filename, '')).rejects.toMatchObject({
        code: RpcErrorCode.AssetPathOutsideProject,
      });
      expect(spawn).not.toHaveBeenCalled();
    },
  );

  it.each([
    'cmd /c start',
    '"C:/Windows/System32/cmd.exe" /c',
    'pwsh -Command Write-Output',
    'powershell -c echo',
    'powershell -Command Write-Output -File innocent.ps1',
    'powershell -File',
  ])('rejects configured command interpreter %s before appending an asset', async (command) => {
    writeFileSync(path.join(project, 'asset.png'), 'asset');
    await expect(openInAuthoringTool(project, 'asset.png', command)).rejects.toMatchObject({
      code: RpcErrorCode.InvalidParams,
    });
    expect(spawn).not.toHaveBeenCalled();
  });

  it('retains configured PowerShell file scripts', async () => {
    writeFileSync(path.join(project, 'asset.png'), 'asset');
    await openInAuthoringTool(
      project,
      'asset.png',
      'powershell.exe -NoProfile -File "C:/Tools/open.ps1"',
    );
    expect(spawn.mock.calls[0]!.slice(0, 2)).toEqual([
      'powershell.exe',
      ['-NoProfile', '-File', 'C:/Tools/open.ps1', realpathSync(path.join(project, 'asset.png'))],
    ]);
  });

  it('reports a helper failure instead of claiming its process spawn opened the asset', async () => {
    Object.defineProperty(process, 'platform', { value: 'win32' });
    writeFileSync(path.join(project, 'asset.png'), 'asset');
    spawn.mockImplementation(() => {
      queueMicrotask(() => {
        child.emit('spawn');
        child.emit('close', 1);
      });
      return child;
    });
    await expect(openInAuthoringTool(project, 'asset.png', '')).resolves.toMatchObject({
      launched: false,
    });
  });

  it('terminates a stalled Windows default helper and reports failure', async () => {
    vi.useFakeTimers();
    Object.defineProperty(process, 'platform', { value: 'win32' });
    writeFileSync(path.join(project, 'asset.png'), 'asset');
    spawn.mockImplementation(() => {
      queueMicrotask(() => child.emit('spawn'));
      return child;
    });
    const opened = openInAuthoringTool(project, 'asset.png', '');
    await vi.advanceTimersByTimeAsync(10_000);
    await expect(opened).resolves.toMatchObject({ launched: false });
    expect(child.kill).toHaveBeenCalledOnce();
  });

  it.each(['throw', 'error'])('reports a %s launch failure', async (mode) => {
    writeFileSync(path.join(project, 'asset.png'), 'asset');
    spawn.mockImplementation(() => {
      if (mode === 'throw') throw new Error('cannot spawn');
      queueMicrotask(() => child.emit('error', new Error('cannot spawn')));
      return child;
    });
    await expect(openInAuthoringTool(project, 'asset.png', 'editor')).resolves.toEqual({
      launched: false,
      command: 'editor (1 args)',
    });
  });
});

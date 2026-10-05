import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { chmod, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { ManagedQdrant } from './managed-qdrant';
import { uuidv7, type EmbeddingProfile } from '@gamecrafter/contracts';
import { QdrantVectorStore } from './qdrant-vector-store';

const managers: ManagedQdrant[] = [];
const directories: string[] = [];

afterEach(async () => {
  await Promise.all(managers.splice(0).map((manager) => manager.close()));
  await Promise.all(
    directories.splice(0).map((directory) => rm(directory, { recursive: true, force: true })),
  );
});

describe('ManagedQdrant', () => {
  it('starts lazily with private authenticated loopback REST and hardened configuration', async () => {
    const fixture = await createFixture();
    const manager = createManager(fixture, 2000);

    expect(await exists(fixture.startedFile)).toBe(false);
    await withFixtureEnvironment(fixture, async () => {
      const endpoint = await manager.endpoint();
      const captured = JSON.parse(await readFile(fixture.configFile, 'utf8')) as Record<
        string,
        string
      >;
      const response = await fetch(endpoint.url, { headers: { 'api-key': endpoint.apiKey } });

      expect(new URL(endpoint.url).hostname).toBe('127.0.0.1');
      expect(endpoint.apiKey).toHaveLength(64);
      expect(await response.json()).toMatchObject({ version: '1.19.1' });
      expect(captured).toMatchObject({
        QDRANT__SERVICE__HOST: '127.0.0.1',
        QDRANT__SERVICE__ENABLE_CORS: 'false',
        QDRANT__SERVICE__API_KEY: endpoint.apiKey,
        QDRANT__TELEMETRY_DISABLED: 'true',
        QDRANT__CLUSTER__ENABLED: 'false',
        QDRANT__STORAGE__STORAGE_PATH: path.toNamespacedPath(path.resolve(fixture.storagePath)),
      });
      expect(captured.FIXTURE_CONFIG_CONTENT).toBe('service:\n  grpc_port: null\n');
      expect(captured.FIXTURE_CWD).not.toBe(fixture.storagePath);
      expect(captured.QDRANT__SERVICE__READ_ONLY_API_KEY).toBeUndefined();
      expect(captured.QDRANT__SERVICE__GRPC_PORT).toBeUndefined();
      expect(await exists(fixture.startedFile)).toBe(true);
    });
  });

  it('rejects a service that does not report the pinned version', async () => {
    const fixture = await createFixture({ version: '1.19.0' });
    const manager = createManager(fixture, 10_000);

    await withFixtureEnvironment(fixture, async () => {
      await expect(manager.endpoint()).rejects.toThrow('expected Qdrant 1.19.1');
    });
  }, 15_000);

  it('times out readiness and terminates the child process', async () => {
    const fixture = await createFixture({ listen: false });
    const manager = createManager(fixture, 250);

    await withFixtureEnvironment(fixture, async () => {
      await expect(manager.endpoint()).rejects.toThrow('readiness timed out');
    });
    const pid = Number(await readFile(fixture.pidFile, 'utf8'));
    expect(isProcessRunning(pid)).toBe(false);
  });

  it('closes idempotently and does not restart after shutdown', async () => {
    const fixture = await createFixture();
    const manager = createManager(fixture, 2000);
    await withFixtureEnvironment(fixture, async () => {
      await manager.endpoint();
      await manager.close();
      await manager.close();
      await expect(manager.endpoint()).rejects.toThrow('has been closed');
    });
  });

  it('refuses readiness when a listener ignores API-key authentication', async () => {
    const fixture = await createFixture({ ignoreAuth: true });
    const manager = createManager(fixture, 1000);
    await withFixtureEnvironment(fixture, async () => {
      await expect(manager.endpoint()).rejects.toThrow('readiness timed out');
    });
    expect(isProcessRunning(Number(await readFile(fixture.pidFile, 'utf8')))).toBe(false);
  });
});

const nativeBinary = path.resolve(
  __dirname,
  '../../../../apps/control-room/resources/qdrant',
  process.platform === 'win32' ? 'qdrant.exe' : 'qdrant',
);
describe.skipIf(!existsSync(nativeBinary))('native managed Qdrant', () => {
  it('authenticates, persists across restart, isolates Projects and deletes points', async () => {
    const directory = await mkdtemp(path.join(tmpdir(), 'native-managed-qdrant-'));
    directories.push(directory);
    const options = {
      binaryPath: nativeBinary,
      storagePath: path.join(directory, 'storage'),
      timeoutMs: 15000,
    };
    const manager = new ManagedQdrant(options);
    managers.push(manager);
    const endpoint = await manager.endpoint();
    expect([401, 403]).toContain((await fetch(`${endpoint.url}/collections`)).status);
    const profile: EmbeddingProfile = {
      projectId: uuidv7(),
      profileId: uuidv7(),
      modelId: 'native-test',
      providerAccountId: uuidv7(),
      dimensions: 3,
      version: 1,
      createdAt: new Date().toISOString(),
    };
    const pointId = uuidv7();
    const store = new QdrantVectorStore({
      url: endpoint.url,
      apiKey: endpoint.apiKey,
      collectionPrefix: 'native',
      timeoutMs: 5000,
    });
    await store.upsert(profile, [
      {
        id: pointId,
        vector: [1, 0, 0],
        payload: {
          projectId: profile.projectId,
          source: 'canon',
          active: true,
          recordStatus: 'accepted',
        },
      },
    ]);
    expect(await store.existingIds(profile, [pointId, uuidv7()])).toEqual([pointId]);
    expect(
      await store.search(profile, [1, 0, 0], { sources: ['canon'], statuses: ['accepted'] }, 5),
    ).toMatchObject([{ id: pointId }]);
    expect(await store.count({ ...profile, projectId: uuidv7() }, { includeInactive: true })).toBe(
      0,
    );
    await manager.close();
    await expect(
      fetch(`${endpoint.url}/collections`, { signal: AbortSignal.timeout(1000) }),
    ).rejects.toThrow();
    const restarted = new ManagedQdrant(options);
    managers.push(restarted);
    const next = await restarted.endpoint();
    const reopened = new QdrantVectorStore({
      url: next.url,
      apiKey: next.apiKey,
      collectionPrefix: 'native',
      timeoutMs: 5000,
    });
    expect(await reopened.count(profile, {})).toBe(1);
    await reopened.delete(profile, [pointId]);
    expect(await reopened.count(profile, { includeInactive: true })).toBe(0);
    const dropped = await fetch(`${next.url}/collections/${reopened.collectionName(profile)}`, {
      method: 'DELETE',
      headers: { 'api-key': next.apiKey },
    });
    expect(dropped.ok).toBe(true);
    expect(await reopened.existingIds(profile, [pointId])).toEqual([]);
    await reopened.upsert(profile, [{ id: pointId, vector: [1, 0, 0], payload: { active: true } }]);
    expect(await reopened.count(profile, {})).toBe(1);
    await restarted.close();
  }, 45000);
});

function createManager(
  fixture: Awaited<ReturnType<typeof createFixture>>,
  timeoutMs: number,
): ManagedQdrant {
  const manager = new ManagedQdrant({
    binaryPath: fixture.binaryPath,
    storagePath: fixture.storagePath,
    timeoutMs,
  });
  managers.push(manager);
  return manager;
}

async function createFixture(
  options: { version?: string; listen?: boolean; ignoreAuth?: boolean } = {},
) {
  const directory = await mkdtemp(path.join(tmpdir(), 'managed-qdrant-'));
  directories.push(directory);
  const preloadFile = path.join(directory, 'fixture.cjs');
  const binaryPath = path.join(
    directory,
    process.platform === 'win32' ? 'qdrant-fixture.cmd' : 'qdrant-fixture',
  );
  const configFile = path.join(directory, 'config.json');
  const startedFile = path.join(directory, 'started');
  const pidFile = path.join(directory, 'pid');
  const version = options.version ?? '1.19.1';
  const listen = options.listen ?? true;
  await writeFile(
    preloadFile,
    `const fs = require('node:fs');
const http = require('node:http');
fs.writeFileSync(process.env.FIXTURE_CONFIG_FILE, JSON.stringify({ ...process.env, FIXTURE_CWD: process.cwd(), FIXTURE_CONFIG_CONTENT: fs.readFileSync(require('node:path').join(process.cwd(), 'managed-qdrant.yaml'), 'utf8') }));
fs.writeFileSync(process.env.FIXTURE_PID_FILE, String(process.pid));
setInterval(() => {}, 1000);
if (${JSON.stringify(listen)}) {
  const server = http.createServer((request, response) => {
    if (!${JSON.stringify(options.ignoreAuth ?? false)} && request.headers['api-key'] !== process.env.QDRANT__SERVICE__API_KEY) {
      response.writeHead(401).end();
      return;
    }
    response.writeHead(200, { 'content-type': 'application/json' });
    response.end(JSON.stringify({ version: ${JSON.stringify(version)} }));
  });
  server.listen(Number(process.env.QDRANT__SERVICE__HTTP_PORT), '127.0.0.1', () => {
    fs.writeFileSync(${JSON.stringify(startedFile)}, 'ready');
  });
}
`,
  );
  const binary =
    process.platform === 'win32'
      ? `@echo off\r\n"${process.execPath}" -r "${preloadFile}"\r\n`
      : `#!/bin/sh\nexec ${shellQuote(process.execPath)} -r ${shellQuote(preloadFile)}\n`;
  await writeFile(binaryPath, binary);
  if (process.platform !== 'win32') await chmod(binaryPath, 0o700);
  return {
    binaryPath,
    storagePath: path.join(directory, 'storage'),
    configFile,
    startedFile,
    pidFile,
  };
}

async function exists(filePath: string): Promise<boolean> {
  try {
    await readFile(filePath);
    return true;
  } catch {
    return false;
  }
}

async function withFixtureEnvironment<T>(
  fixture: Awaited<ReturnType<typeof createFixture>>,
  operation: () => Promise<T>,
): Promise<T> {
  const variables = {
    FIXTURE_CONFIG_FILE: fixture.configFile,
    FIXTURE_PID_FILE: fixture.pidFile,
    QDRANT__SERVICE__READ_ONLY_API_KEY: 'unexpected-inherited-key',
    QDRANT__SERVICE__GRPC_PORT: '7777',
  };
  const previous = new Map<string, string | undefined>();
  for (const [key, value] of Object.entries(variables)) {
    previous.set(key, process.env[key]);
    process.env[key] = value;
  }
  try {
    return await operation();
  } finally {
    for (const [key, value] of previous) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }
}

function shellQuote(value: string): string {
  return `'${value.replaceAll("'", "'\\''")}'`;
}

function isProcessRunning(pid: number): boolean {
  if (!Number.isInteger(pid) || pid <= 0) return false;
  const result = spawnSync(
    process.execPath,
    ['-e', `try { process.kill(${pid}, 0); process.exit(0) } catch { process.exit(1) }`],
    {
      windowsHide: true,
    },
  );
  return result.status === 0;
}

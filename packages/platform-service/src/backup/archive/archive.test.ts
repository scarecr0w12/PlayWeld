import { randomBytes, createHash } from 'node:crypto';
import { createReadStream, mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Readable, Writable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { describe, expect, it } from 'vitest';
import { RpcErrorCode, type BackupManifest } from '@gamecrafter/contracts';
import { createBackupIdentityCrypto } from './crypto';
import { readArchive } from './reader';
import { createArchiveWriter } from './writer';

const secret = 'correct horse battery staple';
const projectId = '019535d4-2c00-7000-8000-000000000001';
const archiveId = '019535d4-2c00-7000-8000-000000000002';
const identityId = '019535d4-2c00-7000-8000-000000000003';
const createdAt = '2026-09-29T12:00:00.000Z';

async function makeArchive(fileContent = Buffer.from('a small backup file')): Promise<Buffer> {
  const crypto = await createBackupIdentityCrypto(identityId, secret, 14);
  const identity = {
    schemaVersion: 1 as const,
    identityId,
    label: 'Test identity',
    ...crypto,
    createdAt,
  };
  const digest = createHash('sha256').update(fileContent).digest('hex');
  const manifest: BackupManifest = {
    schemaVersion: 1,
    archiveId,
    scope: 'project',
    projectId,
    createdAt,
    platformVersion: '0.1.0',
    schemaVersions: { profile: 9, project: 8 },
    pluginVersions: {},
    entries: [
      {
        path: 'game/README.md',
        kind: 'file',
        bytes: fileContent.length,
        mode: 0o644,
        mtime: createdAt,
        sha256: digest,
      },
    ],
    excluded: ['.gamecrafter/cache/'],
    notes: ['Git internals are captured as files at a point in time.'],
  };
  const output: Buffer[] = [];
  const destination = new Writable({
    write(chunk: Buffer, _encoding, callback) {
      output.push(Buffer.from(chunk));
      callback();
    },
  });
  const writer = createArchiveWriter(destination, {
    identity,
    manifest,
    compressionLevel: 6,
  });
  await pipeline(
    Readable.from([
      {
        path: 'game/README.md',
        kind: 'file',
        bytes: fileContent.length,
        mode: 0o644,
        mtime: createdAt,
        sha256: digest,
        content: fileContent,
      },
    ]),
    writer,
  );
  return Buffer.concat(output);
}

function firstChunkOffset(archive: Buffer): number {
  return 9 + archive.readUInt32BE(5);
}

describe('backup archive format', () => {
  it.each(['wrong-secret', 'preview'] as const)(
    'closes the archive file before returning from %s',
    async (mode) => {
      const directory = mkdtempSync(join(tmpdir(), 'playweld-archive-'));
      const archivePath = join(directory, 'backup.gcbk');
      writeFileSync(archivePath, await makeArchive(randomBytes(2 * 1024 * 1024)));
      const source = createReadStream(archivePath);
      try {
        if (mode === 'wrong-secret') {
          await expect(readArchive(source, 'wrong recovery secret')).rejects.toMatchObject({
            code: RpcErrorCode.BackupUnlockFailed,
          });
        } else {
          await readArchive(source, secret, { manifestOnly: true });
        }
        expect(source.closed).toBe(true);
      } finally {
        source.destroy();
        if (!source.closed) await new Promise<void>((resolve) => source.once('close', resolve));
        rmSync(directory, { recursive: true, force: true });
      }
    },
  );

  it('round-trips entries and reads the manifest preview from the first chunk', async () => {
    const archive = await makeArchive();
    const restored: Array<{ path: string; bytes: Buffer }> = [];
    const full = await readArchive(archive, secret, {
      onEntry: async (entry, content) => {
        if (entry.kind !== 'file') return;
        const chunks: Buffer[] = [];
        for await (const chunk of content) chunks.push(chunk);
        restored.push({ path: entry.path, bytes: Buffer.concat(chunks) });
      },
    });
    expect(full.manifest.entries.map((entry) => entry.path)).toEqual(['game/README.md']);
    expect(restored).toEqual([
      { path: 'game/README.md', bytes: Buffer.from('a small backup file') },
    ]);
    const preview = await readArchive(archive, secret, { manifestOnly: true });
    expect(preview.manifest).toEqual(full.manifest);
  });

  it('rejects a wrong recovery secret as BackupUnlockFailed', async () => {
    await expect(readArchive(await makeArchive(), 'wrong recovery secret')).rejects.toMatchObject({
      code: RpcErrorCode.BackupUnlockFailed,
    });
  });

  it('rejects a modified encrypted chunk', async () => {
    const archive = await makeArchive();
    const offset = firstChunkOffset(archive);
    const corrupted = Buffer.from(archive);
    corrupted[offset + 4 + 2] ^= 0x40;
    await expect(readArchive(corrupted, secret)).rejects.toMatchObject({
      code: RpcErrorCode.BackupArchiveCorrupt,
    });
  });

  it('rejects truncation before the authenticated final chunk', async () => {
    const archive = await makeArchive(randomBytes(2 * 1024 * 1024));
    await expect(
      readArchive(archive.subarray(0, archive.length - 2), secret),
    ).rejects.toMatchObject({
      code: RpcErrorCode.BackupArchiveCorrupt,
    });
  });

  it('rejects reordered encrypted chunks', async () => {
    const archive = await makeArchive(randomBytes(2 * 1024 * 1024));
    const first = firstChunkOffset(archive);
    const firstEnd = first + 4 + archive.readUInt32BE(first);
    const secondEnd = firstEnd + 4 + archive.readUInt32BE(firstEnd);
    expect(secondEnd).toBeLessThan(archive.length);
    const reordered = Buffer.concat([
      archive.subarray(0, first),
      archive.subarray(firstEnd, secondEnd),
      archive.subarray(first, firstEnd),
      archive.subarray(secondEnd),
    ]);
    await expect(readArchive(reordered, secret)).rejects.toMatchObject({
      code: RpcErrorCode.BackupArchiveCorrupt,
    });
  });
});

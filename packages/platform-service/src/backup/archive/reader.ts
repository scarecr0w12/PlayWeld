import { createDecipheriv } from 'node:crypto';
import { Readable } from 'node:stream';
import { finished, pipeline as streamPipeline } from 'node:stream/promises';
import { constants, createGunzip, gunzipSync } from 'node:zlib';
import {
  BackupManifestSchema,
  RpcError,
  RpcErrorCode,
  compile,
  type BackupManifest,
} from '@gamecrafter/contracts';
import { canonicalJson, unwrapArchiveKey } from './crypto';
import { BACKUP_CHUNK_BYTES, BACKUP_FORMAT_VERSION } from './writer';
import type {
  ArchiveGcmValue,
  BackupArchiveHeader,
  BackupArchiveReadEntry,
  BackupArchiveReadOptions,
  BackupArchiveReadResult,
} from './types';

const MAGIC = Buffer.from('GCBK', 'ascii');
const manifestValidator = compile<BackupManifest>(BackupManifestSchema);

export type ArchiveSource = Buffer | Uint8Array | AsyncIterable<Uint8Array>;

export async function readArchive(
  source: ArchiveSource,
  secret: string,
  options: BackupArchiveReadOptions = {},
): Promise<BackupArchiveReadResult> {
  const reader = new AsyncByteReader(source);
  try {
    const { header, remainder } = await readHeader(reader);
    const archiveKey = await unwrapArchiveKey(header, secret);
    try {
      return await readArchivePayload(reader, header, archiveKey, options, remainder);
    } finally {
      archiveKey.fill(0);
    }
  } finally {
    await reader.close();
  }
}

export async function readArchiveWithKey(
  source: ArchiveSource,
  archiveKey: Buffer,
  options: BackupArchiveReadOptions = {},
): Promise<BackupArchiveReadResult> {
  const reader = new AsyncByteReader(source);
  try {
    const { header, remainder } = await readHeader(reader);
    return await readArchivePayload(reader, header, archiveKey, options, remainder);
  } finally {
    await reader.close();
  }
}

async function readHeader(reader: AsyncByteReader): Promise<{
  header: BackupArchiveHeader;
  remainder: AsyncByteReader;
}> {
  const prefix = await reader.readExact(9);
  if (!prefix.subarray(0, 4).equals(MAGIC) || prefix.readUInt8(4) !== BACKUP_FORMAT_VERSION) {
    throw archiveCorrupt('Unknown backup archive header.');
  }
  const headerLength = prefix.readUInt32BE(5);
  if (headerLength === 0 || headerLength > 1024 * 1024) {
    throw archiveCorrupt('Backup archive header length is invalid.');
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse((await reader.readExact(headerLength)).toString('utf8'));
  } catch {
    throw archiveCorrupt('Backup archive header is invalid.');
  }
  const header = parseHeader(parsed);
  return { header, remainder: reader };
}

function parseHeader(value: unknown): BackupArchiveHeader {
  if (!isRecord(value)) throw archiveCorrupt('Backup archive header is invalid.');
  const identity = value.identity;
  const kdf = isRecord(identity) ? identity.kdf : null;
  const encryptedPrivateKey = isRecord(identity) ? identity.encryptedPrivateKey : null;
  const wrappedArchiveKey = value.wrappedArchiveKey;
  if (
    typeof value.archiveId !== 'string' ||
    !isUuid(value.archiveId) ||
    (value.scope !== 'project' && value.scope !== 'profile') ||
    !(
      value.projectId === null ||
      (typeof value.projectId === 'string' && isUuid(value.projectId))
    ) ||
    typeof value.createdAt !== 'string' ||
    Number.isNaN(Date.parse(value.createdAt)) ||
    typeof value.identityId !== 'string' ||
    !isUuid(value.identityId) ||
    !isRecord(identity) ||
    typeof identity.publicKey !== 'string' ||
    !isBase64(identity.publicKey, 32) ||
    !isRecord(kdf) ||
    kdf.name !== 'scrypt' ||
    typeof kdf.salt !== 'string' ||
    !isBase64(kdf.salt, 16) ||
    !Number.isSafeInteger(kdf.logN) ||
    Number(kdf.logN) < 14 ||
    Number(kdf.logN) > 20 ||
    !Number.isSafeInteger(kdf.r) ||
    Number(kdf.r) < 1 ||
    Number(kdf.r) > 32 ||
    !Number.isSafeInteger(kdf.p) ||
    Number(kdf.p) < 1 ||
    Number(kdf.p) > 16 ||
    !isGcmValue(encryptedPrivateKey) ||
    !isBase64(encryptedPrivateKey.iv, 12) ||
    !isBase64(encryptedPrivateKey.ciphertext, 1) ||
    !isBase64(encryptedPrivateKey.tag, 16) ||
    typeof value.ephemeralPublicKey !== 'string' ||
    !isBase64(value.ephemeralPublicKey, 32) ||
    !isGcmValue(wrappedArchiveKey) ||
    !isBase64(wrappedArchiveKey.iv, 12) ||
    !isBase64(wrappedArchiveKey.ciphertext, 32) ||
    !isBase64(wrappedArchiveKey.tag, 16) ||
    value.chunkBytes !== BACKUP_CHUNK_BYTES ||
    value.compression !== 'gzip' ||
    value.manifestOffset !== null
  ) {
    throw archiveCorrupt('Backup archive header is invalid.');
  }
  return value as unknown as BackupArchiveHeader;
}

async function readArchivePayload(
  reader: AsyncByteReader,
  header: BackupArchiveHeader,
  archiveKey: Buffer,
  options: BackupArchiveReadOptions,
  remainder: AsyncByteReader,
): Promise<BackupArchiveReadResult> {
  if (options.manifestOnly) {
    const framed = await readFirstChunk(remainder);
    const decompressed = gunzipSync(decryptFirstChunk(archiveKey, framed), {
      finishFlush: constants.Z_SYNC_FLUSH,
    });
    const preview = parseFirstManifestPreview(decompressed);
    assertManifestMatchesHeader(preview, header);
    return { header, manifest: preview };
  }

  const decrypted = Readable.from(decryptChunks(remainder, archiveKey, header.chunkBytes));
  const gunzipped = Readable.from(decompress(decrypted));
  const payload = new AsyncByteReader(gunzipped);
  let previewManifest: BackupManifest | undefined;
  let finalManifest: BackupManifest | undefined;
  const payloadEntries: BackupArchiveReadEntry[] = [];
  let first = true;
  let seenFinalManifest = false;

  while (true) {
    const sizeBytes = await payload.readOptionalExact(4);
    if (!sizeBytes) break;
    if (seenFinalManifest) throw archiveCorrupt('Backup archive has entries after its manifest.');
    const jsonLength = sizeBytes.readUInt32BE(0);
    if (jsonLength === 0 || jsonLength > 1024 * 1024) {
      throw archiveCorrupt('Backup entry header length is invalid.');
    }
    let entry: BackupArchiveReadEntry;
    try {
      entry = parseEntry(JSON.parse((await payload.readExact(jsonLength)).toString('utf8')));
    } catch {
      throw archiveCorrupt('Backup entry header is invalid.');
    }
    if (first && entry.kind !== 'manifest-preview') {
      throw archiveCorrupt('Backup archive is missing its manifest preview.');
    }
    first = false;
    if (entry.kind === 'manifest-preview' || entry.kind === 'manifest') {
      if (entry.bytes > 64 * 1024 * 1024) throw archiveCorrupt('Backup manifest is too large.');
      const content = await collect(payload.take(entry.bytes), entry.bytes);
      const parsedManifest = parseManifest(content);
      if (entry.kind === 'manifest-preview') {
        if (previewManifest) throw archiveCorrupt('Backup archive has multiple manifest previews.');
        previewManifest = parsedManifest;
      } else {
        if (finalManifest) throw archiveCorrupt('Backup archive has multiple manifests.');
        finalManifest = parsedManifest;
        seenFinalManifest = true;
      }
      continue;
    }
    payloadEntries.push(entry);
    const content = payload.take(entry.bytes);
    if (options.onEntry) await options.onEntry(entry, content);
    await drain(content);
  }

  if (!previewManifest || !finalManifest) throw archiveCorrupt('Backup archive is incomplete.');
  if (canonicalJson(previewManifest) !== canonicalJson(finalManifest)) {
    throw archiveCorrupt('Backup manifest preview does not match the authoritative manifest.');
  }
  const manifestEntries = new Map(finalManifest.entries.map((entry) => [entry.path, entry]));
  if (
    manifestEntries.size !== finalManifest.entries.length ||
    payloadEntries.length !== manifestEntries.size
  ) {
    throw archiveCorrupt('Backup manifest entry count does not match the payload.');
  }
  for (const entry of payloadEntries) {
    const expected = manifestEntries.get(entry.path);
    if (
      !expected ||
      expected.kind !== entry.kind ||
      expected.bytes !== entry.bytes ||
      expected.mode !== entry.mode ||
      expected.mtime !== entry.mtime ||
      expected.sha256 !== (entry.sha256 ?? null) ||
      (expected.linkTarget ?? null) !== (entry.linkTarget ?? null)
    ) {
      throw archiveCorrupt(`Backup manifest entry does not match ${entry.path}.`);
    }
  }
  assertManifestMatchesHeader(finalManifest, header);
  return { header, manifest: finalManifest };
}

async function* decompress(source: Readable): AsyncGenerator<Buffer> {
  const gunzip = createGunzip();
  const completed = streamPipeline(source, gunzip);
  void completed.catch(() => undefined);
  try {
    for await (const chunk of gunzip) yield Buffer.from(chunk);
    await completed;
  } catch (error) {
    if (error instanceof RpcError) throw error;
    throw archiveCorrupt('Backup gzip stream is invalid.');
  }
}

async function* decryptChunks(
  reader: AsyncByteReader,
  archiveKey: Buffer,
  chunkBytes: number,
): AsyncGenerator<Buffer> {
  let chunkIndex = 0;
  let length = await reader.readOptionalUInt32();
  if (length === undefined)
    throw archiveCorrupt('Backup archive has no authenticated final chunk.');
  while (true) {
    if (length < 16 || length > chunkBytes + 16)
      throw archiveCorrupt('Backup chunk length is invalid.');
    const cipherText = await reader.readExact(length);
    const nextLength = await reader.readOptionalUInt32();
    const isLast = nextLength === undefined;
    yield decryptChunk(archiveKey, cipherText, chunkIndex, isLast);
    if (isLast) return;
    length = nextLength;
    chunkIndex += 1;
  }
}

async function readFirstChunk(reader: AsyncByteReader): Promise<Buffer> {
  const length = await reader.readOptionalUInt32();
  if (length === undefined || length < 16 || length > BACKUP_CHUNK_BYTES + 16) {
    throw archiveCorrupt('Backup archive has no manifest preview chunk.');
  }
  return reader.readExact(length);
}

function decryptFirstChunk(archiveKey: Buffer, encrypted: Buffer): Buffer {
  for (const isLast of [false, true]) {
    try {
      return decryptChunk(archiveKey, encrypted, 0, isLast);
    } catch {
      continue;
    }
  }
  throw archiveCorrupt('Backup manifest preview authentication failed.');
}

function decryptChunk(
  archiveKey: Buffer,
  encrypted: Buffer,
  chunkIndex: number,
  isLast: boolean,
): Buffer {
  if (encrypted.length < 16) throw archiveCorrupt('Backup encrypted chunk is truncated.');
  const iv = Buffer.alloc(12);
  iv.writeBigUInt64BE(BigInt(chunkIndex), 4);
  const aad = Buffer.alloc(9);
  aad.writeBigUInt64BE(BigInt(chunkIndex), 0);
  aad.writeUInt8(Number(isLast), 8);
  const ciphertext = encrypted.subarray(0, encrypted.length - 16);
  const tag = encrypted.subarray(encrypted.length - 16);
  try {
    const decipher = createDecipheriv('aes-256-gcm', archiveKey, iv);
    decipher.setAAD(aad);
    decipher.setAuthTag(tag);
    return Buffer.concat([decipher.update(ciphertext), decipher.final()]);
  } catch {
    throw archiveCorrupt('Backup chunk authentication failed.');
  }
}

function parseFirstManifestPreview(plaintext: Buffer): BackupManifest {
  if (plaintext.length < 4) throw archiveCorrupt('Backup manifest preview is truncated.');
  const jsonLength = plaintext.readUInt32BE(0);
  if (jsonLength === 0 || jsonLength > 1024 * 1024 || plaintext.length < 4 + jsonLength) {
    throw archiveCorrupt('Backup manifest preview entry is truncated.');
  }
  let entry: BackupArchiveReadEntry;
  try {
    entry = parseEntry(JSON.parse(plaintext.subarray(4, 4 + jsonLength).toString('utf8')));
  } catch {
    throw archiveCorrupt('Backup manifest preview entry is invalid.');
  }
  if (entry.kind !== 'manifest-preview' || entry.bytes > plaintext.length - 4 - jsonLength) {
    throw archiveCorrupt('Backup first entry is not a complete manifest preview.');
  }
  return parseManifest(plaintext.subarray(4 + jsonLength, 4 + jsonLength + entry.bytes));
}

function parseEntry(value: unknown): BackupArchiveReadEntry {
  if (!isRecord(value)) throw new Error('Invalid entry');
  if (
    typeof value.path !== 'string' ||
    typeof value.kind !== 'string' ||
    !['file', 'dir', 'symlink', 'manifest-preview', 'manifest'].includes(value.kind) ||
    !Number.isSafeInteger(value.bytes) ||
    (value.bytes as number) < 0 ||
    !Number.isSafeInteger(value.mode) ||
    typeof value.mtime !== 'string' ||
    (value.sha256 !== undefined && !(value.sha256 === null || typeof value.sha256 === 'string')) ||
    (value.linkTarget !== undefined && typeof value.linkTarget !== 'string')
  ) {
    throw new Error('Invalid entry');
  }
  return value as unknown as BackupArchiveReadEntry;
}

function parseManifest(value: Buffer): BackupManifest {
  let parsed: unknown;
  try {
    parsed = JSON.parse(value.toString('utf8'));
  } catch {
    throw archiveCorrupt('Backup manifest JSON is invalid.');
  }
  try {
    return manifestValidator.assert(parsed);
  } catch {
    throw archiveCorrupt('Backup manifest schema is invalid.');
  }
}

function assertManifestMatchesHeader(manifest: BackupManifest, header: BackupArchiveHeader): void {
  if (
    manifest.archiveId !== header.archiveId ||
    manifest.scope !== header.scope ||
    manifest.projectId !== header.projectId ||
    manifest.createdAt !== header.createdAt
  ) {
    throw archiveCorrupt('Backup manifest does not match its archive header.');
  }
}

async function collect(content: AsyncIterable<Buffer>, expectedBytes: number): Promise<Buffer> {
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of content) {
    size += chunk.length;
    if (size > expectedBytes) throw archiveCorrupt('Backup entry exceeds its declared length.');
    chunks.push(chunk);
  }
  if (size !== expectedBytes)
    throw archiveCorrupt('Backup entry is shorter than its declared length.');
  return Buffer.concat(chunks, size);
}

async function drain(content: AsyncIterable<Buffer>): Promise<void> {
  for await (const chunk of content) {
    void chunk;
  }
}

class AsyncByteReader {
  private readonly iterator: AsyncIterator<Uint8Array>;
  private readonly source: Readable | undefined;
  private buffer = Buffer.alloc(0);
  private ended = false;

  constructor(source: ArchiveSource | Readable) {
    this.source = source instanceof Readable ? source : undefined;
    const iterable =
      Buffer.isBuffer(source) || source instanceof Uint8Array
        ? (async function* () {
            yield Buffer.from(source);
          })()
        : source;
    this.iterator = iterable[Symbol.asyncIterator]();
  }

  async close(): Promise<void> {
    const closed = this.source
      ? finished(this.source, { cleanup: true }).catch(() => undefined)
      : undefined;
    if (!this.ended) {
      this.ended = true;
      await this.iterator.return?.();
    }
    await closed;
    this.buffer = Buffer.alloc(0);
  }

  async readExact(length: number): Promise<Buffer> {
    if (!Number.isSafeInteger(length) || length < 0)
      throw archiveCorrupt('Invalid archive read length.');
    while (this.buffer.length < length) {
      const next = await this.nextChunk();
      if (!next) throw archiveCorrupt('Backup archive is truncated.');
      this.buffer = this.buffer.length ? Buffer.concat([this.buffer, next]) : Buffer.from(next);
    }
    const result = this.buffer.subarray(0, length);
    this.buffer = this.buffer.subarray(length);
    return result;
  }

  async readOptionalUInt32(): Promise<number | undefined> {
    const first = await this.readOptionalExact(4);
    return first?.readUInt32BE(0);
  }

  async readOptionalExact(length: number): Promise<Buffer | undefined> {
    if (this.buffer.length === 0) {
      const next = await this.nextChunk();
      if (!next) return undefined;
      this.buffer = Buffer.from(next);
    }
    if (this.buffer.length < length) return this.readExact(length);
    const result = this.buffer.subarray(0, length);
    this.buffer = this.buffer.subarray(length);
    return result;
  }

  async *take(length: number): AsyncGenerator<Buffer> {
    let remaining = length;
    while (remaining > 0) {
      if (this.buffer.length === 0) {
        const next = await this.nextChunk();
        if (!next) throw archiveCorrupt('Backup entry content is truncated.');
        this.buffer = Buffer.from(next);
      }
      const count = Math.min(remaining, this.buffer.length);
      yield this.buffer.subarray(0, count);
      this.buffer = this.buffer.subarray(count);
      remaining -= count;
    }
  }

  private async nextChunk(): Promise<Buffer | undefined> {
    if (this.ended) return undefined;
    const next = await this.iterator.next();
    if (next.done) {
      this.ended = true;
      return undefined;
    }
    return Buffer.from(next.value);
  }
}

function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

function isBase64(value: string, minimumBytes: number): boolean {
  if (!/^[A-Za-z0-9+/]+={0,2}$/.test(value)) return false;
  const decoded = Buffer.from(value, 'base64');
  return decoded.length >= minimumBytes && decoded.toString('base64') === value;
}

function isGcmValue(value: unknown): value is ArchiveGcmValue {
  return (
    isRecord(value) &&
    typeof value.iv === 'string' &&
    typeof value.ciphertext === 'string' &&
    typeof value.tag === 'string'
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function archiveCorrupt(message: string): RpcError {
  return new RpcError(message, RpcErrorCode.BackupArchiveCorrupt);
}

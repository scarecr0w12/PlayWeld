import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { existsSync, lstatSync, readFileSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';
import {
  BUILTIN_RECORD_TYPES,
  IndexStatusSchema,
  ProjectManifestSchema,
  RpcError,
  RpcErrorCode,
  compile,
  type CanonRecord,
  type EmbeddingProfile,
  type IndexSource,
  type KnowledgeChunk,
  type KnowledgeIndexState,
  type ProjectManifest,
} from '@gamecrafter/contracts';
import type { BoardService } from '../board/board-service';
import type { CompletionService } from '../models/completion-service';
import type { ProfileStore } from '../profile/profile-store';
import type { CredentialStore } from '../profile/credential-store';
import type { ProjectDatabases } from '../projects/project-databases';
import type { PluginRegistry } from '../plugins/plugin-registry';
import type { SettingsService } from '../settings/settings-service';
import { CanonParser } from './canon-parser';
import { Chunker } from './chunker';
import {
  KnowledgeStore,
  type KnowledgeIndexFileState,
  type KnowledgeVectorMapping,
} from './knowledge-store';
import { VectorStoreRegistry, type VectorStoreAdapter } from './vector-store-registry';
import {
  NullVectorStore,
  unavailableVectorStore,
  type VectorPoint,
  type VectorStore,
} from './vector-store';

const manifestValidator = compile<ProjectManifest>(ProjectManifestSchema);
const statusValidator = compile<KnowledgeIndexState>(IndexStatusSchema);
const maxIndexFileBytes = 1_000_000;
const maxSidecarBytes = 4_000;
const documentationExtensions = new Set(['md', 'markdown', 'txt', 'rst', 'yaml', 'yml', 'json']);
const binaryExtensions = new Set([
  'png',
  'jpg',
  'jpeg',
  'gif',
  'webp',
  'bmp',
  'tga',
  'dds',
  'exr',
  'hdr',
  'wav',
  'mp3',
  'ogg',
  'flac',
  'mp4',
  'mov',
  'avi',
  'fbx',
  'obj',
  'glb',
  'gltf',
  'blend',
  'uasset',
  'umap',
  'res',
]);

export interface KnowledgeIndexerOptions {
  projects: ProfileStore;
  projectDatabases: ProjectDatabases;
  settings: SettingsService;
  board: BoardService;
  completion: CompletionService;
  credentials: CredentialStore;
  plugins: PluginRegistry;
  now?: () => Date;
  vectorStoreFactory?: (projectId: string) => VectorStore;
  vectorStoreAdapters?: VectorStoreAdapter[];
  qdrantBinaryPath?: string;
}

interface SourceFile {
  path: string;
  source: IndexSource;
  text: string;
  contentHash: string;
  revision?: string;
  mtimeMs: number;
  size: number;
}

export interface ReconcileResult {
  status: KnowledgeIndexState;
  changedPaths: string[];
  noOp: boolean;
}

export class KnowledgeIndexer {
  private readonly now: () => Date;
  private readonly parser = new CanonParser();
  private readonly chunker = new Chunker();
  private readonly running = new Map<string, Promise<ReconcileResult>>();
  private readonly registry: VectorStoreRegistry;
  private readonly identities = new WeakMap<VectorStore, string>();

  constructor(private readonly options: KnowledgeIndexerOptions) {
    this.now = options.now ?? (() => new Date());
    this.registry = new VectorStoreRegistry(options.qdrantBinaryPath);
    for (const adapter of options.vectorStoreAdapters ?? []) this.registry.register(adapter);
  }

  async close(): Promise<void> {
    await Promise.allSettled(this.running.values());
    await this.registry.close();
  }

  reconcile(projectId: string, full = true): Promise<ReconcileResult> {
    const active = this.running.get(projectId);
    if (active) return active;
    const task = this.reconcileProject(projectId, full).finally(() =>
      this.running.delete(projectId),
    );
    this.running.set(projectId, task);
    return task;
  }

  async status(projectId: string): Promise<KnowledgeIndexState> {
    this.requireProject(projectId);
    const store = new KnowledgeStore(this.options.projectDatabases.get(projectId));
    const meta = store.indexMeta(projectId);
    const profile = store.activeEmbeddingProfile(projectId);
    const vectorStore = this.vectorStore(projectId);
    const health = await vectorStore.health(profile ?? undefined);
    const counts = store.indexCounts(projectId);
    const records = store.listRecords({ includeInactive: true });
    const recordIds = new Set(records.map((record) => record.id));
    const brokenReferences = records.flatMap((record) =>
      record.references
        .filter((reference) => !recordIds.has(reference.target))
        .map((reference) => ({ recordId: record.id, target: reference.target })),
    );
    return statusValidator.assert({
      projectId,
      lastFullReconcileAt: meta.lastFullReconcileAt,
      lastIncrementalAt: meta.lastIncrementalAt,
      chunks: counts.chunks,
      records: counts.records,
      vectors:
        profile && health.kind !== 'none'
          ? store.vectorMappings(projectId, profile.version).filter((mapping) => {
              const identity = this.identities.get(vectorStore);
              return !identity || mapping.collection.startsWith(`${identity}:`);
            }).length
          : null,
      vectorStore: {
        kind: health.kind,
        reachable: health.reachable,
        collection: health.collection,
        error: health.error ?? meta.degraded,
      },
      embeddingProfile: profile,
      pending: 0,
      conflicts: store.conflicts(),
      brokenReferences,
    });
  }

  recordTypes(): string[] {
    return [
      ...new Set([
        ...BUILTIN_RECORD_TYPES,
        ...this.options.plugins.recordTypes().map((entry) => entry.recordType.type),
      ]),
    ].sort();
  }

  stateHash(projectId: string): string {
    return new KnowledgeStore(this.options.projectDatabases.get(projectId)).stateHash();
  }

  createVectorStore(projectId: string): VectorStore {
    return this.vectorStore(projectId);
  }

  private async reconcileProject(projectId: string, full: boolean): Promise<ReconcileResult> {
    const project = this.requireProject(projectId);
    const manifest = manifestValidator.assert(
      JSON.parse(readFileSync(path.join(project.path, 'gamecrafter.project.json'), 'utf8')),
    );
    const store = new KnowledgeStore(this.options.projectDatabases.get(projectId));
    const previousStates = store.indexState() as KnowledgeIndexFileState[];
    const stateByPath = new Map(previousStates.map((state) => [state.path, state]));
    const headBlobs = gitHeadBlobs(project.path);
    const dirtyPaths = gitDirtyPaths(project.path);
    const sources = this.scanSources(projectId, project.path);
    const seenPaths = new Set<string>();
    const changedPaths: string[] = [];
    let degraded: string | null = null;
    const profile = store.activeEmbeddingProfile(projectId);
    const vectorStore = this.vectorStore(projectId);
    const profiles = store.embeddingProfiles(projectId);

    if (profile && vectorStore.kind !== 'none') {
      degraded = await this.removeOldProfileVectors(
        projectId,
        profile,
        profiles,
        store,
        vectorStore,
      );
    }

    if (profile && vectorStore.kind !== 'none') {
      const mappings = store.vectorMappings(projectId, profile.version);
      const live = new Set(
        batches(
          mappings.map((mapping) => mapping.chunkId),
          256,
        )
          .flatMap((ids) => store.chunksByIds(projectId, ids))
          .map((chunk) => chunk.chunkId),
      );
      const orphaned = mappings.filter((mapping) => !live.has(mapping.chunkId));
      const cleanupError = await this.deleteVectorMappings(
        projectId,
        orphaned.map((mapping) => mapping.chunkId),
        profiles,
        store,
        vectorStore,
      );
      degraded = cleanupError ?? degraded;
    }

    const activeMappings = new Map<string, KnowledgeVectorMapping>(
      profile && vectorStore.kind !== 'none'
        ? store
            .vectorMappings(projectId, profile.version)
            .map((mapping) => [mapping.chunkId, mapping])
        : [],
    );
    const existingPointIds = new Set<string>();
    let checkedPoints = false;
    if (profile && vectorStore.existingIds) {
      try {
        for (const batch of batches(
          [...activeMappings.values()].map((mapping) => mapping.pointId),
          256,
        ))
          for (const id of await vectorStore.existingIds(profile, batch)) existingPointIds.add(id);
        checkedPoints = true;
      } catch (error) {
        degraded = error instanceof Error ? error.message : String(error);
      }
    }
    for (const source of sources) {
      seenPaths.add(source.path);
      const revision =
        source.revision ?? gitRevision(project.path, source.path, headBlobs, dirtyPaths);
      const parsed = this.parseSource(source, revision, manifest);
      const chunks = this.chunker.chunk({
        projectId,
        source: parsed.source,
        path: source.path,
        recordId: parsed.record?.id ?? null,
        revision,
        text: parsed.body,
      });
      const state: KnowledgeIndexFileState = {
        path: source.path,
        source: parsed.source,
        revision,
        contentHash: source.contentHash,
        mtimeMs: source.mtimeMs,
        size: source.size,
        chunkCount: chunks.length,
        indexedAt: this.now().toISOString(),
      };
      const oldState = stateByPath.get(source.path);
      const previousRecord = store.recordByPath(source.path)?.record;
      const changed =
        !oldState || !sameState(oldState, state) || !sameRecord(previousRecord, parsed.record);
      if (changed) {
        const oldIds = store.chunkIdsForPath(source.path);
        const newIds = new Set(chunks.map((chunk) => chunk.chunkId));
        const staleIds = oldIds.filter((chunkId) => !newIds.has(chunkId));
        if (staleIds.length > 0) {
          degraded ??= await this.deleteVectorMappings(
            projectId,
            staleIds,
            profiles,
            store,
            vectorStore,
          );
        }
        store.replaceIndexedPath({ ...state, record: parsed.record, body: parsed.body, chunks });
        changedPaths.push(source.path);
      }
      if (profile && vectorStore.kind !== 'none') {
        const collection = await vectorStore.ensureCollection(profile).catch(() => null);
        const target = this.mappingCollection(vectorStore, collection);
        const pending = chunks.filter((chunk) => {
          const mapping = activeMappings.get(chunk.chunkId);
          return (
            changed ||
            !mapping ||
            mapping.collection !== target ||
            (checkedPoints && !existingPointIds.has(mapping.pointId))
          );
        });
        const error = await this.embedChunks(
          projectId,
          profile,
          pending,
          vectorStore,
          store,
          parsed.record,
        );
        if (error) {
          degraded ??= error;
          store.removeVectorMappings(
            projectId,
            pending.map((chunk) => chunk.chunkId),
            profile.version,
          );
          for (const chunk of pending) activeMappings.delete(chunk.chunkId);
        } else {
          const savedMappings = store.vectorMappings(projectId, profile.version);
          for (const chunk of pending) {
            const mapping = savedMappings.find((entry) => entry.chunkId === chunk.chunkId);
            if (mapping) activeMappings.set(chunk.chunkId, mapping);
          }
        }
      }
    }

    for (const previous of previousStates) {
      if (seenPaths.has(previous.path)) continue;
      const oldIds = store.chunkIdsForPath(previous.path);
      if (oldIds.length > 0) {
        degraded ??= await this.deleteVectorMappings(
          projectId,
          oldIds,
          profiles,
          store,
          vectorStore,
        );
      }
      store.removeIndexedPath(previous.path);
      changedPaths.push(previous.path);
    }

    const allRecords = store.listRecords({ includeInactive: true });
    const recordPaths = new Map<string, string[]>();
    for (const record of allRecords) {
      const paths = recordPaths.get(record.id) ?? [];
      paths.push(record.path);
      recordPaths.set(record.id, paths);
    }
    const conflicts = [...recordPaths.entries()]
      .filter(([, paths]) => paths.length > 1)
      .map(([id, paths]) => ({ id, paths: [...paths].sort() }))
      .sort((left, right) => left.id.localeCompare(right.id));
    const previousConflicts = store.conflicts();
    if (JSON.stringify(previousConflicts) !== JSON.stringify(conflicts)) {
      store.replaceConflicts(conflicts, this.now().toISOString());
    }

    const previousMeta = store.indexMeta(projectId);
    const meta = {
      projectId,
      lastFullReconcileAt:
        full && (changedPaths.length > 0 || !previousMeta.lastFullReconcileAt)
          ? this.now().toISOString()
          : previousMeta.lastFullReconcileAt,
      lastIncrementalAt:
        !full && changedPaths.length > 0
          ? this.now().toISOString()
          : previousMeta.lastIncrementalAt,
      degraded,
    };
    if (JSON.stringify(meta) !== JSON.stringify(previousMeta)) store.setIndexMeta(meta);
    const status = await this.status(projectId);
    return { status, changedPaths, noOp: changedPaths.length === 0 };
  }

  private parseSource(
    source: SourceFile,
    revision: string,
    manifest: ProjectManifest,
  ): { source: IndexSource; record: CanonRecord | undefined; body: string } {
    if (!source.path.startsWith('docs/canon/') && !source.path.startsWith('docs/decisions/')) {
      return { source: source.source, record: undefined, body: source.text };
    }
    try {
      const parsed = this.parser.parse(source.text, {
        path: source.path,
        revision,
        active: true,
        indexedAt: this.now().toISOString(),
        recordTypes: this.recordTypes(),
      });
      const active = !parsed.record.module || manifest.modules.includes(parsed.record.module);
      const record: CanonRecord = { ...parsed.record, active };
      return {
        source: active ? source.source : 'inactive',
        record,
        body: parsed.body,
      };
    } catch (error) {
      if (error instanceof RpcError && error.code === RpcErrorCode.CanonRecordInvalid) {
        return { source: 'docs', record: undefined, body: source.text };
      }
      throw error;
    }
  }

  private scanSources(projectId: string, projectPath: string): SourceFile[] {
    const files: SourceFile[] = [];
    const extensions = new Set(
      settingStringArray(
        this.options.settings.resolve('knowledge.codeExtensions', { projectId }).value,
      ),
    );
    const indexCode =
      this.options.settings.resolve('knowledge.indexCode', { projectId }).value !== false;
    const docsRoot = path.join(projectPath, 'docs');
    if (existsSync(docsRoot)) {
      for (const file of walkTextFiles(docsRoot, 'docs', documentationExtensions)) {
        files.push(diskSource(file.path, file.absolutePath, file.source));
      }
    }
    const gameRoot = path.join(projectPath, 'game');
    if (existsSync(gameRoot)) {
      for (const file of walkFiles(gameRoot, 'game')) {
        const extension = path.extname(file.path).slice(1).toLowerCase();
        if (extension === 'meta' || extension === 'import' || isIgnoredPath(file.path)) continue;
        if (isAssetPath(file.path) || binaryExtensions.has(extension)) {
          const metadata = assetMetadata(file.path, file.absolutePath, file.stats.size);
          files.push({
            path: file.path,
            source: 'assets',
            text: metadata,
            contentHash: hash(metadata),
            revision: undefined,
            mtimeMs: file.stats.mtimeMs,
            size: file.stats.size,
          });
          continue;
        }
        if (extensions.has(extension) && indexCode) {
          const text = readSafeText(file.absolutePath);
          if (text !== null) files.push(diskSource(file.path, file.absolutePath, 'code', text));
        }
      }
    }
    if (this.options.settings.resolve('knowledge.indexBoard', { projectId }).value === true) {
      for (const thread of this.options.board.threads(projectId)) {
        const detail = this.options.board.thread(projectId, thread.threadId, {
          includeMessages: true,
          limit: 1000,
        });
        const { summary } = this.options.board.summary(projectId, thread.threadId);
        for (const message of detail.messages) {
          const text = [thread.title, thread.kind, summary, message.type, message.body]
            .filter(Boolean)
            .join('\n\n');
          files.push({
            path: `board/${thread.threadId}/${message.messageId}.md`,
            source: 'board',
            text,
            contentHash: hash(text),
            revision: `${thread.updatedAt}:${message.messageId}`,
            mtimeMs: Date.parse(message.createdAt) || 0,
            size: Buffer.byteLength(text),
          });
        }
      }
    }
    return files.sort((left, right) => left.path.localeCompare(right.path));
  }

  private async embedChunks(
    projectId: string,
    profile: EmbeddingProfile,
    chunks: KnowledgeChunk[],
    vectorStore: VectorStore,
    store: KnowledgeStore,
    record: CanonRecord | undefined,
  ): Promise<string | null> {
    if (chunks.length === 0) return null;
    try {
      const collection = await vectorStore.ensureCollection(profile);
      const batchSize = Math.max(
        1,
        Number(
          this.options.settings.resolve('knowledge.embeddingBatchSize', { projectId }).value,
        ) || 32,
      );
      for (let offset = 0; offset < chunks.length; offset += batchSize) {
        const batch = chunks.slice(offset, offset + batchSize);
        const response = await this.options.completion.embed(
          profile.modelId,
          batch.map((chunk) => chunk.text),
        );
        if (
          response.vectors.length !== batch.length ||
          response.vectors.some((vector) => vector.length !== profile.dimensions)
        ) {
          throw new RpcError(
            'Embedding response dimensions do not match the active profile.',
            RpcErrorCode.EmbeddingProfileMissing,
          );
        }
        const points: VectorPoint[] = batch.map((chunk, index) => ({
          id: deterministicPointId(chunk.chunkId, profile.version),
          vector: response.vectors[index]!,
          payload: {
            projectId,
            chunkId: chunk.chunkId,
            path: chunk.path,
            revision: chunk.revision,
            recordId: chunk.recordId,
            source: chunk.source,
            recordType: record?.type ?? null,
            recordStatus: record?.status ?? null,
            active: record?.active ?? true,
          },
        }));
        await vectorStore.upsert(profile, points);
        for (const point of points) {
          store.saveVectorMapping({
            chunkId: String(point.payload.chunkId),
            projectId,
            profileVersion: profile.version,
            pointId: point.id,
            collection: this.mappingCollection(vectorStore, collection),
            createdAt: this.now().toISOString(),
          });
        }
      }
      return null;
    } catch (error) {
      return error instanceof Error ? error.message : String(error);
    }
  }

  private async removeOldProfileVectors(
    projectId: string,
    currentProfile: EmbeddingProfile,
    profiles: EmbeddingProfile[],
    store: KnowledgeStore,
    vectorStore: VectorStore,
  ): Promise<string | null> {
    const mappings = store
      .vectorMappings(projectId)
      .filter((mapping) => mapping.profileVersion !== currentProfile.version);
    let degraded: string | null = null;
    for (const profileVersion of new Set(mappings.map((mapping) => mapping.profileVersion))) {
      const oldProfile = profiles.find((profile) => profile.version === profileVersion);
      const chunkIds = mappings
        .filter((mapping) => mapping.profileVersion === profileVersion)
        .map((mapping) => mapping.chunkId);
      if (oldProfile) {
        try {
          await vectorStore.delete(
            oldProfile,
            mappings
              .filter((mapping) => mapping.profileVersion === profileVersion)
              .map((mapping) => mapping.pointId),
          );
        } catch (error) {
          degraded ??= error instanceof Error ? error.message : String(error);
          continue;
        }
      } else {
        continue;
      }
      store.removeVectorMappings(projectId, chunkIds, profileVersion);
    }
    return degraded;
  }

  private async deleteVectorMappings(
    projectId: string,
    chunkIds: string[],
    profiles: EmbeddingProfile[],
    store: KnowledgeStore,
    vectorStore: VectorStore,
  ): Promise<string | null> {
    const ids = new Set(chunkIds);
    const mappings = store.vectorMappings(projectId).filter((mapping) => ids.has(mapping.chunkId));
    let degraded: string | null = null;
    for (const profileVersion of new Set(mappings.map((mapping) => mapping.profileVersion))) {
      const versionMappings = mappings.filter(
        (mapping) => mapping.profileVersion === profileVersion,
      );
      const profile = profiles.find((candidate) => candidate.version === profileVersion);
      if (profile && vectorStore.kind !== 'none') {
        try {
          await vectorStore.delete(
            profile,
            versionMappings.map((mapping) => mapping.pointId),
          );
        } catch (error) {
          degraded ??= error instanceof Error ? error.message : String(error);
          continue;
        }
      } else {
        continue;
      }
      store.removeVectorMappings(
        projectId,
        versionMappings.map((mapping) => mapping.chunkId),
        profileVersion,
      );
    }
    return degraded;
  }

  private vectorStore(projectId: string): VectorStore {
    try {
      return this.configuredVectorStore(projectId);
    } catch (error) {
      const kind = String(
        this.options.settings.resolve('knowledge.vectorStore.kind', { projectId }).value,
      );
      return unavailableVectorStore(kind, error);
    }
  }

  private configuredVectorStore(projectId: string): VectorStore {
    if (this.options.vectorStoreFactory) return this.options.vectorStoreFactory(projectId);
    const context = { projectId };
    const kind = this.options.settings.resolve('knowledge.vectorStore.kind', context).value;
    if (kind === 'none') return new NullVectorStore();
    const deployment = this.options.settings.resolve('knowledge.vectorStore.deployment', context)
      .value as import('@gamecrafter/contracts').VectorStoreDeployment;
    const url = String(
      this.options.settings.resolve('knowledge.vectorStore.url', context).value ??
        'http://127.0.0.1:6333',
    );
    const apiKeyRef = String(
      this.options.settings.resolve('knowledge.vectorStore.apiKeyRef', context).value ?? '',
    ).trim();
    let apiKey: string | undefined;
    if (
      apiKeyRef &&
      kind !== 'lancedb' &&
      kind !== 'sqlite' &&
      !(kind === 'qdrant' && deployment === 'managed-local')
    ) {
      const match = /^\$\{cred:([^}]+)\}$/.exec(apiKeyRef);
      if (!match)
        throw new RpcError(
          'Vector store credential reference must use ${cred:KEY}.',
          RpcErrorCode.InvalidParams,
        );
      apiKey = this.options.credentials.get(match[1]!);
      if (!apiKey)
        throw new RpcError(
          'Vector store credential was not found.',
          RpcErrorCode.VectorStoreUnavailable,
        );
    }
    const resolved = this.registry.resolve(
      {
        projectId,
        projectPath: this.requireProject(projectId).path,
        config: {
          kind: String(kind),
          deployment,
          url,
          apiKeyRef,
          collectionPrefix: String(
            this.options.settings.resolve('knowledge.vectorStore.collectionPrefix', context)
              .value ?? 'gamecrafter',
          ),
          timeoutMs: Number(
            this.options.settings.resolve('knowledge.vectorStore.timeoutMs', context).value ?? 5000,
          ),
        },
        apiKey,
      },
      this.options.settings.resolve('knowledge.vectorStore.allowRemote', context).value === true,
    );
    this.identities.set(resolved.store, resolved.identity);
    return resolved.store;
  }

  private mappingCollection(vectorStore: VectorStore, collection: string | null): string {
    const identity = this.identities.get(vectorStore);
    return identity ? `${identity}:${collection ?? ''}` : (collection ?? '');
  }

  private requireProject(projectId: string) {
    const project = this.options.projects.getById(projectId);
    if (!project)
      throw new RpcError(`Project not found: ${projectId}`, RpcErrorCode.ProjectNotFound);
    return project;
  }
}

function batches<T>(items: T[], size: number): T[][] {
  const result: T[][] = [];
  for (let offset = 0; offset < items.length; offset += size)
    result.push(items.slice(offset, offset + size));
  return result;
}

function diskSource(
  relativePath: string,
  absolutePath: string,
  source: IndexSource,
  providedText?: string,
): SourceFile {
  const stats = statSync(absolutePath);
  const text = providedText ?? readSafeText(absolutePath) ?? '';
  return {
    path: relativePath,
    source,
    text,
    contentHash: hash(text),
    revision: undefined,
    mtimeMs: stats.mtimeMs,
    size: stats.size,
  };
}

export interface WalkedProjectFile {
  path: string;
  absolutePath: string;
  size: number;
  mtimeMs: number;
}

export function walkProjectFiles(projectPath: string): WalkedProjectFile[] {
  const files: WalkedProjectFile[] = [];
  for (const rootName of ['docs', 'game']) {
    const root = path.join(projectPath, rootName);
    if (!existsSync(root)) continue;
    files.push(
      ...walkFiles(root, rootName).map((file) => ({
        path: file.path,
        absolutePath: file.absolutePath,
        size: file.stats.size,
        mtimeMs: file.stats.mtimeMs,
      })),
    );
  }
  return files;
}

export function readProjectTextFile(filePath: string): string | null {
  return readSafeText(filePath);
}

function walkTextFiles(
  root: string,
  rootName: string,
  extensions: Set<string>,
): Array<{ path: string; absolutePath: string; source: IndexSource }> {
  return walkFiles(root, rootName)
    .filter((file) => extensions.has(path.extname(file.path).slice(1).toLowerCase()))
    .map((file) => ({
      path: file.path,
      absolutePath: file.absolutePath,
      source: file.path.startsWith('docs/canon/')
        ? 'canon'
        : file.path.startsWith('docs/decisions/')
          ? 'decisions'
          : 'docs',
    }));
}

function walkFiles(
  root: string,
  rootName: string,
  relative = '',
): Array<{ path: string; absolutePath: string; stats: { mtimeMs: number; size: number } }> {
  const result: Array<{
    path: string;
    absolutePath: string;
    stats: { mtimeMs: number; size: number };
  }> = [];
  const current = path.join(root, relative);
  for (const entry of readdirSync(current, { withFileTypes: true }).sort((left, right) =>
    left.name.localeCompare(right.name),
  )) {
    if (
      [
        '.git',
        '.gamecrafter',
        'node_modules',
        '.godot',
        'Library',
        'Intermediate',
        'Saved',
        'Binaries',
        'Temp',
      ].includes(entry.name)
    )
      continue;
    const relativePath = relative ? path.join(relative, entry.name) : entry.name;
    const absolutePath = path.join(root, relativePath);
    const stats = lstatSync(absolutePath);
    if (stats.isSymbolicLink()) continue;
    if (entry.isDirectory()) result.push(...walkFiles(root, rootName, relativePath));
    else if (entry.isFile()) {
      const fileStats = statSync(absolutePath);
      result.push({
        path: `${rootName}/${relativePath.split(path.sep).join('/')}`,
        absolutePath,
        stats: { mtimeMs: Number(fileStats.mtimeMs), size: Number(fileStats.size) },
      });
    }
  }
  return result;
}

function readSafeText(filePath: string): string | null {
  try {
    const stats = statSync(filePath);
    if (stats.size > maxIndexFileBytes) return null;
    const text = readFileSync(filePath, 'utf8');
    return text.includes('\u0000') ? null : text;
  } catch {
    return null;
  }
}

function assetMetadata(relativePath: string, absolutePath: string, size: number): string {
  const extension = path.extname(relativePath).slice(1).toLowerCase() || 'none';
  const sidecars = [
    `${absolutePath}.meta`,
    `${absolutePath}.import`,
    `${absolutePath}.gamecrafter-provenance.json`,
  ];
  const summaries = sidecars.flatMap((sidecar) => {
    const text = readSafeText(sidecar);
    return text ? [`${path.basename(sidecar)}: ${text.slice(0, maxSidecarBytes)}`] : [];
  });
  return [
    `Asset metadata`,
    `path: ${relativePath}`,
    `size: ${size}`,
    `extension: ${extension}`,
    ...summaries,
  ].join('\n');
}

function isAssetPath(relativePath: string): boolean {
  return relativePath.toLowerCase().startsWith('game/assets/');
}

function isIgnoredPath(relativePath: string): boolean {
  return relativePath.endsWith('.meta') || relativePath.endsWith('.import');
}

function settingStringArray(value: unknown): string[] {
  return Array.isArray(value)
    ? value
        .filter((item): item is string => typeof item === 'string')
        .map((item) => item.replace(/^\./, '').toLowerCase())
    : [];
}

function hash(text: string): string {
  return createHash('sha256').update(text).digest('hex');
}

function gitHeadBlobs(projectPath: string): Map<string, string> {
  try {
    const entries = execFileSync('git', ['ls-tree', '-r', '-z', 'HEAD'], {
      cwd: projectPath,
      encoding: 'utf8',
    }).split('\0');
    const blobs = new Map<string, string>();
    for (const entry of entries) {
      const tab = entry.indexOf('\t');
      if (tab < 0) continue;
      const [mode, type, sha] = entry.slice(0, tab).split(/\s+/);
      if (mode && type === 'blob' && sha)
        blobs.set(
          entry
            .slice(tab + 1)
            .split(path.sep)
            .join('/'),
          sha,
        );
    }
    return blobs;
  } catch {
    return new Map();
  }
}

function gitDirtyPaths(projectPath: string): Set<string> {
  try {
    const output = execFileSync('git', ['status', '--porcelain', '--untracked-files=all', '-z'], {
      cwd: projectPath,
      encoding: 'utf8',
    });
    return new Set(
      output
        .split('\0')
        .filter(Boolean)
        .map((entry) => entry.slice(3).split(path.sep).join('/')),
    );
  } catch {
    return new Set();
  }
}

function gitRevision(
  projectPath: string,
  relativePath: string,
  headBlobs: Map<string, string>,
  dirtyPaths: Set<string>,
): string {
  const normalized = relativePath.split(path.sep).join('/');
  const blob = headBlobs.get(normalized);
  return blob && !dirtyPaths.has(normalized) ? blob : 'worktree';
}

function sameState(left: KnowledgeIndexFileState, right: KnowledgeIndexFileState): boolean {
  return (
    left.source === right.source &&
    left.revision === right.revision &&
    left.contentHash === right.contentHash &&
    left.mtimeMs === right.mtimeMs &&
    left.size === right.size &&
    left.chunkCount === right.chunkCount
  );
}

function sameRecord(left: CanonRecord | undefined, right: CanonRecord | undefined): boolean {
  if (!left || !right) return left === right;
  return JSON.stringify({ ...left, indexedAt: '' }) === JSON.stringify({ ...right, indexedAt: '' });
}

function deterministicPointId(chunkId: string, version: number): string {
  const bytes = createHash('sha256').update(`${chunkId}:${version}`).digest().subarray(0, 16);
  bytes[6] = (bytes[6]! & 0x0f) | 0x50;
  bytes[8] = (bytes[8]! & 0x3f) | 0x80;
  const hex = bytes.toString('hex');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

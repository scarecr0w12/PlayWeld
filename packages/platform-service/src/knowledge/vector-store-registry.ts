import { createHash } from 'node:crypto';
import { existsSync } from 'node:fs';
import path from 'node:path';
import {
  RpcError,
  RpcErrorCode,
  type VectorStoreConfig,
  type VectorStoreDeployment,
} from '@gamecrafter/contracts';
import { LanceDbVectorStore } from './lancedb-vector-store';
import { SqliteVectorStore } from './sqlite-vector-store';
import { ManagedQdrant } from './managed-qdrant';
import { QdrantVectorStore } from './qdrant-vector-store';
import { NullVectorStore, type VectorStore } from './vector-store';

export interface VectorStoreAdapterContext {
  projectId: string;
  projectPath: string;
  config: VectorStoreConfig;
  apiKey?: string;
}

export interface VectorStoreAdapter {
  schemaVersion: 1;
  id: string;
  deployments: VectorStoreDeployment[];
  validateConnection?(config: VectorStoreConfig, allowRemote: boolean): void;
  create(context: VectorStoreAdapterContext): VectorStore;
}

/** Trusted service extensions, not a way to execute Project-supplied code. */
export class VectorStoreRegistry {
  private readonly adapters = new Map<string, VectorStoreAdapter>();
  private readonly stores = new Map<string, VectorStore>();
  private readonly managed = new Map<string, ManagedQdrant>();

  constructor(private readonly binaryPath = bundledQdrantPath()) {
    this.register({
      schemaVersion: 1,
      id: 'lancedb',
      deployments: ['embedded'],
      create: ({ projectId, projectPath }) =>
        new LanceDbVectorStore({
          projectId,
          directory: path.join(projectPath, '.gamecrafter', 'vectors.lancedb'),
        }),
    });
    this.register({
      schemaVersion: 1,
      id: 'sqlite',
      deployments: ['embedded'],
      create: ({ projectId, projectPath }) =>
        new SqliteVectorStore({
          projectId,
          databasePath: path.join(projectPath, '.gamecrafter', 'vectors.sqlite'),
        }),
    });
    this.register({
      schemaVersion: 1,
      id: 'qdrant',
      deployments: ['managed-local', 'external', 'local', 'remote'],
      create: (context) => {
        if (context.config.deployment !== 'managed-local')
          return QdrantVectorStore.fromConfig(context.config, context.apiKey);
        const storagePath = path.join(context.projectPath, '.gamecrafter', 'qdrant');
        let manager = this.managed.get(storagePath);
        if (!manager) {
          manager = new ManagedQdrant({ binaryPath: this.binaryPath, storagePath });
          this.managed.set(storagePath, manager);
        }
        const activeManager = manager;
        return new QdrantVectorStore({
          url: 'http://127.0.0.1',
          collectionPrefix: context.config.collectionPrefix ?? 'gamecrafter',
          timeoutMs: context.config.timeoutMs ?? 5000,
          endpoint: () => activeManager.endpoint(),
        });
      },
    });
  }

  register(adapter: VectorStoreAdapter): void {
    if (
      adapter.schemaVersion !== 1 ||
      !/^[a-z][a-z0-9-]*$/.test(adapter.id) ||
      adapter.id === 'none' ||
      this.adapters.has(adapter.id)
    )
      throw new Error(`Invalid or duplicate vector adapter: ${adapter.id}`);
    this.adapters.set(adapter.id, adapter);
  }

  resolve(
    context: VectorStoreAdapterContext,
    allowRemote: boolean,
  ): { store: VectorStore; identity: string } {
    const kind = context.config.kind ?? 'none';
    if (kind === 'none') return { store: new NullVectorStore(), identity: 'none' };
    const adapter = this.adapters.get(kind);
    if (!adapter)
      throw new RpcError(
        `Vector store adapter is not registered: ${kind}`,
        RpcErrorCode.VectorStoreUnavailable,
      );
    const deployment =
      kind === 'lancedb' || kind === 'sqlite'
        ? 'embedded'
        : (context.config.deployment ?? 'external');
    if (!adapter.deployments.includes(deployment))
      throw new RpcError(
        `Unsupported deployment ${deployment} for ${kind}.`,
        RpcErrorCode.VectorStoreUnavailable,
      );
    const config = { ...context.config, deployment };
    if (deployment === 'remote' && !allowRemote)
      throw new RpcError(
        'Remote vector storage requires explicit permission.',
        RpcErrorCode.VectorStoreUnavailable,
      );
    if (adapter.validateConnection) adapter.validateConnection(config, allowRemote);
    else if (['remote', 'local', 'external'].includes(deployment))
      validateVectorEndpoint(config.url, deployment, allowRemote);
    const identity = createHash('sha256')
      .update(
        JSON.stringify({
          projectId: context.projectId,
          projectPath: context.projectPath,
          config: deployment === 'embedded' ? { kind, deployment } : config,
          apiKey: deployment === 'embedded' ? '' : (context.apiKey ?? ''),
        }),
      )
      .digest('hex');
    let store = this.stores.get(identity);
    if (!store) {
      store = adapter.create({ ...context, config });
      if (store.kind !== kind) throw new Error('Vector adapter returned a mismatched backend.');
      this.stores.set(identity, store);
    }
    return { store, identity };
  }

  async close(): Promise<void> {
    const results = await Promise.allSettled([
      ...[...this.stores.values()].map((store) => store.close?.()),
      ...[...this.managed.values()].map((manager) => manager.close()),
    ]);
    this.stores.clear();
    this.managed.clear();
    const errors = results.flatMap((result) =>
      result.status === 'rejected' ? [result.reason] : [],
    );
    if (errors.length) throw new AggregateError(errors, 'Vector storage shutdown failed.');
  }
}

export function validateVectorEndpoint(
  raw: string | undefined,
  deployment: VectorStoreDeployment,
  allowRemote: boolean,
): void {
  const url = new URL(raw ?? 'http://127.0.0.1:6333');
  if (
    !['http:', 'https:'].includes(url.protocol) ||
    url.username ||
    url.password ||
    url.search ||
    url.hash
  )
    throw new RpcError(
      'Vector endpoints require HTTP(S), with credentials stored separately.',
      RpcErrorCode.InvalidParams,
    );
  const local = ['127.0.0.1', '[::1]'].includes(url.hostname);
  if (deployment === 'local' && !local)
    throw new RpcError(
      'Existing-local vector endpoints must use a loopback IP address.',
      RpcErrorCode.InvalidParams,
    );
  if (deployment === 'remote' && (!allowRemote || url.protocol !== 'https:'))
    throw new RpcError(
      'Remote vector storage requires HTTPS and explicit permission to send embeddings and metadata.',
      RpcErrorCode.VectorStoreUnavailable,
    );
  // Legacy external configurations retain their existing endpoint behavior.
}

function bundledQdrantPath(): string {
  const name = process.platform === 'win32' ? 'qdrant.exe' : 'qdrant';
  const installed = path.join(path.dirname(process.execPath), 'resources', 'qdrant', name);
  return existsSync(installed)
    ? installed
    : path.resolve(__dirname, '../../../../apps/control-room/resources/qdrant', name);
}

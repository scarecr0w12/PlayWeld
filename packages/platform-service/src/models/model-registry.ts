import {
  RpcError,
  RpcErrorCode,
  redact,
  uuidv7,
  type Model,
  type ModelCapabilities,
  type ModelFieldMetadata,
  type ModelPool,
  type ModelPoolTarget,
  type ModelPricing,
  type ProviderAccount,
  type ProviderKind,
} from '@gamecrafter/contracts';
import type { Database } from '../db/database';
import { CredentialStore } from '../profile/credential-store';
import { enrichDiscoveredModel } from './model-catalog';
import type {
  DiscoveredModel,
  ModelProvider,
  ModelProviderRegistry,
  ProviderRuntimeAccount,
} from './providers';

export interface AddProviderAccountInput {
  providerKind: ProviderKind;
  displayName: string;
  baseUrl: string;
  providerOptions?: Record<string, string>;
  apiKey?: string;
  headers?: Record<string, string>;
  isLocal?: boolean;
}

export interface ProviderAccountPatch {
  displayName?: string;
  baseUrl?: string;
  providerOptions?: Record<string, string>;
  apiKey?: string | null;
  headers?: Record<string, string>;
  enabled?: boolean;
  isLocal?: boolean;
}

export interface ModelUpdatePatch {
  enabled?: boolean;
  displayName?: string;
  catalogModelId?: string | null;
  capabilities?: Partial<ModelCapabilities>;
  pricing?: Partial<ModelPricing>;
  tags?: string[];
  workTypes?: string[];
  roles?: string[];
}

export interface ModelPoolInput {
  name: string;
  scope: ModelPool['scope'];
  projectId?: string;
  target: ModelPoolTarget | null;
  modelIds: string[];
}

export interface ModelPoolPatch {
  name?: string;
  scope?: ModelPool['scope'];
  projectId?: string | null;
  target?: ModelPoolTarget | null;
  modelIds?: string[];
}

interface ProviderAccountRow {
  accountId: string;
  providerKind: ProviderKind;
  displayName: string;
  baseUrl: string;
  credentialRef: string | null;
  hasCredential: number;
  headersJson: string;
  providerOptionsJson: string;
  isLocal: number;
  privacy: ProviderAccount['privacy'];
  enabled: number;
  createdAt: string;
  updatedAt: string;
}

interface ModelRow {
  modelId: string;
  accountId: string;
  providerModelId: string;
  catalogModelId: string | null;
  displayName: string;
  capabilitiesJson: string;
  pricingJson: string;
  metadataSource: Model['metadataSource'];
  metadataUpdatedAt: string;
  enabled: number;
  tagsJson: string;
  workTypesJson: string;
  rolesJson: string;
  metadataFieldsJson: string;
}

interface ModelPoolRow {
  poolId: string;
  name: string;
  scope: ModelPool['scope'];
  projectId: string | null;
  targetJson: string;
  modelIdsJson: string;
  createdAt: string;
  updatedAt: string;
}

interface AccountSecrets {
  apiKey?: string;
  headers: Record<string, string>;
}

const accountColumns = `account_id AS accountId, provider_kind AS providerKind,
  display_name AS displayName, base_url AS baseUrl, credential_ref AS credentialRef,
  provider_options AS providerOptionsJson, has_credential AS hasCredential,
  headers AS headersJson, is_local AS isLocal,
  privacy, enabled, created_at AS createdAt, updated_at AS updatedAt`;
const modelColumns = `model_id AS modelId, account_id AS accountId,
  provider_model_id AS providerModelId, catalog_model_id AS catalogModelId,
  display_name AS displayName,
  capabilities AS capabilitiesJson, pricing AS pricingJson,
  metadata_source AS metadataSource, metadata_updated_at AS metadataUpdatedAt,
  metadata_fields AS metadataFieldsJson,
  enabled, tags AS tagsJson, work_types AS workTypesJson, roles AS rolesJson`;
const poolColumns = `pool_id AS poolId, name, scope, project_id AS projectId,
  target AS targetJson, model_ids AS modelIdsJson,
  created_at AS createdAt, updated_at AS updatedAt`;

export class ModelRegistry {
  constructor(
    private readonly database: Database,
    private readonly credentials: CredentialStore,
    private readonly providers: ModelProviderRegistry,
    private readonly now: () => Date = () => new Date(),
  ) {}

  listAccounts(): ProviderAccount[] {
    return this.database
      .prepare(`SELECT ${accountColumns} FROM provider_accounts ORDER BY display_name, account_id`)
      .all<ProviderAccountRow>()
      .map(accountFromRow);
  }

  getAccount(accountId: string): ProviderAccount | undefined {
    const row = this.database
      .prepare(`SELECT ${accountColumns} FROM provider_accounts WHERE account_id = ?`)
      .get<ProviderAccountRow>(accountId);
    return row ? accountFromRow(row) : undefined;
  }

  getRuntimeAccount(accountId: string): ProviderRuntimeAccount | undefined {
    const row = this.database
      .prepare(`SELECT ${accountColumns} FROM provider_accounts WHERE account_id = ?`)
      .get<ProviderAccountRow>(accountId);
    if (!row) return undefined;
    const account = accountFromRow(row);
    const secrets = row.credentialRef ? this.readSecrets(row.credentialRef) : { headers: {} };
    return {
      ...account,
      ...(secrets.apiKey ? { apiKey: secrets.apiKey } : {}),
      headers: { ...account.headers, ...secrets.headers },
    };
  }

  addAccount(input: AddProviderAccountInput): ProviderAccount {
    const accountId = uuidv7();
    const credentialRef = `provider/${accountId}`;
    const { publicHeaders, secretHeaders } = splitHeaders(input.headers ?? {});
    const secrets: AccountSecrets = {
      ...(input.apiKey ? { apiKey: input.apiKey } : {}),
      headers: secretHeaders,
    };
    const hasCredential = Boolean(secrets.apiKey || Object.keys(secretHeaders).length > 0);
    if (hasCredential) this.writeSecrets(credentialRef, secrets);
    const isLocal = input.isLocal ?? isLocalBaseUrl(input.baseUrl);
    const now = this.now().toISOString();
    this.database
      .prepare(
        `INSERT INTO provider_accounts (
          account_id, provider_kind, display_name, base_url, credential_ref,
          provider_options, has_credential, headers, is_local, privacy, enabled, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        accountId,
        input.providerKind,
        input.displayName,
        input.baseUrl,
        hasCredential ? credentialRef : null,
        JSON.stringify(input.providerOptions ?? {}),
        Number(hasCredential),
        JSON.stringify(publicHeaders),
        Number(isLocal),
        isLocal ? 'local' : 'cloud',
        1,
        now,
        now,
      );
    return this.getAccount(accountId)!;
  }

  updateAccount(accountId: string, patch: ProviderAccountPatch): ProviderAccount {
    const currentRow = this.getAccountRow(accountId);
    if (!currentRow) {
      throw new RpcError(`Provider account not found: ${accountId}`, RpcErrorCode.AccountNotFound);
    }
    const current = accountFromRow(currentRow);
    const credentialRef = currentRow.credentialRef ?? `provider/${accountId}`;
    const currentSecrets = currentRow.credentialRef
      ? this.readSecrets(currentRow.credentialRef)
      : { headers: {} };
    const apiKey =
      patch.apiKey === undefined
        ? currentSecrets.apiKey
        : patch.apiKey === null
          ? undefined
          : patch.apiKey;
    const { publicHeaders, secretHeaders } =
      patch.headers === undefined
        ? { publicHeaders: current.headers, secretHeaders: currentSecrets.headers }
        : splitHeaders(patch.headers, currentSecrets.headers);
    const secrets: AccountSecrets = {
      ...(apiKey ? { apiKey } : {}),
      headers: secretHeaders,
    };
    const hasCredential = Boolean(apiKey || Object.keys(secretHeaders).length > 0);
    if (hasCredential) this.writeSecrets(credentialRef, secrets);
    else this.credentials.delete(credentialRef);
    const isLocal = patch.isLocal ?? current.isLocal;
    const updatedAt = this.now().toISOString();
    this.database
      .prepare(
        `UPDATE provider_accounts SET display_name = ?, base_url = ?, provider_options = ?,
          credential_ref = ?, has_credential = ?, headers = ?, is_local = ?, privacy = ?, enabled = ?, updated_at = ?
         WHERE account_id = ?`,
      )
      .run(
        patch.displayName ?? current.displayName,
        patch.baseUrl ?? current.baseUrl,
        JSON.stringify(patch.providerOptions ?? current.providerOptions),
        hasCredential ? credentialRef : null,
        Number(hasCredential),
        JSON.stringify(publicHeaders),
        Number(isLocal),
        isLocal ? 'local' : 'cloud',
        Number(patch.enabled ?? current.enabled),
        updatedAt,
        accountId,
      );
    return this.getAccount(accountId)!;
  }

  removeAccount(accountId: string): void {
    const account = this.getAccountRow(accountId);
    if (!account) {
      throw new RpcError(`Provider account not found: ${accountId}`, RpcErrorCode.AccountNotFound);
    }
    const modelIds = this.listModels({ accountId }).map((model) => model.modelId);
    this.database.transaction(() => {
      this.database.prepare('DELETE FROM models WHERE account_id = ?').run(accountId);
      for (const pool of this.listPools()) {
        const modelIdsLeft = pool.modelIds.filter((modelId) => !modelIds.includes(modelId));
        if (modelIdsLeft.length !== pool.modelIds.length) {
          this.writePool({ ...pool, modelIds: modelIdsLeft, updatedAt: this.now().toISOString() });
        }
      }
      this.database.prepare('DELETE FROM provider_accounts WHERE account_id = ?').run(accountId);
    });
    if (account.credentialRef) this.credentials.delete(account.credentialRef);
  }

  listModels(options: { accountId?: string; enabledOnly?: boolean } = {}): Model[] {
    const rows = this.database
      .prepare(`SELECT ${modelColumns} FROM models ORDER BY display_name, model_id`)
      .all<ModelRow>();
    const accounts = new Map(this.listAccounts().map((account) => [account.accountId, account]));
    return rows
      .map(modelFromRow)
      .filter((model) => !options.accountId || model.accountId === options.accountId)
      .filter((model) => {
        if (!options.enabledOnly) return true;
        const account = accounts.get(model.accountId);
        return model.enabled && account?.enabled === true;
      });
  }

  getModel(modelId: string): Model | undefined {
    const row = this.database
      .prepare(`SELECT ${modelColumns} FROM models WHERE model_id = ?`)
      .get<ModelRow>(modelId);
    return row ? modelFromRow(row) : undefined;
  }

  async discover(
    accountId: string,
    options: { preview?: boolean; providerModelIds?: string[] } = {},
  ): Promise<{ added: number; updated: number; models: Model[] }> {
    const account = this.getRuntimeAccount(accountId);
    if (!account) {
      throw new RpcError(`Provider account not found: ${accountId}`, RpcErrorCode.AccountNotFound);
    }
    const provider = this.providers.get(account.providerKind);
    if (!provider) {
      throw new RpcError(
        `No provider adapter for ${account.providerKind}`,
        RpcErrorCode.ProviderRequestFailed,
      );
    }
    const discovered = (await provider.listModels(account)).map((model) =>
      enrichDiscoveredModel(account.providerKind, model),
    );
    const selected = options.providerModelIds && new Set(options.providerModelIds);
    if (selected) {
      const available = new Set(discovered.map((item) => item.providerModelId));
      for (const id of selected) {
        if (!available.has(id)) {
          throw new RpcError(
            `Provider model is no longer available: ${id}`,
            RpcErrorCode.InvalidParams,
          );
        }
      }
    }
    const models: Model[] = [];
    let added = 0;
    let updated = 0;
    const metadataUpdatedAt = this.now().toISOString();
    for (const item of discovered) {
      if (selected && !selected.has(item.providerModelId)) continue;
      const modelId = `${accountId}/${item.providerModelId}`;
      const existing = this.getModel(modelId);
      const discoveredFields = discoveredFieldMetadata(item, metadataUpdatedAt);
      const metadataFields = mergeFieldMetadata(existing?.metadataFields ?? {}, discoveredFields);
      const canReplace = (field: string): boolean =>
        discoveredFields[field] !== undefined &&
        metadataPriority(discoveredFields[field]!.source) >=
          metadataPriority(existing?.metadataFields[field]?.source ?? 'legacy');
      const capabilities = mergeDiscoveredObject(
        existing?.capabilities ?? emptyCapabilities(),
        item.capabilities,
        'capabilities',
        canReplace,
      );
      const pricing = mergeDiscoveredObject(
        existing?.pricing ?? mergePricing(),
        item.pricing,
        'pricing',
        canReplace,
      );
      const model: Model = {
        modelId,
        accountId,
        providerModelId: item.providerModelId,
        catalogModelId:
          item.catalogModelId !== undefined && canReplace('catalogModelId')
            ? item.catalogModelId
            : (existing?.catalogModelId ?? null),
        displayName:
          item.displayName !== undefined && canReplace('displayName')
            ? item.displayName
            : (existing?.displayName ?? item.displayName ?? item.providerModelId),
        capabilities,
        pricing,
        metadataSource: Object.values(metadataFields).some((field) => field.source === 'manual')
          ? 'manual'
          : 'provider',
        metadataUpdatedAt,
        metadataFields,
        enabled: existing?.enabled ?? true,
        tags: mergeDiscoveredArray(existing?.tags ?? [], item.tags, 'tags', canReplace),
        workTypes: mergeDiscoveredArray(
          existing?.workTypes ?? [],
          item.workTypes,
          'workTypes',
          canReplace,
        ),
        roles: mergeDiscoveredArray(existing?.roles ?? [], item.roles, 'roles', canReplace),
      };
      models.push(model);
      if (options.preview) continue;
      this.writeModel(model);
      if (existing) updated += 1;
      else added += 1;
    }
    return { added, updated, models };
  }

  updateModel(modelId: string, patch: ModelUpdatePatch): Model {
    const current = this.getModel(modelId);
    if (!current) throw new RpcError(`Model not found: ${modelId}`, RpcErrorCode.ModelNotFound);
    const metadataFields = { ...current.metadataFields };
    const updatedAt = this.now().toISOString();
    if (patch.displayName !== undefined)
      metadataFields.displayName = manualFieldMetadata(updatedAt);
    if (patch.catalogModelId !== undefined) {
      if (patch.catalogModelId === null) delete metadataFields.catalogModelId;
      else metadataFields.catalogModelId = manualFieldMetadata(updatedAt);
    }
    for (const key of Object.keys(patch.capabilities ?? {})) {
      const field = `capabilities.${key}`;
      if (patch.capabilities?.[key as keyof ModelCapabilities] === null)
        delete metadataFields[field];
      else metadataFields[field] = manualFieldMetadata(updatedAt);
    }
    for (const key of Object.keys(patch.pricing ?? {})) {
      const field = `pricing.${key}`;
      if (patch.pricing?.[key as keyof ModelPricing] === null) delete metadataFields[field];
      else metadataFields[field] = manualFieldMetadata(updatedAt);
    }
    if (patch.tags !== undefined) metadataFields.tags = manualFieldMetadata(updatedAt);
    if (patch.workTypes !== undefined) metadataFields.workTypes = manualFieldMetadata(updatedAt);
    if (patch.roles !== undefined) metadataFields.roles = manualFieldMetadata(updatedAt);
    const updated: Model = {
      ...current,
      ...patch,
      capabilities: patch.capabilities
        ? mergeCapabilities({ ...current.capabilities, ...patch.capabilities })
        : current.capabilities,
      pricing: patch.pricing ? { ...current.pricing, ...patch.pricing } : current.pricing,
      metadataSource: Object.values(metadataFields).some((field) => field.source === 'manual')
        ? 'manual'
        : 'provider',
      metadataUpdatedAt: updatedAt,
      metadataFields,
    };
    this.writeModel(updated);
    return updated;
  }

  listPools(projectId?: string): ModelPool[] {
    const pools = this.database
      .prepare(`SELECT ${poolColumns} FROM model_pools ORDER BY scope, name, pool_id`)
      .all<ModelPoolRow>()
      .map(poolFromRow);
    if (!projectId) return pools;
    return pools.filter((pool) => pool.scope === 'platform' || pool.projectId === projectId);
  }

  createPool(input: ModelPoolInput): ModelPool {
    const projectId = input.scope === 'project' ? (input.projectId ?? null) : null;
    if (input.scope === 'project' && !projectId) {
      throw new RpcError('Project-scoped pools require a projectId', RpcErrorCode.InvalidParams);
    }
    const modelIds = uniqueModelIds(input.modelIds);
    for (const modelId of modelIds) this.requireModel(modelId);
    const now = this.now().toISOString();
    const pool: ModelPool = {
      poolId: uuidv7(),
      name: input.name,
      scope: input.scope,
      projectId,
      target: input.target,
      modelIds,
      createdAt: now,
      updatedAt: now,
    };
    this.writePool(pool);
    return pool;
  }

  updatePool(poolId: string, patch: ModelPoolPatch): ModelPool {
    const current = this.getPool(poolId);
    if (!current) throw new RpcError(`Model pool not found: ${poolId}`, RpcErrorCode.PoolNotFound);
    const scope = patch.scope ?? current.scope;
    const projectId =
      scope === 'platform'
        ? null
        : patch.projectId === undefined
          ? current.projectId
          : patch.projectId;
    if (scope === 'project' && !projectId) {
      throw new RpcError('Project-scoped pools require a projectId', RpcErrorCode.InvalidParams);
    }
    const modelIds =
      patch.modelIds === undefined ? current.modelIds : uniqueModelIds(patch.modelIds);
    for (const modelId of modelIds) this.requireModel(modelId);
    const updated: ModelPool = {
      ...current,
      ...patch,
      scope,
      projectId,
      modelIds,
      updatedAt: this.now().toISOString(),
    };
    this.writePool(updated);
    return updated;
  }

  deletePool(poolId: string): void {
    if (!this.getPool(poolId)) {
      throw new RpcError(`Model pool not found: ${poolId}`, RpcErrorCode.PoolNotFound);
    }
    this.database.prepare('DELETE FROM model_pools WHERE pool_id = ?').run(poolId);
  }

  async testAccount(
    accountId: string,
  ): Promise<{ ok: boolean; latencyMs: number; discoveredModels: number; error?: string }> {
    const startedAt = Date.now();
    try {
      const account = this.getRuntimeAccount(accountId);
      if (!account) {
        throw new RpcError(
          `Provider account not found: ${accountId}`,
          RpcErrorCode.AccountNotFound,
        );
      }
      const provider = this.providers.get(account.providerKind);
      if (!provider) {
        throw new RpcError(
          `No provider adapter for ${account.providerKind}`,
          RpcErrorCode.ProviderRequestFailed,
        );
      }
      const discoveredModels = await provider.listModels(account);
      return {
        ok: true,
        latencyMs: Date.now() - startedAt,
        discoveredModels: discoveredModels.length,
      };
    } catch (error) {
      return {
        ok: false,
        latencyMs: Date.now() - startedAt,
        discoveredModels: 0,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  getProvider(providerKind: ProviderKind): ModelProvider {
    const provider = this.providers.get(providerKind);
    if (!provider) {
      throw new RpcError(
        `No provider adapter for ${providerKind}`,
        RpcErrorCode.ProviderRequestFailed,
      );
    }
    return provider;
  }

  private getAccountRow(accountId: string): ProviderAccountRow | undefined {
    return this.database
      .prepare(`SELECT ${accountColumns} FROM provider_accounts WHERE account_id = ?`)
      .get<ProviderAccountRow>(accountId);
  }

  private getSecrets(credentialRef: string | null): AccountSecrets {
    if (!credentialRef) return { headers: {} };
    const encoded = this.credentials.get(credentialRef);
    if (!encoded) return { headers: {} };
    const value = JSON.parse(encoded) as Partial<AccountSecrets>;
    return {
      ...(typeof value.apiKey === 'string' ? { apiKey: value.apiKey } : {}),
      headers: value.headers ?? {},
    };
  }

  private readSecrets(credentialRef: string): AccountSecrets {
    return this.getSecrets(credentialRef);
  }

  private writeSecrets(credentialRef: string, secrets: AccountSecrets): void {
    this.credentials.put(credentialRef, JSON.stringify(secrets));
  }

  private requireModel(modelId: string): Model {
    const model = this.getModel(modelId);
    if (!model) throw new RpcError(`Model not found: ${modelId}`, RpcErrorCode.ModelNotFound);
    return model;
  }

  private getPool(poolId: string): ModelPool | undefined {
    const row = this.database
      .prepare(`SELECT ${poolColumns} FROM model_pools WHERE pool_id = ?`)
      .get<ModelPoolRow>(poolId);
    return row ? poolFromRow(row) : undefined;
  }

  private writeModel(model: Model): void {
    this.database
      .prepare(
        `INSERT INTO models (
          model_id, account_id, provider_model_id, catalog_model_id, display_name,
          capabilities, pricing, metadata_source, metadata_updated_at, metadata_fields,
          enabled, tags, work_types, roles
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(model_id) DO UPDATE SET
          catalog_model_id = excluded.catalog_model_id,
          display_name = excluded.display_name,
          capabilities = excluded.capabilities,
          pricing = excluded.pricing,
          metadata_source = excluded.metadata_source,
          metadata_updated_at = excluded.metadata_updated_at,
          metadata_fields = excluded.metadata_fields,
          enabled = excluded.enabled,
          tags = excluded.tags,
          work_types = excluded.work_types,
          roles = excluded.roles`,
      )
      .run(
        model.modelId,
        model.accountId,
        model.providerModelId,
        model.catalogModelId,
        model.displayName,
        JSON.stringify(model.capabilities),
        JSON.stringify(model.pricing),
        model.metadataSource,
        model.metadataUpdatedAt,
        JSON.stringify(model.metadataFields),
        Number(model.enabled),
        JSON.stringify(model.tags),
        JSON.stringify(model.workTypes),
        JSON.stringify(model.roles),
      );
  }

  private writePool(pool: ModelPool): void {
    this.database
      .prepare(
        `INSERT INTO model_pools
          (pool_id, name, scope, project_id, target, model_ids, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT(pool_id) DO UPDATE SET
           name = excluded.name,
           scope = excluded.scope,
           project_id = excluded.project_id,
           target = excluded.target,
           model_ids = excluded.model_ids,
           updated_at = excluded.updated_at`,
      )
      .run(
        pool.poolId,
        pool.name,
        pool.scope,
        pool.projectId,
        JSON.stringify(pool.target),
        JSON.stringify(pool.modelIds),
        pool.createdAt,
        pool.updatedAt,
      );
  }
}

function accountFromRow(row: ProviderAccountRow): ProviderAccount {
  return {
    accountId: row.accountId,
    providerKind: row.providerKind,
    displayName: row.displayName,
    baseUrl: row.baseUrl,
    providerOptions: JSON.parse(row.providerOptionsJson) as Record<string, string>,
    hasCredential: row.hasCredential === 1,
    headers: JSON.parse(row.headersJson) as Record<string, string>,
    isLocal: row.isLocal === 1,
    privacy: row.privacy,
    enabled: row.enabled === 1,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

function modelFromRow(row: ModelRow): Model {
  const storedFields = JSON.parse(row.metadataFieldsJson) as Record<string, ModelFieldMetadata>;
  const legacy = Object.keys(storedFields).length === 0;
  const rawCapabilities = JSON.parse(row.capabilitiesJson) as ModelCapabilities;
  const capabilities =
    legacy && row.metadataSource === 'provider'
      ? (Object.fromEntries(
          Object.entries(rawCapabilities).map(([key, value]) => [
            key,
            typeof value === 'boolean' ? null : value,
          ]),
        ) as ModelCapabilities)
      : rawCapabilities;
  return {
    modelId: row.modelId,
    accountId: row.accountId,
    providerModelId: row.providerModelId,
    catalogModelId: row.catalogModelId,
    displayName: row.displayName,
    capabilities,
    pricing: JSON.parse(row.pricingJson) as ModelPricing,
    metadataSource: row.metadataSource,
    metadataUpdatedAt: row.metadataUpdatedAt,
    metadataFields: legacy
      ? legacyFieldMetadata(
          row.metadataSource === 'manual' ? 'manual' : 'legacy',
          row.metadataUpdatedAt,
        )
      : storedFields,
    enabled: row.enabled === 1,
    tags: JSON.parse(row.tagsJson) as string[],
    workTypes: JSON.parse(row.workTypesJson) as string[],
    roles: JSON.parse(row.rolesJson) as string[],
  };
}

function poolFromRow(row: ModelPoolRow): ModelPool {
  return {
    poolId: row.poolId,
    name: row.name,
    scope: row.scope,
    projectId: row.projectId,
    target: JSON.parse(row.targetJson) as ModelPoolTarget | null,
    modelIds: JSON.parse(row.modelIdsJson) as string[],
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

function mergeCapabilities(discovered?: Partial<ModelCapabilities>): ModelCapabilities {
  return {
    chat: null,
    tools: null,
    vision: null,
    structuredOutput: null,
    streaming: null,
    embeddings: null,
    contextWindow: null,
    maxOutputTokens: null,
    ...discovered,
  };
}

function emptyCapabilities(): ModelCapabilities {
  return mergeCapabilities();
}

function mergePricing(discovered?: Partial<ModelPricing>): ModelPricing {
  return {
    inputPerMTokUsd: null,
    outputPerMTokUsd: null,
    ...discovered,
  };
}

function discoveredFieldMetadata(
  model: DiscoveredModel,
  updatedAt: string,
): Record<string, ModelFieldMetadata> {
  const source = model.metadataSource ?? 'provider-api';
  const confidence = model.confidence ?? (source === 'provider-catalog' ? 'high' : 'medium');
  const metadata: Record<string, ModelFieldMetadata> = {};
  const add = (field: string) => {
    metadata[field] = model.fieldMetadata?.[field] ?? {
      source,
      updatedAt,
      sourceUrl: model.sourceUrl ?? null,
      confidence,
    };
  };

  if (model.displayName !== undefined) add('displayName');
  if (model.catalogModelId !== undefined) add('catalogModelId');
  for (const [key, value] of Object.entries(model.capabilities ?? {})) {
    if (value !== undefined && value !== null) add(`capabilities.${key}`);
  }
  for (const [key, value] of Object.entries(model.pricing ?? {})) {
    if (value !== undefined && value !== null) add(`pricing.${key}`);
  }
  if (model.tags !== undefined) add('tags');
  if (model.workTypes !== undefined) add('workTypes');
  if (model.roles !== undefined) add('roles');
  return metadata;
}

function mergeFieldMetadata(
  existing: Record<string, ModelFieldMetadata>,
  incoming: Record<string, ModelFieldMetadata>,
): Record<string, ModelFieldMetadata> {
  const result = { ...existing };
  for (const [field, metadata] of Object.entries(incoming)) {
    if (
      metadataPriority(metadata.source) >= metadataPriority(existing[field]?.source ?? 'legacy')
    ) {
      result[field] = metadata;
    }
  }
  return result;
}

function metadataPriority(source: ModelFieldMetadata['source']): number {
  switch (source) {
    case 'manual':
      return 5;
    case 'account-config':
      return 4.5;
    case 'provider-api':
      return 4;
    case 'provider-catalog':
      return 3;
    case 'derived':
      return 2;
    case 'legacy':
      return 1;
  }
}

function mergeDiscoveredObject<T extends object>(
  current: T,
  discovered: Partial<T> | undefined,
  prefix: string,
  canReplace: (field: string) => boolean,
): T {
  const result = { ...current };
  for (const [key, value] of Object.entries(discovered ?? {})) {
    if (value === undefined || value === null || !canReplace(`${prefix}.${key}`)) continue;
    (result as Record<string, unknown>)[key] = value;
  }
  return result;
}

function mergeDiscoveredArray(
  current: string[],
  discovered: string[] | undefined,
  field: string,
  canReplace: (field: string) => boolean,
): string[] {
  if (discovered === undefined || !canReplace(field)) return current;
  return [...new Set(discovered)];
}

function manualFieldMetadata(updatedAt: string): ModelFieldMetadata {
  return { source: 'manual', updatedAt, sourceUrl: null, confidence: 'high' };
}

function legacyFieldMetadata(
  source: 'manual' | 'legacy',
  updatedAt: string,
): Record<string, ModelFieldMetadata> {
  const metadata: Record<string, ModelFieldMetadata> = {};
  for (const field of [
    'displayName',
    'catalogModelId',
    'capabilities.chat',
    'capabilities.tools',
    'capabilities.vision',
    'capabilities.structuredOutput',
    'capabilities.streaming',
    'capabilities.embeddings',
    'capabilities.contextWindow',
    'capabilities.maxInputTokens',
    'capabilities.maxOutputTokens',
    'pricing.inputPerMTokUsd',
    'pricing.outputPerMTokUsd',
    'tags',
    'workTypes',
    'roles',
  ]) {
    metadata[field] = {
      source,
      updatedAt,
      sourceUrl: null,
      confidence: 'low',
    };
  }
  return metadata;
}

function splitHeaders(
  headers: Record<string, string>,
  existingSecrets: Record<string, string> = {},
): { publicHeaders: Record<string, string>; secretHeaders: Record<string, string> } {
  const publicHeaders: Record<string, string> = {};
  const secretHeaders: Record<string, string> = {};
  for (const [name, value] of Object.entries(headers)) {
    const placeholder = value === '[REDACTED]' && existingSecrets[name] !== undefined;
    if (sensitiveHeaderPattern.test(name) || redact(value) !== value || placeholder) {
      const secret = value === '[REDACTED]' ? existingSecrets[name] : value;
      if (secret !== undefined) secretHeaders[name] = secret;
      publicHeaders[name] = '[REDACTED]';
    } else {
      publicHeaders[name] = value;
    }
  }
  return { publicHeaders, secretHeaders };
}

function isLocalBaseUrl(baseUrl: string): boolean {
  try {
    const hostname = new URL(baseUrl).hostname.toLowerCase();
    return (
      hostname === 'localhost' ||
      hostname.endsWith('.localhost') ||
      hostname === '127.0.0.1' ||
      hostname === '::1' ||
      hostname === '0.0.0.0'
    );
  } catch {
    return false;
  }
}

function uniqueModelIds(modelIds: string[]): string[] {
  return [...new Set(modelIds)];
}

const sensitiveHeaderPattern =
  /(authorization|api[-_]?key|token|secret|password|cookie|credential)/i;

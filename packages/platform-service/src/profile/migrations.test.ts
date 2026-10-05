import { describe, expect, it } from 'vitest';
import { Database } from '../db/database';
import { migrate } from '../db/migrator';
import { profileMigrations } from './migrations';

describe('profile migrations', () => {
  it('creates model usage and MCP, plugin, engine, asset, backup, DCC, and A2A persistence tables', () => {
    const database = Database.open(':memory:');
    try {
      migrate(database, profileMigrations);
      const tables = database
        .prepare("SELECT name FROM sqlite_master WHERE type = 'table'")
        .all<{ name: string }>()
        .map((row) => row.name);
      expect(tables).toContain('mcp_connections');
      expect(tables).toContain('mcp_tool_overrides');
      expect(tables).toContain('mcp_usage');
      expect(tables).toContain('model_usage');
      expect(tables).toContain('installed_plugins');
      expect(tables).toContain('plugin_project_enablement');
      expect(tables).toContain('plugin_usage');
      expect(tables).toContain('plugin_host_calls');
      expect(tables).toContain('engine_installations');
      expect(tables).toContain('asset_provider_accounts');
      expect(tables).toContain('backup_identities');
      expect(tables).toContain('backup_destinations');
      expect(tables).toContain('backup_plans');
      expect(tables).toContain('backup_runs');
      expect(tables).toContain('dcc_installations');
      expect(tables).toContain('update_states');
      expect(tables).toContain('decision_assessments');
      expect(tables).toContain('a2a_connections');
      expect(tables).toContain('a2a_inbound_config');
      expect(tables).toContain('a2a_inbound_clients');
      expect(tables).toContain('a2a_remote_tasks');
      expect(database.prepare('SELECT id FROM schema_migrations').all()).toHaveLength(18);
      expect(
        database
          .prepare('PRAGMA table_info(a2a_remote_tasks)')
          .all<{ name: string }>()
          .map((row) => row.name),
      ).toEqual([
        'connection_id',
        'remote_task_id',
        'remote_context_id',
        'project_id',
        'local_task_id',
        'call_id',
        'status_state',
        'status_timestamp',
        'created_at',
        'updated_at',
      ]);
      expect(
        database
          .prepare('PRAGMA table_info(model_usage)')
          .all<{ name: string }>()
          .map((row) => row.name),
      ).toContain('cost_status');
    } finally {
      database.close();
    }
  });

  it('adds outbound A2A task tracking as an additive migration', () => {
    const database = Database.open(':memory:');
    try {
      migrate(database, profileMigrations.slice(0, 17));
      database
        .prepare(
          `INSERT INTO a2a_connections
            (connection_id, name, endpoint, auth_kind, credential_ref, agent_card_json, created_at, updated_at)
           VALUES (?, ?, ?, ?, NULL, NULL, ?, ?)`,
        )
        .run(
          '019535d4-2c00-7000-8000-000000000301',
          'Existing A2A connection',
          'http://127.0.0.1:8765',
          'none',
          '2026-10-01T00:00:00.000Z',
          '2026-10-01T00:00:00.000Z',
        );

      migrate(database, profileMigrations);

      expect(database.prepare('SELECT name FROM a2a_connections').get()).toEqual({
        name: 'Existing A2A connection',
      });
      expect(database.prepare('SELECT id FROM schema_migrations WHERE id = 18').get()).toEqual({
        id: 18,
      });
    } finally {
      database.close();
    }
  });

  it('adds provider options and metadata provenance without replacing existing records', () => {
    const database = Database.open(':memory:');
    try {
      migrate(database, profileMigrations.slice(0, 15));
      database
        .prepare(
          `INSERT INTO provider_accounts (
            account_id, provider_kind, display_name, base_url, credential_ref, has_credential,
            headers, is_local, privacy, enabled, created_at, updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        )
        .run(
          '019535d4-2c00-7000-8000-000000000301',
          'openai-compatible',
          'Existing local account',
          'http://localhost:11434/v1',
          null,
          0,
          '{}',
          1,
          'local',
          1,
          '2026-09-28T00:00:00.000Z',
          '2026-09-28T00:00:00.000Z',
        );
      database
        .prepare(
          `INSERT INTO models (
            model_id, account_id, provider_model_id, display_name, capabilities, pricing,
            metadata_source, metadata_updated_at, enabled, tags, work_types, roles
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        )
        .run(
          '019535d4-2c00-7000-8000-000000000301/qwen',
          '019535d4-2c00-7000-8000-000000000301',
          'qwen',
          'Qwen',
          JSON.stringify({
            chat: true,
            tools: false,
            vision: false,
            structuredOutput: false,
            streaming: false,
            embeddings: false,
            contextWindow: null,
            maxInputTokens: null,
            maxOutputTokens: null,
          }),
          JSON.stringify({ inputPerMTokUsd: null, outputPerMTokUsd: null }),
          'provider',
          '2026-09-28T00:00:00.000Z',
          1,
          '[]',
          '[]',
          '[]',
        );

      migrate(database, profileMigrations);

      expect(
        database
          .prepare('SELECT provider_options AS providerOptions FROM provider_accounts')
          .get<{ providerOptions: string }>(),
      ).toEqual({ providerOptions: '{}' });
      expect(
        database
          .prepare('SELECT metadata_fields AS metadataFields FROM models')
          .get<{ metadataFields: string }>(),
      ).toEqual({ metadataFields: '{}' });
      expect(
        database
          .prepare('SELECT catalog_model_id AS catalogModelId FROM models')
          .get<{ catalogModelId: string | null }>(),
      ).toEqual({ catalogModelId: null });
      expect(database.prepare('SELECT account_id FROM provider_accounts').get()).toEqual({
        account_id: '019535d4-2c00-7000-8000-000000000301',
      });
      expect(database.prepare('SELECT model_id FROM models').get()).toEqual({
        model_id: '019535d4-2c00-7000-8000-000000000301/qwen',
      });
    } finally {
      database.close();
    }
  });
});

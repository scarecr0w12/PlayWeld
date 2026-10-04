import type { Migration } from '../db/migrator';

export const profileMigrations: Migration[] = [
  {
    id: 1,
    name: 'create profile tables',
    up: `
      CREATE TABLE service_meta (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL
      );
      CREATE TABLE projects_registry (
        project_id TEXT PRIMARY KEY,
        path TEXT NOT NULL UNIQUE,
        name TEXT NOT NULL,
        engine_family TEXT NOT NULL,
        registered_at TEXT NOT NULL,
        last_opened_at TEXT
      );
    `,
  },
  {
    id: 2,
    name: 'create platform settings table',
    up: `
      CREATE TABLE settings_values (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );
    `,
  },
  {
    id: 3,
    name: 'create model registry and routing tables',
    up: `
      CREATE TABLE credentials (
        ref TEXT PRIMARY KEY,
        ciphertext BLOB NOT NULL,
        iv BLOB NOT NULL,
        tag BLOB NOT NULL,
        updated_at TEXT NOT NULL
      );
      CREATE TABLE provider_accounts (
        account_id TEXT PRIMARY KEY,
        provider_kind TEXT NOT NULL,
        display_name TEXT NOT NULL,
        base_url TEXT NOT NULL,
        credential_ref TEXT,
        has_credential INTEGER NOT NULL,
        headers TEXT NOT NULL,
        is_local INTEGER NOT NULL,
        privacy TEXT NOT NULL,
        enabled INTEGER NOT NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );
      CREATE TABLE models (
        model_id TEXT PRIMARY KEY,
        account_id TEXT NOT NULL,
        provider_model_id TEXT NOT NULL,
        display_name TEXT NOT NULL,
        capabilities TEXT NOT NULL,
        pricing TEXT NOT NULL,
        metadata_source TEXT NOT NULL,
        metadata_updated_at TEXT NOT NULL,
        enabled INTEGER NOT NULL,
        tags TEXT NOT NULL,
        work_types TEXT NOT NULL,
        roles TEXT NOT NULL
      );
      CREATE INDEX models_account_id_idx ON models(account_id);
      CREATE TABLE model_pools (
        pool_id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        scope TEXT NOT NULL,
        project_id TEXT,
        target TEXT,
        model_ids TEXT NOT NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );
      CREATE INDEX model_pools_scope_project_idx ON model_pools(scope, project_id);
      CREATE TABLE route_decisions (
        decision_id TEXT PRIMARY KEY,
        decision TEXT NOT NULL,
        project_id TEXT,
        agent_role TEXT,
        task_type TEXT NOT NULL,
        engine TEXT,
        model_id TEXT NOT NULL,
        explored INTEGER NOT NULL,
        decided_at TEXT NOT NULL
      );
      CREATE INDEX route_decisions_context_idx ON route_decisions(project_id, task_type, decided_at);
      CREATE INDEX route_decisions_model_id_idx ON route_decisions(model_id);
      CREATE TABLE route_outcomes (
        decision_id TEXT PRIMARY KEY REFERENCES route_decisions(decision_id),
        success INTEGER NOT NULL,
        quality_score REAL,
        source TEXT NOT NULL,
        cost_usd REAL NOT NULL,
        latency_ms INTEGER NOT NULL,
        input_tokens INTEGER NOT NULL,
        output_tokens INTEGER NOT NULL,
        note TEXT,
        recorded_at TEXT NOT NULL
      );
      CREATE TABLE exploration_spend (
        day TEXT PRIMARY KEY,
        cost_usd REAL NOT NULL
      );
    `,
  },
  {
    id: 4,
    name: 'create skills registry and Project trust',
    up: `
      ALTER TABLE projects_registry ADD COLUMN trusted INTEGER NOT NULL DEFAULT 0;
      CREATE TABLE installed_skills (
        name TEXT PRIMARY KEY,
        source TEXT NOT NULL,
        resolved_ref TEXT,
        version TEXT,
        hash TEXT NOT NULL,
        previous_hash TEXT,
        license TEXT,
        compatibility TEXT,
        description TEXT NOT NULL,
        metadata TEXT NOT NULL,
        installed_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );
    `,
  },
  {
    id: 5,
    name: 'create MCP connection and usage tables',
    up: `
      CREATE TABLE mcp_connections (
        connection_id TEXT PRIMARY KEY,
        name TEXT NOT NULL UNIQUE,
        scope TEXT NOT NULL,
        project_id TEXT,
        config TEXT NOT NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );
      CREATE INDEX mcp_connections_scope_project_idx ON mcp_connections(scope, project_id);
      CREATE TABLE mcp_usage (
        usage_id TEXT PRIMARY KEY,
        connection_id TEXT NOT NULL,
        task_id TEXT,
        decision_id TEXT,
        model_id TEXT,
        cost_usd REAL NOT NULL,
        recorded_at TEXT NOT NULL
      );
      CREATE INDEX mcp_usage_connection_time_idx ON mcp_usage(connection_id, recorded_at);
      CREATE TABLE mcp_tool_overrides (
        connection_id TEXT NOT NULL,
        tool_name TEXT NOT NULL,
        side_effects TEXT,
        execution_mode TEXT,
        updated_at TEXT NOT NULL,
        PRIMARY KEY (connection_id, tool_name)
      );
    `,
  },
  {
    id: 6,
    name: 'create plugin registry and host audit tables',
    up: `
      CREATE TABLE installed_plugins (
        plugin_id TEXT PRIMARY KEY,
        version TEXT NOT NULL,
        manifest TEXT NOT NULL,
        install_path TEXT NOT NULL UNIQUE,
        source_kind TEXT NOT NULL,
        source_ref TEXT NOT NULL,
        sha256 TEXT NOT NULL,
        signature TEXT NOT NULL,
        installed_at TEXT NOT NULL,
        enabled INTEGER NOT NULL,
        trust TEXT
      );
      CREATE TABLE plugin_project_enablement (
        project_id TEXT NOT NULL,
        plugin_id TEXT NOT NULL,
        enabled INTEGER NOT NULL,
        PRIMARY KEY (project_id, plugin_id)
      );
      CREATE INDEX plugin_project_enablement_project_idx ON plugin_project_enablement(project_id);
      CREATE TABLE plugin_usage (
        usage_id TEXT PRIMARY KEY,
        plugin_id TEXT NOT NULL,
        project_id TEXT,
        task_id TEXT,
        decision_id TEXT,
        model_id TEXT,
        cost_usd REAL NOT NULL,
        recorded_at TEXT NOT NULL
      );
      CREATE INDEX plugin_usage_plugin_time_idx ON plugin_usage(plugin_id, recorded_at);
      CREATE TABLE plugin_host_calls (
        call_id TEXT PRIMARY KEY,
        plugin_id TEXT NOT NULL,
        project_id TEXT,
        task_id TEXT,
        method TEXT NOT NULL,
        capability TEXT,
        tool_id TEXT,
        input TEXT,
        status TEXT NOT NULL,
        error_code INTEGER,
        started_at TEXT NOT NULL,
        finished_at TEXT
      );
      CREATE INDEX plugin_host_calls_plugin_time_idx ON plugin_host_calls(plugin_id, started_at);
    `,
  },
  {
    id: 7,
    name: 'create engine installation registry',
    up: `
      CREATE TABLE engine_installations (
        installation_id TEXT PRIMARY KEY,
        family TEXT NOT NULL,
        version TEXT,
        executable TEXT NOT NULL,
        kind TEXT NOT NULL,
        source TEXT NOT NULL,
        detected_at TEXT NOT NULL
      );
      CREATE INDEX engine_installations_family_idx ON engine_installations(family, source);
    `,
  },
  {
    id: 8,
    name: 'create asset provider account registry',
    up: `
      CREATE TABLE asset_provider_accounts (
        account_id TEXT PRIMARY KEY,
        provider_kind TEXT NOT NULL,
        enabled INTEGER NOT NULL,
        account_json TEXT NOT NULL
      );
      CREATE INDEX asset_provider_accounts_kind_enabled_idx
        ON asset_provider_accounts(provider_kind, enabled);
    `,
  },
  {
    id: 9,
    name: 'create backup registry and run tables',
    up: `
      CREATE TABLE backup_identities (
        identity_id TEXT PRIMARY KEY,
        label TEXT NOT NULL,
        created_at TEXT NOT NULL,
        identity_json TEXT NOT NULL
      );
      CREATE TABLE backup_destinations (
        destination_id TEXT PRIMARY KEY,
        kind TEXT NOT NULL,
        display_name TEXT NOT NULL,
        enabled INTEGER NOT NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        destination_json TEXT NOT NULL
      );
      CREATE INDEX backup_destinations_kind_enabled_idx
        ON backup_destinations(kind, enabled);
      CREATE TABLE backup_plans (
        plan_id TEXT PRIMARY KEY,
        scope TEXT NOT NULL,
        project_id TEXT,
        destination_id TEXT NOT NULL,
        identity_id TEXT NOT NULL,
        enabled INTEGER NOT NULL,
        updated_at TEXT NOT NULL,
        plan_json TEXT NOT NULL
      );
      CREATE INDEX backup_plans_scope_project_idx
        ON backup_plans(scope, project_id, enabled);
      CREATE INDEX backup_plans_destination_idx ON backup_plans(destination_id);
      CREATE INDEX backup_plans_identity_idx ON backup_plans(identity_id);
      CREATE TABLE backup_runs (
        run_id TEXT PRIMARY KEY,
        plan_id TEXT,
        scope TEXT NOT NULL,
        project_id TEXT,
        destination_id TEXT NOT NULL,
        status TEXT NOT NULL,
        started_at TEXT NOT NULL,
        run_json TEXT NOT NULL
      );
      CREATE INDEX backup_runs_status_started_idx ON backup_runs(status, started_at DESC);
      CREATE INDEX backup_runs_project_started_idx ON backup_runs(project_id, started_at DESC);
      CREATE INDEX backup_runs_plan_started_idx ON backup_runs(plan_id, started_at DESC);
    `,
  },
  {
    id: 10,
    name: 'create DCC installation registry',
    up: `
      CREATE TABLE dcc_installations (
        installation_id TEXT PRIMARY KEY,
        tool TEXT NOT NULL,
        executable TEXT NOT NULL,
        kind TEXT NOT NULL,
        host_os TEXT NOT NULL,
        via_wsl_interop INTEGER NOT NULL,
        version TEXT,
        source TEXT NOT NULL,
        detected_at TEXT NOT NULL,
        installation_json TEXT NOT NULL
      );
      CREATE INDEX dcc_installations_tool_source_idx ON dcc_installations(tool, source);
    `,
  },
  {
    id: 11,
    name: 'create stable update state store',
    up: `
      CREATE TABLE update_states (
        channel TEXT PRIMARY KEY,
        state_json TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );
    `,
  },
  {
    id: 12,
    name: 'preserve model usage cost confidence and cache tokens',
    up: `
      ALTER TABLE route_outcomes ADD COLUMN cost_status TEXT;
      ALTER TABLE route_outcomes ADD COLUMN cache_read_input_tokens INTEGER NOT NULL DEFAULT 0;
      ALTER TABLE route_outcomes ADD COLUMN cache_creation_input_tokens INTEGER NOT NULL DEFAULT 0;
    `,
  },
  {
    id: 13,
    name: 'create model completion usage ledger',
    up: `
      CREATE TABLE model_usage (
        usage_id TEXT PRIMARY KEY,
        request_id TEXT,
        project_id TEXT,
        task_id TEXT,
        decision_id TEXT,
        model_id TEXT NOT NULL,
        occurred_at TEXT NOT NULL,
        input_tokens INTEGER NOT NULL,
        output_tokens INTEGER NOT NULL,
        cache_read_input_tokens INTEGER NOT NULL,
        cache_creation_input_tokens INTEGER NOT NULL,
        cost_usd REAL NOT NULL,
        cost_status TEXT NOT NULL
      );
      CREATE INDEX model_usage_project_time_idx ON model_usage(project_id, occurred_at DESC);
      CREATE INDEX model_usage_task_time_idx ON model_usage(task_id, occurred_at DESC);
    `,
  },
  {
    id: 14,
    name: 'preserve cost confidence for plugin and MCP model usage',
    up: `
      ALTER TABLE plugin_usage ADD COLUMN cost_status TEXT;
      ALTER TABLE mcp_usage ADD COLUMN cost_status TEXT;
    `,
  },
];

import type { Migration } from '../db/migrator';

export const projectMigrations: Migration[] = [
  {
    id: 1,
    name: 'create project operational tables',
    up: `
      CREATE TABLE project_meta (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL
      );
      CREATE TABLE events (
        event_id TEXT PRIMARY KEY,
        seq INTEGER NOT NULL UNIQUE,
        kind TEXT NOT NULL,
        occurred_at TEXT NOT NULL,
        actor TEXT NOT NULL,
        payload TEXT NOT NULL
      );
      CREATE TABLE settings_overrides (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );
    `,
  },
  {
    id: 2,
    name: 'create task and question tables',
    up: `
      ALTER TABLE events ADD COLUMN task_id TEXT;
      CREATE INDEX events_task_id_idx ON events(task_id);
      CREATE TABLE tasks (
        task_id TEXT PRIMARY KEY,
        schema_version INTEGER NOT NULL,
        project_id TEXT NOT NULL,
        parent_task_id TEXT,
        root_task_id TEXT NOT NULL,
        depth INTEGER NOT NULL,
        kind TEXT NOT NULL,
        title TEXT NOT NULL,
        goal TEXT NOT NULL,
        goal_hash TEXT NOT NULL,
        state TEXT NOT NULL,
        priority INTEGER NOT NULL DEFAULT 50,
        depends_on TEXT NOT NULL,
        assignee TEXT,
        budget TEXT NOT NULL,
        spent TEXT NOT NULL,
        attempt INTEGER NOT NULL,
        max_attempts INTEGER NOT NULL,
        lease TEXT,
        input TEXT NOT NULL,
        checkpoint TEXT NOT NULL,
        result TEXT,
        error TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        started_at TEXT,
        finished_at TEXT
      );
      CREATE INDEX tasks_goal_hash_idx ON tasks(goal_hash);
      CREATE INDEX tasks_state_idx ON tasks(state);
      CREATE INDEX tasks_parent_task_id_idx ON tasks(parent_task_id);
      CREATE INDEX tasks_root_task_id_idx ON tasks(root_task_id);
      CREATE TABLE task_questions (
        question_id TEXT PRIMARY KEY,
        task_id TEXT NOT NULL,
        prompt TEXT NOT NULL,
        options TEXT,
        asked_at TEXT NOT NULL,
        answer TEXT NOT NULL,
        answered_at TEXT
      );
      CREATE INDEX task_questions_task_id_idx ON task_questions(task_id);
      CREATE INDEX task_questions_answered_at_idx ON task_questions(answered_at);
    `,
  },
  {
    id: 3,
    name: 'create tool broker tables',
    up: `
      CREATE TABLE tool_calls (
        call_id TEXT PRIMARY KEY,
        project_id TEXT NOT NULL,
        task_id TEXT,
        agent_id TEXT,
        tool_id TEXT NOT NULL,
        input TEXT NOT NULL,
        access_mode TEXT NOT NULL,
        decision TEXT NOT NULL,
        decision_reason TEXT NOT NULL,
        status TEXT NOT NULL,
        output TEXT NOT NULL,
        error TEXT,
        evidence TEXT NOT NULL,
        cost_usd REAL NOT NULL,
        started_at TEXT NOT NULL,
        finished_at TEXT
      );
      CREATE INDEX tool_calls_task_id_idx ON tool_calls(task_id);
      CREATE INDEX tool_calls_tool_id_idx ON tool_calls(tool_id);
      CREATE INDEX tool_calls_status_idx ON tool_calls(status);
      CREATE TABLE approvals (
        approval_id TEXT PRIMARY KEY,
        project_id TEXT NOT NULL,
        call_id TEXT NOT NULL,
        tool_id TEXT NOT NULL,
        side_effects TEXT NOT NULL,
        summary TEXT NOT NULL,
        input TEXT NOT NULL,
        requested_at TEXT NOT NULL,
        resolved_at TEXT,
        approved INTEGER,
        reason TEXT
      );
      CREATE INDEX approvals_project_pending_idx ON approvals(project_id, resolved_at);
    `,
  },
  {
    id: 4,
    name: 'create skill enablement and activation tables',
    up: `
      CREATE TABLE skill_enablement (
        name TEXT PRIMARY KEY,
        enabled INTEGER NOT NULL,
        pinned_version TEXT,
        pinned_hash TEXT,
        roles TEXT,
        work_types TEXT
      );
      CREATE TABLE skill_activations (
        activation_id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        version TEXT,
        hash TEXT NOT NULL,
        task_id TEXT,
        agent_id TEXT,
        model_id TEXT,
        activated_at TEXT NOT NULL
      );
      CREATE INDEX skill_activations_name_task_idx ON skill_activations(name, task_id);
      CREATE INDEX skill_activations_task_idx ON skill_activations(task_id);
    `,
  },
  {
    id: 5,
    name: 'create discussion board and maintenance tables',
    up: `
      CREATE TABLE board_threads (
        thread_id TEXT PRIMARY KEY,
        schema_version INTEGER NOT NULL,
        project_id TEXT NOT NULL,
        title TEXT NOT NULL,
        kind TEXT NOT NULL,
        status TEXT NOT NULL,
        tags TEXT NOT NULL,
        links TEXT NOT NULL,
        created_by TEXT NOT NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        last_message_at TEXT NOT NULL,
        message_count INTEGER NOT NULL,
        summary TEXT,
        summary_updated_at TEXT,
        archived_at TEXT
      );
      CREATE INDEX board_threads_project_status_idx ON board_threads(project_id, status, last_message_at);
      CREATE TABLE board_messages (
        message_id TEXT PRIMARY KEY,
        schema_version INTEGER NOT NULL,
        thread_id TEXT NOT NULL REFERENCES board_threads(thread_id) ON DELETE CASCADE,
        project_id TEXT NOT NULL,
        seq INTEGER NOT NULL,
        type TEXT NOT NULL,
        body TEXT NOT NULL,
        author TEXT NOT NULL,
        links TEXT NOT NULL,
        reply_to TEXT,
        created_at TEXT NOT NULL,
        superseded_by TEXT,
        edit_history TEXT NOT NULL,
        thread_title TEXT NOT NULL,
        UNIQUE(thread_id, seq),
        FOREIGN KEY(reply_to) REFERENCES board_messages(message_id)
      );
      CREATE INDEX board_messages_project_thread_seq_idx ON board_messages(project_id, thread_id, seq);
      CREATE VIRTUAL TABLE board_messages_fts USING fts5(
        body,
        thread_title,
        content='board_messages',
        content_rowid='rowid'
      );
      CREATE TRIGGER board_messages_fts_insert AFTER INSERT ON board_messages BEGIN
        INSERT INTO board_messages_fts(rowid, body, thread_title)
        VALUES (new.rowid, new.body, new.thread_title);
      END;
      CREATE TRIGGER board_messages_fts_delete AFTER DELETE ON board_messages BEGIN
        INSERT INTO board_messages_fts(board_messages_fts, rowid, body, thread_title)
        VALUES ('delete', old.rowid, old.body, old.thread_title);
      END;
      CREATE TRIGGER board_messages_fts_update AFTER UPDATE OF body, thread_title ON board_messages BEGIN
        INSERT INTO board_messages_fts(board_messages_fts, rowid, body, thread_title)
        VALUES ('delete', old.rowid, old.body, old.thread_title);
        INSERT INTO board_messages_fts(rowid, body, thread_title)
        VALUES (new.rowid, new.body, new.thread_title);
      END;
      CREATE TABLE board_decisions (
        decision_id TEXT PRIMARY KEY,
        schema_version INTEGER NOT NULL,
        project_id TEXT NOT NULL,
        thread_id TEXT NOT NULL REFERENCES board_threads(thread_id) ON DELETE CASCADE,
        message_id TEXT NOT NULL UNIQUE REFERENCES board_messages(message_id) ON DELETE CASCADE,
        title TEXT NOT NULL,
        statement TEXT NOT NULL,
        rationale TEXT,
        made_by TEXT NOT NULL,
        bound_at TEXT NOT NULL,
        supersedes TEXT,
        sync_status TEXT NOT NULL,
        sync_attempts INTEGER NOT NULL,
        last_sync_error TEXT,
        synced_at TEXT,
        canon_record_path TEXT,
        canon_commit TEXT
      );
      CREATE INDEX board_decisions_project_status_idx ON board_decisions(project_id, sync_status);
      CREATE TABLE board_subscriptions (
        subscription_id TEXT PRIMARY KEY,
        project_id TEXT NOT NULL,
        subscriber TEXT NOT NULL,
        filter TEXT NOT NULL,
        created_at TEXT NOT NULL
      );
      CREATE INDEX board_subscriptions_project_idx ON board_subscriptions(project_id);
      CREATE TABLE canon_sync_proposals (
        proposal_id TEXT PRIMARY KEY,
        decision_id TEXT NOT NULL REFERENCES board_decisions(decision_id) ON DELETE CASCADE,
        project_id TEXT NOT NULL,
        path TEXT NOT NULL,
        before_content TEXT,
        after_content TEXT NOT NULL,
        diff TEXT NOT NULL,
        created_at TEXT NOT NULL,
        applied_at TEXT,
        commit_sha TEXT
      );
      CREATE INDEX canon_sync_proposals_decision_idx ON canon_sync_proposals(decision_id, created_at);
      CREATE TABLE board_maintenance_state (
        project_id TEXT PRIMARY KEY,
        last_audit_at TEXT,
        last_cleanup_at TEXT,
        next_audit_at TEXT,
        running_task_id TEXT
      );
    `,
  },
  {
    id: 6,
    name: 'create engine connector tables',
    up: `
      CREATE TABLE engine_runs (
        run_id TEXT PRIMARY KEY,
        project_id TEXT NOT NULL,
        family TEXT NOT NULL,
        operation TEXT NOT NULL,
        status TEXT NOT NULL,
        started_at TEXT NOT NULL,
        run_json TEXT NOT NULL
      );
      CREATE INDEX engine_runs_project_started_idx ON engine_runs(project_id, started_at DESC);
      CREATE TABLE engine_capability_reports (
        project_id TEXT PRIMARY KEY,
        report_json TEXT NOT NULL,
        generated_at TEXT NOT NULL
      );
      CREATE TABLE engine_live_bridges (
        project_id TEXT PRIMARY KEY,
        connection_id TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );
    `,
  },
  {
    id: 7,
    name: 'create Project knowledge index tables',
    up: `
      CREATE TABLE canon_records (
        path TEXT PRIMARY KEY,
        record_id TEXT NOT NULL,
        record_type TEXT NOT NULL,
        status TEXT NOT NULL,
        module TEXT,
        active INTEGER NOT NULL,
        revision TEXT NOT NULL,
        record_json TEXT NOT NULL,
        body TEXT NOT NULL,
        indexed_at TEXT NOT NULL
      );
      CREATE INDEX canon_records_id_idx ON canon_records(record_id);
      CREATE INDEX canon_records_filter_idx ON canon_records(record_type, status, active, module);
      CREATE TABLE canon_references (
        source_record_id TEXT NOT NULL,
        source_path TEXT NOT NULL,
        rel TEXT NOT NULL,
        target_record_id TEXT NOT NULL,
        confidence REAL NOT NULL,
        source TEXT NOT NULL,
        PRIMARY KEY(source_path, rel, target_record_id)
      );
      CREATE INDEX canon_references_target_idx ON canon_references(target_record_id);
      CREATE TABLE knowledge_chunks (
        chunk_id TEXT PRIMARY KEY,
        project_id TEXT NOT NULL,
        source TEXT NOT NULL,
        path TEXT NOT NULL,
        record_id TEXT,
        record_type TEXT,
        record_title TEXT,
        record_status TEXT,
        active INTEGER NOT NULL,
        revision TEXT NOT NULL,
        start_line INTEGER NOT NULL,
        end_line INTEGER NOT NULL,
        text TEXT NOT NULL,
        tokens_estimate INTEGER NOT NULL
      );
      CREATE INDEX knowledge_chunks_path_idx ON knowledge_chunks(path);
      CREATE INDEX knowledge_chunks_filter_idx ON knowledge_chunks(source, record_type, record_status, active);
      CREATE VIRTUAL TABLE knowledge_chunks_fts USING fts5(
        text,
        content='knowledge_chunks',
        content_rowid='rowid',
        tokenize='porter unicode61'
      );
      CREATE TRIGGER knowledge_chunks_fts_insert AFTER INSERT ON knowledge_chunks BEGIN
        INSERT INTO knowledge_chunks_fts(rowid, text) VALUES (new.rowid, new.text);
      END;
      CREATE TRIGGER knowledge_chunks_fts_delete AFTER DELETE ON knowledge_chunks BEGIN
        INSERT INTO knowledge_chunks_fts(knowledge_chunks_fts, rowid, text)
        VALUES ('delete', old.rowid, old.text);
      END;
      CREATE TRIGGER knowledge_chunks_fts_update AFTER UPDATE OF text ON knowledge_chunks BEGIN
        INSERT INTO knowledge_chunks_fts(knowledge_chunks_fts, rowid, text)
        VALUES ('delete', old.rowid, old.text);
        INSERT INTO knowledge_chunks_fts(rowid, text) VALUES (new.rowid, new.text);
      END;
      CREATE TABLE knowledge_index_state (
        path TEXT PRIMARY KEY,
        source TEXT NOT NULL,
        revision TEXT NOT NULL,
        content_hash TEXT NOT NULL,
        mtime_ms INTEGER NOT NULL,
        size INTEGER NOT NULL,
        chunk_count INTEGER NOT NULL,
        indexed_at TEXT NOT NULL
      );
      CREATE TABLE knowledge_index_meta (
        project_id TEXT PRIMARY KEY,
        last_full_reconcile_at TEXT,
        last_incremental_at TEXT,
        degraded TEXT
      );
      CREATE TABLE embedding_profiles (
        profile_id TEXT PRIMARY KEY,
        project_id TEXT NOT NULL,
        model_id TEXT NOT NULL,
        provider_account_id TEXT NOT NULL,
        dimensions INTEGER NOT NULL,
        version INTEGER NOT NULL,
        created_at TEXT NOT NULL,
        active INTEGER NOT NULL
      );
      CREATE UNIQUE INDEX embedding_profiles_active_project_idx
        ON embedding_profiles(project_id) WHERE active = 1;
      CREATE TABLE knowledge_vectors (
        chunk_id TEXT NOT NULL,
        project_id TEXT NOT NULL,
        profile_version INTEGER NOT NULL,
        point_id TEXT NOT NULL,
        collection TEXT NOT NULL,
        created_at TEXT NOT NULL,
        PRIMARY KEY(chunk_id, profile_version)
      );
      CREATE INDEX knowledge_vectors_project_profile_idx
        ON knowledge_vectors(project_id, profile_version);
      CREATE TABLE knowledge_conflicts (
        record_id TEXT PRIMARY KEY,
        paths_json TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );
    `,
  },
  {
    id: 8,
    name: 'create asset jobs and preview cache',
    up: `
      CREATE TABLE asset_jobs (
        job_id TEXT PRIMARY KEY,
        project_id TEXT NOT NULL,
        status TEXT NOT NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        job_json TEXT NOT NULL
      );
      CREATE INDEX asset_jobs_project_created_idx ON asset_jobs(project_id, created_at DESC);
      CREATE INDEX asset_jobs_project_status_idx ON asset_jobs(project_id, status, created_at DESC);
      CREATE TABLE asset_previews (
        source_path TEXT PRIMARY KEY,
        source_sha256 TEXT NOT NULL,
        preview_json TEXT NOT NULL,
        created_at TEXT NOT NULL
      );
      CREATE INDEX asset_previews_created_idx ON asset_previews(created_at);
    `,
  },
  {
    id: 9,
    name: 'create DCC capability and run tables',
    up: `
      CREATE TABLE dcc_capability_reports (
        project_id TEXT NOT NULL,
        tool TEXT NOT NULL,
        generated_at TEXT NOT NULL,
        report_json TEXT NOT NULL,
        PRIMARY KEY(project_id, tool)
      );
      CREATE TABLE dcc_runs (
        run_id TEXT PRIMARY KEY,
        project_id TEXT NOT NULL,
        tool TEXT NOT NULL,
        operation TEXT NOT NULL,
        status TEXT NOT NULL,
        started_at TEXT NOT NULL,
        run_json TEXT NOT NULL
      );
      CREATE INDEX dcc_runs_project_tool_started_idx ON dcc_runs(project_id, tool, started_at DESC);
      CREATE INDEX dcc_runs_status_started_idx ON dcc_runs(status, started_at DESC);
    `,
  },
  {
    id: 10,
    name: 'add task coordination metadata',
    up: `
      ALTER TABLE tasks ADD COLUMN touches_json TEXT;
      ALTER TABLE tasks ADD COLUMN role TEXT;
      ALTER TABLE tasks ADD COLUMN isolation TEXT;
      ALTER TABLE tasks ADD COLUMN completion_contract_json TEXT;
      ALTER TABLE tasks ADD COLUMN integration_json TEXT;
    `,
  },
  {
    id: 11,
    name: 'create change graph, lock, integration, and request tables',
    up: `
      CREATE TABLE change_nodes (
        project_id TEXT NOT NULL,
        node_id TEXT NOT NULL,
        kind TEXT NOT NULL,
        ref TEXT NOT NULL,
        title TEXT NOT NULL,
        last_seen_at TEXT NOT NULL,
        PRIMARY KEY(project_id, node_id)
      );
      CREATE INDEX change_nodes_project_kind_idx ON change_nodes(project_id, kind);
      CREATE TABLE change_edges (
        edge_id TEXT PRIMARY KEY,
        project_id TEXT NOT NULL,
        from_node TEXT NOT NULL,
        to_node TEXT NOT NULL,
        rel TEXT NOT NULL,
        confidence REAL NOT NULL,
        source TEXT NOT NULL,
        evidence TEXT,
        created_at TEXT NOT NULL,
        UNIQUE(project_id, from_node, to_node, rel, source)
      );
      CREATE INDEX change_edges_project_from_idx ON change_edges(project_id, from_node);
      CREATE INDEX change_edges_project_to_idx ON change_edges(project_id, to_node);
      CREATE TABLE resource_locks (
        lock_id TEXT PRIMARY KEY,
        project_id TEXT NOT NULL,
        resource TEXT NOT NULL,
        mode TEXT NOT NULL,
        task_id TEXT NOT NULL,
        worker_id TEXT,
        acquired_at TEXT NOT NULL,
        expires_at TEXT NOT NULL,
        renewed_at TEXT NOT NULL,
        UNIQUE(project_id, resource, task_id)
      );
      CREATE INDEX resource_locks_project_resource_idx ON resource_locks(project_id, resource, expires_at);
      CREATE INDEX resource_locks_project_task_idx ON resource_locks(project_id, task_id);
      CREATE TABLE integrations (
        integration_id TEXT PRIMARY KEY,
        project_id TEXT NOT NULL,
        task_id TEXT NOT NULL,
        status TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        integration_json TEXT NOT NULL,
        UNIQUE(project_id, task_id)
      );
      CREATE INDEX integrations_project_status_idx ON integrations(project_id, status, updated_at DESC);
      CREATE TABLE change_requests (
        request_id TEXT PRIMARY KEY,
        project_id TEXT NOT NULL,
        root_task_id TEXT NOT NULL,
        created_at TEXT NOT NULL,
        request_json TEXT NOT NULL
      );
      CREATE INDEX change_requests_project_created_idx ON change_requests(project_id, created_at DESC);
    `,
  },
  {
    id: 12,
    name: 'create persistent chat conversations',
    up: `
      CREATE TABLE chat_conversations (
        conversation_id TEXT PRIMARY KEY,
        project_id TEXT NOT NULL,
        title TEXT NOT NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );
      CREATE INDEX chat_conversations_updated_idx
        ON chat_conversations(updated_at DESC);
      CREATE TABLE chat_messages (
        message_id TEXT PRIMARY KEY,
        conversation_id TEXT NOT NULL REFERENCES chat_conversations(conversation_id) ON DELETE CASCADE,
        project_id TEXT NOT NULL,
        created_at TEXT NOT NULL,
        message_json TEXT NOT NULL
      );
      CREATE INDEX chat_messages_conversation_created_idx
        ON chat_messages(conversation_id, created_at);
    `,
  },
  {
    id: 13,
    name: 'record tool-call cost confidence',
    up: `
      ALTER TABLE tool_calls ADD COLUMN cost_status TEXT;
    `,
  },
];

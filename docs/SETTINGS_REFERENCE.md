# PlayWeld settings reference

**Last updated:** 2026-10-02

**Source:** Generated builtin settings from [definitions.ts](../packages/platform-service/src/settings/definitions.ts). Plugin contributions extend this catalog at runtime. Full value schemas are in [settings-schemas.json](reference/settings-schemas.json).

Resolve settings through `settings/getAll` or `settings/get`; write through `settings/set`. Session overrides take precedence over Project overrides, platform values, and builtin defaults where those scopes are supported. The UI shows the effective value and origin. Reset removes an override rather than replacing a builtin default.

Path defaults below use `<home>` for the running user's home directory. Scope restrictions, JSON value types, and schema constraints apply. Access ceilings can further restrict a tool independently of the selected setting.

## General & background behaviour

General settings for the Control Room and background service.

| Key                    | Default      | Scopes   | Purpose                                                                             |
| ---------------------- | ------------ | -------- | ----------------------------------------------------------------------------------- |
| `window.closeBehavior` | `"continue"` | platform | Choose whether closing the window leaves work running or stops after checkpointing. |

## Projects, genres & modules

Project creation and organization defaults.

| Key                               | Default                        | Scopes   | Purpose                                        |
| --------------------------------- | ------------------------------ | -------- | ---------------------------------------------- |
| `projects.defaultParentDirectory` | `"<home>/GameCrafterProjects"` | platform | Default directory used when creating Projects. |

## Agents, swarms & skills

Agent delegation and skill behavior.

| Key                                | Default | Scopes            | Purpose                                                                            |
| ---------------------------------- | ------- | ----------------- | ---------------------------------------------------------------------------------- |
| `agents.maxSpawnDepth`             | `4`     | platform, project | Maximum number of nested agent delegation levels.                                  |
| `agents.maxConcurrentPerProject`   | `8`     | platform, project | Maximum number of agents that can work concurrently on one Project.                |
| `skills.catalog.maxEntries`        | `40`    | platform, project | Maximum number of eligible skills shown before search is needed.                   |
| `skills.compatibilityScan.enabled` | `true`  | platform, project | Offer skills discovered in compatible agent-tool directories for trusted Projects. |

## Model providers & routing

Model selection and task budgets.

| Key                                  | Default           | Scopes                     | Purpose                                                                    |
| ------------------------------------ | ----------------- | -------------------------- | -------------------------------------------------------------------------- |
| `models.autoRouting.quality`         | `"quality-first"` | platform, project, session | Select the quality, balance, or cost priority for automatic model routing. |
| `models.autoRouting.maxLatencyMs`    | `0`               | platform, project, session | Set zero for no maximum latency constraint.                                |
| `models.exploration.rate`            | `0.1`             | platform, project          | Probability of exploring a less-observed eligible model.                   |
| `models.exploration.budgetUsdPerDay` | `1`               | platform, project          | Maximum daily spend on exploration picks.                                  |
| `models.budget.maxCostPerTaskUsd`    | `5`               | platform, project, session | Maximum model spend allowed for a single task.                             |

## Engine, asset & tool connections

Connections to game engines, asset services, and tools.

| Key                           | Default | Scopes            | Purpose                                                             |
| ----------------------------- | ------- | ----------------- | ------------------------------------------------------------------- |
| `mcp.autoConnect`             | `true`  | platform, project | Automatically connect enabled platform and Project MCP connections. |
| `mcp.reconnectBackoffSeconds` | `10`    | platform          | Delay before retrying a disconnected MCP connection.                |

## Access & security

Access controls and security policies.

| Key                                       | Default                                       | Scopes                     | Purpose                                                              |
| ----------------------------------------- | --------------------------------------------- | -------------------------- | -------------------------------------------------------------------- |
| `access.mode`                             | `"ask-always"`                                | platform, project, session | Controls how tool operations are authorized.                         |
| `access.restricted.allowedSideEffects`    | `["none","internal-write","workspace-write"]` | platform, project          | Side-effect categories permitted without an explicit tool allowlist. |
| `access.restricted.allowedTools`          | `[]`                                          | platform, project          | Tool ID globs permitted while access is restricted.                  |
| `access.askAlways.approvalTimeoutMinutes` | `30`                                          | platform, project, session | How long approval requests remain pending.                           |

## Discussion board

Discussion board behavior and maintenance routed through the board-maintainer model pool.

| Key                            | Default | Scopes            | Purpose                                                                                   |
| ------------------------------ | ------- | ----------------- | ----------------------------------------------------------------------------------------- |
| `board.auditIntervalMinutes`   | `240`   | platform, project | Interval for the board-maintainer model pool to audit open threads and decisions.         |
| `board.archiveAfterDays`       | `30`    | platform, project | Age after which resolved threads are summarized and archived with their history retained. |
| `board.auditMinMessages`       | `5`     | platform, project | Only open threads with at least this many messages are sent for maintenance audit.        |
| `board.maxSyncAttempts`        | `5`     | platform, project | Maximum automatic retries for a binding decision canon synchronization.                   |
| `board.allowPermanentDeletion` | `false` | platform, project | Allow permanent thread deletion; otherwise board history may only be archived.            |
| `board.maintenanceEnabled`     | `true`  | platform, project | Enable scheduled board-maintainer audits and archive cleanup.                             |

## Plugins & updates

Platform plugin installation and update behavior.

| Key                                   | Default | Scopes            | Purpose                                                                           |
| ------------------------------------- | ------- | ----------------- | --------------------------------------------------------------------------------- |
| `skills.installLimits.archiveMiB`     | `10`    | platform          | Maximum compressed archive size accepted by the skill installer.                  |
| `skills.installLimits.extractedMiB`   | `25`    | platform          | Maximum total extracted size accepted by the skill installer.                     |
| `skills.installLimits.maxFiles`       | `1000`  | platform          | Maximum number of files extracted by the skill installer.                         |
| `plugins.allowUnisolatedInFullAccess` | `false` | platform          | Permit plugin workers without OS isolation only for Projects in Full access mode. |
| `plugins.maxRestarts`                 | `3`     | platform          | Maximum automatic restart attempts after a plugin worker crashes.                 |
| `plugins.workerIdleStopMinutes`       | `30`    | platform          | Idle duration before a plugin worker is stopped; zero disables idle stopping.     |
| `plugins.autoStart`                   | `true`  | platform, project | Start enabled plugin workers when a Project is opened.                            |

## Storage, search & backup

Search indexes, backup, and storage behavior.

| Key                         | Default | Scopes            | Purpose                                                            |
| --------------------------- | ------- | ----------------- | ------------------------------------------------------------------ |
| `search.vector.enabled`     | `false` | platform, project | Enable the configured vector-store adapter for semantic retrieval. |
| `backup.encryption.enabled` | `true`  | platform, project | Encrypted by default; disabling is not recommended.                |

## Logs & audit

Logging and audit retention.

| Key                  | Default | Scopes   | Purpose                                |
| -------------------- | ------- | -------- | -------------------------------------- |
| `logs.retentionDays` | `30`    | platform | Number of days to retain service logs. |

## Engine connectors

Engine detection, capability reporting, and operation behavior.

| Key                                 | Default | Scopes            | Purpose                                                                                             |
| ----------------------------------- | ------- | ----------------- | --------------------------------------------------------------------------------------------------- |
| `engine.operationTimeoutSeconds`    | `1800`  | platform, project | Maximum time an engine process may run before it is terminated.                                     |
| `engine.autoDetectInstallations`    | `true`  | platform          | Detect engine executables from environment paths and common installation directories.               |
| `engine.postVersionMismatchToBoard` | `true`  | project           | Post one finding to the Engine board thread when the detected version changes out of compatibility. |

## Knowledge & search

Canon records, indexing, semantic search, and retrieval behavior.

| Key                                      | Default                                                                                                                     | Scopes            | Purpose                                                                                                   |
| ---------------------------------------- | --------------------------------------------------------------------------------------------------------------------------- | ----------------- | --------------------------------------------------------------------------------------------------------- |
| `knowledge.vectorStore.kind`             | `"none"`                                                                                                                    | platform, project | Select lancedb, qdrant, a registered adapter ID, or none for lexical-only search.                         |
| `knowledge.vectorStore.deployment`       | `"external"`                                                                                                                | platform, project | LanceDB is embedded. Qdrant supports managed-local, existing local, remote, or legacy external endpoints. |
| `knowledge.vectorStore.allowRemote`      | `false`                                                                                                                     | platform, project | Allow embeddings and indexed source metadata to leave this machine. Remote endpoints require HTTPS.       |
| `knowledge.vectorStore.url`              | `"http://127.0.0.1:6333"`                                                                                                   | platform, project | Base URL for the Qdrant vector store.                                                                     |
| `knowledge.vectorStore.apiKeyRef`        | `""`                                                                                                                        | platform, project | Optional reference to an encrypted credential in the platform credential store.                           |
| `knowledge.vectorStore.collectionPrefix` | `"gamecrafter"`                                                                                                             | platform, project | Prefix used for Project-isolated Qdrant collections.                                                      |
| `knowledge.vectorStore.timeoutMs`        | `5000`                                                                                                                      | platform, project | Request timeout for the configured vector store.                                                          |
| `knowledge.embeddingBatchSize`           | `32`                                                                                                                        | platform, project | Number of new chunks embedded in one provider request.                                                    |
| `knowledge.reconcileIntervalMinutes`     | `60`                                                                                                                        | platform, project | Periodic full reconciliation interval for Project knowledge indexes.                                      |
| `knowledge.indexCode`                    | `true`                                                                                                                      | platform, project | Include allowlisted source files under game/ in the knowledge index.                                      |
| `knowledge.indexBoard`                   | `true`                                                                                                                      | platform, project | Include board threads and messages in the knowledge index.                                                |
| `knowledge.codeExtensions`               | `["cs","cpp","h","hpp","gd","tscn","tres","py","ts","js","json","ini","cfg","shader","hlsl","glsl","usf","ush","md","txt"]` | platform, project | Allowlisted text/source extensions indexed from game/. Binary assets are never indexed as content.        |

## Assets

External generation, asset imports, previews, and cache behavior.

| Key                          | Default                   | Scopes            | Purpose                                                               |
| ---------------------------- | ------------------------- | ----------------- | --------------------------------------------------------------------- |
| `assets.pollIntervalSeconds` | `5`                       | platform, project | Default delay between polling external asset generation jobs.         |
| `assets.maxDownloadMb`       | `200`                     | platform, project | Reject provider output downloads larger than this limit.              |
| `assets.importDirectory`     | `"game/assets/generated"` | platform, project | Project-relative destination directory for approved generated assets. |
| `assets.externalOpenCommand` | `""`                      | platform          | Optional executable used to open assets in an authoring tool.         |
| `assets.previewCacheMb`      | `500`                     | platform, project | Maximum disk space used by disposable asset preview derivatives.      |
| `assets.requestTimeoutMs`    | `30000`                   | platform, project | Timeout applied to external asset provider API requests.              |

## Backups

Encrypted Project and profile backup, verification, restore, and retention.

| Key                       | Default | Scopes            | Purpose                                                                                 |
| ------------------------- | ------- | ----------------- | --------------------------------------------------------------------------------------- |
| `backup.excludeGlobs`     | `[]`    | platform, project | Additional simple glob patterns excluded from Project backups.                          |
| `backup.includeAssetJobs` | `true`  | platform, project | Include downloaded provider artifacts under .gamecrafter/asset-jobs in Project backups. |
| `backup.compressionLevel` | `6`     | platform          | Gzip compression level used for backup archives.                                        |
| `backup.scryptLogN`       | `15`    | platform          | Scrypt logN used to protect recovery identities.                                        |
| `backup.drillAfterBackup` | `true`  | platform          | Decrypt and hash-check each new archive before retention runs.                          |
| `backup.stagingDirectory` | `""`    | platform          | Optional directory for encrypted archive staging; empty uses the profile cache.         |
| `backup.maxArchiveMb`     | `0`     | platform          | Zero means unlimited; otherwise fail before upload when the archive exceeds this size.  |

## DCC tools

DCC installation detection, scripted operations, and preview rendering.

| Key                            | Default | Scopes            | Purpose                                                                                |
| ------------------------------ | ------- | ----------------- | -------------------------------------------------------------------------------------- |
| `dcc.searchPaths`              | `[]`    | platform          | Additional directories to scan for DCC executables.                                    |
| `dcc.operationTimeoutSeconds`  | `600`   | platform, project | Maximum time a headless DCC operation may run before termination.                      |
| `dcc.autoDetectInstallations`  | `true`  | platform          | Detect DCC executables from PATH, common locations, and supported WSL interop paths.   |
| `dcc.allowUnrestrictedScripts` | `false` | platform          | Allow DCC run-script calls containing subprocess or destructive filesystem operations. |
| `dcc.renderPreviewResolution`  | `512`   | platform, project | Resolution in pixels for generated DCC preview renders.                                |

## Coordination

Change impact, agent execution, resource locks, and worktree integration.

| Key                                      | Default                    | Scopes            | Purpose                                                                                                                                                                                  |
| ---------------------------------------- | -------------------------- | ----------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `coordination.autoIntegrate`             | `"when-validated"`         | platform, project | Control whether validated, conflict-free worktree changes are integrated automatically.                                                                                                  |
| `coordination.lockTimeoutSeconds`        | `300`                      | platform, project | Time before an unrenewed resource lock expires.                                                                                                                                          |
| `coordination.worktreeDirectory`         | `".gamecrafter/worktrees"` | platform, project | Project-relative directory used for isolated task worktrees.                                                                                                                             |
| `coordination.impactConfidenceThreshold` | `0.7`                      | platform, project | Impact paths below this confidence need explicit validation.                                                                                                                             |
| `coordination.maxTranscriptTokens`       | `0`                        | platform, project | Zero uses selected-model capacity automatically. A positive value explicitly lowers the estimated input allowance, including messages and tool schemas; it cannot raise the model limit. |
| `coordination.defaultMaxTurns`           | `60`                       | platform, project | Default maximum model turns for roles without max-turns.                                                                                                                                 |

## Updates

Release checks, downloads, and user-controlled update installation.

| Key                          | Default                                                                  | Scopes   | Purpose                                                                                    |
| ---------------------------- | ------------------------------------------------------------------------ | -------- | ------------------------------------------------------------------------------------------ |
| `updates.checkOnStart`       | `false`                                                                  | platform | Check the stable release channel after the Control Room starts.                            |
| `updates.releasesUrl`        | `"https://api.github.com/repos/scarecr0w12/GameCrafter/releases/latest"` | platform | GitHub latest-release API URL or a direct gamecrafter-release.json URL.                    |
| `updates.autoDownload`       | `false`                                                                  | platform | Download a compatible release after checking; installation always remains user-controlled. |
| `updates.checkIntervalHours` | `24`                                                                     | platform | Interval between background stable-channel checks.                                         |
| `updates.signingPublicKey`   | `""`                                                                     | platform | Ed25519 public key used to verify the detached release checksum signature.                 |

## Export and import

Use the Settings view for a redacted export. `settings/import` accepts a document, target scope, optional Project ID, and a dry-run flag. Review skipped keys and validation errors before applying an import. An export does not transfer provider credential material; reconfigure accounts on the destination machine. Unknown plugin keys cannot be applied until their definitions are registered.

## Regeneration

```bash
npm run build
node scripts/generate-system-reference.cjs
node scripts/generate-system-reference.cjs --check
```

# Profile recovery and diagnostic worked examples

**Last updated:** 2026-10-26

This runbook expands the [operations guide](OPERATIONS_GUIDE.md) with reproducible actions and acceptance checks. It uses Lantern Workshop and an isolated service. The service owns profile settings, Project registrations and encrypted account credentials; Project workspaces retain their own files and records. See the [glossary](GLOSSARY.md) and [coverage inventory](DOCUMENTATION_COVERAGE.md) for these boundaries.

## Before a drill

Use the repository's installed dependencies and built contracts, service and client. Run from the repository root in a host-native shell. A changed source file requires a rebuild before the example can verify it. Do not share a profile between concurrent service instances.

```powershell
npm run build -w @gamecrafter/contracts
npm run build -w @gamecrafter/service-client
npm run build -w @gamecrafter/platform-service
node scripts/verify-documentation-recovery.cjs
```

The runner creates a unique `.turbo/documentation-recovery/<timestamp>` directory containing original/restored profiles, a disposable Project, archives and compact reports. It stops only service instances it started. It retains owned files for inspection instead of removing the recovery evidence. Synthetic credential and recovery-secret values are generated in memory and omitted from the report. It does not request a provider, engine or paid service.

The [retained report](examples/lantern-workshop/verification/profile-recovery.json) records the actual checks. Original failures, if a future run fails, remain under that run's directory; a printed earlier report is not acceptance of a later run.

## Inspect an explicitly selected profile

Use the [read-only diagnostic example](examples/service-diagnostics.cjs) against an already running service:

```powershell
node docs/examples/service-diagnostics.cjs --profile 'E:\GameCrafterProfiles\isolated'
node docs/examples/service-diagnostics.cjs --profile 'E:\GameCrafterProfiles\isolated' --project '<registered-project-uuid>'
```

Replace the path and UUID with actual values. The command requires an absolute profile path, derives the service endpoint with the public client path resolver, and authenticates using that profile's token. It does not start the service or guess the user's default profile.

The output contains service version/protocol/PID/profile identity and registered Project IDs/names/paths. With a Project ID it also fetches index counts, pending work, conflict and broken-reference counts, and vector-store kind/reachability. It does not request raw credentials, settings exports, private source text or provider logs. Paths and Project names can still be private; review output before sharing it.

An absent token, stopped endpoint or authentication error is a failed diagnostic, not a healthy empty profile. The command prints an error code/name and exits nonzero. Use the CLI `status` command and confirm the selected environment before retrying. A successful response proves the local service answered; it does not establish provider, editor or archive health.

## Diagnose a database without starting the service

Use the built CLI when startup fails or when checking a stopped profile/Project database before an independent restore. Select an existing file explicitly; the command does not use `GAMECRAFTER_PROFILE_DIR` to guess a database, start a service, migrate, repair, reset, vacuum or delete records:

```powershell
node packages/platform-service/lib/cli.js doctor --database 'C:\PlayWeld\diagnostic-copy\profile.sqlite' --kind profile
node packages/platform-service/lib/cli.js doctor --database 'C:\PlayWeld\diagnostic-copy\Project\.gamecrafter\project.sqlite' --kind project
```

Replace these example paths with the intended absolute database path. Both flags are required and may appear in either order; relative paths, duplicate/unknown flags and repair requests are rejected. Exit 0 means `healthy` or `upgrade-required` (a recognized older schema); exit 1 means a valid invocation found `missing`, `uninitialized`, `incompatible`, `corrupt` or `unavailable`; exit 2 means invalid arguments. Older readable databases still require a verified backup before normal startup performs migrations.

The schema-versioned JSON report contains the selected kind, UTC check time, current/latest migration versions when readable, check outcomes and fixed recovery guidance. It omits the filesystem path, raw SQLite error text, migration names and record values. `integrity_check(1)`, a foreign-key check, recognized migration-prefix validation and core-table markers run in one read transaction. A foreign-key failure is reported under `corrupt` with separate integrity/foreign-key outcomes; it does not assert physical page damage. `uninitialized` is not healthy and must not be treated as permission to initialize an unexpectedly empty file. This is structural/history validation, not a full semantic audit of every application table or proof that a backup contains the intended game.

The connection has SQLite read-only authority and does not change journal mode or force a checkpoint. SQLite can nevertheless create/update WAL shared-memory coordination files when reading a live database; read-only is not a claim that every filesystem byte is immutable ([SQLite WAL documentation](https://www.sqlite.org/wal.html#read_only_databases)). Stop the owning service before collecting a recovery copy and preserve the database with its `-wal`, `-shm` and any rollback-journal files. Never delete those files to make a diagnostic pass. Do not use SQLite's immutable mode against an active database. Lock/access/I/O failures are unavailable evidence, not proof of corruption. A scan can be expensive on a large file; no large-history performance qualification is claimed.

For recovery, keep the original untouched, use the [verified profile restore flow](#restore-and-launch-a-profile) or the corresponding Project restore into a separate empty destination, stop its owner, and diagnose the restored database. Then start the restored service with its explicit profile and verify Project identities, settings and representative authored content. A passing doctor result alone does not verify archive authenticity, credential decryptability or application readiness. In-place salvage, automatic quarantine/reset, derived-index repair and broader domain-ledger deletion remain outside this read-only command. The separate full knowledge rebuild below can repair its scoped lexical FTS index.

## Preserve and inspect a Project pre-migration snapshot

Before a registered Project database at a recognized older schema is upgraded, the service now takes a fresh snapshot under `.gamecrafter/pre-migration/project-v<old>-to-v<target>-<uuid>.sqlite`. It verifies integrity, foreign keys, old migration history and the Project ID before publishing the file and beginning migrations. A failed snapshot stops the upgrade. New and already-current databases do not produce a snapshot; this does not retroactively snapshot prior upgrades. Profile snapshots keep their existing policy.

After stopping the owning service, preserve the original Project folder, database and WAL/journal files, together with all published recovery files. Choose the intended old version and attempt using its filename and contents; the target in a filename is the attempted target, not proof that upgrade succeeded. Inspect the selected snapshot explicitly, using the doctor commands above with `--kind project`. An older valid snapshot should report `upgrade-required`; that is expected and does not authorize overwriting the original. Check the Project identity and representative history in an independent working copy with a compatible application. Preserve authored game/canon files at the intended revision as well: a database snapshot alone cannot recover the complete game.

Each retry gets a new snapshot; earlier snapshots are not pruned or overwritten, even after migration failure. Inspect disk use and make a verified encrypted backup before considering manual cleanup. Do not delete the newest useful recovery evidence to make an upgrade pass. A `.partial` file is unpublished/incomplete evidence and must not be selected as a verified recovery file; it may remain after interrupted execution. Snapshots are plaintext operational data, excluded from Git and source-to-clone copying. Existing encrypted whole-Project backups may include them, including their original identities; they are not automatically reidentified or selected on restore.

If snapshot creation or verification blocks startup, check free space, access and the recovery directory. The directory must not be a symlink/junction; its own `.gitignore` must contain only `*` followed by a newline (CRLF accepted). Preserve any conflicting file before repairing that local metadata. Do not change migration history or disable the check. General database salvage, automatic rollback, snapshot pruning, in-place restore, source-file version restoration and broad disaster-recovery qualification remain outside this feature. See [the architecture and boundaries](TECHNICAL_ARCHITECTURE.md#project-pre-migration-recovery-snapshots).

## Rebuild an index and validate the result

The recovery runner first reconciles the copied Lantern design, appends a unique synthetic phrase, and requests `knowledge/index/rebuild` with `full: true`. The returned value is a task ID, not a completed index. It polls that exact task until success, rejecting failure/cancellation and bounding the wait.

The service/client sequence is:

```javascript
const { taskId } = await client.call('knowledge/index/rebuild', {
  projectId,
  full: true,
});
const task = await client.call('task/get', { projectId, taskId });
// Poll to a terminal state with a bounded wait before claiming success.
const result = await client.call('knowledge/search', {
  projectId,
  query: uniquePhrase,
  mode: 'lexical',
  sources: ['docs'],
  limit: 5,
});
```

Verify the source path, quoted phrase and citation against the edited file. The runner requires a hit from `docs/DESIGN.md`; it also inspects `knowledge/index/status` through the diagnostic example. Do not delete canon documents to repair their derived index. Reconcile normal edits first; reserve full rebuild for the diagnosed index problem. Lexical success does not verify embeddings or a remote vector store. [Index implementation](../packages/platform-service/src/knowledge/) owns that distinction.

A full rebuild or full reconciliation now checks the knowledge lexical FTS index against retained chunk content before processing source edits. If that FTS-specific consistency check fails, the service transactionally rebuilds the disposable lexical index and verifies it again. A repaired task result summary starts with `Rebuilt lexical search index.`; the indexing tool output records `lexicalIndexRebuilt: true` and `noOp: false`. Wait for that exact task to succeed, then verify representative search results and citations. A full request is preserved even if an incremental indexing task is already active. Healthy full checks do not rebuild, and incremental watcher runs do not repair FTS.

This operation writes index state and is subject to the existing task/tool authority. Take a verified backup and preserve recovery evidence first. It rebuilds from the existing `knowledge_chunks` table and does not delete authored files, canon records, task history or vector mappings. It does not recreate missing schemas/triggers or repair general SQLite corruption, corrupt chunk content, board search or a remote vector database. A failed check/rebuild remains a task failure; do not delete database/WAL files or reset the Project to bypass it. Restore to an independent location for broader database damage. The [architecture](TECHNICAL_ARCHITECTURE.md#knowledge-lexical-index-recovery) documents this boundary.

## Restore and launch a profile

The runner creates a synthetic account without testing its endpoint, sets a platform override and registers a disposable Project. It then creates an encrypted local **profile** archive through `backup/identity/create`, `backup/addDestination` and `backup/run` with `scope: 'profile'`.

1. Poll the specific run with `backup/run/get` until **verified**. A run ID or archive filename alone is insufficient.
2. Inspect the archive with its recovery secret. Require `profile.sqlite` and the original `credentials.key`; service token/lock lifecycle files must not be restored from the archive.
3. Restore to a separate empty profile directory. Preserve the original profile and workspaces.
4. Stop the owning original service, select the restored profile, and start there. The runner supplies explicit resolved paths; a manual operator sets `GAMECRAFTER_PROFILE_DIR` before running the CLI.
5. Fetch the original Project ID and compare its workspace path; fetch the platform override and compare its value. Run the diagnostic command against the restored service.
6. After stopping the restored service, verify the synthetic account credential through the owning credential store and database seam. Do not print the value.

The passing drill demonstrates that the restored service launches and retains registration identity, the Restricted override and decryptable synthetic credentials. It does not move the Project workspace. Its registration still points to the original disposable game location. If that location is absent on a replacement host, separately restore the complete game workspace, then use `project/open` with its new absolute path to register the existing manifest identity there. Inspect the returned ID/path and trust state before running tasks. The unchanged-ID path relocation is source-reviewed here, separately from this drill's preserved-path acceptance; a Project archive restoration can instead allocate a new ID as documented in the operations guide.

This is relocation of a current profile plus its normal startup migrations. It does not certify upgrades from every historical schema, cross-OS relocation, restored provider login validity or installed plugin compatibility. [Profile snapshot code](../packages/platform-service/src/backup/snapshot.ts), [restore service](../packages/platform-service/src/backup/backup-service.ts) and [credential store](../packages/platform-service/src/profile/credential-store.ts) are implementation references.

## Demonstrate the credential recovery limit safely

The final check copies the stopped restored profile into another owned directory and replaces the credential key only in that copy. Reading the preserved ciphertext then fails authenticated decryption. The runner checks that the successfully restored profile's original key remains unchanged.

This is a demonstration of failure, not a recommended repair. A replacement key cannot recover old secrets. Recover a matching complete profile/key backup into a separate destination, or re-enter affected account credentials through the supported UI. Keep recovery secrets independently retrievable and protected. A redacted settings export, regenerated IPC token or preserved account display name does not recover the original credential.

Never perform this key replacement on an active or production profile. The runnable example uses random synthetic values, stopped stores and contained test directories. It calls SQLite only through the repository's [database seam](../packages/platform-service/src/db/database.ts).

## Record acceptance before retiring the original

Retain the run report, exact source/version, archive identity and inspected warnings. Compare representative settings, registration IDs/paths and restored files. Exercise the specific engine/provider/plugin operations that the installation actually needs in disposable targets before treating those separate dependencies as recovered.

The Project backup screenshots in the [workflow gallery](WORKFLOW_SCREENSHOTS.md#local-backup-restoration) remain useful for UI controls, wrong-secret rejection and occupied destinations. They are separate from this service-level profile drill. Installer downgrade/rollback, remote archive restoration and Windows isolated plugin execution retain their open status in the [coverage record](DOCUMENTATION_COVERAGE.md).

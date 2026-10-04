# Selectable embedded and managed vector storage

**Release:** 0.7.0

**Impact:** minor

**Category:** Added

## Summary

Add embedded LanceDB and SQLite exact vector storage, managed native Qdrant, and explicit existing-local/remote Qdrant configurations behind a backend-neutral storage boundary.

## Details

- Separate backend IDs from deployment ownership; retain `none` and legacy external Qdrant settings without changing lexical-only defaults.
- Add trusted, versioned adapter registration through service options. Unknown IDs and unsupported deployments fail closed. This is not isolated marketplace-plugin support.
- Replace Qdrant-shaped retrieval filters with typed neutral filters, generalized indexing/counting/cleanup, cached handles, and service shutdown disposal. Destination identity in vector mappings triggers re-embedding unchanged source content when storage changes.
- Add native LanceDB persistence with fixed Float32 Arrow dimensions, Project/version namespaces, filtered cosine search, serialized ID upserts, deletion, and lazy native loading. Pin SDK 0.29.0 with Arrow 18.1.0 to avoid optional inference runtimes added by newer SDK packaging.
- Add lightweight SQLite storage using the existing database seam, transactional upserts and exact filtered cosine scans. It is not sqlite-vec or an ANN index.
- Add managed Qdrant lifecycle and checksum-pinned build preparation for Windows/Linux x64; desktop resources include the native executable and Qdrant license. Existing local and remote Qdrant reuse the REST adapter.
- Managed Qdrant uses a private temporary working/config directory, strips inherited Qdrant overrides, authenticates readiness, and disables unused transports/telemetry. Windows shutdown terminates the process tree before its shell parent can exit; extended-length storage paths handle deep Project directories. Unexpected process exit can restart lazily on the next operation.
- Explicit remote mode requires permission to send embeddings/metadata and HTTPS. Existing-local mode requires a loopback IP. Legacy external mode deliberately retains its old transport policy, with a visible warning. Redirects are refused and API keys remain encrypted credential references.
- Add Knowledge UI selections, custom adapter deployment, consent messaging, and atomic snapshot-safe settings saves through the existing settings import transaction. Re-run indexing when settings change during an active task.
- Recover missing vector points even when source/mapping state is unchanged, retry failed source deletions without discarding their mappings, and keep derived vector directories out of Project Git and clone copies. Authenticated Qdrant requests refuse non-loopback cleartext HTTP even in legacy mode.
- Update architecture, requirements/decision register, evidence note, generated API/settings references, and release guidance. Source documents stay authoritative; no inference runtime or automatic source-of-truth migration is added.
- Old destination data remains retained until explicit cleanup; cached handles remain owned until service shutdown. Controlled deletion of retired backends, plugin-host adapters, live remote acceptance and installed-package recovery remain separate work.

## Validation

- Native LanceDB/SQLite, Qdrant REST fixture, registry, and fake-provider service integration passed focused checks, including destination switching, no-op reconciliation, point-loss recovery, deletion retry, and settings changes during indexing.
- New Knowledge UI rendering/settings-notification tests: 3 passed. Contract tests: 5 passed. Settings/service integration tests: 8 passed.
- Workspace build/typecheck/lint tasks passed, including desktop/browser development builds (desktop test/typecheck scripts remain configured placeholders). Final service suite: 401 passed, 11 skipped; contract tests: 67 passed; current UI suite: 54 passed; other package tests passed (five tests, one additional skipped). Change-tracking tests: 24 passed.
- Managed Qdrant tests: six passed, including actual native Windows Qdrant 1.19.1 authentication, persistence across restart, Project separation, point search/deletion, and shutdown. The fake-provider Knowledge integration exercised SQLite -> LanceDB -> managed Qdrant -> SQLite switching with no-op reconciliation. The original timeout fixture failure and subsequent Windows deep-path IO failure were reproduced and fixed; no fixture subprocesses remain. After the full suite, a cached-table deletion recovery regression was added; the six-file storage/integration selection passed all 27 tests, including externally removed LanceDB tables and native Qdrant collections.
- Generated RPC/settings freshness, release-version consistency, Markdown links, changed-file work-record coverage, and repository formatting passed.
- Verified Qdrant 1.19.1 Windows release archive SHA-256 and prepared its native executable/license. Installer assembly and Linux execution have not been verified in this task; no release version, commit, or publication was performed.
- Embedding generation uses the in-repository fake provider only; remote endpoint tests are configuration/transport tests, not live hosted-service acceptance.

## Files

- `.gitignore`
- `apps/control-room/electron-builder.yml`
- `apps/control-room/package.json`
- `apps/control-room/scripts/verify-windows-native.cjs`
- `docs/API_REFERENCE.md`
- `docs/PLATFORM_DESIGN.md`
- `docs/RELEASE_GUIDE.md`
- `docs/SETTINGS_REFERENCE.md`
- `docs/TECHNICAL_ARCHITECTURE.md`
- `docs/USER_GUIDE.md`
- `docs/OPEN_DECISIONS.md`
- `docs/DEVELOPMENT_PLAN.md`
- `docs/STATUS.md`
- `docs/reference/rpc-schemas.json`
- `docs/reference/settings-schemas.json`
- `docs/research/vector-storage-options.md`
- `package-lock.json`
- `packages/contracts/src/knowledge/knowledge.test.ts`
- `packages/contracts/src/knowledge/schema.ts`
- `packages/platform-service/package.json`
- `packages/platform-service/src/index.ts`
- `packages/platform-service/src/knowledge/knowledge-indexer.ts`
- `packages/platform-service/src/knowledge/knowledge-service.ts`
- `packages/platform-service/src/knowledge/knowledge.integration.test.ts`
- `packages/platform-service/src/knowledge/lancedb-vector-store.ts`
- `packages/platform-service/src/knowledge/lancedb-vector-store.test.ts`
- `packages/platform-service/src/knowledge/managed-qdrant.ts`
- `packages/platform-service/src/knowledge/managed-qdrant.test.ts`
- `packages/platform-service/src/knowledge/qdrant-vector-store.integration.test.ts`
- `packages/platform-service/src/knowledge/qdrant-vector-store.test.ts`
- `packages/platform-service/src/knowledge/qdrant-vector-store.ts`
- `packages/platform-service/src/knowledge/retriever.ts`
- `packages/platform-service/src/knowledge/sqlite-vector-store.ts`
- `packages/platform-service/src/knowledge/sqlite-vector-store.test.ts`
- `packages/platform-service/src/knowledge/vector-store.ts`
- `packages/platform-service/src/knowledge/vector-store-registry.ts`
- `packages/platform-service/src/knowledge/vector-store-registry.test.ts`
- `packages/platform-service/src/service.integration.test.ts`
- `packages/platform-service/src/service.ts`
- `packages/platform-service/src/settings/definitions.ts`
- `packages/platform-service/src/settings/registry.test.ts`
- `packages/platform-service/src/projects/workspace.ts`
- `packages/platform-service/src/projects/workspace.test.ts`
- `packages/theia-control-room/src/browser/knowledge-widget.tsx`
- `packages/theia-control-room/src/browser/knowledge-widget.test.ts`
- `scripts/prepare-qdrant.cjs`
- `docs/changes/2026-10-04-vector-storage-backends.md`

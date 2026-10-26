# Recover inconsistent knowledge lexical indexes during full reconciliation

**Release:** Unreleased

**Impact:** patch

**Category:** Fixed

## Summary

Full knowledge rebuild/reconciliation now recovers inconsistent FTS entries from retained chunk content, rather than reporting success while unchanged documents remain absent from lexical search.

## Details

- Before this correction, source fingerprints caused unchanged files to be skipped even when their external-content FTS entries were lost. The knowledge store now checks FTS consistency against its chunk table, rebuilds only on SQLite's FTS-specific `SQLITE_CORRUPT_VTAB` result, and verifies the rebuilt index in the same immediate transaction. A failed rebuild/final verification rolls back. Lock/I/O/general-corruption errors propagate without attempting a rebuild; missing tables and triggers are not recreated.
- Full rebuild and reconciliation run that check before source mutations, preventing stale FTS deletion triggers from blocking ordinary source reconciliation. Healthy indexes do not rebuild, and incremental watcher runs do not perform this scan. The operation repairs only lexical index state; authored files, canon records, existing chunk rows, task/event history, embedding profiles and vector mappings are not reset or deleted by the repair.
- A requested full rebuild could previously reuse an active incremental-only task. Task deduplication now requires an active full request to satisfy a new full request. If a full indexer call encounters another active run, it waits and then performs a full check, preserving the requested recovery operation.
- Indexing tool results include `lexicalIndexRebuilt`; actual repair reports `noOp: false` and advances the full-reconcile timestamp. The task's persisted summary explicitly states that the lexical search index was rebuilt. Healthy unchanged reconciliations retain no-op behavior.
- Tests reproduce missing search hits through a real local service/client and supervised task, require the full task input, verify search recovery, unchanged source/chunk content and retained prior events/tasks, and exercise subsequent incremental/full requests. Store fixtures verify consistency repair, stable metadata/content, later update triggers, repeat no-op behavior, rollback of a post-rebuild failure, and refusal to rebuild on SQLite lock/locked/I/O/general-corrupt/not-a-database errors. Injected failure cases are transaction/control-flow evidence, not physical disk-fault qualification.
- The architecture and recovery runbook describe the write authority, task-result evidence, operator backup/preservation steps and supported FTS-only boundary, with links to SQLite's primary FTS5 documentation. Plan, status and W05/R04 register entries reflect this bounded completion without closing broader W05/S09 recovery or retention. The matching Features Project card retains the broader In progress scope; implementation and verification notes link the committed candidate and PR. Original assessment/priority/effort fields and unrelated cards are preserved.
- Compatibility: no dependency, RPC method/record schema, setting or migration change; profile/Project migration targets remain 21/14 and no migration is required. The additive generic indexing-tool result field uses the existing tool-result envelope. Product version remains 0.22.0 pending. Patch impact corrects existing full-rebuild behavior rather than introducing a new operator API.
- Limits: general database repair/quarantine, missing schemas/triggers, board FTS, corrupt chunk/canon content, vector-backend recovery, additional ledger deletion, large-history performance, installed desktop and release qualification remain open. Read-only doctor semantics are unchanged. Existing shared-checkout inventory/prioritization work and the flagged native opener executable are untouched; endpoint protection remains enabled.

## Validation

- Red reproduction: `npm test -w @gamecrafter/platform-service -- src/knowledge/knowledge.integration.test.ts -t "recovers lost lexical"` failed because a completed full rebuild returned no `docs/recovery.md` search hit. An added task-input assertion then independently exposed the full request being replaced by `full: false`; both paths pass after correction. A preservation assertion initially used `stateHash`, which includes the deliberately updated full-reconcile timestamp; it was corrected to compare actual retained chunk rows, with whole-store hash preservation checked separately at the store seam.
- `npm test -w @gamecrafter/platform-service -- src/knowledge/knowledge-store.test.ts src/knowledge/knowledge.integration.test.ts`: 17 tests passed across two files, including the real local RPC/task recovery fixture, persisted repair/no-op audit evidence, orphan-entry repair, missing-table preservation and injected rollback/failure cases.
- `npx turbo run build typecheck lint --concurrency=1`: 25 tasks passed, 17 cached, including desktop/browser builds; existing bundler require.resolve warning retained.
- `npx turbo run build typecheck lint test --filter=!@gamecrafter/platform-service --concurrency=1`: 30 tasks passed, 28 cached. Service build/typecheck/lint were checked separately; service tests are recorded separately below.
- Final service typecheck/lint passed after test assertions were extended. `npm run test:changes` passed 13 tests; generated RPC/settings and documentation inventories, documentation evidence, version agreement (0.22.0), formatting, whitespace and changelog coverage checks passed. `bash scripts/check-links.sh` reported All links OK.
- `npm test -w @gamecrafter/platform-service -- --exclude src/updates/installer-handoff.test.ts --exclude src/dcc/blender-real.test.ts`: 765 passed/8 skipped across 134 files (133 passed/one skipped), 392.53 seconds. Logs: `.turbo/knowledge-recovery-service-tests.log`, `.turbo/knowledge-recovery-focused-final.log`, `.turbo/knowledge-recovery-quality.log`, `.turbo/knowledge-recovery-other-quality.log`, `.turbo/knowledge-recovery-format.log` and `.turbo/knowledge-recovery-links.log` in the primary checkout. A subsequent focused run includes all final audit/no-op and missing-table assertions; no production code changed after the broad run started.
- Native installer executable fixtures and live Blender tests are excluded from the local broad service run to retain the existing endpoint-protection/external-application boundary. Hosted checks will use normal unexcluded CI commands. No antivirus exclusions, quarantine changes, live providers/engines, installer or installed-product recovery checks were performed.

## Files

- `packages/platform-service/src/knowledge/knowledge-store.ts`
- `packages/platform-service/src/knowledge/knowledge-store.test.ts`
- `packages/platform-service/src/knowledge/knowledge-indexer.ts`
- `packages/platform-service/src/knowledge/knowledge-service.ts`
- `packages/platform-service/src/knowledge/knowledge.integration.test.ts`
- `docs/TECHNICAL_ARCHITECTURE.md`
- `docs/RECOVERY_RUNBOOK.md`
- `docs/DEVELOPMENT_PLAN.md`
- `docs/OPEN_DECISIONS.md`
- `docs/STATUS.md`
- `docs/changes/2026-10-25-knowledge-lexical-index-recovery.md`
- `CHANGELOG.md`

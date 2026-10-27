# Audit retention and deletion controls

**Release:** 0.23.0

**Impact:** minor

**Category:** Added

## Summary

Add scoped audit-history retention to Audit & History, with separate preview/confirmation for manual deletion, explicit automatic-retention opt-in, and durable per-store cleanup receipts. This implements the audit-history portion of WP7/S09; other domain stores and service-log pruning remain separate work.

## Details

- Previously Audit & History exposed reading/export without audit deletion controls. Add four authenticated, typed RPCs for reading policy/receipts, atomically setting Project policy, previewing eligible cleanup and applying a confirmed preview. Generated references now describe 204 request methods and 88 built-in settings. Existing export contracts remain compatible.
- Add platform defaults and Project overrides for `audit.retentionDays` (0 means keep indefinitely), `audit.deletionEnabled` (false) and `audit.autoPrune` (false). Automatic cleanup requires both explicit enablement and positive days. Policy saving uses the existing settings-import transaction; no new frontend-owned durable state is introduced.
- Manual cleanup normalizes a UTC cutoff and selects strictly older records. Review tokens are session/Project/store bound, expire after five minutes, are consumed before mutation, and are invalidated by changed policy or selected row content through a recomputed SHA-256 fingerprint under locks. Cache at most 100 metadata/count/fingerprint reviews without retaining audit payload copies. Reject missing Projects, stale/expired/foreign tokens and empty batches. Session close and service stop clear reviews.
- Project cleanup batches at most 250 finished tool calls and 250 task lifecycle events, plus eligible linked resolved approvals and tool-call events. Pending/recent approval evidence remains. Task-related deletion requires the complete root tree to be terminal, unleased and older than the cutoff. Active, leased, recent or invalid task context protects the tree and its transitive prerequisite trees across dependency links. Preserve other domain/provenance events, task projections, questions, answers, checkpoints, results, artifacts and Project files.
- Model cleanup independently batches up to 250 completion-usage, 250 completed assessment and 250 legacy self-reported usage records. Apply the same task protection; retain unattributed legacy usage while any Project task history is protected. Remove eligible current usage/assessment rows but retain router decisions/outcomes, quality/cost learning, budgets/spending and other accounting. Suppress eligible legacy audit projections with an `audit_retained` flag, including fallback rows linked to removed completion usage, so audit reads do not resurrect deleted usage from retained learning data.
- Write each store's deletion and receipt in one transaction. Project receipts are permanent `audit.pruned` events with sequences above the pre-deletion maximum. Model receipts live in the profile. A Project lock holds task context stable during model cleanup; this is per-store atomicity, not a global transaction across both databases. Receipt failure rolls back the affected store. Return the latest 20 receipts per store without removing older receipts, and expose IDs, origin, scope, cutoff and counts without deleted payloads.
- Run automatic retention every 60 seconds for available, explicitly opted-in Projects. Skip empty batches, isolate failures by store, avoid raw audit payloads in warning logs, and stop the timer on service shutdown. Each successful automatic batch retains its own receipt.
- Add the Retention & deletion panel with saved-policy controls, separate Project/model store choice, UTC date input, read-only counts and an unchecked confirmation box. Prevent duplicate submissions, invalidate review on policy/date/store/Project changes or expiration, clear review after any apply attempt, ignore late responses after unmount and refresh history after manual success. Receipts can be refreshed after automatic cleanup; controls wrap at narrow widths.
- Add contract, real SQLite unit, native authenticated RPC, migration and renderer regression coverage. The prerequisite regression first reproduced deletion of completed evidence still needed by active work, then verified recursive protection and release after all dependent work finishes. Receipt-trigger failures exercise transaction rollback; other cases cover pending children/approvals, stale review, session identity, expiry/reuse, policy changes, batching, monotonic sequence, automatic opt-in/shutdown and preservation of router learning.
- Update WP7/S09 and status consistently as scoped implementation, add architecture/default and authority documentation, operator/recovery instructions and user navigation, and regenerate RPC/settings/documentation references. Correct the architecture's stale page-only export and unimplemented grouping description to match the already implemented full export and Requests view.
- Compatibility/migration: additive RPC/settings contracts, profile migration 21 adds the retained-audit flag defaulting to 1 for existing router outcomes and the model receipt table; migration regression preserves prior learning values. Project schema remains 14. No dependency/package changes or removals in this task. Existing settings remain compatible; `logs.retentionDays` does not implement log cleanup. Audit deletion is logical deletion and does not remove exported files, backups, cached copies, operational task data or retained learning payloads.
- Minor impact reflects compatible new user-facing functionality. Product version remains 0.22.0 while work is pending; no release, installer, tag or publication is prepared.

## Validation

- Regression-first focused tests reproduced the missing cleanup RPC and the transitive prerequisite protection defect before implementation. Focused retention unit and authenticated service integration tests pass after the fixes; migration, contract and renderer suites also passed during iteration.
- Final `npx turbo run build typecheck lint test --concurrency=1` after the dependency-protection correction passed all 33 tasks (22 cached), with 959 tests passed and 7 skipped across 191 test files: contracts 78, platform service 723 passed / 6 skipped, Theia extension 153, and remaining workspace suites. Both Electron and browser application builds passed. Existing app-shell lint/typecheck/test scripts report skip; the extension/service/shared packages supply actual checks. Evidence: `.turbo/audit-retention-quality-complete.log`; two earlier full runs also passed during implementation.
- Generated system references/inventory freshness, documentation evidence integrity, release-version agreement, Markdown links, formatting, change-record coverage and whitespace checks passed. Evidence includes `.turbo/audit-retention-links.log` and `.turbo/audit-retention-format.log`. Final artifact checks were repeated after recording browser acceptance.
- Puppeteer acceptance against the built browser application and authenticated service passed eight checks with zero renderer errors: defaults keep history; preview does not mutate and requires separate confirmation; Project switching clears review; stale selected data rejects deletion; confirmed Project cleanup removes exactly one eligible call, resolved approval and event while preserving active work, pending approval, another Project and files; separately confirmed model cleanup preserves the foreign ledger; the real 60-second service timer performs opted-in cleanup in both stores with independent automatic receipts; and a 480px viewport has no horizontal overflow (audit panel client/scroll width both 383px). Inspected both wide and narrow screenshots. Evidence: `.turbo/audit-retention-ui/report.json`, `review-before-deletion.png`, `retention-narrow.png` and `.turbo/audit-retention-ui-final.log`.
- Earlier browser harness attempts exposed navigation readiness and stale built extension output, not a completed product validation. Corrected fixture navigation/readiness, rebuilt the extension/application with the owned backend stopped and then completed the final flow. Automatic cleanup was disabled for the disposable Project in teardown and its pending task was cancelled. Stopped the owned backend after verifying the listening PID; port 3131 is free and the isolated service reports `not running`. No ordinary user profile or Project data was deleted.
- Validation uses disposable profile/Project data and fixtures. No live model/engine/DCC integration, large-history performance qualification, packaged Electron launch, installer, secure erasure or production acceptance is claimed. Broader domain retention and service-log pruning remain unimplemented.

## Files

- `packages/contracts/src/audit.ts`
- `packages/contracts/src/audit.test.ts`
- `packages/contracts/src/rpc/protocol.ts`
- `packages/platform-service/src/audit/audit-retention.ts`
- `packages/platform-service/src/audit/audit-retention.test.ts`
- `packages/platform-service/src/audit/audit-retention.integration.test.ts`
- `packages/platform-service/src/settings/definitions.ts`
- `packages/platform-service/src/settings/registry.test.ts`
- `packages/platform-service/src/service.integration.test.ts`
- `packages/platform-service/src/profile/migrations.ts`
- `packages/platform-service/src/profile/migrations.test.ts`
- `packages/platform-service/src/models/router.ts`
- `packages/platform-service/src/service.ts`
- `packages/theia-control-room/src/common/control-room-protocol.ts`
- `packages/theia-control-room/src/node/control-room-service.ts`
- `packages/theia-control-room/src/browser/audit-retention-panel.tsx`
- `packages/theia-control-room/src/browser/audit-retention-panel.test.tsx`
- `packages/theia-control-room/src/browser/audit-widget.tsx`
- `packages/theia-control-room/src/browser/style/index.css`
- `docs/DEVELOPMENT_PLAN.md`
- `docs/STATUS.md`
- `docs/OPEN_DECISIONS.md`
- `docs/TECHNICAL_ARCHITECTURE.md`
- `docs/SKILLS_AGENTS_AND_TOOLS.md`
- `docs/PLATFORM_DESIGN.md`
- `docs/CONTROL_ROOM_HANDBOOK.md`
- `docs/OPERATIONS_GUIDE.md`
- `docs/USER_GUIDE.md`
- `docs/API_REFERENCE.md`
- `docs/SETTINGS_REFERENCE.md`
- `docs/reference/rpc-schemas.json`
- `docs/reference/settings-schemas.json`
- `docs/reference/DOCUMENTATION_INVENTORY.md`
- `docs/reference/documentation-inventory.json`
- `docs/changes/2026-10-24-audit-retention.md`

# Export complete retained Project audit history

**Release:** 0.23.0

**Impact:** minor

**Category:** Added

## Summary

Complete WP7's deferred full-history audit export. Audit & History previously downloaded only the loaded page and could omit older activity. A separate service-owned export now prepares all retained Project calls, approvals, events and model usage as validated, redacted JSON, with a checksum/count receipt and a Control Room download action.

## Details

- Add the compatible authenticated `audit/export` request and exported `AuditExportSchema`/receipt/count contracts. The method accepts only Project identity, not an arbitrary output path or user-supplied SQL/filter/cursor. Keep protocol version 1, existing `audit/read` semantics and page download intact. Generated references now describe 199 requests, 28 notifications and the unchanged 85 builtin settings.
- Serialize history to a unique file under the selected Project's `.gamecrafter/cache/audit-exports/`. Use an exclusively created private partial file, complete-write loops, incremental SHA-256/byte accounting, close and rename before returning the receipt. Validate each redacted record before publication. On a write/serialization/validation failure, remove the partial and preserve source records and previous exports. Check each cache ancestor's resolved containment so a linked export directory cannot redirect output outside the Project.
- Extend the existing SQLite seam with a lazy row iterator; do not introduce another SQLite interface. ToolStore and TaskStore provide source-owned complete call/approval/event projections; calls and approvals also filter their explicit Project identity. Hold Project and profile transactions during synchronous serialization to keep both stores stable. Memory scales with the largest row/serialized record instead of the complete history, but long exports block service work and other writers; large-dataset performance is not qualified.
- Refactor model usage projection into a reusable generator. The existing bounded view retains its per-source limit, cross-source chronological sort and final page limit; the exporter consumes all eligible rows. Include current completions, legacy self-reported route outcomes and eligible decision-inference usage; exclude legacy duplicates already represented by current usage and pending assessments without billable evidence. Preserve nullable token counts, unknown/unverified costs and cache counts without inventing prices or zeros.
- Share model-label redaction between page and full export, preserving internal model identifiers so records continue to join to their registered models. Preserve numeric `*Tokens` fields instead of letting the sensitive-key matcher replace them with strings. Redact credential-like nested fields and whole-value token strings using existing policy, then validate the exported record shape. This is routine redaction, not proof that arbitrary free text contains no private information; operator guidance requires review before sharing.
- Add the separate **Export full history** action using the backend's typed service bridge and Theia's existing file-download service. It works independently of the loaded page/filter, prevents duplicate preparation while in progress, captures the requested Project identity, and reports preparation counts/bytes and retained-cache behavior. Export errors leave the loaded page, filter and pagination state intact. Keep the existing redacted-page download available, and distinguish page/full export explicitly in the event-section guidance.
- Reconcile WP7/STATUS and S09 without closing prompt grouping, audit retention/deletion or unrelated export scopes. Record the engineering default in architecture, contracts guidance and the decision log; update the handbook and operations guide with scope, download/cache handling, redaction limitations and service-pause behavior. Map audit RPC inventory evidence to its new owning source directory and regenerate API/schema/inventory projections.
- Compatibility: additive RPC and export format; no database migration, dependency or package-version change. Product version remains 0.22.0 while pending; impact `minor` reflects a compatible user-visible capability. Export files are separate local cache artifacts, not backup archives or encrypted credential recovery. Repeated exports remain until manually removed or applicable cache cleanup; crashes can leave unpublished partial files. No power-loss durability, archive completeness, installed Electron/Linux or production-scale performance claim is made.
- Preserve the prior uncommitted security/documentation and plugin-upgrade work. This record owns only complete audit export, its supporting changes and evidence. No ordinary profile/Project, paid external provider, production engine/DCC session, release, installer, GitHub settings or published artifact is changed for this feature. The broader suite executes its existing disposable Blender/Qdrant fixtures where available; those checks do not establish complete live integration acceptance.

## Validation

- Red integration evidence: after correcting invalid fixture request/decision values, the old service failed with `Method not found: audit/export` while `audit/read` returned only 500 calls. Red UI evidence: the rendered action was absent. Logs: `.turbo/audit-export-red.log`, `.turbo/audit-export-ui-red.log`.
- Native authenticated RPC integration now exports 1,201 fixture calls/events and 1,201 current model records, plus one eligible legacy usage row and one decision inference. It validates the complete file schema, array counts, UTF-8 content, byte length/SHA-256, nested redaction, preserved numeric token/cache counts, legacy deduplication, pending-assessment exclusion, foreign-Project exclusion, unknown-Project rejection, original history preservation, failure cleanup and external junction/symlink rejection. Disable unrelated board maintenance and identify fixture records explicitly so background events do not become brittle exact-total assertions; restore deliberately corrupted fixture input after the failure probe. Final focused integration passed.
- Focused service/router/decision/main-RPC checks passed 37 tests across four files; subsequent expanded integration passed. Focused UI passed eight tests, including full export without a page, preserving filters/page state across asynchronous Project selection, and retryable preparation errors. Focused contract/RPC checks passed four tests across two files. No assertions were weakened to mask a product failure; fixture corrections account for actual contract values and independently scheduled activity.
- The first full gate exposed that applying generic whole-value redaction to long internal model IDs broke an existing model-routing audit assertion. Reproduced the failure in the unchanged model integration suite, removed that extra ID masking, and retained label redaction and numeric token/cache handling. The unchanged model integration and expanded audit integration then passed together (eight tests); final full-gate results follow below.
- Puppeteer acceptance against the built browser application passed five checks with zero renderer errors: download all 1,201 fixture calls/events/model records from a later event page with a nonmatching filter; verify redaction and numeric token/cache preservation; preserve page/filter selection; match downloaded bytes to the service artifact; renderer health. Final file: 1,155,846 bytes, 1,202 calls (including independent service activity), 1,212 events and 1,201 model-usage records. Corrected the harness to count its fixture records explicitly rather than rejecting legitimate background calls. Evidence: `.turbo/audit-export-ui/report.json`, `full-history-export.png`, `.turbo/audit-export-ui-final.log`. The final build was checked again after clarifying page/full-export guidance. Stopped the owned browser server after validating its port owner; port 3129 is free and the isolated service reports `not running`. This is automated browser/source-fixture evidence, not installed-product or large-dataset acceptance.
- Generated-reference/inventory freshness (199 requests, 28 notifications, 85 settings, 27 service subsystems), documentation evidence integrity, release-version agreement, Markdown links, formatting and change-record coverage checks passed. Final `npx turbo run build typecheck lint test --concurrency=1` passed all 33 tasks (22 cached), with 930 tests passed / 7 skipped across 184 files: contracts 76, service 712 passed / 6 skipped, Theia extension 137, and the remaining workspace suites. A final frozen-source repeat after the UI guidance correction also passed all 33 tasks (25 cached), including Electron/browser application builds. Logs: `.turbo/audit-export-quality-final.log` and `.turbo/audit-export-quality-frozen.log`. Existing app-shell lint/typecheck/test scripts report `skip`; real application builds and extension/service checks must be distinguished from those placeholders.

## Files

- `packages/contracts/src/audit.ts`
- `packages/contracts/src/audit.test.ts`
- `packages/contracts/src/index.ts`
- `packages/contracts/src/rpc/protocol.ts`
- `packages/platform-service/src/audit/audit-export.ts`
- `packages/platform-service/src/audit/audit-export.integration.test.ts`
- `packages/platform-service/src/db/database.ts`
- `packages/platform-service/src/tools/tool-store.ts`
- `packages/platform-service/src/tasks/task-store.ts`
- `packages/platform-service/src/models/router.ts`
- `packages/platform-service/src/service.ts`
- `packages/theia-control-room/src/browser/audit-widget.tsx`
- `packages/theia-control-room/src/browser/audit-widget.test.tsx`
- `packages/theia-control-room/src/common/control-room-protocol.ts`
- `packages/theia-control-room/src/node/control-room-service.ts`
- `scripts/generate-documentation-inventory.cjs`
- `docs/API_REFERENCE.md`
- `docs/reference/rpc-schemas.json`
- `docs/reference/DOCUMENTATION_INVENTORY.md`
- `docs/reference/documentation-inventory.json`
- `docs/DEVELOPMENT_PLAN.md`
- `docs/STATUS.md`
- `docs/OPEN_DECISIONS.md`
- `docs/TECHNICAL_ARCHITECTURE.md`
- `docs/PLATFORM_DESIGN.md`
- `docs/SKILLS_AGENTS_AND_TOOLS.md`
- `docs/CONTROL_ROOM_HANDBOOK.md`
- `docs/OPERATIONS_GUIDE.md`
- `docs/changes/2026-10-24-full-audit-export.md`

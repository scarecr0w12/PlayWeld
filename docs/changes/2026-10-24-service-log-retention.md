# Service-log retention and pruning

**Release:** 0.23.0

**Impact:** minor

**Category:** Added

## Summary

Make the existing platform `logs.retentionDays` setting effective for CLI diagnostic files. Prune recognized expired entries at startup, immediately after policy changes/reset/import and every minute, while preserving the existing current-file/one-rotation size policy and stderr diagnostics.

## Details

- Previously the CLI wrote redacted `service.jsonl` diagnostics and replaced `service.1.jsonl` at roughly 5 MiB, but never used the existing retention setting. The owning CLI now applies the saved platform policy after settings load. The default remains 30 days with a minimum of one; no Project/session override, new setting, protocol method or zero/keep-forever meaning is added. Clarify the setting's UI/reference description that this controls maximum age and size rotation can replace records earlier.
- Add a service-to-owner callback for the initial effective retention value and platform setting changes, including import and reset. Embedded service instances leave process-global logging alone unless their owner explicitly opts into the callback/logger. A CLI-owned unreferenced 60-second timer prunes quiet files without depending on new writes. Signal and authenticated RPC shutdown still write the final diagnostic, dispose the logger/timer and release the process lock. Initialization failure also releases the lock, and logger disposal occurs after the top-level startup-error diagnostic is persisted.
- Scan only `service.jsonl` and `service.1.jsonl`. Remove complete recognized JSON log entries with literal string levels and canonical logger timestamps strictly older than the configured cutoff; do not coerce array/object level values into recognized levels. Preserve exact-cutoff/future entries and malformed, truncated, undated, noncanonical or invalid-UTF-8 input byte for byte. Blank/unknown records are retained. Fully expired files are unlinked; unrelated files are never selected. Unexpected files above 10 MiB or 100,000 lines are preserved with a generic stderr warning, bounding cleanup reads and line bookkeeping.
- Compact mixed files through an exclusive mode-0600 temporary file, file sync and atomic replacement after rechecking the original file identity/size/mtime. A failed replacement preserves the original and attempts temporary-file cleanup. Atomicity is per file; neither a two-file transaction nor power-loss recovery is claimed. Interrupted processes may leave a private temporary copy for stopped-service operator review. Do not automatically delete such copies by filename.
- Reject redirected log directories, symbolic links, nonregular and multiply linked files. Verify the real directory identity and opened-file identity, use no-follow opens where supported, and apply the same file checks to append and size rotation. Retain generic error messages and redacted stderr fallback. These are conservative path/accidental-change guards, not a proof against all concurrent filesystem operations by another same-user process. Normal size rotation can still supersede evidence preserved by age pruning.
- Add regression-first coverage for age selection, cutoff/future/malformed retention, unknown timestamps, byte preservation, dynamic policy, quiet periodic execution, timer disposal, hard-linked files, redirected directories and atomic replacement failure. Extend the real compiled CLI lifecycle test with a persisted 365-day policy, expired startup/rotation entries, live shortening, reset-to-default, unrelated-file preservation and normal shutdown; isolate connection-readiness retries from assertions/mutations. Add CLI startup-failure tests proving that an unsafe log directory does not leave a stale process lock and a corrupt-profile startup error is persisted before logger disposal.
- Update WP7 status, S09 in place, architecture/default records, current status and user/operator instructions. Explain configuration, maximum-age versus guaranteed-duration semantics, failure recovery, private temporary-file handling and separation from SQLite audit cleanup. Regenerate the setting reference/schema description; counts remain 204 requests and 88 built-in settings. Existing audit-retention/export work and its permanent records remain intact; broader domain/operational/accounting retention remains open.
- Compatibility/migration: no new packages, dependencies, RPC/data schemas or migrations. Profile schema remains 21 and Project schema 14. Existing CLI lifecycle/technical identifiers and two-file size rotation remain compatible. The previously unused existing setting now causes automatic logical age deletion, including its saved/default policy on startup; preserve required diagnostics before shortening it. Audit enablement is independent, and no SQLite cleanup receipt is created. SQLite rows, Project files, exports, backups and arbitrary log-directory files are outside this policy. No secure erasure is claimed.
- Minor impact reflects newly functioning compatible retention behavior. Keep version 0.22.0 pending; no packaging, installer, tag or publication is prepared.

## Validation

- `npm test -w @gamecrafter/platform-service -- src/logger.test.ts` first failed four new cases while the original persistence/size-rotation case passed, reproducing the missing retention hook and redirected-directory acceptance. Evidence: `.turbo/service-log-retention-red.log`.
- Focused logger/compiled CLI suites passed ten tests in two files after implementation. The atomic-replacement probe initially failed because its filesystem spy did not intercept an ESM builtin binding; corrected the test mock and verified original-byte preservation plus temporary cleanup without changing the assertion. Evidence: `.turbo/service-log-retention-final-focused.log` (ten passing tests), with earlier lifecycle checks in `.turbo/service-log-retention-lifecycle-final.log`. A final regression reproduced coercion of an array-shaped log level into a recognized value; require a literal string level and preserve that unknown record shape. Red evidence: `.turbo/service-log-retention-unknown-shape-red.log`; the final focused suite passed afterward.
- Native acceptance against the compiled CLI and a disposable profile passed six checks: saved-policy startup pruning, live shortening, reset to the default, real quiet-file periodic pruning, preservation of unrelated files/SQLite model-usage sentinel, and clean shutdown. Native acceptance has been repeated during implementation with real intervals of approximately 60 seconds; the final report records its exact elapsed time. Both managed files lost expired entries and retained fresh ones, using entry timestamps rather than file modification times. Evidence: `.turbo/service-log-retention-native/report.json` and `.turbo/service-log-retention-native.log`. The isolated daemon reports not running and its lock is removed; no ordinary profile or Project was modified.
- The complete `npx turbo run build typecheck lint test --concurrency=1` attempt did not produce a complete passing report: the existing native Windows opener fixture failed in temporary-directory cleanup and worker/tool entry files disappeared, followed by worker termination. Earlier preparation runs were interrupted and are not counted as passing gates. See [the separate investigation/recovery record](../changes/2026-10-24-native-opener-fixture-cleanup.md); no antivirus-setting change or test assertion weakening is retained.
- After verified local-tool restoration and forced service-output rebuilding, `npx turbo run build typecheck lint --concurrency=1` passed 25 tasks (17 cached), including Electron/browser application builds; `npx turbo run test --concurrency=1 --filter='!@gamecrafter/platform-service'` passed 14 tasks (12 cached). App-shell lint/typecheck/test placeholders still report skip. The service suite with only `--exclude src/assets/external-open.windows.test.ts` passed 730 tests / 6 skipped across 133 files in 593.38 seconds. Together with other workspaces, 966 tests passed / 7 skipped across 190 files, with one existing native Windows opener test explicitly excluded. This does not establish a complete full-gate pass. Evidence: `.turbo/service-log-retention-service-verified.log`, `.turbo/service-log-retention-build-quality.log` and `.turbo/service-log-retention-other-tests-verified.log`.
- Generated-reference/inventory freshness (204 requests, 88 settings), documentation evidence integrity, release-version agreement, Markdown links, formatting, whitespace and changelog coverage checks passed. The user later supplied the Bitdefender behavioral-block notice and restart requirement (`SuspiciousBehavior.567DCD8166FD2594`); preserve the full-gate limitation and stop further native-opener runs/recovery until the event is reviewed. No antivirus setting changes or device restart were performed.
- No frontend code changed; the existing Settings control is covered through its authenticated settings RPC and real CLI owner rather than new browser acceptance. No new live provider/engine/DCC workflow, packaged desktop/installer, power-loss drill, large-history qualification or production acceptance is claimed. Existing full-suite integration evidence must be distinguished from qualification of this feature.

## Files

- `packages/platform-service/src/logger.ts`
- `packages/platform-service/src/logger.test.ts`
- `packages/platform-service/src/cli.ts`
- `packages/platform-service/src/cli.test.ts`
- `packages/platform-service/src/service.ts`
- `packages/platform-service/src/settings/definitions.ts`
- `docs/TECHNICAL_ARCHITECTURE.md`
- `docs/DEVELOPMENT_PLAN.md`
- `docs/STATUS.md`
- `docs/OPEN_DECISIONS.md`
- `docs/PLATFORM_DESIGN.md`
- `docs/OPERATIONS_GUIDE.md`
- `docs/CONTROL_ROOM_HANDBOOK.md`
- `docs/USER_GUIDE.md`
- `docs/SETTINGS_REFERENCE.md`
- `docs/reference/settings-schemas.json`
- `docs/changes/2026-10-24-service-log-retention.md`

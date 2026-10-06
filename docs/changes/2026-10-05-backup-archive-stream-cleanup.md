# Close backup archive streams before staging cleanup

**Release:** 0.12.0

**Impact:** patch

**Category:** Fixed

## Summary

Close and await archive source streams when rejecting an unlock secret or completing a manifest preview. The live packaged knowledge acceptance run exposed an open-file Windows cleanup failure that replaced the intended unsuccessful verification result with an internal RPC error.

## Details

- Archive readers now release their async iterators in a finally block covering header parsing, unlocking and payload reading, and await readable stream completion before returning. Unlock-key zeroing remains intact; caller-supplied archive keys remain caller-owned.
- Add real-file regressions for wrong-secret rejection and partial manifest reads, plus an authenticated backup verification regression confirming a wrong secret returns `ok: false` and subsequent correct verification succeeds.
- No archive format, database schema, API or credential migration changes. Preserve the staged 0.11.0 candidate and its failing evidence; prepare a new numeric version for the repaired build.

## Validation

- Before the fix, both new real-file tests failed because the archive stream remained open when the reader returned.
- After the fix, archive and backup service integration tests passed (9 tests across 2 files).
- Full repository build/typecheck/lint/test gate passed all 33 tasks without cache hits: platform service 513 passing tests, 11 existing skips; Theia extension 104 passing tests. Separate-process source 0.12.0 acceptance passed 28 checks including wrong-secret verification and actual restored native search, with zero failures and one live OpenAI access blocker.
- Staged 0.11.0 live reproduction: `backup/verify` with a wrong recovery secret raised RPC -32603 with Windows EPERM while removing its owned verification staging directory. Source-buffer archive tests had not covered file-handle lifetime.
- Repaired staged 0.12.0 live acceptance passed 28 checks, zero failures, one provider-access blocker at `.artifacts/knowledge-live-2026-10-05/staged-0.12.0-live-run/report.json`. Wrong-secret verification returns unsuccessful verification without an internal cleanup error; correct verification and native restore/reindex pass.
- Repaired staged desktop Knowledge acceptance passed 7 checks with zero renderer exceptions; broader live desktop smoke passed 29 checks. The OpenAI catalog candidates are selectable in the actual UI. Real semantic/vector/backend-switch checks remain blocked by fresh HTTP 403 `model_not_found` responses for both embedding models; no mock vectors were used.
- Left the actual 0.12.0 staged desktop running against its retained isolated acceptance profile and Observatory Project. Authenticated runtime version/profile and search for the UI-edited marker were verified after relaunch. Deployment evidence is `staged-0.12.0-live-run/local-deployment.json`; a local `Launch-Knowledge-Test.cmd` resumes that test deployment. The initial relaunch verification helper used an incorrect response-field name; correcting it confirmed the retained search without changing runtime code.
- The protected ordinary Program Files installation remains 0.10.2: Windows canceled the earlier elevation attempt, and installation-path selection is pending. Its profile and four Project databases are backed up. The staged local deployment does not constitute an installed upgrade, signing or rollback acceptance.

## Files

- `packages/platform-service/src/backup/archive/reader.ts`
- `packages/platform-service/src/backup/archive/archive.test.ts`
- `packages/platform-service/src/backup/backup-service.integration.test.ts`
- `docs/changes/2026-10-05-backup-archive-stream-cleanup.md`

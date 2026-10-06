# Completion validator engine and DCC input envelopes

**Release:** 0.13.0

**Impact:** patch

**Category:** Fixed

## Summary

Automatic completion validators now pass operation parameters through the registered engine and DCC tool envelopes. A declared Unreal test filter previously failed schema validation even when the same explicit engine test succeeded.

## Details

- Live realistic-character authoring recorded a successful native `engine/test` with input `params.filter`, followed by a failed automatic validator using top-level `filter` (`-32032`). Its task correctly remained failed (`-32125`); passing individual engine checks did not satisfy the broken automatic check.
- Automatically selected engine validators wrap operation fields in `params`, retaining an optional top-level run identifier. DCC validators retain the DCC tool selector and wrap their operation fields. Existing wrapped broker inputs and explicit tool identifiers retain their original input contract. No schema, persisted record, permission ceiling or required evidence claim was removed or relaxed.
- Added regression cases that exercise the actual registered engine/DCC schemas and handlers for both operation parameters and existing envelopes. Fixture handler success is schema/dispatch evidence, not a live engine run.
- No data migration is required. Historical failed tasks remain failed; this change does not rewrite their results or certify visual art.

## Validation

- Before the fix, the two operation-parameter cases failed with completion-contract rejection and the existing envelope cases passed. After the fix, focused integration-service and DCC-tool tests passed 11/11.
- Broader integration/worker/task/DCC regression run passed 38 tests across five files; platform-service build passed. The full repository build/typecheck/lint/test gate passed 33/33 tasks, including 527 platform tests with 11 explicitly skipped.
- Restarted the owned isolated source runtime. The fresh native Luna visual-repair task ran both the explicit engine check and the automatic bare-filter validator successfully; automatic run `01a10db1-d579-7482-a64c-fa0edabecc9a` is actual live envelope evidence. The task nevertheless failed because its engine-validation claim reference contained explanatory prose rather than the exact successful run identifier required by the existing backing check. That rejection is valid and distinct from the repaired envelope defect; no backing check was relaxed and no historical failed task was rewritten.
- Formatting, change tracking and the required documentation link script passed after the source fixes. A subsequent narrow game-camera task is instructed to use exact run identifiers and remains in progress.

## Files

- `packages/platform-service/src/change/integration-service.ts`
- `packages/platform-service/src/change/integration-service.test.ts`
- `docs/changes/2026-10-05-completion-validator-input-envelope.md`

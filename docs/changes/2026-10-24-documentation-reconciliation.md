# Reconcile current capability evidence and historical documentation

**Release:** 0.23.0

**Impact:** none

**Category:** Documentation

## Summary

Correct stale current-status claims using existing accepted receipts, document the secure asset-opening configuration contract, and preserve dated review findings as historical evidence.

## Details

- Update status, plan and register prose that incorrectly said hosted CI had never run, task/settings contracts were not started, only noop handlers existed, no task UI existed, or every provider/generation/embedding interaction remained fake-only. Link exact hosted revision evidence and scoped OpenAI/Meshy/installed Knowledge receipts; retain unverified providers, operations and complete acceptance matrices. Update the settings count to 85 across 17 groups. Work-package statuses and user-owned decisions do not change; WP19 remains in progress.
- Distinguish the last recorded local 0.22.0 deployment from current process health and pending source installation. Keep public 0.21.0 testing release, local deployment receipt, current source and future packaging as separate facts. Preserve old audit counts and historical review content instead of rewriting historical evidence.
- Correct the architecture's stale isolation-selection claim to the selected LPAC/Job and bubblewrap backends with explicit remaining qualification; refresh its Electron pin and define the asset filename-as-data boundary. Update the handbook's default/native/configured opening behavior, explicit PowerShell file-mode policy, supported flags and failure semantics.
- Add navigation from the documentation index to the dated review and remediation record. Add a follow-up link to the review without altering its pre-fix findings. Regenerate documentation inventory artifacts so new regression-test paths are discoverable. The unchanged generated RPC/settings reference remains fresh after Markdown escaping hardening.
- Compatibility and migration: documentation/evidence reconciliation only, no new product decision, work-package promotion, schema/version migration or claims of complete security. Impact `none` reflects these documentation changes.

## Validation

- Existing main CI readback and repository receipts support the corrected historical/scoped claims. Generated-reference freshness passed; the inventory initially detected the new test paths as stale and was regenerated. Final system-reference, documentation-inventory, evidence-integrity and release-version checks passed: 198 requests, 28 notifications, 85 settings, 26 service subsystems and 16 Control Room surfaces. Formatting, diff whitespace and generated-changelog/coverage checks passed.
- The full `scripts/check-links.sh` completed successfully through WSL, including the new remediation records and updated documentation: `All links OK`. Later validation prose adds no links. This supersedes the earlier review's local checker-timeout limit only for the current execution, not for the preserved review snapshot.

## Files

- `docs/STATUS.md`
- `docs/DEVELOPMENT_PLAN.md`
- `docs/OPEN_DECISIONS.md`
- `docs/TECHNICAL_ARCHITECTURE.md`
- `docs/CONTROL_ROOM_HANDBOOK.md`
- `docs/README.md`
- `docs/PROJECT_REVIEW_2026-10-24.md`
- `docs/reference/DOCUMENTATION_INVENTORY.md`
- `docs/reference/documentation-inventory.json`
- `docs/changes/2026-10-24-documentation-reconciliation.md`

# Retain original task identities while reporting normal additions

**Release:** Unreleased

**Impact:** none

**Category:** Maintenance

## Summary

Correct the operational upgrade verifier so completed periodic board audits added after startup do not falsely imply lost task identities.

## Details

- The immediate 0.18.0-to-0.20.0 ordinary upgrade retained all configuration and task identities. A repeated check after desktop smoke found one new succeeded board-maintenance.audit task in each of the four ordinary Projects, created at 2026-10-07T01:25:10Z. All original task states and Project settings remained identical.
- Inspect the task kinds/timestamps and existing BoardMaintenanceScheduler: its sixty-second tick schedules due periodic audits. Preserve the failed exact-array comparison, immediate-upgrade snapshot and additive-task inspection; no task is removed and no board scheduler setting is changed to silence the check.
- Keep exact Project/account/model/pool/pricing/settings/key checks. For each Project, require every original task ID and state to remain present, preserve exact settings hashes, and separately report new task IDs/states. Existing snapshots remain compatible. Active/nonterminal-task rejection and database integrity/migration checks remain unchanged.
- This is source operational acceptance tooling after the immutable 0.20.0 package/tag; it changes no bundled runtime, installer, schema, user data or historical release record. Publication and deployment receive a separate receipt.

## Validation

- Read-only comparison against checkpointed Project databases found exactly four new succeeded board audits, no removed/changed original task rows and no changed setting keys. Profile identities/pricing/settings/credential key matched, with four Projects, 139 models and five pools.
- Corrected full-profile retention and final release acceptance remain pending until executed. This record does not treat arbitrary changed/deleted existing tasks as acceptable.
- Corrected full-profile retention passed after desktop smoke with four Projects, 139 models, five pools, every original task identity/state and all settings/key/pricing/account identities preserved; the four added succeeded audit tasks are reported separately. Negative controls using copied expected snapshots rejected a missing required original task, a changed original task state and a changed Project settings hash. These controls performed no Project/profile mutation.

## Files

- `scripts/local-deployment-acceptance.cjs`
- `docs/changes/2026-10-06-retention-background-tasks.md`

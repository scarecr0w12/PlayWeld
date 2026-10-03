# Executable profile recovery and diagnostic documentation

**Release:** 0.5.0

**Impact:** none

**Category:** Documentation

## Summary

Expand remaining operational documentation with a complete current-profile recovery drill, runnable read-only diagnostics, full index rebuild acceptance and credential recovery limits.

## Details

- Add an explicit-profile diagnostic executable using the public service client and real read-only RPCs. Require an absolute profile path; report service/registration identity and optional index counts without credential requests. Names and paths remain visible and require review before sharing.
- Add a unique-directory recovery runner using actual service/archive operations. Reconcile/edit/rebuild a copied Lantern design and require a fresh lexical citation. Run the diagnostic as both an imported example and a real Node CLI process.
- Create and verify a local profile archive, inspect its original credential key and excluded service lifecycle files, restore separately, stop/relaunch at the restored location and verify the same Project path/ID, Restricted platform override and exact synthetic account credential.
- Demonstrate wrong-key decryption failure only in a stopped owned copy and verify that the restored key remains intact. Retain reports/archives in ignored directories; generated secrets remain absent from public reports. No external provider request or production profile mutation.
- Explain relocation versus moving game workspaces, task-returning rebuild versus completed indexing, and current-profile reopen versus old-schema compatibility. Cross-link existing operations/contributor/fixture guides and extend the existing coverage inventory.
- No public schema, identifier, dependency, release version or stored-data change. Preserve existing decision/work-package statuses; broader unresolved capabilities remain visible.

## Validation

- Recovery drill passed all five checks on the actual Windows service, including real diagnostic CLI execution, profile archive/restore/relaunch, exact credential equality and wrong-key rejection. Passing compact report retained in the repository.
- Full build/typecheck/lint/test gate passed 33/33 tasks with all 33 results reused from valid Turbo cache; this documentation/script-only change does not claim a fresh execution of cached package tests.
- npm ci skipped because concurrent work uses the installed dependency tree. No new dependency required. No browser/Electron/native engine rerun performed for this service-only example; earlier UI/native reports retain their own scope and dates.
- Final documentation link check passed through WSL. Repository formatting and explicit formatting of the new guides/scripts/records passed; system-reference and documentation-inventory freshness, Git whitespace and changelog coverage/freshness passed. Owned recovery service processes exited after cleanup.

## Files

- `docs/RECOVERY_RUNBOOK.md`
- `docs/README.md`
- `docs/OPERATIONS_GUIDE.md`
- `docs/EXTENSION_COOKBOOK.md`
- `docs/DOCUMENTATION_COVERAGE.md`
- `docs/examples/lantern-workshop/README.md`
- `docs/examples/lantern-workshop/verification/profile-recovery.json`
- `docs/examples/service-diagnostics.cjs`
- `scripts/verify-documentation-recovery.cjs`

# Verified developer-tool recovery and focused retention verification

**Release:** Unreleased

**Impact:** none

**Category:** Maintenance

## Summary

Recover the six missing developer/build files with explicit user authorization and pass the mocked opener and retention checks after retiring the executable-generating opener fixture.

## Details

- The user authorized restoring verified files and rebuilding the service worker, with Bitdefender enabled and the flagged temporary executable left alone. Recheck each cached Vitest 5.0.5 and Turbo 2.11.2 archive against the exact package-lock SHA-512 integrity value before reading selected members. Restore only `suppress-warnings.cjs`, `dist/workers/forks.js`, the Turbo launcher and Windows binary; refuse to overwrite an existing destination and verify restored bytes. The Windows binary archive member is `turbo-windows-x64/bin/turbo.exe`. No package installation, dependency-version or lockfile change is made.
- Restore the accidentally removed `scripts/create-release-metadata.cjs` directly from `HEAD`, preserving its exact Git bytes. Force the platform-service TypeScript project build, including project references, so the missing `lib/workers/worker-main.js` is regenerated from current source rather than recovered from quarantine; run the existing asset-copy script. This removes the accidental source deletion without reverting either intentionally removed frontend handler or unrelated pending work.
- Run only selected existing tests: the process-mocked opener (including the newly strengthened fixed-command assertion), logger pruning and lifecycle, compiled CLI lifecycle/startup failure, audit-retention unit and RPC integration, and audit-retention panel. The CLI tests use disposable profiles; no ordinary profile or Project is selected. Do not run the retired opener fixture, the independent installer-handoff executable fixtures or a whole-suite command that would include them.
- Update current status and WP15's authoritative plan text to replace the missing-tool/unrun-mock state with the actual recovery and focused results. Earlier investigation and fixture-retirement records remain historical evidence; this record supplies the later outcome. Native opener association/launch acceptance and the complete repository gate remain pending. Archive integrity and passing tests do not classify Bitdefender's behavioral detection as a false positive.
- Compatibility/migration: maintenance and validation only; no production source, public API, schema, setting, dependency or data migration. Impact is none and version remains 0.22.0 pending. Bitdefender settings, exclusions and quarantine were not changed, and the flagged temporary executable was not accessed or executed. No package, installer, tag or release is prepared.

## Validation

- All three cached archives matched their exact lockfile integrity hashes before restoration; the five restored file contents were checked byte for byte. A subsequent presence check found all six expected files, including the regenerated worker.
- `node node_modules/typescript/bin/tsc -b packages/platform-service --force` and `node packages/platform-service/scripts/copy-assets.cjs` passed. This verifies source compilation and asset copying, not application or installer acceptance.
- `npm test -w @gamecrafter/platform-service -- src/assets/external-open.test.ts src/logger.test.ts src/cli.test.ts src/audit/audit-retention.test.ts src/audit/audit-retention.integration.test.ts` passed 38 tests across five files, with no skips, in 11.94 seconds. Evidence: `.turbo/verified-recovery-focused-tests.log`.
- `npm test -w @gamecrafter/theia-control-room -- src/browser/audit-retention-panel.test.tsx` passed six tests in one file, with no skips. Evidence: `.turbo/verified-recovery-retention-panel.log`. This is automated component evidence, not rendered browser acceptance.
- `npm run format:check`, `npm run changelog:update`, `npm run changelog:check -- --base HEAD` and `git diff --check` passed. Git emitted existing CRLF normalization notices. `scripts/check-links.sh` passed through WSL with `All links OK` (evidence: `.turbo/verified-recovery-links.log`). After testing, all six expected files were still present, the restored release-metadata script matched `HEAD` exactly and the retired native opener test remained absent.
- No fresh full-suite, native opener, installer-handoff, packaged desktop, live engine/DCC/provider or vendor security-adjudication result is claimed. The earlier real one-minute quiet-pruning acceptance was not repeated; the current logger test exercises periodic pruning through fake timers.

## Files

- `scripts/create-release-metadata.cjs`
- `docs/DEVELOPMENT_PLAN.md`
- `docs/STATUS.md`
- `docs/changes/2026-10-25-verified-tooling-recovery.md`

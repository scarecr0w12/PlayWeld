# Retire the compiled Windows opener executable fixture

**Release:** Unreleased

**Impact:** none

**Category:** Maintenance

## Summary

Remove the automated Windows opener fixture that compiled and executed a temporary program after the user's Bitdefender notification identified that exact executable. Preserve process-boundary coverage with mocks and explicitly retain the native-launch acceptance gap.

## Details

- The screenshot identifies `literal&'%GC_OPEN_TEST%^!(asset).exe` under a temporary `gc-native-open-*` directory as the Malware-labelled entry and reports 20 blocked applications. The visible additional entries include the Codex PowerShell runtime (`pwsh.exe`), Windows `conhost.exe`, and `tar.exe`; the cropped image does not show all 20 applications or all remediation actions. This directly matches the fixture constructed by the native test. It supports associating the block with that test workflow, without proving the generated program was a false positive or that every blocked application was independently malicious. Do not publish machine-specific account paths or copy private notification/account data into source records.
- Delete `packages/platform-service/src/assets/external-open.windows.test.ts`. It compiled a C# executable with the Windows .NET compiler, renamed it to metacharacter/Unicode filenames and launched it through the real default opener before removing its temporary directory. This compile-and-launch chain is no longer part of ordinary test discovery; no hidden opt-in flag, skipped copy or executable-generating replacement is retained. The generated C# source was intended only to write a receipt, but that source inspection does not analyze or clear the quarantined executable.
- Retain the existing `external-open.test.ts` process mock. Add the reported metacharacter pattern as a harmless `.png` filename with plain fixture data, and require the exact fixed PowerShell invocation with `Invoke-Item -LiteralPath` and the dedicated environment variable. The process launcher remains mocked: this test does not compile code, create a PE executable, invoke PowerShell or open an asset. Existing path rejection, configured interpreter restrictions, literal argument forwarding and failure/timeout expectations remain intact. Production opener code, public contracts and permissions are unchanged.
- This deliberately removes real native association/launch coverage; do not describe the replacement mock as equivalent native acceptance or mark the complete full gate passed because the fixture is gone. Record the boundary in technical architecture, WP15's authoritative plan text and current status. Native qualification needs a reviewed method. An independent pre-existing installer-handoff test also compiles native fixtures; it was inspected, left unchanged and not executed in this correction. Retiring this opener fixture does not certify the entire suite against endpoint protection.
- Preserve the earlier investigation and recovery record, adding a link to this later correction rather than rewriting the previous attempted cleanup/recovery as a successful fix. The service-log retention implementation and earlier successful bounded checks remain unchanged. No blocked file restoration, quarantine operation, antivirus setting/exclusion, package installation or fresh native test run is performed after the screenshot review.
- Compatibility/migration: test/documentation change only; no runtime/API/data/dependency or schema migration. Exact deleted path and modified paths are listed below. Impact is none; product version remains 0.22.0 pending, with no installer, tag or release prepared.

## Validation

- Matched the screenshot's executable basename and temporary-directory prefix to the reviewed native fixture source before removal. Source review confirms the retained mocked path uses non-executable plain fixture data and intercepts `cross-spawn`; the new assertion pins the literal-path helper program. No generated executable was run to reproduce the security alert again.
- `node node_modules/prettier/bin/prettier.cjs --check packages/platform-service/src/assets/external-open.test.ts` passed after formatting. This is static parsing/formatting evidence, not a passing test result.
- Vitest cannot run from the current installation because its two worker/preload files remain absent after endpoint cleanup. Turbo's launcher/native binary and the compiled service worker are also absent; no restoration or alternate runner is used to bypass that state. The new mock case/assertion, full build/test gate and native qualification remain unverified. Earlier 966-pass/7-skip results predate this test correction and excluded the native opener; they are not validation of this change.
- Changelog generation and coverage passed with `node scripts/change-tracking.cjs update` and `node scripts/change-tracking.cjs check --base HEAD`. Repository-wide Prettier checking passed; `scripts/check-links.sh` passed through WSL with `All links OK`; `git diff --check` passed (Git reported existing CRLF normalization notices).
- Read-only recovery preparation verified the cached Vitest 5.0.5, Turbo 2.11.2 and Windows Turbo 2.11.2 archives against their exact `package-lock.json` SHA-512 integrity values and read the affected archive members without extracting or executing them. The Windows archive uses the `turbo-windows-x64/bin/turbo.exe` member path. The four affected dependency files, compiled service worker and tracked release-metadata script remain absent. Archive integrity establishes package provenance only; it does not adjudicate the behavioral detection or authorize quarantine recovery.
- No live engine/provider/DCC, application/installer, vendor false-positive adjudication or security-product configuration claim is made.

## Files

- `packages/platform-service/src/assets/external-open.windows.test.ts`
- `packages/platform-service/src/assets/external-open.test.ts`
- `docs/TECHNICAL_ARCHITECTURE.md`
- `docs/DEVELOPMENT_PLAN.md`
- `docs/STATUS.md`
- `docs/changes/2026-10-24-native-opener-fixture-cleanup.md`
- `docs/changes/2026-10-24-retire-native-opener-executable-fixture.md`

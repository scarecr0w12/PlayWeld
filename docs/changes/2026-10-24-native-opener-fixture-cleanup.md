# Native opener verification and runner installation recovery

**Release:** 0.23.0

**Impact:** none

**Category:** Maintenance

## Summary

Investigate a native Windows opener verification failure encountered during service-log retention work and recover missing local Vitest files from the unchanged pinned package. No product opener or test assertion change is retained.

## Details

- The final full gate reported `EPERM` in the native asset-opening fixture's temporary-directory cleanup after its launch assertions. The cleanup failure reproduced in isolation, and the directory was absent on later inspection. This initially suggested a transient executable/directory lock.
- Tried five filesystem cleanup retries with a 100 ms base delay, without retrying launches, changing assertions or increasing the test timeout. The corrected fixture did not obtain a complete passing run; revert this unproven adjustment. The source test remains as it was before this investigation. This record preserves the attempted/reverted work rather than claiming a fix.
- Subsequent workers failed before discovery because `node_modules/vitest/suppress-warnings.cjs` and `node_modules/vitest/dist/workers/forks.js` were missing. Fetch the exact existing Vitest 5.0.5 package into ignored artifacts, verify its SHA-512 against package-lock.json and restore only missing files. Existing installed files matched the package bytes. Also restore the missing `node_modules/turbo/bin/turbo` launcher and `node_modules/@turbo/windows-64/bin/turbo.exe` from the exact locked Turbo 2.11.2 packages after checking their SHA-512 integrity. A compiled `packages/platform-service/lib/workers/worker-main.js` entry was missing too; regenerate service output with `npx tsc -b packages/platform-service/tsconfig.json --force` and the package build. The initially clean tracked `scripts/create-release-metadata.cjs` was also unexpectedly missing; restore that exact path from HEAD after confirming it was absent and had no pre-task modification. The two pre-existing intentional Theia handler deletions remain untouched. Run the formatter after reverting the cleanup experiment. No version, dependency manifest, lockfile or product patch changes were made for recovery.
- The two restored worker files disappeared again during the native opener run, with worker termination and no complete suite result. Bitdefender and Windows Defender are installed; available Windows Defender events did not establish the actor. The user subsequently supplied a Bitdefender notice reporting potentially malicious behavior, all involved applications blocked, restart required, and detection `SuspiciousBehavior.567DCD8166FD2594`. This is the likely explanation for the process/file interruptions; the exact affected application list and whether the detection is a false positive remain unverified. Stop native-opener execution and further executable recovery after this confirmation. No antivirus exclusions, disablement or other security-setting changes were made. Keep native opener qualification separate from retention unit/CLI acceptance and report exclusions explicitly.
- Compatibility/migration: investigation and local installation recovery only; no retained product/API/data/test behavior changes and no migration. Impact is none; version remains 0.22.0 pending.

## Validation

- Later user-supplied screenshot identifies the temporary opener executable as the Malware-labelled entry and reports 20 blocked applications. The cropped visible list also shows Codex PowerShell, `conhost.exe` and `tar.exe`, without the complete affected-file/action list. The native fixture is subsequently retired under a [separate correction record](../changes/2026-10-24-retire-native-opener-executable-fixture.md); earlier statements that no test change was retained describe this investigation before that correction.

- Post-restart follow-up: the user reported restarting Windows; the operating system reports boot at 2026-10-24 19:02:34 America/Phoenix. The two Vitest worker files, Turbo launcher/native binary, compiled service worker entry and tracked release-metadata script remain absent after the restart. Restart completion is not evidence that the blocked workflow is cleared. No files were restored and no native fixture or test runner was executed during this follow-up. Windows Event Log/provider inspection did not expose the Bitdefender event's affected application list; request that list and recorded actions from the product notification before further recovery or execution. Source inspection still identifies the native fixture's compile-and-launch chain, without establishing a false positive.
- The user could no longer find the notification. Read-only window inspection found Bitdefender Central in Chrome; locate the installed local Security Center, verify its executable's valid Bitdefender SRL signature, and open that vendor UI for inspection. Windows UI Automation exposes the Notifications/Advanced Threat Defense labels, but those controls provide no invoke pattern, keyboard focus or accelerator. No event details were recovered and no restore/exclusion/security controls were invoked. Direct event selection in the local product remains the human handoff; the affected processes and remediation actions are still unknown.
- Original cleanup failure: `.turbo/service-log-retention-opener-isolation.log` and `.turbo/service-log-retention-quality-final-source.log`.
- Runner startup failure before test discovery: `.turbo/service-log-retention-fixture-focused.log`. The package tarball hash matched the lockfile and existing installed package files matched the tarball; only the two missing files were copied.
- The native retry attempt remained incomplete (`.turbo/service-log-retention-repaired-focused.log`) and was reverted. No complete full-suite/native-opener pass is claimed. After restoration without the opener fixture, the ten retention/CLI tests passed and the restored Vitest files remained present. Build/typecheck/lint passed 25 tasks; other workspace test tasks passed 14 tasks after rebuilding the missing service worker entry. The remaining service suite explicitly excluded the native opener file and passed 730 tests with 6 skipped across 133 files; all other workspace test tasks passed. Full native-opener qualification remains pending. No restart was initiated from this session. Evidence: `.turbo/service-log-retention-isolated-verified.log`, `.turbo/service-log-retention-build-quality.log`, `.turbo/service-log-retention-other-tests-verified.log` and `.turbo/service-log-retention-rebuild.log`.

## Files

- `packages/platform-service/src/assets/external-open.windows.test.ts`
- `scripts/create-release-metadata.cjs`
- `docs/changes/2026-10-24-native-opener-fixture-cleanup.md`

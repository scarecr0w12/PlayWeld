# Allow bounded fresh installed service readiness

**Release:** 0.19.0

**Impact:** patch

**Category:** Fixed

## Summary

Allow thirty seconds for detached service startup after a cold installed upgrade instead of reporting failure after five seconds while the daemon continues starting.

## Details

- The first 0.18.0 isolated installed probe exhausted the five-second service readiness deadline; the daemon subsequently finished startup, and an unchanged retry passed. The ordinary upgrade's fresh service also required approximately fifteen seconds between process launch and its startup event. This is measured installed-runtime behavior, not a capability failure.
- Extend only detached startup readiness to thirty seconds. Keep the same live process/socket checks and ordinary stop/checkpoint behavior. Extend the Windows package verifier's outer CLI process bound to forty-five seconds so the inner startup limit can report correctly.
- Preserve the failed probe log and authenticated cleanup of its exact owned profile/PID. No profile schema, data identity, public branding or compatibility path changes.

## Validation

- Local 0.18.0 ordinary retention passed four Projects, 139 models and five pools, and all 417 selected installed files matched the stage. The installed native retry and all 29 desktop checks passed; the initial cold-start failure remains recorded.
- Source CLI lifecycle and corrected fresh package/installed acceptance remain pending for the next version. This change does not repair the separate hosted protected-key failure or claim public release acceptance.
- The corrected source CLI lifecycle passed; the full 0.19.0 local quality gate passed all 33 tasks uncached with 560 platform tests/six skips and 128 extension tests. Version-correct cold package/installed readiness and public acceptance remain pending for the separate receipt.

## Files

- `packages/platform-service/src/cli.ts`
- `apps/control-room/scripts/verify-windows-native.cjs`
- `docs/changes/2026-10-06-installed-service-cold-start.md`

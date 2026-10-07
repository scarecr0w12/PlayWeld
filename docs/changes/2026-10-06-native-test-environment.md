# Preserve native Windows test environment under Turbo strict mode

**Release:** Unreleased

**Impact:** none

**Category:** Fixed

## Summary

Declare the Windows operating-system context required by native service tests instead of losing it in Turborepo's strict environment.

## Details

- Corrected source full Windows CI 37553725149 still exhausted DPAPI's thirty-second deadline, while focused direct Vitest/native round trips passed. Preserve that failed log and the clean 0.19.0 local candidate; no 0.19.0 release tag or publication is accepted by this record.
- Turbo 2.11.2 dry-run reports strict mode and no configured environment variables for the service test task. The service build already accounts for OS, architecture and SystemRoot; the test task now does so too. Forward only explicit Windows user/system/module context through task-level passThroughEnv; keep strict mode and provider credentials excluded.
- The available skill's bundled-docs pointer was absent in the installed turbo package. Consulted the official [strict-mode guidance](https://turborepo.dev/docs/crafting-your-repository/using-environment-variables#strict-mode) and [task environment configuration](https://turborepo.dev/docs/reference/configuration#passthroughenv) before changing configuration. These document that strict mode filters task environments unless declared.
- Add an early Windows SystemRoot assertion to native protected-key acceptance and a focused hosted invocation through Turbo, matching the failing execution boundary instead of testing Vitest directly only. No assertion or capability is skipped, no secret is printed, and no runtime protection or schema changes.
- Candidate generation and previous failed tags/artifacts remain preserved. New full source/package/installed/publication acceptance will use the next version and a separate receipt; successful isolated diagnostics alone do not establish the repair.

## Validation

- Prior local 0.19.0 source gate passed all 33 tasks uncached, 560 platform tests/six skips and 128 extension tests. Its local package/native checks passed. It remains a preserved candidate; the original corrected full hosted Windows run failed and is not described as accepted.
- Native task configuration, focused strict-mode hosted test and corrected full quality/package/deployment checks are pending until actually executed.

## Files

- `turbo.json`
- `.github/workflows/windows-transport-probe.yml`
- `packages/platform-service/src/updates/release-metadata-cli.test.ts`
- `docs/changes/2026-10-06-native-test-environment.md`

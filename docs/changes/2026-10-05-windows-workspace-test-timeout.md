# Stabilize Windows CI Test Timeouts

**Release:** 0.10.2

**Impact:** patch

**Category:** Fixed

## Summary

The v0.10.0 Windows release job exceeded Vitest's default five-second timeout in a SQLite vector-store test; v0.10.1 then timed out in the Project clone test. A previous full Windows-equivalent run also exposed a Qdrant readiness bound, fixed in v0.10.1; during v0.10.2 preparation, the Git-heavy release-ledger test exceeded five seconds locally. This test-only patch sets a 15-second platform-service default, adds 20-second deadlines to the Project-clone and release-ledger tests, and retains the SQLite/Qdrant bounds from v0.10.1. It does not change production behavior. The v0.10.0 and v0.10.1 tags remain unchanged, so the correction uses v0.10.2.

## Details

- The Project clone test exercises database migration, chat copy, settings copy, task identity/leases, worktree exclusion, and vector-store exclusion across two Project records. It still checks the same behavior; only its deadline changes to 20 seconds.
- Platform-service Vitest tests now use a 15-second default to avoid repeated cold Windows runner failures for integration tests. The SQLite and Qdrant cases retain the explicit 20/15-second bounds added in v0.10.1.
- The release-ledger test still checks version progression and closed tracking before packaging; its timeout is 20 seconds to cover temporary-repository Git operations on cold runners.
- No production runtime code changes.

## Validation

- `npm test -w @gamecrafter/platform-service -- src/projects/workspace.test.ts` — 1 file, 4 tests passed in 2.57 seconds locally.
- `npm run test:changes` — 2 files, 24 tests passed in 57.47 seconds locally.
- `npx turbo run build typecheck lint test --output-logs=errors-only --force` — all 33 tasks passed in 6m28s.
- `node scripts/check-release-version.cjs v0.10.2` and `npm run changelog:check -- --release --base HEAD` — passed.
- `npm run format:check`, `bash scripts/check-links.sh`, system-reference/inventory checks, documentation-evidence check, and `git diff --check` — passed.
- `npm run package:win -w @gamecrafter/control-room` — built the unsigned Windows x64 0.10.2 package; native dependencies, packaged platform-service startup/shutdown, and 30 bundled skills verified.
- `node scripts/stage-windows-release.cjs` — staged the package at `Windows-Release/0.10.2`.
- `node scripts/verify-documentation-electron.cjs` with `GAMECRAFTER_ELECTRON_EXECUTABLE` set to the staged executable — 30 isolated Electron/service checks passed with no renderer errors. Installer SHA-256: `edaa5f328d0f724e6b24e69f2ad35517f20d53d48281c9970fc97aa92fb541a0`.
- The v0.10.1 Linux package job passed; its Windows package job failed when the Project-clone test exceeded five seconds. The corrective 0.10.2 Windows workflow must rerun the full test suite; do not move or reuse the v0.10.0 or v0.10.1 tags.
- NSIS install/uninstall, upgrade/rollback, signing, and the GitHub v0.10.2 release workflow remain unverified.

## Files

- `packages/platform-service/package.json`
- `packages/platform-service/src/projects/workspace.test.ts`
- `scripts/change-tracking.test.ts`
- `docs/STATUS.md`
- `docs/RELEASE_GUIDE.md`
- `docs/changes/2026-10-05-windows-workspace-test-timeout.md`

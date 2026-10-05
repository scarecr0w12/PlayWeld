# Stabilize Windows Vector-Store Release Tests

**Release:** 0.10.1

**Impact:** patch

**Category:** Fixed

## Summary

Increase test-only timing bounds for the SQLite and managed-Qdrant vector-store integration tests. The v0.10.0 Windows package job exceeded the default five-second Vitest timeout on the SQLite persistence test. A subsequent full Windows-equivalent local run exposed a 1.5-second Qdrant readiness timeout firing before its fake server returned the expected wrong-version response. The failed v0.10.0 tag remains unchanged; both timing-only corrections are assigned to a new patch release.

## Details

- The SQLite test still asserts the same persistence, idempotent upsert, Project isolation, profile-version isolation, deletion, and search behavior; its per-test timeout is now 20 seconds.
- The managed-Qdrant wrong-version test still asserts the same version rejection; its manager readiness limit is 10 seconds and its Vitest timeout is 15 seconds so cold Windows startup time does not mask the expected error.
- No production code or application behavior changes.

## Validation

- `npm test -w @gamecrafter/platform-service -- src/knowledge/sqlite-vector-store.test.ts` — 1 file, 4 tests passed in 616 ms locally.
- `npm test -w @gamecrafter/platform-service -- src/knowledge/managed-qdrant.test.ts` — 1 file, 6 tests passed in 9.88 seconds locally.
- `node scripts/check-release-version.cjs v0.10.1`, release changelog/evidence checks, and `npx turbo run build typecheck lint test --output-logs=errors-only --force` — 33 tasks successful.
- `npm run package:win -w @gamecrafter/control-room`, `node scripts/stage-windows-release.cjs`, and the isolated packaged Electron/service smoke — passed for local 0.10.1; manifest records the dirty pre-commit source fingerprint. No installer was installed into the normal profile.
- Release workflow evidence: v0.10.0 validation and Linux package jobs passed; its Windows job failed on the 5-second SQLite timeout. The corrective v0.10.1 tag/workflow is pending; do not move or reuse v0.10.0.

## Files

- `docs/RELEASE_GUIDE.md`
- `docs/STATUS.md`
- `packages/platform-service/src/knowledge/sqlite-vector-store.test.ts`
- `packages/platform-service/src/knowledge/managed-qdrant.test.ts`
- `docs/changes/2026-10-05-windows-sqlite-ci-timeout.md`

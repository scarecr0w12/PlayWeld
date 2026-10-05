# Preserve A2A Continuation Context

**Release:** Unreleased

**Impact:** patch

**Category:** Fixed

## Summary

Outbound A2A `send` and `stream` continuations now reuse the remote context ID stored with the remote task owned by the current connection and Project. If that owned record has no context ID, continuation is rejected before agent discovery or network access instead of sending an invalid empty context.

## Details

- The remote-task lookup retains the existing `(connectionId, remoteTaskId, ProjectId)` ownership check and returns the recorded context ID for message construction.
- Initial messages remain unchanged; task `get`, `cancel`, and `resubscribe` continue to require Project ownership but do not require a message context.
- Added coverage for non-streaming and streaming continuation payloads, and for rejecting continuation when the stored context is missing. No production API or storage schema changed.

## Validation

- Regression red phase: `npm test -w @gamecrafter/platform-service -- src/a2a/a2a-service.integration.test.ts -t "reuses the recorded remote context"` failed because both continuation payloads had an empty `contextId` instead of `remote-continuation-context`.
- The expanded cold-client regression passed in 5.00 seconds and proves both missing-context send and stream reject before Agent Card discovery or JSON-RPC.
- `npm test -w @gamecrafter/platform-service -- src/a2a` — 2 files, 21 tests passed in 21.22 seconds.
- `npm run typecheck -w @gamecrafter/platform-service` — passed. The first full-gate attempt caught nullable arguments at the message-builder call sites; the fixed code now passes the non-null fallback only after the operation-specific missing-context guard.
- `npx turbo run build typecheck lint test --output-logs=errors-only --force` — all 33 tasks passed in 5m56s.
- `npm run test:changes` — 2 files, 24 tests passed in 55.46 seconds; `node scripts/check-release-version.cjs v0.10.2` and `npm run changelog:check -- --base HEAD` — passed.
- `npm run format:check`, `bash scripts/check-links.sh`, system-reference/inventory checks, documentation-evidence check, and `git diff --check` — passed.
- Provider live calls and external A2A interoperability are not claimed.

## Files

- `packages/platform-service/src/a2a/a2a-service.ts`
- `packages/platform-service/src/a2a/a2a-service.integration.test.ts`
- `docs/changes/2026-10-05-a2a-continuation-context.md`

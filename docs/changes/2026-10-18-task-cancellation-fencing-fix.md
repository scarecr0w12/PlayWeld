# Fence task trees before cancellation waits (F04)

**Release:** Unreleased

**Impact:** patch

**Category:** Fixed

## Summary

Cancellation previously snapshotted descendants and awaited deepest-first worker shutdown while ancestors could still delegate. It now persists the complete snapshot as cancelled synchronously before publishing callbacks or awaiting shutdown.

## Details

- Cancellation previously snapshotted descendants and awaited deepest-first worker shutdown while ancestors could still delegate. It now persists the complete snapshot as cancelled synchronously before publishing callbacks or awaiting shutdown.
- Task creation walks every ancestor and rejects failed/cancelled owners and durable cancellation requests before duplicate detection or insertion. A `task.cancel_requested` event fences even a successfully completed root whose active followups are cancelled; the barrier survives database close/reopen. Reentrant callbacks and workers waiting during shutdown cannot extend a cancelled tree.
- Internal event publication reads all generated cancellation events instead of applying the public query's default event-page limit. A 256-task cancellation publishes all 513 generated request/state/cancellation events.
- Successfully completed ancestors still permit service-created reconciliation, revert and feedback followups within the original request tree and shared budget. A broad terminal-ancestor rejection initially broke that established workflow during verification; it was narrowed while adding a durable cancellation barrier. Agent delegation separately requires its own parent to be running. No persisted schema or public state value was added; the new internal event uses the extensible existing event contract. Parent/child IDs and successful history are preserved, no migration required. Patch impact.

## Validation

- Four original SQLite regression cases were run before the fix and reproduced the failures. Following successful-parent compatibility and durable cancellation-barrier corrections, graph/store verification passed 13 tests across two files; task-service integration previously passed 14 tests.
- These tests use actual Project migrations and SQLite, plus controlled callbacks for shutdown timing; no ordinary profile was changed.
- Final `npx turbo run build typecheck lint test` passed: 33/33 tasks successful, 22 cache hits for unchanged task inputs, 7m24.71s. The changed platform-service suite ran uncached: 128 files passed, 678 tests passed and six skipped. Theia Control Room verification passed 133 tests across 28 files; other workspaces contributed 76 passing tests and one skip, for 887 passing test cases and seven skips across the monorepo gate. App wrapper test/typecheck/lint scripts that intentionally print skip are not counted as additional test cases. Both Electron and browser application builds completed with zero build errors.
- Skips were existing Windows/platform prerequisites or unavailable real Godot: Linux-only plugin/isolation cases, symlink/process/credential permission cases, and the archive symlink case. The suite did run real local Blender/WSL inspect/export/render and exception tests, real local Qdrant persistence/isolation tests, and Windows LPAC probes with Node and Electron. Unity/Unreal engine identity/bridge cases and paid-provider behavior used deterministic fixtures; no paid external model/asset generation, ordinary production profile acceptance, or new installer lifecycle was performed.
- The first broad gate exposed the missing gameplay-module fixture, successful-parent continuation incompatibility, and duplicate board-audit usage; those were corrected without weakening the preserved acceptance assertions. Because source corrections occurred while that initial run was active, its mixed-state failures are not the acceptance result. A fresh complete run supplied the successful result above. A final planner-role cleanup was rebuilt and its role/registry/bundled-skill checks passed seven tests across three files.
- `bash scripts/check-links.sh` passed with All links OK. `npm run format:check`, `git diff --check`, `npm run changelog:update`, and `npm run changelog:check -- --base HEAD` passed. The final full-gate output is retained locally at `.artifacts/agent-swarm-fixes/full-turbo.log`. Existing manifests/lockfile and the six pre-existing repository Electron processes were preserved; no release/version assignment was performed.

## Files

- `packages/platform-service/src/tasks/task-graph.ts`
- `packages/platform-service/src/tasks/task-store.ts`
- `packages/platform-service/src/tasks/task-graph.test.ts`
- `docs/changes/2026-10-18-task-cancellation-fencing-fix.md`


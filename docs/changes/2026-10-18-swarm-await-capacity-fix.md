# Yield and reacquire swarm capacity around child waits (F05)

**Release:** Unreleased

**Impact:** patch

**Category:** Fixed

## Summary

Coordinators previously occupied execution slots while tasks/await polled queued descendants, starving children at a one-worker limit and when all slots held waiting coordinators. The supervisor now yields capacity only around supervised child waits while retaining the running task, leases, heartbeat and checkpoints.

## Details

- Coordinators previously occupied execution slots while tasks/await polled queued descendants, starving children at a one-worker limit and when all slots held waiting coordinators. The supervisor now yields capacity only around supervised child waits while retaining the running task, leases, heartbeat and checkpoints.
- Await completion, timeout and error must reacquire a normal slot before the tool result returns. Resumption is prioritized over new tasks and counts toward configured concurrency. Additional tool calls while yielded are rejected; cancellation and process exit abort pending controllers and release waiters.
- Real forked-worker regressions exercise concurrency one and two with two coordinators and children, timeout resumption, subtree cancellation, refreshed tool snapshots and once-only service-accounted usage.
- No public task state, RPC shape or database migration was introduced. Concurrency remains an active execution limit; yielded coordinators remain supervised processes. Patch impact restores progress without increasing the configured active slot limit.

## Validation

- The focused worker IPC suite passed five tests after the final refresh-error regression. Its broker fixture invokes the actual registered tasks/await handler with actual TaskService and forked child IPC.
- The earlier combined five-file worker/runtime/budget regression run passed 47 tests. These are fixture/process checks, not a live paid-model swarm acceptance claim.
- Final `npx turbo run build typecheck lint test` passed: 33/33 tasks successful, 22 cache hits for unchanged task inputs, 7m24.71s. The changed platform-service suite ran uncached: 128 files passed, 678 tests passed and six skipped. Theia Control Room verification passed 133 tests across 28 files; other workspaces contributed 76 passing tests and one skip, for 887 passing test cases and seven skips across the monorepo gate. App wrapper test/typecheck/lint scripts that intentionally print skip are not counted as additional test cases. Both Electron and browser application builds completed with zero build errors.
- Skips were existing Windows/platform prerequisites or unavailable real Godot: Linux-only plugin/isolation cases, symlink/process/credential permission cases, and the archive symlink case. The suite did run real local Blender/WSL inspect/export/render and exception tests, real local Qdrant persistence/isolation tests, and Windows LPAC probes with Node and Electron. Unity/Unreal engine identity/bridge cases and paid-provider behavior used deterministic fixtures; no paid external model/asset generation, ordinary production profile acceptance, or new installer lifecycle was performed.
- The first broad gate exposed the missing gameplay-module fixture, successful-parent continuation incompatibility, and duplicate board-audit usage; those were corrected without weakening the preserved acceptance assertions. Because source corrections occurred while that initial run was active, its mixed-state failures are not the acceptance result. A fresh complete run supplied the successful result above. A final planner-role cleanup was rebuilt and its role/registry/bundled-skill checks passed seven tests across three files.
- `bash scripts/check-links.sh` passed with All links OK. `npm run format:check`, `git diff --check`, `npm run changelog:update`, and `npm run changelog:check -- --base HEAD` passed. The final full-gate output is retained locally at `.artifacts/agent-swarm-fixes/full-turbo.log`. Existing manifests/lockfile and the six pre-existing repository Electron processes were preserved; no release/version assignment was performed.

## Files

- `packages/platform-service/src/workers/supervisor.ts`
- `packages/platform-service/src/workers/types.ts`
- `packages/platform-service/src/workers/worker-main.ts`
- `packages/platform-service/src/workers/supervisor-await.test.ts`
- `packages/platform-service/src/workers/supervisor-await-fixture.cjs`
- `docs/changes/2026-10-18-swarm-await-capacity-fix.md`


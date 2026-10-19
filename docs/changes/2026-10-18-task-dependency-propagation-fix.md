# Propagate dependency outcomes beyond public page limits (F08)

**Release:** 0.22.0

**Impact:** patch

**Category:** Fixed

## Summary

Dependency propagation previously listed only the first 200 pending/blocked tasks and then filtered for the completed prerequisite. Relevant dependents beyond that public page could remain pending or miss failure propagation indefinitely.

## Details

- Dependency propagation previously listed only the first 200 pending/blocked tasks and then filtered for the completed prerequisite. Relevant dependents beyond that public page could remain pending or miss failure propagation indefinitely.
- TaskStore now queries dependents directly in SQLite by dependency ID without a public row-page limit; TaskGraph applies success/failure transitions to the complete matching set.
- Regressions place more than 200 unrelated pending rows before more than 200 actual dependents, and verify both successful prerequisites and failed prerequisites propagate correctly.
- The public task-list default remains bounded. No schema or migration is required; only internal dependency queries change. Patch impact restores existing graph semantics.

## Validation

- SQLite success and failure propagation regressions failed before the fix and passed afterward. Graph/store verification passed 10 tests and existing task-service integration passed 14 tests.
- Final `npx turbo run build typecheck lint test` passed: 33/33 tasks successful, 22 cache hits for unchanged task inputs, 7m24.71s. The changed platform-service suite ran uncached: 128 files passed, 678 tests passed and six skipped. Theia Control Room verification passed 133 tests across 28 files; other workspaces contributed 76 passing tests and one skip, for 887 passing test cases and seven skips across the monorepo gate. App wrapper test/typecheck/lint scripts that intentionally print skip are not counted as additional test cases. Both Electron and browser application builds completed with zero build errors.
- Skips were existing Windows/platform prerequisites or unavailable real Godot: Linux-only plugin/isolation cases, symlink/process/credential permission cases, and the archive symlink case. The suite did run real local Blender/WSL inspect/export/render and exception tests, real local Qdrant persistence/isolation tests, and Windows LPAC probes with Node and Electron. Unity/Unreal engine identity/bridge cases and paid-provider behavior used deterministic fixtures; no paid external model/asset generation, ordinary production profile acceptance, or new installer lifecycle was performed.
- The first broad gate exposed the missing gameplay-module fixture, successful-parent continuation incompatibility, and duplicate board-audit usage; those were corrected without weakening the preserved acceptance assertions. Because source corrections occurred while that initial run was active, its mixed-state failures are not the acceptance result. A fresh complete run supplied the successful result above. A final planner-role cleanup was rebuilt and its role/registry/bundled-skill checks passed seven tests across three files.
- `bash scripts/check-links.sh` passed with All links OK. `npm run format:check`, `git diff --check`, `npm run changelog:update`, and `npm run changelog:check -- --base HEAD` passed. The final full-gate output is retained locally at `.artifacts/agent-swarm-fixes/full-turbo.log`. Existing manifests/lockfile and the six pre-existing repository Electron processes were preserved; no release/version assignment was performed.

## Files

- `packages/platform-service/src/tasks/task-store.ts`
- `packages/platform-service/src/tasks/task-graph.ts`
- `packages/platform-service/src/tasks/task-graph.test.ts`
- `docs/changes/2026-10-18-task-dependency-propagation-fix.md`


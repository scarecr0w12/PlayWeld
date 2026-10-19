# Refresh authorized tools between running agent turns (F09)

**Release:** Unreleased

**Impact:** patch

**Category:** Fixed

## Summary

MCP list-change events refreshed the service registry, but running agents continued advertising their startup tool/schema snapshot. Private worker IPC now requests a fresh role/access-filtered snapshot at each model-turn boundary before schema-aware compaction and token estimation.

## Details

- MCP list-change events refreshed the service registry, but running agents continued advertising their startup tool/schema snapshot. Private worker IPC now requests a fresh role/access-filtered snapshot at each model-turn boundary before schema-aware compaction and token estimation.
- Added/removed/schema-changed tools are reflected in subsequent turns without restarting the worker. Runtime-internal completion/question tools are retained appropriately; broker checks still authorize every execution.
- Tool inspection failures are returned to the worker as structured errors rather than escaping the asynchronous supervisor handler as unhandled rejections. The worker fails safely if discovery cannot establish the current authorized tools.
- No public RPC or persisted schema change, no new protocol revision assumption, and no migration. The mechanism consumes the existing authoritative registry rather than duplicating MCP discovery. Patch impact.

## Validation

- Agent runtime regression checks changed schemas/tool membership across turns; real worker IPC tests verify refreshed snapshots and safe failure propagation. The final five-case worker IPC suite passed.
- MCP protocol and connector tests remain fixture evidence unless explicitly reported as a live engine operation; no external provider was required.
- Final `npx turbo run build typecheck lint test` passed: 33/33 tasks successful, 22 cache hits for unchanged task inputs, 7m24.71s. The changed platform-service suite ran uncached: 128 files passed, 678 tests passed and six skipped. Theia Control Room verification passed 133 tests across 28 files; other workspaces contributed 76 passing tests and one skip, for 887 passing test cases and seven skips across the monorepo gate. App wrapper test/typecheck/lint scripts that intentionally print skip are not counted as additional test cases. Both Electron and browser application builds completed with zero build errors.
- Skips were existing Windows/platform prerequisites or unavailable real Godot: Linux-only plugin/isolation cases, symlink/process/credential permission cases, and the archive symlink case. The suite did run real local Blender/WSL inspect/export/render and exception tests, real local Qdrant persistence/isolation tests, and Windows LPAC probes with Node and Electron. Unity/Unreal engine identity/bridge cases and paid-provider behavior used deterministic fixtures; no paid external model/asset generation, ordinary production profile acceptance, or new installer lifecycle was performed.
- The first broad gate exposed the missing gameplay-module fixture, successful-parent continuation incompatibility, and duplicate board-audit usage; those were corrected without weakening the preserved acceptance assertions. Because source corrections occurred while that initial run was active, its mixed-state failures are not the acceptance result. A fresh complete run supplied the successful result above. A final planner-role cleanup was rebuilt and its role/registry/bundled-skill checks passed seven tests across three files.
- `bash scripts/check-links.sh` passed with All links OK. `npm run format:check`, `git diff --check`, `npm run changelog:update`, and `npm run changelog:check -- --base HEAD` passed. The final full-gate output is retained locally at `.artifacts/agent-swarm-fixes/full-turbo.log`. Existing manifests/lockfile and the six pre-existing repository Electron processes were preserved; no release/version assignment was performed.

## Files

- `packages/platform-service/src/agents/agent-runtime.ts`
- `packages/platform-service/src/agents/agent-runtime.test.ts`
- `packages/platform-service/src/workers/supervisor.ts`
- `packages/platform-service/src/workers/types.ts`
- `packages/platform-service/src/workers/worker-main.ts`
- `packages/platform-service/src/workers/supervisor-await.test.ts`
- `packages/platform-service/src/workers/supervisor-await-fixture.cjs`
- `docs/SKILLS_AGENTS_AND_TOOLS.md`
- `docs/changes/2026-10-18-agent-tool-refresh-fix.md`


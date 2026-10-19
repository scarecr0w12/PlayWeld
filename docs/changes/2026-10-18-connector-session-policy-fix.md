# Preserve session policy through engine and DCC RPCs (F01)

**Release:** Unreleased

**Impact:** patch

**Category:** Security

## Summary

Engine/run and dcc/run previously discarded their authenticated RPC session context, allowing Project Full policy to override a session's Restricted or Ask Always policy. Both connector service run methods now accept an internal broker context and forward it from the service RPC handlers.

## Details

- Engine/run and dcc/run previously discarded their authenticated RPC session context, allowing Project Full policy to override a session's Restricted or Ask Always policy. Both connector service run methods now accept an internal broker context and forward it from the service RPC handlers.
- The change retains normal Project/task ceilings and connector capability validation. Engine live-bridge calls carry the effective access ceiling and inherited role constraints into the selected MCP operation.
- Authenticated-service regressions compare ordinary tool/call with both wrapper paths under Project Full plus session Restricted, assert both are denied with audited Restricted policy, then verify each wrapper creates an Ask Always approval and honors rejection. An independent session retains Project Full.
- Compatibility: RPC payloads and persisted schemas are unchanged; optional internal connector parameters preserve existing callers. Previously bypassed session restrictions now apply. No migration required; patch impact is appropriate.

## Validation

- The new connector-session-policy.integration.test.ts passed both engine and DCC cases. Node stood in for installed executables; no mutating engine/DCC process was approved.
- Initial narrow broker/session run passed 18 tests across two files before the later additional connector delegation regression. Full verification results follow below.
- Final `npx turbo run build typecheck lint test` passed: 33/33 tasks successful, 22 cache hits for unchanged task inputs, 7m24.71s. The changed platform-service suite ran uncached: 128 files passed, 678 tests passed and six skipped. Theia Control Room verification passed 133 tests across 28 files; other workspaces contributed 76 passing tests and one skip, for 887 passing test cases and seven skips across the monorepo gate. App wrapper test/typecheck/lint scripts that intentionally print skip are not counted as additional test cases. Both Electron and browser application builds completed with zero build errors.
- Skips were existing Windows/platform prerequisites or unavailable real Godot: Linux-only plugin/isolation cases, symlink/process/credential permission cases, and the archive symlink case. The suite did run real local Blender/WSL inspect/export/render and exception tests, real local Qdrant persistence/isolation tests, and Windows LPAC probes with Node and Electron. Unity/Unreal engine identity/bridge cases and paid-provider behavior used deterministic fixtures; no paid external model/asset generation, ordinary production profile acceptance, or new installer lifecycle was performed.
- The first broad gate exposed the missing gameplay-module fixture, successful-parent continuation incompatibility, and duplicate board-audit usage; those were corrected without weakening the preserved acceptance assertions. Because source corrections occurred while that initial run was active, its mixed-state failures are not the acceptance result. A fresh complete run supplied the successful result above. A final planner-role cleanup was rebuilt and its role/registry/bundled-skill checks passed seven tests across three files.
- `bash scripts/check-links.sh` passed with All links OK. `npm run format:check`, `git diff --check`, `npm run changelog:update`, and `npm run changelog:check -- --base HEAD` passed. The final full-gate output is retained locally at `.artifacts/agent-swarm-fixes/full-turbo.log`. Existing manifests/lockfile and the six pre-existing repository Electron processes were preserved; no release/version assignment was performed.

## Files

- `packages/platform-service/src/service.ts`
- `packages/platform-service/src/engines/engine-connector-service.ts`
- `packages/platform-service/src/dcc/dcc-connector-service.ts`
- `packages/platform-service/src/tools/connector-session-policy.integration.test.ts`
- `docs/changes/2026-10-18-connector-session-policy-fix.md`


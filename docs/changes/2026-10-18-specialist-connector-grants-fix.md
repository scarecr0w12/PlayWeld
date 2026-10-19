# Give builtin specialists scoped integrated tool grants (F07)

**Release:** 0.22.0

**Impact:** patch

**Category:** Fixed

## Summary

Engine engineers, asset producers and validators previously received no tools from their corresponding integrated connector families. Builtin role definitions now enumerate appropriate engine operations, DCC operations and asset generation/job/import/preview/file operations; validators receive connector discovery/inspection while mutation exclusions remain.

## Details

- Engine engineers, asset producers and validators previously received no tools from their corresponding integrated connector families. Builtin role definitions now enumerate appropriate engine operations, DCC operations and asset generation/job/import/preview/file operations; validators receive connector discovery/inspection while mutation exclusions remain.
- The broker supports a trusted engine wrapper's delegation to exactly its selected MCP implementation. This internal context cannot be supplied by ordinary tool/call RPC input, cannot grant arbitrary server access, and still enforces explicit downstream denies, effective access policy, Project availability and locks.
- Removed the planner's dangling task/create tool pattern, which matched no registered agent tool. Its role text now states the existing division of responsibility: submit the plan with tasks/complete, then let the coordinator create executable child tasks through tasks/delegate. No functioning task-creation API was removed from the planner.
- Role integration tests inspect the actual started service's registered tool catalog and prove paid asset generation still creates an Ask Always approval. The fixture uses a nonexistent account and rejects approval, so no provider request is made.
- A separate real broker regression proves direct raw MCP access, wrong selected-tool delegation, and a disallowed owning wrapper all fail; the exact authorized selection succeeds once, and an explicit downstream deny blocks it afterward.
- No public schema or migration. Roles retain their access ceilings and process/filesystem contracts. Paid generation remains approval-gated, and arbitrary engine console access is not added through a blanket wildcard. Patch impact.

## Validation

- Role-grant and asset tests reproduced missing grants before implementation. The final six-file scoped run passed 58 tests, including asset approval denial.
- The new focused broker delegation regression passed; its other 16 tests were intentionally filtered in that invocation. It uses an in-memory MCP handler rather than a real engine.
- Final `npx turbo run build typecheck lint test` passed: 33/33 tasks successful, 22 cache hits for unchanged task inputs, 7m24.71s. The changed platform-service suite ran uncached: 128 files passed, 678 tests passed and six skipped. Theia Control Room verification passed 133 tests across 28 files; other workspaces contributed 76 passing tests and one skip, for 887 passing test cases and seven skips across the monorepo gate. App wrapper test/typecheck/lint scripts that intentionally print skip are not counted as additional test cases. Both Electron and browser application builds completed with zero build errors.
- Skips were existing Windows/platform prerequisites or unavailable real Godot: Linux-only plugin/isolation cases, symlink/process/credential permission cases, and the archive symlink case. The suite did run real local Blender/WSL inspect/export/render and exception tests, real local Qdrant persistence/isolation tests, and Windows LPAC probes with Node and Electron. Unity/Unreal engine identity/bridge cases and paid-provider behavior used deterministic fixtures; no paid external model/asset generation, ordinary production profile acceptance, or new installer lifecycle was performed.
- The first broad gate exposed the missing gameplay-module fixture, successful-parent continuation incompatibility, and duplicate board-audit usage; those were corrected without weakening the preserved acceptance assertions. Because source corrections occurred while that initial run was active, its mixed-state failures are not the acceptance result. A fresh complete run supplied the successful result above. A final planner-role cleanup was rebuilt and its role/registry/bundled-skill checks passed seven tests across three files.
- `bash scripts/check-links.sh` passed with All links OK. `npm run format:check`, `git diff --check`, `npm run changelog:update`, and `npm run changelog:check -- --base HEAD` passed. The final full-gate output is retained locally at `.artifacts/agent-swarm-fixes/full-turbo.log`. Existing manifests/lockfile and the six pre-existing repository Electron processes were preserved; no release/version assignment was performed.

## Files

- `packages/platform-service/roles/engine-engineer/ROLE.md`
- `packages/platform-service/roles/asset-producer/ROLE.md`
- `packages/platform-service/roles/validator/ROLE.md`
- `packages/platform-service/roles/planner/ROLE.md`
- `packages/platform-service/src/roles/role-tools.integration.test.ts`
- `packages/platform-service/src/tools/tool-broker.ts`
- `packages/platform-service/src/tools/tool-broker.integration.test.ts`
- `packages/platform-service/src/engines/engine-connector-service.ts`
- `docs/INTEGRATION_GUIDE.md`
- `docs/SKILLS_AGENTS_AND_TOOLS.md`
- `docs/changes/2026-10-18-specialist-connector-grants-fix.md`


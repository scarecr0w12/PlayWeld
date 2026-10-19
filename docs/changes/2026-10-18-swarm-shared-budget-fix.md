# Enforce model budgets across delegated task trees (F03)

**Release:** Unreleased

**Impact:** patch

**Category:** Fixed

## Summary

Delegated children previously had independent spend counters without enforcement of an ancestor's request envelope. The central CompletionService now applies shared subtree cost/token limits to every task-associated completion, covering agent tools, direct completion RPCs, plugin model calls and MCP sampling.

## Details

- Delegated children previously had independent spend counters without enforcement of an ancestor's request envelope. The central CompletionService now applies shared subtree cost/token limits to every task-associated completion, covering agent tools, direct completion RPCs, plugin model calls and MCP sampling.
- The service serializes budgeted dispatch per request tree, recalculates durable descendant spend against every ancestor ceiling, and records provider-dispatch reservations and settlements in existing task events. Unbudgeted requests retain parallel dispatch. Known actual usage is recorded immediately once; runtime progress marks service-accounted usage to avoid duplicate charges.
- Reservation creation occurs immediately before provider dispatch, after model/pool/capacity/pricing preflight. Deterministic rejected or already-aborted requests leave no reservation. Interrupted or unknown/partial monetary charges retain explicit unresolved holds under a monetary envelope instead of inventing actual spend. Exact tokens settle token-only reservations even when dollar pricing is unknown.
- Delegation inherits or narrows parent cost and duration ceilings, preserves an explicit optional parent token ceiling, and does not let coordinators invent token ceilings. Optional decision assessment without a verifiable cost/token bound is skipped under a finite envelope. Duration expiry cancels its subtree; each task's duration is measured from its own start.
- Completed current tasks cannot dispatch paid requests, and model delegation requires a running parent. Service-created followups under successful ancestors retain the original root's aggregate budget; failed/cancelled ancestors or a durable cancellation request revoke further dispatch. Added regressions cover successful-parent continuation without budget reset and cancellation markers after service reconstruction.
- The full suite exposed duplicate board-maintenance usage after accounting moved into the central service. Its worker progress now marks that already-persisted usage as service-accounted, retaining progress telemetry without charging the same tokens twice. The existing routed board-audit regression retains its exact 14-token expectation.
- Documentation separates model-dollar envelopes from externally approved asset-provider credits. No budget is silently assigned a currency conversion. No database/RPC migration or dependency change is required. Patch impact restores existing budget promises; current product version remains unchanged.

## Validation

- SQLite helper regressions cover concurrent siblings, nested limits, more than 200 descendants, reconstructed service state, unknown/partial prices, interrupted dispatch, no-dispatch rejection, terminal ancestors, and unbudgeted concurrency.
- The central completion regression uses actual in-memory Project SQLite plus real CompletionService/ModelRouter and a deterministic provider fixture: a sibling cannot exceed the root envelope, direct model IDs retain task-role pools, and cancellation causes no provider dispatch/reservation.
- The final scoped budget/router/role run passed 58 tests across six files. An initial new fixture used an input capacity smaller than conservative message framing; the fixture capacity/pricing were corrected, with production guards preserved.
- npm ci was attempted but Windows denied replacement of an Electron executable held by existing repository processes. Dependencies were restored with npm install --ignore-scripts --no-package-lock, then synchronized against the unchanged lockfile using npm install --ignore-scripts. npm run postinstall applied both maintained patches; npm rebuild and node node_modules/electron/install.js succeeded. No tracked manifest or lockfile changed and existing Electron processes were not stopped.
- Final `npx turbo run build typecheck lint test` passed: 33/33 tasks successful, 22 cache hits for unchanged task inputs, 7m24.71s. The changed platform-service suite ran uncached: 128 files passed, 678 tests passed and six skipped. Theia Control Room verification passed 133 tests across 28 files; other workspaces contributed 76 passing tests and one skip, for 887 passing test cases and seven skips across the monorepo gate. App wrapper test/typecheck/lint scripts that intentionally print skip are not counted as additional test cases. Both Electron and browser application builds completed with zero build errors.
- Skips were existing Windows/platform prerequisites or unavailable real Godot: Linux-only plugin/isolation cases, symlink/process/credential permission cases, and the archive symlink case. The suite did run real local Blender/WSL inspect/export/render and exception tests, real local Qdrant persistence/isolation tests, and Windows LPAC probes with Node and Electron. Unity/Unreal engine identity/bridge cases and paid-provider behavior used deterministic fixtures; no paid external model/asset generation, ordinary production profile acceptance, or new installer lifecycle was performed.
- The first broad gate exposed the missing gameplay-module fixture, successful-parent continuation incompatibility, and duplicate board-audit usage; those were corrected without weakening the preserved acceptance assertions. Because source corrections occurred while that initial run was active, its mixed-state failures are not the acceptance result. A fresh complete run supplied the successful result above. A final planner-role cleanup was rebuilt and its role/registry/bundled-skill checks passed seven tests across three files.
- `bash scripts/check-links.sh` passed with All links OK. `npm run format:check`, `git diff --check`, `npm run changelog:update`, and `npm run changelog:check -- --base HEAD` passed. The final full-gate output is retained locally at `.artifacts/agent-swarm-fixes/full-turbo.log`. Existing manifests/lockfile and the six pre-existing repository Electron processes were preserved; no release/version assignment was performed.

## Files

- `packages/platform-service/src/agents/shared-task-budget.ts`
- `packages/platform-service/src/agents/shared-task-budget.test.ts`
- `packages/platform-service/src/agents/agent-tools.ts`
- `packages/platform-service/src/agents/agent-tools.test.ts`
- `packages/platform-service/src/agents/agent-runtime.ts`
- `packages/platform-service/src/workers/types.ts`
- `packages/platform-service/src/workers/supervisor.ts`
- `packages/platform-service/src/workers/board-maintenance-handlers.ts`
- `packages/platform-service/src/models/completion-service.ts`
- `packages/platform-service/src/models/completion-service.test.ts`
- `packages/platform-service/src/models/completion-task-budget.test.ts`
- `packages/platform-service/src/service.ts`
- `docs/INTEGRATION_GUIDE.md`
- `docs/SKILLS_AGENTS_AND_TOOLS.md`
- `docs/changes/2026-10-18-swarm-shared-budget-fix.md`


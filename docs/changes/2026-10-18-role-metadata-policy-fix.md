# Apply role module, pool and board-subscription metadata (F10)

**Release:** Unreleased

**Impact:** patch

**Category:** Fixed

## Summary

Role requiresModules, modelPool and boardSubscriptions fields previously had no runtime consumers. TaskService now validates agent-task module prerequisites against the current Project manifest before creating work. Missing modules produce an actionable role error instead of implicit module enablement.

## Details

- Role requiresModules, modelPool and boardSubscriptions fields previously had no runtime consumers. TaskService now validates agent-task module prerequisites against the current Project manifest before creating work. Missing modules produce an actionable role error instead of implicit module enablement.
- ModelRouter intersects configured named role pools with existing role/task/global pool constraints, including manual IDs and prepared completion preflight. Builtin names remain optional defaults until configured; missing custom-role pool names fail closed. Unrecognized ad hoc routing identities retain existing routing instead of being mistaken for invalid installed roles.
- Plugin/facade model requests preserve plugin attribution while intersecting originating role pool constraints. Central completion infers the recorded task roles as additional restrictions, so changing routing identity or supplying a raw model ID cannot escape the task pool.
- Agent-task creation reconciles persisted agent-role board subscription filters: wildcard means all topics, empty declarations remove stale role filters, changed filters replace previous declarations, and user/task subscriptions remain untouched. Records do not start agents automatically.
- Implicit agent roles normalize to coordinator, matching runtime defaults and applying the same role ceiling/subscription policy. Documentation records these engineering defaults without changing confirmed decisions or work-package status.
- The existing scripted swarm acceptance fixture now explicitly enables its gameplay module when creating the disposable Project. Previously it implicitly delegated gameplay engineers without declaring that prerequisite; correcting the fixture preserves the new prerequisite check instead of weakening it.
- No RPC/storage schema or dependency change; no migration required. Existing custom roles with unresolved named pools or missing required modules must correct their configuration. Patch impact restores documented role behavior.

## Validation

- Named-pool, module-prerequisite, board-reconciliation and implicit-coordinator regressions failed before their fixes and passed afterward. The final owned-area run passed 57 tests across 13 files with one Windows symlink skip.
- The subsequent facade pool regression passed before dependency restoration; the final combined six-file run passed 58 tests after restoration, including pool/facade and paid asset-approval coverage. An independent read-only review found the facade pool interaction and it was corrected before final verification.
- Final `npx turbo run build typecheck lint test` passed: 33/33 tasks successful, 22 cache hits for unchanged task inputs, 7m24.71s. The changed platform-service suite ran uncached: 128 files passed, 678 tests passed and six skipped. Theia Control Room verification passed 133 tests across 28 files; other workspaces contributed 76 passing tests and one skip, for 887 passing test cases and seven skips across the monorepo gate. App wrapper test/typecheck/lint scripts that intentionally print skip are not counted as additional test cases. Both Electron and browser application builds completed with zero build errors.
- Skips were existing Windows/platform prerequisites or unavailable real Godot: Linux-only plugin/isolation cases, symlink/process/credential permission cases, and the archive symlink case. The suite did run real local Blender/WSL inspect/export/render and exception tests, real local Qdrant persistence/isolation tests, and Windows LPAC probes with Node and Electron. Unity/Unreal engine identity/bridge cases and paid-provider behavior used deterministic fixtures; no paid external model/asset generation, ordinary production profile acceptance, or new installer lifecycle was performed.
- The first broad gate exposed the missing gameplay-module fixture, successful-parent continuation incompatibility, and duplicate board-audit usage; those were corrected without weakening the preserved acceptance assertions. Because source corrections occurred while that initial run was active, its mixed-state failures are not the acceptance result. A fresh complete run supplied the successful result above. A final planner-role cleanup was rebuilt and its role/registry/bundled-skill checks passed seven tests across three files.
- `bash scripts/check-links.sh` passed with All links OK. `npm run format:check`, `git diff --check`, `npm run changelog:update`, and `npm run changelog:check -- --base HEAD` passed. The final full-gate output is retained locally at `.artifacts/agent-swarm-fixes/full-turbo.log`. Existing manifests/lockfile and the six pre-existing repository Electron processes were preserved; no release/version assignment was performed.

## Files

- `packages/platform-service/src/models/router.ts`
- `packages/platform-service/src/models/router.test.ts`
- `packages/platform-service/src/models/completion-service.ts`
- `packages/platform-service/src/models/completion-service.test.ts`
- `packages/platform-service/src/models/completion-task-budget.test.ts`
- `packages/platform-service/src/plugins/plugin-host.ts`
- `packages/platform-service/src/tasks/task-service.ts`
- `packages/platform-service/src/tasks/task-role-policy.test.ts`
- `packages/platform-service/src/change/swarm-coordination.integration.test.ts`
- `packages/platform-service/src/service.ts`
- `docs/INTEGRATION_GUIDE.md`
- `docs/SKILLS_AGENTS_AND_TOOLS.md`
- `docs/changes/2026-10-18-role-metadata-policy-fix.md`


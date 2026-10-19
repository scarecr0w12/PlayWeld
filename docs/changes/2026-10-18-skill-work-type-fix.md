# Use semantic work types for agent skill eligibility (F06)

**Release:** 0.22.0

**Impact:** patch

**Category:** Fixed

## Summary

Agent skill search, activation and supporting-resource reads previously filtered by the handler name agent.run, hiding skills configured for semantic work such as code. They now resolve the role snapshot's primary work type, matching model execution, with coordination as the shared empty-role fallback.

## Details

- Agent skill search, activation and supporting-resource reads previously filtered by the handler name agent.run, hiding skills configured for semantic work such as code. They now resolve the role snapshot's primary work type, matching model execution, with coordination as the shared empty-role fallback.
- Ordinary non-agent task kinds retain their original work-type behavior. Role and engine/access eligibility filters remain in place; the fix does not make filtered skills universally available.
- The regression configures role/work-type-specific skill metadata and verifies the same agent can discover, activate and read its supporting instructions. Existing catalog statistics remain recorded against existing task kinds; no historical activation rows are rewritten.
- No public schema, stored data or dependency migration is needed. Patch impact corrects skill availability. Updated integration/contract documentation explains the semantic-work-type distinction.

## Validation

- The new semantic search/activation/resource regression failed before implementation and passed afterward. The final owned skills/roles/router/task-role run passed 57 tests across 13 files with one existing Windows symlink skip.
- Final `npx turbo run build typecheck lint test` passed: 33/33 tasks successful, 22 cache hits for unchanged task inputs, 7m24.71s. The changed platform-service suite ran uncached: 128 files passed, 678 tests passed and six skipped. Theia Control Room verification passed 133 tests across 28 files; other workspaces contributed 76 passing tests and one skip, for 887 passing test cases and seven skips across the monorepo gate. App wrapper test/typecheck/lint scripts that intentionally print skip are not counted as additional test cases. Both Electron and browser application builds completed with zero build errors.
- Skips were existing Windows/platform prerequisites or unavailable real Godot: Linux-only plugin/isolation cases, symlink/process/credential permission cases, and the archive symlink case. The suite did run real local Blender/WSL inspect/export/render and exception tests, real local Qdrant persistence/isolation tests, and Windows LPAC probes with Node and Electron. Unity/Unreal engine identity/bridge cases and paid-provider behavior used deterministic fixtures; no paid external model/asset generation, ordinary production profile acceptance, or new installer lifecycle was performed.
- The first broad gate exposed the missing gameplay-module fixture, successful-parent continuation incompatibility, and duplicate board-audit usage; those were corrected without weakening the preserved acceptance assertions. Because source corrections occurred while that initial run was active, its mixed-state failures are not the acceptance result. A fresh complete run supplied the successful result above. A final planner-role cleanup was rebuilt and its role/registry/bundled-skill checks passed seven tests across three files.
- `bash scripts/check-links.sh` passed with All links OK. `npm run format:check`, `git diff --check`, `npm run changelog:update`, and `npm run changelog:check -- --base HEAD` passed. The final full-gate output is retained locally at `.artifacts/agent-swarm-fixes/full-turbo.log`. Existing manifests/lockfile and the six pre-existing repository Electron processes were preserved; no release/version assignment was performed.

## Files

- `packages/platform-service/src/skills/skill-service.ts`
- `packages/platform-service/src/skills/skill-catalog.test.ts`
- `docs/INTEGRATION_GUIDE.md`
- `docs/SKILLS_AGENTS_AND_TOOLS.md`
- `docs/changes/2026-10-18-skill-work-type-fix.md`


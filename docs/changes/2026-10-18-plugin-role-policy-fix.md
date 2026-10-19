# Retain caller role restrictions across plugin facades (F02)

**Release:** Unreleased

**Impact:** patch

**Category:** Security

## Summary

Plugin host callbacks previously replaced the calling agent role with a plugin identity, and broker role checks exempted that identity. Nested calls now retain originating role constraints while keeping plugin execution attribution and capability checks.

## Details

- Plugin host callbacks previously replaced the calling agent role with a plugin identity, and broker role checks exempted that identity. Nested calls now retain originating role constraints while keeping plugin execution attribution and capability checks.
- The broker intersects explicit caller, recorded task/assignee, and inherited roles. Constraint propagation through tool handler context and engine-to-MCP calls preserves nested restrictions; explicit downstream deny patterns remain authoritative.
- The native sample-plugin lifecycle regression grants a custom role the plugin facade but denies fs/read-file. The facade still runs, while its host callback returns RoleToolDenied and writes a denied audit record. The preceding unrestrained plugin call reads the same fixture file successfully.
- Compatibility: no public RPC or data schema changes and no migration. Trusted plugins still need their accepted capabilities and effective access mode. An allowed facade no longer implies authority to bypass the originating agent's role; patch impact reflects restored policy.

## Validation

- The native plugin integration regression ran through the actual sandboxed sample plugin and authenticated service. Its first broader run passed that regression but exposed an ad hoc plugin-role routing error; the router resolver was corrected to ignore only missing role definitions, and the focused plugin-model case then passed.
- Plugin and broker checks use disposable profiles/files; no production credentials or external engine/provider were invoked.
- Final `npx turbo run build typecheck lint test` passed: 33/33 tasks successful, 22 cache hits for unchanged task inputs, 7m24.71s. The changed platform-service suite ran uncached: 128 files passed, 678 tests passed and six skipped. Theia Control Room verification passed 133 tests across 28 files; other workspaces contributed 76 passing tests and one skip, for 887 passing test cases and seven skips across the monorepo gate. App wrapper test/typecheck/lint scripts that intentionally print skip are not counted as additional test cases. Both Electron and browser application builds completed with zero build errors.
- Skips were existing Windows/platform prerequisites or unavailable real Godot: Linux-only plugin/isolation cases, symlink/process/credential permission cases, and the archive symlink case. The suite did run real local Blender/WSL inspect/export/render and exception tests, real local Qdrant persistence/isolation tests, and Windows LPAC probes with Node and Electron. Unity/Unreal engine identity/bridge cases and paid-provider behavior used deterministic fixtures; no paid external model/asset generation, ordinary production profile acceptance, or new installer lifecycle was performed.
- The first broad gate exposed the missing gameplay-module fixture, successful-parent continuation incompatibility, and duplicate board-audit usage; those were corrected without weakening the preserved acceptance assertions. Because source corrections occurred while that initial run was active, its mixed-state failures are not the acceptance result. A fresh complete run supplied the successful result above. A final planner-role cleanup was rebuilt and its role/registry/bundled-skill checks passed seven tests across three files.
- `bash scripts/check-links.sh` passed with All links OK. `npm run format:check`, `git diff --check`, `npm run changelog:update`, and `npm run changelog:check -- --base HEAD` passed. The final full-gate output is retained locally at `.artifacts/agent-swarm-fixes/full-turbo.log`. Existing manifests/lockfile and the six pre-existing repository Electron processes were preserved; no release/version assignment was performed.

## Files

- `packages/platform-service/src/plugins/plugin-host.ts`
- `packages/platform-service/src/plugins/plugin-service.integration.test.ts`
- `packages/platform-service/src/tools/tool-broker.ts`
- `packages/platform-service/src/tools/tool-registry.ts`
- `packages/platform-service/src/engines/engine-connector-service.ts`
- `packages/platform-service/src/service.ts`
- `docs/changes/2026-10-18-plugin-role-policy-fix.md`


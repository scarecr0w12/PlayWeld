# Enforce Project scope before invoking MCP tools

**Release:** 0.13.0

**Impact:** patch

**Category:** Fixed

## Summary

Reject a Project-scoped MCP tool call made with another Project's context before reaching the external server.

## Details

- Found in the live first-party Unreal bridge negative test: a foreign Project could invoke the other Project's read-only identity tool. Configuration scoping and engine binding validation alone did not enforce the globally registered tool handler's caller scope.
- Enforce matching Project identity at the adapter before invocation. Platform-scoped connections retain their cross-Project behavior. No RPC/storage migration, credential changes or permission weakening.
- Affects read and mutation tools alike; the observed live reproduction was read-only identity, not unauthorized scene mutation. Preserve that evidence boundary.

## Validation

- Regression first resolved private fixture content for a foreign Project instead of rejecting. It now checks rejection before the invoker is called and successful invocation for the owning Project.
- Focused adapter/manager suites passed 11/11. The actual foreign-Project identity call was rejected with ToolDenied before editor invocation; Restricted console was also denied. A subsequent full repository gate passed 33/33 tasks (534 platform tests passed, 11 skipped), before the later managed-plugin addition. Final 0.14.0 gate passed 33/33 (540 platform tests/11 skips); packaged and installed desktop smokes each passed 29 checks.

## Files

- `packages/platform-service/src/mcp/mcp-tool-adapter.ts`
- `packages/platform-service/src/mcp/mcp-tool-adapter.test.ts`
- `docs/changes/2026-10-05-mcp-project-invocation-scope.md`

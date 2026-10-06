# Coalesce simultaneous MCP connection attempts

**Release:** 0.13.0

**Impact:** patch

**Category:** Fixed

## Summary

Fix simultaneous automatic/manual MCP connection attempts replacing each other's session and failing with MCP connection is not connected during catalog refresh.

## Details

- Found while connecting the new first-party Unreal plugin. Reproduced deterministically with four concurrent connects to a real fixture process.
- Share one per-connection in-flight promise through initialization and catalog refresh. Disconnect/update/removal wait for that bounded attempt; internal session cleanup avoids waiting on its own connection promise. Service stop drains pending connections before closing sessions, and new connects are rejected after stop.
- No transport protocol, credential format, RPC/storage or provider changes. Existing timeouts remain authoritative. Live repaired plugin connect/update and editor restart recovery passed.

## Validation

- Regression first failed with MCP connection is not connected. After coalescing, all callers reached a catalogued connected session; corrected the event assertion to count the manager and session's two normal connecting notifications.
- Focused manager/Docker tests passed 9/9 and typecheck passed. A subsequent full repository gate passed 33/33 tasks (534 platform tests passed, 11 skipped), before the later managed-plugin addition. Actual first-party editor connection/update/restart passed after the fix. Final 0.14.0 gate passed 33/33 (540 platform tests/11 skips); packaged and installed desktop smokes each passed 29 checks.

## Files

- `packages/platform-service/src/mcp/connection-manager.ts`
- `packages/platform-service/src/mcp/connection-manager.test.ts`
- `docs/changes/2026-10-05-mcp-concurrent-connect.md`

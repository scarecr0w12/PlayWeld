# Pin and verify the patched MCP fixture SDK resolution

**Release:** 0.15.0

**Impact:** none

**Category:** Security

## Summary

Use the published patched MCP TypeScript SDK in the development/fixture dependency tree and detect stale nested installations.

## Details

- Update the platform-service's exact development dependency from 1.30.0 to 1.31.0 and add a matching root override so shared consumers resolve the same selected version. Version 1.31.0 was published 2026-09-28, satisfying the seven-day preference on this review date.
- The newly listed [OAuth issuer-binding advisory](https://github.com/advisories/GHSA-6qxp-vccf-f47h) affects earlier SDK clients that use OAuth credentials with untrusted HTTP MCP servers. This repository's product MCP implementation is custom; the SDK is a development fixture dependency. The dependency finding is not presented as a reproduced credential leak in PlayWeld.
- A lockfile-only refresh and clean install retained an invalid nested 1.30.0 SDK. An exact workspace install corrected that resolution; the root override prevents a separate newer shared SDK from drifting beyond the selected pin. Preserve the existing braces/sprintf patches and the unified Theia version.
- Add a regression that resolves the SDK entry actually loaded from the platform-service and reads that installation's version, requiring it to match the exact declaration and meet the patched minimum. This catches installed-tree disagreement that a manifest-only assertion would miss.
- Internal development dependency maintenance uses no product version impact; no service/RPC/data migration or compatibility rename is required. The package lock records the exact resulting resolution.

## Validation

- Checked the advisory and npm publication metadata. Before correction, `npm ls` reported the nested 1.30.0 installation invalid against the 1.31.0 declaration; afterward it reports 1.31.0 overridden.
- Clean `npm ci` successfully reapplied both existing local dependency patches. The resolved-version guard and MCP suite passed 65 tests across 14 files. Final full dependency audit reports 19 entries (10 high, nine moderate, zero critical), all rooted in the existing locally patched braces/sprintf packages. Actual evidence is retained under `.turbo/adversarial-review/`.
- Remaining registry advisories from the locally patched braces/sprintf versions must still be reported; neither package had an upstream patched release during this pass. This change is not a comprehensive security certification.

## Files

- `package.json`
- `package-lock.json`
- `packages/platform-service/package.json`
- `packages/platform-service/src/dependencies/mcp-sdk-version.test.ts`
- `docs/changes/2026-10-06-patched-mcp-sdk-resolution.md`

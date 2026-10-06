# Preserve installed runtime permissions for Windows LPAC

**Release:** 0.16.0

**Impact:** patch

**Category:** Fixed

## Summary

Fix Windows isolation startup from an administrator-owned Program Files runtime without requiring ordinary users to rewrite its permissions.

## Details

- Final deployment acceptance reproduced an installed-runtime defect: the 0.15.0 candidate passed LPAC in its user-owned build/stage directories, but the same launcher reported unavailable when run through the actual Program Files Electron executable. That runtime grants read/execute to All Restricted Application Packages, while normal users cannot rewrite its ACL.
- Reuse that existing read/execute grant for read-only runtime paths. Require the precise ARAP SID, complete read/execute rights and no intersecting deny rule. The broader All Application Packages grant remains insufficient, so the existing AAP-negative probe is preserved. Writable scratch still requires the unique container SID and low-integrity label.
- Cleanup skips files with no owned container rule rather than attempting unauthorized writes to runtime ACLs. Private source/runtime paths still receive scoped SID grants and owned cleanup. This is a compatibility repair; no isolation fallback, elevation requirement or broad host permission is introduced.
- Extend the retained isolation harness with an explicit installed executable option. It still reports actual Node/Electron boundary results and Job descendant termination. Only the owned temporary probe paths are writable.
- Preserve the staged 0.15.0 candidate and use a new 0.16.0 release for the fix. The ordinary installation remains at 0.14.0 until corrected-package acceptance completes.

## Validation

- Before the fix, the actual Program Files executable plus source-built launcher returned available=false with an unauthorized ACL operation; its installed ARAP read/execute grant was independently inspected. No ordinary service or Project was stopped or modified by that probe.
- Native helper/service rebuild passed. `.artifacts/windows-isolation/1791327194125/report.json` passes all five boundary checks in Node, development Electron and the actual administrator-owned Program Files Electron executable under the ordinary user. The broader AAP file remains denied, scratch writes pass, and the owned worker/descendant termination check passes. No runtime ACL elevation was required. Corrected release packaging and installed acceptance are recorded separately as they finish.

## Files

- `packages/platform-service/src/plugins/isolation/native/AppContainerHost.cs`
- `scripts/windows-isolation-acceptance.cjs`
- `docs/changes/2026-10-06-installed-runtime-lpac-permissions.md`

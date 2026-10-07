# Use inherited pipe handles for Electron LPAC workers

**Release:** Unreleased

**Impact:** patch

**Category:** Fixed

## Summary

Repair native Electron Node-mode plugin startup when the Windows server denies NUL device access inside LPAC, while keeping the existing filesystem/network/job isolation.

## Details

- Hosted 0.20.0 Windows release quality passed, but the actual packaged Electron LPAC probe failed before worker JavaScript ran: Electron reported that it could not open the NUL device and recommended --no-stdio-init. Linux packaging and complete source CI passed; local installed 0.20.0 passed native and desktop checks. Preserve the failed tagged package and local evidence; no public release is claimed.
- For the verified current Electron executable only, prepend --no-stdio-init so Electron uses standard pipe handles already established by the native helper instead of opening NUL. Ordinary Node and Python arguments keep their existing behavior. LPAC token, capabilities, allowed paths, restricted networking and kill-on-close job policy are unchanged; no extra filesystem/device access or weaker sandbox is granted.
- Checked the exact [Electron 42.10.0 NodeMain source](https://github.com/electron/electron/blob/v42.10.0/shell/app/node_main.cc): the switch sets kNoStdioInitialization and is removed before Node parses CLI options. It is distinct from disabling sandbox enforcement.
- Add an actual Windows Electron executable regression alongside the ordinary Node LPAC test. Require the same private-host/all-applications/source-write denial, scratch-write allowance and network denial; this detects the desktop runtime boundary during source testing instead of waiting for packaging. Linux explicitly skips this Windows-only case.
- Extend the manual native integration workflow to run these ordinary Node/Electron boundaries through strict Turbo after the existing credential checks, retaining its file identity and renaming its display title for the broader scope.
- Complete a new version and preserve v0.20.0 rather than changing its source tag or overwriting its installer. Publication and final local upgrade receive a separate permanent receipt.

## Validation

- Complete 0.20.0 source CI 37555962077 and repaired-source CI 37555130951 passed Windows/Linux/browser gates. Tagged Desktop Release 37556533529 preserved its Linux success and exact Windows NUL failure in .artifacts/local-deployment/0.20.0-1791335020097/hosted-windows-package-failure.log.
- Corrected local/native Electron and focused hosted/runtime/package acceptance are pending until actually run. This record does not promote the failed package or infer security from a launch marker.

## Files

- `packages/platform-service/src/plugins/isolation/appcontainer-launcher.ts`
- `packages/platform-service/src/plugins/isolation/isolation.test.ts`
- `docs/changes/2026-10-06-electron-lpac-stdio.md`
- `.github/workflows/windows-transport-probe.yml`

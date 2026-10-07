# Diagnose hosted Windows credential transport

**Release:** Unreleased

**Impact:** none

**Category:** Maintenance

## Summary

Add a disposable native Windows transport probe after both hosted 0.18.0 runners reproduced the DPAPI deadline failure.

## Details

- Preserve failed 0.18.0 Windows CI/release logs and the source tag. Linux quality/package and browser smoke passed; publication is not accepted. The local ordinary upgrade retained four Projects, 139 models, five pools and matched 417 installed files. A first isolated installed service startup exceeded its five-second readiness budget; the unchanged retry passed, and that timing limitation remains recorded.
- Compare EOF-based and newline-framed Windows PowerShell stdin with a fixed non-secret fixture, native DPAPI protect/unprotect and only static phase markers, elapsed time, exit code, length and fixture checksum. No account, credentials, signing material or ordinary profile is read.
- Provide a manual Windows Actions job without npm installation to distinguish input transport from native crypto/runtime behavior. Both children have twenty-second termination limits. This is diagnostic tooling, not a timeout increase or a skipped release assertion.

## Validation

- Initial local Node 24.21.0 direct DPAPI protection passed after downloading the exact hosted runtime from nodejs.org and checking its published SHA-256; the runtime version alone did not reproduce the failure.
- The initial expanded local probe was rejected by native process startup with EPERM before phase output, while a minimal static PowerShell phase command and the application DPAPI helper both passed. The probe is retained to test the hosted environment directly; hosted phase results remain pending. Full installed desktop acceptance and public release remain pending; no successful Windows publication is claimed.

## Files

- `scripts/probe-windows-dpapi-transport.cjs`
- `.github/workflows/windows-transport-probe.yml`
- `docs/changes/2026-10-06-windows-credential-transport-diagnosis.md`

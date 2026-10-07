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
- Extend the hosted probe with a clean dependency/service build and the exact isolated protected-key regression. Temporary helper phase markers were used for diagnosis and reverted before final runtime acceptance: the final helper keeps its original static PowerShell script, pipes/drains stderr without logging, and preserves static redacted errors and stdin-only sensitive input. Add a direct ignored-versus-piped stderr round-trip comparison with the exact original helper script, and a deterministic regression for the valid drained pipe.

## Validation

- Initial local Node 24.21.0 direct DPAPI protection passed after downloading the exact hosted runtime from nodejs.org and checking its published SHA-256; the runtime version alone did not reproduce the failure.
- The initial expanded local probe was rejected by native process startup with EPERM before phase output, while a minimal static PowerShell phase command and the application DPAPI helper both passed. The probe is retained to test the hosted environment directly; hosted phase results remain pending. Full installed desktop acceptance and public release remain pending; no successful Windows publication is claimed.
- Hosted baseline workflow 37552973484 passed EOF and newline protect/unprotect round trips on Node 24.21.0 in 2671ms and 283ms. This rules out a general hosted DPAPI or input-framing failure for that fixture; the exact application test is isolated next. Local phase-instrumented protected-key execution receives EPERM before process startup, while six deterministic/portable tests pass. That unsuccessful local diagnostic is retained without promoting runtime acceptance.
- Local installed 0.18.0 desktop smoke passed 29 checks with zero renderer errors at .artifacts/documentation-electron/1791333489913. The owned isolated probe left after the first five-second readiness failure was authenticated and stopped by its exact PID/profile; the ordinary service and two unrelated staged services remain available. Public release remains pending corrected Windows acceptance.
- Focused hosted workflow 37553215366 passed all four actual protected-key tests in 1676ms after using a valid stderr pipe (the protected-key case took 1210ms). The original uninstrumented script with piped/drained stderr then passed all seven local process/protected-key checks in 3.05 seconds. Direct ignored-versus-piped hosted comparison is pending; no timeout is extended again and no native signing assertion is skipped.

## Files

- `scripts/probe-windows-dpapi-transport.cjs`
- `.github/workflows/windows-transport-probe.yml`
- `docs/changes/2026-10-06-windows-credential-transport-diagnosis.md`
- `packages/platform-service/src/engines/unreal/editor-bridge-tools.ts`
- `packages/platform-service/src/engines/unreal/dpapi-process.test.ts`

# Preserve CLI lifecycle failure diagnostics

**Release:** 0.22.0

**Impact:** none

**Category:** Maintenance

## Summary

Keep bounded daemon diagnostics when the compiled CLI lifecycle integration test fails, preserving its startup deadline, shutdown assertions and cleanup.

## Details

- Windows CI for the model-discovery commit passed the audit-history test on its single retry but failed the separate CLI lifecycle test with a named-pipe connection error after its ten-second readiness window. The test previously ignored daemon output and deleted the disposable profile during cleanup, so the hosted failure did not establish whether startup was slow or the daemon exited. This change does not claim to fix or establish that root cause.
- Capture the last 8192 characters of each daemon output stream and, on failure only, report elapsed time, daemon exit/signal state, lock/token presence and the recent service log before the existing cleanup runs. Preserve the original error stack as bounded, redacted diagnostic text rather than retaining an independently printed unredacted cause.
- Redact the disposable profile's service token from captured output, logs and error text. Read missing diagnostic files defensively so missing logs do not replace the original failure. The ten-second readiness deadline, twenty-five-second test timeout, connection retries, normal status/stop assertions, lock-removal/log assertions and owned-process cleanup remain intact.
- Changes are isolated from concurrent swarm repairs. No production source, RPC/storage contracts, dependencies, package versions, installed application or ordinary user profile changes are included; no migration is required. Version 0.21.1 remains unchanged because this is test observability work and no installer is prepared or published.

## Validation

- Build the service and its local workspace dependencies from isolated commit `b87a437fead0d031cb8cbf17883ce76b50e59f1a`, reusing existing installed third-party dependencies without a new installation. Three disposable-profile compiled CLI startup/status/stop reproductions succeeded; authenticated readiness took 1651, 1338 and 1457 ms, and shutdown removed all three locks.
- The original focused lifecycle test passed in the isolated worktree. With the final diagnostic change, the same focused lifecycle test, scoped ESLint, formatting, whitespace, work-record freshness/coverage and Markdown link checks passed. A negative control temporarily substituted only the isolated ignored compiled CLI with a child that writes a synthetic startup failure and exits 23: the test failed as required and retained both exit code and stderr in its diagnostic output. A synthetic service-token control also verified that the token was redacted from emitted diagnostics. Exact original compiled CLI bytes were restored after each control. Read-only review found no behavior or assertion changes; its error-cause redaction caveat was addressed and the focused checks repeated. No hosted root cause or full CI success is inferred from local reproductions.
- Existing local Node is 24.19.0; the failed hosted Windows run used Node 24.21.0. The hosted-only startup failure remains unverified locally. No additional blind CI retry, paid provider call, merge, tag or release publication is part of this work.

## Files

- `packages/platform-service/src/cli.test.ts`
- `docs/changes/2026-10-19-cli-startup-failure-diagnostics.md`

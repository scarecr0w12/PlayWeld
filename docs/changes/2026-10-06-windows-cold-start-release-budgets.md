# Bound Windows cold startup and hosted fixture lifecycle

**Release:** 0.18.0

**Impact:** patch

**Category:** Fixed

## Summary

Accommodate observed cold Windows startup while retaining bounded, cancellable DPAPI and complete fixture assertions for the next testing release.

## Details

- Hosted v0.17.0 Windows quality hit the DPAPI child deadline at 10047ms; the independent release runner hit the same deadline plus multiple 10000ms fixture setup hooks and subsequent locked cleanup. Linux quality/package and browser smoke passed. Repeating the same source alone does not repair these measured timing limits.
- Raise only the DPAPI process deadline from ten to thirty seconds, with prompt AbortSignal cancellation. Report static timeout, cancellation, exit and input/start transport categories without printing child stderr, payloads or private keys. Clear deadline/listeners on both failed startup and normal exit.
- Give service test bodies thirty seconds and setup/teardown hooks sixty seconds. Native protected-key CLI execution receives sixty seconds, with a 120-second overall multi-operation case. Crypto, signature, isolation, task and retention assertions remain unchanged; no capability check is disabled.
- Add deterministic mocked-process tests for stdin-only sensitive input, cleanup, successful execution, startup beyond ten seconds, bounded termination, cancellation and redacted failure. Actual native protected-key tests remain required on Windows.
- Preserve failed v0.16.0/v0.17.0 tags and all local candidate/deployment artifacts. Prepare a new 0.18.0 minor version and publish only after corrected hosted Windows/Linux and local deployment acceptance. Record final publication in a separate receipt without rewriting immutable tagged records.

## Validation

- Hosted Windows failure logs are retained under .artifacts/local-deployment/0.17.0-1791329647605. The local 0.17.0 ordinary upgrade retained four Projects, 139 models, five pools/configuration/key/pricing/task identities and matched 417 installed files. Its staged smoke passed 29 checks; installed smoke results are retained separately.
- All 34 targeted process/native-signing/A2A/tool-broker checks passed locally. Deterministic cases prove ten-second startup no longer terminates early, the thirty-second cap still kills the child, cancellation is immediate, input stays off arguments, deadline cleanup completes and diagnostics contain only static categories/exit codes. Actual Windows protected-key generation and signature verification remain enabled and passed. Full 0.18.0 source/package/deployment and hosted/publication results are recorded separately as they finish.
- The corrected 0.18.0 full source gate passed all 33 tasks (nine cached, 24 fresh), with 560 platform tests/six explicit capability skips and 128 extension tests. Tracking passed 25 checks; formatting, references/inventory/evidence, documentation links, release agreement/coverage and diff checks passed. First-attempt lint evidence remains retained; the cancellation regression now also asserts the process was killed. Final package/deployment/publication acceptance follows the immutable source tag.

## Files

- `packages/platform-service/src/engines/unreal/editor-bridge-tools.ts`
- `packages/platform-service/src/engines/unreal/dpapi-process.test.ts`
- `packages/platform-service/src/updates/release-metadata-cli.test.ts`
- `packages/platform-service/package.json`
- `docs/reference/DOCUMENTATION_INVENTORY.md`
- `docs/reference/documentation-inventory.json`
- `docs/STATUS.md`
- `docs/RELEASE_GUIDE.md`
- `docs/changes/2026-10-06-windows-cold-start-release-budgets.md`

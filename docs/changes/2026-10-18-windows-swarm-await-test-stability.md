# Separate Swarm await progress and native cleanup test budgets

**Release:** Unreleased

**Impact:** none

**Category:** Maintenance

## Summary

Repair the Windows Swarm await regression fixture's competing deadlines without changing production scheduling or suppressing deadlock assertions.

## Details

- The successful-await scenarios previously gave children two seconds to finish, including serialized work and native process startup. The outer ten-second test deadline also overlapped the supervisor's existing ten-second shutdown grace period, so a slow or failed scenario could surface as an outer timeout instead of its original task failure.
- Add a native IPC regression with two 1.5-second children at concurrency one. This deliberately exceeds the old two-second await allowance and reproduced a failed coordinator with `Child starved` before the correction.
- Give successful fixture awaits fifteen seconds, keep the explicit timeout case at one millisecond, and independently bound normal scheduling progress at six seconds. The deliberately slow-child scenario has a separate ten-second progress deadline. Use a thirty-second outer deadline to accommodate setup and bounded supervisor cleanup. Assertions still verify successful parent completion, tool refresh, concurrency limits, cancellation, zero double-counted usage and error propagation; a real scheduler deadlock still fails the independent progress assertion.
- Include the existing refresh-error scenario in the helper's TypeScript mode union and parameterize child duration/progress limits. No application runtime, storage, RPC, dependencies or product version changes; no migration is required.

## Validation

- Baseline five-scenario Windows run passed. The new slow-child regression failed against the old fixture with `Child starved` (one failed, five deselected), proving the short success allowance is a reproducible failure mechanism rather than merely increasing a global timeout.
- After separating the budgets, five consecutive focused Windows runs passed all six cases (30 test executions). After reserving a ten-second progress deadline for the deliberately slower children, another five consecutive runs of the final configuration passed all six cases (30 more test executions). Original progress, explicit-timeout, concurrency, cancellation, refresh and usage assertions remain intact.
- `npx --no-install turbo run build typecheck lint test --concurrency=1` passed all 33 tasks (21 cache hits) in 7m38.842s, including Electron and browser builds. Platform service: 128 files, 679 passed and six skipped. Theia: 28 files and 133 passed. Workspace total: 888 passed and seven skipped. Formatting, version consistency, generated references/inventory, documentation evidence integrity, changelog coverage, whitespace and Markdown links passed. Hosted verification will be recorded after completion.
- Ignored logs: `.artifacts/windows-swarm-models-fixes/swarm-baseline.log`, `swarm-slow-red.log`, `swarm-repeat-1.log` through `swarm-repeat-5.log`, and `full-quality.log` in the same directory. An earlier hosted failure remains preserved in the 0.22.0 deployment evidence; this record does not rewrite its result.

## Files

- `packages/platform-service/src/workers/supervisor-await.test.ts`
- `docs/changes/2026-10-18-windows-swarm-await-test-stability.md`

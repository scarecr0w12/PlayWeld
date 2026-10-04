# Explain agent token and cost budget failures

**Release:** 0.6.0

**Impact:** patch

**Category:** Fixed

## Summary

Show the exhausted token or dollar budget and actual/limit values in agent failures, and expose task budgets in the read-only diagnostic command.

## Details

- Live task records and per-call usage events for three failed narrative children matched exactly: 169414 against a 150000-token ceiling, 102925 against 100000, and 119742 against 100000. Reported dollar usage was zero. The observed failures do not show duplicate usage accounting; they exhausted per-task token limits that are separate from the Project's default 5 USD maximum-cost setting.
- The coordinator root had no explicit task token ceiling and failed on an estimated 60210-token request against its 60000-token input/context limit. That distinct failure must not be labeled cumulative task-budget exhaustion.
- Explain cumulative input plus output, including replayed transcript inputs, in the failure message. Distinguish token exhaustion from dollar exhaustion and carry the configured budget in the RPC error data. Numeric limits, equality behavior and enforcement timing are unchanged: the next turn is refused when recorded usage is at or above a configured ceiling, so a preceding response can overshoot it.
- Add the task budget to diagnose-agent-task.cjs next to spent totals. Document token budgets separately from response-output allowances and context limits, coordinator-supplied child ceilings, and the limitation of zero reported cost when pricing is unavailable.
- Existing installs retain their old error messages until updated. No budget was raised, disabled or changed in the live Project; no provider request or task retry was initiated. No schema or compatibility-identifier changes.

## Validation

- Live authenticated task/event comparison matched every usage-event sum to its recorded spent total and verified all three token ceilings were exceeded.
- The focused regression first failed on the generic message and missing budget data before the fix.
- All 11 agent-runtime tests passed, including token-only exhaustion with zero cost, dollar exhaustion, and high cumulative usage without a token ceiling. The updated inspector ran against the installed service and returned the 150000-token task budget beside its 169414-token spent counter.
- Documentation links passed under WSL; script syntax and git diff whitespace checks passed. Global formatting still reports the three pre-existing untracked .kilo agent profiles; those files remain untouched.
- Full `npx turbo run build typecheck lint test` passed all 33 tasks (22 cached), including 372 passing platform-service tests with 11 capability-dependent skips and Electron/browser builds. Electron typecheck/lint/test remain configured skips. Changed runtime files pass Prettier. Changelog generation passed; the coverage check remains blocked by the pre-existing untracked .kilo agent files, outside this task's scope.

## Files

- `docs/changes/2026-10-03-agent-budget-failure-diagnostics.md`
- `docs/OPERATIONS_GUIDE.md`
- `packages/platform-service/src/agents/agent-runtime.ts`
- `packages/platform-service/src/agents/agent-runtime.test.ts`
- `scripts/diagnose-agent-task.cjs`

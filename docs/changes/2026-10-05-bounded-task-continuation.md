# Bounded task continuation at agent turn limits

**Release:** 0.13.0

**Impact:** minor

**Category:** Added

## Summary

Replace abrupt task failure at a model-turn boundary with checkpoint retention and an explicit task question offering another bounded allowance or stopping.

## Details

- Warn near the configured turn allowance and encourage bounded completion with truthful evidence. At the boundary, retain the checkpoint and use the existing Waiting input/question workflow.
- Only an exact Continue answer extends the allowance by the configured role/default turn count. Other answers stop with AgentTurnLimit and retained work. Cumulative cost/token budgets are checked before the question; existing time limits, access policy, selected model and completion contract remain authoritative.
- Persist approved allowances and consumed question references across service restart. This does not auto-approve continuation, raise global role limits or mark incomplete work succeeded. Existing failed task records remain historical.
- Compatible behavior addition without public RPC/storage migration. Packaging and installed deployment remain pending.

## Validation

- Continuation test first reproduced AgentTurnLimit failure; then passed after the change. Tests also cover retained continuation and cumulative budget exhaustion across restart.
- Full repository gate passed 33/33 tasks, including 532 passing platform tests and 11 skips. Format check passed.
- Real Luna task `01a10eb3-e2c2-7e99-a65d-d9bb7e864f58` used a disposable one-turn role, retained its marker, received two exact Continue answers through native task questions and succeeded at turn3. No game, desktop browser, paid asset or provider configuration changes were made by that task.

## Files

- `packages/platform-service/src/agents/agent-runtime.ts`
- `packages/platform-service/src/agents/agent-runtime.test.ts`
- `docs/USER_GUIDE.md`
- `docs/changes/2026-10-05-bounded-task-continuation.md`

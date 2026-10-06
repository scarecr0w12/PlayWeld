# Preserve worker question identifiers during persistence

**Release:** 0.13.0

**Impact:** patch

**Category:** Fixed

## Summary

Answers to a live worker question now reach the original waiting worker. The supervisor previously persisted a different question identifier, causing answer acknowledgement to time out and the worker to restart unnecessarily.

## Details

- The worker creates an identifier for its pending answer promise. The supervisor now passes that identifier through the task graph and store rather than discarding it and generating another identifier. Other question creation continues to generate identifiers by default; public schemas and existing records remain compatible, with no migration.
- Added a real subprocess regression through the supervisor, task service, persisted question and answer API. It checks that the answer is delivered and the original worker completes, with exactly one process start.
- A live narrative continuation previously failed with missing tool output after a forced restart. This change fixes the unnecessary restart for an answer while the original worker is alive. It does not claim to repair all paused-agent checkpoint recovery after service restart, nor rewrite historical failures.

## Validation

- Before the fix, the subprocess test delivered the eventual answer only after starting two workers and failed the one-worker assertion. After the identifier fix, it passed with one worker and the expected answer.
- Broader integration/worker/task/DCC regression run passed 38 tests across five files; platform-service build passed. The full repository build/typecheck/lint/test gate passed 33/33 tasks, including 527 platform tests with 11 explicitly skipped.
- Restarted the owned isolated source runtime and verified native `noop.ask` answer continuation succeeded. A fresh actual Luna `agent.run` persisted a question, received the coordinator's acceptance-fixture answer, wrote the expected native Project JSON and completed successfully (`01a10da5-40d2-7750-b3db-4ca6d832437e`). This is live question/tool continuation, distinct from recovery of an already stopped worker.
- Formatting, change tracking and the required documentation link script passed. The source-built Electron desktop was reopened and verified against the restarted owned service. Ordinary installed-app upgrade remains unverified.

## Files

- `packages/platform-service/src/tasks/task-store.ts`
- `packages/platform-service/src/tasks/task-graph.ts`
- `packages/platform-service/src/workers/supervisor.ts`
- `packages/platform-service/src/workers/supervisor.test.ts`
- `docs/changes/2026-10-05-worker-question-id-handoff.md`

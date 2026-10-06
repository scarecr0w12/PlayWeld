# Recover interrupted agent tool-result histories

**Release:** 0.13.0

**Impact:** patch

**Category:** Fixed

## Summary

Repair restored agent checkpoints that contain assistant tool calls without all corresponding outputs, avoiding provider missing-tool-output failures and repeated consumption of older question answers.

## Details

- Recover pending task questions before the next provider request. Supply explicit interrupted-result records for other uncertain calls instead of replaying filesystem, engine, process or paid mutations whose completion is unknown. Models must inspect durable evidence before retrying.
- Preserve completed outputs. Persist recovered outputs and durable consumed-answer references. Restore the worker answer cursor across checkpoint compaction, with a legacy transcript fallback and migration of retained old question outputs.
- No provider/model changes, new public RPC, credential changes or database migration. Existing generic non-agent checkpoints retain answer cursor zero.
- Work is in progress; source tests passed, live restart/provider and packaged deployment checks remain pending.

## Validation

- Agent regression first failed because the pending question was never recovered. After repair, focused agent/checkpoint suites passed; a real forked worker test also passed, verifying a compacted checkpoint consumes the next persisted answer rather than repeating the old one.
- Platform build and typecheck passed. Full repository gate passed 33/33 tasks (532 platform tests passed, 11 skipped), including the real forked-worker answer-cursor regression. Format check passed.
- Source-built service restart retained five Projects, the Luna-only authoring pool, 120quests/144NPC data and actual1536-dimensional semantic search. Live interrupted-provider-history and packaged deployment acceptance remain pending.

## Files

- `packages/platform-service/src/agents/agent-runtime.ts`
- `packages/platform-service/src/agents/agent-runtime.test.ts`
- `packages/platform-service/src/workers/checkpoint-answers.ts`
- `packages/platform-service/src/workers/checkpoint-answers.test.ts`
- `packages/platform-service/src/workers/worker-main.ts`
- `packages/platform-service/src/workers/supervisor.test.ts`
- `docs/changes/2026-10-05-checkpoint-tool-result-recovery.md`

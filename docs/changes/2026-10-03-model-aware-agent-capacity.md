# Use selected-model capacity for agent context and output

**Release:** 0.6.0

**Impact:** minor

**Category:** Changed

## Summary

Replace automatic fixed agent context/output token limits and Swarm's implicit cumulative token budget with selected-model capacity and explicit user controls.

## Details

- User-confirmed requirement: derive model capacity settings from the selected model rather than arbitrary platform token limits. Record M10 separately from the unresolved wider metadata/spending policies, map it to WP8, and retain source-versus-installed evidence boundaries.
- Add task-bound internal model preparation. Select before checking context; reuse the same route/model metadata for compaction and completion, including resumptions. Remove legacy checkpoint output allowances and the runtime's fixed 4096-to-32768 output retry ladder. Truncated responses fail explicitly without executing partial tool calls.
- Estimate messages and tool schemas together for both compaction and final validation. Apply shared context minus requested output, independently reported input capacity, and optional explicit lower ceilings. Bound compaction fragments to this allowance, merge successive summaries, preserve pinned instructions and assistant/tool groups, allow summaries to be compacted again, and account for every compaction call against explicit budgets. Character-based estimates remain approximate; actual provider tokenization is authoritative.
- Add optional maxInputTokens to model contracts and manual metadata updates without a schema-version/storage migration. Read OpenRouter context_length/top_provider.max_completion_tokens and Anthropic max_input_tokens/max_tokens. Keep absent metadata unknown, preserve previously discovered metadata on ID-only refresh, and retain manual overrides. Provider field definitions checked 2026-10-03 against [OpenRouter Models](https://openrouter.ai/docs/api/api-reference/models/list-all-models-and-their-properties) and [Anthropic Models](https://platform.claude.com/docs/en/api/http/models).
- Unknown OpenAI-compatible capacity stays provider-managed with omitted output allowance and no artificial local context ceiling. Anthropic's mandatory output parameter fails with actionable metadata guidance if neither metadata nor an explicit request supplies it; remove the arbitrary 1024 fallback. No guessed model-name capacity table or paid discovery/completion is introduced.
- Models displays reported shared/input and output capacities, metadata provenance, and unknown/provider-managed labels. Swarm starts with a blank optional cumulative token budget. Coordinators cannot invent child token ceilings; delegation inherits an explicit parent ceiling while preserving other budget controls.
- Retain coordination.maxTranscriptTokens as a compatible settings key; default zero means automatic and a positive saved value explicitly lowers the allowance. New snapshots use contextTokenCeiling; legacy snapshot/checkpoint fixed limits no longer override selected-model capacity. Persisted task budgets and existing provider/model/pool configuration are unchanged. Existing installed 0.5.0 behavior changes only after deployment of a new build.

## Validation

- Focused runtime/delegation/provider tests passed 33 cases, including a one-million-token model above the historical context ceiling, unknown capacities without invented output limits, legacy checkpoint resume, bounded multi-fragment compaction, explicit lower ceilings, independent provider input capacity, token-ceiling inheritance and mandatory unknown Anthropic output rejection.
- Service and Theia extension typechecks passed. Routing/approval/model/Swarm integration tests passed all seven cases; prepared completions route once and reuse the selected model.
- Isolated built-browser smoke passed six checks with no renderer errors, including reported/unknown capacity labels and a blank Swarm token-budget default. Report: `.turbo/settings-models-ui/1791072769490/report.json` (ignored local evidence). The first Swarm assertion failed because the harness had not selected a Project; the corrected harness creates/selects a disposable fixture Project. No user Project was used.
- Documentation links passed under WSL. Generated RPC/settings references were refreshed and their freshness check passed. Global format check reports only the three pre-existing untracked .kilo agent profiles; changed source formatting is clean. Changelog generation passed; coverage remains blocked by the same unrelated untracked .kilo files. Git diff whitespace check passed.
- Full `npx turbo run build typecheck lint test` passed all 33 tasks (13 cached), including Electron/browser builds and 382 passing platform-service tests with 11 capability-dependent skips across 99 files. Electron typecheck/lint/test remain configured skips. Log: `.turbo/model-capacity-full-gate.log`. The first full attempt exposed unused test-stub parameter lint errors, corrected before the passing run.
- A supplemental pending-record path audit found no uncovered task paths after excluding the separately reported unrelated .kilo profiles. This does not replace or claim a passing official global coverage gate.
- No running user tasks, locks, saved budgets, account credentials or model pools were changed. Installed deployment and paid-provider acceptance are unverified; this pending work is not a release or installer-lifecycle claim.

## Files

- `docs/changes/2026-10-03-model-aware-agent-capacity.md`
- `docs/DEVELOPMENT_PLAN.md`
- `docs/OPEN_DECISIONS.md`
- `docs/OPERATIONS_GUIDE.md`
- `docs/PLATFORM_DESIGN.md`
- `docs/STATUS.md`
- `docs/TECHNICAL_ARCHITECTURE.md`
- `docs/API_REFERENCE.md`
- `docs/SETTINGS_REFERENCE.md`
- `docs/reference/rpc-schemas.json`
- `docs/reference/settings-schemas.json`
- `packages/contracts/src/models/schema.ts`
- `packages/contracts/src/rpc/protocol.ts`
- `packages/platform-service/roles/coordinator/ROLE.md`
- `packages/platform-service/src/agents/agent-runtime.ts`
- `packages/platform-service/src/agents/agent-runtime.test.ts`
- `packages/platform-service/src/agents/agent-tools.ts`
- `packages/platform-service/src/agents/agent-tools.test.ts`
- `packages/platform-service/src/agents/model-context.ts`
- `packages/platform-service/src/models/completion-service.ts`
- `packages/platform-service/src/models/completion-service.test.ts`
- `packages/platform-service/src/models/model-registry.ts`
- `packages/platform-service/src/models/providers/anthropic.ts`
- `packages/platform-service/src/models/providers/openai-compatible.ts`
- `packages/platform-service/src/models/providers/providers.test.ts`
- `packages/platform-service/src/settings/definitions.ts`
- `packages/platform-service/src/tasks/task-service.ts`
- `packages/theia-control-room/src/browser/models-widget.tsx`
- `packages/theia-control-room/src/browser/swarm-widget.tsx`
- `scripts/settings-models-ui-smoke.cjs`

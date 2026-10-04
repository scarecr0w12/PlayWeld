# Integrate bounded local decision models with tasks and routing

**Release:** 0.9.0

**Impact:** minor

**Category:** Added

## Summary

Integrate independently running typed decision endpoints with PlayWeld task assessment and eligible model selection, using inactive-until-configured shadow defaults, explicit assist mode, durable evidence, and visible usage/history.

## Details

- Add version-1 assessment/request/history contracts and System One/OpenRouter Decisions HTTP adapters. Reuse encrypted provider-account credentials; configure a judge explicitly rather than recursively Auto-route it. Non-loopback endpoints require consent and HTTPS; refuse redirects, bound request/response bytes, and cover streamed body reads with cancellation/deadlines. Validate named answers, known labels, finite normalized distributions, nullable confidence/usage, and reported truncation/collapsed options without inventing missing probabilities or zero prices.
- Assess task work kind, effort, missing context, review/decomposition/engine-validation needs, and eligible model options. Use short option labels and supply the configured routing objective/constraints. Suggestions are not task-state transitions, dependency creation, completion validation, permission grants, or review waivers.
- Shadow records only. Explicit assist can prefer a sufficiently concentrated recommendation after current account/model enablement, pools, capabilities, estimated budget/latency filters and manual choice. Recheck eligibility at preparation; uncertain/denied/failed/changed configurations retain ordinary routing. Agent turns require chat/tool capabilities rather than admitting incapable models into assisted dispatch.
- Add profile migration 15 for versioned Project/task assessment history plus service-owned Project events/checkpoint identities. Store hashes rather than summary/credential copies in the dedicated history. Coalesce concurrent identical calls, reuse matching task/state/configuration records without recharging usage, preserve unknown costs/counts, and include fresh decision usage in agent task spending before the worker call.
- Merge decision inference from its service-owned ledger into Audit Model Usage without treating it as worker completion or a router-training outcome. A tagged `decision` variant permits null token/cache counts; existing `completion` counters remain non-null. Known-only subtotals disclose incomplete counts. Audit consumers must handle the new variant; client/service source are updated together.
- Add a read-only Models & Routing assessment tab with independent loading/error/empty states, baseline/suggestion, bounded advice, latency/usage and structured JSON. Expose account IDs for setup; reading history makes no model call. Configuration stays in scoped Models settings/provider accounts, not frontend durable state.
- Update user/architecture/status/register guidance and generated references/inventory, mapping the decisions RPC family. No dependencies, weights, inference engines, training jobs, live provider calls, release-version changes, installed-app changes, or production-profile changes are introduced. Live/calibrated checkpoint acceptance, learned performance predictors, LLMRouter/RouteLLM/vLLM adapters, benchmark ingestion and measured improvements remain separate work.

## Validation

- Focused transport/service/routing/runtime/migration tests passed against fake endpoints and temporary/in-memory databases. Forked-worker HTTP/RPC integration passed shadow and assist modes, including history, broker calls, audit events, fees/tokens and expected worker selection.
- Explicit message-version and nullable audit-display tests passed. Independent source reviews identified concurrent duplicate assessments, missing decision usage in the model audit, and missing RPC version markers; fixes and targeted regressions address all three.
- `npx turbo run build typecheck lint test --output-logs=errors-only --concurrency=2` passed all 33 tasks after updating the two stable setting-count assertions for 85 definitions. Capability/OS-dependent tests retain explicit skips. Turbo emitted a disk-space cache warning; the gate exited successfully and E: had about 1 GB free afterward. No unrelated artifacts were deleted.
- `npm run format:check`, `git diff --check`, `bash scripts/check-links.sh`, `node scripts/check-documentation-evidence.cjs`, `node scripts/generate-system-reference.cjs --check`, and `node scripts/generate-documentation-inventory.cjs --check` passed. Evidence integrity is not independent verification of upstream decision-model quality.
- `npm run changelog:update` and `npm run changelog:check -- --base HEAD` passed with all feature and generated-reference paths covered before concurrent, unrelated cache/build-maintenance edits appeared. The final repository-wide coverage check then reported `.gitignore` as unrecorded work outside this feature; those edits were left untouched. The 33-task gate above predates that separate maintenance work. Workspace release versions remain 0.8.0.
- No live Kev/Laya/Jev acceptance, paid external call, model download/training, deployment, packaged Electron acceptance, calibration or performance measurement ran. Installed 0.8.0 remains unchanged.

## Files

- `packages/contracts/src/models/decisions.ts`
- `packages/contracts/src/models/decisions.test.ts`
- `packages/contracts/src/models/index.ts`
- `packages/contracts/src/models/schema.ts`
- `packages/contracts/src/rpc/protocol.ts`
- `packages/platform-service/src/models/decision-provider.ts`
- `packages/platform-service/src/models/decision-provider.test.ts`
- `packages/platform-service/src/models/decision-service.ts`
- `packages/platform-service/src/models/decision-service.test.ts`
- `packages/platform-service/src/models/router.ts`
- `packages/platform-service/src/models/router.test.ts`
- `packages/platform-service/src/models/completion-service.ts`
- `packages/platform-service/src/models/models.integration.test.ts`
- `packages/platform-service/src/agents/agent-tools.ts`
- `packages/platform-service/src/agents/agent-runtime.ts`
- `packages/platform-service/src/agents/agent-runtime.test.ts`
- `packages/platform-service/src/profile/migrations.ts`
- `packages/platform-service/src/profile/migrations.test.ts`
- `packages/platform-service/src/settings/definitions.ts`
- `packages/platform-service/src/settings/registry.test.ts`
- `packages/platform-service/src/tasks/task-service.ts`
- `packages/platform-service/src/service.ts`
- `packages/platform-service/src/service.integration.test.ts`
- `packages/theia-control-room/src/browser/models-widget.tsx`
- `packages/theia-control-room/src/browser/audit-widget.tsx`
- `packages/theia-control-room/src/browser/audit-widget.test.tsx`
- `packages/theia-control-room/src/common/models-view-model.ts`
- `packages/theia-control-room/src/common/models-view-model.test.ts`
- `packages/theia-control-room/src/common/control-room-protocol.ts`
- `packages/theia-control-room/src/node/control-room-service.ts`
- `scripts/generate-system-reference.cjs`
- `scripts/generate-documentation-inventory.cjs`
- `docs/TECHNICAL_ARCHITECTURE.md`
- `docs/DEVELOPMENT_PLAN.md`
- `docs/SKILLS_AGENTS_AND_TOOLS.md`
- `docs/STATUS.md`
- `docs/USER_GUIDE.md`
- `docs/OPEN_DECISIONS.md`
- `docs/API_REFERENCE.md`
- `docs/SETTINGS_REFERENCE.md`
- `docs/reference/rpc-schemas.json`
- `docs/reference/settings-schemas.json`
- `docs/reference/DOCUMENTATION_INVENTORY.md`
- `docs/reference/documentation-inventory.json`
- `docs/changes/2026-10-04-bounded-decision-model-integration.md`

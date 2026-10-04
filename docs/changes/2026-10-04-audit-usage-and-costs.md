# Separate model usage from tool charges in Audit and History

**Release:** 0.8.0

**Impact:** minor

**Category:** Changed

## Summary

Improve Audit visibility and cost evidence instead of treating zero-valued tool charges or absent model pricing as complete model spending.

## Details

- The original Audit view displayed tool-call costs but omitted model usage stored elsewhere. Unknown model pricing could also be coerced to zero, and four-decimal formatting hid sufficiently small positive amounts. Separate model usage, tool activity and Project events into focused views.
- Add searchable activity cards and a selected-record inspector with readable evidence fields, token/cache counters and bounded structured event context. Keep raw redacted records in optional disclosures and preserve paging, Project scope and redacted export.
- Show known estimates separately from partial, unavailable and unverifiable historical pricing. Genuine priced-zero remains distinct from unavailable pricing. Totals describe the loaded, filtered model page, not all-time spend, invoice reconciliation or independent tool-plus-model totals that double-count the same request.
- Record direct/routed/streamed completion attempts in a shared usage ledger, including unknown failed attempts; preserve nullable cost evidence and honest legacy interpretation. Old routed self-outcomes without confidence metadata are exposed as unverified, not re-priced from today's model settings. Pre-ledger direct completions cannot be reconstructed from absent records. No real provider calls, user credential changes, fabricated historical prices, version changes or local installation update were performed by this source-fix task.
- Preserve OpenAI/Anthropic cache counters and distinguish observed zero from omitted provider counts across complete/streaming responses. Missing or one-sided usage cannot claim known-free billing. Cache portions without rates remain unknown/partial. Numeric-only sanitized model projections avoid the generic redactor mistaking token counts for credentials, while user-controlled labels/request identifiers remain sanitized.
- Reject conflicting Project identifiers before routing/provider I/O so usage cannot be attributed to another Project. Daily exploration also considers the next candidate's known estimate and remaining allowance, falls back to baseline routing for unknown/oversized candidates, and preserves deliberately free candidates. This does not turn estimates into a provider-invoice or absolute-dollar guarantee.
- Monetary task accumulators/budget comparisons track known amounts; unknown pricing cannot establish a real hard-dollar ceiling. Token/turn controls and existing budget policy are not replaced by this UI change. Configure model rates before relying on monetary estimates; subscriptions, hardware costs and provider invoices remain outside these totals.

## Validation

- New Audit render tests failed against the original view because it had no model usage section or pricing-state presentation. Focused UI tests passed after implementation, including positive sub-cent costs, explicit free calls, unavailable and legacy-unverified pricing, and structured task text.
- Backend regressions were run red before fixes. Focused initial tests passed 45 with six environment-dependent skips; reviewed-edge-case provider/Project/exploration regressions passed 31. Existing profile/Project databases add confidence/ledger storage without fabricating historical prices. Prepared-completion mocks and update/lifecycle fixtures were corrected to use the new router seam and declared current migrations rather than obsolete hard-coded schema counts.
- Full repository validation passed all 33 tasks (22 cached, 11 executed). It initially caught stale migration/update-fixture expectations and a prepared-route mock missing its context/new ledger method; updated only those fixtures and reran successfully. Turbo emitted a cache I/O disk-space warning despite all successful task exits; later browser verification used the generated outputs.
- Full UI suite passed 93 tests in 25 files. The final real-service browser smoke passed seven checks with no renderer errors: tiny priced `$0.0000022`, unknown-price null and explicit-free zero remain distinct; goal content and Audit inspectors fit desktop/narrow windows. Actual-source screenshots/report are `docs/images/audit-detail-2026-10-04/`; ignored evidence is `.turbo/audit-detail-ui/1791096552100/`.
- No paid-provider/invoice, complete historical accounting, or hard-dollar-budget acceptance is claimed. The source-fix stage left the installed 0.7.0 app/profile intact; the subsequent user-authorized [local 0.8.0 deployment](../changes/2026-10-04-local-0.8.0-deployment.md) separately records packaged/installed verification and commit/push.

## Files

- `packages/theia-control-room/src/browser/audit-widget.tsx`
- `packages/theia-control-room/src/browser/audit-widget.test.tsx`
- `packages/theia-control-room/src/common/cost-display.ts`
- `packages/theia-control-room/src/common/cost-display.test.ts`
- `packages/theia-control-room/src/browser/style/workstation.css`
- `scripts/audit-detail-ui-smoke.cjs`
- `docs/changes/2026-10-04-audit-usage-and-costs.md`
- `docs/CONTROL_ROOM_HANDBOOK.md`
- `docs/USER_GUIDE.md`
- `docs/MODEL_ROUTING_GUIDE.md`
- `docs/API_REFERENCE.md`
- `docs/reference/rpc-schemas.json`
- `packages/contracts/src/models/schema.ts`
- `packages/contracts/src/rpc/protocol.ts`
- `packages/contracts/src/tools/schema.ts`
- `packages/platform-service/src/agents/agent-runtime.ts`
- `packages/platform-service/src/agents/agent-tools.ts`
- `packages/platform-service/src/agents/agent-tools.test.ts`
- `packages/platform-service/src/board/board-maintenance-service.ts`
- `packages/platform-service/src/workers/board-maintenance-handlers.ts`
- `packages/platform-service/src/workers/types.ts`
- `packages/platform-service/src/models/completion-service.ts`
- `packages/platform-service/src/models/router.ts`
- `packages/platform-service/src/models/router.test.ts`
- `packages/platform-service/src/models/models.integration.test.ts`
- `packages/platform-service/src/models/completion-service.test.ts`
- `packages/platform-service/src/service.integration.test.ts`
- `packages/platform-service/src/models/providers/anthropic.ts`
- `packages/platform-service/src/models/providers/http-utils.ts`
- `packages/platform-service/src/models/providers/openai-compatible.ts`
- `packages/platform-service/src/models/providers/providers.test.ts`
- `packages/platform-service/src/profile/migrations.ts`
- `packages/platform-service/src/profile/migrations.test.ts`
- `packages/platform-service/src/projects/migrations.ts`
- `packages/platform-service/src/service.ts`
- `packages/platform-service/src/tools/tool-broker.ts`
- `packages/platform-service/src/tools/tool-broker.integration.test.ts`
- `packages/platform-service/src/tools/tool-registry.ts`
- `packages/platform-service/src/tools/tool-store.ts`
- `packages/platform-service/src/mcp/connection-manager.ts`
- `packages/platform-service/src/mcp/connection-manager.sampling.test.ts`
- `packages/platform-service/src/plugins/plugin-host.ts`
- `packages/platform-service/src/plugins/plugin-service.integration.test.ts`
- `docs/images/audit-detail-2026-10-04/formatted-goal-desktop.png`
- `docs/images/audit-detail-2026-10-04/formatted-goal-narrow.png`
- `docs/images/audit-detail-2026-10-04/model-cost-desktop.png`
- `docs/images/audit-detail-2026-10-04/model-cost-narrow.png`
- `docs/images/audit-detail-2026-10-04/tool-history-desktop.png`
- `docs/images/audit-detail-2026-10-04/event-history-desktop.png`
- `docs/images/audit-detail-2026-10-04/capture-report.json`

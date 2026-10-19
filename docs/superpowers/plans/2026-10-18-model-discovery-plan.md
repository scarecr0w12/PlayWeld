# Model discovery and metadata implementation plan

> **For agentic workers:** Use superpowers:executing-plans; independently owned provider enrichment and UI work may run in parallel after interface agreement.

**Goal:** Secure provider setup, actual discovery, explicit model selection and reliable dynamic metadata with strict routing budgets.
**Architecture:** Existing contracts/SQLite registry own durable selection and availability. Provider APIs supply availability and published fields; a credential-free maintained catalog fills documented gaps, retaining per-field provenance and stale state. Theia remains a client.
**Tech Stack:** Existing strict TypeScript/CommonJS, TypeBox, node:sqlite seam, Vitest and Theia; no new dependencies.
**Spec:** ../specs/2026-10-18-model-discovery-design.md

## Global constraints

Preserve existing credentials, manual overrides, enabled selections and unrelated projects. No automatically enabled discovery results. Unknown price cannot pass a strict monetary constraint without a safe bound. Keep current product version pending; no push/deployment/installer replacement. Test budget is $1 aggregate.

## Review focus

Provider identity mismatches and arbitrary snapshot aliases must not borrow metadata. Failed/truncated discovery must not disable/remove history. Explicit user deselection survives refresh. Zero/negative/non-USD prices require validated handling. Cached fields retain original timestamps on failures.

## Tasks

- [x] Add optional field freshness and model availability/last-seen contracts, RPC result diagnostics and additive persistence; regression-test old records and schema validation.
- [x] Implement provider-owned dynamic metadata enrichment with exact provider/model matches, bounded credential-free fetch, cache/TTL, failure retention, provider precedence and sourced fallback; fixture-test malformed data, prices, failures and key isolation.
- [x] Repair registry selection semantics and successful-discovery reconciliation; test preview has no mutations, fresh models disabled by default, explicit selections enabled, overrides and selections retained, removals unavailable, reappearance restored.
- [x] Reject unavailable models and unknown-price strict budgets; validate upper-bound token/cost constraints and preserve unrestricted no-budget behavior where explicitly allowed. Run focused router/dispatch regressions.
- [x] Update Models UI discovery selection and refresh diagnostics, availability and metadata freshness/source messaging; test view-model helpers and actual UI controls.
- [x] Build and verify the isolated native UI with a fake provider.
- [ ] Real Morrowfen generation, reload and knowledge linkage remain unverified. Do not run paid requests as part of source commit preparation; per-dispatch checks do not enforce an aggregate concurrent Swarm dollar cap.
- [x] Write permanent work record, regenerate changelog and complete required checks. Report actual passing/failed/skipped evidence and any native/runtime blockers. Do not deploy or replace installers.

## Validation checkpoint

Source-built Electron passed six discovery/selection/refresh/provenance/error-retention checks using an isolated fake provider. All 33 repository validation tasks passed; platform-service 631 tests passed and six skipped. Formatting, changelog, diff whitespace and Markdown links passed. Real Morrowfen generation and persistence/knowledge acceptance remain unverified ($0 spent); per-dispatch cost checks do not reserve aggregate concurrent Swarm spend. Installed 0.21.0 was not replaced or deployed.

## Source commit follow-up

The user subsequently authorized finishing, committing and pushing the existing model fixes and 0.21.1 preparation on the feature branch. This supersedes the original no-push constraint for that scoped source branch only. No automatic merge, tag, release publication or installed-app replacement is part of this follow-up.

# Repair explicit model discovery, metadata and budget dispatch

**Release:** 0.21.1

**Impact:** patch

**Category:** Fixed

## Summary

Model discovery records actual provider availability, requires explicit enabling, and refreshes supported metadata from provider APIs with a credential-free maintained catalog fallback. The Models UI shows availability, source, freshness, warnings and unknown values. Strict monetary routing rejects missing or unusable prices and rechecks a conservative request bound before dispatch.

## Details

- Discovery preview is read-only; new records are disabled until selected. Refresh preserves existing enabled choices and manual overrides. Successful full lists mark missing models unavailable without deleting their history, and restore reappearing records even while selecting another model. Failed or malformed responses do not reconcile removals. Catalog-only suggestions no longer masquerade as available provider IDs.
- Provider adapters validate list shape and metadata, including Anthropic pagination. A bounded, credential-free models.dev catalog request fills exact provider/model matches only, with original retrieval time, source URL, confidence, expiry, stale-cache fallback and explicit warnings. Provider facts take precedence; non-USD/tiered/incompatible prices remain unknown instead of receiving a misleading flat fallback. USD per million token units are distinct from account rate limits. No dependency changes.
- Automatic metadata is cleared transactionally when an account endpoint changes, retaining manual overrides, selections, pools and history. In-flight discovery from an old endpoint is rejected. Older same-priority facts cannot overwrite newer values or their provenance.
- Routing excludes unavailable models and unknown/stale/expired prices under a monetary constraint. Dispatch rechecks enabled status, availability, original required capabilities, request features, current token limits, remaining task tokens and conservative worst-case dollar cost before accessing credentials. Embeddings also recheck availability and capability. Input reservations intentionally use advertised model capacity, which can reject small tasks with large-context models. This is a per-dispatch bound, not an aggregate concurrent Swarm dollar reservation.
- Additive migration 19 stores availability and last-seen time; existing enabled preferences remain intact with unknown availability until discovery. Optional contract fields preserve older clients. Prepared for the user-requested 0.21.1 patch release: this repairs existing model configuration and routing behavior; contract additions are optional and storage changes are additive. The 0.21.1 source preparation does not publish a release or replace the installed 0.21.0 binary.
- Discovery UI replaces Add all with explicit selection checkboxes, separates metadata refresh from enabling, preserves pending choices on errors, and displays sources, freshness, unavailable states and unknown prices. Credentials continue through the existing secure account flow; no saved keys were extracted or changed.
- Added focused provider/catalog, registry lifecycle/endpoint, router/dispatch and UI regressions. Existing integration fixtures now explicitly select fake models; intentionally unpriced audit dispatch asserts strict rejection. The multi-turn fake model task token ceiling accommodates its conservative capacity reservation; monetary budgets are unchanged.
- Refresh the generated API reference and RPC schema snapshot for the optional discovery result and model metadata fields, and the documentation inventories for the five additional model test files. These inventories describe source coverage rather than live acceptance.
- Design and implementation plan are retained in docs/superpowers. A fresh reviewer reproduced five defects before fixes; focused re-review confirms those reproductions pass after fixes.

## Validation

- Fresh source-commit verification on 2026-10-19: `npx --no-install turbo run build typecheck lint test --concurrency=1 --force` passed all 33 tasks with zero cache hits (7m49s), including 121 service test files / 631 passed and six skipped, 28 Theia test files / 133 passed, and both application builds. A read-only review of the final source found no Critical or Important regressions. Reviewed application-source fingerprints remained unchanged during validation.
- Supplemental commit checks passed: nine workspace and lockfile/internal-version comparisons at 0.21.1, release-version validation, generated API/schema and test-inventory freshness after regeneration, documentation evidence integrity, 13 change-tracking tests, nine cache-maintenance tests, repository formatting, work-record coverage and Markdown links. Candidate-file inspection found no runtime binaries, profile databases or credential-like literals; this is a scoped inspection, not a security certification. No paid-provider request or additional native UI acceptance was run during commit preparation.

- Focused registry lifecycle/catalog tests: 14 passed; additional in-flight discovery test brings lifecycle to 8 passing tests.
- Provider/catalog integrity tests: 73 passed across six files; platform typecheck and scoped ESLint/Prettier passed.
- Endpoint/router/completion regressions: 41 passed; scoped ESLint passed.
- Theia tests: 133 passed across 28 files; typecheck, scoped lint and formatting passed.
- Updated integration fixtures: 13 passed and one existing Windows skip across model/plugin/Swarm files; another four agent/board/MCP tests passed. Parent knowledge/decision/migration fixtures: 27 passed across four files.
- First full service run: 597 passed, 17 failed and six skipped while fixes/fixture updates were still in progress. First repository-wide run stopped on a transient Windows lock of the existing AppContainerHost.exe build output; 24 tasks completed. No lock-owning process remained when inspected; the retry completed successfully.
- Final `npx turbo run build typecheck lint test`: 33 tasks succeeded, including desktop/browser app builds; platform-service 121 files / 631 tests passed, six skipped. Logs retained outside the repository in the Codex task workspace (`model-full-check-retry.log`). `npm run format:check`, `npm run changelog:check -- --base HEAD`, `git diff --check` and `bash scripts/check-links.sh` passed (`All links OK`).
- Source-built Electron native UI passed six checks with an isolated profile and fake provider: adding a disposable account, discovering two unchecked models, enabling only one, retaining selection on metadata refresh, rendering availability/limits/pricing/provenance/unknowns and retaining discovery/selection after a provider failure. Receipt and window-only captures: external Codex task workspace `model-native-direct-1792368192500/result.json`, `01-discovery-unchecked.png`, `02-explicit-selection.png`, `03-model-provenance.png`, `03b-field-sources-freshness.png`, `04-refresh-error-retained.png` and `model-details.txt`. Native driving used Electron BrowserWindow after local CDP automation was unreliable. This is native source-build/fake-provider evidence; the installed desktop binary was not replaced.
- Real Morrowfen generation, reload and knowledge linkage are unverified. No paid requests have run ($0 of the authorized $1 aggregate test budget). The present per-dispatch bound does not reserve aggregate concurrent Swarm expenditure; do not claim that this proves the total $1 story-test cap. Source/fixture evidence does not verify the installed desktop flow.

## Files

- `CHANGELOG.md`
- `docs/API_REFERENCE.md`
- `docs/reference/rpc-schemas.json`
- `docs/reference/DOCUMENTATION_INVENTORY.md`
- `docs/reference/documentation-inventory.json`
- `docs/superpowers/plans/2026-10-18-model-discovery-plan.md`
- `docs/superpowers/specs/2026-10-18-model-discovery-design.md`
- `packages/contracts/src/models/schema.ts`
- `packages/contracts/src/rpc/protocol.ts`
- `packages/platform-service/src/agents/agent-approval.integration.test.ts`
- `packages/platform-service/src/agents/agent-tools.test.ts`
- `packages/platform-service/src/agents/agent-tools.ts`
- `packages/platform-service/src/board/board-maintenance.models.integration.test.ts`
- `packages/platform-service/src/change/swarm-coordination.integration.test.ts`
- `packages/platform-service/src/knowledge/knowledge.integration.test.ts`
- `packages/platform-service/src/mcp/connection-manager.sampling.integration.test.ts`
- `packages/platform-service/src/models/completion-service.test.ts`
- `packages/platform-service/src/models/completion-service.ts`
- `packages/platform-service/src/models/decision-service.test.ts`
- `packages/platform-service/src/models/endpoint-metadata.test.ts`
- `packages/platform-service/src/models/maintained-catalog.test.ts`
- `packages/platform-service/src/models/maintained-catalog.ts`
- `packages/platform-service/src/models/model-catalog.ts`
- `packages/platform-service/src/models/model-discovery-lifecycle.test.ts`
- `packages/platform-service/src/models/model-registry.test.ts`
- `packages/platform-service/src/models/model-registry.ts`
- `packages/platform-service/src/models/models.integration.test.ts`
- `packages/platform-service/src/models/providers/anthropic.ts`
- `packages/platform-service/src/models/providers/catalog-boundary.test.ts`
- `packages/platform-service/src/models/providers/google-gemini.ts`
- `packages/platform-service/src/models/providers/index.ts`
- `packages/platform-service/src/models/providers/metadata-integrity.test.ts`
- `packages/platform-service/src/models/providers/openai-compatible.ts`
- `packages/platform-service/src/models/providers/openai-providers.ts`
- `packages/platform-service/src/models/providers/pricing-metadata.ts`
- `packages/platform-service/src/models/providers/provider.ts`
- `packages/platform-service/src/models/router.test.ts`
- `packages/platform-service/src/models/router.ts`
- `packages/platform-service/src/plugins/plugin-service.integration.test.ts`
- `packages/platform-service/src/profile/migrations.test.ts`
- `packages/platform-service/src/profile/migrations.ts`
- `packages/theia-control-room/src/browser/models-widget.test.tsx`
- `packages/theia-control-room/src/browser/models-widget.tsx`
- `packages/theia-control-room/src/common/control-room-protocol.ts`
- `packages/theia-control-room/src/common/models-view-model.test.ts`
- `packages/theia-control-room/src/common/models-view-model.ts`
- `docs/changes/2026-10-18-model-discovery-metadata.md`

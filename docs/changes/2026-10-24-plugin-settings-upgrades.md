# Complete declarative plugin settings upgrades

**Release:** Unreleased

**Impact:** minor

**Category:** Added

## Summary

Complete WP5's deferred plugin-setting migration path using the existing WP12 lifecycle. Users can review and install a higher plugin version without uninstalling and losing settings; service-owned declarative transforms preserve scope precedence, fail closed on invalid data, and checkpoint each durable store independently.

## Details

- Extend the existing manifest migration entries with optional `rename`, `map-values` and `remove` operations and optional scope selectors. Legacy description-only entries and empty arrays remain valid. Export a schema-versioned persisted upgrade-plan contract; do not add an executable migration hook or a parallel plugin format. Validate forward/unambiguous chains, owned keys, collisions, exact value mappings, resulting schemas and scope eligibility. Unknown or incompatible values are preserved behind an actionable error rather than silently dropped.
- Add a service-owned migration component integrated with SettingsService resolution, enumeration, set/import and plugin lifecycle. Profile migration 20 adds history/checkpoint persistence; Project migration 14 adds per-plugin checkpoints. Both are additive and retain existing setting rows. Profile activation, its plan, platform overrides and version checkpoint commit together. Project overrides/checkpoints migrate atomically on access; session overrides convert in memory and remain ephemeral. Import previews validate transforms without applying settings/checkpoint changes.
- Keep import migration work limited to the selected scope and imported setting owners. A targeted regression exposed that a platform import carrying a Project ID could otherwise migrate that Project as a side effect; restrict it and verify the Project's old rows remain untouched. Importing unrelated builtin settings also does not force an unrelated plugin's pending migration.
- Preserve migration history for Projects that were unavailable or skipped versions. Use a complete package-declared chain when a restored Project arrives in a fresh profile without local history. Missing chains or invalid results fail without discarding original overrides. The mechanism is per-store transactional, not a global crash-atomic transaction over every registered Project. Existing unavailable-Project uninstall cleanup limitations are documented separately.
- Enforce actual setting ownership when plugin IDs contain dots. Prefix-only matching would let a parent-like ID include a different plugin's namespace. Protect current declarations and other plugins' historical keys, reject cross-owner operations, and delete only the upgrading plugin's owned rows. Add a parent/child-ID regression covering migration and uninstall without touching the child plugin's value.
- Apply the same owner-based selection to worker initialization and settings-change delivery. A worker receives only definitions registered to its own plugin; accessing one plugin no longer attempts unrelated plugins' pending migrations. This closes the corresponding prefix-based configuration-delivery mismatch instead of only protecting database writes.
- Extend the service's existing `plugin/install` path to higher versions; retain exact-capability review, compatibility checks, reverse dependent-plugin constraints, enabled state, Project enablement and secret references. Identical bytes/version are idempotent; same-version republishing and downgrades remain rejected. Stage immutable version directories, preflight before stopping workers, revalidate after stopping, activate synchronously after the profile commit, and retain old files until uninstall. Failed preparation/commit cleans only the candidate; a committed active installation is not deleted by a later activation error.
- Serialize install/uninstall/enable/disable/start/stop and auto-start lifecycle mutations. Stop old workers before activation and attempt restart for previously running Projects; worker failures remain visible. Native worker integration proves a changed PID and tool output using the migrated value; invalid subsequent upgrades leave the running worker, settings and installed version intact. Uninstall removes retained version directories and reachable owned settings/history while preserving usage/audit records.
- Update the Plugins UI to identify upgrades, expose inspection/migration warnings and an expandable review of version transitions, descriptions and exact declarative operations, and report upgrade completion. Settings subscribes to plugin changes so replaced definitions refresh. Add a rendered component test for the upgrade action and warnings. No new RPC method, protocol version, builtin setting or dependency is introduced; generated RPC schema exports now include the compatible optional manifest field.
- Reconcile WP5/STATUS and W06/U03/S04 in place, link the engineering default in architecture/contracts and the decision log, and add author guidance with migration examples, scope behavior, failure/recovery limits, platform compatibility and pending-release qualification. Preserve user-confirmed requirements and all unrelated remaining work. Correct the extension cookbook's stale Windows-isolation prerequisite using scoped existing/native evidence.
- Compatibility and migration: product version stays 0.22.0 while pending. Existing plugins without new operations remain compatible. Existing profile/Project stores acquire additive tables on migration; ordinary user data was not opened or upgraded in this session. Older applications must not be used against newer store schemas; normal backup/restore and release compatibility rules apply. Impact `minor` reflects a compatible feature and optional manifest expansion; release preparation must choose a new version before packaging. Arbitrary executable/data migrations, plugin signatures/egress policy and release/installer acceptance remain open.
- Preserve all uncommitted security/documentation work from the preceding session steps. This record owns only the plugin upgrade feature and its evidence; prior records remain permanent sources for their separate changes.

## Validation

- Red contract test failed on the old schema because migration operations were unsupported. After the contract change, the RPC upgrade test passed for renamed platform/Project/session values and durable restart behavior. Added unsupported-operation/schema rejection, skipped-version replay, restored-profile fallback, collision/invalid-value/foreign-key/missing-chain rejection, checkpoint-write rollback, nonmutating preview and explicit scope-removal tests.
- Focused service/installer/settings/profile checks passed, including real sandboxed worker upgrade/restart/tool output and failed-upgrade preservation. Focused UI test initially exposed incomplete mock fixture data; corrected the fixture and all three catalog layout tests passed. These fixture corrections did not require weakening product assertions. A later rendered regression also demonstrated that a warning alone did not display the migration operations; add the expandable review and verify its description and source/destination keys. All three catalog tests pass. The final outcomes follow.
- The new scoped-import assertion failed during a full run that began before its correction; the final source then passed build/typecheck/lint and 35 focused service tests (one existing skip). One concurrent broad-build attempt encountered a locked native AppContainerHost executable while worker integration was running. Wait for the owned worker tests to finish and rerun verification without changing product behavior or assertions.
- Final frozen-source `npx turbo run build typecheck lint test --concurrency=1` passed all 33 tasks (25 cached); the preceding complete run passed all 33 (24 cached), with 925 passed / 7 skipped tests across 182 files. Platform service: 711 passed / 6 skipped across 130 files; contracts: 75 passed; Theia extension: 134 passed. Existing app-shell lint/typecheck/test scripts say `skip`; this gate also built the actual Electron/browser applications and checked the extension/service code. Logs: `.turbo/plugin-settings-upgrade-quality-complete.log` and `.turbo/plugin-settings-upgrade-quality-frozen.log`.
- Final Puppeteer acceptance against the built browser application passed five checks with zero renderer errors: inspect v2 while v1 remains active; display migration descriptions and exact operations; accept the real upgrade and convert the stored override; refresh an already-open Settings view to the renamed field/value; renderer health. Corrected harness readiness, nested navigation-label selectors and an initially stale built asset before this final run. Report and screenshots: `.turbo/plugin-settings-upgrade-ui/report.json`, `upgrade-review.png`, `upgraded-settings.png`; run log `.turbo/plugin-settings-upgrade-ui-frozen.log`. This is scoped automated browser/native-worker evidence, not installer or personal product acceptance. The screenshot retains existing Settings navigation layout limitations; no broader UI-layout acceptance is claimed.
- Stopped only the owned browser server after checking port ownership; port 3128 is free, and the disposable service reports `not running`. Retained ignored fixtures/evidence. System-reference and documentation-inventory checks, documentation evidence integrity, release-version check (0.22.0), root Prettier formatting, Markdown links and Git whitespace checks passed. Regenerated the changelog and verified changed-path coverage against HEAD.
- Existing database seam, migrations and supported authenticated RPC/CLI interfaces are used throughout. Native tests use disposable profiles/Projects; no ordinary profile, credential, provider, engine or paid external service is used for this feature. The broader package suite may execute its existing disposable Blender/Qdrant fixtures; that is not full integration acceptance.

## Files

- `packages/contracts/src/plugins/schema.ts`
- `packages/contracts/src/plugins/plugins.test.ts`
- `packages/platform-service/src/profile/migrations.ts`
- `packages/platform-service/src/profile/migrations.test.ts`
- `packages/platform-service/src/projects/migrations.ts`
- `packages/platform-service/src/settings/plugin-settings-migrations.ts`
- `packages/platform-service/src/settings/registry.ts`
- `packages/platform-service/src/settings/settings-service.ts`
- `packages/platform-service/src/settings/settings-service.test.ts`
- `packages/platform-service/src/plugins/plugin-installer.ts`
- `packages/platform-service/src/plugins/plugin-host.ts`
- `packages/platform-service/src/plugins/plugin-service.ts`
- `packages/platform-service/src/plugins/plugin-service.integration.test.ts`
- `packages/theia-control-room/src/browser/plugins-catalog-widget.tsx`
- `packages/theia-control-room/src/browser/plugins-catalog-widget.test.tsx`
- `packages/theia-control-room/src/browser/settings-widget.tsx`
- `docs/TECHNICAL_ARCHITECTURE.md`
- `docs/SKILLS_AGENTS_AND_TOOLS.md`
- `docs/PLATFORM_DESIGN.md`
- `docs/DEVELOPMENT_PLAN.md`
- `docs/STATUS.md`
- `docs/OPEN_DECISIONS.md`
- `docs/EXTENSION_COOKBOOK.md`
- `docs/reference/rpc-schemas.json`
- `docs/changes/2026-10-24-plugin-settings-upgrades.md`

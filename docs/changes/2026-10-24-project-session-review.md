# Review project, repository controls, security and completion gaps

**Release:** Unreleased

**Impact:** none

**Category:** Maintenance

## Summary

Investigation-only review of PlayWeld at `7ccb07580d82164d16f63c6ce5404b81a754f1e6`, covering current repository settings, security signals and source boundaries, documentation consistency, incomplete features and improvement opportunities. No product repair or external configuration change is delivered.

## Details

- Add `docs/PROJECT_REVIEW_2026-10-24.md` as the dated review artifact. Record the initially clean checkout and matching GitHub main, current source/local-record/public-release distinctions, independent offline architecture/security review, and partial security coverage. Preserve ordinary profiles, private overrides, credentials, existing work and all historical release records.
- Identify a source-backed Windows asset-opening command-interpreter boundary failure, independently reviewed by the baseline auditor and parent. Record the realistic filename-control/user-action prerequisites, medium severity, remediation invariant and missing adversarial coverage without publishing a working payload. Full source evidence is retained in the private Codex Security scan; no payload was executed and no fix is claimed.
- Refresh full and production-only npm advisory snapshots and live GitHub Dependabot, CodeQL and secret-scanning counts. Distinguish package-level propagation from independent exploit counts, retain CodeQL counterevidence and Drive query-escaping robustness work, and recommend compatibility-preserving dependency review rather than incompatible automatic fixes.
- Verify active main ruleset, Actions allowlist and external-contributor policy, restricted default token permissions, security features and CodeQL configuration through read-only APIs. Separate already-live settings from proposed security-policy/Actions-update files in concurrent PR #8, and record existing dependency PR check failures without taking ownership of or diagnosing their changes. No setting, alert, issue, PR or release was changed.
- Document contradictory live-provider and hosted-CI claims in status/plan against later evidence, and distinguish old review receipts from current status. Generated reference freshness is separate from semantic prose correctness. Do not alter confirmed decisions or work-package statuses in this investigation.
- Identify repeated subprocess creation and heading rescans in the shell Markdown link checker as review-tool overhead. Attempt it through Git Bash and WSL, stop the task-owned checks after extended execution without results, and validate the same full Markdown scope/rules with a read-only cached Python implementation. No checker source was changed.
- Inventory remaining release/recovery, plugin isolation/trust, provider/routing/spend, engine/DCC/assets/MCP/A2A, backup/state, swarm/canon, product/UI/accessibility and quality/performance obligations. Preserve user-owned decisions and technical dependency ordering in the plan. Record explicit app check skips and targeted maintainability opportunities without broad refactoring.
- Compatibility and migration: no product source, dependency, package version, persisted schema, RPC contract or runtime configuration changes; no migration required. Impact `none` reflects a documentation/investigation task.

## Validation

- Initial full `npx turbo run build typecheck lint test --concurrency=1`: 33/33 successful, all cached. `npx turbo run test --force --concurrency=1`: 15/15 successful, zero cached, 888 tests passed and seven skipped across 180 test files. Platform service: 679 passes/six skips; extension: 133 passes; contracts: 71 passes; extractor: one pass/one skip; client: two passes; SDK/sample: one each. Capability/OS/symlink-dependent cases and unavailable native Godot remain skipped; managed native Qdrant ran. Electron's placeholder test task remains distinct from executed application tests.
- Before report creation, `npm run format:check`, generated system-reference/inventory checks, documentation-evidence check and release-version check passed. Release version remains 0.22.0. Fresh npm audit commands exit nonzero for advisories, not a passing security gate.
- GitHub readback and independent static source review performed; static traces are not runtime exploit, installed isolation, or production acceptance evidence. Completed and sealed Codex Security scan `5d1d271e-6078-48a7-8f6d-d9f0e64dba6f` records one medium finding, nine reviewed surfaces and partial repository coverage with explicit follow-up. Its original-snapshot warning reflects the added review documentation/changelog; application source did not change. Local quality/test/format/audit logs are retained under ignored `.turbo/session-review-2026-10-24-*`.
- Final `npm run format:check`, `npm run changelog:update`, `npm run changelog:check -- --base HEAD` and `git diff --check` passed. The required `scripts/check-links.sh` was attempted under Git Bash and WSL but stopped after extended execution without a result; this is not a passing shell-check claim. A read-only cached Python equivalent checked the same fence/link/heading-slug rules across 351 Markdown files and 1,455 relative links: zero errors. Later prose edits introduced no additional links.
- Not run: dependency reinstallation, fresh Linux/desktop/browser/engine/DCC/provider/package/installer acceptance or exploit payload. Existing native dependencies and ordinary runtime data were preserved. Whole-repository line-by-line security review remains incomplete.

## Files

- `docs/PROJECT_REVIEW_2026-10-24.md`
- `docs/changes/2026-10-24-project-session-review.md`
- `CHANGELOG.md`

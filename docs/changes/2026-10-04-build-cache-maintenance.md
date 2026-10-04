# Bound build-cache growth and separate test artifacts

**Release:** 0.9.0

**Impact:** none

**Category:** Maintenance

## Summary

Exclude Electron release packages from build caching, scope bundled-skill inputs to the service build, and provide conservative cache and artifact retention tooling.

## Details

- Measured 115.075 GiB in the local Turbo cache. Inspected a 4.28 GiB archive manifest: ordinary desktop builds were caching multiple historical Electron installer/unpacked-release directories from `apps/control-room/dist`. Override desktop build outputs to cache only `lib` and `src-gen`; leave ordinary package `dist` outputs and actual installer files intact.
- Replace global skills invalidation with service-build inputs for the exact curated bundled skills. Preserve default source inputs, downstream dependency invalidation, and the service test's existing dependency on its own build; unrelated development skills no longer invalidate every task. A regression test checks the curated names against the authored list and preserves that test prerequisite.
- Add `npm run cache:prune`: dry-run by default, with `--apply` to delete recognized cache archives and their manifest/metadata as groups, oldest-first, targeting 5 GiB and 30-day retention. A one-hour write grace protects recent work; the byte target is soft when recent entries exceed it. Unknown files, linked roots, and legacy evidence/profile directories are not deleted. Locked or concurrently changed cache groups are skipped. Successful root `npm run build` and `npm run build:apps` invoke cache pruning automatically; direct Turbo/workspace commands do not invoke these root npm hooks.
- Add opt-in `--artifacts` retention for timestamped runs under `.artifacts`: preserve the newest three runs per suite and all runs with activity in the last 30 days. Fixed project/profile/engine directories and existing `.turbo` evidence remain untouched. Preview candidates before applying, and stop smoke-test processes before artifact deletion. Example: `npm run cache:prune -- --artifacts`, followed by the same command with `--apply` after reviewing its output. No artifact deletion was performed for this task.
- Move repository-owned smoke, documentation-capture, and engine-acceptance default paths into ignored `.artifacts`; update their related fixture paths and CI browser-evidence upload destination. Existing environment/CLI output overrides remain supported. Historical evidence references and files remain in their original locations; a new engine baseline is needed before extending acceptance fixtures at the new default path.
- Applied a one-time cache reset using `npm run cache:prune -- --apply --max-gib=0`, preserving the one-hour grace: 1,126 old groups removed, reported cache size reduced from 115.08 GiB to 0.12 GiB. Builds will regenerate needed results with the corrected output configuration.
- Add a cross-platform Node regression-test command and execute it in CI. Application APIs, persisted state, installers, and unrelated in-progress work are unchanged by this task. Concurrent release preparation assigned this record to 0.9.0; that version change is outside this maintenance task.
- Correct root build-filter quoting to use shell-portable double quotes: the previous single quotes were passed literally by Windows npm's shell and selected zero packages. Root build hooks now follow actual package/application builds.

## Validation

- `npm run test:cache-maintenance`: nine regression tests passed, covering dry-run/apply, grouped oldest-first pruning, age retention, recent-write/sidecar protection, legacy/unknown-data preservation, linked-root/content refusal, artifact retention, installer exclusion, and curated service inputs.
- `npx turbo run build --filter=@gamecrafter/control-room --dry`: installed Turbo 2.11.2 resolved desktop outputs to `lib/**` and `src-gen/**`, excluding installer `dist`.
- `node --check` on changed CommonJS scripts: passed.
- Final `npx turbo run build typecheck lint test --output-logs=errors-only`: 33 tasks succeeded, including five cache hits. No claim is made that all checks executed fresh.
- `git diff --check`, `bash scripts/check-links.sh`, and `node scripts/check-documentation-evidence.cjs`: passed. The evidence checker validates inventory/report/file integrity, not live acceptance.
- `npm run build`: seven package/dependency builds executed successfully, followed by the cache-pruning hook. Rebuilt cache measured 0.25 GiB at that check.
- `npm run cache:prune -- --artifacts`: dry-run completed with zero artifact deletion candidates and no deletions.
- Final `npm run format:check` passed. An intermediate run reported a concurrent formatting issue in `packages/theia-control-room/src/browser/models-widget.tsx`; this task did not edit that file. Explicit formatting checks for maintenance JSON/YAML and the new scripts also passed.
- `npm run changelog:update` and `npm run changelog:check -- --base HEAD`: passed.
- Final `npm run cache:prune` dry-run measured 0.50 GiB after complete repository validation, versus 115.08 GiB before maintenance. No additional cache deletion candidates remained under the default policy.
- Live smoke and engine runs have not been repeated; artifact destination changes are source-reviewed only. Existing legacy evidence and profiles remain untouched.

## Files

- `.github/workflows/ci.yml`
- `.gitignore`
- `.prettierignore`
- `apps/control-room/turbo.json`
- `docs/changes/2026-10-04-build-cache-maintenance.md`
- `package.json`
- `packages/platform-service/turbo.json`
- `scripts/audit-detail-ui-smoke.cjs`
- `scripts/capture-documentation.cjs`
- `scripts/chat-layout-ui-smoke.cjs`
- `scripts/engine-web-acceptance.py`
- `scripts/extended-engine-acceptance.cjs`
- `scripts/live-engine-acceptance.cjs`
- `scripts/live-ui-smoke.cjs`
- `scripts/navigation-layout-ui-smoke.cjs`
- `scripts/project-selection-ui-smoke.cjs`
- `scripts/prune-build-cache.cjs`
- `scripts/prune-build-cache.test.cjs`
- `scripts/settings-models-ui-smoke.cjs`
- `scripts/verify-documentation-electron.cjs`
- `scripts/verify-documentation-engines.cjs`
- `scripts/verify-documentation-examples.cjs`
- `scripts/verify-documentation-native.cjs`
- `scripts/verify-documentation-recovery.cjs`
- `scripts/workspace-overhaul-ui-smoke.cjs`
- `turbo.json`

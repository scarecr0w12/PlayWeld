# Cover plugin SDK request rejection and recovery

**Release:** 0.24.0

**Impact:** none

**Category:** Maintenance

## Summary

Expand the TypeScript plugin SDK protocol suite from one success-path case to 20 behavioral cases. Protect initialization, dispatch and error-envelope contracts through the public stream interface without changing SDK runtime behavior.

## Details

- Existing SDK coverage exercised successful initialization, ping, a tool call with brokered log/secret requests, settings notification and shutdown. Added 19 cases for rejection paths and continued service after recoverable request failures; retained the existing success-path test.
- Missing, unsupported numeric and string protocol versions return incompatibility errors before settings callbacks or tools run. Correct initialization after the rejection allows a subsequent tool request. Tool calls, ping and shutdown before initialization return worker-not-initialized errors, preserve callbacks and permit later initialization.
- A rejected asynchronous initial-settings callback returns an internal-error envelope, leaves tool dispatch uninitialized and permits corrected initialization. Unknown methods and tool IDs return method-not-found envelopes without dispatching a registered handler; subsequent valid requests succeed.
- Missing/array tool contexts and missing/unsupported access modes fail before handler execution. All three supported access modes preserve the supplied task ID, role, mode and input at the handler boundary. These checks establish SDK context handling, not host authorization or sandbox enforcement.
- Synchronous handler exceptions and asynchronous rejections return correlated internal-error envelopes. Explicit PluginSdkError values retain their code/message, and subsequent calls succeed. Exact request IDs distinguish error/result correlation from an unrelated response.
- The test fixture uses PassThrough streams and the public definePlugin API. Per-case cleanup ends input, waits for the worker and destroys owned streams; no ordinary service/profile, provider, external plugin or engine is involved.
- Four disposable source/test copies deliberately bypass protocol-version rejection, initialization gating, access-mode validation or typed-error preservation. Each copy produces the expected assertion failures, establishing that the new tests detect those regressions. Tracked runtime source remains unchanged. The ignored runner and reports are under .turbo/sdk-negative-controls/ in the isolated worktree.
- Work is isolated on codex/sdk-conformance-quick-wins from main 3b35deb50ffd5c08c2a8dbaa6426983d81d3dd30. Existing root-worktree inventory, prioritization, review and changelog edits are preserved. The larger Q04 community conformance/migration task remains incomplete; this bounded suite does not establish independently authored plugin compatibility or live isolation acceptance.
- Compatibility and migration: tests only, no runtime/API/schema/storage/dependency changes or migration required. Product version remains 0.22.0. Impact none because this adds verification of existing behavior.

## Validation

- Fresh npm ci in the isolated worktree installed 1,211 packages, applied both existing patches and completed successfully. Initial sandboxed installation was denied directory creation; the approved retry succeeded. No dependency versions or lockfile were changed.
- npm test -w @gamecrafter/plugin-sdk passed all 20 cases. Four negative-control copies returned nonzero with behavioral assertion failures: version guard three, initialization guard three, access-mode guard two and typed-error preservation one. Test discovery was nonzero; filtered cases in negative-control runs were intentionally skipped.
- The required npx turbo run build typecheck lint test passed all 33 tasks on the approved host-access run (31 cached; desktop build and platform-service test ran fresh). Aggregate workspace results, including replayed cache results: 1,037 tests passed and nine skipped. Platform-service: 782 passed/eight skipped across 137 files; other workspace results: 255 passed/one skipped, including 20 SDK cases. Both browser and Electron builds passed; their echo-skip application typecheck/lint/test scripts do not establish renderer acceptance. The existing real-Blender fixture passed its two isolated tests; no broader engine/provider qualification is inferred. Logs remain ignored in .sdk-full-gate-host.log in the isolated worktree.
- The initial sandboxed full run encountered denied Git config writes inside disposable integration Projects and an Electron drivelist rebuild failure with LNK1101/MSPDB140.DLL mismatch. A focused model-scope case reproduced the Git denial and passed with approved host access; the full host-access rerun then passed the service suite and desktop native rebuild without source/toolchain changes. The first run is failed evidence, not a pass. Theia's temporary app-manifest edits and backup were restored/removed by its successful build tooling; no package-manifest/lockfile changes remain. The existing nonfatal require.resolve bundling warning remains.
- Repository-wide npm run format:check, focused Prettier checks, git diff --check, complete scripts/check-links.sh (Ubuntu/WSL; All links OK, exit zero), node scripts/check-documentation-evidence.cjs and node scripts/generate-system-reference.cjs --check passed. npm run changelog:update and npm run changelog:check -- --base 3b35deb50ffd5c08c2a8dbaa6426983d81d3dd30 passed. Final evidence-text edits only affect this record and its generated changelog projection; formatting/tracking/diff checks are refreshed before handoff.
- No independently authored community plugin, external model/generation provider, renderer/installed desktop, installer lifecycle or release acceptance is claimed. Hosted checks and publication have not been performed for this slice. Existing platform/capability skips remain explicit; none were added to make this change pass.

## Files

- `packages/plugin-sdk/src/plugin-sdk.test.ts`
- `docs/changes/2026-10-26-plugin-sdk-rejection-conformance.md`

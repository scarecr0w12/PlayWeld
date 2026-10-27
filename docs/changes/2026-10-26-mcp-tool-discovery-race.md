# Preserve MCP tool-cache invalidation during concurrent discovery

**Release:** 0.23.0

**Impact:** patch

**Category:** Fixed

## Summary

Prevent an in-flight MCP tool listing from restoring obsolete tools after a tool-change notification or event-stream closure invalidates discovery. This is a bounded correctness slice of the Features Project's Q01 concurrent-suite timing card; its broader qualification remains open.

## Details

- Current main `3b35deb` could return an obsolete listing after invalidation while another discovery request returned newer tools. The obsolete response could also overwrite the session cache and reach the connection manager's broker registration. Deterministic tests control transport responses and reproduce both notification and stream-close orderings without sleeps or changed timeouts.
- Concurrent discovery callers now share in-flight responses with their originating generation. Each caller checks that generation after awaiting the response and before parsing, caching or publication, including invalidation during promise settlement. Discovery retries a changed generation, with at most three response attempts per caller; repeated changes fail with an actionable retry error instead of unbounded requests. Disconnect also invalidates the generation, and a post-response connection check prevents publication after disconnection.
- Preserve deterministic tool sorting, TTL behavior, force-refresh entry points, separate returned snapshots, notification callbacks and existing protocol negotiation. Failed requests, malformed responses and repeated invalidation release the shared request so later discovery can succeed. Added focused tests cover these recovery cases and bound actual request counts.
- Inspected the canonical board, current main and recent PRs before selecting this task. PRs 15–19 are merged; the shared checkout retains unrelated planning records and an SDK worktree exists. This change uses a separate worktree and leaves those files, security/qualification work and Requested feature proposals untouched. The board-search recovery lead requires a separately scoped operator workflow and is not implemented here. This discovered MCP ordering defect is not asserted to explain every historical timing observation.
- Published [draft PR 20](https://github.com/scarecr0w12/PlayWeld/pull/20) on `codex/mcp-tool-discovery-race` and marked only its Q01 timing card In progress with a bounded implementation/evidence note. Preserve every other board card and the selected card's priority, size, estimate, risk and planning fields. Its broader acceptance criteria remain open. Exact-head hosted checks and their final disposition are tracked on that draft PR; no hosted pass is inferred from local results.
- Compatibility and migration: compatible internal service fix; no dependency, RPC, persisted schema, setting or migration changes. No migration required. Product version remains 0.22.0 pending; patch impact reflects corrected discovery behavior. No release, deployment or merge is part of this task.

## Validation

- Initial regression on unchanged runtime code: `npm test -w @gamecrafter/platform-service -- src/mcp/session.test.ts` discovered 27 tests, with both new ordering cases failing and 25 existing tests passing. Both failures returned `obsolete` where the current tool list was required.
- Separate standards and spec reviews both identified a further promise-settlement window in the first correction. A queued-notification regression reproduced it (one failure, 30 passes). Moving generation validation to each awaiting caller resolved the finding; both reviewers confirmed no remaining concrete in-scope findings. The final focused suite passed all 31 tests. Transport fixtures establish source-level behavior, not community-server or live-engine acceptance.
- Final concurrent MCP/worker verification: `node ../../node_modules/vitest/vitest.mjs run src/mcp src/workers/supervisor.test.ts src/workers/supervisor-await.test.ts --maxWorkers=4 --testTimeout=30000 --hookTimeout=60000` from the service package passed 83 tests across 16 files. No test timeout or existing assertion was increased or weakened. An initial npm-script invocation supplied duplicate worker flags and did not discover tests; the direct invocation above supplies the worker count once.
- Final aggregate `npx turbo run build typecheck lint --concurrency=1` passed all 25 tasks, 17 cached, including browser and Electron builds. Other workspace tests passed all 14 Turbo tasks, ten cached: 236 tests passed and one skipped across 57 files. Electron's test script remains an explicit skip; app builds do not establish rendered acceptance. Existing installer-handoff require-resolution and JSX-transform warnings remain.
- Final broad service command `npm test -w @gamecrafter/platform-service -- --exclude=src/updates/installer-handoff.test.ts --exclude=src/dcc/blender-real.test.ts` passed 783 tests with eight skips across 135 files (134 passed, one skipped). Earlier sandboxed/superseded broad attempts did not complete and are not counted as passes. The final run followed the reviewed source correction and completed with exit code zero. Combined with the other workspace results, local source/fixture coverage is 1,019 passes and nine skips across 192 files; focused/concurrent runs overlap and are not added to that total.
- Dependencies were installed from the unchanged lockfile in the isolated worktree using `npm ci --ignore-scripts --no-audit --no-fund`; repository patches were applied through `npm run postinstall`. Initial app builds lacked native artifacts because scripts were skipped. Rebuilding the pinned `@vscode/windows-ca-certs` and `@theia/ffmpeg` packages locally resolved those failures; the final aggregate above passed. No dependency or lockfile change was retained. Sandboxed networking and temporary Git initialization also prevented initial integration/tracking runs; authorized host runs are separate evidence, not passes for those failed attempts.
- All 13 change-tracking tests passed in the authorized run. Generated RPC/settings references, documentation inventories, documentation evidence integrity, release-version agreement, complete WSL Markdown link scan, repository formatting, diff whitespace, generated changelog freshness and branch-wide work-record coverage passed. Final evidence text changes preserve existing local link targets; no full unexcluded local Turbo test pass is claimed. Hosted CI uses the normal unexcluded repository commands.
- Native installer executable fixtures and live Blender operations remain excluded from local execution to preserve the established endpoint-protection/external-application boundary. No antivirus, credentials, ordinary runtime profile, paid provider or engine state is changed.

## Files

- `packages/platform-service/src/mcp/session.ts`
- `packages/platform-service/src/mcp/session.test.ts`
- `docs/changes/2026-10-26-mcp-tool-discovery-race.md`

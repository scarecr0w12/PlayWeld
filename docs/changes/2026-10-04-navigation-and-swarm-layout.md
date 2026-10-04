# Streamlined navigation, discussion browsing, and Swarm hierarchy

**Release:** Unreleased

**Impact:** minor

**Category:** Changed

## Summary

Refined the Control Room's Project Home, Discussion Board, and Swarm layouts to make destinations, next actions, and delegated agent work easier to identify without reading every task's full details.

## Details

- Replaced Project Home's flat workspace-tool strip and long onboarding paragraphs with four purpose-based navigation groups. All fifteen existing destinations and command IDs remain available, with concise descriptions. Contextual next steps guide users to create or open a Project without claiming engine readiness. The Projects shortcut scrolls and focuses within the page without changing Theia's workspace URL hash. Removed the Unreal-specific onboarding assumption; retained the external IDE MCP limitation note.
- Added Discussion Board quick views for all, open, question, blocker, and decision threads, explicit filter clearing, result counts, clearer empty-state guidance, compact thread metadata, and contextual next actions. Active filters now survive refreshes. Thread creation and maintenance are disclosure panels; pending synchronization counts remain visible. Existing message, binding-decision, review, archival, deletion, and maintenance operations remain available.
- Added a Project/thread selection payload to the existing Discussion Board command so Swarm's request-thread action opens the exact linked thread, including when switching Projects, rather than merely opening the board's previous selection.
- Replaced Swarm's recursively expanded task articles with a compact, collapsible agent/sub-agent hierarchy and a single selected-task inspector. The inspector retains goal, state, progress, spending, error, results, artifacts, questions, cancellation, and review controls. Selecting a task from a question/review shortcut expands its ancestor path. Each change request remains a separately selectable swarm backed by the existing service task tree; the UI does not invent live-agent instances from task records.
- Separated Swarm agents, Project approvals, integrations, and resource locks into focused views with counts. Added actionable next-step guidance and selected-request task summaries. New requests use a collapsible composer and clear the submitted text/impact preview after successful submission. Project/request changes clear stale task-selection displays.
- Added theme-aware status/selection styling, native keyboard-operable buttons/disclosures, and container-responsive layouts that stack the hierarchy and inspector or thread list and conversation on narrow surfaces. No dependency, persisted schema, RPC storage, or vector-backend changes; no migration is required. This change does not alter the concurrent vector database setup.
- Added focused widget regressions and a repeatable browser smoke script using an isolated profile/service, disposable Project, and synthetic nested `noop.echo` tasks, without model calls or user Project changes. Screenshots and the smoke report are generated under ignored `.turbo/navigation-layout-ui/`.

## Validation

- Control Room widget tests passed: 54 tests across 15 files, including hierarchy collapse/selection, result/error inspector rendering, preserved navigation commands, Board filter retention, and request-thread selection. Control Room build, typecheck, and lint passed in the repository validation run.
- Browser and Electron development application builds completed with zero build errors. This is build evidence, not a live Electron interaction check or an installer/release.
- `node scripts/navigation-layout-ui-smoke.cjs` passed nine checks against the rebuilt browser app and real isolated platform service, with no renderer errors. Verified grouped navigation, the non-routing Project shortcut, nested-agent selection/collapse, focused section navigation, the exact request-thread link, refresh-retained Board filters, and narrow-window layout. Screenshot/report evidence: `.turbo/navigation-layout-ui/1791082035943/`. Agent execution in this fixture is synthetic; paid reasoning, live engines, decision synchronization, and every approval/integration operation were not validated by this smoke.
- `npx turbo run build typecheck lint test --output-logs=errors-only` completed successfully: 33 tasks successful, 32 cached, with the platform-service test run executing to completion. Cached results and existing environment-dependent test skips remain distinct from new live coverage. An initial run caught a Discussion Board TypeScript narrowing error during implementation; it was fixed before the successful app builds and smoke check.
- `npm run format:check`, `bash scripts/check-links.sh`, `git diff --check`, and `npm run changelog:check -- --base HEAD` passed. Refreshed the generated overview with `npm run changelog:update`.

## Files

- `packages/theia-control-room/src/browser/project-home-widget.tsx`
- `packages/theia-control-room/src/browser/project-home-widget.test.tsx`
- `packages/theia-control-room/src/browser/discussion-board-widget.tsx`
- `packages/theia-control-room/src/browser/discussion-board-widget.test.ts`
- `packages/theia-control-room/src/browser/discussion-board-view-contribution.ts`
- `packages/theia-control-room/src/browser/swarm-widget.tsx`
- `packages/theia-control-room/src/browser/swarm-widget.test.ts`
- `packages/theia-control-room/src/browser/style/workstation.css`
- `scripts/navigation-layout-ui-smoke.cjs`
- `docs/changes/2026-10-04-navigation-and-swarm-layout.md`

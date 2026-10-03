# Default Control Room project selectors to the restored IDE workspace

**Release:** 0.5.0

**Impact:** patch

**Category:** Fixed

## Summary

Control Room pages now select the registered Project matching the IDE workspace when opened or restored. They no longer silently default to the first registered Project, which could direct operations at another game.

## Details

- Added shared workspace selection behavior to the Control Room widget base. Selection waits for Theia workspace readiness and reads its roots. Windows path comparison handles casing, slash differences and trailing separators; child folders select the closest registered Project. Multiple roots must identify the same Project. Empty, unknown or ambiguous workspaces remain unselected.
- Applied this behavior to Swarm, Chat, Assets, Discussion Board, Knowledge, Engine, DCC Tools, Skills and Roles, Connections, Plugins, Models, Settings, Audit and History, and Backups. Settings and Models load their scoped data after resolving the Project so the initial page content uses the correct scope.
- Explicit dropdown choices, including platform-only/all-project options, survive ordinary refreshes and page activation. A changed workspace resets the default; closing and recreating a page uses the IDE workspace again. Explicit command deep links retain their target on initial load.
- Handled overlapping constructor and activation refreshes during layout restoration. Selection reads the current field after workspace readiness and distinguishes explicit empty choices from uninitialized fields. Swarm clears project-specific requests, tasks, questions, locks, integrations, approvals, impact results and question drafts when automatic selection changes. Added an accessible label to the Backups Project selector.
- Added policy regression coverage and an isolated real-service browser smoke script. Adapted the existing Chat request-ownership fixture to model a restored Project A workspace. No persisted record, RPC, package identifier or storage schema changed; no migration is required. Version preparation and installer evidence are tracked separately in the 0.5.0 release record.
- During installer verification, updated the existing desktop/browser smoke harness to wait for project-scoped skill enablement after explicitly selecting the generated Project. Platform-only skill rows are already visible before the asynchronous Project request finishes; counting those rows alone was insufficient and caused an early checkbox assertion. Engine and DCC setup checks now explicitly select the generated Project and wait for its forms because this smoke opens the IDE workspace only at the end; it no longer relies on the unsafe first-Project fallback.

## Validation

- `npm test -w @gamecrafter/theia-control-room`: passed after adapting the Chat workspace fixture. The final full run includes 43 Control Room tests, including nine new selection tests. Initial fixture failures were corrected; they are not outstanding failures.
- `npx turbo run build typecheck lint test`: passed, 33 successful tasks (25 cached). Includes rebuilt browser and Electron applications. Existing dependency installation was reused; `npm ci` was not rerun because no dependencies changed. Existing platform-dependent test skips remain; this is not live engine verification. Log: `.turbo/project-selection-verification.log`.
- `node scripts/project-selection-ui-smoke.cjs`: passed 17 checks using two disposable Projects, an isolated profile and the built browser app with the real platform service. All 14 selectors chose the workspace Project despite a different first registered Project; manual Swarm selection survived activation; closing/reopening and app reload restored the workspace default. No renderer errors. Report and screenshot: `.turbo/project-selection-ui/1791060010587/`. Earlier smoke setup/selector mistakes and the Models startup race were corrected before this successful run.
- `npm run format:check`: reports only three unrelated untracked Kilo agent files (`.kilo/agents/code-reviewer.md`, `.kilo/agents/code-skeptic.md`, `.kilo/agents/docs-specialist.md`). This change's source files pass formatting; those unrelated files were left untouched. `git diff --check` passed.
- `npm run changelog:update`: passed. `npm run changelog:check -- --base HEAD`: fails coverage on the same unrelated untracked Kilo agent files. Repeating that check with a process-local Git exclusion file containing exactly those three paths passes coverage and generated changelog freshness for this change. Repository ignore configuration was not modified.
- `scripts/check-links.sh`: passed with `All links OK` under WSL using an ignored temporary LF copy of the same script (`.turbo/check-links-lf.sh`) for the Windows checkout. The slower Git Bash run was interrupted before completion; the completed WSL run is the link evidence.
- The original fix verification covered Electron compilation and browser reload rather than a packaged Electron close/relaunch or installer lifecycle. Subsequent 0.5.0 installer/package checks are recorded separately in the release-preparation record.

## Files

- `packages/theia-control-room/src/browser/workspace-project-selection.ts`
- `packages/theia-control-room/src/browser/workspace-project-selection.test.ts`
- `packages/theia-control-room/src/browser/control-room-react-widget.ts`
- `packages/theia-control-room/src/browser/assets-widget.tsx`
- `packages/theia-control-room/src/browser/audit-widget.tsx`
- `packages/theia-control-room/src/browser/backups-widget.tsx`
- `packages/theia-control-room/src/browser/chat-widget.tsx`
- `packages/theia-control-room/src/browser/chat-widget.test.ts`
- `packages/theia-control-room/src/browser/connections-widget.tsx`
- `packages/theia-control-room/src/browser/dcc-widget.tsx`
- `packages/theia-control-room/src/browser/discussion-board-widget.tsx`
- `packages/theia-control-room/src/browser/engine-widget.tsx`
- `packages/theia-control-room/src/browser/knowledge-widget.tsx`
- `packages/theia-control-room/src/browser/models-widget.tsx`
- `packages/theia-control-room/src/browser/plugins-catalog-widget.tsx`
- `packages/theia-control-room/src/browser/settings-widget.tsx`
- `packages/theia-control-room/src/browser/skills-widget.tsx`
- `packages/theia-control-room/src/browser/swarm-widget.tsx`
- `scripts/project-selection-ui-smoke.cjs`
- `scripts/live-ui-smoke.cjs`
- `docs/changes/2026-10-03-workspace-project-selection.md`

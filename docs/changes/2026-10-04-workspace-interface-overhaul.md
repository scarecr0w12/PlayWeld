# Overhaul remaining workspace pages and Theia shell surfaces

**Release:** 0.7.0

**Impact:** minor

**Category:** Changed

## Summary

Extend the clear navigation and compact layouts from Project Home, Discussion Board, and Swarm across the remaining Control Room pages and shared built-in Theia surfaces, preserving existing operations and safety boundaries.

## Details

- Extend the established Project Home, Discussion Board, and Swarm layout direction to Assets, Knowledge, Skills, Plugins, Engine, DCC Tools, Connections, Models, Settings, Backups, Audit, Updates, and Chat.
- Add focused section navigation, contextual next-step guidance, visible field labels, compact metadata, useful empty states, and disclosures for advanced configuration. Inactive panes stay mounted so switching sections does not discard draft fields or preview state.
- Add a grouped PlayWeld menu that links all platform destinations and the built-in IDE Settings and Open View commands without removing Theia's existing menus or keyboard shortcuts.
- Apply theme-aware treatment to built-in menu popovers, quick inputs and the command palette, dialogs, Preferences field cards, Explorer tree selection, notifications, and shared form controls. Improve project-creation prompt examples and confirmation details.
- Add Chat conversation search, draft-only conversation starters, and clearer Chat/Agent handoff guidance. Search also filters the compact conversation picker while keeping an unmatched active conversation explicitly available as the current conversation.
- Show Engine/DCC run evidence after an operation and take update checks and downloads to their result panes. Preserve existing RPC operations, permission boundaries, signature verification gates, redaction, and import previews; the vector storage and embedding backend implementation is unchanged.
- Final pre-deployment review also corrected Assets result navigation: library/job previews and successful imports reveal the Preview pane, and submitting generation reveals Jobs without clearing the generation draft. Added dedicated regression coverage for these previously hidden-result paths.
- Add a Settings regression that invokes the real search field handler and verifies that a match in another group becomes visible; preserve the existing automatic matching-group selection rather than changing working search behavior.

## Validation

The full repository validation passed all 33 tasks, including browser and Electron builds. The Control Room suite passed 78 tests across 22 files. The browser smoke uses the rebuilt app and a real isolated platform service, exercises all 12 remaining non-Chat pages at 1600px and 650px widths, verifies enabled section navigation and accessible names for visible fields, and checks Chat draft interactions and compact conversation search.

- `npx turbo run build typecheck lint test --output-logs=errors-only`: 33 tasks passed; final run had 25 cached tasks and 8 newly executed tasks. Browser and Electron builds passed; cached and environment-dependent test skips are not additional live coverage.
- `npm test -w @gamecrafter/theia-control-room`: 22 test files and 78 tests passed, including section mounting, preserved navigation routes, update/engine/DCC result navigation, Chat draft-only starters, and filtered compact conversation selection.
- Final pre-deployment regression suite passed 82 tests across the same 22 files, adding Assets result-navigation and actual Settings search-handler coverage.
- `node scripts/workspace-overhaul-ui-smoke.cjs`: 34 checks passed with no renderer errors. Final screenshot/report evidence: `.turbo/workspace-overhaul-ui/1791084837281/`.
- `npm run format:check`, `bash scripts/check-links.sh`, `git diff --check`, and `npm run changelog:check -- --base HEAD` passed. Regenerated the overview with `npm run changelog:update`.

The same smoke verifies the grouped menu, keyboard entry into built-in Preferences, the command palette, About dialog and Explorer, cancellation of project creation, Light and High Contrast theme switching, and reduced-motion styling. It reports 34 checks with no renderer errors. Reproduction is `node scripts/workspace-overhaul-ui-smoke.cjs` after building the extension, platform service, and browser app. Its ignored report and screenshots are under `.turbo/workspace-overhaul-ui/`; inspect the latest successful `report.json` rather than older failed iteration captures.

An independent source review identified that mobile Chat search initially filtered only the hidden navigation list; the compact picker and regression coverage were corrected before the final smoke. Earlier runs also caught an Assets navigation target mismatch, an intentionally disabled plugin-details navigation control in the test harness, and reduced-motion CSS precedence; these were resolved before final validation. Browser smoke and app builds must run sequentially on Windows because the running backend holds native build output files open.

Live Electron interaction, third-party extension webviews, external model requests, engine/DCC execution, plugin installation, backup restoration, and update installation were not exercised by this UI smoke. Shared shell styling does not replace built-in IDE workflows or restyle arbitrary third-party webview contents. No claim of comprehensive accessibility certification or live external-tool integration is made.

## Files

- `packages/theia-control-room/src/browser/assets-widget.tsx`
- `packages/theia-control-room/src/browser/assets-widget.test.tsx`
- `packages/theia-control-room/src/browser/audit-widget.tsx`
- `packages/theia-control-room/src/browser/backups-widget.tsx`
- `packages/theia-control-room/src/browser/brand-contribution.ts`
- `packages/theia-control-room/src/browser/chat-widget.tsx`
- `packages/theia-control-room/src/browser/chat-widget.test.ts`
- `packages/theia-control-room/src/browser/connections-widget.tsx`
- `packages/theia-control-room/src/browser/connections-widget.test.tsx`
- `packages/theia-control-room/src/browser/control-room-frontend-module.ts`
- `packages/theia-control-room/src/browser/create-project-command.ts`
- `packages/theia-control-room/src/browser/dcc-widget.tsx`
- `packages/theia-control-room/src/browser/dcc-widget.test.tsx`
- `packages/theia-control-room/src/browser/engine-widget.tsx`
- `packages/theia-control-room/src/browser/engine-widget.test.tsx`
- `packages/theia-control-room/src/browser/knowledge-widget.tsx`
- `packages/theia-control-room/src/browser/knowledge-widget.test.ts`
- `packages/theia-control-room/src/browser/models-widget.tsx`
- `packages/theia-control-room/src/browser/operations-pages-layout.test.tsx`
- `packages/theia-control-room/src/browser/plugins-catalog-widget.tsx`
- `packages/theia-control-room/src/browser/plugins-catalog-widget.test.tsx`
- `packages/theia-control-room/src/browser/project-home-widget.test.tsx`
- `packages/theia-control-room/src/browser/settings-widget.tsx`
- `packages/theia-control-room/src/browser/skills-widget.tsx`
- `packages/theia-control-room/src/browser/skills-widget.test.tsx`
- `packages/theia-control-room/src/browser/style/workstation.css`
- `packages/theia-control-room/src/browser/theme-contribution.ts`
- `packages/theia-control-room/src/browser/updates-widget.tsx`
- `packages/theia-control-room/src/browser/workspace-menu-contribution.ts`
- `scripts/workspace-overhaul-ui-smoke.cjs`
- `docs/changes/2026-10-04-workspace-interface-overhaul.md`

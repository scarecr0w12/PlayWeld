# Format agent hierarchy goals and related task text

**Release:** 0.8.0

**Impact:** patch

**Category:** Fixed

## Summary

Replace flat task-goal/result paragraphs with structured, bounded reading panels in the agent hierarchy while keeping untrusted text inert and all task actions available.

## Details

- A failing render regression reproduced Markdown headings, lists and fences appearing literally inside a single paragraph. Render Markdown tokens from the existing Theia-shared parser as React elements instead of injecting HTML or introducing a new dependency.
- Goals, results, errors and questions preserve headings, nested lists, emphasis, inline/fenced code, tables and paragraph breaks. Structured JSON is indented as escaped code. Raw HTML and automatic media loading are not enabled; executable/file/relative link targets do not become navigable actions.
- Bound long goal/result/question content in named keyboard-accessible scroll regions. Shorten request-select labels to the first heading/line without discarding the stored goal. Keep cancellation, feedback, question answers and artifact paths intact.
- Label task spend as the known recorded portion, preserve tiny positive amounts, and show no charge recorded instead of asserting that a zero-valued accumulator proves free usage. Audit provides separate cost-coverage details; unpriced usage can remain outside the numeric task accumulator.
- The source-fix stage kept version 0.7.0 and did not replace the installed app/profile or commit/push. The later user-authorized [local 0.8.0 deployment](../changes/2026-10-04-local-0.8.0-deployment.md) records that separate packaging/install/Git handoff; the screenshots retain their actual source-capture version.

## Validation

- `npm test -w @gamecrafter/theia-control-room -- src/browser/swarm-widget.test.ts`: new formatting regression failed before the fix at the missing heading assertion.
- Focused formatting/escaping tests passed after implementation, covering headings/lists/code/tables, inert HTML/image/command links and JSON indentation. Source typecheck passed.
- Full UI suite passed 93 tests across 25 files. The new task-heading regression also keeps automatically derived Markdown titles concise while retaining full stored goals. A scoped read-only safety/UI review found one obsolete instruction in Audit; corrected its expansion wording to selection.
- `npx turbo run build typecheck lint test --output-logs=errors-only`: 33 tasks passed (22 cached, 11 newly executed), including browser/Electron builds. Turbo emitted a cache I/O disk-space warning; task exit statuses were all successful and final outputs were used for browser verification.
- `scripts/audit-detail-ui-smoke.cjs` passed seven checks against the real isolated service and rebuilt browser, including Markdown structure, bounded keyboard readers, cost confidence and desktop/narrow layouts, with no renderer errors. Actual-source screenshots/report are in `docs/images/audit-detail-2026-10-04/`; ignored run evidence is `.turbo/audit-detail-ui/1791096552100/`.
- Current screenshot metadata labels the pending 0.7.0-version source build. No installed-desktop, real-provider or invoice verification is claimed; the ordinary 0.7.0 installed application/profile were not replaced or migrated.

## Files

- `packages/theia-control-room/src/browser/swarm-widget.tsx`
- `packages/theia-control-room/src/browser/swarm-widget.test.ts`
- `packages/theia-control-room/src/browser/markdown-content.tsx`
- `packages/theia-control-room/src/browser/markdown-content.test.tsx`
- `packages/theia-control-room/src/common/cost-display.ts`
- `packages/theia-control-room/src/common/cost-display.test.ts`
- `packages/theia-control-room/src/common/swarm-view-model.ts`
- `packages/theia-control-room/src/browser/style/workstation.css`
- `docs/changes/2026-10-04-hierarchy-content-formatting.md`
- `docs/CONTROL_ROOM_HANDBOOK.md`
- `docs/USER_GUIDE.md`

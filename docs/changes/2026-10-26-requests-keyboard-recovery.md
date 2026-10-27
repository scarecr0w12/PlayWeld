# Keep Requests keyboard focus through review and recovery

**Release:** 0.23.0

**Impact:** patch

**Category:** Fixed

## Summary

Keep keyboard users inside Requests when opening the view or when a response control disappears or becomes disabled. Preserve the existing empty inspector after resolution and explicit per-request authority. This is a bounded slice of the P0 UI/accessibility card, not completion of broader accessibility qualification.

## Details

- A real keyboard journey on main `3b35deb` left focus on the document body when opening Requests and after approval, rejection, choice and free-text responses. The inspector correctly cleared, but continuing required tabbing through the wider workbench. A rendered regression reproduced this before the correction; no product change was made until the journey demonstrated the gap.
- Activating Requests now renders and focuses its Project filter when focus is outside the view. An update that removes or disables the view's focused control returns focus to the labeled Pending requests navigation region. Existing focus on surviving controls, including typed drafts, is preserved. Background updates do not take focus from another view.
- The navigation region is programmatically focusable without adding a normal tab stop. It grants no authority and does not select another request. Resolved identities, keyed inspector content, empty-inspector behavior, draft storage, model refresh/response logic, exact-ID RPCs and per-call approval rules remain unchanged. Repeated Enter after resolution cannot approve a replacement request.
- Add a repeatable Puppeteer keyboard/recovery scenario and `test:ui:requests-keyboard` command. Use real disposable Projects, workers and contained file approvals; tab through existing Project Home and Requests controls and use Enter/Space/native selection keys. Verify exact Project context, independent approval/rejection, another client's resolution, exact stored answers, background draft retention, unavailable-Project recovery, actual service stop/restart, safe empty-inbox focus and narrow layout. Do not invoke a model, paid provider or engine.
- Run this scenario after the existing hosted browser smoke. Its unique profile/Project/configuration and evidence directories stay outside the repository. Upload only report/failure JSON and PNGs, never profile databases, service tokens or credential material. A held fixture lock prevents a second service bootstrap during the deliberate disconnect. Cleanup handles partial startup, independently attempts every owned resource, waits for its backend exit, force-stops that same backend if necessary and records cleanup failures.
- Retain the observed optional development-shell `/favicon.ico` HTTP 404 in evidence, qualified by its exact URL/status. Reject other HTTP/console errors and all renderer exceptions. This task does not repair or silently discard that unrelated shell diagnostic. The Browser plugin is unavailable; the scenario uses the repository's existing Puppeteer dependency and records its actual browser/version.
- Work uses a new isolated branch from main, independent of draft PR 20. Preserve the original checkout's pending planning/changelog work and the SDK/security worktrees. Only the existing UI/accessibility card is marked In progress; its priority/estimate and other cards remain unchanged. No new navigation/approval architecture or Requested first-run feature is accepted.
- Compatibility and migration: compatible UI focus correction; no dependency, lockfile, API, setting, persistent schema or migration changes. No migration required. Product version remains 0.22.0 pending. Patch impact reflects corrected keyboard navigation; no installer, release, deployment or merge is prepared.

## Validation

- Unchanged-source browser probe completed the response journey with no renderer exceptions but recorded BODY focus at opening and every completion; the explicit focus assertion failed. After the correction, the same journey retains focus on the Project filter or Pending requests navigation region, while background typing stays in the answer field and the inspector remains empty after resolution.
- Focused Requests model/widget tests passed all ten cases across two files, including failed read/action, disconnect/late results, stale actions and draft editing. Aggregate build/typecheck/lint passed all 25 tasks (18 cached), including browser and Electron builds. Other workspace tests passed all 14 tasks (11 cached): 236 passed, one skipped across 57 files. These counts overlap the focused tests and are not added together.
- The reusable rendered scenario passed twelve focus/state observations on native Windows Chrome 155.0.8059.79 at 1600x1000 and 480x900. Exact answers, approved/rejected file outcomes, stale/repeated action safety, draft recovery, disabled disconnected controls, Project context and no horizontal overflow were asserted. Renderer errors were empty. The optional favicon 404 remains explicitly reported; no other HTTP/console error was observed. Final cleanup recorded no errors and released the fixture lock.
- Independent standards/spec reviews found no product-focus defect. Standards review identified startup and cleanup failure edges in the new harness; acquisition moved inside protected cleanup and each cleanup stage runs independently, including forced termination of a resistant owned backend. A temporary public-connection fault probe exited with the expected error, no cleanup errors and no remaining service lock instead of hanging. The transient injection is not a product test hook or committed dependency.
- Initial browser startup lacked native artifacts because dependency install scripts were skipped; built the unchanged pinned Windows CA, Theia ffmpeg, drivelist and native-keymap modules locally. No manifest/lockfile dependency change was retained. An initial command-palette probe did not open its expected selector; final acceptance uses keyboard navigation from Project Home, without claiming palette qualification. An exploratory malformed-manifest injection did not induce a read failure for an already-open cached Project; restored its bytes and removed that invalid fault case. No runtime defect is inferred from those harness/setup observations.
- Failed read/action handling is covered by existing model tests; rendered recovery covers unavailable Projects and actual service-disconnect errors. NVDA/Orca, full screen-reader/contrast/localization certification, installed Electron, installer lifecycle and paid/live engine workflows were not exercised. The unchanged broad service suite is not rerun locally for this frontend-only fix, preserving the established native installer-executable/live-Blender boundary. Hosted CI uses normal unexcluded quality commands.
- Repository formatting, explicit script/work-record formatting, YAML syntax with retained read-only workflow permissions, Node script syntax, generated references/inventories, documentation evidence integrity, release-version agreement, complete WSL Markdown links, diff whitespace, generated changelog freshness and branch-wide record coverage passed. Exact-head hosted outcomes are retained on the draft PR linked from the [owning card](https://github.com/users/scarecr0w12/projects/5?pane=issue&itemId=282909887). No passing hosted or broad accessibility claim is inferred from local browser evidence.

## Files

- `packages/theia-control-room/src/browser/requests-widget.tsx`
- `scripts/requests-keyboard-ui-smoke.cjs`
- `package.json`
- `.github/workflows/ci.yml`
- `docs/changes/2026-10-26-requests-keyboard-recovery.md`

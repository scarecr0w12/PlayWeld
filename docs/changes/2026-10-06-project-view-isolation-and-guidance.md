# Keep Project views isolated and clarify engine readiness

**Release:** 0.15.0

**Impact:** patch

**Category:** Fixed

## Summary

Repair obsolete asynchronous responses, stale Project evidence, narrow dock overflow and misleading Engine readiness guidance across the Control Room.

## Details

- Engine and DCC Project loads now capture Project/tool context and request generations. Old responses and failures cannot overwrite the selected context; clearing the selection removes capability, bridge and run evidence. DCC errors are caught instead of escaping event handlers. Same-context refresh preserves selected run evidence and action results.
- Assets library refresh guards its snapshot and busy state. Context changes clear old files/jobs, previews, review notes and the source-job selection. Preview requests have their own generations; generation, review/cancel and import completion are ignored after navigation, including the follow-up imported preview.
- A final deferred-submit regression reproduced two paid generation RPCs from repeated clicks while the first was pending. Generate now refuses an already-busy submission and immediately renders the disabled state. This repairs UI duplication; provider idempotency/recovery after ambiguous remote failures remains separate open work.
- Knowledge guards status, record list, vector settings, search, record detail and graph publication against changed context. A context change clears the old index/records/graph/search evidence, while a same-Project refresh preserves selected content. Refresh snapshots have their own generation and overlapping busy operations are counted. Three additional regressions reproduced offline status/records/settings notification failures; these now produce a scoped error instead of an uncaught asynchronous rejection, and obsolete errors are ignored.
- Skills, Plugins and Connections publish only the latest context snapshot. Plugins fetch context-specific tools with the snapshot instead of accepting a later independent tool result. Explicit Connections scope changes also clear tool/log caches and selection.
- Shared CSS bounds fields, labels, forms and fieldsets; wraps actions and heading text; gives Engine/DCC tables their own horizontal scroll; stacks relevant narrow grids; and avoids form rules stretching checkboxes/radios. This repairs observed narrow dock overflow without hiding oversized content.
- Engine guidance now explains that missing native game files must be supplied before installation can make operations usable. Capability badges count layers and operation badges count available operations instead of all unavailable definitions. The native installation form remains available in its own section.
- Add eighteen response/failure-isolation regressions, one Engine guidance regression and one duplicate paid-submission regression. Existing Assets/Knowledge fixtures initialize the new counters to match constructed widgets.
- Compatible visible fixes require a patch impact. No data/RPC schema migration or compatibility-identifier rename is required. Existing service ownership and deliberate Project selection are preserved.

## Validation

- Reordered-response regressions first failed for Engine, DCC, Assets and Knowledge; three additional regressions failed for Skills, Plugins and Connections. The repaired response suite passes; existing import/generation tests remain covered.
- Uncached full gate passed 33/33 before later follow-ups; the final combined gate passed all 33 tasks with 542 platform tests/11 skips and 124 extension tests, including the three offline-notification regressions and duplicate-generation case. Twenty-five unchanged tasks use verified cache entries; the fresh platform run is retained separately.
- Larger-window browser and development Electron audits each passed 195 rendered checks with zero renderer exceptions. The final guidance text/count correction passed another 195-state Electron recheck; the updated local asset workflow also passed. Offline failures use deterministic regressions, not a live provider outage claim.
- Narrow 480-pixel stress captures are retained as supplemental evidence. They are not normal desktop acceptance; full accessibility, production engine UI and installer verification are not claimed.

## Files

- `packages/theia-control-room/src/browser/assets-widget.tsx`
- `packages/theia-control-room/src/browser/assets-widget.test.tsx`
- `packages/theia-control-room/src/browser/connections-widget.tsx`
- `packages/theia-control-room/src/browser/dcc-widget.tsx`
- `packages/theia-control-room/src/browser/engine-widget.tsx`
- `packages/theia-control-room/src/browser/engine-widget.test.tsx`
- `packages/theia-control-room/src/browser/knowledge-widget.tsx`
- `packages/theia-control-room/src/browser/knowledge-widget.test.ts`
- `packages/theia-control-room/src/browser/plugins-catalog-widget.tsx`
- `packages/theia-control-room/src/browser/skills-widget.tsx`
- `packages/theia-control-room/src/browser/style/workstation.css`
- `packages/theia-control-room/src/browser/project-view-isolation.test.ts`
- `docs/changes/2026-10-06-project-view-isolation-and-guidance.md`

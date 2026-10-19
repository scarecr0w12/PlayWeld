# Keep Models tables and discovery controls readable in narrow views

**Release:** Unreleased

**Impact:** patch

**Category:** Fixed

## Summary

Preserve readable Models table columns in narrow desktop views, contain scrolling within accessible table regions, and bound long model-discovery lists.

## Details

- Previously the provider table compressed descriptive columns around the discovery actions. A real native Electron reproduction at a 360-pixel viewport measured the provider-kind column at 27 pixels and a 24-model chooser at approximately 38,000 pixels tall. Long labels wrapped into fragments, making account details and actions difficult to read.
- Give Models tables a readable minimum width and provider columns dedicated minimum widths. Keep horizontal overflow inside labelled, focusable scroll regions for the provider and model tables, with a visible keyboard-focus outline. Constrain the Models root to its actual width, preserve normal word wrapping in cells, and allow long provider URLs to wrap. Keep the table structure and native form controls intact.
- Bound the discovery fieldset to 22rem with its own scrolling and contained overscroll. Space account action buttons and display their status on a separate line so long discovery results no longer create an unbounded table row. Model enabling, pricing, capability and routing behavior are unchanged. No storage or RPC migration, dependency change, or version bump is required while these fixes remain pending.
- Add a shared real-renderer layout regression to the existing browser/Electron smoke test. It creates an isolated local fake provider with 24 long model IDs, checks account tables at 360/640/800/1280 pixels and model rows at 360/800/1280 pixels, verifies readable column width, contained overflow, bounded discovery height, labelled keyboard scrolling, native selection, and expanded editors. It restores the viewport, removes its owned provider and closes the fixture server.
- The longer smoke run exposed an existing hierarchy-rendering fixture race: a model-backed root could fail before its child was attached. Gate the owned disposable Project's capacity with a cancellable noop task while creating and inspecting the hierarchy. Cancel the request tree and gate task and remove the temporary concurrency override afterward. Production task policy is preserved.

## Validation

- The new layout check failed against the original source-built Electron application with the measured 27-pixel column and unbounded chooser. After the CSS/markup correction, all narrow layout assertions passed in the real native renderer.
- The first otherwise-green layout run then exposed the hierarchy fixture race. After adding the owned gate, an initial setup retry detected a missing required goal in that fixture; adding it completed a full native smoke with 30 checks and zero renderer errors. The final checker additionally enabled a model through the chooser at 360 pixels and expanded the capability/pricing editors; the complete native smoke again passed 30 checks with zero renderer errors: `.artifacts/documentation-electron/1792387685039/smoke/report.json`. Manual inspection confirmed readable discovery controls and bounded scrolling in the captured native view.
- Full repository quality passed all 33 tasks (21 cache hits) in 7m38.842s, including both app builds: 888 tests passed and seven skipped. Formatting, changelog coverage, version consistency, generated references/inventory, documentation evidence, whitespace and Markdown links passed.
- The final shared checker also passed in the source-built development browser: 33 full smoke checks and zero renderer errors, including the viewport, selection and expanded-editor assertions. Evidence: `.artifacts/windows-swarm-models-fixes/browser/smoke/report.json` and `browser-smoke.log` in its parent evidence directory. Both native and browser runners cleaned up their owned processes and isolated service.
- Hosted CI run `39205402424` passed Windows quality, Linux quality and browser build/live UI smoke on fix commit `05368eab2f6392942dc673235edd3c63a064085c`. Downloaded browser evidence confirms 33 checks passed, zero renderer errors and execution of the new Models layout regression: `.artifacts/windows-swarm-models-fixes/hosted-browser/report.json`. The later verification-record update changes only Markdown and preserves the tested application, CSS and smoke-check source.
- Initial red evidence: `.artifacts/windows-swarm-models-fixes/models-layout-red.log`. Subsequent failures/retries remain in that directory. Successful initial complete native run: `.artifacts/documentation-electron/1792387609482/smoke/report.json`, including account/model screenshots at the tested widths.
- Acceptance uses source-built applications, disposable profiles/Projects and a fake local provider. Ordinary projects, settings, installed 0.22.0 files and paid provider accounts are not modified. Installer, installed-upgrade, paid-provider, engine and complete accessibility acceptance are outside this change.

## Files

- `packages/theia-control-room/src/browser/models-widget.tsx`
- `packages/theia-control-room/src/browser/style/index.css`
- `scripts/models-layout-check.cjs`
- `scripts/live-ui-smoke.cjs`
- `docs/changes/2026-10-18-models-narrow-layout-fix.md`

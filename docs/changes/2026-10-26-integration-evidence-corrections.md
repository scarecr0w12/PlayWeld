# Correct stale plugin isolation and generation evidence guidance

**Release:** 0.24.0

**Impact:** none

**Category:** Documentation

## Summary

Replace two stale blanket unverified claims in the integration guide with dated, scoped evidence links for Windows plugin workers and one Meshy generation/import workflow.

## Details

- The executable-plugin section previously described Windows AppContainer as unverified/fail-closed even though the 2026-10-06 editor-bridge acceptance records LPAC/Job filesystem/network denial checks under Node and Electron Node mode and shared Node/Python lifecycle checks. Link the existing acceptance section and retain explicit limits for broader process tests, allowed outbound networking, host allowlists and alternate Windows versions. Unavailable isolation continues to fail closed; signatures and additional hardening remain open.
- The generation-provider section previously said paid live generation remained unverified. Link the 2026-10-06 adversarial review's single meshy-6-lite preview, download/hash/GLB checks, review-gated and exact-byte isolated import. Name the five-credit geometry scope and retain unverified production-art, image-to-3D, refine, Tripo and broader provider paths. State the existing explicit session-authorization requirement for paid calls.
- Refresh the guide's update date to 2026-10-26 while retaining the acceptance dates in each corrected paragraph. This reconciles contributor guidance with already recorded acceptance; it does not rerun those operations, promote their dates to current qualification, approve further paid calls or mark a work package complete. Historical acceptance records remain unchanged.
- Compatibility and migration: documentation only, no application, API/schema, database, dependency or version change and no migration required. Impact none because this corrects evidence wording without changing behavior.

## Validation

- Compared both guide paragraphs with docs/EDITOR_BRIDGE_ACCEPTANCE.md and docs/ADVERSARIAL_SYSTEM_REVIEW.md on current main and verified the exact Windows isolation heading used by the new relative anchor.
- npm run format:check passed repository-wide. The complete scripts/check-links.sh ran through Ubuntu/WSL and returned All links OK with exit code zero. npm run changelog:update and npm run changelog:check -- --base 3b35deb50ffd5c08c2a8dbaa6426983d81d3dd30 passed, as did git diff --check. node scripts/check-documentation-evidence.cjs passed its inventory/report/file-integrity checks, and node scripts/generate-system-reference.cjs --check confirmed 204 request and 88 setting references. Final validation-text/date edits do not change link targets; the generated record projection is refreshed before handoff.
- The SDK/full-gate results are recorded separately in the conformance task. No new plugin-isolation execution, generation, provider call, renderer/installer drill or release publication was performed for this documentation correction.

## Files

- `docs/INTEGRATION_GUIDE.md`
- `docs/changes/2026-10-26-integration-evidence-corrections.md`

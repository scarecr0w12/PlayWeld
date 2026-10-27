# Use Node for the advisory Claude Brain hook launcher

**Release:** Unreleased

**Impact:** none

**Category:** Fixed

## Summary

Replace the newly supplied Windows-only Claude Brain hook wrapper with a Node launcher so the shared configuration does not require cmd on macOS/Linux.

## Details

- Kilo's review of candidate 6c14c37 identified that cmd /c could not launch on Unix hosts. Its GitHub check reported success when review completed, but the actual review summary contained one warning and recommended addressing it before merge; a green review check alone was insufficient acceptance.
- Replace the outer cmd command with the repository's existing Node runtime. Node invokes two fixed literal commands through its host's default shell: first entire-brain hook pre-edit --claude-hook, then entire brain hook pre-edit --claude-hook if the first fails. No event-derived text is interpolated. Preserve inherited input/output, stop after success, and permit edits if both advisory commands fail. This removes the unconditional cmd requirement without adding dependencies or treating the hook as a security gate.
- Compatibility and migration: developer configuration only, using the existing Node 24+ prerequisite. No application, RPC, schema, storage or dependency changes; no migration required. Keep version 0.23.0 and impact none. The previous Brain setup record describes the original supplied configuration; this record documents its correction. Brain remains uninstalled locally and live Claude context injection remains unverified.

## Validation

- The actual configured command passed 16 isolated Windows cases: primary success, fallback success, both commands failing, and both missing, each through PowerShell 5.1, PowerShell 7, cmd and direct Node. Fixtures verify stop-after-success, fallback selection and advisory zero exit without real Brain/model calls. The required local full gate passed 33/33 tasks from cache in 200 ms; the previous fresh platform-service suite remains separately recorded. Formatting, link and branch-base change-record checks are refreshed before commit. Actual Unix Claude sessions, Brain indexing and context injection are not claimed from local Windows fixture checks; the removal of the outer cmd dependency is source evidence. Hosted checks and review must qualify the corrected final head.

## Files

- `.claude/settings.json`
- `docs/changes/2026-10-26-claude-brain-portable-launcher.md`

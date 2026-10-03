# Normalize generated release-note trailing whitespace

**Release:** 0.5.0

**Impact:** none

**Category:** Fixed

## Summary

Generate release notes with one terminating newline so newly staged notes pass Git whitespace validation.

## Details

- Final staged review caught an extra blank line at EOF in three newly generated release notes. Unstaged Git checks had not inspected these previously untracked files.
- Trim trailing document whitespace in the renderer and append one newline. Regenerate pending outputs without changing record text or release content; no previously committed historical note or released record is rewritten.
- Add a regression preparing a release in an isolated Git fixture, staging files and checking the generated note with git diff --cached --check. No runtime, schema, data, dependency or release-version change.

## Validation

- Regression failed before correction because staged whitespace validation rejected the generated note. After correction, all 12 tracking tests passed. Regenerated release notes passed staged Git whitespace validation and changelog freshness/coverage.
- Pending notes and changelog regenerated through supported tooling; staged whitespace/freshness/coverage checked before the authorized commit.

## Files

- `scripts/change-tracking.cjs`
- `scripts/change-tracking.test.ts`
- `docs/releases/v0.2.0.md`
- `docs/releases/v0.3.0.md`
- `docs/releases/v0.4.0.md`

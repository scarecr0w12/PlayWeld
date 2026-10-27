# Preserve pending record links in release notes

**Release:** 0.23.0

**Impact:** none

**Category:** Documentation

## Summary

Correct five relative links in three pending work records so the generated 0.23.0 release notes can resolve their evidence references.

## Details

The release-note generator copies record prose into `docs/releases/`; bare sibling filenames therefore pointed into the wrong directory. Use `../changes/` for the five existing references, which resolves correctly from both record and release-note directories. Preserve their text, findings and historical qualification. These records were pending before this preparation; no previously released record or published note is rewritten. No application, schema, dependency or migration change is required.

## Validation

The first full link check identified the five broken release-note links. Regenerated notes contain the corrected destinations; the final complete link-check result is recorded with release preparation. This correction makes no runtime or installation claim.

## Files

- `docs/changes/2026-10-24-native-opener-fixture-cleanup.md`
- `docs/changes/2026-10-24-security-remediation.md`
- `docs/changes/2026-10-24-service-log-retention.md`

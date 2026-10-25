# Pin workflow actions and narrow publication authority

**Release:** Unreleased

**Impact:** none

**Category:** Security

## Summary

Make workflow token permissions explicit, grant publication write access only to the release job, and replace mutable third-party action tags with verified commit pins.

## Details

- Declare `contents: read` for CI and the Windows integration probe, retaining the currently read-only repository default as defense in depth. Change the release workflow's default to read-only and grant `contents: write` only to its publishing job; validation and package jobs no longer inherit publication write authority.
- Resolve each existing tag through GitHub's API and verify its commit date: checkout v4 at `11d5960a326750d5838078e36cf38b85af677262`, setup-node v4 at `49933ea5288caeca8642d1e84afbd3f7d6820020`, upload-artifact v4 at `ea165f8d65b6e75b540449e92b4886f43607fa02`, download-artifact v4 at `d3f86a106a0bac45b974a628896c90dbdf5c8093`, and action-gh-release v2 at `3bb12739c298aeb8a4eeaf626c5b8d85266b0e65`. All predate the seven-day preference. Keep version comments for maintainers and dependency tooling.
- Preserve workflow triggers, existing quality checks, concurrency, signing-secret references, draft/testing-release policy, local Spectre action and artifact behavior. Do not duplicate the weekly Actions-update configuration or private-reporting policy proposed in PR #8, mutate repository settings, dismiss alerts, or publish a workflow run.
- Compatibility and migration: no product/data change; no migration required. Workflow privilege changes are internal security maintenance with impact `none`. Hosted execution remains a separate verification boundary.

## Validation

- GitHub GET readback established the exact action commits and dates. Parsed all three workflows with the installed YAML parser and asserted read-only defaults, publisher-only `contents: write`, and full forty-character commit pins on every external action: passed. Formatting, diff whitespace and changelog coverage checks passed. No hosted run of these local changes or release/signing operation is claimed; local policy assertions do not validate hosted token behavior or clear remote CodeQL alerts.

## Files

- `.github/workflows/ci.yml`
- `.github/workflows/release.yml`
- `.github/workflows/windows-transport-probe.yml`
- `docs/changes/2026-10-24-workflow-security.md`

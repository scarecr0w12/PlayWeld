# Avoid duplicate and superseded CI runs

**Release:** 0.22.0

**Impact:** none

**Category:** Maintenance

## Summary

Limit push CI to main, retain PR checks, cancel superseded runs and cache npm downloads in the manual native probe.

## Details

- Every branch push and PR update previously could duplicate full quality/browser runs. Restrict push to main, while PR opened/synchronize/reopened/ready_for_review validates feature work including forks. Branches without PRs no longer automatically run CI. Tags retain the separate release workflow.
- Add workflow/PR-or-ref concurrency cancellation, keeping independent PRs separate. Preserve the complete Windows/Linux quality checks, browser build/smoke, evidence upload and existing npm cache. No path filters skip documentation PR validation.
- Add ref-scoped cancellation and setup-node npm download caching to the manual Windows native integration probe. Preserve protected-key and ordinary Node/Electron isolation checks. Native build output is not shared across hosts.
- Desktop Release remains unchanged. No new publication, deployment, secret, token permission, paid service or matrix expansion. No application/data/RPC change or migration; impact none reflects CI maintenance.

## Validation

- Existing installed YAML parser accepted both workflows with duplicate-key checks. Assertions confirmed main-only push, PR synchronize, cancellation, two CI jobs, probe npm cache and absence of new permissions/pull_request_target.
- Diff review confirmed retained checks and unchanged release workflow. Existing-checkout Prettier --check . passed in the isolated worktree.
- Application build/tests intentionally skipped because source is unchanged and focused validation avoids competing builds. Hosted execution remains subject to the draft PR run, not inferred from static checks. npm run changelog:update, npm run changelog:check -- --base HEAD and git diff --check passed.

## Files

- `.github/workflows/ci.yml`
- `.github/workflows/windows-transport-probe.yml`
- `docs/changes/2026-10-18-ci-run-efficiency.md`

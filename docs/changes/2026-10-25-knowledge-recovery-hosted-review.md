# Retain hosted knowledge-recovery checks and retry incomplete review

**Release:** 0.23.0

**Impact:** none

**Category:** Maintenance

## Summary

Record the hosted evidence for the knowledge lexical-index recovery candidate and retry the automated review that failed before producing a review. Integration remains conditional on the final PR checks.

## Details

- Rechecked [PR 18](https://github.com/scarecr0w12/PlayWeld/pull/18) at source commit `6ae5e8fd7837176d8499e61690a699ef824e67ff`. The Linux quality and browser jobs completed successfully; CodeQL and GitGuardian passed. The Windows job was still active when a documented ready-for-review trigger superseded the initial CI run. Cancellation is not a completed Windows result.
- The Kilo review check reported an output-limit failure and explicitly stated that no complete review was produced. There were no inline review threads or code findings to adjudicate. This is an incomplete review, not approval and not evidence of a source defect.
- GitHub's check-run and check-suite rerequest endpoints both returned HTTP 404 for the authenticated session. A draft-to-ready transition restarted CI, but no new Kilo review appeared on the same SHA. Kilo documents [ready-for-review triggers and PR/commit deduplication](https://kilo.ai/docs/automate/code-reviews/github). This evidence commit supplies a new commit for the supported push trigger without changing the model, review policy, branch rules, tests or source behavior.
- Re-read the store transaction, FTS-specific error gate, full-request scheduling, result metadata and corresponding regression tests against the PR diff. The repair is confined to the external-content lexical index; the original record retains the source/test evidence and remaining recovery limits. Final review feedback still requires evaluation before integration.
- The matching Features Project card will record the final PR/merge evidence after checks complete. Its combined recovery/retention scope remains In progress; no other card or planning field is part of this change.
- Compatibility and versioning: documentation/evidence only, impact none, product version 0.22.0 pending. No migration, dependency, RPC/schema, setting or runtime change. The original implementation record is preserved, including its local-test exclusions and evidence boundaries.

## Validation

- [Initial hosted CI run 40270177416](https://github.com/scarecr0w12/PlayWeld/actions/runs/40270177416): Linux completed all 33 build/typecheck/lint/test tasks; platform-service tests were 762 passed/16 skipped across 136 files. Tracking tests passed 13 cases; subsequent cache, version, references, documentation evidence, formatting and link checks passed. These are unexcluded hosted commands, distinct from the earlier local service exclusions.
- The same run's browser build and live UI smoke passed with an empty renderer-error list. CodeQL Actions, JavaScript/TypeScript and aggregate checks and GitGuardian passed on the source commit.
- Check metadata, bot discussion and inline review threads were read from GitHub. The failed Kilo review returned zero annotations and no complete review. Both rerequest POST calls returned 404. The same-SHA ready event started [replacement CI run 40271520041](https://github.com/scarecr0w12/PlayWeld/actions/runs/40271520041); it is interim evidence, not a final integration pass.
- Documentation formatting, changelog generation/coverage and relative-link checks are performed for this evidence change before commit. Final-head hosted results, any subsequent fixes and the merge receipt belong to the PR timeline and matching Project note; none are claimed as completed in this historical pre-integration record.
- No source tests were rerun locally for this documentation-only change. This does not qualify installed-product recovery, native opener behavior, a release, or broader corruption/retention work. Endpoint protection and the flagged executable were left unchanged.

## Files

- `docs/changes/2026-10-25-knowledge-recovery-hosted-review.md`
- `CHANGELOG.md`

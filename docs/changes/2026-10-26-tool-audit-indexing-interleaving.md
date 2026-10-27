# Make filesystem audit verification deterministic with background indexing

**Release:** 0.24.0

**Impact:** none

**Category:** Fixed

## Summary

Correct the tool-broker integration test's assumption that a newly created Project has no background tool calls. Verify the two filesystem audit records independently of the real startup Knowledge indexing call.

## Details

- PR 24's corrected-head Windows quality job failed at the filesystem audit test: the Project audit contained three rows instead of two. Project creation schedules a Knowledge reindex task, whose worker calls knowledge/index-execute through the same broker. A slower run can record that legitimate third call before the assertion. Linux and isolated local runs passed when indexing had not yet entered the audit; those passes did not establish deterministic behavior.
- Make the regression exercise this interleaving explicitly: find the startup knowledge.reindex task, wait for its successful completion using the existing task-state helper, and require its completed knowledge/index-execute audit row. Select the filesystem read/write records and still require exactly two rows, the exact returned write/read call IDs, and completed/allowed status. Duplicate, missing, denied or incomplete filesystem calls still fail. Remove temporary whole-row diagnostics after confirming the extra row's identity; do not weaken assertions or raise timeouts.
- Compatibility and migration: test-only correction, no production code, dependency, RPC, database or configuration changes; no migration required. Keep version 0.23.0 and impact none because no shipped application behavior changes.

## Validation

- Hosted Windows job 122012840589 on candidate 4e2bcda failed with one audit-count assertion (785 passed, ten skipped, one failed in platform-service). Linux's fresh full quality run and browser acceptance passed on that same candidate, but the candidate was not merged.
- Initial sandboxed local reproduction stopped at Git initialization permissions, before the assertion; rerunning outside that sandbox passed the isolated case. The entire unmodified-assertion integration file also passed all 17 cases. Adding an explicit wait for the real startup indexing task reproduced the exact three-versus-two failure locally and identified knowledge/index-execute as the third row.
- After correcting the audit assertions, the full tool-broker integration file passed all 17 tests in 19.51 seconds. The required local full quality gate passed all 33 tasks in 8 minutes 21 seconds, with 22 cached tasks and 11 executed; platform-service tests executed freshly. Existing Theia installer-handoff bundler warnings remained nonfatal. Repository-wide formatting, branch-base change-record coverage and diff checks passed. The local equivalent link check found zero failures across 389 Markdown files and 1,641 relative links. Final-head hosted CI and review remain required; earlier-head passes do not qualify subsequent source changes. No live engine/provider, desktop packaging or end-to-end trusted Entire capture is claimed.

## Files

- `packages/platform-service/src/tools/tool-broker.integration.test.ts`
- `docs/changes/2026-10-26-tool-audit-indexing-interleaving.md`

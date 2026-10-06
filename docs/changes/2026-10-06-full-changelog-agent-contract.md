# Retain full task detail in the versioned changelog and agent workflow

**Release:** 0.15.0

**Impact:** none

**Category:** Maintenance

## Summary

Generate a complete central changelog from permanent task records and require future agents to document each meaningful outcome and its version impact in detail.

## Details

- Previously the central changelog flattened each task's Summary into one paragraph and linked to its separate record for details. It now includes the full Summary, Details, Validation, and exact Files list under the task's version and category, retaining the source-record link. Multiline prose, lists, examples, and validation limitations remain available directly in CHANGELOG.md.
- Rebase local Markdown links from the task record directory to the central changelog location, including links to record-local anchors. Preserve external links and fenced code verbatim; nest embedded headings beneath the task sections.
- Strengthen AGENTS.md and the tracking contract so a summary paragraph cannot substitute for complete Details. Require concrete triggers and before/after behavior, rationale, all meaningful outcomes, explicit compatibility/migration/removal effects, version-impact rationale, actual commands/results, skipped checks, and evidence limits. Require review against the whole task diff; path coverage cannot establish prose accuracy or completeness.
- Expand the task template to prompt for these details and clarify the release guide's full-changelog requirement. Separate permanent task records and per-version release notes remain required. The central changelog can be read in full without following task links.
- Add a regression test that exercises multiline detail, nested headings, code fences, local and external links, validation, exact file lists, and complete entry retention when release preparation moves pending work into a numbered version. Existing coverage, record immutability, and version-impact checks remain in place.
- Compatibility and migration: no application, public API, persisted-data, schema, dependency, or package-version change. Historical task records and per-version release-note content remain preserved. Regenerate the central changelog from existing recorded evidence; do not fabricate missing historical detail.
- Impact rationale: none, because this is repository maintenance and generated documentation, with no shipped application behavior change. Keep the current version while this record is pending; a later release must assign pending records using release:version and satisfy the highest recorded impact.
- Preserve unrelated pending source/documentation/release work already present in the shared checkout. This record covers only the changelog generator, its regression coverage, and the documentation of this workflow.

## Validation

- Full repository build/typecheck/lint/test gate passed: 33 of 33 tasks, all served from the existing Turborepo cache. Dependencies were already installed; npm ci was not rerun against the shared active checkout.
- npm run test:changes passed: 25 tests across two files, including complete central entry rendering and existing version/coverage/immutability gates.
- npm run format:check and an explicit Prettier check of the changed scripts, instructions, guide, template, and task record passed. The explicit check includes paths ignored by the repository-wide formatter.
- npm run changelog:update and npm run changelog:check -- --base HEAD passed; git diff --check passed. Source review confirmed all 78 saved task records render as 78 complete central entries across 17 release groups, including Unreleased. Existing generated per-version release-note content was unchanged by regeneration.
- node scripts/check-release-version.cjs passed for the unchanged 0.14.0 workspace/lockfile versions. The new maintenance record remains Unreleased; no pending work was assigned by this task.
- Invoked scripts/check-links.sh using Git Bash. The owned scan remained active for over twenty minutes without completing or reporting errors; stopped that verified process tree after substituting an equivalent in-process scan. The substitute applied the shell checker's file/anchor, fenced-code, heading-slug, and external-link rules across all 268 Markdown inputs and 1,322 relative links: zero errors. The original shell command did not complete; its pass is not claimed. No link-checker source was changed.
- No installer, release preparation, tag, publication, engine/provider integration, or production acceptance was performed for this maintenance task. Automated checks cannot prove the truth or completeness of natural-language records; agent/reviewer diff review remains required.

## Files

- `AGENTS.md`
- `CHANGELOG.md`
- `docs/RELEASE_GUIDE.md`
- `docs/changes/README.md`
- `docs/changes/TEMPLATE.md`
- `docs/changes/2026-10-06-full-changelog-agent-contract.md`
- `scripts/change-tracking.cjs`
- `scripts/change-tracking.test.ts`

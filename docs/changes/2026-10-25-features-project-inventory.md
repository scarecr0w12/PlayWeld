# Populate the PlayWeld Features GitHub Project inventory

**Release:** 0.24.0

**Impact:** none

**Category:** Maintenance

## Summary

Populated the user-created [PlayWeld Features Project](https://github.com/users/scarecr0w12/projects/5) with 58 evidence-bounded feature/function cards: 27 Done, two In progress, 22 To do and seven Requested. Created 57 Project drafts and reused the existing Windows uninstall/rollback issue. The Project remains private and no v1.0 scope is accepted by this inventory.

## Details

- The user selected PlayWeld Features to track implemented, partially completed, remaining and requested functionality. After an initial missing-scope failure and expired device authorization, the user refreshed GitHub CLI permissions. Confirmed the exact owner, Project title, URL and ID before mutation; no credentials or device codes are retained in this record.
- Read the authoritative development plan, implementation status, confirmed requirements and open decision register. Created 57 descriptive Project drafts rather than opening 57 repository issues. Reused the sole preexisting Project item, [issue #3](https://github.com/scarecr0w12/PlayWeld/issues/3), retaining its issue body and setting its Project status to To do. Verified the final inventory has one matching card for each prepared title and no duplicate of that issue.
- Extended the existing Status field with To do and Requested while preserving the IDs, names, descriptions and colors of Backlog, Ready, In progress, In review and Done. Added Area as a single-select field and Reference as a text field; all 58 cards have the intended status, area and work-package/decision references. Existing priority, size, iteration, date and other fields were preserved; no priorities, estimates, iterations or release commitments were invented.
- Done cards cover independent Projects, desktop shell, settings, durable tasks, grouped requests, broker permissions, audit/export/cleanup, provider accounts, model routing/capacities, chat, optional decision assistance, skills/roles, MCP, discussion/decisions, plugins, engine operations and managed bridges, Knowledge/search/storage, generation/import, asset viewers, DCC, local backups/restore, Swarm/worktrees, external IDE integration, A2A and documentation. Their bodies distinguish repository implementation, fixture testing and selected live acceptance rather than implying exhaustive release readiness.
- In-progress cards distinguish WP19 packaging/release lifecycle from Q04 plugin SDK conformance/migration guidance. To do cards cover release trust/lifecycle, support and UI/accessibility/performance qualification, current full-gate evidence, plugin signatures/isolation, model-provider and judgment qualification, spending behavior, community MCP/A2A, wider engine/DCC/provider checks, asset inspection/conversion, remote backup/recovery, external action recovery, canon diffs, remote vector/plugin acceptance and remaining ledger/corruption handling.
- Requested cards represent existing unresolved product choices: existing-game onboarding, navigation/create/clone experience, creative feedback/progress, canon/module/genre semantics, cross-Project privacy, editor-extension privileges and optional in-place restore. They explicitly remain proposals or unresolved choices, not newly accepted requirements or automatic v1.0 scope. Existing implemented portions are described separately.
- Linked the Project to scarecr0w12/PlayWeld. Initialized its previously empty description and README with inventory purpose, status meanings, Area/Reference usage, source links, evidence boundaries and draft-to-issue guidance. The Project remains private. The development plan remains the owner of dependency ordering; no work-package status or user-confirmed design decision was changed.
- Temporary import data, resume-aware synchronization script and before/after receipts remain ignored under .turbo/feature-project-sync/. They are local execution artifacts, not a second committed feature register. The GitHub Project is the requested feature tracker; repository status/plan/register remain the sources for the initial inventory's implementation claims.
- Compatibility and migration: repository/provider maintenance only; no application, API, database, package-version or runtime migration. Version impact none because the change organizes existing work and requests without shipping application behavior. No commit, release, engine mutation, paid generation or ordinary-profile change was performed.

## Validation

- gh project list/view/field-list/item-list confirmed Project #5, exact title PlayWeld Features, private visibility, the existing five Status options and the sole preexisting issue #3. Inspected GitHub's live single-select input contract before updating options so original option IDs were retained.
- Parsed the staged JSON and verified 58 input entries. Synchronization completed with 57 created drafts and one reused issue; read back all 58 cards and checked exact title uniqueness, status, area and reference against every input row. The receipt reports zero mismatches and status counts of 27 Done, two In progress, 22 To do and seven Requested.
- gh project link 5 --owner scarecr0w12 --repo scarecr0w12/PlayWeld succeeded. Project README/description initialization succeeded. No new repository issues were opened.
- git check-ignore confirmed the temporary inventory is ignored. Work-record Prettier formatting, npm run changelog:update, npm run changelog:check -- --base HEAD and git diff --check passed after the publication record was updated. Final Project metadata readback confirmed 58 items, 21 fields and unchanged private visibility; field readback confirmed all five original Status option IDs were preserved.
- Documentation link checking was launched through the default bash runner during preparation, but its process result was unavailable after resumption. Restarted the required scripts/check-links.sh through explicit Git Bash with captured output/exit files; result remains pending at this record update and is not claimed as passing.
- Source builds, application tests, live provider/engine calls, paid generation, installer operations and release publication were skipped because this changes feature tracking and its permanent record, not application behavior. Implementation claims come from the cited existing records rather than new runtime qualification.

## Files

- `docs/changes/2026-10-25-features-project-inventory.md`

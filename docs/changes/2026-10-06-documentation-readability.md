# Improve documentation readability and navigation

**Release:** 0.15.0

**Impact:** none

**Category:** Documentation

## Summary

Organize PlayWeld's README and main guides around reader tasks, with clearer setup instructions, navigation, and tutorial outcomes.

## Details

- Rewrite the root README to introduce PlayWeld in plain language, offer task-based starting points, and present desktop setup before development-browser instructions. Retain compatibility naming, license, project resources, and links to design authority and current capability evidence.
- Reorganize the documentation index into goals, learning, audience guides, references, releases, design authority, and verification. Replace copied method/setting counts and historical test totals with links to the owning references and reports.
- Add task navigation to the user, operations, developer, integration, Control Room, and workflow guides. Preserve all pre-existing section headings and their anchors.
- Turn Project creation and settings precedence into readable steps and split dense model-routing prose without changing those rules.
- Replace blanket provider/release acceptance statements in the User Guide with links to dated status, work, and release records so the overview does not flatten operation-specific evidence.
- Add tutorial prerequisites, a linked walkthrough, completion checkpoints, and a troubleshooting route. Move detailed historical screenshot context into dedicated evidence sections in the tutorial and handbook; retain a short notice near the top.
- Add contributor guidance for reader-focused documentation: prerequisites, commands, UI names, success checks, stable links, and evidence limits. Move the work-record instructions into contribution review.
- Preserve existing uncommitted User Guide continuation instructions and Integration Guide first-party Unreal bridge documentation. No runtime, contract, dependency, decision status, version, or migration changes are part of this editorial task.
- This pass covers the primary entry points and guides. It does not rewrite every design document, research note, generated reference, or historical acceptance report.

## Validation

- Full repository build/typecheck/lint/test gate passed: 33 of 33 tasks, all served from the existing Turborepo cache. Dependencies were already installed; npm ci was not rerun against the shared active checkout.
- Repository format check passed. The explicit Markdown formatting pass covers the edited guides and records, which the repository-wide format command normally ignores.
- The repository link checker passed. Existing guide section headings and anchors were retained; new navigation targets resolve. Reviewed the editorial diffs, setup command names, screenshot-context relocation, and retained uncommitted additions.
- Changelog generation and changelog coverage check against HEAD passed. The documentation evidence check passed after the separately recorded inventory refresh.
- No new screenshots, live-engine, model-provider, installer, or usability-study evidence was collected. Historical screenshot evidence remains historical.

## Files

- `README.md`
- `docs/README.md`
- `docs/USER_GUIDE.md`
- `docs/OPERATIONS_GUIDE.md`
- `docs/DEVELOPER_GUIDE.md`
- `docs/INTEGRATION_GUIDE.md`
- `docs/WORKFLOW_COOKBOOK.md`
- `docs/CONTROL_ROOM_HANDBOOK.md`
- `docs/WORKED_TUTORIAL.md`
- `docs/changes/2026-10-06-documentation-readability.md`

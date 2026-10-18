# Expand the wiki into a practical user and technical handbook

**Release:** Unreleased

**Impact:** none

**Category:** Documentation

## Summary

Prepare a substantive 16-page wiki handbook with shared navigation, source-verified controls and canonical documentation links, on a separate review branch after PR #4.

## Details

- Start from merged main aa2366c in isolated docs/wiki-user-handbook; preserve the original app checkout, other worktrees, existing wiki initialization ownership and paused Marketing project. No application feature, dependency, credential, engine, provider or paid-operation changes.
- Replace link-only Home/sidebar with a task-oriented handbook map and shared footer. Installation explains Windows/Linux packages versus source prerequisites, checksum meaning, unsigned testing prereleases and separate engine/model setup. First Project explains the six-step wizard, immutable engine choice, workspace identity/layout and native-game distinction. Lantern Workshop gives isolated profile setup, fixture copying boundaries and observable discussion/lexical-search checks without submitting paid or agent work.
- Navigation maps exact PlayWeld menu labels to tab names and explains sections/Project selectors. Notes/discussions explains Markdown authority, thread lifecycle and explicit binding/synchronization. Tasks/impact explains Agent handoff, graph seed limits, questions versus approvals, cancellation, evidence and integration. Knowledge explains lexical-first use, indexing, embedding/storage prerequisites, remote data and stale-index recovery.
- Models/privacy/cost explains account discovery versus registration, eligibility, local-runtime requirements, active-file disclosure, access settings, profile-key limits, partial estimates and optional decision assistance. Engine/tools explains capability layers, identity, managed bridges and version-scoped evidence; MCP transport readiness and restricted A2A support remain distinct. Assets/skills/plugins explains review-before-import, collision/provenance, paid-generation boundaries, skill authority and plugin types.
- Settings/backups/updates explains supported scope precedence, preview/redacted export, empty-destination restore drills and testing/rollback limits. Troubleshooting supplies symptom triage, profile-specific service diagnosis and sanitized reports. Architecture/API explains service-owned durable state, authenticated framed transport, database seam and exact reference contracts. Development supplies source/build/check/contribution commands and work records. Verification separates implementation, scripted UI demonstrations, live named-operation evidence and installer lifecycle acceptance.
- Crosslink detailed canonical guides instead of reproducing volatile catalogs or test counts. Source inspection resolves menu labels and settings that differ from informal guide wording. Avoid propagating older guide claims that native IDE/MCP adapters are unimplemented; this suite makes no blanket execution-support claim. No standalone Notes/generic Tasks view is invented.
- Update internal wiki README with publication ownership/status, file-selection rules, preservation of intervening pages, content contract and inspected source matrix. Wiki remains enabled but uninitialized: Git remote returns Repository not found. Parent's existing browser task owns first-page initialization; actual publication requires its confirmation/handoff. This record does not claim publication or graphical wiki acceptance.
- Compatibility/migration: documentation only, no product/schema/version/storage/API changes or migration. Impact none reflects that scope. Source pages are reviewable in a draft PR; no direct main edits or merge.

## Validation

- Verified origin and current main identity, clean original checkout, separate branch/worktree and wiki enabled state. Read-only wiki Git lookup still returns Repository not found; no competing initialization or wiki writes.
- Focused checker passed 18 public page/navigation files and 91 links, resolving all wiki destinations and canonical local repository paths/heading anchors. Asserted current menu labels, five configuration keys and referenced npm script names against implementation. Commands are documented, not executed app/provider/engine operations.
- Formatted every wiki Markdown file with installed Prettier and checked repository formatting. Git diff whitespace check passed. No tool installation or shared dependency mutation.
- GitHub Markdown API rendered representative Home, installation, task/impact and architecture pages; HTML heading/table/code/navigation checks passed. npm run changelog:update, npm run changelog:check -- --base aa2366c and git diff --check passed. Full application build/test and full-tree Bash scan intentionally skipped for this documentation-only task; source inspection and Markdown rendering do not establish new live engine/provider/installer or graphical-browser acceptance.

## Files

- `docs/wiki/Home.md`
- `docs/wiki/Installation-and-Requirements.md`
- `docs/wiki/First-Project.md`
- `docs/wiki/Lantern-Workshop.md`
- `docs/wiki/Workspace-and-Navigation.md`
- `docs/wiki/Notes-and-Discussions.md`
- `docs/wiki/Tasks-and-Impact.md`
- `docs/wiki/Knowledge-and-Search.md`
- `docs/wiki/Models-Privacy-and-Cost.md`
- `docs/wiki/Engine-and-Tool-Integrations.md`
- `docs/wiki/Assets-Skills-and-Plugins.md`
- `docs/wiki/Settings-Backups-and-Updates.md`
- `docs/wiki/Troubleshooting.md`
- `docs/wiki/Architecture-and-API.md`
- `docs/wiki/Development-and-Contributing.md`
- `docs/wiki/Verification-and-Limits.md`
- `docs/wiki/_Sidebar.md`
- `docs/wiki/_Footer.md`
- `docs/wiki/README.md`
- `docs/changes/2026-10-18-wiki-handbook.md`

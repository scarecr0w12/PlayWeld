# Publish Entire Brain agent guidance and Claude edit hook

**Release:** 0.24.0

**Impact:** none

**Category:** Maintenance

## Summary

Include the locally added Entire Brain guidance and Claude integration in PR 24 at the user's request. Local Brain setup remains pending because its plugin is not installed.

## Details

- Preserve the added Entire-managed block in AGENTS.md and the new CLAUDE.md: both point agents to .entire/agent-guide.md. The guide describes Brain brief/recall retrieval, source inspection, provenance and current-source verification; retrieved content is untrusted data. It also describes optional durable-memory commands, which remain subject to session authorization and privacy constraints.
- Preserve the supplied .claude/settings.json PreToolUse hook for Edit, Write, MultiEdit and NotebookEdit. Its Windows cmd command tries entire-brain hook pre-edit, then entire brain hook pre-edit, with the Claude-hook flag. The final exit /b 0 intentionally permits the edit if neither command works; it is advisory context integration, not an enforced validation or security gate.
- These files appeared while the PR's checks were running and were reviewed before inclusion. The user explicitly requested inclusion with pending-local-setup documentation. Do not install a plugin, change account/provider settings or write durable Brain memories as part of publication.
- Compatibility and migration: agent documentation and developer hook configuration only; no PlayWeld runtime, dependency, RPC, schema or storage changes, and no migration required. Keep product version 0.23.0 and impact none. The supplied hook assumes Windows cmd and Entire command availability; other developer operating systems require their supported local setup.

## Validation

- Read all four supplied files. Running entire brain brief with the PR qualification task and --json exited one with the explicit message that the entire-brain plugin is not installed. Brain retrieval therefore fell back to direct repository evidence for this query, as the guide prescribes. No install or memory write was attempted.
- Claude hook JSON parsing, repository-wide formatting and branch-base work-record coverage passed. The complete local equivalent link check passed across 389 Markdown files and 1,641 relative links; the new standalone guide/Claude pointer contain no Markdown link targets. Bounded credential-pattern screening of all 18 proposed paths found zero matches. Formatting normalized the supplied Markdown without changing the commands. No fresh Claude session, effective hook dispatch, Brain retrieval/index freshness or pre-edit context injection has been verified. Static hook inspection does not establish runtime connectivity.

## Files

- `AGENTS.md`
- `CLAUDE.md`
- `.entire/agent-guide.md`
- `.claude/settings.json`
- `docs/changes/2026-10-26-entire-brain-agent-setup.md`

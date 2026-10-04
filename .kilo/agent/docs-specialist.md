---
mode: all
description: Scoped PlayWeld documentation editing with decision and evidence consistency
permission:
  task:
    '*': deny
    design-reviewer: allow
    research-verifier: allow
  edit:
    '*': deny
    'docs/*.md': allow
    'docs/**/*.md': allow
    'README.md': allow
    'AGENTS.md': allow
  bash:
    '*': ask
    'git status --short': allow
    'git diff': allow
    'git diff --stat': allow
    'npm run changelog:update': allow
    'npm run changelog:check*': allow
    'bash scripts/check-links.sh': allow
---

Read `AGENTS.md`. Load `gamecrafter-design-docs` before design edits and `gamecrafter-research-note` for research notes. Follow their standards; do not promote proposals or engineering defaults to user-confirmed requirements. Dependency ordering belongs only in `docs/DEVELOPMENT_PLAN.md`.

Make only the requested documentation changes. Preserve decision-register history, PlayWeld branding, and compatible GameCrafter identifiers. Update `docs/STATUS.md` in the same change when resolving a register entry or changing work-package status. Record exact affected paths, rationale, compatibility, and actual validation in a pending `docs/changes/` record. Generate the changelog using its script rather than editing generated output by hand.

Run the link check and change-tracking checks. Report blockers honestly, including coverage failures caused by concurrent unfinished work; do not claim other agents' changes or alter their records. Shell access can bypass edit restrictions, so approval for a command does not authorize unrelated writes.

---
description: Perform a scoped defensive PlayWeld security review without editing
agent: security-reviewer
subtask: true
---

Review $ARGUMENTS using `AGENTS.md` and `security-review`. With no scope, review the current uncommitted diff's trust-boundary changes only. Do not edit files, expose secrets, authenticate, or probe public services. Report verified defects separately from unverified candidates and optional hardening.

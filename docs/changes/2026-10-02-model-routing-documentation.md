# Model eligibility, routing and failure diagnosis guide

**Release:** 0.5.0

**Impact:** none

**Category:** Documentation

## Summary

Explain current model eligibility, pool selection and completion behavior so users can diagnose the actual request boundary without resetting unrelated account configuration.

## Details

- Document filtering stages and NoEligibleModel stage/removedBy context, applicable role/task pool intersection, manual-model eligibility and service-owned route/outcome records.
- Explain chat capability versus streaming preference/requirement and complete-response fallback, with current source references and local UI evidence.
- Map quality/exploration/cost/latency settings to their actual implementation limits. Unknown estimates are not rejected solely for being unknown, and successful routing does not guarantee future provider billing.
- Distinguish provider response, task/broker status, worktree integration and native acceptance. Retain paid-provider and reasoning-quality gaps, and avoid claiming universal retry/failover.
- Link the guide from the existing index, workflow cookbook and coverage inventory. No external vendor behavior, public schema, stored state, version or dependency change.

## Validation

- Fresh focused router/provider test run passed 16 tests across two files using repository fixtures; no live paid-provider request.
- Source inspection checked the route schema, filter sequence, pool rules, settings, completion service and Chat widget. Existing combined UI screenshots retain their earlier dates and synthetic-provider scope.
- Final documentation links passed through WSL. Repository and explicit guide/record formatting, generated system references/documentation inventory, Git whitespace and changelog coverage/freshness passed. The full repository gate passed all 33 tasks from valid Turbo cache during this documentation-only continuation.

## Files

- `docs/MODEL_ROUTING_GUIDE.md`
- `docs/README.md`
- `docs/WORKFLOW_COOKBOOK.md`
- `docs/DOCUMENTATION_COVERAGE.md`

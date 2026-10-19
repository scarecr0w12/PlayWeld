# Refresh integrated model discovery and agent fix documentation inventory

**Release:** 0.22.0

**Impact:** none

**Category:** Maintenance

## Summary

Refresh the generated documentation inventory after integrating the model discovery repair, ten agent and Swarm fixes, remote CLI diagnostics, and current main documentation.

## Details

- Regenerate both documentation inventory artifacts so their service test paths and subsystem test counts include the new policy, budget, cancellation, dependency, worker, role, and skill regression files. The previous inventory was stale after the runtime fixes; counts describe source coverage rather than live acceptance.
- Preserve the existing model discovery work and the remote CLI startup diagnostic commit while integrating current main. Only the generated central changelog conflicted in either merge; regenerate it from all permanent records so neither branch's history is lost.
- This integration maintenance introduces no runtime behavior, dependencies, migration, or version change. The earlier model discovery change retains its separately documented additive migration 19; the product version remains 0.21.1. Publication and merge are separate GitHub operations, not release or installer deployment.

## Validation

- The complete agent-fix verification preceding integration passed all 33 build, typecheck, lint and test tasks, including both application builds: 887 tests passed and seven skipped. Detailed results and limitations remain in the individual fix records.
- After integrating remote CLI diagnostics and main, the focused platform-service CLI test passed (one file, one test). Release-version validation, generated system reference freshness, documentation evidence integrity and branch-wide changelog coverage passed. The documentation inventory freshness check detected the missing new test paths, prompting this regeneration.
- After regeneration, documentation inventory freshness, repository formatting, branch-wide changelog coverage and whitespace checks passed. The earlier remote model discovery head also completed Windows quality, Ubuntu quality and Theia browser build/UI smoke CI successfully; those results precede this integrated head.
- No new paid-provider, live engine, installer, or installed desktop acceptance was performed for this documentation integration.

## Files

- `docs/reference/DOCUMENTATION_INVENTORY.md`
- `docs/reference/documentation-inventory.json`
- `docs/changes/2026-10-18-model-discovery-integration-readiness.md`

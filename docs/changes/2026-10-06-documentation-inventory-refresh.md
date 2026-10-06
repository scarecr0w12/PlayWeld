# Refresh documentation surface inventory

**Release:** 0.15.0

**Impact:** none

**Category:** Documentation

## Summary

Regenerate the documentation inventory so discovery and evidence checks include the current service source tree.

## Details

- The documentation evidence check found that the retained inventory omitted the existing dependencies subsystem. Regenerate both inventory outputs with the existing generator.
- Refresh discovered regression-test paths for current engine and worker sources, including the later managed-editor and installer-handoff tests. The generator continues to describe test paths as discoverability, not acceptance.
- No generator, runtime, schema, version, compatibility, or migration changes.

## Validation

- Initial node scripts/check-documentation-evidence.cjs failed because the inventory did not include the dependencies directory already present before this task.
- node scripts/generate-documentation-inventory.cjs and its --check mode passed.
- node scripts/check-documentation-evidence.cjs passed after regeneration: 198 methods, 28 notifications, 85 settings, 26 service subsystems, 16 Control Room surfaces, 10 capture reports, and 151 referenced PNG files.
- These checks establish inventory/report/file integrity only. They do not validate prose layout or repeat historical live workflows.
- Repository link check and changelog coverage check against HEAD passed. Generated inventory freshness passed. No historical report or screenshot was regenerated.

## Files

- `docs/reference/DOCUMENTATION_INVENTORY.md`
- `docs/reference/documentation-inventory.json`
- `docs/changes/2026-10-06-documentation-inventory-refresh.md`

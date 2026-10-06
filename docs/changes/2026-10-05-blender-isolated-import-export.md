# Isolate headless Blender asset imports and create export directories

**Release:** 0.13.0

**Impact:** patch

**Category:** Fixed

## Summary

Fix imported and converted assets containing Blender's default cube, camera and light, and failures exporting to a new nested Project directory.

## Details

- Start the separate headless import and conversion processes with an empty factory scene before loading the asset. Preserve loaded source scenes and live user sessions.
- Create output parent directories only after the existing Project output-path guard resolves the destination. Preserve path restrictions and existing export behavior.
- Add an installed-Blender regression that exports to a new nested directory, imports exactly one mesh without cameras or lights, and converts it without adding another mesh.
- Compatibility: no contract, dependency, persisted-state or migration changes.

## Validation

- Reproduced the defect against installed Blender 5.2.2: importing the single-mesh fixture reported two meshes. The regression failed before the fix and passed afterward.
- DCC test suite passed 11/11 across five files, including the real Blender connector tests. Platform service build passed.
- The RPG's original native export failure remains recorded. Restarted the owned source service with the rebuilt adapter; all eight native operations passed: discover, import, inspect, validate, export to a new directory, conversion, rendered preview and settlement-source validation. These are actual Blender 5.2.2 connector results, distinct from packaged-app acceptance.
- Full repository gate initially hit an Electron `conpty.node` EBUSY while the owned source desktop was open. Closed only that test desktop through its CDP endpoint and reran successfully: 33/33 Turbo tasks, 519 platform tests passed with 11 skips. Final format/change-tracking refresh is pending.
- The latest full gate after the additional completion/question fixes passed 33/33 tasks, with 527 platform tests passed and 11 skips. Formatting, change tracking and the required documentation link script passed. Reopened and verified the actual source-built Electron desktop with Ashen Covenant explicitly selected in Knowledge.

## Files

- `packages/platform-service/src/dcc/adapters/blender.ts`
- `packages/platform-service/src/dcc/scripts/blender.ts`
- `packages/platform-service/src/dcc/blender-real.test.ts`
- `docs/changes/2026-10-05-blender-isolated-import-export.md`

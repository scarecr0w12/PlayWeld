# Restore Sample Hello compatibility with the current platform

**Release:** 0.5.0

**Impact:** patch

**Category:** Fixed

## Summary

Repair the bundled sample plugin's manifest so the current 0.4.0 platform can inspect and install it.

## Details

- The actual Plugins UI rejected Sample Hello because its ^0.1.0 platform range excludes later pre-1.0 minor versions. Set its platform range to >=0.1.0 <1.0.0 while preserving plugin protocol 1, ID, sample version, capabilities and prior 0.1.x installation compatibility.
- Add a real installer regression using the current workspace version read from its package manifest. Existing tests using a fixed 0.1.0 service version could not catch this drift. The plugin is an SDK example; the range does not certify every future pre-1.0 runtime.
- Preserve fail-closed Windows runtime isolation. No schema/data migration or installed user-plugin rewrite; existing installed copies retain their own manifest until deliberately reinstalled.

## Validation

- All seven PluginInstaller tests passed, including the current-version sample inspection/install and existing compatibility/capability rejection checks.
- Actual UI inspection, privilege acceptance, installation/enablement and uninstall passed after the correction. Start reports the existing unavailable Windows isolation capability; no worker/tool acceptance claimed on that host.

## Files

- `packages/plugins/sample-hello/gamecrafter-plugin.json`
- `packages/platform-service/src/plugins/plugin-installer.test.ts`

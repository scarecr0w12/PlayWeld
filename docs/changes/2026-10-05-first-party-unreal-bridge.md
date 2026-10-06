# Replace the vendor editor path with a PlayWeld-owned plugin

**Release:** 0.13.0

**Impact:** minor

**Category:** Added

## Summary

First-party Unreal editor bridge following the user's explicit instruction not to depend on a third-party in-editor plugin.

## Details

- Stopped the owned CodeFizz acceptance editor, disconnected and disabled the test Project's vendor MCP connection, removed its enabled Project reference and quarantined the newly installed vendor plugin outside the active Plugins directory. Unrelated installations and the FourSquare Project were preserved. No vendor bridge acceptance or production dependency is claimed.
- Added opt-in editor-only PlayWeld C++ module source and build descriptor. The owned module implements MCP identity/read-only inspection over engine-native HTTP with loopback binding, bearer authentication and Windows DPAPI ciphertext credential loading. No model or AI provider runs inside the editor.
- Added five editor tools: identity, bounded inspection, owned-actor spawn/transform/delete, active-viewport PNG capture and console execution. Scene edits use editor transactions and do not save the campaign map. Console remains classified destructive and Restricted-mode invocation is denied by the platform broker.
- Added service-managed source installation and protected pairing tools. Installation preflights source hashes and preserves modified local code, backs up the Project descriptor, enables the plugin only for editor targets and retains existing plugin choices. Pairing validates the exact Project file and loopback endpoint, stores bearer credentials through encrypted MCP storage and binds the existing engine bridge. Build assets now include the first-party plugin source. Native managed install, pairing and editor restart recovery passed. Packaging and broader authoring acceptance remain separate checks.
- No existing GameCrafter compatibility identifiers, provider choices or saved game data were renamed. New plugin source is Apache-2.0 under the repository license.

## Validation

- Native PlayWeld broker rollback completed and confirmed the owned vendor plugin is absent from the active Project Plugins directory. MCP connection disabled. Exact local evidence is retained under the ignored RPG acceptance artifacts and the external Project's Tools/Evidence/DisabledVendorPlugins directory.
- Initial first-party source was checked against installed Unreal 5.8.3 HTTPServer interfaces. The first native compile failed on the request-handler delegate binding; corrected it to the engine's typed delegate and switched the Windows cryptography dependency to the system-library declaration. Second native build `01a10ec0-a04e-756c-ae23-de5ec7ec06f7` compiled and linked the owned plugin successfully. Retained the failed build. Later live verification is recorded below.
- Expanded editor operations compiled successfully in native build `01a10ecc-0d23-721c-8e97-e9df350f14c8`, after retaining/correcting a failed world-destruction/output-device API compile. Live authenticated MCP identity and inspection passed; missing/invalid auth returned401 and browser origin returned403. After separate MCP race/scope repairs, native engine operations passed spawn, transform readback, screenshot, console and owned cleanup. Exact engine runs: `01a10ed2-2aba-71a5-ab9c-c7c090c77385`, `01a10ed2-548a-7e33-8d28-ee89b06f0f85`, `01a10ed2-7e95-7cdd-b712-ca8b8c5f2275`, `01a10ed2-7f1e-7589-9e1d-2452d6e70bad`. Independent inspection confirmed the actual editor viewport PNG. Foreign Project and Restricted console calls were rejected with ToolDenied.
- Four managed-tool tests passed: preservation/idempotent protected credential installation, local edits, traversal/foreign/remote identities and encrypted MCP pairing output. Platform build/typecheck/lint passed. Live managed-tool results are recorded below; final gate results are recorded below.
- Native managed install `01a10ee0-9131-7aff-9b1c-65f8d1e180b7` and connect `01a10ee0-9152-72ab-982f-30864a5319ac` passed against the actual Project/editor. The service independently proved the editor's exact Project file before binding; capabilities then reported the live layer ready. Matching credentials stayed encrypted in MCP storage and DPAPI ciphertext on disk. Fresh 0.14.0 service recheck passed install/pairing, all five editor operations and actual rejection of foreign-Project and Restricted console calls. Stopping the owned editor made stale pairing fail; restarting it recovered live readiness with its new PID/endpoint. A plaintext scan of 1771 source/evidence/metadata/log files found zero matches for the actual protected credential. Final 0.14.0 gate passed 33/33 (540 platform tests/11 skips). Packaged source matched all six plugin/license files; managed installation/pairing also passed through the bundled 0.14.0 service against the actual editor. The packaged desktop smoke passed 29 checks without renderer errors. Ordinary 0.14.0 installation matched25 repaired runtime/plugin files, including all six owned plugin files, and passed 29 installed desktop checks. Live Unreal operations were exercised in the isolated RPG acceptance profile rather than modifying ordinary game Projects. The owned acceptance editor was stopped afterward; RPG/art production remains paused.

## Files

- `integrations/unreal/PlayWeldEditor/PlayWeldEditor.uplugin`
- `integrations/unreal/PlayWeldEditor/README.md`
- `integrations/unreal/PlayWeldEditor/Source/PlayWeldEditor/PlayWeldEditor.Build.cs`
- `integrations/unreal/PlayWeldEditor/Source/PlayWeldEditor/Private/PlayWeldEditorModule.cpp`
- `docs/changes/2026-10-05-first-party-unreal-bridge.md`
- `packages/platform-service/src/engines/unreal/editor-bridge-tools.ts`
- `packages/platform-service/src/engines/unreal/editor-bridge-tools.test.ts`
- `packages/platform-service/src/engines/engine-connector-service.ts`
- `packages/platform-service/scripts/copy-assets.cjs`
- `docs/INTEGRATION_GUIDE.md`
- `docs/STATUS.md`
- `integrations/unreal/PlayWeldEditor/LICENSE`
- `integrations/unreal/PlayWeldEditor/NOTICE`
- `packages/platform-service/src/tools/tool-broker.integration.test.ts`

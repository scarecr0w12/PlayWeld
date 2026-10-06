# Managed Unity, Unreal and Godot editor bridges

**Release:** 0.15.0

**Impact:** minor

**Category:** Added

## Summary

Add project-local Unity and Godot editor bridges and install/pair actions in the Engine panel. Extend managed installation and identity validation across all three supported engines, with real editor acceptance evidence.

## Details

- The existing editor-bridge tools now accept an explicit Unity Project folder, Unreal .uproject or Godot project.godot inside the selected PlayWeld Project. Installation checks owned source hashes before replacing files, preserves user edits and unrelated plugins, writes protected pairing credentials and records repeatable source ownership. Existing tool IDs remain compatible.
- Unity installs a dependency-free Editor script. Godot installs and enables its addon alongside existing addons. Unreal retains its Editor-only plugin activation. Native configuration snapshots are retained before modifications; unsupported Godot plugin syntax is rejected before source writes.
- Add managed Unreal compilation through a registered matching RunUAT installation. Only trusted bundled source can be compiled; short owned scratch avoids the reproduced Windows path-length failure. Engine/source fingerprints and binary hashes permit repeat builds to reuse matching owned binaries while preserving modified/untracked files. Compilation requires closing the native editor; cancellation stops only the owned build tree.
- Unity and Godot publish authenticated loopback MCP endpoints automatically on editor startup, with bounded HTTP requests, concurrency and timeouts. Pairing decrypts credentials inside the service, stores protected MCP credentials, verifies engine/server/native Project identity and binds the live layer. Plaintext pairing credentials are absent from session metadata and tool results.
- Unity uses Windows DPAPI through the native API, current GlobalObjectId APIs, main-thread editor operations and session-owned object tracking. Asset import workers do not start a bridge. Godot supports Windows and the installed WSL Godot using Windows credential interoperability; ordinary native Linux pairing remains unsupported. Godot Undo actions preserve node ownership. Both support scene inspection, owned object creation/movement/deletion and viewport capture, without arbitrary code execution.
- Unreal inspection now enumerates bounded actor records and ownership/locations. Its scene mutation path refuses Play-in-Editor changes. Existing actor class restrictions and owned actor tags remain in force.
- The Engine panel exposes install, build and pair controls with engine-specific guidance, native-path suggestions only for proven unambiguous evidence, and an owned-object edit form. Unreal compilation after installation is enabled by default. Project changes clear native paths; completion/error/log responses are guarded against stale Project context. Automatic source application preserves modified plugin source and unsaved editor work.
- Scene inspection is bounded to 2,000 objects. Unity bounds its main-thread queue and cancels expired queued requests before they can mutate the scene; Godot rejects unsupported HTTP methods before processing tools.
- A final Unreal startup run reproduced a listener failure on port 59252, inside the host's Windows excluded range. The bridge now reserves an OS-assigned IPv4 loopback port and retries the reservation-to-HTTP-listener race up to eight times, preserving explicit loopback binding and existing listener configuration. It never falls back to a public bind.
- Godot live acceptance found that service pairing accepted project.godot but capability refresh recognized only .uproject identity files. Capability identity now recognizes the validated Godot native file as well.
- Compatibility and migration: no persisted schema or package identity changes. Unity objects created in an earlier bridge session are not granted edit ownership after reload. Scene edits remain dirty and require ordinary editor save behavior. Compatible engine/editor integration features warrant minor impact.

## Validation

- Real Unity 6000.6.0f1 acceptance passed 11 checks at `.artifacts/editor-bridge/1791322530517-unity/report.json`: repeat installation, protected credential retention, automatic startup, verified pairing/identity, unauthenticated refusal, spawn/move, user-object refusal, owned deletion, ready live layer and viewport capture.
- Real Unreal 5.8.3 passed 14 checks at `.artifacts/editor-bridge/1791324194385-unreal/report.json`, including compilation/application through the actual managed PlayWeld tool and reuse of matching binaries, followed by the real editor operations.
- Real Godot 4.7.2 through WSL passed the equivalent 11 checks at `.artifacts/editor-bridge/1791322616619-godot/report.json`.
- Earlier failures exposed removed Unity APIs, unavailable managed DPAPI, deferred startup, WSL command quoting and the Godot capability comparison; failed artifacts remain retained. The final runs exercise actual PlayWeld broker and service calls, not fixture MCP servers.
- The combined repository gate passed all 33 tasks, with 557 platform tests/six skips and 128 extension tests. Managed installation and Engine guidance regressions passed. The source-built Electron audit passed 196 checks at 1920 x 1080, 1440 x 1000 and 1024 x 900 with no findings or renderer exceptions; the Live bridge capture was visually inspected.
- Visual inspection exposed empty-scene captures as weak evidence. The harness now supplies visible user-owned cube fixtures and retains their mutation-refusal checks; Unity/Godot reruns pass all 11 checks each. Unreal also uses an explicitly framed disposable viewport fixture. These are editor-only authoring checks, not game runtime, arbitrary Project correctness or a new packaged deployment.
- The final Unreal run passes all 14 checks after the reserved-port fix, binds to OS-assigned loopback port 63522 and captures a visibly rendered cube. Unity, Godot and Unreal viewport images were inspected directly. The earlier dark captures, unsupported fixture-only `viewmode` console attempt and reserved-port startup failure remain retained; the fixture now uses the supported camera-alignment command and explicit actor position.
- The final post-port-fix gate at `.turbo/adversarial-review/remaining-gaps-port-fix-quality.log` passes 33/33 tasks (22 verified cached tasks), including 557 platform tests/six skips and 128 extension tests. Repository formatting, generated RPC/settings references, documentation inventory/evidence integrity, local Markdown links, 0.14.0 workspace/lockfile agreement and diff checks pass. The change ledger is regenerated and coverage checked against HEAD. No new installer, hosted run or ordinary deployment is claimed.
- Update current status, dependency-plan evidence, integration instructions and documentation navigation. Historical acceptance remains labeled; no confirmed decision, release version or ordinary Project is changed.

## Files

- `integrations/unity/PlayWeldEditor/PlayWeldEditorBridge.cs`
- `integrations/godot/PlayWeldEditor/plugin.cfg`
- `integrations/godot/PlayWeldEditor/bridge.gd`
- `integrations/unreal/PlayWeldEditor/Source/PlayWeldEditor/Private/PlayWeldEditorModule.cpp`
- `packages/platform-service/src/engines/unreal/editor-bridge-tools.ts`
- `packages/platform-service/src/engines/unreal/editor-bridge-tools.test.ts`
- `packages/platform-service/src/engines/unreal/editor-bridge-build.ts`
- `packages/platform-service/src/tools/tool-broker.integration.test.ts`
- `packages/platform-service/src/engines/engine-connector-service.ts`
- `packages/platform-service/scripts/copy-assets.cjs`
- `packages/theia-control-room/src/browser/engine-widget.tsx`
- `packages/theia-control-room/src/browser/engine-widget.test.tsx`
- `scripts/editor-bridge-acceptance.cjs`
- `docs/EDITOR_BRIDGE_ACCEPTANCE.md`
- `docs/STATUS.md`
- `docs/DEVELOPMENT_PLAN.md`
- `docs/ADVERSARIAL_SYSTEM_REVIEW.md`
- `docs/INTEGRATION_GUIDE.md`
- `docs/README.md`
- `docs/changes/2026-10-06-managed-editor-bridges.md`

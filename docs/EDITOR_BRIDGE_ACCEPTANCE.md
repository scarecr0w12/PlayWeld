# Managed editor integration acceptance

**Last verified:** 2026-10-06

PlayWeld supplies editor-only Unity, Unreal and Godot bridges. They identify the running native Project, inspect its scene, create and move bridge-owned objects, remove those owned objects and capture the viewport. They do not put a model or runtime AI into a game.

## Apply an editor bridge

1. Select the PlayWeld Project in **Engine → Live bridge**. Native Unity and Godot files belong in that Project's `game` folder. Unreal uses the explicit `.uproject` identified by its connector.
2. Check the **Native Project path**. Unity normally uses `game`; Godot uses `game/project.godot`; Unreal uses the actual `.uproject` path. Proven unambiguous paths are suggested automatically; unknown or ambiguous paths remain empty.
3. Choose **Install editor plugin**. PlayWeld checks previously owned source hashes, preserves modified source and existing plugins, applies the editor files and creates a Windows CurrentUser DPAPI-protected pairing credential.
4. Unity imports its Editor script and Godot enables its addon. For Unreal, register its `RunUAT.bat` installation. **Compile Unreal plugin after installation** is enabled by default; the separate **Build editor plugin** action can retry compilation. Close the native editor before rebuilding. PlayWeld compiles only its known first-party plugin source, uses short owned build scratch, records binary ownership and preserves modified/untracked binaries. Matching source and engine build fingerprints permit reuse.
5. Open or reload the native Project in its editor, then choose **Pair running editor**. PlayWeld validates the loopback endpoint, server identity and native Project identity before binding the live layer. Pairing credentials stay out of session metadata and returned results.
6. Inspect the scene before editing. The owned edit form provides an action, a JSON location vector such as `[1, 2, 3]`, and the object's identifier. Unreal also supplies its allowed actor class and label fields. Changes remain dirty; save them normally in the native editor.

Unity ownership is restricted to objects created by that bridge session. Reloading does not grant ownership over earlier or user-authored objects. Unreal and Godot use their explicit owned actor/node markers. Scene inspection is bounded to 2,000 root objects/actors. Arbitrary Python, C#, GDScript or console execution is not exposed by the Unity/Godot bridges. Unreal's existing console tool retains destructive broker classification.

The current pairing implementation supports a Windows service. Godot 4.7.2 in WSL also pairs through Windows credential interoperability and localhost forwarding. Ordinary native Linux/macOS pairing is not verified or supported by this credential path.

## Current live evidence

Every run uses a timestamped disposable Project and isolated service profile. The harness calls actual PlayWeld install/build/pair tools and the real editor's MCP tools through the platform broker. It stops only the editor processes it starts.

| Target | Artifact | Observed result |
| --- | --- | --- |
| Unity 6000.6.0f1, Windows | `.artifacts/editor-bridge/1791322530517-unity/report.json` | 11 checks passed: installation, repeat credential retention, automatic startup, pairing and identity, unauthorized refusal, scene spawn/move, user-object refusal, owned deletion, ready live layer, viewport image. |
| Unreal 5.8.3, Windows | `.artifacts/editor-bridge/1791324194385-unreal/report.json` | 14 checks passed, including visible scene capture, managed RunUAT compilation/application and binary reuse, then the equivalent real editor checks. |
| Godot 4.7.2, WSL on Windows | `.artifacts/editor-bridge/1791322616619-godot/report.json` | 11 equivalent checks passed. The captured viewport uses WSL's reported OpenGL/Mesa environment; it is not a GPU performance measurement. |

Earlier failed runs remain retained. They exposed Unity API removal/managed DPAPI compatibility, deferred startup, WSL PowerShell argument handling, a Godot native-file comparison omission and Unreal's generated-path limit. The fixes are recorded in [the permanent work record](changes/2026-10-06-managed-editor-bridges.md).

Final-source Unity and Godot reruns passed all 11 checks each after the inspection/request bounds were added. Packaged acceptance remains separate. These artifacts prove the named authoring workflows; they do not establish arbitrary game correctness, production asset quality, other engine versions, signing or installation lifecycle behavior.

Run the retained acceptance harness after building the service:

```powershell
node scripts/editor-bridge-acceptance.cjs unity
node scripts/editor-bridge-acceptance.cjs unreal
node scripts/editor-bridge-acceptance.cjs godot
```

The harness uses the installed D-drive Unity/Unreal paths and installed WSL Godot. Its Unreal fixture derives from the retained disposable baseline, not an ordinary game Project.

## Windows plugin worker isolation

Editor bridges and platform plugin workers have different execution boundaries. The editor bridges use an explicit authorized native Project and brokered scene actions. Untrusted platform plugin workers use the new Windows LPAC/Job backend.

`.artifacts/windows-isolation/1791324154239/report.json` contains passing Node and Electron Node-mode checks for private host-file denial, All Application Packages-file denial, source-write denial, scratch writes and network denial. Shared integration tests now run Node/Python plugin lifecycle, broker calls and secret-redaction checks on Windows. Source and scratch permissions, Job process/memory limits and fail-closed diagnostics remain enforced; a missing helper does not silently enable unrestricted execution.

The same retained report proves that killing the owned helper terminates both its worker and spawned descendant. Custom profile scratch paths must permit the native mandatory-label change; the managed workspace ACL denied it during one retained failed fixture, and execution stayed fail-closed. The passing process fixture uses owned temporary storage.

Outbound network capability does not create a loopback exemption or a host allowlist. Host-specific egress rules, process/memory-limit exhaustion and broader OS matrices remain separate evidence requirements.

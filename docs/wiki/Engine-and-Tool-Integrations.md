# Engine and tool integrations

Install/license editors separately. Registered executables, connected servers and identity-verified editors are distinct states. Start with a disposable game.

## Inspect capability layers

In **PlayWeld > Build & Connect > Engine**, select the Project, detect/register installations and refresh capabilities after adding native files.

| Layer            | Meaning                                                               |
| ---------------- | --------------------------------------------------------------------- |
| project-file     | Supported native-file operations                                      |
| headless-process | Implemented batch/commandlet operations using a registered executable |
| live-editor      | Operations from a connected identity-verified bridge                  |

Inspect reason/status first; inspect logs, parsed tests, exit code and artifacts afterward. Exit zero alone does not establish passing tests.

## Editor bridges and live evidence

Current source provides **Install editor plugin**, Unreal **Build editor plugin** and explicit connection operations. Supply the real native Unity folder, Unreal .uproject or Godot project.godot within the selected Project. Reload/open the editor as instructed and verify exact Project identity before edits.

Recorded Windows operations cover Unity 6000.6.0f1, Unreal 5.8.3 and Godot 4.7.2. The owned Unreal PlayWeldEditor bridge is editor-only with no in-editor model dependency. Other versions/targets, arbitrary authoring and complete lifecycle remain separate. Historical CodeFizz evidence is optional compatibility history.

**Creative Tools** opens **DCC Tools**. Blender 5.2.2 LTS has scoped scene/export/render evidence; other adapters need live installed-tool verification.

## External connections

**Tool Connections** separates **Servers**, **Add connection**, **Tool safety**, **Logs** and **A2A agents**. Configure Command/Endpoint/Docker, save, explicitly connect, inspect negotiation and classify effects. Transport readiness does not prove editor identity.

A2A is separate from MCP. Its implemented JSON-RPC/text/static-credential scope and local inbound grants do not imply public inbound access, OAuth, gRPC or webhooks.

Use [integration details](https://github.com/scarecr0w12/PlayWeld/blob/main/docs/INTEGRATION_GUIDE.md), [editor acceptance](https://github.com/scarecr0w12/PlayWeld/blob/main/docs/EDITOR_BRIDGE_ACCEPTANCE.md) and [live acceptance](https://github.com/scarecr0w12/PlayWeld/blob/main/docs/LIVE_ENGINE_ACCEPTANCE.md) for exact prerequisites and limits.

# PlayWeld integration and extension guide

**Last updated:** 2026-10-06

**Audience:** Engine, DCC, MCP, skill, role, plugin and provider integrators. [Documentation index](README.md).

## Choose what you are connecting

| Integration                            | Section                                                             |
| -------------------------------------- | ------------------------------------------------------------------- |
| Unity                                  | [Unity connector](#unity)                                           |
| Unreal Engine                          | [Unreal connector and editor bridge](#unreal)                       |
| Godot or a DCC application             | [Godot and DCC](#godot-and-dcc)                                     |
| An MCP server                          | [MCP connections](#mcp-connections)                                 |
| Agent instructions or responsibilities | [Skills](#agent-skills) · [Roles](#roles)                           |
| Executable platform extensions         | [Plugins](#executable-plugins)                                      |
| Model or asset-generation providers    | [Providers](#model-and-generation-providers)                        |
| Validation for a new integration       | [Acceptance checklist](#acceptance-checklist-for-a-new-integration) |

Start by identifying the installation, connection, and Project binding you need. Check the capability report before requesting an operation; available actions depend on the connector and execution layer.

## Integration boundaries

An installation identifies an executable and version. A connection identifies a server transport and launch/endpoint configuration. A bridge binding associates that connection with a Project. A capability report describes which operations are available through which layer. These are distinct objects.

The service executes operations through contracts, access policy, validation, run records and evidence collection. UI labels and external tool names must not substitute for identity evidence. For the complete target contract, read [skills, agents and tools](SKILLS_AGENTS_AND_TOOLS.md); for current records, use the [RPC reference](API_REFERENCE.md).

## Engine layers

| Layer            | Inputs                                                 | Typical evidence                                                  | Limitation                                          |
| ---------------- | ------------------------------------------------------ | ----------------------------------------------------------------- | --------------------------------------------------- |
| Project file     | Native files under the Project's `game/`               | Manifest/import/config inspection                                 | Cannot prove a graphical editor is attached         |
| Headless process | Engine executable, project path, arguments and timeout | Command, exit status, stdout/stderr, parsed tests/build artifacts | Does not prove editor interaction or physical input |
| Live editor      | Connected MCP bridge with matching live identity       | Actual identity reply and editor tool artifacts                   | Requires correct open editor and available tools    |

Supported engine families are Unity, Unreal and Godot. Operation names include discover, inspect, import, check, build, test, run, export, validate, edit-scene, screenshot and console. Their presence in the schema is not a promise that every connector provides every operation; capability reports select availability and execution mode.

Installations record family, executable, kind, version and whether detection or manual registration supplied them. Prefer absolute host-native executable paths. Set the preferred engine version in the Project manifest without changing its family.

`engine/run` returns a durable operation record. Inspect `status`, exit code, logs and report artifacts. A broker denial or missing screenshot can become a failed record without throwing a transport error. Test acceptance parses the engine's report rather than trusting a successful process exit alone.

## Unity

PlayWeld now supplies a dependency-free Editor bridge as well. **Engine → Live bridge → Install editor plugin** applies its source to the native `game` folder; Unity starts it automatically when importing the Project. Pairing validates that exact Project. [Managed editor acceptance](EDITOR_BRIDGE_ACCEPTANCE.md) records real installation, credential retention, owned-object edits, user-object refusal and viewport capture. The optional official CLI/Pipeline evidence below remains separate.

The Unity connector separates filesystem inspection, batchmode CLI runs and a connected live editor bridge. Baseline real evidence uses Unity **6000.6.0f1** on Windows with EditMode/PlayMode tests, Windows build and player assertions. Extended evidence includes Windows and Linux players, WebGL rendering/input/audio, and a live brokered editor identity/screenshot.

The installed official CLI is 1.0.0, with MCP server identity `unity-mcp` 1.0.0-beta.9. The fixture uses Pipeline 0.8.0-exp.1. Those experimental package/version results do not establish support across other versions or projects.

Live binding recognizes Unity's `editor_status` identity tool. A reported exact native `game/` folder can match the Project's editor identity; unrelated or merely nested paths cannot. Windows comparison handles path case.

A file-backed screenshot response can contain a PNG path instead of inline image bytes. The collector resolves and realpaths the file within the selected Project/native game, requires a real file, bounds size to 8 MiB and checks the PNG signature before storing a run artifact. A response claiming success without a collectable image fails.

The extended Linux player ran with llvmpipe software rendering; WebGL used SwiftShader. These demonstrate the recorded fixture behavior and do not certify native Linux GPU performance. Browser Space input passed; physical Windows keyboard/controller navigation remains unverified. Pipeline's quit command has an external EditMode defect retained in the acceptance record.

## Unreal

**Install editor plugin** defaults to compiling the owned bridge through a registered matching `RunUAT.bat` installation. **Build editor plugin** can retry while the native editor is closed. Source/engine fingerprints permit reuse of matching owned binaries; modified or untracked files are preserved. See [managed editor acceptance](EDITOR_BRIDGE_ACCEPTANCE.md) for install/build/pair steps and current direct-authoring evidence.

Baseline evidence uses Unreal **5.8.3** on Windows, automation tests, packaging and a Win64 player save/load assertion. Extended evidence adds real editor identity, a saved Basic-template map, viewport PNG and master-output audio recordings in editor executable game mode.

The current owned bridge is [PlayWeldEditor](../integrations/unreal/PlayWeldEditor/README.md), an editor-only plugin built from repository source with no third-party editor-plugin dependency or in-editor AI. Windows/Unreal5.8.3 live checks cover authenticated identity/inspection, owned-actor edits, viewport PNG, console restrictions and Project scope. `engine/editor-bridge-install` and `engine/editor-bridge-connect` are native broker tools taking an explicit Project-relative `.uproject` path. Installation preserves source edits and plugin choices, protects pairing with Windows DPAPI and reports the required editor build; connection verifies the actual editor identity and uses encrypted MCP credentials. Broader authoring/lifecycle and packaged deployment remain separate gates.

Historical acceptance used CodeFizz CLI **2.23.1** and editor plugin **1.17.0**, with 61 SDK tools and the [codefizz-acceptance-mcp.cjs](../scripts/codefizz-acceptance-mcp.cjs) identity/screenshot adapter. Those records and compatibility support remain historical/optional; the current first-party work does not depend on them.

The adapter takes an explicit `.uproject`, reads the active bridge port and validates a real CLI health reply against that exact native project. It rejects mismatched identity before capture. Automatic CodeFizz discovery failed on the tested host; an observed port worked after health validation. Do not hardcode a remembered port and assume it belongs to the intended editor.

Audio evidence records positive playing/resumed PCM and zero paused PCM using the Unreal master output path. It is not a packaged-audio acceptance result or human listening claim. Native Linux **5.8.1** has Python commandlet/version-startup evidence; C++ game compilation, packaging, graphics and input were not accepted on that target.

## Godot and DCC

Godot **4.7.2** has real headless and managed live editor evidence. PlayWeld installs/enables its addon alongside existing addons and pairs the Windows or tested WSL editor through protected Windows credentials. [Managed editor acceptance](EDITOR_BRIDGE_ACCEPTANCE.md) covers identity, owned scene edits, user-object refusal and viewport capture. Other native OS credential paths and broader version/export-target matrices remain outstanding.

Blender **5.2.2 LTS** has live headless scene creation, inspection, GLB export and PNG render evidence under WSL/native Windows. Other DCC connectors have fixture tests and require actual installed-application verification. Use DCC installation/capability/run records to assess the current host.

Asset export must carry units/scale, transforms, axis convention, normals/material slots, texture channel/color-space rules, rig/animation contract, collision/LOD requirements and source provenance as needed. A file that imports without error can still be unsuitable for gameplay or production rendering. The bundled asset/material/rigging/sprite/audio/VFX skills describe those checks in depth.

## Repeat live acceptance

Read the [baseline](LIVE_ENGINE_ACCEPTANCE.md) and [extended](EXTENDED_ENGINE_ACCEPTANCE.md) records before launching fixture scripts. They document prerequisites, stage commands, path overrides, installed versions and output locations.

The baseline runner is [live-engine-acceptance.cjs](../scripts/live-engine-acceptance.cjs); source projects are under [fixtures/engine-acceptance](../scripts/fixtures/engine-acceptance/). Generated native Projects live under `.turbo/live-engine-acceptance/projects`. The extended runner is [extended-engine-acceptance.cjs](../scripts/extended-engine-acceptance.cjs).

Run native Windows engine stages with native Windows Node and native paths. Linux player/commandlet stages run with Linux Node and exported files. Unity/Unreal licensing, platform modules, compiler tools and editor plugins must already be available. Path overrides locate executables; they do not prove compatibility with a new version.

Keep compiler logs, parsed tests, screenshots, WAVs and JSON results together. A failed stage is useful evidence and must not be overwritten into a pass summary. Do not open an existing production game for acceptance without selecting and scoping that game explicitly.

## MCP connections

The connection manager supports:

| Mode     | Configuration                                                                | Notes                                                               |
| -------- | ---------------------------------------------------------------------------- | ------------------------------------------------------------------- |
| Command  | Executable, arguments, cwd and environment                                   | Starts a stdio server under the configured host                     |
| Endpoint | URL, headers and Streamable HTTP or legacy SSE                               | Uses the selected endpoint transport                                |
| Docker   | Image, command, transport/port, mounts, environment, network and pull policy | Tracks owned container startup/cleanup; optional stop-on-disconnect |

Connection scope is platform or Project. Project-scoped connections must carry the Project identity. Connection state and negotiated revision are observable; tool discovery is a separate step from server startup.

In the Control Room, open **PlayWeld > Build & Connect > Tool Connections**. The **Servers**, **Add connection**, **Tool safety**, and **Logs** sections separate setup, policy and diagnostics. Expand the relevant advanced disclosure for command arguments/environment, endpoint headers, credentials or Docker settings; adding a connection does not start it, so explicitly connect it and then inspect the negotiated revision and discovered tools.

The contract lists revisions `2026-07-28`, `2025-11-25`, `2025-06-18` and `2025-03-26`. In-repository fixtures exercise multiple revisions. Live Unity/adapted Unreal acceptance negotiated `2025-11-25`; fixture coverage of another revision is not live certification of that revision.

External tools have input/output schemas, execution modes, side-effect classifications and evidence descriptions. Explicit draft-07 schemas use draft-07 validation; otherwise external validation defaults to 2020-12. Validators use isolated namespaces and reject unresolved external references and unsupported dialects. Core TypeBox contracts retain their own validation path.

Classify tools by actual effect. An identity probe can be read-only; saving a screenshot writes workspace artifacts; execute-code/command tools require conservative treatment. An MCP tool's advertised description does not itself grant access. Server-initiated model calls require their explicit configuration and host policy.

Docker HTTP port mapping and some live community server paths retain verification debt. Startup failure cleanup has regression tests, but do not claim all network/isolation scenarios are accepted from those tests alone.

## Agent Skills

Use the Agent Skills format: a directory with `SKILL.md`, YAML frontmatter including name/description, task instructions, and optional references/scripts/assets. Store project skills under `.agents/skills/`. Platform metadata uses the `gamecrafter-` prefix.

A useful skill describes when to use it, required inputs and preconditions, actionable procedures, acceptance evidence, failure/recovery cases and domain boundaries. Keep the entrypoint under 500 lines and move deep references into supporting files. Do not invent a second platform-specific skill format.

Example layout:

```text
.agents/skills/my-game-workflow/
  SKILL.md
  references/workflow.md
  scripts/check-artifact.py
  evals/evals.json
```

References are progressively read through bounded skill-resource operations, preserving context budget. The registry considers bundled/platform/Project sources and selection policy. Review the [skill coverage guide](GAME_DEVELOPMENT_SKILLS.md) and current schema/RPC reference for selection and activation details.

Thirty first-party skills ship with the platform. The authoritative list is [bundled-skill-names.ts](../packages/platform-service/src/skills/bundled-skill-names.ts); build copying is handled by the service asset-copy script. Editing a bundled skill affects the generated service distribution and Turbo cache input, so rebuild and verify it.

Third-party skills require review of their `SKILL.md` before installation and lockfile maintenance. Instructions supplied by an external skill are not automatically executable-code authorization or proof of the skill's quality. Evaluate representative tasks with/without the skill and retain evidence of domain usefulness and limitations.

## Roles

Builtin roles are coordinator, planner, explorer, game-designer, gameplay-engineer, engine-engineer, asset-producer, narrative-designer, reviewer, validator and board-maintainer. Their packages live in [platform-service/roles](../packages/platform-service/roles/).

A role defines its responsibility, relevant skills, model-pool usage and allowed tools/access ceiling. Central runtime/broker enforcement applies in addition to role prose. A reviewer or validator should report artifact/test evidence, not merely echo an implementation agent's completion claim.

Keep a role focused on domain responsibility; do not make every role a generic unrestricted executor. Registered Project skills can extend domain knowledge without moving durable task policy into a role document.

## Executable plugins

Plugins use `gamecrafter-plugin.json`, protocol version 1, a compatible platform range, runtime entry, capabilities and contributions. Runtime entries are relative paths constrained against absolute/traversal references. Contributions can include tools, modules, genres, record types, roles, skills, settings, panels and commands as allowed by the manifest schema.

The sample [manifest](../packages/plugins/sample-hello/gamecrafter-plugin.json) and [worker](../packages/plugins/sample-hello/src/index.ts) demonstrate the complete current package. Build the sample and SDK before using its `dist/index.cjs` entry.

A TypeScript worker uses `definePlugin` from `@gamecrafter/plugin-sdk` to provide tool handlers and optional settings/shutdown callbacks. Host methods include brokered tool calls, logging, model completion, secret lookup and board operations. The worker protocol is JSON-RPC over newline-delimited frames; stdout belongs to protocol traffic.

Capabilities include Project filesystem read/write, process spawn, network outbound, tools, models, board and secrets. A manifest request does not automatically imply host permission. Calls must pass availability/capability checks and broker access policy. Plugin data that needs durable platform ownership must use service contracts rather than writing an independent authoritative task/board database.

Linux Bubblewrap isolation has adversarial coverage on supported hosts. Windows AppContainer remains unverified/fail-closed. Plugin signatures, finer egress enforcement and additional hardening remain open. Do not bypass isolation merely to make an unsupported plugin appear available.

## Model and generation providers

Model providers implement account lifecycle, model metadata, supported completion/streaming interfaces, errors, usage and routing compatibility. Test malformed responses, streaming termination, timeouts, cancellation and secret redaction. Live acceptance must name the endpoint/model and actual request evidence.

Asset providers implement account/capability reporting, submission, polling, output retrieval/import, provenance and failure states. Meshy and Tripo3D have fake-server coverage plus [provider-contract research](research/asset-provider-api-verification.md). Paid live generation remains unverified.

Respect provider-specific upload and conversion contracts. Do not infer support for negative prompts, every input format, automatic rigging or credit behavior from a generic asset job schema. Record actual retrieved artifacts and validation results before calling a pipeline complete.

## Acceptance checklist for a new integration

- Define typed inputs/results, installed version and current host capability.
- Prove selected Project identity before editor mutation.
- Classify side effects and enforce access ceilings/approvals.
- Validate schemas, paths, returned artifact type and size.
- Persist command/run/call IDs, logs, status and evidence.
- Exercise failure, timeout, cancellation, wrong-Project and cleanup paths.
- Test a real disposable fixture before claiming live verification.
- Document exact versions/targets and remaining limitations in status and acceptance records.

The [development plan](DEVELOPMENT_PLAN.md) owns dependency ordering. This guide describes integration contracts and acceptance responsibilities without introducing a separate product roadmap.

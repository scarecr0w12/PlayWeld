# PlayWeld user guide

**Last updated:** 2026-10-04

**Audience:** People creating and maintaining games with the current PlayWeld workspace. [Documentation index](README.md).

For a hands-on introduction, follow [Lantern Workshop](WORKED_TUTORIAL.md), a reusable testing Project with real Control Room screenshots. The [Control Room handbook](CONTROL_ROOM_HANDBOOK.md) explains every screen, inputs, examples, and success/failure evidence. Contributors can use the [service recipes](SERVICE_RECIPES.md). The [coverage record](DOCUMENTATION_COVERAGE.md) states exactly what this walkthrough verifies.

## What you are running

The desktop Control Room organizes a local Project, its design records, source assets, engine files, discussions, agent tasks, and integrations. A local platform service stores operational records and executes work. Closing a window can leave that service running, depending on `window.closeBehavior`.

PlayWeld does not install or license a game engine for you. Unity, Unreal, Godot, DCC applications, model endpoints and asset-provider accounts have their own installation and configuration requirements. The development browser target exists for smoke testing; the Electron application is the desktop product.

The current interface uses a dark violet background and neon green accents. Its view contributions expose Project Home, Settings, Models & Routing, Chat, Skills & Roles, Connections, Discussion Board, Swarm, Plugins, Engine, DCC, Knowledge, Assets, Backups, Updates, and Audit & History. Project-dependent actions require an opened Project.

## Install and launch from source

Use Node 24 or later, npm 11, and Git. Use the pinned dependencies in the repository; do not replace npm with another package manager. On Linux, Theia native modules require `libx11-dev`, `libxkbfile-dev` and `libsecret-1-dev`. Windows native builds require the C++ build prerequisites described in the [developer guide](DEVELOPER_GUIDE.md).

From the repository root:

```bash
npm ci
npx turbo run build typecheck lint test
npm run download:plugins
npm run build -w @gamecrafter/control-room
npm run start -w @gamecrafter/control-room
```

Keep native Windows and Linux dependency trees separate. A Windows Electron installation cannot reuse Linux native modules, and a Linux npm install must not overwrite an existing Windows checkout's `node_modules`.

For a development browser session, build and start the separate browser application:

```bash
npm run build -w @gamecrafter/control-room-browser
npm run start -w @gamecrafter/control-room-browser
```

Open `http://127.0.0.1:3000`. The Control Room backend starts the platform service automatically when needed. To use an isolated test profile, set `GAMECRAFTER_PROFILE_DIR` before launching both the application and service. See the [operations guide](OPERATIONS_GUIDE.md) for platform-specific paths and service commands.

Packaged Linux and Windows applications have build/startup evidence. Installer installation, uninstall, signed-release and rollback acceptance remain open; source-build success is a separate claim.

## Create or open a Project

Use Project Home to create a Project. The six-step wizard asks for name, optional description, engine family, optional comma-separated genres, parent directory, and confirmation. Module metadata exists in the service contract; the current wizard does not offer a module-selection step. Creation writes a manifest, design folder, engine folder, repository instructions, local platform state and Git repository. Choose the engine family carefully: the Project's family is locked and cannot be changed by editing an engine selection in the UI.

An existing registered Project has an Open action. Opening selects its workspace in the same window and makes its Project-scoped views available. Confirm that the displayed Project and workspace folder match the game you intend to work on before submitting engine operations or agent work.

A standard Project contains:

```text
gamecrafter.project.json    Project ID, name, engine, genres, modules, schema version
AGENTS.md                  Instructions for agents working on this game
docs/                      Authoritative design and canon Markdown
game/                      Native Unity, Unreal or Godot project files
.agents/skills/            Project-local Agent Skills
.gamecrafter/              Operational databases, logs, cache and run artifacts
```

The engine folder can initially be empty. Creating the PlayWeld workspace does not itself create a complete Unity scene or Unreal game. Engine capability reports explain which operations are available after native project files and installations are present.

Use the Project clone operation when you need an independent copy. Clone/registered restore can assign a new identity and reconcile copied operational state. Copying folders manually can duplicate IDs and stale work; use the supported flows and review their resulting identity and warnings.

## Configure settings and access

Settings are layered: supported session overrides take precedence over Project overrides, platform settings and builtin defaults. The Settings view shows effective values and their origin. A setting can permit only some scopes. Resetting an override returns control to the next layer.

The builtin access default is `ask-always`. Tool decisions use the most restrictive applicable setting and task/request/agent ceiling.

| Mode       | Behavior                                                                                                                |
| ---------- | ----------------------------------------------------------------------------------------------------------------------- |
| Full       | Allows registered tool operations within the remaining availability, validation and capability constraints              |
| Restricted | Allows configured side-effect categories or explicit tool-ID globs; denies other calls                                  |
| Ask always | Allows read-only tools; asks before calls with side effects, unless a higher minimum access requirement denies the call |

Restricted mode's builtin allowed side effects are `none`, `internal-write`, and `workspace-write`. It is configurable; the live acceptance's narrower `none`/`internal-write` configuration is why screenshot writes were denied there. Restricted does not inherently mean all workspace writes are forbidden.

Approval prompts describe the tool and effect. Approve or reject the specific requested operation after reviewing its scope. Expired, rejected, cancelled or interrupted calls retain records; they are not completed work. Audit & History exposes call history and export. The [settings reference](SETTINGS_REFERENCE.md) contains the complete catalog.

Settings export redacts credential-like values. Import supports validation and dry-run through the service API. Review skipped keys and do not treat a settings export as a transferable credential backup.

## Configure models and routing

In Models & Routing, configure a provider account and its endpoint/credential, discover or register the models you intend to use, and assign suitable model pools. The service implements OpenAI-compatible and Anthropic adapters, streaming completion, pricing/usage records and routing/outcome learning. Actual endpoint support depends on the provider.

Use quality, balance or cost policy deliberately. Define task budgets where needed. A model advertising text generation does not automatically support tools, embeddings, images or the context length required by a task. The router uses the recorded model capabilities and pool policies.

Live model-provider and embedding-provider acceptance is still outstanding. Existing repository tests use fake HTTP endpoints. A configured account or visible model list does not prove a successful live completion or embedding operation.

## Chat and agent work

Chat stores Project-scoped conversations and presents router responses. Models declaring streaming support can stream; other eligible chat models use a complete-response flow. Optional editor context helps explain the currently selected file. Review the context sent with the request, especially when using a remote endpoint.

Use Agent mode when the request should become supervised Swarm work. Describe the goal, affected files or game systems, expected result, acceptance evidence and budget. A useful request includes a reproducible defect or explicit desired behavior, rather than only “finish the game.”

For example:

```text
In this Project's game/ folder, fix the checkpoint reload failure.
Keep the current save schema compatible. Reproduce it with an engine test,
implement the fix, and report the test log and affected save/load code.
```

The current Chat does not execute an arbitrary tool loop directly inside the chat view. Its Agent handoff uses the platform's supervised runtime. A native Theia AI LanguageModel adapter and external IDE MCP server remain unimplemented.

## Monitor the Swarm

The Swarm view exposes requests, task trees, resource locks, integration records and feedback. The service owns task/event persistence, worker leases, checkpoints and recovery; the UI presents those records.

| State              | Meaning for the user                                           |
| ------------------ | -------------------------------------------------------------- |
| Pending / ready    | Work exists and is awaiting dependencies or scheduling         |
| Claimed / running  | A worker owns a lease and is processing the task               |
| Waiting input      | A task question needs an answer                                |
| Blocked            | An explicit dependency or condition prevents scheduling        |
| Succeeded          | The task completed its recorded execution contract             |
| Failed / cancelled | Work ended unsuccessfully or was cancelled; inspect the reason |

A succeeded agent task is not automatically an accepted change in the main Project. Review completion evidence, integration status, conflicts and validation. Worktrees isolate source changes; resource locks coordinate declared shared resources. They do not turn every external editor or paid provider into an isolated transactional system.

Answer task questions in their prompts. Cancelling work should propagate to owned processes; inspect the task and run records to confirm how it stopped. After a service restart, review reconciled interrupted work before retrying.

## Discussion and design records

Use Discussion Board for threads, messages and decisions related to the Project. Keep durable design/canon Markdown under `docs/` reviewable in Git. The board maintenance agent can synchronize supported decisions into records and report contradictions or proposed changes.

A board discussion, a proposed edit, a canon record and a user-confirmed requirement are distinct artifacts. Review the actual record change before relying on it. Whole-file proposal diffs and broader canon reconciliation remain limitations listed in [status](STATUS.md).

## Skills and roles

Skills & Roles displays available skills, their sources and Project selection/activation information. Thirty first-party game-development skills cover engine work, gameplay, testing, art, animation, audio, performance, multiplayer, localization, accessibility, narrative, planning, release, research and evidence review.

A skill supplies instructions and references; it does not grant engine access or install missing software. Roles define responsibilities and tool/access ceilings. References load progressively through bounded resource reads. See the [skill coverage guide](GAME_DEVELOPMENT_SKILLS.md) and [integration guide](INTEGRATION_GUIDE.md) for authoring and installation contracts.

## Connect engines and external tools

Engine installations, MCP connections and live editor bindings are separate configuration objects. Add/detect an installation, inspect capabilities, configure an MCP connection when required, and bind the correct running editor to the Project. A running editor with the wrong native Project must be rejected.

Capability reports distinguish project-file inspection, headless CLI execution and live editor operations. Some operations can run without a graphical editor; others require a verified bridge and a collectable artifact. A screenshot call succeeds only if it supplies a valid image that the platform can store.

Unity/Unreal fixtures have live acceptance evidence; the exact versions, hosts, limitations and repeatable commands are in [live engine acceptance](LIVE_ENGINE_ACCEPTANCE.md) and [extended acceptance](EXTENDED_ENGINE_ACCEPTANCE.md). The CodeFizz adapter used for extended acceptance is testing tooling in the checkout, not a shipped general-purpose connector.

DCC follows similar installation, capability and run-history flows. Blender has real scene/export/render evidence. Other DCC applications still require live verification. Consult the [integration guide](INTEGRATION_GUIDE.md) before assuming an operation exists for a particular tool.

## Knowledge and search

Knowledge maintains canon records and indexes Project material for retrieval with citations. Choose lexical-only, embedded LanceDB, embedded SQLite exact vector search, managed local Qdrant, an existing local Qdrant instance, or remote Qdrant in the Knowledge view. SQLite exact search is intended as a lightweight alternative, not an ANN index. Managed Qdrant is supplied by desktop packaging; development checkouts prepare it with `npm run prepare:qdrant -w @gamecrafter/control-room`.

Remote mode requires an HTTPS URL and explicit permission to send embeddings and indexed metadata. Put API keys in the encrypted credential store and configure their `${cred:KEY}` reference. Legacy Qdrant configurations retain their external-endpoint behavior; migrate remote connections to explicit remote mode for the stronger checks. Changing storage schedules reconciliation and re-embeds sources for the new destination; old backend data is retained. Additional trusted adapters use their registered ID, but marketplace installation of vector adapters is not yet supported.

Embeddings still require a configured provider and embedding profile. Selecting a vector database does not install an embedding model or certify live model generation. Storage remains lexical-only by default.

API keys are never sent over non-loopback cleartext HTTP, including in legacy external mode. Built-in vector storage is ignored by Project Git and not copied into clones; indexes rebuild from source. If a backend loses points or a source deletion fails, run reconciliation to repair missing points or retry deletion. Switching backends does not erase old remote data; removing that retained data remains an explicit operation at the old service.

After editing source documents, inspect indexing state before relying on retrieved results. Keep cited source paths and record identities with important conclusions. An index is derived data; the authoritative design records remain the actual Project documents.

## Asset generation and inspection

Assets manages provider accounts, generation requests, job lifecycle, imported files, provenance and preview derivatives. The UI includes 2D inspection and a Three.js 3D viewer. Provider operations can incur charges and are subject to access policy.

The job lifecycle passes through submission, running, download and review. User review through `asset/review` must approve an artifact before `asset/import` copies it into the configured import directory with a provenance sidecar. Review is a user-only service action, not an agent broker tool; imports do not overwrite existing files. A submitted job is not a completed asset. Wait for the terminal provider state, retrieve outputs, inspect the imported artifact, and validate the topology, scale, materials, rig, licensing/provenance and engine import needed by the intended use. A rendered preview does not establish collision or gameplay suitability.

Meshy and Tripo3D requests are implemented with fixture-server tests. Provider documentation verification is recorded separately from paid live generation. Do not label a provider pipeline live-verified until a real request, download and artifact inspection have completed.

## Backups, updates and troubleshooting

Backups configures destinations/plans and records snapshot, transfer and verification results. Restore to an empty destination and inspect identity/plugin warnings. Keep the backup recovery secret independently available. Native Windows Project/profile recovery drills have evidence; remote destinations are fake-tested.

Updates reports available releases and download verification. A checksum-verified download, a signature-verified release, installer handoff and successful rollback are separate stages. Installation/signing/tagged-release acceptance is still outstanding.

If something fails, keep the Project ID, task/run/call ID, timestamp, engine/connector version, status and sanitized logs. The [operations guide](OPERATIONS_GUIDE.md) provides recovery procedures and a symptom table. For known gaps, consult [implementation status](STATUS.md) instead of treating every unavailable capability as a regression.

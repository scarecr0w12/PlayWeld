# PlayWeld user guide

**Last updated:** 2026-10-06

**Audience:** People creating and maintaining games with the current PlayWeld workspace. [Documentation index](README.md).

## Find what you need

| Task                                      | Section                                                             |
| ----------------------------------------- | ------------------------------------------------------------------- |
| Launch PlayWeld                           | [Install and launch](#install-and-launch-from-source)               |
| Set up a game workspace                   | [Create or open a Project](#create-or-open-a-project)               |
| Choose permissions and defaults           | [Settings and access](#configure-settings-and-access)               |
| Add a model provider                      | [Models and routing](#configure-models-and-routing)                 |
| Ask for help or request a change          | [Chat and agent work](#chat-and-agent-work)                         |
| Review progress or answer a task question | [Monitor the Swarm](#monitor-the-swarm)                             |
| Keep design decisions                     | [Discussion and design records](#discussion-and-design-records)     |
| Connect engines or external agents        | [Engine and tool connections](#connect-engines-and-external-tools)  |
| Search Project documents                  | [Knowledge and search](#knowledge-and-search)                       |
| Generate and review art                   | [Assets](#asset-generation-and-inspection)                          |
| Recover from a problem                    | [Backups and troubleshooting](#backups-updates-and-troubleshooting) |

For a first session, launch the desktop, create or open a Project, and configure a model account if you want to use Chat or agents. Connect an engine when you are ready for native game operations.

Follow [Lantern Workshop](WORKED_TUTORIAL.md) for a hands-on introduction using a disposable testing Project. Use the [Control Room handbook](CONTROL_ROOM_HANDBOOK.md) for individual screens and the [documentation index](README.md) for advanced guides and verification records.

## What you are running

The desktop Control Room organizes a local Project, its design records, source assets, engine files, discussions, agent tasks, and integrations. A local platform service stores operational records and executes work. Closing a window can leave that service running, depending on `window.closeBehavior`.

PlayWeld does not install or license a game engine for you. Unity, Unreal, Godot, DCC applications, model endpoints and asset-provider accounts have their own installation and configuration requirements. The development browser target exists for smoke testing; the Electron application is the desktop product.

The current interface uses a dark violet background and neon green accents. Project Home groups tools into **Build and review**, **AI and teamwork**, **Reference and extensions**, and **Workspace**. The top-level **PlayWeld** menu groups the same destinations under **Plan & Collaborate**, **Build & Connect**, **Configure & Extend**, and **Review & Maintain**, with Project Home and Create Project under **Start**. A view may have its own section navigation and expandable advanced controls; selecting a view does not necessarily expose every form at once. Project-dependent actions require the intended Project in that view's selector.

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

To create a Project:

1. Open **Project Home** and select **Create Project**.
2. Enter a name, optional description, engine family, optional comma-separated genres, and parent directory.
3. Review the confirmation and create the Project. The engine family is locked after creation.
4. Find the new Project in the table and select **Open**.

Creation writes a manifest, design folder, engine folder, repository instructions, local platform state, and Git repository. Module metadata exists in the service contract; the current wizard does not offer a module-selection step. The [tutorial](WORKED_TUTORIAL.md#create-lantern-workshop) illustrates all six wizard steps.

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

Open **Settings**, choose a group or search by key, and select the scope you want to change. Effective values show where each value comes from. Expand **Import and export** to preview or apply a settings file.

Settings use this precedence, where supported:

1. Session override.
2. Project override.
3. Platform setting.
4. Builtin default.

Each setting allows specific scopes. Resetting an override returns control to the next layer.

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

In Models & Routing, configure one or more provider accounts, discover or register the models you intend to use, and assign suitable model pools. Named account presets cover OpenAI, Google Gemini Developer API, OpenRouter, xAI, Mistral, DeepSeek, Groq, Azure OpenAI, and Anthropic; generic OpenAI-compatible endpoints remain available for local servers and compatible gateways. API keys and custom secret headers are stored in the encrypted profile credential store. OAuth and cloud-native IAM are not supported in this scope.

Edit an account to replace credentials or headers without deleting its model records. Azure classic endpoints require a callable deployment name; the optional base model ID is a separate catalog mapping. Discovery combines account API facts with exact-ID entries in a versioned provider-sourced catalog. Each populated field shows provenance, freshness, and confidence. Unknown is not Unsupported; selecting Unknown clears a manual override so later discovery can fill it.

Provider-published prices are estimates, not invoices, and discovery never runs a silent billable completion probe.

Use quality, balance or cost policy deliberately. Define task budgets where needed.

Chat routing requires a known, supported chat capability, and unknown data does not make a model eligible for a required capability. Provider-declared vision is visible but not routable while the common chat request carries text only; embeddings use the separate embedding operation.

Role and work-type lists are hard restrictions and empty lists mean unrestricted. Catalog category tags remain descriptive unless an exact, high-confidence source rule matches a local role/work type.

Use Audit & History's **Model usage** view for recorded model estimates and token/cache counters, separately from **Tool calls** and the Project timeline. Missing prices are unavailable, not free. Known subtotals cover the loaded/filtered page and can exclude unknown or unverifiable history; they are not all-time spending or invoices. Set model rates in Models & Routing before relying on monetary estimates or known-cost budget comparisons. Agent goals/results use structured, bounded reading panels rather than unformatted expanded text.

Provider verification depends on the operation and endpoint. Consult [implementation status](STATUS.md) and the dated [work records](changes/README.md) for recorded live results and remaining checks. A configured account or visible model list does not prove a successful live completion or embedding operation.

### Optional decision assistance

The source integration supports a separately running typed decision server, such as a compatible Kev or Laya System One endpoint. Add a dedicated provider account in Models & Routing, using its base URL and optional credential; the account table exposes the account ID. Configure `models.decisions.accountId` and `models.decisions.model` under Models settings. A base URL like `http://127.0.0.1:9001/v1` targets `/v1/systemone`. Judge checkpoints are configured explicitly, not Auto-routed; discovering them as worker chat models is unnecessary and may fail if that server does not expose chat discovery.

Start with `models.decisions.mode = shadow`, the default: new agent tasks record task classification, complexity, missing-context/review/decomposition/engine-validation flags, and eligible model suggestions without changing execution. Empty account/model settings make no calls. Opening the **Decision assessments** tab only reads service-owned history; it does not start a model or make paid test calls. The detail panel shows distributions and nullable cost/token usage, not proof of correctness.

Explicit `assist` mode adds bounded task guidance and can prefer a model recommendation meeting probability/margin thresholds, but only within the current eligible pool; manual selection, capability and estimated budget filters still win. Task type, tool permissions, required reviews and completion evidence do not change. Assessment denial/outage/malformed or reported-truncated output keeps ordinary routing. `off` disables requests. Existing task snapshots are preserved; configure assistance before creating new agent tasks.

Non-loopback endpoints require `models.decisions.allowRemote = true` and HTTPS. Remote decisions send task summaries and candidate metadata off-machine, use provider credentials, and may cost money. Ask always still prompts through the paid-effect broker; missing usage/prices remain unknown. Evaluate shadow records before enabling assist: repository tests cover fake endpoints, not a live checkpoint's accuracy, calibration, or cost savings. See [all settings and boundaries](TECHNICAL_ARCHITECTURE.md#configuration-and-ownership).

## Chat and agent work

Chat stores Project-scoped conversations and presents router responses. Use **Find a conversation** to filter the conversation list and selector. On an empty conversation, a starter fills the message draft; it does not send until you explicitly press **Send** or Enter. At a narrow window width the conversation controls stack above the conversation, while the Chat/Agent choice and composer remain available. Models declaring streaming support can stream; other eligible chat models use a complete-response flow. Optional editor context helps explain the currently selected file. Review the context sent with the request, especially when using a remote endpoint.

Use Agent mode when the request should become supervised Swarm work. Describe the goal, affected files or game systems, expected result, acceptance evidence and budget. A useful request includes a reproducible defect or explicit desired behavior, rather than only “finish the game.”

For example:

```text
In this Project's game/ folder, fix the checkpoint reload failure.
Keep the current save schema compatible. Reproduce it with an engine test,
implement the fix, and report the test log and affected save/load code.
```

The current Chat does not execute an arbitrary tool loop directly inside the chat view. Its Agent handoff uses the platform's supervised runtime. A native Theia AI LanguageModel adapter and external IDE MCP server remain unimplemented.

The current [conversation search](images/lantern-workshop/05-chat-search.png) and [compact starter draft](images/lantern-workshop/05-chat-mobile-starter.png) screenshots use the disposable Lantern Workshop fixture. They demonstrate UI state only; the starter was not submitted in the mobile capture.

## Monitor the Swarm

The Swarm view separates **Agents**, **Approvals**, **Integrations**, and **Resource locks**. Expand **New request** to enter a change request, role, and budget; use **Preview impact** before **Submit request**. The service owns task/event persistence, worker leases, checkpoints and recovery; the UI presents those records.

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

When an agent reaches its model-turn allowance, PlayWeld retains its checkpoint and asks whether to **Continue** for another bounded allowance or **Stop**. Continuing preserves the existing cost, token, time and permission limits; it does not accept unfinished work. Restored checkpoints recover pending questions and report uncertain interrupted tool results without automatically replaying mutations. Review the retained tool/run evidence before retrying an operation whose outcome is uncertain.

## Discussion and design records

Use Discussion Board for threads, messages and decisions related to the Project. Keep durable design/canon Markdown under `docs/` reviewable in Git. The board maintenance agent can synchronize supported decisions into records and report contradictions or proposed changes.

Quick views filter the thread list to **All**, **Open**, **Questions**, **Blockers**, or **Decisions**; use the detailed filters for status, kind, tags, and text search. The **New thread** composer may be collapsed while you review existing work.

A board discussion, a proposed edit, a canon record and a user-confirmed requirement are distinct artifacts. Review the actual record change before relying on it. Whole-file proposal diffs and broader canon reconciliation remain limitations listed in [status](STATUS.md).

## Skills and roles

Skills & Roles displays available skills, their sources and Project selection/activation information. Thirty first-party game-development skills cover engine work, gameplay, testing, art, animation, audio, performance, multiplayer, localization, accessibility, narrative, planning, release, research and evidence review.

A skill supplies instructions and references; it does not grant engine access or install missing software. Roles define responsibilities and tool/access ceilings. References load progressively through bounded resource reads. See the [skill coverage guide](GAME_DEVELOPMENT_SKILLS.md) and [integration guide](INTEGRATION_GUIDE.md) for authoring and installation contracts.

## Connect engines and external tools

Engine installations, MCP connections and live editor bindings are separate configuration objects. Add/detect an installation, inspect capabilities, configure an MCP connection when required, and bind the correct running editor to the Project. A running editor with the wrong native Project must be rejected.

Capability reports distinguish project-file inspection, headless CLI execution and live editor operations. Some operations can run without a graphical editor; others require a verified bridge and a collectable artifact. A screenshot call succeeds only if it supplies a valid image that the platform can store.

Unity/Unreal fixtures have live acceptance evidence; the exact versions, hosts, limitations and repeatable commands are in [live engine acceptance](LIVE_ENGINE_ACCEPTANCE.md) and [extended acceptance](EXTENDED_ENGINE_ACCEPTANCE.md). The CodeFizz adapter used for extended acceptance is testing tooling in the checkout, not a shipped general-purpose connector.

DCC follows similar installation, capability and run-history flows. Blender has real scene/export/render evidence. Other DCC applications still require live verification. Consult the [integration guide](INTEGRATION_GUIDE.md) before assuming an operation exists for a particular tool.

### Agent-to-agent connections (A2A)

The **Connections → A2A agents** view connects PlayWeld to other A2A v1.0 agents and optionally exposes a scoped task gateway to a local harness. It is separate from MCP server connections and model-provider accounts.

- For outbound delegation, add an agent base URL and a static API-key header, bearer, basic, or custom-header credential. Remote URLs require HTTPS; plain HTTP is allowed only for explicitly configured loopback agents. Discover the Agent Card to inspect its identity, skills, and JSON-RPC interface before workers use the brokered send/get/stream/resubscribe/cancel and Project-scoped remote-task listing tools. By default, the coordinator role has the `a2a/*` tool grant; other builtin roles need explicit configuration. Existing remote task IDs can only be read, continued, streamed, or canceled by the Project that owns their ledger record. When an agent delegates within a local Task, streamed updates appear in that Task's event timeline while the worker awaits the final response. Remote task IDs/statuses are retained for reconciliation; if a send is interrupted before its remote ID is returned, PlayWeld does not retry it automatically.
- For inbound control, enable the gateway and choose a port. It binds only to `127.0.0.1`; another machine on the LAN cannot connect. Register each harness with explicit Project, role, and task-operation grants, then issue a bearer token. The plaintext token is shown once; copy it to the local harness and rotate it if lost. Revocation invalidates the token and active streams.
- Inbound A2A can create, read, continue, stream, and cancel `agent.run` tasks only within those grants. It cannot call settings, credentials, arbitrary tools, or service administration. Task execution retains the Project access mode and Ask-always broker approvals; an A2A caller cannot answer a broker approval.
- This implementation supports A2A v1.0 JSON-RPC over HTTP(S) and text input only. OAuth/OIDC, gRPC, public/LAN inbound exposure, task listing, push notifications, and non-text inbound parts are not supported.

## Knowledge and search

Knowledge maintains canon records and indexes Project material for retrieval with citations. Use **Index status**, **Search**, **Canon records**, and **Settings** to move between those concerns. In **Search**, expand **Search mode and filters** for retrieval configuration. Choose lexical-only, embedded LanceDB, embedded SQLite exact vector search, managed local Qdrant, an existing local Qdrant instance, or remote Qdrant. SQLite exact search is intended as a lightweight alternative, not an ANN index. Managed Qdrant is supplied by desktop packaging; development checkouts prepare it with `npm run prepare:qdrant -w @gamecrafter/control-room`.

Remote mode requires an HTTPS URL and explicit permission to send embeddings and indexed metadata. Put API keys in the encrypted credential store and configure their `${cred:KEY}` reference. Legacy Qdrant configurations retain their external-endpoint behavior; migrate remote connections to explicit remote mode for the stronger checks. Changing storage schedules reconciliation and re-embeds sources for the new destination; old backend data is retained. Additional trusted adapters use their registered ID, but marketplace installation of vector adapters is not yet supported.

Embeddings still require a configured provider and embedding profile. Selecting a vector database does not install an embedding model or certify live model generation. Storage remains lexical-only by default.

API keys are never sent over non-loopback cleartext HTTP, including in legacy external mode. Built-in vector storage is ignored by Project Git and not copied into clones; indexes rebuild from source. If a backend loses points or a source deletion fails, run reconciliation to repair missing points or retry deletion. Switching backends does not erase old remote data; removing that retained data remains an explicit operation at the old service.

After editing source documents, inspect indexing state before relying on retrieved results. Keep cited source paths and record identities with important conclusions. An index is derived data; the authoritative design records remain the actual Project documents.

## Asset generation and inspection

Assets separates **Library**, **Preview**, **Generate**, and **Jobs**. Expand **Add provider account** to configure an account or **Advanced generation options** for optional request inputs. It manages generation requests, job lifecycle, imported files, provenance and preview derivatives. The UI includes 2D inspection and a Three.js 3D viewer. Provider operations can incur charges and are subject to access policy.

The job lifecycle passes through submission, running, download and review. User review through `asset/review` must approve an artifact before `asset/import` copies it into the configured import directory with a provenance sidecar. Review is a user-only service action, not an agent broker tool; imports do not overwrite existing files. A submitted job is not a completed asset. Wait for the terminal provider state, retrieve outputs, inspect the imported artifact, and validate the topology, scale, materials, rig, licensing/provenance and engine import needed by the intended use. A rendered preview does not establish collision or gameplay suitability.

Meshy and Tripo3D requests are implemented with fixture-server tests. Provider documentation verification is recorded separately from paid live generation. Do not label a provider pipeline live-verified until a real request, download and artifact inspection have completed.

## Backups, updates and troubleshooting

Backups separates **Identities**, **Destinations**, **Plans**, **Runs**, and **Archives and restore**. Use a verified archive and an empty destination, then inspect restored identity/plugin warnings. Keep the backup recovery secret independently available. Native Windows Project/profile recovery drills have evidence; remote destinations are fake-tested.

Updates reports available releases and download verification. A checksum-verified download, a signature-verified release, installer handoff and successful rollback are separate stages. Check [release acceptance](RELEASE_ACCEPTANCE.md) and the relevant [release notes](releases/) for version-specific results and remaining checks.

If something fails, keep the Project ID, task/run/call ID, timestamp, engine/connector version, status and sanitized logs. The [operations guide](OPERATIONS_GUIDE.md) provides recovery procedures and a symptom table. For known gaps, consult [implementation status](STATUS.md) instead of treating every unavailable capability as a regression.

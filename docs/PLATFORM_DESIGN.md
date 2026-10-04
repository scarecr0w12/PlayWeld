# Game Development Platform: Living Design

**Status:** Working design, not an implementation claim.  
**Last updated:** 2026-10-04
**Purpose:** Preserve decisions and open questions as we design the complete platform.

**Implementation status:** [DEVELOPMENT_PLAN.md](DEVELOPMENT_PLAN.md) tracks which work packages are implemented; nothing in this document is an implementation claim.

**Discussion preference:** The user delegated remaining routine technology choices to best-practice judgment. Present a complete recommendation rather than asking serial approval questions; preserve the difference between user-confirmed requirements and selected engineering defaults.

**Repository change tracking (user-confirmed, 2026-10-02):** All work going forward must be recorded with changelog details and version impact, including additions, changes and removals. Permanent work records and release preparation checks are the selected engineering implementation; see [the tracking contract](changes/README.md). This repository maintenance requirement does not change the platform's Project task/storage contracts.

**Technical stack under discussion:** [TECHNICAL_ARCHITECTURE.md](TECHNICAL_ARCHITECTURE.md). Its proposals are not confirmed decisions.

**Detailed remaining decisions:** [OPEN_DECISIONS.md](OPEN_DECISIONS.md). It tracks unresolved policy, contract, format, and verification choices without organizing the platform into phases.
**Skills, roles, and tool contracts:** [SKILLS_AGENTS_AND_TOOLS.md](SKILLS_AGENTS_AND_TOOLS.md). Engineering defaults that build on the confirmed skill and plugin requirements.

## Vision

A free, open-source system that runs locally and coordinates game development from a natural-language request through design, narrative, gameplay, code, assets, engine changes, validation, and human feedback. It serves one user initially but should be usable by other people who install it from GitHub. The target design covers the complete system; it is not organized around a first game, milestone, or staged feature set.

## Confirmed requirements and decisions

### Model capacity and user budgets

- **Confirmed by the user, 2026-10-03:** Determine model context and output settings from the selected model's capacity rather than arbitrary platform token limits. Keep explicit user spending/task budgets separate from per-request capacity. Unknown provider capacity must be labeled unknown, not replaced with a guessed model limit. The selected implementation defaults are described in [model capacity](TECHNICAL_ARCHITECTURE.md#model-capacity-and-task-budgets).

### Product identity

- The public product name is **PlayWeld**. The user reports purchasing **playweld.com**. Existing technical identifiers are retained under the [branding compatibility default](BRANDING.md#compatibility-identifiers). The user authorized a full repository/desktop rebrand and creation of artwork; website code belongs to a separate project. The [visual asset treatment](../assets/brand/README.md) is an authored default, distinct from the confirmed product name.

### Projects and game knowledge

- Users create independent **Projects** for different games. Project creation captures a name, description, one selected game engine, selected module(s), and one or more genres. The selected engine is locked for that Project after creation; genres and enabled modules can be changed later.
- Modules are enabled capabilities, not permanent components of the Project's identity. Selecting them during setup is a convenience; a user can enable or disable modules later.
- Disabling a module preserves its authored records. Its views, agent capabilities, and module-specific checks are inactive until it is enabled again; re-enabling restores access to those records.
- Story is an optional module overall, but a selected genre can require it.
- An active genre pack keeps its required modules enabled. To disable one of those modules, the user must first remove every active pack that requires it. Disabling the module still preserves its authored records.
- Modules and genre packs are **installable extensions** that users can create and share. The platform may later have a marketplace for discovering and distributing community extensions.
- Extensions form a **full plugin system**: they may add and execute code and tools, not just declare schemas, views, or agent instructions.
- Executable game-platform plugins run in separate processes with Windows/Linux operating-system isolation and a central tool broker enforcing the selected access mode. Do not require Docker or Podman to run plugins.
- The plugin system also covers engine connectors, asset services, model providers, agent roles, validators, UI panels, and **installable skills** that agents can use.
- Skills are installed once, enabled per Project, and made eligible for selected agents or work types. The system chooses relevant skills dynamically for each task and loads their full content only when needed to use context tokens efficiently.
- Agents can discover and load additional eligible skills **and tools during an active task** when new needs emerge. Initial selection does not freeze their capabilities for the rest of the task.
- A new Project can be created by **cloning an existing Project as a whole**. The clone is a full, independent copy of the game and its Project state, not a template or a live connection to the source Project.
- Each Project is a **self-contained, independent folder** holding its game files, assets, Markdown design/canon, Project settings, plugin version references, tasks, and history. Cloning copies that folder and assigns the copy a new Project identity while keeping the same engine. Global provider credentials and shared router learning stay in the platform profile rather than in the Project folder.
- Use a Project-local SQLite database inside each Project folder for structured operational state such as tasks, agent discussion, and metadata. Markdown and Git hold design/canon and source history. A separate global profile database holds platform settings and shared router learning.
- Every new Project starts with its own **Git repository** for versioning and review of code, Markdown, and Project records. Backups remain a separate recovery system.
- Provide a backup and restore system for Project folders. Destinations include local storage, FTP, S3, Google Drive, and additional destinations supplied by plugins.
- Backup and restore also covers the **platform profile** separately from Project folders, including global settings, installed-plugin records, provider connection configuration, and the router's shared learning history.
- Project and platform-profile backups are encrypted by default. Restoring encrypted backups requires the separate user-controlled unlock secret.
- Offer an optional LLM-powered name/title and description generator or enhancer during project creation. The user can keep or edit its suggestions.
- Genres act as **packs of modules**. A Project can select multiple genre packs, each with required modules and genre-specific behavior. An MMORPG quest chain and an action game's encounter narrative can use different structures while sharing concepts supplied by enabled modules.
- Connect to Unity, Unreal Engine, and Godot projects. The platform must relate design records to the actual code and assets of each project.
- Use CLI and MCP connectors for Unity, Unreal Engine, and Godot integration in the chosen system design. In-editor companion plugins may be considered as a later expansion, but are not required for the current connector contract.
- MCP connections support three setup modes: launch a configured local server command, connect to an already-running server endpoint, or launch a configured MCP server in a local Docker container. Docker is optional and is not required by the platform or its plugin runtime.
- Keep design records and any enabled story canon as readable Markdown files for direct access, editing, review, and version control.
- Support selectable **local and remote vector database storage** for semantic search: embedded LanceDB, local Qdrant, remote Qdrant, and additional local or remote adapters. Also support codebase search and reference discovery. The vector index is derived; Markdown and source files remain accessible without it.
- The vector database connection is **read/write**: the platform creates and updates embeddings with source metadata, removes stale entries, and queries them for semantic search. Support Qdrant or another compatible local vector database through adapters. Keep each Project's indexed content logically separate and allow indexes to be rebuilt from its files and records.
- Agents author new long-term Project knowledge in reviewable Markdown or structured Project records. The indexing service then writes corresponding embeddings to the connected vector database; vectors are not the sole or primary record of authored knowledge.
- Track concepts supplied by enabled modules, including story, backstory, quests, characters, and gameplay systems where relevant, alongside assets, decisions, and dependencies so a requested change can reveal effects across disciplines.

### Agents, tools, and access

- Provide a multi-agent, multitask system whose specialists can work on related code, design, narrative, assets, and validation tasks, with coordination and feedback loops involving the user where needed.
- Run agent orchestration in the local platform service. Persist recursive task trees, discussion, checkpoints, retries, and results in Project-local SQLite; supervised worker processes execute agents and tools. Do not require a separate workflow server.
- Coordinate independent parallel code and documentation edits in isolated Git worktrees. Use resource locks for live engine and asset operations that share a session or mutable workspace; detect and resolve conflicts before integrating work.
- Agents may dynamically spawn agents, sub-agents, and deeper descendants to delegate work. They may form a swarm of concurrent specialists when the task warrants it; delegation is not limited to agents launched directly by the central coordinator.
- Agents across a swarm can communicate directly through a centralized **Project discussion board** for organized questions, proposals, findings, and coordination.
- The user can read and participate in the same board and mark decisions as binding guidance for the Project.
- Binding board decisions trigger updates to the relevant Markdown canon or design records under the Project's current access mode.
- A configurable LLM-powered **discussion board maintenance agent** runs in the platform backend. It manages board cleanup and organization, audits board content and decisions against Project records, updates relevant areas when authorized, and alerts or assigns a suitable specialist agent when work falls outside its role.
- The board maintenance agent acts on new binding decisions immediately and runs configurable periodic audits. Routine cleanup archives and summarizes old threads while retaining their history; permanent deletion is available only when explicitly configured.
- **Every configurable platform behavior is managed through an organized settings system and UI.** Settings must be presented in tabs, sections, or separate pages rather than one long page. Plugin-provided settings belong in this system too.
- Settings use platform-wide defaults, per-Project overrides, and temporary per-session overrides where applicable. The UI shows the effective value and which scope supplied it.
- Desktop window-close behavior is configurable: keep agent swarms and background jobs running, or stop and checkpoint them. The selected behavior is exposed in Settings.
- Support Windows and Linux desktop installations. Connector availability is reported per operating system; macOS is outside the intended support scope.
- Offer IDE-style access modes: **Full access**, **Restricted**, and **Ask always**. In **Full access**, the system really has full access, including high-risk actions, within the user's environment and available credentials. Do not silently substitute an extra approval gate for that choice. The exact session and tool scope of the other modes remains to be specified.
- Connect to game-asset-development tools through MCP and/or CLI integrations where those interfaces are available, including Blender, relevant Autodesk game-art applications (such as Maya or 3ds Max), Cinema 4D, ZBrush, and other tools added through plugins. Do not target unrelated Autodesk design/engineering applications merely because they share the vendor name. Connector capabilities must be discovered and reported per application rather than assumed to be identical.
- Include Meshy and Tripo3D as asset generation providers in the asset pipeline, with other providers addable through plugins.
- The built-in 2D/3D asset workspace is for **inspection**, including 3D orbit/rotation and full-angle viewing, basic 2D navigation, animation playback, rig and mesh hierarchy inspection, material and texture-channel inspection, and LOD switching. Actual editing of meshes, textures, rigs, animations, and source assets stays in connected authoring applications.

### Models and routing

- Allow multiple model providers and multiple accounts for the same provider. The user can register/select available models and specify which work types and/or agents may use each model.
- The user can configure **candidate model pools** from their provider accounts per agent and/or task type. Chat and backend tasks offer an **Auto** model choice that selects the most suitable model from the eligible pool rather than from every model the platform knows about.
- When both agent-specific and task-type pools apply, Auto uses their **intersection**. If no model remains eligible, it reports the configuration conflict rather than silently expanding the pool.
- Route dynamically using price and latency **and** demonstrated performance, capabilities, reliability, local usage results, and human feedback. Provider metadata, including information available through services such as OpenRouter, can inform routing; locally observed outcomes must also contribute.
- Auto routing favors expected task quality by default, subject to configurable cost and latency limits and per-Project settings.
- Auto continually monitors outcomes and updates its model-performance estimates using local task results, user feedback, and relevant online sources when accessible. It can occasionally evaluate less-tested **eligible** models to learn their task-specific performance, under configurable exploration and budget controls.
- "Training" means improving the **routing system's selections** through a recursive observe → evaluate → update → route feedback loop. It does **not** mean fine-tuning the manager model or task-model weights.
- Routing outcomes from all Projects on the user's installation contribute to one shared learning history. Selection still considers task type, engine, genre, agent, and Project context rather than treating every observation as interchangeable.
- A smaller manager model helps decide which eligible model should handle a task. The routing system must retain explicit eligibility and access rules so a model decision cannot override user configuration.
- Connect to cloud model providers and separately running local model servers. Do not bundle a model inference runtime with the desktop application; keep the platform installation slim.
- Support different models for different tasks, including planning, coding, narrative, asset prompting, review, and validation. The exact provider integrations and scoring formula remain open.

## Proposed architecture for discussion

These are design proposals, not decisions or implemented capabilities.

1. **Project workspace:** Each Project is a portable independent folder owning its game identity, fixed engine, selected genres and modules, game files, connected-tool references, Markdown design/canon, assets, tasks, agent activity, history, and a Git repository. Project data and retrieval indexes are isolated by default. Cloning copies the folder and Git history and assigns a new Project identity while keeping the source engine. Recommended clone behavior removes or resets the source repository's remotes so the clone cannot accidentally publish back to the original game; the user can configure a new remote. Derived indexes can be copied or rebuilt without losing Project content. Global credentials and cross-Project routing history remain in the platform profile.
2. **Project knowledge layer:** Markdown design/canon files plus stable IDs and links among entities; repository and asset indexes; optional read/write connection to a local vector database for semantic retrieval. The indexing service upserts embeddings and metadata after file or record changes, deletes stale entries, and reconciles the index against Project sources. Search results should cite exact files and revisions so agents can distinguish canon from inference. Each Project's vectors remain logically separated, including after a full Project clone.
3. **Unified plugin system:** Installable plugins can supply engine connectors, asset services, model providers, agent roles, validators, UI panels, skills, modules, and genre packs. They may register and execute code and tools as well as provide schemas, views, workflows, agent capabilities, and checks. A genre pack declares required modules and may suggest additional ones; multiple selected packs combine their requirements. Users can enable or disable other modules independently at creation or later. A required module stays enabled while any active pack requires it. Module enablement updates available behavior while preserving authored content. Plugin manifests should identify versions, dependencies, compatible platform/engine versions, and requested capabilities; exact package and execution contracts remain open.
4. **Skill and tool registry:** A skill is a reusable agent capability package that can contain instructions, resources, scripts, and tool bindings. Install skills globally, enable them per Project, and define eligible agents/work types. The registry exposes compact descriptions of each skill and tool, including purpose, version, dependencies, supported agents/work types, and requested capabilities. Agents select relevant skills and tools at task start and can discover and load additional eligible ones mid-task; full instructions and schemas enter context only when needed. Skills use the Agent Skills open format so existing community skills install without conversion; ranking and loading defaults are in [SKILLS_AGENTS_AND_TOOLS.md](SKILLS_AGENTS_AND_TOOLS.md).
5. **Engine and asset adapters:** Typed operations for discovery, preview, apply, and validation in Unity, Unreal, Godot, game-asset authoring tools, and external generation providers. Game-engine adapters use CLI and/or MCP. An adapter reports what is actually connected, what it can do through those interfaces, and which operations succeeded; an installed engine or running process alone is not proof of a live editor connection. Blender, relevant Autodesk game-art applications, Cinema 4D, ZBrush, Meshy, and Tripo3D are requested integration targets; exact capabilities must be verified per tool. In-editor companion plugins are a possible later expansion, not a required dependency.
6. **Change graph and agent swarm coordinator:** Convert a request into linked impacts and tasks across story, gameplay, code, assets, and tests. Any authorized agent may delegate subtasks recursively and run concurrent specialists. Track parent/child relationships, assignments, dependencies, results, and changes in a shared task graph; reconcile outputs and surface decisions requiring human direction. Each new agent receives a task-specific model, tools, skills, context, and access scope. Agents can revise plans and discover additional eligible skills and tools as task requirements change. Concurrency and resource budgets should be user-configurable; exact coordination rules remain open.
7. **Project discussion board:** Provide shared, persistent communication across the agent swarm and the user. Proposed organization is a Project-level board with threads linked to tasks, game concepts, and changed artifacts; messages can carry questions, proposals, findings, blockers, evidence, and decisions. The user can post and mark decisions as binding Project guidance. Binding decisions update relevant Markdown canon/design records under the current access mode. Agents can subscribe to relevant threads and retrieve summaries or specific messages on demand to avoid loading the entire board into every context.
8. **Board maintenance agent:** Provide a configurable backend LLM agent with a selectable model, skills, tools, and operating settings. It organizes and cleans up discussion threads, audits decisions and references, keeps linked records aligned, and requests work from or alerts specialist agents where needed. New binding decisions trigger immediate work, and configurable periodic audits catch drift. Routine cleanup archives and summarizes old threads with retained history; explicit settings may permit permanent deletion.
9. **Model registry and adaptive router:** Store provider accounts separately from models. Let the user create candidate pools at platform, Project, agent, and task-type scopes. In Auto mode, classify the work, intersect applicable agent and task-type pools, filter to eligible account/model entries and required capabilities, then rank them using task-specific quality, observed outcomes, human feedback, reliability, cost, and latency under configured limits. Each selection records its context, candidate set, reason, and later outcome. Outcomes from all local Projects feed a shared learning history; task type, engine, genre, agent, and Project context remain available for specific estimates. The router recursively updates its selection policy from local outcomes and user feedback plus online provider/benchmark information with recorded source and freshness; base LLM weights are not fine-tuned. Proposed quality signals favor independent validation and human feedback over an agent's unsupported self-rating. Permit configurable exploration of less-tested eligible models so routing can improve rather than always repeat the current leader. Expose the selected model, reason, and observed outcome for each chat or backend assignment. A proposed manual choice can select one available model instead of Auto. If the filters leave no eligible model, report the configuration conflict rather than widening the pool. Other scope-precedence details remain open.
10. **Access policy and audit trail:** Apply the selected access mode at actual tool execution and inherit it through spawned agents; an agent cannot gain more access by delegating. Recommended mode contract: **Full access** permits all available actions, including high-risk, destructive, paid, and external actions, without an extra approval gate; **Restricted** enforces a configurable capability allowlist and denies actions outside it; **Ask always** requests approval for each side-effecting or paid action while allowing read-only inspection. Every mode records actions, external costs, changes, validation evidence, and user decisions. The exact capability taxonomy and prompt grouping remain open.
11. **Structured settings system:** Expose all configurable behavior through organized settings pages with clear scopes, validation, searchable navigation, and an effective-value view. Platform defaults can be overridden per Project and temporarily per session where applicable; the UI identifies the source of each effective value. Proposed page groups: general/workspaces and background behavior; Projects and genres/modules; agents, swarms, and skills; model providers/accounts/routing/budgets; engine, asset, and tool connections; access and security; discussion board/maintenance; plugins/updates; storage/search; logs/audit. Plugins register settings schemas and UI sections through the same system. The chosen engine is displayed as a locked Project property after creation, not as an editable setting.
12. **Backup and restore:** Back up complete Project folders and the platform profile as separately selectable scopes. The profile covers global settings, installed-plugin records, provider connection configuration, shared router learning, and saved credentials. Destinations include local storage and pluggable remote destinations such as FTP, S3, and Google Drive. Proposed controls include manual and scheduled backups, retention, integrity verification, restore into a separate folder, and destination-specific credentials in platform settings. **Encrypt both Project and platform-profile backups by default.** Profile backups include encrypted recoverable credentials; restoring encrypted archives requires a separate user-controlled unlock secret that is not stored with the backup. Backup format and strategy (full or incremental, compression, source-control metadata) remain open. [OWASP cryptographic storage guidance](https://cheatsheetseries.owasp.org/cheatsheets/Cryptographic_Storage_Cheat_Sheet.html)
13. **Source control and change management:** Initialize Git for each new Project. Independent concurrent code/docs tasks use isolated Git worktrees, while live engine and asset operations use resource locks on shared sessions or mutable workspaces. The coordinator validates changes and resolves conflicts before integrating them, preserving reviewable diffs and rollback points. Large binary assets need a configurable versioning strategy rather than assuming normal Git objects are always appropriate. Clones preserve history but receive a separate Project identity and no inherited publishing target by default. Exact commit and merge automation follows the selected access mode.

## Proposed end-to-end interaction

The user requests a change. The coordinator retrieves relevant canon and repository context, identifies likely story/gameplay/code/asset consequences, and asks for creative choices where the user's intent is ambiguous. It builds related tasks, routes each to an eligible model and tool, carries out work under the selected access mode, checks the result in the relevant tools and engine, and presents changed files, assets, test evidence, costs, and unresolved decisions. Feedback can reopen affected tasks and propagate revisions across disciplines.

## Interface foundation: Eclipse Theia (selected)

**Decision:** Build the all-in-one Game Development Control Room as a **desktop-only Eclipse Theia application**. Theia supplies the extensible IDE workbench; the platform's game-specific features, agent system, model router, project knowledge, engine/DCC connectors, and plugin contract remain our responsibility. This is a design choice, not an implementation claim.

**Product orientation:** The primary experience is an **all-in-one Game Development Control Room/Center**. Project state, creative direction, agent swarms, discussion, assets, engine activity, validation, and a full code-development environment are first-class surfaces. The platform should provide its own editing, file navigation, search, terminal, version-control, debugging, and related development workflows so users do not need a separate IDE for normal work. Unity, Unreal Engine, and Godot remain external applications reached through connectors; their full editors are not embedded.

Proposed main surfaces: Project home and cross-discipline status; game knowledge/canon; genre/module workspaces; agent swarm and task graph; shared discussion board; asset pipeline; engine connection and live operations; full coding workspace; validation/build evidence; and organized settings. The exact navigation and layout remain open. The built-in asset workspace lets users inspect 2D assets, orbit/rotate a 3D view through 360 degrees, play animations, inspect rig/mesh hierarchies and materials/texture channels, and switch LODs. Source-asset editing is orchestrated through connected game-art tools and external generation providers.

| Option evaluated | Outcome of discussion |
| --- | --- | --- |
| Fork **Code OSS** | Provides a mature IDE but would require maintaining a fork for deep Control Room changes. Not selected. |
| Build on **Eclipse Theia** | Designed for deeply customized desktop/browser development tools while retaining broad IDE features and compatibility with many VS Code extensions. **Selected.** |
| Build a **custom app with Monaco** | Gives interface freedom but requires building much of the surrounding IDE. Not selected. |

Proposed architectural boundary: a local platform service owns Projects, agents, model routing, knowledge/indexes, permissions, discussion, and platform plugins. The Theia desktop workbench is a client of that service and hosts native editing and custom Project views. Window-close behavior is configurable: jobs either keep running in the background or stop and checkpoint. Exact restart and recovery behavior remains open.

**Packaging decision:** Ship a desktop application only. Browser access would mainly offer access from another computer and does not improve plugin installation or local engine/DCC connectivity for this use case. [Theia application targets](https://theia-ide.org/docs/composing_applications/)

Relevant references: [Theia application composition](https://theia-ide.org/docs/composing_applications/), [Theia extension types](https://theia-ide.org/docs/extensions/), and [Theia AI customization](https://theia-ide.org/docs/theia_ai/).

### Unified Plugins catalog (selected experience; runtime contract proposed)

**Decision:** Present compatible coding extensions and game-platform plugins in one in-app Plugins catalog, with each listing showing its type, capabilities, and access. Theia can install VS Code-compatible extensions at runtime through Open VSX. Its deepest Theia extensions are compiled into the application, while runtime plugin options have narrower APIs. Our game-platform plugin runtime must cover the installable genre packs, agents, skills, connectors, settings, tools, and UI contributions required by this design.

Proposed package contract: a versioned platform-plugin manifest declares plugin type(s), runtime entry points, UI contributions, settings pages, permissions/capabilities, dependencies, compatible platform/engine versions, and bundled skills. A local plugin host loads and unloads supported plugin types without rebuilding the Control Room. The unified catalog can draw coding extensions from a compatible registry and platform plugins from a community registry or direct package/Git source. Install, update, enable per Project, inspect permissions, and rollback should work from the same organized UI. A marketplace distributes packages; local installation does not depend on it.

Sources reviewed: [Theia extension types](https://theia-ide.org/docs/extensions/) and [Theia runtime VS Code extension installation](https://theia-ide.org/docs/authoring_vscode_extensions/).

## Engineering details to resolve without serial preference questions

Use the delegated best-practice judgment for these details, record the choice, and bring back only a genuine user-owned creative or consequential product decision. The [technical architecture](TECHNICAL_ARCHITECTURE.md) now records defaults for the main technology choices.

- Which specific Autodesk game-art applications should be included beyond Maya and 3ds Max, if any?
- After an application or machine restart, should checkpointed agent work resume automatically or wait for the user's command? Could this also be a setting?
- How should concurrent edits to the same game files or design records be coordinated and merged?
- Which backup controls should be required: schedule, retention, compression, encryption, incremental snapshots, integrity checks, and restore testing?
- Which settings are global and which can be overridden per Project, especially provider accounts, eligible models, access mode, and tool connections?
- Should canon stability markers be advisory when Full access is selected?
- What exact capabilities are permitted under Restricted and Ask always, and how is an access mode selected and scoped to a session or project?
- What privacy, budget, and account-selection controls should apply to connected cloud and local model endpoints?
- What signals establish model performance by work type: automated evaluation, engine validation, user ratings, reviewer judgments, or a combination? How should stale or sparse data affect routing?
- Which game concepts are shared by every project, and which belong only to genre modules? How are hybrid genres represented?
- What are the canonical tool contracts for engine edits, asset generation, import, review, and validation?
- What contribution rules and third-party notice policy should accompany the Apache-2.0 license?
- Should the platform embed a skills.sh browsing view (requires a proxy for its OIDC-only API) or rely on paste-a-source installation only?

## Decision log

| Decision | Status | Source |
| --- | --- | --- |
| Independent Projects with name, description, selected modules, and one or more genres | Confirmed | User discussion |
| Select one game engine at Project creation and keep it fixed for that Project | Confirmed | User discussion |
| Edit genre labels and enable or disable modules after Project creation; setup selection is a convenience | Confirmed | User discussion |
| Disabling a module preserves its records and suspends its views, agent capabilities, and checks until re-enabled | Confirmed | User discussion |
| Story is optional overall but may be required by a selected genre; genres act as module packs | Confirmed | User discussion |
| Active genre packs keep required modules enabled until all packs requiring them are removed | Confirmed | User discussion |
| Modules and genre packs are installable, shareable extensions; a community marketplace may be added later | Confirmed | User discussion |
| Extensions can add and execute code and tools through a full plugin system | Confirmed | User discussion |
| Run executable platform plugins in separate processes with Windows/Linux isolation and central tool-broker enforcement; no Docker or Podman dependency | Confirmed | User discussion |
| Unified plugins cover engines, assets, model providers, agents, validators, UI, and installable skills | Confirmed | User discussion |
| Install skills globally, enable them per Project, assign agent/work eligibility, and select/load them dynamically for token efficiency | Confirmed | User discussion |
| Agents can dynamically discover and load eligible skills and tools during an active task | Confirmed | User discussion |
| Agents may recursively spawn agents, sub-agents, and deeper specialists, including concurrent swarms | Confirmed | User discussion |
| Use the local platform service and Project SQLite for durable agent orchestration, with supervised worker processes and no separate workflow server | Confirmed | User discussion |
| Use Git worktrees for independent parallel code/docs edits and resource locks for shared live engine/asset operations | Confirmed | User discussion |
| Delegate remaining routine technology choices to best-practice judgment rather than serial approval questions | Confirmed | User discussion |
| Agents across a swarm communicate through a centralized Project discussion board | Confirmed | User discussion |
| The user can participate in the board and mark decisions as binding Project guidance | Confirmed | User discussion |
| Binding board decisions update relevant Markdown canon/design records under the current access mode | Confirmed | User discussion |
| A configurable backend LLM agent maintains and audits the board, updates linked areas, and alerts or assigns specialist agents | Confirmed | User discussion |
| Board maintenance runs immediately for binding decisions and periodically for audits; cleanup normally archives/summarizes with history retained, and deletion requires explicit configuration | Confirmed | User discussion |
| All configurable behavior, including plugin settings, appears in a structured settings system with separate pages or tabs | Confirmed | User discussion |
| Settings inherit from platform defaults through Project and applicable session overrides, with effective value and source shown in the UI | Confirmed | User discussion |
| The primary interface is a Game Development Control Room/Center | Confirmed | User discussion |
| The Control Room is all-in-one, including full IDE functions; Unity, Unreal, and Godot stay external through connectors | Confirmed | User discussion |
| Eclipse Theia is the selected foundation for the Control Room | Confirmed | User discussion |
| The Theia Control Room is desktop-only; no browser client is required | Confirmed | User discussion |
| Support Windows and Linux desktop installations; macOS is outside the intended scope | Confirmed | User discussion |
| Window-close behavior is configurable between background continuation and stop/checkpoint | Confirmed | User discussion |
| One in-app Plugins catalog includes compatible coding extensions and game-platform plugins with clear types and capabilities | Confirmed | User discussion |
| Built-in 2D/3D asset viewing and manipulation, with MCP/CLI connections to DCC tools and Meshy/Tripo3D in the generation pipeline | Confirmed | User discussion |
| Built-in asset interactions are inspection only, especially 360-degree 3D viewing; editing stays in connected game-asset authoring tools | Confirmed | User discussion |
| Asset viewer includes animation playback, rig/mesh hierarchy, materials/texture channels, and LOD switching | Confirmed | User discussion |
| Clone an existing Project as a complete, independent copy of the game and Project state; do not attach to the source | Confirmed | User discussion |
| Each Project is a self-contained folder; cloning copies that folder with a new Project identity and the same engine | Confirmed | User discussion |
| Use Project-local SQLite for operational state, with Markdown and Git for design/canon and source history | Confirmed | User discussion |
| Every new Project starts as its own Git repository; backups are separate | Confirmed | User discussion |
| Global provider credentials and shared router learning stay in the platform profile outside Project clones | Confirmed | User discussion |
| Back up and restore Projects locally or through FTP, S3, Google Drive, and plugin-provided destinations | Confirmed | User discussion |
| Back up the platform profile separately from Projects, including global settings, plugin records, connections, and shared router learning | Confirmed | User discussion |
| Back up saved credentials with encrypted recovery and a separate user-controlled unlock secret | Confirmed | User discussion |
| Encrypt both Project and platform-profile backups by default | Confirmed | User discussion |
| Optional LLM-powered project name/title and description generation or enhancement | Confirmed | User discussion |
| Design for the complete end goal without project phases or a first-game milestone | Confirmed | User discussion |
| Free, open-source, locally run platform; one primary user initially | Confirmed | User discussion |
| Unity, Unreal, Godot, Blender, and external asset-tool connectivity | Confirmed | User discussion |
| Use CLI and MCP for game-engine connections; in-editor companion plugins are reserved for possible later expansion | Confirmed | User discussion |
| MCP server setup supports local commands, existing endpoints, and app-launched local Docker containers; Docker remains optional | Confirmed | User discussion |
| Readable Markdown canon and design records with optional local vector retrieval and code search | Confirmed | User discussion |
| Read from and write to a connected local vector database such as Qdrant, with Project separation and index synchronization | Confirmed | User discussion |
| Offer LanceDB, local Qdrant, remote Qdrant, and additional local or remote vector storage options | Confirmed | User discussion, 2026-10-04 |
| Agents author durable knowledge in Markdown or structured Project records; the indexer writes derived vectors | Confirmed | User discussion |
| Full access really permits high-risk actions; Restricted and Ask always are also available | Confirmed | User discussion |
| Multiple providers, accounts, selectable models, agent/work eligibility, dynamic routing using provider and local feedback data | Confirmed | User discussion |
| Connect to cloud providers or separately running local model servers; do not bundle an inference runtime | Confirmed | User discussion |
| Chat and backend work offer Auto selection from user-configured provider/account model pools scoped by agent and/or task type | Confirmed | User discussion |
| Auto routing favors quality by default under configurable cost and latency limits | Confirmed | User discussion |
| Auto intersects agent and task-type model pools and reports an empty intersection instead of silently widening eligibility | Confirmed | User discussion |
| Auto continually learns from local outcomes, human feedback, and available online sources, with controlled exploration among eligible models | Confirmed | User discussion |
| Recursive learning improves the router's model selections; it does not fine-tune LLM model weights | Confirmed | User discussion |
| Router performance learning is shared across all local Projects, while task and Project context remain available for scoring | Confirmed | User discussion |
| Original technical identity: **GameCrafter** (npm scope `@gamecrafter/*`, metadata prefix `gamecrafter-`, Project folder `.gamecrafter/`); public name superseded by PlayWeld below | Confirmed | User discussion |
| Public product name: **PlayWeld**; the user reports purchasing **playweld.com**. Existing technical identifiers remain compatibility contracts; see [branding](BRANDING.md). | Confirmed | User discussion, 2026-10-02 |
| Platform code, SDK, and documentation are licensed under Apache-2.0; sample/game assets are licensed separately | Confirmed | User discussion |
| Code and design documents share one monorepo; the development plan orders work packages by technical dependency only | Confirmed | User discussion |
| Track all repository work going forward in detailed changelog records and versioning, including additions, changes and removals | Confirmed | User discussion, 2026-10-02 |
| Permanent Markdown work records, generated changelog/release notes, changed-file CI coverage and recorded-impact version guards | Engineering default | [Work tracking contract](changes/README.md) |
| Adopt the Agent Skills (`SKILL.md`) open format for installable skills, with platform metadata under namespaced keys | Engineering default | SKILLS_AGENTS_AND_TOOLS.md |
| Agent roles are Markdown-plus-frontmatter packages with an access ceiling that delegation cannot exceed | Engineering default | SKILLS_AGENTS_AND_TOOLS.md |
| Every Project folder carries a generated AGENTS.md and a `.agents/skills/` directory | Engineering default | SKILLS_AGENTS_AND_TOOLS.md |
| Specific knowledge schema, database, model scoring, adapters, and permission boundaries | Open | Design discussion |

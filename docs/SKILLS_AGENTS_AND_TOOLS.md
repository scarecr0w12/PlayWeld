# Skills, Agent Roles, and Tool Connections: Design

**Status:** Engineering-default design built on the 2026-09-27 research pass. User-confirmed requirements are cited from `PLATFORM_DESIGN.md`; everything else here is a selected engineering default under the delegated best-practice judgment, not an implementation claim.  
**Last updated:** 2026-10-04
**Research basis:** [agent-skills-and-agent-ecosystem.md](research/agent-skills-and-agent-ecosystem.md), [engine-connectors.md](research/engine-connectors.md), [dcc-and-asset-tools.md](research/dcc-and-asset-tools.md), [process-isolation.md](research/process-isolation.md), [local-model-and-routing-sources.md](research/local-model-and-routing-sources.md).

This document resolves the skill, agent-role, and tool-connection contracts that `OPEN_DECISIONS.md` left open (A03, S04 skill portion, S06, S07, S08, C01, and parts of A02/S01/S02). It is organized by contract, not by milestone.

## 1. Guiding principle: adopt open formats, add platform metadata

The platform interoperates with the existing agent ecosystem rather than inventing its own skill or agent file formats:

| Concern                         | Adopted external format                                                                              | Platform additions                                                                                                               |
| ------------------------------- | ---------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| Skills                          | **Agent Skills** (`SKILL.md` + frontmatter, agentskills.io)                                          | Namespaced `metadata` keys for eligibility, capability requests, engine/genre tags; platform-side install and enablement records |
| Repository/Project instructions | **AGENTS.md**                                                                                        | Generated `AGENTS.md` in every Project folder pointing at canon, records, and conventions                                        |
| Agent roles                     | Markdown + YAML frontmatter, modeled on the widely used subagent-definition pattern                  | Platform fields for work types, model pools, access ceiling, board subscriptions                                                 |
| Tools                           | **MCP** (all revisions from 2025-03-26 to 2026-07-28), plus native platform tools through the broker | Capability metadata, access-mode mapping, per-operation execution mode                                                           |
| Plugin packaging                | Platform manifest (own contract, see `TECHNICAL_ARCHITECTURE.md`)                                    | Plugins may bundle skills, roles, MCP server definitions, and connectors                                                         |

Rationale: the `SKILL.md` format is already supported by dozens of agent products and has a public distribution ecosystem (skills.sh, `npx skills add`). Reusing it means every existing skill for Unity, Godot, Blender, or code review is installable into this platform without conversion, and skills authored here are usable by other tools.

## 2. Skills

### 2.1 Format

A platform skill **is** an Agent Skills directory. `SKILL.md` frontmatter follows the specification exactly (`name` matching the directory, `description` ≤1024 chars that says what and when, optional `license`, `compatibility`, `allowed-tools`). Platform-specific data lives under `metadata` with a `gamecrafter-` prefix (the original technical identity is retained under the [PlayWeld compatibility contract](BRANDING.md)) so unknown-key rules of other clients are respected:

```yaml
---
name: godot-scene-audit
description: Audit a Godot 4 scene tree for missing scripts, broken node paths, and unused resources. Use when validating scenes before export or after large refactors.
license: MIT
compatibility: Requires a Godot 4.x editor binary on PATH for headless checks.
metadata:
  gamecrafter-version: '1.2.0'
  gamecrafter-engines: godot
  gamecrafter-genres: '*'
  gamecrafter-work-types: validation,code-review
  gamecrafter-roles: validator,engine-engineer
  gamecrafter-capabilities: process.spawn:godot,fs.read:project
  gamecrafter-min-platform: '0.1'
---
```

`gamecrafter-*` keys are advisory hints for the platform's catalog and eligibility filters. They are validated by the platform and ignored by other clients. All values are strings (the spec requires string→string maps); lists are comma-separated.

### 2.2 Storage and scopes

| Scope                       | Location                                                              | Notes                                                                                                                                             |
| --------------------------- | --------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| Bundled first-party library | Packaged platform-service skill directories                           | 30 curated game-development skills, enabled by default per Project; source `builtin:gamecrafter`; see [library guide](GAME_DEVELOPMENT_SKILLS.md) |
| Platform (global install)   | `<profile>/skills/<name>/`                                            | Canonical copy; the installed-skill record in the profile database stores source, version/commit, hash, install time                              |
| Project enablement          | Project SQLite `skill_enablement` table + `project.json` pin          | Records enabled state, pinned version, per-Project eligibility overrides                                                                          |
| Project-local skills        | `<project>/.agents/skills/<name>/`                                    | Authored inside the Project, versioned in the Project Git repo, visible to external agents too                                                    |
| Compatibility scan          | `<project>/.claude/skills/`, `~/.agents/skills/`, `~/.claude/skills/` | Read-only discovery so skills installed by other tools are offered; never written to                                                              |

Precedence on name collision: Project-local > Project-enabled platform skill > compatibility-scanned; log every shadowing event to the Project diagnostics.

Confirmed requirement satisfied: skills are installed once, enabled per Project, and assigned eligibility ([platform design](PLATFORM_DESIGN.md#projects-and-game-knowledge)).

### 2.3 Installation sources (resolves S06 for skills)

The platform's skill installer accepts the same source forms as the `skills` CLI so users can paste any `npx skills add` argument: `owner/repo`, full GitHub/GitLab/Azure URL, tree URL to one skill, any Git URL, local path, direct `SKILL.md`/archive URL, and skills.sh pack URLs (`https://skills.sh/p/<id>`). Enforce download caps comparable to the CLI (10 MiB archive, 25 MiB extracted, 1000 files) with user override. Git sources record the resolved commit; archive sources record a content hash.

Before activation the catalog UI shows: source, resolved version/commit, license, `compatibility`, requested `gamecrafter-capabilities`, `allowed-tools`, and a diff of the `SKILL.md` body against the previously installed version on update. skills.sh audit results are shown when available, with the caveat that skills.sh cannot guarantee safety; the platform's own review is the trust decision. Because the skills.sh API is only available to Vercel-OIDC-authenticated callers, in-app browsing of the leaderboard is a possible later feature behind an optional proxy plugin, not a core dependency; local and Git installation never depend on it.

Trust rule: Project-local and compatibility-scanned skills are loaded only when the Project folder is trusted (Projects created by the platform are trusted; imported or cloned-from-external folders prompt once).

### 2.4 Catalog, selection, and loading (resolves A03/S08 for skills)

Three-tier progressive disclosure, as in the specification:

1. **Catalog (tier 1).** For the current task the platform computes the _eligible set_ deterministically: enabled in Project ∩ eligible for the agent role ∩ eligible for the work type ∩ engine/genre tags compatible ∩ requested capabilities permitted under the current access mode. Only that set's `name` + `description` + `location` enter context. Filtered skills are hidden entirely. If the set is empty, no catalog or activation tool is registered.
2. **Instructions (tier 2).** Activation goes through a dedicated `activate_skill(name)` broker tool whose `name` parameter is an enum of the eligible set. The tool returns the body with frontmatter stripped, wrapped in a structured `<skill_content name=… version=… dir=…>` block that lists bundled resources without reading them. Activation is recorded (task ID, skill name, version/hash, agent, model) so outcomes trace to the exact skill version.
3. **Resources (tier 3).** Skill directories are allowlisted for read access in every access mode so `references/`, `assets/`, and `scripts/` can be read without approval prompts. `scripts/` execution is **not** implicitly allowed: it runs through the tool broker under the skill's declared `gamecrafter-capabilities` and the session's access mode.

Ranking when the eligible set is large (>~40 skills): order by observed success for this work type/engine, then lexical match between task text and description, then recency of use; truncate the catalog and expose a `search_skills(query)` broker tool so agents can discover more mid-task. This satisfies the confirmed requirement that agents can discover and load additional eligible skills during an active task.

Context management: activated skill content is flagged protected from compaction; a second activation of the same skill in the same task returns a short "already loaded" notice instead of the body. Users can force-activate a skill with `/skill-name` in chat.

Selected implementation default: first-party bundled skills use the existing platform scope with source `builtin:gamecrafter`. Enabled installed/plugin copies override bundled copies; trusted Project-local copies override both, while compatibility copies have lower precedence. Project enablement and pins apply by name. The Control Room labels bundled copies and offers a paged guide/reference reader. The broker and authenticated RPC expose `skills/read-resource` for eligible, inventoried UTF-8 resources (including `SKILL.md`), with file/response/line bounds and containment checks. Reading resource scripts grants no execution authority. See [bundled library coverage and evidence](GAME_DEVELOPMENT_SKILLS.md).

### 2.5 Skill evaluation signal (feeds M06)

Each task completion records which skills were active and links to the task's validation evidence and user feedback. The router's outcome store therefore has skill-level features; a skill whose presence correlates with failures for a work type is surfaced in the catalog UI as "underperforming" but is never auto-disabled without a setting permitting it.

### 2.6 Authoring support

The platform ships a first-party `skill-creator` style workflow (Theia command + board thread) that follows the agentskills.io best-practice guidance: extract a skill from a completed task's trace, keep `SKILL.md` under 500 lines, put engine-specific reference material in `references/`, include a Gotchas section, and validate with a bundled port of `skills-ref validate`. Authored skills default to `<project>/.agents/skills/` so they travel with the Project and are visible to other agents.

## 3. Agent roles

### 3.1 Role package format

An agent role is a directory `roles/<name>/ROLE.md` (Markdown + frontmatter, body = system prompt) with optional `references/`. The format deliberately mirrors the subagent-definition pattern documented by Claude Code so role authors find it familiar:

```yaml
---
name: narrative-designer
description: Writes and revises quest, dialogue, and lore canon under the Story module. Delegate when a task changes narrative records.
work-types: narrative,canon-edit
requires-modules: story
model-pool: narrative # named pool; intersected with task-type pool per M04
max-access: restricted # ceiling; effective mode = min(session mode, ceiling)
tools: canon.read,canon.propose,board.post,search.semantic
disallowed-tools: engine.*,shell.*
skills: narrative-style-guide # preloaded in full at start
mcp-servers: [] # named servers from settings; inline definitions not allowed for marketplace roles
max-turns: 60
memory: project # <project>/.gamecrafter/agent-memory/<name>/
board-subscriptions: narrative,canon
isolation: none # or worktree (code roles)
---
System prompt body…
```

Rules:

- `max-access` is a **ceiling**, never an elevation; a spawned agent inherits `min(parent effective mode, role ceiling)` (confirmed: delegation cannot gain access).
- Marketplace/plugin-provided roles cannot set `mcp-servers` inline, hooks, or a `max-access` of `full`; those fields are honored only for roles authored in the Project or profile (same asymmetry Claude Code applies to plugin subagents).
- `isolation: worktree` maps to the confirmed Git-worktree rule for independent code/docs work; roles that operate live engine or DCC sessions declare `locks:` on the resources they need.
- `memory: project` gives a role a reviewable Markdown memory directory inside the Project; it is indexed like other Project records and is never the sole location of canon.

### 3.2 Built-in roles (engineering default set)

Coordinator, Explorer (read-only research; cheap model pool), Planner, Game Designer, Narrative Designer (Story module), Gameplay Engineer, Engine Engineer (per-engine skills), Asset Producer (DCC + generation providers), Validator (tests, engine/headless validation, no write outside evidence), Reviewer, Board Maintainer (confirmed backend agent). Genre packs and plugins add or specialize roles.

### 3.3 Delegation and swarm limits (defaults for A02)

Defaults exposed in Settings: max spawn depth 4, max concurrent agents per Project 8, per-task token/cost budget inherited and subdivided by the parent, duplicate-task detection by normalized goal hash + touched-artifact overlap. Explorer-style read-only agents run in the background by default and return summaries, keeping the parent context small.

## 4. Tool connections

### 4.1 MCP connection manager (resolves C01 policy)

- One connection record per server with `mode: command | endpoint | docker` (confirmed modes) and scope (platform or Project).
- Version negotiation: attempt `server/discover` (2026-07-28); on method-not-found fall back to the `initialize` handshake of 2025-11-25/2025-06-18/2025-03-26. Record the negotiated revision on the connection and show it in Settings.
- Transports: stdio and Streamable HTTP; HTTP+SSE is accepted only in a marked "legacy" state.
- Deprecated features (Roots, Sampling, Logging): never required. Servers that request Sampling are refused unless the user enables "allow server-initiated model calls" for that connection, in which case sampling is routed through the platform router with the connection's own model pool and cost accounting.
- Elicitation/MRTR `input_required` results are surfaced as board questions or UI prompts depending on access mode.
- Tool lists are cached per `ttlMs`/`cacheScope`; tools are presented to agents through the broker with the connection name as a namespace prefix.

### 4.2 Capability metadata and per-operation execution mode

Every tool, whether native, plugin-provided, or MCP, carries broker metadata:

- `execution-mode`: `project-file`, `headless-process`, or `live-editor` (from the engine research: all three engines support useful headless work, while high-level scene editing requires a live editor session).
- `side-effects`: `none`, `workspace-write`, `external-write`, `paid`, `destructive`.
- `evidence`: what the tool returns as proof (exit code + logs, screenshot, engine test report, generation task record).
- For MCP tools, `side-effects` defaults from tool annotations when present and otherwise to `external-write` until the user classifies the tool.

Access modes apply at the broker: Full executes everything within available credentials; Restricted allows tools whose `side-effects` are in the Project allowlist; Ask always prompts for any `side-effects` other than `none`. Arbitrary code execution tools (Blender `execute_code`, Unreal Python remote execution, Maya `commandPort`) are always labeled `destructive` because they can do anything the host application can.

The internal `decisions/assess` tool uses the same broker with `paid` side effects even for a local judge, and requires the request's Project/task identity to match the execution context. For agent tasks, task goal and role/work type come from service records; requested capability constraints and manual choices remain binding. A new agent loop can assess once and record/checkpoint bounded advice. Shadow mode changes no dispatch or instructions; explicit assist mode can supply a currently eligible model suggestion and conservative task flags. Model output never approves tools, supplies completion validation, relabels task type, spawns work, or changes required reviews. See [typed decision assistance](TECHNICAL_ARCHITECTURE.md#typed-decision-assistance) for endpoint configuration, probability semantics, evidence scope, and history ownership.

### 4.3 Engine connectors (implements C03; informs C04)

Each engine connector exposes two layers behind one capability report:

| Layer        | Unity                                                                                  | Unreal                                                                                                   | Godot                                                         |
| ------------ | -------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------- |
| Headless/CLI | `-batchmode -executeMethod`, `unity` CLI build/run/test                                | `UnrealEditor-Cmd -run=<commandlet>` for commandlets, editor Automation for tests, `RunUAT BuildCookRun` | `godot --headless --script/--check-only/--import/--export-*`  |
| Live editor  | Unity CLI `unity mcp` / Pipeline `[CliCommand]` (first-party) or community MCP servers | Epic's Editor MCP plugin (5.8, verify status) or community bridges via Python remote execution           | Editor-addon MCP servers; process launch via Node MCP servers |

The connector reports `project-file`, `headless-process`, and `live-editor` readiness separately, with detected engine version, project identity proof (e.g. `ProjectSettings/ProjectVersion.txt`, `.uproject`, `project.godot`), and the MCP revision of any live bridge. Unity's first-party `unity mcp` is the preferred live bridge; community servers are installable as connector plugins with their code-execution tools labeled as above.

Unity tests omit `-quit` and require completed NUnit reports; Unreal tests run editor Automation with queue-completion exit and exported JSON. Test success requires completed non-empty assertions and consistent counts, separately from process exit. Explicitly registered Unity Editors take priority over the CLI; a CLI tool version is not editor-version evidence. Native Windows processes receive an explicit directory/toolchain environment allowlist without unrelated provider credentials. The [live acceptance matrix](LIVE_ENGINE_ACCEPTANCE.md) records the exact Windows versions, access-policy checks and packaged fixtures; [Extended acceptance](EXTENDED_ENGINE_ACCEPTANCE.md) verifies Unity native game-folder identity and bounded file-backed PNG collection through the official MCP server. A two-tool CodeFizz acceptance adapter also proves Unreal identity and returns brokered viewport images. General bridge routing and physical desktop input stay Verify. Explicit draft-07 external tool schemas use an isolated legacy validator; other schemas default to 2020-12, with unresolved external references rejected.

### 4.4 DCC and generation connectors (implements C05/C06 defaults)

- First-party headless adapters where a documented CLI exists: Blender (`--background --python`), Maya (`mayapy`/`mayabatch`), 3ds Max (`3dsmaxbatch`), Cinema 4D (`c4dpy` on Windows; Linux is command-line-render only), ZBrush (`-script`/`-batch`, limited). Live-session bridges use community MCP servers as connector plugins; Maya `commandPort` is loopback-only and enabled only while a live bridge is active.
- Meshy and Tripo3D share the typed asset job lifecycle (create → poll → download → review → import → validate). Because neither API was verified to return machine-readable license/provenance fields, the platform records plan tier, task ID, prompts/references, timestamps, and a terms snapshot itself as provenance metadata attached to the imported asset record.
- Each connector publishes an OS support matrix drawn from `research/dcc-and-asset-tools.md`; unsupported combinations are shown as unavailable rather than failing at run time.

### 4.5 Plugin worker isolation (direction for S02; still Verify)

Selected direction from `research/process-isolation.md`: Windows workers run in a per-plugin AppContainer with explicit directory ACLs, network denied unless the capability is granted, inside a Job Object with kill-on-close and memory/CPU limits; Linux workers launch through a small audited `bwrap` launcher (mount, PID, user, and network namespaces) with Landlock and a seccomp profile layered when the kernel supports them, with `systemd-run --user` as an optional backend. Node's `--permission`, `worker_threads`, `isolated-vm`, and `vm2` are not accepted as isolation boundaries. Restricted and Ask-always fail closed when the launcher cannot establish the required controls; Full access may run plugins unisolated when the user enables that setting. S02 stays open until adversarial escape tests pass on both OS targets.

### 4.6 Agent-to-agent connections (A2A v1.0)

A2A is a distinct agent-task protocol, not an MCP transport and not a new in-house protocol named “ACP”. The user selected bidirectional A2A v1.0: PlayWeld can delegate to configured remote agents, and local harnesses can submit scoped tasks to PlayWeld. The reviewed specification supports multiple protocol bindings; this implementation selects JSON-RPC over HTTP(S) with streaming and rejects unsupported bindings rather than silently downgrading.

- **Outbound connection record:** connection ID, agent base URL, last discovered Agent Card summary, selected protocol binding, credential reference, and creation/update times. Credentials support static API-key header, bearer, basic, or custom headers in the encrypted profile credential store. Secret values are never returned by list/discovery RPCs. OAuth/OIDC, mTLS, cookie/query credentials, and provider subscription login are unsupported.
- **Outbound trust:** discovery is an explicit authenticated operation; the Agent Card and all remote task output/artifacts are untrusted data. Remote non-loopback endpoints require HTTPS; HTTP is permitted only for an explicitly configured loopback URL. Do not forward credentials across redirects or cross-origin interfaces. Brokered send/get/stream/resubscribe/cancel operations are attributed to their local Project/task/call, preserving normal access mode, Ask-always gates for side effects/paid calls, task ceilings, and audit records. When the caller has a local Task context, outbound stream events are bounded and forwarded into its event history as `a2a.remote_progress`. Migration 18 records remote task/context IDs and latest status for reconciliation; get/cancel/resubscribe and send-with-task-ID require a ledger entry owned by the calling Project, and `a2a/list-remote-tasks` exposes only that Project's records. Possessing a remote task ID alone conveys no authority. Large results are field-bounded while retaining Task IDs/context/status. No automatic retry is made for non-idempotent sends; if a send is interrupted before a remote task ID is returned, it cannot be automatically recovered.
- **Outbound role availability:** the builtin `coordinator` role is granted `a2a/*` to delegate to configured agents; other builtin roles do not receive A2A tools by default. Project/user access modes, external-write classification, and explicit approval rules still constrain each operation. A custom role can opt in by adding the corresponding `a2a/*` tool pattern.
- **Inbound gateway:** disabled until the user enables it and configures a port; it binds only to `127.0.0.1` and fails closed on a collision. It publishes an A2A Agent Card and implements task create/get/continue/stream/cancel only. The endpoint is a dedicated A2A listener and never exposes the platform's local service RPC or tool-call API. Public/LAN binding and webhook push callbacks are not supported.
- **Inbound client credential:** a local administrator issues a per-client bearer token; the plaintext is returned only at issuance/rotation and the server persists only its hash. A client grant explicitly lists permitted Project IDs, role names, `agent.run` task kind, and task operations. Every task read/mutation is checked against that grant, including continuation and cancel; object IDs do not imply authorization. Deduplicated task creation is rejected unless Project, role, and A2A client owner all match. Revocation invalidates the token and terminates active streams.
- **Continuation/approval boundary:** a continuation may answer only an unambiguous pending task question belonging to that task, or create a feedback attempt for a terminal task. After TaskService returns a task from a failed-attempt retry, the gateway rechecks Project, role, A2A client owner, and context so goal-hash deduplication cannot substitute another grant's task. It cannot answer, accept, or bypass a broker approval. Task execution remains in the durable TaskService → worker → broker path. Inbound text is bounded; non-text request parts and task-listing are unsupported.
- **Transport protections:** reject untrusted Host/Origin values, send no permissive CORS headers, cap bodies/concurrency/event-stream queues, and rate-limit authenticated clients separately from unauthenticated attempts and public Agent Card reads. Unauthenticated loopback traffic cannot exhaust authenticated quotas. A stream overflow fails closed and requires resubscription. A synchronous inbound send is capped at 120 seconds and may return a nonterminal task; callers can use the task ID to fetch or stream later. Outbound SSE responses are bounded to 512 KiB.

These settings and connection records are separate from MCP server definitions and model-provider accounts. A2A is an agent-to-agent task delegation contract; it does not make a remote Agent Card's advertised skills authoritative or directly grant those tools to a local agent.

## 5. Project folder additions

Each Project folder gains: `AGENTS.md` (generated, describes canon location, records, engine, conventions, and how to run validation), `.agents/skills/` (Project-authored skills), `.gamecrafter/roles/` (Project-authored roles), `.gamecrafter/agent-memory/<role>/`, and `.gamecrafter/skill-enablement` state in Project SQLite. Cloning copies all of these; pinned skill versions missing on the destination machine are offered for exact reinstall (S07 default).

## 6. Decision-register effects

| Entry               | Effect of this document                                                                                 |
| ------------------- | ------------------------------------------------------------------------------------------------------- |
| A03                 | Resolved: role package format, catalog tiers, mid-task discovery, activation recording                  |
| S04 (skill portion) | Resolved: skills are Agent Skills directories with `gamecrafter-*` metadata                             |
| S06                 | Resolved for skills/roles: CLI-compatible sources, caps, trust display; marketplace remains optional    |
| S07                 | Default confirmed: pinned versions in Project, exact-reinstall offer on clone                           |
| S08                 | Resolved: deterministic eligibility, ranking, search tool, outcome linkage                              |
| C01                 | Resolved: connection record with mode, negotiated MCP revision, deprecated-feature policy               |
| A10                 | Resolved: A2A v1.0, outbound static-auth Agent Card connections and loopback-only scoped inbound tasks   |
| C03                 | Resolved: per-operation execution-mode and evidence metadata                                            |
| A02, S01            | Defaults recorded (limits, ceiling inheritance, side-effect taxonomy); exact prompt grouping still open |
| S02, C04, C05       | Direction selected; remain **Verify** until tested                                                      |

## Operational and contributor references

The [integration guide](INTEGRATION_GUIDE.md) explains the current engine layers, MCP connection modes, builtin roles, skill authoring, plugin worker protocol and provider evidence boundaries. The [developer guide](DEVELOPER_GUIDE.md) covers building and contributing; generated [RPC](API_REFERENCE.md) and [settings](SETTINGS_REFERENCE.md) references expose the current service contracts. These guides supplement this target contract document and do not resolve broader community conformance or migration acceptance (Q04).

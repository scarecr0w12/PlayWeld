# Agent, swarm, and integration consistency review

**Release:** Unreleased

**Impact:** none

**Category:** Maintenance

## Summary

Investigation only: reviewed the current PlayWeld agent, swarm, skill, plugin, MCP, and engine/DCC integration paths. Identified ten actionable inconsistencies or contract gaps. No runtime fixes, dependency changes, release preparation, profile changes, or external engine/provider mutations were performed by this review.

## Details

- Scope and snapshot: inspected the current working tree on 2026-10-18, including pre-existing model-discovery, token-budget, package-version, generated-reference, and release edits. These edits were preserved and were not treated as changes authored or validated by this investigation. Reviewed repository/Kilo agent procedures separately from the service's builtin `ROLE.md` agents; these are different execution systems, not duplicate runtime definitions. Used Development OS, Specialist Reasoning, and Evidence Stewardship plugin skills, two independent read-only review agents, and the actual Context7 resolve/query tools for the official MCP tool-list notification contract. The diff-oriented `code-review` skill and the Codex Security scan skill were inspected for fit, but their workflows were not run; this was a system audit, not a completed Codex Security workbench scan.

### F01 — P1: engine and DCC RPC wrappers lose session access policy

- Evidence: `packages/platform-service/src/service.ts:498` and `:517` discard the RPC context for `engine/run` and `dcc/run`. Their connector services call the broker without session context at `packages/platform-service/src/engines/engine-connector-service.ts:375` and `packages/platform-service/src/dcc/dcc-connector-service.ts:302`. Ordinary `tool/call` forwards the session at `service.ts:731`.
- Trigger and consequence: Project access is Full, but the requesting session is Restricted or Ask Always. A connector operation uses the broader Project policy, whereas the equivalent ordinary tool call honors the session. Applicable task ceilings and other broker checks still exist; this is a session-policy propagation defect, not an authentication bypass claim.
- Probe: current-source broker policy comparison returned `direct tool/call access=restricted` and `engine/dcc wrapper access=full`. Invoking the actual engine connector `run` method with fake capabilities and a stopping broker spy reached `engine/build` without a broker context. The corresponding DCC omission is source-reviewed; an attempted DCC probe stopped at UUID validation and does not establish execution through that broker path.
- Recommended correction: propagate authenticated session context through both connector entry points and nested calls. Add an isolated RPC regression comparing direct and wrapped execution under Project Full plus session Restricted/Ask Always.

### F02 — P1: nested plugin calls discard the caller's role restrictions

- Evidence: `packages/platform-service/src/plugins/plugin-host.ts:715` saves the calling role, but `:524` substitutes `plugin:<id>` for downstream `host/tool/call`. `packages/platform-service/src/tools/tool-broker.ts:326` prefers that explicit role over the task's recorded role; `:588` exempts `plugin:` identities from role allowlists and disallowed tools.
- Trigger and consequence: a custom role allows a trusted plugin facade but denies its downstream tool. A plugin granted `tools.call` and any additional required host capability can make that downstream broker call without the caller's role restriction. Plugin capability grants, Project availability, effective access mode, approvals, and resource locks remain separate constraints. A Full or appropriately approved task with a restrictive role is the consequential case; the probe did not execute a forbidden engine operation under Restricted mode.
- Probe: actual source-loaded `PluginHost.callHostTool` received an invocation with role `reviewer` and emitted nested broker context `{accessCeiling: 'restricted', agentRole: 'plugin:fixture'}` for `engine/console`. Actual broker `roleAllows` returned true for the replacement role. This establishes loss of the role constraint, not successful console execution or OS sandbox escape.
- Recommended correction: retain plugin identity and capabilities while also intersecting nested calls with the originating agent's role restrictions. Add a regression with an allowed facade and explicitly denied downstream operation.

### F03 — P1: delegation does not preserve a request-wide cost envelope

- Evidence: `packages/platform-service/src/agents/agent-tools.ts:310` builds a child budget from model arguments and inherits only an explicitly supplied parent token ceiling. Parent cost and duration limits are not inherited automatically. `packages/platform-service/src/tasks/task-graph.ts:108` starts a separate child spend counter; `packages/platform-service/src/workers/supervisor.ts:528` accounts usage against the individual task. No ancestor aggregation was found in these paths. The target contract in `docs/SKILLS_AGENTS_AND_TOOLS.md:131` describes inherited and subdivided budgets.
- Trigger and consequence: a coordinator with a user-supplied one-dollar cost limit delegates without a child budget. Its child has no corresponding cost ceiling, and descendant spend is not charged to the root's envelope. Other configured model limits may still apply; they do not establish the requested subtree budget.
- Probe: actual delegation handler with parent budget `{maxTokens:10000,maxCostUsd:1,maxDurationMs:1000}` and spend `{tokens:9000,costUsd:0.9}` produced child budget `{maxTokens:10000}`.
- Qualification: the current dirty-tree change deliberately prevents models from inventing token ceilings and copies an explicit parent token ceiling. That behavior is documented in `roles/coordinator/ROLE.md` and covered by its current tests; it is not itself being reported as an accidental regression. The finding concerns cost-envelope inheritance and aggregate accounting. Duration semantics also need an explicit root-deadline versus per-task contract.
- Recommended correction: enforce the user's request cost envelope across descendants using atomic reservations or aggregate accounting; preserve the intended optional token-budget behavior.

### F04 — P1: cancellation can miss children delegated during shutdown

- Evidence: `packages/platform-service/src/tasks/task-graph.ts:163` snapshots descendants once, then processes them deepest first while awaiting shutdown at `:197`. Ancestors remain able to run during those awaits. Creation at `:55` has no cancellation barrier on the parent/ancestor chain.
- Trigger and consequence: parent P has child A; while cancellation of P awaits A's shutdown, P delegates B. B is outside the snapshot and can remain ready or execute after P is cancelled.
- Probe: executed actual `TaskGraph.cancel` with an isolated store and inserted B during the awaited child-stop callback. Result: cancelled tasks were A and P; P was `cancelled`, B remained `ready`.
- Recommended correction: fence the subtree against new delegation before awaiting shutdown, reject creation beneath cancelling or terminal ancestors, and cover the concurrent-delegation case. A second unfenced sweep alone does not close the race.

### F05 — P1: waiting coordinators can starve their own children

- Evidence: `packages/platform-service/src/workers/supervisor.ts:193` counts every non-stopped, unfinished worker against Project concurrency and skips dispatch at `:220` when full. `packages/platform-service/src/agents/agent-tools.ts:389` implements `tasks/await` by polling inside the existing parent worker without yielding execution capacity.
- Trigger and consequence: with `agents.maxConcurrentPerProject=1`, a coordinator delegates a child and awaits it; the child cannot start until the parent releases its slot. The same starvation occurs at higher limits when all slots are occupied by coordinators waiting for queued descendants. The call times out rather than waiting forever, but repeated waits do not make progress.
- Probe: actual `tasks/await` handler plus actual `WorkerSupervisor.schedule`, with a stub store and one active parent, returned `childStarts:0`, child state `ready`, and `timedOut:true` for a 60ms wait. This is method-interaction evidence, not a full child-process/provider test.
- Recommended correction: represent dependency waiting explicitly and yield execution capacity with guarded resumption that still enforces the Project concurrency limit.

### F06 — P2: skill work-type eligibility uses the execution kind

- Evidence: `packages/platform-service/src/skills/skill-service.ts:87` and `:137` pass `task.kind` as `workType`. For service agents this is `agent.run`, while roles and model routing use semantic work types such as `code`. `packages/platform-service/src/skills/skill-catalog.ts` applies exact membership filtering.
- Trigger and consequence: author a skill eligible for `code` and the engine-engineer role. It appears in a direct catalog query for `code`, but disappears from that role's agent-task search and cannot activate during the task. Unfiltered bundled skills can still work, so ordinary bundled-skill tests do not establish this integration.
- Probe: used actual current `SkillCatalog` and `SkillService` with a disposable in-memory fixture. Direct `code` catalog returned `[code-only]`; `searchForTask` for the engine-engineer `agent.run` task returned `[]`; activation rejected it as ineligible.
- Recommended correction: define and consistently resolve the task's semantic work type for skill discovery, activation, resource reads, and outcome statistics, separately from its execution handler kind. Cover role and skill metadata together.

### F07 — P2: builtin specialist roles cannot use their integrated tool families

- Evidence: `packages/platform-service/roles/engine-engineer/ROLE.md:8`, `packages/platform-service/roles/asset-producer/ROLE.md:8`, and `packages/platform-service/roles/validator/ROLE.md:7` omit engine/DCC tool patterns. `packages/platform-service/src/tools/tool-broker.ts:587` enforces those patterns; `packages/platform-service/src/workers/supervisor.ts:407` sends the filtered tool snapshot to agents.
- Trigger and consequence: delegate engine, DCC, or structured engine validation work to the corresponding builtin specialist. Its offered tools lack the owning connector APIs even when those APIs are installed and otherwise available. Shell-based work may still work, but it does not provide the same structured capability gates, connector run records, or live-bridge path. The asset producer also has no explicit asset-provider tool family grant; that observation was source-reviewed, not included in the 20-tool probe.
- Probe: loaded real builtin role files, registered actual engine and DCC tool definitions, and invoked actual broker inspection. Each of engine-engineer, asset-producer, and validator received zero of 20 integrated tools, all excluded as `role_tool_denied`.
- Recommended correction: grant selected operations appropriate to each role and its access ceiling, preserve lock/approval checks, and deliberately handle any downstream MCP authorization. Do not replace the allowlists with blanket access. The planner's `task/create` pattern also has no matching registered agent tool; distinguish a plan-only role from an actually task-creating role when reconciling these definitions.

### F08 — P2: dependency propagation silently stops at 200 candidates

- Evidence: `packages/platform-service/src/tasks/task-graph.ts:317` lists pending/blocked tasks without a limit before filtering by dependency ID; `packages/platform-service/src/tasks/task-store.ts:170` defaults to 200 rows. The scheduler dispatches ready/running tasks, so omitted pending dependents do not become runnable automatically.
- Trigger and consequence: complete a prerequisite with 201 pending dependents. One remains pending. Older unrelated pending tasks can also consume the first page and hide a smaller relevant dependency set. Failure propagation uses the same bounded candidate scan.
- Probe: actual `TaskGraph`, actual `TaskStore`, Project migrations, and disposable in-memory SQLite produced `ready:200`, `pending:1`, prerequisite `succeeded`.
- Recommended correction: query dependents directly or paginate the full candidate set. Cover both large fanout and unrelated older pending tasks.

### F09 — P2: MCP registry refresh does not refresh running agents' offered tools

- Evidence: `packages/platform-service/src/mcp/session.ts` handles `notifications/tools/list_changed`; the connection manager refreshes registry tools. However, `packages/platform-service/src/workers/supervisor.ts:405` sends tools only in the worker startup command, and `packages/platform-service/src/agents/agent-runtime.ts:182` merges that snapshot once for later completion requests. No running-worker tool update path was found.
- Trigger and consequence: an MCP server adds, removes, or changes a tool while an agent is running. Registry discovery updates, but the agent continues advertising its original tool set/schemas until a new worker attempt. Added tools cannot be selected from the offered set; removed or changed tools can provoke avoidable execution or validation failures. This is source-traced; no dynamic running-model refresh simulation was performed.
- Standards cross-check: Context7's actual resolver and documentation query returned the official [MCP 2025-11-25 tools contract](https://modelcontextprotocol.io/specification/2025-11-25/server/tools), which defines `tools/list` and the list-change notification. That cross-check supports the registry-refresh expectation; the running-agent inconsistency is derived from PlayWeld source, not an assertion that the protocol requires a particular worker architecture.
- Recommended correction: refresh the authorized tool/schema set at safe turn boundaries or provide a versioned worker update mechanism, retaining role/access filtering and context-size accounting.

### F10 — P2 contract gap: several role fields are parsed but have no runtime consumer

- Evidence: `packages/platform-service/src/roles/role-loader.ts:55`, `:56`, and `:64` populate `requiresModules`, `modelPool`, and `boardSubscriptions`. A source search across packages excluding generated libraries and tests found these fields only in contracts and the loader. The model router instead selects pools by pool target role/task type in `packages/platform-service/src/models/router.ts:593`; it never resolves the role's named `model-pool` field. `docs/SKILLS_AGENTS_AND_TOOLS.md:104` describes named-pool intersection, and `docs/INTEGRATION_GUIDE.md:136` describes role model-pool usage.
- Consequence: changing these declarative role fields does not itself enforce required modules, select the named pool, or subscribe that role to board topics. Targeted model pools configured separately can still work; ordinary explicit board reads can still work. The finding is incomplete wiring and misleading configuration expectations, not proof that all routing or board behavior fails.
- Recommended correction: either wire each field into its owning service with cross-area checks, or explicitly expose/document it as unsupported metadata until implemented. Preserve the distinction between target architecture and currently implemented behavior. Evidence is source inspection rather than live configuration acceptance.

- Compatibility and migration: this investigation changes only its permanent work record and the generated changelog. It adds no RPC/storage schema, changes no agent policy, removes no functionality, and requires no migration. All findings remain unresolved recommendations. Impact `none` is appropriate because the review ships no runtime behavior change; no version bump was performed by this task.

## Validation

- `npm exec -w @gamecrafter/platform-service -- vitest run src/agents/agent-runtime.test.ts src/agents/agent-tools.test.ts src/roles/role-loader.test.ts src/roles/role-registry.test.ts src/change/swarm-coordination.integration.test.ts src/tools/tool-broker.integration.test.ts --maxWorkers=1`: passed, 6 files / 50 tests. Existing worktree tests passed; this does not establish coverage of the new findings.
- `npm exec -w @gamecrafter/platform-service -- vitest run src/skills/skill-catalog.test.ts src/skills/skills.integration.test.ts src/mcp/session.test.ts src/agents/agent-approval.integration.test.ts --maxWorkers=1 --testTimeout=30000 --hookTimeout=60000`: passed, 4 files / 30 tests.
- Independent integration reviewer: `npx vitest run src/mcp/mcp-tool-adapter.test.ts src/skills/skill-catalog.test.ts src/engines/engine-tools.test.ts src/dcc/dcc-tools.test.ts --maxWorkers=1 --testTimeout=30000 --hookTimeout=60000` from `packages/platform-service`: passed, 3 files / 7 tests. No engine-tools test file matched; four files were not executed. Skill-catalog tests overlap the main review's second run, so these are supplementary executions rather than seven additional unique tests.
- Isolated current-source probes used transient `typescript.transpileModule` require hooks and bounded fixtures; no probe test files were retained. Evidence and qualifications are recorded per finding above. Only the dependency-fanout probe used the real database seam and Project migrations; method-level mocks elsewhere do not prove full-process or installed behavior.
- `bash scripts/check-links.sh`: passed, `All links OK`. `npm run format:check`: passed for all matched repository files. `npm run changelog:update` completed, and `npm run changelog:check -- --base HEAD` passed, including current worktree coverage and generated freshness. These maintenance checks do not validate the runtime findings or certify unrelated release work.
- Full Turbo build/typecheck/lint/test, dependency reinstall, live provider completion, real engine/DCC mutations, desktop UI journeys, and installer acceptance were not run for this investigation-only change. The existing dirty tree was not reset or repaired.

## Files

- `docs/changes/2026-10-18-agent-swarm-integration-review.md`

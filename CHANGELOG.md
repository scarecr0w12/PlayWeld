# PlayWeld changelog

Complete tracked work, grouped by version and category, with full details, validation, and affected files. Generated from permanent [work records](docs/changes/README.md). Run `npm run changelog:update`; edit the records rather than this file. Release preparation assigns pending records to a version. Historical completeness is limited to the tracking baseline below.

## Unreleased

### Fixed

#### Use Node for the advisory Claude Brain hook launcher

**Impact:** none

[Permanent work record](docs/changes/2026-10-26-claude-brain-portable-launcher.md).

##### Summary

Replace the newly supplied Windows-only Claude Brain hook wrapper with a Node launcher so the shared configuration does not require cmd on macOS/Linux.

##### Details

- Kilo's review of candidate 6c14c37 identified that cmd /c could not launch on Unix hosts. Its GitHub check reported success when review completed, but the actual review summary contained one warning and recommended addressing it before merge; a green review check alone was insufficient acceptance.
- Replace the outer cmd command with the repository's existing Node runtime. Node invokes two fixed literal commands through its host's default shell: first entire-brain hook pre-edit --claude-hook, then entire brain hook pre-edit --claude-hook if the first fails. No event-derived text is interpolated. Preserve inherited input/output, stop after success, and permit edits if both advisory commands fail. This removes the unconditional cmd requirement without adding dependencies or treating the hook as a security gate.
- Compatibility and migration: developer configuration only, using the existing Node 24+ prerequisite. No application, RPC, schema, storage or dependency changes; no migration required. Keep version 0.23.0 and impact none. The previous Brain setup record describes the original supplied configuration; this record documents its correction. Brain remains uninstalled locally and live Claude context injection remains unverified.

##### Validation

- The actual configured command passed 16 isolated Windows cases: primary success, fallback success, both commands failing, and both missing, each through PowerShell 5.1, PowerShell 7, cmd and direct Node. Fixtures verify stop-after-success, fallback selection and advisory zero exit without real Brain/model calls. The required local full gate passed 33/33 tasks from cache in 200 ms; the previous fresh platform-service suite remains separately recorded. Formatting, link and branch-base change-record checks are refreshed before commit. Actual Unix Claude sessions, Brain indexing and context injection are not claimed from local Windows fixture checks; the removal of the outer cmd dependency is source evidence. Hosted checks and review must qualify the corrected final head.

##### Files

- `.claude/settings.json`
- `docs/changes/2026-10-26-claude-brain-portable-launcher.md`

#### Address Entire PR hook execution and stale opportunity findings

**Impact:** none

[Permanent work record](docs/changes/2026-10-26-entire-pr-review-corrections.md).

##### Summary

Address all three findings from the first Kilo review of [PR 24](https://github.com/scarecr0w12/PlayWeld/pull/24): make SessionStart executable through the Windows shells while preserving valid missing-CLI guidance, and mark two opportunities already completed in PR 23 as historical.

##### Details

- The CLI-generated SessionStart body was bare cmd-language syntax while the session shell can be PowerShell. It failed with parser errors under Windows PowerShell 5.1 and PowerShell 7. The reviewer correctly identified the startup risk, although the versioned Codex runner uses a configured shell rather than universally spawning commands without one. A naive cmd wrapper also failed; a doubled-quote variant fixed PowerShell but emitted invalid JSON under the cmd fallback. Retain these failed experiments as local evidence rather than treating static JSON validity or Entire's template match as execution proof.
- Replace only SessionStart's command with a self-contained launcher using Node, already required by this repository. It looks up Entire with where.exe, emits the installation message with JSON.stringify when missing, and delegates the fixed literal entire hooks codex session-start command with inherited input/output. It reports process errors and nonzero child results rather than claiming success. No session-derived text enters the shell command, no package/dependency/model setting changes, and the existing timeout is preserved. Other six Codex hooks remain unchanged.
- Add .entire/README.md to document the existing Node prerequisite, the workaround, scope of execution tests and local approval/capture boundaries. Entire 0.12.2's doctor/status template recognition now flags the custom SessionStart as missing/out of date; this is explicitly retained as a known diagnostic limitation. Do not suppress it or claim a drift-free installation. Regenerating the current CLI template reintroduces the PowerShell failure, so review and test future generated commands before replacing the workaround.
- The open-task review was performed against 3b35deb before the SDK/guide work. Its present-tense opportunity bullets became misleading when published after PR 23 merged. Preserve the dated snapshot and original estimates, but identify the guide correction and all 20 SDK conformance cases as completed by d9c6068/PR 23 on current base d0885df. Update the summary/estimate framing so those two slices cannot be mistaken for remaining work. Do not delete the permanent record or claim broader Q04 completion.
- Clarify that the earlier qualification record's drift-free doctor result describes candidate d94878a, before this execution correction. The current override, diagnostic warning and fixture evidence are recorded here; local Codex trust must still be reviewed through its supported interface. No trust entries, reviewer gates or account settings are forged or changed.
- Compatibility and migration: internal developer hook/configuration and documentation corrections only, with no PlayWeld runtime/API/schema/storage migration or new dependency. The launcher uses the existing Node 24+ prerequisite; it must be available in Codex's environment. Keep product version 0.23.0 and impact none because no shipped application behavior changes. No ordinary session, paid inference, engine operation or hosted session upload is performed for the hook fixtures.

##### Validation

- Read the installed codex-cli 0.163.0 identity and its [versioned Windows command runner](https://github.com/openai/codex/blob/rust-v0.163.0/codex-rs/hooks/src/engine/command_runner.rs). Local installed files did not include the Rust runner source, so the official tagged source supplies the configured-shell/cmd-fallback reference.
- An isolated fixture reproduced four original-command PowerShell parser failures; the original cmd fallback cases passed. The naive wrapper and a bounded quote comparison did not satisfy all branches across all shells. The final actual configured launcher passed 12 cases: present CLI, missing CLI with valid systemMessage JSON, and child failure, each through PowerShell 5.1, PowerShell 7, the cmd fallback shape and direct Node. The launcher/cmd boundary preserved child exit 7; PowerShell mapped it to nonzero 1, so neither path appeared successful. Fixtures used a copied existing Node executable as a native shim, without compiling an executable or accessing real transcripts/providers.
- The actual configured launcher also delivered a synthetic SessionStart payload to real Entire 0.12.2 in a disposable Git repository with telemetry disabled and no remote. The CLI exited zero and emitted its conversation-link/approval guidance. This proves local event dispatch, not a trusted new Codex conversation or end-to-end transcript capture. Ordinary repository approval records were not edited. Fixture scripts/reports remain ignored under .turbo/.
- Fresh entire doctor/status still validate Git hooks, report existing approval records, and report the documented SessionStart template-recognition warning. No legacy shadow branches or stuck sessions were reported in the ordinary repository. This warning is not recast as a passing template check.
- Compared the two updated opportunity bullets with current main's guide and SDK tests. The corrected local full gate passed all 33 tasks from cache in 278 ms, replaying the existing 1,043 passes/nine skips; no fresh application execution is implied. Repository-wide formatting passed. The complete local equivalent link check, including the new .entire README beyond the canonical script's usual scope, found zero failures across 387 Markdown files and 1,639 relative links. Bounded privacy screening, regenerated changelog/base coverage and focused formatting/diff checks are refreshed before commit.
- Final-head hosted review/CI and Entire Trail reviewer approval remain subsequent gates. Earlier-head hosted checks cannot qualify the corrected head. The initial Entire agent review reported no blocking findings, but its reviewer-approval requirement is distinct from local Codex hook trust; no gate or approval is bypassed.

##### Files

- `.codex/hooks.json`
- `.entire/README.md`
- `docs/changes/2026-10-26-open-task-opportunity-review.md`
- `docs/changes/2026-10-26-entire-pr-qualification.md`
- `docs/changes/2026-10-26-entire-pr-review-corrections.md`

#### Make filesystem audit verification deterministic with background indexing

**Impact:** none

[Permanent work record](docs/changes/2026-10-26-tool-audit-indexing-interleaving.md).

##### Summary

Correct the tool-broker integration test's assumption that a newly created Project has no background tool calls. Verify the two filesystem audit records independently of the real startup Knowledge indexing call.

##### Details

- PR 24's corrected-head Windows quality job failed at the filesystem audit test: the Project audit contained three rows instead of two. Project creation schedules a Knowledge reindex task, whose worker calls knowledge/index-execute through the same broker. A slower run can record that legitimate third call before the assertion. Linux and isolated local runs passed when indexing had not yet entered the audit; those passes did not establish deterministic behavior.
- Make the regression exercise this interleaving explicitly: find the startup knowledge.reindex task, wait for its successful completion using the existing task-state helper, and require its completed knowledge/index-execute audit row. Select the filesystem read/write records and still require exactly two rows, the exact returned write/read call IDs, and completed/allowed status. Duplicate, missing, denied or incomplete filesystem calls still fail. Remove temporary whole-row diagnostics after confirming the extra row's identity; do not weaken assertions or raise timeouts.
- Compatibility and migration: test-only correction, no production code, dependency, RPC, database or configuration changes; no migration required. Keep version 0.23.0 and impact none because no shipped application behavior changes.

##### Validation

- Hosted Windows job 122012840589 on candidate 4e2bcda failed with one audit-count assertion (785 passed, ten skipped, one failed in platform-service). Linux's fresh full quality run and browser acceptance passed on that same candidate, but the candidate was not merged.
- Initial sandboxed local reproduction stopped at Git initialization permissions, before the assertion; rerunning outside that sandbox passed the isolated case. The entire unmodified-assertion integration file also passed all 17 cases. Adding an explicit wait for the real startup indexing task reproduced the exact three-versus-two failure locally and identified knowledge/index-execute as the third row.
- After correcting the audit assertions, the full tool-broker integration file passed all 17 tests in 19.51 seconds. The required local full quality gate passed all 33 tasks in 8 minutes 21 seconds, with 22 cached tasks and 11 executed; platform-service tests executed freshly. Existing Theia installer-handoff bundler warnings remained nonfatal. Repository-wide formatting, branch-base change-record coverage and diff checks passed. The local equivalent link check found zero failures across 389 Markdown files and 1,641 relative links. Final-head hosted CI and review remain required; earlier-head passes do not qualify subsequent source changes. No live engine/provider, desktop packaging or end-to-end trusted Entire capture is claimed.

##### Files

- `packages/platform-service/src/tools/tool-broker.integration.test.ts`
- `docs/changes/2026-10-26-tool-audit-indexing-interleaving.md`

### Documentation

#### Correct stale plugin isolation and generation evidence guidance

**Impact:** none

[Permanent work record](docs/changes/2026-10-26-integration-evidence-corrections.md).

##### Summary

Replace two stale blanket unverified claims in the integration guide with dated, scoped evidence links for Windows plugin workers and one Meshy generation/import workflow.

##### Details

- The executable-plugin section previously described Windows AppContainer as unverified/fail-closed even though the 2026-10-06 editor-bridge acceptance records LPAC/Job filesystem/network denial checks under Node and Electron Node mode and shared Node/Python lifecycle checks. Link the existing acceptance section and retain explicit limits for broader process tests, allowed outbound networking, host allowlists and alternate Windows versions. Unavailable isolation continues to fail closed; signatures and additional hardening remain open.
- The generation-provider section previously said paid live generation remained unverified. Link the 2026-10-06 adversarial review's single meshy-6-lite preview, download/hash/GLB checks, review-gated and exact-byte isolated import. Name the five-credit geometry scope and retain unverified production-art, image-to-3D, refine, Tripo and broader provider paths. State the existing explicit session-authorization requirement for paid calls.
- Refresh the guide's update date to 2026-10-26 while retaining the acceptance dates in each corrected paragraph. This reconciles contributor guidance with already recorded acceptance; it does not rerun those operations, promote their dates to current qualification, approve further paid calls or mark a work package complete. Historical acceptance records remain unchanged.
- Compatibility and migration: documentation only, no application, API/schema, database, dependency or version change and no migration required. Impact none because this corrects evidence wording without changing behavior.

##### Validation

- Compared both guide paragraphs with docs/EDITOR_BRIDGE_ACCEPTANCE.md and docs/ADVERSARIAL_SYSTEM_REVIEW.md on current main and verified the exact Windows isolation heading used by the new relative anchor.
- npm run format:check passed repository-wide. The complete scripts/check-links.sh ran through Ubuntu/WSL and returned All links OK with exit code zero. npm run changelog:update and npm run changelog:check -- --base 3b35deb50ffd5c08c2a8dbaa6426983d81d3dd30 passed, as did git diff --check. node scripts/check-documentation-evidence.cjs passed its inventory/report/file-integrity checks, and node scripts/generate-system-reference.cjs --check confirmed 204 request and 88 setting references. Final validation-text/date edits do not change link targets; the generated record projection is refreshed before handoff.
- The SDK/full-gate results are recorded separately in the conformance task. No new plugin-isolation execution, generation, provider call, renderer/installer drill or release publication was performed for this documentation correction.

##### Files

- `docs/INTEGRATION_GUIDE.md`
- `docs/changes/2026-10-26-integration-evidence-corrections.md`

### Maintenance

#### Populate the PlayWeld Features GitHub Project inventory

**Impact:** none

[Permanent work record](docs/changes/2026-10-25-features-project-inventory.md).

##### Summary

Populated the user-created [PlayWeld Features Project](https://github.com/users/scarecr0w12/projects/5) with 58 evidence-bounded feature/function cards: 27 Done, two In progress, 22 To do and seven Requested. Created 57 Project drafts and reused the existing Windows uninstall/rollback issue. The Project remains private and no v1.0 scope is accepted by this inventory.

##### Details

- The user selected PlayWeld Features to track implemented, partially completed, remaining and requested functionality. After an initial missing-scope failure and expired device authorization, the user refreshed GitHub CLI permissions. Confirmed the exact owner, Project title, URL and ID before mutation; no credentials or device codes are retained in this record.
- Read the authoritative development plan, implementation status, confirmed requirements and open decision register. Created 57 descriptive Project drafts rather than opening 57 repository issues. Reused the sole preexisting Project item, [issue #3](https://github.com/scarecr0w12/PlayWeld/issues/3), retaining its issue body and setting its Project status to To do. Verified the final inventory has one matching card for each prepared title and no duplicate of that issue.
- Extended the existing Status field with To do and Requested while preserving the IDs, names, descriptions and colors of Backlog, Ready, In progress, In review and Done. Added Area as a single-select field and Reference as a text field; all 58 cards have the intended status, area and work-package/decision references. Existing priority, size, iteration, date and other fields were preserved; no priorities, estimates, iterations or release commitments were invented.
- Done cards cover independent Projects, desktop shell, settings, durable tasks, grouped requests, broker permissions, audit/export/cleanup, provider accounts, model routing/capacities, chat, optional decision assistance, skills/roles, MCP, discussion/decisions, plugins, engine operations and managed bridges, Knowledge/search/storage, generation/import, asset viewers, DCC, local backups/restore, Swarm/worktrees, external IDE integration, A2A and documentation. Their bodies distinguish repository implementation, fixture testing and selected live acceptance rather than implying exhaustive release readiness.
- In-progress cards distinguish WP19 packaging/release lifecycle from Q04 plugin SDK conformance/migration guidance. To do cards cover release trust/lifecycle, support and UI/accessibility/performance qualification, current full-gate evidence, plugin signatures/isolation, model-provider and judgment qualification, spending behavior, community MCP/A2A, wider engine/DCC/provider checks, asset inspection/conversion, remote backup/recovery, external action recovery, canon diffs, remote vector/plugin acceptance and remaining ledger/corruption handling.
- Requested cards represent existing unresolved product choices: existing-game onboarding, navigation/create/clone experience, creative feedback/progress, canon/module/genre semantics, cross-Project privacy, editor-extension privileges and optional in-place restore. They explicitly remain proposals or unresolved choices, not newly accepted requirements or automatic v1.0 scope. Existing implemented portions are described separately.
- Linked the Project to scarecr0w12/PlayWeld. Initialized its previously empty description and README with inventory purpose, status meanings, Area/Reference usage, source links, evidence boundaries and draft-to-issue guidance. The Project remains private. The development plan remains the owner of dependency ordering; no work-package status or user-confirmed design decision was changed.
- Temporary import data, resume-aware synchronization script and before/after receipts remain ignored under .turbo/feature-project-sync/. They are local execution artifacts, not a second committed feature register. The GitHub Project is the requested feature tracker; repository status/plan/register remain the sources for the initial inventory's implementation claims.
- Compatibility and migration: repository/provider maintenance only; no application, API, database, package-version or runtime migration. Version impact none because the change organizes existing work and requests without shipping application behavior. No commit, release, engine mutation, paid generation or ordinary-profile change was performed.

##### Validation

- gh project list/view/field-list/item-list confirmed Project #5, exact title PlayWeld Features, private visibility, the existing five Status options and the sole preexisting issue #3. Inspected GitHub's live single-select input contract before updating options so original option IDs were retained.
- Parsed the staged JSON and verified 58 input entries. Synchronization completed with 57 created drafts and one reused issue; read back all 58 cards and checked exact title uniqueness, status, area and reference against every input row. The receipt reports zero mismatches and status counts of 27 Done, two In progress, 22 To do and seven Requested.
- gh project link 5 --owner scarecr0w12 --repo scarecr0w12/PlayWeld succeeded. Project README/description initialization succeeded. No new repository issues were opened.
- git check-ignore confirmed the temporary inventory is ignored. Work-record Prettier formatting, npm run changelog:update, npm run changelog:check -- --base HEAD and git diff --check passed after the publication record was updated. Final Project metadata readback confirmed 58 items, 21 fields and unchanged private visibility; field readback confirmed all five original Status option IDs were preserved.
- Documentation link checking was launched through the default bash runner during preparation, but its process result was unavailable after resumption. Restarted the required scripts/check-links.sh through explicit Git Bash with captured output/exit files; result remains pending at this record update and is not claimed as passing.
- Source builds, application tests, live provider/engine calls, paid generation, installer operations and release publication were skipped because this changes feature tracking and its permanent record, not application behavior. Implementation claims come from the cited existing records rather than new runtime qualification.

##### Files

- `docs/changes/2026-10-25-features-project-inventory.md`

#### Prioritize, estimate and publish PlayWeld Features

**Impact:** none

[Permanent work record](docs/changes/2026-10-25-features-project-prioritization.md).

##### Summary

Individually assessed all 31 open cards in the [PlayWeld Features Project](https://github.com/users/scarecr0w12/projects/5), assigned development priority/size/effort and detailed implementation or qualification criteria, and made the Project public at the user's explicit request. All 58 cards remain present; the 27 Done cards retain their existing content and evidence limits.

##### Details

- The previous inventory provided status, area, reference and short functional descriptions but left development priority, size and detailed execution criteria unset. The user explicitly requested card-by-card prioritization, sizing, additional detail and public visibility. Read back the exact Project and all existing items/fields before mutation; preserved existing Status, Area, Reference, title, assignment, iteration and date choices.
- Assessed all 31 open cards independently against the repository's current plan, implementation/evidence boundaries and unresolved product choices. Assigned 14 P0, eleven P1 and six P2 priorities. P0 means a recommended release-safety, trust, data/recovery or evidence gate for capabilities actually promised in 1.0; P1 means important core workflow/support/product decisions; P2 means optional integration/feature breadth. These are engineering recommendations, not a newly accepted v1.0 feature list or claims that every P0 represents an exploitable defect.
- Assigned five Medium, thirteen Large and thirteen Extra Large development sizes using the existing Size field. Populated the existing numeric Estimate field with relative points: XS=1, S=2, M=3, L=5, XL=8. Added a separate Effort text field: XS up to one engineer workday, S one to two, M three to five, L six to ten, XL eleven to twenty-plus with required decomposition before implementation. All estimates are coarse planning ranges, include focused implementation/tests/evidence, exclude external waits/procurement/authorization and are not calendar commitments.
- Added Work type, V1.0 relevance, Risk and Confidence single-select fields. The 31 assessments comprise six Hardening, four Feature, twelve Verification, eight Decision and one Maintenance cards; relevance is twelve recommended Release gate, seven Core candidate, six Optional candidate and six Decision needed. Risk describes delivery/data/trust consequence rather than a validated vulnerability severity. Confidence describes estimate uncertainty, not implementation or release readiness. No assignees, deadlines, iterations or automatic execution were selected.
- Added a distinct Development assessment section to every open card, retaining its original description/source/evidence text. Each section includes priority rationale, size/relative points/rough effort, work type, release relevance, risk, confidence, proposed scope, four card-specific acceptance criteria, prerequisites/related work, assumptions, exclusions and overlap warnings. Updated thirty Project drafts and appended the assessment to the existing [Windows uninstall/rollback issue #3](https://github.com/scarecr0w12/PlayWeld/issues/3), retaining its original scope and acceptance text rather than replacing or duplicating the issue.
- Recommended release gates emphasize trustworthy packaging/signing, scoped Windows/Linux lifecycle, support/evidence definition, core UI/accessibility, current-candidate quality evidence, truthful plugin trust/isolation, spending ceilings, external-effect recovery, non-destructive corruption handling, cross-Project privacy and editor-extension privilege clarity. Linux qualification is conditional on advertised targets. Isolation layering/host allowlists and extended ledger cleanup are explicitly separable from the necessary safe baseline.
- Core candidates cover SDK conformance, measured performance, provider/decision qualification, community MCP, selected engine coverage, remote backup, canon reconciliation, existing-game onboarding, navigation/creation, creative feedback and canon/module semantics. Optional candidates cover live A2A, commercial DCC breadth, additional paid generation, richer asset inspection/conversion, remote/plugin vector stores and in-place restore. Provider/engine/DCC/storage matrices, umbrella cards and shared recovery work contain overlap/decomposition notes; they must not be summed blindly into a release date. In-place restore explicitly distinguishes an XS decide/defer action from XL conditional implementation.
- Retained all seven Requested statuses and their product-owned decisions. Prioritization does not approve those requests or reopen already confirmed module-preservation requirements. Prerequisites identify planning constraints/related work rather than introducing a second authoritative execution order; technical dependency ordering remains in the existing development plan.
- Extended the Project README with priority definitions, the size/point/effort table, field meanings, estimate limitations, optional/conditional release scope and the absence of new execution commitments. Preserved its existing purpose/status/source guidance. Screened all 58 existing card bodies/titles and the final README for recognizable credential/private-key, embedded credential URL and personal filesystem-path patterns, and reviewed the authored assessment text for public suitability. This bounded content review is not a whole-repository secret scan.
- Changed Project visibility from private to public only after every card's detailed content and eight planning field values passed authoritative readback. Read back public=true and the exact final README. The user's explicit instruction authorized this publication; no repository visibility, code, releases, credentials, runtime profiles, engine/DCC state or paid services were changed.
- Compatibility and migration: repository/provider planning maintenance only; no application, RPC/schema, database, package-version or runtime migration. Existing Project statuses and the 27 Done descriptions remain intact. No new issues/cards were created. Version impact none because this publishes engineering planning and requests without shipping application behavior. Temporary preparation/update scripts and before/after receipts remain ignored local execution artifacts under .turbo/feature-project-sync/, not a competing feature register.

##### Validation

- Read all 58 Project items and existing fields through the GitHub CLI/GraphQL API. Checked that the plan covered exactly the 31 non-Done titles once, every size was defined, every card had scope/prerequisites and each had four acceptance criteria. Source/temporary scripts passed node --check; a helper summary command with an extra closing parenthesis was corrected before the successful completeness/count output. No application test failure was involved.
- The update receipt records all 31 assessments, priority counts 14/11/6 and size counts M=5, L=13, XL=13. Authoritative readback compared every assessed body and Priority, Size, Estimate, Work type, V1.0 relevance, Risk, Confidence and Effort value: zero mismatches. Also verified unchanged Status/Area/Reference for all 58 items and unchanged title/body for all 27 Done items.
- Final Project readback confirmed 58 items, public=true and the exact updated README. An unauthenticated HTTP request to the Project URL returned 200 and contained the PlayWeld Features title. Credential/private-path pattern screening returned no matches for the reviewed cards/README; original issue #3 content was preserved with an appended assessment.
- npm run changelog:update, npm run changelog:check -- --base HEAD, Prettier checks for both feature work records and CHANGELOG.md, and git diff --check passed. Ran the complete scripts/check-links.sh through the installed Ubuntu environment after the native Git Bash run proved slow; it returned All links OK with exit code zero. No documentation targets changed during the final validation-text update.
- Application builds/tests, new live integrations, installer drills, paid generation and release publication were skipped because this task changes planning and public Project content only. Existing implementation/live evidence was not rerun, and effort estimates remain evidence-bounded recommendations.

##### Files

- `docs/changes/2026-10-25-features-project-prioritization.md`

#### Publish Entire Brain agent guidance and Claude edit hook

**Impact:** none

[Permanent work record](docs/changes/2026-10-26-entire-brain-agent-setup.md).

##### Summary

Include the locally added Entire Brain guidance and Claude integration in PR 24 at the user's request. Local Brain setup remains pending because its plugin is not installed.

##### Details

- Preserve the added Entire-managed block in AGENTS.md and the new CLAUDE.md: both point agents to .entire/agent-guide.md. The guide describes Brain brief/recall retrieval, source inspection, provenance and current-source verification; retrieved content is untrusted data. It also describes optional durable-memory commands, which remain subject to session authorization and privacy constraints.
- Preserve the supplied .claude/settings.json PreToolUse hook for Edit, Write, MultiEdit and NotebookEdit. Its Windows cmd command tries entire-brain hook pre-edit, then entire brain hook pre-edit, with the Claude-hook flag. The final exit /b 0 intentionally permits the edit if neither command works; it is advisory context integration, not an enforced validation or security gate.
- These files appeared while the PR's checks were running and were reviewed before inclusion. The user explicitly requested inclusion with pending-local-setup documentation. Do not install a plugin, change account/provider settings or write durable Brain memories as part of publication.
- Compatibility and migration: agent documentation and developer hook configuration only; no PlayWeld runtime, dependency, RPC, schema or storage changes, and no migration required. Keep product version 0.23.0 and impact none. The supplied hook assumes Windows cmd and Entire command availability; other developer operating systems require their supported local setup.

##### Validation

- Read all four supplied files. Running entire brain brief with the PR qualification task and --json exited one with the explicit message that the entire-brain plugin is not installed. Brain retrieval therefore fell back to direct repository evidence for this query, as the guide prescribes. No install or memory write was attempted.
- Claude hook JSON parsing, repository-wide formatting and branch-base work-record coverage passed. The complete local equivalent link check passed across 389 Markdown files and 1,641 relative links; the new standalone guide/Claude pointer contain no Markdown link targets. Bounded credential-pattern screening of all 18 proposed paths found zero matches. Formatting normalized the supplied Markdown without changing the commands. No fresh Claude session, effective hook dispatch, Brain retrieval/index freshness or pre-edit context injection has been verified. Static hook inspection does not establish runtime connectivity.

##### Files

- `AGENTS.md`
- `CLAUDE.md`
- `.entire/agent-guide.md`
- `.claude/settings.json`
- `docs/changes/2026-10-26-entire-brain-agent-setup.md`

#### Verify and publish the user-added Entire configuration

**Impact:** none

[Permanent work record](docs/changes/2026-10-26-entire-integration-publication.md).

##### Summary

Verify the user-added Entire repository configuration and newly installed Windows CLI, refresh its Codex hooks, and prepare all pending repository changes for GitHub publication on codex/security-review-remediation. Installed/enabled status is verified; actual captured-session and hosted Entire acceptance remain separate.

##### Details

- The user's existing commit 0105137 (Enable Entire) adds .entire/settings.json, .entire/.gitignore and .codex/hooks.json. Preserve that commit and its settings: enabled true, telemetry true and primary checkpoint storage git-refs. No credentials, account configuration, model/provider selection or telemetry preferences are changed by this task.
- The Codex configuration registers PostToolUse, SessionEnd, SessionStart, Stop, SubagentStart, SubagentStop and UserPromptSubmit command hooks. Each delegates to an Entire Codex hook when the executable is available; SessionStart provides installation guidance if it is missing. Local Git metadata contains prepare-commit-msg, commit-msg, post-commit, post-rewrite and pre-push hook scripts. Those Git hooks are machine-local metadata, not committed source paths. After installation, Entire doctor identified stale commands; its supported entire agent add codex operation regenerated all seven shared commands from Unix sh wrappers to native Windows cmd/where wrappers while preserving the 30-second timeouts and three-second SessionEnd timeout. The resulting configuration matches Entire 0.12.2. Other operating systems should refresh managed hooks with their installed CLI rather than assume these native Windows commands are portable.
- Inspected the integration against [Entire CLI documentation](https://docs.entire.com/platforms/cli-and-entire-com), [installation guidance](https://docs.entire.com/installation) and [storage/security boundaries](https://docs.entire.com/security). Shared configuration alone does not establish a working executable, hook discovery in an already-running Codex session, captured checkpoints or hosted Entire account/mirror access.
- Initial inspection could not discover Entire through Windows process/persisted PATH entries, the documented Windows install locations checked, non-login Git Bash or Ubuntu/WSL. The user then installed the Windows CLI. Verified Entire 0.12.2, Go 1.27.3, windows/amd64 and successful Git Bash discovery; normal host-access status reports Enabled, Agents Codex and checkpoint sync to origin. No installer, shell-profile rewrite, account login, global configuration or PATH change was performed by this task.
- Initial sandboxed diagnostics could not read protected .codex/Git paths; the normal host-access retry distinguished this sandbox failure from actual hook state. Before refresh, host diagnostics reported installed Git/Codex hooks and existing approval records, plus stale Codex commands. After refresh, Git/Codex hooks validate without drift, but approval-record inspection reports UNKNOWN and asks for /hooks review inside Codex. Do not forge trust entries or equate installed configuration with an active approved capture session; review active hooks in Codex and verify a fresh session/checkpoint separately.
- .entire/.gitignore excludes tmp, settings.local.json, metadata, logs and local redactors. Diagnostic log contents and personal configuration are excluded from publication. No refs/entire checkpoint refs or local Entire shadow branches were present during inspection, so no transcript/checkpoint payload is included by this publication. Normal branch push semantics are retained; no all-refs/mirror/force push is used.
- The user explicitly requests pushing all changes. Include the existing pending feature-inventory, prioritization and open-task review records, retaining their dated observations and validation boundaries, and regenerate their complete changelog projection together with this integration record. These earlier planning records are separate tasks, not new implementation or new board mutations by this publication.
- Publish from the user's current codex/security-review-remediation branch. Its prior security work already exists on current main, but the checkout predates later release and SDK integration. Publishing the branch does not replace main, undo its 0.23.0 changes or merge a new feature. Preserve all other branches/worktrees and private ignored configuration.
- Compatibility and migration: development-tool configuration and documentation only; no PlayWeld runtime/API/schema/database/dependency changes or migration required. Keep the current checkout's product version. Impact none; no new installer, tag, public release or product readiness claim is introduced.

##### Validation

- Inspected git status, the user-added commit and exact added paths, shared JSON settings, Codex command hooks, local Git hook scripts, ignore rules, unpublished branch history and ref names. Read back official Entire documentation. Initial shell checks reported the executable unavailable; after the user installation, entire version and normal host-access status/doctor verified the native CLI and detected the stale commands. entire agent add codex refreshed them; follow-up doctor/status confirmed installed hooks without drift, with the explicit approval-inspection limit above.
- Static JSON/settings and seven-event hook checks passed. Before native refresh, syntax checks passed for all seven original shell commands and all five local Git scripts; the refreshed native commands are validated by Entire's own drift check rather than executed with fabricated session payloads. Ignore checks confirmed local settings, logs, metadata, temporary data, local redactors and private Kilo overrides remain excluded. Bounded screening of the three shared configuration files and four pending records found zero matches for the checked credential/private-key/credential-URL patterns; this is not a whole-history secret audit.
- Repository-wide npm run format:check passed; focused formatting checks also passed for the refreshed configuration, all four pending records and CHANGELOG.md. npm run changelog:update, npm run changelog:check -- --base 8d2cd9e and git diff --check passed. The explicit base covers the user's original Entire commit as well as the pending publication, rather than checking only the follow-up commit.
- The WSL link-check request was declined. The separately approved native Git Bash scripts/check-links.sh run remained unusually slow and did not produce a completion result; it is not claimed as passing. A disposable read-only Node equivalent of the existing script's file, fence, link and heading rules completed across all 370 Markdown files and 1,563 relative links with zero failures. After that complete check, stopped only the two verified parent/child Bash processes for the owned slow run. Its runner/report remain ignored under .turbo/; no repository checker or tracking tool was changed.
- Publication is verified by comparing the pushed branch commit with GitHub after the commit/push. Actual captured-session upload, active Codex trust state, hosted Entire account/mirror access and GitHub main integration remain separate from this branch publication.
- Application builds/full Turbo tests, paid/provider/engine operations, Entire installation/login by the agent, captured-session replay and hosted Entire mirror access are skipped because this task verifies configuration and publishes planning records without application-source changes. Working capture, active Codex hook approval and hosted Entire access are not inferred from version/status or shared hook installation.

##### Files

- `.codex/hooks.json`
- `.entire/.gitignore`
- `.entire/settings.json`
- `docs/changes/2026-10-26-entire-integration-publication.md`

#### Qualify the Entire integration and pending records for main

**Impact:** none

[Permanent work record](docs/changes/2026-10-26-entire-pr-qualification.md).

##### Summary

Prepare the published Entire integration and pending planning/review records for a pull request against current main, preserving its 0.23.0 release history and SDK conformance work.

##### Details

- The user explicitly requests opening a PR, checking hosted results and reviewer feedback, fixing issues and merging once all checks pass. The published source branch is codex/security-review-remediation at 735481da1ecc6301503aaf5710bbebcd5fc68a76, including the original Enable Entire commit 0105137 and the native-hook refresh plus pending records.
- Main advanced to d0885df2e5a758273c14f5c441f855c11fc7a894 while this branch retained an older security-review base. Integrate main through a normal merge without rebasing or force-pushing. Inspect the generated CHANGELOG.md conflict and regenerate from the combined permanent records so the Entire/planning records remain Unreleased, the earlier release assignments remain intact and the SDK records are retained. No application-source or hook-content conflict requires synthesis.
- The initial PR candidate adds shared Entire settings/ignore rules, seven CLI-generated native Windows Codex hooks, the existing feature inventory/prioritization and open-task review records, the Entire publication record, this qualification record and their complete generated changelog entries. The later review correction replaces the broken generated SessionStart with the documented executable launcher; the other six generated commands are preserved. The PR inherits current main's 0.23.0 application/package/lockfile versions without preparing another release or reverting prior work.
- Preserve local Entire settings, logs, metadata, temporary data, local redactors and private Kilo overrides as ignored machine state. Inspect checkpoint ref names before publication; do not upload raw shadow branches or introduce a mirror/all-refs push. Existing installed-hook status does not prove active Codex approval, captured sessions or hosted Entire access. Do not forge local trust entries or change account/telemetry/provider settings as a substitute for verification.
- Open the PR after the combined candidate is locally verified so its initial hosted run and review cover the integrated head. Inspect final-head check-run identities, CI jobs/logs, reviewer summaries, review submissions and unresolved inline threads. Superseded, cancelled or earlier-head results do not establish merge clearance. Merge through GitHub with an expected-head SHA and verify the resulting commit on remote main; final hosted/merge receipts are reported in the PR and task handoff.
- Compatibility and migration: development-tool configuration, records and branch integration only. No additional PlayWeld runtime/API/schema/storage/dependency changes or migration required. Keep the inherited 0.23.0 version; no new tag, installer, paid call, engine mutation, signing or installed-product acceptance is introduced. Other branches/worktrees remain untouched.

##### Validation

- Inspected current branch/status, published commits, exact proposed paths, incoming main history and the generated conflict's base/ours/theirs context. The only unmerged file was CHANGELOG.md. Regeneration preserved the combined records and removed its conflict markers. npm ls -w @gamecrafter/plugin-sdk --depth=0 confirms the inherited 0.23.0 workspace links resolve against the pinned installed dependencies.
- Integrated npx turbo run build typecheck lint test --concurrency=1 completed all 33 tasks successfully in 5.895 seconds, with all 33 results replayed from cache. The replayed workspace totals are 1,043 passed/nine skipped, including 788 platform-service passes/eight skips and all 20 SDK cases. This is cached source/build evidence, not a newly executed application suite; final hosted jobs must qualify the actual PR head independently. The existing nonfatal require.resolve bundling warning remains.
- On initial candidate d94878a, fresh normal-host entire doctor and entire status checks confirmed installed Git/Codex hooks without drift, Codex hook approval records PRESENT, no legacy shadow branches/stuck sessions, and Enabled/Codex/checkpoint sync to origin. This describes the pre-review CLI-template check only: the later [review correction](docs/changes/2026-10-26-entire-pr-review-corrections.md) records the SessionStart execution fix and its explicit template-recognition warning. Approval-record observations do not prove captured-session or hosted Entire acceptance. No trust entries were forged or machine settings changed.
- On initial candidate d94878a, static JSON/settings/seven-event native-hook checks passed. Bounded credential/private-key/credential-URL screening of its nine proposed paths found zero matches. Ignore checks confirmed private local files remained excluded; no checkpoint/shadow refs were present. That candidate's complete local read-only equivalent link check covered 385 Markdown files and 1,635 relative links with zero failures. The separate correction record supplies the later executable-launcher evidence and current checks. Hosted Linux runs the repository's canonical scripts/check-links.sh; the earlier slow native run is not reclassified as a pass.
- Repository-wide formatting, 0.23.0 version agreement, generated RPC/settings and documentation inventory freshness, documentation evidence integrity, changelog coverage against main d0885df and diff checks passed. Final evidence-text edits only affect this record and the regenerated changelog, with focused formatting/tracking/diff checks refreshed before commit.
- Hosted checks, reviewer feedback and the guarded merge are subsequent gates, not claimed by this pre-PR record. The final PR description and handoff retain final-head hosted/merge receipts; superseded or cancelled results remain insufficient for merge clearance.

##### Files

- `docs/changes/2026-10-26-entire-pr-qualification.md`

#### Review open PlayWeld tasks for small achievable slices

**Impact:** none

[Permanent work record](docs/changes/2026-10-26-open-task-opportunity-review.md).

##### Summary

Reviewed all 65 cards in the [PlayWeld Features Project](https://github.com/users/scarecr0w12/projects/5) against repository evidence and the then-current merged source at 3b35deb. Identified small, reviewable slices within larger open cards without changing Project fields or accepting Requested features. The guide correction and SDK conformance slices were subsequently completed in [PR 23](https://github.com/scarecr0w12/PlayWeld/pull/23); their original assessments below are marked historical rather than presented as remaining work.

##### Details

- Live Project readback on 2026-10-26 contains 27 Done, 21 To do, three In progress and 14 Requested cards: 38 open in total. This supersedes the earlier 58-card inventory only as a dated observation; permanent historical records remain intact. Existing estimates apply to umbrella cards and should not be mistaken for estimates of the smaller opportunities below.
- The working checkout is `codex/security-review-remediation` at `8d2cd9e`, with preexisting pending feature-inventory/prioritization records and generated changelog edits. Fetched `origin/main` and verified its tip as `3b35deb50ffd5c08c2a8dbaa6426983d81d3dd30`; did not switch, merge or reset the working checkout. Compared candidate SDK, viewer, guide and recovery surfaces against that ref so an older checkout would not turn completed work into a new task.
- The recovery umbrella already records merged SQLite diagnostics, bounded Knowledge lexical-index recovery and Project pre-migration snapshots through PRs 17, 18 and 19. Keep that umbrella In progress for its documented remaining work. General salvage, other derived stores, whole-upgrade rollback and extended ledger cleanup need separate scope; repeating the merged slices is not an easy win.
- Historical documentation opportunity, now completed in PR 23: at the 3b35deb review snapshot, `docs/INTEGRATION_GUIDE.md` still described Windows AppContainer and paid generation as unverified despite scoped LPAC/Job and Meshy evidence in the acceptance records. Current main at d0885df already contains the dated evidence links and limits added by d9c6068. Do not schedule this correction again. The original half-day estimate describes the earlier bounded proposal, not remaining work; broader isolation/provider/production-art qualification stays separate.
- Historical Q04 test opportunity, now completed in PR 23: the 3b35deb snapshot had one broad SDK success-path test. Current main at d0885df contains all 20 SDK cases from d9c6068, including protocol/initialization rejection, failed initial settings, unknown method/tool, invalid context, access-mode forwarding, handler errors and subsequent request recovery. The earlier one-to-two-day estimate is historical; do not repeat this conformance slice. Broader community conformance and migration acceptance remains open.
- Concrete Q01 opportunity: reconcile a small evidence inventory from existing acceptance records, including exact versions, operation, date, source/fixture/live/installed level and missing qualification. Extend the existing documentation coverage surface rather than inventing a second feature register. This can prepare the support-matrix decision; advertised v1.0 support remains product-owned and the whole card cannot close from documentation alone. Rough focused effort: one engineer workday for a bounded initial inventory, excluding rerunning integrations.
- Concrete WP15/U05 feature opportunity: `packages/theia-control-room/src/browser/asset-viewer/image-viewer.tsx` currently provides fit, 1:1, dimensions, zoom and pan through an image element. A proposed raster RGB/R/G/B/alpha display slice can be assessed independently from DCC conversion and material-slot association. Acceptance should use known pixels, preserve source bytes, handle unsupported/decode failures explicitly and retain existing viewing controls. No decoder/converter dependency is selected by this review. Rough focused effort: two to three engineer workdays including focused rendered verification; this is a proposed subset, not completion of the texture/conversion umbrella.
- Q01 timing work can begin with bounded current-head reproduction and comparison with the latest hosted results. The card itself says historical failures may no longer reproduce; do not raise timeouts, weaken assertions or assume a defect remains. A half-to-one-day investigation is a useful bounded start, but resolution and complete qualification remain uncertain and are not estimated as an easy completion.
- The estimates above are the original snapshot's planning judgments for narrow slices, not commitments or a new dependency order. The two explicitly completed PR 23 slices are historical; the other entries remain proposals or investigation candidates. Signing/procurement, disposable installer lifecycle, external/paid integration matrices, spending policy, team identities and general recovery have broader prerequisites. Requested collaboration, handoffs, delegation-board, shared-memory, validation-profile, LFS-preflight and image-chat ideas remain Requested and require their own scope/decisions.
- Compatibility and migration: investigation and work-record changes only; no application, API/schema, database, dependency or product-version changes and no migration required. Version impact none. No Project status/priority/estimate, repository issue, release, ordinary runtime profile, engine/DCC state or paid service was changed. Existing pending work records were preserved; the generated changelog includes this additional record.

##### Validation

- `gh project item-list 5 --owner scarecr0w12 --limit 100 --format json` succeeded; inspected all 38 non-Done card titles/statuses and the detailed bodies for the candidate support, SDK, preview, timing and recovery cards. Counted all 65 items by Status from the live JSON. GitHub CLI was used because the available GitHub connector does not expose Projects item operations.
- `git ls-remote origin refs/heads/main`, `git fetch origin main`, and `git log -1 origin/main` confirmed current main at the commit above. Read relevant files through `git show origin/main:<path>` as well as working-tree source. Initial sandboxed fetch was denied writing FETCH_HEAD; the approved retry succeeded. No checkout or integration occurred.
- Source inspection covered the SDK/SDK test, plugin installer/isolation/lifecycle test names, image viewer/preview service/inspectors, board search, Knowledge store, recovery runbook, development plan, status, decision register, documentation coverage and acceptance records. Historical pass counts remain historical; this review did not rerun application tests or qualify current runtime behavior.
- `npm run format:check` passed across the repository; focused Prettier checks for this record and CHANGELOG.md also passed. `npm run changelog:update`, `npm run changelog:check -- --base HEAD` and `git diff --check` passed. The complete `scripts/check-links.sh` ran through Ubuntu/WSL and returned All links OK with exit code zero. Initial sandboxed WSL access was denied; the approved retry completed successfully. Final validation-text edits only update this record and its generated projection, with no link-target changes.
- Application builds/full Turbo gate, browser/Electron rendering, live providers/engines, paid generation, installer drills and release publication were skipped because this task reviews opportunities and records findings without changing runtime behavior. Candidate effort and feasibility remain bounded judgments until execution.

##### Files

- `docs/changes/2026-10-26-open-task-opportunity-review.md`

#### Cover plugin SDK request rejection and recovery

**Impact:** none

[Permanent work record](docs/changes/2026-10-26-plugin-sdk-rejection-conformance.md).

##### Summary

Expand the TypeScript plugin SDK protocol suite from one success-path case to 20 behavioral cases. Protect initialization, dispatch and error-envelope contracts through the public stream interface without changing SDK runtime behavior.

##### Details

- Existing SDK coverage exercised successful initialization, ping, a tool call with brokered log/secret requests, settings notification and shutdown. Added 19 cases for rejection paths and continued service after recoverable request failures; retained the existing success-path test.
- Missing, unsupported numeric and string protocol versions return incompatibility errors before settings callbacks or tools run. Correct initialization after the rejection allows a subsequent tool request. Tool calls, ping and shutdown before initialization return worker-not-initialized errors, preserve callbacks and permit later initialization.
- A rejected asynchronous initial-settings callback returns an internal-error envelope, leaves tool dispatch uninitialized and permits corrected initialization. Unknown methods and tool IDs return method-not-found envelopes without dispatching a registered handler; subsequent valid requests succeed.
- Missing/array tool contexts and missing/unsupported access modes fail before handler execution. All three supported access modes preserve the supplied task ID, role, mode and input at the handler boundary. These checks establish SDK context handling, not host authorization or sandbox enforcement.
- Synchronous handler exceptions and asynchronous rejections return correlated internal-error envelopes. Explicit PluginSdkError values retain their code/message, and subsequent calls succeed. Exact request IDs distinguish error/result correlation from an unrelated response.
- The test fixture uses PassThrough streams and the public definePlugin API. Per-case cleanup ends input, waits for the worker and destroys owned streams; no ordinary service/profile, provider, external plugin or engine is involved.
- Four disposable source/test copies deliberately bypass protocol-version rejection, initialization gating, access-mode validation or typed-error preservation. Each copy produces the expected assertion failures, establishing that the new tests detect those regressions. Tracked runtime source remains unchanged. The ignored runner and reports are under .turbo/sdk-negative-controls/ in the isolated worktree.
- Work is isolated on codex/sdk-conformance-quick-wins from main 3b35deb50ffd5c08c2a8dbaa6426983d81d3dd30. Existing root-worktree inventory, prioritization, review and changelog edits are preserved. The larger Q04 community conformance/migration task remains incomplete; this bounded suite does not establish independently authored plugin compatibility or live isolation acceptance.
- Compatibility and migration: tests only, no runtime/API/schema/storage/dependency changes or migration required. Product version remains 0.22.0. Impact none because this adds verification of existing behavior.

##### Validation

- Fresh npm ci in the isolated worktree installed 1,211 packages, applied both existing patches and completed successfully. Initial sandboxed installation was denied directory creation; the approved retry succeeded. No dependency versions or lockfile were changed.
- npm test -w @gamecrafter/plugin-sdk passed all 20 cases. Four negative-control copies returned nonzero with behavioral assertion failures: version guard three, initialization guard three, access-mode guard two and typed-error preservation one. Test discovery was nonzero; filtered cases in negative-control runs were intentionally skipped.
- The required npx turbo run build typecheck lint test passed all 33 tasks on the approved host-access run (31 cached; desktop build and platform-service test ran fresh). Aggregate workspace results, including replayed cache results: 1,037 tests passed and nine skipped. Platform-service: 782 passed/eight skipped across 137 files; other workspace results: 255 passed/one skipped, including 20 SDK cases. Both browser and Electron builds passed; their echo-skip application typecheck/lint/test scripts do not establish renderer acceptance. The existing real-Blender fixture passed its two isolated tests; no broader engine/provider qualification is inferred. Logs remain ignored in .sdk-full-gate-host.log in the isolated worktree.
- The initial sandboxed full run encountered denied Git config writes inside disposable integration Projects and an Electron drivelist rebuild failure with LNK1101/MSPDB140.DLL mismatch. A focused model-scope case reproduced the Git denial and passed with approved host access; the full host-access rerun then passed the service suite and desktop native rebuild without source/toolchain changes. The first run is failed evidence, not a pass. Theia's temporary app-manifest edits and backup were restored/removed by its successful build tooling; no package-manifest/lockfile changes remain. The existing nonfatal require.resolve bundling warning remains.
- Repository-wide npm run format:check, focused Prettier checks, git diff --check, complete scripts/check-links.sh (Ubuntu/WSL; All links OK, exit zero), node scripts/check-documentation-evidence.cjs and node scripts/generate-system-reference.cjs --check passed. npm run changelog:update and npm run changelog:check -- --base 3b35deb50ffd5c08c2a8dbaa6426983d81d3dd30 passed. Final evidence-text edits only affect this record and its generated changelog projection; formatting/tracking/diff checks are refreshed before handoff.
- No independently authored community plugin, external model/generation provider, renderer/installed desktop, installer lifecycle or release acceptance is claimed. Hosted checks and publication have not been performed for this slice. Existing platform/capability skips remain explicit; none were added to make this change pass.

##### Files

- `packages/plugin-sdk/src/plugin-sdk.test.ts`
- `docs/changes/2026-10-26-plugin-sdk-rejection-conformance.md`

#### Integrate and qualify the SDK conformance pull request

**Impact:** none

[Permanent work record](docs/changes/2026-10-26-sdk-conformance-pr-integration.md).

##### Summary

Publish the bounded SDK conformance and integration-guide corrections as [PR 23](https://github.com/scarecr0w12/PlayWeld/pull/23), integrating the intervening 0.23.0 main changes before hosted qualification.

##### Details

- Pushed codex/sdk-conformance-quick-wins at d9c6068b0faa48ec03c30c9eec4ce6a71bc571e8 and opened PR 23 at the user's explicit request. GitHub reported a merge conflict because main had advanced from 3b35deb to 36782c97b1001f9ea449abf25864960ef17c7ab8, including the independent MCP discovery/Requests keyboard fixes and 0.23.0 preparation/publication-note changes.
- Integrated current main into the existing branch without rebasing or force-pushing. The only conflicted file was generated CHANGELOG.md: one side added the two SDK/guide records while main assigned its earlier records to 0.23.0 and added release records. Regenerated the changelog from the combined permanent records, retaining both new Unreleased tasks and the complete existing release history. No runtime or source conflict required resolution, and no released record was rewritten by this task.
- The integrated candidate inherits main's 0.23.0 package/workspace/lockfile versions and existing fixes. Original SDK/guide records retain their actual earlier 0.22.0 local verification context. This task does not prepare another release, change product support promises or close the broader Q04 conformance/migration card.
- User authorization covers checking hosted CI and review feedback, fixing remaining issues and merging after all checks pass. Qualification must use the final PR head and inspect review submissions/discussion/inline threads; earlier-head or cancelled runs cannot establish final-head acceptance. Final hosted and merge receipts are reported through the PR and task handoff without implying installer, signing or production acceptance.
- Compatibility and migration: repository integration/publication only, no additional runtime/API/schema/storage/dependency changes or migration required. Impact none; no new version/tag/installer/public release is produced. The original working checkout and its pending planning/changelog work remain preserved.

##### Validation

- Live PR metadata and fetched main identified the conflict and exact base/head commits. Inspected both generated conflict hunks before regenerating; no conflict markers remained afterward. npm ls -w @gamecrafter/plugin-sdk --depth=0 confirmed 0.23.0 workspace links resolve against the existing pinned dependencies.
- Initial-head checks on d9c6068 passed CodeQL (Actions, JavaScript/TypeScript and aggregate), GitGuardian and Kilo Code Review. Kilo's PR discussion reported No Issues Found with a merge recommendation; review submissions and inline threads were empty. The conflicted head had no normal CI workflow run, so these five successes do not qualify the integrated candidate or authorize an early merge.
- The integrated npx turbo run build typecheck lint test --concurrency=1 passed all 33 tasks (16 cached) in 8m10.413s, including browser and Electron builds and all 20 SDK cases. Workspace results total 1,043 passed/nine skipped, including 788 platform-service passes/eight skips and 255 other-workspace passes/one skip. Exact results are retained in the ignored .sdk-integrated-gate.log; this is local source/build evidence, separate from hosted qualification. No assertions were weakened or timeouts increased.
- Repository-wide formatting, complete scripts/check-links.sh through Ubuntu/WSL (All links OK, exit zero), version agreement at 0.23.0, generated RPC/settings and documentation inventory freshness, documentation evidence integrity, branch-base changelog coverage and diff checks passed. Regenerated records/changelog and focused formatting/tracking/diff checks are refreshed after final evidence-text updates. The existing nonfatal require.resolve bundling warning remains.
- Hosted checks/reviews and merge of the final integrated head are separate subsequent gates, not claimed by this pre-merge record. Initial-head successes above remain explicitly historical; final-head evidence is inspected before merging and reported in the PR/handoff.
- The merged-main candidate f06350c37c41acb7390e291e49e8159b267197d4 received passing Linux quality and browser jobs in [CI run 40434067803](https://github.com/scarecr0w12/PlayWeld/actions/runs/40434067803), plus CodeQL and GitGuardian successes. Windows quality was still running when this receipt was written. The initial Kilo approval remained attached only to d9c6068, with no Kilo check on f06350c. This ordinary evidence-only follow-up commit records the partial hosted receipts and uses the documented [new-commit review trigger](https://kilo.ai/docs/automate/code-reviews/github); no application code or reviewer settings change. All checks and feedback must be inspected again on the resulting head. Superseded or cancelled runs do not establish its acceptance.

##### Files

- `docs/changes/2026-10-26-sdk-conformance-pr-integration.md`

## 0.23.0

### Added

#### Audit retention and deletion controls

**Impact:** minor

[Permanent work record](docs/changes/2026-10-24-audit-retention.md).

##### Summary

Add scoped audit-history retention to Audit & History, with separate preview/confirmation for manual deletion, explicit automatic-retention opt-in, and durable per-store cleanup receipts. This implements the audit-history portion of WP7/S09; other domain stores and service-log pruning remain separate work.

##### Details

- Previously Audit & History exposed reading/export without audit deletion controls. Add four authenticated, typed RPCs for reading policy/receipts, atomically setting Project policy, previewing eligible cleanup and applying a confirmed preview. Generated references now describe 204 request methods and 88 built-in settings. Existing export contracts remain compatible.
- Add platform defaults and Project overrides for `audit.retentionDays` (0 means keep indefinitely), `audit.deletionEnabled` (false) and `audit.autoPrune` (false). Automatic cleanup requires both explicit enablement and positive days. Policy saving uses the existing settings-import transaction; no new frontend-owned durable state is introduced.
- Manual cleanup normalizes a UTC cutoff and selects strictly older records. Review tokens are session/Project/store bound, expire after five minutes, are consumed before mutation, and are invalidated by changed policy or selected row content through a recomputed SHA-256 fingerprint under locks. Cache at most 100 metadata/count/fingerprint reviews without retaining audit payload copies. Reject missing Projects, stale/expired/foreign tokens and empty batches. Session close and service stop clear reviews.
- Project cleanup batches at most 250 finished tool calls and 250 task lifecycle events, plus eligible linked resolved approvals and tool-call events. Pending/recent approval evidence remains. Task-related deletion requires the complete root tree to be terminal, unleased and older than the cutoff. Active, leased, recent or invalid task context protects the tree and its transitive prerequisite trees across dependency links. Preserve other domain/provenance events, task projections, questions, answers, checkpoints, results, artifacts and Project files.
- Model cleanup independently batches up to 250 completion-usage, 250 completed assessment and 250 legacy self-reported usage records. Apply the same task protection; retain unattributed legacy usage while any Project task history is protected. Remove eligible current usage/assessment rows but retain router decisions/outcomes, quality/cost learning, budgets/spending and other accounting. Suppress eligible legacy audit projections with an `audit_retained` flag, including fallback rows linked to removed completion usage, so audit reads do not resurrect deleted usage from retained learning data.
- Write each store's deletion and receipt in one transaction. Project receipts are permanent `audit.pruned` events with sequences above the pre-deletion maximum. Model receipts live in the profile. A Project lock holds task context stable during model cleanup; this is per-store atomicity, not a global transaction across both databases. Receipt failure rolls back the affected store. Return the latest 20 receipts per store without removing older receipts, and expose IDs, origin, scope, cutoff and counts without deleted payloads.
- Run automatic retention every 60 seconds for available, explicitly opted-in Projects. Skip empty batches, isolate failures by store, avoid raw audit payloads in warning logs, and stop the timer on service shutdown. Each successful automatic batch retains its own receipt.
- Add the Retention & deletion panel with saved-policy controls, separate Project/model store choice, UTC date input, read-only counts and an unchecked confirmation box. Prevent duplicate submissions, invalidate review on policy/date/store/Project changes or expiration, clear review after any apply attempt, ignore late responses after unmount and refresh history after manual success. Receipts can be refreshed after automatic cleanup; controls wrap at narrow widths.
- Add contract, real SQLite unit, native authenticated RPC, migration and renderer regression coverage. The prerequisite regression first reproduced deletion of completed evidence still needed by active work, then verified recursive protection and release after all dependent work finishes. Receipt-trigger failures exercise transaction rollback; other cases cover pending children/approvals, stale review, session identity, expiry/reuse, policy changes, batching, monotonic sequence, automatic opt-in/shutdown and preservation of router learning.
- Update WP7/S09 and status consistently as scoped implementation, add architecture/default and authority documentation, operator/recovery instructions and user navigation, and regenerate RPC/settings/documentation references. Correct the architecture's stale page-only export and unimplemented grouping description to match the already implemented full export and Requests view.
- Compatibility/migration: additive RPC/settings contracts, profile migration 21 adds the retained-audit flag defaulting to 1 for existing router outcomes and the model receipt table; migration regression preserves prior learning values. Project schema remains 14. No dependency/package changes or removals in this task. Existing settings remain compatible; `logs.retentionDays` does not implement log cleanup. Audit deletion is logical deletion and does not remove exported files, backups, cached copies, operational task data or retained learning payloads.
- Minor impact reflects compatible new user-facing functionality. Product version remains 0.22.0 while work is pending; no release, installer, tag or publication is prepared.

##### Validation

- Regression-first focused tests reproduced the missing cleanup RPC and the transitive prerequisite protection defect before implementation. Focused retention unit and authenticated service integration tests pass after the fixes; migration, contract and renderer suites also passed during iteration.
- Final `npx turbo run build typecheck lint test --concurrency=1` after the dependency-protection correction passed all 33 tasks (22 cached), with 959 tests passed and 7 skipped across 191 test files: contracts 78, platform service 723 passed / 6 skipped, Theia extension 153, and remaining workspace suites. Both Electron and browser application builds passed. Existing app-shell lint/typecheck/test scripts report skip; the extension/service/shared packages supply actual checks. Evidence: `.turbo/audit-retention-quality-complete.log`; two earlier full runs also passed during implementation.
- Generated system references/inventory freshness, documentation evidence integrity, release-version agreement, Markdown links, formatting, change-record coverage and whitespace checks passed. Evidence includes `.turbo/audit-retention-links.log` and `.turbo/audit-retention-format.log`. Final artifact checks were repeated after recording browser acceptance.
- Puppeteer acceptance against the built browser application and authenticated service passed eight checks with zero renderer errors: defaults keep history; preview does not mutate and requires separate confirmation; Project switching clears review; stale selected data rejects deletion; confirmed Project cleanup removes exactly one eligible call, resolved approval and event while preserving active work, pending approval, another Project and files; separately confirmed model cleanup preserves the foreign ledger; the real 60-second service timer performs opted-in cleanup in both stores with independent automatic receipts; and a 480px viewport has no horizontal overflow (audit panel client/scroll width both 383px). Inspected both wide and narrow screenshots. Evidence: `.turbo/audit-retention-ui/report.json`, `review-before-deletion.png`, `retention-narrow.png` and `.turbo/audit-retention-ui-final.log`.
- Earlier browser harness attempts exposed navigation readiness and stale built extension output, not a completed product validation. Corrected fixture navigation/readiness, rebuilt the extension/application with the owned backend stopped and then completed the final flow. Automatic cleanup was disabled for the disposable Project in teardown and its pending task was cancelled. Stopped the owned backend after verifying the listening PID; port 3131 is free and the isolated service reports `not running`. No ordinary user profile or Project data was deleted.
- Validation uses disposable profile/Project data and fixtures. No live model/engine/DCC integration, large-history performance qualification, packaged Electron launch, installer, secure erasure or production acceptance is claimed. Broader domain retention and service-log pruning remain unimplemented.

##### Files

- `packages/contracts/src/audit.ts`
- `packages/contracts/src/audit.test.ts`
- `packages/contracts/src/rpc/protocol.ts`
- `packages/platform-service/src/audit/audit-retention.ts`
- `packages/platform-service/src/audit/audit-retention.test.ts`
- `packages/platform-service/src/audit/audit-retention.integration.test.ts`
- `packages/platform-service/src/settings/definitions.ts`
- `packages/platform-service/src/settings/registry.test.ts`
- `packages/platform-service/src/service.integration.test.ts`
- `packages/platform-service/src/profile/migrations.ts`
- `packages/platform-service/src/profile/migrations.test.ts`
- `packages/platform-service/src/models/router.ts`
- `packages/platform-service/src/service.ts`
- `packages/theia-control-room/src/common/control-room-protocol.ts`
- `packages/theia-control-room/src/node/control-room-service.ts`
- `packages/theia-control-room/src/browser/audit-retention-panel.tsx`
- `packages/theia-control-room/src/browser/audit-retention-panel.test.tsx`
- `packages/theia-control-room/src/browser/audit-widget.tsx`
- `packages/theia-control-room/src/browser/style/index.css`
- `docs/DEVELOPMENT_PLAN.md`
- `docs/STATUS.md`
- `docs/OPEN_DECISIONS.md`
- `docs/TECHNICAL_ARCHITECTURE.md`
- `docs/SKILLS_AGENTS_AND_TOOLS.md`
- `docs/PLATFORM_DESIGN.md`
- `docs/CONTROL_ROOM_HANDBOOK.md`
- `docs/OPERATIONS_GUIDE.md`
- `docs/USER_GUIDE.md`
- `docs/API_REFERENCE.md`
- `docs/SETTINGS_REFERENCE.md`
- `docs/reference/rpc-schemas.json`
- `docs/reference/settings-schemas.json`
- `docs/reference/DOCUMENTATION_INVENTORY.md`
- `docs/reference/documentation-inventory.json`
- `docs/changes/2026-10-24-audit-retention.md`

#### Export complete retained Project audit history

**Impact:** minor

[Permanent work record](docs/changes/2026-10-24-full-audit-export.md).

##### Summary

Complete WP7's deferred full-history audit export. Audit & History previously downloaded only the loaded page and could omit older activity. A separate service-owned export now prepares all retained Project calls, approvals, events and model usage as validated, redacted JSON, with a checksum/count receipt and a Control Room download action.

##### Details

- Add the compatible authenticated `audit/export` request and exported `AuditExportSchema`/receipt/count contracts. The method accepts only Project identity, not an arbitrary output path or user-supplied SQL/filter/cursor. Keep protocol version 1, existing `audit/read` semantics and page download intact. Generated references now describe 199 requests, 28 notifications and the unchanged 85 builtin settings.
- Serialize history to a unique file under the selected Project's `.gamecrafter/cache/audit-exports/`. Use an exclusively created private partial file, complete-write loops, incremental SHA-256/byte accounting, close and rename before returning the receipt. Validate each redacted record before publication. On a write/serialization/validation failure, remove the partial and preserve source records and previous exports. Check each cache ancestor's resolved containment so a linked export directory cannot redirect output outside the Project.
- Extend the existing SQLite seam with a lazy row iterator; do not introduce another SQLite interface. ToolStore and TaskStore provide source-owned complete call/approval/event projections; calls and approvals also filter their explicit Project identity. Hold Project and profile transactions during synchronous serialization to keep both stores stable. Memory scales with the largest row/serialized record instead of the complete history, but long exports block service work and other writers; large-dataset performance is not qualified.
- Refactor model usage projection into a reusable generator. The existing bounded view retains its per-source limit, cross-source chronological sort and final page limit; the exporter consumes all eligible rows. Include current completions, legacy self-reported route outcomes and eligible decision-inference usage; exclude legacy duplicates already represented by current usage and pending assessments without billable evidence. Preserve nullable token counts, unknown/unverified costs and cache counts without inventing prices or zeros.
- Share model-label redaction between page and full export, preserving internal model identifiers so records continue to join to their registered models. Preserve numeric `*Tokens` fields instead of letting the sensitive-key matcher replace them with strings. Redact credential-like nested fields and whole-value token strings using existing policy, then validate the exported record shape. This is routine redaction, not proof that arbitrary free text contains no private information; operator guidance requires review before sharing.
- Add the separate **Export full history** action using the backend's typed service bridge and Theia's existing file-download service. It works independently of the loaded page/filter, prevents duplicate preparation while in progress, captures the requested Project identity, and reports preparation counts/bytes and retained-cache behavior. Export errors leave the loaded page, filter and pagination state intact. Keep the existing redacted-page download available, and distinguish page/full export explicitly in the event-section guidance.
- Reconcile WP7/STATUS and S09 without closing prompt grouping, audit retention/deletion or unrelated export scopes. Record the engineering default in architecture, contracts guidance and the decision log; update the handbook and operations guide with scope, download/cache handling, redaction limitations and service-pause behavior. Map audit RPC inventory evidence to its new owning source directory and regenerate API/schema/inventory projections.
- Compatibility: additive RPC and export format; no database migration, dependency or package-version change. Product version remains 0.22.0 while pending; impact `minor` reflects a compatible user-visible capability. Export files are separate local cache artifacts, not backup archives or encrypted credential recovery. Repeated exports remain until manually removed or applicable cache cleanup; crashes can leave unpublished partial files. No power-loss durability, archive completeness, installed Electron/Linux or production-scale performance claim is made.
- Preserve the prior uncommitted security/documentation and plugin-upgrade work. This record owns only complete audit export, its supporting changes and evidence. No ordinary profile/Project, paid external provider, production engine/DCC session, release, installer, GitHub settings or published artifact is changed for this feature. The broader suite executes its existing disposable Blender/Qdrant fixtures where available; those checks do not establish complete live integration acceptance.

##### Validation

- Red integration evidence: after correcting invalid fixture request/decision values, the old service failed with `Method not found: audit/export` while `audit/read` returned only 500 calls. Red UI evidence: the rendered action was absent. Logs: `.turbo/audit-export-red.log`, `.turbo/audit-export-ui-red.log`.
- Native authenticated RPC integration now exports 1,201 fixture calls/events and 1,201 current model records, plus one eligible legacy usage row and one decision inference. It validates the complete file schema, array counts, UTF-8 content, byte length/SHA-256, nested redaction, preserved numeric token/cache counts, legacy deduplication, pending-assessment exclusion, foreign-Project exclusion, unknown-Project rejection, original history preservation, failure cleanup and external junction/symlink rejection. Disable unrelated board maintenance and identify fixture records explicitly so background events do not become brittle exact-total assertions; restore deliberately corrupted fixture input after the failure probe. Final focused integration passed.
- Focused service/router/decision/main-RPC checks passed 37 tests across four files; subsequent expanded integration passed. Focused UI passed eight tests, including full export without a page, preserving filters/page state across asynchronous Project selection, and retryable preparation errors. Focused contract/RPC checks passed four tests across two files. No assertions were weakened to mask a product failure; fixture corrections account for actual contract values and independently scheduled activity.
- The first full gate exposed that applying generic whole-value redaction to long internal model IDs broke an existing model-routing audit assertion. Reproduced the failure in the unchanged model integration suite, removed that extra ID masking, and retained label redaction and numeric token/cache handling. The unchanged model integration and expanded audit integration then passed together (eight tests); final full-gate results follow below.
- Puppeteer acceptance against the built browser application passed five checks with zero renderer errors: download all 1,201 fixture calls/events/model records from a later event page with a nonmatching filter; verify redaction and numeric token/cache preservation; preserve page/filter selection; match downloaded bytes to the service artifact; renderer health. Final file: 1,155,846 bytes, 1,202 calls (including independent service activity), 1,212 events and 1,201 model-usage records. Corrected the harness to count its fixture records explicitly rather than rejecting legitimate background calls. Evidence: `.turbo/audit-export-ui/report.json`, `full-history-export.png`, `.turbo/audit-export-ui-final.log`. The final build was checked again after clarifying page/full-export guidance. Stopped the owned browser server after validating its port owner; port 3129 is free and the isolated service reports `not running`. This is automated browser/source-fixture evidence, not installed-product or large-dataset acceptance.
- Generated-reference/inventory freshness (199 requests, 28 notifications, 85 settings, 27 service subsystems), documentation evidence integrity, release-version agreement, Markdown links, formatting and change-record coverage checks passed. Final `npx turbo run build typecheck lint test --concurrency=1` passed all 33 tasks (22 cached), with 930 tests passed / 7 skipped across 184 files: contracts 76, service 712 passed / 6 skipped, Theia extension 137, and the remaining workspace suites. A final frozen-source repeat after the UI guidance correction also passed all 33 tasks (25 cached), including Electron/browser application builds. Logs: `.turbo/audit-export-quality-final.log` and `.turbo/audit-export-quality-frozen.log`. Existing app-shell lint/typecheck/test scripts report `skip`; real application builds and extension/service checks must be distinguished from those placeholders.

##### Files

- `packages/contracts/src/audit.ts`
- `packages/contracts/src/audit.test.ts`
- `packages/contracts/src/index.ts`
- `packages/contracts/src/rpc/protocol.ts`
- `packages/platform-service/src/audit/audit-export.ts`
- `packages/platform-service/src/audit/audit-export.integration.test.ts`
- `packages/platform-service/src/db/database.ts`
- `packages/platform-service/src/tools/tool-store.ts`
- `packages/platform-service/src/tasks/task-store.ts`
- `packages/platform-service/src/models/router.ts`
- `packages/platform-service/src/service.ts`
- `packages/theia-control-room/src/browser/audit-widget.tsx`
- `packages/theia-control-room/src/browser/audit-widget.test.tsx`
- `packages/theia-control-room/src/common/control-room-protocol.ts`
- `packages/theia-control-room/src/node/control-room-service.ts`
- `scripts/generate-documentation-inventory.cjs`
- `docs/API_REFERENCE.md`
- `docs/reference/rpc-schemas.json`
- `docs/reference/DOCUMENTATION_INVENTORY.md`
- `docs/reference/documentation-inventory.json`
- `docs/DEVELOPMENT_PLAN.md`
- `docs/STATUS.md`
- `docs/OPEN_DECISIONS.md`
- `docs/TECHNICAL_ARCHITECTURE.md`
- `docs/PLATFORM_DESIGN.md`
- `docs/SKILLS_AGENTS_AND_TOOLS.md`
- `docs/CONTROL_ROOM_HANDBOOK.md`
- `docs/OPERATIONS_GUIDE.md`
- `docs/changes/2026-10-24-full-audit-export.md`

#### Group pending approvals and task questions in Requests

**Impact:** minor

[Permanent work record](docs/changes/2026-10-24-grouped-requests.md).

##### Summary

Complete the WP6/WP7 prompt-grouping gap with a service-backed Requests view. Concurrent approvals and task questions previously produced independent notifications, and free-text questions depended on locating a task in Swarm. Users can now review the pending set by Project/root task and respond to each request explicitly, without adding bulk permission or frontend-owned durable state.

##### Details

- Add the compatible authenticated read-only `broker/pendingInputs` RPC and schema-versioned pending-input projection. Read existing approvals/calls/questions/tasks directly, including Project/task/root context; do not depend on a bounded task-history page or add a new persisted queue/table. Include actionable unresolved approvals and unanswered questions on waiting tasks. Exclude terminal task questions, completed/resolved calls and invalid Project ownership. Name missing-manifest Projects as unavailable; other read errors fail the projection instead of silently reporting no work.
- Preserve mutation authority in existing per-call approval and per-task/question answer RPCs. Fix TaskGraph's stale-question case: a previously answered question cannot be answered again while its task is waiting for a newer question. The regression preserves the original answer and the current question's waiting state. Existing timeout, cancellation, access-mode and ceiling policies remain unchanged; no new broker tool or approval bypass is added.
- Add the singleton transient Requests model, widget, command and Project Home/PlayWeld-menu destinations. Group by Project/root task, with separate direct-request groups and explicit shown/total counts when filtering; show tool/effect/redacted input or the literal question text and its Project/task context in one selected inspector. Support exact listed string choices, including empty literal choices, and nonblank free text when choices are absent or empty. The view submits strings; specialized structured-answer and MCP elicitation flows remain separate.
- Replace and remove the independent ToolApprovalHandler/TaskQuestionHandler toast implementations and bindings. One generic summary notification opens Requests and contains no approval/answer action. New request events coalesce; duplicate snapshots do not repeat a notification, and only one summary is open at a time under Theia's normal notification lifecycle. Existing Swarm approval/question controls remain available. Dismissing a notification or selecting a group grants no permission and does not answer anything.
- Refresh on opening, relevant events, reconnect and ten-second reconciliation. Use a bounded 75ms coalescing window and queue a follow-up read for events during an in-flight read, avoiding both indefinite debounce starvation and overlapping refresh churn. Disconnection invalidates older in-flight results. Failed/disconnected snapshots remain visible but cannot dispatch responses until fresh service data succeeds. Responses capture their own identity, suppress duplicate submissions per request, refresh after errors/success and never automatically retry mutations.
- Keep the selected request identity after it resolves so the inspector clears until another request is selected. Key detail content by request identity to prevent reusing a previous request's action button. A delayed pointer/keyboard action must not become approval of the next request. Keep unsaved drafts across selection changes and transient failures, including unavailable-Project recovery; remove them on resolution. Background reads keep draft fields editable to preserve typing/focus while response buttons wait for fresh state. Drafts are transient and disappear with the view; durable requests remain in the service.
- Add a responsive two-column list/inspector layout that stacks below 680px, wraps long content and constrains form controls. Preserve native button/select/textarea keyboard semantics, selected-state labeling, loading/error states and per-request disabled controls. Navigation tests now include the new Requests command/destination rather than retaining the previous destination count.
- Reconcile WP6/WP7, STATUS and S01/U04 in place, retaining the wider product/creative ownership of U04 and remaining audit-retention/deletion work. Add the selected engineering default in architecture/contracts and the decision log. Update handbook, user guide, operations guide and workflow cookbook for review-only notifications, explicit response controls, recovery and limitations. Regenerate API/schema/inventory projections: 200 requests, unchanged 28 notifications/85 builtin settings/27 service subsystems, and 17 Control Room surfaces including Project Home.
- Compatibility: additive RPC/contracts; no database migration, dependency, package version or installed-profile change. Current product version remains 0.22.0 while pending. Impact `minor` reflects a compatible user-visible feature and replacement of direct toast response buttons with a persistent review surface. Existing exact-identity RPC clients and Swarm response controls remain compatible. No user-confirmed requirement/decision row is changed or newly confirmed.
- Preserve all earlier pending security/documentation, plugin-upgrade and audit-export work. Only disposable test profiles/Projects are used for actual responses. No ordinary user request, credentials/private configuration, paid provider, production editor, installer, release, remote settings or public artifact is modified. The broader suite's existing disposable native/Docker fixtures retain their own evidence boundaries.

##### Validation

- Red evidence: the old service rejected `broker/pendingInputs` as an unknown method; the old TaskGraph accepted an old answered question while another was pending. Additional red cases demonstrated sustained-event debounce starvation, inability to answer a valid empty-choice question, and disabled draft fields during background reads. Logs: `.turbo/requests-rpc-red.log`, `.turbo/requests-stale-question-red.log`, `.turbo/requests-event-burst-red.log`, `.turbo/requests-empty-options-red.log`, `.turbo/requests-draft-focus-red.log`.
- Native RPC integration passed with two Projects, root/child task context, choice/free-text questions, independently approved/rejected calls, redacted credential-shaped fixture input, cancellation, missing-manifest Project reporting, stale approval rejection, service restart and recovery of the exact pending question. Corrected the fixture to assert the broker's existing rejection error rather than expecting a success result for a rejected tool call. The original graph regression also passes without weakening its original-answer/current-question assertions.
- Model/render/navigation tests pass for burst coalescing, one review notification, no implicit mutations, sustained events, exact per-call response identity, stale resolutions, disconnect/late results, failed reads/actions, lifecycle disposal, listed/empty/free-text answers, literal text escaping, selected-inspector clearing and draft editability during refresh. Typecheck and lint passed while iterating. Home/menu expectations were updated for the new destination; previous routes remain asserted.
- The first full run passed all package tests but its browser application build hit `EBUSY` copying the loaded Windows `conpty.node` while the owned browser server was running. Stop that server before rebuilding; do not weaken build checks. The first browser attempt also found the summary toast covering the narrow-window answer button; the harness now uses the real **Review requests** action first and asserts that opening the view executes nothing. The final checks below use the corrected harness and a stopped browser server during builds.
- Final `npx turbo run build typecheck lint test --concurrency=1` passed all 33 tasks (25 cached), including actual Electron/browser application builds. The validated package suites total 943 passed / 7 skipped tests across 188 files: contracts 77; platform service 714 passed / 6 skipped; Theia extension 147; other workspaces retain their checks. The final frozen-source repeat after the shown/total count clarification also passed all 33 tasks (25 cached). Logs: `.turbo/requests-quality-final.log`, `.turbo/requests-quality-handoff.log`. Existing app-shell lint/typecheck/test scripts say `skip`; extension/service tests and application builds provide the actual source/build evidence.
- The built-browser acceptance passed seven checks with zero renderer errors: one review summary for three questions/three approvals; no authority from opening Requests; held-click resolution in another client cannot approve a replacement; exact selected approval and independent rejection; correct choice/free-text worker answers; remaining-question recovery after browser reload; renderer health. Draft typing focus/value survived periodic refresh. At a 480px viewport the Requests content measured 383px client/scroll width with no horizontal overflow. Evidence: `.turbo/requests-ui/report.json`, `grouped-requests.png`, `requests-narrow.png`, `.turbo/requests-ui-handoff.log`. The final capture is repeated after the count-label clarification.
- Source/reference and documentation-inventory freshness (200 requests, 28 notifications, 85 settings, 27 service subsystems), documentation evidence integrity, release version 0.22.0, Markdown links, root Prettier, Git whitespace and changed-path/changelog checks passed. Only owned browser/service processes are used; final cleanup verifies port 3130 is free and the isolated service is stopped. No installer, installed Electron/Linux or broad provider/engine acceptance claim is made.

##### Files

- `packages/contracts/src/tasks/pending-inputs.ts`
- `packages/contracts/src/tasks/pending-inputs.test.ts`
- `packages/contracts/src/tasks/index.ts`
- `packages/contracts/src/rpc/protocol.ts`
- `packages/platform-service/src/tasks/pending-inputs.ts`
- `packages/platform-service/src/tasks/pending-inputs.integration.test.ts`
- `packages/platform-service/src/tasks/task-graph.ts`
- `packages/platform-service/src/tasks/task-graph.test.ts`
- `packages/platform-service/src/service.ts`
- `packages/theia-control-room/src/common/control-room-protocol.ts`
- `packages/theia-control-room/src/node/control-room-service.ts`
- `packages/theia-control-room/src/browser/requests-model.ts`
- `packages/theia-control-room/src/browser/requests-model.test.ts`
- `packages/theia-control-room/src/browser/requests-widget.tsx`
- `packages/theia-control-room/src/browser/requests-widget.test.tsx`
- `packages/theia-control-room/src/browser/requests-view-contribution.ts`
- `packages/theia-control-room/src/browser/control-room-frontend-module.ts`
- `packages/theia-control-room/src/browser/project-home-widget.tsx`
- `packages/theia-control-room/src/browser/project-home-widget.test.tsx`
- `packages/theia-control-room/src/browser/workspace-menu-contribution.ts`
- `packages/theia-control-room/src/browser/style/index.css`
- `packages/theia-control-room/src/browser/task-question-handler.ts`
- `packages/theia-control-room/src/browser/tool-approval-handler.ts`
- `docs/API_REFERENCE.md`
- `docs/reference/rpc-schemas.json`
- `docs/reference/DOCUMENTATION_INVENTORY.md`
- `docs/reference/documentation-inventory.json`
- `docs/DEVELOPMENT_PLAN.md`
- `docs/STATUS.md`
- `docs/OPEN_DECISIONS.md`
- `docs/TECHNICAL_ARCHITECTURE.md`
- `docs/PLATFORM_DESIGN.md`
- `docs/SKILLS_AGENTS_AND_TOOLS.md`
- `docs/CONTROL_ROOM_HANDBOOK.md`
- `docs/USER_GUIDE.md`
- `docs/OPERATIONS_GUIDE.md`
- `docs/WORKFLOW_COOKBOOK.md`
- `docs/changes/2026-10-24-grouped-requests.md`

#### Complete declarative plugin settings upgrades

**Impact:** minor

[Permanent work record](docs/changes/2026-10-24-plugin-settings-upgrades.md).

##### Summary

Complete WP5's deferred plugin-setting migration path using the existing WP12 lifecycle. Users can review and install a higher plugin version without uninstalling and losing settings; service-owned declarative transforms preserve scope precedence, fail closed on invalid data, and checkpoint each durable store independently.

##### Details

- Extend the existing manifest migration entries with optional `rename`, `map-values` and `remove` operations and optional scope selectors. Legacy description-only entries and empty arrays remain valid. Export a schema-versioned persisted upgrade-plan contract; do not add an executable migration hook or a parallel plugin format. Validate forward/unambiguous chains, owned keys, collisions, exact value mappings, resulting schemas and scope eligibility. Unknown or incompatible values are preserved behind an actionable error rather than silently dropped.
- Add a service-owned migration component integrated with SettingsService resolution, enumeration, set/import and plugin lifecycle. Profile migration 20 adds history/checkpoint persistence; Project migration 14 adds per-plugin checkpoints. Both are additive and retain existing setting rows. Profile activation, its plan, platform overrides and version checkpoint commit together. Project overrides/checkpoints migrate atomically on access; session overrides convert in memory and remain ephemeral. Import previews validate transforms without applying settings/checkpoint changes.
- Keep import migration work limited to the selected scope and imported setting owners. A targeted regression exposed that a platform import carrying a Project ID could otherwise migrate that Project as a side effect; restrict it and verify the Project's old rows remain untouched. Importing unrelated builtin settings also does not force an unrelated plugin's pending migration.
- Preserve migration history for Projects that were unavailable or skipped versions. Use a complete package-declared chain when a restored Project arrives in a fresh profile without local history. Missing chains or invalid results fail without discarding original overrides. The mechanism is per-store transactional, not a global crash-atomic transaction over every registered Project. Existing unavailable-Project uninstall cleanup limitations are documented separately.
- Enforce actual setting ownership when plugin IDs contain dots. Prefix-only matching would let a parent-like ID include a different plugin's namespace. Protect current declarations and other plugins' historical keys, reject cross-owner operations, and delete only the upgrading plugin's owned rows. Add a parent/child-ID regression covering migration and uninstall without touching the child plugin's value.
- Apply the same owner-based selection to worker initialization and settings-change delivery. A worker receives only definitions registered to its own plugin; accessing one plugin no longer attempts unrelated plugins' pending migrations. This closes the corresponding prefix-based configuration-delivery mismatch instead of only protecting database writes.
- Extend the service's existing `plugin/install` path to higher versions; retain exact-capability review, compatibility checks, reverse dependent-plugin constraints, enabled state, Project enablement and secret references. Identical bytes/version are idempotent; same-version republishing and downgrades remain rejected. Stage immutable version directories, preflight before stopping workers, revalidate after stopping, activate synchronously after the profile commit, and retain old files until uninstall. Failed preparation/commit cleans only the candidate; a committed active installation is not deleted by a later activation error.
- Serialize install/uninstall/enable/disable/start/stop and auto-start lifecycle mutations. Stop old workers before activation and attempt restart for previously running Projects; worker failures remain visible. Native worker integration proves a changed PID and tool output using the migrated value; invalid subsequent upgrades leave the running worker, settings and installed version intact. Uninstall removes retained version directories and reachable owned settings/history while preserving usage/audit records.
- Update the Plugins UI to identify upgrades, expose inspection/migration warnings and an expandable review of version transitions, descriptions and exact declarative operations, and report upgrade completion. Settings subscribes to plugin changes so replaced definitions refresh. Add a rendered component test for the upgrade action and warnings. No new RPC method, protocol version, builtin setting or dependency is introduced; generated RPC schema exports now include the compatible optional manifest field.
- Reconcile WP5/STATUS and W06/U03/S04 in place, link the engineering default in architecture/contracts and the decision log, and add author guidance with migration examples, scope behavior, failure/recovery limits, platform compatibility and pending-release qualification. Preserve user-confirmed requirements and all unrelated remaining work. Correct the extension cookbook's stale Windows-isolation prerequisite using scoped existing/native evidence.
- Compatibility and migration: product version stays 0.22.0 while pending. Existing plugins without new operations remain compatible. Existing profile/Project stores acquire additive tables on migration; ordinary user data was not opened or upgraded in this session. Older applications must not be used against newer store schemas; normal backup/restore and release compatibility rules apply. Impact `minor` reflects a compatible feature and optional manifest expansion; release preparation must choose a new version before packaging. Arbitrary executable/data migrations, plugin signatures/egress policy and release/installer acceptance remain open.
- Preserve all uncommitted security/documentation work from the preceding session steps. This record owns only the plugin upgrade feature and its evidence; prior records remain permanent sources for their separate changes.

##### Validation

- Red contract test failed on the old schema because migration operations were unsupported. After the contract change, the RPC upgrade test passed for renamed platform/Project/session values and durable restart behavior. Added unsupported-operation/schema rejection, skipped-version replay, restored-profile fallback, collision/invalid-value/foreign-key/missing-chain rejection, checkpoint-write rollback, nonmutating preview and explicit scope-removal tests.
- Focused service/installer/settings/profile checks passed, including real sandboxed worker upgrade/restart/tool output and failed-upgrade preservation. Focused UI test initially exposed incomplete mock fixture data; corrected the fixture and all three catalog layout tests passed. These fixture corrections did not require weakening product assertions. A later rendered regression also demonstrated that a warning alone did not display the migration operations; add the expandable review and verify its description and source/destination keys. All three catalog tests pass. The final outcomes follow.
- The new scoped-import assertion failed during a full run that began before its correction; the final source then passed build/typecheck/lint and 35 focused service tests (one existing skip). One concurrent broad-build attempt encountered a locked native AppContainerHost executable while worker integration was running. Wait for the owned worker tests to finish and rerun verification without changing product behavior or assertions.
- Final frozen-source `npx turbo run build typecheck lint test --concurrency=1` passed all 33 tasks (25 cached); the preceding complete run passed all 33 (24 cached), with 925 passed / 7 skipped tests across 182 files. Platform service: 711 passed / 6 skipped across 130 files; contracts: 75 passed; Theia extension: 134 passed. Existing app-shell lint/typecheck/test scripts say `skip`; this gate also built the actual Electron/browser applications and checked the extension/service code. Logs: `.turbo/plugin-settings-upgrade-quality-complete.log` and `.turbo/plugin-settings-upgrade-quality-frozen.log`.
- Final Puppeteer acceptance against the built browser application passed five checks with zero renderer errors: inspect v2 while v1 remains active; display migration descriptions and exact operations; accept the real upgrade and convert the stored override; refresh an already-open Settings view to the renamed field/value; renderer health. Corrected harness readiness, nested navigation-label selectors and an initially stale built asset before this final run. Report and screenshots: `.turbo/plugin-settings-upgrade-ui/report.json`, `upgrade-review.png`, `upgraded-settings.png`; run log `.turbo/plugin-settings-upgrade-ui-frozen.log`. This is scoped automated browser/native-worker evidence, not installer or personal product acceptance. The screenshot retains existing Settings navigation layout limitations; no broader UI-layout acceptance is claimed.
- Stopped only the owned browser server after checking port ownership; port 3128 is free, and the disposable service reports `not running`. Retained ignored fixtures/evidence. System-reference and documentation-inventory checks, documentation evidence integrity, release-version check (0.22.0), root Prettier formatting, Markdown links and Git whitespace checks passed. Regenerated the changelog and verified changed-path coverage against HEAD.
- Existing database seam, migrations and supported authenticated RPC/CLI interfaces are used throughout. Native tests use disposable profiles/Projects; no ordinary profile, credential, provider, engine or paid external service is used for this feature. The broader package suite may execute its existing disposable Blender/Qdrant fixtures; that is not full integration acceptance.

##### Files

- `packages/contracts/src/plugins/schema.ts`
- `packages/contracts/src/plugins/plugins.test.ts`
- `packages/platform-service/src/profile/migrations.ts`
- `packages/platform-service/src/profile/migrations.test.ts`
- `packages/platform-service/src/projects/migrations.ts`
- `packages/platform-service/src/settings/plugin-settings-migrations.ts`
- `packages/platform-service/src/settings/registry.ts`
- `packages/platform-service/src/settings/settings-service.ts`
- `packages/platform-service/src/settings/settings-service.test.ts`
- `packages/platform-service/src/plugins/plugin-installer.ts`
- `packages/platform-service/src/plugins/plugin-host.ts`
- `packages/platform-service/src/plugins/plugin-service.ts`
- `packages/platform-service/src/plugins/plugin-service.integration.test.ts`
- `packages/theia-control-room/src/browser/plugins-catalog-widget.tsx`
- `packages/theia-control-room/src/browser/plugins-catalog-widget.test.tsx`
- `packages/theia-control-room/src/browser/settings-widget.tsx`
- `docs/TECHNICAL_ARCHITECTURE.md`
- `docs/SKILLS_AGENTS_AND_TOOLS.md`
- `docs/PLATFORM_DESIGN.md`
- `docs/DEVELOPMENT_PLAN.md`
- `docs/STATUS.md`
- `docs/OPEN_DECISIONS.md`
- `docs/EXTENSION_COOKBOOK.md`
- `docs/reference/rpc-schemas.json`
- `docs/changes/2026-10-24-plugin-settings-upgrades.md`

#### Service-log retention and pruning

**Impact:** minor

[Permanent work record](docs/changes/2026-10-24-service-log-retention.md).

##### Summary

Make the existing platform `logs.retentionDays` setting effective for CLI diagnostic files. Prune recognized expired entries at startup, immediately after policy changes/reset/import and every minute, while preserving the existing current-file/one-rotation size policy and stderr diagnostics.

##### Details

- Previously the CLI wrote redacted `service.jsonl` diagnostics and replaced `service.1.jsonl` at roughly 5 MiB, but never used the existing retention setting. The owning CLI now applies the saved platform policy after settings load. The default remains 30 days with a minimum of one; no Project/session override, new setting, protocol method or zero/keep-forever meaning is added. Clarify the setting's UI/reference description that this controls maximum age and size rotation can replace records earlier.
- Add a service-to-owner callback for the initial effective retention value and platform setting changes, including import and reset. Embedded service instances leave process-global logging alone unless their owner explicitly opts into the callback/logger. A CLI-owned unreferenced 60-second timer prunes quiet files without depending on new writes. Signal and authenticated RPC shutdown still write the final diagnostic, dispose the logger/timer and release the process lock. Initialization failure also releases the lock, and logger disposal occurs after the top-level startup-error diagnostic is persisted.
- Scan only `service.jsonl` and `service.1.jsonl`. Remove complete recognized JSON log entries with literal string levels and canonical logger timestamps strictly older than the configured cutoff; do not coerce array/object level values into recognized levels. Preserve exact-cutoff/future entries and malformed, truncated, undated, noncanonical or invalid-UTF-8 input byte for byte. Blank/unknown records are retained. Fully expired files are unlinked; unrelated files are never selected. Unexpected files above 10 MiB or 100,000 lines are preserved with a generic stderr warning, bounding cleanup reads and line bookkeeping.
- Compact mixed files through an exclusive mode-0600 temporary file, file sync and atomic replacement after rechecking the original file identity/size/mtime. A failed replacement preserves the original and attempts temporary-file cleanup. Atomicity is per file; neither a two-file transaction nor power-loss recovery is claimed. Interrupted processes may leave a private temporary copy for stopped-service operator review. Do not automatically delete such copies by filename.
- Reject redirected log directories, symbolic links, nonregular and multiply linked files. Verify the real directory identity and opened-file identity, use no-follow opens where supported, and apply the same file checks to append and size rotation. Retain generic error messages and redacted stderr fallback. These are conservative path/accidental-change guards, not a proof against all concurrent filesystem operations by another same-user process. Normal size rotation can still supersede evidence preserved by age pruning.
- Add regression-first coverage for age selection, cutoff/future/malformed retention, unknown timestamps, byte preservation, dynamic policy, quiet periodic execution, timer disposal, hard-linked files, redirected directories and atomic replacement failure. Extend the real compiled CLI lifecycle test with a persisted 365-day policy, expired startup/rotation entries, live shortening, reset-to-default, unrelated-file preservation and normal shutdown; isolate connection-readiness retries from assertions/mutations. Add CLI startup-failure tests proving that an unsafe log directory does not leave a stale process lock and a corrupt-profile startup error is persisted before logger disposal.
- Update WP7 status, S09 in place, architecture/default records, current status and user/operator instructions. Explain configuration, maximum-age versus guaranteed-duration semantics, failure recovery, private temporary-file handling and separation from SQLite audit cleanup. Regenerate the setting reference/schema description; counts remain 204 requests and 88 built-in settings. Existing audit-retention/export work and its permanent records remain intact; broader domain/operational/accounting retention remains open.
- Compatibility/migration: no new packages, dependencies, RPC/data schemas or migrations. Profile schema remains 21 and Project schema 14. Existing CLI lifecycle/technical identifiers and two-file size rotation remain compatible. The previously unused existing setting now causes automatic logical age deletion, including its saved/default policy on startup; preserve required diagnostics before shortening it. Audit enablement is independent, and no SQLite cleanup receipt is created. SQLite rows, Project files, exports, backups and arbitrary log-directory files are outside this policy. No secure erasure is claimed.
- Minor impact reflects newly functioning compatible retention behavior. Keep version 0.22.0 pending; no packaging, installer, tag or publication is prepared.

##### Validation

- `npm test -w @gamecrafter/platform-service -- src/logger.test.ts` first failed four new cases while the original persistence/size-rotation case passed, reproducing the missing retention hook and redirected-directory acceptance. Evidence: `.turbo/service-log-retention-red.log`.
- Focused logger/compiled CLI suites passed ten tests in two files after implementation. The atomic-replacement probe initially failed because its filesystem spy did not intercept an ESM builtin binding; corrected the test mock and verified original-byte preservation plus temporary cleanup without changing the assertion. Evidence: `.turbo/service-log-retention-final-focused.log` (ten passing tests), with earlier lifecycle checks in `.turbo/service-log-retention-lifecycle-final.log`. A final regression reproduced coercion of an array-shaped log level into a recognized value; require a literal string level and preserve that unknown record shape. Red evidence: `.turbo/service-log-retention-unknown-shape-red.log`; the final focused suite passed afterward.
- Native acceptance against the compiled CLI and a disposable profile passed six checks: saved-policy startup pruning, live shortening, reset to the default, real quiet-file periodic pruning, preservation of unrelated files/SQLite model-usage sentinel, and clean shutdown. Native acceptance has been repeated during implementation with real intervals of approximately 60 seconds; the final report records its exact elapsed time. Both managed files lost expired entries and retained fresh ones, using entry timestamps rather than file modification times. Evidence: `.turbo/service-log-retention-native/report.json` and `.turbo/service-log-retention-native.log`. The isolated daemon reports not running and its lock is removed; no ordinary profile or Project was modified.
- The complete `npx turbo run build typecheck lint test --concurrency=1` attempt did not produce a complete passing report: the existing native Windows opener fixture failed in temporary-directory cleanup and worker/tool entry files disappeared, followed by worker termination. Earlier preparation runs were interrupted and are not counted as passing gates. See [the separate investigation/recovery record](docs/changes/2026-10-24-native-opener-fixture-cleanup.md); no antivirus-setting change or test assertion weakening is retained.
- After verified local-tool restoration and forced service-output rebuilding, `npx turbo run build typecheck lint --concurrency=1` passed 25 tasks (17 cached), including Electron/browser application builds; `npx turbo run test --concurrency=1 --filter='!@gamecrafter/platform-service'` passed 14 tasks (12 cached). App-shell lint/typecheck/test placeholders still report skip. The service suite with only `--exclude src/assets/external-open.windows.test.ts` passed 730 tests / 6 skipped across 133 files in 593.38 seconds. Together with other workspaces, 966 tests passed / 7 skipped across 190 files, with one existing native Windows opener test explicitly excluded. This does not establish a complete full-gate pass. Evidence: `.turbo/service-log-retention-service-verified.log`, `.turbo/service-log-retention-build-quality.log` and `.turbo/service-log-retention-other-tests-verified.log`.
- Generated-reference/inventory freshness (204 requests, 88 settings), documentation evidence integrity, release-version agreement, Markdown links, formatting, whitespace and changelog coverage checks passed. The user later supplied the Bitdefender behavioral-block notice and restart requirement (`SuspiciousBehavior.567DCD8166FD2594`); preserve the full-gate limitation and stop further native-opener runs/recovery until the event is reviewed. No antivirus setting changes or device restart were performed.
- No frontend code changed; the existing Settings control is covered through its authenticated settings RPC and real CLI owner rather than new browser acceptance. No new live provider/engine/DCC workflow, packaged desktop/installer, power-loss drill, large-history qualification or production acceptance is claimed. Existing full-suite integration evidence must be distinguished from qualification of this feature.

##### Files

- `packages/platform-service/src/logger.ts`
- `packages/platform-service/src/logger.test.ts`
- `packages/platform-service/src/cli.ts`
- `packages/platform-service/src/cli.test.ts`
- `packages/platform-service/src/service.ts`
- `packages/platform-service/src/settings/definitions.ts`
- `docs/TECHNICAL_ARCHITECTURE.md`
- `docs/DEVELOPMENT_PLAN.md`
- `docs/STATUS.md`
- `docs/OPEN_DECISIONS.md`
- `docs/PLATFORM_DESIGN.md`
- `docs/OPERATIONS_GUIDE.md`
- `docs/CONTROL_ROOM_HANDBOOK.md`
- `docs/USER_GUIDE.md`
- `docs/SETTINGS_REFERENCE.md`
- `docs/reference/settings-schemas.json`
- `docs/changes/2026-10-24-service-log-retention.md`

#### Non-destructive SQLite diagnostics and migration compatibility guards

**Impact:** minor

[Permanent work record](docs/changes/2026-10-25-sqlite-health-diagnostics.md).

##### Summary

Add an explicit-file database doctor and reject incompatible migration history before migration/profile-snapshot writes. This completes a bounded W05 diagnostic feature following audit/log retention, while leaving broader recovery and extra ledger deletion open.

##### Details

- Review the authoritative dependency plan and the user's [PlayWeld Features Project](https://github.com/users/scarecr0w12/projects/5). Select W05 diagnostics as a prerequisite for safer recovery/cleanup work, rather than silently settling product-owned signing/spending policies. The matching combined card is **Complete remaining domain-ledger retention and corruption recovery** (W05/S09); change its Status from To do to In progress. Its broader recovery and deletion criteria are not complete and it must not be marked Done solely for this slice. Preserve all planning fields/assessments and unrelated cards; final task readback is recorded under Validation.
- Work in `codex/sqlite-health-diagnostics`, isolated from the shared checkout's concurrent Project inventory/prioritization records and generated changelog. Install the exact existing lockfile in that worktree with no dependency/version changes. Keep the flagged temporary opener executable untouched and Bitdefender enabled; no exclusions or quarantine operations are performed.
- Add `gamecrafter-service doctor --database <absolute-path> --kind <profile|project>`. Both explicit flags are required in either order; unknown/duplicate/incomplete flags, relative paths and repair requests fail usage validation. It never selects a default profile or starts the daemon. Lazy-load the service backend only for foreground startup so a diagnostic does not load the entire provider/worker stack. Existing start/stop/status behavior retains its lifecycle tests.
- Emit schemaVersion 1 JSON with selected kind, UTC check time, current/latest migration versions when readable, check outcomes and fixed guidance. Do not print the filesystem path, record values, migration names or raw SQLite errors. Exit 0 means healthy or recognized upgrade-required; exit 1 means an unhealthy/unavailable diagnostic; exit 2 means invalid invocation. Missing files/parents are never created. Unexpected empty files are uninitialized, not healthy or permission to initialize. Lock/access/I/O failures remain unavailable, separate from structural/foreign-key failures and schema incompatibility.
- Extend the single SQLite seam with read-only open authority that cannot create a missing file and skips journal-mode changes; close partially initialized handles on setup failure. In one read transaction, check `integrity_check(1)`, foreign keys, the known migration prefix and profile/Project core-table markers. A foreign-key failure is reported separately from physical integrity damage. Preserve the database and authored values; no migration, repair, checkpoint, reset, deletion, salvage or archive extraction is performed by the doctor. Read-only SQL authority does not promise immutable coordination files: SQLite can create/update WAL shared-memory files. Document the [SQLite WAL boundary](https://www.sqlite.org/wal.html#read_only_databases), preservation of database/WAL/journal files, stopped-owner recovery copies and potentially expensive whole-file scans.
- Previously, migration code could accept future IDs, apply an earlier missing migration before finding a later history mismatch, and create PlayWeld metadata in an unrelated existing database. Validate the entire bounded applied prefix before metadata creation/migration SQL, and before profile snapshot creation/pruning. Reject future, gapped, renamed or unrelated history with fixed compatibility guidance. Keep valid older forward upgrades and idempotence. Profile bootstrap now closes the database if preflight/snapshot/migration fails; existing Project failure handling already closes its handle. This does not add automatic Project pre-migration snapshots or multi-migration transaction rollback.
- Final candidate review found a remaining unknown-schema edge: an empty migration table beside authored objects could still look like a fresh store. A regression reproduced that candidate behavior; reject it before initialization and report incompatible from the doctor, preserving authored records. An actually empty database or history table without other objects remains eligible for normal first initialization. Add both migration-write prevention and doctor byte-preservation regressions, without changing the report format or widening recovery authority.
- Add behavioral regressions for write rejection/journal preservation, missing-file noncreation, future/gapped/name-mismatched/unrelated schemas, no partial migration writes, snapshot preservation, healthy/old/wrong-kind/malformed/corrupt/empty/locked stores, foreign-key failures, committed WAL reads and redacted reports. A disposable known-good snapshot is copied to an independent destination and its sentinel read while the corrupt original remains unchanged. A real failed profile bootstrap must release its handle so Windows can rename the preserved file. Compiled CLI tests verify JSON/exit codes, byte preservation and absence of implicit profile creation. No production profile or Project is opened.
- Update repository/CLI guidance, recovery/operations/developer instructions, the selected architecture default, W05 in place, WP2 and current status. Regenerate source inventory artifacts so new regression paths are discoverable. Do not change confirmed product requirements or mark the whole W05/S09 card complete. A healthy diagnostic is not exhaustive application-schema semantics, backup authenticity, credential recovery, automatic index rebuilding, in-place repair or a proven disaster-recovery lifecycle.
- Compatibility/migration: additive CLI/report API and safety rejection of unsupported migration histories; no RPC, persisted data schema, settings, dependency or database-version migration. Profile/Project migration targets remain 21/14; report schemaVersion is 1. Existing valid database upgrades retain behavior; previously tolerated future/unrecognized histories now fail closed. Impact minor reflects the compatible operator feature. Product version remains 0.22.0 pending; no installer, tag or release is prepared.

##### Validation

- Clean worktree `npm ci --foreground-scripts` passed with zero audit vulnerabilities and both retained local patches applied. No lockfile/dependency change. Evidence: `.turbo/sqlite-health-install.log` in the shared repository's ignored evidence directory.
- Seam regressions first failed five new cases while four existing cases passed, reproducing writes/missing-file creation and unsafe migration acceptance. The corrected seam/migrator/snapshot/profile suites then passed 15 tests across three files. Evidence: `.turbo/sqlite-health-seam-red.log` and `.turbo/sqlite-health-seam-green.log`.
- The compiled CLI doctor regression first failed eight cases against the old command/usage. The first build of the lazy backend import required the explicit compiled `.js` extension under Node16 resolution; correct it before rerunning. Four doctor/seam/snapshot files then passed 28 tests. Eight focused database/CLI/profile/backup files passed 40 tests after adding bootstrap/snapshot regressions, before the additional malformed-metadata case. Evidence: `.turbo/sqlite-health-cli-red.log`, `.turbo/sqlite-health-doctor-green.log` and `.turbo/sqlite-health-focused.log`.
- Installed Node 24.19.0 and pinned Node type definitions confirm read-only open support; actual fixtures prove the exercised behavior. Consult SQLite's primary [integrity/foreign-key documentation](https://www.sqlite.org/pragma.html#pragma_integrity_check) and [WAL documentation](https://www.sqlite.org/wal.html#read_only_databases). Latest Node web documentation resolved to a different major, and the v24 alias fetch was unavailable, so it is not used as proof of this checkout's behavior.
- Final `npx turbo run build typecheck lint --concurrency=1` passed 25 tasks (17 cached), including Electron/browser builds, after the completed source. The existing installer-handoff require-resolution warning remains. Other workspace tests passed 14 tasks (12 cached), accounting for 236 passes/one skip across 57 files. App-shell placeholder checks remain placeholders. Evidence: `.turbo/sqlite-health-final-quality.log` and `.turbo/sqlite-health-other-tests.log`.
- The broad service command with explicit `--exclude src/updates/installer-handoff.test.ts --exclude src/dcc/blender-real.test.ts` passed 748 tests/14 skips across 134 files (133 passing files and one skipped file) in 472.03 seconds. Primary aggregate is 984 passes/15 skips across 191 files, including cached results. No test assertion or timeout was weakened. Native opener/installer fixture execution and live Blender operation remain excluded locally under the existing endpoint-protection/evidence boundary; the retired opener is absent. This is not an unexcluded full-gate pass. Evidence: `.turbo/sqlite-health-service-tests.log`.
- Additional capability skips in the isolated checkout prompted a focused plugin-service lifecycle rerun rather than being silently treated as passes. That rerun passed seven tests with one explicitly Linux-only skip, exercising native workers, settings upgrades, secrets, usage and restart behavior without changing tests. The native Qdrant binary is absent in this checkout, so its native fixture remains unavailable. The broad run's original skip count is retained rather than retroactively rewritten. Evidence: `.turbo/sqlite-health-plugin-followup.log`.
- A standalone compiled-CLI acceptance on disposable synthetic files passed eight checks: healthy, known older, future/incompatible, corrupt and missing reports with expected exit codes/byte preservation; independent snapshot recovery retaining its authored sentinel and corrupt original; and no implicit profile/daemon files. Evidence: `.turbo/sqlite-health-native-TnvBqD/report.json` and `.turbo/sqlite-health-native.log`. The first harness attempt reached the sentinel check but incorrectly compared a SQLite null-prototype row to a plain object; compare the actual sentinel value with the same expected value and rerun, retaining the first fixture. No application fix or weakened data-preservation requirement was involved. This is a SQLite snapshot-copy drill, not a new encrypted archive/lifecycle qualification.
- Generated RPC/settings references remained fresh (204 requests, 88 settings); regenerated inventory and documentation-evidence integrity passed (27 RPC families/subsystems). Thirteen change-tracking tests, repository formatting, release-version agreement, whitespace, changelog generation/coverage and Markdown links passed. No package/lockfile diff is present.
- Commit and push implementation `7ee03dc6bc580bd09d64950023ff8961c7bea824` on `codex/sqlite-health-diagnostics`. Update the matching Project draft with the immutable implementation commit, branch work record/runbook, completed scope, exact local validation and remaining boundaries; align its inventory-status line with the actual In progress field. Authoritative readback confirmed the exact expected body, all 58 items retained, unchanged target planning fields/assessment and unchanged other cards. The combined W05/S09 card remains In progress because its broader recovery/deletion criteria are not complete. The GitHub connector has no Project endpoints, so use the authenticated CLI/GraphQL API for these explicitly authorized Project edits. Local receipts are `.turbo/sqlite-health-project-current.json`, `.turbo/sqlite-health-project-update.json` and `.turbo/sqlite-health-project-after.json`.
- The additional empty-history/authored-data regression failed on the initial pushed candidate because it did not reject initialization (`.turbo/sqlite-health-empty-history-red.log`). The corrected guard passed 45 tests across the eight focused database/CLI/profile/backup files and all 25 build/typecheck/lint tasks (17 cached). A repeated compiled-CLI acceptance with the added incompatible-empty-history case passed nine checks (`.turbo/sqlite-health-native-TexRX7/report.json`). Doctor test children are hidden on Windows; assertions/exit expectations remain unchanged. Evidence: `.turbo/sqlite-health-final-guard-tests.log` and `.turbo/sqlite-health-final-edge-quality.log`. Temporarily mark PR 17 draft while correcting this known gap, then publish and qualify the final head. Those results supersede the earlier candidate for release qualification; retain earlier broad-run counts as dated evidence rather than labeling them a pass of later source. Final hosted results are retained in PR 17's head-specific check timeline.
- No fresh installed application, publisher trust, live engine/DCC/provider, power-loss or large-history acceptance is claimed. Automatic repair, full semantic validation, corruption-aware index rebuilding, broader recovery and extra ledger deletion remain open on the combined card. Version stays 0.22.0 pending; no release is prepared.

##### Files

- `AGENTS.md`
- `packages/platform-service/src/cli.ts`
- `packages/platform-service/src/db/database.ts`
- `packages/platform-service/src/db/database.test.ts`
- `packages/platform-service/src/db/migrator.ts`
- `packages/platform-service/src/db/migration-snapshot.ts`
- `packages/platform-service/src/db/migration-snapshot.test.ts`
- `packages/platform-service/src/db/database-health.ts`
- `packages/platform-service/src/db/database-health.test.ts`
- `packages/platform-service/src/db/database-health-cli.test.ts`
- `packages/platform-service/src/db/migration-compatibility.integration.test.ts`
- `packages/platform-service/src/service.ts`
- `docs/DEVELOPMENT_PLAN.md`
- `docs/OPEN_DECISIONS.md`
- `docs/STATUS.md`
- `docs/TECHNICAL_ARCHITECTURE.md`
- `docs/RECOVERY_RUNBOOK.md`
- `docs/OPERATIONS_GUIDE.md`
- `docs/DEVELOPER_GUIDE.md`
- `docs/reference/DOCUMENTATION_INVENTORY.md`
- `docs/reference/documentation-inventory.json`
- `docs/changes/2026-10-25-sqlite-health-diagnostics.md`

#### Verify and retain Project recovery snapshots before schema upgrades

**Impact:** minor

[Permanent work record](docs/changes/2026-10-26-project-migration-snapshots.md).

##### Summary

Existing registered Project databases now retain a fresh, verified old-schema SQLite snapshot before forward migration. Failure to create or verify that recovery file stops the upgrade instead of proceeding without recovery evidence.

##### Details

- Previously only the profile startup path took pre-migration snapshots. `ProjectDatabases.get` now invokes a Project-specific guard before migration or Project metadata writes. The guard validates recognized migration history and matching registered Project identity, skips new/current stores, and snapshots only an existing older Project. Incompatible history or identity stops before recovery-file creation. Existing handle cleanup prevents failed upgrades from entering the database cache or retaining an open failed-bootstrap handle.
- The database seam's `VACUUM INTO` captures committed WAL state into a unique `.gamecrafter/pre-migration/project-v<old>-to-v<target>-<uuid>.sqlite.partial` file. The helper restricts file mode where supported, flushes the file with a non-truncating writable handle, opens it read-only, and checks integrity, foreign keys, recognized old migration version and Project identity. Only a verified closed file is renamed to its published `.sqlite` name before migration starts. Ordinary Windows ACLs remain authoritative; this is not an encryption or physical-disk durability guarantee.
- Every attempt uses a fresh name. Earlier snapshots are neither reused nor pruned, including when later migration SQL fails. A retry captures any intervening old-schema changes while retaining prior evidence byte-for-byte. Individual migration transaction behavior is unchanged; successful earlier migrations in a multi-step attempt are not automatically rolled back as a group. A target version in the filename describes intent, not completed migration.
- On snapshot failure only that attempt's temporary file receives best-effort cleanup; prior recovery evidence is retained. Unhandled shutdown can leave an unpublished partial file, which is never automatically selected or reused. Snapshot-directory symlinks/junctions and conflicting or redirected ignore metadata stop the upgrade rather than being followed or overwritten. The directory's canonical ignore file protects already-registered Projects before their root ignore rules are refreshed; these are local filesystem boundary checks, not a race-proof sandbox against concurrent hostile writers.
- New/opened Project ignore rules exclude `.gamecrafter/pre-migration/`. Clone omits the source recovery directory so historical databases with source identity are not copied into the new identity. Clone still snapshots the live source database consistently into its disposable target, and leaves source recovery evidence intact. Existing encrypted whole-Project backups retain their file-selection behavior, including recovery files; no archive/exclusion policy or automatic restore selection changed.
- The architecture, W05 register status, WP2/WP3 plan and status record now distinguish Project snapshots from the unchanged profile snapshot policy, scoped lexical-index recovery and broader open corruption/retention work. The runbook explains file selection, independent doctor inspection, partial-file handling, local plaintext data, disk-use/retention boundaries, identity/revision checks, and the need for game/canon files and verified encrypted backups. Generated documentation inventories include the new Project database test surface.
- Tests demonstrate old-schema state and event preservation, committed WAL capture, fresh retry evidence after a real migration failure, no snapshots for new/current stores, failed creation/verification, foreign-key-invalid snapshots, wrong identity, future history, redirected directories and conflicting ignore rules. Existing workspace tests also prove Git exclusion and source-to-clone exclusion alongside independent chat/settings/task history. Compiled service modules and the CLI doctor are exercised separately on an isolated synthetic recovery fixture.
- During development, the expected missing-snapshot tests failed on unchanged code. The first implementation then exposed Windows `fsync` rejecting a read-only descriptor with EPERM. A temporary fixture-only diagnostic trace identified that call and was removed; the helper now flushes its own file through `r+`, without truncating data or dropping the flush. Assertions and timeouts were not weakened.
- Compatibility and migration: no dependency, RPC method/schema, setting, archive-format or database migration change. Profile/Project schema targets remain 21/14 and product version remains 0.22.0 pending. Minor impact records compatible new automatic recovery functionality. New/current stores and existing profile snapshot naming/retention remain unchanged. Snapshot retention/deletion, general database salvage/quarantine, board/vector recovery, whole-upgrade rollback, in-place restore, signing, installed-product and broad disaster-recovery qualification remain open. The matching W05/S09 Features card remains In progress for that broader scope.

##### Validation

- Red: `npm test -w @gamecrafter/platform-service -- src/projects/project-databases.test.ts` failed both original assertions: no snapshot was created, and a blocked recovery directory did not stop migration. Evidence: primary-checkout `.turbo/project-migration-red.log`.
- Green/focused: `npm test -w @gamecrafter/platform-service -- src/projects src/db src/backup/backup-service.integration.test.ts` passed 53 tests across eight files. Includes native Windows filesystem/SQLite/Git fixtures and real local backup/restore integration, not an installed application or remote backup-provider claim. Evidence: `.turbo/project-migration-focused.log`.
- `npx turbo run build typecheck lint --concurrency=1` passed all 25 tasks, 17 cached, including desktop/browser builds. `npx turbo run build typecheck lint test --filter=!@gamecrafter/platform-service --concurrency=1` passed all 30 tasks, 28 cached. Evidence: `.turbo/project-migration-quality.log` and `.turbo/project-migration-other-quality.log`.
- `node .turbo/project-migration-acceptance.cjs` in the primary checkout passed four compiled-module/CLI checks: upgrade reaches v14, doctor reads the published v13 snapshot as upgrade-required, identity/authored sentinel survive, and an independent recovery copy passes doctor while the published snapshot hash remains unchanged. Report: `.turbo/project-migration-acceptance-v9jkwB/report.json`; log: `.turbo/project-migration-acceptance.log`. The synthetic fixture is separate from ordinary profiles and Projects.
- `npm test -w @gamecrafter/platform-service -- --exclude src/updates/installer-handoff.test.ts --exclude src/dcc/blender-real.test.ts`: 777 passed/8 skipped across 135 files (134 passed/one skipped), 385.35 seconds. Evidence: `.turbo/project-migration-service-tests.log` in the primary checkout. Production code was unchanged after this run started; the final focused run separately passed all 53 tests after handle-release and clone-source-preservation assertions were extended (`.turbo/project-migration-focused-final.log`).
- Final service typecheck/lint passed after those assertions were extended. `npm run format:check`, `bash scripts/check-links.sh` (All links OK), generated RPC/settings and documentation inventory checks, documentation evidence integrity, release-version agreement (0.22.0), whitespace and `npm run changelog:check -- --base origin/main` passed. Evidence: `.turbo/project-migration-format.log` and `.turbo/project-migration-links.log`. Existing lockfile/dependencies were reused in the isolated owned worktree; no dependency installation or update was needed. Hosted checks are separate and have not yet run on this candidate.
- The broad local service run explicitly excludes `src/updates/installer-handoff.test.ts` and `src/dcc/blender-real.test.ts` to preserve the established endpoint-protection/native-fixture and external-application boundaries. Hosted CI uses the normal unexcluded commands. No antivirus exclusions, quarantine changes, flagged-executable operations, installed-product recovery, new installer/release, live provider/engine/DCC actions or remote backup calls were performed.

##### Files

- `packages/platform-service/src/db/migration-snapshot.ts`
- `packages/platform-service/src/projects/project-databases.ts`
- `packages/platform-service/src/projects/project-databases.test.ts`
- `packages/platform-service/src/projects/workspace.ts`
- `packages/platform-service/src/projects/workspace.test.ts`
- `docs/TECHNICAL_ARCHITECTURE.md`
- `docs/RECOVERY_RUNBOOK.md`
- `docs/DEVELOPMENT_PLAN.md`
- `docs/OPEN_DECISIONS.md`
- `docs/STATUS.md`
- `docs/reference/DOCUMENTATION_INVENTORY.md`
- `docs/reference/documentation-inventory.json`
- `docs/changes/2026-10-26-project-migration-snapshots.md`
- `CHANGELOG.md`

### Fixed

#### Keep Models tables and discovery controls readable in narrow views

**Impact:** patch

[Permanent work record](docs/changes/2026-10-18-models-narrow-layout-fix.md).

##### Summary

Preserve readable Models table columns in narrow desktop views, contain scrolling within accessible table regions, and bound long model-discovery lists.

##### Details

- Previously the provider table compressed descriptive columns around the discovery actions. A real native Electron reproduction at a 360-pixel viewport measured the provider-kind column at 27 pixels and a 24-model chooser at approximately 38,000 pixels tall. Long labels wrapped into fragments, making account details and actions difficult to read.
- Give Models tables a readable minimum width and provider columns dedicated minimum widths. Keep horizontal overflow inside labelled, focusable scroll regions for the provider and model tables, with a visible keyboard-focus outline. Constrain the Models root to its actual width, preserve normal word wrapping in cells, and allow long provider URLs to wrap. Keep the table structure and native form controls intact.
- Bound the discovery fieldset to 22rem with its own scrolling and contained overscroll. Space account action buttons and display their status on a separate line so long discovery results no longer create an unbounded table row. Model enabling, pricing, capability and routing behavior are unchanged. No storage or RPC migration, dependency change, or version bump is required while these fixes remain pending.
- Add a shared real-renderer layout regression to the existing browser/Electron smoke test. It creates an isolated local fake provider with 24 long model IDs, checks account tables at 360/640/800/1280 pixels and model rows at 360/800/1280 pixels, verifies readable column width, contained overflow, bounded discovery height, labelled keyboard scrolling, native selection, and expanded editors. It restores the viewport, removes its owned provider and closes the fixture server.
- The longer smoke run exposed an existing hierarchy-rendering fixture race: a model-backed root could fail before its child was attached. Gate the owned disposable Project's capacity with a cancellable noop task while creating and inspecting the hierarchy. Cancel the request tree and gate task and remove the temporary concurrency override afterward. Production task policy is preserved.

##### Validation

- The new layout check failed against the original source-built Electron application with the measured 27-pixel column and unbounded chooser. After the CSS/markup correction, all narrow layout assertions passed in the real native renderer.
- The first otherwise-green layout run then exposed the hierarchy fixture race. After adding the owned gate, an initial setup retry detected a missing required goal in that fixture; adding it completed a full native smoke with 30 checks and zero renderer errors. The final checker additionally enabled a model through the chooser at 360 pixels and expanded the capability/pricing editors; the complete native smoke again passed 30 checks with zero renderer errors: `.artifacts/documentation-electron/1792387685039/smoke/report.json`. Manual inspection confirmed readable discovery controls and bounded scrolling in the captured native view.
- Full repository quality passed all 33 tasks (21 cache hits) in 7m38.842s, including both app builds: 888 tests passed and seven skipped. Formatting, changelog coverage, version consistency, generated references/inventory, documentation evidence, whitespace and Markdown links passed.
- The final shared checker also passed in the source-built development browser: 33 full smoke checks and zero renderer errors, including the viewport, selection and expanded-editor assertions. Evidence: `.artifacts/windows-swarm-models-fixes/browser/smoke/report.json` and `browser-smoke.log` in its parent evidence directory. Both native and browser runners cleaned up their owned processes and isolated service.
- Hosted CI run `39205402424` passed Windows quality, Linux quality and browser build/live UI smoke on fix commit `05368eab2f6392942dc673235edd3c63a064085c`. Downloaded browser evidence confirms 33 checks passed, zero renderer errors and execution of the new Models layout regression: `.artifacts/windows-swarm-models-fixes/hosted-browser/report.json`. The later verification-record update changes only Markdown and preserves the tested application, CSS and smoke-check source.
- Initial red evidence: `.artifacts/windows-swarm-models-fixes/models-layout-red.log`. Subsequent failures/retries remain in that directory. Successful initial complete native run: `.artifacts/documentation-electron/1792387609482/smoke/report.json`, including account/model screenshots at the tested widths.
- Acceptance uses source-built applications, disposable profiles/Projects and a fake local provider. Ordinary projects, settings, installed 0.22.0 files and paid provider accounts are not modified. Installer, installed-upgrade, paid-provider, engine and complete accessibility acceptance are outside this change.

##### Files

- `packages/theia-control-room/src/browser/models-widget.tsx`
- `packages/theia-control-room/src/browser/style/index.css`
- `scripts/models-layout-check.cjs`
- `scripts/live-ui-smoke.cjs`
- `docs/changes/2026-10-18-models-narrow-layout-fix.md`

#### Recover inconsistent knowledge lexical indexes during full reconciliation

**Impact:** patch

[Permanent work record](docs/changes/2026-10-25-knowledge-lexical-index-recovery.md).

##### Summary

Full knowledge rebuild/reconciliation now recovers inconsistent FTS entries from retained chunk content, rather than reporting success while unchanged documents remain absent from lexical search.

##### Details

- Before this correction, source fingerprints caused unchanged files to be skipped even when their external-content FTS entries were lost. The knowledge store now checks FTS consistency against its chunk table, rebuilds only on SQLite's FTS-specific `SQLITE_CORRUPT_VTAB` result, and verifies the rebuilt index in the same immediate transaction. A failed rebuild/final verification rolls back. Lock/I/O/general-corruption errors propagate without attempting a rebuild; missing tables and triggers are not recreated.
- Full rebuild and reconciliation run that check before source mutations, preventing stale FTS deletion triggers from blocking ordinary source reconciliation. Healthy indexes do not rebuild, and incremental watcher runs do not perform this scan. The operation repairs only lexical index state; authored files, canon records, existing chunk rows, task/event history, embedding profiles and vector mappings are not reset or deleted by the repair.
- A requested full rebuild could previously reuse an active incremental-only task. Task deduplication now requires an active full request to satisfy a new full request. If a full indexer call encounters another active run, it waits and then performs a full check, preserving the requested recovery operation.
- Indexing tool results include `lexicalIndexRebuilt`; actual repair reports `noOp: false` and advances the full-reconcile timestamp. The task's persisted summary explicitly states that the lexical search index was rebuilt. Healthy unchanged reconciliations retain no-op behavior.
- Tests reproduce missing search hits through a real local service/client and supervised task, require the full task input, verify search recovery, unchanged source/chunk content and retained prior events/tasks, and exercise subsequent incremental/full requests. Store fixtures verify consistency repair, stable metadata/content, later update triggers, repeat no-op behavior, rollback of a post-rebuild failure, and refusal to rebuild on SQLite lock/locked/I/O/general-corrupt/not-a-database errors. Injected failure cases are transaction/control-flow evidence, not physical disk-fault qualification.
- The architecture and recovery runbook describe the write authority, task-result evidence, operator backup/preservation steps and supported FTS-only boundary, with links to SQLite's primary FTS5 documentation. Plan, status and W05/R04 register entries reflect this bounded completion without closing broader W05/S09 recovery or retention. The matching Features Project card retains the broader In progress scope; implementation and verification notes link the committed candidate and PR. Original assessment/priority/effort fields and unrelated cards are preserved.
- Compatibility: no dependency, RPC method/record schema, setting or migration change; profile/Project migration targets remain 21/14 and no migration is required. The additive generic indexing-tool result field uses the existing tool-result envelope. Product version remains 0.22.0 pending. Patch impact corrects existing full-rebuild behavior rather than introducing a new operator API.
- Limits: general database repair/quarantine, missing schemas/triggers, board FTS, corrupt chunk/canon content, vector-backend recovery, additional ledger deletion, large-history performance, installed desktop and release qualification remain open. Read-only doctor semantics are unchanged. Existing shared-checkout inventory/prioritization work and the flagged native opener executable are untouched; endpoint protection remains enabled.

##### Validation

- Red reproduction: `npm test -w @gamecrafter/platform-service -- src/knowledge/knowledge.integration.test.ts -t "recovers lost lexical"` failed because a completed full rebuild returned no `docs/recovery.md` search hit. An added task-input assertion then independently exposed the full request being replaced by `full: false`; both paths pass after correction. A preservation assertion initially used `stateHash`, which includes the deliberately updated full-reconcile timestamp; it was corrected to compare actual retained chunk rows, with whole-store hash preservation checked separately at the store seam.
- `npm test -w @gamecrafter/platform-service -- src/knowledge/knowledge-store.test.ts src/knowledge/knowledge.integration.test.ts`: 17 tests passed across two files, including the real local RPC/task recovery fixture, persisted repair/no-op audit evidence, orphan-entry repair, missing-table preservation and injected rollback/failure cases.
- `npx turbo run build typecheck lint --concurrency=1`: 25 tasks passed, 17 cached, including desktop/browser builds; existing bundler require.resolve warning retained.
- `npx turbo run build typecheck lint test --filter=!@gamecrafter/platform-service --concurrency=1`: 30 tasks passed, 28 cached. Service build/typecheck/lint were checked separately; service tests are recorded separately below.
- Final service typecheck/lint passed after test assertions were extended. `npm run test:changes` passed 13 tests; generated RPC/settings and documentation inventories, documentation evidence, version agreement (0.22.0), formatting, whitespace and changelog coverage checks passed. `bash scripts/check-links.sh` reported All links OK.
- `npm test -w @gamecrafter/platform-service -- --exclude src/updates/installer-handoff.test.ts --exclude src/dcc/blender-real.test.ts`: 765 passed/8 skipped across 134 files (133 passed/one skipped), 392.53 seconds. Logs: `.turbo/knowledge-recovery-service-tests.log`, `.turbo/knowledge-recovery-focused-final.log`, `.turbo/knowledge-recovery-quality.log`, `.turbo/knowledge-recovery-other-quality.log`, `.turbo/knowledge-recovery-format.log` and `.turbo/knowledge-recovery-links.log` in the primary checkout. A subsequent focused run includes all final audit/no-op and missing-table assertions; no production code changed after the broad run started.
- Native installer executable fixtures and live Blender tests are excluded from the local broad service run to retain the existing endpoint-protection/external-application boundary. Hosted checks will use normal unexcluded CI commands. No antivirus exclusions, quarantine changes, live providers/engines, installer or installed-product recovery checks were performed.

##### Files

- `packages/platform-service/src/knowledge/knowledge-store.ts`
- `packages/platform-service/src/knowledge/knowledge-store.test.ts`
- `packages/platform-service/src/knowledge/knowledge-indexer.ts`
- `packages/platform-service/src/knowledge/knowledge-service.ts`
- `packages/platform-service/src/knowledge/knowledge.integration.test.ts`
- `docs/TECHNICAL_ARCHITECTURE.md`
- `docs/RECOVERY_RUNBOOK.md`
- `docs/DEVELOPMENT_PLAN.md`
- `docs/OPEN_DECISIONS.md`
- `docs/STATUS.md`
- `docs/changes/2026-10-25-knowledge-lexical-index-recovery.md`
- `CHANGELOG.md`

#### Preserve MCP tool-cache invalidation during concurrent discovery

**Impact:** patch

[Permanent work record](docs/changes/2026-10-26-mcp-tool-discovery-race.md).

##### Summary

Prevent an in-flight MCP tool listing from restoring obsolete tools after a tool-change notification or event-stream closure invalidates discovery. This is a bounded correctness slice of the Features Project's Q01 concurrent-suite timing card; its broader qualification remains open.

##### Details

- Current main `3b35deb` could return an obsolete listing after invalidation while another discovery request returned newer tools. The obsolete response could also overwrite the session cache and reach the connection manager's broker registration. Deterministic tests control transport responses and reproduce both notification and stream-close orderings without sleeps or changed timeouts.
- Concurrent discovery callers now share in-flight responses with their originating generation. Each caller checks that generation after awaiting the response and before parsing, caching or publication, including invalidation during promise settlement. Discovery retries a changed generation, with at most three response attempts per caller; repeated changes fail with an actionable retry error instead of unbounded requests. Disconnect also invalidates the generation, and a post-response connection check prevents publication after disconnection.
- Preserve deterministic tool sorting, TTL behavior, force-refresh entry points, separate returned snapshots, notification callbacks and existing protocol negotiation. Failed requests, malformed responses and repeated invalidation release the shared request so later discovery can succeed. Added focused tests cover these recovery cases and bound actual request counts.
- Inspected the canonical board, current main and recent PRs before selecting this task. PRs 15–19 are merged; the shared checkout retains unrelated planning records and an SDK worktree exists. This change uses a separate worktree and leaves those files, security/qualification work and Requested feature proposals untouched. The board-search recovery lead requires a separately scoped operator workflow and is not implemented here. This discovered MCP ordering defect is not asserted to explain every historical timing observation.
- Published [draft PR 20](https://github.com/scarecr0w12/PlayWeld/pull/20) on `codex/mcp-tool-discovery-race` and marked only its Q01 timing card In progress with a bounded implementation/evidence note. Preserve every other board card and the selected card's priority, size, estimate, risk and planning fields. Its broader acceptance criteria remain open. Exact-head hosted checks and their final disposition are tracked on that draft PR; no hosted pass is inferred from local results.
- Compatibility and migration: compatible internal service fix; no dependency, RPC, persisted schema, setting or migration changes. No migration required. Product version remains 0.22.0 pending; patch impact reflects corrected discovery behavior. No release, deployment or merge is part of this task.

##### Validation

- Initial regression on unchanged runtime code: `npm test -w @gamecrafter/platform-service -- src/mcp/session.test.ts` discovered 27 tests, with both new ordering cases failing and 25 existing tests passing. Both failures returned `obsolete` where the current tool list was required.
- Separate standards and spec reviews both identified a further promise-settlement window in the first correction. A queued-notification regression reproduced it (one failure, 30 passes). Moving generation validation to each awaiting caller resolved the finding; both reviewers confirmed no remaining concrete in-scope findings. The final focused suite passed all 31 tests. Transport fixtures establish source-level behavior, not community-server or live-engine acceptance.
- Final concurrent MCP/worker verification: `node ../../node_modules/vitest/vitest.mjs run src/mcp src/workers/supervisor.test.ts src/workers/supervisor-await.test.ts --maxWorkers=4 --testTimeout=30000 --hookTimeout=60000` from the service package passed 83 tests across 16 files. No test timeout or existing assertion was increased or weakened. An initial npm-script invocation supplied duplicate worker flags and did not discover tests; the direct invocation above supplies the worker count once.
- Final aggregate `npx turbo run build typecheck lint --concurrency=1` passed all 25 tasks, 17 cached, including browser and Electron builds. Other workspace tests passed all 14 Turbo tasks, ten cached: 236 tests passed and one skipped across 57 files. Electron's test script remains an explicit skip; app builds do not establish rendered acceptance. Existing installer-handoff require-resolution and JSX-transform warnings remain.
- Final broad service command `npm test -w @gamecrafter/platform-service -- --exclude=src/updates/installer-handoff.test.ts --exclude=src/dcc/blender-real.test.ts` passed 783 tests with eight skips across 135 files (134 passed, one skipped). Earlier sandboxed/superseded broad attempts did not complete and are not counted as passes. The final run followed the reviewed source correction and completed with exit code zero. Combined with the other workspace results, local source/fixture coverage is 1,019 passes and nine skips across 192 files; focused/concurrent runs overlap and are not added to that total.
- Dependencies were installed from the unchanged lockfile in the isolated worktree using `npm ci --ignore-scripts --no-audit --no-fund`; repository patches were applied through `npm run postinstall`. Initial app builds lacked native artifacts because scripts were skipped. Rebuilding the pinned `@vscode/windows-ca-certs` and `@theia/ffmpeg` packages locally resolved those failures; the final aggregate above passed. No dependency or lockfile change was retained. Sandboxed networking and temporary Git initialization also prevented initial integration/tracking runs; authorized host runs are separate evidence, not passes for those failed attempts.
- All 13 change-tracking tests passed in the authorized run. Generated RPC/settings references, documentation inventories, documentation evidence integrity, release-version agreement, complete WSL Markdown link scan, repository formatting, diff whitespace, generated changelog freshness and branch-wide work-record coverage passed. Final evidence text changes preserve existing local link targets; no full unexcluded local Turbo test pass is claimed. Hosted CI uses the normal unexcluded repository commands.
- Native installer executable fixtures and live Blender operations remain excluded from local execution to preserve the established endpoint-protection/external-application boundary. No antivirus, credentials, ordinary runtime profile, paid provider or engine state is changed.

##### Files

- `packages/platform-service/src/mcp/session.ts`
- `packages/platform-service/src/mcp/session.test.ts`
- `docs/changes/2026-10-26-mcp-tool-discovery-race.md`

#### Keep Requests keyboard focus through review and recovery

**Impact:** patch

[Permanent work record](docs/changes/2026-10-26-requests-keyboard-recovery.md).

##### Summary

Keep keyboard users inside Requests when opening the view or when a response control disappears or becomes disabled. Preserve the existing empty inspector after resolution and explicit per-request authority. This is a bounded slice of the P0 UI/accessibility card, not completion of broader accessibility qualification.

##### Details

- A real keyboard journey on main `3b35deb` left focus on the document body when opening Requests and after approval, rejection, choice and free-text responses. The inspector correctly cleared, but continuing required tabbing through the wider workbench. A rendered regression reproduced this before the correction; no product change was made until the journey demonstrated the gap.
- Activating Requests now renders and focuses its Project filter when focus is outside the view. An update that removes or disables the view's focused control returns focus to the labeled Pending requests navigation region. Existing focus on surviving controls, including typed drafts, is preserved. Background updates do not take focus from another view.
- The navigation region is programmatically focusable without adding a normal tab stop. It grants no authority and does not select another request. Resolved identities, keyed inspector content, empty-inspector behavior, draft storage, model refresh/response logic, exact-ID RPCs and per-call approval rules remain unchanged. Repeated Enter after resolution cannot approve a replacement request.
- Add a repeatable Puppeteer keyboard/recovery scenario and `test:ui:requests-keyboard` command. Use real disposable Projects, workers and contained file approvals; tab through existing Project Home and Requests controls and use Enter/Space/native selection keys. Verify exact Project context, independent approval/rejection, another client's resolution, exact stored answers, background draft retention, unavailable-Project recovery, actual service stop/restart, safe empty-inbox focus and narrow layout. Do not invoke a model, paid provider or engine.
- Run this scenario after the existing hosted browser smoke. Its unique profile/Project/configuration and evidence directories stay outside the repository. Upload only report/failure JSON and PNGs, never profile databases, service tokens or credential material. A held fixture lock prevents a second service bootstrap during the deliberate disconnect. Cleanup handles partial startup, independently attempts every owned resource, waits for its backend exit, force-stops that same backend if necessary and records cleanup failures.
- Retain the observed optional development-shell `/favicon.ico` HTTP 404 in evidence, qualified by its exact URL/status. Reject other HTTP/console errors and all renderer exceptions. This task does not repair or silently discard that unrelated shell diagnostic. The Browser plugin is unavailable; the scenario uses the repository's existing Puppeteer dependency and records its actual browser/version.
- Work uses a new isolated branch from main, independent of draft PR 20. Preserve the original checkout's pending planning/changelog work and the SDK/security worktrees. Only the existing UI/accessibility card is marked In progress; its priority/estimate and other cards remain unchanged. No new navigation/approval architecture or Requested first-run feature is accepted.
- Compatibility and migration: compatible UI focus correction; no dependency, lockfile, API, setting, persistent schema or migration changes. No migration required. Product version remains 0.22.0 pending. Patch impact reflects corrected keyboard navigation; no installer, release, deployment or merge is prepared.

##### Validation

- Unchanged-source browser probe completed the response journey with no renderer exceptions but recorded BODY focus at opening and every completion; the explicit focus assertion failed. After the correction, the same journey retains focus on the Project filter or Pending requests navigation region, while background typing stays in the answer field and the inspector remains empty after resolution.
- Focused Requests model/widget tests passed all ten cases across two files, including failed read/action, disconnect/late results, stale actions and draft editing. Aggregate build/typecheck/lint passed all 25 tasks (18 cached), including browser and Electron builds. Other workspace tests passed all 14 tasks (11 cached): 236 passed, one skipped across 57 files. These counts overlap the focused tests and are not added together.
- The reusable rendered scenario passed twelve focus/state observations on native Windows Chrome 155.0.8059.79 at 1600x1000 and 480x900. Exact answers, approved/rejected file outcomes, stale/repeated action safety, draft recovery, disabled disconnected controls, Project context and no horizontal overflow were asserted. Renderer errors were empty. The optional favicon 404 remains explicitly reported; no other HTTP/console error was observed. Final cleanup recorded no errors and released the fixture lock.
- Independent standards/spec reviews found no product-focus defect. Standards review identified startup and cleanup failure edges in the new harness; acquisition moved inside protected cleanup and each cleanup stage runs independently, including forced termination of a resistant owned backend. A temporary public-connection fault probe exited with the expected error, no cleanup errors and no remaining service lock instead of hanging. The transient injection is not a product test hook or committed dependency.
- Initial browser startup lacked native artifacts because dependency install scripts were skipped; built the unchanged pinned Windows CA, Theia ffmpeg, drivelist and native-keymap modules locally. No manifest/lockfile dependency change was retained. An initial command-palette probe did not open its expected selector; final acceptance uses keyboard navigation from Project Home, without claiming palette qualification. An exploratory malformed-manifest injection did not induce a read failure for an already-open cached Project; restored its bytes and removed that invalid fault case. No runtime defect is inferred from those harness/setup observations.
- Failed read/action handling is covered by existing model tests; rendered recovery covers unavailable Projects and actual service-disconnect errors. NVDA/Orca, full screen-reader/contrast/localization certification, installed Electron, installer lifecycle and paid/live engine workflows were not exercised. The unchanged broad service suite is not rerun locally for this frontend-only fix, preserving the established native installer-executable/live-Blender boundary. Hosted CI uses normal unexcluded quality commands.
- Repository formatting, explicit script/work-record formatting, YAML syntax with retained read-only workflow permissions, Node script syntax, generated references/inventories, documentation evidence integrity, release-version agreement, complete WSL Markdown links, diff whitespace, generated changelog freshness and branch-wide record coverage passed. Exact-head hosted outcomes are retained on the draft PR linked from the [owning card](https://github.com/users/scarecr0w12/projects/5?pane=issue&itemId=282909887). No passing hosted or broad accessibility claim is inferred from local browser evidence.

##### Files

- `packages/theia-control-room/src/browser/requests-widget.tsx`
- `scripts/requests-keyboard-ui-smoke.cjs`
- `package.json`
- `.github/workflows/ci.yml`
- `docs/changes/2026-10-26-requests-keyboard-recovery.md`

### Security

#### Configure repository security and quality controls

**Impact:** none

[Permanent work record](docs/changes/2026-10-24-repository-security-quality.md).

##### Summary

Configure the approved free GitHub security and quality settings, document private
vulnerability reporting, and schedule weekly GitHub Actions dependency updates.

##### Details

- Add `.github/SECURITY.md` with a private reporting link, the information needed
  to reproduce a report, and guidance to remove credentials and private data.
  Security fixes target the latest release and `main`; older releases are not
  maintained separately. The policy does not promise response or resolution times.
- Add `.github/dependabot.yml` for weekly GitHub Actions updates in `/`, capped at
  five open update pull requests. It does not configure npm version updates or
  automatic merging; existing npm security updates remain enabled.
- Apply the approved `main-security-quality` branch ruleset: block deletion and
  force pushes, require pull requests and resolved review conversations, require
  the existing Linux quality, Windows quality, and browser-build checks, and
  require zero approving reviews. Administrators can explicitly bypass through
  pull requests. Up-to-date branches and CodeQL checks are not merge requirements.
- Restrict Actions to local actions, GitHub-owned actions, and the existing
  `softprops/action-gh-release` action; require workflow approval for all external
  contributors. Preserve read-only default token permissions, disabled workflow
  pull-request approval, and the existing SHA-pinning setting.
- Enable CodeQL default setup for JavaScript/TypeScript and GitHub Actions using
  the default query suite, remote threat model, and standard hosted runners.
  Preserve dependency graph, Dependabot alerts and security updates, secret
  scanning, push protection, and private vulnerability reporting. No paid feature,
  trial, credential generation, or new access grant is part of this task.
- Existing dependency-update pull requests and their failures are outside this
  change. Do not treat enabled scanners as proof that the application is secure.
- Compatibility and migration: no product code, package version, data schema, or
  RPC contract changes; no application migration required. Repository contributors
  now use pull requests for `main`, with the administrator bypass described above.
- Version impact is `none` because these are repository controls and maintenance
  documentation, not a shipped application behavior change. File changes remain
  proposed until this draft pull request is reviewed and merged.

##### Validation

- Inspected repository `AGENTS.md`, change-record instructions, relevant security
  review guidance, workflow definitions, and existing checks before changing settings.
- GitHub API accepted ruleset creation (ID `25797382`), Actions restrictions and
  contributor-approval updates, and CodeQL setup. Initial CodeQL run:
  <https://github.com/scarecr0w12/PlayWeld/actions/runs/40131964374>.
- Read back the ruleset, allowed actions, external-contributor approval policy,
  default token permissions, preserved security features, and CodeQL configuration.
  Both initial CodeQL analyses completed successfully with empty analysis error
  and warning fields. CodeQL reported 12 open alerts (nine high and three medium);
  these are untriaged scanner findings and were not fixed or dismissed.
- `npm run changelog:update`, `npm run changelog:check -- --base 7ccb07580d82164d16f63c6ce5404b81a754f1e6`, and `git diff --check` passed.
  The existing pinned Prettier installation checked the complete isolated checkout;
  all matched files passed without installing dependencies into the checkout.
- The repository-wide Markdown link checker was started under Git Bash and stopped
  after an extended run without a result. The PR's existing Linux CI also runs
  this checker; the incomplete local check is not represented as passed.
- The first PR Linux quality job passed builds, types, lint, tests, work records,
  cache-maintenance tests, version validation, and documentation validation, then
  failed formatting on `CHANGELOG.md`. Later validation prose had split a command
  across lines in this source record after the earlier formatting check. Keep
  that command on one line and regenerate the changelog to correct this task's
  formatting regression. Check both generation freshness and formatting together
  before committing the correction; hosted checks remain pending at that point.
- Initial repository inspection found 11 open Dependabot alerts (four high and
  seven medium), zero open secret-scanning alerts, and failing existing Dependabot
  pull requests. These are observations, not fixes delivered by this task.
- Application builds, engine integrations, desktop packaging, and installer tests
  are not executed locally for this documentation and repository configuration
  change. Hosted checks and CodeQL results are verified separately before handoff.

##### Files

- `.github/SECURITY.md`
- `.github/dependabot.yml`
- `docs/changes/2026-10-24-repository-security-quality.md`
- `CHANGELOG.md`

#### Refresh vulnerable dependency lines without changing Theia

**Impact:** patch

[Permanent work record](docs/changes/2026-10-24-security-dependencies.md).

##### Summary

Refresh exact dependency and transitive override pins to remediate the reviewed npm advisories while retaining the directly declared Theia application/extension packages at 1.75.0 and keeping the product version at 0.22.0.

##### Details

- Pin Electron 42.11.18 consistently in the desktop manifest and root override, DOMPurify 3.4.17, MCP SDK 1.32.1 in both the service dev dependency and global override, and serializer 7.1.3. Raise the existing SDK security-version regression floor to 1.32.1; refresh the Theia development skill's Electron reference.
- Upgrade Vitest to 5.0.5 and Puppeteer/Puppeteer Core to 25.14.0, aligning Theia CLI's transitive Puppeteer with the same direct dependency. Update the exact allowed install-script entry for Puppeteer. Select Vite 8.3.4 to close the vulnerable 8.3.0-8.3.2 line without adopting the newer 8.3.5 candidate in a concurrent dependency PR.
- Pin patched transitive lines: body-parser 1.20.9 and 2.4.0 by major selector, fast-uri 3.1.9, follow-redirects 1.16.1, Hono 4.13.13, ip-address 10.7.4, markdown-it 14.3.3, multer 2.5.0, and Undici 6.29.1/7.30.1 by major selector. Preserve both body-parser and Undici API generations rather than globally replacing them with another major.
- Pin Zod 4.6.7 after updating Puppeteer/Chromium BiDi and SDK consumers to versions declaring Zod 4 compatibility. This removes the vulnerable Zod 3 parser without overriding an unchanged Chromium BiDi consumer that required Zod 3. Retain existing local braces/sprintf-js security patches and the archive extractor seam.
- Verify registry release dates using `npm view` and registry metadata. Prefer versions at least seven days old; explicit security exceptions are Electron 42.11.18 (October 21), serializer 7.1.3 (October 22), body-parser 1.20.9/2.4.0 and multer 2.5.0 (October 22), and fast-uri 3.1.9 (October 19). Older available versions in those lines still matched reviewed advisories; the seven-day rule is a preference, and retaining known affected versions would not complete remediation.
- Update the lockfile, then use a clean `npm ci --foreground-scripts`; exact pin changes alone initially left old transitive lock entries, so perform a targeted lockfile update before installation. No `npm audit fix --force`, Theia downgrade, product-version preparation, ordinary profile change or installer publication occurs. Concurrent dependency PRs are neither edited nor merged.
- During iteration, SDK 1.32.2 and serializer 7.1.4 were initially selected. Prefer the already-aged SDK 1.32.1 and the minimal patched serializer 7.1.3 after checking advisory ranges. Incremental installation left one old root SDK copy despite the new override; a targeted update plus a second clean install corrected it. Final `npm ls` has no invalid dependency and resolves both service and Theia MCP consumers to SDK 1.32.1 with Zod 4.6.7. These intermediate versions are not the final pins.
- Compatibility and migration: dependency-only runtime/tooling changes, no application/RPC/storage version change or data migration. Native modules are reinstalled/rebuilt for verification. Impact `patch` reflects shipped security dependency corrections; a future release must still follow normal version preparation.

##### Validation

- Clean `npm ci --foreground-scripts` passed, including the retained local patches. Full `npm audit --json` and production-only `npm audit --omit=dev --json` both report zero vulnerabilities, compared with the review's 22 and 48 affected-package entries. Audit results are registry snapshots, not proof that application-level vulnerabilities are absent.
- Focused provider, SDK, backup and opener verification passed 53 tests with Vitest 5.0.5. The final full Turbo gate passed 33/33 tasks with 21 cached; the platform suite reran and passed 702 tests with six capability/OS skips. Both Electron and browser application builds passed. All directly declared Theia application/extension dependencies remain exactly 1.75.0. No packaged or installed Electron upgrade is claimed.
- Start the built browser on loopback port 3127 with separate `.turbo/security-remediation-ui-profile` and config directories. The first smoke reached seven successful UI checks with no renderer errors, then its direct RPC client used the default pipe because the smoke process lacked the server's profile variable; it failed with `ENOENT` before that direct RPC operation. Repeat with matching isolated profile/config environment: 33 rendered checks passed with zero renderer errors, including Project creation/opening, settings export/import, Models layout, skill reading, audit and backend disconnect survival. Retain the failed attempt and successful retry separately; no application patch was needed for the harness configuration error.
- Final logs and screenshots are machine-local under `.turbo/security-remediation-*`; the successful rendered report is `.turbo/security-remediation-ui-retry/report.json`. These disposable-profile browser checks do not prove packaged Electron behavior, an installed upgrade, publisher trust, arbitrary provider/engine interoperability or production readiness.
- Stop the task-owned browser server after verifying its recorded PID owns port 3127, then stop the isolated service through its supported CLI. Cleanup readback reports `not running` and no listener on 3127. Retain disposable fixtures/evidence; ordinary installed application/profile data is not stopped or modified.

##### Files

- `package.json`
- `package-lock.json`
- `apps/control-room/package.json`
- `packages/platform-service/package.json`
- `packages/platform-service/src/dependencies/mcp-sdk-version.test.ts`
- `.agents/skills/theia-app-dev/SKILL.md`
- `docs/changes/2026-10-24-security-dependencies.md`

#### Correct asset-opening and input-interpretation security boundaries

**Impact:** patch

[Permanent work record](docs/changes/2026-10-24-security-remediation.md).

##### Summary

Replace the vulnerable Windows default asset opener with literal-path launch, reject configured Windows shell-command modes, and correct input-normalization weaknesses identified during the project review. Broader feature work remains outside this task.

##### Details

- The previous Windows default appended an existing Project asset pathname to `cmd /c start`, allowing legal filename metacharacters to become command syntax after a user open action. Preserve realpath/existence/Project containment, but pass the canonical pathname only through a dedicated child environment value to fixed `Invoke-Item -LiteralPath` code. Use the system Windows PowerShell executable, disable profiles/interaction, hide its helper window, and keep the helper attached until its bounded completion. A nonzero exit, startup error or ten-second timeout reports `launched: false`; configured application launch retains its existing spawn-based result.
- The Windows default relies on the documented [Invoke-Item literal-path/default-action contract](https://learn.microsoft.com/en-us/PowerShell/module/microsoft.powershell.management/invoke-item?view=powershell-5.1), verified here with a real benign executable fixture rather than assuming command-array separation alone proves native launch behavior.
- Reject configured `cmd`/`command.com` and PowerShell command-string modes before appending filenames. Require explicit PowerShell `-File` with a script and documented safe pre-file options; a later `-File` inside `-Command` text cannot bypass this check. Ordinary applications, fixed arguments, quoted paths, Node shebang scripts, and macOS/Linux defaults retain their argument behavior. Abbreviated/other PowerShell modes must be rewritten to explicit file mode; no persisted setting is silently changed.
- Add mocked boundary/error/timeout/path tests and a native Windows regression that compiles a benign windowless fixture, opens literal metacharacter and space/Unicode executable names through the real default helper, and verifies the exact launched pathname. The test opens no authoring application and executes no injected shell payload. Initial red tests exposed the old `cmd` boundary and incorrect helper-success reporting; an initial .NET helper attempt returned `EPERM`, and a detached helper did not launch the native fixture. The final supported literal-path helper passes the native launch checks without detachment. These discarded attempts are not shipped implementations.
- Escape Drive query backslashes before quotes in both list and exact-file lookup. A fixture parses the returned query literal for list/get/delete to prove the configured folder value round-trips. This addresses robustness without promoting the original owner-configured query warning into a demonstrated authorization exploit.
- Decode S3 XML entities in one pass so decoded text is not interpreted as another entity. Verify the nested-entity result and retain archive-name rejection before download. Anchor the fixture's SigV4 authorization parser to its fixed scheme to remove repeated unanchored searches; real signature verification remains intact.
- Replace the provider trailing-slash backtracking expression with a linear scan shared by endpoint construction and OpenAI response eligibility. Preserve ordinary and all-slash/empty values; exercise a 100,000-slash input. Escape backslashes before Markdown table delimiters in generated-reference formatting; current schema/reference bytes remain unchanged.
- Use one independent pre-patch boundary/compatibility investigation and one independent candidate review. The latter found no concrete bypass/regression and identified intentional PowerShell-option restrictions for documentation. Add support for safe `-Sta`/`-Mta` switches while retaining explicit file-mode validation.
- Triage all twelve reviewed CodeQL alerts: the Drive/S3/provider/generator/fixture patterns above and the three workflow permission declarations are corrected in source. The vector-store SHA-256 alert refers to a cache identity rather than password authentication; the A2A limiter alert has existing source-backed rate/concurrency controls and a passing unauthenticated-quota regression. Do not weaken those controls or add inappropriate slow password hashing to a cache key. No remote alert is dismissed or claimed cleared; fresh hosted analysis and formal disposition remain separate from these local fixes.
- Compatibility: RPC/result/error schemas, Project data, filenames and product version remain unchanged. Existing shell-command authoring settings now fail closed with an actionable error and need the documented application/script-file rewrite; no data migration or automatic settings edit occurs. Impact `patch` reflects a security fix with this explicit configuration restriction. The original sealed security scan remains an immutable pre-fix snapshot.
- Related work: [dependency remediation](docs/changes/2026-10-24-security-dependencies.md), [workflow hardening](docs/changes/2026-10-24-workflow-security.md), and [documentation reconciliation](docs/changes/2026-10-24-documentation-reconciliation.md) are tracked separately. Signed publication, plugin signature/egress policy, installer lifecycle and broad live acceptance remain open.

##### Validation

- Initial opener regression: five failures/six passes, including one corrected test expectation; the actual Windows/default and helper-error regressions failed on the old implementation. Subsequent focused opener run: 19 passes, including the real Windows literal-filename fixture. The final eight-file focused run passed 53 tests, including the added timeout regression, configured-mode rejection, literal filename launch and the nearest existing asset/provider/backup/SDK cases.
- Narrow typecheck passed. The initial eight-file run's native-helper failure was investigated and corrected as described above. Final `npx turbo run build typecheck lint test --concurrency=1` passed 33/33 tasks (21 cached); the owning platform suite reran with 702 passes/six skips, and aggregate package results cover 911 passes/seven skips across 182 test files. An earlier combined run passed all 33 tasks uncached. Electron/browser builds passed; Electron's placeholder lint/typecheck/test tasks remain explicit skips rather than application-test evidence. Generated references/inventory/evidence, version, workflow assertions, formatting, links, changelog coverage and diff whitespace checks passed.
- Source review and benign fixture execution do not establish all application security, supported-OS qualification, packaged/installed behavior, real remote backup operation or provider compatibility. No ordinary Project/profile, credential or paid provider was used. Automated package suites also run disposable native Blender and managed Qdrant fixtures when available; these are separate from ordinary user Projects or fresh broad integration acceptance. The earlier session review wording that no DCC operation occurred was too broad: its own retained test log includes two real Blender fixture checks. This record corrects that qualification without rewriting the original dated review receipt.

##### Files

- `packages/platform-service/src/assets/external-open.ts`
- `packages/platform-service/src/assets/external-open.test.ts`
- `packages/platform-service/src/assets/external-open.windows.test.ts`
- `packages/platform-service/src/backup/destinations/google-drive.ts`
- `packages/platform-service/src/backup/destinations/google-drive.test.ts`
- `packages/platform-service/src/backup/destinations/s3.ts`
- `packages/platform-service/src/backup/destinations/s3.test.ts`
- `packages/platform-service/src/models/providers/http-utils.ts`
- `packages/platform-service/src/models/providers/http-utils.test.ts`
- `packages/platform-service/src/models/providers/openai-compatible.ts`
- `scripts/generate-system-reference.cjs`
- `docs/changes/2026-10-24-security-remediation.md`

#### Pin workflow actions and narrow publication authority

**Impact:** none

[Permanent work record](docs/changes/2026-10-24-workflow-security.md).

##### Summary

Make workflow token permissions explicit, grant publication write access only to the release job, and replace mutable third-party action tags with verified commit pins.

##### Details

- Declare `contents: read` for CI and the Windows integration probe, retaining the currently read-only repository default as defense in depth. Change the release workflow's default to read-only and grant `contents: write` only to its publishing job; validation and package jobs no longer inherit publication write authority.
- Resolve each existing tag through GitHub's API and verify its commit date: checkout v4 at `11d5960a326750d5838078e36cf38b85af677262`, setup-node v4 at `49933ea5288caeca8642d1e84afbd3f7d6820020`, upload-artifact v4 at `ea165f8d65b6e75b540449e92b4886f43607fa02`, download-artifact v4 at `d3f86a106a0bac45b974a628896c90dbdf5c8093`, and action-gh-release v2 at `3bb12739c298aeb8a4eeaf626c5b8d85266b0e65`. All predate the seven-day preference. Keep version comments for maintainers and dependency tooling.
- Preserve workflow triggers, existing quality checks, concurrency, signing-secret references, draft/testing-release policy, local Spectre action and artifact behavior. Do not duplicate the weekly Actions-update configuration or private-reporting policy proposed in PR #8, mutate repository settings, dismiss alerts, or publish a workflow run.
- Compatibility and migration: no product/data change; no migration required. Workflow privilege changes are internal security maintenance with impact `none`. Hosted execution remains a separate verification boundary.

##### Validation

- GitHub GET readback established the exact action commits and dates. Parsed all three workflows with the installed YAML parser and asserted read-only defaults, publisher-only `contents: write`, and full forty-character commit pins on every external action: passed. Formatting, diff whitespace and changelog coverage checks passed. No hosted run of these local changes or release/signing operation is claimed; local policy assertions do not validate hosted token behavior or clear remote CodeQL alerts.

##### Files

- `.github/workflows/ci.yml`
- `.github/workflows/release.yml`
- `.github/workflows/windows-transport-probe.yml`
- `docs/changes/2026-10-24-workflow-security.md`

#### Reconcile GitHub security alerts and bound A2A authentication work

**Impact:** patch

[Permanent work record](docs/changes/2026-10-25-github-security-alerts.md).

##### Summary

Review live GitHub dependency/code/secret-scanning alerts, verify pending dependency fixes against every open advisory, close a pre-authentication rate-limiting gap and prepare the accumulated reviewed work for commit and push.

##### Details

- Read the authenticated GitHub alert APIs on 2026-10-25: 14 open Dependabot alerts, 12 open CodeQL alerts and zero open secret-scanning alerts. These are observations of the default branch, not counts of independently exploitable vulnerabilities. The installed GitHub connector lacks alert endpoints, so use the authenticated GitHub CLI for those reads. Preserve scanner settings and do not treat a clean npm result as proof of application security.
- Compare every installed-lockfile package entry for each open Dependabot alert against the API's vulnerable semver range. All entries are outside the affected ranges, using the already-pending exact dependency remediation; no additional dependency change or forced audit fix is needed. Coverage: alerts 54/45 use markdown-it 14.3.3; 53/52 use follow-redirects 1.16.1; 49/48/47/46/44/43 use MCP SDK 1.32.1; 42 uses Hono 4.13.13; 41/40/39 use Vite 8.3.4. Check full and production-only npm audits independently. The newly observed markdown-it/follow-redirects advisories are supported by the [GitHub markdown-it advisory](https://github.com/advisories/GHSA-vfgh-jcmw-g37q) and [follow-redirects advisory](https://github.com/advisories/GHSA-8r9p-f939-6h3c); live alert ranges supply the per-alert comparison.
- Recheck the twelve CodeQL locations. Pending source changes correct workflow permission defaults (1-3), the S3 fixture regular expression (4), provider trailing-slash scans (5-6), S3 one-pass XML entity decoding (7), Drive query quoting (8-9) and generated Markdown escaping (10). Preserve those independent work records and tests. Do not claim remote closure from local changes; GitHub's analyzed default-branch commit initially remains `4ed697edfa09a11368581c15f7ea90e5cc739e1a`.
- Alert 11 flags authentication before a recognized limiter. Existing invalid-token responses and per-client quotas were present, but the credential database lookup still ran on every well-formed invalid token before the invalid-token quota returned HTTP 429. Add an aggregate 1,200-request fixed-minute source-address budget before parsing/authentication. Exhaustion now returns HTTP 429 before any credential query, including for valid tokens, until the minute resets. Retain the separate 120-request invalid-token and per-client budgets, public Agent Card limit, concurrency limits, loopback/Host/Origin boundary and authorization checks. Only the actual socket address keys the new budget; forwarded headers do not influence it. This is a bounded shared ceiling, so abusive loopback traffic can temporarily throttle valid clients from that source; no unlimited-availability claim is made. This implements the [CodeQL recommendation to limit expensive handler work](https://codeql.github.com/codeql-query-help/javascript/js-missing-rate-limiting/).
- Add an HTTP regression with rotating syntactically valid invalid credentials, an exhausted-ceiling valid request that performs no database preparation, and successful authenticated access after the clock crosses the one-minute boundary. Preserve the existing regression proving 121 malformed unauthenticated requests do not consume a valid client's quota. The first sequential probe timed out before reaching its assertion; batch twenty requests at a time to exercise the same boundary within the original timeout, without increasing it. The corrected probe fails on the old implementation with HTTP 200 instead of 429, then passes with the limiter.
- Alert 12 treats SHA-256 over vector adapter configuration/API-key material as password storage. Trace the value to the in-process adapter cache and persistent collection-mapping namespace: it is a deterministic identity, never a password verifier or authentication decision. Preserve that identity format so existing collection mappings continue to resolve. Add an explanatory source comment and a regression proving identical credentials reuse the handle, rotation selects a distinct handle/identity, and the identity contains a hexadecimal digest rather than the literal fixture key. The fixture creates adapter handles without contacting Qdrant. This evidence supports a false-positive disposition for that specific password-hashing rule, not a claim that arbitrary credential handling is secure.
- Dismiss CodeQL alert 12 as `false positive` with the scoped cache-identity rationale after source tracing and regression verification. GitHub readback confirms the dismissal; the first overlong rationale was rejected by the API's 280-character limit and made no change, then the shorter rationale succeeded. Do not dismiss Dependabot alerts or the A2A finding to substitute for patched source and fresh hosted analysis. Open CodeQL count becomes eleven; the initial twelve-alert observation remains historical evidence.
- Update the architecture and current status with the limiter behavior and hosted/local evidence distinction. Preserve the retired executable-generating opener fixture and endpoint-protection recovery boundary: do not rerun that fixture, compile installer fixtures or mutate ordinary engine/DCC projects for this pass. Keep Bitdefender enabled, with no exclusions or quarantine changes.
- The final generated-inventory check initially found the retired native opener still listed as a current regression path, causing the documentation-evidence checker to fail as well. Regenerate both inventory artifacts from current source to remove that obsolete entry; preserve historical work-record references and leave the evidence checker's assertions intact.
- The staged whitespace check additionally detected extra blank lines at EOF in three pending security records that the earlier unstaged check did not include. Normalize those endings before committing; preserve their historical findings, validation and file lists.
- The remote security-policy PR 8 merged after this branch's starting commit. Preserve its private-reporting policy, Actions Dependabot schedule and permanent work record when incorporating current main. Existing dependency-update PRs remain independent; newer optional action/dependency versions are not automatically treated as security fixes. Commit/push authorization covers this session's accumulated reviewed security, documentation, plugin migration, Requests, audit export/retention and service-log work, each retaining its separate permanent record. No release or main-branch merge is authorized by this task.
- Commit the accumulated reviewed work on `codex/security-review-remediation`, then merge current `origin/main` into that branch. The sole conflict is generated `CHANGELOG.md`; resolve it by regenerating from both branches' permanent records, retaining the incoming security policy and schedule unchanged. This incorporates main into the feature branch; it does not merge the feature branch into main.
- Compatibility/migration: HTTP overload behavior changes only at the new aggregate ceiling; valid callers can receive 429 during a source flood. No setting, RPC schema, credential format, vector identity, Project/profile schema, dependency version or data migration changes in this follow-up. Impact is patch for the A2A security correction; version stays 0.22.0 pending.

##### Validation

- Live Dependabot range comparison passed all 14 alerts with no affected local lockfile paths. `npm audit --json` and `npm audit --omit=dev --json` both exited zero with zero vulnerabilities. Evidence: `.turbo/github-dependabot-open.json`, `.turbo/github-alerts-audit.json` and `.turbo/github-alerts-audit-production.json`.
- The batched authentication regression failed on the old implementation with HTTP 200 instead of 429; the earlier sequential timeout is not a successful reproduction. Evidence: `.turbo/github-security-auth-ceiling-red-batched.log` and `.turbo/github-security-auth-ceiling-red.log`.
- Seven focused service files passed 42 tests after the limiter, including A2A, vector registry, provider/backup/SDK and mocked opener. The additional cache-identity regression then passed with all five vector-registry tests. Evidence: `.turbo/github-security-focused.log` and `.turbo/github-security-cache-identity.log`.
- `npx turbo run build typecheck lint --concurrency=1` passed 25 tasks (17 cached) after the final production changes, including Electron/browser builds. The existing installer-handoff require-resolution warning remains; app-shell placeholder checks still report skip. Other workspace tests passed 14 tasks (12 cached). Evidence: `.turbo/github-security-final-quality.log` and `.turbo/github-security-other-tests.log`.
- `npm test -w @gamecrafter/platform-service -- --exclude src/updates/installer-handoff.test.ts --exclude src/dcc/blender-real.test.ts` passed 727 tests with seven skips across 131 files (130 passing files and one skipped file) in 386.45 seconds. Other workspaces account for 236 passes and one skip across 57 files, including cached results: aggregate 963 passes/eight skips across 188 files. The two exclusions are deliberate verification limits, not passes; no test assertion was weakened. The removed native opener is absent. Evidence: `.turbo/github-security-service-tests.log` and `.turbo/github-security-other-tests.log`.
- Change-tracking tests passed 13 cases and cache-maintenance tests passed nine cases. Installed-tree validation with `npm ls --all --json` exited zero without problems. Generated RPC/settings/inventory freshness, documentation evidence integrity, version agreement, repository formatting, staged whitespace and changelog coverage checks passed. The initial obsolete inventory failures were corrected by regeneration. Markdown links passed before and after main integration (`.turbo/github-security-integrated-links.log`). All six recovered/regenerated developer files remained present after broad verification.
- Current main was incorporated into the feature branch, with the generated changelog conflict resolved from the combined permanent records. No complete unexcluded full gate, native opener, installer, live DCC/engine/provider or security-product false-positive adjudication is claimed.
- Push `codex/security-review-remediation` to origin and verify its remote ref matches the local commit. Open [draft PR 15](https://github.com/scarecr0w12/PlayWeld/pull/15) through the GitHub connector to make the complete change and verification limits reviewable. The PR is not merged. Post-push alert readback remains 14 open Dependabot alerts on the default branch, eleven open CodeQL alerts and zero open secret-scanning alerts; alert 12 is confirmed dismissed as false positive. No Dependabot alert was dismissed. These default-branch alerts cannot be reported resolved merely because a feature branch was pushed. Fresh hosted checks are pending and do not replace the retained local evidence.

##### Files

- `packages/platform-service/src/a2a/inbound-server.ts`
- `packages/platform-service/src/a2a/inbound-server.test.ts`
- `packages/platform-service/src/knowledge/vector-store-registry.ts`
- `packages/platform-service/src/knowledge/vector-store-registry.test.ts`
- `docs/TECHNICAL_ARCHITECTURE.md`
- `docs/STATUS.md`
- `docs/reference/DOCUMENTATION_INVENTORY.md`
- `docs/reference/documentation-inventory.json`
- `docs/changes/2026-10-24-security-dependencies.md`
- `docs/changes/2026-10-24-security-remediation.md`
- `docs/changes/2026-10-24-workflow-security.md`
- `docs/changes/2026-10-25-github-security-alerts.md`

### Documentation

#### Reconcile current capability evidence and historical documentation

**Impact:** none

[Permanent work record](docs/changes/2026-10-24-documentation-reconciliation.md).

##### Summary

Correct stale current-status claims using existing accepted receipts, document the secure asset-opening configuration contract, and preserve dated review findings as historical evidence.

##### Details

- Update status, plan and register prose that incorrectly said hosted CI had never run, task/settings contracts were not started, only noop handlers existed, no task UI existed, or every provider/generation/embedding interaction remained fake-only. Link exact hosted revision evidence and scoped OpenAI/Meshy/installed Knowledge receipts; retain unverified providers, operations and complete acceptance matrices. Update the settings count to 85 across 17 groups. Work-package statuses and user-owned decisions do not change; WP19 remains in progress.
- Distinguish the last recorded local 0.22.0 deployment from current process health and pending source installation. Keep public 0.21.0 testing release, local deployment receipt, current source and future packaging as separate facts. Preserve old audit counts and historical review content instead of rewriting historical evidence.
- Correct the architecture's stale isolation-selection claim to the selected LPAC/Job and bubblewrap backends with explicit remaining qualification; refresh its Electron pin and define the asset filename-as-data boundary. Update the handbook's default/native/configured opening behavior, explicit PowerShell file-mode policy, supported flags and failure semantics.
- Add navigation from the documentation index to the dated review and remediation record. Add a follow-up link to the review without altering its pre-fix findings. Regenerate documentation inventory artifacts so new regression-test paths are discoverable. The unchanged generated RPC/settings reference remains fresh after Markdown escaping hardening.
- Compatibility and migration: documentation/evidence reconciliation only, no new product decision, work-package promotion, schema/version migration or claims of complete security. Impact `none` reflects these documentation changes.

##### Validation

- Existing main CI readback and repository receipts support the corrected historical/scoped claims. Generated-reference freshness passed; the inventory initially detected the new test paths as stale and was regenerated. Final system-reference, documentation-inventory, evidence-integrity and release-version checks passed: 198 requests, 28 notifications, 85 settings, 26 service subsystems and 16 Control Room surfaces. Formatting, diff whitespace and generated-changelog/coverage checks passed.
- The full `scripts/check-links.sh` completed successfully through WSL, including the new remediation records and updated documentation: `All links OK`. Later validation prose adds no links. This supersedes the earlier review's local checker-timeout limit only for the current execution, not for the preserved review snapshot.

##### Files

- `docs/STATUS.md`
- `docs/DEVELOPMENT_PLAN.md`
- `docs/OPEN_DECISIONS.md`
- `docs/TECHNICAL_ARCHITECTURE.md`
- `docs/CONTROL_ROOM_HANDBOOK.md`
- `docs/README.md`
- `docs/PROJECT_REVIEW_2026-10-24.md`
- `docs/reference/DOCUMENTATION_INVENTORY.md`
- `docs/reference/documentation-inventory.json`
- `docs/changes/2026-10-24-documentation-reconciliation.md`

#### Preserve pending record links in release notes

**Impact:** none

[Permanent work record](docs/changes/2026-10-27-release-record-links.md).

##### Summary

Correct five relative links in three pending work records so the generated 0.23.0 release notes can resolve their evidence references.

##### Details

The release-note generator copies record prose into `docs/releases/`; bare sibling filenames therefore pointed into the wrong directory. Use `../changes/` for the five existing references, which resolves correctly from both record and release-note directories. Preserve their text, findings and historical qualification. These records were pending before this preparation; no previously released record or published note is rewritten. No application, schema, dependency or migration change is required.

##### Validation

The first full link check identified the five broken release-note links. Regenerated notes contain the corrected destinations; the final complete link-check result is recorded with release preparation. This correction makes no runtime or installation claim.

##### Files

- `docs/changes/2026-10-24-native-opener-fixture-cleanup.md`
- `docs/changes/2026-10-24-security-remediation.md`
- `docs/changes/2026-10-24-service-log-retention.md`

### Maintenance

#### Build and verify the local PlayWeld 0.22.0 upgrade

**Impact:** none

[Permanent work record](docs/changes/2026-10-18-local-0.22.0-deployment.md).

##### Summary

Build and install the cumulative model discovery and ten agent/Swarm fixes as a new local Windows testing release. Verify the installed application and preserve ordinary projects, settings, provider configuration and original task state.

##### Details

- Prepare and commit 0.22.0 source at `e4968fdb2032a63d0365b4e96695e7077650bec5`, following the pre-1.0 minor version rule. Preserve prior installers, released records, compatibility package/storage identities and the installed all-users location. No public release or tag is created.
- Capture an offline ordinary profile copy, start the existing installed 0.21.0 service for authenticated preflight, confirm no active tasks, then checkpoint and stop it. Save a complete profile backup and SQLite snapshots of all five Project databases before upgrading. Baseline: five Projects, 139 models, five pools and 1,077 original tasks. Configuration comparisons use fingerprints and never expose credentials. Also back up ordinary Theia and desktop user data and fingerprint six IDE files and 67 desktop files.
- Build the production Windows NSIS installer and stage it in the fresh `Windows-Release/0.22.0` directory. The manifest identifies the clean source commit, not an unrelated base or later evidence commit. Installer SHA-256: `6d6ce9fd258ae74160cd91f90f648c3ad967a9e5b911f0c72ebaf9af4da2bc42`. Authenticode status is `NotSigned`; this is a local testing build.
- Use disposable profiles, desktop storage and Projects for packaged and installed UI checks. A separate installed model discovery acceptance uses a local fake HTTP provider rather than ordinary accounts or paid requests.
- Complete the elevated NSIS all-users upgrade from 0.21.0 to 0.22.0 with exit code 0. Verify the installed executable and Windows uninstall registration, compare 420 installed runtime files to the clean stage, then repeat native/service/LPAC, desktop UI and targeted model-discovery acceptance against the actual Program Files executable.
- Compare ordinary data before and after the upgrade and again after reopening the normal desktop. Leave the installed application open on its restored existing workspace and the ordinary 0.22.0 service available. Record the local deployment in the implementation summary and release guide without changing the public 0.21.0 release or work-package status.

##### Validation

- Source quality: all 33 build/typecheck/lint/test tasks passed without cache hits in 7m43.143s, including both application builds; 887 tests passed and seven skipped. Thirteen change-tracking tests, nine cache-maintenance tests, version/lockfile checks, generated references/inventory, documentation evidence, formatting and links passed. Existing pinned dependencies were reused; no fresh `npm ci` ran in this preparation.
- Windows packaging and staging passed native resources, service startup/shutdown, actual packaged Electron LPAC boundaries, matching 0.22.0 service/application versions and all 30 bundled skills. Staged desktop smoke passed 29 checks with zero renderer errors: `.artifacts/documentation-electron/1792385592642/smoke/report.json`. Installer SHA-256 matches the staged checksum file and clean-source provenance was verified.
- The initial ordinary-service preflight found no running pipe; an offline backup preceded starting the old installed service, and the subsequent authenticated preflight and checkpointed backup passed. A transient generated-changelog write error cleared on retry, after which freshness, coverage and formatting passed. An early provenance read preceded completed staging; the completed manifest and checksum were subsequently checked successfully.
- Staged targeted model discovery acceptance passed eight native UI/RPC checks with zero renderer errors against an isolated local HTTP provider: read-only unchecked preview, enabling only one selection, refresh without adding unchecked models, default-disabled new discoveries, rendered availability/limits/unknown fields, absent-model reconciliation and preference retention across recovery/failure. Evidence: `.artifacts/local-deployment/0.22.0/staged-discovery-final/report.json`. Two initial harness attempts exposed harness assumptions (navigation buttons include description text; refresh deliberately does not add unchecked models); corrected the selector and expectations to match the documented contract, retained both failed reports, and reran successfully. No application-source change was needed.
- Windows administrator consent was granted; NSIS completed with exit code 0. Executable product version is 0.22.0.0 and the all-users uninstall registration reports PlayWeld 0.22.0. All 420 selected installed executable/frontend/service/contracts/extension files match the clean stage. Installed native resources, service startup/shutdown, actual Electron LPAC boundaries, matching versions and all 30 skills passed.
- Installed desktop smoke passed 29 checks with zero renderer errors: `.artifacts/documentation-electron/1792386149601/smoke/report.json`. Installed targeted model discovery passed the same eight UI/RPC checks with zero renderer errors: `.artifacts/local-deployment/0.22.0/installed-discovery/report.json`. Both use disposable profiles and Projects and the bundled service, not a substituted source service.
- Manual inspection of the installed Models capture confirms the explicit selection and unknown metadata controls render. The 800-by-600 account table wraps densely; the functional passes do not establish polished narrow-window layout or accessibility acceptance.
- Ordinary retention passed before and after normal app relaunch: five Projects, 139 model identities/enabled choices, five pools, platform and Project settings, account/credential-key/pricing fingerprints and all 1,077 original task IDs/states retained. No added tasks were detected. Profile/Project SQLite integrity and current migrations passed. All six ordinary IDE files and 67 desktop-data files remained byte-identical before normal relaunch; settings.json and recentworkspace.json also remained byte-identical after relaunch. The normal installed window restored the existing Morrowfen workspace.
- Hosted CI on the earlier merge commit exposed one ten-second outer timeout in the native Swarm await regression on Windows, while that PR's checks and this release's uncached local suite passed. Complete CI on the clean 0.22.0 source commit passed Windows quality, Linux quality and the browser build/live UI smoke: run `39201481370`. The later green run does not establish that the intermittent test timeout has been repaired; no timeout or runtime code was changed to obtain it.
- Final receipt/summary formatting, release-version consistency, work-record/changelog coverage, whitespace checks and the full Markdown link scan passed. A final ordinary retention check after all installed smokes and normal relaunch also passed with no added tasks. The receipt is a documentation follow-up to the clean packaged source commit; it does not retroactively change package provenance.
- No public publication, publisher signing, uninstall, rollback, new paid-provider, live Unreal/Unity/Godot, or production acceptance is claimed. The source suite's real Blender checks are separate from installed desktop evidence.
- Ignored private evidence and backups: `.artifacts/local-deployment/0.22.0`; staged artifacts: `Windows-Release/0.22.0`. Credentials and database contents are not committed or uploaded.

##### Files

- `docs/changes/2026-10-18-local-0.22.0-deployment.md`
- `docs/STATUS.md`
- `docs/RELEASE_GUIDE.md`

#### Separate Swarm await progress and native cleanup test budgets

**Impact:** none

[Permanent work record](docs/changes/2026-10-18-windows-swarm-await-test-stability.md).

##### Summary

Repair the Windows Swarm await regression fixture's competing deadlines without changing production scheduling or suppressing deadlock assertions.

##### Details

- The successful-await scenarios previously gave children two seconds to finish, including serialized work and native process startup. The outer ten-second test deadline also overlapped the supervisor's existing ten-second shutdown grace period, so a slow or failed scenario could surface as an outer timeout instead of its original task failure.
- Add a native IPC regression with two 1.5-second children at concurrency one. This deliberately exceeds the old two-second await allowance and reproduced a failed coordinator with `Child starved` before the correction.
- Give successful fixture awaits fifteen seconds, keep the explicit timeout case at one millisecond, and independently bound normal scheduling progress at six seconds. The deliberately slow-child scenario has a separate ten-second progress deadline. Use a thirty-second outer deadline to accommodate setup and bounded supervisor cleanup. Assertions still verify successful parent completion, tool refresh, concurrency limits, cancellation, zero double-counted usage and error propagation; a real scheduler deadlock still fails the independent progress assertion.
- Include the existing refresh-error scenario in the helper's TypeScript mode union and parameterize child duration/progress limits. No application runtime, storage, RPC, dependencies or product version changes; no migration is required.

##### Validation

- Baseline five-scenario Windows run passed. The new slow-child regression failed against the old fixture with `Child starved` (one failed, five deselected), proving the short success allowance is a reproducible failure mechanism rather than merely increasing a global timeout.
- After separating the budgets, five consecutive focused Windows runs passed all six cases (30 test executions). After reserving a ten-second progress deadline for the deliberately slower children, another five consecutive runs of the final configuration passed all six cases (30 more test executions). Original progress, explicit-timeout, concurrency, cancellation, refresh and usage assertions remain intact.
- `npx --no-install turbo run build typecheck lint test --concurrency=1` passed all 33 tasks (21 cache hits) in 7m38.842s, including Electron and browser builds. Platform service: 128 files, 679 passed and six skipped. Theia: 28 files and 133 passed. Workspace total: 888 passed and seven skipped. Formatting, version consistency, generated references/inventory, documentation evidence integrity, changelog coverage, whitespace and Markdown links passed.
- Hosted CI run `39205402424` passed Windows quality, Linux quality and browser build/live UI smoke on fix commit `05368eab2f6392942dc673235edd3c63a064085c`. The Windows log confirms all six native Swarm await tests executed and passed in 13.670 seconds total, including the slow serialized-child case in 4.679 seconds and the original concurrency-one case in 1.862 seconds. The complete Windows quality gate passed all 33 tasks. Retained log: `.artifacts/windows-swarm-models-fixes/hosted-windows.log`. The later verification-record update changes only Markdown; application and test source remain the CI-verified versions.
- Ignored logs: `.artifacts/windows-swarm-models-fixes/swarm-baseline.log`, `swarm-slow-red.log`, `swarm-repeat-1.log` through `swarm-repeat-5.log`, and `full-quality.log` in the same directory. An earlier hosted failure remains preserved in the 0.22.0 deployment evidence; this record does not rewrite its result.

##### Files

- `packages/platform-service/src/workers/supervisor-await.test.ts`
- `docs/changes/2026-10-18-windows-swarm-await-test-stability.md`

#### Native opener verification and runner installation recovery

**Impact:** none

[Permanent work record](docs/changes/2026-10-24-native-opener-fixture-cleanup.md).

##### Summary

Investigate a native Windows opener verification failure encountered during service-log retention work and recover missing local Vitest files from the unchanged pinned package. No product opener or test assertion change is retained.

##### Details

- The final full gate reported `EPERM` in the native asset-opening fixture's temporary-directory cleanup after its launch assertions. The cleanup failure reproduced in isolation, and the directory was absent on later inspection. This initially suggested a transient executable/directory lock.
- Tried five filesystem cleanup retries with a 100 ms base delay, without retrying launches, changing assertions or increasing the test timeout. The corrected fixture did not obtain a complete passing run; revert this unproven adjustment. The source test remains as it was before this investigation. This record preserves the attempted/reverted work rather than claiming a fix.
- Subsequent workers failed before discovery because `node_modules/vitest/suppress-warnings.cjs` and `node_modules/vitest/dist/workers/forks.js` were missing. Fetch the exact existing Vitest 5.0.5 package into ignored artifacts, verify its SHA-512 against package-lock.json and restore only missing files. Existing installed files matched the package bytes. Also restore the missing `node_modules/turbo/bin/turbo` launcher and `node_modules/@turbo/windows-64/bin/turbo.exe` from the exact locked Turbo 2.11.2 packages after checking their SHA-512 integrity. A compiled `packages/platform-service/lib/workers/worker-main.js` entry was missing too; regenerate service output with `npx tsc -b packages/platform-service/tsconfig.json --force` and the package build. The initially clean tracked `scripts/create-release-metadata.cjs` was also unexpectedly missing; restore that exact path from HEAD after confirming it was absent and had no pre-task modification. The two pre-existing intentional Theia handler deletions remain untouched. Run the formatter after reverting the cleanup experiment. No version, dependency manifest, lockfile or product patch changes were made for recovery.
- The two restored worker files disappeared again during the native opener run, with worker termination and no complete suite result. Bitdefender and Windows Defender are installed; available Windows Defender events did not establish the actor. The user subsequently supplied a Bitdefender notice reporting potentially malicious behavior, all involved applications blocked, restart required, and detection `SuspiciousBehavior.567DCD8166FD2594`. This is the likely explanation for the process/file interruptions; the exact affected application list and whether the detection is a false positive remain unverified. Stop native-opener execution and further executable recovery after this confirmation. No antivirus exclusions, disablement or other security-setting changes were made. Keep native opener qualification separate from retention unit/CLI acceptance and report exclusions explicitly.
- Compatibility/migration: investigation and local installation recovery only; no retained product/API/data/test behavior changes and no migration. Impact is none; version remains 0.22.0 pending.

##### Validation

- Later user-supplied screenshot identifies the temporary opener executable as the Malware-labelled entry and reports 20 blocked applications. The cropped visible list also shows Codex PowerShell, `conhost.exe` and `tar.exe`, without the complete affected-file/action list. The native fixture is subsequently retired under a [separate correction record](docs/changes/2026-10-24-retire-native-opener-executable-fixture.md); earlier statements that no test change was retained describe this investigation before that correction.

- Post-restart follow-up: the user reported restarting Windows; the operating system reports boot at 2026-10-24 19:02:34 America/Phoenix. The two Vitest worker files, Turbo launcher/native binary, compiled service worker entry and tracked release-metadata script remain absent after the restart. Restart completion is not evidence that the blocked workflow is cleared. No files were restored and no native fixture or test runner was executed during this follow-up. Windows Event Log/provider inspection did not expose the Bitdefender event's affected application list; request that list and recorded actions from the product notification before further recovery or execution. Source inspection still identifies the native fixture's compile-and-launch chain, without establishing a false positive.
- The user could no longer find the notification. Read-only window inspection found Bitdefender Central in Chrome; locate the installed local Security Center, verify its executable's valid Bitdefender SRL signature, and open that vendor UI for inspection. Windows UI Automation exposes the Notifications/Advanced Threat Defense labels, but those controls provide no invoke pattern, keyboard focus or accelerator. No event details were recovered and no restore/exclusion/security controls were invoked. Direct event selection in the local product remains the human handoff; the affected processes and remediation actions are still unknown.
- Original cleanup failure: `.turbo/service-log-retention-opener-isolation.log` and `.turbo/service-log-retention-quality-final-source.log`.
- Runner startup failure before test discovery: `.turbo/service-log-retention-fixture-focused.log`. The package tarball hash matched the lockfile and existing installed package files matched the tarball; only the two missing files were copied.
- The native retry attempt remained incomplete (`.turbo/service-log-retention-repaired-focused.log`) and was reverted. No complete full-suite/native-opener pass is claimed. After restoration without the opener fixture, the ten retention/CLI tests passed and the restored Vitest files remained present. Build/typecheck/lint passed 25 tasks; other workspace test tasks passed 14 tasks after rebuilding the missing service worker entry. The remaining service suite explicitly excluded the native opener file and passed 730 tests with 6 skipped across 133 files; all other workspace test tasks passed. Full native-opener qualification remains pending. No restart was initiated from this session. Evidence: `.turbo/service-log-retention-isolated-verified.log`, `.turbo/service-log-retention-build-quality.log`, `.turbo/service-log-retention-other-tests-verified.log` and `.turbo/service-log-retention-rebuild.log`.

##### Files

- `packages/platform-service/src/assets/external-open.windows.test.ts`
- `scripts/create-release-metadata.cjs`
- `docs/changes/2026-10-24-native-opener-fixture-cleanup.md`

#### Review project, repository controls, security and completion gaps

**Impact:** none

[Permanent work record](docs/changes/2026-10-24-project-session-review.md).

##### Summary

Investigation-only review of PlayWeld at `7ccb07580d82164d16f63c6ce5404b81a754f1e6`, covering current repository settings, security signals and source boundaries, documentation consistency, incomplete features and improvement opportunities. No product repair or external configuration change is delivered.

##### Details

- Add `docs/PROJECT_REVIEW_2026-10-24.md` as the dated review artifact. Record the initially clean checkout and matching GitHub main, current source/local-record/public-release distinctions, independent offline architecture/security review, and partial security coverage. Preserve ordinary profiles, private overrides, credentials, existing work and all historical release records.
- Identify a source-backed Windows asset-opening command-interpreter boundary failure, independently reviewed by the baseline auditor and parent. Record the realistic filename-control/user-action prerequisites, medium severity, remediation invariant and missing adversarial coverage without publishing a working payload. Full source evidence is retained in the private Codex Security scan; no payload was executed and no fix is claimed.
- Refresh full and production-only npm advisory snapshots and live GitHub Dependabot, CodeQL and secret-scanning counts. Distinguish package-level propagation from independent exploit counts, retain CodeQL counterevidence and Drive query-escaping robustness work, and recommend compatibility-preserving dependency review rather than incompatible automatic fixes.
- Verify active main ruleset, Actions allowlist and external-contributor policy, restricted default token permissions, security features and CodeQL configuration through read-only APIs. Separate already-live settings from proposed security-policy/Actions-update files in concurrent PR #8, and record existing dependency PR check failures without taking ownership of or diagnosing their changes. No setting, alert, issue, PR or release was changed.
- Document contradictory live-provider and hosted-CI claims in status/plan against later evidence, and distinguish old review receipts from current status. Generated reference freshness is separate from semantic prose correctness. Do not alter confirmed decisions or work-package statuses in this investigation.
- Identify repeated subprocess creation and heading rescans in the shell Markdown link checker as review-tool overhead. Attempt it through Git Bash and WSL, stop the task-owned checks after extended execution without results, and validate the same full Markdown scope/rules with a read-only cached Python implementation. No checker source was changed.
- Inventory remaining release/recovery, plugin isolation/trust, provider/routing/spend, engine/DCC/assets/MCP/A2A, backup/state, swarm/canon, product/UI/accessibility and quality/performance obligations. Preserve user-owned decisions and technical dependency ordering in the plan. Record explicit app check skips and targeted maintainability opportunities without broad refactoring.
- Compatibility and migration: no product source, dependency, package version, persisted schema, RPC contract or runtime configuration changes; no migration required. Impact `none` reflects a documentation/investigation task.

##### Validation

- Initial full `npx turbo run build typecheck lint test --concurrency=1`: 33/33 successful, all cached. `npx turbo run test --force --concurrency=1`: 15/15 successful, zero cached, 888 tests passed and seven skipped across 180 test files. Platform service: 679 passes/six skips; extension: 133 passes; contracts: 71 passes; extractor: one pass/one skip; client: two passes; SDK/sample: one each. Capability/OS/symlink-dependent cases and unavailable native Godot remain skipped; managed native Qdrant ran. Electron's placeholder test task remains distinct from executed application tests.
- Before report creation, `npm run format:check`, generated system-reference/inventory checks, documentation-evidence check and release-version check passed. Release version remains 0.22.0. Fresh npm audit commands exit nonzero for advisories, not a passing security gate.
- GitHub readback and independent static source review performed; static traces are not runtime exploit, installed isolation, or production acceptance evidence. Completed and sealed Codex Security scan `5d1d271e-6078-48a7-8f6d-d9f0e64dba6f` records one medium finding, nine reviewed surfaces and partial repository coverage with explicit follow-up. Its original-snapshot warning reflects the added review documentation/changelog; application source did not change. Local quality/test/format/audit logs are retained under ignored `.turbo/session-review-2026-10-24-*`.
- Final `npm run format:check`, `npm run changelog:update`, `npm run changelog:check -- --base HEAD` and `git diff --check` passed. The required `scripts/check-links.sh` was attempted under Git Bash and WSL but stopped after extended execution without a result; this is not a passing shell-check claim. A read-only cached Python equivalent checked the same fence/link/heading-slug rules across 351 Markdown files and 1,455 relative links: zero errors. Later prose edits introduced no additional links.
- Not run: dependency reinstallation, fresh Linux/desktop/browser/engine/DCC/provider/package/installer acceptance or exploit payload. Existing native dependencies and ordinary runtime data were preserved. Whole-repository line-by-line security review remains incomplete.

##### Files

- `docs/PROJECT_REVIEW_2026-10-24.md`
- `docs/changes/2026-10-24-project-session-review.md`
- `CHANGELOG.md`

#### Retire the compiled Windows opener executable fixture

**Impact:** none

[Permanent work record](docs/changes/2026-10-24-retire-native-opener-executable-fixture.md).

##### Summary

Remove the automated Windows opener fixture that compiled and executed a temporary program after the user's Bitdefender notification identified that exact executable. Preserve process-boundary coverage with mocks and explicitly retain the native-launch acceptance gap.

##### Details

- The screenshot identifies `literal&'%GC_OPEN_TEST%^!(asset).exe` under a temporary `gc-native-open-*` directory as the Malware-labelled entry and reports 20 blocked applications. The visible additional entries include the Codex PowerShell runtime (`pwsh.exe`), Windows `conhost.exe`, and `tar.exe`; the cropped image does not show all 20 applications or all remediation actions. This directly matches the fixture constructed by the native test. It supports associating the block with that test workflow, without proving the generated program was a false positive or that every blocked application was independently malicious. Do not publish machine-specific account paths or copy private notification/account data into source records.
- Delete `packages/platform-service/src/assets/external-open.windows.test.ts`. It compiled a C# executable with the Windows .NET compiler, renamed it to metacharacter/Unicode filenames and launched it through the real default opener before removing its temporary directory. This compile-and-launch chain is no longer part of ordinary test discovery; no hidden opt-in flag, skipped copy or executable-generating replacement is retained. The generated C# source was intended only to write a receipt, but that source inspection does not analyze or clear the quarantined executable.
- Retain the existing `external-open.test.ts` process mock. Add the reported metacharacter pattern as a harmless `.png` filename with plain fixture data, and require the exact fixed PowerShell invocation with `Invoke-Item -LiteralPath` and the dedicated environment variable. The process launcher remains mocked: this test does not compile code, create a PE executable, invoke PowerShell or open an asset. Existing path rejection, configured interpreter restrictions, literal argument forwarding and failure/timeout expectations remain intact. Production opener code, public contracts and permissions are unchanged.
- This deliberately removes real native association/launch coverage; do not describe the replacement mock as equivalent native acceptance or mark the complete full gate passed because the fixture is gone. Record the boundary in technical architecture, WP15's authoritative plan text and current status. Native qualification needs a reviewed method. An independent pre-existing installer-handoff test also compiles native fixtures; it was inspected, left unchanged and not executed in this correction. Retiring this opener fixture does not certify the entire suite against endpoint protection.
- Preserve the earlier investigation and recovery record, adding a link to this later correction rather than rewriting the previous attempted cleanup/recovery as a successful fix. The service-log retention implementation and earlier successful bounded checks remain unchanged. No blocked file restoration, quarantine operation, antivirus setting/exclusion, package installation or fresh native test run is performed after the screenshot review.
- Compatibility/migration: test/documentation change only; no runtime/API/data/dependency or schema migration. Exact deleted path and modified paths are listed below. Impact is none; product version remains 0.22.0 pending, with no installer, tag or release prepared.

##### Validation

- Matched the screenshot's executable basename and temporary-directory prefix to the reviewed native fixture source before removal. Source review confirms the retained mocked path uses non-executable plain fixture data and intercepts `cross-spawn`; the new assertion pins the literal-path helper program. No generated executable was run to reproduce the security alert again.
- `node node_modules/prettier/bin/prettier.cjs --check packages/platform-service/src/assets/external-open.test.ts` passed after formatting. This is static parsing/formatting evidence, not a passing test result.
- Vitest cannot run from the current installation because its two worker/preload files remain absent after endpoint cleanup. Turbo's launcher/native binary and the compiled service worker are also absent; no restoration or alternate runner is used to bypass that state. The new mock case/assertion, full build/test gate and native qualification remain unverified. Earlier 966-pass/7-skip results predate this test correction and excluded the native opener; they are not validation of this change.
- Changelog generation and coverage passed with `node scripts/change-tracking.cjs update` and `node scripts/change-tracking.cjs check --base HEAD`. Repository-wide Prettier checking passed; `scripts/check-links.sh` passed through WSL with `All links OK`; `git diff --check` passed (Git reported existing CRLF normalization notices).
- Read-only recovery preparation verified the cached Vitest 5.0.5, Turbo 2.11.2 and Windows Turbo 2.11.2 archives against their exact `package-lock.json` SHA-512 integrity values and read the affected archive members without extracting or executing them. The Windows archive uses the `turbo-windows-x64/bin/turbo.exe` member path. The four affected dependency files, compiled service worker and tracked release-metadata script remain absent. Archive integrity establishes package provenance only; it does not adjudicate the behavioral detection or authorize quarantine recovery.
- No live engine/provider/DCC, application/installer, vendor false-positive adjudication or security-product configuration claim is made.

##### Files

- `packages/platform-service/src/assets/external-open.windows.test.ts`
- `packages/platform-service/src/assets/external-open.test.ts`
- `docs/TECHNICAL_ARCHITECTURE.md`
- `docs/DEVELOPMENT_PLAN.md`
- `docs/STATUS.md`
- `docs/changes/2026-10-24-native-opener-fixture-cleanup.md`
- `docs/changes/2026-10-24-retire-native-opener-executable-fixture.md`

#### Hosted qualification and integration of security remediation

**Impact:** none

[Permanent work record](docs/changes/2026-10-25-hosted-security-integration.md).

##### Summary

Qualify and merge [PR 15](https://github.com/scarecr0w12/PlayWeld/pull/15) after all eight checks passed, then verify zero open Dependabot, CodeQL and secret-scanning alerts on the actual main revision. Preserve the distinction between fixed findings and reviewed false-positive dismissals.

##### Details

- The user explicitly authorized checking hosted results, correcting remaining issues, merging PR 15 only after checks pass and verifying Dependabot/CodeQL resolution afterward. The starting local and remote head is `968ca5de74cc51004b495ca899759978b6f9e5c5`; the working tree was clean. Retain existing product version 0.22.0 and all separate security/feature records.
- Read PR/job/analysis state through the GitHub connector and use authenticated alert APIs where the connector has no alert endpoint. Initial hosted CodeQL Actions and JavaScript/TypeScript jobs and GitGuardian passed. Both PR analysis records contain zero results without errors/warnings; this is evidence for that PR analysis, not a default-branch closure claim. Linux quality, Windows quality and browser build/smoke were still running.
- Mark the draft ready for review under the merge authorization. The existing workflow's `ready_for_review` trigger schedules a replacement CI run; retain cancelled/superseded runs as historical attempts rather than failures or successful gates. Do not remove workflow checks, bypass a failed job, weaken assertions or change endpoint-protection settings to obtain a pass.
- Commit the initial acceptance record as `8d2cd9e6f361e90e77402f9a9f283a7a81da8413`, then qualify that final PR head. All eight checks passed: Linux quality, Windows quality, browser build/smoke, both CodeQL language jobs, the aggregate CodeQL check, GitGuardian and Kilo review. The automated review is supplementary sampled/incremental evidence, not exhaustive manual acceptance. No additional production-code correction was required by these hosted results.
- Integration policy: inspect the latest PR head, all applicable check results and mergeability immediately before merging, and supply the expected head SHA to GitHub's merge operation. Preserve the branch's permanent records and source fixes. Only a passing head may be merged. Afterward, distinguish patch-driven fixed alerts from the previously documented false-positive dismissal of CodeQL alert 12; do not dismiss Dependabot or unresolved source findings to reduce counts.
- Post-merge verification must read main's actual merge SHA, completed CodeQL analysis for that main revision, and current Dependabot/CodeQL/secret-scanning states. A green PR job or a pushed branch alone does not meet this acceptance criterion. No release, installer publication, ordinary profile/Project changes, antivirus exclusions or access to the flagged temporary executable are part of this work.
- Merge through the GitHub connector with the expected head SHA after an immediate all-checks-success/mergeability readback. GitHub confirms merge commit `e37cf1e21cc9a9d557cb6223bcc5d88660a4073d` at 2026-10-25 23:26:40 UTC (16:26:40 America/Phoenix). All fourteen previously open Dependabot alerts now have state `fixed` and fix timestamps immediately after merge, with no dismissal reasons. Fresh main CodeQL analysis automatically fixes alerts 1-10.
- Main JavaScript/TypeScript analysis still reports the vector cache-identity finding (12, already dismissed) and missing-rate-limit warning (11). Inspect the exact reported route at merged commit `e37cf1e`, including the source-address limiter before `parseBearer`/`authenticate`, the independent client/invalid-token quotas and the hosted eleven-test A2A suite. The exhaustion regression proves a valid request returns 429 without any database preparation after the ceiling and succeeds after its window resets. The residual warning does not recognize this custom guard. Dismiss alert 11 as a scoped false positive with that source/test rationale; do not suppress the query or replace the working limiter solely to satisfy scanner recognition. Final CodeQL state is ten fixed findings and two documented false-positive dismissals, not twelve automatic fixes and not zero raw analyzer results. No additional production change is made for disposition.
- Update the living status snapshot and security bullets with merged/hosted results and current alert states, replacing the obsolete pending-full-gate wording. Native default-opener qualification stays pending despite the passing remaining repository suite; the Bitdefender event is not classified as a false positive by this CodeQL triage.
- Concurrent documentation edits appeared in the shared checkout after integration. Preserve that checkout's modified changelog and new Project-feature inventory record. Use a separate detached worktree at the merged main revision for this verification receipt, without staging, resetting, switching or committing the other work. The final evidence update changes only this record, the living status and generated changelog.
- A documentation-only follow-up commit was rejected by GitHub's main rules with GH013: changes require a pull request and three required status checks. The rejected push did not change main. Publish the final receipt on a separate `codex/hosted-security-receipt` branch as [PR 16](https://github.com/scarecr0w12/PlayWeld/pull/16), retaining the protected workflow. The user subsequently authorized checking that PR, correcting remaining issues and merging only after all its checks pass. Mark PR 16 ready and inspect the latest checked head before its expected-SHA merge; never bypass required checks. This follow-up changes documentation only and preserves the concurrent inventory edits in the shared checkout.
- Compatibility/migration: evidence and integration maintenance only, with no production/API/schema/dependency changes or data migration. Impact is none. No hosted defect required another production correction; no installer, tag, version bump or release is prepared.

##### Validation

- Starting PR-head CodeQL analyses for `968ca5de74cc51004b495ca899759978b6f9e5c5` report zero results: JavaScript/TypeScript analysis 2023704870 with 87 rules and Actions analysis 2023702873 with 17 rules, both without errors/warnings. GitGuardian is successful. These are hosted scanner observations, not proof of universal application security.
- Initial CI run 40243392046 was superseded after marking the PR ready, followed by run 40243599308; both are cancelled attempts, not passing gates. Final [CI run 40243704915](https://github.com/scarecr0w12/PlayWeld/actions/runs/40243704915) passed all three jobs on head `8d2cd9e6f361e90e77402f9a9f283a7a81da8413`.
- Linux and Windows each passed the complete unexcluded `npx turbo run build typecheck lint test --concurrency=1` gate with 33 successful tasks, plus 13 change-tracking tests, nine cache-maintenance tests, release-version agreement, generated-reference/inventory freshness, documentation-evidence integrity and formatting. Linux's Markdown-link check passed; the workflow intentionally runs that step only on Linux. Service results are 723 passes/16 skips across 133 files on Linux and 729 passes/10 skips across 133 files on Windows. OS/capability skips remain explicit; these are not universal native integration or installer qualification. App-shell placeholder checks remain placeholders. Hosted suites include the existing installer-handoff tests without reintroducing the retired opener fixture or executing it on this PC.
- The hosted browser build and smoke passed 33 checks with no renderer errors. The [browser evidence artifact](https://github.com/scarecr0w12/PlayWeld/actions/runs/40243704915/artifacts/12617981726) uploaded successfully. Fixture/browser evidence is separate from packaged/installed desktop acceptance or arbitrary real engines/providers.
- Current hosted actions emit nonblocking Node.js 20 deprecation/forced-Node-24 warnings, and npm reports existing transitive deprecations. These warnings did not fail a job; the hosted install reports zero vulnerabilities. Do not replace pinned actions or force incompatible dependency upgrades solely to hide deprecation warnings during this acceptance task.
- Before merge, an immediate API readback confirmed the exact head, a clean mergeable state and all eight checks `COMPLETED/SUCCESS`; local evidence is `.turbo/hosted-security-premerge-checks.json`. The merged PR and API readback confirm the expected-head merge succeeded. Local Markdown-link validation also passed (`.turbo/hosted-security-integration-links.log`).
- Post-merge Dependabot readback confirms fixed alerts 39-49 and 52-54: all fourteen original open alerts, fixed at 23:26:46-48 UTC. Main Actions analysis 2023752417 reports zero results; JavaScript/TypeScript analysis 2023756371 reports two raw findings, the reviewed false positives, with no errors/warnings. Both hosted jobs completed successfully on merge commit `e37cf1e`. Alerts 1-10 are confirmed fixed; alerts 11-12 are confirmed dismissed as false positive. Final API readback shows zero open Dependabot, CodeQL and secret-scanning alerts. Alert snapshots are local under `.turbo/hosted-security-*-after-merge.json`; the remote alert histories retain the actual fix/dismissal reasons.
- Final receipt formatting, whitespace, changelog generation/coverage and Markdown links passed in the isolated worktree. Publish only this record, the living status and generated changelog as documentation-only PR 16. Its initial browser build/smoke, both CodeQL analyses and GitGuardian passed while Linux/Windows quality jobs were running. The ready-for-review event and this correction to the authorization/pending wording schedule fresh checks; use their actual final results before integration. The PR's check timeline and merge receipt retain the final head-specific outcome. This receipt does not replace the passing PR 15 gates or claim an installed product upgrade. Main's automatic quality reruns are separate from the completed pre-merge gate.

##### Files

- `docs/changes/2026-10-25-hosted-security-integration.md`
- `docs/STATUS.md`

#### Retain hosted knowledge-recovery checks and retry incomplete review

**Impact:** none

[Permanent work record](docs/changes/2026-10-25-knowledge-recovery-hosted-review.md).

##### Summary

Record the hosted evidence for the knowledge lexical-index recovery candidate and retry the automated review that failed before producing a review. Integration remains conditional on the final PR checks.

##### Details

- Rechecked [PR 18](https://github.com/scarecr0w12/PlayWeld/pull/18) at source commit `6ae5e8fd7837176d8499e61690a699ef824e67ff`. The Linux quality and browser jobs completed successfully; CodeQL and GitGuardian passed. The Windows job was still active when a documented ready-for-review trigger superseded the initial CI run. Cancellation is not a completed Windows result.
- The Kilo review check reported an output-limit failure and explicitly stated that no complete review was produced. There were no inline review threads or code findings to adjudicate. This is an incomplete review, not approval and not evidence of a source defect.
- GitHub's check-run and check-suite rerequest endpoints both returned HTTP 404 for the authenticated session. A draft-to-ready transition restarted CI, but no new Kilo review appeared on the same SHA. Kilo documents [ready-for-review triggers and PR/commit deduplication](https://kilo.ai/docs/automate/code-reviews/github). This evidence commit supplies a new commit for the supported push trigger without changing the model, review policy, branch rules, tests or source behavior.
- Re-read the store transaction, FTS-specific error gate, full-request scheduling, result metadata and corresponding regression tests against the PR diff. The repair is confined to the external-content lexical index; the original record retains the source/test evidence and remaining recovery limits. Final review feedback still requires evaluation before integration.
- The matching Features Project card will record the final PR/merge evidence after checks complete. Its combined recovery/retention scope remains In progress; no other card or planning field is part of this change.
- Compatibility and versioning: documentation/evidence only, impact none, product version 0.22.0 pending. No migration, dependency, RPC/schema, setting or runtime change. The original implementation record is preserved, including its local-test exclusions and evidence boundaries.

##### Validation

- [Initial hosted CI run 40270177416](https://github.com/scarecr0w12/PlayWeld/actions/runs/40270177416): Linux completed all 33 build/typecheck/lint/test tasks; platform-service tests were 762 passed/16 skipped across 136 files. Tracking tests passed 13 cases; subsequent cache, version, references, documentation evidence, formatting and link checks passed. These are unexcluded hosted commands, distinct from the earlier local service exclusions.
- The same run's browser build and live UI smoke passed with an empty renderer-error list. CodeQL Actions, JavaScript/TypeScript and aggregate checks and GitGuardian passed on the source commit.
- Check metadata, bot discussion and inline review threads were read from GitHub. The failed Kilo review returned zero annotations and no complete review. Both rerequest POST calls returned 404. The same-SHA ready event started [replacement CI run 40271520041](https://github.com/scarecr0w12/PlayWeld/actions/runs/40271520041); it is interim evidence, not a final integration pass.
- Documentation formatting, changelog generation/coverage and relative-link checks are performed for this evidence change before commit. Final-head hosted results, any subsequent fixes and the merge receipt belong to the PR timeline and matching Project note; none are claimed as completed in this historical pre-integration record.
- No source tests were rerun locally for this documentation-only change. This does not qualify installed-product recovery, native opener behavior, a release, or broader corruption/retention work. Endpoint protection and the flagged executable were left unchanged.

##### Files

- `docs/changes/2026-10-25-knowledge-recovery-hosted-review.md`
- `CHANGELOG.md`

#### Verified developer-tool recovery and focused retention verification

**Impact:** none

[Permanent work record](docs/changes/2026-10-25-verified-tooling-recovery.md).

##### Summary

Recover the six missing developer/build files with explicit user authorization and pass the mocked opener and retention checks after retiring the executable-generating opener fixture.

##### Details

- The user authorized restoring verified files and rebuilding the service worker, with Bitdefender enabled and the flagged temporary executable left alone. Recheck each cached Vitest 5.0.5 and Turbo 2.11.2 archive against the exact package-lock SHA-512 integrity value before reading selected members. Restore only `suppress-warnings.cjs`, `dist/workers/forks.js`, the Turbo launcher and Windows binary; refuse to overwrite an existing destination and verify restored bytes. The Windows binary archive member is `turbo-windows-x64/bin/turbo.exe`. No package installation, dependency-version or lockfile change is made.
- Restore the accidentally removed `scripts/create-release-metadata.cjs` directly from `HEAD`, preserving its exact Git bytes. Force the platform-service TypeScript project build, including project references, so the missing `lib/workers/worker-main.js` is regenerated from current source rather than recovered from quarantine; run the existing asset-copy script. This removes the accidental source deletion without reverting either intentionally removed frontend handler or unrelated pending work.
- Run only selected existing tests: the process-mocked opener (including the newly strengthened fixed-command assertion), logger pruning and lifecycle, compiled CLI lifecycle/startup failure, audit-retention unit and RPC integration, and audit-retention panel. The CLI tests use disposable profiles; no ordinary profile or Project is selected. Do not run the retired opener fixture, the independent installer-handoff executable fixtures or a whole-suite command that would include them.
- Update current status and WP15's authoritative plan text to replace the missing-tool/unrun-mock state with the actual recovery and focused results. Earlier investigation and fixture-retirement records remain historical evidence; this record supplies the later outcome. Native opener association/launch acceptance and the complete repository gate remain pending. Archive integrity and passing tests do not classify Bitdefender's behavioral detection as a false positive.
- Compatibility/migration: maintenance and validation only; no production source, public API, schema, setting, dependency or data migration. Impact is none and version remains 0.22.0 pending. Bitdefender settings, exclusions and quarantine were not changed, and the flagged temporary executable was not accessed or executed. No package, installer, tag or release is prepared.

##### Validation

- All three cached archives matched their exact lockfile integrity hashes before restoration; the five restored file contents were checked byte for byte. A subsequent presence check found all six expected files, including the regenerated worker.
- `node node_modules/typescript/bin/tsc -b packages/platform-service --force` and `node packages/platform-service/scripts/copy-assets.cjs` passed. This verifies source compilation and asset copying, not application or installer acceptance.
- `npm test -w @gamecrafter/platform-service -- src/assets/external-open.test.ts src/logger.test.ts src/cli.test.ts src/audit/audit-retention.test.ts src/audit/audit-retention.integration.test.ts` passed 38 tests across five files, with no skips, in 11.94 seconds. Evidence: `.turbo/verified-recovery-focused-tests.log`.
- `npm test -w @gamecrafter/theia-control-room -- src/browser/audit-retention-panel.test.tsx` passed six tests in one file, with no skips. Evidence: `.turbo/verified-recovery-retention-panel.log`. This is automated component evidence, not rendered browser acceptance.
- `npm run format:check`, `npm run changelog:update`, `npm run changelog:check -- --base HEAD` and `git diff --check` passed. Git emitted existing CRLF normalization notices. `scripts/check-links.sh` passed through WSL with `All links OK` (evidence: `.turbo/verified-recovery-links.log`). After testing, all six expected files were still present, the restored release-metadata script matched `HEAD` exactly and the retired native opener test remained absent.
- No fresh full-suite, native opener, installer-handoff, packaged desktop, live engine/DCC/provider or vendor security-adjudication result is claimed. The earlier real one-minute quiet-pruning acceptance was not repeated; the current logger test exercises periodic pruning through fake timers.

##### Files

- `scripts/create-release-metadata.cjs`
- `docs/DEVELOPMENT_PLAN.md`
- `docs/STATUS.md`
- `docs/changes/2026-10-25-verified-tooling-recovery.md`

#### Prepare version 0.23.0

**Impact:** none

[Permanent work record](docs/changes/2026-10-26-release-0.23.0.md).

##### Summary

Prepare version 0.23.0 from 0.22.0, retaining all pending work records in the changelog and detailed release notes.

##### Details

Synchronize all nine first-party workspace and exact internal dependency versions from 0.22.0 to 0.23.0 and refresh the lockfile without changing third-party selections. Assign all already-merged pending records and the approved MCP discovery and Requests keyboard fixes to this testing release. The minor bump satisfies the recorded compatible feature impacts. Integrate both original PR heads as parents of the release branch; resolve only the generated changelog conflict by regenerating it from their permanent records. Publish only after protected-branch checks and native Windows/Linux packaging succeed. No application/schema migration, security setting or credential change is introduced by preparation. The original checkout's unrelated changelog/planning changes and other agents' branches remain preserved.

##### Validation

- Version preparation and `npm install --package-lock-only --ignore-scripts --no-audit --no-fund` passed. Existing native dependencies were reused; no new `npm ci` was run locally. The lockfile diff contains only first-party version changes.
- Combined service suite: 783 passed, eight skipped across 135 files in 522.50 seconds. Local native installer executable fixtures and live Blender remain excluded; hosted quality uses its normal unexcluded commands.
- The first concurrent build hit a locked AppContainerHost.exe while service tests were using the helper. After the suite exited, sequential build/typecheck/lint passed all 25 tasks in 28.296 seconds, including Electron/browser builds. Other workspace tests passed all 14 tasks. This is source/build evidence, not installed desktop acceptance.
- The real-service built-browser keyboard/recovery scenario passed on the combined 0.23.0 candidate in Chrome 155.0.8059.79, with twelve focus/state observations and no renderer or cleanup errors. The optional development-shell favicon 404 remains explicitly qualified. Isolated local report: `release-ui-evidence/requests-keyboard-73DpHw/report.json` outside the checkout.
- Thirteen tracking tests and nine cache-maintenance tests passed. Version/changelog coverage, formatting, generated references/inventory, documentation evidence integrity and the full Markdown link check passed; the separate release-link correction preserves the five evidence references.
- Protected-branch CI, native package production, downloaded checksum/provenance checks and publication are subsequent gates and are not claimed by this preparation record. No publisher signing, installed upgrade/uninstall/rollback, broad accessibility, live provider/engine or ordinary-profile acceptance is established here. Later publication evidence receives a separate permanent receipt.

##### Files

- `packages/archive-extractor/package.json`
- `packages/contracts/package.json`
- `packages/platform-service/package.json`
- `packages/plugin-sdk/package.json`
- `packages/service-client/package.json`
- `packages/theia-control-room/package.json`
- `packages/plugins/sample-hello/package.json`
- `apps/control-room/package.json`
- `apps/control-room-browser/package.json`
- `package-lock.json`

#### Keep GitHub publication notes within the service limit

**Impact:** none

[Permanent work record](docs/changes/2026-10-27-bounded-release-publication-notes.md).

##### Summary

Publish concise version notes and attach the complete permanent 0.23.0 notes instead of submitting an oversized release body.

##### Details

The generated 0.23.0 notes exceeded 181 KB. GitHub's release API reports a maximum body length of 125,000 characters, so passing that file directly to publication would fail after packaging. Validate an independently authored, nonempty version summary before native packaging; use that summary as the draft release body and upload the complete generated notes as a separate Markdown asset. Keep all permanent records, detailed version notes and the full changelog intact. Future preparations must author their version summary before release packaging. No package/runtime/schema, security permission, signing key or credential change is introduced.

##### Validation

- Verified the service's actual 125,000-character error in [a public GitHub Actions API error annotation](https://github.com/music-assistant/server/actions/runs/18089326861). The generated notes exceed that limit; the concise 0.23.0 summary is below it.
- Validated workflow YAML and the publication-note guard with current notes, an empty body and an oversized Unicode body. Full notes remain byte-for-byte the generated version artifact. Protected PR and native packaging checks are subsequent gates, not claimed by this record.
- No tag, release publication, installed upgrade or signing acceptance is established by this tooling correction.

##### Files

- `.github/workflows/release.yml`
- `docs/releases/v0.23.0-summary.md`
- `docs/RELEASE_GUIDE.md`

## 0.22.0

### Fixed

#### Refresh authorized tools between running agent turns (F09)

**Impact:** patch

[Permanent work record](docs/changes/2026-10-18-agent-tool-refresh-fix.md).

##### Summary

MCP list-change events refreshed the service registry, but running agents continued advertising their startup tool/schema snapshot. Private worker IPC now requests a fresh role/access-filtered snapshot at each model-turn boundary before schema-aware compaction and token estimation.

##### Details

- MCP list-change events refreshed the service registry, but running agents continued advertising their startup tool/schema snapshot. Private worker IPC now requests a fresh role/access-filtered snapshot at each model-turn boundary before schema-aware compaction and token estimation.
- Added/removed/schema-changed tools are reflected in subsequent turns without restarting the worker. Runtime-internal completion/question tools are retained appropriately; broker checks still authorize every execution.
- Tool inspection failures are returned to the worker as structured errors rather than escaping the asynchronous supervisor handler as unhandled rejections. The worker fails safely if discovery cannot establish the current authorized tools.
- No public RPC or persisted schema change, no new protocol revision assumption, and no migration. The mechanism consumes the existing authoritative registry rather than duplicating MCP discovery. Patch impact.

##### Validation

- Agent runtime regression checks changed schemas/tool membership across turns; real worker IPC tests verify refreshed snapshots and safe failure propagation. The final five-case worker IPC suite passed.
- MCP protocol and connector tests remain fixture evidence unless explicitly reported as a live engine operation; no external provider was required.
- Final `npx turbo run build typecheck lint test` passed: 33/33 tasks successful, 22 cache hits for unchanged task inputs, 7m24.71s. The changed platform-service suite ran uncached: 128 files passed, 678 tests passed and six skipped. Theia Control Room verification passed 133 tests across 28 files; other workspaces contributed 76 passing tests and one skip, for 887 passing test cases and seven skips across the monorepo gate. App wrapper test/typecheck/lint scripts that intentionally print skip are not counted as additional test cases. Both Electron and browser application builds completed with zero build errors.
- Skips were existing Windows/platform prerequisites or unavailable real Godot: Linux-only plugin/isolation cases, symlink/process/credential permission cases, and the archive symlink case. The suite did run real local Blender/WSL inspect/export/render and exception tests, real local Qdrant persistence/isolation tests, and Windows LPAC probes with Node and Electron. Unity/Unreal engine identity/bridge cases and paid-provider behavior used deterministic fixtures; no paid external model/asset generation, ordinary production profile acceptance, or new installer lifecycle was performed.
- The first broad gate exposed the missing gameplay-module fixture, successful-parent continuation incompatibility, and duplicate board-audit usage; those were corrected without weakening the preserved acceptance assertions. Because source corrections occurred while that initial run was active, its mixed-state failures are not the acceptance result. A fresh complete run supplied the successful result above. A final planner-role cleanup was rebuilt and its role/registry/bundled-skill checks passed seven tests across three files.
- `bash scripts/check-links.sh` passed with All links OK. `npm run format:check`, `git diff --check`, `npm run changelog:update`, and `npm run changelog:check -- --base HEAD` passed. The final full-gate output is retained locally at `.artifacts/agent-swarm-fixes/full-turbo.log`. Existing manifests/lockfile and the six pre-existing repository Electron processes were preserved; no release/version assignment was performed.

##### Files

- `packages/platform-service/src/agents/agent-runtime.ts`
- `packages/platform-service/src/agents/agent-runtime.test.ts`
- `packages/platform-service/src/workers/supervisor.ts`
- `packages/platform-service/src/workers/types.ts`
- `packages/platform-service/src/workers/worker-main.ts`
- `packages/platform-service/src/workers/supervisor-await.test.ts`
- `packages/platform-service/src/workers/supervisor-await-fixture.cjs`
- `docs/SKILLS_AGENTS_AND_TOOLS.md`
- `docs/changes/2026-10-18-agent-tool-refresh-fix.md`

#### Apply role module, pool and board-subscription metadata (F10)

**Impact:** patch

[Permanent work record](docs/changes/2026-10-18-role-metadata-policy-fix.md).

##### Summary

Role requiresModules, modelPool and boardSubscriptions fields previously had no runtime consumers. TaskService now validates agent-task module prerequisites against the current Project manifest before creating work. Missing modules produce an actionable role error instead of implicit module enablement.

##### Details

- Role requiresModules, modelPool and boardSubscriptions fields previously had no runtime consumers. TaskService now validates agent-task module prerequisites against the current Project manifest before creating work. Missing modules produce an actionable role error instead of implicit module enablement.
- ModelRouter intersects configured named role pools with existing role/task/global pool constraints, including manual IDs and prepared completion preflight. Builtin names remain optional defaults until configured; missing custom-role pool names fail closed. Unrecognized ad hoc routing identities retain existing routing instead of being mistaken for invalid installed roles.
- Plugin/facade model requests preserve plugin attribution while intersecting originating role pool constraints. Central completion infers the recorded task roles as additional restrictions, so changing routing identity or supplying a raw model ID cannot escape the task pool.
- Agent-task creation reconciles persisted agent-role board subscription filters: wildcard means all topics, empty declarations remove stale role filters, changed filters replace previous declarations, and user/task subscriptions remain untouched. Records do not start agents automatically.
- Implicit agent roles normalize to coordinator, matching runtime defaults and applying the same role ceiling/subscription policy. Documentation records these engineering defaults without changing confirmed decisions or work-package status.
- The existing scripted swarm acceptance fixture now explicitly enables its gameplay module when creating the disposable Project. Previously it implicitly delegated gameplay engineers without declaring that prerequisite; correcting the fixture preserves the new prerequisite check instead of weakening it.
- No RPC/storage schema or dependency change; no migration required. Existing custom roles with unresolved named pools or missing required modules must correct their configuration. Patch impact restores documented role behavior.

##### Validation

- Named-pool, module-prerequisite, board-reconciliation and implicit-coordinator regressions failed before their fixes and passed afterward. The final owned-area run passed 57 tests across 13 files with one Windows symlink skip.
- The subsequent facade pool regression passed before dependency restoration; the final combined six-file run passed 58 tests after restoration, including pool/facade and paid asset-approval coverage. An independent read-only review found the facade pool interaction and it was corrected before final verification.
- Final `npx turbo run build typecheck lint test` passed: 33/33 tasks successful, 22 cache hits for unchanged task inputs, 7m24.71s. The changed platform-service suite ran uncached: 128 files passed, 678 tests passed and six skipped. Theia Control Room verification passed 133 tests across 28 files; other workspaces contributed 76 passing tests and one skip, for 887 passing test cases and seven skips across the monorepo gate. App wrapper test/typecheck/lint scripts that intentionally print skip are not counted as additional test cases. Both Electron and browser application builds completed with zero build errors.
- Skips were existing Windows/platform prerequisites or unavailable real Godot: Linux-only plugin/isolation cases, symlink/process/credential permission cases, and the archive symlink case. The suite did run real local Blender/WSL inspect/export/render and exception tests, real local Qdrant persistence/isolation tests, and Windows LPAC probes with Node and Electron. Unity/Unreal engine identity/bridge cases and paid-provider behavior used deterministic fixtures; no paid external model/asset generation, ordinary production profile acceptance, or new installer lifecycle was performed.
- The first broad gate exposed the missing gameplay-module fixture, successful-parent continuation incompatibility, and duplicate board-audit usage; those were corrected without weakening the preserved acceptance assertions. Because source corrections occurred while that initial run was active, its mixed-state failures are not the acceptance result. A fresh complete run supplied the successful result above. A final planner-role cleanup was rebuilt and its role/registry/bundled-skill checks passed seven tests across three files.
- `bash scripts/check-links.sh` passed with All links OK. `npm run format:check`, `git diff --check`, `npm run changelog:update`, and `npm run changelog:check -- --base HEAD` passed. The final full-gate output is retained locally at `.artifacts/agent-swarm-fixes/full-turbo.log`. Existing manifests/lockfile and the six pre-existing repository Electron processes were preserved; no release/version assignment was performed.

##### Files

- `packages/platform-service/src/models/router.ts`
- `packages/platform-service/src/models/router.test.ts`
- `packages/platform-service/src/models/completion-service.ts`
- `packages/platform-service/src/models/completion-service.test.ts`
- `packages/platform-service/src/models/completion-task-budget.test.ts`
- `packages/platform-service/src/plugins/plugin-host.ts`
- `packages/platform-service/src/tasks/task-service.ts`
- `packages/platform-service/src/tasks/task-role-policy.test.ts`
- `packages/platform-service/src/change/swarm-coordination.integration.test.ts`
- `packages/platform-service/src/service.ts`
- `docs/INTEGRATION_GUIDE.md`
- `docs/SKILLS_AGENTS_AND_TOOLS.md`
- `docs/changes/2026-10-18-role-metadata-policy-fix.md`

#### Use semantic work types for agent skill eligibility (F06)

**Impact:** patch

[Permanent work record](docs/changes/2026-10-18-skill-work-type-fix.md).

##### Summary

Agent skill search, activation and supporting-resource reads previously filtered by the handler name agent.run, hiding skills configured for semantic work such as code. They now resolve the role snapshot's primary work type, matching model execution, with coordination as the shared empty-role fallback.

##### Details

- Agent skill search, activation and supporting-resource reads previously filtered by the handler name agent.run, hiding skills configured for semantic work such as code. They now resolve the role snapshot's primary work type, matching model execution, with coordination as the shared empty-role fallback.
- Ordinary non-agent task kinds retain their original work-type behavior. Role and engine/access eligibility filters remain in place; the fix does not make filtered skills universally available.
- The regression configures role/work-type-specific skill metadata and verifies the same agent can discover, activate and read its supporting instructions. Existing catalog statistics remain recorded against existing task kinds; no historical activation rows are rewritten.
- No public schema, stored data or dependency migration is needed. Patch impact corrects skill availability. Updated integration/contract documentation explains the semantic-work-type distinction.

##### Validation

- The new semantic search/activation/resource regression failed before implementation and passed afterward. The final owned skills/roles/router/task-role run passed 57 tests across 13 files with one existing Windows symlink skip.
- Final `npx turbo run build typecheck lint test` passed: 33/33 tasks successful, 22 cache hits for unchanged task inputs, 7m24.71s. The changed platform-service suite ran uncached: 128 files passed, 678 tests passed and six skipped. Theia Control Room verification passed 133 tests across 28 files; other workspaces contributed 76 passing tests and one skip, for 887 passing test cases and seven skips across the monorepo gate. App wrapper test/typecheck/lint scripts that intentionally print skip are not counted as additional test cases. Both Electron and browser application builds completed with zero build errors.
- Skips were existing Windows/platform prerequisites or unavailable real Godot: Linux-only plugin/isolation cases, symlink/process/credential permission cases, and the archive symlink case. The suite did run real local Blender/WSL inspect/export/render and exception tests, real local Qdrant persistence/isolation tests, and Windows LPAC probes with Node and Electron. Unity/Unreal engine identity/bridge cases and paid-provider behavior used deterministic fixtures; no paid external model/asset generation, ordinary production profile acceptance, or new installer lifecycle was performed.
- The first broad gate exposed the missing gameplay-module fixture, successful-parent continuation incompatibility, and duplicate board-audit usage; those were corrected without weakening the preserved acceptance assertions. Because source corrections occurred while that initial run was active, its mixed-state failures are not the acceptance result. A fresh complete run supplied the successful result above. A final planner-role cleanup was rebuilt and its role/registry/bundled-skill checks passed seven tests across three files.
- `bash scripts/check-links.sh` passed with All links OK. `npm run format:check`, `git diff --check`, `npm run changelog:update`, and `npm run changelog:check -- --base HEAD` passed. The final full-gate output is retained locally at `.artifacts/agent-swarm-fixes/full-turbo.log`. Existing manifests/lockfile and the six pre-existing repository Electron processes were preserved; no release/version assignment was performed.

##### Files

- `packages/platform-service/src/skills/skill-service.ts`
- `packages/platform-service/src/skills/skill-catalog.test.ts`
- `docs/INTEGRATION_GUIDE.md`
- `docs/SKILLS_AGENTS_AND_TOOLS.md`
- `docs/changes/2026-10-18-skill-work-type-fix.md`

#### Give builtin specialists scoped integrated tool grants (F07)

**Impact:** patch

[Permanent work record](docs/changes/2026-10-18-specialist-connector-grants-fix.md).

##### Summary

Engine engineers, asset producers and validators previously received no tools from their corresponding integrated connector families. Builtin role definitions now enumerate appropriate engine operations, DCC operations and asset generation/job/import/preview/file operations; validators receive connector discovery/inspection while mutation exclusions remain.

##### Details

- Engine engineers, asset producers and validators previously received no tools from their corresponding integrated connector families. Builtin role definitions now enumerate appropriate engine operations, DCC operations and asset generation/job/import/preview/file operations; validators receive connector discovery/inspection while mutation exclusions remain.
- The broker supports a trusted engine wrapper's delegation to exactly its selected MCP implementation. This internal context cannot be supplied by ordinary tool/call RPC input, cannot grant arbitrary server access, and still enforces explicit downstream denies, effective access policy, Project availability and locks.
- Removed the planner's dangling task/create tool pattern, which matched no registered agent tool. Its role text now states the existing division of responsibility: submit the plan with tasks/complete, then let the coordinator create executable child tasks through tasks/delegate. No functioning task-creation API was removed from the planner.
- Role integration tests inspect the actual started service's registered tool catalog and prove paid asset generation still creates an Ask Always approval. The fixture uses a nonexistent account and rejects approval, so no provider request is made.
- A separate real broker regression proves direct raw MCP access, wrong selected-tool delegation, and a disallowed owning wrapper all fail; the exact authorized selection succeeds once, and an explicit downstream deny blocks it afterward.
- No public schema or migration. Roles retain their access ceilings and process/filesystem contracts. Paid generation remains approval-gated, and arbitrary engine console access is not added through a blanket wildcard. Patch impact.

##### Validation

- Role-grant and asset tests reproduced missing grants before implementation. The final six-file scoped run passed 58 tests, including asset approval denial.
- The new focused broker delegation regression passed; its other 16 tests were intentionally filtered in that invocation. It uses an in-memory MCP handler rather than a real engine.
- Final `npx turbo run build typecheck lint test` passed: 33/33 tasks successful, 22 cache hits for unchanged task inputs, 7m24.71s. The changed platform-service suite ran uncached: 128 files passed, 678 tests passed and six skipped. Theia Control Room verification passed 133 tests across 28 files; other workspaces contributed 76 passing tests and one skip, for 887 passing test cases and seven skips across the monorepo gate. App wrapper test/typecheck/lint scripts that intentionally print skip are not counted as additional test cases. Both Electron and browser application builds completed with zero build errors.
- Skips were existing Windows/platform prerequisites or unavailable real Godot: Linux-only plugin/isolation cases, symlink/process/credential permission cases, and the archive symlink case. The suite did run real local Blender/WSL inspect/export/render and exception tests, real local Qdrant persistence/isolation tests, and Windows LPAC probes with Node and Electron. Unity/Unreal engine identity/bridge cases and paid-provider behavior used deterministic fixtures; no paid external model/asset generation, ordinary production profile acceptance, or new installer lifecycle was performed.
- The first broad gate exposed the missing gameplay-module fixture, successful-parent continuation incompatibility, and duplicate board-audit usage; those were corrected without weakening the preserved acceptance assertions. Because source corrections occurred while that initial run was active, its mixed-state failures are not the acceptance result. A fresh complete run supplied the successful result above. A final planner-role cleanup was rebuilt and its role/registry/bundled-skill checks passed seven tests across three files.
- `bash scripts/check-links.sh` passed with All links OK. `npm run format:check`, `git diff --check`, `npm run changelog:update`, and `npm run changelog:check -- --base HEAD` passed. The final full-gate output is retained locally at `.artifacts/agent-swarm-fixes/full-turbo.log`. Existing manifests/lockfile and the six pre-existing repository Electron processes were preserved; no release/version assignment was performed.

##### Files

- `packages/platform-service/roles/engine-engineer/ROLE.md`
- `packages/platform-service/roles/asset-producer/ROLE.md`
- `packages/platform-service/roles/validator/ROLE.md`
- `packages/platform-service/roles/planner/ROLE.md`
- `packages/platform-service/src/roles/role-tools.integration.test.ts`
- `packages/platform-service/src/tools/tool-broker.ts`
- `packages/platform-service/src/tools/tool-broker.integration.test.ts`
- `packages/platform-service/src/engines/engine-connector-service.ts`
- `docs/INTEGRATION_GUIDE.md`
- `docs/SKILLS_AGENTS_AND_TOOLS.md`
- `docs/changes/2026-10-18-specialist-connector-grants-fix.md`

#### Yield and reacquire swarm capacity around child waits (F05)

**Impact:** patch

[Permanent work record](docs/changes/2026-10-18-swarm-await-capacity-fix.md).

##### Summary

Coordinators previously occupied execution slots while tasks/await polled queued descendants, starving children at a one-worker limit and when all slots held waiting coordinators. The supervisor now yields capacity only around supervised child waits while retaining the running task, leases, heartbeat and checkpoints.

##### Details

- Coordinators previously occupied execution slots while tasks/await polled queued descendants, starving children at a one-worker limit and when all slots held waiting coordinators. The supervisor now yields capacity only around supervised child waits while retaining the running task, leases, heartbeat and checkpoints.
- Await completion, timeout and error must reacquire a normal slot before the tool result returns. Resumption is prioritized over new tasks and counts toward configured concurrency. Additional tool calls while yielded are rejected; cancellation and process exit abort pending controllers and release waiters.
- Real forked-worker regressions exercise concurrency one and two with two coordinators and children, timeout resumption, subtree cancellation, refreshed tool snapshots and once-only service-accounted usage.
- No public task state, RPC shape or database migration was introduced. Concurrency remains an active execution limit; yielded coordinators remain supervised processes. Patch impact restores progress without increasing the configured active slot limit.

##### Validation

- The focused worker IPC suite passed five tests after the final refresh-error regression. Its broker fixture invokes the actual registered tasks/await handler with actual TaskService and forked child IPC.
- The earlier combined five-file worker/runtime/budget regression run passed 47 tests. These are fixture/process checks, not a live paid-model swarm acceptance claim.
- Final `npx turbo run build typecheck lint test` passed: 33/33 tasks successful, 22 cache hits for unchanged task inputs, 7m24.71s. The changed platform-service suite ran uncached: 128 files passed, 678 tests passed and six skipped. Theia Control Room verification passed 133 tests across 28 files; other workspaces contributed 76 passing tests and one skip, for 887 passing test cases and seven skips across the monorepo gate. App wrapper test/typecheck/lint scripts that intentionally print skip are not counted as additional test cases. Both Electron and browser application builds completed with zero build errors.
- Skips were existing Windows/platform prerequisites or unavailable real Godot: Linux-only plugin/isolation cases, symlink/process/credential permission cases, and the archive symlink case. The suite did run real local Blender/WSL inspect/export/render and exception tests, real local Qdrant persistence/isolation tests, and Windows LPAC probes with Node and Electron. Unity/Unreal engine identity/bridge cases and paid-provider behavior used deterministic fixtures; no paid external model/asset generation, ordinary production profile acceptance, or new installer lifecycle was performed.
- The first broad gate exposed the missing gameplay-module fixture, successful-parent continuation incompatibility, and duplicate board-audit usage; those were corrected without weakening the preserved acceptance assertions. Because source corrections occurred while that initial run was active, its mixed-state failures are not the acceptance result. A fresh complete run supplied the successful result above. A final planner-role cleanup was rebuilt and its role/registry/bundled-skill checks passed seven tests across three files.
- `bash scripts/check-links.sh` passed with All links OK. `npm run format:check`, `git diff --check`, `npm run changelog:update`, and `npm run changelog:check -- --base HEAD` passed. The final full-gate output is retained locally at `.artifacts/agent-swarm-fixes/full-turbo.log`. Existing manifests/lockfile and the six pre-existing repository Electron processes were preserved; no release/version assignment was performed.

##### Files

- `packages/platform-service/src/workers/supervisor.ts`
- `packages/platform-service/src/workers/types.ts`
- `packages/platform-service/src/workers/worker-main.ts`
- `packages/platform-service/src/workers/supervisor-await.test.ts`
- `packages/platform-service/src/workers/supervisor-await-fixture.cjs`
- `docs/changes/2026-10-18-swarm-await-capacity-fix.md`

#### Enforce model budgets across delegated task trees (F03)

**Impact:** patch

[Permanent work record](docs/changes/2026-10-18-swarm-shared-budget-fix.md).

##### Summary

Delegated children previously had independent spend counters without enforcement of an ancestor's request envelope. The central CompletionService now applies shared subtree cost/token limits to every task-associated completion, covering agent tools, direct completion RPCs, plugin model calls and MCP sampling.

##### Details

- Delegated children previously had independent spend counters without enforcement of an ancestor's request envelope. The central CompletionService now applies shared subtree cost/token limits to every task-associated completion, covering agent tools, direct completion RPCs, plugin model calls and MCP sampling.
- The service serializes budgeted dispatch per request tree, recalculates durable descendant spend against every ancestor ceiling, and records provider-dispatch reservations and settlements in existing task events. Unbudgeted requests retain parallel dispatch. Known actual usage is recorded immediately once; runtime progress marks service-accounted usage to avoid duplicate charges.
- Reservation creation occurs immediately before provider dispatch, after model/pool/capacity/pricing preflight. Deterministic rejected or already-aborted requests leave no reservation. Interrupted or unknown/partial monetary charges retain explicit unresolved holds under a monetary envelope instead of inventing actual spend. Exact tokens settle token-only reservations even when dollar pricing is unknown.
- Delegation inherits or narrows parent cost and duration ceilings, preserves an explicit optional parent token ceiling, and does not let coordinators invent token ceilings. Optional decision assessment without a verifiable cost/token bound is skipped under a finite envelope. Duration expiry cancels its subtree; each task's duration is measured from its own start.
- Completed current tasks cannot dispatch paid requests, and model delegation requires a running parent. Service-created followups under successful ancestors retain the original root's aggregate budget; failed/cancelled ancestors or a durable cancellation request revoke further dispatch. Added regressions cover successful-parent continuation without budget reset and cancellation markers after service reconstruction.
- The full suite exposed duplicate board-maintenance usage after accounting moved into the central service. Its worker progress now marks that already-persisted usage as service-accounted, retaining progress telemetry without charging the same tokens twice. The existing routed board-audit regression retains its exact 14-token expectation.
- Documentation separates model-dollar envelopes from externally approved asset-provider credits. No budget is silently assigned a currency conversion. No database/RPC migration or dependency change is required. Patch impact restores existing budget promises; current product version remains unchanged.

##### Validation

- SQLite helper regressions cover concurrent siblings, nested limits, more than 200 descendants, reconstructed service state, unknown/partial prices, interrupted dispatch, no-dispatch rejection, terminal ancestors, and unbudgeted concurrency.
- The central completion regression uses actual in-memory Project SQLite plus real CompletionService/ModelRouter and a deterministic provider fixture: a sibling cannot exceed the root envelope, direct model IDs retain task-role pools, and cancellation causes no provider dispatch/reservation.
- The final scoped budget/router/role run passed 58 tests across six files. An initial new fixture used an input capacity smaller than conservative message framing; the fixture capacity/pricing were corrected, with production guards preserved.
- npm ci was attempted but Windows denied replacement of an Electron executable held by existing repository processes. Dependencies were restored with npm install --ignore-scripts --no-package-lock, then synchronized against the unchanged lockfile using npm install --ignore-scripts. npm run postinstall applied both maintained patches; npm rebuild and node node_modules/electron/install.js succeeded. No tracked manifest or lockfile changed and existing Electron processes were not stopped.
- Final `npx turbo run build typecheck lint test` passed: 33/33 tasks successful, 22 cache hits for unchanged task inputs, 7m24.71s. The changed platform-service suite ran uncached: 128 files passed, 678 tests passed and six skipped. Theia Control Room verification passed 133 tests across 28 files; other workspaces contributed 76 passing tests and one skip, for 887 passing test cases and seven skips across the monorepo gate. App wrapper test/typecheck/lint scripts that intentionally print skip are not counted as additional test cases. Both Electron and browser application builds completed with zero build errors.
- Skips were existing Windows/platform prerequisites or unavailable real Godot: Linux-only plugin/isolation cases, symlink/process/credential permission cases, and the archive symlink case. The suite did run real local Blender/WSL inspect/export/render and exception tests, real local Qdrant persistence/isolation tests, and Windows LPAC probes with Node and Electron. Unity/Unreal engine identity/bridge cases and paid-provider behavior used deterministic fixtures; no paid external model/asset generation, ordinary production profile acceptance, or new installer lifecycle was performed.
- The first broad gate exposed the missing gameplay-module fixture, successful-parent continuation incompatibility, and duplicate board-audit usage; those were corrected without weakening the preserved acceptance assertions. Because source corrections occurred while that initial run was active, its mixed-state failures are not the acceptance result. A fresh complete run supplied the successful result above. A final planner-role cleanup was rebuilt and its role/registry/bundled-skill checks passed seven tests across three files.
- `bash scripts/check-links.sh` passed with All links OK. `npm run format:check`, `git diff --check`, `npm run changelog:update`, and `npm run changelog:check -- --base HEAD` passed. The final full-gate output is retained locally at `.artifacts/agent-swarm-fixes/full-turbo.log`. Existing manifests/lockfile and the six pre-existing repository Electron processes were preserved; no release/version assignment was performed.

##### Files

- `packages/platform-service/src/agents/shared-task-budget.ts`
- `packages/platform-service/src/agents/shared-task-budget.test.ts`
- `packages/platform-service/src/agents/agent-tools.ts`
- `packages/platform-service/src/agents/agent-tools.test.ts`
- `packages/platform-service/src/agents/agent-runtime.ts`
- `packages/platform-service/src/workers/types.ts`
- `packages/platform-service/src/workers/supervisor.ts`
- `packages/platform-service/src/workers/board-maintenance-handlers.ts`
- `packages/platform-service/src/models/completion-service.ts`
- `packages/platform-service/src/models/completion-service.test.ts`
- `packages/platform-service/src/models/completion-task-budget.test.ts`
- `packages/platform-service/src/service.ts`
- `docs/INTEGRATION_GUIDE.md`
- `docs/SKILLS_AGENTS_AND_TOOLS.md`
- `docs/changes/2026-10-18-swarm-shared-budget-fix.md`

#### Fence task trees before cancellation waits (F04)

**Impact:** patch

[Permanent work record](docs/changes/2026-10-18-task-cancellation-fencing-fix.md).

##### Summary

Cancellation previously snapshotted descendants and awaited deepest-first worker shutdown while ancestors could still delegate. It now persists the complete snapshot as cancelled synchronously before publishing callbacks or awaiting shutdown.

##### Details

- Cancellation previously snapshotted descendants and awaited deepest-first worker shutdown while ancestors could still delegate. It now persists the complete snapshot as cancelled synchronously before publishing callbacks or awaiting shutdown.
- Task creation walks every ancestor and rejects failed/cancelled owners and durable cancellation requests before duplicate detection or insertion. A `task.cancel_requested` event fences even a successfully completed root whose active followups are cancelled; the barrier survives database close/reopen. Reentrant callbacks and workers waiting during shutdown cannot extend a cancelled tree.
- Internal event publication reads all generated cancellation events instead of applying the public query's default event-page limit. A 256-task cancellation publishes all 513 generated request/state/cancellation events.
- Successfully completed ancestors still permit service-created reconciliation, revert and feedback followups within the original request tree and shared budget. A broad terminal-ancestor rejection initially broke that established workflow during verification; it was narrowed while adding a durable cancellation barrier. Agent delegation separately requires its own parent to be running. No persisted schema or public state value was added; the new internal event uses the extensible existing event contract. Parent/child IDs and successful history are preserved, no migration required. Patch impact.

##### Validation

- Four original SQLite regression cases were run before the fix and reproduced the failures. Following successful-parent compatibility and durable cancellation-barrier corrections, graph/store verification passed 13 tests across two files; task-service integration previously passed 14 tests.
- These tests use actual Project migrations and SQLite, plus controlled callbacks for shutdown timing; no ordinary profile was changed.
- Final `npx turbo run build typecheck lint test` passed: 33/33 tasks successful, 22 cache hits for unchanged task inputs, 7m24.71s. The changed platform-service suite ran uncached: 128 files passed, 678 tests passed and six skipped. Theia Control Room verification passed 133 tests across 28 files; other workspaces contributed 76 passing tests and one skip, for 887 passing test cases and seven skips across the monorepo gate. App wrapper test/typecheck/lint scripts that intentionally print skip are not counted as additional test cases. Both Electron and browser application builds completed with zero build errors.
- Skips were existing Windows/platform prerequisites or unavailable real Godot: Linux-only plugin/isolation cases, symlink/process/credential permission cases, and the archive symlink case. The suite did run real local Blender/WSL inspect/export/render and exception tests, real local Qdrant persistence/isolation tests, and Windows LPAC probes with Node and Electron. Unity/Unreal engine identity/bridge cases and paid-provider behavior used deterministic fixtures; no paid external model/asset generation, ordinary production profile acceptance, or new installer lifecycle was performed.
- The first broad gate exposed the missing gameplay-module fixture, successful-parent continuation incompatibility, and duplicate board-audit usage; those were corrected without weakening the preserved acceptance assertions. Because source corrections occurred while that initial run was active, its mixed-state failures are not the acceptance result. A fresh complete run supplied the successful result above. A final planner-role cleanup was rebuilt and its role/registry/bundled-skill checks passed seven tests across three files.
- `bash scripts/check-links.sh` passed with All links OK. `npm run format:check`, `git diff --check`, `npm run changelog:update`, and `npm run changelog:check -- --base HEAD` passed. The final full-gate output is retained locally at `.artifacts/agent-swarm-fixes/full-turbo.log`. Existing manifests/lockfile and the six pre-existing repository Electron processes were preserved; no release/version assignment was performed.

##### Files

- `packages/platform-service/src/tasks/task-graph.ts`
- `packages/platform-service/src/tasks/task-store.ts`
- `packages/platform-service/src/tasks/task-graph.test.ts`
- `docs/changes/2026-10-18-task-cancellation-fencing-fix.md`

#### Propagate dependency outcomes beyond public page limits (F08)

**Impact:** patch

[Permanent work record](docs/changes/2026-10-18-task-dependency-propagation-fix.md).

##### Summary

Dependency propagation previously listed only the first 200 pending/blocked tasks and then filtered for the completed prerequisite. Relevant dependents beyond that public page could remain pending or miss failure propagation indefinitely.

##### Details

- Dependency propagation previously listed only the first 200 pending/blocked tasks and then filtered for the completed prerequisite. Relevant dependents beyond that public page could remain pending or miss failure propagation indefinitely.
- TaskStore now queries dependents directly in SQLite by dependency ID without a public row-page limit; TaskGraph applies success/failure transitions to the complete matching set.
- Regressions place more than 200 unrelated pending rows before more than 200 actual dependents, and verify both successful prerequisites and failed prerequisites propagate correctly.
- The public task-list default remains bounded. No schema or migration is required; only internal dependency queries change. Patch impact restores existing graph semantics.

##### Validation

- SQLite success and failure propagation regressions failed before the fix and passed afterward. Graph/store verification passed 10 tests and existing task-service integration passed 14 tests.
- Final `npx turbo run build typecheck lint test` passed: 33/33 tasks successful, 22 cache hits for unchanged task inputs, 7m24.71s. The changed platform-service suite ran uncached: 128 files passed, 678 tests passed and six skipped. Theia Control Room verification passed 133 tests across 28 files; other workspaces contributed 76 passing tests and one skip, for 887 passing test cases and seven skips across the monorepo gate. App wrapper test/typecheck/lint scripts that intentionally print skip are not counted as additional test cases. Both Electron and browser application builds completed with zero build errors.
- Skips were existing Windows/platform prerequisites or unavailable real Godot: Linux-only plugin/isolation cases, symlink/process/credential permission cases, and the archive symlink case. The suite did run real local Blender/WSL inspect/export/render and exception tests, real local Qdrant persistence/isolation tests, and Windows LPAC probes with Node and Electron. Unity/Unreal engine identity/bridge cases and paid-provider behavior used deterministic fixtures; no paid external model/asset generation, ordinary production profile acceptance, or new installer lifecycle was performed.
- The first broad gate exposed the missing gameplay-module fixture, successful-parent continuation incompatibility, and duplicate board-audit usage; those were corrected without weakening the preserved acceptance assertions. Because source corrections occurred while that initial run was active, its mixed-state failures are not the acceptance result. A fresh complete run supplied the successful result above. A final planner-role cleanup was rebuilt and its role/registry/bundled-skill checks passed seven tests across three files.
- `bash scripts/check-links.sh` passed with All links OK. `npm run format:check`, `git diff --check`, `npm run changelog:update`, and `npm run changelog:check -- --base HEAD` passed. The final full-gate output is retained locally at `.artifacts/agent-swarm-fixes/full-turbo.log`. Existing manifests/lockfile and the six pre-existing repository Electron processes were preserved; no release/version assignment was performed.

##### Files

- `packages/platform-service/src/tasks/task-store.ts`
- `packages/platform-service/src/tasks/task-graph.ts`
- `packages/platform-service/src/tasks/task-graph.test.ts`
- `docs/changes/2026-10-18-task-dependency-propagation-fix.md`

### Security

#### Preserve session policy through engine and DCC RPCs (F01)

**Impact:** patch

[Permanent work record](docs/changes/2026-10-18-connector-session-policy-fix.md).

##### Summary

Engine/run and dcc/run previously discarded their authenticated RPC session context, allowing Project Full policy to override a session's Restricted or Ask Always policy. Both connector service run methods now accept an internal broker context and forward it from the service RPC handlers.

##### Details

- Engine/run and dcc/run previously discarded their authenticated RPC session context, allowing Project Full policy to override a session's Restricted or Ask Always policy. Both connector service run methods now accept an internal broker context and forward it from the service RPC handlers.
- The change retains normal Project/task ceilings and connector capability validation. Engine live-bridge calls carry the effective access ceiling and inherited role constraints into the selected MCP operation.
- Authenticated-service regressions compare ordinary tool/call with both wrapper paths under Project Full plus session Restricted, assert both are denied with audited Restricted policy, then verify each wrapper creates an Ask Always approval and honors rejection. An independent session retains Project Full.
- Compatibility: RPC payloads and persisted schemas are unchanged; optional internal connector parameters preserve existing callers. Previously bypassed session restrictions now apply. No migration required; patch impact is appropriate.

##### Validation

- The new connector-session-policy.integration.test.ts passed both engine and DCC cases. Node stood in for installed executables; no mutating engine/DCC process was approved.
- Initial narrow broker/session run passed 18 tests across two files before the later additional connector delegation regression. Full verification results follow below.
- Final `npx turbo run build typecheck lint test` passed: 33/33 tasks successful, 22 cache hits for unchanged task inputs, 7m24.71s. The changed platform-service suite ran uncached: 128 files passed, 678 tests passed and six skipped. Theia Control Room verification passed 133 tests across 28 files; other workspaces contributed 76 passing tests and one skip, for 887 passing test cases and seven skips across the monorepo gate. App wrapper test/typecheck/lint scripts that intentionally print skip are not counted as additional test cases. Both Electron and browser application builds completed with zero build errors.
- Skips were existing Windows/platform prerequisites or unavailable real Godot: Linux-only plugin/isolation cases, symlink/process/credential permission cases, and the archive symlink case. The suite did run real local Blender/WSL inspect/export/render and exception tests, real local Qdrant persistence/isolation tests, and Windows LPAC probes with Node and Electron. Unity/Unreal engine identity/bridge cases and paid-provider behavior used deterministic fixtures; no paid external model/asset generation, ordinary production profile acceptance, or new installer lifecycle was performed.
- The first broad gate exposed the missing gameplay-module fixture, successful-parent continuation incompatibility, and duplicate board-audit usage; those were corrected without weakening the preserved acceptance assertions. Because source corrections occurred while that initial run was active, its mixed-state failures are not the acceptance result. A fresh complete run supplied the successful result above. A final planner-role cleanup was rebuilt and its role/registry/bundled-skill checks passed seven tests across three files.
- `bash scripts/check-links.sh` passed with All links OK. `npm run format:check`, `git diff --check`, `npm run changelog:update`, and `npm run changelog:check -- --base HEAD` passed. The final full-gate output is retained locally at `.artifacts/agent-swarm-fixes/full-turbo.log`. Existing manifests/lockfile and the six pre-existing repository Electron processes were preserved; no release/version assignment was performed.

##### Files

- `packages/platform-service/src/service.ts`
- `packages/platform-service/src/engines/engine-connector-service.ts`
- `packages/platform-service/src/dcc/dcc-connector-service.ts`
- `packages/platform-service/src/tools/connector-session-policy.integration.test.ts`
- `docs/changes/2026-10-18-connector-session-policy-fix.md`

#### Retain caller role restrictions across plugin facades (F02)

**Impact:** patch

[Permanent work record](docs/changes/2026-10-18-plugin-role-policy-fix.md).

##### Summary

Plugin host callbacks previously replaced the calling agent role with a plugin identity, and broker role checks exempted that identity. Nested calls now retain originating role constraints while keeping plugin execution attribution and capability checks.

##### Details

- Plugin host callbacks previously replaced the calling agent role with a plugin identity, and broker role checks exempted that identity. Nested calls now retain originating role constraints while keeping plugin execution attribution and capability checks.
- The broker intersects explicit caller, recorded task/assignee, and inherited roles. Constraint propagation through tool handler context and engine-to-MCP calls preserves nested restrictions; explicit downstream deny patterns remain authoritative.
- The native sample-plugin lifecycle regression grants a custom role the plugin facade but denies fs/read-file. The facade still runs, while its host callback returns RoleToolDenied and writes a denied audit record. The preceding unrestrained plugin call reads the same fixture file successfully.
- Compatibility: no public RPC or data schema changes and no migration. Trusted plugins still need their accepted capabilities and effective access mode. An allowed facade no longer implies authority to bypass the originating agent's role; patch impact reflects restored policy.

##### Validation

- The native plugin integration regression ran through the actual sandboxed sample plugin and authenticated service. Its first broader run passed that regression but exposed an ad hoc plugin-role routing error; the router resolver was corrected to ignore only missing role definitions, and the focused plugin-model case then passed.
- Plugin and broker checks use disposable profiles/files; no production credentials or external engine/provider were invoked.
- Final `npx turbo run build typecheck lint test` passed: 33/33 tasks successful, 22 cache hits for unchanged task inputs, 7m24.71s. The changed platform-service suite ran uncached: 128 files passed, 678 tests passed and six skipped. Theia Control Room verification passed 133 tests across 28 files; other workspaces contributed 76 passing tests and one skip, for 887 passing test cases and seven skips across the monorepo gate. App wrapper test/typecheck/lint scripts that intentionally print skip are not counted as additional test cases. Both Electron and browser application builds completed with zero build errors.
- Skips were existing Windows/platform prerequisites or unavailable real Godot: Linux-only plugin/isolation cases, symlink/process/credential permission cases, and the archive symlink case. The suite did run real local Blender/WSL inspect/export/render and exception tests, real local Qdrant persistence/isolation tests, and Windows LPAC probes with Node and Electron. Unity/Unreal engine identity/bridge cases and paid-provider behavior used deterministic fixtures; no paid external model/asset generation, ordinary production profile acceptance, or new installer lifecycle was performed.
- The first broad gate exposed the missing gameplay-module fixture, successful-parent continuation incompatibility, and duplicate board-audit usage; those were corrected without weakening the preserved acceptance assertions. Because source corrections occurred while that initial run was active, its mixed-state failures are not the acceptance result. A fresh complete run supplied the successful result above. A final planner-role cleanup was rebuilt and its role/registry/bundled-skill checks passed seven tests across three files.
- `bash scripts/check-links.sh` passed with All links OK. `npm run format:check`, `git diff --check`, `npm run changelog:update`, and `npm run changelog:check -- --base HEAD` passed. The final full-gate output is retained locally at `.artifacts/agent-swarm-fixes/full-turbo.log`. Existing manifests/lockfile and the six pre-existing repository Electron processes were preserved; no release/version assignment was performed.

##### Files

- `packages/platform-service/src/plugins/plugin-host.ts`
- `packages/platform-service/src/plugins/plugin-service.integration.test.ts`
- `packages/platform-service/src/tools/tool-broker.ts`
- `packages/platform-service/src/tools/tool-registry.ts`
- `packages/platform-service/src/engines/engine-connector-service.ts`
- `packages/platform-service/src/service.ts`
- `docs/changes/2026-10-18-plugin-role-policy-fix.md`

### Documentation

#### Improve GitHub entry points and contribution guidance

**Impact:** none

[Permanent work record](docs/changes/2026-10-18-github-community-entry.md).

##### Summary

Make PlayWeld easier to try and contribute to, publish accurate About metadata, and prepare compact wiki navigation.

##### Details

- Verify the clean main checkout and origin scarecr0w12/PlayWeld at e4824b0 match remote main. Use a separate docs/github-community-refresh worktree, preserving the app checkout and independent Kilo worktrees. Marketing and application builds are untouched.
- README previously led with guide links and a full source quality gate. Add demo/download/contribution links, a three-step download/tutorial path, and version-specific 0.21.0 evidence with unsigned/uninstall/rollback limits. Source setup builds packages before the app; contribution checks remain in the developer guide. Preserve GameCrafter compatibility identifiers and historical evidence. Include no Star-to-follow request.
- Add CONTRIBUTING.md covering scoped first contributions, duplicate checks, work records, proportional validation and existing-label triage. Add bug/feature forms with required reproduction/environment or problem/acceptance fields, sanitized evidence guidance, canonical help links and continued blank issues. Add a PR template for behavior, validation, compatibility and records. No new process framework or triage commitment.
- Live inventory found empty About description/website/topics, an enabled but uninitialized wiki, zero issues and one open dependency PR. Publish the requested desktop/local-service About description, https://playweld.com and desktop-app, eclipse-theia, electron, game-development, open-source and typescript topics. Confirm administrator permission; existing security settings remain unchanged.
- Publish issue #3 for disposable-host Windows uninstall/rollback acceptance after checking all-state issues for duplicates. Acceptance derives from the public release's existing gap. No destructive lifecycle test runs on ordinary installations.
- Prepare wiki Home.md and _Sidebar.md with canonical guide/demo/download/status/issue links, avoiding copied version-specific procedures. Git wiki remote returns Repository not found despite has_wiki=true; first-page UI initialization remains blocked without an authenticated browser/wiki API. docs/wiki/README.md explains publication and preservation of intervening edits. Wiki publication is not claimed.
- Compatibility: docs, issue entry and metadata only; no runtime, storage, RPC, version or migration changes. Impact none matches this scope. Docs/templates await PR review; metadata and issue #3 are already published.

##### Validation

- Remote/status/worktree and remote-main identity inspection passed; original app checkout remains clean on main. Live 0.21.0 release notes/assets support README claims. Website returned HTTP 200 with demo anchor and download links.
- GitHub Markdown API rendered README; inspected HTML headings, tables and demo/release links. This is rendered HTML inspection, not screenshot or live desktop/engine acceptance.
- Existing installed YAML parser accepted forms/config with duplicate-key validation. Required fields/unique IDs and contribution relative paths/anchors passed. Contribution links are checked separately because the existing script does not scan this new root guide.
- Existing-checkout Prettier --check . passed in this worktree. npm run format:check initially lacked worktree node_modules; equivalent installed Prettier avoids installation or mutation of the app dependency tree. Git Bash link scan initially hit sandbox shared-memory denial and was rerun with escalation.
- Changed Markdown local links/anchors, git diff --check, npm run changelog:update and npm run changelog:check -- --base HEAD passed. Full repository Bash link scan was stopped after prolonged execution without a result; no success claimed for that scan. Changed-file link validation passed separately. Draft PR #4 is open; hosted Windows/Linux quality and browser checks were in progress at handoff. Full source/build/test gate intentionally skipped for docs/workflow-only changes to avoid competing app builds. No new engine/provider/installer acceptance is claimed.

##### Files

- `README.md`
- `CONTRIBUTING.md`
- `.github/ISSUE_TEMPLATE/bug_report.yml`
- `.github/ISSUE_TEMPLATE/feature_request.yml`
- `.github/ISSUE_TEMPLATE/config.yml`
- `.github/pull_request_template.md`
- `docs/wiki/Home.md`
- `docs/wiki/_Sidebar.md`
- `docs/wiki/README.md`
- `docs/changes/2026-10-18-github-community-entry.md`

#### Expand the wiki into a practical user and technical handbook

**Impact:** none

[Permanent work record](docs/changes/2026-10-18-wiki-handbook.md).

##### Summary

Prepare a substantive 16-page wiki handbook with shared navigation, source-verified controls and canonical documentation links, on a separate review branch after PR #4.

##### Details

- Start from merged main aa2366c in isolated docs/wiki-user-handbook; preserve the original app checkout, other worktrees, existing wiki initialization ownership and paused Marketing project. No application feature, dependency, credential, engine, provider or paid-operation changes.
- Replace link-only Home/sidebar with a task-oriented handbook map and shared footer. Installation explains Windows/Linux packages versus source prerequisites, checksum meaning, unsigned testing prereleases and separate engine/model setup. First Project explains the six-step wizard, immutable engine choice, workspace identity/layout and native-game distinction. Lantern Workshop gives isolated profile setup, fixture copying boundaries and observable discussion/lexical-search checks without submitting paid or agent work.
- Navigation maps exact PlayWeld menu labels to tab names and explains sections/Project selectors. Notes/discussions explains Markdown authority, thread lifecycle and explicit binding/synchronization. Tasks/impact explains Agent handoff, graph seed limits, questions versus approvals, cancellation, evidence and integration. Knowledge explains lexical-first use, indexing, embedding/storage prerequisites, remote data and stale-index recovery.
- Models/privacy/cost explains account discovery versus registration, eligibility, local-runtime requirements, active-file disclosure, access settings, profile-key limits, partial estimates and optional decision assistance. Engine/tools explains capability layers, identity, managed bridges and version-scoped evidence; MCP transport readiness and restricted A2A support remain distinct. Assets/skills/plugins explains review-before-import, collision/provenance, paid-generation boundaries, skill authority and plugin types.
- Settings/backups/updates explains supported scope precedence, preview/redacted export, empty-destination restore drills and testing/rollback limits. Troubleshooting supplies symptom triage, profile-specific service diagnosis and sanitized reports. Architecture/API explains service-owned durable state, authenticated framed transport, database seam and exact reference contracts. Development supplies source/build/check/contribution commands and work records. Verification separates implementation, scripted UI demonstrations, live named-operation evidence and installer lifecycle acceptance.
- Crosslink detailed canonical guides instead of reproducing volatile catalogs or test counts. Source inspection resolves menu labels and settings that differ from informal guide wording. Avoid propagating older guide claims that native IDE/MCP adapters are unimplemented; this suite makes no blanket execution-support claim. No standalone Notes/generic Tasks view is invented.
- Update internal wiki README with publication ownership/status, file-selection rules, preservation of intervening pages, content contract and inspected source matrix. Initially the enabled wiki remote returned Repository not found. After the user initialized it and the parent handed off ownership, inspect initial commit d6c8f5ab4e2df851b8b2763fe854a58e82083769: only Home.md existed with the welcome text. Preserve that text/history and publish the reviewed 16 pages/sidebar/footer as wiki commit dc280c9382334a7dc6d86c5bc30399285ee85af6. Internal README is excluded; source PR #5 remains draft and unmerged.
- Bounded editorial review followed the source first-run sequence from package/source setup through connected Project Home, wizard creation, fixture copying and lexical indexing. Add the missing package-install/launch-to-connection step. Replace drive-specific tutorial sample paths with an explicitly disposable TEMP-based PowerShell example; no credential values or personal profile locations are supplied. Canonical repository links target existing main files rather than this draft branch.
- Compatibility/migration: documentation only, no product/schema/version/storage/API changes or migration. Impact none reflects that scope. Source pages are reviewable in a draft PR; no direct main edits or merge.

##### Validation

- Verified origin and current main identity, clean original checkout, separate branch/worktree and wiki enabled state. Initial read-only wiki lookup returned Repository not found; after authorized handoff, clone/inspect/publish normally and verify the remote master ref matches dc280c9382334a7dc6d86c5bc30399285ee85af6. No competing initialization or overwritten user additions.
- Focused checker passed 18 public page/navigation files and 93 links, resolving all wiki destinations and canonical local repository paths/heading anchors. Asserted current menu labels, five configuration keys and referenced npm script names against implementation. Commands are documented, not executed app/provider/engine operations.
- Bounded editorial review and heuristic privacy scan passed: no credential-value patterns or personal host/profile paths found in public pages. First-run sequence is checked against source, not executed. All 41 canonical references exist in the remote main tree at aa2366c; no draft-branch-dependent canonical link is required after wiki publication.
- Live public HTML checks passed all 16 page URLs with HTTP 200, expected titles/content and wiki sidebar. Home additionally renders the preserved welcome and footer. All 18 committed public wiki blobs match the final source after newline normalization; internal README is absent from the wiki. This verifies public rendering/navigation in HTML, not graphical layout or game/runtime acceptance.
- Formatted every wiki Markdown file with installed Prettier and checked repository formatting. Git diff whitespace check passed. No tool installation or shared dependency mutation.
- GitHub Markdown API rendered representative Home, installation, task/impact and architecture pages; HTML heading/table/code/navigation checks passed. npm run changelog:update, npm run changelog:check -- --base aa2366c and git diff --check passed. Full application build/test and full-tree Bash scan intentionally skipped for this documentation-only task; source inspection and Markdown rendering do not establish new live engine/provider/installer or graphical-browser acceptance.

##### Files

- `docs/wiki/Home.md`
- `docs/wiki/Installation-and-Requirements.md`
- `docs/wiki/First-Project.md`
- `docs/wiki/Lantern-Workshop.md`
- `docs/wiki/Workspace-and-Navigation.md`
- `docs/wiki/Notes-and-Discussions.md`
- `docs/wiki/Tasks-and-Impact.md`
- `docs/wiki/Knowledge-and-Search.md`
- `docs/wiki/Models-Privacy-and-Cost.md`
- `docs/wiki/Engine-and-Tool-Integrations.md`
- `docs/wiki/Assets-Skills-and-Plugins.md`
- `docs/wiki/Settings-Backups-and-Updates.md`
- `docs/wiki/Troubleshooting.md`
- `docs/wiki/Architecture-and-API.md`
- `docs/wiki/Development-and-Contributing.md`
- `docs/wiki/Verification-and-Limits.md`
- `docs/wiki/_Sidebar.md`
- `docs/wiki/_Footer.md`
- `docs/wiki/README.md`
- `docs/changes/2026-10-18-wiki-handbook.md`

### Maintenance

#### Agent, swarm, and integration consistency review

**Impact:** none

[Permanent work record](docs/changes/2026-10-18-agent-swarm-integration-review.md).

##### Summary

Investigation only: reviewed the current PlayWeld agent, swarm, skill, plugin, MCP, and engine/DCC integration paths. Identified ten actionable inconsistencies or contract gaps. No runtime fixes, dependency changes, release preparation, profile changes, or external engine/provider mutations were performed by this review.

##### Details

- Scope and snapshot: inspected the current working tree on 2026-10-18, including pre-existing model-discovery, token-budget, package-version, generated-reference, and release edits. These edits were preserved and were not treated as changes authored or validated by this investigation. Reviewed repository/Kilo agent procedures separately from the service's builtin `ROLE.md` agents; these are different execution systems, not duplicate runtime definitions. Used Development OS, Specialist Reasoning, and Evidence Stewardship plugin skills, two independent read-only review agents, and the actual Context7 resolve/query tools for the official MCP tool-list notification contract. The diff-oriented `code-review` skill and the Codex Security scan skill were inspected for fit, but their workflows were not run; this was a system audit, not a completed Codex Security workbench scan.

###### F01 — P1: engine and DCC RPC wrappers lose session access policy

- Evidence: `packages/platform-service/src/service.ts:498` and `:517` discard the RPC context for `engine/run` and `dcc/run`. Their connector services call the broker without session context at `packages/platform-service/src/engines/engine-connector-service.ts:375` and `packages/platform-service/src/dcc/dcc-connector-service.ts:302`. Ordinary `tool/call` forwards the session at `service.ts:731`.
- Trigger and consequence: Project access is Full, but the requesting session is Restricted or Ask Always. A connector operation uses the broader Project policy, whereas the equivalent ordinary tool call honors the session. Applicable task ceilings and other broker checks still exist; this is a session-policy propagation defect, not an authentication bypass claim.
- Probe: current-source broker policy comparison returned `direct tool/call access=restricted` and `engine/dcc wrapper access=full`. Invoking the actual engine connector `run` method with fake capabilities and a stopping broker spy reached `engine/build` without a broker context. The corresponding DCC omission is source-reviewed; an attempted DCC probe stopped at UUID validation and does not establish execution through that broker path.
- Recommended correction: propagate authenticated session context through both connector entry points and nested calls. Add an isolated RPC regression comparing direct and wrapped execution under Project Full plus session Restricted/Ask Always.

###### F02 — P1: nested plugin calls discard the caller's role restrictions

- Evidence: `packages/platform-service/src/plugins/plugin-host.ts:715` saves the calling role, but `:524` substitutes `plugin:<id>` for downstream `host/tool/call`. `packages/platform-service/src/tools/tool-broker.ts:326` prefers that explicit role over the task's recorded role; `:588` exempts `plugin:` identities from role allowlists and disallowed tools.
- Trigger and consequence: a custom role allows a trusted plugin facade but denies its downstream tool. A plugin granted `tools.call` and any additional required host capability can make that downstream broker call without the caller's role restriction. Plugin capability grants, Project availability, effective access mode, approvals, and resource locks remain separate constraints. A Full or appropriately approved task with a restrictive role is the consequential case; the probe did not execute a forbidden engine operation under Restricted mode.
- Probe: actual source-loaded `PluginHost.callHostTool` received an invocation with role `reviewer` and emitted nested broker context `{accessCeiling: 'restricted', agentRole: 'plugin:fixture'}` for `engine/console`. Actual broker `roleAllows` returned true for the replacement role. This establishes loss of the role constraint, not successful console execution or OS sandbox escape.
- Recommended correction: retain plugin identity and capabilities while also intersecting nested calls with the originating agent's role restrictions. Add a regression with an allowed facade and explicitly denied downstream operation.

###### F03 — P1: delegation does not preserve a request-wide cost envelope

- Evidence: `packages/platform-service/src/agents/agent-tools.ts:310` builds a child budget from model arguments and inherits only an explicitly supplied parent token ceiling. Parent cost and duration limits are not inherited automatically. `packages/platform-service/src/tasks/task-graph.ts:108` starts a separate child spend counter; `packages/platform-service/src/workers/supervisor.ts:528` accounts usage against the individual task. No ancestor aggregation was found in these paths. The target contract in `docs/SKILLS_AGENTS_AND_TOOLS.md:131` describes inherited and subdivided budgets.
- Trigger and consequence: a coordinator with a user-supplied one-dollar cost limit delegates without a child budget. Its child has no corresponding cost ceiling, and descendant spend is not charged to the root's envelope. Other configured model limits may still apply; they do not establish the requested subtree budget.
- Probe: actual delegation handler with parent budget `{maxTokens:10000,maxCostUsd:1,maxDurationMs:1000}` and spend `{tokens:9000,costUsd:0.9}` produced child budget `{maxTokens:10000}`.
- Qualification: the current dirty-tree change deliberately prevents models from inventing token ceilings and copies an explicit parent token ceiling. That behavior is documented in `roles/coordinator/ROLE.md` and covered by its current tests; it is not itself being reported as an accidental regression. The finding concerns cost-envelope inheritance and aggregate accounting. Duration semantics also need an explicit root-deadline versus per-task contract.
- Recommended correction: enforce the user's request cost envelope across descendants using atomic reservations or aggregate accounting; preserve the intended optional token-budget behavior.

###### F04 — P1: cancellation can miss children delegated during shutdown

- Evidence: `packages/platform-service/src/tasks/task-graph.ts:163` snapshots descendants once, then processes them deepest first while awaiting shutdown at `:197`. Ancestors remain able to run during those awaits. Creation at `:55` has no cancellation barrier on the parent/ancestor chain.
- Trigger and consequence: parent P has child A; while cancellation of P awaits A's shutdown, P delegates B. B is outside the snapshot and can remain ready or execute after P is cancelled.
- Probe: executed actual `TaskGraph.cancel` with an isolated store and inserted B during the awaited child-stop callback. Result: cancelled tasks were A and P; P was `cancelled`, B remained `ready`.
- Recommended correction: fence the subtree against new delegation before awaiting shutdown, reject creation beneath cancelling or terminal ancestors, and cover the concurrent-delegation case. A second unfenced sweep alone does not close the race.

###### F05 — P1: waiting coordinators can starve their own children

- Evidence: `packages/platform-service/src/workers/supervisor.ts:193` counts every non-stopped, unfinished worker against Project concurrency and skips dispatch at `:220` when full. `packages/platform-service/src/agents/agent-tools.ts:389` implements `tasks/await` by polling inside the existing parent worker without yielding execution capacity.
- Trigger and consequence: with `agents.maxConcurrentPerProject=1`, a coordinator delegates a child and awaits it; the child cannot start until the parent releases its slot. The same starvation occurs at higher limits when all slots are occupied by coordinators waiting for queued descendants. The call times out rather than waiting forever, but repeated waits do not make progress.
- Probe: actual `tasks/await` handler plus actual `WorkerSupervisor.schedule`, with a stub store and one active parent, returned `childStarts:0`, child state `ready`, and `timedOut:true` for a 60ms wait. This is method-interaction evidence, not a full child-process/provider test.
- Recommended correction: represent dependency waiting explicitly and yield execution capacity with guarded resumption that still enforces the Project concurrency limit.

###### F06 — P2: skill work-type eligibility uses the execution kind

- Evidence: `packages/platform-service/src/skills/skill-service.ts:87` and `:137` pass `task.kind` as `workType`. For service agents this is `agent.run`, while roles and model routing use semantic work types such as `code`. `packages/platform-service/src/skills/skill-catalog.ts` applies exact membership filtering.
- Trigger and consequence: author a skill eligible for `code` and the engine-engineer role. It appears in a direct catalog query for `code`, but disappears from that role's agent-task search and cannot activate during the task. Unfiltered bundled skills can still work, so ordinary bundled-skill tests do not establish this integration.
- Probe: used actual current `SkillCatalog` and `SkillService` with a disposable in-memory fixture. Direct `code` catalog returned `[code-only]`; `searchForTask` for the engine-engineer `agent.run` task returned `[]`; activation rejected it as ineligible.
- Recommended correction: define and consistently resolve the task's semantic work type for skill discovery, activation, resource reads, and outcome statistics, separately from its execution handler kind. Cover role and skill metadata together.

###### F07 — P2: builtin specialist roles cannot use their integrated tool families

- Evidence: `packages/platform-service/roles/engine-engineer/ROLE.md:8`, `packages/platform-service/roles/asset-producer/ROLE.md:8`, and `packages/platform-service/roles/validator/ROLE.md:7` omit engine/DCC tool patterns. `packages/platform-service/src/tools/tool-broker.ts:587` enforces those patterns; `packages/platform-service/src/workers/supervisor.ts:407` sends the filtered tool snapshot to agents.
- Trigger and consequence: delegate engine, DCC, or structured engine validation work to the corresponding builtin specialist. Its offered tools lack the owning connector APIs even when those APIs are installed and otherwise available. Shell-based work may still work, but it does not provide the same structured capability gates, connector run records, or live-bridge path. The asset producer also has no explicit asset-provider tool family grant; that observation was source-reviewed, not included in the 20-tool probe.
- Probe: loaded real builtin role files, registered actual engine and DCC tool definitions, and invoked actual broker inspection. Each of engine-engineer, asset-producer, and validator received zero of 20 integrated tools, all excluded as `role_tool_denied`.
- Recommended correction: grant selected operations appropriate to each role and its access ceiling, preserve lock/approval checks, and deliberately handle any downstream MCP authorization. Do not replace the allowlists with blanket access. The planner's `task/create` pattern also has no matching registered agent tool; distinguish a plan-only role from an actually task-creating role when reconciling these definitions.

###### F08 — P2: dependency propagation silently stops at 200 candidates

- Evidence: `packages/platform-service/src/tasks/task-graph.ts:317` lists pending/blocked tasks without a limit before filtering by dependency ID; `packages/platform-service/src/tasks/task-store.ts:170` defaults to 200 rows. The scheduler dispatches ready/running tasks, so omitted pending dependents do not become runnable automatically.
- Trigger and consequence: complete a prerequisite with 201 pending dependents. One remains pending. Older unrelated pending tasks can also consume the first page and hide a smaller relevant dependency set. Failure propagation uses the same bounded candidate scan.
- Probe: actual `TaskGraph`, actual `TaskStore`, Project migrations, and disposable in-memory SQLite produced `ready:200`, `pending:1`, prerequisite `succeeded`.
- Recommended correction: query dependents directly or paginate the full candidate set. Cover both large fanout and unrelated older pending tasks.

###### F09 — P2: MCP registry refresh does not refresh running agents' offered tools

- Evidence: `packages/platform-service/src/mcp/session.ts` handles `notifications/tools/list_changed`; the connection manager refreshes registry tools. However, `packages/platform-service/src/workers/supervisor.ts:405` sends tools only in the worker startup command, and `packages/platform-service/src/agents/agent-runtime.ts:182` merges that snapshot once for later completion requests. No running-worker tool update path was found.
- Trigger and consequence: an MCP server adds, removes, or changes a tool while an agent is running. Registry discovery updates, but the agent continues advertising its original tool set/schemas until a new worker attempt. Added tools cannot be selected from the offered set; removed or changed tools can provoke avoidable execution or validation failures. This is source-traced; no dynamic running-model refresh simulation was performed.
- Standards cross-check: Context7's actual resolver and documentation query returned the official [MCP 2025-11-25 tools contract](https://modelcontextprotocol.io/specification/2025-11-25/server/tools), which defines `tools/list` and the list-change notification. That cross-check supports the registry-refresh expectation; the running-agent inconsistency is derived from PlayWeld source, not an assertion that the protocol requires a particular worker architecture.
- Recommended correction: refresh the authorized tool/schema set at safe turn boundaries or provide a versioned worker update mechanism, retaining role/access filtering and context-size accounting.

###### F10 — P2 contract gap: several role fields are parsed but have no runtime consumer

- Evidence: `packages/platform-service/src/roles/role-loader.ts:55`, `:56`, and `:64` populate `requiresModules`, `modelPool`, and `boardSubscriptions`. A source search across packages excluding generated libraries and tests found these fields only in contracts and the loader. The model router instead selects pools by pool target role/task type in `packages/platform-service/src/models/router.ts:593`; it never resolves the role's named `model-pool` field. `docs/SKILLS_AGENTS_AND_TOOLS.md:104` describes named-pool intersection, and `docs/INTEGRATION_GUIDE.md:136` describes role model-pool usage.
- Consequence: changing these declarative role fields does not itself enforce required modules, select the named pool, or subscribe that role to board topics. Targeted model pools configured separately can still work; ordinary explicit board reads can still work. The finding is incomplete wiring and misleading configuration expectations, not proof that all routing or board behavior fails.
- Recommended correction: either wire each field into its owning service with cross-area checks, or explicitly expose/document it as unsupported metadata until implemented. Preserve the distinction between target architecture and currently implemented behavior. Evidence is source inspection rather than live configuration acceptance.

- Compatibility and migration: this investigation changes only its permanent work record and the generated changelog. It adds no RPC/storage schema, changes no agent policy, removes no functionality, and requires no migration. All findings remain unresolved recommendations. Impact `none` is appropriate because the review ships no runtime behavior change; no version bump was performed by this task.

##### Validation

- `npm exec -w @gamecrafter/platform-service -- vitest run src/agents/agent-runtime.test.ts src/agents/agent-tools.test.ts src/roles/role-loader.test.ts src/roles/role-registry.test.ts src/change/swarm-coordination.integration.test.ts src/tools/tool-broker.integration.test.ts --maxWorkers=1`: passed, 6 files / 50 tests. Existing worktree tests passed; this does not establish coverage of the new findings.
- `npm exec -w @gamecrafter/platform-service -- vitest run src/skills/skill-catalog.test.ts src/skills/skills.integration.test.ts src/mcp/session.test.ts src/agents/agent-approval.integration.test.ts --maxWorkers=1 --testTimeout=30000 --hookTimeout=60000`: passed, 4 files / 30 tests.
- Independent integration reviewer: `npx vitest run src/mcp/mcp-tool-adapter.test.ts src/skills/skill-catalog.test.ts src/engines/engine-tools.test.ts src/dcc/dcc-tools.test.ts --maxWorkers=1 --testTimeout=30000 --hookTimeout=60000` from `packages/platform-service`: passed, 3 files / 7 tests. No engine-tools test file matched; four files were not executed. Skill-catalog tests overlap the main review's second run, so these are supplementary executions rather than seven additional unique tests.
- Isolated current-source probes used transient `typescript.transpileModule` require hooks and bounded fixtures; no probe test files were retained. Evidence and qualifications are recorded per finding above. Only the dependency-fanout probe used the real database seam and Project migrations; method-level mocks elsewhere do not prove full-process or installed behavior.
- `bash scripts/check-links.sh`: passed, `All links OK`. `npm run format:check`: passed for all matched repository files. `npm run changelog:update` completed, and `npm run changelog:check -- --base HEAD` passed, including current worktree coverage and generated freshness. These maintenance checks do not validate the runtime findings or certify unrelated release work.
- Full Turbo build/typecheck/lint/test, dependency reinstall, live provider completion, real engine/DCC mutations, desktop UI journeys, and installer acceptance were not run for this investigation-only change. The existing dirty tree was not reset or repaired.

##### Files

- `docs/changes/2026-10-18-agent-swarm-integration-review.md`

#### Avoid duplicate and superseded CI runs

**Impact:** none

[Permanent work record](docs/changes/2026-10-18-ci-run-efficiency.md).

##### Summary

Limit push CI to main, retain PR checks, cancel superseded runs and cache npm downloads in the manual native probe.

##### Details

- Every branch push and PR update previously could duplicate full quality/browser runs. Restrict push to main, while PR opened/synchronize/reopened/ready_for_review validates feature work including forks. Branches without PRs no longer automatically run CI. Tags retain the separate release workflow.
- Add workflow/PR-or-ref concurrency cancellation, keeping independent PRs separate. Preserve the complete Windows/Linux quality checks, browser build/smoke, evidence upload and existing npm cache. No path filters skip documentation PR validation.
- Add ref-scoped cancellation and setup-node npm download caching to the manual Windows native integration probe. Preserve protected-key and ordinary Node/Electron isolation checks. Native build output is not shared across hosts.
- Desktop Release remains unchanged. No new publication, deployment, secret, token permission, paid service or matrix expansion. No application/data/RPC change or migration; impact none reflects CI maintenance.

##### Validation

- Existing installed YAML parser accepted both workflows with duplicate-key checks. Assertions confirmed main-only push, PR synchronize, cancellation, two CI jobs, probe npm cache and absence of new permissions/pull_request_target.
- Diff review confirmed retained checks and unchanged release workflow. Existing-checkout Prettier --check . passed in the isolated worktree.
- Application build/tests intentionally skipped because source is unchanged and focused validation avoids competing builds. Hosted execution remains subject to the draft PR run, not inferred from static checks. npm run changelog:update, npm run changelog:check -- --base HEAD and git diff --check passed.

##### Files

- `.github/workflows/ci.yml`
- `.github/workflows/windows-transport-probe.yml`
- `docs/changes/2026-10-18-ci-run-efficiency.md`

#### Refresh integrated model discovery and agent fix documentation inventory

**Impact:** none

[Permanent work record](docs/changes/2026-10-18-model-discovery-integration-readiness.md).

##### Summary

Refresh the generated documentation inventory after integrating the model discovery repair, ten agent and Swarm fixes, remote CLI diagnostics, and current main documentation.

##### Details

- Regenerate both documentation inventory artifacts so their service test paths and subsystem test counts include the new policy, budget, cancellation, dependency, worker, role, and skill regression files. The previous inventory was stale after the runtime fixes; counts describe source coverage rather than live acceptance.
- Preserve the existing model discovery work and the remote CLI startup diagnostic commit while integrating current main. Only the generated central changelog conflicted in either merge; regenerate it from all permanent records so neither branch's history is lost.
- This integration maintenance introduces no runtime behavior, dependencies, migration, or version change. The earlier model discovery change retains its separately documented additive migration 19; the product version remains 0.21.1. Publication and merge are separate GitHub operations, not release or installer deployment.

##### Validation

- The complete agent-fix verification preceding integration passed all 33 build, typecheck, lint and test tasks, including both application builds: 887 tests passed and seven skipped. Detailed results and limitations remain in the individual fix records.
- After integrating remote CLI diagnostics and main, the focused platform-service CLI test passed (one file, one test). Release-version validation, generated system reference freshness, documentation evidence integrity and branch-wide changelog coverage passed. The documentation inventory freshness check detected the missing new test paths, prompting this regeneration.
- After regeneration, documentation inventory freshness, repository formatting, branch-wide changelog coverage and whitespace checks passed. The earlier remote model discovery head also completed Windows quality, Ubuntu quality and Theia browser build/UI smoke CI successfully; those results precede this integrated head.
- No new paid-provider, live engine, installer, or installed desktop acceptance was performed for this documentation integration.

##### Files

- `docs/reference/DOCUMENTATION_INVENTORY.md`
- `docs/reference/documentation-inventory.json`
- `docs/changes/2026-10-18-model-discovery-integration-readiness.md`

#### Prepare version 0.22.0

**Impact:** none

[Permanent work record](docs/changes/2026-10-18-release-0.22.0.md).

##### Summary

Prepare version 0.22.0 from 0.21.1, retaining all pending work records in the changelog and detailed release notes.

##### Details

Synchronize all nine first-party workspace and exact internal dependency versions from 0.21.1 to 0.22.0 and refresh the npm lockfile without changing third-party dependency selections. Assign the pending agent/Swarm fixes, integration review, CLI diagnostics, documentation and CI records to this new local testing release; retain the already prepared 0.21.1 model discovery history. The minor bump follows the repository's pre-1.0 installer preparation rule. Version preparation does not publish a tag or release. Installation and installed acceptance receive a separate permanent receipt.

##### Validation

- `npm run release:version -- 0.22.0` and `npm install --package-lock-only --ignore-scripts --no-audit --no-fund` passed. Existing pinned native dependencies were reused; no fresh `npm ci` was run for this version-only preparation.
- `npx --no-install turbo run build typecheck lint test --concurrency=1` passed all 33 tasks with zero cache hits in 7m43.143s, including Electron and browser builds. Platform service: 128 files, 678 passed and six skipped; Theia: 28 files and 133 passed. Across workspaces, 887 tests passed and seven were skipped. Ignored evidence: `.artifacts/local-deployment/0.22.0/quality.log`.
- Thirteen change-tracking tests and nine cache-maintenance tests passed. Version/lockfile consistency, generated system-reference and documentation-inventory freshness, documentation evidence integrity, repository formatting and Markdown links passed.
- These are source/build checks. Windows packaging, installer upgrade, ordinary-data retention and installed desktop acceptance are recorded separately after execution. No publisher signing, public release, tag, paid-provider acceptance, uninstall or rollback is established here.

##### Files

- `packages/archive-extractor/package.json`
- `packages/contracts/package.json`
- `packages/platform-service/package.json`
- `packages/plugin-sdk/package.json`
- `packages/service-client/package.json`
- `packages/theia-control-room/package.json`
- `packages/plugins/sample-hello/package.json`
- `apps/control-room/package.json`
- `apps/control-room-browser/package.json`
- `package-lock.json`

#### Preserve CLI lifecycle failure diagnostics

**Impact:** none

[Permanent work record](docs/changes/2026-10-19-cli-startup-failure-diagnostics.md).

##### Summary

Keep bounded daemon diagnostics when the compiled CLI lifecycle integration test fails, preserving its startup deadline, shutdown assertions and cleanup.

##### Details

- Windows CI for the model-discovery commit passed the audit-history test on its single retry but failed the separate CLI lifecycle test with a named-pipe connection error after its ten-second readiness window. The test previously ignored daemon output and deleted the disposable profile during cleanup, so the hosted failure did not establish whether startup was slow or the daemon exited. This change does not claim to fix or establish that root cause.
- Capture the last 8192 characters of each daemon output stream and, on failure only, report elapsed time, daemon exit/signal state, lock/token presence and the recent service log before the existing cleanup runs. Preserve the original error stack as bounded, redacted diagnostic text rather than retaining an independently printed unredacted cause.
- Redact the disposable profile's service token from captured output, logs and error text. Read missing diagnostic files defensively so missing logs do not replace the original failure. The ten-second readiness deadline, twenty-five-second test timeout, connection retries, normal status/stop assertions, lock-removal/log assertions and owned-process cleanup remain intact.
- Changes are isolated from concurrent swarm repairs. No production source, RPC/storage contracts, dependencies, package versions, installed application or ordinary user profile changes are included; no migration is required. Version 0.21.1 remains unchanged because this is test observability work and no installer is prepared or published.

##### Validation

- Build the service and its local workspace dependencies from isolated commit `b87a437fead0d031cb8cbf17883ce76b50e59f1a`, reusing existing installed third-party dependencies without a new installation. Three disposable-profile compiled CLI startup/status/stop reproductions succeeded; authenticated readiness took 1651, 1338 and 1457 ms, and shutdown removed all three locks.
- The original focused lifecycle test passed in the isolated worktree. With the final diagnostic change, the same focused lifecycle test, scoped ESLint, formatting, whitespace, work-record freshness/coverage and Markdown link checks passed. A negative control temporarily substituted only the isolated ignored compiled CLI with a child that writes a synthetic startup failure and exits 23: the test failed as required and retained both exit code and stderr in its diagnostic output. A synthetic service-token control also verified that the token was redacted from emitted diagnostics. Exact original compiled CLI bytes were restored after each control. Read-only review found no behavior or assertion changes; its error-cause redaction caveat was addressed and the focused checks repeated. No hosted root cause or full CI success is inferred from local reproductions.
- Existing local Node is 24.19.0; the failed hosted Windows run used Node 24.21.0. The hosted-only startup failure remains unverified locally. No additional blind CI retry, paid provider call, merge, tag or release publication is part of this work.

##### Files

- `packages/platform-service/src/cli.test.ts`
- `docs/changes/2026-10-19-cli-startup-failure-diagnostics.md`

## 0.21.1

### Fixed

#### Repair explicit model discovery, metadata and budget dispatch

**Impact:** patch

[Permanent work record](docs/changes/2026-10-18-model-discovery-metadata.md).

##### Summary

Model discovery records actual provider availability, requires explicit enabling, and refreshes supported metadata from provider APIs with a credential-free maintained catalog fallback. The Models UI shows availability, source, freshness, warnings and unknown values. Strict monetary routing rejects missing or unusable prices and rechecks a conservative request bound before dispatch.

##### Details

- Discovery preview is read-only; new records are disabled until selected. Refresh preserves existing enabled choices and manual overrides. Successful full lists mark missing models unavailable without deleting their history, and restore reappearing records even while selecting another model. Failed or malformed responses do not reconcile removals. Catalog-only suggestions no longer masquerade as available provider IDs.
- Provider adapters validate list shape and metadata, including Anthropic pagination. A bounded, credential-free models.dev catalog request fills exact provider/model matches only, with original retrieval time, source URL, confidence, expiry, stale-cache fallback and explicit warnings. Provider facts take precedence; non-USD/tiered/incompatible prices remain unknown instead of receiving a misleading flat fallback. USD per million token units are distinct from account rate limits. No dependency changes.
- Automatic metadata is cleared transactionally when an account endpoint changes, retaining manual overrides, selections, pools and history. In-flight discovery from an old endpoint is rejected. Older same-priority facts cannot overwrite newer values or their provenance.
- Routing excludes unavailable models and unknown/stale/expired prices under a monetary constraint. Dispatch rechecks enabled status, availability, original required capabilities, request features, current token limits, remaining task tokens and conservative worst-case dollar cost before accessing credentials. Embeddings also recheck availability and capability. Input reservations intentionally use advertised model capacity, which can reject small tasks with large-context models. This is a per-dispatch bound, not an aggregate concurrent Swarm dollar reservation.
- Additive migration 19 stores availability and last-seen time; existing enabled preferences remain intact with unknown availability until discovery. Optional contract fields preserve older clients. Prepared for the user-requested 0.21.1 patch release: this repairs existing model configuration and routing behavior; contract additions are optional and storage changes are additive. The 0.21.1 source preparation does not publish a release or replace the installed 0.21.0 binary.
- Discovery UI replaces Add all with explicit selection checkboxes, separates metadata refresh from enabling, preserves pending choices on errors, and displays sources, freshness, unavailable states and unknown prices. Credentials continue through the existing secure account flow; no saved keys were extracted or changed.
- Added focused provider/catalog, registry lifecycle/endpoint, router/dispatch and UI regressions. Existing integration fixtures now explicitly select fake models; intentionally unpriced audit dispatch asserts strict rejection. The multi-turn fake model task token ceiling accommodates its conservative capacity reservation; monetary budgets are unchanged.
- Refresh the generated API reference and RPC schema snapshot for the optional discovery result and model metadata fields, and the documentation inventories for the five additional model test files. These inventories describe source coverage rather than live acceptance.
- Design and implementation plan are retained in docs/superpowers. A fresh reviewer reproduced five defects before fixes; focused re-review confirms those reproductions pass after fixes.

##### Validation

- Fresh source-commit verification on 2026-10-19: `npx --no-install turbo run build typecheck lint test --concurrency=1 --force` passed all 33 tasks with zero cache hits (7m49s), including 121 service test files / 631 passed and six skipped, 28 Theia test files / 133 passed, and both application builds. A read-only review of the final source found no Critical or Important regressions. Reviewed application-source fingerprints remained unchanged during validation.
- Supplemental commit checks passed: nine workspace and lockfile/internal-version comparisons at 0.21.1, release-version validation, generated API/schema and test-inventory freshness after regeneration, documentation evidence integrity, 13 change-tracking tests, nine cache-maintenance tests, repository formatting, work-record coverage and Markdown links. Candidate-file inspection found no runtime binaries, profile databases or credential-like literals; this is a scoped inspection, not a security certification. No paid-provider request or additional native UI acceptance was run during commit preparation.

- Focused registry lifecycle/catalog tests: 14 passed; additional in-flight discovery test brings lifecycle to 8 passing tests.
- Provider/catalog integrity tests: 73 passed across six files; platform typecheck and scoped ESLint/Prettier passed.
- Endpoint/router/completion regressions: 41 passed; scoped ESLint passed.
- Theia tests: 133 passed across 28 files; typecheck, scoped lint and formatting passed.
- Updated integration fixtures: 13 passed and one existing Windows skip across model/plugin/Swarm files; another four agent/board/MCP tests passed. Parent knowledge/decision/migration fixtures: 27 passed across four files.
- First full service run: 597 passed, 17 failed and six skipped while fixes/fixture updates were still in progress. First repository-wide run stopped on a transient Windows lock of the existing AppContainerHost.exe build output; 24 tasks completed. No lock-owning process remained when inspected; the retry completed successfully.
- Final `npx turbo run build typecheck lint test`: 33 tasks succeeded, including desktop/browser app builds; platform-service 121 files / 631 tests passed, six skipped. Logs retained outside the repository in the Codex task workspace (`model-full-check-retry.log`). `npm run format:check`, `npm run changelog:check -- --base HEAD`, `git diff --check` and `bash scripts/check-links.sh` passed (`All links OK`).
- Source-built Electron native UI passed six checks with an isolated profile and fake provider: adding a disposable account, discovering two unchecked models, enabling only one, retaining selection on metadata refresh, rendering availability/limits/pricing/provenance/unknowns and retaining discovery/selection after a provider failure. Receipt and window-only captures: external Codex task workspace `model-native-direct-1792368192500/result.json`, `01-discovery-unchecked.png`, `02-explicit-selection.png`, `03-model-provenance.png`, `03b-field-sources-freshness.png`, `04-refresh-error-retained.png` and `model-details.txt`. Native driving used Electron BrowserWindow after local CDP automation was unreliable. This is native source-build/fake-provider evidence; the installed desktop binary was not replaced.
- Real Morrowfen generation, reload and knowledge linkage are unverified. No paid requests have run ($0 of the authorized $1 aggregate test budget). The present per-dispatch bound does not reserve aggregate concurrent Swarm expenditure; do not claim that this proves the total $1 story-test cap. Source/fixture evidence does not verify the installed desktop flow.

##### Files

- `CHANGELOG.md`
- `docs/API_REFERENCE.md`
- `docs/reference/rpc-schemas.json`
- `docs/reference/DOCUMENTATION_INVENTORY.md`
- `docs/reference/documentation-inventory.json`
- `docs/superpowers/plans/2026-10-18-model-discovery-plan.md`
- `docs/superpowers/specs/2026-10-18-model-discovery-design.md`
- `packages/contracts/src/models/schema.ts`
- `packages/contracts/src/rpc/protocol.ts`
- `packages/platform-service/src/agents/agent-approval.integration.test.ts`
- `packages/platform-service/src/agents/agent-tools.test.ts`
- `packages/platform-service/src/agents/agent-tools.ts`
- `packages/platform-service/src/board/board-maintenance.models.integration.test.ts`
- `packages/platform-service/src/change/swarm-coordination.integration.test.ts`
- `packages/platform-service/src/knowledge/knowledge.integration.test.ts`
- `packages/platform-service/src/mcp/connection-manager.sampling.integration.test.ts`
- `packages/platform-service/src/models/completion-service.test.ts`
- `packages/platform-service/src/models/completion-service.ts`
- `packages/platform-service/src/models/decision-service.test.ts`
- `packages/platform-service/src/models/endpoint-metadata.test.ts`
- `packages/platform-service/src/models/maintained-catalog.test.ts`
- `packages/platform-service/src/models/maintained-catalog.ts`
- `packages/platform-service/src/models/model-catalog.ts`
- `packages/platform-service/src/models/model-discovery-lifecycle.test.ts`
- `packages/platform-service/src/models/model-registry.test.ts`
- `packages/platform-service/src/models/model-registry.ts`
- `packages/platform-service/src/models/models.integration.test.ts`
- `packages/platform-service/src/models/providers/anthropic.ts`
- `packages/platform-service/src/models/providers/catalog-boundary.test.ts`
- `packages/platform-service/src/models/providers/google-gemini.ts`
- `packages/platform-service/src/models/providers/index.ts`
- `packages/platform-service/src/models/providers/metadata-integrity.test.ts`
- `packages/platform-service/src/models/providers/openai-compatible.ts`
- `packages/platform-service/src/models/providers/openai-providers.ts`
- `packages/platform-service/src/models/providers/pricing-metadata.ts`
- `packages/platform-service/src/models/providers/provider.ts`
- `packages/platform-service/src/models/router.test.ts`
- `packages/platform-service/src/models/router.ts`
- `packages/platform-service/src/plugins/plugin-service.integration.test.ts`
- `packages/platform-service/src/profile/migrations.test.ts`
- `packages/platform-service/src/profile/migrations.ts`
- `packages/theia-control-room/src/browser/models-widget.test.tsx`
- `packages/theia-control-room/src/browser/models-widget.tsx`
- `packages/theia-control-room/src/common/control-room-protocol.ts`
- `packages/theia-control-room/src/common/models-view-model.test.ts`
- `packages/theia-control-room/src/common/models-view-model.ts`
- `docs/changes/2026-10-18-model-discovery-metadata.md`

### Maintenance

#### Deploy and publish PlayWeld 0.21.0 testing release

**Impact:** none

[Permanent work record](docs/changes/2026-10-06-local-0.21.0-publication.md).

##### Summary

Install PlayWeld 0.21.0 locally with retained ordinary data and publish its verified Windows/Linux testing prerelease with complete cumulative task and validation notes.

##### Details

- Commit and push the cumulative application/engine/provider/adversarial/IDE/isolation/update work and permanent records. The immutable annotated v0.21.0 source tag identifies 09c0cfd2d0e6b29b4ba1944a4bfbf5a972a55924. The local stage was built from that exact commit with a clean working tree; this later receipt changes documentation only and does not move the tag or rebuild its artifacts.
- Keep each failed/candidate build and its evidence. The 0.15.0 candidate exposed administrator-owned runtime ACL access and was not installed; 0.16.0 repaired that boundary. Hosted 0.16.0 found the Linux parameterized-fixture context error, 0.17.0/0.18.0 found bounded Windows startup/test-context failures, and untagged 0.19.0 retained the transport investigation. Complete 0.20.0 source CI passed after the strict Windows environment correction, but its hosted packaged Electron LPAC probe failed opening NUL. The 0.21.0 inherited-pipe repair and real desktop-runtime regression passed both source and actual packaging. Existing tags, installers, logs and released records remain unchanged.
- Before the actual all-users Program Files upgrade from 0.20.0, authenticate the ordinary service, verify zero active/nonterminal tasks, checkpoint shutdown and copy the entire profile plus four Project database snapshots into ignored .artifacts/local-deployment/0.21.0-1791337329785. The installer exited zero at 2026-10-06T19:04:40.5988703-07:00. Restart the installed ordinary service and leave it available after stopping only owned smoke/probe processes.
- Compare authenticated service/version and database integrity/migrations before and after. Retain four Project identities/paths, 139 model identities/enabled selections, five pools, account/configuration/pricing/credential-key fingerprints, Project settings and all 1066 original task IDs/states. The post-smoke check reports no additional tasks for this upgrade. Earlier 0.20.0 scheduled board-audit additions were retained and separately reported by the operational verifier, with negative controls for missing/changed original tasks/settings; they were not deleted to force equality.
- Match all 417 selected installed app/frontend/service/contracts/extension files against Windows-Release/0.21.0. Verify actual installed and staged native service lifecycle, Windows vector dependencies, 30 bundled skills, exact Unity/Unreal/Godot bridge source bytes, IDE/handoff runtimes and the five Electron LPAC denial/allowance boundaries. Both desktop workflow smokes passed 29 checks with zero renderer errors.
- Local installer SHA-256 is 0b54eea268d30c3c62b3f17dd0912faedc35d333c3c843c1a2be228694d821b0 at Windows-Release/0.21.0/PlayWeld-0.21.0-x64.exe. Local and hosted builds use the same source commit but have independently generated installer bytes; do not equate their hashes.
- [Tagged CI 37559555998](https://github.com/scarecr0w12/PlayWeld/actions/runs/37559555998) and [Desktop Release 37559556042](https://github.com/scarecr0w12/PlayWeld/actions/runs/37559556042) completed successfully. Download every draft asset, verify all four listed SHA-256 values against actual bytes and manifest entries, assert source commit/version/tag, and check Windows MZ, Linux ELF and Debian ar headers. Metadata records profile schema 18 and Project schema 13; this does not prove every advertised upgrade path.
- Publish [PlayWeld 0.21.0](https://github.com/scarecr0w12/PlayWeld/releases/tag/v0.21.0) at 2026-10-07T02:18:58Z, explicitly as an unsigned testing prerelease with latest=false. It contains Windows NSIS, Linux AppImage/DEB, gamecrafter-release.json and SHA256SUMS.txt. The approximately 92 KB body contains the full detailed records for 0.15.0 through 0.21.0, links earlier 0.11.0–0.14.0 notes, the complete source changelog including affected files, the review and exact successful workflows. Permanent-record links resolve against the immutable v0.21.0 tag; preparation-time limits remain identified as historical.
- Hosted Windows installer SHA-256 is eb55575c7c6356044b354e21b2aaa68477890f6eab44121cbadfc2f499a75784; AppImage is 82512def0fb8356f17a910340daf9c1eab2edfcd3a5e1cc8b92e51f1f223511a; DEB is 27ee3acff8a55a931cdb5dbbc4b8e8af4207d2085aeb237d0788ed2bd2d28188. The published manifest hash is c94a0ebce3fd8578133c464b771260f530c122328b979929bc12c59270d49ead. Hashes establish integrity against the listed bytes, not publisher authentication.
- Update current implementation/release evidence to the installed and published 0.21.0 result, keeping WP19 in progress. No certificate or metadata signing key is configured; unsigned testing builds remain excluded from stable automatic updates. Full uninstall/rollback, publisher signing, broader OS/provider/engine/human/accessibility acceptance and existing patched dependency advisories remain separate limitations. No production game/art acceptance, complete architecture acceptance or clean dependency audit is claimed.

##### Validation

- Clean native npm ci; all 33 uncached source build/typecheck/lint/test tasks passed with 561 platform tests/six explicit capability skips and 128 extension tests. All 25 tracking checks, formatting, generated references/inventory/evidence, documentation links, version/lockfile agreement, local release coverage and cumulative committed-ledger coverage from baseline 4e13420 passed before packaging.
- Main-source CI 37559262905, tagged CI 37559555998 and Desktop Release 37559556042 all passed. Focused hosted native workflow 37558194826 passed actual credential tests and ordinary Node/desktop Electron isolation through strict Turbo. Native Windows/Linux packaging passed; Linux installation/uninstallation is not claimed.
- Staged smoke: .artifacts/documentation-electron/1791338201635; installed smoke: .artifacts/documentation-electron/1791338746756. Each passed 29 checks and zero renderer errors. Larger earlier rendered audits and real engine/provider/DCC evidence remain in their owning records and the system review; these smokes do not repeat every external operation.
- Final ordinary 0.21.0 retention passed after installed smoke, with four Projects, 139 models, five pools, 1066 original tasks and all compared settings/account/key/pricing identities retained. Installed native service/LPAC acceptance passed without a startup retry, and all 417 selected file hashes match the clean stage. The ordinary service and two unrelated older staged services were preserved.
- Five release assets downloaded; all installer/manifest hashes and executable formats matched, with manifest/source tag equality and explicit unsigned metadata. Published API confirms isDraft=false, isPrerelease=true, all five assets and the public v0.21.0 URL. No secrets, profiles or private backup contents are uploaded as release assets.
- Anonymous public manifest/checksum downloads matched the verified bytes after publication. The published 92152-character body matched the complete prepared notes, retained all seven detailed 0.15.0–0.21.0 sections and was not truncated. Receipt formatting, references/inventory/evidence and local changelog coverage passed; link/remote final checks complete before handoff.
- Final receipt/documentation freshness, link, formatting, changelog coverage, remote commit/tag and published-note preservation checks are completed at handoff and recorded alongside this receipt's ignored evidence directory; no historical release record is rewritten.

##### Files

- `docs/STATUS.md`
- `docs/RELEASE_GUIDE.md`
- `docs/changes/2026-10-06-local-0.21.0-publication.md`

#### Prepare version 0.21.1

**Impact:** none

[Permanent work record](docs/changes/2026-10-18-release-0.21.1.md).

##### Summary

Prepare version 0.21.1 from 0.21.0, retaining all pending work records in the changelog and detailed release notes.

##### Details

Synchronize all nine first-party workspace and internal dependency versions to 0.21.1 and refresh the matching lockfile entries without changing external dependency versions. The normal version-assignment process also assigns the previously Unreleased 0.21.0 publication receipt to this source release; its contents remain historical evidence of 0.21.0, not a new 0.21.1 publication. No tag or publication is performed by version preparation.

##### Validation

Work-record freshness, local file coverage, version progression and recorded impact were checked before preparation. Fresh 2026-10-19 commit checks verified all nine manifest/lockfile versions and internal dependency references at 0.21.1; release-version and generated-documentation checks passed. The forced repository run passed all 33 build/typecheck/lint/test tasks, including 631 service tests (six skipped), 133 Theia tests and both app builds. Formatting, work-record coverage, 13 change-tracking tests, nine cache-maintenance tests and Markdown links passed. Existing installed dependencies were reused; npm ci was not repeated because external dependency versions did not change. No new installer packaging, signing, installed upgrade, paid-provider story acceptance, release tag or publication is claimed by these source-commit checks. Earlier local installer and fake-provider native UI evidence retain their original scope and dirty-build provenance.

##### Files

- `packages/archive-extractor/package.json`
- `packages/contracts/package.json`
- `packages/platform-service/package.json`
- `packages/plugin-sdk/package.json`
- `packages/service-client/package.json`
- `packages/theia-control-room/package.json`
- `packages/plugins/sample-hello/package.json`
- `apps/control-room/package.json`
- `apps/control-room-browser/package.json`
- `package-lock.json`

## 0.21.0

### Fixed

#### Use inherited pipe handles for Electron LPAC workers

**Impact:** patch

[Permanent work record](docs/changes/2026-10-06-electron-lpac-stdio.md).

##### Summary

Repair native Electron Node-mode plugin startup when the Windows server denies NUL device access inside LPAC, while keeping the existing filesystem/network/job isolation.

##### Details

- Hosted 0.20.0 Windows release quality passed, but the actual packaged Electron LPAC probe failed before worker JavaScript ran: Electron reported that it could not open the NUL device and recommended --no-stdio-init. Linux packaging and complete source CI passed; local installed 0.20.0 passed native and desktop checks. Preserve the failed tagged package and local evidence; no public release is claimed.
- For the verified current Electron executable only, prepend --no-stdio-init so Electron uses standard pipe handles already established by the native helper instead of opening NUL. Ordinary Node and Python arguments keep their existing behavior. LPAC token, capabilities, allowed paths, restricted networking and kill-on-close job policy are unchanged; no extra filesystem/device access or weaker sandbox is granted.
- Checked the exact [Electron 42.10.0 NodeMain source](https://github.com/electron/electron/blob/v42.10.0/shell/app/node_main.cc): the switch sets kNoStdioInitialization and is removed before Node parses CLI options. It is distinct from disabling sandbox enforcement.
- Add an actual Windows Electron executable regression alongside the ordinary Node LPAC test. Require the same private-host/all-applications/source-write denial, scratch-write allowance and network denial; this detects the desktop runtime boundary during source testing instead of waiting for packaging. Linux explicitly skips this Windows-only case.
- Extend the manual native integration workflow to run these ordinary Node/Electron boundaries through strict Turbo after the existing credential checks, retaining its file identity and renaming its display title for the broader scope.
- Complete a new version and preserve v0.20.0 rather than changing its source tag or overwriting its installer. Publication and final local upgrade receive a separate permanent receipt.

##### Validation

- Complete 0.20.0 source CI 37555962077 and repaired-source CI 37555130951 passed Windows/Linux/browser gates. Tagged Desktop Release 37556533529 preserved its Linux success and exact Windows NUL failure in .artifacts/local-deployment/0.20.0-1791335020097/hosted-windows-package-failure.log.
- Corrected local/native Electron and focused hosted/runtime/package acceptance are pending until actually run. This record does not promote the failed package or infer security from a launch marker.
- Corrected package-scoped local isolation passed five cases/one explicit Linux skip, including the actual desktop Electron runtime and all five LPAC boundaries. Focused hosted workflow 37558194826 passed ordinary Node/Electron isolation through six uncached strict Turbo tasks in 7.837 seconds; no boundary assertion was skipped or replaced with a startup marker.
- Clean 0.21.0 npm installation and all 33 uncached quality tasks passed, with 561 platform tests/six explicit skips, 128 extension tests and 25 tracking checks. Formatting, references/inventory/evidence, documentation links and release coverage/agreement passed. Final version-correct package/installed/hosted publication acceptance receives the separate receipt.

##### Files

- `packages/platform-service/src/plugins/isolation/appcontainer-launcher.ts`
- `packages/platform-service/src/plugins/isolation/isolation.test.ts`
- `docs/changes/2026-10-06-electron-lpac-stdio.md`
- `.github/workflows/windows-transport-probe.yml`
- `docs/STATUS.md`
- `docs/RELEASE_GUIDE.md`

### Maintenance

#### Prepare version 0.21.0

**Impact:** none

[Permanent work record](docs/changes/2026-10-06-release-0.21.0.md).

##### Summary

Prepare version 0.21.0 from 0.20.0, retaining all pending work records in the changelog and detailed release notes.

##### Details

Synchronize first-party workspace and internal dependency versions. The lockfile must be refreshed separately. No tag, publication, or build is performed by version preparation.

##### Validation

Clean native Windows npm ci and synchronized workspace/lockfile checks passed. All 33 quality tasks passed uncached, with 561 platform tests/six explicit capability skips and 128 extension tests. Tracking passed 25 checks; formatting, references/inventory/evidence, documentation links, release coverage/agreement and diff checks passed. Local ordinary Node/desktop Electron isolation passed five cases with one explicit Linux-only skip; focused hosted workflow 37558194826 passed the same native boundaries through six uncached strict Turbo tasks in 7.837 seconds. Operational retention also passed after scheduled audit additions, with three negative controls rejecting missing/changed original tasks/settings. Complete hosted/tagged package/installed/publication outcomes receive a separate permanent receipt after the source becomes immutable; publisher signing and full uninstall/rollback remain unverified.

##### Files

- `packages/archive-extractor/package.json`
- `packages/contracts/package.json`
- `packages/platform-service/package.json`
- `packages/plugin-sdk/package.json`
- `packages/service-client/package.json`
- `packages/theia-control-room/package.json`
- `packages/plugins/sample-hello/package.json`
- `apps/control-room/package.json`
- `apps/control-room-browser/package.json`
- `package-lock.json`

#### Retain original task identities while reporting normal additions

**Impact:** none

[Permanent work record](docs/changes/2026-10-06-retention-background-tasks.md).

##### Summary

Correct the operational upgrade verifier so completed periodic board audits added after startup do not falsely imply lost task identities.

##### Details

- The immediate 0.18.0-to-0.20.0 ordinary upgrade retained all configuration and task identities. A repeated check after desktop smoke found one new succeeded board-maintenance.audit task in each of the four ordinary Projects, created at 2026-10-07T01:25:10Z. All original task states and Project settings remained identical.
- Inspect the task kinds/timestamps and existing BoardMaintenanceScheduler: its sixty-second tick schedules due periodic audits. Preserve the failed exact-array comparison, immediate-upgrade snapshot and additive-task inspection; no task is removed and no board scheduler setting is changed to silence the check.
- Keep exact Project/account/model/pool/pricing/settings/key checks. For each Project, require every original task ID and state to remain present, preserve exact settings hashes, and separately report new task IDs/states. Existing snapshots remain compatible. Active/nonterminal-task rejection and database integrity/migration checks remain unchanged.
- This is source operational acceptance tooling after the immutable 0.20.0 package/tag; it changes no bundled runtime, installer, schema, user data or historical release record. Publication and deployment receive a separate receipt.

##### Validation

- Read-only comparison against checkpointed Project databases found exactly four new succeeded board audits, no removed/changed original task rows and no changed setting keys. Profile identities/pricing/settings/credential key matched, with four Projects, 139 models and five pools.
- Corrected full-profile retention and final release acceptance remain pending until executed. This record does not treat arbitrary changed/deleted existing tasks as acceptable.
- Corrected full-profile retention passed after desktop smoke with four Projects, 139 models, five pools, every original task identity/state and all settings/key/pricing/account identities preserved; the four added succeeded audit tasks are reported separately. Negative controls using copied expected snapshots rejected a missing required original task, a changed original task state and a changed Project settings hash. These controls performed no Project/profile mutation.

##### Files

- `scripts/local-deployment-acceptance.cjs`
- `docs/changes/2026-10-06-retention-background-tasks.md`

## 0.20.0

### Fixed

#### Preserve native Windows test environment under Turbo strict mode

**Impact:** none

[Permanent work record](docs/changes/2026-10-06-native-test-environment.md).

##### Summary

Declare the Windows operating-system context required by native service tests instead of losing it in Turborepo's strict environment.

##### Details

- Corrected source full Windows CI 37553725149 still exhausted DPAPI's thirty-second deadline, while focused direct Vitest/native round trips passed. Preserve that failed log and the clean 0.19.0 local candidate; no 0.19.0 release tag or publication is accepted by this record.
- Turbo 2.11.2 dry-run reports strict mode and no configured environment variables for the service test task. The service build already accounts for OS, architecture and SystemRoot; the test task now does so too. Forward only explicit Windows user/system/module context through task-level passThroughEnv; keep strict mode and provider credentials excluded.
- The available skill's bundled-docs pointer was absent in the installed turbo package. Consulted the official [strict-mode guidance](https://turborepo.dev/docs/crafting-your-repository/using-environment-variables#strict-mode) and [task environment configuration](https://turborepo.dev/docs/reference/configuration#passthroughenv) before changing configuration. These document that strict mode filters task environments unless declared.
- Add an early Windows SystemRoot assertion to native protected-key acceptance and a focused hosted invocation through Turbo, matching the failing execution boundary instead of testing Vitest directly only. No assertion or capability is skipped, no secret is printed, and no runtime protection or schema changes.
- Candidate generation and previous failed tags/artifacts remain preserved. New full source/package/installed/publication acceptance will use the next version and a separate receipt; successful isolated diagnostics alone do not establish the repair.

##### Validation

- Prior local 0.19.0 source gate passed all 33 tasks uncached, 560 platform tests/six skips and 128 extension tests. Its local package/native checks passed. It remains a preserved candidate; the original corrected full hosted Windows run failed and is not described as accepted.
- Native task configuration, focused strict-mode hosted test and corrected full quality/package/deployment checks are pending until actually executed.
- Local focused native acceptance passed four cases through six uncached strict Turbo tasks in 6.327 seconds. Hosted workflow 37555130529 passed its direct and strict-Turbo protected-key tests; the strict task ran four cases and six uncached tasks in 7.018 seconds. This exercises the actual previously failing task boundary without relaxing the environment mode or disabling native signing checks.
- Clean 0.20.0 installation/lockfile checks and the complete local gate passed 33 uncached tasks, 560 platform tests/six explicit skips and 128 extension tests. All 25 tracking checks, formatting, references/inventory/evidence, documentation links and release coverage passed. Complete hosted/package/installed/publication outcomes follow in the acceptance receipt.

##### Files

- `turbo.json`
- `.github/workflows/windows-transport-probe.yml`
- `packages/platform-service/src/updates/release-metadata-cli.test.ts`
- `docs/changes/2026-10-06-native-test-environment.md`
- `docs/STATUS.md`
- `docs/RELEASE_GUIDE.md`

### Maintenance

#### Prepare version 0.20.0

**Impact:** none

[Permanent work record](docs/changes/2026-10-06-release-0.20.0.md).

##### Summary

Prepare version 0.20.0 from 0.19.0, retaining all pending work records in the changelog and detailed release notes.

##### Details

Synchronize first-party workspace and internal dependency versions. The lockfile must be refreshed separately. No tag, publication, or build is performed by version preparation.

##### Validation

Clean native Windows npm ci and refreshed workspace/lockfile agreement passed. All 33 quality tasks passed uncached, with 560 platform tests/six explicit capability skips and 128 extension tests. Tracking passed all 25 checks; formatting, references/inventory/evidence, documentation links, release coverage/agreement and diff checks passed. Hosted focused workflow 37555130529 passed actual protected-key acceptance both directly and through strict Turbo, with six uncached dependency/test tasks in 7.018 seconds. Final complete hosted/package/installed/publication acceptance receives a separate permanent receipt after the source becomes immutable. No publisher certificate, signed metadata or complete uninstall/rollback is claimed.

##### Files

- `packages/archive-extractor/package.json`
- `packages/contracts/package.json`
- `packages/platform-service/package.json`
- `packages/plugin-sdk/package.json`
- `packages/service-client/package.json`
- `packages/theia-control-room/package.json`
- `packages/plugins/sample-hello/package.json`
- `apps/control-room/package.json`
- `apps/control-room-browser/package.json`
- `package-lock.json`

## 0.19.0

### Fixed

#### Allow bounded fresh installed service readiness

**Impact:** patch

[Permanent work record](docs/changes/2026-10-06-installed-service-cold-start.md).

##### Summary

Allow thirty seconds for detached service startup after a cold installed upgrade instead of reporting failure after five seconds while the daemon continues starting.

##### Details

- The first 0.18.0 isolated installed probe exhausted the five-second service readiness deadline; the daemon subsequently finished startup, and an unchanged retry passed. The ordinary upgrade's fresh service also required approximately fifteen seconds between process launch and its startup event. This is measured installed-runtime behavior, not a capability failure.
- Extend only detached startup readiness to thirty seconds. Keep the same live process/socket checks and ordinary stop/checkpoint behavior. Extend the Windows package verifier's outer CLI process bound to forty-five seconds so the inner startup limit can report correctly.
- Preserve the failed probe log and authenticated cleanup of its exact owned profile/PID. No profile schema, data identity, public branding or compatibility path changes.

##### Validation

- Local 0.18.0 ordinary retention passed four Projects, 139 models and five pools, and all 417 selected installed files matched the stage. The installed native retry and all 29 desktop checks passed; the initial cold-start failure remains recorded.
- Source CLI lifecycle and corrected fresh package/installed acceptance remain pending for the next version. This change does not repair the separate hosted protected-key failure or claim public release acceptance.
- The corrected source CLI lifecycle passed; the full 0.19.0 local quality gate passed all 33 tasks uncached with 560 platform tests/six skips and 128 extension tests. Version-correct cold package/installed readiness and public acceptance remain pending for the separate receipt.

##### Files

- `packages/platform-service/src/cli.ts`
- `apps/control-room/scripts/verify-windows-native.cjs`
- `docs/changes/2026-10-06-installed-service-cold-start.md`

### Maintenance

#### Prepare version 0.19.0

**Impact:** none

[Permanent work record](docs/changes/2026-10-06-release-0.19.0.md).

##### Summary

Prepare version 0.19.0 from 0.18.0, retaining all pending work records in the changelog and detailed release notes.

##### Details

Synchronize first-party workspace and internal dependency versions. The lockfile must be refreshed separately. No tag, publication, or build is performed by version preparation.

##### Validation

Clean native Windows npm ci and refreshed workspace/lockfile agreement passed. All 33 quality tasks passed uncached, with 560 platform tests/six explicit capability skips and 128 extension tests. All 25 tracking checks, formatting, references/inventory/evidence, documentation links, release coverage and diff checks passed. Focused local process/native protected-key validation passed seven checks, CLI lifecycle passed, and hosted workflow 37553725042 passed its transport round trips and four actual protected-key cases. Full hosted CI and tagged package/installed/publication acceptance are recorded in a separate receipt after the source becomes immutable; unsigned metadata, publisher signing and complete uninstall/rollback remain separate acceptance boundaries.

##### Files

- `packages/archive-extractor/package.json`
- `packages/contracts/package.json`
- `packages/platform-service/package.json`
- `packages/plugin-sdk/package.json`
- `packages/service-client/package.json`
- `packages/theia-control-room/package.json`
- `packages/plugins/sample-hello/package.json`
- `apps/control-room/package.json`
- `apps/control-room-browser/package.json`
- `package-lock.json`

#### Diagnose hosted Windows credential transport

**Impact:** patch

[Permanent work record](docs/changes/2026-10-06-windows-credential-transport-diagnosis.md).

##### Summary

Diagnose and repair the Windows PowerShell stderr transport after both hosted 0.18.0 runners reproduced the DPAPI deadline failure; retain a disposable native probe for regression diagnosis.

##### Details

- Preserve failed 0.18.0 Windows CI/release logs and the source tag. Linux quality/package and browser smoke passed; publication is not accepted. The local ordinary upgrade retained four Projects, 139 models, five pools and matched 417 installed files. A first isolated installed service startup exceeded its five-second readiness budget; the unchanged retry passed, and that timing limitation remains recorded.
- Compare EOF-based and newline-framed Windows PowerShell stdin with a fixed non-secret fixture, native DPAPI protect/unprotect and only static phase markers, elapsed time, exit code, length and fixture checksum. No account, credentials, signing material or ordinary profile is read.
- Provide a manual Windows Actions job without npm installation to distinguish input transport from native crypto/runtime behavior. Both children have twenty-second termination limits. This is diagnostic tooling, not a timeout increase or a skipped release assertion.
- Extend the hosted probe with a clean dependency/service build and the exact isolated protected-key regression. Temporary helper phase markers were used for diagnosis and reverted before final runtime acceptance: the final helper keeps its original static PowerShell script, pipes/drains stderr without logging, and preserves static redacted errors and stdin-only sensitive input. Add a direct ignored-versus-piped stderr round-trip comparison with the exact original helper script, and a deterministic regression for the valid drained pipe.

##### Validation

- Initial local Node 24.21.0 direct DPAPI protection passed after downloading the exact hosted runtime from nodejs.org and checking its published SHA-256; the runtime version alone did not reproduce the failure.
- The initial expanded local probe was rejected by native process startup with EPERM before phase output, while a minimal static PowerShell phase command and the application DPAPI helper both passed. The probe is retained to test the hosted environment directly; hosted phase results remain pending. Full installed desktop acceptance and public release remain pending; no successful Windows publication is claimed.
- Hosted baseline workflow 37552973484 passed EOF and newline protect/unprotect round trips on Node 24.21.0 in 2671ms and 283ms. This rules out a general hosted DPAPI or input-framing failure for that fixture; the exact application test is isolated next. Local phase-instrumented protected-key execution receives EPERM before process startup, while six deterministic/portable tests pass. That unsuccessful local diagnostic is retained without promoting runtime acceptance.
- Local installed 0.18.0 desktop smoke passed 29 checks with zero renderer errors at .artifacts/documentation-electron/1791333489913. The owned isolated probe left after the first five-second readiness failure was authenticated and stopped by its exact PID/profile; the ordinary service and two unrelated staged services remain available. Public release remains pending corrected Windows acceptance.
- Focused hosted workflow 37553215366 passed all four actual protected-key tests in 1676ms after using a valid stderr pipe (the protected-key case took 1210ms). The original uninstrumented script with piped/drained stderr then passed all seven local process/protected-key checks in 3.05 seconds. Direct ignored-versus-piped hosted comparison is pending; no timeout is extended again and no native signing assertion is skipped.
- Follow-up workflow 37553725042 passed both bare original-script stderr modes (ignored 545ms, piped 529ms) and all four actual protected-key cases (the protected-key case took 1230ms). The isolated transport comparison does not reproduce the full-suite failure, so a general claim that ignored stderr always breaks PowerShell is unsupported. Final acceptance requires the corrected complete Windows suite; the helper supplies and drains a usable handle as a measured candidate repair while keeping diagnostics private.
- Full local 0.19.0 validation passed 33 uncached tasks, including 560 platform tests/six explicit skips and 128 extension tests. Tracking, formatting, references/inventory/evidence, documentation links and release agreement/coverage passed. Final full hosted/package/deployment/publication results receive a separate receipt; the existing 0.18.0 installation and failed tags are preserved.

##### Files

- `scripts/probe-windows-dpapi-transport.cjs`
- `.github/workflows/windows-transport-probe.yml`
- `docs/changes/2026-10-06-windows-credential-transport-diagnosis.md`
- `packages/platform-service/src/engines/unreal/editor-bridge-tools.ts`
- `packages/platform-service/src/engines/unreal/dpapi-process.test.ts`
- `docs/STATUS.md`
- `docs/RELEASE_GUIDE.md`

## 0.18.0

### Fixed

#### Bound Windows cold startup and hosted fixture lifecycle

**Impact:** patch

[Permanent work record](docs/changes/2026-10-06-windows-cold-start-release-budgets.md).

##### Summary

Accommodate observed cold Windows startup while retaining bounded, cancellable DPAPI and complete fixture assertions for the next testing release.

##### Details

- Hosted v0.17.0 Windows quality hit the DPAPI child deadline at 10047ms; the independent release runner hit the same deadline plus multiple 10000ms fixture setup hooks and subsequent locked cleanup. Linux quality/package and browser smoke passed. Repeating the same source alone does not repair these measured timing limits.
- Raise only the DPAPI process deadline from ten to thirty seconds, with prompt AbortSignal cancellation. Report static timeout, cancellation, exit and input/start transport categories without printing child stderr, payloads or private keys. Clear deadline/listeners on both failed startup and normal exit.
- Give service test bodies thirty seconds and setup/teardown hooks sixty seconds. Native protected-key CLI execution receives sixty seconds, with a 120-second overall multi-operation case. Crypto, signature, isolation, task and retention assertions remain unchanged; no capability check is disabled.
- Add deterministic mocked-process tests for stdin-only sensitive input, cleanup, successful execution, startup beyond ten seconds, bounded termination, cancellation and redacted failure. Actual native protected-key tests remain required on Windows.
- Preserve failed v0.16.0/v0.17.0 tags and all local candidate/deployment artifacts. Prepare a new 0.18.0 minor version and publish only after corrected hosted Windows/Linux and local deployment acceptance. Record final publication in a separate receipt without rewriting immutable tagged records.

##### Validation

- Hosted Windows failure logs are retained under .artifacts/local-deployment/0.17.0-1791329647605. The local 0.17.0 ordinary upgrade retained four Projects, 139 models, five pools/configuration/key/pricing/task identities and matched 417 installed files. Its staged smoke passed 29 checks; installed smoke results are retained separately.
- All 34 targeted process/native-signing/A2A/tool-broker checks passed locally. Deterministic cases prove ten-second startup no longer terminates early, the thirty-second cap still kills the child, cancellation is immediate, input stays off arguments, deadline cleanup completes and diagnostics contain only static categories/exit codes. Actual Windows protected-key generation and signature verification remain enabled and passed. Full 0.18.0 source/package/deployment and hosted/publication results are recorded separately as they finish.
- The corrected 0.18.0 full source gate passed all 33 tasks (nine cached, 24 fresh), with 560 platform tests/six explicit capability skips and 128 extension tests. Tracking passed 25 checks; formatting, references/inventory/evidence, documentation links, release agreement/coverage and diff checks passed. First-attempt lint evidence remains retained; the cancellation regression now also asserts the process was killed. Final package/deployment/publication acceptance follows the immutable source tag.

##### Files

- `packages/platform-service/src/engines/unreal/editor-bridge-tools.ts`
- `packages/platform-service/src/engines/unreal/dpapi-process.test.ts`
- `packages/platform-service/src/updates/release-metadata-cli.test.ts`
- `packages/platform-service/package.json`
- `docs/reference/DOCUMENTATION_INVENTORY.md`
- `docs/reference/documentation-inventory.json`
- `docs/STATUS.md`
- `docs/RELEASE_GUIDE.md`
- `docs/changes/2026-10-06-windows-cold-start-release-budgets.md`

### Maintenance

#### Prepare version 0.18.0

**Impact:** none

[Permanent work record](docs/changes/2026-10-06-release-0.18.0.md).

##### Summary

Prepare version 0.18.0 from 0.17.0, retaining all pending work records in the changelog and detailed release notes.

##### Details

Synchronize first-party workspace and internal dependency versions. The lockfile must be refreshed separately. No tag, publication, or build is performed by version preparation.

##### Validation

Clean native Windows npm ci and refreshed version/lockfile agreement passed. All 33 quality tasks passed (nine reused from the first attempt, 24 rerun after the assertion correction), including 560 platform tests/six explicit skips and 128 extension tests. All 25 tracking checks, formatting, generated references/inventory/evidence, documentation links, release coverage and diff checks passed. Targeted DPAPI/native metadata/A2A/tool-broker validation passed 34 checks. The first gate stopped on an unused fixture variable; asserting cancellation terminates the child repaired that lint failure before the successful gate. Version-assigned records become immutable with the source commit. Final tagged packaging, installed upgrade and hosted publication receive a separate permanent receipt; publisher signing and full uninstall/rollback remain unverified.

##### Files

- `packages/archive-extractor/package.json`
- `packages/contracts/package.json`
- `packages/platform-service/package.json`
- `packages/plugin-sdk/package.json`
- `packages/service-client/package.json`
- `packages/theia-control-room/package.json`
- `packages/plugins/sample-hello/package.json`
- `apps/control-room/package.json`
- `apps/control-room-browser/package.json`
- `package-lock.json`

## 0.17.0

### Fixed

#### Portable installer-handoff fixtures and corrected public release

**Impact:** none

[Permanent work record](docs/changes/2026-10-06-release-0.17.0-portable-handoff-tests.md).

##### Summary

Repair Windows-only parameterized installer tests that failed in hosted Linux, then prepare a new 0.17.0 testing release while preserving the failed 0.16.0 tag and validated local deployment.

##### Details

- Hosted Linux quality and release runs for v0.16.0 failed two installer fixture cases because it.each supplied the case value but no second callback context. The attempted context.skip call therefore threw before reporting an intentional platform skip. This was a test portability defect; Windows source/package/installed checks and ordinary data retention had passed.
- Apply the platform condition through it.skipIf before parameterizing the two native cases. Non-Windows runs explicitly skip the Windows executable lifecycle; Windows continues to run both real waiting/tampering cases. The portable digest/confinement test still runs everywhere. No application runtime, schema, engine bridge or isolation policy is weakened or changed.
- Preserve source commit 4fa7938205a56f62ee68f378e125734c5d0d4303, failed v0.16.0 tag/workflow diagnostics and the local 0.15.0/0.16.0 artifacts. Cancel remaining redundant work in failed runs; do not move the tag or publish a failed release. Prepare a new 0.17.0 minor version, retaining full cumulative release records and notes.
- Build and deploy the version-correct Windows package with the same profile checkpoint/backup, installed source/native checks and configuration/task retention. Verify the corrected hosted Windows/Linux matrix before publishing the explicitly authorized unsigned testing prerelease. Publication receives its own immutable-source receipt.

##### Validation

- Failed Linux release job 112551205852 and quality job 112551168765: 549 passing tests, 12 explicit skips and two context.skip failures. Actual API job logs are retained under .artifacts/local-deployment/0.16.0-1791327287740. The tag's browser build and live smoke passed before the failed matrix was canceled.
- Corrected Windows native handoff fixtures passed all three tests. An isolated WSL Node 24.20.0/Vitest 5.0.1 copy of the exact two source files passed the portable test and explicitly skipped the two native Windows cases. Its retained report is .artifacts/local-deployment/0.17.0-1791329647605/linux-handoff.log; the fixture is /tmp/playweld-ci-handoff-6unGkP. This direct platform check does not substitute for the complete hosted matrix.
- Clean npm ci and all 33 uncached quality tasks passed for 0.17.0, with 557 platform tests/six skips, 128 extension tests and 25 tracking checks. Formatting, generated references/inventory/evidence, version/lockfile agreement and release-ledger checks passed. Source is committed/tagged before final package/deployment so hosted and local verification can run concurrently; the separate receipt records actual completion before publication.
- The ordinary installed service remains verified at 0.16.0 until the version-correct upgrade completes. 0.17.0 packaging, installed retention and hosted publication are not claimed by these source checks.

##### Files

- `packages/platform-service/src/updates/installer-handoff.test.ts`
- `docs/STATUS.md`
- `docs/RELEASE_GUIDE.md`
- `docs/changes/2026-10-06-release-0.17.0-portable-handoff-tests.md`

### Maintenance

#### Prepare version 0.17.0

**Impact:** none

[Permanent work record](docs/changes/2026-10-06-release-0.17.0.md).

##### Summary

Prepare version 0.17.0 from 0.16.0, retaining all pending work records in the changelog and detailed release notes.

##### Details

Synchronize first-party workspace and internal dependency versions. The lockfile must be refreshed separately. No tag, publication, or build is performed by version preparation.

##### Validation

Clean npm ci and version/lockfile agreement passed. All 33 uncached quality tasks passed with 557 platform tests/six skips and 128 extension tests, plus 25 tracking checks, formatting, references/inventory/evidence and release coverage. Corrected handoff tests pass three real Windows cases and one portable WSL case/two explicit native skips. Application runtime is unchanged from the validated 0.16.0 deployment apart from release metadata. Final local package/deployment and hosted publication are recorded in a separate receipt after the tagged source becomes immutable.

##### Files

- `packages/archive-extractor/package.json`
- `packages/contracts/package.json`
- `packages/platform-service/package.json`
- `packages/plugin-sdk/package.json`
- `packages/service-client/package.json`
- `packages/theia-control-room/package.json`
- `packages/plugins/sample-hello/package.json`
- `apps/control-room/package.json`
- `apps/control-room-browser/package.json`
- `package-lock.json`

## 0.16.0

### Fixed

#### Preserve installed runtime permissions for Windows LPAC

**Impact:** patch

[Permanent work record](docs/changes/2026-10-06-installed-runtime-lpac-permissions.md).

##### Summary

Fix Windows isolation startup from an administrator-owned Program Files runtime without requiring ordinary users to rewrite its permissions.

##### Details

- Final deployment acceptance reproduced an installed-runtime defect: the 0.15.0 candidate passed LPAC in its user-owned build/stage directories, but the same launcher reported unavailable when run through the actual Program Files Electron executable. That runtime grants read/execute to All Restricted Application Packages, while normal users cannot rewrite its ACL.
- Reuse that existing read/execute grant for read-only runtime paths. Require the precise ARAP SID, complete read/execute rights and no intersecting deny rule. The broader All Application Packages grant remains insufficient, so the existing AAP-negative probe is preserved. Writable scratch still requires the unique container SID and low-integrity label.
- Cleanup skips files with no owned container rule rather than attempting unauthorized writes to runtime ACLs. Private source/runtime paths still receive scoped SID grants and owned cleanup. This is a compatibility repair; no isolation fallback, elevation requirement or broad host permission is introduced.
- Extend the retained isolation harness with an explicit installed executable option. It still reports actual Node/Electron boundary results and Job descendant termination. Only the owned temporary probe paths are writable.
- Preserve the staged 0.15.0 candidate and use a new 0.16.0 release for the fix. The ordinary installation remains at 0.14.0 until corrected-package acceptance completes.

##### Validation

- Before the fix, the actual Program Files executable plus source-built launcher returned available=false with an unauthorized ACL operation; its installed ARAP read/execute grant was independently inspected. No ordinary service or Project was stopped or modified by that probe.
- Native helper/service rebuild passed. `.artifacts/windows-isolation/1791327194125/report.json` passes all five boundary checks in Node, development Electron and the actual administrator-owned Program Files Electron executable under the ordinary user. The broader AAP file remains denied, scratch writes pass, and the owned worker/descendant termination check passes. No runtime ACL elevation was required. Corrected release packaging and installed acceptance are recorded separately as they finish.

##### Files

- `packages/platform-service/src/plugins/isolation/native/AppContainerHost.cs`
- `scripts/windows-isolation-acceptance.cjs`
- `docs/changes/2026-10-06-installed-runtime-lpac-permissions.md`

### Maintenance

#### Deploy and publish PlayWeld 0.16.0

**Impact:** none

[Permanent work record](docs/changes/2026-10-06-local-0.16.0-deployment.md).

##### Summary

Deploy the corrected PlayWeld 0.16.0 locally, then commit/push and publish the explicitly authorized unsigned testing prerelease with complete work records and release notes. Local deployment acceptance passed; hosted publication is recorded in its separate receipt.

##### Details

- The 0.15.0 candidate exposed an installed Program Files LPAC permissions defect before deployment. Preserve that candidate and all historical artifacts; use a new 0.16.0 minor version for the repaired source. No previous tag or published version is moved or reused.
- This release carries the cumulative provider/embedding, worker checkpoint/continuation, MCP scope/race, adversarial UI, managed Unity/Unreal/Godot, external IDE, Windows isolation and protected update work recorded in 0.11.0 through 0.15.0. The prior public release remains 0.10.2. Full records and detailed version notes remain in the tagged source and generated changelog; intermediate candidates are not presented as public releases.
- The complete [0.15.0 candidate notes](https://github.com/scarecr0w12/PlayWeld/blob/v0.16.0/docs/releases/v0.15.0.md) and [generated changelog](https://github.com/scarecr0w12/PlayWeld/blob/v0.16.0/CHANGELOG.md) are retained in the new v0.16.0 source. Candidate notes link the preceding 0.11.0-0.14.0 records. Public release prose includes the 0.15.0 feature details together with the final installed-runtime repair and deployment validation.
- Run the reusable acceptance script against the ordinary installed 0.14.0 profile. Confirm no active/nonterminal tasks before checkpointing; copy the profile and snapshot every registered Project database. Compare installed release bytes and configuration, Project, model, pool, account, credential-key, pricing and task identities after upgrade. Leave unrelated staged services and production engine Projects intact.
- Refuse missing profile/Project database paths before opening SQLite, so a bad registration cannot cause the read/backup tool to create an empty database.
- Wait for restarted IPC readiness and compare normalized serialized configuration fields. The initial post-install check ran before IPC startup; the later direct object comparison also flagged SQLite null-prototype rows against parsed JSON despite equal data. Compare each field's serialized fingerprint and keep failure diagnostics from dumping complete configuration/task histories.
- The package verifier requires the native helper, IDE/handoff runtimes, exact authored editor source and 30 bundled skills, then runs the actual packaged LPAC probe. After installation, repeat the installed runtime boundaries and desktop smoke against an isolated fixture profile.
- Commit and push the verified source, create a new annotated v0.16.0 tag, inspect the actual hosted Windows/Linux artifacts and checksum metadata, then publish the authorized unsigned testing prerelease. Publishing acceptance is recorded in a separate permanent receipt after the tagged records become immutable.
- No Windows certificate or GitHub signing secret exists. Preserve explicit unsigned/testing labels and the stable-channel exclusion; do not claim publisher trust, complete uninstall/rollback or arbitrary production acceptance.
- Staged diff review found whitespace-only context lines required by the two existing unified dependency patches. Preserve their bytes and disable whitespace diagnostics only for patches/*.patch through Git attributes; ordinary source checks retain their whitespace rules.

##### Validation

- The repaired source passed all five boundary probes through actual administrator-owned Program Files Electron as an ordinary user. Node and development Electron also passed; owned worker/descendant termination passed. The retained isolation report is recorded in the separate runtime-permissions repair record.
- Clean native npm ci applied both pinned dependency patches. The final 0.16.0 gate passed 33/33 tasks uncached: 557 platform tests/six skips and 128 extension tests. Tracking tests passed 25 checks. Formatting, generated references, inventory/evidence integrity, local links, version/lockfile agreement and release-ledger checks passed.
- Windows package verification passed native dependencies, service lifecycle, 30 skills, exact Unity/Unreal/Godot source and actual packaged Electron LPAC. The staged desktop smoke passed 29 checks with zero renderer errors at `.artifacts/documentation-electron/1791328313501`. The installer is unsigned; staging records its dirty pre-commit source fingerprints and preserves the existing 0.15.0 candidate.
- Installer exited 0 and upgraded the existing all-users Program Files installation from 0.14.0 to 0.16.0. Its SHA-256 is 4064b2444d16a09b1d732d530cace5d44684811f7fb241cebdbdc82000fe652b. Backups and authenticated before/after records are retained at .artifacts/local-deployment/0.16.0-1791327287740; all four Project databases and the complete ordinary profile were preserved before installation.
- All 417 selected installed application/service/contracts/extension files match Windows-Release/0.16.0. Native verification passed again from Program Files, including actual installed Electron LPAC. Installed desktop smoke passed 29 checks and zero renderer errors at .artifacts/documentation-electron/1791328837016.
- Ordinary service version 0.16.0 is available after deployment. Serialized retention checks passed for four Projects, 139 models, five pools, configured settings/accounts, credential-key fingerprint, pricing and all captured Project task IDs/states. The two unrelated old staged services retained their original PIDs; production editor Projects were untouched.
- The temporary IPC-startup and SQLite-prototype test failures were investigated and repaired in the acceptance tool; the final retention pass compares equal stored values, rather than ignoring a data difference. No uninstall/rollback drill or publisher signing is claimed.
- Source commit, tag and hosted publication follow these completed local checks. The publication receipt will record actual immutable tag/source, hosted results and public artifact checks after publication.

##### Files

- `.gitattributes`
- `scripts/local-deployment-acceptance.cjs`
- `docs/STATUS.md`
- `docs/RELEASE_GUIDE.md`
- `docs/changes/2026-10-06-local-0.16.0-deployment.md`

#### Prepare version 0.16.0

**Impact:** none

[Permanent work record](docs/changes/2026-10-06-release-0.16.0.md).

##### Summary

Prepare version 0.16.0 from 0.15.0, retaining all pending work records in the changelog and detailed release notes.

##### Details

Synchronize first-party workspace and internal dependency versions. The lockfile must be refreshed separately. No tag, publication, or build is performed by version preparation.

##### Validation

Clean npm ci and version/lockfile agreement passed. All 33 quality tasks passed uncached with 557 platform tests/six skips and 128 extension tests; 25 tracking checks, formatting, generated references/inventory/evidence, links and change coverage passed. Windows packaging, exact bundled editor source, native resources, service startup, actual packaged/installed LPAC, 29 staged and 29 installed desktop checks passed. The ordinary all-users 0.14.0-to-0.16.0 upgrade retained four Projects, 139 models, five pools, configuration/accounts/key fingerprints/pricing and task identities; 417 installed files match the stage. See the local deployment record for retained paths and installer hash. The installer is unsigned. Hosted publication is a separate receipt; uninstall/rollback and publisher trust remain unverified.

##### Files

- `packages/archive-extractor/package.json`
- `packages/contracts/package.json`
- `packages/platform-service/package.json`
- `packages/plugin-sdk/package.json`
- `packages/service-client/package.json`
- `packages/theia-control-room/package.json`
- `packages/plugins/sample-hello/package.json`
- `apps/control-room/package.json`
- `apps/control-room-browser/package.json`
- `package-lock.json`

## 0.15.0

### Added

#### External IDE MCP and native Theia router adapters

**Impact:** minor

[Permanent work record](docs/changes/2026-10-06-external-ide-and-theia-adapters.md).

##### Summary

Implement the previously missing local external-IDE MCP server and native Theia language-model/tool contributions, verified through real SDK stdio/service integration and the rendered desktop registry.

##### Details

- Add `gamecrafter-mcp`, a newline stdio MCP executable bound to an explicit registered Project. Startup uses local authenticated service discovery without passing a token in arguments. Modern discovery and legacy initialization expose live tool definitions; calls use the existing broker and its permissions, approvals, records and containment.
- Stable hashed MCP tool names preserve original IDs in descriptions. Native tool schemas are wrapped under an `input` object property, retaining union/scalar validation while meeting the MCP SDK schema contract. Unknown tools and attempts to replace the Project/argument envelope are rejected.
- Add one frontend Theia `LanguageModel` contribution forwarding to the service router and two broker tool contributions. Workspace-derived selection rejects empty or ambiguous context; explicit registered context is validated. Model tool calls use the captured Project and service broker rather than injected Theia callbacks.
- Map text/tool conversation messages, usage and completed tool results, with a bounded eight-turn loop, cancellation checks and checks before subsequent mutations after workspace changes. Unsupported image/provider-specific messages are rejected rather than silently dropped. Service completion is buffered; this is not a new provider token-stream implementation.
- Add the exact existing Theia AI core 1.75.0 dependency and refresh workspace lock metadata for that dependency and the new MCP bin. Registry metadata confirms its 2026-08-27 publication, older than seven days; no Theia version upgrade or provider/model override occurred.
- Extend the rendered adversarial audit with a synthetic local model account, actual native Theia registry lookup and service-routed completion. Fixtures remain isolated from ordinary profiles and paid accounts.
- Compatibility and migration: package identities, service authentication and persisted Project/tool records remain unchanged. The new CLI and adapter APIs are compatible additions. Existing Control Room Chat/Swarm paths retain their implementations; this warrants minor impact.

##### Validation

- Real MCP SDK stdio integration passed against an isolated actual service: tool listing/calling, selected-Project reads, foreign file refusal, unknown tool refusal, retained broker history and no service token in results/stderr. The initial SDK check caught non-object native schemas; the envelope repair passes.
- Four native Theia adapter unit tests passed, including service routing/usage, broker calls, cancelled/changed/empty context and unsupported/foreign callback refusal.
- The combined repository gate passed 33/33 tasks, with 557 platform tests/six skips and 128 extension tests. The real source-built desktop audit passed 196 checks with zero findings or renderer exceptions at `.artifacts/adversarial-electron/1791322029053/report.json`, including registry discovery, service-routed native model completion and registered broker tool providers.
- Personal external IDE setup, provider token streaming, images, and transport-level cancellation are not claimed as verified. The registry completion uses a labeled local HTTP model fixture, not a new paid provider call.

##### Files

- `packages/platform-service/src/mcp/external-ide-server.ts`
- `packages/platform-service/src/mcp/external-ide-server.test.ts`
- `packages/platform-service/package.json`
- `packages/theia-control-room/src/common/theia-model-adapter.ts`
- `packages/theia-control-room/src/common/theia-model-adapter.test.ts`
- `packages/theia-control-room/src/browser/theia-model-contribution.ts`
- `packages/theia-control-room/src/browser/control-room-frontend-module.ts`
- `packages/theia-control-room/package.json`
- `package-lock.json`
- `scripts/adversarial-ui-audit.cjs`
- `docs/EXTERNAL_IDE_INTEGRATION.md`
- `docs/changes/2026-10-06-external-ide-and-theia-adapters.md`

#### Managed Unity, Unreal and Godot editor bridges

**Impact:** minor

[Permanent work record](docs/changes/2026-10-06-managed-editor-bridges.md).

##### Summary

Add project-local Unity and Godot editor bridges and install/pair actions in the Engine panel. Extend managed installation and identity validation across all three supported engines, with real editor acceptance evidence.

##### Details

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

##### Validation

- Real Unity 6000.6.0f1 acceptance passed 11 checks at `.artifacts/editor-bridge/1791322530517-unity/report.json`: repeat installation, protected credential retention, automatic startup, verified pairing/identity, unauthenticated refusal, spawn/move, user-object refusal, owned deletion, ready live layer and viewport capture.
- Real Unreal 5.8.3 passed 14 checks at `.artifacts/editor-bridge/1791324194385-unreal/report.json`, including compilation/application through the actual managed PlayWeld tool and reuse of matching binaries, followed by the real editor operations.
- Real Godot 4.7.2 through WSL passed the equivalent 11 checks at `.artifacts/editor-bridge/1791322616619-godot/report.json`.
- Earlier failures exposed removed Unity APIs, unavailable managed DPAPI, deferred startup, WSL command quoting and the Godot capability comparison; failed artifacts remain retained. The final runs exercise actual PlayWeld broker and service calls, not fixture MCP servers.
- The combined repository gate passed all 33 tasks, with 557 platform tests/six skips and 128 extension tests. Managed installation and Engine guidance regressions passed. The source-built Electron audit passed 196 checks at 1920 x 1080, 1440 x 1000 and 1024 x 900 with no findings or renderer exceptions; the Live bridge capture was visually inspected.
- Visual inspection exposed empty-scene captures as weak evidence. The harness now supplies visible user-owned cube fixtures and retains their mutation-refusal checks; Unity/Godot reruns pass all 11 checks each. Unreal also uses an explicitly framed disposable viewport fixture. These are editor-only authoring checks, not game runtime, arbitrary Project correctness or a new packaged deployment.
- The final Unreal run passes all 14 checks after the reserved-port fix, binds to OS-assigned loopback port 63522 and captures a visibly rendered cube. Unity, Godot and Unreal viewport images were inspected directly. The earlier dark captures, unsupported fixture-only `viewmode` console attempt and reserved-port startup failure remain retained; the fixture now uses the supported camera-alignment command and explicit actor position.
- The final post-port-fix gate at `.turbo/adversarial-review/remaining-gaps-port-fix-quality.log` passes 33/33 tasks (22 verified cached tasks), including 557 platform tests/six skips and 128 extension tests. Repository formatting, generated RPC/settings references, documentation inventory/evidence integrity, local Markdown links, 0.14.0 workspace/lockfile agreement and diff checks pass. The change ledger is regenerated and coverage checked against HEAD. No new installer, hosted run or ordinary deployment is claimed.
- Update current status, dependency-plan evidence, integration instructions and documentation navigation. Historical acceptance remains labeled; no confirmed decision, release version or ordinary Project is changed.

##### Files

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

#### Expose verified Meshy credit balance in account testing

**Impact:** minor

[Permanent work record](docs/changes/2026-10-06-meshy-live-balance.md).

##### Summary

Meshy account testing now returns its real credit balance through the documented authenticated balance endpoint.

##### Details

- The old adapter advertised no balance support and tested a task-list endpoint, always returning null. It now advertises balance support and uses `GET /openapi/v1/balance`, forwarding the numeric balance through the existing account-test RPC and UI.
- Finite nonnegative balances are retained, including zero; missing, negative or nonnumeric values remain unknown instead of becoming an invented credit count. Authentication/error redaction and HTTP timeout/retry behavior continue through the shared provider request helper.
- Add a real HTTP fixture regression for route/authentication, positive/zero credits and malformed balances. Update the asset-service integration and documentation asset fixtures to implement the balance route and assert its RPC result.
- Endpoint and payload were checked against [Meshy balance documentation](https://docs.meshy.ai/en/api/balance) on 2026-10-06. One authorized live `meshy-6-lite` preview/download/review/import consumed exactly five credits, matching [current pricing](https://docs.meshy.ai/en/api/pricing). This is an integration test asset, not production art approval.
- Compatible new provider capability uses minor impact; no RPC/schema migration is required because account testing already has a nullable balance field. No paid generation is added to ordinary account testing.

##### Validation

- The new fixture test failed before implementation and passed through the full combined gate afterward; the asset-service integration exercises the actual account-test RPC.
- Live balance returned 2697 credits before the single preview and 2692 afterward. The downloaded/imported GLB matched its recorded SHA-256 and unreviewed import was rejected. Both provider acceptance runs found zero plaintext source API credential leaks.
- Image/refine requests, Tripo generation, commercial rights and production mesh quality remain outside this live result. The account-test operation itself is read-only at the provider.

##### Files

- `packages/platform-service/src/assets/providers/meshy.ts`
- `packages/platform-service/src/assets/providers/providers.test.ts`
- `packages/platform-service/src/assets/asset-service.integration.test.ts`
- `scripts/documentation/asset-scenario.cjs`
- `docs/changes/2026-10-06-meshy-live-balance.md`

#### Protected release keys and verified installer handoff

**Impact:** minor

[Permanent work record](docs/changes/2026-10-06-protected-signing-and-installer-handoff.md).

##### Summary

Add protected local release-signing keys, retain verified previous installers without filename collisions and implement a Windows installer handoff after desktop exit. Publisher trust and complete installer lifecycle remain separate unverified acceptance paths.

##### Details

- Add a Windows CurrentUser DPAPI-protected Ed25519 key generator and protected-key reader. Existing key files are never overwritten; plaintext private material is not written to disk or command arguments. Release metadata can use `--signing-key-file`, while the existing configured CI secret remains supported. Ambiguous key sources are rejected; unsigned release gates and the required public platform matrix remain unchanged.
- Verification metadata lives in new versioned sidecar records; existing downloaded/previous package records retain their exact version-1 shape. Packages use separate version directories so identical installer filenames across releases cannot overwrite the rollback package. A release check captures the verified current-version package before clearing its pending download; a subsequent download also preserves that package. The store reports the actual running application version after an upgrade rather than a stale saved version.
- Signed Windows install/rollback preparation rechecks file bytes and confines packages to the owned cache. A service-owned versioned handoff descriptor records its state. Legacy records without digest/signature provenance and other platform packages retain manual instructions.
- The Electron backend starts the service's detached helper using a minimal environment, without provider secrets. The helper waits for the desktop process to exit, checks the package again immediately before launch, avoids duplicate helpers through an owned lease, records launch/failure/expiration and expires after ten minutes. It does not force-close editors or discard unsaved work.
- Additive optional RPC handoff fields preserve existing clients. Legacy package records without verification sidecars retain manual installation/rollback instructions. Generated API references are refreshed. The visible handoff and protected-key workflow warrant minor impact.
- The user reported having no Windows code-signing certificate. Local Ed25519 metadata verification is distinct from Windows Authenticode publisher trust; neither the source nor fixture tests claim a publisher-trusted installer.

##### Validation

- All 31 update-service checks passed, including retention when a newer release reuses an installer filename, versioned cache contents and verification sidecars. Seven focused handoff/key checks passed: protected-key generation and non-overwrite, valid metadata/checksum signatures, changed-byte refusal, process-exit waiting, native harmless PE launch and refusal after tampering.
- The harmless executable fixtures are retained under `.artifacts/installer-handoff-tests/` for review. Early temporary-folder cleanup failures were investigated; fixture launch and tampering behavior passed, but cross-process temporary-file ACL cleanup was not a successful acceptance result. The retained fixture layout avoids claiming that cleanup as verified.
- The combined repository gate passed 33/33 tasks, including 557 platform tests/six skips and 128 extension tests. Complete packaged install/upgrade/uninstall/rollback, public trust-key distribution, hosted matrix/publication and Authenticode signing remain pending or unavailable. No ordinary installation or user profile was replaced by these fixture tests.

##### Files

- `packages/contracts/src/updates/schema.ts`
- `packages/contracts/src/rpc/protocol.ts`
- `packages/platform-service/src/updates/installer-handoff.ts`
- `packages/platform-service/src/updates/installer-handoff.test.ts`
- `packages/platform-service/src/updates/update-service.ts`
- `packages/platform-service/src/updates/update-service.test.ts`
- `packages/platform-service/src/updates/update-store.ts`
- `packages/platform-service/src/updates/release-metadata-cli.test.ts`
- `packages/theia-control-room/src/node/control-room-service.ts`
- `packages/theia-control-room/src/browser/updates-widget.tsx`
- `scripts/release-signing-key.cjs`
- `scripts/create-release-metadata.cjs`
- `docs/API_REFERENCE.md`
- `docs/RELEASE_GUIDE.md`
- `docs/reference/rpc-methods.json`
- `docs/reference/rpc-schemas.json`
- `docs/changes/2026-10-06-protected-signing-and-installer-handoff.md`

### Fixed

#### Keep Project views isolated and clarify engine readiness

**Impact:** patch

[Permanent work record](docs/changes/2026-10-06-project-view-isolation-and-guidance.md).

##### Summary

Repair obsolete asynchronous responses, stale Project evidence, narrow dock overflow and misleading Engine readiness guidance across the Control Room.

##### Details

- Engine and DCC Project loads now capture Project/tool context and request generations. Old responses and failures cannot overwrite the selected context; clearing the selection removes capability, bridge and run evidence. DCC errors are caught instead of escaping event handlers. Same-context refresh preserves selected run evidence and action results.
- Assets library refresh guards its snapshot and busy state. Context changes clear old files/jobs, previews, review notes and the source-job selection. Preview requests have their own generations; generation, review/cancel and import completion are ignored after navigation, including the follow-up imported preview.
- A final deferred-submit regression reproduced two paid generation RPCs from repeated clicks while the first was pending. Generate now refuses an already-busy submission and immediately renders the disabled state. This repairs UI duplication; provider idempotency/recovery after ambiguous remote failures remains separate open work.
- Knowledge guards status, record list, vector settings, search, record detail and graph publication against changed context. A context change clears the old index/records/graph/search evidence, while a same-Project refresh preserves selected content. Refresh snapshots have their own generation and overlapping busy operations are counted. Three additional regressions reproduced offline status/records/settings notification failures; these now produce a scoped error instead of an uncaught asynchronous rejection, and obsolete errors are ignored.
- Skills, Plugins and Connections publish only the latest context snapshot. Plugins fetch context-specific tools with the snapshot instead of accepting a later independent tool result. Explicit Connections scope changes also clear tool/log caches and selection.
- Shared CSS bounds fields, labels, forms and fieldsets; wraps actions and heading text; gives Engine/DCC tables their own horizontal scroll; stacks relevant narrow grids; and avoids form rules stretching checkboxes/radios. This repairs observed narrow dock overflow without hiding oversized content.
- Engine guidance now explains that missing native game files must be supplied before installation can make operations usable. Capability badges count layers and operation badges count available operations instead of all unavailable definitions. The native installation form remains available in its own section.
- Add eighteen response/failure-isolation regressions, one Engine guidance regression and one duplicate paid-submission regression. Existing Assets/Knowledge fixtures initialize the new counters to match constructed widgets.
- Compatible visible fixes require a patch impact. No data/RPC schema migration or compatibility-identifier rename is required. Existing service ownership and deliberate Project selection are preserved.

##### Validation

- Reordered-response regressions first failed for Engine, DCC, Assets and Knowledge; three additional regressions failed for Skills, Plugins and Connections. The repaired response suite passes; existing import/generation tests remain covered.
- Uncached full gate passed 33/33 before later follow-ups; the final combined gate passed all 33 tasks with 542 platform tests/11 skips and 124 extension tests, including the three offline-notification regressions and duplicate-generation case. Twenty-five unchanged tasks use verified cache entries; the fresh platform run is retained separately.
- Larger-window browser and development Electron audits each passed 195 rendered checks with zero renderer exceptions. The final guidance text/count correction passed another 195-state Electron recheck; the updated local asset workflow also passed. Offline failures use deterministic regressions, not a live provider outage claim.
- Narrow 480-pixel stress captures are retained as supplemental evidence. They are not normal desktop acceptance; full accessibility, production engine UI and installer verification are not claimed.

##### Files

- `packages/theia-control-room/src/browser/assets-widget.tsx`
- `packages/theia-control-room/src/browser/assets-widget.test.tsx`
- `packages/theia-control-room/src/browser/connections-widget.tsx`
- `packages/theia-control-room/src/browser/dcc-widget.tsx`
- `packages/theia-control-room/src/browser/engine-widget.tsx`
- `packages/theia-control-room/src/browser/engine-widget.test.tsx`
- `packages/theia-control-room/src/browser/knowledge-widget.tsx`
- `packages/theia-control-room/src/browser/knowledge-widget.test.ts`
- `packages/theia-control-room/src/browser/plugins-catalog-widget.tsx`
- `packages/theia-control-room/src/browser/skills-widget.tsx`
- `packages/theia-control-room/src/browser/style/workstation.css`
- `packages/theia-control-room/src/browser/project-view-isolation.test.ts`
- `docs/changes/2026-10-06-project-view-isolation-and-guidance.md`

### Security

#### Pin and verify the patched MCP fixture SDK resolution

**Impact:** none

[Permanent work record](docs/changes/2026-10-06-patched-mcp-sdk-resolution.md).

##### Summary

Use the published patched MCP TypeScript SDK in the development/fixture dependency tree and detect stale nested installations.

##### Details

- Update the platform-service's exact development dependency from 1.30.0 to 1.31.0 and add a matching root override so shared consumers resolve the same selected version. Version 1.31.0 was published 2026-09-28, satisfying the seven-day preference on this review date.
- The newly listed [OAuth issuer-binding advisory](https://github.com/advisories/GHSA-6qxp-vccf-f47h) affects earlier SDK clients that use OAuth credentials with untrusted HTTP MCP servers. This repository's product MCP implementation is custom; the SDK is a development fixture dependency. The dependency finding is not presented as a reproduced credential leak in PlayWeld.
- A lockfile-only refresh and clean install retained an invalid nested 1.30.0 SDK. An exact workspace install corrected that resolution; the root override prevents a separate newer shared SDK from drifting beyond the selected pin. Preserve the existing braces/sprintf patches and the unified Theia version.
- Add a regression that resolves the SDK entry actually loaded from the platform-service and reads that installation's version, requiring it to match the exact declaration and meet the patched minimum. This catches installed-tree disagreement that a manifest-only assertion would miss.
- Internal development dependency maintenance uses no product version impact; no service/RPC/data migration or compatibility rename is required. The package lock records the exact resulting resolution.

##### Validation

- Checked the advisory and npm publication metadata. Before correction, `npm ls` reported the nested 1.30.0 installation invalid against the 1.31.0 declaration; afterward it reports 1.31.0 overridden.
- Clean `npm ci` successfully reapplied both existing local dependency patches. The resolved-version guard and MCP suite passed 65 tests across 14 files. Final full dependency audit reports 19 entries (10 high, nine moderate, zero critical), all rooted in the existing locally patched braces/sprintf packages. Actual evidence is retained under `.turbo/adversarial-review/`.
- Remaining registry advisories from the locally patched braces/sprintf versions must still be reported; neither package had an upstream patched release during this pass. This change is not a comprehensive security certification.

##### Files

- `package.json`
- `package-lock.json`
- `packages/platform-service/package.json`
- `packages/platform-service/src/dependencies/mcp-sdk-version.test.ts`
- `docs/changes/2026-10-06-patched-mcp-sdk-resolution.md`

#### Native Windows plugin isolation

**Impact:** minor

[Permanent work record](docs/changes/2026-10-06-windows-plugin-isolation.md).

##### Summary

Replace the Windows unavailable stub with a native less-privileged AppContainer launcher, with real Node/Electron boundary probes and shared Node/Python plugin lifecycle checks.

##### Details

- The plugin host now starts a suspended Windows worker with explicit container permissions, a minimal environment, an inherited stdio handle list and a Job limiting memory and process count. The Job kills descendants when the helper closes. Plugin source is read-only; writes are confined to separate owned scratch storage. Project files are accessed through the existing broker rather than mounted into the worker.
- The build compiles a small .NET Framework helper on Windows and copies it with the service. Non-Windows builds retain their existing launchers. Native helper errors keep isolation unavailable; there is no automatic unrestricted fallback.
- The probe executes Node inside the sandbox and requires denial of a private host file, an All Application Packages readable fixture, source modification and an owned loopback connection, together with a successful scratch write. It uses the documented AppContainer creation attributes; Win32 token query class 46 proved unsupported on this machine, so LPAC opt-out is checked behaviorally rather than inferred from that failed query.
- Node requires the OS registryRead capability to initialize Winsock; network capability remains separately controlled. Node module loading preserves symlink names to avoid inspecting drive roots. Default Python names resolve through the installed Windows Python launcher instead of an unusable Windows Store alias. Electron Node mode receives the equivalent Node options.
- Native stdio writes flush each RPC chunk. An initial lifecycle run exposed buffering that the exit-only probe did not exercise. Native ACL updates use per-path locks so concurrent helpers preserve each other's SID rules; cleanup removes only the owned SID, and native pipe handles close on failed startup.
- Shared plugin lifecycle tests now exercise the native Windows backend. The panel escape test uses a Windows junction instead of requiring privileged file symlink creation; Linux keeps its original fixture.
- Compatibility and migration: plugin manifests, broker contracts and stored records are unchanged. The new backend enables previously unavailable restricted Windows execution. The feature warrants minor impact; this is scoped isolation evidence, not a general security certification.

##### Validation

- Native helper compilation and TypeScript build passed. The live five-check LPAC probe passed on Windows, including private-file, All Application Packages, source-write and network denial plus scratch writes.
- Initial lifecycle failures are retained: stdio buffering, the Store Python alias and a Linux-only file symlink fixture. These were corrected; 16 focused isolation, plugin lifecycle and managed-install checks passed with two explicit Linux-only skips. The full repository checks passed as recorded below.
- The retained live report `.artifacts/windows-isolation/1791318379431/report.json` passed all five boundary checks in both Node and actual Electron Node mode. Turbo service build inputs include bundled integrations/skills and Windows build environment; tests depend on the service build so CLI/helper fixtures use current artifacts.
- The combined repository gate passed 33/33 tasks: 557 platform tests passed with six explicit skips, and 128 extension tests passed. Service builds include the compiled helper. A new packaged installer, adversarial process/memory-limit exhaustion, allowed outbound networking and alternate Windows versions remain unverified.
- `.artifacts/windows-isolation/1791324154239/report.json` repeats all five Node/Electron boundary checks and proves that terminating the owned helper kills both its worker and spawned descendant. The early workspace-scratch attempt failed because its managed ACL denied mandatory-label changes; native execution stayed fail-closed. The passing descendant fixture uses an owned temporary directory with those permissions; its path is retained in the report. This does not prove that every custom profile ACL supports LPAC scratch setup.

##### Files

- `packages/platform-service/src/plugins/isolation/native/AppContainerHost.cs`
- `packages/platform-service/src/plugins/isolation/appcontainer-launcher.ts`
- `packages/platform-service/src/plugins/isolation/isolation.test.ts`
- `packages/platform-service/src/plugins/plugin-service.integration.test.ts`
- `packages/platform-service/scripts/build-appcontainer.cjs`
- `packages/platform-service/scripts/copy-assets.cjs`
- `turbo.json`
- `scripts/windows-isolation-acceptance.cjs`
- `docs/changes/2026-10-06-windows-plugin-isolation.md`

### Documentation

#### Refresh documentation surface inventory

**Impact:** none

[Permanent work record](docs/changes/2026-10-06-documentation-inventory-refresh.md).

##### Summary

Regenerate the documentation inventory so discovery and evidence checks include the current service source tree.

##### Details

- The documentation evidence check found that the retained inventory omitted the existing dependencies subsystem. Regenerate both inventory outputs with the existing generator.
- Refresh discovered regression-test paths for current engine and worker sources, including the later managed-editor and installer-handoff tests. The generator continues to describe test paths as discoverability, not acceptance.
- No generator, runtime, schema, version, compatibility, or migration changes.

##### Validation

- Initial node scripts/check-documentation-evidence.cjs failed because the inventory did not include the dependencies directory already present before this task.
- node scripts/generate-documentation-inventory.cjs and its --check mode passed.
- node scripts/check-documentation-evidence.cjs passed after regeneration: 198 methods, 28 notifications, 85 settings, 26 service subsystems, 16 Control Room surfaces, 10 capture reports, and 151 referenced PNG files.
- These checks establish inventory/report/file integrity only. They do not validate prose layout or repeat historical live workflows.
- Repository link check and changelog coverage check against HEAD passed. Generated inventory freshness passed. No historical report or screenshot was regenerated.

##### Files

- `docs/reference/DOCUMENTATION_INVENTORY.md`
- `docs/reference/documentation-inventory.json`
- `docs/changes/2026-10-06-documentation-inventory-refresh.md`

#### Improve documentation readability and navigation

**Impact:** none

[Permanent work record](docs/changes/2026-10-06-documentation-readability.md).

##### Summary

Organize PlayWeld's README and main guides around reader tasks, with clearer setup instructions, navigation, and tutorial outcomes.

##### Details

- Rewrite the root README to introduce PlayWeld in plain language, offer task-based starting points, and present desktop setup before development-browser instructions. Retain compatibility naming, license, project resources, and links to design authority and current capability evidence.
- Reorganize the documentation index into goals, learning, audience guides, references, releases, design authority, and verification. Replace copied method/setting counts and historical test totals with links to the owning references and reports.
- Add task navigation to the user, operations, developer, integration, Control Room, and workflow guides. Preserve all pre-existing section headings and their anchors.
- Turn Project creation and settings precedence into readable steps and split dense model-routing prose without changing those rules.
- Replace blanket provider/release acceptance statements in the User Guide with links to dated status, work, and release records so the overview does not flatten operation-specific evidence.
- Add tutorial prerequisites, a linked walkthrough, completion checkpoints, and a troubleshooting route. Move detailed historical screenshot context into dedicated evidence sections in the tutorial and handbook; retain a short notice near the top.
- Add contributor guidance for reader-focused documentation: prerequisites, commands, UI names, success checks, stable links, and evidence limits. Move the work-record instructions into contribution review.
- Preserve existing uncommitted User Guide continuation instructions and Integration Guide first-party Unreal bridge documentation. No runtime, contract, dependency, decision status, version, or migration changes are part of this editorial task.
- This pass covers the primary entry points and guides. It does not rewrite every design document, research note, generated reference, or historical acceptance report.

##### Validation

- Full repository build/typecheck/lint/test gate passed: 33 of 33 tasks, all served from the existing Turborepo cache. Dependencies were already installed; npm ci was not rerun against the shared active checkout.
- Repository format check passed. The explicit Markdown formatting pass covers the edited guides and records, which the repository-wide format command normally ignores.
- The repository link checker passed. Existing guide section headings and anchors were retained; new navigation targets resolve. Reviewed the editorial diffs, setup command names, screenshot-context relocation, and retained uncommitted additions.
- Changelog generation and changelog coverage check against HEAD passed. The documentation evidence check passed after the separately recorded inventory refresh.
- No new screenshots, live-engine, model-provider, installer, or usability-study evidence was collected. Historical screenshot evidence remains historical.

##### Files

- `README.md`
- `docs/README.md`
- `docs/USER_GUIDE.md`
- `docs/OPERATIONS_GUIDE.md`
- `docs/DEVELOPER_GUIDE.md`
- `docs/INTEGRATION_GUIDE.md`
- `docs/WORKFLOW_COOKBOOK.md`
- `docs/CONTROL_ROOM_HANDBOOK.md`
- `docs/WORKED_TUTORIAL.md`
- `docs/changes/2026-10-06-documentation-readability.md`

### Maintenance

#### Run adversarial desktop, workflow, engine and provider acceptance

**Impact:** none

[Permanent work record](docs/changes/2026-10-06-adversarial-system-audit.md).

##### Summary

Add repeatable broad UI/provider acceptance, execute current local and live checks, and record repaired defects and remaining completion boundaries.

##### Details

- Add a real isolated-service audit covering Project Home and all fifteen views, primary/nested sections, three desktop sizes, field names, duplicate IDs, missing section targets, horizontal containment and renderer exceptions. Each state retains a screenshot and report; view failures are collected so later views still run.
- The audit supports owned development Electron and browser targets, uses two disposable Projects including a long name, validates trust only for those folders, and closes only owned resources. Primary review uses 1920x1080, with 1440x1000 and 1024x900 secondary sizes; optional `--stress` adds 650 pixels. Earlier 480-pixel captures are preserved as supplemental evidence, not normal desktop quality.
- Correct the pre-existing workspace smoke to count selected buttons within independent navigation groups. Update live-engine acceptance to report the workspace version instead of 0.1.0 and reject unknown stages.
- Add live provider acceptance that reads existing encrypted credentials only in memory, re-encrypts them in a separate profile, selects configured enabled chat models, probes completion/streaming/tool calls/embeddings, and compares ordinary Project/account/model/pool/asset-account identities around the run. Scan all retained test artifacts for plaintext source API keys.
- Paid asset generation is off by default. With explicit session authorization and `--paid-assets`, the script requires a sufficient verified Meshy balance and selects one five-credit geometry preview, download/hash/GLB checks, unreviewed import rejection, explicit review and exact-byte isolated import. No paid retry/refine loop or production art promotion is added.
- The first live stream assertion revealed a test assumption: source streaming metadata was unknown, so complete-response delivery was correctly selected. The corrected disposable probe explicitly enables streaming there; ordinary capabilities remain unchanged. The first paid preview result is retained separately and the corrected run performs no additional paid generation.
- Add the dated system review matrix and current status/index pointers, preserving historical release/workflow evidence and describing still-unimplemented Windows isolation, external IDE integration, release lifecycle and external verification debt. Correct the stale statement that 0.9.0 is the ordinary current version, qualify the earlier zero-high/critical audit as historical and report the current patched-package advisory count; repair snapshot spacing. No work package or user-owned decision is marked complete/confirmed.
- Investigation/testing/documentation tooling uses none impact. Product remains 0.14.0 pending release preparation; no installer, publication, profile migration or compatibility identifier change is produced.

##### Validation

- Larger desktop browser/Electron audits each passed 195 rendered checks with no findings or renderer exceptions. Corrected workspace navigation/theme/keyboard smoke passed. The full disposable workflow suite passed 30 checks and retained 45 captures.
- Fresh D-drive Unreal fixture compiled; 14 Unity/Unreal identity/access/version/automation checks passed. Real Blender export/render and Python-failure classification passed in the full native suite.
- Live OpenAI authentication/discovery, completion, streamed deltas, tool response and 1536-dimensional embedding passed. Live Meshy balance/generation/download/review/import passed with five observed credits consumed. Both provider runs retained ordinary identities and found zero plaintext API-key leaks.
- The final repository gate passed 33/33 with 542 platform tests/11 explicit skips and 124 extension tests, including three offline Knowledge notification regressions and the duplicate-generation regression. Twenty-five unchanged tasks use their verified cache results; actual browser/Electron builds passed. Final results and exact paths are recorded in `docs/ADVERSARIAL_SYSTEM_REVIEW.md`. Failures and narrower stress results remain preserved rather than silently discarded.
- Markdown links and permanent-record/changelog coverage passed. An earlier formatting check passed; the final combined formatting/version/documentation-reference check was declined through command approval and did not run. The repository excludes docs/scripts from Prettier, so those artifacts were directly reviewed rather than treating formatting success as their layout evidence.
- This does not certify all target architecture, Windows AppContainer, signed release/installer lifecycle, arbitrary external providers, assistive technology, production game/art or performance behavior. The review explicitly retains those gaps.

##### Files

- `scripts/adversarial-ui-audit.cjs`
- `scripts/adversarial-provider-acceptance.cjs`
- `scripts/workspace-overhaul-ui-smoke.cjs`
- `scripts/live-engine-acceptance.cjs`
- `docs/ADVERSARIAL_SYSTEM_REVIEW.md`
- `docs/STATUS.md`
- `docs/README.md`
- `docs/changes/2026-10-06-adversarial-system-audit.md`

#### Retain full task detail in the versioned changelog and agent workflow

**Impact:** none

[Permanent work record](docs/changes/2026-10-06-full-changelog-agent-contract.md).

##### Summary

Generate a complete central changelog from permanent task records and require future agents to document each meaningful outcome and its version impact in detail.

##### Details

- Previously the central changelog flattened each task's Summary into one paragraph and linked to its separate record for details. It now includes the full Summary, Details, Validation, and exact Files list under the task's version and category, retaining the source-record link. Multiline prose, lists, examples, and validation limitations remain available directly in CHANGELOG.md.
- Rebase local Markdown links from the task record directory to the central changelog location, including links to record-local anchors. Preserve external links and fenced code verbatim; nest embedded headings beneath the task sections.
- Strengthen AGENTS.md and the tracking contract so a summary paragraph cannot substitute for complete Details. Require concrete triggers and before/after behavior, rationale, all meaningful outcomes, explicit compatibility/migration/removal effects, version-impact rationale, actual commands/results, skipped checks, and evidence limits. Require review against the whole task diff; path coverage cannot establish prose accuracy or completeness.
- Expand the task template to prompt for these details and clarify the release guide's full-changelog requirement. Separate permanent task records and per-version release notes remain required. The central changelog can be read in full without following task links.
- Add a regression test that exercises multiline detail, nested headings, code fences, local and external links, validation, exact file lists, and complete entry retention when release preparation moves pending work into a numbered version. Existing coverage, record immutability, and version-impact checks remain in place.
- Compatibility and migration: no application, public API, persisted-data, schema, dependency, or package-version change. Historical task records and per-version release-note content remain preserved. Regenerate the central changelog from existing recorded evidence; do not fabricate missing historical detail.
- Impact rationale: none, because this is repository maintenance and generated documentation, with no shipped application behavior change. Keep the current version while this record is pending; a later release must assign pending records using release:version and satisfy the highest recorded impact.
- Preserve unrelated pending source/documentation/release work already present in the shared checkout. This record covers only the changelog generator, its regression coverage, and the documentation of this workflow.

##### Validation

- Full repository build/typecheck/lint/test gate passed: 33 of 33 tasks, all served from the existing Turborepo cache. Dependencies were already installed; npm ci was not rerun against the shared active checkout.
- npm run test:changes passed: 25 tests across two files, including complete central entry rendering and existing version/coverage/immutability gates.
- npm run format:check and an explicit Prettier check of the changed scripts, instructions, guide, template, and task record passed. The explicit check includes paths ignored by the repository-wide formatter.
- npm run changelog:update and npm run changelog:check -- --base HEAD passed; git diff --check passed. Source review confirmed all 78 saved task records render as 78 complete central entries across 17 release groups, including Unreleased. Existing generated per-version release-note content was unchanged by regeneration.
- node scripts/check-release-version.cjs passed for the unchanged 0.14.0 workspace/lockfile versions. The new maintenance record remains Unreleased; no pending work was assigned by this task.
- Invoked scripts/check-links.sh using Git Bash. The owned scan remained active for over twenty minutes without completing or reporting errors; stopped that verified process tree after substituting an equivalent in-process scan. The substitute applied the shell checker's file/anchor, fenced-code, heading-slug, and external-link rules across all 268 Markdown inputs and 1,322 relative links: zero errors. The original shell command did not complete; its pass is not claimed. No link-checker source was changed.
- No installer, release preparation, tag, publication, engine/provider integration, or production acceptance was performed for this maintenance task. Automated checks cannot prove the truth or completeness of natural-language records; agent/reviewer diff review remains required.

##### Files

- `AGENTS.md`
- `CHANGELOG.md`
- `docs/RELEASE_GUIDE.md`
- `docs/changes/README.md`
- `docs/changes/TEMPLATE.md`
- `docs/changes/2026-10-06-full-changelog-agent-contract.md`
- `scripts/change-tracking.cjs`
- `scripts/change-tracking.test.ts`

#### Verify and retain the PlayWeld 0.15.0 candidate

**Impact:** none

[Permanent work record](docs/changes/2026-10-06-local-0.15.0-deployment.md).

##### Summary

Prepare and verify a local PlayWeld 0.15.0 candidate, then preserve it when installed-runtime acceptance exposes an LPAC permissions defect. The corrected 0.16.0 release supersedes this candidate; 0.15.0 was not installed or published.

##### Details

- The user explicitly requested local deployment, commit/push and a release with proper notes. Preserve all existing version records and tags. The 0.15.0 candidate collects the current compatible editor/IDE/isolation/update features and review repairs without changing GameCrafter package, installation, profile or application identities.
- The prior public release is 0.10.2. This source also contains the later provider/embedding, checkpoint/continuation, MCP scope/race and first-party Unreal work recorded under the retained 0.11.0 through 0.14.0 notes. Those historical records remain intact; no historical tag or artifact is overwritten. The published body uses the full generated 0.15.0 notes and references the cumulative earlier records.
- Cumulative records included in this source are [0.11.0](https://github.com/scarecr0w12/PlayWeld/blob/v0.16.0/docs/releases/v0.11.0.md), [0.12.0](https://github.com/scarecr0w12/PlayWeld/blob/v0.16.0/docs/releases/v0.12.0.md), [0.13.0](https://github.com/scarecr0w12/PlayWeld/blob/v0.16.0/docs/releases/v0.13.0.md) and [0.14.0](https://github.com/scarecr0w12/PlayWeld/blob/v0.16.0/docs/releases/v0.14.0.md). These links identify records in the new tagged source; they do not claim that those intermediate versions were publicly released.
- Strengthen Windows package verification to require the native isolation helper, external IDE and handoff executables, and exact authored Unity/Unreal/Godot plugin source bytes. This prevents a new package from silently shipping only the old Unreal integration or omitting a new runtime entry point.
- Add a reusable Windows deployment acceptance script for authenticated preflight, nonterminal-task refusal, checkpointed shutdown, profile/Project snapshots, installed byte comparison and retained configuration/task identities. Preflight passed at this candidate stage; shutdown, backups and installation are performed only for the corrected 0.16.0 release.
- No publisher certificate or GitHub signing secret is configured. Release artifacts will be explicitly labeled unsigned/testing; checksums establish byte integrity, not publisher authentication. Signed metadata handoff remains distinct from this manually accepted local installer upgrade.

##### Validation

- Preflight: GitHub authentication is available; main and origin/main agree; existing ordinary service reports 0.14.0 with four registered Projects. The initial active-work query used an incorrect field and was replaced by a schema-based state query before any shutdown.
- The preflight script initially used the platform settings table name for Project settings and failed read-only inspection. It was corrected to the actual settings_overrides table; the rerun confirms four Projects, zero nonterminal tasks and captured configuration/task fingerprints. No service shutdown occurred during that failed inspection.
- Redacted source scan found no OpenAI/GitHub/AWS credential patterns in 165 changed/untracked source files. No credential contents are printed or included in the notes.
- Clean npm ci applied the pinned dependency patches. All 33 quality tasks passed uncached, with 557 platform tests/six skips and 128 extension tests. Tracking tests passed 25 checks; formatting, version/lockfile agreement, generated references, inventory/evidence, links and release-ledger checks passed. The registry still reports 19 advisories associated with the locally patched upstream dependencies.
- Built/staged the unsigned 0.15.0 NSIS candidate; SHA-256 is 5cfb42b27ddc9505eb6aa38458d5a232f0e5be2a1cbdfeee3b9e5f7b2c854016. Native/package source checks and packaged Node-mode LPAC passed. The staged desktop smoke passed 29 checks with zero renderer errors at .artifacts/documentation-electron/1791327068877.
- The Program Files runtime probe then failed with an unauthorized ACL operation, despite its existing ARAP read grant. Preserve Windows-Release/0.15.0 and the failed diagnosis; repair this in the separately recorded 0.16.0 source. No 0.15.0 ordinary installation, tag or public release occurred.

##### Files

- `apps/control-room/scripts/verify-windows-native.cjs`
- `scripts/local-deployment-acceptance.cjs`
- `docs/STATUS.md`
- `docs/RELEASE_GUIDE.md`
- `docs/changes/2026-10-06-local-0.15.0-deployment.md`

#### Prepare version 0.15.0

**Impact:** none

[Permanent work record](docs/changes/2026-10-06-release-0.15.0.md).

##### Summary

Prepare version 0.15.0 from 0.14.0, retaining all pending work records in the changelog and detailed release notes.

##### Details

Synchronize first-party workspace and internal dependency versions. The lockfile must be refreshed separately. No tag, publication, or build is performed by version preparation.

##### Validation

Clean npm ci, lockfile/version agreement, all 33 uncached quality tasks, 25 tracking checks, formatting, references/inventory/evidence, links and change coverage passed. Windows package/native/source and staged Electron checks passed. The later Program Files runtime probe exposed an unauthorized ACL operation, so the 0.15.0 candidate was preserved and superseded by the corrected 0.16.0 deployment. This candidate was not installed, tagged or published. See the candidate and runtime-permissions records for actual hashes, retained failures and scope.

##### Files

- `packages/archive-extractor/package.json`
- `packages/contracts/package.json`
- `packages/platform-service/package.json`
- `packages/plugin-sdk/package.json`
- `packages/service-client/package.json`
- `packages/theia-control-room/package.json`
- `packages/plugins/sample-hello/package.json`
- `apps/control-room/package.json`
- `apps/control-room-browser/package.json`
- `package-lock.json`

## 0.14.0

### Security

#### Bound vulnerable dependency inputs and apply compatible fixes

**Impact:** patch

[Permanent work record](docs/changes/2026-10-05-dependency-advisory-remediation.md).

##### Summary

Upgrade six transitive dependencies and persist narrow local fixes for two advisories without upstream patched releases, preserving the pinned Theia version and existing CommonJS contracts.

##### Details

- Exact overrides: DOMPurify3.4.16, http-cache-semantics4.3.0, source-map-js1.2.2, diff8.0.4, uuid11.1.1 and @tootallnate/once2.0.1. Security exceptions to the preferred seven-day age apply to http-cache-semantics (published October4) and source-map-js (September30); other selected releases exceed seven days. No Theia downgrade or blanket forced audit repair.
- Pin patch-package8.0.1 as a direct development dependency and apply version-specific patches during postinstall with error-on-fail. Brace parsing rejects nesting beyond 128; compile/expand/stringify AST walkers reject depth above128 before native stack exhaustion. Ordinary glob behavior remains intact; exceptionally deep expressions now fail with a controlled depth-limit error.
- Clamp sprintf numeric precision for e/f to 0..100 and g to 1..100. Preserve explicit zero precision and string truncation behavior; extreme numeric precision no longer throws native digit-range errors.
- Advisory sources: <https://github.com/advisories/GHSA-vfj7-8cjw-p6xm>, <https://github.com/advisories/GHSA-hp3w-g68c-fv3c>, <https://github.com/advisories/GHSA-ch52-4w7c-c8xp>, <https://github.com/advisories/GHSA-68fv-2mgg-jv7q>. This is scoped remediation, not a comprehensive security certification.
- Preparation 0.13.0 preceded these findings and was not packaged. The next prepared build includes that source plus this repair; historical preparation records remain intact.

##### Validation

- Two regressions first failed: unbounded brace nesting and native sprintf RangeError. Both passed after patches, including deep AST compile/expand/stringify, parentheses, normal glob expansion, zero/large numeric precision and string truncation.
- Clean npm ci applied both persisted patches successfully. npm update of only the six named packages refreshed stale locked transitive entries; npm ls confirmed every installed consumer uses the selected versions without invalid dependencies.
- Audit decreased from 66 (5low, 49moderate, 12high) to 19 (9moderate, 10high). All remaining entries derive from the two locally patched packages; the registry still flags their unchanged upstream version numbers. Do not report a clean registry audit. Before/after JSON retained in ignored local evidence.
- Final clean npm ci applied both patches. Full native repository quality gate passed 33/33, including540 passing platform tests/11 skips. Windows packaging/native checks and29 packaged Electron smoke checks passed with zero renderer errors. An initial content harness correctly rejected resolving development dependencies from inside the package: braces/sprintf-js are absent as standalone packaged modules, so its corrected report records that boundary rather than claiming packaged execution. Bundle creation occurred after the clean-install patch regressions passed. Ordinary installed 0.14.0 passed 29 desktop smoke checks with zero renderer errors and retained its native profile state after upgrade.

##### Files

- `package.json`
- `package-lock.json`
- `patches/braces+3.0.3.patch`
- `patches/sprintf-js+1.1.3.patch`
- `packages/platform-service/src/dependencies/advisory-regressions.test.ts`
- `docs/changes/2026-10-05-dependency-advisory-remediation.md`

### Maintenance

#### Prepare version 0.14.0

**Impact:** none

[Permanent work record](docs/changes/2026-10-05-release-0.14.0.md).

##### Summary

Prepare version 0.14.0 from 0.13.0, retaining all pending work records in the changelog and detailed release notes.

##### Details

Synchronize first-party workspace and internal dependency versions. This build supersedes the uncommitted, unpackaged0.13.0 preparation and includes its [first-party Unreal bridge](docs/changes/2026-10-05-first-party-unreal-bridge.md), checkpoint/continuation and MCP race/Project-scope repairs together with the [dependency advisory remediation](docs/changes/2026-10-05-dependency-advisory-remediation.md). Earlier preparation evidence remains intact. The lockfile must be refreshed separately. No tag, publication, or build is performed by version preparation.

##### Validation

- Clean npm ci applied both dependency patches. Release/lockfile agreement, generated changelog/file coverage and formatting passed. Full native Windows turbo gate passed 33/33 tasks (540 platform tests passed, 11 skipped). Tracking tests passed 24/24; generated references passed 198 requests/85 settings. Independent Node documentation verification passed 265 files/1208 links. The per-line shell checker was not repeated after its excessively slow earlier Windows run; the same fence/link/slug rules were checked independently.
- Native 0.14.0 retention/semantic search, managed first-party plugin operations, denied foreign-Project/Restricted calls and actual editor restart recovery passed. A plaintext scan of 1771 source/evidence/metadata/log files found no matching pairing credential. The owned editor and isolated RPG service were stopped afterward. RPG/Studio production remains paused.
- Built and staged the unsigned Windows installer at Windows-Release/0.14.0. SHA-256:0f223f03bee0b80e4f3003618cce5d6091ae951c08dbba7959b6bcf2734a47c1. Native package checks passed; packaged and installed Electron smokes each passed 29 checks with zero renderer errors. All 25 selected installed runtime/plugin files matched the stage, including the six owned plugin files. Actual retained RPG-profile semantic search and managed pairing also passed through the bundled service.
- Before ordinary 0.10.2 upgrade, confirmed no active tasks, captured native configuration/task identities, checkpointed the service and copied its profile to a fresh ignored backup. The elevated Windows installer completed. Installed 0.14.0 retained all four ordinary Projects/accounts/models/settings/pools/task IDs. A direct launch initially failed on an unquoted Program Files argument; corrected the test command before successful startup/retention verification.
- Rediscovered the existing ordinary OpenAI account: two accessible embedding models. text-embedding-3-small returned a real 1536-dimension vector and was selected in actual installed Knowledge UI without saving Project settings. The focused UI harness retained failed diagnostics, then waited for Theia startup and Project options before selecting. Its final screenshot was independently inspected.
- No tag/publication, signing, installer rollback or exhaustive live-feature acceptance is claimed. Registry audit still lists 19 entries derived from the two locally patched upstream versions; see the scoped dependency record. Ordinary service remains available, and unrelated processes/installations were preserved.

##### Files

- `packages/archive-extractor/package.json`
- `packages/contracts/package.json`
- `packages/platform-service/package.json`
- `packages/plugin-sdk/package.json`
- `packages/service-client/package.json`
- `packages/theia-control-room/package.json`
- `packages/plugins/sample-hello/package.json`
- `apps/control-room/package.json`
- `apps/control-room-browser/package.json`
- `package-lock.json`

## 0.13.0

### Added

#### Bounded task continuation at agent turn limits

**Impact:** minor

[Permanent work record](docs/changes/2026-10-05-bounded-task-continuation.md).

##### Summary

Replace abrupt task failure at a model-turn boundary with checkpoint retention and an explicit task question offering another bounded allowance or stopping.

##### Details

- Warn near the configured turn allowance and encourage bounded completion with truthful evidence. At the boundary, retain the checkpoint and use the existing Waiting input/question workflow.
- Only an exact Continue answer extends the allowance by the configured role/default turn count. Other answers stop with AgentTurnLimit and retained work. Cumulative cost/token budgets are checked before the question; existing time limits, access policy, selected model and completion contract remain authoritative.
- Persist approved allowances and consumed question references across service restart. This does not auto-approve continuation, raise global role limits or mark incomplete work succeeded. Existing failed task records remain historical.
- Compatible behavior addition without public RPC/storage migration. Packaging and installed deployment remain pending.

##### Validation

- Continuation test first reproduced AgentTurnLimit failure; then passed after the change. Tests also cover retained continuation and cumulative budget exhaustion across restart.
- Full repository gate passed 33/33 tasks, including 532 passing platform tests and 11 skips. Format check passed.
- Real Luna task `01a10eb3-e2c2-7e99-a65d-d9bb7e864f58` used a disposable one-turn role, retained its marker, received two exact Continue answers through native task questions and succeeded at turn3. No game, desktop browser, paid asset or provider configuration changes were made by that task.

##### Files

- `packages/platform-service/src/agents/agent-runtime.ts`
- `packages/platform-service/src/agents/agent-runtime.test.ts`
- `docs/USER_GUIDE.md`
- `docs/changes/2026-10-05-bounded-task-continuation.md`

#### Replace the vendor editor path with a PlayWeld-owned plugin

**Impact:** minor

[Permanent work record](docs/changes/2026-10-05-first-party-unreal-bridge.md).

##### Summary

First-party Unreal editor bridge following the user's explicit instruction not to depend on a third-party in-editor plugin.

##### Details

- Stopped the owned CodeFizz acceptance editor, disconnected and disabled the test Project's vendor MCP connection, removed its enabled Project reference and quarantined the newly installed vendor plugin outside the active Plugins directory. Unrelated installations and the FourSquare Project were preserved. No vendor bridge acceptance or production dependency is claimed.
- Added opt-in editor-only PlayWeld C++ module source and build descriptor. The owned module implements MCP identity/read-only inspection over engine-native HTTP with loopback binding, bearer authentication and Windows DPAPI ciphertext credential loading. No model or AI provider runs inside the editor.
- Added five editor tools: identity, bounded inspection, owned-actor spawn/transform/delete, active-viewport PNG capture and console execution. Scene edits use editor transactions and do not save the campaign map. Console remains classified destructive and Restricted-mode invocation is denied by the platform broker.
- Added service-managed source installation and protected pairing tools. Installation preflights source hashes and preserves modified local code, backs up the Project descriptor, enables the plugin only for editor targets and retains existing plugin choices. Pairing validates the exact Project file and loopback endpoint, stores bearer credentials through encrypted MCP storage and binds the existing engine bridge. Build assets now include the first-party plugin source. Native managed install, pairing and editor restart recovery passed. Packaging and broader authoring acceptance remain separate checks.
- No existing GameCrafter compatibility identifiers, provider choices or saved game data were renamed. New plugin source is Apache-2.0 under the repository license.

##### Validation

- Native PlayWeld broker rollback completed and confirmed the owned vendor plugin is absent from the active Project Plugins directory. MCP connection disabled. Exact local evidence is retained under the ignored RPG acceptance artifacts and the external Project's Tools/Evidence/DisabledVendorPlugins directory.
- Initial first-party source was checked against installed Unreal 5.8.3 HTTPServer interfaces. The first native compile failed on the request-handler delegate binding; corrected it to the engine's typed delegate and switched the Windows cryptography dependency to the system-library declaration. Second native build `01a10ec0-a04e-756c-ae23-de5ec7ec06f7` compiled and linked the owned plugin successfully. Retained the failed build. Later live verification is recorded below.
- Expanded editor operations compiled successfully in native build `01a10ecc-0d23-721c-8e97-e9df350f14c8`, after retaining/correcting a failed world-destruction/output-device API compile. Live authenticated MCP identity and inspection passed; missing/invalid auth returned401 and browser origin returned403. After separate MCP race/scope repairs, native engine operations passed spawn, transform readback, screenshot, console and owned cleanup. Exact engine runs: `01a10ed2-2aba-71a5-ab9c-c7c090c77385`, `01a10ed2-548a-7e33-8d28-ee89b06f0f85`, `01a10ed2-7e95-7cdd-b712-ca8b8c5f2275`, `01a10ed2-7f1e-7589-9e1d-2452d6e70bad`. Independent inspection confirmed the actual editor viewport PNG. Foreign Project and Restricted console calls were rejected with ToolDenied.
- Four managed-tool tests passed: preservation/idempotent protected credential installation, local edits, traversal/foreign/remote identities and encrypted MCP pairing output. Platform build/typecheck/lint passed. Live managed-tool results are recorded below; final gate results are recorded below.
- Native managed install `01a10ee0-9131-7aff-9b1c-65f8d1e180b7` and connect `01a10ee0-9152-72ab-982f-30864a5319ac` passed against the actual Project/editor. The service independently proved the editor's exact Project file before binding; capabilities then reported the live layer ready. Matching credentials stayed encrypted in MCP storage and DPAPI ciphertext on disk. Fresh 0.14.0 service recheck passed install/pairing, all five editor operations and actual rejection of foreign-Project and Restricted console calls. Stopping the owned editor made stale pairing fail; restarting it recovered live readiness with its new PID/endpoint. A plaintext scan of 1771 source/evidence/metadata/log files found zero matches for the actual protected credential. Final 0.14.0 gate passed 33/33 (540 platform tests/11 skips). Packaged source matched all six plugin/license files; managed installation/pairing also passed through the bundled 0.14.0 service against the actual editor. The packaged desktop smoke passed 29 checks without renderer errors. Ordinary 0.14.0 installation matched25 repaired runtime/plugin files, including all six owned plugin files, and passed 29 installed desktop checks. Live Unreal operations were exercised in the isolated RPG acceptance profile rather than modifying ordinary game Projects. The owned acceptance editor was stopped afterward; RPG/art production remains paused.

##### Files

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

### Fixed

#### Isolate headless Blender asset imports and create export directories

**Impact:** patch

[Permanent work record](docs/changes/2026-10-05-blender-isolated-import-export.md).

##### Summary

Fix imported and converted assets containing Blender's default cube, camera and light, and failures exporting to a new nested Project directory.

##### Details

- Start the separate headless import and conversion processes with an empty factory scene before loading the asset. Preserve loaded source scenes and live user sessions.
- Create output parent directories only after the existing Project output-path guard resolves the destination. Preserve path restrictions and existing export behavior.
- Add an installed-Blender regression that exports to a new nested directory, imports exactly one mesh without cameras or lights, and converts it without adding another mesh.
- Compatibility: no contract, dependency, persisted-state or migration changes.

##### Validation

- Reproduced the defect against installed Blender 5.2.2: importing the single-mesh fixture reported two meshes. The regression failed before the fix and passed afterward.
- DCC test suite passed 11/11 across five files, including the real Blender connector tests. Platform service build passed.
- The RPG's original native export failure remains recorded. Restarted the owned source service with the rebuilt adapter; all eight native operations passed: discover, import, inspect, validate, export to a new directory, conversion, rendered preview and settlement-source validation. These are actual Blender 5.2.2 connector results, distinct from packaged-app acceptance.
- Full repository gate initially hit an Electron `conpty.node` EBUSY while the owned source desktop was open. Closed only that test desktop through its CDP endpoint and reran successfully: 33/33 Turbo tasks, 519 platform tests passed with 11 skips. Final format/change-tracking refresh is pending.
- The latest full gate after the additional completion/question fixes passed 33/33 tasks, with 527 platform tests passed and 11 skips. Formatting, change tracking and the required documentation link script passed. Reopened and verified the actual source-built Electron desktop with Ashen Covenant explicitly selected in Knowledge.

##### Files

- `packages/platform-service/src/dcc/adapters/blender.ts`
- `packages/platform-service/src/dcc/scripts/blender.ts`
- `packages/platform-service/src/dcc/blender-real.test.ts`
- `docs/changes/2026-10-05-blender-isolated-import-export.md`

#### Recover interrupted agent tool-result histories

**Impact:** patch

[Permanent work record](docs/changes/2026-10-05-checkpoint-tool-result-recovery.md).

##### Summary

Repair restored agent checkpoints that contain assistant tool calls without all corresponding outputs, avoiding provider missing-tool-output failures and repeated consumption of older question answers.

##### Details

- Recover pending task questions before the next provider request. Supply explicit interrupted-result records for other uncertain calls instead of replaying filesystem, engine, process or paid mutations whose completion is unknown. Models must inspect durable evidence before retrying.
- Preserve completed outputs. Persist recovered outputs and durable consumed-answer references. Restore the worker answer cursor across checkpoint compaction, with a legacy transcript fallback and migration of retained old question outputs.
- No provider/model changes, new public RPC, credential changes or database migration. Existing generic non-agent checkpoints retain answer cursor zero.
- Work is in progress; source tests passed, live restart/provider and packaged deployment checks remain pending.

##### Validation

- Agent regression first failed because the pending question was never recovered. After repair, focused agent/checkpoint suites passed; a real forked worker test also passed, verifying a compacted checkpoint consumes the next persisted answer rather than repeating the old one.
- Platform build and typecheck passed. Full repository gate passed 33/33 tasks (532 platform tests passed, 11 skipped), including the real forked-worker answer-cursor regression. Format check passed.
- Source-built service restart retained five Projects, the Luna-only authoring pool, 120quests/144NPC data and actual1536-dimensional semantic search. Live interrupted-provider-history and packaged deployment acceptance remain pending.

##### Files

- `packages/platform-service/src/agents/agent-runtime.ts`
- `packages/platform-service/src/agents/agent-runtime.test.ts`
- `packages/platform-service/src/workers/checkpoint-answers.ts`
- `packages/platform-service/src/workers/checkpoint-answers.test.ts`
- `packages/platform-service/src/workers/worker-main.ts`
- `packages/platform-service/src/workers/supervisor.test.ts`
- `docs/changes/2026-10-05-checkpoint-tool-result-recovery.md`

#### Completion validator engine and DCC input envelopes

**Impact:** patch

[Permanent work record](docs/changes/2026-10-05-completion-validator-input-envelope.md).

##### Summary

Automatic completion validators now pass operation parameters through the registered engine and DCC tool envelopes. A declared Unreal test filter previously failed schema validation even when the same explicit engine test succeeded.

##### Details

- Live realistic-character authoring recorded a successful native `engine/test` with input `params.filter`, followed by a failed automatic validator using top-level `filter` (`-32032`). Its task correctly remained failed (`-32125`); passing individual engine checks did not satisfy the broken automatic check.
- Automatically selected engine validators wrap operation fields in `params`, retaining an optional top-level run identifier. DCC validators retain the DCC tool selector and wrap their operation fields. Existing wrapped broker inputs and explicit tool identifiers retain their original input contract. No schema, persisted record, permission ceiling or required evidence claim was removed or relaxed.
- Added regression cases that exercise the actual registered engine/DCC schemas and handlers for both operation parameters and existing envelopes. Fixture handler success is schema/dispatch evidence, not a live engine run.
- No data migration is required. Historical failed tasks remain failed; this change does not rewrite their results or certify visual art.

##### Validation

- Before the fix, the two operation-parameter cases failed with completion-contract rejection and the existing envelope cases passed. After the fix, focused integration-service and DCC-tool tests passed 11/11.
- Broader integration/worker/task/DCC regression run passed 38 tests across five files; platform-service build passed. The full repository build/typecheck/lint/test gate passed 33/33 tasks, including 527 platform tests with 11 explicitly skipped.
- Restarted the owned isolated source runtime. The fresh native Luna visual-repair task ran both the explicit engine check and the automatic bare-filter validator successfully; automatic run `01a10db1-d579-7482-a64c-fa0edabecc9a` is actual live envelope evidence. The task nevertheless failed because its engine-validation claim reference contained explanatory prose rather than the exact successful run identifier required by the existing backing check. That rejection is valid and distinct from the repaired envelope defect; no backing check was relaxed and no historical failed task was rewritten.
- Formatting, change tracking and the required documentation link script passed after the source fixes. A subsequent narrow game-camera task is instructed to use exact run identifiers and remains in progress.

##### Files

- `packages/platform-service/src/change/integration-service.ts`
- `packages/platform-service/src/change/integration-service.test.ts`
- `docs/changes/2026-10-05-completion-validator-input-envelope.md`

#### Coalesce simultaneous MCP connection attempts

**Impact:** patch

[Permanent work record](docs/changes/2026-10-05-mcp-concurrent-connect.md).

##### Summary

Fix simultaneous automatic/manual MCP connection attempts replacing each other's session and failing with MCP connection is not connected during catalog refresh.

##### Details

- Found while connecting the new first-party Unreal plugin. Reproduced deterministically with four concurrent connects to a real fixture process.
- Share one per-connection in-flight promise through initialization and catalog refresh. Disconnect/update/removal wait for that bounded attempt; internal session cleanup avoids waiting on its own connection promise. Service stop drains pending connections before closing sessions, and new connects are rejected after stop.
- No transport protocol, credential format, RPC/storage or provider changes. Existing timeouts remain authoritative. Live repaired plugin connect/update and editor restart recovery passed.

##### Validation

- Regression first failed with MCP connection is not connected. After coalescing, all callers reached a catalogued connected session; corrected the event assertion to count the manager and session's two normal connecting notifications.
- Focused manager/Docker tests passed 9/9 and typecheck passed. A subsequent full repository gate passed 33/33 tasks (534 platform tests passed, 11 skipped), before the later managed-plugin addition. Actual first-party editor connection/update/restart passed after the fix. Final 0.14.0 gate passed 33/33 (540 platform tests/11 skips); packaged and installed desktop smokes each passed 29 checks.

##### Files

- `packages/platform-service/src/mcp/connection-manager.ts`
- `packages/platform-service/src/mcp/connection-manager.test.ts`
- `docs/changes/2026-10-05-mcp-concurrent-connect.md`

#### Enforce Project scope before invoking MCP tools

**Impact:** patch

[Permanent work record](docs/changes/2026-10-05-mcp-project-invocation-scope.md).

##### Summary

Reject a Project-scoped MCP tool call made with another Project's context before reaching the external server.

##### Details

- Found in the live first-party Unreal bridge negative test: a foreign Project could invoke the other Project's read-only identity tool. Configuration scoping and engine binding validation alone did not enforce the globally registered tool handler's caller scope.
- Enforce matching Project identity at the adapter before invocation. Platform-scoped connections retain their cross-Project behavior. No RPC/storage migration, credential changes or permission weakening.
- Affects read and mutation tools alike; the observed live reproduction was read-only identity, not unauthorized scene mutation. Preserve that evidence boundary.

##### Validation

- Regression first resolved private fixture content for a foreign Project instead of rejecting. It now checks rejection before the invoker is called and successful invocation for the owning Project.
- Focused adapter/manager suites passed 11/11. The actual foreign-Project identity call was rejected with ToolDenied before editor invocation; Restricted console was also denied. A subsequent full repository gate passed 33/33 tasks (534 platform tests passed, 11 skipped), before the later managed-plugin addition. Final 0.14.0 gate passed 33/33 (540 platform tests/11 skips); packaged and installed desktop smokes each passed 29 checks.

##### Files

- `packages/platform-service/src/mcp/mcp-tool-adapter.ts`
- `packages/platform-service/src/mcp/mcp-tool-adapter.test.ts`
- `docs/changes/2026-10-05-mcp-project-invocation-scope.md`

#### OpenAI Responses fallback for tool-capable reasoning models

**Impact:** patch

[Permanent work record](docs/changes/2026-10-05-openai-responses-tool-fallback.md).

##### Summary

Fix a live Swarm blocker where OpenAI rejects function tools on Chat Completions and the selected model also rejects the previous `reasoning_effort: none` fallback.

##### Details

- Negotiate Responses only for the first-party OpenAI adapter at the exact official endpoint after a structured HTTP 400 explicitly identifies the function-tool reasoning conflict. Preserve existing Chat Completions behavior for compatible/custom/Azure/other providers and unrelated errors. Keep the selected model and account unchanged.
- Map function definitions, messages, tool calls/results, output limits, structured output, token usage and streaming text. Use `store: false` and bounded account/model-scoped encrypted reasoning replay for subsequent tool turns. Restored Chat histories without provider item IDs use reconstructed function-call inputs; restart/checkpoint replay is not yet live-verified.
- Cache the negotiated route after success. Preserve cancellation and provider credential redaction. No contract/storage migration or dependency additions.
- Live cache-independent continuation passed: a real function call executed the Project filesystem broker, then a reconstructed call ID and its tool output resumed successfully without provider item IDs. This does not verify every paused-agent question/checkpoint history; a later cross-model paused-question continuation failed with a missing-tool-output error and remains an investigation boundary.
- Official references consulted: https://developers.openai.com/api/docs/guides/function-calling and https://developers.openai.com/api/docs/guides/migrate-to-responses .

##### Validation

- Regression first failed on the existing adapter with the reproduced structured 400, then passed with Responses and subsequent tool-result/reasoning replay. Expanded provider suite passed 23/23, including streaming and no retry for HTTP 401/403/429/500.
- Source service rebuilt and restarted using only the isolated RPG acceptance profile. Both real Swarm retries now perform model completion and broker file writes. This is source-built service evidence, not newly packaged installer acceptance.
- Full repository gate initially completed 32/33 tasks with an A2A setup-hook timeout and Windows cleanup EPERM; focused A2A rerun passed 11/11. A second full `npx turbo run build typecheck lint test` passed. Format and changelog checks passed. New packaging, restart/checkpoint reasoning replay and exhaustive API validation remain pending.

##### Files

- `packages/platform-service/src/models/providers/openai-compatible.ts`
- `packages/platform-service/src/models/providers/openai-providers.ts`
- `packages/platform-service/src/models/providers/openai-responses.ts`
- `packages/platform-service/src/models/providers/providers.test.ts`
- `docs/changes/2026-10-05-openai-responses-tool-fallback.md`

#### Preserve worker question identifiers during persistence

**Impact:** patch

[Permanent work record](docs/changes/2026-10-05-worker-question-id-handoff.md).

##### Summary

Answers to a live worker question now reach the original waiting worker. The supervisor previously persisted a different question identifier, causing answer acknowledgement to time out and the worker to restart unnecessarily.

##### Details

- The worker creates an identifier for its pending answer promise. The supervisor now passes that identifier through the task graph and store rather than discarding it and generating another identifier. Other question creation continues to generate identifiers by default; public schemas and existing records remain compatible, with no migration.
- Added a real subprocess regression through the supervisor, task service, persisted question and answer API. It checks that the answer is delivered and the original worker completes, with exactly one process start.
- A live narrative continuation previously failed with missing tool output after a forced restart. This change fixes the unnecessary restart for an answer while the original worker is alive. It does not claim to repair all paused-agent checkpoint recovery after service restart, nor rewrite historical failures.

##### Validation

- Before the fix, the subprocess test delivered the eventual answer only after starting two workers and failed the one-worker assertion. After the identifier fix, it passed with one worker and the expected answer.
- Broader integration/worker/task/DCC regression run passed 38 tests across five files; platform-service build passed. The full repository build/typecheck/lint/test gate passed 33/33 tasks, including 527 platform tests with 11 explicitly skipped.
- Restarted the owned isolated source runtime and verified native `noop.ask` answer continuation succeeded. A fresh actual Luna `agent.run` persisted a question, received the coordinator's acceptance-fixture answer, wrote the expected native Project JSON and completed successfully (`01a10da5-40d2-7750-b3db-4ca6d832437e`). This is live question/tool continuation, distinct from recovery of an already stopped worker.
- Formatting, change tracking and the required documentation link script passed. The source-built Electron desktop was reopened and verified against the restarted owned service. Ordinary installed-app upgrade remains unverified.

##### Files

- `packages/platform-service/src/tasks/task-store.ts`
- `packages/platform-service/src/tasks/task-graph.ts`
- `packages/platform-service/src/workers/supervisor.ts`
- `packages/platform-service/src/workers/supervisor.test.ts`
- `docs/changes/2026-10-05-worker-question-id-handoff.md`

### Maintenance

#### Recheck embeddings after the OpenAI access change

**Impact:** none

[Permanent work record](docs/changes/2026-10-05-embedding-access-enabled-recheck.md).

##### Summary

The existing saved OpenAI key now returns real embedding vectors, but identical requests intermittently retain the previous project/model access rejection. Real ingestion succeeded in the packaged runtime; semantic acceptance is not yet complete.

##### Details

- Fresh direct requests returned HTTP 200 for both `text-embedding-3-small` (1, 536 dimensions) and `text-embedding-3-large` (3, 072 dimensions). No local account or credential was changed by this recheck.
- The provider model list expanded from the previous 19-model response to 139 models and now includes the two current embedding models and `text-embedding-ada-002`.
- The fresh packaged 0.12.0 acceptance Project imported an embedding model, verified its dimensions and indexed real SQLite vectors. Its first semantic search then received HTTP 403 `model_not_found` and correctly reported a lexical fallback, so the test failed instead of claiming a semantic pass.
- Differential direct and actual adapter requests also alternate between success and HTTP 403 with the same key and no custom account headers. A controlled eight-request sample with identical semantic-query input returned three successes and five denials. Access-change propagation is a hypothesis, not a confirmed provider diagnosis.
- No runtime request retries, fake vectors, forced profile configuration, installer or provider-permission mutations were added.

##### Validation

- Initial and subsequent minimal two-model probes returned real vectors for both models.
- `.artifacts/knowledge-live-2026-10-05/embedding-enabled-live-run/report.json`: 23 checks passed, zero marked blockers, one failed semantic acceptance assertion due to an actual provider rejection. The runner stopped its owned service. This is a failed acceptance run, despite successful profile creation and vector ingestion.
- `.artifacts/knowledge-live-2026-10-05/embedding-differential-1791217839726/report.json`: successful model listing, mixed direct embedding results, and successful actual provider adapter calls in both ordinary and retained test profiles.
- `.artifacts/knowledge-live-2026-10-05/embedding-stability-1791217876990.json`: 3 of 8 requests returned vectors; 5 of 8 returned HTTP 403 `model_not_found`. Key values are excluded from all output and retained reports.
- A second sample after a bounded wait, `.artifacts/knowledge-live-2026-10-05/embedding-stability-1791217972127.json`, still alternated between success and denial: 4 of 8 returned vectors and 4 returned HTTP 403. Provider access is not yet stable. Work-record coverage, Git whitespace and native equivalent link checks passed (250 Markdown files, 1, 173 relative links); the previously stopped slow Git Bash scan was not repeated.
- Full semantic/hybrid, vector-backend switching and vector retention acceptance remain unverified until provider responses are stable.

##### Files

- `docs/changes/2026-10-05-embedding-access-enabled-recheck.md`

#### Isolate the remaining OpenAI embedding access failure

**Impact:** none

[Permanent work record](docs/changes/2026-10-05-embedding-project-access-investigation.md).

##### Summary

Compare minimal direct OpenAI requests with PlayWeld's provider adapter and both ordinary/test profiles. OpenAI explicitly rejects the stored key's project access to both embedding models; endpoint construction, optional account headers and stale test credentials do not explain this remaining failure.

##### Details

- Investigate three falsifiable causes: project/model restrictions, incorrect project/organization headers, and provider request formatting.
- Read encrypted credentials in memory through the existing CredentialStore and ModelRegistry seams. Both profiles contain the same project-scoped key, use `https://api.openai.com/v1`, and configure no account headers. No account, credential or provider setting is changed.
- Minimal and configured `GET /v1/models` requests both return HTTP 200 and 19 models, with no embedding IDs. Minimal and configured `POST /v1/embeddings` requests both return HTTP 403 `model_not_found` for `text-embedding-3-small` and `text-embedding-3-large`.
- Capture the provider's precise message with project identifiers redacted: the project does not have access to the requested model. Actual OpenAI adapter calls from both profiles return the same response. Discovery preview exposes the two catalog candidates without persisting changes; catalog availability is distinct from successful provider access.
- OpenAI documents separate API-key endpoint permissions and project model usage permissions. Check the project owning the saved key, its Limits / Model Usage settings, and its API Keys endpoint permissions; enabling another project's models cannot change this key's scope ([project management guide](https://help.openai.com/en/articles/9186755-managing-projects-in-the-api-platform)). No admin credential is requested or used, and no external permission changes are performed by this investigation.
- Existing discovery and packaged validation remain unchanged. The external embedding access blocker is unresolved until the provider accepts a request; no synthetic vectors or forced embedding profile are used.

##### Validation

- Fresh minimal probe reproduced the HTTP 403 responses before hypothesis testing.
- Differential live diagnostic at `.artifacts/knowledge-live-2026-10-05/embedding-differential-1791217124589/report.json` records endpoint/header/key-kind and same-credential comparisons, two successful model lists, four denied direct embeddings and two denied real adapter calls. API keys and project identifiers are excluded from reports.
- Diagnostic scripts and reports are ignored local artifacts, not shipped runtime features. Runtime code was not changed in this investigation; the preceding 0.12.0 full quality gate and packaged acceptance remain the applicable runtime evidence.
- Provider access remediation awaits the user's confirmation that model access is enabled in the project owning the currently saved key.
- Work-record/changelog coverage and Git whitespace checks passed. The native equivalent link scan passed 249 Markdown files and 1, 172 relative links; the original Git Bash scan was previously stopped for excessive runtime and was not repeated for this investigation.

##### Files

- `docs/changes/2026-10-05-embedding-project-access-investigation.md`

#### Prepare version 0.13.0

**Impact:** none

[Permanent work record](docs/changes/2026-10-05-release-0.13.0.md).

##### Summary

Prepare version 0.13.0 from 0.12.0, retaining all pending work records in the changelog and detailed release notes.

##### Details

Synchronize first-party workspace and internal dependency versions. The lockfile must be refreshed separately. No tag, publication, or build is performed by version preparation.

##### Validation

Work-record freshness, local file coverage, version progression, and recorded impact checked before preparation. Dependency installation, refreshed lockfile verification, quality checks, packaging, signing, and live acceptance are not yet verified by this preparation record; retain their actual evidence in a follow-up work record.

##### Files

- `packages/archive-extractor/package.json`
- `packages/contracts/package.json`
- `packages/platform-service/package.json`
- `packages/plugin-sdk/package.json`
- `packages/service-client/package.json`
- `packages/theia-control-room/package.json`
- `packages/plugins/sample-hello/package.json`
- `apps/control-room/package.json`
- `apps/control-room-browser/package.json`
- `package-lock.json`

#### Ashen Covenant live PlayWeld acceptance investigation

**Impact:** none

[Permanent work record](docs/changes/2026-10-05-rpg-live-acceptance.md).

##### Summary

In-progress live acceptance Project for an original Unreal RPG, authored through PlayWeld rather than direct external authoring. The requested full game and exhaustive feature acceptance remain incomplete.

##### Details

- Created the trusted Ashen Covenant Unreal Project at `E:\GameCrafter-Dev\AshenCovenant` in the isolated staged 0.12.0 test profile using authenticated service RPC. Registered installed Unreal 5.8.3 editor/commandlet/UAT and Blender 5.2.2, enabled specialist skills, created a Project model pool using the inherited GPT-6 Astra selection, and authored the acceptance brief via the filesystem tool broker and a draft Knowledge record.
- Created a native discussion thread and two actual Swarm tasks for narrative and engine authoring. Both failed before producing the game: the restricted narrative role denied paid model completion; the engine role reached OpenAI but its Chat Completions reasoning fallback was rejected by the selected model. Neither run is game implementation evidence.
- Allowed only `model/complete` for restricted roles in this Project, consistent with the requested authoring. Preserved ordinary-profile permissions and model selection.
- Configured the existing Tripo credential through the encrypted PlayWeld asset account service without printing it. After explicit six-asset approval and broader Meshy/Tripo authorization, generated, visually reviewed and imported six models via native asset jobs. Actual charge 30 credits each, 180 total; balance 2, 785 to 2, 605. Provenance and downloaded model/preview hashes retained. Used PlayWeld DCC execution to produce editable normalized Blender sources, packed PBR images, and FBX exports. Exact triangulated counts exceed the requested face count on several assets; final game topology/LOD acceptance remains pending.
- Produced a 17-piece editable settlement kit, individual FBX/GLB exports, manifest and rendered preview through PlayWeld's Blender DCC connector. These are prototype art assets, not yet final engine visual acceptance.
- Live knowledge cycle passed twelve checks: native records, status filtering, graph/inbound references, editing/stale text removal, broker-file incremental ingestion, board editing, actual semantic/hybrid embeddings and citations on SQLite/LanceDB/managed local Qdrant, context budget and explicit deprecated-status filtering. Retained a failed initial harness assertion that incorrectly assumed default deprecated exclusion, then corrected it to the actual explicit-filter contract.
- Actual source-built Electron desktop connected and explicitly selected Ashen Covenant in Knowledge. Fifty-two authenticated live RPC/read/chat checks completed; these read surfaces do not prove complete behavior. Registered a dependent native Swarm art integration/final validation task. Engine authoring compiled the C++ editor and saved nine actual maps; campaign and final game acceptance remain in progress.
- A large narrative completion hit the broker's five-minute limit; restarted authoring in bounded per-region persistent batches, retaining the failed task. Configured existing Meshy credentials in the isolated profile, authenticated the provider, independently verified 2, 727 credits without exposing credentials, and submitted one native courier preview job, estimated 20 credits plus an approved 10-credit texture refinement. Meshy skill CLI guidance is superseded by the user's explicit requirement to use PlayWeld's built-in asset system.
- Ignored orchestration and redacted evidence are under `.artifacts/rpg-deep-dive-2026-10-05`. External CLI dry-run is diagnostic evidence only, not a PlayWeld asset generation pass. No public publishing or protected installed-app upgrade was performed.
- Completed Meshy preview/refinement, visually reviewed the courier, imported its GLB through native asset review/import, and produced an editable normalized Blender master and FBX through DCC execution. Actual cost 30 credits (20 preview plus 10 refinement). No rigging or animation claim yet.
- Regional narrative files contain 144 NPCs and 120 quests (24 main, 70 side, 14 faction and 12 companion), with a complete campaign bible and three-act narrative. Final runtime arrays and full gameplay acceptance are delegated to bounded mechanical assembly and integration tasks. The original engine task reached its 70-turn limit after compiling, creating nine maps and producing an initial Windows package; incomplete-data automation failures remain recorded.
- User subsequently prohibited Astra and authorized only DeepSeek or Luna. Disabled Astra in the isolated profile and changed the Project authoring pool to `gpt-6-luna`. The paused narrative continuation failed with a provider missing-tool-output error; preserved its saved work and created fresh Luna assembly/integration tasks instead of repeating its content.
- User clarified that Studio credits should be used by manually controlling the desktop browser. Successfully opened the existing authenticated Chrome Tripo Studio session through PlayWeld filesystem/process tools and Windows UI Automation. UI showed 25, 200 Studio credits. Submitted one original archivist Smart Mesh candidate through the actual Studio controls using the displayed trial; generation completion, download, texture/rig and engine acceptance remain pending. This is a broker-run browser acceptance harness, not a dedicated shipping PlayWeld Studio integration.
- Studio candidate geometry and texture completed and were visually reviewed. UI displayed 6, 280 quad faces and 5, 551 vertices. Downloaded FBX/base-color texture ZIP through Chrome, imported through a broker-run archive extraction script with path containment checks, and retained originals and SHA-256 provenance under `Art/Studio/SeritVale`. Texture charged 30 Studio credits, then UE5 Mannequin auto-rig charged 20; observed balance 25, 150. The rig completed and the walk preset visibly played in Studio; exported skeleton/clip and Unreal deformation checks remain pending.
- Final NPC/quest arrays now exist and the native Luna assembly task succeeded with seventeen static checks, including 120 reachable quest chains, references, counts and three endings. Native art/runtime integration is still running. Its source/asset validation must not be inferred from static campaign checks.
- A native local encrypted backup/restore cycle passed nine checks, including verification/drill, wrong-secret rejection, campaign/SQLite archive entries, an independently registered restored Project, retained chat/board and 120 restored quests. The retained clone is `E:\GameCrafter-Dev\AshenCovenant-Restore-Probe`; this is an in-progress snapshot with an ephemeral acceptance-only unlock secret, not a user recovery-key handoff. An initial harness prematurely treated the intermediate run state as terminal; retained that report and corrected polling. The original native backup itself later verified successfully.
- The Studio UE5 skeleton/walk export was downloaded separately and inspected with a native Blender DCC script: one armature, one mesh, 10, 997 triangles/5, 551 vertices, zero unweighted vertices, maximum four influences, one 1–57-frame action at 24 FPS, and distinct sampled bone poses. Packed a resized 2K texture into an editable master while retaining the original source and 8K texture. This verifies source structure/motion, not Unreal deformation or loop contacts.
- User then authorized heavy Studio use and explicitly rejected cartoon style in favor of higher realism/fidelity. Updated the native RPG brief, an art-direction record and board decision. Prior cartoon/stylized sources remain historical test/placeholder evidence, not approved final art. Submitted one detailed H3.1 bellhouse before the style correction (65 credits), then one grounded realistic archivist replacement using Ultra Mesh/2M source-polygon target, PBR, lighting removal and 8K texture (65 credits). Observed Studio balance 25, 020; these latest sources require visual/export/engine review before acceptance. Do not infer realism or runtime suitability from source settings.
- Downloaded the realistic archivist GLB (71, 623, 344 bytes) through desktop Studio and retained it through native broker ingestion with SHA-256 provenance. Blender independently measured 1, 916, 616 triangles, one mesh/material, an 8K base color and 4K normal/packed roughness-metallic maps. Produced an editable 1.78-metre source and four review renders through native DCC execution. Front/back review supports the corrected realistic direction; hands, rigging and Unreal acceptance remain pending. The initial render harness failed because an empty scene has no World; retained the failed run and corrected the harness explicitly.
- Submitted a separate 25, 000-quad retopology job for the realistic archivist (10 Studio credits), a replacement realistic stone/timber bellhouse (65) and realistic river-scout companion (65). Observed Studio balance 24, 880. Retain individual browser job URLs/prompts in the native Project; these submissions are not completion or runtime-acceptance claims. The high-detail original is preserved, and earlier cartoon assets remain rejected final art.
- Native functional game acceptance summary `Run-20261005-113442` reports passing filtered automation, services/data commandlet and runtime checks. The native art task nevertheless failed its completion contract; its task status is failed, distinct from those individual checks. Packaged visual acceptance and realistic art integration remain incomplete.
- Realistic archivist retopology completed and its FBX/PBR maps were downloaded and retained. Native Blender measured 47, 946 triangles, 24, 228 vertices and UVs, produced a 1.78-metre editable static master, explicit PBR material and separate 47, 946/23, 972/9, 588-triangle exports. Four independent runtime-source review renders completed; final skinned LOD and engine budget acceptance remain open. UE5 Studio rig charged 20 credits, exported the explicitly selected walk, and native Blender verified one skeleton/mesh, zero unweighted vertices, maximum four influences and actual sampled motion over frames 1–57 at 24 FPS. Raw rig height is approximately 0.979 metres; engine normalization is explicitly pending. Submitted a bounded native Luna Unreal import/visual-study task.
- Rejected the new text-generated bellhouse after visual review still showed exaggerated storybook stonework. Generated a more constrained photographic architectural reference through the actual Studio image UI (one 4K Nano Banana image, displayed free allowance, no observed credit decrement), then submitted a new H3.1 image-to-model job for 65 credits. Observed Studio balance 24, 795. Preserve rejected candidate evidence and reference prompt; no final architectural acceptance is claimed.
- Downloaded the realistic river scout source, retained its hashes and completed independent four-view Blender review/editable source. Studio retopology submitted for 10 credits; final export/rig/Unreal checks remain pending. Review found overly glossy fabric, explicitly requiring material correction rather than accepting the provider PBR label. Submitted realistic smith, musician, veteran guard, elder healer and player-courier sources (five H3.1 jobs, 65 credits each). Observed Studio balance 24, 460: cumulative Studio decrement 740 credits from the initial 25, 200, separate from 180 Tripo API credits and 30 Meshy credits. Individual generations retain their prompts/job URLs and remain candidates pending completion/review.
- Photo-reference bellhouse source completed, was downloaded with provenance, and passed independent four-view Blender review with an editable master. Submitted standard 50, 000-quad retopology for 10 Studio credits and downloaded the completed 50, 312-quad/50, 300-vertex FBX and PBR textures. Native Blender produced a measured 8-metre-width static master and three LOD exports; actual Unreal door scale/collision/performance remain pending. Observed Studio balance 24, 450, cumulative Studio decrement 750, separate from API and Meshy balances.
- River-scout retopology completed and was retained; native Blender produced three static LODs and four review renders with explicit PBR bindings and a documented 0.55 roughness floor to address glossy fabric. Original maps remain preserved; skin/cloth differentiation, rig and engine acceptance remain open.
- First realistic Serit native task imported the actual 61-bone skeleton/walk at measured 177.99998 centimetres and passed an explicit engine test (seven cases, 221 assertions) plus asset DataValidation. Automatic completion still failed because of the input-envelope defect recorded separately. Root review of its actual RHI screenshot failed: black background, overexposed scale proxy and unrecognizable character. Bind-pose warnings and renderer timeout remain recorded. Created a fresh native Luna visual-repair task; structural import does not establish visual acceptance.
- Controlled restart of the owned source runtime retained five registered Projects, all 120 quests/144 NPC records with identical hashes, native board/conversation data, the Luna-only Project pool, and the 1, 536-dimension embedding profile. Actual semantic search returned hits after restart. Eight native Blender connector operations passed after the isolated-import/export fixes. Fresh native fixture and actual Luna question continuation both succeeded; these do not repair historical stopped-worker checkpoints.
- All five additional detailed character sources were downloaded through desktop Studio and retained through native broker ingestion. Native Blender independently produced measured reports, packed editable masters and four-view renders for each. These are source candidates with hand/skin/cloth/rig gates open; do not certify them from polygon counts. Accepted user realism direction is retained in canon and actual semantic search returns its citation. Updated the selected source inventory to 33 including the player courier; the nominal source estimate is2, 145 credits, distinct from actual spend.
- The native scene-repair task passed explicit/automatic engine checks but failed the required claim backing because it supplied prose instead of the exact run UUID. The new actual editor screenshot was independently reviewed and failed again because it is black. Preserved both failures and created a bounded native Luna game-camera/rendered-animation task; no final character or full-game visual claim is made.

##### Validation

- Subsequent live game-camera diagnosis corrected a horizontal backdrop occluding the lights and made manual exposure explicit. The resulting gray character was traced to the actual Unreal warning that the PBR material lacked skeletal-mesh usage. Native authoring enabled that usage, saved/recompiled the material, and a fresh D3D12 game capture visibly rendered skin, hair, cloth and leather.
- The initial scale probe/reimport reused a scale-one skeleton: its live animated pelvis was only about 52 cm above the ground despite 178 cm mesh bounds. Imported a separate calibrated skeleton/animation without overwriting the earlier assets, and changed the isolated `ACArtStudy.cpp` fixture to use the component's serialized animation. Native editor compilation passed after correcting a command-quoting failure. Actual capture `fd0fe5bc-444a-8016-f7b9-74b0c8761a0a` shows the complete realistic character with textures and distinct walk poses; pelvis is about 94 cm above ground. Rig bind-pose/tangent warnings, full deformation/foot-contact review and packaged acceptance remain open. This is a WindowsEditor game-camera check, not final game quality acceptance.
- A second free Studio photographic reference and 65-credit detailed image-to-model request produced a realistic timber inn candidate; native download/provenance and four-view Blender/editable-source review completed. Five additional character retopology requests consumed 10 Studio credits each. Observed balance 24, 335; cumulative Studio decrement 865 from 25, 200, separate from Tripo API and Meshy spending. Retopology export/runtime acceptance remains in progress.
- After the calibrated skeleton and fixture changes, native `engine/run` test `01a10dd5-0a58-79ef-94e5-3a7bb5e0ec9f` succeeded with seven cases and zero failures/incomplete results. The conservative feature ledger enumerates all 198 RPC methods; after native asset-history and MCP lifecycle checks it records 50 selected live behaviors, 48 read surfaces, one error boundary and 99 unrun methods. This explicitly does not establish exhaustive system acceptance.
- All five additional character retopology FBX/texture archives were exported through Chrome, retained with containment checks and hashes, and processed through native Blender into measured editable masters with three static LODs each. Submitted UE5 Mannequin rigs for courier, Iver, Brona, Vey, Cael and Elun, 20 Studio credits each. Observed balance 24, 215, cumulative Studio decrement 985. Rig export/weight/deformation acceptance remains in progress.
- Native board lifecycle checks passed for posting, edit history, superseding, search, scoped subscription removal, binding the exact user realism correction, reading the bound decision and resolving the retained evidence thread. The first summary assertion incorrectly expected generation from a cached-read API; corrected the harness and retained the failed report. The default permanent-deletion guard correctly rejected an owned disposable test thread; archived it without weakening settings. No positive permanent-deletion or summary-generation claim is made.
- Native Luna completed the remaining 24-source manifest: eight regional buildings, five service buildings, three enemies, three terrain sources and five props, with independently checked identifiers, regional references and bounded prompts. Eleven non-building H3.1 source jobs were submitted through desktop Studio for 65 credits each (715 total). A third free photographic reference, explicitly requesting 4K, was reviewed for Reedhaven's river bellhouse and submitted through image-to-model for 65 credits. Observed Studio balance is 23, 435, cumulative decrement 1, 765 from 25, 200; API and Meshy spending remain separate. Generation settings and successful submissions do not prove final realism, topology, animation or game acceptance.
- All six additional UE5 walk archives were exported and retained through native broker ingestion. Native Blender checks passed for 61-bone skeletons, zero unweighted vertices, at most four influences and sampled animation movement. Native Luna task `01a10df7-b216-74e0-bfe7-fa2bc4454578` succeeded: six separate calibrated Unreal skeletons, skeletal materials and three saved skinned LODs each, plus a reopened isolated study map. Actual LOD vertices decrease; triangle counts/screen thresholds remain pending. Explicit engine test passed seven cases/221 assertions, and DataValidation passed after a scoped orphan-probe repair. Preserved failed Python import attempts, bind/tangent warnings and unchanged sampled editor poses. Game-camera deformation, exposure, final materials and gameplay integration remain open.
- The first bellhouse integration task was cancelled at its budget boundary, with its saved assets preserved. A fresh Luna capture/audit task succeeded and verified structural integration and filtered engine tests, but independent inspection of its actual game PNG failed: automatic exposure with negative compensation made the image nearly black. A manual-exposure correction is prepared and will run after the character task releases the editor. Structural/task success does not certify the building's visual quality or walkable interiors.
- Configured a Project-scoped native CodeFizz stdio MCP connection using the installed 3.0.2 CLI. Actual discovery exposed 15 base tools; health classification, refresh, disconnect/reconnect and classification retention passed. Server-initiated model calls are disabled. The real health response reports no connected Unreal editor, so live editor bridge and mutation acceptance remain unverified. Existing plugin files were inspected without changing the unrelated FourSquare Project.
- All eleven non-building sources were exported, hashed and processed through native Blender into editable masters, measured reports and four review renders each. Coordinator inspection of front and selected side/back views found source-specific material/geometry work, recorded in the native non-building handoff. Rejected the ashling after the actual renders showed four arms and a plated robot silhouette. Preserved its generation record as `generation-rejected-v1.json`, original provenance as `source-provenance-rejected-v1.json`, source GLB, master and renders; recorded the failure and revised its replacement to a photographic two-arm creature reference. No retopology or rig credits were spent on the rejected source. The other ten remain candidates with final material, geometry, animation or game-fit gates open; source production is not final-art approval.
- Reviewed a free 4K-requested two-arm ashling reference and submitted its replacement image-to-model request for65 Studio credits. Observed balance23, 370, cumulative Studio decrement1, 830. Preserved the rejected original's provenance separately so it does not point to the replacement generation record.
- Authored and compiled a separate parameterized `ACCharactersArtStudy` game-camera fixture through the native filesystem/process broker. Actual D3D12 runs for all six characters exited0, wrote two pose PNGs and reports, and verified changing foot positions plus decreasing per-LOD triangle counts. Initial independent image review failed the lighting gate despite full-body motion. Subsequent camera/fill edits exposed an error in root review scripts: Unreal Python's rotation constructor argument order differs from C++. Replaced positional rotations with explicitly assigned pitch/yaw/roll fields and asserted their readback before saving; new visual review is pending. Historical failed images remain retained.
- After correcting rotations and exposure, independent review of all six front-view images and Courier's second pose passes basic full-body framing, natural proportions, visible PBR and walking appearance. Native reports verify decreasing actual skinned triangle counts and changing foot positions. Detailed hands/joints, material differentiation, contacts, all-LOD visuals, crowd performance and packaging remain open. The corrected bellhouse capture `67e3b0ac-464e-9b59-6f8b-7ebe25c46d97` likewise passes basic full-building/material/scale-reference review; it remains exterior-only. Native review documents preserve failed captures and distinguish these checks from final game quality.
- A fifth free 4K-requested architectural reference for Thornmere was reviewed and submitted for65 Studio credits. Observed balance23, 305, cumulative Studio decrement1, 895. Rejected the sixth free reference for Dunwatch because it depicted a narrow tower instead of a community hall. Preserved the rejected image and metadata, revised the native architectural prompt, and reviewed the seventh free reference showing a rectangular single-story stone hall. Submitted that revised image-to-model source for65 Studio credits; observed balance23, 240, cumulative Studio decrement1, 960. Generated mesh, human-scale doors, interiors and runtime acceptance remain pending. Started native Luna task `01a10e46-76bd-7fb7-a7fe-9f89ab47b5c0` for player/NPC campaign integration using the seven reviewed realistic character templates. That integration and real idle/run/combat clips remain in progress.

- Live Project creation, trust/settings, tool registration, skills enable/activation, model discovery/import and pool creation, broker filesystem write, Knowledge write, board thread and task creation completed through PlayWeld.
- Actual Swarm failures retained in native task events. Blender production, paid Tripo generation/import, real vector backends/search, actual desktop Project selection and native C++ editor compilation/map existence now have live evidence. The 120-quest/144-NPC campaign has static and functional acceptance, and native backup/restore plus controlled restart retention passed. Final realistic art, packaged gameplay and exhaustive feature acceptance remain incomplete.
- Full repository build/typecheck/lint/test initially failed one A2A setup hook under live workload; focused A2A tests passed 11/11 and the second full gate passed. Format and change tracking checks passed before this evidence update; final tracking refresh remains required.
- Latest full repository gate after the completion-validator and question-handoff fixes passed 33/33 tasks (527 platform tests passed, 11 skipped). Format/change tracking and `scripts/check-links.sh` passed; an independent Node check also found zero broken links/anchors across255 Markdown files and1, 178 relative links. Native game-camera repair and final runtime art remain in progress.

- During realistic campaign integration, an actual runtime check exposed that `ConfigurePlayer` routed `courier` through the generic CRC template fallback. Preserved failed reports and posted a source-level finding on the native board. The native task added an explicit Courier mapping; subsequent D3D12 campaign report `4162ab86-461c-5b26-685a-c5ab61e529d2` passed 42 runtime checks across all nine regions. Seven regression cases/221 assertions also passed earlier in the task; final task contract and independent campaign images remain pending.
- Fresh live semantic search retrieved the new resolver finding as its top hit with an exact native board citation and `degraded: null`. This verifies newly ingested board evidence through the configured embedding path during ongoing development, beyond the earlier fixed-fixture search checks.
- Submitted standard retopology for the ten remaining non-building candidates other than the rejected ashling, using the native manifest's individual targets of 1, 200–18, 000 quads. Actual charge10 Studio credits each, 100 total; observed balance23, 140, cumulative Studio decrement2, 060. Every paid intent and charge is retained in its native source folder. Completed export, independent topology/material measurements, required enemy rigs and final game acceptance remain pending; this does not approve all ten as final art.

##### Files

- `docs/changes/2026-10-05-rpg-live-acceptance.md`

## 0.12.0

### Fixed

#### Close backup archive streams before staging cleanup

**Impact:** patch

[Permanent work record](docs/changes/2026-10-05-backup-archive-stream-cleanup.md).

##### Summary

Close and await archive source streams when rejecting an unlock secret or completing a manifest preview. The live packaged knowledge acceptance run exposed an open-file Windows cleanup failure that replaced the intended unsuccessful verification result with an internal RPC error.

##### Details

- Archive readers now release their async iterators in a finally block covering header parsing, unlocking and payload reading, and await readable stream completion before returning. Unlock-key zeroing remains intact; caller-supplied archive keys remain caller-owned.
- Add real-file regressions for wrong-secret rejection and partial manifest reads, plus an authenticated backup verification regression confirming a wrong secret returns `ok: false` and subsequent correct verification succeeds.
- No archive format, database schema, API or credential migration changes. Preserve the staged 0.11.0 candidate and its failing evidence; prepare a new numeric version for the repaired build.

##### Validation

- Before the fix, both new real-file tests failed because the archive stream remained open when the reader returned.
- After the fix, archive and backup service integration tests passed (9 tests across 2 files).
- Full repository build/typecheck/lint/test gate passed all 33 tasks without cache hits: platform service 513 passing tests, 11 existing skips; Theia extension 104 passing tests. Separate-process source 0.12.0 acceptance passed 28 checks including wrong-secret verification and actual restored native search, with zero failures and one live OpenAI access blocker.
- Staged 0.11.0 live reproduction: `backup/verify` with a wrong recovery secret raised RPC -32603 with Windows EPERM while removing its owned verification staging directory. Source-buffer archive tests had not covered file-handle lifetime.
- Repaired staged 0.12.0 live acceptance passed 28 checks, zero failures, one provider-access blocker at `.artifacts/knowledge-live-2026-10-05/staged-0.12.0-live-run/report.json`. Wrong-secret verification returns unsuccessful verification without an internal cleanup error; correct verification and native restore/reindex pass.
- Repaired staged desktop Knowledge acceptance passed 7 checks with zero renderer exceptions; broader live desktop smoke passed 29 checks. The OpenAI catalog candidates are selectable in the actual UI. Real semantic/vector/backend-switch checks remain blocked by fresh HTTP 403 `model_not_found` responses for both embedding models; no mock vectors were used.
- Left the actual 0.12.0 staged desktop running against its retained isolated acceptance profile and Observatory Project. Authenticated runtime version/profile and search for the UI-edited marker were verified after relaunch. Deployment evidence is `staged-0.12.0-live-run/local-deployment.json`; a local `Launch-Knowledge-Test.cmd` resumes that test deployment. The initial relaunch verification helper used an incorrect response-field name; correcting it confirmed the retained search without changing runtime code.
- The protected ordinary Program Files installation remains 0.10.2: Windows canceled the earlier elevation attempt, and installation-path selection is pending. Its profile and four Project databases are backed up. The staged local deployment does not constitute an installed upgrade, signing or rollback acceptance.

##### Files

- `packages/platform-service/src/backup/archive/reader.ts`
- `packages/platform-service/src/backup/archive/archive.test.ts`
- `packages/platform-service/src/backup/backup-service.integration.test.ts`
- `docs/changes/2026-10-05-backup-archive-stream-cleanup.md`

### Maintenance

#### Prepare version 0.12.0

**Impact:** none

[Permanent work record](docs/changes/2026-10-05-release-0.12.0.md).

##### Summary

Prepare version 0.12.0 from 0.11.0, retaining all pending work records in the changelog and detailed release notes.

##### Details

Synchronize first-party workspace and internal dependency versions. The lockfile must be refreshed separately. No tag, publication, or build is performed by version preparation.

##### Validation

Work-record freshness, local file coverage, version progression, and recorded impact checked before preparation. `npm install --package-lock-only --ignore-scripts` and release version check passed. Full build/typecheck/lint/test gate passed 33 tasks without cache hits: platform service 513 passing tests and 11 existing skips; Theia extension 104 passing tests. Tracking tests passed all 24 tests. Formatting, generated reference/inventory/evidence checks and a native equivalent relative-link scan passed (248 Markdown files, 1, 171 links); original Git Bash link scan remains incomplete. A plaintext credential scan found zero configured-key values across 1, 097 changed/artifact files. Existing dependency advisories remain unchanged.

Windows packaging/staging passed native addons, LanceDB/Qdrant dependencies, packaged service startup/shutdown, matching 0.12.0 versions and 30 bundled skills. The unsigned installer is `Windows-Release/0.12.0/PlayWeld-0.12.0-x64.exe`, SHA-256 `49dacf7d9d08ae683f37e7fe330df12ff291cfe44a5e66e41d13cc1eb3f1e517`. Staged live knowledge acceptance passed 28 checks with one external provider blocker; Knowledge UI passed 7 and broader desktop smoke passed 29, both with zero renderer exceptions. The staged desktop is running with the retained isolated test Project; protected installer upgrade remains pending after canceled Windows elevation. Source fingerprints are recorded in `local-build.json`; no tag, public publication or signing occurred. See the archive cleanup work record for failure and evidence boundaries.

Final plaintext-key scan covered 1, 376 changed/artifact files with zero matches; three locked files in the running desktop profile could not be read. The excessively slow owned Git Bash link scan was stopped; the native equivalent completed successfully. These limits remain explicit.

##### Files

- `packages/archive-extractor/package.json`
- `packages/contracts/package.json`
- `packages/platform-service/package.json`
- `packages/plugin-sdk/package.json`
- `packages/service-client/package.json`
- `packages/theia-control-room/package.json`
- `packages/plugins/sample-hello/package.json`
- `apps/control-room/package.json`
- `apps/control-room-browser/package.json`
- `package-lock.json`

## 0.11.0

### Fixed

#### Restore OpenAI embedding candidates in model discovery

**Impact:** patch

[Permanent work record](docs/changes/2026-10-05-openai-embedding-discovery.md).

##### Summary

OpenAI model discovery now offers the catalogued embedding models when a successful first-party model listing omits them, so they can be imported and selected in Knowledge settings using the existing provider account.

##### Details

- Supplement successful discovery for OpenAI accounts using the official HTTPS `/v1` endpoint with missing embedding entries from the existing metadata catalog (`text-embedding-3-small` and `text-embedding-3-large`). Preserve the returned provider metadata, avoid duplicate entries, and keep catalog provenance distinct from provider API evidence.
- Preserve preview without writes, explicit selected-model imports, account isolation, manual metadata precedence, and provider errors. Custom OpenAI endpoints and other provider kinds do not receive first-party candidates.
- Candidates describe published embedding capabilities, not confirmed account access. The existing Knowledge profile flow calls the embeddings API to verify access and determine dimensions before saving the profile. Discovery does not send a paid embedding probe or change credentials.
- Preserve and extend the pre-existing uncommitted regression test with selected import/update, custom endpoint isolation, no duplicates, authoritative provider capability metadata, and failed discovery coverage.
- No RPC, database, package identifier, version, or migration changes. The running packaged application has not been replaced or restarted by this change.

##### Validation

- Before the fix, `npm test -w @gamecrafter/platform-service -- src/models/model-registry.test.ts` failed because preview returned only the fixture chat model instead of the two embedding candidates. The original four-test suite passed after the fix.
- Read-only authenticated inspection of the running default-profile service confirmed one enabled first-party OpenAI account, no registered embedding models, and successful preview discovery of 19 models with no embedding capabilities. No credentials were emitted or changed.
- Existing Knowledge widget tests passed: six tests, including rendering a selectable OpenAI embedding model.
- OpenAI's published embedding model names were checked against its [embedding guide](https://developers.openai.com/api/docs/guides/embeddings) on 2026-10-05. Their absence from this account's discovery is live local evidence, not a claim that OpenAI universally omits them.
- `npx turbo run build typecheck lint test` passed all 33 tasks (21 cache hits), including both Electron and development browser application builds. Platform service: 109 test files, 511 passed and 11 existing platform-dependent tests skipped. Theia extension: 25 test files and 104 passed. The expanded discovery regression and six Knowledge integration tests passed in this full run.
- `npm run format:check`, `git diff --check`, and `npm run changelog:check -- --base HEAD` passed.
- `scripts/check-links.sh` was launched using Git Bash; its full scan has not completed at handoff. An equivalent temporary Node scan of the same paths, fenced-block exclusions, relative file targets, and heading slug rules passed: 242 Markdown files, 1, 162 relative links, zero failures. Temporary redacted diagnostics and the link scanner are under ignored `.turbo/` and are not product tooling.
- Paid embedding calls, selection in the installed application, and installer deployment remain unverified. No dependency installation was needed; the existing pinned workspace dependencies were used.

##### Files

- `packages/platform-service/src/models/model-registry.ts`
- `packages/platform-service/src/models/model-registry.test.ts`
- `docs/changes/2026-10-05-openai-embedding-discovery.md`

### Maintenance

#### Live knowledge acceptance project and local deployment

**Impact:** none

[Permanent work record](docs/changes/2026-10-05-live-knowledge-acceptance.md).

##### Summary

Add a repeatable live knowledge acceptance runner and prepare local deployment of the embedding discovery fix. The runner uses a separate service process, retained native test Projects, supported authenticated RPC, real files/databases and an existing encrypted provider account; it does not substitute fake embedding vectors.

##### Details

- Exercise gathering across canon, documents, code, board messages, synchronized binding decisions and asset provenance metadata; validate source filters, original quotes and citations.
- Exercise native-file watcher updates, canon/board edits, status and record-type filters, reference graphs, duplicate-ID conflicts and recovery, broken references and repair, deletion, idempotent reconciliation, two-Project isolation, checkpointed process restart and full rebuild.
- Exercise encrypted native Project backup verification, wrong-secret rejection, restoration into a new directory/Project identity, byte-identical edited sources, rebuilt search and nonempty-target refusal.
- Preserve each run in a new ignored artifact directory with a redacted incremental report, logs, encrypted test profile and inspectable synthetic Projects. Read the original account only to transfer its credentials in memory into the isolated profile; leave the ordinary provider account unchanged.
- Add a desktop acceptance runner for the retained live profile: inspect the actual embedding selector, search citations and retained record detail, then verify a service edit updates the open record through notifications and becomes searchable. Retain screenshots and captured renderer exceptions.
- Exercise real discovery preview and selected embedding import. When the provider denies the embedding probe, verify no embedding profile is persisted and hybrid search explicitly reports its lexical fallback. Mark semantic/vector acceptance blocked rather than using mocks.
- When real embedding access is available, also exercise paraphrase semantic/hybrid search, SQLite/LanceDB/managed-Qdrant backend switching and vector/profile retention after restart. Those cases cannot be claimed passing until executed.
- Local deployment is authorized by the user's 2026-10-05 request. Preserve ordinary configuration through checkpointed backup, installer upgrade and before/after comparison. No public release, tag, push, signing, uninstall or rollback is requested.

##### Validation

- `node scripts/verify-knowledge-live.cjs --help` passed.
- Live source process run `.artifacts/knowledge-live-2026-10-05/source-run-4/report.json`: 26 checks passed, zero failures, one provider blocker. Initial runner development failures were incorrect scenario setup (binding a finding instead of a proposal) and an incorrect expectation that two uncommitted edits have different revision labels; corrected the harness to use valid proposal binding and a committed-to-worktree revision transition.
- Expanded separate-process source release run `.artifacts/knowledge-live-2026-10-05/source-release-run/report.json`: 28 checks passed, zero failures, one provider blocker, including actual encrypted backup and restore.
- Fresh live OpenAI probes for `text-embedding-3-small` and `text-embedding-3-large` returned HTTP 403 `model_not_found` and zero dimensions. The source runner confirmed the same provider rejection through `knowledge/embeddingProfile/set`. No key values or raw provider errors were retained.
- Staged 0.11.0 general desktop smoke passed 29 checks with zero renderer exceptions. Knowledge desktop acceptance passed 7 checks with zero renderer exceptions after correcting the runner's ProjectHome navigation selector. Evidence remains under `.artifacts/knowledge-live-2026-10-05/staged-live-run/` and `.artifacts/documentation-electron/1791214175813/smoke/report.json`. The runner labels target desktop checks without assuming the executable is installed.
- Expanded staged 0.11.0 live acceptance passed 26 checks before a real Windows backup cleanup failure stopped the run. The archive-stream repair is recorded separately; this candidate is not accepted as a complete deployment.
- Ordinary installed 0.10.2 profile and four Project databases were checkpointed and backed up before attempting the upgrade. Windows elevation was canceled; the installed version remains unchanged and installation-path selection is pending. Do not treat staged acceptance as installed acceptance.

##### Files

- `scripts/verify-knowledge-live.cjs`
- `scripts/verify-knowledge-ui.cjs`
- `docs/changes/2026-10-05-live-knowledge-acceptance.md`

#### Prepare version 0.11.0

**Impact:** none

[Permanent work record](docs/changes/2026-10-05-release-0.11.0.md).

##### Summary

Prepare version 0.11.0 from 0.10.3, retaining all pending work records in the changelog and detailed release notes.

##### Details

Synchronize first-party workspace and internal dependency versions. The lockfile must be refreshed separately. No tag, publication, or build is performed by version preparation.

##### Validation

Work-record freshness, local file coverage, version progression, and recorded impact checked before preparation. `npm install --package-lock-only --ignore-scripts`, `npm ci`, and `node scripts/check-release-version.cjs v0.11.0` passed. The clean-dependency `npx turbo run build typecheck lint test --output-logs=errors-only` run passed all 33 tasks without cache hits: platform service 511 tests passed with 11 existing platform/environment skips; Theia extension 104 tests passed. Tracking regression tests passed (24 tests); generated RPC/settings, documentation inventory/evidence, formatting and release changelog checks passed. An equivalent native Node link scan passed 245 Markdown files and 1, 167 relative links; the slower Git Bash scan remains incomplete.

Windows packaging and staging passed native addon, LanceDB, Qdrant, packaged service lifecycle, matching versions and 30 bundled-skill checks. The unsigned installer is staged at `Windows-Release/0.11.0/PlayWeld-0.11.0-x64.exe`; SHA-256 is `65c50ced1b7d5c649df123292002c52ce1a7351602235f9831c2fa9e37c8ff79`. `local-build.json` records the dirty pre-commit source fingerprints; no tag or public release was created. Installer deployment and live desktop/knowledge acceptance are tracked in the companion work record. No signing certificate is configured. Dependency installation reported 56 existing advisories (5 low, 40 moderate, 11 high); no dependency upgrades were applied.

##### Files

- `packages/archive-extractor/package.json`
- `packages/contracts/package.json`
- `packages/platform-service/package.json`
- `packages/plugin-sdk/package.json`
- `packages/service-client/package.json`
- `packages/theia-control-room/package.json`
- `packages/plugins/sample-hello/package.json`
- `apps/control-room/package.json`
- `apps/control-room-browser/package.json`
- `package-lock.json`

## 0.10.3

### Fixed

#### Preserve A2A Continuation Context

**Impact:** patch

[Permanent work record](docs/changes/2026-10-05-a2a-continuation-context.md).

##### Summary

Outbound A2A `send` and `stream` continuations now reuse the remote context ID stored with the remote task owned by the current connection and Project. If that owned record has no context ID, continuation is rejected before agent discovery or network access instead of sending an invalid empty context.

##### Details

- The remote-task lookup retains the existing `(connectionId, remoteTaskId, ProjectId)` ownership check and returns the recorded context ID for message construction.
- Initial messages remain unchanged; task `get`, `cancel`, and `resubscribe` continue to require Project ownership but do not require a message context.
- Added coverage for non-streaming and streaming continuation payloads, and for rejecting continuation when the stored context is missing. No production API or storage schema changed.

##### Validation

- Regression red phase: `npm test -w @gamecrafter/platform-service -- src/a2a/a2a-service.integration.test.ts -t "reuses the recorded remote context"` failed because both continuation payloads had an empty `contextId` instead of `remote-continuation-context`.
- The expanded cold-client regression passed in 5.00 seconds and proves both missing-context send and stream reject before Agent Card discovery or JSON-RPC.
- `npm test -w @gamecrafter/platform-service -- src/a2a` — 2 files, 21 tests passed in 21.22 seconds.
- `npm run typecheck -w @gamecrafter/platform-service` — passed. The first full-gate attempt caught nullable arguments at the message-builder call sites; the fixed code now passes the non-null fallback only after the operation-specific missing-context guard.
- `npx turbo run build typecheck lint test --output-logs=errors-only --force` — all 33 tasks passed in 5m56s.
- `npm run test:changes` — 2 files, 24 tests passed in 55.46 seconds; `node scripts/check-release-version.cjs v0.10.2` and `npm run changelog:check -- --base HEAD` — passed.
- `npm run format:check`, `bash scripts/check-links.sh`, system-reference/inventory checks, documentation-evidence check, and `git diff --check` — passed.
- Provider live calls and external A2A interoperability are not claimed.

##### Files

- `packages/platform-service/src/a2a/a2a-service.ts`
- `packages/platform-service/src/a2a/a2a-service.integration.test.ts`
- `docs/changes/2026-10-05-a2a-continuation-context.md`

#### Guide Embedding Model Discovery

**Impact:** patch

[Permanent work record](docs/changes/2026-10-05-knowledge-embedding-model-discovery.md).

##### Summary

Knowledge settings now explain why connected provider credentials alone do not populate the embedding-model selector and provide a direct route to Models & Routing.

##### Details

- The selector remains limited to enabled models declared to support embeddings. The empty state now guides users to discover and add a compatible model, and to check API-key project access if discovery has no embedding models, preserving explicit model registration and routing controls.
- Added regression coverage for the empty state and verified that an enabled OpenAI `text-embedding-3-small` model remains selectable. No provider, storage, or RPC behavior changed.

##### Validation

- Regression red phase: `npm test -w @gamecrafter/theia-control-room -- src/browser/knowledge-widget.test.ts -t "explains how to add embedding models"` failed because the empty selector provided no discovery guidance.
- `npm test -w @gamecrafter/theia-control-room -- src/browser/knowledge-widget.test.ts` — 6 tests passed, including the discovery command action and selectable OpenAI embedding model.
- `npm test -w @gamecrafter/theia-control-room`, package typecheck, and package lint — passed (104 tests).
- `npx turbo run build typecheck lint test --output-logs=errors-only` — all 33 tasks passed.
- `npm run format:check`, `npm run changelog:check -- --base HEAD`, and `git diff --check` — passed.
- The later authorized live OpenAI API access diagnostic is recorded in `docs/changes/2026-10-05-openai-embedding-key-access-diagnostic.md`.

##### Files

- `packages/theia-control-room/src/browser/knowledge-widget.tsx`
- `packages/theia-control-room/src/browser/knowledge-widget.test.ts`
- `docs/changes/2026-10-05-knowledge-embedding-model-discovery.md`

### Maintenance

#### Prepare version 0.10.3

**Impact:** none

[Permanent work record](docs/changes/2026-10-04-release-0.10.3.md).

##### Summary

Prepare version 0.10.3 from 0.10.2, retaining all pending work records in the changelog and detailed release notes.

##### Details

Synchronize first-party workspace and internal dependency versions. The lockfile must be refreshed separately. No tag, publication, or build is performed by version preparation.

##### Validation

Work-record freshness, local file coverage, version progression, and recorded impact checked before preparation. `npm install --package-lock-only --ignore-scripts`, `npm ci`, and `node scripts/check-release-version.cjs v0.10.3` passed. `npx turbo run build typecheck lint test` passed all 33 tasks; the platform-service suite passed 510 tests with 11 environment/platform skips, and the Control Room suite passed 104 tests. `npm run test:changes` passed 24 tests. System-reference, documentation inventory/evidence/link, formatting, and release changelog checks passed.

`npm run package:win -w @gamecrafter/control-room` built the unsigned Windows x64 installer and passed native module, bundled Qdrant/LanceDB, packaged-service lifecycle, version, and bundled-skill verification. `node scripts/stage-windows-release.cjs` staged `Windows-Release/0.10.3`; installer SHA-256: `3f0bc2c7b4d341c12dc465c0787e9017f15bbdec00fc4ddca093640e870c1da6`. The packaged Electron smoke passed 29 UI/service checks with zero renderer errors in an isolated profile. No public tag or GitHub release was created. The local build manifest records the pre-commit base revision and dirty-source fingerprints. The package remains unsigned because no code-signing certificate is configured; Electron Builder also warned that ASAR is disabled. `npm ci` reported 56 dependency advisories (5 low, 40 moderate, 11 high); no dependency upgrades were applied.

##### Files

- `packages/archive-extractor/package.json`
- `packages/contracts/package.json`
- `packages/platform-service/package.json`
- `packages/plugin-sdk/package.json`
- `packages/service-client/package.json`
- `packages/theia-control-room/package.json`
- `packages/plugins/sample-hello/package.json`
- `apps/control-room/package.json`
- `apps/control-room-browser/package.json`
- `package-lock.json`

#### Launch the Embedding Selector Update Locally

**Impact:** none

[Permanent work record](docs/changes/2026-10-05-local-embedding-selector-test-deployment.md).

##### Summary

Built and launched the updated Electron Control Room from the working checkout for local testing, connected to the already-running platform service and profile.

##### Details

- Built `@gamecrafter/control-room` in development mode and launched the generated app with the workspace Electron executable. The app used the existing environment and profile; no credentials or profile data were copied or changed.
- The shell supplied `ELECTRON_RUN_AS_NODE`, which makes Electron expose Node mode instead of its application API. Cleared that variable only for the Electron launch process; no persistent environment setting was changed.
- This is a source-built local test run, not an installed upgrade, installer/package, version preparation, tag, or public release. The launched app uses the existing local service, which remains running after the Control Room window closes.

##### Validation

- `npm run build -w @gamecrafter/control-room` — passed; browser, Node backend, and Electron builds reported zero errors.
- The initial generic `npm run start -w @gamecrafter/control-room` invocation exited because `ELECTRON_RUN_AS_NODE` was set. After clearing it for the child only, Electron startup logs reached frontend state `ready` and the Control Room backend accepted connections on its local loopback port.
- `node packages/platform-service/lib/cli.js status` — the existing service remained responsive before and after launch.
- The local desktop process and backend were observed running. No live provider request or installer operation was performed.

##### Files

- `docs/changes/2026-10-05-local-embedding-selector-test-deployment.md`

#### Verify Live OpenAI Embedding Model Access

**Impact:** none

[Permanent work record](docs/changes/2026-10-05-openai-embedding-key-access-diagnostic.md).

##### Summary

Used an authorized OpenAI development credential to distinguish model-discovery filtering from provider model access. The live API responses matched discovery and denied direct embedding requests, so the UI was not hiding models returned by the API.

##### Details

- The read-only `model/discover` preview and direct `GET /v1/models` agreed; neither included embedding IDs.
- Minimal direct embedding requests for documented OpenAI embedding model IDs were denied with HTTP 403 `model_not_found` and returned no vectors ([embedding API](https://developers.openai.com/api/docs/api-reference/embeddings/create), [model catalog](https://developers.openai.com/api/docs/models/all)).
- This evidence indicates the tested credential's provider scope must expose and accept an embedding model before discovery can add it. The credential and account were not changed; no key, account identifier, or private profile data is recorded. No provider behavior changed as part of this diagnostic.

##### Validation

- Authenticated local service `model/discover` with `preview: true` and direct `GET /v1/models` — responses agreed; no embedding IDs appeared ([OpenAI API reference](https://developers.openai.com/api/reference/resources/models/methods/list)).
- Minimal authorized `POST /v1/embeddings` probes — HTTP 403 `model_not_found`; zero vectors returned.
- Provider discovery was run as a preview and persisted no model changes. API key values were not included in command output or retained artifacts.

##### Files

- `docs/changes/2026-10-05-openai-embedding-key-access-diagnostic.md`

#### Publish the PlayWeld 0.10.2 Testing Release

**Impact:** none

[Permanent work record](docs/changes/2026-10-05-publish-0.10.2-testing-release.md).

##### Summary

The v0.10.2 Desktop Release workflow completed successfully on Windows and Linux, and the generated unsigned testing prerelease was published on GitHub. This follow-up records the hosted result after the tag commit and updates the current release status; it does not move or modify the v0.10.2 tag.

##### Details

- Workflow run `37258256030` validated commit `f1115fb175247405c99fa9cfed3fd89be5dff2f2`, packaged both Windows and Linux targets, created release metadata, and uploaded the release assets.
- Published prerelease: <https://github.com/scarecr0w12/PlayWeld/releases/tag/v0.10.2>.
- Assets: `PlayWeld-0.10.2-x64.exe`, `PlayWeld-0.10.2-amd64.deb`, `PlayWeld-0.10.2-x86_64.AppImage`, `gamecrafter-release.json`, and `SHA256SUMS.txt`.
- The GitHub Windows installer digest is `sha256:8aaa3ba4c890064bd44d8d2fda74e533e3695e04d6a638cf991ea6bea8e33ef0`. The local staged installer is separately recorded in `2026-10-05-windows-workspace-test-timeout.md`.
- It is an unsigned testing prerelease because no signing key is configured. NSIS install/uninstall, upgrade/rollback, and live provider/A2A acceptance remain unverified.

##### Validation

- `gh run view 37258256030 --repo scarecr0w12/PlayWeld` — completed successfully; validate, Windows package, Linux package, and release jobs passed.
- `gh release view v0.10.2 --repo scarecr0w12/PlayWeld` — `isDraft: false`, `isPrerelease: true`; all five expected assets uploaded.

##### Files

- `docs/STATUS.md`
- `docs/RELEASE_GUIDE.md`
- `docs/changes/2026-10-05-publish-0.10.2-testing-release.md`

## 0.10.2

### Fixed

#### Stabilize Windows CI Test Timeouts

**Impact:** patch

[Permanent work record](docs/changes/2026-10-05-windows-workspace-test-timeout.md).

##### Summary

The v0.10.0 Windows release job exceeded Vitest's default five-second timeout in a SQLite vector-store test; v0.10.1 then timed out in the Project clone test. A previous full Windows-equivalent run also exposed a Qdrant readiness bound, fixed in v0.10.1; during v0.10.2 preparation, the Git-heavy release-ledger test exceeded five seconds locally. This test-only patch sets a 15-second platform-service default, adds 20-second deadlines to the Project-clone and release-ledger tests, and retains the SQLite/Qdrant bounds from v0.10.1. It does not change production behavior. The v0.10.0 and v0.10.1 tags remain unchanged, so the correction uses v0.10.2.

##### Details

- The Project clone test exercises database migration, chat copy, settings copy, task identity/leases, worktree exclusion, and vector-store exclusion across two Project records. It still checks the same behavior; only its deadline changes to 20 seconds.
- Platform-service Vitest tests now use a 15-second default to avoid repeated cold Windows runner failures for integration tests. The SQLite and Qdrant cases retain the explicit 20/15-second bounds added in v0.10.1.
- The release-ledger test still checks version progression and closed tracking before packaging; its timeout is 20 seconds to cover temporary-repository Git operations on cold runners.
- No production runtime code changes.

##### Validation

- `npm test -w @gamecrafter/platform-service -- src/projects/workspace.test.ts` — 1 file, 4 tests passed in 2.57 seconds locally.
- `npm run test:changes` — 2 files, 24 tests passed in 57.47 seconds locally.
- `npx turbo run build typecheck lint test --output-logs=errors-only --force` — all 33 tasks passed in 6m28s.
- `node scripts/check-release-version.cjs v0.10.2` and `npm run changelog:check -- --release --base HEAD` — passed.
- `npm run format:check`, `bash scripts/check-links.sh`, system-reference/inventory checks, documentation-evidence check, and `git diff --check` — passed.
- `npm run package:win -w @gamecrafter/control-room` — built the unsigned Windows x64 0.10.2 package; native dependencies, packaged platform-service startup/shutdown, and 30 bundled skills verified.
- `node scripts/stage-windows-release.cjs` — staged the package at `Windows-Release/0.10.2`.
- `node scripts/verify-documentation-electron.cjs` with `GAMECRAFTER_ELECTRON_EXECUTABLE` set to the staged executable — 30 isolated Electron/service checks passed with no renderer errors. Installer SHA-256: `edaa5f328d0f724e6b24e69f2ad35517f20d53d48281c9970fc97aa92fb541a0`.
- The v0.10.1 Linux package job passed; its Windows package job failed when the Project-clone test exceeded five seconds. The corrective 0.10.2 Windows workflow must rerun the full test suite; do not move or reuse the v0.10.0 or v0.10.1 tags.
- NSIS install/uninstall, upgrade/rollback, signing, and the GitHub v0.10.2 release workflow remain unverified.

##### Files

- `packages/platform-service/package.json`
- `packages/platform-service/src/projects/workspace.test.ts`
- `scripts/change-tracking.test.ts`
- `docs/STATUS.md`
- `docs/RELEASE_GUIDE.md`
- `docs/changes/2026-10-05-windows-workspace-test-timeout.md`

### Maintenance

#### Prepare version 0.10.2

**Impact:** none

[Permanent work record](docs/changes/2026-10-04-release-0.10.2.md).

##### Summary

Prepare version 0.10.2 from 0.10.1, retaining all pending work records in the changelog and detailed release notes.

##### Details

Synchronize first-party workspace and internal dependency versions. The lockfile must be refreshed separately. No tag, publication, or build is performed by version preparation.

##### Validation

Work-record freshness, local file coverage, version progression, and recorded impact checked before preparation. Dependency installation, refreshed lockfile verification, quality checks, packaging, signing, and live acceptance are not yet verified by this preparation record; retain their actual evidence in a follow-up work record.

##### Files

- `packages/archive-extractor/package.json`
- `packages/contracts/package.json`
- `packages/platform-service/package.json`
- `packages/plugin-sdk/package.json`
- `packages/service-client/package.json`
- `packages/theia-control-room/package.json`
- `packages/plugins/sample-hello/package.json`
- `apps/control-room/package.json`
- `apps/control-room-browser/package.json`
- `package-lock.json`

## 0.10.1

### Fixed

#### Stabilize Windows Vector-Store Release Tests

**Impact:** patch

[Permanent work record](docs/changes/2026-10-05-windows-sqlite-ci-timeout.md).

##### Summary

Increase test-only timing bounds for the SQLite and managed-Qdrant vector-store integration tests. The v0.10.0 Windows package job exceeded the default five-second Vitest timeout on the SQLite persistence test. A subsequent full Windows-equivalent local run exposed a 1.5-second Qdrant readiness timeout firing before its fake server returned the expected wrong-version response. The failed v0.10.0 tag remains unchanged; both timing-only corrections are assigned to a new patch release.

##### Details

- The SQLite test still asserts the same persistence, idempotent upsert, Project isolation, profile-version isolation, deletion, and search behavior; its per-test timeout is now 20 seconds.
- The managed-Qdrant wrong-version test still asserts the same version rejection; its manager readiness limit is 10 seconds and its Vitest timeout is 15 seconds so cold Windows startup time does not mask the expected error.
- No production code or application behavior changes.

##### Validation

- `npm test -w @gamecrafter/platform-service -- src/knowledge/sqlite-vector-store.test.ts` — 1 file, 4 tests passed in 616 ms locally.
- `npm test -w @gamecrafter/platform-service -- src/knowledge/managed-qdrant.test.ts` — 1 file, 6 tests passed in 9.88 seconds locally.
- `node scripts/check-release-version.cjs v0.10.1`, release changelog/evidence checks, and `npx turbo run build typecheck lint test --output-logs=errors-only --force` — 33 tasks successful.
- `npm run package:win -w @gamecrafter/control-room`, `node scripts/stage-windows-release.cjs`, and the isolated packaged Electron/service smoke — passed for local 0.10.1; manifest records the dirty pre-commit source fingerprint. No installer was installed into the normal profile.
- Release workflow evidence: v0.10.0 validation and Linux package jobs passed; its Windows job failed on the 5-second SQLite timeout. The corrective v0.10.1 tag/workflow is pending; do not move or reuse v0.10.0.

##### Files

- `docs/RELEASE_GUIDE.md`
- `docs/STATUS.md`
- `packages/platform-service/src/knowledge/sqlite-vector-store.test.ts`
- `packages/platform-service/src/knowledge/managed-qdrant.test.ts`
- `docs/changes/2026-10-05-windows-sqlite-ci-timeout.md`

### Maintenance

#### Prepare version 0.10.1

**Impact:** none

[Permanent work record](docs/changes/2026-10-04-release-0.10.1.md).

##### Summary

Prepare version 0.10.1 from 0.10.0, retaining all pending work records in the changelog and detailed release notes.

##### Details

Synchronize first-party workspace and internal dependency versions. The lockfile must be refreshed separately. No tag, publication, or build is performed by version preparation.

##### Validation

Work-record freshness, local file coverage, version progression, and recorded impact checked before preparation. Dependency installation, refreshed lockfile verification, quality checks, packaging, signing, and live acceptance are not yet verified by this preparation record; retain their actual evidence in a follow-up work record.

**Validation update (2026-10-05):** `npm ci` installed the synchronized lockfile; `node scripts/check-release-version.cjs v0.10.1`, `npm run changelog:check -- --release --base HEAD`, and `npm run test:changes` (24 tests) passed. The SQLite vector-store test passes with its increased CI timeout (4 tests, 616 ms locally); the managed-Qdrant suite passes with the longer wrong-version readiness window (6 tests, 9.88 seconds). Fresh `npx turbo run build typecheck lint test --output-logs=errors-only --force` passed all 33 tasks. Packaging, signing, local 0.10.1 staging/smoke, GitHub workflow, and live acceptance remain pending.

**Local package update (2026-10-05):** `npm run package:win -w @gamecrafter/control-room` passed the Windows native/service verifier, `node scripts/stage-windows-release.cjs` staged `Windows-Release/0.10.1`, and the packaged Electron/service harness passed 30 UI checks with zero renderer errors in an isolated profile. `local-build.json` records dirty pre-commit fingerprints; the local artifact is unsigned. The v0.10.1 GitHub workflow/publication, signed assets, installer install/uninstall, upgrade/rollback, and live provider/A2A acceptance remain unverified.

##### Files

- `packages/archive-extractor/package.json`
- `packages/contracts/package.json`
- `packages/platform-service/package.json`
- `packages/plugin-sdk/package.json`
- `packages/service-client/package.json`
- `packages/theia-control-room/package.json`
- `packages/plugins/sample-hello/package.json`
- `apps/control-room/package.json`
- `apps/control-room-browser/package.json`
- `package-lock.json`

## 0.10.0

### Added

#### Model Providers, Routing Metadata, and A2A Connectivity

**Impact:** minor

[Permanent work record](docs/changes/2026-10-04-model-providers-routing-a2a.md).

##### Summary

Expanded provider account/model discovery and added bidirectional A2A v1.0 agent connectivity. The implementation distinguishes provider-declared, catalog-sourced, account-configured, manual, and unknown model metadata; keeps the existing access/broker boundaries for external task execution; and exposes account/A2A controls in the Theia Connections and Models & Routing views.

##### Details

- Added named API adapters for OpenAI, Google Gemini Developer API, OpenRouter, xAI, Mistral, DeepSeek, Groq, and Azure OpenAI, retaining Anthropic and generic OpenAI-compatible endpoints. Account records remain independent and unlimited. Settings now provide provider endpoint presets, account edit/credential replacement/removal, and custom secret headers.
- Added Azure API-version/deployment configuration. The callable deployment name remains `providerModelId`; its separately configured/reported base model uses `catalogModelId`. Catalog enrichment never treats an unmapped Azure deployment name as a base-model ID.
- Added a versioned exact-ID provider catalog sourced to vendor model cards/APIs. Added researched capability/limit/price entries for exact current models where the source supports fields. Tiered or unrepresentable prices remain unknown; no silent paid completion probes are used. Research is recorded in [`docs/research/model-providers-and-a2a.md`](docs/research/model-providers-and-a2a.md).
- Model capabilities now distinguish `true`, `false`, and `null`/unknown. Metadata provenance, source URL, timestamp, and confidence are stored per field; account configuration has its own provenance. Discovery preserves non-null manual overrides, while setting a field to unknown clears that override for later discovery. Legacy provider capability values without per-field evidence (including the old implicit `chat: true`) are shown as unverified/unknown; existing model/account IDs and encrypted credentials are preserved.
- Completion routing requires known `chat: true`; unknown values do not satisfy required capability filters. Vision is recorded as a provider fact but is not routable while the common chat request is text-only. Embeddings use the dedicated embedding operation. Provider-category tags are descriptive; the reviewed provider categories do not exactly match builtin hard role/work-type restrictions, which therefore remain unrestricted unless a future sourced mapping matches.
- Added A2A v1.0 outbound Agent Card discovery and brokered send, send-stream, resubscribe, get, cancel, and Project-scoped remote-task list operations. Existing remote task IDs require a matching ledger owner Project before get/cancel/resubscribe/send-with-task-ID, so possession of a remote ID alone grants no cross-Project authority. Stream updates are forwarded through the broker to persisted local `a2a.remote_progress` TaskEvents. The remote-task ledger records connection/task/context/status and local Project/task/call correlation for reconciliation. Static API-key, bearer, basic, and custom-header credentials are stored in the encrypted profile credential store; credential values are never returned to list/discovery results.
- Granted `a2a/*` to the builtin coordinator role for external delegation; other builtin roles remain excluded by default and all calls still pass Project access/approval policy. Bounded streamed updates enter the local task event history when delegation runs in a local Task context.
- Added an opt-in inbound A2A JSON-RPC gateway bound only to `127.0.0.1`. One-time bearer credentials are stored as hashes and have explicit Project/role/task-operation grants. The gateway maps task create/get/continue/stream/cancel to durable TaskService operations; continuation cannot approve broker requests. Revoking a token or changing a grant terminates active streams. Create and failed-task retry results are revalidated after deduplication against Project, role, A2A client, and context ownership.
- Split inbound rate/concurrency controls so unauthenticated loopback requests cannot exhaust authenticated-client quotas. Agent Cards have a separate public-read limit. Host/Origin checks, no permissive CORS, request/stream/result bounds, and no credential forwarding across redirects/origins are enforced.
- Added A2A agent and inbound gateway/client management to Connections; added provider account/header, Azure deployment/catalog mapping, tri-state capability, editable token limits, per-field provenance, and manual override/reset controls to Models & Routing.
- Added profile database migrations 16–18 for provider options/model provenance/catalog IDs, A2A connections/client grants/task mappings, and durable outbound remote-task reconciliation. Added the stable `@a2a-js/sdk@1.2.1`, Express 5, and matching Express typings; the SDK version meets the repository's dependency-age rule.
- Fixed the first packaged Windows smoke: Electron's broad `node_modules/**/src` exclusion had removed the JavaScript entry point used by `debug`, so the packaged service sidecar could not start. Packaging now excludes TypeScript source files without dropping runtime JavaScript, and the Windows verifier launches the packaged sidecar in an isolated profile to check token, lock, status, and shutdown.
- Updated platform design, technical architecture, agent/tool contracts, the open decision register, development work packages, user/operations handbooks, routing guide, generated API/RPC/settings references, and documentation inventory. A2A support is documented as distinct from MCP; public/LAN ingress, OAuth/OIDC, gRPC, webhooks, inbound task listing, and non-text inbound parts remain unsupported.

##### Validation

- `npm run build -w @gamecrafter/contracts` — passed.
- `npm run typecheck -w @gamecrafter/platform-service` — passed.
- `npm run lint -w @gamecrafter/platform-service` — passed.
- `npm run typecheck -w @gamecrafter/theia-control-room` — passed.
- `npm run lint -w @gamecrafter/theia-control-room` — passed.
- `npm test -w @gamecrafter/contracts` — 20 files, 71 tests passed.
- `npm test -w @gamecrafter/theia-control-room` — 25 files, 102 tests passed.
- `npm test -w @gamecrafter/platform-service -- src/a2a/inbound-server.test.ts` — 10 tests passed, including token/grant revocation, failed-retry client/context dedup isolation, create-only grants, streamed artifacts, and rate isolation.
- `npm test -w @gamecrafter/platform-service -- src/a2a/a2a-service.integration.test.ts src/profile/migrations.test.ts` — 13 tests passed.
- `npm test -w @gamecrafter/platform-service -- src/roles/role-registry.test.ts` — 2 tests passed; confirms the coordinator's default A2A tool grant.
- `npm test -w @gamecrafter/platform-service -- src/models/providers src/models/model-registry.test.ts src/models/model-catalog.test.ts src/models/router.test.ts src/models/models.integration.test.ts src/tools/tool-broker.integration.test.ts` — 8 files, 75 tests passed.
- `npm test -w @gamecrafter/theia-control-room -- src/browser/connections-widget.test.tsx src/browser/operations-pages-layout.test.tsx` — 14 tests passed.
- `npx turbo run build typecheck lint test --output-logs=errors-only --force` — 33 tasks successful with fresh execution.
- `npm ci` — installed the exact synchronized lockfile.
- `npm run release:version -- 0.10.0`, `node scripts/check-release-version.cjs v0.10.0`, `npm run changelog:check -- --release --base HEAD`, and `npm run test:changes` — passed; all nine workspaces and the lockfile are versioned `0.10.0`.
- `npm run package:win -w @gamecrafter/control-room` — passed Windows x64 packaging, native-module/skill/license checks, and the new packaged service token/lock/status/start/stop verifier.
- `node scripts/stage-windows-release.cjs` — staged `Windows-Release/0.10.0`; the initial broken staging/package is preserved separately as `0.10.0-pre-fix` and was caused by the prior `node_modules/**/src` exclusion dropping `debug/src/index.js`. `local-build.json` records the pre-commit source commit, changed-path hashes, and `workingTreeDirty: true`.
- `node scripts/verify-documentation-electron.cjs` with `GAMECRAFTER_ELECTRON_EXECUTABLE` set to the staged executable — 30 packaged Electron UI/service checks passed with zero renderer errors, including authenticated `service/info` version verification. It used an isolated versioned test profile; it did not install over the normal profile.
- `npm run format:check` — passed.
- `bash scripts/check-links.sh` — passed.
- `node scripts/generate-system-reference.cjs --check` — passed.
- `node scripts/generate-documentation-inventory.cjs --check` — passed.
- `git diff --check` — passed.
- `npm audit --workspace=@gamecrafter/platform-service --omit=dev` found no production service advisories. `npm audit --omit=dev` reports 43 existing low/moderate advisories in the pinned Theia/Electron dependency tree; the full development tree reports 56 advisories. No broad override/downgrade was applied because the repo pins Theia packages together. No Windows signing certificate or GitHub signing key is configured, so the local installer and planned GitHub testing prerelease are unsigned; the packaged test manifest labels this explicitly.
- Provider and A2A fixtures use local fake endpoints; no authenticated live provider calls or live external A2A interoperability were performed. Published catalog data is not proof that a configured account has permission/deployment access. An outbound send interrupted before the remote task ID is returned cannot be automatically reconciled or retried. Automated background catalog refresh cadence and exact local role/work-type mappings remain open. The local Electron run is not installer install/uninstall, upgrade, rollback, or stable-release acceptance.

##### Files

- `.kilo/plans/1791138077002-model-providers-routing-a2a.md`
- `apps/control-room/electron-builder.yml`
- `apps/control-room/scripts/verify-windows-native.cjs`
- `docs/API_REFERENCE.md`
- `CHANGELOG.md`
- `docs/CONTROL_ROOM_HANDBOOK.md`
- `docs/DEVELOPMENT_PLAN.md`
- `docs/RELEASE_GUIDE.md`
- `docs/MODEL_ROUTING_GUIDE.md`
- `docs/OPEN_DECISIONS.md`
- `docs/PLATFORM_DESIGN.md`
- `docs/SKILLS_AGENTS_AND_TOOLS.md`
- `docs/STATUS.md`
- `docs/SYSTEM_ARCHITECTURE.md`
- `docs/TECHNICAL_ARCHITECTURE.md`
- `docs/USER_GUIDE.md`
- `docs/changes/2026-10-04-model-providers-routing-a2a.md`
- `docs/reference/DOCUMENTATION_INVENTORY.md`
- `docs/reference/documentation-inventory.json`
- `docs/reference/rpc-schemas.json`
- `docs/research/model-providers-and-a2a.md`
- `package-lock.json`
- `packages/contracts/src/a2a/index.ts`
- `packages/contracts/src/a2a/schema.ts`
- `packages/contracts/src/index.ts`
- `packages/contracts/src/models/models.test.ts`
- `packages/contracts/src/models/schema.ts`
- `packages/contracts/src/rpc/protocol.ts`
- `packages/platform-service/package.json`
- `packages/platform-service/src/a2a/a2a-service.integration.test.ts`
- `packages/platform-service/src/a2a/a2a-service.ts`
- `packages/platform-service/src/a2a/inbound-server.test.ts`
- `packages/platform-service/src/a2a/inbound-server.ts`
- `packages/platform-service/src/models/completion-service.ts`
- `packages/platform-service/src/models/model-catalog.test.ts`
- `packages/platform-service/src/models/model-catalog.ts`
- `packages/platform-service/src/models/model-registry.test.ts`
- `packages/platform-service/src/models/model-registry.ts`
- `packages/platform-service/src/models/models.integration.test.ts`
- `packages/platform-service/src/models/providers/anthropic.ts`
- `packages/platform-service/src/models/providers/google-gemini.ts`
- `packages/platform-service/src/models/providers/http-utils.ts`
- `packages/platform-service/src/models/providers/index.ts`
- `packages/platform-service/src/models/providers/openai-compatible.ts`
- `packages/platform-service/src/models/providers/openai-providers.ts`
- `packages/platform-service/src/models/providers/provider-adapters.test.ts`
- `packages/platform-service/src/models/providers/provider.ts`
- `packages/platform-service/src/models/providers/providers.test.ts`
- `packages/platform-service/src/models/router.test.ts`
- `packages/platform-service/src/models/router.ts`
- `packages/platform-service/src/profile/migrations.test.ts`
- `packages/platform-service/src/profile/migrations.ts`
- `packages/platform-service/roles/coordinator/ROLE.md`
- `packages/platform-service/src/roles/role-registry.test.ts`
- `packages/platform-service/src/service.ts`
- `packages/platform-service/src/tasks/task-service.integration.test.ts`
- `packages/platform-service/src/tasks/task-service.ts`
- `packages/platform-service/src/tools/tool-broker.ts`
- `packages/platform-service/src/tools/tool-broker.integration.test.ts`
- `packages/platform-service/src/tools/tool-registry.ts`
- `packages/theia-control-room/src/browser/connections-widget.test.tsx`
- `packages/theia-control-room/src/browser/connections-widget.tsx`
- `packages/theia-control-room/src/browser/models-widget.tsx`
- `packages/theia-control-room/src/browser/operations-pages-layout.test.tsx`
- `packages/theia-control-room/src/common/control-room-protocol.ts`
- `packages/theia-control-room/src/node/control-room-service.ts`
- `scripts/generate-documentation-inventory.cjs`

### Maintenance

#### Prepare version 0.10.0

**Impact:** none

[Permanent work record](docs/changes/2026-10-04-release-0.10.0.md).

##### Summary

Prepare version 0.10.0 from 0.9.0, retaining all pending work records in the changelog and detailed release notes.

##### Details

Synchronize first-party workspace and internal dependency versions. The lockfile must be refreshed separately. No tag, publication, or build is performed by version preparation.

##### Validation

**Initial preparation state (before local packaging):**

Work-record freshness, file coverage, version progression, and recorded impact were checked. `node scripts/check-release-version.cjs v0.10.0`, `npm run changelog:check -- --release --base HEAD`, `npm run test:changes` (24 tests), `npm ci`, and the fresh `npx turbo run build typecheck lint test --output-logs=errors-only --force` gate (33 tasks) passed. Formatting, links, generated RPC/inventory references, documentation evidence, and `git diff --check` passed. `npm audit --workspace=@gamecrafter/platform-service --omit=dev` reports no production service advisories; the repository-wide production audit reports 43 existing low/moderate advisories in the pinned Theia/Electron dependency tree, and the full tree reports 56 including development dependencies. No dependency override was introduced because the prescribed broad fix downgrades Theia packages. Windows packaging/staging, local packaged-app smoke, GitHub workflow, signing, and live provider/A2A acceptance remain to be verified by release/deployment steps.

**Validation update (2026-10-05):** The local Windows 0.10.0 package and `Windows-Release/0.10.0` staging passed native/service verification; the isolated packaged Electron smoke passed 30 UI/service checks with zero renderer errors and verified `service/info` reports 0.10.0. `local-build.json` records the pre-commit source revision and changed-path hashes (`workingTreeDirty: true`), so the local package is not attributed solely to the base commit. The package is unsigned because no code-signing certificate or GitHub signing key is configured. GitHub workflow and publication, installer installation/uninstallation, upgrade/rollback, and live provider/A2A acceptance remain pending or unverified.

##### Files

- `packages/archive-extractor/package.json`
- `packages/contracts/package.json`
- `packages/platform-service/package.json`
- `packages/plugin-sdk/package.json`
- `packages/service-client/package.json`
- `packages/theia-control-room/package.json`
- `packages/plugins/sample-hello/package.json`
- `apps/control-room/package.json`
- `apps/control-room-browser/package.json`
- `package-lock.json`

## 0.9.0

### Added

#### Integrate bounded local decision models with tasks and routing

**Impact:** minor

[Permanent work record](docs/changes/2026-10-04-bounded-decision-model-integration.md).

##### Summary

Integrate independently running typed decision endpoints with PlayWeld task assessment and eligible model selection, using inactive-until-configured shadow defaults, explicit assist mode, durable evidence, and visible usage/history.

##### Details

- Add version-1 assessment/request/history contracts and System One/OpenRouter Decisions HTTP adapters. Reuse encrypted provider-account credentials; configure a judge explicitly rather than recursively Auto-route it. Non-loopback endpoints require consent and HTTPS; refuse redirects, bound request/response bytes, and cover streamed body reads with cancellation/deadlines. Validate named answers, known labels, finite normalized distributions, nullable confidence/usage, and reported truncation/collapsed options without inventing missing probabilities or zero prices.
- Assess task work kind, effort, missing context, review/decomposition/engine-validation needs, and eligible model options. Use short option labels and supply the configured routing objective/constraints. Suggestions are not task-state transitions, dependency creation, completion validation, permission grants, or review waivers.
- Shadow records only. Explicit assist can prefer a sufficiently concentrated recommendation after current account/model enablement, pools, capabilities, estimated budget/latency filters and manual choice. Recheck eligibility at preparation; uncertain/denied/failed/changed configurations retain ordinary routing. Agent turns require chat/tool capabilities rather than admitting incapable models into assisted dispatch.
- Add profile migration 15 for versioned Project/task assessment history plus service-owned Project events/checkpoint identities. Store hashes rather than summary/credential copies in the dedicated history. Coalesce concurrent identical calls, reuse matching task/state/configuration records without recharging usage, preserve unknown costs/counts, and include fresh decision usage in agent task spending before the worker call.
- Merge decision inference from its service-owned ledger into Audit Model Usage without treating it as worker completion or a router-training outcome. A tagged `decision` variant permits null token/cache counts; existing `completion` counters remain non-null. Known-only subtotals disclose incomplete counts. Audit consumers must handle the new variant; client/service source are updated together.
- Add a read-only Models & Routing assessment tab with independent loading/error/empty states, baseline/suggestion, bounded advice, latency/usage and structured JSON. Expose account IDs for setup; reading history makes no model call. Configuration stays in scoped Models settings/provider accounts, not frontend durable state.
- Update user/architecture/status/register guidance and generated references/inventory, mapping the decisions RPC family. No dependencies, weights, inference engines, training jobs, live provider calls, release-version changes, installed-app changes, or production-profile changes are introduced. Live/calibrated checkpoint acceptance, learned performance predictors, LLMRouter/RouteLLM/vLLM adapters, benchmark ingestion and measured improvements remain separate work.

##### Validation

- Focused transport/service/routing/runtime/migration tests passed against fake endpoints and temporary/in-memory databases. Forked-worker HTTP/RPC integration passed shadow and assist modes, including history, broker calls, audit events, fees/tokens and expected worker selection.
- Explicit message-version and nullable audit-display tests passed. Independent source reviews identified concurrent duplicate assessments, missing decision usage in the model audit, and missing RPC version markers; fixes and targeted regressions address all three.
- `npx turbo run build typecheck lint test --output-logs=errors-only --concurrency=2` passed all 33 tasks after updating the two stable setting-count assertions for 85 definitions. Capability/OS-dependent tests retain explicit skips. Turbo emitted a disk-space cache warning; the gate exited successfully and E: had about 1 GB free afterward. No unrelated artifacts were deleted.
- `npm run format:check`, `git diff --check`, `bash scripts/check-links.sh`, `node scripts/check-documentation-evidence.cjs`, `node scripts/generate-system-reference.cjs --check`, and `node scripts/generate-documentation-inventory.cjs --check` passed. Evidence integrity is not independent verification of upstream decision-model quality.
- `npm run changelog:update` and `npm run changelog:check -- --base HEAD` passed with all feature and generated-reference paths covered before concurrent, unrelated cache/build-maintenance edits appeared. The final repository-wide coverage check then reported `.gitignore` as unrecorded work outside this feature; those edits were left untouched. The 33-task gate above predates that separate maintenance work. Workspace release versions remain 0.8.0.
- No live Kev/Laya/Jev acceptance, paid external call, model download/training, deployment, packaged Electron acceptance, calibration or performance measurement ran. Installed 0.8.0 remains unchanged.

##### Files

- `packages/contracts/src/models/decisions.ts`
- `packages/contracts/src/models/decisions.test.ts`
- `packages/contracts/src/models/index.ts`
- `packages/contracts/src/models/schema.ts`
- `packages/contracts/src/rpc/protocol.ts`
- `packages/platform-service/src/models/decision-provider.ts`
- `packages/platform-service/src/models/decision-provider.test.ts`
- `packages/platform-service/src/models/decision-service.ts`
- `packages/platform-service/src/models/decision-service.test.ts`
- `packages/platform-service/src/models/router.ts`
- `packages/platform-service/src/models/router.test.ts`
- `packages/platform-service/src/models/completion-service.ts`
- `packages/platform-service/src/models/models.integration.test.ts`
- `packages/platform-service/src/agents/agent-tools.ts`
- `packages/platform-service/src/agents/agent-runtime.ts`
- `packages/platform-service/src/agents/agent-runtime.test.ts`
- `packages/platform-service/src/profile/migrations.ts`
- `packages/platform-service/src/profile/migrations.test.ts`
- `packages/platform-service/src/settings/definitions.ts`
- `packages/platform-service/src/settings/registry.test.ts`
- `packages/platform-service/src/tasks/task-service.ts`
- `packages/platform-service/src/service.ts`
- `packages/platform-service/src/service.integration.test.ts`
- `packages/theia-control-room/src/browser/models-widget.tsx`
- `packages/theia-control-room/src/browser/audit-widget.tsx`
- `packages/theia-control-room/src/browser/audit-widget.test.tsx`
- `packages/theia-control-room/src/common/models-view-model.ts`
- `packages/theia-control-room/src/common/models-view-model.test.ts`
- `packages/theia-control-room/src/common/control-room-protocol.ts`
- `packages/theia-control-room/src/node/control-room-service.ts`
- `scripts/generate-system-reference.cjs`
- `scripts/generate-documentation-inventory.cjs`
- `docs/TECHNICAL_ARCHITECTURE.md`
- `docs/DEVELOPMENT_PLAN.md`
- `docs/SKILLS_AGENTS_AND_TOOLS.md`
- `docs/STATUS.md`
- `docs/USER_GUIDE.md`
- `docs/OPEN_DECISIONS.md`
- `docs/API_REFERENCE.md`
- `docs/SETTINGS_REFERENCE.md`
- `docs/reference/rpc-schemas.json`
- `docs/reference/settings-schemas.json`
- `docs/reference/DOCUMENTATION_INVENTORY.md`
- `docs/reference/documentation-inventory.json`
- `docs/changes/2026-10-04-bounded-decision-model-integration.md`

### Documentation

#### Investigate decision models and local routing systems

**Impact:** none

[Permanent work record](docs/changes/2026-10-04-decision-model-routing-research.md).

##### Summary

Research-only investigation of Jev, local typed decision engines, LLMRouter, comparable model-routing systems, and technical evaluation methods for PlayWeld model selection and task-policy advice.

##### Details

- Add a dated primary-source survey of Jev, Kev, Laya, SemIf, Gemma option scoring, fixed-taxonomy classifiers, and generative adapters. Distinguish hosted services from local inference, typed protocol compatibility from probability semantics, vendor/author measurements from repository acceptance, and code licenses from checkpoint/data obligations.
- Add a companion routing-system survey of LLMRouter, RouteLLM, vLLM Semantic Router, routing benchmarks, and cascade methods, with deployment/training dependencies and source-linked examples and technical papers.
- Inspect the current synchronous routing/completion seam, explicit role-derived task types, task-type/global outcome estimator, eligibility enforcement, and limitations of estimated cost constraints. Propose bounded advisory decisions and a separate calibration/quality/cost evaluation rather than replacing policy or permissions with a model.
- Record incompatible hosted-router include-list fallback behavior, inconsistent confidence definitions across implementations and cookbooks, privacy-gate disclosure risks, task-relabeling risks, and missing counterfactual outcome labels.
- Add research pointers to M05/M06 without resolving them, choosing a backend, changing confirmed runtime ownership, modifying application behavior, adding dependencies, or authorizing model-weight training. Refresh the generated changelog only; release version stays unchanged and no migration is required.

##### Validation

- Source-reviewed official API documentation, repository READMEs, selected model cards/licenses, technical writeups, and current PlayWeld source. Upstream benchmark results were not independently reproduced.
- `bash scripts/check-links.sh` passed with all relative links and anchors valid; external source pages were retrieved during research, not exhaustively link-crawled by this script.
- `npm run format:check` and `git diff --check` passed.
- `npm run changelog:update` and `npm run changelog:check -- --base HEAD` passed with the research paths covered by this work record.
- `node scripts/generate-documentation-inventory.cjs --check`, `node scripts/generate-system-reference.cjs --check`, and `node scripts/check-documentation-evidence.cjs` passed; these check generated references and artifact integrity, not the truth of upstream benchmark claims.
- No model downloads, local inference servers, paid model requests, training, GPU measurements, or application changes were performed. Proposed experiments remain unperformed.
- Application build/typecheck/lint/tests were not rerun for this documentation-only investigation.

##### Files

- `docs/research/decision-models-and-task-policy.md`
- `docs/research/local-model-routing-systems.md`
- `docs/OPEN_DECISIONS.md`
- `docs/changes/2026-10-04-decision-model-routing-research.md`

### Maintenance

#### Bound build-cache growth and separate test artifacts

**Impact:** none

[Permanent work record](docs/changes/2026-10-04-build-cache-maintenance.md).

##### Summary

Exclude Electron release packages from build caching, scope bundled-skill inputs to the service build, and provide conservative cache and artifact retention tooling.

##### Details

- Measured 115.075 GiB in the local Turbo cache. Inspected a 4.28 GiB archive manifest: ordinary desktop builds were caching multiple historical Electron installer/unpacked-release directories from `apps/control-room/dist`. Override desktop build outputs to cache only `lib` and `src-gen`; leave ordinary package `dist` outputs and actual installer files intact.
- Replace global skills invalidation with service-build inputs for the exact curated bundled skills. Preserve default source inputs, downstream dependency invalidation, and the service test's existing dependency on its own build; unrelated development skills no longer invalidate every task. A regression test checks the curated names against the authored list and preserves that test prerequisite.
- Add `npm run cache:prune`: dry-run by default, with `--apply` to delete recognized cache archives and their manifest/metadata as groups, oldest-first, targeting 5 GiB and 30-day retention. A one-hour write grace protects recent work; the byte target is soft when recent entries exceed it. Unknown files, linked roots, and legacy evidence/profile directories are not deleted. Locked or concurrently changed cache groups are skipped. Successful root `npm run build` and `npm run build:apps` invoke cache pruning automatically; direct Turbo/workspace commands do not invoke these root npm hooks.
- Add opt-in `--artifacts` retention for timestamped runs under `.artifacts`: preserve the newest three runs per suite and all runs with activity in the last 30 days. Fixed project/profile/engine directories and existing `.turbo` evidence remain untouched. Preview candidates before applying, and stop smoke-test processes before artifact deletion. Example: `npm run cache:prune -- --artifacts`, followed by the same command with `--apply` after reviewing its output. No artifact deletion was performed for this task.
- Move repository-owned smoke, documentation-capture, and engine-acceptance default paths into ignored `.artifacts`; update their related fixture paths and CI browser-evidence upload destination. Existing environment/CLI output overrides remain supported. Historical evidence references and files remain in their original locations; a new engine baseline is needed before extending acceptance fixtures at the new default path.
- Applied a one-time cache reset using `npm run cache:prune -- --apply --max-gib=0`, preserving the one-hour grace: 1,126 old groups removed, reported cache size reduced from 115.08 GiB to 0.12 GiB. Builds will regenerate needed results with the corrected output configuration.
- Add a cross-platform Node regression-test command and execute it in CI. Application APIs, persisted state, installers, and unrelated in-progress work are unchanged by this task. Concurrent release preparation assigned this record to 0.9.0; that version change is outside this maintenance task.
- Correct root build-filter quoting to use shell-portable double quotes: the previous single quotes were passed literally by Windows npm's shell and selected zero packages. Root build hooks now follow actual package/application builds.

##### Validation

- `npm run test:cache-maintenance`: nine regression tests passed, covering dry-run/apply, grouped oldest-first pruning, age retention, recent-write/sidecar protection, legacy/unknown-data preservation, linked-root/content refusal, artifact retention, installer exclusion, and curated service inputs.
- `npx turbo run build --filter=@gamecrafter/control-room --dry`: installed Turbo 2.11.2 resolved desktop outputs to `lib/**` and `src-gen/**`, excluding installer `dist`.
- `node --check` on changed CommonJS scripts: passed.
- Final `npx turbo run build typecheck lint test --output-logs=errors-only`: 33 tasks succeeded, including five cache hits. No claim is made that all checks executed fresh.
- `git diff --check`, `bash scripts/check-links.sh`, and `node scripts/check-documentation-evidence.cjs`: passed. The evidence checker validates inventory/report/file integrity, not live acceptance.
- `npm run build`: seven package/dependency builds executed successfully, followed by the cache-pruning hook. Rebuilt cache measured 0.25 GiB at that check.
- `npm run cache:prune -- --artifacts`: dry-run completed with zero artifact deletion candidates and no deletions.
- Final `npm run format:check` passed. An intermediate run reported a concurrent formatting issue in `packages/theia-control-room/src/browser/models-widget.tsx`; this task did not edit that file. Explicit formatting checks for maintenance JSON/YAML and the new scripts also passed.
- `npm run changelog:update` and `npm run changelog:check -- --base HEAD`: passed.
- Final `npm run cache:prune` dry-run measured 0.50 GiB after complete repository validation, versus 115.08 GiB before maintenance. No additional cache deletion candidates remained under the default policy.
- Live smoke and engine runs have not been repeated; artifact destination changes are source-reviewed only. Existing legacy evidence and profiles remain untouched.

##### Files

- `.github/workflows/ci.yml`
- `.gitignore`
- `.prettierignore`
- `apps/control-room/turbo.json`
- `docs/changes/2026-10-04-build-cache-maintenance.md`
- `package.json`
- `packages/platform-service/turbo.json`
- `scripts/audit-detail-ui-smoke.cjs`
- `scripts/capture-documentation.cjs`
- `scripts/chat-layout-ui-smoke.cjs`
- `scripts/engine-web-acceptance.py`
- `scripts/extended-engine-acceptance.cjs`
- `scripts/live-engine-acceptance.cjs`
- `scripts/live-ui-smoke.cjs`
- `scripts/navigation-layout-ui-smoke.cjs`
- `scripts/project-selection-ui-smoke.cjs`
- `scripts/prune-build-cache.cjs`
- `scripts/prune-build-cache.test.cjs`
- `scripts/settings-models-ui-smoke.cjs`
- `scripts/verify-documentation-electron.cjs`
- `scripts/verify-documentation-engines.cjs`
- `scripts/verify-documentation-examples.cjs`
- `scripts/verify-documentation-native.cjs`
- `scripts/verify-documentation-recovery.cjs`
- `scripts/workspace-overhaul-ui-smoke.cjs`
- `turbo.json`

#### Build and deploy decision assistance locally

**Impact:** none

[Permanent work record](docs/changes/2026-10-04-local-0.9.0-deployment.md).

##### Summary

Prepare and deploy the user-authorized local 0.9.0 Windows upgrade, then commit and push the decision integration, research and documented cache-maintenance changes.

##### Details

- Use a new minor version for the additive decision service and audit contract variant; preserve older release/staging directories and the existing all-users `C:\Program Files\GameCrafter` installation path. No release tag or hosted publication is requested.
- Gracefully close only the installed GUI, checkpoint its ordinary service, and snapshot the profile and available registered Project SQLite databases through the existing database seam before installer writes. Verify retained account/model/pricing/pool/settings/key fingerprints afterward; backups are database snapshots, not full Project-file copies.
- Verify the new native package and run disposable-profile Electron smoke before installation. Extend packaged smoke to open the decision-history tab, validate its version-1 RPC and safe initial shadow/empty-account/empty-model/remote-disabled settings without any inference or paid provider call.
- Correct the pending assessment setup text to show the account base URL ending in `/v1`, not the request endpoint `/v1/systemone`; the adapter owns endpoint joining. No inference weights or runtime are installed or configured by this deployment.
- Include the separately documented, source-reviewed cache-maintenance changes after their regression checks; preserve historical evidence and installer artifacts. Local dirty-build fingerprints remain truthful about the pre-commit source; the eventual commit is not retroactively substituted for package provenance.

##### Validation

- Prepared 0.9.0 and synchronized all nine workspaces/lockfile without third-party dependency changes. The release build/typecheck/lint/test gate passed all 33 tasks (24 cached); both app build checks passed (9 cached tasks). Tracking regressions passed 24 tests; cache-maintenance regression evidence is retained in its separate record. Version, formatting, generated-reference and documentation-inventory checks passed. Ordinary installed service is confirmed as 0.8.0 on its existing profile before upgrade.
- Native Windows packaging and contents verification passed: drivelist/LanceDB/Qdrant x64 binaries, app/service version 0.9.0 and all thirty bundled skills. A new `Windows-Release/0.9.0/` preserves earlier outputs; ignored metadata records the pre-commit base, dirty source fingerprints and installer checksum rather than attributing the build to a later commit.
- Staged Electron smoke passed 29 workflow checks with zero renderer errors, including actual decision-history rendering, version-1 history RPC and shadow/empty account/empty model/remote-disabled defaults: `.artifacts/documentation-electron/1791105956734/`. No inference or paid provider call ran.
- There were no installed GUI windows to force-close. Checkpointed the ordinary 0.8.0 service; profile and all four registered Project databases passed snapshot/integrity and retained-fingerprint checks before installer writes. Ignored backups and baselines are `.artifacts/release-0.9.0/`; encrypted data still requires the retained credential key and full Project files are not copied by this database-only backup.
- The authorized installer exited 0 at the retained `C:\Program Files\GameCrafter` location; Windows uninstall metadata reports `PlayWeld 0.9.0`. Twenty-one selected installed runtime files matched the tested stage byte-for-byte, including decision contracts/transport/service, router, worker integration, migrations, settings, frontend bundles and assessment/audit views: `.artifacts/release-0.9.0/installed-package.json`.
- Launched the ordinary installed 0.9.0 app/service. Four Projects, 21 models/enabled flags, six pools, pricing, account/settings and credential-key fingerprints match the pre-upgrade baseline; profile migration 15 and all four Project audit/history/migration scopes passed: `.artifacts/release-0.9.0/after.json`. No private prompts, credentials or profile data are printed or committed.
- A separate installed-executable smoke also passed all 29 checks with zero renderer errors on a disposable profile: `.artifacts/documentation-electron/1791106424827/`. Its owned GUI/service were closed while the ordinary installed app remains running. Signing status is `NotSigned`; this is a local unsigned testing deployment, not public publication, paid-provider/model-calibration acceptance or an uninstall/rollback drill.
- Final release-version/lockfile, formatting, whitespace, generated-reference/inventory, documentation-evidence and link checks passed; cache-maintenance regressions passed all nine final tests. Corrected the preparation record's relative deployment link so it remains valid when copied into generated release notes. Release-ledger coverage and immutable historical records passed before committing; no ignored installer/profile/runtime evidence is staged.
- Commit/push identity will be confirmed in the final handoff, not retrospectively substituted into pre-commit build provenance. Installer/profile/evidence artifacts remain ignored.

##### Files

- `docs/changes/2026-10-04-local-0.9.0-deployment.md`
- `docs/STATUS.md`
- `docs/RELEASE_GUIDE.md`
- `docs/RELEASE_ACCEPTANCE.md`
- `scripts/live-ui-smoke.cjs`
- `packages/theia-control-room/src/browser/models-widget.tsx`

#### Prepare version 0.9.0

**Impact:** none

[Permanent work record](docs/changes/2026-10-04-release-0.9.0.md).

##### Summary

Prepare version 0.9.0 from 0.8.0, retaining all pending work records in the changelog and detailed release notes.

##### Details

Synchronize first-party workspace and internal dependency versions. The lockfile must be refreshed separately. No tag, publication, or build is performed by version preparation.

##### Validation

Work-record freshness, local file coverage, version progression, and recorded impact checked before preparation. `npm install --package-lock-only --ignore-scripts` synchronized only first-party workspace versions; no third-party dependency changes were observed. `node scripts/check-release-version.cjs v0.9.0` passed. The release build/typecheck/lint/test gate passed all 33 tasks (24 cached), and both app build checks passed (9 cached tasks). Tracking regressions passed 24 tests; cache-maintenance validation is retained in its own record. Formatting and generated-reference/inventory checks passed. Packaging, signing and installed acceptance are recorded separately in [the local deployment record](docs/changes/2026-10-04-local-0.9.0-deployment.md), not implied by version preparation. Lockfile installation reported 56 existing audit findings (5 low, 40 moderate, 11 high); no audit remediation or security certification is claimed.

##### Files

- `packages/archive-extractor/package.json`
- `packages/contracts/package.json`
- `packages/platform-service/package.json`
- `packages/plugin-sdk/package.json`
- `packages/service-client/package.json`
- `packages/theia-control-room/package.json`
- `packages/plugins/sample-hello/package.json`
- `apps/control-room/package.json`
- `apps/control-room-browser/package.json`
- `package-lock.json`

## 0.8.0

### Changed

#### Separate model usage from tool charges in Audit and History

**Impact:** minor

[Permanent work record](docs/changes/2026-10-04-audit-usage-and-costs.md).

##### Summary

Improve Audit visibility and cost evidence instead of treating zero-valued tool charges or absent model pricing as complete model spending.

##### Details

- The original Audit view displayed tool-call costs but omitted model usage stored elsewhere. Unknown model pricing could also be coerced to zero, and four-decimal formatting hid sufficiently small positive amounts. Separate model usage, tool activity and Project events into focused views.
- Add searchable activity cards and a selected-record inspector with readable evidence fields, token/cache counters and bounded structured event context. Keep raw redacted records in optional disclosures and preserve paging, Project scope and redacted export.
- Show known estimates separately from partial, unavailable and unverifiable historical pricing. Genuine priced-zero remains distinct from unavailable pricing. Totals describe the loaded, filtered model page, not all-time spend, invoice reconciliation or independent tool-plus-model totals that double-count the same request.
- Record direct/routed/streamed completion attempts in a shared usage ledger, including unknown failed attempts; preserve nullable cost evidence and honest legacy interpretation. Old routed self-outcomes without confidence metadata are exposed as unverified, not re-priced from today's model settings. Pre-ledger direct completions cannot be reconstructed from absent records. No real provider calls, user credential changes, fabricated historical prices, version changes or local installation update were performed by this source-fix task.
- Preserve OpenAI/Anthropic cache counters and distinguish observed zero from omitted provider counts across complete/streaming responses. Missing or one-sided usage cannot claim known-free billing. Cache portions without rates remain unknown/partial. Numeric-only sanitized model projections avoid the generic redactor mistaking token counts for credentials, while user-controlled labels/request identifiers remain sanitized.
- Reject conflicting Project identifiers before routing/provider I/O so usage cannot be attributed to another Project. Daily exploration also considers the next candidate's known estimate and remaining allowance, falls back to baseline routing for unknown/oversized candidates, and preserves deliberately free candidates. This does not turn estimates into a provider-invoice or absolute-dollar guarantee.
- Monetary task accumulators/budget comparisons track known amounts; unknown pricing cannot establish a real hard-dollar ceiling. Token/turn controls and existing budget policy are not replaced by this UI change. Configure model rates before relying on monetary estimates; subscriptions, hardware costs and provider invoices remain outside these totals.

##### Validation

- New Audit render tests failed against the original view because it had no model usage section or pricing-state presentation. Focused UI tests passed after implementation, including positive sub-cent costs, explicit free calls, unavailable and legacy-unverified pricing, and structured task text.
- Backend regressions were run red before fixes. Focused initial tests passed 45 with six environment-dependent skips; reviewed-edge-case provider/Project/exploration regressions passed 31. Existing profile/Project databases add confidence/ledger storage without fabricating historical prices. Prepared-completion mocks and update/lifecycle fixtures were corrected to use the new router seam and declared current migrations rather than obsolete hard-coded schema counts.
- Full repository validation passed all 33 tasks (22 cached, 11 executed). It initially caught stale migration/update-fixture expectations and a prepared-route mock missing its context/new ledger method; updated only those fixtures and reran successfully. Turbo emitted a cache I/O disk-space warning despite all successful task exits; later browser verification used the generated outputs.
- Full UI suite passed 93 tests in 25 files. The final real-service browser smoke passed seven checks with no renderer errors: tiny priced `$0.0000022`, unknown-price null and explicit-free zero remain distinct; goal content and Audit inspectors fit desktop/narrow windows. Actual-source screenshots/report are `docs/images/audit-detail-2026-10-04/`; ignored evidence is `.turbo/audit-detail-ui/1791096552100/`.
- No paid-provider/invoice, complete historical accounting, or hard-dollar-budget acceptance is claimed. The source-fix stage left the installed 0.7.0 app/profile intact; the subsequent user-authorized [local 0.8.0 deployment](docs/changes/2026-10-04-local-0.8.0-deployment.md) separately records packaged/installed verification and commit/push.

##### Files

- `packages/theia-control-room/src/browser/audit-widget.tsx`
- `packages/theia-control-room/src/browser/audit-widget.test.tsx`
- `packages/theia-control-room/src/common/cost-display.ts`
- `packages/theia-control-room/src/common/cost-display.test.ts`
- `packages/theia-control-room/src/browser/style/workstation.css`
- `scripts/audit-detail-ui-smoke.cjs`
- `docs/changes/2026-10-04-audit-usage-and-costs.md`
- `docs/CONTROL_ROOM_HANDBOOK.md`
- `docs/USER_GUIDE.md`
- `docs/MODEL_ROUTING_GUIDE.md`
- `docs/API_REFERENCE.md`
- `docs/reference/rpc-schemas.json`
- `packages/contracts/src/models/schema.ts`
- `packages/contracts/src/rpc/protocol.ts`
- `packages/contracts/src/tools/schema.ts`
- `packages/platform-service/src/agents/agent-runtime.ts`
- `packages/platform-service/src/agents/agent-tools.ts`
- `packages/platform-service/src/agents/agent-tools.test.ts`
- `packages/platform-service/src/board/board-maintenance-service.ts`
- `packages/platform-service/src/workers/board-maintenance-handlers.ts`
- `packages/platform-service/src/workers/types.ts`
- `packages/platform-service/src/models/completion-service.ts`
- `packages/platform-service/src/models/router.ts`
- `packages/platform-service/src/models/router.test.ts`
- `packages/platform-service/src/models/models.integration.test.ts`
- `packages/platform-service/src/models/completion-service.test.ts`
- `packages/platform-service/src/service.integration.test.ts`
- `packages/platform-service/src/models/providers/anthropic.ts`
- `packages/platform-service/src/models/providers/http-utils.ts`
- `packages/platform-service/src/models/providers/openai-compatible.ts`
- `packages/platform-service/src/models/providers/providers.test.ts`
- `packages/platform-service/src/profile/migrations.ts`
- `packages/platform-service/src/profile/migrations.test.ts`
- `packages/platform-service/src/projects/migrations.ts`
- `packages/platform-service/src/service.ts`
- `packages/platform-service/src/tools/tool-broker.ts`
- `packages/platform-service/src/tools/tool-broker.integration.test.ts`
- `packages/platform-service/src/tools/tool-registry.ts`
- `packages/platform-service/src/tools/tool-store.ts`
- `packages/platform-service/src/mcp/connection-manager.ts`
- `packages/platform-service/src/mcp/connection-manager.sampling.test.ts`
- `packages/platform-service/src/plugins/plugin-host.ts`
- `packages/platform-service/src/plugins/plugin-service.integration.test.ts`
- `docs/images/audit-detail-2026-10-04/formatted-goal-desktop.png`
- `docs/images/audit-detail-2026-10-04/formatted-goal-narrow.png`
- `docs/images/audit-detail-2026-10-04/model-cost-desktop.png`
- `docs/images/audit-detail-2026-10-04/model-cost-narrow.png`
- `docs/images/audit-detail-2026-10-04/tool-history-desktop.png`
- `docs/images/audit-detail-2026-10-04/event-history-desktop.png`
- `docs/images/audit-detail-2026-10-04/capture-report.json`

### Fixed

#### Format agent hierarchy goals and related task text

**Impact:** patch

[Permanent work record](docs/changes/2026-10-04-hierarchy-content-formatting.md).

##### Summary

Replace flat task-goal/result paragraphs with structured, bounded reading panels in the agent hierarchy while keeping untrusted text inert and all task actions available.

##### Details

- A failing render regression reproduced Markdown headings, lists and fences appearing literally inside a single paragraph. Render Markdown tokens from the existing Theia-shared parser as React elements instead of injecting HTML or introducing a new dependency.
- Goals, results, errors and questions preserve headings, nested lists, emphasis, inline/fenced code, tables and paragraph breaks. Structured JSON is indented as escaped code. Raw HTML and automatic media loading are not enabled; executable/file/relative link targets do not become navigable actions.
- Bound long goal/result/question content in named keyboard-accessible scroll regions. Shorten request-select labels to the first heading/line without discarding the stored goal. Keep cancellation, feedback, question answers and artifact paths intact.
- Label task spend as the known recorded portion, preserve tiny positive amounts, and show no charge recorded instead of asserting that a zero-valued accumulator proves free usage. Audit provides separate cost-coverage details; unpriced usage can remain outside the numeric task accumulator.
- The source-fix stage kept version 0.7.0 and did not replace the installed app/profile or commit/push. The later user-authorized [local 0.8.0 deployment](docs/changes/2026-10-04-local-0.8.0-deployment.md) records that separate packaging/install/Git handoff; the screenshots retain their actual source-capture version.

##### Validation

- `npm test -w @gamecrafter/theia-control-room -- src/browser/swarm-widget.test.ts`: new formatting regression failed before the fix at the missing heading assertion.
- Focused formatting/escaping tests passed after implementation, covering headings/lists/code/tables, inert HTML/image/command links and JSON indentation. Source typecheck passed.
- Full UI suite passed 93 tests across 25 files. The new task-heading regression also keeps automatically derived Markdown titles concise while retaining full stored goals. A scoped read-only safety/UI review found one obsolete instruction in Audit; corrected its expansion wording to selection.
- `npx turbo run build typecheck lint test --output-logs=errors-only`: 33 tasks passed (22 cached, 11 newly executed), including browser/Electron builds. Turbo emitted a cache I/O disk-space warning; task exit statuses were all successful and final outputs were used for browser verification.
- `scripts/audit-detail-ui-smoke.cjs` passed seven checks against the real isolated service and rebuilt browser, including Markdown structure, bounded keyboard readers, cost confidence and desktop/narrow layouts, with no renderer errors. Actual-source screenshots/report are in `docs/images/audit-detail-2026-10-04/`; ignored run evidence is `.turbo/audit-detail-ui/1791096552100/`.
- Current screenshot metadata labels the pending 0.7.0-version source build. No installed-desktop, real-provider or invoice verification is claimed; the ordinary 0.7.0 installed application/profile were not replaced or migrated.

##### Files

- `packages/theia-control-room/src/browser/swarm-widget.tsx`
- `packages/theia-control-room/src/browser/swarm-widget.test.ts`
- `packages/theia-control-room/src/browser/markdown-content.tsx`
- `packages/theia-control-room/src/browser/markdown-content.test.tsx`
- `packages/theia-control-room/src/common/cost-display.ts`
- `packages/theia-control-room/src/common/cost-display.test.ts`
- `packages/theia-control-room/src/common/swarm-view-model.ts`
- `packages/theia-control-room/src/browser/style/workstation.css`
- `docs/changes/2026-10-04-hierarchy-content-formatting.md`
- `docs/CONTROL_ROOM_HANDBOOK.md`
- `docs/USER_GUIDE.md`

### Maintenance

#### Deploy hierarchy formatting and cost accounting locally

**Impact:** none

[Permanent work record](docs/changes/2026-10-04-local-0.8.0-deployment.md).

##### Summary

Deploy the user-authorized local 0.8.0 upgrade for formatted hierarchy details and confidence-aware model usage, verifying installation and retained data before the source commit/push.

##### Details

- The user explicitly requested updating the local install, committing and pushing the pending fixes. Prepared and installed 0.8.0 as a new minor version for the additive usage ledger and Audit interface. Earlier artifacts were retained; no tag or GitHub release was created.
- Preserve the existing all-users `C:\Program Files\GameCrafter` installation path. Close only its GUI gracefully and stop its service with checkpointing before the final pre-upgrade snapshot. Do not force-close unsaved editors or kill unrelated processes.
- Snapshot the profile and registered Project SQLite databases through the existing database seam, and compare selected model/pool/settings/account/pricing/key fingerprints after upgrade. Backups are ignored local artifacts, not complete Project-file backups; encrypted data still requires the retained credential key.
- Keep the existing browser screenshots' actual 0.7.0-source capture labels. They verify the pending fixes with deterministic local providers, not the installed 0.7.0 build or paid invoices. Packaging/installed-runtime verification has its own evidence below.
- Existing release directories occupy about 1.36 GB per staged/output version; E: had about 4.08 GB available at preparation. Direct the new Turbo cache to the pre-approved C: temporary directory instead of consuming the release volume. Do not delete earlier builds, profiles or unrelated caches.

##### Validation

- `npm run release:version -- 0.8.0` assigned the pending records and synchronized all nine first-party workspaces. The lockfile-only install changed only workspace versions; `node scripts/check-release-version.cjs v0.8.0` passed. No third-party dependencies were upgraded.
- Fresh version-0.8.0 build/typecheck/lint/test validation passed all 33 tasks with zero cached results (5m12s), using the C: temporary cache. Both app builds passed. The preceding source-fix records also include 93 UI tests and seven real-service browser checks.
- Lockfile installation reported existing audit findings: 56 total (5 low, 40 moderate, 11 high). No audit remediation or security certification is claimed.
- Windows packaging/native verification passed, including drivelist, LanceDB, managed Qdrant, app/service version 0.8.0 and all thirty bundled skills. Created a new `Windows-Release/0.8.0/` without replacing existing staging/output versions; dirty-source provenance and installer SHA-256 are in its ignored metadata.
- Staged Electron smoke passed 28 workflow checks with no renderer errors, including a real structured goal and the separate model-usage overview/redacted export: `.turbo/documentation-electron/1791098323621/`. The test used a disposable profile and no paid provider.
- Closed/checkpointed the ordinary 0.7.0 service without force-killing user editors. Profile and all four available registered Project SQLite databases passed pre-upgrade snapshot/integrity checks; ignored baselines/backups are `.turbo/release-0.8.0/`. An initial inspection-helper query used a nonexistent registry column; corrected its query to the actual `path` column before any backup or installer write.
- The authorized all-users installer exited 0 and Windows uninstall metadata reports PlayWeld 0.8.0 at the retained `C:\Program Files\GameCrafter` path. Thirteen selected installed runtime files matched the tested stage byte-for-byte, including goal/parser/Audit/cost and completion/router code plus frontend bundles: `.turbo/release-0.8.0/installed-package.json`.
- Launched the ordinary installed 0.8.0 app and verified its service. Before/after selected fingerprints matched four registered Projects, twenty-one model IDs/enabled flags and pricing, six pool memberships, and settings/account/credential-key configuration. All four Project audit/migration scopes verified; model usage responses preserve numeric counters and typed cost confidence. Ignored evidence: `.turbo/release-0.8.0/after.json`. No credentials/prompts/private records were printed or staged.
- The actual installer signature is `NotSigned`; this remains an unsigned local testing build, not public/signed, paid-provider/invoice or uninstall/rollback acceptance. Existing browser screenshots retain their actual source capture version and fixture limits. Commit/push identity is verified in the final handoff rather than retrospectively assigned to pre-commit build provenance.
- Final release-ledger coverage/immutability, version checks, API/reference freshness, documentation links, image/report integrity, formatting and whitespace checks passed. Updated record cross-links to remain valid when copied into generated release notes. No installers, profile databases, credentials or ignored runtime evidence are included in the source commit.

##### Files

- `docs/changes/2026-10-04-local-0.8.0-deployment.md`
- `docs/STATUS.md`
- `docs/RELEASE_GUIDE.md`
- `docs/RELEASE_ACCEPTANCE.md`
- `scripts/live-ui-smoke.cjs`

#### Prepare version 0.8.0

**Impact:** none

[Permanent work record](docs/changes/2026-10-04-release-0.8.0.md).

##### Summary

Prepare version 0.8.0 from 0.7.0, retaining all pending work records in the changelog and detailed release notes.

##### Details

Synchronize first-party workspace and internal dependency versions. The lockfile must be refreshed separately. No tag, publication, or build is performed by version preparation.

##### Validation

Work-record freshness, local file coverage, version progression, and recorded impact checked before preparation. Subsequently synchronized the lockfile without third-party upgrades and verified version 0.8.0, all 33 fresh repository quality tasks, Windows packaging and 28 packaged desktop checks. The [local deployment record](docs/changes/2026-10-04-local-0.8.0-deployment.md) retains installed hash/profile/migration verification and the actual unsigned signature status. No public release, paid-provider, uninstall/rollback or signing acceptance is claimed.

##### Files

- `packages/archive-extractor/package.json`
- `packages/contracts/package.json`
- `packages/platform-service/package.json`
- `packages/plugin-sdk/package.json`
- `packages/service-client/package.json`
- `packages/theia-control-room/package.json`
- `packages/plugins/sample-hello/package.json`
- `apps/control-room/package.json`
- `apps/control-room-browser/package.json`
- `package-lock.json`

## 0.7.0

### Added

#### Selectable embedded and managed vector storage

**Impact:** minor

[Permanent work record](docs/changes/2026-10-04-vector-storage-backends.md).

##### Summary

Add embedded LanceDB and SQLite exact vector storage, managed native Qdrant, and explicit existing-local/remote Qdrant configurations behind a backend-neutral storage boundary.

##### Details

- Separate backend IDs from deployment ownership; retain `none` and legacy external Qdrant settings without changing lexical-only defaults.
- Add trusted, versioned adapter registration through service options. Unknown IDs and unsupported deployments fail closed. This is not isolated marketplace-plugin support.
- Replace Qdrant-shaped retrieval filters with typed neutral filters, generalized indexing/counting/cleanup, cached handles, and service shutdown disposal. Destination identity in vector mappings triggers re-embedding unchanged source content when storage changes.
- Add native LanceDB persistence with fixed Float32 Arrow dimensions, Project/version namespaces, filtered cosine search, serialized ID upserts, deletion, and lazy native loading. Pin SDK 0.29.0 with Arrow 18.1.0 to avoid optional inference runtimes added by newer SDK packaging.
- Add lightweight SQLite storage using the existing database seam, transactional upserts and exact filtered cosine scans. It is not sqlite-vec or an ANN index.
- Add managed Qdrant lifecycle and checksum-pinned build preparation for Windows/Linux x64; desktop resources include the native executable and Qdrant license. Existing local and remote Qdrant reuse the REST adapter.
- Managed Qdrant uses a private temporary working/config directory, strips inherited Qdrant overrides, authenticates readiness, and disables unused transports/telemetry. Windows shutdown terminates the process tree before its shell parent can exit; extended-length storage paths handle deep Project directories. Unexpected process exit can restart lazily on the next operation.
- Explicit remote mode requires permission to send embeddings/metadata and HTTPS. Existing-local mode requires a loopback IP. Legacy external mode deliberately retains its old transport policy, with a visible warning. Redirects are refused and API keys remain encrypted credential references.
- Add Knowledge UI selections, custom adapter deployment, consent messaging, and atomic snapshot-safe settings saves through the existing settings import transaction. Re-run indexing when settings change during an active task.
- Recover missing vector points even when source/mapping state is unchanged, retry failed source deletions without discarding their mappings, and keep derived vector directories out of Project Git and clone copies. Authenticated Qdrant requests refuse non-loopback cleartext HTTP even in legacy mode.
- Update architecture, requirements/decision register, evidence note, generated API/settings references, and release guidance. Source documents stay authoritative; no inference runtime or automatic source-of-truth migration is added.
- Old destination data remains retained until explicit cleanup; cached handles remain owned until service shutdown. Controlled deletion of retired backends, plugin-host adapters, live remote acceptance and installed-package recovery remain separate work.

##### Validation

- Native LanceDB/SQLite, Qdrant REST fixture, registry, and fake-provider service integration passed focused checks, including destination switching, no-op reconciliation, point-loss recovery, deletion retry, and settings changes during indexing.
- New Knowledge UI rendering/settings-notification tests: 3 passed. Contract tests: 5 passed. Settings/service integration tests: 8 passed.
- Workspace build/typecheck/lint tasks passed, including desktop/browser development builds (desktop test/typecheck scripts remain configured placeholders). Final service suite: 401 passed, 11 skipped; contract tests: 67 passed; current UI suite: 54 passed; other package tests passed (five tests, one additional skipped). Change-tracking tests: 24 passed.
- Managed Qdrant tests: six passed, including actual native Windows Qdrant 1.19.1 authentication, persistence across restart, Project separation, point search/deletion, and shutdown. The fake-provider Knowledge integration exercised SQLite -> LanceDB -> managed Qdrant -> SQLite switching with no-op reconciliation. The original timeout fixture failure and subsequent Windows deep-path IO failure were reproduced and fixed; no fixture subprocesses remain. After the full suite, a cached-table deletion recovery regression was added; the six-file storage/integration selection passed all 27 tests, including externally removed LanceDB tables and native Qdrant collections.
- Generated RPC/settings freshness, release-version consistency, Markdown links, changed-file work-record coverage, and repository formatting passed.
- Verified Qdrant 1.19.1 Windows release archive SHA-256 and prepared its native executable/license. Installer assembly and Linux execution have not been verified in this task; no release version, commit, or publication was performed.
- Embedding generation uses the in-repository fake provider only; remote endpoint tests are configuration/transport tests, not live hosted-service acceptance.

##### Files

- `.gitignore`
- `apps/control-room/electron-builder.yml`
- `apps/control-room/package.json`
- `apps/control-room/scripts/verify-windows-native.cjs`
- `docs/API_REFERENCE.md`
- `docs/PLATFORM_DESIGN.md`
- `docs/RELEASE_GUIDE.md`
- `docs/SETTINGS_REFERENCE.md`
- `docs/TECHNICAL_ARCHITECTURE.md`
- `docs/USER_GUIDE.md`
- `docs/OPEN_DECISIONS.md`
- `docs/DEVELOPMENT_PLAN.md`
- `docs/STATUS.md`
- `docs/reference/rpc-schemas.json`
- `docs/reference/settings-schemas.json`
- `docs/research/vector-storage-options.md`
- `package-lock.json`
- `packages/contracts/src/knowledge/knowledge.test.ts`
- `packages/contracts/src/knowledge/schema.ts`
- `packages/platform-service/package.json`
- `packages/platform-service/src/index.ts`
- `packages/platform-service/src/knowledge/knowledge-indexer.ts`
- `packages/platform-service/src/knowledge/knowledge-service.ts`
- `packages/platform-service/src/knowledge/knowledge.integration.test.ts`
- `packages/platform-service/src/knowledge/lancedb-vector-store.ts`
- `packages/platform-service/src/knowledge/lancedb-vector-store.test.ts`
- `packages/platform-service/src/knowledge/managed-qdrant.ts`
- `packages/platform-service/src/knowledge/managed-qdrant.test.ts`
- `packages/platform-service/src/knowledge/qdrant-vector-store.integration.test.ts`
- `packages/platform-service/src/knowledge/qdrant-vector-store.test.ts`
- `packages/platform-service/src/knowledge/qdrant-vector-store.ts`
- `packages/platform-service/src/knowledge/retriever.ts`
- `packages/platform-service/src/knowledge/sqlite-vector-store.ts`
- `packages/platform-service/src/knowledge/sqlite-vector-store.test.ts`
- `packages/platform-service/src/knowledge/vector-store.ts`
- `packages/platform-service/src/knowledge/vector-store-registry.ts`
- `packages/platform-service/src/knowledge/vector-store-registry.test.ts`
- `packages/platform-service/src/service.integration.test.ts`
- `packages/platform-service/src/service.ts`
- `packages/platform-service/src/settings/definitions.ts`
- `packages/platform-service/src/settings/registry.test.ts`
- `packages/platform-service/src/projects/workspace.ts`
- `packages/platform-service/src/projects/workspace.test.ts`
- `packages/theia-control-room/src/browser/knowledge-widget.tsx`
- `packages/theia-control-room/src/browser/knowledge-widget.test.ts`
- `scripts/prepare-qdrant.cjs`
- `docs/changes/2026-10-04-vector-storage-backends.md`

### Changed

#### Streamlined navigation, discussion browsing, and Swarm hierarchy

**Impact:** minor

[Permanent work record](docs/changes/2026-10-04-navigation-and-swarm-layout.md).

##### Summary

Refined the Control Room's Project Home, Discussion Board, and Swarm layouts to make destinations, next actions, and delegated agent work easier to identify without reading every task's full details.

##### Details

- Replaced Project Home's flat workspace-tool strip and long onboarding paragraphs with four purpose-based navigation groups. All fifteen existing destinations and command IDs remain available, with concise descriptions. Contextual next steps guide users to create or open a Project without claiming engine readiness. The Projects shortcut scrolls and focuses within the page without changing Theia's workspace URL hash. Removed the Unreal-specific onboarding assumption; retained the external IDE MCP limitation note.
- Added Discussion Board quick views for all, open, question, blocker, and decision threads, explicit filter clearing, result counts, clearer empty-state guidance, compact thread metadata, and contextual next actions. Active filters now survive refreshes. Thread creation and maintenance are disclosure panels; pending synchronization counts remain visible. Existing message, binding-decision, review, archival, deletion, and maintenance operations remain available.
- Added a Project/thread selection payload to the existing Discussion Board command so Swarm's request-thread action opens the exact linked thread, including when switching Projects, rather than merely opening the board's previous selection.
- Replaced Swarm's recursively expanded task articles with a compact, collapsible agent/sub-agent hierarchy and a single selected-task inspector. The inspector retains goal, state, progress, spending, error, results, artifacts, questions, cancellation, and review controls. Selecting a task from a question/review shortcut expands its ancestor path. Each change request remains a separately selectable swarm backed by the existing service task tree; the UI does not invent live-agent instances from task records.
- Separated Swarm agents, Project approvals, integrations, and resource locks into focused views with counts. Added actionable next-step guidance and selected-request task summaries. New requests use a collapsible composer and clear the submitted text/impact preview after successful submission. Project/request changes clear stale task-selection displays.
- Added theme-aware status/selection styling, native keyboard-operable buttons/disclosures, and container-responsive layouts that stack the hierarchy and inspector or thread list and conversation on narrow surfaces. No dependency, persisted schema, RPC storage, or vector-backend changes; no migration is required. This change does not alter the concurrent vector database setup.
- Added focused widget regressions and a repeatable browser smoke script using an isolated profile/service, disposable Project, and synthetic nested `noop.echo` tasks, without model calls or user Project changes. Screenshots and the smoke report are generated under ignored `.turbo/navigation-layout-ui/`.

##### Validation

- Control Room widget tests passed: 54 tests across 15 files, including hierarchy collapse/selection, result/error inspector rendering, preserved navigation commands, Board filter retention, and request-thread selection. Control Room build, typecheck, and lint passed in the repository validation run.
- Browser and Electron development application builds completed with zero build errors. This is build evidence, not a live Electron interaction check or an installer/release.
- `node scripts/navigation-layout-ui-smoke.cjs` passed nine checks against the rebuilt browser app and real isolated platform service, with no renderer errors. Verified grouped navigation, the non-routing Project shortcut, nested-agent selection/collapse, focused section navigation, the exact request-thread link, refresh-retained Board filters, and narrow-window layout. Screenshot/report evidence: `.turbo/navigation-layout-ui/1791082035943/`. Agent execution in this fixture is synthetic; paid reasoning, live engines, decision synchronization, and every approval/integration operation were not validated by this smoke.
- `npx turbo run build typecheck lint test --output-logs=errors-only` completed successfully: 33 tasks successful, 32 cached, with the platform-service test run executing to completion. Cached results and existing environment-dependent test skips remain distinct from new live coverage. An initial run caught a Discussion Board TypeScript narrowing error during implementation; it was fixed before the successful app builds and smoke check.
- `npm run format:check`, `bash scripts/check-links.sh`, `git diff --check`, and `npm run changelog:check -- --base HEAD` passed. Refreshed the generated overview with `npm run changelog:update`.

##### Files

- `packages/theia-control-room/src/browser/project-home-widget.tsx`
- `packages/theia-control-room/src/browser/project-home-widget.test.tsx`
- `packages/theia-control-room/src/browser/discussion-board-widget.tsx`
- `packages/theia-control-room/src/browser/discussion-board-widget.test.ts`
- `packages/theia-control-room/src/browser/discussion-board-view-contribution.ts`
- `packages/theia-control-room/src/browser/swarm-widget.tsx`
- `packages/theia-control-room/src/browser/swarm-widget.test.ts`
- `packages/theia-control-room/src/browser/style/workstation.css`
- `scripts/navigation-layout-ui-smoke.cjs`
- `docs/changes/2026-10-04-navigation-and-swarm-layout.md`

#### Overhaul remaining workspace pages and Theia shell surfaces

**Impact:** minor

[Permanent work record](docs/changes/2026-10-04-workspace-interface-overhaul.md).

##### Summary

Extend the clear navigation and compact layouts from Project Home, Discussion Board, and Swarm across the remaining Control Room pages and shared built-in Theia surfaces, preserving existing operations and safety boundaries.

##### Details

- Extend the established Project Home, Discussion Board, and Swarm layout direction to Assets, Knowledge, Skills, Plugins, Engine, DCC Tools, Connections, Models, Settings, Backups, Audit, Updates, and Chat.
- Add focused section navigation, contextual next-step guidance, visible field labels, compact metadata, useful empty states, and disclosures for advanced configuration. Inactive panes stay mounted so switching sections does not discard draft fields or preview state.
- Add a grouped PlayWeld menu that links all platform destinations and the built-in IDE Settings and Open View commands without removing Theia's existing menus or keyboard shortcuts.
- Apply theme-aware treatment to built-in menu popovers, quick inputs and the command palette, dialogs, Preferences field cards, Explorer tree selection, notifications, and shared form controls. Improve project-creation prompt examples and confirmation details.
- Add Chat conversation search, draft-only conversation starters, and clearer Chat/Agent handoff guidance. Search also filters the compact conversation picker while keeping an unmatched active conversation explicitly available as the current conversation.
- Show Engine/DCC run evidence after an operation and take update checks and downloads to their result panes. Preserve existing RPC operations, permission boundaries, signature verification gates, redaction, and import previews; the vector storage and embedding backend implementation is unchanged.
- Final pre-deployment review also corrected Assets result navigation: library/job previews and successful imports reveal the Preview pane, and submitting generation reveals Jobs without clearing the generation draft. Added dedicated regression coverage for these previously hidden-result paths.
- Add a Settings regression that invokes the real search field handler and verifies that a match in another group becomes visible; preserve the existing automatic matching-group selection rather than changing working search behavior.

##### Validation

The full repository validation passed all 33 tasks, including browser and Electron builds. The Control Room suite passed 78 tests across 22 files. The browser smoke uses the rebuilt app and a real isolated platform service, exercises all 12 remaining non-Chat pages at 1600px and 650px widths, verifies enabled section navigation and accessible names for visible fields, and checks Chat draft interactions and compact conversation search.

- `npx turbo run build typecheck lint test --output-logs=errors-only`: 33 tasks passed; final run had 25 cached tasks and 8 newly executed tasks. Browser and Electron builds passed; cached and environment-dependent test skips are not additional live coverage.
- `npm test -w @gamecrafter/theia-control-room`: 22 test files and 78 tests passed, including section mounting, preserved navigation routes, update/engine/DCC result navigation, Chat draft-only starters, and filtered compact conversation selection.
- Final pre-deployment regression suite passed 82 tests across the same 22 files, adding Assets result-navigation and actual Settings search-handler coverage.
- `node scripts/workspace-overhaul-ui-smoke.cjs`: 34 checks passed with no renderer errors. Final screenshot/report evidence: `.turbo/workspace-overhaul-ui/1791084837281/`.
- `npm run format:check`, `bash scripts/check-links.sh`, `git diff --check`, and `npm run changelog:check -- --base HEAD` passed. Regenerated the overview with `npm run changelog:update`.

The same smoke verifies the grouped menu, keyboard entry into built-in Preferences, the command palette, About dialog and Explorer, cancellation of project creation, Light and High Contrast theme switching, and reduced-motion styling. It reports 34 checks with no renderer errors. Reproduction is `node scripts/workspace-overhaul-ui-smoke.cjs` after building the extension, platform service, and browser app. Its ignored report and screenshots are under `.turbo/workspace-overhaul-ui/`; inspect the latest successful `report.json` rather than older failed iteration captures.

An independent source review identified that mobile Chat search initially filtered only the hidden navigation list; the compact picker and regression coverage were corrected before the final smoke. Earlier runs also caught an Assets navigation target mismatch, an intentionally disabled plugin-details navigation control in the test harness, and reduced-motion CSS precedence; these were resolved before final validation. Browser smoke and app builds must run sequentially on Windows because the running backend holds native build output files open.

Live Electron interaction, third-party extension webviews, external model requests, engine/DCC execution, plugin installation, backup restoration, and update installation were not exercised by this UI smoke. Shared shell styling does not replace built-in IDE workflows or restyle arbitrary third-party webview contents. No claim of comprehensive accessibility certification or live external-tool integration is made.

##### Files

- `packages/theia-control-room/src/browser/assets-widget.tsx`
- `packages/theia-control-room/src/browser/assets-widget.test.tsx`
- `packages/theia-control-room/src/browser/audit-widget.tsx`
- `packages/theia-control-room/src/browser/backups-widget.tsx`
- `packages/theia-control-room/src/browser/brand-contribution.ts`
- `packages/theia-control-room/src/browser/chat-widget.tsx`
- `packages/theia-control-room/src/browser/chat-widget.test.ts`
- `packages/theia-control-room/src/browser/connections-widget.tsx`
- `packages/theia-control-room/src/browser/connections-widget.test.tsx`
- `packages/theia-control-room/src/browser/control-room-frontend-module.ts`
- `packages/theia-control-room/src/browser/create-project-command.ts`
- `packages/theia-control-room/src/browser/dcc-widget.tsx`
- `packages/theia-control-room/src/browser/dcc-widget.test.tsx`
- `packages/theia-control-room/src/browser/engine-widget.tsx`
- `packages/theia-control-room/src/browser/engine-widget.test.tsx`
- `packages/theia-control-room/src/browser/knowledge-widget.tsx`
- `packages/theia-control-room/src/browser/knowledge-widget.test.ts`
- `packages/theia-control-room/src/browser/models-widget.tsx`
- `packages/theia-control-room/src/browser/operations-pages-layout.test.tsx`
- `packages/theia-control-room/src/browser/plugins-catalog-widget.tsx`
- `packages/theia-control-room/src/browser/plugins-catalog-widget.test.tsx`
- `packages/theia-control-room/src/browser/project-home-widget.test.tsx`
- `packages/theia-control-room/src/browser/settings-widget.tsx`
- `packages/theia-control-room/src/browser/skills-widget.tsx`
- `packages/theia-control-room/src/browser/skills-widget.test.tsx`
- `packages/theia-control-room/src/browser/style/workstation.css`
- `packages/theia-control-room/src/browser/theme-contribution.ts`
- `packages/theia-control-room/src/browser/updates-widget.tsx`
- `packages/theia-control-room/src/browser/workspace-menu-contribution.ts`
- `scripts/workspace-overhaul-ui-smoke.cjs`
- `docs/changes/2026-10-04-workspace-interface-overhaul.md`

### Documentation

#### Interface Documentation and Screenshots

**Impact:** none

[Permanent work record](docs/changes/2026-10-04-interface-docs-and-images.md).

##### Summary

Updated the user/developer/operations guidance and screenshot references for the grouped PlayWeld menu, purpose-grouped Project Home, sectioned pages and expandable controls. Refreshed the overview and complete workflow screenshots from the built 0.6.0 development browser with an isolated service and deterministic local fixtures.

##### Details

- Documented the menu groups, Project Home card groups, page-specific project/section selection, disclosures, Discussion Board quick views, Swarm sections, and the current Connections, Knowledge, Assets, Plugins and Backups layouts.
- Documented Chat conversation search, starter-as-draft behavior, and the stacked narrow-window layout. The mobile-width capture is browser UI evidence only; it is not native mobile or touch acceptance.
- Repaired the capture runner for current rendered controls: explicit visible section selection, exact tab labels (distinguishing `Install` from `Installed`), current disclosure handling, per-view Project selection, current composer/connection forms, and new Chat search/starter captures.
- Captured the overview into `docs/images/lantern-workshop/` and all nine scenarios into `docs/images/lantern-workflows-2026-10-04/`. Their reports record platform/browser 0.6.0, the deterministic local Chat/agent or service fixtures, source identity, checks, and empty renderer-error lists. These captures do not establish evidence for the later 0.7.0 package, paid model behavior, or live engine/editor/installer acceptance.
- Several attempted overwrites of the legacy `docs/images/lantern-workflows/` directory encountered Windows file-write locks. Restored only those task-owned PNG changes to their original historical state and removed the task's two unused duplicate Chat PNGs from that legacy folder. The complete dated gallery is canonical; the legacy manifest is marked historical/superseded and links to that complete report.

##### Validation

- `node scripts/capture-documentation.cjs --scenario overview`: passed; 21 PNGs captured to `docs/images/lantern-workshop/`, renderer error list empty.
- `node scripts/capture-documentation.cjs --scenario all`: passed; all nine scenarios and 45 PNGs captured to `docs/images/lantern-workflows-2026-10-04/`, renderer error list empty. The report confirms local deterministic fixtures and states that no live model, paid provider or engine execution was used.
- Inspected the current Project Home, Chat search/mobile starter, agent integration, MCP logs/configuration, asset review, backup restore and plugin isolation images. The restore screenshot displays a disposable host-local path; the workflow gallery warns that paths should be inspected before reuse outside the repository.
- `npx prettier --check` on all changed Markdown, JSON and capture scripts: passed.
- `bash scripts/check-links.sh`: passed (`All links OK`).
- `node --check` on all six modified capture/scenario modules: passed.
- `node scripts/check-documentation-evidence.cjs`: the initial run was blocked at the old Home-navigation assertion (`labels.length > 0`, line 51). After the parent updated its checker/inventory for grouped navigation and the current 77 settings, the run passed: 186 RPC methods, 28 notifications, 17 setting groups/77 settings, 24 service subsystems, 16 Control Room surfaces, eight capture reports, 137 referenced PNGs, and all nine combined scenarios. It validates inventory/report/file integrity only, not screenshot content or live acceptance.
- No application rebuild, installer run, paid-provider request, live engine/editor acceptance, changelog generation, Git stage/commit, or push was performed by this work.

##### Files

- `README.md`
- `docs/README.md`
- `docs/USER_GUIDE.md`
- `docs/CONTROL_ROOM_HANDBOOK.md`
- `docs/WORKED_TUTORIAL.md`
- `docs/DOCUMENTATION_COVERAGE.md`
- `docs/DEVELOPER_GUIDE.md`
- `docs/OPERATIONS_GUIDE.md`
- `docs/INTEGRATION_GUIDE.md`
- `docs/WORKFLOW_SCREENSHOTS.md`
- `scripts/capture-documentation.cjs`
- `scripts/documentation/workflow-scenarios.cjs`
- `scripts/documentation/connection-scenario.cjs`
- `scripts/documentation/asset-scenario.cjs`
- `scripts/documentation/backup-scenario.cjs`
- `scripts/documentation/plugin-scenario.cjs`
- `docs/images/lantern-workshop/01-home.png`
- `docs/images/lantern-workshop/02-create-project.png`
- `docs/images/lantern-workshop/03-project.png`
- `docs/images/lantern-workshop/04-models.png`
- `docs/images/lantern-workshop/05-chat.png`
- `docs/images/lantern-workshop/05-chat-search.png`
- `docs/images/lantern-workshop/05-chat-mobile-starter.png`
- `docs/images/lantern-workshop/06-discussion.png`
- `docs/images/lantern-workshop/07-knowledge.png`
- `docs/images/lantern-workshop/08-settings.png`
- `docs/images/lantern-workshop/08-settings-override.png`
- `docs/images/lantern-workshop/09-skills.png`
- `docs/images/lantern-workshop/10-swarm.png`
- `docs/images/lantern-workshop/11-connections.png`
- `docs/images/lantern-workshop/12-engine.png`
- `docs/images/lantern-workshop/13-dcc.png`
- `docs/images/lantern-workshop/14-assets.png`
- `docs/images/lantern-workshop/15-plugins.png`
- `docs/images/lantern-workshop/16-backups.png`
- `docs/images/lantern-workshop/17-updates.png`
- `docs/images/lantern-workshop/18-audit.png`
- `docs/images/lantern-workshop/capture-report.json`
- `docs/images/lantern-workflows/capture-report.json`
- `docs/images/lantern-workflows-2026-10-04/01-home.png`
- `docs/images/lantern-workflows-2026-10-04/02-create-project.png`
- `docs/images/lantern-workflows-2026-10-04/03-project.png`
- `docs/images/lantern-workflows-2026-10-04/04-models.png`
- `docs/images/lantern-workflows-2026-10-04/05-chat.png`
- `docs/images/lantern-workflows-2026-10-04/05-chat-search.png`
- `docs/images/lantern-workflows-2026-10-04/05-chat-mobile-starter.png`
- `docs/images/lantern-workflows-2026-10-04/06-discussion.png`
- `docs/images/lantern-workflows-2026-10-04/07-knowledge.png`
- `docs/images/lantern-workflows-2026-10-04/08-settings-override.png`
- `docs/images/lantern-workflows-2026-10-04/08-settings.png`
- `docs/images/lantern-workflows-2026-10-04/09-skills.png`
- `docs/images/lantern-workflows-2026-10-04/10-swarm.png`
- `docs/images/lantern-workflows-2026-10-04/11-connections.png`
- `docs/images/lantern-workflows-2026-10-04/12-engine.png`
- `docs/images/lantern-workflows-2026-10-04/13-dcc.png`
- `docs/images/lantern-workflows-2026-10-04/14-assets.png`
- `docs/images/lantern-workflows-2026-10-04/15-plugins.png`
- `docs/images/lantern-workflows-2026-10-04/16-backups.png`
- `docs/images/lantern-workflows-2026-10-04/17-updates.png`
- `docs/images/lantern-workflows-2026-10-04/18-audit.png`
- `docs/images/lantern-workflows-2026-10-04/agent-approval.png`
- `docs/images/lantern-workflows-2026-10-04/agent-integrated.png`
- `docs/images/lantern-workflows-2026-10-04/agent-integration-ready.png`
- `docs/images/lantern-workflows-2026-10-04/agent-question.png`
- `docs/images/lantern-workflows-2026-10-04/asset-awaiting-review.png`
- `docs/images/lantern-workflows-2026-10-04/asset-configuration.png`
- `docs/images/lantern-workflows-2026-10-04/asset-imported.png`
- `docs/images/lantern-workflows-2026-10-04/asset-import-rejected.png`
- `docs/images/lantern-workflows-2026-10-04/backup-configuration.png`
- `docs/images/lantern-workflows-2026-10-04/backup-nonempty-target.png`
- `docs/images/lantern-workflows-2026-10-04/backup-restored.png`
- `docs/images/lantern-workflows-2026-10-04/backup-verified.png`
- `docs/images/lantern-workflows-2026-10-04/backup-wrong-secret.png`
- `docs/images/lantern-workflows-2026-10-04/decision-before-binding.png`
- `docs/images/lantern-workflows-2026-10-04/decision-synchronized.png`
- `docs/images/lantern-workflows-2026-10-04/knowledge-changed-document.png`
- `docs/images/lantern-workflows-2026-10-04/mcp-configured.png`
- `docs/images/lantern-workflows-2026-10-04/mcp-connected.png`
- `docs/images/lantern-workflows-2026-10-04/plugin-capability-review.png`
- `docs/images/lantern-workflows-2026-10-04/plugin-installed.png`
- `docs/images/lantern-workflows-2026-10-04/plugin-isolation-unavailable.png`
- `docs/images/lantern-workflows-2026-10-04/settings-import-failure.png`
- `docs/images/lantern-workflows-2026-10-04/settings-import-preview.png`
- `docs/images/lantern-workflows-2026-10-04/settings-import-result.png`
- `docs/images/lantern-workflows-2026-10-04/capture-report.json`
- `docs/changes/2026-10-04-interface-docs-and-images.md`

### Maintenance

#### Build and deploy PlayWeld 0.6.0 locally

**Impact:** none

[Permanent work record](docs/changes/2026-10-03-local-0.6.0-deployment.md).

##### Summary

Build, stage and install PlayWeld 0.6.0 over the existing local 0.5.0 installation, then verify the running desktop/service and preserved configuration. This post-commit evidence does not rewrite the committed release records or require rebuilding the completed installer.

##### Details

- User authorized committing, pushing and deploying locally. Release source committed and pushed to origin/main as `c325c8972c7db827102770616459eaa4d2d7da67`. No Git tag or GitHub release was created or published; the staging tool's tag field is the conventional version name.
- Built the Windows x64 NSIS installer in `apps/control-room/dist/0.6.0/` and staged its complete app, isolated launcher, checksum and provenance to `Windows-Release/0.6.0/`. Existing build outputs were preserved. The unrelated untracked Kilo profiles remain excluded and their hashes match the pre-release snapshot; no persistent ignore configuration changed.
- Stopped the old installed service through authenticated checkpointing and retained its SQLite profile database in the ignored local `.turbo/release-0.6.0/profile-backup/profile.sqlite`. This database backup uses the existing profile's retained credential key and is not a standalone full-profile/Project backup.
- Ran the staged installer elevated through Windows UAC, silently in the existing all-users scope and `C:\Program Files\GameCrafter` directory. Installer exited zero. Windows uninstall registration, installed application and bundled service all report 0.6.0. Existing compatibility IDs, paths, provider credentials and durable task budgets were preserved.
- Started the installed executable. Desktop title is `Project Home - vealoria - PlayWeld`; its authenticated service reports version 0.6.0 against the normal roaming profile. The selected Project was restored. No user task retry, question answer, lock override or model/pool rebuild was performed by deployment verification.
- Created this follow-up pending evidence record and refreshed the generated changelog/release notes through the existing tracking tool. No product code, dependency, data schema or released work record changed in this evidence task.

##### Validation

- Release-version quality gate passed all 33 tasks, 381 service tests with 12 capability-dependent skips, 24 tracking tests, native package verification, source/package formatting, generated-reference freshness and documentation links. See the immutable source preparation record for scope and skips.
- `npm run package:win -w @gamecrafter/control-room` passed. Verifier confirms Windows PE native addon, matching app/service version 0.6.0, thirty bundled guides/references and license/notice resources. Installer size: 204497657 bytes. SHA-256: `6ffd2f4e7c093120ee58c9b096d15d15dc214c26d227369363081ae438c6ef3c`; matches staged provenance naming the release source commit. Authenticode status: NotSigned.
- Packaged desktop smoke passed all 26 workflow checks with zero renderer errors against its own bundled service and isolated profile. Report: `.turbo/release-0.6.0-packaged-electron/1791075511981/smoke/report.json`. The owned smoke service stopped through authenticated RPC before the owned desktop process tree was closed; its persisted shutdown log confirms completion.
- Local upgrade exited zero. Installed agent-runtime, model-context, agent-tools and logger module hashes match the staged build. Read-only before/after snapshots prove identical four Project IDs, 21 model IDs/enabled states and six pool IDs/memberships. Live installed service PID 1932 reports 0.6.0; desktop PID 63440 resolves to the protected installed executable with the restored Vealoria window title. PIDs are point-in-time evidence.
- Normal-profile `logs/service.jsonl` contains the persisted 0.6.0 `service_started` record. Two initial connection attempts occurred before service startup; the subsequent authenticated check succeeded. Artifacts: `.turbo/release-0.6.0/before.json`, `after.json`, `quality.log`, `package.log`, `packaged-smoke.log` and the isolated smoke directory (all ignored local evidence).
- This verifies this machine's 0.5.0-to-0.6.0 upgrade and installed startup/configuration preservation. Uninstall, rollback, signing, Linux packages, paid-provider acceptance and other installation paths remain unverified. Existing user tasks were not automatically declared fixed/completed.

##### Files

- `docs/changes/2026-10-03-local-0.6.0-deployment.md`

#### Prepare version 0.7.0

**Impact:** none

[Permanent work record](docs/changes/2026-10-03-release-0.7.0.md).

##### Summary

Prepare version 0.7.0 from 0.6.0, retaining all pending work records in the changelog and detailed release notes.

##### Details

Synchronize first-party workspace and internal dependency versions. The lockfile must be refreshed separately. No tag, publication, or build is performed by version preparation.

##### Validation

Work-record freshness, local file coverage, version progression, and recorded impact checked before preparation. Dependency installation, refreshed lockfile verification, quality checks, packaging, signing, and live acceptance are not yet verified by this preparation record; retain their actual evidence in a follow-up work record.

##### Files

- `packages/archive-extractor/package.json`
- `packages/contracts/package.json`
- `packages/platform-service/package.json`
- `packages/plugin-sdk/package.json`
- `packages/service-client/package.json`
- `packages/theia-control-room/package.json`
- `packages/plugins/sample-hello/package.json`
- `apps/control-room/package.json`
- `apps/control-room-browser/package.json`
- `package-lock.json`

#### Align Kilo workspace tooling with PlayWeld development

**Impact:** none

[Permanent work record](docs/changes/2026-10-04-kilo-workspace-tooling.md).

##### Summary

Add a shareable Kilo workspace baseline, project-specific agent adapters, and scoped review commands without changing application code or active Agent Manager assignments.

##### Details

- Add root `kilo.json` with disabled automatic session sharing, approval-oriented shell defaults, explicit research-tool permissions, and pinned Context7. Optional Exa and Firecrawl are disabled for fresh checkouts until locally enabled with credentials supplied through the inherited process environment. No model/provider overrides or speculative plugins are added to the shared baseline.
- Pin existing machine-local MCP launchers to `@upstash/context7-mcp@4.1.1` (published 2026-09-14), `exa-mcp-server@3.4.1` (2026-08-18), and `firecrawl-mcp@3.25.5` (2026-09-25); remove the unresolved Context7 token placeholder. Keep existing local Exa/Firecrawl enablement and credentials untouched to avoid disrupting parallel sessions. Local credentials were exposed during inspection and require rotation and migration; their values are not recorded here. Ignored local settings remain machine-specific and are not shipped.
- Pin the existing ignored `opencode-models-discovery` plugin to `1.6.1` (2026-09-24), rather than implicitly selecting latest; do not install it as a shared dependency. Its documentation targets OpenCode, not Kilo; compatibility and behavior remain unverified. Built-in indexing/chat plugins and global model selections are not changed.
- Move the three existing Kilo agent names from the supported plural directory to canonical `.kilo/agent/`, removing duplicated discovery paths. Replace unrelated actor-system and blanket in-memory prohibitions with actual repository constraints. Make correctness and evidence reviewers edit-denied with approval-required shell execution; shell access is not a security sandbox. Scope the documentation writer to documentation paths.
- Add Kilo-native `design-reviewer`, `research-verifier`, `theia-implementer`, and `security-reviewer` adapters. Reuse shared procedures and existing skills rather than copying skills. Reviewer adapters deny unlisted tools and write-capable delegation; implementation inherits the session's model and permissions.
- Add `/playweld-review`, `/playweld-evidence`, `/playweld-design-check`, and `/playweld-security` as read-only review subtasks with bounded default scopes. Correct the shared implementation profile from obsolete Yarn commands to npm workspaces and add concurrent-work/handoff guidance.
- Extend repository rules with Kilo configuration ownership, skill discovery, permission precedence, prompt-injection boundaries, secret handling, evidence distinctions, and parallel worktree coordination. Ignore generated Kilo worktrees and local caches/package-manager metadata; preserve Agent Manager recovery state and active application edits.
- Kilo 7.8.3 runtime checking rejects environment references in project config even though schema validation accepts the syntax. Remove those references from the shared baseline; use inherited process environment or global config references instead. The existing global Unity entry has a legacy command shape and is absent from the MCP connection list; global settings and engine integrations are not changed or certified.
- Sources checked: [Kilo CLI reference](https://kilo.ai/docs/code-with-ai/platforms/cli-reference), [MCP configuration](https://kilo.ai/docs/automate/mcp/using-in-cli), [plugins](https://kilo.ai/docs/automate/extending/plugins), and npm metadata for the exact pinned versions. This is authoring-workspace maintenance, not a PlayWeld application feature or engine validation.

##### Validation

- Initial bundled Kilo 7.8.3 `config check` passed before the shared baseline was added. An intermediate check rejected project environment references; the configuration was corrected rather than claiming schema acceptance proved runtime compatibility.
- Runtime discovery using filtered `debug config --pure` confirmed all seven agent profiles, four command targets, disabled sharing, and the pinned MCP launch commands. `debug agent code-reviewer --pure` confirmed editing, patching, and delegation tools are unavailable. `debug skill --pure` confirmed existing project skills are discovered without duplication.
- Post-change bundled Kilo 7.8.3 `config check` reports no warnings. `mcp list --pure` connects all three exact pinned servers without loading external plugins. These connection handshakes do not verify every server tool or plugin behavior.
- `debug agent --pure` loads all seven profiles; all five read-only reviewers expose neither write, patch, nor task tools. The documentation writer and implementation agent retain scoped write capability. Filtered runtime discovery confirms the four commands target existing profiles and automatic sharing is disabled.
- Targeted Prettier formatting and freshness checks passed for shared Kilo configuration, agents, and commands; `bash scripts/check-links.sh` reports all links OK and `git diff --check` passed. `npm run changelog:update` completed. `npm run changelog:check -- --base HEAD` is blocked by other ongoing work: its first uncovered path is `apps/control-room/electron-builder.yml`, which this task did not modify. No unrelated records were manufactured to bypass that check.
- Application tests, real engine/DCC integrations, and model-discovery behavior are not verified by this configuration work. Existing local credentials need owner rotation; no global configuration or credential values are modified. Automatic shell exceptions are limited to exact Git read commands rather than wildcard Git arguments; approval and repository-script execution remain separate trust boundaries.

##### Files

- `.gitignore`
- `AGENTS.md`
- `kilo.json`
- `.agents/agents/theia-implementer.md`
- `.kilo/kilo.jsonc`
- `.kilo/opencode.json`
- `.kilo/agents/code-reviewer.md`
- `.kilo/agents/code-skeptic.md`
- `.kilo/agents/docs-specialist.md`
- `.kilo/agent/code-reviewer.md`
- `.kilo/agent/code-skeptic.md`
- `.kilo/agent/docs-specialist.md`
- `.kilo/agent/design-reviewer.md`
- `.kilo/agent/research-verifier.md`
- `.kilo/agent/theia-implementer.md`
- `.kilo/agent/security-reviewer.md`
- `.kilo/command/playweld-review.md`
- `.kilo/command/playweld-evidence.md`
- `.kilo/command/playweld-design-check.md`
- `.kilo/command/playweld-security.md`
- `docs/changes/2026-10-04-kilo-workspace-tooling.md`

#### Prepare and deploy the interface refresh locally

**Impact:** none

[Permanent work record](docs/changes/2026-10-04-local-0.7.0-deployment.md).

##### Summary

Prepare, stage and install PlayWeld 0.7.0 locally with the interface/documentation refresh, verifying the bundled desktop, installed runtime and retained profile configuration before the authorized source commit and push.

##### Details

- The user authorized updating the local installation, refreshing relevant documentation/images, and committing/pushing the changes. Upgraded the existing all-users 0.6.0 installation in `C:\Program Files\GameCrafter` to 0.7.0 for the compatible interface and vector-storage changes. Existing installers/staging destinations and the normal profile were preserved. No Git tag or GitHub release publication was performed.
- Update the reusable desktop smoke to navigate grouped Home buttons, Engine/DCC installation sections and disclosures, Settings import/export, and skill cards. Extend the Electron runner to accept a selected packaged executable with isolated profile/configuration/user-data directories, verify its own bundled service version, and stop only owned test processes.
- Wait for the isolated service lock to disappear after a packaged `service/stop` acknowledgment before terminating the owned desktop tree. The RPC acknowledgment schedules checkpointed shutdown; it is not itself evidence that shutdown is finished. A bounded timeout fails the run and still closes the owned test processes.
- Extend staging provenance with an explicit dirty-working-tree flag and hashes for changed nonignored source files. The authorized build/install-before-commit sequence must not misattribute the newly built runtime to the older base commit; later evidence edits may legitimately differ from the build-time documentation snapshot.
- Refresh the living status and release guide to distinguish historical 0.1.1/0.5.0 evidence from later verified installations. Preserve the historical acceptance record and append links to newer version-specific evidence instead of rewriting its original results.
- Regenerate the documentation surface inventory from current contracts/settings, including the previously omitted vector-store deployment and remote-access controls. Preserve generated API/settings reference freshness and honest capture-version labels.
- Correct documentation-integrity checks to read multiline grouped Home destinations and select the newest complete all-scenario report instead of assuming a single mutable gallery path. Continue checking all retained reports and referenced PNG headers, dimensions and scenario names; this is file/report integrity, not visual or provider certification.
- Before installation, use the existing SQLite seam to snapshot the normal profile database and retain a sanitized comparison of Project IDs, model IDs/enabled flags, pool memberships and settings/account/key fingerprints in ignored local artifacts. The database backup requires the retained credentials key and is not a complete profile or Project-file backup.
- Documentation and real UI screenshot refresh has its own permanent record. Generated installers, profile snapshots, runtime logs and checksums remain ignored local artifacts; they will not be included in the source commit.
- Add an opt-in, new-directory-only publication of eight actual shell/compact-Chat screenshots from the rebuilt browser smoke, with explicit version, fixture limits and capture-script provenance. These complement the main workflow gallery and are not screenshots of the normal private user profile or evidence of installed Electron interactions.

##### Validation

- The installed 0.6.0 desktop and its old service PID were not running at pre-upgrade inspection. The normal profile snapshot contains four Projects, 21 models and six pools. Before-state and database backup are under `.turbo/release-0.7.0/`.
- Snapshot verification passed SQLite integrity checking and equality with the sanitized baseline. The local comparison helper normalizes SQLite row serialization so null-prototype rows do not cause a false configuration-difference result.
- Updated development Electron smoke passed 26 live workflow checks with no renderer errors: `.turbo/documentation-electron/1791086200487/smoke/report.json`. The runner used an isolated source service for this development check; this is not yet packaged/installed verification.
- `npm run release:version -- 0.7.0` prepared the new release after ledger/coverage corrections; nine first-party workspace manifests and dependency references were synchronized. `npm install --package-lock-only --ignore-scripts` changed only those workspace versions. `node scripts/check-release-version.cjs v0.7.0` passed. No tag or public release was created.
- The lockfile-only install's audit reported 56 findings (5 low, 40 moderate, 11 high). These were not assessed or remediated in this task; no third-party dependency upgrades or audit-fix commands were run. Passing functional checks is not a security certification.
- Full version-0.7.0 quality validation passed all 33 tasks with zero cached results (`npx turbo run build typecheck lint test --output-logs=errors-only`, 5m18s). Browser and Electron builds were included.
- The fresh 0.7.0 browser smoke passed 34 checks with no renderer errors and published eight reviewed shell/compact-Chat images in `docs/images/workspace-shell-2026-10-04/`. Reproduction used `GAMECRAFTER_OVERHAUL_CAPTURE_DIR` with `scripts/workspace-overhaul-ui-smoke.cjs`; ignored detailed artifacts are `.turbo/workspace-overhaul-ui/1791090147400/`. This is real-service browser evidence, not installed desktop or external-tool acceptance.
- `npm run package:win -w @gamecrafter/control-room` completed production packaging and verified Windows drivelist, LanceDB and managed Qdrant x64 native dependencies, matching application/service 0.7.0 versions, licenses and all 30 bundled skills. `node scripts/stage-windows-release.cjs` created the new `Windows-Release/0.7.0/` destination and retained existing releases.
- Packaged Electron smoke passed 27 checks with no renderer errors using the staged executable and its own bundled 0.7.0 service: `.turbo/documentation-electron/1791090543755/`. This includes selecting a real generated fixture image and decoding its preview in the visible Preview pane. The first harness run put the fixture outside the canonical `game/assets` library; corrected the test path and reran successfully without changing or rebuilding the application artifact.
- `Get-AuthenticodeSignature` reported `NotSigned` for the actual 0.7.0 installer, consistent with packaging's skipped-signing output. This remains an unsigned local test build, not a signed/public release.
- The authorized elevated all-users NSIS installation completed with exit code 0. Windows uninstall metadata identifies PlayWeld 0.7.0 at the retained `C:\Program Files\GameCrafter` executable location. Eight selected installed runtime files, including the executable, service, compiled menu/Assets code and frontend JS/CSS bundles, matched the stage's SHA-256 values. The installed asset-preview navigation fix is present in compiled code. Ignored evidence: `.turbo/release-0.7.0/installed-package.json`.
- Launched the ordinary installed app with inherited `ELECTRON_RUN_AS_NODE` cleared. The app listened on loopback port 3020 and its normal-profile service reported version 0.7.0. Before/after comparisons matched four Project IDs, 21 model IDs/enabled flags, six pool memberships, and settings/account/credential-key fingerprints. No credential values were printed or committed. Ignored evidence: `.turbo/release-0.7.0/after.json`; the updated user app was left open.
- Installation and selected configuration preservation are verified. This is not a signed/public release, a complete uninstall/rollback test, live paid-provider acceptance, live engine/DCC execution, or comprehensive accessibility certification. Documentation/model fixtures and screenshots remain separate from the private installed profile.
- Final `npm run changelog:check -- --base HEAD --release`, documentation links, formatting, generated API/settings references, inventory freshness, release-version consistency and `git diff --check` passed. Documentation integrity checks covered 186 RPC methods, 77 settings, 16 Control Room surfaces, nine capture reports and 145 referenced PNGs, including the newest full nine-scenario report; this does not certify screenshot content or external acceptance.
- The authorized source commit/push follows these verified outcomes. Commit identity and push outcome are recorded in the final handoff rather than retroactively claimed as the pre-commit build's provenance; no signing certificate, tag, or public release is implied.

##### Files

- `scripts/live-ui-smoke.cjs`
- `scripts/verify-documentation-electron.cjs`
- `scripts/stage-windows-release.cjs`
- `scripts/workspace-overhaul-ui-smoke.cjs`
- `scripts/check-documentation-evidence.cjs`
- `docs/STATUS.md`
- `docs/RELEASE_GUIDE.md`
- `docs/RELEASE_ACCEPTANCE.md`
- `docs/CONTROL_ROOM_HANDBOOK.md`
- `docs/reference/documentation-inventory.json`
- `docs/reference/DOCUMENTATION_INVENTORY.md`
- `docs/images/workspace-shell-2026-10-04/workspace-menu.png`
- `docs/images/workspace-shell-2026-10-04/ide-settings-desktop.png`
- `docs/images/workspace-shell-2026-10-04/command-palette.png`
- `docs/images/workspace-shell-2026-10-04/about-dialog.png`
- `docs/images/workspace-shell-2026-10-04/explorer-tree.png`
- `docs/images/workspace-shell-2026-10-04/models-light.png`
- `docs/images/workspace-shell-2026-10-04/models-high-contrast.png`
- `docs/images/workspace-shell-2026-10-04/chat-narrow.png`
- `docs/images/workspace-shell-2026-10-04/capture-report.json`
- `docs/changes/2026-10-04-local-0.7.0-deployment.md`

## 0.6.0

### Changed

#### Use selected-model capacity for agent context and output

**Impact:** minor

[Permanent work record](docs/changes/2026-10-03-model-aware-agent-capacity.md).

##### Summary

Replace automatic fixed agent context/output token limits and Swarm's implicit cumulative token budget with selected-model capacity and explicit user controls.

##### Details

- User-confirmed requirement: derive model capacity settings from the selected model rather than arbitrary platform token limits. Record M10 separately from the unresolved wider metadata/spending policies, map it to WP8, and retain source-versus-installed evidence boundaries.
- Add task-bound internal model preparation. Select before checking context; reuse the same route/model metadata for compaction and completion, including resumptions. Remove legacy checkpoint output allowances and the runtime's fixed 4096-to-32768 output retry ladder. Truncated responses fail explicitly without executing partial tool calls.
- Estimate messages and tool schemas together for both compaction and final validation. Apply shared context minus requested output, independently reported input capacity, and optional explicit lower ceilings. Bound compaction fragments to this allowance, merge successive summaries, preserve pinned instructions and assistant/tool groups, allow summaries to be compacted again, and account for every compaction call against explicit budgets. Character-based estimates remain approximate; actual provider tokenization is authoritative.
- Add optional maxInputTokens to model contracts and manual metadata updates without a schema-version/storage migration. Read OpenRouter context_length/top_provider.max_completion_tokens and Anthropic max_input_tokens/max_tokens. Keep absent metadata unknown, preserve previously discovered metadata on ID-only refresh, and retain manual overrides. Provider field definitions checked 2026-10-03 against [OpenRouter Models](https://openrouter.ai/docs/api/api-reference/models/list-all-models-and-their-properties) and [Anthropic Models](https://platform.claude.com/docs/en/api/http/models).
- Unknown OpenAI-compatible capacity stays provider-managed with omitted output allowance and no artificial local context ceiling. Anthropic's mandatory output parameter fails with actionable metadata guidance if neither metadata nor an explicit request supplies it; remove the arbitrary 1024 fallback. No guessed model-name capacity table or paid discovery/completion is introduced.
- Models displays reported shared/input and output capacities, metadata provenance, and unknown/provider-managed labels. Swarm starts with a blank optional cumulative token budget. Coordinators cannot invent child token ceilings; delegation inherits an explicit parent ceiling while preserving other budget controls.
- Retain coordination.maxTranscriptTokens as a compatible settings key; default zero means automatic and a positive saved value explicitly lowers the allowance. New snapshots use contextTokenCeiling; legacy snapshot/checkpoint fixed limits no longer override selected-model capacity. Persisted task budgets and existing provider/model/pool configuration are unchanged. Existing installed 0.5.0 behavior changes only after deployment of a new build.

##### Validation

- Focused runtime/delegation/provider tests passed 33 cases, including a one-million-token model above the historical context ceiling, unknown capacities without invented output limits, legacy checkpoint resume, bounded multi-fragment compaction, explicit lower ceilings, independent provider input capacity, token-ceiling inheritance and mandatory unknown Anthropic output rejection.
- Service and Theia extension typechecks passed. Routing/approval/model/Swarm integration tests passed all seven cases; prepared completions route once and reuse the selected model.
- Isolated built-browser smoke passed six checks with no renderer errors, including reported/unknown capacity labels and a blank Swarm token-budget default. Report: `.turbo/settings-models-ui/1791072769490/report.json` (ignored local evidence). The first Swarm assertion failed because the harness had not selected a Project; the corrected harness creates/selects a disposable fixture Project. No user Project was used.
- Documentation links passed under WSL. Generated RPC/settings references were refreshed and their freshness check passed. Global format check reports only the three pre-existing untracked .kilo agent profiles; changed source formatting is clean. Changelog generation passed; coverage remains blocked by the same unrelated untracked .kilo files. Git diff whitespace check passed.
- Full `npx turbo run build typecheck lint test` passed all 33 tasks (13 cached), including Electron/browser builds and 382 passing platform-service tests with 11 capability-dependent skips across 99 files. Electron typecheck/lint/test remain configured skips. Log: `.turbo/model-capacity-full-gate.log`. The first full attempt exposed unused test-stub parameter lint errors, corrected before the passing run.
- A supplemental pending-record path audit found no uncovered task paths after excluding the separately reported unrelated .kilo profiles. This does not replace or claim a passing official global coverage gate.
- No running user tasks, locks, saved budgets, account credentials or model pools were changed. Installed deployment and paid-provider acceptance are unverified; this pending work is not a release or installer-lifecycle claim.

##### Files

- `docs/changes/2026-10-03-model-aware-agent-capacity.md`
- `docs/DEVELOPMENT_PLAN.md`
- `docs/OPEN_DECISIONS.md`
- `docs/OPERATIONS_GUIDE.md`
- `docs/PLATFORM_DESIGN.md`
- `docs/STATUS.md`
- `docs/TECHNICAL_ARCHITECTURE.md`
- `docs/API_REFERENCE.md`
- `docs/SETTINGS_REFERENCE.md`
- `docs/reference/rpc-schemas.json`
- `docs/reference/settings-schemas.json`
- `packages/contracts/src/models/schema.ts`
- `packages/contracts/src/rpc/protocol.ts`
- `packages/platform-service/roles/coordinator/ROLE.md`
- `packages/platform-service/src/agents/agent-runtime.ts`
- `packages/platform-service/src/agents/agent-runtime.test.ts`
- `packages/platform-service/src/agents/agent-tools.ts`
- `packages/platform-service/src/agents/agent-tools.test.ts`
- `packages/platform-service/src/agents/model-context.ts`
- `packages/platform-service/src/models/completion-service.ts`
- `packages/platform-service/src/models/completion-service.test.ts`
- `packages/platform-service/src/models/model-registry.ts`
- `packages/platform-service/src/models/providers/anthropic.ts`
- `packages/platform-service/src/models/providers/openai-compatible.ts`
- `packages/platform-service/src/models/providers/providers.test.ts`
- `packages/platform-service/src/settings/definitions.ts`
- `packages/platform-service/src/tasks/task-service.ts`
- `packages/theia-control-room/src/browser/models-widget.tsx`
- `packages/theia-control-room/src/browser/swarm-widget.tsx`
- `scripts/settings-models-ui-smoke.cjs`

### Fixed

#### Explain agent token and cost budget failures

**Impact:** patch

[Permanent work record](docs/changes/2026-10-03-agent-budget-failure-diagnostics.md).

##### Summary

Show the exhausted token or dollar budget and actual/limit values in agent failures, and expose task budgets in the read-only diagnostic command.

##### Details

- Live task records and per-call usage events for three failed narrative children matched exactly: 169414 against a 150000-token ceiling, 102925 against 100000, and 119742 against 100000. Reported dollar usage was zero. The observed failures do not show duplicate usage accounting; they exhausted per-task token limits that are separate from the Project's default 5 USD maximum-cost setting.
- The coordinator root had no explicit task token ceiling and failed on an estimated 60210-token request against its 60000-token input/context limit. That distinct failure must not be labeled cumulative task-budget exhaustion.
- Explain cumulative input plus output, including replayed transcript inputs, in the failure message. Distinguish token exhaustion from dollar exhaustion and carry the configured budget in the RPC error data. Numeric limits, equality behavior and enforcement timing are unchanged: the next turn is refused when recorded usage is at or above a configured ceiling, so a preceding response can overshoot it.
- Add the task budget to diagnose-agent-task.cjs next to spent totals. Document token budgets separately from response-output allowances and context limits, coordinator-supplied child ceilings, and the limitation of zero reported cost when pricing is unavailable.
- Existing installs retain their old error messages until updated. No budget was raised, disabled or changed in the live Project; no provider request or task retry was initiated. No schema or compatibility-identifier changes.

##### Validation

- Live authenticated task/event comparison matched every usage-event sum to its recorded spent total and verified all three token ceilings were exceeded.
- The focused regression first failed on the generic message and missing budget data before the fix.
- All 11 agent-runtime tests passed, including token-only exhaustion with zero cost, dollar exhaustion, and high cumulative usage without a token ceiling. The updated inspector ran against the installed service and returned the 150000-token task budget beside its 169414-token spent counter.
- Documentation links passed under WSL; script syntax and git diff whitespace checks passed. Global formatting still reports the three pre-existing untracked .kilo agent profiles; those files remain untouched.
- Full `npx turbo run build typecheck lint test` passed all 33 tasks (22 cached), including 372 passing platform-service tests with 11 capability-dependent skips and Electron/browser builds. Electron typecheck/lint/test remain configured skips. Changed runtime files pass Prettier. Changelog generation passed; the coverage check remains blocked by the pre-existing untracked .kilo agent files, outside this task's scope.

##### Files

- `docs/changes/2026-10-03-agent-budget-failure-diagnostics.md`
- `docs/OPERATIONS_GUIDE.md`
- `packages/platform-service/src/agents/agent-runtime.ts`
- `packages/platform-service/src/agents/agent-runtime.test.ts`
- `scripts/diagnose-agent-task.cjs`

#### Diagnose canon delegation and persist agent diagnostics

**Impact:** minor

[Permanent work record](docs/changes/2026-10-03-agent-tool-lock-diagnostics.md).

##### Summary

Repair discussion-board tool availability in Ask always Projects, prevent delegation blocked by the parent's locks, and add persistent service logging and read-only task diagnostics.

##### Details

- Live installed 0.5.0 service inspection identified the reported lock holder as the coordinator parent of the waiting game-designer child, rather than proving a duplicate root request. The parent owned six canon paths. The child role has file-read permissions only; its offered tool list also lacked the board tools because their minimum access gate rejected Ask always. Later narrative children received write tools but encountered missing directories and a budget failure. Private goal text and raw tool inputs are not retained in this record.
- Remove the board tools' minimum-access gate while preserving role checks, normal access policy and approval requirements for posts. Read-only roles do not gain file-write permission. Binding decisions retain their separate user-confirmation flow.
- Add a broker inspection method reporting offered tools and exclusions by internal status, Project availability, role permission or access policy. Persist an agent-tool-availability progress event at worker startup with task/worker/role/access identity, offered IDs and exclusion reasons, without prompts or file content.
- Reject delegation when declared child write touches overlap locks held by the parent. Isolated worktree file writes are exempt because they do not write the shared Project path; live/shared resources still require independent ownership. Preserve lock ownership and require explicit release rather than automatically transferring or overriding locks. Undeclared touches and locks acquired after delegation remain outside this preventive check. Clarify writer-role selection and lock ownership in the coordinator instructions.
- Add structured lock-conflict/release-denial logs identifying requesting and owning tasks/workers. CLI services persist redacted logs even when detached stderr is discarded, rotating service.jsonl at approximately 5 MiB into one previous file. Embedded services retain stderr logging; file persistence failure falls back to stderr. This bounded history is separate from audit/event retention settings.
- Preserve native tool error codes and numeric worker RPC failure codes. Clarify createDirectories for new-folder writes without changing filesystem-write defaults.
- Add scripts/diagnose-agent-task.cjs, an authenticated read-only inspector with explicit profile, Project and task selection. It reports ancestry, permissions, tool offers, current locks and failed call codes; older services fall back to existing model-call audit. It omits prompts, tool inputs/outputs, source text and tokens. Calls/events are bounded and paths/IDs can remain private.
- No schema, data-path, package-identity or product-version migration. The running installed IDE has not been replaced, restarted or hot-patched by this source change. Existing waiting tasks and other independent work are preserved.

##### Validation

- Reproduced missing board/read in a focused service integration regression before the fix; the same regression passed after removing the gate, including rejected post approval and preserved read-only file permissions.
- Five affected suites passed: 28 tests covering agent delegation, broker, model loop, worker supervisor and locks before the later logging/error-code additions.
- The task inspector ran successfully against the live installed 0.5.0 service and identified the waiting child, parent relationship, offered tools, Project Ask always mode and original -32121/-32122 audit codes. Later live checks confirmed ENOENT write failures and a budget failure.
- Full `npx turbo run build typecheck lint test` gate passed all 33 tasks (22 cached), including Electron/browser builds and 369 passing platform-service tests with 11 capability-dependent skips. Electron typecheck/lint/test remain configured skips. Later worktree-exemption and startup/shutdown logging changes passed the affected service build, typecheck, lint and three focused regression tests.
- An isolated source-built CLI service passed the task inspector check for scheduler-event offered tools/exclusion reasons and the persisted startup log. Report: `.turbo/canon-debug/source-smoke-1791064429412/report.json` (ignored local evidence). The isolated service was stopped; the user's installed IDE was unaffected. Initial smoke attempts exposed an incorrect client-path assumption in the disposable harness and the absence of a startup entry; the harness was corrected and CLI lifecycle logging added before the passing check.
- `git diff --check` and Prettier across platform-service/src passed. `npm run changelog:update` ran; the coverage check reports pre-existing untracked `.kilo/agents/code-reviewer.md` as uncovered work. These unrelated files are outside this record's scope.
- `scripts/check-links.sh` passed under WSL. Initial sandboxed Git Bash attempts lacked utilities and did not provide valid checks; the later native Git Bash scan encountered fork/resource exhaustion and was stopped. The complete WSL scan reported All links OK.
- Global formatting check currently fails on three pre-existing untracked .kilo agent profiles. Those unrelated files are preserved; changed TypeScript files have been formatted.
- Installed deployment, installer lifecycle and original canon task completion are unverified. No paid provider requests were initiated by this investigation.

##### Files

- `docs/changes/2026-10-03-agent-tool-lock-diagnostics.md`
- `docs/OPERATIONS_GUIDE.md`
- `packages/platform-service/roles/coordinator/ROLE.md`
- `packages/platform-service/src/agents/agent-tools.ts`
- `packages/platform-service/src/agents/agent-tools.test.ts`
- `packages/platform-service/src/board/board-tools.ts`
- `packages/platform-service/src/change/lock-manager.ts`
- `packages/platform-service/src/cli.ts`
- `packages/platform-service/src/cli.test.ts`
- `packages/platform-service/src/logger.ts`
- `packages/platform-service/src/logger.test.ts`
- `packages/platform-service/src/models/models.integration.test.ts`
- `packages/platform-service/src/tools/builtin-tools.ts`
- `packages/platform-service/src/tools/tool-broker.ts`
- `packages/platform-service/src/tools/tool-broker.integration.test.ts`
- `packages/platform-service/src/workers/supervisor.ts`
- `packages/platform-service/src/workers/worker-main.ts`
- `scripts/diagnose-agent-task.cjs`

### Maintenance

#### Stage and launch the PlayWeld 0.5.0 Windows installer

**Impact:** none

[Permanent work record](docs/changes/2026-10-03-installer-0.5.0-handoff.md).

##### Summary

Stage the verified PlayWeld 0.5.0 installer with committed-source provenance and launch the interactive setup wizard at the user's request. This records post-commit handoff evidence without rewriting the committed release records.

##### Details

- Release source committed and pushed to `origin/main` as `8b9106193ad356f5911d19c6d1e729d7ca806bc6`. The unrelated untracked Kilo agent files remain excluded from the commit.
- Staged the installer and complete unpacked application to `Windows-Release/0.5.0/`, retaining earlier version outputs. Generated the isolated test launcher, provenance metadata and checksum file with the existing staging tool. The installer is `Windows-Release/0.5.0/PlayWeld-0.5.0-x64.exe`.
- Rechecked the staged installer's SHA-256 against `local-build.json` and verified that metadata names the committed release source. No Git tag or GitHub release was created or published; the staging tool's tag field is its conventional version name.
- The remaining installed `GameCrafter.exe` process was the background service, with no desktop window. Used the normal authenticated service-stop command with checkpointing, which reported `stopped`; no force termination of the installed application was needed.
- Launched the staged installer with a visible interactive window. The process remained running and its window title was `PlayWeld Setup`. Installation choices and completion remain with the interactive wizard; no installed-version, upgrade/uninstall or rollback acceptance is claimed.
- No product source, package version, data schema or existing release record changed in this evidence task. This pending internal record does not require rebuilding the already staged 0.5.0 installer.

##### Validation

- `node scripts/stage-windows-release.cjs`: passed after applying the documented process-local exclusion of the three unrelated untracked Kilo agent files. Staging reverified the Windows native addon, packaged app/service version 0.5.0 and all 30 bundled skills.
- Staged installer checksum: `cefcb4691bbc3c962e711050d1de23d362c1254390c15fd54823a5a5a43bb1a1`; matches built installer and provenance metadata. Authenticode status was previously verified as `NotSigned`.
- `node packages/platform-service/lib/cli.js stop`: reported `stopped`. Installer launch succeeded; running process and visible `PlayWeld Setup` window title were verified through Windows process inspection.
- The final release documentation link check completed with `All links OK`. This evidence record adds no Markdown links. Changelog freshness, file coverage and whitespace checks are run for its handoff; product quality and packaged UI evidence remain in the committed 0.5.0 release-preparation record.

##### Files

- `docs/changes/2026-10-03-installer-0.5.0-handoff.md`

#### Prepare version 0.6.0

**Impact:** none

[Permanent work record](docs/changes/2026-10-03-release-0.6.0.md).

##### Summary

Prepare version 0.6.0 from 0.5.0, retaining all pending work records in the changelog and detailed release notes.

##### Details

Synchronize first-party workspace and internal dependency versions. The lockfile must be refreshed separately. No tag, publication, or build is performed by version preparation.

##### Validation

- Version progression, workspace/internal dependency synchronization and refreshed lockfile verification passed for 0.6.0. Lockfile refresh changed only first-party version references; no dependency versions were upgraded. Existing native dependencies were retained; npm ci was not repeated for this version-only refresh.
- Full release-version build/typecheck/lint/test gate passed all 33 tasks without cache reuse. Platform-service: 381 passed, 12 capability-dependent skips across 99 files. Electron/browser builds passed; Electron typecheck/lint/test remain configured skips. Log: `.turbo/release-0.6.0/quality.log` (ignored local evidence).
- All 24 change-tracking regression tests passed. Generated RPC/settings freshness, source/package formatting and documentation links passed. Global formatting still flags the unrelated untracked Kilo profiles. An attempted alternate ignore-file check resolved patterns relative to its artifact directory and scanned ignored outputs; it was stopped, and the normal repository ignore file with explicit packages/apps scope passed.
- Release changelog/coverage checks passed with a process-local Git exclusion limited to `.kilo/`; that independent untracked work remains unchanged and outside this release commit. No persistent ignore configuration was changed. Release notes and changelog were regenerated.
- Read-only pre-deployment snapshot verified installed service 0.5.0 with four Projects, 21 configured models and six pools. Packaging, installed deployment, signing and rollback remain unverified at this source-commit point; actual later evidence belongs in a new work record.

##### Files

- `packages/archive-extractor/package.json`
- `packages/contracts/package.json`
- `packages/platform-service/package.json`
- `packages/plugin-sdk/package.json`
- `packages/service-client/package.json`
- `packages/theia-control-room/package.json`
- `packages/plugins/sample-hello/package.json`
- `apps/control-room/package.json`
- `apps/control-room-browser/package.json`
- `package-lock.json`

## 0.5.0

### Fixed

#### Stop incomplete IPC message diagnostics retaining closed connections

**Impact:** patch

[Permanent work record](docs/changes/2026-10-02-ipc-partial-message-shutdown.md).

##### Summary

Repair service/client shutdown after an incomplete framed IPC message: the pinned JSON-RPC reader's recurring partial-message diagnostic timer could survive reader disposal and keep an otherwise cleaned-up process alive.

##### Details

- Fresh disposable native acceptance completed its map operations and cleanup but its Node process remained running. Inspection of that owned process found the JSON-RPC partial-message timeout callback as the active recurring timer.
- Reproduce with an authenticated client receiving an incomplete Content-Length frame. The regression failed before the repair with one timer left after disconnect.
- Disable unused partial-message diagnostic notifications on both service and client readers. Framing, authentication, RPC contracts, request timeouts and disconnect handling remain unchanged; neither endpoint consumes this diagnostic notification.
- Add peer-side and client-side lifecycle regressions. No schema, stored-data or package-identifier change; no migration required. Terminate only the verified owned hung acceptance process and retain its original diagnostic logs.

##### Validation

- Client incomplete-frame regression reproduced the leak before the repair; both client tests and the service peer-disconnect regression passed after it.
- Full repository build/typecheck/lint/test gate passed all 33 tasks, including 365 platform-service tests with 11 explicit capability-dependent skips. Existing workspace dependencies were reused during concurrent work.
- Fresh native Unreal map acceptance progressed through cleanup into the following Unity test stage without the prior hang. Final native results and formatting/change-record checks are recorded in the companion acceptance record.

##### Files

- `packages/service-client/src/index.ts`
- `packages/service-client/src/client.test.ts`
- `packages/platform-service/src/ipc/server.ts`
- `packages/platform-service/src/ipc/server-lifecycle.test.ts`

#### Normalize generated release-note trailing whitespace

**Impact:** none

[Permanent work record](docs/changes/2026-10-02-release-note-whitespace.md).

##### Summary

Generate release notes with one terminating newline so newly staged notes pass Git whitespace validation.

##### Details

- Final staged review caught an extra blank line at EOF in three newly generated release notes. Unstaged Git checks had not inspected these previously untracked files.
- Trim trailing document whitespace in the renderer and append one newline. Regenerate pending outputs without changing record text or release content; no previously committed historical note or released record is rewritten.
- Add a regression preparing a release in an isolated Git fixture, staging files and checking the generated note with git diff --cached --check. No runtime, schema, data, dependency or release-version change.

##### Validation

- Regression failed before correction because staged whitespace validation rejected the generated note. After correction, all 12 tracking tests passed. Regenerated release notes passed staged Git whitespace validation and changelog freshness/coverage.
- Pending notes and changelog regenerated through supported tooling; staged whitespace/freshness/coverage checked before the authorized commit.

##### Files

- `scripts/change-tracking.cjs`
- `scripts/change-tracking.test.ts`
- `docs/releases/v0.2.0.md`
- `docs/releases/v0.3.0.md`
- `docs/releases/v0.4.0.md`

#### Restore Sample Hello compatibility with the current platform

**Impact:** patch

[Permanent work record](docs/changes/2026-10-02-sample-plugin-version-compatibility.md).

##### Summary

Repair the bundled sample plugin's manifest so the current 0.4.0 platform can inspect and install it.

##### Details

- The actual Plugins UI rejected Sample Hello because its ^0.1.0 platform range excludes later pre-1.0 minor versions. Set its platform range to >=0.1.0 <1.0.0 while preserving plugin protocol 1, ID, sample version, capabilities and prior 0.1.x installation compatibility.
- Add a real installer regression using the current workspace version read from its package manifest. Existing tests using a fixed 0.1.0 service version could not catch this drift. The plugin is an SDK example; the range does not certify every future pre-1.0 runtime.
- Preserve fail-closed Windows runtime isolation. No schema/data migration or installed user-plugin rewrite; existing installed copies retain their own manifest until deliberately reinstalled.

##### Validation

- All seven PluginInstaller tests passed, including the current-version sample inspection/install and existing compatibility/capability rejection checks.
- Actual UI inspection, privilege acceptance, installation/enablement and uninstall passed after the correction. Start reports the existing unavailable Windows isolation capability; no worker/tool acceptance claimed on that host.

##### Files

- `packages/plugins/sample-hello/gamecrafter-plugin.json`
- `packages/platform-service/src/plugins/plugin-installer.test.ts`

#### Default Control Room project selectors to the restored IDE workspace

**Impact:** patch

[Permanent work record](docs/changes/2026-10-03-workspace-project-selection.md).

##### Summary

Control Room pages now select the registered Project matching the IDE workspace when opened or restored. They no longer silently default to the first registered Project, which could direct operations at another game.

##### Details

- Added shared workspace selection behavior to the Control Room widget base. Selection waits for Theia workspace readiness and reads its roots. Windows path comparison handles casing, slash differences and trailing separators; child folders select the closest registered Project. Multiple roots must identify the same Project. Empty, unknown or ambiguous workspaces remain unselected.
- Applied this behavior to Swarm, Chat, Assets, Discussion Board, Knowledge, Engine, DCC Tools, Skills and Roles, Connections, Plugins, Models, Settings, Audit and History, and Backups. Settings and Models load their scoped data after resolving the Project so the initial page content uses the correct scope.
- Explicit dropdown choices, including platform-only/all-project options, survive ordinary refreshes and page activation. A changed workspace resets the default; closing and recreating a page uses the IDE workspace again. Explicit command deep links retain their target on initial load.
- Handled overlapping constructor and activation refreshes during layout restoration. Selection reads the current field after workspace readiness and distinguishes explicit empty choices from uninitialized fields. Swarm clears project-specific requests, tasks, questions, locks, integrations, approvals, impact results and question drafts when automatic selection changes. Added an accessible label to the Backups Project selector.
- Added policy regression coverage and an isolated real-service browser smoke script. Adapted the existing Chat request-ownership fixture to model a restored Project A workspace. No persisted record, RPC, package identifier or storage schema changed; no migration is required. Version preparation and installer evidence are tracked separately in the 0.5.0 release record.
- During installer verification, updated the existing desktop/browser smoke harness to wait for project-scoped skill enablement after explicitly selecting the generated Project. Platform-only skill rows are already visible before the asynchronous Project request finishes; counting those rows alone was insufficient and caused an early checkbox assertion. Engine and DCC setup checks now explicitly select the generated Project and wait for its forms because this smoke opens the IDE workspace only at the end; it no longer relies on the unsafe first-Project fallback.

##### Validation

- `npm test -w @gamecrafter/theia-control-room`: passed after adapting the Chat workspace fixture. The final full run includes 43 Control Room tests, including nine new selection tests. Initial fixture failures were corrected; they are not outstanding failures.
- `npx turbo run build typecheck lint test`: passed, 33 successful tasks (25 cached). Includes rebuilt browser and Electron applications. Existing dependency installation was reused; `npm ci` was not rerun because no dependencies changed. Existing platform-dependent test skips remain; this is not live engine verification. Log: `.turbo/project-selection-verification.log`.
- `node scripts/project-selection-ui-smoke.cjs`: passed 17 checks using two disposable Projects, an isolated profile and the built browser app with the real platform service. All 14 selectors chose the workspace Project despite a different first registered Project; manual Swarm selection survived activation; closing/reopening and app reload restored the workspace default. No renderer errors. Report and screenshot: `.turbo/project-selection-ui/1791060010587/`. Earlier smoke setup/selector mistakes and the Models startup race were corrected before this successful run.
- `npm run format:check`: reports only three unrelated untracked Kilo agent files (`.kilo/agents/code-reviewer.md`, `.kilo/agents/code-skeptic.md`, `.kilo/agents/docs-specialist.md`). This change's source files pass formatting; those unrelated files were left untouched. `git diff --check` passed.
- `npm run changelog:update`: passed. `npm run changelog:check -- --base HEAD`: fails coverage on the same unrelated untracked Kilo agent files. Repeating that check with a process-local Git exclusion file containing exactly those three paths passes coverage and generated changelog freshness for this change. Repository ignore configuration was not modified.
- `scripts/check-links.sh`: passed with `All links OK` under WSL using an ignored temporary LF copy of the same script (`.turbo/check-links-lf.sh`) for the Windows checkout. The slower Git Bash run was interrupted before completion; the completed WSL run is the link evidence.
- The original fix verification covered Electron compilation and browser reload rather than a packaged Electron close/relaunch or installer lifecycle. Subsequent 0.5.0 installer/package checks are recorded separately in the release-preparation record.

##### Files

- `packages/theia-control-room/src/browser/workspace-project-selection.ts`
- `packages/theia-control-room/src/browser/workspace-project-selection.test.ts`
- `packages/theia-control-room/src/browser/control-room-react-widget.ts`
- `packages/theia-control-room/src/browser/assets-widget.tsx`
- `packages/theia-control-room/src/browser/audit-widget.tsx`
- `packages/theia-control-room/src/browser/backups-widget.tsx`
- `packages/theia-control-room/src/browser/chat-widget.tsx`
- `packages/theia-control-room/src/browser/chat-widget.test.ts`
- `packages/theia-control-room/src/browser/connections-widget.tsx`
- `packages/theia-control-room/src/browser/dcc-widget.tsx`
- `packages/theia-control-room/src/browser/discussion-board-widget.tsx`
- `packages/theia-control-room/src/browser/engine-widget.tsx`
- `packages/theia-control-room/src/browser/knowledge-widget.tsx`
- `packages/theia-control-room/src/browser/models-widget.tsx`
- `packages/theia-control-room/src/browser/plugins-catalog-widget.tsx`
- `packages/theia-control-room/src/browser/settings-widget.tsx`
- `packages/theia-control-room/src/browser/skills-widget.tsx`
- `packages/theia-control-room/src/browser/swarm-widget.tsx`
- `scripts/project-selection-ui-smoke.cjs`
- `scripts/live-ui-smoke.cjs`
- `docs/changes/2026-10-03-workspace-project-selection.md`

### Documentation

#### Documentation cookbooks, glossary, inventory and sourced refresh

**Impact:** none

[Permanent work record](docs/changes/2026-10-02-documentation-cookbooks-and-inventory.md).

##### Summary

Expand user, contributor and operator documentation with workflow prerequisites, state ownership, permissions, failures/recovery, examples and explicit evidence boundaries. Generate a complete service/contract/settings surface inventory linked from the existing coverage record.

##### Details

- Add user workflow and contributor extension cookbooks, glossary, annotated actual workflow screenshot guide and operations recovery procedures. Explain platform plugins, Theia extensions and engine-side editor addons as separate lifecycles.
- Generate exact names for 186 methods/25 RPC families, 28 notifications, 75 settings/17 groups, 24 service directories/test paths and declared plugin capabilities. A new unmapped family fails generation; a freshness check detects drift. This is discovery coverage, not automatic acceptance.
- Add targeted primary-source verification for MCP 2026-07-28, Agent Skills, Theia, Godot, Unity, Unreal and the OpenAI Chat reference. Mark inaccessible Anthropic/Blender documentation unverified. Older research notes are not globally refreshed or promoted into new requirements.
- Preserve design/decision/work-package authority, product/version identifiers and existing stored contracts. No migration, release, dependency or user-confirmed requirement change. Asset UI/provider acceptance, Windows isolation, external MCP editor integration and installer rollback remain explicit gaps.

##### Validation

- Generated inventory and existing system references passed freshness checks; initial documentation links passed through WSL. Final link/format/changelog checks are recorded after completion below.
- Source inspection checked role/skill roots, setting scopes, task state/error codes, plugin manifest/version checks and service recovery ownership. Runnable checks and screenshots have separate permanent records.
- Reused the shared installed dependencies; npm ci was skipped because it replaces the dependency tree used by concurrent work. No new dependency added.

- Full repository gate passed all 33 tasks; service suite passed 365 tests with 11 capability-dependent skips. Runnable capture harness regressions passed both checks; generated system references and documentation inventory passed freshness checks. Final WSL documentation links, repository format check, explicit formatting of new guides/scripts, Git whitespace check and changelog coverage/freshness all passed.

##### Files

- `docs/DOCUMENTATION_COVERAGE.md`
- `docs/EXTENSION_COOKBOOK.md`
- `docs/GLOSSARY.md`
- `docs/OPEN_DECISIONS.md`
- `docs/OPERATIONS_GUIDE.md`
- `docs/README.md`
- `docs/STATUS.md`
- `docs/WORKFLOW_COOKBOOK.md`
- `docs/WORKFLOW_SCREENSHOTS.md`
- `docs/examples/lantern-workshop/README.md`
- `docs/reference/DOCUMENTATION_INVENTORY.md`
- `docs/reference/documentation-inventory.json`
- `docs/research/documentation-standards-verification.md`
- `scripts/generate-documentation-inventory.cjs`

#### Review documentation coverage, evidence and publication readiness

**Impact:** none

[Permanent work record](docs/changes/2026-10-02-documentation-review.md).

##### Summary

Review documentation against contracts, settings, Control Room navigation, implementation and retained evidence; correct misleading wording and add repeatable integrity checks before the authorized commit/push.

##### Details

- Screenshot review caught preview text carrying into the combined agent request. Clear the input before typing and assert the durable request prefix, then recapture the combined workflows. The release-note staged-whitespace fix is recorded independently.

- Add an area-by-area review identifying guides/artifacts for implementation surfaces, with remaining live/target-system limits explicit. Preserve coverage/status/decision authority and historical capture dates.
- Correct handbook backup scope, budget guarantees, Full access boundaries and asset collision behavior. Add explicit skill/role paths and trust, bounded filesystem/context instructions, narrow compatibility retries and precise source-reviewed profile relocation.
- Add integrity tooling comparing methods/notifications/settings/source areas/navigation with inventory/handbook, and checking capture selections, timestamps, checks, renderer errors and valid PNG headers/dimensions. Counts establish file integrity, not visual quality or external acceptance.
- Add generated inventory/report checks to CI after builds and link the review from index/coverage. No new dependency, version, schema, migration or identifier change.
- Reopen four primary standards pages cited by the new research note; content remains consistent with the documented distinctions. No inaccessible-source claim promoted.
- User authorized commit/push. Include recorded pending runtime/provider/change-tracking dependencies so published guides describe matching source; preserve permanent records and ignored local evidence.

##### Validation

- After the screenshot input correction, a fresh combined browser/UI/service run passed all nine scenarios and 43 screenshots with zero renderer errors. Its report retains the current helper hash and exact run/version. Final tracking suite passed 12 tests after the separate whitespace-generator correction.

- Full repository gate passed 33/33 tasks using valid Turbo cache. Tracking regression tests passed 11 fresh cases.
- Fresh profile recovery passed five actual service/credential/index checks in isolated Windows profiles. Both capture harness checks, release version agreement and system/inventory freshness passed.
- Integrity passed 186 methods, 28 notifications, 75 settings/17 groups, 24 source areas, 16 surfaces, seven reports and 90 images, including all nine combined scenarios.
- Reused installed dependencies; npm ci skipped during shared-tree work. No new browser/Electron/engine/paid-provider/installer run claimed for wording corrections. Final links/format/records recorded below after checks.
- Final WSL documentation links passed. Repository and explicit new-guide/script formatting, Git whitespace, release version agreement (0.4.0), generated references/inventory and changelog coverage/freshness passed. The raw credential-pattern scan of docs/scripts found no matches; this is a narrow publication check, not a complete security audit.

##### Files

- `.github/workflows/ci.yml`
- `docs/DOCUMENTATION_REVIEW.md`
- `docs/README.md`
- `docs/DOCUMENTATION_COVERAGE.md`
- `docs/CONTROL_ROOM_HANDBOOK.md`
- `docs/EXTENSION_COOKBOOK.md`
- `docs/MODEL_ROUTING_GUIDE.md`
- `docs/RECOVERY_RUNBOOK.md`
- `scripts/check-documentation-evidence.cjs`
- `scripts/documentation/workflow-scenarios.cjs`
- `docs/images/lantern-workflows/01-home.png`
- `docs/images/lantern-workflows/02-create-project.png`
- `docs/images/lantern-workflows/03-project.png`
- `docs/images/lantern-workflows/04-models.png`
- `docs/images/lantern-workflows/05-chat.png`
- `docs/images/lantern-workflows/06-discussion.png`
- `docs/images/lantern-workflows/07-knowledge.png`
- `docs/images/lantern-workflows/08-settings-override.png`
- `docs/images/lantern-workflows/08-settings.png`
- `docs/images/lantern-workflows/09-skills.png`
- `docs/images/lantern-workflows/10-swarm.png`
- `docs/images/lantern-workflows/11-connections.png`
- `docs/images/lantern-workflows/12-engine.png`
- `docs/images/lantern-workflows/13-dcc.png`
- `docs/images/lantern-workflows/14-assets.png`
- `docs/images/lantern-workflows/15-plugins.png`
- `docs/images/lantern-workflows/16-backups.png`
- `docs/images/lantern-workflows/17-updates.png`
- `docs/images/lantern-workflows/18-audit.png`
- `docs/images/lantern-workflows/agent-approval.png`
- `docs/images/lantern-workflows/agent-integrated.png`
- `docs/images/lantern-workflows/agent-integration-ready.png`
- `docs/images/lantern-workflows/agent-question.png`
- `docs/images/lantern-workflows/asset-awaiting-review.png`
- `docs/images/lantern-workflows/asset-configuration.png`
- `docs/images/lantern-workflows/asset-import-rejected.png`
- `docs/images/lantern-workflows/asset-imported.png`
- `docs/images/lantern-workflows/backup-configuration.png`
- `docs/images/lantern-workflows/backup-nonempty-target.png`
- `docs/images/lantern-workflows/backup-restored.png`
- `docs/images/lantern-workflows/backup-verified.png`
- `docs/images/lantern-workflows/backup-wrong-secret.png`
- `docs/images/lantern-workflows/capture-report.json`
- `docs/images/lantern-workflows/decision-before-binding.png`
- `docs/images/lantern-workflows/decision-synchronized.png`
- `docs/images/lantern-workflows/knowledge-changed-document.png`
- `docs/images/lantern-workflows/mcp-configured.png`
- `docs/images/lantern-workflows/mcp-connected.png`
- `docs/images/lantern-workflows/plugin-capability-review.png`
- `docs/images/lantern-workflows/plugin-installed.png`
- `docs/images/lantern-workflows/plugin-isolation-unavailable.png`
- `docs/images/lantern-workflows/settings-import-failure.png`
- `docs/images/lantern-workflows/settings-import-preview.png`
- `docs/images/lantern-workflows/settings-import-result.png`

#### Model eligibility, routing and failure diagnosis guide

**Impact:** none

[Permanent work record](docs/changes/2026-10-02-model-routing-documentation.md).

##### Summary

Explain current model eligibility, pool selection and completion behavior so users can diagnose the actual request boundary without resetting unrelated account configuration.

##### Details

- Document filtering stages and NoEligibleModel stage/removedBy context, applicable role/task pool intersection, manual-model eligibility and service-owned route/outcome records.
- Explain chat capability versus streaming preference/requirement and complete-response fallback, with current source references and local UI evidence.
- Map quality/exploration/cost/latency settings to their actual implementation limits. Unknown estimates are not rejected solely for being unknown, and successful routing does not guarantee future provider billing.
- Distinguish provider response, task/broker status, worktree integration and native acceptance. Retain paid-provider and reasoning-quality gaps, and avoid claiming universal retry/failover.
- Link the guide from the existing index, workflow cookbook and coverage inventory. No external vendor behavior, public schema, stored state, version or dependency change.

##### Validation

- Fresh focused router/provider test run passed 16 tests across two files using repository fixtures; no live paid-provider request.
- Source inspection checked the route schema, filter sequence, pool rules, settings, completion service and Chat widget. Existing combined UI screenshots retain their earlier dates and synthetic-provider scope.
- Final documentation links passed through WSL. Repository and explicit guide/record formatting, generated system references/documentation inventory, Git whitespace and changelog coverage/freshness passed. The full repository gate passed all 33 tasks from valid Turbo cache during this documentation-only continuation.

##### Files

- `docs/MODEL_ROUTING_GUIDE.md`
- `docs/README.md`
- `docs/WORKFLOW_COOKBOOK.md`
- `docs/DOCUMENTATION_COVERAGE.md`

#### Executable profile recovery and diagnostic documentation

**Impact:** none

[Permanent work record](docs/changes/2026-10-02-profile-recovery-documentation.md).

##### Summary

Expand remaining operational documentation with a complete current-profile recovery drill, runnable read-only diagnostics, full index rebuild acceptance and credential recovery limits.

##### Details

- Add an explicit-profile diagnostic executable using the public service client and real read-only RPCs. Require an absolute profile path; report service/registration identity and optional index counts without credential requests. Names and paths remain visible and require review before sharing.
- Add a unique-directory recovery runner using actual service/archive operations. Reconcile/edit/rebuild a copied Lantern design and require a fresh lexical citation. Run the diagnostic as both an imported example and a real Node CLI process.
- Create and verify a local profile archive, inspect its original credential key and excluded service lifecycle files, restore separately, stop/relaunch at the restored location and verify the same Project path/ID, Restricted platform override and exact synthetic account credential.
- Demonstrate wrong-key decryption failure only in a stopped owned copy and verify that the restored key remains intact. Retain reports/archives in ignored directories; generated secrets remain absent from public reports. No external provider request or production profile mutation.
- Explain relocation versus moving game workspaces, task-returning rebuild versus completed indexing, and current-profile reopen versus old-schema compatibility. Cross-link existing operations/contributor/fixture guides and extend the existing coverage inventory.
- No public schema, identifier, dependency, release version or stored-data change. Preserve existing decision/work-package statuses; broader unresolved capabilities remain visible.

##### Validation

- Recovery drill passed all five checks on the actual Windows service, including real diagnostic CLI execution, profile archive/restore/relaunch, exact credential equality and wrong-key rejection. Passing compact report retained in the repository.
- Full build/typecheck/lint/test gate passed 33/33 tasks with all 33 results reused from valid Turbo cache; this documentation/script-only change does not claim a fresh execution of cached package tests.
- npm ci skipped because concurrent work uses the installed dependency tree. No new dependency required. No browser/Electron/native engine rerun performed for this service-only example; earlier UI/native reports retain their own scope and dates.
- Final documentation link check passed through WSL. Repository formatting and explicit formatting of the new guides/scripts/records passed; system-reference and documentation-inventory freshness, Git whitespace and changelog coverage/freshness passed. Owned recovery service processes exited after cleanup.

##### Files

- `docs/RECOVERY_RUNBOOK.md`
- `docs/README.md`
- `docs/OPERATIONS_GUIDE.md`
- `docs/EXTENSION_COOKBOOK.md`
- `docs/DOCUMENTATION_COVERAGE.md`
- `docs/examples/lantern-workshop/README.md`
- `docs/examples/lantern-workshop/verification/profile-recovery.json`
- `docs/examples/service-diagnostics.cjs`
- `scripts/verify-documentation-recovery.cjs`

#### Selectable actual UI documentation workflows

**Impact:** none

[Permanent work record](docs/changes/2026-10-02-selectable-documentation-workflows.md).

##### Summary

Extend the isolated Lantern Workshop capture runner with independently selectable agent, settings, decisions, Knowledge, backup, plugin, MCP and asset exercises and retain actual workflow/failure screenshots.

##### Details

- Keep the original overview scenario and add comma-separated selections/all with validation before startup. Use unique owned profiles/Projects/processes, synthetic local provider responses, password-only recovery inputs, and cleanup of owned processes. Retain failure screenshot, sanitized visible text and compact failure report under ignored run directories.
- Scripted agent responses exercise the actual request/runtime/question/delegation/worktree/completion/integration path; a separate Ask always tool call is approved in UI. Check coordinator success as well as child output and integration to prevent a failed root task being mislabeled as full success. Local fixture responses never become a paid-model reasoning claim.
- Settings exercises dry-run preview, apply, UI export parsing, malformed JSON rejection and reset. Decision exercises explicit user binding and generated canon document validation. Knowledge edits a source file and checks a new quoted/cited search result.
- Backup exercises UI identity/destination/run/verification, wrong-secret rejection, fresh restoration with byte comparison/new registration, and occupied-target rejection. Plugin exercises inspection/exact capability acceptance/install/enable/start diagnostic/uninstall; unavailable Windows isolation is retained as a limitation rather than bypassed.
- Reports record package version, Git base/dirty status, capture/helper hashes, selected scenarios, checks and renderer errors. Duplicate early scenario captures remain separately dated evidence; the combined report is the current cross-workflow acceptance.
- Repair harness failures: asynchronous UI/export readiness, browser predicate closure capture, expected backup error text, plugin alert selection, Godot viewport/input readiness and missing coordinator completion claim. Preserve original local failures and require passing reruns. No public API/storage change.

- Add a runnable stdio MCP server and actual UI connection/discovery, explicit classification, broker read and disconnect; observed revision 2025-11-25, no engine identity claim. Add synthetic asset submission/review/import with outside-Project rejection and exact-byte comparison; metadata-only GLB and local endpoint, no paid/artistic acceptance claim.

##### Validation

- Individual settings/decision/Knowledge, agent, backup, plugin, MCP and asset runs passed against the real browser UI/service. Combined run passed all six scenarios, 20 screenshots in the six-scenario snapshot and no renderer errors; final coordinator-success rerun recorded below.
- Native Node regression checks passed for unavailable-scenario rejection and contract-valid scripted coordinator completion. Screenshot inspection caught the earlier missing coordinator claim and verified visible binding, approval, backup errors and isolation failure.
- Original failures are retained under .turbo/documentation; public screenshots contain synthetic tutorial data and no raw credentials/recovery secret values. Paid providers, production games and publishing were not used.

- Final all-scenario rerun passed overview plus all eight expanded workflows, 43 actual UI screenshots and zero renderer errors. Coordinator and delegated task succeeded; manual integration and final workspace file were verified. The report is dated 2026-10-03 UTC / 2026-10-02 Phoenix and retains source/version identity.

##### Files

- `docs/examples/lantern-mcp/server.cjs`
- `docs/images/lantern-agent/01-home.png`
- `docs/images/lantern-agent/02-create-project.png`
- `docs/images/lantern-agent/agent-approval.png`
- `docs/images/lantern-agent/agent-integrated.png`
- `docs/images/lantern-agent/agent-integration-ready.png`
- `docs/images/lantern-agent/agent-question.png`
- `docs/images/lantern-agent/capture-report.json`
- `docs/images/lantern-assets/01-home.png`
- `docs/images/lantern-assets/02-create-project.png`
- `docs/images/lantern-assets/asset-awaiting-review.png`
- `docs/images/lantern-assets/asset-configuration.png`
- `docs/images/lantern-assets/asset-import-rejected.png`
- `docs/images/lantern-assets/asset-imported.png`
- `docs/images/lantern-assets/capture-report.json`
- `docs/images/lantern-backup/01-home.png`
- `docs/images/lantern-backup/02-create-project.png`
- `docs/images/lantern-backup/backup-configuration.png`
- `docs/images/lantern-backup/backup-nonempty-target.png`
- `docs/images/lantern-backup/backup-restored.png`
- `docs/images/lantern-backup/backup-verified.png`
- `docs/images/lantern-backup/backup-wrong-secret.png`
- `docs/images/lantern-backup/capture-report.json`
- `docs/images/lantern-mcp/01-home.png`
- `docs/images/lantern-mcp/02-create-project.png`
- `docs/images/lantern-mcp/capture-report.json`
- `docs/images/lantern-mcp/mcp-configured.png`
- `docs/images/lantern-mcp/mcp-connected.png`
- `docs/images/lantern-plugin/01-home.png`
- `docs/images/lantern-plugin/02-create-project.png`
- `docs/images/lantern-plugin/capture-report.json`
- `docs/images/lantern-plugin/plugin-capability-review.png`
- `docs/images/lantern-plugin/plugin-installed.png`
- `docs/images/lantern-plugin/plugin-isolation-unavailable.png`
- `docs/images/lantern-workflows/01-home.png`
- `docs/images/lantern-workflows/02-create-project.png`
- `docs/images/lantern-workflows/03-project.png`
- `docs/images/lantern-workflows/04-models.png`
- `docs/images/lantern-workflows/05-chat.png`
- `docs/images/lantern-workflows/06-discussion.png`
- `docs/images/lantern-workflows/07-knowledge.png`
- `docs/images/lantern-workflows/08-settings-override.png`
- `docs/images/lantern-workflows/08-settings.png`
- `docs/images/lantern-workflows/09-skills.png`
- `docs/images/lantern-workflows/10-swarm.png`
- `docs/images/lantern-workflows/11-connections.png`
- `docs/images/lantern-workflows/12-engine.png`
- `docs/images/lantern-workflows/13-dcc.png`
- `docs/images/lantern-workflows/14-assets.png`
- `docs/images/lantern-workflows/15-plugins.png`
- `docs/images/lantern-workflows/16-backups.png`
- `docs/images/lantern-workflows/17-updates.png`
- `docs/images/lantern-workflows/18-audit.png`
- `docs/images/lantern-workflows/agent-approval.png`
- `docs/images/lantern-workflows/agent-integrated.png`
- `docs/images/lantern-workflows/agent-integration-ready.png`
- `docs/images/lantern-workflows/agent-question.png`
- `docs/images/lantern-workflows/asset-awaiting-review.png`
- `docs/images/lantern-workflows/asset-configuration.png`
- `docs/images/lantern-workflows/asset-import-rejected.png`
- `docs/images/lantern-workflows/asset-imported.png`
- `docs/images/lantern-workflows/backup-configuration.png`
- `docs/images/lantern-workflows/backup-nonempty-target.png`
- `docs/images/lantern-workflows/backup-restored.png`
- `docs/images/lantern-workflows/backup-verified.png`
- `docs/images/lantern-workflows/backup-wrong-secret.png`
- `docs/images/lantern-workflows/capture-report.json`
- `docs/images/lantern-workflows/decision-before-binding.png`
- `docs/images/lantern-workflows/decision-synchronized.png`
- `docs/images/lantern-workflows/knowledge-changed-document.png`
- `docs/images/lantern-workflows/mcp-configured.png`
- `docs/images/lantern-workflows/mcp-connected.png`
- `docs/images/lantern-workflows/plugin-capability-review.png`
- `docs/images/lantern-workflows/plugin-installed.png`
- `docs/images/lantern-workflows/plugin-isolation-unavailable.png`
- `docs/images/lantern-workflows/settings-import-failure.png`
- `docs/images/lantern-workflows/settings-import-preview.png`
- `docs/images/lantern-workflows/settings-import-result.png`
- `scripts/capture-documentation.cjs`
- `scripts/documentation/asset-scenario.cjs`
- `scripts/documentation/backup-scenario.cjs`
- `scripts/documentation/capture-tools.test.cjs`
- `scripts/documentation/connection-scenario.cjs`
- `scripts/documentation/fixture-completion.cjs`
- `scripts/documentation/plugin-scenario.cjs`
- `scripts/documentation/scenario-options.cjs`
- `scripts/documentation/workflow-scenarios.cjs`

#### Worked system documentation and reusable testing Project

**Impact:** none

[Permanent work record](docs/changes/2026-10-02-worked-system-documentation.md).

##### Summary

Expand PlayWeld documentation with a worked testing Project, a handbook for every Control Room surface, service recipes, reproducible actual UI screenshots, and an explicit coverage/issue record.

##### Details

- Add Lantern Workshop tutorial with the six-step creation wizard, separate profile/layout configuration, fixture copy instructions, discussion, model/chat setup, lexical cited Knowledge search, bounded agent request example, and screenshot regeneration commands.
- Add a handbook for all sixteen surfaces, explaining inputs, records, practical use, troubleshooting, success criteria and the distinction between UI setup, task execution, integration, and acceptance. Link existing operations, architecture, API, settings, skills, integration and release detail.
- Add typed service recipes for authentication/discovery, Project creation, engine-layer inspection, lexical search and setting overrides, plus component/extension ownership and diagnostic examples.
- Add a reusable native Godot 4 source fixture and design. The fixture draws its own shapes, implements movement, three once-only collectibles, boundaries and reset. Native gameplay remains unverified; platform native-file identity is asserted. No downloaded assets, licensing obligations, credentials, identity manifests or Project databases are copied into source.
- Add a capture script that starts an isolated real service/browser backend and local explicitly labeled deterministic model provider, creates the Project through UI, verifies discussion via RPC, exercises chat, indexes/searches documents, saves/resets a setting, reads a bundled guide, previews impact and captures every surface. Capture the visible viewport of long forms. Refuse an occupied loopback port before service/UI startup to avoid connecting to an unrelated app. Provide a help-only command that does not start services or create a Project. Shut down owned resources and preserve ignored failure diagnostics. Public capture report contains no tokens/secrets/raw prompts.
- Correct user-guide claims about wizard module selection and streaming-only Chat. Add documentation-index and user-guide entry points. Correct fixture feature metadata and capture timing/input/search/impact examples during verification. Dismiss actual UI toasts for unobstructed images.
- Add coverage record with all observed corrections, remaining live verification and existing implementation gaps. All application issues/incomplete areas remain in scope under user authorization; this pass does not claim completion of the target platform or unexecuted engine/provider/installer operations.
- Compatibility: documentation/testing additions only; no public contract/schema, durable state, installed dependency, technical-identifier or release-version change; no removed functionality or migration required. Preserve other agent edits in the shared tree.

##### Validation

- Isolated capture completed 19 screenshots across all sixteen surfaces, wizard creation, native Godot file-identity assertion, persisted discussion, nonstreaming fixture chat, cited docs-only lexical retrieval, settings override/reset, bundled guide reading and path-seeded impact preview, with no uncaught renderer errors. Reviewed representative Chat, Knowledge and Engine images; viewport clipping avoids blank overflow areas. The checked-in capture report records the actual run.
- Full npx turbo run build typecheck lint test passed all 33 tasks, including both Theia app builds. Package test totals: 467 passed and 12 explicitly skipped; platform service 363 passed/11 skipped, Control Room extension 34 passed, contracts 66 passed, and the remaining four tested packages 4 passed/1 skipped. The real Godot test is skipped because no installation is available; Windows/Linux capability skips remain explicit. Real Blender fixture tests in the existing suite passed separately from this tutorial.
- npm run format:check passed. node scripts/generate-system-reference.cjs --check passed (186 requests and 75 settings). node --check scripts/capture-documentation.cjs and its --help invocation passed; explicit Prettier formatting was applied to the capture script. A bound-port failure probe confirmed EADDRINUSE is rejected before service/UI startup. scripts/check-links.sh passed through WSL with All links OK; the much slower duplicate Git Bash run was stopped after the same checker completed successfully. npm run changelog:update and npm run changelog:check -- --base HEAD passed, including regeneration/recheck after validation text updates.
- Reused installed dependencies; did not run npm ci because concurrent work uses the same dependency tree. Native Godot execution, paid generation, live model/embedding provider, backup/restore, live editor, agent implementation/integration and installer acceptance are not verified by this tutorial. No packaging or publishing performed.

##### Files

- `docs/CONTROL_ROOM_HANDBOOK.md`
- `docs/WORKED_TUTORIAL.md`
- `docs/SERVICE_RECIPES.md`
- `docs/DOCUMENTATION_COVERAGE.md`
- `docs/USER_GUIDE.md`
- `docs/README.md`
- `docs/examples/lantern-workshop/README.md`
- `docs/examples/lantern-workshop/docs/DESIGN.md`
- `docs/examples/lantern-workshop/game/project.godot`
- `docs/examples/lantern-workshop/game/main.tscn`
- `docs/examples/lantern-workshop/game/main.gd`
- `scripts/capture-documentation.cjs`
- `docs/images/lantern-workshop/01-home.png`
- `docs/images/lantern-workshop/02-create-project.png`
- `docs/images/lantern-workshop/03-project.png`
- `docs/images/lantern-workshop/04-models.png`
- `docs/images/lantern-workshop/05-chat.png`
- `docs/images/lantern-workshop/06-discussion.png`
- `docs/images/lantern-workshop/07-knowledge.png`
- `docs/images/lantern-workshop/08-settings.png`
- `docs/images/lantern-workshop/08-settings-override.png`
- `docs/images/lantern-workshop/09-skills.png`
- `docs/images/lantern-workshop/10-swarm.png`
- `docs/images/lantern-workshop/11-connections.png`
- `docs/images/lantern-workshop/12-engine.png`
- `docs/images/lantern-workshop/13-dcc.png`
- `docs/images/lantern-workshop/14-assets.png`
- `docs/images/lantern-workshop/15-plugins.png`
- `docs/images/lantern-workshop/16-backups.png`
- `docs/images/lantern-workshop/17-updates.png`
- `docs/images/lantern-workshop/18-audit.png`
- `docs/images/lantern-workshop/capture-report.json`
- `docs/changes/2026-10-02-worked-system-documentation.md`

### Maintenance

#### Reproducible native, service and desktop documentation acceptance

**Impact:** none

[Permanent work record](docs/changes/2026-10-02-documentation-native-and-desktop-verification.md).

##### Summary

Add owned disposable runners for Godot gameplay, service extension/recovery examples, Electron smoke and fresh Unity/Unreal acceptance, repairing fixture prerequisites uncovered by native runs.

##### Details

- Godot copies Lantern Workshop before import/scripted checks, records the executable version and retains logs/report. Assertions exercise collection, repeat collection, reset, movement and bounds with an initialized headless viewport and flushed input. No graphical/export/live bridge claim.
- Service examples load a synthetic Project skill/role through real registries, cancel a worker and inspect events/notifications, recover a deliberate worker crash/checkpoint, check a shared RPC error code and reopen the owned profile without losing Project/task identity. Current-profile reopen does not certify every old-schema migration.
- Electron runner starts the built desktop with isolated profile/layout/CDP ports and anti-throttling flags, invokes established smoke tooling and terminates only its owned Electron tree/service. No installed user's profile is opened.
- Unity/Unreal runner uses established native acceptance in a unique output/profile/fixture root. Extend the established runner with an optional output override preserving its default. Fresh Unreal compilation exposed an IDE Live Coding guard; add the installed UBT-supported NoHotReloadFromIDE switch for the separate fixture compilation, without stopping another editor or changing its settings.
- Fresh Unity compilation exposed missing audio/image-conversion builtin modules used by the checked-in extended fixture. Declare their built-in 1.0.0 packages in the fixture manifest so a new copied fixture has its actual prerequisites, rather than relying on previously modified local Projects. No PlayWeld npm dependency change.
- Preserve all original failures in unique ignored run directories. Keep product/version/public RPC identifiers and user data unchanged.

##### Validation

- Godot 4.7.2.stable.official.ed1daf0bf via installed WSL: version/import/gameplay passed after viewport/input harness correction. Compact report checked in; detailed logs retained locally.
- Actual service examples passed skill/role loading, cancellation/events/notifications, crash/retry, UnknownSetting error and reopen identity checks.
- Built Electron passed all 26 established UI workflow checks with no renderer errors on an isolated profile; owned process cleanup completed.
- Real Blender connector tests passed both native checks, including Python failure classification and output/asset inspection. Fresh Unity/Unreal rerun results and final repository gate recorded below; earlier Unity compile failure retained until the fixture dependency correction is validated.
- No installer, release, production-game mutation, graphical Lantern Workshop or paid-provider verification performed.

- Fresh corrected Unity/Unreal runner completed all three stages with exit code zero, including map creation, two Unreal automation tests, two Unity EditMode tests and two PlayMode tests. Missing-filter and wrong-family negative checks passed. IPC shutdown repair has its own patch record; the fresh run exits normally. Compact engine/service/Electron reports are checked in.

- Full repository gate passed all 33 tasks; service suite passed 365 tests with 11 capability-dependent skips. Runnable capture harness regressions passed both checks; generated system references and documentation inventory passed freshness checks. Final WSL documentation links, repository format check, explicit formatting of new guides/scripts, Git whitespace check and changelog coverage/freshness all passed.

##### Files

- `docs/examples/lantern-workshop/game/acceptance.gd`
- `docs/examples/lantern-workshop/native-acceptance.json`
- `docs/examples/lantern-workshop/verification/electron-smoke.json`
- `docs/examples/lantern-workshop/verification/engine-acceptance.json`
- `docs/examples/lantern-workshop/verification/service-examples.json`
- `scripts/fixtures/engine-acceptance/unity/Packages/manifest.json`
- `scripts/live-engine-acceptance.cjs`
- `scripts/verify-documentation-electron.cjs`
- `scripts/verify-documentation-engines.cjs`
- `scripts/verify-documentation-examples.cjs`
- `scripts/verify-documentation-native.cjs`

#### Prepare version 0.5.0

**Impact:** none

[Permanent work record](docs/changes/2026-10-03-release-0.5.0.md).

##### Summary

Prepare version 0.5.0 from 0.4.0, retaining all pending work records in the changelog and detailed release notes.

##### Details

Synchronize all nine first-party workspace and internal dependency versions and refresh the npm lockfile from 0.4.0 to 0.5.0. Assign the project-selection fix and previously committed pending work records to this version and generate the detailed release notes. The minor bump follows the repository's release-preparation rule before 1.0. Existing technical identifiers, user data paths and schemas remain unchanged; no migration is required.

Build the Windows x64 NSIS installer in the new versioned output directory. No previous installer or staging directory is overwritten. This task does not create or push a release tag, publish a GitHub release, or establish installer upgrade/uninstall/rollback acceptance. The user separately authorized committing, pushing and launching the new installer; post-commit staging/launch evidence will be retained in a follow-up work record.

##### Validation

- `npm install --package-lock-only --ignore-scripts` and native Windows `npm ci --foreground-scripts`: passed. Lockfile changes synchronize first-party workspace versions without selecting new third-party versions.
- `npx turbo run build typecheck lint test --concurrency=1`: passed all 33 tasks with no cache hits, including explicit browser and Electron builds; log `.turbo/release-0.5.0-quality.log`. Existing capability-dependent test skips remain.
- `npm run test:changes`: the original run passed all 24 tests. An accidentally overlapping duplicate run timed out in the push-range test while native packaging was active. An isolated rerun of that test passed both configured-project instances (two tests, 22 unrelated tests skipped), without changing timeout settings. Logs `.turbo/release-0.5.0-tracking-tests.log` and `.turbo/release-0.5.0-tracking-timeout-rerun.log`.
- Generated RPC/settings freshness and `node scripts/check-release-version.cjs v0.5.0`: passed (186 RPC requests, 75 settings).
- `npm run format:check`: only the three unrelated untracked Kilo agent files fail. This task leaves those files untouched. `git diff --check`: passed. Release coverage checks use the previously documented process-local exclusion for those exact three files, without modifying repository ignore configuration.
- Documentation link checker: passed with `All links OK` under WSL using an ignored LF copy of the repository script.
- Rebuilt 0.5.0 browser project-selection smoke: all 17 checks passed with no renderer errors; report `.turbo/project-selection-ui/1791061027875/report.json`.
- `npm run package:win -w @gamecrafter/control-room`: passed after applying the process-local Kilo exclusion. Native verification confirms the PE Windows addon, app/service version 0.5.0, all 30 bundled skills with references, and license/notice resources. Installer: `apps/control-room/dist/0.5.0/PlayWeld-0.5.0-x64.exe`, 204492096 bytes. Authenticode status `NotSigned`; SHA-256 `cefcb4691bbc3c962e711050d1de23d362c1254390c15fd54823a5a5a43bb1a1`.
- Packaged desktop smoke: all 26 workflow checks passed with no renderer errors, using the packaged executable and its own bundled service. Report: `.turbo/release-0.5.0-packaged-electron/1791061860528/smoke/report.json`; log `.turbo/release-0.5.0-packaged-smoke-complete.log`. Earlier runs exposed asynchronous Skills loading and Engine/DCC first-project assumptions in the existing smoke harness, Engine label-suffix/DCC form-selector mistakes in its adaptation, and a Windows screenshot timeout. Retained failure artifacts are under `.turbo/release-0.5.0-packaged-electron/`. The successful owned runner uses a separate profile, Theia configuration and Electron user-data directory plus software rendering; the installed user's application settings are not the test target. This is packaged-app workflow evidence, not installer acceptance or a packaged restart test of multiple project selections.
- No Linux package, signing, stable-release acceptance, installer installation/upgrade/uninstall or rollback drill is claimed by these build checks.

##### Files

- `packages/archive-extractor/package.json`
- `packages/contracts/package.json`
- `packages/platform-service/package.json`
- `packages/plugin-sdk/package.json`
- `packages/service-client/package.json`
- `packages/theia-control-room/package.json`
- `packages/plugins/sample-hello/package.json`
- `apps/control-room/package.json`
- `apps/control-room-browser/package.json`
- `package-lock.json`
- `docs/changes/2026-10-03-release-0.5.0.md`

## 0.4.0

### Fixed

#### Adapt explicit function-tool reasoning restrictions

**Impact:** patch

[Permanent work record](docs/changes/2026-10-02-function-tool-reasoning-compatibility.md).

##### Summary

Handle a second provider compatibility restriction exposed by a real gpt-6-sol function-tool request after the completion-token fix.

##### Details

The corrected service's ordinary gpt-6-sol request returned OK, but a function-tool request failed with HTTP 400: the model requires Responses or `reasoning_effort: none` for function tools on Chat Completions. Extend the shared request negotiation to set reasoning_effort to none only when a structured HTTP 400 names that parameter, function tools and the explicit supported alternative. Remember the accepted option per account, endpoint and model, applying it only to tool-bearing requests. Token-field and reasoning-field negotiations each occur at most once, in either order; the maximum is three HTTP attempts. Unrelated errors and successful streams are not replayed. The original numeric output limit is preserved.

This uses the existing Chat Completions connector. For affected function-tool requests, provider reasoning effort is disabled; it does not implement Responses or promise provider reasoning-token support for those tool requests. No persisted model capability, routing, access policy or schema changes. A fresh version is used because the 0.3.0 testing package was already staged; its installer and evidence are retained.

##### Validation

Live source-service ordinary request to gpt-6-sol returned OK (11 input tokens, 4 output tokens). The live tool request reproduced the provider's additional restriction. New regression tests reproduced that exact rejection in streamed and complete calls before the fix, then passed after the change, including reasoning rejection followed by token rejection and remembered accepted fields. All 12 provider tests passed. After the extension, a real gpt-6-sol request returned the requested probe/check tool call with value OK (160 input tokens, 30 output tokens); a follow-up carrying a tool result returned VERIFIED (218 input tokens, 5 output tokens). The probe was not dispatched to any tool implementation and changed no project files. A real deepseek-flash request still returned OK using the legacy-compatible path (34 input tokens, 12 output tokens).

Full Turbo run completed 32 of 33 tasks successfully. The platform-service suite had 362 passing tests and 11 skips, with one existing BoardService sequence test exceeding its five-second timeout while the Windows installer was also unpacking. No board source changed. Reran that entire test file and the provider suite after installation finished: all 16 tests passed. All build/typecheck/lint tasks passed; no timeout was suppressed or assertion weakened. Formatting, generated references, whitespace and repository links passed.

Packaged, staged and installed 0.4.0 after the user approved Windows UAC. Installed service/info reported 0.4.0 and retained four projects; the running daemon executable was the installed application. Its adapter hash matched the tested and staged build. The installed service returned a real gpt-6-sol probe/check call with value OK (160 input tokens, 30 output tokens), then returned VERIFIED after the actual returned call ID and tool result were carried into the follow-up (227 input tokens, 5 output tokens). No probe implementation was executed or project content changed. Reconnected the existing CFA bridge; refreshed Vealoria project-file, headless-process and live-editor readiness all reported ready. No complete new swarm authoring/delegation task was run.

##### Files

- `packages/platform-service/src/models/providers/openai-compatible.ts`
- `packages/platform-service/src/models/providers/providers.test.ts`
- `docs/changes/2026-10-02-function-tool-reasoning-compatibility.md`

### Maintenance

#### Prepare version 0.4.0

**Impact:** none

[Permanent work record](docs/changes/2026-10-02-release-0.4.0.md).

##### Summary

Prepare version 0.4.0 from 0.3.0, retaining all pending work records in the changelog and detailed release notes.

##### Details

Synchronize first-party workspace and internal dependency versions, refresh the lockfile and package a new Windows testing installer containing both provider compatibility fixes. Retain the earlier 0.3.0 testing package and notes. No tag or publication was performed.

##### Validation

- Version progression, recorded impact and work-record coverage passed before preparation. Refreshed the lockfile with `npm install --package-lock-only --ignore-scripts`; release version agreement passed for 0.4.0.
- Build/typecheck/lint passed. Full test execution and the isolated rerun of one timed-out existing board test are recorded in the function-tool compatibility record; no timeout or assertion was weakened. Formatting, generated references, whitespace and documentation links passed before preparation.
- Windows production packaging passed. The package verifier confirmed the native addon, matching service version and 30 bundled skills. Staged installer, unpacked app and checksums under `Windows-Release/0.4.0` without overwriting earlier releases.
- The packaged provider adapter hash matches the live-tested source build: `B6433E1F0753C409FD97C7D0FF224C0F2FB82AAD66256AC5FA18A99F3B13528A`. Live source-service gpt-6-sol ordinary chat, function-tool call and tool-result follow-up passed; DeepSeek legacy-compatible completion also passed.
- Checkpointed verification-service shutdown acknowledged. After the user approved Windows UAC, the final installer completed and Windows uninstall registration reported PlayWeld 0.4.0. Installed metadata and adapter hash matched the staged build; its installer checksum matched local-build.json. Reopened the installed desktop app and verified its service version 0.4.0, four retained projects and the installed daemon executable path.
- The installed service passed a real gpt-6-sol function-tool request and follow-up response after the actual tool-call ID/result, returning VERIFIED. Reconnected Vealoria's existing CFA bridge; all three engine readiness layers reported ready. The original failed tasks remain historical evidence.
- Change-record coverage passed during preparation. The final repository-wide coverage check flags the separately and concurrently added `docs/examples/lantern-workshop/docs/DESIGN.md` as uncovered. Its contents and other concurrent tutorial additions were preserved; this release record does not claim ownership or verification of that work. The provider source/test changes are covered by their own records.
- Unsigned local Windows testing build. No signing, publication, Linux packaging, full new swarm authoring task, gameplay or multiplayer acceptance was performed.

##### Files

- `packages/archive-extractor/package.json`
- `packages/contracts/package.json`
- `packages/platform-service/package.json`
- `packages/plugin-sdk/package.json`
- `packages/service-client/package.json`
- `packages/theia-control-room/package.json`
- `packages/plugins/sample-hello/package.json`
- `apps/control-room/package.json`
- `apps/control-room-browser/package.json`
- `package-lock.json`

## 0.3.0

### Fixed

#### Adapt completion token limits for OpenAI-compatible models

**Impact:** patch

[Permanent work record](docs/changes/2026-10-02-completion-token-compatibility.md).

##### Summary

Fix models rejecting `max_tokens` with an explicit request to use `max_completion_tokens`, in both streamed and complete responses.

##### Details

The installed 0.2.0 Vealoria task `01a0feda-ed96-7039-a8a0-e82239d645a5` failed with HTTP 400, `unsupported_parameter`, `param: max_tokens`. This is separate from the earlier filesystem context overflow. The shared adapter always sent the legacy field. Preserve that field for compatible servers, but retry once using the same numeric limit as `max_completion_tokens` when an HTTP 400 structured error explicitly rejects `max_tokens` and names its replacement. Remember a successfully accepted replacement per account, endpoint and model for the provider instance lifetime. Do not retry unrelated failures, transport errors or streams after consumption. No stored schema, settings, credentials, model routing or access policy changes.

OpenAI's [official SDK documentation](https://github.com/openai/openai-python/blob/main/src/openai/resources/chat/completions/completions.py) documents the newer completion limit and the legacy field's incompatibility with reasoning models. The newer limit can include reasoning tokens; the fix retains the caller's limit rather than increasing spend automatically.

##### Validation

Regression tests first reproduced the exact HTTP 400 for streaming and non-streaming calls. After the fix, both passed, including subsequent requests using the remembered parameter, unchanged messages/tools and nonduplicated stream deltas. Three additional tests confirm unrelated authentication/parameter/error-code failures receive no retry. All 10 provider tests and platform-service typecheck passed. Full Turbo verification passed all 33 tasks, including 361 passing platform-service tests and 11 skips. Formatting, generated references, diff whitespace, work-record coverage and documentation links passed. Packaged and staged 0.3.0; the adapter hash matched the tested source build. A live source-service request to the exact failed gpt-6-sol model returned OK (11 input tokens, 4 output tokens). A subsequent function-tool probe exposed a separate reasoning-effort restriction, addressed in the function-tool reasoning compatibility record and a later testing version. Ordinary completion success does not claim swarm function-tool acceptance for 0.3.0.

##### Files

- `packages/platform-service/src/models/providers/openai-compatible.ts`
- `packages/platform-service/src/models/providers/providers.test.ts`
- `docs/changes/2026-10-02-completion-token-compatibility.md`

### Maintenance

#### Prepare version 0.3.0

**Impact:** none

[Permanent work record](docs/changes/2026-10-02-release-0.3.0.md).

##### Summary

Prepare version 0.3.0 from 0.2.0, retaining all pending work records in the changelog and detailed release notes.

##### Details

Synchronize first-party workspace and internal dependency versions. Refreshed the lockfile with `npm install --package-lock-only --ignore-scripts`. Build and stage a new Windows testing installer without overwriting 0.2.0. No tag or publication was performed.

##### Validation

- Work-record freshness, changed-file coverage, version progression and recorded impact passed before preparation. Full Turbo verification passed all 33 tasks before the version-only preparation, including 361 passing platform-service tests and 11 skips. Formatting, generated references, whitespace and documentation links passed.
- Lockfile refresh completed and `node scripts/check-release-version.cjs` verified 0.3.0. Windows production packaging completed; the verifier confirmed the native addon, service version and all 30 bundled skills. Staged the installer, unpacked app and checksums under `Windows-Release/0.3.0`.
- The packaged OpenAI-compatible adapter SHA256 matches the tested source build: `8E4BC80291F19DA08B268493E9D869B4719C021BCC8A6403343BD8BD80703397`.
- The old desktop app closed and checkpointed service shutdown acknowledged. The user approved the Windows UAC prompt and the 0.3.0 installer completed. Installed metadata and adapter hash were checked. A source-service live ordinary completion returned OK from the exact failed gpt-6-sol model, but a function-tool request exposed a separate reasoning-effort restriction. The follow-up compatibility fix uses a new testing version; 0.3.0 is not claimed to resolve that additional function-tool restriction.
- This is an unsigned local Windows testing build. No signing, publication, Linux packaging, gameplay or multiplayer acceptance was performed.

##### Files

- `packages/archive-extractor/package.json`
- `packages/contracts/package.json`
- `packages/platform-service/package.json`
- `packages/plugin-sdk/package.json`
- `packages/service-client/package.json`
- `packages/theia-control-room/package.json`
- `packages/plugins/sample-hello/package.json`
- `apps/control-room/package.json`
- `apps/control-room-browser/package.json`
- `package-lock.json`

## 0.2.0

### Fixed

#### Bound swarm file discovery and agent context

**Impact:** minor

[Permanent work record](docs/changes/2026-10-02-swarm-context-bounds.md).

##### Summary

Prevent recursive file discovery and oversized tool responses from producing multi-million-character swarm model requests. Add bounded file-list pages, generated-tree filtering, checkpoint repair and a local request-size guard.

##### Details

- Live Vealoria diagnosis found the failed model request contained a single recursive `fs/list` result of 4,164,840 characters covering 29,570 entries. The two activated skill bodies were 3,889 and 4,262 characters; all fifteen offered tool definitions totalled 7,391 characters. Skill autoactivation was limited to role skills, with additional skills activated on demand. All skills were not being loaded.
- Root cause: filesystem listing recursively enumerated the entire project, including generated engine files, caches and Git metadata. Transcript compaction excluded the six most recent messages and returned without action when all messages were recent. Thus a recent multi-megabyte tool result went directly into the next provider request.
- `fs/list` now returns up to 100 entries by default, supports `limit` (1-200), `offset` (0-100000), and `includeGenerated`, and bounds each page's serialized entries to approximately 12,000 characters. It returns explicit `truncated` and `nextOffset` metadata. Recursive descent skips .git, .gamecrafter, node_modules, Intermediate, Saved, DerivedDataCache and Binaries unless requested. Directory entries remain visible; explicit paths into those directories remain readable. Pages use deterministic sorted depth-first traversal; callers should keep the path/options fixed and expect live filesystem changes to affect offsets.
- Agent transcripts store at most 16,000 characters per tool result, with an explicit truncation marker, original size, bounded preview and guidance to request narrower data. Full tool outputs remain in the broker's durable call records. Previously saved oversized tool results are bounded when resuming checkpoints, without replaying tools.
- Before every model call, estimate the complete serialized messages and tool schemas at three characters per token, including assistant tool-call arguments. Reject oversized remaining context locally with an actionable error. The estimate is conservative for ordinary prose but is not an exact provider tokenizer or a model-specific context guarantee. Large pinned inputs are rejected rather than silently discarded. Update the setting description and generated settings references.
- Compatibility: input options and response metadata are additive; entries retain their existing shape. Consumers must follow nextOffset instead of assuming a recursive response is exhaustive. No persisted record schema, RPC method or package identifier was renamed. The new pagination behavior is recorded as minor impact.

##### Validation

- Added the multi-megabyte runtime regression before the fix: second request was 4,502,376 characters and failed the 240,000-character bound. The paging regression initially failed because its new options were rejected by the old tool schema.
- Focused runtime and broker tests passed after the changes. Further runtime coverage checks legacy checkpoint recovery without replay and local rejection of oversized pinned inputs/tool schemas.
- Replayed the exact original `{path: '.', recursive: true}` operation using the compiled builtin tool against the actual Vealoria filesystem: 100 entries, 11,215 serialized characters, truncated true and nextOffset 100, with input/output schema validation.
- `npm ci --foreground-scripts` completed on native Windows. The initial full build/typecheck run caught a widened TypeScript entry type; it was corrected before rerunning. Final `npx turbo run build typecheck lint test` passed all 33 tasks, including 95 platform-service test files with 356 passing tests and 11 skips. The runtime suite passed all 8 tests. Both Theia application builds passed.
- All 11 change-tracking tests, full formatting, generated reference freshness, version agreement, diff whitespace and local changed-file coverage checks passed. Repository-wide documentation links passed in WSL Ubuntu.
- Packaged 0.2.0 successfully; the Windows verifier confirmed the native addon, matching service version and all 30 bundled skills. The packaged runtime SHA256 matched the tested source-build runtime. Replayed the actual failed Vealoria task checkpoint through the packaged runtime with an offline completion stub: the next request was 37,366 characters, with its former 4,164,840-character file result reduced to a 13,657-character explicit preview. No filesystem operation was replayed and no provider call or production task state was changed by this measurement.
- Installed and reopened PlayWeld 0.2.0. The installed service returned bounded Vealoria filesystem pages with continuation metadata and no duplicate entries between the first two pages. Its runtime hash matched the tested package. All engine readiness layers reported ready after reconnecting the existing CFA bridge. No new paid provider request was made; the original failed task was retained.

##### Files

- `packages/platform-service/src/agents/agent-runtime.ts`
- `packages/platform-service/src/agents/agent-runtime.test.ts`
- `packages/platform-service/src/tools/builtin-tools.ts`
- `packages/platform-service/src/tools/tool-broker.integration.test.ts`
- `packages/platform-service/src/settings/definitions.ts`
- `docs/SETTINGS_REFERENCE.md`
- `docs/reference/settings-schemas.json`
- `docs/changes/2026-10-02-swarm-context-bounds.md`

### Maintenance

#### Track all repository work and release details

**Impact:** none

[Permanent work record](docs/changes/2026-10-02-complete-work-tracking.md).

##### Summary

Require permanent work records for all repository changes, generate a central changelog and detailed release notes, and enforce changed-file coverage and version impact before releases.

##### Details

- Record the user's requirement in repository instructions and the design decision log. Document the workflow in the tracking contract, template, developer/release guides, documentation index, development plan and status. Cover additions, changes, removals, refactors, tests, documentation, investigations, research, dependencies, assets, configuration and reverted work.
- Introduce permanent Markdown records with summary, complete task details, exact affected paths, category, semantic version impact, and actual validation/limitations. Track deletions and both paths of renames; protect previously committed version-assigned records from edits/deletion. Reviewers remain responsible for factual and prose completeness. Include the root changelog in the documentation link checker.
- Generate the central changelog with full-record links, and collect summaries, details and validation into future version notes. Preserve earlier authored release notes and explicitly label the incomplete historical baseline, including the missing dedicated 0.1.3 note.
- Extend version preparation to check coverage/freshness, reject reused/nonadvancing versions, enforce the highest impact, assign all pending records, and create a separate record of workspace/lockfile version changes. Breaking changes before 1.0 require at least a minor bump; schema migrations remain separate. Keep version 0.1.4 while this maintenance work is pending.
- Add full-history CI file-coverage checks for PRs/pushes, tracking regression tests and generated-output freshness. Use the generated detailed note as the GitHub draft release body. Require a finalized ledger and new tracked version before desktop packaging or Windows staging. Prepared validation may be completed before commit; later evidence uses new work records.
- Add isolated Git-fixture regression coverage for untracked paths, staged/committed ranges, renames/deletions, incomplete fields, globs, stale generation, immutable history, packaging gates, impact checks, manual bypass attempts and existing tags. No new dependencies or compatibility-identifier renames are introduced. No installer, tag or release is created by this change.

##### Validation

- `npm ci --foreground-scripts` completed on native Windows. The full Turborepo build/typecheck/lint/test run passed all 33 tasks (29 reused cached results), including Electron and browser builds.
- All 11 dedicated tracking regression tests passed against isolated Git repositories. Formatting, generated RPC/settings reference freshness, release-version agreement and full local changed-file coverage checks passed.
- The complete `scripts/check-links.sh` check passed in WSL, including the central changelog. `git diff --check` passed. A real release-gate invocation correctly rejected this pending ledger before packaging.
- Hosted CI/release wiring, native Windows packaging, Linux packaging and installer lifecycle have not been run for this maintenance change.

##### Files

- `.github/workflows/ci.yml`
- `.github/workflows/release.yml`
- `AGENTS.md`
- `README.md`
- `apps/control-room/package.json`
- `docs/DEVELOPER_GUIDE.md`
- `docs/DEVELOPMENT_PLAN.md`
- `docs/PLATFORM_DESIGN.md`
- `docs/README.md`
- `docs/RELEASE_GUIDE.md`
- `docs/STATUS.md`
- `docs/changes/README.md`
- `docs/changes/TEMPLATE.md`
- `package.json`
- `scripts/set-release-version.cjs`
- `scripts/stage-windows-release.cjs`
- `scripts/change-tracking.cjs`
- `scripts/change-tracking.test.ts`
- `scripts/check-links.sh`

#### Prepare version 0.2.0

**Impact:** none

[Permanent work record](docs/changes/2026-10-02-release-0.2.0.md).

##### Summary

Prepare version 0.2.0 from 0.1.4, retaining all pending work records in the changelog and detailed release notes.

##### Details

Synchronize first-party workspace and internal dependency versions and refresh the lockfile with `npm install --package-lock-only --ignore-scripts`. Build and stage the Windows testing installer, then upgrade the existing all-users installation after the user approved Windows UAC. No tag or publication was performed.

##### Validation

- Work-record freshness, local file coverage, version progression and recorded impact passed before preparation. Native Windows `npm ci --foreground-scripts`, all 33 Turbo build/typecheck/lint/test tasks, formatting, generated references and documentation links passed for the executable changes before the version-only preparation. Version agreement and changelog coverage passed after lockfile refresh.
- `npm run package:win -w @gamecrafter/control-room` passed. The package verifier confirmed the native addon, service version 0.2.0 and all 30 bundled skills. `node scripts/stage-windows-release.cjs` staged the installer, unpacked app and checksums in `Windows-Release/0.2.0` without overwriting an existing release.
- Upgraded `C:/Program Files/GameCrafter` using the staged installer. The user approved the UAC prompt. After checkpointed service shutdown acknowledged, the old foreground daemon remained alive; its exact executable and command line were verified before stopping that process to release the old executable. Unreal Editor remained open throughout.
- Windows uninstall registration and installed app metadata report 0.2.0. The installed agent-runtime SHA256 matches the tested and packaged runtime: `5A10E854EED3818E7A2F74982002AB97C4E813DAEAD7A7ECE43B658439BC9FBE`. Reopened the installed desktop app; authenticated service/info reported 0.2.0 and retained four projects. Reconnected the existing CFA bridge and refreshed Vealoria capabilities: project-file, headless-process and live-editor all ready.
- Installed-service filesystem discovery returned 100 entries / 11,138 characters on the first page, then 95 entries / 12,122 characters, with continuation offsets 100 and 195 and no overlap. These are serialized response sizes, including pagination metadata.
- This is an unsigned local testing installer. No signing, public release, Linux package, new paid provider request, gameplay or multiplayer acceptance was performed. The original failed task remains historical evidence; offline checkpoint recovery is described in the swarm context record.

##### Files

- `packages/archive-extractor/package.json`
- `packages/contracts/package.json`
- `packages/platform-service/package.json`
- `packages/plugin-sdk/package.json`
- `packages/service-client/package.json`
- `packages/theia-control-room/package.json`
- `packages/plugins/sample-hello/package.json`
- `apps/control-room/package.json`
- `apps/control-room-browser/package.json`
- `package-lock.json`

#### Verify and configure Vealoria's live engine setup

**Impact:** none

[Permanent work record](docs/changes/2026-10-02-vealoria-engine-setup.md).

##### Summary

Verified the installed PlayWeld 0.1.4 application against the open Vealoria Unreal 5.8.3 editor, restored a working live bridge, and corrected Vealoria's GameFeatureData startup configuration error. This is local setup and investigation evidence, with no shipped PlayWeld source change.

##### Details

- Inspected the actual desktop application, service RPC responses, running editor process, project manifest, native project, engine configuration and logs. Initial live readiness was unavailable because the bound `unreal` connection was disconnected.
- Connected the existing project-scoped `cfa-unreal` MCP connection, explicitly selected Vealoria in CodeFizz, and bound it through `engine/setLiveBridge`. Refreshed project-file, headless-process and live-editor readiness all reported ready; the bridge identified the native Vealoria project path.
- Selected Vealoria in the desktop chat Project selector and opened the Engine view. Observed a separate Swarm provider context-limit failure, left unresolved within this engine setup task.
- External project file changed: `E:/GameCrafter-Dev/vealoria/game/Vealoria/Config/DefaultGame.ini`. Added the missing GameFeatureData Asset Manager rule following installed Unreal GameFeaturesEditor source defaults and applied it to the running editor default settings. Existing asset rules remain. External evidence document added: `E:/GameCrafter-Dev/vealoria/docs/ENGINE_SETUP.md`.
- Local operational changes are persisted through the platform service and CodeFizz selection; no SQLite files were edited directly. No app/engine/plugin installation, version change, removals, public contract change or migration was performed. No maps or game assets were saved.
- Initial Python reflection attempts failed without changing settings; using native reflected property names succeeded. The first DataValidation run reproduced the original startup failure; the corrected fresh process passed.

##### Validation

- Live platform-service identity and capabilities queries against the installed app: all three engine layers ready; CodeFizz MCP negotiated 2025-11-25 and exposed 15 tools.
- Live screenshot through `engine/run` and the platform broker succeeded: run `01a0feb2-8630-7dd5-8ea8-671e6436acae`, with screenshot under Vealoria's matching `.gamecrafter/engine-runs/` directory.
- Pre-correction DataValidation run `01a0feb4-c805-72e6-94f3-bd4b26d47b2b` exited 1 with the missing GameFeatureData rule. Corrected run `01a0feb5-9f2d-7fbc-a28d-209139378943` exited 0; editor.log reports 0 errors and 1 MLAdapter warning. Only one asset was validated, so this is startup/configuration evidence, not game-content coverage.
- The current map is unsaved `/Temp/Untitled_1`. Gameplay, multiplayer, builds, dedicated server, plugin update, editor restart and game-feature activation were not tested.
- `npm run changelog:update`, `npm run changelog:check -- --base HEAD`, and `npm run format:check` passed. Code build/typecheck/lint/test was skipped because no repository executable source changed.
- Ran `scripts/check-links.sh` using Git Bash; it emitted no result and was stopped after a three-minute verification limit. Repository-wide documentation link verification is incomplete. The new record introduces no Markdown links.

##### Files

- `docs/changes/2026-10-02-vealoria-engine-setup.md`

#### Save Vealoria's initial development map

**Impact:** none

[Permanent work record](docs/changes/2026-10-02-vealoria-save-development-map.md).

##### Summary

Preserve the open unsaved Vealoria landscape as a named development map and configure it as the game's default map and editor startup map.

##### Details

- Saved the current `/Temp/Untitled_1` world through CodeFizz's native `save_level_as` command as `/Game/Maps/L_Vealoria_Development`, after checking that the destination did not exist and that Vealoria was the selected running editor. This preserves the existing landscape rather than replacing it. It remains a development map, not proof of MMORPG gameplay.
- External files changed: `E:/GameCrafter-Dev/vealoria/game/Vealoria/Config/DefaultEngine.ini` and new map/World Partition asset packages under Vealoria's Content directory. The exact generated paths are retained in `E:/GameCrafter-Dev/vealoria/docs/ENGINE_SETUP_ASSETS.md`. Updated project evidence in `E:/GameCrafter-Dev/vealoria/docs/ENGINE_SETUP.md`.
- Set GameDefaultMap and EditorStartupMap to the saved development map in configuration and the running editor settings. No engine restart, asset replacement, plugin removal or multiplayer architecture decision was made. The optional MLAdapter warning remains; no neural model was invented or configured solely to suppress it.

##### Validation

- CodeFizz save command returned success. The map file exists, and subsequent live project context reported `/Game/Maps/L_Vealoria_Development` as the open map. Editor settings inspection succeeded after an initial result-formatting error; the configuration file names both saved-map defaults explicitly.
- After explicit user approval, PlayWeld DataValidation run `01a0fec6-0a4c-7637-8916-d79a96310eb7` exited 0: 3 assets and 143 associated objects were checked, with 0 errors and the existing MLAdapter warning. The native editor remained open on the saved map. Runtime gameplay, cook/package, map reopen and World Partition streaming verification remain untested.

##### Files

- `docs/changes/2026-10-02-vealoria-save-development-map.md`

## Historical baseline

Tracking starts after local version 0.1.4. Earlier notes are preserved as historical evidence, not reconstructed into a complete work ledger:

- [0.1.4: PlayWeld identity and artwork](docs/releases/v0.1.4.md).
- 0.1.3: no dedicated release-note file exists at the tracking baseline; details are incomplete.
- [0.1.2: forms, model selection, chat and layouts](docs/releases/v0.1.2.md).
- [0.1.1: testing packages and platform work](docs/releases/v0.1.1.md).

These version labels do not imply public tags or published releases.

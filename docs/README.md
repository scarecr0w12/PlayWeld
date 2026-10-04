# PlayWeld documentation

**Last updated:** 2026-10-04

PlayWeld is a local game-development workspace with a Theia desktop Control Room, a persistent platform service, model-assisted agents, and engine/DCC integrations. These guides explain the current repository. Design documents describe the complete target system; verification records identify which capabilities have actual live evidence.

**Product identity:** [PlayWeld branding and compatibility](BRANDING.md) records the name, selected domain, retained technical identifiers, and remaining identity work.

## Learn through a testing Project

Start with [Lantern Workshop: worked tutorial](WORKED_TUTORIAL.md) for project creation, reusable native/design files, a discussion, model/chat configuration, and cited Knowledge search. The [Control Room handbook](CONTROL_ROOM_HANDBOOK.md) explains every surface with screenshots, practical examples, and evidence to inspect. The [service recipes](SERVICE_RECIPES.md) connect these workflows to the local typed API and component boundaries. The [documentation coverage record](DOCUMENTATION_COVERAGE.md) lists checks, repaired documentation/fixture problems, and unverified operations.

The [reusable fixture](examples/lantern-workshop/README.md) and [capture script](../scripts/capture-documentation.cjs) keep the walkthrough reproducible. Current screenshots show the grouped PlayWeld navigation, sectioned Control Room pages, and compact Chat layout in the built development browser with a real isolated service. The chat endpoint is an explicitly labeled local fixture. The dated [workflow image set and capture report](images/lantern-workflows-2026-10-04/capture-report.json) record the 2026-10-04 browser/service 0.6.0 run and its boundaries. These captures do not establish paid-provider, native-gameplay, installer, or live-editor acceptance.

## Guides by audience

The [model routing and failure guide](MODEL_ROUTING_GUIDE.md) explains eligibility stages, applicable pool intersections, manual selection, streaming fallback, estimates/budgets and the boundary between provider, task, tool and integration failures.

The [profile recovery runbook](RECOVERY_RUNBOOK.md) adds a complete service-level recovery drill, an executable read-only diagnostic command, full index rebuild acceptance and a safe demonstration of the credential-key recovery limit. It distinguishes profile relocation from restoring the game workspace and preserves a [passing recovery report](examples/lantern-workshop/verification/profile-recovery.json).

The [workflow cookbook](WORKFLOW_COOKBOOK.md) adds agent/question/integration, binding-decision, settings transfer, asset review, indexing and native-operation exercises. The [contributor extension cookbook](EXTENSION_COOKBOOK.md) explains skills, roles, platform plugins, Theia/editor extensions, connectors, contracts, notifications and migrations. The [annotated screenshot gallery](WORKFLOW_SCREENSHOTS.md) explains actual configuration, results and recovery states. Use the [glossary](GLOSSARY.md) for shared meanings and the [generated surface inventory](reference/DOCUMENTATION_INVENTORY.md) to find every RPC family, service area and settings group. [Current standards research](research/documentation-standards-verification.md) records sources and inaccessible material explicitly.

| Reader or task                         | Start here                                            | Coverage                                                                                             |
| -------------------------------------- | ----------------------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| New user                               | [User guide](USER_GUIDE.md)                           | Setup, Projects, Control Room views, models, chat, agents, assets, knowledge, approvals              |
| System maintainer                      | [Operations guide](OPERATIONS_GUIDE.md)               | Service lifecycle, storage, credentials, backup/restore, diagnostics, release and dependency audit   |
| Contributor                            | [Developer guide](DEVELOPER_GUIDE.md)                 | Repository setup, contracts, typed client, code conventions, meaningful tests, documentation updates |
| Integration author                     | [Integration guide](INTEGRATION_GUIDE.md)             | Engine layers, MCP, DCC, skills, roles, plugin SDK, provider boundaries                              |
| Architecture reviewer                  | [System architecture](SYSTEM_ARCHITECTURE.md)         | Components, ownership, data flows, persistence, task lifecycle, trust boundaries                     |
| API consumer                           | [RPC reference](API_REFERENCE.md)                     | All 186 requests, 28 notifications, error codes, complete machine-readable schemas                   |
| Administrator configuring defaults     | [Settings reference](SETTINGS_REFERENCE.md)           | All 75 builtin settings, defaults, valid scopes, value schemas                                       |
| Game-development agent or skill author | [Game-development skills](GAME_DEVELOPMENT_SKILLS.md) | Bundled skills, domain coverage, reference loading, research and evaluation evidence                 |

## Versioned builds

The [changelog](../CHANGELOG.md) summarizes the permanent [work records](changes/README.md). Every task is tracked, including removals, docs, tests, assets and maintenance. Records retain full details, affected paths, version impact and validation; CI checks coverage and release preparation collects them into detailed notes.

See the [release and local Windows testing guide](RELEASE_GUIDE.md) for version/tag agreement, GitHub draft prereleases, checksums, package commands and isolated local test launchers. [0.1.1 testing notes](releases/v0.1.1.md) describe the contents and limitations. [Release acceptance](RELEASE_ACCEPTANCE.md) records source identity, local packaging, runtime/UI verification, and hosted publication results.

## Design authority

- [Platform design](PLATFORM_DESIGN.md) owns user-confirmed requirements and the complete product design.
- [Technical architecture](TECHNICAL_ARCHITECTURE.md) owns selected engineering defaults.
- [Skills, agents, and tools](SKILLS_AGENTS_AND_TOOLS.md) owns extension and connection contracts.
- [Decision register](OPEN_DECISIONS.md) retains decisions and verification questions in place.
- [Development plan](DEVELOPMENT_PLAN.md) is the sole authority for work-package status and dependency ordering.
- [Implementation status](STATUS.md) summarizes existing behavior and remaining work by area.
- [Repository instructions](../AGENTS.md) govern code and documentation changes.

These guides do not confirm new requirements, settle open product decisions, or expand an engine acceptance result into a guarantee for every engine version or production Project.

## Verification and research

The [documentation review](DOCUMENTATION_REVIEW.md) maps current guides to implementation surfaces and evidence, records corrected findings and preserves verification limits. Run `node scripts/check-documentation-evidence.cjs` after building to check method/setting/view coverage and retained screenshot-report integrity.

| Record                                                      | What it establishes                                                                             |
| ----------------------------------------------------------- | ----------------------------------------------------------------------------------------------- |
| [Full project review](FULL_PROJECT_REVIEW.md)               | Repaired code defects, package tests, dependency audit, remaining implementation gaps           |
| [Program review](PROGRAM_REVIEW.md)                         | Earlier native Windows UI, packaging, service, and Blender evidence                             |
| [Live engine acceptance](LIVE_ENGINE_ACCEPTANCE.md)         | Disposable Unity/Unreal Windows fixtures, tests, packaging, players and access-policy checks    |
| [Extended engine acceptance](EXTENDED_ENGINE_ACCEPTANCE.md) | Real editor identity/screenshot, rendering, audio, WebGL input and additional installed targets |
| [Research library](research/)                               | Dated, sourced engine, asset, protocol and production workflow notes                            |

On 2026-10-01, the extended acceptance record reports 33 successful repository tasks on Linux and Windows, 426 Linux tests, 414 Windows tests with 12 explicit skips, plus separate live-engine fixture results. A fixture test proves the named operation on that fixture and host. It does not certify an existing game, production frame budget, installer lifecycle, or every integration.

## Keeping documentation current

When changing behavior, update the relevant guide and evidence record. Changes to work-package or decision status also require a matching [status](STATUS.md) update. Generate RPC and settings references after building their source packages:

```bash
npm run build
node scripts/generate-system-reference.cjs
node scripts/generate-system-reference.cjs --check
bash scripts/check-links.sh
```

Generated references export the complete schemas as JSON under [reference/](reference/). They omit runtime secrets. Review links, examples, and the distinction between implemented, fixture-tested and live-verified behavior before publishing documentation.

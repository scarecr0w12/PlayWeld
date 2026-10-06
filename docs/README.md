# PlayWeld documentation

**Last updated:** 2026-10-06

Find instructions for using PlayWeld, maintaining your workspace, and contributing to the platform. Start with a task below; use the references when you need exact settings or API details.

## Start with your goal

| You want to…                                   | Start here                                                                                                                                                 |
| ---------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Install, launch, and create your first Project | [User guide](USER_GUIDE.md)                                                                                                                                |
| Follow a hands-on example                      | [Lantern Workshop tutorial](WORKED_TUTORIAL.md)                                                                                                            |
| Understand a Control Room screen               | [Control Room handbook](CONTROL_ROOM_HANDBOOK.md)                                                                                                          |
| Ask an agent to make a change                  | [Chat and agent work](USER_GUIDE.md#chat-and-agent-work) · [Workflow cookbook](WORKFLOW_COOKBOOK.md#ask-an-agent-to-make-a-change-and-inspect-integration) |
| Configure models or diagnose routing           | [Model setup](USER_GUIDE.md#configure-models-and-routing) · [Model routing guide](MODEL_ROUTING_GUIDE.md)                                                  |
| Connect an engine or external tool             | [Integration guide](INTEGRATION_GUIDE.md)                                                                                                                  |
| Apply a direct editor plugin                  | [Managed Unity, Unreal and Godot bridges](EDITOR_BRIDGE_ACCEPTANCE.md)                                                                                     |
| Connect an external IDE to PlayWeld            | [External IDE MCP and native Theia integration](EXTERNAL_IDE_INTEGRATION.md)                                                                                |
| Back up, restore, or troubleshoot              | [Operations guide](OPERATIONS_GUIDE.md) · [Profile recovery runbook](RECOVERY_RUNBOOK.md)                                                                  |
| Change PlayWeld's code or documentation        | [Developer guide](DEVELOPER_GUIDE.md)                                                                                                                      |

For terminology, use the [glossary](GLOSSARY.md). For current capabilities and known gaps, use [implementation status](STATUS.md).

## Learn through a testing Project

[Lantern Workshop](WORKED_TUTORIAL.md) walks through Project creation, native game and design files, a discussion, model/chat configuration, and cited Knowledge search. It uses a disposable Project so you can practice separately from your game.

Continue with the [workflow cookbook](WORKFLOW_COOKBOOK.md) for agent questions, approvals, decision records, settings transfer, asset review, indexing, and recovery. Use the [annotated screenshot gallery](WORKFLOW_SCREENSHOTS.md) to inspect configuration, results, and recovery states.

The [reusable fixture](examples/lantern-workshop/README.md) and [capture script](../scripts/capture-documentation.cjs) support reproducing the walkthrough. Screenshot versions and verification limits are listed under [Verification and research](#verification-and-research).

## Guides by audience

| Guide                                             | Who it helps               | What you will find                                                      |
| ------------------------------------------------- | -------------------------- | ----------------------------------------------------------------------- |
| [User guide](USER_GUIDE.md)                       | People making games        | Setup, Projects, models, chat, agents, assets, Knowledge, and approvals |
| [Control Room handbook](CONTROL_ROOM_HANDBOOK.md) | People using the interface | Screens, controls, examples, and signs of success or failure            |
| [Operations guide](OPERATIONS_GUIDE.md)           | Workspace maintainers      | Service lifecycle, storage, credentials, backups, and troubleshooting   |
| [Developer guide](DEVELOPER_GUIDE.md)             | Platform contributors      | Repository setup, code conventions, tests, and documentation updates    |
| [Integration guide](INTEGRATION_GUIDE.md)         | Integration authors        | Engines, MCP, DCC, skills, roles, plugins, and provider boundaries      |
| [System architecture](SYSTEM_ARCHITECTURE.md)     | Contributors and reviewers | Current components, data ownership, persistence, and task lifecycle     |

## Reference and advanced workflows

| Resource                                                  | Use it for                                                                        |
| --------------------------------------------------------- | --------------------------------------------------------------------------------- |
| [Settings reference](SETTINGS_REFERENCE.md)               | Setting keys, defaults, allowed scopes, and value schemas                         |
| [RPC API reference](API_REFERENCE.md)                     | Requests, notifications, error codes, and machine-readable schemas                |
| [Model routing guide](MODEL_ROUTING_GUIDE.md)             | Eligibility, pools, manual selection, fallback, budgets, and failure diagnosis    |
| [Profile recovery runbook](RECOVERY_RUNBOOK.md)           | Recovery drills, read-only diagnostics, index rebuilds, and credential-key limits |
| [Service recipes](SERVICE_RECIPES.md)                     | Worked examples using the local typed API                                         |
| [Extension cookbook](EXTENSION_COOKBOOK.md)               | Skills, roles, plugins, editor extensions, connectors, and migrations             |
| [Game-development skills](GAME_DEVELOPMENT_SKILLS.md)     | Bundled skills, domain coverage, references, and evaluation evidence              |
| [Surface inventory](reference/DOCUMENTATION_INVENTORY.md) | Finding documentation for RPC families, service areas, and settings groups        |

Generated schema files live under [reference/](reference/).

## Versioned builds

The [adversarial system review](ADVERSARIAL_SYSTEM_REVIEW.md) records current repairs, larger desktop checks, local workflows, live engine/provider results and remaining implementation/acceptance gaps.

Read the [release and local Windows testing guide](RELEASE_GUIDE.md) for testing builds, package commands, checksums, and isolated launchers. The [changelog](../CHANGELOG.md) lists pending work and recorded versions; [release notes](releases/) describe each recorded release.

[Release acceptance](RELEASE_ACCEPTANCE.md) records source identity, packaging, runtime/UI verification, and hosted publication results. Historical notes such as [0.1.1 testing notes](releases/v0.1.1.md) describe that version's contents and limitations.

Contributors must keep permanent [work records](changes/README.md) covering changes, affected files, version impact, and actual validation.

## Design authority

The user guides explain the current repository. The design documents describe the complete target system, including proposed and unverified work. Use each document for the information it owns:

| Document                                                | Authority                                                     |
| ------------------------------------------------------- | ------------------------------------------------------------- |
| [Platform design](PLATFORM_DESIGN.md)                   | User-confirmed requirements and complete product design       |
| [Technical architecture](TECHNICAL_ARCHITECTURE.md)     | Selected engineering defaults                                 |
| [Skills, agents, and tools](SKILLS_AGENTS_AND_TOOLS.md) | Extension and connection contracts                            |
| [Decision register](OPEN_DECISIONS.md)                  | Retained decisions and verification questions                 |
| [Development plan](DEVELOPMENT_PLAN.md)                 | Work-package status and technical dependency ordering         |
| [Implementation status](STATUS.md)                      | Current behavior, evidence levels, and remaining work by area |
| [Repository instructions](../AGENTS.md)                 | Rules for code and documentation contributions                |
| [Branding guide](BRANDING.md)                           | Public identity and retained compatibility identifiers        |

Only the user confirms new requirements and product decisions. Documentation edits do not change their status.

## Verification and research

Read evidence in context: repository tests, browser fixtures, live engine checks, and installer acceptance establish different things. A fixture result applies to the recorded operation, Project, version, and host.

| Record                                                                               | What it covers                                                                      |
| ------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------- |
| [Documentation coverage](DOCUMENTATION_COVERAGE.md)                                  | Walkthrough checks, repaired fixture problems, and unverified operations            |
| [Documentation review](DOCUMENTATION_REVIEW.md)                                      | Guide-to-implementation mappings, corrected findings, and verification limits       |
| [Full project review](FULL_PROJECT_REVIEW.md)                                        | Repaired defects, package tests, dependency audit, and remaining gaps               |
| [Program review](PROGRAM_REVIEW.md)                                                  | Earlier native Windows UI, packaging, service, and Blender evidence                 |
| [Live engine acceptance](LIVE_ENGINE_ACCEPTANCE.md)                                  | Disposable Unity/Unreal Windows fixtures, tests, packaging, and access checks       |
| [Extended engine acceptance](EXTENDED_ENGINE_ACCEPTANCE.md)                          | Editor identity, screenshots, rendering, audio, WebGL input, and additional targets |
| [Research library](research/)                                                        | Dated, sourced engine, asset, protocol, and production workflow notes               |
| [Documentation standards research](research/documentation-standards-verification.md) | Sources consulted and inaccessible material                                         |

The [2026-10-04 workflow capture report](images/lantern-workflows-2026-10-04/capture-report.json) records browser/service version 0.6.0. Those screenshots show grouped navigation, sectioned pages, and compact Chat in the built development browser connected to an isolated service. Chat uses a labeled local fixture. These captures do not establish paid-provider, native-gameplay, installer, or live-editor acceptance.

The [passing profile recovery report](examples/lantern-workshop/verification/profile-recovery.json) records a service-level recovery drill. The recovery runbook explains the distinction between profile relocation, restoring game files, and credential-key recovery.

## Keeping documentation current

When changing behavior, update the relevant guide and evidence record. Work-package or decision status changes also need a matching [status](STATUS.md) update. Follow the [documentation writing guidance](DEVELOPER_GUIDE.md#documentation-and-contribution-review) to keep instructions readable.

After building the source packages, generate and check the RPC/settings references:

```bash
npm run build
node scripts/generate-system-reference.cjs
node scripts/generate-system-reference.cjs --check
bash scripts/check-links.sh
```

Run `node scripts/check-documentation-evidence.cjs` to check method/setting/view coverage and retained screenshot-report integrity. This check does not assess prose quality or prove live integrations. Review examples, navigation, and capability claims as well as automated results.

# PlayWeld changelog

Generated from permanent [work records](docs/changes/README.md). Run `npm run changelog:update`; edit the records rather than this file. Release preparation assigns pending records to a version.

## Unreleased

### Added

- **Selectable embedded and managed vector storage** (minor): Add embedded LanceDB and SQLite exact vector storage, managed native Qdrant, and explicit existing-local/remote Qdrant configurations behind a backend-neutral storage boundary. [Full details and validation](docs/changes/2026-10-04-vector-storage-backends.md).

### Changed

- **Streamlined navigation, discussion browsing, and Swarm hierarchy** (minor): Refined the Control Room's Project Home, Discussion Board, and Swarm layouts to make destinations, next actions, and delegated agent work easier to identify without reading every task's full details. [Full details and validation](docs/changes/2026-10-04-navigation-and-swarm-layout.md).

### Maintenance

- **Build and deploy PlayWeld 0.6.0 locally** (none): Build, stage and install PlayWeld 0.6.0 over the existing local 0.5.0 installation, then verify the running desktop/service and preserved configuration. This post-commit evidence does not rewrite the committed release records or require rebuilding the completed installer. [Full details and validation](docs/changes/2026-10-03-local-0.6.0-deployment.md).
- **Align Kilo workspace tooling with PlayWeld development** (none): Add a shareable Kilo workspace baseline, project-specific agent adapters, and scoped review commands without changing application code or active Agent Manager assignments. [Full details and validation](docs/changes/2026-10-04-kilo-workspace-tooling.md).

## 0.6.0

### Changed

- **Use selected-model capacity for agent context and output** (minor): Replace automatic fixed agent context/output token limits and Swarm's implicit cumulative token budget with selected-model capacity and explicit user controls. [Full details and validation](docs/changes/2026-10-03-model-aware-agent-capacity.md).

### Fixed

- **Explain agent token and cost budget failures** (patch): Show the exhausted token or dollar budget and actual/limit values in agent failures, and expose task budgets in the read-only diagnostic command. [Full details and validation](docs/changes/2026-10-03-agent-budget-failure-diagnostics.md).
- **Diagnose canon delegation and persist agent diagnostics** (minor): Repair discussion-board tool availability in Ask always Projects, prevent delegation blocked by the parent's locks, and add persistent service logging and read-only task diagnostics. [Full details and validation](docs/changes/2026-10-03-agent-tool-lock-diagnostics.md).

### Maintenance

- **Stage and launch the PlayWeld 0.5.0 Windows installer** (none): Stage the verified PlayWeld 0.5.0 installer with committed-source provenance and launch the interactive setup wizard at the user's request. This records post-commit handoff evidence without rewriting the committed release records. [Full details and validation](docs/changes/2026-10-03-installer-0.5.0-handoff.md).
- **Prepare version 0.6.0** (none): Prepare version 0.6.0 from 0.5.0, retaining all pending work records in the changelog and detailed release notes. [Full details and validation](docs/changes/2026-10-03-release-0.6.0.md).

## 0.5.0

### Fixed

- **Stop incomplete IPC message diagnostics retaining closed connections** (patch): Repair service/client shutdown after an incomplete framed IPC message: the pinned JSON-RPC reader's recurring partial-message diagnostic timer could survive reader disposal and keep an otherwise cleaned-up process alive. [Full details and validation](docs/changes/2026-10-02-ipc-partial-message-shutdown.md).
- **Normalize generated release-note trailing whitespace** (none): Generate release notes with one terminating newline so newly staged notes pass Git whitespace validation. [Full details and validation](docs/changes/2026-10-02-release-note-whitespace.md).
- **Restore Sample Hello compatibility with the current platform** (patch): Repair the bundled sample plugin's manifest so the current 0.4.0 platform can inspect and install it. [Full details and validation](docs/changes/2026-10-02-sample-plugin-version-compatibility.md).
- **Default Control Room project selectors to the restored IDE workspace** (patch): Control Room pages now select the registered Project matching the IDE workspace when opened or restored. They no longer silently default to the first registered Project, which could direct operations at another game. [Full details and validation](docs/changes/2026-10-03-workspace-project-selection.md).

### Documentation

- **Documentation cookbooks, glossary, inventory and sourced refresh** (none): Expand user, contributor and operator documentation with workflow prerequisites, state ownership, permissions, failures/recovery, examples and explicit evidence boundaries. Generate a complete service/contract/settings surface inventory linked from the existing coverage record. [Full details and validation](docs/changes/2026-10-02-documentation-cookbooks-and-inventory.md).
- **Review documentation coverage, evidence and publication readiness** (none): Review documentation against contracts, settings, Control Room navigation, implementation and retained evidence; correct misleading wording and add repeatable integrity checks before the authorized commit/push. [Full details and validation](docs/changes/2026-10-02-documentation-review.md).
- **Model eligibility, routing and failure diagnosis guide** (none): Explain current model eligibility, pool selection and completion behavior so users can diagnose the actual request boundary without resetting unrelated account configuration. [Full details and validation](docs/changes/2026-10-02-model-routing-documentation.md).
- **Executable profile recovery and diagnostic documentation** (none): Expand remaining operational documentation with a complete current-profile recovery drill, runnable read-only diagnostics, full index rebuild acceptance and credential recovery limits. [Full details and validation](docs/changes/2026-10-02-profile-recovery-documentation.md).
- **Selectable actual UI documentation workflows** (none): Extend the isolated Lantern Workshop capture runner with independently selectable agent, settings, decisions, Knowledge, backup, plugin, MCP and asset exercises and retain actual workflow/failure screenshots. [Full details and validation](docs/changes/2026-10-02-selectable-documentation-workflows.md).
- **Worked system documentation and reusable testing Project** (none): Expand PlayWeld documentation with a worked testing Project, a handbook for every Control Room surface, service recipes, reproducible actual UI screenshots, and an explicit coverage/issue record. [Full details and validation](docs/changes/2026-10-02-worked-system-documentation.md).

### Maintenance

- **Reproducible native, service and desktop documentation acceptance** (none): Add owned disposable runners for Godot gameplay, service extension/recovery examples, Electron smoke and fresh Unity/Unreal acceptance, repairing fixture prerequisites uncovered by native runs. [Full details and validation](docs/changes/2026-10-02-documentation-native-and-desktop-verification.md).
- **Prepare version 0.5.0** (none): Prepare version 0.5.0 from 0.4.0, retaining all pending work records in the changelog and detailed release notes. [Full details and validation](docs/changes/2026-10-03-release-0.5.0.md).

## 0.4.0

### Fixed

- **Adapt explicit function-tool reasoning restrictions** (patch): Handle a second provider compatibility restriction exposed by a real gpt-6-sol function-tool request after the completion-token fix. [Full details and validation](docs/changes/2026-10-02-function-tool-reasoning-compatibility.md).

### Maintenance

- **Prepare version 0.4.0** (none): Prepare version 0.4.0 from 0.3.0, retaining all pending work records in the changelog and detailed release notes. [Full details and validation](docs/changes/2026-10-02-release-0.4.0.md).

## 0.3.0

### Fixed

- **Adapt completion token limits for OpenAI-compatible models** (patch): Fix models rejecting `max_tokens` with an explicit request to use `max_completion_tokens`, in both streamed and complete responses. [Full details and validation](docs/changes/2026-10-02-completion-token-compatibility.md).

### Maintenance

- **Prepare version 0.3.0** (none): Prepare version 0.3.0 from 0.2.0, retaining all pending work records in the changelog and detailed release notes. [Full details and validation](docs/changes/2026-10-02-release-0.3.0.md).

## 0.2.0

### Fixed

- **Bound swarm file discovery and agent context** (minor): Prevent recursive file discovery and oversized tool responses from producing multi-million-character swarm model requests. Add bounded file-list pages, generated-tree filtering, checkpoint repair and a local request-size guard. [Full details and validation](docs/changes/2026-10-02-swarm-context-bounds.md).

### Maintenance

- **Track all repository work and release details** (none): Require permanent work records for all repository changes, generate a central changelog and detailed release notes, and enforce changed-file coverage and version impact before releases. [Full details and validation](docs/changes/2026-10-02-complete-work-tracking.md).
- **Prepare version 0.2.0** (none): Prepare version 0.2.0 from 0.1.4, retaining all pending work records in the changelog and detailed release notes. [Full details and validation](docs/changes/2026-10-02-release-0.2.0.md).
- **Verify and configure Vealoria's live engine setup** (none): Verified the installed PlayWeld 0.1.4 application against the open Vealoria Unreal 5.8.3 editor, restored a working live bridge, and corrected Vealoria's GameFeatureData startup configuration error. This is local setup and investigation evidence, with no shipped PlayWeld source change. [Full details and validation](docs/changes/2026-10-02-vealoria-engine-setup.md).
- **Save Vealoria's initial development map** (none): Preserve the open unsaved Vealoria landscape as a named development map and configure it as the game's default map and editor startup map. [Full details and validation](docs/changes/2026-10-02-vealoria-save-development-map.md).

## Historical baseline

Tracking starts after local version 0.1.4. Earlier notes are preserved as historical evidence, not reconstructed into a complete work ledger:

- [0.1.4: PlayWeld identity and artwork](docs/releases/v0.1.4.md).
- 0.1.3: no dedicated release-note file exists at the tracking baseline; details are incomplete.
- [0.1.2: forms, model selection, chat and layouts](docs/releases/v0.1.2.md).
- [0.1.1: testing packages and platform work](docs/releases/v0.1.1.md).

These version labels do not imply public tags or published releases.

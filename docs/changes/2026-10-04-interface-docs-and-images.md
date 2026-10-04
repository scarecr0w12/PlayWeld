# Interface Documentation and Screenshots

**Release:** 0.7.0

**Impact:** none

**Category:** Documentation

## Summary

Updated the user/developer/operations guidance and screenshot references for the grouped PlayWeld menu, purpose-grouped Project Home, sectioned pages and expandable controls. Refreshed the overview and complete workflow screenshots from the built 0.6.0 development browser with an isolated service and deterministic local fixtures.

## Details

- Documented the menu groups, Project Home card groups, page-specific project/section selection, disclosures, Discussion Board quick views, Swarm sections, and the current Connections, Knowledge, Assets, Plugins and Backups layouts.
- Documented Chat conversation search, starter-as-draft behavior, and the stacked narrow-window layout. The mobile-width capture is browser UI evidence only; it is not native mobile or touch acceptance.
- Repaired the capture runner for current rendered controls: explicit visible section selection, exact tab labels (distinguishing `Install` from `Installed`), current disclosure handling, per-view Project selection, current composer/connection forms, and new Chat search/starter captures.
- Captured the overview into `docs/images/lantern-workshop/` and all nine scenarios into `docs/images/lantern-workflows-2026-10-04/`. Their reports record platform/browser 0.6.0, the deterministic local Chat/agent or service fixtures, source identity, checks, and empty renderer-error lists. These captures do not establish evidence for the later 0.7.0 package, paid model behavior, or live engine/editor/installer acceptance.
- Several attempted overwrites of the legacy `docs/images/lantern-workflows/` directory encountered Windows file-write locks. Restored only those task-owned PNG changes to their original historical state and removed the task's two unused duplicate Chat PNGs from that legacy folder. The complete dated gallery is canonical; the legacy manifest is marked historical/superseded and links to that complete report.

## Validation

- `node scripts/capture-documentation.cjs --scenario overview`: passed; 21 PNGs captured to `docs/images/lantern-workshop/`, renderer error list empty.
- `node scripts/capture-documentation.cjs --scenario all`: passed; all nine scenarios and 45 PNGs captured to `docs/images/lantern-workflows-2026-10-04/`, renderer error list empty. The report confirms local deterministic fixtures and states that no live model, paid provider or engine execution was used.
- Inspected the current Project Home, Chat search/mobile starter, agent integration, MCP logs/configuration, asset review, backup restore and plugin isolation images. The restore screenshot displays a disposable host-local path; the workflow gallery warns that paths should be inspected before reuse outside the repository.
- `npx prettier --check` on all changed Markdown, JSON and capture scripts: passed.
- `bash scripts/check-links.sh`: passed (`All links OK`).
- `node --check` on all six modified capture/scenario modules: passed.
- `node scripts/check-documentation-evidence.cjs`: the initial run was blocked at the old Home-navigation assertion (`labels.length > 0`, line 51). After the parent updated its checker/inventory for grouped navigation and the current 77 settings, the run passed: 186 RPC methods, 28 notifications, 17 setting groups/77 settings, 24 service subsystems, 16 Control Room surfaces, eight capture reports, 137 referenced PNGs, and all nine combined scenarios. It validates inventory/report/file integrity only, not screenshot content or live acceptance.
- No application rebuild, installer run, paid-provider request, live engine/editor acceptance, changelog generation, Git stage/commit, or push was performed by this work.

## Files

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

# Align Kilo workspace tooling with PlayWeld development

**Release:** Unreleased

**Impact:** none

**Category:** Maintenance

## Summary

Add a shareable Kilo workspace baseline, project-specific agent adapters, and scoped review commands without changing application code or active Agent Manager assignments.

## Details

- Add root `kilo.json` with disabled automatic session sharing, approval-oriented shell defaults, explicit research-tool permissions, and pinned Context7. Optional Exa and Firecrawl are disabled for fresh checkouts until locally enabled with credentials supplied through the inherited process environment. No model/provider overrides or speculative plugins are added to the shared baseline.
- Pin existing machine-local MCP launchers to `@upstash/context7-mcp@4.1.1` (published 2026-09-14), `exa-mcp-server@3.4.1` (2026-08-18), and `firecrawl-mcp@3.25.5` (2026-09-25); remove the unresolved Context7 token placeholder. Keep existing local Exa/Firecrawl enablement and credentials untouched to avoid disrupting parallel sessions. Local credentials were exposed during inspection and require rotation and migration; their values are not recorded here. Ignored local settings remain machine-specific and are not shipped.
- Pin the existing ignored `opencode-models-discovery` plugin to `1.6.1` (2026-09-24), rather than implicitly selecting latest; do not install it as a shared dependency. Its documentation targets OpenCode, not Kilo; compatibility and behavior remain unverified. Built-in indexing/chat plugins and global model selections are not changed.
- Move the three existing Kilo agent names from the supported plural directory to canonical `.kilo/agent/`, removing duplicated discovery paths. Replace unrelated actor-system and blanket in-memory prohibitions with actual repository constraints. Make correctness and evidence reviewers edit-denied with approval-required shell execution; shell access is not a security sandbox. Scope the documentation writer to documentation paths.
- Add Kilo-native `design-reviewer`, `research-verifier`, `theia-implementer`, and `security-reviewer` adapters. Reuse shared procedures and existing skills rather than copying skills. Reviewer adapters deny unlisted tools and write-capable delegation; implementation inherits the session's model and permissions.
- Add `/playweld-review`, `/playweld-evidence`, `/playweld-design-check`, and `/playweld-security` as read-only review subtasks with bounded default scopes. Correct the shared implementation profile from obsolete Yarn commands to npm workspaces and add concurrent-work/handoff guidance.
- Extend repository rules with Kilo configuration ownership, skill discovery, permission precedence, prompt-injection boundaries, secret handling, evidence distinctions, and parallel worktree coordination. Ignore generated Kilo worktrees and local caches/package-manager metadata; preserve Agent Manager recovery state and active application edits.
- Kilo 7.8.3 runtime checking rejects environment references in project config even though schema validation accepts the syntax. Remove those references from the shared baseline; use inherited process environment or global config references instead. The existing global Unity entry has a legacy command shape and is absent from the MCP connection list; global settings and engine integrations are not changed or certified.
- Sources checked: [Kilo CLI reference](https://kilo.ai/docs/code-with-ai/platforms/cli-reference), [MCP configuration](https://kilo.ai/docs/automate/mcp/using-in-cli), [plugins](https://kilo.ai/docs/automate/extending/plugins), and npm metadata for the exact pinned versions. This is authoring-workspace maintenance, not a PlayWeld application feature or engine validation.

## Validation

- Initial bundled Kilo 7.8.3 `config check` passed before the shared baseline was added. An intermediate check rejected project environment references; the configuration was corrected rather than claiming schema acceptance proved runtime compatibility.
- Runtime discovery using filtered `debug config --pure` confirmed all seven agent profiles, four command targets, disabled sharing, and the pinned MCP launch commands. `debug agent code-reviewer --pure` confirmed editing, patching, and delegation tools are unavailable. `debug skill --pure` confirmed existing project skills are discovered without duplication.
- Post-change bundled Kilo 7.8.3 `config check` reports no warnings. `mcp list --pure` connects all three exact pinned servers without loading external plugins. These connection handshakes do not verify every server tool or plugin behavior.
- `debug agent --pure` loads all seven profiles; all five read-only reviewers expose neither write, patch, nor task tools. The documentation writer and implementation agent retain scoped write capability. Filtered runtime discovery confirms the four commands target existing profiles and automatic sharing is disabled.
- Targeted Prettier formatting and freshness checks passed for shared Kilo configuration, agents, and commands; `bash scripts/check-links.sh` reports all links OK and `git diff --check` passed. `npm run changelog:update` completed. `npm run changelog:check -- --base HEAD` is blocked by other ongoing work: its first uncovered path is `apps/control-room/electron-builder.yml`, which this task did not modify. No unrelated records were manufactured to bypass that check.
- Application tests, real engine/DCC integrations, and model-discovery behavior are not verified by this configuration work. Existing local credentials need owner rotation; no global configuration or credential values are modified. Automatic shell exceptions are limited to exact Git read commands rather than wildcard Git arguments; approval and repository-script execution remain separate trust boundaries.

## Files

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

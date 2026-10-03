# Worked system documentation and reusable testing Project

**Release:** 0.5.0

**Impact:** none

**Category:** Documentation

## Summary

Expand PlayWeld documentation with a worked testing Project, a handbook for every Control Room surface, service recipes, reproducible actual UI screenshots, and an explicit coverage/issue record.

## Details

- Add Lantern Workshop tutorial with the six-step creation wizard, separate profile/layout configuration, fixture copy instructions, discussion, model/chat setup, lexical cited Knowledge search, bounded agent request example, and screenshot regeneration commands.
- Add a handbook for all sixteen surfaces, explaining inputs, records, practical use, troubleshooting, success criteria and the distinction between UI setup, task execution, integration, and acceptance. Link existing operations, architecture, API, settings, skills, integration and release detail.
- Add typed service recipes for authentication/discovery, Project creation, engine-layer inspection, lexical search and setting overrides, plus component/extension ownership and diagnostic examples.
- Add a reusable native Godot 4 source fixture and design. The fixture draws its own shapes, implements movement, three once-only collectibles, boundaries and reset. Native gameplay remains unverified; platform native-file identity is asserted. No downloaded assets, licensing obligations, credentials, identity manifests or Project databases are copied into source.
- Add a capture script that starts an isolated real service/browser backend and local explicitly labeled deterministic model provider, creates the Project through UI, verifies discussion via RPC, exercises chat, indexes/searches documents, saves/resets a setting, reads a bundled guide, previews impact and captures every surface. Capture the visible viewport of long forms. Refuse an occupied loopback port before service/UI startup to avoid connecting to an unrelated app. Provide a help-only command that does not start services or create a Project. Shut down owned resources and preserve ignored failure diagnostics. Public capture report contains no tokens/secrets/raw prompts.
- Correct user-guide claims about wizard module selection and streaming-only Chat. Add documentation-index and user-guide entry points. Correct fixture feature metadata and capture timing/input/search/impact examples during verification. Dismiss actual UI toasts for unobstructed images.
- Add coverage record with all observed corrections, remaining live verification and existing implementation gaps. All application issues/incomplete areas remain in scope under user authorization; this pass does not claim completion of the target platform or unexecuted engine/provider/installer operations.
- Compatibility: documentation/testing additions only; no public contract/schema, durable state, installed dependency, technical-identifier or release-version change; no removed functionality or migration required. Preserve other agent edits in the shared tree.

## Validation

- Isolated capture completed 19 screenshots across all sixteen surfaces, wizard creation, native Godot file-identity assertion, persisted discussion, nonstreaming fixture chat, cited docs-only lexical retrieval, settings override/reset, bundled guide reading and path-seeded impact preview, with no uncaught renderer errors. Reviewed representative Chat, Knowledge and Engine images; viewport clipping avoids blank overflow areas. The checked-in capture report records the actual run.
- Full npx turbo run build typecheck lint test passed all 33 tasks, including both Theia app builds. Package test totals: 467 passed and 12 explicitly skipped; platform service 363 passed/11 skipped, Control Room extension 34 passed, contracts 66 passed, and the remaining four tested packages 4 passed/1 skipped. The real Godot test is skipped because no installation is available; Windows/Linux capability skips remain explicit. Real Blender fixture tests in the existing suite passed separately from this tutorial.
- npm run format:check passed. node scripts/generate-system-reference.cjs --check passed (186 requests and 75 settings). node --check scripts/capture-documentation.cjs and its --help invocation passed; explicit Prettier formatting was applied to the capture script. A bound-port failure probe confirmed EADDRINUSE is rejected before service/UI startup. scripts/check-links.sh passed through WSL with All links OK; the much slower duplicate Git Bash run was stopped after the same checker completed successfully. npm run changelog:update and npm run changelog:check -- --base HEAD passed, including regeneration/recheck after validation text updates.
- Reused installed dependencies; did not run npm ci because concurrent work uses the same dependency tree. Native Godot execution, paid generation, live model/embedding provider, backup/restore, live editor, agent implementation/integration and installer acceptance are not verified by this tutorial. No packaging or publishing performed.

## Files

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

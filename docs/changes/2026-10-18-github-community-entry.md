# Improve GitHub entry points and contribution guidance

**Release:** 0.22.0

**Impact:** none

**Category:** Documentation

## Summary

Make PlayWeld easier to try and contribute to, publish accurate About metadata, and prepare compact wiki navigation.

## Details

- Verify the clean main checkout and origin scarecr0w12/PlayWeld at e4824b0 match remote main. Use a separate docs/github-community-refresh worktree, preserving the app checkout and independent Kilo worktrees. Marketing and application builds are untouched.
- README previously led with guide links and a full source quality gate. Add demo/download/contribution links, a three-step download/tutorial path, and version-specific 0.21.0 evidence with unsigned/uninstall/rollback limits. Source setup builds packages before the app; contribution checks remain in the developer guide. Preserve GameCrafter compatibility identifiers and historical evidence. Include no Star-to-follow request.
- Add CONTRIBUTING.md covering scoped first contributions, duplicate checks, work records, proportional validation and existing-label triage. Add bug/feature forms with required reproduction/environment or problem/acceptance fields, sanitized evidence guidance, canonical help links and continued blank issues. Add a PR template for behavior, validation, compatibility and records. No new process framework or triage commitment.
- Live inventory found empty About description/website/topics, an enabled but uninitialized wiki, zero issues and one open dependency PR. Publish the requested desktop/local-service About description, https://playweld.com and desktop-app, eclipse-theia, electron, game-development, open-source and typescript topics. Confirm administrator permission; existing security settings remain unchanged.
- Publish issue #3 for disposable-host Windows uninstall/rollback acceptance after checking all-state issues for duplicates. Acceptance derives from the public release's existing gap. No destructive lifecycle test runs on ordinary installations.
- Prepare wiki Home.md and _Sidebar.md with canonical guide/demo/download/status/issue links, avoiding copied version-specific procedures. Git wiki remote returns Repository not found despite has_wiki=true; first-page UI initialization remains blocked without an authenticated browser/wiki API. docs/wiki/README.md explains publication and preservation of intervening edits. Wiki publication is not claimed.
- Compatibility: docs, issue entry and metadata only; no runtime, storage, RPC, version or migration changes. Impact none matches this scope. Docs/templates await PR review; metadata and issue #3 are already published.

## Validation

- Remote/status/worktree and remote-main identity inspection passed; original app checkout remains clean on main. Live 0.21.0 release notes/assets support README claims. Website returned HTTP 200 with demo anchor and download links.
- GitHub Markdown API rendered README; inspected HTML headings, tables and demo/release links. This is rendered HTML inspection, not screenshot or live desktop/engine acceptance.
- Existing installed YAML parser accepted forms/config with duplicate-key validation. Required fields/unique IDs and contribution relative paths/anchors passed. Contribution links are checked separately because the existing script does not scan this new root guide.
- Existing-checkout Prettier --check . passed in this worktree. npm run format:check initially lacked worktree node_modules; equivalent installed Prettier avoids installation or mutation of the app dependency tree. Git Bash link scan initially hit sandbox shared-memory denial and was rerun with escalation.
- Changed Markdown local links/anchors, git diff --check, npm run changelog:update and npm run changelog:check -- --base HEAD passed. Full repository Bash link scan was stopped after prolonged execution without a result; no success claimed for that scan. Changed-file link validation passed separately. Draft PR #4 is open; hosted Windows/Linux quality and browser checks were in progress at handoff. Full source/build/test gate intentionally skipped for docs/workflow-only changes to avoid competing app builds. No new engine/provider/installer acceptance is claimed.

## Files

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

# Publish remaining Entire hook history and agent guides

**Release:** Unreleased

**Impact:** none

**Category:** Maintenance

## Summary

Publish the remaining user-authored Entire enabling commit and guide edits together on main, preserving their history while retaining a single working startup hook. Make the shared Brain command examples readable and consistent with the installed CLI.

## Details

- Include the previously unpushed e4271b4 Enable Entire commit and its existing integration history in the PR rather than leave it as local-only work. That commit appended a second SessionStart command next to the already tested Node launcher. Remove the duplicate raw cmd-language entry in a forward correction: it can process startup twice under cmd and has the same PowerShell parsing problem already documented by the original integration. The final .codex/hooks.json matches the existing main-branch hook configuration; the original commit remains in history. The other hook events, primary timeout, missing-install guidance and child-failure handling remain intact.
- Publish the grouped agent-guide command layout using fenced text blocks so Markdown preserves separate commands and inline usage comments. Reconcile the pending CLAUDE.md spacing with the required formatter: its existing guide pointer remains unchanged, and its final bytes match main rather than publishing a blank-line edit that fails formatting. Keep the operational guidance, source-verification rules and tool-failure fallback boundaries; do not regenerate setup state or replace local trust decisions.
- Correct the guide's obsolete hybrid/vector query claims. Installed Brain 0.3.0 help identifies BM25 lexical retrieval as the ranking mode; keyword and semantic flags are compatibility spellings, and semantic does not enable vector retrieval. Separate Graph's code index from this ranking claim and require current help for flags from other versions. This is a documentation correction, not a retrieval implementation or provider change.
- Extend the existing Entire README warning to cover re-enabling that appends a duplicate hook, in addition to force-regeneration that replaces the custom launcher. Retain the known Entire 0.12.2 template-recognition warning rather than presenting a custom hook as an exact generated template match. Follow up on the [original Entire integration Trail](https://entire.com/gh/scarecr0w12/-/trails/2), preserving its earlier merged work.
- Limit the root formatter's Entire exclusions to the five machine-local paths already declared in .entire/.gitignore: tmp, metadata, logs, settings.local.json and redactors/local. The root formatting check was traversing ignored temporary prompt JSON and reporting it as source-formatting failure. Explicitly reinclude .entire/README.md after the existing broad README pattern so shared .entire settings, README and agent guide, .codex hooks and CLAUDE.md stay checked. Existing temporary prompt/log state is left unchanged and unstaged; file-info checks do not inspect its payloads.
- Compatibility and migration: developer configuration/history and documentation only, impact none. No application, dependency, RPC, storage schema, authentication state or product-version change; keep 0.24.0 with no migration required. The runtime hook configuration ultimately remains the existing main configuration. No credential files, Brain indexes, private configuration or machine Scheduled Task definitions are included.

## Validation

- The initial structural check reproduced two Entire startup dispatches where exactly one is required. After correction, the same check passed. The existing isolated shell harness passed 12 actual configured-launcher cases: CLI present, CLI missing with valid guidance JSON, and child failure, each through PowerShell 5.1, PowerShell 7, cmd fallback and direct Node. Fixtures invoke a local shim, not a model/provider or an ordinary captured conversation.
- Read installed Entire CLI 0.12.2 and Brain query/get/multi-get/inspect help. These confirm the documented ranking/compatibility flags and preserved command surface. No enable, disable, login, auth repair, provider call or manual checkpoint operation was performed.
- The initial focused formatting check rejected the supplied CLAUDE.md blank-line removal; normalizing it preserves the pointer. JSON parsing and a static comparison confirmed final hook/CLAUDE content matches main. Focused Markdown and repository formatting, base-relative changelog coverage and diff checks passed. The complete local equivalent link check passed 397 Markdown files and 1,682 relative links. Hosted Linux owns the required canonical link-check receipt; the known slow native Git Bash check is not rerun or reported passing here. Hosted checks/current Entire findings/gates/final review must qualify the final PR head before merge. Trusted live session capture and indexed Brain freshness are not inferred from these configuration fixtures.
- The initial repository formatting check reported three ignored .entire/tmp prompt files. A file-info positive control also exposed the inherited broad README exclusion; the specific Entire README re-inclusion corrects it. Formatter file-info assertions passed for five private path classes ignored and five shared paths still checked, without inspecting private payloads. Bounded credential-pattern screening covers all seven affected/configuration/record/generated files before publication. Native/authentication storage and Brain data remain outside the commit.

## Files

- `.codex/hooks.json`
- `.entire/agent-guide.md`
- `.entire/README.md`
- `.prettierignore`
- `CLAUDE.md`
- `docs/changes/2026-10-27-entire-final-sync.md`

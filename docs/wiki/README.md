# Wiki handbook source and publication handoff

The Markdown pages in this directory are the source for the public GitHub wiki. Publish every Markdown file except this README. Home is the entry point; _Sidebar and _Footer provide navigation. Canonical detailed guides remain under docs/, linked with absolute repository URLs so pages work in GitHub's separate wiki repository.

## Publication status

Prepared on docs/wiki-user-handbook from main aa2366c, checked 2026-10-18. The wiki is enabled, but its Git remote still returns Repository not found. The parent thread's existing browser task owns first-page initialization. Wait for that task to confirm initialization and hand off edit ownership before cloning or publishing; do not race its UI edits. Prepared content is complete, but wiki publication remains blocked and is not claimed.

After handoff, clone https://github.com/scarecr0w12/PlayWeld.wiki.git into a separate temporary directory, inspect all existing pages, and preserve unrelated changes. Copy the reviewed handbook pages and navigation into that clone; review the diff, commit, push, and inspect rendered Home, navigation and representative setup/workflow/technical pages. Record the actual wiki commit and result separately from source PR review. Do not publish this internal README as a wiki page.

## Content contract

- Explain an actionable workflow, its prerequisites, observable result and limits; link the canonical guide for detailed or volatile procedures.
- Preserve exact current menu labels, distinguish shorter tab names and check Project selection. There is no standalone Notes or generic Tasks page: notes use Project Markdown/discussions and supervised tasks use Swarm.
- Keep implementation, scripted demonstration, live named-operation acceptance and unverified behavior distinct. Source inspection is not new live acceptance. No paid action, engine operation or installer test was performed to write this handbook.
- Keep credentials out of pages. Explain remote context, embeddings, cost uncertainty and unsigned testing releases without promising all-local inference, automatic production readiness or general autonomous game creation.
- Use stable wiki page names and absolute canonical repository links. Preserve compatibility identifiers, technical package names and historical evidence.

## Verification sources

| Content                                       | Source inspected                                                                                                                        |
| --------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| Menu groups and labels                        | packages/theia-control-room/src/browser/workspace-menu-contribution.ts                                                                  |
| Project wizard and immutable engine           | packages/theia-control-room/src/browser/create-project-command.ts                                                                       |
| Discussion, impact, search and usage controls | discussion-board-widget.tsx, swarm-widget.tsx, knowledge-widget.tsx and audit-widget.tsx under packages/theia-control-room/src/browser/ |
| Access, close behavior and decision settings  | packages/platform-service/src/settings/definitions.ts                                                                                   |
| Build/start scripts and engine commands       | package.json, apps/control-room/package.json, packages/platform-service/src/cli.ts and engine-widget.tsx                                |
| Detailed user workflows and examples          | docs/USER_GUIDE.md, docs/CONTROL_ROOM_HANDBOOK.md, docs/WORKED_TUTORIAL.md and docs/WORKFLOW_COOKBOOK.md                                |
| Provider, engine, recovery and current limits | docs/INTEGRATION_GUIDE.md, docs/OPERATIONS_GUIDE.md, docs/STATUS.md and the public 0.21.0 release/publication receipt                   |
| Technical ownership and contributor checks    | docs/SYSTEM_ARCHITECTURE.md, docs/DEVELOPER_GUIDE.md, CONTRIBUTING.md and AGENTS.md                                                     |

Focused local checks resolve canonical repository paths/anchors and every wiki target against these files, verify menu/setting/script names against source and check formatting. A GitHub Markdown render checks generated HTML separately from graphical browser acceptance. Full app builds/tests and the prolonged Windows full-tree Bash link scan are intentionally excluded from this documentation-only work.

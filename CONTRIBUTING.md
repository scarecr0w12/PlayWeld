# Contributing to PlayWeld

Start with a small, reproducible change. Documentation corrections, a focused regression fix, and a disposable tutorial walkthrough are useful first contributions.

## Choose and discuss the work

- Search [existing issues](https://github.com/scarecr0w12/PlayWeld/issues?q=is%3Aissue) and [pull requests](https://github.com/scarecr0w12/PlayWeld/pulls) before starting. Comment on an existing match rather than opening a duplicate.
- Use the bug form for a reproducible failure and the feature form for a concrete user problem. For a substantial change, open an issue describing scope before implementation.
- Read [current status](docs/STATUS.md) and the [development plan](docs/DEVELOPMENT_PLAN.md). Design documents include proposed work; they are not a list of already supported features.

## Make your first change

1. Fork and clone the repository, then create a branch for one focused task.
2. Read [repository instructions](AGENTS.md). For code, follow the [development environment](docs/DEVELOPER_GUIDE.md#development-environment) and repository map. Documentation-only changes do not require building the desktop app.
3. Edit the owning guide or package; link to existing documentation instead of copying procedures.
4. Copy the [work-record template](docs/changes/TEMPLATE.md) to a unique pending record under docs/changes/. Include exact affected paths, compatibility notes, version impact and actual validation; keep the current product version.
5. Run the checks below and open a pull request using the supplied template. A draft is welcome for work with remaining questions. Link the issue and describe observable before/after behavior.

## Validate the change

For documentation and templates, check relative paths and heading links, inspect the GitHub-rendered preview, and run:

```bash
bash scripts/check-links.sh
npm run format:check
npm run changelog:update
npm run changelog:check -- --base <branch-base-commit>
```

Use the merge base with upstream main as the branch base; HEAD is appropriate only for uncommitted local work. Format changed files with the repository's installed Prettier if needed. Documentation link checks require Bash (Git Bash works on Windows).

For code, run the narrowest affected package test while iterating, then the [complete source gate](docs/DEVELOPER_GUIDE.md#testing-strategy) before handoff. UI changes also need the relevant app build and rendered smoke. CI runs the Windows/Linux source checks and browser build/smoke; it does not prove every provider or engine integration.

Report failures, capability skips and checks you did not run. Distinguish fixtures, live engines, desktop smoke and installer acceptance. See the [developer guide](docs/DEVELOPER_GUIDE.md) for detailed commands, dependency rules and generated references.

## Review and issue triage

Keep a report focused on one problem and include version/commit, OS, reproducible steps and expected/actual behavior. Remove API keys, tokens, personal paths and private Project data from logs or screenshots before posting publicly.

Maintainers can use the existing bug, enhancement, documentation and accessibility labels to describe a report. Use duplicate with a link to the original, help wanted for work ready for outside contribution, and good first issue only when scope and acceptance checks are clear. No response time or automatic assignment is promised.

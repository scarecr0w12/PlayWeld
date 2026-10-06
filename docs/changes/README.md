# Permanent work records

**Last updated:** 2026-10-06

The user requires all work to be tracked in full with proper versioning. The Markdown records in this directory are the permanent work ledger. [CHANGELOG.md](../../CHANGELOG.md) includes the complete Summary, Details, Validation, and Files for every tracked task, grouped by version and category. Readers must be able to review the full tracked history there without opening separate files. Separate task records remain the editable source, and [release notes](../releases/) retain each prepared version's details and validation. This is repository maintenance, not the application's task/board storage.

Tracking begins after commit `4e13420` (local version 0.1.4). Existing release notes remain historical evidence. The baseline is incomplete, including the absence of a dedicated 0.1.3 note; it must not be presented as a reconstructed exhaustive history.

## Record every task

Copy [TEMPLATE.md](TEMPLATE.md) to a unique `YYYY-MM-DD-short-description.md` filename. Keep `Release: Unreleased` until release preparation. Capture all independently meaningful work, even if it has no user-visible effect: additions, changes, removals, fixes, refactors, tests, docs, decisions, research, dependencies, assets, build/CI, investigation results, and reverted work. A task spanning several outcomes may use multiple records; a record may have a detailed list of related outcomes.

Describe what changed and why in Summary and Details. Identify affected behavior, removed functionality, compatibility/migrations, and any incomplete portion. Validation must distinguish tests, source inspection, live application/engine checks, skipped checks, and unverified claims. Do not store credentials, private user data, or raw sensitive logs. Files lists exact repository-relative paths, including deleted paths and both sides of a rename; globs and directory shortcuts are rejected. For a pure investigation with no other source changes, list the record's own path and capture the findings and evidence in Details.

## Detail and handoff requirements

Summary is a short introduction. Details must enumerate the actual outcomes; a generic paragraph such as "updated code, tests and docs" does not satisfy the contract. Scale detail to the work without inventing filler or unsupported evidence:

- For each behavior change, describe its trigger, previous behavior, resulting behavior, affected users or subsystem, and reason for the change. For documentation, tooling, tests, or investigations, describe the concrete content or finding and why it matters.
- Account for every meaningful addition, fix, removal, refactor, dependency/configuration change, test, and documentation change. Explain superseded behavior and replacement paths where applicable.
- State compatibility and migration effects explicitly, including "no migration required" when verified. Explain the chosen version impact; distinguish the product version from data/RPC schema versions.
- List commands or manual checks actually performed, their outcomes, evidence references where available, skipped checks and why, and remaining limitations. Separate fixture/source tests from live provider, engine, desktop, installer, and production evidence.
- Review the complete task diff against Details and the exact Files list before handoff. Do not absorb unrelated concurrent work into your record or claim its validation. If implementation or scope changes, revise the pending record to describe the final work.

The generator copies the full record sections into the central changelog and adjusts local Markdown links for the changelog's location. It does not supply missing prose or reconstruct older evidence. Existing historical task records and release notes remain preserved; later corrections require a new record. Automated coverage and freshness checks enforce the saved artifacts, while human/agent review must judge whether the written detail is accurate and complete.

Use one of `Added`, `Changed`, `Deprecated`, `Removed`, `Fixed`, `Security`, `Documentation`, or `Maintenance`. Mixed tasks can use separate records or choose the main category and retain every detail. Use one of these version impacts:

| Impact  | Use                                                                                   | Minimum numeric version change   |
| ------- | ------------------------------------------------------------------------------------- | -------------------------------- |
| `none`  | Internal maintenance, docs, tests, or investigation without a shipped behavior change | Patch if a new build is prepared |
| `patch` | Compatible fixes and small behavior corrections                                       | Patch                            |
| `minor` | Compatible new functionality                                                          | Minor                            |
| `major` | Breaking behavior, public contracts, storage, or removals requiring migration         | Major; minor while below 1.0     |

These are selected engineering defaults. `schemaVersion` remains a separate data/RPC compatibility contract; a product version bump does not replace a required migration or schema change. The testing-prerelease designation remains separate from numeric product versions. The current tooling requires each prepared build to advance its numeric version, including prerelease builds.

## Checks and releases

Run `npm run changelog:update`, then `npm run changelog:check -- --base HEAD` before handing off local work. On a branch use the branch's base commit instead of HEAD to include earlier commits. The checker includes committed differences, staged/unstaged changes and untracked nonignored files; CI uses `--committed` with the PR base or push's previous commit. New branches fall back to the tracking baseline. Files generated entirely from records are checked for exact freshness instead of requiring a duplicate record.

CI rejects uncovered paths, missing/unfinished fields, stale generated output, removed records, and changes to records already released at the comparison base. It cannot prove the completeness or truth of natural-language descriptions, so review the whole diff against Details and Validation. Git records exact commits; work records retain the rationale and outcome. An investigation with no saved record cannot be detected automatically. Never claim a check ran when it did not.

For a new build, `npm run release:version -- <new-version>` validates the largest pending impact, rejects existing release notes/tags and nonadvancing versions, assigns all pending records to that version, generates `docs/releases/v<version>.md`, updates the overview, and synchronizes first-party workspace versions. Refresh the lockfile and complete the [release guide](../RELEASE_GUIDE.md) checks. This does not publish, tag, build, or certify a release. Packaging/staging require no pending records and a generated note for the current version. Existing 0.1.4 source remains the baseline; the next package requires a new version.

Version preparation creates its own work record covering the synchronized workspace manifests and lockfile refresh. Before committing the prepared source, update validation with actual checks and regenerate the changelog/notes; version-assigned records become immutable once committed. Later corrections, reversions, failed-release repairs, and follow-up evidence belong in a new record and a new release version when shipped. Record removals and their replacement/migration path explicitly. The generated GitHub draft body uses the version's detailed note instead of relying on auto-generated commit titles. Original historical notes stay unchanged.

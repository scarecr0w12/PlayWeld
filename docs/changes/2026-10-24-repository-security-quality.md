# Configure repository security and quality controls

**Release:** Unreleased

**Impact:** none

**Category:** Security

## Summary

Configure the approved free GitHub security and quality settings, document private
vulnerability reporting, and schedule weekly GitHub Actions dependency updates.

## Details

- Add `.github/SECURITY.md` with a private reporting link, the information needed
  to reproduce a report, and guidance to remove credentials and private data.
  Security fixes target the latest release and `main`; older releases are not
  maintained separately. The policy does not promise response or resolution times.
- Add `.github/dependabot.yml` for weekly GitHub Actions updates in `/`, capped at
  five open update pull requests. It does not configure npm version updates or
  automatic merging; existing npm security updates remain enabled.
- Apply the approved `main-security-quality` branch ruleset: block deletion and
  force pushes, require pull requests and resolved review conversations, require
  the existing Linux quality, Windows quality, and browser-build checks, and
  require zero approving reviews. Administrators can explicitly bypass through
  pull requests. Up-to-date branches and CodeQL checks are not merge requirements.
- Restrict Actions to local actions, GitHub-owned actions, and the existing
  `softprops/action-gh-release` action; require workflow approval for all external
  contributors. Preserve read-only default token permissions, disabled workflow
  pull-request approval, and the existing SHA-pinning setting.
- Enable CodeQL default setup for JavaScript/TypeScript and GitHub Actions using
  the default query suite, remote threat model, and standard hosted runners.
  Preserve dependency graph, Dependabot alerts and security updates, secret
  scanning, push protection, and private vulnerability reporting. No paid feature,
  trial, credential generation, or new access grant is part of this task.
- Existing dependency-update pull requests and their failures are outside this
  change. Do not treat enabled scanners as proof that the application is secure.
- Compatibility and migration: no product code, package version, data schema, or
  RPC contract changes; no application migration required. Repository contributors
  now use pull requests for `main`, with the administrator bypass described above.
- Version impact is `none` because these are repository controls and maintenance
  documentation, not a shipped application behavior change. File changes remain
  proposed until this draft pull request is reviewed and merged.

## Validation

- Inspected repository `AGENTS.md`, change-record instructions, relevant security
  review guidance, workflow definitions, and existing checks before changing settings.
- GitHub API accepted ruleset creation (ID `25797382`), Actions restrictions and
  contributor-approval updates, and CodeQL setup. Initial CodeQL run:
  <https://github.com/scarecr0w12/PlayWeld/actions/runs/40131964374>.
- Read back the ruleset, allowed actions, external-contributor approval policy,
  default token permissions, preserved security features, and CodeQL configuration.
  Both initial CodeQL analyses completed successfully with empty analysis error
  and warning fields. CodeQL reported 12 open alerts (nine high and three medium);
  these are untriaged scanner findings and were not fixed or dismissed.
- `npm run changelog:update`, `npm run changelog:check -- --base
  7ccb07580d82164d16f63c6ce5404b81a754f1e6`, and `git diff --check` passed.
  The existing pinned Prettier installation checked the complete isolated checkout;
  all matched files passed without installing dependencies into the checkout.
- The repository-wide Markdown link checker was started under Git Bash; it is
  still running at commit preparation. The PR's existing Linux CI also runs this
  checker. Neither an uncompleted local check nor pending hosted checks are
  represented as passed here.
- Initial repository inspection found 11 open Dependabot alerts (four high and
  seven medium), zero open secret-scanning alerts, and failing existing Dependabot
  pull requests. These are observations, not fixes delivered by this task.
- Application builds, engine integrations, desktop packaging, and installer tests
  are not executed locally for this documentation and repository configuration
  change. Hosted checks and CodeQL results are verified separately before handoff.

## Files

- `.github/SECURITY.md`
- `.github/dependabot.yml`
- `docs/changes/2026-10-24-repository-security-quality.md`
- `CHANGELOG.md`

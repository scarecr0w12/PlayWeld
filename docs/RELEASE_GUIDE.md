# PlayWeld versioning, releases and local Windows testing

**Last updated:** 2026-10-04

This guide defines the current release tooling and the local testing handoff. The complete release lifecycle remains in progress in [WP19](DEVELOPMENT_PLAN.md#wp19--packaging-and-release); installer upgrade/rollback and signing acceptance are separate from producing a test build.

## Version and tag contract

Every task must have a permanent [work record](changes/README.md), including documentation, tests, investigations, refactors, removals, dependency/configuration changes, and assets. [The changelog](../CHANGELOG.md) is generated from those records. The user requires complete tracking; the categories, impact rules and checks are selected engineering defaults. Record actual validation and limitations rather than treating a version number as evidence.

All nine first-party application/package workspaces use the same exact release version and exact internal dependency versions. The npm lockfile must record those versions. An annotated Git tag has the form `v<version>` and identifies the immutable source commit used for the build. A release tag must match the desktop application's version.

The release preparation scripts are [set-release-version.cjs](../scripts/set-release-version.cjs) and [check-release-version.cjs](../scripts/check-release-version.cjs). Version checking runs in normal CI and before release packaging. It rejects stale workspace/lockfile versions and mismatched tags.

Keep work records pending while developing. Before preparation, review their details against the whole diff, run `npm run changelog:update`, and run `npm run changelog:check -- --base <branch-base>` (use `HEAD` for uncommitted local work). Preparation validates local coverage and the highest recorded impact, assigns every pending record, creates a separate version/lockfile work record, and generates detailed release notes. The generated preparation record initially labels subsequent quality/packaging checks unverified. Before committing the prepared source, update its validation with checks actually completed and regenerate the output; version-assigned records become immutable once committed. Later corrections or evidence use new pending records. Published or failed builds are repaired with a new version.

For example, prepare the next patch testing version (use a minor bump for new features or breaking changes before 1.0):

```bash
npm run release:version -- 0.8.0
npm install --package-lock-only --ignore-scripts
node scripts/check-release-version.cjs v0.8.0
npm run changelog:check -- --release --base HEAD
npm ci
npx turbo run build typecheck lint test
npm run test:changes
node scripts/generate-system-reference.cjs --check
npm run format:check
bash scripts/check-links.sh
```

Run dependency installation in the native host checkout. Linux and Windows native dependencies must remain separate. Review and commit the version/lockfile/documentation changes before creating the tag. Do not move or reuse a published tag when repairing a release; create a new version.

## GitHub release workflow

[Desktop Release](../.github/workflows/release.yml) runs when a `v*` tag is pushed, or manually for package-only verification. The workflow checks version agreement, runs dependency package quality checks, builds native Windows/Linux packages, verifies the Windows contents, uploads build artifacts and assembles release metadata.

A tagged workflow creates a **draft testing prerelease**. It does not automatically publish a stable update. GitHub's prerelease flag is the testing-channel designation; it can be used with a normal semantic version such as `0.1.1`. The current in-app update channel is stable and excludes testing prereleases, so testing versions are obtained manually.

Normal CI checks complete PR/push file coverage against changed work records, generated output freshness, and tracking regression tests. Release validation and all desktop packaging/staging commands require the current version's generated detailed notes and no pending records. The draft GitHub release body is sourced from `docs/releases/v<version>.md`, preserving the task details and validation instead of summarizing only commit titles. The historical 0.1.4 baseline must advance before building another package.

The draft contains Windows NSIS `.exe`, Linux AppImage/DEB, `gamecrafter-release.json` and `SHA256SUMS.txt`. The manifest records the version, tag, commit, timestamps, platform assets/hashes and profile/Project schema compatibility.

If `UPDATE_SIGNING_PRIVATE_KEY` is configured, metadata/checksums are signed with Ed25519. Without that secret, the workflow explicitly authorizes an unsigned testing prerelease and labels its manifest accordingly. Ordinary metadata generation still requires a signing key. A checksum proves file integrity against the listed hash; it is not publisher authentication.

Windows Authenticode signing uses separate `WIN_CSC_LINK` and `WIN_CSC_KEY_PASSWORD` secrets. No signing certificate/key is generated or uploaded automatically. A testing executable can therefore be unsigned even when Ed25519 release metadata is signed.

After reviewing successful checks and actual artifacts, publish the authorized testing prerelease:

```bash
git tag -a v0.1.2 -m 'PlayWeld 0.1.2 testing prerelease'
git push origin main
git push origin v0.1.2
# Wait for the Desktop Release workflow and inspect its draft assets.
gh release edit v0.1.2 --draft=false --prerelease --latest=false
```

Publishing is a separate operation requiring release authority. Do not convert to a stable release without reviewing signing, supported installation/update paths and the remaining acceptance requirements. Use the actual release version in every command.

## Local Windows executable

Build from native Windows Node/npm after package checks:

```bash
npm run package:win -w @gamecrafter/control-room
node scripts/stage-windows-release.cjs
```

Electron Builder writes to `apps/control-room/dist/<version>/`. This preserves previous version outputs and avoids packaging over a running app's directory. Close the owned application from that version before rebuilding the same directory; Windows can lock native modules.

The Windows verifier checks the Electron main entry, PE native module, matching application/service versions, all thirty current bundled skills and their reference content, and Apache license/notice files. It rejects missing or stale skill assets, so a test package cannot silently substitute an older skill library.

Desktop packaging first prepares the checksum-pinned Qdrant 1.19.1 native executable for the host Windows/Linux x64 target and its license, then copies these resources beside the application. Build-time downloads require network access; installed managed Qdrant does not download itself or require Docker. The Windows contents verifier also checks the LanceDB addon and Qdrant executable are x64 PE binaries. Development preparation is `npm run prepare:qdrant -w @gamecrafter/control-room`. Cross-host packaging is not supported by this preparation step; use native target-host builds. Embeddings are configured separately and no inference runtime is bundled with the selected LanceDB release.

Future PlayWeld packages use the names below. Previously staged GameCrafter builds keep their original names. Use a new release version when packaging the rebrand; existing staging destinations are preserved. See [branding and compatibility](BRANDING.md).

The staging command creates:

```text
Windows-Release/<version>/
  PlayWeld-<version>-x64.exe    NSIS installer
  Launch-PlayWeld-Test.cmd     Launch the unpacked app with isolated test state
  app/GameCrafter.exe            Actual unpacked desktop executable
  app/resources/...             Required runtime files, service, skills and plugins
  local-build.json               Version, tag, source commit and installer hash
  SHA256SUMS.txt                 Local installer checksum
```

Keep the complete `app/` directory together. Its executable requires the adjacent runtime files. The installer is a separate executable that installs the application.

Double-click `Launch-PlayWeld-Test.cmd` for an isolated local test. It sets the profile, Theia configuration and Electron user-data directories below `%LOCALAPPDATA%\GameCrafter-Testing`, separated by version. The launcher preserves the normal PlayWeld profile. Launching `app/GameCrafter.exe` directly uses the application's ordinary environment/profile resolution instead.

Staging rejects an existing `Windows-Release/<version>` destination so previous evidence/builds are preserved. It does not delete or overwrite an earlier version. Installers, unpacked apps, credentials and generated test artifacts remain ignored by Git.

When a local installer is built before its source commit, `local-build.json` identifies the base commit and explicitly records `workingTreeDirty` plus changed, nonignored source paths and SHA-256 fingerprints. A dirty build must not be attributed solely to the base commit. A later source commit can also include documentation/evidence updates written after staging; its hash is not retroactively treated as the build's original provenance.

## Test the packaged application

Use an isolated profile/configuration, launch the unpacked app outside the development Electron process, and verify startup, Project creation/opening, Settings, Models, Chat, Skills & Roles, Connections, Board, Swarm, Plugins, Engine/DCC, Knowledge, Assets, Backups, Updates and Audit.

For automated packaged UI smoke, launch with a local Chrome DevTools port and run:

```bash
node scripts/live-ui-smoke.cjs --electron
```

Configure `GAMECRAFTER_CDP_URL` and `GAMECRAFTER_SMOKE_ARTIFACT_DIR` for that owned test session. Close only the session and service created by the test. An unpacked executable smoke is not installer install/uninstall acceptance or an upgrade/rollback drill.

The repeatable Electron runner can also launch a particular unpacked or installed executable with its own disposable profile, IDE configuration, Electron user data and local debugging port. In packaged mode it verifies the bundled service version rather than substituting the source service. For example, in PowerShell:

```powershell
$env:GAMECRAFTER_ELECTRON_EXECUTABLE = (Resolve-Path 'Windows-Release/0.8.0/app/GameCrafter.exe').Path
node scripts/verify-documentation-electron.cjs
Remove-Item Env:GAMECRAFTER_ELECTRON_EXECUTABLE
```

Use the version actually being prepared; preparation rejects an existing version or release record. The runner stops only its own disposable service and desktop process tree. A successful run still does not install the package or verify the normal profile's preservation.

Inspect the packaged service over authenticated RPC as well: check `service/info`, create a disposable Project, list the thirty builtin skills, activate an appropriate guide and read its reference. This confirms the shipped runtime can use the library, rather than only confirming source files exist.

## Release evidence and limitations

The [0.7.0 local deployment record](changes/2026-10-04-local-0.7.0-deployment.md) tracks the interface/docs update, local Windows package, installer outcome, retained configuration checks and evidence limits. Documentation screenshots are real isolated development-browser captures labelled with their capture version; they are not installation screenshots or evidence of external provider/engine acceptance. No tag or public release is implied by a local installer or the staging tool's conventional tag field.

The [0.8.0 hierarchy/cost deployment](changes/2026-10-04-local-0.8.0-deployment.md) retains the preceding upgrade evidence: structured goals and model-usage export, database backups, installed hashes and retained pricing/configuration. Existing screenshot version labels and earlier installers are preserved.

The current [0.9.0 local deployment](changes/2026-10-04-local-0.9.0-deployment.md) adds typed decision assistance and the separately documented cache maintenance. It passed the 33-task quality gate, native packaging, 29 staged and 29 installed Electron checks, twenty-one installed-file comparisons, and ordinary profile/Project retention and migration checks. Decision weights and live calibration are not established by package/history tests. Use the next unused version for later preparation; no example authorizes overwriting an existing version or changing historical evidence.

Keep quality logs, package logs, screenshots, UI reports, metadata/checksum verification and the exact GitHub workflow/tag IDs with each build. Source fixtures and sanitized records are versioned; generated artifacts live in ignored local output or GitHub release assets.

Testing prereleases do not certify production games, every engine version, live provider accounts, installer rollback or Windows plugin isolation. Read [status](STATUS.md), [operations](OPERATIONS_GUIDE.md), and the version's [release notes](releases/v0.1.2.md) for the current boundary.

The publication and packaging mechanisms above are documented by [GitHub release management](https://docs.github.com/en/repositories/releasing-projects-on-github/managing-releases-in-a-repository) and [Electron Builder v26 target selection](https://www.electron.build/v26/docs/targets/). Repository scripts and test evidence determine PlayWeld's actual behavior.

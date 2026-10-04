# GameCrafter 0.1.1 release acceptance

**Last updated:** 2026-10-04

The 0.1.1 acceptance results below were recorded on 2026-10-01. The later-local-evidence links at the end were added on 2026-10-04 without changing that historical test scope.

This record covers the versioned testing build from source commit `4ffc8dc25f63be1ef2e8f8bcbec4e5c4be1a9cc9`, identified by annotated tag `v0.1.1`. It supplements the [release guide](RELEASE_GUIDE.md) and does not mark the remaining WP19 installation/update/rollback criteria complete.

## Local quality and packaging

Both local full build/typecheck/lint/test gates passed 33/33 Turborepo tasks. Linux passed 429 tests. Native Windows passed 417 tests with twelve explicit platform/capability skips. Generated references, version/lockfile consistency, formatting and documentation links passed.

Native Windows `npm run package:win -w @gamecrafter/control-room` completed with Electron 42.10.0 and Electron Builder 26.16.1. Package inspection verified the Electron main entry, Windows PE addon, matching app/service version 0.1.1, thirty current bundled skills and their reference contents, and the Apache license/notice files. The binary is unsigned; no Windows certificate was configured.

The locally built installer SHA-256 is:

```text
4456b99831ddc09047d54fd81b164b7858a660b32c76f3b2cecf9214a6c75c15
```

This hash identifies both the local installer and the Windows installer uploaded to this release. Linux package hashes are recorded in the release manifest and checksum file; independent rebuilds need not produce byte-identical packages.

## Packaged runtime and UI

The actual `win-unpacked/GameCrafter.exe` launched with a dedicated profile and user-data directory. Authenticated RPC established service version 0.1.1, listed thirty enabled builtin skills for a disposable Project, activated `asset-pipeline`, and read its supporting reference. Skill locations resolved inside the packaged service's `resources/app/node_modules/@gamecrafter/platform-service/lib/skills`, rather than using the repository source library.

The packaged application passed 23 rendered UI checks with zero renderer errors. Coverage includes the dark violet/neon green theme, Project wizard and same-window opening, Settings save/reset and export/import, skill/reference display, view navigation and Audit export. Owned GUI/service processes were closed afterward; the normal user profile/service was not stopped.

Local runtime reports, screenshots and logs are under `.turbo/release-0.1.1-acceptance/`; quality/package/staging logs are under `.turbo/release-*.log`. These ignored local files are evidence locations on the test host, not downloadable paths in a source-only checkout.

## Local user handoff

The staging helper created `Windows-Release/0.1.1/`, containing the NSIS installer, unpacked application, `Launch-GameCrafter-Test.cmd`, installer checksum and `local-build.json` provenance. The test launcher uses per-version profile/configuration/user-data locations under `%LOCALAPPDATA%\GameCrafter-Testing`.

The installer is `GameCrafter-0.1.1-x64.exe`; the unpacked executable is `app/GameCrafter.exe` with its adjacent runtime files. Installer install/uninstall and existing-installation upgrade were not exercised by the unpacked application smoke.

## Hosted publication

The tagged Linux package job passed. Its Windows dependency quality gate also passed, then the generated-reference freshness check failed because a native Windows checkout used CRLF line endings. The first tagged workflow therefore did not reach automatic draft assembly. The checker now normalizes CRLF and `.gitattributes` fixes source checkout line endings; an exact native Windows CRLF simulation passes. The original annotated tag is preserved.

The first prerelease is assembled from the validated local native Windows installer and the successful tagged Linux CI packages, all from source commit `4ffc8dc25f63be1ef2e8f8bcbec4e5c4be1a9cc9`. The [0.1.1 testing prerelease](https://github.com/scarecr0w12/GameCrafter/releases/tag/v0.1.1) is published with the Windows installer, Linux AppImage/DEB, release manifest and checksum file. All five uploaded asset sizes and GitHub-reported SHA-256 digests match the local verified files. The complete release manifest and all package/manifest checksums were independently verified before publication. Metadata and executable signing are unavailable for this testing prerelease. The source workflow is [run 36950390778](https://github.com/scarecr0w12/GameCrafter/actions/runs/36950390778); the tagged quality workflow is [run 36950390793](https://github.com/scarecr0w12/GameCrafter/actions/runs/36950390793).

## Remaining acceptance

Signing-key/certificate provisioning, a stable signed release, installer install/uninstall, previous-installer capture, in-place update and rollback/recovery remain open. Live provider coverage, production-game acceptance, physical desktop input/accessibility and broader engine/isolation matrices retain the limits in [status](STATUS.md).

## Later Local Evidence

The sections above are the historical 0.1.1 acceptance record, not a statement that subsequent local installations were never tested. Later version-specific evidence is retained separately: [0.6.0 local upgrade](changes/2026-10-03-local-0.6.0-deployment.md), [0.7.0 interface/docs deployment](changes/2026-10-04-local-0.7.0-deployment.md) and [0.8.0 hierarchy/cost deployment](changes/2026-10-04-local-0.8.0-deployment.md). Those records distinguish source tests, packaged desktop checks and actual Windows installer outcomes. They do not retroactively certify 0.1.1 or resolve signing, uninstall, rollback, Linux packaging or the complete WP19 lifecycle.

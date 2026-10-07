# PlayWeld changelog

Complete tracked work, grouped by version and category, with full details, validation, and affected files. Generated from permanent [work records](docs/changes/README.md). Run `npm run changelog:update`; edit the records rather than this file. Release preparation assigns pending records to a version. Historical completeness is limited to the tracking baseline below.

## Unreleased

No pending work records.

## 0.19.0

### Fixed

#### Allow bounded fresh installed service readiness

**Impact:** patch

[Permanent work record](docs/changes/2026-10-06-installed-service-cold-start.md).

##### Summary

Allow thirty seconds for detached service startup after a cold installed upgrade instead of reporting failure after five seconds while the daemon continues starting.

##### Details

- The first 0.18.0 isolated installed probe exhausted the five-second service readiness deadline; the daemon subsequently finished startup, and an unchanged retry passed. The ordinary upgrade's fresh service also required approximately fifteen seconds between process launch and its startup event. This is measured installed-runtime behavior, not a capability failure.
- Extend only detached startup readiness to thirty seconds. Keep the same live process/socket checks and ordinary stop/checkpoint behavior. Extend the Windows package verifier's outer CLI process bound to forty-five seconds so the inner startup limit can report correctly.
- Preserve the failed probe log and authenticated cleanup of its exact owned profile/PID. No profile schema, data identity, public branding or compatibility path changes.

##### Validation

- Local 0.18.0 ordinary retention passed four Projects, 139 models and five pools, and all 417 selected installed files matched the stage. The installed native retry and all 29 desktop checks passed; the initial cold-start failure remains recorded.
- Source CLI lifecycle and corrected fresh package/installed acceptance remain pending for the next version. This change does not repair the separate hosted protected-key failure or claim public release acceptance.
- The corrected source CLI lifecycle passed; the full 0.19.0 local quality gate passed all 33 tasks uncached with 560 platform tests/six skips and 128 extension tests. Version-correct cold package/installed readiness and public acceptance remain pending for the separate receipt.

##### Files

- `packages/platform-service/src/cli.ts`
- `apps/control-room/scripts/verify-windows-native.cjs`
- `docs/changes/2026-10-06-installed-service-cold-start.md`

### Maintenance

#### Prepare version 0.19.0

**Impact:** none

[Permanent work record](docs/changes/2026-10-06-release-0.19.0.md).

##### Summary

Prepare version 0.19.0 from 0.18.0, retaining all pending work records in the changelog and detailed release notes.

##### Details

Synchronize first-party workspace and internal dependency versions. The lockfile must be refreshed separately. No tag, publication, or build is performed by version preparation.

##### Validation

Clean native Windows npm ci and refreshed workspace/lockfile agreement passed. All 33 quality tasks passed uncached, with 560 platform tests/six explicit capability skips and 128 extension tests. All 25 tracking checks, formatting, references/inventory/evidence, documentation links, release coverage and diff checks passed. Focused local process/native protected-key validation passed seven checks, CLI lifecycle passed, and hosted workflow 37553725042 passed its transport round trips and four actual protected-key cases. Full hosted CI and tagged package/installed/publication acceptance are recorded in a separate receipt after the source becomes immutable; unsigned metadata, publisher signing and complete uninstall/rollback remain separate acceptance boundaries.

##### Files

- `packages/archive-extractor/package.json`
- `packages/contracts/package.json`
- `packages/platform-service/package.json`
- `packages/plugin-sdk/package.json`
- `packages/service-client/package.json`
- `packages/theia-control-room/package.json`
- `packages/plugins/sample-hello/package.json`
- `apps/control-room/package.json`
- `apps/control-room-browser/package.json`
- `package-lock.json`

#### Diagnose hosted Windows credential transport

**Impact:** patch

[Permanent work record](docs/changes/2026-10-06-windows-credential-transport-diagnosis.md).

##### Summary

Diagnose and repair the Windows PowerShell stderr transport after both hosted 0.18.0 runners reproduced the DPAPI deadline failure; retain a disposable native probe for regression diagnosis.

##### Details

- Preserve failed 0.18.0 Windows CI/release logs and the source tag. Linux quality/package and browser smoke passed; publication is not accepted. The local ordinary upgrade retained four Projects, 139 models, five pools and matched 417 installed files. A first isolated installed service startup exceeded its five-second readiness budget; the unchanged retry passed, and that timing limitation remains recorded.
- Compare EOF-based and newline-framed Windows PowerShell stdin with a fixed non-secret fixture, native DPAPI protect/unprotect and only static phase markers, elapsed time, exit code, length and fixture checksum. No account, credentials, signing material or ordinary profile is read.
- Provide a manual Windows Actions job without npm installation to distinguish input transport from native crypto/runtime behavior. Both children have twenty-second termination limits. This is diagnostic tooling, not a timeout increase or a skipped release assertion.
- Extend the hosted probe with a clean dependency/service build and the exact isolated protected-key regression. Temporary helper phase markers were used for diagnosis and reverted before final runtime acceptance: the final helper keeps its original static PowerShell script, pipes/drains stderr without logging, and preserves static redacted errors and stdin-only sensitive input. Add a direct ignored-versus-piped stderr round-trip comparison with the exact original helper script, and a deterministic regression for the valid drained pipe.

##### Validation

- Initial local Node 24.21.0 direct DPAPI protection passed after downloading the exact hosted runtime from nodejs.org and checking its published SHA-256; the runtime version alone did not reproduce the failure.
- The initial expanded local probe was rejected by native process startup with EPERM before phase output, while a minimal static PowerShell phase command and the application DPAPI helper both passed. The probe is retained to test the hosted environment directly; hosted phase results remain pending. Full installed desktop acceptance and public release remain pending; no successful Windows publication is claimed.
- Hosted baseline workflow 37552973484 passed EOF and newline protect/unprotect round trips on Node 24.21.0 in 2671ms and 283ms. This rules out a general hosted DPAPI or input-framing failure for that fixture; the exact application test is isolated next. Local phase-instrumented protected-key execution receives EPERM before process startup, while six deterministic/portable tests pass. That unsuccessful local diagnostic is retained without promoting runtime acceptance.
- Local installed 0.18.0 desktop smoke passed 29 checks with zero renderer errors at .artifacts/documentation-electron/1791333489913. The owned isolated probe left after the first five-second readiness failure was authenticated and stopped by its exact PID/profile; the ordinary service and two unrelated staged services remain available. Public release remains pending corrected Windows acceptance.
- Focused hosted workflow 37553215366 passed all four actual protected-key tests in 1676ms after using a valid stderr pipe (the protected-key case took 1210ms). The original uninstrumented script with piped/drained stderr then passed all seven local process/protected-key checks in 3.05 seconds. Direct ignored-versus-piped hosted comparison is pending; no timeout is extended again and no native signing assertion is skipped.
- Follow-up workflow 37553725042 passed both bare original-script stderr modes (ignored 545ms, piped 529ms) and all four actual protected-key cases (the protected-key case took 1230ms). The isolated transport comparison does not reproduce the full-suite failure, so a general claim that ignored stderr always breaks PowerShell is unsupported. Final acceptance requires the corrected complete Windows suite; the helper supplies and drains a usable handle as a measured candidate repair while keeping diagnostics private.
- Full local 0.19.0 validation passed 33 uncached tasks, including 560 platform tests/six explicit skips and 128 extension tests. Tracking, formatting, references/inventory/evidence, documentation links and release agreement/coverage passed. Final full hosted/package/deployment/publication results receive a separate receipt; the existing 0.18.0 installation and failed tags are preserved.

##### Files

- `scripts/probe-windows-dpapi-transport.cjs`
- `.github/workflows/windows-transport-probe.yml`
- `docs/changes/2026-10-06-windows-credential-transport-diagnosis.md`
- `packages/platform-service/src/engines/unreal/editor-bridge-tools.ts`
- `packages/platform-service/src/engines/unreal/dpapi-process.test.ts`
- `docs/STATUS.md`
- `docs/RELEASE_GUIDE.md`

## 0.18.0

### Fixed

#### Bound Windows cold startup and hosted fixture lifecycle

**Impact:** patch

[Permanent work record](docs/changes/2026-10-06-windows-cold-start-release-budgets.md).

##### Summary

Accommodate observed cold Windows startup while retaining bounded, cancellable DPAPI and complete fixture assertions for the next testing release.

##### Details

- Hosted v0.17.0 Windows quality hit the DPAPI child deadline at 10047ms; the independent release runner hit the same deadline plus multiple 10000ms fixture setup hooks and subsequent locked cleanup. Linux quality/package and browser smoke passed. Repeating the same source alone does not repair these measured timing limits.
- Raise only the DPAPI process deadline from ten to thirty seconds, with prompt AbortSignal cancellation. Report static timeout, cancellation, exit and input/start transport categories without printing child stderr, payloads or private keys. Clear deadline/listeners on both failed startup and normal exit.
- Give service test bodies thirty seconds and setup/teardown hooks sixty seconds. Native protected-key CLI execution receives sixty seconds, with a 120-second overall multi-operation case. Crypto, signature, isolation, task and retention assertions remain unchanged; no capability check is disabled.
- Add deterministic mocked-process tests for stdin-only sensitive input, cleanup, successful execution, startup beyond ten seconds, bounded termination, cancellation and redacted failure. Actual native protected-key tests remain required on Windows.
- Preserve failed v0.16.0/v0.17.0 tags and all local candidate/deployment artifacts. Prepare a new 0.18.0 minor version and publish only after corrected hosted Windows/Linux and local deployment acceptance. Record final publication in a separate receipt without rewriting immutable tagged records.

##### Validation

- Hosted Windows failure logs are retained under .artifacts/local-deployment/0.17.0-1791329647605. The local 0.17.0 ordinary upgrade retained four Projects, 139 models, five pools/configuration/key/pricing/task identities and matched 417 installed files. Its staged smoke passed 29 checks; installed smoke results are retained separately.
- All 34 targeted process/native-signing/A2A/tool-broker checks passed locally. Deterministic cases prove ten-second startup no longer terminates early, the thirty-second cap still kills the child, cancellation is immediate, input stays off arguments, deadline cleanup completes and diagnostics contain only static categories/exit codes. Actual Windows protected-key generation and signature verification remain enabled and passed. Full 0.18.0 source/package/deployment and hosted/publication results are recorded separately as they finish.
- The corrected 0.18.0 full source gate passed all 33 tasks (nine cached, 24 fresh), with 560 platform tests/six explicit capability skips and 128 extension tests. Tracking passed 25 checks; formatting, references/inventory/evidence, documentation links, release agreement/coverage and diff checks passed. First-attempt lint evidence remains retained; the cancellation regression now also asserts the process was killed. Final package/deployment/publication acceptance follows the immutable source tag.

##### Files

- `packages/platform-service/src/engines/unreal/editor-bridge-tools.ts`
- `packages/platform-service/src/engines/unreal/dpapi-process.test.ts`
- `packages/platform-service/src/updates/release-metadata-cli.test.ts`
- `packages/platform-service/package.json`
- `docs/reference/DOCUMENTATION_INVENTORY.md`
- `docs/reference/documentation-inventory.json`
- `docs/STATUS.md`
- `docs/RELEASE_GUIDE.md`
- `docs/changes/2026-10-06-windows-cold-start-release-budgets.md`

### Maintenance

#### Prepare version 0.18.0

**Impact:** none

[Permanent work record](docs/changes/2026-10-06-release-0.18.0.md).

##### Summary

Prepare version 0.18.0 from 0.17.0, retaining all pending work records in the changelog and detailed release notes.

##### Details

Synchronize first-party workspace and internal dependency versions. The lockfile must be refreshed separately. No tag, publication, or build is performed by version preparation.

##### Validation

Clean native Windows npm ci and refreshed version/lockfile agreement passed. All 33 quality tasks passed (nine reused from the first attempt, 24 rerun after the assertion correction), including 560 platform tests/six explicit skips and 128 extension tests. All 25 tracking checks, formatting, generated references/inventory/evidence, documentation links, release coverage and diff checks passed. Targeted DPAPI/native metadata/A2A/tool-broker validation passed 34 checks. The first gate stopped on an unused fixture variable; asserting cancellation terminates the child repaired that lint failure before the successful gate. Version-assigned records become immutable with the source commit. Final tagged packaging, installed upgrade and hosted publication receive a separate permanent receipt; publisher signing and full uninstall/rollback remain unverified.

##### Files

- `packages/archive-extractor/package.json`
- `packages/contracts/package.json`
- `packages/platform-service/package.json`
- `packages/plugin-sdk/package.json`
- `packages/service-client/package.json`
- `packages/theia-control-room/package.json`
- `packages/plugins/sample-hello/package.json`
- `apps/control-room/package.json`
- `apps/control-room-browser/package.json`
- `package-lock.json`

## 0.17.0

### Fixed

#### Portable installer-handoff fixtures and corrected public release

**Impact:** none

[Permanent work record](docs/changes/2026-10-06-release-0.17.0-portable-handoff-tests.md).

##### Summary

Repair Windows-only parameterized installer tests that failed in hosted Linux, then prepare a new 0.17.0 testing release while preserving the failed 0.16.0 tag and validated local deployment.

##### Details

- Hosted Linux quality and release runs for v0.16.0 failed two installer fixture cases because it.each supplied the case value but no second callback context. The attempted context.skip call therefore threw before reporting an intentional platform skip. This was a test portability defect; Windows source/package/installed checks and ordinary data retention had passed.
- Apply the platform condition through it.skipIf before parameterizing the two native cases. Non-Windows runs explicitly skip the Windows executable lifecycle; Windows continues to run both real waiting/tampering cases. The portable digest/confinement test still runs everywhere. No application runtime, schema, engine bridge or isolation policy is weakened or changed.
- Preserve source commit 4fa7938205a56f62ee68f378e125734c5d0d4303, failed v0.16.0 tag/workflow diagnostics and the local 0.15.0/0.16.0 artifacts. Cancel remaining redundant work in failed runs; do not move the tag or publish a failed release. Prepare a new 0.17.0 minor version, retaining full cumulative release records and notes.
- Build and deploy the version-correct Windows package with the same profile checkpoint/backup, installed source/native checks and configuration/task retention. Verify the corrected hosted Windows/Linux matrix before publishing the explicitly authorized unsigned testing prerelease. Publication receives its own immutable-source receipt.

##### Validation

- Failed Linux release job 112551205852 and quality job 112551168765: 549 passing tests, 12 explicit skips and two context.skip failures. Actual API job logs are retained under .artifacts/local-deployment/0.16.0-1791327287740. The tag's browser build and live smoke passed before the failed matrix was canceled.
- Corrected Windows native handoff fixtures passed all three tests. An isolated WSL Node 24.20.0/Vitest 5.0.1 copy of the exact two source files passed the portable test and explicitly skipped the two native Windows cases. Its retained report is .artifacts/local-deployment/0.17.0-1791329647605/linux-handoff.log; the fixture is /tmp/playweld-ci-handoff-6unGkP. This direct platform check does not substitute for the complete hosted matrix.
- Clean npm ci and all 33 uncached quality tasks passed for 0.17.0, with 557 platform tests/six skips, 128 extension tests and 25 tracking checks. Formatting, generated references/inventory/evidence, version/lockfile agreement and release-ledger checks passed. Source is committed/tagged before final package/deployment so hosted and local verification can run concurrently; the separate receipt records actual completion before publication.
- The ordinary installed service remains verified at 0.16.0 until the version-correct upgrade completes. 0.17.0 packaging, installed retention and hosted publication are not claimed by these source checks.

##### Files

- `packages/platform-service/src/updates/installer-handoff.test.ts`
- `docs/STATUS.md`
- `docs/RELEASE_GUIDE.md`
- `docs/changes/2026-10-06-release-0.17.0-portable-handoff-tests.md`

### Maintenance

#### Prepare version 0.17.0

**Impact:** none

[Permanent work record](docs/changes/2026-10-06-release-0.17.0.md).

##### Summary

Prepare version 0.17.0 from 0.16.0, retaining all pending work records in the changelog and detailed release notes.

##### Details

Synchronize first-party workspace and internal dependency versions. The lockfile must be refreshed separately. No tag, publication, or build is performed by version preparation.

##### Validation

Clean npm ci and version/lockfile agreement passed. All 33 uncached quality tasks passed with 557 platform tests/six skips and 128 extension tests, plus 25 tracking checks, formatting, references/inventory/evidence and release coverage. Corrected handoff tests pass three real Windows cases and one portable WSL case/two explicit native skips. Application runtime is unchanged from the validated 0.16.0 deployment apart from release metadata. Final local package/deployment and hosted publication are recorded in a separate receipt after the tagged source becomes immutable.

##### Files

- `packages/archive-extractor/package.json`
- `packages/contracts/package.json`
- `packages/platform-service/package.json`
- `packages/plugin-sdk/package.json`
- `packages/service-client/package.json`
- `packages/theia-control-room/package.json`
- `packages/plugins/sample-hello/package.json`
- `apps/control-room/package.json`
- `apps/control-room-browser/package.json`
- `package-lock.json`

## 0.16.0

### Fixed

#### Preserve installed runtime permissions for Windows LPAC

**Impact:** patch

[Permanent work record](docs/changes/2026-10-06-installed-runtime-lpac-permissions.md).

##### Summary

Fix Windows isolation startup from an administrator-owned Program Files runtime without requiring ordinary users to rewrite its permissions.

##### Details

- Final deployment acceptance reproduced an installed-runtime defect: the 0.15.0 candidate passed LPAC in its user-owned build/stage directories, but the same launcher reported unavailable when run through the actual Program Files Electron executable. That runtime grants read/execute to All Restricted Application Packages, while normal users cannot rewrite its ACL.
- Reuse that existing read/execute grant for read-only runtime paths. Require the precise ARAP SID, complete read/execute rights and no intersecting deny rule. The broader All Application Packages grant remains insufficient, so the existing AAP-negative probe is preserved. Writable scratch still requires the unique container SID and low-integrity label.
- Cleanup skips files with no owned container rule rather than attempting unauthorized writes to runtime ACLs. Private source/runtime paths still receive scoped SID grants and owned cleanup. This is a compatibility repair; no isolation fallback, elevation requirement or broad host permission is introduced.
- Extend the retained isolation harness with an explicit installed executable option. It still reports actual Node/Electron boundary results and Job descendant termination. Only the owned temporary probe paths are writable.
- Preserve the staged 0.15.0 candidate and use a new 0.16.0 release for the fix. The ordinary installation remains at 0.14.0 until corrected-package acceptance completes.

##### Validation

- Before the fix, the actual Program Files executable plus source-built launcher returned available=false with an unauthorized ACL operation; its installed ARAP read/execute grant was independently inspected. No ordinary service or Project was stopped or modified by that probe.
- Native helper/service rebuild passed. `.artifacts/windows-isolation/1791327194125/report.json` passes all five boundary checks in Node, development Electron and the actual administrator-owned Program Files Electron executable under the ordinary user. The broader AAP file remains denied, scratch writes pass, and the owned worker/descendant termination check passes. No runtime ACL elevation was required. Corrected release packaging and installed acceptance are recorded separately as they finish.

##### Files

- `packages/platform-service/src/plugins/isolation/native/AppContainerHost.cs`
- `scripts/windows-isolation-acceptance.cjs`
- `docs/changes/2026-10-06-installed-runtime-lpac-permissions.md`

### Maintenance

#### Deploy and publish PlayWeld 0.16.0

**Impact:** none

[Permanent work record](docs/changes/2026-10-06-local-0.16.0-deployment.md).

##### Summary

Deploy the corrected PlayWeld 0.16.0 locally, then commit/push and publish the explicitly authorized unsigned testing prerelease with complete work records and release notes. Local deployment acceptance passed; hosted publication is recorded in its separate receipt.

##### Details

- The 0.15.0 candidate exposed an installed Program Files LPAC permissions defect before deployment. Preserve that candidate and all historical artifacts; use a new 0.16.0 minor version for the repaired source. No previous tag or published version is moved or reused.
- This release carries the cumulative provider/embedding, worker checkpoint/continuation, MCP scope/race, adversarial UI, managed Unity/Unreal/Godot, external IDE, Windows isolation and protected update work recorded in 0.11.0 through 0.15.0. The prior public release remains 0.10.2. Full records and detailed version notes remain in the tagged source and generated changelog; intermediate candidates are not presented as public releases.
- The complete [0.15.0 candidate notes](https://github.com/scarecr0w12/PlayWeld/blob/v0.16.0/docs/releases/v0.15.0.md) and [generated changelog](https://github.com/scarecr0w12/PlayWeld/blob/v0.16.0/CHANGELOG.md) are retained in the new v0.16.0 source. Candidate notes link the preceding 0.11.0-0.14.0 records. Public release prose includes the 0.15.0 feature details together with the final installed-runtime repair and deployment validation.
- Run the reusable acceptance script against the ordinary installed 0.14.0 profile. Confirm no active/nonterminal tasks before checkpointing; copy the profile and snapshot every registered Project database. Compare installed release bytes and configuration, Project, model, pool, account, credential-key, pricing and task identities after upgrade. Leave unrelated staged services and production engine Projects intact.
- Refuse missing profile/Project database paths before opening SQLite, so a bad registration cannot cause the read/backup tool to create an empty database.
- Wait for restarted IPC readiness and compare normalized serialized configuration fields. The initial post-install check ran before IPC startup; the later direct object comparison also flagged SQLite null-prototype rows against parsed JSON despite equal data. Compare each field's serialized fingerprint and keep failure diagnostics from dumping complete configuration/task histories.
- The package verifier requires the native helper, IDE/handoff runtimes, exact authored editor source and 30 bundled skills, then runs the actual packaged LPAC probe. After installation, repeat the installed runtime boundaries and desktop smoke against an isolated fixture profile.
- Commit and push the verified source, create a new annotated v0.16.0 tag, inspect the actual hosted Windows/Linux artifacts and checksum metadata, then publish the authorized unsigned testing prerelease. Publishing acceptance is recorded in a separate permanent receipt after the tagged records become immutable.
- No Windows certificate or GitHub signing secret exists. Preserve explicit unsigned/testing labels and the stable-channel exclusion; do not claim publisher trust, complete uninstall/rollback or arbitrary production acceptance.
- Staged diff review found whitespace-only context lines required by the two existing unified dependency patches. Preserve their bytes and disable whitespace diagnostics only for patches/*.patch through Git attributes; ordinary source checks retain their whitespace rules.

##### Validation

- The repaired source passed all five boundary probes through actual administrator-owned Program Files Electron as an ordinary user. Node and development Electron also passed; owned worker/descendant termination passed. The retained isolation report is recorded in the separate runtime-permissions repair record.
- Clean native npm ci applied both pinned dependency patches. The final 0.16.0 gate passed 33/33 tasks uncached: 557 platform tests/six skips and 128 extension tests. Tracking tests passed 25 checks. Formatting, generated references, inventory/evidence integrity, local links, version/lockfile agreement and release-ledger checks passed.
- Windows package verification passed native dependencies, service lifecycle, 30 skills, exact Unity/Unreal/Godot source and actual packaged Electron LPAC. The staged desktop smoke passed 29 checks with zero renderer errors at `.artifacts/documentation-electron/1791328313501`. The installer is unsigned; staging records its dirty pre-commit source fingerprints and preserves the existing 0.15.0 candidate.
- Installer exited 0 and upgraded the existing all-users Program Files installation from 0.14.0 to 0.16.0. Its SHA-256 is 4064b2444d16a09b1d732d530cace5d44684811f7fb241cebdbdc82000fe652b. Backups and authenticated before/after records are retained at .artifacts/local-deployment/0.16.0-1791327287740; all four Project databases and the complete ordinary profile were preserved before installation.
- All 417 selected installed application/service/contracts/extension files match Windows-Release/0.16.0. Native verification passed again from Program Files, including actual installed Electron LPAC. Installed desktop smoke passed 29 checks and zero renderer errors at .artifacts/documentation-electron/1791328837016.
- Ordinary service version 0.16.0 is available after deployment. Serialized retention checks passed for four Projects, 139 models, five pools, configured settings/accounts, credential-key fingerprint, pricing and all captured Project task IDs/states. The two unrelated old staged services retained their original PIDs; production editor Projects were untouched.
- The temporary IPC-startup and SQLite-prototype test failures were investigated and repaired in the acceptance tool; the final retention pass compares equal stored values, rather than ignoring a data difference. No uninstall/rollback drill or publisher signing is claimed.
- Source commit, tag and hosted publication follow these completed local checks. The publication receipt will record actual immutable tag/source, hosted results and public artifact checks after publication.

##### Files

- `.gitattributes`
- `scripts/local-deployment-acceptance.cjs`
- `docs/STATUS.md`
- `docs/RELEASE_GUIDE.md`
- `docs/changes/2026-10-06-local-0.16.0-deployment.md`

#### Prepare version 0.16.0

**Impact:** none

[Permanent work record](docs/changes/2026-10-06-release-0.16.0.md).

##### Summary

Prepare version 0.16.0 from 0.15.0, retaining all pending work records in the changelog and detailed release notes.

##### Details

Synchronize first-party workspace and internal dependency versions. The lockfile must be refreshed separately. No tag, publication, or build is performed by version preparation.

##### Validation

Clean npm ci and version/lockfile agreement passed. All 33 quality tasks passed uncached with 557 platform tests/six skips and 128 extension tests; 25 tracking checks, formatting, generated references/inventory/evidence, links and change coverage passed. Windows packaging, exact bundled editor source, native resources, service startup, actual packaged/installed LPAC, 29 staged and 29 installed desktop checks passed. The ordinary all-users 0.14.0-to-0.16.0 upgrade retained four Projects, 139 models, five pools, configuration/accounts/key fingerprints/pricing and task identities; 417 installed files match the stage. See the local deployment record for retained paths and installer hash. The installer is unsigned. Hosted publication is a separate receipt; uninstall/rollback and publisher trust remain unverified.

##### Files

- `packages/archive-extractor/package.json`
- `packages/contracts/package.json`
- `packages/platform-service/package.json`
- `packages/plugin-sdk/package.json`
- `packages/service-client/package.json`
- `packages/theia-control-room/package.json`
- `packages/plugins/sample-hello/package.json`
- `apps/control-room/package.json`
- `apps/control-room-browser/package.json`
- `package-lock.json`

## 0.15.0

### Added

#### External IDE MCP and native Theia router adapters

**Impact:** minor

[Permanent work record](docs/changes/2026-10-06-external-ide-and-theia-adapters.md).

##### Summary

Implement the previously missing local external-IDE MCP server and native Theia language-model/tool contributions, verified through real SDK stdio/service integration and the rendered desktop registry.

##### Details

- Add `gamecrafter-mcp`, a newline stdio MCP executable bound to an explicit registered Project. Startup uses local authenticated service discovery without passing a token in arguments. Modern discovery and legacy initialization expose live tool definitions; calls use the existing broker and its permissions, approvals, records and containment.
- Stable hashed MCP tool names preserve original IDs in descriptions. Native tool schemas are wrapped under an `input` object property, retaining union/scalar validation while meeting the MCP SDK schema contract. Unknown tools and attempts to replace the Project/argument envelope are rejected.
- Add one frontend Theia `LanguageModel` contribution forwarding to the service router and two broker tool contributions. Workspace-derived selection rejects empty or ambiguous context; explicit registered context is validated. Model tool calls use the captured Project and service broker rather than injected Theia callbacks.
- Map text/tool conversation messages, usage and completed tool results, with a bounded eight-turn loop, cancellation checks and checks before subsequent mutations after workspace changes. Unsupported image/provider-specific messages are rejected rather than silently dropped. Service completion is buffered; this is not a new provider token-stream implementation.
- Add the exact existing Theia AI core 1.75.0 dependency and refresh workspace lock metadata for that dependency and the new MCP bin. Registry metadata confirms its 2026-08-27 publication, older than seven days; no Theia version upgrade or provider/model override occurred.
- Extend the rendered adversarial audit with a synthetic local model account, actual native Theia registry lookup and service-routed completion. Fixtures remain isolated from ordinary profiles and paid accounts.
- Compatibility and migration: package identities, service authentication and persisted Project/tool records remain unchanged. The new CLI and adapter APIs are compatible additions. Existing Control Room Chat/Swarm paths retain their implementations; this warrants minor impact.

##### Validation

- Real MCP SDK stdio integration passed against an isolated actual service: tool listing/calling, selected-Project reads, foreign file refusal, unknown tool refusal, retained broker history and no service token in results/stderr. The initial SDK check caught non-object native schemas; the envelope repair passes.
- Four native Theia adapter unit tests passed, including service routing/usage, broker calls, cancelled/changed/empty context and unsupported/foreign callback refusal.
- The combined repository gate passed 33/33 tasks, with 557 platform tests/six skips and 128 extension tests. The real source-built desktop audit passed 196 checks with zero findings or renderer exceptions at `.artifacts/adversarial-electron/1791322029053/report.json`, including registry discovery, service-routed native model completion and registered broker tool providers.
- Personal external IDE setup, provider token streaming, images, and transport-level cancellation are not claimed as verified. The registry completion uses a labeled local HTTP model fixture, not a new paid provider call.

##### Files

- `packages/platform-service/src/mcp/external-ide-server.ts`
- `packages/platform-service/src/mcp/external-ide-server.test.ts`
- `packages/platform-service/package.json`
- `packages/theia-control-room/src/common/theia-model-adapter.ts`
- `packages/theia-control-room/src/common/theia-model-adapter.test.ts`
- `packages/theia-control-room/src/browser/theia-model-contribution.ts`
- `packages/theia-control-room/src/browser/control-room-frontend-module.ts`
- `packages/theia-control-room/package.json`
- `package-lock.json`
- `scripts/adversarial-ui-audit.cjs`
- `docs/EXTERNAL_IDE_INTEGRATION.md`
- `docs/changes/2026-10-06-external-ide-and-theia-adapters.md`

#### Managed Unity, Unreal and Godot editor bridges

**Impact:** minor

[Permanent work record](docs/changes/2026-10-06-managed-editor-bridges.md).

##### Summary

Add project-local Unity and Godot editor bridges and install/pair actions in the Engine panel. Extend managed installation and identity validation across all three supported engines, with real editor acceptance evidence.

##### Details

- The existing editor-bridge tools now accept an explicit Unity Project folder, Unreal .uproject or Godot project.godot inside the selected PlayWeld Project. Installation checks owned source hashes before replacing files, preserves user edits and unrelated plugins, writes protected pairing credentials and records repeatable source ownership. Existing tool IDs remain compatible.
- Unity installs a dependency-free Editor script. Godot installs and enables its addon alongside existing addons. Unreal retains its Editor-only plugin activation. Native configuration snapshots are retained before modifications; unsupported Godot plugin syntax is rejected before source writes.
- Add managed Unreal compilation through a registered matching RunUAT installation. Only trusted bundled source can be compiled; short owned scratch avoids the reproduced Windows path-length failure. Engine/source fingerprints and binary hashes permit repeat builds to reuse matching owned binaries while preserving modified/untracked files. Compilation requires closing the native editor; cancellation stops only the owned build tree.
- Unity and Godot publish authenticated loopback MCP endpoints automatically on editor startup, with bounded HTTP requests, concurrency and timeouts. Pairing decrypts credentials inside the service, stores protected MCP credentials, verifies engine/server/native Project identity and binds the live layer. Plaintext pairing credentials are absent from session metadata and tool results.
- Unity uses Windows DPAPI through the native API, current GlobalObjectId APIs, main-thread editor operations and session-owned object tracking. Asset import workers do not start a bridge. Godot supports Windows and the installed WSL Godot using Windows credential interoperability; ordinary native Linux pairing remains unsupported. Godot Undo actions preserve node ownership. Both support scene inspection, owned object creation/movement/deletion and viewport capture, without arbitrary code execution.
- Unreal inspection now enumerates bounded actor records and ownership/locations. Its scene mutation path refuses Play-in-Editor changes. Existing actor class restrictions and owned actor tags remain in force.
- The Engine panel exposes install, build and pair controls with engine-specific guidance, native-path suggestions only for proven unambiguous evidence, and an owned-object edit form. Unreal compilation after installation is enabled by default. Project changes clear native paths; completion/error/log responses are guarded against stale Project context. Automatic source application preserves modified plugin source and unsaved editor work.
- Scene inspection is bounded to 2,000 objects. Unity bounds its main-thread queue and cancels expired queued requests before they can mutate the scene; Godot rejects unsupported HTTP methods before processing tools.
- A final Unreal startup run reproduced a listener failure on port 59252, inside the host's Windows excluded range. The bridge now reserves an OS-assigned IPv4 loopback port and retries the reservation-to-HTTP-listener race up to eight times, preserving explicit loopback binding and existing listener configuration. It never falls back to a public bind.
- Godot live acceptance found that service pairing accepted project.godot but capability refresh recognized only .uproject identity files. Capability identity now recognizes the validated Godot native file as well.
- Compatibility and migration: no persisted schema or package identity changes. Unity objects created in an earlier bridge session are not granted edit ownership after reload. Scene edits remain dirty and require ordinary editor save behavior. Compatible engine/editor integration features warrant minor impact.

##### Validation

- Real Unity 6000.6.0f1 acceptance passed 11 checks at `.artifacts/editor-bridge/1791322530517-unity/report.json`: repeat installation, protected credential retention, automatic startup, verified pairing/identity, unauthenticated refusal, spawn/move, user-object refusal, owned deletion, ready live layer and viewport capture.
- Real Unreal 5.8.3 passed 14 checks at `.artifacts/editor-bridge/1791324194385-unreal/report.json`, including compilation/application through the actual managed PlayWeld tool and reuse of matching binaries, followed by the real editor operations.
- Real Godot 4.7.2 through WSL passed the equivalent 11 checks at `.artifacts/editor-bridge/1791322616619-godot/report.json`.
- Earlier failures exposed removed Unity APIs, unavailable managed DPAPI, deferred startup, WSL command quoting and the Godot capability comparison; failed artifacts remain retained. The final runs exercise actual PlayWeld broker and service calls, not fixture MCP servers.
- The combined repository gate passed all 33 tasks, with 557 platform tests/six skips and 128 extension tests. Managed installation and Engine guidance regressions passed. The source-built Electron audit passed 196 checks at 1920 x 1080, 1440 x 1000 and 1024 x 900 with no findings or renderer exceptions; the Live bridge capture was visually inspected.
- Visual inspection exposed empty-scene captures as weak evidence. The harness now supplies visible user-owned cube fixtures and retains their mutation-refusal checks; Unity/Godot reruns pass all 11 checks each. Unreal also uses an explicitly framed disposable viewport fixture. These are editor-only authoring checks, not game runtime, arbitrary Project correctness or a new packaged deployment.
- The final Unreal run passes all 14 checks after the reserved-port fix, binds to OS-assigned loopback port 63522 and captures a visibly rendered cube. Unity, Godot and Unreal viewport images were inspected directly. The earlier dark captures, unsupported fixture-only `viewmode` console attempt and reserved-port startup failure remain retained; the fixture now uses the supported camera-alignment command and explicit actor position.
- The final post-port-fix gate at `.turbo/adversarial-review/remaining-gaps-port-fix-quality.log` passes 33/33 tasks (22 verified cached tasks), including 557 platform tests/six skips and 128 extension tests. Repository formatting, generated RPC/settings references, documentation inventory/evidence integrity, local Markdown links, 0.14.0 workspace/lockfile agreement and diff checks pass. The change ledger is regenerated and coverage checked against HEAD. No new installer, hosted run or ordinary deployment is claimed.
- Update current status, dependency-plan evidence, integration instructions and documentation navigation. Historical acceptance remains labeled; no confirmed decision, release version or ordinary Project is changed.

##### Files

- `integrations/unity/PlayWeldEditor/PlayWeldEditorBridge.cs`
- `integrations/godot/PlayWeldEditor/plugin.cfg`
- `integrations/godot/PlayWeldEditor/bridge.gd`
- `integrations/unreal/PlayWeldEditor/Source/PlayWeldEditor/Private/PlayWeldEditorModule.cpp`
- `packages/platform-service/src/engines/unreal/editor-bridge-tools.ts`
- `packages/platform-service/src/engines/unreal/editor-bridge-tools.test.ts`
- `packages/platform-service/src/engines/unreal/editor-bridge-build.ts`
- `packages/platform-service/src/tools/tool-broker.integration.test.ts`
- `packages/platform-service/src/engines/engine-connector-service.ts`
- `packages/platform-service/scripts/copy-assets.cjs`
- `packages/theia-control-room/src/browser/engine-widget.tsx`
- `packages/theia-control-room/src/browser/engine-widget.test.tsx`
- `scripts/editor-bridge-acceptance.cjs`
- `docs/EDITOR_BRIDGE_ACCEPTANCE.md`
- `docs/STATUS.md`
- `docs/DEVELOPMENT_PLAN.md`
- `docs/ADVERSARIAL_SYSTEM_REVIEW.md`
- `docs/INTEGRATION_GUIDE.md`
- `docs/README.md`
- `docs/changes/2026-10-06-managed-editor-bridges.md`

#### Expose verified Meshy credit balance in account testing

**Impact:** minor

[Permanent work record](docs/changes/2026-10-06-meshy-live-balance.md).

##### Summary

Meshy account testing now returns its real credit balance through the documented authenticated balance endpoint.

##### Details

- The old adapter advertised no balance support and tested a task-list endpoint, always returning null. It now advertises balance support and uses `GET /openapi/v1/balance`, forwarding the numeric balance through the existing account-test RPC and UI.
- Finite nonnegative balances are retained, including zero; missing, negative or nonnumeric values remain unknown instead of becoming an invented credit count. Authentication/error redaction and HTTP timeout/retry behavior continue through the shared provider request helper.
- Add a real HTTP fixture regression for route/authentication, positive/zero credits and malformed balances. Update the asset-service integration and documentation asset fixtures to implement the balance route and assert its RPC result.
- Endpoint and payload were checked against [Meshy balance documentation](https://docs.meshy.ai/en/api/balance) on 2026-10-06. One authorized live `meshy-6-lite` preview/download/review/import consumed exactly five credits, matching [current pricing](https://docs.meshy.ai/en/api/pricing). This is an integration test asset, not production art approval.
- Compatible new provider capability uses minor impact; no RPC/schema migration is required because account testing already has a nullable balance field. No paid generation is added to ordinary account testing.

##### Validation

- The new fixture test failed before implementation and passed through the full combined gate afterward; the asset-service integration exercises the actual account-test RPC.
- Live balance returned 2697 credits before the single preview and 2692 afterward. The downloaded/imported GLB matched its recorded SHA-256 and unreviewed import was rejected. Both provider acceptance runs found zero plaintext source API credential leaks.
- Image/refine requests, Tripo generation, commercial rights and production mesh quality remain outside this live result. The account-test operation itself is read-only at the provider.

##### Files

- `packages/platform-service/src/assets/providers/meshy.ts`
- `packages/platform-service/src/assets/providers/providers.test.ts`
- `packages/platform-service/src/assets/asset-service.integration.test.ts`
- `scripts/documentation/asset-scenario.cjs`
- `docs/changes/2026-10-06-meshy-live-balance.md`

#### Protected release keys and verified installer handoff

**Impact:** minor

[Permanent work record](docs/changes/2026-10-06-protected-signing-and-installer-handoff.md).

##### Summary

Add protected local release-signing keys, retain verified previous installers without filename collisions and implement a Windows installer handoff after desktop exit. Publisher trust and complete installer lifecycle remain separate unverified acceptance paths.

##### Details

- Add a Windows CurrentUser DPAPI-protected Ed25519 key generator and protected-key reader. Existing key files are never overwritten; plaintext private material is not written to disk or command arguments. Release metadata can use `--signing-key-file`, while the existing configured CI secret remains supported. Ambiguous key sources are rejected; unsigned release gates and the required public platform matrix remain unchanged.
- Verification metadata lives in new versioned sidecar records; existing downloaded/previous package records retain their exact version-1 shape. Packages use separate version directories so identical installer filenames across releases cannot overwrite the rollback package. A release check captures the verified current-version package before clearing its pending download; a subsequent download also preserves that package. The store reports the actual running application version after an upgrade rather than a stale saved version.
- Signed Windows install/rollback preparation rechecks file bytes and confines packages to the owned cache. A service-owned versioned handoff descriptor records its state. Legacy records without digest/signature provenance and other platform packages retain manual instructions.
- The Electron backend starts the service's detached helper using a minimal environment, without provider secrets. The helper waits for the desktop process to exit, checks the package again immediately before launch, avoids duplicate helpers through an owned lease, records launch/failure/expiration and expires after ten minutes. It does not force-close editors or discard unsaved work.
- Additive optional RPC handoff fields preserve existing clients. Legacy package records without verification sidecars retain manual installation/rollback instructions. Generated API references are refreshed. The visible handoff and protected-key workflow warrant minor impact.
- The user reported having no Windows code-signing certificate. Local Ed25519 metadata verification is distinct from Windows Authenticode publisher trust; neither the source nor fixture tests claim a publisher-trusted installer.

##### Validation

- All 31 update-service checks passed, including retention when a newer release reuses an installer filename, versioned cache contents and verification sidecars. Seven focused handoff/key checks passed: protected-key generation and non-overwrite, valid metadata/checksum signatures, changed-byte refusal, process-exit waiting, native harmless PE launch and refusal after tampering.
- The harmless executable fixtures are retained under `.artifacts/installer-handoff-tests/` for review. Early temporary-folder cleanup failures were investigated; fixture launch and tampering behavior passed, but cross-process temporary-file ACL cleanup was not a successful acceptance result. The retained fixture layout avoids claiming that cleanup as verified.
- The combined repository gate passed 33/33 tasks, including 557 platform tests/six skips and 128 extension tests. Complete packaged install/upgrade/uninstall/rollback, public trust-key distribution, hosted matrix/publication and Authenticode signing remain pending or unavailable. No ordinary installation or user profile was replaced by these fixture tests.

##### Files

- `packages/contracts/src/updates/schema.ts`
- `packages/contracts/src/rpc/protocol.ts`
- `packages/platform-service/src/updates/installer-handoff.ts`
- `packages/platform-service/src/updates/installer-handoff.test.ts`
- `packages/platform-service/src/updates/update-service.ts`
- `packages/platform-service/src/updates/update-service.test.ts`
- `packages/platform-service/src/updates/update-store.ts`
- `packages/platform-service/src/updates/release-metadata-cli.test.ts`
- `packages/theia-control-room/src/node/control-room-service.ts`
- `packages/theia-control-room/src/browser/updates-widget.tsx`
- `scripts/release-signing-key.cjs`
- `scripts/create-release-metadata.cjs`
- `docs/API_REFERENCE.md`
- `docs/RELEASE_GUIDE.md`
- `docs/reference/rpc-methods.json`
- `docs/reference/rpc-schemas.json`
- `docs/changes/2026-10-06-protected-signing-and-installer-handoff.md`

### Fixed

#### Keep Project views isolated and clarify engine readiness

**Impact:** patch

[Permanent work record](docs/changes/2026-10-06-project-view-isolation-and-guidance.md).

##### Summary

Repair obsolete asynchronous responses, stale Project evidence, narrow dock overflow and misleading Engine readiness guidance across the Control Room.

##### Details

- Engine and DCC Project loads now capture Project/tool context and request generations. Old responses and failures cannot overwrite the selected context; clearing the selection removes capability, bridge and run evidence. DCC errors are caught instead of escaping event handlers. Same-context refresh preserves selected run evidence and action results.
- Assets library refresh guards its snapshot and busy state. Context changes clear old files/jobs, previews, review notes and the source-job selection. Preview requests have their own generations; generation, review/cancel and import completion are ignored after navigation, including the follow-up imported preview.
- A final deferred-submit regression reproduced two paid generation RPCs from repeated clicks while the first was pending. Generate now refuses an already-busy submission and immediately renders the disabled state. This repairs UI duplication; provider idempotency/recovery after ambiguous remote failures remains separate open work.
- Knowledge guards status, record list, vector settings, search, record detail and graph publication against changed context. A context change clears the old index/records/graph/search evidence, while a same-Project refresh preserves selected content. Refresh snapshots have their own generation and overlapping busy operations are counted. Three additional regressions reproduced offline status/records/settings notification failures; these now produce a scoped error instead of an uncaught asynchronous rejection, and obsolete errors are ignored.
- Skills, Plugins and Connections publish only the latest context snapshot. Plugins fetch context-specific tools with the snapshot instead of accepting a later independent tool result. Explicit Connections scope changes also clear tool/log caches and selection.
- Shared CSS bounds fields, labels, forms and fieldsets; wraps actions and heading text; gives Engine/DCC tables their own horizontal scroll; stacks relevant narrow grids; and avoids form rules stretching checkboxes/radios. This repairs observed narrow dock overflow without hiding oversized content.
- Engine guidance now explains that missing native game files must be supplied before installation can make operations usable. Capability badges count layers and operation badges count available operations instead of all unavailable definitions. The native installation form remains available in its own section.
- Add eighteen response/failure-isolation regressions, one Engine guidance regression and one duplicate paid-submission regression. Existing Assets/Knowledge fixtures initialize the new counters to match constructed widgets.
- Compatible visible fixes require a patch impact. No data/RPC schema migration or compatibility-identifier rename is required. Existing service ownership and deliberate Project selection are preserved.

##### Validation

- Reordered-response regressions first failed for Engine, DCC, Assets and Knowledge; three additional regressions failed for Skills, Plugins and Connections. The repaired response suite passes; existing import/generation tests remain covered.
- Uncached full gate passed 33/33 before later follow-ups; the final combined gate passed all 33 tasks with 542 platform tests/11 skips and 124 extension tests, including the three offline-notification regressions and duplicate-generation case. Twenty-five unchanged tasks use verified cache entries; the fresh platform run is retained separately.
- Larger-window browser and development Electron audits each passed 195 rendered checks with zero renderer exceptions. The final guidance text/count correction passed another 195-state Electron recheck; the updated local asset workflow also passed. Offline failures use deterministic regressions, not a live provider outage claim.
- Narrow 480-pixel stress captures are retained as supplemental evidence. They are not normal desktop acceptance; full accessibility, production engine UI and installer verification are not claimed.

##### Files

- `packages/theia-control-room/src/browser/assets-widget.tsx`
- `packages/theia-control-room/src/browser/assets-widget.test.tsx`
- `packages/theia-control-room/src/browser/connections-widget.tsx`
- `packages/theia-control-room/src/browser/dcc-widget.tsx`
- `packages/theia-control-room/src/browser/engine-widget.tsx`
- `packages/theia-control-room/src/browser/engine-widget.test.tsx`
- `packages/theia-control-room/src/browser/knowledge-widget.tsx`
- `packages/theia-control-room/src/browser/knowledge-widget.test.ts`
- `packages/theia-control-room/src/browser/plugins-catalog-widget.tsx`
- `packages/theia-control-room/src/browser/skills-widget.tsx`
- `packages/theia-control-room/src/browser/style/workstation.css`
- `packages/theia-control-room/src/browser/project-view-isolation.test.ts`
- `docs/changes/2026-10-06-project-view-isolation-and-guidance.md`

### Security

#### Pin and verify the patched MCP fixture SDK resolution

**Impact:** none

[Permanent work record](docs/changes/2026-10-06-patched-mcp-sdk-resolution.md).

##### Summary

Use the published patched MCP TypeScript SDK in the development/fixture dependency tree and detect stale nested installations.

##### Details

- Update the platform-service's exact development dependency from 1.30.0 to 1.31.0 and add a matching root override so shared consumers resolve the same selected version. Version 1.31.0 was published 2026-09-28, satisfying the seven-day preference on this review date.
- The newly listed [OAuth issuer-binding advisory](https://github.com/advisories/GHSA-6qxp-vccf-f47h) affects earlier SDK clients that use OAuth credentials with untrusted HTTP MCP servers. This repository's product MCP implementation is custom; the SDK is a development fixture dependency. The dependency finding is not presented as a reproduced credential leak in PlayWeld.
- A lockfile-only refresh and clean install retained an invalid nested 1.30.0 SDK. An exact workspace install corrected that resolution; the root override prevents a separate newer shared SDK from drifting beyond the selected pin. Preserve the existing braces/sprintf patches and the unified Theia version.
- Add a regression that resolves the SDK entry actually loaded from the platform-service and reads that installation's version, requiring it to match the exact declaration and meet the patched minimum. This catches installed-tree disagreement that a manifest-only assertion would miss.
- Internal development dependency maintenance uses no product version impact; no service/RPC/data migration or compatibility rename is required. The package lock records the exact resulting resolution.

##### Validation

- Checked the advisory and npm publication metadata. Before correction, `npm ls` reported the nested 1.30.0 installation invalid against the 1.31.0 declaration; afterward it reports 1.31.0 overridden.
- Clean `npm ci` successfully reapplied both existing local dependency patches. The resolved-version guard and MCP suite passed 65 tests across 14 files. Final full dependency audit reports 19 entries (10 high, nine moderate, zero critical), all rooted in the existing locally patched braces/sprintf packages. Actual evidence is retained under `.turbo/adversarial-review/`.
- Remaining registry advisories from the locally patched braces/sprintf versions must still be reported; neither package had an upstream patched release during this pass. This change is not a comprehensive security certification.

##### Files

- `package.json`
- `package-lock.json`
- `packages/platform-service/package.json`
- `packages/platform-service/src/dependencies/mcp-sdk-version.test.ts`
- `docs/changes/2026-10-06-patched-mcp-sdk-resolution.md`

#### Native Windows plugin isolation

**Impact:** minor

[Permanent work record](docs/changes/2026-10-06-windows-plugin-isolation.md).

##### Summary

Replace the Windows unavailable stub with a native less-privileged AppContainer launcher, with real Node/Electron boundary probes and shared Node/Python plugin lifecycle checks.

##### Details

- The plugin host now starts a suspended Windows worker with explicit container permissions, a minimal environment, an inherited stdio handle list and a Job limiting memory and process count. The Job kills descendants when the helper closes. Plugin source is read-only; writes are confined to separate owned scratch storage. Project files are accessed through the existing broker rather than mounted into the worker.
- The build compiles a small .NET Framework helper on Windows and copies it with the service. Non-Windows builds retain their existing launchers. Native helper errors keep isolation unavailable; there is no automatic unrestricted fallback.
- The probe executes Node inside the sandbox and requires denial of a private host file, an All Application Packages readable fixture, source modification and an owned loopback connection, together with a successful scratch write. It uses the documented AppContainer creation attributes; Win32 token query class 46 proved unsupported on this machine, so LPAC opt-out is checked behaviorally rather than inferred from that failed query.
- Node requires the OS registryRead capability to initialize Winsock; network capability remains separately controlled. Node module loading preserves symlink names to avoid inspecting drive roots. Default Python names resolve through the installed Windows Python launcher instead of an unusable Windows Store alias. Electron Node mode receives the equivalent Node options.
- Native stdio writes flush each RPC chunk. An initial lifecycle run exposed buffering that the exit-only probe did not exercise. Native ACL updates use per-path locks so concurrent helpers preserve each other's SID rules; cleanup removes only the owned SID, and native pipe handles close on failed startup.
- Shared plugin lifecycle tests now exercise the native Windows backend. The panel escape test uses a Windows junction instead of requiring privileged file symlink creation; Linux keeps its original fixture.
- Compatibility and migration: plugin manifests, broker contracts and stored records are unchanged. The new backend enables previously unavailable restricted Windows execution. The feature warrants minor impact; this is scoped isolation evidence, not a general security certification.

##### Validation

- Native helper compilation and TypeScript build passed. The live five-check LPAC probe passed on Windows, including private-file, All Application Packages, source-write and network denial plus scratch writes.
- Initial lifecycle failures are retained: stdio buffering, the Store Python alias and a Linux-only file symlink fixture. These were corrected; 16 focused isolation, plugin lifecycle and managed-install checks passed with two explicit Linux-only skips. The full repository checks passed as recorded below.
- The retained live report `.artifacts/windows-isolation/1791318379431/report.json` passed all five boundary checks in both Node and actual Electron Node mode. Turbo service build inputs include bundled integrations/skills and Windows build environment; tests depend on the service build so CLI/helper fixtures use current artifacts.
- The combined repository gate passed 33/33 tasks: 557 platform tests passed with six explicit skips, and 128 extension tests passed. Service builds include the compiled helper. A new packaged installer, adversarial process/memory-limit exhaustion, allowed outbound networking and alternate Windows versions remain unverified.
- `.artifacts/windows-isolation/1791324154239/report.json` repeats all five Node/Electron boundary checks and proves that terminating the owned helper kills both its worker and spawned descendant. The early workspace-scratch attempt failed because its managed ACL denied mandatory-label changes; native execution stayed fail-closed. The passing descendant fixture uses an owned temporary directory with those permissions; its path is retained in the report. This does not prove that every custom profile ACL supports LPAC scratch setup.

##### Files

- `packages/platform-service/src/plugins/isolation/native/AppContainerHost.cs`
- `packages/platform-service/src/plugins/isolation/appcontainer-launcher.ts`
- `packages/platform-service/src/plugins/isolation/isolation.test.ts`
- `packages/platform-service/src/plugins/plugin-service.integration.test.ts`
- `packages/platform-service/scripts/build-appcontainer.cjs`
- `packages/platform-service/scripts/copy-assets.cjs`
- `turbo.json`
- `scripts/windows-isolation-acceptance.cjs`
- `docs/changes/2026-10-06-windows-plugin-isolation.md`

### Documentation

#### Refresh documentation surface inventory

**Impact:** none

[Permanent work record](docs/changes/2026-10-06-documentation-inventory-refresh.md).

##### Summary

Regenerate the documentation inventory so discovery and evidence checks include the current service source tree.

##### Details

- The documentation evidence check found that the retained inventory omitted the existing dependencies subsystem. Regenerate both inventory outputs with the existing generator.
- Refresh discovered regression-test paths for current engine and worker sources, including the later managed-editor and installer-handoff tests. The generator continues to describe test paths as discoverability, not acceptance.
- No generator, runtime, schema, version, compatibility, or migration changes.

##### Validation

- Initial node scripts/check-documentation-evidence.cjs failed because the inventory did not include the dependencies directory already present before this task.
- node scripts/generate-documentation-inventory.cjs and its --check mode passed.
- node scripts/check-documentation-evidence.cjs passed after regeneration: 198 methods, 28 notifications, 85 settings, 26 service subsystems, 16 Control Room surfaces, 10 capture reports, and 151 referenced PNG files.
- These checks establish inventory/report/file integrity only. They do not validate prose layout or repeat historical live workflows.
- Repository link check and changelog coverage check against HEAD passed. Generated inventory freshness passed. No historical report or screenshot was regenerated.

##### Files

- `docs/reference/DOCUMENTATION_INVENTORY.md`
- `docs/reference/documentation-inventory.json`
- `docs/changes/2026-10-06-documentation-inventory-refresh.md`

#### Improve documentation readability and navigation

**Impact:** none

[Permanent work record](docs/changes/2026-10-06-documentation-readability.md).

##### Summary

Organize PlayWeld's README and main guides around reader tasks, with clearer setup instructions, navigation, and tutorial outcomes.

##### Details

- Rewrite the root README to introduce PlayWeld in plain language, offer task-based starting points, and present desktop setup before development-browser instructions. Retain compatibility naming, license, project resources, and links to design authority and current capability evidence.
- Reorganize the documentation index into goals, learning, audience guides, references, releases, design authority, and verification. Replace copied method/setting counts and historical test totals with links to the owning references and reports.
- Add task navigation to the user, operations, developer, integration, Control Room, and workflow guides. Preserve all pre-existing section headings and their anchors.
- Turn Project creation and settings precedence into readable steps and split dense model-routing prose without changing those rules.
- Replace blanket provider/release acceptance statements in the User Guide with links to dated status, work, and release records so the overview does not flatten operation-specific evidence.
- Add tutorial prerequisites, a linked walkthrough, completion checkpoints, and a troubleshooting route. Move detailed historical screenshot context into dedicated evidence sections in the tutorial and handbook; retain a short notice near the top.
- Add contributor guidance for reader-focused documentation: prerequisites, commands, UI names, success checks, stable links, and evidence limits. Move the work-record instructions into contribution review.
- Preserve existing uncommitted User Guide continuation instructions and Integration Guide first-party Unreal bridge documentation. No runtime, contract, dependency, decision status, version, or migration changes are part of this editorial task.
- This pass covers the primary entry points and guides. It does not rewrite every design document, research note, generated reference, or historical acceptance report.

##### Validation

- Full repository build/typecheck/lint/test gate passed: 33 of 33 tasks, all served from the existing Turborepo cache. Dependencies were already installed; npm ci was not rerun against the shared active checkout.
- Repository format check passed. The explicit Markdown formatting pass covers the edited guides and records, which the repository-wide format command normally ignores.
- The repository link checker passed. Existing guide section headings and anchors were retained; new navigation targets resolve. Reviewed the editorial diffs, setup command names, screenshot-context relocation, and retained uncommitted additions.
- Changelog generation and changelog coverage check against HEAD passed. The documentation evidence check passed after the separately recorded inventory refresh.
- No new screenshots, live-engine, model-provider, installer, or usability-study evidence was collected. Historical screenshot evidence remains historical.

##### Files

- `README.md`
- `docs/README.md`
- `docs/USER_GUIDE.md`
- `docs/OPERATIONS_GUIDE.md`
- `docs/DEVELOPER_GUIDE.md`
- `docs/INTEGRATION_GUIDE.md`
- `docs/WORKFLOW_COOKBOOK.md`
- `docs/CONTROL_ROOM_HANDBOOK.md`
- `docs/WORKED_TUTORIAL.md`
- `docs/changes/2026-10-06-documentation-readability.md`

### Maintenance

#### Run adversarial desktop, workflow, engine and provider acceptance

**Impact:** none

[Permanent work record](docs/changes/2026-10-06-adversarial-system-audit.md).

##### Summary

Add repeatable broad UI/provider acceptance, execute current local and live checks, and record repaired defects and remaining completion boundaries.

##### Details

- Add a real isolated-service audit covering Project Home and all fifteen views, primary/nested sections, three desktop sizes, field names, duplicate IDs, missing section targets, horizontal containment and renderer exceptions. Each state retains a screenshot and report; view failures are collected so later views still run.
- The audit supports owned development Electron and browser targets, uses two disposable Projects including a long name, validates trust only for those folders, and closes only owned resources. Primary review uses 1920x1080, with 1440x1000 and 1024x900 secondary sizes; optional `--stress` adds 650 pixels. Earlier 480-pixel captures are preserved as supplemental evidence, not normal desktop quality.
- Correct the pre-existing workspace smoke to count selected buttons within independent navigation groups. Update live-engine acceptance to report the workspace version instead of 0.1.0 and reject unknown stages.
- Add live provider acceptance that reads existing encrypted credentials only in memory, re-encrypts them in a separate profile, selects configured enabled chat models, probes completion/streaming/tool calls/embeddings, and compares ordinary Project/account/model/pool/asset-account identities around the run. Scan all retained test artifacts for plaintext source API keys.
- Paid asset generation is off by default. With explicit session authorization and `--paid-assets`, the script requires a sufficient verified Meshy balance and selects one five-credit geometry preview, download/hash/GLB checks, unreviewed import rejection, explicit review and exact-byte isolated import. No paid retry/refine loop or production art promotion is added.
- The first live stream assertion revealed a test assumption: source streaming metadata was unknown, so complete-response delivery was correctly selected. The corrected disposable probe explicitly enables streaming there; ordinary capabilities remain unchanged. The first paid preview result is retained separately and the corrected run performs no additional paid generation.
- Add the dated system review matrix and current status/index pointers, preserving historical release/workflow evidence and describing still-unimplemented Windows isolation, external IDE integration, release lifecycle and external verification debt. Correct the stale statement that 0.9.0 is the ordinary current version, qualify the earlier zero-high/critical audit as historical and report the current patched-package advisory count; repair snapshot spacing. No work package or user-owned decision is marked complete/confirmed.
- Investigation/testing/documentation tooling uses none impact. Product remains 0.14.0 pending release preparation; no installer, publication, profile migration or compatibility identifier change is produced.

##### Validation

- Larger desktop browser/Electron audits each passed 195 rendered checks with no findings or renderer exceptions. Corrected workspace navigation/theme/keyboard smoke passed. The full disposable workflow suite passed 30 checks and retained 45 captures.
- Fresh D-drive Unreal fixture compiled; 14 Unity/Unreal identity/access/version/automation checks passed. Real Blender export/render and Python-failure classification passed in the full native suite.
- Live OpenAI authentication/discovery, completion, streamed deltas, tool response and 1536-dimensional embedding passed. Live Meshy balance/generation/download/review/import passed with five observed credits consumed. Both provider runs retained ordinary identities and found zero plaintext API-key leaks.
- The final repository gate passed 33/33 with 542 platform tests/11 explicit skips and 124 extension tests, including three offline Knowledge notification regressions and the duplicate-generation regression. Twenty-five unchanged tasks use their verified cache results; actual browser/Electron builds passed. Final results and exact paths are recorded in `docs/ADVERSARIAL_SYSTEM_REVIEW.md`. Failures and narrower stress results remain preserved rather than silently discarded.
- Markdown links and permanent-record/changelog coverage passed. An earlier formatting check passed; the final combined formatting/version/documentation-reference check was declined through command approval and did not run. The repository excludes docs/scripts from Prettier, so those artifacts were directly reviewed rather than treating formatting success as their layout evidence.
- This does not certify all target architecture, Windows AppContainer, signed release/installer lifecycle, arbitrary external providers, assistive technology, production game/art or performance behavior. The review explicitly retains those gaps.

##### Files

- `scripts/adversarial-ui-audit.cjs`
- `scripts/adversarial-provider-acceptance.cjs`
- `scripts/workspace-overhaul-ui-smoke.cjs`
- `scripts/live-engine-acceptance.cjs`
- `docs/ADVERSARIAL_SYSTEM_REVIEW.md`
- `docs/STATUS.md`
- `docs/README.md`
- `docs/changes/2026-10-06-adversarial-system-audit.md`

#### Retain full task detail in the versioned changelog and agent workflow

**Impact:** none

[Permanent work record](docs/changes/2026-10-06-full-changelog-agent-contract.md).

##### Summary

Generate a complete central changelog from permanent task records and require future agents to document each meaningful outcome and its version impact in detail.

##### Details

- Previously the central changelog flattened each task's Summary into one paragraph and linked to its separate record for details. It now includes the full Summary, Details, Validation, and exact Files list under the task's version and category, retaining the source-record link. Multiline prose, lists, examples, and validation limitations remain available directly in CHANGELOG.md.
- Rebase local Markdown links from the task record directory to the central changelog location, including links to record-local anchors. Preserve external links and fenced code verbatim; nest embedded headings beneath the task sections.
- Strengthen AGENTS.md and the tracking contract so a summary paragraph cannot substitute for complete Details. Require concrete triggers and before/after behavior, rationale, all meaningful outcomes, explicit compatibility/migration/removal effects, version-impact rationale, actual commands/results, skipped checks, and evidence limits. Require review against the whole task diff; path coverage cannot establish prose accuracy or completeness.
- Expand the task template to prompt for these details and clarify the release guide's full-changelog requirement. Separate permanent task records and per-version release notes remain required. The central changelog can be read in full without following task links.
- Add a regression test that exercises multiline detail, nested headings, code fences, local and external links, validation, exact file lists, and complete entry retention when release preparation moves pending work into a numbered version. Existing coverage, record immutability, and version-impact checks remain in place.
- Compatibility and migration: no application, public API, persisted-data, schema, dependency, or package-version change. Historical task records and per-version release-note content remain preserved. Regenerate the central changelog from existing recorded evidence; do not fabricate missing historical detail.
- Impact rationale: none, because this is repository maintenance and generated documentation, with no shipped application behavior change. Keep the current version while this record is pending; a later release must assign pending records using release:version and satisfy the highest recorded impact.
- Preserve unrelated pending source/documentation/release work already present in the shared checkout. This record covers only the changelog generator, its regression coverage, and the documentation of this workflow.

##### Validation

- Full repository build/typecheck/lint/test gate passed: 33 of 33 tasks, all served from the existing Turborepo cache. Dependencies were already installed; npm ci was not rerun against the shared active checkout.
- npm run test:changes passed: 25 tests across two files, including complete central entry rendering and existing version/coverage/immutability gates.
- npm run format:check and an explicit Prettier check of the changed scripts, instructions, guide, template, and task record passed. The explicit check includes paths ignored by the repository-wide formatter.
- npm run changelog:update and npm run changelog:check -- --base HEAD passed; git diff --check passed. Source review confirmed all 78 saved task records render as 78 complete central entries across 17 release groups, including Unreleased. Existing generated per-version release-note content was unchanged by regeneration.
- node scripts/check-release-version.cjs passed for the unchanged 0.14.0 workspace/lockfile versions. The new maintenance record remains Unreleased; no pending work was assigned by this task.
- Invoked scripts/check-links.sh using Git Bash. The owned scan remained active for over twenty minutes without completing or reporting errors; stopped that verified process tree after substituting an equivalent in-process scan. The substitute applied the shell checker's file/anchor, fenced-code, heading-slug, and external-link rules across all 268 Markdown inputs and 1,322 relative links: zero errors. The original shell command did not complete; its pass is not claimed. No link-checker source was changed.
- No installer, release preparation, tag, publication, engine/provider integration, or production acceptance was performed for this maintenance task. Automated checks cannot prove the truth or completeness of natural-language records; agent/reviewer diff review remains required.

##### Files

- `AGENTS.md`
- `CHANGELOG.md`
- `docs/RELEASE_GUIDE.md`
- `docs/changes/README.md`
- `docs/changes/TEMPLATE.md`
- `docs/changes/2026-10-06-full-changelog-agent-contract.md`
- `scripts/change-tracking.cjs`
- `scripts/change-tracking.test.ts`

#### Verify and retain the PlayWeld 0.15.0 candidate

**Impact:** none

[Permanent work record](docs/changes/2026-10-06-local-0.15.0-deployment.md).

##### Summary

Prepare and verify a local PlayWeld 0.15.0 candidate, then preserve it when installed-runtime acceptance exposes an LPAC permissions defect. The corrected 0.16.0 release supersedes this candidate; 0.15.0 was not installed or published.

##### Details

- The user explicitly requested local deployment, commit/push and a release with proper notes. Preserve all existing version records and tags. The 0.15.0 candidate collects the current compatible editor/IDE/isolation/update features and review repairs without changing GameCrafter package, installation, profile or application identities.
- The prior public release is 0.10.2. This source also contains the later provider/embedding, checkpoint/continuation, MCP scope/race and first-party Unreal work recorded under the retained 0.11.0 through 0.14.0 notes. Those historical records remain intact; no historical tag or artifact is overwritten. The published body uses the full generated 0.15.0 notes and references the cumulative earlier records.
- Cumulative records included in this source are [0.11.0](https://github.com/scarecr0w12/PlayWeld/blob/v0.16.0/docs/releases/v0.11.0.md), [0.12.0](https://github.com/scarecr0w12/PlayWeld/blob/v0.16.0/docs/releases/v0.12.0.md), [0.13.0](https://github.com/scarecr0w12/PlayWeld/blob/v0.16.0/docs/releases/v0.13.0.md) and [0.14.0](https://github.com/scarecr0w12/PlayWeld/blob/v0.16.0/docs/releases/v0.14.0.md). These links identify records in the new tagged source; they do not claim that those intermediate versions were publicly released.
- Strengthen Windows package verification to require the native isolation helper, external IDE and handoff executables, and exact authored Unity/Unreal/Godot plugin source bytes. This prevents a new package from silently shipping only the old Unreal integration or omitting a new runtime entry point.
- Add a reusable Windows deployment acceptance script for authenticated preflight, nonterminal-task refusal, checkpointed shutdown, profile/Project snapshots, installed byte comparison and retained configuration/task identities. Preflight passed at this candidate stage; shutdown, backups and installation are performed only for the corrected 0.16.0 release.
- No publisher certificate or GitHub signing secret is configured. Release artifacts will be explicitly labeled unsigned/testing; checksums establish byte integrity, not publisher authentication. Signed metadata handoff remains distinct from this manually accepted local installer upgrade.

##### Validation

- Preflight: GitHub authentication is available; main and origin/main agree; existing ordinary service reports 0.14.0 with four registered Projects. The initial active-work query used an incorrect field and was replaced by a schema-based state query before any shutdown.
- The preflight script initially used the platform settings table name for Project settings and failed read-only inspection. It was corrected to the actual settings_overrides table; the rerun confirms four Projects, zero nonterminal tasks and captured configuration/task fingerprints. No service shutdown occurred during that failed inspection.
- Redacted source scan found no OpenAI/GitHub/AWS credential patterns in 165 changed/untracked source files. No credential contents are printed or included in the notes.
- Clean npm ci applied the pinned dependency patches. All 33 quality tasks passed uncached, with 557 platform tests/six skips and 128 extension tests. Tracking tests passed 25 checks; formatting, version/lockfile agreement, generated references, inventory/evidence, links and release-ledger checks passed. The registry still reports 19 advisories associated with the locally patched upstream dependencies.
- Built/staged the unsigned 0.15.0 NSIS candidate; SHA-256 is 5cfb42b27ddc9505eb6aa38458d5a232f0e5be2a1cbdfeee3b9e5f7b2c854016. Native/package source checks and packaged Node-mode LPAC passed. The staged desktop smoke passed 29 checks with zero renderer errors at .artifacts/documentation-electron/1791327068877.
- The Program Files runtime probe then failed with an unauthorized ACL operation, despite its existing ARAP read grant. Preserve Windows-Release/0.15.0 and the failed diagnosis; repair this in the separately recorded 0.16.0 source. No 0.15.0 ordinary installation, tag or public release occurred.

##### Files

- `apps/control-room/scripts/verify-windows-native.cjs`
- `scripts/local-deployment-acceptance.cjs`
- `docs/STATUS.md`
- `docs/RELEASE_GUIDE.md`
- `docs/changes/2026-10-06-local-0.15.0-deployment.md`

#### Prepare version 0.15.0

**Impact:** none

[Permanent work record](docs/changes/2026-10-06-release-0.15.0.md).

##### Summary

Prepare version 0.15.0 from 0.14.0, retaining all pending work records in the changelog and detailed release notes.

##### Details

Synchronize first-party workspace and internal dependency versions. The lockfile must be refreshed separately. No tag, publication, or build is performed by version preparation.

##### Validation

Clean npm ci, lockfile/version agreement, all 33 uncached quality tasks, 25 tracking checks, formatting, references/inventory/evidence, links and change coverage passed. Windows package/native/source and staged Electron checks passed. The later Program Files runtime probe exposed an unauthorized ACL operation, so the 0.15.0 candidate was preserved and superseded by the corrected 0.16.0 deployment. This candidate was not installed, tagged or published. See the candidate and runtime-permissions records for actual hashes, retained failures and scope.

##### Files

- `packages/archive-extractor/package.json`
- `packages/contracts/package.json`
- `packages/platform-service/package.json`
- `packages/plugin-sdk/package.json`
- `packages/service-client/package.json`
- `packages/theia-control-room/package.json`
- `packages/plugins/sample-hello/package.json`
- `apps/control-room/package.json`
- `apps/control-room-browser/package.json`
- `package-lock.json`

## 0.14.0

### Security

#### Bound vulnerable dependency inputs and apply compatible fixes

**Impact:** patch

[Permanent work record](docs/changes/2026-10-05-dependency-advisory-remediation.md).

##### Summary

Upgrade six transitive dependencies and persist narrow local fixes for two advisories without upstream patched releases, preserving the pinned Theia version and existing CommonJS contracts.

##### Details

- Exact overrides: DOMPurify3.4.16, http-cache-semantics4.3.0, source-map-js1.2.2, diff8.0.4, uuid11.1.1 and @tootallnate/once2.0.1. Security exceptions to the preferred seven-day age apply to http-cache-semantics (published October4) and source-map-js (September30); other selected releases exceed seven days. No Theia downgrade or blanket forced audit repair.
- Pin patch-package8.0.1 as a direct development dependency and apply version-specific patches during postinstall with error-on-fail. Brace parsing rejects nesting beyond 128; compile/expand/stringify AST walkers reject depth above128 before native stack exhaustion. Ordinary glob behavior remains intact; exceptionally deep expressions now fail with a controlled depth-limit error.
- Clamp sprintf numeric precision for e/f to 0..100 and g to 1..100. Preserve explicit zero precision and string truncation behavior; extreme numeric precision no longer throws native digit-range errors.
- Advisory sources: <https://github.com/advisories/GHSA-vfj7-8cjw-p6xm>, <https://github.com/advisories/GHSA-hp3w-g68c-fv3c>, <https://github.com/advisories/GHSA-ch52-4w7c-c8xp>, <https://github.com/advisories/GHSA-68fv-2mgg-jv7q>. This is scoped remediation, not a comprehensive security certification.
- Preparation 0.13.0 preceded these findings and was not packaged. The next prepared build includes that source plus this repair; historical preparation records remain intact.

##### Validation

- Two regressions first failed: unbounded brace nesting and native sprintf RangeError. Both passed after patches, including deep AST compile/expand/stringify, parentheses, normal glob expansion, zero/large numeric precision and string truncation.
- Clean npm ci applied both persisted patches successfully. npm update of only the six named packages refreshed stale locked transitive entries; npm ls confirmed every installed consumer uses the selected versions without invalid dependencies.
- Audit decreased from 66 (5low, 49moderate, 12high) to 19 (9moderate, 10high). All remaining entries derive from the two locally patched packages; the registry still flags their unchanged upstream version numbers. Do not report a clean registry audit. Before/after JSON retained in ignored local evidence.
- Final clean npm ci applied both patches. Full native repository quality gate passed 33/33, including540 passing platform tests/11 skips. Windows packaging/native checks and29 packaged Electron smoke checks passed with zero renderer errors. An initial content harness correctly rejected resolving development dependencies from inside the package: braces/sprintf-js are absent as standalone packaged modules, so its corrected report records that boundary rather than claiming packaged execution. Bundle creation occurred after the clean-install patch regressions passed. Ordinary installed 0.14.0 passed 29 desktop smoke checks with zero renderer errors and retained its native profile state after upgrade.

##### Files

- `package.json`
- `package-lock.json`
- `patches/braces+3.0.3.patch`
- `patches/sprintf-js+1.1.3.patch`
- `packages/platform-service/src/dependencies/advisory-regressions.test.ts`
- `docs/changes/2026-10-05-dependency-advisory-remediation.md`

### Maintenance

#### Prepare version 0.14.0

**Impact:** none

[Permanent work record](docs/changes/2026-10-05-release-0.14.0.md).

##### Summary

Prepare version 0.14.0 from 0.13.0, retaining all pending work records in the changelog and detailed release notes.

##### Details

Synchronize first-party workspace and internal dependency versions. This build supersedes the uncommitted, unpackaged0.13.0 preparation and includes its [first-party Unreal bridge](docs/changes/2026-10-05-first-party-unreal-bridge.md), checkpoint/continuation and MCP race/Project-scope repairs together with the [dependency advisory remediation](docs/changes/2026-10-05-dependency-advisory-remediation.md). Earlier preparation evidence remains intact. The lockfile must be refreshed separately. No tag, publication, or build is performed by version preparation.

##### Validation

- Clean npm ci applied both dependency patches. Release/lockfile agreement, generated changelog/file coverage and formatting passed. Full native Windows turbo gate passed 33/33 tasks (540 platform tests passed, 11 skipped). Tracking tests passed 24/24; generated references passed 198 requests/85 settings. Independent Node documentation verification passed 265 files/1208 links. The per-line shell checker was not repeated after its excessively slow earlier Windows run; the same fence/link/slug rules were checked independently.
- Native 0.14.0 retention/semantic search, managed first-party plugin operations, denied foreign-Project/Restricted calls and actual editor restart recovery passed. A plaintext scan of 1771 source/evidence/metadata/log files found no matching pairing credential. The owned editor and isolated RPG service were stopped afterward. RPG/Studio production remains paused.
- Built and staged the unsigned Windows installer at Windows-Release/0.14.0. SHA-256:0f223f03bee0b80e4f3003618cce5d6091ae951c08dbba7959b6bcf2734a47c1. Native package checks passed; packaged and installed Electron smokes each passed 29 checks with zero renderer errors. All 25 selected installed runtime/plugin files matched the stage, including the six owned plugin files. Actual retained RPG-profile semantic search and managed pairing also passed through the bundled service.
- Before ordinary 0.10.2 upgrade, confirmed no active tasks, captured native configuration/task identities, checkpointed the service and copied its profile to a fresh ignored backup. The elevated Windows installer completed. Installed 0.14.0 retained all four ordinary Projects/accounts/models/settings/pools/task IDs. A direct launch initially failed on an unquoted Program Files argument; corrected the test command before successful startup/retention verification.
- Rediscovered the existing ordinary OpenAI account: two accessible embedding models. text-embedding-3-small returned a real 1536-dimension vector and was selected in actual installed Knowledge UI without saving Project settings. The focused UI harness retained failed diagnostics, then waited for Theia startup and Project options before selecting. Its final screenshot was independently inspected.
- No tag/publication, signing, installer rollback or exhaustive live-feature acceptance is claimed. Registry audit still lists 19 entries derived from the two locally patched upstream versions; see the scoped dependency record. Ordinary service remains available, and unrelated processes/installations were preserved.

##### Files

- `packages/archive-extractor/package.json`
- `packages/contracts/package.json`
- `packages/platform-service/package.json`
- `packages/plugin-sdk/package.json`
- `packages/service-client/package.json`
- `packages/theia-control-room/package.json`
- `packages/plugins/sample-hello/package.json`
- `apps/control-room/package.json`
- `apps/control-room-browser/package.json`
- `package-lock.json`

## 0.13.0

### Added

#### Bounded task continuation at agent turn limits

**Impact:** minor

[Permanent work record](docs/changes/2026-10-05-bounded-task-continuation.md).

##### Summary

Replace abrupt task failure at a model-turn boundary with checkpoint retention and an explicit task question offering another bounded allowance or stopping.

##### Details

- Warn near the configured turn allowance and encourage bounded completion with truthful evidence. At the boundary, retain the checkpoint and use the existing Waiting input/question workflow.
- Only an exact Continue answer extends the allowance by the configured role/default turn count. Other answers stop with AgentTurnLimit and retained work. Cumulative cost/token budgets are checked before the question; existing time limits, access policy, selected model and completion contract remain authoritative.
- Persist approved allowances and consumed question references across service restart. This does not auto-approve continuation, raise global role limits or mark incomplete work succeeded. Existing failed task records remain historical.
- Compatible behavior addition without public RPC/storage migration. Packaging and installed deployment remain pending.

##### Validation

- Continuation test first reproduced AgentTurnLimit failure; then passed after the change. Tests also cover retained continuation and cumulative budget exhaustion across restart.
- Full repository gate passed 33/33 tasks, including 532 passing platform tests and 11 skips. Format check passed.
- Real Luna task `01a10eb3-e2c2-7e99-a65d-d9bb7e864f58` used a disposable one-turn role, retained its marker, received two exact Continue answers through native task questions and succeeded at turn3. No game, desktop browser, paid asset or provider configuration changes were made by that task.

##### Files

- `packages/platform-service/src/agents/agent-runtime.ts`
- `packages/platform-service/src/agents/agent-runtime.test.ts`
- `docs/USER_GUIDE.md`
- `docs/changes/2026-10-05-bounded-task-continuation.md`

#### Replace the vendor editor path with a PlayWeld-owned plugin

**Impact:** minor

[Permanent work record](docs/changes/2026-10-05-first-party-unreal-bridge.md).

##### Summary

First-party Unreal editor bridge following the user's explicit instruction not to depend on a third-party in-editor plugin.

##### Details

- Stopped the owned CodeFizz acceptance editor, disconnected and disabled the test Project's vendor MCP connection, removed its enabled Project reference and quarantined the newly installed vendor plugin outside the active Plugins directory. Unrelated installations and the FourSquare Project were preserved. No vendor bridge acceptance or production dependency is claimed.
- Added opt-in editor-only PlayWeld C++ module source and build descriptor. The owned module implements MCP identity/read-only inspection over engine-native HTTP with loopback binding, bearer authentication and Windows DPAPI ciphertext credential loading. No model or AI provider runs inside the editor.
- Added five editor tools: identity, bounded inspection, owned-actor spawn/transform/delete, active-viewport PNG capture and console execution. Scene edits use editor transactions and do not save the campaign map. Console remains classified destructive and Restricted-mode invocation is denied by the platform broker.
- Added service-managed source installation and protected pairing tools. Installation preflights source hashes and preserves modified local code, backs up the Project descriptor, enables the plugin only for editor targets and retains existing plugin choices. Pairing validates the exact Project file and loopback endpoint, stores bearer credentials through encrypted MCP storage and binds the existing engine bridge. Build assets now include the first-party plugin source. Native managed install, pairing and editor restart recovery passed. Packaging and broader authoring acceptance remain separate checks.
- No existing GameCrafter compatibility identifiers, provider choices or saved game data were renamed. New plugin source is Apache-2.0 under the repository license.

##### Validation

- Native PlayWeld broker rollback completed and confirmed the owned vendor plugin is absent from the active Project Plugins directory. MCP connection disabled. Exact local evidence is retained under the ignored RPG acceptance artifacts and the external Project's Tools/Evidence/DisabledVendorPlugins directory.
- Initial first-party source was checked against installed Unreal 5.8.3 HTTPServer interfaces. The first native compile failed on the request-handler delegate binding; corrected it to the engine's typed delegate and switched the Windows cryptography dependency to the system-library declaration. Second native build `01a10ec0-a04e-756c-ae23-de5ec7ec06f7` compiled and linked the owned plugin successfully. Retained the failed build. Later live verification is recorded below.
- Expanded editor operations compiled successfully in native build `01a10ecc-0d23-721c-8e97-e9df350f14c8`, after retaining/correcting a failed world-destruction/output-device API compile. Live authenticated MCP identity and inspection passed; missing/invalid auth returned401 and browser origin returned403. After separate MCP race/scope repairs, native engine operations passed spawn, transform readback, screenshot, console and owned cleanup. Exact engine runs: `01a10ed2-2aba-71a5-ab9c-c7c090c77385`, `01a10ed2-548a-7e33-8d28-ee89b06f0f85`, `01a10ed2-7e95-7cdd-b712-ca8b8c5f2275`, `01a10ed2-7f1e-7589-9e1d-2452d6e70bad`. Independent inspection confirmed the actual editor viewport PNG. Foreign Project and Restricted console calls were rejected with ToolDenied.
- Four managed-tool tests passed: preservation/idempotent protected credential installation, local edits, traversal/foreign/remote identities and encrypted MCP pairing output. Platform build/typecheck/lint passed. Live managed-tool results are recorded below; final gate results are recorded below.
- Native managed install `01a10ee0-9131-7aff-9b1c-65f8d1e180b7` and connect `01a10ee0-9152-72ab-982f-30864a5319ac` passed against the actual Project/editor. The service independently proved the editor's exact Project file before binding; capabilities then reported the live layer ready. Matching credentials stayed encrypted in MCP storage and DPAPI ciphertext on disk. Fresh 0.14.0 service recheck passed install/pairing, all five editor operations and actual rejection of foreign-Project and Restricted console calls. Stopping the owned editor made stale pairing fail; restarting it recovered live readiness with its new PID/endpoint. A plaintext scan of 1771 source/evidence/metadata/log files found zero matches for the actual protected credential. Final 0.14.0 gate passed 33/33 (540 platform tests/11 skips). Packaged source matched all six plugin/license files; managed installation/pairing also passed through the bundled 0.14.0 service against the actual editor. The packaged desktop smoke passed 29 checks without renderer errors. Ordinary 0.14.0 installation matched25 repaired runtime/plugin files, including all six owned plugin files, and passed 29 installed desktop checks. Live Unreal operations were exercised in the isolated RPG acceptance profile rather than modifying ordinary game Projects. The owned acceptance editor was stopped afterward; RPG/art production remains paused.

##### Files

- `integrations/unreal/PlayWeldEditor/PlayWeldEditor.uplugin`
- `integrations/unreal/PlayWeldEditor/README.md`
- `integrations/unreal/PlayWeldEditor/Source/PlayWeldEditor/PlayWeldEditor.Build.cs`
- `integrations/unreal/PlayWeldEditor/Source/PlayWeldEditor/Private/PlayWeldEditorModule.cpp`
- `docs/changes/2026-10-05-first-party-unreal-bridge.md`
- `packages/platform-service/src/engines/unreal/editor-bridge-tools.ts`
- `packages/platform-service/src/engines/unreal/editor-bridge-tools.test.ts`
- `packages/platform-service/src/engines/engine-connector-service.ts`
- `packages/platform-service/scripts/copy-assets.cjs`
- `docs/INTEGRATION_GUIDE.md`
- `docs/STATUS.md`
- `integrations/unreal/PlayWeldEditor/LICENSE`
- `integrations/unreal/PlayWeldEditor/NOTICE`
- `packages/platform-service/src/tools/tool-broker.integration.test.ts`

### Fixed

#### Isolate headless Blender asset imports and create export directories

**Impact:** patch

[Permanent work record](docs/changes/2026-10-05-blender-isolated-import-export.md).

##### Summary

Fix imported and converted assets containing Blender's default cube, camera and light, and failures exporting to a new nested Project directory.

##### Details

- Start the separate headless import and conversion processes with an empty factory scene before loading the asset. Preserve loaded source scenes and live user sessions.
- Create output parent directories only after the existing Project output-path guard resolves the destination. Preserve path restrictions and existing export behavior.
- Add an installed-Blender regression that exports to a new nested directory, imports exactly one mesh without cameras or lights, and converts it without adding another mesh.
- Compatibility: no contract, dependency, persisted-state or migration changes.

##### Validation

- Reproduced the defect against installed Blender 5.2.2: importing the single-mesh fixture reported two meshes. The regression failed before the fix and passed afterward.
- DCC test suite passed 11/11 across five files, including the real Blender connector tests. Platform service build passed.
- The RPG's original native export failure remains recorded. Restarted the owned source service with the rebuilt adapter; all eight native operations passed: discover, import, inspect, validate, export to a new directory, conversion, rendered preview and settlement-source validation. These are actual Blender 5.2.2 connector results, distinct from packaged-app acceptance.
- Full repository gate initially hit an Electron `conpty.node` EBUSY while the owned source desktop was open. Closed only that test desktop through its CDP endpoint and reran successfully: 33/33 Turbo tasks, 519 platform tests passed with 11 skips. Final format/change-tracking refresh is pending.
- The latest full gate after the additional completion/question fixes passed 33/33 tasks, with 527 platform tests passed and 11 skips. Formatting, change tracking and the required documentation link script passed. Reopened and verified the actual source-built Electron desktop with Ashen Covenant explicitly selected in Knowledge.

##### Files

- `packages/platform-service/src/dcc/adapters/blender.ts`
- `packages/platform-service/src/dcc/scripts/blender.ts`
- `packages/platform-service/src/dcc/blender-real.test.ts`
- `docs/changes/2026-10-05-blender-isolated-import-export.md`

#### Recover interrupted agent tool-result histories

**Impact:** patch

[Permanent work record](docs/changes/2026-10-05-checkpoint-tool-result-recovery.md).

##### Summary

Repair restored agent checkpoints that contain assistant tool calls without all corresponding outputs, avoiding provider missing-tool-output failures and repeated consumption of older question answers.

##### Details

- Recover pending task questions before the next provider request. Supply explicit interrupted-result records for other uncertain calls instead of replaying filesystem, engine, process or paid mutations whose completion is unknown. Models must inspect durable evidence before retrying.
- Preserve completed outputs. Persist recovered outputs and durable consumed-answer references. Restore the worker answer cursor across checkpoint compaction, with a legacy transcript fallback and migration of retained old question outputs.
- No provider/model changes, new public RPC, credential changes or database migration. Existing generic non-agent checkpoints retain answer cursor zero.
- Work is in progress; source tests passed, live restart/provider and packaged deployment checks remain pending.

##### Validation

- Agent regression first failed because the pending question was never recovered. After repair, focused agent/checkpoint suites passed; a real forked worker test also passed, verifying a compacted checkpoint consumes the next persisted answer rather than repeating the old one.
- Platform build and typecheck passed. Full repository gate passed 33/33 tasks (532 platform tests passed, 11 skipped), including the real forked-worker answer-cursor regression. Format check passed.
- Source-built service restart retained five Projects, the Luna-only authoring pool, 120quests/144NPC data and actual1536-dimensional semantic search. Live interrupted-provider-history and packaged deployment acceptance remain pending.

##### Files

- `packages/platform-service/src/agents/agent-runtime.ts`
- `packages/platform-service/src/agents/agent-runtime.test.ts`
- `packages/platform-service/src/workers/checkpoint-answers.ts`
- `packages/platform-service/src/workers/checkpoint-answers.test.ts`
- `packages/platform-service/src/workers/worker-main.ts`
- `packages/platform-service/src/workers/supervisor.test.ts`
- `docs/changes/2026-10-05-checkpoint-tool-result-recovery.md`

#### Completion validator engine and DCC input envelopes

**Impact:** patch

[Permanent work record](docs/changes/2026-10-05-completion-validator-input-envelope.md).

##### Summary

Automatic completion validators now pass operation parameters through the registered engine and DCC tool envelopes. A declared Unreal test filter previously failed schema validation even when the same explicit engine test succeeded.

##### Details

- Live realistic-character authoring recorded a successful native `engine/test` with input `params.filter`, followed by a failed automatic validator using top-level `filter` (`-32032`). Its task correctly remained failed (`-32125`); passing individual engine checks did not satisfy the broken automatic check.
- Automatically selected engine validators wrap operation fields in `params`, retaining an optional top-level run identifier. DCC validators retain the DCC tool selector and wrap their operation fields. Existing wrapped broker inputs and explicit tool identifiers retain their original input contract. No schema, persisted record, permission ceiling or required evidence claim was removed or relaxed.
- Added regression cases that exercise the actual registered engine/DCC schemas and handlers for both operation parameters and existing envelopes. Fixture handler success is schema/dispatch evidence, not a live engine run.
- No data migration is required. Historical failed tasks remain failed; this change does not rewrite their results or certify visual art.

##### Validation

- Before the fix, the two operation-parameter cases failed with completion-contract rejection and the existing envelope cases passed. After the fix, focused integration-service and DCC-tool tests passed 11/11.
- Broader integration/worker/task/DCC regression run passed 38 tests across five files; platform-service build passed. The full repository build/typecheck/lint/test gate passed 33/33 tasks, including 527 platform tests with 11 explicitly skipped.
- Restarted the owned isolated source runtime. The fresh native Luna visual-repair task ran both the explicit engine check and the automatic bare-filter validator successfully; automatic run `01a10db1-d579-7482-a64c-fa0edabecc9a` is actual live envelope evidence. The task nevertheless failed because its engine-validation claim reference contained explanatory prose rather than the exact successful run identifier required by the existing backing check. That rejection is valid and distinct from the repaired envelope defect; no backing check was relaxed and no historical failed task was rewritten.
- Formatting, change tracking and the required documentation link script passed after the source fixes. A subsequent narrow game-camera task is instructed to use exact run identifiers and remains in progress.

##### Files

- `packages/platform-service/src/change/integration-service.ts`
- `packages/platform-service/src/change/integration-service.test.ts`
- `docs/changes/2026-10-05-completion-validator-input-envelope.md`

#### Coalesce simultaneous MCP connection attempts

**Impact:** patch

[Permanent work record](docs/changes/2026-10-05-mcp-concurrent-connect.md).

##### Summary

Fix simultaneous automatic/manual MCP connection attempts replacing each other's session and failing with MCP connection is not connected during catalog refresh.

##### Details

- Found while connecting the new first-party Unreal plugin. Reproduced deterministically with four concurrent connects to a real fixture process.
- Share one per-connection in-flight promise through initialization and catalog refresh. Disconnect/update/removal wait for that bounded attempt; internal session cleanup avoids waiting on its own connection promise. Service stop drains pending connections before closing sessions, and new connects are rejected after stop.
- No transport protocol, credential format, RPC/storage or provider changes. Existing timeouts remain authoritative. Live repaired plugin connect/update and editor restart recovery passed.

##### Validation

- Regression first failed with MCP connection is not connected. After coalescing, all callers reached a catalogued connected session; corrected the event assertion to count the manager and session's two normal connecting notifications.
- Focused manager/Docker tests passed 9/9 and typecheck passed. A subsequent full repository gate passed 33/33 tasks (534 platform tests passed, 11 skipped), before the later managed-plugin addition. Actual first-party editor connection/update/restart passed after the fix. Final 0.14.0 gate passed 33/33 (540 platform tests/11 skips); packaged and installed desktop smokes each passed 29 checks.

##### Files

- `packages/platform-service/src/mcp/connection-manager.ts`
- `packages/platform-service/src/mcp/connection-manager.test.ts`
- `docs/changes/2026-10-05-mcp-concurrent-connect.md`

#### Enforce Project scope before invoking MCP tools

**Impact:** patch

[Permanent work record](docs/changes/2026-10-05-mcp-project-invocation-scope.md).

##### Summary

Reject a Project-scoped MCP tool call made with another Project's context before reaching the external server.

##### Details

- Found in the live first-party Unreal bridge negative test: a foreign Project could invoke the other Project's read-only identity tool. Configuration scoping and engine binding validation alone did not enforce the globally registered tool handler's caller scope.
- Enforce matching Project identity at the adapter before invocation. Platform-scoped connections retain their cross-Project behavior. No RPC/storage migration, credential changes or permission weakening.
- Affects read and mutation tools alike; the observed live reproduction was read-only identity, not unauthorized scene mutation. Preserve that evidence boundary.

##### Validation

- Regression first resolved private fixture content for a foreign Project instead of rejecting. It now checks rejection before the invoker is called and successful invocation for the owning Project.
- Focused adapter/manager suites passed 11/11. The actual foreign-Project identity call was rejected with ToolDenied before editor invocation; Restricted console was also denied. A subsequent full repository gate passed 33/33 tasks (534 platform tests passed, 11 skipped), before the later managed-plugin addition. Final 0.14.0 gate passed 33/33 (540 platform tests/11 skips); packaged and installed desktop smokes each passed 29 checks.

##### Files

- `packages/platform-service/src/mcp/mcp-tool-adapter.ts`
- `packages/platform-service/src/mcp/mcp-tool-adapter.test.ts`
- `docs/changes/2026-10-05-mcp-project-invocation-scope.md`

#### OpenAI Responses fallback for tool-capable reasoning models

**Impact:** patch

[Permanent work record](docs/changes/2026-10-05-openai-responses-tool-fallback.md).

##### Summary

Fix a live Swarm blocker where OpenAI rejects function tools on Chat Completions and the selected model also rejects the previous `reasoning_effort: none` fallback.

##### Details

- Negotiate Responses only for the first-party OpenAI adapter at the exact official endpoint after a structured HTTP 400 explicitly identifies the function-tool reasoning conflict. Preserve existing Chat Completions behavior for compatible/custom/Azure/other providers and unrelated errors. Keep the selected model and account unchanged.
- Map function definitions, messages, tool calls/results, output limits, structured output, token usage and streaming text. Use `store: false` and bounded account/model-scoped encrypted reasoning replay for subsequent tool turns. Restored Chat histories without provider item IDs use reconstructed function-call inputs; restart/checkpoint replay is not yet live-verified.
- Cache the negotiated route after success. Preserve cancellation and provider credential redaction. No contract/storage migration or dependency additions.
- Live cache-independent continuation passed: a real function call executed the Project filesystem broker, then a reconstructed call ID and its tool output resumed successfully without provider item IDs. This does not verify every paused-agent question/checkpoint history; a later cross-model paused-question continuation failed with a missing-tool-output error and remains an investigation boundary.
- Official references consulted: https://developers.openai.com/api/docs/guides/function-calling and https://developers.openai.com/api/docs/guides/migrate-to-responses .

##### Validation

- Regression first failed on the existing adapter with the reproduced structured 400, then passed with Responses and subsequent tool-result/reasoning replay. Expanded provider suite passed 23/23, including streaming and no retry for HTTP 401/403/429/500.
- Source service rebuilt and restarted using only the isolated RPG acceptance profile. Both real Swarm retries now perform model completion and broker file writes. This is source-built service evidence, not newly packaged installer acceptance.
- Full repository gate initially completed 32/33 tasks with an A2A setup-hook timeout and Windows cleanup EPERM; focused A2A rerun passed 11/11. A second full `npx turbo run build typecheck lint test` passed. Format and changelog checks passed. New packaging, restart/checkpoint reasoning replay and exhaustive API validation remain pending.

##### Files

- `packages/platform-service/src/models/providers/openai-compatible.ts`
- `packages/platform-service/src/models/providers/openai-providers.ts`
- `packages/platform-service/src/models/providers/openai-responses.ts`
- `packages/platform-service/src/models/providers/providers.test.ts`
- `docs/changes/2026-10-05-openai-responses-tool-fallback.md`

#### Preserve worker question identifiers during persistence

**Impact:** patch

[Permanent work record](docs/changes/2026-10-05-worker-question-id-handoff.md).

##### Summary

Answers to a live worker question now reach the original waiting worker. The supervisor previously persisted a different question identifier, causing answer acknowledgement to time out and the worker to restart unnecessarily.

##### Details

- The worker creates an identifier for its pending answer promise. The supervisor now passes that identifier through the task graph and store rather than discarding it and generating another identifier. Other question creation continues to generate identifiers by default; public schemas and existing records remain compatible, with no migration.
- Added a real subprocess regression through the supervisor, task service, persisted question and answer API. It checks that the answer is delivered and the original worker completes, with exactly one process start.
- A live narrative continuation previously failed with missing tool output after a forced restart. This change fixes the unnecessary restart for an answer while the original worker is alive. It does not claim to repair all paused-agent checkpoint recovery after service restart, nor rewrite historical failures.

##### Validation

- Before the fix, the subprocess test delivered the eventual answer only after starting two workers and failed the one-worker assertion. After the identifier fix, it passed with one worker and the expected answer.
- Broader integration/worker/task/DCC regression run passed 38 tests across five files; platform-service build passed. The full repository build/typecheck/lint/test gate passed 33/33 tasks, including 527 platform tests with 11 explicitly skipped.
- Restarted the owned isolated source runtime and verified native `noop.ask` answer continuation succeeded. A fresh actual Luna `agent.run` persisted a question, received the coordinator's acceptance-fixture answer, wrote the expected native Project JSON and completed successfully (`01a10da5-40d2-7750-b3db-4ca6d832437e`). This is live question/tool continuation, distinct from recovery of an already stopped worker.
- Formatting, change tracking and the required documentation link script passed. The source-built Electron desktop was reopened and verified against the restarted owned service. Ordinary installed-app upgrade remains unverified.

##### Files

- `packages/platform-service/src/tasks/task-store.ts`
- `packages/platform-service/src/tasks/task-graph.ts`
- `packages/platform-service/src/workers/supervisor.ts`
- `packages/platform-service/src/workers/supervisor.test.ts`
- `docs/changes/2026-10-05-worker-question-id-handoff.md`

### Maintenance

#### Recheck embeddings after the OpenAI access change

**Impact:** none

[Permanent work record](docs/changes/2026-10-05-embedding-access-enabled-recheck.md).

##### Summary

The existing saved OpenAI key now returns real embedding vectors, but identical requests intermittently retain the previous project/model access rejection. Real ingestion succeeded in the packaged runtime; semantic acceptance is not yet complete.

##### Details

- Fresh direct requests returned HTTP 200 for both `text-embedding-3-small` (1, 536 dimensions) and `text-embedding-3-large` (3, 072 dimensions). No local account or credential was changed by this recheck.
- The provider model list expanded from the previous 19-model response to 139 models and now includes the two current embedding models and `text-embedding-ada-002`.
- The fresh packaged 0.12.0 acceptance Project imported an embedding model, verified its dimensions and indexed real SQLite vectors. Its first semantic search then received HTTP 403 `model_not_found` and correctly reported a lexical fallback, so the test failed instead of claiming a semantic pass.
- Differential direct and actual adapter requests also alternate between success and HTTP 403 with the same key and no custom account headers. A controlled eight-request sample with identical semantic-query input returned three successes and five denials. Access-change propagation is a hypothesis, not a confirmed provider diagnosis.
- No runtime request retries, fake vectors, forced profile configuration, installer or provider-permission mutations were added.

##### Validation

- Initial and subsequent minimal two-model probes returned real vectors for both models.
- `.artifacts/knowledge-live-2026-10-05/embedding-enabled-live-run/report.json`: 23 checks passed, zero marked blockers, one failed semantic acceptance assertion due to an actual provider rejection. The runner stopped its owned service. This is a failed acceptance run, despite successful profile creation and vector ingestion.
- `.artifacts/knowledge-live-2026-10-05/embedding-differential-1791217839726/report.json`: successful model listing, mixed direct embedding results, and successful actual provider adapter calls in both ordinary and retained test profiles.
- `.artifacts/knowledge-live-2026-10-05/embedding-stability-1791217876990.json`: 3 of 8 requests returned vectors; 5 of 8 returned HTTP 403 `model_not_found`. Key values are excluded from all output and retained reports.
- A second sample after a bounded wait, `.artifacts/knowledge-live-2026-10-05/embedding-stability-1791217972127.json`, still alternated between success and denial: 4 of 8 returned vectors and 4 returned HTTP 403. Provider access is not yet stable. Work-record coverage, Git whitespace and native equivalent link checks passed (250 Markdown files, 1, 173 relative links); the previously stopped slow Git Bash scan was not repeated.
- Full semantic/hybrid, vector-backend switching and vector retention acceptance remain unverified until provider responses are stable.

##### Files

- `docs/changes/2026-10-05-embedding-access-enabled-recheck.md`

#### Isolate the remaining OpenAI embedding access failure

**Impact:** none

[Permanent work record](docs/changes/2026-10-05-embedding-project-access-investigation.md).

##### Summary

Compare minimal direct OpenAI requests with PlayWeld's provider adapter and both ordinary/test profiles. OpenAI explicitly rejects the stored key's project access to both embedding models; endpoint construction, optional account headers and stale test credentials do not explain this remaining failure.

##### Details

- Investigate three falsifiable causes: project/model restrictions, incorrect project/organization headers, and provider request formatting.
- Read encrypted credentials in memory through the existing CredentialStore and ModelRegistry seams. Both profiles contain the same project-scoped key, use `https://api.openai.com/v1`, and configure no account headers. No account, credential or provider setting is changed.
- Minimal and configured `GET /v1/models` requests both return HTTP 200 and 19 models, with no embedding IDs. Minimal and configured `POST /v1/embeddings` requests both return HTTP 403 `model_not_found` for `text-embedding-3-small` and `text-embedding-3-large`.
- Capture the provider's precise message with project identifiers redacted: the project does not have access to the requested model. Actual OpenAI adapter calls from both profiles return the same response. Discovery preview exposes the two catalog candidates without persisting changes; catalog availability is distinct from successful provider access.
- OpenAI documents separate API-key endpoint permissions and project model usage permissions. Check the project owning the saved key, its Limits / Model Usage settings, and its API Keys endpoint permissions; enabling another project's models cannot change this key's scope ([project management guide](https://help.openai.com/en/articles/9186755-managing-projects-in-the-api-platform)). No admin credential is requested or used, and no external permission changes are performed by this investigation.
- Existing discovery and packaged validation remain unchanged. The external embedding access blocker is unresolved until the provider accepts a request; no synthetic vectors or forced embedding profile are used.

##### Validation

- Fresh minimal probe reproduced the HTTP 403 responses before hypothesis testing.
- Differential live diagnostic at `.artifacts/knowledge-live-2026-10-05/embedding-differential-1791217124589/report.json` records endpoint/header/key-kind and same-credential comparisons, two successful model lists, four denied direct embeddings and two denied real adapter calls. API keys and project identifiers are excluded from reports.
- Diagnostic scripts and reports are ignored local artifacts, not shipped runtime features. Runtime code was not changed in this investigation; the preceding 0.12.0 full quality gate and packaged acceptance remain the applicable runtime evidence.
- Provider access remediation awaits the user's confirmation that model access is enabled in the project owning the currently saved key.
- Work-record/changelog coverage and Git whitespace checks passed. The native equivalent link scan passed 249 Markdown files and 1, 172 relative links; the original Git Bash scan was previously stopped for excessive runtime and was not repeated for this investigation.

##### Files

- `docs/changes/2026-10-05-embedding-project-access-investigation.md`

#### Prepare version 0.13.0

**Impact:** none

[Permanent work record](docs/changes/2026-10-05-release-0.13.0.md).

##### Summary

Prepare version 0.13.0 from 0.12.0, retaining all pending work records in the changelog and detailed release notes.

##### Details

Synchronize first-party workspace and internal dependency versions. The lockfile must be refreshed separately. No tag, publication, or build is performed by version preparation.

##### Validation

Work-record freshness, local file coverage, version progression, and recorded impact checked before preparation. Dependency installation, refreshed lockfile verification, quality checks, packaging, signing, and live acceptance are not yet verified by this preparation record; retain their actual evidence in a follow-up work record.

##### Files

- `packages/archive-extractor/package.json`
- `packages/contracts/package.json`
- `packages/platform-service/package.json`
- `packages/plugin-sdk/package.json`
- `packages/service-client/package.json`
- `packages/theia-control-room/package.json`
- `packages/plugins/sample-hello/package.json`
- `apps/control-room/package.json`
- `apps/control-room-browser/package.json`
- `package-lock.json`

#### Ashen Covenant live PlayWeld acceptance investigation

**Impact:** none

[Permanent work record](docs/changes/2026-10-05-rpg-live-acceptance.md).

##### Summary

In-progress live acceptance Project for an original Unreal RPG, authored through PlayWeld rather than direct external authoring. The requested full game and exhaustive feature acceptance remain incomplete.

##### Details

- Created the trusted Ashen Covenant Unreal Project at `E:\GameCrafter-Dev\AshenCovenant` in the isolated staged 0.12.0 test profile using authenticated service RPC. Registered installed Unreal 5.8.3 editor/commandlet/UAT and Blender 5.2.2, enabled specialist skills, created a Project model pool using the inherited GPT-6 Astra selection, and authored the acceptance brief via the filesystem tool broker and a draft Knowledge record.
- Created a native discussion thread and two actual Swarm tasks for narrative and engine authoring. Both failed before producing the game: the restricted narrative role denied paid model completion; the engine role reached OpenAI but its Chat Completions reasoning fallback was rejected by the selected model. Neither run is game implementation evidence.
- Allowed only `model/complete` for restricted roles in this Project, consistent with the requested authoring. Preserved ordinary-profile permissions and model selection.
- Configured the existing Tripo credential through the encrypted PlayWeld asset account service without printing it. After explicit six-asset approval and broader Meshy/Tripo authorization, generated, visually reviewed and imported six models via native asset jobs. Actual charge 30 credits each, 180 total; balance 2, 785 to 2, 605. Provenance and downloaded model/preview hashes retained. Used PlayWeld DCC execution to produce editable normalized Blender sources, packed PBR images, and FBX exports. Exact triangulated counts exceed the requested face count on several assets; final game topology/LOD acceptance remains pending.
- Produced a 17-piece editable settlement kit, individual FBX/GLB exports, manifest and rendered preview through PlayWeld's Blender DCC connector. These are prototype art assets, not yet final engine visual acceptance.
- Live knowledge cycle passed twelve checks: native records, status filtering, graph/inbound references, editing/stale text removal, broker-file incremental ingestion, board editing, actual semantic/hybrid embeddings and citations on SQLite/LanceDB/managed local Qdrant, context budget and explicit deprecated-status filtering. Retained a failed initial harness assertion that incorrectly assumed default deprecated exclusion, then corrected it to the actual explicit-filter contract.
- Actual source-built Electron desktop connected and explicitly selected Ashen Covenant in Knowledge. Fifty-two authenticated live RPC/read/chat checks completed; these read surfaces do not prove complete behavior. Registered a dependent native Swarm art integration/final validation task. Engine authoring compiled the C++ editor and saved nine actual maps; campaign and final game acceptance remain in progress.
- A large narrative completion hit the broker's five-minute limit; restarted authoring in bounded per-region persistent batches, retaining the failed task. Configured existing Meshy credentials in the isolated profile, authenticated the provider, independently verified 2, 727 credits without exposing credentials, and submitted one native courier preview job, estimated 20 credits plus an approved 10-credit texture refinement. Meshy skill CLI guidance is superseded by the user's explicit requirement to use PlayWeld's built-in asset system.
- Ignored orchestration and redacted evidence are under `.artifacts/rpg-deep-dive-2026-10-05`. External CLI dry-run is diagnostic evidence only, not a PlayWeld asset generation pass. No public publishing or protected installed-app upgrade was performed.
- Completed Meshy preview/refinement, visually reviewed the courier, imported its GLB through native asset review/import, and produced an editable normalized Blender master and FBX through DCC execution. Actual cost 30 credits (20 preview plus 10 refinement). No rigging or animation claim yet.
- Regional narrative files contain 144 NPCs and 120 quests (24 main, 70 side, 14 faction and 12 companion), with a complete campaign bible and three-act narrative. Final runtime arrays and full gameplay acceptance are delegated to bounded mechanical assembly and integration tasks. The original engine task reached its 70-turn limit after compiling, creating nine maps and producing an initial Windows package; incomplete-data automation failures remain recorded.
- User subsequently prohibited Astra and authorized only DeepSeek or Luna. Disabled Astra in the isolated profile and changed the Project authoring pool to `gpt-6-luna`. The paused narrative continuation failed with a provider missing-tool-output error; preserved its saved work and created fresh Luna assembly/integration tasks instead of repeating its content.
- User clarified that Studio credits should be used by manually controlling the desktop browser. Successfully opened the existing authenticated Chrome Tripo Studio session through PlayWeld filesystem/process tools and Windows UI Automation. UI showed 25, 200 Studio credits. Submitted one original archivist Smart Mesh candidate through the actual Studio controls using the displayed trial; generation completion, download, texture/rig and engine acceptance remain pending. This is a broker-run browser acceptance harness, not a dedicated shipping PlayWeld Studio integration.
- Studio candidate geometry and texture completed and were visually reviewed. UI displayed 6, 280 quad faces and 5, 551 vertices. Downloaded FBX/base-color texture ZIP through Chrome, imported through a broker-run archive extraction script with path containment checks, and retained originals and SHA-256 provenance under `Art/Studio/SeritVale`. Texture charged 30 Studio credits, then UE5 Mannequin auto-rig charged 20; observed balance 25, 150. The rig completed and the walk preset visibly played in Studio; exported skeleton/clip and Unreal deformation checks remain pending.
- Final NPC/quest arrays now exist and the native Luna assembly task succeeded with seventeen static checks, including 120 reachable quest chains, references, counts and three endings. Native art/runtime integration is still running. Its source/asset validation must not be inferred from static campaign checks.
- A native local encrypted backup/restore cycle passed nine checks, including verification/drill, wrong-secret rejection, campaign/SQLite archive entries, an independently registered restored Project, retained chat/board and 120 restored quests. The retained clone is `E:\GameCrafter-Dev\AshenCovenant-Restore-Probe`; this is an in-progress snapshot with an ephemeral acceptance-only unlock secret, not a user recovery-key handoff. An initial harness prematurely treated the intermediate run state as terminal; retained that report and corrected polling. The original native backup itself later verified successfully.
- The Studio UE5 skeleton/walk export was downloaded separately and inspected with a native Blender DCC script: one armature, one mesh, 10, 997 triangles/5, 551 vertices, zero unweighted vertices, maximum four influences, one 1–57-frame action at 24 FPS, and distinct sampled bone poses. Packed a resized 2K texture into an editable master while retaining the original source and 8K texture. This verifies source structure/motion, not Unreal deformation or loop contacts.
- User then authorized heavy Studio use and explicitly rejected cartoon style in favor of higher realism/fidelity. Updated the native RPG brief, an art-direction record and board decision. Prior cartoon/stylized sources remain historical test/placeholder evidence, not approved final art. Submitted one detailed H3.1 bellhouse before the style correction (65 credits), then one grounded realistic archivist replacement using Ultra Mesh/2M source-polygon target, PBR, lighting removal and 8K texture (65 credits). Observed Studio balance 25, 020; these latest sources require visual/export/engine review before acceptance. Do not infer realism or runtime suitability from source settings.
- Downloaded the realistic archivist GLB (71, 623, 344 bytes) through desktop Studio and retained it through native broker ingestion with SHA-256 provenance. Blender independently measured 1, 916, 616 triangles, one mesh/material, an 8K base color and 4K normal/packed roughness-metallic maps. Produced an editable 1.78-metre source and four review renders through native DCC execution. Front/back review supports the corrected realistic direction; hands, rigging and Unreal acceptance remain pending. The initial render harness failed because an empty scene has no World; retained the failed run and corrected the harness explicitly.
- Submitted a separate 25, 000-quad retopology job for the realistic archivist (10 Studio credits), a replacement realistic stone/timber bellhouse (65) and realistic river-scout companion (65). Observed Studio balance 24, 880. Retain individual browser job URLs/prompts in the native Project; these submissions are not completion or runtime-acceptance claims. The high-detail original is preserved, and earlier cartoon assets remain rejected final art.
- Native functional game acceptance summary `Run-20261005-113442` reports passing filtered automation, services/data commandlet and runtime checks. The native art task nevertheless failed its completion contract; its task status is failed, distinct from those individual checks. Packaged visual acceptance and realistic art integration remain incomplete.
- Realistic archivist retopology completed and its FBX/PBR maps were downloaded and retained. Native Blender measured 47, 946 triangles, 24, 228 vertices and UVs, produced a 1.78-metre editable static master, explicit PBR material and separate 47, 946/23, 972/9, 588-triangle exports. Four independent runtime-source review renders completed; final skinned LOD and engine budget acceptance remain open. UE5 Studio rig charged 20 credits, exported the explicitly selected walk, and native Blender verified one skeleton/mesh, zero unweighted vertices, maximum four influences and actual sampled motion over frames 1–57 at 24 FPS. Raw rig height is approximately 0.979 metres; engine normalization is explicitly pending. Submitted a bounded native Luna Unreal import/visual-study task.
- Rejected the new text-generated bellhouse after visual review still showed exaggerated storybook stonework. Generated a more constrained photographic architectural reference through the actual Studio image UI (one 4K Nano Banana image, displayed free allowance, no observed credit decrement), then submitted a new H3.1 image-to-model job for 65 credits. Observed Studio balance 24, 795. Preserve rejected candidate evidence and reference prompt; no final architectural acceptance is claimed.
- Downloaded the realistic river scout source, retained its hashes and completed independent four-view Blender review/editable source. Studio retopology submitted for 10 credits; final export/rig/Unreal checks remain pending. Review found overly glossy fabric, explicitly requiring material correction rather than accepting the provider PBR label. Submitted realistic smith, musician, veteran guard, elder healer and player-courier sources (five H3.1 jobs, 65 credits each). Observed Studio balance 24, 460: cumulative Studio decrement 740 credits from the initial 25, 200, separate from 180 Tripo API credits and 30 Meshy credits. Individual generations retain their prompts/job URLs and remain candidates pending completion/review.
- Photo-reference bellhouse source completed, was downloaded with provenance, and passed independent four-view Blender review with an editable master. Submitted standard 50, 000-quad retopology for 10 Studio credits and downloaded the completed 50, 312-quad/50, 300-vertex FBX and PBR textures. Native Blender produced a measured 8-metre-width static master and three LOD exports; actual Unreal door scale/collision/performance remain pending. Observed Studio balance 24, 450, cumulative Studio decrement 750, separate from API and Meshy balances.
- River-scout retopology completed and was retained; native Blender produced three static LODs and four review renders with explicit PBR bindings and a documented 0.55 roughness floor to address glossy fabric. Original maps remain preserved; skin/cloth differentiation, rig and engine acceptance remain open.
- First realistic Serit native task imported the actual 61-bone skeleton/walk at measured 177.99998 centimetres and passed an explicit engine test (seven cases, 221 assertions) plus asset DataValidation. Automatic completion still failed because of the input-envelope defect recorded separately. Root review of its actual RHI screenshot failed: black background, overexposed scale proxy and unrecognizable character. Bind-pose warnings and renderer timeout remain recorded. Created a fresh native Luna visual-repair task; structural import does not establish visual acceptance.
- Controlled restart of the owned source runtime retained five registered Projects, all 120 quests/144 NPC records with identical hashes, native board/conversation data, the Luna-only Project pool, and the 1, 536-dimension embedding profile. Actual semantic search returned hits after restart. Eight native Blender connector operations passed after the isolated-import/export fixes. Fresh native fixture and actual Luna question continuation both succeeded; these do not repair historical stopped-worker checkpoints.
- All five additional detailed character sources were downloaded through desktop Studio and retained through native broker ingestion. Native Blender independently produced measured reports, packed editable masters and four-view renders for each. These are source candidates with hand/skin/cloth/rig gates open; do not certify them from polygon counts. Accepted user realism direction is retained in canon and actual semantic search returns its citation. Updated the selected source inventory to 33 including the player courier; the nominal source estimate is2, 145 credits, distinct from actual spend.
- The native scene-repair task passed explicit/automatic engine checks but failed the required claim backing because it supplied prose instead of the exact run UUID. The new actual editor screenshot was independently reviewed and failed again because it is black. Preserved both failures and created a bounded native Luna game-camera/rendered-animation task; no final character or full-game visual claim is made.

##### Validation

- Subsequent live game-camera diagnosis corrected a horizontal backdrop occluding the lights and made manual exposure explicit. The resulting gray character was traced to the actual Unreal warning that the PBR material lacked skeletal-mesh usage. Native authoring enabled that usage, saved/recompiled the material, and a fresh D3D12 game capture visibly rendered skin, hair, cloth and leather.
- The initial scale probe/reimport reused a scale-one skeleton: its live animated pelvis was only about 52 cm above the ground despite 178 cm mesh bounds. Imported a separate calibrated skeleton/animation without overwriting the earlier assets, and changed the isolated `ACArtStudy.cpp` fixture to use the component's serialized animation. Native editor compilation passed after correcting a command-quoting failure. Actual capture `fd0fe5bc-444a-8016-f7b9-74b0c8761a0a` shows the complete realistic character with textures and distinct walk poses; pelvis is about 94 cm above ground. Rig bind-pose/tangent warnings, full deformation/foot-contact review and packaged acceptance remain open. This is a WindowsEditor game-camera check, not final game quality acceptance.
- A second free Studio photographic reference and 65-credit detailed image-to-model request produced a realistic timber inn candidate; native download/provenance and four-view Blender/editable-source review completed. Five additional character retopology requests consumed 10 Studio credits each. Observed balance 24, 335; cumulative Studio decrement 865 from 25, 200, separate from Tripo API and Meshy spending. Retopology export/runtime acceptance remains in progress.
- After the calibrated skeleton and fixture changes, native `engine/run` test `01a10dd5-0a58-79ef-94e5-3a7bb5e0ec9f` succeeded with seven cases and zero failures/incomplete results. The conservative feature ledger enumerates all 198 RPC methods; after native asset-history and MCP lifecycle checks it records 50 selected live behaviors, 48 read surfaces, one error boundary and 99 unrun methods. This explicitly does not establish exhaustive system acceptance.
- All five additional character retopology FBX/texture archives were exported through Chrome, retained with containment checks and hashes, and processed through native Blender into measured editable masters with three static LODs each. Submitted UE5 Mannequin rigs for courier, Iver, Brona, Vey, Cael and Elun, 20 Studio credits each. Observed balance 24, 215, cumulative Studio decrement 985. Rig export/weight/deformation acceptance remains in progress.
- Native board lifecycle checks passed for posting, edit history, superseding, search, scoped subscription removal, binding the exact user realism correction, reading the bound decision and resolving the retained evidence thread. The first summary assertion incorrectly expected generation from a cached-read API; corrected the harness and retained the failed report. The default permanent-deletion guard correctly rejected an owned disposable test thread; archived it without weakening settings. No positive permanent-deletion or summary-generation claim is made.
- Native Luna completed the remaining 24-source manifest: eight regional buildings, five service buildings, three enemies, three terrain sources and five props, with independently checked identifiers, regional references and bounded prompts. Eleven non-building H3.1 source jobs were submitted through desktop Studio for 65 credits each (715 total). A third free photographic reference, explicitly requesting 4K, was reviewed for Reedhaven's river bellhouse and submitted through image-to-model for 65 credits. Observed Studio balance is 23, 435, cumulative decrement 1, 765 from 25, 200; API and Meshy spending remain separate. Generation settings and successful submissions do not prove final realism, topology, animation or game acceptance.
- All six additional UE5 walk archives were exported and retained through native broker ingestion. Native Blender checks passed for 61-bone skeletons, zero unweighted vertices, at most four influences and sampled animation movement. Native Luna task `01a10df7-b216-74e0-bfe7-fa2bc4454578` succeeded: six separate calibrated Unreal skeletons, skeletal materials and three saved skinned LODs each, plus a reopened isolated study map. Actual LOD vertices decrease; triangle counts/screen thresholds remain pending. Explicit engine test passed seven cases/221 assertions, and DataValidation passed after a scoped orphan-probe repair. Preserved failed Python import attempts, bind/tangent warnings and unchanged sampled editor poses. Game-camera deformation, exposure, final materials and gameplay integration remain open.
- The first bellhouse integration task was cancelled at its budget boundary, with its saved assets preserved. A fresh Luna capture/audit task succeeded and verified structural integration and filtered engine tests, but independent inspection of its actual game PNG failed: automatic exposure with negative compensation made the image nearly black. A manual-exposure correction is prepared and will run after the character task releases the editor. Structural/task success does not certify the building's visual quality or walkable interiors.
- Configured a Project-scoped native CodeFizz stdio MCP connection using the installed 3.0.2 CLI. Actual discovery exposed 15 base tools; health classification, refresh, disconnect/reconnect and classification retention passed. Server-initiated model calls are disabled. The real health response reports no connected Unreal editor, so live editor bridge and mutation acceptance remain unverified. Existing plugin files were inspected without changing the unrelated FourSquare Project.
- All eleven non-building sources were exported, hashed and processed through native Blender into editable masters, measured reports and four review renders each. Coordinator inspection of front and selected side/back views found source-specific material/geometry work, recorded in the native non-building handoff. Rejected the ashling after the actual renders showed four arms and a plated robot silhouette. Preserved its generation record as `generation-rejected-v1.json`, original provenance as `source-provenance-rejected-v1.json`, source GLB, master and renders; recorded the failure and revised its replacement to a photographic two-arm creature reference. No retopology or rig credits were spent on the rejected source. The other ten remain candidates with final material, geometry, animation or game-fit gates open; source production is not final-art approval.
- Reviewed a free 4K-requested two-arm ashling reference and submitted its replacement image-to-model request for65 Studio credits. Observed balance23, 370, cumulative Studio decrement1, 830. Preserved the rejected original's provenance separately so it does not point to the replacement generation record.
- Authored and compiled a separate parameterized `ACCharactersArtStudy` game-camera fixture through the native filesystem/process broker. Actual D3D12 runs for all six characters exited0, wrote two pose PNGs and reports, and verified changing foot positions plus decreasing per-LOD triangle counts. Initial independent image review failed the lighting gate despite full-body motion. Subsequent camera/fill edits exposed an error in root review scripts: Unreal Python's rotation constructor argument order differs from C++. Replaced positional rotations with explicitly assigned pitch/yaw/roll fields and asserted their readback before saving; new visual review is pending. Historical failed images remain retained.
- After correcting rotations and exposure, independent review of all six front-view images and Courier's second pose passes basic full-body framing, natural proportions, visible PBR and walking appearance. Native reports verify decreasing actual skinned triangle counts and changing foot positions. Detailed hands/joints, material differentiation, contacts, all-LOD visuals, crowd performance and packaging remain open. The corrected bellhouse capture `67e3b0ac-464e-9b59-6f8b-7ebe25c46d97` likewise passes basic full-building/material/scale-reference review; it remains exterior-only. Native review documents preserve failed captures and distinguish these checks from final game quality.
- A fifth free 4K-requested architectural reference for Thornmere was reviewed and submitted for65 Studio credits. Observed balance23, 305, cumulative Studio decrement1, 895. Rejected the sixth free reference for Dunwatch because it depicted a narrow tower instead of a community hall. Preserved the rejected image and metadata, revised the native architectural prompt, and reviewed the seventh free reference showing a rectangular single-story stone hall. Submitted that revised image-to-model source for65 Studio credits; observed balance23, 240, cumulative Studio decrement1, 960. Generated mesh, human-scale doors, interiors and runtime acceptance remain pending. Started native Luna task `01a10e46-76bd-7fb7-a7fe-9f89ab47b5c0` for player/NPC campaign integration using the seven reviewed realistic character templates. That integration and real idle/run/combat clips remain in progress.

- Live Project creation, trust/settings, tool registration, skills enable/activation, model discovery/import and pool creation, broker filesystem write, Knowledge write, board thread and task creation completed through PlayWeld.
- Actual Swarm failures retained in native task events. Blender production, paid Tripo generation/import, real vector backends/search, actual desktop Project selection and native C++ editor compilation/map existence now have live evidence. The 120-quest/144-NPC campaign has static and functional acceptance, and native backup/restore plus controlled restart retention passed. Final realistic art, packaged gameplay and exhaustive feature acceptance remain incomplete.
- Full repository build/typecheck/lint/test initially failed one A2A setup hook under live workload; focused A2A tests passed 11/11 and the second full gate passed. Format and change tracking checks passed before this evidence update; final tracking refresh remains required.
- Latest full repository gate after the completion-validator and question-handoff fixes passed 33/33 tasks (527 platform tests passed, 11 skipped). Format/change tracking and `scripts/check-links.sh` passed; an independent Node check also found zero broken links/anchors across255 Markdown files and1, 178 relative links. Native game-camera repair and final runtime art remain in progress.

- During realistic campaign integration, an actual runtime check exposed that `ConfigurePlayer` routed `courier` through the generic CRC template fallback. Preserved failed reports and posted a source-level finding on the native board. The native task added an explicit Courier mapping; subsequent D3D12 campaign report `4162ab86-461c-5b26-685a-c5ab61e529d2` passed 42 runtime checks across all nine regions. Seven regression cases/221 assertions also passed earlier in the task; final task contract and independent campaign images remain pending.
- Fresh live semantic search retrieved the new resolver finding as its top hit with an exact native board citation and `degraded: null`. This verifies newly ingested board evidence through the configured embedding path during ongoing development, beyond the earlier fixed-fixture search checks.
- Submitted standard retopology for the ten remaining non-building candidates other than the rejected ashling, using the native manifest's individual targets of 1, 200–18, 000 quads. Actual charge10 Studio credits each, 100 total; observed balance23, 140, cumulative Studio decrement2, 060. Every paid intent and charge is retained in its native source folder. Completed export, independent topology/material measurements, required enemy rigs and final game acceptance remain pending; this does not approve all ten as final art.

##### Files

- `docs/changes/2026-10-05-rpg-live-acceptance.md`

## 0.12.0

### Fixed

#### Close backup archive streams before staging cleanup

**Impact:** patch

[Permanent work record](docs/changes/2026-10-05-backup-archive-stream-cleanup.md).

##### Summary

Close and await archive source streams when rejecting an unlock secret or completing a manifest preview. The live packaged knowledge acceptance run exposed an open-file Windows cleanup failure that replaced the intended unsuccessful verification result with an internal RPC error.

##### Details

- Archive readers now release their async iterators in a finally block covering header parsing, unlocking and payload reading, and await readable stream completion before returning. Unlock-key zeroing remains intact; caller-supplied archive keys remain caller-owned.
- Add real-file regressions for wrong-secret rejection and partial manifest reads, plus an authenticated backup verification regression confirming a wrong secret returns `ok: false` and subsequent correct verification succeeds.
- No archive format, database schema, API or credential migration changes. Preserve the staged 0.11.0 candidate and its failing evidence; prepare a new numeric version for the repaired build.

##### Validation

- Before the fix, both new real-file tests failed because the archive stream remained open when the reader returned.
- After the fix, archive and backup service integration tests passed (9 tests across 2 files).
- Full repository build/typecheck/lint/test gate passed all 33 tasks without cache hits: platform service 513 passing tests, 11 existing skips; Theia extension 104 passing tests. Separate-process source 0.12.0 acceptance passed 28 checks including wrong-secret verification and actual restored native search, with zero failures and one live OpenAI access blocker.
- Staged 0.11.0 live reproduction: `backup/verify` with a wrong recovery secret raised RPC -32603 with Windows EPERM while removing its owned verification staging directory. Source-buffer archive tests had not covered file-handle lifetime.
- Repaired staged 0.12.0 live acceptance passed 28 checks, zero failures, one provider-access blocker at `.artifacts/knowledge-live-2026-10-05/staged-0.12.0-live-run/report.json`. Wrong-secret verification returns unsuccessful verification without an internal cleanup error; correct verification and native restore/reindex pass.
- Repaired staged desktop Knowledge acceptance passed 7 checks with zero renderer exceptions; broader live desktop smoke passed 29 checks. The OpenAI catalog candidates are selectable in the actual UI. Real semantic/vector/backend-switch checks remain blocked by fresh HTTP 403 `model_not_found` responses for both embedding models; no mock vectors were used.
- Left the actual 0.12.0 staged desktop running against its retained isolated acceptance profile and Observatory Project. Authenticated runtime version/profile and search for the UI-edited marker were verified after relaunch. Deployment evidence is `staged-0.12.0-live-run/local-deployment.json`; a local `Launch-Knowledge-Test.cmd` resumes that test deployment. The initial relaunch verification helper used an incorrect response-field name; correcting it confirmed the retained search without changing runtime code.
- The protected ordinary Program Files installation remains 0.10.2: Windows canceled the earlier elevation attempt, and installation-path selection is pending. Its profile and four Project databases are backed up. The staged local deployment does not constitute an installed upgrade, signing or rollback acceptance.

##### Files

- `packages/platform-service/src/backup/archive/reader.ts`
- `packages/platform-service/src/backup/archive/archive.test.ts`
- `packages/platform-service/src/backup/backup-service.integration.test.ts`
- `docs/changes/2026-10-05-backup-archive-stream-cleanup.md`

### Maintenance

#### Prepare version 0.12.0

**Impact:** none

[Permanent work record](docs/changes/2026-10-05-release-0.12.0.md).

##### Summary

Prepare version 0.12.0 from 0.11.0, retaining all pending work records in the changelog and detailed release notes.

##### Details

Synchronize first-party workspace and internal dependency versions. The lockfile must be refreshed separately. No tag, publication, or build is performed by version preparation.

##### Validation

Work-record freshness, local file coverage, version progression, and recorded impact checked before preparation. `npm install --package-lock-only --ignore-scripts` and release version check passed. Full build/typecheck/lint/test gate passed 33 tasks without cache hits: platform service 513 passing tests and 11 existing skips; Theia extension 104 passing tests. Tracking tests passed all 24 tests. Formatting, generated reference/inventory/evidence checks and a native equivalent relative-link scan passed (248 Markdown files, 1, 171 links); original Git Bash link scan remains incomplete. A plaintext credential scan found zero configured-key values across 1, 097 changed/artifact files. Existing dependency advisories remain unchanged.

Windows packaging/staging passed native addons, LanceDB/Qdrant dependencies, packaged service startup/shutdown, matching 0.12.0 versions and 30 bundled skills. The unsigned installer is `Windows-Release/0.12.0/PlayWeld-0.12.0-x64.exe`, SHA-256 `49dacf7d9d08ae683f37e7fe330df12ff291cfe44a5e66e41d13cc1eb3f1e517`. Staged live knowledge acceptance passed 28 checks with one external provider blocker; Knowledge UI passed 7 and broader desktop smoke passed 29, both with zero renderer exceptions. The staged desktop is running with the retained isolated test Project; protected installer upgrade remains pending after canceled Windows elevation. Source fingerprints are recorded in `local-build.json`; no tag, public publication or signing occurred. See the archive cleanup work record for failure and evidence boundaries.

Final plaintext-key scan covered 1, 376 changed/artifact files with zero matches; three locked files in the running desktop profile could not be read. The excessively slow owned Git Bash link scan was stopped; the native equivalent completed successfully. These limits remain explicit.

##### Files

- `packages/archive-extractor/package.json`
- `packages/contracts/package.json`
- `packages/platform-service/package.json`
- `packages/plugin-sdk/package.json`
- `packages/service-client/package.json`
- `packages/theia-control-room/package.json`
- `packages/plugins/sample-hello/package.json`
- `apps/control-room/package.json`
- `apps/control-room-browser/package.json`
- `package-lock.json`

## 0.11.0

### Fixed

#### Restore OpenAI embedding candidates in model discovery

**Impact:** patch

[Permanent work record](docs/changes/2026-10-05-openai-embedding-discovery.md).

##### Summary

OpenAI model discovery now offers the catalogued embedding models when a successful first-party model listing omits them, so they can be imported and selected in Knowledge settings using the existing provider account.

##### Details

- Supplement successful discovery for OpenAI accounts using the official HTTPS `/v1` endpoint with missing embedding entries from the existing metadata catalog (`text-embedding-3-small` and `text-embedding-3-large`). Preserve the returned provider metadata, avoid duplicate entries, and keep catalog provenance distinct from provider API evidence.
- Preserve preview without writes, explicit selected-model imports, account isolation, manual metadata precedence, and provider errors. Custom OpenAI endpoints and other provider kinds do not receive first-party candidates.
- Candidates describe published embedding capabilities, not confirmed account access. The existing Knowledge profile flow calls the embeddings API to verify access and determine dimensions before saving the profile. Discovery does not send a paid embedding probe or change credentials.
- Preserve and extend the pre-existing uncommitted regression test with selected import/update, custom endpoint isolation, no duplicates, authoritative provider capability metadata, and failed discovery coverage.
- No RPC, database, package identifier, version, or migration changes. The running packaged application has not been replaced or restarted by this change.

##### Validation

- Before the fix, `npm test -w @gamecrafter/platform-service -- src/models/model-registry.test.ts` failed because preview returned only the fixture chat model instead of the two embedding candidates. The original four-test suite passed after the fix.
- Read-only authenticated inspection of the running default-profile service confirmed one enabled first-party OpenAI account, no registered embedding models, and successful preview discovery of 19 models with no embedding capabilities. No credentials were emitted or changed.
- Existing Knowledge widget tests passed: six tests, including rendering a selectable OpenAI embedding model.
- OpenAI's published embedding model names were checked against its [embedding guide](https://developers.openai.com/api/docs/guides/embeddings) on 2026-10-05. Their absence from this account's discovery is live local evidence, not a claim that OpenAI universally omits them.
- `npx turbo run build typecheck lint test` passed all 33 tasks (21 cache hits), including both Electron and development browser application builds. Platform service: 109 test files, 511 passed and 11 existing platform-dependent tests skipped. Theia extension: 25 test files and 104 passed. The expanded discovery regression and six Knowledge integration tests passed in this full run.
- `npm run format:check`, `git diff --check`, and `npm run changelog:check -- --base HEAD` passed.
- `scripts/check-links.sh` was launched using Git Bash; its full scan has not completed at handoff. An equivalent temporary Node scan of the same paths, fenced-block exclusions, relative file targets, and heading slug rules passed: 242 Markdown files, 1, 162 relative links, zero failures. Temporary redacted diagnostics and the link scanner are under ignored `.turbo/` and are not product tooling.
- Paid embedding calls, selection in the installed application, and installer deployment remain unverified. No dependency installation was needed; the existing pinned workspace dependencies were used.

##### Files

- `packages/platform-service/src/models/model-registry.ts`
- `packages/platform-service/src/models/model-registry.test.ts`
- `docs/changes/2026-10-05-openai-embedding-discovery.md`

### Maintenance

#### Live knowledge acceptance project and local deployment

**Impact:** none

[Permanent work record](docs/changes/2026-10-05-live-knowledge-acceptance.md).

##### Summary

Add a repeatable live knowledge acceptance runner and prepare local deployment of the embedding discovery fix. The runner uses a separate service process, retained native test Projects, supported authenticated RPC, real files/databases and an existing encrypted provider account; it does not substitute fake embedding vectors.

##### Details

- Exercise gathering across canon, documents, code, board messages, synchronized binding decisions and asset provenance metadata; validate source filters, original quotes and citations.
- Exercise native-file watcher updates, canon/board edits, status and record-type filters, reference graphs, duplicate-ID conflicts and recovery, broken references and repair, deletion, idempotent reconciliation, two-Project isolation, checkpointed process restart and full rebuild.
- Exercise encrypted native Project backup verification, wrong-secret rejection, restoration into a new directory/Project identity, byte-identical edited sources, rebuilt search and nonempty-target refusal.
- Preserve each run in a new ignored artifact directory with a redacted incremental report, logs, encrypted test profile and inspectable synthetic Projects. Read the original account only to transfer its credentials in memory into the isolated profile; leave the ordinary provider account unchanged.
- Add a desktop acceptance runner for the retained live profile: inspect the actual embedding selector, search citations and retained record detail, then verify a service edit updates the open record through notifications and becomes searchable. Retain screenshots and captured renderer exceptions.
- Exercise real discovery preview and selected embedding import. When the provider denies the embedding probe, verify no embedding profile is persisted and hybrid search explicitly reports its lexical fallback. Mark semantic/vector acceptance blocked rather than using mocks.
- When real embedding access is available, also exercise paraphrase semantic/hybrid search, SQLite/LanceDB/managed-Qdrant backend switching and vector/profile retention after restart. Those cases cannot be claimed passing until executed.
- Local deployment is authorized by the user's 2026-10-05 request. Preserve ordinary configuration through checkpointed backup, installer upgrade and before/after comparison. No public release, tag, push, signing, uninstall or rollback is requested.

##### Validation

- `node scripts/verify-knowledge-live.cjs --help` passed.
- Live source process run `.artifacts/knowledge-live-2026-10-05/source-run-4/report.json`: 26 checks passed, zero failures, one provider blocker. Initial runner development failures were incorrect scenario setup (binding a finding instead of a proposal) and an incorrect expectation that two uncommitted edits have different revision labels; corrected the harness to use valid proposal binding and a committed-to-worktree revision transition.
- Expanded separate-process source release run `.artifacts/knowledge-live-2026-10-05/source-release-run/report.json`: 28 checks passed, zero failures, one provider blocker, including actual encrypted backup and restore.
- Fresh live OpenAI probes for `text-embedding-3-small` and `text-embedding-3-large` returned HTTP 403 `model_not_found` and zero dimensions. The source runner confirmed the same provider rejection through `knowledge/embeddingProfile/set`. No key values or raw provider errors were retained.
- Staged 0.11.0 general desktop smoke passed 29 checks with zero renderer exceptions. Knowledge desktop acceptance passed 7 checks with zero renderer exceptions after correcting the runner's ProjectHome navigation selector. Evidence remains under `.artifacts/knowledge-live-2026-10-05/staged-live-run/` and `.artifacts/documentation-electron/1791214175813/smoke/report.json`. The runner labels target desktop checks without assuming the executable is installed.
- Expanded staged 0.11.0 live acceptance passed 26 checks before a real Windows backup cleanup failure stopped the run. The archive-stream repair is recorded separately; this candidate is not accepted as a complete deployment.
- Ordinary installed 0.10.2 profile and four Project databases were checkpointed and backed up before attempting the upgrade. Windows elevation was canceled; the installed version remains unchanged and installation-path selection is pending. Do not treat staged acceptance as installed acceptance.

##### Files

- `scripts/verify-knowledge-live.cjs`
- `scripts/verify-knowledge-ui.cjs`
- `docs/changes/2026-10-05-live-knowledge-acceptance.md`

#### Prepare version 0.11.0

**Impact:** none

[Permanent work record](docs/changes/2026-10-05-release-0.11.0.md).

##### Summary

Prepare version 0.11.0 from 0.10.3, retaining all pending work records in the changelog and detailed release notes.

##### Details

Synchronize first-party workspace and internal dependency versions. The lockfile must be refreshed separately. No tag, publication, or build is performed by version preparation.

##### Validation

Work-record freshness, local file coverage, version progression, and recorded impact checked before preparation. `npm install --package-lock-only --ignore-scripts`, `npm ci`, and `node scripts/check-release-version.cjs v0.11.0` passed. The clean-dependency `npx turbo run build typecheck lint test --output-logs=errors-only` run passed all 33 tasks without cache hits: platform service 511 tests passed with 11 existing platform/environment skips; Theia extension 104 tests passed. Tracking regression tests passed (24 tests); generated RPC/settings, documentation inventory/evidence, formatting and release changelog checks passed. An equivalent native Node link scan passed 245 Markdown files and 1, 167 relative links; the slower Git Bash scan remains incomplete.

Windows packaging and staging passed native addon, LanceDB, Qdrant, packaged service lifecycle, matching versions and 30 bundled-skill checks. The unsigned installer is staged at `Windows-Release/0.11.0/PlayWeld-0.11.0-x64.exe`; SHA-256 is `65c50ced1b7d5c649df123292002c52ce1a7351602235f9831c2fa9e37c8ff79`. `local-build.json` records the dirty pre-commit source fingerprints; no tag or public release was created. Installer deployment and live desktop/knowledge acceptance are tracked in the companion work record. No signing certificate is configured. Dependency installation reported 56 existing advisories (5 low, 40 moderate, 11 high); no dependency upgrades were applied.

##### Files

- `packages/archive-extractor/package.json`
- `packages/contracts/package.json`
- `packages/platform-service/package.json`
- `packages/plugin-sdk/package.json`
- `packages/service-client/package.json`
- `packages/theia-control-room/package.json`
- `packages/plugins/sample-hello/package.json`
- `apps/control-room/package.json`
- `apps/control-room-browser/package.json`
- `package-lock.json`

## 0.10.3

### Fixed

#### Preserve A2A Continuation Context

**Impact:** patch

[Permanent work record](docs/changes/2026-10-05-a2a-continuation-context.md).

##### Summary

Outbound A2A `send` and `stream` continuations now reuse the remote context ID stored with the remote task owned by the current connection and Project. If that owned record has no context ID, continuation is rejected before agent discovery or network access instead of sending an invalid empty context.

##### Details

- The remote-task lookup retains the existing `(connectionId, remoteTaskId, ProjectId)` ownership check and returns the recorded context ID for message construction.
- Initial messages remain unchanged; task `get`, `cancel`, and `resubscribe` continue to require Project ownership but do not require a message context.
- Added coverage for non-streaming and streaming continuation payloads, and for rejecting continuation when the stored context is missing. No production API or storage schema changed.

##### Validation

- Regression red phase: `npm test -w @gamecrafter/platform-service -- src/a2a/a2a-service.integration.test.ts -t "reuses the recorded remote context"` failed because both continuation payloads had an empty `contextId` instead of `remote-continuation-context`.
- The expanded cold-client regression passed in 5.00 seconds and proves both missing-context send and stream reject before Agent Card discovery or JSON-RPC.
- `npm test -w @gamecrafter/platform-service -- src/a2a` — 2 files, 21 tests passed in 21.22 seconds.
- `npm run typecheck -w @gamecrafter/platform-service` — passed. The first full-gate attempt caught nullable arguments at the message-builder call sites; the fixed code now passes the non-null fallback only after the operation-specific missing-context guard.
- `npx turbo run build typecheck lint test --output-logs=errors-only --force` — all 33 tasks passed in 5m56s.
- `npm run test:changes` — 2 files, 24 tests passed in 55.46 seconds; `node scripts/check-release-version.cjs v0.10.2` and `npm run changelog:check -- --base HEAD` — passed.
- `npm run format:check`, `bash scripts/check-links.sh`, system-reference/inventory checks, documentation-evidence check, and `git diff --check` — passed.
- Provider live calls and external A2A interoperability are not claimed.

##### Files

- `packages/platform-service/src/a2a/a2a-service.ts`
- `packages/platform-service/src/a2a/a2a-service.integration.test.ts`
- `docs/changes/2026-10-05-a2a-continuation-context.md`

#### Guide Embedding Model Discovery

**Impact:** patch

[Permanent work record](docs/changes/2026-10-05-knowledge-embedding-model-discovery.md).

##### Summary

Knowledge settings now explain why connected provider credentials alone do not populate the embedding-model selector and provide a direct route to Models & Routing.

##### Details

- The selector remains limited to enabled models declared to support embeddings. The empty state now guides users to discover and add a compatible model, and to check API-key project access if discovery has no embedding models, preserving explicit model registration and routing controls.
- Added regression coverage for the empty state and verified that an enabled OpenAI `text-embedding-3-small` model remains selectable. No provider, storage, or RPC behavior changed.

##### Validation

- Regression red phase: `npm test -w @gamecrafter/theia-control-room -- src/browser/knowledge-widget.test.ts -t "explains how to add embedding models"` failed because the empty selector provided no discovery guidance.
- `npm test -w @gamecrafter/theia-control-room -- src/browser/knowledge-widget.test.ts` — 6 tests passed, including the discovery command action and selectable OpenAI embedding model.
- `npm test -w @gamecrafter/theia-control-room`, package typecheck, and package lint — passed (104 tests).
- `npx turbo run build typecheck lint test --output-logs=errors-only` — all 33 tasks passed.
- `npm run format:check`, `npm run changelog:check -- --base HEAD`, and `git diff --check` — passed.
- The later authorized live OpenAI API access diagnostic is recorded in `docs/changes/2026-10-05-openai-embedding-key-access-diagnostic.md`.

##### Files

- `packages/theia-control-room/src/browser/knowledge-widget.tsx`
- `packages/theia-control-room/src/browser/knowledge-widget.test.ts`
- `docs/changes/2026-10-05-knowledge-embedding-model-discovery.md`

### Maintenance

#### Prepare version 0.10.3

**Impact:** none

[Permanent work record](docs/changes/2026-10-04-release-0.10.3.md).

##### Summary

Prepare version 0.10.3 from 0.10.2, retaining all pending work records in the changelog and detailed release notes.

##### Details

Synchronize first-party workspace and internal dependency versions. The lockfile must be refreshed separately. No tag, publication, or build is performed by version preparation.

##### Validation

Work-record freshness, local file coverage, version progression, and recorded impact checked before preparation. `npm install --package-lock-only --ignore-scripts`, `npm ci`, and `node scripts/check-release-version.cjs v0.10.3` passed. `npx turbo run build typecheck lint test` passed all 33 tasks; the platform-service suite passed 510 tests with 11 environment/platform skips, and the Control Room suite passed 104 tests. `npm run test:changes` passed 24 tests. System-reference, documentation inventory/evidence/link, formatting, and release changelog checks passed.

`npm run package:win -w @gamecrafter/control-room` built the unsigned Windows x64 installer and passed native module, bundled Qdrant/LanceDB, packaged-service lifecycle, version, and bundled-skill verification. `node scripts/stage-windows-release.cjs` staged `Windows-Release/0.10.3`; installer SHA-256: `3f0bc2c7b4d341c12dc465c0787e9017f15bbdec00fc4ddca093640e870c1da6`. The packaged Electron smoke passed 29 UI/service checks with zero renderer errors in an isolated profile. No public tag or GitHub release was created. The local build manifest records the pre-commit base revision and dirty-source fingerprints. The package remains unsigned because no code-signing certificate is configured; Electron Builder also warned that ASAR is disabled. `npm ci` reported 56 dependency advisories (5 low, 40 moderate, 11 high); no dependency upgrades were applied.

##### Files

- `packages/archive-extractor/package.json`
- `packages/contracts/package.json`
- `packages/platform-service/package.json`
- `packages/plugin-sdk/package.json`
- `packages/service-client/package.json`
- `packages/theia-control-room/package.json`
- `packages/plugins/sample-hello/package.json`
- `apps/control-room/package.json`
- `apps/control-room-browser/package.json`
- `package-lock.json`

#### Launch the Embedding Selector Update Locally

**Impact:** none

[Permanent work record](docs/changes/2026-10-05-local-embedding-selector-test-deployment.md).

##### Summary

Built and launched the updated Electron Control Room from the working checkout for local testing, connected to the already-running platform service and profile.

##### Details

- Built `@gamecrafter/control-room` in development mode and launched the generated app with the workspace Electron executable. The app used the existing environment and profile; no credentials or profile data were copied or changed.
- The shell supplied `ELECTRON_RUN_AS_NODE`, which makes Electron expose Node mode instead of its application API. Cleared that variable only for the Electron launch process; no persistent environment setting was changed.
- This is a source-built local test run, not an installed upgrade, installer/package, version preparation, tag, or public release. The launched app uses the existing local service, which remains running after the Control Room window closes.

##### Validation

- `npm run build -w @gamecrafter/control-room` — passed; browser, Node backend, and Electron builds reported zero errors.
- The initial generic `npm run start -w @gamecrafter/control-room` invocation exited because `ELECTRON_RUN_AS_NODE` was set. After clearing it for the child only, Electron startup logs reached frontend state `ready` and the Control Room backend accepted connections on its local loopback port.
- `node packages/platform-service/lib/cli.js status` — the existing service remained responsive before and after launch.
- The local desktop process and backend were observed running. No live provider request or installer operation was performed.

##### Files

- `docs/changes/2026-10-05-local-embedding-selector-test-deployment.md`

#### Verify Live OpenAI Embedding Model Access

**Impact:** none

[Permanent work record](docs/changes/2026-10-05-openai-embedding-key-access-diagnostic.md).

##### Summary

Used an authorized OpenAI development credential to distinguish model-discovery filtering from provider model access. The live API responses matched discovery and denied direct embedding requests, so the UI was not hiding models returned by the API.

##### Details

- The read-only `model/discover` preview and direct `GET /v1/models` agreed; neither included embedding IDs.
- Minimal direct embedding requests for documented OpenAI embedding model IDs were denied with HTTP 403 `model_not_found` and returned no vectors ([embedding API](https://developers.openai.com/api/docs/api-reference/embeddings/create), [model catalog](https://developers.openai.com/api/docs/models/all)).
- This evidence indicates the tested credential's provider scope must expose and accept an embedding model before discovery can add it. The credential and account were not changed; no key, account identifier, or private profile data is recorded. No provider behavior changed as part of this diagnostic.

##### Validation

- Authenticated local service `model/discover` with `preview: true` and direct `GET /v1/models` — responses agreed; no embedding IDs appeared ([OpenAI API reference](https://developers.openai.com/api/reference/resources/models/methods/list)).
- Minimal authorized `POST /v1/embeddings` probes — HTTP 403 `model_not_found`; zero vectors returned.
- Provider discovery was run as a preview and persisted no model changes. API key values were not included in command output or retained artifacts.

##### Files

- `docs/changes/2026-10-05-openai-embedding-key-access-diagnostic.md`

#### Publish the PlayWeld 0.10.2 Testing Release

**Impact:** none

[Permanent work record](docs/changes/2026-10-05-publish-0.10.2-testing-release.md).

##### Summary

The v0.10.2 Desktop Release workflow completed successfully on Windows and Linux, and the generated unsigned testing prerelease was published on GitHub. This follow-up records the hosted result after the tag commit and updates the current release status; it does not move or modify the v0.10.2 tag.

##### Details

- Workflow run `37258256030` validated commit `f1115fb175247405c99fa9cfed3fd89be5dff2f2`, packaged both Windows and Linux targets, created release metadata, and uploaded the release assets.
- Published prerelease: <https://github.com/scarecr0w12/PlayWeld/releases/tag/v0.10.2>.
- Assets: `PlayWeld-0.10.2-x64.exe`, `PlayWeld-0.10.2-amd64.deb`, `PlayWeld-0.10.2-x86_64.AppImage`, `gamecrafter-release.json`, and `SHA256SUMS.txt`.
- The GitHub Windows installer digest is `sha256:8aaa3ba4c890064bd44d8d2fda74e533e3695e04d6a638cf991ea6bea8e33ef0`. The local staged installer is separately recorded in `2026-10-05-windows-workspace-test-timeout.md`.
- It is an unsigned testing prerelease because no signing key is configured. NSIS install/uninstall, upgrade/rollback, and live provider/A2A acceptance remain unverified.

##### Validation

- `gh run view 37258256030 --repo scarecr0w12/PlayWeld` — completed successfully; validate, Windows package, Linux package, and release jobs passed.
- `gh release view v0.10.2 --repo scarecr0w12/PlayWeld` — `isDraft: false`, `isPrerelease: true`; all five expected assets uploaded.

##### Files

- `docs/STATUS.md`
- `docs/RELEASE_GUIDE.md`
- `docs/changes/2026-10-05-publish-0.10.2-testing-release.md`

## 0.10.2

### Fixed

#### Stabilize Windows CI Test Timeouts

**Impact:** patch

[Permanent work record](docs/changes/2026-10-05-windows-workspace-test-timeout.md).

##### Summary

The v0.10.0 Windows release job exceeded Vitest's default five-second timeout in a SQLite vector-store test; v0.10.1 then timed out in the Project clone test. A previous full Windows-equivalent run also exposed a Qdrant readiness bound, fixed in v0.10.1; during v0.10.2 preparation, the Git-heavy release-ledger test exceeded five seconds locally. This test-only patch sets a 15-second platform-service default, adds 20-second deadlines to the Project-clone and release-ledger tests, and retains the SQLite/Qdrant bounds from v0.10.1. It does not change production behavior. The v0.10.0 and v0.10.1 tags remain unchanged, so the correction uses v0.10.2.

##### Details

- The Project clone test exercises database migration, chat copy, settings copy, task identity/leases, worktree exclusion, and vector-store exclusion across two Project records. It still checks the same behavior; only its deadline changes to 20 seconds.
- Platform-service Vitest tests now use a 15-second default to avoid repeated cold Windows runner failures for integration tests. The SQLite and Qdrant cases retain the explicit 20/15-second bounds added in v0.10.1.
- The release-ledger test still checks version progression and closed tracking before packaging; its timeout is 20 seconds to cover temporary-repository Git operations on cold runners.
- No production runtime code changes.

##### Validation

- `npm test -w @gamecrafter/platform-service -- src/projects/workspace.test.ts` — 1 file, 4 tests passed in 2.57 seconds locally.
- `npm run test:changes` — 2 files, 24 tests passed in 57.47 seconds locally.
- `npx turbo run build typecheck lint test --output-logs=errors-only --force` — all 33 tasks passed in 6m28s.
- `node scripts/check-release-version.cjs v0.10.2` and `npm run changelog:check -- --release --base HEAD` — passed.
- `npm run format:check`, `bash scripts/check-links.sh`, system-reference/inventory checks, documentation-evidence check, and `git diff --check` — passed.
- `npm run package:win -w @gamecrafter/control-room` — built the unsigned Windows x64 0.10.2 package; native dependencies, packaged platform-service startup/shutdown, and 30 bundled skills verified.
- `node scripts/stage-windows-release.cjs` — staged the package at `Windows-Release/0.10.2`.
- `node scripts/verify-documentation-electron.cjs` with `GAMECRAFTER_ELECTRON_EXECUTABLE` set to the staged executable — 30 isolated Electron/service checks passed with no renderer errors. Installer SHA-256: `edaa5f328d0f724e6b24e69f2ad35517f20d53d48281c9970fc97aa92fb541a0`.
- The v0.10.1 Linux package job passed; its Windows package job failed when the Project-clone test exceeded five seconds. The corrective 0.10.2 Windows workflow must rerun the full test suite; do not move or reuse the v0.10.0 or v0.10.1 tags.
- NSIS install/uninstall, upgrade/rollback, signing, and the GitHub v0.10.2 release workflow remain unverified.

##### Files

- `packages/platform-service/package.json`
- `packages/platform-service/src/projects/workspace.test.ts`
- `scripts/change-tracking.test.ts`
- `docs/STATUS.md`
- `docs/RELEASE_GUIDE.md`
- `docs/changes/2026-10-05-windows-workspace-test-timeout.md`

### Maintenance

#### Prepare version 0.10.2

**Impact:** none

[Permanent work record](docs/changes/2026-10-04-release-0.10.2.md).

##### Summary

Prepare version 0.10.2 from 0.10.1, retaining all pending work records in the changelog and detailed release notes.

##### Details

Synchronize first-party workspace and internal dependency versions. The lockfile must be refreshed separately. No tag, publication, or build is performed by version preparation.

##### Validation

Work-record freshness, local file coverage, version progression, and recorded impact checked before preparation. Dependency installation, refreshed lockfile verification, quality checks, packaging, signing, and live acceptance are not yet verified by this preparation record; retain their actual evidence in a follow-up work record.

##### Files

- `packages/archive-extractor/package.json`
- `packages/contracts/package.json`
- `packages/platform-service/package.json`
- `packages/plugin-sdk/package.json`
- `packages/service-client/package.json`
- `packages/theia-control-room/package.json`
- `packages/plugins/sample-hello/package.json`
- `apps/control-room/package.json`
- `apps/control-room-browser/package.json`
- `package-lock.json`

## 0.10.1

### Fixed

#### Stabilize Windows Vector-Store Release Tests

**Impact:** patch

[Permanent work record](docs/changes/2026-10-05-windows-sqlite-ci-timeout.md).

##### Summary

Increase test-only timing bounds for the SQLite and managed-Qdrant vector-store integration tests. The v0.10.0 Windows package job exceeded the default five-second Vitest timeout on the SQLite persistence test. A subsequent full Windows-equivalent local run exposed a 1.5-second Qdrant readiness timeout firing before its fake server returned the expected wrong-version response. The failed v0.10.0 tag remains unchanged; both timing-only corrections are assigned to a new patch release.

##### Details

- The SQLite test still asserts the same persistence, idempotent upsert, Project isolation, profile-version isolation, deletion, and search behavior; its per-test timeout is now 20 seconds.
- The managed-Qdrant wrong-version test still asserts the same version rejection; its manager readiness limit is 10 seconds and its Vitest timeout is 15 seconds so cold Windows startup time does not mask the expected error.
- No production code or application behavior changes.

##### Validation

- `npm test -w @gamecrafter/platform-service -- src/knowledge/sqlite-vector-store.test.ts` — 1 file, 4 tests passed in 616 ms locally.
- `npm test -w @gamecrafter/platform-service -- src/knowledge/managed-qdrant.test.ts` — 1 file, 6 tests passed in 9.88 seconds locally.
- `node scripts/check-release-version.cjs v0.10.1`, release changelog/evidence checks, and `npx turbo run build typecheck lint test --output-logs=errors-only --force` — 33 tasks successful.
- `npm run package:win -w @gamecrafter/control-room`, `node scripts/stage-windows-release.cjs`, and the isolated packaged Electron/service smoke — passed for local 0.10.1; manifest records the dirty pre-commit source fingerprint. No installer was installed into the normal profile.
- Release workflow evidence: v0.10.0 validation and Linux package jobs passed; its Windows job failed on the 5-second SQLite timeout. The corrective v0.10.1 tag/workflow is pending; do not move or reuse v0.10.0.

##### Files

- `docs/RELEASE_GUIDE.md`
- `docs/STATUS.md`
- `packages/platform-service/src/knowledge/sqlite-vector-store.test.ts`
- `packages/platform-service/src/knowledge/managed-qdrant.test.ts`
- `docs/changes/2026-10-05-windows-sqlite-ci-timeout.md`

### Maintenance

#### Prepare version 0.10.1

**Impact:** none

[Permanent work record](docs/changes/2026-10-04-release-0.10.1.md).

##### Summary

Prepare version 0.10.1 from 0.10.0, retaining all pending work records in the changelog and detailed release notes.

##### Details

Synchronize first-party workspace and internal dependency versions. The lockfile must be refreshed separately. No tag, publication, or build is performed by version preparation.

##### Validation

Work-record freshness, local file coverage, version progression, and recorded impact checked before preparation. Dependency installation, refreshed lockfile verification, quality checks, packaging, signing, and live acceptance are not yet verified by this preparation record; retain their actual evidence in a follow-up work record.

**Validation update (2026-10-05):** `npm ci` installed the synchronized lockfile; `node scripts/check-release-version.cjs v0.10.1`, `npm run changelog:check -- --release --base HEAD`, and `npm run test:changes` (24 tests) passed. The SQLite vector-store test passes with its increased CI timeout (4 tests, 616 ms locally); the managed-Qdrant suite passes with the longer wrong-version readiness window (6 tests, 9.88 seconds). Fresh `npx turbo run build typecheck lint test --output-logs=errors-only --force` passed all 33 tasks. Packaging, signing, local 0.10.1 staging/smoke, GitHub workflow, and live acceptance remain pending.

**Local package update (2026-10-05):** `npm run package:win -w @gamecrafter/control-room` passed the Windows native/service verifier, `node scripts/stage-windows-release.cjs` staged `Windows-Release/0.10.1`, and the packaged Electron/service harness passed 30 UI checks with zero renderer errors in an isolated profile. `local-build.json` records dirty pre-commit fingerprints; the local artifact is unsigned. The v0.10.1 GitHub workflow/publication, signed assets, installer install/uninstall, upgrade/rollback, and live provider/A2A acceptance remain unverified.

##### Files

- `packages/archive-extractor/package.json`
- `packages/contracts/package.json`
- `packages/platform-service/package.json`
- `packages/plugin-sdk/package.json`
- `packages/service-client/package.json`
- `packages/theia-control-room/package.json`
- `packages/plugins/sample-hello/package.json`
- `apps/control-room/package.json`
- `apps/control-room-browser/package.json`
- `package-lock.json`

## 0.10.0

### Added

#### Model Providers, Routing Metadata, and A2A Connectivity

**Impact:** minor

[Permanent work record](docs/changes/2026-10-04-model-providers-routing-a2a.md).

##### Summary

Expanded provider account/model discovery and added bidirectional A2A v1.0 agent connectivity. The implementation distinguishes provider-declared, catalog-sourced, account-configured, manual, and unknown model metadata; keeps the existing access/broker boundaries for external task execution; and exposes account/A2A controls in the Theia Connections and Models & Routing views.

##### Details

- Added named API adapters for OpenAI, Google Gemini Developer API, OpenRouter, xAI, Mistral, DeepSeek, Groq, and Azure OpenAI, retaining Anthropic and generic OpenAI-compatible endpoints. Account records remain independent and unlimited. Settings now provide provider endpoint presets, account edit/credential replacement/removal, and custom secret headers.
- Added Azure API-version/deployment configuration. The callable deployment name remains `providerModelId`; its separately configured/reported base model uses `catalogModelId`. Catalog enrichment never treats an unmapped Azure deployment name as a base-model ID.
- Added a versioned exact-ID provider catalog sourced to vendor model cards/APIs. Added researched capability/limit/price entries for exact current models where the source supports fields. Tiered or unrepresentable prices remain unknown; no silent paid completion probes are used. Research is recorded in [`docs/research/model-providers-and-a2a.md`](docs/research/model-providers-and-a2a.md).
- Model capabilities now distinguish `true`, `false`, and `null`/unknown. Metadata provenance, source URL, timestamp, and confidence are stored per field; account configuration has its own provenance. Discovery preserves non-null manual overrides, while setting a field to unknown clears that override for later discovery. Legacy provider capability values without per-field evidence (including the old implicit `chat: true`) are shown as unverified/unknown; existing model/account IDs and encrypted credentials are preserved.
- Completion routing requires known `chat: true`; unknown values do not satisfy required capability filters. Vision is recorded as a provider fact but is not routable while the common chat request is text-only. Embeddings use the dedicated embedding operation. Provider-category tags are descriptive; the reviewed provider categories do not exactly match builtin hard role/work-type restrictions, which therefore remain unrestricted unless a future sourced mapping matches.
- Added A2A v1.0 outbound Agent Card discovery and brokered send, send-stream, resubscribe, get, cancel, and Project-scoped remote-task list operations. Existing remote task IDs require a matching ledger owner Project before get/cancel/resubscribe/send-with-task-ID, so possession of a remote ID alone grants no cross-Project authority. Stream updates are forwarded through the broker to persisted local `a2a.remote_progress` TaskEvents. The remote-task ledger records connection/task/context/status and local Project/task/call correlation for reconciliation. Static API-key, bearer, basic, and custom-header credentials are stored in the encrypted profile credential store; credential values are never returned to list/discovery results.
- Granted `a2a/*` to the builtin coordinator role for external delegation; other builtin roles remain excluded by default and all calls still pass Project access/approval policy. Bounded streamed updates enter the local task event history when delegation runs in a local Task context.
- Added an opt-in inbound A2A JSON-RPC gateway bound only to `127.0.0.1`. One-time bearer credentials are stored as hashes and have explicit Project/role/task-operation grants. The gateway maps task create/get/continue/stream/cancel to durable TaskService operations; continuation cannot approve broker requests. Revoking a token or changing a grant terminates active streams. Create and failed-task retry results are revalidated after deduplication against Project, role, A2A client, and context ownership.
- Split inbound rate/concurrency controls so unauthenticated loopback requests cannot exhaust authenticated-client quotas. Agent Cards have a separate public-read limit. Host/Origin checks, no permissive CORS, request/stream/result bounds, and no credential forwarding across redirects/origins are enforced.
- Added A2A agent and inbound gateway/client management to Connections; added provider account/header, Azure deployment/catalog mapping, tri-state capability, editable token limits, per-field provenance, and manual override/reset controls to Models & Routing.
- Added profile database migrations 16–18 for provider options/model provenance/catalog IDs, A2A connections/client grants/task mappings, and durable outbound remote-task reconciliation. Added the stable `@a2a-js/sdk@1.2.1`, Express 5, and matching Express typings; the SDK version meets the repository's dependency-age rule.
- Fixed the first packaged Windows smoke: Electron's broad `node_modules/**/src` exclusion had removed the JavaScript entry point used by `debug`, so the packaged service sidecar could not start. Packaging now excludes TypeScript source files without dropping runtime JavaScript, and the Windows verifier launches the packaged sidecar in an isolated profile to check token, lock, status, and shutdown.
- Updated platform design, technical architecture, agent/tool contracts, the open decision register, development work packages, user/operations handbooks, routing guide, generated API/RPC/settings references, and documentation inventory. A2A support is documented as distinct from MCP; public/LAN ingress, OAuth/OIDC, gRPC, webhooks, inbound task listing, and non-text inbound parts remain unsupported.

##### Validation

- `npm run build -w @gamecrafter/contracts` — passed.
- `npm run typecheck -w @gamecrafter/platform-service` — passed.
- `npm run lint -w @gamecrafter/platform-service` — passed.
- `npm run typecheck -w @gamecrafter/theia-control-room` — passed.
- `npm run lint -w @gamecrafter/theia-control-room` — passed.
- `npm test -w @gamecrafter/contracts` — 20 files, 71 tests passed.
- `npm test -w @gamecrafter/theia-control-room` — 25 files, 102 tests passed.
- `npm test -w @gamecrafter/platform-service -- src/a2a/inbound-server.test.ts` — 10 tests passed, including token/grant revocation, failed-retry client/context dedup isolation, create-only grants, streamed artifacts, and rate isolation.
- `npm test -w @gamecrafter/platform-service -- src/a2a/a2a-service.integration.test.ts src/profile/migrations.test.ts` — 13 tests passed.
- `npm test -w @gamecrafter/platform-service -- src/roles/role-registry.test.ts` — 2 tests passed; confirms the coordinator's default A2A tool grant.
- `npm test -w @gamecrafter/platform-service -- src/models/providers src/models/model-registry.test.ts src/models/model-catalog.test.ts src/models/router.test.ts src/models/models.integration.test.ts src/tools/tool-broker.integration.test.ts` — 8 files, 75 tests passed.
- `npm test -w @gamecrafter/theia-control-room -- src/browser/connections-widget.test.tsx src/browser/operations-pages-layout.test.tsx` — 14 tests passed.
- `npx turbo run build typecheck lint test --output-logs=errors-only --force` — 33 tasks successful with fresh execution.
- `npm ci` — installed the exact synchronized lockfile.
- `npm run release:version -- 0.10.0`, `node scripts/check-release-version.cjs v0.10.0`, `npm run changelog:check -- --release --base HEAD`, and `npm run test:changes` — passed; all nine workspaces and the lockfile are versioned `0.10.0`.
- `npm run package:win -w @gamecrafter/control-room` — passed Windows x64 packaging, native-module/skill/license checks, and the new packaged service token/lock/status/start/stop verifier.
- `node scripts/stage-windows-release.cjs` — staged `Windows-Release/0.10.0`; the initial broken staging/package is preserved separately as `0.10.0-pre-fix` and was caused by the prior `node_modules/**/src` exclusion dropping `debug/src/index.js`. `local-build.json` records the pre-commit source commit, changed-path hashes, and `workingTreeDirty: true`.
- `node scripts/verify-documentation-electron.cjs` with `GAMECRAFTER_ELECTRON_EXECUTABLE` set to the staged executable — 30 packaged Electron UI/service checks passed with zero renderer errors, including authenticated `service/info` version verification. It used an isolated versioned test profile; it did not install over the normal profile.
- `npm run format:check` — passed.
- `bash scripts/check-links.sh` — passed.
- `node scripts/generate-system-reference.cjs --check` — passed.
- `node scripts/generate-documentation-inventory.cjs --check` — passed.
- `git diff --check` — passed.
- `npm audit --workspace=@gamecrafter/platform-service --omit=dev` found no production service advisories. `npm audit --omit=dev` reports 43 existing low/moderate advisories in the pinned Theia/Electron dependency tree; the full development tree reports 56 advisories. No broad override/downgrade was applied because the repo pins Theia packages together. No Windows signing certificate or GitHub signing key is configured, so the local installer and planned GitHub testing prerelease are unsigned; the packaged test manifest labels this explicitly.
- Provider and A2A fixtures use local fake endpoints; no authenticated live provider calls or live external A2A interoperability were performed. Published catalog data is not proof that a configured account has permission/deployment access. An outbound send interrupted before the remote task ID is returned cannot be automatically reconciled or retried. Automated background catalog refresh cadence and exact local role/work-type mappings remain open. The local Electron run is not installer install/uninstall, upgrade, rollback, or stable-release acceptance.

##### Files

- `.kilo/plans/1791138077002-model-providers-routing-a2a.md`
- `apps/control-room/electron-builder.yml`
- `apps/control-room/scripts/verify-windows-native.cjs`
- `docs/API_REFERENCE.md`
- `CHANGELOG.md`
- `docs/CONTROL_ROOM_HANDBOOK.md`
- `docs/DEVELOPMENT_PLAN.md`
- `docs/RELEASE_GUIDE.md`
- `docs/MODEL_ROUTING_GUIDE.md`
- `docs/OPEN_DECISIONS.md`
- `docs/PLATFORM_DESIGN.md`
- `docs/SKILLS_AGENTS_AND_TOOLS.md`
- `docs/STATUS.md`
- `docs/SYSTEM_ARCHITECTURE.md`
- `docs/TECHNICAL_ARCHITECTURE.md`
- `docs/USER_GUIDE.md`
- `docs/changes/2026-10-04-model-providers-routing-a2a.md`
- `docs/reference/DOCUMENTATION_INVENTORY.md`
- `docs/reference/documentation-inventory.json`
- `docs/reference/rpc-schemas.json`
- `docs/research/model-providers-and-a2a.md`
- `package-lock.json`
- `packages/contracts/src/a2a/index.ts`
- `packages/contracts/src/a2a/schema.ts`
- `packages/contracts/src/index.ts`
- `packages/contracts/src/models/models.test.ts`
- `packages/contracts/src/models/schema.ts`
- `packages/contracts/src/rpc/protocol.ts`
- `packages/platform-service/package.json`
- `packages/platform-service/src/a2a/a2a-service.integration.test.ts`
- `packages/platform-service/src/a2a/a2a-service.ts`
- `packages/platform-service/src/a2a/inbound-server.test.ts`
- `packages/platform-service/src/a2a/inbound-server.ts`
- `packages/platform-service/src/models/completion-service.ts`
- `packages/platform-service/src/models/model-catalog.test.ts`
- `packages/platform-service/src/models/model-catalog.ts`
- `packages/platform-service/src/models/model-registry.test.ts`
- `packages/platform-service/src/models/model-registry.ts`
- `packages/platform-service/src/models/models.integration.test.ts`
- `packages/platform-service/src/models/providers/anthropic.ts`
- `packages/platform-service/src/models/providers/google-gemini.ts`
- `packages/platform-service/src/models/providers/http-utils.ts`
- `packages/platform-service/src/models/providers/index.ts`
- `packages/platform-service/src/models/providers/openai-compatible.ts`
- `packages/platform-service/src/models/providers/openai-providers.ts`
- `packages/platform-service/src/models/providers/provider-adapters.test.ts`
- `packages/platform-service/src/models/providers/provider.ts`
- `packages/platform-service/src/models/providers/providers.test.ts`
- `packages/platform-service/src/models/router.test.ts`
- `packages/platform-service/src/models/router.ts`
- `packages/platform-service/src/profile/migrations.test.ts`
- `packages/platform-service/src/profile/migrations.ts`
- `packages/platform-service/roles/coordinator/ROLE.md`
- `packages/platform-service/src/roles/role-registry.test.ts`
- `packages/platform-service/src/service.ts`
- `packages/platform-service/src/tasks/task-service.integration.test.ts`
- `packages/platform-service/src/tasks/task-service.ts`
- `packages/platform-service/src/tools/tool-broker.ts`
- `packages/platform-service/src/tools/tool-broker.integration.test.ts`
- `packages/platform-service/src/tools/tool-registry.ts`
- `packages/theia-control-room/src/browser/connections-widget.test.tsx`
- `packages/theia-control-room/src/browser/connections-widget.tsx`
- `packages/theia-control-room/src/browser/models-widget.tsx`
- `packages/theia-control-room/src/browser/operations-pages-layout.test.tsx`
- `packages/theia-control-room/src/common/control-room-protocol.ts`
- `packages/theia-control-room/src/node/control-room-service.ts`
- `scripts/generate-documentation-inventory.cjs`

### Maintenance

#### Prepare version 0.10.0

**Impact:** none

[Permanent work record](docs/changes/2026-10-04-release-0.10.0.md).

##### Summary

Prepare version 0.10.0 from 0.9.0, retaining all pending work records in the changelog and detailed release notes.

##### Details

Synchronize first-party workspace and internal dependency versions. The lockfile must be refreshed separately. No tag, publication, or build is performed by version preparation.

##### Validation

**Initial preparation state (before local packaging):**

Work-record freshness, file coverage, version progression, and recorded impact were checked. `node scripts/check-release-version.cjs v0.10.0`, `npm run changelog:check -- --release --base HEAD`, `npm run test:changes` (24 tests), `npm ci`, and the fresh `npx turbo run build typecheck lint test --output-logs=errors-only --force` gate (33 tasks) passed. Formatting, links, generated RPC/inventory references, documentation evidence, and `git diff --check` passed. `npm audit --workspace=@gamecrafter/platform-service --omit=dev` reports no production service advisories; the repository-wide production audit reports 43 existing low/moderate advisories in the pinned Theia/Electron dependency tree, and the full tree reports 56 including development dependencies. No dependency override was introduced because the prescribed broad fix downgrades Theia packages. Windows packaging/staging, local packaged-app smoke, GitHub workflow, signing, and live provider/A2A acceptance remain to be verified by release/deployment steps.

**Validation update (2026-10-05):** The local Windows 0.10.0 package and `Windows-Release/0.10.0` staging passed native/service verification; the isolated packaged Electron smoke passed 30 UI/service checks with zero renderer errors and verified `service/info` reports 0.10.0. `local-build.json` records the pre-commit source revision and changed-path hashes (`workingTreeDirty: true`), so the local package is not attributed solely to the base commit. The package is unsigned because no code-signing certificate or GitHub signing key is configured. GitHub workflow and publication, installer installation/uninstallation, upgrade/rollback, and live provider/A2A acceptance remain pending or unverified.

##### Files

- `packages/archive-extractor/package.json`
- `packages/contracts/package.json`
- `packages/platform-service/package.json`
- `packages/plugin-sdk/package.json`
- `packages/service-client/package.json`
- `packages/theia-control-room/package.json`
- `packages/plugins/sample-hello/package.json`
- `apps/control-room/package.json`
- `apps/control-room-browser/package.json`
- `package-lock.json`

## 0.9.0

### Added

#### Integrate bounded local decision models with tasks and routing

**Impact:** minor

[Permanent work record](docs/changes/2026-10-04-bounded-decision-model-integration.md).

##### Summary

Integrate independently running typed decision endpoints with PlayWeld task assessment and eligible model selection, using inactive-until-configured shadow defaults, explicit assist mode, durable evidence, and visible usage/history.

##### Details

- Add version-1 assessment/request/history contracts and System One/OpenRouter Decisions HTTP adapters. Reuse encrypted provider-account credentials; configure a judge explicitly rather than recursively Auto-route it. Non-loopback endpoints require consent and HTTPS; refuse redirects, bound request/response bytes, and cover streamed body reads with cancellation/deadlines. Validate named answers, known labels, finite normalized distributions, nullable confidence/usage, and reported truncation/collapsed options without inventing missing probabilities or zero prices.
- Assess task work kind, effort, missing context, review/decomposition/engine-validation needs, and eligible model options. Use short option labels and supply the configured routing objective/constraints. Suggestions are not task-state transitions, dependency creation, completion validation, permission grants, or review waivers.
- Shadow records only. Explicit assist can prefer a sufficiently concentrated recommendation after current account/model enablement, pools, capabilities, estimated budget/latency filters and manual choice. Recheck eligibility at preparation; uncertain/denied/failed/changed configurations retain ordinary routing. Agent turns require chat/tool capabilities rather than admitting incapable models into assisted dispatch.
- Add profile migration 15 for versioned Project/task assessment history plus service-owned Project events/checkpoint identities. Store hashes rather than summary/credential copies in the dedicated history. Coalesce concurrent identical calls, reuse matching task/state/configuration records without recharging usage, preserve unknown costs/counts, and include fresh decision usage in agent task spending before the worker call.
- Merge decision inference from its service-owned ledger into Audit Model Usage without treating it as worker completion or a router-training outcome. A tagged `decision` variant permits null token/cache counts; existing `completion` counters remain non-null. Known-only subtotals disclose incomplete counts. Audit consumers must handle the new variant; client/service source are updated together.
- Add a read-only Models & Routing assessment tab with independent loading/error/empty states, baseline/suggestion, bounded advice, latency/usage and structured JSON. Expose account IDs for setup; reading history makes no model call. Configuration stays in scoped Models settings/provider accounts, not frontend durable state.
- Update user/architecture/status/register guidance and generated references/inventory, mapping the decisions RPC family. No dependencies, weights, inference engines, training jobs, live provider calls, release-version changes, installed-app changes, or production-profile changes are introduced. Live/calibrated checkpoint acceptance, learned performance predictors, LLMRouter/RouteLLM/vLLM adapters, benchmark ingestion and measured improvements remain separate work.

##### Validation

- Focused transport/service/routing/runtime/migration tests passed against fake endpoints and temporary/in-memory databases. Forked-worker HTTP/RPC integration passed shadow and assist modes, including history, broker calls, audit events, fees/tokens and expected worker selection.
- Explicit message-version and nullable audit-display tests passed. Independent source reviews identified concurrent duplicate assessments, missing decision usage in the model audit, and missing RPC version markers; fixes and targeted regressions address all three.
- `npx turbo run build typecheck lint test --output-logs=errors-only --concurrency=2` passed all 33 tasks after updating the two stable setting-count assertions for 85 definitions. Capability/OS-dependent tests retain explicit skips. Turbo emitted a disk-space cache warning; the gate exited successfully and E: had about 1 GB free afterward. No unrelated artifacts were deleted.
- `npm run format:check`, `git diff --check`, `bash scripts/check-links.sh`, `node scripts/check-documentation-evidence.cjs`, `node scripts/generate-system-reference.cjs --check`, and `node scripts/generate-documentation-inventory.cjs --check` passed. Evidence integrity is not independent verification of upstream decision-model quality.
- `npm run changelog:update` and `npm run changelog:check -- --base HEAD` passed with all feature and generated-reference paths covered before concurrent, unrelated cache/build-maintenance edits appeared. The final repository-wide coverage check then reported `.gitignore` as unrecorded work outside this feature; those edits were left untouched. The 33-task gate above predates that separate maintenance work. Workspace release versions remain 0.8.0.
- No live Kev/Laya/Jev acceptance, paid external call, model download/training, deployment, packaged Electron acceptance, calibration or performance measurement ran. Installed 0.8.0 remains unchanged.

##### Files

- `packages/contracts/src/models/decisions.ts`
- `packages/contracts/src/models/decisions.test.ts`
- `packages/contracts/src/models/index.ts`
- `packages/contracts/src/models/schema.ts`
- `packages/contracts/src/rpc/protocol.ts`
- `packages/platform-service/src/models/decision-provider.ts`
- `packages/platform-service/src/models/decision-provider.test.ts`
- `packages/platform-service/src/models/decision-service.ts`
- `packages/platform-service/src/models/decision-service.test.ts`
- `packages/platform-service/src/models/router.ts`
- `packages/platform-service/src/models/router.test.ts`
- `packages/platform-service/src/models/completion-service.ts`
- `packages/platform-service/src/models/models.integration.test.ts`
- `packages/platform-service/src/agents/agent-tools.ts`
- `packages/platform-service/src/agents/agent-runtime.ts`
- `packages/platform-service/src/agents/agent-runtime.test.ts`
- `packages/platform-service/src/profile/migrations.ts`
- `packages/platform-service/src/profile/migrations.test.ts`
- `packages/platform-service/src/settings/definitions.ts`
- `packages/platform-service/src/settings/registry.test.ts`
- `packages/platform-service/src/tasks/task-service.ts`
- `packages/platform-service/src/service.ts`
- `packages/platform-service/src/service.integration.test.ts`
- `packages/theia-control-room/src/browser/models-widget.tsx`
- `packages/theia-control-room/src/browser/audit-widget.tsx`
- `packages/theia-control-room/src/browser/audit-widget.test.tsx`
- `packages/theia-control-room/src/common/models-view-model.ts`
- `packages/theia-control-room/src/common/models-view-model.test.ts`
- `packages/theia-control-room/src/common/control-room-protocol.ts`
- `packages/theia-control-room/src/node/control-room-service.ts`
- `scripts/generate-system-reference.cjs`
- `scripts/generate-documentation-inventory.cjs`
- `docs/TECHNICAL_ARCHITECTURE.md`
- `docs/DEVELOPMENT_PLAN.md`
- `docs/SKILLS_AGENTS_AND_TOOLS.md`
- `docs/STATUS.md`
- `docs/USER_GUIDE.md`
- `docs/OPEN_DECISIONS.md`
- `docs/API_REFERENCE.md`
- `docs/SETTINGS_REFERENCE.md`
- `docs/reference/rpc-schemas.json`
- `docs/reference/settings-schemas.json`
- `docs/reference/DOCUMENTATION_INVENTORY.md`
- `docs/reference/documentation-inventory.json`
- `docs/changes/2026-10-04-bounded-decision-model-integration.md`

### Documentation

#### Investigate decision models and local routing systems

**Impact:** none

[Permanent work record](docs/changes/2026-10-04-decision-model-routing-research.md).

##### Summary

Research-only investigation of Jev, local typed decision engines, LLMRouter, comparable model-routing systems, and technical evaluation methods for PlayWeld model selection and task-policy advice.

##### Details

- Add a dated primary-source survey of Jev, Kev, Laya, SemIf, Gemma option scoring, fixed-taxonomy classifiers, and generative adapters. Distinguish hosted services from local inference, typed protocol compatibility from probability semantics, vendor/author measurements from repository acceptance, and code licenses from checkpoint/data obligations.
- Add a companion routing-system survey of LLMRouter, RouteLLM, vLLM Semantic Router, routing benchmarks, and cascade methods, with deployment/training dependencies and source-linked examples and technical papers.
- Inspect the current synchronous routing/completion seam, explicit role-derived task types, task-type/global outcome estimator, eligibility enforcement, and limitations of estimated cost constraints. Propose bounded advisory decisions and a separate calibration/quality/cost evaluation rather than replacing policy or permissions with a model.
- Record incompatible hosted-router include-list fallback behavior, inconsistent confidence definitions across implementations and cookbooks, privacy-gate disclosure risks, task-relabeling risks, and missing counterfactual outcome labels.
- Add research pointers to M05/M06 without resolving them, choosing a backend, changing confirmed runtime ownership, modifying application behavior, adding dependencies, or authorizing model-weight training. Refresh the generated changelog only; release version stays unchanged and no migration is required.

##### Validation

- Source-reviewed official API documentation, repository READMEs, selected model cards/licenses, technical writeups, and current PlayWeld source. Upstream benchmark results were not independently reproduced.
- `bash scripts/check-links.sh` passed with all relative links and anchors valid; external source pages were retrieved during research, not exhaustively link-crawled by this script.
- `npm run format:check` and `git diff --check` passed.
- `npm run changelog:update` and `npm run changelog:check -- --base HEAD` passed with the research paths covered by this work record.
- `node scripts/generate-documentation-inventory.cjs --check`, `node scripts/generate-system-reference.cjs --check`, and `node scripts/check-documentation-evidence.cjs` passed; these check generated references and artifact integrity, not the truth of upstream benchmark claims.
- No model downloads, local inference servers, paid model requests, training, GPU measurements, or application changes were performed. Proposed experiments remain unperformed.
- Application build/typecheck/lint/tests were not rerun for this documentation-only investigation.

##### Files

- `docs/research/decision-models-and-task-policy.md`
- `docs/research/local-model-routing-systems.md`
- `docs/OPEN_DECISIONS.md`
- `docs/changes/2026-10-04-decision-model-routing-research.md`

### Maintenance

#### Bound build-cache growth and separate test artifacts

**Impact:** none

[Permanent work record](docs/changes/2026-10-04-build-cache-maintenance.md).

##### Summary

Exclude Electron release packages from build caching, scope bundled-skill inputs to the service build, and provide conservative cache and artifact retention tooling.

##### Details

- Measured 115.075 GiB in the local Turbo cache. Inspected a 4.28 GiB archive manifest: ordinary desktop builds were caching multiple historical Electron installer/unpacked-release directories from `apps/control-room/dist`. Override desktop build outputs to cache only `lib` and `src-gen`; leave ordinary package `dist` outputs and actual installer files intact.
- Replace global skills invalidation with service-build inputs for the exact curated bundled skills. Preserve default source inputs, downstream dependency invalidation, and the service test's existing dependency on its own build; unrelated development skills no longer invalidate every task. A regression test checks the curated names against the authored list and preserves that test prerequisite.
- Add `npm run cache:prune`: dry-run by default, with `--apply` to delete recognized cache archives and their manifest/metadata as groups, oldest-first, targeting 5 GiB and 30-day retention. A one-hour write grace protects recent work; the byte target is soft when recent entries exceed it. Unknown files, linked roots, and legacy evidence/profile directories are not deleted. Locked or concurrently changed cache groups are skipped. Successful root `npm run build` and `npm run build:apps` invoke cache pruning automatically; direct Turbo/workspace commands do not invoke these root npm hooks.
- Add opt-in `--artifacts` retention for timestamped runs under `.artifacts`: preserve the newest three runs per suite and all runs with activity in the last 30 days. Fixed project/profile/engine directories and existing `.turbo` evidence remain untouched. Preview candidates before applying, and stop smoke-test processes before artifact deletion. Example: `npm run cache:prune -- --artifacts`, followed by the same command with `--apply` after reviewing its output. No artifact deletion was performed for this task.
- Move repository-owned smoke, documentation-capture, and engine-acceptance default paths into ignored `.artifacts`; update their related fixture paths and CI browser-evidence upload destination. Existing environment/CLI output overrides remain supported. Historical evidence references and files remain in their original locations; a new engine baseline is needed before extending acceptance fixtures at the new default path.
- Applied a one-time cache reset using `npm run cache:prune -- --apply --max-gib=0`, preserving the one-hour grace: 1,126 old groups removed, reported cache size reduced from 115.08 GiB to 0.12 GiB. Builds will regenerate needed results with the corrected output configuration.
- Add a cross-platform Node regression-test command and execute it in CI. Application APIs, persisted state, installers, and unrelated in-progress work are unchanged by this task. Concurrent release preparation assigned this record to 0.9.0; that version change is outside this maintenance task.
- Correct root build-filter quoting to use shell-portable double quotes: the previous single quotes were passed literally by Windows npm's shell and selected zero packages. Root build hooks now follow actual package/application builds.

##### Validation

- `npm run test:cache-maintenance`: nine regression tests passed, covering dry-run/apply, grouped oldest-first pruning, age retention, recent-write/sidecar protection, legacy/unknown-data preservation, linked-root/content refusal, artifact retention, installer exclusion, and curated service inputs.
- `npx turbo run build --filter=@gamecrafter/control-room --dry`: installed Turbo 2.11.2 resolved desktop outputs to `lib/**` and `src-gen/**`, excluding installer `dist`.
- `node --check` on changed CommonJS scripts: passed.
- Final `npx turbo run build typecheck lint test --output-logs=errors-only`: 33 tasks succeeded, including five cache hits. No claim is made that all checks executed fresh.
- `git diff --check`, `bash scripts/check-links.sh`, and `node scripts/check-documentation-evidence.cjs`: passed. The evidence checker validates inventory/report/file integrity, not live acceptance.
- `npm run build`: seven package/dependency builds executed successfully, followed by the cache-pruning hook. Rebuilt cache measured 0.25 GiB at that check.
- `npm run cache:prune -- --artifacts`: dry-run completed with zero artifact deletion candidates and no deletions.
- Final `npm run format:check` passed. An intermediate run reported a concurrent formatting issue in `packages/theia-control-room/src/browser/models-widget.tsx`; this task did not edit that file. Explicit formatting checks for maintenance JSON/YAML and the new scripts also passed.
- `npm run changelog:update` and `npm run changelog:check -- --base HEAD`: passed.
- Final `npm run cache:prune` dry-run measured 0.50 GiB after complete repository validation, versus 115.08 GiB before maintenance. No additional cache deletion candidates remained under the default policy.
- Live smoke and engine runs have not been repeated; artifact destination changes are source-reviewed only. Existing legacy evidence and profiles remain untouched.

##### Files

- `.github/workflows/ci.yml`
- `.gitignore`
- `.prettierignore`
- `apps/control-room/turbo.json`
- `docs/changes/2026-10-04-build-cache-maintenance.md`
- `package.json`
- `packages/platform-service/turbo.json`
- `scripts/audit-detail-ui-smoke.cjs`
- `scripts/capture-documentation.cjs`
- `scripts/chat-layout-ui-smoke.cjs`
- `scripts/engine-web-acceptance.py`
- `scripts/extended-engine-acceptance.cjs`
- `scripts/live-engine-acceptance.cjs`
- `scripts/live-ui-smoke.cjs`
- `scripts/navigation-layout-ui-smoke.cjs`
- `scripts/project-selection-ui-smoke.cjs`
- `scripts/prune-build-cache.cjs`
- `scripts/prune-build-cache.test.cjs`
- `scripts/settings-models-ui-smoke.cjs`
- `scripts/verify-documentation-electron.cjs`
- `scripts/verify-documentation-engines.cjs`
- `scripts/verify-documentation-examples.cjs`
- `scripts/verify-documentation-native.cjs`
- `scripts/verify-documentation-recovery.cjs`
- `scripts/workspace-overhaul-ui-smoke.cjs`
- `turbo.json`

#### Build and deploy decision assistance locally

**Impact:** none

[Permanent work record](docs/changes/2026-10-04-local-0.9.0-deployment.md).

##### Summary

Prepare and deploy the user-authorized local 0.9.0 Windows upgrade, then commit and push the decision integration, research and documented cache-maintenance changes.

##### Details

- Use a new minor version for the additive decision service and audit contract variant; preserve older release/staging directories and the existing all-users `C:\Program Files\GameCrafter` installation path. No release tag or hosted publication is requested.
- Gracefully close only the installed GUI, checkpoint its ordinary service, and snapshot the profile and available registered Project SQLite databases through the existing database seam before installer writes. Verify retained account/model/pricing/pool/settings/key fingerprints afterward; backups are database snapshots, not full Project-file copies.
- Verify the new native package and run disposable-profile Electron smoke before installation. Extend packaged smoke to open the decision-history tab, validate its version-1 RPC and safe initial shadow/empty-account/empty-model/remote-disabled settings without any inference or paid provider call.
- Correct the pending assessment setup text to show the account base URL ending in `/v1`, not the request endpoint `/v1/systemone`; the adapter owns endpoint joining. No inference weights or runtime are installed or configured by this deployment.
- Include the separately documented, source-reviewed cache-maintenance changes after their regression checks; preserve historical evidence and installer artifacts. Local dirty-build fingerprints remain truthful about the pre-commit source; the eventual commit is not retroactively substituted for package provenance.

##### Validation

- Prepared 0.9.0 and synchronized all nine workspaces/lockfile without third-party dependency changes. The release build/typecheck/lint/test gate passed all 33 tasks (24 cached); both app build checks passed (9 cached tasks). Tracking regressions passed 24 tests; cache-maintenance regression evidence is retained in its separate record. Version, formatting, generated-reference and documentation-inventory checks passed. Ordinary installed service is confirmed as 0.8.0 on its existing profile before upgrade.
- Native Windows packaging and contents verification passed: drivelist/LanceDB/Qdrant x64 binaries, app/service version 0.9.0 and all thirty bundled skills. A new `Windows-Release/0.9.0/` preserves earlier outputs; ignored metadata records the pre-commit base, dirty source fingerprints and installer checksum rather than attributing the build to a later commit.
- Staged Electron smoke passed 29 workflow checks with zero renderer errors, including actual decision-history rendering, version-1 history RPC and shadow/empty account/empty model/remote-disabled defaults: `.artifacts/documentation-electron/1791105956734/`. No inference or paid provider call ran.
- There were no installed GUI windows to force-close. Checkpointed the ordinary 0.8.0 service; profile and all four registered Project databases passed snapshot/integrity and retained-fingerprint checks before installer writes. Ignored backups and baselines are `.artifacts/release-0.9.0/`; encrypted data still requires the retained credential key and full Project files are not copied by this database-only backup.
- The authorized installer exited 0 at the retained `C:\Program Files\GameCrafter` location; Windows uninstall metadata reports `PlayWeld 0.9.0`. Twenty-one selected installed runtime files matched the tested stage byte-for-byte, including decision contracts/transport/service, router, worker integration, migrations, settings, frontend bundles and assessment/audit views: `.artifacts/release-0.9.0/installed-package.json`.
- Launched the ordinary installed 0.9.0 app/service. Four Projects, 21 models/enabled flags, six pools, pricing, account/settings and credential-key fingerprints match the pre-upgrade baseline; profile migration 15 and all four Project audit/history/migration scopes passed: `.artifacts/release-0.9.0/after.json`. No private prompts, credentials or profile data are printed or committed.
- A separate installed-executable smoke also passed all 29 checks with zero renderer errors on a disposable profile: `.artifacts/documentation-electron/1791106424827/`. Its owned GUI/service were closed while the ordinary installed app remains running. Signing status is `NotSigned`; this is a local unsigned testing deployment, not public publication, paid-provider/model-calibration acceptance or an uninstall/rollback drill.
- Final release-version/lockfile, formatting, whitespace, generated-reference/inventory, documentation-evidence and link checks passed; cache-maintenance regressions passed all nine final tests. Corrected the preparation record's relative deployment link so it remains valid when copied into generated release notes. Release-ledger coverage and immutable historical records passed before committing; no ignored installer/profile/runtime evidence is staged.
- Commit/push identity will be confirmed in the final handoff, not retrospectively substituted into pre-commit build provenance. Installer/profile/evidence artifacts remain ignored.

##### Files

- `docs/changes/2026-10-04-local-0.9.0-deployment.md`
- `docs/STATUS.md`
- `docs/RELEASE_GUIDE.md`
- `docs/RELEASE_ACCEPTANCE.md`
- `scripts/live-ui-smoke.cjs`
- `packages/theia-control-room/src/browser/models-widget.tsx`

#### Prepare version 0.9.0

**Impact:** none

[Permanent work record](docs/changes/2026-10-04-release-0.9.0.md).

##### Summary

Prepare version 0.9.0 from 0.8.0, retaining all pending work records in the changelog and detailed release notes.

##### Details

Synchronize first-party workspace and internal dependency versions. The lockfile must be refreshed separately. No tag, publication, or build is performed by version preparation.

##### Validation

Work-record freshness, local file coverage, version progression, and recorded impact checked before preparation. `npm install --package-lock-only --ignore-scripts` synchronized only first-party workspace versions; no third-party dependency changes were observed. `node scripts/check-release-version.cjs v0.9.0` passed. The release build/typecheck/lint/test gate passed all 33 tasks (24 cached), and both app build checks passed (9 cached tasks). Tracking regressions passed 24 tests; cache-maintenance validation is retained in its own record. Formatting and generated-reference/inventory checks passed. Packaging, signing and installed acceptance are recorded separately in [the local deployment record](docs/changes/2026-10-04-local-0.9.0-deployment.md), not implied by version preparation. Lockfile installation reported 56 existing audit findings (5 low, 40 moderate, 11 high); no audit remediation or security certification is claimed.

##### Files

- `packages/archive-extractor/package.json`
- `packages/contracts/package.json`
- `packages/platform-service/package.json`
- `packages/plugin-sdk/package.json`
- `packages/service-client/package.json`
- `packages/theia-control-room/package.json`
- `packages/plugins/sample-hello/package.json`
- `apps/control-room/package.json`
- `apps/control-room-browser/package.json`
- `package-lock.json`

## 0.8.0

### Changed

#### Separate model usage from tool charges in Audit and History

**Impact:** minor

[Permanent work record](docs/changes/2026-10-04-audit-usage-and-costs.md).

##### Summary

Improve Audit visibility and cost evidence instead of treating zero-valued tool charges or absent model pricing as complete model spending.

##### Details

- The original Audit view displayed tool-call costs but omitted model usage stored elsewhere. Unknown model pricing could also be coerced to zero, and four-decimal formatting hid sufficiently small positive amounts. Separate model usage, tool activity and Project events into focused views.
- Add searchable activity cards and a selected-record inspector with readable evidence fields, token/cache counters and bounded structured event context. Keep raw redacted records in optional disclosures and preserve paging, Project scope and redacted export.
- Show known estimates separately from partial, unavailable and unverifiable historical pricing. Genuine priced-zero remains distinct from unavailable pricing. Totals describe the loaded, filtered model page, not all-time spend, invoice reconciliation or independent tool-plus-model totals that double-count the same request.
- Record direct/routed/streamed completion attempts in a shared usage ledger, including unknown failed attempts; preserve nullable cost evidence and honest legacy interpretation. Old routed self-outcomes without confidence metadata are exposed as unverified, not re-priced from today's model settings. Pre-ledger direct completions cannot be reconstructed from absent records. No real provider calls, user credential changes, fabricated historical prices, version changes or local installation update were performed by this source-fix task.
- Preserve OpenAI/Anthropic cache counters and distinguish observed zero from omitted provider counts across complete/streaming responses. Missing or one-sided usage cannot claim known-free billing. Cache portions without rates remain unknown/partial. Numeric-only sanitized model projections avoid the generic redactor mistaking token counts for credentials, while user-controlled labels/request identifiers remain sanitized.
- Reject conflicting Project identifiers before routing/provider I/O so usage cannot be attributed to another Project. Daily exploration also considers the next candidate's known estimate and remaining allowance, falls back to baseline routing for unknown/oversized candidates, and preserves deliberately free candidates. This does not turn estimates into a provider-invoice or absolute-dollar guarantee.
- Monetary task accumulators/budget comparisons track known amounts; unknown pricing cannot establish a real hard-dollar ceiling. Token/turn controls and existing budget policy are not replaced by this UI change. Configure model rates before relying on monetary estimates; subscriptions, hardware costs and provider invoices remain outside these totals.

##### Validation

- New Audit render tests failed against the original view because it had no model usage section or pricing-state presentation. Focused UI tests passed after implementation, including positive sub-cent costs, explicit free calls, unavailable and legacy-unverified pricing, and structured task text.
- Backend regressions were run red before fixes. Focused initial tests passed 45 with six environment-dependent skips; reviewed-edge-case provider/Project/exploration regressions passed 31. Existing profile/Project databases add confidence/ledger storage without fabricating historical prices. Prepared-completion mocks and update/lifecycle fixtures were corrected to use the new router seam and declared current migrations rather than obsolete hard-coded schema counts.
- Full repository validation passed all 33 tasks (22 cached, 11 executed). It initially caught stale migration/update-fixture expectations and a prepared-route mock missing its context/new ledger method; updated only those fixtures and reran successfully. Turbo emitted a cache I/O disk-space warning despite all successful task exits; later browser verification used the generated outputs.
- Full UI suite passed 93 tests in 25 files. The final real-service browser smoke passed seven checks with no renderer errors: tiny priced `$0.0000022`, unknown-price null and explicit-free zero remain distinct; goal content and Audit inspectors fit desktop/narrow windows. Actual-source screenshots/report are `docs/images/audit-detail-2026-10-04/`; ignored evidence is `.turbo/audit-detail-ui/1791096552100/`.
- No paid-provider/invoice, complete historical accounting, or hard-dollar-budget acceptance is claimed. The source-fix stage left the installed 0.7.0 app/profile intact; the subsequent user-authorized [local 0.8.0 deployment](docs/changes/2026-10-04-local-0.8.0-deployment.md) separately records packaged/installed verification and commit/push.

##### Files

- `packages/theia-control-room/src/browser/audit-widget.tsx`
- `packages/theia-control-room/src/browser/audit-widget.test.tsx`
- `packages/theia-control-room/src/common/cost-display.ts`
- `packages/theia-control-room/src/common/cost-display.test.ts`
- `packages/theia-control-room/src/browser/style/workstation.css`
- `scripts/audit-detail-ui-smoke.cjs`
- `docs/changes/2026-10-04-audit-usage-and-costs.md`
- `docs/CONTROL_ROOM_HANDBOOK.md`
- `docs/USER_GUIDE.md`
- `docs/MODEL_ROUTING_GUIDE.md`
- `docs/API_REFERENCE.md`
- `docs/reference/rpc-schemas.json`
- `packages/contracts/src/models/schema.ts`
- `packages/contracts/src/rpc/protocol.ts`
- `packages/contracts/src/tools/schema.ts`
- `packages/platform-service/src/agents/agent-runtime.ts`
- `packages/platform-service/src/agents/agent-tools.ts`
- `packages/platform-service/src/agents/agent-tools.test.ts`
- `packages/platform-service/src/board/board-maintenance-service.ts`
- `packages/platform-service/src/workers/board-maintenance-handlers.ts`
- `packages/platform-service/src/workers/types.ts`
- `packages/platform-service/src/models/completion-service.ts`
- `packages/platform-service/src/models/router.ts`
- `packages/platform-service/src/models/router.test.ts`
- `packages/platform-service/src/models/models.integration.test.ts`
- `packages/platform-service/src/models/completion-service.test.ts`
- `packages/platform-service/src/service.integration.test.ts`
- `packages/platform-service/src/models/providers/anthropic.ts`
- `packages/platform-service/src/models/providers/http-utils.ts`
- `packages/platform-service/src/models/providers/openai-compatible.ts`
- `packages/platform-service/src/models/providers/providers.test.ts`
- `packages/platform-service/src/profile/migrations.ts`
- `packages/platform-service/src/profile/migrations.test.ts`
- `packages/platform-service/src/projects/migrations.ts`
- `packages/platform-service/src/service.ts`
- `packages/platform-service/src/tools/tool-broker.ts`
- `packages/platform-service/src/tools/tool-broker.integration.test.ts`
- `packages/platform-service/src/tools/tool-registry.ts`
- `packages/platform-service/src/tools/tool-store.ts`
- `packages/platform-service/src/mcp/connection-manager.ts`
- `packages/platform-service/src/mcp/connection-manager.sampling.test.ts`
- `packages/platform-service/src/plugins/plugin-host.ts`
- `packages/platform-service/src/plugins/plugin-service.integration.test.ts`
- `docs/images/audit-detail-2026-10-04/formatted-goal-desktop.png`
- `docs/images/audit-detail-2026-10-04/formatted-goal-narrow.png`
- `docs/images/audit-detail-2026-10-04/model-cost-desktop.png`
- `docs/images/audit-detail-2026-10-04/model-cost-narrow.png`
- `docs/images/audit-detail-2026-10-04/tool-history-desktop.png`
- `docs/images/audit-detail-2026-10-04/event-history-desktop.png`
- `docs/images/audit-detail-2026-10-04/capture-report.json`

### Fixed

#### Format agent hierarchy goals and related task text

**Impact:** patch

[Permanent work record](docs/changes/2026-10-04-hierarchy-content-formatting.md).

##### Summary

Replace flat task-goal/result paragraphs with structured, bounded reading panels in the agent hierarchy while keeping untrusted text inert and all task actions available.

##### Details

- A failing render regression reproduced Markdown headings, lists and fences appearing literally inside a single paragraph. Render Markdown tokens from the existing Theia-shared parser as React elements instead of injecting HTML or introducing a new dependency.
- Goals, results, errors and questions preserve headings, nested lists, emphasis, inline/fenced code, tables and paragraph breaks. Structured JSON is indented as escaped code. Raw HTML and automatic media loading are not enabled; executable/file/relative link targets do not become navigable actions.
- Bound long goal/result/question content in named keyboard-accessible scroll regions. Shorten request-select labels to the first heading/line without discarding the stored goal. Keep cancellation, feedback, question answers and artifact paths intact.
- Label task spend as the known recorded portion, preserve tiny positive amounts, and show no charge recorded instead of asserting that a zero-valued accumulator proves free usage. Audit provides separate cost-coverage details; unpriced usage can remain outside the numeric task accumulator.
- The source-fix stage kept version 0.7.0 and did not replace the installed app/profile or commit/push. The later user-authorized [local 0.8.0 deployment](docs/changes/2026-10-04-local-0.8.0-deployment.md) records that separate packaging/install/Git handoff; the screenshots retain their actual source-capture version.

##### Validation

- `npm test -w @gamecrafter/theia-control-room -- src/browser/swarm-widget.test.ts`: new formatting regression failed before the fix at the missing heading assertion.
- Focused formatting/escaping tests passed after implementation, covering headings/lists/code/tables, inert HTML/image/command links and JSON indentation. Source typecheck passed.
- Full UI suite passed 93 tests across 25 files. The new task-heading regression also keeps automatically derived Markdown titles concise while retaining full stored goals. A scoped read-only safety/UI review found one obsolete instruction in Audit; corrected its expansion wording to selection.
- `npx turbo run build typecheck lint test --output-logs=errors-only`: 33 tasks passed (22 cached, 11 newly executed), including browser/Electron builds. Turbo emitted a cache I/O disk-space warning; task exit statuses were all successful and final outputs were used for browser verification.
- `scripts/audit-detail-ui-smoke.cjs` passed seven checks against the real isolated service and rebuilt browser, including Markdown structure, bounded keyboard readers, cost confidence and desktop/narrow layouts, with no renderer errors. Actual-source screenshots/report are in `docs/images/audit-detail-2026-10-04/`; ignored run evidence is `.turbo/audit-detail-ui/1791096552100/`.
- Current screenshot metadata labels the pending 0.7.0-version source build. No installed-desktop, real-provider or invoice verification is claimed; the ordinary 0.7.0 installed application/profile were not replaced or migrated.

##### Files

- `packages/theia-control-room/src/browser/swarm-widget.tsx`
- `packages/theia-control-room/src/browser/swarm-widget.test.ts`
- `packages/theia-control-room/src/browser/markdown-content.tsx`
- `packages/theia-control-room/src/browser/markdown-content.test.tsx`
- `packages/theia-control-room/src/common/cost-display.ts`
- `packages/theia-control-room/src/common/cost-display.test.ts`
- `packages/theia-control-room/src/common/swarm-view-model.ts`
- `packages/theia-control-room/src/browser/style/workstation.css`
- `docs/changes/2026-10-04-hierarchy-content-formatting.md`
- `docs/CONTROL_ROOM_HANDBOOK.md`
- `docs/USER_GUIDE.md`

### Maintenance

#### Deploy hierarchy formatting and cost accounting locally

**Impact:** none

[Permanent work record](docs/changes/2026-10-04-local-0.8.0-deployment.md).

##### Summary

Deploy the user-authorized local 0.8.0 upgrade for formatted hierarchy details and confidence-aware model usage, verifying installation and retained data before the source commit/push.

##### Details

- The user explicitly requested updating the local install, committing and pushing the pending fixes. Prepared and installed 0.8.0 as a new minor version for the additive usage ledger and Audit interface. Earlier artifacts were retained; no tag or GitHub release was created.
- Preserve the existing all-users `C:\Program Files\GameCrafter` installation path. Close only its GUI gracefully and stop its service with checkpointing before the final pre-upgrade snapshot. Do not force-close unsaved editors or kill unrelated processes.
- Snapshot the profile and registered Project SQLite databases through the existing database seam, and compare selected model/pool/settings/account/pricing/key fingerprints after upgrade. Backups are ignored local artifacts, not complete Project-file backups; encrypted data still requires the retained credential key.
- Keep the existing browser screenshots' actual 0.7.0-source capture labels. They verify the pending fixes with deterministic local providers, not the installed 0.7.0 build or paid invoices. Packaging/installed-runtime verification has its own evidence below.
- Existing release directories occupy about 1.36 GB per staged/output version; E: had about 4.08 GB available at preparation. Direct the new Turbo cache to the pre-approved C: temporary directory instead of consuming the release volume. Do not delete earlier builds, profiles or unrelated caches.

##### Validation

- `npm run release:version -- 0.8.0` assigned the pending records and synchronized all nine first-party workspaces. The lockfile-only install changed only workspace versions; `node scripts/check-release-version.cjs v0.8.0` passed. No third-party dependencies were upgraded.
- Fresh version-0.8.0 build/typecheck/lint/test validation passed all 33 tasks with zero cached results (5m12s), using the C: temporary cache. Both app builds passed. The preceding source-fix records also include 93 UI tests and seven real-service browser checks.
- Lockfile installation reported existing audit findings: 56 total (5 low, 40 moderate, 11 high). No audit remediation or security certification is claimed.
- Windows packaging/native verification passed, including drivelist, LanceDB, managed Qdrant, app/service version 0.8.0 and all thirty bundled skills. Created a new `Windows-Release/0.8.0/` without replacing existing staging/output versions; dirty-source provenance and installer SHA-256 are in its ignored metadata.
- Staged Electron smoke passed 28 workflow checks with no renderer errors, including a real structured goal and the separate model-usage overview/redacted export: `.turbo/documentation-electron/1791098323621/`. The test used a disposable profile and no paid provider.
- Closed/checkpointed the ordinary 0.7.0 service without force-killing user editors. Profile and all four available registered Project SQLite databases passed pre-upgrade snapshot/integrity checks; ignored baselines/backups are `.turbo/release-0.8.0/`. An initial inspection-helper query used a nonexistent registry column; corrected its query to the actual `path` column before any backup or installer write.
- The authorized all-users installer exited 0 and Windows uninstall metadata reports PlayWeld 0.8.0 at the retained `C:\Program Files\GameCrafter` path. Thirteen selected installed runtime files matched the tested stage byte-for-byte, including goal/parser/Audit/cost and completion/router code plus frontend bundles: `.turbo/release-0.8.0/installed-package.json`.
- Launched the ordinary installed 0.8.0 app and verified its service. Before/after selected fingerprints matched four registered Projects, twenty-one model IDs/enabled flags and pricing, six pool memberships, and settings/account/credential-key configuration. All four Project audit/migration scopes verified; model usage responses preserve numeric counters and typed cost confidence. Ignored evidence: `.turbo/release-0.8.0/after.json`. No credentials/prompts/private records were printed or staged.
- The actual installer signature is `NotSigned`; this remains an unsigned local testing build, not public/signed, paid-provider/invoice or uninstall/rollback acceptance. Existing browser screenshots retain their actual source capture version and fixture limits. Commit/push identity is verified in the final handoff rather than retrospectively assigned to pre-commit build provenance.
- Final release-ledger coverage/immutability, version checks, API/reference freshness, documentation links, image/report integrity, formatting and whitespace checks passed. Updated record cross-links to remain valid when copied into generated release notes. No installers, profile databases, credentials or ignored runtime evidence are included in the source commit.

##### Files

- `docs/changes/2026-10-04-local-0.8.0-deployment.md`
- `docs/STATUS.md`
- `docs/RELEASE_GUIDE.md`
- `docs/RELEASE_ACCEPTANCE.md`
- `scripts/live-ui-smoke.cjs`

#### Prepare version 0.8.0

**Impact:** none

[Permanent work record](docs/changes/2026-10-04-release-0.8.0.md).

##### Summary

Prepare version 0.8.0 from 0.7.0, retaining all pending work records in the changelog and detailed release notes.

##### Details

Synchronize first-party workspace and internal dependency versions. The lockfile must be refreshed separately. No tag, publication, or build is performed by version preparation.

##### Validation

Work-record freshness, local file coverage, version progression, and recorded impact checked before preparation. Subsequently synchronized the lockfile without third-party upgrades and verified version 0.8.0, all 33 fresh repository quality tasks, Windows packaging and 28 packaged desktop checks. The [local deployment record](docs/changes/2026-10-04-local-0.8.0-deployment.md) retains installed hash/profile/migration verification and the actual unsigned signature status. No public release, paid-provider, uninstall/rollback or signing acceptance is claimed.

##### Files

- `packages/archive-extractor/package.json`
- `packages/contracts/package.json`
- `packages/platform-service/package.json`
- `packages/plugin-sdk/package.json`
- `packages/service-client/package.json`
- `packages/theia-control-room/package.json`
- `packages/plugins/sample-hello/package.json`
- `apps/control-room/package.json`
- `apps/control-room-browser/package.json`
- `package-lock.json`

## 0.7.0

### Added

#### Selectable embedded and managed vector storage

**Impact:** minor

[Permanent work record](docs/changes/2026-10-04-vector-storage-backends.md).

##### Summary

Add embedded LanceDB and SQLite exact vector storage, managed native Qdrant, and explicit existing-local/remote Qdrant configurations behind a backend-neutral storage boundary.

##### Details

- Separate backend IDs from deployment ownership; retain `none` and legacy external Qdrant settings without changing lexical-only defaults.
- Add trusted, versioned adapter registration through service options. Unknown IDs and unsupported deployments fail closed. This is not isolated marketplace-plugin support.
- Replace Qdrant-shaped retrieval filters with typed neutral filters, generalized indexing/counting/cleanup, cached handles, and service shutdown disposal. Destination identity in vector mappings triggers re-embedding unchanged source content when storage changes.
- Add native LanceDB persistence with fixed Float32 Arrow dimensions, Project/version namespaces, filtered cosine search, serialized ID upserts, deletion, and lazy native loading. Pin SDK 0.29.0 with Arrow 18.1.0 to avoid optional inference runtimes added by newer SDK packaging.
- Add lightweight SQLite storage using the existing database seam, transactional upserts and exact filtered cosine scans. It is not sqlite-vec or an ANN index.
- Add managed Qdrant lifecycle and checksum-pinned build preparation for Windows/Linux x64; desktop resources include the native executable and Qdrant license. Existing local and remote Qdrant reuse the REST adapter.
- Managed Qdrant uses a private temporary working/config directory, strips inherited Qdrant overrides, authenticates readiness, and disables unused transports/telemetry. Windows shutdown terminates the process tree before its shell parent can exit; extended-length storage paths handle deep Project directories. Unexpected process exit can restart lazily on the next operation.
- Explicit remote mode requires permission to send embeddings/metadata and HTTPS. Existing-local mode requires a loopback IP. Legacy external mode deliberately retains its old transport policy, with a visible warning. Redirects are refused and API keys remain encrypted credential references.
- Add Knowledge UI selections, custom adapter deployment, consent messaging, and atomic snapshot-safe settings saves through the existing settings import transaction. Re-run indexing when settings change during an active task.
- Recover missing vector points even when source/mapping state is unchanged, retry failed source deletions without discarding their mappings, and keep derived vector directories out of Project Git and clone copies. Authenticated Qdrant requests refuse non-loopback cleartext HTTP even in legacy mode.
- Update architecture, requirements/decision register, evidence note, generated API/settings references, and release guidance. Source documents stay authoritative; no inference runtime or automatic source-of-truth migration is added.
- Old destination data remains retained until explicit cleanup; cached handles remain owned until service shutdown. Controlled deletion of retired backends, plugin-host adapters, live remote acceptance and installed-package recovery remain separate work.

##### Validation

- Native LanceDB/SQLite, Qdrant REST fixture, registry, and fake-provider service integration passed focused checks, including destination switching, no-op reconciliation, point-loss recovery, deletion retry, and settings changes during indexing.
- New Knowledge UI rendering/settings-notification tests: 3 passed. Contract tests: 5 passed. Settings/service integration tests: 8 passed.
- Workspace build/typecheck/lint tasks passed, including desktop/browser development builds (desktop test/typecheck scripts remain configured placeholders). Final service suite: 401 passed, 11 skipped; contract tests: 67 passed; current UI suite: 54 passed; other package tests passed (five tests, one additional skipped). Change-tracking tests: 24 passed.
- Managed Qdrant tests: six passed, including actual native Windows Qdrant 1.19.1 authentication, persistence across restart, Project separation, point search/deletion, and shutdown. The fake-provider Knowledge integration exercised SQLite -> LanceDB -> managed Qdrant -> SQLite switching with no-op reconciliation. The original timeout fixture failure and subsequent Windows deep-path IO failure were reproduced and fixed; no fixture subprocesses remain. After the full suite, a cached-table deletion recovery regression was added; the six-file storage/integration selection passed all 27 tests, including externally removed LanceDB tables and native Qdrant collections.
- Generated RPC/settings freshness, release-version consistency, Markdown links, changed-file work-record coverage, and repository formatting passed.
- Verified Qdrant 1.19.1 Windows release archive SHA-256 and prepared its native executable/license. Installer assembly and Linux execution have not been verified in this task; no release version, commit, or publication was performed.
- Embedding generation uses the in-repository fake provider only; remote endpoint tests are configuration/transport tests, not live hosted-service acceptance.

##### Files

- `.gitignore`
- `apps/control-room/electron-builder.yml`
- `apps/control-room/package.json`
- `apps/control-room/scripts/verify-windows-native.cjs`
- `docs/API_REFERENCE.md`
- `docs/PLATFORM_DESIGN.md`
- `docs/RELEASE_GUIDE.md`
- `docs/SETTINGS_REFERENCE.md`
- `docs/TECHNICAL_ARCHITECTURE.md`
- `docs/USER_GUIDE.md`
- `docs/OPEN_DECISIONS.md`
- `docs/DEVELOPMENT_PLAN.md`
- `docs/STATUS.md`
- `docs/reference/rpc-schemas.json`
- `docs/reference/settings-schemas.json`
- `docs/research/vector-storage-options.md`
- `package-lock.json`
- `packages/contracts/src/knowledge/knowledge.test.ts`
- `packages/contracts/src/knowledge/schema.ts`
- `packages/platform-service/package.json`
- `packages/platform-service/src/index.ts`
- `packages/platform-service/src/knowledge/knowledge-indexer.ts`
- `packages/platform-service/src/knowledge/knowledge-service.ts`
- `packages/platform-service/src/knowledge/knowledge.integration.test.ts`
- `packages/platform-service/src/knowledge/lancedb-vector-store.ts`
- `packages/platform-service/src/knowledge/lancedb-vector-store.test.ts`
- `packages/platform-service/src/knowledge/managed-qdrant.ts`
- `packages/platform-service/src/knowledge/managed-qdrant.test.ts`
- `packages/platform-service/src/knowledge/qdrant-vector-store.integration.test.ts`
- `packages/platform-service/src/knowledge/qdrant-vector-store.test.ts`
- `packages/platform-service/src/knowledge/qdrant-vector-store.ts`
- `packages/platform-service/src/knowledge/retriever.ts`
- `packages/platform-service/src/knowledge/sqlite-vector-store.ts`
- `packages/platform-service/src/knowledge/sqlite-vector-store.test.ts`
- `packages/platform-service/src/knowledge/vector-store.ts`
- `packages/platform-service/src/knowledge/vector-store-registry.ts`
- `packages/platform-service/src/knowledge/vector-store-registry.test.ts`
- `packages/platform-service/src/service.integration.test.ts`
- `packages/platform-service/src/service.ts`
- `packages/platform-service/src/settings/definitions.ts`
- `packages/platform-service/src/settings/registry.test.ts`
- `packages/platform-service/src/projects/workspace.ts`
- `packages/platform-service/src/projects/workspace.test.ts`
- `packages/theia-control-room/src/browser/knowledge-widget.tsx`
- `packages/theia-control-room/src/browser/knowledge-widget.test.ts`
- `scripts/prepare-qdrant.cjs`
- `docs/changes/2026-10-04-vector-storage-backends.md`

### Changed

#### Streamlined navigation, discussion browsing, and Swarm hierarchy

**Impact:** minor

[Permanent work record](docs/changes/2026-10-04-navigation-and-swarm-layout.md).

##### Summary

Refined the Control Room's Project Home, Discussion Board, and Swarm layouts to make destinations, next actions, and delegated agent work easier to identify without reading every task's full details.

##### Details

- Replaced Project Home's flat workspace-tool strip and long onboarding paragraphs with four purpose-based navigation groups. All fifteen existing destinations and command IDs remain available, with concise descriptions. Contextual next steps guide users to create or open a Project without claiming engine readiness. The Projects shortcut scrolls and focuses within the page without changing Theia's workspace URL hash. Removed the Unreal-specific onboarding assumption; retained the external IDE MCP limitation note.
- Added Discussion Board quick views for all, open, question, blocker, and decision threads, explicit filter clearing, result counts, clearer empty-state guidance, compact thread metadata, and contextual next actions. Active filters now survive refreshes. Thread creation and maintenance are disclosure panels; pending synchronization counts remain visible. Existing message, binding-decision, review, archival, deletion, and maintenance operations remain available.
- Added a Project/thread selection payload to the existing Discussion Board command so Swarm's request-thread action opens the exact linked thread, including when switching Projects, rather than merely opening the board's previous selection.
- Replaced Swarm's recursively expanded task articles with a compact, collapsible agent/sub-agent hierarchy and a single selected-task inspector. The inspector retains goal, state, progress, spending, error, results, artifacts, questions, cancellation, and review controls. Selecting a task from a question/review shortcut expands its ancestor path. Each change request remains a separately selectable swarm backed by the existing service task tree; the UI does not invent live-agent instances from task records.
- Separated Swarm agents, Project approvals, integrations, and resource locks into focused views with counts. Added actionable next-step guidance and selected-request task summaries. New requests use a collapsible composer and clear the submitted text/impact preview after successful submission. Project/request changes clear stale task-selection displays.
- Added theme-aware status/selection styling, native keyboard-operable buttons/disclosures, and container-responsive layouts that stack the hierarchy and inspector or thread list and conversation on narrow surfaces. No dependency, persisted schema, RPC storage, or vector-backend changes; no migration is required. This change does not alter the concurrent vector database setup.
- Added focused widget regressions and a repeatable browser smoke script using an isolated profile/service, disposable Project, and synthetic nested `noop.echo` tasks, without model calls or user Project changes. Screenshots and the smoke report are generated under ignored `.turbo/navigation-layout-ui/`.

##### Validation

- Control Room widget tests passed: 54 tests across 15 files, including hierarchy collapse/selection, result/error inspector rendering, preserved navigation commands, Board filter retention, and request-thread selection. Control Room build, typecheck, and lint passed in the repository validation run.
- Browser and Electron development application builds completed with zero build errors. This is build evidence, not a live Electron interaction check or an installer/release.
- `node scripts/navigation-layout-ui-smoke.cjs` passed nine checks against the rebuilt browser app and real isolated platform service, with no renderer errors. Verified grouped navigation, the non-routing Project shortcut, nested-agent selection/collapse, focused section navigation, the exact request-thread link, refresh-retained Board filters, and narrow-window layout. Screenshot/report evidence: `.turbo/navigation-layout-ui/1791082035943/`. Agent execution in this fixture is synthetic; paid reasoning, live engines, decision synchronization, and every approval/integration operation were not validated by this smoke.
- `npx turbo run build typecheck lint test --output-logs=errors-only` completed successfully: 33 tasks successful, 32 cached, with the platform-service test run executing to completion. Cached results and existing environment-dependent test skips remain distinct from new live coverage. An initial run caught a Discussion Board TypeScript narrowing error during implementation; it was fixed before the successful app builds and smoke check.
- `npm run format:check`, `bash scripts/check-links.sh`, `git diff --check`, and `npm run changelog:check -- --base HEAD` passed. Refreshed the generated overview with `npm run changelog:update`.

##### Files

- `packages/theia-control-room/src/browser/project-home-widget.tsx`
- `packages/theia-control-room/src/browser/project-home-widget.test.tsx`
- `packages/theia-control-room/src/browser/discussion-board-widget.tsx`
- `packages/theia-control-room/src/browser/discussion-board-widget.test.ts`
- `packages/theia-control-room/src/browser/discussion-board-view-contribution.ts`
- `packages/theia-control-room/src/browser/swarm-widget.tsx`
- `packages/theia-control-room/src/browser/swarm-widget.test.ts`
- `packages/theia-control-room/src/browser/style/workstation.css`
- `scripts/navigation-layout-ui-smoke.cjs`
- `docs/changes/2026-10-04-navigation-and-swarm-layout.md`

#### Overhaul remaining workspace pages and Theia shell surfaces

**Impact:** minor

[Permanent work record](docs/changes/2026-10-04-workspace-interface-overhaul.md).

##### Summary

Extend the clear navigation and compact layouts from Project Home, Discussion Board, and Swarm across the remaining Control Room pages and shared built-in Theia surfaces, preserving existing operations and safety boundaries.

##### Details

- Extend the established Project Home, Discussion Board, and Swarm layout direction to Assets, Knowledge, Skills, Plugins, Engine, DCC Tools, Connections, Models, Settings, Backups, Audit, Updates, and Chat.
- Add focused section navigation, contextual next-step guidance, visible field labels, compact metadata, useful empty states, and disclosures for advanced configuration. Inactive panes stay mounted so switching sections does not discard draft fields or preview state.
- Add a grouped PlayWeld menu that links all platform destinations and the built-in IDE Settings and Open View commands without removing Theia's existing menus or keyboard shortcuts.
- Apply theme-aware treatment to built-in menu popovers, quick inputs and the command palette, dialogs, Preferences field cards, Explorer tree selection, notifications, and shared form controls. Improve project-creation prompt examples and confirmation details.
- Add Chat conversation search, draft-only conversation starters, and clearer Chat/Agent handoff guidance. Search also filters the compact conversation picker while keeping an unmatched active conversation explicitly available as the current conversation.
- Show Engine/DCC run evidence after an operation and take update checks and downloads to their result panes. Preserve existing RPC operations, permission boundaries, signature verification gates, redaction, and import previews; the vector storage and embedding backend implementation is unchanged.
- Final pre-deployment review also corrected Assets result navigation: library/job previews and successful imports reveal the Preview pane, and submitting generation reveals Jobs without clearing the generation draft. Added dedicated regression coverage for these previously hidden-result paths.
- Add a Settings regression that invokes the real search field handler and verifies that a match in another group becomes visible; preserve the existing automatic matching-group selection rather than changing working search behavior.

##### Validation

The full repository validation passed all 33 tasks, including browser and Electron builds. The Control Room suite passed 78 tests across 22 files. The browser smoke uses the rebuilt app and a real isolated platform service, exercises all 12 remaining non-Chat pages at 1600px and 650px widths, verifies enabled section navigation and accessible names for visible fields, and checks Chat draft interactions and compact conversation search.

- `npx turbo run build typecheck lint test --output-logs=errors-only`: 33 tasks passed; final run had 25 cached tasks and 8 newly executed tasks. Browser and Electron builds passed; cached and environment-dependent test skips are not additional live coverage.
- `npm test -w @gamecrafter/theia-control-room`: 22 test files and 78 tests passed, including section mounting, preserved navigation routes, update/engine/DCC result navigation, Chat draft-only starters, and filtered compact conversation selection.
- Final pre-deployment regression suite passed 82 tests across the same 22 files, adding Assets result-navigation and actual Settings search-handler coverage.
- `node scripts/workspace-overhaul-ui-smoke.cjs`: 34 checks passed with no renderer errors. Final screenshot/report evidence: `.turbo/workspace-overhaul-ui/1791084837281/`.
- `npm run format:check`, `bash scripts/check-links.sh`, `git diff --check`, and `npm run changelog:check -- --base HEAD` passed. Regenerated the overview with `npm run changelog:update`.

The same smoke verifies the grouped menu, keyboard entry into built-in Preferences, the command palette, About dialog and Explorer, cancellation of project creation, Light and High Contrast theme switching, and reduced-motion styling. It reports 34 checks with no renderer errors. Reproduction is `node scripts/workspace-overhaul-ui-smoke.cjs` after building the extension, platform service, and browser app. Its ignored report and screenshots are under `.turbo/workspace-overhaul-ui/`; inspect the latest successful `report.json` rather than older failed iteration captures.

An independent source review identified that mobile Chat search initially filtered only the hidden navigation list; the compact picker and regression coverage were corrected before the final smoke. Earlier runs also caught an Assets navigation target mismatch, an intentionally disabled plugin-details navigation control in the test harness, and reduced-motion CSS precedence; these were resolved before final validation. Browser smoke and app builds must run sequentially on Windows because the running backend holds native build output files open.

Live Electron interaction, third-party extension webviews, external model requests, engine/DCC execution, plugin installation, backup restoration, and update installation were not exercised by this UI smoke. Shared shell styling does not replace built-in IDE workflows or restyle arbitrary third-party webview contents. No claim of comprehensive accessibility certification or live external-tool integration is made.

##### Files

- `packages/theia-control-room/src/browser/assets-widget.tsx`
- `packages/theia-control-room/src/browser/assets-widget.test.tsx`
- `packages/theia-control-room/src/browser/audit-widget.tsx`
- `packages/theia-control-room/src/browser/backups-widget.tsx`
- `packages/theia-control-room/src/browser/brand-contribution.ts`
- `packages/theia-control-room/src/browser/chat-widget.tsx`
- `packages/theia-control-room/src/browser/chat-widget.test.ts`
- `packages/theia-control-room/src/browser/connections-widget.tsx`
- `packages/theia-control-room/src/browser/connections-widget.test.tsx`
- `packages/theia-control-room/src/browser/control-room-frontend-module.ts`
- `packages/theia-control-room/src/browser/create-project-command.ts`
- `packages/theia-control-room/src/browser/dcc-widget.tsx`
- `packages/theia-control-room/src/browser/dcc-widget.test.tsx`
- `packages/theia-control-room/src/browser/engine-widget.tsx`
- `packages/theia-control-room/src/browser/engine-widget.test.tsx`
- `packages/theia-control-room/src/browser/knowledge-widget.tsx`
- `packages/theia-control-room/src/browser/knowledge-widget.test.ts`
- `packages/theia-control-room/src/browser/models-widget.tsx`
- `packages/theia-control-room/src/browser/operations-pages-layout.test.tsx`
- `packages/theia-control-room/src/browser/plugins-catalog-widget.tsx`
- `packages/theia-control-room/src/browser/plugins-catalog-widget.test.tsx`
- `packages/theia-control-room/src/browser/project-home-widget.test.tsx`
- `packages/theia-control-room/src/browser/settings-widget.tsx`
- `packages/theia-control-room/src/browser/skills-widget.tsx`
- `packages/theia-control-room/src/browser/skills-widget.test.tsx`
- `packages/theia-control-room/src/browser/style/workstation.css`
- `packages/theia-control-room/src/browser/theme-contribution.ts`
- `packages/theia-control-room/src/browser/updates-widget.tsx`
- `packages/theia-control-room/src/browser/workspace-menu-contribution.ts`
- `scripts/workspace-overhaul-ui-smoke.cjs`
- `docs/changes/2026-10-04-workspace-interface-overhaul.md`

### Documentation

#### Interface Documentation and Screenshots

**Impact:** none

[Permanent work record](docs/changes/2026-10-04-interface-docs-and-images.md).

##### Summary

Updated the user/developer/operations guidance and screenshot references for the grouped PlayWeld menu, purpose-grouped Project Home, sectioned pages and expandable controls. Refreshed the overview and complete workflow screenshots from the built 0.6.0 development browser with an isolated service and deterministic local fixtures.

##### Details

- Documented the menu groups, Project Home card groups, page-specific project/section selection, disclosures, Discussion Board quick views, Swarm sections, and the current Connections, Knowledge, Assets, Plugins and Backups layouts.
- Documented Chat conversation search, starter-as-draft behavior, and the stacked narrow-window layout. The mobile-width capture is browser UI evidence only; it is not native mobile or touch acceptance.
- Repaired the capture runner for current rendered controls: explicit visible section selection, exact tab labels (distinguishing `Install` from `Installed`), current disclosure handling, per-view Project selection, current composer/connection forms, and new Chat search/starter captures.
- Captured the overview into `docs/images/lantern-workshop/` and all nine scenarios into `docs/images/lantern-workflows-2026-10-04/`. Their reports record platform/browser 0.6.0, the deterministic local Chat/agent or service fixtures, source identity, checks, and empty renderer-error lists. These captures do not establish evidence for the later 0.7.0 package, paid model behavior, or live engine/editor/installer acceptance.
- Several attempted overwrites of the legacy `docs/images/lantern-workflows/` directory encountered Windows file-write locks. Restored only those task-owned PNG changes to their original historical state and removed the task's two unused duplicate Chat PNGs from that legacy folder. The complete dated gallery is canonical; the legacy manifest is marked historical/superseded and links to that complete report.

##### Validation

- `node scripts/capture-documentation.cjs --scenario overview`: passed; 21 PNGs captured to `docs/images/lantern-workshop/`, renderer error list empty.
- `node scripts/capture-documentation.cjs --scenario all`: passed; all nine scenarios and 45 PNGs captured to `docs/images/lantern-workflows-2026-10-04/`, renderer error list empty. The report confirms local deterministic fixtures and states that no live model, paid provider or engine execution was used.
- Inspected the current Project Home, Chat search/mobile starter, agent integration, MCP logs/configuration, asset review, backup restore and plugin isolation images. The restore screenshot displays a disposable host-local path; the workflow gallery warns that paths should be inspected before reuse outside the repository.
- `npx prettier --check` on all changed Markdown, JSON and capture scripts: passed.
- `bash scripts/check-links.sh`: passed (`All links OK`).
- `node --check` on all six modified capture/scenario modules: passed.
- `node scripts/check-documentation-evidence.cjs`: the initial run was blocked at the old Home-navigation assertion (`labels.length > 0`, line 51). After the parent updated its checker/inventory for grouped navigation and the current 77 settings, the run passed: 186 RPC methods, 28 notifications, 17 setting groups/77 settings, 24 service subsystems, 16 Control Room surfaces, eight capture reports, 137 referenced PNGs, and all nine combined scenarios. It validates inventory/report/file integrity only, not screenshot content or live acceptance.
- No application rebuild, installer run, paid-provider request, live engine/editor acceptance, changelog generation, Git stage/commit, or push was performed by this work.

##### Files

- `README.md`
- `docs/README.md`
- `docs/USER_GUIDE.md`
- `docs/CONTROL_ROOM_HANDBOOK.md`
- `docs/WORKED_TUTORIAL.md`
- `docs/DOCUMENTATION_COVERAGE.md`
- `docs/DEVELOPER_GUIDE.md`
- `docs/OPERATIONS_GUIDE.md`
- `docs/INTEGRATION_GUIDE.md`
- `docs/WORKFLOW_SCREENSHOTS.md`
- `scripts/capture-documentation.cjs`
- `scripts/documentation/workflow-scenarios.cjs`
- `scripts/documentation/connection-scenario.cjs`
- `scripts/documentation/asset-scenario.cjs`
- `scripts/documentation/backup-scenario.cjs`
- `scripts/documentation/plugin-scenario.cjs`
- `docs/images/lantern-workshop/01-home.png`
- `docs/images/lantern-workshop/02-create-project.png`
- `docs/images/lantern-workshop/03-project.png`
- `docs/images/lantern-workshop/04-models.png`
- `docs/images/lantern-workshop/05-chat.png`
- `docs/images/lantern-workshop/05-chat-search.png`
- `docs/images/lantern-workshop/05-chat-mobile-starter.png`
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
- `docs/images/lantern-workflows/capture-report.json`
- `docs/images/lantern-workflows-2026-10-04/01-home.png`
- `docs/images/lantern-workflows-2026-10-04/02-create-project.png`
- `docs/images/lantern-workflows-2026-10-04/03-project.png`
- `docs/images/lantern-workflows-2026-10-04/04-models.png`
- `docs/images/lantern-workflows-2026-10-04/05-chat.png`
- `docs/images/lantern-workflows-2026-10-04/05-chat-search.png`
- `docs/images/lantern-workflows-2026-10-04/05-chat-mobile-starter.png`
- `docs/images/lantern-workflows-2026-10-04/06-discussion.png`
- `docs/images/lantern-workflows-2026-10-04/07-knowledge.png`
- `docs/images/lantern-workflows-2026-10-04/08-settings-override.png`
- `docs/images/lantern-workflows-2026-10-04/08-settings.png`
- `docs/images/lantern-workflows-2026-10-04/09-skills.png`
- `docs/images/lantern-workflows-2026-10-04/10-swarm.png`
- `docs/images/lantern-workflows-2026-10-04/11-connections.png`
- `docs/images/lantern-workflows-2026-10-04/12-engine.png`
- `docs/images/lantern-workflows-2026-10-04/13-dcc.png`
- `docs/images/lantern-workflows-2026-10-04/14-assets.png`
- `docs/images/lantern-workflows-2026-10-04/15-plugins.png`
- `docs/images/lantern-workflows-2026-10-04/16-backups.png`
- `docs/images/lantern-workflows-2026-10-04/17-updates.png`
- `docs/images/lantern-workflows-2026-10-04/18-audit.png`
- `docs/images/lantern-workflows-2026-10-04/agent-approval.png`
- `docs/images/lantern-workflows-2026-10-04/agent-integrated.png`
- `docs/images/lantern-workflows-2026-10-04/agent-integration-ready.png`
- `docs/images/lantern-workflows-2026-10-04/agent-question.png`
- `docs/images/lantern-workflows-2026-10-04/asset-awaiting-review.png`
- `docs/images/lantern-workflows-2026-10-04/asset-configuration.png`
- `docs/images/lantern-workflows-2026-10-04/asset-imported.png`
- `docs/images/lantern-workflows-2026-10-04/asset-import-rejected.png`
- `docs/images/lantern-workflows-2026-10-04/backup-configuration.png`
- `docs/images/lantern-workflows-2026-10-04/backup-nonempty-target.png`
- `docs/images/lantern-workflows-2026-10-04/backup-restored.png`
- `docs/images/lantern-workflows-2026-10-04/backup-verified.png`
- `docs/images/lantern-workflows-2026-10-04/backup-wrong-secret.png`
- `docs/images/lantern-workflows-2026-10-04/decision-before-binding.png`
- `docs/images/lantern-workflows-2026-10-04/decision-synchronized.png`
- `docs/images/lantern-workflows-2026-10-04/knowledge-changed-document.png`
- `docs/images/lantern-workflows-2026-10-04/mcp-configured.png`
- `docs/images/lantern-workflows-2026-10-04/mcp-connected.png`
- `docs/images/lantern-workflows-2026-10-04/plugin-capability-review.png`
- `docs/images/lantern-workflows-2026-10-04/plugin-installed.png`
- `docs/images/lantern-workflows-2026-10-04/plugin-isolation-unavailable.png`
- `docs/images/lantern-workflows-2026-10-04/settings-import-failure.png`
- `docs/images/lantern-workflows-2026-10-04/settings-import-preview.png`
- `docs/images/lantern-workflows-2026-10-04/settings-import-result.png`
- `docs/images/lantern-workflows-2026-10-04/capture-report.json`
- `docs/changes/2026-10-04-interface-docs-and-images.md`

### Maintenance

#### Build and deploy PlayWeld 0.6.0 locally

**Impact:** none

[Permanent work record](docs/changes/2026-10-03-local-0.6.0-deployment.md).

##### Summary

Build, stage and install PlayWeld 0.6.0 over the existing local 0.5.0 installation, then verify the running desktop/service and preserved configuration. This post-commit evidence does not rewrite the committed release records or require rebuilding the completed installer.

##### Details

- User authorized committing, pushing and deploying locally. Release source committed and pushed to origin/main as `c325c8972c7db827102770616459eaa4d2d7da67`. No Git tag or GitHub release was created or published; the staging tool's tag field is the conventional version name.
- Built the Windows x64 NSIS installer in `apps/control-room/dist/0.6.0/` and staged its complete app, isolated launcher, checksum and provenance to `Windows-Release/0.6.0/`. Existing build outputs were preserved. The unrelated untracked Kilo profiles remain excluded and their hashes match the pre-release snapshot; no persistent ignore configuration changed.
- Stopped the old installed service through authenticated checkpointing and retained its SQLite profile database in the ignored local `.turbo/release-0.6.0/profile-backup/profile.sqlite`. This database backup uses the existing profile's retained credential key and is not a standalone full-profile/Project backup.
- Ran the staged installer elevated through Windows UAC, silently in the existing all-users scope and `C:\Program Files\GameCrafter` directory. Installer exited zero. Windows uninstall registration, installed application and bundled service all report 0.6.0. Existing compatibility IDs, paths, provider credentials and durable task budgets were preserved.
- Started the installed executable. Desktop title is `Project Home - vealoria - PlayWeld`; its authenticated service reports version 0.6.0 against the normal roaming profile. The selected Project was restored. No user task retry, question answer, lock override or model/pool rebuild was performed by deployment verification.
- Created this follow-up pending evidence record and refreshed the generated changelog/release notes through the existing tracking tool. No product code, dependency, data schema or released work record changed in this evidence task.

##### Validation

- Release-version quality gate passed all 33 tasks, 381 service tests with 12 capability-dependent skips, 24 tracking tests, native package verification, source/package formatting, generated-reference freshness and documentation links. See the immutable source preparation record for scope and skips.
- `npm run package:win -w @gamecrafter/control-room` passed. Verifier confirms Windows PE native addon, matching app/service version 0.6.0, thirty bundled guides/references and license/notice resources. Installer size: 204497657 bytes. SHA-256: `6ffd2f4e7c093120ee58c9b096d15d15dc214c26d227369363081ae438c6ef3c`; matches staged provenance naming the release source commit. Authenticode status: NotSigned.
- Packaged desktop smoke passed all 26 workflow checks with zero renderer errors against its own bundled service and isolated profile. Report: `.turbo/release-0.6.0-packaged-electron/1791075511981/smoke/report.json`. The owned smoke service stopped through authenticated RPC before the owned desktop process tree was closed; its persisted shutdown log confirms completion.
- Local upgrade exited zero. Installed agent-runtime, model-context, agent-tools and logger module hashes match the staged build. Read-only before/after snapshots prove identical four Project IDs, 21 model IDs/enabled states and six pool IDs/memberships. Live installed service PID 1932 reports 0.6.0; desktop PID 63440 resolves to the protected installed executable with the restored Vealoria window title. PIDs are point-in-time evidence.
- Normal-profile `logs/service.jsonl` contains the persisted 0.6.0 `service_started` record. Two initial connection attempts occurred before service startup; the subsequent authenticated check succeeded. Artifacts: `.turbo/release-0.6.0/before.json`, `after.json`, `quality.log`, `package.log`, `packaged-smoke.log` and the isolated smoke directory (all ignored local evidence).
- This verifies this machine's 0.5.0-to-0.6.0 upgrade and installed startup/configuration preservation. Uninstall, rollback, signing, Linux packages, paid-provider acceptance and other installation paths remain unverified. Existing user tasks were not automatically declared fixed/completed.

##### Files

- `docs/changes/2026-10-03-local-0.6.0-deployment.md`

#### Prepare version 0.7.0

**Impact:** none

[Permanent work record](docs/changes/2026-10-03-release-0.7.0.md).

##### Summary

Prepare version 0.7.0 from 0.6.0, retaining all pending work records in the changelog and detailed release notes.

##### Details

Synchronize first-party workspace and internal dependency versions. The lockfile must be refreshed separately. No tag, publication, or build is performed by version preparation.

##### Validation

Work-record freshness, local file coverage, version progression, and recorded impact checked before preparation. Dependency installation, refreshed lockfile verification, quality checks, packaging, signing, and live acceptance are not yet verified by this preparation record; retain their actual evidence in a follow-up work record.

##### Files

- `packages/archive-extractor/package.json`
- `packages/contracts/package.json`
- `packages/platform-service/package.json`
- `packages/plugin-sdk/package.json`
- `packages/service-client/package.json`
- `packages/theia-control-room/package.json`
- `packages/plugins/sample-hello/package.json`
- `apps/control-room/package.json`
- `apps/control-room-browser/package.json`
- `package-lock.json`

#### Align Kilo workspace tooling with PlayWeld development

**Impact:** none

[Permanent work record](docs/changes/2026-10-04-kilo-workspace-tooling.md).

##### Summary

Add a shareable Kilo workspace baseline, project-specific agent adapters, and scoped review commands without changing application code or active Agent Manager assignments.

##### Details

- Add root `kilo.json` with disabled automatic session sharing, approval-oriented shell defaults, explicit research-tool permissions, and pinned Context7. Optional Exa and Firecrawl are disabled for fresh checkouts until locally enabled with credentials supplied through the inherited process environment. No model/provider overrides or speculative plugins are added to the shared baseline.
- Pin existing machine-local MCP launchers to `@upstash/context7-mcp@4.1.1` (published 2026-09-14), `exa-mcp-server@3.4.1` (2026-08-18), and `firecrawl-mcp@3.25.5` (2026-09-25); remove the unresolved Context7 token placeholder. Keep existing local Exa/Firecrawl enablement and credentials untouched to avoid disrupting parallel sessions. Local credentials were exposed during inspection and require rotation and migration; their values are not recorded here. Ignored local settings remain machine-specific and are not shipped.
- Pin the existing ignored `opencode-models-discovery` plugin to `1.6.1` (2026-09-24), rather than implicitly selecting latest; do not install it as a shared dependency. Its documentation targets OpenCode, not Kilo; compatibility and behavior remain unverified. Built-in indexing/chat plugins and global model selections are not changed.
- Move the three existing Kilo agent names from the supported plural directory to canonical `.kilo/agent/`, removing duplicated discovery paths. Replace unrelated actor-system and blanket in-memory prohibitions with actual repository constraints. Make correctness and evidence reviewers edit-denied with approval-required shell execution; shell access is not a security sandbox. Scope the documentation writer to documentation paths.
- Add Kilo-native `design-reviewer`, `research-verifier`, `theia-implementer`, and `security-reviewer` adapters. Reuse shared procedures and existing skills rather than copying skills. Reviewer adapters deny unlisted tools and write-capable delegation; implementation inherits the session's model and permissions.
- Add `/playweld-review`, `/playweld-evidence`, `/playweld-design-check`, and `/playweld-security` as read-only review subtasks with bounded default scopes. Correct the shared implementation profile from obsolete Yarn commands to npm workspaces and add concurrent-work/handoff guidance.
- Extend repository rules with Kilo configuration ownership, skill discovery, permission precedence, prompt-injection boundaries, secret handling, evidence distinctions, and parallel worktree coordination. Ignore generated Kilo worktrees and local caches/package-manager metadata; preserve Agent Manager recovery state and active application edits.
- Kilo 7.8.3 runtime checking rejects environment references in project config even though schema validation accepts the syntax. Remove those references from the shared baseline; use inherited process environment or global config references instead. The existing global Unity entry has a legacy command shape and is absent from the MCP connection list; global settings and engine integrations are not changed or certified.
- Sources checked: [Kilo CLI reference](https://kilo.ai/docs/code-with-ai/platforms/cli-reference), [MCP configuration](https://kilo.ai/docs/automate/mcp/using-in-cli), [plugins](https://kilo.ai/docs/automate/extending/plugins), and npm metadata for the exact pinned versions. This is authoring-workspace maintenance, not a PlayWeld application feature or engine validation.

##### Validation

- Initial bundled Kilo 7.8.3 `config check` passed before the shared baseline was added. An intermediate check rejected project environment references; the configuration was corrected rather than claiming schema acceptance proved runtime compatibility.
- Runtime discovery using filtered `debug config --pure` confirmed all seven agent profiles, four command targets, disabled sharing, and the pinned MCP launch commands. `debug agent code-reviewer --pure` confirmed editing, patching, and delegation tools are unavailable. `debug skill --pure` confirmed existing project skills are discovered without duplication.
- Post-change bundled Kilo 7.8.3 `config check` reports no warnings. `mcp list --pure` connects all three exact pinned servers without loading external plugins. These connection handshakes do not verify every server tool or plugin behavior.
- `debug agent --pure` loads all seven profiles; all five read-only reviewers expose neither write, patch, nor task tools. The documentation writer and implementation agent retain scoped write capability. Filtered runtime discovery confirms the four commands target existing profiles and automatic sharing is disabled.
- Targeted Prettier formatting and freshness checks passed for shared Kilo configuration, agents, and commands; `bash scripts/check-links.sh` reports all links OK and `git diff --check` passed. `npm run changelog:update` completed. `npm run changelog:check -- --base HEAD` is blocked by other ongoing work: its first uncovered path is `apps/control-room/electron-builder.yml`, which this task did not modify. No unrelated records were manufactured to bypass that check.
- Application tests, real engine/DCC integrations, and model-discovery behavior are not verified by this configuration work. Existing local credentials need owner rotation; no global configuration or credential values are modified. Automatic shell exceptions are limited to exact Git read commands rather than wildcard Git arguments; approval and repository-script execution remain separate trust boundaries.

##### Files

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

#### Prepare and deploy the interface refresh locally

**Impact:** none

[Permanent work record](docs/changes/2026-10-04-local-0.7.0-deployment.md).

##### Summary

Prepare, stage and install PlayWeld 0.7.0 locally with the interface/documentation refresh, verifying the bundled desktop, installed runtime and retained profile configuration before the authorized source commit and push.

##### Details

- The user authorized updating the local installation, refreshing relevant documentation/images, and committing/pushing the changes. Upgraded the existing all-users 0.6.0 installation in `C:\Program Files\GameCrafter` to 0.7.0 for the compatible interface and vector-storage changes. Existing installers/staging destinations and the normal profile were preserved. No Git tag or GitHub release publication was performed.
- Update the reusable desktop smoke to navigate grouped Home buttons, Engine/DCC installation sections and disclosures, Settings import/export, and skill cards. Extend the Electron runner to accept a selected packaged executable with isolated profile/configuration/user-data directories, verify its own bundled service version, and stop only owned test processes.
- Wait for the isolated service lock to disappear after a packaged `service/stop` acknowledgment before terminating the owned desktop tree. The RPC acknowledgment schedules checkpointed shutdown; it is not itself evidence that shutdown is finished. A bounded timeout fails the run and still closes the owned test processes.
- Extend staging provenance with an explicit dirty-working-tree flag and hashes for changed nonignored source files. The authorized build/install-before-commit sequence must not misattribute the newly built runtime to the older base commit; later evidence edits may legitimately differ from the build-time documentation snapshot.
- Refresh the living status and release guide to distinguish historical 0.1.1/0.5.0 evidence from later verified installations. Preserve the historical acceptance record and append links to newer version-specific evidence instead of rewriting its original results.
- Regenerate the documentation surface inventory from current contracts/settings, including the previously omitted vector-store deployment and remote-access controls. Preserve generated API/settings reference freshness and honest capture-version labels.
- Correct documentation-integrity checks to read multiline grouped Home destinations and select the newest complete all-scenario report instead of assuming a single mutable gallery path. Continue checking all retained reports and referenced PNG headers, dimensions and scenario names; this is file/report integrity, not visual or provider certification.
- Before installation, use the existing SQLite seam to snapshot the normal profile database and retain a sanitized comparison of Project IDs, model IDs/enabled flags, pool memberships and settings/account/key fingerprints in ignored local artifacts. The database backup requires the retained credentials key and is not a complete profile or Project-file backup.
- Documentation and real UI screenshot refresh has its own permanent record. Generated installers, profile snapshots, runtime logs and checksums remain ignored local artifacts; they will not be included in the source commit.
- Add an opt-in, new-directory-only publication of eight actual shell/compact-Chat screenshots from the rebuilt browser smoke, with explicit version, fixture limits and capture-script provenance. These complement the main workflow gallery and are not screenshots of the normal private user profile or evidence of installed Electron interactions.

##### Validation

- The installed 0.6.0 desktop and its old service PID were not running at pre-upgrade inspection. The normal profile snapshot contains four Projects, 21 models and six pools. Before-state and database backup are under `.turbo/release-0.7.0/`.
- Snapshot verification passed SQLite integrity checking and equality with the sanitized baseline. The local comparison helper normalizes SQLite row serialization so null-prototype rows do not cause a false configuration-difference result.
- Updated development Electron smoke passed 26 live workflow checks with no renderer errors: `.turbo/documentation-electron/1791086200487/smoke/report.json`. The runner used an isolated source service for this development check; this is not yet packaged/installed verification.
- `npm run release:version -- 0.7.0` prepared the new release after ledger/coverage corrections; nine first-party workspace manifests and dependency references were synchronized. `npm install --package-lock-only --ignore-scripts` changed only those workspace versions. `node scripts/check-release-version.cjs v0.7.0` passed. No tag or public release was created.
- The lockfile-only install's audit reported 56 findings (5 low, 40 moderate, 11 high). These were not assessed or remediated in this task; no third-party dependency upgrades or audit-fix commands were run. Passing functional checks is not a security certification.
- Full version-0.7.0 quality validation passed all 33 tasks with zero cached results (`npx turbo run build typecheck lint test --output-logs=errors-only`, 5m18s). Browser and Electron builds were included.
- The fresh 0.7.0 browser smoke passed 34 checks with no renderer errors and published eight reviewed shell/compact-Chat images in `docs/images/workspace-shell-2026-10-04/`. Reproduction used `GAMECRAFTER_OVERHAUL_CAPTURE_DIR` with `scripts/workspace-overhaul-ui-smoke.cjs`; ignored detailed artifacts are `.turbo/workspace-overhaul-ui/1791090147400/`. This is real-service browser evidence, not installed desktop or external-tool acceptance.
- `npm run package:win -w @gamecrafter/control-room` completed production packaging and verified Windows drivelist, LanceDB and managed Qdrant x64 native dependencies, matching application/service 0.7.0 versions, licenses and all 30 bundled skills. `node scripts/stage-windows-release.cjs` created the new `Windows-Release/0.7.0/` destination and retained existing releases.
- Packaged Electron smoke passed 27 checks with no renderer errors using the staged executable and its own bundled 0.7.0 service: `.turbo/documentation-electron/1791090543755/`. This includes selecting a real generated fixture image and decoding its preview in the visible Preview pane. The first harness run put the fixture outside the canonical `game/assets` library; corrected the test path and reran successfully without changing or rebuilding the application artifact.
- `Get-AuthenticodeSignature` reported `NotSigned` for the actual 0.7.0 installer, consistent with packaging's skipped-signing output. This remains an unsigned local test build, not a signed/public release.
- The authorized elevated all-users NSIS installation completed with exit code 0. Windows uninstall metadata identifies PlayWeld 0.7.0 at the retained `C:\Program Files\GameCrafter` executable location. Eight selected installed runtime files, including the executable, service, compiled menu/Assets code and frontend JS/CSS bundles, matched the stage's SHA-256 values. The installed asset-preview navigation fix is present in compiled code. Ignored evidence: `.turbo/release-0.7.0/installed-package.json`.
- Launched the ordinary installed app with inherited `ELECTRON_RUN_AS_NODE` cleared. The app listened on loopback port 3020 and its normal-profile service reported version 0.7.0. Before/after comparisons matched four Project IDs, 21 model IDs/enabled flags, six pool memberships, and settings/account/credential-key fingerprints. No credential values were printed or committed. Ignored evidence: `.turbo/release-0.7.0/after.json`; the updated user app was left open.
- Installation and selected configuration preservation are verified. This is not a signed/public release, a complete uninstall/rollback test, live paid-provider acceptance, live engine/DCC execution, or comprehensive accessibility certification. Documentation/model fixtures and screenshots remain separate from the private installed profile.
- Final `npm run changelog:check -- --base HEAD --release`, documentation links, formatting, generated API/settings references, inventory freshness, release-version consistency and `git diff --check` passed. Documentation integrity checks covered 186 RPC methods, 77 settings, 16 Control Room surfaces, nine capture reports and 145 referenced PNGs, including the newest full nine-scenario report; this does not certify screenshot content or external acceptance.
- The authorized source commit/push follows these verified outcomes. Commit identity and push outcome are recorded in the final handoff rather than retroactively claimed as the pre-commit build's provenance; no signing certificate, tag, or public release is implied.

##### Files

- `scripts/live-ui-smoke.cjs`
- `scripts/verify-documentation-electron.cjs`
- `scripts/stage-windows-release.cjs`
- `scripts/workspace-overhaul-ui-smoke.cjs`
- `scripts/check-documentation-evidence.cjs`
- `docs/STATUS.md`
- `docs/RELEASE_GUIDE.md`
- `docs/RELEASE_ACCEPTANCE.md`
- `docs/CONTROL_ROOM_HANDBOOK.md`
- `docs/reference/documentation-inventory.json`
- `docs/reference/DOCUMENTATION_INVENTORY.md`
- `docs/images/workspace-shell-2026-10-04/workspace-menu.png`
- `docs/images/workspace-shell-2026-10-04/ide-settings-desktop.png`
- `docs/images/workspace-shell-2026-10-04/command-palette.png`
- `docs/images/workspace-shell-2026-10-04/about-dialog.png`
- `docs/images/workspace-shell-2026-10-04/explorer-tree.png`
- `docs/images/workspace-shell-2026-10-04/models-light.png`
- `docs/images/workspace-shell-2026-10-04/models-high-contrast.png`
- `docs/images/workspace-shell-2026-10-04/chat-narrow.png`
- `docs/images/workspace-shell-2026-10-04/capture-report.json`
- `docs/changes/2026-10-04-local-0.7.0-deployment.md`

## 0.6.0

### Changed

#### Use selected-model capacity for agent context and output

**Impact:** minor

[Permanent work record](docs/changes/2026-10-03-model-aware-agent-capacity.md).

##### Summary

Replace automatic fixed agent context/output token limits and Swarm's implicit cumulative token budget with selected-model capacity and explicit user controls.

##### Details

- User-confirmed requirement: derive model capacity settings from the selected model rather than arbitrary platform token limits. Record M10 separately from the unresolved wider metadata/spending policies, map it to WP8, and retain source-versus-installed evidence boundaries.
- Add task-bound internal model preparation. Select before checking context; reuse the same route/model metadata for compaction and completion, including resumptions. Remove legacy checkpoint output allowances and the runtime's fixed 4096-to-32768 output retry ladder. Truncated responses fail explicitly without executing partial tool calls.
- Estimate messages and tool schemas together for both compaction and final validation. Apply shared context minus requested output, independently reported input capacity, and optional explicit lower ceilings. Bound compaction fragments to this allowance, merge successive summaries, preserve pinned instructions and assistant/tool groups, allow summaries to be compacted again, and account for every compaction call against explicit budgets. Character-based estimates remain approximate; actual provider tokenization is authoritative.
- Add optional maxInputTokens to model contracts and manual metadata updates without a schema-version/storage migration. Read OpenRouter context_length/top_provider.max_completion_tokens and Anthropic max_input_tokens/max_tokens. Keep absent metadata unknown, preserve previously discovered metadata on ID-only refresh, and retain manual overrides. Provider field definitions checked 2026-10-03 against [OpenRouter Models](https://openrouter.ai/docs/api/api-reference/models/list-all-models-and-their-properties) and [Anthropic Models](https://platform.claude.com/docs/en/api/http/models).
- Unknown OpenAI-compatible capacity stays provider-managed with omitted output allowance and no artificial local context ceiling. Anthropic's mandatory output parameter fails with actionable metadata guidance if neither metadata nor an explicit request supplies it; remove the arbitrary 1024 fallback. No guessed model-name capacity table or paid discovery/completion is introduced.
- Models displays reported shared/input and output capacities, metadata provenance, and unknown/provider-managed labels. Swarm starts with a blank optional cumulative token budget. Coordinators cannot invent child token ceilings; delegation inherits an explicit parent ceiling while preserving other budget controls.
- Retain coordination.maxTranscriptTokens as a compatible settings key; default zero means automatic and a positive saved value explicitly lowers the allowance. New snapshots use contextTokenCeiling; legacy snapshot/checkpoint fixed limits no longer override selected-model capacity. Persisted task budgets and existing provider/model/pool configuration are unchanged. Existing installed 0.5.0 behavior changes only after deployment of a new build.

##### Validation

- Focused runtime/delegation/provider tests passed 33 cases, including a one-million-token model above the historical context ceiling, unknown capacities without invented output limits, legacy checkpoint resume, bounded multi-fragment compaction, explicit lower ceilings, independent provider input capacity, token-ceiling inheritance and mandatory unknown Anthropic output rejection.
- Service and Theia extension typechecks passed. Routing/approval/model/Swarm integration tests passed all seven cases; prepared completions route once and reuse the selected model.
- Isolated built-browser smoke passed six checks with no renderer errors, including reported/unknown capacity labels and a blank Swarm token-budget default. Report: `.turbo/settings-models-ui/1791072769490/report.json` (ignored local evidence). The first Swarm assertion failed because the harness had not selected a Project; the corrected harness creates/selects a disposable fixture Project. No user Project was used.
- Documentation links passed under WSL. Generated RPC/settings references were refreshed and their freshness check passed. Global format check reports only the three pre-existing untracked .kilo agent profiles; changed source formatting is clean. Changelog generation passed; coverage remains blocked by the same unrelated untracked .kilo files. Git diff whitespace check passed.
- Full `npx turbo run build typecheck lint test` passed all 33 tasks (13 cached), including Electron/browser builds and 382 passing platform-service tests with 11 capability-dependent skips across 99 files. Electron typecheck/lint/test remain configured skips. Log: `.turbo/model-capacity-full-gate.log`. The first full attempt exposed unused test-stub parameter lint errors, corrected before the passing run.
- A supplemental pending-record path audit found no uncovered task paths after excluding the separately reported unrelated .kilo profiles. This does not replace or claim a passing official global coverage gate.
- No running user tasks, locks, saved budgets, account credentials or model pools were changed. Installed deployment and paid-provider acceptance are unverified; this pending work is not a release or installer-lifecycle claim.

##### Files

- `docs/changes/2026-10-03-model-aware-agent-capacity.md`
- `docs/DEVELOPMENT_PLAN.md`
- `docs/OPEN_DECISIONS.md`
- `docs/OPERATIONS_GUIDE.md`
- `docs/PLATFORM_DESIGN.md`
- `docs/STATUS.md`
- `docs/TECHNICAL_ARCHITECTURE.md`
- `docs/API_REFERENCE.md`
- `docs/SETTINGS_REFERENCE.md`
- `docs/reference/rpc-schemas.json`
- `docs/reference/settings-schemas.json`
- `packages/contracts/src/models/schema.ts`
- `packages/contracts/src/rpc/protocol.ts`
- `packages/platform-service/roles/coordinator/ROLE.md`
- `packages/platform-service/src/agents/agent-runtime.ts`
- `packages/platform-service/src/agents/agent-runtime.test.ts`
- `packages/platform-service/src/agents/agent-tools.ts`
- `packages/platform-service/src/agents/agent-tools.test.ts`
- `packages/platform-service/src/agents/model-context.ts`
- `packages/platform-service/src/models/completion-service.ts`
- `packages/platform-service/src/models/completion-service.test.ts`
- `packages/platform-service/src/models/model-registry.ts`
- `packages/platform-service/src/models/providers/anthropic.ts`
- `packages/platform-service/src/models/providers/openai-compatible.ts`
- `packages/platform-service/src/models/providers/providers.test.ts`
- `packages/platform-service/src/settings/definitions.ts`
- `packages/platform-service/src/tasks/task-service.ts`
- `packages/theia-control-room/src/browser/models-widget.tsx`
- `packages/theia-control-room/src/browser/swarm-widget.tsx`
- `scripts/settings-models-ui-smoke.cjs`

### Fixed

#### Explain agent token and cost budget failures

**Impact:** patch

[Permanent work record](docs/changes/2026-10-03-agent-budget-failure-diagnostics.md).

##### Summary

Show the exhausted token or dollar budget and actual/limit values in agent failures, and expose task budgets in the read-only diagnostic command.

##### Details

- Live task records and per-call usage events for three failed narrative children matched exactly: 169414 against a 150000-token ceiling, 102925 against 100000, and 119742 against 100000. Reported dollar usage was zero. The observed failures do not show duplicate usage accounting; they exhausted per-task token limits that are separate from the Project's default 5 USD maximum-cost setting.
- The coordinator root had no explicit task token ceiling and failed on an estimated 60210-token request against its 60000-token input/context limit. That distinct failure must not be labeled cumulative task-budget exhaustion.
- Explain cumulative input plus output, including replayed transcript inputs, in the failure message. Distinguish token exhaustion from dollar exhaustion and carry the configured budget in the RPC error data. Numeric limits, equality behavior and enforcement timing are unchanged: the next turn is refused when recorded usage is at or above a configured ceiling, so a preceding response can overshoot it.
- Add the task budget to diagnose-agent-task.cjs next to spent totals. Document token budgets separately from response-output allowances and context limits, coordinator-supplied child ceilings, and the limitation of zero reported cost when pricing is unavailable.
- Existing installs retain their old error messages until updated. No budget was raised, disabled or changed in the live Project; no provider request or task retry was initiated. No schema or compatibility-identifier changes.

##### Validation

- Live authenticated task/event comparison matched every usage-event sum to its recorded spent total and verified all three token ceilings were exceeded.
- The focused regression first failed on the generic message and missing budget data before the fix.
- All 11 agent-runtime tests passed, including token-only exhaustion with zero cost, dollar exhaustion, and high cumulative usage without a token ceiling. The updated inspector ran against the installed service and returned the 150000-token task budget beside its 169414-token spent counter.
- Documentation links passed under WSL; script syntax and git diff whitespace checks passed. Global formatting still reports the three pre-existing untracked .kilo agent profiles; those files remain untouched.
- Full `npx turbo run build typecheck lint test` passed all 33 tasks (22 cached), including 372 passing platform-service tests with 11 capability-dependent skips and Electron/browser builds. Electron typecheck/lint/test remain configured skips. Changed runtime files pass Prettier. Changelog generation passed; the coverage check remains blocked by the pre-existing untracked .kilo agent files, outside this task's scope.

##### Files

- `docs/changes/2026-10-03-agent-budget-failure-diagnostics.md`
- `docs/OPERATIONS_GUIDE.md`
- `packages/platform-service/src/agents/agent-runtime.ts`
- `packages/platform-service/src/agents/agent-runtime.test.ts`
- `scripts/diagnose-agent-task.cjs`

#### Diagnose canon delegation and persist agent diagnostics

**Impact:** minor

[Permanent work record](docs/changes/2026-10-03-agent-tool-lock-diagnostics.md).

##### Summary

Repair discussion-board tool availability in Ask always Projects, prevent delegation blocked by the parent's locks, and add persistent service logging and read-only task diagnostics.

##### Details

- Live installed 0.5.0 service inspection identified the reported lock holder as the coordinator parent of the waiting game-designer child, rather than proving a duplicate root request. The parent owned six canon paths. The child role has file-read permissions only; its offered tool list also lacked the board tools because their minimum access gate rejected Ask always. Later narrative children received write tools but encountered missing directories and a budget failure. Private goal text and raw tool inputs are not retained in this record.
- Remove the board tools' minimum-access gate while preserving role checks, normal access policy and approval requirements for posts. Read-only roles do not gain file-write permission. Binding decisions retain their separate user-confirmation flow.
- Add a broker inspection method reporting offered tools and exclusions by internal status, Project availability, role permission or access policy. Persist an agent-tool-availability progress event at worker startup with task/worker/role/access identity, offered IDs and exclusion reasons, without prompts or file content.
- Reject delegation when declared child write touches overlap locks held by the parent. Isolated worktree file writes are exempt because they do not write the shared Project path; live/shared resources still require independent ownership. Preserve lock ownership and require explicit release rather than automatically transferring or overriding locks. Undeclared touches and locks acquired after delegation remain outside this preventive check. Clarify writer-role selection and lock ownership in the coordinator instructions.
- Add structured lock-conflict/release-denial logs identifying requesting and owning tasks/workers. CLI services persist redacted logs even when detached stderr is discarded, rotating service.jsonl at approximately 5 MiB into one previous file. Embedded services retain stderr logging; file persistence failure falls back to stderr. This bounded history is separate from audit/event retention settings.
- Preserve native tool error codes and numeric worker RPC failure codes. Clarify createDirectories for new-folder writes without changing filesystem-write defaults.
- Add scripts/diagnose-agent-task.cjs, an authenticated read-only inspector with explicit profile, Project and task selection. It reports ancestry, permissions, tool offers, current locks and failed call codes; older services fall back to existing model-call audit. It omits prompts, tool inputs/outputs, source text and tokens. Calls/events are bounded and paths/IDs can remain private.
- No schema, data-path, package-identity or product-version migration. The running installed IDE has not been replaced, restarted or hot-patched by this source change. Existing waiting tasks and other independent work are preserved.

##### Validation

- Reproduced missing board/read in a focused service integration regression before the fix; the same regression passed after removing the gate, including rejected post approval and preserved read-only file permissions.
- Five affected suites passed: 28 tests covering agent delegation, broker, model loop, worker supervisor and locks before the later logging/error-code additions.
- The task inspector ran successfully against the live installed 0.5.0 service and identified the waiting child, parent relationship, offered tools, Project Ask always mode and original -32121/-32122 audit codes. Later live checks confirmed ENOENT write failures and a budget failure.
- Full `npx turbo run build typecheck lint test` gate passed all 33 tasks (22 cached), including Electron/browser builds and 369 passing platform-service tests with 11 capability-dependent skips. Electron typecheck/lint/test remain configured skips. Later worktree-exemption and startup/shutdown logging changes passed the affected service build, typecheck, lint and three focused regression tests.
- An isolated source-built CLI service passed the task inspector check for scheduler-event offered tools/exclusion reasons and the persisted startup log. Report: `.turbo/canon-debug/source-smoke-1791064429412/report.json` (ignored local evidence). The isolated service was stopped; the user's installed IDE was unaffected. Initial smoke attempts exposed an incorrect client-path assumption in the disposable harness and the absence of a startup entry; the harness was corrected and CLI lifecycle logging added before the passing check.
- `git diff --check` and Prettier across platform-service/src passed. `npm run changelog:update` ran; the coverage check reports pre-existing untracked `.kilo/agents/code-reviewer.md` as uncovered work. These unrelated files are outside this record's scope.
- `scripts/check-links.sh` passed under WSL. Initial sandboxed Git Bash attempts lacked utilities and did not provide valid checks; the later native Git Bash scan encountered fork/resource exhaustion and was stopped. The complete WSL scan reported All links OK.
- Global formatting check currently fails on three pre-existing untracked .kilo agent profiles. Those unrelated files are preserved; changed TypeScript files have been formatted.
- Installed deployment, installer lifecycle and original canon task completion are unverified. No paid provider requests were initiated by this investigation.

##### Files

- `docs/changes/2026-10-03-agent-tool-lock-diagnostics.md`
- `docs/OPERATIONS_GUIDE.md`
- `packages/platform-service/roles/coordinator/ROLE.md`
- `packages/platform-service/src/agents/agent-tools.ts`
- `packages/platform-service/src/agents/agent-tools.test.ts`
- `packages/platform-service/src/board/board-tools.ts`
- `packages/platform-service/src/change/lock-manager.ts`
- `packages/platform-service/src/cli.ts`
- `packages/platform-service/src/cli.test.ts`
- `packages/platform-service/src/logger.ts`
- `packages/platform-service/src/logger.test.ts`
- `packages/platform-service/src/models/models.integration.test.ts`
- `packages/platform-service/src/tools/builtin-tools.ts`
- `packages/platform-service/src/tools/tool-broker.ts`
- `packages/platform-service/src/tools/tool-broker.integration.test.ts`
- `packages/platform-service/src/workers/supervisor.ts`
- `packages/platform-service/src/workers/worker-main.ts`
- `scripts/diagnose-agent-task.cjs`

### Maintenance

#### Stage and launch the PlayWeld 0.5.0 Windows installer

**Impact:** none

[Permanent work record](docs/changes/2026-10-03-installer-0.5.0-handoff.md).

##### Summary

Stage the verified PlayWeld 0.5.0 installer with committed-source provenance and launch the interactive setup wizard at the user's request. This records post-commit handoff evidence without rewriting the committed release records.

##### Details

- Release source committed and pushed to `origin/main` as `8b9106193ad356f5911d19c6d1e729d7ca806bc6`. The unrelated untracked Kilo agent files remain excluded from the commit.
- Staged the installer and complete unpacked application to `Windows-Release/0.5.0/`, retaining earlier version outputs. Generated the isolated test launcher, provenance metadata and checksum file with the existing staging tool. The installer is `Windows-Release/0.5.0/PlayWeld-0.5.0-x64.exe`.
- Rechecked the staged installer's SHA-256 against `local-build.json` and verified that metadata names the committed release source. No Git tag or GitHub release was created or published; the staging tool's tag field is its conventional version name.
- The remaining installed `GameCrafter.exe` process was the background service, with no desktop window. Used the normal authenticated service-stop command with checkpointing, which reported `stopped`; no force termination of the installed application was needed.
- Launched the staged installer with a visible interactive window. The process remained running and its window title was `PlayWeld Setup`. Installation choices and completion remain with the interactive wizard; no installed-version, upgrade/uninstall or rollback acceptance is claimed.
- No product source, package version, data schema or existing release record changed in this evidence task. This pending internal record does not require rebuilding the already staged 0.5.0 installer.

##### Validation

- `node scripts/stage-windows-release.cjs`: passed after applying the documented process-local exclusion of the three unrelated untracked Kilo agent files. Staging reverified the Windows native addon, packaged app/service version 0.5.0 and all 30 bundled skills.
- Staged installer checksum: `cefcb4691bbc3c962e711050d1de23d362c1254390c15fd54823a5a5a43bb1a1`; matches built installer and provenance metadata. Authenticode status was previously verified as `NotSigned`.
- `node packages/platform-service/lib/cli.js stop`: reported `stopped`. Installer launch succeeded; running process and visible `PlayWeld Setup` window title were verified through Windows process inspection.
- The final release documentation link check completed with `All links OK`. This evidence record adds no Markdown links. Changelog freshness, file coverage and whitespace checks are run for its handoff; product quality and packaged UI evidence remain in the committed 0.5.0 release-preparation record.

##### Files

- `docs/changes/2026-10-03-installer-0.5.0-handoff.md`

#### Prepare version 0.6.0

**Impact:** none

[Permanent work record](docs/changes/2026-10-03-release-0.6.0.md).

##### Summary

Prepare version 0.6.0 from 0.5.0, retaining all pending work records in the changelog and detailed release notes.

##### Details

Synchronize first-party workspace and internal dependency versions. The lockfile must be refreshed separately. No tag, publication, or build is performed by version preparation.

##### Validation

- Version progression, workspace/internal dependency synchronization and refreshed lockfile verification passed for 0.6.0. Lockfile refresh changed only first-party version references; no dependency versions were upgraded. Existing native dependencies were retained; npm ci was not repeated for this version-only refresh.
- Full release-version build/typecheck/lint/test gate passed all 33 tasks without cache reuse. Platform-service: 381 passed, 12 capability-dependent skips across 99 files. Electron/browser builds passed; Electron typecheck/lint/test remain configured skips. Log: `.turbo/release-0.6.0/quality.log` (ignored local evidence).
- All 24 change-tracking regression tests passed. Generated RPC/settings freshness, source/package formatting and documentation links passed. Global formatting still flags the unrelated untracked Kilo profiles. An attempted alternate ignore-file check resolved patterns relative to its artifact directory and scanned ignored outputs; it was stopped, and the normal repository ignore file with explicit packages/apps scope passed.
- Release changelog/coverage checks passed with a process-local Git exclusion limited to `.kilo/`; that independent untracked work remains unchanged and outside this release commit. No persistent ignore configuration was changed. Release notes and changelog were regenerated.
- Read-only pre-deployment snapshot verified installed service 0.5.0 with four Projects, 21 configured models and six pools. Packaging, installed deployment, signing and rollback remain unverified at this source-commit point; actual later evidence belongs in a new work record.

##### Files

- `packages/archive-extractor/package.json`
- `packages/contracts/package.json`
- `packages/platform-service/package.json`
- `packages/plugin-sdk/package.json`
- `packages/service-client/package.json`
- `packages/theia-control-room/package.json`
- `packages/plugins/sample-hello/package.json`
- `apps/control-room/package.json`
- `apps/control-room-browser/package.json`
- `package-lock.json`

## 0.5.0

### Fixed

#### Stop incomplete IPC message diagnostics retaining closed connections

**Impact:** patch

[Permanent work record](docs/changes/2026-10-02-ipc-partial-message-shutdown.md).

##### Summary

Repair service/client shutdown after an incomplete framed IPC message: the pinned JSON-RPC reader's recurring partial-message diagnostic timer could survive reader disposal and keep an otherwise cleaned-up process alive.

##### Details

- Fresh disposable native acceptance completed its map operations and cleanup but its Node process remained running. Inspection of that owned process found the JSON-RPC partial-message timeout callback as the active recurring timer.
- Reproduce with an authenticated client receiving an incomplete Content-Length frame. The regression failed before the repair with one timer left after disconnect.
- Disable unused partial-message diagnostic notifications on both service and client readers. Framing, authentication, RPC contracts, request timeouts and disconnect handling remain unchanged; neither endpoint consumes this diagnostic notification.
- Add peer-side and client-side lifecycle regressions. No schema, stored-data or package-identifier change; no migration required. Terminate only the verified owned hung acceptance process and retain its original diagnostic logs.

##### Validation

- Client incomplete-frame regression reproduced the leak before the repair; both client tests and the service peer-disconnect regression passed after it.
- Full repository build/typecheck/lint/test gate passed all 33 tasks, including 365 platform-service tests with 11 explicit capability-dependent skips. Existing workspace dependencies were reused during concurrent work.
- Fresh native Unreal map acceptance progressed through cleanup into the following Unity test stage without the prior hang. Final native results and formatting/change-record checks are recorded in the companion acceptance record.

##### Files

- `packages/service-client/src/index.ts`
- `packages/service-client/src/client.test.ts`
- `packages/platform-service/src/ipc/server.ts`
- `packages/platform-service/src/ipc/server-lifecycle.test.ts`

#### Normalize generated release-note trailing whitespace

**Impact:** none

[Permanent work record](docs/changes/2026-10-02-release-note-whitespace.md).

##### Summary

Generate release notes with one terminating newline so newly staged notes pass Git whitespace validation.

##### Details

- Final staged review caught an extra blank line at EOF in three newly generated release notes. Unstaged Git checks had not inspected these previously untracked files.
- Trim trailing document whitespace in the renderer and append one newline. Regenerate pending outputs without changing record text or release content; no previously committed historical note or released record is rewritten.
- Add a regression preparing a release in an isolated Git fixture, staging files and checking the generated note with git diff --cached --check. No runtime, schema, data, dependency or release-version change.

##### Validation

- Regression failed before correction because staged whitespace validation rejected the generated note. After correction, all 12 tracking tests passed. Regenerated release notes passed staged Git whitespace validation and changelog freshness/coverage.
- Pending notes and changelog regenerated through supported tooling; staged whitespace/freshness/coverage checked before the authorized commit.

##### Files

- `scripts/change-tracking.cjs`
- `scripts/change-tracking.test.ts`
- `docs/releases/v0.2.0.md`
- `docs/releases/v0.3.0.md`
- `docs/releases/v0.4.0.md`

#### Restore Sample Hello compatibility with the current platform

**Impact:** patch

[Permanent work record](docs/changes/2026-10-02-sample-plugin-version-compatibility.md).

##### Summary

Repair the bundled sample plugin's manifest so the current 0.4.0 platform can inspect and install it.

##### Details

- The actual Plugins UI rejected Sample Hello because its ^0.1.0 platform range excludes later pre-1.0 minor versions. Set its platform range to >=0.1.0 <1.0.0 while preserving plugin protocol 1, ID, sample version, capabilities and prior 0.1.x installation compatibility.
- Add a real installer regression using the current workspace version read from its package manifest. Existing tests using a fixed 0.1.0 service version could not catch this drift. The plugin is an SDK example; the range does not certify every future pre-1.0 runtime.
- Preserve fail-closed Windows runtime isolation. No schema/data migration or installed user-plugin rewrite; existing installed copies retain their own manifest until deliberately reinstalled.

##### Validation

- All seven PluginInstaller tests passed, including the current-version sample inspection/install and existing compatibility/capability rejection checks.
- Actual UI inspection, privilege acceptance, installation/enablement and uninstall passed after the correction. Start reports the existing unavailable Windows isolation capability; no worker/tool acceptance claimed on that host.

##### Files

- `packages/plugins/sample-hello/gamecrafter-plugin.json`
- `packages/platform-service/src/plugins/plugin-installer.test.ts`

#### Default Control Room project selectors to the restored IDE workspace

**Impact:** patch

[Permanent work record](docs/changes/2026-10-03-workspace-project-selection.md).

##### Summary

Control Room pages now select the registered Project matching the IDE workspace when opened or restored. They no longer silently default to the first registered Project, which could direct operations at another game.

##### Details

- Added shared workspace selection behavior to the Control Room widget base. Selection waits for Theia workspace readiness and reads its roots. Windows path comparison handles casing, slash differences and trailing separators; child folders select the closest registered Project. Multiple roots must identify the same Project. Empty, unknown or ambiguous workspaces remain unselected.
- Applied this behavior to Swarm, Chat, Assets, Discussion Board, Knowledge, Engine, DCC Tools, Skills and Roles, Connections, Plugins, Models, Settings, Audit and History, and Backups. Settings and Models load their scoped data after resolving the Project so the initial page content uses the correct scope.
- Explicit dropdown choices, including platform-only/all-project options, survive ordinary refreshes and page activation. A changed workspace resets the default; closing and recreating a page uses the IDE workspace again. Explicit command deep links retain their target on initial load.
- Handled overlapping constructor and activation refreshes during layout restoration. Selection reads the current field after workspace readiness and distinguishes explicit empty choices from uninitialized fields. Swarm clears project-specific requests, tasks, questions, locks, integrations, approvals, impact results and question drafts when automatic selection changes. Added an accessible label to the Backups Project selector.
- Added policy regression coverage and an isolated real-service browser smoke script. Adapted the existing Chat request-ownership fixture to model a restored Project A workspace. No persisted record, RPC, package identifier or storage schema changed; no migration is required. Version preparation and installer evidence are tracked separately in the 0.5.0 release record.
- During installer verification, updated the existing desktop/browser smoke harness to wait for project-scoped skill enablement after explicitly selecting the generated Project. Platform-only skill rows are already visible before the asynchronous Project request finishes; counting those rows alone was insufficient and caused an early checkbox assertion. Engine and DCC setup checks now explicitly select the generated Project and wait for its forms because this smoke opens the IDE workspace only at the end; it no longer relies on the unsafe first-Project fallback.

##### Validation

- `npm test -w @gamecrafter/theia-control-room`: passed after adapting the Chat workspace fixture. The final full run includes 43 Control Room tests, including nine new selection tests. Initial fixture failures were corrected; they are not outstanding failures.
- `npx turbo run build typecheck lint test`: passed, 33 successful tasks (25 cached). Includes rebuilt browser and Electron applications. Existing dependency installation was reused; `npm ci` was not rerun because no dependencies changed. Existing platform-dependent test skips remain; this is not live engine verification. Log: `.turbo/project-selection-verification.log`.
- `node scripts/project-selection-ui-smoke.cjs`: passed 17 checks using two disposable Projects, an isolated profile and the built browser app with the real platform service. All 14 selectors chose the workspace Project despite a different first registered Project; manual Swarm selection survived activation; closing/reopening and app reload restored the workspace default. No renderer errors. Report and screenshot: `.turbo/project-selection-ui/1791060010587/`. Earlier smoke setup/selector mistakes and the Models startup race were corrected before this successful run.
- `npm run format:check`: reports only three unrelated untracked Kilo agent files (`.kilo/agents/code-reviewer.md`, `.kilo/agents/code-skeptic.md`, `.kilo/agents/docs-specialist.md`). This change's source files pass formatting; those unrelated files were left untouched. `git diff --check` passed.
- `npm run changelog:update`: passed. `npm run changelog:check -- --base HEAD`: fails coverage on the same unrelated untracked Kilo agent files. Repeating that check with a process-local Git exclusion file containing exactly those three paths passes coverage and generated changelog freshness for this change. Repository ignore configuration was not modified.
- `scripts/check-links.sh`: passed with `All links OK` under WSL using an ignored temporary LF copy of the same script (`.turbo/check-links-lf.sh`) for the Windows checkout. The slower Git Bash run was interrupted before completion; the completed WSL run is the link evidence.
- The original fix verification covered Electron compilation and browser reload rather than a packaged Electron close/relaunch or installer lifecycle. Subsequent 0.5.0 installer/package checks are recorded separately in the release-preparation record.

##### Files

- `packages/theia-control-room/src/browser/workspace-project-selection.ts`
- `packages/theia-control-room/src/browser/workspace-project-selection.test.ts`
- `packages/theia-control-room/src/browser/control-room-react-widget.ts`
- `packages/theia-control-room/src/browser/assets-widget.tsx`
- `packages/theia-control-room/src/browser/audit-widget.tsx`
- `packages/theia-control-room/src/browser/backups-widget.tsx`
- `packages/theia-control-room/src/browser/chat-widget.tsx`
- `packages/theia-control-room/src/browser/chat-widget.test.ts`
- `packages/theia-control-room/src/browser/connections-widget.tsx`
- `packages/theia-control-room/src/browser/dcc-widget.tsx`
- `packages/theia-control-room/src/browser/discussion-board-widget.tsx`
- `packages/theia-control-room/src/browser/engine-widget.tsx`
- `packages/theia-control-room/src/browser/knowledge-widget.tsx`
- `packages/theia-control-room/src/browser/models-widget.tsx`
- `packages/theia-control-room/src/browser/plugins-catalog-widget.tsx`
- `packages/theia-control-room/src/browser/settings-widget.tsx`
- `packages/theia-control-room/src/browser/skills-widget.tsx`
- `packages/theia-control-room/src/browser/swarm-widget.tsx`
- `scripts/project-selection-ui-smoke.cjs`
- `scripts/live-ui-smoke.cjs`
- `docs/changes/2026-10-03-workspace-project-selection.md`

### Documentation

#### Documentation cookbooks, glossary, inventory and sourced refresh

**Impact:** none

[Permanent work record](docs/changes/2026-10-02-documentation-cookbooks-and-inventory.md).

##### Summary

Expand user, contributor and operator documentation with workflow prerequisites, state ownership, permissions, failures/recovery, examples and explicit evidence boundaries. Generate a complete service/contract/settings surface inventory linked from the existing coverage record.

##### Details

- Add user workflow and contributor extension cookbooks, glossary, annotated actual workflow screenshot guide and operations recovery procedures. Explain platform plugins, Theia extensions and engine-side editor addons as separate lifecycles.
- Generate exact names for 186 methods/25 RPC families, 28 notifications, 75 settings/17 groups, 24 service directories/test paths and declared plugin capabilities. A new unmapped family fails generation; a freshness check detects drift. This is discovery coverage, not automatic acceptance.
- Add targeted primary-source verification for MCP 2026-07-28, Agent Skills, Theia, Godot, Unity, Unreal and the OpenAI Chat reference. Mark inaccessible Anthropic/Blender documentation unverified. Older research notes are not globally refreshed or promoted into new requirements.
- Preserve design/decision/work-package authority, product/version identifiers and existing stored contracts. No migration, release, dependency or user-confirmed requirement change. Asset UI/provider acceptance, Windows isolation, external MCP editor integration and installer rollback remain explicit gaps.

##### Validation

- Generated inventory and existing system references passed freshness checks; initial documentation links passed through WSL. Final link/format/changelog checks are recorded after completion below.
- Source inspection checked role/skill roots, setting scopes, task state/error codes, plugin manifest/version checks and service recovery ownership. Runnable checks and screenshots have separate permanent records.
- Reused the shared installed dependencies; npm ci was skipped because it replaces the dependency tree used by concurrent work. No new dependency added.

- Full repository gate passed all 33 tasks; service suite passed 365 tests with 11 capability-dependent skips. Runnable capture harness regressions passed both checks; generated system references and documentation inventory passed freshness checks. Final WSL documentation links, repository format check, explicit formatting of new guides/scripts, Git whitespace check and changelog coverage/freshness all passed.

##### Files

- `docs/DOCUMENTATION_COVERAGE.md`
- `docs/EXTENSION_COOKBOOK.md`
- `docs/GLOSSARY.md`
- `docs/OPEN_DECISIONS.md`
- `docs/OPERATIONS_GUIDE.md`
- `docs/README.md`
- `docs/STATUS.md`
- `docs/WORKFLOW_COOKBOOK.md`
- `docs/WORKFLOW_SCREENSHOTS.md`
- `docs/examples/lantern-workshop/README.md`
- `docs/reference/DOCUMENTATION_INVENTORY.md`
- `docs/reference/documentation-inventory.json`
- `docs/research/documentation-standards-verification.md`
- `scripts/generate-documentation-inventory.cjs`

#### Review documentation coverage, evidence and publication readiness

**Impact:** none

[Permanent work record](docs/changes/2026-10-02-documentation-review.md).

##### Summary

Review documentation against contracts, settings, Control Room navigation, implementation and retained evidence; correct misleading wording and add repeatable integrity checks before the authorized commit/push.

##### Details

- Screenshot review caught preview text carrying into the combined agent request. Clear the input before typing and assert the durable request prefix, then recapture the combined workflows. The release-note staged-whitespace fix is recorded independently.

- Add an area-by-area review identifying guides/artifacts for implementation surfaces, with remaining live/target-system limits explicit. Preserve coverage/status/decision authority and historical capture dates.
- Correct handbook backup scope, budget guarantees, Full access boundaries and asset collision behavior. Add explicit skill/role paths and trust, bounded filesystem/context instructions, narrow compatibility retries and precise source-reviewed profile relocation.
- Add integrity tooling comparing methods/notifications/settings/source areas/navigation with inventory/handbook, and checking capture selections, timestamps, checks, renderer errors and valid PNG headers/dimensions. Counts establish file integrity, not visual quality or external acceptance.
- Add generated inventory/report checks to CI after builds and link the review from index/coverage. No new dependency, version, schema, migration or identifier change.
- Reopen four primary standards pages cited by the new research note; content remains consistent with the documented distinctions. No inaccessible-source claim promoted.
- User authorized commit/push. Include recorded pending runtime/provider/change-tracking dependencies so published guides describe matching source; preserve permanent records and ignored local evidence.

##### Validation

- After the screenshot input correction, a fresh combined browser/UI/service run passed all nine scenarios and 43 screenshots with zero renderer errors. Its report retains the current helper hash and exact run/version. Final tracking suite passed 12 tests after the separate whitespace-generator correction.

- Full repository gate passed 33/33 tasks using valid Turbo cache. Tracking regression tests passed 11 fresh cases.
- Fresh profile recovery passed five actual service/credential/index checks in isolated Windows profiles. Both capture harness checks, release version agreement and system/inventory freshness passed.
- Integrity passed 186 methods, 28 notifications, 75 settings/17 groups, 24 source areas, 16 surfaces, seven reports and 90 images, including all nine combined scenarios.
- Reused installed dependencies; npm ci skipped during shared-tree work. No new browser/Electron/engine/paid-provider/installer run claimed for wording corrections. Final links/format/records recorded below after checks.
- Final WSL documentation links passed. Repository and explicit new-guide/script formatting, Git whitespace, release version agreement (0.4.0), generated references/inventory and changelog coverage/freshness passed. The raw credential-pattern scan of docs/scripts found no matches; this is a narrow publication check, not a complete security audit.

##### Files

- `.github/workflows/ci.yml`
- `docs/DOCUMENTATION_REVIEW.md`
- `docs/README.md`
- `docs/DOCUMENTATION_COVERAGE.md`
- `docs/CONTROL_ROOM_HANDBOOK.md`
- `docs/EXTENSION_COOKBOOK.md`
- `docs/MODEL_ROUTING_GUIDE.md`
- `docs/RECOVERY_RUNBOOK.md`
- `scripts/check-documentation-evidence.cjs`
- `scripts/documentation/workflow-scenarios.cjs`
- `docs/images/lantern-workflows/01-home.png`
- `docs/images/lantern-workflows/02-create-project.png`
- `docs/images/lantern-workflows/03-project.png`
- `docs/images/lantern-workflows/04-models.png`
- `docs/images/lantern-workflows/05-chat.png`
- `docs/images/lantern-workflows/06-discussion.png`
- `docs/images/lantern-workflows/07-knowledge.png`
- `docs/images/lantern-workflows/08-settings-override.png`
- `docs/images/lantern-workflows/08-settings.png`
- `docs/images/lantern-workflows/09-skills.png`
- `docs/images/lantern-workflows/10-swarm.png`
- `docs/images/lantern-workflows/11-connections.png`
- `docs/images/lantern-workflows/12-engine.png`
- `docs/images/lantern-workflows/13-dcc.png`
- `docs/images/lantern-workflows/14-assets.png`
- `docs/images/lantern-workflows/15-plugins.png`
- `docs/images/lantern-workflows/16-backups.png`
- `docs/images/lantern-workflows/17-updates.png`
- `docs/images/lantern-workflows/18-audit.png`
- `docs/images/lantern-workflows/agent-approval.png`
- `docs/images/lantern-workflows/agent-integrated.png`
- `docs/images/lantern-workflows/agent-integration-ready.png`
- `docs/images/lantern-workflows/agent-question.png`
- `docs/images/lantern-workflows/asset-awaiting-review.png`
- `docs/images/lantern-workflows/asset-configuration.png`
- `docs/images/lantern-workflows/asset-import-rejected.png`
- `docs/images/lantern-workflows/asset-imported.png`
- `docs/images/lantern-workflows/backup-configuration.png`
- `docs/images/lantern-workflows/backup-nonempty-target.png`
- `docs/images/lantern-workflows/backup-restored.png`
- `docs/images/lantern-workflows/backup-verified.png`
- `docs/images/lantern-workflows/backup-wrong-secret.png`
- `docs/images/lantern-workflows/capture-report.json`
- `docs/images/lantern-workflows/decision-before-binding.png`
- `docs/images/lantern-workflows/decision-synchronized.png`
- `docs/images/lantern-workflows/knowledge-changed-document.png`
- `docs/images/lantern-workflows/mcp-configured.png`
- `docs/images/lantern-workflows/mcp-connected.png`
- `docs/images/lantern-workflows/plugin-capability-review.png`
- `docs/images/lantern-workflows/plugin-installed.png`
- `docs/images/lantern-workflows/plugin-isolation-unavailable.png`
- `docs/images/lantern-workflows/settings-import-failure.png`
- `docs/images/lantern-workflows/settings-import-preview.png`
- `docs/images/lantern-workflows/settings-import-result.png`

#### Model eligibility, routing and failure diagnosis guide

**Impact:** none

[Permanent work record](docs/changes/2026-10-02-model-routing-documentation.md).

##### Summary

Explain current model eligibility, pool selection and completion behavior so users can diagnose the actual request boundary without resetting unrelated account configuration.

##### Details

- Document filtering stages and NoEligibleModel stage/removedBy context, applicable role/task pool intersection, manual-model eligibility and service-owned route/outcome records.
- Explain chat capability versus streaming preference/requirement and complete-response fallback, with current source references and local UI evidence.
- Map quality/exploration/cost/latency settings to their actual implementation limits. Unknown estimates are not rejected solely for being unknown, and successful routing does not guarantee future provider billing.
- Distinguish provider response, task/broker status, worktree integration and native acceptance. Retain paid-provider and reasoning-quality gaps, and avoid claiming universal retry/failover.
- Link the guide from the existing index, workflow cookbook and coverage inventory. No external vendor behavior, public schema, stored state, version or dependency change.

##### Validation

- Fresh focused router/provider test run passed 16 tests across two files using repository fixtures; no live paid-provider request.
- Source inspection checked the route schema, filter sequence, pool rules, settings, completion service and Chat widget. Existing combined UI screenshots retain their earlier dates and synthetic-provider scope.
- Final documentation links passed through WSL. Repository and explicit guide/record formatting, generated system references/documentation inventory, Git whitespace and changelog coverage/freshness passed. The full repository gate passed all 33 tasks from valid Turbo cache during this documentation-only continuation.

##### Files

- `docs/MODEL_ROUTING_GUIDE.md`
- `docs/README.md`
- `docs/WORKFLOW_COOKBOOK.md`
- `docs/DOCUMENTATION_COVERAGE.md`

#### Executable profile recovery and diagnostic documentation

**Impact:** none

[Permanent work record](docs/changes/2026-10-02-profile-recovery-documentation.md).

##### Summary

Expand remaining operational documentation with a complete current-profile recovery drill, runnable read-only diagnostics, full index rebuild acceptance and credential recovery limits.

##### Details

- Add an explicit-profile diagnostic executable using the public service client and real read-only RPCs. Require an absolute profile path; report service/registration identity and optional index counts without credential requests. Names and paths remain visible and require review before sharing.
- Add a unique-directory recovery runner using actual service/archive operations. Reconcile/edit/rebuild a copied Lantern design and require a fresh lexical citation. Run the diagnostic as both an imported example and a real Node CLI process.
- Create and verify a local profile archive, inspect its original credential key and excluded service lifecycle files, restore separately, stop/relaunch at the restored location and verify the same Project path/ID, Restricted platform override and exact synthetic account credential.
- Demonstrate wrong-key decryption failure only in a stopped owned copy and verify that the restored key remains intact. Retain reports/archives in ignored directories; generated secrets remain absent from public reports. No external provider request or production profile mutation.
- Explain relocation versus moving game workspaces, task-returning rebuild versus completed indexing, and current-profile reopen versus old-schema compatibility. Cross-link existing operations/contributor/fixture guides and extend the existing coverage inventory.
- No public schema, identifier, dependency, release version or stored-data change. Preserve existing decision/work-package statuses; broader unresolved capabilities remain visible.

##### Validation

- Recovery drill passed all five checks on the actual Windows service, including real diagnostic CLI execution, profile archive/restore/relaunch, exact credential equality and wrong-key rejection. Passing compact report retained in the repository.
- Full build/typecheck/lint/test gate passed 33/33 tasks with all 33 results reused from valid Turbo cache; this documentation/script-only change does not claim a fresh execution of cached package tests.
- npm ci skipped because concurrent work uses the installed dependency tree. No new dependency required. No browser/Electron/native engine rerun performed for this service-only example; earlier UI/native reports retain their own scope and dates.
- Final documentation link check passed through WSL. Repository formatting and explicit formatting of the new guides/scripts/records passed; system-reference and documentation-inventory freshness, Git whitespace and changelog coverage/freshness passed. Owned recovery service processes exited after cleanup.

##### Files

- `docs/RECOVERY_RUNBOOK.md`
- `docs/README.md`
- `docs/OPERATIONS_GUIDE.md`
- `docs/EXTENSION_COOKBOOK.md`
- `docs/DOCUMENTATION_COVERAGE.md`
- `docs/examples/lantern-workshop/README.md`
- `docs/examples/lantern-workshop/verification/profile-recovery.json`
- `docs/examples/service-diagnostics.cjs`
- `scripts/verify-documentation-recovery.cjs`

#### Selectable actual UI documentation workflows

**Impact:** none

[Permanent work record](docs/changes/2026-10-02-selectable-documentation-workflows.md).

##### Summary

Extend the isolated Lantern Workshop capture runner with independently selectable agent, settings, decisions, Knowledge, backup, plugin, MCP and asset exercises and retain actual workflow/failure screenshots.

##### Details

- Keep the original overview scenario and add comma-separated selections/all with validation before startup. Use unique owned profiles/Projects/processes, synthetic local provider responses, password-only recovery inputs, and cleanup of owned processes. Retain failure screenshot, sanitized visible text and compact failure report under ignored run directories.
- Scripted agent responses exercise the actual request/runtime/question/delegation/worktree/completion/integration path; a separate Ask always tool call is approved in UI. Check coordinator success as well as child output and integration to prevent a failed root task being mislabeled as full success. Local fixture responses never become a paid-model reasoning claim.
- Settings exercises dry-run preview, apply, UI export parsing, malformed JSON rejection and reset. Decision exercises explicit user binding and generated canon document validation. Knowledge edits a source file and checks a new quoted/cited search result.
- Backup exercises UI identity/destination/run/verification, wrong-secret rejection, fresh restoration with byte comparison/new registration, and occupied-target rejection. Plugin exercises inspection/exact capability acceptance/install/enable/start diagnostic/uninstall; unavailable Windows isolation is retained as a limitation rather than bypassed.
- Reports record package version, Git base/dirty status, capture/helper hashes, selected scenarios, checks and renderer errors. Duplicate early scenario captures remain separately dated evidence; the combined report is the current cross-workflow acceptance.
- Repair harness failures: asynchronous UI/export readiness, browser predicate closure capture, expected backup error text, plugin alert selection, Godot viewport/input readiness and missing coordinator completion claim. Preserve original local failures and require passing reruns. No public API/storage change.

- Add a runnable stdio MCP server and actual UI connection/discovery, explicit classification, broker read and disconnect; observed revision 2025-11-25, no engine identity claim. Add synthetic asset submission/review/import with outside-Project rejection and exact-byte comparison; metadata-only GLB and local endpoint, no paid/artistic acceptance claim.

##### Validation

- Individual settings/decision/Knowledge, agent, backup, plugin, MCP and asset runs passed against the real browser UI/service. Combined run passed all six scenarios, 20 screenshots in the six-scenario snapshot and no renderer errors; final coordinator-success rerun recorded below.
- Native Node regression checks passed for unavailable-scenario rejection and contract-valid scripted coordinator completion. Screenshot inspection caught the earlier missing coordinator claim and verified visible binding, approval, backup errors and isolation failure.
- Original failures are retained under .turbo/documentation; public screenshots contain synthetic tutorial data and no raw credentials/recovery secret values. Paid providers, production games and publishing were not used.

- Final all-scenario rerun passed overview plus all eight expanded workflows, 43 actual UI screenshots and zero renderer errors. Coordinator and delegated task succeeded; manual integration and final workspace file were verified. The report is dated 2026-10-03 UTC / 2026-10-02 Phoenix and retains source/version identity.

##### Files

- `docs/examples/lantern-mcp/server.cjs`
- `docs/images/lantern-agent/01-home.png`
- `docs/images/lantern-agent/02-create-project.png`
- `docs/images/lantern-agent/agent-approval.png`
- `docs/images/lantern-agent/agent-integrated.png`
- `docs/images/lantern-agent/agent-integration-ready.png`
- `docs/images/lantern-agent/agent-question.png`
- `docs/images/lantern-agent/capture-report.json`
- `docs/images/lantern-assets/01-home.png`
- `docs/images/lantern-assets/02-create-project.png`
- `docs/images/lantern-assets/asset-awaiting-review.png`
- `docs/images/lantern-assets/asset-configuration.png`
- `docs/images/lantern-assets/asset-import-rejected.png`
- `docs/images/lantern-assets/asset-imported.png`
- `docs/images/lantern-assets/capture-report.json`
- `docs/images/lantern-backup/01-home.png`
- `docs/images/lantern-backup/02-create-project.png`
- `docs/images/lantern-backup/backup-configuration.png`
- `docs/images/lantern-backup/backup-nonempty-target.png`
- `docs/images/lantern-backup/backup-restored.png`
- `docs/images/lantern-backup/backup-verified.png`
- `docs/images/lantern-backup/backup-wrong-secret.png`
- `docs/images/lantern-backup/capture-report.json`
- `docs/images/lantern-mcp/01-home.png`
- `docs/images/lantern-mcp/02-create-project.png`
- `docs/images/lantern-mcp/capture-report.json`
- `docs/images/lantern-mcp/mcp-configured.png`
- `docs/images/lantern-mcp/mcp-connected.png`
- `docs/images/lantern-plugin/01-home.png`
- `docs/images/lantern-plugin/02-create-project.png`
- `docs/images/lantern-plugin/capture-report.json`
- `docs/images/lantern-plugin/plugin-capability-review.png`
- `docs/images/lantern-plugin/plugin-installed.png`
- `docs/images/lantern-plugin/plugin-isolation-unavailable.png`
- `docs/images/lantern-workflows/01-home.png`
- `docs/images/lantern-workflows/02-create-project.png`
- `docs/images/lantern-workflows/03-project.png`
- `docs/images/lantern-workflows/04-models.png`
- `docs/images/lantern-workflows/05-chat.png`
- `docs/images/lantern-workflows/06-discussion.png`
- `docs/images/lantern-workflows/07-knowledge.png`
- `docs/images/lantern-workflows/08-settings-override.png`
- `docs/images/lantern-workflows/08-settings.png`
- `docs/images/lantern-workflows/09-skills.png`
- `docs/images/lantern-workflows/10-swarm.png`
- `docs/images/lantern-workflows/11-connections.png`
- `docs/images/lantern-workflows/12-engine.png`
- `docs/images/lantern-workflows/13-dcc.png`
- `docs/images/lantern-workflows/14-assets.png`
- `docs/images/lantern-workflows/15-plugins.png`
- `docs/images/lantern-workflows/16-backups.png`
- `docs/images/lantern-workflows/17-updates.png`
- `docs/images/lantern-workflows/18-audit.png`
- `docs/images/lantern-workflows/agent-approval.png`
- `docs/images/lantern-workflows/agent-integrated.png`
- `docs/images/lantern-workflows/agent-integration-ready.png`
- `docs/images/lantern-workflows/agent-question.png`
- `docs/images/lantern-workflows/asset-awaiting-review.png`
- `docs/images/lantern-workflows/asset-configuration.png`
- `docs/images/lantern-workflows/asset-import-rejected.png`
- `docs/images/lantern-workflows/asset-imported.png`
- `docs/images/lantern-workflows/backup-configuration.png`
- `docs/images/lantern-workflows/backup-nonempty-target.png`
- `docs/images/lantern-workflows/backup-restored.png`
- `docs/images/lantern-workflows/backup-verified.png`
- `docs/images/lantern-workflows/backup-wrong-secret.png`
- `docs/images/lantern-workflows/capture-report.json`
- `docs/images/lantern-workflows/decision-before-binding.png`
- `docs/images/lantern-workflows/decision-synchronized.png`
- `docs/images/lantern-workflows/knowledge-changed-document.png`
- `docs/images/lantern-workflows/mcp-configured.png`
- `docs/images/lantern-workflows/mcp-connected.png`
- `docs/images/lantern-workflows/plugin-capability-review.png`
- `docs/images/lantern-workflows/plugin-installed.png`
- `docs/images/lantern-workflows/plugin-isolation-unavailable.png`
- `docs/images/lantern-workflows/settings-import-failure.png`
- `docs/images/lantern-workflows/settings-import-preview.png`
- `docs/images/lantern-workflows/settings-import-result.png`
- `scripts/capture-documentation.cjs`
- `scripts/documentation/asset-scenario.cjs`
- `scripts/documentation/backup-scenario.cjs`
- `scripts/documentation/capture-tools.test.cjs`
- `scripts/documentation/connection-scenario.cjs`
- `scripts/documentation/fixture-completion.cjs`
- `scripts/documentation/plugin-scenario.cjs`
- `scripts/documentation/scenario-options.cjs`
- `scripts/documentation/workflow-scenarios.cjs`

#### Worked system documentation and reusable testing Project

**Impact:** none

[Permanent work record](docs/changes/2026-10-02-worked-system-documentation.md).

##### Summary

Expand PlayWeld documentation with a worked testing Project, a handbook for every Control Room surface, service recipes, reproducible actual UI screenshots, and an explicit coverage/issue record.

##### Details

- Add Lantern Workshop tutorial with the six-step creation wizard, separate profile/layout configuration, fixture copy instructions, discussion, model/chat setup, lexical cited Knowledge search, bounded agent request example, and screenshot regeneration commands.
- Add a handbook for all sixteen surfaces, explaining inputs, records, practical use, troubleshooting, success criteria and the distinction between UI setup, task execution, integration, and acceptance. Link existing operations, architecture, API, settings, skills, integration and release detail.
- Add typed service recipes for authentication/discovery, Project creation, engine-layer inspection, lexical search and setting overrides, plus component/extension ownership and diagnostic examples.
- Add a reusable native Godot 4 source fixture and design. The fixture draws its own shapes, implements movement, three once-only collectibles, boundaries and reset. Native gameplay remains unverified; platform native-file identity is asserted. No downloaded assets, licensing obligations, credentials, identity manifests or Project databases are copied into source.
- Add a capture script that starts an isolated real service/browser backend and local explicitly labeled deterministic model provider, creates the Project through UI, verifies discussion via RPC, exercises chat, indexes/searches documents, saves/resets a setting, reads a bundled guide, previews impact and captures every surface. Capture the visible viewport of long forms. Refuse an occupied loopback port before service/UI startup to avoid connecting to an unrelated app. Provide a help-only command that does not start services or create a Project. Shut down owned resources and preserve ignored failure diagnostics. Public capture report contains no tokens/secrets/raw prompts.
- Correct user-guide claims about wizard module selection and streaming-only Chat. Add documentation-index and user-guide entry points. Correct fixture feature metadata and capture timing/input/search/impact examples during verification. Dismiss actual UI toasts for unobstructed images.
- Add coverage record with all observed corrections, remaining live verification and existing implementation gaps. All application issues/incomplete areas remain in scope under user authorization; this pass does not claim completion of the target platform or unexecuted engine/provider/installer operations.
- Compatibility: documentation/testing additions only; no public contract/schema, durable state, installed dependency, technical-identifier or release-version change; no removed functionality or migration required. Preserve other agent edits in the shared tree.

##### Validation

- Isolated capture completed 19 screenshots across all sixteen surfaces, wizard creation, native Godot file-identity assertion, persisted discussion, nonstreaming fixture chat, cited docs-only lexical retrieval, settings override/reset, bundled guide reading and path-seeded impact preview, with no uncaught renderer errors. Reviewed representative Chat, Knowledge and Engine images; viewport clipping avoids blank overflow areas. The checked-in capture report records the actual run.
- Full npx turbo run build typecheck lint test passed all 33 tasks, including both Theia app builds. Package test totals: 467 passed and 12 explicitly skipped; platform service 363 passed/11 skipped, Control Room extension 34 passed, contracts 66 passed, and the remaining four tested packages 4 passed/1 skipped. The real Godot test is skipped because no installation is available; Windows/Linux capability skips remain explicit. Real Blender fixture tests in the existing suite passed separately from this tutorial.
- npm run format:check passed. node scripts/generate-system-reference.cjs --check passed (186 requests and 75 settings). node --check scripts/capture-documentation.cjs and its --help invocation passed; explicit Prettier formatting was applied to the capture script. A bound-port failure probe confirmed EADDRINUSE is rejected before service/UI startup. scripts/check-links.sh passed through WSL with All links OK; the much slower duplicate Git Bash run was stopped after the same checker completed successfully. npm run changelog:update and npm run changelog:check -- --base HEAD passed, including regeneration/recheck after validation text updates.
- Reused installed dependencies; did not run npm ci because concurrent work uses the same dependency tree. Native Godot execution, paid generation, live model/embedding provider, backup/restore, live editor, agent implementation/integration and installer acceptance are not verified by this tutorial. No packaging or publishing performed.

##### Files

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

### Maintenance

#### Reproducible native, service and desktop documentation acceptance

**Impact:** none

[Permanent work record](docs/changes/2026-10-02-documentation-native-and-desktop-verification.md).

##### Summary

Add owned disposable runners for Godot gameplay, service extension/recovery examples, Electron smoke and fresh Unity/Unreal acceptance, repairing fixture prerequisites uncovered by native runs.

##### Details

- Godot copies Lantern Workshop before import/scripted checks, records the executable version and retains logs/report. Assertions exercise collection, repeat collection, reset, movement and bounds with an initialized headless viewport and flushed input. No graphical/export/live bridge claim.
- Service examples load a synthetic Project skill/role through real registries, cancel a worker and inspect events/notifications, recover a deliberate worker crash/checkpoint, check a shared RPC error code and reopen the owned profile without losing Project/task identity. Current-profile reopen does not certify every old-schema migration.
- Electron runner starts the built desktop with isolated profile/layout/CDP ports and anti-throttling flags, invokes established smoke tooling and terminates only its owned Electron tree/service. No installed user's profile is opened.
- Unity/Unreal runner uses established native acceptance in a unique output/profile/fixture root. Extend the established runner with an optional output override preserving its default. Fresh Unreal compilation exposed an IDE Live Coding guard; add the installed UBT-supported NoHotReloadFromIDE switch for the separate fixture compilation, without stopping another editor or changing its settings.
- Fresh Unity compilation exposed missing audio/image-conversion builtin modules used by the checked-in extended fixture. Declare their built-in 1.0.0 packages in the fixture manifest so a new copied fixture has its actual prerequisites, rather than relying on previously modified local Projects. No PlayWeld npm dependency change.
- Preserve all original failures in unique ignored run directories. Keep product/version/public RPC identifiers and user data unchanged.

##### Validation

- Godot 4.7.2.stable.official.ed1daf0bf via installed WSL: version/import/gameplay passed after viewport/input harness correction. Compact report checked in; detailed logs retained locally.
- Actual service examples passed skill/role loading, cancellation/events/notifications, crash/retry, UnknownSetting error and reopen identity checks.
- Built Electron passed all 26 established UI workflow checks with no renderer errors on an isolated profile; owned process cleanup completed.
- Real Blender connector tests passed both native checks, including Python failure classification and output/asset inspection. Fresh Unity/Unreal rerun results and final repository gate recorded below; earlier Unity compile failure retained until the fixture dependency correction is validated.
- No installer, release, production-game mutation, graphical Lantern Workshop or paid-provider verification performed.

- Fresh corrected Unity/Unreal runner completed all three stages with exit code zero, including map creation, two Unreal automation tests, two Unity EditMode tests and two PlayMode tests. Missing-filter and wrong-family negative checks passed. IPC shutdown repair has its own patch record; the fresh run exits normally. Compact engine/service/Electron reports are checked in.

- Full repository gate passed all 33 tasks; service suite passed 365 tests with 11 capability-dependent skips. Runnable capture harness regressions passed both checks; generated system references and documentation inventory passed freshness checks. Final WSL documentation links, repository format check, explicit formatting of new guides/scripts, Git whitespace check and changelog coverage/freshness all passed.

##### Files

- `docs/examples/lantern-workshop/game/acceptance.gd`
- `docs/examples/lantern-workshop/native-acceptance.json`
- `docs/examples/lantern-workshop/verification/electron-smoke.json`
- `docs/examples/lantern-workshop/verification/engine-acceptance.json`
- `docs/examples/lantern-workshop/verification/service-examples.json`
- `scripts/fixtures/engine-acceptance/unity/Packages/manifest.json`
- `scripts/live-engine-acceptance.cjs`
- `scripts/verify-documentation-electron.cjs`
- `scripts/verify-documentation-engines.cjs`
- `scripts/verify-documentation-examples.cjs`
- `scripts/verify-documentation-native.cjs`

#### Prepare version 0.5.0

**Impact:** none

[Permanent work record](docs/changes/2026-10-03-release-0.5.0.md).

##### Summary

Prepare version 0.5.0 from 0.4.0, retaining all pending work records in the changelog and detailed release notes.

##### Details

Synchronize all nine first-party workspace and internal dependency versions and refresh the npm lockfile from 0.4.0 to 0.5.0. Assign the project-selection fix and previously committed pending work records to this version and generate the detailed release notes. The minor bump follows the repository's release-preparation rule before 1.0. Existing technical identifiers, user data paths and schemas remain unchanged; no migration is required.

Build the Windows x64 NSIS installer in the new versioned output directory. No previous installer or staging directory is overwritten. This task does not create or push a release tag, publish a GitHub release, or establish installer upgrade/uninstall/rollback acceptance. The user separately authorized committing, pushing and launching the new installer; post-commit staging/launch evidence will be retained in a follow-up work record.

##### Validation

- `npm install --package-lock-only --ignore-scripts` and native Windows `npm ci --foreground-scripts`: passed. Lockfile changes synchronize first-party workspace versions without selecting new third-party versions.
- `npx turbo run build typecheck lint test --concurrency=1`: passed all 33 tasks with no cache hits, including explicit browser and Electron builds; log `.turbo/release-0.5.0-quality.log`. Existing capability-dependent test skips remain.
- `npm run test:changes`: the original run passed all 24 tests. An accidentally overlapping duplicate run timed out in the push-range test while native packaging was active. An isolated rerun of that test passed both configured-project instances (two tests, 22 unrelated tests skipped), without changing timeout settings. Logs `.turbo/release-0.5.0-tracking-tests.log` and `.turbo/release-0.5.0-tracking-timeout-rerun.log`.
- Generated RPC/settings freshness and `node scripts/check-release-version.cjs v0.5.0`: passed (186 RPC requests, 75 settings).
- `npm run format:check`: only the three unrelated untracked Kilo agent files fail. This task leaves those files untouched. `git diff --check`: passed. Release coverage checks use the previously documented process-local exclusion for those exact three files, without modifying repository ignore configuration.
- Documentation link checker: passed with `All links OK` under WSL using an ignored LF copy of the repository script.
- Rebuilt 0.5.0 browser project-selection smoke: all 17 checks passed with no renderer errors; report `.turbo/project-selection-ui/1791061027875/report.json`.
- `npm run package:win -w @gamecrafter/control-room`: passed after applying the process-local Kilo exclusion. Native verification confirms the PE Windows addon, app/service version 0.5.0, all 30 bundled skills with references, and license/notice resources. Installer: `apps/control-room/dist/0.5.0/PlayWeld-0.5.0-x64.exe`, 204492096 bytes. Authenticode status `NotSigned`; SHA-256 `cefcb4691bbc3c962e711050d1de23d362c1254390c15fd54823a5a5a43bb1a1`.
- Packaged desktop smoke: all 26 workflow checks passed with no renderer errors, using the packaged executable and its own bundled service. Report: `.turbo/release-0.5.0-packaged-electron/1791061860528/smoke/report.json`; log `.turbo/release-0.5.0-packaged-smoke-complete.log`. Earlier runs exposed asynchronous Skills loading and Engine/DCC first-project assumptions in the existing smoke harness, Engine label-suffix/DCC form-selector mistakes in its adaptation, and a Windows screenshot timeout. Retained failure artifacts are under `.turbo/release-0.5.0-packaged-electron/`. The successful owned runner uses a separate profile, Theia configuration and Electron user-data directory plus software rendering; the installed user's application settings are not the test target. This is packaged-app workflow evidence, not installer acceptance or a packaged restart test of multiple project selections.
- No Linux package, signing, stable-release acceptance, installer installation/upgrade/uninstall or rollback drill is claimed by these build checks.

##### Files

- `packages/archive-extractor/package.json`
- `packages/contracts/package.json`
- `packages/platform-service/package.json`
- `packages/plugin-sdk/package.json`
- `packages/service-client/package.json`
- `packages/theia-control-room/package.json`
- `packages/plugins/sample-hello/package.json`
- `apps/control-room/package.json`
- `apps/control-room-browser/package.json`
- `package-lock.json`
- `docs/changes/2026-10-03-release-0.5.0.md`

## 0.4.0

### Fixed

#### Adapt explicit function-tool reasoning restrictions

**Impact:** patch

[Permanent work record](docs/changes/2026-10-02-function-tool-reasoning-compatibility.md).

##### Summary

Handle a second provider compatibility restriction exposed by a real gpt-6-sol function-tool request after the completion-token fix.

##### Details

The corrected service's ordinary gpt-6-sol request returned OK, but a function-tool request failed with HTTP 400: the model requires Responses or `reasoning_effort: none` for function tools on Chat Completions. Extend the shared request negotiation to set reasoning_effort to none only when a structured HTTP 400 names that parameter, function tools and the explicit supported alternative. Remember the accepted option per account, endpoint and model, applying it only to tool-bearing requests. Token-field and reasoning-field negotiations each occur at most once, in either order; the maximum is three HTTP attempts. Unrelated errors and successful streams are not replayed. The original numeric output limit is preserved.

This uses the existing Chat Completions connector. For affected function-tool requests, provider reasoning effort is disabled; it does not implement Responses or promise provider reasoning-token support for those tool requests. No persisted model capability, routing, access policy or schema changes. A fresh version is used because the 0.3.0 testing package was already staged; its installer and evidence are retained.

##### Validation

Live source-service ordinary request to gpt-6-sol returned OK (11 input tokens, 4 output tokens). The live tool request reproduced the provider's additional restriction. New regression tests reproduced that exact rejection in streamed and complete calls before the fix, then passed after the change, including reasoning rejection followed by token rejection and remembered accepted fields. All 12 provider tests passed. After the extension, a real gpt-6-sol request returned the requested probe/check tool call with value OK (160 input tokens, 30 output tokens); a follow-up carrying a tool result returned VERIFIED (218 input tokens, 5 output tokens). The probe was not dispatched to any tool implementation and changed no project files. A real deepseek-flash request still returned OK using the legacy-compatible path (34 input tokens, 12 output tokens).

Full Turbo run completed 32 of 33 tasks successfully. The platform-service suite had 362 passing tests and 11 skips, with one existing BoardService sequence test exceeding its five-second timeout while the Windows installer was also unpacking. No board source changed. Reran that entire test file and the provider suite after installation finished: all 16 tests passed. All build/typecheck/lint tasks passed; no timeout was suppressed or assertion weakened. Formatting, generated references, whitespace and repository links passed.

Packaged, staged and installed 0.4.0 after the user approved Windows UAC. Installed service/info reported 0.4.0 and retained four projects; the running daemon executable was the installed application. Its adapter hash matched the tested and staged build. The installed service returned a real gpt-6-sol probe/check call with value OK (160 input tokens, 30 output tokens), then returned VERIFIED after the actual returned call ID and tool result were carried into the follow-up (227 input tokens, 5 output tokens). No probe implementation was executed or project content changed. Reconnected the existing CFA bridge; refreshed Vealoria project-file, headless-process and live-editor readiness all reported ready. No complete new swarm authoring/delegation task was run.

##### Files

- `packages/platform-service/src/models/providers/openai-compatible.ts`
- `packages/platform-service/src/models/providers/providers.test.ts`
- `docs/changes/2026-10-02-function-tool-reasoning-compatibility.md`

### Maintenance

#### Prepare version 0.4.0

**Impact:** none

[Permanent work record](docs/changes/2026-10-02-release-0.4.0.md).

##### Summary

Prepare version 0.4.0 from 0.3.0, retaining all pending work records in the changelog and detailed release notes.

##### Details

Synchronize first-party workspace and internal dependency versions, refresh the lockfile and package a new Windows testing installer containing both provider compatibility fixes. Retain the earlier 0.3.0 testing package and notes. No tag or publication was performed.

##### Validation

- Version progression, recorded impact and work-record coverage passed before preparation. Refreshed the lockfile with `npm install --package-lock-only --ignore-scripts`; release version agreement passed for 0.4.0.
- Build/typecheck/lint passed. Full test execution and the isolated rerun of one timed-out existing board test are recorded in the function-tool compatibility record; no timeout or assertion was weakened. Formatting, generated references, whitespace and documentation links passed before preparation.
- Windows production packaging passed. The package verifier confirmed the native addon, matching service version and 30 bundled skills. Staged installer, unpacked app and checksums under `Windows-Release/0.4.0` without overwriting earlier releases.
- The packaged provider adapter hash matches the live-tested source build: `B6433E1F0753C409FD97C7D0FF224C0F2FB82AAD66256AC5FA18A99F3B13528A`. Live source-service gpt-6-sol ordinary chat, function-tool call and tool-result follow-up passed; DeepSeek legacy-compatible completion also passed.
- Checkpointed verification-service shutdown acknowledged. After the user approved Windows UAC, the final installer completed and Windows uninstall registration reported PlayWeld 0.4.0. Installed metadata and adapter hash matched the staged build; its installer checksum matched local-build.json. Reopened the installed desktop app and verified its service version 0.4.0, four retained projects and the installed daemon executable path.
- The installed service passed a real gpt-6-sol function-tool request and follow-up response after the actual tool-call ID/result, returning VERIFIED. Reconnected Vealoria's existing CFA bridge; all three engine readiness layers reported ready. The original failed tasks remain historical evidence.
- Change-record coverage passed during preparation. The final repository-wide coverage check flags the separately and concurrently added `docs/examples/lantern-workshop/docs/DESIGN.md` as uncovered. Its contents and other concurrent tutorial additions were preserved; this release record does not claim ownership or verification of that work. The provider source/test changes are covered by their own records.
- Unsigned local Windows testing build. No signing, publication, Linux packaging, full new swarm authoring task, gameplay or multiplayer acceptance was performed.

##### Files

- `packages/archive-extractor/package.json`
- `packages/contracts/package.json`
- `packages/platform-service/package.json`
- `packages/plugin-sdk/package.json`
- `packages/service-client/package.json`
- `packages/theia-control-room/package.json`
- `packages/plugins/sample-hello/package.json`
- `apps/control-room/package.json`
- `apps/control-room-browser/package.json`
- `package-lock.json`

## 0.3.0

### Fixed

#### Adapt completion token limits for OpenAI-compatible models

**Impact:** patch

[Permanent work record](docs/changes/2026-10-02-completion-token-compatibility.md).

##### Summary

Fix models rejecting `max_tokens` with an explicit request to use `max_completion_tokens`, in both streamed and complete responses.

##### Details

The installed 0.2.0 Vealoria task `01a0feda-ed96-7039-a8a0-e82239d645a5` failed with HTTP 400, `unsupported_parameter`, `param: max_tokens`. This is separate from the earlier filesystem context overflow. The shared adapter always sent the legacy field. Preserve that field for compatible servers, but retry once using the same numeric limit as `max_completion_tokens` when an HTTP 400 structured error explicitly rejects `max_tokens` and names its replacement. Remember a successfully accepted replacement per account, endpoint and model for the provider instance lifetime. Do not retry unrelated failures, transport errors or streams after consumption. No stored schema, settings, credentials, model routing or access policy changes.

OpenAI's [official SDK documentation](https://github.com/openai/openai-python/blob/main/src/openai/resources/chat/completions/completions.py) documents the newer completion limit and the legacy field's incompatibility with reasoning models. The newer limit can include reasoning tokens; the fix retains the caller's limit rather than increasing spend automatically.

##### Validation

Regression tests first reproduced the exact HTTP 400 for streaming and non-streaming calls. After the fix, both passed, including subsequent requests using the remembered parameter, unchanged messages/tools and nonduplicated stream deltas. Three additional tests confirm unrelated authentication/parameter/error-code failures receive no retry. All 10 provider tests and platform-service typecheck passed. Full Turbo verification passed all 33 tasks, including 361 passing platform-service tests and 11 skips. Formatting, generated references, diff whitespace, work-record coverage and documentation links passed. Packaged and staged 0.3.0; the adapter hash matched the tested source build. A live source-service request to the exact failed gpt-6-sol model returned OK (11 input tokens, 4 output tokens). A subsequent function-tool probe exposed a separate reasoning-effort restriction, addressed in the function-tool reasoning compatibility record and a later testing version. Ordinary completion success does not claim swarm function-tool acceptance for 0.3.0.

##### Files

- `packages/platform-service/src/models/providers/openai-compatible.ts`
- `packages/platform-service/src/models/providers/providers.test.ts`
- `docs/changes/2026-10-02-completion-token-compatibility.md`

### Maintenance

#### Prepare version 0.3.0

**Impact:** none

[Permanent work record](docs/changes/2026-10-02-release-0.3.0.md).

##### Summary

Prepare version 0.3.0 from 0.2.0, retaining all pending work records in the changelog and detailed release notes.

##### Details

Synchronize first-party workspace and internal dependency versions. Refreshed the lockfile with `npm install --package-lock-only --ignore-scripts`. Build and stage a new Windows testing installer without overwriting 0.2.0. No tag or publication was performed.

##### Validation

- Work-record freshness, changed-file coverage, version progression and recorded impact passed before preparation. Full Turbo verification passed all 33 tasks before the version-only preparation, including 361 passing platform-service tests and 11 skips. Formatting, generated references, whitespace and documentation links passed.
- Lockfile refresh completed and `node scripts/check-release-version.cjs` verified 0.3.0. Windows production packaging completed; the verifier confirmed the native addon, service version and all 30 bundled skills. Staged the installer, unpacked app and checksums under `Windows-Release/0.3.0`.
- The packaged OpenAI-compatible adapter SHA256 matches the tested source build: `8E4BC80291F19DA08B268493E9D869B4719C021BCC8A6403343BD8BD80703397`.
- The old desktop app closed and checkpointed service shutdown acknowledged. The user approved the Windows UAC prompt and the 0.3.0 installer completed. Installed metadata and adapter hash were checked. A source-service live ordinary completion returned OK from the exact failed gpt-6-sol model, but a function-tool request exposed a separate reasoning-effort restriction. The follow-up compatibility fix uses a new testing version; 0.3.0 is not claimed to resolve that additional function-tool restriction.
- This is an unsigned local Windows testing build. No signing, publication, Linux packaging, gameplay or multiplayer acceptance was performed.

##### Files

- `packages/archive-extractor/package.json`
- `packages/contracts/package.json`
- `packages/platform-service/package.json`
- `packages/plugin-sdk/package.json`
- `packages/service-client/package.json`
- `packages/theia-control-room/package.json`
- `packages/plugins/sample-hello/package.json`
- `apps/control-room/package.json`
- `apps/control-room-browser/package.json`
- `package-lock.json`

## 0.2.0

### Fixed

#### Bound swarm file discovery and agent context

**Impact:** minor

[Permanent work record](docs/changes/2026-10-02-swarm-context-bounds.md).

##### Summary

Prevent recursive file discovery and oversized tool responses from producing multi-million-character swarm model requests. Add bounded file-list pages, generated-tree filtering, checkpoint repair and a local request-size guard.

##### Details

- Live Vealoria diagnosis found the failed model request contained a single recursive `fs/list` result of 4,164,840 characters covering 29,570 entries. The two activated skill bodies were 3,889 and 4,262 characters; all fifteen offered tool definitions totalled 7,391 characters. Skill autoactivation was limited to role skills, with additional skills activated on demand. All skills were not being loaded.
- Root cause: filesystem listing recursively enumerated the entire project, including generated engine files, caches and Git metadata. Transcript compaction excluded the six most recent messages and returned without action when all messages were recent. Thus a recent multi-megabyte tool result went directly into the next provider request.
- `fs/list` now returns up to 100 entries by default, supports `limit` (1-200), `offset` (0-100000), and `includeGenerated`, and bounds each page's serialized entries to approximately 12,000 characters. It returns explicit `truncated` and `nextOffset` metadata. Recursive descent skips .git, .gamecrafter, node_modules, Intermediate, Saved, DerivedDataCache and Binaries unless requested. Directory entries remain visible; explicit paths into those directories remain readable. Pages use deterministic sorted depth-first traversal; callers should keep the path/options fixed and expect live filesystem changes to affect offsets.
- Agent transcripts store at most 16,000 characters per tool result, with an explicit truncation marker, original size, bounded preview and guidance to request narrower data. Full tool outputs remain in the broker's durable call records. Previously saved oversized tool results are bounded when resuming checkpoints, without replaying tools.
- Before every model call, estimate the complete serialized messages and tool schemas at three characters per token, including assistant tool-call arguments. Reject oversized remaining context locally with an actionable error. The estimate is conservative for ordinary prose but is not an exact provider tokenizer or a model-specific context guarantee. Large pinned inputs are rejected rather than silently discarded. Update the setting description and generated settings references.
- Compatibility: input options and response metadata are additive; entries retain their existing shape. Consumers must follow nextOffset instead of assuming a recursive response is exhaustive. No persisted record schema, RPC method or package identifier was renamed. The new pagination behavior is recorded as minor impact.

##### Validation

- Added the multi-megabyte runtime regression before the fix: second request was 4,502,376 characters and failed the 240,000-character bound. The paging regression initially failed because its new options were rejected by the old tool schema.
- Focused runtime and broker tests passed after the changes. Further runtime coverage checks legacy checkpoint recovery without replay and local rejection of oversized pinned inputs/tool schemas.
- Replayed the exact original `{path: '.', recursive: true}` operation using the compiled builtin tool against the actual Vealoria filesystem: 100 entries, 11,215 serialized characters, truncated true and nextOffset 100, with input/output schema validation.
- `npm ci --foreground-scripts` completed on native Windows. The initial full build/typecheck run caught a widened TypeScript entry type; it was corrected before rerunning. Final `npx turbo run build typecheck lint test` passed all 33 tasks, including 95 platform-service test files with 356 passing tests and 11 skips. The runtime suite passed all 8 tests. Both Theia application builds passed.
- All 11 change-tracking tests, full formatting, generated reference freshness, version agreement, diff whitespace and local changed-file coverage checks passed. Repository-wide documentation links passed in WSL Ubuntu.
- Packaged 0.2.0 successfully; the Windows verifier confirmed the native addon, matching service version and all 30 bundled skills. The packaged runtime SHA256 matched the tested source-build runtime. Replayed the actual failed Vealoria task checkpoint through the packaged runtime with an offline completion stub: the next request was 37,366 characters, with its former 4,164,840-character file result reduced to a 13,657-character explicit preview. No filesystem operation was replayed and no provider call or production task state was changed by this measurement.
- Installed and reopened PlayWeld 0.2.0. The installed service returned bounded Vealoria filesystem pages with continuation metadata and no duplicate entries between the first two pages. Its runtime hash matched the tested package. All engine readiness layers reported ready after reconnecting the existing CFA bridge. No new paid provider request was made; the original failed task was retained.

##### Files

- `packages/platform-service/src/agents/agent-runtime.ts`
- `packages/platform-service/src/agents/agent-runtime.test.ts`
- `packages/platform-service/src/tools/builtin-tools.ts`
- `packages/platform-service/src/tools/tool-broker.integration.test.ts`
- `packages/platform-service/src/settings/definitions.ts`
- `docs/SETTINGS_REFERENCE.md`
- `docs/reference/settings-schemas.json`
- `docs/changes/2026-10-02-swarm-context-bounds.md`

### Maintenance

#### Track all repository work and release details

**Impact:** none

[Permanent work record](docs/changes/2026-10-02-complete-work-tracking.md).

##### Summary

Require permanent work records for all repository changes, generate a central changelog and detailed release notes, and enforce changed-file coverage and version impact before releases.

##### Details

- Record the user's requirement in repository instructions and the design decision log. Document the workflow in the tracking contract, template, developer/release guides, documentation index, development plan and status. Cover additions, changes, removals, refactors, tests, documentation, investigations, research, dependencies, assets, configuration and reverted work.
- Introduce permanent Markdown records with summary, complete task details, exact affected paths, category, semantic version impact, and actual validation/limitations. Track deletions and both paths of renames; protect previously committed version-assigned records from edits/deletion. Reviewers remain responsible for factual and prose completeness. Include the root changelog in the documentation link checker.
- Generate the central changelog with full-record links, and collect summaries, details and validation into future version notes. Preserve earlier authored release notes and explicitly label the incomplete historical baseline, including the missing dedicated 0.1.3 note.
- Extend version preparation to check coverage/freshness, reject reused/nonadvancing versions, enforce the highest impact, assign all pending records, and create a separate record of workspace/lockfile version changes. Breaking changes before 1.0 require at least a minor bump; schema migrations remain separate. Keep version 0.1.4 while this maintenance work is pending.
- Add full-history CI file-coverage checks for PRs/pushes, tracking regression tests and generated-output freshness. Use the generated detailed note as the GitHub draft release body. Require a finalized ledger and new tracked version before desktop packaging or Windows staging. Prepared validation may be completed before commit; later evidence uses new work records.
- Add isolated Git-fixture regression coverage for untracked paths, staged/committed ranges, renames/deletions, incomplete fields, globs, stale generation, immutable history, packaging gates, impact checks, manual bypass attempts and existing tags. No new dependencies or compatibility-identifier renames are introduced. No installer, tag or release is created by this change.

##### Validation

- `npm ci --foreground-scripts` completed on native Windows. The full Turborepo build/typecheck/lint/test run passed all 33 tasks (29 reused cached results), including Electron and browser builds.
- All 11 dedicated tracking regression tests passed against isolated Git repositories. Formatting, generated RPC/settings reference freshness, release-version agreement and full local changed-file coverage checks passed.
- The complete `scripts/check-links.sh` check passed in WSL, including the central changelog. `git diff --check` passed. A real release-gate invocation correctly rejected this pending ledger before packaging.
- Hosted CI/release wiring, native Windows packaging, Linux packaging and installer lifecycle have not been run for this maintenance change.

##### Files

- `.github/workflows/ci.yml`
- `.github/workflows/release.yml`
- `AGENTS.md`
- `README.md`
- `apps/control-room/package.json`
- `docs/DEVELOPER_GUIDE.md`
- `docs/DEVELOPMENT_PLAN.md`
- `docs/PLATFORM_DESIGN.md`
- `docs/README.md`
- `docs/RELEASE_GUIDE.md`
- `docs/STATUS.md`
- `docs/changes/README.md`
- `docs/changes/TEMPLATE.md`
- `package.json`
- `scripts/set-release-version.cjs`
- `scripts/stage-windows-release.cjs`
- `scripts/change-tracking.cjs`
- `scripts/change-tracking.test.ts`
- `scripts/check-links.sh`

#### Prepare version 0.2.0

**Impact:** none

[Permanent work record](docs/changes/2026-10-02-release-0.2.0.md).

##### Summary

Prepare version 0.2.0 from 0.1.4, retaining all pending work records in the changelog and detailed release notes.

##### Details

Synchronize first-party workspace and internal dependency versions and refresh the lockfile with `npm install --package-lock-only --ignore-scripts`. Build and stage the Windows testing installer, then upgrade the existing all-users installation after the user approved Windows UAC. No tag or publication was performed.

##### Validation

- Work-record freshness, local file coverage, version progression and recorded impact passed before preparation. Native Windows `npm ci --foreground-scripts`, all 33 Turbo build/typecheck/lint/test tasks, formatting, generated references and documentation links passed for the executable changes before the version-only preparation. Version agreement and changelog coverage passed after lockfile refresh.
- `npm run package:win -w @gamecrafter/control-room` passed. The package verifier confirmed the native addon, service version 0.2.0 and all 30 bundled skills. `node scripts/stage-windows-release.cjs` staged the installer, unpacked app and checksums in `Windows-Release/0.2.0` without overwriting an existing release.
- Upgraded `C:/Program Files/GameCrafter` using the staged installer. The user approved the UAC prompt. After checkpointed service shutdown acknowledged, the old foreground daemon remained alive; its exact executable and command line were verified before stopping that process to release the old executable. Unreal Editor remained open throughout.
- Windows uninstall registration and installed app metadata report 0.2.0. The installed agent-runtime SHA256 matches the tested and packaged runtime: `5A10E854EED3818E7A2F74982002AB97C4E813DAEAD7A7ECE43B658439BC9FBE`. Reopened the installed desktop app; authenticated service/info reported 0.2.0 and retained four projects. Reconnected the existing CFA bridge and refreshed Vealoria capabilities: project-file, headless-process and live-editor all ready.
- Installed-service filesystem discovery returned 100 entries / 11,138 characters on the first page, then 95 entries / 12,122 characters, with continuation offsets 100 and 195 and no overlap. These are serialized response sizes, including pagination metadata.
- This is an unsigned local testing installer. No signing, public release, Linux package, new paid provider request, gameplay or multiplayer acceptance was performed. The original failed task remains historical evidence; offline checkpoint recovery is described in the swarm context record.

##### Files

- `packages/archive-extractor/package.json`
- `packages/contracts/package.json`
- `packages/platform-service/package.json`
- `packages/plugin-sdk/package.json`
- `packages/service-client/package.json`
- `packages/theia-control-room/package.json`
- `packages/plugins/sample-hello/package.json`
- `apps/control-room/package.json`
- `apps/control-room-browser/package.json`
- `package-lock.json`

#### Verify and configure Vealoria's live engine setup

**Impact:** none

[Permanent work record](docs/changes/2026-10-02-vealoria-engine-setup.md).

##### Summary

Verified the installed PlayWeld 0.1.4 application against the open Vealoria Unreal 5.8.3 editor, restored a working live bridge, and corrected Vealoria's GameFeatureData startup configuration error. This is local setup and investigation evidence, with no shipped PlayWeld source change.

##### Details

- Inspected the actual desktop application, service RPC responses, running editor process, project manifest, native project, engine configuration and logs. Initial live readiness was unavailable because the bound `unreal` connection was disconnected.
- Connected the existing project-scoped `cfa-unreal` MCP connection, explicitly selected Vealoria in CodeFizz, and bound it through `engine/setLiveBridge`. Refreshed project-file, headless-process and live-editor readiness all reported ready; the bridge identified the native Vealoria project path.
- Selected Vealoria in the desktop chat Project selector and opened the Engine view. Observed a separate Swarm provider context-limit failure, left unresolved within this engine setup task.
- External project file changed: `E:/GameCrafter-Dev/vealoria/game/Vealoria/Config/DefaultGame.ini`. Added the missing GameFeatureData Asset Manager rule following installed Unreal GameFeaturesEditor source defaults and applied it to the running editor default settings. Existing asset rules remain. External evidence document added: `E:/GameCrafter-Dev/vealoria/docs/ENGINE_SETUP.md`.
- Local operational changes are persisted through the platform service and CodeFizz selection; no SQLite files were edited directly. No app/engine/plugin installation, version change, removals, public contract change or migration was performed. No maps or game assets were saved.
- Initial Python reflection attempts failed without changing settings; using native reflected property names succeeded. The first DataValidation run reproduced the original startup failure; the corrected fresh process passed.

##### Validation

- Live platform-service identity and capabilities queries against the installed app: all three engine layers ready; CodeFizz MCP negotiated 2025-11-25 and exposed 15 tools.
- Live screenshot through `engine/run` and the platform broker succeeded: run `01a0feb2-8630-7dd5-8ea8-671e6436acae`, with screenshot under Vealoria's matching `.gamecrafter/engine-runs/` directory.
- Pre-correction DataValidation run `01a0feb4-c805-72e6-94f3-bd4b26d47b2b` exited 1 with the missing GameFeatureData rule. Corrected run `01a0feb5-9f2d-7fbc-a28d-209139378943` exited 0; editor.log reports 0 errors and 1 MLAdapter warning. Only one asset was validated, so this is startup/configuration evidence, not game-content coverage.
- The current map is unsaved `/Temp/Untitled_1`. Gameplay, multiplayer, builds, dedicated server, plugin update, editor restart and game-feature activation were not tested.
- `npm run changelog:update`, `npm run changelog:check -- --base HEAD`, and `npm run format:check` passed. Code build/typecheck/lint/test was skipped because no repository executable source changed.
- Ran `scripts/check-links.sh` using Git Bash; it emitted no result and was stopped after a three-minute verification limit. Repository-wide documentation link verification is incomplete. The new record introduces no Markdown links.

##### Files

- `docs/changes/2026-10-02-vealoria-engine-setup.md`

#### Save Vealoria's initial development map

**Impact:** none

[Permanent work record](docs/changes/2026-10-02-vealoria-save-development-map.md).

##### Summary

Preserve the open unsaved Vealoria landscape as a named development map and configure it as the game's default map and editor startup map.

##### Details

- Saved the current `/Temp/Untitled_1` world through CodeFizz's native `save_level_as` command as `/Game/Maps/L_Vealoria_Development`, after checking that the destination did not exist and that Vealoria was the selected running editor. This preserves the existing landscape rather than replacing it. It remains a development map, not proof of MMORPG gameplay.
- External files changed: `E:/GameCrafter-Dev/vealoria/game/Vealoria/Config/DefaultEngine.ini` and new map/World Partition asset packages under Vealoria's Content directory. The exact generated paths are retained in `E:/GameCrafter-Dev/vealoria/docs/ENGINE_SETUP_ASSETS.md`. Updated project evidence in `E:/GameCrafter-Dev/vealoria/docs/ENGINE_SETUP.md`.
- Set GameDefaultMap and EditorStartupMap to the saved development map in configuration and the running editor settings. No engine restart, asset replacement, plugin removal or multiplayer architecture decision was made. The optional MLAdapter warning remains; no neural model was invented or configured solely to suppress it.

##### Validation

- CodeFizz save command returned success. The map file exists, and subsequent live project context reported `/Game/Maps/L_Vealoria_Development` as the open map. Editor settings inspection succeeded after an initial result-formatting error; the configuration file names both saved-map defaults explicitly.
- After explicit user approval, PlayWeld DataValidation run `01a0fec6-0a4c-7637-8916-d79a96310eb7` exited 0: 3 assets and 143 associated objects were checked, with 0 errors and the existing MLAdapter warning. The native editor remained open on the saved map. Runtime gameplay, cook/package, map reopen and World Partition streaming verification remain untested.

##### Files

- `docs/changes/2026-10-02-vealoria-save-development-map.md`

## Historical baseline

Tracking starts after local version 0.1.4. Earlier notes are preserved as historical evidence, not reconstructed into a complete work ledger:

- [0.1.4: PlayWeld identity and artwork](docs/releases/v0.1.4.md).
- 0.1.3: no dedicated release-note file exists at the tracking baseline; details are incomplete.
- [0.1.2: forms, model selection, chat and layouts](docs/releases/v0.1.2.md).
- [0.1.1: testing packages and platform work](docs/releases/v0.1.1.md).

These version labels do not imply public tags or published releases.

# PlayWeld project review, 2026-10-24

Follow-up: [security remediation and documentation reconciliation](changes/2026-10-24-security-remediation.md) records later fixes. The findings, advisory counts and proposed actions below retain the original pre-fix snapshot; they are not a current open-issue dashboard.

Review snapshot: `7ccb07580d82164d16f63c6ce5404b81a754f1e6`, initially clean local checkout, matching GitHub `main`. Review date uses America/Phoenix. This is an investigation, not a repair or release. Findings below do not change work-package statuses, confirmed requirements, or product decisions. Dependency ordering remains exclusively in [the development plan](DEVELOPMENT_PLAN.md).

## Assessment

The repository implements a substantial local game-development workspace, with typed service contracts, durable task state, brokered tool permissions, plugin isolation, engine/DCC connectors, and unusually extensive acceptance records. Its main weaknesses are an actionable Windows file-opening boundary, newly accumulated dependency advisories, release trust/lifecycle gaps, contradictory current-status prose, and incomplete acceptance across external systems. A passing source gate cannot settle those boundaries.

The review combined parent source inspection with independent offline security and architecture reviewers. The security scan is a selected-surface audit with partial repository coverage; no claim is made that all 1,304 inventoried files were audited. Ignored private configuration, ordinary runtime profiles and credentials were left unread. No GitHub settings, alerts, issues, pull requests, installations, engines, providers, or product code were changed.

## Security findings and triage

| Observation | Evidence and implication | Recommended disposition |
| --- | --- | --- |
| Windows default asset opener passes Project filenames to an explicit command interpreter. | `packages/platform-service/src/assets/external-open.ts:11-28,44-46`; the asset UI and `AssetService.openInAuthoringTool` reach this path. Filesystem containment does not make shell syntax safe, and `shell: false` does not neutralize an explicitly invoked interpreter. Independent baseline and parent source review agree. | Confirmed source-backed command-injection finding, medium severity: requires Windows, default opener, attacker-controlled existing filename, compatible pathname and user open action. Use an OS path-opening API that treats filenames as data; add Windows adversarial filename coverage. No payload was executed. Detailed evidence remains in the private Codex Security scan. |
| Dependency risk has changed since the old zero-high/critical audit. | Fresh `npm audit --json`: 22 vulnerable-package entries, one critical, 13 high, six moderate, two low. DOMPurify, Electron, MCP SDK, HTTP middleware, Markdown parsing and development tools appear. | Separate runtime from development exposure and verify actual consumer options before assigning application severity. Preserve exact dependency pins and the single-version Theia constraint. Avoid automatic incompatible downgrade suggestions. |
| Production-only audit has a different propagated count. | `npm audit --omit=dev --json`: 48 package entries, 37 critical, seven high, four moderate. DOMPurify propagates its severity through Theia's dependency graph. | These are not 37 independent critical application vulnerabilities. Retain both audit scopes and investigate the underlying advisory families. |
| GitHub scanners have outstanding work. | Live API: 11 open Dependabot alerts (four high, seven medium), 12 open CodeQL alerts (nine high, three medium), zero open secret-scanning alerts. | Alert counts are tool observations, not validated exploit counts or proof of absence of secrets. No alert was dismissed. |
| Several CodeQL alerts have material counterevidence. | Vector registry SHA-256 is an in-memory cache identity, not a password verifier. A2A has invalid-token/client/public rate buckets and concurrency limits. Provider slash regex inputs are owner-configured URLs. S3 decoded archive names are checked against an archive-name whitelist. The generator sanitizer formats trusted contract Markdown; the S3 regex alert is in a fixture. | Triage individually and record source rationale through a separate authorized change. Do not mechanically weaken controls or dismiss all alerts together. |
| Google Drive query escaping is incomplete. | `backup/destinations/google-drive.ts:121,175` escapes quotes but not preexisting backslashes. Folder ID is owner configuration; archive names are restricted and lookup filters exact names. | Robustness correction warranted. This review did not establish an untrusted configuration boundary that makes it an exploitable authorization failure. |
| CI token permissions are implicit in some workflows. | CI and Windows probe lack explicit `permissions`, but the live repository default is read-only and workflow PR approval is disabled. Release grants `contents: write` at workflow scope. | Add explicit least-privilege declarations and narrow publication write access to the release job. Current defaults are relevant counterevidence to the scanner warning. |

Positive source controls include authenticated IPC, captured Project/access ceilings in the external IDE adapter, scoped/revocable inbound A2A tokens, role checks and broker approvals, realpath containment, encrypted credential records, fail-closed unavailable plugin isolation, rejection of unsupported host allowlists, update digest verification, and signature-required automatic Windows installer handoff. These controls were inspected in source; this review did not requalify their installed execution.

## Repository settings and active work

Read from GitHub on the review date; no settings were mutated.

| Surface | Current state | Assessment |
| --- | --- | --- |
| Repository identity | Public `scarecr0w12/PlayWeld`, Apache-2.0, default `main`, homepage `playweld.com`. | Consistent with public identity; GameCrafter technical/package/storage identifiers remain intentional compatibility surfaces. |
| Main ruleset | Active `main-security-quality`, ID 25797382; blocks deletion/force-push; requires PR and resolved review threads. Requires Linux quality, Windows quality and browser build. | Useful baseline. Zero approving reviews and administrator bypass only through PRs are explicit settings, not two-person review. Up-to-date branches and CodeQL are not required. |
| Actions | Local/GitHub-owned actions plus `softprops/action-gh-release@*`; all external contributors require approval. Default token read-only; workflow PR approval disabled. | Existing controls are enabled. Actions are mutable major-version tags and SHA pinning is not required; pinning exact reviewed commits would improve supply-chain reproducibility. |
| Scanners | CodeQL default setup configured for JS/TS and Actions, default query suite, remote threat model, weekly schedule. Dependabot security updates, secret scanning and push protection enabled. | Scanner completion is not vulnerability remediation. Local IPC/plugin trust boundaries need manual review in addition to a remote threat model. |
| Proposed policy | [PR #8](https://github.com/scarecr0w12/PlayWeld/pull/8) adds `.github/SECURITY.md`, weekly Actions-only Dependabot updates and its work record. Its settings changes are already live; files are not on reviewed `main`. | Treat proposed files separately from active repository configuration. Do not duplicate concurrent work. |
| Existing dependency PRs | [PR #7](https://github.com/scarecr0w12/PlayWeld/pull/7) updates Vite; [PR #1](https://github.com/scarecr0w12/PlayWeld/pull/1) updates Electron. At inspection, #7 browser build passed and both quality jobs failed. | Investigate failed check causes and required work-record coverage before merging; this review did not diagnose those failures. |
| Release | Latest public release remains testing prerelease `v0.21.0`; source/local deployment records say `0.22.0`. | Source, installed and published versions are separate facts. No current installed version was queried. |
| Other hygiene | Automatic merged-branch deletion disabled; auto-merge disabled; wiki enabled. | Optional contributor hygiene choices, not demonstrated security vulnerabilities. |

The GitHub connector supported repository/rules/check reads. Its approved endpoint surface did not expose all security/admin reads, so authenticated read-only `gh api` supplied scanner alerts, Actions defaults, and security settings. No credential values were printed.

## Documentation consistency

Generated references and evidence inventories are current: 198 RPC requests, 28 notifications, 85 settings, 27 RPC families, 26 service subsystems and 16 Control Room surfaces. The inventory/evidence check validates files and report structure, not the accuracy of all prose or live-system acceptance.

Concrete contradictions require reconciliation in the existing authoritative documents:

- `STATUS.md` section 4.2 says everything listed remains fake-tested and asks for a live OpenAI-compatible endpoint, while its snapshot and acceptance records already document live OpenAI completion/stream/tool/embedding checks and a Meshy operation. Keep remaining provider/operation-specific debt, rather than a blanket no-live-provider claim.
- `STATUS.md` still asks to rerun expanded hosted Windows quality, while exact-head `main` check results show all three CI jobs passed in run 39207168381. Historical limitations should be explicitly dated.
- `DEVELOPMENT_PLAN.md` WP0 says hosted CI has never run; several work-package descriptions also retain broad earlier no-live claims. These disagree with later accepted evidence. Correct them without upgrading unverified operations.
- `PROGRAM_REVIEW.md` and `FULL_PROJECT_REVIEW.md` are dated historical receipts. Their old vulnerability counts, AppContainer limitations and live-provider limits must not be read as current state. Preserve the receipts and improve navigation/current-status qualification.
- Large append-only historical sections inside the living status record obscure the current answer. Keep a concise current capability/evidence matrix and point to permanent dated records; do not discard historical evidence.
- The shell link checker repeatedly launches text-processing subprocesses per Markdown line and recomputes headings per link. Its full Git Bash run had not completed after several minutes; a WSL attempt was also slow. A read-only Python check using the same link/fence/slug rules with cached headings checked all 351 Markdown files and 1,455 relative links with zero errors. Improving the existing checker's implementation would reduce contributor and CI overhead; no checker source was changed.

This review records the discrepancies without changing design decisions or package status. A consistency repair should use the repository's design-document skill and update linked owners together.

## Incomplete features and acceptance gaps

The plan lists WP0-WP18 and WP20 implemented, with WP19 in progress. Implemented means repository test evidence, not complete target-system acceptance. A scan found no substantive TODO/FIXME markers in current application source; actual gaps live in explicit capability behavior and the decision/status records.

| Area | Remaining work or decision | Boundary to preserve |
| --- | --- | --- |
| Release and recovery | Public update trust-key provisioning, signed hosted publication, real uninstall/update/rollback drills, supported platform acceptance. Issue #3 tracks disposable-host Windows uninstall/rollback. | Local upgrade evidence and unsigned package checks do not complete WP19. |
| Plugins and extensions | Plugin signature verification/unsigned trust policy; enforceable outbound host allowlists; Linux Landlock/seccomp layering; broader Windows process/network/OS qualification; Theia extension privilege policy. | Restricted unavailable isolation fails closed; configured MCP subprocesses have different authority from sandboxed plugins. |
| Providers and routing | Broader real provider coverage, media/cancellation details, calibrated decision-model judgments, measured routing gains, metadata refresh cadence, cross-Project learning/privacy, spend-period policy. | Keep selected OpenAI live evidence; do not generalize it to every adapter. |
| Assets and DCC | Broader Meshy/Tripo operation/credit/conversion coverage, texture-channel inspection, live non-Blender DCC tools and community bridges. | One generation/import or headless Blender check is operation-specific. |
| Engines, MCP and A2A | Broader versions/OS/targets, community protocol matrix and Docker HTTP mapping, full real A2A interoperability/recovery. | Existing managed bridge and fixture acceptance should remain identified by exact operation/environment. |
| Backups and durable state | Live S3/FTP/Drive qualification, larger recovery matrix, S3 multipart, in-place restore semantics, corruption recovery, audit retention/export and plugin setting migration. | Native local restore evidence does not prove remote destinations or a full disaster-recovery lifecycle. |
| Swarm and canon | Binary-conflict resolution, lower-priority preemption, fine-grained proposal diffs, broader canon reconciliation, external-action idempotency/rollback. | Do not expand task authority or repeat uncertain paid/destructive effects. |
| Product and UI | Existing-game onboarding, creative ambiguity criteria, canon authority/retcons, restore semantics, navigation/clone/approval grouping, accessibility and localization. | User-owned product decisions remain open; engineering review does not confirm them. |
| Quality and maintainability | Explicit acceptance/performance matrix, resource ceilings, community conformance, deeper rendered action coverage, clearer app-task skip accounting. | Electron uses `echo skip` for typecheck/lint/test; the browser package has no such scripts. Extension checks and actual app builds carry separate evidence. |

Large coordination files (`service.ts`, connector service, connection manager, backup service, router and A2A services) are useful candidates for focused ownership/refactoring when a concrete change needs them. File size alone is not a defect or a reason for a broad rewrite. Existing service-side durable ownership should be retained.

## Validation and limits

The initial `npx turbo run build typecheck lint test --concurrency=1` passed 33/33 tasks, all from cache. `npx turbo run test --force --concurrency=1` then passed 15/15 tasks without cache, with 888 tests passing and seven skipped across 180 files. The platform service contributed 679 passes and six skips; archive extraction contributed one pass and one skip. Skips include OS/symlink/capability-dependent cases and an unavailable native Godot executable. The managed native Qdrant test ran successfully. Electron's placeholder test task did not execute application tests.

Formatting, generated RPC/settings/inventory checks, documentation-evidence integrity and release version agreement passed. Changelog generation/coverage and diff whitespace checks passed. The repository shell link checker was attempted through Git Bash and WSL, then stopped after extended execution without a result; the equivalent cached full-scope link check passed as described above. Final documentation and tracking results are recorded in the accompanying [work record](changes/2026-10-24-project-session-review.md). Local command logs and audit JSON are under `.turbo/session-review-2026-10-24-*` and are ignored, machine-local evidence. The completed private Codex Security scan is `5d1d271e-6078-48a7-8f6d-d9f0e64dba6f`; it retains the original source snapshot and correctly warns that review-document/changelog additions changed the working tree during analysis. Application source remained unchanged.

No dependency installation was performed: existing dependencies and native modules were preserved for this review. No fresh desktop/browser interaction, Linux application test run, provider call, engine/DCC mutation, packaging, installer operation or exploit payload was performed. The independent security scan retains partial coverage and unanswered questions about Windows ACLs, full MCP redirect handling, Theia backend authentication, backup resource ceilings and trust-key provisioning. These limits prevent an exhaustive or production-security claim.

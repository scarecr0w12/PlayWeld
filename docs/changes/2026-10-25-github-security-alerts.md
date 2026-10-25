# Reconcile GitHub security alerts and bound A2A authentication work

**Release:** Unreleased

**Impact:** patch

**Category:** Security

## Summary

Review live GitHub dependency/code/secret-scanning alerts, verify pending dependency fixes against every open advisory, close a pre-authentication rate-limiting gap and prepare the accumulated reviewed work for commit and push.

## Details

- Read the authenticated GitHub alert APIs on 2026-10-25: 14 open Dependabot alerts, 12 open CodeQL alerts and zero open secret-scanning alerts. These are observations of the default branch, not counts of independently exploitable vulnerabilities. The installed GitHub connector lacks alert endpoints, so use the authenticated GitHub CLI for those reads. Preserve scanner settings and do not treat a clean npm result as proof of application security.
- Compare every installed-lockfile package entry for each open Dependabot alert against the API's vulnerable semver range. All entries are outside the affected ranges, using the already-pending exact dependency remediation; no additional dependency change or forced audit fix is needed. Coverage: alerts 54/45 use markdown-it 14.3.3; 53/52 use follow-redirects 1.16.1; 49/48/47/46/44/43 use MCP SDK 1.32.1; 42 uses Hono 4.13.13; 41/40/39 use Vite 8.3.4. Check full and production-only npm audits independently. The newly observed markdown-it/follow-redirects advisories are supported by the [GitHub markdown-it advisory](https://github.com/advisories/GHSA-vfgh-jcmw-g37q) and [follow-redirects advisory](https://github.com/advisories/GHSA-8r9p-f939-6h3c); live alert ranges supply the per-alert comparison.
- Recheck the twelve CodeQL locations. Pending source changes correct workflow permission defaults (1-3), the S3 fixture regular expression (4), provider trailing-slash scans (5-6), S3 one-pass XML entity decoding (7), Drive query quoting (8-9) and generated Markdown escaping (10). Preserve those independent work records and tests. Do not claim remote closure from local changes; GitHub's analyzed default-branch commit initially remains `4ed697edfa09a11368581c15f7ea90e5cc739e1a`.
- Alert 11 flags authentication before a recognized limiter. Existing invalid-token responses and per-client quotas were present, but the credential database lookup still ran on every well-formed invalid token before the invalid-token quota returned HTTP 429. Add an aggregate 1,200-request fixed-minute source-address budget before parsing/authentication. Exhaustion now returns HTTP 429 before any credential query, including for valid tokens, until the minute resets. Retain the separate 120-request invalid-token and per-client budgets, public Agent Card limit, concurrency limits, loopback/Host/Origin boundary and authorization checks. Only the actual socket address keys the new budget; forwarded headers do not influence it. This is a bounded shared ceiling, so abusive loopback traffic can temporarily throttle valid clients from that source; no unlimited-availability claim is made. This implements the [CodeQL recommendation to limit expensive handler work](https://codeql.github.com/codeql-query-help/javascript/js-missing-rate-limiting/).
- Add an HTTP regression with rotating syntactically valid invalid credentials, an exhausted-ceiling valid request that performs no database preparation, and successful authenticated access after the clock crosses the one-minute boundary. Preserve the existing regression proving 121 malformed unauthenticated requests do not consume a valid client's quota. The first sequential probe timed out before reaching its assertion; batch twenty requests at a time to exercise the same boundary within the original timeout, without increasing it. The corrected probe fails on the old implementation with HTTP 200 instead of 429, then passes with the limiter.
- Alert 12 treats SHA-256 over vector adapter configuration/API-key material as password storage. Trace the value to the in-process adapter cache and persistent collection-mapping namespace: it is a deterministic identity, never a password verifier or authentication decision. Preserve that identity format so existing collection mappings continue to resolve. Add an explanatory source comment and a regression proving identical credentials reuse the handle, rotation selects a distinct handle/identity, and the identity contains a hexadecimal digest rather than the literal fixture key. The fixture creates adapter handles without contacting Qdrant. This evidence supports a false-positive disposition for that specific password-hashing rule, not a claim that arbitrary credential handling is secure.
- Dismiss CodeQL alert 12 as `false positive` with the scoped cache-identity rationale after source tracing and regression verification. GitHub readback confirms the dismissal; the first overlong rationale was rejected by the API's 280-character limit and made no change, then the shorter rationale succeeded. Do not dismiss Dependabot alerts or the A2A finding to substitute for patched source and fresh hosted analysis. Open CodeQL count becomes eleven; the initial twelve-alert observation remains historical evidence.
- Update the architecture and current status with the limiter behavior and hosted/local evidence distinction. Preserve the retired executable-generating opener fixture and endpoint-protection recovery boundary: do not rerun that fixture, compile installer fixtures or mutate ordinary engine/DCC projects for this pass. Keep Bitdefender enabled, with no exclusions or quarantine changes.
- The final generated-inventory check initially found the retired native opener still listed as a current regression path, causing the documentation-evidence checker to fail as well. Regenerate both inventory artifacts from current source to remove that obsolete entry; preserve historical work-record references and leave the evidence checker's assertions intact.
- The staged whitespace check additionally detected extra blank lines at EOF in three pending security records that the earlier unstaged check did not include. Normalize those endings before committing; preserve their historical findings, validation and file lists.
- The remote security-policy PR 8 merged after this branch's starting commit. Preserve its private-reporting policy, Actions Dependabot schedule and permanent work record when incorporating current main. Existing dependency-update PRs remain independent; newer optional action/dependency versions are not automatically treated as security fixes. Commit/push authorization covers this session's accumulated reviewed security, documentation, plugin migration, Requests, audit export/retention and service-log work, each retaining its separate permanent record. No release or main-branch merge is authorized by this task.
- Compatibility/migration: HTTP overload behavior changes only at the new aggregate ceiling; valid callers can receive 429 during a source flood. No setting, RPC schema, credential format, vector identity, Project/profile schema, dependency version or data migration changes in this follow-up. Impact is patch for the A2A security correction; version stays 0.22.0 pending.

## Validation

- Live Dependabot range comparison passed all 14 alerts with no affected local lockfile paths. `npm audit --json` and `npm audit --omit=dev --json` both exited zero with zero vulnerabilities. Evidence: `.turbo/github-dependabot-open.json`, `.turbo/github-alerts-audit.json` and `.turbo/github-alerts-audit-production.json`.
- The batched authentication regression failed on the old implementation with HTTP 200 instead of 429; the earlier sequential timeout is not a successful reproduction. Evidence: `.turbo/github-security-auth-ceiling-red-batched.log` and `.turbo/github-security-auth-ceiling-red.log`.
- Seven focused service files passed 42 tests after the limiter, including A2A, vector registry, provider/backup/SDK and mocked opener. The additional cache-identity regression then passed with all five vector-registry tests. Evidence: `.turbo/github-security-focused.log` and `.turbo/github-security-cache-identity.log`.
- `npx turbo run build typecheck lint --concurrency=1` passed 25 tasks (17 cached) after the final production changes, including Electron/browser builds. The existing installer-handoff require-resolution warning remains; app-shell placeholder checks still report skip. Other workspace tests passed 14 tasks (12 cached). Evidence: `.turbo/github-security-final-quality.log` and `.turbo/github-security-other-tests.log`.
- Broad service verification, record/reference checks, main integration and remote readback are in progress. The service suite explicitly excludes `src/updates/installer-handoff.test.ts` and `src/dcc/blender-real.test.ts`; the removed native opener is absent. No complete unexcluded full gate, native opener, installer, live DCC/engine/provider or security-product false-positive adjudication is claimed.

## Files

- `packages/platform-service/src/a2a/inbound-server.ts`
- `packages/platform-service/src/a2a/inbound-server.test.ts`
- `packages/platform-service/src/knowledge/vector-store-registry.ts`
- `packages/platform-service/src/knowledge/vector-store-registry.test.ts`
- `docs/TECHNICAL_ARCHITECTURE.md`
- `docs/STATUS.md`
- `docs/reference/DOCUMENTATION_INVENTORY.md`
- `docs/reference/documentation-inventory.json`
- `docs/changes/2026-10-24-security-dependencies.md`
- `docs/changes/2026-10-24-security-remediation.md`
- `docs/changes/2026-10-24-workflow-security.md`
- `docs/changes/2026-10-25-github-security-alerts.md`

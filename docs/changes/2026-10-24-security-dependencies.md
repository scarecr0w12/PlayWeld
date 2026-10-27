# Refresh vulnerable dependency lines without changing Theia

**Release:** 0.23.0

**Impact:** patch

**Category:** Security

## Summary

Refresh exact dependency and transitive override pins to remediate the reviewed npm advisories while retaining the directly declared Theia application/extension packages at 1.75.0 and keeping the product version at 0.22.0.

## Details

- Pin Electron 42.11.18 consistently in the desktop manifest and root override, DOMPurify 3.4.17, MCP SDK 1.32.1 in both the service dev dependency and global override, and serializer 7.1.3. Raise the existing SDK security-version regression floor to 1.32.1; refresh the Theia development skill's Electron reference.
- Upgrade Vitest to 5.0.5 and Puppeteer/Puppeteer Core to 25.14.0, aligning Theia CLI's transitive Puppeteer with the same direct dependency. Update the exact allowed install-script entry for Puppeteer. Select Vite 8.3.4 to close the vulnerable 8.3.0-8.3.2 line without adopting the newer 8.3.5 candidate in a concurrent dependency PR.
- Pin patched transitive lines: body-parser 1.20.9 and 2.4.0 by major selector, fast-uri 3.1.9, follow-redirects 1.16.1, Hono 4.13.13, ip-address 10.7.4, markdown-it 14.3.3, multer 2.5.0, and Undici 6.29.1/7.30.1 by major selector. Preserve both body-parser and Undici API generations rather than globally replacing them with another major.
- Pin Zod 4.6.7 after updating Puppeteer/Chromium BiDi and SDK consumers to versions declaring Zod 4 compatibility. This removes the vulnerable Zod 3 parser without overriding an unchanged Chromium BiDi consumer that required Zod 3. Retain existing local braces/sprintf-js security patches and the archive extractor seam.
- Verify registry release dates using `npm view` and registry metadata. Prefer versions at least seven days old; explicit security exceptions are Electron 42.11.18 (October 21), serializer 7.1.3 (October 22), body-parser 1.20.9/2.4.0 and multer 2.5.0 (October 22), and fast-uri 3.1.9 (October 19). Older available versions in those lines still matched reviewed advisories; the seven-day rule is a preference, and retaining known affected versions would not complete remediation.
- Update the lockfile, then use a clean `npm ci --foreground-scripts`; exact pin changes alone initially left old transitive lock entries, so perform a targeted lockfile update before installation. No `npm audit fix --force`, Theia downgrade, product-version preparation, ordinary profile change or installer publication occurs. Concurrent dependency PRs are neither edited nor merged.
- During iteration, SDK 1.32.2 and serializer 7.1.4 were initially selected. Prefer the already-aged SDK 1.32.1 and the minimal patched serializer 7.1.3 after checking advisory ranges. Incremental installation left one old root SDK copy despite the new override; a targeted update plus a second clean install corrected it. Final `npm ls` has no invalid dependency and resolves both service and Theia MCP consumers to SDK 1.32.1 with Zod 4.6.7. These intermediate versions are not the final pins.
- Compatibility and migration: dependency-only runtime/tooling changes, no application/RPC/storage version change or data migration. Native modules are reinstalled/rebuilt for verification. Impact `patch` reflects shipped security dependency corrections; a future release must still follow normal version preparation.

## Validation

- Clean `npm ci --foreground-scripts` passed, including the retained local patches. Full `npm audit --json` and production-only `npm audit --omit=dev --json` both report zero vulnerabilities, compared with the review's 22 and 48 affected-package entries. Audit results are registry snapshots, not proof that application-level vulnerabilities are absent.
- Focused provider, SDK, backup and opener verification passed 53 tests with Vitest 5.0.5. The final full Turbo gate passed 33/33 tasks with 21 cached; the platform suite reran and passed 702 tests with six capability/OS skips. Both Electron and browser application builds passed. All directly declared Theia application/extension dependencies remain exactly 1.75.0. No packaged or installed Electron upgrade is claimed.
- Start the built browser on loopback port 3127 with separate `.turbo/security-remediation-ui-profile` and config directories. The first smoke reached seven successful UI checks with no renderer errors, then its direct RPC client used the default pipe because the smoke process lacked the server's profile variable; it failed with `ENOENT` before that direct RPC operation. Repeat with matching isolated profile/config environment: 33 rendered checks passed with zero renderer errors, including Project creation/opening, settings export/import, Models layout, skill reading, audit and backend disconnect survival. Retain the failed attempt and successful retry separately; no application patch was needed for the harness configuration error.
- Final logs and screenshots are machine-local under `.turbo/security-remediation-*`; the successful rendered report is `.turbo/security-remediation-ui-retry/report.json`. These disposable-profile browser checks do not prove packaged Electron behavior, an installed upgrade, publisher trust, arbitrary provider/engine interoperability or production readiness.
- Stop the task-owned browser server after verifying its recorded PID owns port 3127, then stop the isolated service through its supported CLI. Cleanup readback reports `not running` and no listener on 3127. Retain disposable fixtures/evidence; ordinary installed application/profile data is not stopped or modified.

## Files

- `package.json`
- `package-lock.json`
- `apps/control-room/package.json`
- `packages/platform-service/package.json`
- `packages/platform-service/src/dependencies/mcp-sdk-version.test.ts`
- `.agents/skills/theia-app-dev/SKILL.md`
- `docs/changes/2026-10-24-security-dependencies.md`

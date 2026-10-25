# Correct asset-opening and input-interpretation security boundaries

**Release:** Unreleased

**Impact:** patch

**Category:** Security

## Summary

Replace the vulnerable Windows default asset opener with literal-path launch, reject configured Windows shell-command modes, and correct input-normalization weaknesses identified during the project review. Broader feature work remains outside this task.

## Details

- The previous Windows default appended an existing Project asset pathname to `cmd /c start`, allowing legal filename metacharacters to become command syntax after a user open action. Preserve realpath/existence/Project containment, but pass the canonical pathname only through a dedicated child environment value to fixed `Invoke-Item -LiteralPath` code. Use the system Windows PowerShell executable, disable profiles/interaction, hide its helper window, and keep the helper attached until its bounded completion. A nonzero exit, startup error or ten-second timeout reports `launched: false`; configured application launch retains its existing spawn-based result.
- The Windows default relies on the documented [Invoke-Item literal-path/default-action contract](https://learn.microsoft.com/en-us/PowerShell/module/microsoft.powershell.management/invoke-item?view=powershell-5.1), verified here with a real benign executable fixture rather than assuming command-array separation alone proves native launch behavior.
- Reject configured `cmd`/`command.com` and PowerShell command-string modes before appending filenames. Require explicit PowerShell `-File` with a script and documented safe pre-file options; a later `-File` inside `-Command` text cannot bypass this check. Ordinary applications, fixed arguments, quoted paths, Node shebang scripts, and macOS/Linux defaults retain their argument behavior. Abbreviated/other PowerShell modes must be rewritten to explicit file mode; no persisted setting is silently changed.
- Add mocked boundary/error/timeout/path tests and a native Windows regression that compiles a benign windowless fixture, opens literal metacharacter and space/Unicode executable names through the real default helper, and verifies the exact launched pathname. The test opens no authoring application and executes no injected shell payload. Initial red tests exposed the old `cmd` boundary and incorrect helper-success reporting; an initial .NET helper attempt returned `EPERM`, and a detached helper did not launch the native fixture. The final supported literal-path helper passes the native launch checks without detachment. These discarded attempts are not shipped implementations.
- Escape Drive query backslashes before quotes in both list and exact-file lookup. A fixture parses the returned query literal for list/get/delete to prove the configured folder value round-trips. This addresses robustness without promoting the original owner-configured query warning into a demonstrated authorization exploit.
- Decode S3 XML entities in one pass so decoded text is not interpreted as another entity. Verify the nested-entity result and retain archive-name rejection before download. Anchor the fixture's SigV4 authorization parser to its fixed scheme to remove repeated unanchored searches; real signature verification remains intact.
- Replace the provider trailing-slash backtracking expression with a linear scan shared by endpoint construction and OpenAI response eligibility. Preserve ordinary and all-slash/empty values; exercise a 100,000-slash input. Escape backslashes before Markdown table delimiters in generated-reference formatting; current schema/reference bytes remain unchanged.
- Use one independent pre-patch boundary/compatibility investigation and one independent candidate review. The latter found no concrete bypass/regression and identified intentional PowerShell-option restrictions for documentation. Add support for safe `-Sta`/`-Mta` switches while retaining explicit file-mode validation.
- Triage all twelve reviewed CodeQL alerts: the Drive/S3/provider/generator/fixture patterns above and the three workflow permission declarations are corrected in source. The vector-store SHA-256 alert refers to a cache identity rather than password authentication; the A2A limiter alert has existing source-backed rate/concurrency controls and a passing unauthenticated-quota regression. Do not weaken those controls or add inappropriate slow password hashing to a cache key. No remote alert is dismissed or claimed cleared; fresh hosted analysis and formal disposition remain separate from these local fixes.
- Compatibility: RPC/result/error schemas, Project data, filenames and product version remain unchanged. Existing shell-command authoring settings now fail closed with an actionable error and need the documented application/script-file rewrite; no data migration or automatic settings edit occurs. Impact `patch` reflects a security fix with this explicit configuration restriction. The original sealed security scan remains an immutable pre-fix snapshot.
- Related work: [dependency remediation](2026-10-24-security-dependencies.md), [workflow hardening](2026-10-24-workflow-security.md), and [documentation reconciliation](2026-10-24-documentation-reconciliation.md) are tracked separately. Signed publication, plugin signature/egress policy, installer lifecycle and broad live acceptance remain open.

## Validation

- Initial opener regression: five failures/six passes, including one corrected test expectation; the actual Windows/default and helper-error regressions failed on the old implementation. Subsequent focused opener run: 19 passes, including the real Windows literal-filename fixture. The final eight-file focused run passed 53 tests, including the added timeout regression, configured-mode rejection, literal filename launch and the nearest existing asset/provider/backup/SDK cases.
- Narrow typecheck passed. The initial eight-file run's native-helper failure was investigated and corrected as described above. Final `npx turbo run build typecheck lint test --concurrency=1` passed 33/33 tasks (21 cached); the owning platform suite reran with 702 passes/six skips, and aggregate package results cover 911 passes/seven skips across 182 test files. An earlier combined run passed all 33 tasks uncached. Electron/browser builds passed; Electron's placeholder lint/typecheck/test tasks remain explicit skips rather than application-test evidence. Generated references/inventory/evidence, version, workflow assertions, formatting, links, changelog coverage and diff whitespace checks passed.
- Source review and benign fixture execution do not establish all application security, supported-OS qualification, packaged/installed behavior, real remote backup operation or provider compatibility. No ordinary Project/profile, credential or paid provider was used. Automated package suites also run disposable native Blender and managed Qdrant fixtures when available; these are separate from ordinary user Projects or fresh broad integration acceptance. The earlier session review wording that no DCC operation occurred was too broad: its own retained test log includes two real Blender fixture checks. This record corrects that qualification without rewriting the original dated review receipt.

## Files

- `packages/platform-service/src/assets/external-open.ts`
- `packages/platform-service/src/assets/external-open.test.ts`
- `packages/platform-service/src/assets/external-open.windows.test.ts`
- `packages/platform-service/src/backup/destinations/google-drive.ts`
- `packages/platform-service/src/backup/destinations/google-drive.test.ts`
- `packages/platform-service/src/backup/destinations/s3.ts`
- `packages/platform-service/src/backup/destinations/s3.test.ts`
- `packages/platform-service/src/models/providers/http-utils.ts`
- `packages/platform-service/src/models/providers/http-utils.test.ts`
- `packages/platform-service/src/models/providers/openai-compatible.ts`
- `scripts/generate-system-reference.cjs`
- `docs/changes/2026-10-24-security-remediation.md`

# Diagnose canon delegation and persist agent diagnostics

**Release:** 0.6.0

**Impact:** minor

**Category:** Fixed

## Summary

Repair discussion-board tool availability in Ask always Projects, prevent delegation blocked by the parent's locks, and add persistent service logging and read-only task diagnostics.

## Details

- Live installed 0.5.0 service inspection identified the reported lock holder as the coordinator parent of the waiting game-designer child, rather than proving a duplicate root request. The parent owned six canon paths. The child role has file-read permissions only; its offered tool list also lacked the board tools because their minimum access gate rejected Ask always. Later narrative children received write tools but encountered missing directories and a budget failure. Private goal text and raw tool inputs are not retained in this record.
- Remove the board tools' minimum-access gate while preserving role checks, normal access policy and approval requirements for posts. Read-only roles do not gain file-write permission. Binding decisions retain their separate user-confirmation flow.
- Add a broker inspection method reporting offered tools and exclusions by internal status, Project availability, role permission or access policy. Persist an agent-tool-availability progress event at worker startup with task/worker/role/access identity, offered IDs and exclusion reasons, without prompts or file content.
- Reject delegation when declared child write touches overlap locks held by the parent. Isolated worktree file writes are exempt because they do not write the shared Project path; live/shared resources still require independent ownership. Preserve lock ownership and require explicit release rather than automatically transferring or overriding locks. Undeclared touches and locks acquired after delegation remain outside this preventive check. Clarify writer-role selection and lock ownership in the coordinator instructions.
- Add structured lock-conflict/release-denial logs identifying requesting and owning tasks/workers. CLI services persist redacted logs even when detached stderr is discarded, rotating service.jsonl at approximately 5 MiB into one previous file. Embedded services retain stderr logging; file persistence failure falls back to stderr. This bounded history is separate from audit/event retention settings.
- Preserve native tool error codes and numeric worker RPC failure codes. Clarify createDirectories for new-folder writes without changing filesystem-write defaults.
- Add scripts/diagnose-agent-task.cjs, an authenticated read-only inspector with explicit profile, Project and task selection. It reports ancestry, permissions, tool offers, current locks and failed call codes; older services fall back to existing model-call audit. It omits prompts, tool inputs/outputs, source text and tokens. Calls/events are bounded and paths/IDs can remain private.
- No schema, data-path, package-identity or product-version migration. The running installed IDE has not been replaced, restarted or hot-patched by this source change. Existing waiting tasks and other independent work are preserved.

## Validation

- Reproduced missing board/read in a focused service integration regression before the fix; the same regression passed after removing the gate, including rejected post approval and preserved read-only file permissions.
- Five affected suites passed: 28 tests covering agent delegation, broker, model loop, worker supervisor and locks before the later logging/error-code additions.
- The task inspector ran successfully against the live installed 0.5.0 service and identified the waiting child, parent relationship, offered tools, Project Ask always mode and original -32121/-32122 audit codes. Later live checks confirmed ENOENT write failures and a budget failure.
- Full `npx turbo run build typecheck lint test` gate passed all 33 tasks (22 cached), including Electron/browser builds and 369 passing platform-service tests with 11 capability-dependent skips. Electron typecheck/lint/test remain configured skips. Later worktree-exemption and startup/shutdown logging changes passed the affected service build, typecheck, lint and three focused regression tests.
- An isolated source-built CLI service passed the task inspector check for scheduler-event offered tools/exclusion reasons and the persisted startup log. Report: `.turbo/canon-debug/source-smoke-1791064429412/report.json` (ignored local evidence). The isolated service was stopped; the user's installed IDE was unaffected. Initial smoke attempts exposed an incorrect client-path assumption in the disposable harness and the absence of a startup entry; the harness was corrected and CLI lifecycle logging added before the passing check.
- `git diff --check` and Prettier across platform-service/src passed. `npm run changelog:update` ran; the coverage check reports pre-existing untracked `.kilo/agents/code-reviewer.md` as uncovered work. These unrelated files are outside this record's scope.
- `scripts/check-links.sh` passed under WSL. Initial sandboxed Git Bash attempts lacked utilities and did not provide valid checks; the later native Git Bash scan encountered fork/resource exhaustion and was stopped. The complete WSL scan reported All links OK.
- Global formatting check currently fails on three pre-existing untracked .kilo agent profiles. Those unrelated files are preserved; changed TypeScript files have been formatted.
- Installed deployment, installer lifecycle and original canon task completion are unverified. No paid provider requests were initiated by this investigation.

## Files

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

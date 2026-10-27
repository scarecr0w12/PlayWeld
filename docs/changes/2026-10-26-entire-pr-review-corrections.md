# Address Entire PR hook execution and stale opportunity findings

**Release:** Unreleased

**Impact:** none

**Category:** Fixed

## Summary

Address all three findings from the first Kilo review of [PR 24](https://github.com/scarecr0w12/PlayWeld/pull/24): make SessionStart executable through the Windows shells while preserving valid missing-CLI guidance, and mark two opportunities already completed in PR 23 as historical.

## Details

- The CLI-generated SessionStart body was bare cmd-language syntax while the session shell can be PowerShell. It failed with parser errors under Windows PowerShell 5.1 and PowerShell 7. The reviewer correctly identified the startup risk, although the versioned Codex runner uses a configured shell rather than universally spawning commands without one. A naive cmd wrapper also failed; a doubled-quote variant fixed PowerShell but emitted invalid JSON under the cmd fallback. Retain these failed experiments as local evidence rather than treating static JSON validity or Entire's template match as execution proof.
- Replace only SessionStart's command with a self-contained launcher using Node, already required by this repository. It looks up Entire with where.exe, emits the installation message with JSON.stringify when missing, and delegates the fixed literal entire hooks codex session-start command with inherited input/output. It reports process errors and nonzero child results rather than claiming success. No session-derived text enters the shell command, no package/dependency/model setting changes, and the existing timeout is preserved. Other six Codex hooks remain unchanged.
- Add .entire/README.md to document the existing Node prerequisite, the workaround, scope of execution tests and local approval/capture boundaries. Entire 0.12.2's doctor/status template recognition now flags the custom SessionStart as missing/out of date; this is explicitly retained as a known diagnostic limitation. Do not suppress it or claim a drift-free installation. Regenerating the current CLI template reintroduces the PowerShell failure, so review and test future generated commands before replacing the workaround.
- The open-task review was performed against 3b35deb before the SDK/guide work. Its present-tense opportunity bullets became misleading when published after PR 23 merged. Preserve the dated snapshot and original estimates, but identify the guide correction and all 20 SDK conformance cases as completed by d9c6068/PR 23 on current base d0885df. Update the summary/estimate framing so those two slices cannot be mistaken for remaining work. Do not delete the permanent record or claim broader Q04 completion.
- Clarify that the earlier qualification record's drift-free doctor result describes candidate d94878a, before this execution correction. The current override, diagnostic warning and fixture evidence are recorded here; local Codex trust must still be reviewed through its supported interface. No trust entries, reviewer gates or account settings are forged or changed.
- Compatibility and migration: internal developer hook/configuration and documentation corrections only, with no PlayWeld runtime/API/schema/storage migration or new dependency. The launcher uses the existing Node 24+ prerequisite; it must be available in Codex's environment. Keep product version 0.23.0 and impact none because no shipped application behavior changes. No ordinary session, paid inference, engine operation or hosted session upload is performed for the hook fixtures.

## Validation

- Read the installed codex-cli 0.163.0 identity and its [versioned Windows command runner](https://github.com/openai/codex/blob/rust-v0.163.0/codex-rs/hooks/src/engine/command_runner.rs). Local installed files did not include the Rust runner source, so the official tagged source supplies the configured-shell/cmd-fallback reference.
- An isolated fixture reproduced four original-command PowerShell parser failures; the original cmd fallback cases passed. The naive wrapper and a bounded quote comparison did not satisfy all branches across all shells. The final actual configured launcher passed 12 cases: present CLI, missing CLI with valid systemMessage JSON, and child failure, each through PowerShell 5.1, PowerShell 7, the cmd fallback shape and direct Node. The launcher/cmd boundary preserved child exit 7; PowerShell mapped it to nonzero 1, so neither path appeared successful. Fixtures used a copied existing Node executable as a native shim, without compiling an executable or accessing real transcripts/providers.
- The actual configured launcher also delivered a synthetic SessionStart payload to real Entire 0.12.2 in a disposable Git repository with telemetry disabled and no remote. The CLI exited zero and emitted its conversation-link/approval guidance. This proves local event dispatch, not a trusted new Codex conversation or end-to-end transcript capture. Ordinary repository approval records were not edited. Fixture scripts/reports remain ignored under .turbo/.
- Fresh entire doctor/status still validate Git hooks, report existing approval records, and report the documented SessionStart template-recognition warning. No legacy shadow branches or stuck sessions were reported in the ordinary repository. This warning is not recast as a passing template check.
- Compared the two updated opportunity bullets with current main's guide and SDK tests. The corrected local full gate passed all 33 tasks from cache in 278 ms, replaying the existing 1,043 passes/nine skips; no fresh application execution is implied. Repository-wide formatting passed. The complete local equivalent link check, including the new .entire README beyond the canonical script's usual scope, found zero failures across 387 Markdown files and 1,639 relative links. Bounded privacy screening, regenerated changelog/base coverage and focused formatting/diff checks are refreshed before commit.
- Final-head hosted review/CI and Entire Trail reviewer approval remain subsequent gates. Earlier-head hosted checks cannot qualify the corrected head. The initial Entire agent review reported no blocking findings, but its reviewer-approval requirement is distinct from local Codex hook trust; no gate or approval is bypassed.

## Files

- `.codex/hooks.json`
- `.entire/README.md`
- `docs/changes/2026-10-26-open-task-opportunity-review.md`
- `docs/changes/2026-10-26-entire-pr-qualification.md`
- `docs/changes/2026-10-26-entire-pr-review-corrections.md`

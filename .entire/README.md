# Entire developer integration on Windows

The shared settings enable Git-ref checkpoint storage. Personal settings, logs,
metadata, temporary files and local redactors remain ignored. Git hooks live in
local Git metadata; `.codex/hooks.json` is the shared Codex configuration.

Use the repository's existing Node 24+ runtime and an installed Entire CLI. Six
Codex commands use Entire's generated Windows wrappers. `SessionStart` uses a
small Node launcher because Entire 0.12.2's generated cmd-language fragment fails
when run through PowerShell. A naive cmd wrapper also breaks the embedded JSON
guidance. The launcher checks for Entire, emits missing-install guidance through
`JSON.stringify`, and delegates the fixed `entire hooks codex session-start`
command with inherited input/output and a nonzero result on failure. Session input
is never interpolated into the shell command.

The launcher was checked under Windows PowerShell 5.1, PowerShell 7, Codex's cmd
fallback shape and direct Node execution, using isolated fixtures. A separate
synthetic SessionStart payload also reached the real Entire 0.12.2 CLI in a
disposable repository. See the [review correction record](../docs/changes/2026-10-26-entire-pr-review-corrections.md)
for results and limits. Codex's [versioned command runner](https://github.com/openai/codex/blob/rust-v0.163.0/codex-rs/hooks/src/engine/command_runner.rs)
supports a configured session shell and a cmd fallback; a successful configuration
check alone does not establish execution through either one.

Entire 0.12.2 does not recognize this custom SessionStart launcher as its generated
template, so `entire doctor`/`status` can report it as missing or out of date. That
warning is an acknowledged template-recognition limitation, not a passing
diagnostic or evidence of end-to-end capture. Do not blindly run
`entire agent add codex --force`: regeneration currently restores the command that
failed the PowerShell fixture. Review a future CLI's generated command and repeat
the execution checks before replacing this workaround.

Review the current definitions in Codex's `/hooks` after configuration changes.
Local hook trust, captured-session acceptance, hosted Entire sign-in and the
reviewer approval on a GitHub-linked Entire Trail are separate checks. Do not
forge approval records or upload local/private session state to satisfy them.

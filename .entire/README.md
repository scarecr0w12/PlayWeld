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

Re-enabling Entire can also append a generated SessionStart entry alongside the
custom launcher. Check the resulting hook list: keep one Entire SessionStart
dispatch, rather than both launchers. The final synchronization retains the
user's enabling commit in history and removes its duplicate raw cmd entry; the
tested Node launcher and the other hook events remain unchanged.

Review the current definitions in Codex's `/hooks` after configuration changes.
Local hook trust, captured-session acceptance, hosted Entire sign-in and the
reviewer approval on a GitHub-linked Entire Trail are separate checks. Do not
forge approval records or upload local/private session state to satisfy them.

## Brain on Windows

The local setup was qualified with Entire CLI 0.12.2, Brain 0.3.0 and Graph 0.6.0.
Brain's managed plugins are discovered by `entire`; direct `entire-brain` lookup
need not be on the shell's PATH. The reviewed Claude hook retains its fallback
through `entire brain`.

Use `entire brain refresh --agent none` to rebuild the deterministic indexes, then
`entire brain doctor --json`, `entire brain status --json`, and
`entire brain brief "<task>" --json` to check them. A successful setup exit alone
does not establish complete coverage. Graph currently reports five partial Unreal
C++ parses; inspect those sources directly when they matter. No captured sessions
or distilled facts were available during qualification, so conversation recall
and automatic fact extraction were not verified.

Brain's built-in service installer does not support Windows. This workstation uses
the user-level Scheduled Task `PlayWeld-EntireBrain`, started at sign-in, to run:

```text
entire brain watch E:\Development\GameCrafter --interval 5m --agent none --seed-agent none
```

This is machine-local setup, not an installed cross-platform service. It runs only
while the user is signed in. Distillation is not enabled, and seed synthesis is
disabled; deterministic refresh does not invoke a model. Inspect it with
`Get-ScheduledTask -TaskName PlayWeld-EntireBrain`; stop it with
`Stop-ScheduledTask -TaskName PlayWeld-EntireBrain`. A one-pass equivalent is
`entire brain watch --once --agent none --seed-agent none`.

If Windows rejects Entire's credential-store write, its supported file backend is
selected by the nonsecret user environment variable `ENTIRE_TOKEN_STORE=file`.
The tokens remain outside the repository under the user's Entire configuration
directory. On Windows, Unix mode 0600 is not an access-control guarantee: restrict
the containing directory and token file with Windows ACLs before signing in.
This workstation permits the current user and SYSTEM only. Do not copy token
contents into commands, logs, project files or work records. New terminals inherit
the user-level selector; existing terminals need their process environment updated.

Login storage and network access are separate. Browser/device sign-in and a live
account/Trail read succeeded during qualification, but later account checks also
timed out at connection setup. The supported nonsecret user setting
`ENTIRE_CONNECT_TIMEOUT_SECONDS=15` allows a longer connection attempt; it did not
eliminate the intermittent failure. An unauthenticated IPv4 request reached the
account endpoint, while other connection attempts timed out. No machine-wide
network settings were changed and the underlying network cause is unconfirmed.
Local Brain retrieval does not require hosted sign-in. Hosted Brain sync remains
disconnected; no local transcripts or memories were uploaded.

The live MCP verification initialized `entire brain mcp` over stdio, discovered 32
tools, and successfully called `brain_status`, `brain_query` and `brain_brief`.
This establishes the server protocol and local retrieval, not discovery in a new
Claude/Codex session. Use `entire brain mcp --print-config` for the host-specific
entry; its local paths belong in that host's machine configuration.

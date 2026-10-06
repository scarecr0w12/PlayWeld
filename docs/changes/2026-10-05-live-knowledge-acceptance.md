# Live knowledge acceptance project and local deployment

**Release:** 0.11.0

**Impact:** none

**Category:** Maintenance

## Summary

Add a repeatable live knowledge acceptance runner and prepare local deployment of the embedding discovery fix. The runner uses a separate service process, retained native test Projects, supported authenticated RPC, real files/databases and an existing encrypted provider account; it does not substitute fake embedding vectors.

## Details

- Exercise gathering across canon, documents, code, board messages, synchronized binding decisions and asset provenance metadata; validate source filters, original quotes and citations.
- Exercise native-file watcher updates, canon/board edits, status and record-type filters, reference graphs, duplicate-ID conflicts and recovery, broken references and repair, deletion, idempotent reconciliation, two-Project isolation, checkpointed process restart and full rebuild.
- Exercise encrypted native Project backup verification, wrong-secret rejection, restoration into a new directory/Project identity, byte-identical edited sources, rebuilt search and nonempty-target refusal.
- Preserve each run in a new ignored artifact directory with a redacted incremental report, logs, encrypted test profile and inspectable synthetic Projects. Read the original account only to transfer its credentials in memory into the isolated profile; leave the ordinary provider account unchanged.
- Add a desktop acceptance runner for the retained live profile: inspect the actual embedding selector, search citations and retained record detail, then verify a service edit updates the open record through notifications and becomes searchable. Retain screenshots and captured renderer exceptions.
- Exercise real discovery preview and selected embedding import. When the provider denies the embedding probe, verify no embedding profile is persisted and hybrid search explicitly reports its lexical fallback. Mark semantic/vector acceptance blocked rather than using mocks.
- When real embedding access is available, also exercise paraphrase semantic/hybrid search, SQLite/LanceDB/managed-Qdrant backend switching and vector/profile retention after restart. Those cases cannot be claimed passing until executed.
- Local deployment is authorized by the user's 2026-10-05 request. Preserve ordinary configuration through checkpointed backup, installer upgrade and before/after comparison. No public release, tag, push, signing, uninstall or rollback is requested.

## Validation

- `node scripts/verify-knowledge-live.cjs --help` passed.
- Live source process run `.artifacts/knowledge-live-2026-10-05/source-run-4/report.json`: 26 checks passed, zero failures, one provider blocker. Initial runner development failures were incorrect scenario setup (binding a finding instead of a proposal) and an incorrect expectation that two uncommitted edits have different revision labels; corrected the harness to use valid proposal binding and a committed-to-worktree revision transition.
- Expanded separate-process source release run `.artifacts/knowledge-live-2026-10-05/source-release-run/report.json`: 28 checks passed, zero failures, one provider blocker, including actual encrypted backup and restore.
- Fresh live OpenAI probes for `text-embedding-3-small` and `text-embedding-3-large` returned HTTP 403 `model_not_found` and zero dimensions. The source runner confirmed the same provider rejection through `knowledge/embeddingProfile/set`. No key values or raw provider errors were retained.
- Staged 0.11.0 general desktop smoke passed 29 checks with zero renderer exceptions. Knowledge desktop acceptance passed 7 checks with zero renderer exceptions after correcting the runner's ProjectHome navigation selector. Evidence remains under `.artifacts/knowledge-live-2026-10-05/staged-live-run/` and `.artifacts/documentation-electron/1791214175813/smoke/report.json`. The runner labels target desktop checks without assuming the executable is installed.
- Expanded staged 0.11.0 live acceptance passed 26 checks before a real Windows backup cleanup failure stopped the run. The archive-stream repair is recorded separately; this candidate is not accepted as a complete deployment.
- Ordinary installed 0.10.2 profile and four Project databases were checkpointed and backed up before attempting the upgrade. Windows elevation was canceled; the installed version remains unchanged and installation-path selection is pending. Do not treat staged acceptance as installed acceptance.

## Files

- `scripts/verify-knowledge-live.cjs`
- `scripts/verify-knowledge-ui.cjs`
- `docs/changes/2026-10-05-live-knowledge-acceptance.md`

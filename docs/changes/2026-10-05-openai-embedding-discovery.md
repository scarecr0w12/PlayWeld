# Restore OpenAI embedding candidates in model discovery

**Release:** 0.11.0

**Impact:** patch

**Category:** Fixed

## Summary

OpenAI model discovery now offers the catalogued embedding models when a successful first-party model listing omits them, so they can be imported and selected in Knowledge settings using the existing provider account.

## Details

- Supplement successful discovery for OpenAI accounts using the official HTTPS `/v1` endpoint with missing embedding entries from the existing metadata catalog (`text-embedding-3-small` and `text-embedding-3-large`). Preserve the returned provider metadata, avoid duplicate entries, and keep catalog provenance distinct from provider API evidence.
- Preserve preview without writes, explicit selected-model imports, account isolation, manual metadata precedence, and provider errors. Custom OpenAI endpoints and other provider kinds do not receive first-party candidates.
- Candidates describe published embedding capabilities, not confirmed account access. The existing Knowledge profile flow calls the embeddings API to verify access and determine dimensions before saving the profile. Discovery does not send a paid embedding probe or change credentials.
- Preserve and extend the pre-existing uncommitted regression test with selected import/update, custom endpoint isolation, no duplicates, authoritative provider capability metadata, and failed discovery coverage.
- No RPC, database, package identifier, version, or migration changes. The running packaged application has not been replaced or restarted by this change.

## Validation

- Before the fix, `npm test -w @gamecrafter/platform-service -- src/models/model-registry.test.ts` failed because preview returned only the fixture chat model instead of the two embedding candidates. The original four-test suite passed after the fix.
- Read-only authenticated inspection of the running default-profile service confirmed one enabled first-party OpenAI account, no registered embedding models, and successful preview discovery of 19 models with no embedding capabilities. No credentials were emitted or changed.
- Existing Knowledge widget tests passed: six tests, including rendering a selectable OpenAI embedding model.
- OpenAI's published embedding model names were checked against its [embedding guide](https://developers.openai.com/api/docs/guides/embeddings) on 2026-10-05. Their absence from this account's discovery is live local evidence, not a claim that OpenAI universally omits them.
- `npx turbo run build typecheck lint test` passed all 33 tasks (21 cache hits), including both Electron and development browser application builds. Platform service: 109 test files, 511 passed and 11 existing platform-dependent tests skipped. Theia extension: 25 test files and 104 passed. The expanded discovery regression and six Knowledge integration tests passed in this full run.
- `npm run format:check`, `git diff --check`, and `npm run changelog:check -- --base HEAD` passed.
- `scripts/check-links.sh` was launched using Git Bash; its full scan has not completed at handoff. An equivalent temporary Node scan of the same paths, fenced-block exclusions, relative file targets, and heading slug rules passed: 242 Markdown files, 1, 162 relative links, zero failures. Temporary redacted diagnostics and the link scanner are under ignored `.turbo/` and are not product tooling.
- Paid embedding calls, selection in the installed application, and installer deployment remain unverified. No dependency installation was needed; the existing pinned workspace dependencies were used.

## Files

- `packages/platform-service/src/models/model-registry.ts`
- `packages/platform-service/src/models/model-registry.test.ts`
- `docs/changes/2026-10-05-openai-embedding-discovery.md`

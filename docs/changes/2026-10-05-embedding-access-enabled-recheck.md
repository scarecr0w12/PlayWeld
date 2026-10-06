# Recheck embeddings after the OpenAI access change

**Release:** 0.13.0

**Impact:** none

**Category:** Maintenance

## Summary

The existing saved OpenAI key now returns real embedding vectors, but identical requests intermittently retain the previous project/model access rejection. Real ingestion succeeded in the packaged runtime; semantic acceptance is not yet complete.

## Details

- Fresh direct requests returned HTTP 200 for both `text-embedding-3-small` (1, 536 dimensions) and `text-embedding-3-large` (3, 072 dimensions). No local account or credential was changed by this recheck.
- The provider model list expanded from the previous 19-model response to 139 models and now includes the two current embedding models and `text-embedding-ada-002`.
- The fresh packaged 0.12.0 acceptance Project imported an embedding model, verified its dimensions and indexed real SQLite vectors. Its first semantic search then received HTTP 403 `model_not_found` and correctly reported a lexical fallback, so the test failed instead of claiming a semantic pass.
- Differential direct and actual adapter requests also alternate between success and HTTP 403 with the same key and no custom account headers. A controlled eight-request sample with identical semantic-query input returned three successes and five denials. Access-change propagation is a hypothesis, not a confirmed provider diagnosis.
- No runtime request retries, fake vectors, forced profile configuration, installer or provider-permission mutations were added.

## Validation

- Initial and subsequent minimal two-model probes returned real vectors for both models.
- `.artifacts/knowledge-live-2026-10-05/embedding-enabled-live-run/report.json`: 23 checks passed, zero marked blockers, one failed semantic acceptance assertion due to an actual provider rejection. The runner stopped its owned service. This is a failed acceptance run, despite successful profile creation and vector ingestion.
- `.artifacts/knowledge-live-2026-10-05/embedding-differential-1791217839726/report.json`: successful model listing, mixed direct embedding results, and successful actual provider adapter calls in both ordinary and retained test profiles.
- `.artifacts/knowledge-live-2026-10-05/embedding-stability-1791217876990.json`: 3 of 8 requests returned vectors; 5 of 8 returned HTTP 403 `model_not_found`. Key values are excluded from all output and retained reports.
- A second sample after a bounded wait, `.artifacts/knowledge-live-2026-10-05/embedding-stability-1791217972127.json`, still alternated between success and denial: 4 of 8 returned vectors and 4 returned HTTP 403. Provider access is not yet stable. Work-record coverage, Git whitespace and native equivalent link checks passed (250 Markdown files, 1, 173 relative links); the previously stopped slow Git Bash scan was not repeated.
- Full semantic/hybrid, vector-backend switching and vector retention acceptance remain unverified until provider responses are stable.

## Files

- `docs/changes/2026-10-05-embedding-access-enabled-recheck.md`

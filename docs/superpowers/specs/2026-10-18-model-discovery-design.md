# Model discovery, selection and metadata design

The user wants provider-key setup followed by discovery and explicit selection of usable models, with dynamically retrieved metadata. Existing encrypted credential storage remains the only key boundary. No secrets are read by diagnostic clients or sent to metadata services.

## Evidence

Installed 0.21.0 has 139 OpenAI records: 135 unknown-capability rows and 137 unpriced rows. The bundled catalog matches only four exact OpenAI IDs. OpenAI GET /models supplies identity, not complete capabilities/prices. Router monetary filtering currently skips unknown estimates.

## Design

- Provider adapters retain actual authenticated availability discovery and parse supported capability/limit/price fields. Provider-returned fields win. Account RPM/TPM limits are not model context/output limits.
- Enrich missing fields using the maintained models.dev public catalog, matching the exact provider and model ID. Never send provider keys/headers to it, never infer arbitrary aliases, never substitute another provider's price. Normalize documented USD per-million-token prices and reject invalid/negative values. Preserve unknowns where the source supplies none.
- Keep sourced bundled metadata as an offline last resort. Per-field source URL, fetched time, expiry and stale status explain provenance. Cache successful enrichment; on failure retain cached/persisted facts and surface stale/failure messages rather than clear data or fabricate confidence.
- Discovery preview does not activate models. New unselected models stay disabled; explicit selected IDs activate only those models. Refresh preserves prior enabled selections and manual overrides. Successful full discovery marks absent models unavailable without deleting records/history, and reappearance restores availability without overriding selection. Failed refresh never reconciles removals.
- Persist availability and last-seen timestamps with an additive SQLite migration. Existing records default to unknown availability and retain selection. UI shows selection, availability, metadata coverage/freshness and provider-vs-catalog attribution; routing roles/tags remain application policy.
- Router excludes unavailable/unselected models, requires known capabilities and rejects unknown monetary estimates under a strict cost constraint. Bound input/output tokens against known model limits before generation; do not present a historical average estimate as a hard spend cap.
- Keep secure account handling unchanged. No installs, dependency upgrades, saved credential copying, other-project edits, push, deployment or installer replacement. Use the existing $1 aggregate test budget only after a bounded route is established.

## Validation

Focused provider/catalog fixtures cover exact-ID matching, incomplete/non-USD prices, precedence, TTL, failures and no credential propagation. Registry integration covers preview, explicit selection, removed/reappeared IDs and override preservation. Router tests cover disabled/unavailable/capability and unknown-price budgets. UI smoke proves discovery/selection and source/freshness text. Complete repository-required typecheck/build/lint/test/format and changelog checks with actual limitations recorded. Native app evidence uses isolated state; source-built desktop verification is distinct from installed 0.21.0 acceptance.

## References verified during diagnosis/design

- https://developers.openai.com/api/reference/resources/models/methods/list
- https://ai.google.dev/api/models
- https://platform.claude.com/docs/en/api/models/list
- https://models.dev/ and https://github.com/anomalyco/models.dev

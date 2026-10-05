# Verify Live OpenAI Embedding Model Access

**Release:** 0.10.3

**Impact:** none

**Category:** Maintenance

## Summary

Used an authorized OpenAI development credential to distinguish model-discovery filtering from provider model access. The live API responses matched discovery and denied direct embedding requests, so the UI was not hiding models returned by the API.

## Details

- The read-only `model/discover` preview and direct `GET /v1/models` agreed; neither included embedding IDs.
- Minimal direct embedding requests for documented OpenAI embedding model IDs were denied with HTTP 403 `model_not_found` and returned no vectors ([embedding API](https://developers.openai.com/api/docs/api-reference/embeddings/create), [model catalog](https://developers.openai.com/api/docs/models/all)).
- This evidence indicates the tested credential's provider scope must expose and accept an embedding model before discovery can add it. The credential and account were not changed; no key, account identifier, or private profile data is recorded. No provider behavior changed as part of this diagnostic.

## Validation

- Authenticated local service `model/discover` with `preview: true` and direct `GET /v1/models` — responses agreed; no embedding IDs appeared ([OpenAI API reference](https://developers.openai.com/api/reference/resources/models/methods/list)).
- Minimal authorized `POST /v1/embeddings` probes — HTTP 403 `model_not_found`; zero vectors returned.
- Provider discovery was run as a preview and persisted no model changes. API key values were not included in command output or retained artifacts.

## Files

- `docs/changes/2026-10-05-openai-embedding-key-access-diagnostic.md`

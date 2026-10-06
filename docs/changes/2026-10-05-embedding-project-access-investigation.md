# Isolate the remaining OpenAI embedding access failure

**Release:** 0.13.0

**Impact:** none

**Category:** Maintenance

## Summary

Compare minimal direct OpenAI requests with PlayWeld's provider adapter and both ordinary/test profiles. OpenAI explicitly rejects the stored key's project access to both embedding models; endpoint construction, optional account headers and stale test credentials do not explain this remaining failure.

## Details

- Investigate three falsifiable causes: project/model restrictions, incorrect project/organization headers, and provider request formatting.
- Read encrypted credentials in memory through the existing CredentialStore and ModelRegistry seams. Both profiles contain the same project-scoped key, use `https://api.openai.com/v1`, and configure no account headers. No account, credential or provider setting is changed.
- Minimal and configured `GET /v1/models` requests both return HTTP 200 and 19 models, with no embedding IDs. Minimal and configured `POST /v1/embeddings` requests both return HTTP 403 `model_not_found` for `text-embedding-3-small` and `text-embedding-3-large`.
- Capture the provider's precise message with project identifiers redacted: the project does not have access to the requested model. Actual OpenAI adapter calls from both profiles return the same response. Discovery preview exposes the two catalog candidates without persisting changes; catalog availability is distinct from successful provider access.
- OpenAI documents separate API-key endpoint permissions and project model usage permissions. Check the project owning the saved key, its Limits / Model Usage settings, and its API Keys endpoint permissions; enabling another project's models cannot change this key's scope ([project management guide](https://help.openai.com/en/articles/9186755-managing-projects-in-the-api-platform)). No admin credential is requested or used, and no external permission changes are performed by this investigation.
- Existing discovery and packaged validation remain unchanged. The external embedding access blocker is unresolved until the provider accepts a request; no synthetic vectors or forced embedding profile are used.

## Validation

- Fresh minimal probe reproduced the HTTP 403 responses before hypothesis testing.
- Differential live diagnostic at `.artifacts/knowledge-live-2026-10-05/embedding-differential-1791217124589/report.json` records endpoint/header/key-kind and same-credential comparisons, two successful model lists, four denied direct embeddings and two denied real adapter calls. API keys and project identifiers are excluded from reports.
- Diagnostic scripts and reports are ignored local artifacts, not shipped runtime features. Runtime code was not changed in this investigation; the preceding 0.12.0 full quality gate and packaged acceptance remain the applicable runtime evidence.
- Provider access remediation awaits the user's confirmation that model access is enabled in the project owning the currently saved key.
- Work-record/changelog coverage and Git whitespace checks passed. The native equivalent link scan passed 249 Markdown files and 1, 172 relative links; the original Git Bash scan was previously stopped for excessive runtime and was not repeated for this investigation.

## Files

- `docs/changes/2026-10-05-embedding-project-access-investigation.md`

# OpenAI Responses fallback for tool-capable reasoning models

**Release:** 0.13.0

**Impact:** patch

**Category:** Fixed

## Summary

Fix a live Swarm blocker where OpenAI rejects function tools on Chat Completions and the selected model also rejects the previous `reasoning_effort: none` fallback.

## Details

- Negotiate Responses only for the first-party OpenAI adapter at the exact official endpoint after a structured HTTP 400 explicitly identifies the function-tool reasoning conflict. Preserve existing Chat Completions behavior for compatible/custom/Azure/other providers and unrelated errors. Keep the selected model and account unchanged.
- Map function definitions, messages, tool calls/results, output limits, structured output, token usage and streaming text. Use `store: false` and bounded account/model-scoped encrypted reasoning replay for subsequent tool turns. Restored Chat histories without provider item IDs use reconstructed function-call inputs; restart/checkpoint replay is not yet live-verified.
- Cache the negotiated route after success. Preserve cancellation and provider credential redaction. No contract/storage migration or dependency additions.
- Live cache-independent continuation passed: a real function call executed the Project filesystem broker, then a reconstructed call ID and its tool output resumed successfully without provider item IDs. This does not verify every paused-agent question/checkpoint history; a later cross-model paused-question continuation failed with a missing-tool-output error and remains an investigation boundary.
- Official references consulted: https://developers.openai.com/api/docs/guides/function-calling and https://developers.openai.com/api/docs/guides/migrate-to-responses .

## Validation

- Regression first failed on the existing adapter with the reproduced structured 400, then passed with Responses and subsequent tool-result/reasoning replay. Expanded provider suite passed 23/23, including streaming and no retry for HTTP 401/403/429/500.
- Source service rebuilt and restarted using only the isolated RPG acceptance profile. Both real Swarm retries now perform model completion and broker file writes. This is source-built service evidence, not newly packaged installer acceptance.
- Full repository gate initially completed 32/33 tasks with an A2A setup-hook timeout and Windows cleanup EPERM; focused A2A rerun passed 11/11. A second full `npx turbo run build typecheck lint test` passed. Format and changelog checks passed. New packaging, restart/checkpoint reasoning replay and exhaustive API validation remain pending.

## Files

- `packages/platform-service/src/models/providers/openai-compatible.ts`
- `packages/platform-service/src/models/providers/openai-providers.ts`
- `packages/platform-service/src/models/providers/openai-responses.ts`
- `packages/platform-service/src/models/providers/providers.test.ts`
- `docs/changes/2026-10-05-openai-responses-tool-fallback.md`

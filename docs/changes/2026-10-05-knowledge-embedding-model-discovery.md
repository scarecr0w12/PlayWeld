# Guide Embedding Model Discovery

**Release:** 0.10.3

**Impact:** patch

**Category:** Fixed

## Summary

Knowledge settings now explain why connected provider credentials alone do not populate the embedding-model selector and provide a direct route to Models & Routing.

## Details

- The selector remains limited to enabled models declared to support embeddings. The empty state now guides users to discover and add a compatible model, and to check API-key project access if discovery has no embedding models, preserving explicit model registration and routing controls.
- Added regression coverage for the empty state and verified that an enabled OpenAI `text-embedding-3-small` model remains selectable. No provider, storage, or RPC behavior changed.

## Validation

- Regression red phase: `npm test -w @gamecrafter/theia-control-room -- src/browser/knowledge-widget.test.ts -t "explains how to add embedding models"` failed because the empty selector provided no discovery guidance.
- `npm test -w @gamecrafter/theia-control-room -- src/browser/knowledge-widget.test.ts` — 6 tests passed, including the discovery command action and selectable OpenAI embedding model.
- `npm test -w @gamecrafter/theia-control-room`, package typecheck, and package lint — passed (104 tests).
- `npx turbo run build typecheck lint test --output-logs=errors-only` — all 33 tasks passed.
- `npm run format:check`, `npm run changelog:check -- --base HEAD`, and `git diff --check` — passed.
- The later authorized live OpenAI API access diagnostic is recorded in `docs/changes/2026-10-05-openai-embedding-key-access-diagnostic.md`.

## Files

- `packages/theia-control-room/src/browser/knowledge-widget.tsx`
- `packages/theia-control-room/src/browser/knowledge-widget.test.ts`
- `docs/changes/2026-10-05-knowledge-embedding-model-discovery.md`

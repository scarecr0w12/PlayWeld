# External IDE MCP and native Theia router adapters

**Release:** 0.15.0

**Impact:** minor

**Category:** Added

## Summary

Implement the previously missing local external-IDE MCP server and native Theia language-model/tool contributions, verified through real SDK stdio/service integration and the rendered desktop registry.

## Details

- Add `gamecrafter-mcp`, a newline stdio MCP executable bound to an explicit registered Project. Startup uses local authenticated service discovery without passing a token in arguments. Modern discovery and legacy initialization expose live tool definitions; calls use the existing broker and its permissions, approvals, records and containment.
- Stable hashed MCP tool names preserve original IDs in descriptions. Native tool schemas are wrapped under an `input` object property, retaining union/scalar validation while meeting the MCP SDK schema contract. Unknown tools and attempts to replace the Project/argument envelope are rejected.
- Add one frontend Theia `LanguageModel` contribution forwarding to the service router and two broker tool contributions. Workspace-derived selection rejects empty or ambiguous context; explicit registered context is validated. Model tool calls use the captured Project and service broker rather than injected Theia callbacks.
- Map text/tool conversation messages, usage and completed tool results, with a bounded eight-turn loop, cancellation checks and checks before subsequent mutations after workspace changes. Unsupported image/provider-specific messages are rejected rather than silently dropped. Service completion is buffered; this is not a new provider token-stream implementation.
- Add the exact existing Theia AI core 1.75.0 dependency and refresh workspace lock metadata for that dependency and the new MCP bin. Registry metadata confirms its 2026-08-27 publication, older than seven days; no Theia version upgrade or provider/model override occurred.
- Extend the rendered adversarial audit with a synthetic local model account, actual native Theia registry lookup and service-routed completion. Fixtures remain isolated from ordinary profiles and paid accounts.
- Compatibility and migration: package identities, service authentication and persisted Project/tool records remain unchanged. The new CLI and adapter APIs are compatible additions. Existing Control Room Chat/Swarm paths retain their implementations; this warrants minor impact.

## Validation

- Real MCP SDK stdio integration passed against an isolated actual service: tool listing/calling, selected-Project reads, foreign file refusal, unknown tool refusal, retained broker history and no service token in results/stderr. The initial SDK check caught non-object native schemas; the envelope repair passes.
- Four native Theia adapter unit tests passed, including service routing/usage, broker calls, cancelled/changed/empty context and unsupported/foreign callback refusal.
- The combined repository gate passed 33/33 tasks, with 557 platform tests/six skips and 128 extension tests. The real source-built desktop audit passed 196 checks with zero findings or renderer exceptions at `.artifacts/adversarial-electron/1791322029053/report.json`, including registry discovery, service-routed native model completion and registered broker tool providers.
- Personal external IDE setup, provider token streaming, images, and transport-level cancellation are not claimed as verified. The registry completion uses a labeled local HTTP model fixture, not a new paid provider call.

## Files

- `packages/platform-service/src/mcp/external-ide-server.ts`
- `packages/platform-service/src/mcp/external-ide-server.test.ts`
- `packages/platform-service/package.json`
- `packages/theia-control-room/src/common/theia-model-adapter.ts`
- `packages/theia-control-room/src/common/theia-model-adapter.test.ts`
- `packages/theia-control-room/src/browser/theia-model-contribution.ts`
- `packages/theia-control-room/src/browser/control-room-frontend-module.ts`
- `packages/theia-control-room/package.json`
- `package-lock.json`
- `scripts/adversarial-ui-audit.cjs`
- `docs/EXTERNAL_IDE_INTEGRATION.md`
- `docs/changes/2026-10-06-external-ide-and-theia-adapters.md`

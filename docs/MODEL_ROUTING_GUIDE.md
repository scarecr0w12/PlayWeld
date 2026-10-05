# Models, routing and request failure diagnosis

**Last updated:** 2026-10-04

Use this guide when Models lists an account but Chat or an agent request cannot run. It explains the current repository's routing and completion behavior, with implementation links rather than provider marketing claims. The [user guide](USER_GUIDE.md), [settings reference](SETTINGS_REFERENCE.md), [workflow cookbook](WORKFLOW_COOKBOOK.md) and [glossary](GLOSSARY.md) supply the surrounding workflow.

## Configure an account and a usable model

Open Models, add the intended account and discover its models. Inspect both account and model enablement. Discovery metadata includes capabilities and model restrictions; an account appearing in the UI does not establish that a suitable enabled model exists. Check the actual configured endpoint and provider kind before testing a credential. Tests or completion calls can reach a billable provider; use the local documentation fixtures for practice.

Use the native model ID from discovery. Provider tool-name encoding is handled separately and is not a model-ID convention. Preserve existing account/model records while diagnosing restrictions; deleting and recreating everything can discard the configuration you need to understand. [Model registry](../packages/platform-service/src/models/model-registry.ts) owns discovery/configuration, and [provider implementations](../packages/platform-service/src/models/providers/) own the downstream request format.

Named account presets cover OpenAI, Gemini Developer API, OpenRouter, xAI, Mistral, DeepSeek, Groq, Azure OpenAI, and Anthropic; generic OpenAI-compatible endpoints remain available for local servers and compatible gateways. Accounts accept API keys and custom headers; OAuth/device login and cloud-native identity are not supported in this scope. Azure's callable `providerModelId` is a deployment name; match its documented base model separately as `catalogModelId` before applying catalog limits or prices.

## Capability evidence and unknown values

Discovery combines account API declarations with exact-ID entries in the versioned, provider-sourced catalog. Each field shows source, freshness, and confidence. `Unknown` is not `Unsupported`: an API that returns only an ID leaves absent facts unknown. Setting a boolean/price/base-model field to Unknown clears its manual override so later discovery may repopulate it; explicit Supported/Unsupported and numeric values remain manual overrides. Catalog facts are published estimates, not a provider invoice; the system does not issue silent billable completion probes.

Chat routing always requires `chat: true`; false or unknown models are not eligible for a completion, even if an applicable pool contains them. An explicitly required capability also has to be `true`. Provider-declared vision is visible but is not currently routeable because the common chat request accepts text only. Embeddings are executed through the separate `model/embed` operation, not chat selection. Do not set `vision` or `embeddings` as chat-route requirements to work around an unsupported request shape.

`roles` and `workTypes` are hard allowlist restrictions, not descriptive tags. An empty list means unrestricted. Provider category names such as “Code model” or “Embedding model” are not automatically translated when they do not exactly match the local taxonomy; descriptive tags can still be populated without restricting the model. Leave a model unrestricted unless a high-confidence sourced mapping matches its actual role/work type.

## Understand eligibility before ranking

The [router implementation](../packages/platform-service/src/models/router.ts) filters candidates before scoring them. A manual choice still has to survive the route's applicable filters.

| Filter stage     | What to inspect                                          | Practical correction                                                                    |
| ---------------- | -------------------------------------------------------- | --------------------------------------------------------------------------------------- |
| `enabled-models` | Model and owning account enabled state                   | Enable the intended existing records; inspect discovery failures                        |
| `workTypes`      | Model restrictions and request `taskType`                | Match the intended work type; an empty restriction list allows all work types           |
| `roles`          | Model role restrictions and request `agentRole`          | Use the actual registered role; restricted models need a matching role                  |
| `capabilities`   | Every entry in `requiredCapabilities`                    | Select a model advertising the actual requirement, or remove an unnecessary requirement |
| `pools`          | Applicable role/task/global pools and membership         | Correct the empty effective pool intersection deliberately                              |
| `manual-model`   | Selected ID among candidates that survived prior filters | Choose an eligible ID; manual selection does not bypass pools/capabilities              |
| `constraints`    | Known estimated cost/latency versus effective limits     | Inspect the estimate and request/settings limits before changing them                   |

When applicable role and task-type pools both exist, routing intersects their unions. Multiple pools of one category contribute a union; a model in only the role union cannot satisfy a disjoint task-type union. Global pools are used when neither targeted category applies. No configured applicable pool leaves selection to enabled-model eligibility.

`NoEligibleModel` includes the filtering `stage` and `removedBy` details in its RPC error data. Those identify why the candidate set became empty; they are not a provider authentication result. The example `router/route` call below records a selection decision but does not itself request a model completion:

```javascript
const decision = await client.call('router/route', {
  projectId,
  taskType: 'chat',
  requiredCapabilities: ['chat'],
  // manualModelId: anEligibleDiscoveredModelId,
});
```

Use a connected typed client with the intended profile/Project. Exact shapes and codes are in [RPC schemas](reference/rpc-schemas.json); the [diagnostic executable](examples/service-diagnostics.cjs) demonstrates explicit-profile authentication. Router decisions live in the service's profile database, with Project/role/task context.

## Streaming is a separate capability

Chat requires chat capability. It requests streaming as a delivery preference, while [completion service](../packages/platform-service/src/models/completion-service.ts) sends a nonstreaming request when the selected model does not advertise streaming. The [Chat widget](../packages/theia-control-room/src/browser/chat-widget.tsx) persists the returned complete response as well as handling streamed text.

A caller that explicitly includes `streaming` in `requiredCapabilities` requires a streaming-capable candidate. That is different from merely setting `request.stream: true`. Do not mark a model streaming-capable to silence an eligibility error without validating its endpoint behavior.

Chat mode answers and preserves a transcript. Agent mode delegates implementation through the Project task runtime and broker. A successful chat completion does not prove tool calling, worktree writes, native tests or integration. The [agent screenshot exercise](WORKFLOW_SCREENSHOTS.md#scripted-agent-and-approval) verifies those separate boundaries with a deterministic local endpoint.

## Quality, estimates and budgets

Inspect effective values and source layers in Settings before changing routing policy:

| Setting                              | Purpose and important limit                                                   |
| ------------------------------------ | ----------------------------------------------------------------------------- |
| `models.autoRouting.quality`         | Selects `quality-first`, `balanced` or `cost-first` scoring after eligibility |
| `models.autoRouting.maxLatencyMs`    | Filters known latency estimates; zero removes that routing maximum            |
| `models.budget.maxCostPerTaskUsd`    | Supplies a routing cost constraint; inspect actual usage separately           |
| `models.exploration.rate`            | Controls exploration of eligible less-observed candidates                     |
| `models.exploration.budgetUsdPerDay` | Constrains exploration with recorded spend and the next candidate's known estimate |

The router's constraint filter does not reject an unknown cost/latency estimate solely because it is unknown. A passing route therefore does not guarantee the future provider charge or latency. Compare actual usage and provider limits separately. A model choice and estimate are not an accepted spending invoice.

Decision records expose candidate scores, quality estimates, observation counts, estimated cost/latency, reliability, reason, policy version and whether exploration occurred. Outcome records distinguish validation, user, reviewer and self assessment. Self-reported completion quality is not equivalent to native validation or user acceptance. The service owns those records; a UI refresh does not reset routing history.

Audit's separate **Model usage** view records direct, routed and streamed completion attempts at the shared boundary. Cost confidence distinguishes known estimates, partial known amounts, unavailable pricing/usage and unverifiable older routed outcomes. Provider usage omissions or failed attempts with unavailable usage are not evidence of a free request. Token/cache counters and cost estimates are not a provider invoice, subscription or hardware-cost ledger; missing historical direct completions cannot be reconstructed from absent records.

Set per-model input/output **$/MTok** under **Models > Edit routing metadata**. Blank rates mean unknown; an explicit zero is a deliberate zero-rate configuration. Cache counts without recorded cache rates remain partial/unknown. Loaded-page known cost is not an all-time total; linked model-tool and model-usage records must not be charged twice. Task monetary accumulators use known amounts and cannot establish a true hard-dollar ceiling for unpriced usage.

Exploration does not choose an unknown-cost candidate or one whose known estimate exceeds the remaining daily exploration allowance. Unpriced/partial exploration outcomes also prevent further exploration that day. Ordinary baseline routing retains the unknown-estimate caveat above; estimates still cannot guarantee final provider charges.

## Diagnose the boundary that failed

| Observed result                             | Evidence to preserve                                                        | Next action                                                                |
| ------------------------------------------- | --------------------------------------------------------------------------- | -------------------------------------------------------------------------- |
| Empty UI model picker                       | Account/model enablement and advertised chat capability                     | Inspect Models/discovery before submitting repeatedly                      |
| `NoEligibleModel`                           | Exact stage and restriction/pool/constraint identifiers                     | Correct the specific eligibility conflict                                  |
| Provider completion fails                   | Sanitized error, selected model, endpoint kind and request capabilities     | Reproduce with a small authorized request; preserve original failure       |
| Response succeeds but agent fails           | Task events, completion claim, question/approval state and tool call result | Diagnose the task/broker boundary, not just the provider                   |
| Task succeeds but workspace is unchanged    | Worktree and integration ID/status/changed files                            | Review and integrate the ready change or repair its documented conflict    |
| Native tool exits zero but acceptance fails | Parsed report, expected count, identity and artifact                        | Repair the actual fixture/runtime failure; exit code alone is insufficient |

The completion service reports routed outcomes but does not provide a universal automatic retry across alternative providers. Do not repeatedly submit a possibly completed mutating agent request to work around a provider error. Fetch its persisted state first. Redact credentials and private prompt/source content when preparing diagnostics.

The OpenAI-compatible adapter has two narrow request-field negotiations after specific HTTP 400 rejections: replacing `max_tokens` with `max_completion_tokens`, and setting `reasoning_effort` to `none` when the endpoint explicitly requires it for function tools. It performs at most two corrective retries and remembers successful compatibility choices per account/base URL/provider model for that adapter instance. It does not replay a successfully started stream or switch providers. These are repository behaviors with fixture tests, not claims that every model accepts either field. See the [adapter](../packages/platform-service/src/models/providers/openai-compatible.ts) and [provider regressions](../packages/platform-service/src/models/providers/providers.test.ts).

## Evidence and repeatable checks

Run `npm test -w @gamecrafter/platform-service -- src/models/router.test.ts src/models/providers/providers.test.ts` for in-repository route/provider regressions. These use local fixtures rather than live paid services. The [combined capture report](images/lantern-workflows/capture-report.json) separately records a local complete-response Chat request and the scripted agent workflow through the real UI/service. The [coverage inventory](DOCUMENTATION_COVERAGE.md) retains live-provider, billing and model-quality gaps.

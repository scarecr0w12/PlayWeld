# Model Provider Catalogs and A2A v1.0

**Last researched:** 2026-10-04

## Purpose

This note informs the provider/model discovery and external-agent connectivity work in [PLATFORM_DESIGN: Models and routing](../PLATFORM_DESIGN.md#models-and-routing) and the implementation plan in [DEVELOPMENT_PLAN: WP8](../DEVELOPMENT_PLAN.md#wp8--model-providers-registry-and-adaptive-router). It records published API behavior, not live compatibility results for PlayWeld.

## OpenAI

- `GET /v1/models` is authenticated with a Bearer token and returns model identifiers plus basic metadata such as `created`, `owned_by`, and `shutdown_date`; it is not a complete capability catalog. ([Models](https://platform.openai.com/docs/api-reference/models/list), [Authentication](https://platform.openai.com/docs/api-reference/authentication))
- Chat Completions accepts role-based messages and supports server-sent-event streaming. OpenAI recommends trying Responses for new projects, so Chat Completions should be treated as a compatibility surface, not assumed to represent every newer feature. ([Chat Completions](https://platform.openai.com/docs/api-reference/chat/create))
- Per-key model availability, aliases, parameter support, and shutdown state still require account-specific verification; API reference fields alone do not establish all capabilities. ([Models](https://platform.openai.com/docs/api-reference/models/list))

## Anthropic

- The official TypeScript API reference documents `GET /v1/models` as listing models available for use in the API. Model records include `capabilities`, `max_input_tokens`, and `max_tokens`, but no pricing fields. ([Models API reference](https://github.com/anthropics/anthropic-sdk-typescript/blob/main/api.md), [ModelInfo type](https://github.com/anthropics/anthropic-sdk-typescript/blob/main/src/resources/models.ts))
- `ModelCapabilities` is a nested object with each support value represented by `{ supported: boolean }`; documented fields include `image_input` and `structured_outputs`. The adapter maps these exact declarations to PlayWeld `vision` and `structuredOutput`; it does not interpret a missing flag as unsupported. ([ModelCapabilities type](https://github.com/anthropics/anthropic-sdk-typescript/blob/main/src/resources/models.ts))
- Adapter-level behavior: models returned by this Messages API adapter are marked chat-capable; the adapter supports streaming and does not implement Anthropic embeddings. Those are adapter scope declarations, not values returned in the per-model API record. Generic tool capability remains unknown because the model capability schema does not declare a generic tool flag. ([Models API reference](https://github.com/anthropics/anthropic-sdk-typescript/blob/main/api.md), [Messages API](https://github.com/anthropics/anthropic-sdk-typescript/blob/main/api.md))

## Google Gemini

- The Models API is paginated and reports supported generation methods and token limits; model generation uses the distinct `contents` / `systemInstruction` Generate Content format, with `streamGenerateContent` for streaming. ([Models](https://ai.google.dev/api/models), [Generate Content](https://ai.google.dev/api/generate-content))
- API-key authentication is documented using the `x-goog-api-key` header. ([API key guidance](https://ai.google.dev/gemini-api/docs/generate-content/api-key))
- The API-reference pages could not be fetched directly in this research pass; these details were visible in first-party search-indexed reference content and remain **unverified from a directly opened page**. Confirm model availability, limits, and supported generation methods with an authenticated account before claiming live acceptance. ([Models](https://ai.google.dev/api/models), [Generate Content](https://ai.google.dev/api/generate-content))

## OpenRouter

- `GET /api/v1/models` documents context length, modalities, pricing, supported parameters, and provider information, with pagination and filtering; its API contract uses Bearer authentication. ([Models API](https://openrouter.ai/docs/api-reference/models/get-models))
- OpenRouter describes Chat Completions as OpenAI-compatible, but the catalog is not proof that every upstream route implements every advertised parameter or has identical availability. ([Chat Completion](https://openrouter.ai/docs/api-reference/chat-completion), [Models API](https://openrouter.ai/docs/api-reference/models/get-models))

## xAI

- `GET /v1/models` returns models available to the authenticating key, including aliases, context, and pricing; `/v1/language-models` provides fuller language-model metadata such as modalities and reasoning capabilities. Authentication uses `Authorization: Bearer`. ([Models reference](https://docs.x.ai/developers/rest-api-reference/inference/models), [Inference overview](https://docs.x.ai/developers/rest-api-reference/inference))
- xAI labels Chat Completions a legacy endpoint and recommends Responses for newer features. A named adapter must not describe Chat Completions as the provider's preferred current surface. ([Chat Completions](https://docs.x.ai/developers/model-capabilities/legacy/chat-completions))
- Key-level model access, aliases, and exact request compatibility remain live-verification requirements. ([Models reference](https://docs.x.ai/developers/rest-api-reference/inference/models))

## Mistral

- `GET /v1/models` lists models available to the user; model cards can declare chat, function-calling, and vision capability flags, context length, and aliases. ([Models](https://docs.mistral.ai/api/endpoint/models))
- Chat uses `/v1/chat/completions`, Bearer authentication, and SSE when streaming. Declared flags do not guarantee every optional parameter works identically across models. ([Chat](https://docs.mistral.ai/api/endpoint/chat))

## DeepSeek

- `GET /models` documents model names, context/output limits, modalities, reasoning effort, and API capabilities; the provider describes its API format as compatible with OpenAI/Anthropic. ([Models](https://api-docs.deepseek.com/api/list-models), [Quickstart](https://api-docs.deepseek.com/quick_start))
- Chat Completions uses Bearer authentication and supports SSE. DeepSeek-specific thinking/reasoning fields and restrictions on some tool choices require provider-specific request handling despite format compatibility. ([Chat Completion](https://api-docs.deepseek.com/api/create-chat-completion))
- Live IDs, aliases, feature behavior, and account access remain unverified without an authenticated request. ([Models](https://api-docs.deepseek.com/api/list-models))

## Groq

- `GET /openai/v1/models` lists available models, including fields such as `active`, context-window, and maximum-completion-token limits. ([Models](https://console.groq.com/docs/models), [API reference](https://console.groq.com/docs/api-reference))
- Chat uses an OpenAI-shaped endpoint, Bearer authentication, and SSE; Groq describes its compatibility as “mostly compatible” and documents unsupported features/fields, some model-dependent. ([API reference](https://console.groq.com/docs/api-reference), [OpenAI compatibility](https://console.groq.com/docs/openai))
- Do not infer full feature equivalence from the endpoint shape. Verify active models, account limits, and exact request parameters against the configured account. ([OpenAI compatibility](https://console.groq.com/docs/openai))

## Azure OpenAI

- The classic resource model-list API is `GET /openai/models?api-version=2024-10-21`, uses `api-key` authentication, and can report lifecycle, deprecation, status, and capability metadata. ([Classic model list](https://learn.microsoft.com/en-us/rest/api/azureopenai/models/list?view=rest-azureopenai-2024-10-21))
- On the `/openai/v1/` endpoint, deployments are aliases and the deployment name is passed as `model`; documentation describes API-key and Entra bearer authentication. This work selects API-key auth only. ([Foundry endpoints](https://learn.microsoft.com/en-us/azure/foundry/foundry-models/concepts/endpoints), [v1 models](https://learn.microsoft.com/en-us/rest/api/aifoundry/azureopenai/models))
- A base-model catalog entry does not establish that a resource has that model deployed or that the caller can invoke it. Verify resource endpoint, API version, region, deployment, and permissions live. ([Classic model list](https://learn.microsoft.com/en-us/rest/api/azureopenai/models/list?view=rest-azureopenai-2024-10-21), [Foundry endpoints](https://learn.microsoft.com/en-us/azure/foundry/foundry-models/concepts/endpoints))

## A2A v1.0 and ACP

- The versioned A2A specification labels 1.0.0 as the latest released version and defines JSON-RPC, gRPC, and HTTP+JSON protocol bindings, selected through declared `AgentInterface` information. The normative protocol definition is `a2a.proto`. ([A2A v1.0 specification](https://a2a-protocol.org/v1.0.0/specification/), [Protocol definitions](https://a2a-protocol.org/v1.0.0/definitions/))
- A2A implementations' actual conformance/interoperability and supported bindings are not established by their use of the A2A name; test each deployed endpoint and report unsupported interfaces. ([What's new in v1.0](https://a2a-protocol.org/v1.0.0/whats-new-v1/), [A2A v1.0 specification](https://a2a-protocol.org/v1.0.0/specification/))
- IBM Research states that ACP is now part of A2A under the Linux Foundation; the joint announcement describes ACP's official merger with A2A and the winding down of ACP's independent active development. Prefer “ACP technology is being incorporated into A2A,” not “ACP was renamed A2A.” ([IBM Research](https://research.ibm.com/projects/agent-communication-protocol), [Joint announcement](https://lfaidata.foundation/communityblog/2025/08/29/acp-joins-forces-with-a2a-under-the-linux-foundations-lf-ai-data/))

## A2A JavaScript SDK

- The official `@a2a-js/sdk` 1.2.1 release implements A2A v1.0 and provides JSON-RPC and HTTP+JSON client/server transports; gRPC is a separate Node-only optional transport. Its client selects a compatible interface from an Agent Card and supports streaming, task retrieval, cancellation, per-call headers, and abort signals. ([v1.2.1 README](https://github.com/a2aproject/a2a-js/tree/v1.2.1))
- The server abstraction uses `DefaultRequestHandler`, a `TaskStore`, and an `AgentExecutor`; Express adapters expose the Agent Card and JSON-RPC routes. Bearer authentication is applied as server middleware and converted to the A2A caller through a `UserBuilder`. ([Sample server](https://raw.githubusercontent.com/a2aproject/a2a-js/v1.2.1/src/samples/agents/sample-agent/index.ts), [Authentication sample](https://raw.githubusercontent.com/a2aproject/a2a-js/v1.2.1/src/samples/authentication/index.ts))
- Package metadata for 1.2.1 declares Apache-2.0, Node >=20, `jose` as a dependency, and Express/gRPC/protobuf as optional peers. npm lists 1.2.1 as published 2026-09-24 and 1.3.0 as published 2026-09-29; pin 1.2.1 to respect this repository's seven-day dependency-age rule. ([v1.2.1 package manifest](https://raw.githubusercontent.com/a2aproject/a2a-js/v1.2.1/package.json), [npm release metadata](https://www.npmjs.com/package/@a2a-js/sdk?activeTab=versions))
- The SDK's in-memory task store is not a substitute for PlayWeld task persistence. Use PlayWeld's project-scoped durable task service/store and ensure user-context authorization is enforced on every load/update; do not expose the SDK's sample authentication or unauthenticated defaults. ([SDK README](https://github.com/a2aproject/a2a-js/tree/v1.2.1), [Authentication sample](https://raw.githubusercontent.com/a2aproject/a2a-js/v1.2.1/src/samples/authentication/index.ts))

## Candidate Exact Model Metadata

These candidates are research inputs for a small versioned catalog, not live account availability. Each model row is keyed by the provider-specific API ID. Facts not listed remain unknown rather than inferred.

- OpenAI `gpt-6-astra`: provider catalog declares a 1.05M context window, 128K maximum output, text/image input, text output, function/web/file/computer tools, and $10 input / $50 output per million tokens. ([OpenAI Models](https://platform.openai.com/docs/models))
- OpenAI `gpt-6-luna`: provider catalog declares a 1.05M context window, 128K maximum output, text/image input, text output, function/web/file/computer tools, and $0.10 input / $0.50 output per million tokens. ([OpenAI Models](https://platform.openai.com/docs/models))
- OpenRouter `openai/gpt-6-astra`: OpenRouter's catalog response reports 1,050,000 context, 128,000 maximum completion from its top-provider data, file/image/text input, text output, tools/tool_choice/reasoning_effort parameters, and $10 input / $50 output per million tokens. This is OpenRouter route metadata, not OpenAI account metadata. ([OpenRouter public model catalog](https://openrouter.ai/api/v1/models?limit=5&sort=most-popular&model_authors=openai))
- xAI `grok-4.3`: xAI's model card reports 1,000,000 context, text/image input, text output, function calling, structured output and reasoning. Prices are tiered at the 200K prompt threshold, so the flat `ModelPricing` contract must leave them unknown instead of collapsing the tiers. ([Grok 4.3](https://docs.x.ai/developers/models/grok-4.3))
- Mistral `mistral-large-2512`: Mistral lists vision, Chat Completions, function calling, structured output, 256K context, and $0.50 input / $1.50 output per million tokens. The model card was dated 2025-12-02. ([Vision guide](https://docs.mistral.ai/studio/conversations/vision), [Mistral Large 3 card](https://docs.mistral.ai/models/mistral-large-3-25-12))
- DeepSeek `deepseek-flash` (documented version DeepSeek-V4.1-Flash): DeepSeek docs report 1M context, 384K max output, text/image input, text output, tool calls and its Responses/Anthropic API surfaces. Its listed peak cache-miss rate is $0.30 input / $1.20 output per million tokens; this does not model cache-hit tiers. ([Models API](https://api-docs.deepseek.com/api/list-models), [Pricing](https://api-docs.deepseek.com/quick_start/pricing/))
- DeepSeek `deepseek-v4-pro` (documented version DeepSeek-V4-Pro-0813): DeepSeek docs report 1M context, 384K max output, text input/output and tool calls. Listed peak cache-miss pricing is $1.32 input / $3.96 output per million tokens, excluding cache-hit tiers. ([Models API](https://api-docs.deepseek.com/api/list-models), [Pricing](https://api-docs.deepseek.com/quick_start/pricing/))
- Groq `openai/gpt-oss-120b`: Groq's supported-model table reports 131,072 context, 65,536 max completion, $0.15 input / $0.60 output per million tokens, and language-model capability descriptions. No tool-calling flag is inferred from browser/code-execution product descriptions. ([Groq Models](https://console.groq.com/docs/models))
- Google Cloud Agent Platform `gemini-3.8-flash`: its model card reports 1,048,576 context, 65,536 maximum output, text/image/audio/video input, text output, function calling and Google Search/Maps grounding. This is **not** a Gemini Developer API catalog row; the chosen API-key Gemini adapter must not import it without matching Developer API sources. ([Gemini 3.8 Flash on Agent Platform](https://cloud.google.com/vertex-ai/generative-ai/docs/models/gemini/3-8-flash))
- Azure Foundry `gpt-6.1-sol` and `gpt-6-astra`: Microsoft documents 1,050,000 context, 922,000 input, 128,000 output and text/image input for these base models. Tool/function support is Responses-API-only; that fact is not equivalent to Chat Completions support. Base model IDs are catalog identifiers, not Azure deployment names. ([Models sold directly by Azure](https://learn.microsoft.com/en-us/azure/foundry/foundry-models/concepts/models-sold-directly-by-azure), [Switching endpoints](https://learn.microsoft.com/en-us/azure/foundry-classic/openai/how-to/switching-endpoints))
- Azure model-list API results are resource-scoped, but a catalog base model still does not prove an account has deployed it. Store the Azure deployment name as `providerModelId` and a sourced base-model key separately as `catalogModelId`; never call the base catalog ID as if it were the deployment. ([Azure Models list](https://learn.microsoft.com/en-us/rest/api/azureopenai/models/list?view=rest-azureopenai-2024-10-21), [Azure endpoint guide](https://learn.microsoft.com/en-us/azure/foundry/foundry-models/concepts/endpoints))

## Routing Category Mapping

- OpenAI explicitly labels `text-embedding-3-small` and `text-embedding-3-large` as embedding models, but neither category exactly matches a builtin work type or role. ([OpenAI embeddings guide](https://platform.openai.com/docs/guides/embeddings), [builtin role/work-type definitions](../../packages/platform-service/src/roles/role-registry.ts))
- Mistral catalog labels `codestral-2508` a “Code model” and `codestral-embed-2505` / `mistral-embed-2312` embedding models. “Code model” is not an exact declared `workType` value, and the embedding labels do not match a builtin work type. ([Mistral models catalog](https://docs.mistral.ai/models), [Codestral](https://docs.mistral.ai/models/codestral-25-08), [Codestral Embed](https://docs.mistral.ai/models/codestral-embed-25-05), [Mistral Embed](https://docs.mistral.ai/models/mistral-embed-23-12))
- Azure documents `text-embedding-3-small` / `text-embedding-3-large` as embeddings and `gpt-image-2.5-sunburst` as image generation; xAI's Models API groups `grok-imagine-image` and `grok-imagine-video` in image/video generation collections. These categories do not match builtin roles/work types, and generation modalities are not expressible by the current chat request. ([Azure model catalog](https://learn.microsoft.com/en-us/azure/foundry/foundry-models/concepts/models-sold-directly-by-azure), [xAI Models API](https://docs.x.ai/developers/rest-api-reference/inference/models))
- OpenRouter exposes a `category` query filter such as `programming`, but its documented per-model records do not declare a category value; Mistral publishes capability booleans and DeepSeek/Groq publish model facts rather than an exact PlayWeld role/work-type assignment. ([OpenRouter Models API](https://openrouter.ai/docs/api/api-reference/models/list-all-models-and-their-properties), [Mistral Models API](https://docs.mistral.ai/api/endpoint/models), [DeepSeek Models API](https://api-docs.deepseek.com/api/list-models), [Groq Models](https://console.groq.com/docs/models))
- Gemini Developer API model pages could not be opened in this pass (429); Vertex/Agent Platform category facts are not interchangeable with the API-key Developer API integration. No Gemini task-family mapping is verified. ([Gemini Models](https://ai.google.dev/api/models), [Gemini 3.8 Flash on Agent Platform](https://cloud.google.com/vertex-ai/generative-ai/docs/models/gemini/3-8-flash))
- No reviewed provider source declares the builtin role IDs in the model registry or task work types documented in the [model-routing guide](../MODEL_ROUTING_GUIDE.md). These arrays are hard eligibility constraints, and empty arrays mean unrestricted. Therefore leave `roles` / `workTypes` unrestricted unless an exact, sourced catalog rule matches the local taxonomy; do not map capability facts or approximate category labels into restrictive tags. ([Model routing guide](../MODEL_ROUTING_GUIDE.md), [role registry](../../packages/platform-service/src/roles/role-registry.ts))

## Implications and Caveats

- Provider discovery depth is heterogeneous: some endpoints expose capabilities and limits; others return little more than IDs. Preserve provider API declarations, official catalog enrichment, and unknown values as distinct evidence sources rather than inferring support from an ID or shared endpoint format.
- Account-scoped model discovery is not deployment proof. In particular, Azure deployments and authenticated model access must remain account/resource-specific.
- Keep per-field provenance and freshness. Treat published prices as estimates, not invoices; retain actual usage separately. Do not issue generation calls as hidden discovery probes.
- An Azure base-model ID supplied in account settings is configuration provenance, not a claim from the resource model-list API; keep it separate from the callable deployment name and from per-model manual overrides.
- Capability facts and router-usable operations are separate: PlayWeld must not route a task through a capability the common request contract cannot express.
- A2A's v1.0 binding selection means JSON-RPC-only clients cannot claim universal A2A interoperability; unsupported Agent Card interfaces must fail explicitly. Public/LAN exposure, OAuth, and gRPC require separate design and validation.
- No live provider credentials or remote A2A endpoints were used. Account-specific catalog contents, aliases, pricing, rate limits, feature behavior, and actual interoperability remain **unverified**.

## Sources

- [OpenAI Models API](https://platform.openai.com/docs/api-reference/models/list)
- [OpenAI Chat Completions](https://platform.openai.com/docs/api-reference/chat/create)
- [OpenAI Authentication](https://platform.openai.com/docs/api-reference/authentication)
- [Anthropic Models API reference](https://github.com/anthropics/anthropic-sdk-typescript/blob/main/api.md)
- [Anthropic ModelInfo and capabilities type](https://github.com/anthropics/anthropic-sdk-typescript/blob/main/src/resources/models.ts)
- [Google Gemini Models](https://ai.google.dev/api/models)
- [Google Gemini Generate Content](https://ai.google.dev/api/generate-content)
- [Google Gemini API keys](https://ai.google.dev/gemini-api/docs/generate-content/api-key)
- [OpenRouter Models API](https://openrouter.ai/docs/api-reference/models/get-models)
- [OpenRouter Chat Completions](https://openrouter.ai/docs/api-reference/chat-completion)
- [xAI Models](https://docs.x.ai/developers/rest-api-reference/inference/models)
- [xAI Chat Completions](https://docs.x.ai/developers/model-capabilities/legacy/chat-completions)
- [xAI Inference](https://docs.x.ai/developers/rest-api-reference/inference)
- [Mistral Models](https://docs.mistral.ai/api/endpoint/models)
- [Mistral Chat](https://docs.mistral.ai/api/endpoint/chat)
- [DeepSeek Models](https://api-docs.deepseek.com/api/list-models)
- [DeepSeek Chat Completions](https://api-docs.deepseek.com/api/create-chat-completion)
- [DeepSeek Quickstart](https://api-docs.deepseek.com/quick_start)
- [Groq Models](https://console.groq.com/docs/models)
- [Groq API reference](https://console.groq.com/docs/api-reference)
- [Groq OpenAI compatibility](https://console.groq.com/docs/openai)
- [Azure OpenAI classic Models API](https://learn.microsoft.com/en-us/rest/api/azureopenai/models/list?view=rest-azureopenai-2024-10-21)
- [Azure Foundry model endpoints](https://learn.microsoft.com/en-us/azure/foundry/foundry-models/concepts/endpoints)
- [Azure OpenAI v1 Models API](https://learn.microsoft.com/en-us/rest/api/aifoundry/azureopenai/models)
- [A2A v1.0 specification](https://a2a-protocol.org/v1.0.0/specification/)
- [A2A v1.0 protocol definitions](https://a2a-protocol.org/v1.0.0/definitions/)
- [A2A v1.0 changes](https://a2a-protocol.org/v1.0.0/whats-new-v1/)
- [A2A JavaScript SDK v1.2.1](https://github.com/a2aproject/a2a-js/tree/v1.2.1)
- [A2A JavaScript SDK sample server](https://raw.githubusercontent.com/a2aproject/a2a-js/v1.2.1/src/samples/agents/sample-agent/index.ts)
- [A2A JavaScript SDK authentication sample](https://raw.githubusercontent.com/a2aproject/a2a-js/v1.2.1/src/samples/authentication/index.ts)
- [A2A JavaScript SDK v1.2.1 package manifest](https://raw.githubusercontent.com/a2aproject/a2a-js/v1.2.1/package.json)
- [A2A JavaScript SDK npm release metadata](https://www.npmjs.com/package/@a2a-js/sdk?activeTab=versions)
- [OpenAI Models catalog](https://platform.openai.com/docs/models)
- [OpenRouter public model catalog response](https://openrouter.ai/api/v1/models?limit=5&sort=most-popular&model_authors=openai)
- [xAI Grok 4.3 model card](https://docs.x.ai/developers/models/grok-4.3)
- [Mistral Vision guide](https://docs.mistral.ai/studio/conversations/vision)
- [Mistral Large 3 model card](https://docs.mistral.ai/models/mistral-large-3-25-12)
- [DeepSeek Models API](https://api-docs.deepseek.com/api/list-models)
- [DeepSeek pricing](https://api-docs.deepseek.com/quick_start/pricing/)
- [Google Gemini 3.8 Flash on Agent Platform](https://cloud.google.com/vertex-ai/generative-ai/docs/models/gemini/3-8-flash)
- [Azure Models sold directly](https://learn.microsoft.com/en-us/azure/foundry/foundry-models/concepts/models-sold-directly-by-azure)
- [Azure endpoint switching guide](https://learn.microsoft.com/en-us/azure/foundry-classic/openai/how-to/switching-endpoints)
- [OpenAI embeddings guide](https://platform.openai.com/docs/guides/embeddings)
- [Mistral model catalog](https://docs.mistral.ai/models)
- [Mistral Codestral model card](https://docs.mistral.ai/models/codestral-25-08)
- [Mistral Codestral Embed model card](https://docs.mistral.ai/models/codestral-embed-25-05)
- [Mistral Embed model card](https://docs.mistral.ai/models/mistral-embed-23-12)
- [xAI Models API](https://docs.x.ai/developers/rest-api-reference/inference/models)
- [OpenRouter model category filters](https://openrouter.ai/docs/api/api-reference/models/list-all-models-and-their-properties)
- [Model routing guide](../MODEL_ROUTING_GUIDE.md)
- [Builtin role registry](../../packages/platform-service/src/roles/role-registry.ts)
- [IBM Research Agent Communication Protocol](https://research.ibm.com/projects/agent-communication-protocol)
- [Joint ACP/A2A consolidation announcement](https://lfaidata.foundation/communityblog/2025/08/29/acp-joins-forces-with-a2a-under-the-linux-foundations-lf-ai-data/)

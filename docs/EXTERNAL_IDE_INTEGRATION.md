# External IDE and native Theia integration

**Last updated:** 2026-10-06

The platform service remains the owner of Project context, model selection, tool permissions, approvals and durable execution records. The new adapters expose those existing paths to external MCP clients and native Theia AI callers.

## External IDE MCP

Build the service, start PlayWeld or its daemon, and configure a local stdio MCP client to launch:

```text
gamecrafter-mcp --project <registered Project UUID> --profile <profile directory>
```

For a repository checkout, the equivalent command is:

```powershell
node packages/platform-service/lib/mcp/external-ide-server.js --project <UUID> --profile <directory>
```

The Project UUID is required. The server never selects the first Project or lets a tool argument replace the bound Project. It reads the existing service credential from local discovery; credentials do not appear in command arguments. The profile option is a directory, not a secret.

The default access ceiling is `restricted`. A configured operator can pass `--access-ceiling ask` or `--access-ceiling full`; that ceiling cannot raise the selected Project's own permission mode. Ask-mode approvals still use PlayWeld's existing approval surface.

`tools/list` returns stable MCP-safe hashed names with the original tool ID in each description. Each input schema is an object containing one `input` property, whose schema is the original platform tool schema. This preserves union/scalar schemas while satisfying MCP's object argument requirement. Supply native arguments under that property, for example `{ "input": { "path": "docs/README.md" } }` for a discovered read-file tool. Calls are executed through `tool/call` and retain their broker records and evidence.

The stdio endpoint supports the repository's `server/discover` contract and legacy `initialize` negotiation. The actual MCP SDK stdio acceptance test covers discovery/list/call, reading the selected Project, rejecting outside-Project reads, unknown tools, durable broker history and credential retention. This is a real SDK/stdio boundary test against an isolated live service; it does not claim that a particular personal IDE configuration has been installed or tested.

## Native Theia AI

The extension contributes one model named **PlayWeld Project model router** (`playweld/router`) to Theia's native language-model registry, plus `playweld_tools` and `playweld_tool` to its tool registry. The adapter forwards requests to the platform router. It does not hold provider credentials or implement another model router.

The default Project comes from the restored workspace. Empty, unknown and ambiguous workspaces are rejected. A caller can provide the registered Project explicitly in `settings["playweld.projectId"]`; it is validated. Workspace changes and cancellation stop subsequent requests and tool mutations. An already submitted service/provider operation can finish; this adapter does not claim transport-level cancellation of that in-flight operation.

The native adapter supports text messages, tool-use/result conversation messages, JSON schema responses and an eight-turn broker tool loop. It returns response/usage/tool-result parts through Theia's async stream interface; provider content is buffered by the service completion call rather than delivered as token deltas. Unsupported image/thinking/compaction/provider-native tool requests are rejected explicitly.

Theia agents should reference `~{playweld_tools}` and `~{playweld_tool}` in their prompt fragments. Discovery returns actual Project tool definitions. Execution goes through the service broker rather than a caller-injected callback. Native agents that need longer autonomous work should create a durable PlayWeld task rather than rely on the bounded in-editor loop.

Unit tests verify routing, usage, broker execution, refusal of foreign callbacks/unsupported payloads, Project override refusal and cancellation/workspace checks. The larger rendered audit additionally checks actual native registry contribution and a service-routed completion against a local synthetic provider. Its exact artifact and packaged status are recorded in [the work record](changes/2026-10-06-external-ide-and-theia-adapters.md).

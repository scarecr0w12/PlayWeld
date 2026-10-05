# Generated documentation surface inventory

Generated from built contracts, built setting definitions, and service source paths. Regenerate with `node scripts/generate-documentation-inventory.cjs`; check freshness with `--check`. Counts do not establish acceptance. The [coverage record](../DOCUMENTATION_COVERAGE.md) owns gaps and observed results.

Request methods: **198**; notifications: **28**; settings: **85**; setting groups: **17**. Full names and test paths are in [the JSON inventory](documentation-inventory.json).

## RPC families

| Family | Methods | Guide | Implementation |
| --- | --- | --- | --- |
| a2a | 10 | [Guide](../USER_GUIDE.md) | [Source](../../packages/platform-service/src/a2a/) |
| asset | 15 | [Guide](../WORKFLOW_COOKBOOK.md) | [Source](../../packages/platform-service/src/assets/) |
| audit | 1 | [Guide](../OPERATIONS_GUIDE.md) | [Source](../../packages/platform-service/src/tools/) |
| backup | 19 | [Guide](../OPERATIONS_GUIDE.md) | [Source](../../packages/platform-service/src/backup/) |
| board | 19 | [Guide](../WORKFLOW_COOKBOOK.md) | [Source](../../packages/platform-service/src/board/) |
| broker | 2 | [Guide](../WORKFLOW_COOKBOOK.md) | [Source](../../packages/platform-service/src/tools/) |
| change | 11 | [Guide](../WORKFLOW_COOKBOOK.md) | [Source](../../packages/platform-service/src/change/) |
| chat | 5 | [Guide](../WORKED_TUTORIAL.md) | [Source](../../packages/platform-service/src/chat/) |
| dcc | 8 | [Guide](../INTEGRATION_GUIDE.md) | [Source](../../packages/platform-service/src/dcc/) |
| decisions | 2 | [Guide](../USER_GUIDE.md) | [Source](../../packages/platform-service/src/models/) |
| engine | 8 | [Guide](../INTEGRATION_GUIDE.md) | [Source](../../packages/platform-service/src/engines/) |
| knowledge | 11 | [Guide](../WORKFLOW_COOKBOOK.md) | [Source](../../packages/platform-service/src/knowledge/) |
| mcp | 11 | [Guide](../EXTENSION_COOKBOOK.md) | [Source](../../packages/platform-service/src/mcp/) |
| model | 5 | [Guide](../USER_GUIDE.md) | [Source](../../packages/platform-service/src/models/) |
| plugin | 14 | [Guide](../EXTENSION_COOKBOOK.md) | [Source](../../packages/platform-service/src/plugins/) |
| pool | 4 | [Guide](../USER_GUIDE.md) | [Source](../../packages/platform-service/src/models/) |
| project | 6 | [Guide](../WORKED_TUTORIAL.md) | [Source](../../packages/platform-service/src/projects/) |
| provider | 5 | [Guide](../USER_GUIDE.md) | [Source](../../packages/platform-service/src/models/) |
| roles | 2 | [Guide](../EXTENSION_COOKBOOK.md) | [Source](../../packages/platform-service/src/roles/) |
| router | 4 | [Guide](../USER_GUIDE.md) | [Source](../../packages/platform-service/src/models/) |
| service | 2 | [Guide](../OPERATIONS_GUIDE.md) | [Source](../../packages/platform-service/src/ipc/) |
| session | 1 | [Guide](../SERVICE_RECIPES.md) | [Source](../../packages/platform-service/src/ipc/) |
| settings | 6 | [Guide](../SETTINGS_REFERENCE.md) | [Source](../../packages/platform-service/src/settings/) |
| skills | 10 | [Guide](../EXTENSION_COOKBOOK.md) | [Source](../../packages/platform-service/src/skills/) |
| task | 8 | [Guide](../WORKFLOW_COOKBOOK.md) | [Source](../../packages/platform-service/src/tasks/) |
| tool | 3 | [Guide](../EXTENSION_COOKBOOK.md) | [Source](../../packages/platform-service/src/tools/) |
| update | 6 | [Guide](../RELEASE_GUIDE.md) | [Source](../../packages/platform-service/src/updates/) |

## Settings groups

| Group | Settings | Reference |
| --- | --- | --- |
| general: General & background behaviour | 1 | [Exact values and scopes](../SETTINGS_REFERENCE.md) |
| projects: Projects, genres & modules | 1 | [Exact values and scopes](../SETTINGS_REFERENCE.md) |
| agents: Agents, swarms & skills | 4 | [Exact values and scopes](../SETTINGS_REFERENCE.md) |
| models: Model providers & routing | 13 | [Exact values and scopes](../SETTINGS_REFERENCE.md) |
| connections: Engine, asset & tool connections | 2 | [Exact values and scopes](../SETTINGS_REFERENCE.md) |
| access: Access & security | 4 | [Exact values and scopes](../SETTINGS_REFERENCE.md) |
| board: Discussion board | 6 | [Exact values and scopes](../SETTINGS_REFERENCE.md) |
| plugins: Plugins & updates | 7 | [Exact values and scopes](../SETTINGS_REFERENCE.md) |
| storage: Storage, search & backup | 2 | [Exact values and scopes](../SETTINGS_REFERENCE.md) |
| logs: Logs & audit | 1 | [Exact values and scopes](../SETTINGS_REFERENCE.md) |
| engine: Engine connectors | 3 | [Exact values and scopes](../SETTINGS_REFERENCE.md) |
| knowledge: Knowledge & search | 12 | [Exact values and scopes](../SETTINGS_REFERENCE.md) |
| assets: Assets | 6 | [Exact values and scopes](../SETTINGS_REFERENCE.md) |
| backup: Backups | 7 | [Exact values and scopes](../SETTINGS_REFERENCE.md) |
| dcc: DCC tools | 5 | [Exact values and scopes](../SETTINGS_REFERENCE.md) |
| coordination: Coordination | 6 | [Exact values and scopes](../SETTINGS_REFERENCE.md) |
| updates: Updates | 5 | [Exact values and scopes](../SETTINGS_REFERENCE.md) |

## Service subsystems

| Area | Explanation | Source | Test files |
| --- | --- | --- | --- |
| a2a | [Guide](../USER_GUIDE.md) | [Source](../../packages/platform-service/src/a2a/) | 2 |
| agents | [Guide](../TECHNICAL_ARCHITECTURE.md) | [Source](../../packages/platform-service/src/agents/) | 3 |
| assets | [Guide](../WORKFLOW_COOKBOOK.md) | [Source](../../packages/platform-service/src/assets/) | 5 |
| backup | [Guide](../OPERATIONS_GUIDE.md) | [Source](../../packages/platform-service/src/backup/) | 9 |
| board | [Guide](../WORKFLOW_COOKBOOK.md) | [Source](../../packages/platform-service/src/board/) | 4 |
| change | [Guide](../WORKFLOW_COOKBOOK.md) | [Source](../../packages/platform-service/src/change/) | 5 |
| chat | [Guide](../WORKED_TUTORIAL.md) | [Source](../../packages/platform-service/src/chat/) | 0 |
| db | [Guide](../TECHNICAL_ARCHITECTURE.md) | [Source](../../packages/platform-service/src/db/) | 2 |
| dcc | [Guide](../INTEGRATION_GUIDE.md) | [Source](../../packages/platform-service/src/dcc/) | 5 |
| engines | [Guide](../INTEGRATION_GUIDE.md) | [Source](../../packages/platform-service/src/engines/) | 4 |
| ipc | [Guide](../SERVICE_RECIPES.md) | [Source](../../packages/platform-service/src/ipc/) | 3 |
| knowledge | [Guide](../WORKFLOW_COOKBOOK.md) | [Source](../../packages/platform-service/src/knowledge/) | 11 |
| mcp | [Guide](../EXTENSION_COOKBOOK.md) | [Source](../../packages/platform-service/src/mcp/) | 13 |
| models | [Guide](../USER_GUIDE.md) | [Source](../../packages/platform-service/src/models/) | 10 |
| plugins | [Guide](../EXTENSION_COOKBOOK.md) | [Source](../../packages/platform-service/src/plugins/) | 4 |
| processes | [Guide](../TECHNICAL_ARCHITECTURE.md) | [Source](../../packages/platform-service/src/processes/) | 1 |
| profile | [Guide](../TECHNICAL_ARCHITECTURE.md) | [Source](../../packages/platform-service/src/profile/) | 2 |
| projects | [Guide](../WORKED_TUTORIAL.md) | [Source](../../packages/platform-service/src/projects/) | 1 |
| roles | [Guide](../EXTENSION_COOKBOOK.md) | [Source](../../packages/platform-service/src/roles/) | 2 |
| settings | [Guide](../SETTINGS_REFERENCE.md) | [Source](../../packages/platform-service/src/settings/) | 2 |
| skills | [Guide](../EXTENSION_COOKBOOK.md) | [Source](../../packages/platform-service/src/skills/) | 8 |
| tasks | [Guide](../WORKFLOW_COOKBOOK.md) | [Source](../../packages/platform-service/src/tasks/) | 2 |
| tools | [Guide](../EXTENSION_COOKBOOK.md) | [Source](../../packages/platform-service/src/tools/) | 2 |
| updates | [Guide](../RELEASE_GUIDE.md) | [Source](../../packages/platform-service/src/updates/) | 3 |
| workers | [Guide](../TECHNICAL_ARCHITECTURE.md) | [Source](../../packages/platform-service/src/workers/) | 1 |

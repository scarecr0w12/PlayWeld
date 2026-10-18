# Architecture and API

The desktop presents domain state; the local service owns it. Adding a UI or plugin must not create a second authoritative Project/task store.

| Component            | Responsibility                                                       |
| -------------------- | -------------------------------------------------------------------- |
| contracts            | TypeBox schemas, derived types, RPC/errors                           |
| platform-service     | Profiles/Projects, persistence, routing, tasks, broker, integrations |
| service-client       | Typed authenticated client                                           |
| theia-control-room   | Frontend views and backend service bridge                            |
| control-room         | Electron desktop                                                     |
| control-room-browser | Development browser                                                  |

Technical names retain @gamecrafter compatibility. See [system architecture](https://github.com/scarecr0w12/PlayWeld/blob/main/docs/SYSTEM_ARCHITECTURE.md).

## Transport and data

Authenticated JSON-RPC uses a Unix socket or Windows named pipe with session/hello first. This is not an HTTP REST API. Use the typed client; do not invent newline framing or expose tokens.

Profiles own registration/settings/accounts; Projects own manifests, docs/, game/ and .gamecrafter/ operational data. SQLite goes through packages/platform-service/src/db/database.ts. Contracts/stores own schema versions and migrations.

Notifications signal change. After reconnect, query durable state rather than inferring completion from a missed event. Leases, checkpoints, approvals, worktrees and integration records belong to the service.

## Engineering references

- [RPC](https://github.com/scarecr0w12/PlayWeld/blob/main/docs/API_REFERENCE.md): exact request/result/notification schemas.
- [Settings](https://github.com/scarecr0w12/PlayWeld/blob/main/docs/SETTINGS_REFERENCE.md): keys, defaults, scopes/types.
- [Service recipes](https://github.com/scarecr0w12/PlayWeld/blob/main/docs/SERVICE_RECIPES.md): typed client examples.
- [Extension cookbook](https://github.com/scarecr0w12/PlayWeld/blob/main/docs/EXTENSION_COOKBOOK.md): supported extension points.

The [platform design](https://github.com/scarecr0w12/PlayWeld/blob/main/docs/PLATFORM_DESIGN.md) describes the complete intended system, including proposals. Use [status](https://github.com/scarecr0w12/PlayWeld/blob/main/docs/STATUS.md) and [verification limits](https://github.com/scarecr0w12/PlayWeld/wiki/Verification-and-Limits) to assess implementation evidence rather than treating design text as completion.

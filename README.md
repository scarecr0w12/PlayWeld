# PlayWeld

![PlayWeld](assets/brand/banner-wide.png)

PlayWeld is a free, open-source, locally run game development platform: an all-in-one Game Development Control Room built on Eclipse Theia, a local platform service that owns Projects, agents, model routing, and plugins, and CLI/MCP connectors to Unity, Unreal Engine, Godot, and game-art tools. It is designed for one user first and for anyone who installs it from GitHub. Licensed under [Apache-2.0](LICENSE).

**Public identity:** PlayWeld, formerly GameCrafter. The user owns `playweld.com`; website implementation belongs to a separate project. See [branding and compatibility](docs/BRANDING.md) for retained technical identifiers.

This repository holds both the design and the code. The design describes the complete intended system by architectural area; the code implements it in dependency-ordered work packages.

**Artwork:** [Brand assets and usage guide](assets/brand/README.md) includes editable logos, app icons, banners, and promotional illustrations.

## Documents

Start with the [complete documentation index](docs/README.md): [user workflows](docs/USER_GUIDE.md), [operations and recovery](docs/OPERATIONS_GUIDE.md), [developer guide](docs/DEVELOPER_GUIDE.md), [integrations and extensions](docs/INTEGRATION_GUIDE.md), [system architecture](docs/SYSTEM_ARCHITECTURE.md), [RPC API](docs/API_REFERENCE.md), and [settings reference](docs/SETTINGS_REFERENCE.md).

- [Living platform design](docs/PLATFORM_DESIGN.md): confirmed decisions, proposed architecture, and decision log.
- [Technical architecture](docs/TECHNICAL_ARCHITECTURE.md): the complete target stack with selected engineering defaults.
- [Skills, agent roles, and tool connections](docs/SKILLS_AGENTS_AND_TOOLS.md): installable skills (Agent Skills format), agent role packages, MCP connections, and engine/DCC connectors.
- [Decision register](docs/OPEN_DECISIONS.md): every identified unresolved product, technical, and verification decision, with recommended defaults and status.
- [Development plan](docs/DEVELOPMENT_PLAN.md): work packages ordered by technical dependency, what each implements, and their current status.
- [Implementation status and remaining work](docs/STATUS.md): what exists today, how far it has been verified, and what is still open, grouped by area.
- [Full project review](docs/FULL_PROJECT_REVIEW.md): repaired defects, verification evidence, and remaining implementation/verification gaps across the complete system.
- [Research notes](docs/research/): sourced reference material. Each note carries a "Last researched" date; re-verify before relying on a fast-moving fact.

For versioned installers and a local Windows test executable, see the [release guide](docs/RELEASE_GUIDE.md).

Every contribution must include a permanent [work record](docs/changes/README.md) with details, affected files, version impact and actual validation. See the generated [changelog](CHANGELOG.md) for pending work and recorded versions. CI checks coverage; release preparation carries the full details into versioned release notes.

## Code

| Path                          | Package                             | Purpose                                                                                                                                                 |
| ----------------------------- | ----------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `packages/contracts`          | `@gamecrafter/contracts`            | TypeBox schemas, types, RPC method table, error codes                                                                                                   |
| `packages/platform-service`   | `@gamecrafter/platform-service`     | Local daemon: authenticated JSON-RPC over a Unix socket / named pipe, profile SQLite, Project workspaces; CLI `gamecrafter-service start\|stop\|status` |
| `packages/service-client`     | `@gamecrafter/service-client`       | Typed client used by the Theia backend and tests                                                                                                        |
| `packages/theia-control-room` | `@gamecrafter/theia-control-room`   | Theia extension: service bridge, grouped PlayWeld navigation, Project Home, chat, teamwork, reference and workspace views                                  |
| `apps/control-room`           | `@gamecrafter/control-room`         | Theia Electron application (the desktop product)                                                                                                        |
| `apps/control-room-browser`   | `@gamecrafter/control-room-browser` | Development-only browser target for UI smoke tests                                                                                                      |

### Build and run

Requirements: Node 24, npm 11, git. Linux additionally needs `libx11-dev libxkbfile-dev libsecret-1-dev` for Theia's native modules.

```bash
npm ci
npx turbo run build typecheck lint test   # packages
npm run download:plugins                  # VS Code builtin plugins (Git, themes, language basics)
npm run build -w @gamecrafter/control-room-browser && npm run start -w @gamecrafter/control-room-browser   # http://127.0.0.1:3000
npm run build -w @gamecrafter/control-room && npm run start -w @gamecrafter/control-room                   # Electron
```

The Control Room starts the platform service automatically if it is not running. Set `GAMECRAFTER_PROFILE_DIR` to use a separate profile (settings, token, socket, registry) for testing.

Agent instructions for working in this repository are in [AGENTS.md](AGENTS.md); project skills and subagent profiles live under [.agents/](.agents/).

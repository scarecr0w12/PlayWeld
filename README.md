# PlayWeld

![PlayWeld](assets/brand/banner-wide.png)

PlayWeld is a free, open-source desktop workspace for game development. Bring your game files, design documents, model-assisted agents, and tools together in a locally run Control Room built on Eclipse Theia.

Use PlayWeld to organize Projects, discuss design decisions, search Project knowledge, supervise agent work, and connect engines and game-art tools. A local platform service stores Project and task records and runs operations. Engines, model endpoints, and external services need their own setup; remote providers can send data off-machine and incur charges.

Licensed under [Apache-2.0](LICENSE). PlayWeld was formerly GameCrafter; existing package names, commands, and data paths retain that name for compatibility. See the [branding guide](docs/BRANDING.md).

## Start here

| You want to…                                 | Read                                                                                                              |
| -------------------------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| Set up PlayWeld and create a game Project    | [User guide](docs/USER_GUIDE.md)                                                                                  |
| Learn with a disposable example Project      | [Lantern Workshop tutorial](docs/WORKED_TUTORIAL.md)                                                              |
| Find a screen or understand its controls     | [Control Room handbook](docs/CONTROL_ROOM_HANDBOOK.md)                                                            |
| Configure models, engines, or external tools | [Models and routing](docs/USER_GUIDE.md#configure-models-and-routing) · [Integrations](docs/INTEGRATION_GUIDE.md) |
| Troubleshoot or recover your data            | [Operations and recovery](docs/OPERATIONS_GUIDE.md)                                                               |
| Contribute to PlayWeld                       | [Developer guide](docs/DEVELOPER_GUIDE.md) · [Repository instructions](AGENTS.md)                                 |

Browse the [documentation index](docs/README.md) for workflows, references, architecture, and verification records.

## Build and run

To use a versioned Windows build, read the [release and local testing guide](docs/RELEASE_GUIDE.md). It explains how testing builds are distributed and which installation checks remain open.

To run from source, use **Node 24 or later, npm 11, and Git**. Linux also needs `libx11-dev`, `libxkbfile-dev`, and `libsecret-1-dev`. Windows needs the native build prerequisites in the [developer guide](docs/DEVELOPER_GUIDE.md#development-environment).

Run these commands from the repository root:

```bash
npm ci
npx turbo run build typecheck lint test
npm run download:plugins
npm run build -w @gamecrafter/control-room
npm run start -w @gamecrafter/control-room
```

The Control Room starts the platform service automatically when needed. Once connected, [create or open a Project](docs/USER_GUIDE.md#create-or-open-a-project). Creating a PlayWeld Project organizes your workspace; native game setup is a separate step.

For a separate test profile, set `GAMECRAFTER_PROFILE_DIR` before launching. The [tutorial](docs/WORKED_TUTORIAL.md#start-an-isolated-workspace) shows a complete example that also separates editor preferences.

### Development browser

The browser application supports development and UI smoke testing. Build and start it separately:

```bash
npm run build -w @gamecrafter/control-room-browser
npm run start -w @gamecrafter/control-room-browser
```

Open `http://127.0.0.1:3000`. The Electron application is the desktop product.

## What is available today?

The [implementation status](docs/STATUS.md) describes current capabilities, verification evidence, and remaining work. The [development plan](docs/DEVELOPMENT_PLAN.md) tracks individual work packages by technical dependency. The design documents describe the complete intended system, including work that remains open.

Tests and screenshots have specific limits. A browser fixture demonstrates the recorded workflow; live engine checks apply to the named engine, version, and Project. Use the [verification index](docs/README.md#verification-and-research) to find the evidence relevant to your use.

## Code

| Path                          | Purpose                                                                |
| ----------------------------- | ---------------------------------------------------------------------- |
| `packages/contracts`          | Shared schemas, types, RPC methods, and error codes                    |
| `packages/platform-service`   | Local service, persistent records, agents, routing, and tool execution |
| `packages/service-client`     | Typed client for the service                                           |
| `packages/theia-control-room` | Control Room views and service bridge                                  |
| `apps/control-room`           | Theia Electron desktop application                                     |
| `apps/control-room-browser`   | Development browser application                                        |

See the [developer guide](docs/DEVELOPER_GUIDE.md#navigate-the-repository) for the full repository map and contribution workflow. Every contribution needs a permanent [work record](docs/changes/README.md); the generated [changelog](CHANGELOG.md) collects pending and versioned work.

## Documents

- [Platform design](docs/PLATFORM_DESIGN.md): user-confirmed requirements, proposed architecture, and decision log.
- [Technical architecture](docs/TECHNICAL_ARCHITECTURE.md): target stack and selected engineering defaults.
- [Skills, agents, and tools](docs/SKILLS_AGENTS_AND_TOOLS.md): extension and connection contracts.
- [Decision register](docs/OPEN_DECISIONS.md): retained decisions and open verification questions.
- [Full project review](docs/FULL_PROJECT_REVIEW.md): repaired defects, verification evidence, and remaining gaps.
- [Research library](docs/research/): dated reference notes with source links.
- [Brand assets](assets/brand/README.md): editable logos, icons, banners, and usage guidance.

Project skills and agent profiles live under [.agents/](.agents/). Website implementation for `playweld.com` belongs to a separate project.

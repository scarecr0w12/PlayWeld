# PlayWeld developer guide

**Last updated:** 2026-10-06

**Audience:** Contributors changing the platform, Control Room, connectors or documentation. [Documentation index](README.md).

## Find your contribution path

| Task                                           | Section                                                               |
| ---------------------------------------------- | --------------------------------------------------------------------- |
| Set up and verify a checkout                   | [Development environment](#development-environment)                   |
| Locate the code that owns a behavior           | [Repository map](#navigate-the-repository)                            |
| Change a contract or service operation         | [Service behavior](#add-or-change-service-behavior)                   |
| Call the service from code                     | [Typed client](#use-the-local-typed-client)                           |
| Change a desktop view                          | [Control Room development](#extend-the-control-room)                  |
| Choose validation for a change                 | [Testing strategy](#testing-strategy)                                 |
| Update pins or generated output                | [Dependencies and generated files](#dependencies-and-generated-files) |
| Write documentation and prepare a contribution | [Documentation and review](#documentation-and-contribution-review)    |

Read [AGENTS.md](../AGENTS.md) before editing. Every contribution needs a pending [work record](changes/README.md) with affected paths and actual validation.

## Development environment

Use Node 24 or later, npm 11 and Git. Dependencies are pinned to exact versions; all Theia packages use the same version. The current repository pins Theia 1.75.0 and Electron 42.10.0. Check package manifests rather than assuming another checkout has these pins.

On Linux, install the Theia native prerequisites `libx11-dev`, `libxkbfile-dev` and `libsecret-1-dev`. Bubblewrap is needed for the supported plugin-isolation tests. Docker is required for optional live Qdrant/MCP-container checks. A missing optional capability must produce an explicit skip or unavailable result, not a false pass. The Qdrant image needs a Linux-container daemon; a Windows-mode Docker daemon is explicitly skipped. Hosted browser smoke uses the test script's explicit `--no-sandbox` option on the disposable CI runner because its Chromium user namespaces are blocked. The desktop product configuration is unchanged.

Windows needs the compiler/Python prerequisites for native Node modules and Electron rebuilds. The hosted workflow uses [ensure-windows-spectre](../.github/actions/ensure-windows-spectre/) to obtain the required Visual Studio Spectre libraries. Inspect that action and the actual native-module error before modifying the toolchain.

Keep each OS's checkout/dependency tree separate. WSL can launch native Windows Node, but Linux npm must not rebuild a native Windows `node_modules` tree in place. Native module format/ABI must match the Electron or Node process that loads it.

```bash
npm ci
npx turbo run build typecheck lint test
npm run format:check
bash scripts/check-links.sh
```

`npm run build` builds package workspaces. Application builds are separate and can be expensive because of Theia generation/native rebuilds. Turborepo describes task dependencies in [turbo.json](../turbo.json). Package output is CommonJS; TypeScript is strict.

## Navigate the repository

| Path                                       | Responsibility                                                  |
| ------------------------------------------ | --------------------------------------------------------------- |
| `packages/contracts/src/`                  | Shared schemas, types and RPC definitions                       |
| `packages/platform-service/src/`           | Domain services, stores, supervisor, broker, connectors         |
| `packages/service-client/src/`             | Typed local service client                                      |
| `packages/theia-control-room/src/browser/` | React/Theia view contributions and styles                       |
| `packages/theia-control-room/src/node/`    | Backend service bridge and event handling                       |
| `packages/theia-control-room/src/common/`  | Bridge protocol shared by frontend/backend                      |
| `packages/plugin-sdk/`                     | Plugin worker helper and protocol implementation                |
| `packages/plugins/sample-hello/`           | End-to-end sample plugin                                        |
| `apps/control-room/`                       | Desktop application and release scripts                         |
| `apps/control-room-browser/`               | Browser development and smoke target                            |
| `.agents/skills/`                          | Project skills and bundled development skills                   |
| `packages/platform-service/roles/`         | Eleven builtin role packages                                    |
| `scripts/`                                 | Capture, link/reference maintenance and live acceptance tooling |
| `docs/`                                    | Guides, design authorities, status and sourced research         |

Read [AGENTS.md](../AGENTS.md) before editing. It specifies document roles, metadata conventions, dependency policy and verification requirements. Use repository skills when their scope applies.

## Add or change service behavior

Make contracts the shared boundary. Define input/result/persisted schemas in the relevant contracts domain, derive TypeScript types from them, export them, and add the RPC definition when exposing a method. Include `schemaVersion` where required by the record contract. Closed schemas reject additional properties; do not send guessed fields from a widget.

Implement state ownership in the platform service. Use stores and migrations for durable state; use [database.ts](../packages/platform-service/src/db/database.ts) for SQLite access. Do not import `node:sqlite` directly in a frontend, plugin or unrelated storage module.

Register the handler in [service.ts](../packages/platform-service/src/service.ts). Emit the appropriate typed notifications after the underlying persisted change. Add typed bridge methods only when a Theia surface needs them. The service-client's generic `call` method already derives parameter/result types from `RpcMethods`.

A behavioral change should cover the defect or acceptance contract with a meaningful test. A test that only repeats implementation details is not useful. Reproduce lifecycle, permission, identity, cleanup and persistence boundaries where they are the source of the risk.

After building, regenerate API/settings references if their sources changed:

```bash
node scripts/generate-system-reference.cjs
node scripts/generate-system-reference.cjs --check
```

The generator reads built packages. Regenerating before compilation can produce stale documentation even if the generator exits successfully. Its check compares committed reference content to the loaded build.

## Use the local typed client

Start an isolated service before running a client example:

```bash
GAMECRAFTER_PROFILE_DIR=/absolute/path/to/dev-profile node packages/platform-service/lib/cli.js start
```

Use the same profile environment in the client process. In a Node script running from the workspace, after package builds:

```javascript
const { connect, discover } = require('@gamecrafter/service-client');

async function main() {
  const options = await discover();
  const client = await connect({
    ...options,
    clientName: 'documentation example',
    clientVersion: '0.1.0',
  });
  try {
    const info = await client.call('service/info', {});
    const result = await client.call('project/list', {});
    console.log(
      info.serviceVersion,
      result.projects.map((p) => p.name),
    );
  } finally {
    client.close();
  }
}
main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
```

`discover` reads the token and resolves the local endpoint; do not print that token. `connect` performs `session/hello`. Protocol mismatch or authentication failure must fail before executing other requests. Close clients in cleanup paths.

The transport is JSON-RPC with `vscode-jsonrpc` stream framing over a socket/pipe. A newline-delimited JSON writer intended for a plugin worker is not a replacement for the service-client transport. The two protocols have separate framing and lifecycle contracts.

Subscribe to notifications before triggering event-producing work. On reconnect, query durable state again. Errors map to `RpcError`; operation methods may also return a record whose status is failed. The [RPC reference](API_REFERENCE.md) and schema export provide every current request and notification.

## Extend the Control Room

Frontend view widgets live under the Theia extension, with contribution modules and shared styles. Backend methods bridge typed service calls. Keep domain policy, persistence and side-effect execution in the service.

The UI's dark violet/neon green theme is contributed by [theme-contribution.ts](../packages/theia-control-room/src/browser/theme-contribution.ts). Layout/component styles are in [workstation.css](../packages/theia-control-room/src/browser/style/workstation.css). Preserve readable contrast, visible focus, narrow-dock layouts, form error messages and disabled states while extending the design.

Build the Electron application for desktop changes:

```bash
npm run build -w @gamecrafter/control-room
```

For repeatable browser smoke:

```bash
npm run build -w @gamecrafter/control-room-browser
npm run start -w @gamecrafter/control-room-browser
# In another terminal, with the same isolated profile configured:
npm run test:ui
```

The smoke script creates disposable Projects under `.turbo/live-projects`, checks view navigation and captures evidence. Electron smoke requires an app launched with a local Chrome DevTools endpoint; use `node scripts/live-ui-smoke.cjs --electron` and `GAMECRAFTER_CDP_URL` when configuring it. A live remote-debug endpoint should remain local to the test host.

### Refresh documentation screenshots

The documentation runner uses the built development browser, creates an isolated service/profile and Lantern Workshop Project, configures a deterministic local chat/agent fixture, and stores captures plus a redacted `capture-report.json`. It does not need or validate a paid model, engine/editor, or installer. It stops the browser/backend/service/provider processes it owns. Review the report's browser/service version, source identity, checks and `rendererErrors` before publishing images; captures are not proof for a later build.

```powershell
$env:GAMECRAFTER_DOC_OUTPUT = Join-Path (Get-Location) 'docs\images\lantern-workshop'
node scripts/capture-documentation.cjs --scenario overview

$env:GAMECRAFTER_DOC_OUTPUT = Join-Path (Get-Location) 'docs\images\lantern-workflows-2026-10-04'
node scripts/capture-documentation.cjs --scenario all
```

The runner selects rendered page sections and expands disclosures before operating their controls. Keep selectors tied to the visible widget: Theia can retain inactive widget DOM, and a hidden copy can otherwise make a capture appear to pass without changing the active page. Rebuild the browser only when its source changed; do not overwrite a concurrently running native application build during image capture.

Do not infer accessibility completion from the visual smoke. Provider-backed chat, all asset interactions, physical desktop controls and broader accessibility acceptance have separate gaps.

## Testing strategy

| Test type              | Proves                                                                    | Does not prove                                      |
| ---------------------- | ------------------------------------------------------------------------- | --------------------------------------------------- |
| Contract/unit          | Validation, calculations and localized invariants                         | Integration with a real service or engine           |
| Service integration    | Persistence, IPC, scheduling and broker behavior under the chosen fixture | A provider or engine fixture becoming live support  |
| Adversarial isolation  | The exercised filesystem/process/network boundary on the tested host      | Universal OS sandbox security                       |
| Browser/Electron smoke | Rendered flow, navigation and observed errors                             | Every UI behavior or physical input device          |
| Live connector/engine  | Actual binary/server/engine behavior on a named fixture                   | Production game acceptance or untested versions     |
| Packaging/startup      | Artifact construction and observed launch                                 | Install/uninstall, signature and rollback lifecycle |

Iterate with the narrowest affected package:

```bash
npm test -w @gamecrafter/contracts
npm test -w @gamecrafter/platform-service
npm test -w @gamecrafter/theia-control-room
```

Finish code changes with `npx turbo run build typecheck lint test`, format check and link check. The application workspaces explicitly skip their own typecheck/lint/test scripts; their build and separate rendered smoke cover different evidence. Report named skips and host capabilities.

Engine fixtures and their runners are separate from repository unit tests. Read [baseline acceptance](LIVE_ENGINE_ACCEPTANCE.md) and [extended acceptance](EXTENDED_ENGINE_ACCEPTANCE.md) before launching them. Never substitute a production game for a disposable fixture merely to obtain a live test result.

## Dependencies and generated files

Pin exact versions. Prefer a release at least seven days old and check `npm view <package> time` when selecting an update. Keep Theia pins aligned and update `package-lock.json` with npm. Do not mix package managers or make speculative transitive changes to silence an alert.

Native application outputs, downloaded plugins, caches, installers, test databases, screenshots, recorded audio and generated engine Projects stay out of source control. The root ignore file includes `Windows-Release`, Python bytecode and operational outputs. Version source fixtures, sanitized acceptance summaries and reproducible runners.

The archive extractor is a maintained workspace package replacing the upstream extractor path used by Theia. Review its extraction tests and actual dependency resolution when auditing advisory applicability; a matching package name alone is insufficient to conclude a code path is vulnerable or fixed.

## Documentation and contribution review

Write guides around the reader's task. The root README introduces the product and provides a starting point; the documentation index helps readers choose a guide. Keep detailed procedures in their owning guide and link to them from other entry points.

For user-facing documentation:

- State who the guide is for and what the reader will accomplish.
- Give long guides a short task list or navigation table near the top.
- Put prerequisites before commands. State the working directory and label OS-specific examples.
- Use numbered steps for sequences, tables for comparisons, and short paragraphs for explanations.
- Match screen and control names to the interface. Explain unfamiliar terms or link to the glossary.
- Tell the reader what result to check and where to go if it fails.
- Place limitations beside the relevant operation; keep detailed capture history in evidence records.
- Preserve existing section anchors when reorganizing content, or update all links that use them.
- Keep historical reports and generated references intact. Link to current status instead of copying counts or old acceptance summaries into introductions.

Before handing off work, add or update a pending [work record](changes/README.md) with every meaningful outcome, affected path, version impact, and checks actually performed. Run `npm run changelog:update` and `npm run changelog:check -- --base HEAD`; use the branch base to include earlier commits. Released records are permanent. The [release guide](RELEASE_GUIDE.md) covers version preparation and packaging gates.

Keep design authority separate from operational guidance. Only the user confirms requirements/decisions. Selected engineering defaults belong in technical architecture. Keep decision IDs and resolved entries; change status in place. Dependency ordering belongs only in the development plan.

Document behavior against code and evidence. New research belongs in `docs/research`, with source URLs for factual claims and a Last researched date. Do not promote old research into a design guarantee without rechecking it.

Before committing, review the staged diff, check for credentials/large generated artifacts, and run required checks. A focused commit should describe the concrete behavior and evidence. Push normally; never force-push shared `main` to hide divergence. If a remote change arrived, fetch and reconcile it explicitly.

The current platform still has open live-provider, release, isolation and UI integration work. Contributions should reference [status](STATUS.md) and the [development plan](DEVELOPMENT_PLAN.md) rather than declaring the complete target system finished.

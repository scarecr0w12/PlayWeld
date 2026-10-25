---
name: theia-app-dev
description: Scaffold, extend, and run the Eclipse Theia desktop application and Theia extensions for the Game Development Control Room (TypeScript, InversifyJS DI, contribution points, Electron target, Theia AI agents and tool providers). Use when creating the Theia monorepo, adding a Theia extension, wiring a widget/command/menu/preference, or integrating a Theia AI agent.
license: MIT
compatibility: "Requires Node.js >=24, npm 11 (Theia dropped yarn), and native build tools for Electron rebuilds (Linux: libx11-dev libxkbfile-dev libsecret-1-dev). Desktop target is Electron on Windows/Linux only."
metadata:
  author: gamedev-platform
  version: "1.1"
---

# Theia application and extension development

Project rule: the Theia app is a **client** of the local platform service. Do not put durable state (tasks, board, router learning, Project records) in Theia frontend/backend code; call the service over its RPC API. See `docs/TECHNICAL_ARCHITECTURE.md`.

## Where things are in this repository

- `apps/control-room` (Electron, the product) and `apps/control-room-browser` (browser, dev-only for Playwright smoke tests) are Theia application packages; `packages/theia-control-room` is the Theia extension. All `@theia/*` packages are pinned to **1.75.0**, `electron` to **42.11.18**, React 19 (a Theia peer dependency since 1.74). Never bump one Theia package alone.
- Build: `npm run build -w @gamecrafter/control-room-browser` / `-w @gamecrafter/control-room` (the Electron script runs `theia rebuild:electron` first). Start: `npm run start -w <app>`; the browser target listens on `http://127.0.0.1:3000`. `npm run download:plugins` fetches the VS Code builtin plugins listed under `theiaPlugins` into `/plugins` (shared by both apps). Theia-generated files (`src-gen/`, `lib/`, `gen-esbuild.*.mjs`, `esbuild.mjs`) are git-ignored.
- Theia builds are excluded from the default `turbo run build`; use `npm run build:apps`.
- `@theia/git` is no longer published. Git, merge-conflict, themes, and language basics come from the `vscode.*` builtin plugins (`eclipse-theia/vscode-builtin-extensions` releases). `@theia/getting-started` is deliberately not included: Project Home is the landing view.
- Do not use `yo generator-theia-extension`; add new extensions by copying `packages/theia-control-room`'s package shape. Source: [Build your own IDE/Tool](https://theia-ide.org/docs/composing_applications/).

## Anatomy of an extension package

- `package.json` must contain `"keywords": ["theia-extension"]` and a `theiaExtensions` array listing DI module entry points: `{ "frontend": "lib/browser/<x>-frontend-module" }`, `{ "backend": "lib/node/<x>-backend-module" }`, or Electron-specific keys.
- Each module file default-exports an InversifyJS `ContainerModule`: `export default new ContainerModule(bind => { bind(CommandContribution).to(MyCommands); bind(MenuContribution).to(MyMenus); });`
- Behaviour is added by implementing `*Contribution` interfaces (`CommandContribution`, `MenuContribution`, `KeybindingContribution`, `FrontendApplicationContribution`, `BackendApplicationContribution`, `PreferenceContribution`, `WidgetFactory`, …) and binding them; the runtime multi-injects all contributions of a kind.
- Use `@injectable()` classes and `@inject(Service)` constructor params; never `new` a Theia service.
- Add the extension to both apps' `dependencies` (`apps/control-room/package.json`, `apps/control-room-browser/package.json`); the Electron app's build script runs `theia rebuild:electron` then `theia build`.
Source: [Authoring Theia Extensions](https://theia-ide.org/docs/authoring_extensions/).

## Frontend/backend split

Frontend (browser/Electron renderer) and backend (Node) each have their own DI container. Cross-process calls use Theia's JSON-RPC: in the backend bind `ConnectionHandler` to a `RpcConnectionHandler` (`@theia/core/lib/common/messaging/proxy-factory`); in the frontend create the proxy with `ServiceConnectionProvider.createProxy(container, path, client)` (`@theia/core/lib/browser/messaging/service-connection-provider`). See `packages/theia-control-room/src/{node,browser}/control-room-*-module.ts` for the working pattern. Anything touching the filesystem, child processes, or the platform service belongs in the backend module; the backend reaches the platform service only through `@gamecrafter/service-client`. Source: [Architecture overview](https://theia-ide.org/docs/architecture/), [JSON-RPC](https://theia-ide.org/docs/json_rpc/).

## Custom views

Implement a `ReactWidget` (or `BaseWidget`) and register a `WidgetFactory` plus an `AbstractViewContribution` to give it a command, menu entry, and default dock area. Follow the Control Room surface list in `docs/PLATFORM_DESIGN.md` (Project home, canon, task graph, board, assets, connections, validation, settings). Source: [Widgets](https://theia-ide.org/docs/widgets/).

## Settings

Expose every configurable behaviour through Theia preferences (`PreferenceContribution` with a JSON schema) **and** the platform settings system; the UI must show effective value and scope (platform/Project/session). Do not create one long settings page. Source: [Preferences](https://theia-ide.org/docs/preferences/).

## Theia AI integration boundary

- Use `@theia/ai-core` / `@theia/ai-chat` for in-editor chat agents: extend `AbstractStreamParsingChatAgent`, register a prompt fragment (`BasePromptFragment` with `id` + `template`), set `languageModelRequirements`, bind the agent via DI.
- Expose actions to models with `ToolProvider` implementations (`bind(ToolProvider).to(MyTool)`); reference them in prompt fragments as `~{toolId}`.
- Declare user-toggleable behaviour with `{{capability:fragment-id default on|off}}` and label it with frontmatter (`name`, `description`) on the `.prompttemplate`.
- Contribute settings pages to the AI Configuration view with `AiConfigurationCategory` (the old `WidgetFactory` tab approach was removed).
- **Do not** implement the platform's model router as a Theia `LanguageModel`; Theia documents that its LLM-provider interfaces have no fixed contribution point yet. Bridge Theia AI to the platform service's router through one adapter `LanguageModel` that forwards requests, so eligibility and routing rules stay in the service.
Source: [Theia AI](https://theia-ide.org/docs/theia_ai/).

## Unified Plugins catalog

Theia distinguishes compiled **Theia extensions** from runtime **plugins** (VS Code-compatible, installable via Open VSX). Our game-platform plugins are a third kind with their own manifest and runtime (see `docs/SKILLS_AGENTS_AND_TOOLS.md`). Show the type and privilege boundary in the catalog UI. Source: [Extensions and Plugins](https://theia-ide.org/docs/extensions/).

## Gotchas

- Theia docs snippets pin `"@theia/core": "latest"`; here every Theia package is pinned to the same exact version. Check a new Theia release is at least 7 days old before adopting it.
- Electron native modules must be rebuilt (`theia rebuild:electron`) after dependency changes; failures usually mean missing build tools, not code errors. npm has installed `@electron/rebuild`'s CLI without its executable bit; the Electron app's `prebuild` script restores it.
- The tree is npm workspaces only; do not introduce yarn or pnpm.
- Keep Theia-facing TypeScript strict; Theia's own tsconfig uses `strict: true` and decorators (`experimentalDecorators`, `emitDecoratorMetadata`) which InversifyJS requires.
- Never let plugin or agent code depend on Theia internals; keep Project/task records in the service's contracts package.

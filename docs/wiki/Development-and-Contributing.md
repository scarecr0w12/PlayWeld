# Development and contributing

Choose one bounded correction, reproducible defect or tutorial improvement. Search issues/PRs, read [CONTRIBUTING.md](https://github.com/scarecr0w12/PlayWeld/blob/main/CONTRIBUTING.md) and [AGENTS.md](https://github.com/scarecr0w12/PlayWeld/blob/main/AGENTS.md), then branch from current main.

## Source desktop

After [prerequisites](https://github.com/scarecr0w12/PlayWeld/wiki/Installation-and-Requirements), run from the repository root:

```bash
npm ci
npm run build
npm run download:plugins
npm run build -w @gamecrafter/control-room
npm run start -w @gamecrafter/control-room
```

Package workspaces build first; Theia/native desktop work is separate. Avoid rebuilding outputs used by an active app. Use an isolated checkout/dependency tree when needed.

The development browser has separate build/start commands for @gamecrafter/control-room-browser at http://127.0.0.1:3000. It is a development/smoke target, not a hosted web product. The [developer guide](https://github.com/scarecr0w12/PlayWeld/blob/main/docs/DEVELOPER_GUIDE.md) owns detailed commands and isolated profiles.

## Validate and contribute

Iterate with the affected package test. Code handoff uses:

```bash
npx turbo run build typecheck lint test
npm run format:check
```

UI changes also need relevant app build/rendered smoke. Docs-only work needs focused content/link/formatting checks, not app builds. Report capability skips; source tests and live engines prove different things.

Add a pending permanent record under docs/changes/ with exact paths, rationale, compatibility, impact and actual validation. Keep the product version while pending.

```bash
npm run changelog:update
npm run changelog:check -- --base <branch-base-commit>
```

Use the PR template and explain observable changes. CI covers Windows/Linux quality and browser smoke, not all integrations. Pin exact npm dependencies; keep durable state in the service. Release publication is separate authorized work.

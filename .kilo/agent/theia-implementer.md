---
description: Scoped TypeScript service, contracts, Theia, and MCP implementation with tests
mode: subagent
---

Read `AGENTS.md` and `.agents/agents/theia-implementer.md`. Follow the shared implementation procedure, loading `theia-app-dev` for Theia, `mcp-multiversion-client` for MCP, and `vitest` for tests. Use npm workspaces only. Inherit the session's model and permission policy; do not select a model or relax permissions yourself.

Work only on assigned paths and acceptance criteria. Preserve concurrent edits and coordinate before changing shared contracts, dependencies, generated files, or work-package status. Keep durable state in the platform service. Add meaningful regression coverage and run the narrowest relevant verification.

Return exact changed paths, behavior and compatibility effects, commands actually executed with outcomes, skipped checks, and remaining risks. Agree with the parent on who writes the permanent work record and regenerates the shared changelog. Never commit, push, publish, or mutate Agent Manager state without explicit authorization.

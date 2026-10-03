# Documentation cookbooks, glossary, inventory and sourced refresh

**Release:** 0.5.0

**Impact:** none

**Category:** Documentation

## Summary

Expand user, contributor and operator documentation with workflow prerequisites, state ownership, permissions, failures/recovery, examples and explicit evidence boundaries. Generate a complete service/contract/settings surface inventory linked from the existing coverage record.

## Details

- Add user workflow and contributor extension cookbooks, glossary, annotated actual workflow screenshot guide and operations recovery procedures. Explain platform plugins, Theia extensions and engine-side editor addons as separate lifecycles.
- Generate exact names for 186 methods/25 RPC families, 28 notifications, 75 settings/17 groups, 24 service directories/test paths and declared plugin capabilities. A new unmapped family fails generation; a freshness check detects drift. This is discovery coverage, not automatic acceptance.
- Add targeted primary-source verification for MCP 2026-07-28, Agent Skills, Theia, Godot, Unity, Unreal and the OpenAI Chat reference. Mark inaccessible Anthropic/Blender documentation unverified. Older research notes are not globally refreshed or promoted into new requirements.
- Preserve design/decision/work-package authority, product/version identifiers and existing stored contracts. No migration, release, dependency or user-confirmed requirement change. Asset UI/provider acceptance, Windows isolation, external MCP editor integration and installer rollback remain explicit gaps.

## Validation

- Generated inventory and existing system references passed freshness checks; initial documentation links passed through WSL. Final link/format/changelog checks are recorded after completion below.
- Source inspection checked role/skill roots, setting scopes, task state/error codes, plugin manifest/version checks and service recovery ownership. Runnable checks and screenshots have separate permanent records.
- Reused the shared installed dependencies; npm ci was skipped because it replaces the dependency tree used by concurrent work. No new dependency added.

- Full repository gate passed all 33 tasks; service suite passed 365 tests with 11 capability-dependent skips. Runnable capture harness regressions passed both checks; generated system references and documentation inventory passed freshness checks. Final WSL documentation links, repository format check, explicit formatting of new guides/scripts, Git whitespace check and changelog coverage/freshness all passed.

## Files

- `docs/DOCUMENTATION_COVERAGE.md`
- `docs/EXTENSION_COOKBOOK.md`
- `docs/GLOSSARY.md`
- `docs/OPEN_DECISIONS.md`
- `docs/OPERATIONS_GUIDE.md`
- `docs/README.md`
- `docs/STATUS.md`
- `docs/WORKFLOW_COOKBOOK.md`
- `docs/WORKFLOW_SCREENSHOTS.md`
- `docs/examples/lantern-workshop/README.md`
- `docs/reference/DOCUMENTATION_INVENTORY.md`
- `docs/reference/documentation-inventory.json`
- `docs/research/documentation-standards-verification.md`
- `scripts/generate-documentation-inventory.cjs`

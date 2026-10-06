# Bound vulnerable dependency inputs and apply compatible fixes

**Release:** 0.14.0

**Impact:** patch

**Category:** Security

## Summary

Upgrade six transitive dependencies and persist narrow local fixes for two advisories without upstream patched releases, preserving the pinned Theia version and existing CommonJS contracts.

## Details

- Exact overrides: DOMPurify3.4.16, http-cache-semantics4.3.0, source-map-js1.2.2, diff8.0.4, uuid11.1.1 and @tootallnate/once2.0.1. Security exceptions to the preferred seven-day age apply to http-cache-semantics (published October4) and source-map-js (September30); other selected releases exceed seven days. No Theia downgrade or blanket forced audit repair.
- Pin patch-package8.0.1 as a direct development dependency and apply version-specific patches during postinstall with error-on-fail. Brace parsing rejects nesting beyond 128; compile/expand/stringify AST walkers reject depth above128 before native stack exhaustion. Ordinary glob behavior remains intact; exceptionally deep expressions now fail with a controlled depth-limit error.
- Clamp sprintf numeric precision for e/f to 0..100 and g to 1..100. Preserve explicit zero precision and string truncation behavior; extreme numeric precision no longer throws native digit-range errors.
- Advisory sources: <https://github.com/advisories/GHSA-vfj7-8cjw-p6xm>, <https://github.com/advisories/GHSA-hp3w-g68c-fv3c>, <https://github.com/advisories/GHSA-ch52-4w7c-c8xp>, <https://github.com/advisories/GHSA-68fv-2mgg-jv7q>. This is scoped remediation, not a comprehensive security certification.
- Preparation 0.13.0 preceded these findings and was not packaged. The next prepared build includes that source plus this repair; historical preparation records remain intact.

## Validation

- Two regressions first failed: unbounded brace nesting and native sprintf RangeError. Both passed after patches, including deep AST compile/expand/stringify, parentheses, normal glob expansion, zero/large numeric precision and string truncation.
- Clean npm ci applied both persisted patches successfully. npm update of only the six named packages refreshed stale locked transitive entries; npm ls confirmed every installed consumer uses the selected versions without invalid dependencies.
- Audit decreased from 66 (5low, 49moderate, 12high) to 19 (9moderate, 10high). All remaining entries derive from the two locally patched packages; the registry still flags their unchanged upstream version numbers. Do not report a clean registry audit. Before/after JSON retained in ignored local evidence.
- Final clean npm ci applied both patches. Full native repository quality gate passed 33/33, including540 passing platform tests/11 skips. Windows packaging/native checks and29 packaged Electron smoke checks passed with zero renderer errors. An initial content harness correctly rejected resolving development dependencies from inside the package: braces/sprintf-js are absent as standalone packaged modules, so its corrected report records that boundary rather than claiming packaged execution. Bundle creation occurred after the clean-install patch regressions passed. Ordinary installed 0.14.0 passed 29 desktop smoke checks with zero renderer errors and retained its native profile state after upgrade.

## Files

- `package.json`
- `package-lock.json`
- `patches/braces+3.0.3.patch`
- `patches/sprintf-js+1.1.3.patch`
- `packages/platform-service/src/dependencies/advisory-regressions.test.ts`
- `docs/changes/2026-10-05-dependency-advisory-remediation.md`

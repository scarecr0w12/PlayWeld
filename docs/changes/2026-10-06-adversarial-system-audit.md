# Run adversarial desktop, workflow, engine and provider acceptance

**Release:** 0.15.0

**Impact:** none

**Category:** Maintenance

## Summary

Add repeatable broad UI/provider acceptance, execute current local and live checks, and record repaired defects and remaining completion boundaries.

## Details

- Add a real isolated-service audit covering Project Home and all fifteen views, primary/nested sections, three desktop sizes, field names, duplicate IDs, missing section targets, horizontal containment and renderer exceptions. Each state retains a screenshot and report; view failures are collected so later views still run.
- The audit supports owned development Electron and browser targets, uses two disposable Projects including a long name, validates trust only for those folders, and closes only owned resources. Primary review uses 1920x1080, with 1440x1000 and 1024x900 secondary sizes; optional `--stress` adds 650 pixels. Earlier 480-pixel captures are preserved as supplemental evidence, not normal desktop quality.
- Correct the pre-existing workspace smoke to count selected buttons within independent navigation groups. Update live-engine acceptance to report the workspace version instead of 0.1.0 and reject unknown stages.
- Add live provider acceptance that reads existing encrypted credentials only in memory, re-encrypts them in a separate profile, selects configured enabled chat models, probes completion/streaming/tool calls/embeddings, and compares ordinary Project/account/model/pool/asset-account identities around the run. Scan all retained test artifacts for plaintext source API keys.
- Paid asset generation is off by default. With explicit session authorization and `--paid-assets`, the script requires a sufficient verified Meshy balance and selects one five-credit geometry preview, download/hash/GLB checks, unreviewed import rejection, explicit review and exact-byte isolated import. No paid retry/refine loop or production art promotion is added.
- The first live stream assertion revealed a test assumption: source streaming metadata was unknown, so complete-response delivery was correctly selected. The corrected disposable probe explicitly enables streaming there; ordinary capabilities remain unchanged. The first paid preview result is retained separately and the corrected run performs no additional paid generation.
- Add the dated system review matrix and current status/index pointers, preserving historical release/workflow evidence and describing still-unimplemented Windows isolation, external IDE integration, release lifecycle and external verification debt. Correct the stale statement that 0.9.0 is the ordinary current version, qualify the earlier zero-high/critical audit as historical and report the current patched-package advisory count; repair snapshot spacing. No work package or user-owned decision is marked complete/confirmed.
- Investigation/testing/documentation tooling uses none impact. Product remains 0.14.0 pending release preparation; no installer, publication, profile migration or compatibility identifier change is produced.

## Validation

- Larger desktop browser/Electron audits each passed 195 rendered checks with no findings or renderer exceptions. Corrected workspace navigation/theme/keyboard smoke passed. The full disposable workflow suite passed 30 checks and retained 45 captures.
- Fresh D-drive Unreal fixture compiled; 14 Unity/Unreal identity/access/version/automation checks passed. Real Blender export/render and Python-failure classification passed in the full native suite.
- Live OpenAI authentication/discovery, completion, streamed deltas, tool response and 1536-dimensional embedding passed. Live Meshy balance/generation/download/review/import passed with five observed credits consumed. Both provider runs retained ordinary identities and found zero plaintext API-key leaks.
- The final repository gate passed 33/33 with 542 platform tests/11 explicit skips and 124 extension tests, including three offline Knowledge notification regressions and the duplicate-generation regression. Twenty-five unchanged tasks use their verified cache results; actual browser/Electron builds passed. Final results and exact paths are recorded in `docs/ADVERSARIAL_SYSTEM_REVIEW.md`. Failures and narrower stress results remain preserved rather than silently discarded.
- Markdown links and permanent-record/changelog coverage passed. An earlier formatting check passed; the final combined formatting/version/documentation-reference check was declined through command approval and did not run. The repository excludes docs/scripts from Prettier, so those artifacts were directly reviewed rather than treating formatting success as their layout evidence.
- This does not certify all target architecture, Windows AppContainer, signed release/installer lifecycle, arbitrary external providers, assistive technology, production game/art or performance behavior. The review explicitly retains those gaps.

## Files

- `scripts/adversarial-ui-audit.cjs`
- `scripts/adversarial-provider-acceptance.cjs`
- `scripts/workspace-overhaul-ui-smoke.cjs`
- `scripts/live-engine-acceptance.cjs`
- `docs/ADVERSARIAL_SYSTEM_REVIEW.md`
- `docs/STATUS.md`
- `docs/README.md`
- `docs/changes/2026-10-06-adversarial-system-audit.md`

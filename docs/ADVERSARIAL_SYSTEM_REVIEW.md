# Adversarial system review and repair evidence

**Last reviewed:** 2026-10-06

This pass reviews the combined working tree, preserving the substantial changes already present when it started. It covers the platform packages, all fifteen Control Room work views and Project Home, local workflow integration, configured providers, native engine fixtures, dependency advisories, and known unfinished implementations. Repairs remain pending at product version 0.14.0. This is a source and development-runtime review, not a new installer or an exhaustive claim that the target architecture is finished.

## Repaired findings

| Finding | Result | Evidence |
| --- | --- | --- |
| Delayed Project loads could overwrite the selected Project's Engine, DCC, Assets and Knowledge data. DCC also accepted responses for the previously selected tool. | Context and request-generation checks discard obsolete responses; deselection clears Project evidence; DCC load errors are contained. | `project-view-isolation.test.ts`, reproduced failures followed by passing checks. |
| Skills, Plugins and Connections could replace a newer Project snapshot with an older refresh result. | Guard selection resolution and final snapshot publication; clear Connections tool/log caches on explicit scope changes. | Three additional reordered-response regressions. |
| Asset previews and completed job actions could surface in another Project after navigation. | Guard preview publication, job updates, generation/import completion and the follow-up imported preview. Project changes clear source-job selection and preview/review state. | Preview navigation regression and existing import/generation regressions. |
| Repeated Generate clicks could submit multiple paid jobs before the first RPC completed. | Guard an already-busy submission and immediately render its disabled state. | Deferred-submit regression failed with two calls, then passed with one. No additional paid provider calls. |
| Knowledge navigation could retain old records, graph, index state or search results, and overlapping operations could clear the busy indicator too soon. Notification refresh failures also escaped as rejected promises when the service was offline. | Clear evidence on context changes, guard independent status/record/settings/search responses, count pending operations and contain scoped refresh errors. Ordinary same-Project refresh retains selected content. | Eighteen response/failure isolation tests, existing Knowledge tests and live workflow suite. |
| Narrow docks could overflow on long Project names, form minimum widths, engine/DCC tables and inherited checkbox sizing. | Bound field/label sizing, use local table scrolling, wrap actions, stack relevant grids and restore checkbox intrinsic sizing. | Rendered audit and manually inspected captures. |
| Engine onboarding recommended installing tools before native game files existed; navigation badges counted unavailable operations as runnable work and used operation totals for capabilities. | Explain native files first; show layer count and available-operation count. | Engine guidance regression and final rendered recheck. |
| The old workspace smoke asserted one selected button across both MCP and A2A navigation groups. | Assert exclusive selection within the button's own navigation group. | Corrected workspace smoke passes. |
| Live engine acceptance reported hardcoded service/client version 0.1.0. | Read the actual workspace version and reject unknown stages. | Fresh 0.14.0 disposable Unity/Unreal acceptance records. |
| Meshy account testing reported no balance despite a documented balance endpoint. | Advertise balance support and authenticate through `GET /openapi/v1/balance`; retain zero and reject invalid numeric balances. | Endpoint/RPC regressions and live account balance. [Meshy balance API](https://docs.meshy.ai/en/api/balance). |
| The MCP fixture SDK was pinned to 1.30.0, and npm retained a stale nested install after the manifest changed. | Pin and override 1.31.0; check the actual resolved SDK against the declaration. | Publication-date lookup, `npm ls`, dependency guard and MCP tests. [SDK advisory](https://github.com/advisories/GHSA-6qxp-vccf-f47h). |

No persisted record/RPC schema or GameCrafter compatibility identifier changes are required. Meshy balance support is a compatible addition; the UI corrections preserve service ownership of durable state.

## Verification coverage

| Area | Current evidence | Limits |
| --- | --- | --- |
| Contracts, IPC, service/client, profiles and migrations | Full package quality gate; authenticated service lifecycle and persistence tests. | Local Windows environment; OS/capability skips are explicit. |
| Settings, Chat, Knowledge and UI navigation | Real isolated service/browser workflows, malformed settings import rejection, indexing, citations, named fields, navigation and retained drafts. | Local scripted provider for the workflow suite; accessibility is not fully certified. |
| Swarm, tasks, approvals, locks and integration | Actual worker/Git worktree tests plus UI question/answer, delegation, approval and manual integration. | Scripted provider reasoning; no claim of reliable arbitrary autonomous production work. |
| Discussion board and canon | UI binding decision, durable decision synchronization and generated canon document. | Broader creative authority and retcon policy remain user-owned. |
| Plugins and extensions | Manifest inspection, install/enable/uninstall, module/UI tests and native Windows LPAC lifecycle/boundary checks. | Node/Electron denial probes and shared Node/Python lifecycle pass; broader process/outbound-network and OS acceptance remain open. |
| MCP and A2A | Fixture protocol/auth/scope/tool tests; real stdio fixture through broker; inbound/outbound A2A tests. | No new external A2A or community engine-MCP acceptance in this pass. |
| Engine/DCC connectors | D-drive Unreal 5.8 Editor fixture compilation; 14 Unity 6000.6.0f1/Unreal connector identity/access/version/test checks; real Blender failure/export/render checks in the full suite. | Headless fixture scope; no production editor changes, physical input or full platform/version matrix. |
| OpenAI | Real authentication/discovery, completion, streamed deltas, tool-call response and a 1536-dimensional embedding through a source-built isolated service. | Uses the configured account and selected enabled model; no Anthropic or other account was configured for this pass. |
| Meshy assets | Real account balance, one preview generation, download/hash/GLB header, rejection of unreviewed import, approval and exact-byte isolated import. | Synthetic geometry acceptance only; no production art approval, image-to-3D, refine or Tripo paid acceptance. |
| Backups and recovery | Real encrypted local archive, wrong-secret rejection, restore/drill, byte equality and nonempty-target rejection. | Remote S3/FTP/Drive remain fixture-tested. |
| Release and updates | Update compatibility/signature unit tests, development Electron build and runtime audit. | No new installer, signing/key provisioning, hosted publication or rollback drill. |

The primary visual review uses **1920 × 1080**, with **1440 × 1000** and **1024 × 900** as secondary desktop sizes, following the user's request. Each target audits 65 surface/section states at those sizes: **195 rendered checks in the browser and 195 in development Electron**, with no findings or renderer exceptions in the recorded desktop runs. Earlier 650/480-pixel stress results are retained separately and do not define normal desktop acceptance. A 480-pixel window with Chat docked left roughly 100 pixels for the main pane, so its captures are unsuitable for judging normal readability. `--stress` adds a supplemental 650-pixel check to the reusable audit.

## Retained local evidence and reproduction

Evidence directories are ignored local artifacts, not published release assets:

- `.turbo/adversarial-review/initial-status.txt`: pre-existing work inventory.
- `.turbo/adversarial-review/quality-fresh.log`: uncached 33-task gate, 540 platform tests and 119 extension tests before the later balance/guidance/dependency additions.
- `.turbo/adversarial-review/quality-final.log`: subsequent combined gate, including Meshy balance; final follow-up results are retained separately after the SDK/guidance additions.
- `.turbo/adversarial-review/quality-handoff.log`: all 33 tasks passed after the SDK/guidance changes, with 542 platform tests and 120 extension tests. `.turbo/adversarial-review/quality-knowledge-offline.log` retains the later three offline-refresh regressions and rebuilt UI checks.
- `.turbo/adversarial-review/quality-complete.log`: final 33/33 combined gate with 542 platform tests/11 capability skips and 124 extension tests. The final UI tests cover all eighteen response/failure cases, Engine guidance and duplicate paid submissions; 25 unchanged tasks use their verified cache entries. The earlier archive-extractor test also has one explicit Windows capability skip.
- `.artifacts/adversarial-electron/1791310247934/report.json`: final guidance/count correction rechecked in 195 larger-window Electron states, zero findings/errors. `.artifacts/documentation/1791310300921/screenshots/capture-report.json` retains the final local asset workflow recheck.
- `.artifacts/adversarial-ui/1791308057652/report.json` and `.artifacts/adversarial-electron/1791308303453/report.json`: larger desktop rendered audits and adjacent captures.
- `.artifacts/workspace-overhaul-ui/1791306845040/report.json`: corrected navigation/theme/keyboard smoke.
- `.artifacts/documentation/1791307408654/screenshots/capture-report.json`: 30 real local workflow checks and 45 captures; inference/generation endpoints are explicitly local fixtures.
- `.artifacts/adversarial-engines/2026-10-06-run1/compile-unreal.json` and `baseline.json`: native engine fixture evidence.
- `.artifacts/adversarial-providers/1791308968298/report.json`: paid Meshy preview/import and ordinary identity retention. The initial streaming assertion failed because source metadata marked streaming unknown, correctly selecting complete-response delivery.
- `.artifacts/adversarial-providers/1791309068428/report.json`: corrected live streaming probe in the disposable profile, seven passing checks and zero plaintext credential leaks. It deliberately performs no second paid generation.

The paid Meshy check used `meshy-6-lite` preview geometry only. Balance changed from 2697 to 2692 and the job recorded five consumed credits, matching the listed preview cost. [Meshy pricing](https://docs.meshy.ai/en/api/pricing). Credentials were read from the existing encrypted profile only in memory and encrypted into a separate profile. Ordinary Project/provider/model/pool/asset-account identities were compared before/after; no ordinary record, model capability or provider selection was changed. A local artifact scan found no plaintext source API credentials.

Repeat the reusable UI audit with `node scripts/adversarial-ui-audit.cjs` or add `--electron`. It creates two new disposable Projects, launches only its own backend/app, preserves failed reports and closes owned processes. Its checks cover layout containment, field names, duplicate IDs, section targets and renderer errors. Repeat external probes with `node scripts/adversarial-provider-acceptance.cjs`; paid asset creation is off by default and requires `--paid-assets` plus explicit session authorization. That flag currently selects one Meshy five-credit preview and requires a verified sufficient balance. OpenAI calls still incur ordinary metered inference usage; recorded cost estimates are not invoices.

Final local Markdown links and change-ledger coverage/freshness passed. An earlier repository formatting check passed; the final grouped formatting/version/reference-evidence recheck was declined through command approval and did not run. The existing `.prettierignore` excludes documentation and scripts, so formatting checks are not evidence of Markdown/script layout quality. Review those artifacts directly. The two application packages still use their configured skip tasks for lint/test/typecheck; their actual builds and development runtimes were exercised separately.

## Areas that are still unfinished or not accepted

These remain concrete open areas; this review does not turn them into completed work:

- **Windows plugin execution:** LPAC/Job now has real filesystem/network denial and lifecycle evidence. Process-limit adversarial tests, allowed outbound networking, host allowlists and alternate Windows targets still need broader acceptance.
- **Release lifecycle:** trusted signing keys, signed release/installer delivery, fresh install/uninstall and rollback still lack complete current acceptance. A development Electron pass does not validate these.
- **Direct external IDE integration:** local MCP passes a real SDK stdio test and native Theia model/tools load and complete in the actual desktop registry. Personal IDE setup, images, streaming and transport cancellation retain the limits in [the integration guide](EXTERNAL_IDE_INTEGRATION.md).
- **Unsupported external environments:** no configured Anthropic/Tripo account, other installed DCC tools, live remote backup destination or external A2A service was available in the inventory. These are verification gaps, not proven authentication or implementation defects.
- **Human/product decisions and broader quality:** creative authority, binary conflict handling, cross-Project learning/privacy, unsigned-plugin trust policy and in-place restore decisions remain in [OPEN_DECISIONS.md](OPEN_DECISIONS.md). Comprehensive assistive-technology/localization, large-Project performance and production game/art acceptance remain separate work.
- **Registry advisories:** braces and sprintf-js still carry upstream vulnerable version numbers even though the existing repository patches bound their reproduced failure cases. Their transitive advisory counts must not be described as a clean registry audit. No upstream patched release was available for either during this pass. [Braces advisory](https://github.com/advisories/GHSA-vfj7-8cjw-p6xm), [sprintf advisory](https://github.com/advisories/GHSA-hp3w-g68c-fv3c).

The authoritative architectural work-package ordering remains in [DEVELOPMENT_PLAN.md](DEVELOPMENT_PLAN.md). This review introduces no product roadmap or confirmed product decisions.

## Remaining-gap repairs, 2026-10-06

[Managed editor acceptance](EDITOR_BRIDGE_ACCEPTANCE.md) adds direct authoring evidence for Unity, Unreal and Godot, including automatic startup, protected pairing, owned scene edits, refusal of user-object mutations and viewport capture. Unreal adds compilation/application through PlayWeld and binary reuse. The Electron audit passes 196 larger-window checks, including the actual Theia model/tool registry, with zero findings or renderer errors at `.artifacts/adversarial-electron/1791322029053/report.json`.

Protected metadata keys, an exit-waiting digest-checked handoff and version-separated rollback-package retention are implemented and fixture-tested. The user has no Windows certificate; publisher trust, trust-key distribution, actual NSIS install/uninstall/rollback and hosted signed publication remain unverified. A harmless executable test is not an installer lifecycle test. Exact changes and final validation are retained in the four follow-up [work records](changes/README.md).

The final post-port-fix gate passes all 33 tasks with 557 platform tests/six skips and 128 extension tests. Formatting, generated references, inventory/evidence integrity, Markdown links, version agreement, diff checks and the HEAD-based change ledger pass. The earlier declined grouped recheck above belongs to the preceding pass; these current checks were actually executed. No new installer or ordinary deployment was performed.

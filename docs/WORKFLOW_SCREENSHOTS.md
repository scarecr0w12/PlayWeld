# Worked workflow screenshots

**Last updated:** 2026-10-04

These images show synthetic Lantern Workshop data in the actual built development browser Control Room, backed by a real isolated service. The 2026-10-04 [workflow report](images/lantern-workflows-2026-10-04/capture-report.json) records browser/service version 0.6.0, source identity, all nine scenarios and 45 PNG captures, with zero renderer errors. The companion [overview report](images/lantern-workshop/capture-report.json) records the current surface captures. This is not evidence for a later 0.7.0 build, paid-provider behavior, native gameplay, or installer acceptance. Follow the [cookbook](WORKFLOW_COOKBOOK.md) for prerequisites/actions/recovery and the [coverage record](DOCUMENTATION_COVERAGE.md) for gaps.

Regenerate from the built repository with:

```powershell
$env:GAMECRAFTER_DOC_OUTPUT = 'docs/images/lantern-workflows-2026-10-04'
node scripts/capture-documentation.cjs --scenario all
```

Each scenario can be selected independently in a fresh profile/Project. `--scenario all` also includes the original overview. Generated profiles, Projects, diagnostics and archives stay under unique `.turbo/documentation` directories. The script stops only its owned browser/backend/service/provider. Reports omit tokens, recovery secrets and raw provider prompts. Inspect images before publishing because synthetic paths and detected host installations can still appear.

## Current navigation and Chat layout

![Project Home with tools grouped by purpose](images/lantern-workflows-2026-10-04/01-home.png)

![Chat search filtering the conversation list and selector](images/lantern-workshop/05-chat-search.png)

![Narrow Chat view with a starter still in the unsent draft](images/lantern-workshop/05-chat-mobile-starter.png)

Project Home cards and the top-level PlayWeld menu group routes by purpose. A Chat starter fills the draft but does not send; the narrow capture records a responsive browser layout, not a native mobile client or touch acceptance. Search state, conversation state, and the selected Project belong to the view and should be checked before sending.

## Scripted agent and approval

![Question waiting for the synthetic reset answer](images/lantern-workflows-2026-10-04/agent-question.png)

Inspect the request and task identity, waiting question and answer control. The local provider deliberately asks this question to exercise the real task runtime; it is not a reasoning-quality example.

![Delegated document ready for manual integration](images/lantern-workflows-2026-10-04/agent-integration-ready.png)

Inspect the child task and its ready integration. The fixture disables automatic integration within this disposable Project so the manual boundary can be checked. A successful child task has not yet changed the main workspace.

![Integrated synthetic document](images/lantern-workflows-2026-10-04/agent-integrated.png)

The service assertion checks that the integrated workspace contains `docs/AGENT_EXAMPLE.md`. Read integration status/evidence together; this generated document has no gameplay or native-validation claim.

![Pending broker approval](images/lantern-workflows-2026-10-04/agent-approval.png)

Inspect `fs/write-file`, its Project and workspace-write classification. This separate call uses an Ask always ceiling, is approved through the UI, and writes a synthetic approval example. The fixture's allowed paid classification is used only for its local scripted model endpoint.

## Settings transfer and failed import

![Import preview with no mutation yet](images/lantern-workflows-2026-10-04/settings-import-preview.png)

The preview names one platform override while the visible effective value remains inherited Ask always. An independent service query confirms that preview did not write it.

![Applied settings override](images/lantern-workflows-2026-10-04/settings-import-result.png)

Inspect the imported count and Platform source for Restricted. The runner also clicks the UI export and parses its redacted JSON, then resets this isolated override.

![Malformed settings file rejected](images/lantern-workflows-2026-10-04/settings-import-failure.png)

Inspect the visible parse failure. The runner verifies that the previously applied value survives rejection; it does not silently convert malformed input into an empty import.

## User decision and indexed change

![Decision before the binding action](images/lantern-workflows-2026-10-04/decision-before-binding.png)

Inspect message type **decision** and **Mark as binding decision**. Posting text alone has not made it a binding canon record.

![Binding decision synchronized into canon](images/lantern-workflows-2026-10-04/decision-synchronized.png)

Inspect the binding section and synchronized status. The runner independently reads the generated canon path and checks its statement against the posted rule.

![Search citation after editing the native document](images/lantern-workflows-2026-10-04/knowledge-changed-document.png)

Inspect the unique revision phrase, lexical/docs filters, `docs/DESIGN.md` path and citation. The input changed on disk before UI reconciliation. This establishes fresh lexical indexing, not embedding generation.

## Local backup restoration

![Backup identity destination and manual run setup](images/lantern-workflows-2026-10-04/backup-configuration.png)

Inspect the synthetic recovery identity and local disposable destination. Recovery inputs are password fields and their values are omitted from public reports.

![Verified local archive](images/lantern-workflows-2026-10-04/backup-verified.png)

Inspect the run's verified state, archive name and file count. Verification is a distinct recorded result after archive creation.

![Wrong recovery secret rejected](images/lantern-workflows-2026-10-04/backup-wrong-secret.png)

Inspect the failure message. The fixture then enters the correct in-memory secret and successfully verifies/restores the same archive.

![Restored into a new location](images/lantern-workflows-2026-10-04/backup-restored.png)

Inspect the restoration result. Service/filesystem assertions compare design and native source bytes and check registration under a new Project ID.

The result is from a disposable host-local path; inspect or redact local paths before reusing the image outside this repository.

![Nonempty restore destination rejected](images/lantern-workflows-2026-10-04/backup-nonempty-target.png)

The second restore attempts the now-occupied destination and must reject it. This is intentional failure evidence protecting the restored copy.

## Sample plugin and missing runtime prerequisite

![Review exact plugin capabilities](images/lantern-workflows-2026-10-04/plugin-capability-review.png)

Inspect the publisher, compatibility, signature warning and requested capabilities before accepting installation. The source is the repository's built Sample Hello plugin.

![Sample installed and enabled](images/lantern-workflows-2026-10-04/plugin-installed.png)

Installation/enablement is separate from a running worker. A compatibility defect discovered in this walkthrough was repaired and regression-tested against the current workspace version.

![Windows isolation prerequisite unavailable](images/lantern-workflows-2026-10-04/plugin-isolation-unavailable.png)

Inspect the explicit isolation error. The script checks this expected failure and uninstalls its sample through the UI. No plugin greeting/tool execution is claimed on Windows, and isolation is not bypassed.

## Project MCP connection

The [full capture report](images/lantern-workflows-2026-10-04/capture-report.json) records the actual negotiated revision and successful broker call. This repository-owned stdio server returns a fixed synthetic rule and makes no engine or filesystem changes.

![Connected Project-scoped synthetic server](images/lantern-workflows-2026-10-04/mcp-connected.png)

The capture shows the Project scope, connected counters and negotiated revision in the log. The full report independently records tool classification and the broker call; transport readiness does not establish an engine editor bridge.

![Synthetic stdio command configuration](images/lantern-workflows-2026-10-04/mcp-configured.png)

Inspect the configured command, argument and Project scope before connection. The runner separately checks the namespaced tool's broker result and disconnects before cleanup; no separate disconnected-state screenshot is claimed.

## Synthetic asset review and import recovery

The [full capture report](images/lantern-workflows-2026-10-04/capture-report.json) records the real UI/service exercise with a local provider returning a metadata-only GLB. There is no generated mesh or paid-provider claim.

![Local fixture selected before submitting the asset job](images/lantern-workflows-2026-10-04/asset-configuration.png)

Inspect the explicitly synthetic account and prompt. The runner supplies the account through the real service; submission, review and import use the UI.

![Completed artifact waiting for human review](images/lantern-workflows-2026-10-04/asset-awaiting-review.png)

Inspect **review**, the downloaded artifact and approval controls. Provider completion has not imported the file.

![Outside-Project import destination rejected](images/lantern-workflows-2026-10-04/asset-import-rejected.png)

Inspect the containment error and unchanged **approved** state. The runner corrects the destination instead of bypassing containment.

![Imported metadata fixture with provenance](images/lantern-workflows-2026-10-04/asset-imported.png)

Inspect **imported**, the library path, provenance and named hierarchy node. The empty grid is expected because the fixture contains metadata rather than renderable geometry. An independent assertion compares the imported bytes to the supplied artifact; engine/art acceptance remains separate.

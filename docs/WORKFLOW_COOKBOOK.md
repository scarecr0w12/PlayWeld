# PlayWeld workflow cookbook

**Last updated:** 2026-10-06

Use the disposable [Lantern Workshop](WORKED_TUTORIAL.md) Project for these exercises. Each workflow below gives prerequisites, actions, outputs, permissions, failure recovery and evidence. The [coverage record](DOCUMENTATION_COVERAGE.md) owns verification gaps. These instructions describe existing UI/service paths; they do not promote untested paths into live acceptance. Refer to the [glossary](GLOSSARY.md) and [handbook](CONTROL_ROOM_HANDBOOK.md) for terms and controls.

## Pick a workflow

- [Request an agent change and review integration](#ask-an-agent-to-make-a-change-and-inspect-integration).
- [Answer questions, handle approvals, or cancel work](#respond-to-questions-approvals-and-cancellation).
- [Record a discussion decision in a document](#bind-a-discussion-decision-into-a-durable-document).
- [Transfer settings](#transfer-settings-using-preview-and-redacted-export).
- [Review an asset before importing it](#review-an-asset-before-importing-it).
- [Run engine or DCC operations](#operate-an-engine-or-dcc-through-capability-layers).
- [Refresh the document index](#refresh-the-index-after-editing-a-document).
- [Practice backup and restoration](#drill-backup-and-restoration).

## Ask an agent to make a change and inspect integration

Purpose: turn a scoped game-development request into accountable work and an inspectable change. Prerequisites: a registered, trusted Project; native fixture files; a usable model account/pool supporting tool calls; applicable roles/skills; a clean Git workspace where worktree isolation is required. Model availability alone does not establish tool-call compatibility. Paid provider calls need the selected access policy and budget.

1. Open **Swarm** for Lantern Workshop. Request: “Document a 30-second lantern challenge in `docs/DESIGN.md`. Define when the timer starts, how R resets it, and the expected counter after collecting three lanterns. Preserve existing collection rules.” Keep this documentation exercise separate from implementing the game timer.
2. Preview impact using `docs/DESIGN.md` as a seed. Inspect affected paths and dependencies before submitting. A preview is analysis, not execution.
3. Submit the request. Inspect the request/task tree, role, budget, working state and events. Answer actual questions and review individual approvals as described below.
4. Inspect the result's changed files and evidence. A generated design edit should claim file generation; it must not claim gameplay implementation or native acceptance without corresponding changes/tests.
5. Inspect the integration list. Apply the ready change using the available integration control, then read the resulting workspace diff and integration record. Automatic integration depends on coordination settings and validation; task success alone is insufficient.
6. Reconcile Knowledge and search for the newly documented rule. Review its citation against the file.

The platform service owns requests, task state, locks, integrations and evidence. The UI presents that state. On a blocked model route, inspect eligibility/capabilities/pool policy instead of repeatedly resubmitting. On a Git conflict, preserve the worktree and integration diagnostics, resolve the reported conflict, and retry/abort the recorded integration. Cancellation stops the requested work; inspect descendants and integrations before assuming a partially written artifact has disappeared. [Task and change implementations](../packages/platform-service/src/change/) and [agent runtime](../packages/platform-service/src/agents/) define the precise behavior.

Evidence status: the original walkthrough previewed impact without submitting this prompt. The extended `--scenario agent` run submits a different, explicitly scripted request through the UI, answers the runtime question, delegates a synthetic document write to a Project role in a worktree and manually integrates it. [Agent report](images/lantern-agent/capture-report.json) records this acceptance. It establishes runtime boundaries, not real model reasoning or implementation of the timer prompt above.

## Respond to questions, approvals and cancellation

A task question asks for information, for example “Should the timer reset on R?” Inspect the task/Project identity and available answers, submit the intended answer, then verify the task leaves `waiting_input` or records the answer. Durable questions/answers belong to the task service. Closing a notification does not answer a question.

A broker approval authorizes a particular tool call. Inspect tool ID, arguments, paths, side-effect classification and requesting task. Approve or deny using the presented controls; do not change to Full access merely to hide a pending approval. A rejection or expired approval is an operational result that the task must handle, not evidence that the operation ran. Inspect **Audit & History** for the associated call.

To practice safely, use a synthetic task and a file inside Lantern Workshop. Avoid approving process, external-write, destructive or paid actions against production data. Use **Cancel** for a running task and verify its terminal state/events. An already completed external operation cannot be undone by canceling its task. Exact state transitions are in the [task contract](../packages/contracts/src/tasks/schema.ts); approvals and audit are in the [tool broker](../packages/platform-service/src/tools/).

Evidence status: the scripted agent scenario exercises a real question/answer and a separate broker approval in the UI. Cancellation remains covered by repository task tests until a dedicated tutorial UI cancellation report is recorded.

## Bind a discussion decision into a durable document

Purpose: preserve a user decision with its discussion provenance. Prerequisites: Lantern Workshop selected, a board thread, writable Project docs and an access policy permitting the canon write or an approved call.

1. Create **Tutorial reset acceptance** in Discussion Board. Post the rule using message type **decision**: “Lantern Workshop resets player position and lantern collection with R. This decision applies only to the disposable tutorial Project.”
2. Read the post. Choose **Mark as binding decision** and the explicit binding/synchronization option. Posting a decision-type message alone does not bind it.
3. Inspect synchronization status and the generated record under `docs/decisions`. Compare its statement and discussion references with the original post.
4. Inspect the canon path/commit and Knowledge record. Retain both when reviewing a later superseding decision.

On `pending`/`synchronizing`, inspect the maintenance task and approvals before retrying. On `conflict` or `failed`, retain the error and the existing document; use the offered retry after correcting the actual prerequisite. Do not rewrite unrelated user-confirmed repository decisions. Records live in the service and generated Project canon files. [Board implementation](../packages/platform-service/src/board/) defines maintenance/proposal application.

Run the reproducible UI exercise with `node scripts/capture-documentation.cjs --scenario decisions`. Its fixture uses Project Restricted access, whose allowed workspace-write category permits this synthetic document write. It does not change the user's profile policy. Inspect [the workflow report](images/lantern-workflows/capture-report.json) for the observed outcome.

## Transfer settings using preview and redacted export

For model-selection errors, use the [routing diagnosis guide](MODEL_ROUTING_GUIDE.md) before changing account or pool configuration. `NoEligibleModel` describes an eligibility conflict; a successful route, provider response, tool call and integration remain distinct results.

Purpose: copy nonsecret overrides deliberately. Prerequisites: Settings open; choose Platform or the intended Project before importing. An export describes effective values/layers; an import applies overrides at the selected scope, subject to each definition's allowed scopes.

1. Export redacted settings and retain the JSON outside source-controlled game content.
2. Choose the destination scope/Project and import the file. Inspect the preview's setting IDs and skipped/redacted entries.
3. Confirm **Apply overrides**. Verify the effective value and source label. Previewing must not mutate state.
4. Use **Reset** to remove an override and reveal the lower layer. Reset does not mean assigning the old effective value to the same layer.

Credentials are not a portable recovery mechanism in this export. Unknown settings, invalid values and unavailable scopes need explicit inspection; malformed JSON is rejected before applying overrides. [Settings reference](SETTINGS_REFERENCE.md) supplies every key, default and scope; [settings service](../packages/platform-service/src/settings/) owns persistence and precedence.

Run `node scripts/capture-documentation.cjs --scenario settings`. The exercise exports a synthetic `access.mode` override, resets it, imports through the UI preview/apply flow, inspects a UI-produced export, submits malformed JSON, checks the value survives rejection, then resets. It retains screenshots of preview, result and failure, without exporting real credentials.

## Review an asset before importing it

Purpose: separate generation, artistic review, file integration and engine acceptance. Prerequisites: an Assets account supporting the requested job type, budget/access for paid actions, a writable disposable Project, and the native tool needed for final acceptance. A provider's completed job does not establish mesh/material readiness.

1. Select the account and operation. State a concrete lantern asset request, output type and intended engine use. Use fixtures unless paid usage is authorized.
2. Submit once and inspect the persisted job ID, status, output files and logs. Use the cancellation control for active jobs; retain provider cancellation results.
3. Inspect previews and downloadable artifact identity. Record scale, bounds, topology/UV/material issues when appropriate. Approve/reject the actual job with a reason.
4. Import only the reviewed output to the intended Project-relative destination using the offered import action. Verify the resulting file and import record; preserve provenance/provider references.
5. Open in the authoring tool or engine and check actual readability/rendering. Record that separate acceptance result.

On a failed generation, inspect provider error/retry semantics before duplicate submission. On unsupported preview format, retain the artifact and use a compatible authoring tool; a failed preview does not establish corrupt geometry. On rejected import, inspect review status, path containment and permissions. [Asset implementation](../packages/platform-service/src/assets/) and [integration guide](INTEGRATION_GUIDE.md) are authoritative.

Run `node scripts/capture-documentation.cjs --scenario assets` for the local synthetic-provider exercise. The [report](images/lantern-assets/capture-report.json) verifies UI submission, downloaded review artifact, explicit human approval, outside-Project rejection, corrected import and exact bytes. [Annotated screenshots](WORKFLOW_SCREENSHOTS.md#synthetic-asset-review-and-import-recovery) explain the metadata-only GLB and expected empty grid. This establishes the workflow without paid generation or artistic/native geometry acceptance.

## Operate an engine or DCC through capability layers

Use **Engine** or **DCC Tools** to inspect installations, Project file identity, headless operations and live bridges separately. Select an operation only if its named capability is available. Confirm the Project/editor identity before live mutations. A connected generic MCP server may lack the identity probe needed for an editor bridge.

For Lantern Workshop, `node scripts/verify-documentation-native.cjs` copies the native fixture to an ignored disposable directory, imports it headlessly and executes collection/reset/movement assertions. `GAMECRAFTER_DOC_GODOT` selects a native executable; on Windows the default uses installed WSL Godot. The runner prints a report location and retains logs. It verifies source/runtime behavior without producing graphical gameplay screenshots or establishing service headless/live bridge readiness.

For Unity, Unreal and Blender, use the disposable acceptance fixtures and host prerequisites in [live engine acceptance](LIVE_ENGINE_ACCEPTANCE.md) and [extended acceptance](EXTENDED_ENGINE_ACCEPTANCE.md). Do not point those scripts at production games. Preserve run identity, command/version, exit status and artifacts. A fixture already tested in an older record remains historical evidence until rerun.

## Refresh the index after editing a document

Purpose: make revised Project knowledge searchable. Edit a synthetic line in `docs/DESIGN.md`, open **Knowledge**, choose **Reconcile**, search its unique phrase in **lexical** mode with source **docs**, then compare the returned quote/citation to the new content. The service owns records/chunks/index status; documents remain the underlying workspace input.

For missing hits, inspect pending/error/index status, scope/filter and the actual file. Reconcile normal filesystem changes first. Use rebuild for the specific index fault described in the [operations guide](OPERATIONS_GUIDE.md); lexical success does not establish embeddings/vector-store acceptance. Run `node scripts/capture-documentation.cjs --scenario knowledge` to exercise a changed document through the UI and assert a fresh citation through the real service.

## Drill backup and restoration

Follow [operations backup instructions](OPERATIONS_GUIDE.md#backups-and-restoration) using Lantern Workshop, a synthetic identity, a local archive destination and a fresh empty restore directory. Inspect creation, encryption identity, verification and restoration as distinct results. Verify representative docs/native files and restored registration before using the result. Never use a redacted settings export as a backup substitute. Run `node scripts/capture-documentation.cjs --scenario backup` for the local UI drill; inspect [its report](images/lantern-backup/capture-report.json) before claiming success on a particular host.

# Group pending approvals and task questions in Requests

**Release:** Unreleased

**Impact:** minor

**Category:** Added

## Summary

Complete the WP6/WP7 prompt-grouping gap with a service-backed Requests view. Concurrent approvals and task questions previously produced independent notifications, and free-text questions depended on locating a task in Swarm. Users can now review the pending set by Project/root task and respond to each request explicitly, without adding bulk permission or frontend-owned durable state.

## Details

- Add the compatible authenticated read-only `broker/pendingInputs` RPC and schema-versioned pending-input projection. Read existing approvals/calls/questions/tasks directly, including Project/task/root context; do not depend on a bounded task-history page or add a new persisted queue/table. Include actionable unresolved approvals and unanswered questions on waiting tasks. Exclude terminal task questions, completed/resolved calls and invalid Project ownership. Name missing-manifest Projects as unavailable; other read errors fail the projection instead of silently reporting no work.
- Preserve mutation authority in existing per-call approval and per-task/question answer RPCs. Fix TaskGraph's stale-question case: a previously answered question cannot be answered again while its task is waiting for a newer question. The regression preserves the original answer and the current question's waiting state. Existing timeout, cancellation, access-mode and ceiling policies remain unchanged; no new broker tool or approval bypass is added.
- Add the singleton transient Requests model, widget, command and Project Home/PlayWeld-menu destinations. Group by Project/root task, with separate direct-request groups and explicit shown/total counts when filtering; show tool/effect/redacted input or the literal question text and its Project/task context in one selected inspector. Support exact listed string choices, including empty literal choices, and nonblank free text when choices are absent or empty. The view submits strings; specialized structured-answer and MCP elicitation flows remain separate.
- Replace and remove the independent ToolApprovalHandler/TaskQuestionHandler toast implementations and bindings. One generic summary notification opens Requests and contains no approval/answer action. New request events coalesce; duplicate snapshots do not repeat a notification, and only one summary is open at a time under Theia's normal notification lifecycle. Existing Swarm approval/question controls remain available. Dismissing a notification or selecting a group grants no permission and does not answer anything.
- Refresh on opening, relevant events, reconnect and ten-second reconciliation. Use a bounded 75ms coalescing window and queue a follow-up read for events during an in-flight read, avoiding both indefinite debounce starvation and overlapping refresh churn. Disconnection invalidates older in-flight results. Failed/disconnected snapshots remain visible but cannot dispatch responses until fresh service data succeeds. Responses capture their own identity, suppress duplicate submissions per request, refresh after errors/success and never automatically retry mutations.
- Keep the selected request identity after it resolves so the inspector clears until another request is selected. Key detail content by request identity to prevent reusing a previous request's action button. A delayed pointer/keyboard action must not become approval of the next request. Keep unsaved drafts across selection changes and transient failures, including unavailable-Project recovery; remove them on resolution. Background reads keep draft fields editable to preserve typing/focus while response buttons wait for fresh state. Drafts are transient and disappear with the view; durable requests remain in the service.
- Add a responsive two-column list/inspector layout that stacks below 680px, wraps long content and constrains form controls. Preserve native button/select/textarea keyboard semantics, selected-state labeling, loading/error states and per-request disabled controls. Navigation tests now include the new Requests command/destination rather than retaining the previous destination count.
- Reconcile WP6/WP7, STATUS and S01/U04 in place, retaining the wider product/creative ownership of U04 and remaining audit-retention/deletion work. Add the selected engineering default in architecture/contracts and the decision log. Update handbook, user guide, operations guide and workflow cookbook for review-only notifications, explicit response controls, recovery and limitations. Regenerate API/schema/inventory projections: 200 requests, unchanged 28 notifications/85 builtin settings/27 service subsystems, and 17 Control Room surfaces including Project Home.
- Compatibility: additive RPC/contracts; no database migration, dependency, package version or installed-profile change. Current product version remains 0.22.0 while pending. Impact `minor` reflects a compatible user-visible feature and replacement of direct toast response buttons with a persistent review surface. Existing exact-identity RPC clients and Swarm response controls remain compatible. No user-confirmed requirement/decision row is changed or newly confirmed.
- Preserve all earlier pending security/documentation, plugin-upgrade and audit-export work. Only disposable test profiles/Projects are used for actual responses. No ordinary user request, credentials/private configuration, paid provider, production editor, installer, release, remote settings or public artifact is modified. The broader suite's existing disposable native/Docker fixtures retain their own evidence boundaries.

## Validation

- Red evidence: the old service rejected `broker/pendingInputs` as an unknown method; the old TaskGraph accepted an old answered question while another was pending. Additional red cases demonstrated sustained-event debounce starvation, inability to answer a valid empty-choice question, and disabled draft fields during background reads. Logs: `.turbo/requests-rpc-red.log`, `.turbo/requests-stale-question-red.log`, `.turbo/requests-event-burst-red.log`, `.turbo/requests-empty-options-red.log`, `.turbo/requests-draft-focus-red.log`.
- Native RPC integration passed with two Projects, root/child task context, choice/free-text questions, independently approved/rejected calls, redacted credential-shaped fixture input, cancellation, missing-manifest Project reporting, stale approval rejection, service restart and recovery of the exact pending question. Corrected the fixture to assert the broker's existing rejection error rather than expecting a success result for a rejected tool call. The original graph regression also passes without weakening its original-answer/current-question assertions.
- Model/render/navigation tests pass for burst coalescing, one review notification, no implicit mutations, sustained events, exact per-call response identity, stale resolutions, disconnect/late results, failed reads/actions, lifecycle disposal, listed/empty/free-text answers, literal text escaping, selected-inspector clearing and draft editability during refresh. Typecheck and lint passed while iterating. Home/menu expectations were updated for the new destination; previous routes remain asserted.
- The first full run passed all package tests but its browser application build hit `EBUSY` copying the loaded Windows `conpty.node` while the owned browser server was running. Stop that server before rebuilding; do not weaken build checks. The first browser attempt also found the summary toast covering the narrow-window answer button; the harness now uses the real **Review requests** action first and asserts that opening the view executes nothing. The final checks below use the corrected harness and a stopped browser server during builds.
- Final `npx turbo run build typecheck lint test --concurrency=1` passed all 33 tasks (25 cached), including actual Electron/browser application builds. The validated package suites total 943 passed / 7 skipped tests across 188 files: contracts 77; platform service 714 passed / 6 skipped; Theia extension 147; other workspaces retain their checks. The final frozen-source repeat after the shown/total count clarification also passed all 33 tasks (25 cached). Logs: `.turbo/requests-quality-final.log`, `.turbo/requests-quality-handoff.log`. Existing app-shell lint/typecheck/test scripts say `skip`; extension/service tests and application builds provide the actual source/build evidence.
- The built-browser acceptance passed seven checks with zero renderer errors: one review summary for three questions/three approvals; no authority from opening Requests; held-click resolution in another client cannot approve a replacement; exact selected approval and independent rejection; correct choice/free-text worker answers; remaining-question recovery after browser reload; renderer health. Draft typing focus/value survived periodic refresh. At a 480px viewport the Requests content measured 383px client/scroll width with no horizontal overflow. Evidence: `.turbo/requests-ui/report.json`, `grouped-requests.png`, `requests-narrow.png`, `.turbo/requests-ui-handoff.log`. The final capture is repeated after the count-label clarification.
- Source/reference and documentation-inventory freshness (200 requests, 28 notifications, 85 settings, 27 service subsystems), documentation evidence integrity, release version 0.22.0, Markdown links, root Prettier, Git whitespace and changed-path/changelog checks passed. Only owned browser/service processes are used; final cleanup verifies port 3130 is free and the isolated service is stopped. No installer, installed Electron/Linux or broad provider/engine acceptance claim is made.

## Files

- `packages/contracts/src/tasks/pending-inputs.ts`
- `packages/contracts/src/tasks/pending-inputs.test.ts`
- `packages/contracts/src/tasks/index.ts`
- `packages/contracts/src/rpc/protocol.ts`
- `packages/platform-service/src/tasks/pending-inputs.ts`
- `packages/platform-service/src/tasks/pending-inputs.integration.test.ts`
- `packages/platform-service/src/tasks/task-graph.ts`
- `packages/platform-service/src/tasks/task-graph.test.ts`
- `packages/platform-service/src/service.ts`
- `packages/theia-control-room/src/common/control-room-protocol.ts`
- `packages/theia-control-room/src/node/control-room-service.ts`
- `packages/theia-control-room/src/browser/requests-model.ts`
- `packages/theia-control-room/src/browser/requests-model.test.ts`
- `packages/theia-control-room/src/browser/requests-widget.tsx`
- `packages/theia-control-room/src/browser/requests-widget.test.tsx`
- `packages/theia-control-room/src/browser/requests-view-contribution.ts`
- `packages/theia-control-room/src/browser/control-room-frontend-module.ts`
- `packages/theia-control-room/src/browser/project-home-widget.tsx`
- `packages/theia-control-room/src/browser/project-home-widget.test.tsx`
- `packages/theia-control-room/src/browser/workspace-menu-contribution.ts`
- `packages/theia-control-room/src/browser/style/index.css`
- `packages/theia-control-room/src/browser/task-question-handler.ts`
- `packages/theia-control-room/src/browser/tool-approval-handler.ts`
- `docs/API_REFERENCE.md`
- `docs/reference/rpc-schemas.json`
- `docs/reference/DOCUMENTATION_INVENTORY.md`
- `docs/reference/documentation-inventory.json`
- `docs/DEVELOPMENT_PLAN.md`
- `docs/STATUS.md`
- `docs/OPEN_DECISIONS.md`
- `docs/TECHNICAL_ARCHITECTURE.md`
- `docs/PLATFORM_DESIGN.md`
- `docs/SKILLS_AGENTS_AND_TOOLS.md`
- `docs/CONTROL_ROOM_HANDBOOK.md`
- `docs/USER_GUIDE.md`
- `docs/OPERATIONS_GUIDE.md`
- `docs/WORKFLOW_COOKBOOK.md`
- `docs/changes/2026-10-24-grouped-requests.md`

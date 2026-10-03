# Stop incomplete IPC message diagnostics retaining closed connections

**Release:** 0.5.0

**Impact:** patch

**Category:** Fixed

## Summary

Repair service/client shutdown after an incomplete framed IPC message: the pinned JSON-RPC reader's recurring partial-message diagnostic timer could survive reader disposal and keep an otherwise cleaned-up process alive.

## Details

- Fresh disposable native acceptance completed its map operations and cleanup but its Node process remained running. Inspection of that owned process found the JSON-RPC partial-message timeout callback as the active recurring timer.
- Reproduce with an authenticated client receiving an incomplete Content-Length frame. The regression failed before the repair with one timer left after disconnect.
- Disable unused partial-message diagnostic notifications on both service and client readers. Framing, authentication, RPC contracts, request timeouts and disconnect handling remain unchanged; neither endpoint consumes this diagnostic notification.
- Add peer-side and client-side lifecycle regressions. No schema, stored-data or package-identifier change; no migration required. Terminate only the verified owned hung acceptance process and retain its original diagnostic logs.

## Validation

- Client incomplete-frame regression reproduced the leak before the repair; both client tests and the service peer-disconnect regression passed after it.
- Full repository build/typecheck/lint/test gate passed all 33 tasks, including 365 platform-service tests with 11 explicit capability-dependent skips. Existing workspace dependencies were reused during concurrent work.
- Fresh native Unreal map acceptance progressed through cleanup into the following Unity test stage without the prior hang. Final native results and formatting/change-record checks are recorded in the companion acceptance record.

## Files

- `packages/service-client/src/index.ts`
- `packages/service-client/src/client.test.ts`
- `packages/platform-service/src/ipc/server.ts`
- `packages/platform-service/src/ipc/server-lifecycle.test.ts`

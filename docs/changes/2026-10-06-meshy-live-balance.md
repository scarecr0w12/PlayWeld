# Expose verified Meshy credit balance in account testing

**Release:** 0.15.0

**Impact:** minor

**Category:** Added

## Summary

Meshy account testing now returns its real credit balance through the documented authenticated balance endpoint.

## Details

- The old adapter advertised no balance support and tested a task-list endpoint, always returning null. It now advertises balance support and uses `GET /openapi/v1/balance`, forwarding the numeric balance through the existing account-test RPC and UI.
- Finite nonnegative balances are retained, including zero; missing, negative or nonnumeric values remain unknown instead of becoming an invented credit count. Authentication/error redaction and HTTP timeout/retry behavior continue through the shared provider request helper.
- Add a real HTTP fixture regression for route/authentication, positive/zero credits and malformed balances. Update the asset-service integration and documentation asset fixtures to implement the balance route and assert its RPC result.
- Endpoint and payload were checked against [Meshy balance documentation](https://docs.meshy.ai/en/api/balance) on 2026-10-06. One authorized live `meshy-6-lite` preview/download/review/import consumed exactly five credits, matching [current pricing](https://docs.meshy.ai/en/api/pricing). This is an integration test asset, not production art approval.
- Compatible new provider capability uses minor impact; no RPC/schema migration is required because account testing already has a nullable balance field. No paid generation is added to ordinary account testing.

## Validation

- The new fixture test failed before implementation and passed through the full combined gate afterward; the asset-service integration exercises the actual account-test RPC.
- Live balance returned 2697 credits before the single preview and 2692 afterward. The downloaded/imported GLB matched its recorded SHA-256 and unreviewed import was rejected. Both provider acceptance runs found zero plaintext source API credential leaks.
- Image/refine requests, Tripo generation, commercial rights and production mesh quality remain outside this live result. The account-test operation itself is read-only at the provider.

## Files

- `packages/platform-service/src/assets/providers/meshy.ts`
- `packages/platform-service/src/assets/providers/providers.test.ts`
- `packages/platform-service/src/assets/asset-service.integration.test.ts`
- `scripts/documentation/asset-scenario.cjs`
- `docs/changes/2026-10-06-meshy-live-balance.md`

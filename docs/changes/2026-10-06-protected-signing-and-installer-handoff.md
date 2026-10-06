# Protected release keys and verified installer handoff

**Release:** 0.15.0

**Impact:** minor

**Category:** Added

## Summary

Add protected local release-signing keys, retain verified previous installers without filename collisions and implement a Windows installer handoff after desktop exit. Publisher trust and complete installer lifecycle remain separate unverified acceptance paths.

## Details

- Add a Windows CurrentUser DPAPI-protected Ed25519 key generator and protected-key reader. Existing key files are never overwritten; plaintext private material is not written to disk or command arguments. Release metadata can use `--signing-key-file`, while the existing configured CI secret remains supported. Ambiguous key sources are rejected; unsigned release gates and the required public platform matrix remain unchanged.
- Verification metadata lives in new versioned sidecar records; existing downloaded/previous package records retain their exact version-1 shape. Packages use separate version directories so identical installer filenames across releases cannot overwrite the rollback package. A release check captures the verified current-version package before clearing its pending download; a subsequent download also preserves that package. The store reports the actual running application version after an upgrade rather than a stale saved version.
- Signed Windows install/rollback preparation rechecks file bytes and confines packages to the owned cache. A service-owned versioned handoff descriptor records its state. Legacy records without digest/signature provenance and other platform packages retain manual instructions.
- The Electron backend starts the service's detached helper using a minimal environment, without provider secrets. The helper waits for the desktop process to exit, checks the package again immediately before launch, avoids duplicate helpers through an owned lease, records launch/failure/expiration and expires after ten minutes. It does not force-close editors or discard unsaved work.
- Additive optional RPC handoff fields preserve existing clients. Legacy package records without verification sidecars retain manual installation/rollback instructions. Generated API references are refreshed. The visible handoff and protected-key workflow warrant minor impact.
- The user reported having no Windows code-signing certificate. Local Ed25519 metadata verification is distinct from Windows Authenticode publisher trust; neither the source nor fixture tests claim a publisher-trusted installer.

## Validation

- All 31 update-service checks passed, including retention when a newer release reuses an installer filename, versioned cache contents and verification sidecars. Seven focused handoff/key checks passed: protected-key generation and non-overwrite, valid metadata/checksum signatures, changed-byte refusal, process-exit waiting, native harmless PE launch and refusal after tampering.
- The harmless executable fixtures are retained under `.artifacts/installer-handoff-tests/` for review. Early temporary-folder cleanup failures were investigated; fixture launch and tampering behavior passed, but cross-process temporary-file ACL cleanup was not a successful acceptance result. The retained fixture layout avoids claiming that cleanup as verified.
- The combined repository gate passed 33/33 tasks, including 557 platform tests/six skips and 128 extension tests. Complete packaged install/upgrade/uninstall/rollback, public trust-key distribution, hosted matrix/publication and Authenticode signing remain pending or unavailable. No ordinary installation or user profile was replaced by these fixture tests.

## Files

- `packages/contracts/src/updates/schema.ts`
- `packages/contracts/src/rpc/protocol.ts`
- `packages/platform-service/src/updates/installer-handoff.ts`
- `packages/platform-service/src/updates/installer-handoff.test.ts`
- `packages/platform-service/src/updates/update-service.ts`
- `packages/platform-service/src/updates/update-service.test.ts`
- `packages/platform-service/src/updates/update-store.ts`
- `packages/platform-service/src/updates/release-metadata-cli.test.ts`
- `packages/theia-control-room/src/node/control-room-service.ts`
- `packages/theia-control-room/src/browser/updates-widget.tsx`
- `scripts/release-signing-key.cjs`
- `scripts/create-release-metadata.cjs`
- `docs/API_REFERENCE.md`
- `docs/RELEASE_GUIDE.md`
- `docs/reference/rpc-methods.json`
- `docs/reference/rpc-schemas.json`
- `docs/changes/2026-10-06-protected-signing-and-installer-handoff.md`

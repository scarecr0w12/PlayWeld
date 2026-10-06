# Native Windows plugin isolation

**Release:** 0.15.0

**Impact:** minor

**Category:** Security

## Summary

Replace the Windows unavailable stub with a native less-privileged AppContainer launcher, with real Node/Electron boundary probes and shared Node/Python plugin lifecycle checks.

## Details

- The plugin host now starts a suspended Windows worker with explicit container permissions, a minimal environment, an inherited stdio handle list and a Job limiting memory and process count. The Job kills descendants when the helper closes. Plugin source is read-only; writes are confined to separate owned scratch storage. Project files are accessed through the existing broker rather than mounted into the worker.
- The build compiles a small .NET Framework helper on Windows and copies it with the service. Non-Windows builds retain their existing launchers. Native helper errors keep isolation unavailable; there is no automatic unrestricted fallback.
- The probe executes Node inside the sandbox and requires denial of a private host file, an All Application Packages readable fixture, source modification and an owned loopback connection, together with a successful scratch write. It uses the documented AppContainer creation attributes; Win32 token query class 46 proved unsupported on this machine, so LPAC opt-out is checked behaviorally rather than inferred from that failed query.
- Node requires the OS registryRead capability to initialize Winsock; network capability remains separately controlled. Node module loading preserves symlink names to avoid inspecting drive roots. Default Python names resolve through the installed Windows Python launcher instead of an unusable Windows Store alias. Electron Node mode receives the equivalent Node options.
- Native stdio writes flush each RPC chunk. An initial lifecycle run exposed buffering that the exit-only probe did not exercise. Native ACL updates use per-path locks so concurrent helpers preserve each other's SID rules; cleanup removes only the owned SID, and native pipe handles close on failed startup.
- Shared plugin lifecycle tests now exercise the native Windows backend. The panel escape test uses a Windows junction instead of requiring privileged file symlink creation; Linux keeps its original fixture.
- Compatibility and migration: plugin manifests, broker contracts and stored records are unchanged. The new backend enables previously unavailable restricted Windows execution. The feature warrants minor impact; this is scoped isolation evidence, not a general security certification.

## Validation

- Native helper compilation and TypeScript build passed. The live five-check LPAC probe passed on Windows, including private-file, All Application Packages, source-write and network denial plus scratch writes.
- Initial lifecycle failures are retained: stdio buffering, the Store Python alias and a Linux-only file symlink fixture. These were corrected; 16 focused isolation, plugin lifecycle and managed-install checks passed with two explicit Linux-only skips. The full repository checks passed as recorded below.
- The retained live report `.artifacts/windows-isolation/1791318379431/report.json` passed all five boundary checks in both Node and actual Electron Node mode. Turbo service build inputs include bundled integrations/skills and Windows build environment; tests depend on the service build so CLI/helper fixtures use current artifacts.
- The combined repository gate passed 33/33 tasks: 557 platform tests passed with six explicit skips, and 128 extension tests passed. Service builds include the compiled helper. A new packaged installer, adversarial process/memory-limit exhaustion, allowed outbound networking and alternate Windows versions remain unverified.
- `.artifacts/windows-isolation/1791324154239/report.json` repeats all five Node/Electron boundary checks and proves that terminating the owned helper kills both its worker and spawned descendant. The early workspace-scratch attempt failed because its managed ACL denied mandatory-label changes; native execution stayed fail-closed. The passing descendant fixture uses an owned temporary directory with those permissions; its path is retained in the report. This does not prove that every custom profile ACL supports LPAC scratch setup.

## Files

- `packages/platform-service/src/plugins/isolation/native/AppContainerHost.cs`
- `packages/platform-service/src/plugins/isolation/appcontainer-launcher.ts`
- `packages/platform-service/src/plugins/isolation/isolation.test.ts`
- `packages/platform-service/src/plugins/plugin-service.integration.test.ts`
- `packages/platform-service/scripts/build-appcontainer.cjs`
- `packages/platform-service/scripts/copy-assets.cjs`
- `turbo.json`
- `scripts/windows-isolation-acceptance.cjs`
- `docs/changes/2026-10-06-windows-plugin-isolation.md`

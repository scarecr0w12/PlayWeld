# Launch the Embedding Selector Update Locally

**Release:** 0.10.3

**Impact:** none

**Category:** Maintenance

## Summary

Built and launched the updated Electron Control Room from the working checkout for local testing, connected to the already-running platform service and profile.

## Details

- Built `@gamecrafter/control-room` in development mode and launched the generated app with the workspace Electron executable. The app used the existing environment and profile; no credentials or profile data were copied or changed.
- The shell supplied `ELECTRON_RUN_AS_NODE`, which makes Electron expose Node mode instead of its application API. Cleared that variable only for the Electron launch process; no persistent environment setting was changed.
- This is a source-built local test run, not an installed upgrade, installer/package, version preparation, tag, or public release. The launched app uses the existing local service, which remains running after the Control Room window closes.

## Validation

- `npm run build -w @gamecrafter/control-room` — passed; browser, Node backend, and Electron builds reported zero errors.
- The initial generic `npm run start -w @gamecrafter/control-room` invocation exited because `ELECTRON_RUN_AS_NODE` was set. After clearing it for the child only, Electron startup logs reached frontend state `ready` and the Control Room backend accepted connections on its local loopback port.
- `node packages/platform-service/lib/cli.js status` — the existing service remained responsive before and after launch.
- The local desktop process and backend were observed running. No live provider request or installer operation was performed.

## Files

- `docs/changes/2026-10-05-local-embedding-selector-test-deployment.md`

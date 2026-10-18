# Settings, backups and updates

A saved plan is not a completed backup; a verified download is not an accepted rollback.

## Choose the settings layer

Open **Configure & Extend > PlayWeld Settings**, search the exact key and inspect effective value/source. Supported precedence is session, Project, platform, builtin. Not every key permits every scope.

**Reset** removes an override. **Import and export** supports validation/preview and redacted export; inspect invalid/skipped entries. Exported settings do not recover credentials or keys. **IDE Settings** is separate. Use the [settings reference](https://github.com/scarecr0w12/PlayWeld/blob/main/docs/SETTINGS_REFERENCE.md) for exact types/scopes.

## Verify recoverability

Under **Review & Maintain > Backups**, use **Identities**, **Destinations**, **Plans**, **Runs**, then **Archives and restore**. Review recovery material, destination, scope, schedule and retention.

Verify an archive and practice restoring a disposable Project to a new empty destination. Inspect identity/registration warnings and representative files. Keep recovery secrets independently available. Profile restore requires launching with the restored profile rather than overwriting the active profile. Local Windows recovery has scoped evidence; remote destinations have different limits.

## Updates and rollback

**Updates** distinguishes discovery, hash/signature checks and installer handoff. Review version/channel/platform/compatibility and release notes. The current public testing prerelease is unsigned, manually downloaded and excluded from stable updates.

Retain compatible pre-update backups and diagnostics. Older binaries may not read newer schemas; an old executable is not proven rollback. Full uninstall/rollback acceptance remains open in [issue #3](https://github.com/scarecr0w12/PlayWeld/issues/3).

Follow [operations](https://github.com/scarecr0w12/PlayWeld/blob/main/docs/OPERATIONS_GUIDE.md), [recovery](https://github.com/scarecr0w12/PlayWeld/blob/main/docs/RECOVERY_RUNBOOK.md) and [release guidance](https://github.com/scarecr0w12/PlayWeld/blob/main/docs/RELEASE_GUIDE.md).

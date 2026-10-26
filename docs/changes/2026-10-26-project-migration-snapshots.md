# Verify and retain Project recovery snapshots before schema upgrades

**Release:** Unreleased

**Impact:** minor

**Category:** Added

## Summary

Existing registered Project databases now retain a fresh, verified old-schema SQLite snapshot before forward migration. Failure to create or verify that recovery file stops the upgrade instead of proceeding without recovery evidence.

## Details

- Previously only the profile startup path took pre-migration snapshots. `ProjectDatabases.get` now invokes a Project-specific guard before migration or Project metadata writes. The guard validates recognized migration history and matching registered Project identity, skips new/current stores, and snapshots only an existing older Project. Incompatible history or identity stops before recovery-file creation. Existing handle cleanup prevents failed upgrades from entering the database cache or retaining an open failed-bootstrap handle.
- The database seam's `VACUUM INTO` captures committed WAL state into a unique `.gamecrafter/pre-migration/project-v<old>-to-v<target>-<uuid>.sqlite.partial` file. The helper restricts file mode where supported, flushes the file with a non-truncating writable handle, opens it read-only, and checks integrity, foreign keys, recognized old migration version and Project identity. Only a verified closed file is renamed to its published `.sqlite` name before migration starts. Ordinary Windows ACLs remain authoritative; this is not an encryption or physical-disk durability guarantee.
- Every attempt uses a fresh name. Earlier snapshots are neither reused nor pruned, including when later migration SQL fails. A retry captures any intervening old-schema changes while retaining prior evidence byte-for-byte. Individual migration transaction behavior is unchanged; successful earlier migrations in a multi-step attempt are not automatically rolled back as a group. A target version in the filename describes intent, not completed migration.
- On snapshot failure only that attempt's temporary file receives best-effort cleanup; prior recovery evidence is retained. Unhandled shutdown can leave an unpublished partial file, which is never automatically selected or reused. Snapshot-directory symlinks/junctions and conflicting or redirected ignore metadata stop the upgrade rather than being followed or overwritten. The directory's canonical ignore file protects already-registered Projects before their root ignore rules are refreshed; these are local filesystem boundary checks, not a race-proof sandbox against concurrent hostile writers.
- New/opened Project ignore rules exclude `.gamecrafter/pre-migration/`. Clone omits the source recovery directory so historical databases with source identity are not copied into the new identity. Clone still snapshots the live source database consistently into its disposable target, and leaves source recovery evidence intact. Existing encrypted whole-Project backups retain their file-selection behavior, including recovery files; no archive/exclusion policy or automatic restore selection changed.
- The architecture, W05 register status, WP2/WP3 plan and status record now distinguish Project snapshots from the unchanged profile snapshot policy, scoped lexical-index recovery and broader open corruption/retention work. The runbook explains file selection, independent doctor inspection, partial-file handling, local plaintext data, disk-use/retention boundaries, identity/revision checks, and the need for game/canon files and verified encrypted backups. Generated documentation inventories include the new Project database test surface.
- Tests demonstrate old-schema state and event preservation, committed WAL capture, fresh retry evidence after a real migration failure, no snapshots for new/current stores, failed creation/verification, foreign-key-invalid snapshots, wrong identity, future history, redirected directories and conflicting ignore rules. Existing workspace tests also prove Git exclusion and source-to-clone exclusion alongside independent chat/settings/task history. Compiled service modules and the CLI doctor are exercised separately on an isolated synthetic recovery fixture.
- During development, the expected missing-snapshot tests failed on unchanged code. The first implementation then exposed Windows `fsync` rejecting a read-only descriptor with EPERM. A temporary fixture-only diagnostic trace identified that call and was removed; the helper now flushes its own file through `r+`, without truncating data or dropping the flush. Assertions and timeouts were not weakened.
- Compatibility and migration: no dependency, RPC method/schema, setting, archive-format or database migration change. Profile/Project schema targets remain 21/14 and product version remains 0.22.0 pending. Minor impact records compatible new automatic recovery functionality. New/current stores and existing profile snapshot naming/retention remain unchanged. Snapshot retention/deletion, general database salvage/quarantine, board/vector recovery, whole-upgrade rollback, in-place restore, signing, installed-product and broad disaster-recovery qualification remain open. The matching W05/S09 Features card remains In progress for that broader scope.

## Validation

- Red: `npm test -w @gamecrafter/platform-service -- src/projects/project-databases.test.ts` failed both original assertions: no snapshot was created, and a blocked recovery directory did not stop migration. Evidence: primary-checkout `.turbo/project-migration-red.log`.
- Green/focused: `npm test -w @gamecrafter/platform-service -- src/projects src/db src/backup/backup-service.integration.test.ts` passed 53 tests across eight files. Includes native Windows filesystem/SQLite/Git fixtures and real local backup/restore integration, not an installed application or remote backup-provider claim. Evidence: `.turbo/project-migration-focused.log`.
- `npx turbo run build typecheck lint --concurrency=1` passed all 25 tasks, 17 cached, including desktop/browser builds. `npx turbo run build typecheck lint test --filter=!@gamecrafter/platform-service --concurrency=1` passed all 30 tasks, 28 cached. Evidence: `.turbo/project-migration-quality.log` and `.turbo/project-migration-other-quality.log`.
- `node .turbo/project-migration-acceptance.cjs` in the primary checkout passed four compiled-module/CLI checks: upgrade reaches v14, doctor reads the published v13 snapshot as upgrade-required, identity/authored sentinel survive, and an independent recovery copy passes doctor while the published snapshot hash remains unchanged. Report: `.turbo/project-migration-acceptance-v9jkwB/report.json`; log: `.turbo/project-migration-acceptance.log`. The synthetic fixture is separate from ordinary profiles and Projects.
- `npm test -w @gamecrafter/platform-service -- --exclude src/updates/installer-handoff.test.ts --exclude src/dcc/blender-real.test.ts`: 777 passed/8 skipped across 135 files (134 passed/one skipped), 385.35 seconds. Evidence: `.turbo/project-migration-service-tests.log` in the primary checkout. Production code was unchanged after this run started; the final focused run separately passed all 53 tests after handle-release and clone-source-preservation assertions were extended (`.turbo/project-migration-focused-final.log`).
- Final service typecheck/lint passed after those assertions were extended. `npm run format:check`, `bash scripts/check-links.sh` (All links OK), generated RPC/settings and documentation inventory checks, documentation evidence integrity, release-version agreement (0.22.0), whitespace and `npm run changelog:check -- --base origin/main` passed. Evidence: `.turbo/project-migration-format.log` and `.turbo/project-migration-links.log`. Existing lockfile/dependencies were reused in the isolated owned worktree; no dependency installation or update was needed. Hosted checks are separate and have not yet run on this candidate.
- The broad local service run explicitly excludes `src/updates/installer-handoff.test.ts` and `src/dcc/blender-real.test.ts` to preserve the established endpoint-protection/native-fixture and external-application boundaries. Hosted CI uses the normal unexcluded commands. No antivirus exclusions, quarantine changes, flagged-executable operations, installed-product recovery, new installer/release, live provider/engine/DCC actions or remote backup calls were performed.

## Files

- `packages/platform-service/src/db/migration-snapshot.ts`
- `packages/platform-service/src/projects/project-databases.ts`
- `packages/platform-service/src/projects/project-databases.test.ts`
- `packages/platform-service/src/projects/workspace.ts`
- `packages/platform-service/src/projects/workspace.test.ts`
- `docs/TECHNICAL_ARCHITECTURE.md`
- `docs/RECOVERY_RUNBOOK.md`
- `docs/DEVELOPMENT_PLAN.md`
- `docs/OPEN_DECISIONS.md`
- `docs/STATUS.md`
- `docs/reference/DOCUMENTATION_INVENTORY.md`
- `docs/reference/documentation-inventory.json`
- `docs/changes/2026-10-26-project-migration-snapshots.md`
- `CHANGELOG.md`

// Complete recovery drill in unique owned directories. No external provider calls.
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const { randomBytes } = require('node:crypto');
const { execFile } = require('node:child_process');
const { promisify } = require('node:util');
const { setTimeout: delay } = require('node:timers/promises');
const { PlatformService } = require('../packages/platform-service/lib/service');
const { resolvePaths } = require('../packages/platform-service/lib/paths');
const { Database } = require('../packages/platform-service/lib/db/database');
const { CredentialStore } = require('../packages/platform-service/lib/profile/credential-store');
const { connect } = require('@gamecrafter/service-client');
const { diagnostics } = require('../docs/examples/service-diagnostics.cjs');

async function main() {
  const root = path.resolve('.artifacts/documentation-recovery', String(Date.now()));
  fs.mkdirSync(root, { recursive: true });
  const version = require('../packages/platform-service/package.json').version;
  const checks = [];
  let service, client, paths;
  async function start(profile) {
    paths = resolvePaths({ ...process.env, GAMECRAFTER_PROFILE_DIR: profile });
    service = await PlatformService.start({ paths, platformVersion: version });
    client = await connect({
      socketPath: service.socketPath,
      token: fs.readFileSync(paths.tokenPath, 'utf8').trim(),
      clientName: 'documentation-recovery',
      clientVersion: version,
    });
  }
  async function stop() {
    client?.close();
    client = undefined;
    await service?.stop();
    service = undefined;
  }
  async function task(taskId, projectId) {
    for (let attempt = 0; attempt < 300; attempt++) {
      const result = await client.call('task/get', { taskId, projectId });
      if (result.state === 'succeeded') return result;
      if (['failed', 'cancelled'].includes(result.state))
        throw new Error('Index task failed: ' + result.error?.code);
      await delay(100);
    }
    throw new Error('Index task timeout');
  }
  try {
    const profile = path.join(root, 'original-profile');
    await start(profile);
    const project = await client.call('project/create', {
      name: 'Lantern profile recovery',
      engine: { family: 'godot' },
      parentDirectory: path.join(root, 'projects'),
    });
    fs.cpSync(
      path.resolve('docs/examples/lantern-workshop/docs'),
      path.join(project.path, 'docs'),
      { recursive: true },
    );
    await client.call('settings/set', {
      scope: 'platform',
      key: 'access.mode',
      value: 'restricted',
    });
    const sampleCredential = randomBytes(24).toString('hex');
    const account = await client.call('asset/addAccount', {
      providerKind: 'meshy',
      displayName: 'Synthetic recovery credential — no provider request',
      baseUrl: 'http://127.0.0.1:1',
      apiKey: sampleCredential,
    });
    const credentialRef = `asset-provider/${account.accountId}/apiKey`;
    const originalKey = fs.readFileSync(path.join(profile, 'credentials.key'));
    await task(
      (await client.call('knowledge/index/reconcile', { projectId: project.projectId })).taskId,
      project.projectId,
    );
    const marker = 'lantern_recovery_revision_' + Date.now();
    fs.appendFileSync(path.join(project.path, 'docs/DESIGN.md'), `\nRecovery marker: ${marker}.\n`);
    await task(
      (await client.call('knowledge/index/rebuild', { projectId: project.projectId, full: true }))
        .taskId,
      project.projectId,
    );
    const search = await client.call('knowledge/search', {
      projectId: project.projectId,
      query: marker,
      mode: 'lexical',
      sources: ['docs'],
      limit: 5,
    });
    assert(
      search.hits.some((hit) => hit.path === 'docs/DESIGN.md' && hit.quote.text.includes(marker)),
    );
    checks.push(
      'Full index rebuild task succeeded and revised native document returned its exact phrase/path/citation',
    );
    const status = await diagnostics(profile, project.projectId);
    assert(status.projects.some((item) => item.projectId === project.projectId));
    assert(status.project.index.chunks > 0);
    const command = await promisify(execFile)(
      process.execPath,
      [
        'docs/examples/service-diagnostics.cjs',
        '--profile',
        profile,
        '--project',
        project.projectId,
      ],
      { windowsHide: true, timeout: 30000 },
    );
    assert.equal(JSON.parse(command.stdout).project.projectId, project.projectId);
    fs.writeFileSync(path.join(root, 'diagnostics.json'), JSON.stringify(status, null, 2) + '\n');
    checks.push(
      'Read-only diagnostic example authenticated and returned registration/index counts without reading credentials',
    );
    const secret = randomBytes(32).toString('hex');
    const identity = await client.call('backup/identity/create', {
      label: 'Synthetic profile recovery',
      secret,
    });
    const destination = await client.call('backup/addDestination', {
      kind: 'local',
      displayName: 'Owned recovery archives',
      config: { directory: path.join(root, 'archives') },
    });
    const started = await client.call('backup/run', {
      scope: 'profile',
      destinationId: destination.destinationId,
      identityId: identity.identityId,
    });
    let run;
    for (let attempt = 0; attempt < 300; attempt++) {
      run = await client.call('backup/run/get', { runId: started.runId });
      if (run.status === 'verified') break;
      assert(!['failed', 'cancelled'].includes(run.status), 'Profile backup failed');
      await delay(100);
    }
    assert.equal(run.status, 'verified');
    const manifest = await client.call('backup/inspect', {
      destinationId: destination.destinationId,
      archiveName: run.archiveName,
      secret,
    });
    assert(manifest.entries.some((entry) => entry.path === 'credentials.key'));
    assert(
      !manifest.entries.some((entry) => ['service.token', 'service.lock'].includes(entry.path)),
    );
    const restoredProfile = path.join(root, 'restored-profile');
    await client.call('backup/restore', {
      destinationId: destination.destinationId,
      archiveName: run.archiveName,
      secret,
      targetPath: restoredProfile,
    });
    assert(fs.readFileSync(path.join(restoredProfile, 'credentials.key')).equals(originalKey));
    checks.push(
      'Verified profile archive includes original credential key, excludes service lifecycle credentials, and restores into a separate empty profile',
    );
    await stop();
    await start(restoredProfile);
    assert.equal(
      (await client.call('project/get', { projectId: project.projectId })).path,
      project.path,
    );
    const setting = await client.call('settings/get', { key: 'access.mode' });
    assert.equal(setting.value, 'restricted');
    assert.equal(
      (await diagnostics(restoredProfile, project.projectId)).project.projectId,
      project.projectId,
    );
    await stop();
    const database = Database.open(path.join(restoredProfile, 'profile.sqlite'));
    try {
      assert.equal(
        new CredentialStore(database, restoredProfile).get(credentialRef),
        sampleCredential,
      );
    } finally {
      database.close();
    }
    checks.push(
      'Restored service launched at a new profile location with original Project path/ID, platform override and decryptable synthetic account credential',
    );
    const brokenProfile = path.join(root, 'wrong-key-profile');
    fs.cpSync(restoredProfile, brokenProfile, { recursive: true });
    fs.writeFileSync(path.join(brokenProfile, 'credentials.key'), randomBytes(32));
    const brokenDb = Database.open(path.join(brokenProfile, 'profile.sqlite'));
    try {
      assert.throws(() => new CredentialStore(brokenDb, brokenProfile).get(credentialRef));
    } finally {
      brokenDb.close();
    }
    assert(fs.readFileSync(path.join(restoredProfile, 'credentials.key')).equals(originalKey));
    checks.push(
      'Replacing key only in an owned offline copy cannot decrypt preserved ciphertext; restored source key remains intact',
    );
    const report = {
      schemaVersion: 1,
      checkedAt: new Date().toISOString(),
      platformVersion: version,
      target:
        'Actual isolated service, profile archive/restore, offline credential seam and lexical indexing; no provider or UI',
      checks,
    };
    fs.writeFileSync(path.join(root, 'report.json'), JSON.stringify(report, null, 2) + '\n');
    console.log(JSON.stringify({ root, ...report }, null, 2));
  } catch (error) {
    fs.writeFileSync(
      path.join(root, 'failure.json'),
      JSON.stringify({ checks, errorCode: error.code ?? error.name }, null, 2),
    );
    throw error;
  } finally {
    await stop();
  }
}
main().catch((error) => {
  console.error('Recovery drill failed:', error.code ?? error.message);
  process.exitCode = 1;
});

const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const { randomBytes } = require('node:crypto');
const { setTimeout: delay } = require('node:timers/promises');

async function backupScenario({
  client,
  page,
  project,
  run,
  checks,
  open,
  click,
  selectSection,
  selectProject,
  capture,
  wait,
}) {
  await open('Backups', 'backups');
  await wait(
    () => document.querySelector('.gamecrafter-backups-section h3')?.textContent === 'Identities',
  );
  async function control(section, label) {
    const handle = await page.evaluateHandle(
      (name, text) => {
        const root = [...document.querySelectorAll('.gamecrafter-backups-section')].find(
          (node) => node.querySelector('h3')?.textContent === name,
        );
        return [...root.querySelectorAll('label')]
          .find((node) => node.firstChild.textContent.trim() === text)
          ?.querySelector('input,select,textarea');
      },
      section,
      label,
    );
    const element = handle.asElement();
    assert(element, `Missing ${section}/${label}`);
    return element;
  }
  async function fill(section, label, value) {
    await (await control(section, label)).asLocator().fill(value);
  }
  async function sectionCapture(name, section) {
    const sectionLabel = {
      Identities: 'Identities',
      Destinations: 'Destinations',
      Plans: 'Plans',
      Runs: 'Runs',
      Archives: 'Archives and restore',
    }[section];
    await selectSection('Backup sections', sectionLabel);
    if (/wrong-secret|restored|nonempty/.test(name)) {
      await page.evaluate(() => {
        document.querySelector('.gamecrafter-backups').scrollTop = 0;
      });
      await capture(name, '.gamecrafter-backups');
      return;
    }
    await page.evaluate(
      (text) =>
        [...document.querySelectorAll('.gamecrafter-backups-section')]
          .find((node) => node.querySelector('h3')?.textContent === text)
          .scrollIntoView(),
      section,
    );
    await capture(name, '.gamecrafter-backups');
  }
  const secret = randomBytes(24).toString('hex');
  await fill('Identities', 'Label', 'Synthetic Lantern recovery identity');
  await fill('Identities', 'Recovery secret', secret);
  await fill('Identities', 'Confirm secret', secret);
  await click('.gamecrafter-backups button', 'Create identity');
  await wait(() =>
    document
      .querySelector('.gamecrafter-backups-message')
      ?.textContent.includes('Recovery identity created'),
  );
  await selectSection('Backup sections', 'Destinations');
  await fill('Destinations', 'Display name', 'Disposable local tutorial archives');
  await fill(
    'Destinations',
    'Configuration JSON',
    JSON.stringify({ directory: path.join(run, 'archives') }),
  );
  await click('.gamecrafter-backups button', 'Add destination');
  await wait(() =>
    document
      .querySelector('.gamecrafter-backups-message')
      ?.textContent.includes('Destination added'),
  );
  await selectSection('Backup sections', 'Plans');
  await selectProject('[aria-label="Backups Project"]', project.projectId);
  await sectionCapture('backup-configuration', 'Plans');
  await click('.gamecrafter-backups button', 'Run now');
  let backup;
  for (let attempt = 0; attempt < 120; attempt++) {
    backup = (await client.call('backup/runs', { projectId: project.projectId })).runs[0];
    if (backup?.status === 'verified') break;
    if (backup?.status === 'failed' || attempt === 119)
      throw new Error('Backup did not verify: ' + JSON.stringify(backup));
    await delay(500);
  }
  await click('.gamecrafter-backups header button', 'Refresh');
  await sectionCapture('backup-verified', 'Runs');
  await selectSection('Backup sections', 'Archives and restore');
  await click('.gamecrafter-backups button', 'List archives');
  await wait(
    (archiveName) =>
      [...document.querySelectorAll('.gamecrafter-backups select option')].some(
        (node) => node.value === archiveName,
      ),
    backup.archiveName,
  );
  await (await control('Archives', 'Archive')).select(backup.archiveName);
  await fill('Archives', 'Recovery secret', randomBytes(24).toString('hex'));
  await click('.gamecrafter-backups button', 'Verify / restore drill');
  await wait(() => {
    const text = document.querySelector('.gamecrafter-backups-message')?.textContent ?? '';
    return text.startsWith('Verification failed:');
  });
  await sectionCapture('backup-wrong-secret', 'Archives');
  await fill('Archives', 'Recovery secret', secret);
  await click('.gamecrafter-backups button', 'Verify / restore drill');
  await wait(() =>
    document.querySelector('.gamecrafter-backups-message')?.textContent.includes('Verified'),
  );
  const target = path.join(run, 'restored-lantern');
  await fill('Archives', 'Restore target path', target);
  await click('.gamecrafter-backups button', 'Restore to new location');
  await wait(() =>
    document.querySelector('.gamecrafter-backups-message')?.textContent.includes('Restored'),
  );
  assert.equal(
    fs.readFileSync(path.join(target, 'docs/DESIGN.md'), 'utf8'),
    fs.readFileSync(path.join(project.path, 'docs/DESIGN.md'), 'utf8'),
  );
  assert.equal(
    fs.readFileSync(path.join(target, 'game/main.gd'), 'utf8'),
    fs.readFileSync(path.join(project.path, 'game/main.gd'), 'utf8'),
  );
  const restored = (await client.call('project/list', {})).projects.find(
    (item) => item.path === target,
  );
  assert(restored && restored.projectId !== project.projectId);
  await sectionCapture('backup-restored', 'Archives');
  await click('.gamecrafter-backups button', 'Restore to new location');
  await wait(() =>
    /empty|exist/i.test(document.querySelector('.gamecrafter-backups-message')?.textContent ?? ''),
  );
  await sectionCapture('backup-nonempty-target', 'Archives');
  checks.push(
    'Backup: UI identity/destination/manual run, verified local archive, wrong-secret rejection, successful drill/restore, byte-identical docs/native files, new Project registration and nonempty-target rejection; recovery secrets retained only in memory',
  );
}
module.exports = { backupScenario };

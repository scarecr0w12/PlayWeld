#!/usr/bin/env node
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

const categories = [
  'Added',
  'Changed',
  'Deprecated',
  'Removed',
  'Fixed',
  'Security',
  'Documentation',
  'Maintenance',
];
const impacts = ['none', 'patch', 'minor', 'major'];
const versionPattern = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-[0-9A-Za-z.-]+)?$/;
const baseline = `## Historical baseline

Tracking starts after local version 0.1.4. Earlier notes are preserved as historical evidence, not reconstructed into a complete work ledger:

- [0.1.4: PlayWeld identity and artwork](docs/releases/v0.1.4.md).
- 0.1.3: no dedicated release-note file exists at the tracking baseline; details are incomplete.
- [0.1.2: forms, model selection, chat and layouts](docs/releases/v0.1.2.md).
- [0.1.1: testing packages and platform work](docs/releases/v0.1.1.md).

These version labels do not imply public tags or published releases.
`;

function git(root, args) {
  return execFileSync('git', args, { cwd: root, encoding: 'utf8', stdio: 'pipe' }).trim();
}

function readEntries(root) {
  const directory = path.join(root, 'docs/changes');
  return fs
    .readdirSync(directory)
    .filter((name) => /^\d{4}-\d{2}-\d{2}-.+\.md$/.test(name))
    .sort()
    .map((name) => {
      const file = `docs/changes/${name}`;
      const source = fs.readFileSync(path.join(root, file), 'utf8');
      const field = (label) =>
        source.match(new RegExp(`^\\*\\*${label}:\\*\\* (.+)$`, 'm'))?.[1].trim();
      const section = (label) =>
        source
          .match(new RegExp(`^## ${label}\\r?\\n([\\s\\S]*?)(?=^## |$(?![\\s\\S]))`, 'm'))?.[1]
          .trim();
      const entry = {
        file,
        source,
        title: source.match(/^# (.+)$/m)?.[1],
        release: field('Release'),
        impact: field('Impact'),
        category: field('Category'),
        summary: section('Summary'),
        details: section('Details'),
        validation: section('Validation'),
        files: section('Files'),
      };
      for (const [key, value] of Object.entries(entry)) {
        if (key === 'source') continue;
        if (!value || /^(?:TODO|TBD)\b|(?:^|\n)\s*(?:-\s+)?<[^>\n]+>\s*$/.test(value))
          throw new Error(`${file}: missing or unfinished ${key}.`);
      }
      if (!categories.includes(entry.category) || !impacts.includes(entry.impact))
        throw new Error(`${file}: invalid category or impact.`);
      if (entry.release !== 'Unreleased' && !versionPattern.test(entry.release))
        throw new Error(`${file}: invalid release.`);
      entry.paths = entry.files.split(/\r?\n/).map((line) => {
        const match = line.match(/^- `([^`]+)`$/);
        if (
          !match ||
          match[1].includes('\\') ||
          match[1].startsWith('/') ||
          match[1].split('/').includes('..') ||
          /[*?<>]/.test(match[1])
        )
          throw new Error(`${file}: list exact repository-relative paths in Files.`);
        return match[1];
      });
      return entry;
    });
}

// Records live two directories below the changelog. Preserve their Markdown
// structure and resolve local links against the original record, including anchors.
function changelogSection(content, file) {
  let fence;
  return content
    .split(/\r?\n/)
    .map((line) => {
      const marker = line.match(/^\s*(`{3,}|~{3,})/);
      if (marker) {
        if (!fence) fence = marker[1];
        else if (marker[1][0] === fence[0] && marker[1].length >= fence.length) fence = undefined;
        return line;
      }
      if (fence) return line;
      return line
        .replace(/^(#{1,6}) /, (_, hashes) => `${'#'.repeat(Math.min(6, hashes.length + 3))} `)
        .replace(/\]\(([^\s)]+)\)/g, (match, target) => {
          if (/^(?:[a-z][a-z\d+.-]*:|\/)/i.test(target)) return match;
          const [destination, anchor] = target.split('#');
          const resolved = destination
            ? path.posix.normalize(path.posix.join(path.posix.dirname(file), destination))
            : file;
          return `](${resolved}${anchor === undefined ? '' : '#' + anchor})`;
        });
    })
    .join('\n');
}

function renderChangelog(entries) {
  let output =
    '# PlayWeld changelog\n\nComplete tracked work, grouped by version and category, with full details, validation, and affected files. Generated from permanent [work records](docs/changes/README.md). Run `npm run changelog:update`; edit the records rather than this file. Release preparation assigns pending records to a version. Historical completeness is limited to the tracking baseline below.\n\n';
  const versions = [
    ...new Set(entries.map((entry) => entry.release).filter((release) => release !== 'Unreleased')),
  ]
    .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }))
    .reverse();
  for (const release of ['Unreleased', ...versions]) {
    output += `## ${release}\n\n`;
    const group = entries.filter((entry) => entry.release === release);
    if (!group.length) output += 'No pending work records.\n\n';
    for (const category of categories) {
      const selected = group.filter((entry) => entry.category === category);
      if (!selected.length) continue;
      output += `### ${category}\n\n`;
      for (const entry of selected) {
        output += `#### ${entry.title}\n\n**Impact:** ${entry.impact}\n\n[Permanent work record](${entry.file}).\n\n`;
        for (const [label, content] of [
          ['Summary', entry.summary],
          ['Details', entry.details],
          ['Validation', entry.validation],
          ['Files', entry.files],
        ])
          output += `##### ${label}\n\n${changelogSection(content, entry.file)}\n\n`;
      }
    }
  }
  return output + baseline;
}

function renderRelease(version, entries) {
  let output = `# PlayWeld ${version}\n\nPrepared release notes; publication and build acceptance require separate evidence.\n\n`;
  for (const entry of entries.filter((entry) => entry.release === version)) {
    output += `## ${entry.title}\n\n**Category:** ${entry.category}\n\n**Impact:** ${entry.impact}\n\n${entry.summary}\n\n${entry.details}\n\n### Validation\n\n${entry.validation}\n\n[Permanent work record](../changes/${path.basename(entry.file)}).\n\n`;
  }
  return output.trimEnd() + '\n';
}

function generatedFiles(entries) {
  const files = new Map([['CHANGELOG.md', renderChangelog(entries)]]);
  for (const version of new Set(entries.map((entry) => entry.release))) {
    if (version !== 'Unreleased')
      files.set(`docs/releases/v${version}.md`, renderRelease(version, entries));
  }
  return files;
}

function update(root, entries = readEntries(root)) {
  for (const [file, content] of generatedFiles(entries))
    fs.writeFileSync(path.join(root, file), content);
}

function validateBump(current, version, entries) {
  const numeric = (value) => value.split('-')[0].split('.').map(Number);
  const before = numeric(current);
  const after = numeric(version);
  const firstDifference = after.findIndex((value, index) => value !== before[index]);
  if (
    !versionPattern.test(version) ||
    firstDifference < 0 ||
    after[firstDifference] < before[firstDifference]
  )
    throw new Error(`New release must advance the numeric version beyond ${current}.`);
  const impact = Math.max(0, ...entries.map((entry) => impacts.indexOf(entry.impact)));
  const required = impact === 3 && before[0] === 0 ? 2 : impact;
  if ((required === 3 && firstDifference !== 0) || (required === 2 && firstDifference > 1))
    throw new Error(
      'Version bump is smaller than the recorded impact. Breaking changes before 1.0 require a minor bump.',
    );
}

function compareNumeric(left, right) {
  const a = left.split('-')[0].split('.').map(Number);
  const b = right.split('-')[0].split('.').map(Number);
  const index = a.findIndex((value, position) => value !== b[position]);
  return index < 0 ? 0 : Math.sign(a[index] - b[index]);
}

function check(root, { base, release = false, working = true } = {}) {
  // Packaging must also reject local source changes that have no work record.
  if (release && !base) base = 'HEAD';
  const entries = readEntries(root);
  const generated = generatedFiles(entries);
  for (const [file, content] of generated) {
    if (
      !fs.existsSync(path.join(root, file)) ||
      fs.readFileSync(path.join(root, file), 'utf8') !== content
    )
      throw new Error(`${file} is stale. Run npm run changelog:update.`);
  }
  if (release) {
    const version = JSON.parse(
      fs.readFileSync(path.join(root, 'apps/control-room/package.json'), 'utf8'),
    ).version;
    if (entries.some((entry) => entry.release === 'Unreleased'))
      throw new Error('Pending work must be assigned with release:version before packaging.');
    if (!generated.has(`docs/releases/v${version}.md`))
      throw new Error(
        `No tracked release notes for ${version}. Prepare a new version before packaging.`,
      );
  }
  if (base) {
    const names = (args) => git(root, args).split('\0').filter(Boolean);
    const changed = new Set(names(['diff', '--name-only', '--no-renames', '-z', base, 'HEAD']));
    if (working) {
      for (const file of [
        ...names(['diff', '--name-only', '--no-renames', '-z', 'HEAD']),
        ...names(['ls-files', '--others', '--exclude-standard', '-z']),
      ])
        changed.add(file);
    }
    const records = entries.filter((entry) => changed.has(entry.file));
    const version = JSON.parse(
      fs.readFileSync(path.join(root, 'apps/control-room/package.json'), 'utf8'),
    ).version;
    const previousVersion = JSON.parse(
      git(root, ['show', `${base}:apps/control-room/package.json`]),
    ).version;
    const assigned = [];
    for (const entry of records) {
      let old;
      try {
        old = git(root, ['show', `${base}:${entry.file}`]);
      } catch {
        /* New work record. */
      }
      if (old && !old.includes('**Release:** Unreleased') && old !== entry.source.trim())
        throw new Error(
          `Released work record is immutable: ${entry.file}. Record a correction in a new entry.`,
        );
      if ((!old || old.includes('**Release:** Unreleased')) && entry.release !== 'Unreleased') {
        if (
          compareNumeric(entry.release, previousVersion) <= 0 ||
          compareNumeric(entry.release, version) > 0
        )
          throw new Error(
            `${entry.file}: newly assigned records require a new current release version.`,
          );
        assigned.push(entry);
      }
    }
    if (version !== previousVersion) {
      if (!assigned.length) throw new Error('Version changes require newly assigned work records.');
      validateBump(previousVersion, version, assigned);
    }
    for (const file of changed) {
      if (/^docs\/changes\/\d{4}-\d{2}-\d{2}-.+\.md$/.test(file)) {
        if (!entries.some((entry) => entry.file === file))
          throw new Error(`Work records cannot be removed: ${file}.`);
        continue;
      }
      if (generated.has(file)) continue;
      if (!records.some((entry) => entry.paths.includes(file)))
        throw new Error(`Untracked work: ${file}. Add it to a new or updated pending work record.`);
    }
  }
  return entries;
}

function prepare(
  root,
  version,
  versionFiles = ['apps/control-room/package.json', 'package-lock.json'],
) {
  const entries = check(root, { base: 'HEAD' });
  const pending = entries.filter((entry) => entry.release === 'Unreleased');
  if (!pending.length) throw new Error('A new version requires pending work records.');
  const current = JSON.parse(
    fs.readFileSync(path.join(root, 'apps/control-room/package.json'), 'utf8'),
  ).version;
  validateBump(current, version, pending);
  if (
    fs.existsSync(path.join(root, `docs/releases/v${version}.md`)) ||
    git(root, ['tag', '--list', `v${version}`])
  )
    throw new Error(`Preserve existing version ${version}; choose a new version.`);
  const date = new Intl.DateTimeFormat('en-CA').format(new Date());
  const releaseFile = `docs/changes/${date}-release-${version}.md`;
  if (fs.existsSync(path.join(root, releaseFile)))
    throw new Error(`Work record already exists: ${releaseFile}.`);
  const releaseSource = `# Prepare version ${version}\n\n**Release:** ${version}\n\n**Impact:** none\n\n**Category:** Maintenance\n\n## Summary\n\nPrepare version ${version} from ${current}, retaining all pending work records in the changelog and detailed release notes.\n\n## Details\n\nSynchronize first-party workspace and internal dependency versions. The lockfile must be refreshed separately. No tag, publication, or build is performed by version preparation.\n\n## Validation\n\nWork-record freshness, local file coverage, version progression, and recorded impact checked before preparation. Dependency installation, refreshed lockfile verification, quality checks, packaging, signing, and live acceptance are not yet verified by this preparation record; retain their actual evidence in a follow-up work record.\n\n## Files\n\n${versionFiles.map((file) => '- `' + file + '`').join('\n')}\n`;
  fs.writeFileSync(path.join(root, releaseFile), releaseSource);
  for (const entry of pending) {
    entry.release = version;
    entry.source = entry.source.replace('**Release:** Unreleased', `**Release:** ${version}`);
    fs.writeFileSync(path.join(root, entry.file), entry.source);
  }
  update(root);
}

if (require.main === module) {
  try {
    const root = path.resolve(__dirname, '..');
    const args = process.argv.slice(2);
    const base = args.includes('--base') ? args[args.indexOf('--base') + 1] : undefined;
    if (args.includes('--base') && !base) throw new Error('--base requires a Git revision.');
    if (args[0] === 'update') update(root);
    else if (args[0] === 'check') {
      check(root, {
        base,
        release: args.includes('--release'),
        working: !args.includes('--committed'),
      });
      console.log('Change records and changelog verified.');
    } else
      throw new Error(
        'Use change-tracking.cjs update|check [--base revision] [--committed] [--release].',
      );
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}

module.exports = { readEntries, update, check, prepare };

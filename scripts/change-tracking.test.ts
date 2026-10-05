import { afterEach, describe, expect, it } from 'vitest';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync, renameSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';

const { check, update, prepare } = createRequire(import.meta.url)('./change-tracking.cjs');
const roots: string[] = [];
const git = (root: string, ...args: string[]) =>
  execFileSync('git', args, { cwd: root, stdio: 'pipe' });
const save = (root: string, file: string, content: string) =>
  writeFileSync(join(root, file), content);
const recordPath = 'docs/changes/2026-10-02-example.md';
function record(root: string, impact = 'patch', files = ['source.txt'], release = 'Unreleased') {
  save(
    root,
    recordPath,
    `# Example change\n\n**Release:** ${release}\n\n**Impact:** ${impact}\n\n**Category:** Fixed\n\n## Summary\n\nCorrect example behavior.\n\n## Details\n\nExplain the behavior and compatibility effects.\n\n## Validation\n\nSource inspection only; no live application test.\n\n## Files\n\n${files.map((file) => '- `' + file + '`').join('\n')}\n`,
  );
  update(root);
}
function fixture() {
  const root = mkdtempSync(join(tmpdir(), 'playweld-changes-'));
  roots.push(root);
  mkdirSync(join(root, 'docs/changes'), { recursive: true });
  mkdirSync(join(root, 'docs/releases'), { recursive: true });
  mkdirSync(join(root, 'apps/control-room'), { recursive: true });
  save(root, 'apps/control-room/package.json', '{"version":"0.1.4"}\n');
  save(root, 'source.txt', 'original\n');
  update(root);
  git(root, 'init');
  git(root, 'config', 'user.email', 'test@example.invalid');
  git(root, 'config', 'user.name', 'Change tracking test');
  git(root, 'config', 'core.autocrlf', 'false');
  git(root, 'add', '.');
  git(root, 'commit', '-m', 'baseline');
  return root;
}
afterEach(() => roots.splice(0).forEach((root) => rmSync(root, { recursive: true, force: true })));

describe('permanent work tracking', () => {
  it('generates release notes that pass staged Git whitespace validation', () => {
    const root = fixture();
    record(root);
    prepare(root, '0.1.5');
    git(root, 'add', '.');
    expect(() =>
      git(root, 'diff', '--cached', '--check', '--', 'docs/releases/v0.1.5.md'),
    ).not.toThrow();
  });
  it('rejects uncovered untracked files and accepts exact pending coverage', () => {
    const root = fixture();
    save(root, 'new.txt', 'addition');
    expect(() => check(root, { base: 'HEAD' })).toThrow('Untracked work: new.txt');
    record(root, 'minor', ['new.txt']);
    expect(() => check(root, { base: 'HEAD' })).not.toThrow();
  });
  it('requires both deleted and added paths for renames', () => {
    const root = fixture();
    renameSync(join(root, 'source.txt'), join(root, 'renamed.txt'));
    record(root, 'patch', ['renamed.txt']);
    expect(() => check(root, { base: 'HEAD' })).toThrow('Untracked work: source.txt');
    record(root, 'patch', ['source.txt', 'renamed.txt']);
    expect(() => check(root, { base: 'HEAD' })).not.toThrow();
  });
  it('checks every commit in a range and does not let an unchanged record cover new work', () => {
    const root = fixture();
    record(root);
    git(root, 'add', '.');
    git(root, 'commit', '-m', 'record');
    save(root, 'source.txt', 'changed');
    expect(() => check(root, { base: 'HEAD' })).toThrow('Untracked work: source.txt');
    expect(() => check(root, { base: 'HEAD~1' })).not.toThrow();
    git(root, 'add', '.');
    git(root, 'commit', '-m', 'source');
    expect(() => check(root, { base: 'HEAD~2', working: false })).not.toThrow();
  });
  it('rejects stale generated text and incomplete or wildcard records', () => {
    const root = fixture();
    record(root);
    save(root, 'CHANGELOG.md', 'manual rewrite');
    expect(() => check(root)).toThrow('stale');
    update(root);
    save(
      root,
      recordPath,
      readFileSync(join(root, recordPath), 'utf8').replace('Source inspection only', 'TODO'),
    );
    expect(() => update(root)).toThrow('unfinished');
    expect(() => record(root, 'patch', ['packages/*'])).toThrow('exact repository-relative paths');
  });
  it('protects released records from edits and deletion', () => {
    const root = fixture();
    record(root, 'patch', ['source.txt'], '0.1.5');
    git(root, 'add', '.');
    git(root, 'commit', '-m', 'released');
    save(
      root,
      recordPath,
      readFileSync(join(root, recordPath), 'utf8').replace(
        'Explain the behavior',
        'Rewrite the behavior',
      ),
    );
    update(root);
    expect(() => check(root, { base: 'HEAD' })).toThrow('immutable');
    rmSync(join(root, recordPath));
    update(root);
    expect(() => check(root, { base: 'HEAD' })).toThrow('cannot be removed');
  });
  it('requires a new prepared version and closed ledger before packaging', () => {
    const root = fixture();
    record(root);
    expect(() => check(root, { release: true })).toThrow('Pending work');
    expect(() => prepare(root, '0.1.4')).toThrow('advance');
    prepare(root, '0.1.5');
    expect(readFileSync(join(root, recordPath), 'utf8')).toContain('**Release:** 0.1.5');
    expect(readFileSync(join(root, 'docs/releases/v0.1.5.md'), 'utf8')).toContain(
      'Source inspection only',
    );
    expect(() => check(root, { release: true })).toThrow('No tracked release notes for 0.1.4');
    save(root, 'apps/control-room/package.json', '{"version":"0.1.5"}\n');
    expect(() => check(root, { release: true, base: 'HEAD' })).not.toThrow();
    expect(() => prepare(root, '0.1.6')).toThrow('requires pending');
    save(root, 'unrecorded.txt', 'new source after preparation');
    expect(() => check(root, { release: true })).toThrow('Untracked work: unrecorded.txt');
  }, 20_000);
  it('enforces feature and breaking impacts without mutating on rejection', () => {
    const root = fixture();
    record(root, 'minor');
    expect(() => prepare(root, '0.1.5')).toThrow('smaller');
    expect(readFileSync(join(root, recordPath), 'utf8')).toContain('Unreleased');
    record(root, 'major');
    expect(() => prepare(root, '0.1.5')).toThrow('smaller');
    expect(() => prepare(root, '0.2.0')).not.toThrow();
  });
  it('requires major bumps for breaking stable contracts and preserves existing tags', () => {
    const root = fixture();
    save(root, 'apps/control-room/package.json', '{"version":"1.2.3"}\n');
    git(root, 'add', '.');
    git(root, 'commit', '-m', 'stable baseline');
    record(root, 'major', ['apps/control-room/package.json']);
    expect(() => prepare(root, '1.3.0')).toThrow('smaller');
    git(root, 'tag', 'v2.0.0');
    expect(() => prepare(root, '2.0.0')).toThrow('Preserve existing version');
  });
  it('rejects manually undersized bumps and assigning new work to an old version', () => {
    const root = fixture();
    record(root, 'minor', ['apps/control-room/package.json'], '0.1.4');
    expect(() => check(root, { base: 'HEAD' })).toThrow('new current release');
    save(root, 'apps/control-room/package.json', '{"version":"0.1.5"}\n');
    record(root, 'minor', ['apps/control-room/package.json'], '0.1.5');
    expect(() => check(root, { base: 'HEAD' })).toThrow('smaller');
  });
  it('supports push ranges that include more than one prepared release', () => {
    const root = fixture();
    record(root);
    prepare(root, '0.1.5');
    save(root, 'apps/control-room/package.json', '{"version":"0.1.5"}\n');
    git(root, 'add', '.');
    git(root, 'commit', '-m', 'first release');
    save(
      root,
      'docs/changes/2026-10-02-next.md',
      readFileSync(join(root, recordPath), 'utf8').replace(
        '**Release:** 0.1.5',
        '**Release:** Unreleased',
      ),
    );
    update(root);
    prepare(root, '0.1.6');
    save(root, 'apps/control-room/package.json', '{"version":"0.1.6"}\n');
    expect(() => check(root, { base: 'HEAD~1' })).not.toThrow();
  });
  it('allows concrete code examples and discussion of removed TODOs in task details', () => {
    const root = fixture();
    record(root);
    save(
      root,
      recordPath,
      readFileSync(join(root, recordPath), 'utf8').replace(
        'Explain the behavior and compatibility effects.',
        'Removed TODO comments and corrected Map<string, number> handling.',
      ),
    );
    expect(() => update(root)).not.toThrow();
    expect(() => check(root, { base: 'HEAD' })).not.toThrow();
  });
});

import { describe, expect, it } from 'vitest';
import type { ProjectSummary } from '@gamecrafter/contracts';
import { WorkspaceProjectSelection } from './workspace-project-selection';

const projects = [
  { projectId: 'other', path: 'E:\\Games\\Other' },
  { projectId: 'open', path: 'E:\\Games\\Open' },
] as ProjectSummary[];

describe('workspace Project selection', () => {
  it('returns the same default for overlapping startup refreshes with empty fields', () => {
    const selection = new WorkspaceProjectSelection();
    expect(selection.resolve(projects, [projects[1]!.path])).toBe('open');
    expect(selection.resolve(projects, [projects[1]!.path])).toBe('open');
  });
  it('selects the restored IDE project even when another project is first', () => {
    expect(new WorkspaceProjectSelection().resolve(projects, ['E:\\Games\\Open'])).toBe('open');
    // A newly created widget after closing/reopening uses the same workspace default.
    expect(new WorkspaceProjectSelection().resolve(projects, ['E:\\Games\\Open'])).toBe('open');
  });

  it('matches Windows casing, slash differences, trailing slashes and child folders', () => {
    expect(new WorkspaceProjectSelection().resolve(projects, ['/e:/games/open/Content/'])).toBe(
      'open',
    );
    expect(new WorkspaceProjectSelection().resolve(projects, ['E:/Games/OpenOther'])).toBe('');
  });

  it('keeps deliberate project and platform-only choices on refresh', () => {
    const selection = new WorkspaceProjectSelection();
    expect(selection.resolve(projects, [projects[1]!.path])).toBe('open');
    selection.markExplicit();
    expect(selection.resolve(projects, [projects[1]!.path], 'other')).toBe('other');
    expect(selection.resolve(projects, [projects[1]!.path], '')).toBe('');
  });

  it('changes the default when the IDE workspace changes and discards removed selections', () => {
    const selection = new WorkspaceProjectSelection();
    selection.resolve(projects, [projects[1]!.path]);
    expect(selection.resolve(projects, [projects[0]!.path], 'open')).toBe('other');
    expect(selection.resolve(projects.slice(1), [projects[0]!.path], 'other')).toBe('');
  });

  it('does not guess for empty, unknown, duplicate or mixed project workspaces', () => {
    for (const roots of [[], ['E:/Unknown'], projects.map((p) => p.path)]) {
      expect(new WorkspaceProjectSelection().resolve(projects, roots)).toBe('');
    }
    expect(
      new WorkspaceProjectSelection().resolve(
        [...projects, { ...projects[1]!, projectId: 'duplicate' }],
        [projects[1]!.path],
      ),
    ).toBe('');
  });

  it('uses the closest registered project and permits several roots within it', () => {
    const nested = [
      ...projects,
      { ...projects[1]!, path: 'E:/Games/Open/Nested', projectId: 'nested' },
    ];
    expect(new WorkspaceProjectSelection().resolve(nested, ['E:/Games/Open/Nested/src'])).toBe(
      'nested',
    );
    expect(
      new WorkspaceProjectSelection().resolve(projects, [
        'E:/Games/Open/src',
        'E:/Games/Open/assets',
      ]),
    ).toBe('open');
  });

  it('preserves explicit command deep links on initial load', () => {
    expect(new WorkspaceProjectSelection().resolve(projects, [projects[1]!.path], 'other')).toBe(
      'other',
    );
  });

  it('keeps case-sensitive POSIX projects distinct', () => {
    const posix = [{ ...projects[0]!, path: '/games/Open' }];
    expect(new WorkspaceProjectSelection().resolve(posix, ['/games/open'])).toBe('');
  });
});

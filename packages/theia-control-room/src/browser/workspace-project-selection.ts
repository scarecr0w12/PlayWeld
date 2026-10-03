import type { ProjectSummary } from '@gamecrafter/contracts';

function normalizePath(path: string): string {
  const normalized = path
    .replace(/\\/g, '/')
    .replace(/^\/([a-z]:\/)/i, '$1')
    .replace(/\/+$/, '');
  return /^[a-z]:\//i.test(normalized) || normalized.startsWith('//')
    ? normalized.toLowerCase()
    : normalized;
}

/** Session-only view selection; the IDE workspace remains the source of the default. */
export class WorkspaceProjectSelection {
  private workspaceKey?: string;
  private explicitSelection = false;

  markExplicit(): void {
    this.explicitSelection = true;
  }

  resolve(projects: readonly ProjectSummary[], roots: readonly string[], current?: string): string {
    const paths = roots.map(normalizePath).sort();
    const key = JSON.stringify(paths);
    const validCurrent = projects.some((project) => project.projectId === current);
    // Preserve explicit choices (including the platform-only/empty option) until
    // the IDE workspace changes. A command deep link is also an explicit choice.
    if (key === this.workspaceKey && (validCurrent || (!current && this.explicitSelection)))
      return current ?? '';
    const initial = this.workspaceKey === undefined;
    if (!initial && key !== this.workspaceKey) this.explicitSelection = false;
    this.workspaceKey = key;
    if (initial && validCurrent) return current!;

    const matches = paths.map((root) => {
      const candidates = projects.filter((project) => {
        const path = normalizePath(project.path);
        return root === path || root.startsWith(`${path}/`);
      });
      candidates.sort((a, b) => normalizePath(b.path).length - normalizePath(a.path).length);
      if (
        candidates.length > 1 &&
        normalizePath(candidates[0]!.path) === normalizePath(candidates[1]!.path)
      )
        return undefined;
      return candidates[0]?.projectId;
    });
    // An empty, unknown or ambiguous workspace must never select an unrelated Project.
    return matches.length && matches[0] && matches.every((id) => id === matches[0])
      ? matches[0]
      : '';
  }
}

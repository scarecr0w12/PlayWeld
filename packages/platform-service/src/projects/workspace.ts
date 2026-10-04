import { execFile } from 'node:child_process';
import {
  cpSync,
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  rmSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import path from 'node:path';
import { promisify } from 'node:util';
import {
  PROJECT_MANIFEST_FILENAME,
  PROJECT_MANIFEST_SCHEMA_VERSION,
  projectManifest,
  RpcError,
  RpcErrorCode,
  uuidv7,
  type ProjectCloneInput,
  type ProjectCreateInput,
  type ProjectManifest,
  type ProjectSummary,
} from '@gamecrafter/contracts';
import type { ProfileStore } from '../profile/profile-store';
import { projectMigrations } from './migrations';
import { Database } from '../db/database';
import { migrate } from '../db/migrator';
import { reidentifyProjectDatabase } from './reidentify';

const execFileAsync = promisify(execFile);

export interface GitRunner {
  run(args: string[], cwd: string): Promise<{ stdout: string }>;
}

const defaultGitRunner: GitRunner = {
  async run(args, cwd) {
    const { stdout } = await execFileAsync('git', args, { cwd, encoding: 'utf8' });
    return { stdout };
  },
};

export interface ProjectWorkspaceOptions {
  profile: ProfileStore;
  platformVersion: string;
  git?: GitRunner;
  now?: () => Date;
}

export function renderProjectAgentsMd(manifest: ProjectManifest): string {
  return `# PlayWeld Project Instructions

## What this Project is

${manifest.name}${manifest.description ? ` — ${manifest.description}` : ''}

## Engine

Engine family is locked to **${manifest.engine.family}**${
    manifest.engine.preferredVersion ? ` (${manifest.engine.preferredVersion})` : ''
  }.
Do not change \x60engine.family\x60 in \x60gamecrafter.project.json\x60.

## Canon and records

The authoritative design and canon records live in \x60docs/\x60. Keep them reviewable Markdown.

## Engine files

Engine project files live in \x60game/\x60.

## Platform state

\x60.gamecrafter/\x60 holds Project-local operational state. \x60.gamecrafter/project.sqlite\x60 is not committed. The \x60cache/\x60 and \x60logs/\x60 directories are disposable.
`;
}

export function summaryFromManifest(
  manifest: ProjectManifest,
  projectPath: string,
  lastOpenedAt: string | null,
  trusted = false,
): ProjectSummary {
  return {
    projectId: manifest.projectId,
    name: manifest.name,
    description: manifest.description,
    engine: manifest.engine,
    genres: manifest.genres,
    modules: manifest.modules,
    path: projectPath,
    trusted,
    createdAt: manifest.createdAt,
    lastOpenedAt,
  };
}

export class ProjectWorkspace {
  private readonly git: GitRunner;
  private readonly now: () => Date;

  constructor(private readonly options: ProjectWorkspaceOptions) {
    this.git = options.git ?? defaultGitRunner;
    this.now = options.now ?? (() => new Date());
  }

  async create(input: ProjectCreateInput): Promise<ProjectSummary> {
    const folderName = input.folderName ?? slug(input.name);
    const projectPath = path.resolve(input.parentDirectory, folderName);
    const created = !existsSync(projectPath);
    if (!created) {
      const stats = statSync(projectPath);
      if (!stats.isDirectory() || readdirSync(projectPath).length > 0) {
        throw new RpcError(
          `Project folder already exists and is not empty: ${projectPath}`,
          RpcErrorCode.ProjectAlreadyExists,
        );
      }
    }
    mkdirSync(projectPath, { recursive: true });

    try {
      const createdAt = this.now().toISOString();
      const manifest = projectManifest.assert({
        schemaVersion: PROJECT_MANIFEST_SCHEMA_VERSION,
        projectId: uuidv7(),
        name: input.name,
        description: input.description ?? '',
        engine: input.engine,
        genres: input.genres ?? [],
        modules: input.modules ?? [],
        createdAt,
        createdByPlatformVersion: this.options.platformVersion,
      });
      writeFileSync(
        path.join(projectPath, PROJECT_MANIFEST_FILENAME),
        `${JSON.stringify(manifest, null, 2)}\n`,
        'utf8',
      );
      writeFileSync(
        path.join(projectPath, '.gitignore'),
        '.gamecrafter/cache/\n.gamecrafter/logs/\n.gamecrafter/engine-runs/\n.gamecrafter/worktrees/\n.gamecrafter/agent-memory/\n.gamecrafter/vectors.lancedb/\n.gamecrafter/qdrant/\n.gamecrafter/*.sqlite\n*.sqlite-wal\n*.sqlite-shm\n*.sqlite-journal\n',
        'utf8',
      );
      mkdirSync(path.join(projectPath, 'docs'), { recursive: true });
      writeFileSync(
        path.join(projectPath, 'docs', 'README.md'),
        `Design and canon records for ${manifest.name}. Markdown here is the authoritative design record; see AGENTS.md.\n`,
        'utf8',
      );
      mkdirSync(path.join(projectPath, 'game'), { recursive: true });
      writeFileSync(path.join(projectPath, 'game', '.gitkeep'), '', 'utf8');
      mkdirSync(path.join(projectPath, '.gamecrafter'), { recursive: true });
      for (const directory of ['logs', 'cache']) {
        const fullPath = path.join(projectPath, '.gamecrafter', directory);
        mkdirSync(fullPath, { recursive: true });
        writeFileSync(path.join(fullPath, '.gitkeep'), '', 'utf8');
      }
      mkdirSync(path.join(projectPath, '.agents', 'skills'), { recursive: true });
      writeFileSync(path.join(projectPath, '.agents', 'skills', '.gitkeep'), '', 'utf8');
      writeFileSync(path.join(projectPath, 'AGENTS.md'), renderProjectAgentsMd(manifest), 'utf8');

      const projectDatabasePath = path.join(projectPath, '.gamecrafter', 'project.sqlite');
      const database = Database.open(projectDatabasePath);
      try {
        migrate(database, projectMigrations);
        database
          .prepare('INSERT INTO project_meta (key, value) VALUES (?, ?)')
          .run('project_id', manifest.projectId);
        database
          .prepare('INSERT INTO project_meta (key, value) VALUES (?, ?)')
          .run('schema_version', String(PROJECT_MANIFEST_SCHEMA_VERSION));

        await this.git.run(['init', '-b', 'main'], projectPath);
        await this.git.run(['add', '-A'], projectPath);
        await this.git.run(
          [
            '-c',
            'user.name=PlayWeld',
            '-c',
            'user.email=gamecrafter@localhost',
            'commit',
            '-m',
            'Initialize PlayWeld Project',
          ],
          projectPath,
        );

        database
          .prepare(
            `INSERT INTO events (event_id, seq, kind, occurred_at, actor, payload)
             VALUES (?, (SELECT COALESCE(MAX(seq), 0) + 1 FROM events), ?, ?, ?, ?)`,
          )
          .run(
            uuidv7(),
            'project.created',
            createdAt,
            'service',
            JSON.stringify({ projectId: manifest.projectId, path: projectPath }),
          );
      } finally {
        database.close();
      }

      const summary = summaryFromManifest(manifest, projectPath, null, true);
      this.options.profile.register(summary);
      return summary;
    } catch (error) {
      if (created) rmSync(projectPath, { recursive: true, force: true });
      throw error;
    }
  }

  async clone(input: ProjectCloneInput): Promise<ProjectSummary> {
    const source = this.get(input.projectId);
    const folderName = input.folderName ?? slug(input.name);
    const projectPath = path.resolve(input.parentDirectory, folderName);
    const relativeToSource = path.relative(source.path, projectPath);
    if (
      relativeToSource === '' ||
      (!relativeToSource.startsWith(`..${path.sep}`) &&
        relativeToSource !== '..' &&
        !path.isAbsolute(relativeToSource))
    ) {
      throw new RpcError(
        'A clone must be outside the source Project folder.',
        RpcErrorCode.InvalidParams,
      );
    }
    const created = !existsSync(projectPath);
    if (!created) {
      const stats = statSync(projectPath);
      if (!stats.isDirectory() || readdirSync(projectPath).length > 0) {
        throw new RpcError(
          `Project folder already exists and is not empty: ${projectPath}`,
          RpcErrorCode.ProjectAlreadyExists,
        );
      }
    }
    mkdirSync(projectPath, { recursive: true });

    try {
      const sourceDatabasePath = path.join(source.path, '.gamecrafter', 'project.sqlite');

      cpSync(source.path, projectPath, {
        recursive: true,
        filter: (sourceEntry) => {
          const relative = path.relative(source.path, sourceEntry).split(path.sep).join('/');
          if (
            relative === '.gamecrafter/worktrees' ||
            relative.startsWith('.gamecrafter/worktrees/') ||
            relative === '.git/worktrees' ||
            relative.startsWith('.git/worktrees/') ||
            relative === '.gamecrafter/cache' ||
            relative.startsWith('.gamecrafter/cache/') ||
            relative === '.gamecrafter/vectors.lancedb' ||
            relative.startsWith('.gamecrafter/vectors.lancedb/') ||
            relative === '.gamecrafter/qdrant' ||
            relative.startsWith('.gamecrafter/qdrant/') ||
            relative === '.gamecrafter/vectors.sqlite' ||
            relative === '.gamecrafter/logs' ||
            relative.startsWith('.gamecrafter/logs/')
          ) {
            return false;
          }
          if (relative === '.gamecrafter/project.sqlite') return false;
          const name = path.basename(sourceEntry);
          return !['-wal', '-shm', '-journal'].some((suffix) => name.endsWith(suffix));
        },
      });

      if (existsSync(sourceDatabasePath)) {
        const sourceDatabase = Database.open(sourceDatabasePath);
        try {
          sourceDatabase.snapshotTo(path.join(projectPath, '.gamecrafter', 'project.sqlite'));
        } finally {
          sourceDatabase.close();
        }
      }

      const sourceManifest = this.readManifest(source.path);
      const manifest = projectManifest.assert({
        ...sourceManifest,
        projectId: uuidv7(),
        name: input.name,
        createdAt: this.now().toISOString(),
        createdByPlatformVersion: this.options.platformVersion,
      });
      writeFileSync(
        path.join(projectPath, PROJECT_MANIFEST_FILENAME),
        `${JSON.stringify(manifest, null, 2)}\n`,
        'utf8',
      );
      writeFileSync(path.join(projectPath, 'AGENTS.md'), renderProjectAgentsMd(manifest), 'utf8');
      ensureProjectOperationalGitignore(projectPath);
      for (const directory of ['logs', 'cache']) {
        const fullPath = path.join(projectPath, '.gamecrafter', directory);
        mkdirSync(fullPath, { recursive: true });
        writeFileSync(path.join(fullPath, '.gitkeep'), '', 'utf8');
      }

      const database = Database.open(path.join(projectPath, '.gamecrafter', 'project.sqlite'));
      try {
        migrate(database, projectMigrations);
        reidentifyProjectDatabase(database, source.projectId, manifest.projectId, this.now);
        database
          .prepare(
            `INSERT INTO project_meta (key, value) VALUES (?, ?)
             ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
          )
          .run('project_id', manifest.projectId);
        database
          .prepare(
            `INSERT INTO project_meta (key, value) VALUES (?, ?)
             ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
          )
          .run('cloned_from', source.projectId);

        if (!existsSync(path.join(projectPath, '.git'))) {
          await this.git.run(['init', '-b', 'main'], projectPath);
        } else {
          const remotes = (await this.git.run(['remote'], projectPath)).stdout
            .split(/\r?\n/)
            .filter((remote) => remote.length > 0);
          for (const remote of remotes) {
            await this.git.run(['remote', 'remove', remote], projectPath);
          }
        }
        await this.git.run(['add', '-A'], projectPath);
        await this.git.run(
          [
            '-c',
            'user.name=PlayWeld',
            '-c',
            'user.email=gamecrafter@localhost',
            'commit',
            '-m',
            `Clone Project from "${source.name}"`,
          ],
          projectPath,
        );
        database
          .prepare(
            `INSERT INTO events (event_id, seq, kind, occurred_at, actor, payload)
             VALUES (?, (SELECT COALESCE(MAX(seq), 0) + 1 FROM events), ?, ?, ?, ?)`,
          )
          .run(
            uuidv7(),
            'project.cloned',
            manifest.createdAt,
            'service',
            JSON.stringify({ sourceProjectId: source.projectId, sourcePath: source.path }),
          );
      } finally {
        database.close();
      }

      const summary = summaryFromManifest(manifest, projectPath, null, true);
      this.options.profile.register(summary);
      return summary;
    } catch (error) {
      if (created) rmSync(projectPath, { recursive: true, force: true });
      throw error;
    }
  }

  open(projectPath: string): ProjectSummary {
    const absolutePath = path.resolve(projectPath);
    const manifest = this.readManifest(absolutePath);
    ensureProjectOperationalGitignore(absolutePath);
    const previous = this.options.profile.getById(manifest.projectId);
    const unopened = summaryFromManifest(
      manifest,
      absolutePath,
      previous?.lastOpenedAt ?? null,
      previous?.trusted ?? false,
    );
    this.options.profile.register(unopened);
    const lastOpenedAt = this.now().toISOString();
    this.options.profile.touchOpened(manifest.projectId, lastOpenedAt);
    return { ...unopened, lastOpenedAt };
  }

  get(projectId: string): ProjectSummary {
    const record = this.options.profile.getById(projectId);
    if (
      !record ||
      !existsSync(record.path) ||
      !existsSync(path.join(record.path, PROJECT_MANIFEST_FILENAME))
    ) {
      throw new RpcError(`Project not found: ${projectId}`, RpcErrorCode.ProjectNotFound);
    }
    try {
      return summaryFromManifest(
        this.readManifest(record.path),
        record.path,
        record.lastOpenedAt,
        record.trusted,
      );
    } catch {
      throw new RpcError(`Project not found: ${projectId}`, RpcErrorCode.ProjectNotFound);
    }
  }

  list(): ProjectSummary[] {
    const summaries: ProjectSummary[] = [];
    for (const record of this.options.profile.list()) {
      if (!existsSync(path.join(record.path, PROJECT_MANIFEST_FILENAME))) continue;
      try {
        summaries.push(
          summaryFromManifest(
            this.readManifest(record.path),
            record.path,
            record.lastOpenedAt,
            record.trusted,
          ),
        );
      } catch {
        continue;
      }
    }
    return summaries;
  }

  trust(projectId: string, trusted: boolean): ProjectSummary {
    if (!this.options.profile.getById(projectId)) {
      throw new RpcError(`Project not found: ${projectId}`, RpcErrorCode.ProjectNotFound);
    }
    this.options.profile.setTrusted(projectId, trusted);
    return this.get(projectId);
  }

  private readManifest(projectPath: string): ProjectManifest {
    try {
      const content = readFileSync(path.join(projectPath, PROJECT_MANIFEST_FILENAME), 'utf8');
      return projectManifest.assert(JSON.parse(content));
    } catch (error) {
      throw new RpcError(
        `Invalid Project folder at ${projectPath}: ${error instanceof Error ? error.message : String(error)}`,
        RpcErrorCode.InvalidProjectFolder,
      );
    }
  }
}

function ensureProjectOperationalGitignore(projectPath: string): void {
  const gitignorePath = path.join(projectPath, '.gitignore');
  const content = existsSync(gitignorePath) ? readFileSync(gitignorePath, 'utf8') : '';
  const lines = new Set(content.split(/\r?\n/));
  const required = [
    '.gamecrafter/cache/',
    '.gamecrafter/logs/',
    '.gamecrafter/engine-runs/',
    '.gamecrafter/worktrees/',
    '.gamecrafter/agent-memory/',
    '.gamecrafter/vectors.lancedb/',
    '.gamecrafter/qdrant/',
    '.gamecrafter/*.sqlite',
    '*.sqlite-wal',
    '*.sqlite-shm',
    '*.sqlite-journal',
  ];
  const missing = required.filter((line) => !lines.has(line));
  if (missing.length > 0) {
    const separator = content.length > 0 && !content.endsWith('\n') ? '\n' : '';
    writeFileSync(gitignorePath, `${content}${separator}${missing.join('\n')}\n`, 'utf8');
  }
}

function slug(name: string): string {
  return (
    name
      .toLowerCase()
      .replace(/[^a-z0-9-]/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '') || 'project'
  );
}

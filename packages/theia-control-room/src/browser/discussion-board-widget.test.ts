import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import type { BoardThread, ProjectSummary } from '@gamecrafter/contracts';

vi.mock('@theia/core/shared/inversify', () => ({
  injectable: () => () => {},
  inject: () => () => {},
}));
vi.mock('@theia/core/lib/browser/widgets/widget', () => ({ Message: class {} }));
vi.mock('./control-room-react-widget', () => ({ ControlRoomReactWidget: class {} }));
vi.mock('./control-room-client', () => ({ ControlRoomClientEvents: class {} }));

import { DiscussionBoardWidget } from './discussion-board-widget';

function thread(overrides: Partial<BoardThread> = {}): BoardThread {
  return {
    threadId: 'thread-1',
    title: 'Answer the level-design question',
    kind: 'question',
    status: 'open',
    tags: ['level-design', 'urgent'],
    messageCount: 3,
    ...overrides,
  } as BoardThread;
}

function widget(overrides: Record<string, unknown> = {}) {
  return Object.assign(Object.create(DiscussionBoardWidget.prototype), {
    projects: [{ projectId: 'project-1', name: 'Project One' }] as ProjectSummary[],
    projectId: 'project-1',
    threads: [thread()],
    threadDetail: undefined,
    decisions: [],
    maintenance: {
      lastAuditAt: null,
      lastCleanupAt: null,
      nextAuditAt: null,
      pendingDecisions: 0,
      runningTaskId: null,
    },
    statusFilter: '',
    kindFilter: '',
    tagsFilter: '',
    search: '',
    createThreadExpanded: false,
    maintenanceExpanded: false,
    busy: false,
    update: vi.fn(),
    markProjectSelection: vi.fn(),
    ...overrides,
  }) as DiscussionBoardWidget & { render(): React.ReactNode };
}

describe('Discussion Board navigation', () => {
  it('renders quick views, compact thread hierarchy, and collapsed secondary panels', () => {
    const view = widget();
    const html = renderToStaticMarkup(React.createElement('div', {}, view.render()));

    for (const label of ['All', 'Open', 'Questions', 'Blockers', 'Decisions', 'Clear filters']) {
      expect(html).toContain(label);
    }
    expect(html).toContain('gamecrafter-board-thread-item');
    expect(html).toContain('gamecrafter-board-thread-kind is-question');
    expect(html).toContain('gamecrafter-board-thread-status is-open');
    expect(html).toContain('gamecrafter-board-thread-tags');
    expect(html).toContain('<summary>New thread</summary>');
    expect(html).toContain('Maintenance · 0 pending decisions');
    expect(html).toContain('Start with Open for active work');
    const emptyHtml = renderToStaticMarkup(
      React.createElement('div', {}, widget({ threads: [] }).render()),
    );
    expect(emptyHtml).toContain('Clear filters or switch to a quick view');
  });

  it('keeps browse filters when refreshing Project state', async () => {
    const listBoardThreads = vi.fn(async () => ({ threads: [] }));
    const view = widget({
      statusFilter: 'open',
      kindFilter: 'question',
      tagsFilter: 'level-design, urgent',
      search: 'lighting',
      service: {
        getAllSettings: async () => [],
        listBoardThreads,
        getBoardMaintenanceStatus: async () => ({
          lastAuditAt: null,
          lastCleanupAt: null,
          nextAuditAt: null,
          pendingDecisions: 0,
          runningTaskId: null,
        }),
      },
    });
    const refreshProjectState = (
      view as unknown as { refreshProjectState(): Promise<void> }
    ).refreshProjectState.bind(view);

    await refreshProjectState();

    expect(listBoardThreads).toHaveBeenCalledWith({
      projectId: 'project-1',
      status: 'open',
      kind: 'question',
      tags: ['level-design', 'urgent'],
      search: 'lighting',
    });
  });

  it('switches Project and reveals a request thread independently of prior filters', async () => {
    const requestedThread = thread({ threadId: 'request-thread', title: 'Request discussion' });
    const listBoardThreads = vi.fn(async () => ({ threads: [requestedThread] }));
    const getBoardThread = vi.fn(async () => ({ thread: requestedThread, messages: [] }));
    const view = widget({
      projects: [{ projectId: 'project-2', name: 'Project Two' }] as ProjectSummary[],
      statusFilter: 'archived',
      kindFilter: 'blocker',
      tagsFilter: 'old-tag',
      search: 'old search',
      service: {
        listProjects: async () => [{ projectId: 'project-2', name: 'Project Two' }],
        getAllSettings: async () => [],
        listBoardThreads,
        getBoardMaintenanceStatus: async () => ({
          lastAuditAt: null,
          lastCleanupAt: null,
          nextAuditAt: null,
          pendingDecisions: 0,
          runningTaskId: null,
        }),
        getBoardThread,
        listBoardDecisions: async () => ({ decisions: [] }),
      },
    });

    await view.revealThread({ projectId: 'project-2', threadId: 'request-thread' });

    const state = view as unknown as {
      projectId: string;
      statusFilter: string;
      kindFilter: string;
      tagsFilter: string;
      search: string;
      threadDetail?: { thread: BoardThread };
    };
    expect(state.projectId).toBe('project-2');
    expect(state.statusFilter).toBe('');
    expect(state.kindFilter).toBe('');
    expect(state.tagsFilter).toBe('');
    expect(state.search).toBe('');
    expect(listBoardThreads).toHaveBeenCalledWith({
      projectId: 'project-2',
      status: undefined,
      kind: undefined,
      tags: [],
      search: undefined,
    });
    expect(getBoardThread).toHaveBeenLastCalledWith({
      projectId: 'project-2',
      threadId: 'request-thread',
      includeMessages: true,
      limit: 500,
    });
    expect(state.threadDetail?.thread.threadId).toBe('request-thread');
  });
});

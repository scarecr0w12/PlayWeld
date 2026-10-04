import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import type { TaskRecord } from '@gamecrafter/contracts';
import { buildTaskTree, type SwarmTaskNode } from '../common/swarm-view-model';

vi.mock('@theia/core/shared/inversify', () => ({
  injectable: () => () => {},
  inject: () => () => {},
}));
vi.mock('@theia/core/lib/common/command', () => ({ CommandService: Symbol('commands') }));
vi.mock('@theia/core/lib/browser/widgets/widget', () => ({ Message: class {} }));
vi.mock('./control-room-react-widget', () => ({ ControlRoomReactWidget: class {} }));
vi.mock('./control-room-client', () => ({ ControlRoomClientEvents: class {} }));
vi.mock('./discussion-board-view-contribution', () => ({
  DISCUSSION_BOARD_OPEN_COMMAND_ID: 'board',
}));
import { SwarmWidget } from './swarm-widget';

describe('Swarm task rendering', () => {
  it('refreshes pending approvals even when the resource-lock panel fails', async () => {
    const approvals = [{ approvalId: 'next-approval' }];
    const widget = Object.assign(Object.create(SwarmWidget.prototype), {
      projectId: 'project',
      busy: false,
      refreshPending: false,
      approvals: [],
      update: vi.fn(),
      service: {
        listChangeRequests: async () => [],
        listResourceLocks: async () => {
          throw new Error('Invalid result for change/locks');
        },
        listIntegrations: async () => [],
        listTaskQuestions: async () => [],
        listApprovals: async () => approvals,
      },
    });
    await widget.refresh();
    expect(widget.approvals).toEqual(approvals);
    expect(widget.errorMessage).toContain('change/locks');
  });

  it('shows a failed task error without calling its progress pending', () => {
    const task = {
      taskId: 'root',
      state: 'failed',
      title: 'Coordinator',
      goal: 'Write canon',
      spent: { costUsd: 0, tokens: 0 },
      error: { message: 'Model approval rejected', code: '-32031' },
      createdAt: '2026-10-01',
      parentTaskId: null,
    } as TaskRecord;
    const node = buildTaskTree([task], task.taskId)!;
    const widget = Object.create(SwarmWidget.prototype) as {
      renderTaskDetails(node: SwarmTaskNode): React.ReactNode;
    };
    const html = renderToStaticMarkup(widget.renderTaskDetails(node));
    expect(html).toContain('Model approval rejected');
    expect(html).toContain('role="alert"');
    expect(html).not.toContain('pending');
  });
  it('shows successful summaries and artifact paths for review', () => {
    const task = {
      taskId: 'root',
      state: 'succeeded',
      title: 'Coordinator',
      goal: 'Write canon',
      spent: { costUsd: 0, tokens: 0 },
      result: {
        summary: 'Canon draft ready',
        reviewStatus: 'accepted',
        artifacts: [{ kind: 'file', path: 'docs/canon.md' }],
      },
      createdAt: '2026-10-01',
      parentTaskId: null,
    } as TaskRecord;
    const node = buildTaskTree([task], task.taskId)!;
    const widget = Object.create(SwarmWidget.prototype) as {
      renderTaskDetails(node: SwarmTaskNode): React.ReactNode;
    };
    const html = renderToStaticMarkup(widget.renderTaskDetails(node));
    expect(html).toContain('Canon draft ready');
    expect(html).toContain('docs/canon.md');
  });

  it('renders a compact collapsible hierarchy without every goal and result', () => {
    const root = {
      taskId: 'root',
      state: 'running',
      title: 'Coordinator',
      goal: 'Long coordinator goal',
      role: 'coordinator',
      spent: { costUsd: 0, tokens: 0 },
      createdAt: '2026-10-01',
      parentTaskId: null,
    } as TaskRecord;
    const child = {
      ...root,
      taskId: 'child',
      parentTaskId: 'root',
      title: 'Gameplay agent',
      goal: 'Long child goal',
    };
    const node = buildTaskTree([root, child], 'root')!;
    const widget = Object.assign(Object.create(SwarmWidget.prototype), {
      taskTree: node,
      collapsedTasks: new Set<string>(),
    });
    let html = renderToStaticMarkup(React.createElement('ul', {}, widget.renderTaskNode(node)));
    expect(html).toContain('Gameplay agent');
    expect(html).toContain('aria-expanded="true"');
    expect(html).toContain('aria-current="true"');
    expect(html).not.toContain('Long coordinator goal');
    expect(html).not.toContain('Long child goal');
    widget.collapsedTasks.add('root');
    html = renderToStaticMarkup(React.createElement('ul', {}, widget.renderTaskNode(node)));
    expect(html).toContain('aria-expanded="false"');
    expect(html).not.toContain('Gameplay agent');
  });

  it('reveals the ancestors of a task selected from a next-action shortcut', () => {
    const root = {
      taskId: 'root',
      title: 'Root',
      state: 'running',
      createdAt: '2026-10-01',
      parentTaskId: null,
    } as TaskRecord;
    const child = { ...root, taskId: 'child', parentTaskId: 'root' };
    const widget = Object.assign(Object.create(SwarmWidget.prototype), {
      taskTree: buildTaskTree([root, child], 'root'),
      collapsedTasks: new Set(['root']),
      activeSection: 'integrations',
      update: vi.fn(),
    });
    widget.selectTask('child');
    expect(widget.highlightedTaskId).toBe('child');
    expect(widget.activeSection).toBe('agents');
    expect(widget.collapsedTasks.has('root')).toBe(false);
    expect(widget.update).toHaveBeenCalled();
  });
});

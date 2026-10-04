import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import type { TaskRecord } from '@gamecrafter/contracts';
import { buildTaskTree, taskDisplayTitle, type SwarmTaskNode } from '../common/swarm-view-model';

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
  it('uses a concise heading for automatically generated Markdown titles without changing the goal', () => {
    const task = {
      title: '## Acceptance criteria / **Preserve saves** / `player.gd`',
      goal: '## Acceptance criteria\n\n- **Preserve saves**\n- Review `player.gd`',
    };
    expect(taskDisplayTitle(task)).toBe('Acceptance criteria');
    expect(task.goal).toContain('**Preserve saves**');
    expect(taskDisplayTitle({ title: 'Review gameplay', goal: 'Unrelated details' })).toBe(
      'Review gameplay',
    );
  });
  it('formats task goals and results as headings, lists and code instead of a flat paragraph', () => {
    const task = {
      taskId: 'root',
      state: 'succeeded',
      title: 'Review gameplay',
      goal: '## Acceptance criteria\n\n- **Preserve saves**\n- Review `player.ts`\n\n```ts\nconst ready = true;\n```',
      spent: { costUsd: 0.0012, tokens: 50 },
      createdAt: '2026-10-04',
      parentTaskId: null,
      result: {
        summary: '## Result\n\n1. Verified saves\n2. Checked movement',
        artifacts: [],
        reviewStatus: 'accepted',
      },
    } as unknown as TaskRecord;
    const node = buildTaskTree([task], task.taskId)!;
    const widget = Object.create(SwarmWidget.prototype) as {
      renderTaskDetails(node: SwarmTaskNode): React.ReactNode;
    };
    const html = renderToStaticMarkup(widget.renderTaskDetails(node));
    expect(html).toContain('<h2>Acceptance criteria</h2>');
    expect(html).toContain('<strong>Preserve saves</strong>');
    expect(html).toContain('<code>player.ts</code>');
    expect(html).toContain('<pre>');
    expect(html).toContain('<h2>Result</h2>');
    expect(html).toContain('<ol>');
  });

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

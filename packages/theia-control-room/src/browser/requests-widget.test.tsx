import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { expect, it, vi } from 'vitest';
vi.mock('@theia/core/shared/inversify', () => ({
  inject: () => () => {},
  injectable: () => () => {},
}));
vi.mock('./control-room-react-widget', () => ({ ControlRoomReactWidget: class {} }));
vi.mock('@theia/core/lib/common/message-service', () => ({ MessageService: class {} }));
vi.mock('@theia/core/lib/common/command', () => ({ CommandService: class {} }));
vi.mock('./control-room-client', () => ({ ControlRoomClientEvents: class {} }));
import { RequestsWidget } from './requests-widget';
import { requestKey } from './requests-model';
import type { PendingInput } from '@gamecrafter/contracts';

const context = {
  projectId: 'project',
  projectName: 'Lantern Workshop',
  taskId: 'task',
  taskTitle: 'Build scene',
  rootTaskId: 'root',
  rootTaskTitle: 'Create game',
};
function widget(inputs: PendingInput[]) {
  return Object.assign(Object.create(RequestsWidget.prototype), {
    projectId: '',
    selected: inputs[0] ? requestKey(inputs[0]) : undefined,
    drafts: new Map(),
    model: {
      snapshot: { schemaVersion: 1, inputs, unavailableProjects: [] },
      available: true,
      loading: false,
      busy: new Set(),
    },
  });
}
it('groups requests with explicit per-call actions and no bulk approval', () => {
  const view = widget([
    {
      ...context,
      kind: 'approval',
      approval: {
        approvalId: 'approval',
        projectId: 'project',
        callId: 'call',
        toolId: 'fs.write',
        sideEffects: 'workspace-write',
        summary: 'Write file',
        input: { path: 'game/file.txt' },
        requestedAt: '2026-10-24T00:00:00Z',
        resolvedAt: null,
        approved: null,
        reason: null,
      },
    },
  ]);
  const html = renderToStaticMarkup(React.createElement(view.render.bind(view)));
  expect(html).toContain('Lantern Workshop');
  expect(html).toContain('Create game');
  expect(html).toContain('Approve this request');
  expect(html).toContain('workspace-write');
  expect(html).not.toContain('Approve all');
  view.model.snapshot.inputs.push({
    ...view.model.snapshot.inputs[0],
    projectId: 'other-project',
    projectName: 'Other Project',
  });
  view.projectId = 'project';
  const filtered = renderToStaticMarkup(React.createElement(view.render.bind(view)));
  expect(filtered).toContain('1 shown');
  expect(filtered).toContain('2 pending total');
  view.selected = 'resolved-request';
  expect(renderToStaticMarkup(React.createElement(view.render.bind(view)))).not.toContain(
    'Approve this request',
  );
});
it('renders free-text questions as escaped text and disables stale snapshot actions', () => {
  const item: PendingInput = {
    ...context,
    kind: 'question',
    question: {
      questionId: 'question',
      taskId: 'task',
      prompt: 'Choose <script>bad</script>',
      options: null,
      askedAt: '2026-10-24T00:00:00Z',
      answer: null,
      answeredAt: null,
    },
  };
  const view = widget([item]);
  view.selected = requestKey(item);
  view.model.available = false;
  const html = renderToStaticMarkup(React.createElement(view.render.bind(view)));
  expect(html).toContain('&lt;script&gt;bad&lt;/script&gt;');
  expect(html).toContain('<textarea');
  expect(html).toContain('disabled=""');
  expect(html).toContain('Send answer');
  view.model.available = true;
  view.model.loading = true;
  view.drafts.set(requestKey(item), 'A long draft');
  const refreshing = renderToStaticMarkup(React.createElement(view.render.bind(view)));
  expect(refreshing.match(/<textarea[^>]*>/)?.[0]).not.toContain('disabled');
  expect(refreshing).toMatch(/<button[^>]*disabled=""[^>]*>Send answer/);
});

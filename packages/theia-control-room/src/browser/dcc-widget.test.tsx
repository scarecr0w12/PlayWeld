import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

vi.mock('@theia/core/shared/inversify', () => ({
  injectable: () => () => {},
  inject: () => () => {},
}));
vi.mock('@theia/core/lib/browser/widgets/widget', () => ({ Message: class {} }));
vi.mock('./control-room-react-widget', () => ({ ControlRoomReactWidget: class {} }));
vi.mock('./control-room-client', () => ({ ControlRoomClientEvents: class {} }));

import { DccWidget } from './dcc-widget';

function widget(overrides: Record<string, unknown> = {}) {
  return Object.assign(Object.create(DccWidget.prototype), {
    projects: [{ projectId: 'project-1', name: 'Project One' }],
    selectedProjectId: 'project-1',
    tool: 'blender',
    installations: [],
    report: undefined,
    runs: [],
    selectedRun: undefined,
    artifactContents: new Map(),
    selectedOperation: 'discover',
    activeSection: 'capabilities',
    params: {},
    installationPath: '',
    installationKind: 'gui',
    connections: [],
    selectedBridgeId: '',
    preview: undefined,
    busy: false,
    errorMessage: undefined,
    resultMessage: undefined,
    update: vi.fn(),
    markProjectSelection: vi.fn(),
    ...overrides,
  }) as DccWidget & { render(): React.ReactNode };
}

describe('DCC workspace navigation', () => {
  it('opens the selected run after submitting an operation', async () => {
    const run = { runId: 'run-1' };
    const view = widget({
      activeSection: 'operation',
      service: { runDcc: vi.fn(async () => run) },
    }) as unknown as {
      activeSection: string;
      selectedRun: unknown;
      runOperation(): Promise<void>;
    };
    await view.runOperation();
    expect(view.activeSection).toBe('runs');
    expect(view.selectedRun).toBe(run);
  });

  it('groups DCC functions into state-preserving views with guidance and empty states', () => {
    const html = renderToStaticMarkup(React.createElement('div', {}, widget().render()));

    expect(html).toContain('gamecrafter-work-guidance');
    expect(html).toContain('Register a blender executable');
    expect(html).toContain('gamecrafter-section-nav');
    expect(html).toContain('Capabilities');
    expect(html).toContain('Installations');
    expect(html).toContain('Live bridge');
    expect(html).toContain('Run operation');
    expect(html).toContain('Runs');
    expect(html).toContain(
      'hidden=""><section class="gamecrafter-dcc-section gamecrafter-page-panel"><h2>Installations',
    );
    expect(html).toContain('No DCC runs yet');
    expect(html).toContain('Register a manual installation');
  });

  it('keeps safety notices and visible field names in the operation view', () => {
    const view = widget({ selectedOperation: 'run-script', activeSection: 'operation' });
    const renderOperationRunner = (
      view as unknown as { renderOperationRunner(): React.ReactNode }
    ).renderOperationRunner.bind(view);
    const scriptHtml = renderToStaticMarkup(
      React.createElement('div', {}, renderOperationRunner()),
    );
    (view as unknown as { selectedOperation: string }).selectedOperation = 'export';
    const exportHtml = renderToStaticMarkup(
      React.createElement('div', {}, renderOperationRunner()),
    );

    expect(scriptHtml).toContain('Python code');
    expect(exportHtml).toContain('Output');
    expect(exportHtml).toContain('Project-relative path');
    expect(scriptHtml).toContain('Code execution is classified destructive');
  });
});

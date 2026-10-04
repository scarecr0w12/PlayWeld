import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import type { EngineCapabilityReport, EngineFamily, EngineOperation } from '@gamecrafter/contracts';

vi.mock('@theia/core/shared/inversify', () => ({
  injectable: () => () => {},
  inject: () => () => {},
}));
vi.mock('@theia/core/lib/browser/widgets/widget', () => ({ Message: class {} }));
vi.mock('./control-room-react-widget', () => ({ ControlRoomReactWidget: class {} }));
vi.mock('./control-room-client', () => ({ ControlRoomClientEvents: class {} }));

import { EngineWidget } from './engine-widget';

function widget(overrides: Record<string, unknown> = {}) {
  return Object.assign(Object.create(EngineWidget.prototype), {
    projects: [{ projectId: 'project-1', name: 'Project One', family: 'godot' as EngineFamily }],
    selectedProjectId: 'project-1',
    report: undefined,
    installations: [],
    liveConnections: [],
    selectedBridgeId: '',
    runs: [],
    selectedRun: undefined,
    selectedOperation: undefined,
    activeSection: 'capabilities',
    runParams: {},
    installationFamily: 'godot',
    installationKind: 'cli',
    executable: '',
    busy: false,
    errorMessage: undefined,
    resultMessage: undefined,
    logContents: new Map(),
    update: vi.fn(),
    markProjectSelection: vi.fn(),
    ...overrides,
  }) as EngineWidget & { render(): React.ReactNode };
}

describe('Engine workspace navigation', () => {
  it('opens run evidence after an operation completes without clearing its draft parameters', async () => {
    const run = { runId: 'run-1', status: 'succeeded', summary: 'Checked', artifacts: [] };
    const params = { test: { testPlatform: 'editor' } };
    const view = widget({
      activeSection: 'operations',
      runParams: params,
      service: { runEngine: vi.fn(async () => run) },
    }) as unknown as {
      activeSection: string;
      selectedRun: unknown;
      runParams: unknown;
      runOperation(operation: EngineOperation): Promise<void>;
    };
    await view.runOperation('test');
    expect(view.activeSection).toBe('runs');
    expect(view.selectedRun).toBe(run);
    expect(view.runParams).toBe(params);
  });

  it('shows next-step guidance and keeps each operational pane mounted but hidden when inactive', () => {
    const html = renderToStaticMarkup(React.createElement('div', {}, widget().render()));

    expect(html).toContain('gamecrafter-work-guidance');
    expect(html).toContain('Register a godot installation');
    expect(html).toContain('gamecrafter-section-nav');
    expect(html).toContain('Capabilities');
    expect(html).toContain('Installations');
    expect(html).toContain('Live bridge');
    expect(html).toContain('Operations');
    expect(html).toContain('Runs');
    expect(html).toContain(
      'hidden=""><section class="gamecrafter-engine-section gamecrafter-page-panel"><h2>Engine installations',
    );
    expect(html).toContain('No engine runs yet');
    expect(html).toContain('Register a manual installation');
  });

  it('renders capability metadata and readable labels for configured operation fields', () => {
    const report = {
      family: 'godot',
      layers: {
        'project-file': { status: 'ready', detail: 'project.godot found' },
        'headless-process': { status: 'ready', detail: 'CLI registered' },
        'live-editor': { status: 'unavailable', detail: 'No bridge bound' },
      },
      projectIdentity: { proven: true, evidence: [] },
      engineVersion: { detected: '4.4', preferred: null, matches: null },
      operations: [],
      liveBridge: null,
    } as unknown as EngineCapabilityReport;
    const view = widget({
      report,
      installations: [{ family: 'godot', source: 'manual' }],
      selectedOperation: 'test',
    });
    const renderReport = (
      view as unknown as {
        renderReport(report: EngineCapabilityReport): React.ReactNode;
      }
    ).renderReport.bind(view);
    const renderOperationFields = (
      view as unknown as {
        renderOperationFields(operation: EngineOperation): React.ReactNode;
      }
    ).renderOperationFields.bind(view);
    const capability = renderToStaticMarkup(React.createElement('div', {}, renderReport(report)));
    expect(capability).toContain('Detected version');
    expect(capability).toContain('Identity evidence (0)');
    const fields = renderToStaticMarkup(
      React.createElement('div', {}, renderOperationFields('test')),
    );
    expect(fields).toContain('Test Platform');
    expect(fields).toContain('Commandlet');
  });
});

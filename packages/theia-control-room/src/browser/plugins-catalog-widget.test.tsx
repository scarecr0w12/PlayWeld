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

import { PluginsCatalogWidget } from './plugins-catalog-widget';

function widget() {
  return Object.assign(Object.create(PluginsCatalogWidget.prototype), {
    projects: [],
    selectedProjectId: undefined,
    plugins: [],
    tools: [],
    modules: { modules: [], genres: [], conflicts: [] },
    isolationReport: undefined,
    selectedPluginId: undefined,
    selectedPanelId: undefined,
    panel: undefined,
    panelOutputs: new Map(),
    formValues: new Map(),
    logs: new Map(),
    source: '',
    inspection: undefined,
    capabilitiesAccepted: false,
    tab: 'platform',
    activeSection: 'plugins',
    secretName: '',
    secretValue: '',
    confirmUninstallPluginId: undefined,
    errorMessage: undefined,
    resultMessage: undefined,
    busy: false,
    commandService: { executeCommand: vi.fn() },
    update: vi.fn(),
  });
}

describe('Plugins catalog layout', () => {
  it('separates platform plugins and editor extensions with accessible tab state', () => {
    const view = widget();
    const html = renderToStaticMarkup(React.createElement(view.render.bind(view)));
    expect(html).toContain('aria-selected="true"');
    expect(html).toContain('id="gamecrafter-plugin-panel-editor"');
    expect(html).toContain('aria-label="Platform plugin sections"');
    expect(html).toContain('Review capabilities before installing');
    expect(html).toContain('No platform plugins are installed');
    expect(html).toContain('No modules or genres are contributed');
  });

  it('keeps source inspection and optional details in labelled sections', () => {
    const view = widget();
    view.activeSection = 'install';
    const html = renderToStaticMarkup(React.createElement(view.render.bind(view)));
    expect(html).toContain('aria-label="Plugin source"');
    expect(html).toContain('aria-pressed="true"');
    expect(html).toContain('Inspect source');
    expect(html).toContain('aria-controls="gamecrafter-plugins-details"');
  });
});

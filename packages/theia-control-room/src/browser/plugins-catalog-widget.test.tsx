import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';

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
  it('identifies an inspected installed plugin as an upgrade and exposes migration warnings', () => {
    const view = widget();
    view.activeSection = 'install';
    view.plugins = [
      {
        installed: {
          pluginId: 'fixture-plugin',
          version: '1.0.0',
          enabled: true,
          signature: { status: 'unsigned' },
          manifest: JSON.parse(
            readFileSync(
              path.resolve(__dirname, '../../../plugins/sample-hello/gamecrafter-plugin.json'),
              'utf8',
            ),
          ),
        },
        projectEnabled: false,
        worker: null,
      },
    ];
    view.inspection = {
      manifest: {
        id: 'fixture-plugin',
        name: 'Fixture',
        version: '2.0.0',
        publisher: { name: 'Fixture author' },
        migrations: [
          {
            from: '1.0.0',
            to: '2.0.0',
            description: 'Rename the greeting field',
            operations: [
              {
                kind: 'rename',
                from: 'plugin.fixture-plugin.old',
                to: 'plugin.fixture-plugin.new',
              },
            ],
          },
        ],
      },
      signature: { status: 'unsigned' },
      sha256: 'fixture',
      capabilities: [],
      warnings: ['Review the setting rename before upgrading.'],
    };
    const html = renderToStaticMarkup(React.createElement(view.render.bind(view)));
    expect(html).toContain('Accept capabilities and upgrade');
    expect(html).toContain('Review the setting rename before upgrading.');
    expect(html).toContain('Settings migration review');
    expect(html).toContain('Rename the greeting field');
    expect(html).toContain('plugin.fixture-plugin.old');
    expect(html).toContain('plugin.fixture-plugin.new');
  });

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

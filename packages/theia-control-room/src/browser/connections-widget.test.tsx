import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

vi.mock('@theia/core/shared/inversify', () => ({
  injectable: () => () => {},
  inject: () => () => {},
}));
vi.mock('@theia/core/lib/browser/widgets/widget', () => ({ Message: class {} }));
vi.mock('@theia/core/lib/common/quick-pick-service', () => ({
  QuickInputService: Symbol('quickInput'),
}));
vi.mock('./control-room-react-widget', () => ({ ControlRoomReactWidget: class {} }));
vi.mock('./control-room-client', () => ({ ControlRoomClientEvents: class {} }));

import { ConnectionsWidget } from './connections-widget';

function widget(overrides: Record<string, unknown> = {}) {
  return Object.assign(Object.create(ConnectionsWidget.prototype), {
    projects: [],
    selectedProjectId: undefined,
    connections: [],
    tools: new Map(),
    logs: new Map(),
    logConnectionId: undefined,
    activeSection: 'servers',
    errorMessage: undefined,
    resultMessage: undefined,
    connectionName: '',
    scope: 'platform',
    mode: 'command',
    tags: '',
    command: '',
    commandArgs: '',
    commandEnv: '{}',
    endpointUrl: '',
    endpointTransport: 'streamable-http',
    endpointHeaders: '{}',
    dockerImage: '',
    dockerCommand: '',
    dockerTransport: 'stdio',
    dockerPort: '',
    dockerMounts: '[]',
    dockerEnv: '{}',
    dockerNetwork: 'none',
    dockerPullPolicy: 'if-missing',
    allowServerInitiatedModelCalls: false,
    credentialsJson: '{}',
    busy: false,
    update: vi.fn(),
    markProjectSelection: vi.fn(),
    ...overrides,
  }) as ConnectionsWidget & { render(): React.ReactNode };
}

describe('Connections workspace navigation', () => {
  it('separates server management, tool safety, setup, and logs into navigable panes', () => {
    const html = renderToStaticMarkup(React.createElement('div', {}, widget().render()));

    expect(html).toContain('gamecrafter-work-guidance');
    expect(html).toContain('Add a trusted MCP server');
    expect(html).toContain('gamecrafter-section-nav');
    expect(html).toContain('Servers');
    expect(html).toContain('Tool safety');
    expect(html).toContain('Add connection');
    expect(html).toContain('Logs');
    expect(html).toContain('No MCP connections are configured for this scope');
    expect(html).toContain('No connection selected');
    expect(html).toContain(
      '<section class="gamecrafter-connections-section gamecrafter-page-panel" hidden=""><h2>Tool safety',
    );
  });

  it('collapses optional transport and credential fields without hiding safety consent', () => {
    const html = renderToStaticMarkup(React.createElement('div', {}, widget().render()));

    expect(html).toContain('Command arguments and environment');
    expect(html).toContain('Advanced metadata and credentials');
    expect(html).toContain('Credentials (JSON key/value pairs; encrypted by the platform service)');
    expect(html).toContain('Allow server-initiated model calls');
    expect(html).toContain('Keep this disabled unless required');
    expect(html).toContain('Connection name');
    expect(html).toContain('Connection command');
  });
});

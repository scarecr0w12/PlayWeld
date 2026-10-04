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
import { KnowledgeWidget } from './knowledge-widget';

function widget() {
  return Object.assign(Object.create(KnowledgeWidget.prototype), {
    projectId: 'project',
    vectorKind: 'qdrant',
    vectorDeployment: 'remote',
    allowRemoteVectorStore: true,
    vectorUrl: 'https://vectors.example.com',
    collectionPrefix: 'test',
    vectorTimeoutMs: 5000,
    apiKeyRef: '${cred:VECTOR}',
    models: [],
    accounts: [],
    modelId: '',
    providerAccountId: '',
    busy: false,
    update: vi.fn(),
    refreshStatus: vi.fn(),
  });
}

describe('Knowledge vector settings', () => {
  it('renders the embedded, managed, existing-local, remote and custom options', () => {
    const view = widget();
    const html = renderToStaticMarkup(React.createElement('div', {}, view.renderVectorSettings()));
    for (const name of [
      'LanceDB Embedded',
      'SQLite Embedded',
      'Qdrant Managed Local',
      'Qdrant Existing Local',
      'Qdrant Remote',
      'Custom registered adapter',
    ])
      expect(html).toContain(name);
    expect(html).toContain('Allow remote vector storage');
    view.vectorDeployment = 'external';
    expect(
      renderToStaticMarkup(React.createElement('div', {}, view.renderVectorSettings())),
    ).toContain('without enforcing this consent flag or HTTPS');
  });

  it('snapshots changes before asynchronous settings notifications refresh the form', async () => {
    const view = widget();
    const writes: Array<[string, unknown, string]> = [];
    view.service = {
      importSettings: async (input: {
        projectId: string;
        document: { settings: Array<{ key: string; value: unknown }> };
      }) => {
        for (const { key, value } of input.document.settings)
          writes.push([key, value, input.projectId]);
        view.vectorDeployment = 'external';
        view.allowRemoteVectorStore = false;
        view.vectorUrl = 'http://127.0.0.1:6333';
        view.projectId = 'another-project';
      },
    };
    await view.saveVectorSettings();
    expect(writes).toContainEqual(['knowledge.vectorStore.deployment', 'remote', 'project']);
    expect(writes).toContainEqual(['knowledge.vectorStore.allowRemote', true, 'project']);
    expect(writes).toContainEqual([
      'knowledge.vectorStore.url',
      'https://vectors.example.com',
      'project',
    ]);
    expect(writes.every((entry) => entry[2] === 'project')).toBe(true);
  });

  it('maps backend and deployment separately and exposes a custom adapter deployment', () => {
    const view = widget();
    view.selectVectorStore('lancedb-embedded');
    expect([view.vectorKind, view.vectorDeployment]).toEqual(['lancedb', 'embedded']);
    view.selectVectorStore('qdrant-managed-local');
    expect([view.vectorKind, view.vectorDeployment]).toEqual(['qdrant', 'managed-local']);
    view.vectorKind = 'custom-store';
    expect(
      renderToStaticMarkup(React.createElement('div', {}, view.renderVectorSettings())),
    ).toContain('Registered adapter ID');
  });
});

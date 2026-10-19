import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

vi.mock('@theia/core/shared/inversify', () => ({
  inject: () => () => {},
  injectable: () => () => {},
}));
vi.mock('@theia/core/lib/browser/widgets/widget', () => ({ Message: class {} }));
vi.mock('./control-room-react-widget', () => ({ ControlRoomReactWidget: class {} }));
vi.mock('../common/control-room-protocol', () => ({ ControlRoomService: Symbol('service') }));

import { ModelsWidget } from './models-widget';

const account = { accountId: 'account', displayName: 'Test provider' };
const model = {
  accountId: 'account',
  providerModelId: 'new',
  displayName: 'New model',
  enabled: false,
  capabilities: {
    chat: null,
    tools: null,
    vision: null,
    structuredOutput: null,
    streaming: null,
    embeddings: null,
  },
  pricing: { inputPerMTokUsd: null, outputPerMTokUsd: null },
  metadataFields: {
    'capabilities.chat': {
      source: 'catalog',
      confidence: 'high',
      updatedAt: '2026-10-01T00:00:00Z',
      stale: true,
      sourceUrl: 'https://models.dev',
    },
  },
};

function widget() {
  return Object.assign(Object.create(ModelsWidget.prototype), {
    models: [],
    availableModels: new Map([['account', [model]]]),
    selectedModels: new Map<string, string[]>(),
    busyAccounts: new Set<string>(),
    accountResults: new Map(),
    update: vi.fn(),
    refresh: vi.fn(),
    controlRoomService: {
      discoverModels: vi.fn().mockResolvedValue({
        added: 0,
        updated: 1,
        models: [model],
        warnings: ['Using retained catalog data.'],
      }),
    },
  });
}

describe('Models discovery UI', () => {
  it('renders individual unchecked choices, retained metadata and no bulk activation', () => {
    const view = widget();
    const html = renderToStaticMarkup(
      React.createElement('div', {}, view.renderModelSelection(account)),
    );
    expect(html).toContain('Select model new for Test provider');
    expect(html).not.toContain('checked=""');
    expect(html).not.toContain('Add all');
    expect(html).toContain('Enable selected (0)');
    expect(html).toContain('Stale (retained data)');
    expect(html).toContain('https://models.dev/');
  });

  it('keeps pending choices on repeated previews and failures without replacing displayed facts', async () => {
    const view = widget();
    view.selectedModels.set('account', ['new']);
    await view.discoverModels(account);
    expect(view.controlRoomService.discoverModels).toHaveBeenCalledWith('account', {
      preview: true,
    });
    expect(view.selectedModels.get('account')).toEqual(['new']);
    const previous = view.availableModels.get('account');
    view.controlRoomService.discoverModels.mockRejectedValueOnce(new Error('Provider offline'));
    await view.discoverModels(account);
    expect(view.selectedModels.get('account')).toEqual(['new']);
    expect(view.availableModels.get('account')).toBe(previous);
    expect(view.errorMessage).toBe('Provider offline');
  });

  it('sends only explicit IDs for enable and an empty list for metadata refresh', async () => {
    const view = widget();
    view.selectedModels.set('account', ['new']);
    await view.addDiscoveredModels(account, []);
    expect(view.controlRoomService.discoverModels).toHaveBeenLastCalledWith('account', {
      providerModelIds: [],
    });
    expect(view.selectedModels.get('account')).toEqual(['new']);
    expect(view.accountResults.get('account')).toContain('Using retained catalog data.');
    await view.addDiscoveredModels(account, ['new']);
    expect(view.controlRoomService.discoverModels).toHaveBeenLastCalledWith('account', {
      providerModelIds: ['new'],
    });
    expect(view.selectedModels.get('account')).toEqual([]);
  });
});

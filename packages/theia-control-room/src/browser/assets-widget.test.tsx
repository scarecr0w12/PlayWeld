import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

vi.mock('@theia/core/shared/inversify', () => ({
  injectable: () => () => {},
  inject: () => () => {},
}));
vi.mock('@theia/core/lib/browser/widgets/widget', () => ({ Message: class {} }));
vi.mock('@theia/core/lib/browser/endpoint', () => ({ Endpoint: class {} }));
vi.mock('./control-room-react-widget', () => ({ ControlRoomReactWidget: class {} }));
vi.mock('./control-room-client', () => ({ ControlRoomClientEvents: class {} }));
vi.mock('./asset-viewer/asset-viewer', () => ({ AssetViewer: () => null }));
vi.mock('./asset-viewer/image-viewer', () => ({ ImageViewer: () => null }));

import { AssetsWidget } from './assets-widget';

function widget() {
  return Object.assign(Object.create(AssetsWidget.prototype), {
    projects: [],
    selectedProjectId: 'project',
    activeSection: 'library',
    providers: [],
    accounts: [],
    jobs: [],
    files: [],
    selectedPath: '',
    preview: undefined,
    selectedAccountId: '',
    form: {
      kind: 'text-to-3d',
      prompt: '',
      negativePrompt: '',
      imagePath: '',
      sourceJobId: '',
      outputFormat: 'glb',
    },
    addProviderKind: 'meshy',
    addDisplayName: '',
    addBaseUrl: '',
    addApiKey: '',
    addPlanTier: '',
    destinationDir: '',
    reviewNotes: new Map(),
    busy: false,
    errorMessage: undefined,
    resultMessage: undefined,
    accountTestMessage: undefined,
    update: vi.fn(),
  });
}

describe('Assets workspace layout', () => {
  it('reveals successfully loaded previews from library and job actions', async () => {
    const view = widget();
    const preview = { sourcePath: 'assets/prop.glb' };
    view.service = { previewAsset: vi.fn(async () => preview) };
    for (const section of ['library', 'jobs']) {
      view.activeSection = section;
      await view.loadPreview(preview.sourcePath);
      expect(view.activeSection).toBe('preview');
      expect(view.preview).toBe(preview);
    }
  });

  it('reveals a newly queued job without clearing its generation draft', async () => {
    const view = widget();
    const form = view.form;
    view.selectedAccountId = 'account';
    view.activeSection = 'generate';
    view.service = { generateAsset: vi.fn(async () => ({ jobId: 'job-1' })) };
    view.refreshProject = vi.fn();
    await view.generate();
    expect(view.activeSection).toBe('jobs');
    expect(view.jobs).toEqual([{ jobId: 'job-1' }]);
    expect(view.form).toBe(form);
  });

  it('reveals the imported asset after import completes', async () => {
    const view = widget();
    view.activeSection = 'jobs';
    view.service = {
      importAsset: vi.fn(async () => ({ importedPath: 'assets/imported.glb' })),
      previewAsset: vi.fn(async () => ({ sourcePath: 'assets/imported.glb' })),
    };
    view.refreshProject = vi.fn();
    await view.importJob({ jobId: 'job-1', artifacts: [{ artifactId: 'model-1', kind: 'model' }] });
    expect(view.activeSection).toBe('preview');
    expect(view.selectedPath).toBe('assets/imported.glb');
  });

  it('renders selected section navigation and a useful empty library state', () => {
    const view = widget();
    const html = renderToStaticMarkup(React.createElement(view.render.bind(view)));
    expect(html).toContain('aria-label="Asset workspace sections"');
    expect(html).toContain('aria-pressed="true"');
    expect(html).toContain('No files under');
    expect(html).toContain('id="gamecrafter-assets-jobs" hidden=""');
  });

  it('keeps optional generation settings behind a labelled disclosure', () => {
    const view = widget();
    const html = renderToStaticMarkup(React.createElement(view.render.bind(view)));
    expect(html).toContain('Advanced generation options');
    expect(html).toContain('Negative prompt');
    expect(html).toContain('Output format');
  });
});

import { describe, expect, it, vi } from 'vitest';

vi.mock('@theia/core/shared/inversify', () => ({
  inject: () => () => {},
  injectable: () => () => {},
}));
vi.mock('@theia/core/lib/browser/widgets/widget', () => ({ Message: class {} }));
vi.mock('@theia/core/lib/browser/endpoint', () => ({ Endpoint: class {} }));
vi.mock('@theia/core/lib/common/command', () => ({ CommandService: class {} }));
vi.mock('./control-room-react-widget', () => ({ ControlRoomReactWidget: class {} }));
vi.mock('./control-room-client', () => ({ ControlRoomClientEvents: class {} }));
vi.mock('./models-view-contribution', () => ({ MODELS_OPEN_COMMAND_ID: 'models' }));
vi.mock('./asset-viewer/asset-viewer', () => ({ AssetViewer: () => null }));
vi.mock('./asset-viewer/image-viewer', () => ({ ImageViewer: () => null }));

import { EngineWidget } from './engine-widget';
import { DccWidget } from './dcc-widget';
import { AssetsWidget } from './assets-widget';
import { KnowledgeWidget } from './knowledge-widget';
import { SkillsWidget } from './skills-widget';
import { PluginsCatalogWidget } from './plugins-catalog-widget';
import { ConnectionsWidget } from './connections-widget';

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason: Error) => void;
  const promise = new Promise<T>((yes, no) => {
    resolve = yes;
    reject = no;
  });
  return { promise, resolve, reject };
}

function view(type: { prototype: object }, state: Record<string, unknown>) {
  return Object.assign(Object.create(type.prototype), {
    update: vi.fn(),
    isDisposed: false,
    logContents: new Map(),
    artifactContents: new Map(),
    reviewNotes: new Map(),
    previewVersion: 0,
    ...state,
  }) as Record<string, unknown> & {
    selectedProjectId: string;
    projectId: string;
    tool: string;
    loadProject(): Promise<void>;
    refreshProject(): Promise<void>;
    refresh(): Promise<void>;
    refreshStatus(): Promise<void>;
    refreshRecords(): Promise<void>;
    refreshSettings(): Promise<void>;
    runSearch(): Promise<void>;
    loadPreview(path: string): Promise<void>;
  };
}

describe('Project view response isolation', () => {
  for (const [label, type, rpc, field] of [
    ['Skills', SkillsWidget, 'listSkills', 'skills'],
    ['Plugins', PluginsCatalogWidget, 'listPlugins', 'plugins'],
    ['Connections', ConnectionsWidget, 'listMcpConnections', 'connections'],
  ] as const) {
    it(`${label} keeps the new Project snapshot after an older refresh completes`, async () => {
      const old = deferred<unknown[]>();
      const current = [{ marker: 'new' }];
      const load = vi
        .fn()
        .mockImplementationOnce(() => old.promise)
        .mockResolvedValue(current);
      const service = {
        listProjects: vi.fn().mockResolvedValue([]),
        [rpc]: load,
        listRoles: vi.fn().mockResolvedValue([]),
        getPluginModules: vi.fn().mockResolvedValue({ modules: [] }),
        getPluginIsolationReport: vi.fn().mockResolvedValue({}),
        listTools: vi.fn().mockResolvedValue([]),
        listA2AOutbound: vi.fn().mockResolvedValue([]),
        getA2AInboundConfig: vi.fn().mockResolvedValue({ enabled: false, port: 8765 }),
        listA2AInboundClients: vi.fn().mockResolvedValue([]),
      };
      const widget = view(type, {
        selectedProjectId: 'old',
        refreshVersion: 0,
        service,
        controlRoomService: service,
      });
      widget.resolveProjectSelection = async () => widget.selectedProjectId;
      const pending = widget.refresh();
      await vi.waitFor(() => expect(load).toHaveBeenCalledTimes(1));
      widget.selectedProjectId = 'new';
      await widget.refresh();
      old.resolve([{ marker: 'old' }]);
      await pending;
      expect(widget[field]).toBe(current);
    });
  }
  for (const [label, type, capability, runs] of [
    ['Engine', EngineWidget, 'getEngineCapabilities', 'listEngineRuns'],
    ['DCC', DccWidget, 'getDccCapabilities', 'listDccRuns'],
  ] as const) {
    it(`${label} discards a delayed response after another Project loads`, async () => {
      const old = deferred<unknown>();
      const current = { layers: { 'live-bridge': {} }, marker: 'new' };
      const widget = view(type, {
        selectedProjectId: 'old',
        tool: 'blender',
        projectLoadVersion: 0,
        service: {
          [capability]: vi
            .fn()
            .mockImplementationOnce(() => old.promise)
            .mockResolvedValue(current),
          [runs]: vi.fn().mockResolvedValue([]),
          listMcpConnections: vi.fn().mockResolvedValue([]),
        },
      });
      const pending = widget.loadProject();
      widget.selectedProjectId = 'new';
      await widget.loadProject();
      old.resolve({ layers: { 'live-bridge': {} }, marker: 'old' });
      await pending;
      expect(widget.report).toBe(current);
    });

    it(`${label} clears capabilities and run evidence on deselection`, async () => {
      const widget = view(type, {
        selectedProjectId: '',
        projectLoadVersion: 0,
        report: { marker: 'old' },
        runs: [{ runId: 'old' }],
        selectedRun: { runId: 'old' },
        selectedBridgeId: 'old',
      });
      await widget.loadProject();
      expect(widget.report).toBeUndefined();
      expect(widget.runs).toEqual([]);
      expect(widget.selectedRun).toBeUndefined();
      expect(widget.selectedBridgeId).toBe('');
    });
  }

  it('DCC discards a delayed response after the selected tool changes', async () => {
    const old = deferred<unknown>();
    const current = { layers: { 'live-bridge': {} }, marker: 'maya' };
    const widget = view(DccWidget, {
      selectedProjectId: 'project',
      tool: 'blender',
      projectLoadVersion: 0,
      service: {
        getDccCapabilities: vi
          .fn()
          .mockImplementationOnce(() => old.promise)
          .mockResolvedValue(current),
        listDccRuns: vi.fn().mockResolvedValue([]),
        listMcpConnections: vi.fn().mockResolvedValue([]),
      },
    });
    const pending = widget.loadProject();
    widget.tool = 'maya';
    await widget.loadProject();
    old.resolve({ layers: { 'live-bridge': {} }, marker: 'blender' });
    await pending;
    expect(widget.report).toBe(current);
  });

  it('Assets keeps the current library when an old Project finishes loading later', async () => {
    const old = deferred<unknown[]>();
    const current = [{ path: 'new.glb' }];
    const widget = view(AssetsWidget, {
      selectedProjectId: 'old',
      projectLoadVersion: 0,
      service: {
        listAssetProviders: vi.fn().mockResolvedValue([]),
        listAssetAccounts: vi.fn().mockResolvedValue([]),
        listAssetJobs: vi.fn().mockResolvedValue([]),
        listAssetFiles: vi
          .fn()
          .mockImplementationOnce(() => old.promise)
          .mockResolvedValue(current),
      },
    });
    const pending = widget.refreshProject();
    widget.selectedProjectId = 'new';
    await widget.refreshProject();
    old.resolve([{ path: 'old.glb' }]);
    await pending;
    expect(widget.files).toBe(current);
    expect(widget.busy).toBe(false);
  });

  it('Assets clears its library and job history when no Project is selected', async () => {
    const widget = view(AssetsWidget, {
      selectedProjectId: '',
      projectLoadVersion: 0,
      files: ['old'],
      jobs: ['old'],
      busy: true,
    });
    await widget.refreshProject();
    expect(widget.files).toEqual([]);
    expect(widget.jobs).toEqual([]);
    expect(widget.busy).toBe(false);
  });

  it('Assets ignores an old preview after navigating to another Project', async () => {
    const old = deferred<unknown>();
    const widget = view(AssetsWidget, {
      selectedProjectId: 'old',
      preview: undefined,
      service: { previewAsset: vi.fn(() => old.promise) },
    });
    const pending = widget.loadPreview('old.glb');
    widget.selectedProjectId = 'new';
    old.resolve({ projectId: 'old', sourcePath: 'old.glb' });
    await pending;
    expect(widget.preview).toBeUndefined();
  });

  for (const [method, rpc, result, field] of [
    ['refreshStatus', 'getKnowledgeIndexStatus', { marker: 'old' }, 'indexStatus'],
    ['refreshRecords', 'listKnowledgeRecords', { records: [{ id: 'old' }] }, 'records'],
    [
      'refreshSettings',
      'getAllSettings',
      [{ key: 'knowledge.vectorStore.url', value: 'https://old.example' }],
      'vectorUrl',
    ],
  ] as const) {
    it(`Knowledge ${method} ignores an old Project response`, async () => {
      const old = deferred<unknown>();
      const initial = field === 'records' ? [] : 'new';
      const widget = view(KnowledgeWidget, {
        projectId: 'old',
        statusVersion: 0,
        recordsVersion: 0,
        settingsVersion: 0,
        [field]: initial,
        selectedRecordId: '',
        recordType: '',
        status: 'all',
        service: { [rpc]: vi.fn(() => old.promise) },
      });
      const pending = widget[method]();
      widget.projectId = 'new';
      old.resolve(result);
      await pending;
      expect(widget[field]).toEqual(initial);
    });
    it(`Knowledge ${method} contains a failed notification refresh`, async () => {
      const widget = view(KnowledgeWidget, {
        projectId: 'project',
        statusVersion: 0,
        recordsVersion: 0,
        settingsVersion: 0,
        selectedRecordId: '',
        recordType: '',
        status: 'all',
        service: { [rpc]: vi.fn().mockRejectedValue(new Error('Service offline')) },
      });
      await expect(widget[method]()).resolves.toBeUndefined();
      expect(widget.errorMessage).toBe('Service offline');
    });
  }

  it('Knowledge does not attach search results from an old Project to the new one', async () => {
    const old = deferred<unknown>();
    const widget = view(KnowledgeWidget, {
      projectId: 'old',
      query: 'example',
      recordType: '',
      status: 'all',
      source: 'all',
      service: { searchKnowledge: vi.fn(() => old.promise) },
      withBusy: async (action: () => Promise<void>) => action(),
      searchResult: undefined,
    });
    const pending = widget.runSearch();
    widget.projectId = 'new';
    old.resolve({ hits: [{ id: 'old' }] });
    await pending;
    expect(widget.searchResult).toBeUndefined();
  });
});

import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

vi.mock('@theia/core/shared/inversify', () => ({
  inject: () => () => {},
  injectable: () => () => {},
}));
vi.mock('@theia/core/lib/browser/widgets/widget', () => ({ Message: class {} }));
vi.mock('@theia/core/lib/common/message-service', () => ({ MessageService: class {} }));
vi.mock('./control-room-react-widget', () => ({ ControlRoomReactWidget: class {} }));
vi.mock('./control-room-client', () => ({ ControlRoomClientEvents: class {} }));
vi.mock('../common/control-room-protocol', () => ({ ControlRoomService: Symbol('service') }));

import { AuditWidget } from './audit-widget';
import { BackupsWidget } from './backups-widget';
import { ModelsWidget } from './models-widget';
import { GameCrafterSettingsWidget } from './settings-widget';
import { UpdatesWidget } from './updates-widget';

type Renderable<T> = T & { render(): React.ReactNode };

function markup(widget: Renderable<unknown>): string {
  return renderToStaticMarkup(React.createElement('div', {}, widget.render()));
}

function widget<T>(type: new (...args: never[]) => T, state: Partial<T>): Renderable<T> {
  return Object.assign(Object.create(type.prototype), state) as Renderable<T>;
}

describe('operations page navigation', () => {
  it('searches across groups using the real field handler and reveals the matching settings', () => {
    const view = widget(GameCrafterSettingsWidget, {
      groups: [
        { id: 'access', title: 'Access', order: 0 },
        { id: 'backups', title: 'Backups', order: 1 },
      ],
      definitions: [
        {
          key: 'access.mode',
          group: 'access',
          title: 'Access mode',
          description: '',
          schema: { type: 'string' },
          default: 'ask-always',
          scopes: ['platform'],
        },
        {
          key: 'backup.destination',
          group: 'backups',
          title: 'Backup destination',
          description: '',
          schema: { type: 'string' },
          default: 'local',
          scopes: ['platform'],
        },
      ],
      projects: [],
      settings: new Map(),
      scopes: new Map(),
      drafts: new Map(),
      selectedGroup: 'access',
      searchQuery: '',
      update: vi.fn(),
    });
    let search: ((event: { currentTarget: { value: string } }) => void) | undefined;
    const visit = (node: React.ReactNode) =>
      React.Children.forEach(node, (child) => {
        if (!React.isValidElement(child)) return;
        const element = child as React.ReactElement<{
          children?: React.ReactNode;
          'aria-label'?: string;
          onChange?: typeof search;
        }>;
        if (element.props['aria-label'] === 'Search settings') search = element.props.onChange;
        visit(element.props.children);
      });
    visit(view.render());
    expect(search).toBeTypeOf('function');
    search!({ currentTarget: { value: 'backup.destination' } });
    const html = markup(view);
    expect(html).toContain('id="gamecrafter-settings-group-backups"');
    expect(html).not.toContain('id="gamecrafter-settings-group-access"');
    expect(html).not.toContain('hidden=""');
  });

  it('keeps inactive settings groups mounted and labels the selected group', () => {
    const view = widget(GameCrafterSettingsWidget, {
      groups: [
        { id: 'general', title: 'General', description: 'Common settings', order: 0 },
        { id: 'advanced', title: 'Advanced', description: 'More settings', order: 1 },
      ],
      definitions: [],
      projects: [],
      settings: new Map(),
      selectedGroup: 'general',
      selectedProjectId: undefined,
      searchQuery: '',
      scopes: new Map(),
      importBusy: false,
      drafts: new Map(),
    });

    const html = markup(view);
    expect(html).toContain('aria-label="Settings groups"');
    expect(html).toContain('aria-pressed="true"');
    expect(html).toContain('id="gamecrafter-settings-group-general"');
    expect(html).toContain(
      'id="gamecrafter-settings-group-advanced" aria-label="Advanced settings" hidden=""',
    );
  });

  it('keeps model management sections mounted while selecting provider accounts', () => {
    const view = widget(ModelsWidget, {
      accounts: [],
      models: [],
      pools: [],
      decisions: [],
      projects: [],
      selectedProjectId: undefined,
      activeSection: 'accounts',
      accountKind: 'openai-compatible',
      accountName: '',
      accountBaseUrl: '',
      accountApiKey: '',
      accountIsLocal: true,
      poolName: '',
      poolScope: 'platform',
      poolTargetKind: 'none',
      poolTargetId: '',
      poolModelIds: new Set(),
      accountResults: new Map(),
      availableModels: new Map(),
      selectedModels: new Map(),
      busyAccounts: new Set(),
    });

    const html = markup(view);
    expect(html).toContain('aria-label="Model configuration sections"');
    expect(html).toContain('aria-pressed="true"');
    expect(html).toContain('No provider accounts yet.');
    expect(html).toContain('hidden=""><h2>Models</h2>');
    expect(html).toContain('hidden=""><h2>Model pools</h2>');
    expect(html).toContain('hidden=""><h2>Recent routing decisions</h2>');
  });

  it('keeps update status, release, and recovery panes available behind section tabs', () => {
    const view = widget(UpdatesWidget, {
      state: {
        schemaVersion: 1,
        currentVersion: '0.6.0',
        channel: 'stable',
        lastCheckedAt: null,
        available: null,
        downloaded: null,
        compatibility: { ok: true, reasons: [] },
        previous: null,
        error: null,
      },
      activeSection: 'status',
      message: '',
      busy: false,
    });

    const html = markup(view);
    expect(html).toContain('aria-label="Update sections"');
    expect(html).toContain('Installed version');
    expect(html).toContain('hidden=""><h2>No update available</h2>');
    expect(html).toContain('No downloaded update or rollback package is available.');
  });

  it('takes successful update checks and downloads to the pane containing their results', async () => {
    const checked = { available: { version: '0.7.0' } };
    const view = Object.assign(Object.create(UpdatesWidget.prototype), {
      state: undefined,
      activeSection: 'status',
      update: vi.fn(),
      service: {
        checkUpdates: vi.fn(async () => checked),
        downloadUpdate: vi.fn(async () => ({ ...checked, downloaded: { version: '0.7.0' } })),
      },
    }) as { activeSection: string; check(): Promise<void>; download(): Promise<void> };
    await view.check();
    expect(view.activeSection).toBe('release');
    await view.download();
    expect(view.activeSection).toBe('recovery');
  });

  it('keeps backup identity, destination, plan, run, and archive panes mounted', () => {
    const view = widget(BackupsWidget, {
      projects: [],
      identities: [],
      destinations: [],
      plans: [],
      runs: [],
      archives: [],
      projectId: '',
      activeSection: 'plans',
      scope: 'project',
      identityId: '',
      destinationId: '',
      archiveName: '',
      identityLabel: '',
      identitySecret: '',
      identityConfirmation: '',
      destinationKind: 'local',
      destinationName: '',
      destinationConfig: '{"directory":""}',
      destinationSecrets: {},
      editingDestinationId: '',
      planSchedule: 'manual',
      everyMinutes: '60',
      dailyAt: '02:00',
      keepLast: '5',
      keepDays: '',
      restoreSecret: '',
      restoreTargetPath: '',
      registerProject: true,
      message: '',
      busy: false,
    });

    const html = markup(view);
    expect(html).toContain('aria-label="Backup sections"');
    expect(html).toContain('No recovery identities yet.');
    expect(html).toContain('hidden=""><h3>Identities</h3>');
    expect(html).toContain('hidden=""><h3>Destinations</h3>');
    expect(html).toContain('hidden=""><h3>Runs</h3>');
    expect(html).toContain('hidden=""><h3>Archives</h3>');
  });

  it('keeps audit call and event records mounted while switching views', () => {
    const view = widget(AuditWidget, {
      projects: [{ projectId: 'project-1', name: 'Example' }],
      projectId: 'project-1',
      snapshot: { calls: [], events: [], limit: 100, nextAfterSeq: 0 } as never,
      afterSeq: 0,
      query: '',
      busy: false,
      activeSection: 'calls',
    });

    const html = markup(view);
    expect(html).toContain('aria-label="Audit sections"');
    expect(html).toContain('Recent tool calls');
    expect(html).toContain('hidden=""><h2>Project events</h2>');
  });
});

import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import type {
  A2AInboundClient,
  A2AInboundConfig,
  A2AOutboundConnection,
  Model,
  ProviderAccount,
  ProjectSummary,
} from '@gamecrafter/contracts';

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
import { ConnectionsWidget } from './connections-widget';
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

type InspectableProps = {
  children?: React.ReactNode;
  className?: string;
  'aria-label'?: string;
  onChange?: (event: unknown) => void;
  onBlur?: (event: unknown) => void;
  onClick?: () => void;
  onSubmit?: (event: { preventDefault(): void }) => void;
};

function findElement(
  root: React.ReactNode,
  matches: (element: React.ReactElement<InspectableProps>) => boolean,
): React.ReactElement<InspectableProps> | undefined {
  let found: React.ReactElement<InspectableProps> | undefined;
  React.Children.forEach(root, (child) => {
    if (!React.isValidElement(child) || found) return;
    const element = child as React.ReactElement<InspectableProps>;
    if (matches(element)) found = element;
    else found = findElement(element.props.children, matches);
  });
  return found;
}

function connectionsWidget(state: Partial<ConnectionsWidget>): Renderable<ConnectionsWidget> {
  return widget(ConnectionsWidget, {
    projects: [],
    selectedProjectId: undefined,
    connections: [],
    tools: new Map(),
    logs: new Map(),
    logConnectionId: undefined,
    activeSection: 'a2a',
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
    a2aConnections: [],
    a2aInboundConfig: undefined,
    a2aInboundClients: [],
    a2aRoles: [],
    a2aView: 'outbound',
    a2aOutboundName: '',
    a2aEndpoint: '',
    a2aAuthKind: 'none',
    a2aHeaderName: 'x-api-key',
    a2aApiKey: '',
    a2aBearer: '',
    a2aUsername: '',
    a2aPassword: '',
    a2aCustomHeaders: '{}',
    a2aInboundEnabled: false,
    a2aPort: '8765',
    a2aClientName: '',
    a2aEditingClientId: undefined,
    a2aGrantProjectId: '',
    a2aGrantRole: '',
    a2aPermissions: ['create', 'get', 'continue', 'stream', 'cancel'],
    a2aDraftGrants: [],
    issuedA2AToken: undefined,
    update: vi.fn(),
    ...state,
  } as Partial<ConnectionsWidget>);
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

  it('shows named providers, unknown capability states, and field-level metadata provenance', async () => {
    const account: ProviderAccount = {
      accountId: '019535d4-2c00-7000-8000-000000000301',
      providerKind: 'azure-openai',
      displayName: 'Studio Azure',
      baseUrl: 'https://studio.openai.azure.com',
      providerOptions: { deploymentName: 'studio-prod', catalogModelId: 'gpt-6.1-sol' },
      hasCredential: true,
      headers: {},
      isLocal: false,
      privacy: 'cloud',
      enabled: true,
      createdAt: '2026-10-01T00:00:00.000Z',
      updatedAt: '2026-10-01T00:00:00.000Z',
    };
    const model: Model = {
      modelId: `${account.accountId}/studio-prod`,
      accountId: account.accountId,
      providerModelId: 'studio-prod',
      catalogModelId: 'gpt-6.1-sol',
      displayName: 'Studio Solver',
      capabilities: {
        chat: true,
        tools: null,
        vision: true,
        structuredOutput: null,
        streaming: null,
        embeddings: null,
        contextWindow: 1_050_000,
        maxInputTokens: 922_000,
        maxOutputTokens: 128_000,
      },
      pricing: { inputPerMTokUsd: null, outputPerMTokUsd: null },
      metadataSource: 'provider',
      metadataUpdatedAt: '2026-10-01T00:00:00.000Z',
      metadataFields: {
        'capabilities.vision': {
          source: 'provider-catalog',
          updatedAt: '2026-10-01T00:00:00.000Z',
          sourceUrl: 'javascript:alert(1)',
          confidence: 'high',
        },
        workTypes: {
          source: 'derived',
          updatedAt: '2026-10-01T00:00:00.000Z',
          sourceUrl: null,
          confidence: 'high',
        },
      },
      enabled: true,
      tags: [],
      workTypes: ['code'],
      roles: [],
    };
    const updateModel = vi.fn(async () => model);
    const service = {
      updateModel,
      listProjects: vi.fn(async () => []),
      listProviderAccounts: vi.fn(async () => [account]),
      listModels: vi.fn(async () => [model]),
      listModelPools: vi.fn(async () => []),
      listRouteDecisions: vi.fn(async () => []),
    };
    const view = widget(ModelsWidget, {
      controlRoomService: service as never,
      accounts: [account],
      models: [model],
      pools: [],
      decisions: [],
      decisionAssessments: [],
      decisionAssessmentsLoading: false,
      projects: [],
      activeSection: 'models',
      selectedProjectId: undefined,
      accountKind: 'azure-openai',
      accountName: '',
      accountBaseUrl: '',
      accountApiKey: '',
      accountHeaders: '',
      accountIsLocal: false,
      accountApiVersion: '2024-10-21',
      accountDeploymentName: '',
      accountCatalogModelId: '',
      poolName: '',
      poolScope: 'platform',
      poolTargetKind: 'none',
      poolTargetId: '',
      poolModelIds: new Set(),
      accountResults: new Map(),
      availableModels: new Map(),
      selectedModels: new Map(),
      busyAccounts: new Set(),
      refreshVersion: 0,
      resolveProjectSelection: vi.fn(
        async (_projects: unknown, getValue: () => string | undefined) => getValue(),
      ),
      isDisposed: false,
      update: vi.fn(),
    });

    const html = markup(view);
    expect(html).toContain('Google Gemini');
    expect(html).toContain('Azure deployment name');
    expect(html).toContain('Unknown');
    expect(html).toContain('Provider-declared vision is not currently routable');
    expect(html).toContain('Catalog model: <code>gpt-6.1-sol</code>');
    expect(html).toContain(`aria-label="Catalog model ID ${model.modelId}"`);
    expect(html).toContain('derived · high confidence');
    expect(html).not.toContain('href="javascript:alert(1)"');

    findElement(
      view.render(),
      (element) => element.props['aria-label'] === `Maximum input tokens ${model.modelId}`,
    )?.props.onBlur?.({ currentTarget: { value: '800000' } });
    await vi.waitFor(() =>
      expect(updateModel).toHaveBeenCalledWith(model.modelId, {
        capabilities: { maxInputTokens: 800_000 },
      }),
    );
  });

  it('creates an Azure account with deployment settings and secret custom headers', async () => {
    const account: ProviderAccount = {
      accountId: '019535d4-2c00-7000-8000-000000000302',
      providerKind: 'azure-openai',
      displayName: 'Studio Azure',
      baseUrl: 'https://studio.openai.azure.com',
      providerOptions: { deploymentName: 'studio-prod', apiVersion: '2024-10-21' },
      hasCredential: true,
      headers: { 'X-Workspace': 'studio' },
      isLocal: false,
      privacy: 'cloud',
      enabled: true,
      createdAt: '2026-10-01T00:00:00.000Z',
      updatedAt: '2026-10-01T00:00:00.000Z',
    };
    const addProviderAccount = vi.fn(async () => account);
    const service = {
      addProviderAccount,
      listProjects: vi.fn(async () => []),
      listProviderAccounts: vi.fn(async () => [account]),
      listModels: vi.fn(async () => []),
      listModelPools: vi.fn(async () => []),
      listRouteDecisions: vi.fn(async () => []),
    };
    const view = widget(ModelsWidget, {
      controlRoomService: service as never,
      accounts: [],
      models: [],
      pools: [],
      decisions: [],
      decisionAssessments: [],
      decisionAssessmentsLoading: false,
      projects: [],
      selectedProjectId: undefined,
      activeSection: 'accounts',
      accountKind: 'openai-compatible',
      accountName: '',
      accountBaseUrl: 'http://localhost:11434/v1',
      accountApiKey: '',
      accountHeaders: '',
      accountIsLocal: true,
      accountApiVersion: '2024-10-21',
      accountDeploymentName: '',
      accountCatalogModelId: '',
      poolName: '',
      poolScope: 'platform',
      poolTargetKind: 'none',
      poolTargetId: '',
      poolModelIds: new Set(),
      accountResults: new Map(),
      availableModels: new Map(),
      selectedModels: new Map(),
      busyAccounts: new Set(),
      refreshVersion: 0,
      resolveProjectSelection: vi.fn(
        async (_projects: unknown, getValue: () => string | undefined) => getValue(),
      ),
      update: vi.fn(),
      isDisposed: false,
    });

    findElement(
      view.render(),
      (element) => element.props['aria-label'] === 'Provider kind',
    )?.props.onChange?.({ currentTarget: { value: 'azure-openai' } });
    findElement(
      view.render(),
      (element) => element.props['aria-label'] === 'Provider display name',
    )?.props.onChange?.({ currentTarget: { value: 'Studio Azure' } });
    findElement(
      view.render(),
      (element) => element.props['aria-label'] === 'Provider API key',
    )?.props.onChange?.({ currentTarget: { value: 'azure-secret' } });
    findElement(
      view.render(),
      (element) => element.props['aria-label'] === 'Provider custom headers',
    )?.props.onChange?.({
      currentTarget: { value: 'X-Workspace: studio\nX-Secret: header-secret' },
    });
    findElement(
      view.render(),
      (element) => element.props['aria-label'] === 'Azure deployment name',
    )?.props.onChange?.({ currentTarget: { value: 'studio-prod' } });

    const form = findElement(
      view.render(),
      (element) => element.props.className === 'gamecrafter-models-account-form',
    );
    await form?.props.onSubmit?.({ preventDefault() {} });

    expect(addProviderAccount).toHaveBeenCalledWith({
      providerKind: 'azure-openai',
      displayName: 'Studio Azure',
      baseUrl: 'https://your-resource.openai.azure.com',
      providerOptions: { deploymentName: 'studio-prod', apiVersion: '2024-10-21' },
      apiKey: 'azure-secret',
      headers: { 'X-Workspace': 'studio', 'X-Secret': 'header-secret' },
      isLocal: false,
    });
  });

  it('edits Azure account deployment fields and replaces stored credentials', async () => {
    const account: ProviderAccount = {
      accountId: '019535d4-2c00-7000-8000-000000000303',
      providerKind: 'azure-openai',
      displayName: 'Old name',
      baseUrl: 'https://studio.openai.azure.com',
      providerOptions: {
        deploymentName: 'old-deployment',
        catalogModelId: 'gpt-6.1-sol',
        apiVersion: '2024-10-21',
      },
      hasCredential: true,
      headers: { 'X-Workspace': 'studio', Authorization: '[REDACTED]' },
      isLocal: false,
      privacy: 'cloud',
      enabled: true,
      createdAt: '2026-10-01T00:00:00.000Z',
      updatedAt: '2026-10-01T00:00:00.000Z',
    };
    const updateProviderAccount = vi.fn(async () => account);
    const service = {
      updateProviderAccount,
      listProjects: vi.fn(async () => []),
      listProviderAccounts: vi.fn(async () => [account]),
      listModels: vi.fn(async () => []),
      listModelPools: vi.fn(async () => []),
      listRouteDecisions: vi.fn(async () => []),
    };
    const view = widget(ModelsWidget, {
      controlRoomService: service as never,
      accounts: [account],
      models: [],
      pools: [],
      decisions: [],
      decisionAssessments: [],
      decisionAssessmentsLoading: false,
      projects: [],
      selectedProjectId: undefined,
      activeSection: 'accounts',
      accountKind: 'openai-compatible',
      accountName: '',
      accountBaseUrl: '',
      accountApiKey: '',
      accountHeaders: '',
      accountIsLocal: false,
      accountApiVersion: '2024-10-21',
      accountDeploymentName: '',
      accountCatalogModelId: '',
      poolName: '',
      poolScope: 'platform',
      poolTargetKind: 'none',
      poolTargetId: '',
      poolModelIds: new Set(),
      accountResults: new Map(),
      availableModels: new Map(),
      selectedModels: new Map(),
      busyAccounts: new Set(),
      refreshVersion: 0,
      resolveProjectSelection: vi.fn(
        async (_projects: unknown, getValue: () => string | undefined) => getValue(),
      ),
      update: vi.fn(),
      isDisposed: false,
    });

    findElement(
      view.render(),
      (element) => element.type === 'button' && element.props.children === 'Edit',
    )?.props.onClick?.();
    findElement(
      view.render(),
      (element) => element.props['aria-label'] === `Edit account name ${account.displayName}`,
    )?.props.onChange?.({ currentTarget: { value: 'Updated name' } });
    findElement(
      view.render(),
      (element) => element.props['aria-label'] === `Replace API key ${account.displayName}`,
    )?.props.onChange?.({ currentTarget: { value: 'replacement-key' } });
    findElement(
      view.render(),
      (element) => element.props['aria-label'] === `Edit custom headers ${account.displayName}`,
    )?.props.onChange?.({
      currentTarget: { value: 'X-Workspace: studio\nAuthorization: Bearer replacement-header' },
    });
    findElement(
      view.render(),
      (element) => element.props['aria-label'] === `Azure deployment name ${account.displayName}`,
    )?.props.onChange?.({ currentTarget: { value: 'new-deployment' } });
    findElement(
      view.render(),
      (element) => element.props['aria-label'] === `Azure API version ${account.displayName}`,
    )?.props.onChange?.({ currentTarget: { value: '2026-01-01' } });

    const form = findElement(
      view.render(),
      (element) => element.props.className === 'gamecrafter-models-account-editor',
    );
    await form?.props.onSubmit?.({ preventDefault() {} });

    expect(updateProviderAccount).toHaveBeenCalledWith(account.accountId, {
      displayName: 'Updated name',
      baseUrl: 'https://studio.openai.azure.com',
      isLocal: false,
      apiKey: 'replacement-key',
      headers: { 'X-Workspace': 'studio', Authorization: 'Bearer replacement-header' },
      providerOptions: {
        deploymentName: 'new-deployment',
        catalogModelId: 'gpt-6.1-sol',
        apiVersion: '2026-01-01',
      },
    });

    updateProviderAccount.mockClear();
    findElement(
      view.render(),
      (element) => element.type === 'button' && element.props.children === 'Edit',
    )?.props.onClick?.();
    findElement(
      view.render(),
      (element) =>
        element.props['aria-label'] === `Remove stored credentials ${account.displayName}`,
    )?.props.onChange?.({ currentTarget: { checked: true } });
    findElement(
      view.render(),
      (element) => element.props['aria-label'] === `Edit custom headers ${account.displayName}`,
    )?.props.onChange?.({ currentTarget: { value: 'Authorization: Bearer replacement-header' } });
    const removalForm = findElement(
      view.render(),
      (element) => element.props.className === 'gamecrafter-models-account-editor',
    );
    await removalForm?.props.onSubmit?.({ preventDefault() {} });
    expect(updateProviderAccount).toHaveBeenLastCalledWith(account.accountId, {
      displayName: 'Old name',
      baseUrl: 'https://studio.openai.azure.com',
      isLocal: false,
      apiKey: null,
      headers: {},
      providerOptions: {
        deploymentName: 'old-deployment',
        catalogModelId: 'gpt-6.1-sol',
        apiVersion: '2024-10-21',
      },
    });
  });

  it('shows the loopback A2A gateway and displays issued client tokens only once', async () => {
    const projectId = '019535d4-2c00-7000-8000-000000000401';
    const client: A2AInboundClient = {
      schemaVersion: 1,
      clientId: '019535d4-2c00-7000-8000-000000000402',
      name: 'Local harness',
      grants: [
        {
          projectId,
          role: 'programmer',
          taskKinds: ['agent.run'],
          permissions: ['create', 'get', 'continue', 'stream', 'cancel'],
        },
      ],
      credentialConfigured: false,
      revokedAt: null,
      createdAt: '2026-10-04T00:00:00.000Z',
      updatedAt: '2026-10-04T00:00:00.000Z',
    };
    const config: A2AInboundConfig = {
      schemaVersion: 1,
      enabled: true,
      address: '127.0.0.1',
      port: 8765,
      active: true,
    };
    const token = 'pw_a2a_one_time_test_token';
    const issueA2AInboundClientToken = vi.fn(async () => ({ clientId: client.clientId, token }));
    const activeClient = { ...client, credentialConfigured: true };
    const view = connectionsWidget({
      service: {
        issueA2AInboundClientToken,
        listA2AInboundClients: vi.fn(async () => [activeClient]),
      } as never,
      projects: [{ projectId, name: 'Game Project' } as ProjectSummary],
      a2aView: 'inbound',
      a2aInboundConfig: config,
      a2aInboundClients: [client],
    });

    const html = markup(view);
    expect(html).toContain('127.0.0.1:8765/.well-known/agent-card.json');
    expect(html).toContain('Each client can submit, inspect, continue, stream, or cancel');
    expect(html).toContain('Not issued');
    expect(html).toContain('Register local harness');
    expect(html).toContain('Inbound messages can create `agent.run` tasks only');

    findElement(
      view.render(),
      (element) => element.type === 'button' && element.props.children === 'Issue / rotate token',
    )?.props.onClick?.();
    await vi.waitFor(() => expect(markup(view)).toContain(token));
    expect(issueA2AInboundClientToken).toHaveBeenCalledWith(client.clientId);

    findElement(
      view.render(),
      (element) => element.type === 'button' && element.props.children === 'Hide token',
    )?.props.onClick?.();
    expect(markup(view)).not.toContain(token);
  });

  it('saves outbound A2A API-key credentials without exposing them in connection records', async () => {
    const connection: A2AOutboundConnection = {
      schemaVersion: 1,
      connectionId: '019535d4-2c00-7000-8000-000000000403',
      name: 'Review agent',
      endpoint: 'https://agent.example',
      authKind: 'api-key',
      credentialConfigured: true,
      agentCard: null,
      createdAt: '2026-10-04T00:00:00.000Z',
      updatedAt: '2026-10-04T00:00:00.000Z',
    };
    const upsertA2AOutbound = vi.fn(async () => connection);
    const service = {
      upsertA2AOutbound,
      listA2AOutbound: vi.fn(async () => [connection]),
    };
    const view = connectionsWidget({ service: service as never });

    findElement(
      view.render(),
      (element) => element.props['aria-label'] === 'A2A connection name',
    )?.props.onChange?.({ currentTarget: { value: 'Review agent' } });
    findElement(
      view.render(),
      (element) => element.props['aria-label'] === 'A2A agent endpoint',
    )?.props.onChange?.({ currentTarget: { value: 'https://agent.example' } });
    findElement(
      view.render(),
      (element) => element.props['aria-label'] === 'A2A authentication kind',
    )?.props.onChange?.({ currentTarget: { value: 'api-key' } });
    findElement(
      view.render(),
      (element) => element.props['aria-label'] === 'A2A API-key header name',
    )?.props.onChange?.({ currentTarget: { value: 'x-api-key' } });
    findElement(
      view.render(),
      (element) => element.props['aria-label'] === 'A2A API key',
    )?.props.onChange?.({ currentTarget: { value: 'secret-key' } });
    const form = findElement(
      view.render(),
      (element) =>
        element.props.className === 'gamecrafter-connections-form gamecrafter-a2a-outbound-form',
    );
    await form?.props.onSubmit?.({ preventDefault() {} });

    await vi.waitFor(() =>
      expect(upsertA2AOutbound).toHaveBeenCalledWith({
        name: 'Review agent',
        endpoint: 'https://agent.example',
        auth: { kind: 'api-key', headerName: 'x-api-key', value: 'secret-key' },
      }),
    );
    expect(service.listA2AOutbound).toHaveBeenCalled();
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

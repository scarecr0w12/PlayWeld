import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import type { ProjectSummary } from '@gamecrafter/contracts';
import type { MenuModelRegistry } from '@theia/core/lib/common/menu';

vi.mock('@theia/core/shared/inversify', () => ({
  inject: () => () => {},
  injectable: () => () => {},
}));
vi.mock('@theia/core/lib/browser/widgets/widget', () => ({ Message: class {} }));
vi.mock('./control-room-react-widget', () => ({ ControlRoomReactWidget: class {} }));
vi.mock('./control-room-client', () => ({ ControlRoomClientEvents: class {} }));
vi.mock('../common/control-room-protocol', () => ({ ControlRoomService: Symbol('service') }));
vi.mock('@theia/core/lib/common/command', () => ({ CommandService: class {} }));
vi.mock('@theia/core/lib/common/menu', () => ({ MAIN_MENU_BAR: ['menubar'] }));
vi.mock('@theia/core/lib/browser/common-commands', () => ({
  CommonCommands: { OPEN_PREFERENCES: { id: 'ide-settings' }, OPEN_VIEW: { id: 'open-view' } },
}));
vi.mock('./project-home-contribution', () => ({
  PROJECT_HOME_TOGGLE_COMMAND_ID: 'gamecrafter.projectHome.toggle',
}));
vi.mock('@theia/core/lib/common/uri', () => ({ default: class URI {} }));
vi.mock('@theia/core/lib/common/message-service', () => ({ MessageService: class {} }));
vi.mock('@theia/workspace/lib/browser/workspace-service', () => ({ WorkspaceService: class {} }));
vi.mock('./create-project-command', () => ({
  CREATE_PROJECT_COMMAND_ID: 'gamecrafter.project.create',
}));
vi.mock('./settings-view-contribution', () => ({
  SETTINGS_OPEN_COMMAND_ID: 'gamecrafter.settings.open',
}));
vi.mock('./models-view-contribution', () => ({
  MODELS_OPEN_COMMAND_ID: 'gamecrafter.models.open',
}));
vi.mock('./skills-view-contribution', () => ({
  SKILLS_OPEN_COMMAND_ID: 'gamecrafter.skills.open',
}));
vi.mock('./connections-view-contribution', () => ({
  CONNECTIONS_OPEN_COMMAND_ID: 'gamecrafter.connections.open',
}));
vi.mock('./discussion-board-view-contribution', () => ({
  DISCUSSION_BOARD_OPEN_COMMAND_ID: 'gamecrafter.board.open',
}));
vi.mock('./swarm-view-contribution', () => ({ SWARM_OPEN_COMMAND_ID: 'gamecrafter.swarm.open' }));
vi.mock('./plugins-catalog-view-contribution', () => ({
  PLUGINS_OPEN_COMMAND_ID: 'gamecrafter.plugins.open',
}));
vi.mock('./engine-view-contribution', () => ({
  ENGINE_OPEN_COMMAND_ID: 'gamecrafter.engine.open',
}));
vi.mock('./dcc-view-contribution', () => ({ DCC_OPEN_COMMAND_ID: 'gamecrafter.dcc.open' }));
vi.mock('./knowledge-view-contribution', () => ({
  KNOWLEDGE_OPEN_COMMAND_ID: 'gamecrafter.knowledge.open',
}));
vi.mock('./assets-view-contribution', () => ({
  ASSETS_OPEN_COMMAND_ID: 'gamecrafter.assets.open',
}));
vi.mock('./backups-view-contribution', () => ({
  BACKUPS_OPEN_COMMAND_ID: 'gamecrafter.backups.open',
}));
vi.mock('./audit-view-contribution', () => ({ AUDIT_OPEN_COMMAND_ID: 'gamecrafter.audit.open' }));
vi.mock('./chat-view-contribution', () => ({ CHAT_OPEN_COMMAND_ID: 'gamecrafter.chat.open' }));
vi.mock('./updates-view-contribution', () => ({
  UPDATES_OPEN_COMMAND_ID: 'gamecrafter.updates.open',
}));

import { ProjectHomeWidget } from './project-home-widget';
import { WorkspaceMenuContribution } from './workspace-menu-contribution';

interface RenderableHome extends ProjectHomeWidget {
  render(): React.ReactNode;
}

function fixture(projects: ProjectSummary[] = []) {
  const commands = { executeCommand: vi.fn() };
  const widget = Object.assign(Object.create(ProjectHomeWidget.prototype), {
    projects,
    engineReports: new Map(),
    serviceStatus: 'Connected to platform service',
    commandService: commands,
  }) as RenderableHome;
  return { widget, commands };
}

function markup(widget: RenderableHome): string {
  return renderToStaticMarkup(React.createElement('div', {}, widget.render()));
}

function collectNavigationButtons(
  node: React.ReactNode,
): Array<React.ReactElement<{ onClick?: () => void }>> {
  const buttons: Array<React.ReactElement<{ onClick?: () => void }>> = [];
  React.Children.forEach(node, (child) => {
    if (!React.isValidElement(child)) return;
    const element = child as React.ReactElement<{
      children?: React.ReactNode;
      className?: string;
      onClick?: () => void;
    }>;
    if (element.props.className?.split(' ').includes('gamecrafter-home-navigation-item'))
      buttons.push(element);
    buttons.push(...collectNavigationButtons(element.props.children));
  });
  return buttons;
}

describe('Project Home navigation and guidance', () => {
  it('adds a grouped menu route for every Home destination without unregistering IDE menus', () => {
    const menus = {
      registerSubmenu: vi.fn(),
      registerMenuAction: vi.fn(),
      unregisterMenuAction: vi.fn(),
    };
    new WorkspaceMenuContribution().registerMenus(menus as unknown as MenuModelRegistry);
    expect(menus.registerSubmenu.mock.calls.map((call) => call[1])).toEqual([
      'PlayWeld',
      'Plan & Collaborate',
      'Build & Connect',
      'Configure & Extend',
      'Review & Maintain',
    ]);
    const actions = menus.registerMenuAction.mock.calls.map(
      (call) => call[1] as { commandId: string },
    );
    const { widget, commands } = fixture();
    for (const button of collectNavigationButtons(widget.render())) button.props.onClick?.();
    const commandIds = actions.map((action) => action.commandId);
    for (const [id] of commands.executeCommand.mock.calls) expect(commandIds).toContain(id);
    expect(new Set(commandIds).size).toBe(19);
    expect(commandIds).toContain('ide-settings');
    expect(commandIds).toContain('open-view');
    expect(commandIds).toContain('gamecrafter.projectHome.toggle');
    expect(commandIds).toContain('gamecrafter.project.create');
    expect(menus.unregisterMenuAction).not.toHaveBeenCalled();
  });

  it('groups all workspace destinations with actionable descriptions and preserves their commands', () => {
    const { widget, commands } = fixture();
    const content = widget.render();
    const html = renderToStaticMarkup(React.createElement('div', {}, content));

    expect(html).toContain('aria-label="Workspace navigation"');
    for (const group of [
      'Build and review',
      'AI and teamwork',
      'Reference and extensions',
      'Workspace',
    ])
      expect(html).toContain(group);
    for (const destination of [
      'Engine',
      'DCC Tools',
      'Assets',
      'Backups',
      'Audit &amp; History',
      'Models',
      'Chat',
      'Skills &amp; Roles',
      'Connections',
      'Discussion Board',
      'Swarm',
      'Knowledge',
      'Plugins',
      'Settings',
      'Updates',
    ])
      expect(html).toContain(destination);
    expect(html).toContain('aria-describedby=');
    expect(html).toContain('Review engine layers, register installations, or connect an editor.');
    expect(html).toContain('Configure MCP servers, credentials, and tool policies.');

    const navigationButtons = collectNavigationButtons(content);
    for (const button of navigationButtons) button.props.onClick?.();
    expect(commands.executeCommand.mock.calls.map(([command]) => command)).toEqual([
      'gamecrafter.engine.open',
      'gamecrafter.dcc.open',
      'gamecrafter.assets.open',
      'gamecrafter.backups.open',
      'gamecrafter.audit.open',
      'gamecrafter.models.open',
      'gamecrafter.chat.open',
      'gamecrafter.skills.open',
      'gamecrafter.connections.open',
      'gamecrafter.board.open',
      'gamecrafter.swarm.open',
      'gamecrafter.knowledge.open',
      'gamecrafter.plugins.open',
      'gamecrafter.settings.open',
      'gamecrafter.updates.open',
    ]);
  });

  it('recommends creating a Project when none exist', () => {
    const { widget, commands } = fixture();
    const content = widget.render();
    const html = renderToStaticMarkup(React.createElement('div', {}, content));

    expect(html).toContain('Create a Project to get its game folder and platform record.');
    expect(html).toContain('id="gamecrafter-home-next-step-title">Create a Project');
    const navigationButtons = collectNavigationButtons(content);
    expect(navigationButtons).toHaveLength(15);
    expect(commands.executeCommand).not.toHaveBeenCalled();
  });

  it('directs existing Projects to the list rather than claiming setup is ready', () => {
    const project = {
      projectId: 'project-1',
      name: 'Test Project',
      path: 'C:/projects/test',
      engine: { family: 'godot' },
      genres: [],
      createdAt: '2026-10-01T00:00:00.000Z',
    } as ProjectSummary;
    const { widget } = fixture([project]);
    const html = markup(widget);

    expect(html).toContain('id="gamecrafter-home-next-step-title">Open a Project to continue');
    expect(html).toContain('Go to Projects');
    expect(html).not.toContain('href="#gamecrafter-home-projects"');
    expect(html).toContain('id="gamecrafter-home-projects"');
    expect(html).not.toContain('Connect the game project');
    expect(html).toContain('Checking layers…');
  });
});

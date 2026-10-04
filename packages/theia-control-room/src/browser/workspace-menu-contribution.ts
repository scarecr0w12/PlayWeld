import { injectable } from '@theia/core/shared/inversify';
import { MAIN_MENU_BAR, MenuContribution, MenuModelRegistry } from '@theia/core/lib/common/menu';
import { CommonCommands } from '@theia/core/lib/browser/common-commands';
import { CREATE_PROJECT_COMMAND_ID } from './create-project-command';
import { PROJECT_HOME_TOGGLE_COMMAND_ID } from './project-home-contribution';
import { CHAT_OPEN_COMMAND_ID } from './chat-view-contribution';
import { SWARM_OPEN_COMMAND_ID } from './swarm-view-contribution';
import { DISCUSSION_BOARD_OPEN_COMMAND_ID } from './discussion-board-view-contribution';
import { ASSETS_OPEN_COMMAND_ID } from './assets-view-contribution';
import { KNOWLEDGE_OPEN_COMMAND_ID } from './knowledge-view-contribution';
import { ENGINE_OPEN_COMMAND_ID } from './engine-view-contribution';
import { DCC_OPEN_COMMAND_ID } from './dcc-view-contribution';
import { CONNECTIONS_OPEN_COMMAND_ID } from './connections-view-contribution';
import { MODELS_OPEN_COMMAND_ID } from './models-view-contribution';
import { SKILLS_OPEN_COMMAND_ID } from './skills-view-contribution';
import { PLUGINS_OPEN_COMMAND_ID } from './plugins-catalog-view-contribution';
import { SETTINGS_OPEN_COMMAND_ID } from './settings-view-contribution';
import { BACKUPS_OPEN_COMMAND_ID } from './backups-view-contribution';
import { AUDIT_OPEN_COMMAND_ID } from './audit-view-contribution';
import { UPDATES_OPEN_COMMAND_ID } from './updates-view-contribution';

/** A stable route to every platform surface without replacing the IDE's menus. */
@injectable()
export class WorkspaceMenuContribution implements MenuContribution {
  registerMenus(menus: MenuModelRegistry): void {
    const root = [...MAIN_MENU_BAR, '5_playweld'];
    menus.registerSubmenu(root, 'PlayWeld');
    menus.registerMenuAction([...root, '0_start'], {
      commandId: PROJECT_HOME_TOGGLE_COMMAND_ID,
      label: 'Project Home',
      order: '0',
    });
    menus.registerMenuAction([...root, '0_start'], {
      commandId: CREATE_PROJECT_COMMAND_ID,
      label: 'Create Project...',
      order: '1',
    });
    const groups = [
      {
        id: '1_work',
        label: 'Plan & Collaborate',
        actions: [
          [CHAT_OPEN_COMMAND_ID, 'Chat'],
          [SWARM_OPEN_COMMAND_ID, 'Swarm'],
          [DISCUSSION_BOARD_OPEN_COMMAND_ID, 'Discussion Board'],
          [KNOWLEDGE_OPEN_COMMAND_ID, 'Knowledge & Canon'],
        ],
      },
      {
        id: '2_create',
        label: 'Build & Connect',
        actions: [
          [ASSETS_OPEN_COMMAND_ID, 'Assets'],
          [ENGINE_OPEN_COMMAND_ID, 'Engine'],
          [DCC_OPEN_COMMAND_ID, 'Creative Tools'],
          [CONNECTIONS_OPEN_COMMAND_ID, 'Tool Connections'],
        ],
      },
      {
        id: '3_extend',
        label: 'Configure & Extend',
        actions: [
          [MODELS_OPEN_COMMAND_ID, 'Models & Routing'],
          [SKILLS_OPEN_COMMAND_ID, 'Skills'],
          [PLUGINS_OPEN_COMMAND_ID, 'Plugins'],
          [SETTINGS_OPEN_COMMAND_ID, 'PlayWeld Settings'],
          [CommonCommands.OPEN_PREFERENCES.id, 'IDE Settings'],
          [CommonCommands.OPEN_VIEW.id, 'Open IDE View...'],
        ],
      },
      {
        id: '4_maintain',
        label: 'Review & Maintain',
        actions: [
          [BACKUPS_OPEN_COMMAND_ID, 'Backups'],
          [AUDIT_OPEN_COMMAND_ID, 'Audit Log'],
          [UPDATES_OPEN_COMMAND_ID, 'Updates'],
        ],
      },
    ];
    for (const group of groups) {
      const path = [...root, group.id];
      menus.registerSubmenu(path, group.label);
      group.actions.forEach(([commandId, label], index) => {
        menus.registerMenuAction(path, { commandId, label, order: String(index) });
      });
    }
  }
}

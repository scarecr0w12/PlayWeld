import { injectable } from '@theia/core/shared/inversify';
import { CommonMenus } from '@theia/core/lib/browser/common-menus';
import { AbstractViewContribution } from '@theia/core/lib/browser/shell/view-contribution';
import { CommandRegistry } from '@theia/core/lib/common/command';
import { MenuModelRegistry } from '@theia/core/lib/common/menu';
import { DiscussionBoardWidget } from './discussion-board-widget';

export const DISCUSSION_BOARD_OPEN_COMMAND_ID = 'gamecrafter.board.open';

@injectable()
export class DiscussionBoardViewContribution extends AbstractViewContribution<DiscussionBoardWidget> {
  constructor() {
    super({
      widgetId: DiscussionBoardWidget.ID,
      widgetName: 'Discussion Board',
      defaultWidgetOptions: { area: 'main' },
    });
  }

  registerCommands(commands: CommandRegistry): void {
    commands.registerCommand(
      { id: DISCUSSION_BOARD_OPEN_COMMAND_ID, label: 'PlayWeld: Open Discussion Board' },
      {
        execute: async (selection?: { projectId: string; threadId: string }) => {
          const widget = await this.openView({ activate: true, reveal: true });
          if (selection?.projectId && selection.threadId) await widget.revealThread(selection);
          return widget;
        },
      },
    );
  }

  registerMenus(menus: MenuModelRegistry): void {
    menus.registerMenuAction(CommonMenus.VIEW_VIEWS, {
      commandId: DISCUSSION_BOARD_OPEN_COMMAND_ID,
      label: 'PlayWeld: Open Discussion Board',
    });
  }
}

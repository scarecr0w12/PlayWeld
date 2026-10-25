import { injectable } from '@theia/core/shared/inversify';
import { AbstractViewContribution } from '@theia/core/lib/browser/shell/view-contribution';
import type { CommandRegistry } from '@theia/core/lib/common/command';
import { RequestsWidget } from './requests-widget';
import { REQUESTS_OPEN_COMMAND_ID } from './requests-model';

@injectable()
export class RequestsViewContribution extends AbstractViewContribution<RequestsWidget> {
  constructor() {
    super({
      widgetId: RequestsWidget.ID,
      widgetName: 'Requests',
      defaultWidgetOptions: { area: 'main' },
    });
  }
  registerCommands(commands: CommandRegistry): void {
    commands.registerCommand(
      { id: REQUESTS_OPEN_COMMAND_ID, label: 'PlayWeld: Open Requests' },
      { execute: () => this.openView({ activate: true, reveal: true }) },
    );
  }
}

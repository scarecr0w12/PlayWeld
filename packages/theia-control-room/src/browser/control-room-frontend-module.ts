import { ContainerModule } from '@theia/core/shared/inversify';
import { CommandContribution, MenuContribution } from '@theia/core/lib/common';
import { ServiceConnectionProvider } from '@theia/core/lib/browser/messaging/service-connection-provider';
import { FrontendApplicationContribution } from '@theia/core/lib/browser/frontend-application-contribution';
import { bindViewContribution } from '@theia/core/lib/browser/shell/view-contribution';
import { WidgetFactory } from '@theia/core/lib/browser/widget-manager';
import { ControlRoomService, CONTROL_ROOM_SERVICE_PATH } from '../common/control-room-protocol';
import { ControlRoomClientEvents, ControlRoomClientToken } from './control-room-client';
import { CreateProjectCommand } from './create-project-command';
import { ProjectHomeContribution } from './project-home-contribution';
import { ProjectHomeWidget } from './project-home-widget';
import { ModelsWidget } from './models-widget';
import { ModelsViewContribution } from './models-view-contribution';
import { SkillsWidget } from './skills-widget';
import { SkillsViewContribution } from './skills-view-contribution';
import { ConnectionsWidget } from './connections-widget';
import { ConnectionsViewContribution } from './connections-view-contribution';
import { DiscussionBoardWidget } from './discussion-board-widget';
import { DiscussionBoardViewContribution } from './discussion-board-view-contribution';
import { PluginsCatalogWidget } from './plugins-catalog-widget';
import { PluginsCatalogViewContribution } from './plugins-catalog-view-contribution';
import { EngineWidget } from './engine-widget';
import { EngineViewContribution } from './engine-view-contribution';
import { DccWidget } from './dcc-widget';
import { DccViewContribution } from './dcc-view-contribution';
import { AssetsWidget } from './assets-widget';
import { AssetsViewContribution } from './assets-view-contribution';
import { BackupsWidget } from './backups-widget';
import { BackupsViewContribution } from './backups-view-contribution';
import { KnowledgeWidget } from './knowledge-widget';
import { KnowledgeViewContribution } from './knowledge-view-contribution';
import { SwarmWidget } from './swarm-widget';
import { SwarmViewContribution } from './swarm-view-contribution';
import { UpdatesWidget } from './updates-widget';
import { UpdatesViewContribution } from './updates-view-contribution';
import { ChatWidget } from './chat-widget';
import { ChatViewContribution } from './chat-view-contribution';
import { GameCrafterSettingsWidget } from './settings-widget';
import { SettingsViewContribution } from './settings-view-contribution';
import { TaskQuestionHandler } from './task-question-handler';
import { ToolApprovalHandler } from './tool-approval-handler';
import { AuditWidget } from './audit-widget';
import { AuditViewContribution } from './audit-view-contribution';
import { GameCrafterThemeContribution } from './theme-contribution';
import { PlayWeldBrandContribution } from './brand-contribution';
import { WorkspaceMenuContribution } from './workspace-menu-contribution';
import '../../src/browser/style/index.css';
import '../../src/browser/style/workstation.css';

export default new ContainerModule((bind) => {
  bind(FrontendApplicationContribution).to(GameCrafterThemeContribution).inSingletonScope();
  bind(FrontendApplicationContribution).to(PlayWeldBrandContribution).inSingletonScope();
  bind(MenuContribution).to(WorkspaceMenuContribution).inSingletonScope();
  bind(ControlRoomClientEvents).toSelf().inSingletonScope();
  bind(ControlRoomClientToken).toService(ControlRoomClientEvents);
  bind(ControlRoomService)
    .toDynamicValue(({ container }) =>
      ServiceConnectionProvider.createProxy<ControlRoomService>(
        container,
        CONTROL_ROOM_SERVICE_PATH,
        container.get(ControlRoomClientToken),
      ),
    )
    .inSingletonScope();

  bind(AuditWidget).toSelf();
  bind(WidgetFactory)
    .toDynamicValue((context) => ({
      id: AuditWidget.ID,
      createWidget: () => context.container.get(AuditWidget),
    }))
    .inSingletonScope();
  bindViewContribution(bind, AuditViewContribution);
  bind(ProjectHomeWidget).toSelf();
  bind(GameCrafterSettingsWidget).toSelf();
  bind(ModelsWidget).toSelf();
  bind(SkillsWidget).toSelf();
  bind(ConnectionsWidget).toSelf();
  bind(DiscussionBoardWidget).toSelf();
  bind(PluginsCatalogWidget).toSelf();
  bind(EngineWidget).toSelf();
  bind(DccWidget).toSelf();
  bind(AssetsWidget).toSelf();
  bind(BackupsWidget).toSelf();
  bind(KnowledgeWidget).toSelf();
  bind(SwarmWidget).toSelf();
  bind(UpdatesWidget).toSelf();
  bind(ChatWidget).toSelf();
  bind(WidgetFactory)
    .toDynamicValue((context) => ({
      id: ChatWidget.ID,
      createWidget: () => context.container.get(ChatWidget),
    }))
    .inSingletonScope();
  bind(WidgetFactory)
    .toDynamicValue((context) => ({
      id: ProjectHomeWidget.ID,
      createWidget: () => context.container.get(ProjectHomeWidget),
    }))
    .inSingletonScope();
  bind(WidgetFactory)
    .toDynamicValue((context) => ({
      id: UpdatesWidget.ID,
      createWidget: () => context.container.get(UpdatesWidget),
    }))
    .inSingletonScope();
  bind(WidgetFactory)
    .toDynamicValue((context) => ({
      id: GameCrafterSettingsWidget.ID,
      createWidget: () => context.container.get(GameCrafterSettingsWidget),
    }))
    .inSingletonScope();
  bind(WidgetFactory)
    .toDynamicValue((context) => ({
      id: ModelsWidget.ID,
      createWidget: () => context.container.get(ModelsWidget),
    }))
    .inSingletonScope();
  bind(WidgetFactory)
    .toDynamicValue((context) => ({
      id: SkillsWidget.ID,
      createWidget: () => context.container.get(SkillsWidget),
    }))
    .inSingletonScope();
  bind(WidgetFactory)
    .toDynamicValue((context) => ({
      id: ConnectionsWidget.ID,
      createWidget: () => context.container.get(ConnectionsWidget),
    }))
    .inSingletonScope();
  bind(WidgetFactory)
    .toDynamicValue((context) => ({
      id: DiscussionBoardWidget.ID,
      createWidget: () => context.container.get(DiscussionBoardWidget),
    }))
    .inSingletonScope();
  bind(WidgetFactory)
    .toDynamicValue((context) => ({
      id: PluginsCatalogWidget.ID,
      createWidget: () => context.container.get(PluginsCatalogWidget),
    }))
    .inSingletonScope();
  bind(WidgetFactory)
    .toDynamicValue((context) => ({
      id: EngineWidget.ID,
      createWidget: () => context.container.get(EngineWidget),
    }))
    .inSingletonScope();
  bind(WidgetFactory)
    .toDynamicValue((context) => ({
      id: DccWidget.ID,
      createWidget: () => context.container.get(DccWidget),
    }))
    .inSingletonScope();
  bind(WidgetFactory)
    .toDynamicValue((context) => ({
      id: AssetsWidget.ID,
      createWidget: () => context.container.get(AssetsWidget),
    }))
    .inSingletonScope();
  bind(WidgetFactory)
    .toDynamicValue((context) => ({
      id: BackupsWidget.ID,
      createWidget: () => context.container.get(BackupsWidget),
    }))
    .inSingletonScope();
  bind(WidgetFactory)
    .toDynamicValue((context) => ({
      id: KnowledgeWidget.ID,
      createWidget: () => context.container.get(KnowledgeWidget),
    }))
    .inSingletonScope();
  bind(WidgetFactory)
    .toDynamicValue((context) => ({
      id: SwarmWidget.ID,
      createWidget: () => context.container.get(SwarmWidget),
    }))
    .inSingletonScope();
  bindViewContribution(bind, ProjectHomeContribution);
  bind(FrontendApplicationContribution).toService(ProjectHomeContribution);
  bindViewContribution(bind, SettingsViewContribution);
  bindViewContribution(bind, ModelsViewContribution);
  bindViewContribution(bind, SkillsViewContribution);
  bindViewContribution(bind, ConnectionsViewContribution);
  bindViewContribution(bind, DiscussionBoardViewContribution);
  bindViewContribution(bind, PluginsCatalogViewContribution);
  bindViewContribution(bind, EngineViewContribution);
  bindViewContribution(bind, DccViewContribution);
  bindViewContribution(bind, AssetsViewContribution);
  bindViewContribution(bind, BackupsViewContribution);
  bindViewContribution(bind, KnowledgeViewContribution);
  bindViewContribution(bind, SwarmViewContribution);
  bindViewContribution(bind, UpdatesViewContribution);
  bindViewContribution(bind, ChatViewContribution);
  bind(TaskQuestionHandler).toSelf().inSingletonScope();
  bind(FrontendApplicationContribution).toService(TaskQuestionHandler);
  bind(ToolApprovalHandler).toSelf().inSingletonScope();
  bind(FrontendApplicationContribution).toService(ToolApprovalHandler);

  bind(CreateProjectCommand).toSelf().inSingletonScope();
  bind(CommandContribution).toService(CreateProjectCommand);
  bind(MenuContribution).toService(CreateProjectCommand);
});

import { inject, injectable } from '@theia/core/shared/inversify';
import { CommandContribution, CommandRegistry } from '@theia/core/lib/common/command';
import { MenuContribution, MenuModelRegistry } from '@theia/core/lib/common/menu';
import { MessageService } from '@theia/core/lib/common/message-service';
import { CommonMenus } from '@theia/core/lib/browser/common-menus';
import { QuickInputService } from '@theia/core/lib/common/quick-pick-service';
import { RpcError } from '@gamecrafter/contracts';
import { engineChoices, parseGenres } from '../common/create-project-form';
import { ControlRoomService } from '../common/control-room-protocol';

export const CREATE_PROJECT_COMMAND_ID = 'gamecrafter.project.create';

@injectable()
export class CreateProjectCommand implements CommandContribution, MenuContribution {
  constructor(
    @inject(QuickInputService)
    private readonly quickInput: QuickInputService,
    @inject(ControlRoomService)
    private readonly controlRoomService: ControlRoomService,
    @inject(MessageService)
    private readonly messageService: MessageService,
  ) {}

  registerCommands(commands: CommandRegistry): void {
    commands.registerCommand(
      { id: CREATE_PROJECT_COMMAND_ID, label: 'PlayWeld: Create Project' },
      { execute: () => this.createProject() },
    );
  }

  registerMenus(menus: MenuModelRegistry): void {
    menus.registerMenuAction(CommonMenus.FILE, {
      commandId: CREATE_PROJECT_COMMAND_ID,
      label: 'PlayWeld: Create Project',
    });
  }

  private async createProject(): Promise<void> {
    try {
      const nameInput = await this.quickInput.input({
        title: 'Create Project (1/6)',
        prompt: 'Project name',
        placeHolder: 'A short, recognizable name for your game',
        validateInput: async (value) => (value.trim() ? undefined : 'Project name is required'),
      });
      if (nameInput === undefined) return;
      const name = nameInput.trim();
      if (!name) return;

      const description = await this.quickInput.input({
        title: 'Create Project (2/6)',
        prompt: 'Description (optional)',
        placeHolder: 'Describe the game or the idea you want to explore',
      });
      if (description === undefined) return;

      const engine = await this.quickInput.showQuickPick(
        engineChoices.map((choice) => ({
          ...choice,
          detail: 'The engine cannot be changed after the Project is created.',
        })),
        { title: 'Create Project (3/6)', prompt: 'Choose an engine', step: 3, totalSteps: 6 },
      );
      if (!engine) return;

      const genresInput = await this.quickInput.input({
        title: 'Create Project (4/6)',
        prompt: 'Genres, separated by commas (optional)',
        placeHolder: 'For example: adventure, puzzle',
      });
      if (genresInput === undefined) return;

      const defaultDirectory = await this.controlRoomService.getDefaultProjectsDirectory();
      const parentDirectory = await this.quickInput.input({
        title: 'Create Project (5/6)',
        prompt: 'Parent directory. PlayWeld creates a new Project folder here.',
        value: defaultDirectory,
        validateInput: async (value) => (value.trim() ? undefined : 'Parent directory is required'),
      });
      if (parentDirectory === undefined || !parentDirectory.trim()) return;

      const confirmation = await this.quickInput.showQuickPick(
        [
          {
            label: `Create '${name}'`,
            description: engine.label,
            detail: `Folder: ${parentDirectory.trim()} | Engine choice is permanent.`,
            create: true,
          },
          { label: 'Cancel', detail: 'No Project files will be created.', create: false },
        ],
        {
          title: 'Create Project (6/6)',
          prompt: 'Confirm Project creation',
          step: 6,
          totalSteps: 6,
        },
      );
      if (!confirmation?.create) return;

      const project = await this.controlRoomService.createProject({
        name,
        description: description.trim(),
        engine: { family: engine.family },
        genres: parseGenres(genresInput),
        parentDirectory: parentDirectory.trim(),
      });
      await this.messageService.info(`Created Project ${project.name}`);
    } catch (error) {
      const message =
        error instanceof RpcError
          ? error.message
          : error instanceof Error
            ? error.message
            : String(error);
      await this.messageService.error(message);
    }
  }
}

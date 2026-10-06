import { inject, injectable } from '@theia/core/shared/inversify';
import type { CancellationToken } from '@theia/core/lib/common/cancellation';
import type {
  LanguageModel,
  LanguageModelResponse,
  UserRequest,
} from '@theia/ai-core/lib/common/language-model';
import { WorkspaceService } from '@theia/workspace/lib/browser/workspace-service';
import { ControlRoomService } from '../common/control-room-protocol';
import { requestThroughPlayWeld } from '../common/theia-model-adapter';
import { WorkspaceProjectSelection } from './workspace-project-selection';

@injectable()
export class PlayWeldTheiaModel implements LanguageModel {
  readonly id = 'playweld/router';
  readonly name = 'PlayWeld Project model router';
  readonly vendor = 'PlayWeld';
  readonly family = 'PlayWeld';
  readonly status = {
    status: 'ready' as const,
    message: 'Requests use the selected Project model pools and service access policy.',
  };
  constructor(
    @inject(ControlRoomService) private readonly service: ControlRoomService,
    @inject(WorkspaceService) private readonly workspace: WorkspaceService,
  ) {}

  async project(explicit?: unknown): Promise<string> {
    const projects = await this.service.listProjects();
    if (explicit !== undefined) {
      if (
        typeof explicit !== 'string' ||
        !projects.some((project) => project.projectId === explicit)
      )
        throw new Error('Explicit Theia Project is not registered.');
      return explicit;
    }
    await this.workspace.ready;
    const roots = await this.workspace.roots;
    return new WorkspaceProjectSelection().resolve(
      projects,
      roots.map((root) => root.resource.path.fsPath()),
    );
  }
  request(
    request: UserRequest,
    cancellationToken?: CancellationToken,
  ): Promise<LanguageModelResponse> {
    return requestThroughPlayWeld(
      this.service,
      (explicit) => this.project(explicit),
      request,
      () => cancellationToken?.isCancellationRequested ?? false,
    );
  }
}

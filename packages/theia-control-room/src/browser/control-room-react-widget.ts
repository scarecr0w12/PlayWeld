import { inject, injectable } from '@theia/core/shared/inversify';
import { WorkspaceService } from '@theia/workspace/lib/browser/workspace-service';
import type { ProjectSummary } from '@gamecrafter/contracts';
import { WorkspaceProjectSelection } from './workspace-project-selection';
import { Widget } from '@theia/core/lib/browser/widgets/widget';
import { ReactWidget } from '@theia/core/lib/browser/widgets/react-widget';
import { flushSync } from 'react-dom';

/** Keep field-backed controlled inputs in sync before React restores their DOM values. */
@injectable()
export abstract class ControlRoomReactWidget extends ReactWidget {
  @inject(WorkspaceService)
  protected readonly projectWorkspaceService!: WorkspaceService;
  private readonly workspaceProjectSelection = new WorkspaceProjectSelection();
  private projectSelectionQueue: Promise<void> = Promise.resolve();

  constructor() {
    super();
    this.addClass('gamecrafter-surface-widget');
  }

  override update(): void {
    if (this.isDisposed) return;
    // Widget.update() queues a Lumino message. That is too late for React's
    // controlled input event handling, which restores values when the event ends.
    flushSync(() => this.onUpdateRequest(Widget.Msg.UpdateRequest));
  }

  protected resolveProjectSelection(
    projects: readonly ProjectSummary[],
    current: () => string | undefined,
  ): Promise<string> {
    // Constructor and activation refreshes can overlap during layout restoration.
    // Serialize selection and read the field after waiting, so the second refresh
    // observes the first selection rather than treating it as an explicit empty choice.
    const selection = this.projectSelectionQueue.then(async () => {
      await this.projectWorkspaceService.ready;
      const roots = await this.projectWorkspaceService.roots;
      return this.workspaceProjectSelection.resolve(
        projects,
        roots.map((root) => root.resource.path.fsPath()),
        current(),
      );
    });
    this.projectSelectionQueue = selection.then(
      () => undefined,
      () => undefined,
    );
    return selection;
  }

  protected markProjectSelection(): void {
    this.workspaceProjectSelection.markExplicit();
  }
}

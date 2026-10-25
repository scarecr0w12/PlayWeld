import { inject, injectable } from '@theia/core/shared/inversify';
import { Emitter } from '@theia/core/lib/common/event';
import { DisposableCollection } from '@theia/core/lib/common/disposable';
import { MessageService } from '@theia/core/lib/common/message-service';
import { CommandService } from '@theia/core/lib/common/command';
import type { FrontendApplicationContribution } from '@theia/core/lib/browser/frontend-application-contribution';
import type { PendingInput, PendingInputs } from '@gamecrafter/contracts';
import {
  ControlRoomService,
  type ControlRoomService as ServiceApi,
} from '../common/control-room-protocol';
import { ControlRoomClientEvents } from './control-room-client';

export const REQUESTS_OPEN_COMMAND_ID = 'gamecrafter.requests.open';
export const requestKey = (item: PendingInput): string =>
  `${item.projectId}:${item.kind}:${item.kind === 'approval' ? item.approval.approvalId : item.question.questionId}`;

/** Transient service projection and form-operation state, never a durable queue. */
@injectable()
export class RequestsModel implements FrontendApplicationContribution {
  readonly changedEmitter = new Emitter<void>();
  readonly changed = this.changedEmitter.event;
  snapshot?: PendingInputs;
  loading = false;
  available = false;
  error?: string;
  actionError?: string;
  readonly busy = new Set<string>();
  private readonly subscriptions = new DisposableCollection();
  private timer?: ReturnType<typeof setTimeout>;
  private poll?: ReturnType<typeof setInterval>;
  private generation = 0;
  private disposed = false;
  private notificationOpen = false;
  private dirty = false;
  private seen = new Set<string>();

  constructor(
    @inject(ControlRoomService) private readonly service: ServiceApi,
    @inject(ControlRoomClientEvents) events: ControlRoomClientEvents,
    @inject(MessageService) private readonly messages: MessageService,
    @inject(CommandService) private readonly commands: CommandService,
  ) {
    this.subscriptions.push(events.approvalRequested(() => this.schedule()));
    this.subscriptions.push(events.approvalResolved(() => this.schedule()));
    this.subscriptions.push(events.taskQuestion(() => this.schedule()));
    this.subscriptions.push(events.projectChanged(() => this.schedule()));
    this.subscriptions.push(
      events.taskChanged((event) => {
        if (
          event.task.state === 'waiting_input' ||
          this.snapshot?.inputs.some((item) => item.taskId === event.task.taskId)
        )
          this.schedule();
      }),
    );
    this.subscriptions.push(
      events.serviceStatus((event) => {
        if (event.connected) this.schedule();
        else {
          this.generation++;
          this.loading = false;
          this.available = false;
          this.error = 'Platform service disconnected. Reconnect or refresh before responding.';
          this.changedEmitter.fire();
        }
      }),
    );
  }

  onStart(): void {
    void this.refresh();
    this.poll = setInterval(() => this.schedule(), 10_000);
  }
  onStop(): void {
    this.disposed = true;
    this.generation++;
    clearTimeout(this.timer);
    clearInterval(this.poll);
    this.subscriptions.dispose();
    this.changedEmitter.dispose();
  }
  private schedule(): void {
    if (this.disposed) return;
    if (this.loading) {
      this.dirty = true;
      return;
    }
    if (this.timer !== undefined) return;
    this.timer = setTimeout(() => {
      this.timer = undefined;
      void this.refresh();
    }, 75);
  }
  async refresh(): Promise<void> {
    if (this.disposed) return;
    if (this.loading) {
      this.dirty = true;
      return;
    }
    clearTimeout(this.timer);
    this.timer = undefined;
    this.dirty = false;
    const generation = ++this.generation;
    this.loading = true;
    this.changedEmitter.fire();
    try {
      const snapshot = await this.service.pendingInputs();
      if (this.disposed || generation !== this.generation) return;
      const keys = new Set(snapshot.inputs.map(requestKey));
      const added = [...keys].some((key) => !this.seen.has(key));
      this.snapshot = snapshot;
      this.seen = keys;
      this.available = true;
      this.error = undefined;
      if (added && !this.notificationOpen) {
        this.notificationOpen = true;
        void this.messages
          .info(
            'Requests need your attention. Review pending approvals and task questions.',
            { timeout: 8000 },
            'Review requests',
          )
          .then((answer) => {
            if (answer === 'Review requests' && !this.disposed)
              return this.commands.executeCommand(REQUESTS_OPEN_COMMAND_ID);
          })
          .catch((error) => {
            if (!this.disposed) {
              this.actionError = String(error);
              this.changedEmitter.fire();
            }
          })
          .finally(() => {
            this.notificationOpen = false;
          });
      }
    } catch (error) {
      if (generation === this.generation && !this.disposed) {
        this.available = false;
        this.error = error instanceof Error ? error.message : String(error);
      }
    } finally {
      if (generation === this.generation && !this.disposed) {
        this.loading = false;
        this.changedEmitter.fire();
        if (this.dirty) this.schedule();
      }
    }
  }
  async decide(key: string, approved: boolean): Promise<void> {
    await this.respond(key, async (item) => {
      if (item.kind !== 'approval') throw new Error('Select an approval request.');
      await this.service.approve(
        item.projectId,
        item.approval.approvalId,
        approved,
        `Selected ${approved ? 'Approve' : 'Reject'} in Requests`,
      );
    });
  }
  async answer(key: string, answer: string): Promise<void> {
    await this.respond(key, async (item) => {
      if (item.kind !== 'question') throw new Error('Select a task question.');
      if (!item.question.options?.length ? !answer.trim() : !item.question.options.includes(answer))
        throw new Error('Provide a valid answer for this question.');
      await this.service.answerQuestion(
        item.projectId,
        item.question.taskId,
        item.question.questionId,
        answer,
      );
    });
  }
  private async respond(key: string, action: (item: PendingInput) => Promise<void>): Promise<void> {
    if (this.disposed || !this.available || this.loading || this.busy.has(key)) return;
    const item = this.snapshot?.inputs.find((item) => requestKey(item) === key);
    if (!item) return;
    this.busy.add(key);
    this.actionError = undefined;
    this.changedEmitter.fire();
    try {
      await action(item);
    } catch (error) {
      this.actionError = error instanceof Error ? error.message : String(error);
    } finally {
      await this.refresh();
      this.busy.delete(key);
      if (!this.disposed) this.changedEmitter.fire();
    }
  }
}

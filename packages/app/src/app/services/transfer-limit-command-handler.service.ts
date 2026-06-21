import { DestroyRef, Injectable, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { TranslateService } from '@ngx-translate/core';
import { EMPTY, catchError, exhaustMap, filter, from } from 'rxjs';
import { AppCommand, TransferLimitCommand } from '../models/command.model';
import { CommandBusService } from './command-bus.service';
import { QbService } from './qb.service';
import { ServerStoreService } from './server-store.service';
import { ToastService } from './toast.service';

@Injectable({ providedIn: 'root' })
export class TransferLimitCommandHandlerService {
  private readonly commandBusService = inject(CommandBusService);
  private readonly toastService = inject(ToastService);
  private readonly qbService = inject(QbService);
  private readonly serverStoreService = inject(ServerStoreService);
  private readonly translateService = inject(TranslateService);
  private readonly destroyRef = inject(DestroyRef);

  public start(): void {
    this.commandBusService.commands$
      .pipe(
        filter(this.transferLimitCommandGuard),
        exhaustMap((command: TransferLimitCommand) =>
          from(this.handleCommand(command)).pipe(
            catchError((err) => {
              console.error(TransferLimitCommandHandlerService.name, 'start', err);
              return EMPTY;
            }),
          ),
        ),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe();
  }

  private async handleCommand(command: TransferLimitCommand): Promise<void> {
    switch (command.type) {
      case 'TRANSFER_LIMIT_ALTERNATIVE_TOGGLE':
        await this.handleToggle();
        break;
      default:
        console.warn(
          TransferLimitCommandHandlerService.name,
          'handleCommand',
          'Unhandled command',
          command,
        );
    }
  }

  private async handleToggle(): Promise<void> {
    const serverId = this.serverStoreService.currentServerId() as string;
    const state = await this.qbService.transfer.speedLimitsMode(serverId);
    const key = state
      ? 'services.transfer-limit-command-handler.info.alternative-limit-off'
      : 'services.transfer-limit-command-handler.info.alternative-limit-on';
    this.toastService.info(this.translateService.instant(key));
    await this.qbService.transfer.toggleSpeedLimitsMode(serverId);
  }

  private transferLimitCommandGuard(cmd: AppCommand): cmd is TransferLimitCommand {
    return cmd.type.startsWith('TRANSFER_');
  }
}

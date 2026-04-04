import { DestroyRef, inject, Injectable } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { filter } from 'rxjs';
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
  private readonly destroyRef = inject(DestroyRef);

  public start(): void {
    this.commandBusService.commands$
      .pipe(filter(this.transferLimitCommandGuard), takeUntilDestroyed(this.destroyRef))
      .subscribe(async (command: AppCommand): Promise<void> => {
        switch (command.type) {
          case 'TRANSFER_LIMIT_ALTERNATIVE_TOGGLE':
            const state = await this.qbService.getAlternativeSpeedLimitState(
              this.serverStoreService.currentServerId() as string,
            );

            this.toastService.info('Turning alternative speed limit ' + (state ? 'OFF' : 'ON'));
            this.qbService.toggleAlternativeSpeedLimit(
              this.serverStoreService.currentServerId() as string,
            );
            break;

          default:
            console.warn('Unhandled UI command', command);
        }
      });
  }

  private transferLimitCommandGuard(cmd: AppCommand): cmd is TransferLimitCommand {
    return cmd.type.startsWith('TRANSFER_');
  }
}

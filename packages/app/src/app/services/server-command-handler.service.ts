import { DestroyRef, Injectable, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { TranslateService } from '@ngx-translate/core';
import { EMPTY, catchError, concatMap, filter, from } from 'rxjs';
import { AppCommand, ServerCommand } from '../models/command.model';
import { CommandBusService } from './command-bus.service';
import { ServerStoreService } from './server-store.service';
import { ServerService } from './server.service';
import { ToastService } from './toast.service';

@Injectable({ providedIn: 'root' })
export class ServerCommandHandlerService {
  private readonly commandBusService = inject(CommandBusService);
  private readonly serverStoreService = inject(ServerStoreService);
  private readonly serverService = inject(ServerService);
  private readonly toastService = inject(ToastService);
  private readonly translateService = inject(TranslateService);
  private readonly destroyRef = inject(DestroyRef);

  public start(): void {
    this.commandBusService.commands$
      .pipe(
        filter((cmd: AppCommand): cmd is ServerCommand => cmd.type.startsWith('SERVER_')),
        concatMap((command) =>
          from(this.handleCommand(command)).pipe(
            catchError((err) => {
              console.error(ServerCommandHandlerService.name, 'start', err);
              return EMPTY;
            }),
          ),
        ),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe();
  }

  private async handleCommand(command: ServerCommand): Promise<void> {
    switch (command.type) {
      case 'SERVER_ADDED':
        await this.handleServerAdded(command.id);
        break;
      case 'SERVER_UPDATED':
        await this.handleServerUpdated(command.id);
        break;
      case 'SERVER_DELETED':
        await this.handleServerDeleted(command.id);
        break;
    }
  }

  private async handleServerAdded(id: string): Promise<void> {
    await this.serverStoreService.refresh();
    const server = this.serverStoreService.servers().find((s) => s.id === id);
    const message = server?.name
      ? this.translateService.instant('services.server-command-handler.success.added', {
          name: server.name,
        })
      : this.translateService.instant('services.server-command-handler.success.added-fallback');
    this.toastService.success(message);
    if (!this.serverStoreService.currentServerId()) {
      this.serverStoreService.select(id);
    }
  }

  private async handleServerUpdated(id: string): Promise<void> {
    await this.serverStoreService.refresh();
    const server = this.serverStoreService.servers().find((s) => s.id === id);
    this.toastService.info(
      this.translateService.instant('services.server-command-handler.info.updated', {
        name: server?.name,
      }),
    );
  }

  private async handleServerDeleted(id: string): Promise<void> {
    const server = this.serverStoreService.servers().find((s) => s.id === id);
    await this.serverService.delete(id);
    await this.serverStoreService.refresh();
    this.toastService.info(
      this.translateService.instant('services.server-command-handler.info.deleted', {
        name: server?.name,
      }),
    );
  }
}

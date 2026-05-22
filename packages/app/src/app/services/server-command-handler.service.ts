import { DestroyRef, Injectable, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
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
    this.toastService.success(`Server ${server?.name || 'New Host'} added!`);
    if (!this.serverStoreService.currentServerId()) {
      this.serverStoreService.select(id);
    }
  }

  private async handleServerUpdated(id: string): Promise<void> {
    await this.serverStoreService.refresh();
    const server = this.serverStoreService.servers().find((s) => s.id === id);
    this.toastService.info(`Server ${server?.name} updated!`);
  }

  private async handleServerDeleted(id: string): Promise<void> {
    const server = this.serverStoreService.servers().find((s) => s.id === id);
    await this.serverService.delete(id);
    await this.serverStoreService.refresh();
    this.toastService.info(`Server ${server?.name} deleted.`);
  }
}

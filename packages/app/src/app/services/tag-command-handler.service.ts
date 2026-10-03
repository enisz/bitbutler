import { DestroyRef, Injectable, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { TranslateService } from '@ngx-translate/core';
import { EMPTY, catchError, concatMap, filter, from } from 'rxjs';
import { AppCommand, TagCommand } from '../models/command.model';
import { CommandBusService } from './command-bus.service';
import { ToastService } from './toast.service';

@Injectable({ providedIn: 'root' })
export class TagCommandHandlerService {
  private readonly commandBusService = inject(CommandBusService);
  private readonly toastService = inject(ToastService);
  private readonly translateService = inject(TranslateService);
  private readonly destroyRef = inject(DestroyRef);

  public start(): void {
    this.commandBusService.commands$
      .pipe(
        filter((cmd: AppCommand): cmd is TagCommand => cmd.type.startsWith('TAG_')),
        concatMap((command) =>
          from(this.handleCommand(command)).pipe(
            catchError((err) => {
              console.error(TagCommandHandlerService.name, 'start', err);
              return EMPTY;
            }),
          ),
        ),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe();
  }

  private async handleCommand(command: TagCommand): Promise<void> {
    switch (command.type) {
      case 'TAG_ADDED':
        this.handleTagAdded(command.names);
        break;
      case 'TAG_DELETED':
        this.handleTagDeleted(command.names);
        break;
    }
  }

  private handleTagAdded(names: string[]): void {
    this.toastService.success(
      `"${names.join(', ')}"`,
      this.translateService.instant('services.tag-command-handler.success.added-title'),
    );
  }

  private handleTagDeleted(names: string[]): void {
    this.toastService.info(
      `"${names.join(', ')}"`,
      this.translateService.instant('services.tag-command-handler.info.deleted-title'),
    );
  }
}

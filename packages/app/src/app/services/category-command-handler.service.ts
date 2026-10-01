import { DestroyRef, Injectable, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { TranslateService } from '@ngx-translate/core';
import { EMPTY, catchError, concatMap, filter, from } from 'rxjs';
import { AppCommand, CategoryCommand } from '../models/command.model';
import { CommandBusService } from './command-bus.service';
import { ToastService } from './toast.service';

@Injectable({ providedIn: 'root' })
export class CategoryCommandHandlerService {
  private readonly commandBusService = inject(CommandBusService);
  private readonly toastService = inject(ToastService);
  private readonly translateService = inject(TranslateService);
  private readonly destroyRef = inject(DestroyRef);

  public start(): void {
    this.commandBusService.commands$
      .pipe(
        filter((cmd: AppCommand): cmd is CategoryCommand => cmd.type.startsWith('CATEGORY_')),
        concatMap((command) =>
          from(this.handleCommand(command)).pipe(
            catchError((err) => {
              console.error(CategoryCommandHandlerService.name, 'start', err);
              return EMPTY;
            }),
          ),
        ),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe();
  }

  private async handleCommand(command: CategoryCommand): Promise<void> {
    switch (command.type) {
      case 'CATEGORY_ADDED':
        this.handleCategoryAdded(command.name);
        break;
      case 'CATEGORY_DELETED':
        this.handleCategoryDeleted(command.names);
        break;
      case 'CATEGORY_UPDATED':
        // No toast: the inline-edited save-path cell already shows the new value.
        break;
    }
  }

  private handleCategoryAdded(name: string): void {
    this.toastService.success(
      `"${name}"`,
      this.translateService.instant('services.category-command-handler.success.added-title'),
    );
  }

  private handleCategoryDeleted(names: string[]): void {
    this.toastService.info(
      `"${names.join(', ')}"`,
      this.translateService.instant('services.category-command-handler.info.deleted-title'),
    );
  }
}

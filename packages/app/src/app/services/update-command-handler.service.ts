import { DestroyRef, Injectable, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Release } from '@bitbutler/shared';
import { TranslateService } from '@ngx-translate/core';
import { EMPTY, catchError, exhaustMap, filter, from } from 'rxjs';
import { AppCommand, UpdateCommand } from '../models/command.model';
import { normalizeVersionTag } from '../models/update-settings.model';
import { CommandBusService } from './command-bus.service';
import { ElectronService } from './electron.service';
import { ToastService } from './toast.service';
import { UpdateSettingsService } from './update-settings.service';

@Injectable({ providedIn: 'root' })
export class UpdateCommandHandlerService {
  private readonly commandBusService = inject(CommandBusService);
  private readonly electronService = inject(ElectronService);
  private readonly toastService = inject(ToastService);
  private readonly translateService = inject(TranslateService);
  private readonly updateSettingsService = inject(UpdateSettingsService);
  private readonly destroyRef = inject(DestroyRef);

  public start(): void {
    this.commandBusService.commands$
      .pipe(
        filter((cmd: AppCommand): cmd is UpdateCommand => cmd.type === 'UPDATE_CHECK_FOR_UPDATE'),
        exhaustMap((cmd) =>
          from(this.handleCheckForUpdate(cmd.trigger)).pipe(
            catchError((err) => {
              console.error(UpdateCommandHandlerService.name, 'start', err);
              return EMPTY;
            }),
          ),
        ),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe();
  }

  private async handleCheckForUpdate(trigger: 'automatic' | 'manual'): Promise<void> {
    const response = await this.electronService.checkForUpdate();

    if (response.error) {
      this.toastService.danger(
        String(response.error),
        this.translateService.instant('services.update-command-handler.error.check-failed-title'),
      );
      return;
    }

    if (response.updateAvailable) {
      if (trigger === 'automatic' && (await this.isLatestReleaseSkipped(response.releases))) {
        return;
      }

      this.commandBusService.emit({ type: 'UI_UPDATE_AVAILABLE', update: response });
      return;
    }

    this.toastService.success(
      this.translateService.instant('services.update-command-handler.success.up-to-date'),
      this.translateService.instant('services.update-command-handler.success.up-to-date-title'),
    );
  }

  private async isLatestReleaseSkipped(releases: Release[] | undefined): Promise<boolean> {
    const latest = releases?.[0];
    if (!latest) {
      return false;
    }

    const { skippedVersion } = await this.updateSettingsService.load();
    return skippedVersion !== null && skippedVersion === normalizeVersionTag(latest.tag_name);
  }
}

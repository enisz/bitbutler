import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { faFileExport, faXmark } from '@fortawesome/free-solid-svg-icons';
import { NgbActiveModal } from '@ng-bootstrap/ng-bootstrap';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { BbBtnContent } from '../../components/bb-btn-content/bb-btn-content';
import { ServerStoreService } from '../../services/server-store.service';
import { ToastService } from '../../services/toast.service';

@Component({
  selector: 'app-export-configuration',
  standalone: true,
  imports: [TranslatePipe, BbBtnContent],
  templateUrl: './export-configuration.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ExportConfiguration {
  private readonly activeModal = inject(NgbActiveModal);
  private readonly serverStoreService = inject(ServerStoreService);
  private readonly toastService = inject(ToastService);
  private readonly translateService = inject(TranslateService);

  public readonly icons = { faFileExport, faXmark };

  public readonly serverCount = computed(() => this.serverStoreService.servers().length);
  public readonly exporting = signal(false);

  public async export(): Promise<void> {
    this.exporting.set(true);
    try {
      const result = await window.bitbutler.config.exportToFile();
      if (result.canceled) return;

      this.toastService.success(
        result.path ?? '',
        this.translateService.instant(
          'components.modals.export-configuration.toast.exported-title',
        ),
      );
      this.activeModal.close();
    } catch (error) {
      this.toastService.danger(
        (error as Error).message,
        this.translateService.instant(
          'components.modals.export-configuration.toast.export-failed-title',
        ),
      );
    } finally {
      this.exporting.set(false);
    }
  }

  public cancel(): void {
    this.activeModal.dismiss();
  }
}

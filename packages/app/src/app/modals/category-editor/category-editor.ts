import { Component, inject } from '@angular/core';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { NgbActiveModal } from '@ng-bootstrap/ng-bootstrap';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { SavePathSelect } from '../../components/save-path-select/save-path-select';
import { CommandBusService } from '../../services/command-bus.service';
import { QbService } from '../../services/qb.service';
import { ServerStoreService } from '../../services/server-store.service';
import { ToastService } from '../../services/toast.service';

@Component({
  selector: 'app-category-editor',
  standalone: true,
  imports: [ReactiveFormsModule, TranslateModule, SavePathSelect],
  templateUrl: './category-editor.html',
})
export class CategoryEditor {
  private readonly qbService = inject(QbService);
  private readonly commandBusService = inject(CommandBusService);
  private readonly serverStoreService = inject(ServerStoreService);
  private readonly toastService = inject(ToastService);
  private readonly translateService = inject(TranslateService);
  protected readonly activeModal = inject(NgbActiveModal);

  readonly nameControl = new FormControl('', { nonNullable: true });
  readonly savePathControl = new FormControl('', { nonNullable: true });

  async save(): Promise<void> {
    const name = this.nameControl.value.trim();
    // Finding 4: save path is optional - qBittorrent falls back to its default when blank.
    const savePath = this.savePathControl.value.trim();
    if (!name) return;

    const serverId = this.serverStoreService.currentServerId();
    if (!serverId) return;

    try {
      await this.qbService.torrents.createCategory(serverId, name, savePath);
    } catch (err) {
      console.error(CategoryEditor.name, 'save', err);
      this.toastService.danger(
        this.translateService.instant('components.modals.category-editor.toast.create-failed'),
        this.translateService.instant(
          'components.modals.category-editor.toast.create-failed-title',
        ),
      );
      return;
    }
    this.commandBusService.emit({ type: 'CATEGORY_ADDED', name, savePath });
    this.activeModal.close();
  }
}

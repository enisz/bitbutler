import { Component, inject, input } from '@angular/core';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { faPlus, faXmark } from '@fortawesome/free-solid-svg-icons';
import { NgbActiveModal } from '@ng-bootstrap/ng-bootstrap';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { BbBtnContent } from '../../components/bb-btn-content/bb-btn-content';
import { CommandBusService } from '../../services/command-bus.service';
import { QbService } from '../../services/qb.service';
import { ServerStoreService } from '../../services/server-store.service';
import { ToastService } from '../../services/toast.service';

@Component({
  selector: 'app-tag-editor',
  standalone: true,
  imports: [ReactiveFormsModule, TranslateModule, BbBtnContent],
  templateUrl: './tag-editor.html',
})
export class TagEditor {
  private readonly qbService = inject(QbService);
  private readonly commandBusService = inject(CommandBusService);
  private readonly serverStoreService = inject(ServerStoreService);
  private readonly toastService = inject(ToastService);
  private readonly translateService = inject(TranslateService);
  protected readonly activeModal = inject(NgbActiveModal);

  readonly icon = { faPlus, faXmark };

  /** Tag names already present in the grid, so a resubmitted existing name is not
   * treated as newly created (Finding 5). */
  readonly existingNames = input<string[]>([]);

  readonly nameControl = new FormControl('', { nonNullable: true });

  async save(): Promise<void> {
    const raw = this.nameControl.value.trim();
    if (!raw) return;

    const dedupedNames = Array.from(
      new Set(
        raw
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean),
      ),
    );
    if (!dedupedNames.length) return;

    const existing = new Set(this.existingNames());
    const names = dedupedNames.filter((name) => !existing.has(name));

    if (names.length) {
      const serverId = this.serverStoreService.currentServerId();
      if (!serverId) return;

      try {
        await this.qbService.torrents.createTags(serverId, names);
      } catch (err) {
        console.error(TagEditor.name, 'save', err);
        this.toastService.danger(
          this.translateService.instant('components.modals.tag-editor.toast.create-failed'),
          this.translateService.instant('components.modals.tag-editor.toast.create-failed-title'),
        );
        return;
      }
      this.commandBusService.emit({ type: 'TAG_ADDED', names });
    }

    this.activeModal.close();
  }
}

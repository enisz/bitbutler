import { Component, OnInit, computed, inject, input } from '@angular/core';
import { FormControl, ReactiveFormsModule, ValidationErrors, ValidatorFn } from '@angular/forms';
import { faFloppyDisk, faPlus, faXmark } from '@fortawesome/free-solid-svg-icons';
import { NgbActiveModal } from '@ng-bootstrap/ng-bootstrap';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { BbBtnContent } from '../../components/bb-btn-content/bb-btn-content';
import { SavePathSelect } from '../../components/save-path-select/save-path-select';
import { CommandBusService } from '../../services/command-bus.service';
import { QbService } from '../../services/qb.service';
import { ServerStoreService } from '../../services/server-store.service';
import { ToastService } from '../../services/toast.service';

export interface CategoryEditorEntry {
  name: string;
  savePath: string;
}

@Component({
  selector: 'app-category-editor',
  standalone: true,
  imports: [ReactiveFormsModule, TranslateModule, SavePathSelect, BbBtnContent],
  templateUrl: './category-editor.html',
})
export class CategoryEditor implements OnInit {
  private readonly qbService = inject(QbService);
  private readonly commandBusService = inject(CommandBusService);
  private readonly serverStoreService = inject(ServerStoreService);
  private readonly toastService = inject(ToastService);
  private readonly translateService = inject(TranslateService);
  protected readonly activeModal = inject(NgbActiveModal);

  readonly icon = { faFloppyDisk, faPlus, faXmark };

  /** The category being edited, qBittorrent has no rename API - only the
   * save path can be changed, so the name field is disabled in edit mode. */
  readonly category = input<CategoryEditorEntry | null>(null);
  readonly isEditMode = computed(() => this.category() !== null);

  /** Names of the categories already on the server, so the user cannot create a
   * duplicate - the name field is disabled in edit mode, so this validator never
   * runs there. */
  readonly existingNames = input<string[]>([]);

  private readonly duplicateNameValidator: ValidatorFn = (control): ValidationErrors | null => {
    const name = (control.value ?? '').trim();
    if (!name) return null;
    return this.existingNames().includes(name) ? { duplicateName: true } : null;
  };

  readonly nameControl = new FormControl('', {
    nonNullable: true,
    validators: [this.duplicateNameValidator],
  });
  readonly savePathControl = new FormControl('', { nonNullable: true });

  ngOnInit(): void {
    const category = this.category();
    if (!category) return;

    this.nameControl.setValue(category.name);
    this.nameControl.disable();
    this.savePathControl.setValue(category.savePath);
  }

  async save(): Promise<void> {
    const name = this.nameControl.value.trim();
    // Finding 4: save path is optional - qBittorrent falls back to its default when blank.
    const savePath = this.savePathControl.value.trim();
    if (!name || this.nameControl.invalid) return;

    const serverId = this.serverStoreService.currentServerId();
    if (!serverId) return;

    const editing = this.isEditMode();

    try {
      if (editing) {
        await this.qbService.torrents.editCategory(serverId, name, savePath);
      } else {
        await this.qbService.torrents.createCategory(serverId, name, savePath);
      }
    } catch (err) {
      console.error(CategoryEditor.name, 'save', err);
      this.toastService.danger(
        this.translateService.instant(
          editing
            ? 'components.modals.category-editor.toast.update-failed'
            : 'components.modals.category-editor.toast.create-failed',
        ),
        this.translateService.instant(
          editing
            ? 'components.modals.category-editor.toast.update-failed-title'
            : 'components.modals.category-editor.toast.create-failed-title',
        ),
      );
      return;
    }
    this.commandBusService.emit(
      editing
        ? { type: 'CATEGORY_UPDATED', name, savePath }
        : { type: 'CATEGORY_ADDED', name, savePath },
    );
    this.activeModal.close();
  }
}

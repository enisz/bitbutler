import {
  ChangeDetectionStrategy,
  Component,
  OnInit,
  computed,
  inject,
  signal,
} from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { FontAwesomeModule } from '@fortawesome/angular-fontawesome';
import { faEdit, faTrashCan } from '@fortawesome/free-regular-svg-icons';
import { faCheck, faX, faXmark } from '@fortawesome/free-solid-svg-icons';
import { NgbActiveModal, NgbTooltipModule } from '@ng-bootstrap/ng-bootstrap';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { AutofocusDirective } from '../../../directives/autofocus';
import { TooltipOverflow } from '../../../directives/tooltip-overflow';
import { GuardableModal } from '../../../models/guardable-modal.interface';
import { ConfirmService } from '../../../services/confirm.service';
import { QbService } from '../../../services/qb.service';
import { ServerStoreService } from '../../../services/server-store.service';
import { ToastService } from '../../../services/toast.service';
import { TorrentStoreService } from '../../../services/torrent-store.service';
import { BbSpinner } from '../../bb-spinner/bb-spinner';
import { SavePathSelect } from '../../save-path-select/save-path-select';

interface CategoryItem {
  name: string;
  savePath: string;
  editing: boolean;
}

@Component({
  selector: 'app-manage-categories',
  standalone: true,
  imports: [
    ReactiveFormsModule,
    TranslatePipe,
    FontAwesomeModule,
    NgbTooltipModule,
    BbSpinner,
    AutofocusDirective,
    TooltipOverflow,
    SavePathSelect,
  ],
  templateUrl: './manage-categories.html',
  styleUrl: './manage-categories.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ManageCategories implements OnInit, GuardableModal {
  private readonly qbService = inject(QbService);
  private readonly serverStoreService = inject(ServerStoreService);
  private readonly confirmService = inject(ConfirmService);
  private readonly torrentStoreService = inject(TorrentStoreService);
  private readonly toastService = inject(ToastService);
  private readonly translateService = inject(TranslateService);
  public readonly activeModal = inject(NgbActiveModal);

  public readonly icon = { faEdit, faTrashCan, faCheck, faX, faXmark };

  public categories = signal<CategoryItem[]>([]);
  private readonly isEditing = computed(() => this.categories().some((c) => c.editing));
  public addForm = new FormGroup({
    name: new FormControl('', [Validators.required]),
    savePath: new FormControl<string | null>(null),
  });
  public editSavePathControl = new FormControl<string | null>(null);
  public filterControl = new FormControl('');
  public adding = signal(false);
  public loading = signal(true);

  private readonly filterValue = toSignal(this.filterControl.valueChanges, { initialValue: '' });

  public readonly filteredCategories = computed(() => {
    const filter = (this.filterValue() ?? '').toLowerCase();
    if (!filter) return this.categories();
    return this.categories().filter((c) => c.editing || c.name.toLowerCase().includes(filter));
  });

  public async canDeactivate(): Promise<boolean> {
    if (!this.isEditing() && !this.addForm.dirty) return true;

    return this.confirmService.confirm(
      'components.modals.guard.unsaved-title',
      'components.modals.guard.unsaved-message',
      'components.modals.guard.btn-leave',
      'components.modals.guard.btn-stay',
    );
  }

  public clearFilter(): void {
    this.filterControl.reset();
  }

  public async ngOnInit(): Promise<void> {
    try {
      const raw = await this.qbService.torrents.categories(
        this.serverStoreService.currentServerId() as string,
      );
      this.categories.set(
        Object.entries(raw)
          .map(([name, cat]) => ({
            name,
            savePath: cat.savePath ?? '',
            editing: false,
          }))
          .sort((a, b) => a.name.localeCompare(b.name)),
      );
    } catch (err) {
      console.error(ManageCategories.name, 'ngOnInit', 'Failed to load categories', err);
    } finally {
      this.loading.set(false);
    }
  }

  public async add(): Promise<void> {
    const name = (this.addForm.get('name')?.value ?? '').trim();
    const savePath = (this.addForm.get('savePath')?.value ?? '').trim();
    if (!name) return;
    const serverId = this.serverStoreService.currentServerId() as string;
    try {
      this.adding.set(true);
      await this.qbService.torrents.createCategory(serverId, name, savePath);
      this.categories.set(
        [...this.categories(), { name, savePath, editing: false }].sort((a, b) =>
          a.name.localeCompare(b.name),
        ),
      );
      this.addForm.reset();
      this.toastService.success(
        this.translateService.instant('components.modals.manage-categories.toast.added', { name }),
        this.translateService.instant('components.modals.manage-categories.title'),
      );
    } catch (err) {
      console.error(ManageCategories.name, 'add', 'Failed to add category', err);
      this.toastService.danger(
        this.translateService.instant('components.modals.manage-categories.toast.add-failed', {
          name,
        }),
        this.translateService.instant('components.modals.manage-categories.title'),
      );
    } finally {
      this.adding.set(false);
    }
  }

  public startEdit(item: CategoryItem): void {
    this.categories.set(this.categories().map((c) => ({ ...c, editing: c.name === item.name })));
    this.editSavePathControl.setValue(item.savePath || null);
  }

  public cancelEdit(): void {
    this.categories.set(this.categories().map((c) => ({ ...c, editing: false })));
  }

  public async saveEdit(item: CategoryItem): Promise<void> {
    const newPath = (this.editSavePathControl.value ?? '').trim();
    const serverId = this.serverStoreService.currentServerId() as string;
    try {
      await this.qbService.torrents.editCategory(serverId, item.name, newPath);
      this.categories.set(
        this.categories().map((c) =>
          c.name === item.name ? { ...c, savePath: newPath, editing: false } : c,
        ),
      );
      this.toastService.success(
        this.translateService.instant('components.modals.manage-categories.toast.updated', {
          name: item.name,
        }),
        this.translateService.instant('components.modals.manage-categories.title'),
      );
    } catch (err) {
      console.error(ManageCategories.name, 'saveEdit', 'Failed to edit category', err);
      this.toastService.danger(
        this.translateService.instant('components.modals.manage-categories.toast.edit-failed', {
          name: item.name,
        }),
        this.translateService.instant('components.modals.manage-categories.title'),
      );
    }
  }

  public async delete(item: CategoryItem): Promise<void> {
    const count = this.torrentStoreService
      .torrentsArray()
      .filter((t) => t.category === item.name).length;

    const confirmed = await this.confirmService.confirm(
      'components.modals.manage-categories.delete-confirm.title',
      {
        text: 'components.modals.manage-categories.delete-confirm.message',
        data: { name: item.name, count },
      },
      'general.button.delete',
    );
    if (!confirmed) return;

    const serverId = this.serverStoreService.currentServerId() as string;
    try {
      await this.qbService.torrents.removeCategories(serverId, [item.name]);
      this.categories.set(this.categories().filter((c) => c.name !== item.name));
      this.toastService.success(
        this.translateService.instant('components.modals.manage-categories.toast.deleted', {
          name: item.name,
        }),
        this.translateService.instant('components.modals.manage-categories.title'),
      );
    } catch (err) {
      console.error(ManageCategories.name, 'delete', 'Failed to delete category', err);
      this.toastService.danger(
        this.translateService.instant('components.modals.manage-categories.toast.delete-failed', {
          name: item.name,
        }),
        this.translateService.instant('components.modals.manage-categories.title'),
      );
    }
  }
}

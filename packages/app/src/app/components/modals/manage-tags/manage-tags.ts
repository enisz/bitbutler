import {
  ChangeDetectionStrategy,
  Component,
  OnInit,
  computed,
  inject,
  signal,
} from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormControl, ReactiveFormsModule, Validators } from '@angular/forms';
import { FontAwesomeModule } from '@fortawesome/angular-fontawesome';
import { faTrashCan } from '@fortawesome/free-regular-svg-icons';
import { faXmark } from '@fortawesome/free-solid-svg-icons';
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

@Component({
  selector: 'app-manage-tags',
  standalone: true,
  imports: [
    ReactiveFormsModule,
    TranslatePipe,
    FontAwesomeModule,
    NgbTooltipModule,
    BbSpinner,
    AutofocusDirective,
    TooltipOverflow,
  ],
  templateUrl: './manage-tags.html',
  styleUrl: './manage-tags.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ManageTags implements OnInit, GuardableModal {
  private readonly qbService = inject(QbService);
  private readonly serverStoreService = inject(ServerStoreService);
  private readonly confirmService = inject(ConfirmService);
  private readonly torrentStoreService = inject(TorrentStoreService);
  private readonly toastService = inject(ToastService);
  private readonly translateService = inject(TranslateService);
  public readonly activeModal = inject(NgbActiveModal);

  public readonly icon = { faTrashCan, faXmark };

  public tags = signal<string[]>([]);
  public nameControl = new FormControl('', [Validators.required]);
  public filterControl = new FormControl('');
  public adding = signal(false);
  public loading = signal(true);

  private readonly filterValue = toSignal(this.filterControl.valueChanges, { initialValue: '' });

  public readonly filteredTags = computed(() => {
    const filter = (this.filterValue() ?? '').toLowerCase();
    if (!filter) return this.tags();
    return this.tags().filter((tag) => tag.toLowerCase().includes(filter));
  });

  public async canDeactivate(): Promise<boolean> {
    if (!this.nameControl.dirty) return true;

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
      const tags = await this.qbService.torrents.tags(
        this.serverStoreService.currentServerId() as string,
      );
      this.tags.set([...tags].sort((a, b) => a.localeCompare(b)));
    } catch (err) {
      console.error(ManageTags.name, 'ngOnInit', 'Failed to load tags', err);
    } finally {
      this.loading.set(false);
    }
  }

  public async add(): Promise<void> {
    const raw = (this.nameControl.value ?? '').trim();
    if (!raw) return;
    const names = raw
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
    if (names.length === 0) return;
    const serverId = this.serverStoreService.currentServerId() as string;
    try {
      this.adding.set(true);
      await this.qbService.torrents.createTags(serverId, names);
      const newNames = names.filter((n) => !this.tags().includes(n));
      this.tags.set([...this.tags(), ...newNames].sort((a, b) => a.localeCompare(b)));
      this.nameControl.reset();
      this.toastService.success(
        newNames.length === 1
          ? this.translateService.instant('components.modals.manage-tags.toast.added-one', {
              name: newNames[0],
            })
          : this.translateService.instant('components.modals.manage-tags.toast.added', {
              count: newNames.length,
            }),
        this.translateService.instant('components.modals.manage-tags.title'),
      );
    } catch (err) {
      console.error(ManageTags.name, 'add', 'Failed to add tag', err);
      this.toastService.danger(
        this.translateService.instant('components.modals.manage-tags.toast.add-failed'),
        this.translateService.instant('components.modals.manage-tags.title'),
      );
    } finally {
      this.adding.set(false);
    }
  }

  public async delete(tag: string): Promise<void> {
    const count = this.torrentStoreService.torrentsArray().filter((t) =>
      (t.tags ?? '')
        .split(',')
        .map((s) => s.trim())
        .includes(tag),
    ).length;

    const confirmed = await this.confirmService.confirm(
      'components.modals.manage-tags.delete-confirm.title',
      {
        text: 'components.modals.manage-tags.delete-confirm.message',
        data: { name: tag, count },
      },
      'general.button.delete',
    );
    if (!confirmed) return;

    const serverId = this.serverStoreService.currentServerId() as string;
    try {
      await this.qbService.torrents.deleteTags(serverId, [tag]);
      this.tags.set(this.tags().filter((t) => t !== tag));
      this.toastService.success(
        this.translateService.instant('components.modals.manage-tags.toast.deleted', { name: tag }),
        this.translateService.instant('components.modals.manage-tags.title'),
      );
    } catch (err) {
      console.error(ManageTags.name, 'delete', 'Failed to delete tag', err);
      this.toastService.danger(
        this.translateService.instant('components.modals.manage-tags.toast.delete-failed', {
          name: tag,
        }),
        this.translateService.instant('components.modals.manage-tags.title'),
      );
    }
  }
}

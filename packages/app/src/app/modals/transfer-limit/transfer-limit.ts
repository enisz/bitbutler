import {
  ChangeDetectionStrategy,
  Component,
  OnInit,
  computed,
  inject,
  input,
  signal,
} from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { faEraser, faFloppyDisk, faXmark } from '@fortawesome/free-solid-svg-icons';
import { NgbActiveModal, NgbTooltip } from '@ng-bootstrap/ng-bootstrap';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { BbBtnContent } from '../../components/bb-btn-content/bb-btn-content';
import { BbSpinner } from '../../components/bb-spinner/bb-spinner';
import {
  TransferLimit as TransferLimitForm,
  TransferLimitValue,
} from '../../components/transfer-limit/transfer-limit';
import { AutofocusDirective } from '../../directives/autofocus';
import { TooltipOverflow } from '../../directives/tooltip-overflow';
import { LimitTargetType } from '../../models/command.model';
import { GuardableModal } from '../../models/guardable-modal.interface';
import { ConfirmService } from '../../services/confirm.service';
import { QbService } from '../../services/qb.service';
import { ServerStoreService } from '../../services/server-store.service';
import { ToastService } from '../../services/toast.service';
import { TorrentStoreService } from '../../services/torrent-store.service';

@Component({
  selector: 'app-transfer-limit-modal',
  imports: [
    ReactiveFormsModule,
    TranslatePipe,
    TransferLimitForm,
    NgbTooltip,
    TooltipOverflow,
    BbSpinner,
    AutofocusDirective,
    BbBtnContent,
  ],
  templateUrl: './transfer-limit.html',
  styleUrl: './transfer-limit.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TransferLimit implements OnInit, GuardableModal {
  readonly target = input.required<LimitTargetType>();
  readonly hashes = input<string[]>([]);

  private readonly qbService = inject(QbService);
  private readonly serverStoreService = inject(ServerStoreService);
  private readonly torrentStoreService = inject(TorrentStoreService);
  private readonly toastService = inject(ToastService);
  private readonly translateService = inject(TranslateService);
  private readonly confirmService = inject(ConfirmService);
  public activeModal = inject(NgbActiveModal);

  public readonly icons = { faFloppyDisk, faEraser, faXmark };

  public form = new FormGroup({
    transferRateLimits: new FormControl<TransferLimitValue | null>(null),
  });

  public loading = signal(false);
  public saving = signal(false);

  public readonly selected = computed(() => this.hashes().length);

  public readonly selectionName = computed(() => {
    if (this.hashes().length === 1) {
      return this.torrentStoreService.torrentsMap().get(this.hashes()[0])?.name ?? this.hashes()[0];
    }
    return this.hashes().length;
  });

  public readonly tooltipText = computed(() => {
    if (this.target() === 'global') return null;
    return String(this.selectionName());
  });

  public async ngOnInit(): Promise<void> {
    const serverId = this.serverStoreService.currentServerId() as string;
    let uploadBytes = 0;
    let downloadBytes = 0;

    if (this.target() === 'global') {
      this.loading.set(true);
      [uploadBytes, downloadBytes] = await Promise.all([
        this.qbService.transfer.uploadLimit(serverId),
        this.qbService.transfer.downloadLimit(serverId),
      ]);
      this.loading.set(false);
    } else if (this.hashes().length > 0) {
      const torrent = this.torrentStoreService.torrentsMap().get(this.hashes()[0]);
      if (torrent) {
        uploadBytes = torrent.up_limit;
        downloadBytes = torrent.dl_limit;
      }
    }

    this.form.controls.transferRateLimits.setValue(
      {
        uploadLimit: uploadBytes > 0 ? Math.floor(uploadBytes / 1024) : null,
        downloadLimit: downloadBytes > 0 ? Math.floor(downloadBytes / 1024) : null,
      },
      { emitEvent: false },
    );
  }

  public async handleSubmit(): Promise<void> {
    this.saving.set(true);
    const serverId = this.serverStoreService.currentServerId() as string;
    const value = this.form.controls.transferRateLimits.value;
    const uploadBytes = (value?.uploadLimit ?? 0) * 1024;
    const downloadBytes = (value?.downloadLimit ?? 0) * 1024;
    const hashes = this.hashes();
    const isGlobal = this.target() === 'global';

    try {
      await Promise.all([
        isGlobal
          ? this.qbService.transfer.setUploadLimit(serverId, uploadBytes)
          : this.qbService.torrents.setUploadLimit(serverId, uploadBytes, hashes),
        isGlobal
          ? this.qbService.transfer.setDownloadLimit(serverId, downloadBytes)
          : this.qbService.torrents.setDownloadLimit(serverId, downloadBytes, hashes),
      ]);
      this.activeModal.close();
    } catch (error: any) {
      console.error(TransferLimit.name, 'handleSubmit', 'Failed to update limits!', error);
      this.toastService.danger(
        error?.message ?? String(error),
        this.translateService.instant('components.modals.transfer-limit.toast.set-failed-title'),
      );
    } finally {
      this.saving.set(false);
    }
  }

  public clearAll(): void {
    const control = this.form.controls.transferRateLimits;
    control.markAsDirty();
    control.setValue({ uploadLimit: null, downloadLimit: null });
  }

  public async canDeactivate(): Promise<boolean> {
    if (!this.form.dirty) return true;

    return this.confirmService.confirm(
      'components.modals.guard.unsaved-title',
      'components.modals.guard.unsaved-message',
      'components.modals.guard.btn-leave',
      'components.modals.guard.btn-stay',
    );
  }

  public hasClearableValues(): boolean {
    const v = this.form.controls.transferRateLimits.value;
    return v !== null && (v.uploadLimit !== null || v.downloadLimit !== null);
  }

  public canSave(): boolean {
    return this.form.valid && !this.saving();
  }
}

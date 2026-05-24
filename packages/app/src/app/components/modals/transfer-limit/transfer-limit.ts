import {
  ChangeDetectorRef,
  Component,
  Input,
  OnInit,
  computed,
  inject,
  signal,
} from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { NgbActiveModal, NgbTooltip } from '@ng-bootstrap/ng-bootstrap';
import { TranslatePipe } from '@ngx-translate/core';
import { AutofocusDirective } from '../../../directives/autofocus';
import { TooltipOverflow } from '../../../directives/tooltip-overflow';
import { LimitTargetType } from '../../../models/command.model';
import { QbService } from '../../../services/qb.service';
import { ServerStoreService } from '../../../services/server-store.service';
import { TorrentStoreService } from '../../../services/torrent-store.service';
import { BbSpinner } from '../../bb-spinner/bb-spinner';
import {
  TransferLimit as TransferLimitForm,
  TransferLimitValue,
} from '../../transfer-limit/transfer-limit';

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
  ],
  templateUrl: './transfer-limit.html',
  styleUrl: './transfer-limit.scss',
})
export class TransferLimit implements OnInit {
  @Input() public target!: LimitTargetType;
  @Input() public hashes: string[] = [];

  private readonly qbService = inject(QbService);
  private readonly serverStoreService = inject(ServerStoreService);
  private readonly torrentStoreService = inject(TorrentStoreService);
  private readonly cdr = inject(ChangeDetectorRef);
  public activeModal = inject(NgbActiveModal);

  public form = new FormGroup({
    transferRateLimits: new FormControl<TransferLimitValue | null>(null),
  });

  public loading = signal(false);
  public saving = signal(false);

  public readonly selected = computed(() => this.hashes.length);

  public readonly selectionName = computed(() => {
    if (this.hashes.length === 1) {
      return this.torrentStoreService.torrentsMap().get(this.hashes[0])?.name ?? this.hashes[0];
    }
    return this.hashes.length;
  });

  public readonly tooltipText = computed(() => {
    if (this.target === 'global') return null;
    return String(this.selectionName());
  });

  public async ngOnInit(): Promise<void> {
    const serverId = this.serverStoreService.currentServerId() as string;
    let uploadBytes = 0;
    let downloadBytes = 0;

    if (this.target === 'global') {
      this.loading.set(true);
      [uploadBytes, downloadBytes] = await Promise.all([
        this.qbService.getUploadLimit(serverId) as Promise<number>,
        this.qbService.getDownloadLimit(serverId) as Promise<number>,
      ]);
      this.loading.set(false);
      this.cdr.markForCheck();
    } else if (this.hashes.length > 0) {
      const torrent = this.torrentStoreService.torrentsMap().get(this.hashes[0]);
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
    this.cdr.markForCheck();
  }

  public async handleSubmit(): Promise<void> {
    this.saving.set(true);
    const serverId = this.serverStoreService.currentServerId() as string;
    const value = this.form.controls.transferRateLimits.value;
    const uploadBytes = (value?.uploadLimit ?? 0) * 1024;
    const downloadBytes = (value?.downloadLimit ?? 0) * 1024;
    const hashes = this.target === 'torrent' ? this.hashes : undefined;

    try {
      await Promise.all([
        this.qbService.setUploadLimit(serverId, uploadBytes, hashes),
        this.qbService.setDownloadLimit(serverId, downloadBytes, hashes),
      ]);
    } catch (error: any) {
      console.error(TransferLimit.name, 'handleSubmit', 'Failed to update limits!');
    } finally {
      this.saving.set(false);
      this.activeModal.close();
    }
  }

  public clearAll(): void {
    this.form.controls.transferRateLimits.setValue({ uploadLimit: null, downloadLimit: null });
    this.handleSubmit();
  }

  public hasClearableValues(): boolean {
    const v = this.form.controls.transferRateLimits.value;
    return v !== null && (v.uploadLimit !== null || v.downloadLimit !== null);
  }

  public canSave(): boolean {
    return this.form.valid && !this.saving();
  }
}

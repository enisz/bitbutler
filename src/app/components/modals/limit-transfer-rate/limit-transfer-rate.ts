import {
  ChangeDetectorRef,
  Component,
  computed,
  inject,
  Input,
  OnInit,
  signal,
} from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { NgbActiveModal, NgbTooltip } from '@ng-bootstrap/ng-bootstrap';
import { TranslatePipe } from '@ngx-translate/core';
import { TooltipOverflow } from '../../../directives/tooltip-overflow';
import { LimitTargetType } from '../../../models/command.model';
import { QbService } from '../../../services/qb.service';
import { SelectionStoreService } from '../../../services/selection-store.service';
import { ServerStoreService } from '../../../services/server-store.service';
import {
  TransferRateLimit,
  TransferRateLimitValue,
} from '../../transfer-rate-limit/transfer-rate-limit';

@Component({
  selector: 'app-limit-transfer-rate',
  imports: [ReactiveFormsModule, TranslatePipe, TransferRateLimit, NgbTooltip, TooltipOverflow],
  templateUrl: './limit-transfer-rate.html',
  styleUrl: './limit-transfer-rate.scss',
})
export class LimitTransferRate implements OnInit {
  @Input() public target!: LimitTargetType;

  private readonly qbService = inject(QbService);
  private readonly serverStoreService = inject(ServerStoreService);
  private readonly selectionStoreService = inject(SelectionStoreService);
  private readonly cdr = inject(ChangeDetectorRef);
  public activeModal = inject(NgbActiveModal);

  public form = new FormGroup({
    transferRateLimits: new FormControl<TransferRateLimitValue | null>(null),
  });

  public saving = signal<boolean>(false);
  public selected = signal<number>(this.selectionStoreService.selected().length);

  public selectionName = computed(() => {
    const selected = this.selectionStoreService.selected();
    return selected.length === 1 ? selected[0].name : selected.length;
  });

  public tooltipText = computed(() => {
    if (this.target === 'global') return null;
    return String(this.selectionName());
  });

  public async ngOnInit(): Promise<void> {
    const serverId = this.serverStoreService.currentServerId() as string;
    let uploadBytes = 0;
    let downloadBytes = 0;

    if (this.target === 'global') {
      [uploadBytes, downloadBytes] = await Promise.all([
        this.qbService.getUploadLimit(serverId) as Promise<number>,
        this.qbService.getDownloadLimit(serverId) as Promise<number>,
      ]);
    } else {
      const selectedTorrents = this.selectionStoreService.selected();
      if (selectedTorrents.length > 0) {
        const torrent = selectedTorrents[0];
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
    const hashes =
      this.target === 'torrent'
        ? this.selectionStoreService.selected().map((t) => t.hash.trim())
        : undefined;

    try {
      await Promise.all([
        this.qbService.setUploadLimit(serverId, uploadBytes, hashes),
        this.qbService.setDownloadLimit(serverId, downloadBytes, hashes),
      ]);
    } catch (error: any) {
      console.error(LimitTransferRate.name, 'handleSubmit', 'Failed to update limits!');
    } finally {
      this.saving.set(false);
      this.activeModal.close();
    }
  }

  public clearAll(): void {
    this.form.controls.transferRateLimits.setValue({
      uploadLimit: null,
      downloadLimit: null,
    });
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

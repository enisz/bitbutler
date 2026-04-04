import { Component, computed, inject, Input, OnInit, signal } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { NgbActiveModal, NgbTooltip } from '@ng-bootstrap/ng-bootstrap';
import { TranslatePipe } from '@ngx-translate/core';
import { AutofocusDirective } from '../../../directives/autofocus';
import { TooltipOverflow } from '../../../directives/tooltip-overflow';
import { LimitDirectionType, LimitTargetType } from '../../../models/command.model';
import { QbService } from '../../../services/qb.service';
import { SelectionStoreService } from '../../../services/selection-store.service';
import { ServerStoreService } from '../../../services/server-store.service';

@Component({
  selector: 'app-limit-transfer-rate',
  imports: [ReactiveFormsModule, AutofocusDirective, NgbTooltip, TranslatePipe, TooltipOverflow],
  templateUrl: './limit-transfer-rate.html',
  styleUrl: './limit-transfer-rate.scss',
})
export class LimitTransferRate implements OnInit {
  @Input() public target!: LimitTargetType;
  @Input() public direction!: LimitDirectionType;

  private readonly qbService = inject(QbService);
  private readonly serverStoreService = inject(ServerStoreService);
  private readonly selectionStoreService = inject(SelectionStoreService);
  public activeModal = inject(NgbActiveModal);

  public limitTransferForm = new FormGroup({
    limit: new FormControl(0, [Validators.required]),
  });

  public hasClearableLimit = signal<boolean>(false);
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
    let limit = 0;

    if (this.target === 'global') {
      if (this.direction === 'ul') {
        limit = (await this.qbService.getUploadLimit(serverId)) as number;
      } else {
        limit = (await this.qbService.getDownloadLimit(serverId)) as number;
      }
    } else if (this.target === 'torrent') {
      const selectedTorrents = this.selectionStoreService.selected();
      if (selectedTorrents.length > 0) {
        const torrent = selectedTorrents[0];
        limit = this.direction === 'ul' ? torrent.up_limit : torrent.dl_limit;
      }
    }

    this.limitTransferForm.get('limit')?.patchValue(limit > 0 ? Math.floor(limit / 1024) : 0);
    this.hasClearableLimit.set(limit > 0);
  }

  public async handleSubmit(): Promise<void> {
    this.saving.set(true);
    const serverId = this.serverStoreService.currentServerId() as string;
    const limitInKiB = this.limitTransferForm.get('limit')?.value ?? 0;
    const limit = limitInKiB * 1024;
    const hashes =
      this.target === 'torrent'
        ? this.selectionStoreService.selected().map((t) => t.hash.trim())
        : undefined;

    try {
      if (this.direction === 'ul') {
        await this.qbService.setUploadLimit(serverId, limit, hashes);
      } else {
        await this.qbService.setDownloadLimit(serverId, limit, hashes);
      }
    } catch (error: any) {
      console.error(LimitTransferRate.name, 'handleSubmit', 'Failed to update limit!');
    } finally {
      this.saving.set(false);
      this.activeModal.close();
    }
  }

  public clearFilters(): void {
    this.limitTransferForm.get('limit')?.patchValue(0);
    this.handleSubmit();
  }

  public canSave(): boolean {
    return this.limitTransferForm.valid && !this.saving();
  }
}

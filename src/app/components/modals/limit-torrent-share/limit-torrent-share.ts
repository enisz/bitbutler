import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { NgbActiveModal, NgbTooltip } from '@ng-bootstrap/ng-bootstrap';
import { TranslatePipe } from '@ngx-translate/core';
import { TooltipOverflow } from '../../../directives/tooltip-overflow';
import { QbService } from '../../../services/qb.service';
import { SelectionStoreService } from '../../../services/selection-store.service';
import { ServerStoreService } from '../../../services/server-store.service';
import { ShareLimit, ShareLimitValue } from '../../share-limit/share-limit';

@Component({
  selector: 'app-limit-torrent-share',
  imports: [ReactiveFormsModule, TranslatePipe, ShareLimit, NgbTooltip, TooltipOverflow],
  templateUrl: './limit-torrent-share.html',
  styleUrl: './limit-torrent-share.scss',
})
export class LimitTorrentShare implements OnInit {
  public readonly activeModal = inject(NgbActiveModal);
  private readonly qbService = inject(QbService);
  private readonly selectionStoreService = inject(SelectionStoreService);
  private readonly serverStoreService = inject(ServerStoreService);

  public saving = signal(false);

  public selected = signal(this.selectionStoreService.selected().length);

  public selectionName = computed(() => {
    const selected = this.selectionStoreService.selected();
    return selected.length === 1 ? selected[0].name : selected.length;
  });

  public tooltipText = computed(() => String(this.selectionName()));

  public form = new FormGroup({
    shareLimits: new FormControl<ShareLimitValue | null>(null),
  });

  public async ngOnInit(): Promise<void> {
    const serverId = this.serverStoreService.currentServerId() ?? '';
    const selected = this.selectionStoreService.selected();
    let value: ShareLimitValue;

    if (selected.length === 1) {
      const t = selected[0];
      value = {
        ratioLimit: t.ratio_limit >= 0 ? t.ratio_limit : null,
        seedingTimeLimit: t.seeding_time_limit >= 0 ? t.seeding_time_limit : null,
        inactiveSeedingTimeLimit:
          t.inactive_seeding_time_limit >= 0 ? t.inactive_seeding_time_limit : null,
      };
    } else {
      const prefs = await this.qbService.getAppPreferences(serverId);
      value = {
        ratioLimit: prefs.max_ratio_enabled ? prefs.max_ratio : null,
        seedingTimeLimit: prefs.max_seeding_time_enabled ? prefs.max_seeding_time : null,
        inactiveSeedingTimeLimit:
          prefs.max_inactive_seeding_time_enabled && prefs.max_inactive_seeding_time != null
            ? prefs.max_inactive_seeding_time
            : null,
      };
    }

    this.form.controls.shareLimits.setValue(value, { emitEvent: false });
  }

  public async handleSubmit(): Promise<void> {
    this.saving.set(true);

    const serverId = this.serverStoreService.currentServerId() ?? '';
    const hashes = this.selectionStoreService.selectedHashes();
    const value = this.form.getRawValue().shareLimits;

    const ratioLimit = value?.ratioLimit ?? -1;
    const seedingTimeLimit = value?.seedingTimeLimit ?? -1;
    const inactiveSeedingTimeLimit = value?.inactiveSeedingTimeLimit ?? -1;

    try {
      await this.qbService.setShareLimits(
        serverId,
        hashes,
        ratioLimit,
        seedingTimeLimit,
        inactiveSeedingTimeLimit,
      );
      this.activeModal.close();
    } catch (error) {
      console.error(LimitTorrentShare.name, 'handleSubmit', 'Failed to set share limits!', error);
    } finally {
      this.saving.set(false);
    }
  }

  public hasClearableValues(): boolean {
    const v = this.form.controls.shareLimits.value;
    return (
      v !== null &&
      (v.ratioLimit !== null || v.seedingTimeLimit !== null || v.inactiveSeedingTimeLimit !== null)
    );
  }

  public clearAll(): void {
    this.form.controls.shareLimits.setValue({
      ratioLimit: null,
      seedingTimeLimit: null,
      inactiveSeedingTimeLimit: null,
    });
    this.handleSubmit();
  }

  public canSave(): boolean {
    return !this.saving();
  }
}

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
import { NgbActiveModal, NgbTooltip } from '@ng-bootstrap/ng-bootstrap';
import { TranslatePipe } from '@ngx-translate/core';
import { AutofocusDirective } from '../../../directives/autofocus';
import { TooltipOverflow } from '../../../directives/tooltip-overflow';
import { LimitTargetType } from '../../../models/command.model';
import { QbService } from '../../../services/qb.service';
import { ServerStoreService } from '../../../services/server-store.service';
import { TorrentStoreService } from '../../../services/torrent-store.service';
import { BbSpinner } from '../../bb-spinner/bb-spinner';
import { ShareLimit as ShareLimitForm, ShareLimitValue } from '../../share-limit/share-limit';

@Component({
  selector: 'app-share-limit-modal',
  imports: [
    ReactiveFormsModule,
    TranslatePipe,
    ShareLimitForm,
    NgbTooltip,
    TooltipOverflow,
    BbSpinner,
    AutofocusDirective,
  ],
  templateUrl: './share-limit.html',
  styleUrl: './share-limit.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ShareLimit implements OnInit {
  public readonly activeModal = inject(NgbActiveModal);
  private readonly qbService = inject(QbService);
  private readonly serverStoreService = inject(ServerStoreService);
  private readonly torrentStoreService = inject(TorrentStoreService);

  readonly target = input<LimitTargetType>('torrent');
  readonly hashes = input<string[]>([]);

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

  public form = new FormGroup({
    shareLimits: new FormControl<ShareLimitValue | null>(null),
  });

  public async ngOnInit(): Promise<void> {
    if (this.target() === 'global') {
      this.loading.set(true);
      const serverId = this.serverStoreService.currentServerId() ?? '';
      const prefs = await this.qbService.getAppPreferences(serverId);
      this.form.controls.shareLimits.setValue(
        {
          ratioLimit: prefs.max_ratio_enabled ? prefs.max_ratio : null,
          seedingTimeLimit: prefs.max_seeding_time_enabled ? prefs.max_seeding_time : null,
          inactiveSeedingTimeLimit:
            prefs.max_inactive_seeding_time_enabled && prefs.max_inactive_seeding_time != null
              ? prefs.max_inactive_seeding_time
              : null,
        },
        { emitEvent: false },
      );
      this.loading.set(false);
      return;
    }

    const formValue = {
      ratioLimit: null as number | null,
      seedingTimeLimit: null as number | null,
      inactiveSeedingTimeLimit: null as number | null,
    };
    if (this.hashes().length === 1) {
      const t = this.torrentStoreService.torrentsMap().get(this.hashes()[0]);
      if (t) {
        formValue.ratioLimit =
          t.ratio_limit >= 0 ? t.ratio_limit : t.ratio_limit === -2 ? -2 : null;
        formValue.seedingTimeLimit =
          t.seeding_time_limit >= 0
            ? t.seeding_time_limit
            : t.seeding_time_limit === -2
              ? -2
              : null;
        formValue.inactiveSeedingTimeLimit =
          t.inactive_seeding_time_limit >= 0
            ? t.inactive_seeding_time_limit
            : t.inactive_seeding_time_limit === -2
              ? -2
              : null;
      }
    }
    this.form.controls.shareLimits.setValue(formValue, { emitEvent: false });
  }

  public async handleSubmit(): Promise<void> {
    this.saving.set(true);
    const serverId = this.serverStoreService.currentServerId() ?? '';
    const value = this.form.getRawValue().shareLimits;

    try {
      if (this.target() === 'global') {
        await this.qbService.setAppPreferences(serverId, {
          max_ratio_enabled: value?.ratioLimit != null,
          max_ratio: value?.ratioLimit ?? 0,
          max_seeding_time_enabled: value?.seedingTimeLimit != null,
          max_seeding_time: value?.seedingTimeLimit ?? 0,
          max_inactive_seeding_time_enabled: value?.inactiveSeedingTimeLimit != null,
          max_inactive_seeding_time: value?.inactiveSeedingTimeLimit ?? undefined,
        });
      } else {
        await this.qbService.setShareLimits(
          serverId,
          this.hashes(),
          value?.ratioLimit ?? -1,
          value?.seedingTimeLimit ?? -1,
          value?.inactiveSeedingTimeLimit ?? -1,
        );
      }
      this.activeModal.close();
    } catch (error) {
      console.error(ShareLimit.name, 'handleSubmit', 'Failed to set share limits!', error);
    } finally {
      this.saving.set(false);
    }
  }

  public hasClearableValues(): boolean {
    const v = this.form.controls.shareLimits.getRawValue();
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

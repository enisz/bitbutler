import { ChangeDetectionStrategy, Component, computed, effect, inject, input } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { NgbActiveModal, NgbTooltip } from '@ng-bootstrap/ng-bootstrap';
import { TranslatePipe } from '@ngx-translate/core';
import { TimeagoPipe } from 'ngx-timeago';
import { AutofocusDirective } from '../../../directives/autofocus';
import { TooltipOverflow } from '../../../directives/tooltip-overflow';
import { FilesizePipe } from '../../../pipes/filesize-pipe';
import { LocalTimestampPipe } from '../../../pipes/local-timestamp-pipe';
import { RatioPipe } from '../../../pipes/ratio-pipe';
import { CommandBusService } from '../../../services/command-bus.service';
import { FilterService } from '../../../services/filter.service';
import { GeneralSettingsService } from '../../../services/general-settings.service';
import { SelectionStoreService } from '../../../services/selection-store.service';
import { TorrentStoreService } from '../../../services/torrent-store.service';
import { BbProgress } from '../../bb-progress/bb-progress';

@Component({
  selector: 'app-torrent-exists',
  standalone: true,
  imports: [
    LocalTimestampPipe,
    FilesizePipe,
    RatioPipe,
    AutofocusDirective,
    TooltipOverflow,
    TimeagoPipe,
    NgbTooltip,
    TranslatePipe,
    BbProgress,
  ],
  styleUrls: ['./torrent-exists.scss'],
  templateUrl: './torrent-exists.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TorrentExists {
  readonly hash = input<string | null>(null);
  readonly originalPath = input<string | null>(null);

  private readonly torrentStoreService = inject(TorrentStoreService);
  private readonly activeModal = inject(NgbActiveModal);
  private readonly selectionStoreService = inject(SelectionStoreService);
  private readonly filterService = inject(FilterService);
  private readonly commandBusService = inject(CommandBusService);
  private readonly generalSettingsService = inject(GeneralSettingsService);
  private readonly generalSettings = toSignal(this.generalSettingsService.asObservable(), {
    initialValue: null,
  });

  public readonly showDeleteButton = computed(
    () => !!(this.generalSettings()?.behavior.deleteTorrentFile && this.originalPath()),
  );

  public readonly torrent = computed(() => {
    const h = this.hash();
    return h ? this.torrentStoreService.torrentsMap().get(h) : undefined;
  });

  constructor() {
    effect(() => {
      const h = this.hash();
      if (!h) return;
      this.filterService.resetAll();
      this.selectionStoreService.setByHashes([h]);
    });
  }

  public async deleteTorrentFile(): Promise<void> {
    const path = this.originalPath();
    if (!path) return;
    await window.bitbutler.torrent.deleteFile({ path });
    this.closeModal();
  }

  public openDetails(): void {
    const h = this.hash();
    if (h) {
      this.commandBusService.emit({ type: 'UI_SCROLL_TO_TORRENT', hash: h });
      this.commandBusService.emit({ type: 'UI_OPEN_TORRENT_DETAILS', hash: h });
    }
    this.closeModal();
  }

  public closeModal(): void {
    this.activeModal.close();
  }
}

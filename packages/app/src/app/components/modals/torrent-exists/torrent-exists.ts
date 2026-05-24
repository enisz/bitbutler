import {
  ChangeDetectionStrategy,
  Component,
  Input,
  computed,
  effect,
  inject,
  signal,
} from '@angular/core';
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
  private readonly _hash = signal<string | null>(null);

  @Input()
  set hash(value: string | null) {
    this._hash.set(value);
  }
  get hash(): string | null {
    return this._hash();
  }

  private readonly torrentStoreService = inject(TorrentStoreService);
  private readonly activeModal = inject(NgbActiveModal);
  private readonly selectionStoreService = inject(SelectionStoreService);
  private readonly filterService = inject(FilterService);
  private readonly commandBusService = inject(CommandBusService);

  public readonly torrent = computed(() => {
    const h = this._hash();
    return h ? this.torrentStoreService.torrentsMap().get(h) : undefined;
  });

  constructor() {
    effect(() => {
      const h = this._hash();
      if (!h) return;
      this.filterService.resetAll();
      this.selectionStoreService.setByHashes([h]);
    });
  }

  public openDetails(): void {
    const h = this._hash();
    if (h) {
      this.commandBusService.emit({ type: 'UI_OPEN_TORRENT_DETAILS', hash: h });
    }
    this.closeModal();
  }

  public closeModal(): void {
    this.activeModal.close();
  }
}

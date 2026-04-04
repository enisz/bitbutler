import { Component, computed, inject, Input, signal } from '@angular/core';
import { NgbActiveModal, NgbTooltip } from '@ng-bootstrap/ng-bootstrap';

import { TranslatePipe } from '@ngx-translate/core';
import { TimeagoPipe } from 'ngx-timeago';
import { AutofocusDirective } from '../../../directives/autofocus';
import { LocalTimestampPipe } from '../../../pipes/local-timestamp-pipe';
import { CommandBusService } from '../../../services/command-bus.service';
import { FilterService } from '../../../services/filter.service';
import { SelectionStoreService } from '../../../services/selection-store.service';
import { TorrentStoreService } from '../../../services/torrent-store.service';

@Component({
  selector: 'app-torrent-exists',
  standalone: true,
  imports: [LocalTimestampPipe, AutofocusDirective, TimeagoPipe, NgbTooltip, TranslatePipe],
  styleUrls: ['./torrent-exists.scss'],
  templateUrl: './torrent-exists.html',
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

  public showAndClose(): void {
    const currentTorrent = this.torrent();
    if (currentTorrent?.hash) {
      this.filterService.resetAll();
      this.selectionStoreService.setByHashes([currentTorrent.hash]);
      this.commandBusService.emit({
        type: 'UI_OPEN_TORRENT_DETAILS',
        hash: currentTorrent.hash,
      });
    }

    this.closeModal();
  }

  public closeModal(): void {
    this.activeModal.close();
  }
}

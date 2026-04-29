import { DestroyRef, Injectable, effect, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import type { GridApi } from 'ag-grid-community';
import { filter } from 'rxjs';
import { UiCommand } from '../../../models/command.model';
import { Torrent } from '../../../models/torrent.model';
import { CommandBusService } from '../../../services/command-bus.service';
import { GridStateService } from '../../../services/grid-state.service';
import { SelectionStoreService } from '../../../services/selection-store.service';
import { TorrentStoreService } from '../../../services/torrent-store.service';

@Injectable()
export class GridPinService {
  private readonly torrentStore = inject(TorrentStoreService);
  private readonly selectionStore = inject(SelectionStoreService);
  private readonly gridStateService = inject(GridStateService);
  private readonly commandBusService = inject(CommandBusService);
  private readonly destroyRef = inject(DestroyRef);

  private readonly _api = signal<GridApi<Torrent> | null>(null);
  private readonly pinnedTopHashes = signal<Set<string>>(new Set());
  private readonly pinnedBottomHashes = signal<Set<string>>(new Set());

  constructor() {
    effect(() => {
      const api = this._api();
      const torrents = this.torrentStore.torrentsArray();
      const topHashes = this.pinnedTopHashes();
      const bottomHashes = this.pinnedBottomHashes();
      if (!api) return;

      const pinnedTop = torrents.filter((t) => topHashes.has(t.hash));
      const pinnedBottom = torrents.filter((t) => bottomHashes.has(t.hash));
      const mainRows = torrents.filter((t) => !topHashes.has(t.hash) && !bottomHashes.has(t.hash));

      api.setGridOption('rowData', mainRows);
      api.setGridOption('pinnedTopRowData', pinnedTop);
      api.setGridOption('pinnedBottomRowData', pinnedBottom);
    });

    this.commandBusService.commands$
      .pipe(
        filter(
          (cmd): cmd is UiCommand =>
            cmd.type === 'UI_TORRENT_PIN_TOP' ||
            cmd.type === 'UI_TORRENT_PIN_BOTTOM' ||
            cmd.type === 'UI_TORRENT_UNPIN',
        ),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe((cmd) => {
        const hashes = this.selectionStore.selected().map((t) => t.hash);
        const hashSet = new Set(hashes);

        if (cmd.type === 'UI_TORRENT_UNPIN') {
          this.pinnedTopHashes.set(
            new Set([...this.pinnedTopHashes()].filter((h) => !hashSet.has(h))),
          );
          this.pinnedBottomHashes.set(
            new Set([...this.pinnedBottomHashes()].filter((h) => !hashSet.has(h))),
          );
        } else if (cmd.type === 'UI_TORRENT_PIN_TOP') {
          this.pinnedBottomHashes.set(
            new Set([...this.pinnedBottomHashes()].filter((h) => !hashSet.has(h))),
          );
          this.pinnedTopHashes.set(new Set([...this.pinnedTopHashes(), ...hashes]));
        } else {
          this.pinnedTopHashes.set(
            new Set([...this.pinnedTopHashes()].filter((h) => !hashSet.has(h))),
          );
          this.pinnedBottomHashes.set(new Set([...this.pinnedBottomHashes(), ...hashes]));
        }

        const api = this._api();
        if (api) {
          void this.gridStateService.save(
            api,
            [...this.pinnedTopHashes()],
            [...this.pinnedBottomHashes()],
          );
        }
      });
  }

  init(api: GridApi<Torrent>): void {
    this._api.set(api);
  }

  applyPinnedState(top: string[], bottom: string[]): void {
    this.pinnedTopHashes.set(new Set(top));
    this.pinnedBottomHashes.set(new Set(bottom));
  }

  getPinnedTopHashes(): string[] {
    return [...this.pinnedTopHashes()];
  }

  getPinnedBottomHashes(): string[] {
    return [...this.pinnedBottomHashes()];
  }
}

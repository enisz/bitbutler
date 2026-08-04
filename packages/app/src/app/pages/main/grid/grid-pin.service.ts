import { DestroyRef, Injectable, effect, inject, signal, untracked } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import type { GridApi } from 'ag-grid-community';
import { filter } from 'rxjs';
import { UiCommand } from '../../../models/command.model';
import { Torrent } from '../../../models/torrent.model';
import { CommandBusService } from '../../../services/command-bus.service';
import { GridStateService } from '../../../services/grid-state.service';
import { SelectionStoreService } from '../../../services/selection-store.service';
import { TorrentStoreService, TorrentTxnDelta } from '../../../services/torrent-store.service';

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

  // Kept in sync incrementally as deltas arrive, so a pinned-row change only
  // ever rebuilds these small maps instead of re-filtering the full torrent list.
  private pinnedTopMap = new Map<string, Torrent>();
  private pinnedBottomMap = new Map<string, Torrent>();

  constructor() {
    // Full resync: only runs when the grid becomes ready or pin membership changes
    // (both rare / user-driven), never on a routine poll tick.
    effect(() => {
      const api = this._api();
      const topHashes = this.pinnedTopHashes();
      const bottomHashes = this.pinnedBottomHashes();
      if (!api) return;

      const torrents = untracked(() => this.torrentStore.torrentsArray());
      this.resyncFromFullList(api, torrents, topHashes, bottomHashes);
    });

    // Routine updates: apply the exact add/update/remove delta as a grid
    // transaction instead of resetting rowData, so cost scales with what
    // actually changed rather than with the full row count.
    this.torrentStore.delta$.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((delta) => {
      const api = this._api();
      if (!api) return;

      if (delta.fullUpdate) {
        this.resyncFromFullList(
          api,
          this.torrentStore.torrentsArray(),
          this.pinnedTopHashes(),
          this.pinnedBottomHashes(),
        );
        return;
      }

      this.applyIncrementalDelta(api, delta);
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

  private resyncFromFullList(
    api: GridApi<Torrent>,
    torrents: Torrent[],
    topHashes: Set<string>,
    bottomHashes: Set<string>,
  ): void {
    this.pinnedTopMap = new Map(
      torrents.filter((t) => topHashes.has(t.hash)).map((t) => [t.hash, t]),
    );
    this.pinnedBottomMap = new Map(
      torrents.filter((t) => bottomHashes.has(t.hash)).map((t) => [t.hash, t]),
    );
    const mainRows = torrents.filter((t) => !topHashes.has(t.hash) && !bottomHashes.has(t.hash));

    api.setGridOption('rowData', mainRows);
    api.setGridOption('pinnedTopRowData', [...this.pinnedTopMap.values()]);
    api.setGridOption('pinnedBottomRowData', [...this.pinnedBottomMap.values()]);
  }

  private applyIncrementalDelta(api: GridApi<Torrent>, delta: TorrentTxnDelta): void {
    const topHashes = this.pinnedTopHashes();
    const bottomHashes = this.pinnedBottomHashes();

    const mainAdd: Torrent[] = [];
    const mainUpdate: Torrent[] = [];
    const mainRemove: Torrent[] = [];
    let pinnedTopChanged = false;
    let pinnedBottomChanged = false;

    for (const t of delta.add) {
      if (topHashes.has(t.hash)) {
        this.pinnedTopMap.set(t.hash, t);
        pinnedTopChanged = true;
      } else if (bottomHashes.has(t.hash)) {
        this.pinnedBottomMap.set(t.hash, t);
        pinnedBottomChanged = true;
      } else {
        mainAdd.push(t);
      }
    }

    for (const t of delta.update) {
      if (topHashes.has(t.hash)) {
        this.pinnedTopMap.set(t.hash, t);
        pinnedTopChanged = true;
      } else if (bottomHashes.has(t.hash)) {
        this.pinnedBottomMap.set(t.hash, t);
        pinnedBottomChanged = true;
      } else {
        mainUpdate.push(t);
      }
    }

    for (const t of delta.remove) {
      if (this.pinnedTopMap.delete(t.hash)) {
        pinnedTopChanged = true;
      } else if (this.pinnedBottomMap.delete(t.hash)) {
        pinnedBottomChanged = true;
      } else {
        mainRemove.push(t);
      }
    }

    if (mainAdd.length || mainUpdate.length || mainRemove.length) {
      api.applyTransaction({ add: mainAdd, update: mainUpdate, remove: mainRemove });
    }
    if (pinnedTopChanged) {
      api.setGridOption('pinnedTopRowData', [...this.pinnedTopMap.values()]);
    }
    if (pinnedBottomChanged) {
      api.setGridOption('pinnedBottomRowData', [...this.pinnedBottomMap.values()]);
    }
  }
}

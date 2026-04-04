import { computed, inject, Injectable, signal } from '@angular/core';
import { Torrent } from '../models/torrent.model';
import { TorrentStoreService } from './torrent-store.service';

@Injectable({ providedIn: 'root' })
export class SelectionStoreService {
  private readonly torrents = inject(TorrentStoreService).torrentsMap;

  readonly selected = signal<Torrent[]>([]);

  readonly selectedHashes = computed(() =>
    (this.selected() ?? []).map((t) => (t?.hash ?? '').trim()).filter(Boolean),
  );

  set(rows: Torrent[] | Torrent) {
    this.selected.set(Array.isArray(rows) ? rows : [rows]);
  }

  setByHashes(hashes: string[]) {
    const all = this.torrents();
    const selected: Torrent[] = [];

    for (const hash of hashes) {
      const torrent = all.get(hash);
      if (torrent) {
        selected.push(torrent);
      }
    }

    this.selected.set(selected);
  }

  clear() {
    this.selected.set([]);
  }
}

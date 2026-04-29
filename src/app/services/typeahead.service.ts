import { Injectable, computed, inject } from '@angular/core';
import { Observable, map } from 'rxjs';
import { TorrentStoreService } from './torrent-store.service';

@Injectable({
  providedIn: 'root',
})
export class TypeaheadService {
  private readonly torrentStoreService = inject(TorrentStoreService);
  private readonly typeaheadResultSetSize = 5;

  private paths = computed(() => {
    const uniquePaths = new Set<string>();
    const torrents = this.torrentStoreService.torrentsArray();

    for (const t of torrents) {
      const path = t.save_path?.trim();
      if (path) {
        uniquePaths.add(path);
      }
    }

    return Array.from(uniquePaths);
  });

  public searchSavePaths = (text$: Observable<string>): Observable<string[]> => {
    return text$.pipe(
      map((term) => {
        const list = this.paths().sort();
        const t = (term ?? '').trim().toLowerCase();

        return !t
          ? []
          : list
              .filter((p) => p.toLowerCase().includes(t) && p.toLowerCase() !== t)
              .slice(0, this.typeaheadResultSetSize);
      }),
    );
  };
}

import { Injectable, computed, inject } from '@angular/core';
import { Observable, map } from 'rxjs';
import { TorrentStoreService } from '../../services/torrent-store.service';

@Injectable()
export class SavePathTypeaheadService {
  private readonly torrentStoreService = inject(TorrentStoreService);
  private readonly resultSetSize = 5;

  private readonly paths = computed(() => {
    const uniquePaths = new Set<string>();
    for (const t of this.torrentStoreService.torrentsArray()) {
      const path = t.save_path?.trim();
      if (path) uniquePaths.add(path);
    }
    return Array.from(uniquePaths);
  });

  public searchSavePaths = (text$: Observable<string>): Observable<string[]> =>
    text$.pipe(
      map((term) => {
        const t = (term ?? '').trim().toLowerCase();
        if (!t) return [];
        return this.paths()
          .sort()
          .filter((p) => p.toLowerCase().includes(t) && p.toLowerCase() !== t)
          .slice(0, this.resultSetSize);
      }),
    );
}

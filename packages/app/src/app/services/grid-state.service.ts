import { Injectable, inject } from '@angular/core';
import type { ColumnState, GridApi } from 'ag-grid-community';
import { filter, firstValueFrom } from 'rxjs';
import { TorrentListGridSettingsService } from './torrent-list-grid.settings.service';

@Injectable({ providedIn: 'root' })
export class GridStateService {
  private readonly torrentListGridSettingsService = inject(TorrentListGridSettingsService);

  async restore(api: GridApi): Promise<boolean> {
    const prefs = await firstValueFrom(this.torrentListGridSettingsService.asObservable());
    if (!prefs) return false;

    const hasColumnState = Array.isArray(prefs.columnState) && prefs.columnState.length > 0;
    const hasFilterModel = !!prefs.filterModel && Object.keys(prefs.filterModel).length > 0;

    if (hasColumnState && prefs.columnState) {
      api.applyColumnState({ state: prefs.columnState as ColumnState[], applyOrder: true });
    }

    api.setFilterModel(prefs.filterModel ?? null);

    return hasColumnState || hasFilterModel;
  }

  async save(api: GridApi, pinnedTopHashes: string[], pinnedBottomHashes: string[]): Promise<void> {
    const settings = await firstValueFrom(
      this.torrentListGridSettingsService
        .asObservable()
        .pipe(filter((s): s is NonNullable<typeof s> => s !== null)),
    );
    await this.torrentListGridSettingsService.save({
      ...settings,
      columnState: api.getColumnState(),
      filterModel: api.getFilterModel(),
      pinnedTopHashes,
      pinnedBottomHashes,
    });
  }

  async resetToDefaults(api: GridApi): Promise<void> {
    const settings = await firstValueFrom(
      this.torrentListGridSettingsService
        .asObservable()
        .pipe(filter((s): s is NonNullable<typeof s> => s !== null)),
    );
    await this.torrentListGridSettingsService.save({
      ...settings,
      columnState: null,
      filterModel: null,
      pinnedTopHashes: [],
      pinnedBottomHashes: [],
    });
    api.setFilterModel(null);
    api.resetColumnState();
    api.setGridOption('pinnedTopRowData', []);
    api.setGridOption('pinnedBottomRowData', []);
  }
}

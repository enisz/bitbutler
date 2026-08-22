import { Injectable, inject } from '@angular/core';
import { TranslateService } from '@ngx-translate/core';
import type { ColumnState } from 'ag-grid-community';
import {
  DEFAULT_TORRENT_LIST_GRID_SETTINGS,
  TorrentListGridSettings,
} from '../models/torrent-list-grid.model';
import { getGridColDefs } from '../pages/main/grid/grid.lib';
import { BaseSettingsService } from './base-settings.service';
import { TorrentStoreService } from './torrent-store.service';
import { UiFormatService } from './ui-format.service';

@Injectable({ providedIn: 'root' })
export class TorrentListGridSettingsService extends BaseSettingsService<TorrentListGridSettings> {
  protected readonly SETTINGS_ID = 'TorrentListGridSettingsService';
  protected readonly DEFAULT_SETTINGS = DEFAULT_TORRENT_LIST_GRID_SETTINGS;

  private readonly uiFormatService = inject(UiFormatService);
  private readonly translateService = inject(TranslateService);
  private readonly torrentStoreService = inject(TorrentStoreService);

  protected override normalize(settings: TorrentListGridSettings): TorrentListGridSettings {
    const normalized = { ...settings };

    if (this.isColumnStateStrings(normalized.columnState)) {
      const allDefs = getGridColDefs(
        this.uiFormatService,
        this.translateService,
        this.torrentStoreService,
      );
      const visibleIds = normalized.columnState as string[];
      const defsMap = new Map(allDefs.map((d) => [d.colId!, d]));
      const currentState: ColumnState[] = [];

      visibleIds.forEach((id) => {
        const def = defsMap.get(id);
        if (def) {
          currentState.push({
            colId: def.colId!,
            hide: false,
            width: typeof def.width === 'number' ? def.width : undefined,
            flex: def.flex ?? (typeof def.width === 'number' ? undefined : 1),
            sort: def.sort === 'asc' || def.sort === 'desc' ? def.sort : null,
            pinned: def.pinned ?? null,
          });
          defsMap.delete(id);
        }
      });

      defsMap.forEach((def) => {
        currentState.push({
          colId: def.colId!,
          hide: true,
          width: typeof def.width === 'number' ? def.width : undefined,
          flex: def.flex ?? (typeof def.width === 'number' ? undefined : 1),
          sort: def.sort === 'asc' || def.sort === 'desc' ? def.sort : null,
          pinned: def.pinned ?? null,
        });
      });

      normalized.columnState = currentState;
    }

    return normalized;
  }

  private isColumnStateStrings(state: TorrentListGridSettings['columnState']): state is string[] {
    if (!Array.isArray(state) || state.length === 0) {
      return false;
    }
    return typeof state[0] === 'string';
  }
}

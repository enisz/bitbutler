import { Injectable, inject } from '@angular/core';
import { CellValueChangedEvent, ColDef, GridApi } from 'ag-grid-community';
import { Torrent } from '../../../models/torrent.model';
import { QbService } from '../../../services/qb.service';
import { ServerStoreService } from '../../../services/server-store.service';

const INLINE_EDITABLE_COL_IDS = new Set([
  'name',
  'save_path',
  'download_path',
  'category',
  'tags',
  'dl_limit_raw',
  'up_limit_raw',
  'seeding_time_limit_raw',
  'inactive_seeding_time_limit_raw',
  'auto_tmm',
  'seq_dl',
  'force_start',
  'super_seeding',
  'f_l_piece_prio',
]);

const BOOLEAN_COL_IDS = new Set([
  'auto_tmm',
  'seq_dl',
  'force_start',
  'super_seeding',
  'f_l_piece_prio',
]);

@Injectable()
export class GridInlineEditService {
  private readonly qb = inject(QbService);
  private readonly serverStore = inject(ServerStoreService);

  applyEditableState(api: GridApi<Torrent>, isInlineEdit: boolean): void {
    const currentDefs = api.getColumnDefs() ?? [];
    const newDefs = currentDefs.map((d) => {
      const colDef = { ...(d as ColDef<Torrent>) };
      const colId = colDef.colId;
      if (!colId || !INLINE_EDITABLE_COL_IDS.has(colId)) return colDef;

      if (isInlineEdit) {
        colDef.editable = true;
      } else if (BOOLEAN_COL_IDS.has(colId)) {
        colDef.editable = false;
      } else {
        delete colDef.editable;
      }
      return colDef;
    });
    api.updateGridOptions({ columnDefs: newDefs as ColDef<any>[] });
  }

  async handleCellValueChanged(event: CellValueChangedEvent<Torrent>): Promise<void> {
    const serverId = this.serverStore.currentServer()?.id;
    if (!serverId || !event.data) return;

    const colId = event.colDef.colId;
    const hash = event.data.hash;
    const newValue = event.newValue;
    const data = event.data;

    try {
      switch (colId) {
        case 'name':
          await this.qb.torrents.rename(serverId, hash, String(newValue ?? ''));
          break;
        case 'save_path':
          await this.qb.torrents.setLocation(serverId, [hash], String(newValue ?? ''));
          break;
        case 'download_path':
          await this.qb.torrents.setDownloadPath(serverId, [hash], String(newValue ?? ''));
          break;
        case 'category':
          await this.qb.torrents.setCategory(serverId, [hash], String(newValue ?? ''));
          break;
        case 'tags': {
          await this.qb.torrents.removeAllTags(serverId, [hash]);
          const tags = String(newValue ?? '')
            .split(',')
            .map((t) => t.trim())
            .filter(Boolean);
          if (tags.length > 0) {
            await this.qb.torrents.addTags(serverId, [hash], tags);
          }
          break;
        }
        case 'dl_limit_raw':
          await this.qb.torrents.setDownloadLimit(serverId, Number(newValue), [hash]);
          break;
        case 'up_limit_raw':
          await this.qb.torrents.setUploadLimit(serverId, Number(newValue), [hash]);
          break;
        case 'seeding_time_limit_raw':
          await this.qb.torrents.setShareLimits(
            serverId,
            [hash],
            data.ratio_limit,
            Number(newValue),
            data.inactive_seeding_time_limit,
          );
          break;
        case 'inactive_seeding_time_limit_raw':
          await this.qb.torrents.setShareLimits(
            serverId,
            [hash],
            data.ratio_limit,
            data.seeding_time_limit,
            Number(newValue),
          );
          break;
        case 'seq_dl':
          await this.qb.torrents.toggleSequentialDownload(serverId, [hash]);
          break;
        case 'force_start':
          await this.qb.torrents.setForceStart(serverId, [hash], Boolean(newValue));
          break;
        case 'super_seeding':
          await this.qb.torrents.setSuperSeeding(serverId, [hash], Boolean(newValue));
          break;
        case 'auto_tmm':
          await this.qb.torrents.setAutoManagement(serverId, [hash], Boolean(newValue));
          break;
        case 'f_l_piece_prio':
          await this.qb.torrents.toggleFirstLastPiecePrio(serverId, [hash]);
          break;
      }
    } catch {
      // QbService.request already shows the error toast before re-throwing
    }
  }
}

import { inject, Injectable } from '@angular/core';
import { faSquare, faSquareCheck } from '@fortawesome/free-regular-svg-icons';
import {
  faArrowDown,
  faArrowLeft,
  faArrowRight,
  faArrowsDownToLine,
  faArrowsUpToLine,
  faArrowUp,
  faBullhorn,
  faCheck,
  faCode,
  faCopy,
  faDownload,
  faEye,
  faEyeSlash,
  faFilePen,
  faFilterCircleXmark,
  faFolderOpen,
  faFolderTree,
  faForwardFast,
  faHashtag,
  faInfoCircle,
  faLink,
  faPause,
  faPen,
  faPlay,
  faRotate,
  faShare,
  faTags,
  faTrashCan,
  faUpload,
  faXmark,
} from '@fortawesome/free-solid-svg-icons';
import type { Column, ColumnHeaderContextMenuEvent } from 'ag-grid-community';

import { Clipboard } from '@angular/cdk/clipboard';
import { CommandBusService } from '../../../../services/command-bus.service';
import { FilterService } from '../../../../services/filter.service';
import { PathService } from '../../../../services/path.service';
import { QbService } from '../../../../services/qb.service';
import { ServerStoreService } from '../../../../services/server-store.service';
import { ContextMenuEntry, GridContextMenuData } from './context-menu.types';

@Injectable({ providedIn: 'root' })
export class GridContextMenuService {
  private readonly commandBusService = inject(CommandBusService);
  private readonly clipboard = inject(Clipboard);
  private readonly filterService = inject(FilterService);
  private readonly pathService = inject(PathService);
  private readonly qbService = inject(QbService);
  private readonly serverStoreService = inject(ServerStoreService);

  public async buildTorrentMenu(data: GridContextMenuData): Promise<ContextMenuEntry[]> {
    return [
      {
        kind: 'header',
        label: 'pages.main.grid.context-menu.header.cell',
      },
      {
        kind: 'item',
        id: 'cell.copyValue',
        label: 'pages.main.grid.context-menu.item.copy-cell-value',
        icon: faCopy,
        action: () => this.clipboard.copy(String(data.cell.value)),
      },
      { kind: 'divider' },
      { kind: 'header', label: 'pages.main.grid.context-menu.header.row' },
      {
        kind: 'item',
        id: 'row.pinToTop',
        icon: faArrowUp,
        label: 'pages.main.grid.context-menu.item.pin-to-top',
        disabled: data.rowPinned === 'top',
        action: () => this.commandBusService.emit({ type: 'UI_TORRENT_PIN_TOP' }),
      },
      {
        kind: 'item',
        id: 'row.pinToBottom',
        icon: faArrowDown,
        label: 'pages.main.grid.context-menu.item.pin-to-bottom',
        disabled: data.rowPinned === 'bottom',
        action: () => this.commandBusService.emit({ type: 'UI_TORRENT_PIN_BOTTOM' }),
      },
      {
        kind: 'item',
        id: 'row.unpin',
        icon: faXmark,
        label: 'pages.main.grid.context-menu.item.unpin',
        disabled: !data.rowPinned,
        action: () => this.commandBusService.emit({ type: 'UI_TORRENT_UNPIN' }),
      },
      { kind: 'divider' },
      {
        kind: 'header',
        label: 'pages.main.grid.context-menu.header.torrent',
      },
      {
        kind: 'item',
        id: 'torrent.copyInfoHash',
        label: 'pages.main.grid.context-menu.item.copy-info-hash',
        icon: faHashtag,
        action: () => this.clipboard.copy(String(data.row.hash)),
      },
      {
        kind: 'item',
        id: 'torrent.copyMagnet',
        label: 'pages.main.grid.context-menu.item.copy-magnet-link',
        icon: faLink,
        action: () => this.clipboard.copy(String(data.row.magnet_uri)),
      },
      {
        kind: 'item',
        id: 'torrent.copyJson',
        label: 'pages.main.grid.context-menu.item.copy-as-json',
        icon: faCode,
        action: () => this.clipboard.copy(String(JSON.stringify(data.row, null, 2))),
      },
      {
        kind: 'item',
        id: 'torrent.details',
        label: 'pages.main.grid.context-menu.item.torrent-details',
        icon: faInfoCircle,
        variant: 'info',
        action: () =>
          this.commandBusService.emit({ type: 'UI_OPEN_TORRENT_DETAILS', hash: data.row.hash }),
      },
      {
        kind: 'submenu',
        id: 'test.nested',
        label: 'Test Submenu',
        icon: faCode,
        children: [
          { kind: 'header', label: 'Nested Header' },
          { kind: 'item', id: 'test.nested.a', label: 'Nested Item A', icon: faPlay },
          { kind: 'item', id: 'test.nested.b', label: 'Nested Item B', icon: faPause },
          { kind: 'divider' },
          {
            kind: 'submenu',
            id: 'test.nested.deep',
            label: 'Deeper Submenu',
            icon: faCode,
            children: [
              { kind: 'item', id: 'test.deep.a', label: 'Deep Item A' },
              { kind: 'item', id: 'test.deep.b', label: 'Deep Item B' },
            ],
          },
        ],
      },
      { kind: 'divider' },
      {
        kind: 'header',
        label: 'pages.main.grid.context-menu.header.control',
      },
      {
        kind: 'item',
        id: 'control.start',
        label: 'pages.main.grid.context-menu.item.start',
        icon: faPlay,
        variant: 'success',
        action: () => this.commandBusService.emit({ type: 'TORRENT_RESUME' }),
      },
      {
        kind: 'item',
        id: 'control.stop',
        label: 'pages.main.grid.context-menu.item.stop',
        icon: faPause,
        variant: 'warning',
        action: () => this.commandBusService.emit({ type: 'TORRENT_PAUSE' }),
      },
      {
        kind: 'item',
        id: 'control.forceResume',
        label: 'pages.main.grid.context-menu.item.force-resume',
        icon: faForwardFast,
        action: () => this.commandBusService.emit({ type: 'TORRENT_FORCE_RESUME' }),
      },
      { kind: 'divider' },
      {
        kind: 'header',
        label: 'pages.main.grid.context-menu.header.files',
      },
      {
        kind: 'item',
        id: 'files.setLocation',
        label: 'pages.main.grid.context-menu.item.set-location',
        icon: faFolderOpen,
        action: () =>
          this.commandBusService.emit({ type: 'UI_SET_TORRENT_LOCATION', torrent: data.row }),
      },
      {
        kind: 'item',
        id: 'files.openDestination',
        label:
          (
            await this.qbService.torrentContents(
              this.serverStoreService.currentServerId() as string,
              data.row.hash,
            )
          ).length === 1
            ? 'pages.main.grid.context-menu.item.show-in-folder'
            : 'pages.main.grid.context-menu.item.open-destination',
        icon: faFolderOpen,
        disabled: (await this.pathService.resolveLocalPath(data.row.save_path)) === null,
        action: () =>
          this.commandBusService.emit({
            type: 'UI_OPEN_DESTINATION',
            remotePath: data.row.content_path,
            hash: data.row.hash,
          }),
      },
      {
        kind: 'item',
        id: 'files.renameTorrent',
        label: 'pages.main.grid.context-menu.item.rename-torrent',
        icon: faPen,
        action: () => this.commandBusService.emit({ type: 'UI_RENAME_TORRENT', torrent: data.row }),
      },
      {
        kind: 'item',
        id: 'files.renameFiles',
        label: 'pages.main.grid.context-menu.item.rename-files',
        icon: faFilePen,
        action: () => this.commandBusService.emit({ type: 'UI_RENAME_FILES', hash: data.row.hash }),
      },
      {
        kind: 'item',
        id: 'files.category',
        label: 'pages.main.grid.context-menu.item.set-category',
        icon: faFolderTree,
        action: () =>
          this.commandBusService.emit({ type: 'UI_SET_TORRENT_CATEGORY', torrent: data.row }),
      },
      {
        kind: 'item',
        id: 'files.tags',
        label: 'pages.main.grid.context-menu.item.set-tags',
        icon: faTags,
        action: () =>
          this.commandBusService.emit({ type: 'UI_SET_TORRENT_TAGS', torrent: data.row }),
      },
      {
        kind: 'item',
        id: 'files.remove',
        label: 'pages.main.grid.context-menu.item.remove',
        icon: faTrashCan,
        variant: 'danger',
        action: () =>
          this.commandBusService.emit({
            type: 'UI_TORRENT_DELETE_REQUEST',
            defaultRemoveFiles: false,
          }),
      },
      { kind: 'divider' },
      {
        kind: 'header',
        label: 'pages.main.grid.context-menu.header.speed',
      },
      {
        kind: 'item',
        id: 'speed.limitUpload',
        label: 'pages.main.grid.context-menu.item.limit-upload-rate',
        icon: faUpload,
        action: () =>
          this.commandBusService.emit({
            type: 'UI_LIMIT_TRANSFER',
            direction: 'ul',
            target: 'torrent',
          }),
      },
      {
        kind: 'item',
        id: 'speed.limitDownload',
        label: 'pages.main.grid.context-menu.item.limit-download-rate',
        icon: faDownload,
        action: () =>
          this.commandBusService.emit({
            type: 'UI_LIMIT_TRANSFER',
            direction: 'dl',
            target: 'torrent',
          }),
      },
      {
        kind: 'item',
        id: 'speed.limitTorrentShare',
        label: 'pages.main.grid.context-menu.item.limit-torrent-share',
        icon: faShare,
        action: () => {
          this.commandBusService.emit({
            type: 'UI_LIMIT_SHARE',
          });
        },
      },
      {
        kind: 'item',
        id: 'speed.superSeeding',
        label: data.row.super_seeding
          ? 'pages.main.grid.context-menu.item.disable-super-seeding'
          : 'pages.main.grid.context-menu.item.enable-super-seeding',
        icon: data.row.super_seeding ? faSquareCheck : faSquare,
        action: () =>
          this.commandBusService.emit({
            type: 'TORRENT_SUPER_SEEDING',
            status: data.row.super_seeding,
          }),
      },
      { kind: 'divider' },
      {
        kind: 'header',
        label: 'pages.main.grid.context-menu.header.maintenance',
      },
      {
        kind: 'item',
        id: 'maintenance.forceRecheck',
        label: 'pages.main.grid.context-menu.item.force-recheck',
        icon: faRotate,
        action: () => this.commandBusService.emit({ type: 'TORRENT_RECHECK' }),
      },
      {
        kind: 'item',
        id: 'maintenance.forceReannounce',
        label: 'pages.main.grid.context-menu.item.force-reannounce',
        icon: faBullhorn,
        action: () => this.commandBusService.emit({ type: 'TORRENT_REANNOUNCE' }),
      },
      {
        kind: 'item',
        id: 'maintenance.autoTmm',
        label: data.row.auto_tmm
          ? 'pages.main.grid.context-menu.item.disable-auto-tmm'
          : 'pages.main.grid.context-menu.item.enable-auto-tmm',
        icon: data.row.auto_tmm ? faSquareCheck : faSquare,
        action: () =>
          this.commandBusService.emit({ type: 'TORRENT_AUTO_TMM', status: data.row.auto_tmm }),
      },
      { kind: 'divider' },
      {
        kind: 'header',
        label: 'pages.main.grid.context-menu.header.queue',
      },
      {
        kind: 'item',
        id: 'queue.moveTop',
        label: 'pages.main.grid.context-menu.item.move-to-top',
        icon: faArrowsUpToLine,
        variant: 'info',
        action: () => this.commandBusService.emit({ type: 'QUEUE_MOVE_TOP' }),
      },
      {
        kind: 'item',
        id: 'queue.moveUp',
        label: 'pages.main.grid.context-menu.item.move-up',
        icon: faArrowUp,
        variant: 'info',
        action: () => this.commandBusService.emit({ type: 'QUEUE_MOVE_UP' }),
      },
      {
        kind: 'item',
        id: 'queue.moveDown',
        label: 'pages.main.grid.context-menu.item.move-down',
        icon: faArrowDown,
        variant: 'info',
        action: () => this.commandBusService.emit({ type: 'QUEUE_MOVE_DOWN' }),
      },
      {
        kind: 'item',
        id: 'queue.moveBottom',
        label: 'pages.main.grid.context-menu.item.move-to-bottom',
        icon: faArrowsDownToLine,
        variant: 'info',
        action: () => this.commandBusService.emit({ type: 'QUEUE_MOVE_BOTTOM' }),
      },
    ];
  }

  public buildHeaderMenu(event: ColumnHeaderContextMenuEvent<any, any>): ContextMenuEntry[] {
    const api = event.api;
    const column = event.column as Column;

    const columns =
      api
        .getColumns()
        ?.map((c: Column<any>) => {
          const { colId, headerName } = c.getColDef();
          return { id: colId ?? '', label: headerName ?? '', visible: c.isVisible() };
        })
        .sort((a, b) => a.label.localeCompare(b.label)) ?? [];

    const fields: ContextMenuEntry[] = columns.map(({ id, label, visible }) => ({
      kind: 'item',
      id: `toggle.${id}`,
      label: `${label} (${id})`,
      icon: visible ? faCheck : undefined,
      action: () => {
        const col = api.getColumn(id);
        if (!col) return;
        api.setColumnsVisible([id], !col.isVisible());
      },
    }));

    const payload = {
      colId: column.getId(),
      displayName: api.getDisplayNameForColumn(column, 'header'),
    };

    const items: ContextMenuEntry[] = [
      { kind: 'header', label: payload.displayName },
      {
        kind: 'item',
        id: `toggle.${payload.colId}`,
        label: 'pages.main.grid.context-menu.item.hide-column',
        icon: faEyeSlash,
        action: () => {
          const col = api.getColumn(payload.colId);
          if (!col) return;
          api.setColumnsVisible([payload.colId], !col.isVisible());
        },
      },
      {
        kind: 'item',
        id: `clearFilter.${payload.colId}`,
        label: 'pages.main.grid.context-menu.item.clear-filter',
        icon: faFilterCircleXmark,
        disabled: !column.isFilterActive(),
        action: () => {
          this.filterService.clearColumnFilter(payload.colId);
        },
      },
      {
        kind: 'item',
        id: `pinLeft.${payload.colId}`,
        label: 'pages.main.grid.context-menu.item.pin-left',
        icon: faArrowLeft,
        disabled: column.isPinnedLeft(),
        action: () => api.setColumnsPinned([payload.colId], 'left'),
      },
      {
        kind: 'item',
        id: `pinRight.${payload.colId}`,
        label: 'pages.main.grid.context-menu.item.pin-right',
        icon: faArrowRight,
        disabled: column.isPinnedRight(),
        action: () => api.setColumnsPinned([payload.colId], 'right'),
      },
      {
        kind: 'item',
        id: `unpinColumn.${payload.colId}`,
        label: 'pages.main.grid.context-menu.item.unpin-column',
        icon: faXmark,
        disabled: !column.getPinned(),
        action: () => api.setColumnsPinned([payload.colId], null),
      },
      { kind: 'divider' },
      {
        kind: 'header',
        label: 'pages.main.grid.context-menu.header.fields',
      },
      ...fields,
      { kind: 'divider' },
      {
        kind: 'header',
        label: 'pages.main.grid.context-menu.header.visibility',
      },
      {
        kind: 'item',
        id: 'all.show',
        label: 'pages.main.grid.context-menu.item.show-all',
        icon: faEye,
        action: () => {
          const cols = api.getColumns();
          if (!cols) return;

          api.setColumnsVisible(
            cols.map((c) => c.getColId()),
            true,
          );
        },
      },
      {
        kind: 'item',
        id: 'all.hide',
        label: 'pages.main.grid.context-menu.item.hide-all',
        icon: faEyeSlash,
        action: () => {
          const cols = api.getColumns();
          if (!cols) return;

          api.setColumnsVisible(
            cols.map((c) => c.getColId()),
            false,
          );
        },
      },
    ];

    return items;
  }
}

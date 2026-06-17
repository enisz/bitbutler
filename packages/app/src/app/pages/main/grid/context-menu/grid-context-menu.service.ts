import { Clipboard } from '@angular/cdk/clipboard';
import { Injectable, inject } from '@angular/core';
import { faSquare, faSquareCheck, faSquareMinus } from '@fortawesome/free-regular-svg-icons';
import {
  faArrowDown,
  faArrowDownUpAcrossLine,
  faArrowLeft,
  faArrowRight,
  faArrowUp,
  faArrowsDownToLine,
  faArrowsLeftRight,
  faArrowsUpToLine,
  faBullhorn,
  faCheck,
  faCode,
  faCopy,
  faEye,
  faEyeSlash,
  faFilePen,
  faFilter,
  faFilterCircleXmark,
  faFolderOpen,
  faFolderTree,
  faForwardFast,
  faHashtag,
  faInfoCircle,
  faLink,
  faPause,
  faPenToSquare,
  faPlaneDeparture,
  faPlay,
  faRotate,
  faShare,
  faSort,
  faSortDown,
  faSortUp,
  faTableColumns,
  faTags,
  faThumbTack,
  faThumbTackSlash,
  faTrashCan,
  faXmark,
} from '@fortawesome/free-solid-svg-icons';
import type { ColDef, Column, ColumnHeaderContextMenuEvent } from 'ag-grid-community';
import { filter, firstValueFrom } from 'rxjs';
import { CommandBusService } from '../../../../services/command-bus.service';
import { FilterService } from '../../../../services/filter.service';
import { PathService } from '../../../../services/path.service';
import { QbService } from '../../../../services/qb.service';
import { ServerStoreService } from '../../../../services/server-store.service';
import { TorrentListGridSettingsService } from '../../../../services/torrent-list-grid.settings.service';
import { ContextMenuEntry, GridContextMenuData } from './context-menu.types';

@Injectable({ providedIn: 'root' })
export class GridContextMenuService {
  private readonly commandBusService = inject(CommandBusService);
  private readonly clipboard = inject(Clipboard);
  private readonly filterService = inject(FilterService);
  private readonly pathService = inject(PathService);
  private readonly qbService = inject(QbService);
  private readonly serverStoreService = inject(ServerStoreService);
  private readonly torrentListGridSettingsService = inject(TorrentListGridSettingsService);

  public async buildTorrentMenu(data: GridContextMenuData): Promise<ContextMenuEntry[]> {
    const isMulti = data.selected.length > 1;
    const hashes = data.selected.map((torrent) => torrent.hash);

    const allSuperSeeding = data.selected.every((torrent) => torrent.super_seeding);
    const noneSuperSeeding = data.selected.every((torrent) => !torrent.super_seeding);

    const allAutoTmm = data.selected.every((torrent) => torrent.auto_tmm);
    const noneAutoTmm = data.selected.every((torrent) => !torrent.auto_tmm);

    return [
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
      ...(isMulti
        ? []
        : [
            {
              kind: 'item' as const,
              id: 'torrent.details',
              label: 'pages.main.grid.context-menu.item.torrent-details',
              icon: faInfoCircle,
              variant: 'info' as const,
              action: () =>
                this.commandBusService.emit({
                  type: 'UI_OPEN_TORRENT_DETAILS',
                  hash: data.row.hash,
                }),
            },
            { kind: 'divider' as const },
          ]),

      {
        kind: 'submenu',
        id: 'files',
        label: 'pages.main.grid.context-menu.submenu.files',
        icon: faFolderOpen,
        children: [
          ...(isMulti
            ? []
            : [
                {
                  kind: 'item' as const,
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
              ]),
          {
            kind: 'item',
            id: 'files.setLocation',
            label: 'pages.main.grid.context-menu.item.set-location',
            icon: faFolderOpen,
            action: () =>
              this.commandBusService.emit({
                type: 'UI_SET_TORRENT_LOCATION',
                torrent: data.row,
                hashes,
              }),
          },
          ...(isMulti
            ? []
            : [
                {
                  kind: 'item' as const,
                  id: 'files.renameTorrent',
                  label: 'pages.main.grid.context-menu.item.rename-torrent',
                  icon: faPenToSquare,
                  action: () =>
                    this.commandBusService.emit({ type: 'UI_RENAME_TORRENT', torrent: data.row }),
                },
                {
                  kind: 'item' as const,
                  id: 'files.renameFiles',
                  label: 'pages.main.grid.context-menu.item.rename-files',
                  icon: faFilePen,
                  action: () =>
                    this.commandBusService.emit({ type: 'UI_RENAME_FILES', hash: data.row.hash }),
                },
              ]),
          {
            kind: 'item',
            id: 'files.category',
            label: 'pages.main.grid.context-menu.item.set-category',
            icon: faFolderTree,
            action: () =>
              this.commandBusService.emit({
                type: 'UI_SET_TORRENT_CATEGORY',
                torrent: data.row,
                hashes,
              }),
          },
          {
            kind: 'item',
            id: 'files.tags',
            label: 'pages.main.grid.context-menu.item.set-tags',
            icon: faTags,
            action: () =>
              this.commandBusService.emit({
                type: 'UI_SET_TORRENT_TAGS',
                torrent: data.row,
                hashes,
              }),
          },
        ],
      },

      {
        kind: 'submenu',
        id: 'queue',
        label: 'pages.main.grid.context-menu.submenu.queue',
        icon: faArrowsUpToLine,
        children: [
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
        ],
      },

      {
        kind: 'submenu',
        id: 'transfer',
        label: 'pages.main.grid.context-menu.submenu.transfer',
        icon: faPlaneDeparture,
        children: [
          {
            kind: 'item',
            id: 'speed.limitTransferRate',
            label: 'pages.main.grid.context-menu.item.transfer-limit',
            icon: faArrowDownUpAcrossLine,
            action: () =>
              this.commandBusService.emit({
                type: 'UI_LIMIT_TRANSFER',
                target: 'torrent',
              }),
          },
          {
            kind: 'item',
            id: 'speed.limitTorrentShare',
            label: 'pages.main.grid.context-menu.item.share-limit',
            icon: faShare,
            action: () => this.commandBusService.emit({ type: 'UI_LIMIT_SHARE' }),
          },
          {
            kind: 'item',
            id: 'speed.superSeeding',
            label: allSuperSeeding
              ? 'pages.main.grid.context-menu.item.disable-super-seeding'
              : 'pages.main.grid.context-menu.item.enable-super-seeding',
            icon: allSuperSeeding ? faSquareCheck : noneSuperSeeding ? faSquare : faSquareMinus,
            action: () =>
              this.commandBusService.emit({
                type: 'TORRENT_SUPER_SEEDING',
                status: allSuperSeeding,
              }),
          },
        ],
      },

      {
        kind: 'submenu',
        id: 'maintenance',
        label: 'pages.main.grid.context-menu.submenu.maintenance',
        icon: faRotate,
        children: [
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
            label: allAutoTmm
              ? 'pages.main.grid.context-menu.item.disable-auto-tmm'
              : 'pages.main.grid.context-menu.item.enable-auto-tmm',
            icon: allAutoTmm ? faSquareCheck : noneAutoTmm ? faSquare : faSquareMinus,
            action: () =>
              this.commandBusService.emit({ type: 'TORRENT_AUTO_TMM', status: allAutoTmm }),
          },
        ],
      },

      {
        kind: 'submenu',
        id: 'copy',
        label: 'pages.main.grid.context-menu.submenu.copy',
        icon: faCopy,
        children: [
          ...(isMulti
            ? []
            : [
                {
                  kind: 'item' as const,
                  id: 'cell.copyValue',
                  label: 'pages.main.grid.context-menu.item.copy-cell-value',
                  icon: faCopy,
                  action: () => this.clipboard.copy(String(data.cell.value)),
                },
              ]),
          {
            kind: 'item',
            id: 'torrent.copyInfoHash',
            label: isMulti
              ? 'pages.main.grid.context-menu.item.copy-info-hashes'
              : 'pages.main.grid.context-menu.item.copy-info-hash',
            icon: faHashtag,
            action: () => this.clipboard.copy(isMulti ? hashes.join('\n') : String(data.row.hash)),
          },
          {
            kind: 'item',
            id: 'torrent.copyMagnet',
            label: isMulti
              ? 'pages.main.grid.context-menu.item.copy-magnet-links'
              : 'pages.main.grid.context-menu.item.copy-magnet-link',
            icon: faLink,
            action: () =>
              this.clipboard.copy(
                isMulti
                  ? data.selected.map((torrent) => torrent.magnet_uri).join('\n')
                  : String(data.row.magnet_uri),
              ),
          },
          {
            kind: 'item',
            id: 'torrent.copyJson',
            label: 'pages.main.grid.context-menu.item.copy-as-json',
            icon: faCode,
            action: () => this.clipboard.copy(String(JSON.stringify(data.selected, null, 2))),
          },
        ],
      },

      {
        kind: 'submenu',
        id: 'row.pin',
        label: 'pages.main.grid.context-menu.submenu.pin-row',
        icon: faThumbTack,
        children: [
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
            icon: faThumbTackSlash,
            label: 'pages.main.grid.context-menu.item.unpin',
            disabled: !data.rowPinned,
            action: () => this.commandBusService.emit({ type: 'UI_TORRENT_UNPIN' }),
          },
        ],
      },

      { kind: 'divider' },
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
    ];
  }

  public buildHeaderMenu(
    event: ColumnHeaderContextMenuEvent<any, any>,
    opts: {
      enableFloatingFiltersToggle?: boolean;
      onFloatingFiltersToggle?: (newState: boolean) => Promise<void>;
    } = {},
  ): ContextMenuEntry[] {
    const api = event.api;
    const column = event.column as Column;
    const floatingFilterActive = (api.getColumnDefs() ?? []).some(
      (d) => (d as ColDef<any>).floatingFilter === true,
    );

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
      label,
      hint: id,
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
        kind: 'submenu',
        id: `sort.${payload.colId}`,
        label: 'pages.main.grid.context-menu.submenu.sort',
        icon: faSort,
        children: [
          {
            kind: 'item',
            id: `sort.asc.${payload.colId}`,
            label: 'pages.main.grid.context-menu.item.sort-ascending',
            icon: faSortUp,
            disabled: column.getSort() === 'asc',
            action: () => api.applyColumnState({ state: [{ colId: payload.colId, sort: 'asc' }] }),
          },
          {
            kind: 'item',
            id: `sort.desc.${payload.colId}`,
            label: 'pages.main.grid.context-menu.item.sort-descending',
            icon: faSortDown,
            disabled: column.getSort() === 'desc',
            action: () => api.applyColumnState({ state: [{ colId: payload.colId, sort: 'desc' }] }),
          },
          {
            kind: 'item',
            id: `sort.clear.${payload.colId}`,
            label: 'pages.main.grid.context-menu.item.clear-sort',
            icon: faXmark,
            disabled: !column.getSort(),
            action: () => api.applyColumnState({ state: [{ colId: payload.colId, sort: null }] }),
          },
        ],
      },

      {
        kind: 'submenu',
        id: `filter.${payload.colId}`,
        label: 'pages.main.grid.context-menu.submenu.filter',
        icon: faFilter,
        children: [
          {
            kind: 'item',
            id: `filter.open.${payload.colId}`,
            label: 'pages.main.grid.context-menu.item.open-filter',
            icon: faFilter,
            disabled: !column.getColDef().filter,
            action: () => api.showColumnFilter(payload.colId),
          },
          {
            kind: 'item',
            id: `filter.clear.${payload.colId}`,
            label: 'pages.main.grid.context-menu.item.clear-filter',
            icon: faFilterCircleXmark,
            disabled: !column.isFilterActive(),
            action: () => this.filterService.clearColumnFilter(payload.colId),
          },
          ...(opts.enableFloatingFiltersToggle !== false
            ? [
                {
                  kind: 'item' as const,
                  id: `filter.toggleFloating.${payload.colId}`,
                  label: floatingFilterActive
                    ? 'pages.main.grid.context-menu.item.hide-floating-filters'
                    : 'pages.main.grid.context-menu.item.show-floating-filters',
                  icon: floatingFilterActive ? faEyeSlash : faEye,
                  action: async () => {
                    const currentDefs = api.getColumnDefs() ?? [];
                    const isActive = currentDefs.some(
                      (d) => (d as ColDef<any>).floatingFilter === true,
                    );
                    const newDefs = currentDefs.map((d) => {
                      const colDef = { ...(d as ColDef<any>) };
                      if (colDef.floatingFilter === false) return colDef;
                      colDef.floatingFilter = isActive ? undefined : true;
                      return colDef;
                    });
                    api.updateGridOptions({ columnDefs: newDefs });
                    if (opts.onFloatingFiltersToggle) {
                      await opts.onFloatingFiltersToggle(!isActive);
                    } else {
                      const settings = await firstValueFrom(
                        this.torrentListGridSettingsService
                          .asObservable()
                          .pipe(filter((s): s is NonNullable<typeof s> => s !== null)),
                      );
                      await this.torrentListGridSettingsService.save({
                        ...settings,
                        floatingFilters: !isActive,
                      });
                    }
                  },
                },
              ]
            : []),
        ],
      },
      {
        kind: 'submenu',
        id: `pin.${payload.colId}`,
        label: 'pages.main.grid.context-menu.submenu.pin-column',
        icon: faThumbTack,
        children: [
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
            icon: faThumbTackSlash,
            disabled: !column.getPinned(),
            action: () => api.setColumnsPinned([payload.colId], null),
          },
        ],
      },

      {
        kind: 'submenu',
        id: `resize.${payload.colId}`,
        label: 'pages.main.grid.context-menu.submenu.resize',
        icon: faArrowsLeftRight,
        children: [
          {
            kind: 'item',
            id: `resize.column.${payload.colId}`,
            label: 'pages.main.grid.context-menu.item.autosize-column',
            icon: faArrowsLeftRight,
            action: () => api.autoSizeColumns([payload.colId]),
          },
          {
            kind: 'item',
            id: `resize.all.${payload.colId}`,
            label: 'pages.main.grid.context-menu.item.autosize-all-columns',
            icon: faArrowsLeftRight,
            action: () => api.autoSizeAllColumns(),
          },
        ],
      },
      { kind: 'divider' },
      {
        kind: 'submenu',
        id: `columns.${payload.colId}`,
        label: 'pages.main.grid.context-menu.submenu.columns',
        icon: faTableColumns,
        children: [
          {
            kind: 'item',
            id: `hide.${payload.colId}`,
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
          { kind: 'divider' },
          ...fields,
        ],
      },
    ];

    return items;
  }
}

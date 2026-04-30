import { Clipboard } from '@angular/cdk/clipboard';
import { ChangeDetectorRef, Component, Input, OnDestroy, OnInit, inject } from '@angular/core';
import { faCode, faCopy, faLink } from '@fortawesome/free-solid-svg-icons';
import { TranslateService } from '@ngx-translate/core';
import { AgGridAngular } from 'ag-grid-angular';
import {
  CellContextMenuEvent,
  ColDef,
  Column,
  ColumnHeaderContextMenuEvent,
  GridApi,
  GridOptions,
  GridReadyEvent,
  IOverlayParams,
} from 'ag-grid-community';
import { Subject, Subscription, debounceTime } from 'rxjs';
import { GRID_DARK_THEME, GRID_LIGHT_THEME, GRID_SHARED_OPTIONS } from '../../../../app.const';
import { QbTorrentTracker } from '../../../../models/qbittorrent.model';
import { ContextMenuEntry } from '../../../../pages/main/grid/context-menu/context-menu.types';
import { GridContextMenuService } from '../../../../pages/main/grid/context-menu/grid-context-menu.service';
import { LoadingOverlay } from '../../../../pages/main/grid/overlays/loading-overlay/loading-overlay';
import { NoRowOverlay } from '../../../../pages/main/grid/overlays/no-row-overlay/no-row-overlay';
import { ContextMenuService } from '../../../../services/context-menu.service';
import { QbService } from '../../../../services/qb.service';
import { ServerStoreService } from '../../../../services/server-store.service';
import { ThemeService } from '../../../../services/theme.service';
import { TrackersGridSettingsService } from '../../../../services/trackers-grid.settings.service';
import { TorrentDetailTabComponent } from '../torrent-details.interface';

@Component({
  selector: 'app-trackers',
  imports: [AgGridAngular],
  templateUrl: './trackers.html',
  styleUrl: './trackers.scss',
})
export class Trackers implements TorrentDetailTabComponent, OnInit, OnDestroy {
  @Input() public hash: string = '';
  @Input() public context: Record<string, any> = {};

  private readonly qbService = inject(QbService);
  private readonly serverStoreService = inject(ServerStoreService);
  private readonly changeDetectorRef = inject(ChangeDetectorRef);
  private readonly themeService = inject(ThemeService);
  private readonly translateService = inject(TranslateService);
  private readonly contextMenuService = inject(ContextMenuService);
  private readonly gridContextMenuService = inject(GridContextMenuService);
  private readonly trackersGridSettingsService = inject(TrackersGridSettingsService);
  private readonly clipboard = inject(Clipboard);

  private readonly saveState$ = new Subject<void>();
  private saveSub: Subscription | null = null;
  private gridApi: GridApi | null = null;
  private isRestoringState = false;

  public theme = this.themeService.effectiveMode;
  public trackers: QbTorrentTracker[] = [];
  public loading = true;
  public bbDark = GRID_DARK_THEME;
  public bbLight = GRID_LIGHT_THEME;
  public gridOptions: GridOptions<QbTorrentTracker> = this.getGridOptions();
  public colDefs: ColDef<QbTorrentTracker>[] = this.getColDefs();

  public ngOnInit(): void {
    this.saveSub = this.saveState$.pipe(debounceTime(500)).subscribe(() => {
      void this.persistColumnState();
    });
    void this.load();
  }

  public ngOnDestroy(): void {
    this.saveSub?.unsubscribe();
    this.saveSub = null;
  }

  public onGridReady(e: GridReadyEvent<QbTorrentTracker>): void {
    this.gridApi = e.api;
    void this.restoreColumnState();
  }

  private async restoreColumnState(): Promise<void> {
    if (!this.gridApi) return;
    this.isRestoringState = true;
    try {
      const settings = await this.trackersGridSettingsService.load();
      this.gridApi.applyColumnState({ state: settings.columnState, applyOrder: true });
    } finally {
      this.isRestoringState = false;
    }
  }

  private async persistColumnState(): Promise<void> {
    if (!this.gridApi) return;
    const columnState = this.gridApi.getColumnState();
    await this.trackersGridSettingsService.save({ columnState });
  }

  private queueSave(): void {
    if (this.isRestoringState) return;
    this.saveState$.next();
  }

  private async load(): Promise<void> {
    const serverId = this.serverStoreService.currentServerId();
    const hash = this.hash;

    if (!serverId) {
      console.error(Trackers.name, 'load', 'ServerId is missing!');
      throw new Error('ServerId is missing!');
    }

    if (!hash) {
      console.error(Trackers.name, 'load', 'Torrent hash is missing!');
      throw new Error('Torrent hash is missing!');
    }

    this.loading = true;

    try {
      this.trackers = await this.qbService.torrentTrackers(serverId, hash);
    } catch (e: any) {
      const error = e?.message ?? String(e);
      console.error(Trackers.name, 'load', 'Failed to fetch torrent trackers!', error);
      throw new Error(error);
    } finally {
      this.loading = false;
      this.changeDetectorRef.detectChanges();
    }
  }

  private buildRowMenu(e: CellContextMenuEvent<QbTorrentTracker>): ContextMenuEntry[] {
    const row = e.data;
    return [
      {
        kind: 'submenu',
        id: 'copy',
        label: 'pages.main.grid.context-menu.submenu.copy',
        icon: faCopy,
        children: [
          {
            kind: 'item',
            id: 'copy.cellValue',
            label: 'pages.main.grid.context-menu.item.copy-cell-value',
            icon: faCopy,
            action: () => this.clipboard.copy(String(e.value ?? '')),
          },
          {
            kind: 'item',
            id: 'copy.url',
            label: 'components.modals.torrent-details.trackers.context-menu.item.copy-url',
            icon: faLink,
            disabled: !row?.url,
            action: () => this.clipboard.copy(row?.url ?? ''),
          },
          {
            kind: 'item',
            id: 'copy.json',
            label: 'pages.main.grid.context-menu.item.copy-as-json',
            icon: faCode,
            action: () => this.clipboard.copy(JSON.stringify(row, null, 2)),
          },
        ],
      },
    ];
  }

  private getGridOptions(): GridOptions<QbTorrentTracker> {
    return {
      ...GRID_SHARED_OPTIONS,
      overlayComponentSelector: (params: IOverlayParams<QbTorrentTracker>) => {
        switch (params.overlayType) {
          case 'loading':
            return {
              component: LoadingOverlay,
              params: {
                title: this.translateService.instant(
                  'components.modals.torrent-details.trackers.grid-options.loading.title',
                ),
                message: this.translateService.instant(
                  'components.modals.torrent-details.trackers.grid-options.loading.message',
                ),
              },
            };

          case 'noRows':
            return {
              component: NoRowOverlay,
              params: {
                message: this.translateService.instant(
                  'components.modals.torrent-details.trackers.grid-options.no-rows.message',
                ),
              },
            };

          case 'noMatchingRows':
            return {
              component: NoRowOverlay,
              params: {
                message: this.translateService.instant(
                  'components.modals.torrent-details.trackers.grid-options.no-matching-rows.message',
                ),
              },
            };

          default:
            return undefined;
        }
      },
      onColumnResized: (e) => {
        if (e.finished) this.queueSave();
      },
      onColumnMoved: () => this.queueSave(),
      onColumnPinned: () => this.queueSave(),
      onColumnVisible: () => this.queueSave(),
      onSortChanged: () => this.queueSave(),
      onCellContextMenu: (e: CellContextMenuEvent<QbTorrentTracker>) => {
        this.contextMenuService.open({ items: this.buildRowMenu(e) });
      },
      onColumnHeaderContextMenu: (e: ColumnHeaderContextMenuEvent<QbTorrentTracker>) => {
        if (!e.column) return;
        this.contextMenuService.open({
          items: this.gridContextMenuService.buildHeaderMenu(e, {
            enableFloatingFiltersToggle: false,
          }),
          payload: {
            colId: e.column.getId(),
            displayName: e.api.getDisplayNameForColumn(e.column as Column, 'header'),
          },
        });
      },
    };
  }

  private getColDefs(): ColDef<QbTorrentTracker>[] {
    return [
      {
        colId: 'tier',
        field: 'tier',
        width: 70,
        headerName: this.translateService.instant(
          'components.modals.torrent-details.trackers.col-def.tier',
        ),
        headerTooltip: this.translateService.instant(
          'components.modals.torrent-details.trackers.col-def.tier',
        ),
        tooltipField: 'tier',
        sortable: true,
        resizable: true,
      },
      {
        colId: 'url',
        field: 'url',
        headerName: this.translateService.instant(
          'components.modals.torrent-details.trackers.col-def.url',
        ),
        headerTooltip: this.translateService.instant(
          'components.modals.torrent-details.trackers.col-def.url',
        ),
        tooltipField: 'url',
        sortable: true,
        resizable: true,
      },
      {
        colId: 'status',
        field: 'status',
        headerName: this.translateService.instant(
          'components.modals.torrent-details.trackers.col-def.status',
        ),
        headerTooltip: this.translateService.instant(
          'components.modals.torrent-details.trackers.col-def.status',
        ),
        tooltipField: 'status',
        sortable: true,
        resizable: true,
      },
      {
        colId: 'num_peers',
        field: 'num_peers',
        headerName: this.translateService.instant(
          'components.modals.torrent-details.trackers.col-def.num_peers',
        ),
        headerTooltip: this.translateService.instant(
          'components.modals.torrent-details.trackers.col-def.num_peers',
        ),
        tooltipField: 'num_peers',
        sortable: true,
        resizable: true,
      },
      {
        colId: 'num_seeds',
        field: 'num_seeds',
        headerName: this.translateService.instant(
          'components.modals.torrent-details.trackers.col-def.num_seeds',
        ),
        headerTooltip: this.translateService.instant(
          'components.modals.torrent-details.trackers.col-def.num_seeds',
        ),
        tooltipField: 'num_seeds',
        sortable: true,
        resizable: true,
      },
      {
        colId: 'num_leeches',
        field: 'num_leeches',
        headerName: this.translateService.instant(
          'components.modals.torrent-details.trackers.col-def.num_leeches',
        ),
        headerTooltip: this.translateService.instant(
          'components.modals.torrent-details.trackers.col-def.num_leeches',
        ),
        tooltipField: 'num_leeches',
        sortable: true,
        resizable: true,
      },
      {
        colId: 'num_downloaded',
        field: 'num_downloaded',
        headerName: this.translateService.instant(
          'components.modals.torrent-details.trackers.col-def.num_downloaded',
        ),
        headerTooltip: this.translateService.instant(
          'components.modals.torrent-details.trackers.col-def.num_downloaded',
        ),
        tooltipField: 'num_downloaded',
        sortable: true,
        resizable: true,
      },
      {
        colId: 'msg',
        field: 'msg',
        headerName: this.translateService.instant(
          'components.modals.torrent-details.trackers.col-def.msg',
        ),
        headerTooltip: this.translateService.instant(
          'components.modals.torrent-details.trackers.col-def.msg',
        ),
        tooltipField: 'msg',
        sortable: true,
        resizable: true,
      },
    ];
  }
}

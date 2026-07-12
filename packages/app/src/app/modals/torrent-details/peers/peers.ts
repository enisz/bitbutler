import { Clipboard } from '@angular/cdk/clipboard';
import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  DestroyRef,
  OnInit,
  effect,
  inject,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { faCode, faCopy, faNetworkWired } from '@fortawesome/free-solid-svg-icons';
import { TranslateService } from '@ngx-translate/core';
import { AgGridAngular } from 'ag-grid-angular';
import {
  CellContextMenuEvent,
  ColDef,
  Column,
  ColumnHeaderContextMenuEvent,
  GetRowIdParams,
  GridApi,
  GridOptions,
  GridReadyEvent,
  IOverlayParams,
  ValueFormatterParams,
  ValueGetterParams,
} from 'ag-grid-community';
import { Subject, debounceTime } from 'rxjs';
import { GRID_DARK_THEME, GRID_LIGHT_THEME, GRID_SHARED_OPTIONS } from '../../../app.const';
import { QbTorrentPeer } from '../../../models/torrent.model';
import { ContextMenuEntry } from '../../../pages/main/grid/context-menu/context-menu.types';
import { GridContextMenuService } from '../../../pages/main/grid/context-menu/grid-context-menu.service';
import { LoadingOverlay } from '../../../pages/main/grid/overlays/loading-overlay/loading-overlay';
import { NoRowOverlay } from '../../../pages/main/grid/overlays/no-row-overlay/no-row-overlay';
import { ProgressCellRenderer } from '../../../pages/main/grid/renderers/progress-cell-renderer/progress-cell-renderer';
import { FilesizePipe } from '../../../pipes/filesize-pipe';
import { ContextMenuService } from '../../../services/context-menu.service';
import { PeersGridSettingsService } from '../../../services/peers-grid.settings.service';
import { ThemeService } from '../../../services/theme.service';
import { TorrentDetailsDataService } from '../torrent-details-data.service';
import { TorrentDetailTabComponent } from '../torrent-details.interface';
import { FlagCellRenderer } from './flag-cell-renderer/flag-cell-renderer';
import { FlagsTooltipComponent } from './flags-tooltip/flags-tooltip';

@Component({
  selector: 'app-peers',
  imports: [AgGridAngular],
  providers: [FilesizePipe],
  templateUrl: './peers.html',
  styleUrl: './peers.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Peers implements TorrentDetailTabComponent, OnInit {
  private readonly dataService = inject(TorrentDetailsDataService);
  private readonly changeDetectorRef = inject(ChangeDetectorRef);
  private readonly themeService = inject(ThemeService);
  private readonly fileSizePipe = inject(FilesizePipe);
  private readonly translateService = inject(TranslateService);
  private readonly contextMenuService = inject(ContextMenuService);
  private readonly gridContextMenuService = inject(GridContextMenuService);
  private readonly peersGridSettingsService = inject(PeersGridSettingsService);
  private readonly clipboard = inject(Clipboard);
  private readonly destroyRef = inject(DestroyRef);

  private readonly saveState$ = new Subject<void>();
  private gridApi: GridApi | null = null;
  private isRestoringState = false;

  public theme = this.themeService.effectiveMode;
  public peers: QbTorrentPeer[] = [];
  public loading = true;
  public bbDark = GRID_DARK_THEME;
  public bbLight = GRID_LIGHT_THEME;
  public gridOptions: GridOptions<QbTorrentPeer> = this.getGridOptions();
  public colDefs: ColDef<QbTorrentPeer>[] = this.getColDefs();

  constructor() {
    effect(() => {
      this.peers = this.dataService.peers();
      this.loading = this.dataService.peersLoading();
      this.changeDetectorRef.detectChanges();
    });
  }

  public ngOnInit(): void {
    this.saveState$.pipe(debounceTime(500), takeUntilDestroyed(this.destroyRef)).subscribe(() => {
      void this.persistColumnState();
    });
  }

  public onGridReady(e: GridReadyEvent<QbTorrentPeer>): void {
    this.gridApi = e.api;
    void this.restoreColumnState();
  }

  private async restoreColumnState(): Promise<void> {
    if (!this.gridApi) return;
    this.isRestoringState = true;
    try {
      const settings = await this.peersGridSettingsService.load();
      this.gridApi.applyColumnState({ state: settings.columnState, applyOrder: true });
    } finally {
      this.isRestoringState = false;
    }
  }

  private async persistColumnState(): Promise<void> {
    if (!this.gridApi) return;
    const columnState = this.gridApi.getColumnState();
    const settings = await this.peersGridSettingsService.load();
    await this.peersGridSettingsService.save({ ...settings, columnState });
  }

  private queueSave(): void {
    if (this.isRestoringState) return;
    this.saveState$.next();
  }

  private buildRowMenu(e: CellContextMenuEvent<QbTorrentPeer>): ContextMenuEntry[] {
    const row = e.data;
    const ipPort = row ? `${row.ip}:${row.port}` : '';
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
            id: 'copy.ipPort',
            label: 'components.modals.torrent-details.peers.context-menu.item.copy-ip-port',
            icon: faNetworkWired,
            disabled: !row?.ip,
            action: () => this.clipboard.copy(ipPort),
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

  private getGridOptions(): GridOptions<QbTorrentPeer> {
    return {
      ...GRID_SHARED_OPTIONS,
      tooltipShowMode: 'standard',
      getRowId: (params: GetRowIdParams<QbTorrentPeer, any>) =>
        `${params.data.ip}:${params.data.port}`,
      overlayComponentSelector: (params: IOverlayParams<QbTorrentPeer>) => {
        switch (params.overlayType) {
          case 'loading':
            return {
              component: LoadingOverlay,
              params: {
                title: this.translateService.instant(
                  'components.modals.torrent-details.peers.grid-options.loading.title',
                ),
                message: this.translateService.instant(
                  'components.modals.torrent-details.peers.grid-options.loading.message',
                ),
              },
            };

          case 'noRows':
          case 'noMatchingRows':
            return {
              component: NoRowOverlay,
              params: {
                message: this.translateService.instant(
                  'components.modals.torrent-details.peers.grid-options.no-rows.message',
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
      onCellContextMenu: (e: CellContextMenuEvent<QbTorrentPeer>) => {
        this.contextMenuService.open({ items: this.buildRowMenu(e) });
      },
      onColumnHeaderContextMenu: (e: ColumnHeaderContextMenuEvent<QbTorrentPeer>) => {
        if (!e.column) return;
        this.contextMenuService.open({
          items: this.gridContextMenuService.buildHeaderMenu(e),
          payload: {
            colId: e.column.getId(),
            displayName: e.api.getDisplayNameForColumn(e.column as Column, 'header'),
          },
        });
      },
    };
  }

  private getColDefs(): ColDef<QbTorrentPeer>[] {
    return [
      {
        colId: 'country_code',
        field: 'country_code',
        width: 40,
        headerName: '',
        sortable: false,
        filter: false,
        floatingFilter: false,
        resizable: false,
        cellRenderer: FlagCellRenderer,
      },
      {
        colId: 'country',
        field: 'country',
        width: 120,
        headerName: this.translateService.instant(
          'components.modals.torrent-details.peers.col-def.country',
        ),
        headerTooltip: this.translateService.instant(
          'components.modals.torrent-details.peers.col-def.country',
        ),
        tooltipField: 'country',
        filter: 'agTextColumnFilter',
      },
      {
        colId: 'ip',
        field: 'ip',
        width: 150,
        headerName: this.translateService.instant(
          'components.modals.torrent-details.peers.col-def.ip',
        ),
        headerTooltip: this.translateService.instant(
          'components.modals.torrent-details.peers.col-def.ip',
        ),
        tooltipField: 'ip',
        sortable: true,
        filter: 'agTextColumnFilter',
      },
      {
        colId: 'port',
        field: 'port',
        width: 90,
        headerName: this.translateService.instant(
          'components.modals.torrent-details.peers.col-def.port',
        ),
        headerTooltip: this.translateService.instant(
          'components.modals.torrent-details.peers.col-def.port',
        ),
        tooltipField: 'port',
        filter: 'agNumberColumnFilter',
      },
      {
        colId: 'connection',
        field: 'connection',
        width: 140,
        headerName: this.translateService.instant(
          'components.modals.torrent-details.peers.col-def.connection',
        ),
        headerTooltip: this.translateService.instant(
          'components.modals.torrent-details.peers.col-def.connection',
        ),
        tooltipField: 'connection',
        filter: 'agTextColumnFilter',
      },
      {
        colId: 'flags',
        field: 'flags',
        width: 100,
        headerName: this.translateService.instant(
          'components.modals.torrent-details.peers.col-def.flags',
        ),
        headerTooltip: this.translateService.instant(
          'components.modals.torrent-details.peers.col-def.flags',
        ),
        tooltipComponent: FlagsTooltipComponent,
        tooltipValueGetter: (p) => p.data?.flags ?? '',
        filter: 'agTextColumnFilter',
      },
      {
        colId: 'client',
        field: 'client',
        width: 160,
        headerName: this.translateService.instant(
          'components.modals.torrent-details.peers.col-def.client',
        ),
        headerTooltip: this.translateService.instant(
          'components.modals.torrent-details.peers.col-def.client',
        ),
        tooltipField: 'client',
        filter: 'agTextColumnFilter',
      },
      {
        colId: 'progress',
        field: 'progress',
        width: 150,
        headerName: this.translateService.instant(
          'components.modals.torrent-details.peers.col-def.progress',
        ),
        headerTooltip: this.translateService.instant(
          'components.modals.torrent-details.peers.col-def.progress',
        ),
        valueGetter: (params: ValueGetterParams<QbTorrentPeer, number>): number => {
          const progress = params.data?.progress;

          if (!progress) return 0;
          if (progress === 0 || progress === 1) return progress * 100;
          return Number((progress * 100).toFixed(1));
        },
        valueFormatter: (params: ValueFormatterParams): string => `${params.value ?? 0}%`,
        cellRenderer: ProgressCellRenderer,
        filter: false,
        floatingFilter: false,
      },
      {
        colId: 'dl_speed',
        field: 'dl_speed',
        width: 160,
        headerName: this.translateService.instant(
          'components.modals.torrent-details.peers.col-def.dl_speed',
        ),
        headerTooltip: this.translateService.instant(
          'components.modals.torrent-details.peers.col-def.dl_speed',
        ),
        tooltipField: 'dl_speed',
        valueFormatter: (params: ValueFormatterParams<QbTorrentPeer, number>) =>
          this.fileSizePipe.transform(params.value),
        filter: false,
        floatingFilter: false,
      },
      {
        colId: 'up_speed',
        field: 'up_speed',
        width: 140,
        headerName: this.translateService.instant(
          'components.modals.torrent-details.peers.col-def.up_speed',
        ),
        headerTooltip: this.translateService.instant(
          'components.modals.torrent-details.peers.col-def.up_speed',
        ),
        tooltipField: 'up_speed',
        valueFormatter: (params: ValueFormatterParams<QbTorrentPeer, number>) =>
          this.fileSizePipe.transform(params.value),
        filter: false,
        floatingFilter: false,
      },
      {
        colId: 'downloaded',
        field: 'downloaded',
        width: 130,
        headerName: this.translateService.instant(
          'components.modals.torrent-details.peers.col-def.downloaded',
        ),
        headerTooltip: this.translateService.instant(
          'components.modals.torrent-details.peers.col-def.downloaded',
        ),
        tooltipField: 'downloaded',
        valueFormatter: (params: ValueFormatterParams<QbTorrentPeer, number>) =>
          this.fileSizePipe.transform(params.value),
        filter: false,
        floatingFilter: false,
      },
      {
        colId: 'uploaded',
        field: 'uploaded',
        width: 120,
        headerName: this.translateService.instant(
          'components.modals.torrent-details.peers.col-def.uploaded',
        ),
        headerTooltip: this.translateService.instant(
          'components.modals.torrent-details.peers.col-def.uploaded',
        ),
        tooltipField: 'uploaded',
        valueFormatter: (params: ValueFormatterParams<QbTorrentPeer, number>) =>
          this.fileSizePipe.transform(params.value),
        filter: false,
        floatingFilter: false,
      },
      {
        colId: 'relevance',
        field: 'relevance',
        width: 130,
        headerName: this.translateService.instant(
          'components.modals.torrent-details.peers.col-def.relevance',
        ),
        headerTooltip: this.translateService.instant(
          'components.modals.torrent-details.peers.col-def.relevance',
        ),
        tooltipField: 'relevance',
        filter: 'agNumberColumnFilter',
      },
      {
        colId: 'files',
        field: 'files',
        width: 450,
        headerName: this.translateService.instant(
          'components.modals.torrent-details.peers.col-def.files',
        ),
        headerTooltip: this.translateService.instant(
          'components.modals.torrent-details.peers.col-def.files',
        ),
        tooltipField: 'files',
        filter: 'agTextColumnFilter',
      },
    ];
  }
}

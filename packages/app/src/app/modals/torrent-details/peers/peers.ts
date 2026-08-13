import { Clipboard } from '@angular/cdk/clipboard';
import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  DestroyRef,
  OnInit,
  computed,
  effect,
  inject,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { faCode, faCopy, faNetworkWired } from '@fortawesome/free-solid-svg-icons';
import { TranslateService } from '@ngx-translate/core';
import { TranslatePipe } from '@ngx-translate/core';
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
  TooltipValueGetterFunc,
  ValueFormatterParams,
  ValueGetterParams,
} from 'ag-grid-community';
import { Subject, debounceTime } from 'rxjs';
import { GRID_SHARED_OPTIONS } from '../../../app.const';
import { NumberColumnFilter } from '../../../components/column-filters/number-column-filter/number-column-filter';
import {
  SetColumnFilter,
  SetColumnFilterParams,
  buildValueCounts,
} from '../../../components/column-filters/set-column-filter/set-column-filter';
import { SizeColumnFilter } from '../../../components/column-filters/size-column-filter/size-column-filter';
import { TextColumnFilter } from '../../../components/column-filters/text-column-filter/text-column-filter';
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
import {
  TORRENT_DETAILS_GRID_DARK_THEME,
  TORRENT_DETAILS_GRID_LIGHT_THEME,
} from '../torrent-details-grid-theme';
import { TorrentDetailTabComponent } from '../torrent-details.interface';
import { FlagCellRenderer } from './flag-cell-renderer/flag-cell-renderer';
import { FlagsTooltipComponent } from './flags-tooltip/flags-tooltip';

const tooltipFormattedValue: TooltipValueGetterFunc<QbTorrentPeer, any> = (params) =>
  params.valueFormatted ?? '';

@Component({
  selector: 'app-peers',
  imports: [AgGridAngular, TranslatePipe],
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

  private readonly countryItems = computed(() =>
    buildValueCounts(this.dataService.peers(), (p) => p.country),
  );
  private readonly connectionItems = computed(() =>
    buildValueCounts(this.dataService.peers(), (p) => p.connection),
  );
  private readonly clientItems = computed(() =>
    buildValueCounts(this.dataService.peers(), (p) => p.client),
  );

  public theme = this.themeService.effectiveMode;
  public peers: QbTorrentPeer[] = [];
  public loading = true;
  public bbDark = TORRENT_DETAILS_GRID_DARK_THEME;
  public bbLight = TORRENT_DETAILS_GRID_LIGHT_THEME;
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
        filter: SetColumnFilter,
        filterParams: {
          getItems: () => this.countryItems(),
        } satisfies Partial<SetColumnFilterParams>,
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
        filter: TextColumnFilter,
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
        filter: NumberColumnFilter,
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
        filter: SetColumnFilter,
        filterParams: {
          getItems: () => this.connectionItems(),
        } satisfies Partial<SetColumnFilterParams>,
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
        filter: TextColumnFilter,
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
        filter: SetColumnFilter,
        filterParams: {
          getItems: () => this.clientItems(),
        } satisfies Partial<SetColumnFilterParams>,
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
      },
      {
        colId: 'progress_percentage',
        field: 'progress',
        tooltipValueGetter: tooltipFormattedValue,
        headerName: this.translateService.instant(
          'components.modals.torrent-details.peers.col-def.progress_percentage',
        ),
        headerTooltip: this.translateService.instant(
          'components.modals.torrent-details.peers.col-def.progress_percentage',
        ),
        width: 130,
        cellClass: 'tabular-nums',
        filter: NumberColumnFilter,
        hide: true,
        valueFormatter: (params: ValueFormatterParams<QbTorrentPeer, number>): string =>
          params.value != null ? (params.value * 100).toFixed(1) + '%' : '',
      },
      {
        colId: 'progress_raw',
        field: 'progress',
        tooltipField: 'progress',
        headerName: this.translateService.instant(
          'components.modals.torrent-details.peers.col-def.progress_raw',
        ),
        headerTooltip: this.translateService.instant(
          'components.modals.torrent-details.peers.col-def.progress_raw',
        ),
        width: 130,
        cellClass: 'tabular-nums',
        filter: NumberColumnFilter,
        hide: true,
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
        filter: SizeColumnFilter,
      },
      {
        colId: 'dl_speed_raw',
        field: 'dl_speed',
        tooltipField: 'dl_speed',
        headerName: this.translateService.instant(
          'components.modals.torrent-details.peers.col-def.dl_speed_raw',
        ),
        headerTooltip: this.translateService.instant(
          'components.modals.torrent-details.peers.col-def.dl_speed_raw',
        ),
        width: 160,
        cellClass: 'tabular-nums',
        filter: NumberColumnFilter,
        hide: true,
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
        filter: SizeColumnFilter,
      },
      {
        colId: 'up_speed_raw',
        field: 'up_speed',
        tooltipField: 'up_speed',
        headerName: this.translateService.instant(
          'components.modals.torrent-details.peers.col-def.up_speed_raw',
        ),
        headerTooltip: this.translateService.instant(
          'components.modals.torrent-details.peers.col-def.up_speed_raw',
        ),
        width: 140,
        cellClass: 'tabular-nums',
        filter: NumberColumnFilter,
        hide: true,
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
        filter: SizeColumnFilter,
      },
      {
        colId: 'downloaded_raw',
        field: 'downloaded',
        tooltipField: 'downloaded',
        headerName: this.translateService.instant(
          'components.modals.torrent-details.peers.col-def.downloaded_raw',
        ),
        headerTooltip: this.translateService.instant(
          'components.modals.torrent-details.peers.col-def.downloaded_raw',
        ),
        width: 130,
        cellClass: 'tabular-nums',
        filter: NumberColumnFilter,
        hide: true,
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
        filter: SizeColumnFilter,
      },
      {
        colId: 'uploaded_raw',
        field: 'uploaded',
        tooltipField: 'uploaded',
        headerName: this.translateService.instant(
          'components.modals.torrent-details.peers.col-def.uploaded_raw',
        ),
        headerTooltip: this.translateService.instant(
          'components.modals.torrent-details.peers.col-def.uploaded_raw',
        ),
        width: 120,
        cellClass: 'tabular-nums',
        filter: NumberColumnFilter,
        hide: true,
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
        filter: NumberColumnFilter,
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
        filter: false,
      },
    ];
  }
}

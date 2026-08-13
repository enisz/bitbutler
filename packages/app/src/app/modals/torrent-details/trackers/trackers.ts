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
import { TextColumnFilter } from '../../../components/column-filters/text-column-filter/text-column-filter';
import { QbTorrentTracker, QbTrackerStatus } from '../../../models/qbittorrent.model';
import { ContextMenuEntry } from '../../../pages/main/grid/context-menu/context-menu.types';
import { GridContextMenuService } from '../../../pages/main/grid/context-menu/grid-context-menu.service';
import { LoadingOverlay } from '../../../pages/main/grid/overlays/loading-overlay/loading-overlay';
import { NoRowOverlay } from '../../../pages/main/grid/overlays/no-row-overlay/no-row-overlay';
import { ContextMenuService } from '../../../services/context-menu.service';
import { ThemeService } from '../../../services/theme.service';
import { TrackersGridSettingsService } from '../../../services/trackers-grid.settings.service';
import { TorrentDetailsDataService } from '../torrent-details-data.service';
import {
  TORRENT_DETAILS_GRID_DARK_THEME,
  TORRENT_DETAILS_GRID_LIGHT_THEME,
} from '../torrent-details-grid-theme';
import { TorrentDetailTabComponent } from '../torrent-details.interface';
import { StatusBadgeCellRenderer } from './status-badge-cell-renderer/status-badge-cell-renderer';

@Component({
  selector: 'app-trackers',
  imports: [AgGridAngular],
  templateUrl: './trackers.html',
  styleUrl: './trackers.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Trackers implements TorrentDetailTabComponent, OnInit {
  private readonly dataService = inject(TorrentDetailsDataService);
  private readonly changeDetectorRef = inject(ChangeDetectorRef);
  private readonly themeService = inject(ThemeService);
  private readonly translateService = inject(TranslateService);
  private readonly contextMenuService = inject(ContextMenuService);
  private readonly gridContextMenuService = inject(GridContextMenuService);
  private readonly trackersGridSettingsService = inject(TrackersGridSettingsService);
  private readonly clipboard = inject(Clipboard);
  private readonly destroyRef = inject(DestroyRef);

  private readonly saveState$ = new Subject<void>();
  private gridApi: GridApi | null = null;
  private isRestoringState = false;

  private readonly statusItems = computed(() =>
    buildValueCounts(this.dataService.trackers(), (t) => this.trackerStatusLabel(t.status)),
  );

  public theme = this.themeService.effectiveMode;
  public trackers: QbTorrentTracker[] = [];
  public loading = true;
  public bbDark = TORRENT_DETAILS_GRID_DARK_THEME;
  public bbLight = TORRENT_DETAILS_GRID_LIGHT_THEME;
  public gridOptions: GridOptions<QbTorrentTracker> = this.getGridOptions();
  public colDefs: ColDef<QbTorrentTracker>[] = this.getColDefs();

  constructor() {
    effect(() => {
      this.trackers = this.dataService.trackers();
      this.loading = this.dataService.trackersLoading();
      this.changeDetectorRef.detectChanges();
    });
  }

  public ngOnInit(): void {
    this.saveState$.pipe(debounceTime(500), takeUntilDestroyed(this.destroyRef)).subscribe(() => {
      void this.persistColumnState();
    });
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
    const settings = await this.trackersGridSettingsService.load();
    await this.trackersGridSettingsService.save({ ...settings, columnState });
  }

  private queueSave(): void {
    if (this.isRestoringState) return;
    this.saveState$.next();
  }

  private trackerStatusLabel(status: QbTrackerStatus): string {
    const keyMap: Record<number, string> = {
      [QbTrackerStatus.Disabled]: 'components.modals.torrent-details.trackers.status.disabled',
      [QbTrackerStatus.NotContacted]:
        'components.modals.torrent-details.trackers.status.not-contacted',
      [QbTrackerStatus.Working]: 'components.modals.torrent-details.trackers.status.working',
      [QbTrackerStatus.Updating]: 'components.modals.torrent-details.trackers.status.updating',
      [QbTrackerStatus.NotWorking]: 'components.modals.torrent-details.trackers.status.not-working',
    };
    return this.translateService.instant(keyMap[status] ?? String(status));
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
          items: this.gridContextMenuService.buildHeaderMenu(e),
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
        width: 90,
        headerName: this.translateService.instant(
          'components.modals.torrent-details.trackers.col-def.tier',
        ),
        headerTooltip: this.translateService.instant(
          'components.modals.torrent-details.trackers.col-def.tier',
        ),
        tooltipField: 'tier',
        sortable: true,
        resizable: true,
        filter: NumberColumnFilter,
      },
      {
        colId: 'url',
        field: 'url',
        width: 590,
        headerName: this.translateService.instant(
          'components.modals.torrent-details.trackers.col-def.url',
        ),
        headerTooltip: this.translateService.instant(
          'components.modals.torrent-details.trackers.col-def.url',
        ),
        tooltipField: 'url',
        sortable: true,
        resizable: true,
        filter: TextColumnFilter,
      },
      {
        colId: 'status',
        field: 'status',
        width: 140,
        headerName: this.translateService.instant(
          'components.modals.torrent-details.trackers.col-def.status',
        ),
        headerTooltip: this.translateService.instant(
          'components.modals.torrent-details.trackers.col-def.status',
        ),
        valueFormatter: (params: ValueFormatterParams<QbTorrentTracker, QbTrackerStatus>) =>
          this.trackerStatusLabel(params.value ?? QbTrackerStatus.Disabled),
        filterValueGetter: (params: ValueGetterParams<QbTorrentTracker>) =>
          this.trackerStatusLabel(params.data?.status ?? QbTrackerStatus.Disabled),
        tooltipValueGetter: (params) => this.trackerStatusLabel(params.value as QbTrackerStatus),
        cellRenderer: StatusBadgeCellRenderer,
        sortable: true,
        resizable: true,
        filter: SetColumnFilter,
        filterParams: {
          getItems: () => this.statusItems(),
        } satisfies Partial<SetColumnFilterParams>,
      },
      {
        colId: 'num_peers',
        field: 'num_peers',
        width: 100,
        headerName: this.translateService.instant(
          'components.modals.torrent-details.trackers.col-def.num_peers',
        ),
        headerTooltip: this.translateService.instant(
          'components.modals.torrent-details.trackers.col-def.num_peers',
        ),
        tooltipField: 'num_peers',
        sortable: true,
        resizable: true,
        filter: NumberColumnFilter,
      },
      {
        colId: 'num_seeds',
        field: 'num_seeds',
        width: 100,
        headerName: this.translateService.instant(
          'components.modals.torrent-details.trackers.col-def.num_seeds',
        ),
        headerTooltip: this.translateService.instant(
          'components.modals.torrent-details.trackers.col-def.num_seeds',
        ),
        tooltipField: 'num_seeds',
        sortable: true,
        resizable: true,
        filter: NumberColumnFilter,
      },
      {
        colId: 'num_leeches',
        field: 'num_leeches',
        width: 120,
        headerName: this.translateService.instant(
          'components.modals.torrent-details.trackers.col-def.num_leeches',
        ),
        headerTooltip: this.translateService.instant(
          'components.modals.torrent-details.trackers.col-def.num_leeches',
        ),
        tooltipField: 'num_leeches',
        sortable: true,
        resizable: true,
        filter: NumberColumnFilter,
      },
      {
        colId: 'num_downloaded',
        field: 'num_downloaded',
        width: 190,
        headerName: this.translateService.instant(
          'components.modals.torrent-details.trackers.col-def.num_downloaded',
        ),
        headerTooltip: this.translateService.instant(
          'components.modals.torrent-details.trackers.col-def.num_downloaded',
        ),
        tooltipField: 'num_downloaded',
        sortable: true,
        resizable: true,
        filter: NumberColumnFilter,
      },
      {
        colId: 'msg',
        field: 'msg',
        width: 260,
        headerName: this.translateService.instant(
          'components.modals.torrent-details.trackers.col-def.msg',
        ),
        headerTooltip: this.translateService.instant(
          'components.modals.torrent-details.trackers.col-def.msg',
        ),
        tooltipField: 'msg',
        sortable: true,
        resizable: true,
        filter: false,
      },
    ];
  }
}

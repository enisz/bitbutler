import { Clipboard } from '@angular/cdk/clipboard';
import { ChangeDetectorRef, Component, Input, OnDestroy, OnInit, inject } from '@angular/core';
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
import { Subject, Subscription, debounceTime } from 'rxjs';
import { GRID_DARK_THEME, GRID_LIGHT_THEME, GRID_SHARED_OPTIONS } from '../../../../app.const';
import { QbTorrentPeer, QbTorrentPeersResponse } from '../../../../models/torrent.model';
import { ContextMenuEntry } from '../../../../pages/main/grid/context-menu/context-menu.types';
import { GridContextMenuService } from '../../../../pages/main/grid/context-menu/grid-context-menu.service';
import { LoadingOverlay } from '../../../../pages/main/grid/overlays/loading-overlay/loading-overlay';
import { NoRowOverlay } from '../../../../pages/main/grid/overlays/no-row-overlay/no-row-overlay';
import { ProgressCellRenderer } from '../../../../pages/main/grid/renderers/progress-cell-renderer/progress-cell-renderer';
import { FilesizePipe } from '../../../../pipes/filesize-pipe';
import { ContextMenuService } from '../../../../services/context-menu.service';
import { PeersGridSettingsService } from '../../../../services/peers-grid.settings.service';
import { QbPollingService } from '../../../../services/qb-polling.service';
import { ServerStoreService } from '../../../../services/server-store.service';
import { ThemeService } from '../../../../services/theme.service';
import { TorrentDetailTabComponent } from '../torrent-details.interface';
import { FlagCellRenderer } from './flag-cell-renderer/flag-cell-renderer';

@Component({
  selector: 'app-peers',
  imports: [AgGridAngular],
  providers: [FilesizePipe],
  templateUrl: './peers.html',
  styleUrl: './peers.scss',
})
export class Peers implements TorrentDetailTabComponent, OnInit, OnDestroy {
  private readonly polling = inject(QbPollingService);
  private readonly serverStoreService = inject(ServerStoreService);
  private readonly changeDetectorRef = inject(ChangeDetectorRef);
  private readonly themeService = inject(ThemeService);
  private readonly fileSizePipe = inject(FilesizePipe);
  private readonly translateService = inject(TranslateService);
  private readonly contextMenuService = inject(ContextMenuService);
  private readonly gridContextMenuService = inject(GridContextMenuService);
  private readonly peersGridSettingsService = inject(PeersGridSettingsService);
  private readonly clipboard = inject(Clipboard);

  private sub: Subscription | null = null;
  private saveSub: Subscription | null = null;
  private readonly saveState$ = new Subject<void>();
  private peerMap = new Map<string, QbTorrentPeer>();
  private gridApi: GridApi | null = null;
  private isRestoringState = false;

  @Input() public hash: string = '';
  @Input() public context: Record<string, any> = {};

  public theme = this.themeService.effectiveMode;
  public peers: QbTorrentPeer[] = [];
  public loading = true;
  public bbDark = GRID_DARK_THEME;
  public bbLight = GRID_LIGHT_THEME;
  public gridOptions: GridOptions<QbTorrentPeer> = this.getGridOptions();
  public colDefs: ColDef<QbTorrentPeer>[] = this.getColDefs();

  public ngOnInit(): void {
    this.saveSub = this.saveState$.pipe(debounceTime(500)).subscribe(() => {
      void this.persistColumnState();
    });
    this.startPolling();
  }

  public ngOnDestroy(): void {
    this.sub?.unsubscribe();
    this.sub = null;
    this.saveSub?.unsubscribe();
    this.saveSub = null;
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
      const floatingFilters = settings.floatingFilters ?? false;
      const currentDefs = this.gridApi.getColumnDefs() ?? [];
      const newDefs = currentDefs.map((d) => {
        const colDef = { ...(d as ColDef<QbTorrentPeer>) };
        if (colDef.floatingFilter === false) return colDef;
        colDef.floatingFilter = floatingFilters ? true : undefined;
        return colDef;
      });
      this.gridApi.updateGridOptions({ columnDefs: newDefs });
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

  private startPolling(): void {
    this.sub?.unsubscribe();
    this.sub = null;

    this.peerMap.clear();
    this.peers = [];
    this.loading = true;
    this.changeDetectorRef.detectChanges();

    const serverId = this.serverStoreService.currentServerId();
    const hash = this.hash;

    if (!serverId || !hash) {
      this.loading = false;
      this.changeDetectorRef.detectChanges();
      return;
    }

    this.sub = this.polling.startPeersPolling(serverId, hash).subscribe({
      next: (patch: QbTorrentPeersResponse) => {
        this.applyPatch(patch);

        this.peers = Array.from(this.peerMap.values());

        this.loading = false;
        this.changeDetectorRef.detectChanges();
      },
      error: () => {
        this.loading = false;
        this.changeDetectorRef.detectChanges();
      },
    });
  }

  private applyPatch(patch: QbTorrentPeersResponse): void {
    if (patch.full_update) this.peerMap.clear();

    if (patch.peers_removed?.length) {
      for (const id of patch.peers_removed) this.peerMap.delete(id);
    }

    if (!patch.peers) return;

    for (const [id, update] of Object.entries(patch.peers)) {
      const prev = this.peerMap.get(id);

      let ip = (update as any).ip ?? prev?.ip;
      let port = (update as any).port ?? prev?.port;

      if (!ip || port == null) {
        const lastColon = id.lastIndexOf(':');
        if (lastColon > 0) {
          ip ??= id.slice(0, lastColon);
          const p = Number(id.slice(lastColon + 1));
          if (Number.isFinite(p)) port ??= p;
        }
      }

      this.peerMap.set(id, {
        ...(prev ?? {}),
        ...(update as any),
        ...(ip ? { ip } : {}),
        ...(port != null ? { port } : {}),
      } as QbTorrentPeer);
    }
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
          items: this.gridContextMenuService.buildHeaderMenu(e, {
            onFloatingFiltersToggle: async (newState: boolean) => {
              const settings = await this.peersGridSettingsService.load();
              await this.peersGridSettingsService.save({ ...settings, floatingFilters: newState });
            },
          }),
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
        width: 30,
        headerName: '',
        sortable: false,
        filter: false,
        floatingFilter: false,
        cellRenderer: FlagCellRenderer,
      },
      {
        colId: 'country',
        field: 'country',
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
        headerName: this.translateService.instant(
          'components.modals.torrent-details.peers.col-def.flags',
        ),
        headerTooltip: this.translateService.instant(
          'components.modals.torrent-details.peers.col-def.flags',
        ),
        tooltipField: 'flags',
        filter: 'agTextColumnFilter',
      },
      {
        colId: 'client',
        field: 'client',
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

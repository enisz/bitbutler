import { ChangeDetectorRef, Component, Input, OnDestroy, OnInit, inject } from '@angular/core';
import { TranslateService } from '@ngx-translate/core';
import { AgGridAngular } from 'ag-grid-angular';
import {
  ColDef,
  GetRowIdParams,
  GridApi,
  GridOptions,
  GridReadyEvent,
  IOverlayParams,
  ValueFormatterParams,
  ValueGetterParams,
} from 'ag-grid-community';
import { Subscription } from 'rxjs';
import { GRID_DARK_THEME, GRID_LIGHT_THEME, GRID_SHARED_OPTIONS } from '../../../../app.const';
import { QbTorrentPeer, QbTorrentPeersResponse } from '../../../../models/torrent.model';
import { LoadingOverlay } from '../../../../pages/main/grid/overlays/loading-overlay/loading-overlay';
import { NoRowOverlay } from '../../../../pages/main/grid/overlays/no-row-overlay/no-row-overlay';
import { ProgressCellRenderer } from '../../../../pages/main/grid/renderers/progress-cell-renderer/progress-cell-renderer';
import { FilesizePipe } from '../../../../pipes/filesize-pipe';
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

  private sub: Subscription | null = null;
  private peerMap = new Map<string, QbTorrentPeer>();

  @Input() public hash: string = '';
  @Input() public context: Record<string, any> = {};

  public theme = this.themeService.effectiveMode;
  public peers: QbTorrentPeer[] = [];
  public loading = true;
  public gridApi: GridApi | null = null;
  public bbDark = GRID_DARK_THEME;
  public bbLight = GRID_LIGHT_THEME;
  public gridOptions: GridOptions<QbTorrentPeer> = this.getGridOptions();
  public colDefs: ColDef<QbTorrentPeer>[] = this.getColDefs();

  public ngOnInit(): void {
    this.startPolling();
  }

  public ngOnDestroy(): void {
    this.sub?.unsubscribe();
    this.sub = null;
  }

  public onGridReady(e: GridReadyEvent<QbTorrentPeer>): void {
    this.gridApi = e.api;
    this.gridApi.autoSizeAllColumns();
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
    };
  }

  private getColDefs(): ColDef<QbTorrentPeer>[] {
    return [
      {
        field: 'country_code',
        width: 30,
        headerName: '',
        sortable: false,
        filter: false,
        cellRenderer: FlagCellRenderer,
      },
      {
        field: 'country',
        headerName: this.translateService.instant(
          'components.modals.torrent-details.peers.col-def.country',
        ),
      },
      {
        field: 'ip',
        headerName: this.translateService.instant(
          'components.modals.torrent-details.peers.col-def.ip',
        ),
        sortable: true,
      },
      {
        field: 'port',
        headerName: this.translateService.instant(
          'components.modals.torrent-details.peers.col-def.port',
        ),
      },
      {
        field: 'connection',
        headerName: this.translateService.instant(
          'components.modals.torrent-details.peers.col-def.connection',
        ),
      },
      {
        field: 'flags',
        headerName: this.translateService.instant(
          'components.modals.torrent-details.peers.col-def.flags',
        ),
      },
      {
        field: 'client',
        headerName: this.translateService.instant(
          'components.modals.torrent-details.peers.col-def.client',
        ),
      },
      {
        field: 'progress',
        headerName: this.translateService.instant(
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
      },
      {
        field: 'dl_speed',
        headerName: this.translateService.instant(
          'components.modals.torrent-details.peers.col-def.dl_speed',
        ),
        valueFormatter: (params: ValueFormatterParams<QbTorrentPeer, number>) =>
          this.fileSizePipe.transform(params.value),
      },
      {
        field: 'up_speed',
        headerName: this.translateService.instant(
          'components.modals.torrent-details.peers.col-def.up_speed',
        ),
        valueFormatter: (params: ValueFormatterParams<QbTorrentPeer, number>) =>
          this.fileSizePipe.transform(params.value),
      },
      {
        field: 'downloaded',
        headerName: this.translateService.instant(
          'components.modals.torrent-details.peers.col-def.downloaded',
        ),
        valueFormatter: (params: ValueFormatterParams<QbTorrentPeer, number>) =>
          this.fileSizePipe.transform(params.value),
      },
      {
        field: 'uploaded',
        headerName: this.translateService.instant(
          'components.modals.torrent-details.peers.col-def.uploaded',
        ),
        valueFormatter: (params: ValueFormatterParams<QbTorrentPeer, number>) =>
          this.fileSizePipe.transform(params.value),
      },
      {
        field: 'relevance',
        headerName: this.translateService.instant(
          'components.modals.torrent-details.peers.col-def.relevance',
        ),
      },
      {
        field: 'files',
        headerName: this.translateService.instant(
          'components.modals.torrent-details.peers.col-def.files',
        ),
      },
    ];
  }
}

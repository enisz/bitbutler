import { ChangeDetectorRef, Component, inject, Input, OnInit } from '@angular/core';
import { TranslateService } from '@ngx-translate/core';
import { AgGridAngular } from 'ag-grid-angular';
import { ColDef, GridApi, GridOptions, GridReadyEvent, IOverlayParams } from 'ag-grid-community';
import { GRID_DARK_THEME, GRID_LIGHT_THEME, GRID_SHARED_OPTIONS } from '../../../../app.const';
import { QbTorrentTracker } from '../../../../models/qbittorrent.model';
import { LoadingOverlay } from '../../../../pages/main/grid/overlays/loading-overlay/loading-overlay';
import { NoRowOverlay } from '../../../../pages/main/grid/overlays/no-row-overlay/no-row-overlay';
import { QbService } from '../../../../services/qb.service';
import { ServerStoreService } from '../../../../services/server-store.service';
import { ThemeService } from '../../../../services/theme.service';
import { TorrentDetailTabComponent } from '../torrent-details.interface';

@Component({
  selector: 'app-trackers',
  imports: [AgGridAngular],
  templateUrl: './trackers.html',
  styleUrl: './trackers.scss',
})
export class Trackers implements TorrentDetailTabComponent, OnInit {
  @Input() public hash: string = '';
  @Input() public context: Record<string, any> = {};

  private readonly qbService = inject(QbService);
  private readonly serverStoreService = inject(ServerStoreService);
  private readonly changeDetectorRef = inject(ChangeDetectorRef);
  private readonly themeService = inject(ThemeService);
  private readonly translateService = inject(TranslateService);

  public theme = this.themeService.effectiveMode;

  public trackers: QbTorrentTracker[] = [];
  public loading = true;

  public gridApi: GridApi | null = null;

  public bbDark = GRID_DARK_THEME;
  public bbLight = GRID_LIGHT_THEME;

  public gridOptions: GridOptions = this.getGridOptions();
  public colDefs: ColDef[] = this.getColDefs();

  public ngOnInit(): void {
    this.load();
  }

  public onGridReady(e: GridReadyEvent<QbTorrentTracker>): void {
    this.gridApi = e.api;
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
    };
  }

  private getColDefs(): ColDef[] {
    return [
      {
        field: 'tier',
        width: 70,
        headerName: this.translateService.instant(
          'components.modals.torrent-details.trackers.col-def.tier',
        ),
        sortable: true,
        resizable: true,
      },
      {
        field: 'url',
        headerName: this.translateService.instant(
          'components.modals.torrent-details.trackers.col-def.url',
        ),
        sortable: true,
        resizable: true,
      },
      {
        field: 'status',
        headerName: this.translateService.instant(
          'components.modals.torrent-details.trackers.col-def.status',
        ),
        sortable: true,
        resizable: true,
      },
      {
        field: 'num_peers',
        headerName: this.translateService.instant(
          'components.modals.torrent-details.trackers.col-def.num_peers',
        ),
        sortable: true,
        resizable: true,
      },
      {
        field: 'num_seeds',
        headerName: this.translateService.instant(
          'components.modals.torrent-details.trackers.col-def.num_seeds',
        ),
        sortable: true,
        resizable: true,
      },
      {
        field: 'num_leeches',
        headerName: this.translateService.instant(
          'components.modals.torrent-details.trackers.col-def.num_leeches',
        ),
        sortable: true,
        resizable: true,
      },
      {
        field: 'num_downloaded',
        headerName: this.translateService.instant(
          'components.modals.torrent-details.trackers.col-def.num_downloaded',
        ),
        sortable: true,
        resizable: true,
      },
      {
        field: 'msg',
        headerName: this.translateService.instant(
          'components.modals.torrent-details.trackers.col-def.msg',
        ),
        sortable: true,
        resizable: true,
      },
    ];
  }
}

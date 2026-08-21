import { NgOptimizedImage } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  OnDestroy,
  computed,
  effect,
  inject,
  signal,
} from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { FontAwesomeModule } from '@fortawesome/angular-fontawesome';
import { faBars, faChevronRight } from '@fortawesome/free-solid-svg-icons';
import { Subscription, first } from 'rxjs';
import { DEFAULT_SIDEBAR_SETTINGS } from '../../models/sidebar-settings.model';
import { Maindata, QbServerState } from '../../models/torrent.model';
import { QbPollingService } from '../../services/qb-polling.service';
import { ServerStoreService } from '../../services/server-store.service';
import { SidebarSettingsService } from '../../services/sidebar-settings.service';
import { ThemeService } from '../../services/theme.service';
import { TorrentListGridSettingsService } from '../../services/torrent-list-grid.settings.service';
import { TorrentStoreService } from '../../services/torrent-store.service';
import { ButtonBar } from './button-bar/button-bar';
import { Grid } from './grid/grid';
import { ServerState } from './server-state/server-state';
import { Status } from './status/status';

@Component({
  selector: 'app-main',
  imports: [Grid, Status, ButtonBar, NgOptimizedImage, ServerState, FontAwesomeModule],
  templateUrl: './main.html',
  styleUrl: './main.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Main implements OnDestroy {
  private readonly qbPollingService = inject(QbPollingService);
  private readonly serverStoreService = inject(ServerStoreService);
  private readonly torrentStore = inject(TorrentStoreService);
  private readonly themeService = inject(ThemeService);
  private readonly torrentListGridSettingsService = inject(TorrentListGridSettingsService);
  private readonly sidebarSettingsService = inject(SidebarSettingsService);
  private pollSub: Subscription | null = null;
  public currentServer = this.serverStoreService.currentServer;
  public readonly logoUrl = computed(
    () => `assets/images/bitbutler-logo-${this.themeService.family()}.png`,
  );

  public readonly icons = { faBars, faChevronRight };
  private readonly sidebarSettings = toSignal(this.sidebarSettingsService.asObservable());
  public readonly sidebarCollapsed = computed(() => this.sidebarSettings()?.collapsed ?? false);

  public toggleSidebar(): void {
    const current = this.sidebarSettings();
    this.sidebarSettingsService.save({
      collapsed: !(current?.collapsed ?? false),
      filterGroupsOpen: current?.filterGroupsOpen ?? DEFAULT_SIDEBAR_SETTINGS.filterGroupsOpen,
      activeFilters: current?.activeFilters ?? DEFAULT_SIDEBAR_SETTINGS.activeFilters,
    });
  }

  readonly theme = this.themeService.effectiveMode;
  readonly serverState = signal<QbServerState | null>(null);
  readonly connectionStatus = computed(() => this.serverState()?.connection_status || 'offline');
  private readonly _pollEffect = effect((onCleanup) => {
    const serverId = this.serverStoreService.currentServerId();

    this.pollSub?.unsubscribe();
    this.pollSub = null;
    this.serverState.set(null);

    if (!serverId) return;

    const sub = new Subscription();
    this.pollSub = sub;

    this.torrentListGridSettingsService
      .asObservable()
      .pipe(first())
      .subscribe((prefs) => {
        const sortCol = prefs?.columnState?.find(
          (c: any) => typeof c === 'object' && c !== null && c.sort,
        ) as any;

        const sortBy = sortCol?.colId;
        const sortDesc = sortCol?.sort === 'desc';

        sub.add(
          this.qbPollingService
            .startMaindataPolling(serverId, sortBy, sortDesc)
            .subscribe((data: Maindata) => {
              this.torrentStore.applyMaindata(data);
              this.serverState.update((prev) => mergeServerState(prev, data.server_state));
            }),
        );
      });

    onCleanup(() => sub.unsubscribe());
  });

  constructor() {
    this.serverStoreService.refresh();
  }

  ngOnDestroy(): void {
    this.pollSub?.unsubscribe();
    this.pollSub = null;
  }
}

function mergeServerState(
  prev: QbServerState | null,
  patch: QbServerState | null | undefined,
): QbServerState | null {
  if (!patch) return prev;
  if (!prev) return patch;

  const out: any = { ...prev };
  for (const k of Object.keys(patch as any)) {
    const v = (patch as any)[k];
    if (v !== undefined) out[k] = v;
  }
  return out as QbServerState;
}

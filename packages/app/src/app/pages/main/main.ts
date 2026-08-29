import {
  ChangeDetectionStrategy,
  Component,
  OnDestroy,
  computed,
  effect,
  inject,
} from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { FontAwesomeModule } from '@fortawesome/angular-fontawesome';
import { faBars, faChevronRight } from '@fortawesome/free-solid-svg-icons';
import { Subscription } from 'rxjs';
import { BbLogo } from '../../components/bb-logo/bb-logo';
import { DEFAULT_SIDEBAR_SETTINGS } from '../../models/sidebar-settings.model';
import { Maindata } from '../../models/torrent.model';
import { QbPollingService } from '../../services/qb-polling.service';
import { ServerStoreService } from '../../services/server-store.service';
import { SidebarSettingsService } from '../../services/sidebar-settings.service';
import { ThemeService } from '../../services/theme.service';
import { TorrentStoreService } from '../../services/torrent-store.service';
import { ButtonBar } from './button-bar/button-bar';
import { Grid } from './grid/grid';
import { ServerState } from './server-state/server-state';
import { Status } from './status/status';

@Component({
  selector: 'app-main',
  imports: [Grid, Status, ButtonBar, BbLogo, ServerState, FontAwesomeModule],
  templateUrl: './main.html',
  styleUrl: './main.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Main implements OnDestroy {
  private readonly qbPollingService = inject(QbPollingService);
  private readonly serverStoreService = inject(ServerStoreService);
  private readonly torrentStore = inject(TorrentStoreService);
  private readonly themeService = inject(ThemeService);
  private readonly sidebarSettingsService = inject(SidebarSettingsService);
  private pollSub: Subscription | null = null;
  public currentServer = this.serverStoreService.currentServer;

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
  readonly serverState = this.torrentStore.serverState;
  readonly connectionStatus = computed(() => this.serverState()?.connection_status || 'offline');
  private readonly _pollEffect = effect((onCleanup) => {
    const serverId = this.serverStoreService.currentServerId();

    this.pollSub?.unsubscribe();
    this.pollSub = null;

    if (!serverId) return;

    const sub = new Subscription();
    this.pollSub = sub;

    sub.add(
      this.qbPollingService.startMaindataPolling(serverId).subscribe((data: Maindata) => {
        this.torrentStore.applyMaindata(data);
      }),
    );

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

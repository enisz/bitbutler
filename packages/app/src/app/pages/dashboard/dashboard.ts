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
import { TranslatePipe } from '@ngx-translate/core';
import {
  GridstackComponent,
  GridstackItemComponent,
  NgGridStackWidget,
} from 'gridstack/dist/angular';
import { Subscription } from 'rxjs';
import {
  DashboardWidgetInstance,
  StatTileData,
  TorrentListData,
} from '../../models/dashboard.model';
import { DashboardSettingsService } from '../../services/dashboard-settings.service';
import { QbPollingService } from '../../services/qb-polling.service';
import { ServerStoreService } from '../../services/server-store.service';
import { TorrentStoreService } from '../../services/torrent-store.service';
import { WIDGET_CATALOG } from './widget-catalog';
import { resolveWidgetData } from './widget-selectors';
import { StatTile } from './widgets/stat-tile/stat-tile';
import { TorrentListWidget } from './widgets/torrent-list-widget/torrent-list-widget';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [GridstackComponent, GridstackItemComponent, TranslatePipe],
  templateUrl: './dashboard.html',
  styleUrl: './dashboard.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Dashboard implements OnDestroy {
  private readonly qbPollingService = inject(QbPollingService);
  private readonly serverStoreService = inject(ServerStoreService);
  private readonly torrentStore = inject(TorrentStoreService);
  private readonly dashboardSettingsService = inject(DashboardSettingsService);

  readonly widgets = signal<DashboardWidgetInstance[]>([]);
  readonly isPaused = toSignal(this.qbPollingService.isPaused$, { initialValue: false });

  readonly gridOptions = { column: 12, cellHeight: 64, margin: 8, staticGrid: true };

  private readonly snapshot = computed(() => ({
    torrents: this.torrentStore.torrentsArray(),
    serverState: this.torrentStore.serverState(),
  }));

  private readonly dataCache = new Map<
    string,
    { instance: DashboardWidgetInstance; value: StatTileData | TorrentListData }
  >();

  readonly items = computed<NgGridStackWidget[]>(() =>
    this.widgets().map((instance) => ({
      id: instance.instanceId,
      x: instance.x,
      y: instance.y,
      w: instance.w,
      h: instance.h,
      component: WIDGET_CATALOG[instance.widgetTypeId].componentSelector,
      props: { data: this.dataFor(instance) },
    })),
  );

  private pauseToken: symbol | null = null;
  private pollSub: Subscription | null = null;

  private readonly _pollEffect = effect((onCleanup) => {
    const serverId = this.serverStoreService.currentServerId();

    this.pollSub?.unsubscribe();
    this.pollSub = null;

    if (!serverId) return;

    const sub = new Subscription();
    this.pollSub = sub;
    sub.add(
      this.qbPollingService
        .startMaindataPolling(serverId)
        .subscribe((data) => this.torrentStore.applyMaindata(data)),
    );

    onCleanup(() => sub.unsubscribe());
  });

  constructor() {
    GridstackComponent.registerComponents([StatTile, TorrentListWidget]);
    void this.dashboardSettingsService.load().then((layout) => this.widgets.set(layout.widgets));
  }

  ngOnDestroy(): void {
    this.pollSub?.unsubscribe();
    this.pollSub = null;
  }

  toggleLive(): void {
    if (this.isPaused()) {
      if (this.pauseToken) this.qbPollingService.resume(this.pauseToken);
      this.pauseToken = null;
    } else {
      this.pauseToken = this.qbPollingService.pause();
    }
  }

  dataFor(instance: DashboardWidgetInstance): StatTileData | TorrentListData {
    const cached = this.dataCache.get(instance.instanceId);
    if (cached && cached.instance === instance) return cached.value;

    const value = resolveWidgetData(instance, this.snapshot());
    this.dataCache.set(instance.instanceId, { instance, value });
    return value;
  }
}

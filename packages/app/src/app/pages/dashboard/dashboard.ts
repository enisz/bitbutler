import {
  ChangeDetectionStrategy,
  Component,
  OnDestroy,
  computed,
  effect,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { Router } from '@angular/router';
import { FontAwesomeModule } from '@fortawesome/angular-fontawesome';
import {
  faChevronLeft,
  faLock,
  faPause,
  faPlay,
  faPlus,
  faUnlock,
} from '@fortawesome/free-solid-svg-icons';
import { NgbModal, NgbOffcanvas, NgbTooltipModule } from '@ng-bootstrap/ng-bootstrap';
import { TranslatePipe } from '@ngx-translate/core';
import {
  GridstackComponent,
  NgGridStackOptions,
  NgGridStackWidget,
  elementCB,
  nodesCB,
} from 'gridstack/dist/angular';
import { Subscription } from 'rxjs';
import { WidgetConfig as WidgetConfigModal } from '../../modals/widget-config/widget-config';
import { WidgetPicker } from '../../modals/widget-picker/widget-picker';
import {
  DashboardSnapshot,
  DashboardWidgetInstance,
  PieChartData,
  StatTileData,
  TorrentListData,
  WidgetConfig,
  WidgetTypeId,
} from '../../models/dashboard.model';
import { DashboardSettingsService } from '../../services/dashboard-settings.service';
import { QbPollingService } from '../../services/qb-polling.service';
import { ServerStoreService } from '../../services/server-store.service';
import { TorrentStoreService } from '../../services/torrent-store.service';
import { setModalInput } from '../../utils/modal-input';
import { WIDGET_CATALOG } from './widget-catalog';
import { resolveWidgetData } from './widget-selectors';
import { PieChartWidget } from './widgets/pie-chart-widget/pie-chart-widget';
import { StatTile } from './widgets/stat-tile/stat-tile';
import { TorrentListWidget } from './widgets/torrent-list-widget/torrent-list-widget';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [GridstackComponent, TranslatePipe, FontAwesomeModule, NgbTooltipModule],
  templateUrl: './dashboard.html',
  styleUrl: './dashboard.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Dashboard implements OnDestroy {
  private readonly qbPollingService = inject(QbPollingService);
  private readonly serverStoreService = inject(ServerStoreService);
  private readonly torrentStore = inject(TorrentStoreService);
  private readonly dashboardSettingsService = inject(DashboardSettingsService);
  private readonly modalService = inject(NgbModal);
  private readonly offcanvasService = inject(NgbOffcanvas);
  private readonly router = inject(Router);

  readonly widgets = signal<DashboardWidgetInstance[]>([]);
  readonly isPaused = toSignal(this.qbPollingService.isPaused$, { initialValue: false });
  readonly isLocked = signal(true);
  readonly icon = { faChevronLeft, faLock, faUnlock, faPlay, faPause, faPlus };

  // GridstackComponent's own `options` setter only calls the underlying grid's `load()` when
  // `children?.length` is truthy - an empty array is falsy on `.length`, so removing the last
  // widget never actually reaches GridStack.load() and its DOM node is left behind. Removing the
  // last widget needs an explicit `grid.removeAll()` call instead of relying on the options diff.
  private readonly gridComponent = viewChild(GridstackComponent);

  private readonly snapshot = computed<DashboardSnapshot>(() => ({
    torrents: this.torrentStore.torrentsArray(),
    serverState: this.torrentStore.serverState(),
  }));

  private readonly dataCache = new Map<
    string,
    {
      instance: DashboardWidgetInstance;
      snapshot: DashboardSnapshot;
      value: StatTileData | TorrentListData | PieChartData;
    }
  >();

  readonly items = computed<NgGridStackWidget[]>(() =>
    this.widgets().map((instance) => ({
      id: instance.instanceId,
      x: instance.x,
      y: instance.y,
      w: instance.w,
      h: instance.h,
      component: WIDGET_CATALOG[instance.widgetTypeId].componentSelector,
      props: {
        data: this.dataFor(instance),
        onConfigure: () => this.editWidget(instance.instanceId),
        onRemove: () => this.removeWidget(instance.instanceId),
      },
    })),
  );

  // gridstack's Angular bindings only invoke gsCreateNgComponents (the hook that actually
  // instantiates `component`/`props` into real Angular components) for widgets it creates via
  // GridStack.load()/updateOptions({ children }) - NOT for <gridstack-item> template elements,
  // whose [options] setter always stamps the pre-existing DOM node (`el`) into the node options,
  // which makes GridStack reuse that node instead of calling the create hook. So the widget list
  // must be delivered as `options.children`, not as templated <gridstack-item> children.
  readonly gridOptions = computed<NgGridStackOptions>(() => ({
    column: 12,
    cellHeight: 64,
    margin: 8,
    staticGrid: this.isLocked(),
    children: this.items(),
  }));

  private pauseToken: symbol | null = null;
  // Separate from `pauseToken` (which tracks the manual "Live"/"Paused" toggle) so a drag/resize
  // pause-and-resume never clobbers a pause the user explicitly requested, and vice versa - both
  // are tokens in QbPollingService's pause-token Set, which only reports "resumed" once every
  // token has been removed.
  private dragPauseToken: symbol | null = null;
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
    GridstackComponent.registerComponents([StatTile, TorrentListWidget, PieChartWidget]);
    void this.dashboardSettingsService.load().then((layout) => this.widgets.set(layout.widgets));
  }

  ngOnDestroy(): void {
    this.pollSub?.unsubscribe();
    this.pollSub = null;
  }

  toggleLock(): void {
    this.isLocked.update((locked) => !locked);
  }

  toggleLive(): void {
    if (this.isPaused()) {
      if (this.pauseToken) this.qbPollingService.resume(this.pauseToken);
      this.pauseToken = null;
    } else {
      this.pauseToken = this.qbPollingService.pause();
    }
  }

  goToTorrentList(): void {
    void this.router.navigate(['/pages/torrent-list']);
  }

  openWidgetPicker(): void {
    const pickerRef = this.offcanvasService.open(WidgetPicker, {
      position: 'end',
      panelClass: 'widget-picker-offcanvas',
    });
    pickerRef.result
      .then((widgetTypeId: WidgetTypeId) => {
        const meta = WIDGET_CATALOG[widgetTypeId];
        const configRef = this.modalService.open(WidgetConfigModal, { centered: true });
        setModalInput(configRef, 'widgetTypeId', widgetTypeId);
        setModalInput(configRef, 'initialConfig', meta.defaultConfig);

        return configRef.result.then((config: WidgetConfig) => {
          const instance: DashboardWidgetInstance = {
            instanceId: crypto.randomUUID(),
            widgetTypeId,
            x: 0,
            y: 0,
            w: meta.defaultSize.w,
            h: meta.defaultSize.h,
            config,
          };
          const next = [...this.widgets(), instance];
          this.widgets.set(next);
          void this.dashboardSettingsService.save({ widgets: next });
        });
      })
      .catch(() => {});
  }

  editWidget(instanceId: string): void {
    const target = this.widgets().find((w) => w.instanceId === instanceId);
    if (!target) return;

    const configRef = this.modalService.open(WidgetConfigModal, { centered: true });
    setModalInput(configRef, 'widgetTypeId', target.widgetTypeId);
    setModalInput(configRef, 'initialConfig', target.config);

    configRef.result
      .then((config: WidgetConfig) => {
        const next = this.widgets().map((w) =>
          w.instanceId === instanceId ? { ...w, config } : w,
        );
        this.widgets.set(next);
        void this.dashboardSettingsService.save({ widgets: next });
      })
      .catch(() => {});
  }

  removeWidget(instanceId: string): void {
    const next = this.widgets().filter((w) => w.instanceId !== instanceId);
    this.widgets.set(next);
    if (next.length === 0) {
      // GridStack.load() never runs for an empty children array (see `gridComponent` comment
      // above), so explicitly tear down the grid's remaining DOM node/Angular component here.
      this.gridComponent()?.grid?.removeAll();
    }
    void this.dashboardSettingsService.save({ widgets: next });
  }

  // Live polling recomputes `gridOptions` (via `items()`/`snapshot()`), which re-triggers
  // GridStack.load() and unconditionally repositions widgets to their last-persisted x/y - so a
  // poll tick landing mid-drag/resize would snap the widget back under the user's cursor. Pause
  // polling for the duration of the interaction and resume once it settles.
  onInteractionStart(_event: elementCB): void {
    if (this.dragPauseToken) return;
    this.dragPauseToken = this.qbPollingService.pause();
  }

  onInteractionStop(_event: elementCB): void {
    if (!this.dragPauseToken) return;
    this.qbPollingService.resume(this.dragPauseToken);
    this.dragPauseToken = null;
  }

  onGridChange(event: nodesCB): void {
    const positions = new Map(event.nodes.map((n) => [String(n.id), n]));
    const next = this.widgets().map((w) => {
      const pos = positions.get(w.instanceId);
      if (!pos) return w;
      return {
        ...w,
        x: pos.x ?? w.x,
        y: pos.y ?? w.y,
        w: pos.w ?? w.w,
        h: pos.h ?? w.h,
      };
    });
    this.widgets.set(next);
    void this.dashboardSettingsService.save({ widgets: next });
  }

  dataFor(instance: DashboardWidgetInstance): StatTileData | TorrentListData | PieChartData {
    // Read snapshot() unconditionally (even on a cache hit) so this computed-reactive read always
    // happens during evaluation - otherwise, once the cache warms, `items` (which calls dataFor())
    // would stop depending on torrentsArray/serverState and would never react to a live update
    // again, since a computed's tracked dependencies are only those read during its most recent
    // evaluation.
    const snap = this.snapshot();
    const cached = this.dataCache.get(instance.instanceId);
    if (cached && cached.instance === instance && cached.snapshot === snap) return cached.value;

    const value = resolveWidgetData(instance, snap);
    this.dataCache.set(instance.instanceId, { instance, snapshot: snap, value });
    return value;
  }
}

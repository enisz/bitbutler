import { NO_ERRORS_SCHEMA, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { NgbModal, NgbOffcanvas } from '@ng-bootstrap/ng-bootstrap';
import { TranslatePipe } from '@ngx-translate/core';
import { Subject } from 'rxjs';
import { DashboardWidgetInstance } from '../../models/dashboard.model';
import { DashboardSettingsService } from '../../services/dashboard-settings.service';
import { QbPollingService } from '../../services/qb-polling.service';
import { ServerStoreService } from '../../services/server-store.service';
import { TorrentStoreService } from '../../services/torrent-store.service';
import { Dashboard } from './dashboard';

describe('Dashboard', () => {
  let component: Dashboard;
  let fixture: ComponentFixture<Dashboard>;

  let serverStoreMock: { currentServerId: ReturnType<typeof signal<string | null>> };
  let torrentStoreMock: {
    torrentsArray: ReturnType<typeof signal<any[]>>;
    serverState: ReturnType<typeof signal<any>>;
    applyMaindata: ReturnType<typeof vi.fn>;
  };
  let qbPollingMock: {
    startMaindataPolling: ReturnType<typeof vi.fn>;
    isPaused$: Subject<boolean>;
    pause: ReturnType<typeof vi.fn>;
    resume: ReturnType<typeof vi.fn>;
  };
  let dashboardSettingsMock: { load: ReturnType<typeof vi.fn>; save: ReturnType<typeof vi.fn> };
  let modalServiceMock: { open: ReturnType<typeof vi.fn> };
  let offcanvasServiceMock: { open: ReturnType<typeof vi.fn> };
  let routerMock: { navigate: ReturnType<typeof vi.fn> };

  const statTileInstance: DashboardWidgetInstance = {
    instanceId: 'w1',
    widgetTypeId: 'stat-tile',
    x: 0,
    y: 0,
    w: 3,
    h: 2,
    config: { metric: 'download_speed' },
  };

  async function createComponent(): Promise<void> {
    await TestBed.configureTestingModule({
      imports: [Dashboard],
      providers: [
        { provide: ServerStoreService, useValue: serverStoreMock },
        { provide: TorrentStoreService, useValue: torrentStoreMock },
        { provide: QbPollingService, useValue: qbPollingMock },
        { provide: DashboardSettingsService, useValue: dashboardSettingsMock },
        { provide: NgbModal, useValue: modalServiceMock },
        { provide: NgbOffcanvas, useValue: offcanvasServiceMock },
        { provide: Router, useValue: routerMock },
      ],
      schemas: [NO_ERRORS_SCHEMA],
    })
      .overrideComponent(Dashboard, {
        set: { imports: [TranslatePipe], schemas: [NO_ERRORS_SCHEMA] },
      })
      .compileComponents();

    fixture = TestBed.createComponent(Dashboard);
    component = fixture.componentInstance;
    fixture.detectChanges();
    await Promise.resolve();
    fixture.detectChanges();
  }

  beforeEach(() => {
    serverStoreMock = { currentServerId: signal<string | null>(null) };
    torrentStoreMock = {
      torrentsArray: signal([]),
      serverState: signal(null),
      applyMaindata: vi.fn(),
    };
    qbPollingMock = {
      startMaindataPolling: vi.fn().mockReturnValue(new Subject()),
      isPaused$: new Subject<boolean>(),
      pause: vi.fn().mockImplementation(() => Symbol('pause-token')),
      resume: vi.fn(),
    };
    dashboardSettingsMock = {
      load: vi.fn().mockResolvedValue({ widgets: [statTileInstance] }),
      save: vi.fn().mockResolvedValue(undefined),
    };
    modalServiceMock = { open: vi.fn() };
    offcanvasServiceMock = { open: vi.fn() };
    routerMock = { navigate: vi.fn() };
  });

  it('should create', async () => {
    await createComponent();
    expect(component).toBeTruthy();
  });

  it('should load the persisted layout into widgets()', async () => {
    await createComponent();
    expect(component.widgets()).toEqual([statTileInstance]);
  });

  describe('goToTorrentList', () => {
    it('should navigate back to the torrent list page', async () => {
      await createComponent();
      component.goToTorrentList();
      expect(routerMock.navigate).toHaveBeenCalledWith(['/pages/torrent-list']);
    });
  });

  describe('polling lifecycle', () => {
    it('should start polling when a server becomes current', async () => {
      await createComponent();
      expect(qbPollingMock.startMaindataPolling).not.toHaveBeenCalled();

      serverStoreMock.currentServerId.set('server-1');
      fixture.detectChanges();

      expect(qbPollingMock.startMaindataPolling).toHaveBeenCalledWith('server-1');
    });

    it('should stop the previous subscription and start a new one on server switch', async () => {
      await createComponent();
      serverStoreMock.currentServerId.set('server-1');
      fixture.detectChanges();
      serverStoreMock.currentServerId.set('server-2');
      fixture.detectChanges();

      expect(qbPollingMock.startMaindataPolling).toHaveBeenCalledTimes(2);
      expect(qbPollingMock.startMaindataPolling).toHaveBeenLastCalledWith('server-2');
    });
  });

  describe('toggleLock', () => {
    it('should default isLocked to true', async () => {
      await createComponent();
      expect(component.isLocked()).toBe(true);
    });

    it('should flip isLocked when toggled', async () => {
      await createComponent();
      component.toggleLock();
      expect(component.isLocked()).toBe(false);
      component.toggleLock();
      expect(component.isLocked()).toBe(true);
    });

    it('should reflect isLocked as gridOptions.staticGrid', async () => {
      await createComponent();
      expect(component.gridOptions().staticGrid).toBe(true);
      component.toggleLock();
      expect(component.gridOptions().staticGrid).toBe(false);
    });
  });

  describe('toggleLive', () => {
    it('should pause via QbPollingService when live and toggled', async () => {
      await createComponent();
      component.toggleLive();
      expect(qbPollingMock.pause).toHaveBeenCalled();
    });

    it('should resume via QbPollingService when paused and toggled', async () => {
      await createComponent();
      component.toggleLive();
      qbPollingMock.isPaused$.next(true);
      fixture.detectChanges();
      component.toggleLive();
      expect(qbPollingMock.resume).toHaveBeenCalled();
    });
  });

  describe('dataFor', () => {
    it('should memoize widget data across calls for the same instance reference', async () => {
      await createComponent();
      const first = component.dataFor(statTileInstance);
      const second = component.dataFor(statTileInstance);
      expect(first).toBe(second);
    });

    it('should recompute when the instance reference changes (e.g. after a config edit)', async () => {
      await createComponent();
      component.dataFor(statTileInstance);

      torrentStoreMock.serverState.set({ up_info_speed: 777 });
      const edited: DashboardWidgetInstance = {
        ...statTileInstance,
        config: { metric: 'upload_speed' },
      };

      expect(component.dataFor(edited)).toEqual({ metric: 'upload_speed', value: 777 });
    });

    // Regression test: dataFor() must re-read the reactive snapshot() on every call - even a
    // cache hit - or `items` (which calls dataFor()) permanently drops its dependency on
    // torrentsArray/serverState after the cache warms once, since a computed()'s tracked
    // dependencies are only those actually read during its most recent evaluation.
    it('should recompute when the snapshot changes for the same instance reference (live update)', async () => {
      await createComponent();
      expect(component.dataFor(statTileInstance)).toEqual({ metric: 'download_speed', value: 0 });

      torrentStoreMock.serverState.set({ dl_info_speed: 999 });

      expect(component.dataFor(statTileInstance)).toEqual({
        metric: 'download_speed',
        value: 999,
      });
    });
  });

  describe('items', () => {
    it('should map each placed widget instance to a gridstack node with component/props fields', async () => {
      await createComponent();

      const items = component.items();
      expect(items).toHaveLength(1);
      expect(items[0]).toMatchObject({
        id: 'w1',
        x: 0,
        y: 0,
        w: 3,
        h: 2,
        component: 'app-stat-tile',
        props: {
          data: { metric: 'download_speed', value: 0 },
        },
      });
      expect(typeof (items[0].props as any).onConfigure).toBe('function');
      expect(typeof (items[0].props as any).onRemove).toBe('function');
    });

    it("should route each widget's onConfigure/onRemove callback to editWidget/removeWidget for that instance", async () => {
      dashboardSettingsMock.save = vi.fn().mockResolvedValue(undefined);
      const configResult = Promise.resolve({ metric: 'active_count' });
      modalServiceMock.open.mockReturnValue({ result: configResult, componentInstance: {} });
      await createComponent();

      const props = component.items()[0].props as any;
      props.onConfigure();
      await configResult;
      await Promise.resolve();

      expect(component.widgets()[0]).toMatchObject({ config: { metric: 'active_count' } });

      props.onRemove();
      expect(component.widgets()).toEqual([]);
    });

    it('should map a pie-chart instance to the app-pie-chart-widget component', async () => {
      dashboardSettingsMock.load = vi.fn().mockResolvedValue({
        widgets: [
          {
            instanceId: 'w2',
            widgetTypeId: 'pie-chart',
            x: 0,
            y: 0,
            w: 4,
            h: 4,
            config: { groupBy: 'state' },
          },
        ],
      });
      await createComponent();

      expect(component.items()[0].component).toBe('app-pie-chart-widget');
    });

    it('should map a bar-chart instance to the app-bar-chart-widget component', async () => {
      dashboardSettingsMock.load = vi.fn().mockResolvedValue({
        widgets: [
          {
            instanceId: 'w3',
            widgetTypeId: 'bar-chart',
            x: 0,
            y: 0,
            w: 4,
            h: 4,
            config: { field: 'state' },
          },
        ],
      });
      await createComponent();

      expect(component.items()[0].component).toBe('app-bar-chart-widget');
    });

    it('should map an active-downloads instance to the app-active-downloads-widget component', async () => {
      dashboardSettingsMock.load = vi.fn().mockResolvedValue({
        widgets: [
          {
            instanceId: 'w4',
            widgetTypeId: 'active-downloads',
            x: 0,
            y: 0,
            w: 6,
            h: 4,
            config: { count: 5 },
          },
        ],
      });
      await createComponent();

      expect(component.items()[0].component).toBe('app-active-downloads-widget');
    });
  });

  describe('onGridChange', () => {
    it('should update the matching widget position/size and persist the layout', async () => {
      dashboardSettingsMock.save = vi.fn().mockResolvedValue(undefined);
      await createComponent();

      component.onGridChange({ nodes: [{ id: 'w1', x: 4, y: 1, w: 5, h: 3 }] } as any);

      expect(component.widgets()[0]).toMatchObject({ x: 4, y: 1, w: 5, h: 3 });
      expect(dashboardSettingsMock.save).toHaveBeenCalledWith({ widgets: component.widgets() });
    });

    it('should leave widgets with no matching node untouched', async () => {
      await createComponent();
      const before = component.widgets()[0];
      component.onGridChange({ nodes: [{ id: 'not-w1', x: 9, y: 9, w: 9, h: 9 }] } as any);
      expect(component.widgets()[0]).toEqual(before);
    });
  });

  // Regression coverage: live polling recomputes gridOptions() on every poll tick, which
  // unconditionally repositions widgets via GridStack.load() - so a poll landing mid-drag/resize
  // would snap the widget back under the user's cursor. Polling must be paused for the duration
  // of the interaction, using a token kept separate from toggleLive()'s own pauseToken so neither
  // interaction clobbers the other's pause/resume state.
  describe('onInteractionStart / onInteractionStop', () => {
    it('should pause polling on interaction start', async () => {
      await createComponent();
      component.onInteractionStart({} as any);
      expect(qbPollingMock.pause).toHaveBeenCalled();
    });

    it('should resume polling with the token it received, on interaction stop', async () => {
      await createComponent();
      component.onInteractionStart({} as any);
      const token = qbPollingMock.pause.mock.results[0].value;

      component.onInteractionStop({} as any);

      expect(qbPollingMock.resume).toHaveBeenCalledWith(token);
    });

    it('should not pause again if a second interaction start fires before the first stops', async () => {
      await createComponent();
      component.onInteractionStart({} as any);
      component.onInteractionStart({} as any);
      expect(qbPollingMock.pause).toHaveBeenCalledTimes(1);
    });

    it('should do nothing if stop fires with no interaction in progress', async () => {
      await createComponent();
      component.onInteractionStop({} as any);
      expect(qbPollingMock.resume).not.toHaveBeenCalled();
    });

    it('should not resume the manual Live-toggle pause when a drag/resize interaction stops', async () => {
      await createComponent();

      component.toggleLive(); // manual pause -> its own pauseToken
      const manualToken = qbPollingMock.pause.mock.results[0].value;

      component.onInteractionStart({} as any); // drag pause -> separate dragPauseToken
      const dragToken = qbPollingMock.pause.mock.results[1].value;

      component.onInteractionStop({} as any);

      expect(qbPollingMock.resume).toHaveBeenCalledWith(dragToken);
      expect(qbPollingMock.resume).not.toHaveBeenCalledWith(manualToken);
    });
  });

  describe('openWidgetPicker', () => {
    it('should open the picker offcanvas, then the config modal pre-filled with the catalog default, then append the confirmed instance', async () => {
      dashboardSettingsMock.save = vi.fn().mockResolvedValue(undefined);
      const pickerResult = Promise.resolve('stat-tile');
      const configResult = Promise.resolve({ metric: 'global_ratio' });
      offcanvasServiceMock.open.mockReturnValue({ result: pickerResult });
      modalServiceMock.open.mockReturnValue({ result: configResult, componentInstance: {} });
      await createComponent();

      component.openWidgetPicker();
      await pickerResult;
      await Promise.resolve();
      await configResult;
      await Promise.resolve();

      expect(offcanvasServiceMock.open).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({ position: 'end' }),
      );
      const added = component.widgets().find((w) => w !== statTileInstance);
      expect(added).toMatchObject({
        widgetTypeId: 'stat-tile',
        config: { metric: 'global_ratio' },
      });
      expect(dashboardSettingsMock.save).toHaveBeenCalled();
    });
  });

  describe('editWidget', () => {
    it('should open the config modal pre-filled with the instance config and update it on confirm', async () => {
      dashboardSettingsMock.save = vi.fn().mockResolvedValue(undefined);
      const configResult = Promise.resolve({ metric: 'active_count' });
      modalServiceMock.open.mockReturnValue({ result: configResult, componentInstance: {} });
      await createComponent();

      component.editWidget('w1');
      await configResult;
      await Promise.resolve();

      expect(component.widgets()[0]).toMatchObject({
        instanceId: 'w1',
        config: { metric: 'active_count' },
      });
      expect(dashboardSettingsMock.save).toHaveBeenCalled();
    });

    it('should do nothing for an unknown instance id', async () => {
      await createComponent();
      component.editWidget('does-not-exist');
      expect(modalServiceMock.open).not.toHaveBeenCalled();
    });
  });

  describe('removeWidget', () => {
    it('should remove the matching widget and persist the layout', async () => {
      dashboardSettingsMock.save = vi.fn().mockResolvedValue(undefined);
      await createComponent();

      component.removeWidget('w1');

      expect(component.widgets()).toEqual([]);
      expect(dashboardSettingsMock.save).toHaveBeenCalledWith({ widgets: [] });
    });

    // Regression test: GridstackComponent's `options` setter only calls the underlying grid's
    // load() when `children?.length` is truthy, so removing the last widget never reaches
    // GridStack.load() and its DOM node/component is left behind. removeWidget() must explicitly
    // call `grid.removeAll()` when the widget list becomes empty. `gridComponent` is a
    // viewChild() signal, which real GridStack rendering can't easily exercise in jsdom, so it's
    // stubbed directly here (a standard seam for testing ViewChild/viewChild-based code).
    it('should explicitly clear the grid when the last widget is removed', async () => {
      dashboardSettingsMock.save = vi.fn().mockResolvedValue(undefined);
      await createComponent();
      const removeAll = vi.fn();
      (component as any).gridComponent = () => ({ grid: { removeAll } });

      component.removeWidget('w1');

      expect(removeAll).toHaveBeenCalled();
    });

    it('should not touch the grid when other widgets remain after removal', async () => {
      dashboardSettingsMock.save = vi.fn().mockResolvedValue(undefined);
      dashboardSettingsMock.load = vi.fn().mockResolvedValue({
        widgets: [statTileInstance, { ...statTileInstance, instanceId: 'w2' }],
      });
      await createComponent();
      const removeAll = vi.fn();
      (component as any).gridComponent = () => ({ grid: { removeAll } });

      component.removeWidget('w1');

      expect(component.widgets()).toHaveLength(1);
      expect(removeAll).not.toHaveBeenCalled();
    });
  });
});

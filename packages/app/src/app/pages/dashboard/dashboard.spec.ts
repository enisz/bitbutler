import { NO_ERRORS_SCHEMA, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
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
  let dashboardSettingsMock: { load: ReturnType<typeof vi.fn> };

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
      pause: vi.fn().mockReturnValue(Symbol('pause-token')),
      resume: vi.fn(),
    };
    dashboardSettingsMock = { load: vi.fn().mockResolvedValue({ widgets: [statTileInstance] }) };
  });

  it('should create', async () => {
    await createComponent();
    expect(component).toBeTruthy();
  });

  it('should load the persisted layout into widgets()', async () => {
    await createComponent();
    expect(component.widgets()).toEqual([statTileInstance]);
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
  });
});

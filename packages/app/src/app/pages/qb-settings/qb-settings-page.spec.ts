import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, Router, convertToParamMap } from '@angular/router';
import { BehaviorSubject } from 'rxjs';
import { QbService } from '../../services/qb.service';
import { ServerStoreService } from '../../services/server-store.service';
import { ToastService } from '../../services/toast.service';
import { QbSettingsPage } from './qb-settings-page';
import { QbSettingsStateService } from './qb-settings-state.service';
import { QB_SETTINGS_TAB_IDS } from './qb-settings.interface';

describe('QbSettingsPage', () => {
  let paramMap$: BehaviorSubject<ReturnType<typeof convertToParamMap>>;
  let navigate: ReturnType<typeof vi.fn>;
  let toast: { success: ReturnType<typeof vi.fn>; danger: ReturnType<typeof vi.fn> };
  let preferences: ReturnType<typeof vi.fn>;
  let currentServerId: ReturnType<typeof signal<string | null>>;
  let state: QbSettingsStateService;

  const createPage = async (pane: string | null = 'bandwidth'): Promise<QbSettingsPage> => {
    paramMap$.next(convertToParamMap(pane ? { pane } : {}));
    const page = TestBed.runInInjectionContext(() => new QbSettingsPage());
    await page.ngOnInit();
    return page;
  };

  beforeEach(() => {
    paramMap$ = new BehaviorSubject(convertToParamMap({}));
    navigate = vi.fn().mockResolvedValue(true);
    toast = { success: vi.fn(), danger: vi.fn() };
    preferences = vi.fn().mockResolvedValue({ save_path: '/data' });
    currentServerId = signal<string | null>('s1');
    state = new QbSettingsStateService();

    TestBed.configureTestingModule({
      providers: [
        { provide: QbSettingsStateService, useValue: state },
        { provide: Router, useValue: { navigate } },
        { provide: ActivatedRoute, useValue: { paramMap: paramMap$.asObservable() } },
        { provide: ToastService, useValue: toast },
        { provide: QbService, useValue: { app: { preferences } } },
        {
          provide: ServerStoreService,
          useValue: { currentServerId, currentServer: signal({ id: 's1', name: 'Home' }) },
        },
      ],
    });
  });

  it('loads the preferences before it reports ready', async () => {
    const page = await createPage();

    expect(preferences).toHaveBeenCalledWith('s1');
    expect(state.preferences()).toEqual({ save_path: '/data' });
    expect(page.status()).toBe('ready');
  });

  it('is loading until the preferences arrive', () => {
    preferences.mockReturnValue(new Promise(() => {}));
    paramMap$.next(convertToParamMap({ pane: 'bandwidth' }));
    const page = TestBed.runInInjectionContext(() => new QbSettingsPage());
    void page.ngOnInit();

    expect(page.status()).toBe('loading');
  });

  it('shows the error state when the preferences fail to load, and Retry recovers', async () => {
    preferences.mockRejectedValueOnce(new Error('offline'));
    const page = await createPage();
    expect(page.status()).toBe('error');

    await page.onRetry();

    expect(page.status()).toBe('ready');
  });

  it('shows the error state when no server is selected', async () => {
    currentServerId.set(null);

    const page = await createPage();

    expect(page.status()).toBe('error');
    expect(preferences).not.toHaveBeenCalled();
  });

  it('falls back to the first pane and rewrites the URL when the pane is unknown', async () => {
    const page = await createPage('nope');
    TestBed.tick();

    expect(page.activePaneId()).toBe(QB_SETTINGS_TAB_IDS[0]);
    expect(navigate).toHaveBeenCalledWith(['/pages/qb-settings', 'bandwidth'], {
      replaceUrl: true,
    });
  });

  it('refetches preferences after save so the panes show the saved values', async () => {
    const page = await createPage();
    vi.spyOn(state, 'saveAll').mockResolvedValue(undefined);
    preferences.mockClear();
    preferences.mockResolvedValue({ save_path: '/new' });
    const before = page.paneVersion();

    await page.onSave();

    expect(preferences).toHaveBeenCalledOnce();
    expect(state.preferences()).toEqual({ save_path: '/new' });
    expect(page.paneVersion()).toBe(before + 1);
    expect(toast.success).toHaveBeenCalledWith(
      'pages.qb-settings.success.saved',
      'pages.qb-settings.success.saved-title',
    );
  });

  it('save failure shows the raw error, keeps the page dirty and does not refetch', async () => {
    const page = await createPage();
    vi.spyOn(state, 'saveAll').mockRejectedValue(new Error('rejected by qBittorrent'));
    state.markDirty('storage', true);
    preferences.mockClear();

    await page.onSave();

    expect(toast.danger).toHaveBeenCalledWith(
      'rejected by qBittorrent',
      'pages.qb-settings.error.save-failed-title',
    );
    expect(preferences).not.toHaveBeenCalled();
    expect(state.isDirty()).toBe(true);
  });

  it('back navigates to the torrent list', async () => {
    const page = await createPage();

    page.onBack();

    expect(navigate).toHaveBeenCalledWith(['/pages/torrent-list']);
  });

  it('exposes the base path and state service the leave guard needs', async () => {
    const page = await createPage();

    expect(page.basePath).toBe('/pages/qb-settings');
    expect(page.stateService).toBe(state);
  });
});

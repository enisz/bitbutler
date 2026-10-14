import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, Router, convertToParamMap } from '@angular/router';
import { BehaviorSubject } from 'rxjs';
import { ToastService } from '../../services/toast.service';
import { GeneralSettingsFormService } from './general-settings-form.service';
import { ServerSettingsFormService } from './server-settings-form.service';
import { SettingsPage } from './settings-page';
import { SETTINGS_PAGE_CONFIG } from './settings-page.config';
import { SettingsStateService } from './settings-state.service';
import { SETTINGS_PANE_IDS } from './settings.interface';

describe('SettingsPage', () => {
  let paramMap$: BehaviorSubject<ReturnType<typeof convertToParamMap>>;
  let navigate: ReturnType<typeof vi.fn>;
  let toast: { success: ReturnType<typeof vi.fn>; danger: ReturnType<typeof vi.fn> };
  let state: SettingsStateService;

  const createPage = (pane: string | null): SettingsPage => {
    paramMap$.next(convertToParamMap(pane ? { pane } : {}));
    return TestBed.runInInjectionContext(() => new SettingsPage());
  };

  beforeEach(() => {
    paramMap$ = new BehaviorSubject(convertToParamMap({}));
    navigate = vi.fn().mockResolvedValue(true);
    toast = { success: vi.fn(), danger: vi.fn() };
    state = new SettingsStateService();

    TestBed.configureTestingModule({
      providers: [
        { provide: SettingsStateService, useValue: state },
        { provide: GeneralSettingsFormService, useValue: {} },
        { provide: ServerSettingsFormService, useValue: {} },
        { provide: Router, useValue: { navigate } },
        { provide: ActivatedRoute, useValue: { paramMap: paramMap$.asObservable() } },
        { provide: ToastService, useValue: toast },
      ],
    });
  });

  it('config lists exactly the pane ids of the id union', () => {
    const configured = SETTINGS_PAGE_CONFIG.groups.flatMap((g) => g.panes.map((p) => p.id));
    expect(configured.sort()).toEqual([...SETTINGS_PANE_IDS].sort());
  });

  it('uses the pane from the route', () => {
    const page = createPage('appearance');

    expect(page.activePaneId()).toBe('appearance');
  });

  it('falls back to the first pane and rewrites the URL when the pane is unknown', () => {
    const page = createPage('nope');
    TestBed.tick();

    expect(page.activePaneId()).toBe('general');
    expect(navigate).toHaveBeenCalledWith(['/pages/settings', 'general'], { replaceUrl: true });
  });

  it('does not rewrite the URL when the pane is valid', () => {
    createPage('startup');
    TestBed.tick();

    expect(navigate).not.toHaveBeenCalled();
  });

  it('save persists every dirty form and shows a success toast', async () => {
    const page = createPage('general');
    const saveAll = vi.spyOn(state, 'saveAll').mockResolvedValue(undefined);

    await page.onSave();

    expect(saveAll).toHaveBeenCalledOnce();
    expect(toast.success).toHaveBeenCalledWith(
      'pages.settings.success.saved',
      'pages.settings.success.saved-title',
    );
  });

  it('save shows the raw error in a danger toast and keeps the page dirty on failure', async () => {
    const page = createPage('general');
    vi.spyOn(state, 'saveAll').mockRejectedValue(new Error('disk full'));
    state.markDirty('general', true);

    await page.onSave();

    expect(toast.danger).toHaveBeenCalledWith(
      'disk full',
      'pages.settings.error.save-failed-title',
    );
    expect(state.isDirty()).toBe(true);
  });

  it('back navigates to the torrent list', () => {
    const page = createPage('general');

    page.onBack();

    expect(navigate).toHaveBeenCalledWith(['/pages/torrent-list']);
  });

  it('exposes the base path and state service the leave guard needs', () => {
    const page = createPage('general');

    expect(page.basePath).toBe('/pages/settings');
    expect(page.stateService).toBe(state);
  });
});

import { NO_ERRORS_SCHEMA, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { QbService } from '../../../services/qb.service';
import { ServerStoreService } from '../../../services/server-store.service';
import { QbSettingsStateService } from '../qb-settings-state.service';
import { RssSettings } from './rss';

const MOCK_PREFS: any = {
  rss_processing_enabled: true,
  rss_refresh_interval: 45,
  rss_max_articles_per_feed: 80,
};

describe('RssSettings', () => {
  let component: RssSettings;
  let fixture: ComponentFixture<RssSettings>;
  let stateServiceMock: {
    preferences: ReturnType<typeof signal<any>>;
    registerSave: ReturnType<typeof vi.fn>;
    markDirty: ReturnType<typeof vi.fn>;
  };
  let setPreferences: ReturnType<typeof vi.fn>;

  beforeEach(async () => {
    stateServiceMock = {
      preferences: signal(MOCK_PREFS),
      registerSave: vi.fn(),
      markDirty: vi.fn(),
    };
    setPreferences = vi.fn().mockResolvedValue(undefined);

    await TestBed.configureTestingModule({
      imports: [RssSettings],
      providers: [
        { provide: QbSettingsStateService, useValue: stateServiceMock },
        { provide: QbService, useValue: { app: { setPreferences } } },
        { provide: ServerStoreService, useValue: { currentServerId: signal('server-1') } },
      ],
      schemas: [NO_ERRORS_SCHEMA],
    }).compileComponents();

    fixture = TestBed.createComponent(RssSettings);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('patches the form from the preferences', () => {
    expect(component.form.getRawValue()).toEqual({
      rss_processing_enabled: true,
      rss_refresh_interval: 45,
      rss_max_articles_per_feed: 80,
    });
  });

  it('registers a save function for the rss tab', () => {
    expect(stateServiceMock.registerSave).toHaveBeenCalledWith('rss', expect.any(Function));
  });

  it('marks the tab dirty when a value changes', () => {
    component.form.controls.rss_refresh_interval.setValue(60);
    expect(stateServiceMock.markDirty).toHaveBeenCalledWith('rss', true);
  });

  it('disables the numeric fields while fetching is off', () => {
    component.form.controls.rss_processing_enabled.setValue(false);
    expect(component.form.controls.rss_refresh_interval.disabled).toBe(true);
    expect(component.form.controls.rss_max_articles_per_feed.disabled).toBe(true);

    component.form.controls.rss_processing_enabled.setValue(true);
    expect(component.form.controls.rss_refresh_interval.enabled).toBe(true);
  });

  it('saves all three preferences, including disabled ones', async () => {
    component.form.patchValue({ rss_refresh_interval: 15, rss_max_articles_per_feed: 20 });
    component.form.controls.rss_processing_enabled.setValue(false);

    const save = stateServiceMock.registerSave.mock.calls[0][1] as () => Promise<void>;
    await save();

    expect(setPreferences).toHaveBeenCalledWith('server-1', {
      rss_processing_enabled: false,
      rss_refresh_interval: 15,
      rss_max_articles_per_feed: 20,
    });
  });

  it('clamps the numbers to whole values of at least 1', async () => {
    component.form.patchValue({ rss_refresh_interval: 0, rss_max_articles_per_feed: 2.7 });

    const save = stateServiceMock.registerSave.mock.calls[0][1] as () => Promise<void>;
    await save();

    expect(setPreferences).toHaveBeenCalledWith(
      'server-1',
      expect.objectContaining({ rss_refresh_interval: 1, rss_max_articles_per_feed: 2 }),
    );
  });
});

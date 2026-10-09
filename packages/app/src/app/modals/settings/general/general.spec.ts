import { NO_ERRORS_SCHEMA, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ServerRecord } from '@bitbutler/shared';
import { DEFAULT_GENERAL_SETTINGS } from '../../../models/general-settings.model';
import { DateFormatService } from '../../../services/date-format.service';
import { GeneralSettingsService } from '../../../services/general-settings.service';
import { ServerStoreService } from '../../../services/server-store.service';
import { ToastService } from '../../../services/toast.service';
import { SettingsStateService } from '../settings-state.service';
import { General } from './general';

describe('General', () => {
  let component: General;
  let fixture: ComponentFixture<General>;

  let stateServiceMock: {
    registerSave: ReturnType<typeof vi.fn>;
    markDirty: ReturnType<typeof vi.fn>;
  };
  let serverStoreMock: { servers: ReturnType<typeof signal<ServerRecord[]>> };
  let dateFormatServiceMock: { applyFromSettings: ReturnType<typeof vi.fn> };
  let toastServiceMock: { danger: ReturnType<typeof vi.fn> };

  beforeEach(async () => {
    toastServiceMock = { danger: vi.fn() };
    stateServiceMock = { registerSave: vi.fn(), markDirty: vi.fn() };
    serverStoreMock = { servers: signal([]) };
    dateFormatServiceMock = { applyFromSettings: vi.fn() };

    await TestBed.configureTestingModule({
      imports: [General],
      providers: [
        { provide: SettingsStateService, useValue: stateServiceMock },
        { provide: ServerStoreService, useValue: serverStoreMock },
        { provide: DateFormatService, useValue: dateFormatServiceMock },
        { provide: ToastService, useValue: toastServiceMock },
      ],
      schemas: [NO_ERRORS_SCHEMA],
    }).compileComponents();

    fixture = TestBed.createComponent(General);
    component = fixture.componentInstance;
    fixture.detectChanges();
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  describe('open logs folder', () => {
    it('opens the folder without a toast on success', async () => {
      const open = vi.spyOn(window.bitbutler.log, 'openFolder').mockResolvedValue({ ok: true });

      await component.openLogsFolder();

      expect(open).toHaveBeenCalledTimes(1);
      expect(toastServiceMock.danger).not.toHaveBeenCalled();
    });

    it('shows an error toast with the error string on failure', async () => {
      vi.spyOn(window.bitbutler.log, 'openFolder').mockResolvedValue({
        ok: false,
        error: 'Failed to open path',
      });

      await component.openLogsFolder();

      expect(toastServiceMock.danger).toHaveBeenCalledWith(
        'Failed to open path',
        expect.any(String),
      );
    });

    it('shows an error toast when the call itself rejects', async () => {
      vi.spyOn(window.bitbutler.log, 'openFolder').mockRejectedValue(new Error('ipc down'));

      await component.openLogsFolder();

      expect(toastServiceMock.danger).toHaveBeenCalledWith('ipc down', expect.any(String));
    });
  });

  describe('startup form controls', () => {
    it('openAtLogin control is enabled regardless of whether a default server exists', () => {
      serverStoreMock.servers.set([]);
      fixture.detectChanges();
      expect(component.generalSettingsForm.controls.startup.controls.openAtLogin.enabled).toBe(
        true,
      );
    });

    it('openAtLogin control is enabled when a default server exists', () => {
      serverStoreMock.servers.set([
        {
          id: '1',
          name: 'test',
          auto_login: true,
          host: 'localhost',
          protocol: 'http',
          port: 8080,
          username: '',
          created_at: '',
          has_password: false,
          export_available: null,
          webapi_version: null,
          qb_version: null,
        },
      ]);
      fixture.detectChanges();
      expect(component.generalSettingsForm.controls.startup.controls.openAtLogin.enabled).toBe(
        true,
      );
    });

    it('startMinimized is disabled when openAtLogin is false', () => {
      component.generalSettingsForm.controls.startup.controls.openAtLogin.setValue(false);
      expect(component.generalSettingsForm.controls.startup.controls.startMinimized.disabled).toBe(
        true,
      );
    });

    it('startMinimized is enabled when openAtLogin is true', () => {
      component.generalSettingsForm.controls.startup.controls.openAtLogin.setValue(true);
      expect(component.generalSettingsForm.controls.startup.controls.startMinimized.enabled).toBe(
        true,
      );
    });

    it('startMinimized is enabled when openAtLogin is true even without a default server', () => {
      serverStoreMock.servers.set([]);
      component.generalSettingsForm.controls.startup.controls.openAtLogin.setValue(true);
      expect(component.generalSettingsForm.controls.startup.controls.startMinimized.enabled).toBe(
        true,
      );
    });
  });

  describe('behavior form controls', () => {
    it('deleteTorrentFileOnDuplicate is enabled by default because deleteTorrentFile defaults to true', () => {
      expect(
        component.generalSettingsForm.controls.behavior.controls.deleteTorrentFileOnDuplicate
          .enabled,
      ).toBe(true);
    });

    it('deleteTorrentFileOnDuplicate is disabled and forced to false when deleteTorrentFile is turned off', () => {
      const behaviorGroup = component.generalSettingsForm.controls.behavior;
      behaviorGroup.controls.deleteTorrentFileOnDuplicate.setValue(true);

      behaviorGroup.controls.deleteTorrentFile.setValue(false);

      expect(behaviorGroup.controls.deleteTorrentFileOnDuplicate.value).toBe(false);
      expect(behaviorGroup.controls.deleteTorrentFileOnDuplicate.disabled).toBe(true);
    });

    it('deleteTorrentFileOnDuplicate is re-enabled, staying false, when deleteTorrentFile is turned back on', () => {
      const behaviorGroup = component.generalSettingsForm.controls.behavior;
      behaviorGroup.controls.deleteTorrentFile.setValue(false);

      behaviorGroup.controls.deleteTorrentFile.setValue(true);

      expect(behaviorGroup.controls.deleteTorrentFileOnDuplicate.enabled).toBe(true);
      expect(behaviorGroup.controls.deleteTorrentFileOnDuplicate.value).toBe(false);
    });
  });

  describe('behavior fieldset template', () => {
    it('renders the delete-on-duplicate switch, enabled because deleteTorrentFile defaults to true', () => {
      fixture.detectChanges();

      const input: HTMLInputElement = fixture.nativeElement.querySelector(
        '#delete-torrent-on-duplicate',
      );

      expect(input).not.toBeNull();
      expect(input.disabled).toBe(false);
    });

    it('disables the delete-on-duplicate checkbox in the DOM when deleteTorrentFile is off', () => {
      component.generalSettingsForm.controls.behavior.controls.deleteTorrentFile.setValue(false);
      fixture.detectChanges();

      const input: HTMLInputElement = fixture.nativeElement.querySelector(
        '#delete-torrent-on-duplicate',
      );

      expect(input.disabled).toBe(true);
    });
  });

  describe('hasDefaultServer', () => {
    it('returns false when no server has auto_login', () => {
      serverStoreMock.servers.set([
        {
          id: '1',
          name: 'test',
          auto_login: false,
          host: 'localhost',
          protocol: 'http',
          port: 8080,
          username: '',
          created_at: '',
          has_password: false,
          export_available: null,
          webapi_version: null,
          qb_version: null,
        },
      ]);
      fixture.detectChanges();
      expect(component.hasDefaultServer()).toBe(false);
    });

    it('returns true when at least one server has auto_login', () => {
      serverStoreMock.servers.set([
        {
          id: '1',
          name: 'test',
          auto_login: true,
          host: 'localhost',
          protocol: 'http',
          port: 8080,
          username: '',
          created_at: '',
          has_password: false,
          export_available: null,
          webapi_version: null,
          qb_version: null,
        },
      ]);
      fixture.detectChanges();
      expect(component.hasDefaultServer()).toBe(true);
    });
  });

  describe('showNoDefaultHostHint', () => {
    it('is false when openAtLogin is false and no default server', () => {
      serverStoreMock.servers.set([]);
      component.generalSettingsForm.controls.startup.controls.openAtLogin.setValue(false);
      fixture.detectChanges();
      expect(component.showNoDefaultHostHint()).toBe(false);
    });

    it('is true when openAtLogin is true and no default server', () => {
      serverStoreMock.servers.set([]);
      component.generalSettingsForm.controls.startup.controls.openAtLogin.setValue(true);
      fixture.detectChanges();
      expect(component.showNoDefaultHostHint()).toBe(true);
    });

    it('is false when openAtLogin is true and a default server exists', () => {
      serverStoreMock.servers.set([
        {
          id: '1',
          name: 'test',
          auto_login: true,
          host: 'localhost',
          protocol: 'http',
          port: 8080,
          username: '',
          created_at: '',
          has_password: false,
          export_available: null,
          webapi_version: null,
          qb_version: null,
        },
      ]);
      component.generalSettingsForm.controls.startup.controls.openAtLogin.setValue(true);
      fixture.detectChanges();
      expect(component.showNoDefaultHostHint()).toBe(false);
    });

    it('is false when openAtLogin is false even if no default server exists', () => {
      serverStoreMock.servers.set([]);
      component.generalSettingsForm.controls.startup.controls.openAtLogin.setValue(false);
      fixture.detectChanges();
      expect(component.showNoDefaultHostHint()).toBe(false);
    });
  });

  describe('dateFormatPresets', () => {
    it('includes all 5 presets, each with a translated label and a separate live-formatted example', () => {
      const items = component.dateFormatPresets();
      expect(items.map((i) => i.value)).toEqual(['follow-language', 'iso', 'us', 'eu', 'custom']);

      const iso = items.find((i) => i.value === 'iso')!;
      expect(iso.label).not.toMatch(/\d{4}-\d{2}-\d{2}/);
      expect(iso.example).toMatch(/\d{4}-\d{2}-\d{2} \d{2}:\d{2}/);
    });

    it('keeps the custom example in sync with the currently typed custom pattern', () => {
      component.generalSettingsForm.controls.dateFormat.controls.customPattern.setValue(
        'dd/MM/yyyy',
      );
      const items = component.dateFormatPresets();
      const custom = items.find((i) => i.value === 'custom')!;
      expect(custom.example).toMatch(/^\d{2}\/\d{2}\/\d{4}$/);
    });
  });

  describe('isCustomDateFormat', () => {
    it('is false when preset is iso', () => {
      component.generalSettingsForm.controls.dateFormat.controls.preset.setValue('iso');
      expect(component.isCustomDateFormat()).toBe(false);
    });

    it('is true when preset is custom', () => {
      component.generalSettingsForm.controls.dateFormat.controls.preset.setValue('custom');
      expect(component.isCustomDateFormat()).toBe(true);
    });
  });

  describe('customPatternPreview', () => {
    it('reflects the currently typed custom pattern, including literal text', () => {
      component.generalSettingsForm.controls.dateFormat.controls.preset.setValue('custom');
      component.generalSettingsForm.controls.dateFormat.controls.customPattern.setValue(
        "dd/MM/yyyy 'at' HH:mm",
      );
      expect(component.customPatternPreview()).toMatch(/^\d{2}\/\d{2}\/\d{4} at \d{2}:\d{2}$/);
    });
  });

  describe('resetCustomPattern', () => {
    it('restores the default custom pattern into the form control only', () => {
      const customPatternControl =
        component.generalSettingsForm.controls.dateFormat.controls.customPattern;
      customPatternControl.setValue('dd-MM');

      component.resetCustomPattern();

      expect(customPatternControl.value).toBe('yyyy-MM-dd HH:mm');
    });
  });

  describe('dateFormatTokenGuide', () => {
    it('includes an entry for every supported token, each with a description and a live example', () => {
      const rows = component.dateFormatTokenGuide();

      expect(rows.map((r) => r.token)).toEqual([
        'yyyy',
        'yy',
        'MMMM',
        'MMM',
        'MM',
        'M',
        'EEEE',
        'EEE',
        'dd',
        'd',
        'HH',
        'H',
        'hh',
        'h',
        'mm',
        'ss',
        'a',
      ]);

      const yyyyRow = rows.find((r) => r.token === 'yyyy')!;
      expect(yyyyRow.example).toMatch(/^\d{4}$/);
      expect(yyyyRow.description).not.toBe('');
    });
  });

  describe('date format token guide table', () => {
    it('is hidden when preset is not custom', () => {
      component.generalSettingsForm.controls.dateFormat.controls.preset.setValue('iso');
      fixture.detectChanges();

      expect(fixture.nativeElement.querySelector('#date-format-token-guide')).toBeNull();
    });

    it('shows one row per token when preset is custom', () => {
      component.generalSettingsForm.controls.dateFormat.controls.preset.setValue('custom');
      fixture.detectChanges();

      const rows = fixture.nativeElement.querySelectorAll('#date-format-token-guide tbody tr');
      expect(rows.length).toBe(component.dateFormatTokenGuide().length);
    });
  });

  describe('date format custom pattern reset button', () => {
    it('is rendered next to the custom pattern input when preset is custom', () => {
      component.generalSettingsForm.controls.dateFormat.controls.preset.setValue('custom');
      fixture.detectChanges();

      expect(fixture.nativeElement.querySelector('.bb-filter-clear')).not.toBeNull();
    });

    it('resets the input value when clicked', () => {
      component.generalSettingsForm.controls.dateFormat.controls.preset.setValue('custom');
      component.generalSettingsForm.controls.dateFormat.controls.customPattern.setValue('dd-MM');
      fixture.detectChanges();

      fixture.nativeElement.querySelector('.bb-filter-clear').click();
      fixture.detectChanges();

      expect(component.generalSettingsForm.controls.dateFormat.controls.customPattern.value).toBe(
        'yyyy-MM-dd HH:mm',
      );
    });
  });

  describe('save', () => {
    it('persists dateFormat and applies it via DateFormatService', async () => {
      component.generalSettingsForm.controls.dateFormat.controls.preset.setValue('custom');
      component.generalSettingsForm.controls.dateFormat.controls.customPattern.setValue(
        'dd/MM/yyyy',
      );

      const saveCallback = stateServiceMock.registerSave.mock.calls[0][1];
      await saveCallback();

      expect(dateFormatServiceMock.applyFromSettings).toHaveBeenCalledWith(
        expect.objectContaining({
          dateFormat: { preset: 'custom', customPattern: 'dd/MM/yyyy', firstDayOfWeek: 'auto' },
        }),
      );
    });
  });

  describe('date format fieldset', () => {
    it('hides the custom pattern input when preset is iso', () => {
      component.generalSettingsForm.controls.dateFormat.controls.preset.setValue('iso');
      fixture.detectChanges();

      const input = fixture.nativeElement.querySelector('#date-format-custom-pattern');
      expect(input).toBeNull();
    });

    it('shows the custom pattern input and preview when preset is custom', () => {
      component.generalSettingsForm.controls.dateFormat.controls.preset.setValue('custom');
      fixture.detectChanges();

      const input = fixture.nativeElement.querySelector('#date-format-custom-pattern');
      expect(input).not.toBeNull();
    });
  });

  describe('firstDayOfWeekOptions', () => {
    it('includes auto plus the three explicit weekday choices, each with a translated label', () => {
      const items = component.firstDayOfWeekOptions();
      expect(items.map((i) => i.value)).toEqual(['auto', 'sunday', 'monday', 'saturday']);
      expect(items.every((i) => i.label.length > 0)).toBe(true);
    });
  });

  describe('save with firstDayOfWeek', () => {
    it('persists the selected firstDayOfWeek value', async () => {
      component.generalSettingsForm.controls.dateFormat.controls.firstDayOfWeek.setValue('sunday');

      const saveCallback = stateServiceMock.registerSave.mock.calls[0][1];
      await saveCallback();

      expect(dateFormatServiceMock.applyFromSettings).toHaveBeenCalledWith(
        expect.objectContaining({
          dateFormat: expect.objectContaining({ firstDayOfWeek: 'sunday' }),
        }),
      );
    });
  });

  describe('notification form controls', () => {
    const os = () => component.generalSettingsForm.controls.notifications.controls.os;
    const app = () => component.generalSettingsForm.controls.notifications.controls.app;

    it('enables every OS and app control by default', () => {
      expect(Object.values(os().controls).every((c) => c.enabled)).toBe(true);
      expect(Object.values(app().controls).every((c) => c.enabled)).toBe(true);
    });

    it('disables the OS children but keeps their values when the OS master switch is turned off', () => {
      os().controls.enabled.setValue(false);

      expect(os().controls.onlyWhenMinimized.disabled).toBe(true);
      expect(os().controls.finished.disabled).toBe(true);
      expect(os().controls.errors.disabled).toBe(true);
      expect(os().controls.updates.disabled).toBe(true);
      expect(os().controls.enabled.enabled).toBe(true);
      expect(os().getRawValue().finished).toBe(true);
    });

    it('re-enables the OS children when the OS master switch is turned back on', () => {
      os().controls.enabled.setValue(false);
      os().controls.enabled.setValue(true);

      expect(os().controls.errors.enabled).toBe(true);
    });

    it('disables the app children, including the position, but keeps their values when the app master switch is turned off', () => {
      app().controls.position.setValue('top-left');
      app().controls.enabled.setValue(false);

      expect(app().controls.position.disabled).toBe(true);
      expect(app().controls.confirmations.disabled).toBe(true);
      expect(app().getRawValue().position).toBe('top-left');
      expect(app().getRawValue().confirmations).toBe(true);
    });

    it('does not let the OS master switch affect the app controls', () => {
      os().controls.enabled.setValue(false);
      expect(app().controls.finished.enabled).toBe(true);
    });
  });
});

describe('General - stored notification settings', () => {
  it('restores the disabled state of children when the stored master switch is off', async () => {
    const stored = {
      ...DEFAULT_GENERAL_SETTINGS,
      notifications: {
        os: { ...DEFAULT_GENERAL_SETTINGS.notifications.os, enabled: false },
        app: { ...DEFAULT_GENERAL_SETTINGS.notifications.app, enabled: false },
      },
    };

    await TestBed.configureTestingModule({
      imports: [General],
      providers: [
        { provide: SettingsStateService, useValue: { registerSave: vi.fn(), markDirty: vi.fn() } },
        { provide: ServerStoreService, useValue: { servers: signal([]) } },
        { provide: DateFormatService, useValue: { applyFromSettings: vi.fn() } },
        { provide: GeneralSettingsService, useValue: { load: () => Promise.resolve(stored) } },
        { provide: ToastService, useValue: { danger: vi.fn() } },
      ],
      schemas: [NO_ERRORS_SCHEMA],
    }).compileComponents();

    const fixture = TestBed.createComponent(General);
    fixture.detectChanges();
    await fixture.whenStable();

    const { os, app } =
      fixture.componentInstance.generalSettingsForm.controls.notifications.controls;
    expect(os.controls.finished.disabled).toBe(true);
    expect(os.controls.onlyWhenMinimized.disabled).toBe(true);
    expect(app.controls.position.disabled).toBe(true);
    expect(os.controls.enabled.enabled).toBe(true);
    expect(app.controls.enabled.enabled).toBe(true);
  });
});

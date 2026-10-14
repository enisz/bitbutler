import { TestBed } from '@angular/core/testing';
import { DEFAULT_GENERAL_SETTINGS, GeneralSettings } from '../../models/general-settings.model';
import { DateFormatService } from '../../services/date-format.service';
import { GeneralSettingsService } from '../../services/general-settings.service';
import { ThemeService } from '../../services/theme.service';
import { GeneralSettingsFormService } from './general-settings-form.service';
import { SettingsStateService } from './settings-state.service';

describe('GeneralSettingsFormService', () => {
  let service: GeneralSettingsFormService;
  let stateMock: {
    registerSave: ReturnType<typeof vi.fn>;
    markDirty: ReturnType<typeof vi.fn>;
  };
  let settingsServiceMock: {
    load: ReturnType<typeof vi.fn>;
    save: ReturnType<typeof vi.fn>;
  };
  let dateFormatMock: { applyFromSettings: ReturnType<typeof vi.fn> };
  let themeMock: { applyFromSettings: ReturnType<typeof vi.fn> };
  let persisted: GeneralSettings;

  const configure = () =>
    TestBed.configureTestingModule({
      providers: [
        GeneralSettingsFormService,
        { provide: SettingsStateService, useValue: stateMock },
        { provide: GeneralSettingsService, useValue: settingsServiceMock },
        { provide: DateFormatService, useValue: dateFormatMock },
        { provide: ThemeService, useValue: themeMock },
      ],
    });

  beforeEach(async () => {
    persisted = structuredClone(DEFAULT_GENERAL_SETTINGS);
    stateMock = { registerSave: vi.fn(), markDirty: vi.fn() };
    settingsServiceMock = {
      load: vi.fn().mockImplementation(() => Promise.resolve(structuredClone(persisted))),
      save: vi.fn().mockResolvedValue(undefined),
    };
    dateFormatMock = { applyFromSettings: vi.fn() };
    themeMock = { applyFromSettings: vi.fn() };

    configure();
    service = TestBed.inject(GeneralSettingsFormService);
    await service.load();
  });

  it('registers one save function for the general form', () => {
    expect(stateMock.registerSave).toHaveBeenCalledWith('general', expect.any(Function));
  });

  it('is not loaded before load() resolves and loaded afterwards', async () => {
    TestBed.resetTestingModule();
    configure();
    const fresh = TestBed.inject(GeneralSettingsFormService);
    expect(fresh.loaded()).toBe(false);

    await fresh.load();

    expect(fresh.loaded()).toBe(true);
  });

  it('patches the persisted values into the form without marking it dirty', async () => {
    persisted.appearance.family = 'aurora';
    stateMock.markDirty.mockClear();

    await service.load();

    expect(service.form.getRawValue().appearance.family).toBe('aurora');
    expect(stateMock.markDirty).not.toHaveBeenCalled();
  });

  it('marks the general form dirty when a control changes', () => {
    service.form.controls.language.controls.language.setValue('hu');

    expect(stateMock.markDirty).toHaveBeenCalledWith('general', true);
  });

  describe('paneDirty', () => {
    it('is clean after load', () => {
      expect(Object.values(service.paneDirty()).some(Boolean)).toBe(false);
    });

    it('flags only the pane that owns the edited section', () => {
      service.form.controls.appearance.controls.family.setValue('aurora');

      expect(service.paneDirty()).toEqual({
        general: false,
        appearance: true,
        startup: false,
        notifications: false,
      });
    });

    it('clears the pane when the value is changed back', () => {
      const language = service.form.controls.language.controls.language;
      language.setValue('hu');
      expect(service.paneDirty().general).toBe(true);

      language.setValue(persisted.language.language);

      expect(service.paneDirty().general).toBe(false);
    });

    it('clears after save and after discard', async () => {
      service.form.controls.startup.controls.openAtLogin.setValue(true);
      await service.save();
      expect(service.paneDirty().startup).toBe(false);

      service.form.controls.notifications.controls.os.controls.errors.setValue(false);
      expect(service.paneDirty().notifications).toBe(true);
      await service.discard();
      expect(service.paneDirty().notifications).toBe(false);
    });
  });

  it('clears the general dirty flag when a change is reverted by hand', () => {
    const language = service.form.controls.language.controls.language;
    language.setValue('hu');
    language.setValue(persisted.language.language);

    expect(stateMock.markDirty).toHaveBeenLastCalledWith('general', false);
  });

  it('keeps startMinimized disabled until openAtLogin is on', () => {
    const { openAtLogin, startMinimized } = service.form.controls.startup.controls;

    expect(startMinimized.disabled).toBe(true);
    openAtLogin.setValue(true);
    expect(startMinimized.enabled).toBe(true);
    openAtLogin.setValue(false);
    expect(startMinimized.disabled).toBe(true);
    expect(startMinimized.value).toBe(false);
  });

  it('save writes the whole settings object once and applies theme and date format', async () => {
    service.form.controls.dateFormat.controls.preset.setValue('custom');
    service.form.controls.dateFormat.controls.customPattern.setValue('dd/MM/yyyy');

    await service.save();

    expect(settingsServiceMock.save).toHaveBeenCalledOnce();
    expect(settingsServiceMock.save).toHaveBeenCalledWith(
      expect.objectContaining({
        dateFormat: { preset: 'custom', customPattern: 'dd/MM/yyyy', firstDayOfWeek: 'auto' },
      }),
    );
    expect(dateFormatMock.applyFromSettings).toHaveBeenCalledWith(
      expect.objectContaining({
        dateFormat: { preset: 'custom', customPattern: 'dd/MM/yyyy', firstDayOfWeek: 'auto' },
      }),
    );
    expect(themeMock.applyFromSettings).toHaveBeenCalledWith(
      persisted.appearance.family,
      persisted.appearance.mode,
    );
  });

  it('save forces startMinimized off when openAtLogin is off', async () => {
    service.form.controls.startup.controls.openAtLogin.setValue(false);

    await service.save();

    expect(settingsServiceMock.save).toHaveBeenCalledWith(
      expect.objectContaining({
        startup: expect.objectContaining({ openAtLogin: false, startMinimized: false }),
      }),
    );
  });

  it('discard restores the persisted values and clears the dirty flag', async () => {
    service.form.controls.language.controls.language.setValue('hu');
    stateMock.markDirty.mockClear();

    await service.discard();

    expect(service.form.controls.language.controls.language.value).toBe(
      persisted.language.language,
    );
    expect(stateMock.markDirty).toHaveBeenLastCalledWith('general', false);
  });

  it('discard re-applies the master-switch state of the persisted notification groups', async () => {
    persisted.notifications.os.enabled = false;

    await service.discard();

    expect(service.form.controls.notifications.controls.os.controls.finished.disabled).toBe(true);
  });

  describe('startup form controls', () => {
    it('startMinimized is disabled when openAtLogin is false', () => {
      service.form.controls.startup.controls.openAtLogin.setValue(false);
      expect(service.form.controls.startup.controls.startMinimized.disabled).toBe(true);
    });

    it('startMinimized is enabled when openAtLogin is true', () => {
      service.form.controls.startup.controls.openAtLogin.setValue(true);
      expect(service.form.controls.startup.controls.startMinimized.enabled).toBe(true);
    });
  });

  describe('behavior form controls', () => {
    it('deleteTorrentFileOnDuplicate is enabled by default because deleteTorrentFile defaults to true', () => {
      expect(service.form.controls.behavior.controls.deleteTorrentFileOnDuplicate.enabled).toBe(
        true,
      );
    });

    it('deleteTorrentFileOnDuplicate is disabled and forced to false when deleteTorrentFile is turned off', () => {
      const behaviorGroup = service.form.controls.behavior;
      behaviorGroup.controls.deleteTorrentFileOnDuplicate.setValue(true);

      behaviorGroup.controls.deleteTorrentFile.setValue(false);

      expect(behaviorGroup.controls.deleteTorrentFileOnDuplicate.value).toBe(false);
      expect(behaviorGroup.controls.deleteTorrentFileOnDuplicate.disabled).toBe(true);
    });

    it('deleteTorrentFileOnDuplicate is re-enabled, staying false, when deleteTorrentFile is turned back on', () => {
      const behaviorGroup = service.form.controls.behavior;
      behaviorGroup.controls.deleteTorrentFile.setValue(false);

      behaviorGroup.controls.deleteTorrentFile.setValue(true);

      expect(behaviorGroup.controls.deleteTorrentFileOnDuplicate.enabled).toBe(true);
      expect(behaviorGroup.controls.deleteTorrentFileOnDuplicate.value).toBe(false);
    });
  });

  describe('notification form controls', () => {
    const os = () => service.form.controls.notifications.controls.os;
    const app = () => service.form.controls.notifications.controls.app;

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

  describe('save with firstDayOfWeek', () => {
    it('persists the selected firstDayOfWeek value', async () => {
      service.form.controls.dateFormat.controls.firstDayOfWeek.setValue('sunday');

      await service.save();

      expect(dateFormatMock.applyFromSettings).toHaveBeenCalledWith(
        expect.objectContaining({
          dateFormat: expect.objectContaining({ firstDayOfWeek: 'sunday' }),
        }),
      );
    });
  });
});

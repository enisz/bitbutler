import { NO_ERRORS_SCHEMA, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { QbService } from '../../../services/qb.service';
import { ServerStoreService } from '../../../services/server-store.service';
import { QbSettingsStateService } from '../qb-settings-state.service';
import { Storage } from './storage';

const MOCK_PREFS: any = {
  save_path: '/mnt/storage',
  temp_path_enabled: true,
  temp_path: '/mnt/tmp',
  incomplete_files_ext: true,
  torrent_content_layout: 'Subfolder',
  auto_tmm_enabled: false,
  torrent_changed_tmm_enabled: true,
  category_changed_tmm_enabled: false,
  save_path_changed_tmm_enabled: true,
};

describe('Storage', () => {
  let component: Storage;
  let fixture: ComponentFixture<Storage>;
  let qbServiceMock: { setAppPreferences: ReturnType<typeof vi.fn> };
  let stateServiceMock: {
    preferences: ReturnType<typeof signal<any>>;
    registerSave: ReturnType<typeof vi.fn>;
    markDirty: ReturnType<typeof vi.fn>;
  };

  beforeEach(async () => {
    stateServiceMock = {
      preferences: signal(MOCK_PREFS),
      registerSave: vi.fn(),
      markDirty: vi.fn(),
    };

    qbServiceMock = { setAppPreferences: vi.fn().mockResolvedValue(undefined) };

    await TestBed.configureTestingModule({
      imports: [Storage],
      providers: [
        { provide: QbSettingsStateService, useValue: stateServiceMock },
        { provide: QbService, useValue: qbServiceMock },
        { provide: ServerStoreService, useValue: { currentServerId: signal('server-1') } },
      ],
      schemas: [NO_ERRORS_SCHEMA],
    }).compileComponents();

    fixture = TestBed.createComponent(Storage);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should register a save function on init', () => {
    expect(stateServiceMock.registerSave).toHaveBeenCalledWith('storage', expect.any(Function));
  });

  it('should patch form from preferences on init', () => {
    const v = component.form.getRawValue();
    expect(v.save_path).toBe('/mnt/storage');
    expect(v.temp_path_enabled).toBe(true);
    expect(v.temp_path).toBe('/mnt/tmp');
    expect(v.incomplete_files_ext).toBe(true);
    expect(v.torrent_content_layout).toBe('Subfolder');
  });

  it('should patch the TMM form controls from preferences on init', () => {
    const v = component.form.getRawValue();
    expect(v.auto_tmm_enabled).toBe(false);
    expect(v.torrent_changed_tmm_enabled).toBe(true);
    expect(v.category_changed_tmm_enabled).toBe(false);
    expect(v.save_path_changed_tmm_enabled).toBe(true);
  });

  it('should include the TMM preferences when saving', async () => {
    component.form.controls.auto_tmm_enabled.setValue(true);
    await (component as any).save();
    expect(qbServiceMock.setAppPreferences).toHaveBeenCalledWith(
      'server-1',
      expect.objectContaining({
        auto_tmm_enabled: true,
        torrent_changed_tmm_enabled: true,
        category_changed_tmm_enabled: false,
        save_path_changed_tmm_enabled: true,
      }),
    );
  });

  it('should mark dirty when form value changes', () => {
    component.form.controls.save_path.setValue('/new/path');
    expect(stateServiceMock.markDirty).toHaveBeenCalledWith('storage', true);
  });

  it('should disable temp_path when temp_path_enabled is false', () => {
    component.form.controls.temp_path_enabled.setValue(false);
    expect(component.form.controls.temp_path.disabled).toBe(true);
  });

  it('should enable temp_path when temp_path_enabled is true', () => {
    component.form.controls.temp_path_enabled.setValue(false);
    component.form.controls.temp_path_enabled.setValue(true);
    expect(component.form.controls.temp_path.enabled).toBe(true);
  });

  it('should expose hasTempPath as true when temp_path_enabled is in prefs', () => {
    expect(component.hasTempPath()).toBe(true);
  });

  it('should expose hasContentLayout as true when torrent_content_layout is in prefs', () => {
    expect(component.hasContentLayout()).toBe(true);
  });

  it('should expose hasContentLayout as false when torrent_content_layout is not in prefs', () => {
    stateServiceMock.preferences.set({ save_path: '/tmp' });
    expect(component.hasContentLayout()).toBe(false);
  });
});

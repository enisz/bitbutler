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
};

describe('Storage', () => {
  let component: Storage;
  let fixture: ComponentFixture<Storage>;
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

    await TestBed.configureTestingModule({
      imports: [Storage],
      providers: [
        { provide: QbSettingsStateService, useValue: stateServiceMock },
        {
          provide: QbService,
          useValue: { setAppPreferences: vi.fn().mockResolvedValue(undefined) },
        },
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

import { NO_ERRORS_SCHEMA, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { QbService } from '../../../services/qb.service';
import { ServerStoreService } from '../../../services/server-store.service';
import { QbSettingsStateService } from '../qb-settings-state.service';
import { Bandwidth } from './bandwidth';

const MOCK_PREFS: any = {
  dl_limit: 5120000,
  up_limit: 1024000,
  alt_dl_limit: 102400,
  alt_up_limit: 51200,
  scheduler_enabled: true,
  schedule_from_hour: 8,
  schedule_from_min: 0,
  schedule_to_hour: 20,
  schedule_to_min: 30,
  scheduler_days: 1,
};

describe('Bandwidth', () => {
  let component: Bandwidth;
  let fixture: ComponentFixture<Bandwidth>;
  let stateServiceMock: {
    preferences: ReturnType<typeof signal<any>>;
    registerSave: ReturnType<typeof vi.fn>;
    markDirty: ReturnType<typeof vi.fn>;
  };
  let qbMock: { app: { setPreferences: ReturnType<typeof vi.fn> } };
  let serverStoreMock: { currentServerId: ReturnType<typeof signal<string>> };

  beforeEach(async () => {
    stateServiceMock = {
      preferences: signal(MOCK_PREFS),
      registerSave: vi.fn(),
      markDirty: vi.fn(),
    };
    qbMock = { app: { setPreferences: vi.fn().mockResolvedValue(undefined) } };
    serverStoreMock = { currentServerId: signal('server-1') };

    await TestBed.configureTestingModule({
      imports: [Bandwidth],
      providers: [
        { provide: QbSettingsStateService, useValue: stateServiceMock },
        { provide: QbService, useValue: qbMock },
        { provide: ServerStoreService, useValue: serverStoreMock },
      ],
      schemas: [NO_ERRORS_SCHEMA],
    }).compileComponents();

    fixture = TestBed.createComponent(Bandwidth);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should register a save function on init', () => {
    expect(stateServiceMock.registerSave).toHaveBeenCalledWith('bandwidth', expect.any(Function));
  });

  it('should patch form from preferences on init (converting bytes to KiB/s)', () => {
    expect(component.form.getRawValue().limits).toEqual({ downloadLimit: 5000, uploadLimit: 1000 });
    expect(component.form.getRawValue().altLimits).toEqual({ downloadLimit: 100, uploadLimit: 50 });
  });

  it('should load a 0 limit as no limit and save it back as 0', async () => {
    stateServiceMock.registerSave.mockClear();
    stateServiceMock.preferences.set({ ...MOCK_PREFS, up_limit: 0 });
    const freshFixture = TestBed.createComponent(Bandwidth);
    freshFixture.detectChanges();
    const fresh = freshFixture.componentInstance;

    expect(fresh.form.getRawValue().limits.uploadLimit).toBeNull();

    const save = stateServiceMock.registerSave.mock.calls[0][1] as () => Promise<void>;
    await save();

    expect(qbMock.app.setPreferences).toHaveBeenCalledWith(
      'server-1',
      expect.objectContaining({ dl_limit: 5000 * 1024, up_limit: 0 }),
    );
  });

  it('should patch scheduler fields from preferences', () => {
    const v = component.form.getRawValue();
    expect(v.scheduler_enabled).toBe(true);
    expect(v.schedule_from_hour).toBe(8);
    expect(v.schedule_from_min).toBe(0);
    expect(v.schedule_to_hour).toBe(20);
    expect(v.schedule_to_min).toBe(30);
    expect(v.scheduler_days).toBe(1);
  });

  it('should mark dirty when form value changes', () => {
    component.form.controls.limits.setValue({ downloadLimit: 9999, uploadLimit: null });
    expect(stateServiceMock.markDirty).toHaveBeenCalledWith('bandwidth', true);
  });

  it('should expose hasScheduler as true when scheduler_enabled is in prefs', () => {
    expect(component.hasScheduler()).toBe(true);
  });

  it('should expose hasScheduler as false when scheduler_enabled is not in prefs', () => {
    stateServiceMock.preferences.set({ dl_limit: 0 });
    expect(component.hasScheduler()).toBe(false);
  });

  it('should disable scheduler sub-fields when scheduler_enabled is false', () => {
    component.form.controls.scheduler_enabled.setValue(false);
    expect(component.form.controls.schedule_from_hour.disabled).toBe(true);
    expect(component.form.controls.schedule_to_hour.disabled).toBe(true);
    expect(component.form.controls.scheduler_days.disabled).toBe(true);
  });
});

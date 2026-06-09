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
  let qbMock: { setAppPreferences: ReturnType<typeof vi.fn> };
  let serverStoreMock: { currentServerId: ReturnType<typeof signal<string>> };

  beforeEach(async () => {
    stateServiceMock = {
      preferences: signal(MOCK_PREFS),
      registerSave: vi.fn(),
      markDirty: vi.fn(),
    };
    qbMock = { setAppPreferences: vi.fn().mockResolvedValue(undefined) };
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

  it('should patch form from preferences on init (converting bytes to KB/s)', () => {
    expect(component.form.getRawValue().dl_limit).toBe(5000);
    expect(component.form.getRawValue().up_limit).toBe(1000);
    expect(component.form.getRawValue().alt_dl_limit).toBe(100);
    expect(component.form.getRawValue().alt_up_limit).toBe(50);
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
    component.form.controls.dl_limit.setValue(9999);
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

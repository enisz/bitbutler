import { NO_ERRORS_SCHEMA, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { QbService } from '../../../services/qb.service';
import { ServerStoreService } from '../../../services/server-store.service';
import { QbSettingsStateService } from '../qb-settings-state.service';
import { SeedingRatios } from './seeding-ratios';

const MOCK_PREFS: any = {
  max_ratio_enabled: true,
  max_ratio: 2.0,
  max_ratio_act: 0,
  max_seeding_time_enabled: true,
  max_seeding_time: 1440,
};

describe('SeedingRatios', () => {
  let component: SeedingRatios;
  let fixture: ComponentFixture<SeedingRatios>;
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
      imports: [SeedingRatios],
      providers: [
        { provide: QbSettingsStateService, useValue: stateServiceMock },
        {
          provide: QbService,
          useValue: { app: { setPreferences: vi.fn().mockResolvedValue(undefined) } },
        },
        { provide: ServerStoreService, useValue: { currentServerId: signal('server-1') } },
      ],
      schemas: [NO_ERRORS_SCHEMA],
    }).compileComponents();

    fixture = TestBed.createComponent(SeedingRatios);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should register a save function on init', () => {
    expect(stateServiceMock.registerSave).toHaveBeenCalledWith(
      'seeding-ratios',
      expect.any(Function),
    );
  });

  it('should patch form from preferences on init', () => {
    const v = component.form.getRawValue();
    expect(v.max_ratio_enabled).toBe(true);
    expect(v.max_ratio).toBe(2.0);
    expect(v.max_ratio_act).toBe(0);
    expect(v.max_seeding_time_enabled).toBe(true);
    expect(v.max_seeding_time).toBe(1440);
  });

  it('should mark dirty when form value changes', () => {
    component.form.controls.max_ratio.setValue(3.5);
    expect(stateServiceMock.markDirty).toHaveBeenCalledWith('seeding-ratios', true);
  });

  it('should disable max_ratio and max_ratio_act when max_ratio_enabled is false', () => {
    component.form.controls.max_ratio_enabled.setValue(false);
    expect(component.form.controls.max_ratio.disabled).toBe(true);
    expect(component.form.controls.max_ratio_act.disabled).toBe(true);
  });

  it('should disable max_seeding_time when max_seeding_time_enabled is false', () => {
    component.form.controls.max_seeding_time_enabled.setValue(false);
    expect(component.form.controls.max_seeding_time.disabled).toBe(true);
  });
});

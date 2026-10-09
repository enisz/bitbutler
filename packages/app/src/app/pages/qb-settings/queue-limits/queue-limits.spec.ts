import { NO_ERRORS_SCHEMA, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { QbService } from '../../../services/qb.service';
import { ServerStoreService } from '../../../services/server-store.service';
import { QbSettingsStateService } from '../qb-settings-state.service';
import { QueueLimits } from './queue-limits';

const MOCK_PREFS: any = {
  queueing_enabled: true,
  max_active_downloads: 5,
  max_active_uploads: 10,
  max_active_torrents: 20,
  add_to_top_of_queue: false,
};

describe('QueueLimits', () => {
  let component: QueueLimits;
  let fixture: ComponentFixture<QueueLimits>;
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
      imports: [QueueLimits],
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

    fixture = TestBed.createComponent(QueueLimits);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should register a save function on init', () => {
    expect(stateServiceMock.registerSave).toHaveBeenCalledWith(
      'queue-limits',
      expect.any(Function),
    );
  });

  it('should patch form from preferences on init', () => {
    const v = component.form.getRawValue();
    expect(v.queueing_enabled).toBe(true);
    expect(v.max_active_downloads).toBe(5);
    expect(v.max_active_uploads).toBe(10);
    expect(v.max_active_torrents).toBe(20);
    expect(v.add_to_top_of_queue).toBe(false);
  });

  it('should mark dirty when form value changes', () => {
    component.form.controls.max_active_downloads.setValue(3);
    expect(stateServiceMock.markDirty).toHaveBeenCalledWith('queue-limits', true);
  });

  it('should disable active-count fields when queueing_enabled is false', () => {
    component.form.controls.queueing_enabled.setValue(false);
    expect(component.form.controls.max_active_downloads.disabled).toBe(true);
    expect(component.form.controls.max_active_uploads.disabled).toBe(true);
    expect(component.form.controls.max_active_torrents.disabled).toBe(true);
  });

  it('should expose hasAddToTop as true when add_to_top_of_queue is in prefs', () => {
    expect(component.hasAddToTop()).toBe(true);
  });

  it('should expose hasAddToTop as false when add_to_top_of_queue is not in prefs', () => {
    stateServiceMock.preferences.set({ queueing_enabled: false });
    expect(component.hasAddToTop()).toBe(false);
  });
});

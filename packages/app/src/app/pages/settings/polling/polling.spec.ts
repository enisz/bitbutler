import { NO_ERRORS_SCHEMA, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { QbService } from '../../../services/qb.service';
import { ServerSettingsService } from '../../../services/server-settings.service';
import { ServerStoreService } from '../../../services/server-store.service';
import { ServerSettingsFormService } from '../server-settings-form.service';
import { SettingsStateService } from '../settings-state.service';
import { Polling } from './polling';

describe('Polling', () => {
  let fixture: ComponentFixture<Polling>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Polling],
      providers: [
        ServerSettingsFormService,
        { provide: SettingsStateService, useValue: { registerSave: vi.fn(), markDirty: vi.fn() } },
        { provide: ServerStoreService, useValue: { currentServerId: signal(null) } },
        {
          provide: ServerSettingsService,
          useValue: {
            reload: vi.fn().mockResolvedValue({
              pathMappings: [],
              polling: { foreground: 2000, background: 5000 },
            }),
            save: vi.fn().mockResolvedValue(undefined),
          },
        },
        {
          provide: QbService,
          useValue: { app: { preferences: vi.fn().mockResolvedValue({ save_path: '/data' }) } },
        },
      ],
      schemas: [NO_ERRORS_SCHEMA],
    }).compileComponents();

    fixture = TestBed.createComponent(Polling);
    fixture.detectChanges();
    await fixture.whenStable();
    await new Promise((resolve) => setTimeout(resolve));
    fixture.detectChanges();
  });

  it('renders the polling card once the settings are loaded', () => {
    expect(fixture.componentInstance).toBeTruthy();
    expect(fixture.nativeElement.querySelectorAll('fieldset.bb-fieldset')).toHaveLength(1);
  });
});

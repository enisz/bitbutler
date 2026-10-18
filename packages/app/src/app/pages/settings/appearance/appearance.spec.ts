import { NO_ERRORS_SCHEMA } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { DateFormatService } from '../../../services/date-format.service';
import { GeneralSettingsFormService } from '../general-settings-form.service';
import { SettingsStateService } from '../settings-state.service';
import { Appearance } from './appearance';

describe('Appearance', () => {
  let fixture: ComponentFixture<Appearance>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Appearance],
      providers: [
        GeneralSettingsFormService,
        { provide: SettingsStateService, useValue: { registerSave: vi.fn(), markDirty: vi.fn() } },
        { provide: DateFormatService, useValue: { applyFromSettings: vi.fn() } },
      ],
      schemas: [NO_ERRORS_SCHEMA],
    }).compileComponents();

    fixture = TestBed.createComponent(Appearance);
    fixture.detectChanges();
    await fixture.whenStable();
    await new Promise((resolve) => setTimeout(resolve));
    fixture.detectChanges();
  });

  it('creates and renders the appearance card once the settings are loaded', () => {
    expect(fixture.componentInstance).toBeTruthy();
    expect(fixture.nativeElement.querySelectorAll('app-bb-section-card')).toHaveLength(1);
  });

  it('offers light, dark and system modes', () => {
    expect(fixture.componentInstance.modes().map((mode) => mode.value)).toEqual([
      'light',
      'dark',
      'system',
    ]);
  });
});

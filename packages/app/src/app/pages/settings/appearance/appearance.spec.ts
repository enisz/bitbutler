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
        {
          provide: SettingsStateService,
          useValue: { registerSave: vi.fn(), registerPaneActions: vi.fn(), markDirty: vi.fn() },
        },
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
    expect(fixture.nativeElement.querySelectorAll('app-bb-section-card')).toHaveLength(2);
  });

  it('offers light, dark and system modes', () => {
    expect(fixture.componentInstance.modes().map((mode) => mode.value)).toEqual([
      'light',
      'dark',
      'system',
    ]);
  });

  describe('theme preview', () => {
    const preview = (): HTMLElement => fixture.nativeElement.querySelector('.bb-theme-preview');
    const appearanceControls = () =>
      TestBed.inject(GeneralSettingsFormService).form.controls.appearance.controls;

    it('is hidden from assistive technology and keeps its controls out of the tab order', () => {
      expect(preview().getAttribute('aria-hidden')).toBe('true');
      const controls = Array.from(preview().querySelectorAll('button, input')).filter(
        (control) => !control.closest('[inert]'),
      );
      expect(controls.length).toBeGreaterThan(0);
      controls.forEach((control) => expect(control.getAttribute('tabindex')).toBe('-1'));
    });

    it('renders the selected theme family and mode before they are saved', () => {
      const { family, mode } = appearanceControls();
      family.setValue('graphite');
      mode.setValue('dark');
      fixture.detectChanges();

      expect(preview().getAttribute('data-bb-theme')).toBe('graphite');
      expect(preview().getAttribute('data-bs-theme')).toBe('dark');

      family.setValue('meadow');
      mode.setValue('light');
      fixture.detectChanges();

      expect(preview().getAttribute('data-bb-theme')).toBe('meadow');
      expect(preview().getAttribute('data-bs-theme')).toBe('light');
    });

    it('resolves the system mode to light or dark', () => {
      appearanceControls().mode.setValue('system');
      fixture.detectChanges();

      expect(['light', 'dark']).toContain(preview().getAttribute('data-bs-theme'));
    });
  });
});

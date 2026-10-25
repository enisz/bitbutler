import { NO_ERRORS_SCHEMA, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ServerRecord } from '@bitbutler/shared';
import { DateFormatService } from '../../../services/date-format.service';
import { ServerStoreService } from '../../../services/server-store.service';
import { GeneralSettingsFormService } from '../general-settings-form.service';
import { SettingsStateService } from '../settings-state.service';
import { General } from './general';

describe('General', () => {
  let component: General;
  let fixture: ComponentFixture<General>;

  let stateServiceMock: {
    registerSave: ReturnType<typeof vi.fn>;
    markDirty: ReturnType<typeof vi.fn>;
  };
  let serverStoreMock: { servers: ReturnType<typeof signal<ServerRecord[]>> };
  let dateFormatServiceMock: { applyFromSettings: ReturnType<typeof vi.fn> };

  beforeEach(async () => {
    stateServiceMock = { registerSave: vi.fn(), markDirty: vi.fn() };
    serverStoreMock = { servers: signal([]) };
    dateFormatServiceMock = { applyFromSettings: vi.fn() };

    await TestBed.configureTestingModule({
      imports: [General],
      providers: [
        GeneralSettingsFormService,
        { provide: SettingsStateService, useValue: stateServiceMock },
        { provide: ServerStoreService, useValue: serverStoreMock },
        { provide: DateFormatService, useValue: dateFormatServiceMock },
      ],
      schemas: [NO_ERRORS_SCHEMA],
    }).compileComponents();

    fixture = TestBed.createComponent(General);
    component = fixture.componentInstance;
    fixture.detectChanges();
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  describe('behavior card template', () => {
    it('renders the delete-on-duplicate switch, enabled because deleteTorrentFile defaults to true', () => {
      fixture.detectChanges();

      const input: HTMLInputElement = fixture.nativeElement.querySelector(
        '#delete-torrent-on-duplicate',
      );

      expect(input).not.toBeNull();
      expect(input.disabled).toBe(false);
    });

    it('disables the delete-on-duplicate checkbox in the DOM when deleteTorrentFile is off', () => {
      component.generalSettingsForm.controls.behavior.controls.deleteTorrentFile.setValue(false);
      fixture.detectChanges();

      const input: HTMLInputElement = fixture.nativeElement.querySelector(
        '#delete-torrent-on-duplicate',
      );

      expect(input.disabled).toBe(true);
    });
  });

  describe('dateFormatPresets', () => {
    it('includes all 5 presets, each with a translated label and a separate live-formatted example', () => {
      const items = component.dateFormatPresets();
      expect(items.map((i) => i.value)).toEqual(['follow-language', 'iso', 'us', 'eu', 'custom']);

      const iso = items.find((i) => i.value === 'iso')!;
      expect(iso.label).not.toMatch(/\d{4}-\d{2}-\d{2}/);
      expect(iso.example).toMatch(/\d{4}-\d{2}-\d{2} \d{2}:\d{2}/);
    });

    it('keeps the custom example in sync with the currently typed custom pattern', () => {
      component.generalSettingsForm.controls.dateFormat.controls.customPattern.setValue(
        'dd/MM/yyyy',
      );
      const items = component.dateFormatPresets();
      const custom = items.find((i) => i.value === 'custom')!;
      expect(custom.example).toMatch(/^\d{2}\/\d{2}\/\d{4}$/);
    });
  });

  describe('isCustomDateFormat', () => {
    it('is false when preset is iso', () => {
      component.generalSettingsForm.controls.dateFormat.controls.preset.setValue('iso');
      expect(component.isCustomDateFormat()).toBe(false);
    });

    it('is true when preset is custom', () => {
      component.generalSettingsForm.controls.dateFormat.controls.preset.setValue('custom');
      expect(component.isCustomDateFormat()).toBe(true);
    });
  });

  describe('customPatternPreview', () => {
    it('reflects the currently typed custom pattern, including literal text', () => {
      component.generalSettingsForm.controls.dateFormat.controls.preset.setValue('custom');
      component.generalSettingsForm.controls.dateFormat.controls.customPattern.setValue(
        "dd/MM/yyyy 'at' HH:mm",
      );
      expect(component.customPatternPreview()).toMatch(/^\d{2}\/\d{2}\/\d{4} at \d{2}:\d{2}$/);
    });
  });

  describe('resetCustomPattern', () => {
    it('restores the default custom pattern into the form control only', () => {
      const customPatternControl =
        component.generalSettingsForm.controls.dateFormat.controls.customPattern;
      customPatternControl.setValue('dd-MM');

      component.resetCustomPattern();

      expect(customPatternControl.value).toBe('yyyy-MM-dd HH:mm');
    });
  });

  describe('dateFormatTokenGuide', () => {
    it('includes an entry for every supported token, each with a description and a live example', () => {
      const rows = component.dateFormatTokenGuide();

      expect(rows.map((r) => r.token)).toEqual([
        'yyyy',
        'yy',
        'MMMM',
        'MMM',
        'MM',
        'M',
        'EEEE',
        'EEE',
        'dd',
        'd',
        'HH',
        'H',
        'hh',
        'h',
        'mm',
        'ss',
        'a',
      ]);

      const yyyyRow = rows.find((r) => r.token === 'yyyy')!;
      expect(yyyyRow.example).toMatch(/^\d{4}$/);
      expect(yyyyRow.description).not.toBe('');
    });
  });

  describe('date format token guide table', () => {
    it('is hidden when preset is not custom', () => {
      component.generalSettingsForm.controls.dateFormat.controls.preset.setValue('iso');
      fixture.detectChanges();

      expect(fixture.nativeElement.querySelector('#date-format-token-guide')).toBeNull();
    });

    it('shows one row per token when preset is custom', () => {
      component.generalSettingsForm.controls.dateFormat.controls.preset.setValue('custom');
      fixture.detectChanges();

      const rows = fixture.nativeElement.querySelectorAll('#date-format-token-guide tbody tr');
      expect(rows.length).toBe(component.dateFormatTokenGuide().length);
    });
  });

  describe('date format custom pattern reset button', () => {
    it('is rendered next to the custom pattern input when preset is custom', () => {
      component.generalSettingsForm.controls.dateFormat.controls.preset.setValue('custom');
      fixture.detectChanges();

      expect(fixture.nativeElement.querySelector('.bb-filter-clear')).not.toBeNull();
    });

    it('resets the input value when clicked', () => {
      component.generalSettingsForm.controls.dateFormat.controls.preset.setValue('custom');
      component.generalSettingsForm.controls.dateFormat.controls.customPattern.setValue('dd-MM');
      fixture.detectChanges();

      fixture.nativeElement.querySelector('.bb-filter-clear').click();
      fixture.detectChanges();

      expect(component.generalSettingsForm.controls.dateFormat.controls.customPattern.value).toBe(
        'yyyy-MM-dd HH:mm',
      );
    });
  });

  describe('date format card', () => {
    it('hides the custom pattern input when preset is iso', () => {
      component.generalSettingsForm.controls.dateFormat.controls.preset.setValue('iso');
      fixture.detectChanges();

      const input = fixture.nativeElement.querySelector('#date-format-custom-pattern');
      expect(input).toBeNull();
    });

    it('shows the custom pattern input and preview when preset is custom', () => {
      component.generalSettingsForm.controls.dateFormat.controls.preset.setValue('custom');
      fixture.detectChanges();

      const input = fixture.nativeElement.querySelector('#date-format-custom-pattern');
      expect(input).not.toBeNull();
    });
  });

  describe('firstDayOfWeekOptions', () => {
    it('includes auto plus the three explicit weekday choices, each with a translated label', () => {
      const items = component.firstDayOfWeekOptions();
      expect(items.map((i) => i.value)).toEqual(['auto', 'sunday', 'monday', 'saturday']);
      expect(items.every((i) => i.label.length > 0)).toBe(true);
    });
  });
});

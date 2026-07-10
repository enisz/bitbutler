import { registerLocaleData } from '@angular/common';
import localeHu from '@angular/common/locales/hu';
import { TestBed } from '@angular/core/testing';
import {
  DEFAULT_GENERAL_SETTINGS,
  GeneralSettings,
  LANGUAGE_LOCALE_MAP,
} from '../models/general-settings.model';
import { DateFormatService } from './date-format.service';
import { GeneralSettingsService } from './general-settings.service';

registerLocaleData(localeHu);

describe('DateFormatService', () => {
  let service: DateFormatService;
  let generalSettingsServiceMock: { load: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    generalSettingsServiceMock = {
      load: vi.fn().mockResolvedValue(DEFAULT_GENERAL_SETTINGS),
    };

    TestBed.configureTestingModule({
      providers: [
        DateFormatService,
        { provide: GeneralSettingsService, useValue: generalSettingsServiceMock },
      ],
    });

    service = TestBed.inject(DateFormatService);
  });

  it('formats using the default ISO pattern before init() resolves', () => {
    const ts = 1700000000;
    expect(service.format(ts)).toMatch(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}$/);
  });

  it('returns "" for falsy, zero, negative, and non-numeric input', () => {
    expect(service.format(0)).toBe('');
    expect(service.format(undefined)).toBe('');
    expect(service.format(-1)).toBe('');
    expect(service.format('banana')).toBe('');
  });

  it('applies the us preset pattern after init()', async () => {
    generalSettingsServiceMock.load.mockResolvedValue({
      ...DEFAULT_GENERAL_SETTINGS,
      dateFormat: { preset: 'us', customPattern: 'yyyy-MM-dd HH:mm', firstDayOfWeek: 'auto' },
    } satisfies GeneralSettings);

    await service.init();

    const ts = Math.floor(new Date(2024, 0, 5, 13, 7).getTime() / 1000);
    expect(service.format(ts)).toBe('01/05/2024 01:07 PM');
  });

  it('applies the eu preset pattern via applyFromSettings()', () => {
    service.applyFromSettings({
      ...DEFAULT_GENERAL_SETTINGS,
      dateFormat: { preset: 'eu', customPattern: 'yyyy-MM-dd HH:mm', firstDayOfWeek: 'auto' },
    });

    const ts = Math.floor(new Date(2024, 0, 5, 13, 7).getTime() / 1000);
    expect(service.format(ts)).toBe('05.01.2024 13:07');
  });

  it('applies a custom pattern with literal text', () => {
    service.applyFromSettings({
      ...DEFAULT_GENERAL_SETTINGS,
      dateFormat: {
        preset: 'custom',
        customPattern: "dd/MM/yyyy 'at' HH:mm",
        firstDayOfWeek: 'auto',
      },
    });

    const ts = Math.floor(new Date(2024, 0, 5, 13, 7).getTime() / 1000);
    expect(service.format(ts)).toBe('05/01/2024 at 13:07');
  });

  it('formats an ISO datetime string using the resolved pattern', () => {
    service.applyFromSettings({
      ...DEFAULT_GENERAL_SETTINGS,
      dateFormat: { preset: 'us', customPattern: 'yyyy-MM-dd HH:mm', firstDayOfWeek: 'auto' },
    });

    expect(service.format('2024-01-05T13:07:00')).toBe('01/05/2024 01:07 PM');
  });

  it('resolves the locale-aware "short" format for hu-HU under the follow-language preset', () => {
    service.applyFromSettings({
      ...DEFAULT_GENERAL_SETTINGS,
      language: { language: 'hu' },
      dateFormat: {
        preset: 'follow-language',
        customPattern: 'yyyy-MM-dd HH:mm',
        firstDayOfWeek: 'auto',
      },
    });

    const ts = Math.floor(new Date(2024, 0, 5, 13, 7).getTime() / 1000);
    expect(service.format(ts)).toBe('2024. 01. 05. 13:07');
  });

  it('falls back to the ISO pattern in en-US when the resolved locale has no registered data', () => {
    LANGUAGE_LOCALE_MAP['zz'] = 'zz-ZZ';

    try {
      service.applyFromSettings({
        ...DEFAULT_GENERAL_SETTINGS,
        language: { language: 'zz' },
        dateFormat: { preset: 'iso', customPattern: 'yyyy-MM-dd HH:mm', firstDayOfWeek: 'auto' },
      });

      const ts = 1700000000;
      expect(service.format(ts)).toMatch(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}$/);
    } finally {
      delete LANGUAGE_LOCALE_MAP['zz'];
    }
  });

  it('defaults firstDayOfWeek to Monday (1) before init() resolves', () => {
    expect(service.resolved().firstDayOfWeek).toBe(1);
  });

  it('exposes the derived datePattern alongside pattern and locale via resolved()', () => {
    service.applyFromSettings({
      ...DEFAULT_GENERAL_SETTINGS,
      dateFormat: { preset: 'eu', customPattern: 'yyyy-MM-dd HH:mm', firstDayOfWeek: 'auto' },
    });

    expect(service.resolved().datePattern).toBe('dd.MM.yyyy');
  });

  it('exposes firstDayOfWeek resolved from the auto setting and language', () => {
    service.applyFromSettings({
      ...DEFAULT_GENERAL_SETTINGS,
      language: { language: 'hu' },
      dateFormat: { preset: 'iso', customPattern: 'yyyy-MM-dd HH:mm', firstDayOfWeek: 'auto' },
    });

    expect(service.resolved().firstDayOfWeek).toBe(1);
  });

  it('exposes an explicit firstDayOfWeek override regardless of language', () => {
    service.applyFromSettings({
      ...DEFAULT_GENERAL_SETTINGS,
      language: { language: 'hu' },
      dateFormat: { preset: 'iso', customPattern: 'yyyy-MM-dd HH:mm', firstDayOfWeek: 'sunday' },
    });

    expect(service.resolved().firstDayOfWeek).toBe(7);
  });
});

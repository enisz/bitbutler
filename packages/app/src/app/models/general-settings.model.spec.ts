import {
  DEFAULT_GENERAL_SETTINGS,
  GeneralSettings,
  LANGUAGE_LOCALE_MAP,
  resolveDateFormat,
  resolveFirstDayOfWeek,
} from './general-settings.model';

describe('resolveDateFormat', () => {
  const base: Pick<GeneralSettings, 'language' | 'dateFormat'> = {
    language: { language: 'us' },
    dateFormat: { preset: 'iso', customPattern: 'yyyy-MM-dd HH:mm', firstDayOfWeek: 'auto' },
  };

  it('resolves the iso preset to the ISO pattern regardless of language', () => {
    expect(resolveDateFormat({ ...base, language: { language: 'hu' } })).toEqual({
      pattern: 'yyyy-MM-dd HH:mm',
      datePattern: 'yyyy-MM-dd',
      locale: 'hu-HU',
    });
  });

  it('resolves the follow-language preset to the "short" named format', () => {
    expect(
      resolveDateFormat({ ...base, dateFormat: { preset: 'follow-language', customPattern: 'x' } }),
    ).toEqual({
      pattern: 'short',
      datePattern: 'shortDate',
      locale: 'en-US',
    });
  });

  it('resolves the us preset to a fixed US pattern', () => {
    expect(
      resolveDateFormat({ ...base, dateFormat: { preset: 'us', customPattern: 'x' } }),
    ).toEqual({
      pattern: 'MM/dd/yyyy hh:mm a',
      datePattern: 'MM/dd/yyyy',
      locale: 'en-US',
    });
  });

  it('resolves the eu preset to a fixed EU pattern', () => {
    expect(
      resolveDateFormat({ ...base, dateFormat: { preset: 'eu', customPattern: 'x' } }),
    ).toEqual({
      pattern: 'dd.MM.yyyy HH:mm',
      datePattern: 'dd.MM.yyyy',
      locale: 'en-US',
    });
  });

  it('resolves the custom preset to the stored customPattern, with time tokens stripped for datePattern', () => {
    expect(
      resolveDateFormat({
        ...base,
        dateFormat: { preset: 'custom', customPattern: "dd/MM/yyyy 'at' HH:mm" },
      }),
    ).toEqual({
      pattern: "dd/MM/yyyy 'at' HH:mm",
      datePattern: "dd/MM/yyyy 'at'",
      locale: 'en-US',
    });
  });

  it('keeps a quoted literal segment intact while stripping time tokens around it', () => {
    expect(
      resolveDateFormat({
        ...base,
        dateFormat: { preset: 'custom', customPattern: "'Added:' dd/MM/yyyy HH:mm" },
      }).datePattern,
    ).toBe("'Added:' dd/MM/yyyy");
  });

  it('falls back to the ISO date pattern when a custom pattern strips down to nothing', () => {
    expect(
      resolveDateFormat({ ...base, dateFormat: { preset: 'custom', customPattern: 'HH:mm' } })
        .datePattern,
    ).toBe('yyyy-MM-dd');
  });

  it('falls back to the ISO pattern when a custom pattern is empty', () => {
    expect(
      resolveDateFormat({ ...base, dateFormat: { preset: 'custom', customPattern: '' } }),
    ).toEqual({
      pattern: 'yyyy-MM-dd HH:mm',
      datePattern: 'yyyy-MM-dd',
      locale: 'en-US',
    });
  });

  it('maps the hu language code to the hu-HU locale', () => {
    expect(resolveDateFormat({ ...base, language: { language: 'hu' } }).locale).toBe('hu-HU');
  });

  it('falls back to DEFAULT_LOCALE for an unmapped language code', () => {
    expect(resolveDateFormat({ ...base, language: { language: 'zz' } }).locale).toBe('en-US');
  });
});

describe('DEFAULT_GENERAL_SETTINGS', () => {
  it('defaults dateFormat to the iso preset, ISO customPattern seed, and auto first day of week', () => {
    expect(DEFAULT_GENERAL_SETTINGS.dateFormat).toEqual({
      preset: 'iso',
      customPattern: 'yyyy-MM-dd HH:mm',
      firstDayOfWeek: 'auto',
    });
  });

  it('defaults deleteTorrentFileOnDuplicate to true', () => {
    expect(DEFAULT_GENERAL_SETTINGS.behavior.deleteTorrentFileOnDuplicate).toBe(true);
  });
});

describe('resolveFirstDayOfWeek', () => {
  it('maps an explicit sunday override to 7', () => {
    expect(
      resolveFirstDayOfWeek({
        language: { language: 'us' },
        dateFormat: { firstDayOfWeek: 'sunday' },
      }),
    ).toBe(7);
  });

  it('maps an explicit monday override to 1', () => {
    expect(
      resolveFirstDayOfWeek({
        language: { language: 'us' },
        dateFormat: { firstDayOfWeek: 'monday' },
      }),
    ).toBe(1);
  });

  it('maps an explicit saturday override to 6', () => {
    expect(
      resolveFirstDayOfWeek({
        language: { language: 'us' },
        dateFormat: { firstDayOfWeek: 'saturday' },
      }),
    ).toBe(6);
  });

  it('derives Sunday (7) for the us language under auto', () => {
    expect(
      resolveFirstDayOfWeek({
        language: { language: 'us' },
        dateFormat: { firstDayOfWeek: 'auto' },
      }),
    ).toBe(7);
  });

  it('derives Monday (1) for the hu language under auto', () => {
    expect(
      resolveFirstDayOfWeek({
        language: { language: 'hu' },
        dateFormat: { firstDayOfWeek: 'auto' },
      }),
    ).toBe(1);
  });

  it('derives Sunday (7) via the DEFAULT_LOCALE fallback for an unmapped language under auto', () => {
    expect(
      resolveFirstDayOfWeek({
        language: { language: 'zz' },
        dateFormat: { firstDayOfWeek: 'auto' },
      }),
    ).toBe(7);
  });

  it('falls back to Monday (1) when the resolved locale tag is malformed', () => {
    LANGUAGE_LOCALE_MAP['bad'] = 'not a locale!!';

    try {
      expect(
        resolveFirstDayOfWeek({
          language: { language: 'bad' },
          dateFormat: { firstDayOfWeek: 'auto' },
        }),
      ).toBe(1);
    } finally {
      delete LANGUAGE_LOCALE_MAP['bad'];
    }
  });
});

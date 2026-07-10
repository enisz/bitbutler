import {
  DEFAULT_GENERAL_SETTINGS,
  GeneralSettings,
  resolveDateFormat,
} from './general-settings.model';

describe('resolveDateFormat', () => {
  const base: Pick<GeneralSettings, 'language' | 'dateFormat'> = {
    language: { language: 'us' },
    dateFormat: { preset: 'iso', customPattern: 'yyyy-MM-dd HH:mm' },
  };

  it('resolves the iso preset to the ISO pattern regardless of language', () => {
    expect(resolveDateFormat({ ...base, language: { language: 'hu' } })).toEqual({
      pattern: 'yyyy-MM-dd HH:mm',
      locale: 'hu-HU',
    });
  });

  it('resolves the follow-language preset to the "short" named format', () => {
    expect(
      resolveDateFormat({ ...base, dateFormat: { preset: 'follow-language', customPattern: 'x' } }),
    ).toEqual({
      pattern: 'short',
      locale: 'en-US',
    });
  });

  it('resolves the us preset to a fixed US pattern', () => {
    expect(
      resolveDateFormat({ ...base, dateFormat: { preset: 'us', customPattern: 'x' } }),
    ).toEqual({
      pattern: 'MM/dd/yyyy hh:mm a',
      locale: 'en-US',
    });
  });

  it('resolves the eu preset to a fixed EU pattern', () => {
    expect(
      resolveDateFormat({ ...base, dateFormat: { preset: 'eu', customPattern: 'x' } }),
    ).toEqual({
      pattern: 'dd.MM.yyyy HH:mm',
      locale: 'en-US',
    });
  });

  it('resolves the custom preset to the stored customPattern', () => {
    expect(
      resolveDateFormat({
        ...base,
        dateFormat: { preset: 'custom', customPattern: "dd/MM/yyyy 'at' HH:mm" },
      }),
    ).toEqual({ pattern: "dd/MM/yyyy 'at' HH:mm", locale: 'en-US' });
  });

  it('falls back to the ISO pattern when a custom pattern is empty', () => {
    expect(
      resolveDateFormat({ ...base, dateFormat: { preset: 'custom', customPattern: '' } }),
    ).toEqual({
      pattern: 'yyyy-MM-dd HH:mm',
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
  it('defaults dateFormat to the iso preset with the ISO pattern as customPattern seed', () => {
    expect(DEFAULT_GENERAL_SETTINGS.dateFormat).toEqual({
      preset: 'iso',
      customPattern: 'yyyy-MM-dd HH:mm',
    });
  });
});

import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('electron', () => ({
  app: {
    isPackaged: false,
    getAppPath: () => '/fake/app',
  },
}));

vi.mock('node:fs', () => ({
  default: {
    readFileSync: vi.fn(),
  },
}));

describe('i18n', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('returns the key when translations are empty', async () => {
    const fs = await import('node:fs');
    vi.mocked(fs.default.readFileSync).mockReturnValue('{}');

    const { loadTranslations, t } = await import('./i18n.js');
    loadTranslations('us');

    expect(t('some.missing.key')).toBe('some.missing.key');
  });

  it('resolves a top-level key', async () => {
    const fs = await import('node:fs');
    vi.mocked(fs.default.readFileSync).mockReturnValue(JSON.stringify({ greeting: 'Hello' }));

    const { loadTranslations, t } = await import('./i18n.js');
    loadTranslations('us');

    expect(t('greeting')).toBe('Hello');
  });

  it('resolves a nested dot-path key', async () => {
    const fs = await import('node:fs');
    vi.mocked(fs.default.readFileSync).mockReturnValue(
      JSON.stringify({ electron: { menu: { file: 'File' } } }),
    );

    const { loadTranslations, t } = await import('./i18n.js');
    loadTranslations('us');

    expect(t('electron.menu.file')).toBe('File');
  });

  it('returns the key for a partial path that resolves to a non-string', async () => {
    const fs = await import('node:fs');
    vi.mocked(fs.default.readFileSync).mockReturnValue(
      JSON.stringify({ electron: { menu: { file: 'File' } } }),
    );

    const { loadTranslations, t } = await import('./i18n.js');
    loadTranslations('us');

    // 'electron.menu' resolves to an object, not a string - fall back to key
    expect(t('electron.menu')).toBe('electron.menu');
  });

  it('returns the key when readFileSync throws', async () => {
    const fs = await import('node:fs');
    vi.mocked(fs.default.readFileSync).mockImplementation(() => {
      throw new Error('ENOENT');
    });

    const { loadTranslations, t } = await import('./i18n.js');
    loadTranslations('us');

    expect(t('electron.menu.file')).toBe('electron.menu.file');
  });

  it('uses dev path when app is not packaged', async () => {
    const fs = await import('node:fs');
    vi.mocked(fs.default.readFileSync).mockReturnValue('{}');

    const { loadTranslations } = await import('./i18n.js');
    loadTranslations('us');

    expect(vi.mocked(fs.default.readFileSync)).toHaveBeenCalledWith(
      path.join('/fake/app', 'public', 'i18n', 'us.json'),
      'utf-8',
    );
  });
});

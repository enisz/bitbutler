import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('electron', () => ({
  app: { getPath: () => '/fake' },
  ipcMain: { handle: vi.fn() },
}));

const mockGet = vi.hoisted(() => vi.fn());

vi.mock('../db.js', () => ({
  default: {
    prepare: () => ({ get: mockGet, run: vi.fn() }),
  },
}));

describe('getInitialLanguage', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('returns "us" when no settings row exists', async () => {
    mockGet.mockReturnValue(null);
    const { getInitialLanguage } = await import('./settings.js');
    expect(getInitialLanguage()).toBe('us');
  });

  it('returns the stored language when valid', async () => {
    mockGet.mockReturnValue({
      json: JSON.stringify({ language: { language: 'hu' } }),
    });
    const { getInitialLanguage } = await import('./settings.js');
    expect(getInitialLanguage()).toBe('hu');
  });

  it('returns "us" when the language field is missing from stored settings', async () => {
    mockGet.mockReturnValue({ json: JSON.stringify({ theme: 'dark' }) });
    const { getInitialLanguage } = await import('./settings.js');
    expect(getInitialLanguage()).toBe('us');
  });
});

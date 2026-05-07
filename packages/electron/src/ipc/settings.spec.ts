import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const ipcHandlers = vi.hoisted(() => new Map<string, (...args: unknown[]) => unknown>());
const mockGet = vi.hoisted(() => vi.fn());
const mockRun = vi.hoisted(() => vi.fn(() => ({ changes: 1 })));

vi.mock('electron', () => ({
  app: { getPath: () => '/fake' },
  ipcMain: {
    handle: vi.fn((channel: string, handler: (...args: unknown[]) => unknown) => {
      ipcHandlers.set(channel, handler);
    }),
  },
}));

vi.mock('../db.js', () => ({
  default: {
    prepare: () => ({ get: mockGet, run: mockRun }),
  },
}));

describe('getInitialLanguage', () => {
  beforeEach(() => {
    vi.resetModules();
    ipcHandlers.clear();
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

describe('settingsGet (via IPC handler)', () => {
  beforeEach(() => {
    vi.resetModules();
    ipcHandlers.clear();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  async function getHandler() {
    const { registerSettingsIpcHandlers } = await import('./settings.js');
    registerSettingsIpcHandlers();
    return ipcHandlers.get('settings:get')!;
  }

  it('returns null when no row exists', async () => {
    mockGet.mockReturnValue(null);
    const handler = await getHandler();
    expect(await handler(null, { id: 'test-id' })).toBeNull();
  });

  it('returns parsed JSON from stored row', async () => {
    mockGet.mockReturnValue({ json: JSON.stringify({ theme: 'dark' }) });
    const handler = await getHandler();
    expect(await handler(null, { id: 'test-id' })).toEqual({ theme: 'dark' });
  });

  it('returns null when stored JSON is malformed', async () => {
    mockGet.mockReturnValue({ json: 'not-valid-json{{' });
    const handler = await getHandler();
    expect(await handler(null, { id: 'test-id' })).toBeNull();
  });

  it('returns null when row has no json field', async () => {
    mockGet.mockReturnValue({ json: null });
    const handler = await getHandler();
    expect(await handler(null, { id: 'test-id' })).toBeNull();
  });

  it('throws when id is absent', async () => {
    const handler = await getHandler();
    await expect(handler(null, {})).rejects.toThrow('settings: id is required');
  });

  it('throws when id is blank whitespace', async () => {
    const handler = await getHandler();
    await expect(handler(null, { id: '   ' })).rejects.toThrow('settings: id is required');
  });
});

describe('settingsUpsert (via IPC handler)', () => {
  beforeEach(() => {
    vi.resetModules();
    ipcHandlers.clear();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  async function getHandler() {
    const { registerSettingsIpcHandlers } = await import('./settings.js');
    registerSettingsIpcHandlers();
    return ipcHandlers.get('settings:upsert')!;
  }

  it('returns { ok: true } on success', async () => {
    const handler = await getHandler();
    expect(await handler(null, { id: 'theme', value: { mode: 'dark' } })).toEqual({ ok: true });
  });

  it('calls run with stringified value', async () => {
    const handler = await getHandler();
    await handler(null, { id: 'theme', value: { mode: 'dark' } });
    expect(mockRun).toHaveBeenCalledWith('theme', JSON.stringify({ mode: 'dark' }));
  });

  it('stores null when value is omitted', async () => {
    const handler = await getHandler();
    await handler(null, { id: 'theme' });
    expect(mockRun).toHaveBeenCalledWith('theme', 'null');
  });

  it('throws when id is missing', async () => {
    const handler = await getHandler();
    await expect(handler(null, { value: 'x' })).rejects.toThrow('settings: id is required');
  });

  it('trims the id before use', async () => {
    const handler = await getHandler();
    await handler(null, { id: '  theme  ', value: 1 });
    expect(mockRun).toHaveBeenCalledWith('theme', '1');
  });
});

describe('settingsDelete (via IPC handler)', () => {
  beforeEach(() => {
    vi.resetModules();
    ipcHandlers.clear();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  async function getHandler() {
    const { registerSettingsIpcHandlers } = await import('./settings.js');
    registerSettingsIpcHandlers();
    return ipcHandlers.get('settings:delete')!;
  }

  it('returns { ok: true }', async () => {
    const handler = await getHandler();
    expect(await handler(null, { id: 'theme' })).toEqual({ ok: true });
  });

  it('calls run with the correct id', async () => {
    const handler = await getHandler();
    await handler(null, { id: 'theme' });
    expect(mockRun).toHaveBeenCalledWith('theme');
  });

  it('throws when id is missing', async () => {
    const handler = await getHandler();
    await expect(handler(null, {})).rejects.toThrow('settings: id is required');
  });
});

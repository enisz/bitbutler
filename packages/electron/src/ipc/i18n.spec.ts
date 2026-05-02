import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const ipcOnHandlers = vi.hoisted(() => new Map<string, (...args: unknown[]) => unknown>());
const mockLoadTranslations = vi.hoisted(() => vi.fn());
const mockRebuildMenu = vi.hoisted(() => vi.fn());

vi.mock('electron', () => ({
  ipcMain: {
    on: vi.fn((channel: string, handler: (...args: unknown[]) => unknown) => {
      ipcOnHandlers.set(channel, handler);
    }),
  },
}));

vi.mock('../i18n.js', () => ({
  loadTranslations: mockLoadTranslations,
}));

vi.mock('../menu.js', () => ({
  rebuildMenu: mockRebuildMenu,
}));

describe('i18n:language-changed IPC event handler', () => {
  beforeEach(() => {
    vi.resetModules();
    ipcOnHandlers.clear();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  async function getHandler() {
    const { registerI18nIpcHandlers } = await import('./i18n.js');
    registerI18nIpcHandlers();
    return ipcOnHandlers.get('i18n:language-changed')!;
  }

  it('calls loadTranslations with the lang code', async () => {
    const handler = await getHandler();
    handler(null, { lang: 'hu' });
    expect(mockLoadTranslations).toHaveBeenCalledWith('hu');
  });

  it('calls rebuildMenu after loading translations', async () => {
    const handler = await getHandler();
    handler(null, { lang: 'us' });
    expect(mockRebuildMenu).toHaveBeenCalled();
  });

  it('does nothing when payload has no lang field', async () => {
    const handler = await getHandler();
    handler(null, {});
    expect(mockLoadTranslations).not.toHaveBeenCalled();
    expect(mockRebuildMenu).not.toHaveBeenCalled();
  });

  it('does nothing when lang is an empty string', async () => {
    const handler = await getHandler();
    handler(null, { lang: '' });
    expect(mockLoadTranslations).not.toHaveBeenCalled();
  });

  it('does nothing when lang is not a string', async () => {
    const handler = await getHandler();
    handler(null, { lang: 42 });
    expect(mockLoadTranslations).not.toHaveBeenCalled();
  });

  it('does nothing when payload is a plain string (not an object)', async () => {
    const handler = await getHandler();
    handler(null, 'hu');
    expect(mockLoadTranslations).not.toHaveBeenCalled();
  });

  it('does nothing when payload is null', async () => {
    const handler = await getHandler();
    handler(null, null);
    expect(mockLoadTranslations).not.toHaveBeenCalled();
  });

  it('does nothing when payload is undefined', async () => {
    const handler = await getHandler();
    handler(null, undefined);
    expect(mockLoadTranslations).not.toHaveBeenCalled();
  });
});

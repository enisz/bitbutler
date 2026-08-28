import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const ipcOnHandlers = vi.hoisted(() => new Map<string, (...args: unknown[]) => unknown>());
const mockRebuildMenu = vi.hoisted(() => vi.fn());

vi.mock('electron', () => ({
  ipcMain: {
    on: vi.fn((channel: string, handler: (...args: unknown[]) => unknown) => {
      ipcOnHandlers.set(channel, handler);
    }),
  },
}));

vi.mock('../menu.js', () => ({ rebuildMenu: mockRebuildMenu }));

describe('getActiveViewId / setActiveViewId', () => {
  beforeEach(() => {
    vi.resetModules();
    ipcOnHandlers.clear();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('returns null initially', async () => {
    const { getActiveViewId } = await import('./view.js');
    expect(getActiveViewId()).toBeNull();
  });

  it('stores and returns the set id', async () => {
    const { getActiveViewId, setActiveViewId } = await import('./view.js');
    setActiveViewId('torrent-list');
    expect(getActiveViewId()).toBe('torrent-list');
  });

  it('accepts null to clear the active view', async () => {
    const { getActiveViewId, setActiveViewId } = await import('./view.js');
    setActiveViewId('torrent-list');
    setActiveViewId(null);
    expect(getActiveViewId()).toBeNull();
  });
});

describe('view:set-active IPC event handler', () => {
  beforeEach(() => {
    vi.resetModules();
    ipcOnHandlers.clear();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('updates activeViewId and rebuilds the menu', async () => {
    const { registerViewIpcHandlers, getActiveViewId } = await import('./view.js');
    registerViewIpcHandlers();
    const handler = ipcOnHandlers.get('view:set-active')!;
    handler(null, 'torrent-list');
    expect(getActiveViewId()).toBe('torrent-list');
    expect(mockRebuildMenu).toHaveBeenCalled();
  });
});

import type { MenuItemConstructorOptions } from 'electron';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockBuildFromTemplate = vi.hoisted(() =>
  vi.fn((template: MenuItemConstructorOptions[]) => template),
);
const mockSetContextMenu = vi.hoisted(() => vi.fn());
const mockGetActiveServerId = vi.hoisted(() => vi.fn<() => string | null>(() => 'srv'));
const qb = vi.hoisted(() => ({
  start: vi.fn(() => Promise.resolve()),
  stop: vi.fn(() => Promise.resolve()),
  setUploadLimit: vi.fn(() => Promise.resolve()),
  setDownloadLimit: vi.fn(() => Promise.resolve()),
  toggleSpeedLimitsMode: vi.fn(() => Promise.resolve()),
}));

vi.mock('electron', () => ({
  Menu: { buildFromTemplate: mockBuildFromTemplate },
  Tray: class {
    setToolTip = vi.fn();
    setContextMenu = mockSetContextMenu;
    on = vi.fn();
    destroy = vi.fn();
  },
  app: { isPackaged: false, getAppPath: () => '/app', quit: vi.fn() },
}));
vi.mock('./i18n.js', () => ({ t: (key: string) => key }));
vi.mock('./ipc/qbittorrent.js', () => ({ getCookieJar: () => new Map([['srv', 'cookie']]) }));
vi.mock('./ipc/server.js', () => ({ getActiveServerId: mockGetActiveServerId }));
vi.mock('./qb/torrents.js', () => ({ start: qb.start, stop: qb.stop }));
vi.mock('./qb/transfer.js', () => ({
  setUploadLimit: qb.setUploadLimit,
  setDownloadLimit: qb.setDownloadLimit,
  toggleSpeedLimitsMode: qb.toggleSpeedLimitsMode,
}));

describe('tray menu', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
    mockGetActiveServerId.mockReturnValue('srv');
  });

  async function items(): Promise<MenuItemConstructorOptions[]> {
    const { createTray } = await import('./tray.js');
    createTray({} as Electron.BrowserWindow);
    return mockBuildFromTemplate.mock.calls.at(-1)![0];
  }

  const click = (list: MenuItemConstructorOptions[], label: string): unknown =>
    (list.find((i) => i.label === label)!.click as () => unknown)();

  it.each([
    ['electron.tray.start-all-torrents', () => qb.start, ['srv', 'all']],
    ['electron.tray.stop-all-torrents', () => qb.stop, ['srv', 'all']],
    ['electron.tray.remove-upload-limit', () => qb.setUploadLimit, ['srv', 0]],
    ['electron.tray.remove-download-limit', () => qb.setDownloadLimit, ['srv', 0]],
    ['electron.tray.toggle-alt-speed', () => qb.toggleSpeedLimitsMode, ['srv']],
  ])('%s calls the matching domain function', async (label, fn, args) => {
    const list = await items();
    await click(list, label);
    expect(fn()).toHaveBeenCalledWith(...args);
  });

  it('does nothing without an active server', async () => {
    mockGetActiveServerId.mockReturnValue(null);
    const list = await items();
    await click(list, 'electron.tray.toggle-alt-speed');
    expect(qb.toggleSpeedLimitsMode).not.toHaveBeenCalled();
  });
});

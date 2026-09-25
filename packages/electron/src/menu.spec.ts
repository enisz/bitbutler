import type { BrowserWindow, MenuItemConstructorOptions } from 'electron';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mockBuildFromTemplate = vi.hoisted(() =>
  vi.fn((template: MenuItemConstructorOptions[]) => template),
);
const mockSetApplicationMenu = vi.hoisted(() => vi.fn());
const mockShellOpenExternal = vi.hoisted(() => vi.fn());
const mockGetCurrentLanguage = vi.hoisted(() => vi.fn(() => 'us'));
const mockGetCookieJar = vi.hoisted(() => vi.fn(() => new Map<string, string>()));
const mockGetActiveServerId = vi.hoisted(() => vi.fn<() => string | null>(() => null));
const mockGetActiveViewId = vi.hoisted(() => vi.fn<() => string | null>(() => null));
const mockServerList = vi.hoisted(() =>
  vi.fn(() => [] as { id: string; name: string; host: string }[]),
);
const mockGetMainWindow = vi.hoisted(() => vi.fn());
const mockNotify = vi.hoisted(() => vi.fn());

const appMock = vi.hoisted(() => ({ isPackaged: false }));

vi.mock('electron', () => ({
  Menu: {
    buildFromTemplate: mockBuildFromTemplate,
    setApplicationMenu: mockSetApplicationMenu,
  },
  app: appMock,
  shell: { openExternal: mockShellOpenExternal },
}));

vi.mock('./i18n.js', () => ({
  t: (key: string) => key,
  getCurrentLanguage: mockGetCurrentLanguage,
}));

vi.mock('./ipc/qbittorrent.js', () => ({ getCookieJar: mockGetCookieJar }));

vi.mock('./ipc/server.js', () => ({
  getActiveServerId: mockGetActiveServerId,
  serverList: mockServerList,
}));

vi.mock('./ipc/view.js', () => ({ getActiveViewId: mockGetActiveViewId }));

vi.mock('./main.js', () => ({ getMainWindow: mockGetMainWindow }));

vi.mock('./notification.js', () => ({ notify: mockNotify }));

interface FakeWindow {
  isDestroyed: () => boolean;
  webContents: { send: ReturnType<typeof vi.fn>; openDevTools: ReturnType<typeof vi.fn> };
}

function createFakeWindow(): FakeWindow {
  return {
    isDestroyed: vi.fn(() => false),
    webContents: { send: vi.fn(), openDevTools: vi.fn() },
  };
}

function findItem(
  items: MenuItemConstructorOptions[],
  predicate: (item: MenuItemConstructorOptions) => boolean,
): MenuItemConstructorOptions | undefined {
  for (const item of items) {
    if (predicate(item)) return item;
    if (Array.isArray(item.submenu)) {
      const found = findItem(item.submenu as MenuItemConstructorOptions[], predicate);
      if (found) return found;
    }
  }
  return undefined;
}

function byLabel(label: string) {
  return (item: MenuItemConstructorOptions) => item.label === label;
}

describe('rebuildMenu', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    appMock.isPackaged = false;
    mockGetCookieJar.mockReturnValue(new Map());
    mockGetActiveServerId.mockReturnValue(null);
    mockGetActiveViewId.mockReturnValue(null);
    mockServerList.mockReturnValue([]);
    mockGetMainWindow.mockReturnValue(null);
    mockGetCurrentLanguage.mockReturnValue('us');
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  async function buildMenu(mainWindow?: FakeWindow | null): Promise<MenuItemConstructorOptions[]> {
    const { rebuildMenu } = await import('./menu.js');
    rebuildMenu(mainWindow as unknown as BrowserWindow | null | undefined);
    return mockBuildFromTemplate.mock.calls.at(-1)![0] as MenuItemConstructorOptions[];
  }

  it('builds and installs the application menu', async () => {
    const template = await buildMenu();
    expect(mockBuildFromTemplate).toHaveBeenCalledWith(template);
    expect(mockSetApplicationMenu).toHaveBeenCalledWith(template);
  });

  describe('File menu', () => {
    it('assigns the expected accelerators', async () => {
      const template = await buildMenu();
      expect(findItem(template, byLabel('electron.menu.add-torrent'))?.accelerator).toBe(
        'CmdOrCtrl+N',
      );
      expect(findItem(template, byLabel('electron.menu.export-torrents'))?.accelerator).toBe(
        'CmdOrCtrl+E',
      );
      expect(findItem(template, byLabel('electron.menu.import-torrents'))?.accelerator).toBe(
        'CmdOrCtrl+I',
      );
      expect(findItem(template, byLabel('electron.menu.disconnect'))?.accelerator).toBe(
        'CmdOrCtrl+L',
      );
      expect(findItem(template, byLabel('electron.menu.quit'))?.accelerator).toBe('CmdOrCtrl+Q');
    });

    it('sends file.quit when Quit is clicked, instead of quitting immediately', async () => {
      const mainWindow = createFakeWindow();
      const template = await buildMenu(mainWindow);
      const item = findItem(template, byLabel('electron.menu.quit'))!;
      expect(item.role).toBeUndefined();
      (item.click as () => void)();
      expect(mainWindow.webContents.send).toHaveBeenCalledWith(
        'menu:clicked',
        expect.objectContaining({ action: 'file.quit' }),
      );
    });

    it('disables actions requiring a connection when logged out', async () => {
      const template = await buildMenu();
      expect(findItem(template, byLabel('electron.menu.add-torrent'))?.enabled).toBe(false);
      expect(findItem(template, byLabel('electron.menu.export-torrents'))?.enabled).toBe(false);
      expect(findItem(template, byLabel('electron.menu.import-torrents'))?.enabled).toBe(false);
      expect(findItem(template, byLabel('electron.menu.disconnect'))?.enabled).toBe(false);
    });

    it('enables actions requiring a connection when logged in', async () => {
      mockGetCookieJar.mockReturnValue(new Map([['srv-1', 'SID=abc']]));
      const template = await buildMenu();
      expect(findItem(template, byLabel('electron.menu.add-torrent'))?.enabled).toBe(true);
    });

    it('sends a menu:clicked action when clicked', async () => {
      const mainWindow = createFakeWindow();
      const template = await buildMenu(mainWindow);
      const item = findItem(template, byLabel('electron.menu.add-torrent'))!;
      (item.click as () => void)();
      expect(mainWindow.webContents.send).toHaveBeenCalledWith(
        'menu:clicked',
        expect.objectContaining({ action: 'file.addTorrent' }),
      );
    });

    it('does not throw and does not send when the window is missing', async () => {
      const template = await buildMenu(null);
      const item = findItem(template, byLabel('electron.menu.add-torrent'))!;
      expect(() => (item.click as () => void)()).not.toThrow();
    });

    it('does not send when the window has been destroyed', async () => {
      const mainWindow = createFakeWindow();
      mainWindow.isDestroyed.mockReturnValue(true);
      const template = await buildMenu(mainWindow);
      const item = findItem(template, byLabel('electron.menu.add-torrent'))!;
      (item.click as () => void)();
      expect(mainWindow.webContents.send).not.toHaveBeenCalled();
    });
  });

  describe('Settings menu', () => {
    it('is hidden when logged out', async () => {
      const template = await buildMenu();
      expect(findItem(template, byLabel('electron.menu.settings-menu'))).toBeUndefined();
    });

    it('is shown with the expected accelerators when logged in', async () => {
      mockGetCookieJar.mockReturnValue(new Map([['srv-1', 'SID=abc']]));
      const template = await buildMenu();
      expect(findItem(template, byLabel('electron.menu.app-settings'))?.accelerator).toBe(
        'CmdOrCtrl+.',
      );
      expect(findItem(template, byLabel('electron.menu.qb-settings'))?.accelerator).toBe(
        'CmdOrCtrl+,',
      );
      expect(findItem(template, byLabel('electron.menu.manage-servers'))?.accelerator).toBe(
        'CmdOrCtrl+Shift+S',
      );
      expect(findItem(template, byLabel('electron.menu.manage-tags'))?.accelerator).toBe(
        'CmdOrCtrl+Shift+T',
      );
      expect(findItem(template, byLabel('electron.menu.manage-categories'))?.accelerator).toBe(
        'CmdOrCtrl+Shift+C',
      );
    });

    it('omits the servers submenu when there are no servers', async () => {
      mockGetCookieJar.mockReturnValue(new Map([['srv-1', 'SID=abc']]));
      const template = await buildMenu();
      expect(findItem(template, byLabel('electron.menu.servers'))).toBeUndefined();
    });

    it('lists servers as radio items and marks the active one as checked', async () => {
      mockGetCookieJar.mockReturnValue(new Map([['srv-1', 'SID=abc']]));
      mockServerList.mockReturnValue([
        { id: 'srv-1', name: 'Server One', host: 'host1' },
        { id: 'srv-2', name: '', host: 'host2' },
      ]);
      mockGetActiveServerId.mockReturnValue('srv-2');
      const template = await buildMenu();
      const serversMenu = findItem(template, byLabel('electron.menu.servers'));
      const items = serversMenu!.submenu as MenuItemConstructorOptions[];
      expect(items[0]).toMatchObject({ label: 'Server One', type: 'radio', checked: false });
      expect(items[1]).toMatchObject({ label: 'host2', type: 'radio', checked: true });
    });

    it('sends server.select with the server id when a server item is clicked', async () => {
      mockGetCookieJar.mockReturnValue(new Map([['srv-1', 'SID=abc']]));
      mockServerList.mockReturnValue([{ id: 'srv-1', name: 'Server One', host: 'host1' }]);
      const mainWindow = createFakeWindow();
      const template = await buildMenu(mainWindow);
      const serversMenu = findItem(template, byLabel('electron.menu.servers'));
      const items = serversMenu!.submenu as MenuItemConstructorOptions[];
      (items[0].click as () => void)();
      expect(mainWindow.webContents.send).toHaveBeenCalledWith(
        'menu:clicked',
        expect.objectContaining({ action: 'server.select', serverId: 'srv-1' }),
      );
    });
  });

  describe('View menu', () => {
    it('is hidden when logged out', async () => {
      const template = await buildMenu();
      expect(findItem(template, byLabel('electron.menu.view-menu'))).toBeUndefined();
    });

    it('is shown when logged in, with the torrent list item checked when active', async () => {
      mockGetCookieJar.mockReturnValue(new Map([['srv-1', 'SID=abc']]));
      mockGetActiveViewId.mockReturnValue('torrent-list');
      const template = await buildMenu();
      const viewMenu = findItem(template, byLabel('electron.menu.view-menu'));
      const items = viewMenu!.submenu as MenuItemConstructorOptions[];
      expect(items[0]).toMatchObject({
        label: 'electron.menu.view-torrent-list',
        type: 'radio',
        checked: true,
      });
    });

    it('is unchecked when no view has reported itself active yet', async () => {
      mockGetCookieJar.mockReturnValue(new Map([['srv-1', 'SID=abc']]));
      const template = await buildMenu();
      const viewMenu = findItem(template, byLabel('electron.menu.view-menu'));
      const items = viewMenu!.submenu as MenuItemConstructorOptions[];
      expect(items[0].checked).toBe(false);
    });

    it('sends view.select with the view id when clicked', async () => {
      mockGetCookieJar.mockReturnValue(new Map([['srv-1', 'SID=abc']]));
      const mainWindow = createFakeWindow();
      const template = await buildMenu(mainWindow);
      const viewMenu = findItem(template, byLabel('electron.menu.view-menu'));
      const items = viewMenu!.submenu as MenuItemConstructorOptions[];
      (items[0].click as () => void)();
      expect(mainWindow.webContents.send).toHaveBeenCalledWith(
        'menu:clicked',
        expect.objectContaining({ action: 'view.select', viewId: 'torrent-list' }),
      );
    });
  });

  describe('Help menu', () => {
    it('assigns the expected accelerators', async () => {
      const template = await buildMenu();
      expect(findItem(template, byLabel('electron.menu.check-for-updates'))?.accelerator).toBe(
        'CmdOrCtrl+U',
      );
      expect(findItem(template, byLabel('electron.menu.about'))?.accelerator).toBe('F1');
      expect(findItem(template, byLabel('electron.menu.user-guide'))?.accelerator).toBe(
        'CmdOrCtrl+Shift+,',
      );
    });

    it('opens the English docs when User Guide is clicked in English', async () => {
      mockGetCurrentLanguage.mockReturnValue('us');
      const template = await buildMenu();
      const item = findItem(template, byLabel('electron.menu.user-guide'))!;
      (item.click as () => void)();
      expect(mockShellOpenExternal).toHaveBeenCalledWith('https://enisz.github.io/bitbutler/');
    });

    it('opens the Hungarian docs when User Guide is clicked in Hungarian', async () => {
      mockGetCurrentLanguage.mockReturnValue('hu');
      const template = await buildMenu();
      const item = findItem(template, byLabel('electron.menu.user-guide'))!;
      (item.click as () => void)();
      expect(mockShellOpenExternal).toHaveBeenCalledWith('https://enisz.github.io/bitbutler/hu/');
    });
  });

  describe('Debug menu', () => {
    it('is omitted from packaged builds', async () => {
      appMock.isPackaged = true;
      const template = await buildMenu();
      expect(findItem(template, byLabel('Debug'))).toBeUndefined();
    });

    it('is present in dev builds', async () => {
      const template = await buildMenu();
      expect(findItem(template, byLabel('Debug'))).toBeDefined();
    });

    it('opens devtools on the main window when Open DevTools is clicked', async () => {
      const mainWindow = createFakeWindow();
      mockGetMainWindow.mockReturnValue(mainWindow);
      const template = await buildMenu(mainWindow);
      const item = findItem(template, byLabel('Open DevTools'))!;
      expect(item.accelerator).toBe('F12');
      (item.click as () => void)();
      expect(mainWindow.webContents.openDevTools).toHaveBeenCalledWith({ mode: 'detach' });
    });

    it('sends view.select for the logs view when Logs is clicked', async () => {
      const mainWindow = createFakeWindow();
      const template = await buildMenu(mainWindow);
      const item = findItem(template, byLabel('Logs'))!;
      (item.click as () => void)();
      expect(mainWindow.webContents.send).toHaveBeenCalledWith(
        'menu:clicked',
        expect.objectContaining({ action: 'view.select', viewId: 'logs' }),
      );
    });

    it('reloads the window using the built-in reload role instead of an unhandled IPC action', async () => {
      const template = await buildMenu();
      const item = findItem(template, byLabel('Reload'))!;
      expect(item.role).toBe('reload');
      expect(item.accelerator).toBe('CmdOrCtrl+R');
      expect(item.click).toBeUndefined();
    });
  });
});

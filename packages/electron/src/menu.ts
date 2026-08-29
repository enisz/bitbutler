import { Menu, app, shell } from 'electron';
import { getCurrentLanguage, t } from './i18n.js';
import { getCookieJar } from './ipc/qbittorrent.js';
import { getActiveServerId, serverList } from './ipc/server.js';
import { getActiveViewId } from './ipc/view.js';
import { getMainWindow } from './main.js';
import { notify } from './notification.js';

const DOCS_BASE_URL = 'https://enisz.github.io/bitbutler/';

function getDocsUrl(): string {
  return getCurrentLanguage() === 'hu' ? `${DOCS_BASE_URL}hu/` : DOCS_BASE_URL;
}

function sendMenuAction(
  mainWindow: Electron.BrowserWindow | null,
  action: string,
  extraPayload: Record<string, unknown> = {},
): void {
  if (!mainWindow || mainWindow.isDestroyed()) return;
  mainWindow.webContents.send('menu:clicked', { action, ts: Date.now(), ...extraPayload });
}

export function rebuildMenu(mainWindowArg?: Electron.BrowserWindow | null): void {
  const isDev = !app.isPackaged;
  const mainWindow = mainWindowArg ?? getMainWindow();

  const cookieJar = getCookieJar();
  const loggedIn = !!cookieJar.size;

  const servers = serverList();
  const activeServerId = getActiveServerId();
  const serverMenuItems = servers.map((server) => ({
    label: server.name || server.host,
    type: 'radio' as const,
    checked: server.id === activeServerId,
    click: () => sendMenuAction(mainWindow, 'server.select', { serverId: server.id }),
  }));

  const loggedInItems: Electron.MenuItemConstructorOptions[] = loggedIn
    ? [
        {
          label: t('electron.menu.view-menu'),
          submenu: [
            {
              label: t('electron.menu.view-torrent-list'),
              type: 'radio' as const,
              checked: getActiveViewId() === 'torrent-list',
              click: () => sendMenuAction(mainWindow, 'view.select', { viewId: 'torrent-list' }),
            },
            {
              label: t('electron.menu.view-dashboard'),
              type: 'radio' as const,
              checked: getActiveViewId() === 'dashboard',
              click: () => sendMenuAction(mainWindow, 'view.select', { viewId: 'dashboard' }),
            },
          ],
        },
        ...(servers.length > 0
          ? [
              {
                label: t('electron.menu.servers'),
                submenu: serverMenuItems,
              },
            ]
          : []),
        {
          label: t('electron.menu.settings-menu'),
          submenu: [
            {
              label: t('electron.menu.app-settings'),
              accelerator: 'CmdOrCtrl+.',
              click: () => sendMenuAction(mainWindow, 'settings.app'),
            },
            {
              label: t('electron.menu.qb-settings'),
              accelerator: 'CmdOrCtrl+,',
              click: () => sendMenuAction(mainWindow, 'settings.qb'),
            },
            { type: 'separator' },
            {
              label: t('electron.menu.manage-servers'),
              accelerator: 'CmdOrCtrl+Shift+S',
              click: () => sendMenuAction(mainWindow, 'server.manage'),
            },
            {
              label: t('electron.menu.manage-tags'),
              accelerator: 'CmdOrCtrl+Shift+T',
              click: () => sendMenuAction(mainWindow, 'settings.manage-tags'),
            },
            {
              label: t('electron.menu.manage-categories'),
              accelerator: 'CmdOrCtrl+Shift+C',
              click: () => sendMenuAction(mainWindow, 'settings.manage-categories'),
            },
          ],
        },
      ]
    : [];

  const devItems: Electron.MenuItemConstructorOptions[] = isDev
    ? [
        {
          label: 'Debug',
          submenu: [
            {
              label: 'Open DevTools',
              accelerator: 'F12',
              click: () => getMainWindow()?.webContents.openDevTools({ mode: 'detach' }),
            },
            { type: 'separator' },
            {
              label: 'Show a Notification',
              submenu: [
                {
                  label: 'Notification from Renderer',
                  click: () => sendMenuAction(mainWindow, 'debug.notification'),
                },
                {
                  label: 'Notification from Main',
                  click: () => notify('Notification Test', 'A notification from the Main process'),
                },
              ],
            },
            {
              label: 'Show a toast',
              submenu: [
                {
                  label: 'Primary',
                  click: () => sendMenuAction(mainWindow, 'debug.toast.primary'),
                },
                {
                  label: 'Secondary',
                  click: () => sendMenuAction(mainWindow, 'debug.toast.secondary'),
                },
                {
                  label: 'Success',
                  click: () => sendMenuAction(mainWindow, 'debug.toast.success'),
                },
                {
                  label: 'Danger',
                  click: () => sendMenuAction(mainWindow, 'debug.toast.danger'),
                },
                {
                  label: 'Warning',
                  click: () => sendMenuAction(mainWindow, 'debug.toast.warning'),
                },
                { label: 'Info', click: () => sendMenuAction(mainWindow, 'debug.toast.info') },
                { label: 'Light', click: () => sendMenuAction(mainWindow, 'debug.toast.light') },
                { label: 'Dark', click: () => sendMenuAction(mainWindow, 'debug.toast.dark') },
                {
                  label: 'Adaptive',
                  click: () => sendMenuAction(mainWindow, 'debug.toast.adaptive'),
                },
                { type: 'separator' },
                {
                  label: 'Random',
                  click: () => sendMenuAction(mainWindow, 'debug.toast.random'),
                },
                {
                  label: 'One of each',
                  click: () => sendMenuAction(mainWindow, 'debug.toast.all'),
                },
              ],
            },
            { type: 'separator' },
            {
              label: 'Reload',
              accelerator: 'CmdOrCtrl+R',
              role: 'reload',
            },
          ],
        },
      ]
    : [];

  const template: Electron.MenuItemConstructorOptions[] = [
    {
      label: t('electron.menu.file'),
      submenu: [
        {
          label: t('electron.menu.add-torrent'),
          enabled: loggedIn,
          accelerator: 'CmdOrCtrl+N',
          click: () => sendMenuAction(mainWindow, 'file.addTorrent'),
        },
        { type: 'separator' },
        {
          label: t('electron.menu.export-torrents'),
          enabled: loggedIn,
          accelerator: 'CmdOrCtrl+E',
          click: () => sendMenuAction(mainWindow, 'file.exportTorrents'),
        },
        {
          label: t('electron.menu.import-torrents'),
          enabled: loggedIn,
          accelerator: 'CmdOrCtrl+I',
          click: () => sendMenuAction(mainWindow, 'file.importTorrents'),
        },
        { type: 'separator' },
        {
          label: t('electron.menu.disconnect'),
          enabled: loggedIn,
          accelerator: 'CmdOrCtrl+L',
          click: () => sendMenuAction(mainWindow, 'file.disconnect'),
        },
        { type: 'separator' },
        {
          label: t('electron.menu.quit'),
          accelerator: 'CmdOrCtrl+Q',
          click: () => sendMenuAction(mainWindow, 'file.quit'),
        },
      ],
    },
    ...loggedInItems,
    {
      label: t('electron.menu.help'),
      submenu: [
        {
          label: t('electron.menu.check-for-updates'),
          accelerator: 'CmdOrCtrl+U',
          click: () => sendMenuAction(mainWindow, 'help.checkForUpdates'),
        },
        {
          label: t('electron.menu.user-guide'),
          accelerator: 'CmdOrCtrl+Shift+,',
          click: () => shell.openExternal(getDocsUrl()),
        },
        { type: 'separator' },
        {
          label: t('electron.menu.about'),
          accelerator: 'F1',
          click: () => sendMenuAction(mainWindow, 'help.about'),
        },
      ],
    },
    ...devItems,
  ];

  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

export function installMenu(mainWindow: Electron.BrowserWindow): void {
  rebuildMenu(mainWindow);
}

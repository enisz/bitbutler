import { Menu, app } from 'electron';
import { t } from './i18n.js';
import { getCookieJar } from './ipc/qbittorrent.js';
import { getActiveServerId, serverList } from './ipc/server.js';
import { getMainWindow } from './main.js';
import { notify } from './notification.js';

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
              click: () => sendMenuAction(mainWindow, 'settings.app'),
            },
            {
              label: t('electron.menu.qb-settings'),
              click: () => sendMenuAction(mainWindow, 'settings.qb'),
            },
            { type: 'separator' },
            {
              label: t('electron.menu.manage-servers'),
              click: () => sendMenuAction(mainWindow, 'server.manage'),
            },
            {
              label: t('electron.menu.manage-tags'),
              click: () => sendMenuAction(mainWindow, 'settings.manage-tags'),
            },
            {
              label: t('electron.menu.manage-categories'),
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
              click: () => sendMenuAction(mainWindow, 'debug.reload'),
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
          submenu: [
            {
              label: t('electron.menu.add-torrent-from-file'),
              click: () => sendMenuAction(mainWindow, 'file.addTorrent.file'),
            },
            {
              label: t('electron.menu.add-torrent-from-link'),
              click: () => sendMenuAction(mainWindow, 'file.addTorrent.link'),
            },
          ],
        },
        { type: 'separator' },
        {
          label: t('electron.menu.export-torrents'),
          enabled: loggedIn,
          click: () => sendMenuAction(mainWindow, 'file.exportTorrents'),
        },
        {
          label: t('electron.menu.import-torrents'),
          enabled: loggedIn,
          click: () => sendMenuAction(mainWindow, 'file.importTorrents'),
        },
        { type: 'separator' },
        {
          label: t('electron.menu.disconnect'),
          enabled: loggedIn,
          click: () => sendMenuAction(mainWindow, 'file.disconnect'),
        },
        { type: 'separator' },
        { role: 'quit' },
      ],
    },
    ...loggedInItems,
    {
      label: t('electron.menu.help'),
      submenu: [
        {
          label: t('electron.menu.check-for-updates'),
          click: () => sendMenuAction(mainWindow, 'help.checkForUpdates'),
        },
        { type: 'separator' },
        {
          label: t('electron.menu.about'),
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

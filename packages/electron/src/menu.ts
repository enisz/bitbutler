import { Menu, app, dialog, shell } from 'electron';
import { t } from './i18n.js';
import { getCookieJar } from './ipc/qbittorrent.js';
import { getActiveServerId, serverList } from './ipc/server.js';
import { getActiveViewId } from './ipc/view.js';
import { getLogDirectory } from './logger.js';
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

// The same list backs both Debug > Toasts submenus; only the action prefix differs, so the
// renderer can tell a plain toast from one with actions.
function debugToastItems(
  mainWindow: Electron.BrowserWindow | null,
  prefix: string,
): Electron.MenuItemConstructorOptions[] {
  const item = (label: string, kind: string): Electron.MenuItemConstructorOptions => ({
    label,
    click: () => sendMenuAction(mainWindow, `${prefix}.${kind}`),
  });

  return [
    item('Primary', 'primary'),
    item('Secondary', 'secondary'),
    item('Success', 'success'),
    item('Danger', 'danger'),
    item('Warning', 'warning'),
    item('Info', 'info'),
    item('Light', 'light'),
    item('Dark', 'dark'),
    item('Adaptive', 'adaptive'),
    { type: 'separator' },
    item('Random', 'random'),
    item('One of each', 'all'),
  ];
}

function openLogsFolder(): void {
  void shell.openPath(getLogDirectory()).then((error) => {
    if (!error) return;
    console.error(`[menu] failed to open the logs folder: ${error}`);
    dialog.showErrorBox(t('electron.menu.open-logs-folder-failed'), error);
  });
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
              label: 'Notifications',
              submenu: [
                {
                  label: 'From Renderer',
                  click: () => sendMenuAction(mainWindow, 'debug.notification'),
                },
                {
                  label: 'From Main',
                  click: () => notify('Notification Test', 'A notification from the Main process'),
                },
              ],
            },
            {
              label: 'Toasts',
              submenu: [
                { label: 'Without Actions', submenu: debugToastItems(mainWindow, 'debug.toast') },
                {
                  label: 'With Actions',
                  submenu: debugToastItems(mainWindow, 'debug.toast.actions'),
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
          label: t('electron.menu.open-logs-folder'),
          click: openLogsFolder,
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

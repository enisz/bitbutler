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
    label: `${server.name || server.host}`,
    type: 'radio' as const,
    checked: server.id === activeServerId,
    click: () => sendMenuAction(mainWindow, 'server.select', { serverId: server.id }),
  }));

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
              accelerator: 'Ctrl+O',
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
          label: t('electron.menu.disconnect'),
          enabled: loggedIn,
          click: () => sendMenuAction(mainWindow, 'file.disconnect'),
        },
        { type: 'separator' },
        { role: 'quit' },
      ],
    },
    ...(loggedIn
      ? [
          {
            label: t('electron.menu.servers'),
            submenu: [
              ...(servers.length >= 2 ? [...serverMenuItems, { type: 'separator' as const }] : []),
              {
                label: t('electron.menu.add-new'),
                click: () => sendMenuAction(mainWindow, 'server.add'),
              },
            ],
          },
          {
            label: t('electron.menu.settings-menu'),
            submenu: [
              {
                label: t('electron.menu.app-settings'),
                accelerator: 'Ctrl+,',
                click: () => sendMenuAction(mainWindow, 'settings.app'),
              },
              {
                label: t('electron.menu.qb-settings'),
                click: () => sendMenuAction(mainWindow, 'settings.qb'),
              },
              { type: 'separator' },
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
      : []),
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
    ...(isDev
      ? [
          {
            label: 'Debug',
            submenu: [
              {
                label: 'Open DevTools',
                accelerator: 'F12',
                click: () => getMainWindow()?.webContents.openDevTools({ mode: 'detach' }),
              },
              { type: 'separator' as const },
              {
                label: 'Show a Notification',
                submenu: [
                  {
                    label: 'Notification from Renderer',
                    click: () => sendMenuAction(mainWindow, 'debug.notification'),
                  },
                  {
                    label: 'Notification from Main',
                    click: () =>
                      notify('Notification Test', 'A notification from the Main process'),
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
                  { type: 'separator' as const },
                  {
                    label: 'Random',
                    accelerator: 'Ctrl+.',
                    click: () => sendMenuAction(mainWindow, 'debug.toast.random'),
                  },
                  {
                    label: 'One of each',
                    click: () => sendMenuAction(mainWindow, 'debug.toast.all'),
                  },
                ],
              },
              { type: 'separator' as const },
              {
                label: 'Reload',
                accelerator: 'Ctrl+R',
                click: () => sendMenuAction(mainWindow, 'debug.reload'),
              },
            ],
          },
        ]
      : []),
  ];

  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

export function installMenu(mainWindow: Electron.BrowserWindow): void {
  rebuildMenu(mainWindow);
}

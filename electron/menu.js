import { Menu, app } from 'electron';
import { getMainWindow } from '../electron-main.js';
import { getCookieJar } from './ipc/qbittorrent.js';
import { getActiveServerId, serverList } from './ipc/server.js';
import { notify } from './notification.js';

function sendMenuAction(mainWindow, action, extraPayload = {}) {
  if (!mainWindow || mainWindow.isDestroyed()) return;
  mainWindow.webContents.send('menu:clicked', { action, ts: Date.now(), ...extraPayload });
}

export function rebuildMenu(mainWindowArg) {
  const isDev = !app.isPackaged;
  const mainWindow = mainWindowArg ?? getMainWindow();

  const cookieJar = getCookieJar();
  const loggedIn = !!cookieJar.size;

  const servers = serverList();
  const activeServerId = getActiveServerId();
  const serverMenuItems = servers.map((server) => ({
    label: `${server.name || server.host} | ${server.protocol}://${server.host}:${server.port}`,
    type: 'radio',
    checked: server.id === activeServerId,
    click: () => sendMenuAction(mainWindow, 'server.select', { serverId: server.id }),
  }));

  const template = [
    {
      label: 'File',
      submenu: [
        {
          label: 'Add Torrent…',
          accelerator: 'Ctrl+O',
          enabled: loggedIn,
          click: () => sendMenuAction(mainWindow, 'file.addTorrent'),
        },
        {
          label: 'Settings',
          accelerator: 'Ctrl+,',
          enabled: loggedIn,
          click: () => sendMenuAction(mainWindow, 'file.settings'),
        },
        { type: 'separator' },
        {
          label: 'Import Torrents',
          accelerator: 'Ctrl+I',
          enabled: loggedIn,
          click: () => sendMenuAction(mainWindow, 'file.import'),
        },
        {
          label: 'Export Torrents',
          enabled: loggedIn,
          submenu: [
            {
              label: 'All',
              click: () => sendMenuAction(mainWindow, 'file.export.all'),
            },
            {
              label: 'Selected',
              click: () => sendMenuAction(mainWindow, 'file.export.selected'),
            },
          ],
        },
        { type: 'separator' },
        {
          label: 'Disconnect',
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
            label: 'Servers',
            submenu: [
              ...serverMenuItems,
              { type: 'separator' },
              { label: 'Add new...', click: () => sendMenuAction(mainWindow, 'server.add') },
            ],
          },
        ]
      : []),
    {
      label: 'Help',
      submenu: [
        {
          label: 'Check for Updates',
          click: () => sendMenuAction(mainWindow, 'help.checkForUpdates'),
        },
        { type: 'separator' },
        {
          label: 'About BitButler',
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
                click: () => getMainWindow().webContents.openDevTools({ mode: 'detach' }),
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
                  {
                    label: 'Info',
                    click: () => sendMenuAction(mainWindow, 'debug.toast.info'),
                  },
                  {
                    label: 'Light',
                    click: () => sendMenuAction(mainWindow, 'debug.toast.light'),
                  },
                  {
                    label: 'Dark',
                    click: () => sendMenuAction(mainWindow, 'debug.toast.dark'),
                  },
                  {
                    label: 'Adaptive',
                    click: () => sendMenuAction(mainWindow, 'debug.toast.adaptive'),
                  },
                  { type: 'separator' },
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
              { type: 'separator' },
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

export function installMenu(mainWindow) {
  rebuildMenu(mainWindow);
}

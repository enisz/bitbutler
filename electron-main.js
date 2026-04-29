import { app } from 'electron';
import { registerElectronIpcHandlers } from './electron/ipc/electron.js';
import { registerNotificationIpcHandlers } from './electron/ipc/notification.js';
import { registerQbIpcHandlers } from './electron/ipc/qbittorrent.js';
import { registerServerIpcHandlers } from './electron/ipc/server.js';
import { registerSettingsIpcHandlers } from './electron/ipc/settings.js';
import { registerTorrentIpcHandlers } from './electron/ipc/torrent.js';
import { handleSecondInstanceArgv, registerWindowIpcHandlers } from './electron/ipc/window.js';
import { createMainWindow } from './electron/main-window.js';
import { installMenu } from './electron/menu.js';
import { notify } from './electron/notification.js';
import { createTray } from './electron/tray.js';

let mainWindow = null;
let notified = false;

export function getMainWindow() {
  return mainWindow;
}

if (process.platform === 'win32') {
  app.setAppUserModelId('com.enisz.bitbutler');
}

function createOrRestoreMainWindow() {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.show();
    mainWindow.focus();
    return mainWindow;
  }

  mainWindow = createMainWindow();

  installMenu(mainWindow);

  registerWindowIpcHandlers(mainWindow);
  registerNotificationIpcHandlers();
  registerServerIpcHandlers();
  registerQbIpcHandlers();
  registerTorrentIpcHandlers();
  registerSettingsIpcHandlers();
  registerElectronIpcHandlers();

  createTray(mainWindow);

  mainWindow.on('minimize', (e) => {
    e.preventDefault();
    mainWindow.hide();

    if (!notified) {
      notify(
        'BitButler is running in the background!',
        'You can access the app from the system tray.',
      );
      notified = true;
    }
  });

  return mainWindow;
}

const gotLock = app.requestSingleInstanceLock();

if (!gotLock) {
  app.quit();
} else {
  app.on('second-instance', (_event, argv) => {
    createOrRestoreMainWindow();
    handleSecondInstanceArgv(argv);
  });

  app.whenReady().then(() => {
    createOrRestoreMainWindow();

    app.on('activate', () => {
      createOrRestoreMainWindow();
    });
  });

  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit();
  });
}

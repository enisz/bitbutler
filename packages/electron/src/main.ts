import { app } from 'electron';
import { loadTranslations } from './i18n.js';
import { registerElectronIpcHandlers } from './ipc/electron.js';
import { registerExportIpcHandlers } from './ipc/export.js';
import { registerI18nIpcHandlers } from './ipc/i18n.js';
import { registerNotificationIpcHandlers } from './ipc/notification.js';
import { registerQbIpcHandlers } from './ipc/qbittorrent.js';
import { registerServerIpcHandlers } from './ipc/server.js';
import {
  getInitialLanguage,
  getStartupSettings,
  registerSettingsIpcHandlers,
} from './ipc/settings.js';
import { registerTorrentIpcHandlers } from './ipc/torrent.js';
import { handleSecondInstanceArgv, registerWindowIpcHandlers } from './ipc/window.js';
import { createMainWindow } from './main-window.js';
import { installMenu } from './menu.js';
import { notify } from './notification.js';
import { createTray } from './tray.js';

let mainWindow: Electron.BrowserWindow | null = null;
let notified = false;

export function getMainWindow(): Electron.BrowserWindow | null {
  return mainWindow;
}

if (process.platform === 'win32') {
  app.setAppUserModelId('com.enisz.bitbutler');
}

function createOrRestoreMainWindow(startMinimized = false): Electron.BrowserWindow {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.show();
    mainWindow.focus();
    return mainWindow;
  }

  mainWindow = createMainWindow(startMinimized);

  installMenu(mainWindow);

  registerWindowIpcHandlers(mainWindow);
  registerNotificationIpcHandlers();
  registerServerIpcHandlers();
  registerQbIpcHandlers();
  registerTorrentIpcHandlers();
  registerSettingsIpcHandlers();
  registerElectronIpcHandlers();
  registerExportIpcHandlers();

  createTray(mainWindow);

  mainWindow.on('minimize', () => {
    mainWindow!.hide();

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
    loadTranslations(getInitialLanguage());
    registerI18nIpcHandlers();

    const { openAtLogin, startMinimized } = getStartupSettings();
    app.setLoginItemSettings({ openAtLogin });
    createOrRestoreMainWindow(startMinimized);

    app.on('activate', () => {
      createOrRestoreMainWindow();
    });
  });

  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit();
  });
}

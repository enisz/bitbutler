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
import { hookRenderer, initLogger } from './logger.js';
import { createMainWindow } from './main-window.js';
import { installMenu } from './menu.js';
import { notify } from './notification.js';
import { createTray } from './tray.js';
import { registerUpdaterIpcHandlers } from './updater.js';

let mainWindow: Electron.BrowserWindow | null = null;
let notified = false;

export function getMainWindow(): Electron.BrowserWindow | null {
  return mainWindow;
}

if (process.platform === 'win32') {
  app.setAppUserModelId('com.enisz.bitbutler');
}

let appIpcHandlersRegistered = false;

function registerAppIpcHandlers(): void {
  if (appIpcHandlersRegistered) return;
  appIpcHandlersRegistered = true;

  registerNotificationIpcHandlers();
  registerServerIpcHandlers();
  registerQbIpcHandlers();
  registerTorrentIpcHandlers();
  registerSettingsIpcHandlers();
  registerElectronIpcHandlers();
  registerUpdaterIpcHandlers();
  registerExportIpcHandlers();
}

function createOrRestoreMainWindow(): Electron.BrowserWindow {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.show();
    mainWindow.focus();
    return mainWindow;
  }

  mainWindow = createMainWindow();

  installMenu(mainWindow);

  registerAppIpcHandlers();
  registerWindowIpcHandlers(mainWindow);

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

initLogger();
console.info(`[BitButler] Starting (platform=${process.platform}).`);

const gotLock = app.requestSingleInstanceLock();

if (!gotLock) {
  console.info('[BitButler] Another instance is already running; quitting.');
  app.quit();
} else {
  app.on('second-instance', (_event, argv) => {
    console.info('[BitButler] Second instance launched; focusing existing window.');
    createOrRestoreMainWindow();
    handleSecondInstanceArgv(argv);
  });

  app.whenReady().then(() => {
    loadTranslations(getInitialLanguage());
    registerI18nIpcHandlers();

    const { openAtLogin, startMinimized } = getStartupSettings();
    app.setLoginItemSettings({ openAtLogin });
    const mainWindow = createOrRestoreMainWindow();
    hookRenderer(mainWindow);
    if (!startMinimized) {
      mainWindow.once('ready-to-show', () => {
        mainWindow.maximize();
        mainWindow.show();
      });
    }

    app.on('activate', () => {
      createOrRestoreMainWindow();
    });
  });

  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
      console.info('[BitButler] All windows closed; quitting.');
      app.quit();
    }
  });
}

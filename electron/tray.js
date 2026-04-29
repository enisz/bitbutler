import { Menu, Tray, app } from 'electron';
import path from 'node:path';
import { getCookieJar, qbRequest } from './ipc/qbittorrent.js';
import { getActiveServerId } from './ipc/server.js';

let tray = null;
let mainWindowRef = null;

function getTrayIconPath() {
  if (app.isPackaged) {
    return path.join(process.resourcesPath, 'bitbutler.png');
  }
  return path.join(app.getAppPath(), 'src', 'assets', 'icons', 'bitbutler.png');
}

function showMainWindow({ maximize = true } = {}) {
  const win = mainWindowRef;
  if (!win || win.isDestroyed()) return;

  win.show();

  if (win.isMinimized()) {
    win.restore();
  }

  if (maximize) {
    setTimeout(() => {
      if (win.isDestroyed()) return;
      win.maximize();
      win.focus();
    }, 50);
  } else {
    win.focus();
  }
}

function isConnected() {
  const id = getActiveServerId();
  return id !== null && getCookieJar().has(id);
}

async function trayQbRequest(path, form) {
  const id = getActiveServerId();
  await qbRequest({ id, method: 'POST', path, form });
}

function buildContextMenu() {
  const connected = isConnected();

  return Menu.buildFromTemplate([
    {
      label: 'Show',
      click: () => showMainWindow({ maximize: true }),
    },
    {
      label: 'Hide',
      click: () => mainWindowRef?.hide(),
    },
    { type: 'separator' },
    {
      label: 'Start All Torrents',
      enabled: connected,
      click: () => trayQbRequest('/api/v2/torrents/resume', { hashes: 'all' }).catch(console.error),
    },
    {
      label: 'Stop All Torrents',
      enabled: connected,
      click: () => trayQbRequest('/api/v2/torrents/pause', { hashes: 'all' }).catch(console.error),
    },
    { type: 'separator' },
    {
      label: 'Remove Global Upload Limit',
      enabled: connected,
      click: () =>
        trayQbRequest('/api/v2/transfer/setUploadLimit', { limit: '0' }).catch(console.error),
    },
    {
      label: 'Remove Global Download Limit',
      enabled: connected,
      click: () =>
        trayQbRequest('/api/v2/transfer/setDownloadLimit', { limit: '0' }).catch(console.error),
    },
    {
      label: 'Toggle Alternative Speed',
      enabled: connected,
      click: () => trayQbRequest('/api/v2/transfer/toggleSpeedLimitsMode', {}).catch(console.error),
    },
    { type: 'separator' },
    {
      label: 'Quit',
      click: () => {
        tray?.destroy();
        tray = null;
        app.quit();
      },
    },
  ]);
}

export function rebuildTrayMenu() {
  if (!tray) return;
  tray.setContextMenu(buildContextMenu());
}

export function createTray(mainWindow) {
  mainWindowRef = mainWindow;
  if (tray) return;

  const iconPath = getTrayIconPath();
  tray = new Tray(iconPath);
  tray.setToolTip('BitButler');
  tray.setContextMenu(buildContextMenu());

  tray.on('click', () => {
    const win = mainWindowRef;
    if (!win || win.isDestroyed()) return;

    if (!win.isVisible() || win.isMinimized()) {
      showMainWindow({ maximize: true });
    } else {
      win.hide();
    }
  });
}

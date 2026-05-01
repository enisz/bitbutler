import { Menu, Tray, app } from 'electron';
import path from 'node:path';
import { getCookieJar, qbRequest } from './ipc/qbittorrent.js';
import { getActiveServerId } from './ipc/server.js';

let tray: Tray | null = null;
let mainWindowRef: Electron.BrowserWindow | null = null;

function getTrayIconPath(): string {
  if (app.isPackaged) {
    return path.join(process.resourcesPath, 'bitbutler.png');
  }
  return path.join(app.getAppPath(), 'packages', 'app', 'src', 'assets', 'icons', 'bitbutler.png');
}

function showMainWindow({ maximize = true } = {}): void {
  const win = mainWindowRef;
  if (!win || win.isDestroyed()) return;

  win.show();
  if (win.isMinimized()) win.restore();

  if (maximize) {
    setTimeout(() => {
      if (!win || win.isDestroyed()) return;
      win.maximize();
      win.focus();
    }, 50);
  } else {
    win.focus();
  }
}

function isConnected(): boolean {
  const id = getActiveServerId();
  return id !== null && getCookieJar().has(id);
}

async function trayQbRequest(reqPath: string, form: Record<string, string>): Promise<void> {
  const id = getActiveServerId();
  if (!id) return;
  await qbRequest({ id, method: 'POST', path: reqPath, form });
}

function buildContextMenu(): Electron.Menu {
  const connected = isConnected();

  return Menu.buildFromTemplate([
    { label: 'Show', click: () => showMainWindow({ maximize: true }) },
    { label: 'Hide', click: () => mainWindowRef?.hide() },
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

export function rebuildTrayMenu(): void {
  if (!tray) return;
  tray.setContextMenu(buildContextMenu());
}

export function createTray(mainWindow: Electron.BrowserWindow): void {
  mainWindowRef = mainWindow;
  if (tray) return;

  tray = new Tray(getTrayIconPath());
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

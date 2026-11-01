import { Menu, Tray, app } from 'electron';
import path from 'node:path';
import { t } from './i18n.js';
import { getCookieJar } from './ipc/qbittorrent.js';
import { getActiveServerId } from './ipc/server.js';
import { start, stop } from './qb/torrents.js';
import { setDownloadLimit, setUploadLimit, toggleSpeedLimitsMode } from './qb/transfer.js';

let tray: Tray | null = null;
let mainWindowRef: Electron.BrowserWindow | null = null;

function getTrayIconPath(): string {
  if (app.isPackaged) {
    return path.join(process.resourcesPath, 'bitbutler.png');
  }
  return path.join(app.getAppPath(), 'packages', 'app', 'public', 'bitbutler.png');
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

async function trayActive(run: (serverId: string) => Promise<void>): Promise<void> {
  const id = getActiveServerId();
  if (!id) return;
  await run(id);
}

async function trayRunTorrents(action: 'pause' | 'resume'): Promise<void> {
  const id = getActiveServerId();
  if (!id) return;
  await (action === 'pause' ? stop : start)(id, 'all');
}

function buildContextMenu(): Electron.Menu {
  const connected = isConnected();

  return Menu.buildFromTemplate([
    { label: t('electron.tray.show'), click: () => showMainWindow({ maximize: true }) },
    { label: t('electron.tray.hide'), click: () => mainWindowRef?.hide() },
    { type: 'separator' },
    {
      label: t('electron.tray.start-all-torrents'),
      enabled: connected,
      click: () => trayRunTorrents('resume').catch(console.error),
    },
    {
      label: t('electron.tray.stop-all-torrents'),
      enabled: connected,
      click: () => trayRunTorrents('pause').catch(console.error),
    },
    { type: 'separator' },
    {
      label: t('electron.tray.remove-upload-limit'),
      enabled: connected,
      click: () => trayActive((id) => setUploadLimit(id, 0)).catch(console.error),
    },
    {
      label: t('electron.tray.remove-download-limit'),
      enabled: connected,
      click: () => trayActive((id) => setDownloadLimit(id, 0)).catch(console.error),
    },
    {
      label: t('electron.tray.toggle-alt-speed'),
      enabled: connected,
      click: () => trayActive(toggleSpeedLimitsMode).catch(console.error),
    },
    { type: 'separator' },
    {
      label: t('electron.tray.quit'),
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

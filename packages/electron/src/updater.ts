import type { UpdateCapability, UpdaterEvent } from '@bitbutler/shared';
import { app, ipcMain } from 'electron';
import { autoUpdater } from 'electron-updater';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { getMainWindow } from './main.js';

const QUIT_AND_INSTALL_DELAY_MS = 1200;

export function registerUpdaterIpcHandlers(): void {
  autoUpdater.autoDownload = false;
  autoUpdater.autoInstallOnAppQuit = false;

  autoUpdater.on('checking-for-update', () => {
    sendUpdaterEvent({ status: 'checking' });
  });

  autoUpdater.on('update-available', () => {
    void autoUpdater.downloadUpdate();
  });

  autoUpdater.on('update-not-available', () => {
    sendUpdaterEvent({ status: 'error', message: 'No update is currently available.' });
  });

  // NSIS installers are unsigned until SignPath Foundation signing lands, so
  // Windows Defender SmartScreen can still block or delay the downloaded
  // update installer even though quitAndInstall() launches it programmatically
  // rather than via a user double-click. A stalled or failed automatic
  // install on Windows is an expected risk here, not necessarily a bug.
  autoUpdater.on(
    'download-progress',
    (progress: { percent: number; transferred: number; total: number }) => {
      sendUpdaterEvent({
        status: 'downloading',
        percent: progress.percent,
        transferred: progress.transferred,
        total: progress.total,
      });
    },
  );

  autoUpdater.on('update-downloaded', () => {
    sendUpdaterEvent({ status: 'downloaded' });
    setTimeout(() => autoUpdater.quitAndInstall(), QUIT_AND_INSTALL_DELAY_MS);
  });

  autoUpdater.on('error', (error: unknown) => {
    sendUpdaterEvent({ status: 'error', message: sanitizeError(error) });
  });

  ipcMain.handle('updater:get-capability', async () => getUpdateCapability());

  ipcMain.handle('updater:update-now', async () => {
    try {
      await autoUpdater.checkForUpdates();
    } catch (error) {
      sendUpdaterEvent({ status: 'error', message: sanitizeError(error) });
    }
  });
}

function getUpdateCapability(): UpdateCapability {
  if (!app.isPackaged) {
    return { supported: false };
  }

  if (process.platform === 'linux') {
    return { supported: Boolean(process.env.APPIMAGE) };
  }

  if (process.platform === 'win32') {
    // Use path.win32 explicitly (not the bare dirname/join re-exports) so this
    // resolves the same Windows-style path deterministically no matter which
    // OS actually runs the code - Node's default path module picks its
    // posix/win32 implementation from the real host platform, not the
    // process.platform value checked above.
    const updateExePath = path.win32.join(path.win32.dirname(process.execPath), 'Update.exe');
    return { supported: existsSync(updateExePath) };
  }

  return { supported: false };
}

function sendUpdaterEvent(event: UpdaterEvent): void {
  getMainWindow()?.webContents.send('updater:event', event);
}

function sanitizeError(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

import type { HostPlatform, UpdateCheckResponse } from '@bitbutler/shared';
import Axios from 'axios';
import { app, dialog, ipcMain, shell } from 'electron';
import Process from 'process';
import Semver from 'semver';

export function registerElectronIpcHandlers(): void {
  ipcMain.handle('electron:is-dev', async () => isDev());
  ipcMain.handle('electron:open-external-url', async (_event, url: string) => openExternalUrl(url));
  ipcMain.handle('electron:open-path', async (_event, p: string) => openPath(p));
  ipcMain.handle('electron:show-item-in-folder', async (_event, p: string) => showItemInFolder(p));
  ipcMain.handle('electron:show-open-dialog', async () => showOpenDialog());
  ipcMain.handle('electron:get-platform', async () => getPlatform());
  ipcMain.handle('electron:check-for-update', async () => checkForUpdate());
}

function getPlatform(): HostPlatform {
  return Process.platform as HostPlatform;
}

function isDev(): boolean {
  return !app.isPackaged;
}

function openExternalUrl(url: string): void {
  void shell.openExternal(url);
}

function openPath(p: string): Promise<string> {
  return shell.openPath(p);
}

function showItemInFolder(p: string): void {
  shell.showItemInFolder(p);
}

async function showOpenDialog(): Promise<string | undefined> {
  const { filePaths } = await dialog.showOpenDialog({
    properties: ['openDirectory'],
  });
  return filePaths[0];
}

async function checkForUpdate(): Promise<UpdateCheckResponse> {
  try {
    const response = await Axios.get<UpdateCheckResponse['releases']>(
      `https://api.github.com/repos/enisz/bitbutler/releases?per_page=100`,
      { headers: { 'User-Agent': 'Electron-App-Updater' } },
    );

    const currentVersion = app.getVersion();
    const releases = (response.data ?? [])
      .filter((r) => !r.draft && !r.prerelease)
      .filter((r) => {
        const v = r.tag_name.replace(/^v/, '');
        return Semver.valid(v) && Semver.gt(v, currentVersion);
      })
      .sort(
        (a, b) =>
          new Date(b.published_at ?? b.created_at).getTime() -
          new Date(a.published_at ?? a.created_at).getTime(),
      );

    if (releases.length > 0) {
      return { updateAvailable: true, releases };
    }

    return { updateAvailable: false };
  } catch (error) {
    console.error('Update check failed:', (error as Error).message);
    return { updateAvailable: false, error: (error as Error).message };
  }
}

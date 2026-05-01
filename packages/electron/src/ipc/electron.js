import Axios from 'axios';
import { app, dialog, ipcMain, shell } from 'electron';
import Process from 'process';
import Semver from 'semver';

export function registerElectronIpcHandlers() {
  ipcMain.handle('electron:is-dev', async (_event) => isDev());
  ipcMain.handle('electron:open-external-url', async (_event, url) => openExternalUrl(url));
  ipcMain.handle('electron:open-path', async (_event, path) => openPath(path));
  ipcMain.handle('electron:show-item-in-folder', async (_event, path) => showItemInFolder(path));
  ipcMain.handle('electron:show-open-dialog', async (_event) => showOpenDialog());
  ipcMain.handle('electron:get-platform', async (_event) => getPlatform());
  ipcMain.handle('electron:check-for-update', async (_event) => checkForUpdate());
}

function getPlatform() {
  return Process.platform.toLowerCase();
}

function isDev() {
  return !app.isPackaged;
}

function openExternalUrl(url) {
  shell.openExternal(url);
}

function openPath(path) {
  shell.openPath(path);
}

function showItemInFolder(path) {
  shell.showItemInFolder(path);
}

async function showOpenDialog() {
  const { filePaths } = await dialog.showOpenDialog({
    properties: ['openDirectory'],
  });

  return filePaths[0];
}

async function checkForUpdate() {
  try {
    const response = await Axios.get(
      `https://api.github.com/repos/enisz/bitbutler/releases?per_page=100`,
      {
        headers: {
          'User-Agent': 'Electron-App-Updater',
        },
      },
    );

    const currentVersion = app.getVersion();
    const releases = response.data
      .filter((r) => !r.draft && !r.prerelease)
      .filter((r) => {
        const v = r.tag_name.replace(/^v/, '');
        return Semver.valid(v) && Semver.gt(v, currentVersion);
      })
      .sort(
        (a, b) =>
          new Date(b.published_at ?? b.created_at) - new Date(a.published_at ?? a.created_at),
      );

    if (releases.length > 0) {
      return {
        updateAvailable: true,
        releases,
      };
    }

    return { updateAvailable: false };
  } catch (error) {
    console.error('Update check failed:', error.message);
    return { updateAvailable: false, error: error.message };
  }
}

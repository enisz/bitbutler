import { BrowserWindow, app } from 'electron';
import fs from 'node:fs';
import { join } from 'node:path';

const isDev = !app.isPackaged;

function firstExistingPath(paths: string[]): string | null {
  for (const p of paths) {
    if (fs.existsSync(p)) return p;
  }
  return null;
}

export function createMainWindow(startMinimized = false): BrowserWindow {
  const appPath = app.getAppPath();

  const iconCandidates = [
    join(appPath, 'dist', 'bitbutler', 'browser', 'assets', 'icons', 'bitbutler.png'),
    join(appPath, 'dist', 'bitbutler', 'assets', 'icons', 'bitbutler.png'),
  ];
  const windowIcon = firstExistingPath(iconCandidates);

  const mainWindow = new BrowserWindow({
    width: 600,
    height: 750,
    backgroundColor: '#121213',
    show: !startMinimized,
    ...(windowIcon ? { icon: windowIcon } : {}),
    resizable: true,
    fullscreenable: true,
    maximizable: true,
    webPreferences: {
      contextIsolation: true,
      preload: join(appPath, 'packages', 'electron', 'dist', 'preload.js'),
    },
  });

  if (isDev) {
    mainWindow.loadURL('http://localhost:4200');
  } else {
    const indexCandidates = [
      join(appPath, 'dist', 'bitbutler', 'browser', 'index.html'),
      join(appPath, 'dist', 'bitbutler', 'index.html'),
    ];
    const indexPath = firstExistingPath(indexCandidates);

    if (!indexPath) {
      console.error('Could not find Angular index.html in packaged app.', { indexCandidates });
    } else {
      mainWindow.loadFile(indexPath);
    }
  }

  mainWindow.webContents.on('did-fail-load', (_e, code, desc, url) => {
    console.error('did-fail-load', { code, desc, url });
  });

  mainWindow.webContents.on('render-process-gone', (_e, details) => {
    console.error('render-process-gone', details);
  });

  let lastState: object | null = null;
  const sendWindowState = (): void => {
    if (mainWindow.isDestroyed()) return;
    const [width, height] = mainWindow.getSize();
    const newState = {
      isMaximized: mainWindow.isMaximized(),
      isMinimized: mainWindow.isMinimized() || !mainWindow.isVisible(),
      isFullScreen: mainWindow.isFullScreen(),
      width,
      height,
    };

    if (lastState && JSON.stringify(newState) === JSON.stringify(lastState)) {
      return;
    }
    lastState = newState;

    mainWindow.webContents.send('window:state-change', newState);
  };

  let resizeTimeout: ReturnType<typeof setTimeout>;
  mainWindow.on('resize', () => {
    clearTimeout(resizeTimeout);
    resizeTimeout = setTimeout(sendWindowState, 100);
  });

  mainWindow.on('maximize', sendWindowState);
  mainWindow.on('unmaximize', sendWindowState);
  mainWindow.on('enter-full-screen', sendWindowState);
  mainWindow.on('leave-full-screen', sendWindowState);

  mainWindow.on('hide', () => {
    mainWindow.webContents.send('window-visibility-change', 'hidden');
    sendWindowState();
  });

  mainWindow.on('show', () => {
    mainWindow.webContents.send('window-visibility-change', 'visible');
    sendWindowState();
  });

  return mainWindow;
}

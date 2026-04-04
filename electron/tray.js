import { Menu, Tray, app } from 'electron';
import path from 'node:path';

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

export function createTray(mainWindow) {
  mainWindowRef = mainWindow;
  if (tray) return;

  const iconPath = getTrayIconPath();
  tray = new Tray(iconPath);
  tray.setToolTip('BitButler');

  const contextMenu = Menu.buildFromTemplate([
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
      label: 'Quit',
      click: () => {
        tray?.destroy();
        tray = null;
        app.quit();
      },
    },
  ]);

  tray.setContextMenu(contextMenu);

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

import { ipcMain } from 'electron';
import { rebuildMenu } from '../menu.js';

let activeViewId: string | null = null;

export const getActiveViewId = (): string | null => activeViewId;
export const setActiveViewId = (id: string | null): void => {
  activeViewId = id;
};

export function registerViewIpcHandlers(): void {
  ipcMain.on('view:set-active', (_event, viewId: string | null) => {
    activeViewId = viewId;
    rebuildMenu();
  });
}

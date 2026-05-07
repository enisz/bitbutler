import { ipcMain } from 'electron';
import { loadTranslations } from '../i18n.js';
import { rebuildMenu } from '../menu.js';
import { rebuildTrayMenu } from '../tray.js';

export function registerI18nIpcHandlers(): void {
  ipcMain.on('i18n:language-changed', (_event, payload: unknown) => {
    const lang =
      payload !== null && typeof payload === 'object'
        ? ((payload as Record<string, unknown>).lang as string | undefined)
        : undefined;

    if (typeof lang === 'string' && lang) {
      loadTranslations(lang);
      rebuildMenu();
      rebuildTrayMenu();
    }
  });
}

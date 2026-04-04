import { Notification, app } from 'electron';
import path from 'node:path';

function getNotificationIconPath() {
  if (app.isPackaged) return path.join(process.resourcesPath, 'bitbutler.png');
  return path.join(app.getAppPath(), 'src', 'assets', 'icons', 'bitbutler.png');
}

/**
 * @param {string} title
 * @param {string} body
 * @param {{ silent?: boolean }} [options]
 */
export function notify(title, body, options) {
  try {
    if (!Notification.isSupported()) {
      console.warn('[notify] Notifications are not supported on this system.');
      return null;
    }

    const n = new Notification({
      title,
      body,
      icon: getNotificationIconPath(),
      silent: !!options?.silent,
    });

    n.show();
    return n;
  } catch (e) {
    console.error('[notify] failed', e);
    return null;
  }
}

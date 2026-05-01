import { Notification, app } from 'electron';
import path from 'node:path';

function getNotificationIconPath(): string {
  if (app.isPackaged) return path.join(process.resourcesPath, 'bitbutler.png');
  return path.join(app.getAppPath(), 'packages', 'app', 'src', 'assets', 'icons', 'bitbutler.png');
}

export function notify(
  title: string,
  body?: string,
  options?: { silent?: boolean },
): Notification | null {
  try {
    if (!Notification.isSupported()) {
      console.warn('[notify] Notifications are not supported on this system.');
      return null;
    }

    const n = new Notification({
      title,
      body: body ?? '',
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

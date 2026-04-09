import { Injectable } from '@angular/core';

@Injectable({ providedIn: 'root' })
export class NotificationService {
  public async send(title: string, body: string, options?: { silent?: boolean }): Promise<void> {
    const api = window.bitbutler?.notification?.show;

    if (typeof api === 'function') {
      try {
        const res = await api({ title, body, options });
        if (res?.ok) return;

        console.error(NotificationService.name, 'send', 'main notification rejected:', res?.error);
      } catch (e) {
        console.error(NotificationService.name, 'send', 'main notification failed:', e);
      }
    }

    if ('Notification' in window) {
      try {
        if (Notification.permission === 'granted') {
          new Notification(title, { body });
        } else if (Notification.permission !== 'denied') {
          const perm = await Notification.requestPermission();
          if (perm === 'granted') new Notification(title, { body });
        }
      } catch (e) {
        console.error(NotificationService.name, 'send', 'renderer notification failed:', e);
      }
    }
  }
}

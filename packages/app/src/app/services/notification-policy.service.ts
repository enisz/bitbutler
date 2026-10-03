import { Injectable, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { DEFAULT_GENERAL_SETTINGS, NotificationSettings } from '../models/general-settings.model';
import { NotificationCategory } from '../models/notification.model';
import { GeneralSettingsService } from './general-settings.service';
import { WindowService } from './window.service';

export const OS_DEDUPE_WINDOW_MS = 5000;

@Injectable({ providedIn: 'root' })
export class NotificationPolicyService {
  private readonly windowService = inject(WindowService);

  private settings: NotificationSettings = DEFAULT_GENERAL_SETTINGS.notifications;
  private readonly lastOsShownAt = new Map<string, number>();

  constructor() {
    inject(GeneralSettingsService)
      .asObservable()
      .pipe(takeUntilDestroyed())
      .subscribe((settings) => {
        this.settings = settings.notifications;
      });
  }

  public allowApp(category: NotificationCategory): boolean {
    const { app } = this.settings;
    return app.enabled && app[category];
  }

  public allowOs(category: NotificationCategory, title: string, body: string): boolean {
    if (category === 'confirmations') return false;

    const { os } = this.settings;
    if (!os.enabled || !os[category]) return false;
    if (os.onlyWhenMinimized && !this.windowService.state().isMinimized) return false;

    return this.registerOsShown(title, body);
  }

  private registerOsShown(title: string, body: string): boolean {
    const now = Date.now();

    for (const [key, shownAt] of this.lastOsShownAt) {
      if (now - shownAt >= OS_DEDUPE_WINDOW_MS) this.lastOsShownAt.delete(key);
    }

    const key = `${title}\u0000${body}`;
    if (this.lastOsShownAt.has(key)) return false;

    this.lastOsShownAt.set(key, now);
    return true;
  }
}

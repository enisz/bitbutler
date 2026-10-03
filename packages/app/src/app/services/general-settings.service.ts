import { Injectable } from '@angular/core';
import {
  DEFAULT_GENERAL_SETTINGS,
  GeneralSettings,
  ToastPosition,
} from '../models/general-settings.model';
import { BaseSettingsService } from './base-settings.service';

@Injectable({ providedIn: 'root' })
export class GeneralSettingsService extends BaseSettingsService<GeneralSettings> {
  protected readonly SETTINGS_ID = 'GeneralSettingsService';
  protected readonly DEFAULT_SETTINGS = DEFAULT_GENERAL_SETTINGS;

  // behavior.toastPosition moved to notifications.app.position.
  protected override migrate(stored: Partial<GeneralSettings>): Partial<GeneralSettings> {
    const { toastPosition, ...behavior } = (stored.behavior ?? {}) as Partial<
      GeneralSettings['behavior']
    > & { toastPosition?: ToastPosition };

    if (!toastPosition) {
      return stored;
    }

    return {
      ...stored,
      behavior,
      notifications: {
        ...stored.notifications,
        app: { position: toastPosition, ...stored.notifications?.app },
      },
    } as Partial<GeneralSettings>;
  }
}

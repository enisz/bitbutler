import { Injectable } from '@angular/core';
import {
  DEFAULT_STATUS_BAR_SETTINGS,
  StatusBarSettings,
} from '../models/status-bar-settings.model';
import { BaseSettingsService } from './base-settings.service';

@Injectable({ providedIn: 'root' })
export class StatusBarSettingsService extends BaseSettingsService<StatusBarSettings> {
  protected readonly SETTINGS_ID = StatusBarSettingsService.name;
  protected readonly DEFAULT_SETTINGS = DEFAULT_STATUS_BAR_SETTINGS;

  protected override normalize(s: StatusBarSettings): StatusBarSettings {
    return {
      available: Array.isArray(s.available) ? [...s.available] : [],
      left: Array.isArray(s.left) ? [...s.left] : [],
      right: Array.isArray(s.right) ? [...s.right] : [],
    };
  }
}

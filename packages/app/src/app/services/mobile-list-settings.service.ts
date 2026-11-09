import { Injectable } from '@angular/core';
import {
  DEFAULT_MOBILE_LIST_SETTINGS,
  MobileListSettings,
  PHONE_SORT_KEYS,
} from '../models/mobile-list-settings.model';
import { BaseSettingsService } from './base-settings.service';

@Injectable({ providedIn: 'root' })
export class MobileListSettingsService extends BaseSettingsService<MobileListSettings> {
  protected readonly SETTINGS_ID = 'MobileListSettingsService';
  protected readonly DEFAULT_SETTINGS = DEFAULT_MOBILE_LIST_SETTINGS;

  protected override normalize(settings: MobileListSettings): MobileListSettings {
    if (PHONE_SORT_KEYS.includes(settings.sortKey)) {
      return settings;
    }
    return {
      ...settings,
      sortKey: DEFAULT_MOBILE_LIST_SETTINGS.sortKey,
      sortDesc: DEFAULT_MOBILE_LIST_SETTINGS.sortDesc,
    };
  }
}

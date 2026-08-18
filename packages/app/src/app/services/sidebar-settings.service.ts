import { Injectable } from '@angular/core';
import { DEFAULT_SIDEBAR_SETTINGS, SidebarSettings } from '../models/sidebar-settings.model';
import { BaseSettingsService } from './base-settings.service';

@Injectable({ providedIn: 'root' })
export class SidebarSettingsService extends BaseSettingsService<SidebarSettings> {
  protected readonly SETTINGS_ID = 'SidebarSettingsService';
  protected readonly DEFAULT_SETTINGS = DEFAULT_SIDEBAR_SETTINGS;
}

import { Injectable } from '@angular/core';
import { DEFAULT_DASHBOARD_LAYOUT, DashboardLayout } from '../models/dashboard.model';
import { BaseSettingsService } from './base-settings.service';

@Injectable({ providedIn: 'root' })
export class DashboardSettingsService extends BaseSettingsService<DashboardLayout> {
  protected readonly SETTINGS_ID = 'DashboardSettingsService';
  protected readonly DEFAULT_SETTINGS = DEFAULT_DASHBOARD_LAYOUT;
}

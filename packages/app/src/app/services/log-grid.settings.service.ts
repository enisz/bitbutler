import { Injectable } from '@angular/core';
import { DEFAULT_LOG_GRID_SETTINGS, LogGridSettings } from '../models/log-grid.model';
import { BaseSettingsService } from './base-settings.service';

@Injectable({ providedIn: 'root' })
export class LogGridSettingsService extends BaseSettingsService<LogGridSettings> {
  protected readonly SETTINGS_ID = 'LogGridSettingsService';
  protected readonly DEFAULT_SETTINGS = DEFAULT_LOG_GRID_SETTINGS;
}

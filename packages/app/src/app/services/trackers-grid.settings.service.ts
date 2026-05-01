import { Injectable } from '@angular/core';
import {
  DEFAULT_TRACKERS_GRID_SETTINGS,
  TrackersGridSettings,
} from '../models/trackers-grid.model';
import { BaseSettingsService } from './base-settings.service';

@Injectable({ providedIn: 'root' })
export class TrackersGridSettingsService extends BaseSettingsService<TrackersGridSettings> {
  protected readonly SETTINGS_ID = TrackersGridSettingsService.name;
  protected readonly DEFAULT_SETTINGS = DEFAULT_TRACKERS_GRID_SETTINGS;
}
